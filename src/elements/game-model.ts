import { BehaviorSubject, Observable } from "rxjs";
import type { Card, CardData, TichuGamedatas } from "../types/tichu-contracts";
import { select } from "./utils";

export type { Card, CardData };

export type GrandTichuBetValue = -1 | 0 | 100 | 200;
export type TichuBetValue = -1 | 0 | 100;

export interface LivePlayer {
  id: string;
  name: string;
  color: string;
  no: number;
  score: number;
  callGrandTichu: GrandTichuBetValue;
  callTichu: TichuBetValue;
  autopass: boolean;
  /** Raw numeric pass mode from backend: 0 = none, 1 = once, 2 = trick */
  pass: number;
  handcount: number;
  capturedPoints: number;
  passedCardReady: boolean;
}

export interface PassSlotState {
  dir: 1 | 2 | 3;
  playerId: string;
  givenCard: Card | null;
  receivedCard: Card | null;
  animatingAccept: boolean;
}

export interface LastComboState {
  cards: Card[];
  description: string;
  passed: boolean;
  type?: number;
  phoenixValue?: number | number[] | null;
}

export interface TrickLastComboState {
  playerId: string;
  type: number;
  cards: Card[];
  phoenixValue: number | number[] | null;
  description: string;
}

export interface BetAnimation {
  id: number;
  playerId: string;
  bet: number;
  fadingOut: boolean;
}

export interface LiveGamePrefs {
  squareTable?: boolean;
  clockwise?: boolean;
  confirmPassWithSelection?: boolean;
  isTiki?: boolean;
  theme?: number;
  handSortOrder?: "rank" | "color";
  [prefId: number]: number | undefined;
}

export interface LiveGameState {
  currentPlayerId: string;
  isSpectator: boolean;
  isRealtime: boolean;
  isAllInfoExposed: boolean;
  players: Record<string, LivePlayer>;
  playerOrderBottomToLeft: string[];
  passSlots: PassSlotState[];
  acceptingCardsCountdown: boolean;
  collectingTrickCountdown: boolean;
  hand: Card[];
  selectedCardIds: string[];
  handSortOrder: "rank" | "color";
  stateName: string;
  activePlayerId: string;
  activePlayerIds: string[];
  isCurrentPlayerActive: boolean;
  bombActivePlayerId: string | null;
  round: number;
  trick: number;
  currentTrick: Card[];
  currentTrickValue: number;
  capturedCards: Card[];
  firstOutPlayerId: string;
  lastComboPlayerId: string;
  lastCombos: Record<string, LastComboState>;
  trickLastCombo: TrickLastComboState;
  mahjongWish: number;
  selectedMahjongWish: number | null;
  phoenixAllowedValues: number[];
  selectedPhoenixValue: number | null;
  clockwise: boolean;
  squareTable: boolean;
  confirmPassWithSelection: boolean;
  theme: number;
  isTiki: boolean;
  experimentalReplayOpen: boolean;
  trickModalOpen: boolean;
  betAnimations: BetAnimation[];
}

function getStoredHandSortOrder(): "rank" | "color" {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("tichu_hand_sort_order");
      if (raw === "color" || raw === "rank") return raw;
    }
  } catch (_e) {
    // ignore storage errors
  }
  return "rank";
}

export const initialLiveGameState: LiveGameState = {
  currentPlayerId: "",
  isSpectator: false,
  isRealtime: false,
  isAllInfoExposed: false,
  players: {},
  playerOrderBottomToLeft: [],
  passSlots: [],
  acceptingCardsCountdown: false,
  collectingTrickCountdown: false,
  hand: [],
  selectedCardIds: [],
  handSortOrder: getStoredHandSortOrder(),
  stateName: "",
  activePlayerId: "",
  activePlayerIds: [],
  isCurrentPlayerActive: false,
  bombActivePlayerId: null,
  round: 0,
  trick: 0,
  currentTrick: [],
  currentTrickValue: 0,
  capturedCards: [],
  firstOutPlayerId: "",
  lastComboPlayerId: "",
  lastCombos: {},
  trickLastCombo: {
    playerId: "",
    type: 99,
    cards: [],
    phoenixValue: null,
    description: "",
  },
  mahjongWish: 0,
  selectedMahjongWish: null,
  phoenixAllowedValues: [],
  selectedPhoenixValue: null,
  clockwise: true,
  squareTable: false,
  confirmPassWithSelection: true,
  theme: 0,
  isTiki: false,
  experimentalReplayOpen: false,
  trickModalOpen: false,
  betAnimations: [],
};

function normalizeCard(raw: any): Card {
  const card: Card = {
    id: String(raw?.id ?? ""),
    type: String(raw?.type ?? ""),
    type_arg: String(raw?.type_arg ?? ""),
  };
  if (raw?.location !== undefined) card.location = String(raw.location);
  if (raw?.location_arg !== undefined) card.location_arg = String(raw.location_arg);
  const passedFrom = raw?.passed_from ?? raw?.card_passed_from;
  if (passedFrom !== undefined) card.passed_from = String(passedFrom);
  return card;
}

function normalizeCards(rawCards: any): Card[] {
  if (!Array.isArray(rawCards)) return [];
  return rawCards.map(normalizeCard);
}

function normalizeGrandTichuBet(val: any): GrandTichuBetValue {
  if (val === null || val === undefined || val === "") return -1;
  const n = Number(val);
  if (n === 0 || n === 100 || n === 200) return n;
  return -1;
}

function normalizeTichuBet(val: any): TichuBetValue {
  if (val === null || val === undefined || val === "") return -1;
  const n = Number(val);
  if (n === 0 || n === 100) return n;
  return -1;
}

/**
 * Replicates PHP's `PlayerManager::getNextPlayers(null, true)` exactly:
 * Sorts players by `no` DESC, then rotates until `players[3].id === currentPlayerId`
 * (or until `players[0].id === lastId` for spectators).
 */
export function getNextPlayersDesc(
  playersMap: Record<string, LivePlayer>,
  currentPlayerId: string,
): LivePlayer[] {
  const players = Object.values(playersMap).sort((a, b) => b.no - a.no);
  if (players.length < 4) return players;
  const lastId = players[3]!.id;
  while (players[3]!.id !== currentPlayerId && players[0]!.id !== lastId) {
    players.push(players.shift()!);
  }
  return players;
}

export class GameModel {
  private readonly subject$ = new BehaviorSubject<LiveGameState>(initialLiveGameState);
  private nextBetAnimId = 1;

  public readonly state$: Observable<LiveGameState> = this.subject$.asObservable();

  // Selectors for every slice of state
  public readonly currentPlayerId$ = select(this.state$, (s) => s.currentPlayerId);
  public readonly isSpectator$ = select(this.state$, (s) => s.isSpectator);
  public readonly isRealtime$ = select(this.state$, (s) => s.isRealtime);
  public readonly isAllInfoExposed$ = select(this.state$, (s) => s.isAllInfoExposed);
  public readonly players$ = select(this.state$, (s) => s.players);
  public readonly currentPlayer$ = select(this.state$, (s) => s.players[s.currentPlayerId] ?? null);
  public readonly player$ = (playerId: string | number) =>
    select(this.state$, (s) => s.players[String(playerId)]);
  public readonly playerOrderBottomToLeft$ = select(this.state$, (s) => s.playerOrderBottomToLeft);
  public readonly passSlots$ = select(this.state$, (s) => s.passSlots);
  public readonly acceptingCardsCountdown$ = select(this.state$, (s) => s.acceptingCardsCountdown);
  public readonly collectingTrickCountdown$ = select(
    this.state$,
    (s) => s.collectingTrickCountdown,
  );
  public readonly hand$ = select(this.state$, (s) => s.hand);
  public readonly selectedCardIds$ = select(this.state$, (s) => s.selectedCardIds);
  public readonly handSortOrder$ = select(this.state$, (s) => s.handSortOrder);
  public readonly stateName$ = select(this.state$, (s) => s.stateName);
  public readonly activePlayerId$ = select(this.state$, (s) => s.activePlayerId);
  public readonly activePlayerIds$ = select(this.state$, (s) => s.activePlayerIds);
  public readonly isCurrentPlayerActive$ = select(this.state$, (s) => s.isCurrentPlayerActive);
  public readonly bombActivePlayerId$ = select(this.state$, (s) => s.bombActivePlayerId);
  public readonly round$ = select(this.state$, (s) => s.round);
  public readonly trick$ = select(this.state$, (s) => s.trick);
  public readonly currentTrick$ = select(this.state$, (s) => s.currentTrick);
  public readonly currentTrickValue$ = select(this.state$, (s) => s.currentTrickValue);
  public readonly capturedCards$ = select(this.state$, (s) => s.capturedCards);
  public readonly firstOutPlayerId$ = select(this.state$, (s) => s.firstOutPlayerId);
  public readonly lastComboPlayerId$ = select(this.state$, (s) => s.lastComboPlayerId);
  public readonly lastCombos$ = select(this.state$, (s) => s.lastCombos);
  public readonly trickLastCombo$ = select(this.state$, (s) => s.trickLastCombo);
  public readonly lastCombo$ = (playerId: string | number) =>
    select(
      this.state$,
      (s) =>
        s.lastCombos[String(playerId)] ?? {
          cards: [],
          description: "",
          passed: false,
        },
    );
  public readonly mahjongWish$ = select(this.state$, (s) => s.mahjongWish);
  public readonly selectedMahjongWish$ = select(this.state$, (s) => s.selectedMahjongWish);
  public readonly phoenixAllowedValues$ = select(this.state$, (s) => s.phoenixAllowedValues);
  public readonly selectedPhoenixValue$ = select(this.state$, (s) => s.selectedPhoenixValue);
  public readonly clockwise$ = select(this.state$, (s) => s.clockwise);
  public readonly squareTable$ = select(this.state$, (s) => s.squareTable);
  public readonly confirmPassWithSelection$ = select(
    this.state$,
    (s) => s.confirmPassWithSelection,
  );
  public readonly theme$ = select(this.state$, (s) => s.theme);
  public readonly isTiki$ = select(this.state$, (s) => s.isTiki);
  public readonly experimentalReplayOpen$ = select(this.state$, (s) => s.experimentalReplayOpen);
  public readonly trickModalOpen$ = select(this.state$, (s) => s.trickModalOpen);
  public readonly betAnimations$ = select(this.state$, (s) => s.betAnimations);

  getState(): LiveGameState {
    return this.subject$.getValue();
  }

  setState(state: LiveGameState): void {
    this.subject$.next(state);
  }

  update(
    partialOrUpdater:
      Partial<LiveGameState> | ((prev: LiveGameState) => Partial<LiveGameState> | LiveGameState),
  ): void {
    const prev = this.getState();
    const patch =
      typeof partialOrUpdater === "function" ? partialOrUpdater(prev) : partialOrUpdater;
    this.subject$.next({ ...prev, ...patch });
  }

  updateState(partial: Partial<LiveGameState>): void {
    this.update(partial);
  }

  updatePlayer(
    playerId: string | number,
    partialOrUpdater: Partial<LivePlayer> | ((prev: LivePlayer) => Partial<LivePlayer>),
  ): void {
    const id = String(playerId);
    const prev = this.getState();
    const existing = prev.players[id];
    if (!existing) return;
    const patch =
      typeof partialOrUpdater === "function" ? partialOrUpdater(existing) : partialOrUpdater;
    this.update({
      players: {
        ...prev.players,
        [id]: { ...existing, ...patch },
      },
    });
  }

  hydrateFromGamedatas(
    gamedatas: Partial<TichuGamedatas> & Record<string, any>,
    currentPlayerId: string | number,
    isSpectator: boolean,
    isRealtime: boolean,
    prefs?: LiveGamePrefs,
  ): void {
    const currentId = String(currentPlayerId ?? "");
    const rawPlayers = gamedatas?.players ?? {};
    const handCounts = gamedatas?.handcount ?? gamedatas?.handCount ?? {};
    const capturedPointsMap = gamedatas?.capturedpoints ?? gamedatas?.capturedPoints ?? {};

    let allLastCombos = gamedatas?.allLastCombos ?? gamedatas?.combos ?? {};
    if (Array.isArray(allLastCombos)) {
      const combosMap: Record<string, any> = {};
      for (const item of allLastCombos) {
        const p = String(item?.player ?? item?.playerId ?? item?.player_id ?? "");
        if (p) combosMap[p] = item;
      }
      allLastCombos = combosMap;
    }

    const rawPasses: Array<string | number> = Array.isArray(gamedatas?.passes)
      ? gamedatas.passes
      : [];
    const passedSet = new Set(rawPasses.map((p) => String(p)));

    const players: Record<string, LivePlayer> = {};
    const lastCombos: Record<string, LastComboState> = {};

    for (const key of Object.keys(rawPlayers)) {
      const p = rawPlayers[key];
      const pid = String(p?.id ?? key);
      const combo = allLastCombos[pid] ?? allLastCombos[Number(pid)];
      const comboCards = combo?.cards ? normalizeCards(combo.cards) : [];
      const comboType = Number(combo?.type);
      const isNoCombo = comboType === 99; // NO_COMBO = 99
      const isPassCombo = comboType === 0; // PASS_COMBO = 0
      const hasComboCards = !isNoCombo && !isPassCombo && comboCards.length > 0;
      const hasPassed = !hasComboCards && (isPassCombo || passedSet.has(pid));

      const rawPass = Number(p?.pass ?? 0);
      const safePass = Number.isNaN(rawPass) ? 0 : rawPass;

      players[pid] = {
        id: pid,
        name: String(p?.name ?? p?.player_name ?? ""),
        color: String(p?.color ?? p?.player_color ?? "000000"),
        no: Number(p?.no ?? p?.player_no ?? 0),
        score: Number(p?.score ?? p?.player_score ?? 0),
        callGrandTichu: normalizeGrandTichuBet(p?.call_grand_tichu),
        callTichu: normalizeTichuBet(p?.call_tichu),
        autopass: safePass > 0,
        pass: safePass,
        handcount: Number(handCounts[pid] ?? handCounts[Number(pid)] ?? 0),
        capturedPoints: Number(capturedPointsMap[pid] ?? capturedPointsMap[Number(pid)] ?? 0),
        passedCardReady: hasPassed,
      };

      if (hasComboCards) {
        lastCombos[pid] = {
          cards: comboCards,
          description: String(combo?.description ?? ""),
          passed: false,
          type: Number.isNaN(comboType) ? 0 : comboType,
          phoenixValue: combo?.phoenixValue ?? null,
        };
      } else if (hasPassed) {
        lastCombos[pid] = {
          cards: [],
          description: "Pass",
          passed: true,
          type: 0,
          phoenixValue: null,
        };
      } else {
        lastCombos[pid] = {
          cards: [],
          description: "",
          passed: false,
          type: 99,
          phoenixValue: null,
        };
      }
    }

    const gamestate = gamedatas?.gamestate;
    const rawPassed = gamedatas?.passedCards ?? gamestate?.args?._private;
    const receivedCards = Array.isArray(rawPassed) ? normalizeCards(rawPassed) : [];

    // Replicate PlayerManager::getNextPlayers(null, true) and tichu.view.php
    const playersDesc = getNextPlayersDesc(players, currentId);
    const passSlots: PassSlotState[] = playersDesc.slice(0, 3).map((p, idx) => {
      const received =
        receivedCards.find((c) => String(c.passed_from) === p.id) ??
        (receivedCards[idx] && String(receivedCards[idx]?.passed_from) === p.id
          ? receivedCards[idx]
          : null);
      return {
        dir: (idx + 1) as 1 | 2 | 3,
        playerId: p.id,
        givenCard: null,
        receivedCard: received ?? null,
        animatingAccept: false,
      };
    });
    const playerOrderBottomToLeft = [...playersDesc].reverse().map((p) => p.id);

    const rawFirstOut =
      gamedatas?.firstoutplayer ?? gamedatas?.first_out_player ?? gamedatas?.first_out;
    const firstOutPlayerId = rawFirstOut && String(rawFirstOut) !== "0" ? String(rawFirstOut) : "";

    const rawLastComboPlayer =
      gamedatas?.lastCombo?.player ?? gamedatas?.lastComboPlayer ?? gamedatas?.last_combo_player;
    const lastComboPlayerId =
      rawLastComboPlayer && String(rawLastComboPlayer) !== "0" ? String(rawLastComboPlayer) : "";

    const rawStructuredLast = gamedatas?.lastCombo;
    const fallbackCombo = lastComboPlayerId ? lastCombos[lastComboPlayerId] : undefined;
    const trickLastComboCards = Array.isArray(rawStructuredLast?.cards)
      ? normalizeCards(rawStructuredLast.cards)
      : fallbackCombo?.cards
        ? [...fallbackCombo.cards]
        : [];
    const trickLastComboType =
      rawStructuredLast?.type !== undefined
        ? Number(rawStructuredLast.type)
        : fallbackCombo?.type !== undefined
          ? Number(fallbackCombo.type)
          : trickLastComboCards.length > 0
            ? 0
            : 99;
    const trickLastCombo: TrickLastComboState = {
      playerId: lastComboPlayerId,
      type: Number.isNaN(trickLastComboType) ? 99 : trickLastComboType,
      cards: trickLastComboCards,
      phoenixValue:
        rawStructuredLast?.phoenixValue !== undefined
          ? rawStructuredLast.phoenixValue
          : (fallbackCombo?.phoenixValue ?? null),
      description: String(
        rawStructuredLast?.description ??
          gamedatas?.lastComboDescription ??
          fallbackCombo?.description ??
          "",
      ),
    };

    const rawWish = Number(gamedatas?.mahjongWish ?? gamedatas?.mahjong_wish ?? 0);
    const mahjongWish = rawWish > 0 && rawWish < 15 ? rawWish : 0;

    // Resolve user preferences from either named fields or BGA numeric IDs (100..104)
    const squareTable =
      prefs?.squareTable !== undefined ? Boolean(prefs.squareTable) : Number(prefs?.[100]) === 2;
    const clockwise =
      prefs?.clockwise !== undefined ? Boolean(prefs.clockwise) : Number(prefs?.[101] ?? 1) === 2;
    const confirmPassWithSelection =
      prefs?.confirmPassWithSelection !== undefined
        ? Boolean(prefs.confirmPassWithSelection)
        : Number(prefs?.[102] ?? 1) !== 2;
    const isTiki = prefs?.isTiki !== undefined ? Boolean(prefs.isTiki) : Number(prefs?.[103]) === 1;
    const rawTheme =
      prefs?.theme !== undefined
        ? Number(prefs.theme)
        : prefs?.[104] !== undefined
          ? Number(prefs[104])
          : 0;
    const theme = !Number.isNaN(rawTheme) && rawTheme >= 0 && rawTheme <= 10 ? rawTheme : 0;
    const storedSortOrder = getStoredHandSortOrder();
    const handSortOrder: "rank" | "color" =
      prefs?.handSortOrder === "color" || prefs?.handSortOrder === "rank"
        ? prefs.handSortOrder
        : storedSortOrder;

    const stateName = String(gamestate?.name ?? "");
    const activePlayerId = gamestate?.active_player ? String(gamestate.active_player) : "";
    const activePlayerIds = Array.isArray(gamestate?.multiactive)
      ? gamestate.multiactive.map((id: any) => String(id))
      : activePlayerId
        ? [activePlayerId]
        : [];
    const isCurrentPlayerActive =
      !isSpectator && (activePlayerId === currentId || activePlayerIds.includes(currentId));

    this.setState({
      currentPlayerId: currentId,
      isSpectator: Boolean(isSpectator),
      isRealtime: Boolean(isRealtime),
      isAllInfoExposed: Number(gamedatas?.isAllInfoExposed ?? gamedatas?.is_all_info_exposed) === 1,
      players,
      playerOrderBottomToLeft,
      passSlots,
      acceptingCardsCountdown: false,
      collectingTrickCountdown: false,
      hand: normalizeCards(gamedatas?.hand),
      selectedCardIds: [],
      handSortOrder,
      stateName,
      activePlayerId,
      activePlayerIds,
      isCurrentPlayerActive,
      bombActivePlayerId: null,
      round: Number(gamedatas?.round ?? 0),
      trick: Number(gamedatas?.trick ?? 0),
      currentTrick: normalizeCards(gamedatas?.currentTrick),
      currentTrickValue: Number(
        gamedatas?.currentTrickValue ?? gamedatas?.current_trick_value ?? 0,
      ),
      capturedCards: normalizeCards(gamedatas?.capturedCards),
      firstOutPlayerId,
      lastComboPlayerId,
      lastCombos,
      trickLastCombo,
      mahjongWish,
      selectedMahjongWish: null,
      phoenixAllowedValues: [],
      selectedPhoenixValue: null,
      clockwise,
      squareTable,
      confirmPassWithSelection,
      theme,
      isTiki,
      experimentalReplayOpen: false,
      trickModalOpen: false,
      betAnimations: [],
    });
  }

  // State machine transition helpers
  setGameState(
    stateName: string,
    opts?: {
      activePlayerId?: string | number | null;
      activePlayerIds?: Array<string | number>;
      isCurrentPlayerActive?: boolean;
      bombActivePlayerId?: string | number | null;
    },
  ): void {
    const prev = this.getState();
    const activePlayerId =
      opts?.activePlayerId !== undefined
        ? opts.activePlayerId
          ? String(opts.activePlayerId)
          : ""
        : prev.activePlayerId;
    const activePlayerIds =
      opts?.activePlayerIds !== undefined
        ? opts.activePlayerIds.map((id) => String(id))
        : prev.activePlayerIds;
    const isCurrentPlayerActive =
      opts?.isCurrentPlayerActive !== undefined
        ? opts.isCurrentPlayerActive
        : prev.isCurrentPlayerActive;
    const bombActivePlayerId =
      opts?.bombActivePlayerId !== undefined
        ? opts.bombActivePlayerId
          ? String(opts.bombActivePlayerId)
          : null
        : stateName === "playBomb"
          ? prev.bombActivePlayerId
          : null;

    this.update({
      stateName,
      activePlayerId,
      activePlayerIds,
      isCurrentPlayerActive,
      bombActivePlayerId,
      acceptingCardsCountdown:
        stateName === "showPassedCards" ? prev.acceptingCardsCountdown : false,
      collectingTrickCountdown:
        stateName === "confirmTrick" ? prev.collectingTrickCountdown : false,
    });
  }

  resetLastCombos(): void {
    const prev = this.getState();
    const lastCombos: Record<string, LastComboState> = {};
    for (const pid of Object.keys(prev.players)) {
      lastCombos[pid] = { cards: [], description: "", passed: false };
    }
    this.update({
      lastCombos,
      lastComboPlayerId: "",
      trickLastCombo: {
        playerId: "",
        type: 99,
        cards: [],
        phoenixValue: null,
        description: "",
      },
    });
  }

  enterNewRound(): void {
    const prev = this.getState();
    const players: Record<string, LivePlayer> = {};
    const lastCombos: Record<string, LastComboState> = {};
    for (const [pid, player] of Object.entries(prev.players)) {
      players[pid] = {
        ...player,
        capturedPoints: 0,
        passedCardReady: false,
        callTichu: -1,
        callGrandTichu: -1,
      };
      lastCombos[pid] = { cards: [], description: "", passed: false };
    }
    const passSlots = prev.passSlots.map((slot) => ({
      ...slot,
      givenCard: null,
      receivedCard: null,
      animatingAccept: false,
    }));
    this.update({
      players,
      lastCombos,
      passSlots,
      lastComboPlayerId: "",
      trickLastCombo: {
        playerId: "",
        type: 99,
        cards: [],
        phoenixValue: null,
        description: "",
      },
      capturedCards: [],
      hand: [],
      selectedCardIds: [],
      currentTrick: [],
      currentTrickValue: 0,
      firstOutPlayerId: "",
      round: prev.round + 1,
      trick: 0,
      mahjongWish: 0,
      selectedMahjongWish: null,
      phoenixAllowedValues: [],
      selectedPhoenixValue: null,
    });
  }

  enterGrandTichuBets(): void {
    this.resetLastCombos();
  }

  enterShowPassedCards(receivedCards?: Card[]): void {
    const prev = this.getState();
    const players: Record<string, LivePlayer> = {};
    for (const [pid, player] of Object.entries(prev.players)) {
      players[pid] = {
        ...player,
        handcount: 14,
      };
    }

    const normalized = receivedCards ? normalizeCards(receivedCards) : [];
    const passSlots = prev.passSlots.map((slot) => {
      const received =
        normalized.find((c) => String(c.passed_from) === slot.playerId) ?? slot.receivedCard;
      return {
        ...slot,
        givenCard: null,
        receivedCard: received ?? null,
        animatingAccept: false,
      };
    });

    this.update({
      players,
      passSlots,
    });
  }

  enterNewTrick(): void {
    const prev = this.getState();
    const lastCombos: Record<string, LastComboState> = {};
    for (const pid of Object.keys(prev.players)) {
      lastCombos[pid] = { cards: [], description: "", passed: false };
    }
    this.update({
      lastCombos,
      lastComboPlayerId: "",
      trickLastCombo: {
        playerId: "",
        type: 99,
        cards: [],
        phoenixValue: null,
        description: "",
      },
      capturedCards: [...prev.capturedCards, ...prev.currentTrick],
      currentTrick: [],
      currentTrickValue: 0,
      trick: prev.trick + 1,
    });
  }

  enterMahjongPlay(): void {
    this.update({
      selectedCardIds: [],
      selectedMahjongWish: null,
    });
  }

  enterPhoenixPlay(allowedValues: number[]): void {
    this.update({
      selectedCardIds: [],
      phoenixAllowedValues: [...allowedValues],
      selectedPhoenixValue: null,
    });
  }

  enterPlayBomb(bombActivePlayerId: string | number): void {
    this.update({
      bombActivePlayerId: String(bombActivePlayerId),
    });
  }

  enterEndRound(): void {
    const prev = this.getState();
    const players: Record<string, LivePlayer> = {};
    for (const [pid, player] of Object.entries(prev.players)) {
      players[pid] = {
        ...player,
        handcount: 0,
        capturedPoints: 0,
        callGrandTichu: -1,
        callTichu: -1,
        passedCardReady: false,
        autopass: false,
        pass: 0,
      };
    }
    this.update({
      hand: [],
      selectedCardIds: [],
      players,
      firstOutPlayerId: "",
      lastComboPlayerId: "",
      trickLastCombo: {
        playerId: "",
        type: 99,
        cards: [],
        phoenixValue: null,
        description: "",
      },
    });
  }

  cleanPlayersPanel(): void {
    this.enterEndRound();
  }

  // Hand & Selection mutations
  setHand(cards: Card[]): void {
    const normalized = normalizeCards(cards);
    const validIds = new Set(normalized.map((c) => c.id));
    const prev = this.getState();
    this.update({
      hand: normalized,
      selectedCardIds: prev.selectedCardIds.filter((id) => validIds.has(id)),
    });
  }

  dealCards(cards: Card[]): void {
    const normalized = normalizeCards(cards);
    const prev = this.getState();
    const isInitialDeal = normalized.length === 8;
    const nextHand = isInitialDeal ? normalized : [...prev.hand, ...normalized];
    const totalCards = isInitialDeal ? 8 : 14;

    const players: Record<string, LivePlayer> = {};
    for (const [pid, player] of Object.entries(prev.players)) {
      players[pid] = {
        ...player,
        handcount: totalCards,
      };
    }

    this.update({
      hand: nextHand,
      selectedCardIds: isInitialDeal ? [] : prev.selectedCardIds,
      players,
    });
  }

  setSelectedCardIds(selectedCardIds: string[]): void {
    this.update({ selectedCardIds: [...selectedCardIds] });
  }

  toggleCardSelection(cardId: string, mode: 0 | 1 | 2 = 2): void {
    if (mode === 0) return;
    const id = String(cardId);
    const prev = this.getState();
    const isSelected = prev.selectedCardIds.includes(id);
    if (mode === 1) {
      this.update({ selectedCardIds: isSelected ? [] : [id] });
    } else {
      this.update({
        selectedCardIds: isSelected
          ? prev.selectedCardIds.filter((x) => x !== id)
          : [...prev.selectedCardIds, id],
      });
    }
  }

  clearSelection(): void {
    this.update({ selectedCardIds: [] });
  }

  setHandSortOrder(handSortOrder: "rank" | "color"): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("tichu_hand_sort_order", handSortOrder);
      }
    } catch (_e) {
      // ignore storage errors
    }
    this.update({ handSortOrder });
  }

  // Passing cards mutations
  toggleGiveCardSlot(slotIndex: number): void {
    const prev = this.getState();
    if (prev.stateName !== "giveCards" || !prev.isCurrentPlayerActive) return;
    const slot = prev.passSlots[slotIndex];
    if (!slot) return;

    if (!slot.givenCard) {
      if (prev.selectedCardIds.length !== 1) return;
      const selectedId = prev.selectedCardIds[0]!;
      const card = prev.hand.find((c) => c.id === selectedId);
      if (!card) return;

      const passSlots = prev.passSlots.map((s, idx) =>
        idx === slotIndex ? { ...s, givenCard: card } : s,
      );
      this.update({
        passSlots,
        hand: prev.hand.filter((c) => c.id !== selectedId),
        selectedCardIds: [],
      });
    } else {
      const returnedCard = slot.givenCard;
      const passSlots = prev.passSlots.map((s, idx) =>
        idx === slotIndex ? { ...s, givenCard: null } : s,
      );
      this.update({
        passSlots,
        hand: [...prev.hand, returnedCard],
      });
    }
  }

  resetPassCards(): void {
    const prev = this.getState();
    const returnedCards: Card[] = [];
    const passSlots = prev.passSlots.map((slot) => {
      if (slot.givenCard) {
        returnedCards.push(slot.givenCard);
        return { ...slot, givenCard: null };
      }
      return slot;
    });
    if (returnedCards.length === 0) return;
    this.update({
      passSlots,
      hand: [...prev.hand, ...returnedCards],
    });
  }

  getCardsToGiveIds(): string[] | null {
    const prev = this.getState();
    if (prev.passSlots.length < 3) return null;
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const card = prev.passSlots[i]?.givenCard;
      if (!card) return null;
      ids.push(card.id);
    }
    return ids;
  }

  clearGivenCards(): void {
    const prev = this.getState();
    this.update({
      passSlots: prev.passSlots.map((s) => ({ ...s, givenCard: null })),
    });
  }

  applyPassCardsNotif(cardIds: string[]): void {
    const idSet = new Set(cardIds.map((id) => String(id)));
    const prev = this.getState();
    this.update({
      hand: prev.hand.filter((c) => !idSet.has(c.id)),
      selectedCardIds: prev.selectedCardIds.filter((id) => !idSet.has(id)),
      passSlots: prev.passSlots.map((s) =>
        s.givenCard && idSet.has(s.givenCard.id) ? { ...s, givenCard: null } : s,
      ),
    });
  }

  startAcceptCardsAnimation(): void {
    const prev = this.getState();
    this.update({
      acceptingCardsCountdown: false,
      passSlots: prev.passSlots.map((s) => ({
        ...s,
        animatingAccept: s.receivedCard !== null,
      })),
    });
  }

  finishAcceptCards(cards: Card[]): void {
    const normalized = normalizeCards(cards);
    const prev = this.getState();
    const existingIds = new Set(prev.hand.map((c) => c.id));
    const newCards = normalized.filter((c) => !existingIds.has(c.id));
    this.update({
      acceptingCardsCountdown: false,
      hand: [...prev.hand, ...newCards],
      passSlots: prev.passSlots.map((s) => ({
        ...s,
        receivedCard: null,
        animatingAccept: false,
      })),
    });
  }

  // Trick / Combo / Pass / Bet / Score / Wish / Phoenix mutations
  applyPlayCombo(
    playerId: string | number,
    cards: Card[],
    comboName: string,
    points: number,
    type?: number,
    phoenixValue?: number | number[] | null,
  ): void {
    const pid = String(playerId);
    const normalized = normalizeCards(cards);
    const playedIds = new Set(normalized.map((c) => c.id));
    const prev = this.getState();

    const isCurrent = pid === prev.currentPlayerId;
    const nextHand = isCurrent ? prev.hand.filter((c) => !playedIds.has(c.id)) : prev.hand;
    const nextSelectedIds = isCurrent
      ? prev.selectedCardIds.filter((id) => !playedIds.has(id))
      : prev.selectedCardIds;

    const existingPlayer = prev.players[pid];
    const players = existingPlayer
      ? {
          ...prev.players,
          [pid]: {
            ...existingPlayer,
            handcount: Math.max(0, existingPlayer.handcount - normalized.length),
            passedCardReady: false,
          },
        }
      : prev.players;

    const comboType = type !== undefined ? Number(type) : 0;
    const comboPhoenix = phoenixValue !== undefined ? phoenixValue : null;

    const lastCombos = {
      ...prev.lastCombos,
      [pid]: {
        cards: normalized,
        description: comboName,
        passed: false,
        type: comboType,
        phoenixValue: comboPhoenix,
      },
    };

    this.update({
      hand: nextHand,
      selectedCardIds: nextSelectedIds,
      players,
      lastCombos,
      lastComboPlayerId: pid,
      trickLastCombo: {
        playerId: pid,
        type: comboType,
        cards: normalized,
        phoenixValue: comboPhoenix,
        description: comboName,
      },
      currentTrick: [...prev.currentTrick, ...normalized],
      currentTrickValue: prev.currentTrickValue + Number(points ?? 0),
    });
  }

  applyPass(playerId: string | number): void {
    const pid = String(playerId);
    const prev = this.getState();
    const existingPlayer = prev.players[pid];
    const players = existingPlayer
      ? {
          ...prev.players,
          [pid]: {
            ...existingPlayer,
            passedCardReady: true,
          },
        }
      : prev.players;

    const lastCombos = {
      ...prev.lastCombos,
      [pid]: {
        cards: [],
        description: "Pass",
        passed: true,
      },
    };

    this.update({
      players,
      lastCombos,
    });
  }

  applyGrandTichuBet(playerId: string | number, bet: GrandTichuBetValue | string | number): void {
    const pid = String(playerId);
    const normalizedBet = normalizeGrandTichuBet(bet);
    const prev = this.getState();
    const existingPlayer = prev.players[pid];
    if (!existingPlayer) return;

    this.updatePlayer(pid, {
      callGrandTichu: normalizedBet,
      callTichu: normalizedBet === 200 ? 0 : existingPlayer.callTichu,
    });
  }

  applyTichuBet(playerId: string | number, bet: TichuBetValue | string | number): void {
    const pid = String(playerId);
    const normalizedBet = normalizeTichuBet(bet);
    const prev = this.getState();
    const existingPlayer = prev.players[pid];
    if (!existingPlayer) return;

    this.updatePlayer(pid, {
      callTichu: normalizedBet,
      callGrandTichu: existingPlayer.callGrandTichu === 200 ? 200 : (0 as GrandTichuBetValue),
    });
  }

  addBetAnimation(playerId: string | number, bet: number): number {
    const id = this.nextBetAnimId++;
    const prev = this.getState();
    this.update({
      betAnimations: [
        ...prev.betAnimations,
        {
          id,
          playerId: String(playerId),
          bet: Number(bet),
          fadingOut: false,
        },
      ],
    });
    return id;
  }

  fadeOutBetAnimation(id: number): void {
    const prev = this.getState();
    this.update({
      betAnimations: prev.betAnimations.map((a) => (a.id === id ? { ...a, fadingOut: true } : a)),
    });
  }

  removeBetAnimation(id: number): void {
    const prev = this.getState();
    this.update({
      betAnimations: prev.betAnimations.filter((a) => a.id !== id),
    });
  }

  triggerBetAnimation(
    playerId: string | number,
    bet: number,
    fadeDelayMs = 1000,
    fadeDurationMs = 1000,
  ): void {
    const id = this.addBetAnimation(playerId, bet);
    setTimeout(() => {
      this.fadeOutBetAnimation(id);
    }, fadeDelayMs);
    setTimeout(() => {
      this.removeBetAnimation(id);
    }, fadeDelayMs + fadeDurationMs);
  }

  setMahjongWish(wish: number): void {
    const n = Number(wish);
    this.update({
      mahjongWish: n > 0 && n < 15 ? n : 0,
      selectedMahjongWish: null,
    });
  }

  setSelectedMahjongWish(selectedMahjongWish: number | null): void {
    this.update({ selectedMahjongWish });
  }

  setPhoenixAllowedValues(phoenixAllowedValues: number[]): void {
    this.update({ phoenixAllowedValues: [...phoenixAllowedValues] });
  }

  setSelectedPhoenixValue(selectedPhoenixValue: number | null): void {
    this.update({ selectedPhoenixValue });
  }

  applyPlayerGoOut(playerId: string | number, firstOutId: string | number): void {
    const pid = String(playerId);
    const fid = String(firstOutId);
    const prev = this.getState();
    const existingPlayer = prev.players[pid];
    const players = existingPlayer
      ? {
          ...prev.players,
          [pid]: {
            ...existingPlayer,
            handcount: 0,
          },
        }
      : prev.players;

    this.update({
      players,
      firstOutPlayerId: pid === fid ? pid : prev.firstOutPlayerId,
    });
  }

  applyCaptureCards(playerId: string | number, trickValue: number): void {
    const pid = String(playerId);
    const prev = this.getState();
    const players: Record<string, LivePlayer> = {};
    for (const [id, player] of Object.entries(prev.players)) {
      players[id] = {
        ...player,
        capturedPoints:
          id === pid ? player.capturedPoints + Number(trickValue) : player.capturedPoints,
        passedCardReady: false,
      };
    }
    this.update({ players });
  }

  applyNewScores(newScores: Record<string | number, number | string>): void {
    const prev = this.getState();
    const players: Record<string, LivePlayer> = { ...prev.players };
    for (const [id, score] of Object.entries(newScores)) {
      const pid = String(id);
      const existing = players[pid];
      if (existing) {
        players[pid] = {
          ...existing,
          score: Number(score),
        };
      }
    }
    this.update({ players });
  }

  setAutopass(autopassValue: number | string | boolean): void {
    const prev = this.getState();
    if (prev.isSpectator || !prev.currentPlayerId) return;
    const passNum =
      typeof autopassValue === "boolean" ? (autopassValue ? 1 : 0) : Number(autopassValue) || 0;
    this.updatePlayer(prev.currentPlayerId, {
      autopass: passNum > 0,
      pass: passNum,
    });
  }

  // UI & Preferences setters
  setClockwise(clockwise: boolean): void {
    this.update({ clockwise });
  }

  setSquareTable(squareTable: boolean): void {
    this.update({ squareTable });
  }

  setConfirmPassWithSelection(confirmPassWithSelection: boolean): void {
    this.update({ confirmPassWithSelection: Boolean(confirmPassWithSelection) });
  }

  setTheme(theme: number): void {
    this.update({ theme });
  }

  setTiki(isTiki: boolean): void {
    this.update({ isTiki });
  }

  setExperimentalReplayOpen(experimentalReplayOpen: boolean): void {
    this.update({ experimentalReplayOpen });
  }

  setTrickModalOpen(trickModalOpen: boolean): void {
    this.update({ trickModalOpen });
  }

  setAcceptingCardsCountdown(acceptingCardsCountdown: boolean): void {
    this.update({ acceptingCardsCountdown });
  }

  setCollectingTrickCountdown(collectingTrickCountdown: boolean): void {
    this.update({ collectingTrickCountdown });
  }
}

declare global {
  interface Window {
    gameModel: GameModel;
  }
}

if (typeof window !== "undefined") {
  if (!window.gameModel) {
    window.gameModel = new GameModel();
  }
}

if (typeof document !== "undefined" && document.documentElement) {
  const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
  document.documentElement.style.setProperty("--icon-url", `url(${themeUrl}img/tichu-icons.png)`);
  document.documentElement.style.setProperty(
    "--table-icons-url",
    `url(${themeUrl}img/tichu-icons-table.png)`,
  );
  document.documentElement.style.setProperty(
    "--mahjong-bg-url",
    `url(${themeUrl}img/tichu-mahjong.png)`,
  );
  document.documentElement.style.setProperty(
    "--tiki-mahjong-bg-url",
    `url(${themeUrl}img/tiki-tichu-mahjong.png)`,
  );
}
