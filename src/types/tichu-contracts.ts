export enum Bet {
  /** Player can still make a Grand Tichu bet. */
  INITIAL = "-2",
  /** Player can still make a Tichu bet. */
  NO_BET_YET = "-1",
  /** Player cannot bet anymore. */
  NO_BET = "0",
  TICHU = "100",
  GRAND_TICHU = "200",
}

export interface CardData {
  id: string;
  /** 1-4: 1=black/Dragon, 2=red/Phoenix, 3=blue/Dog, 4=green/Mahjong */
  type: string;
  /** 1-14: 1=special card, 2-10=number, 11=J, 12=Q, 13=K, 14=A */
  type_arg: string;
  location?: string;
  location_arg?: string;
  passed_from?: string;
}

export type Card = CardData;

export interface TichuCombo {
  cards: CardData[];
  description: string;
  phoenixValue: number | string | Array<number | string> | null;
  type: number;
}

export interface I18nLogPayload {
  log: string;
  args: Record<string, unknown>;
}

export interface RoundBetOutcome {
  type: "GT" | "T";
  won: boolean;
  delta: number;
}

export interface RoundScoreRecord {
  round: number;
  cardPoints: [number, number];
  doubleVictory: number;
  bets: Record<string, RoundBetOutcome>;
  teamPoints: [number, number];
  teamTotals: [number, number];
  isSyntheticPrior?: boolean;
  priorThroughRound?: number;
}

/**
 * Authoritative client-server notification contract.
 * Keys and payload properties mirror `modules/managers/NotificationManager.php`.
 */
export interface TichuNotificationMap {
  dealCards: { codeVersion?: string; cards: CardData[] };
  grandTichuBet: { codeVersion?: string; player_id: number; player_name: string; bet: number };
  tichuBet: { codeVersion?: string; player_id: number; player_name: string; bet: number };
  log: Record<string, unknown>;
  playCombo: {
    codeVersion?: string;
    i18n?: string[];
    player_id: number;
    player_name: string;
    combo_name: string | I18nLogPayload;
    phoenix_rank?: string;
    cards: CardData[];
    points: number;
    type?: number;
    phoenixValue?: number | string | Array<number | string> | null;
  };
  wishMade: {
    codeVersion?: string;
    i18n?: string[];
    player_id: number;
    player_name: string;
    wish: number;
    text_value: string;
  };
  mahjongWishGranted: { codeVersion?: string };
  playerGoOut: {
    codeVersion?: string;
    firstout_id: number;
    player_id: number;
    player_name: string;
  };
  pass: { codeVersion?: string; player_id: number; player_name: string };
  devConsole: { codeVersion?: string; msg: string };
  tableWindow: {
    codeVersion?: string;
    i18n?: string[];
    id: string;
    title: string;
    table: unknown[][];
    closing: string;
  };
  newScores: {
    codeVersion?: string;
    newScores: { [key: number]: number | string; [key: string]: number | string };
    roundScore?: RoundScoreRecord | null;
  };
  captureCards: {
    codeVersion?: string;
    player_id: number;
    player_name: string;
    trick_value: number;
  };
  autopass: { codeVersion?: string; autopass: string | number };
  confirmTichu: { codeVersion?: string; grand: boolean; msg: string };
  acceptCards: {
    codeVersion?: string;
    i18n?: string[];
    cards: CardData[];
    card1: string;
    card2: string;
    card3: string;
  };
  passCards: {
    codeVersion?: string;
    i18n?: string[];
    cardIds: string[];
    card1: string;
    card2: string;
    card3: string;
  };
  unpassCards: {
    codeVersion?: string;
    cardIds: string[];
    cards: CardData[];
    reopenedByTichu: boolean;
    callerId?: number;
    callerName?: string;
  };
  botSuggestion: { codeVersion?: string; suggestion: Record<string, unknown> };
  concedeProposal: { codeVersion?: string; player_id: number; player_name: string; team: number };
  concedeCancel: { codeVersion?: string; player_id: number; player_name: string; reason: string };
  concedeResult: {
    codeVersion?: string;
    team: number;
    player_id: number;
    player_name: string;
    player_id2: number;
    player_name2: string;
  };
}

/**
 * Authoritative client-server action contract.
 * Keys and parameter objects mirror `tichu.action.php`.
 */
export interface TichuActionMap {
  grandTichuBet: { bet: "0" | "200" | 0 | 200 };
  tichuBet: { bet: "100" | 100 };
  confirmTichu: { bet: "0" | "100" | "200" | 0 | 100 | 200 };
  makeAWish: { wish: number | string };
  choosePhoenix: { phoenixValue?: number | string };
  playCombo: { cards: string };
  playBomb: { cards: string };
  pass: { onlyOnce?: boolean | 0 | 1 };
  cancelAutopass: {};
  giveTheCards: { cards: string };
  unpassCards: {};
  acceptCards: {};
  collect: {};
  cancelPhoenix: {};
  cancel: {};
  chooseDragonGift: { player: number | string };
  proposeConcede: {};
  respondConcede: { accept: boolean | 0 | 1 };
}

export type TichuStatePossibleAction =
  | "grandTichuBet"
  | "giveCards"
  | "pass"
  | "tichuBet"
  | "makeAWish"
  | "phoenixPlay"
  | "chooseDragonGift"
  | "collect"
  | "acceptCards"
  | "playCombo";

export interface TichuPlayer {
  call_tichu: Bet;
  call_grand_tichu: Bet;
  pass?: string | number;
  no: number;
  team?: number | string;
}

export interface TichuConcedeState {
  proposalBy: number;
  usedThisRound: boolean;
  partnerIsZombie: boolean;
  minDeficit: number;
  minRound: number;
}

export interface TichuGamedatas {
  allLastCombos: Record<number, TichuCombo>;
  capturedpoints: Record<number, number>;
  capturedCards: CardData[];
  currentTrick: CardData[];
  currentTrickValue: number;
  firstoutplayer: number;
  codeVersion?: string;
  gameVersion?: number;
  hand: CardData[];
  handcount: Record<number, number>;
  lastCombo?: TichuCombo & { player?: string | number };
  lastComboDescription: string;
  lastComboPlayer: string | number;
  mahjongOwner: number;
  mahjongWish: number;
  isAllInfoExposed: number;
  hasPlayedOrPassedInRound?: boolean;
  passes: number[];
  round: number;
  trick: number;
  roundHistory?: RoundScoreRecord[];
  targetScore?: number;
  concede?: TichuConcedeState;
}

export type TypedNotif<K extends keyof TichuNotificationMap> = Notif<TichuNotificationMap[K]>;

export type NotifTypes = TichuNotificationMap;

declare global {
  interface NotifTypes extends TichuNotificationMap {}

  interface PlayerActions {
    grandTichuBet: {};
    giveCards: {};
    pass: {};
    tichuBet: {};
    makeAWish: {};
    phoenixPlay: {};
    chooseDragonGift: {};
    collect: {};
    acceptCards: {};
    playCombo: {};
  }

  interface Player extends TichuPlayer {}

  interface Gamedatas extends TichuGamedatas {}
}
