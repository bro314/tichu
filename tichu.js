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
    exports.dojohtml = exports.dojostyle = void 0;
    function dojostyle(selector, attribute, value) {
        dojo.query(selector).style(attribute, value);
    }
    exports.dojostyle = dojostyle;
    function dojohtml(selector, html) {
        dojo.query(selector).innerHTML(html);
    }
    exports.dojohtml = dojohtml;
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
            _this.experimentalArchiveModeEnabled = false;
            _this.allowedValues = [];
            return _this;
        }
        Tichu.prototype.rescale = function () {
            var areaElement = document.getElementById("game_play_area");
            var replayElement = document.getElementById("game_play_replay");
            var gameElement = this.experimentalArchiveModeEnabled ? replayElement : areaElement;
            var areaWrapElement = document.getElementById("game_play_area_wrap");
            var widthAvailable = areaWrapElement.clientWidth;
            var heightAvailable = document.documentElement.clientHeight - 120;
            var widthMax = 1200;
            var widthMin = this.experimentalArchiveModeEnabled ? 1000 : 900;
            var heightMin = this.experimentalArchiveModeEnabled ? 600 : 800;
            var widthFactor = Math.max(widthAvailable / widthMin, 0.4);
            var heightFactor = Math.max(heightAvailable / heightMin, 0.7);
            var factor = Math.min(widthFactor, heightFactor, 1.0);
            areaWrapElement.style.transform = "scale(".concat(factor, ")");
            areaWrapElement.style.transformOrigin = factor === 1.0 ? "top center" : "top left";
            gameElement.style.width = "".concat(Math.max(Math.min(widthAvailable / factor, widthMax), widthMin), "px");
        };
        Tichu.prototype.setup = function (gamedatas) {
            var _this = this;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
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
            var playArea = document.getElementById("game_play_area_wrap");
            this.statusEl = playArea.querySelector("tichu-status");
            (_b = this.statusEl) === null || _b === void 0 ? void 0 : _b.addEventListener("show-current-trick", function () { return _this.showCurrentTrick(); });
            this.updateStatus();
            this.addTooltipToClass("hand", _("Cards in hand"), "");
            this.addTooltipToClass("star", _("Points captured"), "");
            this.addTooltipToClass("grandtichublack", _("Grand Tichu bet yet to be made"), "");
            this.addTooltipToClass("tichublack", _("Tichu bet yet to be made"), "");
            this.addTooltipToClass("grandtichucolor", _("Grand Tichu bet"), "");
            this.addTooltipToClass("tichucolor", _("Tichu bet"), "");
            this.addTooltipToClass("firstoutcolor", _("First player out"), "");
            this.addTooltipToClass("cardback", _("has passed"), "");
            (_c = document
                .getElementById("overall-content")) === null || _c === void 0 ? void 0 : _c.classList.toggle("tiki", ((_d = this.prefs[103]) === null || _d === void 0 ? void 0 : _d.value) == 1);
            (_e = document.getElementById("overall-content")) === null || _e === void 0 ? void 0 : _e.classList.toggle("archiveMode", !!g_archive_mode);
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
            Array.from((_g = (_f = $("playertables")) === null || _f === void 0 ? void 0 : _f.children) !== null && _g !== void 0 ? _g : []).forEach(function (el, i) {
                dojo.connect(el.children[0], "onclick", _this, function () { return _this.onGiveCard(i); });
            });
            this.setupNotifications();
            if (((_h = this.prefs[100]) === null || _h === void 0 ? void 0 : _h.value) == 2) {
                this.onReorderTable(true);
            }
            this.changeOrder(((_j = this.prefs[101]) === null || _j === void 0 ? void 0 : _j.value) != 1);
            this.setTheme((_l = (_k = this.prefs[104]) === null || _k === void 0 ? void 0 : _k.value) !== null && _l !== void 0 ? _l : 0);
            this.updateCardsPlayed();
            debug("Ending game setup");
        };
        Tichu.prototype.isAllInfoExposed = function () {
            return this.gamedatas.isAllInfoExposed == 1;
        };
        Tichu.prototype.updateStatus = function () {
            var _a, _b, _c, _d;
            (_a = this.statusEl) === null || _a === void 0 ? void 0 : _a.setAttribute("roundCount", "".concat(this.gamedatas.round));
            (_b = this.statusEl) === null || _b === void 0 ? void 0 : _b.setAttribute("trickCount", "".concat(this.gamedatas.trick));
            (_c = this.statusEl) === null || _c === void 0 ? void 0 : _c.setAttribute("trickPoints", "".concat(this.gamedatas.currentTrickValue));
            (_d = this.statusEl) === null || _d === void 0 ? void 0 : _d.setAttribute("trickSize", "".concat(this.gamedatas.currentTrick.length));
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
                    (0, util_1.dojostyle)(".grandtichucolor." + player_id, "display", "inline-block");
                    (0, util_1.dojostyle)(".tichublack." + player_id, "display", "none");
                }
                if (player.call_grand_tichu === Bet.NO_BET_YET) {
                    (0, util_1.dojostyle)(".grandtichublack." + player_id, "display", "inline-block");
                }
                if (player.call_tichu === Bet.TICHU) {
                    (0, util_1.dojostyle)(".tichucolor." + player_id, "display", "inline-block");
                }
                if (player.call_tichu === Bet.NO_BET_YET) {
                    (0, util_1.dojostyle)(".tichublack." + player_id, "display", "inline-block");
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
            dojo.connect($("expReplay"), "onclick", this, function () { return _this.toggleExperimentalReplay(true); });
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
            var _a, _b, _c, _d, _e;
            (_a = document.getElementById("bomb_button")) === null || _a === void 0 ? void 0 : _a.replaceChildren();
            (_b = document.getElementById("play_button")) === null || _b === void 0 ? void 0 : _b.replaceChildren();
            (_c = document.getElementById("pass_button")) === null || _c === void 0 ? void 0 : _c.replaceChildren();
            (_d = document.getElementById("pass_trick_button")) === null || _d === void 0 ? void 0 : _d.replaceChildren();
            (_e = document.getElementById("tichu_button")) === null || _e === void 0 ? void 0 : _e.replaceChildren();
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
            (0, util_1.dojohtml)(".pointcount", "0");
            (0, util_1.dojostyle)(".cardback", "display", "none");
            this.resetLastCombos();
            this.gamedatas.capturedCards = [];
            this.gamedatas.hand = [];
            this.gamedatas.currentTrick = [];
            this.gamedatas.currentTrickValue = 0;
            this.gamedatas.firstoutplayer = 0;
            this.gamedatas.round++;
            for (var id in this.gamedatas.players) {
                this.gamedatas.players[id].call_tichu = Bet.NO_BET_YET;
                this.gamedatas.players[id].call_grand_tichu = Bet.NO_BET_YET;
            }
            dojo.query(".last-played-container").removeClass("disabled");
            this.updateStatus();
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
            (0, util_1.dojohtml)(".handcount", "14");
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
            (_a = this.gamedatas.capturedCards).push.apply(_a, this.gamedatas.currentTrick);
            this.gamedatas.currentTrick = [];
            this.gamedatas.currentTrickValue = 0;
            this.gamedatas.trick++;
            this.updateStatus();
        };
        Tichu.prototype.onEnteringStatePlayComboOpen = function (args) {
            var _a;
            dojo.query(".active").forEach(function (el) { return el.classList.remove("active"); });
            (_a = document.getElementById("playertable_" + this.active_player)) === null || _a === void 0 ? void 0 : _a.classList.add("active");
        };
        Tichu.prototype.onEnteringStateMahjongPlay = function (args) {
            if (this.isCurrentPlayerActive()) {
                (0, util_1.dojostyle)("#mahjongpanel", "display", "block");
                this.mahjongValues.updateDisplay("");
            }
            this.playerHand.unselectAll();
        };
        Tichu.prototype.onEnteringStatePhoenixPlay = function (args) {
            var _this = this;
            if (this.isCurrentPlayerActive()) {
                (0, util_1.dojostyle)("#phoenixpanel", "display", "block");
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
            this.updateStatus();
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
            (0, util_1.dojohtml)(".handcount", "0");
            (0, util_1.dojohtml)(".pointcount", "0");
            (0, util_1.dojostyle)(".grandtichublack", "display", "inline-block");
            (0, util_1.dojostyle)(".tichublack", "display", "inline-block");
            (0, util_1.dojostyle)(".grandtichucolor", "display", "none");
            (0, util_1.dojostyle)(".tichucolor", "display", "none");
            (0, util_1.dojostyle)(".firstoutcolor", "display", "none");
            (0, util_1.dojostyle)(".cardback", "display", "none");
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
                (0, util_1.dojostyle)("#phoenixpanel", "display", "none");
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
        Tichu.prototype.toggleExperimentalReplay = function (enabled) {
            var _this = this;
            var _a;
            this.experimentalArchiveModeEnabled = enabled;
            (_a = document
                .getElementById("overall-content")) === null || _a === void 0 ? void 0 : _a.classList.toggle("experimentalArchiveMode", enabled);
            var playArea = document.getElementById("game_play_area_wrap");
            var replayEl = playArea.querySelector("tichu-replay#game_play_replay");
            if (!replayEl) {
                replayEl = document.createElement("tichu-replay");
                replayEl.id = "game_play_replay";
                playArea.insertBefore(replayEl, playArea.firstChild);
                replayEl.addEventListener("exit", function () { return _this.toggleExperimentalReplay(false); });
            }
            this.rescale();
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
            (0, util_1.dojohtml)(".handcount", "".concat(totalCards));
        };
        Tichu.prototype.notif_grandTichuBet = function (notif) {
            debug("notif_grandTichuBet", notif);
            var bet = String(notif.args.bet);
            this.gamedatas.players[notif.args.player_id].call_grand_tichu = bet;
            (0, util_1.dojostyle)(".grandtichublack." + notif.args.player_id, "display", "none");
            if (bet === Bet.GRAND_TICHU) {
                this.gamedatas.players[notif.args.player_id].call_tichu = Bet.NO_BET;
                (0, util_1.dojostyle)(".grandtichucolor." + notif.args.player_id, "display", "inline-block");
                (0, util_1.dojostyle)(".tichublack." + notif.args.player_id, "display", "none");
                this.animateIcon("grandtichucolor", notif.args.player_id);
                playSound("tichu_laser");
                this.notifqueue.setSynchronousDuration(1000);
            }
            else {
                this.notifqueue.setSynchronousDuration(1);
            }
            this.onUpdateActionButtons(this.stateName, {});
        };
        Tichu.prototype.notif_tichuBet = function (notif) {
            debug("notif_tichuBet", notif);
            var bet = String(notif.args.bet);
            this.gamedatas.players[notif.args.player_id].call_tichu = bet;
            this.gamedatas.players[notif.args.player_id].call_grand_tichu = Bet.NO_BET;
            (0, util_1.dojostyle)(".tichublack." + notif.args.player_id, "display", "none");
            (0, util_1.dojostyle)(".grandtichublack." + notif.args.player_id, "display", "none");
            if (bet === Bet.TICHU) {
                (0, util_1.dojostyle)(".tichucolor." + notif.args.player_id, "display", "inline-block");
                this.animateIcon("tichucolor", notif.args.player_id);
                playSound("tichu_laser");
                this.notifqueue.setSynchronousDuration(1000);
            }
            else {
                this.notifqueue.setSynchronousDuration(1);
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
        Tichu.prototype.notif_playCombo = function (notif) {
            var _a;
            debug("notif_playCombo", notif);
            var playerId = Number(notif.args.player_id);
            this.resetComboStock(playerId);
            this.addCardsToStock(this.tableCombos[playerId], notif.args.cards, playerId);
            (0, util_1.dojohtml)("pass", "");
            $("cardback_" + playerId).style.display = "none";
            this.setDescription(playerId, notif.args.combo_name);
            dojo.query(".handcount." + playerId).forEach(function (node) {
                var el = node;
                el.innerHTML = String(parseInt(el.innerHTML) - notif.args.cards.length);
            });
            dojo.query(".lastComboPlayer").removeClass("lastComboPlayer");
            $("playertable_" + playerId).classList.add("lastComboPlayer");
            (_a = this.gamedatas.currentTrick).push.apply(_a, notif.args.cards);
            this.gamedatas.currentTrickValue += notif.args.points;
            this.updateStatus();
        };
        Tichu.prototype.notif_wishMade = function (notif) {
            debug("notif_wishMade", notif);
            (0, util_1.dojostyle)("#mahjongpanel", "display", "none");
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
            (0, util_1.dojohtml)(".pointcount." + playerId, "".concat(new_score));
            (0, util_1.dojostyle)(".cardback", "display", "none");
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
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __decorateClass = (decorators, target, key, kind) => {
    var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
    for (var i5 = decorators.length - 1, decorator; i5 >= 0; i5--)
      if (decorator = decorators[i5])
        result = (kind ? decorator(target, key, result) : decorator(result)) || result;
    if (kind && result) __defProp(target, key, result);
    return result;
  };

  // node_modules/@lit/reactive-element/css-tag.js
  var t = globalThis;
  var e = t.ShadowRoot && (void 0 === t.ShadyCSS || t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
  var s = Symbol();
  var o = /* @__PURE__ */ new WeakMap();
  var n = class {
    constructor(t4, e7, o5) {
      if (this._$cssResult$ = true, o5 !== s) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
      this.cssText = t4, this.t = e7;
    }
    get styleSheet() {
      let t4 = this.o;
      const s4 = this.t;
      if (e && void 0 === t4) {
        const e7 = void 0 !== s4 && 1 === s4.length;
        e7 && (t4 = o.get(s4)), void 0 === t4 && ((this.o = t4 = new CSSStyleSheet()).replaceSync(this.cssText), e7 && o.set(s4, t4));
      }
      return t4;
    }
    toString() {
      return this.cssText;
    }
  };
  var r = (t4) => new n("string" == typeof t4 ? t4 : t4 + "", void 0, s);
  var i = (t4, ...e7) => {
    const o5 = 1 === t4.length ? t4[0] : e7.reduce((e8, s4, o6) => e8 + ((t5) => {
      if (true === t5._$cssResult$) return t5.cssText;
      if ("number" == typeof t5) return t5;
      throw Error("Value passed to 'css' function must be a 'css' function result: " + t5 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
    })(s4) + t4[o6 + 1], t4[0]);
    return new n(o5, t4, s);
  };
  var S = (s4, o5) => {
    if (e) s4.adoptedStyleSheets = o5.map((t4) => t4 instanceof CSSStyleSheet ? t4 : t4.styleSheet);
    else for (const e7 of o5) {
      const o6 = document.createElement("style"), n5 = t.litNonce;
      void 0 !== n5 && o6.setAttribute("nonce", n5), o6.textContent = e7.cssText, s4.appendChild(o6);
    }
  };
  var c = e ? (t4) => t4 : (t4) => t4 instanceof CSSStyleSheet ? ((t5) => {
    let e7 = "";
    for (const s4 of t5.cssRules) e7 += s4.cssText;
    return r(e7);
  })(t4) : t4;

  // node_modules/@lit/reactive-element/reactive-element.js
  var { is: i2, defineProperty: e2, getOwnPropertyDescriptor: r2, getOwnPropertyNames: h, getOwnPropertySymbols: o2, getPrototypeOf: n2 } = Object;
  var a = globalThis;
  var c2 = a.trustedTypes;
  var l = c2 ? c2.emptyScript : "";
  var p = a.reactiveElementPolyfillSupport;
  var d = (t4, s4) => t4;
  var u = { toAttribute(t4, s4) {
    switch (s4) {
      case Boolean:
        t4 = t4 ? l : null;
        break;
      case Object:
      case Array:
        t4 = null == t4 ? t4 : JSON.stringify(t4);
    }
    return t4;
  }, fromAttribute(t4, s4) {
    let i5 = t4;
    switch (s4) {
      case Boolean:
        i5 = null !== t4;
        break;
      case Number:
        i5 = null === t4 ? null : Number(t4);
        break;
      case Object:
      case Array:
        try {
          i5 = JSON.parse(t4);
        } catch (t5) {
          i5 = null;
        }
    }
    return i5;
  } };
  var f = (t4, s4) => !i2(t4, s4);
  var y = { attribute: true, type: String, converter: u, reflect: false, hasChanged: f };
  Symbol.metadata ??= Symbol("metadata"), a.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
  var b = class extends HTMLElement {
    static addInitializer(t4) {
      this._$Ei(), (this.l ??= []).push(t4);
    }
    static get observedAttributes() {
      return this.finalize(), this._$Eh && [...this._$Eh.keys()];
    }
    static createProperty(t4, s4 = y) {
      if (s4.state && (s4.attribute = false), this._$Ei(), this.elementProperties.set(t4, s4), !s4.noAccessor) {
        const i5 = Symbol(), r7 = this.getPropertyDescriptor(t4, i5, s4);
        void 0 !== r7 && e2(this.prototype, t4, r7);
      }
    }
    static getPropertyDescriptor(t4, s4, i5) {
      const { get: e7, set: h3 } = r2(this.prototype, t4) ?? { get() {
        return this[s4];
      }, set(t5) {
        this[s4] = t5;
      } };
      return { get() {
        return e7?.call(this);
      }, set(s5) {
        const r7 = e7?.call(this);
        h3.call(this, s5), this.requestUpdate(t4, r7, i5);
      }, configurable: true, enumerable: true };
    }
    static getPropertyOptions(t4) {
      return this.elementProperties.get(t4) ?? y;
    }
    static _$Ei() {
      if (this.hasOwnProperty(d("elementProperties"))) return;
      const t4 = n2(this);
      t4.finalize(), void 0 !== t4.l && (this.l = [...t4.l]), this.elementProperties = new Map(t4.elementProperties);
    }
    static finalize() {
      if (this.hasOwnProperty(d("finalized"))) return;
      if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d("properties"))) {
        const t5 = this.properties, s4 = [...h(t5), ...o2(t5)];
        for (const i5 of s4) this.createProperty(i5, t5[i5]);
      }
      const t4 = this[Symbol.metadata];
      if (null !== t4) {
        const s4 = litPropertyMetadata.get(t4);
        if (void 0 !== s4) for (const [t5, i5] of s4) this.elementProperties.set(t5, i5);
      }
      this._$Eh = /* @__PURE__ */ new Map();
      for (const [t5, s4] of this.elementProperties) {
        const i5 = this._$Eu(t5, s4);
        void 0 !== i5 && this._$Eh.set(i5, t5);
      }
      this.elementStyles = this.finalizeStyles(this.styles);
    }
    static finalizeStyles(s4) {
      const i5 = [];
      if (Array.isArray(s4)) {
        const e7 = new Set(s4.flat(1 / 0).reverse());
        for (const s5 of e7) i5.unshift(c(s5));
      } else void 0 !== s4 && i5.push(c(s4));
      return i5;
    }
    static _$Eu(t4, s4) {
      const i5 = s4.attribute;
      return false === i5 ? void 0 : "string" == typeof i5 ? i5 : "string" == typeof t4 ? t4.toLowerCase() : void 0;
    }
    constructor() {
      super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
    }
    _$Ev() {
      this._$ES = new Promise((t4) => this.enableUpdating = t4), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t4) => t4(this));
    }
    addController(t4) {
      (this._$EO ??= /* @__PURE__ */ new Set()).add(t4), void 0 !== this.renderRoot && this.isConnected && t4.hostConnected?.();
    }
    removeController(t4) {
      this._$EO?.delete(t4);
    }
    _$E_() {
      const t4 = /* @__PURE__ */ new Map(), s4 = this.constructor.elementProperties;
      for (const i5 of s4.keys()) this.hasOwnProperty(i5) && (t4.set(i5, this[i5]), delete this[i5]);
      t4.size > 0 && (this._$Ep = t4);
    }
    createRenderRoot() {
      const t4 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
      return S(t4, this.constructor.elementStyles), t4;
    }
    connectedCallback() {
      this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(true), this._$EO?.forEach((t4) => t4.hostConnected?.());
    }
    enableUpdating(t4) {
    }
    disconnectedCallback() {
      this._$EO?.forEach((t4) => t4.hostDisconnected?.());
    }
    attributeChangedCallback(t4, s4, i5) {
      this._$AK(t4, i5);
    }
    _$EC(t4, s4) {
      const i5 = this.constructor.elementProperties.get(t4), e7 = this.constructor._$Eu(t4, i5);
      if (void 0 !== e7 && true === i5.reflect) {
        const r7 = (void 0 !== i5.converter?.toAttribute ? i5.converter : u).toAttribute(s4, i5.type);
        this._$Em = t4, null == r7 ? this.removeAttribute(e7) : this.setAttribute(e7, r7), this._$Em = null;
      }
    }
    _$AK(t4, s4) {
      const i5 = this.constructor, e7 = i5._$Eh.get(t4);
      if (void 0 !== e7 && this._$Em !== e7) {
        const t5 = i5.getPropertyOptions(e7), r7 = "function" == typeof t5.converter ? { fromAttribute: t5.converter } : void 0 !== t5.converter?.fromAttribute ? t5.converter : u;
        this._$Em = e7, this[e7] = r7.fromAttribute(s4, t5.type), this._$Em = null;
      }
    }
    requestUpdate(t4, s4, i5) {
      if (void 0 !== t4) {
        if (i5 ??= this.constructor.getPropertyOptions(t4), !(i5.hasChanged ?? f)(this[t4], s4)) return;
        this.P(t4, s4, i5);
      }
      false === this.isUpdatePending && (this._$ES = this._$ET());
    }
    P(t4, s4, i5) {
      this._$AL.has(t4) || this._$AL.set(t4, s4), true === i5.reflect && this._$Em !== t4 && (this._$Ej ??= /* @__PURE__ */ new Set()).add(t4);
    }
    async _$ET() {
      this.isUpdatePending = true;
      try {
        await this._$ES;
      } catch (t5) {
        Promise.reject(t5);
      }
      const t4 = this.scheduleUpdate();
      return null != t4 && await t4, !this.isUpdatePending;
    }
    scheduleUpdate() {
      return this.performUpdate();
    }
    performUpdate() {
      if (!this.isUpdatePending) return;
      if (!this.hasUpdated) {
        if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
          for (const [t6, s5] of this._$Ep) this[t6] = s5;
          this._$Ep = void 0;
        }
        const t5 = this.constructor.elementProperties;
        if (t5.size > 0) for (const [s5, i5] of t5) true !== i5.wrapped || this._$AL.has(s5) || void 0 === this[s5] || this.P(s5, this[s5], i5);
      }
      let t4 = false;
      const s4 = this._$AL;
      try {
        t4 = this.shouldUpdate(s4), t4 ? (this.willUpdate(s4), this._$EO?.forEach((t5) => t5.hostUpdate?.()), this.update(s4)) : this._$EU();
      } catch (s5) {
        throw t4 = false, this._$EU(), s5;
      }
      t4 && this._$AE(s4);
    }
    willUpdate(t4) {
    }
    _$AE(t4) {
      this._$EO?.forEach((t5) => t5.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t4)), this.updated(t4);
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
    shouldUpdate(t4) {
      return true;
    }
    update(t4) {
      this._$Ej &&= this._$Ej.forEach((t5) => this._$EC(t5, this[t5])), this._$EU();
    }
    updated(t4) {
    }
    firstUpdated(t4) {
    }
  };
  b.elementStyles = [], b.shadowRootOptions = { mode: "open" }, b[d("elementProperties")] = /* @__PURE__ */ new Map(), b[d("finalized")] = /* @__PURE__ */ new Map(), p?.({ ReactiveElement: b }), (a.reactiveElementVersions ??= []).push("2.0.4");

  // node_modules/lit-html/lit-html.js
  var t2 = globalThis;
  var i3 = t2.trustedTypes;
  var s2 = i3 ? i3.createPolicy("lit-html", { createHTML: (t4) => t4 }) : void 0;
  var e3 = "$lit$";
  var h2 = `lit$${Math.random().toFixed(9).slice(2)}$`;
  var o3 = "?" + h2;
  var n3 = `<${o3}>`;
  var r3 = document;
  var l2 = () => r3.createComment("");
  var c3 = (t4) => null === t4 || "object" != typeof t4 && "function" != typeof t4;
  var a2 = Array.isArray;
  var u2 = (t4) => a2(t4) || "function" == typeof t4?.[Symbol.iterator];
  var d2 = "[ 	\n\f\r]";
  var f2 = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
  var v = /-->/g;
  var _ = />/g;
  var m = RegExp(`>|${d2}(?:([^\\s"'>=/]+)(${d2}*=${d2}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
  var p2 = /'/g;
  var g = /"/g;
  var $ = /^(?:script|style|textarea|title)$/i;
  var y2 = (t4) => (i5, ...s4) => ({ _$litType$: t4, strings: i5, values: s4 });
  var x = y2(1);
  var b2 = y2(2);
  var w = Symbol.for("lit-noChange");
  var T = Symbol.for("lit-nothing");
  var A = /* @__PURE__ */ new WeakMap();
  var E = r3.createTreeWalker(r3, 129);
  function C(t4, i5) {
    if (!Array.isArray(t4) || !t4.hasOwnProperty("raw")) throw Error("invalid template strings array");
    return void 0 !== s2 ? s2.createHTML(i5) : i5;
  }
  var P = (t4, i5) => {
    const s4 = t4.length - 1, o5 = [];
    let r7, l3 = 2 === i5 ? "<svg>" : "", c4 = f2;
    for (let i6 = 0; i6 < s4; i6++) {
      const s5 = t4[i6];
      let a3, u3, d3 = -1, y3 = 0;
      for (; y3 < s5.length && (c4.lastIndex = y3, u3 = c4.exec(s5), null !== u3); ) y3 = c4.lastIndex, c4 === f2 ? "!--" === u3[1] ? c4 = v : void 0 !== u3[1] ? c4 = _ : void 0 !== u3[2] ? ($.test(u3[2]) && (r7 = RegExp("</" + u3[2], "g")), c4 = m) : void 0 !== u3[3] && (c4 = m) : c4 === m ? ">" === u3[0] ? (c4 = r7 ?? f2, d3 = -1) : void 0 === u3[1] ? d3 = -2 : (d3 = c4.lastIndex - u3[2].length, a3 = u3[1], c4 = void 0 === u3[3] ? m : '"' === u3[3] ? g : p2) : c4 === g || c4 === p2 ? c4 = m : c4 === v || c4 === _ ? c4 = f2 : (c4 = m, r7 = void 0);
      const x2 = c4 === m && t4[i6 + 1].startsWith("/>") ? " " : "";
      l3 += c4 === f2 ? s5 + n3 : d3 >= 0 ? (o5.push(a3), s5.slice(0, d3) + e3 + s5.slice(d3) + h2 + x2) : s5 + h2 + (-2 === d3 ? i6 : x2);
    }
    return [C(t4, l3 + (t4[s4] || "<?>") + (2 === i5 ? "</svg>" : "")), o5];
  };
  var V = class _V {
    constructor({ strings: t4, _$litType$: s4 }, n5) {
      let r7;
      this.parts = [];
      let c4 = 0, a3 = 0;
      const u3 = t4.length - 1, d3 = this.parts, [f3, v2] = P(t4, s4);
      if (this.el = _V.createElement(f3, n5), E.currentNode = this.el.content, 2 === s4) {
        const t5 = this.el.content.firstChild;
        t5.replaceWith(...t5.childNodes);
      }
      for (; null !== (r7 = E.nextNode()) && d3.length < u3; ) {
        if (1 === r7.nodeType) {
          if (r7.hasAttributes()) for (const t5 of r7.getAttributeNames()) if (t5.endsWith(e3)) {
            const i5 = v2[a3++], s5 = r7.getAttribute(t5).split(h2), e7 = /([.?@])?(.*)/.exec(i5);
            d3.push({ type: 1, index: c4, name: e7[2], strings: s5, ctor: "." === e7[1] ? k : "?" === e7[1] ? H : "@" === e7[1] ? I : R }), r7.removeAttribute(t5);
          } else t5.startsWith(h2) && (d3.push({ type: 6, index: c4 }), r7.removeAttribute(t5));
          if ($.test(r7.tagName)) {
            const t5 = r7.textContent.split(h2), s5 = t5.length - 1;
            if (s5 > 0) {
              r7.textContent = i3 ? i3.emptyScript : "";
              for (let i5 = 0; i5 < s5; i5++) r7.append(t5[i5], l2()), E.nextNode(), d3.push({ type: 2, index: ++c4 });
              r7.append(t5[s5], l2());
            }
          }
        } else if (8 === r7.nodeType) if (r7.data === o3) d3.push({ type: 2, index: c4 });
        else {
          let t5 = -1;
          for (; -1 !== (t5 = r7.data.indexOf(h2, t5 + 1)); ) d3.push({ type: 7, index: c4 }), t5 += h2.length - 1;
        }
        c4++;
      }
    }
    static createElement(t4, i5) {
      const s4 = r3.createElement("template");
      return s4.innerHTML = t4, s4;
    }
  };
  function N(t4, i5, s4 = t4, e7) {
    if (i5 === w) return i5;
    let h3 = void 0 !== e7 ? s4._$Co?.[e7] : s4._$Cl;
    const o5 = c3(i5) ? void 0 : i5._$litDirective$;
    return h3?.constructor !== o5 && (h3?._$AO?.(false), void 0 === o5 ? h3 = void 0 : (h3 = new o5(t4), h3._$AT(t4, s4, e7)), void 0 !== e7 ? (s4._$Co ??= [])[e7] = h3 : s4._$Cl = h3), void 0 !== h3 && (i5 = N(t4, h3._$AS(t4, i5.values), h3, e7)), i5;
  }
  var S2 = class {
    constructor(t4, i5) {
      this._$AV = [], this._$AN = void 0, this._$AD = t4, this._$AM = i5;
    }
    get parentNode() {
      return this._$AM.parentNode;
    }
    get _$AU() {
      return this._$AM._$AU;
    }
    u(t4) {
      const { el: { content: i5 }, parts: s4 } = this._$AD, e7 = (t4?.creationScope ?? r3).importNode(i5, true);
      E.currentNode = e7;
      let h3 = E.nextNode(), o5 = 0, n5 = 0, l3 = s4[0];
      for (; void 0 !== l3; ) {
        if (o5 === l3.index) {
          let i6;
          2 === l3.type ? i6 = new M(h3, h3.nextSibling, this, t4) : 1 === l3.type ? i6 = new l3.ctor(h3, l3.name, l3.strings, this, t4) : 6 === l3.type && (i6 = new L(h3, this, t4)), this._$AV.push(i6), l3 = s4[++n5];
        }
        o5 !== l3?.index && (h3 = E.nextNode(), o5++);
      }
      return E.currentNode = r3, e7;
    }
    p(t4) {
      let i5 = 0;
      for (const s4 of this._$AV) void 0 !== s4 && (void 0 !== s4.strings ? (s4._$AI(t4, s4, i5), i5 += s4.strings.length - 2) : s4._$AI(t4[i5])), i5++;
    }
  };
  var M = class _M {
    get _$AU() {
      return this._$AM?._$AU ?? this._$Cv;
    }
    constructor(t4, i5, s4, e7) {
      this.type = 2, this._$AH = T, this._$AN = void 0, this._$AA = t4, this._$AB = i5, this._$AM = s4, this.options = e7, this._$Cv = e7?.isConnected ?? true;
    }
    get parentNode() {
      let t4 = this._$AA.parentNode;
      const i5 = this._$AM;
      return void 0 !== i5 && 11 === t4?.nodeType && (t4 = i5.parentNode), t4;
    }
    get startNode() {
      return this._$AA;
    }
    get endNode() {
      return this._$AB;
    }
    _$AI(t4, i5 = this) {
      t4 = N(this, t4, i5), c3(t4) ? t4 === T || null == t4 || "" === t4 ? (this._$AH !== T && this._$AR(), this._$AH = T) : t4 !== this._$AH && t4 !== w && this._(t4) : void 0 !== t4._$litType$ ? this.$(t4) : void 0 !== t4.nodeType ? this.T(t4) : u2(t4) ? this.k(t4) : this._(t4);
    }
    S(t4) {
      return this._$AA.parentNode.insertBefore(t4, this._$AB);
    }
    T(t4) {
      this._$AH !== t4 && (this._$AR(), this._$AH = this.S(t4));
    }
    _(t4) {
      this._$AH !== T && c3(this._$AH) ? this._$AA.nextSibling.data = t4 : this.T(r3.createTextNode(t4)), this._$AH = t4;
    }
    $(t4) {
      const { values: i5, _$litType$: s4 } = t4, e7 = "number" == typeof s4 ? this._$AC(t4) : (void 0 === s4.el && (s4.el = V.createElement(C(s4.h, s4.h[0]), this.options)), s4);
      if (this._$AH?._$AD === e7) this._$AH.p(i5);
      else {
        const t5 = new S2(e7, this), s5 = t5.u(this.options);
        t5.p(i5), this.T(s5), this._$AH = t5;
      }
    }
    _$AC(t4) {
      let i5 = A.get(t4.strings);
      return void 0 === i5 && A.set(t4.strings, i5 = new V(t4)), i5;
    }
    k(t4) {
      a2(this._$AH) || (this._$AH = [], this._$AR());
      const i5 = this._$AH;
      let s4, e7 = 0;
      for (const h3 of t4) e7 === i5.length ? i5.push(s4 = new _M(this.S(l2()), this.S(l2()), this, this.options)) : s4 = i5[e7], s4._$AI(h3), e7++;
      e7 < i5.length && (this._$AR(s4 && s4._$AB.nextSibling, e7), i5.length = e7);
    }
    _$AR(t4 = this._$AA.nextSibling, i5) {
      for (this._$AP?.(false, true, i5); t4 && t4 !== this._$AB; ) {
        const i6 = t4.nextSibling;
        t4.remove(), t4 = i6;
      }
    }
    setConnected(t4) {
      void 0 === this._$AM && (this._$Cv = t4, this._$AP?.(t4));
    }
  };
  var R = class {
    get tagName() {
      return this.element.tagName;
    }
    get _$AU() {
      return this._$AM._$AU;
    }
    constructor(t4, i5, s4, e7, h3) {
      this.type = 1, this._$AH = T, this._$AN = void 0, this.element = t4, this.name = i5, this._$AM = e7, this.options = h3, s4.length > 2 || "" !== s4[0] || "" !== s4[1] ? (this._$AH = Array(s4.length - 1).fill(new String()), this.strings = s4) : this._$AH = T;
    }
    _$AI(t4, i5 = this, s4, e7) {
      const h3 = this.strings;
      let o5 = false;
      if (void 0 === h3) t4 = N(this, t4, i5, 0), o5 = !c3(t4) || t4 !== this._$AH && t4 !== w, o5 && (this._$AH = t4);
      else {
        const e8 = t4;
        let n5, r7;
        for (t4 = h3[0], n5 = 0; n5 < h3.length - 1; n5++) r7 = N(this, e8[s4 + n5], i5, n5), r7 === w && (r7 = this._$AH[n5]), o5 ||= !c3(r7) || r7 !== this._$AH[n5], r7 === T ? t4 = T : t4 !== T && (t4 += (r7 ?? "") + h3[n5 + 1]), this._$AH[n5] = r7;
      }
      o5 && !e7 && this.j(t4);
    }
    j(t4) {
      t4 === T ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t4 ?? "");
    }
  };
  var k = class extends R {
    constructor() {
      super(...arguments), this.type = 3;
    }
    j(t4) {
      this.element[this.name] = t4 === T ? void 0 : t4;
    }
  };
  var H = class extends R {
    constructor() {
      super(...arguments), this.type = 4;
    }
    j(t4) {
      this.element.toggleAttribute(this.name, !!t4 && t4 !== T);
    }
  };
  var I = class extends R {
    constructor(t4, i5, s4, e7, h3) {
      super(t4, i5, s4, e7, h3), this.type = 5;
    }
    _$AI(t4, i5 = this) {
      if ((t4 = N(this, t4, i5, 0) ?? T) === w) return;
      const s4 = this._$AH, e7 = t4 === T && s4 !== T || t4.capture !== s4.capture || t4.once !== s4.once || t4.passive !== s4.passive, h3 = t4 !== T && (s4 === T || e7);
      e7 && this.element.removeEventListener(this.name, this, s4), h3 && this.element.addEventListener(this.name, this, t4), this._$AH = t4;
    }
    handleEvent(t4) {
      "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t4) : this._$AH.handleEvent(t4);
    }
  };
  var L = class {
    constructor(t4, i5, s4) {
      this.element = t4, this.type = 6, this._$AN = void 0, this._$AM = i5, this.options = s4;
    }
    get _$AU() {
      return this._$AM._$AU;
    }
    _$AI(t4) {
      N(this, t4);
    }
  };
  var Z = t2.litHtmlPolyfillSupport;
  Z?.(V, M), (t2.litHtmlVersions ??= []).push("3.1.3");
  var j = (t4, i5, s4) => {
    const e7 = s4?.renderBefore ?? i5;
    let h3 = e7._$litPart$;
    if (void 0 === h3) {
      const t5 = s4?.renderBefore ?? null;
      e7._$litPart$ = h3 = new M(i5.insertBefore(l2(), t5), t5, void 0, s4 ?? {});
    }
    return h3._$AI(t4), h3;
  };

  // node_modules/lit-element/lit-element.js
  var s3 = class extends b {
    constructor() {
      super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
    }
    createRenderRoot() {
      const t4 = super.createRenderRoot();
      return this.renderOptions.renderBefore ??= t4.firstChild, t4;
    }
    update(t4) {
      const i5 = this.render();
      this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t4), this._$Do = j(i5, this.renderRoot, this.renderOptions);
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

  // node_modules/@lit/reactive-element/decorators/property.js
  var o4 = { attribute: true, type: String, converter: u, reflect: false, hasChanged: f };
  var r5 = (t4 = o4, e7, r7) => {
    const { kind: n5, metadata: i5 } = r7;
    let s4 = globalThis.litPropertyMetadata.get(i5);
    if (void 0 === s4 && globalThis.litPropertyMetadata.set(i5, s4 = /* @__PURE__ */ new Map()), s4.set(r7.name, t4), "accessor" === n5) {
      const { name: o5 } = r7;
      return { set(r8) {
        const n6 = e7.get.call(this);
        e7.set.call(this, r8), this.requestUpdate(o5, n6, t4);
      }, init(e8) {
        return void 0 !== e8 && this.P(o5, void 0, t4), e8;
      } };
    }
    if ("setter" === n5) {
      const { name: o5 } = r7;
      return function(r8) {
        const n6 = this[o5];
        e7.call(this, r8), this.requestUpdate(o5, n6, t4);
      };
    }
    throw Error("Unsupported decorator location: " + n5);
  };
  function n4(t4) {
    return (e7, o5) => "object" == typeof o5 ? r5(t4, e7, o5) : ((t5, e8, o6) => {
      const r7 = e8.hasOwnProperty(o6);
      return e8.constructor.createProperty(o6, r7 ? { ...t5, wrapped: true } : t5), r7 ? Object.getOwnPropertyDescriptor(e8, o6) : void 0;
    })(t4, e7, o5);
  }

  // node_modules/@lit/reactive-element/decorators/state.js
  function r6(r7) {
    return n4({ ...r7, state: true, attribute: false });
  }

  // node_modules/tslib/tslib.es6.mjs
  var extendStatics = function(d3, b3) {
    extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d4, b4) {
      d4.__proto__ = b4;
    } || function(d4, b4) {
      for (var p3 in b4) if (Object.prototype.hasOwnProperty.call(b4, p3)) d4[p3] = b4[p3];
    };
    return extendStatics(d3, b3);
  };
  function __extends(d3, b3) {
    if (typeof b3 !== "function" && b3 !== null)
      throw new TypeError("Class extends value " + String(b3) + " is not a constructor or null");
    extendStatics(d3, b3);
    function __() {
      this.constructor = d3;
    }
    d3.prototype = b3 === null ? Object.create(b3) : (__.prototype = b3.prototype, new __());
  }
  function __awaiter(thisArg, _arguments, P2, generator) {
    function adopt(value) {
      return value instanceof P2 ? value : new P2(function(resolve) {
        resolve(value);
      });
    }
    return new (P2 || (P2 = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e7) {
          reject(e7);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e7) {
          reject(e7);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  }
  function __generator(thisArg, body) {
    var _2 = { label: 0, sent: function() {
      if (t4[0] & 1) throw t4[1];
      return t4[1];
    }, trys: [], ops: [] }, f3, y3, t4, g2;
    return g2 = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g2[Symbol.iterator] = function() {
      return this;
    }), g2;
    function verb(n5) {
      return function(v2) {
        return step([n5, v2]);
      };
    }
    function step(op) {
      if (f3) throw new TypeError("Generator is already executing.");
      while (g2 && (g2 = 0, op[0] && (_2 = 0)), _2) try {
        if (f3 = 1, y3 && (t4 = op[0] & 2 ? y3["return"] : op[0] ? y3["throw"] || ((t4 = y3["return"]) && t4.call(y3), 0) : y3.next) && !(t4 = t4.call(y3, op[1])).done) return t4;
        if (y3 = 0, t4) op = [op[0] & 2, t4.value];
        switch (op[0]) {
          case 0:
          case 1:
            t4 = op;
            break;
          case 4:
            _2.label++;
            return { value: op[1], done: false };
          case 5:
            _2.label++;
            y3 = op[1];
            op = [0];
            continue;
          case 7:
            op = _2.ops.pop();
            _2.trys.pop();
            continue;
          default:
            if (!(t4 = _2.trys, t4 = t4.length > 0 && t4[t4.length - 1]) && (op[0] === 6 || op[0] === 2)) {
              _2 = 0;
              continue;
            }
            if (op[0] === 3 && (!t4 || op[1] > t4[0] && op[1] < t4[3])) {
              _2.label = op[1];
              break;
            }
            if (op[0] === 6 && _2.label < t4[1]) {
              _2.label = t4[1];
              t4 = op;
              break;
            }
            if (t4 && _2.label < t4[2]) {
              _2.label = t4[2];
              _2.ops.push(op);
              break;
            }
            if (t4[2]) _2.ops.pop();
            _2.trys.pop();
            continue;
        }
        op = body.call(thisArg, _2);
      } catch (e7) {
        op = [6, e7];
        y3 = 0;
      } finally {
        f3 = t4 = 0;
      }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  }
  function __values(o5) {
    var s4 = typeof Symbol === "function" && Symbol.iterator, m2 = s4 && o5[s4], i5 = 0;
    if (m2) return m2.call(o5);
    if (o5 && typeof o5.length === "number") return {
      next: function() {
        if (o5 && i5 >= o5.length) o5 = void 0;
        return { value: o5 && o5[i5++], done: !o5 };
      }
    };
    throw new TypeError(s4 ? "Object is not iterable." : "Symbol.iterator is not defined.");
  }
  function __read(o5, n5) {
    var m2 = typeof Symbol === "function" && o5[Symbol.iterator];
    if (!m2) return o5;
    var i5 = m2.call(o5), r7, ar = [], e7;
    try {
      while ((n5 === void 0 || n5-- > 0) && !(r7 = i5.next()).done) ar.push(r7.value);
    } catch (error) {
      e7 = { error };
    } finally {
      try {
        if (r7 && !r7.done && (m2 = i5["return"])) m2.call(i5);
      } finally {
        if (e7) throw e7.error;
      }
    }
    return ar;
  }
  function __spreadArray(to, from, pack) {
    if (pack || arguments.length === 2) for (var i5 = 0, l3 = from.length, ar; i5 < l3; i5++) {
      if (ar || !(i5 in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i5);
        ar[i5] = from[i5];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  }
  function __await(v2) {
    return this instanceof __await ? (this.v = v2, this) : new __await(v2);
  }
  function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g2 = generator.apply(thisArg, _arguments || []), i5, q = [];
    return i5 = {}, verb("next"), verb("throw"), verb("return"), i5[Symbol.asyncIterator] = function() {
      return this;
    }, i5;
    function verb(n5) {
      if (g2[n5]) i5[n5] = function(v2) {
        return new Promise(function(a3, b3) {
          q.push([n5, v2, a3, b3]) > 1 || resume(n5, v2);
        });
      };
    }
    function resume(n5, v2) {
      try {
        step(g2[n5](v2));
      } catch (e7) {
        settle(q[0][3], e7);
      }
    }
    function step(r7) {
      r7.value instanceof __await ? Promise.resolve(r7.value.v).then(fulfill, reject) : settle(q[0][2], r7);
    }
    function fulfill(value) {
      resume("next", value);
    }
    function reject(value) {
      resume("throw", value);
    }
    function settle(f3, v2) {
      if (f3(v2), q.shift(), q.length) resume(q[0][0], q[0][1]);
    }
  }
  function __asyncValues(o5) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m2 = o5[Symbol.asyncIterator], i5;
    return m2 ? m2.call(o5) : (o5 = typeof __values === "function" ? __values(o5) : o5[Symbol.iterator](), i5 = {}, verb("next"), verb("throw"), verb("return"), i5[Symbol.asyncIterator] = function() {
      return this;
    }, i5);
    function verb(n5) {
      i5[n5] = o5[n5] && function(v2) {
        return new Promise(function(resolve, reject) {
          v2 = o5[n5](v2), settle(resolve, reject, v2.done, v2.value);
        });
      };
    }
    function settle(resolve, reject, d3, v2) {
      Promise.resolve(v2).then(function(v3) {
        resolve({ value: v3, done: d3 });
      }, reject);
    }
  }

  // node_modules/rxjs/dist/esm5/internal/util/isFunction.js
  function isFunction(value) {
    return typeof value === "function";
  }

  // node_modules/rxjs/dist/esm5/internal/util/createErrorClass.js
  function createErrorClass(createImpl) {
    var _super = function(instance) {
      Error.call(instance);
      instance.stack = new Error().stack;
    };
    var ctorFunc = createImpl(_super);
    ctorFunc.prototype = Object.create(Error.prototype);
    ctorFunc.prototype.constructor = ctorFunc;
    return ctorFunc;
  }

  // node_modules/rxjs/dist/esm5/internal/util/UnsubscriptionError.js
  var UnsubscriptionError = createErrorClass(function(_super) {
    return function UnsubscriptionErrorImpl(errors) {
      _super(this);
      this.message = errors ? errors.length + " errors occurred during unsubscription:\n" + errors.map(function(err, i5) {
        return i5 + 1 + ") " + err.toString();
      }).join("\n  ") : "";
      this.name = "UnsubscriptionError";
      this.errors = errors;
    };
  });

  // node_modules/rxjs/dist/esm5/internal/util/arrRemove.js
  function arrRemove(arr, item) {
    if (arr) {
      var index = arr.indexOf(item);
      0 <= index && arr.splice(index, 1);
    }
  }

  // node_modules/rxjs/dist/esm5/internal/Subscription.js
  var Subscription = function() {
    function Subscription2(initialTeardown) {
      this.initialTeardown = initialTeardown;
      this.closed = false;
      this._parentage = null;
      this._finalizers = null;
    }
    Subscription2.prototype.unsubscribe = function() {
      var e_1, _a, e_2, _b;
      var errors;
      if (!this.closed) {
        this.closed = true;
        var _parentage = this._parentage;
        if (_parentage) {
          this._parentage = null;
          if (Array.isArray(_parentage)) {
            try {
              for (var _parentage_1 = __values(_parentage), _parentage_1_1 = _parentage_1.next(); !_parentage_1_1.done; _parentage_1_1 = _parentage_1.next()) {
                var parent_1 = _parentage_1_1.value;
                parent_1.remove(this);
              }
            } catch (e_1_1) {
              e_1 = { error: e_1_1 };
            } finally {
              try {
                if (_parentage_1_1 && !_parentage_1_1.done && (_a = _parentage_1.return)) _a.call(_parentage_1);
              } finally {
                if (e_1) throw e_1.error;
              }
            }
          } else {
            _parentage.remove(this);
          }
        }
        var initialFinalizer = this.initialTeardown;
        if (isFunction(initialFinalizer)) {
          try {
            initialFinalizer();
          } catch (e7) {
            errors = e7 instanceof UnsubscriptionError ? e7.errors : [e7];
          }
        }
        var _finalizers = this._finalizers;
        if (_finalizers) {
          this._finalizers = null;
          try {
            for (var _finalizers_1 = __values(_finalizers), _finalizers_1_1 = _finalizers_1.next(); !_finalizers_1_1.done; _finalizers_1_1 = _finalizers_1.next()) {
              var finalizer = _finalizers_1_1.value;
              try {
                execFinalizer(finalizer);
              } catch (err) {
                errors = errors !== null && errors !== void 0 ? errors : [];
                if (err instanceof UnsubscriptionError) {
                  errors = __spreadArray(__spreadArray([], __read(errors)), __read(err.errors));
                } else {
                  errors.push(err);
                }
              }
            }
          } catch (e_2_1) {
            e_2 = { error: e_2_1 };
          } finally {
            try {
              if (_finalizers_1_1 && !_finalizers_1_1.done && (_b = _finalizers_1.return)) _b.call(_finalizers_1);
            } finally {
              if (e_2) throw e_2.error;
            }
          }
        }
        if (errors) {
          throw new UnsubscriptionError(errors);
        }
      }
    };
    Subscription2.prototype.add = function(teardown) {
      var _a;
      if (teardown && teardown !== this) {
        if (this.closed) {
          execFinalizer(teardown);
        } else {
          if (teardown instanceof Subscription2) {
            if (teardown.closed || teardown._hasParent(this)) {
              return;
            }
            teardown._addParent(this);
          }
          (this._finalizers = (_a = this._finalizers) !== null && _a !== void 0 ? _a : []).push(teardown);
        }
      }
    };
    Subscription2.prototype._hasParent = function(parent) {
      var _parentage = this._parentage;
      return _parentage === parent || Array.isArray(_parentage) && _parentage.includes(parent);
    };
    Subscription2.prototype._addParent = function(parent) {
      var _parentage = this._parentage;
      this._parentage = Array.isArray(_parentage) ? (_parentage.push(parent), _parentage) : _parentage ? [_parentage, parent] : parent;
    };
    Subscription2.prototype._removeParent = function(parent) {
      var _parentage = this._parentage;
      if (_parentage === parent) {
        this._parentage = null;
      } else if (Array.isArray(_parentage)) {
        arrRemove(_parentage, parent);
      }
    };
    Subscription2.prototype.remove = function(teardown) {
      var _finalizers = this._finalizers;
      _finalizers && arrRemove(_finalizers, teardown);
      if (teardown instanceof Subscription2) {
        teardown._removeParent(this);
      }
    };
    Subscription2.EMPTY = function() {
      var empty = new Subscription2();
      empty.closed = true;
      return empty;
    }();
    return Subscription2;
  }();
  var EMPTY_SUBSCRIPTION = Subscription.EMPTY;
  function isSubscription(value) {
    return value instanceof Subscription || value && "closed" in value && isFunction(value.remove) && isFunction(value.add) && isFunction(value.unsubscribe);
  }
  function execFinalizer(finalizer) {
    if (isFunction(finalizer)) {
      finalizer();
    } else {
      finalizer.unsubscribe();
    }
  }

  // node_modules/rxjs/dist/esm5/internal/config.js
  var config = {
    onUnhandledError: null,
    onStoppedNotification: null,
    Promise: void 0,
    useDeprecatedSynchronousErrorHandling: false,
    useDeprecatedNextContext: false
  };

  // node_modules/rxjs/dist/esm5/internal/scheduler/timeoutProvider.js
  var timeoutProvider = {
    setTimeout: function(handler, timeout) {
      var args = [];
      for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
      }
      var delegate = timeoutProvider.delegate;
      if (delegate === null || delegate === void 0 ? void 0 : delegate.setTimeout) {
        return delegate.setTimeout.apply(delegate, __spreadArray([handler, timeout], __read(args)));
      }
      return setTimeout.apply(void 0, __spreadArray([handler, timeout], __read(args)));
    },
    clearTimeout: function(handle) {
      var delegate = timeoutProvider.delegate;
      return ((delegate === null || delegate === void 0 ? void 0 : delegate.clearTimeout) || clearTimeout)(handle);
    },
    delegate: void 0
  };

  // node_modules/rxjs/dist/esm5/internal/util/reportUnhandledError.js
  function reportUnhandledError(err) {
    timeoutProvider.setTimeout(function() {
      var onUnhandledError = config.onUnhandledError;
      if (onUnhandledError) {
        onUnhandledError(err);
      } else {
        throw err;
      }
    });
  }

  // node_modules/rxjs/dist/esm5/internal/util/noop.js
  function noop() {
  }

  // node_modules/rxjs/dist/esm5/internal/NotificationFactories.js
  var COMPLETE_NOTIFICATION = function() {
    return createNotification("C", void 0, void 0);
  }();
  function errorNotification(error) {
    return createNotification("E", void 0, error);
  }
  function nextNotification(value) {
    return createNotification("N", value, void 0);
  }
  function createNotification(kind, value, error) {
    return {
      kind,
      value,
      error
    };
  }

  // node_modules/rxjs/dist/esm5/internal/util/errorContext.js
  var context = null;
  function errorContext(cb) {
    if (config.useDeprecatedSynchronousErrorHandling) {
      var isRoot = !context;
      if (isRoot) {
        context = { errorThrown: false, error: null };
      }
      cb();
      if (isRoot) {
        var _a = context, errorThrown = _a.errorThrown, error = _a.error;
        context = null;
        if (errorThrown) {
          throw error;
        }
      }
    } else {
      cb();
    }
  }
  function captureError(err) {
    if (config.useDeprecatedSynchronousErrorHandling && context) {
      context.errorThrown = true;
      context.error = err;
    }
  }

  // node_modules/rxjs/dist/esm5/internal/Subscriber.js
  var Subscriber = function(_super) {
    __extends(Subscriber2, _super);
    function Subscriber2(destination) {
      var _this = _super.call(this) || this;
      _this.isStopped = false;
      if (destination) {
        _this.destination = destination;
        if (isSubscription(destination)) {
          destination.add(_this);
        }
      } else {
        _this.destination = EMPTY_OBSERVER;
      }
      return _this;
    }
    Subscriber2.create = function(next, error, complete) {
      return new SafeSubscriber(next, error, complete);
    };
    Subscriber2.prototype.next = function(value) {
      if (this.isStopped) {
        handleStoppedNotification(nextNotification(value), this);
      } else {
        this._next(value);
      }
    };
    Subscriber2.prototype.error = function(err) {
      if (this.isStopped) {
        handleStoppedNotification(errorNotification(err), this);
      } else {
        this.isStopped = true;
        this._error(err);
      }
    };
    Subscriber2.prototype.complete = function() {
      if (this.isStopped) {
        handleStoppedNotification(COMPLETE_NOTIFICATION, this);
      } else {
        this.isStopped = true;
        this._complete();
      }
    };
    Subscriber2.prototype.unsubscribe = function() {
      if (!this.closed) {
        this.isStopped = true;
        _super.prototype.unsubscribe.call(this);
        this.destination = null;
      }
    };
    Subscriber2.prototype._next = function(value) {
      this.destination.next(value);
    };
    Subscriber2.prototype._error = function(err) {
      try {
        this.destination.error(err);
      } finally {
        this.unsubscribe();
      }
    };
    Subscriber2.prototype._complete = function() {
      try {
        this.destination.complete();
      } finally {
        this.unsubscribe();
      }
    };
    return Subscriber2;
  }(Subscription);
  var _bind = Function.prototype.bind;
  function bind(fn, thisArg) {
    return _bind.call(fn, thisArg);
  }
  var ConsumerObserver = function() {
    function ConsumerObserver2(partialObserver) {
      this.partialObserver = partialObserver;
    }
    ConsumerObserver2.prototype.next = function(value) {
      var partialObserver = this.partialObserver;
      if (partialObserver.next) {
        try {
          partialObserver.next(value);
        } catch (error) {
          handleUnhandledError(error);
        }
      }
    };
    ConsumerObserver2.prototype.error = function(err) {
      var partialObserver = this.partialObserver;
      if (partialObserver.error) {
        try {
          partialObserver.error(err);
        } catch (error) {
          handleUnhandledError(error);
        }
      } else {
        handleUnhandledError(err);
      }
    };
    ConsumerObserver2.prototype.complete = function() {
      var partialObserver = this.partialObserver;
      if (partialObserver.complete) {
        try {
          partialObserver.complete();
        } catch (error) {
          handleUnhandledError(error);
        }
      }
    };
    return ConsumerObserver2;
  }();
  var SafeSubscriber = function(_super) {
    __extends(SafeSubscriber2, _super);
    function SafeSubscriber2(observerOrNext, error, complete) {
      var _this = _super.call(this) || this;
      var partialObserver;
      if (isFunction(observerOrNext) || !observerOrNext) {
        partialObserver = {
          next: observerOrNext !== null && observerOrNext !== void 0 ? observerOrNext : void 0,
          error: error !== null && error !== void 0 ? error : void 0,
          complete: complete !== null && complete !== void 0 ? complete : void 0
        };
      } else {
        var context_1;
        if (_this && config.useDeprecatedNextContext) {
          context_1 = Object.create(observerOrNext);
          context_1.unsubscribe = function() {
            return _this.unsubscribe();
          };
          partialObserver = {
            next: observerOrNext.next && bind(observerOrNext.next, context_1),
            error: observerOrNext.error && bind(observerOrNext.error, context_1),
            complete: observerOrNext.complete && bind(observerOrNext.complete, context_1)
          };
        } else {
          partialObserver = observerOrNext;
        }
      }
      _this.destination = new ConsumerObserver(partialObserver);
      return _this;
    }
    return SafeSubscriber2;
  }(Subscriber);
  function handleUnhandledError(error) {
    if (config.useDeprecatedSynchronousErrorHandling) {
      captureError(error);
    } else {
      reportUnhandledError(error);
    }
  }
  function defaultErrorHandler(err) {
    throw err;
  }
  function handleStoppedNotification(notification, subscriber) {
    var onStoppedNotification = config.onStoppedNotification;
    onStoppedNotification && timeoutProvider.setTimeout(function() {
      return onStoppedNotification(notification, subscriber);
    });
  }
  var EMPTY_OBSERVER = {
    closed: true,
    next: noop,
    error: defaultErrorHandler,
    complete: noop
  };

  // node_modules/rxjs/dist/esm5/internal/symbol/observable.js
  var observable = function() {
    return typeof Symbol === "function" && Symbol.observable || "@@observable";
  }();

  // node_modules/rxjs/dist/esm5/internal/util/identity.js
  function identity(x2) {
    return x2;
  }

  // node_modules/rxjs/dist/esm5/internal/util/pipe.js
  function pipeFromArray(fns) {
    if (fns.length === 0) {
      return identity;
    }
    if (fns.length === 1) {
      return fns[0];
    }
    return function piped(input) {
      return fns.reduce(function(prev, fn) {
        return fn(prev);
      }, input);
    };
  }

  // node_modules/rxjs/dist/esm5/internal/Observable.js
  var Observable = function() {
    function Observable2(subscribe2) {
      if (subscribe2) {
        this._subscribe = subscribe2;
      }
    }
    Observable2.prototype.lift = function(operator) {
      var observable2 = new Observable2();
      observable2.source = this;
      observable2.operator = operator;
      return observable2;
    };
    Observable2.prototype.subscribe = function(observerOrNext, error, complete) {
      var _this = this;
      var subscriber = isSubscriber(observerOrNext) ? observerOrNext : new SafeSubscriber(observerOrNext, error, complete);
      errorContext(function() {
        var _a = _this, operator = _a.operator, source = _a.source;
        subscriber.add(operator ? operator.call(subscriber, source) : source ? _this._subscribe(subscriber) : _this._trySubscribe(subscriber));
      });
      return subscriber;
    };
    Observable2.prototype._trySubscribe = function(sink) {
      try {
        return this._subscribe(sink);
      } catch (err) {
        sink.error(err);
      }
    };
    Observable2.prototype.forEach = function(next, promiseCtor) {
      var _this = this;
      promiseCtor = getPromiseCtor(promiseCtor);
      return new promiseCtor(function(resolve, reject) {
        var subscriber = new SafeSubscriber({
          next: function(value) {
            try {
              next(value);
            } catch (err) {
              reject(err);
              subscriber.unsubscribe();
            }
          },
          error: reject,
          complete: resolve
        });
        _this.subscribe(subscriber);
      });
    };
    Observable2.prototype._subscribe = function(subscriber) {
      var _a;
      return (_a = this.source) === null || _a === void 0 ? void 0 : _a.subscribe(subscriber);
    };
    Observable2.prototype[observable] = function() {
      return this;
    };
    Observable2.prototype.pipe = function() {
      var operations = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        operations[_i] = arguments[_i];
      }
      return pipeFromArray(operations)(this);
    };
    Observable2.prototype.toPromise = function(promiseCtor) {
      var _this = this;
      promiseCtor = getPromiseCtor(promiseCtor);
      return new promiseCtor(function(resolve, reject) {
        var value;
        _this.subscribe(function(x2) {
          return value = x2;
        }, function(err) {
          return reject(err);
        }, function() {
          return resolve(value);
        });
      });
    };
    Observable2.create = function(subscribe2) {
      return new Observable2(subscribe2);
    };
    return Observable2;
  }();
  function getPromiseCtor(promiseCtor) {
    var _a;
    return (_a = promiseCtor !== null && promiseCtor !== void 0 ? promiseCtor : config.Promise) !== null && _a !== void 0 ? _a : Promise;
  }
  function isObserver(value) {
    return value && isFunction(value.next) && isFunction(value.error) && isFunction(value.complete);
  }
  function isSubscriber(value) {
    return value && value instanceof Subscriber || isObserver(value) && isSubscription(value);
  }

  // node_modules/rxjs/dist/esm5/internal/util/lift.js
  function hasLift(source) {
    return isFunction(source === null || source === void 0 ? void 0 : source.lift);
  }
  function operate(init) {
    return function(source) {
      if (hasLift(source)) {
        return source.lift(function(liftedSource) {
          try {
            return init(liftedSource, this);
          } catch (err) {
            this.error(err);
          }
        });
      }
      throw new TypeError("Unable to lift unknown Observable type");
    };
  }

  // node_modules/rxjs/dist/esm5/internal/operators/OperatorSubscriber.js
  function createOperatorSubscriber(destination, onNext, onComplete, onError, onFinalize) {
    return new OperatorSubscriber(destination, onNext, onComplete, onError, onFinalize);
  }
  var OperatorSubscriber = function(_super) {
    __extends(OperatorSubscriber2, _super);
    function OperatorSubscriber2(destination, onNext, onComplete, onError, onFinalize, shouldUnsubscribe) {
      var _this = _super.call(this, destination) || this;
      _this.onFinalize = onFinalize;
      _this.shouldUnsubscribe = shouldUnsubscribe;
      _this._next = onNext ? function(value) {
        try {
          onNext(value);
        } catch (err) {
          destination.error(err);
        }
      } : _super.prototype._next;
      _this._error = onError ? function(err) {
        try {
          onError(err);
        } catch (err2) {
          destination.error(err2);
        } finally {
          this.unsubscribe();
        }
      } : _super.prototype._error;
      _this._complete = onComplete ? function() {
        try {
          onComplete();
        } catch (err) {
          destination.error(err);
        } finally {
          this.unsubscribe();
        }
      } : _super.prototype._complete;
      return _this;
    }
    OperatorSubscriber2.prototype.unsubscribe = function() {
      var _a;
      if (!this.shouldUnsubscribe || this.shouldUnsubscribe()) {
        var closed_1 = this.closed;
        _super.prototype.unsubscribe.call(this);
        !closed_1 && ((_a = this.onFinalize) === null || _a === void 0 ? void 0 : _a.call(this));
      }
    };
    return OperatorSubscriber2;
  }(Subscriber);

  // node_modules/rxjs/dist/esm5/internal/util/ObjectUnsubscribedError.js
  var ObjectUnsubscribedError = createErrorClass(function(_super) {
    return function ObjectUnsubscribedErrorImpl() {
      _super(this);
      this.name = "ObjectUnsubscribedError";
      this.message = "object unsubscribed";
    };
  });

  // node_modules/rxjs/dist/esm5/internal/Subject.js
  var Subject = function(_super) {
    __extends(Subject2, _super);
    function Subject2() {
      var _this = _super.call(this) || this;
      _this.closed = false;
      _this.currentObservers = null;
      _this.observers = [];
      _this.isStopped = false;
      _this.hasError = false;
      _this.thrownError = null;
      return _this;
    }
    Subject2.prototype.lift = function(operator) {
      var subject = new AnonymousSubject(this, this);
      subject.operator = operator;
      return subject;
    };
    Subject2.prototype._throwIfClosed = function() {
      if (this.closed) {
        throw new ObjectUnsubscribedError();
      }
    };
    Subject2.prototype.next = function(value) {
      var _this = this;
      errorContext(function() {
        var e_1, _a;
        _this._throwIfClosed();
        if (!_this.isStopped) {
          if (!_this.currentObservers) {
            _this.currentObservers = Array.from(_this.observers);
          }
          try {
            for (var _b = __values(_this.currentObservers), _c = _b.next(); !_c.done; _c = _b.next()) {
              var observer = _c.value;
              observer.next(value);
            }
          } catch (e_1_1) {
            e_1 = { error: e_1_1 };
          } finally {
            try {
              if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            } finally {
              if (e_1) throw e_1.error;
            }
          }
        }
      });
    };
    Subject2.prototype.error = function(err) {
      var _this = this;
      errorContext(function() {
        _this._throwIfClosed();
        if (!_this.isStopped) {
          _this.hasError = _this.isStopped = true;
          _this.thrownError = err;
          var observers = _this.observers;
          while (observers.length) {
            observers.shift().error(err);
          }
        }
      });
    };
    Subject2.prototype.complete = function() {
      var _this = this;
      errorContext(function() {
        _this._throwIfClosed();
        if (!_this.isStopped) {
          _this.isStopped = true;
          var observers = _this.observers;
          while (observers.length) {
            observers.shift().complete();
          }
        }
      });
    };
    Subject2.prototype.unsubscribe = function() {
      this.isStopped = this.closed = true;
      this.observers = this.currentObservers = null;
    };
    Object.defineProperty(Subject2.prototype, "observed", {
      get: function() {
        var _a;
        return ((_a = this.observers) === null || _a === void 0 ? void 0 : _a.length) > 0;
      },
      enumerable: false,
      configurable: true
    });
    Subject2.prototype._trySubscribe = function(subscriber) {
      this._throwIfClosed();
      return _super.prototype._trySubscribe.call(this, subscriber);
    };
    Subject2.prototype._subscribe = function(subscriber) {
      this._throwIfClosed();
      this._checkFinalizedStatuses(subscriber);
      return this._innerSubscribe(subscriber);
    };
    Subject2.prototype._innerSubscribe = function(subscriber) {
      var _this = this;
      var _a = this, hasError = _a.hasError, isStopped = _a.isStopped, observers = _a.observers;
      if (hasError || isStopped) {
        return EMPTY_SUBSCRIPTION;
      }
      this.currentObservers = null;
      observers.push(subscriber);
      return new Subscription(function() {
        _this.currentObservers = null;
        arrRemove(observers, subscriber);
      });
    };
    Subject2.prototype._checkFinalizedStatuses = function(subscriber) {
      var _a = this, hasError = _a.hasError, thrownError = _a.thrownError, isStopped = _a.isStopped;
      if (hasError) {
        subscriber.error(thrownError);
      } else if (isStopped) {
        subscriber.complete();
      }
    };
    Subject2.prototype.asObservable = function() {
      var observable2 = new Observable();
      observable2.source = this;
      return observable2;
    };
    Subject2.create = function(destination, source) {
      return new AnonymousSubject(destination, source);
    };
    return Subject2;
  }(Observable);
  var AnonymousSubject = function(_super) {
    __extends(AnonymousSubject2, _super);
    function AnonymousSubject2(destination, source) {
      var _this = _super.call(this) || this;
      _this.destination = destination;
      _this.source = source;
      return _this;
    }
    AnonymousSubject2.prototype.next = function(value) {
      var _a, _b;
      (_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.next) === null || _b === void 0 ? void 0 : _b.call(_a, value);
    };
    AnonymousSubject2.prototype.error = function(err) {
      var _a, _b;
      (_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, err);
    };
    AnonymousSubject2.prototype.complete = function() {
      var _a, _b;
      (_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.complete) === null || _b === void 0 ? void 0 : _b.call(_a);
    };
    AnonymousSubject2.prototype._subscribe = function(subscriber) {
      var _a, _b;
      return (_b = (_a = this.source) === null || _a === void 0 ? void 0 : _a.subscribe(subscriber)) !== null && _b !== void 0 ? _b : EMPTY_SUBSCRIPTION;
    };
    return AnonymousSubject2;
  }(Subject);

  // node_modules/rxjs/dist/esm5/internal/BehaviorSubject.js
  var BehaviorSubject = function(_super) {
    __extends(BehaviorSubject2, _super);
    function BehaviorSubject2(_value) {
      var _this = _super.call(this) || this;
      _this._value = _value;
      return _this;
    }
    Object.defineProperty(BehaviorSubject2.prototype, "value", {
      get: function() {
        return this.getValue();
      },
      enumerable: false,
      configurable: true
    });
    BehaviorSubject2.prototype._subscribe = function(subscriber) {
      var subscription = _super.prototype._subscribe.call(this, subscriber);
      !subscription.closed && subscriber.next(this._value);
      return subscription;
    };
    BehaviorSubject2.prototype.getValue = function() {
      var _a = this, hasError = _a.hasError, thrownError = _a.thrownError, _value = _a._value;
      if (hasError) {
        throw thrownError;
      }
      this._throwIfClosed();
      return _value;
    };
    BehaviorSubject2.prototype.next = function(value) {
      _super.prototype.next.call(this, this._value = value);
    };
    return BehaviorSubject2;
  }(Subject);

  // node_modules/rxjs/dist/esm5/internal/scheduler/dateTimestampProvider.js
  var dateTimestampProvider = {
    now: function() {
      return (dateTimestampProvider.delegate || Date).now();
    },
    delegate: void 0
  };

  // node_modules/rxjs/dist/esm5/internal/ReplaySubject.js
  var ReplaySubject = function(_super) {
    __extends(ReplaySubject2, _super);
    function ReplaySubject2(_bufferSize, _windowTime, _timestampProvider) {
      if (_bufferSize === void 0) {
        _bufferSize = Infinity;
      }
      if (_windowTime === void 0) {
        _windowTime = Infinity;
      }
      if (_timestampProvider === void 0) {
        _timestampProvider = dateTimestampProvider;
      }
      var _this = _super.call(this) || this;
      _this._bufferSize = _bufferSize;
      _this._windowTime = _windowTime;
      _this._timestampProvider = _timestampProvider;
      _this._buffer = [];
      _this._infiniteTimeWindow = true;
      _this._infiniteTimeWindow = _windowTime === Infinity;
      _this._bufferSize = Math.max(1, _bufferSize);
      _this._windowTime = Math.max(1, _windowTime);
      return _this;
    }
    ReplaySubject2.prototype.next = function(value) {
      var _a = this, isStopped = _a.isStopped, _buffer = _a._buffer, _infiniteTimeWindow = _a._infiniteTimeWindow, _timestampProvider = _a._timestampProvider, _windowTime = _a._windowTime;
      if (!isStopped) {
        _buffer.push(value);
        !_infiniteTimeWindow && _buffer.push(_timestampProvider.now() + _windowTime);
      }
      this._trimBuffer();
      _super.prototype.next.call(this, value);
    };
    ReplaySubject2.prototype._subscribe = function(subscriber) {
      this._throwIfClosed();
      this._trimBuffer();
      var subscription = this._innerSubscribe(subscriber);
      var _a = this, _infiniteTimeWindow = _a._infiniteTimeWindow, _buffer = _a._buffer;
      var copy = _buffer.slice();
      for (var i5 = 0; i5 < copy.length && !subscriber.closed; i5 += _infiniteTimeWindow ? 1 : 2) {
        subscriber.next(copy[i5]);
      }
      this._checkFinalizedStatuses(subscriber);
      return subscription;
    };
    ReplaySubject2.prototype._trimBuffer = function() {
      var _a = this, _bufferSize = _a._bufferSize, _timestampProvider = _a._timestampProvider, _buffer = _a._buffer, _infiniteTimeWindow = _a._infiniteTimeWindow;
      var adjustedBufferSize = (_infiniteTimeWindow ? 1 : 2) * _bufferSize;
      _bufferSize < Infinity && adjustedBufferSize < _buffer.length && _buffer.splice(0, _buffer.length - adjustedBufferSize);
      if (!_infiniteTimeWindow) {
        var now = _timestampProvider.now();
        var last = 0;
        for (var i5 = 1; i5 < _buffer.length && _buffer[i5] <= now; i5 += 2) {
          last = i5;
        }
        last && _buffer.splice(0, last + 1);
      }
    };
    return ReplaySubject2;
  }(Subject);

  // node_modules/rxjs/dist/esm5/internal/util/isArrayLike.js
  var isArrayLike = function(x2) {
    return x2 && typeof x2.length === "number" && typeof x2 !== "function";
  };

  // node_modules/rxjs/dist/esm5/internal/util/isPromise.js
  function isPromise(value) {
    return isFunction(value === null || value === void 0 ? void 0 : value.then);
  }

  // node_modules/rxjs/dist/esm5/internal/util/isInteropObservable.js
  function isInteropObservable(input) {
    return isFunction(input[observable]);
  }

  // node_modules/rxjs/dist/esm5/internal/util/isAsyncIterable.js
  function isAsyncIterable(obj) {
    return Symbol.asyncIterator && isFunction(obj === null || obj === void 0 ? void 0 : obj[Symbol.asyncIterator]);
  }

  // node_modules/rxjs/dist/esm5/internal/util/throwUnobservableError.js
  function createInvalidObservableTypeError(input) {
    return new TypeError("You provided " + (input !== null && typeof input === "object" ? "an invalid object" : "'" + input + "'") + " where a stream was expected. You can provide an Observable, Promise, ReadableStream, Array, AsyncIterable, or Iterable.");
  }

  // node_modules/rxjs/dist/esm5/internal/symbol/iterator.js
  function getSymbolIterator() {
    if (typeof Symbol !== "function" || !Symbol.iterator) {
      return "@@iterator";
    }
    return Symbol.iterator;
  }
  var iterator = getSymbolIterator();

  // node_modules/rxjs/dist/esm5/internal/util/isIterable.js
  function isIterable(input) {
    return isFunction(input === null || input === void 0 ? void 0 : input[iterator]);
  }

  // node_modules/rxjs/dist/esm5/internal/util/isReadableStreamLike.js
  function readableStreamLikeToAsyncGenerator(readableStream) {
    return __asyncGenerator(this, arguments, function readableStreamLikeToAsyncGenerator_1() {
      var reader, _a, value, done;
      return __generator(this, function(_b) {
        switch (_b.label) {
          case 0:
            reader = readableStream.getReader();
            _b.label = 1;
          case 1:
            _b.trys.push([1, , 9, 10]);
            _b.label = 2;
          case 2:
            if (false) return [3, 8];
            return [4, __await(reader.read())];
          case 3:
            _a = _b.sent(), value = _a.value, done = _a.done;
            if (!done) return [3, 5];
            return [4, __await(void 0)];
          case 4:
            return [2, _b.sent()];
          case 5:
            return [4, __await(value)];
          case 6:
            return [4, _b.sent()];
          case 7:
            _b.sent();
            return [3, 2];
          case 8:
            return [3, 10];
          case 9:
            reader.releaseLock();
            return [7];
          case 10:
            return [2];
        }
      });
    });
  }
  function isReadableStreamLike(obj) {
    return isFunction(obj === null || obj === void 0 ? void 0 : obj.getReader);
  }

  // node_modules/rxjs/dist/esm5/internal/observable/innerFrom.js
  function innerFrom(input) {
    if (input instanceof Observable) {
      return input;
    }
    if (input != null) {
      if (isInteropObservable(input)) {
        return fromInteropObservable(input);
      }
      if (isArrayLike(input)) {
        return fromArrayLike(input);
      }
      if (isPromise(input)) {
        return fromPromise(input);
      }
      if (isAsyncIterable(input)) {
        return fromAsyncIterable(input);
      }
      if (isIterable(input)) {
        return fromIterable(input);
      }
      if (isReadableStreamLike(input)) {
        return fromReadableStreamLike(input);
      }
    }
    throw createInvalidObservableTypeError(input);
  }
  function fromInteropObservable(obj) {
    return new Observable(function(subscriber) {
      var obs = obj[observable]();
      if (isFunction(obs.subscribe)) {
        return obs.subscribe(subscriber);
      }
      throw new TypeError("Provided object does not correctly implement Symbol.observable");
    });
  }
  function fromArrayLike(array) {
    return new Observable(function(subscriber) {
      for (var i5 = 0; i5 < array.length && !subscriber.closed; i5++) {
        subscriber.next(array[i5]);
      }
      subscriber.complete();
    });
  }
  function fromPromise(promise) {
    return new Observable(function(subscriber) {
      promise.then(function(value) {
        if (!subscriber.closed) {
          subscriber.next(value);
          subscriber.complete();
        }
      }, function(err) {
        return subscriber.error(err);
      }).then(null, reportUnhandledError);
    });
  }
  function fromIterable(iterable) {
    return new Observable(function(subscriber) {
      var e_1, _a;
      try {
        for (var iterable_1 = __values(iterable), iterable_1_1 = iterable_1.next(); !iterable_1_1.done; iterable_1_1 = iterable_1.next()) {
          var value = iterable_1_1.value;
          subscriber.next(value);
          if (subscriber.closed) {
            return;
          }
        }
      } catch (e_1_1) {
        e_1 = { error: e_1_1 };
      } finally {
        try {
          if (iterable_1_1 && !iterable_1_1.done && (_a = iterable_1.return)) _a.call(iterable_1);
        } finally {
          if (e_1) throw e_1.error;
        }
      }
      subscriber.complete();
    });
  }
  function fromAsyncIterable(asyncIterable) {
    return new Observable(function(subscriber) {
      process(asyncIterable, subscriber).catch(function(err) {
        return subscriber.error(err);
      });
    });
  }
  function fromReadableStreamLike(readableStream) {
    return fromAsyncIterable(readableStreamLikeToAsyncGenerator(readableStream));
  }
  function process(asyncIterable, subscriber) {
    var asyncIterable_1, asyncIterable_1_1;
    var e_2, _a;
    return __awaiter(this, void 0, void 0, function() {
      var value, e_2_1;
      return __generator(this, function(_b) {
        switch (_b.label) {
          case 0:
            _b.trys.push([0, 5, 6, 11]);
            asyncIterable_1 = __asyncValues(asyncIterable);
            _b.label = 1;
          case 1:
            return [4, asyncIterable_1.next()];
          case 2:
            if (!(asyncIterable_1_1 = _b.sent(), !asyncIterable_1_1.done)) return [3, 4];
            value = asyncIterable_1_1.value;
            subscriber.next(value);
            if (subscriber.closed) {
              return [2];
            }
            _b.label = 3;
          case 3:
            return [3, 1];
          case 4:
            return [3, 11];
          case 5:
            e_2_1 = _b.sent();
            e_2 = { error: e_2_1 };
            return [3, 11];
          case 6:
            _b.trys.push([6, , 9, 10]);
            if (!(asyncIterable_1_1 && !asyncIterable_1_1.done && (_a = asyncIterable_1.return))) return [3, 8];
            return [4, _a.call(asyncIterable_1)];
          case 7:
            _b.sent();
            _b.label = 8;
          case 8:
            return [3, 10];
          case 9:
            if (e_2) throw e_2.error;
            return [7];
          case 10:
            return [7];
          case 11:
            subscriber.complete();
            return [2];
        }
      });
    });
  }

  // node_modules/rxjs/dist/esm5/internal/operators/map.js
  function map(project, thisArg) {
    return operate(function(source, subscriber) {
      var index = 0;
      source.subscribe(createOperatorSubscriber(subscriber, function(value) {
        subscriber.next(project.call(thisArg, value, index++));
      }));
    });
  }

  // node_modules/rxjs/dist/esm5/internal/operators/distinctUntilChanged.js
  function distinctUntilChanged(comparator, keySelector) {
    if (keySelector === void 0) {
      keySelector = identity;
    }
    comparator = comparator !== null && comparator !== void 0 ? comparator : defaultCompare;
    return operate(function(source, subscriber) {
      var previousKey;
      var first = true;
      source.subscribe(createOperatorSubscriber(subscriber, function(value) {
        var currentKey = keySelector(value);
        if (first || !comparator(previousKey, currentKey)) {
          first = false;
          previousKey = currentKey;
          subscriber.next(value);
        }
      }));
    });
  }
  function defaultCompare(a3, b3) {
    return a3 === b3;
  }

  // node_modules/rxjs/dist/esm5/internal/operators/share.js
  function share(options) {
    if (options === void 0) {
      options = {};
    }
    var _a = options.connector, connector = _a === void 0 ? function() {
      return new Subject();
    } : _a, _b = options.resetOnError, resetOnError = _b === void 0 ? true : _b, _c = options.resetOnComplete, resetOnComplete = _c === void 0 ? true : _c, _d = options.resetOnRefCountZero, resetOnRefCountZero = _d === void 0 ? true : _d;
    return function(wrapperSource) {
      var connection;
      var resetConnection;
      var subject;
      var refCount = 0;
      var hasCompleted = false;
      var hasErrored = false;
      var cancelReset = function() {
        resetConnection === null || resetConnection === void 0 ? void 0 : resetConnection.unsubscribe();
        resetConnection = void 0;
      };
      var reset = function() {
        cancelReset();
        connection = subject = void 0;
        hasCompleted = hasErrored = false;
      };
      var resetAndUnsubscribe = function() {
        var conn = connection;
        reset();
        conn === null || conn === void 0 ? void 0 : conn.unsubscribe();
      };
      return operate(function(source, subscriber) {
        refCount++;
        if (!hasErrored && !hasCompleted) {
          cancelReset();
        }
        var dest = subject = subject !== null && subject !== void 0 ? subject : connector();
        subscriber.add(function() {
          refCount--;
          if (refCount === 0 && !hasErrored && !hasCompleted) {
            resetConnection = handleReset(resetAndUnsubscribe, resetOnRefCountZero);
          }
        });
        dest.subscribe(subscriber);
        if (!connection && refCount > 0) {
          connection = new SafeSubscriber({
            next: function(value) {
              return dest.next(value);
            },
            error: function(err) {
              hasErrored = true;
              cancelReset();
              resetConnection = handleReset(reset, resetOnError, err);
              dest.error(err);
            },
            complete: function() {
              hasCompleted = true;
              cancelReset();
              resetConnection = handleReset(reset, resetOnComplete);
              dest.complete();
            }
          });
          innerFrom(source).subscribe(connection);
        }
      })(wrapperSource);
    };
  }
  function handleReset(reset, on) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
      args[_i - 2] = arguments[_i];
    }
    if (on === true) {
      reset();
      return;
    }
    if (on === false) {
      return;
    }
    var onSubscriber = new SafeSubscriber({
      next: function() {
        onSubscriber.unsubscribe();
        reset();
      }
    });
    return innerFrom(on.apply(void 0, __spreadArray([], __read(args)))).subscribe(onSubscriber);
  }

  // node_modules/rxjs/dist/esm5/internal/operators/shareReplay.js
  function shareReplay(configOrBufferSize, windowTime, scheduler) {
    var _a, _b, _c;
    var bufferSize;
    var refCount = false;
    if (configOrBufferSize && typeof configOrBufferSize === "object") {
      _a = configOrBufferSize.bufferSize, bufferSize = _a === void 0 ? Infinity : _a, _b = configOrBufferSize.windowTime, windowTime = _b === void 0 ? Infinity : _b, _c = configOrBufferSize.refCount, refCount = _c === void 0 ? false : _c, scheduler = configOrBufferSize.scheduler;
    } else {
      bufferSize = configOrBufferSize !== null && configOrBufferSize !== void 0 ? configOrBufferSize : Infinity;
    }
    return share({
      connector: function() {
        return new ReplaySubject(bufferSize, windowTime, scheduler);
      },
      resetOnError: true,
      resetOnComplete: false,
      resetOnRefCountZero: refCount
    });
  }

  // src/elements/utils.ts
  function fire(el, eventName) {
    el.dispatchEvent(new CustomEvent(eventName, { composed: true, bubbles: true }));
  }
  function select(obs$, mapper) {
    return obs$.pipe(map(mapper), distinctUntilChanged(deepEqual), shareReplay(1));
  }
  function deepEqual(a3, b3) {
    if (a3 === b3) return true;
    if (a3 === void 0 || b3 === void 0) return false;
    if (a3 === null || b3 === null) return false;
    if (typeof a3 === "object") {
      if (typeof b3 !== "object") return false;
      const aObj = a3;
      const bObj = b3;
      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);
      if (aKeys.length !== bKeys.length) return false;
      for (const key of aKeys) {
        if (!deepEqual(aObj[key], bObj[key])) return false;
      }
      return true;
    }
    return false;
  }
  function playerIdFromChannel(channel) {
    if (!channel.startsWith("/player/p")) return 0;
    const playerIdString = channel.substring("/player/p".length);
    return Number(playerIdString);
  }
  function hasBomb(cards) {
    let highest = null;
    for (let color = 1; color <= 4; color++) {
      let values = cards.filter((c4) => Number(c4.type) === color).map((c4) => Number(c4.type_arg)).sort((a3, b3) => a3 - b3);
      for (let idx = 0; idx < values.length - 4; idx++) {
        const numBegin = values[idx];
        for (let idy = idx + 4; idy < values.length; idy++) {
          const numEnd = values[idy];
          let length = idy - idx + 1;
          if (numEnd === numBegin + length - 1) {
            return true;
          }
        }
      }
    }
    for (let value = 2; value <= 13; value++) {
      let cardsWithValue = cards.filter((c4) => Number(c4.type_arg) === value);
      if (cardsWithValue.length === 4) {
        return true;
      }
    }
    return false;
  }

  // src/elements/model.ts
  var EMPTY_PLAYER = {
    player: {},
    cards: [],
    bet: "-2" /* INITIAL */,
    active: false,
    roundPoints: 0,
    gamePoints: 0
  };
  var initialState = {
    step: 0,
    round: 0,
    trick: {
      id: 0,
      combos: []
    },
    activePlayerId: 0,
    firstoutPlayerId: 0,
    wish: 0,
    players: [EMPTY_PLAYER, EMPTY_PLAYER, EMPTY_PLAYER, EMPTY_PLAYER],
    passedCards: []
  };
  var Model = class {
    constructor() {
      this.subject$ = new BehaviorSubject(initialState);
      this.state$ = this.subject$.asObservable();
      this.trick$ = select(this.state$, (state) => state.trick);
      this.round$ = select(this.state$, (state) => state.round);
      this.wish$ = select(this.state$, (state) => state.wish);
      this.players$ = select(this.state$, (state) => state.players);
      this.playerIds$ = select(this.players$, (players) => players.map((p3) => p3.player.id));
      this.playerNames$ = select(
        this.players$,
        (players) => players.map((p3) => p3.player.name)
      );
      this.passedCards$ = select(this.state$, (state) => state.passedCards);
      this.player$ = (playerId) => select(this.state$, (state) => state.players.find((p3) => p3.player.id == playerId));
      this.latestCombo$ = (playerId) => select(this.state$, (state) => state.trick.combos.findLast((c4) => c4.playerId == playerId));
      this.lastComboPlayer$ = select(this.state$, (state) => {
        const l3 = state.trick.combos.length;
        return state.trick.combos[l3 - 1]?.playerId;
      });
    }
    getState() {
      return this.subject$.getValue();
    }
    setState(state) {
      this.subject$.next(state);
    }
    updateState(state) {
      this.setState({ ...this.getState(), ...state });
    }
    init(players) {
      if (players.length != 4) throw new Error("model requires 4 player ids");
      this.updateState({
        round: 1,
        players: players.map((p3) => ({
          ...EMPTY_PLAYER,
          player: p3
        }))
      });
    }
    updatePlayerState(playerId, update) {
      const players = this.getState().players.map((p3) => {
        if (p3.player.id != playerId) return p3;
        return { ...p3, ...update };
      });
      this.updateState({ players });
    }
    getPlayerIds() {
      return this.getState().players.map((p3) => p3.player.id);
    }
    getPlayerState(playerId) {
      const playerState = this.getState().players.find((p3) => p3.player.id == playerId);
      if (!playerState) throw new Error(`Could not find player state for player id ${playerId}.`);
      return playerState;
    }
    setWish(wish) {
      this.updateState({ wish });
    }
    mahjongWishGranted() {
      this.updateState({ wish: 0 });
    }
    dealCards(playerId, newCards) {
      const playerState = this.getPlayerState(playerId);
      this.updatePlayerState(playerId, { cards: [...playerState.cards, ...newCards] });
    }
    bet(playerId, bet) {
      this.updatePlayerState(playerId, { bet });
    }
    pass(playerId) {
      this.playCombo(playerId, []);
    }
    acceptCards(playerId) {
      const passedCards = this.getState().passedCards.filter(
        (passedCard) => passedCard.to === playerId
      );
      const cards = passedCards.map((passedCard) => passedCard.card);
      for (const card of cards) {
        this.acceptPassedCard(playerId, card);
      }
      this.dealCards(playerId, cards);
    }
    passCards(playerId, cardIds) {
      if (cardIds.length !== 3) throw new Error("3 cards must be passed");
      const nextId = this.nextPlayerId(playerId);
      const partnerId = this.nextPlayerId(nextId);
      const previousId = this.nextPlayerId(partnerId);
      this.addPassedCard(playerId, previousId, this.getCardById(playerId, cardIds[0]));
      this.addPassedCard(playerId, partnerId, this.getCardById(playerId, cardIds[1]));
      this.addPassedCard(playerId, nextId, this.getCardById(playerId, cardIds[2]));
      this.removeCardsById(playerId, cardIds);
    }
    addPassedCard(from, to, card) {
      const passedCards = [...this.getState().passedCards];
      passedCards.push({ from, to, card, accepted: false });
      this.updateState({ passedCards });
    }
    acceptPassedCard(to, card) {
      const passedCards = [...this.getState().passedCards];
      const i5 = passedCards.findIndex((passedCard) => passedCard.card.id === card.id);
      const updatedPassedCard = { ...passedCards[i5], accepted: true };
      passedCards[i5] = updatedPassedCard;
      this.updateState({ passedCards });
    }
    getCardById(playerId, cardId) {
      const playerState = this.getPlayerState(playerId);
      return playerState.cards.find((c4) => c4.id === cardId);
    }
    removeCardsById(playerId, cardIds) {
      const playerState = this.getPlayerState(playerId);
      const cards = [...playerState.cards].filter((c4) => !cardIds.includes(c4.id));
      this.updatePlayerState(playerId, { cards });
    }
    setActive(activePlayerIds) {
      for (const playerId of this.getPlayerIds()) {
        const active = activePlayerIds.includes(playerId);
        this.updatePlayerState(playerId, { active });
      }
    }
    playCombo(playerId, playedCards, points = 0) {
      const playerState = this.getPlayerState(playerId);
      const remainingCards = playerState.cards.filter((c4) => {
        return playedCards.find((d3) => c4.type === d3.type && c4.type_arg === d3.type_arg) === void 0;
      });
      this.updatePlayerState(playerId, { cards: remainingCards });
      const combo = { playerId, cards: playedCards, points };
      const combos = [...this.getState().trick.combos];
      combos.push(combo);
      const trick = { ...this.getState().trick, combos };
      this.updateState({ trick });
      this.updateState({ activePlayerId: this.nextPlayerId(playerId) });
    }
    nextPlayerId(playerId) {
      const player = this.getPlayerState(playerId);
      const nextPlayerState = this.getState().players.find(
        (p3) => Number(p3.player.no) % 4 == (Number(player.player.no) + 1) % 4
      );
      return nextPlayerState.player.id;
    }
    setBet(playerId, bet) {
      this.updatePlayerState(playerId, { bet });
    }
    setGamePoints(playerId, gamePoints) {
      this.updatePlayerState(playerId, { gamePoints });
    }
    beginNewRound() {
      const playerIds = this.getPlayerIds();
      for (const playerId of playerIds) {
        this.updatePlayerState(playerId, {
          cards: [],
          bet: "-2" /* INITIAL */,
          active: false,
          roundPoints: 0
        });
      }
      this.updateState({
        round: this.getState().round + 1,
        trick: { id: 0, combos: [] },
        activePlayerId: 0,
        firstoutPlayerId: 0,
        wish: 0,
        passedCards: []
      });
    }
    captureCards(playerId, trickValue) {
      const player = this.getPlayerState(playerId);
      const roundPoints = player.roundPoints + trickValue;
      this.updatePlayerState(playerId, { roundPoints });
      const currentTrick = this.getState().trick;
      const trick = { id: currentTrick.id + 1, combos: [] };
      this.updateState({ trick });
    }
  };

  // node_modules/lit-html/directive.js
  var t3 = { ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4, EVENT: 5, ELEMENT: 6 };
  var e5 = (t4) => (...e7) => ({ _$litDirective$: t4, values: e7 });
  var i4 = class {
    constructor(t4) {
    }
    get _$AU() {
      return this._$AM._$AU;
    }
    _$AT(t4, e7, i5) {
      this._$Ct = t4, this._$AM = e7, this._$Ci = i5;
    }
    _$AS(t4, e7) {
      return this.update(t4, e7);
    }
    update(t4, e7) {
      return this.render(...e7);
    }
  };

  // node_modules/lit-html/directives/class-map.js
  var e6 = e5(class extends i4 {
    constructor(t4) {
      if (super(t4), t4.type !== t3.ATTRIBUTE || "class" !== t4.name || t4.strings?.length > 2) throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.");
    }
    render(t4) {
      return " " + Object.keys(t4).filter((s4) => t4[s4]).join(" ") + " ";
    }
    update(s4, [i5]) {
      if (void 0 === this.st) {
        this.st = /* @__PURE__ */ new Set(), void 0 !== s4.strings && (this.nt = new Set(s4.strings.join(" ").split(/\s/).filter((t4) => "" !== t4)));
        for (const t4 in i5) i5[t4] && !this.nt?.has(t4) && this.st.add(t4);
        return this.render(i5);
      }
      const r7 = s4.element.classList;
      for (const t4 of this.st) t4 in i5 || (r7.remove(t4), this.st.delete(t4));
      for (const t4 in i5) {
        const s5 = !!i5[t4];
        s5 === this.st.has(t4) || this.nt?.has(t4) || (s5 ? (r7.add(t4), this.st.add(t4)) : (r7.remove(t4), this.st.delete(t4)));
      }
      return w;
    }
  });

  // src/elements/tichu-card.ts
  var TichuCard = class extends s3 {
    static get styles() {
      const url = "";
      return [
        i`
        div#card {
          width: var(--width);
          height: var(--height);
          background-image: var(--card-url);
          background-position-x: var(--x-pos);
          background-position-y: var(--y-pos);
          border-radius: calc(var(--width) / 25);
          box-shadow: 2px 2px 5px 2px #666;
        }
        div#card.pass {
          background-size: cover;
        }
      `
      ];
    }
    render() {
      const width = 100;
      const height = 150;
      const factor = this.half ? 0.5 : 1;
      this.style.setProperty("--width", `${factor * width}px`);
      this.style.setProperty("--height", `${factor * height}px`);
      if (this.pass) return this.renderPass();
      if (this.card === void 0) return;
      const color = Number(this.card?.type);
      const rank = Number(this.card?.type_arg);
      this.style.setProperty("--x-pos", `${-1 * width * (rank - 1)}px`);
      this.style.setProperty("--y-pos", `${-1 * height * (color - 1)}px`);
      return x`<div id="card" @click=${this.onClick}></div>`;
    }
    renderPass() {
      this.style.setProperty("--card-url", `url(${g_gamethemeurl}img/tichu-icons-pass.png)`);
      return x`<div id="card" class="pass"></div>`;
    }
    onClick() {
    }
  };
  __decorateClass([
    n4({ type: Object })
  ], TichuCard.prototype, "card", 2);
  __decorateClass([
    n4({ type: Boolean })
  ], TichuCard.prototype, "pass", 2);
  __decorateClass([
    n4({ type: Boolean })
  ], TichuCard.prototype, "half", 2);
  customElements.define("tichu-card", TichuCard);

  // src/elements/tichu-stock.ts
  function sortFn(c4, d3) {
    const cRank = Number(c4.type_arg);
    const dRank = Number(d3.type_arg);
    if (cRank != dRank) return cRank - dRank;
    const cColor = Number(c4.type);
    const dColor = Number(d3.type);
    return cColor - dColor;
  }
  var TichuStock = class extends s3 {
    constructor() {
      super(...arguments);
      this.cards = [];
    }
    static get styles() {
      return [
        i`
        :host {
          display: block;
        }
        div#stock {
          display: flex;
          height: 150px;
        }
        div#stock.bomb {
          /* border-left: 15px solid red; */
        }
        tichu-card:not(:last-child) {
          margin-right: -75px;
        }
        tichu-card {
          zoom: 1;
        }
      `
      ];
    }
    render() {
      if (this.pass) return this.renderPass();
      return x`
      <div
        id="stock"
        class=${e6({
        bomb: hasBomb(this.cards)
      })}
      >
        ${this.cards.sort(sortFn).map((card) => x`<tichu-card .card=${card}></tichu-card>`)}
      </div>
    `;
    }
    renderPass() {
      return x`<div id="stock"><tichu-card pass></tichu-card></div>`;
    }
  };
  __decorateClass([
    n4({ type: Array })
  ], TichuStock.prototype, "cards", 2);
  __decorateClass([
    n4({ type: Boolean })
  ], TichuStock.prototype, "pass", 2);
  customElements.define("tichu-stock", TichuStock);

  // src/elements/subscription-controller.ts
  function subscribe(host, provider, callback) {
    if (host.isConnected) throw new Error("component is already connected");
    host.addController(new SubscriptionController(provider, callback));
  }
  var SubscriptionController = class {
    constructor(provider, callback) {
      this.provider = provider;
      this.callback = callback;
    }
    hostConnected() {
      this.sub = this.provider().subscribe((v2) => this.update(v2));
    }
    update(value) {
      this.callback(value);
    }
    hostDisconnected() {
      this.sub?.unsubscribe();
    }
  };

  // src/elements/tichu-player.ts
  var TichuPlayer = class extends s3 {
    constructor() {
      super();
      this.playerId = 0;
      this.reverse = false;
      this.hand = [];
      this.isLastComboPlayer = false;
      this.name = "";
      this.points = 0;
      this.active = false;
      this.bet = "-1" /* NO_BET_YET */;
      this.previousHand = [];
      this.partnerHand = [];
      this.nextHand = [];
      subscribe(
        this,
        () => window.model.player$(this.playerId),
        (player) => {
          this.player = player;
          this.hand = player?.cards ?? [];
          this.bet = player?.bet ?? "-1" /* NO_BET_YET */;
          this.points = player?.roundPoints ?? 0;
          this.active = player?.active ?? false;
          this.name = player?.player?.name ?? "";
        }
      );
      subscribe(
        this,
        () => window.model.players$,
        (players) => {
          const nextId = window.model.nextPlayerId(this.playerId);
          const next = players.find((p3) => p3.player.id === nextId);
          this.nextHand = next?.cards ?? [];
          const partnerId = window.model.nextPlayerId(nextId);
          const partner = players.find((p3) => p3.player.id === partnerId);
          this.partnerHand = partner?.cards ?? [];
          const previousId = window.model.nextPlayerId(partnerId);
          const previous = players.find((p3) => p3.player.id === previousId);
          this.previousHand = previous?.cards ?? [];
        }
      );
      subscribe(
        this,
        () => window.model.latestCombo$(this.playerId),
        (combo) => {
          this.combo = combo?.cards;
        }
      );
      subscribe(
        this,
        () => window.model.lastComboPlayer$,
        (lastComboPlayer) => {
          this.isLastComboPlayer = lastComboPlayer === this.playerId;
        }
      );
      subscribe(
        this,
        () => window.model.passedCards$,
        (passedCards) => {
          this.passedToPrevious = void 0;
          this.passedToPartner = void 0;
          this.passedToNext = void 0;
          for (const passed of passedCards) {
            if (passed.from !== this.playerId) continue;
            if (passed.accepted) continue;
            const nextId = window.model.nextPlayerId(this.playerId);
            const partnerId = window.model.nextPlayerId(nextId);
            const previousId = window.model.nextPlayerId(partnerId);
            if (passed.to === previousId) this.passedToPrevious = passed.card;
            if (passed.to === partnerId) this.passedToPartner = passed.card;
            if (passed.to === nextId) this.passedToNext = passed.card;
          }
        }
      );
    }
    static get styles() {
      return [
        i`
        :host {
          display: block;
          padding: 12px;
          padding: 6px;
          background: var(--bg-color-lighter);
          border-radius: var(--border-radius);
          max-width: 500px;
        }
        .title {
          line-height: 24px;
          font-size: 20px;
          display: flex;
          flex-direction: row-reverse;
          justify-content: space-between;
        }
        .reverse .title {
          flex-direction: row;
        }
        .title > div {
          padding: 2px 8px;
          border-radius: var(--border-radius);
          min-width: 110px;
        }
        .title .name {
          background-color: rgba(100, 100, 100, 0.2);
        }
        .title.out .name {
          background-color: rgba(0, 0, 0, 0.7);
        }
        .title.isLastComboPlayer .name {
          background-color: var(--bg-color-play-area);
        }
        .title.active .name {
          background-color: var(--bg-color-active);
          color: white;
        }
        .title .name {
          text-align: center;
        }
        .title .points {
          text-align: center;
        }
        .title .bet {
          text-align: center;
        }
        .title .bet {
          padding: 2px 16px;
        }
        .title .bet.tichu {
          background-color: rgb(27, 150, 77);
          color: white;
        }
        .title .bet.grandTichu {
          background-color: rgb(36, 165, 232);
          color: white;
        }
        .name {
          font-weight: bold;
        }
        .stocks {
          display: flex;
          justify-content: space-between;
          padding: 8px;
          zoom: 0.8;
        }
        .stocks.reverse {
          flex-direction: row-reverse;
        }
        .passed {
          display: flex;
          flex-direction: row-reverse;
          gap: 8px;
        }
        .reverse .passed {
          flex-direction: row;
        }
        .passed .small {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .reverse .passed .small {
          flex-direction: column-reverse;
        }
        .passed .passedCard {
          display: flex;
          flex-direction: column;
        }
        .passed .passedCard.partner {
          justify-content: space-between;
        }
        .passed tichu-card {
          margin-bottom: 4px;
          zoom: 0.85;
        }
        .passed .small tichu-card {
          zoom: 0.67;
        }
        .passedCard .bomb {
          background: red;
          color: white;
        }
        .icon {
          background-size: 128px 64px;
          display: inline-block;
          height: 16px;
          width: 16px;
          background-image: var(--icon-url);
        }
        .icon.star {
          background-position: -112px -16px;
        }
      `
      ];
    }
    render() {
      const passingCards = !!this.passedToPrevious || !!this.passedToPartner || !!this.passedToNext;
      return x`
      <div
        class=${e6({
        reverse: this.reverse
      })}
      >
        <div
          class=${e6({
        title: true,
        isLastComboPlayer: this.isLastComboPlayer,
        active: this.active,
        out: this.hand.length === 0
      })}
        >
          <div class="name">${this.name}</div>
          <div class="points">
            <div class="icon star"></div>
            ${this.points}
          </div>
          ${this.renderBet()}
        </div>
        <div
          class=${e6({
        stocks: true,
        reverse: this.reverse
      })}
        >
          <tichu-stock .cards=${this.hand}></tichu-stock>
          ${passingCards ? this.renderPassedCards() : this.renderCombo()}
        </div>
      </div>
    `;
    }
    renderCombo() {
      return x`
      <tichu-stock ?pass=${this.combo?.length === 0} .cards=${this.combo ?? []}></tichu-stock>
    `;
    }
    renderPassedCards() {
      if (!this.passedToPrevious && !this.passedToPartner && !this.passedToNext) return;
      const prevBefore = hasBomb(this.previousHand);
      const prevAfter = prevBefore || hasBomb([...this.previousHand, this.passedToPrevious]);
      const partnerBefore = hasBomb(this.partnerHand);
      const partnerAfter = partnerBefore || hasBomb([...this.partnerHand, this.passedToPartner]);
      const nextBefore = hasBomb(this.nextHand);
      const nextAfter = nextBefore || hasBomb([...this.nextHand, this.passedToNext]);
      return x`
      <div class="passed">
        <div class="passedCard partner">
          <tichu-card .card=${this.passedToPartner}></tichu-card>
          <div class=${e6({ bomb: partnerAfter && !partnerBefore })}>Partner</div>
        </div>
        <div class="small">
          <div class="passedCard">
            <tichu-card half .card=${this.passedToPrevious}></tichu-card>
            <div class=${e6({ bomb: prevAfter && !prevBefore })}>Prev</div>
          </div>
          <div class="passedCard">
            <tichu-card half .card=${this.passedToNext}></tichu-card>
            <div class=${e6({ bomb: nextAfter && !nextBefore })}>Next</div>
          </div>
        </div>
      </div>
    `;
    }
    renderBet() {
      switch (this.bet) {
        case "-2" /* INITIAL */:
        case "-1" /* NO_BET_YET */:
        case "0" /* NO_BET */:
          return x`<div></div>`;
        case "100" /* TICHU */:
          return x`<div class="bet tichu">Tichu</div>`;
        case "200" /* GRAND_TICHU */:
          return x`<div class="bet grandTichu">Grand Tichu</div>`;
      }
    }
  };
  __decorateClass([
    n4({ type: Number })
  ], TichuPlayer.prototype, "playerId", 2);
  __decorateClass([
    n4({ type: Boolean })
  ], TichuPlayer.prototype, "reverse", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "hand", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "combo", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "isLastComboPlayer", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "name", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "points", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "active", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "bet", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "player", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "passedToPrevious", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "passedToPartner", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "passedToNext", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "previousHand", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "partnerHand", 2);
  __decorateClass([
    r6()
  ], TichuPlayer.prototype, "nextHand", 2);
  customElements.define("tichu-player", TichuPlayer);

  // src/elements/tichu-score-board.ts
  var TichuScoreBoard = class extends s3 {
    constructor() {
      super();
      this.names = [];
      this.round = 0;
      subscribe(
        this,
        () => window.model.round$,
        (round) => this.round = round
      );
      subscribe(
        this,
        () => window.model.playerNames$,
        (names) => this.names = names
      );
    }
    static get styles() {
      return [
        i`
        :host {
          display: block;
        }
        table {
          border-spacing: 0;
          font-size: smaller;
        }
        tr.title {
          font-weight: bold;
        }
        tr.current {
          background-color: whitesmoke;
        }
        td {
          padding: 2px;
          width: 75px;
          max-width: 75px;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center;
        }
      `
      ];
    }
    render() {
      return x`
      <table>
        ${this.renderTitle()} ${this.board.rounds.map((r7) => this.renderRound(r7))}
      </table>
    `;
    }
    renderTitle() {
      const team1 = `${this.names[0]} ${this.names[2]}`;
      const team2 = `${this.names[1]} ${this.names[3]}`;
      return x`
      <tr class="title">
        <td>Round</td>
        <td>${team1}</td>
        <td>${team2}</td>
        <td>${team1}</td>
        <td>${team2}</td>
      </tr>
    `;
    }
    renderRound(r7) {
      return x`
      <tr
        class=${e6({
        round: true,
        current: r7.round === this.round
      })}
      >
        <td>${r7.round}</td>
        ${r7.scores.slice(0, 2).map((s4) => x`<td>${s4.roundPoints}</td>`)}
        ${r7.scores.slice(0, 2).map((s4) => x`<td>${s4.gamePoints}</td>`)}
      </tr>
    `;
    }
  };
  __decorateClass([
    n4({ type: Object })
  ], TichuScoreBoard.prototype, "board", 2);
  __decorateClass([
    r6()
  ], TichuScoreBoard.prototype, "names", 2);
  __decorateClass([
    r6()
  ], TichuScoreBoard.prototype, "round", 2);
  customElements.define("tichu-score-board", TichuScoreBoard);

  // src/elements/tichu-replay.ts
  var fakeGamelogs = [];
  var fakePlayers = {};
  var TichuReplay = class extends s3 {
    constructor() {
      super();
      this.wish = 0;
      this.playerIds = [];
      this.notifIndex = 0;
      this.ignoredNotifType = "";
      this.model = new Model();
      this.notifs = [];
      /** State at index i is the state before replaying notification i. */
      this.states = [];
      this.keyListener = (e7) => {
        if (e7.key === "ArrowLeft") {
          if (e7.shiftKey) {
            this.prevRound();
          } else {
            this.prevMove();
          }
        } else if (e7.key === "ArrowRight") {
          if (e7.shiftKey) {
            this.nextRound();
          } else {
            this.nextMove();
          }
        } else {
          return;
        }
        e7.preventDefault();
        e7.stopPropagation();
      };
      window.model = this.model;
      let gamelogs = window.g_archive_mode ? window.g_gamelogs : fakeGamelogs;
      if (typeof gamelogs?.data?.data === "object") {
        gamelogs = gamelogs?.data?.data;
      }
      tidyUpGamelogs(gamelogs);
      for (const packet of gamelogs) {
        this.notifs.push(
          ...packet.data.map((data) => {
            const player_id = playerIdFromChannel(packet.channel);
            return { ...data, player_id, move_id: packet.move_id };
          })
        );
      }
      subscribe(
        this,
        () => this.model.wish$,
        (x2) => this.wish = x2
      );
      subscribe(
        this,
        () => this.model.playerIds$,
        (x2) => this.playerIds = x2
      );
      subscribe(
        this,
        () => this.model.playerIds$,
        (x2) => this.scoreBoard = createScoreBoard(this.notifs, x2)
      );
    }
    static get styles() {
      return [
        i`
        :host {
          display: block;
          background-color: var(--bg-color-play-area);
          padding: 24px 8px 8px 8px;
          margin: 0px auto;
          box-sizing: border-box;
          border-radius: var(--border-radius);
        }
        div.buttons {
          margin-bottom: 8px;
          text-align: center;
        }
        div.subtitle {
          margin: 8px;
          text-align: center;
        }
        button {
          font-size: 14px;
          font-weight: 700;
          border-radius: var(--border-radius);
          padding: 6px 12px;
          margin-right: 8px;
          min-width: 150px;
        }
        button.green {
          color: #fff;
          background: #89a538;
          background: -o-linear-gradient(top, #799332, #89a538);
          border: 1px solid #697f2b;
        }
        button.red {
          color: #fff;
          background: #c92727;
          background: -o-linear-gradient(top, #c20b0b, #c92727);
          border: 1px solid #b20a0a;
        }
        button.blue {
          color: #fff;
          background: #4871b6;
          background: -o-linear-gradient(top, #4065a3, #4871b6);
          border: 1px solid #37578c;
        }
        button.darkgray {
          color: #fff;
          background: #787878;
          background: -o-linear-gradient(top, #888, #787878);
          border: 1px solid #505050;
        }
        button.gray {
          color: #060606;
          background: #d8d8d8;
          border: 1px solid #060606;
        }
        .grid {
          display: grid;
        }
        div.debug {
          font-size: 10px;
          margin-top: 12px;
          display: none;
        }
        button.debug {
          display: none;
        }

        .grid {
          display: grid;
          grid-gap: 8px;
          grid-template-columns: 2fr 1fr;
          grid-template-rows: 1fr 1fr 1fr 1fr;
        }
        .grid .top {
          grid-column: 1 / span 1;
          grid-row: 3 / span 1;
        }
        .grid .left {
          grid-column: 1 / span 1;
          grid-row: 4 / span 1;
        }
        .grid .right {
          grid-column: 1 / span 1;
          grid-row: 2 / span 1;
        }
        .grid .bottom {
          grid-column: 1 / span 1;
          grid-row: 1 / span 1;
        }
        .grid .wishCell {
          grid-column: 2 / span 1;
          grid-row: 2 / span 1;
          place-self: center;
          text-align: center;
        }
        .grid tichu-status {
          grid-column: 2 / span 1;
          grid-row: 1 / span 1;
          place-self: start end;
          text-align: right;
          font-size: 20px;
        }
        .grid tichu-score-board {
          grid-column: 2 / span 1;
          grid-row: 3 / span 1;
          place-self: center;
        }

        .squareTable .grid {
          grid-template-columns:
            minmax(70px, 0fr)
            minmax(300px, 1fr)
            minmax(70px, 0fr)
            minmax(300px, 1fr)
            minmax(70px, 0fr);
          grid-template-rows: 0fr 0fr 0fr 0fr;
        }
        .squareTable .grid .top {
          grid-column: 3 / span 2;
          grid-row: 1 / span 1;
        }
        .squareTable .grid .left {
          grid-column: 1 / span 2;
          grid-row: 2 / span 1;
        }
        .clockwise.squareTable .grid .left {
          grid-column: 4 / span 2;
        }
        .squareTable .grid .right {
          grid-column: 4 / span 2;
          grid-row: 2 / span 1;
        }
        .clockwise.squareTable .grid .right {
          grid-column: 1 / span 2;
        }
        .squareTable .grid .bottom {
          grid-column: 2 / span 2;
          grid-row: 3 / span 1;
        }
        .squareTable .grid .wishCell {
          grid-column: 3 / span 1;
          grid-row: 2 / span 1;
        }
        .squareTable .grid .controls {
          grid-column: 1 / span 2;
          grid-row: 1 / span 1;
          place-self: center;
        }
        .squareTable .grid .exit {
          grid-column: 1 / span 2;
          grid-row: 4 / span 1;
          margin-top: 50px;
        }
        .squareTable .grid tichu-status {
          grid-column: 4 / span 1;
          grid-row: 1 / span 1;
        }
        .squareTable .grid tichu-score-board {
          grid-column: 4 / span 2;
          grid-row: 3 / span 2;
          place-self: center;
        }
        .squareTable .grid {
          grid-column: 4 / span 2;
          grid-row: 3 / span 2;
          place-self: center;
        }
        .player {
          display: flex;
          justify-content: flex-end;
        }
        .player.reverse {
          justify-content: flex-start;
        }
        .player tichu-player {
          flex-grow: 1;
        }
        .wishIcon {
          width: 60px;
          height: 90px;
          background-size: 480px 180px;
          background-color: rgba(255, 255, 255, 0.5);
          border-radius: var(--border-radius);
          background-image: var(--wish-url);
          background-position-x: calc((-1px) * var(--wish-x));
          background-position-y: calc((-1px) * var(--wish-y));
        }
      `
      ];
    }
    connectedCallback() {
      super.connectedCallback();
      document.addEventListener("keydown", this.keyListener);
    }
    disconnectedCallback() {
      document.removeEventListener("keydown", this.keyListener);
      super.disconnectedCallback();
    }
    firstUpdated() {
      const players = window.g_archive_mode ? Object.values(window.gameui.gamedatas.players) : fakePlayers;
      this.model.init(players);
      this.recordState();
      this.nextRound();
    }
    render() {
      this.style.setProperty("--card-url", `url(${g_gamethemeurl}img/tichu-cards.png)`);
      this.style.setProperty("--icon-url", `url(${g_gamethemeurl}img/tichu-icons.png)`);
      this.style.setProperty("--wish-url", `url(${g_gamethemeurl}img/tichu-icons-table.png)`);
      const ids = this.playerIds;
      if (!ids || !ids[0] || ids[0] <= 0) return;
      const last = this.notifs[this.notifIndex - 1];
      const next = this.notifs.find((n5, i5) => i5 >= this.notifIndex && !isIgnored(n5));
      return x`
      <div class="squareTable">
        <div class="grid">
          <div class="controls">
            <div class="buttons">
              <button class="red debug" @click=${this.prev}>Previous Notif</button>
              <button class="red" @click=${this.prevMove}>Previous Move (←)</button>
              <button class="red" @click=${this.prevRound}>Previous Round (Shift ←)</button>
            </div>
            <div class="buttons">
              <button class="green debug" @click=${this.next}>Next Notif</button>
              <button class="green" @click=${this.nextMove}>Next Move (→)</button>
              <button class="green" @click=${this.nextRound}>Next Round (Shift →)</button>
            </div>
          </div>
          <div class="wishCell">${this.renderWish()}</div>
          <div class="player top reverse">
            <tichu-player reverse .playerId=${ids[0] ?? 0}></tichu-player>
          </div>
          <div class="player left">
            <tichu-player .playerId=${ids[1] ?? 0}></tichu-player>
          </div>
          <div class="player bottom">
            <tichu-player .playerId=${ids[2] ?? 0}></tichu-player>
          </div>
          <div class="player right reverse">
            <tichu-player reverse .playerId=${ids[3] ?? 0}></tichu-player>
          </div>
          <tichu-score-board .board=${this.scoreBoard}></tichu-score-board>
          <div class="exit">
            <div>
              <button class="darkgray" @click=${this.exit}>Back to Classic View</button>
            </div>
          </div>
        </div>
        <div class="debug">
          <div class="subtitle">
            <span>notifIndex: ${this.notifIndex}</span>
            <span>moveId: ${this.notifs[this.notifIndex]?.move_id}</span>
          </div>
          <div class="subtitle">
            <span
              >Last: ${last?.type}${last && last.player_id > 0 ? ` (${last?.player_id})` : ""}</span
            >
            <span
              >Next: ${next?.type}${last && last.player_id > 0 ? ` (${last?.player_id})` : ""}</span
            >
            <span>${this.ignoredNotifType ? ` IGNORED: ${this.ignoredNotifType}` : ""}</span>
          </div>
          <button class="darkgray" @click=${this.dumpState}>Dump State</button>
          <div>g_archive_mode: ${window.g_archive_mode}</div>
          <div>notifs: ${this.notifs.length}</div>
          <div>notif: ${JSON.stringify(this.notifs[this.notifIndex])}</div>
        </div>
      </div>
    `;
    }
    exit() {
      this.dispatchEvent(new CustomEvent("exit", { detail: {}, composed: true, bubbles: true }));
    }
    renderWish() {
      if (this.wish < 2) return;
      if (this.wish > 14) return;
      const w2 = this.wish - 2;
      const x2 = w2 % 7 * 60;
      const y3 = (w2 - w2 % 7) / 7 * 90;
      this.style.setProperty("--wish-x", `${x2}`);
      this.style.setProperty("--wish-y", `${y3}`);
      return x` <div class="wishIcon"></div> `;
    }
    dumpState() {
      console.log(JSON.stringify(this.model.getState()));
    }
    prevMove() {
      let sameMove = true;
      const moveId = this.notifs[this.notifIndex - 1]?.move_id;
      while (sameMove) {
        this.prev();
        const prev = this.notifs[this.notifIndex - 1];
        sameMove = !!prev && moveId === prev?.move_id;
      }
    }
    nextMove() {
      let sameMove = true;
      let moveId = this.notifs[this.notifIndex]?.move_id;
      while (sameMove) {
        this.next();
        const next = this.notifs[this.notifIndex];
        sameMove = !!next && next?.move_id === moveId;
      }
    }
    prevRound() {
      while (this.notifIndex > 0) {
        this.prevMove();
        const cards = this.model.getState().passedCards;
        if (cards.length === 12 && !cards.some((c4) => c4.accepted)) return;
      }
    }
    nextRound() {
      while (this.notifs[this.notifIndex]) {
        this.nextMove();
        const cards = this.model.getState().passedCards;
        if (cards.length === 12 && !cards.some((c4) => c4.accepted)) return;
      }
    }
    prev() {
      if (this.notifIndex === 0) return;
      this.notifIndex--;
      this.model.setState(this.states[this.notifIndex]);
    }
    next() {
      const notif = this.notifs[this.notifIndex];
      this.notifIndex++;
      if (!notif) return;
      const type = notif.type;
      const args = notif.args;
      if (type === "dealCards") {
        const playerId = Number(args.cards[0].location_arg);
        this.model.dealCards(playerId, args.cards);
      } else if (type === "playCombo") {
        const playerId = Number(args.player_id);
        this.model.playCombo(playerId, args.cards, args.points);
      } else if (type === "pass") {
        const playerId = Number(args.player_id);
        this.model.pass(playerId);
      } else if (type === "grandTichuBet") {
        const playerId = Number(args.player_id);
        this.model.setBet(playerId, args.bet === "200" ? "200" /* GRAND_TICHU */ : "-1" /* NO_BET_YET */);
      } else if (type === "tichuBet") {
        const playerId = Number(args.player_id);
        this.model.setBet(playerId, args.bet === 100 ? "100" /* TICHU */ : "0" /* NO_BET */);
      } else if (type === "gameStateMultipleActiveUpdate") {
        const playerIds = args.map((id) => Number(id));
        this.model.setActive(playerIds);
      } else if (type === "gameStateChange" && args.type === "activeplayer") {
        const playerId = Number(args.active_player);
        this.model.setActive([playerId]);
      } else if (type === "acceptCards") {
        this.model.acceptCards(notif.player_id);
      } else if (type === "passCards") {
        const cardIds = args.cardIds;
        this.model.passCards(notif.player_id, cardIds);
      } else if (type === "wishMade") {
        const wish = Number(args.wish);
        this.model.setWish(wish);
      } else if (type === "mahjongWishGranted") {
        this.model.setWish(0);
      } else if (type === "captureCards") {
        const playerId = Number(args.player_id);
        const trickValue = Number(args.trick_value);
        this.model.captureCards(playerId, trickValue);
      } else if (type === "newScores") {
        const playerIds = this.model.getPlayerIds();
        for (const playerId of playerIds) {
          const gamePoints = args.newScores[`${playerId}`];
          this.model.setGamePoints(playerId, gamePoints);
        }
        this.model.beginNewRound();
      } else if (isIgnored(notif)) {
      } else {
        this.ignoredNotifType = type;
      }
      this.recordState();
    }
    recordState() {
      this.states[this.notifIndex] = { ...this.model.getState() };
    }
  };
  __decorateClass([
    r6()
  ], TichuReplay.prototype, "wish", 2);
  __decorateClass([
    r6()
  ], TichuReplay.prototype, "playerIds", 2);
  __decorateClass([
    r6()
  ], TichuReplay.prototype, "notifIndex", 2);
  __decorateClass([
    r6()
  ], TichuReplay.prototype, "ignoredNotifType", 2);
  __decorateClass([
    r6()
  ], TichuReplay.prototype, "scoreBoard", 2);
  customElements.define("tichu-replay", TichuReplay);
  function isIgnored(notif) {
    const type = notif.type;
    const args = notif.args;
    if (type === "autopass") return true;
    if (type === "hasBomb") return true;
    if (type === "log") return true;
    if (type === "playerGoOut") return true;
    if (type === "simpleNode") return true;
    if (type === "tableWindow") return true;
    if (type === "updateReflexionTime") return true;
    if (type === "wakeupPlayers") return true;
    if (type === "gameStateChangePrivateArg") return true;
    if (type === "gameStateChange" && args.type === "game") return true;
    if (type === "gameStateChange" && args.type === "manager") return true;
    if (type === "gameStateChange" && args.type === "multipleactiveplayer") return true;
    return false;
  }
  function createScoreBoard(notifs, playerIds) {
    const rounds = [];
    let roundCount = 1;
    let newScores = {};
    let oldScores = {};
    for (const notif of notifs) {
      if (notif.type !== "newScores") continue;
      oldScores = newScores;
      newScores = notif.args.newScores;
      const scores = [];
      for (const id of playerIds) {
        const oldGamePoints = toNumber(oldScores[`${id}`]);
        const gamePoints = toNumber(newScores[`${id}`]);
        const roundPoints = gamePoints - oldGamePoints;
        scores.push({ id, gamePoints, roundPoints });
      }
      const round = { round: roundCount++, scores };
      rounds.push(round);
    }
    return { rounds };
  }
  function toNumber(s4) {
    const n5 = Number(s4 ?? "") ?? 0;
    return isNaN(n5) ? 0 : n5;
  }
  function tidyUpGamelogs(gamelogs) {
    for (let index = 0; index < gamelogs.length; index++) {
      const thisPacket = gamelogs[index];
      let prevPacket = gamelogs[index - 1];
      if (!thisPacket || !prevPacket) continue;
      const allIgnored = thisPacket.data.every(isIgnored);
      if (allIgnored) {
        gamelogs.splice(index, 1);
        index -= 1;
        continue;
      }
      const thisgt = thisPacket.data.some((notif) => notif.type === "grandTichuBet");
      const prevgt = prevPacket.data.some((notif) => notif.type === "grandTichuBet");
      if (thisgt && prevgt) thisPacket.move_id = prevPacket.move_id;
      const thispcjoined = thisPacket.data.length > 1 && thisPacket.data.some((notif) => notif.type === "passCards");
      if (thispcjoined) {
        const pcData = thisPacket.data.filter((notif) => notif.type === "passCards");
        const otherData = thisPacket.data.filter((notif) => notif.type !== "passCards");
        const pcPacket = { ...thisPacket, data: pcData };
        thisPacket.data = otherData;
        gamelogs.splice(index, 0, pcPacket);
        index -= 1;
        continue;
      }
      const thispc = thisPacket.data.length === 1 && thisPacket.data.some(
        (notif) => notif.type === "passCards" || notif.type === "gameStateMultipleActiveUpdate"
      );
      const prevpc = prevPacket.data.length === 1 && prevPacket.data.some(
        (notif) => notif.type === "passCards" || notif.type === "gameStateMultipleActiveUpdate"
      );
      if (thispc && prevpc) thisPacket.move_id = prevPacket.move_id;
      if (thisPacket?.move_id !== prevPacket?.move_id) continue;
      if (!thisPacket?.channel.startsWith("/table/t")) continue;
      if (!prevPacket?.channel.startsWith("/player/p")) continue;
      swap(gamelogs, index, index - 1);
      index -= 2;
    }
  }
  function swap(gamelogs, i5, j2) {
    if (!gamelogs[i5]) return;
    if (!gamelogs[j2]) return;
    const temp = gamelogs[i5];
    gamelogs[i5] = gamelogs[j2];
    gamelogs[j2] = temp;
  }

  // src/elements/styles.ts
  var button = i`
  button {
    display: inline-block;
    font-family: Roboto, Arial, sans-serif;
    font-size: 14px;
    font-weight: 700;
    text-align: center;
    margin-top: 10px;
    border: 1px solid #060606;
    border-radius: 6px;
    padding: 6px 12px;
    width: 100%;
    box-sizing: border-box;
    box-shadow: none;
    text-shadow: none;
    color: #060606;
    background: transparent;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

  // src/elements/tichu-status.ts
  var TichuStatus = class extends s3 {
    constructor() {
      super(...arguments);
      this.roundCount = 0;
      this.trickCount = 0;
      this.trickPoints = 0;
      this.trickSize = 0;
    }
    static get styles() {
      return [button];
    }
    render() {
      return x`
      <div>
        <div>Round: <span id="roundCounter">${this.roundCount}</span></div>
        <div>Trick: <span id="trickCounter">${this.trickCount}</span></div>
        <div>Trick Points: <span id="currentTrickCounter">${this.trickPoints}</span></div>
        <div>${this.renderButton()}</div>
      </div>
    `;
    }
    renderButton() {
      if (this.trickSize === 0) return;
      return x`<button @click=${this.onShowClick}>Show current trick</button>`;
    }
    onShowClick() {
      fire(this, "show-current-trick");
    }
  };
  __decorateClass([
    n4({ type: Number })
  ], TichuStatus.prototype, "roundCount", 2);
  __decorateClass([
    n4({ type: Number })
  ], TichuStatus.prototype, "trickCount", 2);
  __decorateClass([
    n4({ type: Number })
  ], TichuStatus.prototype, "trickPoints", 2);
  __decorateClass([
    n4({ type: Number })
  ], TichuStatus.prototype, "trickSize", 2);
  customElements.define("tichu-status", TichuStatus);
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

@lit/reactive-element/decorators/custom-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/property.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/state.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/event-options.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/base.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-all.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-async.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-elements.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-nodes.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directive.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directives/class-map.js:
  (**
   * @license
   * Copyright 2018 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
