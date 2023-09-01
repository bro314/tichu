"use strict";
define(["dojo", "dojo/_base/declare", "ebg/core/gamegui", "ebg/counter", "ebg/stock"], function (dojo, declare) {
    return declare("bgagame.tichu", ebg.core.gamegui, new Tichu());
});
var Bet;
(function (Bet) {
    // Player can still make a bet.
    Bet["NO_BET_YET"] = "-1";
    // Player cannot bet anymore.
    Bet["NO_BET"] = "0";
    Bet["TICHU"] = "100";
    Bet["GRAND_TICHU"] = "200";
})(Bet || (Bet = {}));
var Pass;
(function (Pass) {
    Pass["NO_BET"] = "0";
})(Pass || (Pass = {}));
var isDebug = window.location.host === "studio.boardgamearena.com";
var debug = isDebug ? console.log.bind(window.console) : function () { };
function cardToStockType(card) {
    return stockType(Number(card.type), Number(card.type_arg));
}
function stockType(color, value) {
    return (Number(color) - 1) * 14 + (Number(value) - 1);
}
function addCardToStock(stock, card) {
    stock === null || stock === void 0 ? void 0 : stock.addToStockWithId(cardToStockType(card), card.id);
}
function addItemToStock(stock, item) {
    stock.addToStockWithId(item.type, item.id);
}
var Tichu = /** @class */ (function () {
    function Tichu() {
        this.game = this;
        this.cardwidth = 100;
        this.cardheight = 150;
        this.cardChoiceWidth = 70;
        this.cardChoiceHeight = 105;
        this.cardsToPass = [];
        this.tableCombos = {};
        this.allLastCombos = {};
        this.clockwise = false;
        this.allowedValues = [];
    }
    Tichu.prototype.rescale = function () {
        var areaElement = document.getElementById("game_play_area");
        var areaWrapElement = document.getElementById("game_play_area_wrap");
        var widthAvailable = areaWrapElement.clientWidth;
        var heightAvailable = document.documentElement.clientHeight - 120;
        var widthMax = 1200;
        var widthMin = 900;
        var heightMin = 800;
        var widthFactor = Math.max(widthAvailable / widthMin, 0.4);
        var heightFactor = Math.max(heightAvailable / heightMin, 0.7);
        var factor = Math.min(widthFactor, heightFactor, 1.0);
        areaWrapElement.style.transform = "scale(".concat(factor, ")");
        areaWrapElement.style.transformOrigin = factor === 1.0 ? "top center" : "top left";
        areaElement.style.width = "".concat(Math.max(Math.min(widthAvailable / factor, widthMax), widthMin), "px");
    };
    Tichu.prototype.setup = function (gamedatas) {
        var _this = this;
        var _a, _b, _c;
        debug("SETUP", gamedatas);
        // Replaces BGA css zoom feature, which is not supported on Firefox.
        // The css zoom is disabled in tichu.css.
        new ResizeObserver(function () { return requestAnimationFrame(function () { return _this.rescale(); }); }).observe(document.getElementById("game_play_area_wrap"));
        window.addEventListener("resize", function () { return requestAnimationFrame(function () { return _this.rescale(); }); });
        var player_ids = new Array();
        for (var player_id in gamedatas.players) {
            player_ids.push(parseInt(player_id));
            if (gamedatas.handcount[player_id] === undefined)
                gamedatas.handcount[player_id] = 0;
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
        (_a = document
            .getElementById("overall-content")) === null || _a === void 0 ? void 0 : _a.classList.toggle("tiki", this.game.prefs[103].value == 1);
        this.updateMahjongWish(gamedatas.mahjongWish);
        if (gamedatas.firstoutplayer != 0) {
            dojo.style($("firstoutcolor_" + gamedatas.firstoutplayer), "display", "inline-block");
        }
        this.setupPlayerHand();
        this.mahjongValues = this.setupValueChoice("mahjong", 14);
        this.phoenixValues = this.setupValueChoice("phoenixChoice", 13);
        this.allLastCombos = gamedatas["allLastCombos"];
        this.displayLastCombos(player_ids, gamedatas["passes"]);
        Array.from($("playertables").children).forEach(function (el, i) {
            dojo.connect(el.children[0], "onclick", _this, function () { return _this.onGiveCard(i); });
        });
        this.setupNotifications();
        if (this.game.prefs[100].value == 2) {
            this.onReorderTable(true);
        }
        this.changeOrder(this.game.prefs[101].value != 1);
        this.setTheme((_c = (_b = this.game.prefs[104]) === null || _b === void 0 ? void 0 : _b.value) !== null && _c !== void 0 ? _c : 0);
        this.setupCurrentTrick();
        this.updateCardsPlayed();
        debug("Ending game setup");
    };
    Tichu.prototype.setupCurrentTrick = function () {
        this.roundCounter = new ebg.counter();
        this.roundCounter.create("roundCounter");
        this.roundCounter.setValue(this.game.gamedatas.round);
        this.trickCounter = new ebg.counter();
        this.trickCounter.create("trickCounter");
        this.trickCounter.setValue(this.game.gamedatas.trick);
        this.currentTrickCounter = new ebg.counter();
        this.currentTrickCounter.create("currentTrickCounter");
        this.currentTrickCounter.setValue(this.game.gamedatas.currentTrickValue);
    };
    Tichu.prototype.setupGameBoards = function (gamedatas) {
        for (var _i = 0, _a = Object.values(gamedatas.players); _i < _a.length; _i++) {
            var player = _a[_i];
            var player_id = player.id;
            var player_board_div = $("player_board_" + player_id);
            var isCurrent = player_id === this.game.player_id;
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
        dojo.query(".playertabletext").forEach(function (e) {
            var span = document.createElement("SPAN");
            span.innerText = _("Select a card and click here");
            e.appendChild(span);
        });
    };
    Tichu.prototype.setupPlayerHand = function () {
        var _this = this;
        this.playerHand = this.createStock($("myhand"), this.cardwidth, this.cardheight);
        for (var _i = 0, _a = this.game.gamedatas.hand; _i < _a.length; _i++) {
            var card = _a[_i];
            addCardToStock(this.playerHand, card);
        }
        this.updateStockOverlap(this.playerHand);
        var _loop_1 = function (themeNo) {
            dojo.connect($("theme".concat(themeNo)), "onclick", this_1, function (e) { return _this.setTheme(themeNo); });
        };
        var this_1 = this;
        for (var _b = 0, _c = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; _b < _c.length; _b++) {
            var themeNo = _c[_b];
            _loop_1(themeNo);
        }
        dojo.connect($("order_by_rank"), "onclick", this, function (e) { return _this.onReorderByRank(e); });
        dojo.connect($("order_by_color"), "onclick", this, function (e) { return _this.onReorderByColor(e); });
        dojo.connect($("list_table"), "onclick", this, function () { return _this.onReorderTable(false); });
        dojo.connect($("square_table"), "onclick", this, function () { return _this.onReorderTable(true); });
        dojo.connect($("clockwise"), "onclick", this, function () { return _this.changeOrder(true); });
        dojo.connect($("counterClockwise"), "onclick", this, function () { return _this.changeOrder(false); });
        this.game.addTooltipHtml("list_table", _("You can change this permanently in the user settings"));
        this.game.addTooltipHtml("square_table", _("You can change this permanently in the user settings"));
        this.game.addTooltipHtml("clockwise", _("This will affect the arrangement of the square table and the order of players when passing the cards.<br>You can change this permanently in the user settings"));
        this.game.addTooltipHtml("counterClockwise", _("This will affect the arrangement of the square table and the order of players when passing the cards.<br>You can change this permanently in the user settings"));
    };
    Tichu.prototype.setTheme = function (themeNo) {
        for (var _i = 0, _a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; _i < _a.length; _i++) {
            var n = _a[_i];
            document.body.classList.remove("theme".concat(n));
        }
        document.body.classList.add("theme".concat(themeNo));
    };
    Tichu.prototype.removeMyActionButtons = function () {
        var _a, _b, _c, _d, _e, _f;
        (_a = document.getElementById("trick_button")) === null || _a === void 0 ? void 0 : _a.replaceChildren();
        (_b = document.getElementById("bomb_button")) === null || _b === void 0 ? void 0 : _b.replaceChildren();
        (_c = document.getElementById("play_button")) === null || _c === void 0 ? void 0 : _c.replaceChildren();
        (_d = document.getElementById("pass_button")) === null || _d === void 0 ? void 0 : _d.replaceChildren();
        (_e = document.getElementById("pass_trick_button")) === null || _e === void 0 ? void 0 : _e.replaceChildren();
        (_f = document.getElementById("tichu_button")) === null || _f === void 0 ? void 0 : _f.replaceChildren();
        dojo.place(this.game.format_block("jstpl_my_hand", {}), $("play_button"), "only");
    };
    Tichu.prototype.addMyActionButton = function (id, label, method, color, dest) {
        var args = {
            id: id,
            label: label,
            addclass: "bgabutton bgabutton_".concat(color),
        };
        dojo.place(this.game.format_block("jstpl_my_action_button", args), dest, "only");
        dojo.connect($(id), "onclick", this, method);
    };
    Tichu.prototype.createStock = function (element, cardWidth, cardHeight) {
        var _this = this;
        var stock = new ebg.stock();
        stock.create(this, element, cardWidth, cardHeight);
        stock.setSelectionAppearance("class");
        stock.setOverlap(30, 0);
        new ResizeObserver(function () { return requestAnimationFrame(function () { return _this.updateStockOverlap(stock); }); }).observe(element);
        stock.image_items_per_row = 14;
        var cardImgFile = this.game.prefs[103].value == 1 ? "img/tiki-cards.png" : "img/tichu-cards.png";
        for (var color = 1; color <= 4; color++) {
            for (var value = 1; value <= 14; value++) {
                var type = stockType(color, value);
                var weight = 2 * (4 * (value - 1) + (color - 1));
                stock.addItemType(type, weight, g_gamethemeurl + cardImgFile, type);
                stock.onItemCreate = dojo.hitch(this, "setupNewCard");
            }
        }
        return stock;
    };
    /**
     * We would like the card overlap to depend on the width of the container element.
     * We have to make sure that this method gets called every time that the number of cards in a
     * stock changes or the size of the container element changes.
     *
     * We think it is useful to only allow overlap between 12% and 60%.
     */
    Tichu.prototype.updateStockOverlap = function (stock) {
        if (!stock)
            return;
        var availableWidthForOverlapPerItem = (stock.container_div.clientWidth - (stock.item_width + stock.item_margin)) /
            (stock.items.length - 1);
        var overlap = Math.floor(((availableWidthForOverlapPerItem - stock.item_margin - 1) / stock.item_width) * 100);
        if (overlap > 70)
            overlap = 70;
        if (overlap < 12)
            overlap = 12;
        stock.setOverlap(overlap, 0);
    };
    Tichu.prototype.setupValueChoice = function (idName, count) {
        var valueChoice = new ebg.stock();
        valueChoice.create(this.game, $(idName), this.cardChoiceWidth, this.cardChoiceHeight);
        valueChoice.setSelectionAppearance("class");
        valueChoice.setSelectionMode(1);
        valueChoice.image_items_per_row = 7;
        for (var value = 0; value < count; value++) {
            valueChoice.addItemType(value, value, g_gamethemeurl + "img/tichu-icons-table.png", value);
            valueChoice.addToStockWithId(value, String(value + 2));
        }
        return valueChoice;
    };
    Tichu.prototype.displayLastCombos = function (playerIds, passes) {
        var _this = this;
        if (this.allLastCombos === undefined)
            return;
        playerIds.forEach(function (playerId) {
            var _a;
            _this.resetComboStock(playerId);
            var combo = _this.allLastCombos[playerId];
            if (combo && ((_a = combo.cards) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                _this.addCardsToStock(_this.tableCombos[playerId], combo.cards);
                _this.setDescription(playerId, combo.description);
            }
            else if (passes.indexOf(playerId) >= 0) {
                _this.setPass(playerId);
            }
        });
    };
    Tichu.prototype.resetComboStock = function (playerId) {
        if (playerId in this.tableCombos) {
            this.tableCombos[playerId].removeAll();
        }
        else {
            this.tableCombos[playerId] = this.createStock($("lastcombo_" + playerId), this.cardwidth * 0.75, this.cardheight * 0.75);
            this.tableCombos[playerId].extraClasses = "smallCards";
            this.tableCombos[playerId].setSelectionMode(0);
        }
    };
    Tichu.prototype.setDescription = function (playerId, desc) {
        var translatedDesc = _(desc);
        this.game.addTooltipHtml("playertable_" + playerId, translatedDesc);
    };
    Tichu.prototype.addCardsToStock = function (stock, cards, playerId) {
        if (playerId === void 0) { playerId = null; }
        var weights = {};
        var i = 0;
        for (var _i = 0, cards_1 = cards; _i < cards_1.length; _i++) {
            var card = cards_1[_i];
            if (playerId === this.game.player_id) {
                this.playerHand.removeFromStockById(card.id);
            }
            addCardToStock(stock, card);
            weights[cardToStockType(card)] = i++;
        }
        stock.changeItemsWeight(weights);
        this.updateStockOverlap(this.playerHand);
        this.updateStockOverlap(stock);
    };
    Tichu.prototype.animateIcon = function (clazz, player_id) {
        var block = this.game.format_block("jstpl_temp", {
            clazz: clazz,
            id: player_id,
        });
        var e = dojo.place(block, "game_play_area");
        this.game.fadeOutAndDestroy(e, 1000, 1000);
    };
    Tichu.prototype.onEnteringState = function (stateName, stateObject) {
        debug("Entering state: " + stateName, stateObject);
        this.active_player = stateObject.active_player;
        this.stateName = stateName;
        if (stateName !== "confirmTrick") {
            clearTimeout(this.autoCollectTimeout);
        }
        if (stateName !== "showPassedCards") {
            clearTimeout(this.autoAcceptTimeout);
        }
        var methodName = "onEnteringState" + stateName.charAt(0).toUpperCase() + stateName.slice(1);
        var thisMethods = this;
        if (thisMethods[methodName] !== undefined)
            thisMethods[methodName](stateObject.args);
    };
    Tichu.prototype.onEnteringStateNewRound = function (args) {
        dojo.query(".pointcount").innerHTML("0");
        dojo.query(".cardback").style("display", "none");
        dojo.query(".mahjong_mini").innerHTML("");
        this.resetLastCombos();
        this.game.gamedatas.capturedCards = [];
        this.game.gamedatas.currentTrick = [];
        this.game.gamedatas.firstoutplayer = 0;
        for (var id in this.game.gamedatas.players) {
            this.game.gamedatas.players[id].call_tichu = Bet.NO_BET_YET;
            this.game.gamedatas.players[id].call_grand_tichu = Bet.NO_BET_YET;
        }
        dojo.query(".last-played-container").removeClass("disabled");
        this.roundCounter.incValue(1);
        this.updateMahjongWish(0);
    };
    Tichu.prototype.onEnteringStateGrandTichuBets = function (args) {
        this.resetLastCombos();
    };
    Tichu.prototype.onEnteringStateGiveCards = function (args) {
        if (this.game.isSpectator)
            return;
        dojo.style("playertables", "display", "flex");
        dojo.style("card-last-played-area", "display", "none");
        dojo.query(".playertable").style("cursor", "pointer");
    };
    Tichu.prototype.onEnteringStateShowPassedCards = function (args) {
        var _this = this;
        dojo.query(".handcount").innerHTML(14);
        if (args._private === undefined)
            return;
        dojo.style("playertables", "display", "flex");
        dojo.style("card-last-played-area", "display", "none");
        args._private.forEach(function (card, i) {
            var x = _this.cardwidth * (Number(card.type_arg) - 1);
            var y = _this.cardheight * (Number(card.type) - 1);
            dojo.place(_this.game.format_block("jstpl_cardontable", {
                x: x,
                y: y,
                player_id: card.location_arg,
                card_id: card.id,
            }), "receiveplayertable_" + card.passed_from);
        });
    };
    Tichu.prototype.onEnteringStateNewTrick = function (args) {
        var _a;
        this.resetLastCombos();
        this.currentTrickCounter.setValue(0);
        this.trickCounter.incValue(1);
        (_a = this.game.gamedatas.capturedCards).push.apply(_a, this.game.gamedatas.currentTrick);
        this.game.gamedatas.currentTrick = [];
    };
    Tichu.prototype.onEnteringStatePlayComboOpen = function (args) {
        var _a;
        dojo.query(".active").forEach(function (el) { return el.classList.remove("active"); });
        (_a = document.getElementById("playertable_" + this.active_player)) === null || _a === void 0 ? void 0 : _a.classList.add("active");
    };
    Tichu.prototype.onEnteringStateMahjongPlay = function (args) {
        if (this.game.isCurrentPlayerActive()) {
            dojo.style($("mahjongpanel"), "display", "block");
            this.mahjongValues.updateDisplay();
        }
        this.playerHand.unselectAll();
    };
    Tichu.prototype.onEnteringStatePhoenixPlay = function (args) {
        var _this = this;
        if (this.game.isCurrentPlayerActive()) {
            dojo.style($("phoenixpanel"), "display", "block");
            this.allowedValues = args._private.values;
            // variante 1
            this.phoenixValues.removeAll();
            args._private.values.forEach(function (value) {
                _this.phoenixValues.addToStock(value - 2);
            });
            this.phoenixValues.updateDisplay();
        }
        this.playerHand.unselectAll();
    };
    Tichu.prototype.onEnteringStatePlayCombo = function (args) {
        var _a;
        dojo.query(".active").forEach(function (el) { return el.classList.remove("active"); });
        (_a = document.getElementById("playertable_" + this.active_player)) === null || _a === void 0 ? void 0 : _a.classList.add("active");
    };
    Tichu.prototype.onEnteringStatePlayBomb = function (args) {
        var _a;
        (_a = document.getElementById("playertable_" + args.active)) === null || _a === void 0 ? void 0 : _a.classList.add("active");
    };
    Tichu.prototype.onEnteringStateChooseDragonGift = function (args) {
        var _this = this;
        if (!this.game.isCurrentPlayerActive())
            return;
        var left = this.clockwise ? 0 : 1;
        var right = this.clockwise ? 1 : 0;
        this.game.addActionButton("giveDragonBefore_button", _("Give cards to " + args.enemies[left]), function () { return _this.onGiveDragon(left); });
        this.game.addActionButton("giveDragonAfter_button", _("Give cards to " + args.enemies[right]), function () { return _this.onGiveDragon(right); });
    };
    Tichu.prototype.onEnteringStateEndRound = function (args) {
        this.playerHand.removeAll();
        this.game.enableAllPlayerPanels();
        this.cleanPlayersPanel();
    };
    Tichu.prototype.onEnteringStateConfirmTrick = function (args) {
        var _a;
        dojo.query(".active").forEach(function (el) { return el.classList.remove("active"); });
        (_a = document.getElementById("playertable_" + this.active_player)) === null || _a === void 0 ? void 0 : _a.classList.add("active");
    };
    Tichu.prototype.onLeavingState = function (stateName) {
        debug("Leaving state: " + stateName);
        dojo.query(".playertable").style("cursor", "unset");
    };
    Tichu.prototype.updateCardsPlayed = function () {
        var _a, _b, _c;
        var captured = this.game.gamedatas.capturedCards;
        for (var _i = 0, captured_1 = captured; _i < captured_1.length; _i++) {
            var card = captured_1[_i];
            var id = "playedCard_".concat(card.type, "_").concat(card.type_arg);
            (_a = document.getElementById(id)) === null || _a === void 0 ? void 0 : _a.classList.add("captured");
        }
        var trick = this.game.gamedatas.currentTrick;
        for (var _d = 0, trick_1 = trick; _d < trick_1.length; _d++) {
            var card = trick_1[_d];
            var id = "playedCard_".concat(card.type, "_").concat(card.type_arg);
            (_b = document.getElementById(id)) === null || _b === void 0 ? void 0 : _b.classList.add("trick");
        }
        var hand = this.game.gamedatas.hand;
        for (var _e = 0, hand_1 = hand; _e < hand_1.length; _e++) {
            var card = hand_1[_e];
            var id = "playedCard_".concat(card.type, "_").concat(card.type_arg);
            (_c = document.getElementById(id)) === null || _c === void 0 ? void 0 : _c.classList.add("hand");
        }
    };
    Tichu.prototype.onUpdateActionButtons = function (stateName, args) {
        var _this = this;
        debug("onUpdateActionButtons: " + stateName);
        var player = this.game.gamedatas.players[this.game.player_id];
        this.game.removeActionButtons();
        this.removeMyActionButtons();
        this.updateCardsPlayed();
        if (this.game.isCurrentPlayerActive()) {
            switch (stateName) {
                case "giveCards":
                    this.game.addActionButton("resetPassCards_button", _("Reset choices"), "onResetPassCards", null, false, "gray");
                    this.game.addActionButton("passCards_button", _("Pass selected cards"), "onPassCards");
                    break;
                case "showPassedCards":
                    clearTimeout(this.autoAcceptTimeout);
                    if (document.visibilityState === "visible") {
                        dojo.place(this.game.format_block("jstpl_auto_accept", {}), $("play_button"), "only");
                        clearTimeout(this.autoAcceptTimeout);
                        this.autoAcceptTimeout = setTimeout(function () { return _this.onAcceptCards(); }, 2000);
                    }
                    this.game.addActionButton("acceptCards_button", _("Accept cards"), "onAcceptCards");
                    break;
                case "mahjongPlay":
                    this.game.addActionButton("chooseWish", _("Make a wish"), "onMakeAWish");
                    break;
                case "phoenixPlay":
                    this.game.addActionButton("choosePhoenix", _("Choose a value for the Phoenix"), "onChoosePhoenix");
                    this.game.addActionButton("cancelPhoenix", _("Cancel"), "cancelPhoenix");
                    break;
                case "playComboOpen":
                    this.addMyActionButton("myPlayCombo", _("Play selected cards"), function () { return _this.playCombo("playCombo"); }, "blue", "play_button");
                    break;
                case "playCombo":
                    this.addMyActionButton("myPlayCombo", _("Play selected cards"), function () { return _this.playCombo("playCombo"); }, "blue", "play_button");
                    this.addMyActionButton("myPass", _("Pass"), function () { return _this.onPass(true); }, "red", "pass_button");
                    this.addMyActionButton("myPassTrick", _("Auto-Pass this Trick"), function () { return _this.onPass(false); }, "gray", "pass_trick_button");
                    this.game.addTooltip("myPassTrick", _("Automatically pass until the end of this trick."), "");
                    break;
                case "playBomb":
                    this.addMyActionButton("myPlayCombo", _("Play selected cards"), function () { return _this.playCombo("playCombo"); }, "blue", "play_button");
                    this.addMyActionButton("myCancel", _("Cancel"), function () { return _this.takeAction("cancel"); }, "red", "pass_button");
                    break;
                case "confirmTrick":
                    if (this.game.bRealtime) {
                        dojo.place(this.game.format_block("jstpl_auto_collect", {}), $("play_button"), "only");
                        clearTimeout(this.autoCollectTimeout);
                        this.autoCollectTimeout = setTimeout(function () { return _this.collect(); }, 2000);
                    }
                    else {
                        this.addMyActionButton("myConfirmTrick", _("Collect"), function () { return _this.collect(); }, "blue", "play_button");
                    }
                    // TODO: Bring back the "this.game.gamedatas.hasBomb" check, but only if the new game option was selected.
                    if (this.game.gamedatas.mahjongWish === 0) {
                        this.addMyActionButton("myPlayBomb", _("Play a Bomb"), function () { return _this.playCombo("playBomb"); }, "gray", "bomb_button");
                    }
            }
        }
        else if (!this.game.isSpectator &&
            (stateName === "playCombo" || stateName === "confirmTrick") &&
            this.playerHand.getAllItems().length > 0) {
            if (Number(player.pass) < 2) {
                this.addMyActionButton("myPassTrick", _("Auto-Pass this Trick"), function () { return _this.onPass(false); }, "gray", "pass_trick_button");
                this.game.addTooltip("myPassTrick", _("Automatically pass until the end of this trick."), "");
            }
            if (Number(player.pass) === 0) {
                this.addMyActionButton("myPassOnce", _("Auto-Pass once"), function () { return _this.onPass(true); }, "red", "pass_button");
                this.game.addTooltip("myPassOnce", _("Automatically pass next time(unless a new trick starts)"), "");
            }
            if (Number(player.pass) > 0) {
                this.addMyActionButton("myCancelAutopass", _("Cancel Auto-Pass"), function () { return _this.cancelAutopass(); }, "red", "pass_button");
                this.game.addTooltip("myCancelAutopass", _("You have chosen to automatically pass during this trick. Click to cancel"), "");
            }
            // TODO: Bring back the "this.game.gamedatas.hasBomb" check, but only if the new game option was selected.
            if (this.game.gamedatas.mahjongWish === 0) {
                this.addMyActionButton("myPlayBomb", _("Play a Bomb"), function () { return _this.playCombo("playBomb"); }, "gray", "bomb_button");
            }
        }
        if (!this.game.isSpectator) {
            if (player.call_grand_tichu === Bet.NO_BET_YET) {
                this.game.addActionButton("noBet", _("No bet"), function () { return _this.onGrandTichuBet(Bet.NO_BET); }, null, false, "gray");
                this.game.addTooltip("noBet", _("Don't call Grand Tichu"), "");
                this.game.addActionButton("makeGTBet", _("Grand Tichu"), function () { return _this.onGrandTichuBet(Bet.GRAND_TICHU); }, null, false, "red");
                this.game.addTooltip("makeGTBet", _("Bet 200 Points, tha you will finish first"), "");
            }
            if (player.call_tichu === Bet.NO_BET_YET && this.game.gamedatas.firstoutplayer == 0) {
                this.addMyActionButton("myMakeTichuBet", _("Tichu"), function () { return _this.onTichuBet(); }, "green", "tichu_button");
                this.game.addTooltip("myMakeTichuBet", _("Bet 100 Points, tha you will finish first"), "");
            }
        }
        if (this.game.gamedatas.currentTrick.length > 0) {
            this.addMyActionButton("myShowTrick", _("Show current trick"), function () { return _this.showCurrentTrick(); }, "gray", "trick_button");
        }
    };
    Tichu.prototype.resetLastCombos = function () {
        for (var _i = 0, _a = Object.entries(this.tableCombos); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], comboStock = _b[1];
            comboStock.removeAll();
            $("lastcombo_" + key).innerHTML = "";
            this.game.addTooltip("playertable_" + key, "", "");
        }
        dojo.query(".lastComboPlayer").removeClass("lastComboPlayer");
    };
    Tichu.prototype.cleanPlayersPanel = function () {
        dojo.query(".handcount").innerHTML(0);
        dojo.query(".pointcount").innerHTML(0);
        dojo.query(".grandtichublack").style("display", "inline-block");
        dojo.query(".tichublack").style("display", "inline-block");
        dojo.query(".grandtichucolor").style("display", "none");
        dojo.query(".tichucolor").style("display", "none");
        dojo.query(".firstoutcolor").style("display", "none");
        dojo.query(".cardback").style("display", "none");
    };
    Tichu.prototype.getCardValueByTypeID = function (cardTypeID) {
        //get card value based on it's unique identifier
        return (cardTypeID % 14) + 1;
    };
    Tichu.prototype.getCardColorByTypeID = function (cardTypeID) {
        //get card color based on it's unique identifier
        return Math.floor(cardTypeID / 14) + 1;
    };
    Tichu.prototype.setPass = function (playerId) {
        var cardImgFile = this.game.prefs[103].value == 1 ? "img/tiki-icons-pass.png" : "img/tichu-icons-pass.png";
        var img = g_gamethemeurl + cardImgFile;
        $("lastcombo_" + playerId).innerHTML =
            "<span class = 'pass'> <img src='" +
                img +
                "' width='75px' height='112.5px' alt='pass'> </span>";
        $("cardback_" + playerId).style.display = "inline-block";
        this.setDescription(playerId, "Pass");
    };
    Tichu.prototype.setupNewCard = function (card_div, card_type_id, card_id) {
        if (this.getCardValueByTypeID(card_type_id) === 10 ||
            this.getCardValueByTypeID(card_type_id) === 13)
            this.game.addTooltip(card_div.id, _("Scores 10 points"), "");
        if (this.getCardValueByTypeID(card_type_id) === 5)
            this.game.addTooltip(card_div.id, _("Scores 5 points"), "");
        if (card_type_id === 0)
            this.game.addTooltip(card_div.id, _("Highest single card. Scores 25 points. Trick given to an opponent if Dragon wins it."), "");
        if (card_type_id === 14)
            this.game.addTooltip(card_div.id, _("Scores -25 points. Takes the place of any normal card in a combo but not a bomb. As a Single, worth 1.5 when led, beats any other card but the Dragon by 0.5."), "");
        if (card_type_id === 28)
            this.game.addTooltip(card_div.id, _("The Hound must be played as a leading single card. Player's partner (or the next one if he's gone out) can lead."), "");
        if (card_type_id === 42)
            this.game.addTooltip(card_div.id, _("The Mahjong's owner starts. Worth 1. When played, owner may wish for a rank to be fulfilled by the next regular player if possible."), "");
    };
    Tichu.prototype.cancelPhoenix = function () {
        dojo.style($("phoenixpanel"), "display", "none");
        this.takeAction("cancelPhoenix", {});
    };
    Tichu.prototype.showCurrentTrick = function () {
        var myDlg = new ebg.popindialog();
        myDlg.create("myDialogCurrentTrick");
        myDlg.setTitle(_("Cards in current Trick"));
        myDlg.setContent('<div id="currentTrickCards"></div>');
        myDlg.show();
        var stock = this.createStock($("currentTrickCards"), this.cardwidth * 0.75, this.cardheight * 0.75);
        stock.extraClasses = "smallCards";
        stock.setSelectionMode(0);
        for (var _i = 0, _a = this.game.gamedatas.currentTrick; _i < _a.length; _i++) {
            var card = _a[_i];
            addCardToStock(stock, card);
        }
    };
    Tichu.prototype.onGrandTichuBet = function (bet) {
        debug("onGrandTichuBet");
        if (!this.game.checkAction("grandTichuBet"))
            return;
        this.takeAction("grandTichuBet", { bet: bet });
        this.game.removeActionButtons();
    };
    Tichu.prototype.onTichuBet = function () {
        debug("onTichuBet");
        // Note that we cannot check the action here, because it may not be the player's turn.
        // But you can call Tichu out of turn.
        this.takeAction("tichuBet", { bet: Bet.TICHU });
        this.game.removeActionButtons();
    };
    // client side action only
    Tichu.prototype.onGiveCard = function (i) {
        debug("onGiveCard", i);
        var items = this.playerHand.getSelectedItems();
        var player_id = this.game.player_id;
        var stockItem = this.cardsToPass[i];
        if (!stockItem) {
            if (items.length != 1)
                return;
            var card = items[0];
            this.cardsToPass[i] = card;
            var value = this.getCardValueByTypeID(card.type);
            var color = this.getCardColorByTypeID(card.type);
            var x = this.cardwidth * (value - 1);
            var y = this.cardheight * (color - 1);
            var direction = i + 1;
            dojo.place(this.game.format_block("jstpl_cardontable", {
                x: x,
                y: y,
                player_id: player_id,
                card_id: card.id,
            }), "giveplayertable_" + direction);
            if ($("myhand_item_" + card.id)) {
                this.playerHand.removeFromStockById(card.id);
            }
            else {
                debug("Failed to remove card from hand");
            }
        }
        else {
            $("cardontable_" + player_id + "_" + stockItem.id).remove();
            addItemToStock(this.playerHand, stockItem);
            this.cardsToPass[i] = undefined;
        }
        this.updateStockOverlap(this.playerHand);
    };
    // DANGER: The state action is named "giveCards", but the php action is "giveTheCards".
    Tichu.prototype.onPassCards = function () {
        debug("onPassCards");
        if (!this.game.checkAction("giveCards"))
            return;
        var items = this.cardsToPass;
        for (var i = 0; i < 3; i++) {
            if (!items[i]) {
                this.game.showMessage(_("You must select exactly 3 cards"), "error");
                return;
            }
        }
        var to_give = "";
        for (var i in items) {
            dojo.destroy("cardontable_" + this.game.player_id + "_" + items[i].id);
            to_give += items[i].id + ";";
        }
        this.cardsToPass = [];
        this.takeAction("giveTheCards", { cards: to_give });
    };
    Tichu.prototype.onAcceptCards = function () {
        debug("onAcceptCards");
        clearTimeout(this.autoAcceptTimeout);
        if (this.stateName !== "showPassedCards")
            return;
        this.takeAction("acceptCards");
    };
    Tichu.prototype.onMakeAWish = function (evt) {
        debug("onMakeAWish");
        if (!this.game.checkAction("makeAWish"))
            return;
        var items = this.mahjongValues.getSelectedItems();
        if (items.length > 0) {
            evt.preventDefault();
            this.takeAction("makeAWish", { wish: items[0].id });
        }
    };
    Tichu.prototype.onChoosePhoenix = function (evt) {
        debug("onChoosePhoenix");
        // It is a bit weird that the names "phoenixPlay" and "choosePhoenix" don't match.
        if (!this.game.checkAction("phoenixPlay"))
            return;
        var items = this.phoenixValues.getSelectedItems();
        if (items.length === 1) {
            if (this.allowedValues.indexOf(items[0].type + 2) < 0)
                return;
            dojo.style($("phoenixpanel"), "display", "none");
            evt.preventDefault();
            this.takeAction("choosePhoenix", { phoenixValue: items[0].type + 2 });
        }
    };
    // client side action only
    Tichu.prototype.onReorderByRank = function (evt) {
        debug("onReorderByRank");
        evt.preventDefault();
        var newWeights = {};
        for (var color = 1; color <= 4; color++) {
            for (var value = 1; value <= 14; value++) {
                var type = stockType(color, value);
                newWeights[type] = 2 * (4 * (value - 1) + color - 1);
            }
        }
        this.playerHand.changeItemsWeight(newWeights);
        dojo.style("order_by_rank", "display", "none");
        dojo.style("order_by_color", "display", "inline");
    };
    // client side action only
    Tichu.prototype.onReorderTable = function (square) {
        debug("onReorderTable");
        if (square) {
            $("game_play_area").classList.add("squareTable");
            dojo.style("square_table", "display", "none");
            dojo.style("list_table", "display", "inline");
        }
        else {
            $("game_play_area").classList.remove("squareTable");
            dojo.style("square_table", "display", "inline");
            dojo.style("list_table", "display", "none");
        }
    };
    // client side action only
    Tichu.prototype.changeOrder = function (clockwise) {
        debug("changeOrder ".concat(clockwise, " ").concat(this.game.prefs[101].value));
        this.clockwise = clockwise;
        $("game_play_area").classList.toggle("clockwise", clockwise);
    };
    // client side action only
    Tichu.prototype.onReorderByColor = function (evt) {
        debug("onReorderByColor");
        evt.preventDefault();
        var newWeights = {};
        for (var color = 1; color <= 4; color++) {
            for (var value = 1; value <= 14; value++) {
                var type = stockType(color, value);
                newWeights[type] = value === 1 ? 2 * type : (newWeights[type] = 100 + 2 * type);
            }
        }
        this.playerHand.changeItemsWeight(newWeights);
        dojo.style("order_by_rank", "display", "inline");
        dojo.style("order_by_color", "display", "none");
    };
    // client side action only
    Tichu.prototype.onResetPassCards = function () {
        debug("onResetPassCards");
        var player_id = this.game.player_id;
        for (var _i = 0, _a = this.cardsToPass; _i < _a.length; _i++) {
            var item = _a[_i];
            if (!item)
                continue;
            $("cardontable_" + player_id + "_" + item.id).remove();
            addItemToStock(this.playerHand, item);
        }
        this.cardsToPass = [];
    };
    Tichu.prototype.onGiveDragon = function (player) {
        debug("onGiveDragon");
        if (!this.game.checkAction("chooseDragonGift"))
            return;
        this.takeAction("chooseDragonGift", { player: player });
    };
    Tichu.prototype.playCombo = function (action) {
        debug("onPlayCombo");
        // Note that we cannot check the action here, because it may not be the player's turn.
        // But you can play a bomb out of turn.
        var selected = this.playerHand.getSelectedItems().map(function (stockItem) { return stockItem.id; });
        this.takeAction(action, { cards: selected.join(";") });
    };
    // Note that is either normal pass or auto-pass depending on whose turn it is.
    Tichu.prototype.onPass = function (onlyOnce) {
        debug("onPass", { onlyOnce: onlyOnce });
        // Note that we cannot check the action here, because it may not be the player's turn.
        // But you can auto-pass out of turn.
        if (this.game.prefs[102].value == 1 && this.playerHand.getSelectedItems().length > 0) {
            this.game.showMessage(_("You have to unselect your cards first. (You can disable this safeguard in the user settings)"), "error");
            return;
        }
        this.takeAction("pass", { onlyOnce: onlyOnce });
    };
    Tichu.prototype.cancelAutopass = function () {
        debug("onCancelAutopass");
        // Note that we cannot check the action here, because it may not be the player's turn.
        // But you can cancel auto-pass out of turn.
        this.takeAction("cancelAutopass");
    };
    Tichu.prototype.collect = function () {
        debug("onCollect");
        clearTimeout(this.autoCollectTimeout);
        if (!this.game.checkAction("collect"))
            return;
        this.takeAction("collect");
    };
    Tichu.prototype.takeAction = function (action, args) {
        if (args === void 0) { args = {}; }
        args.lock = true;
        this.game.ajaxcall("/tichu/tichu/" + action + ".html", args, this.game, function (res) { });
    };
    Tichu.prototype.setupNotifications = function () {
        debug("notifications subscriptions setup");
        // Make sure to read the documentation about "Synchronous Nnotifications" in the BGA Studio docs
        // before making any changes here.
        // Be aware that using `undefined` here means that you have to make abolutely sure that
        // `setSynchronousDuration` is called in your handler.
        // Also be aware that using 0 may completely break the flow and cause missed notifications.
        var notifs = {
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
        };
        for (var _i = 0, _a = Object.entries(notifs); _i < _a.length; _i++) {
            var _b = _a[_i], type = _b[0], duration = _b[1];
            dojo.subscribe(type, this, "notif_" + type);
            this.game.notifqueue.setSynchronous(type, duration);
        }
    };
    Tichu.prototype.notif_dealCards = function (notif) {
        debug("notif_dealCards", notif);
        for (var _i = 0, _a = notif.args.cards; _i < _a.length; _i++) {
            var card = _a[_i];
            this.game.gamedatas.hand.push(card);
            addCardToStock(this.playerHand, card);
        }
        this.updateStockOverlap(this.playerHand);
        var totalCards = notif.args.cards.length === 8 ? 8 : 14;
        dojo.query(".handcount").innerHTML(totalCards);
    };
    Tichu.prototype.notif_grandTichuBet = function (notif) {
        // MUST call setSynchronousDuration
        debug("notif_grandTichuBet", notif);
        var bet = String(notif.args.bet);
        this.game.gamedatas.players[notif.args.player_id].call_grand_tichu = bet;
        dojo.query(".grandtichublack." + notif.args.player_id).style("display", "none");
        if (bet === Bet.GRAND_TICHU) {
            this.game.gamedatas.players[notif.args.player_id].call_tichu = Bet.NO_BET;
            dojo.query(".grandtichucolor." + notif.args.player_id).style("display", "inline-block");
            dojo.query(".tichublack." + notif.args.player_id).style("display", "none");
            this.animateIcon("grandtichucolor", notif.args.player_id);
            playSound("tichu_laser");
            this.game.notifqueue.setSynchronousDuration(1000);
        }
        else {
            // If the notification was just a "this player has made no bet", then there is good reason
            // to freeze the UI for 1 second. 100 ms should be fine. Maybe 0 ms would also be ok.
            this.game.notifqueue.setSynchronousDuration(100);
        }
        this.onUpdateActionButtons(this.stateName, {});
    };
    Tichu.prototype.notif_tichuBet = function (notif) {
        // MUST call setSynchronousDuration
        debug("notif_tichuBet", notif);
        var bet = String(notif.args.bet);
        this.game.gamedatas.players[notif.args.player_id].call_tichu = bet;
        this.game.gamedatas.players[notif.args.player_id].call_grand_tichu = Bet.NO_BET;
        dojo.query(".tichublack." + notif.args.player_id).style("display", "none");
        dojo.query(".grandtichublack." + notif.args.player_id).style("display", "none");
        if (bet === Bet.TICHU) {
            dojo.query(".tichucolor." + notif.args.player_id).style("display", "inline-block");
            this.animateIcon("tichucolor", notif.args.player_id);
            playSound("tichu_laser");
            this.game.notifqueue.setSynchronousDuration(1000);
        }
        else {
            // If the notification was just a "this player has made no bet" or "this player has already
            // played their first card, so cannot bet anymore", then there is no good reason
            // to freeze the UI for 1 second. 100 ms should be fine. Maybe 0 ms would also be ok.
            this.game.notifqueue.setSynchronousDuration(100);
        }
        this.onUpdateActionButtons(this.stateName, {});
    };
    Tichu.prototype.notif_confirmTichu = function (notif) {
        var _this = this;
        debug("notif_confirmTichu", notif);
        var titleSave = this.game.gamedatas.gamestate.descriptionmyturn;
        var s = notif.args.grand ? "grand " : "";
        this.game.gamedatas.gamestate.descriptionmyturn = notif.args.msg;
        this.game.updatePageTitle();
        this.game.removeActionButtons();
        this.game.addActionButton("cancelTichu", _("no " + s + "tichu"), function () {
            if (notif.args.grand) {
                _this.onGrandTichuBet(Bet.NO_BET);
                return;
            }
            _this.game.gamedatas.gamestate.descriptionmyturn = titleSave;
            _this.game.updatePageTitle();
            _this.onUpdateActionButtons(_this.stateName, {});
        });
        this.game.addActionButton("confirmTichu", _("confirm"), function () {
            return _this.takeAction("confirmTichu", { bet: notif.args.grand ? Bet.GRAND_TICHU : Bet.TICHU });
        });
    };
    Tichu.prototype.notif_hasBomb = function (notif) {
        debug("notif_hasBomb", notif);
        this.game.gamedatas.hasBomb = notif.args.hasBomb;
    };
    Tichu.prototype.notif_playCombo = function (notif) {
        var _a;
        debug("notif_playCombo", notif);
        var playerId = Number(notif.args.player_id);
        this.resetComboStock(playerId);
        this.addCardsToStock(this.tableCombos[playerId], notif.args.cards, playerId);
        dojo.query("pass").innerHTML("");
        $("cardback_" + playerId).style.display = "none";
        this.setDescription(playerId, notif.args.combo_name);
        dojo.query(".handcount." + playerId).forEach(function (el) {
            el.innerHTML = String(parseInt(el.innerHTML) - notif.args.cards.length);
        });
        dojo.query(".lastComboPlayer").removeClass("lastComboPlayer");
        $("playertable_" + playerId).classList.add("lastComboPlayer");
        (_a = this.game.gamedatas.currentTrick).push.apply(_a, notif.args.cards);
        this.currentTrickCounter.incValue(notif.args.points);
    };
    Tichu.prototype.notif_wishMade = function (notif) {
        debug("notif_wishMade", notif);
        dojo.style($("mahjongpanel"), "display", "none");
        this.updateMahjongWish(notif.args.wish);
    };
    Tichu.prototype.updateMahjongWish = function (wish) {
        var indicator = $("mahjongIndicator");
        if (wish > 0 && wish < 15) {
            var w = wish - 2;
            var x = w % 7;
            var y = (w - x) / 7;
            dojo.place(this.game.format_block("jstpl_mahjong", {
                value: wish,
                x: x * 75,
                y: y * 112.5,
            }), indicator);
            indicator.style.display = "block";
        }
        else {
            indicator.innerHTML = "";
            indicator.style.display = "none";
        }
    };
    Tichu.prototype.notif_mahjongWishGranted = function (notif) {
        debug("notif_mahjongWishGranted", notif);
        this.updateMahjongWish(0);
    };
    Tichu.prototype.notif_playerGoOut = function (notif) {
        debug("notif_playerGoOut", notif);
        if (notif.args.player_id === notif.args.firstout_id) {
            this.game.gamedatas.firstoutplayer = notif.args.player_id;
            dojo.style($("firstoutcolor_" + notif.args.player_id), "display", "inline-block");
        }
        this.game.disablePlayerPanel(notif.args.player_id);
        $("playertable_" + notif.args.player_id).classList.add("disabled");
    };
    Tichu.prototype.notif_pass = function (notif) {
        var _a;
        debug("notif_pass", notif);
        var playerId = notif.args.player_id;
        this.tableCombos[playerId].removeAll();
        this.setPass(playerId);
        dojo.query(".active").forEach(function (el) { return el.classList.remove("active"); });
        (_a = document.getElementById("playertable_" + notif.args.player_id)) === null || _a === void 0 ? void 0 : _a.classList.add("active");
    };
    Tichu.prototype.notif_captureCards = function (notif) {
        debug("notif_captureCards", notif);
        var playerId = notif.args.player_id;
        var trick_value = notif.args.trick_value;
        var old_score = parseInt($("pointcount_" + playerId).innerHTML);
        var new_score = old_score + trick_value;
        dojo.query(".pointcount." + playerId).innerHTML(new_score);
        dojo.query(".cardback").style("display", "none");
    };
    Tichu.prototype.notif_newScores = function (notif) {
        debug("notif_newScores", notif);
        var newScores = notif.args.newScores;
        for (var player_id in newScores) {
            this.game.scoreCtrl[player_id].toValue(newScores[player_id]);
        }
    };
    Tichu.prototype.notif_autopass = function (notif) {
        debug("notif_autopass", notif);
        if (!this.game.isSpectator)
            this.game.gamedatas.players[this.game.player_id].pass = notif.args.autopass;
        this.onUpdateActionButtons(this.stateName, {});
    };
    Tichu.prototype.notif_acceptCards = function (notif) {
        debug("notif_acceptCards", notif);
        clearTimeout(this.autoAcceptTimeout);
        for (var _i = 0, _a = notif.args.cards; _i < _a.length; _i++) {
            var card = _a[_i];
            var cardOnTable = "cardontable_" + this.game.player_id + "_" + card.id;
            this.game.gamedatas.hand.push(card);
            addCardToStock(this.playerHand, card);
            this.game.slideToObjectAndDestroy(cardOnTable, "myhand", 500, 0);
        }
        this.updateStockOverlap(this.playerHand);
        setTimeout(function () {
            dojo.style("playertables", "display", "none");
            dojo.style("card-last-played-area", "display", "grid");
        }, 1000);
    };
    Tichu.prototype.notif_passCards = function (notif) {
        var _a;
        debug("notif_passCards", notif);
        // The format of the notification has changed. Let's be backwards compatible for a while.
        // Support for the old format can be removed in October 2023.
        // New format: notif.args.cardIds
        // Old format: notif.args
        var ids = (_a = notif.args.cardIds) !== null && _a !== void 0 ? _a : notif.args;
        var _loop_2 = function (id) {
            this_2.game.gamedatas.hand = this_2.game.gamedatas.hand.filter(function (c) { return c.id === id; });
            this_2.playerHand.removeFromStockById(id);
        };
        var this_2 = this;
        for (var _i = 0, ids_1 = ids; _i < ids_1.length; _i++) {
            var id = ids_1[_i];
            _loop_2(id);
        }
        this.updateStockOverlap(this.playerHand);
    };
    return Tichu;
}());
