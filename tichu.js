/**
 *------
 * BGA framework: © Gregory Isabelli <gisabelli@boardgamearena.com> & Emmanuel Colin <ecolin@boardgamearena.com>
 * Tichu implementation : © Yannick Priol <camertwo@hotmail.com>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * tichu.js
 *
 * Tichu user interface script
 *
 * In this file, you are describing the logic of your user interface, in Javascript language.
 *
 */
var isDebug = true;
var debug = isDebug ? console.info.bind(window.console) : function () {};
define(["dojo", "dojo/_base/declare", "ebg/core/gamegui", "ebg/counter", "ebg/stock"], function (
  dojo,
  declare
) {
  return declare("bgagame.tichu", ebg.core.gamegui, {
    constructor: function () {
      console.log("tichu constructor");

      this.cardwidth = 100;
      this.cardheight = 150;

      this.cardChoiceWidth = 70;
      this.cardChoiceHeight = 105;

      this.cardsToPass = [null, null, null];

      this.tableCombos = {};
    },
    setup: function (gamedatas) {
      debug("SETUP", gamedatas);
      var player_ids = new Array();
      for (var player_id in gamedatas.players) {
        player_ids.push(parseInt(player_id));
        if (gamedatas.handcount[player_id] == undefined) gamedatas.handcount[player_id] = 0;
      }
      // Setting up player boards
      this.setupGameBoards(gamedatas);
      this.addTooltipToClass("hand", _("Cards in hand"), "");
      this.addTooltipToClass("star", _("Points captured"), "");
      this.addTooltipToClass("grandtichublack", _("Grand Tichu bet yet to be made"), "");
      this.addTooltipToClass("tichublack", _("Tichu bet yet to be made"), "");
      this.addTooltipToClass("grandtichucolor", _("Grand Tichu bet"), "");
      this.addTooltipToClass("tichucolor", _("Tichu bet"), "");
      this.addTooltipToClass("firstoutcolor", _("First player out"), "");
      this.addTooltipToClass("cardback", _("has passed"), "");
      this.addTooltipToClass("mahjong_mini", _("Mahjong wish"), "");

      document
        .getElementById("overall-content")
        .classList.toggle("tiki", this.prefs[103].value == 1);
      this.updateMahjongWish(gamedatas.mahjongWish);

      if (gamedatas.firstoutplayer != 0) {
        dojo.style($("firstoutcolor_" + gamedatas.firstoutplayer), "display", "inline-block");
      }

      this.setupPlayerHand();

      this.mahjongValues = this.setupValueChoice(
        "mahjong",
        null /*'onMahjongValuesSelectionChanged'*/,
        14
      );
      this.phoenixValues = this.setupValueChoice(
        "phoenixChoice",
        null /*'onPhoenixValuesSelectionChanged'*/,
        13
      );

      this.allLastCombos = gamedatas["allLastCombos"];
      this.displayLastCombos(player_ids, gamedatas["passes"]);
      // Betting
      Array.from($("playertables").children).forEach((el, i) => {
        dojo.connect(el.children[0], "onclick", this, () => this.onGiveCard(i));
      });

      // Setup game notifications to handle (see "setupNotifications" method below)
      this.setupNotifications();
      if (this.prefs[100].value == 2) {
        this.onReorderTable(true);
      }
      this.clockwise = false;
      if (this.prefs[101].value == 1) {
        this.changeOrder(true);
      }

      var currentTrick = $("currentTrick");
      currentTrick.innerHTML = _("Points in current trick: ") + currentTrick.innerHTML;
      this.currentTrickCounter = new ebg.counter();
      this.currentTrickCounter.create("currentTrickCounter");
      var div = document.createElement("DIV");
      this.addTooltipHtml("currentTrick", _("click to see the cards"));
      dojo.connect($("currentTrick"), "onclick", this, "showCurrentTrick");
      this.currentTrickCounter.setValue(gamedatas.currentTrickValue);

      console.log("Ending game setup");
    },

    setupGameBoards: function (gamedatas) {
      Object.values(gamedatas.players).forEach((player) => {
        var player_id = player.id;
        var player_board_div = $("player_board_" + player_id);
        var isCurrent = player_id == this.player_id;
        dojo.place(this.format_block("jstpl_player_board", player), player_board_div);
        //this.scoreCtrl[player_id].toValue(player.score);

        if (player.call_grand_tichu >= 0) {
          if (player.call_grand_tichu == 200) {
            dojo.query(".grandtichucolor." + player_id).style("display", "inline-block");
            dojo.query(".tichublack." + player_id).style("display", "none");
          }
        } else {
          dojo.query(".grandtichublack." + player_id).style("display", "inline-block");
        }

        if (player.call_tichu >= 0) {
          if (player.call_tichu == 100) {
            dojo.query(".tichucolor." + player_id).style("display", "inline-block");
          }
        } else {
          dojo.query(".tichublack." + player_id).style("display", "inline-block");
        }

        dojo.query(".handcount." + player_id).innerHTML(gamedatas.handcount[player_id]);
        if (gamedatas.handcount[player_id] == 0) {
          this.disablePlayerPanel(player_id);
          $("playertable_" + player_id).classList.add("disabled");
        }
        if (player_id == gamedatas.lastComboPlayer) {
          $("playertable_" + player_id).classList.add("lastComboPlayer");
        }

        dojo.query(".pointcount." + player_id).innerHTML(gamedatas.capturedpoints[player_id]);
      });

      dojo.query(".playertabletext").forEach((e) => {
        var span = document.createElement("SPAN");
        span.innerText = _("Select a card and click here");
        e.appendChild(span);
      });
    },

    setupPlayerHand: function () {
      this.playerHand = this.createStock($("myhand"), this.cardwidth, this.cardheight);

      dojo.connect(this.playerHand, "onChangeSelection", this, "onPlayerHandSelectionChanged");

      // Cards in player's hand

      for (var i in this.gamedatas.hand) {
        var card = this.gamedatas.hand[i];
        var color = card.type;
        var value = card.type_arg;
        this.playerHand.addToStockWithId(this.getCardUniqueId(color, value), card.id);
      }
      this.updateStockOverlap(this.playerHand);

      // triggers reorder cards
      dojo.connect($("order_by_rank"), "onclick", this, "onReorderByRank");
      dojo.connect($("order_by_color"), "onclick", this, "onReorderByColor");
      dojo.connect($("list_table"), "onclick", this, () => this.onReorderTable(false));
      dojo.connect($("square_table"), "onclick", this, () => this.onReorderTable(true));
      this.addTooltipHtml("list_table", _("You can change this permanently in the user settings"));
      this.addTooltipHtml(
        "square_table",
        _("You can change this permanently in the user settings")
      );
      dojo.connect($("clockwise"), "onclick", this, () => this.changeOrder(true));
      dojo.connect($("counterClockwise"), "onclick", this, () => this.changeOrder(false));
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
    },

    removeMyActionButtons: function () {
      document.getElementById("bomb_button").replaceChildren();
      document.getElementById("play_button").replaceChildren();
      document.getElementById("pass_button").replaceChildren();
      document.getElementById("pass_trick_button").replaceChildren();
      document.getElementById("tichu_button").replaceChildren();
      dojo.place(this.format_block("jstpl_my_hand", {}), $("play_button"));
    },

    addMyActionButton: function (id, label, method, color, dest) {
      tpl = {};
      tpl.id = id;
      tpl.label = label;
      tpl.addclass = `bgabutton bgabutton_${color}`;

      dojo.place(this.format_block("jstpl_my_action_button", tpl), dest, "only");
      dojo.connect($(id), "onclick", this, method);
    },

    createStock: function (element, cardWidth, cardHeight) {
      const stock = new ebg.stock();
      stock.create(this, element, cardWidth, cardHeight);
      stock.setSelectionAppearance("class");
      stock.setOverlap(30, 0);
      new ResizeObserver(() => requestAnimationFrame(() => this.updateStockOverlap(stock))).observe(
        element
      );
      stock.image_items_per_row = 14;
      var cardImgFile = this.prefs[103].value == 1 ? "img/tiki-cards.png" : "img/tichu-cards.png";
      for (var color = 1; color <= 4; color++) {
        for (var value = 1; value <= 14; value++) {
          // Build card type id
          var card_type_id = this.getCardUniqueId(color, value);
          var card_weight = 2 * (4 * (value - 1) + (color - 1));
          stock.addItemType(card_type_id, card_weight, g_gamethemeurl + cardImgFile, card_type_id);
          stock.onItemCreate = dojo.hitch(this, "setupNewCard");
        }
      }
      return stock;
    },

    /**
     * We would like the card overlap to depend on the width of the container element.
     * We have to make sure that this method gets called every time that the number of cards in a
     * stock changes or the size of the container element changes.
     *
     * We think it is useful to only allow overlap between 12% and 60%.
     */
    updateStockOverlap: function (stock) {
      let availableWidthForOverlapPerItem =
        (stock.container_div.clientWidth - (stock.item_width + stock.item_margin)) /
        (stock.items.length - 1);
      let overlap = Math.floor(
        ((availableWidthForOverlapPerItem - stock.item_margin - 1) / stock.item_width) * 100
      );
      if (overlap > 60) overlap = 60;
      if (overlap < 12) overlap = 12;
      stock.setOverlap(overlap, 0);
    },

    setupValueChoice: function (idName, callbackFunc, count) {
      //mahjong wish
      valueChoice = new ebg.stock();
      valueChoice.create(this, $(idName), this.cardChoiceWidth, this.cardChoiceHeight);
      valueChoice.setSelectionAppearance("class");

      if (callbackFunc != null) dojo.connect(valueChoice, "onChangeSelection", this, callbackFunc);
      else valueChoice.setSelectionMode(1);

      valueChoice.image_items_per_row = 7; // 7 images per row

      for (var value = 0; value < count; value++) {
        // Build card type id
        valueChoice.addItemType(value, value, g_gamethemeurl + "img/tichu-icons-table.png", value);
        valueChoice.addToStockWithId(value, value + 2);
      }

      return valueChoice;
    },

    displayLastCombos: function (playerIds, passes) {
      if (this.allLastCombos == undefined) return;
      playerIds.forEach((playerId) => {
        this.resetComboStock(playerId);
        if (
          this.allLastCombos[playerId] != undefined &&
          this.allLastCombos[playerId]["cards"].length > 0
        ) {
          this.addCardsToStock(this.tableCombos[playerId], this.allLastCombos[playerId]["cards"]);
          this.setDescription(playerId, this.allLastCombos[playerId]["description"]);
        } else if (passes.indexOf(playerId) >= 0) {
          this.setPass(playerId);
        }
      });
    },

    resetComboStock: function (playerId) {
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
    },

    setDescription: function (playerId, desc) {
      var translatedDesc = _(desc);
      this.addTooltipHtml("playertable_" + playerId, translatedDesc);
    },

    addCardsToStock: function (stock, cards, playerId = null) {
      var weights = {};
      cards.forEach((card, i) => {
        if (playerId == this.player_id) {
          this.playerHand.removeFromStockById(card.id);
        }
        var uid = this.getCardUniqueId(card.type, card.type_arg);
        weights[uid] = i;
        stock.addToStockWithId(uid, card.id);
      });
      stock.changeItemsWeight(weights);
      this.updateStockOverlap(this.playerHand);
      this.updateStockOverlap(stock);
    },

    animateIcon: function (clazz, player_id) {
      // todo
      var block = this.format_block("jstpl_temp", {
        clazz: clazz,
        id: player_id,
      });
      var e = dojo.place(block, "game_play_area");

      this.fadeOutAndDestroy(e, 1000, 1000);
    },

    ///////////////////////////////////////////////////
    //// Game & client states
    // onEnteringState: this method is called each time we are entering into a new game state.
    //									You can use this method to perform some user interface changes at this moment.
    //
    onEnteringState: function (stateName, args) {
      debug("Entering state: " + stateName, args);
      // Call appropriate method
      var methodName = "onEnteringState" + stateName.charAt(0).toUpperCase() + stateName.slice(1);
      this.active_player = args.active_player;
      this.stateName = stateName;
      if (this[methodName] !== undefined) this[methodName](args.args);
    },

    onEnteringStateNewRound: function (args) {
      dojo.query(".pointcount").innerHTML("0");
      dojo.query(".cardback").style("display", "none");
      dojo.query(".mahjong_mini").innerHTML("");
      this.resetLastCombos();
      for (var id in this.gamedatas.players) {
        this.gamedatas.players[id].call_tichu = -1;
        this.gamedatas.players[id].call_grand_tichu = -1;
      }
      dojo.query(".whiteblock").removeClass("disabled");

      this.updateMahjongWish(0);
    },

    onEnteringStateGrandTichuBets: function (args) {
      this.resetLastCombos();
    },

    onEnteringStateGiveCards: function (args) {
      if (this.isSpectator) return;
      dojo.style("playertables", "display", "flex");
      dojo.style("card-last-played-area", "display", "none");
      dojo.query(".playertable").style("cursor", "pointer");
    },

    onEnteringStateShowPassedCards: function (args) {
      dojo.query(".handcount").innerHTML(14);
      if (args._private == undefined) return;
      dojo.style("playertables", "display", "flex");
      dojo.style("card-last-played-area", "display", "none");
      args._private.forEach((card, i) => {
        var x = this.cardwidth * (card.type_arg - 1);
        var y = this.cardheight * (card.type - 1);
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
      this.passedCards = args._private;
    },

    onEnteringStateNewTrick: function (args) {
      this.resetLastCombos();
      this.currentTrickCounter.setValue(0);
      this.gamedatas.currentTrick = [];
    },

    onEnteringStatePlayComboOpen: function (args) {
      dojo.query(".active").forEach((e) => e.classList.remove("active"));
      document.getElementById("playertable_" + this.active_player).classList.add("active");
    },

    onEnteringStateMahjongPlay: function (args) {
      if (this.isCurrentPlayerActive()) {
        dojo.style($("mahjongpanel"), "display", "block");
        this.mahjongValues.updateDisplay();
      }
      this.playerHand.unselectAll();
    },

    onEnteringStatePhoenixPlay: function (args) {
      if (this.isCurrentPlayerActive()) {
        dojo.style($("phoenixpanel"), "display", "block");
        this.allowedValues = args._private.values;
        // variante 1
        this.phoenixValues.removeAll();
        args._private.values.forEach((value) => {
          this.phoenixValues.addToStock(value - 2);
        });
        this.phoenixValues.updateDisplay();
        /* variante 2
				this.phoenixValues.updateDisplay();
				setTimeout(()=> {
					dojo.query('#phoenixChoice .stockitem').forEach(e => {
						var id = parseInt(e.id.substring(19));
						if(args._private.values.indexOf(id) < 0) {
							e.style.opacity = 0.5;
							e.style.cursor='default';
							e.style.filter ='grayscale(1)';
						} else {
							e.style.opacity = 1;
							e.style.cursor='pointer';
							e.style.filter ='unset';
						}
					});
				}, 1000);*/
      }
      this.playerHand.unselectAll();
    },

    onEnteringStatePlayCombo: function (args) {
      dojo.query(".active").forEach((e) => e.classList.remove("active"));
      document.getElementById("playertable_" + this.active_player).classList.add("active");
    },

    onEnteringStatePlayBomb: function (args) {
      document.getElementById("playertable_" + args.active).classList.add("active");
    },

    onEnteringStateChooseDragonGift: function (args) {
      if (!this.isCurrentPlayerActive()) return;

      const left = this.clockwise ? 0 : 1;
      const right = this.clockwise ? 1 : 0;
      this.addActionButton(
        "giveDragonBefore_button",
        _("Give cards to " + args.enemies[left]),
        () => this.onGiveDragon(left)
      );
      this.addActionButton(
        "giveDragonAfter_button",
        _("Give cards to " + args.enemies[right]),
        () => this.onGiveDragon(right)
      );
    },

    onEnteringStateEndRound: function (args) {
      this.playerHand.removeAll();
      this.enableAllPlayerPanels();
      this.cleanPlayersPanel();
    },

    onEnteringStateConfirmTrick: function (args) {
      dojo.query(".active").forEach((e) => e.classList.remove("active"));
      document.getElementById("playertable_" + this.active_player).classList.add("active");
    },

    // onLeavingState: this method is called each time we are leaving a game state.
    //								 You can use this method to perform some user interface changes at this moment.
    //
    onLeavingState: function (stateName) {
      console.log("Leaving state: " + stateName);
      dojo.query(".playertable").style("cursor", "unset");

      switch (stateName) {
        case "dummmy":
          break;
      }
    },

    // onUpdateActionButtons: in this method you can manage "action buttons" that are displayed in the
    //												action status bar (ie: the HTML links in the status bar).
    //
    onUpdateActionButtons: function (stateName, args) {
      console.log("onUpdateActionButtons: " + stateName);
      var player = this.gamedatas.players[this.player_id];
      this.removeActionButtons();
      this.removeMyActionButtons();
      if (this.isCurrentPlayerActive()) {
        switch (stateName) {
          case "giveCards":
            this.addActionButton(
              "resetPassCards_button",
              _("Reset choices"),
              "onResetPassCards",
              null,
              false,
              "gray"
            );
            this.addActionButton("passCards_button", _("Pass selected cards"), "onPassCards");
            break;
          case "showPassedCards":
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
            this.addTooltip(
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
            this.addMyActionButton(
              "myConfirmTrick",
              _("Collect"),
              () => this.collect(),
              "blue",
              "play_button"
            );
            if (this.gamedatas.hasBomb && this.gamedatas.mahjongWish == 0) {
              this.addMyActionButton(
                "myPlayBomb",
                _("Play a Bomb"),
                () => this.playCombo("playBomb"),
                "gray",
                "bomb_button"
              );
            }
        }
      } else if (
        !this.isSpectator &&
        (stateName == "playCombo" || stateName == "confirmTrick") &&
        this.playerHand.getAllItems().length > 0
      ) {
        if (player.pass < 2) {
          this.addMyActionButton(
            "myPassTrick",
            _("Auto-Pass this Trick"),
            () => this.onPass(false),
            "gray",
            "pass_trick_button"
          );
          this.addTooltip("myPassTrick", _("Automatically pass until the end of this trick."), "");
        }
        if (player.pass == 0) {
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
        if (player.pass > 0) {
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
        if (this.gamedatas.hasBomb && this.gamedatas.mahjongWish == 0) {
          this.addMyActionButton(
            "myPlayBomb",
            _("Play a Bomb"),
            () => this.playCombo("playBomb"),
            "gray",
            "bomb_button"
          );
        }
      }

      //tichus
      if (!this.isSpectator) {
        if (player.call_grand_tichu < 0) {
          this.addActionButton(
            "noBet",
            _("No bet"),
            () => this.onGrandTichuBet(0),
            null,
            false,
            "gray"
          );
          this.addTooltip("noBet", _("Don't call Grand Tichu"), "");
          this.addActionButton(
            "makeGTBet",
            _("Grand Tichu"),
            () => this.onGrandTichuBet(200),
            null,
            false,
            "red"
          );
          this.addTooltip("makeGTBet", _("Bet 200 Points, tha you will finish first"), "");
        }
        if (player.call_tichu < 0) {
          this.addMyActionButton(
            "myMakeTichuBet",
            _("Tichu"),
            () => this.onTichuBet(100),
            "green",
            "tichu_button"
          );
          this.addTooltip("myMakeTichuBet", _("Bet 100 Points, tha you will finish first"), "");
        }
      }
    },

    ///////////////////////////////////////////////////
    //// Utility methods

    resetLastCombos: function () {
      for (key in this.tableCombos) {
        this.tableCombos[key].removeAll();
        $("lastcombo_" + key).innerHTML = "";
        this.addTooltip("playertable_" + key, "", "");
        //$('playercomb_' + key).innerHTML = '';
      }
      dojo.query(".whiteblock").removeClass("lastComboPlayer");
    },

    // Clean all elements on the players panel
    cleanPlayersPanel: function () {
      dojo.query(".handcount").innerHTML(0);
      dojo.query(".pointcount").innerHTML(0);
      dojo.query(".grandtichublack").style("display", "inline-block");
      dojo.query(".tichublack").style("display", "inline-block");
      dojo.query(".grandtichucolor").style("display", "none");
      dojo.query(".tichucolor").style("display", "none");
      dojo.query(".firstoutcolor").style("display", "none");
      dojo.query(".cardback").style("display", "none");
    },

    getCardUniqueId: function (color, value) {
      // Get card unique identifier based on its color and value
      return (color - 1) * 14 + (value - 1);
    },

    getCardValueByTypeID: function (cardTypeID) {
      //get card value based on it's unique identifier
      return (cardTypeID % 14) + 1;
    },

    getCardColorByTypeID: function (cardTypeID) {
      //get card color based on it's unique identifier
      return Math.floor(cardTypeID / 14) + 1;
    },

    setPass: function (playerId) {
      var cardImgFile =
        this.prefs[103].value == 1 ? "img/tiki-icons-pass.png" : "img/tichu-icons-pass.png";
      var img = g_gamethemeurl + cardImgFile;
      $("lastcombo_" + playerId).innerHTML =
        "<span class = 'pass'> <img src='" +
        img +
        "' width='75px' height='112.5px' alt='pass'> </span>";
      $("cardback_" + playerId).style.display = "inline-block";
      this.setDescription(playerId, "Pass");
    },

    setupNewCard: function (card_div, card_type_id, card_id) {
      if (
        this.getCardValueByTypeID(card_type_id) == 10 ||
        this.getCardValueByTypeID(card_type_id) == 13
      )
        this.addTooltip(card_div.id, _("Scores 10 points"), "");
      if (this.getCardValueByTypeID(card_type_id) == 5)
        this.addTooltip(card_div.id, _("Scores 5 points"), "");
      if (card_type_id == 0)
        this.addTooltip(
          card_div.id,
          _("Highest single card. Scores 25 points. Trick given to an opponent if Dragon wins it."),
          ""
        );
      if (card_type_id == 14)
        this.addTooltip(
          card_div.id,
          _(
            " Scores -25 points. Takes the place of any normal card in a combo but not a bomb. As a Single, worth 1.5 when led, beats any other card but the Dragon by 0.5."
          ),
          ""
        );
      if (card_type_id == 28)
        this.addTooltip(
          card_div.id,
          _(
            "The Hound must be played as a leading single card. Player's partner (or the next one if he's gone out) can lead."
          ),
          ""
        );
      if (card_type_id == 42)
        this.addTooltip(
          card_div.id,
          _(
            "The Mahjong's owner starts. Worth 1. When played, owner may wish for a rank to be fulfilled by the next regular player if possible."
          ),
          ""
        );
    },

    cancelPhoenix: function () {
      dojo.style($("phoenixpanel"), "display", "none");
      this.takeAction("cancelPhoenix", {});
    },

    showCurrentTrick: function () {
      console.log("showTrick");
      var myDlg = new ebg.popindialog();
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
      this.gamedatas.currentTrick.forEach((card) =>
        stock.addToStockWithId(this.getCardUniqueId(card.type, card.type_arg), card.id)
      );
    },

    ///////////////////////////////////////////////////
    //// Player's action

    /*
     * giveCards
     * we push in cardsToPass each card to be given, one by one
     * we create the card to be placed in 'giveplayertable_direction'
     * we remove it from the player's hand and display the slide to 'giveplayertable_direction'
     */
    onPlayerHandSelectionChanged: function () {
      console.log("onPlayerHandSelectionChanged");
      if (!this.checkAction("giveCards", true)) return; //TRUE important to avoid errors
    },

    onGrandTichuBet: function (bet) {
      if (this.checkAction("grandTichuBet")) {
        console.log("onGrandTichuBet");
        this.takeAction("grandTichuBet", { bet: bet });
        this.removeActionButtons();
      }
    },

    onTichuBet: function (evt) {
      console.log("onTichuBet");
      this.takeAction("tichuBet", { bet: 100 });
      this.removeActionButtons();
    },

    onGiveCard: function (i) {
      debug("onGiveCard", i);
      if (!this.checkAction("giveCards", true)) return;
      var items = this.playerHand.getSelectedItems();
      var player_id = this.player_id;

      if (this.cardsToPass[i] == null) {
        if (items.length != 1) return;
        var card = items[0];
        this.cardsToPass[i] = card;
        var card_id = card.id;
        var value = this.getCardValueByTypeID(card.type);
        var color = this.getCardColorByTypeID(card.type);
        var x = this.cardwidth * (value - 1);
        var y = this.cardheight * (color - 1);
        var direction = i + 1;

        dojo.place(
          this.format_block("jstpl_cardontable", {
            // x,y = tichu-cards.png (css background-position)
            x: x,
            y: y,
            player_id: player_id,
            card_id: card_id,
          }),
          "giveplayertable_" + direction
        );

        if ($("myhand_item_" + card_id)) {
          this.playerHand.removeFromStockById(card_id);
        } else {
          console.log("Failed to remove card from hand");
        }
      } else {
        var card = this.cardsToPass[i];
        $("cardontable_" + player_id + "_" + card.id).remove();
        this.playerHand.addToStockWithId(card.type, card.id);
        this.cardsToPass[i] = null;
      }
      this.updateStockOverlap(this.playerHand);
    },

    onPassCards: function () {
      if (!this.checkAction("giveCards")) return;
      var items = this.cardsToPass;
      for (var i = 0; i < 3; i++)
        if (items[i] == null) {
          this.showMessage(_("You must select exactly 3 cards"), "error");
          return;
        }
      // Give these 3 cards
      var to_give = "";
      for (var i in items) {
        dojo.destroy("cardontable_" + this.player_id + "_" + items[i].id);
        to_give += items[i].id + ";";
      }

      if (this.selectionHandler) dojo.disconnect(this.selectionHandler);
      this.cardsToPass = [];
      this.takeAction("giveTheCards", { cards: to_give });
    },

    onAcceptCards: function () {
      if (!this.checkAction("acceptCards")) return;
      this.takeAction("acceptCards");
    },

    onMakeAWish: function (evt) {
      if (this.checkAction("makeAWish")) {
        console.log("onMakeAWish");
        var items = this.mahjongValues.getSelectedItems();
        if (items.length > 0) {
          evt.preventDefault();
          this.takeAction("makeAWish", { wish: items[0].id });
        }
      }
    },

    onChoosePhoenix: function (evt) {
      if (this.checkAction("phoenixPlay")) {
        console.log("onChoosePhoenix");
        var items = this.phoenixValues.getSelectedItems();
        if (items.length == 1) {
          if (this.allowedValues.indexOf(items[0].type + 2) < 0) return;
          dojo.style($("phoenixpanel"), "display", "none");
          evt.preventDefault();
          this.takeAction("choosePhoenix", { phoenixValue: items[0].type + 2 });
        }
      }
    },

    onReorderByRank: function (evt) {
      console.log("onReorderByRank");
      evt.preventDefault();
      var newWeights = {};
      for (var serie = 1; serie <= 4; serie++) {
        for (var value = 1; value <= 14; value++) {
          var card_type_id = this.getCardUniqueId(serie, value);
          newWeights[card_type_id] = 2 * (4 * (value - 1) + serie - 1);
        }
      }
      this.playerHand.changeItemsWeight(newWeights);
      dojo.style("order_by_rank", "display", "none");
      dojo.style("order_by_color", "display", "inline");
    },

    onReorderTable: function (square) {
      if (square) {
        $("game_play_area").classList.add("squareTable");
        dojo.style("square_table", "display", "none");
        dojo.style("list_table", "display", "inline");
      } else {
        $("game_play_area").classList.remove("squareTable");
        dojo.style("square_table", "display", "inline");
        dojo.style("list_table", "display", "none");
      }
    },

    changeOrder: function (clockwise) {
      if ($("list_table").style.display == "none") return;
      this.clockwise = clockwise;
      var left = dojo.query(".whiteblock.left")[0];
      var right = dojo.query(".whiteblock.right")[0];
      left.classList.remove("left");
      left.classList.add("right");
      right.classList.remove("right");
      right.classList.add("left");
      var playertables = [];
      for (var i = 1; i < 4; i++) {
        var e = dojo.query(".playertable_" + i)[0];
        e.remove();
        e.classList.remove("playertable_" + i);
        e.classList.add("playertable_" + (4 - i));
        playertables.push(e);
      }
      var parent = $("playertables");

      for (var i = 2; i >= 0; i--) parent.appendChild(playertables[i]);
      if (clockwise) {
        dojo.style("clockwise", "display", "none");
        dojo.style("counterClockwise", "display", "inline");
      } else {
        dojo.style("clockwise", "display", "inline");
        dojo.style("counterClockwise", "display", "none");
      }
    },

    onReorderByColor: function (evt) {
      console.log("onReorderByColor");
      evt.preventDefault();
      var newWeights = {};
      for (var serie = 1; serie <= 4; serie++) {
        for (var value = 1; value <= 14; value++) {
          var card_type_id = this.getCardUniqueId(serie, value);
          newWeights[card_type_id] =
            value == 1
              ? 2 * toint(card_type_id)
              : (newWeights[card_type_id] = 100 + 2 * toint(card_type_id));
        }
      }
      this.playerHand.changeItemsWeight(newWeights);

      dojo.style("order_by_rank", "display", "inline");
      dojo.style("order_by_color", "display", "none");
    },

    onResetPassCards: function () {
      if (!this.checkAction("giveCards")) return;
      var player_id = this.player_id;
      this.cardsToPass.forEach((card) => {
        if (card == null) return;
        $("cardontable_" + player_id + "_" + card.id).remove();
        this.playerHand.addToStockWithId(card.type, card.id);
      });
      this.cardsToPass = [null, null, null];
    },

    onGiveDragon: function (player) {
      this.takeAction("chooseDragonGift", { player: player });
    },

    playCombo: function (action) {
      console.log("onComboChoice");
      var selected = this.playerHand.getSelectedItems().map((card) => card.id);
      //if(selected.length == 0) return;
      this.takeAction(action, { cards: selected.join(";") });
    },

    // Note that is either normal pass or auto-pass depending on whose turn it is.
    onPass: function (onlyOnce) {
      debug("onPass", { onlyOnce: onlyOnce });
      if (this.prefs[102].value == 1 && this.playerHand.getSelectedItems().length > 0) {
        this.showMessage(
          _(
            "You have to unselect your cards first. (You can disable this safeguard in the user settings)"
          ),
          "error"
        );
        return;
      }
      this.takeAction("pass", { onlyOnce: onlyOnce });
    },

    cancelAutopass: function () {
      this.takeAction("cancelAutopass");
    },

    collect: function () {
      this.takeAction("collect");
    },

    takeAction: function (action, args = {}) {
      args.lock = true;
      this.ajaxcall("/tichu/tichu/" + action + ".html", args, this, function (res) {});
    },

    ///////////////////////////////////////////////////
    //// Reaction to cometD notifications

    /*
				setupNotifications:

				In this method, you associate each of your game notifications with your local method to handle it.

				Note: game notification names correspond to "notifyAllPlayers" and "notifyPlayer" calls in
							your tichu.game.php file.

		*/
    setupNotifications: function () {
      console.log("notifications subscriptions setup");

      // Make sure to read the documentation about "Synchronous Nnotifications" in the BGA Studio docs
      // before making any changes here.
      // Be aware that using `undefined` here means that you have to make abolutely sure that
      // `setSynchronousDuration` is called in your handler.
      // Also be aware that using 0 may completely break the flow and cause missed notifications.
      var notifs = [
        ["dealCards", 500],
        ["grandTichuBet", undefined],
        ["tichuBet", undefined],
        ["confirmTichu", 1],
        ["hasBomb", 1],
        ["playCombo", 300],
        ["wishMade", 200],
        ["mahjongWishGranted", 1],
        ["playerGoOut", 1],
        ["pass", 300],
        ["captureCards", 500],
        ["newScores", 1000],
        ["autopass", 1],
        ["acceptCards", 1000],
        ["passCards", 200],
      ];
      notifs.forEach((notif) => {
        dojo.subscribe(notif[0], this, "notif_" + notif[0]);
        this.notifqueue.setSynchronous(notif[0], notif[1]);
      });
    },

    notif_dealCards: function (notif) {
      debug("notif_dealCards", notif);
      notif.args.cards.forEach((card) => {
        this.playerHand.addToStockWithId(this.getCardUniqueId(card.type, card.type_arg), card.id);
      });
      this.updateStockOverlap(this.playerHand);
      var totalCards = notif.args.cards.length == 8 ? 8 : 14;
      dojo.query(".handcount").innerHTML(totalCards);
    },

    notif_grandTichuBet: function (notif) {
      // MUST call setSynchronousDuration
      debug("notif_grandTichuBet", notif);

      this.gamedatas.players[notif.args.player_id].call_grand_tichu = notif.args.bet;
      dojo.query(".grandtichublack." + notif.args.player_id).style("display", "none");
      if (notif.args.bet == 200) {
        this.gamedatas.players[notif.args.player_id].call_tichu = 0;
        dojo.query(".grandtichucolor." + notif.args.player_id).style("display", "inline-block");
        dojo.query(".tichublack." + notif.args.player_id).style("display", "none");
        this.animateIcon("grandtichucolor", notif.args.player_id);
        this.notifqueue.setSynchronousDuration(1000);
      } else {
        // If the notification was just a "this player has made no bet", then there is good reason
        // to freeze the UI for 1 second. 100 ms should be fine. Maybe 0 ms would also be ok.
        this.notifqueue.setSynchronousDuration(100);
      }

      this.onUpdateActionButtons(this.stateName, {});
    },

    notif_tichuBet: function (notif) {
      // MUST call setSynchronousDuration
      debug("notif_tichuBet", notif);

      this.gamedatas.players[notif.args.player_id].call_tichu = notif.args.bet;
      this.gamedatas.players[notif.args.player_id].call_grand_tichu = 0;
      dojo.query(".tichublack." + notif.args.player_id).style("display", "none");
      dojo.query(".grandtichublack." + notif.args.player_id).style("display", "none");
      if (notif.args.bet == 100) {
        dojo.query(".tichucolor." + notif.args.player_id).style("display", "inline-block");
        this.animateIcon("tichucolor", notif.args.player_id);
        this.notifqueue.setSynchronousDuration(1000);
      } else {
        // If the notification was just a "this player has made no bet" or "this player has already
        // played their first card, so cannot bet anymore", then there is no good reason
        // to freeze the UI for 1 second. 100 ms should be fine. Maybe 0 ms would also be ok.
        this.notifqueue.setSynchronousDuration(100);
      }

      this.onUpdateActionButtons(this.stateName, {});
    },

    notif_confirmTichu: function (notif) {
      debug("notif_confirmTichu", notif);
      this.titleSave = this.gamedatas.gamestate.descriptionmyturn;
      var s = notif.args.grand ? "grand " : "";
      this.gamedatas.gamestate.descriptionmyturn = notif.args.msg;
      this.updatePageTitle();
      this.removeActionButtons();
      this.addActionButton("cancelTichu", _("no " + s + "tichu"), () => {
        if (notif.args.grand) {
          this.onGrandTichuBet(0);
          return;
        }
        this.gamedatas.gamestate.descriptionmyturn = this.titleSave;
        this.updatePageTitle();
        this.onUpdateActionButtons();
      });
      this.addActionButton("confirmTichu", _("confirm"), () =>
        this.takeAction("confirmTichu", { bet: notif.args.grand ? 200 : 100 })
      );
    },

    notif_hasBomb: function (notif) {
      debug("notif_hasBomb", notif);
      this.gamedatas.hasBomb = notif.args.hasBomb;
    },

    notif_playCombo: function (notif) {
      debug("notif_playCombo", notif);

      var playerId = notif.args.player_id;
      this.resetComboStock(playerId);
      this.addCardsToStock(this.tableCombos[playerId], notif.args.cards, playerId);
      dojo.query("pass").innerHTML("");
      $("cardback_" + playerId).style.display = "none";
      this.setDescription(playerId, notif.args.combo_name);
      dojo.query(".handcount." + playerId).forEach((e) => {
        e.innerHTML = parseInt(e.innerHTML) - notif.args.cards.length;
      });
      dojo.query(".whiteblock").removeClass("lastComboPlayer");
      $("playertable_" + playerId).classList.add("lastComboPlayer");
      this.gamedatas.currentTrick.push(...notif.args.cards);
      this.currentTrickCounter.incValue(notif.args.points);
    },

    notif_wishMade: function (notif) {
      debug("notif_wishMade", notif);
      dojo.style($("mahjongpanel"), "display", "none");
      this.updateMahjongWish(notif.args.wish);
    },

    updateMahjongWish: function (wish) {
      const indicator = $("mahjongIndicator");
      if (wish > 0 && wish < 15) {
        var w = wish - 2;
        var x = w % 7;
        var y = (w - x) / 7;
        dojo.place(
          this.format_block("jstpl_mahjong", {
            value: wish,
            x: x * 100,
            y: y * 150,
          }),
          indicator
        );
        indicator.style.display = "block";
      } else {
        indicator.innerHTML = "";
        indicator.style.display = "none";
      }
    },

    notif_mahjongWishGranted: function (notif) {
      debug("notif_mahjongWishGranted", notif);
      this.updateMahjongWish(0);
    },

    notif_playerGoOut: function (notif) {
      debug("notif_playerGoOut", notif);
      if (notif.args.player_id == notif.args.firstout_id) {
        dojo.style($("firstoutcolor_" + notif.args.player_id), "display", "inline-block");
      }
      this.disablePlayerPanel(notif.args.player_id);
      $("playertable_" + notif.args.player_id).classList.add("disabled");
    },

    notif_pass: function (notif) {
      debug("notif_pass", notif);
      var playerId = notif.args.player_id;
      this.tableCombos[playerId].removeAll();
      this.setPass(playerId);
      dojo.query(".active").forEach((e) => e.classList.remove("active"));
      document.getElementById("playertable_" + notif.args.player_id).classList.add("active");
    },

    notif_captureCards: function (notif) {
      debug("notif_captureCards", notif);

      var playerId = notif.args.player_id;
      var trick_value = notif.args.trick_value;
      var old_score = parseInt($("pointcount_" + playerId).innerHTML);
      var new_score = old_score + trick_value;

      dojo.query(".pointcount." + playerId).innerHTML(new_score);
      dojo.query(".cardback").style("display", "none");
    },

    notif_newScores: function (notif) {
      debug("notif_newScores", notif);
      for (var player_id in notif.args.newScores) {
        this.scoreCtrl[player_id].toValue(notif.args.newScores[player_id]);
      }
    },

    notif_autopass: function (notif) {
      debug("notif_autopass", notif);
      if (this.stateName == "playComboOpen") {
        debug("ERROR", notif.debug);
      }
      if (!this.isSpectator) this.gamedatas.players[this.player_id].pass = notif.args.autopass;
      this.onUpdateActionButtons(this.stateName, {});
    },

    notif_acceptCards: function (notif) {
      debug("notif_acceptCards", notif);
      notif.args.cards.forEach((card) => {
        card_type = this.getCardUniqueId(card.type, card.type_arg);
        card_on_table = "cardontable_" + this.player_id + "_" + card.id;
        this.playerHand.addToStockWithId(card_type, card.id);
        this.slideToObjectAndDestroy(card_on_table, "myhand", 1000, 0);
      });
      this.updateStockOverlap(this.playerHand);

      setTimeout(function () {
        dojo.style("playertables", "display", "none");
        dojo.style("card-last-played-area", "display", "grid");
      }, 2000);
    },

    notif_passCards: function (notif) {
      debug("notif_passCards", notif);
      notif.args.forEach((card) => {
        this.playerHand.removeFromStockById(card);
      });
      this.updateStockOverlap(this.playerHand);
    },
  });
});
