import { BehaviorSubject, Observable } from "rxjs";
import type {
  Card,
  CardData,
  I18nLogPayload,
  RoundBetOutcome,
  RoundScoreRecord,
  TichuGamedatas,
} from "../types/tichu-contracts";
import { ANIM_TIMINGS, syncAnimCssVars } from "./anim-timings";
import { Combo, normalizeComboDescriptionInput, normalizePhoenixValue } from "./combo-validator";
import type { TichuAnimationLayer } from "./tichu-animation-layer";
import { select } from "./utils";

function getActiveAnimationLayer(): TichuAnimationLayer | null {
  if (typeof document === "undefined" || typeof window === "undefined") return null;
  if (document.hidden || document.visibilityState === "hidden") return null;
  const layer = document.querySelector("tichu-animation-layer") as TichuAnimationLayer | null;
  if (!layer || typeof layer.canAnimate !== "function" || !layer.canAnimate()) {
    return null;
  }
  return layer;
}

export type { Card, CardData, RoundBetOutcome, RoundScoreRecord };

export type GrandTichuBetValue = -1 | 0 | 100 | 200;
export type TichuBetValue = -1 | 0 | 100;
export type AutoSortOrder = "rank" | "rank-desc" | "color" | "color-desc";
export type HandSortOrder = AutoSortOrder | "preserve";
export type CardGroupId = 1 | 2 | 3 | 4;

export const CUSTOM_HAND_ORDER_STORAGE_KEY = "tichu_hand_custom_order";
export const CUSTOM_HAND_ORDER_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 3 months
export const CUSTOM_HAND_ORDER_MAX_ENTRIES = 50;

const POST_PASSING_PLAY_STATES = new Set([
  "newTrick",
  "playComboOpen",
  "playCombo",
  "playBomb",
  "phoenixPlay",
  "mahjongPlay",
  "nextPlayer",
  "confirmTrick",
  "chooseDragonGift",
  "changePlayer",
]);

export function canOrganizeHandInState(stateName: string): boolean {
  return POST_PASSING_PLAY_STATES.has(stateName);
}

export function isAutoSortOrder(val: unknown): val is AutoSortOrder {
  return val === "rank" || val === "rank-desc" || val === "color" || val === "color-desc";
}

function isCardGroupId(val: unknown): val is CardGroupId {
  return val === 1 || val === 2 || val === 3 || val === 4;
}

export interface LivePlayer {
  id: string;
  name: string;
  color: string;
  no: number;
  team: number;
  score: number;
  callGrandTichu: GrandTichuBetValue;
  callTichu: TichuBetValue;
  autopass: boolean;
  /** Raw numeric pass mode from backend: 0 = none, 1 = once, 2 = trick */
  pass: number;
  handcount: number;
  capturedPoints: number;
  passedCardReady: boolean;
  avatarUrl: string;
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
  animationsEnabled?: boolean;
  theme?: number;
  handSortOrder?: AutoSortOrder;
  [prefId: number]: number | undefined;
}

export interface LiveGameState {
  tableId: number;
  currentPlayerId: string;
  isSpectator: boolean;
  isRealtime: boolean;
  isAllInfoExposed: boolean;
  hasPlayedOrPassedInRound: boolean;
  players: Record<string, LivePlayer>;
  playerOrderBottomToLeft: string[];
  passSlots: PassSlotState[];
  reopenedPassNotice: string | null;
  acceptingCardsCountdown: boolean;
  collectingTrickCountdown: boolean;
  hand: Card[];
  selectedCardIds: string[];
  baseSortOrder: AutoSortOrder;
  handSortOrder: HandSortOrder;
  customHandOrder: string[];
  cardGroups: Record<string, CardGroupId>;
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
  animationsEnabled: boolean;
  experimentalReplayOpen: boolean;
  trickModalOpen: boolean;
  settingsModalOpen: boolean;
  scoreModalOpen: boolean;
  roundHistory: RoundScoreRecord[];
  targetScore: number;
  betAnimations: BetAnimation[];
}

interface StoredCustomHandEntry {
  round: number;
  order: string[];
  groups: Record<string, CardGroupId>;
  updatedAt: number;
}

function isReadOnlyEnv(isSpectator: boolean): boolean {
  if (isSpectator) return true;
  if (typeof window !== "undefined") {
    const ui = (window as any).gameui;
    if (ui && typeof ui.isReadOnly === "function" && ui.isReadOnly()) return true;
    if (typeof (window as any).g_replayFrom !== "undefined") return true;
    if ((window as any).g_archive_mode) return true;
  }
  return false;
}

function getStoredHandSortOrder(): AutoSortOrder {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("tichu_hand_sort_order");
      if (isAutoSortOrder(raw)) return raw;
    }
  } catch (_e) {
    // ignore storage errors
  }
  return "rank";
}

function getCustomEntryKey(tableId: number, playerId: string): string {
  return `${tableId}_${playerId}`;
}

function normalizeStoredEntry(raw: any, now: number): StoredCustomHandEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const round = Number(raw.round);
  const updatedAt = Number(raw.updatedAt);
  if (!Number.isFinite(round) || !Number.isFinite(updatedAt)) return null;
  if (now - updatedAt > CUSTOM_HAND_ORDER_TTL_MS) return null;

  const order: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.order)) {
    for (const id of raw.order) {
      const s = String(id ?? "");
      if (s && !seen.has(s)) {
        seen.add(s);
        order.push(s);
      }
    }
  }

  const groups: Record<string, CardGroupId> = {};
  if (raw.groups && typeof raw.groups === "object" && !Array.isArray(raw.groups)) {
    for (const [k, v] of Object.entries(raw.groups)) {
      const g = Number(v);
      if (k && isCardGroupId(g)) {
        groups[String(k)] = g;
      }
    }
  }

  return { round, order, groups, updatedAt };
}

function readCustomOrderStore(now = Date.now()): {
  store: Record<string, StoredCustomHandEntry>;
  pruned: boolean;
} {
  const store: Record<string, StoredCustomHandEntry> = {};
  let pruned = false;
  try {
    if (typeof localStorage === "undefined") return { store, pruned };
    const raw = localStorage.getItem(CUSTOM_HAND_ORDER_STORAGE_KEY);
    if (!raw) return { store, pruned };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { store, pruned: true };
    }
    for (const [key, val] of Object.entries(parsed)) {
      const entry = normalizeStoredEntry(val, now);
      if (entry) {
        store[key] = entry;
      } else {
        pruned = true;
      }
    }
  } catch (_e) {
    // ignore storage/parse errors
  }
  return { store, pruned };
}

function writeCustomOrderStore(
  store: Record<string, StoredCustomHandEntry>,
  now = Date.now(),
): void {
  try {
    if (typeof localStorage === "undefined") return;
    const validEntries = Object.entries(store)
      .filter(([, entry]) => now - entry.updatedAt <= CUSTOM_HAND_ORDER_TTL_MS)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, CUSTOM_HAND_ORDER_MAX_ENTRIES);
    if (validEntries.length === 0) {
      localStorage.removeItem(CUSTOM_HAND_ORDER_STORAGE_KEY);
      return;
    }
    const nextStore: Record<string, StoredCustomHandEntry> = {};
    for (const [k, v] of validEntries) {
      nextStore[k] = v;
    }
    localStorage.setItem(CUSTOM_HAND_ORDER_STORAGE_KEY, JSON.stringify(nextStore));
  } catch (_e) {
    // ignore storage errors
  }
}

function loadCustomHandEntry(
  tableId: number,
  playerId: string,
  round: number,
  now = Date.now(),
): { order: string[]; groups: Record<string, CardGroupId> } | null {
  if (!tableId || tableId <= 0 || !playerId) return null;
  const { store, pruned } = readCustomOrderStore(now);
  const key = getCustomEntryKey(tableId, playerId);
  const entry = store[key];
  if (!entry) {
    if (pruned) writeCustomOrderStore(store, now);
    return null;
  }
  if (entry.round !== round) {
    delete store[key];
    writeCustomOrderStore(store, now);
    return null;
  }
  if (pruned) {
    writeCustomOrderStore(store, now);
  }
  return { order: [...entry.order], groups: { ...entry.groups } };
}

function saveCustomHandEntry(
  tableId: number,
  playerId: string,
  round: number,
  order: string[],
  groups: Record<string, CardGroupId>,
  now = Date.now(),
): void {
  if (!tableId || tableId <= 0 || !playerId) return;
  const { store } = readCustomOrderStore(now);
  const key = getCustomEntryKey(tableId, playerId);
  if (order.length === 0 && Object.keys(groups).length === 0) {
    if (key in store) {
      delete store[key];
      writeCustomOrderStore(store, now);
    }
    return;
  }
  store[key] = {
    round,
    order: [...order],
    groups: { ...groups },
    updatedAt: now,
  };
  writeCustomOrderStore(store, now);
}

function deleteCustomHandEntry(tableId: number, playerId: string, now = Date.now()): void {
  if (!tableId || tableId <= 0 || !playerId) return;
  const { store, pruned } = readCustomOrderStore(now);
  const key = getCustomEntryKey(tableId, playerId);
  if (key in store || pruned) {
    delete store[key];
    writeCustomOrderStore(store, now);
  }
}

const initialAutoSortOrder = getStoredHandSortOrder();

export const initialLiveGameState: LiveGameState = {
  tableId: 0,
  currentPlayerId: "",
  isSpectator: false,
  isRealtime: false,
  isAllInfoExposed: false,
  hasPlayedOrPassedInRound: false,
  players: {},
  playerOrderBottomToLeft: [],
  passSlots: [],
  reopenedPassNotice: null,
  acceptingCardsCountdown: false,
  collectingTrickCountdown: false,
  hand: [],
  selectedCardIds: [],
  baseSortOrder: initialAutoSortOrder,
  handSortOrder: initialAutoSortOrder,
  customHandOrder: [],
  cardGroups: {},
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
  animationsEnabled: true,
  experimentalReplayOpen: false,
  trickModalOpen: false,
  settingsModalOpen: false,
  scoreModalOpen: false,
  roundHistory: [],
  targetScore: 1000,
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
  if (
    passedFrom !== undefined &&
    passedFrom !== null &&
    String(passedFrom) !== "" &&
    Number(passedFrom) > 0
  ) {
    card.passed_from = String(passedFrom);
  }
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

function toIntTuple(raw: any): [number, number] {
  if (!Array.isArray(raw)) return [0, 0];
  const a = Number(raw[0] ?? 0);
  const b = Number(raw[1] ?? 0);
  return [Number.isNaN(a) ? 0 : Math.trunc(a), Number.isNaN(b) ? 0 : Math.trunc(b)];
}

export function normalizeRoundScoreRecord(raw: any): RoundScoreRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const bets: Record<string, RoundBetOutcome> = {};
  if (raw.bets && typeof raw.bets === "object" && !Array.isArray(raw.bets)) {
    for (const [pid, entry] of Object.entries(raw.bets)) {
      if (!entry || typeof entry !== "object") continue;
      const betObj = entry as any;
      const type: "GT" | "T" = String(betObj.type ?? "T") === "GT" ? "GT" : "T";
      const won = Boolean(betObj.won);
      const deltaNum = Number(
        betObj.delta ?? (type === "GT" ? (won ? 200 : -200) : won ? 100 : -100),
      );
      bets[String(pid)] = {
        type,
        won,
        delta: Number.isNaN(deltaNum) ? 0 : Math.trunc(deltaNum),
      };
    }
  }
  const roundNum = Number(raw.round ?? 0);
  const dvNum =
    raw.doubleVictory !== undefined && raw.doubleVictory !== null ? Number(raw.doubleVictory) : -1;
  const record: RoundScoreRecord = {
    round: Number.isNaN(roundNum) ? 0 : Math.trunc(roundNum),
    cardPoints: toIntTuple(raw.cardPoints),
    doubleVictory: Number.isNaN(dvNum) ? -1 : Math.trunc(dvNum),
    bets,
    teamPoints: toIntTuple(raw.teamPoints),
    teamTotals: toIntTuple(raw.teamTotals),
  };
  if (raw.isSyntheticPrior) {
    record.isSyntheticPrior = true;
    const through = Number(raw.priorThroughRound ?? 0);
    if (!Number.isNaN(through) && through > 0) {
      record.priorThroughRound = Math.trunc(through);
    }
  }
  return record;
}

function getTeamScoresFromPlayers(playersMap: Record<string, LivePlayer>): [number, number] {
  const totals: [number, number] = [0, 0];
  for (const p of Object.values(playersMap)) {
    if (p.team === 0 || p.team === 1) {
      totals[p.team] = Number.isNaN(p.score) ? 0 : p.score;
    }
  }
  return totals;
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
  public readonly hasPlayedOrPassedInRound$ = select(
    this.state$,
    (s) => s.hasPlayedOrPassedInRound,
  );
  public readonly players$ = select(this.state$, (s) => s.players);
  public readonly currentPlayer$ = select(this.state$, (s) => s.players[s.currentPlayerId] ?? null);
  public readonly player$ = (playerId: string | number) =>
    select(this.state$, (s) => s.players[String(playerId)]);
  public readonly playerOrderBottomToLeft$ = select(this.state$, (s) => s.playerOrderBottomToLeft);
  public readonly passSlots$ = select(this.state$, (s) => s.passSlots);
  public readonly reopenedPassNotice$ = select(this.state$, (s) => s.reopenedPassNotice);
  public readonly acceptingCardsCountdown$ = select(this.state$, (s) => s.acceptingCardsCountdown);
  public readonly collectingTrickCountdown$ = select(
    this.state$,
    (s) => s.collectingTrickCountdown,
  );
  public readonly hand$ = select(this.state$, (s) => s.hand);
  public readonly selectedCardIds$ = select(this.state$, (s) => s.selectedCardIds);
  public readonly baseSortOrder$ = select(this.state$, (s) => s.baseSortOrder);
  public readonly handSortOrder$ = select(this.state$, (s) => s.handSortOrder);
  public readonly customHandOrder$ = select(this.state$, (s) => s.customHandOrder);
  public readonly cardGroups$ = select(this.state$, (s) => s.cardGroups);
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
  public readonly animationsEnabled$ = select(this.state$, (s) => s.animationsEnabled);
  public readonly experimentalReplayOpen$ = select(this.state$, (s) => s.experimentalReplayOpen);
  public readonly trickModalOpen$ = select(this.state$, (s) => s.trickModalOpen);
  public readonly settingsModalOpen$ = select(this.state$, (s) => s.settingsModalOpen);
  public readonly scoreModalOpen$ = select(this.state$, (s) => s.scoreModalOpen);
  public readonly roundHistory$ = select(this.state$, (s) => s.roundHistory);
  public readonly targetScore$ = select(this.state$, (s) => s.targetScore);
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
    avatarUrls?: Record<string, string>,
    tableId?: number,
  ): void {
    const currentId = String(currentPlayerId ?? "");
    const rawTableId = Number(tableId || gamedatas?.table_id || 0);
    const resolvedTableId = Number.isFinite(rawTableId) && rawTableId > 0 ? rawTableId : 0;
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

      const rawNo = Number(p?.no ?? p?.player_no ?? 0);
      const safeNo = Number.isNaN(rawNo) ? 0 : rawNo;
      const rawTeam = p?.team;
      const parsedTeam =
        rawTeam !== undefined &&
        rawTeam !== null &&
        rawTeam !== "" &&
        !Number.isNaN(Number(rawTeam))
          ? Number(rawTeam)
          : (Math.max(1, safeNo || 1) - 1) % 2;

      players[pid] = {
        id: pid,
        name: String(p?.name ?? p?.player_name ?? ""),
        color: String(p?.color ?? p?.player_color ?? "000000"),
        no: safeNo,
        team: parsedTeam,
        score: Number(p?.score ?? p?.player_score ?? 0),
        callGrandTichu: normalizeGrandTichuBet(p?.call_grand_tichu),
        callTichu: normalizeTichuBet(p?.call_tichu),
        autopass: safePass > 0,
        pass: safePass,
        handcount: Number(handCounts[pid] ?? handCounts[Number(pid)] ?? 0),
        capturedPoints: Number(capturedPointsMap[pid] ?? capturedPointsMap[Number(pid)] ?? 0),
        passedCardReady: hasPassed,
        avatarUrl: avatarUrls?.[pid] ?? (typeof p?.avatarUrl === "string" ? p.avatarUrl : ""),
      };

      if (hasComboCards) {
        lastCombos[pid] = {
          cards: comboCards,
          description: normalizeComboDescriptionInput(combo?.description),
          passed: false,
          type: Number.isNaN(comboType) ? 0 : comboType,
          phoenixValue: normalizePhoenixValue(combo?.phoenixValue),
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
          ? normalizePhoenixValue(rawStructuredLast.phoenixValue)
          : (fallbackCombo?.phoenixValue ?? null),
      description: normalizeComboDescriptionInput(
        rawStructuredLast?.description ??
          gamedatas?.lastComboDescription ??
          fallbackCombo?.description ??
          "",
      ),
    };

    const rawWish = Number(gamedatas?.mahjongWish ?? gamedatas?.mahjong_wish ?? 0);
    const mahjongWish = rawWish > 0 && rawWish < 15 ? rawWish : 0;

    // Resolve user preferences from either named fields or BGA numeric IDs (100..105)
    const squareTable =
      prefs?.squareTable !== undefined ? Boolean(prefs.squareTable) : Number(prefs?.[100]) === 2;
    const clockwise =
      prefs?.clockwise !== undefined ? Boolean(prefs.clockwise) : Number(prefs?.[101] ?? 1) === 2;
    const confirmPassWithSelection =
      prefs?.confirmPassWithSelection !== undefined
        ? Boolean(prefs.confirmPassWithSelection)
        : Number(prefs?.[102] ?? 1) !== 2;
    const isTiki = prefs?.isTiki !== undefined ? Boolean(prefs.isTiki) : Number(prefs?.[103]) === 1;
    const animationsEnabled =
      prefs?.animationsEnabled !== undefined
        ? Boolean(prefs.animationsEnabled)
        : Number(prefs?.[105] ?? 1) !== 2;
    const rawTheme =
      prefs?.theme !== undefined
        ? Number(prefs.theme)
        : prefs?.[104] !== undefined
          ? Number(prefs[104])
          : 0;
    const theme = !Number.isNaN(rawTheme) && rawTheme >= 0 && rawTheme <= 10 ? rawTheme : 0;
    const storedSortOrder = getStoredHandSortOrder();
    const baseSortOrder: AutoSortOrder = isAutoSortOrder(prefs?.handSortOrder)
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

    const isAllInfoExposed =
      Number(gamedatas?.isAllInfoExposed ?? gamedatas?.is_all_info_exposed) === 1;

    const hydratedRound = Number(gamedatas?.round ?? 0);
    const hydratedHand = normalizeCards(gamedatas?.hand);
    const handIdSet = new Set(hydratedHand.map((c) => c.id));
    let handSortOrder: HandSortOrder = baseSortOrder;
    let customHandOrder: string[] = [];
    let cardGroups: Record<string, CardGroupId> = {};

    const readOnly = isReadOnlyEnv(Boolean(isSpectator));
    if (!readOnly && resolvedTableId > 0 && currentId) {
      if (stateName === "gameEnd" || stateName === "endRound" || stateName === "newRound") {
        deleteCustomHandEntry(resolvedTableId, currentId);
      } else {
        const storedCustom = loadCustomHandEntry(resolvedTableId, currentId, hydratedRound);
        if (storedCustom && canOrganizeHandInState(stateName)) {
          customHandOrder = storedCustom.order.filter((id) => handIdSet.has(id));
          for (const [cid, grp] of Object.entries(storedCustom.groups)) {
            if (handIdSet.has(cid) && isCardGroupId(grp)) {
              cardGroups[cid] = grp;
            }
          }
          if (customHandOrder.length > 0) {
            handSortOrder = "preserve";
          }
        }
      }
    }

    const rawTargetScore = Number(gamedatas?.targetScore ?? 1000);
    const targetScore = !Number.isNaN(rawTargetScore) && rawTargetScore > 0 ? rawTargetScore : 1000;
    let roundHistory: RoundScoreRecord[];
    if (Array.isArray(gamedatas?.roundHistory)) {
      roundHistory = gamedatas.roundHistory
        .map(normalizeRoundScoreRecord)
        .filter((r): r is RoundScoreRecord => r !== null);
    } else {
      const teamTotals = getTeamScoresFromPlayers(players);
      if (hydratedRound > 1 || teamTotals[0] !== 0 || teamTotals[1] !== 0) {
        roundHistory = [
          {
            round: 0,
            isSyntheticPrior: true,
            priorThroughRound: Math.max(1, hydratedRound - 1),
            cardPoints: [0, 0],
            doubleVictory: -1,
            bets: {},
            teamPoints: [teamTotals[0], teamTotals[1]],
            teamTotals: [teamTotals[0], teamTotals[1]],
          },
        ];
      } else {
        roundHistory = [];
      }
    }


    this.setState({
      tableId: resolvedTableId,
      currentPlayerId: currentId,
      isSpectator: Boolean(isSpectator),
      isRealtime: Boolean(isRealtime),
      isAllInfoExposed,
      hasPlayedOrPassedInRound: Boolean(gamedatas?.hasPlayedOrPassedInRound),
      players,
      playerOrderBottomToLeft,
      passSlots,
      reopenedPassNotice: null,
      acceptingCardsCountdown: false,
      collectingTrickCountdown: false,
      hand: hydratedHand,
      selectedCardIds: [],
      baseSortOrder,
      handSortOrder,
      customHandOrder,
      cardGroups,
      stateName,
      activePlayerId,
      activePlayerIds,
      isCurrentPlayerActive,
      bombActivePlayerId: null,
      round: hydratedRound,
      trick: Number(gamedatas?.trick ?? 0),
      currentTrick: normalizeCards(gamedatas?.currentTrick),
      currentTrickValue: Number(
        gamedatas?.currentTrickValue ?? gamedatas?.current_trick_value ?? 0,
      ),
      capturedCards: isAllInfoExposed ? normalizeCards(gamedatas?.capturedCards) : [],
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
      animationsEnabled,
      experimentalReplayOpen: false,
      trickModalOpen: false,
      settingsModalOpen: false,
      scoreModalOpen: false,
      roundHistory,
      targetScore,
      betAnimations: [],
    });
    syncAnimCssVars();
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
      reopenedPassNotice: stateName === "giveCards" ? prev.reopenedPassNotice : null,
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
    const preserveInitialDeal = prev.hand.length === 8;
    const players: Record<string, LivePlayer> = {};
    const lastCombos: Record<string, LastComboState> = {};
    for (const [pid, player] of Object.entries(prev.players)) {
      players[pid] = {
        ...player,
        handcount: preserveInitialDeal ? 8 : 0,
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
    if (!isReadOnlyEnv(prev.isSpectator) && prev.tableId > 0 && prev.currentPlayerId) {
      deleteCustomHandEntry(prev.tableId, prev.currentPlayerId);
    }
    this.update({
      players,
      lastCombos,
      passSlots,
      reopenedPassNotice: null,
      lastComboPlayerId: "",
      trickLastCombo: {
        playerId: "",
        type: 99,
        cards: [],
        phoenixValue: null,
        description: "",
      },
      capturedCards: [],
      hand: preserveInitialDeal ? prev.hand : [],
      selectedCardIds: [],
      handSortOrder: prev.baseSortOrder,
      customHandOrder: [],
      cardGroups: {},
      currentTrick: [],
      currentTrickValue: 0,
      firstOutPlayerId: "",
      round: prev.round + 1,
      trick: 0,
      mahjongWish: 0,
      selectedMahjongWish: null,
      phoenixAllowedValues: [],
      selectedPhoenixValue: null,
      hasPlayedOrPassedInRound: false,
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

    const handIdSet = new Set(prev.hand.map((c) => c.id));
    const normalized = (receivedCards ? normalizeCards(receivedCards) : []).filter(
      (c) => !handIdSet.has(c.id),
    );
    const passSlots = prev.passSlots.map((slot) => {
      const fallbackReceived =
        slot.receivedCard && !handIdSet.has(slot.receivedCard.id) ? slot.receivedCard : null;
      const received =
        normalized.find((c) => String(c.passed_from) === slot.playerId) ?? fallbackReceived;
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
      reopenedPassNotice: null,
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
      capturedCards: prev.isAllInfoExposed ? [...prev.capturedCards, ...prev.currentTrick] : [],
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
    if (!isReadOnlyEnv(prev.isSpectator) && prev.tableId > 0 && prev.currentPlayerId) {
      deleteCustomHandEntry(prev.tableId, prev.currentPlayerId);
    }
    this.update({
      hand: [],
      selectedCardIds: [],
      handSortOrder: prev.baseSortOrder,
      customHandOrder: [],
      cardGroups: {},
      reopenedPassNotice: null,
      players,
      hasPlayedOrPassedInRound: false,
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
    const nextCustomOrder = prev.customHandOrder.filter((id) => validIds.has(id));
    const nextGroups: Record<string, CardGroupId> = {};
    for (const [cid, grp] of Object.entries(prev.cardGroups)) {
      if (validIds.has(cid)) {
        nextGroups[cid] = grp;
      }
    }
    this.update({
      hand: normalized,
      selectedCardIds: prev.selectedCardIds.filter((id) => validIds.has(id)),
      customHandOrder: nextCustomOrder,
      cardGroups: nextGroups,
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

    if (
      isInitialDeal &&
      !isReadOnlyEnv(prev.isSpectator) &&
      prev.tableId > 0 &&
      prev.currentPlayerId
    ) {
      deleteCustomHandEntry(prev.tableId, prev.currentPlayerId);
    }

    this.update({
      hand: nextHand,
      selectedCardIds: isInitialDeal ? [] : prev.selectedCardIds,
      handSortOrder: isInitialDeal ? prev.baseSortOrder : prev.handSortOrder,
      customHandOrder: isInitialDeal ? [] : prev.customHandOrder,
      cardGroups: isInitialDeal ? {} : prev.cardGroups,
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

  setHandSortOrder(order: AutoSortOrder): void {
    const safeOrder: AutoSortOrder = isAutoSortOrder(order) ? order : "rank";
    const prev = this.getState();
    const readOnly = isReadOnlyEnv(prev.isSpectator);
    if (!readOnly) {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("tichu_hand_sort_order", safeOrder);
        }
      } catch (_e) {
        // ignore storage errors
      }
      if (prev.tableId > 0 && prev.currentPlayerId) {
        saveCustomHandEntry(prev.tableId, prev.currentPlayerId, prev.round, [], prev.cardGroups);
      }
    }
    this.update({
      baseSortOrder: safeOrder,
      handSortOrder: safeOrder,
      customHandOrder: [],
    });
  }

  commitCustomHandOrder(
    orderedIds: string[],
    movedCardId?: string,
    targetGroup?: CardGroupId | 0,
  ): void {
    const prev = this.getState();
    if (isReadOnlyEnv(prev.isSpectator) || !canOrganizeHandInState(prev.stateName)) {
      return;
    }
    const validIds = new Set(prev.hand.map((c) => c.id));
    const seen = new Set<string>();
    const nextOrder: string[] = [];
    for (const rawId of orderedIds) {
      const id = String(rawId ?? "");
      if (id && validIds.has(id) && !seen.has(id)) {
        seen.add(id);
        nextOrder.push(id);
      }
    }
    for (const c of prev.hand) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        nextOrder.push(c.id);
      }
    }

    const nextGroups: Record<string, CardGroupId> = {};
    for (const [cid, grp] of Object.entries(prev.cardGroups)) {
      if (validIds.has(cid) && isCardGroupId(grp)) {
        nextGroups[cid] = grp;
      }
    }
    if (movedCardId !== undefined && targetGroup !== undefined) {
      const mid = String(movedCardId);
      if (validIds.has(mid)) {
        if (targetGroup === 0) {
          delete nextGroups[mid];
        } else if (isCardGroupId(targetGroup)) {
          nextGroups[mid] = targetGroup;
        }
      }
    }

    if (prev.tableId > 0 && prev.currentPlayerId) {
      saveCustomHandEntry(prev.tableId, prev.currentPlayerId, prev.round, nextOrder, nextGroups);
    }
    this.update({
      handSortOrder: "preserve",
      customHandOrder: nextOrder,
      cardGroups: nextGroups,
    });
  }

  assignCardGroup(cardIds: string[], groupId: CardGroupId | 0): void {
    const prev = this.getState();
    if (isReadOnlyEnv(prev.isSpectator) || !canOrganizeHandInState(prev.stateName)) {
      return;
    }
    const validIds = new Set(prev.hand.map((c) => c.id));
    const nextGroups: Record<string, CardGroupId> = {};
    for (const [cid, grp] of Object.entries(prev.cardGroups)) {
      if (validIds.has(cid) && isCardGroupId(grp)) {
        nextGroups[cid] = grp;
      }
    }
    let changed = false;
    for (const rawId of cardIds) {
      const cid = String(rawId ?? "");
      if (!validIds.has(cid)) continue;
      if (groupId === 0) {
        if (cid in nextGroups) {
          delete nextGroups[cid];
          changed = true;
        }
      } else if (isCardGroupId(groupId)) {
        if (nextGroups[cid] !== groupId) {
          nextGroups[cid] = groupId;
          changed = true;
        }
      }
    }
    if (!changed) {
      if (prev.selectedCardIds.length > 0) {
        this.update({ selectedCardIds: [] });
      }
      return;
    }

    const persistedOrder = prev.handSortOrder === "preserve" ? prev.customHandOrder : [];
    if (prev.tableId > 0 && prev.currentPlayerId) {
      saveCustomHandEntry(
        prev.tableId,
        prev.currentPlayerId,
        prev.round,
        persistedOrder,
        nextGroups,
      );
    }
    this.update({
      cardGroups: nextGroups,
      selectedCardIds: [],
    });
  }

  clearCardGroups(): void {
    const prev = this.getState();
    if (isReadOnlyEnv(prev.isSpectator)) return;
    if (Object.keys(prev.cardGroups).length === 0) return;
    const persistedOrder = prev.handSortOrder === "preserve" ? prev.customHandOrder : [];
    if (prev.tableId > 0 && prev.currentPlayerId) {
      saveCustomHandEntry(prev.tableId, prev.currentPlayerId, prev.round, persistedOrder, {});
    }
    this.update({
      cardGroups: {},
    });
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

      const layer = getActiveAnimationLayer();
      const fromRect = layer ? layer.prepareGiveCardToSlot(card) : null;
      const passSlots = prev.passSlots.map((s, idx) =>
        idx === slotIndex ? { ...s, givenCard: card } : s,
      );
      this.update({
        passSlots,
        hand: prev.hand.filter((c) => c.id !== selectedId),
        selectedCardIds: [],
      });
      if (layer && fromRect) {
        void layer.runGiveCardToSlotFlight(card, slotIndex, fromRect);
      }
    } else {
      const returnedCard = slot.givenCard;
      const layer = getActiveAnimationLayer();
      const fromRects = layer ? layer.prepareReturnPassCardsToHand([returnedCard]) : null;
      const passSlots = prev.passSlots.map((s, idx) =>
        idx === slotIndex ? { ...s, givenCard: null } : s,
      );
      this.update({
        passSlots,
        hand: [...prev.hand, returnedCard],
      });
      if (layer && fromRects && fromRects.size > 0) {
        void layer.runReturnPassCardsToHandFlight([returnedCard], fromRects);
      }
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
    const layer = getActiveAnimationLayer();
    const fromRects = layer ? layer.prepareReturnPassCardsToHand(returnedCards) : null;
    this.update({
      passSlots,
      hand: [...prev.hand, ...returnedCards],
    });
    if (layer && fromRects && fromRects.size > 0) {
      void layer.runReturnPassCardsToHandFlight(returnedCards, fromRects);
    }
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
      reopenedPassNotice: null,
      passSlots: prev.passSlots.map((s) =>
        s.givenCard && idSet.has(s.givenCard.id) ? { ...s, givenCard: null } : s,
      ),
    });
  }

  applyUnpassCardsNotif(
    cards: Card[],
    reopenedByTichu: boolean,
    noticeMessage: string | null = null,
  ): void {
    const normalized = normalizeCards(cards);
    const prev = this.getState();
    const returnedIdSet = new Set(normalized.map((c) => c.id));
    const usedIds = new Set<string>();
    const passSlots = prev.passSlots.map((slot, idx) => {
      const matchByRecipient = normalized.find(
        (c) =>
          !usedIds.has(c.id) &&
          c.location_arg !== undefined &&
          String(c.location_arg) === slot.playerId,
      );
      const fallback =
        !matchByRecipient && normalized[idx] && !usedIds.has(normalized[idx]!.id)
          ? normalized[idx]!
          : null;
      const chosen = matchByRecipient ?? fallback ?? null;
      if (chosen) {
        usedIds.add(chosen.id);
        return { ...slot, givenCard: chosen };
      }
      return slot;
    });
    const unslotted = normalized.filter((c) => !usedIds.has(c.id));
    const filteredHand = prev.hand.filter((c) => !returnedIdSet.has(c.id));
    this.update({
      passSlots,
      hand: unslotted.length > 0 ? [...filteredHand, ...unslotted] : filteredHand,
      selectedCardIds: prev.selectedCardIds.filter((id) => !returnedIdSet.has(id)),
      reopenedPassNotice: reopenedByTichu ? noticeMessage : null,
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
      hasPlayedOrPassedInRound: false,
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
    comboName: string | I18nLogPayload,
    points: number,
    type?: number,
    phoenixValue?: number | string | Array<number | string> | null,
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
    const nextCustomHandOrder = isCurrent
      ? prev.customHandOrder.filter((id) => !playedIds.has(id))
      : prev.customHandOrder;
    let nextCardGroups = prev.cardGroups;
    if (isCurrent && Object.keys(prev.cardGroups).length > 0) {
      nextCardGroups = {};
      for (const [cid, grp] of Object.entries(prev.cardGroups)) {
        if (!playedIds.has(cid)) {
          nextCardGroups[cid] = grp;
        }
      }
    }
    if (
      isCurrent &&
      !isReadOnlyEnv(prev.isSpectator) &&
      prev.tableId > 0 &&
      prev.currentPlayerId &&
      (prev.customHandOrder.length > 0 || Object.keys(prev.cardGroups).length > 0)
    ) {
      if (nextHand.length === 0) {
        deleteCustomHandEntry(prev.tableId, prev.currentPlayerId);
      } else {
        saveCustomHandEntry(
          prev.tableId,
          prev.currentPlayerId,
          prev.round,
          nextCustomHandOrder,
          nextCardGroups,
        );
      }
    }

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

    const normalizedComboName = normalizeComboDescriptionInput(comboName);
    const normalizedPhoenix =
      phoenixValue !== undefined ? normalizePhoenixValue(phoenixValue) : undefined;
    const needsInference =
      type === undefined ||
      Number(type) <= 0 ||
      normalizedPhoenix === undefined ||
      Array.isArray(normalizedPhoenix);
    const inferred = needsInference
      ? Combo.inferPlayedCombo(normalized, prev.trickLastCombo, normalizedComboName)
      : null;
    const comboType =
      type !== undefined && Number(type) > 0
        ? Number(type)
        : inferred && inferred.type > 0
          ? inferred.type
          : 0;
    const comboPhoenix =
      normalizedPhoenix !== undefined && !Array.isArray(normalizedPhoenix)
        ? normalizedPhoenix
        : (inferred?.phoenixValue ?? null);
    const finalDescription = normalizedComboName || inferred?.description || "";

    const lastCombos = {
      ...prev.lastCombos,
      [pid]: {
        cards: normalized,
        description: finalDescription,
        passed: false,
        type: comboType,
        phoenixValue: comboPhoenix,
      },
    };

    this.update({
      hand: nextHand,
      selectedCardIds: nextSelectedIds,
      customHandOrder: nextCustomHandOrder,
      cardGroups: nextCardGroups,
      players,
      hasPlayedOrPassedInRound: isCurrent ? true : prev.hasPlayedOrPassedInRound,
      lastCombos,
      lastComboPlayerId: pid,
      trickLastCombo: {
        playerId: pid,
        type: comboType,
        cards: normalized,
        phoenixValue: comboPhoenix,
        description: finalDescription,
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
      hasPlayedOrPassedInRound: pid === prev.currentPlayerId ? true : prev.hasPlayedOrPassedInRound,
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
    fadeDelayMs = ANIM_TIMINGS.betSplashHoldMs,
    fadeDurationMs = ANIM_TIMINGS.betSplashFadeMs,
  ): void {
    if (!this.getState().animationsEnabled) {
      return;
    }
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
    const lastCombos: Record<string, LastComboState> = {};
    for (const [id, player] of Object.entries(prev.players)) {
      players[id] = {
        ...player,
        capturedPoints:
          id === pid ? player.capturedPoints + Number(trickValue) : player.capturedPoints,
        passedCardReady: false,
      };
      lastCombos[id] = { cards: [], description: "", passed: false };
    }
    this.update({ players, lastCombos });
  }

  applyNewScores(
    newScores: Record<string | number, number | string>,
    roundScore?: RoundScoreRecord | null,
  ): void {
    const prev = this.getState();
    const prevTotals = getTeamScoresFromPlayers(prev.players);
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
    const nextTotals = getTeamScoresFromPlayers(players);
    const normalizedRecord = roundScore ? normalizeRoundScoreRecord(roundScore) : null;
    let roundHistory = [...prev.roundHistory];
    if (normalizedRecord) {
      const existingIdx = roundHistory.findIndex(
        (r) => !r.isSyntheticPrior && r.round === normalizedRecord.round,
      );
      if (existingIdx >= 0) {
        roundHistory[existingIdx] = normalizedRecord;
      } else {
        roundHistory.push(normalizedRecord);
      }
    } else {
      const fallbackRound = Math.max(1, prev.round || roundHistory.length + 1);
      roundHistory.push({
        round: fallbackRound,
        isSyntheticPrior: true,
        priorThroughRound: fallbackRound,
        cardPoints: [0, 0],
        doubleVictory: -1,
        bets: {},
        teamPoints: [nextTotals[0] - prevTotals[0], nextTotals[1] - prevTotals[1]],
        teamTotals: [nextTotals[0], nextTotals[1]],
      });
    }
    this.update({ players, roundHistory });
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

  setAnimationsEnabled(animationsEnabled: boolean): void {
    this.update({ animationsEnabled: Boolean(animationsEnabled) });
    syncAnimCssVars();
  }

  setExperimentalReplayOpen(experimentalReplayOpen: boolean): void {
    this.update({ experimentalReplayOpen });
  }

  setTrickModalOpen(trickModalOpen: boolean): void {
    this.update({ trickModalOpen });
  }

  setSettingsModalOpen(settingsModalOpen: boolean): void {
    this.update({ settingsModalOpen: Boolean(settingsModalOpen) });
  }

  setScoreModalOpen(scoreModalOpen: boolean): void {
    this.update({ scoreModalOpen: Boolean(scoreModalOpen) });
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
    "--ui-icons-url",
    `url(${themeUrl}img/tichu-ui-icons.png)`,
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
