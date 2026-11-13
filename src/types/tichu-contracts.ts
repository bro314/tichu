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
  phoenixValue: number | null;
  type: number;
}

/**
 * Authoritative client-server notification contract.
 * Keys and payload properties mirror `modules/managers/NotificationManager.php`.
 */
export interface TichuNotificationMap {
  dealCards: { cards: CardData[] };
  grandTichuBet: { player_id: number; player_name: string; bet: number };
  tichuBet: { player_id: number; player_name: string; bet: number };
  log: Record<string, unknown>;
  playCombo: {
    i18n?: string[];
    player_id: number;
    player_name: string;
    combo_name: string;
    cards: CardData[];
    points: number;
  };
  wishMade: {
    i18n?: string[];
    player_id: number;
    player_name: string;
    wish: number;
    text_value: string;
  };
  mahjongWishGranted: {};
  playerGoOut: { firstout_id: number; player_id: number; player_name: string };
  pass: { player_id: number; player_name: string };
  devConsole: { msg: string };
  tableWindow: { id: string; title: string; table: unknown[][]; closing: string };
  newScores: { newScores: { [key: number]: number | string; [key: string]: number | string } };
  captureCards: { player_id: number; player_name: string; trick_value: number };
  autopass: { autopass: string | number };
  confirmTichu: { grand: boolean; msg: string };
  acceptCards: { cards: CardData[]; card1: string; card2: string; card3: string };
  passCards: { cardIds: string[]; card1: string; card2: string; card3: string };
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
  acceptCards: {};
  collect: {};
  cancelPhoenix: {};
  cancel: {};
  chooseDragonGift: { player: number | string };
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
}

export interface TichuGamedatas {
  allLastCombos: Record<number, TichuCombo>;
  capturedpoints: Record<number, number>;
  capturedCards: CardData[];
  currentTrick: CardData[];
  currentTrickValue: number;
  firstoutplayer: number;
  hand: CardData[];
  handcount: Record<number, number>;
  lastComboDescription: string;
  lastComboPlayer: string | number;
  mahjongOwner: number;
  mahjongWish: number;
  isAllInfoExposed: number;
  passes: number[];
  round: number;
  trick: number;
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
