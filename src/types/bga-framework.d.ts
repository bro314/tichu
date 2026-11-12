type ElementOrId = Element | string;

declare const define: Function;

declare const ebg: {
  core: {
    core: any;
    sitecore: any;
    gamegui: any;
    i18n: any;
  };
  counter: {
    new (): Counter;
  };
  stock: {
    new (): Stock;
  };
  popindialog: {
    new (): PopinDialog;
  };
  gamenotif: {
    new (): GameNotifQueue;
  };
  scrollmap: any;
  dices: any;
  zone: any;
  expandablesection: any;
  draggable: any;
  pageheader: any;
  playerlocation: any;
  tableresults: any;
  chatinput: any;
  thumb: any;
  webpush: any;
};

declare const dojo: Dojo;

declare const gameui: GameGui;

/**
 * Global contains replay number in live game, it is set to undefined (i.e. not set) when it is not a replay mode, so consequentially the good check is typeof g_replayFrom != 'undefined' which returns true if the game is in replay mode during the game (the game is ongoing but the user clicked "replay from this move" in the log)
 */
declare const g_replayFrom: number | undefined;

/**
 * The URL to the root of the game files, for example to access dynamically to an image.
 */
declare const g_gamethemeurl: string;

/**
 * Returns true if the game is in archive mode after the game (the game has ended)
 */
declare const g_archive_mode: boolean;

/**
 * Returns an object if the game is in tutorial mode, or undefined otherwise.
 */
declare const g_tutorialwritten: Object | undefined;

/**
 * Returns a translated sentence.
 *
 * @param str english sentence
 */
declare function _(str: string): string;

/**
 * Returns a translated sentence from a specific domain.
 *
 * @param domain translation domain
 * @param str english sentence
 */
declare function __(domain: string, str: string): string;

/**
 * Get an HTML element using its "id" attribute.
 * @param text element id
 */
declare function $(text: ElementOrId): HTMLElement;

/**
 * Loads a versionned BGA game lib.
 *
 * @param name the name of the lib, usually prefixed by `bga-`
 * @param version the version, either taking the last available version `1.x` or a fixed version `1.0.0`
 * @param type module format (e.g. `"esm"`)
 */
declare function getLibUrl(name: string, version: string, type?: string): string;

declare function playSound(sound: string): void;
declare function stopSound(sound: string): void;

interface Gamestate {
  active_player?: string;
  args: any;
  id: string;
  name: string;
  type: string;
  description?: string;
  descriptionmyturn?: string;
  descriptionnoother?: string;
  descriptionmyturnnoother?: string;
  possibleactions?: string[];
  multiactive?: string[];
  transitions?: { [transitionName: string]: number | string };
  updateGameProgression?: number;
  reflexion?: {
    total: { [playerId: number]: number };
    initial?: { [playerId: number]: number };
    initial_ts?: { [playerId: number]: number };
  };
  private_state?: Gamestate;
}

interface Gamedatas<P = Player> {
  gamestate: Gamestate;
  gamestates: { [gamestateId: number]: Gamestate };
  playerorder: (string | number)[];
  players: { [playerId: number]: P };
  counters?: { [counterName: string]: { counter_name: string; counter_value: number } };
  notifications?: {
    last_packet_id: number;
    move_nbr: number;
    table_next_notification_no?: number;
  };
  decision?: any;
  tablespeed?: number | string;
  game_result_neutralized?: number | string;
  neutralized_player_id?: number | string;
  turn_based_Multiactive_guiding?: boolean | number;
}

interface Player {
  beginner: boolean;
  color: string;
  color_back: any | null;
  eliminated: number;
  id: number;
  is_ai: string;
  name: string;
  score: string;
  score_aux?: string | number;
  zombie: number;
  no: number;
  avatar?: string;
  ack?: string;
  team?: number | string;
  concede?: number | string;
}

declare class GameNotifQueue {
  queue: Notif[];
  next_log_id: number;
  game: GameGui | null;
  dispatchedNotificationUids: Set<string>;
  checkSequence: boolean;
  last_packet_id: number;
  channelLastReceivedPacketId: { [channel: string]: number };
  channelLastAppliedPacketId: { [channel: string]: number };
  notificationResendInProgress: boolean;
  onNotificationResyncComplete: (() => void) | null;
  prevpacketBuffer: any[];
  prevpacketBufferTimeout: number | null;
  prevpacketBufferTimeoutMs: number;
  prevpacketBufferTimeoutResendRearmMs: number;
  synchronous_notifs: { [notifType: string]: number };
  waiting_from_notifend: Notif | null;
  synchronousNotifEndTimeout: number | null;
  ignoreNotificationChecks: { [notifType: string]: (notif: Notif) => boolean };
  moveSyncBuffer: { [moveId: string]: any };
  currentNotifCallback: string | null;
  onPlaceLogOnChannel: ((notif: Notif) => boolean) | null;
  lastMsgTime: number;
  bStopAfterOneNotif?: boolean;
  log_notification_name?: boolean;

  /**
   * Set the notification defined by notif_type as "synchronous"
   * @param notif_type - the type of notification
   * @param duration - the duration of notification wait in milliseconds
   * If "duration" is specified: set a simple timer for it (milliseconds)
   * If "duration" is not specified, the notification handler MUST call "setSynchronousDuration"
   */
  setSynchronous(notif_type: string, duration?: number): void;

  /**
   * Set dynamically the duration of a synchronous notification
   * MUST be called if your notification has not been associated with a duration in "setSynchronous"
   * @param duration - how long to hold off till next notification received (milliseconds)
   */
  setSynchronousDuration(duration: number): void;

  isSynchronousNotifProcessed(): boolean;

  /**
   * Ignore notification if predicate is true
   * @param notif_type  - the type of notification
   * @param predicate - the function that if returned true will make framework not dispatch notification.
   * NOTE: this cannot be used for synchronous unbound notifications
   */
  setIgnoreNotificationCheck(notif_type: string, predicate: (notif: Notif) => boolean): void;

  clearSynchronousNotificationEndTimer(): void;
  scheduleSynchronousNotificationEnd(duration: number): void;
  onSynchronousNotificationEnd(): void;
  onNotification(packet: any): void;
  resynchronizeNotifications(
    bLoadHistory?: boolean,
    fromPacketId?: number | null,
    onComplete?: () => void,
  ): void;
  dispatchNotifications(): boolean;
  dispatchNotification(notif: Notif, bMoveSoundPlayed?: boolean): boolean;
  hasDispatchedNotificationUid(uid: string): boolean;
  rememberDispatchedNotificationUid(uid: string): void;
  formatLog(log: string, args: any): string;
  addChatToLog(
    text: string,
    seemore?: string | boolean,
    translate?: boolean,
    customClass?: string,
  ): void;
  addToLog(
    text: string,
    seemore?: string | boolean,
    logaction?: any,
    isGameLog?: boolean,
    isChat?: boolean,
    isHistory?: boolean,
    time?: number,
    move_id?: number | string,
  ): number | undefined;
  onTranslateLog(evt: Event): void;
  playerNameFilter(args: any): any;
  playerNameFilterGame(args: any): any;
  debugReplayNotif(evt: Event): void;
}

declare class StatusBar {
  game: GameGui;
  currentAutoclickTimer?: number;
  currentAutoclickButton?: HTMLButtonElement;
  currentAutoclickProgressBar?: HTMLDivElement;
  currentAutoclickAnimation?: Animation;
  currentAutoclickRemainingTime?: number;

  /**
   * Set the title displayed on the status bar. It will automatically apply styling on `${you}`, `${actplayer}`, or any variable passed in args (for example, entering state args).
   *
   * @param {string} title the title to set
   * @param {Object} args the optional args to use in format_string_recursive to format the title
   */
  setTitle(title: string, args?: any): void;

  /**
   * Add a button to the status bar.
   *
   * @param {string} label the button text
   * @param {Function} callback the function to trigger when clicked
   * @param {Object} params the optional parameters, by default { color: 'primary', id: null, classes: '', destination: document.getElementById('generalactions'), title: undefined, disabled: false, tooltip: undefined, confirm: undefined, autoclick: false }.
   *   `color` can be primary (default) (blue), secondary (gray), alert (red)
   *   `id` is the id to set. If null/undefined, the button will not have an id, but you can still manipulate it by storing the reference to the DOM Element returned by the function
   *   `classes` can be a string or an array, so `'disabled blinking'` and `['disabled', 'blinking']` are both possible.
   *   `destination` the DOM Element to add the button to. If not specified, will add it to the status bar.
   *   `title` plain text description of the label. Should be set when the button label is an icon, for accessibility
   *   `disabled` boolean to make the button disabled. Will prevent the callback to be executed
   *   `tooltip` the tooltip of the button
   *   `confirm` the confirm message to display before triggering the callback, if set.
   *   `autoclick` if the button should be auto clicked after a small delay (for Confirmation buttons).
   *
   * @returns the button DOM element
   */
  addActionButton(
    label: string,
    callback: Function,
    params?: {
      color?: "primary" | "secondary" | "alert" | "blue" | "gray" | "red";
      id?: string;
      classes?: string | string[];
      destination?: ElementOrId;
      title?: string;
      disabled?: boolean;
      tooltip?: string;
      confirm?: string | (() => string | undefined | null);
      autoclick?: boolean | { abortSignal?: AbortSignal; pausable?: boolean };
    },
  ): HTMLButtonElement;

  /**
   * Remove all buttons on the status bar
   */
  removeActionButtons(): void;
}

declare class Sounds {
  game: GameGui;

  /**
   * Load a sound file to be used with play.
   *
   * @param {string} id the id to be used by play
   * @param {string} fileName the file name, without extension (there should be a .ogg and a .mp3 with that file name in the img folder). If unset, it will try with the id as file name.
   */
  load(id: string, fileName?: string): void;

  dontPreloadSounds(sounds: string[]): void;
  preloadSounds(sounds: string[]): void;

  /**
   * Play the sound with the given id.
   *
   * @param {string} id the sound id
   */
  play(id: string): void;

  getSoundUrl(id?: string): string;
}

declare class GameGui<G = Gamedatas> {
  bga: any;
  bgaInternal: any;
  bgaSoundService: any;
  bgaRtcService: any;
  bgaTimeService: any;
  bgaChatService: any;
  bgaMessageService: any;
  bgaTableCounters: { [counterName: string]: Counter[] };
  bgaPlayerCounters: { [counterName: string]: { [playerId: number]: Counter[] } };

  game_id: number;
  game_name: string;
  game_version: string;
  game_name_displayed: string;

  /**
   * Return true if the game is in realtime. Note that having a distinct behavior in realtime and turn-based should be exceptional.
   */
  bRealtime: boolean;
  bTutorialMode: boolean;
  bHotseatMode: boolean;
  bCoopGame: boolean;
  is_coop: boolean;
  bSoloGame: boolean;
  isSimul: boolean;

  /**
   * Returns true during replay/archive mode if animations should be skipped.
   *
   * @deprecated use this.bgaAnimationsActive() instead
   */
  instantaneousMode: boolean;

  /**
   * Contains the initial set of data to init the game, created at game start or by game refresh (F5).
   */
  gamedatas: G;

  channel: string | null;
  privatechannel: string | null;

  /**
   * id of the player who is looking at the game. The player may not be part of the game (i.e. spectator)
   */
  player_id: number;
  table_id: number;

  /**
   * Flag set to true if the user at the table is a spectator (not a player).
   */
  isSpectator: boolean;

  /**
   * Boolean indicating that we are in client state
   */
  on_client_state: boolean;
  last_server_state: Gamestate | null;

  /**
   * The player panel score counters.
   */
  scoreCtrl: { [player_id: number]: Counter };

  statusBar: StatusBar;
  images: any;
  sounds: Sounds;
  tableOptions: any;
  userPreferences: any;
  players: any;
  actions: any;
  notifications: any;
  display3d: any;
  debug: any;
  gameArea: any;
  playerPanels: any;
  dialogs: any;
  states: any;
  notifqueue: GameNotifQueue;

  prefs: { [prefId: number]: { value: number | string; [key: string]: any } };
  ebgControls: any[];
  interface_autoscale: boolean;
  gameinterface_zoomFactor: number;
  currentZoom: number;
  mozScale: number;
  screenMinWidth: number;
  rotateToPosition: { [nodeId: string]: number };
  connections: any[];
  subscriptions: any[];
  comet_subscriptions: any[];
  tooltips: { [nodeId: string]: any };
  tooltipsInfos: {
    [nodeId: string]: { help?: string; action?: string; html?: string; delay?: number };
  };
  bHideTooltips: boolean;
  defaultTooltipPosition: string[];
  dontPreloadList: { [imageName: string]: boolean };
  disableNextMoveSoundFlag: boolean;
  dockedChat: boolean;
  chat_on_gs_side: boolean;
  chatbarWindows: { [windowId: string]: any };
  ajaxcall_running: number;
  page_is_unloading: boolean;
  window_visibility: "visible" | "hidden";
  isTouchDevice: boolean;
  currentPlayerReflexionTime: {
    positive: boolean;
    mn: number;
    s: number;
    h?: number;
    string?: string;
  };
  activePlayerReflexionTime: {
    positive: boolean;
    mn: number;
    s: number;
    h?: number;
    string?: string;
  };

  completesetup(
    game_name: string,
    game_version: string,
    game_id: number,
    gamedatas: G,
    player_id: number,
    channel: string,
    privatechannel: string,
    globalUserInfos: any,
    bRealtime: boolean,
    table_id: number,
    bTutorialMode: boolean,
  ): void;

  /**
   * Setup the whole game GUI with datas from the game
   */
  setup(gamedatas: G, keep_existing_gamedatas_limited?: boolean): void;

  setupNotifications(): void;

  /**
   * This method is called each time we enter a new game state. You can use this method to perform some user interface changes at this moment. To access state arguments passed via calling php arg* method use args?.args. Typically you would do something only for active player, using this.isCurrentPlayerActive() check. It is also called (for the current game state only) when doing a browser refresh (after the setup method is called).
   *
   * Warning: for MULTIPLE_ACTIVE_PLAYER states: the active players are NOT active yet so you must use onUpdateActionButtons to perform the client side operation which depends on a player active/inactive status. If you are doing initialization of some structures which do not depend on the active player, you can just replace (this.isCurrentPlayerActive()) with (!this.isSpectator) for the main switch in that method.
   *
   * @param {string} stateName the name of the state
   * @param {Object} args an object containing the state args
   */
  onEnteringState(stateName: string, args: Gamestate): void;

  /**
   * This method is called each time we leave a game state. You can use this method to perform some user interface changes at this point (i.e. cleanup).
   *
   * @param {string} stateName the name of the state
   */
  onLeavingState(stateName: string): void;

  /**
   * In this method you can manage "action buttons" that are displayed in the action status bar and highlight active UI elements.
   * To access state arguments passed via calling php arg* method use args parameter.
   *
   * Note: args can be null! For game states and when you don't supply state args function - it is null.
   *
   * This method is called when the active or multiactive player changes. In a classic ACTIVE_PLAYER state this method is called before the onEnteringState state.
   * In MULTIPLE_ACTIVE_PLAYER state it is called when a player "active" state changes, so it can be called multiple times during the state.
   *
   * @param {string} stateName the name of the state
   * @param {Object} args the state args
   */
  onUpdateActionButtons(stateName: string, args: { [key: string]: any } | null): void;

  onUpdateActionButtonsBefore(stateName: string, args: { [key: string]: any } | null): void;

  /**
   * Client state is an override of a real server game state, useful in some situations where several steps must be done on client side without any server interaction.
   * Client state acts like a server game state. Real current server game state can be restored with "restoreServerGameState" method.
   *
   * @param {string} stateName the name of the state
   * @param {Object} args the state args
   */
  setClientState(stateName: string, args?: { [key: string]: any }): void;

  /**
   * If you are in client state it will restore the current server state (cheap undo).
   */
  restoreServerGameState(): void;

  /**
   * Disable the standard "move" sound for this move (to replace it with your custom sound).
   * To be added in a notification handler.
   */
  disableNextMoveSound(): void;

  /**
   * This function can be overridden in your game to manage some resizing on the client side when the browser window is resized. This function is also triggered at load time, so it can be used to adapt to the viewport size at the start of the game too.
   */
  onScreenWidthChange(): void;

  onPlaceLogOnChannel(notif: Notif): boolean;
  registerEbgControl(control: any): void;
  adaptViewportSize(): void;

  /**
   * Returns the getBoundingClientRect ignoring the possible zoom factor linked to the autoscale.
   * Same behaviour as getBoundingClientRect/dojo.position for old browser, but the result is different for browser using the new CSS property norm (Chrome 128+, Firefox mobile)
   *
   * @param {*} obj element or id of element
   * @returns the bounding client rect full size
   */
  getBoundingClientRectIgnoreZoom(obj: ElementOrId): DOMRect;

  getCurrentPlayerId(): number;
  getCurrentPlayer(): Player;
  getPlayerColor(player_id: number | string): string | null;
  getPlayerName(player_id: number | string): string;
  isCurrentPlayerSpectator(): boolean;
  isSpectatorOrArchive(): boolean;

  /**
   * Returns true if the player on whose browser the code is running is currently active (it's his turn to play).
   *
   * @returns {boolean} is current player active
   */
  isCurrentPlayerActive(): boolean;

  /**
   * Returns true if the player is currently active (it's his turn to play).
   *
   * @param {number} player_id the player to check
   * @returns {boolean} is specified player active
   */
  isPlayerActive(player_id: number | string): boolean;

  /**
   * Get the list of current active players ids
   * @returns {number[]} the active player ids
   */
  getActivePlayers(): number[];

  /**
   * Return the id of the active player, or null if we are not in an ACTIVE_PLAYER type state.
   * @returns {number | null} the active player id
   */
  getActivePlayerId(): number | null;

  /**
   * Return the HTML code for a player name, colored and with optional background.
   * Set params `replaceByYou: true` to write "You" in current player's language instead of the player's name.
   *
   * @param {number} playerId the player id
   * @param {Object} params the call parameters, by default { replaceByYou: false }.
   * @return {string} the formatted player name
   */
  getFormattedPlayerName(
    playerId: number,
    params?: {
      replaceByYou?: boolean;
    },
  ): string;

  /**
   * This function allows to update the current page title and turn description according to the game state arguments.
   * Note: this function also calls this.onUpdateActionButtons.
   *
   * @deprecated If you just want to change the page title, use `this.statusBar.setTitle`
   */
  updatePageTitle(state?: Gamestate | null): void;

  setDescriptionOnMyTurn(text: string, moreargs?: any): void;
  setMainTitle(text: string, position?: "before" | "after"): void;
  setSubTitle(text: string, args?: any): void;

  /**
   * @deprecated use this.statusBar.addActionButton instead
   */
  addActionButton(
    id: string,
    label: string,
    method: string | Function,
    destination?: ElementOrId,
    blinking?: boolean,
    color?: string,
  ): void;

  /**
   * @deprecated use this.statusBar.removeActionButtons instead
   */
  removeActionButtons(): void;

  addImageActionButton(
    id: string,
    imageHtml: string,
    method: string | Function,
    destination?: ElementOrId,
    blinking?: boolean,
    color?: string,
    tooltip?: string,
  ): void;

  addLastTurnBanner(text?: string, args?: any): void;
  removeLastTurnBanner(): void;
  addWinConditionBanner(text: string, args?: any): void;

  /**
   * @deprecated use this.bgaPerformAction
   */
  ajaxcall(
    url: string,
    args: object,
    bind: any,
    resultHandler: (result: any) => void,
    allHandler?: (err: any, result?: any, errorCode?: any) => void,
    method?: string,
    customErrorHandler?: (err: any, ioArgs: any) => void,
  ): void;

  /**
   * Check if player can do the specified action by taking into account:
   *  - if interface is locked it will return false and show message "An action is already in progress", unless nomessage set to true
   *  - if player is not active it will return false and show message "This is not your turn", unless nomessage set to true
   *  - if action is not in list of possible actions (defined by "possibleaction" in current game state) it will return false and show "This move is not authorized now" error (unconditionally).
   *  - otherwise returns true
   *
   * @param {string} action the action to test
   * @param {boolean} nomessage if we want a silent check. default false.
   * @returns {boolean} the action is possible
   */
  checkAction(action: string, nomessage?: boolean): boolean;

  /**
   * This is independent of the player being active, so can be used instead of this.checkAction(). This is particularly useful for multiplayer states when the player is not active in a 'player may like to change their mind' scenario. Unlike this.checkAction, this function does NOT take interface locking into account
   * if action is not in list of possible actions (defined by "possibleaction" in current game state) it will return false and show "This move is not authorized now" error (unless nomessage is true).
   * otherwise returns true
   *
   * @param {string} action the action to test
   * @param {boolean} nomessage if we want a silent check. default false.
   * @returns {boolean} the action is possible
   */
  checkPossibleActions(action: string, nomessage?: boolean): boolean;

  /**
   * Shows predefined user error that move is unauthorized now.
   */
  showMoveUnauthorized(): void;

  checkLock(nomessage?: boolean): boolean;
  isInterfaceLocked(): boolean;
  isInterfaceUnlocked(): boolean;
  lockInterface(uuid?: string, type?: string | null): void;
  unlockInterface(uuid?: string): void;
  onLockInterface(lockData: { status: string; uuid: string; type?: string | null }): void;

  /**
   * Tell the interface to not preload a specific image in your img root directory.
   * @param {string} image the filename
   */
  dontPreloadImage(image: string): void;

  dontPreloadImages(images: string[]): void;
  ensureSpecificImageLoading(imagelist: string[], rootUrl?: string): void;

  /**
   * Ensure some specific images are loaded.
   */
  ensureSpecificGameImageLoading(imagelist: string[]): void;

  loadBgaGameLib(name: string, version: string): Promise<[any, any]>;
  registerBgaGameLibs(libs: [string, string][]): Promise<void>;

  /**
   * Function to know if animations should be played.
   * Animations should not be played in instantaneousMode, or if the tab is not displayed in the browser.
   *
   * @returns {boolean} if animations should be played
   */
  bgaAnimationsActive(): boolean;

  /**
   * Return a Promise that resolves at the end of a given number of ms.
   * If animations are not active, resolve instantaneously.
   *
   * @param {number} delay the time to wait, in milliseconds
   * @returns a promise when the timer ends
   */
  wait(delay: number): Promise<any>;

  /**
   * Auto-detect all notifications declared on the game object (functions starting with `notif_`)
   * and register them with dojo.subscribe.
   * Registered notifications will be synchronous and will have a minimum duration (if animations are active, by default 500ms with text and 1ms without).
   * If the notification function returns a Promise, the notification will end when the promise AND the minimum durations are over.
   * In case of a notification function returning a Promise, the dev is responsible to make it resolve instantaneously if animations are not active.
   *
   * Example of usage: `setupNotifications() { this.bgaSetupPromiseNotifications(); }`
   * And declaration of a notif will just be :
   * `notif_playedCard: function(args) { this.getPlayerTable(args.playerId).playCard(args.card); }`
   *
   * @param {Object} params the call parameters, by default { prefix: 'notif_', minDuration: 500, minDurationNoText: 1, logger: null, ignoreNotifications: [], onStart: undefined, onEnd: undefined, }.
   */
  bgaSetupPromiseNotifications(params?: {
    prefix?: string;
    minDuration?: number;
    minDurationNoText?: number;
    handlers?: Object[];
    logger?: Function;
    ignoreNotifications?: string[];
    onStart?: (notifName: string, msg: string, args: any) => any;
    onEnd?: (notifName: string, msg: string, args: any) => any;
  }): void;

  /**
   * Play a dojo animation and returns a promise resolved when it ends.
   *
   * @param {Object} anim the dojo animation.
   */
  bgaPlayDojoAnimation(anim: DojoAnimation): Promise<any>;

  /**
   * A callback that can be set by games to know when a user preference changes
   */
  onGameUserPreferenceChanged?: (pref_id: number, pref_value: number) => void;

  /**
   * Get a game-specific user preference value.
   */
  getGameUserPreference(pref_id: number): number;

  /**
   * Method to programmatically change a game-specific user preference.
   */
  setGameUserPreference(pref_id: number, value: number): void;

  getTableOption(option_id: number): number;

  /**
   * Trigger an ajax call for a game action.
   *
   * @param {string} action the action name
   * @param {Object} args the action arguments
   * @param {Object} params the call parameters, by default { lock: true, checkAction: true, checkPossibleActions: false }. Must be overriden to disable interface lock, or to disable checkAction.
   * @returns Promise of the ajax call, or undefined if there is no call (prevented by checkAction/checkPossibleActions)
   */
  bgaPerformAction(
    action: string,
    args?: any,
    params?: {
      lock?: boolean;
      checkAction?: boolean;
      checkPossibleActions?: boolean;
    },
  ): Promise<any> | undefined;

  /**
   * Return the Game Area div (for all displayed game components).
   *
   * @returns the Game Area div element
   */
  getGameAreaElement(): HTMLDivElement;

  /**
   * Return the div on the player board where the dev can add counters and other game specific indicators.
   *
   * @param {number} playerId the player id
   * @returns the div element for game specific content on player panels
   */
  getPlayerPanelElement(playerId: number): HTMLDivElement;

  /**
   * Updates the log/args before display, for example for formatting text notification with icons.
   *
   * @param log the log text
   * @param args the log args
   * @returns {Object} you must `return { log, args };`
   */
  bgaFormatText?(log: string, args: any): { log: string; args: any };

  /**
   * Allow the games to declare a `bgaFormatText` function that will be called at the beginning of each
   * format_string_recursive call.
   *
   * @deprecated use bgaFormatText instead
   */
  format_string_recursive(log: string, args: any): string;

  /**
   * Show an information message during few seconds on page head
   * @param {string} msg the string to display. It should be translated.
   * @param {string} type "info", "error", "only_to_log" If set to "info", the message will be an informative message on a white background. If set to "error", the message will be an error message on a red background and it will be added to log. If set to "only_to_log", the message will be added to the game log but will not popup at the top of the screen.
   */
  showMessage(msg: string, type: "info" | "error" | "only_to_log"): void;

  /**
   * substitute variables in a string
   * @param {string} string the string
   * @param {Object} args the substitutions
   * @returns {string} the updated string
   */
  format_string(string: string, args: { [key: string]: any }): string;
  format_block(jstpl_name: string, args: { [key: string]: any }): string;
  clienttranslate_string(str: string): string;
  strip_tags(input: string, allowed?: string): string;
  nl2br(str: string, is_xhtml?: boolean): string;

  /**
   * Places mobile_obj on target_obj, set the absolute positions and centers the mobile_obj on target_obj, effect is immediate
   * This is not really an animation, but placeOnObject is frequently used before starting an animation.
   *
   * Note: if it does not work check that:
   *  1°) mobile_obj has a position:absolute or position:relative
   *  2°) a fixed mobile_obj parent has a position absolute or relative
   */
  placeOnObject(mobile_obj: ElementOrId, target_obj: ElementOrId): void;

  /**
   * Place an object on another one with a delta (in px).
   *
   * Note: if it does not work check that:
   *  1°) mobile_obj has a position:absolute or position:relative
   *  2°) a fixed mobile_obj parent has a position absolute or relative
   */
  placeOnObjectPos(
    mobile_obj: ElementOrId,
    target_obj: ElementOrId,
    target_x: number,
    target_y: number,
  ): void;

  /**
   * Attach mobile_obj to a new parent, keeping its absolute position in the screen constant.
   * !! mobile_obj is no longer valid after that (a new corresponding mobile_obj is returned)
   */
  attachToNewParent(
    mobile_obj: ElementOrId,
    new_parent: ElementOrId,
    position?: string,
    no_3d_projection?: boolean,
  ): HTMLElement;

  attachToNewParentNoDestroy(
    mobile_obj: ElementOrId,
    new_parent: ElementOrId,
    position?: string,
    no_3d_projection?: boolean,
  ): HTMLElement;

  /**
   * Return an animation that is moving (slide) a DOM object over another one
   */
  slideToObject(
    mobile_obj: ElementOrId,
    target_obj: ElementOrId,
    duration?: number,
    delay?: number,
  ): DojoAnimation;

  /**
   * Return an animation that is moving (slide) a DOM object over another one at the given coordinates
   */
  slideToObjectPos(
    mobile_obj: ElementOrId,
    target_obj: ElementOrId,
    target_x: number,
    target_y: number,
    duration?: number,
    delay?: number,
  ): DojoAnimation;

  slideToObjectPctPos(
    mobile_obj: ElementOrId,
    target_obj: ElementOrId,
    pct_x: number,
    pct_y: number,
    duration?: number,
    delay?: number,
  ): DojoAnimation;

  /**
   * Create a temporary object and slide it from a point to another one, then destroy it.
   */
  slideTemporaryObject(
    mobile_obj_html: string,
    mobile_obj_parent: ElementOrId,
    from: ElementOrId,
    to: ElementOrId,
    duration?: number,
    delay?: number,
    scale?: number,
  ): DojoAnimation;

  /**
   * Slide an existing object to a destination, then destroy it.
   */
  slideToObjectAndDestroy(
    mobile_obj: ElementOrId,
    target_obj: ElementOrId,
    duration?: number,
    delay?: number,
  ): DojoAnimation;

  /**
   * Destroy an existing node with a smooth fadeout.
   */
  fadeOutAndDestroy(node: ElementOrId, duration?: number, delay?: number): DojoAnimation;

  transformSlideAnimTo3d(
    anim: DojoAnimation,
    node: HTMLElement,
    duration?: number,
    delay?: number | null,
    delta_x?: number,
    delta_y?: number,
  ): DojoAnimation;

  /**
   * It starts the animation, and stores the rotation degree in the class, so next time you rotate object - it is additive.
   * The animation is triggered instantly.
   */
  rotateTo(node: ElementOrId, degree: number): void;

  /**
   * Rotate with no animation.
   */
  rotateInstantTo(node: ElementOrId, degree: number): void;

  rotateInstantDelta(node: ElementOrId, degree: number): void;
  getAbsRotationAngle(node: ElementOrId): number;

  updateCounters(counters: {
    [counterName: string]: { counter_name: string; counter_value: number | string };
  }): void;
  setCounter(counter_id: ElementOrId, value: number): void;
  incCounter(counter_id: ElementOrId, value: number): void;
  decrCounter(counter_id: ElementOrId, value?: number): void;

  connect(node: ElementOrId | Window | Document, event: string, method: string | Function): void;
  disconnect(node: ElementOrId | Window | Document, event: string): void;
  connectClass(className: string, event: string, method: string | Function): void;
  connectQuery(selector: string, event: string, method: string | Function): void;
  disconnectAll(): void;
  addStyleToClass(cssClass: string, styleProperty: string, value: string): void;
  addEventToClass(cssClass: string, event: string, method: string): void;

  /**
   * Add a simple text tooltip to the DOM node.
   * Specify 'helpStringTranslated' to display some information about "what is this game element?".
   * Specify 'actionStringTranslated' to display some information about "what happens when I click on this element?".
   * Set one of them to '' if unused.
   *
   * @param {ElementOrId} nodeId the object or object id to attach the tooltip to.
   * @param {string} helpStringTranslated the help message
   * @param {string} actionStringTranslated the action message
   * @param {number} delay optional delay, in ms (default 400)
   */
  addTooltip(
    nodeId: ElementOrId,
    helpStringTranslated: string,
    actionStringTranslated: string,
    delay?: number,
  ): void;

  /**
   * Add an HTML tooltip to the DOM node.
   *
   * @param {ElementOrId} nodeId the object or object id to attach the tooltip to.
   * @param {string} html the html code of the message
   * @param {number} delay optional delay, in ms (default 400)
   */
  addTooltipHtml(nodeId: ElementOrId, html: string, delay?: number): void;

  /**
   * Same as addTooltip but for all elements of a given class.
   */
  addTooltipToClass(
    cssclass: string,
    helpStringTranslated: string,
    actionStringTranslated: string,
    delay?: number,
  ): void;

  /**
   * Same as addTooltipHtml but for all elements of a given class.
   */
  addTooltipHtmlToClass(cssclass: string, html: string, delay?: number): void;

  /**
   * Remove a tooltip from the DOM node with given id.
   *
   * @param {ElementOrId} nodeId the object or object id to remove the tooltip from.
   */
  removeTooltip(nodeId: ElementOrId): void;

  switchDisplayTooltips(): void;

  /**
   * When an important action with a lot of consequences is triggered by the player, you may want to propose a confirmation dialog.
   *
   * @param {string} text message will be shown to user, use _() to translate
   * @param {Function} callback callback if confirmed
   * @param {Function} callback_cancel callback if cancelled
   */
  confirmationDialog(text: string, callback: Function, callback_cancel?: Function): void;

  warningDialog(text: string, callback?: Function): void;
  infoDialog(text: string, title: string, callback?: Function, useBgaConfirm?: boolean): void;

  /**
   * You can use this dialog to give user a choice with small amount of options.
   *
   * @param {string} text message will be shown to user, use _() to translate
   * @param {Object} choices associative array "value => text to display"
   * @param {Function} callback callback returning the choice
   */
  multipleChoiceDialog(
    text: string,
    choices: { [value: string]: string } | string[],
    callback: (choice: string) => void,
  ): void;

  askForValueDialog(title: string, callback: (value: string) => void, description?: string): void;

  displayTableWindow(
    id: string,
    title: string,
    table: any[][],
    header?: string | { str: string; args: any },
    footer?: string,
    closing?: string,
  ): PopinDialog;

  /**
   * Display a score over an element.
   *
   * @param {ElementOrId} anchor_id the element to show the score on
   * @param {string} color the score color
   * @param {number} score the score number
   * @param {number} duration duration
   * @param {number} offset_x delta x
   * @param {number} offset_y delta y
   */
  displayScoring(
    anchor_id: ElementOrId,
    color: string,
    score: number | string,
    duration?: number,
    offset_x?: number,
    offset_y?: number,
  ): void;

  /**
   * Display a text bubble over an element.
   *
   * @param {ElementOrId} anchor_id the element to show the bubble on
   * @param {string} text the bubble text
   * @param {number} delay delay
   * @param {number} duration duration
   * @param {string} custom_class CSS class
   */
  showBubble(
    anchor_id: ElementOrId,
    text: string,
    delay?: number,
    duration?: number,
    custom_class?: string,
  ): void;

  /**
   * Mark the player panel as disabled (by darkening the background).
   *
   * @param {number} player_id the player to disable
   */
  disablePlayerPanel(player_id: number | string): void;

  /**
   * Mark the player panel as enabled.
   *
   * @param {number} player_id the player to enable
   */
  enablePlayerPanel(player_id: number | string): void;

  /**
   * Mark all player panels as enabled.
   */
  enableAllPlayerPanels(): void;

  /**
   * Add a player panel for an automata.
   *
   * @param {number} id the automata id, used to setup scoreCtrl and getPlayerPanelElement. 0 or negative value is recommended, to avoid conflict with real player ids.
   * @param {string} name the name of the automata
   * @param {Object} params an object with optional params: color (default black), iconClass (default unset) to set a background image (32px x 32px), score (default undefined)
   */
  addAutomataPlayerPanel(
    id: number,
    name: string,
    params?: {
      color?: string;
      iconClass?: string;
      score?: number;
    },
  ): void;
}

declare interface Notif<T = any> {
  type: string; // type of the notification (as passed by php function)
  log: string; // the log string passed from php notification
  args: T; // This is the arguments that you passed on your notification method on php
  move_id?: number | string;
  time?: number;
  uid: string;
  table_id?: number | string;
  bIsTableMsg?: boolean;
  channelorig?: string;
  gamenameorig?: string;
  lock_uuid?: string;
  synchro?: number;
  h?: string;
  loadprevious?: boolean;
  donotpreview?: boolean;
}

declare class Counter {
  span: HTMLElement | null;
  current_value: number;
  target_value: number;
  speed: number;

  constructor();

  /**
   * Associate the counter with an existing HTML element.
   *
   * @param {HTMLElement | string} target the HTML Element that will display the counter
   * @param {Object | undefined} settings to set the initial value, define settings.value (null to disable). Set settings.tableCounter to link it to a TableCounter, or settings.playerCounter and settings.playerId to link it to a PlayerCounter.
   */
  create(
    target: ElementOrId,
    settings?: {
      value?: number | null;
      tableCounter?: string;
      playerCounter?: string;
      playerId?: number;
    },
  ): void;

  /**
   * Return the current value.
   *
   * @returns the current value
   */
  getValue(): number;

  /**
   * Increment the value and animate from the previous value.
   *
   * @param {number} by the increment to add to current value
   * @returns the new value
   */
  incValue(by: number): number;

  /**
   * Set the value (no animation).
   *
   * @param {number} value the new value
   */
  setValue(value: number): void;

  /**
   * Set the value, with animation.
   *
   * @param {number} value the new value
   */
  toValue(value: number): void;

  /**
   * Sets the value to "-".
   *
   * Note it just changes display value once, it does not actually disable it, i.e. if you set it again, it will be shown again.
   */
  disable(): void;

  makeCounterProgress(): void;
  finishCounterMove(): void;
}

declare class PopinDialog {
  id: string | null;
  target_id: string | null;
  container_id: string;
  popinElement: HTMLElement | null;
  underlayElement: HTMLElement | null;
  helpLinkElement: HTMLAnchorElement | null;
  closeButtonElement: HTMLAnchorElement | null;
  bCloseIsHiding: boolean;
  onShow: (() => void) | null;
  onHide: (() => void) | null;
  onDestroy: (() => void) | null;

  /**
   * Create the popin on the DOM.
   *
   * @param {string} id popin id
   * @param {string} target_id optional parent container id
   * @param {boolean} closeOnUnderlayClick whether clicking the underlay closes the dialog
   */
  create(id: string, target_id?: string, closeOnUnderlayClick?: boolean): void;

  /**
   * Remove the popin.
   */
  destroy(bAnimate?: boolean): void;

  /**
   * Replace the close callback (top right corner 'close' icon) by a custom one.
   *
   * @param {Function} callback the new callback
   */
  replaceCloseCallback(callback: Function): void;

  /**
   * Hide the close button.
   */
  hideCloseIcon(): void;

  /**
   * Set the popin title.
   *
   * @param {string} title the title
   */
  setTitle(title: string): void;

  setZIndex(zIndex: number | string): void;

  /**
   * Set the popin max width.
   *
   * @param {number} maxwidth the max width, in px
   */
  setMaxWidth(maxwidth: number): void;

  setHelpLink(href: string): void;

  /**
   * Set the content of the popin.
   *
   * @param {string} html the popin content
   */
  setContent(html: string): void;

  adjustSizeAndPosition(): void;

  /**
   * Show the popin.
   */
  show(bAnimate?: boolean): void;

  /**
   * Hide the popin.
   */
  hide(bAnimate?: boolean): void;
}

declare interface StockItems {
  id: any;
  type: number;
  loc?: string;
}

declare interface StockItemType {
  weight: number;
  image: string;
  image_position: number;
}

declare class Stock {
  page: GameGui | null;
  container_div: HTMLElement;
  item_height: number;
  item_width: number;
  backgroundSize: string | null;
  item_type: { [cardUniqueId: number]: StockItemType };
  items: StockItems[];
  item_selected: { [itemId: string]: number };
  next_item_id: number;
  control_name: string; // the container_div id
  selectable: number;
  selectionApparance: string;
  apparenceBorderWidth: string;
  selectionClass: string;
  extraClasses: string;
  centerItems: boolean;
  item_margin: number;
  autowidth: boolean;
  order_items: boolean;
  horizontal_overlap: number;
  vertical_overlap: number;
  use_vertical_overlap_as_offset: boolean;
  jstpl_stock_item: string;
  image_items_per_row: number | null;
  image_in_vertical_row: boolean;
  hResize: any;
  duration: number;
  onItemCreate: ((itemDiv: HTMLElement, itemType: any, itemDivId: string) => any) | null;
  onItemDelete: ((itemDivId: string, itemType: any, itemId: string | number) => any) | null;

  create(game: GameGui, container_div: HTMLElement, cardwidth: number, cardheight: number): void;
  destroy(): void;
  count(): number;
  addItemType(
    cardUniqueId: number,
    cardWeight: number,
    cardsurl: string,
    imagePosition?: number,
  ): void;
  addToStock(cardUniqueId: number, from?: ElementOrId): void;
  addToStockWithId(
    cardUniqueId: number,
    cardId: string | number,
    from?: ElementOrId,
    location?: string,
  ): void;
  removeFromStock(type: number, to?: ElementOrId, noupdate?: boolean): boolean;
  removeFromStockById(id: string | number, to?: ElementOrId, noupdate?: boolean): boolean;
  removeAll(): void;
  removeAllTo(to: ElementOrId): void;
  getPresentTypeList(): { [type: number]: 1 };
  getItemDivId(id: string | number): string;
  updateDisplay(from?: ElementOrId): void;
  resetItemsPosition(): void;
  changeItemsWeight(weights: { [type: number]: number }): void;
  sortItems(): void;
  setSelectionMode(selectionMode: number): void;
  setSelectionAppearance(appearance: string): void;
  isSelected(id: string | number): boolean;
  selectItem(id: string | number): void;
  unselectItem(id: string | number): void;
  selectAll(): void;
  unselectAll(): void;
  onClickOnItem(evt: Event): void;
  onChangeSelection(control_name: string, item_id?: string): any;
  getSelectedItems(): StockItems[];
  getUnselectedItems(): StockItems[];
  getItemNumber(): number;
  getAllItems(): StockItems[];
  getItemsByType(type: number): StockItems[];
  getFirstItemOfType(type: number): StockItems | null;
  getItemsByWeight(weight: number): StockItems[];
  getFirstItemWithWeight(weight: number): StockItems | null;
  getItemById(id: string | number): StockItems | null;
  getItemTypeById(id: string | number): number | null;
  getItemWeightById(id: string | number): number | null;
  selectItemsByType(type: number): void;
  unselectItemsByType(type: number): void;
  setOverlap(horizontal_percent: number, vertical_percent?: number): void;
  resizeItems(width: number, height: number, image_width?: number, image_height?: number): void;
}

declare class DojoAnimation {
  node: HTMLElement;
  duration: number;
  delay?: number;
  repeat: number;
  rate: number;
  curve: any;
  easing?: (n: number) => number;
  beforeBegin?: (node: HTMLElement) => void;
  onBegin?: (values: any) => void;
  onPlay?: (values: any) => void;
  onAnimate?: (values: any) => void;
  onPause?: (values: any) => void;
  onStop?: (values: any) => void;
  onEnd?: (node: HTMLElement) => void;

  play(delay?: number | null, gotoStart?: boolean): DojoAnimation;
  pause(): DojoAnimation;
  gotoPercent(percent: number, andPlay?: boolean): DojoAnimation;
  stop(gotoEnd?: boolean): DojoAnimation;
  destroy(): void;
  status(): "playing" | "paused" | "stopped";
}

interface Dojo {
  byId: (nodeId: ElementOrId, doc?: Document) => HTMLElement;
  isDescendant: (node: ElementOrId, ancestor: ElementOrId) => boolean;
  setSelectable: (node: ElementOrId, selectable: boolean) => void;
  attr: Function;
  getAttr: (node: ElementOrId, name: string) => any;
  setAttr: (node: ElementOrId, name: string | { [key: string]: any }, value?: any) => HTMLElement;
  hasAttr: (node: ElementOrId, name: string) => boolean;
  removeAttr: (node: ElementOrId, name: string) => void;
  prop: Function;
  getProp: (node: ElementOrId, name: string) => any;
  setProp: (node: ElementOrId, name: string | { [key: string]: any }, value?: any) => HTMLElement;
  style: Function;
  getStyle: (node: ElementOrId, name?: string) => any;
  setStyle: (node: ElementOrId, style: string | { [key: string]: any }, value?: any) => any;
  getComputedStyle: (node: Element) => CSSStyleDeclaration;
  hasClass: (nodeId: ElementOrId, className: string) => boolean;
  addClass: (nodeId: ElementOrId, className: string | string[]) => void;
  removeClass: (nodeId: ElementOrId, className?: string | string[]) => void;
  toggleClass: (nodeId: ElementOrId, className: string | string[], forceValue?: boolean) => void;
  replaceClass: (
    node: ElementOrId,
    addClassStr: string | string[],
    removeClassStr?: string | string[],
  ) => void;
  toDom: (frag: string, doc?: Document) => Node;
  place: (node: ElementOrId, refNode: ElementOrId, position?: string | number) => HTMLElement;
  create: Function;
  empty: (nodeId: ElementOrId) => void;
  destroy: (nodeId: ElementOrId) => void;
  position: Function;
  marginBox: Function;
  contentBox: Function;
  window: any;
  body: (doc?: Document) => HTMLElement;
  hitch: Function;
  clone: Function;
  mixin: (dest: any, ...sources: any[]) => any;
  extend: (ctor: Function, ...props: any[]) => Function;
  declare: Function;
  trim: Function;
  connect: (
    obj: any,
    eventType: string,
    contextOrCallback: any,
    method?: string | Function,
    dontFix?: boolean,
  ) => any;
  disconnect: Function;
  subscribe: Function;
  unsubscribe: (handle: any) => void;
  publish: (topic: string, args?: any[]) => any;
  stopEvent: (evt: Event) => void;
  fixEvent: (evt: Event, sender?: Element) => Event;
  query: Function;
  forEach: Function;
  map: Function;
  filter: Function;
  indexOf: (arr: any[], value: any, fromIndex?: number, findLast?: boolean) => number;
  some: Function;
  every: Function;
  fadeIn: Function;
  fadeOut: Function;
  animateProperty: Function;
  anim: Function;
  fx: any;
  string: any;
  date: any;
  keys: { [key: string]: number };
  xhrGet: (args: any) => any;
  xhrPost: (args: any) => any;
  toJson: (obj: any, prettyPrint?: boolean) => string;
  fromJson: (js: string) => any;
}
