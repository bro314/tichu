/*
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Tichu implementation : © Ben Rohlfs et al.
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */
/// <amd-module name="bgagame/tichu"/>

import Gamegui = require("ebg/core/gamegui");
import Stock = require("ebg/stock");
import { dojohtml, dojostyle } from "./util";
import "ebg/counter";
import "ebg/stock";

interface StockItem {
  id: number;
  type: number;
}

interface StockItemType {
  /** The sort priority when arranging items to be displayed within a stock. Lower values are displayed first. If two items have the same weight, the are sorted by the order by which they were added to the stock. */
  weight: number;
  /** The sprite sheet URL for this `StockItemType`. This image should contain a grid of images matching the `itemWidth` and `itemHeight` used for the `Stock.create(..)` method. If this sprite sheet is not a single row of images, the `Stock.image_items_per_row` property is used to specify the number of sprites per row in this image. */
  image: string;
  /** The sprite sheet position for this `StockItemType`. This is a zero indexed number defined by the following formula: `row * Stock.image_items_per_row + col`. This number should never exceed the number of sprites in the sprite sheet. */
  image_position: number;
}

// itemType -> weight
type Weights = Record<number, number>;

enum Bet {
  // Player can still make a bet.
  NO_BET_YET = "-1",
  // Player cannot bet anymore.
  NO_BET = "0",
  TICHU = "100",
  GRAND_TICHU = "200",
}

enum Pass {
  NO_BET = "0",
}

interface State {
  // number (player id) as string
  active_player: string;
  args: any;
  description: string;
  descriptionmyturn: string;
  // number as string
  id: string;
  // numbers (player ids) as strings
  multiactive: string[];
  name: string;
  possibleactions: string[];
  reflexion: { total: { [playerId: number]: number } };
  transitions: any;
  type: string;
  updateGameProgression: number;
}

interface Card {
  // random number 1-56, different in each game
  id: string;
  // 1-4
  // 1: black (or dragon)
  // 2: red (or phoenix)
  // 3: blue (or dog)
  // 4: green (or mahjong)
  type: string;
  // 1-14
  // 1 are special cards, 14 is ace, 11-13 are J,Q,K
  type_arg: string;
  location: string;
  location_arg: string;
  passed_from: string;
}

interface Combo {
  cards: Card[];
  description: string;
  phoenixValue: number | null;
  type: number;
}

declare global {
  // prettier-ignore
  interface NotifTypes {
    "dealCards": { cards: Card[] };
    "grandTichuBet": { bet: number; player_id: number };
    "tichuBet": { bet: number; player_id: number };
    "confirmTichu": { grand: boolean; msg: string };
    "playCombo": { cards: Card[]; player_id: number; combo_name: string; points: number };
    "wishMade": { wish: number };
    "mahjongWishGranted": {};
    "playerGoOut": { firstout_id: number; player_id: number };
    "pass": { player_id: number };
    "captureCards": { player_id: number; trick_value: number };
    "newScores": { newScores: { [key: number]: number } };
    "autopass": { autopass: string };
    "acceptCards": { cards: Card[] };
    "passCards": { cardIds: string[] };
    "devConsole": { msg: string };
  }

  interface PlayerActions {
    grandTichuBet: {};
    giveCards: {};
    pass: {};
    tichuBet: {};
    makeAWish: {};
    phoenixPlay: {};
    chooseDragonGift: {};
    collect: {};
  }

  interface Player {
    // number as string
    call_tichu: Bet;
    // number as string
    call_grand_tichu: Bet;
    // number as string
    pass: string;
  }

  interface Gamedatas {
    allLastCombos: Record<number, Combo>;
    capturedpoints: Record<number, number>;
    // deck location "captured"
    capturedCards: Card[];
    cardslastcombo: Card[];
    // deck location "combo"
    currentTrick: Card[];
    currentTrickValue: number;
    firstoutplayer: number;
    // deck location "hand" (current user only)
    hand: Card[];
    handcount: Record<number, number>;
    lastComboDescription: string;
    lastComboPlayer: string;
    mahjongOwner: number;
    mahjongWish: number;
    // Should the played card be shown and players smartly skipped? 0=FALSE, 1=TRUE
    isAllInfoExposed: number;
    passes: number[];
    round: number;
    trick: number;
  }
}

type TichuStock = Stock & {
  image_items_per_row: number;
  item_width: number;
  items: StockItem[];
};

const isDebug = window.location.host === "studio.boardgamearena.com";
const debug = isDebug ? console.log.bind(window.console) : function () {};

function cardToStockType(card: Card): number {
  return stockType(Number(card.type), Number(card.type_arg));
}

function stockType(color: number, value: number): number {
  return (Number(color) - 1) * 14 + (Number(value) - 1);
}

function addCardToStock(stock: TichuStock | undefined, card: Card) {
  stock?.addToStockWithId(cardToStockType(card), Number(card.id));
}

function addItemToStock(stock: TichuStock, item: StockItem) {
  stock.addToStockWithId(item.type, Number(item.id));
}

class Tichu extends Gamegui {
  private readonly cardwidth = 100;
  private readonly cardheight = 150;
  private readonly cardChoiceWidth = 70;
  private readonly cardChoiceHeight = 105;
  private cardsToPass: (StockItem | undefined)[] = [];
  private tableCombos: Record<number, TichuStock> = {};
  private mahjongValues!: TichuStock;
  private phoenixValues!: TichuStock;
  private allLastCombos: Record<number, Combo | undefined> = {};
  private clockwise: boolean = false;
  private playerHand!: TichuStock;
  private active_player?: string;
  private stateName!: string;
  private allowedValues: number[] = [];
  private autoCollectTimeout?: number;
  private autoAcceptTimeout?: number;

  private statusEl!: HTMLElement;

  rescale() {
    const areaElement = document.getElementById("game_play_area")!;
    const areaWrapElement = document.getElementById("game_play_area_wrap")!;
    const widthAvailable = areaWrapElement.clientWidth;
    const heightAvailable = document.documentElement.clientHeight - 120;

    const widthMax = 1200;
    const widthMin = 900;
    const heightMin = 800;

    const widthFactor = Math.max(widthAvailable / widthMin, 0.4);
    const heightFactor = Math.max(heightAvailable / heightMin, 0.7);
    const factor = Math.min(widthFactor, heightFactor, 1.0);

    areaWrapElement.style.transform = `scale(${factor})`;
    areaWrapElement.style.transformOrigin = factor === 1.0 ? "top center" : "top left";
    areaElement.style.width = `${Math.max(
      Math.min(widthAvailable / factor, widthMax),
      widthMin
    )}px`;
  }

  setup(gamedatas: Gamedatas) {
    debug("SETUP", gamedatas);

    // Replaces BGA css zoom feature, which is not supported on Firefox.
    // The css zoom is disabled in tichu.css.
    new ResizeObserver(() => requestAnimationFrame(() => this.rescale())).observe(
      document.getElementById("game_play_area_wrap")!
    );
    window.addEventListener("resize", () => requestAnimationFrame(() => this.rescale()));
    $("game_play_area")?.classList.toggle("isAllInfoExposed", this.isAllInfoExposed());

    const player_ids = new Array();
    for (const player_id in gamedatas.players) {
      player_ids.push(parseInt(player_id));
      if (gamedatas.handcount[player_id] === undefined) gamedatas.handcount[player_id] = 0;
    }

    this.setupGameBoards(gamedatas);

    const playArea = document.getElementById("game_play_area_wrap") as HTMLElement;
    this.statusEl = playArea.querySelector("tichu-status") as HTMLElement;
    this.statusEl.addEventListener("show-current-trick", () => this.showCurrentTrick());
    this.updateStatus();

    this.addTooltipToClass("hand", _("Cards in hand"), "");
    this.addTooltipToClass("star", _("Points captured"), "");
    this.addTooltipToClass("grandtichublack", _("Grand Tichu bet yet to be made"), "");
    this.addTooltipToClass("tichublack", _("Tichu bet yet to be made"), "");
    this.addTooltipToClass("grandtichucolor", _("Grand Tichu bet"), "");
    this.addTooltipToClass("tichucolor", _("Tichu bet"), "");
    this.addTooltipToClass("firstoutcolor", _("First player out"), "");
    this.addTooltipToClass("cardback", _("has passed"), "");

    document
      .getElementById("overall-content")
      ?.classList.toggle("tiki", this.prefs[103]?.value == 1);
    this.updateMahjongWish(gamedatas.mahjongWish);

    if (gamedatas.firstoutplayer != 0) {
      const firstout = $("firstoutcolor_" + gamedatas.firstoutplayer);
      if (firstout) dojo.style(firstout, "display", "inline-block");
    }

    this.setupPlayerHand();

    this.mahjongValues = this.setupValueChoice("mahjong", 14);
    this.phoenixValues = this.setupValueChoice("phoenixChoice", 13);

    this.allLastCombos = gamedatas["allLastCombos"];
    this.displayLastCombos(player_ids, gamedatas["passes"]);

    Array.from($("playertables")?.children ?? []).forEach((el, i) => {
      dojo.connect(el.children[0], "onclick", this, () => this.onGiveCard(i));
    });

    this.setupNotifications();

    if (this.prefs[100]?.value == 2) {
      this.onReorderTable(true);
    }

    this.changeOrder(this.prefs[101]?.value != 1);
    this.setTheme((this.prefs[104]?.value as number) ?? 0);

    this.updateCardsPlayed();

    debug("Ending game setup");
  }

  private isAllInfoExposed() {
    return this.gamedatas.isAllInfoExposed == 1;
  }

  private updateStatus() {
    this.statusEl.setAttribute("roundCount", `${this.gamedatas.round}`);
    this.statusEl.setAttribute("trickCount", `${this.gamedatas.trick}`);
    this.statusEl.setAttribute("trickPoints", `${this.gamedatas.currentTrickValue}`);
    this.statusEl.setAttribute("trickSize", `${this.gamedatas.currentTrick.length}`);
  }

  private setupGameBoards(gamedatas: Gamedatas) {
    for (const player of Object.values(gamedatas.players)) {
      const player_id = player.id;
      const player_board_div = $("player_board_" + player_id);
      const isCurrent = player_id === this.player_id;
      dojo.place(this.format_block("jstpl_player_board", player), player_board_div!);

      if (player.call_grand_tichu === Bet.GRAND_TICHU) {
        dojostyle(".grandtichucolor." + player_id, "display", "inline-block");
        dojostyle(".tichublack." + player_id, "display", "none");
      }
      if (player.call_grand_tichu === Bet.NO_BET_YET) {
        dojostyle(".grandtichublack." + player_id, "display", "inline-block");
      }

      if (player.call_tichu === Bet.TICHU) {
        dojostyle(".tichucolor." + player_id, "display", "inline-block");
      }
      if (player.call_tichu === Bet.NO_BET_YET) {
        dojostyle(".tichublack." + player_id, "display", "inline-block");
      }

      (dojo.query(".handcount." + player_id) as any).innerHTML(gamedatas.handcount[player_id]);
      if (gamedatas.handcount[player_id] === 0) {
        this.disablePlayerPanel(player_id);
        $("playertable_" + player_id)?.classList.add("disabled");
      }
      if (player_id === Number(gamedatas.lastComboPlayer)) {
        $("playertable_" + player_id)?.classList.add("lastComboPlayer");
      }

      (dojo.query(".pointcount." + player_id) as any).innerHTML(
        gamedatas.capturedpoints[player_id]
      );
    }

    dojo.query(".playertabletext").forEach((e: Node) => {
      const span = document.createElement("SPAN");
      span.innerText = _("Select a card and click here");
      e.appendChild(span);
    });
  }

  private setupPlayerHand() {
    this.playerHand = this.createStock($("myhand")!, this.cardwidth, this.cardheight);
    for (const card of this.gamedatas.hand) {
      addCardToStock(this.playerHand, card);
    }
    this.updateStockOverlap(this.playerHand);

    for (const themeNo of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      dojo.connect($(`theme${themeNo}`), "onclick", this, (e: Event) => this.setTheme(themeNo));
    }

    dojo.connect($("order_by_rank"), "onclick", this, (e: Event) => this.onReorderByRank(e));
    dojo.connect($("order_by_color"), "onclick", this, (e: Event) => this.onReorderByColor(e));
    dojo.connect($("list_table"), "onclick", this, () => this.onReorderTable(false));
    dojo.connect($("square_table"), "onclick", this, () => this.onReorderTable(true));
    dojo.connect($("clockwise"), "onclick", this, () => this.changeOrder(true));
    dojo.connect($("counterClockwise"), "onclick", this, () => this.changeOrder(false));

    this.addTooltipHtml("list_table", _("You can change this permanently in the user settings"));
    this.addTooltipHtml("square_table", _("You can change this permanently in the user settings"));
    this.addTooltipHtml(
      "clockwise",
      _(
        "This will affect the arrangement of the square table and the order of players when passing the cards.<br>You can change this permanently in the user settings"
      )
    );
    this.addTooltipHtml(
      "counterClockwise",
      _(
        "This will affect the arrangement of the square table and the order of players when passing the cards.<br>You can change this permanently in the user settings"
      )
    );
  }

  private setTheme(themeNo: number) {
    for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      document.body.classList.remove(`theme${n}`);
    }
    document.body.classList.add(`theme${themeNo}`);
  }

  private removeMyActionButtons() {
    document.getElementById("bomb_button")?.replaceChildren();
    document.getElementById("play_button")?.replaceChildren();
    document.getElementById("pass_button")?.replaceChildren();
    document.getElementById("pass_trick_button")?.replaceChildren();
    document.getElementById("tichu_button")?.replaceChildren();
    dojo.place(this.format_block("jstpl_my_hand", {}), $("play_button")!, "only");
  }

  private addMyActionButton(
    id: string,
    label: string,
    method: EventListener,
    color: string,
    dest: string
  ) {
    const args = {
      id,
      label,
      addclass: `bgabutton bgabutton_${color}`,
    };
    dojo.place(this.format_block("jstpl_my_action_button", args), dest, "only");
    dojo.connect($(id), "onclick", this, method);
  }

  private createStock(element: Element, cardWidth: number, cardHeight: number) {
    const stock = new ebg.stock() as TichuStock;
    stock.create(this, element, cardWidth, cardHeight);
    stock.setSelectionAppearance("class");
    stock.setOverlap(30, 0);
    new ResizeObserver(() => requestAnimationFrame(() => this.updateStockOverlap(stock))).observe(
      element
    );
    stock.image_items_per_row = 14;
    const cardImgFile = this.prefs[103]!.value == 1 ? "img/tiki-cards.png" : "img/tichu-cards.png";
    for (let color = 1; color <= 4; color++) {
      for (let value = 1; value <= 14; value++) {
        const type = stockType(color, value);
        const weight = 2 * (4 * (value - 1) + (color - 1));
        stock.addItemType(type, weight, g_gamethemeurl + cardImgFile, type);
        stock.onItemCreate = dojo.hitch(this, "setupNewCard");
      }
    }
    return stock;
  }

  /**
   * We would like the card overlap to depend on the width of the container element.
   * We have to make sure that this method gets called every time that the number of cards in a
   * stock changes or the size of the container element changes.
   *
   * We think it is useful to only allow overlap between 12% and 60%.
   */
  private updateStockOverlap(stock?: TichuStock) {
    if (!stock) return;

    const availableWidthForOverlapPerItem =
      (stock.container_div.clientWidth - (stock.item_width + stock.item_margin)) /
      (stock.items.length - 1);
    let overlap = Math.floor(
      ((availableWidthForOverlapPerItem - stock.item_margin - 1) / stock.item_width) * 100
    );
    if (overlap > 60) overlap = 60;
    if (overlap < 12) overlap = 12;
    stock.setOverlap(overlap, 0);
  }

  private setupValueChoice(idName: string, count: number): TichuStock {
    const valueChoice = new ebg.stock() as TichuStock;
    valueChoice.create(this, $(idName), this.cardChoiceWidth, this.cardChoiceHeight);
    valueChoice.setSelectionAppearance("class");
    valueChoice.setSelectionMode(1);
    valueChoice.image_items_per_row = 7;

    for (let value = 0; value < count; value++) {
      valueChoice.addItemType(value, value, g_gamethemeurl + "img/tichu-icons-table.png", value);
      valueChoice.addToStockWithId(value, value + 2);
    }
    return valueChoice;
  }

  private displayLastCombos(playerIds: number[], passes: number[]) {
    if (this.allLastCombos === undefined) return;
    playerIds.forEach((playerId) => {
      this.resetComboStock(playerId);
      const combo = this.allLastCombos[playerId];
      if (combo && combo.cards?.length > 0) {
        this.addCardsToStock(this.tableCombos[playerId]!, combo.cards);
        this.setDescription(playerId, combo.description);
      } else if (passes.indexOf(playerId) >= 0) {
        this.setPass(playerId);
      }
    });
  }

  private resetComboStock(playerId: number) {
    if (playerId in this.tableCombos) {
      this.tableCombos[playerId]!.removeAll();
    } else {
      this.tableCombos[playerId] = this.createStock(
        $("lastcombo_" + playerId)!,
        this.cardwidth * 0.75,
        this.cardheight * 0.75
      );
      this.tableCombos[playerId]!.extraClasses = "smallCards";
      this.tableCombos[playerId]!.setSelectionMode(0);
    }
  }

  private setDescription(playerId: number, desc: string) {
    const translatedDesc = _(desc);
    this.addTooltipHtml("playertable_" + playerId, translatedDesc);
  }

  private addCardsToStock(stock: TichuStock, cards: Card[], playerId: number | null = null) {
    const weights: Weights = {};
    let i = 0;
    for (const card of cards) {
      if (playerId === this.player_id) {
        this.playerHand!.removeFromStockById(Number(card.id));
      }
      addCardToStock(stock, card);
      weights[cardToStockType(card)] = i++;
    }
    stock.changeItemsWeight(weights);
    this.updateStockOverlap(this.playerHand!);
    this.updateStockOverlap(stock);
  }

  private animateIcon(clazz: string, player_id: number) {
    const block = this.format_block("jstpl_temp", {
      clazz: clazz,
      id: player_id,
    });
    const e = dojo.place(block, "game_play_area");

    this.fadeOutAndDestroy(e, 1000, 1000);
  }

  onEnteringState(stateName: string, stateObject: CurrentStateArgs) {
    debug("Entering state: " + stateName, stateObject);
    this.active_player = stateObject.active_player as any;
    this.stateName = stateName;

    if (stateName !== "confirmTrick") {
      clearTimeout(this.autoCollectTimeout);
    }
    if (stateName !== "showPassedCards") {
      clearTimeout(this.autoAcceptTimeout);
    }

    const methodName = "onEnteringState" + stateName.charAt(0).toUpperCase() + stateName.slice(1);
    const thisMethods = this as unknown as { [key: string]: Function };
    if (thisMethods[methodName] !== undefined) thisMethods[methodName]!(stateObject.args);
  }

  onEnteringStateNewRound(args: any) {
    dojohtml(".pointcount", "0");
    dojostyle(".cardback", "display", "none");
    this.resetLastCombos();
    this.gamedatas.capturedCards = [];
    this.gamedatas.hand = [];
    this.gamedatas.currentTrick = [];
    this.gamedatas.currentTrickValue = 0;
    this.gamedatas.firstoutplayer = 0;
    this.gamedatas.round++;
    for (const id in this.gamedatas.players) {
      this.gamedatas.players[id]!.call_tichu = Bet.NO_BET_YET;
      this.gamedatas.players[id]!.call_grand_tichu = Bet.NO_BET_YET;
    }
    (dojo.query(".last-played-container") as any).removeClass("disabled");

    this.updateStatus();
    this.updateMahjongWish(0);
  }

  onEnteringStateGrandTichuBets(args: any) {
    this.resetLastCombos();
  }

  /** This is the legacy state that requires a user action for accepting cards. */
  onEnteringStateShowPassedCards(args: any) {
    this.showPassedCards(args);
  }

  /** This is the new state that does not require a user action. */
  onEnteringStateAcceptPassedCards(args: any) {
    this.showPassedCards(args);
  }

  /** This is shared by the new state and the legacy state. */
  showPassedCards(args: any) {
    dojohtml(".handcount", "14");
    if (args._private === undefined) return;
    args._private.forEach((card: Card, i: number) => {
      const x = this.cardwidth * (Number(card.type_arg) - 1);
      const y = this.cardheight * (Number(card.type) - 1);
      dojo.place(
        this.format_block("jstpl_cardontable", {
          x,
          y,
          player_id: card.location_arg,
          card_id: card.id,
        }),
        "receiveplayertable_" + card.passed_from
      );
    });
  }

  onEnteringStateNewTrick(args: any) {
    this.resetLastCombos();
    this.gamedatas.capturedCards.push(...this.gamedatas.currentTrick);
    this.gamedatas.currentTrick = [];
    this.gamedatas.currentTrickValue = 0;
    this.gamedatas.trick++;
    this.updateStatus();
  }

  onEnteringStatePlayComboOpen(args: any) {
    dojo.query(".active").forEach((el: Node) => (el as HTMLElement).classList.remove("active"));
    document.getElementById("playertable_" + this.active_player)?.classList.add("active");
  }

  onEnteringStateMahjongPlay(args: any) {
    if (this.isCurrentPlayerActive()) {
      dojostyle("#mahjongpanel", "display", "block");
      this.mahjongValues.updateDisplay("");
    }
    this.playerHand!.unselectAll();
  }

  onEnteringStatePhoenixPlay(args: any) {
    if (this.isCurrentPlayerActive()) {
      dojostyle("#phoenixpanel", "display", "block");
      this.allowedValues = args._private.values;
      // variante 1
      this.phoenixValues!.removeAll();
      args._private.values.forEach((value: number) => {
        this.phoenixValues!.addToStock(value - 2);
      });
      this.phoenixValues!.updateDisplay("");
    }
    this.playerHand!.unselectAll();
  }

  onEnteringStatePlayCombo(args: any) {
    dojo.query(".active").forEach((el: Node) => (el as HTMLElement).classList.remove("active"));
    document.getElementById("playertable_" + this.active_player)?.classList.add("active");
  }

  onEnteringStatePlayBomb(args: any) {
    document.getElementById("playertable_" + args.active)?.classList.add("active");
  }

  onEnteringStateChooseDragonGift(args: any) {
    if (!this.isCurrentPlayerActive()) return;

    const left = this.clockwise ? 0 : 1;
    const right = this.clockwise ? 1 : 0;
    this.addActionButton("giveDragonBefore_button", _("Give cards to " + args.enemies[left]), () =>
      this.onGiveDragon(left)
    );
    this.addActionButton("giveDragonAfter_button", _("Give cards to " + args.enemies[right]), () =>
      this.onGiveDragon(right)
    );
  }

  onEnteringStateEndRound(args: any) {
    this.playerHand!.removeAll();
    this.enableAllPlayerPanels();
    this.cleanPlayersPanel();
  }

  onEnteringStateConfirmTrick(args: any) {
    dojo.query(".active").forEach((el: Node) => (el as HTMLElement).classList.remove("active"));
    document.getElementById("playertable_" + this.active_player)?.classList.add("active");
  }

  onLeavingState(stateName: string) {
    debug("Leaving state: " + stateName);
  }

  updateCardsPlayed() {
    if (!this.isAllInfoExposed()) return;

    for (let color = 1; color <= 4; color++) {
      for (let value = 1; value <= 14; value++) {
        const id = `playedCard_${color}_${value}`;
        document.getElementById(id)?.classList.remove("captured");
        document.getElementById(id)?.classList.remove("trick");
        document.getElementById(id)?.classList.remove("hand");
      }
    }

    const captured = this.gamedatas.capturedCards;
    for (const card of captured) {
      const id = `playedCard_${card.type}_${card.type_arg}`;
      document.getElementById(id)?.classList.add("captured");
    }
    const trick = this.gamedatas.currentTrick;
    for (const card of trick) {
      const id = `playedCard_${card.type}_${card.type_arg}`;
      document.getElementById(id)?.classList.add("trick");
    }
    const hand = this.gamedatas.hand;
    for (const card of hand) {
      const id = `playedCard_${card.type}_${card.type_arg}`;
      document.getElementById(id)?.classList.add("hand");
    }
  }

  onUpdateActionButtons(stateName: string, args: any) {
    debug("onUpdateActionButtons: " + stateName);
    document
      .getElementById("game_play_area")!
      .classList.toggle("isCurrentPlayerActive", this.isCurrentPlayerActive());
    const player = this.gamedatas.players[this.player_id]!;
    this.removeActionButtons();
    this.removeMyActionButtons();
    this.updateCardsPlayed();
    if (this.isCurrentPlayerActive()) {
      switch (stateName) {
        case "giveCards":
          this.addActionButton(
            "resetPassCards_button",
            _("Reset choices"),
            "onResetPassCards",
            undefined,
            false,
            "gray"
          );
          this.addActionButton("passCards_button", _("Pass selected cards"), "onPassCards");
          break;
        // This is a legacy state. The new state "acceptAllCards" does not require a user action.
        case "showPassedCards":
          clearTimeout(this.autoAcceptTimeout);
          if (document.visibilityState === "visible") {
            dojo.place(this.format_block("jstpl_auto_accept", {}), $("play_button")!, "only");
            clearTimeout(this.autoAcceptTimeout);
            this.autoAcceptTimeout = setTimeout(() => this.onAcceptCards(), 2000);
          }
          this.addActionButton("acceptCards_button", _("Accept cards"), "onAcceptCards");
          break;
        case "mahjongPlay":
          this.addActionButton("chooseWish", _("Make a wish"), "onMakeAWish");
          break;
        case "phoenixPlay":
          this.addActionButton(
            "choosePhoenix",
            _("Choose a value for the Phoenix"),
            "onChoosePhoenix"
          );
          this.addActionButton("cancelPhoenix", _("Cancel"), "cancelPhoenix");
          break;
        case "playComboOpen":
          this.addMyActionButton(
            "myPlayCombo",
            _("Play selected cards"),
            () => this.playCombo("playCombo"),
            "blue",
            "play_button"
          );
          break;
        case "playCombo":
          this.addMyActionButton(
            "myPlayCombo",
            _("Play selected cards"),
            () => this.playCombo("playCombo"),
            "blue",
            "play_button"
          );
          this.addMyActionButton(
            "myPass",
            _("Pass"),
            () => this.onPass(true),
            "red",
            "pass_button"
          );
          this.addMyActionButton(
            "myPassTrick",
            _("Auto-Pass this Trick"),
            () => this.onPass(false),
            "gray",
            "pass_trick_button"
          );
          this.addTooltip("myPassTrick", _("Automatically pass until the end of this trick."), "");
          break;
        case "playBomb":
          this.addMyActionButton(
            "myPlayCombo",
            _("Play selected cards"),
            () => this.playCombo("playCombo"),
            "blue",
            "play_button"
          );
          this.addMyActionButton(
            "myCancel",
            _("Cancel"),
            () => this.takeAction("cancel"),
            "red",
            "pass_button"
          );
          break;
        case "confirmTrick":
          if (this.bRealtime) {
            dojo.place(this.format_block("jstpl_auto_collect", {}), $("play_button")!, "only");
            clearTimeout(this.autoCollectTimeout);
            this.autoCollectTimeout = setTimeout(() => this.collect(), 2000);
          } else {
            this.addMyActionButton(
              "myConfirmTrick",
              _("Collect"),
              () => this.collect(),
              "blue",
              "play_button"
            );
          }
          this.addMyActionButton(
            "myPlayBomb",
            _("Play a Bomb"),
            () => this.playCombo("playBomb"),
            "gray",
            "bomb_button"
          );
      }
    } else if (
      !this.isSpectator &&
      (stateName === "playCombo" || stateName === "confirmTrick") &&
      this.playerHand!.getAllItems().length > 0
    ) {
      if (Number(player.pass) < 2) {
        this.addMyActionButton(
          "myPassTrick",
          _("Auto-Pass this Trick"),
          () => this.onPass(false),
          "gray",
          "pass_trick_button"
        );
        this.addTooltip("myPassTrick", _("Automatically pass until the end of this trick."), "");
      }
      if (Number(player.pass) === 0) {
        this.addMyActionButton(
          "myPassOnce",
          _("Auto-Pass once"),
          () => this.onPass(true),
          "red",
          "pass_button"
        );
        this.addTooltip(
          "myPassOnce",
          _("Automatically pass next time(unless a new trick starts)"),
          ""
        );
      }
      if (Number(player.pass) > 0) {
        this.addMyActionButton(
          "myCancelAutopass",
          _("Cancel Auto-Pass"),
          () => this.cancelAutopass(),
          "red",
          "pass_button"
        );
        this.addTooltip(
          "myCancelAutopass",
          _("You have chosen to automatically pass during this trick. Click to cancel"),
          ""
        );
      }
      this.addMyActionButton(
        "myPlayBomb",
        _("Play a Bomb"),
        () => this.playCombo("playBomb"),
        "gray",
        "bomb_button"
      );
    }

    if (!this.isSpectator) {
      if (player.call_grand_tichu === Bet.NO_BET_YET) {
        this.addActionButton(
          "noBet",
          _("No bet"),
          () => this.onGrandTichuBet(Bet.NO_BET),
          undefined,
          false,
          "gray"
        );
        this.addTooltip("noBet", _("Don't call Grand Tichu"), "");
        this.addActionButton(
          "makeGTBet",
          _("Grand Tichu"),
          () => this.onGrandTichuBet(Bet.GRAND_TICHU),
          undefined,
          false,
          "red"
        );
        this.addTooltip("makeGTBet", _("Bet 200 Points, tha you will finish first"), "");
      }
      if (player.call_tichu === Bet.NO_BET_YET && this.gamedatas.firstoutplayer == 0) {
        this.addMyActionButton(
          "myMakeTichuBet",
          _("Tichu"),
          () => this.onTichuBet(),
          "green",
          "tichu_button"
        );
        this.addTooltip("myMakeTichuBet", _("Bet 100 Points, tha you will finish first"), "");
      }
    }

    this.updateStatus();
  }

  private resetLastCombos() {
    for (const [key, comboStock] of Object.entries(this.tableCombos)) {
      comboStock.removeAll();
      $("lastcombo_" + key)!.innerHTML = "";
      this.addTooltip("playertable_" + key, "", "");
    }
    (dojo.query(".lastComboPlayer") as any).removeClass("lastComboPlayer");
  }

  private cleanPlayersPanel() {
    dojohtml(".handcount", "0");
    dojohtml(".pointcount", "0");
    dojostyle(".grandtichublack", "display", "inline-block");
    dojostyle(".tichublack", "display", "inline-block");
    dojostyle(".grandtichucolor", "display", "none");
    dojostyle(".tichucolor", "display", "none");
    dojostyle(".firstoutcolor", "display", "none");
    dojostyle(".cardback", "display", "none");
  }

  private getCardValueByTypeID(cardTypeID: number) {
    //get card value based on it's unique identifier
    return (cardTypeID % 14) + 1;
  }

  private getCardColorByTypeID(cardTypeID: number) {
    //get card color based on it's unique identifier
    return Math.floor(cardTypeID / 14) + 1;
  }

  private setPass(playerId: number) {
    const cardImgFile =
      this.prefs[103]!.value == 1 ? "img/tiki-icons-pass.png" : "img/tichu-icons-pass.png";
    const img = g_gamethemeurl + cardImgFile;
    $("lastcombo_" + playerId)!.innerHTML =
      "<span class = 'pass'> <img src='" +
      img +
      "' width='75px' height='112.5px' alt='pass'> </span>";
    ($("cardback_" + playerId) as HTMLElement).style.display = "inline-block";
    this.setDescription(playerId, "Pass");
  }

  private setupNewCard(card_div: HTMLElement, card_type_id: number, card_id: string) {
    if (
      this.getCardValueByTypeID(card_type_id) === 10 ||
      this.getCardValueByTypeID(card_type_id) === 13
    )
      this.addTooltip(card_div.id, _("Scores 10 points"), "");
    if (this.getCardValueByTypeID(card_type_id) === 5)
      this.addTooltip(card_div.id, _("Scores 5 points"), "");
    if (card_type_id === 0)
      this.addTooltip(
        card_div.id,
        _("Highest single card. Scores 25 points. Trick given to an opponent if Dragon wins it."),
        ""
      );
    if (card_type_id === 14)
      this.addTooltip(
        card_div.id,
        _(
          "Scores -25 points. Takes the place of any normal card in a combo but not a bomb. As a Single, worth 1.5 when led, beats any other card but the Dragon by 0.5."
        ),
        ""
      );
    if (card_type_id === 28)
      this.addTooltip(
        card_div.id,
        _(
          "The Hound must be played as a leading single card. Player's partner (or the next one if he's gone out) can lead."
        ),
        ""
      );
    if (card_type_id === 42)
      this.addTooltip(
        card_div.id,
        _(
          "The Mahjong's owner starts. Worth 1. When played, owner may wish for a rank to be fulfilled by the next regular player if possible."
        ),
        ""
      );
  }

  private cancelPhoenix() {
    dojo.style($("phoenixpanel")!, "display", "none");
    this.takeAction("cancelPhoenix", {});
  }

  private showCurrentTrick() {
    const myDlg = new ebg.popindialog();
    myDlg.create("myDialogCurrentTrick");
    myDlg.setTitle(_("Cards in current Trick"));
    myDlg.setContent('<div id="currentTrickCards"></div>');
    myDlg.show();
    let stock = this.createStock(
      $("currentTrickCards")!,
      this.cardwidth * 0.75,
      this.cardheight * 0.75
    );
    stock.extraClasses = "smallCards";
    stock.setSelectionMode(0);
    for (const card of this.gamedatas.currentTrick) {
      addCardToStock(stock, card);
    }
  }

  private onGrandTichuBet(bet: Bet) {
    debug("onGrandTichuBet");
    if (!this.checkAction("grandTichuBet")) return;

    this.takeAction("grandTichuBet", { bet: bet });
    this.removeActionButtons();
  }

  private onTichuBet() {
    debug("onTichuBet");
    // Note that we cannot check the action here, because it may not be the player's turn.
    // But you can call Tichu out of turn.

    this.takeAction("tichuBet", { bet: Bet.TICHU });
    this.removeActionButtons();
  }

  // client side action only
  private onGiveCard(i: number) {
    debug("onGiveCard", i);
    if (this.stateName !== "giveCards") return;
    if (!this.isCurrentPlayerActive()) return;

    const items = this.playerHand!.getSelectedItems();
    const player_id = this.player_id;
    const stockItem = this.cardsToPass[i];

    if (!stockItem) {
      if (items.length != 1) return;
      const card: StockItem = items[0]!;
      this.cardsToPass[i] = card;
      const value = this.getCardValueByTypeID(card.type);
      const color = this.getCardColorByTypeID(card.type);
      const x = this.cardwidth * (value - 1);
      const y = this.cardheight * (color - 1);
      const direction = i + 1;

      dojo.place(
        this.format_block("jstpl_cardontable", {
          x: x,
          y: y,
          player_id: player_id,
          card_id: card.id,
        }),
        "giveplayertable_" + direction
      );

      if ($("myhand_item_" + card.id)) {
        this.playerHand!.removeFromStockById(Number(card.id));
      } else {
        debug("Failed to remove card from hand");
      }
    } else {
      $("cardontable_" + player_id + "_" + stockItem.id)!.remove();
      addItemToStock(this.playerHand!, stockItem);
      this.cardsToPass[i] = undefined;
    }
    this.updateStockOverlap(this.playerHand);
  }

  // DANGER: The state action is named "giveCards", but the php action is "giveTheCards".
  private onPassCards() {
    debug("onPassCards");
    if (!this.checkAction("giveCards")) return;

    const items = this.cardsToPass;
    for (let i = 0; i < 3; i++) {
      if (!items[i]) {
        this.showMessage(_("You must select exactly 3 cards"), "error");
        return;
      }
    }

    let to_give = "";
    for (const i in items) {
      dojo.destroy("cardontable_" + this.player_id + "_" + items[i]!.id);
      to_give += items[i]!.id + ";";
    }

    this.cardsToPass = [];
    this.takeAction("giveTheCards", { cards: to_give });
  }

  private onAcceptCards() {
    debug("onAcceptCards");
    clearTimeout(this.autoAcceptTimeout);
    if (this.stateName !== "showPassedCards") return;
    this.takeAction("acceptCards");
  }

  private onMakeAWish(evt: Event) {
    debug("onMakeAWish");
    if (!this.checkAction("makeAWish")) return;

    const items = this.mahjongValues.getSelectedItems();
    if (items.length > 0) {
      evt.preventDefault();
      this.takeAction("makeAWish", { wish: items[0]!.id });
    }
  }

  private onChoosePhoenix(evt: Event) {
    debug("onChoosePhoenix");
    // It is a bit weird that the names "phoenixPlay" and "choosePhoenix" don't match.
    if (!this.checkAction("phoenixPlay")) return;

    const items = this.phoenixValues.getSelectedItems();
    if (items.length === 1) {
      if (this.allowedValues.indexOf(items[0]!.type + 2) < 0) return;
      dojostyle("#phoenixpanel", "display", "none");
      evt.preventDefault();
      this.takeAction("choosePhoenix", { phoenixValue: items[0]!.type + 2 });
    }
  }

  // client side action only
  private onReorderByRank(evt: Event) {
    debug("onReorderByRank");
    evt.preventDefault();

    const newWeights: Weights = {};
    for (let color = 1; color <= 4; color++) {
      for (let value = 1; value <= 14; value++) {
        const type = stockType(color, value);
        newWeights[type] = 2 * (4 * (value - 1) + color - 1);
      }
    }
    this.playerHand!.changeItemsWeight(newWeights);
    dojo.style("order_by_rank", "display", "none");
    dojo.style("order_by_color", "display", "inline");
  }

  // client side action only
  private onReorderTable(square: boolean) {
    debug("onReorderTable");

    if (square) {
      $("game_play_area")!.classList.add("squareTable");
      dojo.style("square_table", "display", "none");
      dojo.style("list_table", "display", "inline");
    } else {
      $("game_play_area")!.classList.remove("squareTable");
      dojo.style("square_table", "display", "inline");
      dojo.style("list_table", "display", "none");
    }
  }

  // client side action only
  private changeOrder(clockwise: boolean) {
    debug(`changeOrder ${clockwise} ${this.prefs[101]!.value}`);

    this.clockwise = clockwise;
    $("game_play_area")!.classList.toggle("clockwise", clockwise);
  }

  // client side action only
  private onReorderByColor(evt: Event) {
    debug("onReorderByColor");
    evt.preventDefault();

    const newWeights: Weights = {};
    for (let color = 1; color <= 4; color++) {
      for (let value = 1; value <= 14; value++) {
        const type = stockType(color, value);
        newWeights[type] = value === 1 ? 2 * type : (newWeights[type] = 100 + 2 * type);
      }
    }
    this.playerHand!.changeItemsWeight(newWeights);

    dojo.style("order_by_rank", "display", "inline");
    dojo.style("order_by_color", "display", "none");
  }

  // client side action only
  private onResetPassCards() {
    debug("onResetPassCards");

    const player_id = this.player_id;
    for (const item of this.cardsToPass) {
      if (!item) continue;
      $("cardontable_" + player_id + "_" + item.id)!.remove();
      addItemToStock(this.playerHand!, item);
    }
    this.cardsToPass = [];
  }

  private onGiveDragon(player: number) {
    debug("onGiveDragon");
    if (!this.checkAction("chooseDragonGift")) return;
    this.takeAction("chooseDragonGift", { player: player });
  }

  private playCombo(action: string) {
    debug("onPlayCombo");
    // Note that we cannot check the action here, because it may not be the player's turn.
    // But you can play a bomb out of turn.

    const selected = this.playerHand!.getSelectedItems().map((stockItem) => stockItem.id);
    this.takeAction(action, { cards: selected.join(";") });
  }

  // Note that is either normal pass or auto-pass depending on whose turn it is.
  private onPass(onlyOnce: boolean) {
    debug("onPass", { onlyOnce: onlyOnce });
    // Note that we cannot check the action here, because it may not be the player's turn.
    // But you can auto-pass out of turn.

    if (this.prefs[102]!.value == 1 && this.playerHand!.getSelectedItems().length > 0) {
      this.showMessage(
        _(
          "You have to unselect your cards first. (You can disable this safeguard in the user settings)"
        ),
        "error"
      );
      return;
    }
    this.takeAction("pass", { onlyOnce: onlyOnce });
  }

  private cancelAutopass() {
    debug("onCancelAutopass");
    // Note that we cannot check the action here, because it may not be the player's turn.
    // But you can cancel auto-pass out of turn.

    this.takeAction("cancelAutopass");
  }

  private collect() {
    debug("onCollect");
    clearTimeout(this.autoCollectTimeout);
    if (!this.checkAction("collect")) return;

    this.takeAction("collect");
  }

  private takeAction(action: string, args: any = {}) {
    args.lock = true;
    this.ajaxcall("/tichu/tichu/" + action + ".html", args, this, () => {});
  }

  setupNotifications() {
    debug("notifications subscriptions setup");

    // Make sure to read the documentation about "Synchronous Notifications" in the BGA Studio docs
    // before making any changes here.
    // Be aware that using `undefined` here means that you have to make abolutely sure that
    // `setSynchronousDuration` is called in your handler.
    // Also be aware that using 0 may completely break the flow and cause missed notifications.
    const notifs: Partial<{ [id in keyof NotifTypes]: any }> = {
      dealCards: 500,
      grandTichuBet: undefined,
      tichuBet: undefined,
      confirmTichu: 1,
      playCombo: 300,
      wishMade: 200,
      mahjongWishGranted: 1,
      playerGoOut: 1,
      pass: 300,
      captureCards: 500,
      newScores: 1000,
      autopass: 1,
      acceptCards: 3000,
      passCards: 200,
      devConsole: 1,
    };
    for (const [type, duration] of Object.entries(notifs)) {
      dojo.subscribe(type, this, "notif_" + type);
      this.notifqueue.setSynchronous(type as keyof NotifTypes, duration);
    }
  }

  private notif_devConsole(notif: Notif & { args: NotifTypes["devConsole"] }) {
    debug("notif_devConsole", notif);
    window.console.log(`DEV NOTIF: ${notif.args.msg}`);
  }

  private notif_dealCards(notif: Notif & { args: NotifTypes["dealCards"] }) {
    debug("notif_dealCards", notif);

    for (const card of notif.args.cards) {
      this.gamedatas.hand.push(card);
      addCardToStock(this.playerHand, card);
    }
    this.updateStockOverlap(this.playerHand);
    const totalCards = notif.args.cards.length === 8 ? 8 : 14;
    dojohtml(".handcount", `${totalCards}`);
  }

  private notif_grandTichuBet(notif: Notif & { args: NotifTypes["grandTichuBet"] }) {
    // MUST call setSynchronousDuration
    debug("notif_grandTichuBet", notif);

    const bet = String(notif.args.bet) as Bet;
    this.gamedatas.players[notif.args.player_id]!.call_grand_tichu = bet;
    dojostyle(".grandtichublack." + notif.args.player_id, "display", "none");
    if (bet === Bet.GRAND_TICHU) {
      this.gamedatas.players[notif.args.player_id]!.call_tichu = Bet.NO_BET;
      dojostyle(".grandtichucolor." + notif.args.player_id, "display", "inline-block");
      dojostyle(".tichublack." + notif.args.player_id, "display", "none");
      this.animateIcon("grandtichucolor", notif.args.player_id);
      playSound("tichu_laser");
      this.notifqueue.setSynchronousDuration(1000);
    } else {
      // If the notification was just a "this player has made no bet", then there is no good reason
      // to freeze the UI for 1 second. 1 ms should be fine.
      this.notifqueue.setSynchronousDuration(1);
    }

    this.onUpdateActionButtons(this.stateName, {});
  }

  private notif_tichuBet(notif: Notif & { args: NotifTypes["tichuBet"] }) {
    // MUST call setSynchronousDuration
    debug("notif_tichuBet", notif);

    const bet = String(notif.args.bet) as Bet;
    this.gamedatas.players[notif.args.player_id]!.call_tichu = bet;
    this.gamedatas.players[notif.args.player_id]!.call_grand_tichu = Bet.NO_BET;
    dojostyle(".tichublack." + notif.args.player_id, "display", "none");
    dojostyle(".grandtichublack." + notif.args.player_id, "display", "none");
    if (bet === Bet.TICHU) {
      dojostyle(".tichucolor." + notif.args.player_id, "display", "inline-block");
      this.animateIcon("tichucolor", notif.args.player_id);
      playSound("tichu_laser");
      this.notifqueue.setSynchronousDuration(1000);
    } else {
      // If the notification was just a "this player has made no bet" or "this player has already
      // played their first card, so cannot bet anymore", then there is no good reason
      // to freeze the UI for 1 second. 1 ms should be fine.
      this.notifqueue.setSynchronousDuration(1);
    }

    this.onUpdateActionButtons(this.stateName, {});
  }

  private notif_confirmTichu(notif: Notif & { args: NotifTypes["confirmTichu"] }) {
    debug("notif_confirmTichu", notif);

    const titleSave = this.gamedatas.gamestate.descriptionmyturn;
    const s = notif.args.grand ? "grand " : "";
    this.gamedatas.gamestate.descriptionmyturn = notif.args.msg;
    this.updatePageTitle();
    this.removeActionButtons();
    this.addActionButton("cancelTichu", _("no " + s + "tichu"), () => {
      if (notif.args.grand) {
        this.onGrandTichuBet(Bet.NO_BET);
        return;
      }
      this.gamedatas.gamestate.descriptionmyturn = titleSave;
      this.updatePageTitle();
      this.onUpdateActionButtons(this.stateName, {});
    });
    this.addActionButton("confirmTichu", _("confirm"), () =>
      this.takeAction("confirmTichu", { bet: notif.args.grand ? Bet.GRAND_TICHU : Bet.TICHU })
    );
  }

  private notif_playCombo(notif: Notif & { args: NotifTypes["playCombo"] }) {
    debug("notif_playCombo", notif);

    const playerId = Number(notif.args.player_id);
    this.resetComboStock(playerId);
    this.addCardsToStock(this.tableCombos[playerId]!, notif.args.cards, playerId);
    dojohtml("pass", "");
    ($("cardback_" + playerId) as HTMLElement).style.display = "none";
    this.setDescription(playerId, notif.args.combo_name);
    dojo.query(".handcount." + playerId).forEach((node: Node) => {
      const el = node as HTMLElement;
      el.innerHTML = String(parseInt(el.innerHTML) - notif.args.cards.length);
    });
    (dojo.query(".lastComboPlayer") as any).removeClass("lastComboPlayer");
    $("playertable_" + playerId)!.classList.add("lastComboPlayer");
    this.gamedatas.currentTrick.push(...notif.args.cards);
    this.gamedatas.currentTrickValue += notif.args.points;
    this.updateStatus();
  }

  private notif_wishMade(notif: Notif & { args: NotifTypes["wishMade"] }) {
    debug("notif_wishMade", notif);

    dojostyle("#mahjongpanel", "display", "none");
    this.updateMahjongWish(notif.args.wish);
  }

  private updateMahjongWish(wish: number) {
    const indicator = $("mahjongIndicator") as HTMLElement;
    if (wish > 0 && wish < 15) {
      const w = wish - 2;
      const x = w % 7;
      const y = (w - x) / 7;
      dojo.place(
        this.format_block("jstpl_mahjong", {
          value: wish,
          x: x * 75,
          y: y * 112.5,
        }),
        indicator
      );
      indicator.style.display = "block";
    } else {
      indicator.innerHTML = "";
      indicator.style.display = "none";
    }
  }

  private notif_mahjongWishGranted(notif: Notif) {
    debug("notif_mahjongWishGranted", notif);

    this.updateMahjongWish(0);
  }

  private notif_playerGoOut(notif: Notif & { args: NotifTypes["playerGoOut"] }) {
    debug("notif_playerGoOut", notif);

    if (notif.args.player_id === notif.args.firstout_id) {
      this.gamedatas.firstoutplayer = notif.args.player_id;
      dojo.style($("firstoutcolor_" + notif.args.player_id)!, "display", "inline-block");
    }
    this.disablePlayerPanel(notif.args.player_id);
    $("playertable_" + notif.args.player_id)!.classList.add("disabled");
  }

  private notif_pass(notif: Notif & { args: NotifTypes["pass"] }) {
    debug("notif_pass", notif);

    const playerId = notif.args.player_id;
    this.tableCombos[playerId]!.removeAll();
    this.setPass(playerId);
    dojo.query(".active").forEach((node: Node) => {
      const el = node as HTMLElement;
      el.classList.remove("active");
    });
    document.getElementById("playertable_" + notif.args.player_id)?.classList.add("active");
  }

  private notif_captureCards(notif: Notif & { args: NotifTypes["captureCards"] }) {
    debug("notif_captureCards", notif);

    const playerId = notif.args.player_id;
    const trick_value = notif.args.trick_value;
    const old_score = parseInt($("pointcount_" + playerId)!.innerHTML);
    const new_score = old_score + trick_value;

    dojohtml(".pointcount." + playerId, `${new_score}`);
    dojostyle(".cardback", "display", "none");
  }

  private notif_newScores(notif: Notif & { args: NotifTypes["newScores"] }) {
    debug("notif_newScores", notif);

    const newScores = notif.args.newScores;
    for (const player_id in newScores) {
      this.scoreCtrl[player_id]!.toValue(newScores[player_id]!);
    }
  }

  private notif_autopass(notif: Notif & { args: NotifTypes["autopass"] }) {
    debug("notif_autopass", notif);

    if (!this.isSpectator) this.gamedatas.players[this.player_id]!.pass = notif.args.autopass;
    this.onUpdateActionButtons(this.stateName, {});
  }

  private notif_acceptCards(notif: Notif & { args: NotifTypes["acceptCards"] }) {
    debug("notif_acceptCards", notif);
    clearTimeout(this.autoAcceptTimeout);

    setTimeout(() => {
      for (const card of notif.args.cards) {
        const cardOnTable = "cardontable_" + this.player_id + "_" + card.id;
        this.gamedatas.hand.push(card);
        addCardToStock(this.playerHand, card);
        this.slideToObjectAndDestroy(cardOnTable, "myhand", 500, 0);
      }
      this.updateStockOverlap(this.playerHand);
    }, 2000);
  }

  private notif_passCards(notif: Notif & { args: NotifTypes["passCards"] }) {
    debug("notif_passCards", notif);

    // The format of the notification has changed. Let's be backwards compatible for a while.
    // Support for the old format can be removed in October 2023.
    // New format: notif.args.cardIds
    // Old format: notif.args
    const ids: string[] = notif.args.cardIds ?? (notif.args as unknown as string[]);

    for (const id of ids) {
      this.gamedatas.hand = this.gamedatas.hand.filter((c) => c.id !== id);
      this.playerHand.removeFromStockById(Number(id));
    }
    this.updateStockOverlap(this.playerHand);
  }
}

// The global 'bgagame.tichu' class is instantiated when the page is loaded. The following code sets this variable to your game class.
dojo.setObject("bgagame.tichu", Tichu);
