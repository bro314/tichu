/**
 * BGA Studio Console & DOM Test Harness (`window.tt` / `window.tichuTest` + `#studio-test-bar`)
 *
 * Automatically activates on `studio.boardgamearena.com`:
 * 1. Attaches `window.tt` (`window.tichuTest`) on both the game iframe `window`
 *    and `window.parent` (for interactive DevTools console driving).
 * 2. Renders a compact `#studio-test-bar` with one-click test buttons (`#tt_btn_smoke`,
 *    `#tt_btn_round`, `#tt_btn_game`, `#tt_btn_gt_all`, `#tt_btn_pass_all`, `#tt_btn_step1`,
 *    `#tt_btn_assert`), a command runner (`#tt_cmd_input` + `#tt_cmd_run`), and a
 *    structured JSON readout (`#tt_test_output[data-done="1"]`) so automated browser
 *    agents can execute full multi-player Studio test suites in a single click without
 *    `page.evaluate`, player URL switching, or screenshots.
 */

const SUIT_CODES: Record<number, string> = { 1: "S", 2: "R", 3: "B", 4: "G" };
const SUIT_SYMBOLS: Record<number, string> = { 1: "♠", 2: "★", 3: "💙", 4: "🟢" };
const RANK_LABELS: Record<number, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};
const SPECIAL_CODES: Record<number, string> = { 1: "DR", 2: "PH", 3: "DOG", 4: "MJ" };

interface NormalizedCard {
  id: string;
  type: number;
  type_arg: number;
}

function cardFromStockType(stockTypeVal: number, id?: string): NormalizedCard {
  const st = Number(stockTypeVal);
  const color = Math.floor(st / 14) + 1;
  const value = (st % 14) + 1;
  return {
    id: String(id ?? ""),
    type: color,
    type_arg: value,
  };
}

function normalizeCardObj(cardOrItem: any): NormalizedCard | null {
  if (!cardOrItem || typeof cardOrItem !== "object") return null;
  if (cardOrItem.type_arg !== undefined) {
    return {
      id: String(cardOrItem.id ?? ""),
      type: Number(cardOrItem.type),
      type_arg: Number(cardOrItem.type_arg),
    };
  }
  if (cardOrItem.type !== undefined) {
    return cardFromStockType(Number(cardOrItem.type), cardOrItem.id);
  }
  return null;
}

function formatCardCode(cardOrItem: any): string {
  const c = normalizeCardObj(cardOrItem);
  if (!c) return "?";
  if (c.type_arg === 1) {
    return SPECIAL_CODES[c.type] || "SP";
  }
  return (SUIT_CODES[c.type] || "?") + (RANK_LABELS[c.type_arg] || String(c.type_arg));
}

function formatCardPretty(cardOrItem: any, withId?: boolean): string {
  const c = normalizeCardObj(cardOrItem);
  if (!c) return "?";
  let label = "";
  if (c.type_arg === 1) {
    label = SPECIAL_CODES[c.type] || "SP";
  } else {
    label = (RANK_LABELS[c.type_arg] || String(c.type_arg)) + (SUIT_SYMBOLS[c.type] || "");
  }
  if (withId && c.id) {
    return `${label}(#${c.id})`;
  }
  return label;
}

function parseRankToken(tok: any): number | null {
  if (tok === null || tok === undefined) return null;
  const s = String(tok).trim().toUpperCase();
  if (s === "NONE" || s === "NO" || s === "0" || s === "15") return 15;
  if (s === "J" || s === "JACK") return 11;
  if (s === "Q" || s === "QUEEN") return 12;
  if (s === "K" || s === "KING") return 13;
  if (s === "A" || s === "ACE") return 14;
  if (s === "MJ" || s === "MAHJONG" || s === "1") return 1;
  const n = parseInt(s, 10);
  if (!isNaN(n) && n >= 2 && n <= 15) return n;
  return null;
}

function getAllowedPhoenixValues(ui: any): number[] {
  const gsArgs = ui?.gamedatas?.gamestate?.args;
  const candidates = [
    ui?.allowedValues,
    (window as any).gameModel?.getState?.()?.phoenixAllowedValues,
    gsArgs?._private?.values,
    gsArgs?._private?.active?.values,
    gsArgs?.values,
  ];
  for (let i = 0; i < candidates.length; i++) {
    const raw = candidates[i];
    if (Array.isArray(raw) && raw.length > 0) {
      const nums = raw.map(Number).filter((v: number) => !isNaN(v) && v >= 2 && v <= 14);
      if (nums.length > 0) return nums;
    }
  }
  return [];
}

function parseCardSpecToken(rawToken: any): any {
  if (rawToken && typeof rawToken === "object") {
    const c = normalizeCardObj(rawToken);
    if (c && c.id) return { kind: "id", id: String(c.id) };
    if (c) return { kind: "exact", suit: c.type, rank: c.type_arg };
  }
  const raw = String(rawToken ?? "").trim();
  if (!raw) return null;

  if (raw.indexOf("#") === 0) {
    return { kind: "id", id: raw.slice(1).trim() };
  }

  const upper = raw.toUpperCase();
  if (upper === "DR" || upper === "DRAGON") return { kind: "exact", suit: 1, rank: 1 };
  if (upper === "PH" || upper === "PHOENIX") return { kind: "exact", suit: 2, rank: 1 };
  if (upper === "DOG" || upper === "HOUND") return { kind: "exact", suit: 3, rank: 1 };
  if (upper === "MJ" || upper === "MAHJONG") return { kind: "exact", suit: 4, rank: 1 };

  const suitMap: Record<string, number> = {
    S: 1,
    R: 2,
    B: 3,
    G: 4,
  };

  const suitFirst = upper.match(/^([SRBG])\s*(10|[2-9]|[JQKA])$/);
  if (suitFirst) {
    const suit = suitMap[suitFirst[1]!];
    const rank = parseRankToken(suitFirst[2]);
    if (suit && rank) return { kind: "exact", suit, rank };
  }

  const rankFirst = upper.match(/^(10|[2-9]|[JQKA])\s*([SRBG])$/);
  if (rankFirst) {
    const rank = parseRankToken(rankFirst[1]);
    const suit = suitMap[rankFirst[2]!];
    if (suit && rank) return { kind: "exact", suit, rank };
  }

  if (upper === "J" || upper === "Q" || upper === "K" || upper === "A") {
    return { kind: "rank", rank: parseRankToken(upper) };
  }

  const num = Number(upper);
  if (!isNaN(num) && Math.floor(num) === num && num > 0) {
    return { kind: "number", value: num, id: String(num) };
  }

  return null;
}

function resolveCardsFromHand(input: any, handCards: any[]): NormalizedCard[] | null {
  const hand: NormalizedCard[] = [];
  for (let i = 0; i < (handCards || []).length; i++) {
    const norm = normalizeCardObj(handCards[i]);
    if (norm) hand.push(norm);
  }
  if (input === undefined || input === null) return null;

  let tokens: any[] = [];
  let forceIdMode = false;
  if (typeof input === "string") {
    if (input.indexOf(";") !== -1) {
      forceIdMode = true;
      tokens = input
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      tokens = input
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } else if (Array.isArray(input)) {
    tokens = input;
  } else {
    tokens = [input];
  }

  if (tokens.length === 0) return [];

  const parsed = tokens.map(parseCardSpecToken);
  for (let i = 0; i < parsed.length; i++) {
    if (!parsed[i]) {
      throw new Error(`Invalid card specification in: ${JSON.stringify(input)}`);
    }
  }

  const usedIds: Record<string, boolean> = {};
  const resolved: NormalizedCard[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const spec = parsed[i];
    let chosen: NormalizedCard | null = null;

    if (spec.kind === "id") {
      chosen = hand.find((c) => !usedIds[c.id] && String(c.id) === String(spec.id)) || null;
    } else if (spec.kind === "exact") {
      chosen =
        hand.find((c) => !usedIds[c.id] && c.type === spec.suit && c.type_arg === spec.rank) ||
        null;
    } else if (spec.kind === "rank") {
      chosen = hand.find((c) => !usedIds[c.id] && c.type_arg === spec.rank) || null;
    } else if (spec.kind === "number") {
      if (forceIdMode || spec.value > 14) {
        chosen = hand.find((c) => !usedIds[c.id] && String(c.id) === String(spec.value)) || null;
      }
      if (!chosen && spec.value >= 1 && spec.value <= 14) {
        chosen = hand.find((c) => !usedIds[c.id] && c.type_arg === spec.value) || null;
      }
      if (!chosen) {
        chosen = hand.find((c) => !usedIds[c.id] && String(c.id) === String(spec.value)) || null;
      }
    }

    if (!chosen) {
      const availableStr = hand.map((c) => `${formatCardCode(c)}(#${c.id})`).join(", ");
      throw new Error(
        `Could not find card matching ${JSON.stringify(spec)} in hand: [${availableStr}]`,
      );
    }

    usedIds[chosen.id] = true;
    resolved.push(chosen);
  }

  return resolved;
}

function pickThreeDefaultCardsFromHand(handCards: any[]): NormalizedCard[] {
  const hand: NormalizedCard[] = [];
  for (let i = 0; i < (handCards || []).length; i++) {
    const norm = normalizeCardObj(handCards[i]);
    if (norm) hand.push(norm);
  }
  if (hand.length < 3) return hand;

  const rankCounts: Record<number, number> = {};
  for (let i = 0; i < hand.length; i++) {
    const r = hand[i]!.type_arg;
    rankCounts[r] = (rankCounts[r] || 0) + 1;
  }

  const sorted = hand.slice().sort((a, b) => {
    const aSpec = a.type_arg === 1 ? 1 : 0;
    const bSpec = b.type_arg === 1 ? 1 : 0;
    if (aSpec !== bSpec) return aSpec - bSpec;
    if (aSpec === 0) {
      const aFreq = rankCounts[a.type_arg] || 1;
      const bFreq = rankCounts[b.type_arg] || 1;
      if (aFreq !== bFreq) return aFreq - bFreq;
      if (a.type_arg !== b.type_arg) return a.type_arg - b.type_arg;
    }
    return Number(a.id) - Number(b.id);
  });

  return sorted.slice(0, 3);
}

function pickDefaultPlayCardsFromHand(ui: any): NormalizedCard[] {
  const gd = (ui && ui.gamedatas) || {};
  const hand: NormalizedCard[] = [];
  const rawHand = gd.hand || [];
  for (let i = 0; i < rawHand.length; i++) {
    const norm = normalizeCardObj(rawHand[i]);
    if (norm) hand.push(norm);
  }
  if (hand.length === 0) return [];

  if (ui && ui.playerHand) {
    const selected = ui.playerHand.getSelectedItems();
    if (selected && selected.length > 0) {
      const selMap: Record<string, boolean> = {};
      for (let i = 0; i < selected.length; i++) {
        selMap[String(selected[i].id)] = true;
      }
      return hand.filter((c) => Boolean(selMap[String(c.id)]));
    }
  }

  const stName = gd.gamestate && gd.gamestate.name;
  const wish = Number(gd.mahjongWish || 0);
  if (wish >= 2 && wish <= 14) {
    const wished = hand.find((c) => c.type_arg === wish);
    if (wished) return [wished];
  }

  if (stName === "playComboOpen") {
    const mj = hand.find((c) => c.type_arg === 1 && c.type === 4);
    if (mj) return [mj];
    const dog = hand.find((c) => c.type_arg === 1 && c.type === 3);
    if (dog) return [dog];
  }

  const normals = hand.filter((c) => c.type_arg >= 2).sort((a, b) => a.type_arg - b.type_arg);
  if (normals.length > 0) return [normals[0]!];
  return [hand[0]!];
}

function getTeamRelations(players: any[], myPlayerId: number) {
  const myIdx = players.findIndex((p: any) => Number(p.id) === myPlayerId);
  const myPlayer = myIdx >= 0 ? players[myIdx] : null;
  const myTeam = myPlayer ? Number(myPlayer.team) : 0;
  const partner =
    players.find((p: any) => Number(p.id) !== myPlayerId && Number(p.team) === myTeam) ||
    (myIdx >= 0 && players.length >= 4 ? players[(myIdx + 2) % players.length] : null);
  const opps = players.filter(
    (p: any) => Number(p.id) !== myPlayerId && Number(p.id) !== Number(partner?.id ?? -1),
  );
  return { myIdx, myPlayer, myTeam, partner, opps };
}

function normalizeRealHand(handCards: any[]): NormalizedCard[] {
  const res: NormalizedCard[] = [];
  for (let i = 0; i < (handCards || []).length; i++) {
    const c = normalizeCardObj(handCards[i]);
    if (c && c.id && c.id !== "0") res.push(c);
  }
  return res;
}

function comboRankStrength(combo: any): number {
  if (!combo || !Array.isArray(combo.cards) || combo.cards.length === 0) return 0;
  if (typeof combo.getFirstValue === "function") {
    const v = Number(combo.getFirstValue());
    if (!isNaN(v)) return v;
  }
  const c0 = combo.cards[0];
  return c0 ? Number(c0.type_arg || 0) : 0;
}

function findAllRealBombsInHand(handCards: any[], cv: any): any[] {
  const hand = normalizeRealHand(handCards);
  if (hand.length < 4 || !cv || !cv.Combo) return [];
  const bombs: any[] = [];
  const seenKeys: Record<string, boolean> = {};
  const addBomb = (cards: NormalizedCard[]) => {
    try {
      const c = new cv.Combo(cards);
      if (c && c.type === 7) {
        const key = c.cards
          .map((x: any) => String(x.id))
          .sort()
          .join(",");
        if (!seenKeys[key]) {
          seenKeys[key] = true;
          bombs.push(c);
        }
      }
    } catch (_e) {}
  };

  // 1. 4-of-a-kind bombs
  const byRank: Record<number, NormalizedCard[]> = {};
  for (let i = 0; i < hand.length; i++) {
    const card = hand[i]!;
    if (card.type_arg < 2) continue;
    if (!byRank[card.type_arg]) byRank[card.type_arg] = [];
    byRank[card.type_arg]!.push(card);
  }
  const rankKeys = Object.keys(byRank);
  for (let i = 0; i < rankKeys.length; i++) {
    const group = byRank[Number(rankKeys[i])]!;
    if (group.length === 4) {
      addBomb(group);
    }
  }

  // 2. Straight flush bombs (5+ consecutive cards of same suit)
  for (let suit = 1; suit <= 4; suit++) {
    const suitCards = hand
      .filter((c) => c.type === suit && c.type_arg >= 2)
      .sort((a, b) => a.type_arg - b.type_arg);
    if (suitCards.length < 5) continue;
    let runStart = 0;
    while (runStart < suitCards.length) {
      let runEnd = runStart;
      while (
        runEnd + 1 < suitCards.length &&
        suitCards[runEnd + 1]!.type_arg === suitCards[runEnd]!.type_arg + 1
      ) {
        runEnd++;
      }
      const runLen = runEnd - runStart + 1;
      if (runLen >= 5) {
        for (let s = runStart; s <= runEnd - 4; s++) {
          for (let e = s + 4; e <= runEnd; e++) {
            addBomb(suitCards.slice(s, e + 1));
          }
        }
      }
      runStart = runEnd + 1;
    }
  }

  bombs.sort((a, b) => {
    if (a.canBeat(b)) return 1;
    if (b.canBeat(a)) return -1;
    return a.cards.length - b.cards.length;
  });
  return bombs;
}

function getBombCardIdSet(bombs: any[]): Record<string, boolean> {
  const ids: Record<string, boolean> = {};
  for (let i = 0; i < bombs.length; i++) {
    const cards = bombs[i]?.cards || [];
    for (let j = 0; j < cards.length; j++) {
      ids[String(cards[j].id)] = true;
    }
  }
  return ids;
}

function comboBreaksBomb(combo: any, handLen: number, bombIds: Record<string, boolean>): boolean {
  if (!combo || combo.type === 7) return false;
  if (combo.cards.length === handLen) return false;
  for (let i = 0; i < combo.cards.length; i++) {
    if (bombIds[String(combo.cards[i].id)]) return true;
  }
  return false;
}

function findSmartPassCards(
  handCards: any[],
  cv: any,
): [NormalizedCard, NormalizedCard, NormalizedCard] {
  const hand = normalizeRealHand(handCards);
  const bombs = findAllRealBombsInHand(hand, cv);
  const bombIds = getBombCardIdSet(bombs);

  const rankCounts: Record<number, number> = {};
  for (let i = 0; i < hand.length; i++) {
    const r = hand[i]!.type_arg;
    rankCounts[r] = (rankCounts[r] || 0) + 1;
  }

  // Pick partner card (slot 1): highest card not breaking a bomb (prefer Dragon/Phoenix/Ace/King).
  const scorePartner = (c: NormalizedCard): number => {
    let score = 0;
    if (c.type_arg === 1 && c.type === 1)
      score = 200; // Dragon
    else if (c.type_arg === 1 && c.type === 2)
      score = 190; // Phoenix
    else if (c.type_arg === 1 && c.type === 4)
      score = 20; // Mahjong
    else if (c.type_arg === 1 && c.type === 3)
      score = -100; // Dog (avoid gifting Dog unless forced)
    else score = c.type_arg * 10;
    if ((rankCounts[c.type_arg] || 0) === 1 && c.type_arg >= 2) score += 3;
    if (bombIds[c.id]) score -= 80;
    return score;
  };
  const partnerCandidates = hand.slice().sort((a, b) => scorePartner(b) - scorePartner(a));
  const partnerCard = partnerCandidates[0]!;

  // Pick 2 opponent cards (slots 0 & 2): low singletons 2..7, avoid Dog/Dragon/Phoenix/Ace, avoid 5/10 if possible.
  const remaining = hand.filter((c) => c.id !== partnerCard.id);
  const scoreOpponent = (c: NormalizedCard): number => {
    if (c.type_arg === 1) {
      if (c.type === 4) return 25; // Mahjong ok if low cards scarce
      if (c.type === 3) return 40; // Dog prefer not to give opponent, but better than Ace/Dragon
      return 1000; // Never give Phoenix or Dragon unless forced
    }
    let penalty = 0;
    const freq = rankCounts[c.type_arg] || 1;
    if (freq > 1) penalty += freq * 18;
    if (c.type_arg === 5 || c.type_arg === 10 || c.type_arg === 13) penalty += 14;
    if (c.type_arg === 14) penalty += 200;
    if (bombIds[c.id]) penalty += 150;
    return c.type_arg * 5 + penalty;
  };
  remaining.sort((a, b) => scoreOpponent(a) - scoreOpponent(b));
  const opp0 = remaining[0]!;
  const opp1 = remaining[1]!;
  return [opp0, partnerCard, opp1];
}

function generateLegalCombos(handCards: any[], lastCombo: any, wish: number, cv: any): any[] {
  const hand = normalizeRealHand(handCards);
  if (hand.length === 0 || !cv || !cv.Combo) return [];

  const seen: Record<string, boolean> = {};
  const results: any[] = [];
  const isOpen = !lastCombo || lastCombo.type === 99;
  const targetType = isOpen ? null : Number(lastCombo.type);
  const targetLen = isOpen ? null : Number(lastCombo.cards?.length || 0);

  const tryAdd = (cards: NormalizedCard[]) => {
    if (wish >= 2 && wish <= 14) {
      let hasWish = false;
      for (let i = 0; i < cards.length; i++) {
        if (cards[i]!.type_arg === wish) {
          hasWish = true;
          break;
        }
      }
      if (!hasWish) return;
    }
    try {
      const c = new cv.Combo(cards, null, null, null, lastCombo);
      if (!c || c.type === 99) return;
      if (!isOpen && !c.canBeat(lastCombo)) return;
      const key = `${c.type}:${c.cards
        .map((x: any) => x.id)
        .sort()
        .join(",")}`;
      if (!seen[key]) {
        seen[key] = true;
        results.push(c);
      }
    } catch (_e) {}
  };

  const phoenix = hand.find((c) => c.type === 2 && c.type_arg === 1) || null;
  const normalsByRank: Record<number, NormalizedCard[]> = {};
  for (let i = 0; i < hand.length; i++) {
    const card = hand[i]!;
    if (card.type_arg >= 2) {
      if (!normalsByRank[card.type_arg]) normalsByRank[card.type_arg] = [];
      normalsByRank[card.type_arg]!.push(card);
    }
  }
  const ranks = Object.keys(normalsByRank)
    .map(Number)
    .sort((a, b) => a - b);

  // Singles (also Dog when open)
  if (isOpen || targetType === 1) {
    for (let i = 0; i < hand.length; i++) {
      tryAdd([hand[i]!]);
    }
  }

  // Pairs
  if (isOpen || (targetType === 2 && targetLen === 2)) {
    for (let i = 0; i < ranks.length; i++) {
      const r = ranks[i]!;
      const group = normalsByRank[r]!;
      if (group.length >= 2) tryAdd([group[0]!, group[1]!]);
      if (phoenix) tryAdd([phoenix, group[0]!]);
    }
  }

  // Trips
  if (isOpen || (targetType === 3 && targetLen === 3)) {
    for (let i = 0; i < ranks.length; i++) {
      const r = ranks[i]!;
      const group = normalsByRank[r]!;
      if (group.length >= 3) tryAdd([group[0]!, group[1]!, group[2]!]);
      if (phoenix && group.length >= 2) tryAdd([phoenix, group[0]!, group[1]!]);
    }
  }

  // Full houses (5 cards)
  if (isOpen || (targetType === 4 && targetLen === 5)) {
    const tripSets: Array<{ rank: number; cards: NormalizedCard[] }> = [];
    const pairSets: Array<{ rank: number; cards: NormalizedCard[] }> = [];
    for (let i = 0; i < ranks.length; i++) {
      const r = ranks[i]!;
      const group = normalsByRank[r]!;
      if (group.length >= 3) tripSets.push({ rank: r, cards: group.slice(0, 3) });
      if (group.length >= 2) pairSets.push({ rank: r, cards: group.slice(0, 2) });
    }
    for (let t = 0; t < tripSets.length; t++) {
      for (let p = 0; p < pairSets.length; p++) {
        if (tripSets[t]!.rank !== pairSets[p]!.rank) {
          tryAdd([...tripSets[t]!.cards, ...pairSets[p]!.cards]);
        }
      }
    }
    // Pair + Pair + Phoenix -> triggers ambiguous phoenixPlay!
    if (phoenix && pairSets.length >= 2) {
      for (let i = 0; i < pairSets.length; i++) {
        for (let j = i + 1; j < pairSets.length; j++) {
          tryAdd([phoenix, ...pairSets[i]!.cards, ...pairSets[j]!.cards]);
        }
      }
    }
    // Natural Trip + Singleton + Phoenix -> Phoenix completes pair
    if (phoenix && tripSets.length >= 1) {
      for (let t = 0; t < tripSets.length; t++) {
        for (let rIdx = 0; rIdx < ranks.length; rIdx++) {
          const r = ranks[rIdx]!;
          if (r !== tripSets[t]!.rank) {
            tryAdd([phoenix, ...tripSets[t]!.cards, normalsByRank[r]![0]!]);
          }
        }
      }
    }
  }

  // Running pairs (even length >= 4)
  if (isOpen || targetType === 5) {
    const minRun = targetLen ? targetLen / 2 : 2;
    const maxRun = targetLen ? targetLen / 2 : Math.floor(hand.length / 2);
    for (let runPairs = minRun; runPairs <= maxRun; runPairs++) {
      if (runPairs < 2) continue;
      for (let start = 2; start <= 15 - runPairs; start++) {
        const end = start + runPairs - 1;
        const missingSingles: number[] = [];
        let ok = true;
        const collected: NormalizedCard[] = [];
        for (let r = start; r <= end; r++) {
          const cnt = normalsByRank[r]?.length || 0;
          if (cnt >= 2) {
            collected.push(normalsByRank[r]![0]!, normalsByRank[r]![1]!);
          } else if (cnt === 1 && phoenix && missingSingles.length === 0) {
            missingSingles.push(r);
            collected.push(phoenix, normalsByRank[r]![0]!);
          } else {
            ok = false;
            break;
          }
        }
        if (ok) tryAdd(collected);
      }
    }
  }

  // Straights (length >= 5, ranks 1..14)
  if (isOpen || targetType === 6) {
    const mahjong = hand.find((c) => c.type === 4 && c.type_arg === 1) || null;
    const rankRep: Record<number, NormalizedCard> = {};
    if (mahjong) rankRep[1] = mahjong;
    for (let i = 0; i < ranks.length; i++) {
      const r = ranks[i]!;
      // Prefer cards not in a bomb if multiple suits exist
      rankRep[r] = normalsByRank[r]![0]!;
    }
    const minLen = targetLen || 5;
    const maxLen = targetLen || Math.min(14, hand.length);
    for (let len = minLen; len <= maxLen; len++) {
      if (len < 5) continue;
      for (let start = 1; start <= 15 - len; start++) {
        const end = start + len - 1;
        const collected: NormalizedCard[] = [];
        let gaps = 0;
        for (let r = start; r <= end; r++) {
          if (rankRep[r]) {
            collected.push(rankRep[r]!);
          } else if (r >= 2 && phoenix && gaps === 0) {
            gaps++;
            collected.push(phoenix);
          } else {
            gaps = 99;
            break;
          }
        }
        if (gaps <= 1 && collected.length === len) {
          tryAdd(collected);
        }
      }
    }
  }

  // Bombs
  const bombs = findAllRealBombsInHand(handCards, cv);
  for (let i = 0; i < bombs.length; i++) {
    tryAdd(bombs[i]!.cards);
  }

  return results;
}

export function initStudioTestHelper(gameuiInstance: any): void {
  const win = window as any;
  if (win.__tichuStudioHelperInitialized) return;
  const host = String((window.location && window.location.hostname) || "");
  const isStudioHost = host.indexOf("studio.boardgamearena.com") !== -1;
  const isLocalHost = host === "127.0.0.1" || host === "localhost";
  if (!isStudioHost && !isLocalHost) return;

  const currentUi = win.gameui || gameuiInstance;
  if (!currentUi || !currentUi.gamedatas) {
    if (!win.__tichuStudioRetryTimer) {
      let attempts = 0;
      win.__tichuStudioRetryTimer = window.setInterval(() => {
        attempts++;
        const readyUi = win.gameui || gameuiInstance;
        if ((readyUi && readyUi.gamedatas) || attempts >= 100) {
          clearInterval(win.__tichuStudioRetryTimer);
          win.__tichuStudioRetryTimer = null;
          if (readyUi && readyUi.gamedatas) {
            initStudioTestHelper(readyUi);
          }
        }
      }, 50);
    }
    return;
  }
  win.__tichuStudioHelperInitialized = true;
  const existingTt = win.tt && typeof win.tt === "object" ? win.tt : null;
  const origLocalSetSpeed =
    existingTt && typeof existingTt.setSpeed === "function"
      ? existingTt.setSpeed.bind(existingTt)
      : null;
  const origLocalSwitchSeat =
    existingTt && typeof existingTt.switchSeat === "function"
      ? existingTt.switchSeat.bind(existingTt)
      : null;

  let consoleVerbose = true;
  let speedMode: "normal" | "fast" | "instant" = "normal";
  let botBusy = false;
  let activeTaskCount = 0;
  let autoBotTimer: number | null = null;
  let autoBotWaitQueued = false;
  let autoBotConsecutiveErrors = 0;
  let autoBotConsecutiveNoOps = 0;
  let autoBotLastSignature = "";

  function safeSessionGet(key: string): string | null {
    try {
      return typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null;
    } catch (_e) {
      return null;
    }
  }

  function safeSessionSet(key: string, value: string): void {
    try {
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, value);
    } catch (_e) {}
  }

  function safeLocalGet(key: string): string | null {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    } catch (_e) {
      return null;
    }
  }

  function safeLocalSet(key: string, value: string): void {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    } catch (_e) {}
  }

  function resetAutoBotFailures(): void {
    autoBotConsecutiveErrors = 0;
    autoBotConsecutiveNoOps = 0;
  }

  function getAutoBotEnabled(): boolean {
    return safeSessionGet("tichu_autobot") === "1";
  }

  function setAutoBotEnabled(enabled: boolean): void {
    safeSessionSet("tichu_autobot", enabled ? "1" : "0");
    if (enabled) {
      resetAutoBotFailures();
      autoBotLastSignature = "";
    }
  }

  function clearAutoBotTimer(): void {
    if (autoBotTimer !== null) {
      window.clearTimeout(autoBotTimer);
      autoBotTimer = null;
    }
  }

  function getDrawerDefaultOpen(): boolean {
    try {
      const params = new URLSearchParams(window.location.search || "");
      if (params.get("tt") === "1") return true;
    } catch (_e) {}
    try {
      if (window.top && window.top !== window) {
        const topParams = new URLSearchParams(window.top.location.search || "");
        if (topParams.get("tt") === "1") return true;
      }
    } catch (_e) {}
    return safeSessionGet("tichu_tt_drawer") === "1";
  }

  function getActivePlayerIds(ui: any): number[] {
    const gd = ui?.gamedatas;
    const st = gd?.gamestate || {};
    const ids = new Set<number>();
    if (st.type === "activeplayer") {
      if (st.active_player && Number(st.active_player) > 0) {
        ids.add(Number(st.active_player));
      }
    } else if (st.type === "multipleactiveplayer") {
      if (Array.isArray(st.multiactive)) {
        for (let i = 0; i < st.multiactive.length; i++) {
          const id = Number(st.multiactive[i]);
          if (id > 0) ids.add(id);
        }
      }
    } else if (ui?.bga?.players && typeof ui.bga.players.getActivePlayerIds === "function") {
      const list = ui.bga.players.getActivePlayerIds();
      for (let i = 0; i < list.length; i++) {
        const id = Number(list[i]);
        if (id > 0) ids.add(id);
      }
    } else {
      const gmState = win.gameModel?.getState?.();
      if (gmState?.activePlayerId && Number(gmState.activePlayerId) > 0) {
        ids.add(Number(gmState.activePlayerId));
      }
      if (Array.isArray(gmState?.activePlayerIds)) {
        for (let i = 0; i < gmState.activePlayerIds.length; i++) {
          const id = Number(gmState.activePlayerIds[i]);
          if (id > 0) ids.add(id);
        }
      }
    }
    if (typeof ui?.isPlayerActive === "function" && gd?.players) {
      for (const pIdKey of Object.keys(gd.players)) {
        const pId = Number(pIdKey);
        if (pId > 0 && ui.isPlayerActive(pId)) {
          ids.add(pId);
        }
      }
    }
    return Array.from(ids);
  }

  async function performDebugAction(actionName: string, args: Record<string, any> = {}) {
    const ui = getUi();
    if (!ui) throw new Error("window.gameui is not initialized");
    if (ui.bga && ui.bga.actions && typeof ui.bga.actions.performAction === "function") {
      await ui.bga.actions.performAction(actionName, args, {
        checkAction: false,
        lock: false,
      });
      return;
    }
    if (typeof ui.ajaxcall === "function") {
      await new Promise<void>((resolve, reject) => {
        ui.ajaxcall(
          `/tichu/tichu/${actionName}.html`,
          { ...args },
          ui,
          () => resolve(),
          (isErr: boolean, msg?: string) => {
            if (isErr) reject(new Error(msg || `${actionName} failed`));
            else resolve();
          },
        );
      });
      return;
    }
    throw new Error("Neither ui.bga.actions.performAction nor ui.ajaxcall is available");
  }

  function getAutoBotProgressSignature(ui: any): string {
    const gd = ui?.gamedatas || {};
    const st = gd.gamestate || {};
    const activeIds = getActivePlayerIds(ui)
      .slice()
      .sort((a, b) => a - b)
      .join(",");
    const lastPacketId = Number(
      ui?.notifqueue?.last_packet_id ?? gd.notifications?.last_packet_id ?? 0,
    );
    return [
      lastPacketId,
      Number(st.id || 0),
      String(st.name || ""),
      activeIds,
      Number(gd.round || 0),
      Number(gd.trick || 0),
    ].join("|");
  }

  function disableAutoBotOnFailure(reason: string): void {
    setAutoBotEnabled(false);
    clearAutoBotTimer();
    resetAutoBotFailures();
    (win.tt || tt).refreshBar?.();
    const ui = getUi();
    if (typeof ui?.showMessage === "function") {
      ui.showMessage(reason, "error");
    }
    logAnnounce("[TICHU AUTOBOT]", reason, "#ff7b72");
  }

  function scheduleAutoBot(): void {
    clearAutoBotTimer();
    if (!getAutoBotEnabled()) return;
    if (botBusy || autoPlayCtrl.running || activeTaskCount > 0) return;

    const ui = getUi();
    if (!ui || !ui.gamedatas || ui.isSpectator) return;

    const st = ui.gamedatas.gamestate;
    if (!st || st.name === "gameEnd" || Number(st.id) === 99) return;

    if (isQueueBusy()) {
      if (!autoBotWaitQueued) {
        autoBotWaitQueued = true;
        void waitUntilIdle(15000, 30).then(() => {
          autoBotWaitQueued = false;
          scheduleAutoBot();
        });
      }
      return;
    }

    const sig = getAutoBotProgressSignature(ui);
    if (sig !== autoBotLastSignature) {
      autoBotLastSignature = sig;
      resetAutoBotFailures();
    }

    const activeIds = getActivePlayerIds(ui);
    const myId = Number(ui.player_id);
    const otherActive = activeIds.some((id) => id > 0 && id !== myId);
    if (!otherActive) return;

    const retryCount = Math.max(autoBotConsecutiveErrors, autoBotConsecutiveNoOps);
    if (retryCount >= 3) {
      disableAutoBotOnFailure(
        `Auto-Bot stopped after ${retryCount} consecutive failures or no-op retries.`,
      );
      return;
    }

    const isConfirmTrick = st.name === "confirmTrick";
    const isRealtime = Boolean(
      ui.bRealtime !== undefined ? ui.bRealtime : win.gameModel?.getState?.()?.isRealtime,
    );
    const baseDelayMs = isConfirmTrick && isRealtime ? 2000 : 300;
    const delayMs = baseDelayMs * Math.pow(2, retryCount);

    autoBotTimer = window.setTimeout(async () => {
      autoBotTimer = null;
      if (!getAutoBotEnabled()) return;
      if (botBusy || autoPlayCtrl.running || activeTaskCount > 0) return;
      if (isQueueBusy()) {
        scheduleAutoBot();
        return;
      }
      const curUi = getUi();
      const curSt = curUi?.gamedatas?.gamestate;
      if (!curUi || !curSt || curSt.name === "gameEnd" || Number(curSt.id) === 99) return;
      if (curUi.isSpectator) return;
      const curActiveIds = getActivePlayerIds(curUi);
      const curMyId = Number(curUi.player_id);
      if (!curActiveIds.some((id) => id > 0 && id !== curMyId)) return;

      const sigBefore = getAutoBotProgressSignature(curUi);
      try {
        const curTt = win.tt || tt;
        await curTt.actForOthers();
        const afterUi = getUi();
        const afterSt = afterUi?.gamedatas?.gamestate;
        if (!afterUi || !afterSt || afterSt.name === "gameEnd" || Number(afterSt.id) === 99) {
          resetAutoBotFailures();
          return;
        }
        const sigAfter = getAutoBotProgressSignature(afterUi);
        const afterActiveIds = getActivePlayerIds(afterUi);
        const afterMyId = Number(afterUi.player_id);
        const stillOtherActive = afterActiveIds.some((id) => id > 0 && id !== afterMyId);
        if (sigAfter !== sigBefore) {
          autoBotLastSignature = sigAfter;
          resetAutoBotFailures();
        } else if (stillOtherActive) {
          autoBotConsecutiveNoOps++;
          if (autoBotConsecutiveNoOps >= 3) {
            disableAutoBotOnFailure(
              "Auto-Bot stopped: game state made no progress after 3 attempts.",
            );
            return;
          }
        } else {
          resetAutoBotFailures();
        }
      } catch (err: any) {
        autoBotConsecutiveErrors++;
        if (autoBotConsecutiveErrors >= 3) {
          disableAutoBotOnFailure(
            `Auto-Bot stopped after 3 consecutive errors: ${err?.message || String(err)}`,
          );
          return;
        }
      } finally {
        if (getAutoBotEnabled()) {
          scheduleAutoBot();
        }
      }
    }, delayMs);
  }

  const cornerCases = {
    grandTichuBets: 0,
    tichuBets: 0,
    resetPassTested: false,
    dogLeads: 0,
    mahjongLeads: 0,
    multiCardLeads: 0,
    wishesMade: 0,
    wishesFulfilled: 0,
    partnerPasses: 0,
    phoenixAmbiguousPlays: 0,
    phoenixCancelTested: false,
    bombsPlayed: 0,
    bombCancelTested: false,
    dragonGifts: 0,
  };
  let passedOppRanksRound = -1;
  let passedOppRanks: number[] = [];
  let lastCanceledBombSig = "";
  const lastGrandTichuBetRoundByPlayer: Record<number, number> = {};
  const lastGiveCardsRoundByPlayer: Record<number, number> = {};

  interface ConsoleIssue {
    ts: string;
    level: "error" | "warn";
    source: string;
    message: string;
  }

  const consoleIssues: ConsoleIssue[] = [];
  const actionErrorLog: Array<{ ts: string; url: string; state: string; error: string }> = [];

  function formatConsoleArg(arg: any): string {
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) return arg.stack || arg.message || String(arg);
    if (arg === null || arg === undefined) return String(arg);
    try {
      return JSON.stringify(arg);
    } catch (_e) {
      return String(arg);
    }
  }

  function recordConsoleIssue(level: "error" | "warn", source: string, args: any[]) {
    const message = args.map(formatConsoleArg).join(" ").replace(/%c/g, "").trim();
    if (!message) return;
    // Ignore BGA Studio's benign cancelled background wakeup XHR when state changes mid-request
    if (/wakeup\.html/i.test(message) && /(?:HTTP code 0|status:\s*0)/i.test(message)) return;
    if (consoleIssues.length >= 200) {
      consoleIssues.shift();
    }
    consoleIssues.push({
      ts: new Date().toISOString(),
      level,
      source,
      message,
    });
  }

  function hookWindowConsole(targetWin: any, prefix: string) {
    if (!targetWin || targetWin.__tichuConsoleWatched) return;
    targetWin.__tichuConsoleWatched = true;
    try {
      const origErr = targetWin.console?.error;
      if (typeof origErr === "function") {
        targetWin.console.error = function (...args: any[]) {
          recordConsoleIssue("error", `${prefix}.console.error`, args);
          return origErr.apply(this, args);
        };
      }
      const origWarn = targetWin.console?.warn;
      if (typeof origWarn === "function") {
        targetWin.console.warn = function (...args: any[]) {
          recordConsoleIssue("warn", `${prefix}.console.warn`, args);
          return origWarn.apply(this, args);
        };
      }
      const origLog = targetWin.console?.log;
      if (typeof origLog === "function") {
        targetWin.console.log = function (...args: any[]) {
          if (args.some((a) => typeof a === "string" && a.indexOf("[TICHU ERROR]") !== -1)) {
            recordConsoleIssue("error", `${prefix}.console.log`, args);
          }
          return origLog.apply(this, args);
        };
      }
      targetWin.addEventListener("error", (ev: any) => {
        const msg = ev?.error ? formatConsoleArg(ev.error) : ev?.message || "Unknown window error";
        recordConsoleIssue("error", `${prefix}.window.error`, [msg]);
      });
      targetWin.addEventListener("unhandledrejection", (ev: any) => {
        recordConsoleIssue("error", `${prefix}.unhandledrejection`, [ev?.reason ?? "Rejection"]);
      });
    } catch (_e) {
      // Ignore cross-origin frame access errors
    }
  }

  hookWindowConsole(win, isLocalHost ? "local" : "iframe");
  try {
    if (window.parent && window.parent !== window) {
      hookWindowConsole(window.parent, "parent");
    }
  } catch (_e) {}

  function logAnnounce(tag: string, msg: string, color = "#58a6ff") {
    if (!consoleVerbose) return;
    try {
      window.console.log(`%c${tag}%c ${msg}`, `font-weight:bold;color:${color}`, "");
    } catch (_e) {
      window.console.log(`${tag} ${msg}`);
    }
  }

  function getUi(): any {
    return (window as any).gameui || gameuiInstance;
  }

  async function postLocalAbort(reason: string, details: any) {
    if (!isLocalHost) {
      const tid = Number(getUi()?.table_id || 0);
      if (tid) {
        try {
          localStorage.setItem(
            `tichu_studio_abort_${tid}`,
            JSON.stringify({
              playerId: Number(getUi()?.player_id || 0),
              reason,
              timestamp: Date.now(),
            }),
          );
        } catch (_e) {}
      }
      return;
    }
    try {
      await fetch("/local/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: Number(getUi()?.player_id || 0),
          reason,
          details,
          timestamp: Date.now(),
        }),
      });
    } catch (_e) {}
  }

  function isConfirmTichuVisible(): boolean {
    const confirmBtn = document.getElementById("confirmTichu");
    return Boolean(
      confirmBtn &&
      confirmBtn.offsetParent !== null &&
      !confirmBtn.classList.contains("hide") &&
      confirmBtn.style.display !== "none",
    );
  }

  function getConfirmTichuBetValue(): number {
    const confirmBtn = document.getElementById("confirmTichu");
    if (confirmBtn?.getAttribute("data-grand") === "1") return 200;
    if (confirmBtn?.getAttribute("data-grand") === "0") return 100;
    const stName = getUi()?.gamedatas?.gamestate?.name;
    return stName === "grandTichuBets" ? 200 : 100;
  }

  function getSortedPlayers(): any[] {
    const ui = getUi();
    const gd = (ui && ui.gamedatas) || {};
    return Object.values(gd.players || {}).sort((a: any, b: any) => Number(a.no) - Number(b.no));
  }

  function formatPlayerTag(playerId: any): string {
    if (!playerId || Number(playerId) === 0) return "Spectator";
    const players = getSortedPlayers();
    const idx = players.findIndex((p: any) => Number(p.id) === Number(playerId));
    if (idx === -1) return `P?(${playerId})`;
    const p = players[idx];
    return `P${idx}:${p.name}`;
  }

  function resolvePlayerId(seatOrPlayerId?: any): number {
    const ui = getUi();
    const players = getSortedPlayers();
    if (seatOrPlayerId === undefined || seatOrPlayerId === null) {
      return ui ? (ui.isSpectator ? 0 : Number(ui.player_id)) : 0;
    }
    const rawStr = String(seatOrPlayerId).trim().toLowerCase();
    const pMatch = rawStr.match(/^p([0-3])$/);
    if (pMatch) {
      const idx = Number(pMatch[1]);
      return players[idx] ? Number(players[idx].id) : 0;
    }
    const num = Number(rawStr);
    if (!isNaN(num) && Math.floor(num) === num) {
      if (num >= 0 && num <= 3 && players[num]) {
        return Number(players[num].id);
      }
      if (num >= 1 && num <= 4 && players[num - 1] && !players.some((p) => Number(p.id) === num)) {
        return Number(players[num - 1].id);
      }
      const exact = players.find((p) => Number(p.id) === num);
      if (exact) return Number(exact.id);
    }
    const byName = players.find((p) => String(p.name || "").toLowerCase() === rawStr);
    if (byName) return Number(byName.id);
    throw new Error(
      `Unknown seat or player "${seatOrPlayerId}". Expected 0..3, "P0".."P3", player name, or player ID.`,
    );
  }

  function getQueueBusyFlags(ui: any) {
    const actionsRunning = Number(
      (ui.bga && ui.bga.actions && ui.bga.actions.ajaxcall_running) || 0,
    );
    const sitecoreRunning = Number(
      ((window as any).g_sitecore && (window as any).g_sitecore.ajaxcall_running) || 0,
    );
    const uiAjaxRunning = Number(ui.ajaxcall_running || 0);
    const ifaceLocked = Boolean(
      typeof ui.isInterfaceLocked === "function" && ui.isInterfaceLocked(),
    );
    const ajaxBusy = Number(ui._ajaxInFlight || 0) > 0;
    const nq = ui.notifqueue;
    const qLen = nq && Array.isArray(nq.queue) ? nq.queue.length : 0;
    const waitingSync = Boolean(
      nq &&
      ((nq.waiting_from_notifend !== null && nq.waiting_from_notifend !== undefined) ||
        nq.isProcessing),
    );
    const resyncing = Boolean(nq && nq.notificationResendInProgress);
    return {
      actionsRunning,
      sitecoreRunning,
      uiAjaxRunning,
      ifaceLocked,
      ajaxBusy,
      qLen,
      waitingSync,
      resyncing,
    };
  }

  function repairOrphanedInterfaceLock(): void {
    const ui = getUi();
    if (!ui) return;
    const f = getQueueBusyFlags(ui);
    if (
      f.ifaceLocked &&
      f.actionsRunning === 0 &&
      f.sitecoreRunning === 0 &&
      f.uiAjaxRunning === 0 &&
      !f.ajaxBusy &&
      f.qLen === 0 &&
      !f.waitingSync &&
      !f.resyncing &&
      (ui.interface_status === "queued" || ui.interface_status === "dispatched") &&
      ui.interface_locked_by_id
    ) {
      const lockUuid = ui.interface_locked_by_id;
      const dj = typeof dojo !== "undefined" ? dojo : (window as any).dojo;
      if (dj && typeof dj.publish === "function") {
        dj.publish("lockInterface", [{ status: "updated", uuid: lockUuid, bIsTableMsg: true }]);
      }
      if (
        typeof ui.isInterfaceLocked === "function" &&
        ui.isInterfaceLocked() &&
        typeof ui.unlockInterface === "function"
      ) {
        ui.unlockInterface(lockUuid);
      }
    }
  }

  function isQueueBusy(): boolean {
    const ui = getUi();
    if (!ui) return false;
    const f = getQueueBusyFlags(ui);
    return Boolean(
      f.actionsRunning > 0 ||
      f.sitecoreRunning > 0 ||
      f.uiAjaxRunning > 0 ||
      f.ifaceLocked ||
      f.ajaxBusy ||
      f.qLen > 0 ||
      f.waitingSync ||
      f.resyncing,
    );
  }

  async function withStudioActionLock<T>(
    tableId: number,
    ownerId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (isLocalHost || !tableId) {
      return fn();
    }
    const lockKey = `tichu_studio_action_lock_${tableId}`;
    const cooldownKey = `tichu_studio_action_cooldown_${tableId}`;
    const lockTtlMs = 8000;
    const maxWaitMs = 12000;
    const cooldownMs = 400;
    const waitStart = Date.now();
    let acquired = false;
    let waitedForContention = false;

    while (Date.now() - waitStart < maxWaitMs) {
      try {
        const now = Date.now();
        const cooldownUntil = Number(localStorage.getItem(cooldownKey) || 0);
        if (cooldownUntil > now) {
          waitedForContention = true;
          await new Promise((r) => setTimeout(r, Math.min(80, cooldownUntil - now)));
          continue;
        }
        const existingRaw = localStorage.getItem(lockKey);
        if (existingRaw) {
          const parsed = JSON.parse(existingRaw);
          if (parsed && Number(parsed.expiresAt || 0) > now && parsed.owner !== ownerId) {
            waitedForContention = true;
            await new Promise((r) => setTimeout(r, 40 + Math.floor(Math.random() * 50)));
            continue;
          }
        }
        localStorage.setItem(
          lockKey,
          JSON.stringify({ owner: ownerId, expiresAt: Date.now() + lockTtlMs }),
        );
        await new Promise((r) => setTimeout(r, 15));
        const confirmRaw = localStorage.getItem(lockKey);
        const confirmParsed = confirmRaw ? JSON.parse(confirmRaw) : null;
        if (confirmParsed && confirmParsed.owner === ownerId) {
          acquired = true;
          break;
        }
      } catch (_e) {
        break;
      }
      waitedForContention = true;
      await new Promise((r) => setTimeout(r, 30 + Math.floor(Math.random() * 40)));
    }

    try {
      if (waitedForContention) {
        await new Promise((r) => setTimeout(r, 150));
        await waitUntilIdle(3000, 30);
      }
      return await fn();
    } finally {
      if (acquired) {
        try {
          localStorage.setItem(cooldownKey, String(Date.now() + cooldownMs));
          const curRaw = localStorage.getItem(lockKey);
          if (curRaw) {
            const cur = JSON.parse(curRaw);
            if (cur && cur.owner === ownerId) {
              localStorage.removeItem(lockKey);
            }
          }
        } catch (_e) {}
      }
    }
  }

  function nextMicrotaskTick(): Promise<void> {
    return Promise.resolve().then(() => Promise.resolve());
  }

  async function waitLitUpdates(): Promise<void> {
    await nextMicrotaskTick();
    try {
      const parentEls = queryDeepAll(
        "tichu-hand, tichu-status, tichu-player-panel, tichu-last-played, tichu-pass-area, tichu-action-bar",
      );
      const p1: Promise<any>[] = [];
      for (let i = 0; i < parentEls.length; i++) {
        const uc = (parentEls[i] as any)?.updateComplete;
        if (uc && typeof uc.then === "function") p1.push(uc);
      }
      if (p1.length > 0) await Promise.all(p1);
      const childEls = queryDeepAll("tichu-stock, tichu-card");
      const p2: Promise<any>[] = [];
      for (let i = 0; i < childEls.length; i++) {
        const uc = (childEls[i] as any)?.updateComplete;
        if (uc && typeof uc.then === "function") p2.push(uc);
      }
      if (p2.length > 0) await Promise.all(p2);
    } catch (_e) {}
    await nextMicrotaskTick();
  }

  async function waitUntilIdle(timeoutMs = 15000, settleMs = 50): Promise<void> {
    repairOrphanedInterfaceLock();
    if (speedMode === "instant" && !isQueueBusy()) {
      await nextMicrotaskTick();
      repairOrphanedInterfaceLock();
      if (!isQueueBusy()) return;
    }
    return new Promise((resolve) => {
      const start = Date.now();
      let idleSince: number | null = null;

      const check = () => {
        if (Date.now() - start >= timeoutMs) {
          resolve();
          return;
        }
        repairOrphanedInterfaceLock();
        if (isQueueBusy()) {
          idleSince = null;
          setTimeout(check, 12);
          return;
        }
        if (idleSince === null) {
          idleSince = Date.now();
        }
        if (Date.now() - idleSince >= settleMs) {
          resolve();
          return;
        }
        setTimeout(check, 12);
      };
      setTimeout(check, 12);
    });
  }

  function dismissDialogsIfInstant() {
    if (speedMode !== "instant") return;
    try {
      const dojoObj = (window as any).dojo;
      if (dojoObj && typeof dojoObj.query === "function") {
        dojoObj.query(".dijitDialog, .dijitDialogUnderlayWrapper").forEach(dojoObj.destroy);
      }
    } catch (_e) {}
  }

  function querySingleDeepAll<T extends Element = Element>(
    selector: string,
    root: Document | Element | ShadowRoot = document,
  ): T[] {
    const results: T[] = [];
    if ((root as Document).querySelectorAll) {
      results.push(...(Array.from((root as Document).querySelectorAll(selector)) as T[]));
    }
    if ((root as Element).shadowRoot) {
      results.push(...querySingleDeepAll<T>(selector, (root as Element).shadowRoot!));
    }
    const allElements = (root as Document).querySelectorAll
      ? (root as Document).querySelectorAll("*")
      : [];
    for (let i = 0; i < allElements.length; i++) {
      const node = allElements[i] as Element;
      if (node && node.shadowRoot) {
        results.push(...querySingleDeepAll<T>(selector, node.shadowRoot));
      }
    }
    return results;
  }

  function queryDeepAll<T extends Element = Element>(
    selector: string,
    root: Document | Element | ShadowRoot = document,
  ): T[] {
    if (!selector) return [];
    const results: T[] = [];
    const seen = new Set<Element>();
    const addUnique = (items: T[]) => {
      for (let i = 0; i < items.length; i++) {
        const el = items[i]!;
        if (!seen.has(el)) {
          seen.add(el);
          results.push(el);
        }
      }
    };

    const parts = selector
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (let p = 0; p < parts.length; p++) {
      const part = parts[p]!;
      const direct = querySingleDeepAll<T>(part, root);
      if (direct.length > 0) {
        addUnique(direct);
        continue;
      }
      const segments = part
        .replace(/(\\[0-9a-fA-F]{1,6})\s/g, "$1\x00")
        .split(/\s+/)
        .map((s) => s.replace(/\x00/g, " "))
        .filter(Boolean);
      if (segments.length > 1) {
        let currentRoots: (Document | Element | ShadowRoot)[] = [root];
        for (let s = 0; s < segments.length; s++) {
          const seg = segments[s]!;
          const nextRoots: Element[] = [];
          const nextSeen = new Set<Element>();
          for (let r = 0; r < currentRoots.length; r++) {
            const matches = querySingleDeepAll<Element>(seg, currentRoots[r]!);
            for (let m = 0; m < matches.length; m++) {
              const matchEl = matches[m]!;
              if (!nextSeen.has(matchEl)) {
                nextSeen.add(matchEl);
                nextRoots.push(matchEl);
              }
            }
          }
          currentRoots = nextRoots;
          if (currentRoots.length === 0) break;
        }
        addUnique(currentRoots as T[]);
      }
    }
    return results;
  }

  function queryDeep<T extends Element = Element>(
    selector: string,
    root: Document | Element | ShadowRoot = document,
  ): T | null {
    const all = queryDeepAll<T>(selector, root);
    return all[0] || null;
  }

  function getElementByIdDeep(
    id: string,
    root: Document | Element | ShadowRoot = document,
  ): HTMLElement | null {
    if ((root as Document).getElementById) {
      const el = (root as Document).getElementById(id);
      if (el) return el;
    }
    return queryDeep<HTMLElement>(`#${CSS.escape(id)}`, root);
  }

  const tt = {
    help() {
      const rows = [
        { Command: "tt.help()", Description: "Show BGA Studio console command cheat-sheet" },
        {
          Command: "tt.status()",
          Description: "Inspect current table state, players, hand, trick, and buttons",
        },
        { Command: "tt.hand()", Description: "Inspect viewer's cards in hand with codes & IDs" },
        {
          Command: "tt.assertUI()",
          Description: "Verify live BGA Studio DOM matches gamedatas invariants",
        },
        {
          Command: "tt.setSpeed('instant'|'normal')",
          Description: "Toggle instantaneousMode (1ms notification queue)",
        },
        {
          Command: "await tt.betGrandTichu(0|200, seat?)",
          Description: "Place Grand Tichu bet for seat (via testuser)",
        },
        {
          Command: "await tt.betAllGrandTichu([0,0,0,0])",
          Description: "Place Grand Tichu bets for all multiactive players in 1 tab",
        },
        {
          Command: "await tt.giveCards(cards?)",
          Description: "Select & pass 3 cards from viewer's hand",
        },
        {
          Command: "await tt.passAllCards(cards?)",
          Description: "Pass 3 cards for viewer + step bots for the other 3 players",
        },
        { Command: "await tt.play(cards?)", Description: "Select & play combo from viewer's hand" },
        {
          Command: "await tt.pass(onlyOnce=true, seat?)",
          Description: "Pass turn (or set auto-pass) for seat",
        },
        {
          Command: "await tt.collect(seat?)",
          Description: "Immediately collect won trick in confirmTrick state",
        },
        {
          Command: "await tt.wish(rank=15, seat?)",
          Description: "Make a Mahjong wish (2..14 or 15='none')",
        },
        {
          Command: "await tt.choosePhoenix(rank?, seat?)",
          Description: "Choose ambiguous Phoenix rank",
        },
        {
          Command: "await tt.giveDragon(0|1, seat?)",
          Description: "Gift Dragon trick to opponent 0 or 1",
        },
        {
          Command: "await tt.step(moves=1)",
          Description:
            "Execute 1 rule-compliant bot move (debug_botStep), or N batch moves on Studio (debug_bgaPlayMoves)",
        },
        {
          Command: "await tt.actForOthers()",
          Description: "Have rule-compliant bots (debug_botOthers) act for other players",
        },
        {
          Command: "await tt.runSmokeTest(opts?)",
          Description:
            "Run full zero-click Studio smoke test (Grand Tichu + Pass + Tricks + UI assertions)",
        },
        {
          Command: "await tt.runRound(opts?)",
          Description: "Play a full round to completion on Studio and assert UI",
        },
        {
          Command: "await tt.runGame(opts?)",
          Description: "Fast-forward entire game to gameEnd (state 99) on Studio",
        },
        {
          Command: "await tt.actMyTurn()",
          Description: "Play 1 legal move strictly for this tab's player (zero zombie turns)",
        },
        {
          Command: "await tt.startAutoPlayMe(opts?)",
          Description: "Auto-play this tab's player until gameEnd while watching console",
        },
        {
          Command: "tt.getConsoleIssues()",
          Description: "List all captured console errors/warnings and breadcrumb warnings",
        },
      ];
      window.console.table(rows);
      return rows;
    },

    setVerbose(enabled = true) {
      consoleVerbose = Boolean(enabled);
      return consoleVerbose;
    },

    setSpeed(mode: "normal" | "fast" | "instant" = "instant") {
      const ui = getUi();
      speedMode = mode;
      (window as any).__tichuSpeed = mode;
      if (mode === "instant") {
        (document.querySelector("tichu-animation-layer") as any)?.cancelAll?.();
      }
      if (origLocalSetSpeed && origLocalSetSpeed !== tt.setSpeed) {
        origLocalSetSpeed(mode);
      }
      if (ui) {
        ui.instantaneousMode = mode === "instant" || mode === "fast";
        const nq = ui.notifqueue;
        if (nq) {
          if (!nq._origSynchronousNotifs && nq.synchronous_notifs) {
            nq._origSynchronousNotifs = { ...nq.synchronous_notifs };
            nq._origSetSynchronousDuration = nq.setSynchronousDuration;
          }
          if (mode === "instant") {
            nq.synchronous_notifs = {};
            nq.setSynchronousDuration = function () {};
          } else if (nq._origSynchronousNotifs) {
            nq.synchronous_notifs = { ...nq._origSynchronousNotifs };
            if (nq._origSetSynchronousDuration) {
              nq.setSynchronousDuration = nq._origSetSynchronousDuration;
            }
          }
        }
      }
      logAnnounce(
        "[TICHU STUDIO SPEED]",
        `Speed mode="${mode}" (instantaneousMode=${Boolean(ui && ui.instantaneousMode)})`,
      );
      return speedMode;
    },

    waitUntilIdle,

    state(logToConsole = true) {
      return tt.status(logToConsole);
    },

    status(logToConsole = true) {
      const ui = getUi();
      if (!ui || !ui.gamedatas) return null;
      const gd = ui.gamedatas;
      const st = gd.gamestate || {};
      const sortedPlayers = getSortedPlayers();

      const players = sortedPlayers.map((p: any, idx: number) => {
        const pId = Number(p.id);
        const hcEl = queryDeep(`.handcount.${CSS.escape(String(pId))}`);
        const ptEl = getElementByIdDeep(`pointcount_${pId}`);
        const scoreEl = getElementByIdDeep(`player_score_${pId}`);
        const activeIds: number[] =
          ui.bga && ui.bga.players && typeof ui.bga.players.getActivePlayerIds === "function"
            ? ui.bga.players.getActivePlayerIds().map(Number)
            : typeof ui.isPlayerActive === "function" && ui.isPlayerActive(pId)
              ? [pId]
              : [];
        return {
          seat: idx,
          no: Number(p.no),
          id: pId,
          name: p.name,
          team: Number(p.team ?? idx % 2),
          handCount: hcEl
            ? parseInt(hcEl.textContent || "0", 10)
            : Number((gd.handcount && gd.handcount[pId]) ?? 0),
          capturedPoints: ptEl
            ? parseInt(ptEl.textContent || "0", 10)
            : Number((gd.capturedpoints && gd.capturedpoints[pId]) ?? 0),
          score: scoreEl ? parseInt(scoreEl.textContent || "0", 10) : Number(p.score ?? 0),
          grandTichu: Number(p.call_grand_tichu),
          tichu: Number(p.call_tichu),
          autopass: Number(p.pass || 0),
          isActive: activeIds.indexOf(pId) !== -1,
        };
      });

      const hand = (gd.hand || []).map((c: any) => ({
        id: String(c.id),
        code: formatCardCode(c),
        pretty: formatCardPretty(c, false),
        type: Number(c.type),
        type_arg: Number(c.type_arg),
      }));

      const buttons: { id: string; label: string }[] = [];
      const btnNodes = queryDeepAll(
        "#generalactions .bgabutton, #buttons .bgabutton, #buttons .action-button",
      );
      for (let i = 0; i < btnNodes.length; i++) {
        const node = btnNodes[i] as HTMLElement;
        if (!node || node.classList.contains("hide") || node.style.display === "none") continue;
        buttons.push({
          id: node.id || "btn",
          label: (node.textContent || "").trim(),
        });
      }

      const summary = {
        tableId: Number(ui.table_id || 0),
        state: {
          id: Number(st.id || 0),
          name: st.name || "",
          type: st.type || "",
          possibleactions: st.possibleactions || [],
        },
        viewer: ui.isSpectator ? "spectator" : formatPlayerTag(ui.player_id),
        viewerId: ui.isSpectator ? 0 : Number(ui.player_id),
        isMyTurn: Boolean(
          typeof ui.isCurrentPlayerActive === "function" && ui.isCurrentPlayerActive(),
        ),
        activePlayer: st.active_player ? formatPlayerTag(st.active_player) : null,
        activePlayerId: st.active_player ? Number(st.active_player) : null,
        multiactive: Array.isArray(st.multiactive)
          ? st.multiactive.map((id: any) => formatPlayerTag(id))
          : [],
        multiactiveIds: Array.isArray(st.multiactive)
          ? st.multiactive.map((id: any) => Number(id))
          : [],
        round: Number(gd.round || 0),
        trick: Number(gd.trick || 0),
        trickPoints: Number(gd.currentTrickValue || 0),
        mahjongWish: Number(gd.mahjongWish || 0),
        firstOutPlayer: Number(gd.firstoutplayer || 0),
        players,
        hand,
        handCodes: hand.map((c: any) => c.code),
        buttons,
        consoleIssueCount: tt.getConsoleIssues().length,
        consoleIssues: tt.getConsoleIssues(),
      };

      if (logToConsole) {
        logAnnounce(
          "[TICHU STUDIO STATE]",
          `Table #${summary.tableId} | State=${summary.state.name}(#${summary.state.id}) | Round=${summary.round} Trick=${summary.trick} (${summary.trickPoints} pts) | Active=${summary.activePlayer || summary.multiactive.join(",") || "-"}`,
        );
      }
      return summary;
    },

    hand() {
      const ui = getUi();
      const cards = ((ui && ui.gamedatas && ui.gamedatas.hand) || []).map((c: any) => ({
        id: String(c.id),
        code: formatCardCode(c),
        pretty: formatCardPretty(c, true),
        suit: Number(c.type),
        rank: Number(c.type_arg),
      }));
      logAnnounce(
        "[TICHU STUDIO HAND]",
        `${formatPlayerTag(ui && ui.player_id)} (${cards.length} cards): [${cards.map((c: any) => `${c.code}(#${c.id})`).join(", ")}]`,
        "#3fb950",
      );
      return cards;
    },

    assertUI() {
      const ui = getUi();
      if (!ui || !ui.gamedatas) {
        throw new Error("[ASSERT_UI FAILED] window.gameui or gamedatas is missing");
      }
      const gd = ui.gamedatas;
      const st = gd.gamestate || {};
      const stateName = st.name || "";

      const overall = document.getElementById("overall-content");
      if (!overall) {
        throw new Error("[ASSERT_UI FAILED] #overall-content element missing from DOM");
      }
      if (
        isLocalHost &&
        stateName &&
        overall.className.indexOf("gamestate_") !== -1 &&
        !overall.classList.contains(`gamestate_${stateName}`)
      ) {
        throw new Error(
          `[ASSERT_UI FAILED] #overall-content classList "${overall.className}" does not contain "gamestate_${stateName}"`,
        );
      }

      const myHandItems = queryDeepAll("#myhand .stockitem:not(.to_be_destroyed)");
      if (!ui.isSpectator && stateName !== "endRound" && stateName !== "newRound") {
        const legacyStaged = Array.isArray(ui.cardsToPass)
          ? ui.cardsToPass.filter(Boolean).length
          : 0;
        const gmState = (window as any).gameModel?.getState?.();
        const modelStaged = Array.isArray(gmState?.passSlots)
          ? gmState.passSlots.filter((s: any) => s && s.givenCard).length
          : 0;
        const stagedPassCount = Math.max(legacyStaged, modelStaged);
        const expectedHandDom =
          gmState && Array.isArray(gmState.hand)
            ? gmState.hand.length
            : Math.max(0, (gd.hand || []).length - stagedPassCount);
        if (myHandItems.length !== expectedHandDom) {
          throw new Error(
            `[ASSERT_UI FAILED] #myhand .stockitem count (${myHandItems.length}) !== expected hand size (${expectedHandDom}, gamedatas.hand=${(gd.hand || []).length}, staged=${stagedPassCount})`,
          );
        }
      }

      const statusEl = queryDeep("#game_play_area_wrap tichu-status") || queryDeep("tichu-status");
      if (!statusEl) {
        throw new Error("[ASSERT_UI FAILED] <tichu-status> element missing from DOM");
      }
      const attrRound = Number(statusEl.getAttribute("roundCount") || (statusEl as any).roundCount);
      const attrTrick = Number(statusEl.getAttribute("trickCount") || (statusEl as any).trickCount);
      const attrPts = Number(statusEl.getAttribute("trickPoints") || (statusEl as any).trickPoints);
      if (attrRound !== Number(gd.round)) {
        throw new Error(
          `[ASSERT_UI FAILED] <tichu-status> roundCount (${attrRound}) !== gamedatas.round (${gd.round})`,
        );
      }
      if (attrTrick !== Number(gd.trick)) {
        throw new Error(
          `[ASSERT_UI FAILED] <tichu-status> trickCount (${attrTrick}) !== gamedatas.trick (${gd.trick})`,
        );
      }
      if (attrPts !== Number(gd.currentTrickValue)) {
        throw new Error(
          `[ASSERT_UI FAILED] <tichu-status> trickPoints (${attrPts}) !== gamedatas.currentTrickValue (${gd.currentTrickValue})`,
        );
      }

      const players = getSortedPlayers();
      for (let i = 0; i < players.length; i++) {
        const pId = Number(players[i].id);
        const hcNodes = queryDeepAll(`.handcount.${CSS.escape(String(pId))}`);
        if (hcNodes.length === 0) {
          throw new Error(`[ASSERT_UI FAILED] Missing .handcount.${pId} elements in DOM`);
        }
        const numVal = parseInt((hcNodes[0]!.textContent || "").trim(), 10);
        if (isNaN(numVal) || numVal < 0 || numVal > 14) {
          throw new Error(
            `[ASSERT_UI FAILED] Invalid handcount "${hcNodes[0]!.textContent}" for player ${pId}`,
          );
        }
        if (
          isLocalHost &&
          !ui.isSpectator &&
          pId === Number(ui.player_id) &&
          stateName !== "endRound" &&
          stateName !== "newRound" &&
          stateName !== "giveCards" &&
          stateName !== "showPassedCards" &&
          stateName !== "acceptPassedCards"
        ) {
          const actualHandLen = (gd.hand || []).length;
          if (numVal !== actualHandLen) {
            throw new Error(
              `[ASSERT_UI FAILED] Viewer .handcount.${pId} (${numVal}) !== gamedatas.hand.length (${actualHandLen})`,
            );
          }
        }
      }

      return {
        ok: true,
        tableId: Number(ui.table_id || 0),
        state: stateName,
        viewer: ui.player_id,
        handDomCount: myHandItems.length,
        round: Number(gd.round),
        trick: Number(gd.trick),
        trickPoints: Number(gd.currentTrickValue),
      };
    },

    async ajax(actionName: string, args: Record<string, any> = {}, seatOrPlayerId?: any) {
      const ui = getUi();
      if (!ui) throw new Error("window.gameui is not initialized");
      const targetPlayerId =
        seatOrPlayerId !== undefined && seatOrPlayerId !== null
          ? resolvePlayerId(seatOrPlayerId)
          : Number(ui.player_id);

      const prevTestUser = ui.forceTestUser;
      if (
        isLocalHost &&
        targetPlayerId &&
        (ui.isSpectator || targetPlayerId !== Number(ui.player_id)) &&
        origLocalSwitchSeat
      ) {
        await origLocalSwitchSeat(targetPlayerId);
      } else if (targetPlayerId && targetPlayerId !== Number(ui.player_id)) {
        ui.forceTestUser = targetPlayerId;
      }

      logAnnounce(
        "[TICHU STUDIO ACTION]",
        `${formatPlayerTag(targetPlayerId)} -> ${actionName} ${JSON.stringify(args)}`,
        "#f0883e",
      );

      const studioTableId = Number(ui.table_id || ui.gamedatas?.table_id || 0);
      const preStateName = String(ui.gamedatas?.gamestate?.name || "");
      const preActivePlayer = String(ui.gamedatas?.gamestate?.active_player || "");
      const turnSensitiveActions = new Set([
        "pass",
        "playCombo",
        "collect",
        "choosePhoenix",
        "cancelPhoenix",
        "makeAWish",
        "chooseDragonGift",
      ]);
      const runAjax = async () => {
        if (
          (typeof ui.isInterfaceLocked === "function" && ui.isInterfaceLocked()) ||
          Number(ui.ajaxcall_running || 0) > 0 ||
          isQueueBusy()
        ) {
          await waitUntilIdle(3000, 30);
        }
        if (
          !isLocalHost &&
          preStateName &&
          ui.gamedatas?.gamestate &&
          turnSensitiveActions.has(actionName)
        ) {
          const curStateName = String(ui.gamedatas.gamestate.name || "");
          const curActivePlayer = String(ui.gamedatas.gamestate.active_player || "");
          if (
            curStateName !== preStateName ||
            (actionName !== "pass" && curActivePlayer !== preActivePlayer) ||
            (actionName === "pass" &&
              preActivePlayer === String(targetPlayerId) &&
              curActivePlayer !== preActivePlayer)
          ) {
            throw new Error("The game changed while your action was being processed");
          }
        }
        await new Promise<void>((resolve, reject) => {
          ui.ajaxcall(
            `/tichu/tichu/${actionName}.html`,
            { ...args, lock: true },
            ui,
            () => resolve(),
            (isErr: boolean, msg?: string) => {
              if (isErr) reject(new Error(msg || `${actionName} failed`));
              else resolve();
            },
          );
        });
      };

      try {
        if (!isLocalHost && studioTableId > 0) {
          const lockOwner = `${targetPlayerId}:${actionName}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
          await withStudioActionLock(studioTableId, lockOwner, runAjax);
        } else {
          await runAjax();
        }
      } finally {
        ui.forceTestUser = prevTestUser;
      }

      await waitUntilIdle(15000, speedMode === "instant" ? 40 : 200);
      dismissDialogsIfInstant();
      return tt.status(false);
    },

    async betGrandTichu(bet = 0, seat?: any) {
      const numBet = bet === (true as any) || Number(bet) === 200 ? 200 : 0;
      return tt.ajax("grandTichuBet", { bet: numBet }, seat);
    },

    async betAllGrandTichu(bets: number[] = [0, 0, 0, 0]) {
      const ui = getUi();
      const players = getSortedPlayers();
      const multi: number[] =
        ui &&
        ui.gamedatas &&
        ui.gamedatas.gamestate &&
        Array.isArray(ui.gamedatas.gamestate.multiactive)
          ? ui.gamedatas.gamestate.multiactive.map(Number)
          : players.map((p) => Number(p.id));

      for (let idx = 0; idx < players.length; idx++) {
        const pId = Number(players[idx].id);
        if (multi.indexOf(pId) === -1) continue;
        const betVal = Number(bets[idx]) === 200 ? 200 : 0;
        await tt.betGrandTichu(betVal, pId);
      }
      await waitUntilIdle(15000, 200);
      return tt.status(false);
    },

    async betTichu(seat?: any) {
      return tt.ajax("tichuBet", { bet: 100 }, seat);
    },

    async confirmTichu(bet = 100, seat?: any) {
      return tt.ajax("confirmTichu", { bet: Number(bet) }, seat);
    },

    async giveCards(cards?: any, seat?: any) {
      const ui = getUi();
      if (isLocalHost && seat !== undefined && seat !== null && origLocalSwitchSeat) {
        const targetId = resolvePlayerId(seat);
        if (ui.isSpectator || targetId !== Number(ui.player_id)) {
          await origLocalSwitchSeat(targetId);
        }
      }
      const gd = ui.gamedatas;

      const gmSlots = (window as any).gameModel?.getState?.()?.passSlots;
      const hasModelStaged = Array.isArray(gmSlots) && gmSlots.some((s: any) => s && s.givenCard);
      const hasLegacyStaged = Array.isArray(ui.cardsToPass) && ui.cardsToPass.some(Boolean);
      if (typeof ui.onResetPassCards === "function" && (hasLegacyStaged || hasModelStaged)) {
        ui.onResetPassCards();
      }

      const chosenCards =
        cards === undefined || cards === null
          ? pickThreeDefaultCardsFromHand(gd.hand)
          : resolveCardsFromHand(cards, gd.hand);

      if (!chosenCards || chosenCards.length !== 3) {
        throw new Error(`giveCards requires 3 cards, got ${chosenCards ? chosenCards.length : 0}`);
      }

      if (ui.playerHand && typeof ui.onGiveCard === "function") {
        for (let i = 0; i < 3; i++) {
          ui.playerHand.unselectAll();
          ui.playerHand.selectItem(String(chosenCards[i]!.id));
          ui.onGiveCard(i);
        }
        for (let i = 0; i < 3; i++) {
          const node = document.getElementById(
            "cardontable_" + ui.player_id + "_" + chosenCards[i]!.id,
          );
          if (node && node.parentNode) node.parentNode.removeChild(node);
        }
        ui.cardsToPass = [];
      }

      const toGiveStr = chosenCards.map((c) => c.id).join(";") + ";";
      try {
        return await tt.ajax("giveTheCards", { cards: toGiveStr }, seat);
      } catch (err) {
        if (typeof ui.onResetPassCards === "function") {
          ui.onResetPassCards();
        }
        throw err;
      }
    },

    async passCards(cards?: any, seat?: any) {
      return tt.giveCards(cards, seat);
    },

    async acceptCards(seat?: any) {
      return tt.ajax("acceptCards", {}, seat);
    },

    async passAllCards(cards?: any) {
      activeTaskCount++;
      clearAutoBotTimer();
      try {
        let cur = tt.status(false)!;
        if (cur.state.name !== "giveCards") {
          return cur;
        }
        if (cur.isMyTurn) {
          cur = (await tt.giveCards(cards))!;
        }
        if (cur.state.name === "giveCards") {
          cur = (await (win.tt || tt).actForOthers())!;
        }
        if (!getUi().instantaneousMode) {
          await new Promise((r) => setTimeout(r, 2100));
        }
        await waitUntilIdle(10000, speedMode === "instant" ? 40 : 150);
        return tt.status(false);
      } finally {
        activeTaskCount--;
      }
    },

    async play(cards?: any, seat?: any) {
      const ui = getUi();
      if (isLocalHost && seat !== undefined && seat !== null && origLocalSwitchSeat) {
        const targetId = resolvePlayerId(seat);
        if (ui.isSpectator || targetId !== Number(ui.player_id)) {
          await origLocalSwitchSeat(targetId);
        }
      }
      const gd = ui.gamedatas;

      const chosenCards =
        cards === undefined || cards === null
          ? pickDefaultPlayCardsFromHand(ui)
          : resolveCardsFromHand(cards, gd.hand);

      if (!chosenCards || chosenCards.length === 0) {
        throw new Error("No cards selected or resolved for tt.play()");
      }

      if (ui.playerHand) {
        ui.playerHand.unselectAll();
        for (let i = 0; i < chosenCards.length; i++) {
          ui.playerHand.selectItem(String(chosenCards[i]!.id));
        }
      }

      const cardIdStr = chosenCards.map((c) => c.id).join(";");
      return tt.ajax("playCombo", { cards: cardIdStr }, seat);
    },

    async pass(onlyOnce = true, seat?: any) {
      const ui = getUi();
      if (ui && ui.playerHand && (seat === undefined || seat === null)) {
        ui.playerHand.unselectAll();
      }
      return tt.ajax("pass", { onlyOnce: Boolean(onlyOnce) }, seat);
    },

    async collect(seat?: any) {
      const ui = getUi();
      clearAutoBotTimer();
      if (ui && ui.autoCollectTimeout) {
        clearTimeout(ui.autoCollectTimeout);
        ui.autoCollectTimeout = null;
      }
      const st = ui && ui.gamedatas && ui.gamedatas.gamestate;
      const targetSeat =
        seat !== undefined && seat !== null
          ? seat
          : st && st.active_player
            ? Number(st.active_player)
            : undefined;
      const isViewerCollect =
        ui && (!targetSeat || Number(resolvePlayerId(targetSeat)) === Number(ui.player_id));
      if (isViewerCollect && ui.collectSent) {
        await waitUntilIdle(5000, 30);
        if (ui.gamedatas?.gamestate?.name !== "confirmTrick") {
          return tt.status(false);
        }
        if (!isQueueBusy()) {
          ui.collectSent = false;
        }
      }
      if (isViewerCollect && ui) {
        ui.collectSent = true;
      }
      try {
        return await tt.ajax("collect", {}, targetSeat);
      } catch (err) {
        if (
          isViewerCollect &&
          ui.gamedatas?.gamestate?.name === "confirmTrick" &&
          typeof ui.isCurrentPlayerActive === "function" &&
          ui.isCurrentPlayerActive()
        ) {
          ui.collectSent = false;
        }
        throw err;
      }
    },

    async wish(rank: any = 15, seat?: any) {
      const ui = getUi();
      const parsedRank = parseRankToken(rank);
      if (!parsedRank || parsedRank < 2 || parsedRank > 15) {
        throw new Error(`Invalid Mahjong wish rank "${rank}". Expected 2..14 or 15 (none).`);
      }
      const st = ui && ui.gamedatas && ui.gamedatas.gamestate;
      const targetSeat =
        seat !== undefined && seat !== null
          ? seat
          : st && st.active_player
            ? Number(st.active_player)
            : undefined;
      return tt.ajax("makeAWish", { wish: parsedRank }, targetSeat);
    },

    async choosePhoenix(rank?: any, seat?: any) {
      const ui = getUi();
      let parsedRank = rank !== undefined ? parseRankToken(rank) : null;
      if (!parsedRank) {
        const allowed = getAllowedPhoenixValues(ui);
        if (allowed.length > 0) {
          parsedRank = allowed[0]!;
        }
      }
      if (!parsedRank) {
        throw new Error(`Invalid Phoenix value "${rank}"`);
      }
      const st = ui && ui.gamedatas && ui.gamedatas.gamestate;
      const targetSeat =
        seat !== undefined && seat !== null
          ? seat
          : st && st.active_player
            ? Number(st.active_player)
            : undefined;
      return tt.ajax("choosePhoenix", { phoenixValue: parsedRank }, targetSeat);
    },

    async cancelPhoenix(seat?: any) {
      const ui = getUi();
      const st = ui && ui.gamedatas && ui.gamedatas.gamestate;
      const targetSeat =
        seat !== undefined && seat !== null
          ? seat
          : st && st.active_player
            ? Number(st.active_player)
            : undefined;
      return tt.ajax("cancelPhoenix", {}, targetSeat);
    },

    async giveDragon(enemyIndex = 0, seat?: any) {
      const ui = getUi();
      const st = ui && ui.gamedatas && ui.gamedatas.gamestate;
      const targetSeat =
        seat !== undefined && seat !== null
          ? seat
          : st && st.active_player
            ? Number(st.active_player)
            : undefined;
      return tt.ajax("chooseDragonGift", { player: Number(enemyIndex) }, targetSeat);
    },

    async bomb(cards?: any, seat?: any) {
      const ui = getUi();
      if (isLocalHost && seat !== undefined && seat !== null && origLocalSwitchSeat) {
        const targetId = resolvePlayerId(seat);
        if (ui.isSpectator || targetId !== Number(ui.player_id)) {
          await origLocalSwitchSeat(targetId);
        }
      }
      const curState = ui.gamedatas && ui.gamedatas.gamestate && ui.gamedatas.gamestate.name;
      if (curState !== "playBomb") {
        await tt.ajax("playBomb", { cards: "" }, seat);
        if (cards === undefined || cards === null) {
          return tt.status(false);
        }
      }
      return tt.play(cards, seat);
    },

    async cancelBomb(seat?: any) {
      return tt.ajax("cancel", {}, seat);
    },

    async step(moves = 1) {
      const ui = getUi();
      clearAutoBotTimer();
      const st = ui?.gamedatas?.gamestate;
      if (st?.name !== "confirmTrick" || !ui?.isCurrentPlayerActive?.()) {
        clearTimeout(ui?.autoCollectTimeout);
      }
      const count = Math.max(1, Math.floor(Number(moves) || 1));
      botBusy = true;
      (win.tt || tt).refreshBar?.();
      try {
        if (count === 1) {
          logAnnounce(
            isLocalHost ? "[TICHU LOCAL STEP]" : "[TICHU STUDIO STEP]",
            "Running debug_botStep...",
            "#d2a8ff",
          );
          await performDebugAction("debug_botStep");
        } else if (!isLocalHost) {
          logAnnounce(
            "[TICHU STUDIO STEP]",
            `Running debug_bgaPlayMoves (moves=${count})...`,
            "#d2a8ff",
          );
          await performDebugAction("debug_bgaPlayMoves", { moves: count });
        } else {
          logAnnounce("[TICHU LOCAL STEP]", `Running debug_botStep x${count}...`, "#d2a8ff");
          for (let i = 0; i < count; i++) {
            const cur = tt.status(false);
            if (!cur || cur.state.name === "gameEnd" || cur.state.id === 99) break;
            await performDebugAction("debug_botStep");
            if (ui?.notifqueue?.waitUntilIdle) {
              await ui.notifqueue.waitUntilIdle();
            }
            await waitUntilIdle(15000, speedMode === "instant" ? 10 : 25);
          }
        }
        if (isLocalHost && ui?.notifqueue?.waitUntilIdle) {
          await ui.notifqueue.waitUntilIdle();
        }
        const settleMs =
          speedMode === "instant"
            ? isLocalHost
              ? 10
              : 40
            : speedMode === "fast"
              ? isLocalHost
                ? 15
                : 60
              : 200;
        await waitUntilIdle(15000, settleMs);
        dismissDialogsIfInstant();
        return tt.status(false);
      } finally {
        botBusy = false;
        (win.tt || tt).refreshBar?.();
      }
    },

    async actForOthers() {
      const ui = getUi();
      if (ui?.gamedatas?.gamestate?.name === "confirmTrick" && ui?.isCurrentPlayerActive?.()) {
        return tt.status(false);
      }
      clearAutoBotTimer();
      clearTimeout(ui?.autoCollectTimeout);
      botBusy = true;
      (win.tt || tt).refreshBar?.();
      try {
        logAnnounce(
          isLocalHost ? "[TICHU LOCAL BOT]" : "[TICHU STUDIO BOT]",
          "Running debug_botOthers...",
          "#d2a8ff",
        );
        await performDebugAction("debug_botOthers");
        if (isLocalHost && ui?.notifqueue?.waitUntilIdle) {
          await ui.notifqueue.waitUntilIdle();
        }
        const settleMs =
          speedMode === "instant"
            ? isLocalHost
              ? 10
              : 40
            : speedMode === "fast"
              ? isLocalHost
                ? 15
                : 60
              : 200;
        await waitUntilIdle(15000, settleMs);
        dismissDialogsIfInstant();
        return tt.status(false);
      } finally {
        botBusy = false;
        (win.tt || tt).refreshBar?.();
      }
    },

    async runSmokeTest({
      tricks = 3,
      speed = "instant",
    }: { tricks?: number; speed?: "normal" | "fast" | "instant" } = {}) {
      const t0 = Date.now();
      activeTaskCount++;
      clearAutoBotTimer();
      try {
        tt.setSpeed(speed);
        logAnnounce(
          "[TICHU STUDIO SMOKE]",
          `▶ Starting BGA Studio Smoke Test (tricks=${tricks}, speed=${speed})...`,
          "#ffa657",
        );

        let assertionsPassed = 0;
        const checkUI = () => {
          tt.assertUI();
          assertionsPassed++;
        };

        const startStatus = tt.status(false);
        if (!startStatus) throw new Error("Game UI not ready");
        checkUI();

        // 1. Complete Grand Tichu bets if in grandTichuBets (viewer bet + batch bots for others)
        let cur = tt.status(false)!;
        let stepsRun = 0;
        if (cur.state.name === "grandTichuBets") {
          if (cur.isMyTurn) {
            cur = (await tt.betGrandTichu(0))!;
            stepsRun++;
          }
          if (cur.state.name === "grandTichuBets") {
            cur = (await (win.tt || tt).actForOthers())!;
            stepsRun++;
          }
          checkUI();
        }

        // 2. Complete passing 3 cards if in giveCards (viewer pass + batch bots for others)
        if (cur.state.name === "giveCards") {
          cur = (await tt.passAllCards())!;
          stepsRun += 2;
          checkUI();
        }

        // 3. Play N tricks (viewer plays if leading, then batch step for the remaining tricks)
        if (cur.isMyTurn && cur.state.name === "playComboOpen") {
          cur = (await tt.play())!;
          stepsRun++;
          checkUI();
        }
        if (cur.state.name === "mahjongPlay") {
          cur = (await tt.wish(15))!;
          stepsRun++;
          checkUI();
        }
        if (cur.state.name !== "gameEnd" && cur.state.id !== 99) {
          cur = (await (win.tt || tt).step(Math.max(4, tricks * 4)))!;
          stepsRun++;
          if (cur.state.name === "confirmTrick") {
            cur = (await tt.collect())!;
            stepsRun++;
          }
          checkUI();
        }

        const elapsedMs = Date.now() - t0;
        const result = {
          ok: true,
          tableId: cur.tableId,
          startState: startStatus.state.name,
          endState: cur.state.name,
          round: cur.round,
          trick: cur.trick,
          viewerHandCount: cur.hand.length,
          stepsRun,
          assertionsPassed,
          elapsedMs,
        };
        logAnnounce(
          "[TICHU STUDIO SMOKE]",
          `✔ PASS in ${elapsedMs}ms — Table #${result.tableId}, State=${result.endState}, Round=${result.round}, Trick=${result.trick}, Assertions=${assertionsPassed}`,
          "#3fb950",
        );
        return result;
      } finally {
        activeTaskCount--;
      }
    },

    async runRound({
      speed = "instant",
      maxSteps = 12,
    }: { speed?: "normal" | "fast" | "instant"; maxSteps?: number } = {}) {
      const t0 = Date.now();
      activeTaskCount++;
      clearAutoBotTimer();
      try {
        tt.setSpeed(speed);
        let cur = tt.status(false)!;
        const initialRound = cur.round;

        let batches = 0;
        while (
          cur.state.name !== "gameEnd" &&
          cur.state.id !== 99 &&
          cur.round === initialRound &&
          batches < maxSteps
        ) {
          cur = (await (win.tt || tt).step(35))!;
          batches++;
        }
        if (cur.state.name === "confirmTrick") {
          cur = (await tt.collect())!;
        }
        dismissDialogsIfInstant();
        if (cur.state.name !== "gameEnd" && cur.state.id !== 99) {
          tt.assertUI();
        }
        return {
          ok: true,
          tableId: cur.tableId,
          initialRound,
          currentRound: cur.round,
          state: cur.state.name,
          batches,
          players: cur.players.map((p: any) => ({
            name: p.name,
            score: p.score,
            handCount: p.handCount,
          })),
          elapsedMs: Date.now() - t0,
        };
      } finally {
        activeTaskCount--;
      }
    },

    async runGame({
      speed = "instant",
      maxBatches = 40,
    }: { speed?: "normal" | "fast" | "instant"; maxBatches?: number } = {}) {
      const t0 = Date.now();
      activeTaskCount++;
      clearAutoBotTimer();
      try {
        tt.setSpeed(speed);
        let cur = tt.status(false)!;
        let batches = 0;
        while (cur.state.name !== "gameEnd" && cur.state.id !== 99 && batches < maxBatches) {
          cur = (await (win.tt || tt).step(50))!;
          batches++;
        }
        return {
          ok: cur.state.name === "gameEnd" || cur.state.id === 99,
          tableId: cur.tableId,
          state: cur.state.name,
          round: cur.round,
          players: cur.players.map((p: any) => ({ name: p.name, score: p.score })),
          elapsedMs: Date.now() - t0,
        };
      } finally {
        activeTaskCount--;
      }
    },

    async expressStop(tableId?: number) {
      const ui = getUi();
      const tid = Number(
        tableId || (ui && ui.table_id) || (window as any).bgaGameData?.tableId || 0,
      );
      if (!tid) throw new Error("No tableId available for expressStop");
      const token = ((window as any).bgaConfig && (window as any).bgaConfig.requestToken) || "";
      const headers: Record<string, string> = token ? { "X-Request-Token": token } : {};
      const r1 = await fetch(
        `/table/table/expressGameStopTable.html?table=${tid}&noerrortracking=true&dojo.preventCache=${Date.now()}`,
        { headers, credentials: "same-origin" },
      ).then((r) => r.json());
      if (!r1 || Number(r1.status) !== 1) {
        await fetch(
          `/table/table/quitgame.html?table=${tid}&neutralized=true&s=table_QuitGame&noerrortracking=true&dojo.preventCache=${Date.now()}`,
          { headers, credentials: "same-origin" },
        ).then((r) => r.json());
      }
      return { ok: true, stoppedTableId: tid };
    },

    async expressStartNew({ gameLength = 2 }: { gameLength?: number } = {}) {
      const ui = getUi();
      const oldTableId = Number((ui && ui.table_id) || (window as any).bgaGameData?.tableId || 0);
      const gameId = Number((ui && ui.game_id) || 1386);
      const token = ((window as any).bgaConfig && (window as any).bgaConfig.requestToken) || "";
      const headers: Record<string, string> = token ? { "X-Request-Token": token } : {};
      if (oldTableId) {
        try {
          await tt.expressStop(oldTableId);
        } catch (_e) {}
      }
      const cJson = await fetch(
        `/table/table/createnew.html?game=${gameId}&gamemode=realtime&is_meeting=false&forceManual=true&lobbyType=kintsugi&noerrortracking=true&dojo.preventCache=${Date.now()}`,
        { headers, credentials: "same-origin" },
      ).then((r) => r.json());
      if (!cJson || Number(cJson.status) !== 1 || !cJson.data || !cJson.data.table) {
        throw new Error((cJson && cJson.error) || "createnew failed");
      }
      const newTableId = Number(cJson.data.table);
      await fetch(
        `/table/table/changeoption.html?table=${newTableId}&id=100&value=${Number(gameLength) || 2}&noerrortracking=true&dojo.preventCache=${Date.now()}`,
        { headers, credentials: "same-origin" },
      ).catch(() => {});
      const sJson = await fetch(
        `/tablemanager/tablemanager/expressStart.html?table=${newTableId}&noerrortracking=true&dojo.preventCache=${Date.now()}`,
        { headers, credentials: "same-origin" },
      ).then((r) => r.json());
      if (!sJson || Number(sJson.status) !== 1) {
        throw new Error((sJson && sJson.error) || "expressStart failed");
      }
      return {
        ok: true,
        stoppedTableId: oldTableId,
        newTableId,
        tableviewUrl: `https://studio.boardgamearena.com/tableview?table=${newTableId}`,
      };
    },

    getConsoleIssues() {
      const ui = getUi();
      const issues: ConsoleIssue[] = [...consoleIssues];
      const breadcrumbs = ui && Array.isArray(ui.debugBreadcrumbs) ? ui.debugBreadcrumbs : [];
      for (let i = 0; i < breadcrumbs.length; i++) {
        const b = breadcrumbs[i];
        if (b && b.cat === "warn") {
          const msg =
            `[tichu breadcrumb] ${b.name} ${b.detail ? JSON.stringify(b.detail) : ""}`.trim();
          if (!issues.some((existing) => existing.message.indexOf(b.name) !== -1)) {
            issues.push({
              ts: b.ts || new Date().toISOString(),
              level: "warn",
              source: "tichu.breadcrumb",
              message: msg,
            });
          }
        }
      }
      return issues;
    },

    clearConsoleIssues() {
      consoleIssues.length = 0;
      actionErrorLog.length = 0;
      autoPlayCtrl.actionErrors.length = 0;
      return [];
    },

    _recordActionError(url: string, err: string) {
      const ui = getUi();
      const stateName = String(ui?.gamedatas?.gamestate?.name || autoPlayCtrl.lastState || "");
      const errText = String(err || "AJAX error");
      const entry = {
        ts: new Date().toISOString(),
        url: String(url || ""),
        state: stateName,
        error: errText,
      };
      if (actionErrorLog.length >= 200) {
        actionErrorLog.shift();
      }
      actionErrorLog.push(entry);
      if (autoPlayCtrl.running) {
        autoPlayCtrl.actionErrors.push({
          ts: entry.ts,
          state: stateName,
          error: url ? `${url}: ${errText}` : errText,
        });
      }
      recordConsoleIssue("error", "ajax.error", [url ? `${url}: ${errText}` : errText]);
      return entry;
    },

    async actMyTurn() {
      const ui = getUi();
      if (!ui || !ui.gamedatas) {
        throw new Error("window.gameui or gamedatas is not initialized");
      }
      await waitUntilIdle(5000, 30);
      await waitLitUpdates();

      const cur = tt.status(false);
      if (!cur) return { acted: false, reason: "no_status", assertionsPassed: 0 };
      if (cur.state.name === "gameEnd" || cur.state.id === 99) {
        return { acted: false, reason: "game_end", status: cur, assertionsPassed: 0 };
      }
      if (cur.state.type === "game") {
        return { acted: false, reason: "game_state", status: cur, assertionsPassed: 0 };
      }

      let assertionsPassed = 0;
      const handCards = ui.gamedatas.hand || [];
      if (cur.state.name === "grandTichuBets") {
        // Dismiss any leftover end-of-round popin modal before acting or asserting UI.
        document.querySelectorAll(".bga-popin-underlay").forEach((el) => el.remove());
        if (handCards.length !== 8) {
          return { acted: false, reason: "waiting_8_cards", status: cur, assertionsPassed };
        }
      }
      if (cur.isMyTurn && cur.state.name === "giveCards" && handCards.length < 14) {
        return { acted: false, reason: "waiting_14_cards", status: cur, assertionsPassed };
      }

      tt.assertUI();
      assertionsPassed++;

      const myPlayerId = Number(ui.player_id);
      const { myIdx, partner, opps } = getTeamRelations(cur.players || [], myPlayerId);
      const cv = (window as any).__tichuComboValidator;
      const gmState = (window as any).gameModel?.getState?.();
      const rawLast = gmState?.trickLastCombo ?? ui.gamedatas.lastCombo;
      const hasTableCombo = Boolean(
        rawLast && rawLast.type !== undefined && Number(rawLast.type) !== 99,
      );
      const lastCombo =
        cv?.Combo && hasTableCombo ? cv.Combo.fromLastComboState(rawLast) : cv?.Combo?.noCombo;
      const lastPlayerId = Number(
        ui.gamedatas.lastComboPlayer || gmState?.trickLastCombo?.playerId || 0,
      );
      const wish = Number(ui.gamedatas.mahjongWish || 0);
      const mustWish =
        cv?.Hand &&
        wish >= 2 &&
        wish <= 14 &&
        new cv.Hand(handCards).canFulFillWish(wish, lastCombo)
          ? wish
          : 0;
      const currentBombTrickSig = `${cur.round}:${cur.trick}:${lastPlayerId}:${lastCombo?.type ?? 99}:${lastCombo?.cards?.length || 0}:${(lastCombo?.cards || []).map((c: any) => c.id).join(",")}`;

      // Handle confirmTichu 60s prompt if active state OR #confirmTichu button is visible.
      if (cur.state.name === "confirmTichu" || isConfirmTichuVisible()) {
        const betVal = getConfirmTichuBetValue();
        await tt.confirmTichu(betVal);
        if (betVal === 200) {
          lastGrandTichuBetRoundByPlayer[myPlayerId] = Number(cur.round || 0);
        }
        await waitUntilIdle(5000, 30);
        await waitLitUpdates();
        const after = tt.status(false);
        if (after && after.state.name !== "endRound" && after.state.name !== "newRound") {
          tt.assertUI();
          assertionsPassed++;
        }
        return {
          acted: true,
          stateBefore: cur.state.name,
          action: `confirmTichu(${betVal})`,
          status: after,
          assertionsPassed,
        };
      }

      // Out-of-turn bomb interrupt when opponent holds a valuable/dangerous trick in playCombo.
      if (!cur.isMyTurn) {
        if (
          cur.state.name === "playCombo" &&
          !ui.isSpectator &&
          handCards.length >= 4 &&
          cv?.Combo &&
          cv?.Hand &&
          lastCombo &&
          lastCombo.type !== 99 &&
          lastCombo.type !== 0 &&
          lastPlayerId > 0 &&
          lastPlayerId !== myPlayerId &&
          lastPlayerId !== Number(partner?.id ?? -1) &&
          currentBombTrickSig !== lastCanceledBombSig &&
          (Number(cur.trickPoints || 0) >= 10 ||
            opps.some((o: any) => o.handCount > 0 && o.handCount <= 4))
        ) {
          const bombs = findAllRealBombsInHand(handCards, cv).filter(
            (b) =>
              b.canBeat(lastCombo) &&
              (!mustWish || b.cards.some((c: any) => Number(c.type_arg) === mustWish)),
          );
          if (bombs.length > 0) {
            await new Promise((r) => setTimeout(r, (Math.max(0, myIdx) + 1) * 25));
            await waitUntilIdle(2000, 20);
            const recheck = tt.status(false);
            const recheckGmState = (window as any).gameModel?.getState?.();
            const recheckLastPlayerId = Number(
              ui.gamedatas.lastComboPlayer || recheckGmState?.trickLastCombo?.playerId || 0,
            );
            if (
              recheck &&
              recheck.state.name === "playCombo" &&
              !recheck.isMyTurn &&
              recheck.round === cur.round &&
              recheck.trick === cur.trick &&
              recheckLastPlayerId === lastPlayerId &&
              currentBombTrickSig !== lastCanceledBombSig
            ) {
              lastCanceledBombSig = currentBombTrickSig;
              await tt.bomb();
              await waitUntilIdle(5000, 30);
              await waitLitUpdates();
              const after = tt.status(false);
              if (after && after.state.name !== "endRound" && after.state.name !== "newRound") {
                tt.assertUI();
                assertionsPassed++;
              }
              return {
                acted: true,
                stateBefore: cur.state.name,
                action: "playBomb(interrupt)",
                status: after,
                assertionsPassed,
              };
            }
          }
        }
        return { acted: false, reason: "not_my_turn", status: cur, assertionsPassed };
      }

      let actionDesc = "";
      switch (cur.state.name) {
        case "grandTichuBets": {
          if (handCards.length !== 8) {
            return { acted: false, reason: "waiting_8_cards", status: cur, assertionsPassed };
          }
          const curRound = Number(cur.round || 0);
          const prevGtRound = lastGrandTichuBetRoundByPlayer[myPlayerId] ?? -1;
          if (curRound < prevGtRound) {
            delete lastGrandTichuBetRoundByPlayer[myPlayerId];
          }
          const myGtVal = Number(ui.gamedatas?.players?.[myPlayerId]?.call_grand_tichu ?? -1);
          if (myGtVal >= 0 || lastGrandTichuBetRoundByPlayer[myPlayerId] === curRound) {
            return { acted: false, reason: "already_bet_gt", status: cur, assertionsPassed };
          }
          const aces = handCards.filter((c: any) => Number(c.type_arg) === 14).length;
          const kings = handCards.filter((c: any) => Number(c.type_arg) === 13).length;
          const hasDragon = handCards.some(
            (c: any) => Number(c.type) === 1 && Number(c.type_arg) === 1,
          );
          const hasPhoenix = handCards.some(
            (c: any) => Number(c.type) === 2 && Number(c.type_arg) === 1,
          );
          const hasBomb = cv?.Combo ? findAllRealBombsInHand(handCards, cv).length > 0 : false;
          const partnerBet = Boolean(
            partner && (Number(partner.grandTichu) === 200 || Number(partner.tichu) === 100),
          );
          const shouldBetGt =
            !partnerBet &&
            (hasBomb || (hasDragon && hasPhoenix) || (hasDragon && aces + kings >= 2));
          if (shouldBetGt) {
            await tt.betGrandTichu(200);
            await waitUntilIdle(5000, 30);
            await waitLitUpdates();
            if (isConfirmTichuVisible()) {
              await tt.confirmTichu(200);
              await waitUntilIdle(5000, 30);
              await waitLitUpdates();
            }
            const afterGtVal = Number(ui.gamedatas?.players?.[myPlayerId]?.call_grand_tichu ?? -1);
            if (afterGtVal >= 0) {
              lastGrandTichuBetRoundByPlayer[myPlayerId] = curRound;
            }
            cornerCases.grandTichuBets++;
            actionDesc = "grandTichuBet(200)";
          } else {
            await tt.betGrandTichu(0);
            lastGrandTichuBetRoundByPlayer[myPlayerId] = curRound;
            actionDesc = "grandTichuBet(0)";
          }
          break;
        }
        case "giveCards": {
          if (handCards.length < 14) {
            return { acted: false, reason: "waiting_14_cards", status: cur, assertionsPassed };
          }
          const curRound = Number(cur.round || 0);
          const prevGiveRound = lastGiveCardsRoundByPlayer[myPlayerId] ?? -1;
          if (curRound < prevGiveRound) {
            delete lastGiveCardsRoundByPlayer[myPlayerId];
          }
          if (lastGiveCardsRoundByPlayer[myPlayerId] === curRound) {
            return { acted: false, reason: "already_gave_cards", status: cur, assertionsPassed };
          }
          if (myIdx === 0 && !cornerCases.resetPassTested) {
            const sample = normalizeRealHand(handCards).slice(0, 3);
            if (sample.length === 3 && ui.playerHand && typeof ui.onGiveCard === "function") {
              for (let i = 0; i < 3; i++) {
                ui.playerHand.unselectAll();
                ui.playerHand.selectItem(String(sample[i]!.id));
                ui.onGiveCard(i);
              }
              await waitLitUpdates();
              if (typeof ui.onResetPassCards === "function") {
                ui.onResetPassCards();
              } else {
                (window as any).gameModel?.resetPassCards?.();
              }
              ui.cardsToPass = [];
              await waitLitUpdates();
              const postSlots = (window as any).gameModel?.getState?.()?.passSlots;
              const stillStagedInModel =
                Array.isArray(postSlots) && postSlots.some((s: any) => s && s.givenCard);
              const stillStagedInDom =
                queryDeepAll("tichu-pass-area tichu-card.given-card").length > 0;
              if (stillStagedInModel || stillStagedInDom) {
                recordConsoleIssue("error", "resetPassCards", [
                  "passArea did not clear after onResetPassCards",
                ]);
              }
            }
            cornerCases.resetPassTested = true;
          }
          const [opp0Card, partnerCard, opp1Card] = findSmartPassCards(handCards, cv);
          passedOppRanksRound = Number(cur.round);
          passedOppRanks = [opp0Card.type_arg, opp1Card.type_arg].filter((r) => r >= 2 && r <= 14);
          const ids = [opp0Card, partnerCard, opp1Card].map((c) => `#${c.id}`);
          await tt.giveCards(ids);
          lastGiveCardsRoundByPlayer[myPlayerId] = curRound;
          actionDesc = `giveCards(${[opp0Card, partnerCard, opp1Card].map((c) => formatCardCode(c)).join(",")})`;
          break;
        }
        case "showPassedCards":
        case "acceptPassedCards": {
          await tt.acceptCards();
          actionDesc = "acceptCards";
          break;
        }
        case "playComboOpen":
        case "playCombo": {
          if (handCards.length === 0) {
            throw new Error(`isMyTurn=true in ${cur.state.name} with 0 cards in hand`);
          }
          if (!cv || !cv.Hand || !cv.Combo) {
            throw new Error("__tichuComboValidator is missing on window");
          }

          // Pre-first-card Tichu bet on 14 cards when strong and no GT/partner bet yet.
          const myP = (cur.players || []).find((p: any) => Number(p.id) === myPlayerId);
          const myGt = Number(myP?.grandTichu ?? -1);
          const myTi = Number(myP?.tichu ?? -1);
          const partnerBet = Boolean(
            partner && (Number(partner.grandTichu) === 200 || Number(partner.tichu) === 100),
          );
          if (handCards.length === 14 && myGt === 0 && myTi === -1 && !partnerBet) {
            const hasBomb = findAllRealBombsInHand(handCards, cv).length > 0;
            const hasDragon = handCards.some(
              (c: any) => Number(c.type) === 1 && Number(c.type_arg) === 1,
            );
            const hasPhoenix = handCards.some(
              (c: any) => Number(c.type) === 2 && Number(c.type_arg) === 1,
            );
            const aces = handCards.filter((c: any) => Number(c.type_arg) === 14).length;
            if (hasBomb || (hasDragon && (hasPhoenix || aces >= 2))) {
              await tt.betTichu();
              cornerCases.tichuBets++;
              await waitUntilIdle(5000, 30);
              await waitLitUpdates();
              if (isConfirmTichuVisible()) {
                await tt.confirmTichu(100);
                await waitUntilIdle(5000, 30);
                await waitLitUpdates();
              }
            }
          }

          const hand = new cv.Hand(handCards);
          const effectiveLast = cur.state.name === "playComboOpen" ? cv.Combo.noCombo : lastCombo;
          const activeWish =
            wish >= 2 && wish <= 14 && hand.canFulFillWish(wish, effectiveLast) ? wish : 0;

          if (cur.state.name === "playComboOpen") {
            const rawCandidates = generateLegalCombos(handCards, cv.Combo.noCombo, activeWish, cv);
            const bombs = findAllRealBombsInHand(handCards, cv);
            const bombIds = getBombCardIdSet(bombs);
            const preferClean = (list: any[]) => {
              const clean = list.filter((c) => !comboBreaksBomb(c, handCards.length, bombIds));
              return clean.length > 0 ? clean : list;
            };

            let chosen: any = null;
            const onePlay = rawCandidates.find((c) => c.cards.length === handCards.length) || null;
            if (onePlay) {
              chosen = onePlay;
            }
            if (!chosen && !activeWish) {
              const dogCombo = rawCandidates.find((c) => c.type === 0) || null;
              if (
                dogCombo &&
                partner &&
                Number(partner.handCount) > 0 &&
                ((Number(cur.trick) + cornerCases.dogLeads + myIdx) % 2 === 0 ||
                  handCards.length <= 4)
              ) {
                chosen = dogCombo;
                cornerCases.dogLeads++;
              }
            }
            if (!chosen) {
              const mjAll = preferClean(
                rawCandidates.filter((c) =>
                  c.cards.some((x: any) => Number(x.type) === 4 && Number(x.type_arg) === 1),
                ),
              );
              if (mjAll.length > 0) {
                const mjStraight = mjAll.find((c) => c.type === 6);
                chosen = mjStraight || mjAll.find((c) => c.type === 1) || mjAll[0]!;
                cornerCases.mahjongLeads++;
              }
            }
            if (!chosen) {
              const ambigList = preferClean(rawCandidates).filter(
                (c) => c.type !== 7 && Array.isArray(c.phoenixValue) && c.phoenixValue.length > 1,
              );
              if (
                ambigList.length > 0 &&
                (!cornerCases.phoenixAmbiguousPlays ||
                  (Number(cur.round) + Number(cur.trick)) % 4 === 0)
              ) {
                chosen = ambigList[0]!;
              }
            }
            if (!chosen) {
              const nonBombs = rawCandidates.filter(
                (c) => c.type !== 7 && (c.type !== 0 || (partner && Number(partner.handCount) > 0)),
              );
              const pool = nonBombs.length > 0 ? nonBombs : rawCandidates;
              const rotations: number[][] = [
                [4, 5, 6, 3, 2, 1],
                [6, 4, 5, 2, 3, 1],
                [5, 3, 4, 6, 2, 1],
                [2, 6, 3, 4, 5, 1],
                [3, 2, 6, 4, 5, 1],
              ];
              const order = rotations[(Number(cur.round) + Number(cur.trick) + myIdx) % 5]!;
              for (let f = 0; f < order.length; f++) {
                const famType = order[f]!;
                const famList = preferClean(pool.filter((c) => c.type === famType));
                if (famList.length === 0) continue;
                famList.sort((a, b) => {
                  const scoreSingle = (c: any): number => {
                    if (c.type !== 1) return comboRankStrength(c);
                    const card = c.cards[0];
                    if (card && Number(card.type_arg) === 1 && Number(card.type) === 1) return 1000;
                    if (card && Number(card.type_arg) === 1 && Number(card.type) === 2) return 990;
                    if (card && Number(card.type_arg) === 14) return 500;
                    return comboRankStrength(c);
                  };
                  return scoreSingle(a) - scoreSingle(b);
                });
                const pickIdx = Number(cur.trick) > 2 && famList.length > 2 ? 1 : 0;
                chosen = famList[pickIdx]!;
                break;
              }
            }
            if (!chosen) {
              chosen = hand.findPlayableCombo(cv.Combo.noCombo, activeWish);
            }
            if (!chosen) {
              throw new Error("No playable combo found in playComboOpen");
            }
            if (chosen.cards.length > 1) {
              cornerCases.multiCardLeads++;
            }
            if (Array.isArray(chosen.phoenixValue) && chosen.phoenixValue.length > 1) {
              cornerCases.phoenixAmbiguousPlays++;
            }
            const ids = chosen.cards.map((c: any) => `#${c.id}`).join(";");
            await tt.play(ids);
            actionDesc = `play(${chosen.cards.map((c: any) => formatCardCode(c)).join(",")})`;
            break;
          }

          // playCombo (following)
          const rawCandidates = generateLegalCombos(handCards, effectiveLast, activeWish, cv);
          const bombs = findAllRealBombsInHand(handCards, cv);
          const bombIds = getBombCardIdSet(bombs);
          const preferClean = (list: any[]) => {
            const clean = list.filter((c) => !comboBreaksBomb(c, handCards.length, bombIds));
            return clean.length > 0 ? clean : list;
          };
          const partnerOwnsTrick = Boolean(partner && Number(partner.id) === lastPlayerId);
          const onePlay = rawCandidates.find((c) => c.cards.length === handCards.length) || null;

          let chosen: any = null;
          let shouldPass = false;

          if (onePlay) {
            chosen = onePlay;
          } else if (partnerOwnsTrick && !activeWish) {
            shouldPass = true;
            cornerCases.partnerPasses++;
          } else {
            const nonBombs = rawCandidates.filter((c) => c.type !== 7);
            const bombBeaters = rawCandidates.filter((c) => c.type === 7);

            if (nonBombs.length > 0) {
              const ambig = !activeWish
                ? preferClean(nonBombs).filter(
                    (c) => Array.isArray(c.phoenixValue) && c.phoenixValue.length > 1,
                  )
                : [];
              if (ambig.length > 0 && !cornerCases.phoenixAmbiguousPlays) {
                chosen = ambig[0]!;
              } else {
                const clean = preferClean(nonBombs);
                clean.sort((a, b) => {
                  const score = (c: any): number => {
                    let s = comboRankStrength(c);
                    if (
                      c.type === 1 &&
                      c.cards[0] &&
                      Number(c.cards[0].type_arg) === 1 &&
                      Number(c.cards[0].type) === 1
                    ) {
                      s += 1000;
                    } else if (
                      c.type === 1 &&
                      c.cards[0] &&
                      Number(c.cards[0].type_arg) === 1 &&
                      Number(c.cards[0].type) === 2
                    ) {
                      s += 950;
                    }
                    return s;
                  };
                  return score(a) - score(b);
                });
                const candidate = clean[0]!;
                const usesDragonOrPhoenixSingle =
                  candidate.type === 1 &&
                  candidate.cards[0] &&
                  Number(candidate.cards[0].type_arg) === 1 &&
                  (Number(candidate.cards[0].type) === 1 || Number(candidate.cards[0].type) === 2);
                const highAceOnZero =
                  candidate.type === 1 &&
                  candidate.cards[0] &&
                  Number(candidate.cards[0].type_arg) === 14 &&
                  comboRankStrength(effectiveLast) >= 13;
                if (
                  !activeWish &&
                  Number(cur.trickPoints || 0) === 0 &&
                  handCards.length > 4 &&
                  opps.every((o: any) => o.handCount === 0 || o.handCount > 5) &&
                  (usesDragonOrPhoenixSingle || highAceOnZero)
                ) {
                  shouldPass = true;
                } else {
                  chosen = candidate;
                }
              }
            } else if (bombBeaters.length > 0) {
              if (
                activeWish ||
                Number(cur.trickPoints || 0) >= 10 ||
                opps.some((o: any) => o.handCount > 0 && o.handCount <= 4)
              ) {
                chosen = bombBeaters[0]!;
                cornerCases.bombsPlayed++;
              } else {
                shouldPass = true;
              }
            } else if (activeWish > 0) {
              chosen = hand.findPlayableCombo(effectiveLast, activeWish);
              if (!chosen) shouldPass = true;
            } else {
              shouldPass = true;
            }
          }

          if (
            lastPlayerId > 0 &&
            lastPlayerId !== myPlayerId &&
            lastPlayerId !== Number(partner?.id ?? -1) &&
            (Number(cur.trickPoints || 0) >= 10 ||
              opps.some((o: any) => o.handCount > 0 && o.handCount <= 4))
          ) {
            await new Promise((r) => setTimeout(r, 160));
            await waitUntilIdle(2000, 20);
            const recheck = tt.status(false);
            if (!recheck || !recheck.isMyTurn || recheck.state.name !== "playCombo") {
              return {
                acted: false,
                reason: "interrupted_by_bomb",
                status: recheck || cur,
                assertionsPassed,
              };
            }
          }

          if (shouldPass || !chosen) {
            await tt.pass(true);
            actionDesc = partnerOwnsTrick ? "pass(partner)" : "pass(once)";
          } else {
            if (activeWish > 0) {
              cornerCases.wishesFulfilled++;
            }
            if (Array.isArray(chosen.phoenixValue) && chosen.phoenixValue.length > 1) {
              cornerCases.phoenixAmbiguousPlays++;
            }
            const ids = chosen.cards.map((c: any) => `#${c.id}`).join(";");
            await tt.play(ids);
            actionDesc = `play(${chosen.cards.map((c: any) => formatCardCode(c)).join(",")})`;
          }
          break;
        }
        case "mahjongPlay": {
          const handRanks = new Set(handCards.map((c: any) => Number(c.type_arg)));
          let wishRank = 0;
          if (passedOppRanksRound === Number(cur.round) && passedOppRanks.length > 0) {
            for (let i = 0; i < passedOppRanks.length; i++) {
              const r = passedOppRanks[i]!;
              if (!handRanks.has(r) && r >= 2 && r <= 14) {
                wishRank = r;
                break;
              }
            }
            if (!wishRank) {
              wishRank = passedOppRanks[0] || 0;
            }
          }
          if (!wishRank) {
            const wishPool = [2, 5, 8, 10, 11, 13, 14, 15];
            const startIdx =
              (Number(cur.round) + Number(cur.trick) + Math.max(0, myIdx)) % wishPool.length;
            for (let offset = 0; offset < wishPool.length; offset++) {
              const cand = wishPool[(startIdx + offset) % wishPool.length]!;
              if (cand === 15 || !handRanks.has(cand)) {
                wishRank = cand;
                break;
              }
            }
            if (!wishRank) wishRank = 15;
          }
          await tt.wish(wishRank);
          cornerCases.wishesMade++;
          actionDesc = `wish(${wishRank})`;
          break;
        }
        case "phoenixPlay": {
          if (!cornerCases.phoenixCancelTested) {
            cornerCases.phoenixCancelTested = true;
            await tt.cancelPhoenix();
            actionDesc = "cancelPhoenix(test)";
          } else {
            const allowed = getAllowedPhoenixValues(ui);
            const chosenRank =
              allowed.length > 0
                ? allowed[
                    (Number(cur.round) + Number(cur.trick) + Math.max(0, myIdx)) % allowed.length
                  ]!
                : undefined;
            await tt.choosePhoenix(chosenRank);
            actionDesc = `choosePhoenix(${chosenRank ?? "default"})`;
          }
          break;
        }
        case "confirmTrick": {
          await tt.collect();
          actionDesc = "collect";
          break;
        }
        case "chooseDragonGift": {
          const players = cur.players || [];
          const opp0 = myIdx >= 0 && players.length === 4 ? players[(myIdx + 1) % 4] : null;
          const opp1 = myIdx >= 0 && players.length === 4 ? players[(myIdx + 3) % 4] : null;
          let enemyIndex = (Number(cur.round) + Number(cur.trick)) % 2;
          if (opp0 && opp1) {
            const c0 = Number(opp0.handCount ?? 0);
            const c1 = Number(opp1.handCount ?? 0);
            if (c0 > c1) enemyIndex = 0;
            else if (c1 > c0) enemyIndex = 1;
          }
          await tt.giveDragon(enemyIndex);
          cornerCases.dragonGifts++;
          actionDesc = `giveDragon(${enemyIndex})`;
          break;
        }
        case "playBomb": {
          if (!cornerCases.bombCancelTested) {
            cornerCases.bombCancelTested = true;
            lastCanceledBombSig = currentBombTrickSig;
            await tt.cancelBomb();
            actionDesc = "cancelBomb(test)";
          } else {
            const bombs = cv?.Combo
              ? findAllRealBombsInHand(handCards, cv).filter(
                  (b) =>
                    (!lastCombo || lastCombo.type === 99 || b.canBeat(lastCombo)) &&
                    (!mustWish || b.cards.some((c: any) => Number(c.type_arg) === mustWish)),
                )
              : [];
            if (bombs.length > 0) {
              const ids = bombs[0]!.cards.map((c: any) => `#${c.id}`).join(";");
              await tt.play(ids);
              cornerCases.bombsPlayed++;
              actionDesc = `playBomb(${bombs[0]!.cards.map((c: any) => formatCardCode(c)).join(",")})`;
            } else {
              lastCanceledBombSig = currentBombTrickSig;
              await tt.cancelBomb();
              actionDesc = "cancelBomb(fallback)";
            }
          }
          break;
        }
        default:
          throw new Error(`Unhandled active state in actMyTurn: ${cur.state.name}`);
      }

      await waitUntilIdle(5000, 30);
      await waitLitUpdates();
      const after = tt.status(false);
      if (after && after.state.name !== "endRound" && after.state.name !== "newRound") {
        tt.assertUI();
        assertionsPassed++;
      }

      return {
        acted: true,
        stateBefore: cur.state.name,
        action: actionDesc,
        status: after,
        assertionsPassed,
      };
    },

    autoPlayStatus() {
      const cur = tt.status(false);
      const issues = tt.getConsoleIssues();
      const errs = autoPlayCtrl.running ? autoPlayCtrl.actionErrors : actionErrorLog;
      return {
        running: autoPlayCtrl.running,
        tableId: cur?.tableId ?? autoPlayCtrl.tableId,
        player: cur?.viewer ?? autoPlayCtrl.player,
        playerId: cur?.viewerId ?? autoPlayCtrl.playerId,
        seat: autoPlayCtrl.seat,
        movesPlayed: autoPlayCtrl.movesPlayed,
        assertionsPassed: autoPlayCtrl.assertionsPassed,
        round: cur?.round ?? autoPlayCtrl.lastRound,
        trick: cur?.trick ?? autoPlayCtrl.lastTrick,
        state: cur?.state ?? { name: autoPlayCtrl.lastState },
        players: cur?.players?.map((p: any) => ({
          seat: p.seat,
          id: p.id,
          name: p.name,
          score: p.score,
          handCount: p.handCount,
        })),
        consoleIssueCount: issues.length,
        consoleIssues: issues,
        actionErrorCount: errs.length,
        actionErrors: errs,
        cornerCases: { ...cornerCases },
        elapsedMs: autoPlayCtrl.startedAt ? Date.now() - autoPlayCtrl.startedAt : 0,
      };
    },

    getAutoPlayStatus() {
      return tt.autoPlayStatus();
    },

    stopAutoPlayMe(reason = "stopped_by_user") {
      if (!autoPlayCtrl.running) {
        return tt.autoPlayStatus();
      }
      autoPlayCtrl.stopRequested = true;
      autoPlayCtrl.stopReason = reason;
      autoPlayCtrl.kick();
      return tt.autoPlayStatus();
    },

    startAutoPlayMe({
      timeoutMs = 600000,
      staggerMs = 350,
      stopOnIssue = true,
    }: { timeoutMs?: number; staggerMs?: number; stopOnIssue?: boolean } = {}) {
      return new Promise((resolve) => {
        const myRunId = ++autoPlayRunSeq;
        const isSuperseded = () => autoPlayCtrl.runId !== myRunId;
        const stallTimeoutMs = isLocalHost ? 30000 : 90000;
        const outEl = document.getElementById("tt_test_output");
        let ui: any = null;
        let myPlayerId = 0;
        let mySeat = -1;
        let initStatus: any = null;
        let ticking = false;
        let finished = false;
        let lastProgressAt = Date.now();
        let lastProgressSig = "";
        let lastResyncAt = 0;
        let waitingCardsSince = 0;
        let waitingSeatResynced = false;
        let multiactiveKey = "";
        let multiactiveSeenAt = 0;
        let prevTickStateName = "";
        let lastActedKey = "";
        let lastActedAt = 0;
        let intervalId: number | null = null;
        const dojoSubs: any[] = [];
        const mc = typeof MessageChannel !== "undefined" ? new MessageChannel() : null;

        const writeLiveOutput = (cur: any) => {
          if (!outEl || finished || isSuperseded()) return;
          const issues = tt.getConsoleIssues();
          outEl.setAttribute("data-done", "0");
          outEl.setAttribute("data-status", "running");
          outEl.style.color = "#d29922";
          outEl.textContent = JSON.stringify({
            running: true,
            tableId: cur?.tableId ?? autoPlayCtrl.tableId,
            player: autoPlayCtrl.player,
            seat: autoPlayCtrl.seat,
            movesPlayed: autoPlayCtrl.movesPlayed,
            assertionsPassed: autoPlayCtrl.assertionsPassed,
            round: cur?.round ?? autoPlayCtrl.lastRound,
            trick: cur?.trick ?? autoPlayCtrl.lastTrick,
            state: cur?.state?.name ?? autoPlayCtrl.lastState,
            scores: cur?.players?.map((p: any) => p.score) ?? [],
            consoleIssueCount: issues.length,
            actionErrorCount: autoPlayCtrl.actionErrors.length,
            cornerCases: { ...cornerCases },
            elapsedMs: autoPlayCtrl.startedAt ? Date.now() - autoPlayCtrl.startedAt : 0,
          });
        };

        const cleanup = () => {
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          const dojoObj = (window as any).dojo;
          if (dojoObj && typeof dojoObj.unsubscribe === "function") {
            for (let i = 0; i < dojoSubs.length; i++) {
              try {
                dojoObj.unsubscribe(dojoSubs[i]);
              } catch (_e) {}
            }
          }
          dojoSubs.length = 0;
          if (mc) {
            try {
              mc.port1.close();
              mc.port2.close();
            } catch (_e) {}
          }
          if (autoPlayCtrl.runId === myRunId) {
            autoPlayCtrl.running = false;
            autoPlayCtrl.kick = () => {};
          }
        };

        const finish = (okOverride?: boolean, extraError?: string, extraStack?: string) => {
          if (finished) return;
          finished = true;
          cleanup();
          if (isSuperseded()) {
            resolve({ ok: false, superseded: true, runId: myRunId });
            return;
          }
          const cur = tt.status(false);
          const issues = tt.getConsoleIssues();
          if (extraError) {
            autoPlayCtrl.actionErrors.push({
              ts: new Date().toISOString(),
              state: cur?.state?.name || autoPlayCtrl.lastState,
              error: extraError,
              ...(extraStack ? { stack: extraStack } : {}),
            });
          }
          const ok =
            okOverride !== undefined
              ? okOverride && issues.length === 0 && autoPlayCtrl.actionErrors.length === 0
              : (cur?.state?.name === "gameEnd" || cur?.state?.id === 99) &&
                issues.length === 0 &&
                autoPlayCtrl.actionErrors.length === 0;
          const summary = {
            ok,
            ...(extraError ? { error: extraError } : {}),
            ...(extraStack ? { stack: extraStack } : {}),
            tableId: cur?.tableId ?? autoPlayCtrl.tableId,
            player: autoPlayCtrl.player,
            playerId: autoPlayCtrl.playerId,
            seat: autoPlayCtrl.seat,
            movesPlayed: autoPlayCtrl.movesPlayed,
            assertionsPassed: autoPlayCtrl.assertionsPassed,
            round: cur?.round ?? autoPlayCtrl.lastRound,
            trick: cur?.trick ?? autoPlayCtrl.lastTrick,
            state: cur?.state ?? { name: autoPlayCtrl.lastState },
            players:
              cur?.players?.map((p: any) => ({
                seat: p.seat,
                id: p.id,
                name: p.name,
                score: p.score,
              })) ?? [],
            consoleIssueCount: issues.length,
            consoleIssues: issues,
            actionErrors: autoPlayCtrl.actionErrors,
            cornerCases: { ...cornerCases },
            stopReason: autoPlayCtrl.stopReason || undefined,
            elapsedMs: autoPlayCtrl.startedAt ? Date.now() - autoPlayCtrl.startedAt : 0,
            moveHistory: autoPlayCtrl.moveHistory.slice(-25),
          };
          if (outEl) {
            outEl.setAttribute("data-status", ok ? "pass" : "fail");
            outEl.setAttribute("data-done", "1");
            outEl.style.color = ok ? "#3fb950" : "#f85149";
            outEl.textContent = JSON.stringify(summary);
          }
          logAnnounce(
            "[TICHU AUTOPLAY]",
            `${ok ? "✔ DONE" : "✘ FINISHED WITH ISSUES"} — ${summary.player}: moves=${summary.movesPlayed}, assertions=${summary.assertionsPassed}, issues=${summary.consoleIssueCount}, errors=${summary.actionErrors.length}`,
            ok ? "#3fb950" : "#f85149",
          );
          resolve(summary);
        };

        try {
          clearAutoBotTimer();
          autoPlayCtrl.runId = myRunId;
          if (autoPlayCtrl.running) {
            tt.stopAutoPlayMe("restarted");
          }
          actionErrorLog.length = 0;
          consoleIssues.length = 0;
          tt.setSpeed("instant");
          ui = getUi();
          initStatus = tt.status(false);
          if (!ui || !initStatus) {
            throw new Error("Game UI not ready for startAutoPlayMe");
          }
          const players = getSortedPlayers();
          myPlayerId = Number(ui.player_id);
          mySeat = players.findIndex((p: any) => Number(p.id) === myPlayerId);
          prevTickStateName = initStatus.state.name;
          delete lastGrandTichuBetRoundByPlayer[myPlayerId];
          delete lastGiveCardsRoundByPlayer[myPlayerId];

          autoPlayCtrl.running = true;
          autoPlayCtrl.runId = myRunId;
          autoPlayCtrl.stopRequested = false;
          autoPlayCtrl.stopReason = "";
          autoPlayCtrl.tableId = initStatus.tableId;
          autoPlayCtrl.player = initStatus.viewer;
          autoPlayCtrl.playerId = myPlayerId;
          autoPlayCtrl.seat = mySeat;
          autoPlayCtrl.movesPlayed = 0;
          autoPlayCtrl.assertionsPassed = 0;
          autoPlayCtrl.actionErrors = [];
          autoPlayCtrl.moveHistory = [];
          autoPlayCtrl.startedAt = Date.now();
          autoPlayCtrl.lastRound = initStatus.round;
          autoPlayCtrl.lastTrick = initStatus.trick;
          autoPlayCtrl.lastState = initStatus.state.name;
          if (ui) {
            delete ui._abortState;
          }
          if (!isLocalHost && initStatus.tableId) {
            try {
              localStorage.removeItem(`tichu_studio_abort_${initStatus.tableId}`);
            } catch (_e) {}
          }

          logAnnounce(
            "[TICHU AUTOPLAY]",
            `▶ Starting real-player loop for ${initStatus.viewer} (seat ${mySeat}) on Table #${initStatus.tableId}`,
            "#3fb950",
          );
        } catch (initErr: any) {
          const msg = (initErr && initErr.message) || String(initErr);
          const stack = initErr && initErr.stack ? String(initErr.stack) : undefined;
          autoPlayCtrl.stopReason = `init_error:${msg}`;
          if (stopOnIssue) {
            void postLocalAbort(msg, {
              playerId: Number(getUi()?.player_id || 0),
              stack,
              state: getUi()?.gamedatas?.gamestate?.name || "",
            });
          }
          finish(false, msg, stack);
          return;
        }

        const checkPrevpacketBuffer = () => {
          const nq = ui?.notifqueue;
          if (!nq || !Array.isArray(nq.prevpacketBuffer) || nq.prevpacketBuffer.length === 0) {
            return;
          }
          if (nq.notificationResendInProgress) return;
          const now = Date.now();
          let oldestAge = 0;
          for (let i = 0; i < nq.prevpacketBuffer.length; i++) {
            const age = now - Number(nq.prevpacketBuffer[i]?.bufferedAt || now);
            if (age > oldestAge) oldestAge = age;
          }
          const thresholdMs = isLocalHost ? 350 : 2500;
          if (oldestAge > thresholdMs && now - lastResyncAt > 500) {
            lastResyncAt = now;
            let fromPacketId: number | null = null;
            for (let i = 0; i < nq.prevpacketBuffer.length; i++) {
              const a = nq.prevpacketBuffer[i];
              const prevMap = a?.notifs?.prevpacket;
              if (!prevMap || typeof prevMap !== "object") continue;
              for (const s of Object.keys(prevMap)) {
                const r =
                  typeof nq.resolvePrevpacketChannelKey === "function"
                    ? nq.resolvePrevpacketChannelKey(s, a.notifs, a.channelKey)
                    : null;
                if (
                  r &&
                  nq.channelLastAppliedPacketId &&
                  nq.channelLastAppliedPacketId[r] !== undefined
                ) {
                  const l = Number(
                    nq.getLastAppliedPacketIdForChannel?.(r) ?? nq.channelLastAppliedPacketId[r],
                  );
                  if (Number(prevMap[s]) > l) {
                    const d = l + 1;
                    if (fromPacketId === null || d < fromPacketId) {
                      fromPacketId = d;
                    }
                  }
                }
              }
            }
            if (fromPacketId === null && nq.last_packet_id !== undefined) {
              fromPacketId = Number(nq.last_packet_id) + 1;
            }
            nq.resynchronizeNotifications?.(false, fromPacketId ?? undefined);
          }
        };

        const readSharedAbort = () => {
          if (ui?._abortState) {
            const ts = Number(ui._abortState?.timestamp || 0);
            if (ts && ts < autoPlayCtrl.startedAt) {
              delete ui._abortState;
            } else {
              return;
            }
          }
          if (isLocalHost || !autoPlayCtrl.tableId) return;
          try {
            const key = `tichu_studio_abort_${autoPlayCtrl.tableId}`;
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              const ts = Number(parsed?.timestamp || 0);
              if (ts && ts < autoPlayCtrl.startedAt) {
                localStorage.removeItem(key);
              } else {
                ui._abortState = parsed;
              }
            }
          } catch (_e) {}
        };

        const isTransientTurnRaceError = (msg: string): boolean =>
          /This is not your turn|This game action is impossible right now|The game changed while your action was being processed|You cannot pass now|You can't play a bomb right now|You can't bomb before the trick starts/i.test(
            msg,
          );

        const tick = async () => {
          if (isSuperseded()) {
            finish(false, "superseded");
            return;
          }
          if (ticking || finished) return;
          if (autoPlayCtrl.stopRequested) {
            finish(false, autoPlayCtrl.stopReason || "stopped");
            return;
          }
          readSharedAbort();
          if (ui._abortState) {
            autoPlayCtrl.stopReason = `shared_abort:${ui._abortState.reason || "issue"}`;
            finish(
              false,
              `Shared abort from P${ui._abortState.playerId ?? "?"}: ${ui._abortState.reason || "issue"}`,
            );
            return;
          }
          if (Date.now() - autoPlayCtrl.startedAt > timeoutMs) {
            finish(false, `AutoPlay timed out after ${timeoutMs}ms`);
            return;
          }
          ticking = true;
          try {
            checkPrevpacketBuffer();
            if (isQueueBusy()) {
              return;
            }
            await waitLitUpdates();
            if (isSuperseded() || finished) {
              finish(false, "superseded");
              return;
            }
            readSharedAbort();
            if (ui._abortState) {
              autoPlayCtrl.stopReason = `shared_abort:${ui._abortState.reason || "issue"}`;
              finish(
                false,
                `Shared abort from P${ui._abortState.playerId ?? "?"}: ${ui._abortState.reason || "issue"}`,
              );
              return;
            }

            if (stopOnIssue) {
              const curIssues = tt.getConsoleIssues();
              if (curIssues.length > 0 || autoPlayCtrl.actionErrors.length > 0) {
                const reason =
                  autoPlayCtrl.actionErrors[0]?.error ||
                  curIssues[0]?.message ||
                  "console_or_action_issue";
                autoPlayCtrl.stopReason = `issue:${reason}`;
                await postLocalAbort(reason, {
                  playerId: myPlayerId,
                  consoleIssues: curIssues,
                  actionErrors: autoPlayCtrl.actionErrors,
                  state: autoPlayCtrl.lastState,
                });
                finish(false, `Stopped on issue: ${reason}`);
                return;
              }
            }

            const cur = tt.status(false);
            if (!cur) return;

            if (cur.state.name !== prevTickStateName) {
              lastActedKey = "";
              prevTickStateName = cur.state.name;
              waitingCardsSince = 0;
              waitingSeatResynced = false;
            }

            const stateSig = `${cur.round}:${cur.trick}:${cur.state.name}:${cur.activePlayerId}:${cur.multiactiveIds.join(",")}:${(ui.gamedatas?.hand || []).length}:${isConfirmTichuVisible() ? 1 : 0}`;
            if (stateSig !== lastProgressSig) {
              lastProgressSig = stateSig;
              lastProgressAt = Date.now();
            }
            autoPlayCtrl.lastRound = cur.round;
            autoPlayCtrl.lastTrick = cur.trick;
            autoPlayCtrl.lastState = cur.state.name;
            writeLiveOutput(cur);

            if (cur.state.name === "gameEnd" || cur.state.id === 99) {
              finish();
              return;
            }

            if (Date.now() - lastProgressAt > stallTimeoutMs) {
              const reason = `Stalled for >${Math.round(stallTimeoutMs / 1000)}s in state ${cur.state.name} (round=${cur.round}, trick=${cur.trick}, active=${cur.activePlayerId}, multi=${cur.multiactiveIds.join(",")}, hand=${(ui.gamedatas?.hand || []).length})`;
              autoPlayCtrl.stopReason = reason;
              if (stopOnIssue) {
                await postLocalAbort(reason, {
                  playerId: myPlayerId,
                  state: cur.state.name,
                  round: cur.round,
                  trick: cur.trick,
                  activePlayerId: cur.activePlayerId,
                  multiactiveIds: cur.multiactiveIds,
                  handCount: (ui.gamedatas?.hand || []).length,
                });
              }
              finish(false, reason);
              return;
            }

            const confirmNowVisible = cur.state.name === "confirmTichu" || isConfirmTichuVisible();
            if (!cur.isMyTurn && !confirmNowVisible) {
              waitingCardsSince = 0;
              waitingSeatResynced = false;
              // Check out-of-turn bomb opportunity in playCombo.
              if (
                cur.state.name === "playCombo" &&
                !ui.isSpectator &&
                (ui.gamedatas?.hand || []).length >= 4
              ) {
                const issuesBefore = consoleIssues.length;
                const actionLogBefore = actionErrorLog.length;
                const ctrlErrBefore = autoPlayCtrl.actionErrors.length;
                try {
                  const bombRes = await tt.actMyTurn();
                  autoPlayCtrl.assertionsPassed += bombRes.assertionsPassed || 0;
                  if (bombRes.acted) {
                    lastActedKey = "";
                    autoPlayCtrl.movesPlayed++;
                    lastProgressAt = Date.now();
                    autoPlayCtrl.moveHistory.push({
                      move: autoPlayCtrl.movesPlayed,
                      round: cur.round,
                      trick: cur.trick,
                      state: bombRes.stateBefore || cur.state.name,
                      action: bombRes.action || "",
                    });
                    if (autoPlayCtrl.moveHistory.length > 50) {
                      autoPlayCtrl.moveHistory.shift();
                    }
                    writeLiveOutput(bombRes.status || tt.status(false));
                    scheduleKick();
                    return;
                  }
                } catch (bombErr: any) {
                  const msg = (bombErr && bombErr.message) || String(bombErr);
                  if (isTransientTurnRaceError(msg)) {
                    consoleIssues.length = issuesBefore;
                    actionErrorLog.length = actionLogBefore;
                    autoPlayCtrl.actionErrors.length = ctrlErrBefore;
                    return;
                  }
                  throw bombErr;
                }
              }

              if (
                Date.now() - lastProgressAt > 15000 &&
                Date.now() - lastResyncAt > 5000 &&
                ui.notifqueue &&
                !ui.notifqueue.notificationResendInProgress
              ) {
                lastResyncAt = Date.now();
                ui.notifqueue.resynchronizeNotifications?.(false);
              }
              return;
            }

            if (cur.state.type === "multipleactiveplayer" && cur.isMyTurn && !confirmNowVisible) {
              const key = `${cur.round}:${cur.state.name}`;
              if (multiactiveKey !== key) {
                multiactiveKey = key;
                multiactiveSeenAt = Date.now();
              }
              const targetWait = Math.max(0, mySeat) * staggerMs;
              const elapsedWait = Date.now() - multiactiveSeenAt;
              if (elapsedWait < targetWait) {
                setTimeout(scheduleKick, Math.max(20, targetWait - elapsedWait));
                return;
              }
            } else {
              multiactiveKey = "";
            }

            if (lastActedKey && lastActedKey === stateSig && Date.now() - lastActedAt < 1500) {
              return;
            }

            const loopIssuesBefore = consoleIssues.length;
            const loopActionLogBefore = actionErrorLog.length;
            const loopCtrlErrBefore = autoPlayCtrl.actionErrors.length;
            let actedOk = false;
            let lastErr: any = null;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const res = await tt.actMyTurn();
                autoPlayCtrl.assertionsPassed += res.assertionsPassed || 0;
                if (res.acted) {
                  waitingCardsSince = 0;
                  waitingSeatResynced = false;
                  lastActedKey = stateSig;
                  lastActedAt = Date.now();
                  autoPlayCtrl.movesPlayed++;
                  lastProgressAt = Date.now();
                  autoPlayCtrl.moveHistory.push({
                    move: autoPlayCtrl.movesPlayed,
                    round: cur.round,
                    trick: cur.trick,
                    state: res.stateBefore || cur.state.name,
                    action: res.action || "",
                  });
                  if (autoPlayCtrl.moveHistory.length > 50) {
                    autoPlayCtrl.moveHistory.shift();
                  }
                  writeLiveOutput(res.status || tt.status(false));
                  actedOk = true;
                } else if (res.reason === "waiting_8_cards" || res.reason === "waiting_14_cards") {
                  if (!waitingCardsSince) {
                    waitingCardsSince = Date.now();
                  }
                  const waitedMs = Date.now() - waitingCardsSince;
                  if (waitedMs > 12000) {
                    const reason = `Stuck waiting for cards in ${cur.state.name} (reason=${res.reason}, hand=${(ui.gamedatas?.hand || []).length})`;
                    autoPlayCtrl.stopReason = reason;
                    if (stopOnIssue) {
                      await postLocalAbort(reason, {
                        playerId: myPlayerId,
                        state: cur.state.name,
                        round: cur.round,
                        trick: cur.trick,
                        handCount: (ui.gamedatas?.hand || []).length,
                        waitReason: res.reason,
                      });
                    }
                    finish(false, reason);
                    return;
                  }
                  if (
                    waitedMs > 1500 &&
                    Date.now() - lastResyncAt > 2000 &&
                    ui.notifqueue &&
                    !ui.notifqueue.notificationResendInProgress
                  ) {
                    lastResyncAt = Date.now();
                    ui.notifqueue.resynchronizeNotifications?.(false);
                  }
                  if (waitedMs > 3000 && !waitingSeatResynced && isLocalHost) {
                    waitingSeatResynced = true;
                    await ui._switchSeatInPlace?.(myPlayerId);
                  }
                  setTimeout(scheduleKick, 120);
                  actedOk = true;
                } else {
                  waitingCardsSince = 0;
                  waitingSeatResynced = false;
                  actedOk = true;
                }
                break;
              } catch (err: any) {
                lastErr = err;
                const msg = (err && err.message) || String(err);
                const stack = err && err.stack ? String(err.stack) : undefined;
                autoPlayCtrl.actionErrors.push({
                  ts: new Date().toISOString(),
                  state: cur.state.name,
                  error: `attempt ${attempt + 1} (${stateSig}): ${msg}`,
                  ...(stack ? { stack } : {}),
                });
                if (stopOnIssue && msg.indexOf("[ASSERT_UI FAILED]") !== -1) {
                  break;
                }
                if (attempt < 2 && isTransientTurnRaceError(msg)) {
                  consoleIssues.length = loopIssuesBefore;
                  actionErrorLog.length = loopActionLogBefore;
                  autoPlayCtrl.actionErrors.length = loopCtrlErrBefore;
                  await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
                  await waitUntilIdle(5000, 30);
                  const recheck = tt.status(false);
                  if (
                    !recheck ||
                    !recheck.isMyTurn ||
                    recheck.state.name !== cur.state.name ||
                    recheck.round !== cur.round ||
                    recheck.trick !== cur.trick ||
                    recheck.state.name === "gameEnd"
                  ) {
                    actedOk = true;
                    break;
                  }
                } else {
                  break;
                }
              }
            }
            if (!actedOk && lastErr) {
              const msg = (lastErr && lastErr.message) || String(lastErr);
              const stack = lastErr && lastErr.stack ? String(lastErr.stack) : undefined;
              if (stopOnIssue) {
                await postLocalAbort(msg, {
                  playerId: myPlayerId,
                  stack,
                  consoleIssues: tt.getConsoleIssues(),
                  actionErrors: autoPlayCtrl.actionErrors,
                  state: cur.state.name,
                });
              }
              finish(false, msg, stack);
              return;
            }
            if (stopOnIssue) {
              const postIssues = tt.getConsoleIssues();
              if (postIssues.length > 0 || autoPlayCtrl.actionErrors.length > 0) {
                const reason =
                  autoPlayCtrl.actionErrors[0]?.error ||
                  postIssues[0]?.message ||
                  "console_or_action_issue";
                await postLocalAbort(reason, {
                  playerId: myPlayerId,
                  consoleIssues: postIssues,
                  actionErrors: autoPlayCtrl.actionErrors,
                  state: tt.status(false)?.state?.name || cur.state.name,
                });
                finish(false, `Stopped on issue: ${reason}`);
                return;
              }
            }
            const afterCur = tt.status(false);
            if (afterCur && (afterCur.state.name === "gameEnd" || afterCur.state.id === 99)) {
              finish();
              return;
            }
          } catch (outerErr: any) {
            const msg = (outerErr && outerErr.message) || String(outerErr);
            const stack = outerErr && outerErr.stack ? String(outerErr.stack) : undefined;
            if (stopOnIssue) {
              await postLocalAbort(msg, {
                playerId: myPlayerId,
                stack,
                consoleIssues: tt.getConsoleIssues(),
                actionErrors: autoPlayCtrl.actionErrors,
                state: autoPlayCtrl.lastState,
              });
            }
            finish(false, msg, stack);
          } finally {
            ticking = false;
          }
        };

        let kickQueued = false;
        const scheduleKick = () => {
          if (isSuperseded()) {
            finish(false, "superseded");
            return;
          }
          if (finished || kickQueued) return;
          kickQueued = true;
          const runKick = () => {
            kickQueued = false;
            void tick();
          };
          if (mc) {
            mc.port2.postMessage(null);
          } else {
            void nextMicrotaskTick().then(runKick);
          }
        };
        if (mc) {
          mc.port1.onmessage = () => {
            kickQueued = false;
            void tick();
          };
        }

        autoPlayCtrl.kick = scheduleKick;

        const dojoObj = (window as any).dojo;
        if (dojoObj && typeof dojoObj.subscribe === "function") {
          for (const topic of [
            "gameStateChange",
            "gameStateMultipleActiveUpdate",
            "dealCards",
            "acceptCards",
            "playCombo",
            "pass",
            "newScores",
          ]) {
            dojoSubs.push(dojoObj.subscribe(topic, null, () => scheduleKick()));
          }
        }

        intervalId = window.setInterval(scheduleKick, 250);
        scheduleKick();
      });
    },

    refreshBar() {},

    scheduleRefreshBar() {},

    showTests(_open = true) {},

    showBar() {},

    onQueueDrained() {
      scheduleAutoBot();
    },
  };

  let autoPlayRunSeq = 0;

  const autoPlayCtrl = {
    running: false,
    runId: 0,
    stopRequested: false,
    stopReason: "",
    tableId: 0,
    player: "",
    playerId: 0,
    seat: -1,
    movesPlayed: 0,
    assertionsPassed: 0,
    actionErrors: [] as Array<{ ts: string; state: string; error: string; stack?: string }>,
    moveHistory: [] as Array<{
      move: number;
      round: number;
      trick: number;
      state: string;
      action: string;
    }>,
    startedAt: 0,
    lastRound: 0,
    lastTrick: 0,
    lastState: "",
    kick: () => {},
  };

  function mountStudioTestBar() {
    if (!isLocalHost && typeof win.g_replayFrom !== "undefined") return;
    const localDevBar = isLocalHost ? document.getElementById("local-dev-bar") : null;
    const wrap = document.getElementById("game_play_area_wrap");
    if (!localDevBar && (!wrap || !wrap.parentNode) && !document.body) return;
    if (document.getElementById("studio-test-bar")) {
      (win.tt || tt).refreshBar?.();
      return;
    }

    if (!document.getElementById("studio-test-bar-styles") && document.head) {
      const styleEl = document.createElement("style");
      styleEl.id = "studio-test-bar-styles";
      styleEl.textContent = `
        #studio-test-bar {
          background: #161b22;
          color: #e6edf3;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 6px 10px;
          margin: 4px 0 8px 0;
          width: 100%;
          box-sizing: border-box;
          font-family: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          z-index: 100;
          position: relative;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
        }
        #studio-test-bar.is-local-host {
          background: transparent;
          border: none;
          border-radius: 0;
          padding: 0;
          margin: 0;
          box-shadow: none;
        }
        #studio-test-bar.is-collapsed {
          gap: 0;
        }
        #studio-test-bar.is-collapsed #tt_bar_body {
          display: none;
        }
        #studio-test-bar * {
          box-sizing: border-box;
        }
        #tt_bar_primary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          width: 100%;
        }
        #studio-test-bar .devbar-group {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        #studio-test-bar .devbar-seats {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
        }
        #studio-test-bar .devbar-brand {
          font-weight: 700;
          font-size: 13px;
          color: #58a6ff;
          margin-right: 4px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }
        #studio-test-bar .devbar-divider {
          width: 1px;
          height: 22px;
          background: #30363d;
          margin: 0 2px;
        }
        #studio-test-bar .devbar-label {
          color: #8b949e;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        #studio-test-bar .devbar-btn,
        #studio-test-bar .devbar-seat {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 4px 9px;
          margin: 0;
          width: auto !important;
          min-width: 0;
          height: auto;
          line-height: 1.3;
          border-radius: 5px;
          border: 1px solid #30363d;
          background: #21262d;
          color: #c9d1d9;
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease, transform 0.06s ease;
          user-select: none;
          white-space: nowrap;
          text-decoration: none !important;
          text-shadow: none;
          box-shadow: none;
        }
        #studio-test-bar .devbar-btn:hover,
        #studio-test-bar .devbar-seat:hover {
          background: #30363d;
          border-color: #8b949e;
          color: #ffffff;
        }
        #studio-test-bar .devbar-btn:active,
        #studio-test-bar .devbar-seat:active {
          transform: translateY(1px);
        }
        #studio-test-bar .devbar-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        #studio-test-bar .devbar-seat.is-viewer {
          background: #1f6feb;
          border-color: #58a6ff;
          color: #ffffff;
          box-shadow: 0 0 0 1px rgba(88, 166, 255, 0.4);
        }
        #studio-test-bar .devbar-seat.is-active-turn {
          border-color: #f0883e;
        }
        #studio-test-bar .devbar-color-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          display: inline-block;
          border: 1px solid rgba(255, 255, 255, 0.5);
          flex-shrink: 0;
        }
        #studio-test-bar .devbar-turn-badge {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #3fb950;
          box-shadow: 0 0 6px #3fb950;
          animation: devbar-pulse 1.2s infinite ease-in-out;
        }
        @keyframes devbar-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.85); }
        }
        #studio-test-bar .devbar-meta {
          font-size: 11px;
          opacity: 0.85;
          font-weight: 500;
        }
        #studio-test-bar .devbar-btn.active-toggle {
          background: #238636;
          border-color: #2ea043;
          color: #ffffff;
        }
        #studio-test-bar .devbar-btn.bot-btn {
          background: #2d333b;
          border-color: #444c56;
          color: #79c0ff;
        }
        #studio-test-bar .devbar-btn.bot-btn:hover {
          background: #373e47;
          border-color: #58a6ff;
        }
        #studio-test-bar .devbar-btn.danger-btn {
          background: #21262d;
          border-color: #da3633;
          color: #ff7b72;
        }
        #studio-test-bar .devbar-btn.danger-btn:hover {
          background: #da3633;
          color: #ffffff;
        }
        #studio-test-bar .devbar-btn.tt-btn-primary {
          background: #238636;
          color: #ffffff;
          border-color: #2ea043;
          font-weight: 700;
        }
        #studio-test-bar .devbar-btn.tt-btn-primary:hover {
          background: #2ea043;
          border-color: #3fb950;
        }
        #tt_bar_body {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding-top: 6px;
          border-top: 1px solid #30363d;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
        }
        #tt_bar_body .devbar-btn {
          height: 24px;
          padding: 2px 8px;
          font-size: 11px;
        }
        #tt_btn_grid,
        #tt_cmd_row,
        #tt_output_row {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 5px;
          align-items: center;
        }
        #tt_btn_grid button,
        #tt_cmd_run,
        #tt_output_toggle {
          width: 100% !important;
        }
        #tt_cmd_input,
        #tt_test_output {
          grid-column: span 5;
          width: 100% !important;
          min-width: 0;
        }
        #tt_scenario_row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        #tt_scenario_select {
          height: 24px;
          min-width: 220px;
          background: #0d1117;
          color: #e6edf3;
          border: 1px solid #30363d;
          border-radius: 4px;
          padding: 2px 6px;
          font-family: inherit;
          font-size: 11px;
        }
        #tt_scenario_select:focus {
          outline: none;
          border-color: #58a6ff;
        }
        @media (max-width: 720px) {
          #tt_btn_grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          #tt_cmd_row,
          #tt_output_row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          #tt_cmd_input,
          #tt_test_output {
            grid-column: span 2;
          }
        }
        @media (max-width: 480px) {
          #tt_btn_grid,
          #tt_cmd_row,
          #tt_output_row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          #tt_cmd_input,
          #tt_test_output {
            grid-column: span 1;
          }
        }
        #tt_cmd_input {
          height: 24px;
          background: #0d1117;
          color: #e6edf3;
          border: 1px solid #30363d;
          border-radius: 4px;
          padding: 2px 8px;
          font-family: inherit;
          font-size: 11px;
        }
        #tt_cmd_input:focus {
          outline: none;
          border-color: #58a6ff;
        }
        #tt_test_output {
          margin: 0;
          padding: 3px 8px;
          height: 24px;
          line-height: 16px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 4px;
          color: #8b949e;
          font-family: inherit;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
        }
        #tt_test_output.is-expanded {
          height: auto;
          max-height: 200px;
          padding: 5px 8px;
          white-space: pre-wrap;
          word-break: break-word;
          overflow: auto;
        }
        #studio-test-tooltip {
          position: fixed;
          z-index: 100000;
          max-width: 320px;
          background: #0d1117;
          color: #f0f6fc;
          border: 1px solid #58a6ff;
          border-radius: 6px;
          padding: 6px 10px;
          font-family: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
          font-size: 12px;
          font-weight: 500;
          line-height: 1.4;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.1s ease;
        }
        #studio-test-tooltip.is-visible {
          opacity: 1;
          visibility: visible;
        }
      `;
      document.head.appendChild(styleEl);
    }

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const tips = {
      smoke: esc(
        "Run full smoke test: completes Grand Tichu bets, passes 3 cards for all players, plays tricks at instant speed, and verifies DOM/UI state invariants (tt.runSmokeTest).",
      ),
      round: esc(
        "Fast-forward the current round to completion using bot moves at instant speed and verify UI state (tt.runRound).",
      ),
      game: esc(
        "Fast-forward the entire game to Game End (state 99) using bot moves at instant speed (tt.runGame).",
      ),
      gtAll: esc(
        "Decline Grand Tichu (bet 0) for all 4 players in the current tab without switching player views (tt.betAllGrandTichu).",
      ),
      passAll: esc(
        "Select and pass 3 default low singleton cards for the active viewer and run bots for the other 3 players (tt.passAllCards).",
      ),
      step1: esc(
        "Execute 1 rule-compliant server bot move (debug_botStep) for whichever player is currently active (tt.step(1)).",
      ),
      others: esc(
        "Have rule-compliant bots (debug_botOthers) play for the other 3 players until your turn (tt.actForOthers).",
      ),
      autobot: esc(
        "When ON (per-tab sessionStorage), automatically runs tt.actForOthers() ~300ms after queue drain (2000ms in real-time confirmTrick).",
      ),
      tiki: esc("Toggle between classic Tichu card artwork and Tiki Edition artwork (pref 103)."),
      exposed: esc(
        "Toggle between Real-Time mode and Turn-Based mode (Turn-Based exposes Played Cards and auto-passes unbeatable hands). Starts a new game.",
      ),
      mute: esc("Toggle game sound effects (Tichu / Grand Tichu laser sound) on or off."),
      replay: esc("Open the Experimental Replay viewer for this finished game."),
      newGame: esc("Reset the local database and start a fresh 4-player Tichu game."),
      assert: esc(
        "Verify that live DOM elements (hand cards, round/trick/points counters, player hand counts) match gamedatas and output table status JSON (tt.assertUI + tt.status).",
      ),
      newTable: esc(
        "Stop the current table, create a new 4-player Tichu table, express-start it, and navigate there (tt.expressStartNew).",
      ),
      stopTable: esc("Immediately abort and close the current BGA Studio table (tt.expressStop)."),
      testsDrawer: esc("Show or hide the automated test buttons, scenarios, and command runner."),
      scenarioSelect: esc("Choose a deterministic Tichu scenario to load in local runner."),
      loadScenario: esc("Load the selected deterministic scenario into the local database."),
      cmdInput: esc(
        "Type any window.tt method with optional colon argument — e.g. status, hand, assertUI, wish:8, play:S10, pass, step:4, giveDragon:0. Press Enter or click Run.",
      ),
      cmdRun: esc(
        "Execute the window.tt command from the input box and display its JSON result below.",
      ),
      output: esc(
        "Click to toggle between single-line compact JSON and expanded multi-line formatted JSON.",
      ),
      outputToggle: esc(
        "Expand or collapse the JSON output area between 1 line and a larger multi-line box.",
      ),
    };

    const bar = document.createElement("div");
    bar.id = "studio-test-bar";
    bar.className = isLocalHost && localDevBar ? "is-local-host" : "is-studio-host";
    const initialOpen = getDrawerDefaultOpen();
    bar.classList.toggle("is-collapsed", !initialOpen);

    const brandLabel = isLocalHost ? "🀄 Tichu Local" : "🀄 Tichu Studio";
    const localControlsHtml = isLocalHost
      ? `<button type="button" id="devbar_exposed" class="devbar-btn" data-tooltip="${tips.exposed}">⏱ Real-Time</button>` +
        `<button type="button" id="devbar_mute" class="devbar-btn" data-tooltip="${tips.mute}">🔊</button>`
      : "";
    const replayBtnHtml = `<button type="button" id="devbar_replay" class="devbar-btn" style="display:none" data-tooltip="${tips.replay}">📼 Replay</button>`;
    const tableControlsHtml = isLocalHost
      ? `<button type="button" id="devbar_new_game" class="devbar-btn danger-btn" data-tooltip="${tips.newGame}">🔄 New Game</button>`
      : `<button type="button" id="tt_btn_new" class="devbar-btn" data-tooltip="${tips.newTable}">🔄 New Table</button>` +
        `<button type="button" id="tt_btn_stop" class="devbar-btn danger-btn" data-tooltip="${tips.stopTable}">⏹ Express Stop</button>`;

    const scenarioRowHtml = isLocalHost
      ? `<div id="tt_scenario_row">` +
        `<label for="tt_scenario_select" class="devbar-label">Scenario:</label>` +
        `<select id="tt_scenario_select" data-tooltip="${tips.scenarioSelect}">` +
        `<option value="grand_tichu">grand_tichu — Grand Tichu Bets</option>` +
        `<option value="give_cards">give_cards — Pass 3 Cards (Bomb Completed)</option>` +
        `<option value="mahjong_wish">mahjong_wish — Mahjong Wish &amp; Fulfill</option>` +
        `<option value="phoenix_ambiguous">phoenix_ambiguous — Phoenix Straight</option>` +
        `<option value="bomb_interrupt">bomb_interrupt — Out-of-Turn Bomb Interrupt</option>` +
        `<option value="dragon_gift">dragon_gift — Dragon Trick Gift</option>` +
        `<option value="double_victory">double_victory — Double Victory Round End</option>` +
        `</select>` +
        `<button type="button" id="tt_btn_load_scenario" class="devbar-btn" data-tooltip="${tips.loadScenario}">🎬 Load Scenario</button>` +
        `</div>`
      : "";

    bar.innerHTML =
      `<div id="tt_bar_primary">` +
      `<div class="devbar-group">` +
      `<span class="devbar-brand">${brandLabel}</span>` +
      `<span class="devbar-label">Seat:</span>` +
      `<span id="tt_seats_wrap" class="devbar-seats"></span>` +
      `</div>` +
      `<div class="devbar-group">` +
      `<span id="devbar_state_label" class="devbar-label">State: <strong id="devbar_state_name" style="color:#e6edf3">-</strong></span>` +
      `<div class="devbar-divider"></div>` +
      `<button type="button" id="tt_btn_others" class="devbar-btn bot-btn" data-tooltip="${tips.others}">🤖 Act for Others</button>` +
      `<button type="button" id="tt_btn_step1" class="devbar-btn bot-btn" data-tooltip="${tips.step1}">🤖 Step 1</button>` +
      `<button type="button" id="devbar_autobot" class="devbar-btn" data-tooltip="${tips.autobot}">⚡ Auto-Bot: OFF</button>` +
      `<div class="devbar-divider"></div>` +
      `<button type="button" id="devbar_tiki" class="devbar-btn" data-tooltip="${tips.tiki}">🗿 Tiki: OFF</button>` +
      localControlsHtml +
      replayBtnHtml +
      tableControlsHtml +
      `<div class="devbar-divider"></div>` +
      `<button type="button" id="tt_btn_collapse" class="devbar-btn${initialOpen ? " active-toggle" : ""}" aria-expanded="${initialOpen ? "true" : "false"}" data-tooltip="${tips.testsDrawer}">${initialOpen ? "🧪 Tests ▾" : "🧪 Tests ▸"}</button>` +
      `</div>` +
      `</div>` +
      `<div id="tt_bar_body">` +
      `<div id="tt_btn_grid">` +
      `<button type="button" id="tt_btn_smoke" class="devbar-btn tt-btn-primary" data-tooltip="${tips.smoke}">🧪 Smoke Test</button>` +
      `<button type="button" id="tt_btn_round" class="devbar-btn" data-tooltip="${tips.round}">🏁 Run Round</button>` +
      `<button type="button" id="tt_btn_game" class="devbar-btn" data-tooltip="${tips.game}">🏆 Run Game</button>` +
      `<button type="button" id="tt_btn_gt_all" class="devbar-btn" data-tooltip="${tips.gtAll}">⚡ GT Bet All 4</button>` +
      `<button type="button" id="tt_btn_pass_all" class="devbar-btn" data-tooltip="${tips.passAll}">🃏 Pass 3 + Bots</button>` +
      `<button type="button" id="tt_btn_assert" class="devbar-btn" data-tooltip="${tips.assert}">✔ Assert UI</button>` +
      `</div>` +
      scenarioRowHtml +
      `<div id="tt_cmd_row">` +
      `<input type="text" id="tt_cmd_input" placeholder="Command: e.g. status, hand, wish:8, play:S10, step:4" data-tooltip="${tips.cmdInput}" />` +
      `<button type="button" id="tt_cmd_run" class="devbar-btn" data-tooltip="${tips.cmdRun}">▶ Run</button>` +
      `</div>` +
      `<div id="tt_output_row">` +
      `<pre id="tt_test_output" data-done="1" data-status="ready" data-tooltip="${tips.output}">Ready — click a button or run \`await tt.runSmokeTest()\` in console.</pre>` +
      `<button type="button" id="tt_output_toggle" class="devbar-btn" data-tooltip="${tips.outputToggle}">▾ Expand</button>` +
      `</div>` +
      `</div>`;

    if (localDevBar) {
      localDevBar.innerHTML = "";
      localDevBar.appendChild(bar);
    } else if (wrap && wrap.parentNode) {
      wrap.parentNode.insertBefore(bar, wrap);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }

    // Custom instant tooltip handler
    let tipEl = document.getElementById("studio-test-tooltip");
    if (!tipEl && document.body) {
      tipEl = document.createElement("div");
      tipEl.id = "studio-test-tooltip";
      tipEl.setAttribute("role", "tooltip");
      document.body.appendChild(tipEl);
    }
    const hideTip = () => {
      if (tipEl) tipEl.classList.remove("is-visible");
    };
    const showTipFor = (target: EventTarget | null) => {
      if (!tipEl || !(target instanceof Element)) {
        hideTip();
        return;
      }
      const host = target.closest("[data-tooltip]");
      if (!host || !bar.contains(host)) {
        hideTip();
        return;
      }
      const text = host.getAttribute("data-tooltip");
      if (!text) {
        hideTip();
        return;
      }
      tipEl.textContent = text;
      tipEl.classList.add("is-visible");
      const rect = host.getBoundingClientRect();
      const tipWidth = tipEl.offsetWidth || 260;
      const tipHeight = tipEl.offsetHeight || 36;
      const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - tipWidth - 8));
      const top =
        rect.bottom + tipHeight + 12 > window.innerHeight
          ? Math.max(8, rect.top - tipHeight - 6)
          : rect.bottom + 6;
      tipEl.style.left = `${Math.round(left)}px`;
      tipEl.style.top = `${Math.round(top)}px`;
    };

    bar.addEventListener("mouseover", (e) => showTipFor(e.target));
    bar.addEventListener("focusin", (e) => showTipFor(e.target));
    bar.addEventListener("mouseout", (e) => {
      const next = e.relatedTarget as Element | null;
      if (!next || !bar.contains(next) || !next.closest("[data-tooltip]")) {
        hideTip();
      }
    });
    bar.addEventListener("focusout", hideTip);
    bar.addEventListener("mousedown", hideTip);

    const collapseBtn = document.getElementById("tt_btn_collapse");
    const seatsWrap = document.getElementById("tt_seats_wrap");

    const setDrawerOpen = (open: boolean, persist = true) => {
      hideTip();
      bar.classList.toggle("is-collapsed", !open);
      if (collapseBtn) {
        collapseBtn.classList.toggle("active-toggle", open);
        collapseBtn.setAttribute("aria-expanded", open ? "true" : "false");
        collapseBtn.textContent = open ? "🧪 Tests ▾" : "🧪 Tests ▸";
      }
      if (persist) {
        safeSessionSet("tichu_tt_drawer", open ? "1" : "0");
      }
    };

    const activeTt = () => win.tt || tt;

    let lastBarDirtyKey = "";
    let refreshBarRafId: number | null = null;

    const getRefreshBarSnapshot = () => {
      const ui = getUi();
      const gd = ui?.gamedatas || {};
      const st = gd.gamestate || {};
      const gmState = win.gameModel?.getState?.();
      const stateName = String(st.name || gmState?.stateName || "");
      const stateType = String(st.type || "");
      const stateId = Number(st.id || 0);
      const isGameEnd = stateId === 99 || stateName === "gameEnd";
      const isSpectator = Boolean(ui?.isSpectator ?? gmState?.isSpectator ?? false);
      const viewerId = isSpectator ? 0 : Number(ui?.player_id || gmState?.currentPlayerId || 0);
      const tableId = Number(
        ui?.table_id || gd.table_id || (window as any).bgaGameData?.tableId || 0,
      );

      let playersList: any[] = getSortedPlayers();
      if (playersList.length === 0 && Array.isArray(ui?.devBarPlayers)) {
        playersList = [...ui.devBarPlayers].sort((a, b) => Number(a.no) - Number(b.no));
      } else if (playersList.length === 0 && gmState?.players) {
        playersList = Object.values(gmState.players).sort(
          (a: any, b: any) => Number(a.no) - Number(b.no),
        );
      }

      const activeSet = new Set<number>(getActivePlayerIds(ui));
      if (activeSet.size === 0 && !stateType && Array.isArray(ui?.devBarPlayers)) {
        for (let i = 0; i < ui.devBarPlayers.length; i++) {
          const dp = ui.devBarPlayers[i];
          if (dp && dp.isActive) activeSet.add(Number(dp.id));
        }
      }

      const playerMeta = playersList.map((p: any, idx: number) => {
        const pId = Number(p.id);
        const gmPlayer = gmState?.players?.[String(pId)];
        const devPlayer = Array.isArray(ui?.devBarPlayers)
          ? ui.devBarPlayers.find((d: any) => Number(d.id) === pId)
          : null;
        const handCount =
          gmPlayer !== undefined
            ? Number(gmPlayer.handcount ?? 0)
            : gd.handcount && gd.handcount[pId] !== undefined
              ? Number(gd.handcount[pId])
              : Number(devPlayer?.handCount ?? 0);
        const pNo = Number(p.no ?? gmPlayer?.no ?? idx + 1);
        const pName = String(p.name ?? gmPlayer?.name ?? `P${pNo}`);
        const color = String(p.color || gmPlayer?.color || "000000");
        const teamNum = p.team !== undefined ? Number(p.team) + 1 : ((pNo - 1) % 2) + 1;
        return {
          pId,
          pNo,
          pName,
          color,
          teamNum,
          handCount,
          isActive: activeSet.has(pId),
          isViewer: !isSpectator && pId === viewerId,
        };
      });

      const autoBotOn = getAutoBotEnabled();
      const isTiki = gmState ? Boolean(gmState.isTiki) : Number(ui?.prefs?.[103]?.value ?? 2) === 1;
      const isTurnBased = isLocalHost ? Boolean(ui?.localOptions?.turnBased) : false;
      const isMuted = isLocalHost ? safeLocalGet("tichu_local_mute") === "1" : false;
      const isReplay = Boolean(ui?.experimentalArchiveModeEnabled);

      const dirtyKey = [
        tableId,
        viewerId,
        isSpectator ? 1 : 0,
        stateId,
        stateName,
        stateType,
        isGameEnd ? 1 : 0,
        playerMeta
          .map((m) => `${m.pId}:${m.handCount}:${m.isActive ? 1 : 0}:${m.pName}:${m.color}`)
          .join(","),
        botBusy ? 1 : 0,
        autoBotOn ? 1 : 0,
        isTiki ? 1 : 0,
        isTurnBased ? 1 : 0,
        isMuted ? 1 : 0,
        isReplay ? 1 : 0,
      ].join("|");

      return {
        dirtyKey,
        stateName,
        stateType,
        isGameEnd,
        isSpectator,
        tableId,
        playerMeta,
        autoBotOn,
        isTiki,
        isTurnBased,
        isMuted,
        isReplay,
      };
    };

    const renderBarFromSnapshot = (snap: ReturnType<typeof getRefreshBarSnapshot>) => {
      lastBarDirtyKey = snap.dirtyKey;
      const setText = (el: Element | null, val: string) => {
        if (el && el.textContent !== val) {
          el.textContent = val;
        }
      };
      const setAttr = (el: Element | null, name: string, val: string) => {
        if (el && el.getAttribute(name) !== val) {
          el.setAttribute(name, val);
        }
      };
      const seatHref = (pId: number): string =>
        isLocalHost
          ? `/?as=${pId}`
          : snap.tableId > 0
            ? `https://studio.boardgamearena.com/tableview?table=${snap.tableId}&as=${pId}`
            : `?as=${pId}`;

      if (seatsWrap) {
        const seatsSig =
          snap.playerMeta.map((m) => String(m.pId)).join(",") +
          (isLocalHost ? "|local" : "|studio");
        if (seatsWrap.getAttribute("data-seats-sig") !== seatsSig) {
          let seatsHtml = "";
          for (const m of snap.playerMeta) {
            seatsHtml +=
              `<a href="${seatHref(m.pId)}" data-seat-id="${m.pId}" class="devbar-seat" target="_blank" rel="noopener">` +
              `<span class="devbar-color-dot"></span>` +
              `<span class="devbar-seat-name"></span>` +
              `<span class="devbar-meta"></span>` +
              `<span class="devbar-turn-badge" style="display:none"></span>` +
              `</a>`;
          }
          if (isLocalHost) {
            seatsHtml += `<a href="/?as=0" data-seat-id="0" class="devbar-seat" target="_blank" rel="noopener">👁 Spectator</a>`;
          }
          seatsWrap.innerHTML = seatsHtml;
          seatsWrap.setAttribute("data-seats-sig", seatsSig);
        }

        for (const m of snap.playerMeta) {
          const seatEl = seatsWrap.querySelector(`.devbar-seat[data-seat-id="${m.pId}"]`);
          if (!seatEl) continue;

          setAttr(seatEl, "href", seatHref(m.pId));
          seatEl.classList.toggle("is-viewer", m.isViewer);
          seatEl.classList.toggle("is-active-turn", m.isActive);

          const dotEl = seatEl.querySelector(".devbar-color-dot") as HTMLElement | null;
          if (dotEl && dotEl.getAttribute("data-color") !== m.color) {
            dotEl.style.background = `#${m.color}`;
            dotEl.setAttribute("data-color", m.color);
          }

          setText(seatEl.querySelector(".devbar-seat-name"), `P${m.pNo}: ${m.pName}`);
          setText(seatEl.querySelector(".devbar-meta"), `[${m.handCount}]`);

          const badgeEl = seatEl.querySelector(".devbar-turn-badge") as HTMLElement | null;
          if (badgeEl) {
            const nextDisp = m.isActive ? "" : "none";
            if (badgeEl.style.display !== nextDisp) {
              badgeEl.style.display = nextDisp;
            }
          }

          setAttr(
            seatEl,
            "data-tooltip",
            `Open ${m.pName} (Team ${m.teamNum}, ${m.handCount} cards in hand) in a new tab. Green dot = waiting for this player's action.`,
          );
        }

        if (isLocalHost) {
          const specEl = seatsWrap.querySelector('.devbar-seat[data-seat-id="0"]');
          if (specEl) {
            specEl.classList.toggle("is-viewer", snap.isSpectator);
            setAttr(
              specEl,
              "data-tooltip",
              "Open Spectator view in a new tab (hides private hands and action buttons).",
            );
          }
        }
      }

      setText(document.getElementById("devbar_state_name"), snap.stateName || "-");
      setAttr(
        document.getElementById("devbar_state_label"),
        "data-tooltip",
        `Current BGA state machine state (${snap.stateName || "-"}, type: ${snap.stateType || "-"}).`,
      );

      const botOthersEl = document.getElementById("tt_btn_others") as HTMLButtonElement | null;
      if (botOthersEl) {
        botOthersEl.disabled = botBusy;
      }
      const botStepEl = document.getElementById("tt_btn_step1") as HTMLButtonElement | null;
      if (botStepEl) {
        botStepEl.disabled = botBusy;
      }

      const autoBotEl = document.getElementById("devbar_autobot");
      if (autoBotEl) {
        autoBotEl.classList.toggle("active-toggle", snap.autoBotOn);
        setText(autoBotEl, `⚡ Auto-Bot: ${snap.autoBotOn ? "ON" : "OFF"}`);
      }

      const tikiEl = document.getElementById("devbar_tiki");
      if (tikiEl) {
        tikiEl.classList.toggle("active-toggle", snap.isTiki);
        setText(tikiEl, `🗿 Tiki: ${snap.isTiki ? "ON" : "OFF"}`);
      }

      if (isLocalHost) {
        const exposedEl = document.getElementById("devbar_exposed");
        if (exposedEl) {
          exposedEl.classList.toggle("active-toggle", snap.isTurnBased);
          setText(exposedEl, snap.isTurnBased ? "🃏 Exposed Cards: ON" : "⏱ Real-Time");
        }
        const muteEl = document.getElementById("devbar_mute");
        if (muteEl) {
          setText(muteEl, snap.isMuted ? "🔇" : "🔊");
        }
      }

      const replayEl = document.getElementById("devbar_replay") as HTMLElement | null;
      if (replayEl) {
        const nextReplayDisp = snap.isGameEnd ? "" : "none";
        if (replayEl.style.display !== nextReplayDisp) {
          replayEl.style.display = nextReplayDisp;
        }
        replayEl.classList.toggle("active-toggle", snap.isReplay);
      }
    };

    const refreshBar = () => {
      if (refreshBarRafId !== null) {
        if (typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(refreshBarRafId);
        } else {
          window.clearTimeout(refreshBarRafId);
        }
        refreshBarRafId = null;
      }
      renderBarFromSnapshot(getRefreshBarSnapshot());
    };

    const scheduleRefreshBar = () => {
      if (refreshBarRafId !== null) return;
      const run = () => {
        refreshBarRafId = null;
        const snap = getRefreshBarSnapshot();
        if (snap.dirtyKey === lastBarDirtyKey) return;
        renderBarFromSnapshot(snap);
      };
      if (typeof window.requestAnimationFrame === "function") {
        refreshBarRafId = window.requestAnimationFrame(run);
      } else {
        refreshBarRafId = window.setTimeout(run, 16);
      }
    };

    // Output 1-line vs expanded toggle
    const outEl = document.getElementById("tt_test_output")!;
    const outToggleBtn = document.getElementById("tt_output_toggle");
    let lastJsonValue: any = undefined;
    let hasJsonValue = false;

    const renderOutputText = () => {
      if (!hasJsonValue) return;
      const expanded = outEl.classList.contains("is-expanded");
      outEl.textContent = expanded
        ? JSON.stringify(lastJsonValue, null, 2)
        : JSON.stringify(lastJsonValue);
    };

    const toggleOutputExpanded = () => {
      const expanded = outEl.classList.toggle("is-expanded");
      if (outToggleBtn) {
        outToggleBtn.textContent = expanded ? "▴ Collapse" : "▾ Expand";
      }
      renderOutputText();
    };

    const runTask = async (
      label: string,
      fn: () => Promise<any> | any,
      abortOnCatch = false,
      expandDrawer = true,
    ) => {
      if (expandDrawer && bar.classList.contains("is-collapsed")) {
        setDrawerOpen(true);
      }
      activeTaskCount++;
      clearAutoBotTimer();
      hasJsonValue = false;
      outEl.setAttribute("data-done", "0");
      outEl.setAttribute("data-status", "running");
      outEl.style.color = "#d29922";
      outEl.textContent = `Running ${label}...`;
      try {
        const res = await fn();
        lastJsonValue = res;
        hasJsonValue = true;
        const isFail = Boolean(res && typeof res === "object" && res.ok === false);
        outEl.setAttribute("data-status", isFail ? "fail" : "pass");
        outEl.setAttribute("data-done", "1");
        outEl.style.color = isFail ? "#f85149" : "#3fb950";
        renderOutputText();
      } catch (err: any) {
        const msg = (err && err.message) || String(err);
        const stack = err && err.stack ? String(err.stack) : undefined;
        if (abortOnCatch) {
          await postLocalAbort(msg, {
            playerId: Number(getUi()?.player_id || 0),
            command: label,
            stack,
            state: getUi()?.gamedatas?.gamestate?.name || "",
          });
        }
        lastJsonValue = {
          ok: false,
          error: msg,
          ...(stack ? { stack } : {}),
        };
        hasJsonValue = true;
        outEl.setAttribute("data-status", "fail");
        outEl.setAttribute("data-done", "1");
        outEl.style.color = "#f85149";
        renderOutputText();
      } finally {
        activeTaskCount = Math.max(0, activeTaskCount - 1);
        refreshBar();
        if (getAutoBotEnabled() && label !== "actForOthers") {
          scheduleAutoBot();
        }
      }
    };

    // Single delegated click handler on #studio-test-bar (do NOT intercept .devbar-seat clicks!)
    bar.addEventListener("click", (evt) => {
      const target = evt.target as Element | null;
      if (!target) return;
      if (target.closest(".devbar-seat")) return;

      if (target.closest("#tt_test_output") || target.closest("#tt_output_toggle")) {
        toggleOutputExpanded();
        return;
      }

      const btn = target.closest("button.devbar-btn") as HTMLButtonElement | null;
      if (!btn || !bar.contains(btn) || btn.disabled) return;
      const ui = getUi();

      switch (btn.id) {
        case "tt_btn_collapse":
          setDrawerOpen(bar.classList.contains("is-collapsed"));
          break;
        case "tt_btn_others":
          void runTask("actForOthers", () => activeTt().actForOthers(), false, false);
          break;
        case "tt_btn_step1":
          void runTask("step(1)", () => activeTt().step(1), false, false);
          break;
        case "devbar_autobot": {
          const next = !getAutoBotEnabled();
          setAutoBotEnabled(next);
          refreshBar();
          if (next) {
            scheduleAutoBot();
          } else {
            clearAutoBotTimer();
          }
          break;
        }
        case "devbar_tiki": {
          const gmStateNow = win.gameModel?.getState?.();
          const isTikiNow = gmStateNow
            ? Boolean(gmStateNow.isTiki)
            : Number(ui?.prefs?.[103]?.value ?? 2) === 1;
          const nextVal = isTikiNow ? 2 : 1;
          const isReadOnly = typeof ui?.isReadOnly === "function" && ui.isReadOnly();
          if (!isReadOnly && typeof ui?.setGameUserPreference === "function") {
            try {
              ui.setGameUserPreference(103, nextVal);
            } catch (_e) {
              ui.onPreferenceChange?.(103, nextVal);
            }
          } else if (typeof ui?.onPreferenceChange === "function") {
            ui.onPreferenceChange(103, nextVal);
          } else {
            win.gameModel?.setTiki?.(!isTikiNow);
          }
          refreshBar();
          break;
        }
        case "devbar_exposed": {
          const isTurnBasedNow = Boolean(ui?.localOptions?.turnBased);
          if (typeof ui?._startNewGame === "function") {
            void ui._startNewGame(isTurnBasedNow ? 0 : 1);
          }
          break;
        }
        case "devbar_mute": {
          const nextMute = safeLocalGet("tichu_local_mute") === "1" ? "0" : "1";
          safeLocalSet("tichu_local_mute", nextMute);
          refreshBar();
          break;
        }
        case "devbar_replay": {
          if (isLocalHost && typeof ui?._openReplayViewer === "function") {
            void Promise.resolve(ui._openReplayViewer()).finally(() => refreshBar());
          } else if (typeof ui?.toggleExperimentalReplay === "function") {
            ui.toggleExperimentalReplay();
            refreshBar();
          }
          break;
        }
        case "devbar_new_game": {
          if (typeof ui?._startNewGame === "function") {
            void ui._startNewGame();
          }
          break;
        }
        case "tt_btn_new":
          void runTask(
            "expressStartNew",
            async () => {
              const res = await activeTt().expressStartNew();
              if (res && res.tableviewUrl) {
                if (window.parent && window.parent !== window) {
                  try {
                    window.parent.postMessage(
                      {
                        type: "bga:navigate",
                        url: res.tableviewUrl,
                        sourceTableId: Number(
                          getUi()?.table_id || (window as any).bgaGameData?.tableId || 0,
                        ),
                      },
                      window.location.origin,
                    );
                  } catch (_e) {
                    window.open(res.tableviewUrl, "_blank");
                  }
                } else {
                  try {
                    window.location.href = res.tableviewUrl;
                  } catch (_e) {
                    window.open(res.tableviewUrl, "_blank");
                  }
                }
              }
              return res;
            },
            false,
            false,
          );
          break;
        case "tt_btn_stop":
          void runTask("expressStop", () => activeTt().expressStop(), false, false);
          break;
        case "tt_btn_smoke":
          void runTask("runSmokeTest", () =>
            activeTt().runSmokeTest({ tricks: 3, speed: "instant" }),
          );
          break;
        case "tt_btn_round":
          void runTask("runRound", () => activeTt().runRound({ speed: "instant" }));
          break;
        case "tt_btn_game":
          void runTask("runGame", () => activeTt().runGame({ speed: "instant" }));
          break;
        case "tt_btn_gt_all":
          void runTask("betAllGrandTichu", () => activeTt().betAllGrandTichu([0, 0, 0, 0]));
          break;
        case "tt_btn_pass_all":
          void runTask("passAllCards", () => activeTt().passAllCards());
          break;
        case "tt_btn_assert":
          void runTask("assertUI + status", () => ({
            ui: activeTt().assertUI(),
            status: activeTt().status(false),
          }));
          break;
        case "tt_btn_load_scenario": {
          const sel = document.getElementById("tt_scenario_select") as HTMLSelectElement | null;
          const scenarioName = sel?.value || "grand_tichu";
          void runTask(`loadScenario:${scenarioName}`, () => activeTt().loadScenario(scenarioName));
          break;
        }
      }
    });

    const cmdBtn = document.getElementById("tt_cmd_run");
    const cmdInput = document.getElementById("tt_cmd_input") as HTMLInputElement | null;
    if (cmdBtn && cmdInput) {
      let lastCmdRaw = "";
      let lastCmdAt = 0;
      const executeCmd = () => {
        const raw = (cmdInput.value || "").trim();
        if (!raw) return;
        const now = Date.now();
        if (raw === lastCmdRaw && now - lastCmdAt < 800) {
          return;
        }
        lastCmdRaw = raw;
        lastCmdAt = now;
        const colonIdx = raw.indexOf(":");
        const method = (colonIdx === -1 ? raw : raw.slice(0, colonIdx)).trim();
        const argRaw = colonIdx === -1 ? undefined : raw.slice(colonIdx + 1).trim();
        let parsedArg: any = undefined;
        let hasParsedArg = false;
        if (argRaw !== undefined && argRaw !== "") {
          hasParsedArg = true;
          parsedArg = argRaw;
          try {
            parsedArg = JSON.parse(argRaw);
          } catch (_e) {
            // Keep string if not JSON
          }
        }
        const abortOnCatch =
          parsedArg && typeof parsedArg === "object" && "stopOnIssue" in parsedArg
            ? Boolean(parsedArg.stopOnIssue)
            : method === "startAutoPlayMe";
        void runTask(
          raw,
          async () => {
            const curTt = activeTt();
            const fn = curTt[method];
            if (typeof fn !== "function") {
              throw new Error(`Unknown tt method: "${method}"`);
            }
            if (!hasParsedArg) {
              return await fn.call(curTt);
            }
            return await fn.call(curTt, parsedArg);
          },
          abortOnCatch,
          true,
        );
      };
      cmdBtn.addEventListener("click", executeCmd);
      cmdInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          executeCmd();
        }
      });
    }

    const showTests = (open = true) => setDrawerOpen(Boolean(open));
    (tt as any).refreshBar = refreshBar;
    (tt as any).scheduleRefreshBar = scheduleRefreshBar;
    (tt as any).showTests = showTests;
    (tt as any).showBar = () => setDrawerOpen(true);
    (tt as any).onQueueDrained = scheduleAutoBot;
    if (win.tt && win.tt !== tt) {
      win.tt.refreshBar = refreshBar;
      win.tt.scheduleRefreshBar = scheduleRefreshBar;
      win.tt.showTests = showTests;
      win.tt.showBar = (tt as any).showBar;
      win.tt.onQueueDrained = scheduleAutoBot;
    }

    if (win.__tichuStudioModelSub && typeof win.__tichuStudioModelSub.unsubscribe === "function") {
      win.__tichuStudioModelSub.unsubscribe();
    }
    if (win.gameModel && typeof win.gameModel.state$?.subscribe === "function") {
      win.__tichuStudioModelSub = win.gameModel.state$.subscribe(() => {
        activeTt().scheduleRefreshBar?.();
      });
    }

    const dojoObj = win.dojo;
    if (dojoObj && typeof dojoObj.subscribe === "function" && !win.__tichuStudioBarDojoBound) {
      win.__tichuStudioBarDojoBound = true;
      dojoObj.subscribe("gameStateChange", null, () => {
        activeTt().scheduleRefreshBar?.();
        if (!isLocalHost) scheduleAutoBot();
      });
      dojoObj.subscribe("gameStateMultipleActiveUpdate", null, () => {
        activeTt().scheduleRefreshBar?.();
        if (!isLocalHost) scheduleAutoBot();
      });
    }

    refreshBar();
    if (getAutoBotEnabled()) {
      scheduleAutoBot();
    }
  }

  let mergedTt: any = tt;
  if (existingTt) {
    // Preserve local bga-shim.js multi-tab/scenario/runner methods while unifying step/actForOthers/bar.
    const preservedLocal: Record<string, any> = {};
    for (const k of [
      "newGame",
      "loadScenario",
      "switchSeat",
      "runScenario",
      "runSuite",
      "runRound",
      "runGame",
      "help",
      "cancelAutopass",
    ]) {
      if (typeof existingTt[k] === "function") {
        preservedLocal[k] = existingTt[k];
      }
    }
    const studioOverlay: Record<string, any> = {
      state: tt.state,
      status: tt.status,
      hand: tt.hand,
      assertUI: tt.assertUI,
      getConsoleIssues: tt.getConsoleIssues,
      clearConsoleIssues: tt.clearConsoleIssues,
      _recordActionError: tt._recordActionError,
      betGrandTichu: tt.betGrandTichu,
      betAllGrandTichu: tt.betAllGrandTichu,
      betTichu: tt.betTichu,
      confirmTichu: tt.confirmTichu,
      giveCards: tt.giveCards,
      passCards: tt.passCards,
      passAllCards: tt.passAllCards,
      acceptCards: tt.acceptCards,
      play: tt.play,
      pass: tt.pass,
      wish: tt.wish,
      choosePhoenix: tt.choosePhoenix,
      cancelPhoenix: tt.cancelPhoenix,
      giveDragon: tt.giveDragon,
      collect: tt.collect,
      bomb: tt.bomb,
      cancelBomb: tt.cancelBomb,
      step: tt.step,
      actForOthers: tt.actForOthers,
      runSmokeTest: tt.runSmokeTest,
      actMyTurn: tt.actMyTurn,
      startAutoPlayMe: tt.startAutoPlayMe,
      stopAutoPlayMe: tt.stopAutoPlayMe,
      autoPlayStatus: tt.autoPlayStatus,
      getAutoPlayStatus: tt.getAutoPlayStatus,
      setSpeed: tt.setSpeed,
      setVerbose: tt.setVerbose,
      waitUntilIdle: tt.waitUntilIdle,
      refreshBar: tt.refreshBar,
      scheduleRefreshBar: tt.scheduleRefreshBar,
      showTests: tt.showTests,
      showBar: tt.showBar,
      onQueueDrained: tt.onQueueDrained,
    };
    mergedTt = Object.assign(existingTt, studioOverlay, preservedLocal);
  }

  win.tt = mergedTt;
  win.tichuTest = mergedTt;

  mountStudioTestBar();

  try {
    if (window.parent && window.parent !== window) {
      (window.parent as any).tt = mergedTt;
      (window.parent as any).tichuTest = mergedTt;
      (window.parent as any).gameui = getUi();
    }
  } catch (_e) {
    // Ignore cross-origin frame access errors if any
  }

  logAnnounce(
    isLocalHost ? "[TICHU LOCAL READY]" : "[TICHU STUDIO READY]",
    "Console runner `window.tt` & `#studio-test-bar` attached. Type `tt.help()` or click `🧪 Smoke Test`.",
    "#3fb950",
  );
}
