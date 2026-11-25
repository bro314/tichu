import test from "node:test";
import assert from "node:assert/strict";
import { Bet, Card, State } from "../src/elements/model";
import {
  createScoreBoard,
  isIgnoredReplayNotif,
  NotifsPacket,
  ReplayEngine,
  segmentNotifMoves,
  tidyUpGamelogs,
} from "../src/elements/replay-engine";
import { deepEqual } from "../src/elements/utils";
import replayFixture from "./fixtures/replay-stream.json";

const P0 = 2385074;
const P1 = 2385075;
const P2 = 2385076;
const P3 = 2385077;

function makeFullDeck(): Card[] {
  const deck: Card[] = [];
  let id = 1;
  for (let type = 1; type <= 4; type++) {
    for (let typeArg = 1; typeArg <= 14; typeArg++) {
      deck.push({
        id: String(id++),
        type: String(type),
        type_arg: String(typeArg),
      });
    }
  }
  return deck;
}

function makePlayers(seatNos: [number, number, number, number] = [1, 2, 3, 4]): Player[] {
  const ids = [P0, P1, P2, P3];
  const names = ["Alice", "Bob", "Carol", "Dave"];
  const colors = ["000000", "ff0000", "000000", "ff0000"];
  return ids.map((id, i) => ({
    id,
    no: seatNos[i]!,
    name: names[i]!,
    color: colors[(seatNos[i]! - 1) % 2]!,
    color_back: null,
    score: "0",
    beginner: false,
    eliminated: 0,
    is_ai: "0",
    zombie: 0,
    call_tichu: Bet.INITIAL,
    call_grand_tichu: Bet.INITIAL,
    team: (seatNos[i]! - 1) % 2,
  }));
}

function collectRoundCards(state: State): Card[] {
  const handCards = state.players.flatMap((p) => p.cards);
  const unacceptedPassed = state.passedCards.filter((pc) => !pc.accepted).map((pc) => pc.card);
  const trickCards = state.trick.combos.flatMap((c) => c.cards);
  const capturedCards = state.capturedCards;
  return [...handCards, ...unacceptedPassed, ...trickCards, ...capturedCards];
}

function assertStreamInvariants(engine: ReplayEngine, label: string): State[] {
  const notifs = engine.getNotifs();
  const N = notifs.length;
  assert.ok(N > 0, `${label}: expected non-empty notification list`);

  const forwardStates: State[] = [structuredClone(engine.getState())];
  let cardsDealtInCurrentRound = 0;
  let fullDeckAssertions = 0;

  for (let i = 0; i < N; i++) {
    const notif = notifs[i]!;
    const type = notif.type as string;
    const args = (notif.args ?? {}) as any;

    if (type === "dealCards" && Array.isArray(args.cards)) {
      cardsDealtInCurrentRound += args.cards.length;
    } else if (type === "newScores") {
      cardsDealtInCurrentRound = 0;
    }

    const stepped = engine.stepForward();
    assert.equal(stepped, true, `${label}: stepForward() should return true at index ${i}`);
    assert.equal(engine.getNotifIndex(), i + 1, `${label}: notifIndex should be ${i + 1}`);
    assert.equal(
      engine.getIgnoredNotifType(),
      "",
      `${label}: unexpected unignored notification type '${engine.getIgnoredNotifType()}' at index ${i} (${type})`,
    );

    const state = engine.getState();
    const allCards = collectRoundCards(state);
    const uniqueIds = new Set(allCards.map((c) => String(c.id)));
    assert.equal(
      uniqueIds.size,
      allCards.length,
      `${label}: duplicate card IDs at index ${i} (${type}): total=${allCards.length}, unique=${uniqueIds.size}`,
    );
    assert.equal(
      allCards.length,
      cardsDealtInCurrentRound,
      `${label}: card conservation mismatch at index ${i} (${type}): expected ${cardsDealtInCurrentRound}, got ${allCards.length}`,
    );
    if (cardsDealtInCurrentRound === 56) {
      assert.equal(allCards.length, 56);
      fullDeckAssertions++;
    }

    for (const p of state.players) {
      assert.equal(
        typeof p.gamePoints,
        "number",
        `${label}: player ${p.player.id} gamePoints must be normalized to number`,
      );
      assert.equal(Number.isNaN(p.gamePoints), false);
    }

    forwardStates.push(structuredClone(state));
  }

  assert.ok(
    fullDeckAssertions > 0,
    `${label}: expected at least one 56-card conservation check after full deal`,
  );

  // Upper-bound guard: stepForward() past N is a safe no-op
  assert.equal(engine.stepForward(), false, `${label}: stepForward() at N must return false`);
  assert.equal(
    engine.getNotifIndex(),
    N,
    `${label}: notifIndex must stay N after upper-bound call`,
  );
  assert.equal(
    deepEqual(engine.getState(), forwardStates[N]),
    true,
    `${label}: state at N must remain unchanged after extra stepForward()`,
  );

  // Backward N..0 deep equality at every index i
  for (let i = N - 1; i >= 0; i--) {
    const steppedBack = engine.stepBack();
    assert.equal(steppedBack, true, `${label}: stepBack() should return true to index ${i}`);
    assert.equal(engine.getNotifIndex(), i, `${label}: notifIndex should be ${i} after stepBack()`);
    assert.equal(
      deepEqual(engine.getState(), forwardStates[i]),
      true,
      `${label}: deepEqual mismatch on stepBack() at index ${i}`,
    );
  }

  // Lower-bound guard: stepBack() at 0 is a safe no-op
  assert.equal(engine.stepBack(), false, `${label}: stepBack() at 0 must return false`);
  assert.equal(engine.getNotifIndex(), 0, `${label}: notifIndex must stay 0`);
  assert.equal(deepEqual(engine.getState(), forwardStates[0]), true);

  // nextMove() / prevMove() parity
  const moveStops: number[] = [0];
  while (engine.getNotifIndex() < N) {
    const before = engine.getNotifIndex();
    engine.nextMove();
    const after = engine.getNotifIndex();
    assert.ok(
      after > before,
      `${label}: nextMove() must advance notifIndex (${before} -> ${after})`,
    );
    assert.equal(
      deepEqual(engine.getState(), forwardStates[after]),
      true,
      `${label}: nextMove() state mismatch at index ${after}`,
    );
    moveStops.push(after);
  }
  engine.nextMove();
  assert.equal(engine.getNotifIndex(), N, `${label}: nextMove() at N must be a no-op`);

  for (let m = moveStops.length - 2; m >= 0; m--) {
    const expectedIdx = moveStops[m]!;
    engine.prevMove();
    assert.equal(
      engine.getNotifIndex(),
      expectedIdx,
      `${label}: prevMove() should land on move boundary ${expectedIdx}`,
    );
    assert.equal(
      deepEqual(engine.getState(), forwardStates[expectedIdx]),
      true,
      `${label}: prevMove() state mismatch at move boundary ${expectedIdx}`,
    );
  }
  engine.prevMove();
  assert.equal(engine.getNotifIndex(), 0, `${label}: prevMove() at 0 must be a no-op`);

  return forwardStates;
}

function buildDealAndPassPackets(
  deck: Card[],
  playerOrder: [number, number, number, number],
  gtBets: [number | string, number | string, number | string, number | string],
  startPacketId = 1,
  startMoveId = 1,
): { packets: NotifsPacket[]; nextPacketId: number; nextMoveId: number } {
  const packets: NotifsPacket[] = [];
  let pktId = startPacketId;
  let moveId = startMoveId;

  // Deal first 8 cards to each player
  for (let pIdx = 0; pIdx < 4; pIdx++) {
    const pid = playerOrder[pIdx]!;
    const cards = deck.slice(pIdx * 14, pIdx * 14 + 8).map((c) => ({
      ...c,
      location: "hand",
      location_arg: String(pid),
    }));
    packets.push({
      packet_id: String(pktId++),
      move_id: String(moveId),
      channel: `/player/p${pid}`,
      data: [{ type: "dealCards", args: { cards } } as unknown as Notif],
    });
  }

  // Grand Tichu bets (mix of int 200 and legacy string "200" / 0 / "0")
  for (let pIdx = 0; pIdx < 4; pIdx++) {
    const pid = playerOrder[pIdx]!;
    moveId++;
    packets.push({
      packet_id: String(pktId++),
      move_id: String(moveId),
      channel: "/table/t1",
      data: [
        {
          type: "grandTichuBet",
          args: { player_id: pid, player_name: `P${pid}`, bet: gtBets[pIdx] },
        } as unknown as Notif,
      ],
    });
  }

  // Deal last 6 cards to each player
  moveId++;
  for (let pIdx = 0; pIdx < 4; pIdx++) {
    const pid = playerOrder[pIdx]!;
    const cards = deck.slice(pIdx * 14 + 8, pIdx * 14 + 14).map((c) => ({
      ...c,
      location: "hand",
      location_arg: String(pid),
    }));
    packets.push({
      packet_id: String(pktId++),
      move_id: String(moveId),
      channel: `/player/p${pid}`,
      data: [{ type: "dealCards", args: { cards } } as unknown as Notif],
    });
  }

  // Pass first 3 cards of each player's 14-card slice
  for (let pIdx = 0; pIdx < 4; pIdx++) {
    const pid = playerOrder[pIdx]!;
    moveId++;
    const c0 = deck[pIdx * 14]!;
    const c1 = deck[pIdx * 14 + 1]!;
    const c2 = deck[pIdx * 14 + 2]!;
    packets.push({
      packet_id: String(pktId++),
      move_id: String(moveId),
      channel: `/player/p${pid}`,
      data: [
        {
          type: "passCards",
          args: {
            cardIds: [c0.id, c1.id, c2.id],
            card1: c0.type_arg,
            card2: c1.type_arg,
            card3: c2.type_arg,
          },
        } as unknown as Notif,
      ],
    });
  }

  // Accept passed cards for each player
  moveId++;
  for (let pIdx = 0; pIdx < 4; pIdx++) {
    const pid = playerOrder[pIdx]!;
    packets.push({
      packet_id: String(pktId++),
      move_id: String(moveId),
      channel: `/player/p${pid}`,
      data: [
        {
          type: "acceptCards",
          args: { cards: [], card1: "2", card2: "3", card3: "4" },
        } as unknown as Notif,
      ],
    });
  }

  return { packets, nextPacketId: pktId, nextMoveId: moveId + 1 };
}

test("ReplayEngine: captured multi-round game stream (0..N, 56-card conservation, N..0 deepEqual, moves & rounds)", () => {
  const players = replayFixture.players as unknown as Player[];
  const gamelogs = replayFixture.gamelogs as unknown as NotifsPacket[];
  const engine = new ReplayEngine(gamelogs, players);

  const forwardStates = assertStreamInvariants(engine, "captured-fixture");
  const N = engine.getNotifs().length;

  // Verify scoreboard matches all completed rounds and final scores from fixture
  const board = engine.getScoreBoard();
  assert.equal(board.rounds.length, 2, "Captured fixture should have 2 completed rounds");
  const lastRound = board.rounds[board.rounds.length - 1]!;
  for (const scoreEntry of lastRound.scores) {
    const expected = Number(
      (replayFixture.finalScores as Record<string, string>)[String(scoreEntry.id)],
    );
    assert.equal(
      scoreEntry.gamePoints,
      expected,
      `Final scoreboard gamePoints for player ${scoreEntry.id} should match fixture finalScores`,
    );
  }

  // Verify final state gamePoints match scoreboard
  const finalState = forwardStates[N]!;
  for (const ps of finalState.players) {
    const expected = Number(
      (replayFixture.finalScores as Record<string, string>)[String(ps.player.id)],
    );
    assert.equal(ps.gamePoints, expected);
  }

  // Verify nextRound() / prevRound() parity across all rounds
  const roundStops: number[] = [];
  while (engine.getNotifIndex() < N) {
    engine.nextRound();
    const idx = engine.getNotifIndex();
    roundStops.push(idx);
    assert.equal(
      deepEqual(engine.getState(), forwardStates[idx]),
      true,
      `nextRound() state mismatch at index ${idx}`,
    );
    if (idx < N) {
      const passed = engine.getState().passedCards;
      assert.equal(passed.length, 12, "nextRound() should stop at 12 passed cards");
      assert.equal(
        passed.some((c) => c.accepted),
        false,
      );
    }
  }
  assert.equal(
    roundStops.length,
    3,
    "2-round game should have 2 pass-card stops plus final end-of-stream stop",
  );

  // Step backward through rounds with prevRound()
  for (let r = roundStops.length - 2; r >= 0; r--) {
    const expectedIdx = roundStops[r]!;
    engine.prevRound();
    assert.equal(engine.getNotifIndex(), expectedIdx);
    assert.equal(deepEqual(engine.getState(), forwardStates[expectedIdx]), true);
  }
});

test("ReplayEngine: GT bet 200 int & legacy '200' string, tichuBet 100/0, wishMade/mahjongWishGranted, ambiguous Phoenix & Dragon gift", () => {
  const deck = makeFullDeck();
  const players = makePlayers([1, 2, 3, 4]);
  // P0 bets int 200, P1 bets legacy string "200", P2 bets int 0, P3 bets string "0"
  const { packets, nextPacketId, nextMoveId } = buildDealAndPassPackets(
    deck,
    [P0, P1, P2, P3],
    [200, "200", 0, "0"],
  );
  let pktId = nextPacketId;
  let moveId = nextMoveId;

  // Verify P0..P3 hands after passCards -> acceptCards:
  // Each player passed indices [0, 1, 2] of their 14-card slice (to previous, partner, next)
  // and keeps indices [3..13] of their slice plus 3 received cards.
  const p0Cards = deck.slice(3, 14);
  const p1Cards = deck.slice(14 + 3, 28);
  const p2Cards = deck.slice(28 + 3, 42);
  const p3Cards = deck.slice(42 + 3, 56);

  // P2 calls Tichu (100), P3 calls Tichu ("100") then auto-closes Tichu (0) on play
  packets.push(
    {
      packet_id: String(pktId++),
      move_id: String(moveId++),
      channel: `/player/p${P2}`,
      data: [
        {
          type: "confirmTichu",
          args: { grand: false, msg: "Are you sure?" },
        } as unknown as Notif,
      ],
    },
    {
      packet_id: String(pktId++),
      move_id: String(moveId++),
      channel: "/table/t1",
      data: [
        {
          type: "tichuBet",
          args: { player_id: P2, player_name: "Carol", bet: 100 },
        } as unknown as Notif,
      ],
    },
    {
      packet_id: String(pktId++),
      move_id: String(moveId++),
      channel: "/table/t1",
      data: [
        {
          type: "tichuBet",
          args: { player_id: P3, player_name: "Dave", bet: "100" },
        } as unknown as Notif,
      ],
    },
  );

  // Active player P0 plays single card and makes a Mahjong wish (wish = 8)
  packets.push({
    packet_id: String(pktId++),
    move_id: String(moveId++),
    channel: "/table/t1",
    data: [
      {
        type: "gameStateChange",
        args: { id: 60, name: "playComboOpen", type: "activeplayer", active_player: String(P0) },
      } as unknown as Notif,
      {
        type: "playCombo",
        args: {
          player_id: P0,
          player_name: "Alice",
          combo_name: "Mahjong",
          cards: [p0Cards[0]!],
          points: 0,
          type: 1,
          phoenixValue: null,
        },
      } as unknown as Notif,
      {
        type: "wishMade",
        args: {
          player_id: P0,
          player_name: "Alice",
          wish: 8,
          text_value: "8",
        },
      } as unknown as Notif,
    ],
  });

  // P1 grants the Mahjong wish and plays a single card
  packets.push({
    packet_id: String(pktId++),
    move_id: String(moveId++),
    channel: "/table/t1",
    data: [
      {
        type: "mahjongWishGranted",
        args: {},
      } as unknown as Notif,
      {
        type: "playCombo",
        args: {
          player_id: P1,
          player_name: "Bob",
          combo_name: "8",
          cards: [p1Cards[0]!],
          points: 0,
          type: 1,
          phoenixValue: null,
        },
      } as unknown as Notif,
    ],
  });

  // P2 wins with Dragon (25 pts) and gifts trick (25 pts) to opponent P1 via captureCards
  packets.push({
    packet_id: String(pktId++),
    move_id: String(moveId++),
    channel: "/table/t1",
    data: [
      {
        type: "playCombo",
        args: {
          player_id: P2,
          player_name: "Carol",
          combo_name: "Dragon",
          cards: [p2Cards[0]!],
          points: 25,
          type: 1,
          phoenixValue: null,
        },
      } as unknown as Notif,
      {
        type: "pass",
        args: { player_id: P3, player_name: "Dave" },
      } as unknown as Notif,
      {
        type: "pass",
        args: { player_id: P0, player_name: "Alice" },
      } as unknown as Notif,
      {
        type: "pass",
        args: { player_id: P1, player_name: "Bob" },
      } as unknown as Notif,
      {
        type: "captureCards",
        args: { player_id: P1, player_name: "Bob", trick_value: 25 },
      } as unknown as Notif,
    ],
  });

  // Trick 2: Ambiguous Phoenix 5-card straight playCombo by P2, beaten by ambiguous Phoenix full-house playCombo by P3 (with tichuBet 0 close)
  const straightCards = p2Cards.slice(1, 6);
  const fullHouseCards = p3Cards.slice(0, 5);
  packets.push({
    packet_id: String(pktId++),
    move_id: String(moveId++),
    channel: "/table/t1",
    data: [
      {
        type: "playCombo",
        args: {
          player_id: P2,
          player_name: "Carol",
          combo_name: "Run of 5 cards from 4 to 8",
          cards: straightCards,
          points: 5,
          type: 5,
          phoenixValue: 8,
        },
      } as unknown as Notif,
      {
        type: "tichuBet",
        args: { player_id: P3, player_name: "Dave", bet: 0 },
      } as unknown as Notif,
      {
        type: "playCombo",
        args: {
          player_id: P3,
          player_name: "Dave",
          combo_name: "8s full of 4s",
          cards: fullHouseCards,
          points: 0,
          type: 6,
          phoenixValue: 8,
        },
      } as unknown as Notif,
      {
        type: "captureCards",
        args: { player_id: P3, player_name: "Dave", trick_value: 5 },
      } as unknown as Notif,
    ],
  });

  const engine = new ReplayEngine(packets, players);
  const forwardStates = assertStreamInvariants(engine, "synthetic-gt-wish-phoenix-dragon");

  // Verify GT bet states (both int 200 and legacy string "200" produce Bet.GRAND_TICHU)
  const afterGtState = forwardStates[8]!;
  assert.equal(afterGtState.players[0]!.bet, Bet.GRAND_TICHU);
  assert.equal(afterGtState.players[1]!.bet, Bet.GRAND_TICHU);
  assert.equal(afterGtState.players[2]!.bet, Bet.NO_BET_YET);
  assert.equal(afterGtState.players[3]!.bet, Bet.NO_BET_YET);

  // Verify wishMade sets wish=8 and mahjongWishGranted clears wish=0
  const wishState = forwardStates.find((s) => s.wish === 8);
  assert.ok(wishState, "Expected state with wish === 8 after wishMade");

  const finalState = forwardStates[forwardStates.length - 1]!;
  assert.equal(finalState.wish, 0, "mahjongWishGranted should clear wish to 0");
  assert.equal(finalState.players[2]!.bet, Bet.TICHU);
  assert.equal(finalState.players[3]!.bet, Bet.NO_BET, "tichuBet(0) should set Bet.NO_BET");
  assert.equal(finalState.players[1]!.roundPoints, 25, "Dragon gift should award 25 pts to P1");
  assert.equal(finalState.players[3]!.roundPoints, 5, "Second trick should award 5 pts to P3");
  assert.equal(
    finalState.capturedCards.length,
    13,
    "3 cards from trick 1 + 10 cards from trick 2 should be in capturedCards",
  );
});

test("ReplayEngine: bomb interrupt + cancel + bomb win, zombie turn, Double Victory, and multi-round newScores/roundScore", () => {
  const deck = makeFullDeck();
  const players = makePlayers([1, 2, 3, 4]);
  const { packets, nextPacketId, nextMoveId } = buildDealAndPassPackets(
    deck,
    [P0, P1, P2, P3],
    [0, 0, 0, 0],
  );
  let pktId = nextPacketId;
  let moveId = nextMoveId;

  const p0Cards = deck.slice(3, 14);
  const p1Cards = deck.slice(14 + 3, 28);
  const p2Cards = deck.slice(28 + 3, 42);

  // Trick 1: P0 leads single, P2 triggers bomb interrupt (playBomb state), cancels back to P1,
  // P1 passes (zombie turn), then P2 plays 4-card bomb and wins the trick!
  packets.push({
    packet_id: String(pktId++),
    move_id: String(moveId++),
    channel: "/table/t1",
    data: [
      {
        type: "gameStateChange",
        args: { id: 60, name: "playComboOpen", type: "activeplayer", active_player: String(P0) },
      } as unknown as Notif,
      {
        type: "playCombo",
        args: {
          player_id: P0,
          player_name: "Alice",
          combo_name: "10",
          cards: [p0Cards[0]!],
          points: 10,
          type: 1,
          phoenixValue: null,
        },
      } as unknown as Notif,
      // Bomb interrupt by P2 -> cancelled back to P1
      {
        type: "hasBomb",
        args: { player_id: P2 },
      } as unknown as Notif,
      {
        type: "gameStateChange",
        args: { id: 65, name: "playBomb", type: "activeplayer", active_player: String(P2) },
      } as unknown as Notif,
      {
        type: "gameStateChange",
        args: { id: 61, name: "playCombo", type: "activeplayer", active_player: String(P1) },
      } as unknown as Notif,
      // Zombie turn pass by P1
      {
        type: "log",
        args: { player_name: "Bob" },
      } as unknown as Notif,
      {
        type: "pass",
        args: { player_id: P1, player_name: "Bob" },
      } as unknown as Notif,
      // P2 plays 4-card bomb and wins trick
      {
        type: "gameStateChange",
        args: { id: 65, name: "playBomb", type: "activeplayer", active_player: String(P2) },
      } as unknown as Notif,
      {
        type: "playCombo",
        args: {
          player_id: P2,
          player_name: "Carol",
          combo_name: "Bomb of four Kings",
          cards: p2Cards.slice(0, 4),
          points: 40,
          type: 7,
          phoenixValue: null,
        },
      } as unknown as Notif,
      {
        type: "captureCards",
        args: { player_id: P2, player_name: "Carol", trick_value: 50 },
      } as unknown as Notif,
    ],
  });

  // Zombie playCombo by P0 + Double Victory (P0 and P2 go out 1st and 2nd on Team 0)
  packets.push({
    packet_id: String(pktId++),
    move_id: String(moveId++),
    channel: "/table/t1",
    data: [
      {
        type: "log",
        args: { player_name: "Alice" },
      } as unknown as Notif,
      {
        type: "playCombo",
        args: {
          player_id: P0,
          player_name: "Alice",
          combo_name: "Ace",
          cards: [p0Cards[1]!],
          points: 0,
          type: 1,
          phoenixValue: null,
        },
      } as unknown as Notif,
      {
        type: "playerGoOut",
        args: { firstout_id: P0, player_id: P0, player_name: "Alice" },
      } as unknown as Notif,
      {
        type: "playerGoOut",
        args: { firstout_id: P0, player_id: P2, player_name: "Carol" },
      } as unknown as Notif,
      {
        type: "tableWindow",
        args: { id: "finalScoring", title: "Result of this Round", table: [], closing: "ok" },
      } as unknown as Notif,
      {
        type: "roundScore",
        args: { round: 1, team0: 200, team1: 0 },
      } as unknown as Notif,
      {
        type: "newScores",
        args: {
          newScores: {
            [P0]: "200",
            [P1]: "0",
            [P2]: 200,
            [P3]: 0,
          },
        },
      } as unknown as Notif,
    ],
  });

  // Round 2: Full deal + pass + accept + trick + newScores
  const round2Setup = buildDealAndPassPackets(
    deck,
    [P0, P1, P2, P3],
    [0, 200, 0, 0],
    pktId,
    moveId,
  );
  packets.push(...round2Setup.packets);
  pktId = round2Setup.nextPacketId;
  moveId = round2Setup.nextMoveId;

  packets.push({
    packet_id: String(pktId++),
    move_id: String(moveId++),
    channel: "/table/t1",
    data: [
      {
        type: "playCombo",
        args: {
          player_id: P1,
          player_name: "Bob",
          combo_name: "King",
          cards: [p1Cards[0]!],
          points: 10,
          type: 1,
          phoenixValue: null,
        },
      } as unknown as Notif,
      {
        type: "captureCards",
        args: { player_id: P1, player_name: "Bob", trick_value: 100 },
      } as unknown as Notif,
      {
        type: "tableWindow",
        args: { id: "finalScoring", title: "Result of this Round", table: [], closing: "ok" },
      } as unknown as Notif,
      {
        type: "newScores",
        args: {
          newScores: {
            [P0]: "200",
            [P1]: "300",
            [P2]: "200",
            [P3]: "300",
          },
        },
      } as unknown as Notif,
    ],
  });

  const engine = new ReplayEngine(packets, players);
  const forwardStates = assertStreamInvariants(engine, "synthetic-bomb-zombie-double-victory");

  const board = engine.getScoreBoard();
  assert.equal(board.rounds.length, 2);
  // Round 1 Double Victory: Team 0 (P0, P2) +200, Team 1 (P1, P3) 0
  assert.deepEqual(board.rounds[0]!.scores, [
    { id: P0, roundPoints: 200, gamePoints: 200 },
    { id: P1, roundPoints: 0, gamePoints: 0 },
    { id: P2, roundPoints: 200, gamePoints: 200 },
    { id: P3, roundPoints: 0, gamePoints: 0 },
  ]);
  // Round 2: Team 0 +0 (200), Team 1 +300 (300)
  assert.deepEqual(board.rounds[1]!.scores, [
    { id: P0, roundPoints: 0, gamePoints: 200 },
    { id: P1, roundPoints: 300, gamePoints: 300 },
    { id: P2, roundPoints: 0, gamePoints: 200 },
    { id: P3, roundPoints: 300, gamePoints: 300 },
  ]);

  const finalState = forwardStates[forwardStates.length - 1]!;
  assert.equal(finalState.round, 3);
  assert.equal(finalState.players[0]!.gamePoints, 200);
  assert.equal(finalState.players[1]!.gamePoints, 300);
  assert.equal(finalState.players[2]!.gamePoints, 200);
  assert.equal(finalState.players[3]!.gamePoints, 300);
});

test("ReplayEngine: TEAM_1_2 seat permutation and TEAM_RANDOM shuffled seating align passing & scoreboard teams", () => {
  const deck = makeFullDeck();

  // TEAM_1_2: P0 (no=1, team 0) & P1 (no=3, team 0) are partners; P2 (no=2, team 1) & P3 (no=4, team 1) are partners.
  // Thus seat order by `no` is: [P0 (no=1), P2 (no=2), P1 (no=3), P3 (no=4)].
  const team12Players = makePlayers([1, 3, 2, 4]);
  const {
    packets: team12Packets,
    nextPacketId,
    nextMoveId,
  } = buildDealAndPassPackets(deck, [P0, P2, P1, P3], [200, 0, 0, 0]);
  team12Packets.push({
    packet_id: String(nextPacketId),
    move_id: String(nextMoveId),
    channel: "/table/t1",
    data: [
      {
        type: "newScores",
        args: {
          newScores: {
            [P0]: "260",
            [P1]: "260",
            [P2]: "40",
            [P3]: "40",
          },
        },
      } as unknown as Notif,
    ],
  });

  const engine12 = new ReplayEngine(team12Packets, team12Players);
  assert.deepEqual(
    engine12.model.getPlayerIds(),
    [P0, P2, P1, P3],
    "TEAM_1_2 must order players by player.no [1, 2, 3, 4] -> [P0, P2, P1, P3]",
  );
  // Check pass recipients for P0 (no=1): next is P2 (no=2), partner is P1 (no=3), previous is P3 (no=4)
  assert.equal(engine12.model.nextPlayerId(P0), P2);
  assert.equal(engine12.model.nextPlayerId(P2), P1);
  assert.equal(engine12.model.nextPlayerId(P1), P3);
  assert.equal(engine12.model.nextPlayerId(P3), P0);

  const forward12 = assertStreamInvariants(engine12, "TEAM_1_2");
  // At passCards completion (before acceptCards), verify P0 passed card[0] to previous (P3), card[1] to partner (P1), card[2] to next (P2)
  const passState12 = forward12.find(
    (s) => s.passedCards.length === 12 && !s.passedCards.some((c) => c.accepted),
  );
  assert.ok(passState12);
  const p0Passed = passState12.passedCards.filter((c) => c.from === P0);
  assert.equal(p0Passed.length, 3);
  assert.equal(p0Passed[0]!.to, P3, "P0 card 0 must go to previous player P3 (no=4)");
  assert.equal(p0Passed[1]!.to, P1, "P0 card 1 must go to partner P1 (no=3)");
  assert.equal(p0Passed[2]!.to, P2, "P0 card 2 must go to next player P2 (no=2)");

  const board12 = engine12.getScoreBoard();
  // TichuScoreBoard renders scores.slice(0, 2) as [Team 1 (no=1 & no=3), Team 2 (no=2 & no=4)]
  assert.equal(board12.rounds[0]!.scores[0]!.id, P0);
  assert.equal(board12.rounds[0]!.scores[0]!.gamePoints, 260);
  assert.equal(board12.rounds[0]!.scores[1]!.id, P2);
  assert.equal(board12.rounds[0]!.scores[1]!.gamePoints, 40);

  // TEAM_RANDOM: Shuffled seat assignment [no=4 (P0), no=2 (P1), no=1 (P2), no=3 (P3)]
  // Seat order by `no` is [P2 (no=1), P1 (no=2), P3 (no=3), P0 (no=4)].
  // Team 0 is P2 & P3; Team 1 is P1 & P0.
  const teamRandomPlayers = makePlayers([4, 2, 1, 3]);
  const {
    packets: randomPackets,
    nextPacketId: randPktId,
    nextMoveId: randMoveId,
  } = buildDealAndPassPackets(deck, [P2, P1, P3, P0], [0, 0, "200", 0]);
  randomPackets.push({
    packet_id: String(randPktId),
    move_id: String(randMoveId),
    channel: "/table/t1",
    data: [
      {
        type: "newScores",
        args: {
          newScores: {
            [P2]: "310",
            [P3]: "310",
            [P1]: "-10",
            [P0]: "-10",
          },
        },
      } as unknown as Notif,
    ],
  });

  const engineRandom = new ReplayEngine({ data: { data: randomPackets } }, teamRandomPlayers);
  assert.deepEqual(
    engineRandom.model.getPlayerIds(),
    [P2, P1, P3, P0],
    "TEAM_RANDOM must order players by player.no [1, 2, 3, 4] -> [P2, P1, P3, P0]",
  );
  assertStreamInvariants(engineRandom, "TEAM_RANDOM");

  const boardRandom = engineRandom.getScoreBoard();
  assert.equal(boardRandom.rounds[0]!.scores[0]!.id, P2);
  assert.equal(boardRandom.rounds[0]!.scores[0]!.gamePoints, 310);
  assert.equal(boardRandom.rounds[0]!.scores[1]!.id, P1);
  assert.equal(boardRandom.rounds[0]!.scores[1]!.gamePoints, -10);
});

test("ReplayEngine: tidyUpGamelogs, segmentNotifMoves, createScoreBoard, and isIgnoredReplayNotif edge cases", () => {
  const ignoredTypes = [
    "autopass",
    "botSuggestion",
    "confirmTichu",
    "devConsole",
    "hasBomb",
    "log",
    "playerGoOut",
    "roundScore",
    "simpleNode",
    "tableWindow",
    "updateReflexionTime",
    "wakeupPlayers",
    "gameStateChangePrivateArg",
  ];
  for (const ignoredType of ignoredTypes) {
    assert.equal(
      isIgnoredReplayNotif({ type: ignoredType, args: {} } as unknown as Notif),
      true,
      `Expected ${ignoredType} to be ignored`,
    );
  }
  for (const stType of ["game", "manager", "multipleactiveplayer"]) {
    assert.equal(
      isIgnoredReplayNotif({
        type: "gameStateChange",
        args: { type: stType },
      } as unknown as Notif),
      true,
      `Expected gameStateChange (${stType}) to be ignored`,
    );
  }
  assert.equal(
    isIgnoredReplayNotif({
      type: "gameStateChange",
      args: { type: "activeplayer", active_player: String(P0) },
    } as unknown as Notif),
    false,
    "gameStateChange (activeplayer) must NOT be ignored",
  );

  // Verify unknown notification sets ignoredNotifType
  const players = makePlayers([1, 2, 3, 4]);
  const unknownEngine = new ReplayEngine(
    [
      {
        packet_id: "1",
        move_id: "1",
        channel: "/table/t1",
        data: [{ type: "futureUnknownEvent", args: {} } as unknown as Notif],
      },
    ],
    players,
  );
  assert.equal(unknownEngine.stepForward(), true);
  assert.equal(unknownEngine.getIgnoredNotifType(), "futureUnknownEvent");

  // Verify tidyUpGamelogs splits joined passCards packet and swaps public /table before private /player
  const rawPackets: NotifsPacket[] = [
    {
      packet_id: "1",
      move_id: "10",
      channel: `/player/p${P0}`,
      data: [{ type: "acceptCards", args: {} } as unknown as Notif],
    },
    {
      packet_id: "2",
      move_id: "10",
      channel: "/table/t1",
      data: [
        {
          type: "gameStateChange",
          args: { type: "activeplayer", active_player: String(P0) },
        } as unknown as Notif,
      ],
    },
    {
      packet_id: "3",
      move_id: "11",
      channel: `/player/p${P1}`,
      data: [
        { type: "passCards", args: { cardIds: ["1", "2", "3"] } } as unknown as Notif,
        { type: "acceptCards", args: {} } as unknown as Notif,
      ],
    },
  ];
  tidyUpGamelogs(rawPackets);
  assert.equal(rawPackets.length, 4);
  assert.equal(
    rawPackets[0]!.channel,
    "/table/t1",
    "Public packet should swap before private acceptCards",
  );
  assert.equal(rawPackets[2]!.data[0]!.type, "passCards", "Joined passCards should split first");
  assert.equal(rawPackets[3]!.data[0]!.type, "acceptCards");

  // Verify segmentNotifMoves groups mahjongWishGranted + tichuBet + playCombo for the same player
  const segNotifs = [
    { type: "acceptCards", args: {}, player_id: P0, move_id: "1" },
    { type: "acceptCards", args: {}, player_id: P1, move_id: "1" },
    { type: "acceptCards", args: {}, player_id: P2, move_id: "1" },
    { type: "acceptCards", args: {}, player_id: P3, move_id: "1" },
    { type: "mahjongWishGranted", args: {}, player_id: 0, move_id: "2" },
    { type: "tichuBet", args: { player_id: P1, bet: 0 }, player_id: 0, move_id: "2" },
    {
      type: "playCombo",
      args: { player_id: P1, cards: [], points: 0 },
      player_id: 0,
      move_id: "2",
    },
  ] as any;
  segmentNotifMoves(segNotifs);
  assert.equal(segNotifs[4].move_id, segNotifs[5].move_id);
  assert.equal(segNotifs[5].move_id, segNotifs[6].move_id);

  // Verify createScoreBoard handles malformed/empty values gracefully
  const sb = createScoreBoard(
    [
      {
        type: "newScores",
        args: { newScores: { [P0]: "120", [P1]: "not-a-number" } },
      } as unknown as Notif,
    ],
    [P0, P1, P2, P3],
  );
  assert.deepEqual(sb.rounds[0]!.scores, [
    { id: P0, roundPoints: 120, gamePoints: 120 },
    { id: P1, roundPoints: 0, gamePoints: 0 },
    { id: P2, roundPoints: 0, gamePoints: 0 },
    { id: P3, roundPoints: 0, gamePoints: 0 },
  ]);

  // Verify createScoreBoard records reconstruct legacy rounds (Double Victory, bets, and custom team grouping)
  const customTeamPlayers = [
    { id: P0, no: 1, team: 0 },
    { id: P1, no: 2, team: 0 },
    { id: P2, no: 3, team: 1 },
    { id: P3, no: 4, team: 1 },
  ];
  const sbDetailed = createScoreBoard(
    [
      // Round 1: legacy stream without embedded roundScore — P0 GT won, P2 T lost, Team 0 Double Victory
      { type: "grandTichuBet", args: { player_id: P0, bet: 200 } } as unknown as Notif,
      { type: "tichuBet", args: { player_id: P2, bet: 100 } } as unknown as Notif,
      { type: "playerGoOut", args: { firstout_id: P0, player_id: P0 } } as unknown as Notif,
      {
        type: "newScores",
        args: { newScores: { [P0]: 400, [P1]: 400, [P2]: -100, [P3]: -100 } },
      } as unknown as Notif,
      // Round 2: modern stream with explicit roundScore payload
      {
        type: "newScores",
        args: {
          newScores: { [P0]: 465, [P1]: 465, [P2]: -65, [P3]: -65 },
          roundScore: {
            round: 2,
            cardPoints: [65, 35],
            doubleVictory: -1,
            bets: {},
            teamPoints: [65, 35],
            teamTotals: [465, -65],
          },
        },
      } as unknown as Notif,
    ],
    [P0, P1, P2, P3],
    customTeamPlayers,
  );
  assert.equal(sbDetailed.records?.length, 2);
  assert.deepEqual(sbDetailed.records![0], {
    round: 1,
    cardPoints: [0, 0],
    doubleVictory: 0,
    bets: {
      [String(P0)]: { type: "GT", won: true, delta: 200 },
      [String(P2)]: { type: "T", won: false, delta: -100 },
    },
    teamPoints: [400, -100],
    teamTotals: [400, -100],
  });
  assert.deepEqual(sbDetailed.records![1], {
    round: 2,
    cardPoints: [65, 35],
    doubleVictory: -1,
    bets: {},
    teamPoints: [65, 35],
    teamTotals: [465, -65],
  });
});

test("ReplayEngine: unpassCards after passCards & Tichu reopen preserves 56-card conservation and scrubbing", () => {
  const deck = makeFullDeck();
  const players = makePlayers([1, 2, 3, 4]);
  const playerOrder: [number, number, number, number] = [P0, P1, P2, P3];
  const packets: NotifsPacket[] = [];
  let pktId = 1;
  let moveId = 1;

  // Deal first 8 cards
  for (let pIdx = 0; pIdx < 4; pIdx++) {
    const pid = playerOrder[pIdx]!;
    const cards = deck.slice(pIdx * 14, pIdx * 14 + 8).map((c) => ({
      ...c,
      location: "hand",
      location_arg: String(pid),
    }));
    packets.push({
      packet_id: String(pktId++),
      move_id: String(moveId),
      channel: `/player/p${pid}`,
      data: [{ type: "dealCards", args: { cards } } as unknown as Notif],
    });
  }

  // Grand Tichu bets = 0
  for (const pid of playerOrder) {
    moveId++;
    packets.push({
      packet_id: String(pktId++),
      move_id: String(moveId),
      channel: "/table/t1",
      data: [
        {
          type: "grandTichuBet",
          args: { player_id: pid, player_name: `P${pid}`, bet: 0 },
        } as unknown as Notif,
      ],
    });
  }

  // Deal last 6 cards
  moveId++;
  for (let pIdx = 0; pIdx < 4; pIdx++) {
    const pid = playerOrder[pIdx]!;
    const cards = deck.slice(pIdx * 14 + 8, pIdx * 14 + 14).map((c) => ({
      ...c,
      location: "hand",
      location_arg: String(pid),
    }));
    packets.push({
      packet_id: String(pktId++),
      move_id: String(moveId),
      channel: `/player/p${pid}`,
      data: [{ type: "dealCards", args: { cards } } as unknown as Notif],
    });
  }

  // P0 and P1 pass their first 3 cards
  for (let pIdx = 0; pIdx < 2; pIdx++) {
    const pid = playerOrder[pIdx]!;
    const c0 = deck[pIdx * 14]!;
    const c1 = deck[pIdx * 14 + 1]!;
    const c2 = deck[pIdx * 14 + 2]!;
    moveId++;
    packets.push({
      packet_id: String(pktId++),
      move_id: String(moveId),
      channel: `/player/p${pid}`,
      data: [
        {
          type: "passCards",
          args: {
            cardIds: [c0.id, c1.id, c2.id],
            card1: c0.type_arg,
            card2: c1.type_arg,
            card3: c2.type_arg,
          },
        } as unknown as Notif,
      ],
    });
  }

  // P2 calls Tichu during giveCards -> P0 & P1 receive unpassCards
  const reopenMoveId = String(++moveId);
  for (let pIdx = 0; pIdx < 2; pIdx++) {
    const pid = playerOrder[pIdx]!;
    const c0 = deck[pIdx * 14]!;
    const c1 = deck[pIdx * 14 + 1]!;
    const c2 = deck[pIdx * 14 + 2]!;
    packets.push({
      packet_id: String(pktId++),
      move_id: reopenMoveId,
      channel: `/player/p${pid}`,
      data: [
        {
          type: "unpassCards",
          args: {
            cardIds: [c0.id, c1.id, c2.id],
            cards: [c0, c1, c2],
            reopenedByTichu: true,
            callerId: P2,
            callerName: "Carol",
          },
        } as unknown as Notif,
      ],
    });
  }
  packets.push({
    packet_id: String(pktId++),
    move_id: reopenMoveId,
    channel: "/table/t1",
    data: [
      {
        type: "tichuBet",
        args: { player_id: P2, player_name: "Carol", bet: 100 },
      } as unknown as Notif,
      {
        type: "gameStateMultipleActiveUpdate",
        args: [String(P0), String(P1), String(P2), String(P3)],
      } as unknown as Notif,
    ],
  });

  // P0 passes again, manually retracts via unpassCards, then all 4 pass final cards
  const p0Alt = [deck[3]!, deck[4]!, deck[5]!];
  packets.push(
    {
      packet_id: String(pktId++),
      move_id: String(++moveId),
      channel: `/player/p${P0}`,
      data: [
        {
          type: "passCards",
          args: {
            cardIds: p0Alt.map((c) => c.id),
            card1: p0Alt[0]!.type_arg,
            card2: p0Alt[1]!.type_arg,
            card3: p0Alt[2]!.type_arg,
          },
        } as unknown as Notif,
      ],
    },
    {
      packet_id: String(pktId++),
      move_id: String(++moveId),
      channel: `/player/p${P0}`,
      data: [
        {
          type: "unpassCards",
          args: {
            cardIds: p0Alt.map((c) => c.id),
            cards: p0Alt,
            reopenedByTichu: false,
          },
        } as unknown as Notif,
      ],
    },
  );

  for (let pIdx = 0; pIdx < 4; pIdx++) {
    const pid = playerOrder[pIdx]!;
    const c0 = deck[pIdx * 14 + 3]!;
    const c1 = deck[pIdx * 14 + 4]!;
    const c2 = deck[pIdx * 14 + 5]!;
    packets.push({
      packet_id: String(pktId++),
      move_id: String(++moveId),
      channel: `/player/p${pid}`,
      data: [
        {
          type: "passCards",
          args: {
            cardIds: [c0.id, c1.id, c2.id],
            card1: c0.type_arg,
            card2: c1.type_arg,
            card3: c2.type_arg,
          },
        } as unknown as Notif,
      ],
    });
  }

  moveId++;
  for (const pid of playerOrder) {
    packets.push({
      packet_id: String(pktId++),
      move_id: String(moveId),
      channel: `/player/p${pid}`,
      data: [
        {
          type: "acceptCards",
          args: { cards: [], card1: "2", card2: "3", card3: "4" },
        } as unknown as Notif,
      ],
    });
  }

  packets.push(
    {
      packet_id: String(pktId++),
      move_id: String(++moveId),
      channel: "/table/t1",
      data: [
        {
          type: "gameStateChange",
          args: { type: "activeplayer", active_player: String(P0) },
        } as unknown as Notif,
      ],
    },
    {
      packet_id: String(pktId++),
      move_id: String(++moveId),
      channel: "/table/t1",
      data: [
        {
          type: "newScores",
          args: { newScores: { [P0]: 100, [P1]: 0, [P2]: 100, [P3]: 0 } },
        } as unknown as Notif,
      ],
    },
  );

  const engine = new ReplayEngine(packets, players);
  const forwardStates = assertStreamInvariants(engine, "unpass-reopen");
  const N = engine.getNotifs().length;
  engine.nextRound();
  const stopIdx = engine.getNotifIndex();
  assert.equal(
    engine.getState().passedCards.length,
    12,
    "nextRound should stop at final 12 passed cards",
  );
  assert.equal(
    engine.getState().passedCards.some((pc) => pc.accepted),
    false,
  );
  assert.equal(deepEqual(engine.getState(), forwardStates[stopIdx]), true);
  engine.nextRound();
  assert.equal(engine.getNotifIndex(), N);
  engine.prevRound();
  assert.equal(engine.getNotifIndex(), stopIdx);
});
