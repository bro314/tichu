declare var gameui: GameGui;
declare var g_replayFrom: number | undefined;
declare var g_gamethemeurl: string;
declare var g_themeurl: string;
declare var g_archive_mode: boolean;
declare function _(str: string): string;
declare function __(site: string, str: string): string;
declare function $(text: string | Element): HTMLElement;
declare function playSound(id: string): void;

declare const define: any;
declare const ebg: any;
declare const dojo: any;
declare const dijit: any;
declare type eventhandler = (event?: any) => void;

type ElementOrId = Element | string;
type StringProperties = { [key: string]: string };

declare class GameNotifQueue {
  /**
   * Set the notification deinfed by notif_type as "synchronous"
   * @param notif_type - the type of notification
   * @param duration - the duration of notification wait in milliseconds
   * If "duration" is specified: set a simple timer for it (milliseconds)
   * If "duration" is not specified, the notification handler MUST call "setSynchronousDuration"
   */
  setSynchronous(notif_type: string, duration?: number): void;
  /**
   * Set dynamically the duration of a synchronous notification
   * MUST be called if your notification has not been associated with a duration in "setSynchronous"
   * @param duration - how long to hold off till next notficiation received (milliseconds)
   */
  setSynchronousDuration(duration: number): void;

  /**
   * Ignore notification if predicate is true
   * @param notif_type  - the type of notificatio
   * @param predicate - the function that if returned true will make framework not dispatch notification.
   * NOTE: this cannot be used for syncronious unbound notifications
   */
  setIgnoreNotificationCheck(notif_type: string, predicate: (notif: object) => boolean): void;
}

declare class GameGui {
  page_is_unloading: boolean;
  game_name: string;
  instantaneousMode: boolean;
  player_id: number;
  interface_min_width: number;
  gamedatas: TichuGamedatas;
  isSpectator: boolean;
  bRealtime: boolean;
  notifqueue: GameNotifQueue;
  last_server_state: any;
  scoreCtrl: { [key: number]: Counter };
  on_client_state: boolean;
  tooltips: string[];
  is_client_only: boolean;
  prefs: any[];
  table_id: number;
  metasiteurl: string;

  isCurrentPlayerActive(): boolean;
  getActivePlayerId(): number;
  addActionButton(
    id: string,
    label: string,
    method: string | eventhandler,
    destination?: string | null,
    blinking?: boolean,
    color?: string
  ): void;
  removeActionButtons(): void;
  checkAction(action: any, nomessage?: boolean): boolean;
  ajaxcall(
    url: string,
    args: object,
    bind: GameGui,
    resultHandler: (result: any) => void,
    allHandler?: (err: any) => void
  ): void;
  connect(node: ElementOrId, ontype: string, handler: any): void;
  disconnect(node: ElementOrId, ontype: string): void;
  connectClass(cls: string, ontype: string, handler: any): void;

  setup(gamedatas: object): void;
  onEnteringState(stateName: string, args: { args: any } | null): void;
  onLeavingState(stateName: string): void;
  onUpdateActionButtons(stateName: string, args: any): void;
  setupNotifications(): void;

  setClientState(newState: string, args: object): void;
  restoreServerGameState(): void;

  showMessage(msg: string, type: string): void;
  showMoveUnauthorized(): void;
  onScriptError(msg: string, url?: string, linenumber?: number): void;
  inherited(args: any): any;
  format_string_recursive(log: string, args: any[]): string;
  format_block(template_id: string, args: object): HTMLElement;
  fadeOutAndDestroy(node: Node, duration: number, delay: number): void;
  clienttranslate_string(text: string): string;

  onScreenWidthChange(): void;

  slideToObject(
    mobile_obj: string | Element,
    target_obj: string | Element,
    duration?: number,
    delay?: number
  ): Animation;
  slideToObjectPos(
    mobile_obj: string | Element,
    target_obj: string | Element,
    target_x: number,
    target_y: number,
    duration?: number,
    delay?: number
  ): Animation;
  slideTemporaryObject(
    mobile_obj_html: string,
    mobile_obj_parent: string | Element,
    from: string | Element,
    to: string | Element,
    duration?: number,
    delay?: number
  ): Animation;
  slideToObjectAndDestroy(
    mobile_obj: string | Element,
    target_obj: string | Element,
    duration?: number,
    delay?: number
  ): void;

  displayScoring(
    anchor_id: string,
    color: string,
    score: number | string,
    duration?: number,
    offset_x?: number,
    offset_y?: number
  ): void;
  showBubble(
    anchor_id: string,
    text: string,
    delay?: number,
    duration?: number,
    custom_class?: string
  ): void;
  updateCounters(counters: any): void;

  addTooltip(
    nodeId: string,
    helpStringTranslated: string,
    actionStringTranslated: string,
    delay?: number
  ): void;
  addTooltipHtml(nodeId: string, html: string, delay?: number): void;
  addTooltipHtmlToClass(cssClass: string, html: string, delay?: number): void;
  addTooltipToClass(
    cssClass: string,
    helpStringTranslated: string,
    actionStringTranslated: string,
    delay?: number
  ): void;
  removeTooltip(nodeId: string): void;

  confirmationDialog(
    message: string,
    yesHandler: (param: any) => void,
    noHandler?: (param: any) => void,
    param?: any
  ): void;
  multipleChoiceDialog(message: string, choices: any[], callback: (choice: number) => void): void;

  enablePlayerPanel(player_id: number): void;
  disablePlayerPanel(player_id: number): void;
  enableAllPlayerPanels(): void;

  updatePageTitle(): void;
}

declare interface Notif {
  type: string; // type of the notification (as passed by php function)
  log: string; // the log string passed from php notification
  args: any; // This is the arguments that you passed on your notification method on php
  bIsTableMsg: boolean; // is true when you use [[Main_game_logic:_yourgamename.game.php#NotifyAllPlayers|NotifyAllPlayers]] method (false otherwise)
  channelorig: string; // information about table ID (formatted as : "/table/t[TABLE_NUMBER]")
  gamenameorig: string; // name of the game
  move_id: number; // ID of the move associated with the notification
  table_id: number; // ID of the table (comes as string)
  time: number; // UNIX GMT timestamp
  uid: number; // unique identifier of the notification
  h: string; // unknown
}

/* TODO repace Function by (..params) => void */
interface Dojo {
  place: (html: string, nodeId: string, action?: string) => void;
  style: Function;
  hitch: Function;
  hasClass: (nodeId: string, className: string) => boolean;
  addClass: (nodeId: string, className: string) => void;
  removeClass: (nodeId: string, className?: string) => void;
  toggleClass: (nodeId: string, className: string, forceValue?: boolean) => void;
  connect: Function;
  disconnect: Function;
  query: Function;
  subscribe: Function;
  string: any;
  fx: any;
  marginBox: Function;
  fadeIn: Function;
  trim: Function;
  stopEvent: (evt: any) => void;
  destroy: (nodeId: string) => void;
  forEach: Function;
}

type Gamestate = any; // TODO

interface Player {
  beginner: boolean;
  color: string;
  color_back: any | null;
  eliminated: number;
  id: number;
  is_ai: string;
  name: string;
  score: string;
  zombie: number;
}

declare class Counter {
  speed: number;
  create(target: string): void; //  associate counter with existing target DOM element
  getValue(): number; //  return current value
  incValue(by: number): number; //  increment value by "by" and animate from previous value
  setValue(value: number): void; //  set value, no animation
  toValue(value: number): void; // set value with animation
  disable(): void; // Sets value to "-"
}

interface StockItem {
  // For Tichu this is the card.id, which is random and just DB id.
  id: string;
  // For Tichu this is unique card identifier that you get from color (type) and value (type_arg).
  type: number;
}

interface StockItemType {
  weight: number;
  image: string;
  image_position: number;
}

// itemType -> weight
type Weights = Record<number, number>;

interface Stock {
  items: StockItem[];
  item_type: { [cardUniqueId: number]: StockItemType };
  item_width: number;
  item_margin: number;
  selectionClass: string;
  container_div: HTMLDivElement;
  extraClasses: string;

  create: (game: GameGui, div: any, cardwidth: number, cardheight: number) => void;
  setSelectionMode: (selectionMode: number) => void;
  centerItems: boolean;
  image_items_per_row: number;
  updateDisplay: (from?: string) => void;
  setSelectionAppearance: (appearance: string) => void;
  onItemCreate: (itemDiv: any, itemType: number, itemDivId: string) => void;
  addToStock: (cardUniqueId: number) => void;
  addToStockWithId: (cardUniqueId: number, cardId: string, from?: string) => void;
  addItemType: (
    cardUniqueId: number,
    cardWeight: number,
    cardsurl: string,
    imagePosition: number
  ) => void;
  getSelectedItems: () => StockItem[];
  getAllItems: () => StockItem[];
  unselectAll: () => void;
  removeAll: () => void;
  removeFromStockById: (id: string, to?: string) => void;
  removeAllTo: (to: string) => void;
  unselectItem: (id: string) => void;
  setOverlap: (horizontal_percent: number, vertical_percent: number) => void;
  changeItemsWeight(newWeights: Weights): void;
}
