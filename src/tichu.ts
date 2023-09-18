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

interface TichuPlayer extends Player {
  // number as string
  call_tichu: Bet;
  // number as string
  call_grand_tichu: Bet;
  // number as string
  pass: string;
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

interface TichuGamedatas {
  current_player_id: string;
  decision: { decision_type: string };
  game_result_neutralized: string;
  gamestate: Gamestate;
  gamestates: { [gamestateId: number]: Gamestate };
  neutralized_player_id: string;
  notifications: { last_packet_id: string; move_nbr: string };
  playerorder: (string | number)[];
  players: { [playerId: number]: TichuPlayer };
  tablespeed: string;

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
  hasBomb: boolean;
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

const isDebug = window.location.host === "studio.boardgamearena.com";
const debug = isDebug ? console.log.bind(window.console) : function () {};

function cardToStockType(card: Card): number {
  return stockType(Number(card.type), Number(card.type_arg));
}

function stockType(color: number, value: number): number {
  return (Number(color) - 1) * 14 + (Number(value) - 1);
}

function addCardToStock(stock: Stock | undefined, card: Card) {
  stock?.addToStockWithId(cardToStockType(card), card.id);
}

function addItemToStock(stock: Stock, item: StockItem) {
  stock.addToStockWithId(item.type, item.id);
}

class Tichu {
  private readonly game: GameGui = this as unknown as GameGui;
  private readonly cardwidth = 100;
  private readonly cardheight = 150;
  private readonly cardChoiceWidth = 70;
  private readonly cardChoiceHeight = 105;
  private cardsToPass: (StockItem | undefined)[] = [];
  private tableCombos: Record<number, Stock> = {};
  private mahjongValues!: Stock;
  private phoenixValues!: Stock;
  private allLastCombos: Record<number, Combo | undefined> = {};
  private clockwise: boolean = false;
  private roundCounter!: Counter;
  private trickCounter!: Counter;
  private currentTrickCounter!: Counter;
  private playerHand!: Stock;
  private active_player?: string;
  private stateName!: string;
  private allowedValues: number[] = [];
  private autoCollectTimeout?: number;
  private autoAcceptTimeout?: number;

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

  setup(gamedatas: TichuGamedatas) {
    debug("SETUP", gamedatas);

    // Replaces BGA css zoom feature, which is not supported on Firefox.
    // The css zoom is disabled in tichu.css.
    new ResizeObserver(() => requestAnimationFrame(() => this.rescale())).observe(
      document.getElementById("game_play_area_wrap")!
    );
    window.addEventListener("resize", () => requestAnimationFrame(() => this.rescale()));
    $("game_play_area").classList.toggle("isAllInfoExposed", this.isAllInfoExposed());

    const player_ids = new Array();
    for (const player_id in gamedatas.players) {
      player_ids.push(parseInt(player_id));
      if (gamedatas.handcount[player_id] === undefined) gamedatas.handcount[player_id] = 0;
    }

    this.setupGameBoards(gamedatas);

    this.game.addTooltipToClass("hand", _("Cards in hand"), "");
    this.game.addTooltipToClass("star", _("Points captured"), "");
    this.game.addTooltipToClass("grandtichublack", _("Grand Tichu bet yet to be made"), "");
    this.game.addTooltipToClass("tichublack", _("Tichu bet yet to be made"), "");
    this.game.addTooltipToClass("grandtichucolor", _("Grand Tichu bet"), "");
    this.game.addTooltipToClass("tichucolor", _("Tichu bet"), "");
    this.game.addTooltipToClass("firstoutcolor", _("First player out"), "");
    this.game.addTooltipToClass("cardback", _("has passed"), "");
    this.game.addTooltipToClass("mahjong_mini", _("Mahjong wish"), "");

    document
      .getElementById("overall-content")
      ?.classList.toggle("tiki", this.game.prefs[103].value == 1);
    this.updateMahjongWish(gamedatas.mahjongWish);

    if (gamedatas.firstoutplayer != 0) {
      dojo.style($("firstoutcolor_" + gamedatas.firstoutplayer), "display", "inline-block");
    }

    this.setupPlayerHand();

    this.mahjongValues = this.setupValueChoice("mahjong", 14);
    this.phoenixValues = this.setupValueChoice("phoenixChoice", 13);

    this.allLastCombos = gamedatas["allLastCombos"];
    this.displayLastCombos(player_ids, gamedatas["passes"]);

    Array.from($("playertables").children).forEach((el, i) => {
      dojo.connect(el.children[0], "onclick", this, () => this.onGiveCard(i));
    });

    this.setupNotifications();

    if (this.game.prefs[100].value == 2) {
      this.onReorderTable(true);
    }

    this.changeOrder(this.game.prefs[101].value != 1);
    this.setTheme(this.game.prefs[104]?.value ?? 0);

    this.setupCurrentTrick();
    this.updateCardsPlayed();

    debug("Ending game setup");
  }

  private isAllInfoExposed() {
    return this.game.gamedatas.isAllInfoExposed == 1;
  }

  private setupCurrentTrick() {
    this.roundCounter = new ebg.counter();
    this.roundCounter.create("roundCounter");
    this.roundCounter.setValue(this.game.gamedatas.round);

    this.trickCounter = new ebg.counter();
    this.trickCounter.create("trickCounter");
    this.trickCounter.setValue(this.game.gamedatas.trick);

    this.currentTrickCounter = new ebg.counter();
    this.currentTrickCounter.create("currentTrickCounter");
    this.currentTrickCounter.setValue(this.game.gamedatas.currentTrickValue);
  }

  private setupGameBoards(gamedatas: TichuGamedatas) {
    for (const player of Object.values(gamedatas.players)) {
      const player_id = player.id;
      const player_board_div = $("player_board_" + player_id);
      const isCurrent = player_id === this.game.player_id;
      dojo.place(this.game.format_block("jstpl_player_board", player), player_board_div);

      if (player.call_grand_tichu === Bet.GRAND_TICHU) {
        dojo.query(".grandtichucolor." + player_id).style("display", "inline-block");
        dojo.query(".tichublack." + player_id).style("display", "none");
      }
      if (player.call_grand_tichu === Bet.NO_BET_YET) {
        dojo.query(".grandtichublack." + player_id).style("display", "inline-block");
      }

      if (player.call_tichu === Bet.TICHU) {
        dojo.query(".tichucolor." + player_id).style("display", "inline-block");
      }
      if (player.call_tichu === Bet.NO_BET_YET) {
        dojo.query(".tichublack." + player_id).style("display", "inline-block");
      }

      dojo.query(".handcount." + player_id).innerHTML(gamedatas.handcount[player_id]);
      if (gamedatas.handcount[player_id] === 0) {
        this.game.disablePlayerPanel(player_id);
        $("playertable_" + player_id).classList.add("disabled");
      }
      if (player_id === Number(gamedatas.lastComboPlayer)) {
        $("playertable_" + player_id).classList.add("lastComboPlayer");
      }

      dojo.query(".pointcount." + player_id).innerHTML(gamedatas.capturedpoints[player_id]);
    }

    dojo.query(".playertabletext").forEach((e: HTMLElement) => {
      const span = document.createElement("SPAN");
      span.innerText = _("Select a card and click here");
      e.appendChild(span);
    });
  }

  private setupPlayerHand() {
    this.playerHand = this.createStock($("myhand"), this.cardwidth, this.cardheight);
    for (const card of this.game.gamedatas.hand) {
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

    this.game.addTooltipHtml(
      "list_table",
      _("You can change this permanently in the user settings")
    );
    this.game.addTooltipHtml(
      "square_table",
      _("You can change this permanently in the user settings")
    );
    this.game.addTooltipHtml(
      "clockwise",
      _(
        "This will affect the arrangement of the square table and the order of players when passing the cards.<br>You can change this permanently in the user settings"
      )
    );
    this.game.addTooltipHtml(
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
    document.getElementById("trick_button")?.replaceChildren();
    document.getElementById("bomb_button")?.replaceChildren();
    document.getElementById("play_button")?.replaceChildren();
    document.getElementById("pass_button")?.replaceChildren();
    document.getElementById("pass_trick_button")?.replaceChildren();
    document.getElementById("tichu_button")?.replaceChildren();
    dojo.place(this.game.format_block("jstpl_my_hand", {}), $("play_button"), "only");
  }

  private addMyActionButton(
    id: string,
    label: string,
    method: Function,
    color: string,
    dest: string
  ) {
    const args = {
      id,
      label,
      addclass: `bgabutton bgabutton_${color}`,
    };
    dojo.place(this.game.format_block("jstpl_my_action_button", args), dest, "only");
    dojo.connect($(id), "onclick", this, method);
  }

  private createStock(element: HTMLElement, cardWidth: number, cardHeight: number) {
    const stock = new ebg.stock();
    stock.create(this, element, cardWidth, cardHeight);
    stock.setSelectionAppearance("class");
    stock.setOverlap(30, 0);
    new ResizeObserver(() => requestAnimationFrame(() => this.updateStockOverlap(stock))).observe(
      element
    );
    stock.image_items_per_row = 14;
    const cardImgFile =
      this.game.prefs[103].value == 1 ? "img/tiki-cards.png" : "img/tichu-cards.png";
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
  private updateStockOverlap(stock?: Stock) {
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

  private setupValueChoice(idName: string, count: number): Stock {
    const valueChoice: Stock = new ebg.stock();
    valueChoice.create(this.game, $(idName), this.cardChoiceWidth, this.cardChoiceHeight);
    valueChoice.setSelectionAppearance("class");
    valueChoice.setSelectionMode(1);
    valueChoice.image_items_per_row = 7;

    for (let value = 0; value < count; value++) {
      valueChoice.addItemType(value, value, g_gamethemeurl + "img/tichu-icons-table.png", value);
      valueChoice.addToStockWithId(value, String(value + 2));
    }
    return valueChoice;
  }

  private displayLastCombos(playerIds: number[], passes: number[]) {
    if (this.allLastCombos === undefined) return;
    playerIds.forEach((playerId) => {
      this.resetComboStock(playerId);
      const combo = this.allLastCombos[playerId];
      if (combo && combo.cards?.length > 0) {
        this.addCardsToStock(this.tableCombos[playerId], combo.cards);
        this.setDescription(playerId, combo.description);
      } else if (passes.indexOf(playerId) >= 0) {
        this.setPass(playerId);
      }
    });
  }

  private resetComboStock(playerId: number) {
    if (playerId in this.tableCombos) {
      this.tableCombos[playerId].removeAll();
    } else {
      this.tableCombos[playerId] = this.createStock(
        $("lastcombo_" + playerId),
        this.cardwidth * 0.75,
        this.cardheight * 0.75
      );
      this.tableCombos[playerId].extraClasses = "smallCards";
      this.tableCombos[playerId].setSelectionMode(0);
    }
  }

  private setDescription(playerId: number, desc: string) {
    const translatedDesc = _(desc);
    this.game.addTooltipHtml("playertable_" + playerId, translatedDesc);
  }

  private addCardsToStock(stock: Stock, cards: Card[], playerId: number | null = null) {
    const weights: Weights = {};
    let i = 0;
    for (const card of cards) {
      if (playerId === this.game.player_id) {
        this.playerHand!.removeFromStockById(card.id);
      }
      addCardToStock(stock, card);
      weights[cardToStockType(card)] = i++;
    }
    stock.changeItemsWeight(weights);
    this.updateStockOverlap(this.playerHand);
    this.updateStockOverlap(stock);
  }

  private animateIcon(clazz: string, player_id: number) {
    const block = this.game.format_block("jstpl_temp", {
      clazz: clazz,
      id: player_id,
    });
    const e = dojo.place(block, "game_play_area");

    this.game.fadeOutAndDestroy(e, 1000, 1000);
  }

  onEnteringState(stateName: string, stateObject: State) {
    debug("Entering state: " + stateName, stateObject);
    this.active_player = stateObject.active_player;
    this.stateName = stateName;

    if (stateName !== "confirmTrick") {
      clearTimeout(this.autoCollectTimeout);
    }
    if (stateName !== "showPassedCards") {
      clearTimeout(this.autoAcceptTimeout);
    }

    const methodName = "onEnteringState" + stateName.charAt(0).toUpperCase() + stateName.slice(1);
    const thisMethods = this as unknown as { [key: string]: Function };
    if (thisMethods[methodName] !== undefined) thisMethods[methodName](stateObject.args);
  }

  onEnteringStateNewRound(args: any) {
    dojo.query(".pointcount").innerHTML("0");
    dojo.query(".cardback").style("display", "none");
    dojo.query(".mahjong_mini").innerHTML("");
    this.resetLastCombos();
    this.game.gamedatas.capturedCards = [];
    this.game.gamedatas.hand = [];
    this.game.gamedatas.currentTrick = [];
    this.game.gamedatas.firstoutplayer = 0;
    for (const id in this.game.gamedatas.players) {
      this.game.gamedatas.players[id].call_tichu = Bet.NO_BET_YET;
      this.game.gamedatas.players[id].call_grand_tichu = Bet.NO_BET_YET;
    }
    dojo.query(".last-played-container").removeClass("disabled");

    this.roundCounter.incValue(1);
    this.updateMahjongWish(0);
  }

  onEnteringStateGrandTichuBets(args: any) {
    this.resetLastCombos();
  }

  onEnteringStateGiveCards(args: any) {
    if (this.game.isSpectator) return;
    dojo.style("playertables", "display", "flex");
    dojo.style("card-last-played-area", "display", "none");
    dojo.query(".playertable").style("cursor", "pointer");
  }

  onEnteringStateShowPassedCards(args: any) {
    dojo.query(".handcount").innerHTML(14);
    if (args._private === undefined) return;
    dojo.style("playertables", "display", "flex");
    dojo.style("card-last-played-area", "display", "none");
    args._private.forEach((card: Card, i: number) => {
      const x = this.cardwidth * (Number(card.type_arg) - 1);
      const y = this.cardheight * (Number(card.type) - 1);
      dojo.place(
        this.game.format_block("jstpl_cardontable", {
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
    this.currentTrickCounter.setValue(0);
    this.trickCounter.incValue(1);
    this.game.gamedatas.capturedCards.push(...this.game.gamedatas.currentTrick);
    this.game.gamedatas.currentTrick = [];
  }

  onEnteringStatePlayComboOpen(args: any) {
    dojo.query(".active").forEach((el: HTMLElement) => el.classList.remove("active"));
    document.getElementById("playertable_" + this.active_player)?.classList.add("active");
  }

  onEnteringStateMahjongPlay(args: any) {
    if (this.game.isCurrentPlayerActive()) {
      dojo.style($("mahjongpanel"), "display", "block");
      this.mahjongValues.updateDisplay();
    }
    this.playerHand!.unselectAll();
  }

  onEnteringStatePhoenixPlay(args: any) {
    if (this.game.isCurrentPlayerActive()) {
      dojo.style($("phoenixpanel"), "display", "block");
      this.allowedValues = args._private.values;
      // variante 1
      this.phoenixValues!.removeAll();
      args._private.values.forEach((value: number) => {
        this.phoenixValues!.addToStock(value - 2);
      });
      this.phoenixValues!.updateDisplay();
    }
    this.playerHand!.unselectAll();
  }

  onEnteringStatePlayCombo(args: any) {
    dojo.query(".active").forEach((el: HTMLElement) => el.classList.remove("active"));
    document.getElementById("playertable_" + this.active_player)?.classList.add("active");
  }

  onEnteringStatePlayBomb(args: any) {
    document.getElementById("playertable_" + args.active)?.classList.add("active");
  }

  onEnteringStateChooseDragonGift(args: any) {
    if (!this.game.isCurrentPlayerActive()) return;

    const left = this.clockwise ? 0 : 1;
    const right = this.clockwise ? 1 : 0;
    this.game.addActionButton(
      "giveDragonBefore_button",
      _("Give cards to " + args.enemies[left]),
      () => this.onGiveDragon(left)
    );
    this.game.addActionButton(
      "giveDragonAfter_button",
      _("Give cards to " + args.enemies[right]),
      () => this.onGiveDragon(right)
    );
  }

  onEnteringStateEndRound(args: any) {
    this.playerHand!.removeAll();
    this.game.enableAllPlayerPanels();
    this.cleanPlayersPanel();
  }

  onEnteringStateConfirmTrick(args: any) {
    dojo.query(".active").forEach((el: HTMLElement) => el.classList.remove("active"));
    document.getElementById("playertable_" + this.active_player)?.classList.add("active");
  }

  onLeavingState(stateName: string) {
    debug("Leaving state: " + stateName);
    dojo.query(".playertable").style("cursor", "unset");
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

    const captured = this.game.gamedatas.capturedCards;
    for (const card of captured) {
      const id = `playedCard_${card.type}_${card.type_arg}`;
      document.getElementById(id)?.classList.add("captured");
    }
    const trick = this.game.gamedatas.currentTrick;
    for (const card of trick) {
      const id = `playedCard_${card.type}_${card.type_arg}`;
      document.getElementById(id)?.classList.add("trick");
    }
    const hand = this.game.gamedatas.hand;
    for (const card of hand) {
      const id = `playedCard_${card.type}_${card.type_arg}`;
      document.getElementById(id)?.classList.add("hand");
    }
  }

  onUpdateActionButtons(stateName: string, args: any) {
    debug("onUpdateActionButtons: " + stateName);
    const player = this.game.gamedatas.players[this.game.player_id];
    this.game.removeActionButtons();
    this.removeMyActionButtons();
    this.updateCardsPlayed();
    if (this.game.isCurrentPlayerActive()) {
      switch (stateName) {
        case "giveCards":
          this.game.addActionButton(
            "resetPassCards_button",
            _("Reset choices"),
            "onResetPassCards",
            null,
            false,
            "gray"
          );
          this.game.addActionButton("passCards_button", _("Pass selected cards"), "onPassCards");
          break;
        case "showPassedCards":
          clearTimeout(this.autoAcceptTimeout);
          if (document.visibilityState === "visible") {
            dojo.place(this.game.format_block("jstpl_auto_accept", {}), $("play_button"), "only");
            clearTimeout(this.autoAcceptTimeout);
            this.autoAcceptTimeout = setTimeout(() => this.onAcceptCards(), 2000);
          }
          this.game.addActionButton("acceptCards_button", _("Accept cards"), "onAcceptCards");
          break;
        case "mahjongPlay":
          this.game.addActionButton("chooseWish", _("Make a wish"), "onMakeAWish");
          break;
        case "phoenixPlay":
          this.game.addActionButton(
            "choosePhoenix",
            _("Choose a value for the Phoenix"),
            "onChoosePhoenix"
          );
          this.game.addActionButton("cancelPhoenix", _("Cancel"), "cancelPhoenix");
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
          this.game.addTooltip(
            "myPassTrick",
            _("Automatically pass until the end of this trick."),
            ""
          );
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
          if (this.game.bRealtime) {
            dojo.place(this.game.format_block("jstpl_auto_collect", {}), $("play_button"), "only");
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
          // TODO: Bring back the "this.game.gamedatas.hasBomb" check, but only if the new game option was selected.
          this.addMyActionButton(
            "myPlayBomb",
            _("Play a Bomb"),
            () => this.playCombo("playBomb"),
            "gray",
            "bomb_button"
          );
      }
    } else if (
      !this.game.isSpectator &&
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
        this.game.addTooltip(
          "myPassTrick",
          _("Automatically pass until the end of this trick."),
          ""
        );
      }
      if (Number(player.pass) === 0) {
        this.addMyActionButton(
          "myPassOnce",
          _("Auto-Pass once"),
          () => this.onPass(true),
          "red",
          "pass_button"
        );
        this.game.addTooltip(
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
        this.game.addTooltip(
          "myCancelAutopass",
          _("You have chosen to automatically pass during this trick. Click to cancel"),
          ""
        );
      }
      // TODO: Bring back the "this.game.gamedatas.hasBomb" check, but only if the new game option was selected.
      this.addMyActionButton(
        "myPlayBomb",
        _("Play a Bomb"),
        () => this.playCombo("playBomb"),
        "gray",
        "bomb_button"
      );
    }

    if (!this.game.isSpectator) {
      if (player.call_grand_tichu === Bet.NO_BET_YET) {
        this.game.addActionButton(
          "noBet",
          _("No bet"),
          () => this.onGrandTichuBet(Bet.NO_BET),
          null,
          false,
          "gray"
        );
        this.game.addTooltip("noBet", _("Don't call Grand Tichu"), "");
        this.game.addActionButton(
          "makeGTBet",
          _("Grand Tichu"),
          () => this.onGrandTichuBet(Bet.GRAND_TICHU),
          null,
          false,
          "red"
        );
        this.game.addTooltip("makeGTBet", _("Bet 200 Points, tha you will finish first"), "");
      }
      if (player.call_tichu === Bet.NO_BET_YET && this.game.gamedatas.firstoutplayer == 0) {
        this.addMyActionButton(
          "myMakeTichuBet",
          _("Tichu"),
          () => this.onTichuBet(),
          "green",
          "tichu_button"
        );
        this.game.addTooltip("myMakeTichuBet", _("Bet 100 Points, tha you will finish first"), "");
      }
    }

    if (this.game.gamedatas.currentTrick.length > 0) {
      this.addMyActionButton(
        "myShowTrick",
        _("Show current trick"),
        () => this.showCurrentTrick(),
        "gray",
        "trick_button"
      );
    }
  }

  private resetLastCombos() {
    for (const [key, comboStock] of Object.entries(this.tableCombos)) {
      comboStock.removeAll();
      $("lastcombo_" + key).innerHTML = "";
      this.game.addTooltip("playertable_" + key, "", "");
    }
    dojo.query(".lastComboPlayer").removeClass("lastComboPlayer");
  }

  private cleanPlayersPanel() {
    dojo.query(".handcount").innerHTML(0);
    dojo.query(".pointcount").innerHTML(0);
    dojo.query(".grandtichublack").style("display", "inline-block");
    dojo.query(".tichublack").style("display", "inline-block");
    dojo.query(".grandtichucolor").style("display", "none");
    dojo.query(".tichucolor").style("display", "none");
    dojo.query(".firstoutcolor").style("display", "none");
    dojo.query(".cardback").style("display", "none");
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
      this.game.prefs[103].value == 1 ? "img/tiki-icons-pass.png" : "img/tichu-icons-pass.png";
    const img = g_gamethemeurl + cardImgFile;
    $("lastcombo_" + playerId).innerHTML =
      "<span class = 'pass'> <img src='" +
      img +
      "' width='75px' height='112.5px' alt='pass'> </span>";
    $("cardback_" + playerId).style.display = "inline-block";
    this.setDescription(playerId, "Pass");
  }

  private setupNewCard(card_div: HTMLElement, card_type_id: number, card_id: string) {
    if (
      this.getCardValueByTypeID(card_type_id) === 10 ||
      this.getCardValueByTypeID(card_type_id) === 13
    )
      this.game.addTooltip(card_div.id, _("Scores 10 points"), "");
    if (this.getCardValueByTypeID(card_type_id) === 5)
      this.game.addTooltip(card_div.id, _("Scores 5 points"), "");
    if (card_type_id === 0)
      this.game.addTooltip(
        card_div.id,
        _("Highest single card. Scores 25 points. Trick given to an opponent if Dragon wins it."),
        ""
      );
    if (card_type_id === 14)
      this.game.addTooltip(
        card_div.id,
        _(
          "Scores -25 points. Takes the place of any normal card in a combo but not a bomb. As a Single, worth 1.5 when led, beats any other card but the Dragon by 0.5."
        ),
        ""
      );
    if (card_type_id === 28)
      this.game.addTooltip(
        card_div.id,
        _(
          "The Hound must be played as a leading single card. Player's partner (or the next one if he's gone out) can lead."
        ),
        ""
      );
    if (card_type_id === 42)
      this.game.addTooltip(
        card_div.id,
        _(
          "The Mahjong's owner starts. Worth 1. When played, owner may wish for a rank to be fulfilled by the next regular player if possible."
        ),
        ""
      );
  }

  private cancelPhoenix() {
    dojo.style($("phoenixpanel"), "display", "none");
    this.takeAction("cancelPhoenix", {});
  }

  private showCurrentTrick() {
    const myDlg = new ebg.popindialog();
    myDlg.create("myDialogCurrentTrick");
    myDlg.setTitle(_("Cards in current Trick"));
    myDlg.setContent('<div id="currentTrickCards"></div>');
    myDlg.show();
    let stock = this.createStock(
      $("currentTrickCards"),
      this.cardwidth * 0.75,
      this.cardheight * 0.75
    );
    stock.extraClasses = "smallCards";
    stock.setSelectionMode(0);
    for (const card of this.game.gamedatas.currentTrick) {
      addCardToStock(stock, card);
    }
  }

  private onGrandTichuBet(bet: Bet) {
    debug("onGrandTichuBet");
    if (!this.game.checkAction("grandTichuBet")) return;

    this.takeAction("grandTichuBet", { bet: bet });
    this.game.removeActionButtons();
  }

  private onTichuBet() {
    debug("onTichuBet");
    // Note that we cannot check the action here, because it may not be the player's turn.
    // But you can call Tichu out of turn.

    this.takeAction("tichuBet", { bet: Bet.TICHU });
    this.game.removeActionButtons();
  }

  // client side action only
  private onGiveCard(i: number) {
    debug("onGiveCard", i);

    const items = this.playerHand!.getSelectedItems();
    const player_id = this.game.player_id;
    const stockItem = this.cardsToPass[i];

    if (!stockItem) {
      if (items.length != 1) return;
      const card: StockItem = items[0];
      this.cardsToPass[i] = card;
      const value = this.getCardValueByTypeID(card.type);
      const color = this.getCardColorByTypeID(card.type);
      const x = this.cardwidth * (value - 1);
      const y = this.cardheight * (color - 1);
      const direction = i + 1;

      dojo.place(
        this.game.format_block("jstpl_cardontable", {
          x: x,
          y: y,
          player_id: player_id,
          card_id: card.id,
        }),
        "giveplayertable_" + direction
      );

      if ($("myhand_item_" + card.id)) {
        this.playerHand!.removeFromStockById(card.id);
      } else {
        debug("Failed to remove card from hand");
      }
    } else {
      $("cardontable_" + player_id + "_" + stockItem.id).remove();
      addItemToStock(this.playerHand!, stockItem);
      this.cardsToPass[i] = undefined;
    }
    this.updateStockOverlap(this.playerHand);
  }

  // DANGER: The state action is named "giveCards", but the php action is "giveTheCards".
  private onPassCards() {
    debug("onPassCards");
    if (!this.game.checkAction("giveCards")) return;

    const items = this.cardsToPass;
    for (let i = 0; i < 3; i++) {
      if (!items[i]) {
        this.game.showMessage(_("You must select exactly 3 cards"), "error");
        return;
      }
    }

    let to_give = "";
    for (const i in items) {
      dojo.destroy("cardontable_" + this.game.player_id + "_" + items[i]!.id);
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
    if (!this.game.checkAction("makeAWish")) return;

    const items = this.mahjongValues.getSelectedItems();
    if (items.length > 0) {
      evt.preventDefault();
      this.takeAction("makeAWish", { wish: items[0].id });
    }
  }

  private onChoosePhoenix(evt: Event) {
    debug("onChoosePhoenix");
    // It is a bit weird that the names "phoenixPlay" and "choosePhoenix" don't match.
    if (!this.game.checkAction("phoenixPlay")) return;

    const items = this.phoenixValues.getSelectedItems();
    if (items.length === 1) {
      if (this.allowedValues.indexOf(items[0].type + 2) < 0) return;
      dojo.style($("phoenixpanel"), "display", "none");
      evt.preventDefault();
      this.takeAction("choosePhoenix", { phoenixValue: items[0].type + 2 });
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
      $("game_play_area").classList.add("squareTable");
      dojo.style("square_table", "display", "none");
      dojo.style("list_table", "display", "inline");
    } else {
      $("game_play_area").classList.remove("squareTable");
      dojo.style("square_table", "display", "inline");
      dojo.style("list_table", "display", "none");
    }
  }

  // client side action only
  private changeOrder(clockwise: boolean) {
    debug(`changeOrder ${clockwise} ${this.game.prefs[101].value}`);

    this.clockwise = clockwise;
    $("game_play_area").classList.toggle("clockwise", clockwise);
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

    const player_id = this.game.player_id;
    for (const item of this.cardsToPass) {
      if (!item) continue;
      $("cardontable_" + player_id + "_" + item.id).remove();
      addItemToStock(this.playerHand!, item);
    }
    this.cardsToPass = [];
  }

  private onGiveDragon(player: number) {
    debug("onGiveDragon");
    if (!this.game.checkAction("chooseDragonGift")) return;
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

    if (this.game.prefs[102].value == 1 && this.playerHand!.getSelectedItems().length > 0) {
      this.game.showMessage(
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
    if (!this.game.checkAction("collect")) return;

    this.takeAction("collect");
  }

  private takeAction(action: string, args: any = {}) {
    args.lock = true;
    this.game.ajaxcall("/tichu/tichu/" + action + ".html", args, this.game, function (res) {});
  }

  setupNotifications() {
    debug("notifications subscriptions setup");

    // Make sure to read the documentation about "Synchronous Nnotifications" in the BGA Studio docs
    // before making any changes here.
    // Be aware that using `undefined` here means that you have to make abolutely sure that
    // `setSynchronousDuration` is called in your handler.
    // Also be aware that using 0 may completely break the flow and cause missed notifications.
    const notifs: Record<string, number | undefined> = {
      dealCards: 500,
      grandTichuBet: undefined,
      tichuBet: undefined,
      confirmTichu: 1,
      hasBomb: 1,
      playCombo: 300,
      wishMade: 200,
      mahjongWishGranted: 1,
      playerGoOut: 1,
      pass: 300,
      captureCards: 500,
      newScores: 1000,
      autopass: 1,
      acceptCards: 1000,
      passCards: 200,
      devConsole: 1,
    };
    for (const [type, duration] of Object.entries(notifs)) {
      dojo.subscribe(type, this, "notif_" + type);
      this.game.notifqueue.setSynchronous(type, duration);
    }
  }

  private notif_devConsole(notif: Notif) {
    debug("notif_devConsole", notif);
    window.console.log(`DEV NOTIF: ${notif.args.msg}`);
  }

  private notif_dealCards(notif: Notif) {
    debug("notif_dealCards", notif);

    for (const card of notif.args.cards) {
      this.game.gamedatas.hand.push(card);
      addCardToStock(this.playerHand, card);
    }
    this.updateStockOverlap(this.playerHand);
    const totalCards = notif.args.cards.length === 8 ? 8 : 14;
    dojo.query(".handcount").innerHTML(totalCards);
  }

  private notif_grandTichuBet(notif: Notif) {
    // MUST call setSynchronousDuration
    debug("notif_grandTichuBet", notif);

    const bet = String(notif.args.bet) as Bet;
    this.game.gamedatas.players[notif.args.player_id].call_grand_tichu = bet;
    dojo.query(".grandtichublack." + notif.args.player_id).style("display", "none");
    if (bet === Bet.GRAND_TICHU) {
      this.game.gamedatas.players[notif.args.player_id].call_tichu = Bet.NO_BET;
      dojo.query(".grandtichucolor." + notif.args.player_id).style("display", "inline-block");
      dojo.query(".tichublack." + notif.args.player_id).style("display", "none");
      this.animateIcon("grandtichucolor", notif.args.player_id);
      playSound("tichu_laser");
      this.game.notifqueue.setSynchronousDuration(1000);
    } else {
      // If the notification was just a "this player has made no bet", then there is good reason
      // to freeze the UI for 1 second. 100 ms should be fine. Maybe 0 ms would also be ok.
      this.game.notifqueue.setSynchronousDuration(100);
    }

    this.onUpdateActionButtons(this.stateName, {});
  }

  private notif_tichuBet(notif: Notif) {
    // MUST call setSynchronousDuration
    debug("notif_tichuBet", notif);

    const bet = String(notif.args.bet) as Bet;
    this.game.gamedatas.players[notif.args.player_id].call_tichu = bet;
    this.game.gamedatas.players[notif.args.player_id].call_grand_tichu = Bet.NO_BET;
    dojo.query(".tichublack." + notif.args.player_id).style("display", "none");
    dojo.query(".grandtichublack." + notif.args.player_id).style("display", "none");
    if (bet === Bet.TICHU) {
      dojo.query(".tichucolor." + notif.args.player_id).style("display", "inline-block");
      this.animateIcon("tichucolor", notif.args.player_id);
      playSound("tichu_laser");
      this.game.notifqueue.setSynchronousDuration(1000);
    } else {
      // If the notification was just a "this player has made no bet" or "this player has already
      // played their first card, so cannot bet anymore", then there is no good reason
      // to freeze the UI for 1 second. 100 ms should be fine. Maybe 0 ms would also be ok.
      this.game.notifqueue.setSynchronousDuration(100);
    }

    this.onUpdateActionButtons(this.stateName, {});
  }

  private notif_confirmTichu(notif: Notif) {
    debug("notif_confirmTichu", notif);

    const titleSave = this.game.gamedatas.gamestate.descriptionmyturn;
    const s = notif.args.grand ? "grand " : "";
    this.game.gamedatas.gamestate.descriptionmyturn = notif.args.msg;
    this.game.updatePageTitle();
    this.game.removeActionButtons();
    this.game.addActionButton("cancelTichu", _("no " + s + "tichu"), () => {
      if (notif.args.grand) {
        this.onGrandTichuBet(Bet.NO_BET);
        return;
      }
      this.game.gamedatas.gamestate.descriptionmyturn = titleSave;
      this.game.updatePageTitle();
      this.onUpdateActionButtons(this.stateName, {});
    });
    this.game.addActionButton("confirmTichu", _("confirm"), () =>
      this.takeAction("confirmTichu", { bet: notif.args.grand ? Bet.GRAND_TICHU : Bet.TICHU })
    );
  }

  private notif_hasBomb(notif: Notif) {
    debug("notif_hasBomb", notif);

    this.game.gamedatas.hasBomb = notif.args.hasBomb;
  }

  private notif_playCombo(notif: Notif) {
    debug("notif_playCombo", notif);

    const playerId = Number(notif.args.player_id);
    this.resetComboStock(playerId);
    this.addCardsToStock(this.tableCombos[playerId], notif.args.cards, playerId);
    dojo.query("pass").innerHTML("");
    $("cardback_" + playerId).style.display = "none";
    this.setDescription(playerId, notif.args.combo_name);
    dojo.query(".handcount." + playerId).forEach((el: HTMLElement) => {
      el.innerHTML = String(parseInt(el.innerHTML) - notif.args.cards.length);
    });
    dojo.query(".lastComboPlayer").removeClass("lastComboPlayer");
    $("playertable_" + playerId).classList.add("lastComboPlayer");
    this.game.gamedatas.currentTrick.push(...notif.args.cards);
    this.currentTrickCounter.incValue(notif.args.points);
  }

  private notif_wishMade(notif: Notif) {
    debug("notif_wishMade", notif);

    dojo.style($("mahjongpanel"), "display", "none");
    this.updateMahjongWish(notif.args.wish);
  }

  private updateMahjongWish(wish: number) {
    const indicator = $("mahjongIndicator");
    if (wish > 0 && wish < 15) {
      const w = wish - 2;
      const x = w % 7;
      const y = (w - x) / 7;
      dojo.place(
        this.game.format_block("jstpl_mahjong", {
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

  private notif_playerGoOut(notif: Notif) {
    debug("notif_playerGoOut", notif);

    if (notif.args.player_id === notif.args.firstout_id) {
      this.game.gamedatas.firstoutplayer = notif.args.player_id;
      dojo.style($("firstoutcolor_" + notif.args.player_id), "display", "inline-block");
    }
    this.game.disablePlayerPanel(notif.args.player_id);
    $("playertable_" + notif.args.player_id).classList.add("disabled");
  }

  private notif_pass(notif: Notif) {
    debug("notif_pass", notif);

    const playerId = notif.args.player_id;
    this.tableCombos[playerId].removeAll();
    this.setPass(playerId);
    dojo.query(".active").forEach((el: HTMLElement) => el.classList.remove("active"));
    document.getElementById("playertable_" + notif.args.player_id)?.classList.add("active");
  }

  private notif_captureCards(notif: Notif) {
    debug("notif_captureCards", notif);

    const playerId = notif.args.player_id;
    const trick_value = notif.args.trick_value;
    const old_score = parseInt($("pointcount_" + playerId).innerHTML);
    const new_score = old_score + trick_value;

    dojo.query(".pointcount." + playerId).innerHTML(new_score);
    dojo.query(".cardback").style("display", "none");
  }

  private notif_newScores(notif: Notif) {
    debug("notif_newScores", notif);

    const newScores = notif.args.newScores as { [key: number]: number };
    for (const player_id in newScores) {
      this.game.scoreCtrl[player_id].toValue(newScores[player_id]);
    }
  }

  private notif_autopass(notif: Notif) {
    debug("notif_autopass", notif);

    if (!this.game.isSpectator)
      this.game.gamedatas.players[this.game.player_id].pass = notif.args.autopass;
    this.onUpdateActionButtons(this.stateName, {});
  }

  private notif_acceptCards(notif: Notif) {
    debug("notif_acceptCards", notif);
    clearTimeout(this.autoAcceptTimeout);

    for (const card of notif.args.cards) {
      const cardOnTable = "cardontable_" + this.game.player_id + "_" + card.id;
      this.game.gamedatas.hand.push(card);
      addCardToStock(this.playerHand, card);
      this.game.slideToObjectAndDestroy(cardOnTable, "myhand", 500, 0);
    }
    this.updateStockOverlap(this.playerHand);

    setTimeout(function () {
      dojo.style("playertables", "display", "none");
      dojo.style("card-last-played-area", "display", "grid");
    }, 1000);
  }

  private notif_passCards(notif: Notif) {
    debug("notif_passCards", notif);

    // The format of the notification has changed. Let's be backwards compatible for a while.
    // Support for the old format can be removed in October 2023.
    // New format: notif.args.cardIds
    // Old format: notif.args
    const ids = notif.args.cardIds ?? notif.args;

    for (const id of ids) {
      this.game.gamedatas.hand = this.game.gamedatas.hand.filter((c) => c.id !== id);
      this.playerHand.removeFromStockById(id);
    }
    this.updateStockOverlap(this.playerHand);
  }
}
