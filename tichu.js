var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
define("util", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sayHello = void 0;
    function sayHello() {
        var playArea = document.getElementById("game_play_area");
        var div = document.createElement("div");
        div.innerText = "Hello!!!";
        playArea === null || playArea === void 0 ? void 0 : playArea.appendChild(div);
        var tiel = document.createElement("tichu-element");
        playArea === null || playArea === void 0 ? void 0 : playArea.appendChild(tiel);
    }
    exports.sayHello = sayHello;
});
define("bgagame/tichu", ["require", "exports", "ebg/core/gamegui", "util", "ebg/counter", "ebg/stock"], function (require, exports, Gamegui, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Bet;
    (function (Bet) {
        Bet["NO_BET_YET"] = "-1";
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
        stock === null || stock === void 0 ? void 0 : stock.addToStockWithId(cardToStockType(card), Number(card.id));
    }
    function addItemToStock(stock, item) {
        stock.addToStockWithId(item.type, Number(item.id));
    }
    function dojostyle(selector, attribute, value) {
        dojo.query(selector).style(attribute, value);
    }
    function dojohtml(selector, html) {
        dojo.query(selector).innerHTML(html);
    }
    var Tichu = (function (_super) {
        __extends(Tichu, _super);
        function Tichu() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.cardwidth = 100;
            _this.cardheight = 150;
            _this.cardChoiceWidth = 70;
            _this.cardChoiceHeight = 105;
            _this.cardsToPass = [];
            _this.tableCombos = {};
            _this.allLastCombos = {};
            _this.clockwise = false;
            _this.allowedValues = [];
            return _this;
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
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            debug("SETUP", gamedatas);
            new ResizeObserver(function () { return requestAnimationFrame(function () { return _this.rescale(); }); }).observe(document.getElementById("game_play_area_wrap"));
            window.addEventListener("resize", function () { return requestAnimationFrame(function () { return _this.rescale(); }); });
            (_a = $("game_play_area")) === null || _a === void 0 ? void 0 : _a.classList.toggle("isAllInfoExposed", this.isAllInfoExposed());
            var player_ids = new Array();
            for (var player_id in gamedatas.players) {
                player_ids.push(parseInt(player_id));
                if (gamedatas.handcount[player_id] === undefined)
                    gamedatas.handcount[player_id] = 0;
            }
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
            (_b = document
                .getElementById("overall-content")) === null || _b === void 0 ? void 0 : _b.classList.toggle("tiki", ((_c = this.prefs[103]) === null || _c === void 0 ? void 0 : _c.value) == 1);
            this.updateMahjongWish(gamedatas.mahjongWish);
            if (gamedatas.firstoutplayer != 0) {
                var firstout = $("firstoutcolor_" + gamedatas.firstoutplayer);
                if (firstout)
                    dojo.style(firstout, "display", "inline-block");
            }
            this.setupPlayerHand();
            this.mahjongValues = this.setupValueChoice("mahjong", 14);
            this.phoenixValues = this.setupValueChoice("phoenixChoice", 13);
            this.allLastCombos = gamedatas["allLastCombos"];
            this.displayLastCombos(player_ids, gamedatas["passes"]);
            Array.from((_e = (_d = $("playertables")) === null || _d === void 0 ? void 0 : _d.children) !== null && _e !== void 0 ? _e : []).forEach(function (el, i) {
                dojo.connect(el.children[0], "onclick", _this, function () { return _this.onGiveCard(i); });
            });
            this.setupNotifications();
            if (((_f = this.prefs[100]) === null || _f === void 0 ? void 0 : _f.value) == 2) {
                this.onReorderTable(true);
            }
            this.changeOrder(((_g = this.prefs[101]) === null || _g === void 0 ? void 0 : _g.value) != 1);
            this.setTheme((_j = (_h = this.prefs[104]) === null || _h === void 0 ? void 0 : _h.value) !== null && _j !== void 0 ? _j : 0);
            this.setupCurrentTrick();
            this.updateCardsPlayed();
            debug("before sayHello()");
            (0, util_1.sayHello)();
            debug("after sayHello()");
            debug("Ending game setup");
        };
        Tichu.prototype.isAllInfoExposed = function () {
            return this.gamedatas.isAllInfoExposed == 1;
        };
        Tichu.prototype.setupCurrentTrick = function () {
            this.roundCounter = new ebg.counter();
            this.roundCounter.create("roundCounter");
            this.roundCounter.setValue(this.gamedatas.round);
            this.trickCounter = new ebg.counter();
            this.trickCounter.create("trickCounter");
            this.trickCounter.setValue(this.gamedatas.trick);
            this.currentTrickCounter = new ebg.counter();
            this.currentTrickCounter.create("currentTrickCounter");
            this.currentTrickCounter.setValue(this.gamedatas.currentTrickValue);
        };
        Tichu.prototype.setupGameBoards = function (gamedatas) {
            var _a, _b;
            for (var _i = 0, _c = Object.values(gamedatas.players); _i < _c.length; _i++) {
                var player = _c[_i];
                var player_id = player.id;
                var player_board_div = $("player_board_" + player_id);
                var isCurrent = player_id === this.player_id;
                dojo.place(this.format_block("jstpl_player_board", player), player_board_div);
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
                dojo.query(".handcount." + player_id).innerHTML(gamedatas.handcount[player_id]);
                if (gamedatas.handcount[player_id] === 0) {
                    this.disablePlayerPanel(player_id);
                    (_a = $("playertable_" + player_id)) === null || _a === void 0 ? void 0 : _a.classList.add("disabled");
                }
                if (player_id === Number(gamedatas.lastComboPlayer)) {
                    (_b = $("playertable_" + player_id)) === null || _b === void 0 ? void 0 : _b.classList.add("lastComboPlayer");
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
            for (var _i = 0, _a = this.gamedatas.hand; _i < _a.length; _i++) {
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
            this.addTooltipHtml("list_table", _("You can change this permanently in the user settings"));
            this.addTooltipHtml("square_table", _("You can change this permanently in the user settings"));
            this.addTooltipHtml("clockwise", _("This will affect the arrangement of the square table and the order of players when passing the cards.<br>You can change this permanently in the user settings"));
            this.addTooltipHtml("counterClockwise", _("This will affect the arrangement of the square table and the order of players when passing the cards.<br>You can change this permanently in the user settings"));
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
            dojo.place(this.format_block("jstpl_my_hand", {}), $("play_button"), "only");
        };
        Tichu.prototype.addMyActionButton = function (id, label, method, color, dest) {
            var args = {
                id: id,
                label: label,
                addclass: "bgabutton bgabutton_".concat(color),
            };
            dojo.place(this.format_block("jstpl_my_action_button", args), dest, "only");
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
            var cardImgFile = this.prefs[103].value == 1 ? "img/tiki-cards.png" : "img/tichu-cards.png";
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
        Tichu.prototype.updateStockOverlap = function (stock) {
            if (!stock)
                return;
            var availableWidthForOverlapPerItem = (stock.container_div.clientWidth - (stock.item_width + stock.item_margin)) /
                (stock.items.length - 1);
            var overlap = Math.floor(((availableWidthForOverlapPerItem - stock.item_margin - 1) / stock.item_width) * 100);
            if (overlap > 60)
                overlap = 60;
            if (overlap < 12)
                overlap = 12;
            stock.setOverlap(overlap, 0);
        };
        Tichu.prototype.setupValueChoice = function (idName, count) {
            var valueChoice = new ebg.stock();
            valueChoice.create(this, $(idName), this.cardChoiceWidth, this.cardChoiceHeight);
            valueChoice.setSelectionAppearance("class");
            valueChoice.setSelectionMode(1);
            valueChoice.image_items_per_row = 7;
            for (var value = 0; value < count; value++) {
                valueChoice.addItemType(value, value, g_gamethemeurl + "img/tichu-icons-table.png", value);
                valueChoice.addToStockWithId(value, value + 2);
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
            this.addTooltipHtml("playertable_" + playerId, translatedDesc);
        };
        Tichu.prototype.addCardsToStock = function (stock, cards, playerId) {
            if (playerId === void 0) { playerId = null; }
            var weights = {};
            var i = 0;
            for (var _i = 0, cards_1 = cards; _i < cards_1.length; _i++) {
                var card = cards_1[_i];
                if (playerId === this.player_id) {
                    this.playerHand.removeFromStockById(Number(card.id));
                }
                addCardToStock(stock, card);
                weights[cardToStockType(card)] = i++;
            }
            stock.changeItemsWeight(weights);
            this.updateStockOverlap(this.playerHand);
            this.updateStockOverlap(stock);
        };
        Tichu.prototype.animateIcon = function (clazz, player_id) {
            var block = this.format_block("jstpl_temp", {
                clazz: clazz,
                id: player_id,
            });
            var e = dojo.place(block, "game_play_area");
            this.fadeOutAndDestroy(e, 1000, 1000);
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
            dojohtml(".pointcount", "0");
            dojostyle(".cardback", "display", "none");
            dojohtml(".mahjong_mini", "");
            this.resetLastCombos();
            this.gamedatas.capturedCards = [];
            this.gamedatas.hand = [];
            this.gamedatas.currentTrick = [];
            this.gamedatas.firstoutplayer = 0;
            for (var id in this.gamedatas.players) {
                this.gamedatas.players[id].call_tichu = Bet.NO_BET_YET;
                this.gamedatas.players[id].call_grand_tichu = Bet.NO_BET_YET;
            }
            dojo.query(".last-played-container").removeClass("disabled");
            this.roundCounter.incValue(1);
            this.updateMahjongWish(0);
        };
        Tichu.prototype.onEnteringStateGrandTichuBets = function (args) {
            this.resetLastCombos();
        };
        Tichu.prototype.onEnteringStateShowPassedCards = function (args) {
            this.showPassedCards(args);
        };
        Tichu.prototype.onEnteringStateAcceptPassedCards = function (args) {
            this.showPassedCards(args);
        };
        Tichu.prototype.showPassedCards = function (args) {
            var _this = this;
            dojohtml(".handcount", "14");
            if (args._private === undefined)
                return;
            args._private.forEach(function (card, i) {
                var x = _this.cardwidth * (Number(card.type_arg) - 1);
                var y = _this.cardheight * (Number(card.type) - 1);
                dojo.place(_this.format_block("jstpl_cardontable", {
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
            (_a = this.gamedatas.capturedCards).push.apply(_a, this.gamedatas.currentTrick);
            this.gamedatas.currentTrick = [];
        };
        Tichu.prototype.onEnteringStatePlayComboOpen = function (args) {
            var _a;
            dojo.query(".active").forEach(function (el) { return el.classList.remove("active"); });
            (_a = document.getElementById("playertable_" + this.active_player)) === null || _a === void 0 ? void 0 : _a.classList.add("active");
        };
        Tichu.prototype.onEnteringStateMahjongPlay = function (args) {
            if (this.isCurrentPlayerActive()) {
                dojostyle("#mahjongpanel", "display", "block");
                this.mahjongValues.updateDisplay("");
            }
            this.playerHand.unselectAll();
        };
        Tichu.prototype.onEnteringStatePhoenixPlay = function (args) {
            var _this = this;
            if (this.isCurrentPlayerActive()) {
                dojostyle("#phoenixpanel", "display", "block");
                this.allowedValues = args._private.values;
                this.phoenixValues.removeAll();
                args._private.values.forEach(function (value) {
                    _this.phoenixValues.addToStock(value - 2);
                });
                this.phoenixValues.updateDisplay("");
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
            if (!this.isCurrentPlayerActive())
                return;
            var left = this.clockwise ? 0 : 1;
            var right = this.clockwise ? 1 : 0;
            this.addActionButton("giveDragonBefore_button", _("Give cards to " + args.enemies[left]), function () {
                return _this.onGiveDragon(left);
            });
            this.addActionButton("giveDragonAfter_button", _("Give cards to " + args.enemies[right]), function () {
                return _this.onGiveDragon(right);
            });
        };
        Tichu.prototype.onEnteringStateEndRound = function (args) {
            this.playerHand.removeAll();
            this.enableAllPlayerPanels();
            this.cleanPlayersPanel();
        };
        Tichu.prototype.onEnteringStateConfirmTrick = function (args) {
            var _a;
            dojo.query(".active").forEach(function (el) { return el.classList.remove("active"); });
            (_a = document.getElementById("playertable_" + this.active_player)) === null || _a === void 0 ? void 0 : _a.classList.add("active");
        };
        Tichu.prototype.onLeavingState = function (stateName) {
            debug("Leaving state: " + stateName);
        };
        Tichu.prototype.updateCardsPlayed = function () {
            var _a, _b, _c, _d, _e, _f;
            if (!this.isAllInfoExposed())
                return;
            for (var color = 1; color <= 4; color++) {
                for (var value = 1; value <= 14; value++) {
                    var id = "playedCard_".concat(color, "_").concat(value);
                    (_a = document.getElementById(id)) === null || _a === void 0 ? void 0 : _a.classList.remove("captured");
                    (_b = document.getElementById(id)) === null || _b === void 0 ? void 0 : _b.classList.remove("trick");
                    (_c = document.getElementById(id)) === null || _c === void 0 ? void 0 : _c.classList.remove("hand");
                }
            }
            var captured = this.gamedatas.capturedCards;
            for (var _i = 0, captured_1 = captured; _i < captured_1.length; _i++) {
                var card = captured_1[_i];
                var id = "playedCard_".concat(card.type, "_").concat(card.type_arg);
                (_d = document.getElementById(id)) === null || _d === void 0 ? void 0 : _d.classList.add("captured");
            }
            var trick = this.gamedatas.currentTrick;
            for (var _g = 0, trick_1 = trick; _g < trick_1.length; _g++) {
                var card = trick_1[_g];
                var id = "playedCard_".concat(card.type, "_").concat(card.type_arg);
                (_e = document.getElementById(id)) === null || _e === void 0 ? void 0 : _e.classList.add("trick");
            }
            var hand = this.gamedatas.hand;
            for (var _h = 0, hand_1 = hand; _h < hand_1.length; _h++) {
                var card = hand_1[_h];
                var id = "playedCard_".concat(card.type, "_").concat(card.type_arg);
                (_f = document.getElementById(id)) === null || _f === void 0 ? void 0 : _f.classList.add("hand");
            }
        };
        Tichu.prototype.onUpdateActionButtons = function (stateName, args) {
            var _this = this;
            debug("onUpdateActionButtons: " + stateName);
            document
                .getElementById("game_play_area")
                .classList.toggle("isCurrentPlayerActive", this.isCurrentPlayerActive());
            var player = this.gamedatas.players[this.player_id];
            this.removeActionButtons();
            this.removeMyActionButtons();
            this.updateCardsPlayed();
            if (this.isCurrentPlayerActive()) {
                switch (stateName) {
                    case "giveCards":
                        this.addActionButton("resetPassCards_button", _("Reset choices"), "onResetPassCards", undefined, false, "gray");
                        this.addActionButton("passCards_button", _("Pass selected cards"), "onPassCards");
                        break;
                    case "showPassedCards":
                        clearTimeout(this.autoAcceptTimeout);
                        if (document.visibilityState === "visible") {
                            dojo.place(this.format_block("jstpl_auto_accept", {}), $("play_button"), "only");
                            clearTimeout(this.autoAcceptTimeout);
                            this.autoAcceptTimeout = setTimeout(function () { return _this.onAcceptCards(); }, 2000);
                        }
                        this.addActionButton("acceptCards_button", _("Accept cards"), "onAcceptCards");
                        break;
                    case "mahjongPlay":
                        this.addActionButton("chooseWish", _("Make a wish"), "onMakeAWish");
                        break;
                    case "phoenixPlay":
                        this.addActionButton("choosePhoenix", _("Choose a value for the Phoenix"), "onChoosePhoenix");
                        this.addActionButton("cancelPhoenix", _("Cancel"), "cancelPhoenix");
                        break;
                    case "playComboOpen":
                        this.addMyActionButton("myPlayCombo", _("Play selected cards"), function () { return _this.playCombo("playCombo"); }, "blue", "play_button");
                        break;
                    case "playCombo":
                        this.addMyActionButton("myPlayCombo", _("Play selected cards"), function () { return _this.playCombo("playCombo"); }, "blue", "play_button");
                        this.addMyActionButton("myPass", _("Pass"), function () { return _this.onPass(true); }, "red", "pass_button");
                        this.addMyActionButton("myPassTrick", _("Auto-Pass this Trick"), function () { return _this.onPass(false); }, "gray", "pass_trick_button");
                        this.addTooltip("myPassTrick", _("Automatically pass until the end of this trick."), "");
                        break;
                    case "playBomb":
                        this.addMyActionButton("myPlayCombo", _("Play selected cards"), function () { return _this.playCombo("playCombo"); }, "blue", "play_button");
                        this.addMyActionButton("myCancel", _("Cancel"), function () { return _this.takeAction("cancel"); }, "red", "pass_button");
                        break;
                    case "confirmTrick":
                        if (this.bRealtime) {
                            dojo.place(this.format_block("jstpl_auto_collect", {}), $("play_button"), "only");
                            clearTimeout(this.autoCollectTimeout);
                            this.autoCollectTimeout = setTimeout(function () { return _this.collect(); }, 2000);
                        }
                        else {
                            this.addMyActionButton("myConfirmTrick", _("Collect"), function () { return _this.collect(); }, "blue", "play_button");
                        }
                        this.addMyActionButton("myPlayBomb", _("Play a Bomb"), function () { return _this.playCombo("playBomb"); }, "gray", "bomb_button");
                }
            }
            else if (!this.isSpectator &&
                (stateName === "playCombo" || stateName === "confirmTrick") &&
                this.playerHand.getAllItems().length > 0) {
                if (Number(player.pass) < 2) {
                    this.addMyActionButton("myPassTrick", _("Auto-Pass this Trick"), function () { return _this.onPass(false); }, "gray", "pass_trick_button");
                    this.addTooltip("myPassTrick", _("Automatically pass until the end of this trick."), "");
                }
                if (Number(player.pass) === 0) {
                    this.addMyActionButton("myPassOnce", _("Auto-Pass once"), function () { return _this.onPass(true); }, "red", "pass_button");
                    this.addTooltip("myPassOnce", _("Automatically pass next time(unless a new trick starts)"), "");
                }
                if (Number(player.pass) > 0) {
                    this.addMyActionButton("myCancelAutopass", _("Cancel Auto-Pass"), function () { return _this.cancelAutopass(); }, "red", "pass_button");
                    this.addTooltip("myCancelAutopass", _("You have chosen to automatically pass during this trick. Click to cancel"), "");
                }
                this.addMyActionButton("myPlayBomb", _("Play a Bomb"), function () { return _this.playCombo("playBomb"); }, "gray", "bomb_button");
            }
            if (!this.isSpectator) {
                if (player.call_grand_tichu === Bet.NO_BET_YET) {
                    this.addActionButton("noBet", _("No bet"), function () { return _this.onGrandTichuBet(Bet.NO_BET); }, undefined, false, "gray");
                    this.addTooltip("noBet", _("Don't call Grand Tichu"), "");
                    this.addActionButton("makeGTBet", _("Grand Tichu"), function () { return _this.onGrandTichuBet(Bet.GRAND_TICHU); }, undefined, false, "red");
                    this.addTooltip("makeGTBet", _("Bet 200 Points, tha you will finish first"), "");
                }
                if (player.call_tichu === Bet.NO_BET_YET && this.gamedatas.firstoutplayer == 0) {
                    this.addMyActionButton("myMakeTichuBet", _("Tichu"), function () { return _this.onTichuBet(); }, "green", "tichu_button");
                    this.addTooltip("myMakeTichuBet", _("Bet 100 Points, tha you will finish first"), "");
                }
            }
            if (this.gamedatas.currentTrick.length > 0) {
                this.addMyActionButton("myShowTrick", _("Show current trick"), function () { return _this.showCurrentTrick(); }, "gray", "trick_button");
            }
        };
        Tichu.prototype.resetLastCombos = function () {
            for (var _i = 0, _a = Object.entries(this.tableCombos); _i < _a.length; _i++) {
                var _b = _a[_i], key = _b[0], comboStock = _b[1];
                comboStock.removeAll();
                $("lastcombo_" + key).innerHTML = "";
                this.addTooltip("playertable_" + key, "", "");
            }
            dojo.query(".lastComboPlayer").removeClass("lastComboPlayer");
        };
        Tichu.prototype.cleanPlayersPanel = function () {
            dojohtml(".handcount", "0");
            dojohtml(".pointcount", "0");
            dojostyle(".grandtichublack", "display", "inline-block");
            dojostyle(".tichublack", "display", "inline-block");
            dojostyle(".grandtichucolor", "display", "none");
            dojostyle(".tichucolor", "display", "none");
            dojostyle(".firstoutcolor", "display", "none");
            dojostyle(".cardback", "display", "none");
        };
        Tichu.prototype.getCardValueByTypeID = function (cardTypeID) {
            return (cardTypeID % 14) + 1;
        };
        Tichu.prototype.getCardColorByTypeID = function (cardTypeID) {
            return Math.floor(cardTypeID / 14) + 1;
        };
        Tichu.prototype.setPass = function (playerId) {
            var cardImgFile = this.prefs[103].value == 1 ? "img/tiki-icons-pass.png" : "img/tichu-icons-pass.png";
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
                this.addTooltip(card_div.id, _("Scores 10 points"), "");
            if (this.getCardValueByTypeID(card_type_id) === 5)
                this.addTooltip(card_div.id, _("Scores 5 points"), "");
            if (card_type_id === 0)
                this.addTooltip(card_div.id, _("Highest single card. Scores 25 points. Trick given to an opponent if Dragon wins it."), "");
            if (card_type_id === 14)
                this.addTooltip(card_div.id, _("Scores -25 points. Takes the place of any normal card in a combo but not a bomb. As a Single, worth 1.5 when led, beats any other card but the Dragon by 0.5."), "");
            if (card_type_id === 28)
                this.addTooltip(card_div.id, _("The Hound must be played as a leading single card. Player's partner (or the next one if he's gone out) can lead."), "");
            if (card_type_id === 42)
                this.addTooltip(card_div.id, _("The Mahjong's owner starts. Worth 1. When played, owner may wish for a rank to be fulfilled by the next regular player if possible."), "");
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
            for (var _i = 0, _a = this.gamedatas.currentTrick; _i < _a.length; _i++) {
                var card = _a[_i];
                addCardToStock(stock, card);
            }
        };
        Tichu.prototype.onGrandTichuBet = function (bet) {
            debug("onGrandTichuBet");
            if (!this.checkAction("grandTichuBet"))
                return;
            this.takeAction("grandTichuBet", { bet: bet });
            this.removeActionButtons();
        };
        Tichu.prototype.onTichuBet = function () {
            debug("onTichuBet");
            this.takeAction("tichuBet", { bet: Bet.TICHU });
            this.removeActionButtons();
        };
        Tichu.prototype.onGiveCard = function (i) {
            debug("onGiveCard", i);
            if (this.stateName !== "giveCards")
                return;
            if (!this.isCurrentPlayerActive())
                return;
            var items = this.playerHand.getSelectedItems();
            var player_id = this.player_id;
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
                dojo.place(this.format_block("jstpl_cardontable", {
                    x: x,
                    y: y,
                    player_id: player_id,
                    card_id: card.id,
                }), "giveplayertable_" + direction);
                if ($("myhand_item_" + card.id)) {
                    this.playerHand.removeFromStockById(Number(card.id));
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
        Tichu.prototype.onPassCards = function () {
            debug("onPassCards");
            if (!this.checkAction("giveCards"))
                return;
            var items = this.cardsToPass;
            for (var i = 0; i < 3; i++) {
                if (!items[i]) {
                    this.showMessage(_("You must select exactly 3 cards"), "error");
                    return;
                }
            }
            var to_give = "";
            for (var i in items) {
                dojo.destroy("cardontable_" + this.player_id + "_" + items[i].id);
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
            if (!this.checkAction("makeAWish"))
                return;
            var items = this.mahjongValues.getSelectedItems();
            if (items.length > 0) {
                evt.preventDefault();
                this.takeAction("makeAWish", { wish: items[0].id });
            }
        };
        Tichu.prototype.onChoosePhoenix = function (evt) {
            debug("onChoosePhoenix");
            if (!this.checkAction("phoenixPlay"))
                return;
            var items = this.phoenixValues.getSelectedItems();
            if (items.length === 1) {
                if (this.allowedValues.indexOf(items[0].type + 2) < 0)
                    return;
                dojostyle("#phoenixpanel", "display", "none");
                evt.preventDefault();
                this.takeAction("choosePhoenix", { phoenixValue: items[0].type + 2 });
            }
        };
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
        Tichu.prototype.changeOrder = function (clockwise) {
            debug("changeOrder ".concat(clockwise, " ").concat(this.prefs[101].value));
            this.clockwise = clockwise;
            $("game_play_area").classList.toggle("clockwise", clockwise);
        };
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
        Tichu.prototype.onResetPassCards = function () {
            debug("onResetPassCards");
            var player_id = this.player_id;
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
            if (!this.checkAction("chooseDragonGift"))
                return;
            this.takeAction("chooseDragonGift", { player: player });
        };
        Tichu.prototype.playCombo = function (action) {
            debug("onPlayCombo");
            var selected = this.playerHand.getSelectedItems().map(function (stockItem) { return stockItem.id; });
            this.takeAction(action, { cards: selected.join(";") });
        };
        Tichu.prototype.onPass = function (onlyOnce) {
            debug("onPass", { onlyOnce: onlyOnce });
            if (this.prefs[102].value == 1 && this.playerHand.getSelectedItems().length > 0) {
                this.showMessage(_("You have to unselect your cards first. (You can disable this safeguard in the user settings)"), "error");
                return;
            }
            this.takeAction("pass", { onlyOnce: onlyOnce });
        };
        Tichu.prototype.cancelAutopass = function () {
            debug("onCancelAutopass");
            this.takeAction("cancelAutopass");
        };
        Tichu.prototype.collect = function () {
            debug("onCollect");
            clearTimeout(this.autoCollectTimeout);
            if (!this.checkAction("collect"))
                return;
            this.takeAction("collect");
        };
        Tichu.prototype.takeAction = function (action, args) {
            if (args === void 0) { args = {}; }
            args.lock = true;
            this.ajaxcall("/tichu/tichu/" + action + ".html", args, this, function () { });
        };
        Tichu.prototype.setupNotifications = function () {
            debug("notifications subscriptions setup");
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
                acceptCards: 3000,
                passCards: 200,
                devConsole: 1,
            };
            for (var _i = 0, _a = Object.entries(notifs); _i < _a.length; _i++) {
                var _b = _a[_i], type = _b[0], duration = _b[1];
                dojo.subscribe(type, this, "notif_" + type);
                this.notifqueue.setSynchronous(type, duration);
            }
        };
        Tichu.prototype.notif_devConsole = function (notif) {
            debug("notif_devConsole", notif);
            window.console.log("DEV NOTIF: ".concat(notif.args.msg));
        };
        Tichu.prototype.notif_dealCards = function (notif) {
            debug("notif_dealCards", notif);
            for (var _i = 0, _a = notif.args.cards; _i < _a.length; _i++) {
                var card = _a[_i];
                this.gamedatas.hand.push(card);
                addCardToStock(this.playerHand, card);
            }
            this.updateStockOverlap(this.playerHand);
            var totalCards = notif.args.cards.length === 8 ? 8 : 14;
            dojohtml(".handcount", "".concat(totalCards));
        };
        Tichu.prototype.notif_grandTichuBet = function (notif) {
            debug("notif_grandTichuBet", notif);
            var bet = String(notif.args.bet);
            this.gamedatas.players[notif.args.player_id].call_grand_tichu = bet;
            dojostyle(".grandtichublack." + notif.args.player_id, "display", "none");
            if (bet === Bet.GRAND_TICHU) {
                this.gamedatas.players[notif.args.player_id].call_tichu = Bet.NO_BET;
                dojostyle(".grandtichucolor." + notif.args.player_id, "display", "inline-block");
                dojostyle(".tichublack." + notif.args.player_id, "display", "none");
                this.animateIcon("grandtichucolor", notif.args.player_id);
                playSound("tichu_laser");
                this.notifqueue.setSynchronousDuration(1000);
            }
            else {
                this.notifqueue.setSynchronousDuration(100);
            }
            this.onUpdateActionButtons(this.stateName, {});
        };
        Tichu.prototype.notif_tichuBet = function (notif) {
            debug("notif_tichuBet", notif);
            var bet = String(notif.args.bet);
            this.gamedatas.players[notif.args.player_id].call_tichu = bet;
            this.gamedatas.players[notif.args.player_id].call_grand_tichu = Bet.NO_BET;
            dojostyle(".tichublack." + notif.args.player_id, "display", "none");
            dojostyle(".grandtichublack." + notif.args.player_id, "display", "none");
            if (bet === Bet.TICHU) {
                dojostyle(".tichucolor." + notif.args.player_id, "display", "inline-block");
                this.animateIcon("tichucolor", notif.args.player_id);
                playSound("tichu_laser");
                this.notifqueue.setSynchronousDuration(1000);
            }
            else {
                this.notifqueue.setSynchronousDuration(100);
            }
            this.onUpdateActionButtons(this.stateName, {});
        };
        Tichu.prototype.notif_confirmTichu = function (notif) {
            var _this = this;
            debug("notif_confirmTichu", notif);
            var titleSave = this.gamedatas.gamestate.descriptionmyturn;
            var s = notif.args.grand ? "grand " : "";
            this.gamedatas.gamestate.descriptionmyturn = notif.args.msg;
            this.updatePageTitle();
            this.removeActionButtons();
            this.addActionButton("cancelTichu", _("no " + s + "tichu"), function () {
                if (notif.args.grand) {
                    _this.onGrandTichuBet(Bet.NO_BET);
                    return;
                }
                _this.gamedatas.gamestate.descriptionmyturn = titleSave;
                _this.updatePageTitle();
                _this.onUpdateActionButtons(_this.stateName, {});
            });
            this.addActionButton("confirmTichu", _("confirm"), function () {
                return _this.takeAction("confirmTichu", { bet: notif.args.grand ? Bet.GRAND_TICHU : Bet.TICHU });
            });
        };
        Tichu.prototype.notif_hasBomb = function (notif) {
            debug("notif_hasBomb", notif);
            this.gamedatas.hasBomb = notif.args.hasBomb;
        };
        Tichu.prototype.notif_playCombo = function (notif) {
            var _a;
            debug("notif_playCombo", notif);
            var playerId = Number(notif.args.player_id);
            this.resetComboStock(playerId);
            this.addCardsToStock(this.tableCombos[playerId], notif.args.cards, playerId);
            dojohtml("pass", "");
            $("cardback_" + playerId).style.display = "none";
            this.setDescription(playerId, notif.args.combo_name);
            dojo.query(".handcount." + playerId).forEach(function (node) {
                var el = node;
                el.innerHTML = String(parseInt(el.innerHTML) - notif.args.cards.length);
            });
            dojo.query(".lastComboPlayer").removeClass("lastComboPlayer");
            $("playertable_" + playerId).classList.add("lastComboPlayer");
            (_a = this.gamedatas.currentTrick).push.apply(_a, notif.args.cards);
            this.currentTrickCounter.incValue(notif.args.points);
        };
        Tichu.prototype.notif_wishMade = function (notif) {
            debug("notif_wishMade", notif);
            dojostyle("#mahjongpanel", "display", "none");
            this.updateMahjongWish(notif.args.wish);
        };
        Tichu.prototype.updateMahjongWish = function (wish) {
            var indicator = $("mahjongIndicator");
            if (wish > 0 && wish < 15) {
                var w = wish - 2;
                var x = w % 7;
                var y = (w - x) / 7;
                dojo.place(this.format_block("jstpl_mahjong", {
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
                this.gamedatas.firstoutplayer = notif.args.player_id;
                dojo.style($("firstoutcolor_" + notif.args.player_id), "display", "inline-block");
            }
            this.disablePlayerPanel(notif.args.player_id);
            $("playertable_" + notif.args.player_id).classList.add("disabled");
        };
        Tichu.prototype.notif_pass = function (notif) {
            var _a;
            debug("notif_pass", notif);
            var playerId = notif.args.player_id;
            this.tableCombos[playerId].removeAll();
            this.setPass(playerId);
            dojo.query(".active").forEach(function (node) {
                var el = node;
                el.classList.remove("active");
            });
            (_a = document.getElementById("playertable_" + notif.args.player_id)) === null || _a === void 0 ? void 0 : _a.classList.add("active");
        };
        Tichu.prototype.notif_captureCards = function (notif) {
            debug("notif_captureCards", notif);
            var playerId = notif.args.player_id;
            var trick_value = notif.args.trick_value;
            var old_score = parseInt($("pointcount_" + playerId).innerHTML);
            var new_score = old_score + trick_value;
            dojohtml(".pointcount." + playerId, "".concat(new_score));
            dojostyle(".cardback", "display", "none");
        };
        Tichu.prototype.notif_newScores = function (notif) {
            debug("notif_newScores", notif);
            var newScores = notif.args.newScores;
            for (var player_id in newScores) {
                this.scoreCtrl[player_id].toValue(newScores[player_id]);
            }
        };
        Tichu.prototype.notif_autopass = function (notif) {
            debug("notif_autopass", notif);
            if (!this.isSpectator)
                this.gamedatas.players[this.player_id].pass = notif.args.autopass;
            this.onUpdateActionButtons(this.stateName, {});
        };
        Tichu.prototype.notif_acceptCards = function (notif) {
            var _this = this;
            debug("notif_acceptCards", notif);
            clearTimeout(this.autoAcceptTimeout);
            setTimeout(function () {
                for (var _i = 0, _a = notif.args.cards; _i < _a.length; _i++) {
                    var card = _a[_i];
                    var cardOnTable = "cardontable_" + _this.player_id + "_" + card.id;
                    _this.gamedatas.hand.push(card);
                    addCardToStock(_this.playerHand, card);
                    _this.slideToObjectAndDestroy(cardOnTable, "myhand", 500, 0);
                }
                _this.updateStockOverlap(_this.playerHand);
            }, 2000);
        };
        Tichu.prototype.notif_passCards = function (notif) {
            var _a;
            debug("notif_passCards", notif);
            var ids = (_a = notif.args.cardIds) !== null && _a !== void 0 ? _a : notif.args;
            var _loop_2 = function (id) {
                this_2.gamedatas.hand = this_2.gamedatas.hand.filter(function (c) { return c.id !== id; });
                this_2.playerHand.removeFromStockById(Number(id));
            };
            var this_2 = this;
            for (var _i = 0, ids_1 = ids; _i < ids_1.length; _i++) {
                var id = ids_1[_i];
                _loop_2(id);
            }
            this.updateStockOverlap(this.playerHand);
        };
        return Tichu;
    }(Gamegui));
    dojo.setObject("bgagame.tichu", Tichu);
});
"use strict";
(() => {
  // node_modules/@lit/reactive-element/css-tag.js
  var t = globalThis;
  var e = t.ShadowRoot && (void 0 === t.ShadyCSS || t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
  var s = Symbol();
  var o = /* @__PURE__ */ new WeakMap();
  var n = class {
    constructor(t3, e4, o4) {
      if (this._$cssResult$ = true, o4 !== s) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
      this.cssText = t3, this.t = e4;
    }
    get styleSheet() {
      let t3 = this.o;
      const s4 = this.t;
      if (e && void 0 === t3) {
        const e4 = void 0 !== s4 && 1 === s4.length;
        e4 && (t3 = o.get(s4)), void 0 === t3 && ((this.o = t3 = new CSSStyleSheet()).replaceSync(this.cssText), e4 && o.set(s4, t3));
      }
      return t3;
    }
    toString() {
      return this.cssText;
    }
  };
  var r = (t3) => new n("string" == typeof t3 ? t3 : t3 + "", void 0, s);
  var S = (s4, o4) => {
    if (e) s4.adoptedStyleSheets = o4.map((t3) => t3 instanceof CSSStyleSheet ? t3 : t3.styleSheet);
    else for (const e4 of o4) {
      const o5 = document.createElement("style"), n4 = t.litNonce;
      void 0 !== n4 && o5.setAttribute("nonce", n4), o5.textContent = e4.cssText, s4.appendChild(o5);
    }
  };
  var c = e ? (t3) => t3 : (t3) => t3 instanceof CSSStyleSheet ? ((t4) => {
    let e4 = "";
    for (const s4 of t4.cssRules) e4 += s4.cssText;
    return r(e4);
  })(t3) : t3;

  // node_modules/@lit/reactive-element/reactive-element.js
  var { is: i2, defineProperty: e2, getOwnPropertyDescriptor: r2, getOwnPropertyNames: h, getOwnPropertySymbols: o2, getPrototypeOf: n2 } = Object;
  var a = globalThis;
  var c2 = a.trustedTypes;
  var l = c2 ? c2.emptyScript : "";
  var p = a.reactiveElementPolyfillSupport;
  var d = (t3, s4) => t3;
  var u = { toAttribute(t3, s4) {
    switch (s4) {
      case Boolean:
        t3 = t3 ? l : null;
        break;
      case Object:
      case Array:
        t3 = null == t3 ? t3 : JSON.stringify(t3);
    }
    return t3;
  }, fromAttribute(t3, s4) {
    let i4 = t3;
    switch (s4) {
      case Boolean:
        i4 = null !== t3;
        break;
      case Number:
        i4 = null === t3 ? null : Number(t3);
        break;
      case Object:
      case Array:
        try {
          i4 = JSON.parse(t3);
        } catch (t4) {
          i4 = null;
        }
    }
    return i4;
  } };
  var f = (t3, s4) => !i2(t3, s4);
  var y = { attribute: true, type: String, converter: u, reflect: false, hasChanged: f };
  Symbol.metadata ??= Symbol("metadata"), a.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
  var b = class extends HTMLElement {
    static addInitializer(t3) {
      this._$Ei(), (this.l ??= []).push(t3);
    }
    static get observedAttributes() {
      return this.finalize(), this._$Eh && [...this._$Eh.keys()];
    }
    static createProperty(t3, s4 = y) {
      if (s4.state && (s4.attribute = false), this._$Ei(), this.elementProperties.set(t3, s4), !s4.noAccessor) {
        const i4 = Symbol(), r5 = this.getPropertyDescriptor(t3, i4, s4);
        void 0 !== r5 && e2(this.prototype, t3, r5);
      }
    }
    static getPropertyDescriptor(t3, s4, i4) {
      const { get: e4, set: h3 } = r2(this.prototype, t3) ?? { get() {
        return this[s4];
      }, set(t4) {
        this[s4] = t4;
      } };
      return { get() {
        return e4?.call(this);
      }, set(s5) {
        const r5 = e4?.call(this);
        h3.call(this, s5), this.requestUpdate(t3, r5, i4);
      }, configurable: true, enumerable: true };
    }
    static getPropertyOptions(t3) {
      return this.elementProperties.get(t3) ?? y;
    }
    static _$Ei() {
      if (this.hasOwnProperty(d("elementProperties"))) return;
      const t3 = n2(this);
      t3.finalize(), void 0 !== t3.l && (this.l = [...t3.l]), this.elementProperties = new Map(t3.elementProperties);
    }
    static finalize() {
      if (this.hasOwnProperty(d("finalized"))) return;
      if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d("properties"))) {
        const t4 = this.properties, s4 = [...h(t4), ...o2(t4)];
        for (const i4 of s4) this.createProperty(i4, t4[i4]);
      }
      const t3 = this[Symbol.metadata];
      if (null !== t3) {
        const s4 = litPropertyMetadata.get(t3);
        if (void 0 !== s4) for (const [t4, i4] of s4) this.elementProperties.set(t4, i4);
      }
      this._$Eh = /* @__PURE__ */ new Map();
      for (const [t4, s4] of this.elementProperties) {
        const i4 = this._$Eu(t4, s4);
        void 0 !== i4 && this._$Eh.set(i4, t4);
      }
      this.elementStyles = this.finalizeStyles(this.styles);
    }
    static finalizeStyles(s4) {
      const i4 = [];
      if (Array.isArray(s4)) {
        const e4 = new Set(s4.flat(1 / 0).reverse());
        for (const s5 of e4) i4.unshift(c(s5));
      } else void 0 !== s4 && i4.push(c(s4));
      return i4;
    }
    static _$Eu(t3, s4) {
      const i4 = s4.attribute;
      return false === i4 ? void 0 : "string" == typeof i4 ? i4 : "string" == typeof t3 ? t3.toLowerCase() : void 0;
    }
    constructor() {
      super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
    }
    _$Ev() {
      this._$ES = new Promise((t3) => this.enableUpdating = t3), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t3) => t3(this));
    }
    addController(t3) {
      (this._$EO ??= /* @__PURE__ */ new Set()).add(t3), void 0 !== this.renderRoot && this.isConnected && t3.hostConnected?.();
    }
    removeController(t3) {
      this._$EO?.delete(t3);
    }
    _$E_() {
      const t3 = /* @__PURE__ */ new Map(), s4 = this.constructor.elementProperties;
      for (const i4 of s4.keys()) this.hasOwnProperty(i4) && (t3.set(i4, this[i4]), delete this[i4]);
      t3.size > 0 && (this._$Ep = t3);
    }
    createRenderRoot() {
      const t3 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
      return S(t3, this.constructor.elementStyles), t3;
    }
    connectedCallback() {
      this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(true), this._$EO?.forEach((t3) => t3.hostConnected?.());
    }
    enableUpdating(t3) {
    }
    disconnectedCallback() {
      this._$EO?.forEach((t3) => t3.hostDisconnected?.());
    }
    attributeChangedCallback(t3, s4, i4) {
      this._$AK(t3, i4);
    }
    _$EC(t3, s4) {
      const i4 = this.constructor.elementProperties.get(t3), e4 = this.constructor._$Eu(t3, i4);
      if (void 0 !== e4 && true === i4.reflect) {
        const r5 = (void 0 !== i4.converter?.toAttribute ? i4.converter : u).toAttribute(s4, i4.type);
        this._$Em = t3, null == r5 ? this.removeAttribute(e4) : this.setAttribute(e4, r5), this._$Em = null;
      }
    }
    _$AK(t3, s4) {
      const i4 = this.constructor, e4 = i4._$Eh.get(t3);
      if (void 0 !== e4 && this._$Em !== e4) {
        const t4 = i4.getPropertyOptions(e4), r5 = "function" == typeof t4.converter ? { fromAttribute: t4.converter } : void 0 !== t4.converter?.fromAttribute ? t4.converter : u;
        this._$Em = e4, this[e4] = r5.fromAttribute(s4, t4.type), this._$Em = null;
      }
    }
    requestUpdate(t3, s4, i4) {
      if (void 0 !== t3) {
        if (i4 ??= this.constructor.getPropertyOptions(t3), !(i4.hasChanged ?? f)(this[t3], s4)) return;
        this.P(t3, s4, i4);
      }
      false === this.isUpdatePending && (this._$ES = this._$ET());
    }
    P(t3, s4, i4) {
      this._$AL.has(t3) || this._$AL.set(t3, s4), true === i4.reflect && this._$Em !== t3 && (this._$Ej ??= /* @__PURE__ */ new Set()).add(t3);
    }
    async _$ET() {
      this.isUpdatePending = true;
      try {
        await this._$ES;
      } catch (t4) {
        Promise.reject(t4);
      }
      const t3 = this.scheduleUpdate();
      return null != t3 && await t3, !this.isUpdatePending;
    }
    scheduleUpdate() {
      return this.performUpdate();
    }
    performUpdate() {
      if (!this.isUpdatePending) return;
      if (!this.hasUpdated) {
        if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
          for (const [t5, s5] of this._$Ep) this[t5] = s5;
          this._$Ep = void 0;
        }
        const t4 = this.constructor.elementProperties;
        if (t4.size > 0) for (const [s5, i4] of t4) true !== i4.wrapped || this._$AL.has(s5) || void 0 === this[s5] || this.P(s5, this[s5], i4);
      }
      let t3 = false;
      const s4 = this._$AL;
      try {
        t3 = this.shouldUpdate(s4), t3 ? (this.willUpdate(s4), this._$EO?.forEach((t4) => t4.hostUpdate?.()), this.update(s4)) : this._$EU();
      } catch (s5) {
        throw t3 = false, this._$EU(), s5;
      }
      t3 && this._$AE(s4);
    }
    willUpdate(t3) {
    }
    _$AE(t3) {
      this._$EO?.forEach((t4) => t4.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t3)), this.updated(t3);
    }
    _$EU() {
      this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
    }
    get updateComplete() {
      return this.getUpdateComplete();
    }
    getUpdateComplete() {
      return this._$ES;
    }
    shouldUpdate(t3) {
      return true;
    }
    update(t3) {
      this._$Ej &&= this._$Ej.forEach((t4) => this._$EC(t4, this[t4])), this._$EU();
    }
    updated(t3) {
    }
    firstUpdated(t3) {
    }
  };
  b.elementStyles = [], b.shadowRootOptions = { mode: "open" }, b[d("elementProperties")] = /* @__PURE__ */ new Map(), b[d("finalized")] = /* @__PURE__ */ new Map(), p?.({ ReactiveElement: b }), (a.reactiveElementVersions ??= []).push("2.0.4");

  // node_modules/lit-html/lit-html.js
  var t2 = globalThis;
  var i3 = t2.trustedTypes;
  var s2 = i3 ? i3.createPolicy("lit-html", { createHTML: (t3) => t3 }) : void 0;
  var e3 = "$lit$";
  var h2 = `lit$${Math.random().toFixed(9).slice(2)}$`;
  var o3 = "?" + h2;
  var n3 = `<${o3}>`;
  var r3 = document;
  var l2 = () => r3.createComment("");
  var c3 = (t3) => null === t3 || "object" != typeof t3 && "function" != typeof t3;
  var a2 = Array.isArray;
  var u2 = (t3) => a2(t3) || "function" == typeof t3?.[Symbol.iterator];
  var d2 = "[ 	\n\f\r]";
  var f2 = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
  var v = /-->/g;
  var _ = />/g;
  var m = RegExp(`>|${d2}(?:([^\\s"'>=/]+)(${d2}*=${d2}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
  var p2 = /'/g;
  var g = /"/g;
  var $ = /^(?:script|style|textarea|title)$/i;
  var y2 = (t3) => (i4, ...s4) => ({ _$litType$: t3, strings: i4, values: s4 });
  var x = y2(1);
  var b2 = y2(2);
  var w = Symbol.for("lit-noChange");
  var T = Symbol.for("lit-nothing");
  var A = /* @__PURE__ */ new WeakMap();
  var E = r3.createTreeWalker(r3, 129);
  function C(t3, i4) {
    if (!Array.isArray(t3) || !t3.hasOwnProperty("raw")) throw Error("invalid template strings array");
    return void 0 !== s2 ? s2.createHTML(i4) : i4;
  }
  var P = (t3, i4) => {
    const s4 = t3.length - 1, o4 = [];
    let r5, l3 = 2 === i4 ? "<svg>" : "", c4 = f2;
    for (let i5 = 0; i5 < s4; i5++) {
      const s5 = t3[i5];
      let a3, u3, d3 = -1, y3 = 0;
      for (; y3 < s5.length && (c4.lastIndex = y3, u3 = c4.exec(s5), null !== u3); ) y3 = c4.lastIndex, c4 === f2 ? "!--" === u3[1] ? c4 = v : void 0 !== u3[1] ? c4 = _ : void 0 !== u3[2] ? ($.test(u3[2]) && (r5 = RegExp("</" + u3[2], "g")), c4 = m) : void 0 !== u3[3] && (c4 = m) : c4 === m ? ">" === u3[0] ? (c4 = r5 ?? f2, d3 = -1) : void 0 === u3[1] ? d3 = -2 : (d3 = c4.lastIndex - u3[2].length, a3 = u3[1], c4 = void 0 === u3[3] ? m : '"' === u3[3] ? g : p2) : c4 === g || c4 === p2 ? c4 = m : c4 === v || c4 === _ ? c4 = f2 : (c4 = m, r5 = void 0);
      const x2 = c4 === m && t3[i5 + 1].startsWith("/>") ? " " : "";
      l3 += c4 === f2 ? s5 + n3 : d3 >= 0 ? (o4.push(a3), s5.slice(0, d3) + e3 + s5.slice(d3) + h2 + x2) : s5 + h2 + (-2 === d3 ? i5 : x2);
    }
    return [C(t3, l3 + (t3[s4] || "<?>") + (2 === i4 ? "</svg>" : "")), o4];
  };
  var V = class _V {
    constructor({ strings: t3, _$litType$: s4 }, n4) {
      let r5;
      this.parts = [];
      let c4 = 0, a3 = 0;
      const u3 = t3.length - 1, d3 = this.parts, [f3, v2] = P(t3, s4);
      if (this.el = _V.createElement(f3, n4), E.currentNode = this.el.content, 2 === s4) {
        const t4 = this.el.content.firstChild;
        t4.replaceWith(...t4.childNodes);
      }
      for (; null !== (r5 = E.nextNode()) && d3.length < u3; ) {
        if (1 === r5.nodeType) {
          if (r5.hasAttributes()) for (const t4 of r5.getAttributeNames()) if (t4.endsWith(e3)) {
            const i4 = v2[a3++], s5 = r5.getAttribute(t4).split(h2), e4 = /([.?@])?(.*)/.exec(i4);
            d3.push({ type: 1, index: c4, name: e4[2], strings: s5, ctor: "." === e4[1] ? k : "?" === e4[1] ? H : "@" === e4[1] ? I : R }), r5.removeAttribute(t4);
          } else t4.startsWith(h2) && (d3.push({ type: 6, index: c4 }), r5.removeAttribute(t4));
          if ($.test(r5.tagName)) {
            const t4 = r5.textContent.split(h2), s5 = t4.length - 1;
            if (s5 > 0) {
              r5.textContent = i3 ? i3.emptyScript : "";
              for (let i4 = 0; i4 < s5; i4++) r5.append(t4[i4], l2()), E.nextNode(), d3.push({ type: 2, index: ++c4 });
              r5.append(t4[s5], l2());
            }
          }
        } else if (8 === r5.nodeType) if (r5.data === o3) d3.push({ type: 2, index: c4 });
        else {
          let t4 = -1;
          for (; -1 !== (t4 = r5.data.indexOf(h2, t4 + 1)); ) d3.push({ type: 7, index: c4 }), t4 += h2.length - 1;
        }
        c4++;
      }
    }
    static createElement(t3, i4) {
      const s4 = r3.createElement("template");
      return s4.innerHTML = t3, s4;
    }
  };
  function N(t3, i4, s4 = t3, e4) {
    if (i4 === w) return i4;
    let h3 = void 0 !== e4 ? s4._$Co?.[e4] : s4._$Cl;
    const o4 = c3(i4) ? void 0 : i4._$litDirective$;
    return h3?.constructor !== o4 && (h3?._$AO?.(false), void 0 === o4 ? h3 = void 0 : (h3 = new o4(t3), h3._$AT(t3, s4, e4)), void 0 !== e4 ? (s4._$Co ??= [])[e4] = h3 : s4._$Cl = h3), void 0 !== h3 && (i4 = N(t3, h3._$AS(t3, i4.values), h3, e4)), i4;
  }
  var S2 = class {
    constructor(t3, i4) {
      this._$AV = [], this._$AN = void 0, this._$AD = t3, this._$AM = i4;
    }
    get parentNode() {
      return this._$AM.parentNode;
    }
    get _$AU() {
      return this._$AM._$AU;
    }
    u(t3) {
      const { el: { content: i4 }, parts: s4 } = this._$AD, e4 = (t3?.creationScope ?? r3).importNode(i4, true);
      E.currentNode = e4;
      let h3 = E.nextNode(), o4 = 0, n4 = 0, l3 = s4[0];
      for (; void 0 !== l3; ) {
        if (o4 === l3.index) {
          let i5;
          2 === l3.type ? i5 = new M(h3, h3.nextSibling, this, t3) : 1 === l3.type ? i5 = new l3.ctor(h3, l3.name, l3.strings, this, t3) : 6 === l3.type && (i5 = new L(h3, this, t3)), this._$AV.push(i5), l3 = s4[++n4];
        }
        o4 !== l3?.index && (h3 = E.nextNode(), o4++);
      }
      return E.currentNode = r3, e4;
    }
    p(t3) {
      let i4 = 0;
      for (const s4 of this._$AV) void 0 !== s4 && (void 0 !== s4.strings ? (s4._$AI(t3, s4, i4), i4 += s4.strings.length - 2) : s4._$AI(t3[i4])), i4++;
    }
  };
  var M = class _M {
    get _$AU() {
      return this._$AM?._$AU ?? this._$Cv;
    }
    constructor(t3, i4, s4, e4) {
      this.type = 2, this._$AH = T, this._$AN = void 0, this._$AA = t3, this._$AB = i4, this._$AM = s4, this.options = e4, this._$Cv = e4?.isConnected ?? true;
    }
    get parentNode() {
      let t3 = this._$AA.parentNode;
      const i4 = this._$AM;
      return void 0 !== i4 && 11 === t3?.nodeType && (t3 = i4.parentNode), t3;
    }
    get startNode() {
      return this._$AA;
    }
    get endNode() {
      return this._$AB;
    }
    _$AI(t3, i4 = this) {
      t3 = N(this, t3, i4), c3(t3) ? t3 === T || null == t3 || "" === t3 ? (this._$AH !== T && this._$AR(), this._$AH = T) : t3 !== this._$AH && t3 !== w && this._(t3) : void 0 !== t3._$litType$ ? this.$(t3) : void 0 !== t3.nodeType ? this.T(t3) : u2(t3) ? this.k(t3) : this._(t3);
    }
    S(t3) {
      return this._$AA.parentNode.insertBefore(t3, this._$AB);
    }
    T(t3) {
      this._$AH !== t3 && (this._$AR(), this._$AH = this.S(t3));
    }
    _(t3) {
      this._$AH !== T && c3(this._$AH) ? this._$AA.nextSibling.data = t3 : this.T(r3.createTextNode(t3)), this._$AH = t3;
    }
    $(t3) {
      const { values: i4, _$litType$: s4 } = t3, e4 = "number" == typeof s4 ? this._$AC(t3) : (void 0 === s4.el && (s4.el = V.createElement(C(s4.h, s4.h[0]), this.options)), s4);
      if (this._$AH?._$AD === e4) this._$AH.p(i4);
      else {
        const t4 = new S2(e4, this), s5 = t4.u(this.options);
        t4.p(i4), this.T(s5), this._$AH = t4;
      }
    }
    _$AC(t3) {
      let i4 = A.get(t3.strings);
      return void 0 === i4 && A.set(t3.strings, i4 = new V(t3)), i4;
    }
    k(t3) {
      a2(this._$AH) || (this._$AH = [], this._$AR());
      const i4 = this._$AH;
      let s4, e4 = 0;
      for (const h3 of t3) e4 === i4.length ? i4.push(s4 = new _M(this.S(l2()), this.S(l2()), this, this.options)) : s4 = i4[e4], s4._$AI(h3), e4++;
      e4 < i4.length && (this._$AR(s4 && s4._$AB.nextSibling, e4), i4.length = e4);
    }
    _$AR(t3 = this._$AA.nextSibling, i4) {
      for (this._$AP?.(false, true, i4); t3 && t3 !== this._$AB; ) {
        const i5 = t3.nextSibling;
        t3.remove(), t3 = i5;
      }
    }
    setConnected(t3) {
      void 0 === this._$AM && (this._$Cv = t3, this._$AP?.(t3));
    }
  };
  var R = class {
    get tagName() {
      return this.element.tagName;
    }
    get _$AU() {
      return this._$AM._$AU;
    }
    constructor(t3, i4, s4, e4, h3) {
      this.type = 1, this._$AH = T, this._$AN = void 0, this.element = t3, this.name = i4, this._$AM = e4, this.options = h3, s4.length > 2 || "" !== s4[0] || "" !== s4[1] ? (this._$AH = Array(s4.length - 1).fill(new String()), this.strings = s4) : this._$AH = T;
    }
    _$AI(t3, i4 = this, s4, e4) {
      const h3 = this.strings;
      let o4 = false;
      if (void 0 === h3) t3 = N(this, t3, i4, 0), o4 = !c3(t3) || t3 !== this._$AH && t3 !== w, o4 && (this._$AH = t3);
      else {
        const e5 = t3;
        let n4, r5;
        for (t3 = h3[0], n4 = 0; n4 < h3.length - 1; n4++) r5 = N(this, e5[s4 + n4], i4, n4), r5 === w && (r5 = this._$AH[n4]), o4 ||= !c3(r5) || r5 !== this._$AH[n4], r5 === T ? t3 = T : t3 !== T && (t3 += (r5 ?? "") + h3[n4 + 1]), this._$AH[n4] = r5;
      }
      o4 && !e4 && this.j(t3);
    }
    j(t3) {
      t3 === T ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t3 ?? "");
    }
  };
  var k = class extends R {
    constructor() {
      super(...arguments), this.type = 3;
    }
    j(t3) {
      this.element[this.name] = t3 === T ? void 0 : t3;
    }
  };
  var H = class extends R {
    constructor() {
      super(...arguments), this.type = 4;
    }
    j(t3) {
      this.element.toggleAttribute(this.name, !!t3 && t3 !== T);
    }
  };
  var I = class extends R {
    constructor(t3, i4, s4, e4, h3) {
      super(t3, i4, s4, e4, h3), this.type = 5;
    }
    _$AI(t3, i4 = this) {
      if ((t3 = N(this, t3, i4, 0) ?? T) === w) return;
      const s4 = this._$AH, e4 = t3 === T && s4 !== T || t3.capture !== s4.capture || t3.once !== s4.once || t3.passive !== s4.passive, h3 = t3 !== T && (s4 === T || e4);
      e4 && this.element.removeEventListener(this.name, this, s4), h3 && this.element.addEventListener(this.name, this, t3), this._$AH = t3;
    }
    handleEvent(t3) {
      "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t3) : this._$AH.handleEvent(t3);
    }
  };
  var L = class {
    constructor(t3, i4, s4) {
      this.element = t3, this.type = 6, this._$AN = void 0, this._$AM = i4, this.options = s4;
    }
    get _$AU() {
      return this._$AM._$AU;
    }
    _$AI(t3) {
      N(this, t3);
    }
  };
  var Z = t2.litHtmlPolyfillSupport;
  Z?.(V, M), (t2.litHtmlVersions ??= []).push("3.1.3");
  var j = (t3, i4, s4) => {
    const e4 = s4?.renderBefore ?? i4;
    let h3 = e4._$litPart$;
    if (void 0 === h3) {
      const t4 = s4?.renderBefore ?? null;
      e4._$litPart$ = h3 = new M(i4.insertBefore(l2(), t4), t4, void 0, s4 ?? {});
    }
    return h3._$AI(t3), h3;
  };

  // node_modules/lit-element/lit-element.js
  var s3 = class extends b {
    constructor() {
      super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
    }
    createRenderRoot() {
      const t3 = super.createRenderRoot();
      return this.renderOptions.renderBefore ??= t3.firstChild, t3;
    }
    update(t3) {
      const i4 = this.render();
      this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t3), this._$Do = j(i4, this.renderRoot, this.renderOptions);
    }
    connectedCallback() {
      super.connectedCallback(), this._$Do?.setConnected(true);
    }
    disconnectedCallback() {
      super.disconnectedCallback(), this._$Do?.setConnected(false);
    }
    render() {
      return w;
    }
  };
  s3._$litElement$ = true, s3["finalized", "finalized"] = true, globalThis.litElementHydrateSupport?.({ LitElement: s3 });
  var r4 = globalThis.litElementPolyfillSupport;
  r4?.({ LitElement: s3 });
  (globalThis.litElementVersions ??= []).push("4.0.5");

  // src/elements/elements.ts
  var TichuElement = class extends s3 {
    render() {
      return x`<div>Hello, lit world?</div>`;
    }
  };
  customElements.define("tichu-element", TichuElement);
})();
/*! Bundled license information:

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/lit-html.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-element/lit-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/is-server.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
