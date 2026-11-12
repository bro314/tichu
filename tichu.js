(function() {
  // dist/studio-test.js
  var __assign = function() {
    __assign = Object.assign || function(t) {
      for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
          t[p] = s[p];
      }
      return t;
    };
    return __assign.apply(this, arguments);
  };
  var __awaiter = function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  var __generator = function(thisArg, body) {
    var _2 = { label: 0, sent: function() {
      if (t[0] & 1) throw t[1];
      return t[1];
    }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
      return this;
    }), g;
    function verb(n) {
      return function(v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while (g && (g = 0, op[0] && (_2 = 0)), _2) try {
        if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
        if (y = 0, t) op = [op[0] & 2, t.value];
        switch (op[0]) {
          case 0:
          case 1:
            t = op;
            break;
          case 4:
            _2.label++;
            return { value: op[1], done: false };
          case 5:
            _2.label++;
            y = op[1];
            op = [0];
            continue;
          case 7:
            op = _2.ops.pop();
            _2.trys.pop();
            continue;
          default:
            if (!(t = _2.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
              _2 = 0;
              continue;
            }
            if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
              _2.label = op[1];
              break;
            }
            if (op[0] === 6 && _2.label < t[1]) {
              _2.label = t[1];
              t = op;
              break;
            }
            if (t && _2.label < t[2]) {
              _2.label = t[2];
              _2.ops.push(op);
              break;
            }
            if (t[2]) _2.ops.pop();
            _2.trys.pop();
            continue;
        }
        op = body.call(thisArg, _2);
      } catch (e) {
        op = [6, e];
        y = 0;
      } finally {
        f = t = 0;
      }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
  var SUIT_CODES = { 1: "S", 2: "R", 3: "B", 4: "G" };
  var SUIT_SYMBOLS = { 1: "\u2660", 2: "\u2605", 3: "\uD83D\uDC99", 4: "\uD83D\uDFE2" };
  var RANK_LABELS = {
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    11: "J",
    12: "Q",
    13: "K",
    14: "A"
  };
  var SPECIAL_CODES = { 1: "DR", 2: "PH", 3: "DOG", 4: "MJ" };
  function cardFromStockType(stockTypeVal, id) {
    var st = Number(stockTypeVal);
    var color = Math.floor(st / 14) + 1;
    var value = st % 14 + 1;
    return {
      id: String(id !== null && id !== void 0 ? id : ""),
      type: color,
      type_arg: value
    };
  }
  function normalizeCardObj(cardOrItem) {
    var _a;
    if (!cardOrItem || typeof cardOrItem !== "object")
      return null;
    if (cardOrItem.type_arg !== void 0) {
      return {
        id: String((_a = cardOrItem.id) !== null && _a !== void 0 ? _a : ""),
        type: Number(cardOrItem.type),
        type_arg: Number(cardOrItem.type_arg)
      };
    }
    if (cardOrItem.type !== void 0) {
      return cardFromStockType(Number(cardOrItem.type), cardOrItem.id);
    }
    return null;
  }
  function formatCardCode(cardOrItem) {
    var c = normalizeCardObj(cardOrItem);
    if (!c)
      return "?";
    if (c.type_arg === 1) {
      return SPECIAL_CODES[c.type] || "SP";
    }
    return (SUIT_CODES[c.type] || "?") + (RANK_LABELS[c.type_arg] || String(c.type_arg));
  }
  function formatCardPretty(cardOrItem, withId) {
    var c = normalizeCardObj(cardOrItem);
    if (!c)
      return "?";
    var label = "";
    if (c.type_arg === 1) {
      label = SPECIAL_CODES[c.type] || "SP";
    } else {
      label = (RANK_LABELS[c.type_arg] || String(c.type_arg)) + (SUIT_SYMBOLS[c.type] || "");
    }
    if (withId && c.id) {
      return "".concat(label, "(#").concat(c.id, ")");
    }
    return label;
  }
  function parseRankToken(tok) {
    if (tok === null || tok === void 0)
      return null;
    var s = String(tok).trim().toUpperCase();
    if (s === "NONE" || s === "NO" || s === "0" || s === "15")
      return 15;
    if (s === "J" || s === "JACK")
      return 11;
    if (s === "Q" || s === "QUEEN")
      return 12;
    if (s === "K" || s === "KING")
      return 13;
    if (s === "A" || s === "ACE")
      return 14;
    if (s === "MJ" || s === "MAHJONG" || s === "1")
      return 1;
    var n = parseInt(s, 10);
    if (!isNaN(n) && n >= 2 && n <= 15)
      return n;
    return null;
  }
  function parseCardSpecToken(rawToken) {
    if (rawToken && typeof rawToken === "object") {
      var c = normalizeCardObj(rawToken);
      if (c && c.id)
        return { kind: "id", id: String(c.id) };
      if (c)
        return { kind: "exact", suit: c.type, rank: c.type_arg };
    }
    var raw = String(rawToken !== null && rawToken !== void 0 ? rawToken : "").trim();
    if (!raw)
      return null;
    if (raw.indexOf("#") === 0) {
      return { kind: "id", id: raw.slice(1).trim() };
    }
    var upper = raw.toUpperCase();
    if (upper === "DR" || upper === "DRAGON")
      return { kind: "exact", suit: 1, rank: 1 };
    if (upper === "PH" || upper === "PHOENIX")
      return { kind: "exact", suit: 2, rank: 1 };
    if (upper === "DOG" || upper === "HOUND")
      return { kind: "exact", suit: 3, rank: 1 };
    if (upper === "MJ" || upper === "MAHJONG")
      return { kind: "exact", suit: 4, rank: 1 };
    var suitMap = {
      S: 1,
      R: 2,
      B: 3,
      G: 4
    };
    var suitFirst = upper.match(/^([SRBG])\s*(10|[2-9]|[JQKA])$/);
    if (suitFirst) {
      var suit = suitMap[suitFirst[1]];
      var rank = parseRankToken(suitFirst[2]);
      if (suit && rank)
        return { kind: "exact", suit: suit, rank: rank };
    }
    var rankFirst = upper.match(/^(10|[2-9]|[JQKA])\s*([SRBG])$/);
    if (rankFirst) {
      var rank = parseRankToken(rankFirst[1]);
      var suit = suitMap[rankFirst[2]];
      if (suit && rank)
        return { kind: "exact", suit: suit, rank: rank };
    }
    if (upper === "J" || upper === "Q" || upper === "K" || upper === "A") {
      return { kind: "rank", rank: parseRankToken(upper) };
    }
    var num = Number(upper);
    if (!isNaN(num) && Math.floor(num) === num && num > 0) {
      return { kind: "number", value: num, id: String(num) };
    }
    return null;
  }
  function resolveCardsFromHand(input, handCards) {
    var hand = [];
    for (var i = 0; i < (handCards || []).length; i++) {
      var norm = normalizeCardObj(handCards[i]);
      if (norm)
        hand.push(norm);
    }
    if (input === void 0 || input === null)
      return null;
    var tokens = [];
    var forceIdMode = false;
    if (typeof input === "string") {
      if (input.indexOf(";") !== -1) {
        forceIdMode = true;
        tokens = input.split(";").map(function(s) {
          return s.trim();
        }).filter(Boolean);
      } else {
        tokens = input.split(/[,;\s]+/).map(function(s) {
          return s.trim();
        }).filter(Boolean);
      }
    } else if (Array.isArray(input)) {
      tokens = input;
    } else {
      tokens = [input];
    }
    if (tokens.length === 0)
      return [];
    var parsed = tokens.map(parseCardSpecToken);
    for (var i = 0; i < parsed.length; i++) {
      if (!parsed[i]) {
        throw new Error("Invalid card specification in: ".concat(JSON.stringify(input)));
      }
    }
    var usedIds = {};
    var resolved = [];
    var _loop_1 = function(i2) {
      var spec = parsed[i2];
      var chosen = null;
      if (spec.kind === "id") {
        chosen = hand.find(function(c) {
          return !usedIds[c.id] && String(c.id) === String(spec.id);
        }) || null;
      } else if (spec.kind === "exact") {
        chosen = hand.find(function(c) {
          return !usedIds[c.id] && c.type === spec.suit && c.type_arg === spec.rank;
        }) || null;
      } else if (spec.kind === "rank") {
        chosen = hand.find(function(c) {
          return !usedIds[c.id] && c.type_arg === spec.rank;
        }) || null;
      } else if (spec.kind === "number") {
        if (forceIdMode || spec.value > 14) {
          chosen = hand.find(function(c) {
            return !usedIds[c.id] && String(c.id) === String(spec.value);
          }) || null;
        }
        if (!chosen && spec.value >= 1 && spec.value <= 14) {
          chosen = hand.find(function(c) {
            return !usedIds[c.id] && c.type_arg === spec.value;
          }) || null;
        }
        if (!chosen) {
          chosen = hand.find(function(c) {
            return !usedIds[c.id] && String(c.id) === String(spec.value);
          }) || null;
        }
      }
      if (!chosen) {
        var availableStr = hand.map(function(c) {
          return "".concat(formatCardCode(c), "(#").concat(c.id, ")");
        }).join(", ");
        throw new Error("Could not find card matching ".concat(JSON.stringify(spec), " in hand: [").concat(availableStr, "]"));
      }
      usedIds[chosen.id] = true;
      resolved.push(chosen);
    };
    for (var i = 0; i < parsed.length; i++) {
      _loop_1(i);
    }
    return resolved;
  }
  function pickThreeDefaultCardsFromHand(handCards) {
    var hand = [];
    for (var i = 0; i < (handCards || []).length; i++) {
      var norm = normalizeCardObj(handCards[i]);
      if (norm)
        hand.push(norm);
    }
    if (hand.length < 3)
      return hand;
    var rankCounts = {};
    for (var i = 0; i < hand.length; i++) {
      var r = hand[i].type_arg;
      rankCounts[r] = (rankCounts[r] || 0) + 1;
    }
    var sorted = hand.slice().sort(function(a, b) {
      var aSpec = a.type_arg === 1 ? 1 : 0;
      var bSpec = b.type_arg === 1 ? 1 : 0;
      if (aSpec !== bSpec)
        return aSpec - bSpec;
      if (aSpec === 0) {
        var aFreq = rankCounts[a.type_arg] || 1;
        var bFreq = rankCounts[b.type_arg] || 1;
        if (aFreq !== bFreq)
          return aFreq - bFreq;
        if (a.type_arg !== b.type_arg)
          return a.type_arg - b.type_arg;
      }
      return Number(a.id) - Number(b.id);
    });
    return sorted.slice(0, 3);
  }
  function pickDefaultPlayCardsFromHand(ui) {
    var gd = ui && ui.gamedatas || {};
    var hand = [];
    var rawHand = gd.hand || [];
    for (var i = 0; i < rawHand.length; i++) {
      var norm = normalizeCardObj(rawHand[i]);
      if (norm)
        hand.push(norm);
    }
    if (hand.length === 0)
      return [];
    if (ui && ui.playerHand) {
      var selected = ui.playerHand.getSelectedItems();
      if (selected && selected.length > 0) {
        var selMap_1 = {};
        for (var i = 0; i < selected.length; i++) {
          selMap_1[String(selected[i].id)] = true;
        }
        return hand.filter(function(c) {
          return Boolean(selMap_1[String(c.id)]);
        });
      }
    }
    var stName = gd.gamestate && gd.gamestate.name;
    var wish = Number(gd.mahjongWish || 0);
    if (wish >= 2 && wish <= 14) {
      var wished = hand.find(function(c) {
        return c.type_arg === wish;
      });
      if (wished)
        return [wished];
    }
    if (stName === "playComboOpen") {
      var mj = hand.find(function(c) {
        return c.type_arg === 1 && c.type === 4;
      });
      if (mj)
        return [mj];
      var dog = hand.find(function(c) {
        return c.type_arg === 1 && c.type === 3;
      });
      if (dog)
        return [dog];
    }
    var normals = hand.filter(function(c) {
      return c.type_arg >= 2;
    }).sort(function(a, b) {
      return a.type_arg - b.type_arg;
    });
    if (normals.length > 0)
      return [normals[0]];
    return [hand[0]];
  }
  function initStudioTestHelper(gameuiInstance) {
    var win = window;
    if (win.tt)
      return;
    var host = String(window.location && window.location.hostname || "");
    if (host.indexOf("studio.boardgamearena.com") === -1)
      return;
    var consoleVerbose = true;
    var speedMode = "normal";
    function logAnnounce(tag, msg, color) {
      if (color === void 0) {
        color = "#58a6ff";
      }
      if (!consoleVerbose)
        return;
      try {
        window.console.log("%c".concat(tag, "%c ").concat(msg), "font-weight:bold;color:".concat(color), "");
      } catch (_e) {
        window.console.log("".concat(tag, " ").concat(msg));
      }
    }
    function getUi() {
      return window.gameui || gameuiInstance;
    }
    function getSortedPlayers() {
      var ui = getUi();
      var gd = ui && ui.gamedatas || {};
      return Object.values(gd.players || {}).sort(function(a, b) {
        return Number(a.no) - Number(b.no);
      });
    }
    function formatPlayerTag(playerId) {
      if (!playerId || Number(playerId) === 0)
        return "Spectator";
      var players = getSortedPlayers();
      var idx = players.findIndex(function(p2) {
        return Number(p2.id) === Number(playerId);
      });
      if (idx === -1)
        return "P?(".concat(playerId, ")");
      var p = players[idx];
      return "P".concat(idx, ":").concat(p.name);
    }
    function resolvePlayerId(seatOrPlayerId) {
      var ui = getUi();
      var players = getSortedPlayers();
      if (seatOrPlayerId === void 0 || seatOrPlayerId === null) {
        return ui ? ui.isSpectator ? 0 : Number(ui.player_id) : 0;
      }
      var rawStr = String(seatOrPlayerId).trim().toLowerCase();
      var pMatch = rawStr.match(/^p([0-3])$/);
      if (pMatch) {
        var idx = Number(pMatch[1]);
        return players[idx] ? Number(players[idx].id) : 0;
      }
      var num = Number(rawStr);
      if (!isNaN(num) && Math.floor(num) === num) {
        if (num >= 0 && num <= 3 && players[num]) {
          return Number(players[num].id);
        }
        if (num >= 1 && num <= 4 && players[num - 1] && !players.some(function(p) {
          return Number(p.id) === num;
        })) {
          return Number(players[num - 1].id);
        }
        var exact = players.find(function(p) {
          return Number(p.id) === num;
        });
        if (exact)
          return Number(exact.id);
      }
      var byName = players.find(function(p) {
        return String(p.name || "").toLowerCase() === rawStr;
      });
      if (byName)
        return Number(byName.id);
      throw new Error('Unknown seat or player "'.concat(seatOrPlayerId, '". Expected 0..3, "P0".."P3", player name, or player ID.'));
    }
    function isQueueBusy() {
      var ui = getUi();
      if (!ui)
        return false;
      var actionsRunning = Number(ui.bga && ui.bga.actions && ui.bga.actions.ajaxcall_running || 0);
      var sitecoreRunning = Number(window.g_sitecore && window.g_sitecore.ajaxcall_running || 0);
      var nq = ui.notifqueue;
      var queueLen = nq && Array.isArray(nq.queue) ? nq.queue.length : 0;
      var waitingSync = Boolean(nq && nq.waiting_from_notifend !== null);
      var resyncing = Boolean(nq && nq.notificationResendInProgress);
      return actionsRunning > 0 || sitecoreRunning > 0 || queueLen > 0 || waitingSync || resyncing;
    }
    function waitUntilIdle(timeoutMs, settleMs) {
      if (timeoutMs === void 0) {
        timeoutMs = 15e3;
      }
      if (settleMs === void 0) {
        settleMs = 50;
      }
      return new Promise(function(resolve) {
        var start = Date.now();
        var idleSince = null;
        var check = function() {
          if (Date.now() - start >= timeoutMs) {
            resolve();
            return;
          }
          if (isQueueBusy()) {
            idleSince = null;
            setTimeout(check, 12);
            return;
          }
          if (idleSince === null) {
            idleSince = Date.now();
          }
          if (Date.now() - idleSince >= settleMs) {
            resolve();
            return;
          }
          setTimeout(check, 12);
        };
        setTimeout(check, 12);
      });
    }
    function dismissDialogsIfInstant() {
      if (speedMode !== "instant")
        return;
      try {
        var dojoObj = window.dojo;
        if (dojoObj && typeof dojoObj.query === "function") {
          dojoObj.query(".dijitDialog, .dijitDialogUnderlayWrapper").forEach(dojoObj.destroy);
        }
      } catch (_e) {
      }
    }
    function querySingleDeepAll(selector, root) {
      if (root === void 0) {
        root = document;
      }
      var results = [];
      if (root.querySelectorAll) {
        results.push.apply(results, Array.from(root.querySelectorAll(selector)));
      }
      if (root.shadowRoot) {
        results.push.apply(results, querySingleDeepAll(selector, root.shadowRoot));
      }
      var allElements = root.querySelectorAll ? root.querySelectorAll("*") : [];
      for (var i = 0; i < allElements.length; i++) {
        var node = allElements[i];
        if (node && node.shadowRoot) {
          results.push.apply(results, querySingleDeepAll(selector, node.shadowRoot));
        }
      }
      return results;
    }
    function queryDeepAll(selector, root) {
      if (root === void 0) {
        root = document;
      }
      if (!selector)
        return [];
      var results = [];
      var seen = /* @__PURE__ */ new Set();
      var addUnique = function(items) {
        for (var i = 0; i < items.length; i++) {
          var el = items[i];
          if (!seen.has(el)) {
            seen.add(el);
            results.push(el);
          }
        }
      };
      var parts = selector.split(",").map(function(s2) {
        return s2.trim();
      }).filter(Boolean);
      for (var p = 0; p < parts.length; p++) {
        var part = parts[p];
        var direct = querySingleDeepAll(part, root);
        if (direct.length > 0) {
          addUnique(direct);
          continue;
        }
        var segments = part.replace(/(\\[0-9a-fA-F]{1,6})\s/g, "$1\0").split(/\s+/).map(function(s2) {
          return s2.replace(/\x00/g, " ");
        }).filter(Boolean);
        if (segments.length > 1) {
          var currentRoots = [root];
          for (var s = 0; s < segments.length; s++) {
            var seg = segments[s];
            var nextRoots = [];
            var nextSeen = /* @__PURE__ */ new Set();
            for (var r = 0; r < currentRoots.length; r++) {
              var matches = querySingleDeepAll(seg, currentRoots[r]);
              for (var m = 0; m < matches.length; m++) {
                var matchEl = matches[m];
                if (!nextSeen.has(matchEl)) {
                  nextSeen.add(matchEl);
                  nextRoots.push(matchEl);
                }
              }
            }
            currentRoots = nextRoots;
            if (currentRoots.length === 0)
              break;
          }
          addUnique(currentRoots);
        }
      }
      return results;
    }
    function queryDeep(selector, root) {
      if (root === void 0) {
        root = document;
      }
      var all = queryDeepAll(selector, root);
      return all[0] || null;
    }
    function getElementByIdDeep(id, root) {
      if (root === void 0) {
        root = document;
      }
      if (root.getElementById) {
        var el = root.getElementById(id);
        if (el)
          return el;
      }
      return queryDeep("#".concat(CSS.escape(id)), root);
    }
    var tt = {
      help: function() {
        var rows = [
          { Command: "tt.help()", Description: "Show BGA Studio console command cheat-sheet" },
          {
            Command: "tt.status()",
            Description: "Inspect current table state, players, hand, trick, and buttons"
          },
          { Command: "tt.hand()", Description: "Inspect viewer's cards in hand with codes & IDs" },
          {
            Command: "tt.assertUI()",
            Description: "Verify live BGA Studio DOM matches gamedatas invariants"
          },
          {
            Command: "tt.setSpeed('instant'|'normal')",
            Description: "Toggle instantaneousMode (1ms notification queue)"
          },
          {
            Command: "await tt.betGrandTichu(0|200, seat?)",
            Description: "Place Grand Tichu bet for seat (via testuser)"
          },
          {
            Command: "await tt.betAllGrandTichu([0,0,0,0])",
            Description: "Place Grand Tichu bets for all multiactive players in 1 tab"
          },
          {
            Command: "await tt.giveCards(cards?)",
            Description: "Select & pass 3 cards from viewer's hand"
          },
          {
            Command: "await tt.passAllCards(cards?)",
            Description: "Pass 3 cards for viewer + step bots for the other 3 players"
          },
          { Command: "await tt.play(cards?)", Description: "Select & play combo from viewer's hand" },
          {
            Command: "await tt.pass(onlyOnce=true, seat?)",
            Description: "Pass turn (or set auto-pass) for seat"
          },
          {
            Command: "await tt.collect(seat?)",
            Description: "Immediately collect won trick in confirmTrick state"
          },
          {
            Command: "await tt.wish(rank=15, seat?)",
            Description: "Make a Mahjong wish (2..14 or 15='none')"
          },
          {
            Command: "await tt.choosePhoenix(rank?, seat?)",
            Description: "Choose ambiguous Phoenix rank"
          },
          {
            Command: "await tt.giveDragon(0|1, seat?)",
            Description: "Gift Dragon trick to opponent 0 or 1"
          },
          {
            Command: "await tt.step(moves=1)",
            Description: "Run server zombieTurn for N moves via debug_bgaPlayMoves"
          },
          {
            Command: "await tt.actForOthers()",
            Description: "Have server zombieTurn act for other players until your turn"
          },
          {
            Command: "await tt.runSmokeTest(opts?)",
            Description: "Run full zero-click Studio smoke test (Grand Tichu + Pass + Tricks + UI assertions)"
          },
          {
            Command: "await tt.runRound(opts?)",
            Description: "Play a full round to completion on Studio and assert UI"
          },
          {
            Command: "await tt.runGame(opts?)",
            Description: "Fast-forward entire game to gameEnd (state 99) on Studio"
          }
        ];
        window.console.table(rows);
        return rows;
      },
      setVerbose: function(enabled) {
        if (enabled === void 0) {
          enabled = true;
        }
        consoleVerbose = Boolean(enabled);
        return consoleVerbose;
      },
      setSpeed: function(mode) {
        if (mode === void 0) {
          mode = "instant";
        }
        var ui = getUi();
        speedMode = mode;
        if (ui) {
          ui.instantaneousMode = mode === "instant" || mode === "fast";
          var nq = ui.notifqueue;
          if (nq) {
            if (!nq._origSynchronousNotifs && nq.synchronous_notifs) {
              nq._origSynchronousNotifs = __assign({}, nq.synchronous_notifs);
              nq._origSetSynchronousDuration = nq.setSynchronousDuration;
            }
            if (mode === "instant") {
              nq.synchronous_notifs = {};
              nq.setSynchronousDuration = function() {
              };
            } else if (nq._origSynchronousNotifs) {
              nq.synchronous_notifs = __assign({}, nq._origSynchronousNotifs);
              if (nq._origSetSynchronousDuration) {
                nq.setSynchronousDuration = nq._origSetSynchronousDuration;
              }
            }
          }
        }
        logAnnounce("[TICHU STUDIO SPEED]", 'Speed mode="'.concat(mode, '" (instantaneousMode=').concat(Boolean(ui && ui.instantaneousMode), ")"));
        return speedMode;
      },
      waitUntilIdle: waitUntilIdle,
      status: function(logToConsole) {
        if (logToConsole === void 0) {
          logToConsole = true;
        }
        var ui = getUi();
        if (!ui || !ui.gamedatas)
          return null;
        var gd = ui.gamedatas;
        var st = gd.gamestate || {};
        var sortedPlayers = getSortedPlayers();
        var players = sortedPlayers.map(function(p, idx) {
          var _a, _b, _c, _d;
          var pId = Number(p.id);
          var hcEl = queryDeep(".handcount.".concat(CSS.escape(String(pId))));
          var ptEl = getElementByIdDeep("pointcount_".concat(pId));
          var scoreEl = getElementByIdDeep("player_score_".concat(pId));
          var activeIds = ui.bga && ui.bga.players && typeof ui.bga.players.getActivePlayerIds === "function" ? ui.bga.players.getActivePlayerIds().map(Number) : typeof ui.isPlayerActive === "function" && ui.isPlayerActive(pId) ? [pId] : [];
          return {
            seat: idx,
            no: Number(p.no),
            id: pId,
            name: p.name,
            team: Number((_a = p.team) !== null && _a !== void 0 ? _a : idx % 2),
            handCount: hcEl ? parseInt(hcEl.textContent || "0", 10) : Number((_b = gd.handcount && gd.handcount[pId]) !== null && _b !== void 0 ? _b : 0),
            capturedPoints: ptEl ? parseInt(ptEl.textContent || "0", 10) : Number((_c = gd.capturedpoints && gd.capturedpoints[pId]) !== null && _c !== void 0 ? _c : 0),
            score: scoreEl ? parseInt(scoreEl.textContent || "0", 10) : Number((_d = p.score) !== null && _d !== void 0 ? _d : 0),
            grandTichu: Number(p.call_grand_tichu),
            tichu: Number(p.call_tichu),
            autopass: Number(p.pass || 0),
            isActive: activeIds.indexOf(pId) !== -1
          };
        });
        var hand = (gd.hand || []).map(function(c) {
          return {
            id: String(c.id),
            code: formatCardCode(c),
            pretty: formatCardPretty(c, false),
            type: Number(c.type),
            type_arg: Number(c.type_arg)
          };
        });
        var buttons = [];
        var btnNodes = queryDeepAll("#generalactions .bgabutton, #buttons .bgabutton, #buttons .action-button");
        for (var i = 0; i < btnNodes.length; i++) {
          var node = btnNodes[i];
          if (!node || node.classList.contains("hide") || node.style.display === "none")
            continue;
          buttons.push({
            id: node.id || "btn",
            label: (node.textContent || "").trim()
          });
        }
        var summary = {
          tableId: Number(ui.table_id || 0),
          state: {
            id: Number(st.id || 0),
            name: st.name || "",
            type: st.type || "",
            possibleactions: st.possibleactions || []
          },
          viewer: ui.isSpectator ? "spectator" : formatPlayerTag(ui.player_id),
          viewerId: ui.isSpectator ? 0 : Number(ui.player_id),
          isMyTurn: Boolean(typeof ui.isCurrentPlayerActive === "function" && ui.isCurrentPlayerActive()),
          activePlayer: st.active_player ? formatPlayerTag(st.active_player) : null,
          activePlayerId: st.active_player ? Number(st.active_player) : null,
          multiactive: Array.isArray(st.multiactive) ? st.multiactive.map(function(id) {
            return formatPlayerTag(id);
          }) : [],
          multiactiveIds: Array.isArray(st.multiactive) ? st.multiactive.map(function(id) {
            return Number(id);
          }) : [],
          round: Number(gd.round || 0),
          trick: Number(gd.trick || 0),
          trickPoints: Number(gd.currentTrickValue || 0),
          mahjongWish: Number(gd.mahjongWish || 0),
          firstOutPlayer: Number(gd.firstoutplayer || 0),
          players: players,
          hand: hand,
          handCodes: hand.map(function(c) {
            return c.code;
          }),
          buttons: buttons
        };
        if (logToConsole) {
          logAnnounce("[TICHU STUDIO STATE]", "Table #".concat(summary.tableId, " | State=").concat(summary.state.name, "(#").concat(summary.state.id, ") | Round=").concat(summary.round, " Trick=").concat(summary.trick, " (").concat(summary.trickPoints, " pts) | Active=").concat(summary.activePlayer || summary.multiactive.join(",") || "-"));
        }
        return summary;
      },
      hand: function() {
        var ui = getUi();
        var cards = (ui && ui.gamedatas && ui.gamedatas.hand || []).map(function(c) {
          return {
            id: String(c.id),
            code: formatCardCode(c),
            pretty: formatCardPretty(c, true),
            suit: Number(c.type),
            rank: Number(c.type_arg)
          };
        });
        logAnnounce("[TICHU STUDIO HAND]", "".concat(formatPlayerTag(ui && ui.player_id), " (").concat(cards.length, " cards): [").concat(cards.map(function(c) {
          return "".concat(c.code, "(#").concat(c.id, ")");
        }).join(", "), "]"), "#3fb950");
        return cards;
      },
      assertUI: function() {
        var ui = getUi();
        if (!ui || !ui.gamedatas) {
          throw new Error("[ASSERT_UI FAILED] window.gameui or gamedatas is missing");
        }
        var gd = ui.gamedatas;
        var st = gd.gamestate || {};
        var stateName = st.name || "";
        var overall = document.getElementById("overall-content");
        if (!overall) {
          throw new Error("[ASSERT_UI FAILED] #overall-content element missing from DOM");
        }
        var myHandItems = queryDeepAll("#myhand .stockitem:not(.to_be_destroyed)");
        if (!ui.isSpectator && stateName !== "endRound" && stateName !== "newRound") {
          var stagedPassCount = Array.isArray(ui.cardsToPass) ? ui.cardsToPass.filter(Boolean).length : 0;
          var expectedHandDom = Math.max(0, (gd.hand || []).length - stagedPassCount);
          if (myHandItems.length !== expectedHandDom) {
            throw new Error("[ASSERT_UI FAILED] #myhand .stockitem count (".concat(myHandItems.length, ") !== expected hand size (").concat(expectedHandDom, ", gamedatas.hand=").concat((gd.hand || []).length, ", staged=").concat(stagedPassCount, ")"));
          }
        }
        var statusEl = queryDeep("#game_play_area_wrap tichu-status") || queryDeep("tichu-status");
        if (!statusEl) {
          throw new Error("[ASSERT_UI FAILED] <tichu-status> element missing from DOM");
        }
        var attrRound = Number(statusEl.getAttribute("roundCount") || statusEl.roundCount);
        var attrTrick = Number(statusEl.getAttribute("trickCount") || statusEl.trickCount);
        var attrPts = Number(statusEl.getAttribute("trickPoints") || statusEl.trickPoints);
        if (attrRound !== Number(gd.round)) {
          throw new Error("[ASSERT_UI FAILED] <tichu-status> roundCount (".concat(attrRound, ") !== gamedatas.round (").concat(gd.round, ")"));
        }
        if (attrTrick !== Number(gd.trick)) {
          throw new Error("[ASSERT_UI FAILED] <tichu-status> trickCount (".concat(attrTrick, ") !== gamedatas.trick (").concat(gd.trick, ")"));
        }
        if (attrPts !== Number(gd.currentTrickValue)) {
          throw new Error("[ASSERT_UI FAILED] <tichu-status> trickPoints (".concat(attrPts, ") !== gamedatas.currentTrickValue (").concat(gd.currentTrickValue, ")"));
        }
        var players = getSortedPlayers();
        for (var i = 0; i < players.length; i++) {
          var pId = Number(players[i].id);
          var hcNodes = queryDeepAll(".handcount.".concat(CSS.escape(String(pId))));
          if (hcNodes.length === 0) {
            throw new Error("[ASSERT_UI FAILED] Missing .handcount.".concat(pId, " elements in DOM"));
          }
          var numVal = parseInt((hcNodes[0].textContent || "").trim(), 10);
          if (isNaN(numVal) || numVal < 0 || numVal > 14) {
            throw new Error('[ASSERT_UI FAILED] Invalid handcount "'.concat(hcNodes[0].textContent, '" for player ').concat(pId));
          }
        }
        return {
          ok: true,
          tableId: Number(ui.table_id || 0),
          state: stateName,
          viewer: ui.player_id,
          handDomCount: myHandItems.length,
          round: Number(gd.round),
          trick: Number(gd.trick),
          trickPoints: Number(gd.currentTrickValue)
        };
      },
      ajax: function(actionName_1) {
        return __awaiter(this, arguments, void 0, function(actionName, args, seatOrPlayerId) {
          var ui, targetPlayerId, prevTestUser;
          if (args === void 0) {
            args = {};
          }
          return __generator(this, function(_a) {
            switch (_a.label) {
              case 0:
                ui = getUi();
                if (!ui)
                  throw new Error("window.gameui is not initialized");
                targetPlayerId = seatOrPlayerId !== void 0 && seatOrPlayerId !== null ? resolvePlayerId(seatOrPlayerId) : Number(ui.player_id);
                prevTestUser = ui.forceTestUser;
                if (targetPlayerId && targetPlayerId !== Number(ui.player_id)) {
                  ui.forceTestUser = targetPlayerId;
                }
                logAnnounce("[TICHU STUDIO ACTION]", "".concat(formatPlayerTag(targetPlayerId), " -> ").concat(actionName, " ").concat(JSON.stringify(args)), "#f0883e");
                _a.label = 1;
              case 1:
                _a.trys.push([1, , 3, 4]);
                return [4, new Promise(function(resolve, reject) {
                  ui.ajaxcall("/tichu/tichu/".concat(actionName, ".html"), __assign(__assign({}, args), { lock: true }), ui, function() {
                    return resolve();
                  }, function(isErr, msg) {
                    if (isErr)
                      reject(new Error(msg || "".concat(actionName, " failed")));
                    else
                      resolve();
                  });
                })];
              case 2:
                _a.sent();
                return [3, 4];
              case 3:
                ui.forceTestUser = prevTestUser;
                return [7];
              case 4:
                return [4, waitUntilIdle(15e3, speedMode === "instant" ? 40 : 200)];
              case 5:
                _a.sent();
                dismissDialogsIfInstant();
                return [2, tt.status(false)];
            }
          });
        });
      },
      betGrandTichu: function() {
        return __awaiter(this, arguments, void 0, function(bet, seat) {
          var numBet;
          if (bet === void 0) {
            bet = 0;
          }
          return __generator(this, function(_a) {
            numBet = bet === true || Number(bet) === 200 ? 200 : 0;
            return [2, tt.ajax("grandTichuBet", { bet: numBet }, seat)];
          });
        });
      },
      betAllGrandTichu: function() {
        return __awaiter(this, arguments, void 0, function(bets) {
          var ui, players, multi, idx, pId, betVal;
          if (bets === void 0) {
            bets = [0, 0, 0, 0];
          }
          return __generator(this, function(_a) {
            switch (_a.label) {
              case 0:
                ui = getUi();
                players = getSortedPlayers();
                multi = ui && ui.gamedatas && ui.gamedatas.gamestate && Array.isArray(ui.gamedatas.gamestate.multiactive) ? ui.gamedatas.gamestate.multiactive.map(Number) : players.map(function(p) {
                  return Number(p.id);
                });
                idx = 0;
                _a.label = 1;
              case 1:
                if (!(idx < players.length)) return [3, 4];
                pId = Number(players[idx].id);
                if (multi.indexOf(pId) === -1)
                  return [3, 3];
                betVal = Number(bets[idx]) === 200 ? 200 : 0;
                return [4, tt.betGrandTichu(betVal, pId)];
              case 2:
                _a.sent();
                _a.label = 3;
              case 3:
                idx++;
                return [3, 1];
              case 4:
                return [4, waitUntilIdle(15e3, 200)];
              case 5:
                _a.sent();
                return [2, tt.status(false)];
            }
          });
        });
      },
      betTichu: function(seat) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a) {
            return [2, tt.ajax("tichuBet", { bet: 100 }, seat)];
          });
        });
      },
      confirmTichu: function() {
        return __awaiter(this, arguments, void 0, function(bet, seat) {
          if (bet === void 0) {
            bet = 100;
          }
          return __generator(this, function(_a) {
            return [2, tt.ajax("confirmTichu", { bet: Number(bet) }, seat)];
          });
        });
      },
      giveCards: function(cards) {
        return __awaiter(this, void 0, void 0, function() {
          var ui, gd, chosenCards, i, i, node, toGiveStr;
          return __generator(this, function(_a) {
            ui = getUi();
            gd = ui.gamedatas;
            if (typeof ui.onResetPassCards === "function" && Array.isArray(ui.cardsToPass)) {
              if (ui.cardsToPass.some(Boolean)) {
                ui.onResetPassCards();
              }
            }
            chosenCards = cards === void 0 || cards === null ? pickThreeDefaultCardsFromHand(gd.hand) : resolveCardsFromHand(cards, gd.hand);
            if (!chosenCards || chosenCards.length !== 3) {
              throw new Error("giveCards requires 3 cards, got ".concat(chosenCards ? chosenCards.length : 0));
            }
            if (ui.playerHand && typeof ui.onGiveCard === "function") {
              for (i = 0; i < 3; i++) {
                ui.playerHand.unselectAll();
                ui.playerHand.selectItem(String(chosenCards[i].id));
                ui.onGiveCard(i);
              }
              for (i = 0; i < 3; i++) {
                node = document.getElementById("cardontable_" + ui.player_id + "_" + chosenCards[i].id);
                if (node && node.parentNode)
                  node.parentNode.removeChild(node);
              }
              ui.cardsToPass = [];
            }
            toGiveStr = chosenCards.map(function(c) {
              return c.id;
            }).join(";") + ";";
            return [2, tt.ajax("giveTheCards", { cards: toGiveStr })];
          });
        });
      },
      passAllCards: function(cards) {
        return __awaiter(this, void 0, void 0, function() {
          var cur, remaining;
          return __generator(this, function(_a) {
            switch (_a.label) {
              case 0:
                cur = tt.status(false);
                if (cur.state.name !== "giveCards") {
                  return [2, cur];
                }
                if (!cur.isMyTurn) return [3, 2];
                return [4, tt.giveCards(cards)];
              case 1:
                cur = _a.sent();
                _a.label = 2;
              case 2:
                if (!(cur.state.name === "giveCards")) return [3, 4];
                remaining = cur.multiactiveIds.length || 3;
                return [4, tt.step(remaining)];
              case 3:
                cur = _a.sent();
                _a.label = 4;
              case 4:
                if (!!getUi().instantaneousMode) return [3, 6];
                return [4, new Promise(function(r) {
                  return setTimeout(r, 2100);
                })];
              case 5:
                _a.sent();
                _a.label = 6;
              case 6:
                return [4, waitUntilIdle(1e4, speedMode === "instant" ? 40 : 150)];
              case 7:
                _a.sent();
                return [2, tt.status(false)];
            }
          });
        });
      },
      play: function(cards) {
        return __awaiter(this, void 0, void 0, function() {
          var ui, gd, chosenCards, i, cardIdStr;
          return __generator(this, function(_a) {
            ui = getUi();
            gd = ui.gamedatas;
            chosenCards = cards === void 0 || cards === null ? pickDefaultPlayCardsFromHand(ui) : resolveCardsFromHand(cards, gd.hand);
            if (!chosenCards || chosenCards.length === 0) {
              throw new Error("No cards selected or resolved for tt.play()");
            }
            if (ui.playerHand) {
              ui.playerHand.unselectAll();
              for (i = 0; i < chosenCards.length; i++) {
                ui.playerHand.selectItem(String(chosenCards[i].id));
              }
            }
            cardIdStr = chosenCards.map(function(c) {
              return c.id;
            }).join(";");
            return [2, tt.ajax("playCombo", { cards: cardIdStr })];
          });
        });
      },
      pass: function() {
        return __awaiter(this, arguments, void 0, function(onlyOnce, seat) {
          var ui;
          if (onlyOnce === void 0) {
            onlyOnce = true;
          }
          return __generator(this, function(_a) {
            ui = getUi();
            if (ui && ui.playerHand && (seat === void 0 || seat === null)) {
              ui.playerHand.unselectAll();
            }
            return [2, tt.ajax("pass", { onlyOnce: Boolean(onlyOnce) }, seat)];
          });
        });
      },
      collect: function(seat) {
        return __awaiter(this, void 0, void 0, function() {
          var ui, st, targetSeat;
          return __generator(this, function(_a) {
            ui = getUi();
            clearTimeout(ui.autoCollectTimeout);
            st = ui && ui.gamedatas && ui.gamedatas.gamestate;
            targetSeat = seat !== void 0 && seat !== null ? seat : st && st.active_player ? Number(st.active_player) : void 0;
            return [2, tt.ajax("collect", {}, targetSeat)];
          });
        });
      },
      wish: function() {
        return __awaiter(this, arguments, void 0, function(rank, seat) {
          var ui, parsedRank, st, targetSeat;
          if (rank === void 0) {
            rank = 15;
          }
          return __generator(this, function(_a) {
            ui = getUi();
            parsedRank = parseRankToken(rank);
            if (!parsedRank || parsedRank < 2 || parsedRank > 15) {
              throw new Error('Invalid Mahjong wish rank "'.concat(rank, '". Expected 2..14 or 15 (none).'));
            }
            st = ui && ui.gamedatas && ui.gamedatas.gamestate;
            targetSeat = seat !== void 0 && seat !== null ? seat : st && st.active_player ? Number(st.active_player) : void 0;
            return [2, tt.ajax("makeAWish", { wish: parsedRank }, targetSeat)];
          });
        });
      },
      choosePhoenix: function(rank, seat) {
        return __awaiter(this, void 0, void 0, function() {
          var ui, parsedRank, st, targetSeat;
          return __generator(this, function(_a) {
            ui = getUi();
            parsedRank = rank !== void 0 ? parseRankToken(rank) : null;
            if (!parsedRank && Array.isArray(ui.allowedValues) && ui.allowedValues.length > 0) {
              parsedRank = Number(ui.allowedValues[0]);
            }
            if (!parsedRank) {
              throw new Error('Invalid Phoenix value "'.concat(rank, '"'));
            }
            st = ui && ui.gamedatas && ui.gamedatas.gamestate;
            targetSeat = seat !== void 0 && seat !== null ? seat : st && st.active_player ? Number(st.active_player) : void 0;
            return [2, tt.ajax("choosePhoenix", { phoenixValue: parsedRank }, targetSeat)];
          });
        });
      },
      cancelPhoenix: function(seat) {
        return __awaiter(this, void 0, void 0, function() {
          var ui, st, targetSeat;
          return __generator(this, function(_a) {
            ui = getUi();
            st = ui && ui.gamedatas && ui.gamedatas.gamestate;
            targetSeat = seat !== void 0 && seat !== null ? seat : st && st.active_player ? Number(st.active_player) : void 0;
            return [2, tt.ajax("cancelPhoenix", {}, targetSeat)];
          });
        });
      },
      giveDragon: function() {
        return __awaiter(this, arguments, void 0, function(enemyIndex, seat) {
          var ui, st, targetSeat;
          if (enemyIndex === void 0) {
            enemyIndex = 0;
          }
          return __generator(this, function(_a) {
            ui = getUi();
            st = ui && ui.gamedatas && ui.gamedatas.gamestate;
            targetSeat = seat !== void 0 && seat !== null ? seat : st && st.active_player ? Number(st.active_player) : void 0;
            return [2, tt.ajax("chooseDragonGift", { player: Number(enemyIndex) }, targetSeat)];
          });
        });
      },
      bomb: function(cards, seat) {
        return __awaiter(this, void 0, void 0, function() {
          var ui, curState;
          return __generator(this, function(_a) {
            switch (_a.label) {
              case 0:
                ui = getUi();
                curState = ui.gamedatas && ui.gamedatas.gamestate && ui.gamedatas.gamestate.name;
                if (!(curState !== "playBomb")) return [3, 2];
                return [4, tt.ajax("playBomb", { cards: "" }, seat)];
              case 1:
                _a.sent();
                if (cards === void 0 || cards === null) {
                  return [2, tt.status(false)];
                }
                _a.label = 2;
              case 2:
                return [2, tt.play(cards)];
            }
          });
        });
      },
      cancelBomb: function(seat) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a) {
            return [2, tt.ajax("cancel", {}, seat)];
          });
        });
      },
      step: function() {
        return __awaiter(this, arguments, void 0, function(moves) {
          var ui;
          if (moves === void 0) {
            moves = 1;
          }
          return __generator(this, function(_a) {
            switch (_a.label) {
              case 0:
                ui = getUi();
                if (!ui || !ui.bga || !ui.bga.actions) {
                  throw new Error("BGA Studio actions helper is not available");
                }
                clearTimeout(ui.autoCollectTimeout);
                logAnnounce("[TICHU STUDIO STEP]", "Running debug_bgaPlayMoves (moves=".concat(moves, ")..."), "#d2a8ff");
                return [4, ui.bga.actions.performAction("debug_bgaPlayMoves", { moves: Number(moves) || 1 }, { checkAction: false, lock: false })];
              case 1:
                _a.sent();
                return [4, waitUntilIdle(15e3, speedMode === "instant" ? 45 : 250)];
              case 2:
                _a.sent();
                dismissDialogsIfInstant();
                return [2, tt.status(false)];
            }
          });
        });
      },
      actForOthers: function() {
        return __awaiter(this, arguments, void 0, function(maxSteps) {
          var i, s;
          if (maxSteps === void 0) {
            maxSteps = 12;
          }
          return __generator(this, function(_a) {
            switch (_a.label) {
              case 0:
                i = 0;
                _a.label = 1;
              case 1:
                if (!(i < maxSteps)) return [3, 4];
                s = tt.status(false);
                if (!s || s.state.name === "gameEnd" || s.state.id === 99)
                  return [3, 4];
                if (s.isMyTurn && s.state.type === "activeplayer")
                  return [3, 4];
                if (s.isMyTurn && s.state.type === "multipleactiveplayer")
                  return [3, 4];
                return [4, tt.step(1)];
              case 2:
                _a.sent();
                _a.label = 3;
              case 3:
                i++;
                return [3, 1];
              case 4:
                return [2, tt.status(false)];
            }
          });
        });
      },
      runSmokeTest: function() {
        return __awaiter(this, arguments, void 0, function(_a) {
          var t0, assertionsPassed, checkUI, startStatus, cur, stepsRun, elapsedMs, result;
          var _b = _a === void 0 ? {} : _a, _c = _b.tricks, tricks = _c === void 0 ? 3 : _c, _d = _b.speed, speed = _d === void 0 ? "instant" : _d;
          return __generator(this, function(_f) {
            switch (_f.label) {
              case 0:
                t0 = Date.now();
                tt.setSpeed(speed);
                logAnnounce("[TICHU STUDIO SMOKE]", "\u25B6 Starting BGA Studio Smoke Test (tricks=".concat(tricks, ", speed=").concat(speed, ")..."), "#ffa657");
                assertionsPassed = 0;
                checkUI = function() {
                  tt.assertUI();
                  assertionsPassed++;
                };
                startStatus = tt.status(false);
                if (!startStatus)
                  throw new Error("Game UI not ready");
                checkUI();
                cur = tt.status(false);
                stepsRun = 0;
                if (!(cur.state.name === "grandTichuBets")) return [3, 5];
                if (!cur.isMyTurn) return [3, 2];
                return [4, tt.betGrandTichu(0)];
              case 1:
                cur = _f.sent();
                stepsRun++;
                _f.label = 2;
              case 2:
                if (!(cur.state.name === "grandTichuBets")) return [3, 4];
                return [4, tt.step(cur.multiactiveIds.length || 3)];
              case 3:
                cur = _f.sent();
                stepsRun++;
                _f.label = 4;
              case 4:
                checkUI();
                _f.label = 5;
              case 5:
                if (!(cur.state.name === "giveCards")) return [3, 7];
                return [4, tt.passAllCards()];
              case 6:
                cur = _f.sent();
                stepsRun += 2;
                checkUI();
                _f.label = 7;
              case 7:
                if (!(cur.isMyTurn && cur.state.name === "playComboOpen")) return [3, 9];
                return [4, tt.play()];
              case 8:
                cur = _f.sent();
                stepsRun++;
                checkUI();
                _f.label = 9;
              case 9:
                if (!(cur.state.name === "mahjongPlay")) return [3, 11];
                return [4, tt.wish(15)];
              case 10:
                cur = _f.sent();
                stepsRun++;
                checkUI();
                _f.label = 11;
              case 11:
                if (!(cur.state.name !== "gameEnd" && cur.state.id !== 99)) return [3, 15];
                return [4, tt.step(Math.max(4, tricks * 4))];
              case 12:
                cur = _f.sent();
                stepsRun++;
                if (!(cur.state.name === "confirmTrick")) return [3, 14];
                return [4, tt.collect()];
              case 13:
                cur = _f.sent();
                stepsRun++;
                _f.label = 14;
              case 14:
                checkUI();
                _f.label = 15;
              case 15:
                elapsedMs = Date.now() - t0;
                result = {
                  ok: true,
                  tableId: cur.tableId,
                  startState: startStatus.state.name,
                  endState: cur.state.name,
                  round: cur.round,
                  trick: cur.trick,
                  viewerHandCount: cur.hand.length,
                  stepsRun: stepsRun,
                  assertionsPassed: assertionsPassed,
                  elapsedMs: elapsedMs
                };
                logAnnounce("[TICHU STUDIO SMOKE]", "\u2714 PASS in ".concat(elapsedMs, "ms \u2014 Table #").concat(result.tableId, ", State=").concat(result.endState, ", Round=").concat(result.round, ", Trick=").concat(result.trick, ", Assertions=").concat(assertionsPassed), "#3fb950");
                return [2, result];
            }
          });
        });
      },
      runRound: function() {
        return __awaiter(this, arguments, void 0, function(_a) {
          var t0, cur, initialRound, batches;
          var _b = _a === void 0 ? {} : _a, _c = _b.speed, speed = _c === void 0 ? "instant" : _c, _d = _b.maxSteps, maxSteps = _d === void 0 ? 12 : _d;
          return __generator(this, function(_f) {
            switch (_f.label) {
              case 0:
                t0 = Date.now();
                tt.setSpeed(speed);
                cur = tt.status(false);
                initialRound = cur.round;
                batches = 0;
                _f.label = 1;
              case 1:
                if (!(cur.state.name !== "gameEnd" && cur.state.id !== 99 && cur.round === initialRound && batches < maxSteps)) return [3, 3];
                return [4, tt.step(35)];
              case 2:
                cur = _f.sent();
                batches++;
                return [3, 1];
              case 3:
                if (!(cur.state.name === "confirmTrick")) return [3, 5];
                return [4, tt.collect()];
              case 4:
                cur = _f.sent();
                _f.label = 5;
              case 5:
                dismissDialogsIfInstant();
                if (cur.state.name !== "gameEnd" && cur.state.id !== 99) {
                  tt.assertUI();
                }
                return [2, {
                  ok: true,
                  tableId: cur.tableId,
                  initialRound: initialRound,
                  currentRound: cur.round,
                  state: cur.state.name,
                  batches: batches,
                  players: cur.players.map(function(p) {
                    return {
                      name: p.name,
                      score: p.score,
                      handCount: p.handCount
                    };
                  }),
                  elapsedMs: Date.now() - t0
                }];
            }
          });
        });
      },
      runGame: function() {
        return __awaiter(this, arguments, void 0, function(_a) {
          var t0, cur, batches;
          var _b = _a === void 0 ? {} : _a, _c = _b.speed, speed = _c === void 0 ? "instant" : _c, _d = _b.maxBatches, maxBatches = _d === void 0 ? 40 : _d;
          return __generator(this, function(_f) {
            switch (_f.label) {
              case 0:
                t0 = Date.now();
                tt.setSpeed(speed);
                cur = tt.status(false);
                batches = 0;
                _f.label = 1;
              case 1:
                if (!(cur.state.name !== "gameEnd" && cur.state.id !== 99 && batches < maxBatches)) return [3, 3];
                return [4, tt.step(50)];
              case 2:
                cur = _f.sent();
                batches++;
                return [3, 1];
              case 3:
                return [2, {
                  ok: cur.state.name === "gameEnd" || cur.state.id === 99,
                  tableId: cur.tableId,
                  state: cur.state.name,
                  round: cur.round,
                  players: cur.players.map(function(p) {
                    return { name: p.name, score: p.score };
                  }),
                  elapsedMs: Date.now() - t0
                }];
            }
          });
        });
      },
      expressStop: function(tableId) {
        return __awaiter(this, void 0, void 0, function() {
          var ui, tid, token, headers, r1;
          return __generator(this, function(_a) {
            switch (_a.label) {
              case 0:
                ui = getUi();
                tid = Number(tableId || ui && ui.table_id || 0);
                if (!tid)
                  throw new Error("No tableId available for expressStop");
                token = window.bgaConfig && window.bgaConfig.requestToken || "";
                headers = token ? { "X-Request-Token": token } : {};
                return [4, fetch("/table/table/expressGameStopTable.html?table=".concat(tid, "&noerrortracking=true&dojo.preventCache=").concat(Date.now()), { headers: headers, credentials: "same-origin" }).then(function(r) {
                  return r.json();
                })];
              case 1:
                r1 = _a.sent();
                if (!(!r1 || Number(r1.status) !== 1)) return [3, 3];
                return [4, fetch("/table/table/quitgame.html?table=".concat(tid, "&neutralized=true&s=table_QuitGame&noerrortracking=true&dojo.preventCache=").concat(Date.now()), { headers: headers, credentials: "same-origin" }).then(function(r) {
                  return r.json();
                })];
              case 2:
                _a.sent();
                _a.label = 3;
              case 3:
                return [2, { ok: true, stoppedTableId: tid }];
            }
          });
        });
      },
      expressStartNew: function() {
        return __awaiter(this, void 0, void 0, function() {
          var ui, oldTableId, gameId, token, headers, _e_1, cJson, newTableId, sJson;
          return __generator(this, function(_a) {
            switch (_a.label) {
              case 0:
                ui = getUi();
                oldTableId = Number(ui && ui.table_id || 0);
                gameId = Number(ui && ui.game_id || 1386);
                token = window.bgaConfig && window.bgaConfig.requestToken || "";
                headers = token ? { "X-Request-Token": token } : {};
                if (!oldTableId) return [3, 4];
                _a.label = 1;
              case 1:
                _a.trys.push([1, 3, , 4]);
                return [4, tt.expressStop(oldTableId)];
              case 2:
                _a.sent();
                return [3, 4];
              case 3:
                _e_1 = _a.sent();
                return [3, 4];
              case 4:
                return [4, fetch("/table/table/createnew.html?game=".concat(gameId, "&gamemode=realtime&is_meeting=false&forceManual=true&lobbyType=kintsugi&noerrortracking=true&dojo.preventCache=").concat(Date.now()), { headers: headers, credentials: "same-origin" }).then(function(r) {
                  return r.json();
                })];
              case 5:
                cJson = _a.sent();
                if (!cJson || Number(cJson.status) !== 1 || !cJson.data || !cJson.data.table) {
                  throw new Error(cJson && cJson.error || "createnew failed");
                }
                newTableId = Number(cJson.data.table);
                return [4, fetch("/tablemanager/tablemanager/expressStart.html?table=".concat(newTableId, "&noerrortracking=true&dojo.preventCache=").concat(Date.now()), { headers: headers, credentials: "same-origin" }).then(function(r) {
                  return r.json();
                })];
              case 6:
                sJson = _a.sent();
                if (!sJson || Number(sJson.status) !== 1) {
                  throw new Error(sJson && sJson.error || "expressStart failed");
                }
                return [2, {
                  ok: true,
                  stoppedTableId: oldTableId,
                  newTableId: newTableId,
                  tableviewUrl: "https://studio.boardgamearena.com/tableview?table=".concat(newTableId)
                }];
            }
          });
        });
      }
    };
    function mountStudioTestBar() {
      var _this = this;
      if (window.g_archive_mode)
        return;
      if (document.getElementById("studio-test-bar"))
        return;
      var wrap = document.getElementById("game_play_area_wrap");
      if (!wrap || !wrap.parentNode)
        return;
      var bar = document.createElement("div");
      bar.id = "studio-test-bar";
      bar.style.cssText = "background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px 10px;margin:4px 0 8px 0;font-family:monospace;font-size:12px;display:flex;flex-direction:column;gap:6px;z-index:100;position:relative;";
      var btnStyle = "background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:3px 8px;cursor:pointer;font-family:monospace;font-size:11px;";
      var primaryBtnStyle = "background:#238636;color:#ffffff;border:1px solid #2ea043;border-radius:4px;padding:3px 8px;cursor:pointer;font-family:monospace;font-size:11px;font-weight:bold;";
      bar.innerHTML = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;"><strong style="color:#58a6ff;">\u26A1 Studio Test (window.tt)</strong>' + '<button type="button" id="tt_btn_smoke" style="'.concat(primaryBtnStyle, '">\uD83E\uDDEA Smoke Test</button>') + '<button type="button" id="tt_btn_round" style="'.concat(btnStyle, '">\uD83C\uDFC1 Run Round</button>') + '<button type="button" id="tt_btn_game" style="'.concat(btnStyle, '">\uD83C\uDFC6 Run Game</button>') + '<button type="button" id="tt_btn_gt_all" style="'.concat(btnStyle, '">\u26A1 GT Bet All 4</button>') + '<button type="button" id="tt_btn_pass_all" style="'.concat(btnStyle, '">\uD83C\uDCCF Pass 3 + Bots</button>') + '<button type="button" id="tt_btn_step1" style="'.concat(btnStyle, '">\uD83E\uDD16 Step 1</button>') + '<button type="button" id="tt_btn_others" style="'.concat(btnStyle, '">\uD83E\uDD16 Act for Others</button>') + '<button type="button" id="tt_btn_assert" style="'.concat(btnStyle, '">\u2714 Assert UI</button>') + '<button type="button" id="tt_btn_new" style="'.concat(btnStyle, '">\uD83D\uDD04 New Express Table</button>') + '<button type="button" id="tt_btn_stop" style="background:#da3633;color:#ffffff;border:1px solid #f85149;border-radius:4px;padding:3px 8px;cursor:pointer;font-family:monospace;font-size:11px;">\u23F9 Express Stop</button><input type="text" id="tt_cmd_input" placeholder="e.g. runSmokeTest / status / wish:8" style="background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:2px 6px;font-family:monospace;font-size:11px;width:180px;" />' + '<button type="button" id="tt_cmd_run" style="'.concat(btnStyle, '">\u25B6 Run</button>') + '</div><pre id="tt_test_output" data-done="1" data-status="ready" style="margin:0;padding:4px 8px;background:#161b22;border:1px solid #21262d;border-radius:4px;color:#8b949e;max-height:110px;overflow:auto;white-space:pre-wrap;word-break:break-all;font-size:11px;">Ready \u2014 click a button or run `await tt.runSmokeTest()` in console.</pre>';
      wrap.parentNode.insertBefore(bar, wrap);
      var outEl = document.getElementById("tt_test_output");
      var runTask = function(label, fn) {
        return __awaiter(_this, void 0, void 0, function() {
          var res, err_1;
          return __generator(this, function(_a) {
            switch (_a.label) {
              case 0:
                outEl.setAttribute("data-done", "0");
                outEl.setAttribute("data-status", "running");
                outEl.style.color = "#d29922";
                outEl.textContent = "Running ".concat(label, "...");
                _a.label = 1;
              case 1:
                _a.trys.push([1, 3, , 4]);
                return [4, fn()];
              case 2:
                res = _a.sent();
                outEl.setAttribute("data-status", "pass");
                outEl.setAttribute("data-done", "1");
                outEl.style.color = "#3fb950";
                outEl.textContent = JSON.stringify(res);
                return [3, 4];
              case 3:
                err_1 = _a.sent();
                outEl.setAttribute("data-status", "fail");
                outEl.setAttribute("data-done", "1");
                outEl.style.color = "#f85149";
                outEl.textContent = JSON.stringify({
                  ok: false,
                  error: err_1 && err_1.message || String(err_1)
                });
                return [3, 4];
              case 4:
                return [2];
            }
          });
        });
      };
      var bind = function(id, label, fn) {
        var btn = document.getElementById(id);
        if (btn) {
          btn.addEventListener("click", function() {
            return runTask(label, fn);
          });
        }
      };
      bind("tt_btn_smoke", "runSmokeTest", function() {
        return tt.runSmokeTest({ tricks: 3, speed: "instant" });
      });
      bind("tt_btn_round", "runRound", function() {
        return tt.runRound({ speed: "instant" });
      });
      bind("tt_btn_game", "runGame", function() {
        return tt.runGame({ speed: "instant" });
      });
      bind("tt_btn_gt_all", "betAllGrandTichu", function() {
        return tt.betAllGrandTichu([0, 0, 0, 0]);
      });
      bind("tt_btn_pass_all", "passAllCards", function() {
        return tt.passAllCards();
      });
      bind("tt_btn_step1", "step(1)", function() {
        return tt.step(1);
      });
      bind("tt_btn_others", "actForOthers", function() {
        return tt.actForOthers();
      });
      bind("tt_btn_assert", "assertUI + status", function() {
        return {
          ui: tt.assertUI(),
          status: tt.status(false)
        };
      });
      bind("tt_btn_new", "expressStartNew", function() {
        return tt.expressStartNew();
      });
      bind("tt_btn_stop", "expressStop", function() {
        return tt.expressStop();
      });
      var cmdBtn = document.getElementById("tt_cmd_run");
      var cmdInput = document.getElementById("tt_cmd_input");
      if (cmdBtn && cmdInput) {
        cmdBtn.addEventListener("click", function() {
          var raw = (cmdInput.value || "").trim();
          if (!raw)
            return;
          var colonIdx = raw.indexOf(":");
          var method = (colonIdx === -1 ? raw : raw.slice(0, colonIdx)).trim();
          var argRaw = colonIdx === -1 ? void 0 : raw.slice(colonIdx + 1).trim();
          runTask(raw, function() {
            return __awaiter(_this, void 0, void 0, function() {
              var fn, parsedArg;
              return __generator(this, function(_a) {
                switch (_a.label) {
                  case 0:
                    fn = tt[method];
                    if (typeof fn !== "function") {
                      throw new Error('Unknown tt method: "'.concat(method, '"'));
                    }
                    if (!(argRaw === void 0 || argRaw === "")) return [3, 2];
                    return [4, fn.call(tt)];
                  case 1:
                    return [2, _a.sent()];
                  case 2:
                    parsedArg = argRaw;
                    try {
                      parsedArg = JSON.parse(argRaw);
                    } catch (_e) {
                    }
                    return [4, fn.call(tt, parsedArg)];
                  case 3:
                    return [2, _a.sent()];
                }
              });
            });
          });
        });
      }
    }
    mountStudioTestBar();
    win.tt = tt;
    win.tichuTest = tt;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.tt = tt;
        window.parent.tichuTest = tt;
        window.parent.gameui = getUi();
      }
    } catch (_e) {
    }
    logAnnounce("[TICHU STUDIO READY]", "Console runner `window.tt` & `#studio-test-bar` attached. Type `tt.help()` or click `\uD83E\uDDEA Smoke Test`.", "#3fb950");
  }

  // dist/tichu.js
  var __spreadArray = function(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i);
        ar[i] = from[i];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
  var Bet;
  (function(Bet2) {
    Bet2["NO_BET_YET"] = "-1";
    Bet2["NO_BET"] = "0";
    Bet2["TICHU"] = "100";
    Bet2["GRAND_TICHU"] = "200";
  })(Bet || (Bet = {}));
  var Tichu = (function() {
    function Tichu2() {
      var _this = this;
      this.experimentalArchiveModeEnabled = false;
      this.allLastCombos = {};
      this.stateName = "";
      this.playerHand = {
        getAllItems: function() {
          var _a;
          var hand = window.gameModel ? window.gameModel.getState().hand : ((_a = _this.gamedatas) === null || _a === void 0 ? void 0 : _a.hand) || [];
          return hand.map(function(c) {
            return {
              id: Number(c.id),
              type: (Number(c.type) - 1) * 14 + (Number(c.type_arg) - 1)
            };
          });
        },
        getSelectedItems: function() {
          if (!window.gameModel)
            return [];
          var st = window.gameModel.getState();
          var selectedSet = new Set(st.selectedCardIds.map(String));
          return st.hand.filter(function(c) {
            return selectedSet.has(String(c.id));
          }).map(function(c) {
            return {
              id: Number(c.id),
              type: (Number(c.type) - 1) * 14 + (Number(c.type_arg) - 1)
            };
          });
        },
        selectItem: function(id) {
          if (!window.gameModel)
            return;
          var idStr = String(id);
          var st = window.gameModel.getState();
          if (st.stateName === "giveCards") {
            window.gameModel.setSelectedCardIds([idStr]);
          } else if (!st.selectedCardIds.includes(idStr)) {
            window.gameModel.setSelectedCardIds(__spreadArray(__spreadArray([], st.selectedCardIds, true), [idStr], false));
          }
        },
        unselectAll: function() {
          var _a;
          (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.clearSelection();
        },
        removeAll: function() {
          var _a;
          (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.clearSelection();
        },
        addToStockWithId: function(_type, _id) {
        },
        removeFromStockById: function(_id) {
        },
        count: function() {
          var _a;
          return window.gameModel ? window.gameModel.getState().hand.length : (((_a = _this.gamedatas) === null || _a === void 0 ? void 0 : _a.hand) || []).length;
        }
      };
      this.mahjongValues = {
        get items() {
          return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(function(v) {
            return {
              id: v,
              type: v - 2
            };
          });
        },
        getSelectedItems: function() {
          var _a, _b;
          var val = (_b = (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.getState().selectedMahjongWish) !== null && _b !== void 0 ? _b : null;
          return val !== null ? [{ id: val, type: val - 2 }] : [];
        },
        selectItem: function(id) {
          var _a;
          var num = Number(id);
          (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setSelectedMahjongWish(Number.isNaN(num) ? null : num);
        },
        unselectAll: function() {
          var _a;
          (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setSelectedMahjongWish(null);
        }
      };
      this.phoenixValues = {
        get items() {
          var _a, _b;
          var allowed = (_b = (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.getState().phoenixAllowedValues) !== null && _b !== void 0 ? _b : [];
          return allowed.map(function(v) {
            return { id: v, type: v - 2 };
          });
        },
        getSelectedItems: function() {
          var _a, _b;
          var val = (_b = (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.getState().selectedPhoenixValue) !== null && _b !== void 0 ? _b : null;
          return val !== null ? [{ id: val, type: val - 2 }] : [];
        },
        selectItem: function(id) {
          var _a;
          var num = Number(id);
          (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setSelectedPhoenixValue(Number.isNaN(num) ? null : num);
        },
        unselectAll: function() {
          var _a;
          (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setSelectedPhoenixValue(null);
        }
      };
    }
    Object.defineProperty(Tichu2.prototype, "allowedValues", {
      get: function() {
        var _a, _b;
        return (_b = (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.getState().phoenixAllowedValues) !== null && _b !== void 0 ? _b : [];
      },
      set: function(vals) {
        var _a;
        (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setPhoenixAllowedValues(Array.isArray(vals) ? vals.map(Number) : []);
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(Tichu2.prototype, "clockwise", {
      get: function() {
        return window.gameModel ? window.gameModel.getState().clockwise : true;
      },
      set: function(val) {
        var _a;
        (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setClockwise(Boolean(val));
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(Tichu2.prototype, "cardsToPass", {
      get: function() {
        var _a;
        if (!window.gameModel)
          return [];
        var slots = window.gameModel.getState().passSlots;
        var handIds = new Set((((_a = this.gamedatas) === null || _a === void 0 ? void 0 : _a.hand) || []).map(function(c) {
          return Number(c.id);
        }));
        return slots.map(function(s) {
          if (!s.givenCard)
            return null;
          var idNum = Number(s.givenCard.id);
          return handIds.has(idNum) ? idNum : null;
        });
      },
      set: function(_val) {
      },
      enumerable: false,
      configurable: true
    });
    Tichu2.prototype.readPrefs = function() {
      var theme = Number(this.getGameUserPreference(104));
      if (Number.isNaN(theme)) {
        var stored = localStorage.getItem("tichu_theme");
        theme = stored !== null ? Number(stored) || 0 : 0;
      }
      return {
        100: Number(this.getGameUserPreference(100)),
        101: Number(this.getGameUserPreference(101)),
        102: Number(this.getGameUserPreference(102)),
        103: Number(this.getGameUserPreference(103)),
        104: theme,
        squareTable: this.getGameUserPreference(100) == 2,
        clockwise: this.getGameUserPreference(101) != 1,
        isTiki: this.getGameUserPreference(103) == 1,
        theme: theme
      };
    };
    Tichu2.prototype.initPreferencesObserver = function() {
      var _this = this;
      document.querySelectorAll(".preference_control").forEach(function(el) {
        el.addEventListener("change", function(e) {
          var _a;
          var target = e.target;
          var match = (_a = target === null || target === void 0 ? void 0 : target.id) === null || _a === void 0 ? void 0 : _a.match(/^preference_[cf]ontrol_(\d+)$/);
          if (!target || !match)
            return;
          var pref = Number(match[1]);
          var newValue = Number(target.value);
          if (_this.prefs && _this.prefs[pref]) {
            _this.prefs[pref].value = String(newValue);
          }
          _this.onPreferenceChange(pref, newValue);
        });
      });
    };
    Tichu2.prototype.onPreferenceChange = function(prefId, prefValue) {
      var _a;
      switch (Number(prefId)) {
        case 100:
          this.onLayoutChange(prefValue == 2);
          break;
        case 101:
          this.onDirectionChange(prefValue != 1);
          break;
        case 103:
          (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setTiki(prefValue == 1);
          break;
        case 104:
          this.onThemeChange(Number(prefValue));
          break;
      }
    };
    Tichu2.prototype.rehydrateModel = function() {
      var _a, _b, _c, _d, _e, _f;
      var gamedatas = this.gamedatas;
      if (!gamedatas)
        return;
      this.allLastCombos = gamedatas.allLastCombos || {};
      this.stateName = ((_a = gamedatas.gamestate) === null || _a === void 0 ? void 0 : _a.name) || "";
      this.active_player = (_b = gamedatas.gamestate) === null || _b === void 0 ? void 0 : _b.active_player;
      var overall = document.getElementById("overall-content");
      if (overall) {
        overall.classList.toggle("spectatorMode", Boolean(this.isSpectator));
        overall.classList.toggle("archiveMode", Boolean(window.g_archive_mode));
      }
      var playArea = document.getElementById("game_play_area");
      if (playArea) {
        playArea.classList.toggle("isAllInfoExposed", Number(gamedatas.isAllInfoExposed) === 1);
        if (!playArea.querySelector("tichu-game")) {
          var gameEl = document.createElement("tichu-game");
          playArea.appendChild(gameEl);
        }
      }
      (_c = window.gameModel) === null || _c === void 0 ? void 0 : _c.hydrateFromGamedatas(gamedatas, this.player_id, this.isSpectator, this.bRealtime, this.readPrefs());
      this.enableAllPlayerPanels();
      var stName = ((_d = gamedatas.gamestate) === null || _d === void 0 ? void 0 : _d.name) || "";
      for (var _i = 0, _g = Object.values(gamedatas.players || {}); _i < _g.length; _i++) {
        var player = _g[_i];
        var pId = Number(player.id);
        var board = document.getElementById("player_board_".concat(pId));
        if (board) {
          board.querySelectorAll(".ha_board, tichu-player-panel").forEach(function(el) {
            var _a2;
            return (_a2 = el.parentNode) === null || _a2 === void 0 ? void 0 : _a2.removeChild(el);
          });
          var panel = document.createElement("tichu-player-panel");
          panel.playerId = String(pId);
          panel.setAttribute("player-id", String(pId));
          board.appendChild(panel);
        }
        if (Number((_f = (_e = gamedatas.handcount) === null || _e === void 0 ? void 0 : _e[pId]) !== null && _f !== void 0 ? _f : 0) === 0 && stName !== "newRound" && stName !== "endRound") {
          this.disablePlayerPanel(pId);
        }
      }
    };
    Tichu2.prototype.setup = function(gamedatas) {
      var _this = this;
      this.gamedatas = gamedatas;
      this.rehydrateModel();
      if (typeof ResizeObserver !== "undefined") {
        var ro = new ResizeObserver(function() {
          _this.rescale();
        });
        var wrap = document.getElementById("game_play_area_wrap") || document.getElementById("game_play_area");
        if (wrap)
          ro.observe(wrap);
      }
      document.addEventListener("visibilitychange", function() {
        var _a, _b, _c;
        if (document.visibilityState === "visible" && ((_b = (_a = _this.gamedatas) === null || _a === void 0 ? void 0 : _a.gamestate) === null || _b === void 0 ? void 0 : _b.name) === "showPassedCards" && _this.isCurrentPlayerActive()) {
          (_c = window.gameModel) === null || _c === void 0 ? void 0 : _c.setAcceptingCardsCountdown(true);
          clearTimeout(_this.autoAcceptTimeout);
          _this.autoAcceptTimeout = window.setTimeout(function() {
            return _this.onAcceptCards();
          }, 2e3);
        }
      });
      this.initPreferencesObserver();
      this.setupNotifications();
      initStudioTestHelper(this);
    };
    Tichu2.prototype.onEnteringState = function(stateName, stateObject) {
      var _a, _b;
      this.stateName = stateName;
      this.active_player = stateObject === null || stateObject === void 0 ? void 0 : stateObject.active_player;
      if (this.gamedatas && stateObject) {
        this.gamedatas.gamestate = stateObject;
      }
      var overall = document.getElementById("overall-content");
      if (overall && stateName) {
        overall.classList.add("gamestate_".concat(stateName));
      }
      if (stateName !== "confirmTrick") {
        clearTimeout(this.autoCollectTimeout);
      }
      if (stateName !== "showPassedCards") {
        clearTimeout(this.autoAcceptTimeout);
      }
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setGameState(stateName, {
        activePlayerId: (_b = stateObject === null || stateObject === void 0 ? void 0 : stateObject.active_player) !== null && _b !== void 0 ? _b : this.getActivePlayerId(),
        activePlayerIds: Array.isArray(stateObject === null || stateObject === void 0 ? void 0 : stateObject.multiactive) ? stateObject.multiactive : void 0,
        isCurrentPlayerActive: this.isCurrentPlayerActive()
      });
      var args = stateObject === null || stateObject === void 0 ? void 0 : stateObject.args;
      switch (stateName) {
        case "newRound":
          this.onEnteringStateNewRound(args);
          break;
        case "grandTichuBets":
          this.onEnteringStateGrandTichuBets(args);
          break;
        case "giveCards":
          this.onEnteringStateGiveCards(args);
          break;
        case "showPassedCards":
          this.onEnteringStateShowPassedCards(args);
          break;
        case "acceptPassedCards":
          this.onEnteringStateAcceptPassedCards(args);
          break;
        case "newTrick":
          this.onEnteringStateNewTrick(args);
          break;
        case "playComboOpen":
          this.onEnteringStatePlayComboOpen(args);
          break;
        case "playCombo":
          this.onEnteringStatePlayCombo(args);
          break;
        case "mahjongPlay":
          this.onEnteringStateMahjongPlay(args);
          break;
        case "phoenixPlay":
          this.onEnteringStatePhoenixPlay(args);
          break;
        case "playBomb":
          this.onEnteringStatePlayBomb(args);
          break;
        case "chooseDragonGift":
          this.onEnteringStateChooseDragonGift(args);
          break;
        case "confirmTrick":
          this.onEnteringStateConfirmTrick(args);
          break;
        case "endRound":
          this.onEnteringStateEndRound(args);
          break;
      }
    };
    Tichu2.prototype.onEnteringStateNewRound = function(_args) {
      var _a;
      this.enableAllPlayerPanels();
      if (this.gamedatas) {
        this.gamedatas.capturedCards = [];
        this.gamedatas.hand = [];
        this.gamedatas.currentTrick = [];
        this.gamedatas.currentTrickValue = 0;
        this.gamedatas.firstoutplayer = 0;
        this.gamedatas.round++;
        this.gamedatas.trick = 0;
        this.gamedatas.mahjongWish = 0;
        this.gamedatas.allLastCombos = {};
        this.gamedatas.passes = [];
        this.gamedatas.lastComboPlayer = "0";
        this.gamedatas.lastComboDescription = "";
        for (var id in this.gamedatas.players) {
          this.gamedatas.players[id].call_tichu = Bet.NO_BET_YET;
          this.gamedatas.players[id].call_grand_tichu = Bet.NO_BET_YET;
          this.gamedatas.players[id].pass = "0";
          if (this.gamedatas.capturedpoints) {
            this.gamedatas.capturedpoints[Number(id)] = 0;
          }
        }
      }
      this.allLastCombos = {};
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.enterNewRound();
    };
    Tichu2.prototype.onEnteringStateGrandTichuBets = function(_args) {
      var _a;
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.enterGrandTichuBets();
    };
    Tichu2.prototype.onEnteringStateGiveCards = function(_args) {
      var _a;
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.clearSelection();
    };
    Tichu2.prototype.onEnteringStateShowPassedCards = function(args) {
      this.showPassedCards(args);
    };
    Tichu2.prototype.onEnteringStateAcceptPassedCards = function(args) {
      this.showPassedCards(args);
    };
    Tichu2.prototype.showPassedCards = function(args) {
      var _a, _b, _c, _d, _e, _f;
      if ((_a = this.gamedatas) === null || _a === void 0 ? void 0 : _a.handcount) {
        for (var _i = 0, _g = Object.keys(this.gamedatas.players || {}); _i < _g.length; _i++) {
          var pId = _g[_i];
          this.gamedatas.handcount[Number(pId)] = 14;
        }
      }
      var rawReceived = (_b = args === null || args === void 0 ? void 0 : args._private) !== null && _b !== void 0 ? _b : (_e = (_d = (_c = this.gamedatas) === null || _c === void 0 ? void 0 : _c.gamestate) === null || _d === void 0 ? void 0 : _d.args) === null || _e === void 0 ? void 0 : _e._private;
      var received = Array.isArray(rawReceived) ? rawReceived : void 0;
      (_f = window.gameModel) === null || _f === void 0 ? void 0 : _f.enterShowPassedCards(received);
    };
    Tichu2.prototype.onEnteringStateNewTrick = function(_args) {
      var _a;
      if (this.gamedatas) {
        this.gamedatas.capturedCards = __spreadArray(__spreadArray([], this.gamedatas.capturedCards || [], true), this.gamedatas.currentTrick || [], true);
        this.gamedatas.currentTrick = [];
        this.gamedatas.currentTrickValue = 0;
        this.gamedatas.trick++;
        this.gamedatas.allLastCombos = {};
        this.gamedatas.passes = [];
        this.gamedatas.lastComboPlayer = "0";
        this.gamedatas.lastComboDescription = "";
        for (var _i = 0, _b = Object.values(this.gamedatas.players || {}); _i < _b.length; _i++) {
          var p = _b[_i];
          p.pass = "0";
        }
      }
      this.allLastCombos = {};
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.enterNewTrick();
    };
    Tichu2.prototype.onEnteringStatePlayComboOpen = function(_args) {
    };
    Tichu2.prototype.onEnteringStatePlayCombo = function(_args) {
    };
    Tichu2.prototype.onEnteringStateMahjongPlay = function(_args) {
      var _a;
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.enterMahjongPlay();
    };
    Tichu2.prototype.onEnteringStatePhoenixPlay = function(args) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
      var rawValues = (_m = (_h = (_c = (_b = (_a = args === null || args === void 0 ? void 0 : args._private) === null || _a === void 0 ? void 0 : _a.values) !== null && _b !== void 0 ? _b : args === null || args === void 0 ? void 0 : args.values) !== null && _c !== void 0 ? _c : (_g = (_f = (_e = (_d = this.gamedatas) === null || _d === void 0 ? void 0 : _d.gamestate) === null || _e === void 0 ? void 0 : _e.args) === null || _f === void 0 ? void 0 : _f._private) === null || _g === void 0 ? void 0 : _g.values) !== null && _h !== void 0 ? _h : (_l = (_k = (_j = this.gamedatas) === null || _j === void 0 ? void 0 : _j.gamestate) === null || _k === void 0 ? void 0 : _k.args) === null || _l === void 0 ? void 0 : _l.values) !== null && _m !== void 0 ? _m : [];
      var values = Array.isArray(rawValues) ? rawValues.map(Number) : [];
      (_o = window.gameModel) === null || _o === void 0 ? void 0 : _o.enterPhoenixPlay(values);
    };
    Tichu2.prototype.onEnteringStatePlayBomb = function(args) {
      var _a, _b, _c;
      var bombPlayerId = (_b = (_a = args === null || args === void 0 ? void 0 : args.active) !== null && _a !== void 0 ? _a : this.active_player) !== null && _b !== void 0 ? _b : this.getActivePlayerId();
      if (bombPlayerId) {
        (_c = window.gameModel) === null || _c === void 0 ? void 0 : _c.enterPlayBomb(bombPlayerId);
      }
    };
    Tichu2.prototype.onEnteringStateChooseDragonGift = function(args) {
      var _this = this;
      var _a, _b, _c, _d;
      var enemies = (_a = args === null || args === void 0 ? void 0 : args.enemies) !== null && _a !== void 0 ? _a : (_d = (_c = (_b = this.gamedatas) === null || _b === void 0 ? void 0 : _b.gamestate) === null || _c === void 0 ? void 0 : _c.args) === null || _d === void 0 ? void 0 : _d.enemies;
      if (!this.isCurrentPlayerActive() || !enemies)
        return;
      var left = this.clockwise ? 0 : 1;
      var right = this.clockwise ? 1 : 0;
      var leftLabel = typeof enemies[left] === "object" ? enemies[left].name : enemies[left];
      var rightLabel = typeof enemies[right] === "object" ? enemies[right].name : enemies[right];
      this.addActionButton("giveDragonBefore_button", _("Give cards to " + leftLabel), function() {
        return _this.onGiveDragon(left);
      });
      this.addActionButton("giveDragonAfter_button", _("Give cards to " + rightLabel), function() {
        return _this.onGiveDragon(right);
      });
    };
    Tichu2.prototype.onEnteringStateConfirmTrick = function(_args) {
    };
    Tichu2.prototype.onEnteringStateEndRound = function(_args) {
      var _a;
      this.enableAllPlayerPanels();
      if (this.gamedatas) {
        this.gamedatas.hand = [];
        this.gamedatas.allLastCombos = {};
        for (var _i = 0, _b = Object.keys(this.gamedatas.players || {}); _i < _b.length; _i++) {
          var pId = _b[_i];
          var idNum = Number(pId);
          if (this.gamedatas.handcount)
            this.gamedatas.handcount[idNum] = 0;
          if (this.gamedatas.capturedpoints)
            this.gamedatas.capturedpoints[idNum] = 0;
        }
      }
      this.allLastCombos = {};
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.enterEndRound();
    };
    Tichu2.prototype.onLeavingState = function(stateName) {
      var _a, _b;
      clearTimeout(this.autoAcceptTimeout);
      clearTimeout(this.autoCollectTimeout);
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setAcceptingCardsCountdown(false);
      (_b = window.gameModel) === null || _b === void 0 ? void 0 : _b.setCollectingTrickCountdown(false);
      var overall = document.getElementById("overall-content");
      if (overall && stateName) {
        overall.classList.remove("gamestate_".concat(stateName));
      }
    };
    Tichu2.prototype.onUpdateActionButtons = function(stateName, args) {
      var _this = this;
      var _a, _b, _c, _d, _e, _f, _g;
      this.stateName = stateName;
      (_a = document.getElementById("game_play_area")) === null || _a === void 0 ? void 0 : _a.classList.toggle("isCurrentPlayerActive", this.isCurrentPlayerActive());
      this.removeActionButtons();
      (_b = window.gameModel) === null || _b === void 0 ? void 0 : _b.setGameState(stateName, {
        activePlayerId: this.getActivePlayerId(),
        activePlayerIds: Array.isArray((_d = (_c = this.gamedatas) === null || _c === void 0 ? void 0 : _c.gamestate) === null || _d === void 0 ? void 0 : _d.multiactive) ? this.gamedatas.gamestate.multiactive : void 0,
        isCurrentPlayerActive: this.isCurrentPlayerActive()
      });
      if (this.isCurrentPlayerActive()) {
        switch (stateName) {
          case "giveCards":
            this.addActionButton("resetPassCards_button", _("Reset choices"), "onResetPassCards", void 0, false, "gray");
            this.addActionButton("passCards_button", _("Pass selected cards"), "onPassCards");
            break;
          case "showPassedCards":
            clearTimeout(this.autoAcceptTimeout);
            if (document.visibilityState === "visible") {
              (_e = window.gameModel) === null || _e === void 0 ? void 0 : _e.setAcceptingCardsCountdown(true);
              this.autoAcceptTimeout = window.setTimeout(function() {
                return _this.onAcceptCards();
              }, 2e3);
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
          case "chooseDragonGift":
            this.onEnteringStateChooseDragonGift(args);
            break;
          case "confirmTrick":
            clearTimeout(this.autoCollectTimeout);
            if (this.bRealtime) {
              (_f = window.gameModel) === null || _f === void 0 ? void 0 : _f.setCollectingTrickCountdown(true);
              this.autoCollectTimeout = window.setTimeout(function() {
                return _this.collect();
              }, 2e3);
            }
            break;
        }
      }
      if (!this.isSpectator && ((_g = this.gamedatas) === null || _g === void 0 ? void 0 : _g.players)) {
        var player = this.gamedatas.players[this.player_id];
        if (player && String(player.call_grand_tichu) === Bet.NO_BET_YET) {
          this.addActionButton("noBet", _("No bet"), function() {
            return _this.onGrandTichuBet(Bet.NO_BET);
          }, void 0, false, "gray");
          this.addTooltip("noBet", _("Don't call Grand Tichu"), "");
          this.addActionButton("makeGTBet", _("Grand Tichu"), function() {
            return _this.onGrandTichuBet(Bet.GRAND_TICHU);
          }, void 0, false, "red");
          this.addTooltip("makeGTBet", _("Bet 200 Points, tha you will finish first"), "");
        }
      }
    };
    Tichu2.prototype.onThemeChange = function(themeNumber) {
      var _a;
      localStorage.setItem("tichu_theme", String(themeNumber));
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setTheme(Number(themeNumber));
    };
    Tichu2.prototype.setTheme = function(themeNumber) {
      this.onThemeChange(themeNumber);
    };
    Tichu2.prototype.onOrderChange = function(order) {
      var _a;
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setHandSortOrder(order);
    };
    Tichu2.prototype.onReorderByRank = function(evt) {
      var _a, _b;
      if (evt) {
        (_a = evt.preventDefault) === null || _a === void 0 ? void 0 : _a.call(evt);
        (_b = evt.stopPropagation) === null || _b === void 0 ? void 0 : _b.call(evt);
      }
      this.onOrderChange("rank");
    };
    Tichu2.prototype.onReorderByColor = function(evt) {
      var _a, _b;
      if (evt) {
        (_a = evt.preventDefault) === null || _a === void 0 ? void 0 : _a.call(evt);
        (_b = evt.stopPropagation) === null || _b === void 0 ? void 0 : _b.call(evt);
      }
      this.onOrderChange("color");
    };
    Tichu2.prototype.onLayoutChange = function(square) {
      var _a;
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setSquareTable(Boolean(square));
    };
    Tichu2.prototype.onReorderTable = function(square) {
      this.onLayoutChange(square);
    };
    Tichu2.prototype.onDirectionChange = function(clockwise) {
      var _a;
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setClockwise(Boolean(clockwise));
    };
    Tichu2.prototype.changeOrder = function(clockwise) {
      this.onDirectionChange(clockwise);
    };
    Tichu2.prototype.toggleExperimentalReplay = function(enable) {
      var _this = this;
      var _a, _b;
      this.experimentalArchiveModeEnabled = enable !== null && enable !== void 0 ? enable : !this.experimentalArchiveModeEnabled;
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setExperimentalReplayOpen(false);
      var overall = document.getElementById("overall-content");
      if (overall) {
        overall.classList.toggle("experimentalArchiveMode", this.experimentalArchiveModeEnabled);
      }
      if (this.experimentalArchiveModeEnabled && !document.getElementById("game_play_replay")) {
        var replay = document.createElement("tichu-replay");
        replay.setAttribute("id", "game_play_replay");
        replay.addEventListener("exit", function() {
          return _this.toggleExperimentalReplay(false);
        });
        var wrap = document.getElementById("game_play_area_wrap") || ((_b = document.getElementById("game_play_area")) === null || _b === void 0 ? void 0 : _b.parentElement);
        wrap === null || wrap === void 0 ? void 0 : wrap.appendChild(replay);
      }
      this.rescale();
    };
    Tichu2.prototype.rescale = function() {
      var areaElement = document.getElementById("game_play_area");
      var replayElement = document.getElementById("game_play_replay");
      var gameElement = this.experimentalArchiveModeEnabled ? replayElement : areaElement;
      var areaWrapElement = document.getElementById("game_play_area_wrap");
      if (!areaWrapElement || !gameElement)
        return;
      var widthAvailable = areaWrapElement.clientWidth;
      var heightAvailable = document.documentElement.clientHeight - 120;
      var widthMax = 1200;
      var widthMin = this.experimentalArchiveModeEnabled ? 1e3 : 900;
      var heightMin = this.experimentalArchiveModeEnabled ? 600 : 800;
      var widthFactor = Math.max(widthAvailable / widthMin, 0.4);
      var heightFactor = Math.max(heightAvailable / heightMin, 0.7);
      var factor = Math.min(widthFactor, heightFactor, 1);
      areaWrapElement.style.transform = "scale(".concat(factor, ")");
      areaWrapElement.style.transformOrigin = factor === 1 ? "top center" : "top left";
      gameElement.style.width = "".concat(Math.max(Math.min(widthAvailable / factor, widthMax), widthMin), "px");
    };
    Tichu2.prototype.onGiveCard = function(index) {
      var _a, _b, _c;
      if (((_b = (_a = this.gamedatas) === null || _a === void 0 ? void 0 : _a.gamestate) === null || _b === void 0 ? void 0 : _b.name) !== "giveCards" || !this.isCurrentPlayerActive())
        return;
      (_c = window.gameModel) === null || _c === void 0 ? void 0 : _c.toggleGiveCardSlot(index);
    };
    Tichu2.prototype.onResetPassCards = function() {
      var _a;
      if (!this.checkAction("giveCards", true))
        return;
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.resetPassCards();
    };
    Tichu2.prototype.onPassCards = function() {
      var _a, _b;
      if (!this.checkAction("giveCards", false))
        return;
      var givenIds = (_b = (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.getCardsToGiveIds()) !== null && _b !== void 0 ? _b : null;
      if (!givenIds || givenIds.length !== 3) {
        this.showMessage(_("You must select exactly 3 cards"), "error");
        return;
      }
      var toGive = givenIds.join(";") + ";";
      this.takeAction("giveTheCards", { cards: toGive });
    };
    Tichu2.prototype.onAcceptCards = function() {
      var _a;
      clearTimeout(this.autoAcceptTimeout);
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setAcceptingCardsCountdown(false);
      if (!this.checkAction("acceptCards"))
        return;
      this.takeAction("acceptCards", {});
    };
    Tichu2.prototype.onGrandTichuBet = function(bet) {
      this.takeAction("grandTichuBet", { bet: bet });
    };
    Tichu2.prototype.onTichuBet = function(evt) {
      var _a, _b;
      if (evt) {
        (_a = evt.preventDefault) === null || _a === void 0 ? void 0 : _a.call(evt);
        (_b = evt.stopPropagation) === null || _b === void 0 ? void 0 : _b.call(evt);
      }
      this.takeAction("tichuBet", { bet: Bet.TICHU });
    };
    Tichu2.prototype.onPlayBomb = function(evt) {
      var _a, _b;
      if (evt) {
        (_a = evt.preventDefault) === null || _a === void 0 ? void 0 : _a.call(evt);
        (_b = evt.stopPropagation) === null || _b === void 0 ? void 0 : _b.call(evt);
      }
      this.playCombo("playBomb");
    };
    Tichu2.prototype.onCancelBomb = function(evt) {
      var _a, _b;
      if (evt) {
        (_a = evt.preventDefault) === null || _a === void 0 ? void 0 : _a.call(evt);
        (_b = evt.stopPropagation) === null || _b === void 0 ? void 0 : _b.call(evt);
      }
      this.takeAction("cancel");
    };
    Tichu2.prototype.onPlayCombo = function(evt) {
      var _a, _b;
      if (evt) {
        (_a = evt.preventDefault) === null || _a === void 0 ? void 0 : _a.call(evt);
        (_b = evt.stopPropagation) === null || _b === void 0 ? void 0 : _b.call(evt);
      }
      if (!this.checkAction("playCombo"))
        return;
      this.playCombo("playCombo");
    };
    Tichu2.prototype.playCombo = function(actionName) {
      var items = this.playerHand.getSelectedItems();
      this.playerHand.unselectAll();
      var cardIds = items.map(function(item) {
        return item.id;
      }).join(";");
      if (items.length === 0 && actionName === "playCombo") {
        this.showMessage(_("You have to select some cards first"), "error");
        return;
      }
      clearTimeout(this.autoCollectTimeout);
      this.takeAction(actionName, { cards: cardIds });
    };
    Tichu2.prototype.onPass = function(onlyOnce) {
      var selected = this.playerHand.getSelectedItems();
      if (selected.length > 0 && this.getGameUserPreference(102) == 1) {
        this.showMessage(_("You have to unselect your cards first. (You can disable this safeguard in the user settings)"), "error");
        return;
      }
      this.playerHand.unselectAll();
      this.takeAction("pass", { onlyOnce: onlyOnce });
    };
    Tichu2.prototype.cancelAutopass = function(evt) {
      var _a, _b;
      if (evt) {
        (_a = evt.preventDefault) === null || _a === void 0 ? void 0 : _a.call(evt);
        (_b = evt.stopPropagation) === null || _b === void 0 ? void 0 : _b.call(evt);
      }
      this.takeAction("cancelAutopass");
    };
    Tichu2.prototype.onChoosePhoenix = function(evt) {
      var _this = this;
      var _a, _b, _c, _d, _e, _f;
      if (evt) {
        (_a = evt.preventDefault) === null || _a === void 0 ? void 0 : _a.call(evt);
        (_b = evt.stopPropagation) === null || _b === void 0 ? void 0 : _b.call(evt);
      }
      var val = (_d = (_c = window.gameModel) === null || _c === void 0 ? void 0 : _c.getState().selectedPhoenixValue) !== null && _d !== void 0 ? _d : null;
      if (val === null) {
        this.showMessage(_("You need to choose ONE value for the Phoenix"), "error");
        return;
      }
      var phoenixValue = Number(val);
      if (((_f = (_e = window.gameModel) === null || _e === void 0 ? void 0 : _e.getState().hand.length) !== null && _f !== void 0 ? _f : 0) === 1 && phoenixValue === 14) {
        this.confirmationDialog(_("Do you really want to choose Ace for the Phoenix in this bomb? It looks like your only remaining card can not be played on this bomb."), function() {
          return _this.choosePhoenix(phoenixValue);
        });
        return;
      }
      this.choosePhoenix(phoenixValue);
    };
    Tichu2.prototype.choosePhoenix = function(phoenixValue) {
      var _a;
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setSelectedPhoenixValue(null);
      this.takeAction("choosePhoenix", { phoenixValue: phoenixValue });
    };
    Tichu2.prototype.cancelPhoenix = function() {
      var _a;
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setSelectedPhoenixValue(null);
      this.takeAction("cancelPhoenix");
    };
    Tichu2.prototype.onMakeAWish = function(evt) {
      var _a, _b, _c, _d, _e;
      if (evt) {
        (_a = evt.preventDefault) === null || _a === void 0 ? void 0 : _a.call(evt);
        (_b = evt.stopPropagation) === null || _b === void 0 ? void 0 : _b.call(evt);
      }
      var wish = (_d = (_c = window.gameModel) === null || _c === void 0 ? void 0 : _c.getState().selectedMahjongWish) !== null && _d !== void 0 ? _d : null;
      if (wish === null) {
        this.showMessage(_("You need to choose ONE value to wish"), "error");
        return;
      }
      (_e = window.gameModel) === null || _e === void 0 ? void 0 : _e.setSelectedMahjongWish(null);
      this.takeAction("makeAWish", { wish: wish });
    };
    Tichu2.prototype.onGiveDragon = function(player) {
      if (!this.checkAction("chooseDragonGift"))
        return;
      this.takeAction("chooseDragonGift", { player: player });
    };
    Tichu2.prototype.onChooseDragonGift = function(player) {
      this.onGiveDragon(player);
    };
    Tichu2.prototype.collect = function() {
      var _a;
      clearTimeout(this.autoCollectTimeout);
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setCollectingTrickCountdown(false);
      if (!this.checkAction("collect"))
        return;
      this.takeAction("collect");
    };
    Tichu2.prototype.takeAction = function(action, args) {
      if (args === void 0) {
        args = {};
      }
      args.lock = true;
      this.ajaxcall("/tichu/tichu/" + action + ".html", args, this, function() {
      });
    };
    Tichu2.prototype.setupNotifications = function() {
      var notifs = {
        dealCards: 500,
        grandTichuBet: void 0,
        tichuBet: void 0,
        confirmTichu: 1,
        playCombo: 300,
        wishMade: 200,
        mahjongWishGranted: 1,
        playerGoOut: 1,
        pass: 300,
        captureCards: 500,
        newScores: 1e3,
        autopass: 1,
        acceptCards: 3e3,
        passCards: 200,
        devConsole: 1
      };
      for (var _i = 0, _a = Object.entries(notifs); _i < _a.length; _i++) {
        var _b = _a[_i], type = _b[0], duration = _b[1];
        dojo.subscribe(type, this, "notif_" + type);
        this.notifqueue.setSynchronous(type, duration);
      }
    };
    Tichu2.prototype.notif_devConsole = function(notif) {
      window.console.log("DEV NOTIF: ".concat(notif.args.msg));
    };
    Tichu2.prototype.notif_dealCards = function(notif) {
      var _a;
      var cards = notif.args.cards || [];
      var totalCards = cards.length === 8 ? 8 : 14;
      if (this.gamedatas) {
        if (totalCards === 8) {
          this.gamedatas.hand = __spreadArray([], cards, true);
        } else {
          var existingIds = new Set((this.gamedatas.hand || []).map(function(c) {
            return String(c.id);
          }));
          for (var _i = 0, cards_1 = cards; _i < cards_1.length; _i++) {
            var card = cards_1[_i];
            if (!existingIds.has(String(card.id))) {
              this.gamedatas.hand.push(card);
            }
          }
        }
        if (!this.gamedatas.handcount)
          this.gamedatas.handcount = {};
        for (var _b = 0, _c = Object.keys(this.gamedatas.players || {}); _b < _c.length; _b++) {
          var pId = _c[_b];
          this.gamedatas.handcount[Number(pId)] = totalCards;
        }
      }
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.dealCards(cards);
    };
    Tichu2.prototype.notif_passCards = function(notif) {
      var _a, _b, _c;
      var ids = (_a = notif.args.cardIds) !== null && _a !== void 0 ? _a : notif.args;
      if (!Array.isArray(ids))
        return;
      if ((_b = this.gamedatas) === null || _b === void 0 ? void 0 : _b.hand) {
        var idSet_1 = new Set(ids.map(String));
        this.gamedatas.hand = this.gamedatas.hand.filter(function(c) {
          return !idSet_1.has(String(c.id));
        });
      }
      (_c = window.gameModel) === null || _c === void 0 ? void 0 : _c.applyPassCardsNotif(ids);
    };
    Tichu2.prototype.notif_acceptCards = function(notif) {
      var _this = this;
      var _a;
      clearTimeout(this.autoAcceptTimeout);
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setAcceptingCardsCountdown(false);
      var cards = notif.args.cards || [];
      var acceptFn = function() {
        var _a2;
        if (_this.gamedatas) {
          if (!_this.gamedatas.hand)
            _this.gamedatas.hand = [];
          var existingIds = new Set(_this.gamedatas.hand.map(function(c) {
            return String(c.id);
          }));
          for (var _i = 0, cards_2 = cards; _i < cards_2.length; _i++) {
            var card = cards_2[_i];
            if (!existingIds.has(String(card.id))) {
              _this.gamedatas.hand.push(card);
            }
          }
        }
        (_a2 = window.gameModel) === null || _a2 === void 0 ? void 0 : _a2.finishAcceptCards(cards);
      };
      if (this.instantaneousMode) {
        acceptFn();
      } else {
        setTimeout(function() {
          var _a2;
          return (_a2 = window.gameModel) === null || _a2 === void 0 ? void 0 : _a2.startAcceptCardsAnimation();
        }, 1500);
        setTimeout(acceptFn, 2e3);
      }
    };
    Tichu2.prototype.notif_playCombo = function(notif) {
      var _a, _b;
      var playerId = Number(notif.args.player_id);
      var cards = notif.args.cards || [];
      var comboName = notif.args.combo_name || "";
      var points = Number(notif.args.points || 0);
      if (this.gamedatas) {
        this.gamedatas.currentTrick = __spreadArray(__spreadArray([], this.gamedatas.currentTrick || [], true), cards, true);
        this.gamedatas.currentTrickValue = Number(this.gamedatas.currentTrickValue || 0) + points;
        if (!this.gamedatas.handcount)
          this.gamedatas.handcount = {};
        var prevCount = Number((_a = this.gamedatas.handcount[playerId]) !== null && _a !== void 0 ? _a : 0);
        var nextCount = Math.max(0, prevCount - cards.length);
        this.gamedatas.handcount[playerId] = nextCount;
        if (playerId === Number(this.player_id) && Array.isArray(this.gamedatas.hand)) {
          var playedIds_1 = new Set(cards.map(function(c) {
            return String(c.id);
          }));
          this.gamedatas.hand = this.gamedatas.hand.filter(function(c) {
            return !playedIds_1.has(String(c.id));
          });
        }
        this.allLastCombos[playerId] = {
          cards: cards,
          description: comboName,
          type: 0,
          phoenixValue: null
        };
        this.gamedatas.allLastCombos = this.allLastCombos;
        this.gamedatas.lastComboPlayer = String(playerId);
        this.gamedatas.lastComboDescription = comboName;
      }
      (_b = window.gameModel) === null || _b === void 0 ? void 0 : _b.applyPlayCombo(playerId, cards, comboName, points);
    };
    Tichu2.prototype.notif_pass = function(notif) {
      var _a;
      var playerId = Number(notif.args.player_id);
      if (this.allLastCombos) {
        delete this.allLastCombos[playerId];
      }
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.applyPass(playerId);
    };
    Tichu2.prototype.notif_captureCards = function(notif) {
      var _a, _b;
      var playerId = Number(notif.args.player_id);
      var trickValue = Number(notif.args.trick_value || 0);
      if (this.gamedatas) {
        if (!this.gamedatas.capturedpoints)
          this.gamedatas.capturedpoints = {};
        var prevPts = Number((_a = this.gamedatas.capturedpoints[playerId]) !== null && _a !== void 0 ? _a : 0);
        this.gamedatas.capturedpoints[playerId] = prevPts + trickValue;
      }
      (_b = window.gameModel) === null || _b === void 0 ? void 0 : _b.applyCaptureCards(playerId, trickValue);
    };
    Tichu2.prototype.notif_grandTichuBet = function(notif) {
      var _a, _b, _c, _d;
      var playerId = Number(notif.args.player_id);
      var bet = String(notif.args.bet);
      if ((_b = (_a = this.gamedatas) === null || _a === void 0 ? void 0 : _a.players) === null || _b === void 0 ? void 0 : _b[playerId]) {
        this.gamedatas.players[playerId].call_grand_tichu = bet;
        if (bet === Bet.GRAND_TICHU) {
          this.gamedatas.players[playerId].call_tichu = Bet.NO_BET;
        }
      }
      (_c = window.gameModel) === null || _c === void 0 ? void 0 : _c.applyGrandTichuBet(playerId, bet);
      if (bet === Bet.GRAND_TICHU) {
        (_d = window.gameModel) === null || _d === void 0 ? void 0 : _d.triggerBetAnimation(playerId, 200);
        playSound("tichu_laser");
        this.notifqueue.setSynchronousDuration(1e3);
      } else {
        this.notifqueue.setSynchronousDuration(1);
      }
      this.onUpdateActionButtons(this.stateName, {});
    };
    Tichu2.prototype.notif_tichuBet = function(notif) {
      var _a, _b, _c, _d;
      var playerId = Number(notif.args.player_id);
      var bet = String(notif.args.bet);
      if ((_b = (_a = this.gamedatas) === null || _a === void 0 ? void 0 : _a.players) === null || _b === void 0 ? void 0 : _b[playerId]) {
        this.gamedatas.players[playerId].call_tichu = bet;
        this.gamedatas.players[playerId].call_grand_tichu = Bet.NO_BET;
      }
      (_c = window.gameModel) === null || _c === void 0 ? void 0 : _c.applyTichuBet(playerId, bet);
      if (bet === Bet.TICHU) {
        (_d = window.gameModel) === null || _d === void 0 ? void 0 : _d.triggerBetAnimation(playerId, 100);
        playSound("tichu_laser");
        this.notifqueue.setSynchronousDuration(1e3);
      } else {
        this.notifqueue.setSynchronousDuration(1);
      }
      this.onUpdateActionButtons(this.stateName, {});
    };
    Tichu2.prototype.notif_confirmTichu = function(notif) {
      var _this = this;
      var titleSave = this.gamedatas.gamestate.descriptionmyturn;
      var s = notif.args.grand ? "grand " : "";
      this.gamedatas.gamestate.descriptionmyturn = notif.args.msg;
      this.updatePageTitle();
      this.removeActionButtons();
      this.addActionButton("cancelTichu", _("no " + s + "tichu"), function() {
        if (notif.args.grand) {
          _this.onGrandTichuBet(Bet.NO_BET);
          return;
        }
        _this.gamedatas.gamestate.descriptionmyturn = titleSave;
        _this.updatePageTitle();
        _this.onUpdateActionButtons(_this.stateName, {});
      });
      this.addActionButton("confirmTichu", _("confirm"), function() {
        return _this.takeAction("confirmTichu", { bet: notif.args.grand ? Bet.GRAND_TICHU : Bet.TICHU });
      });
    };
    Tichu2.prototype.notif_mahjongWishGranted = function(_notif) {
      var _a;
      if (this.gamedatas) {
        this.gamedatas.mahjongWish = 0;
      }
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setMahjongWish(0);
    };
    Tichu2.prototype.notif_wishMade = function(notif) {
      var _a;
      var wish = Number(notif.args.wish);
      if (this.gamedatas) {
        this.gamedatas.mahjongWish = wish > 0 && wish < 15 ? wish : 0;
      }
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.setMahjongWish(wish);
    };
    Tichu2.prototype.notif_playerGoOut = function(notif) {
      var _a;
      var playerId = Number(notif.args.player_id);
      var firstOutId = Number(notif.args.firstout_id);
      if (playerId === firstOutId && this.gamedatas) {
        this.gamedatas.firstoutplayer = playerId;
      }
      this.disablePlayerPanel(playerId);
      (_a = window.gameModel) === null || _a === void 0 ? void 0 : _a.applyPlayerGoOut(playerId, firstOutId);
    };
    Tichu2.prototype.notif_newScores = function(notif) {
      var _a, _b, _c, _d;
      var newScores = notif.args.newScores || {};
      for (var player_id in newScores) {
        var pId = Number(player_id);
        (_a = this.scoreCtrl[pId]) === null || _a === void 0 ? void 0 : _a.toValue(newScores[pId]);
        if ((_c = (_b = this.gamedatas) === null || _b === void 0 ? void 0 : _b.players) === null || _c === void 0 ? void 0 : _c[pId]) {
          this.gamedatas.players[pId].score = String(newScores[pId]);
        }
      }
      (_d = window.gameModel) === null || _d === void 0 ? void 0 : _d.applyNewScores(newScores);
    };
    Tichu2.prototype.notif_autopass = function(notif) {
      var _a, _b, _c;
      if (!this.isSpectator && ((_b = (_a = this.gamedatas) === null || _a === void 0 ? void 0 : _a.players) === null || _b === void 0 ? void 0 : _b[this.player_id])) {
        this.gamedatas.players[this.player_id].pass = notif.args.autopass;
      }
      (_c = window.gameModel) === null || _c === void 0 ? void 0 : _c.setAutopass(notif.args.autopass);
      this.onUpdateActionButtons(this.stateName, {});
    };
    return Tichu2;
  })();
  define(["dojo", "dojo/_base/declare", "ebg/core/gamegui", "ebg/counter"], function(dojo2, declare) {
    return declare("bgagame.tichu", ebg.core.gamegui, new Tichu());
  });
})();
"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __decorateClass = (decorators, target, key, kind) => {
    var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
    for (var i6 = decorators.length - 1, decorator; i6 >= 0; i6--)
      if (decorator = decorators[i6])
        result = (kind ? decorator(target, key, result) : decorator(result)) || result;
    if (kind && result) __defProp(target, key, result);
    return result;
  };

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
    var _3 = { label: 0, sent: function() {
      if (t12[0] & 1) throw t12[1];
      return t12[1];
    }, trys: [], ops: [] }, f3, y3, t12, g2;
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
      while (g2 && (g2 = 0, op[0] && (_3 = 0)), _3) try {
        if (f3 = 1, y3 && (t12 = op[0] & 2 ? y3["return"] : op[0] ? y3["throw"] || ((t12 = y3["return"]) && t12.call(y3), 0) : y3.next) && !(t12 = t12.call(y3, op[1])).done) return t12;
        if (y3 = 0, t12) op = [op[0] & 2, t12.value];
        switch (op[0]) {
          case 0:
          case 1:
            t12 = op;
            break;
          case 4:
            _3.label++;
            return { value: op[1], done: false };
          case 5:
            _3.label++;
            y3 = op[1];
            op = [0];
            continue;
          case 7:
            op = _3.ops.pop();
            _3.trys.pop();
            continue;
          default:
            if (!(t12 = _3.trys, t12 = t12.length > 0 && t12[t12.length - 1]) && (op[0] === 6 || op[0] === 2)) {
              _3 = 0;
              continue;
            }
            if (op[0] === 3 && (!t12 || op[1] > t12[0] && op[1] < t12[3])) {
              _3.label = op[1];
              break;
            }
            if (op[0] === 6 && _3.label < t12[1]) {
              _3.label = t12[1];
              t12 = op;
              break;
            }
            if (t12 && _3.label < t12[2]) {
              _3.label = t12[2];
              _3.ops.push(op);
              break;
            }
            if (t12[2]) _3.ops.pop();
            _3.trys.pop();
            continue;
        }
        op = body.call(thisArg, _3);
      } catch (e7) {
        op = [6, e7];
        y3 = 0;
      } finally {
        f3 = t12 = 0;
      }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  }
  function __values(o6) {
    var s4 = typeof Symbol === "function" && Symbol.iterator, m2 = s4 && o6[s4], i6 = 0;
    if (m2) return m2.call(o6);
    if (o6 && typeof o6.length === "number") return {
      next: function() {
        if (o6 && i6 >= o6.length) o6 = void 0;
        return { value: o6 && o6[i6++], done: !o6 };
      }
    };
    throw new TypeError(s4 ? "Object is not iterable." : "Symbol.iterator is not defined.");
  }
  function __read(o6, n5) {
    var m2 = typeof Symbol === "function" && o6[Symbol.iterator];
    if (!m2) return o6;
    var i6 = m2.call(o6), r6, ar = [], e7;
    try {
      while ((n5 === void 0 || n5-- > 0) && !(r6 = i6.next()).done) ar.push(r6.value);
    } catch (error) {
      e7 = { error };
    } finally {
      try {
        if (r6 && !r6.done && (m2 = i6["return"])) m2.call(i6);
      } finally {
        if (e7) throw e7.error;
      }
    }
    return ar;
  }
  function __spreadArray(to, from, pack) {
    if (pack || arguments.length === 2) for (var i6 = 0, l3 = from.length, ar; i6 < l3; i6++) {
      if (ar || !(i6 in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i6);
        ar[i6] = from[i6];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  }
  function __await(v2) {
    return this instanceof __await ? (this.v = v2, this) : new __await(v2);
  }
  function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g2 = generator.apply(thisArg, _arguments || []), i6, q = [];
    return i6 = {}, verb("next"), verb("throw"), verb("return"), i6[Symbol.asyncIterator] = function() {
      return this;
    }, i6;
    function verb(n5) {
      if (g2[n5]) i6[n5] = function(v2) {
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
    function step(r6) {
      r6.value instanceof __await ? Promise.resolve(r6.value.v).then(fulfill, reject) : settle(q[0][2], r6);
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
  function __asyncValues(o6) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m2 = o6[Symbol.asyncIterator], i6;
    return m2 ? m2.call(o6) : (o6 = typeof __values === "function" ? __values(o6) : o6[Symbol.iterator](), i6 = {}, verb("next"), verb("throw"), verb("return"), i6[Symbol.asyncIterator] = function() {
      return this;
    }, i6);
    function verb(n5) {
      i6[n5] = o6[n5] && function(v2) {
        return new Promise(function(resolve, reject) {
          v2 = o6[n5](v2), settle(resolve, reject, v2.done, v2.value);
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
      this.message = errors ? errors.length + " errors occurred during unsubscription:\n" + errors.map(function(err, i6) {
        return i6 + 1 + ") " + err.toString();
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
  var Subscription = (function() {
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
    Subscription2.EMPTY = (function() {
      var empty = new Subscription2();
      empty.closed = true;
      return empty;
    })();
    return Subscription2;
  })();
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
  var COMPLETE_NOTIFICATION = (function() {
    return createNotification("C", void 0, void 0);
  })();
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
  var Subscriber = (function(_super) {
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
  })(Subscription);
  var _bind = Function.prototype.bind;
  function bind(fn, thisArg) {
    return _bind.call(fn, thisArg);
  }
  var ConsumerObserver = (function() {
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
  })();
  var SafeSubscriber = (function(_super) {
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
  })(Subscriber);
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
  var observable = (function() {
    return typeof Symbol === "function" && Symbol.observable || "@@observable";
  })();

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
  var Observable = (function() {
    function Observable3(subscribe2) {
      if (subscribe2) {
        this._subscribe = subscribe2;
      }
    }
    Observable3.prototype.lift = function(operator) {
      var observable2 = new Observable3();
      observable2.source = this;
      observable2.operator = operator;
      return observable2;
    };
    Observable3.prototype.subscribe = function(observerOrNext, error, complete) {
      var _this = this;
      var subscriber = isSubscriber(observerOrNext) ? observerOrNext : new SafeSubscriber(observerOrNext, error, complete);
      errorContext(function() {
        var _a = _this, operator = _a.operator, source = _a.source;
        subscriber.add(operator ? operator.call(subscriber, source) : source ? _this._subscribe(subscriber) : _this._trySubscribe(subscriber));
      });
      return subscriber;
    };
    Observable3.prototype._trySubscribe = function(sink) {
      try {
        return this._subscribe(sink);
      } catch (err) {
        sink.error(err);
      }
    };
    Observable3.prototype.forEach = function(next, promiseCtor) {
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
    Observable3.prototype._subscribe = function(subscriber) {
      var _a;
      return (_a = this.source) === null || _a === void 0 ? void 0 : _a.subscribe(subscriber);
    };
    Observable3.prototype[observable] = function() {
      return this;
    };
    Observable3.prototype.pipe = function() {
      var operations = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        operations[_i] = arguments[_i];
      }
      return pipeFromArray(operations)(this);
    };
    Observable3.prototype.toPromise = function(promiseCtor) {
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
    Observable3.create = function(subscribe2) {
      return new Observable3(subscribe2);
    };
    return Observable3;
  })();
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
  var OperatorSubscriber = (function(_super) {
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
  })(Subscriber);

  // node_modules/rxjs/dist/esm5/internal/util/ObjectUnsubscribedError.js
  var ObjectUnsubscribedError = createErrorClass(function(_super) {
    return function ObjectUnsubscribedErrorImpl() {
      _super(this);
      this.name = "ObjectUnsubscribedError";
      this.message = "object unsubscribed";
    };
  });

  // node_modules/rxjs/dist/esm5/internal/Subject.js
  var Subject = (function(_super) {
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
  })(Observable);
  var AnonymousSubject = (function(_super) {
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
  })(Subject);

  // node_modules/rxjs/dist/esm5/internal/BehaviorSubject.js
  var BehaviorSubject = (function(_super) {
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
  })(Subject);

  // node_modules/rxjs/dist/esm5/internal/scheduler/dateTimestampProvider.js
  var dateTimestampProvider = {
    now: function() {
      return (dateTimestampProvider.delegate || Date).now();
    },
    delegate: void 0
  };

  // node_modules/rxjs/dist/esm5/internal/ReplaySubject.js
  var ReplaySubject = (function(_super) {
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
      for (var i6 = 0; i6 < copy.length && !subscriber.closed; i6 += _infiniteTimeWindow ? 1 : 2) {
        subscriber.next(copy[i6]);
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
        for (var i6 = 1; i6 < _buffer.length && _buffer[i6] <= now; i6 += 2) {
          last = i6;
        }
        last && _buffer.splice(0, last + 1);
      }
    };
    return ReplaySubject2;
  })(Subject);

  // node_modules/rxjs/dist/esm5/internal/util/isArrayLike.js
  var isArrayLike = (function(x2) {
    return x2 && typeof x2.length === "number" && typeof x2 !== "function";
  });

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
      for (var i6 = 0; i6 < array.length && !subscriber.closed; i6++) {
        subscriber.next(array[i6]);
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
    for (let color = 1; color <= 4; color++) {
      let values = cards.filter((c4) => Number(c4.type) === color && Number(c4.type_arg) > 1).map((c4) => Number(c4.type_arg)).sort((a3, b3) => a3 - b3);
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
    for (let value = 2; value <= 14; value++) {
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
      players = players.sort((p1, p22) => {
        const p1No = Number(p1.no) ?? 0;
        const p2No = Number(p22.no) ?? 0;
        return p1No - p2No;
      });
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
      const i6 = passedCards.findIndex((passedCard) => passedCard.card.id === card.id);
      const updatedPassedCard = { ...passedCards[i6], accepted: true };
      passedCards[i6] = updatedPassedCard;
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

  // src/elements/game-model.ts
  var initialLiveGameState = {
    currentPlayerId: "",
    isSpectator: false,
    isRealtime: false,
    isAllInfoExposed: false,
    players: {},
    playerOrderBottomToLeft: [],
    passSlots: [],
    acceptingCardsCountdown: false,
    collectingTrickCountdown: false,
    hand: [],
    selectedCardIds: [],
    handSortOrder: "rank",
    stateName: "",
    activePlayerId: "",
    activePlayerIds: [],
    isCurrentPlayerActive: false,
    bombActivePlayerId: null,
    round: 0,
    trick: 0,
    currentTrick: [],
    currentTrickValue: 0,
    capturedCards: [],
    firstOutPlayerId: "",
    lastComboPlayerId: "",
    lastCombos: {},
    mahjongWish: 0,
    selectedMahjongWish: null,
    phoenixAllowedValues: [],
    selectedPhoenixValue: null,
    clockwise: true,
    squareTable: false,
    theme: 0,
    isTiki: false,
    experimentalReplayOpen: false,
    trickModalOpen: false,
    betAnimations: []
  };
  function normalizeCard(raw) {
    const card = {
      id: String(raw?.id ?? ""),
      type: String(raw?.type ?? ""),
      type_arg: String(raw?.type_arg ?? "")
    };
    if (raw?.location !== void 0) card.location = String(raw.location);
    if (raw?.location_arg !== void 0) card.location_arg = String(raw.location_arg);
    const passedFrom = raw?.passed_from ?? raw?.card_passed_from;
    if (passedFrom !== void 0) card.passed_from = String(passedFrom);
    return card;
  }
  function normalizeCards(rawCards) {
    if (!Array.isArray(rawCards)) return [];
    return rawCards.map(normalizeCard);
  }
  function normalizeGrandTichuBet(val) {
    if (val === null || val === void 0 || val === "") return -1;
    const n5 = Number(val);
    if (n5 === 0 || n5 === 100 || n5 === 200) return n5;
    return -1;
  }
  function normalizeTichuBet(val) {
    if (val === null || val === void 0 || val === "") return -1;
    const n5 = Number(val);
    if (n5 === 0 || n5 === 100) return n5;
    return -1;
  }
  function getNextPlayersDesc(playersMap, currentPlayerId) {
    const players = Object.values(playersMap).sort((a3, b3) => b3.no - a3.no);
    if (players.length < 4) return players;
    const lastId = players[3].id;
    while (players[3].id !== currentPlayerId && players[0].id !== lastId) {
      players.push(players.shift());
    }
    return players;
  }
  var GameModel = class {
    constructor() {
      this.subject$ = new BehaviorSubject(initialLiveGameState);
      this.nextBetAnimId = 1;
      this.state$ = this.subject$.asObservable();
      // Selectors for every slice of state
      this.currentPlayerId$ = select(this.state$, (s4) => s4.currentPlayerId);
      this.isSpectator$ = select(this.state$, (s4) => s4.isSpectator);
      this.isRealtime$ = select(this.state$, (s4) => s4.isRealtime);
      this.isAllInfoExposed$ = select(this.state$, (s4) => s4.isAllInfoExposed);
      this.players$ = select(this.state$, (s4) => s4.players);
      this.currentPlayer$ = select(this.state$, (s4) => s4.players[s4.currentPlayerId] ?? null);
      this.player$ = (playerId) => select(this.state$, (s4) => s4.players[String(playerId)]);
      this.playerOrderBottomToLeft$ = select(this.state$, (s4) => s4.playerOrderBottomToLeft);
      this.passSlots$ = select(this.state$, (s4) => s4.passSlots);
      this.acceptingCardsCountdown$ = select(this.state$, (s4) => s4.acceptingCardsCountdown);
      this.collectingTrickCountdown$ = select(
        this.state$,
        (s4) => s4.collectingTrickCountdown
      );
      this.hand$ = select(this.state$, (s4) => s4.hand);
      this.selectedCardIds$ = select(this.state$, (s4) => s4.selectedCardIds);
      this.handSortOrder$ = select(this.state$, (s4) => s4.handSortOrder);
      this.stateName$ = select(this.state$, (s4) => s4.stateName);
      this.activePlayerId$ = select(this.state$, (s4) => s4.activePlayerId);
      this.activePlayerIds$ = select(this.state$, (s4) => s4.activePlayerIds);
      this.isCurrentPlayerActive$ = select(this.state$, (s4) => s4.isCurrentPlayerActive);
      this.bombActivePlayerId$ = select(this.state$, (s4) => s4.bombActivePlayerId);
      this.round$ = select(this.state$, (s4) => s4.round);
      this.trick$ = select(this.state$, (s4) => s4.trick);
      this.currentTrick$ = select(this.state$, (s4) => s4.currentTrick);
      this.currentTrickValue$ = select(this.state$, (s4) => s4.currentTrickValue);
      this.capturedCards$ = select(this.state$, (s4) => s4.capturedCards);
      this.firstOutPlayerId$ = select(this.state$, (s4) => s4.firstOutPlayerId);
      this.lastComboPlayerId$ = select(this.state$, (s4) => s4.lastComboPlayerId);
      this.lastCombos$ = select(this.state$, (s4) => s4.lastCombos);
      this.lastCombo$ = (playerId) => select(
        this.state$,
        (s4) => s4.lastCombos[String(playerId)] ?? {
          cards: [],
          description: "",
          passed: false
        }
      );
      this.mahjongWish$ = select(this.state$, (s4) => s4.mahjongWish);
      this.selectedMahjongWish$ = select(this.state$, (s4) => s4.selectedMahjongWish);
      this.phoenixAllowedValues$ = select(this.state$, (s4) => s4.phoenixAllowedValues);
      this.selectedPhoenixValue$ = select(this.state$, (s4) => s4.selectedPhoenixValue);
      this.clockwise$ = select(this.state$, (s4) => s4.clockwise);
      this.squareTable$ = select(this.state$, (s4) => s4.squareTable);
      this.theme$ = select(this.state$, (s4) => s4.theme);
      this.isTiki$ = select(this.state$, (s4) => s4.isTiki);
      this.experimentalReplayOpen$ = select(this.state$, (s4) => s4.experimentalReplayOpen);
      this.trickModalOpen$ = select(this.state$, (s4) => s4.trickModalOpen);
      this.betAnimations$ = select(this.state$, (s4) => s4.betAnimations);
    }
    getState() {
      return this.subject$.getValue();
    }
    setState(state) {
      this.subject$.next(state);
    }
    update(partialOrUpdater) {
      const prev = this.getState();
      const patch = typeof partialOrUpdater === "function" ? partialOrUpdater(prev) : partialOrUpdater;
      this.subject$.next({ ...prev, ...patch });
    }
    updateState(partial) {
      this.update(partial);
    }
    updatePlayer(playerId, partialOrUpdater) {
      const id = String(playerId);
      const prev = this.getState();
      const existing = prev.players[id];
      if (!existing) return;
      const patch = typeof partialOrUpdater === "function" ? partialOrUpdater(existing) : partialOrUpdater;
      this.update({
        players: {
          ...prev.players,
          [id]: { ...existing, ...patch }
        }
      });
    }
    hydrateFromGamedatas(gamedatas, currentPlayerId, isSpectator, isRealtime, prefs) {
      const currentId = String(currentPlayerId ?? "");
      const rawPlayers = gamedatas?.players ?? {};
      const handCounts = gamedatas?.handcount ?? gamedatas?.handCount ?? {};
      const capturedPointsMap = gamedatas?.capturedpoints ?? gamedatas?.capturedPoints ?? {};
      let allLastCombos = gamedatas?.allLastCombos ?? gamedatas?.combos ?? {};
      if (Array.isArray(allLastCombos)) {
        const combosMap = {};
        for (const item of allLastCombos) {
          const p3 = String(item?.player ?? item?.playerId ?? item?.player_id ?? "");
          if (p3) combosMap[p3] = item;
        }
        allLastCombos = combosMap;
      }
      const rawPasses = Array.isArray(gamedatas?.passes) ? gamedatas.passes : [];
      const passedSet = new Set(rawPasses.map((p3) => String(p3)));
      const players = {};
      const lastCombos = {};
      for (const key of Object.keys(rawPlayers)) {
        const p3 = rawPlayers[key];
        const pid = String(p3?.id ?? key);
        const combo = allLastCombos[pid] ?? allLastCombos[Number(pid)];
        const comboCards = combo?.cards ? normalizeCards(combo.cards) : [];
        const comboType = Number(combo?.type);
        const isNoCombo = comboType === 99;
        const isPassCombo = comboType === 0;
        const hasComboCards = !isNoCombo && !isPassCombo && comboCards.length > 0;
        const hasPassed = !hasComboCards && (isPassCombo || passedSet.has(pid));
        const rawPass = Number(p3?.pass ?? 0);
        const safePass = Number.isNaN(rawPass) ? 0 : rawPass;
        players[pid] = {
          id: pid,
          name: String(p3?.name ?? p3?.player_name ?? ""),
          color: String(p3?.color ?? p3?.player_color ?? "000000"),
          no: Number(p3?.no ?? p3?.player_no ?? 0),
          score: Number(p3?.score ?? p3?.player_score ?? 0),
          callGrandTichu: normalizeGrandTichuBet(p3?.call_grand_tichu),
          callTichu: normalizeTichuBet(p3?.call_tichu),
          autopass: safePass > 0,
          pass: safePass,
          handcount: Number(handCounts[pid] ?? handCounts[Number(pid)] ?? 0),
          capturedPoints: Number(capturedPointsMap[pid] ?? capturedPointsMap[Number(pid)] ?? 0),
          passedCardReady: hasPassed
        };
        if (hasComboCards) {
          lastCombos[pid] = {
            cards: comboCards,
            description: String(combo?.description ?? ""),
            passed: false
          };
        } else if (hasPassed) {
          lastCombos[pid] = {
            cards: [],
            description: "Pass",
            passed: true
          };
        } else {
          lastCombos[pid] = {
            cards: [],
            description: "",
            passed: false
          };
        }
      }
      const gamestate = gamedatas?.gamestate;
      const rawPassed = gamedatas?.passedCards ?? gamestate?.args?._private;
      const receivedCards = Array.isArray(rawPassed) ? normalizeCards(rawPassed) : [];
      const playersDesc = getNextPlayersDesc(players, currentId);
      const passSlots = playersDesc.slice(0, 3).map((p3, idx) => {
        const received = receivedCards.find((c4) => String(c4.passed_from) === p3.id) ?? (receivedCards[idx] && String(receivedCards[idx]?.passed_from) === p3.id ? receivedCards[idx] : null);
        return {
          dir: idx + 1,
          playerId: p3.id,
          givenCard: null,
          receivedCard: received ?? null,
          animatingAccept: false
        };
      });
      const playerOrderBottomToLeft = [...playersDesc].reverse().map((p3) => p3.id);
      const rawFirstOut = gamedatas?.firstoutplayer ?? gamedatas?.first_out_player ?? gamedatas?.first_out;
      const firstOutPlayerId = rawFirstOut && String(rawFirstOut) !== "0" ? String(rawFirstOut) : "";
      const rawLastComboPlayer = gamedatas?.lastComboPlayer ?? gamedatas?.last_combo_player;
      const lastComboPlayerId = rawLastComboPlayer && String(rawLastComboPlayer) !== "0" ? String(rawLastComboPlayer) : "";
      const rawWish = Number(gamedatas?.mahjongWish ?? gamedatas?.mahjong_wish ?? 0);
      const mahjongWish = rawWish > 0 && rawWish < 15 ? rawWish : 0;
      const squareTable = prefs?.squareTable !== void 0 ? Boolean(prefs.squareTable) : Number(prefs?.[100]) === 2;
      const clockwise = prefs?.clockwise !== void 0 ? Boolean(prefs.clockwise) : Number(prefs?.[101]) !== 1;
      const isTiki = prefs?.isTiki !== void 0 ? Boolean(prefs.isTiki) : Number(prefs?.[103]) === 1;
      const rawTheme = prefs?.theme !== void 0 ? Number(prefs.theme) : prefs?.[104] !== void 0 ? Number(prefs[104]) : 0;
      const theme = !Number.isNaN(rawTheme) && rawTheme >= 0 && rawTheme <= 10 ? rawTheme : 0;
      const handSortOrder = prefs?.handSortOrder ?? "rank";
      const stateName = String(gamestate?.name ?? "");
      const activePlayerId = gamestate?.active_player ? String(gamestate.active_player) : "";
      const activePlayerIds = Array.isArray(gamestate?.multiactive) ? gamestate.multiactive.map((id) => String(id)) : activePlayerId ? [activePlayerId] : [];
      const isCurrentPlayerActive = !isSpectator && (activePlayerId === currentId || activePlayerIds.includes(currentId));
      this.setState({
        currentPlayerId: currentId,
        isSpectator: Boolean(isSpectator),
        isRealtime: Boolean(isRealtime),
        isAllInfoExposed: Number(gamedatas?.isAllInfoExposed ?? gamedatas?.is_all_info_exposed) === 1,
        players,
        playerOrderBottomToLeft,
        passSlots,
        acceptingCardsCountdown: false,
        collectingTrickCountdown: false,
        hand: normalizeCards(gamedatas?.hand),
        selectedCardIds: [],
        handSortOrder,
        stateName,
        activePlayerId,
        activePlayerIds,
        isCurrentPlayerActive,
        bombActivePlayerId: null,
        round: Number(gamedatas?.round ?? 0),
        trick: Number(gamedatas?.trick ?? 0),
        currentTrick: normalizeCards(gamedatas?.currentTrick),
        currentTrickValue: Number(
          gamedatas?.currentTrickValue ?? gamedatas?.current_trick_value ?? 0
        ),
        capturedCards: normalizeCards(gamedatas?.capturedCards),
        firstOutPlayerId,
        lastComboPlayerId,
        lastCombos,
        mahjongWish,
        selectedMahjongWish: null,
        phoenixAllowedValues: [],
        selectedPhoenixValue: null,
        clockwise,
        squareTable,
        theme,
        isTiki,
        experimentalReplayOpen: false,
        trickModalOpen: false,
        betAnimations: []
      });
    }
    // State machine transition helpers
    setGameState(stateName, opts) {
      const prev = this.getState();
      const activePlayerId = opts?.activePlayerId !== void 0 ? opts.activePlayerId ? String(opts.activePlayerId) : "" : prev.activePlayerId;
      const activePlayerIds = opts?.activePlayerIds !== void 0 ? opts.activePlayerIds.map((id) => String(id)) : prev.activePlayerIds;
      const isCurrentPlayerActive = opts?.isCurrentPlayerActive !== void 0 ? opts.isCurrentPlayerActive : prev.isCurrentPlayerActive;
      const bombActivePlayerId = opts?.bombActivePlayerId !== void 0 ? opts.bombActivePlayerId ? String(opts.bombActivePlayerId) : null : stateName === "playBomb" ? prev.bombActivePlayerId : null;
      this.update({
        stateName,
        activePlayerId,
        activePlayerIds,
        isCurrentPlayerActive,
        bombActivePlayerId,
        acceptingCardsCountdown: stateName === "showPassedCards" ? prev.acceptingCardsCountdown : false,
        collectingTrickCountdown: stateName === "confirmTrick" ? prev.collectingTrickCountdown : false
      });
    }
    resetLastCombos() {
      const prev = this.getState();
      const lastCombos = {};
      for (const pid of Object.keys(prev.players)) {
        lastCombos[pid] = { cards: [], description: "", passed: false };
      }
      this.update({
        lastCombos,
        lastComboPlayerId: ""
      });
    }
    enterNewRound() {
      const prev = this.getState();
      const players = {};
      const lastCombos = {};
      for (const [pid, player] of Object.entries(prev.players)) {
        players[pid] = {
          ...player,
          capturedPoints: 0,
          passedCardReady: false,
          callTichu: -1,
          callGrandTichu: -1
        };
        lastCombos[pid] = { cards: [], description: "", passed: false };
      }
      const passSlots = prev.passSlots.map((slot) => ({
        ...slot,
        givenCard: null,
        receivedCard: null,
        animatingAccept: false
      }));
      this.update({
        players,
        lastCombos,
        passSlots,
        lastComboPlayerId: "",
        capturedCards: [],
        hand: [],
        selectedCardIds: [],
        currentTrick: [],
        currentTrickValue: 0,
        firstOutPlayerId: "",
        round: prev.round + 1,
        trick: 0,
        mahjongWish: 0,
        selectedMahjongWish: null,
        phoenixAllowedValues: [],
        selectedPhoenixValue: null
      });
    }
    enterGrandTichuBets() {
      this.resetLastCombos();
    }
    enterShowPassedCards(receivedCards) {
      const prev = this.getState();
      const players = {};
      for (const [pid, player] of Object.entries(prev.players)) {
        players[pid] = {
          ...player,
          handcount: 14
        };
      }
      const normalized = receivedCards ? normalizeCards(receivedCards) : [];
      const passSlots = prev.passSlots.map((slot) => {
        const received = normalized.find((c4) => String(c4.passed_from) === slot.playerId) ?? slot.receivedCard;
        return {
          ...slot,
          givenCard: null,
          receivedCard: received ?? null,
          animatingAccept: false
        };
      });
      this.update({
        players,
        passSlots
      });
    }
    enterNewTrick() {
      const prev = this.getState();
      const lastCombos = {};
      for (const pid of Object.keys(prev.players)) {
        lastCombos[pid] = { cards: [], description: "", passed: false };
      }
      this.update({
        lastCombos,
        lastComboPlayerId: "",
        capturedCards: [...prev.capturedCards, ...prev.currentTrick],
        currentTrick: [],
        currentTrickValue: 0,
        trick: prev.trick + 1
      });
    }
    enterMahjongPlay() {
      this.update({
        selectedCardIds: [],
        selectedMahjongWish: null
      });
    }
    enterPhoenixPlay(allowedValues) {
      this.update({
        selectedCardIds: [],
        phoenixAllowedValues: [...allowedValues],
        selectedPhoenixValue: null
      });
    }
    enterPlayBomb(bombActivePlayerId) {
      this.update({
        bombActivePlayerId: String(bombActivePlayerId)
      });
    }
    enterEndRound() {
      const prev = this.getState();
      const players = {};
      for (const [pid, player] of Object.entries(prev.players)) {
        players[pid] = {
          ...player,
          handcount: 0,
          capturedPoints: 0,
          callGrandTichu: -1,
          callTichu: -1,
          passedCardReady: false,
          autopass: false,
          pass: 0
        };
      }
      this.update({
        hand: [],
        selectedCardIds: [],
        players,
        firstOutPlayerId: ""
      });
    }
    cleanPlayersPanel() {
      this.enterEndRound();
    }
    // Hand & Selection mutations
    setHand(cards) {
      const normalized = normalizeCards(cards);
      const validIds = new Set(normalized.map((c4) => c4.id));
      const prev = this.getState();
      this.update({
        hand: normalized,
        selectedCardIds: prev.selectedCardIds.filter((id) => validIds.has(id))
      });
    }
    dealCards(cards) {
      const normalized = normalizeCards(cards);
      const prev = this.getState();
      const isInitialDeal = normalized.length === 8;
      const nextHand = isInitialDeal ? normalized : [...prev.hand, ...normalized];
      const totalCards = isInitialDeal ? 8 : 14;
      const players = {};
      for (const [pid, player] of Object.entries(prev.players)) {
        players[pid] = {
          ...player,
          handcount: totalCards
        };
      }
      this.update({
        hand: nextHand,
        selectedCardIds: isInitialDeal ? [] : prev.selectedCardIds,
        players
      });
    }
    setSelectedCardIds(selectedCardIds) {
      this.update({ selectedCardIds: [...selectedCardIds] });
    }
    toggleCardSelection(cardId, mode = 2) {
      if (mode === 0) return;
      const id = String(cardId);
      const prev = this.getState();
      const isSelected = prev.selectedCardIds.includes(id);
      if (mode === 1) {
        this.update({ selectedCardIds: isSelected ? [] : [id] });
      } else {
        this.update({
          selectedCardIds: isSelected ? prev.selectedCardIds.filter((x2) => x2 !== id) : [...prev.selectedCardIds, id]
        });
      }
    }
    clearSelection() {
      this.update({ selectedCardIds: [] });
    }
    setHandSortOrder(handSortOrder) {
      this.update({ handSortOrder });
    }
    // Passing cards mutations
    toggleGiveCardSlot(slotIndex) {
      const prev = this.getState();
      if (prev.stateName !== "giveCards" || !prev.isCurrentPlayerActive) return;
      const slot = prev.passSlots[slotIndex];
      if (!slot) return;
      if (!slot.givenCard) {
        if (prev.selectedCardIds.length !== 1) return;
        const selectedId = prev.selectedCardIds[0];
        const card = prev.hand.find((c4) => c4.id === selectedId);
        if (!card) return;
        const passSlots = prev.passSlots.map(
          (s4, idx) => idx === slotIndex ? { ...s4, givenCard: card } : s4
        );
        this.update({
          passSlots,
          hand: prev.hand.filter((c4) => c4.id !== selectedId),
          selectedCardIds: []
        });
      } else {
        const returnedCard = slot.givenCard;
        const passSlots = prev.passSlots.map(
          (s4, idx) => idx === slotIndex ? { ...s4, givenCard: null } : s4
        );
        this.update({
          passSlots,
          hand: [...prev.hand, returnedCard]
        });
      }
    }
    resetPassCards() {
      const prev = this.getState();
      const returnedCards = [];
      const passSlots = prev.passSlots.map((slot) => {
        if (slot.givenCard) {
          returnedCards.push(slot.givenCard);
          return { ...slot, givenCard: null };
        }
        return slot;
      });
      if (returnedCards.length === 0) return;
      this.update({
        passSlots,
        hand: [...prev.hand, ...returnedCards]
      });
    }
    getCardsToGiveIds() {
      const prev = this.getState();
      if (prev.passSlots.length < 3) return null;
      const ids = [];
      for (let i6 = 0; i6 < 3; i6++) {
        const card = prev.passSlots[i6]?.givenCard;
        if (!card) return null;
        ids.push(card.id);
      }
      return ids;
    }
    clearGivenCards() {
      const prev = this.getState();
      this.update({
        passSlots: prev.passSlots.map((s4) => ({ ...s4, givenCard: null }))
      });
    }
    applyPassCardsNotif(cardIds) {
      const idSet = new Set(cardIds.map((id) => String(id)));
      const prev = this.getState();
      this.update({
        hand: prev.hand.filter((c4) => !idSet.has(c4.id)),
        selectedCardIds: prev.selectedCardIds.filter((id) => !idSet.has(id)),
        passSlots: prev.passSlots.map(
          (s4) => s4.givenCard && idSet.has(s4.givenCard.id) ? { ...s4, givenCard: null } : s4
        )
      });
    }
    startAcceptCardsAnimation() {
      const prev = this.getState();
      this.update({
        acceptingCardsCountdown: false,
        passSlots: prev.passSlots.map((s4) => ({
          ...s4,
          animatingAccept: s4.receivedCard !== null
        }))
      });
    }
    finishAcceptCards(cards) {
      const normalized = normalizeCards(cards);
      const prev = this.getState();
      const existingIds = new Set(prev.hand.map((c4) => c4.id));
      const newCards = normalized.filter((c4) => !existingIds.has(c4.id));
      this.update({
        acceptingCardsCountdown: false,
        hand: [...prev.hand, ...newCards],
        passSlots: prev.passSlots.map((s4) => ({
          ...s4,
          receivedCard: null,
          animatingAccept: false
        }))
      });
    }
    // Trick / Combo / Pass / Bet / Score / Wish / Phoenix mutations
    applyPlayCombo(playerId, cards, comboName, points) {
      const pid = String(playerId);
      const normalized = normalizeCards(cards);
      const playedIds = new Set(normalized.map((c4) => c4.id));
      const prev = this.getState();
      const isCurrent = pid === prev.currentPlayerId;
      const nextHand = isCurrent ? prev.hand.filter((c4) => !playedIds.has(c4.id)) : prev.hand;
      const nextSelectedIds = isCurrent ? prev.selectedCardIds.filter((id) => !playedIds.has(id)) : prev.selectedCardIds;
      const existingPlayer = prev.players[pid];
      const players = existingPlayer ? {
        ...prev.players,
        [pid]: {
          ...existingPlayer,
          handcount: Math.max(0, existingPlayer.handcount - normalized.length),
          passedCardReady: false
        }
      } : prev.players;
      const lastCombos = {
        ...prev.lastCombos,
        [pid]: {
          cards: normalized,
          description: comboName,
          passed: false
        }
      };
      this.update({
        hand: nextHand,
        selectedCardIds: nextSelectedIds,
        players,
        lastCombos,
        lastComboPlayerId: pid,
        currentTrick: [...prev.currentTrick, ...normalized],
        currentTrickValue: prev.currentTrickValue + Number(points ?? 0)
      });
    }
    applyPass(playerId) {
      const pid = String(playerId);
      const prev = this.getState();
      const existingPlayer = prev.players[pid];
      const players = existingPlayer ? {
        ...prev.players,
        [pid]: {
          ...existingPlayer,
          passedCardReady: true
        }
      } : prev.players;
      const lastCombos = {
        ...prev.lastCombos,
        [pid]: {
          cards: [],
          description: "Pass",
          passed: true
        }
      };
      this.update({
        players,
        lastCombos
      });
    }
    applyGrandTichuBet(playerId, bet) {
      const pid = String(playerId);
      const normalizedBet = normalizeGrandTichuBet(bet);
      const prev = this.getState();
      const existingPlayer = prev.players[pid];
      if (!existingPlayer) return;
      this.updatePlayer(pid, {
        callGrandTichu: normalizedBet,
        callTichu: normalizedBet === 200 ? 0 : existingPlayer.callTichu
      });
    }
    applyTichuBet(playerId, bet) {
      const pid = String(playerId);
      const normalizedBet = normalizeTichuBet(bet);
      const prev = this.getState();
      const existingPlayer = prev.players[pid];
      if (!existingPlayer) return;
      this.updatePlayer(pid, {
        callTichu: normalizedBet,
        callGrandTichu: existingPlayer.callGrandTichu === 200 ? 200 : 0
      });
    }
    addBetAnimation(playerId, bet) {
      const id = this.nextBetAnimId++;
      const prev = this.getState();
      this.update({
        betAnimations: [
          ...prev.betAnimations,
          {
            id,
            playerId: String(playerId),
            bet: Number(bet),
            fadingOut: false
          }
        ]
      });
      return id;
    }
    fadeOutBetAnimation(id) {
      const prev = this.getState();
      this.update({
        betAnimations: prev.betAnimations.map((a3) => a3.id === id ? { ...a3, fadingOut: true } : a3)
      });
    }
    removeBetAnimation(id) {
      const prev = this.getState();
      this.update({
        betAnimations: prev.betAnimations.filter((a3) => a3.id !== id)
      });
    }
    triggerBetAnimation(playerId, bet, fadeDelayMs = 1e3, fadeDurationMs = 1e3) {
      const id = this.addBetAnimation(playerId, bet);
      setTimeout(() => {
        this.fadeOutBetAnimation(id);
      }, fadeDelayMs);
      setTimeout(() => {
        this.removeBetAnimation(id);
      }, fadeDelayMs + fadeDurationMs);
    }
    setMahjongWish(wish) {
      const n5 = Number(wish);
      this.update({
        mahjongWish: n5 > 0 && n5 < 15 ? n5 : 0,
        selectedMahjongWish: null
      });
    }
    setSelectedMahjongWish(selectedMahjongWish) {
      this.update({ selectedMahjongWish });
    }
    setPhoenixAllowedValues(phoenixAllowedValues) {
      this.update({ phoenixAllowedValues: [...phoenixAllowedValues] });
    }
    setSelectedPhoenixValue(selectedPhoenixValue) {
      this.update({ selectedPhoenixValue });
    }
    applyPlayerGoOut(playerId, firstOutId) {
      const pid = String(playerId);
      const fid = String(firstOutId);
      const prev = this.getState();
      const existingPlayer = prev.players[pid];
      const players = existingPlayer ? {
        ...prev.players,
        [pid]: {
          ...existingPlayer,
          handcount: 0
        }
      } : prev.players;
      this.update({
        players,
        firstOutPlayerId: pid === fid ? pid : prev.firstOutPlayerId
      });
    }
    applyCaptureCards(playerId, trickValue) {
      const pid = String(playerId);
      const prev = this.getState();
      const players = {};
      for (const [id, player] of Object.entries(prev.players)) {
        players[id] = {
          ...player,
          capturedPoints: id === pid ? player.capturedPoints + Number(trickValue) : player.capturedPoints,
          passedCardReady: false
        };
      }
      this.update({ players });
    }
    applyNewScores(newScores) {
      const prev = this.getState();
      const players = { ...prev.players };
      for (const [id, score] of Object.entries(newScores)) {
        const pid = String(id);
        const existing = players[pid];
        if (existing) {
          players[pid] = {
            ...existing,
            score: Number(score)
          };
        }
      }
      this.update({ players });
    }
    setAutopass(autopassValue) {
      const prev = this.getState();
      if (prev.isSpectator || !prev.currentPlayerId) return;
      const passNum = typeof autopassValue === "boolean" ? autopassValue ? 1 : 0 : Number(autopassValue) || 0;
      this.updatePlayer(prev.currentPlayerId, {
        autopass: passNum > 0,
        pass: passNum
      });
    }
    // UI & Preferences setters
    setClockwise(clockwise) {
      this.update({ clockwise });
    }
    setSquareTable(squareTable) {
      this.update({ squareTable });
    }
    setTheme(theme) {
      this.update({ theme });
    }
    setTiki(isTiki) {
      this.update({ isTiki });
    }
    setExperimentalReplayOpen(experimentalReplayOpen) {
      this.update({ experimentalReplayOpen });
    }
    setTrickModalOpen(trickModalOpen) {
      this.update({ trickModalOpen });
    }
    setAcceptingCardsCountdown(acceptingCardsCountdown) {
      this.update({ acceptingCardsCountdown });
    }
    setCollectingTrickCountdown(collectingTrickCountdown) {
      this.update({ collectingTrickCountdown });
    }
  };
  if (typeof window !== "undefined") {
    if (!window.gameModel) {
      window.gameModel = new GameModel();
    }
  }
  if (typeof document !== "undefined" && document.documentElement) {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    document.documentElement.style.setProperty("--icon-url", `url(${themeUrl}img/tichu-icons.png)`);
    document.documentElement.style.setProperty(
      "--table-icons-url",
      `url(${themeUrl}img/tichu-icons-table.png)`
    );
    document.documentElement.style.setProperty(
      "--mahjong-bg-url",
      `url(${themeUrl}img/tichu-mahjong.png)`
    );
    document.documentElement.style.setProperty(
      "--tiki-mahjong-bg-url",
      `url(${themeUrl}img/tiki-tichu-mahjong.png)`
    );
  }

  // node_modules/@lit/reactive-element/css-tag.js
  var t = globalThis;
  var e = t.ShadowRoot && (void 0 === t.ShadyCSS || t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
  var s = /* @__PURE__ */ Symbol();
  var o = /* @__PURE__ */ new WeakMap();
  var n = class {
    constructor(t12, e7, o6) {
      if (this._$cssResult$ = true, o6 !== s) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
      this.cssText = t12, this.t = e7;
    }
    get styleSheet() {
      let t12 = this.o;
      const s4 = this.t;
      if (e && void 0 === t12) {
        const e7 = void 0 !== s4 && 1 === s4.length;
        e7 && (t12 = o.get(s4)), void 0 === t12 && ((this.o = t12 = new CSSStyleSheet()).replaceSync(this.cssText), e7 && o.set(s4, t12));
      }
      return t12;
    }
    toString() {
      return this.cssText;
    }
  };
  var r = (t12) => new n("string" == typeof t12 ? t12 : t12 + "", void 0, s);
  var i = (t12, ...e7) => {
    const o6 = 1 === t12.length ? t12[0] : e7.reduce(((e8, s4, o7) => e8 + ((t13) => {
      if (true === t13._$cssResult$) return t13.cssText;
      if ("number" == typeof t13) return t13;
      throw Error("Value passed to 'css' function must be a 'css' function result: " + t13 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
    })(s4) + t12[o7 + 1]), t12[0]);
    return new n(o6, t12, s);
  };
  var S = (s4, o6) => {
    if (e) s4.adoptedStyleSheets = o6.map(((t12) => t12 instanceof CSSStyleSheet ? t12 : t12.styleSheet));
    else for (const e7 of o6) {
      const o7 = document.createElement("style"), n5 = t.litNonce;
      void 0 !== n5 && o7.setAttribute("nonce", n5), o7.textContent = e7.cssText, s4.appendChild(o7);
    }
  };
  var c = e ? (t12) => t12 : (t12) => t12 instanceof CSSStyleSheet ? ((t13) => {
    let e7 = "";
    for (const s4 of t13.cssRules) e7 += s4.cssText;
    return r(e7);
  })(t12) : t12;

  // node_modules/@lit/reactive-element/reactive-element.js
  var { is: i2, defineProperty: e2, getOwnPropertyDescriptor: h, getOwnPropertyNames: r2, getOwnPropertySymbols: o2, getPrototypeOf: n2 } = Object;
  var a = globalThis;
  var c2 = a.trustedTypes;
  var l = c2 ? c2.emptyScript : "";
  var p = a.reactiveElementPolyfillSupport;
  var d = (t12, s4) => t12;
  var u = { toAttribute(t12, s4) {
    switch (s4) {
      case Boolean:
        t12 = t12 ? l : null;
        break;
      case Object:
      case Array:
        t12 = null == t12 ? t12 : JSON.stringify(t12);
    }
    return t12;
  }, fromAttribute(t12, s4) {
    let i6 = t12;
    switch (s4) {
      case Boolean:
        i6 = null !== t12;
        break;
      case Number:
        i6 = null === t12 ? null : Number(t12);
        break;
      case Object:
      case Array:
        try {
          i6 = JSON.parse(t12);
        } catch (t13) {
          i6 = null;
        }
    }
    return i6;
  } };
  var f = (t12, s4) => !i2(t12, s4);
  var b = { attribute: true, type: String, converter: u, reflect: false, useDefault: false, hasChanged: f };
  Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), a.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
  var y = class extends HTMLElement {
    static addInitializer(t12) {
      this._$Ei(), (this.l ??= []).push(t12);
    }
    static get observedAttributes() {
      return this.finalize(), this._$Eh && [...this._$Eh.keys()];
    }
    static createProperty(t12, s4 = b) {
      if (s4.state && (s4.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(t12) && ((s4 = Object.create(s4)).wrapped = true), this.elementProperties.set(t12, s4), !s4.noAccessor) {
        const i6 = /* @__PURE__ */ Symbol(), h3 = this.getPropertyDescriptor(t12, i6, s4);
        void 0 !== h3 && e2(this.prototype, t12, h3);
      }
    }
    static getPropertyDescriptor(t12, s4, i6) {
      const { get: e7, set: r6 } = h(this.prototype, t12) ?? { get() {
        return this[s4];
      }, set(t13) {
        this[s4] = t13;
      } };
      return { get: e7, set(s5) {
        const h3 = e7?.call(this);
        r6?.call(this, s5), this.requestUpdate(t12, h3, i6);
      }, configurable: true, enumerable: true };
    }
    static getPropertyOptions(t12) {
      return this.elementProperties.get(t12) ?? b;
    }
    static _$Ei() {
      if (this.hasOwnProperty(d("elementProperties"))) return;
      const t12 = n2(this);
      t12.finalize(), void 0 !== t12.l && (this.l = [...t12.l]), this.elementProperties = new Map(t12.elementProperties);
    }
    static finalize() {
      if (this.hasOwnProperty(d("finalized"))) return;
      if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d("properties"))) {
        const t13 = this.properties, s4 = [...r2(t13), ...o2(t13)];
        for (const i6 of s4) this.createProperty(i6, t13[i6]);
      }
      const t12 = this[Symbol.metadata];
      if (null !== t12) {
        const s4 = litPropertyMetadata.get(t12);
        if (void 0 !== s4) for (const [t13, i6] of s4) this.elementProperties.set(t13, i6);
      }
      this._$Eh = /* @__PURE__ */ new Map();
      for (const [t13, s4] of this.elementProperties) {
        const i6 = this._$Eu(t13, s4);
        void 0 !== i6 && this._$Eh.set(i6, t13);
      }
      this.elementStyles = this.finalizeStyles(this.styles);
    }
    static finalizeStyles(s4) {
      const i6 = [];
      if (Array.isArray(s4)) {
        const e7 = new Set(s4.flat(1 / 0).reverse());
        for (const s5 of e7) i6.unshift(c(s5));
      } else void 0 !== s4 && i6.push(c(s4));
      return i6;
    }
    static _$Eu(t12, s4) {
      const i6 = s4.attribute;
      return false === i6 ? void 0 : "string" == typeof i6 ? i6 : "string" == typeof t12 ? t12.toLowerCase() : void 0;
    }
    constructor() {
      super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
    }
    _$Ev() {
      this._$ES = new Promise(((t12) => this.enableUpdating = t12)), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach(((t12) => t12(this)));
    }
    addController(t12) {
      (this._$EO ??= /* @__PURE__ */ new Set()).add(t12), void 0 !== this.renderRoot && this.isConnected && t12.hostConnected?.();
    }
    removeController(t12) {
      this._$EO?.delete(t12);
    }
    _$E_() {
      const t12 = /* @__PURE__ */ new Map(), s4 = this.constructor.elementProperties;
      for (const i6 of s4.keys()) this.hasOwnProperty(i6) && (t12.set(i6, this[i6]), delete this[i6]);
      t12.size > 0 && (this._$Ep = t12);
    }
    createRenderRoot() {
      const t12 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
      return S(t12, this.constructor.elementStyles), t12;
    }
    connectedCallback() {
      this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(true), this._$EO?.forEach(((t12) => t12.hostConnected?.()));
    }
    enableUpdating(t12) {
    }
    disconnectedCallback() {
      this._$EO?.forEach(((t12) => t12.hostDisconnected?.()));
    }
    attributeChangedCallback(t12, s4, i6) {
      this._$AK(t12, i6);
    }
    _$ET(t12, s4) {
      const i6 = this.constructor.elementProperties.get(t12), e7 = this.constructor._$Eu(t12, i6);
      if (void 0 !== e7 && true === i6.reflect) {
        const h3 = (void 0 !== i6.converter?.toAttribute ? i6.converter : u).toAttribute(s4, i6.type);
        this._$Em = t12, null == h3 ? this.removeAttribute(e7) : this.setAttribute(e7, h3), this._$Em = null;
      }
    }
    _$AK(t12, s4) {
      const i6 = this.constructor, e7 = i6._$Eh.get(t12);
      if (void 0 !== e7 && this._$Em !== e7) {
        const t13 = i6.getPropertyOptions(e7), h3 = "function" == typeof t13.converter ? { fromAttribute: t13.converter } : void 0 !== t13.converter?.fromAttribute ? t13.converter : u;
        this._$Em = e7;
        const r6 = h3.fromAttribute(s4, t13.type);
        this[e7] = r6 ?? this._$Ej?.get(e7) ?? r6, this._$Em = null;
      }
    }
    requestUpdate(t12, s4, i6) {
      if (void 0 !== t12) {
        const e7 = this.constructor, h3 = this[t12];
        if (i6 ??= e7.getPropertyOptions(t12), !((i6.hasChanged ?? f)(h3, s4) || i6.useDefault && i6.reflect && h3 === this._$Ej?.get(t12) && !this.hasAttribute(e7._$Eu(t12, i6)))) return;
        this.C(t12, s4, i6);
      }
      false === this.isUpdatePending && (this._$ES = this._$EP());
    }
    C(t12, s4, { useDefault: i6, reflect: e7, wrapped: h3 }, r6) {
      i6 && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t12) && (this._$Ej.set(t12, r6 ?? s4 ?? this[t12]), true !== h3 || void 0 !== r6) || (this._$AL.has(t12) || (this.hasUpdated || i6 || (s4 = void 0), this._$AL.set(t12, s4)), true === e7 && this._$Em !== t12 && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t12));
    }
    async _$EP() {
      this.isUpdatePending = true;
      try {
        await this._$ES;
      } catch (t13) {
        Promise.reject(t13);
      }
      const t12 = this.scheduleUpdate();
      return null != t12 && await t12, !this.isUpdatePending;
    }
    scheduleUpdate() {
      return this.performUpdate();
    }
    performUpdate() {
      if (!this.isUpdatePending) return;
      if (!this.hasUpdated) {
        if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
          for (const [t14, s5] of this._$Ep) this[t14] = s5;
          this._$Ep = void 0;
        }
        const t13 = this.constructor.elementProperties;
        if (t13.size > 0) for (const [s5, i6] of t13) {
          const { wrapped: t14 } = i6, e7 = this[s5];
          true !== t14 || this._$AL.has(s5) || void 0 === e7 || this.C(s5, void 0, i6, e7);
        }
      }
      let t12 = false;
      const s4 = this._$AL;
      try {
        t12 = this.shouldUpdate(s4), t12 ? (this.willUpdate(s4), this._$EO?.forEach(((t13) => t13.hostUpdate?.())), this.update(s4)) : this._$EM();
      } catch (s5) {
        throw t12 = false, this._$EM(), s5;
      }
      t12 && this._$AE(s4);
    }
    willUpdate(t12) {
    }
    _$AE(t12) {
      this._$EO?.forEach(((t13) => t13.hostUpdated?.())), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t12)), this.updated(t12);
    }
    _$EM() {
      this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
    }
    get updateComplete() {
      return this.getUpdateComplete();
    }
    getUpdateComplete() {
      return this._$ES;
    }
    shouldUpdate(t12) {
      return true;
    }
    update(t12) {
      this._$Eq &&= this._$Eq.forEach(((t13) => this._$ET(t13, this[t13]))), this._$EM();
    }
    updated(t12) {
    }
    firstUpdated(t12) {
    }
  };
  y.elementStyles = [], y.shadowRootOptions = { mode: "open" }, y[d("elementProperties")] = /* @__PURE__ */ new Map(), y[d("finalized")] = /* @__PURE__ */ new Map(), p?.({ ReactiveElement: y }), (a.reactiveElementVersions ??= []).push("2.1.1");

  // node_modules/lit-html/lit-html.js
  var t2 = globalThis;
  var i3 = t2.trustedTypes;
  var s2 = i3 ? i3.createPolicy("lit-html", { createHTML: (t12) => t12 }) : void 0;
  var e3 = "$lit$";
  var h2 = `lit$${Math.random().toFixed(9).slice(2)}$`;
  var o3 = "?" + h2;
  var n3 = `<${o3}>`;
  var r3 = document;
  var l2 = () => r3.createComment("");
  var c3 = (t12) => null === t12 || "object" != typeof t12 && "function" != typeof t12;
  var a2 = Array.isArray;
  var u2 = (t12) => a2(t12) || "function" == typeof t12?.[Symbol.iterator];
  var d2 = "[ 	\n\f\r]";
  var f2 = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
  var v = /-->/g;
  var _2 = />/g;
  var m = RegExp(`>|${d2}(?:([^\\s"'>=/]+)(${d2}*=${d2}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
  var p2 = /'/g;
  var g = /"/g;
  var $ = /^(?:script|style|textarea|title)$/i;
  var y2 = (t12) => (i6, ...s4) => ({ _$litType$: t12, strings: i6, values: s4 });
  var x = y2(1);
  var b2 = y2(2);
  var w = y2(3);
  var T = /* @__PURE__ */ Symbol.for("lit-noChange");
  var E = /* @__PURE__ */ Symbol.for("lit-nothing");
  var A = /* @__PURE__ */ new WeakMap();
  var C = r3.createTreeWalker(r3, 129);
  function P(t12, i6) {
    if (!a2(t12) || !t12.hasOwnProperty("raw")) throw Error("invalid template strings array");
    return void 0 !== s2 ? s2.createHTML(i6) : i6;
  }
  var V = (t12, i6) => {
    const s4 = t12.length - 1, o6 = [];
    let r6, l3 = 2 === i6 ? "<svg>" : 3 === i6 ? "<math>" : "", c4 = f2;
    for (let i7 = 0; i7 < s4; i7++) {
      const s5 = t12[i7];
      let a3, u3, d3 = -1, y3 = 0;
      for (; y3 < s5.length && (c4.lastIndex = y3, u3 = c4.exec(s5), null !== u3); ) y3 = c4.lastIndex, c4 === f2 ? "!--" === u3[1] ? c4 = v : void 0 !== u3[1] ? c4 = _2 : void 0 !== u3[2] ? ($.test(u3[2]) && (r6 = RegExp("</" + u3[2], "g")), c4 = m) : void 0 !== u3[3] && (c4 = m) : c4 === m ? ">" === u3[0] ? (c4 = r6 ?? f2, d3 = -1) : void 0 === u3[1] ? d3 = -2 : (d3 = c4.lastIndex - u3[2].length, a3 = u3[1], c4 = void 0 === u3[3] ? m : '"' === u3[3] ? g : p2) : c4 === g || c4 === p2 ? c4 = m : c4 === v || c4 === _2 ? c4 = f2 : (c4 = m, r6 = void 0);
      const x2 = c4 === m && t12[i7 + 1].startsWith("/>") ? " " : "";
      l3 += c4 === f2 ? s5 + n3 : d3 >= 0 ? (o6.push(a3), s5.slice(0, d3) + e3 + s5.slice(d3) + h2 + x2) : s5 + h2 + (-2 === d3 ? i7 : x2);
    }
    return [P(t12, l3 + (t12[s4] || "<?>") + (2 === i6 ? "</svg>" : 3 === i6 ? "</math>" : "")), o6];
  };
  var N = class _N {
    constructor({ strings: t12, _$litType$: s4 }, n5) {
      let r6;
      this.parts = [];
      let c4 = 0, a3 = 0;
      const u3 = t12.length - 1, d3 = this.parts, [f3, v2] = V(t12, s4);
      if (this.el = _N.createElement(f3, n5), C.currentNode = this.el.content, 2 === s4 || 3 === s4) {
        const t13 = this.el.content.firstChild;
        t13.replaceWith(...t13.childNodes);
      }
      for (; null !== (r6 = C.nextNode()) && d3.length < u3; ) {
        if (1 === r6.nodeType) {
          if (r6.hasAttributes()) for (const t13 of r6.getAttributeNames()) if (t13.endsWith(e3)) {
            const i6 = v2[a3++], s5 = r6.getAttribute(t13).split(h2), e7 = /([.?@])?(.*)/.exec(i6);
            d3.push({ type: 1, index: c4, name: e7[2], strings: s5, ctor: "." === e7[1] ? H : "?" === e7[1] ? I : "@" === e7[1] ? L : k }), r6.removeAttribute(t13);
          } else t13.startsWith(h2) && (d3.push({ type: 6, index: c4 }), r6.removeAttribute(t13));
          if ($.test(r6.tagName)) {
            const t13 = r6.textContent.split(h2), s5 = t13.length - 1;
            if (s5 > 0) {
              r6.textContent = i3 ? i3.emptyScript : "";
              for (let i6 = 0; i6 < s5; i6++) r6.append(t13[i6], l2()), C.nextNode(), d3.push({ type: 2, index: ++c4 });
              r6.append(t13[s5], l2());
            }
          }
        } else if (8 === r6.nodeType) if (r6.data === o3) d3.push({ type: 2, index: c4 });
        else {
          let t13 = -1;
          for (; -1 !== (t13 = r6.data.indexOf(h2, t13 + 1)); ) d3.push({ type: 7, index: c4 }), t13 += h2.length - 1;
        }
        c4++;
      }
    }
    static createElement(t12, i6) {
      const s4 = r3.createElement("template");
      return s4.innerHTML = t12, s4;
    }
  };
  function S2(t12, i6, s4 = t12, e7) {
    if (i6 === T) return i6;
    let h3 = void 0 !== e7 ? s4._$Co?.[e7] : s4._$Cl;
    const o6 = c3(i6) ? void 0 : i6._$litDirective$;
    return h3?.constructor !== o6 && (h3?._$AO?.(false), void 0 === o6 ? h3 = void 0 : (h3 = new o6(t12), h3._$AT(t12, s4, e7)), void 0 !== e7 ? (s4._$Co ??= [])[e7] = h3 : s4._$Cl = h3), void 0 !== h3 && (i6 = S2(t12, h3._$AS(t12, i6.values), h3, e7)), i6;
  }
  var M = class {
    constructor(t12, i6) {
      this._$AV = [], this._$AN = void 0, this._$AD = t12, this._$AM = i6;
    }
    get parentNode() {
      return this._$AM.parentNode;
    }
    get _$AU() {
      return this._$AM._$AU;
    }
    u(t12) {
      const { el: { content: i6 }, parts: s4 } = this._$AD, e7 = (t12?.creationScope ?? r3).importNode(i6, true);
      C.currentNode = e7;
      let h3 = C.nextNode(), o6 = 0, n5 = 0, l3 = s4[0];
      for (; void 0 !== l3; ) {
        if (o6 === l3.index) {
          let i7;
          2 === l3.type ? i7 = new R(h3, h3.nextSibling, this, t12) : 1 === l3.type ? i7 = new l3.ctor(h3, l3.name, l3.strings, this, t12) : 6 === l3.type && (i7 = new z(h3, this, t12)), this._$AV.push(i7), l3 = s4[++n5];
        }
        o6 !== l3?.index && (h3 = C.nextNode(), o6++);
      }
      return C.currentNode = r3, e7;
    }
    p(t12) {
      let i6 = 0;
      for (const s4 of this._$AV) void 0 !== s4 && (void 0 !== s4.strings ? (s4._$AI(t12, s4, i6), i6 += s4.strings.length - 2) : s4._$AI(t12[i6])), i6++;
    }
  };
  var R = class _R {
    get _$AU() {
      return this._$AM?._$AU ?? this._$Cv;
    }
    constructor(t12, i6, s4, e7) {
      this.type = 2, this._$AH = E, this._$AN = void 0, this._$AA = t12, this._$AB = i6, this._$AM = s4, this.options = e7, this._$Cv = e7?.isConnected ?? true;
    }
    get parentNode() {
      let t12 = this._$AA.parentNode;
      const i6 = this._$AM;
      return void 0 !== i6 && 11 === t12?.nodeType && (t12 = i6.parentNode), t12;
    }
    get startNode() {
      return this._$AA;
    }
    get endNode() {
      return this._$AB;
    }
    _$AI(t12, i6 = this) {
      t12 = S2(this, t12, i6), c3(t12) ? t12 === E || null == t12 || "" === t12 ? (this._$AH !== E && this._$AR(), this._$AH = E) : t12 !== this._$AH && t12 !== T && this._(t12) : void 0 !== t12._$litType$ ? this.$(t12) : void 0 !== t12.nodeType ? this.T(t12) : u2(t12) ? this.k(t12) : this._(t12);
    }
    O(t12) {
      return this._$AA.parentNode.insertBefore(t12, this._$AB);
    }
    T(t12) {
      this._$AH !== t12 && (this._$AR(), this._$AH = this.O(t12));
    }
    _(t12) {
      this._$AH !== E && c3(this._$AH) ? this._$AA.nextSibling.data = t12 : this.T(r3.createTextNode(t12)), this._$AH = t12;
    }
    $(t12) {
      const { values: i6, _$litType$: s4 } = t12, e7 = "number" == typeof s4 ? this._$AC(t12) : (void 0 === s4.el && (s4.el = N.createElement(P(s4.h, s4.h[0]), this.options)), s4);
      if (this._$AH?._$AD === e7) this._$AH.p(i6);
      else {
        const t13 = new M(e7, this), s5 = t13.u(this.options);
        t13.p(i6), this.T(s5), this._$AH = t13;
      }
    }
    _$AC(t12) {
      let i6 = A.get(t12.strings);
      return void 0 === i6 && A.set(t12.strings, i6 = new N(t12)), i6;
    }
    k(t12) {
      a2(this._$AH) || (this._$AH = [], this._$AR());
      const i6 = this._$AH;
      let s4, e7 = 0;
      for (const h3 of t12) e7 === i6.length ? i6.push(s4 = new _R(this.O(l2()), this.O(l2()), this, this.options)) : s4 = i6[e7], s4._$AI(h3), e7++;
      e7 < i6.length && (this._$AR(s4 && s4._$AB.nextSibling, e7), i6.length = e7);
    }
    _$AR(t12 = this._$AA.nextSibling, i6) {
      for (this._$AP?.(false, true, i6); t12 !== this._$AB; ) {
        const i7 = t12.nextSibling;
        t12.remove(), t12 = i7;
      }
    }
    setConnected(t12) {
      void 0 === this._$AM && (this._$Cv = t12, this._$AP?.(t12));
    }
  };
  var k = class {
    get tagName() {
      return this.element.tagName;
    }
    get _$AU() {
      return this._$AM._$AU;
    }
    constructor(t12, i6, s4, e7, h3) {
      this.type = 1, this._$AH = E, this._$AN = void 0, this.element = t12, this.name = i6, this._$AM = e7, this.options = h3, s4.length > 2 || "" !== s4[0] || "" !== s4[1] ? (this._$AH = Array(s4.length - 1).fill(new String()), this.strings = s4) : this._$AH = E;
    }
    _$AI(t12, i6 = this, s4, e7) {
      const h3 = this.strings;
      let o6 = false;
      if (void 0 === h3) t12 = S2(this, t12, i6, 0), o6 = !c3(t12) || t12 !== this._$AH && t12 !== T, o6 && (this._$AH = t12);
      else {
        const e8 = t12;
        let n5, r6;
        for (t12 = h3[0], n5 = 0; n5 < h3.length - 1; n5++) r6 = S2(this, e8[s4 + n5], i6, n5), r6 === T && (r6 = this._$AH[n5]), o6 ||= !c3(r6) || r6 !== this._$AH[n5], r6 === E ? t12 = E : t12 !== E && (t12 += (r6 ?? "") + h3[n5 + 1]), this._$AH[n5] = r6;
      }
      o6 && !e7 && this.j(t12);
    }
    j(t12) {
      t12 === E ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t12 ?? "");
    }
  };
  var H = class extends k {
    constructor() {
      super(...arguments), this.type = 3;
    }
    j(t12) {
      this.element[this.name] = t12 === E ? void 0 : t12;
    }
  };
  var I = class extends k {
    constructor() {
      super(...arguments), this.type = 4;
    }
    j(t12) {
      this.element.toggleAttribute(this.name, !!t12 && t12 !== E);
    }
  };
  var L = class extends k {
    constructor(t12, i6, s4, e7, h3) {
      super(t12, i6, s4, e7, h3), this.type = 5;
    }
    _$AI(t12, i6 = this) {
      if ((t12 = S2(this, t12, i6, 0) ?? E) === T) return;
      const s4 = this._$AH, e7 = t12 === E && s4 !== E || t12.capture !== s4.capture || t12.once !== s4.once || t12.passive !== s4.passive, h3 = t12 !== E && (s4 === E || e7);
      e7 && this.element.removeEventListener(this.name, this, s4), h3 && this.element.addEventListener(this.name, this, t12), this._$AH = t12;
    }
    handleEvent(t12) {
      "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t12) : this._$AH.handleEvent(t12);
    }
  };
  var z = class {
    constructor(t12, i6, s4) {
      this.element = t12, this.type = 6, this._$AN = void 0, this._$AM = i6, this.options = s4;
    }
    get _$AU() {
      return this._$AM._$AU;
    }
    _$AI(t12) {
      S2(this, t12);
    }
  };
  var j = t2.litHtmlPolyfillSupport;
  j?.(N, R), (t2.litHtmlVersions ??= []).push("3.3.1");
  var B = (t12, i6, s4) => {
    const e7 = s4?.renderBefore ?? i6;
    let h3 = e7._$litPart$;
    if (void 0 === h3) {
      const t13 = s4?.renderBefore ?? null;
      e7._$litPart$ = h3 = new R(i6.insertBefore(l2(), t13), t13, void 0, s4 ?? {});
    }
    return h3._$AI(t12), h3;
  };

  // node_modules/lit-element/lit-element.js
  var s3 = globalThis;
  var i4 = class extends y {
    constructor() {
      super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
    }
    createRenderRoot() {
      const t12 = super.createRenderRoot();
      return this.renderOptions.renderBefore ??= t12.firstChild, t12;
    }
    update(t12) {
      const r6 = this.render();
      this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t12), this._$Do = B(r6, this.renderRoot, this.renderOptions);
    }
    connectedCallback() {
      super.connectedCallback(), this._$Do?.setConnected(true);
    }
    disconnectedCallback() {
      super.disconnectedCallback(), this._$Do?.setConnected(false);
    }
    render() {
      return T;
    }
  };
  i4._$litElement$ = true, i4["finalized"] = true, s3.litElementHydrateSupport?.({ LitElement: i4 });
  var o4 = s3.litElementPolyfillSupport;
  o4?.({ LitElement: i4 });
  (s3.litElementVersions ??= []).push("4.2.1");

  // node_modules/@lit/reactive-element/decorators/property.js
  var o5 = { attribute: true, type: String, converter: u, reflect: false, hasChanged: f };
  var r4 = (t12 = o5, e7, r6) => {
    const { kind: n5, metadata: i6 } = r6;
    let s4 = globalThis.litPropertyMetadata.get(i6);
    if (void 0 === s4 && globalThis.litPropertyMetadata.set(i6, s4 = /* @__PURE__ */ new Map()), "setter" === n5 && ((t12 = Object.create(t12)).wrapped = true), s4.set(r6.name, t12), "accessor" === n5) {
      const { name: o6 } = r6;
      return { set(r7) {
        const n6 = e7.get.call(this);
        e7.set.call(this, r7), this.requestUpdate(o6, n6, t12);
      }, init(e8) {
        return void 0 !== e8 && this.C(o6, void 0, t12, e8), e8;
      } };
    }
    if ("setter" === n5) {
      const { name: o6 } = r6;
      return function(r7) {
        const n6 = this[o6];
        e7.call(this, r7), this.requestUpdate(o6, n6, t12);
      };
    }
    throw Error("Unsupported decorator location: " + n5);
  };
  function n4(t12) {
    return (e7, o6) => "object" == typeof o6 ? r4(t12, e7, o6) : ((t13, e8, o7) => {
      const r6 = e8.hasOwnProperty(o7);
      return e8.constructor.createProperty(o7, t13), r6 ? Object.getOwnPropertyDescriptor(e8, o7) : void 0;
    })(t12, e7, o6);
  }

  // node_modules/@lit/reactive-element/decorators/state.js
  function r5(r6) {
    return n4({ ...r6, state: true, attribute: false });
  }

  // node_modules/lit-html/directive.js
  var t3 = { ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4, EVENT: 5, ELEMENT: 6 };
  var e5 = (t12) => (...e7) => ({ _$litDirective$: t12, values: e7 });
  var i5 = class {
    constructor(t12) {
    }
    get _$AU() {
      return this._$AM._$AU;
    }
    _$AT(t12, e7, i6) {
      this._$Ct = t12, this._$AM = e7, this._$Ci = i6;
    }
    _$AS(t12, e7) {
      return this.update(t12, e7);
    }
    update(t12, e7) {
      return this.render(...e7);
    }
  };

  // node_modules/lit-html/directives/class-map.js
  var e6 = e5(class extends i5 {
    constructor(t12) {
      if (super(t12), t12.type !== t3.ATTRIBUTE || "class" !== t12.name || t12.strings?.length > 2) throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.");
    }
    render(t12) {
      return " " + Object.keys(t12).filter(((s4) => t12[s4])).join(" ") + " ";
    }
    update(s4, [i6]) {
      if (void 0 === this.st) {
        this.st = /* @__PURE__ */ new Set(), void 0 !== s4.strings && (this.nt = new Set(s4.strings.join(" ").split(/\s/).filter(((t12) => "" !== t12))));
        for (const t12 in i6) i6[t12] && !this.nt?.has(t12) && this.st.add(t12);
        return this.render(i6);
      }
      const r6 = s4.element.classList;
      for (const t12 of this.st) t12 in i6 || (r6.remove(t12), this.st.delete(t12));
      for (const t12 in i6) {
        const s5 = !!i6[t12];
        s5 === this.st.has(t12) || this.nt?.has(t12) || (s5 ? (r6.add(t12), this.st.add(t12)) : (r6.remove(t12), this.st.delete(t12)));
      }
      return T;
    }
  });

  // src/elements/tichu-card.ts
  function translate(text) {
    return typeof _ === "function" ? _(text) : text;
  }
  function getDefaultCardTooltip(card) {
    if (!card) return "";
    const color = Number(card.type);
    const rank = Number(card.type_arg);
    if (rank === 10 || rank === 13) return translate("Scores 10 points");
    if (rank === 5) return translate("Scores 5 points");
    if (rank === 1) {
      if (color === 1)
        return translate(
          "Highest single card. Scores 25 points. Trick given to an opponent if Dragon wins it."
        );
      if (color === 2)
        return translate(
          "Scores -25 points. Takes the place of any normal card in a combo but not a bomb. As a Single, worth 1.5 when led, beats any other card but the Dragon by 0.5."
        );
      if (color === 3)
        return translate(
          "The Hound must be played as a leading single card. Player's partner (or the next one if he's gone out) can lead."
        );
      if (color === 4)
        return translate("Scores 0 points. Owner of this card plays first. Player can make a wish.");
    }
    return "";
  }
  var TichuCard = class extends i4 {
    constructor() {
      super(...arguments);
      this.pass = false;
      this.half = false;
      this.scale = 1;
      this.selected = false;
      this.selectable = false;
      this.tiki = false;
      this.tooltip = "";
    }
    static get styles() {
      return [
        i`
        :host {
          display: inline-block;
          position: relative;
        }
        div#card {
          position: relative;
          top: 0;
          width: var(--width);
          height: var(--height);
          background-image: var(--card-url);
          background-size: var(--bg-width) var(--bg-height);
          background-position-x: var(--x-pos);
          background-position-y: var(--y-pos);
          border-radius: calc(var(--width) / 25);
          box-shadow: 2px 2px 5px 2px #666;
          box-sizing: border-box;
        }
        div#card.selectable {
          cursor: pointer;
        }
        div#card.stockitem_selected {
          translate: 0 -20px;
          border: 1px solid #dda !important;
          box-shadow: 0px 0px 4px 1px #ff8;
        }
        div#card.pass {
          background-size: cover;
          background-position: center;
        }
      `
      ];
    }
    getComputedTooltip() {
      if (this.tooltip) return this.tooltip;
      if (this.pass) return translate("Pass");
      return getDefaultCardTooltip(this.card);
    }
    render() {
      const baseWidth = 100;
      const baseHeight = 150;
      const factor = this.half ? 0.5 : this.scale;
      const width = factor * baseWidth;
      const height = factor * baseHeight;
      const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
      this.style.setProperty("--width", `${width}px`);
      this.style.setProperty("--height", `${height}px`);
      this.style.setProperty("--bg-width", `${14 * width}px`);
      this.style.setProperty("--bg-height", `${4 * height}px`);
      if (this.pass) return this.renderPass(themeUrl);
      if (this.card === void 0) return;
      const cardSprite = this.tiki ? "img/tiki-cards.png" : "img/tichu-cards.png";
      this.style.setProperty("--card-url", `url(${themeUrl}${cardSprite})`);
      const color = Number(this.card.type);
      const rank = Number(this.card.type_arg);
      this.style.setProperty("--x-pos", `${-1 * width * (rank - 1)}px`);
      this.style.setProperty("--y-pos", `${-1 * height * (color - 1)}px`);
      const tooltipText = this.getComputedTooltip();
      return x`<div
      id="card"
      class=${e6({
        card: true,
        stockitem: true,
        stockitem_selected: this.selected,
        selectable: this.selectable
      })}
      data-card-id=${this.card.id ?? ""}
      title=${tooltipText}
      @click=${this.onClick}
    ></div>`;
    }
    renderPass(themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "") {
      const passSprite = this.tiki ? "img/tiki-icons-pass.png" : "img/tichu-icons-pass.png";
      this.style.setProperty("--card-url", `url(${themeUrl}${passSprite})`);
      return x`<div
      id="card"
      class="card stockitem pass"
      data-card-id=""
      title=${this.getComputedTooltip()}
    ></div>`;
    }
    onClick(e7) {
      if (!this.selectable || !this.card) return;
      this.dispatchEvent(
        new CustomEvent("card-click", {
          detail: { card: this.card },
          bubbles: true,
          composed: true
        })
      );
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
  __decorateClass([
    n4({ type: Number })
  ], TichuCard.prototype, "scale", 2);
  __decorateClass([
    n4({ type: Boolean })
  ], TichuCard.prototype, "selected", 2);
  __decorateClass([
    n4({ type: Boolean })
  ], TichuCard.prototype, "selectable", 2);
  __decorateClass([
    n4({ type: Boolean })
  ], TichuCard.prototype, "tiki", 2);
  __decorateClass([
    n4({ type: String })
  ], TichuCard.prototype, "tooltip", 2);
  customElements.define("tichu-card", TichuCard);

  // src/elements/tichu-stock.ts
  function getWeightByRank(card) {
    const color = Number(card.type);
    const value = Number(card.type_arg);
    return 2 * (4 * (value - 1) + (color - 1));
  }
  function getWeightByColor(card) {
    const color = Number(card.type);
    const value = Number(card.type_arg);
    const type = (color - 1) * 14 + (value - 1);
    return value === 1 ? 2 * type : 100 + 2 * type;
  }
  var TichuStock = class extends i4 {
    constructor() {
      super(...arguments);
      this.cards = [];
      this.pass = false;
      this.scale = 1;
      this.tiki = false;
      this.sortMode = "rank";
      this.selectionMode = 0;
      this.selectedIds = [];
      this.dynamicOverlap = false;
      this.containerWidth = 0;
    }
    static get styles() {
      return [
        i`
        :host {
          display: block;
        }
        div#stock {
          display: flex;
          height: var(--stock-height, 150px);
        }
        div#stock.bomb {
          /* border-left: 15px solid red; */
        }
        tichu-card:not(:last-child) {
          margin-right: var(--card-margin-right, -75px);
        }
        tichu-card {
          zoom: 1;
        }
      `
      ];
    }
    connectedCallback() {
      super.connectedCallback();
      this.updateResizeObserver();
    }
    disconnectedCallback() {
      this.resizeObserver?.disconnect();
      this.resizeObserver = void 0;
      super.disconnectedCallback();
    }
    updated(changedProperties) {
      super.updated(changedProperties);
      if (changedProperties.has("dynamicOverlap")) {
        this.updateResizeObserver();
      }
    }
    updateResizeObserver() {
      if (this.dynamicOverlap && typeof ResizeObserver !== "undefined") {
        if (!this.resizeObserver) {
          this.resizeObserver = new ResizeObserver(() => {
            const w2 = this.clientWidth;
            if (w2 !== this.containerWidth) {
              this.containerWidth = w2;
            }
          });
          this.resizeObserver.observe(this);
        }
      } else {
        this.resizeObserver?.disconnect();
        this.resizeObserver = void 0;
      }
    }
    getSortedCards() {
      if (this.sortMode === "preserve") {
        return [...this.cards];
      }
      if (this.sortMode === "color") {
        return [...this.cards].sort((a3, b3) => getWeightByColor(a3) - getWeightByColor(b3));
      }
      return [...this.cards].sort((a3, b3) => getWeightByRank(a3) - getWeightByRank(b3));
    }
    computeMarginRightPx() {
      const itemWidth = 100 * this.scale;
      const itemMargin = 5;
      if (!this.dynamicOverlap) {
        return -75 * this.scale;
      }
      if (this.cards.length <= 1) {
        return 0;
      }
      const width = this.containerWidth || this.clientWidth || 600;
      const availableWidthForOverlapPerItem = (width - (itemWidth + itemMargin)) / (this.cards.length - 1);
      let overlap = Math.floor(
        (availableWidthForOverlapPerItem - itemMargin - 1) / itemWidth * 100
      );
      if (overlap > 60) overlap = 60;
      if (overlap < 12) overlap = 12;
      const step = Math.round(itemWidth * overlap / 100) + itemMargin;
      return step - itemWidth;
    }
    render() {
      const itemHeight = 150 * this.scale;
      const marginRight = this.computeMarginRightPx();
      this.style.setProperty("--stock-height", `${itemHeight}px`);
      this.style.setProperty("--card-margin-right", `${marginRight}px`);
      if (this.pass) return this.renderPass();
      const sortedCards = this.getSortedCards();
      const isSelectable = this.selectionMode > 0;
      const selectedSet = new Set(this.selectedIds.map((id) => String(id)));
      return x`
      <div
        id="stock"
        class=${e6({
        bomb: hasBomb(this.cards)
      })}
      >
        ${sortedCards.map(
        (card) => x`
            <tichu-card
              .card=${card}
              .scale=${this.scale}
              .tiki=${this.tiki}
              .selectable=${isSelectable}
              .selected=${isSelectable && selectedSet.has(String(card.id))}
              @card-click=${(e7) => this.onCardClick(e7, card)}
            ></tichu-card>
          `
      )}
      </div>
    `;
    }
    renderPass() {
      return x`<div id="stock">
      <tichu-card pass .scale=${this.scale} .tiki=${this.tiki}></tichu-card>
    </div>`;
    }
    onCardClick(e7, card) {
      e7.stopPropagation();
      if (this.selectionMode === 0) return;
      const cardId = String(card.id);
      const currentlySelected = this.selectedIds.map((id) => String(id));
      const isAlreadySelected = currentlySelected.includes(cardId);
      let nextSelectedIds;
      if (this.selectionMode === 1) {
        nextSelectedIds = isAlreadySelected ? [] : [cardId];
      } else {
        nextSelectedIds = isAlreadySelected ? currentlySelected.filter((id) => id !== cardId) : [...currentlySelected, cardId];
      }
      this.selectedIds = nextSelectedIds;
      this.dispatchEvent(
        new CustomEvent("selection-change", {
          detail: {
            selectedIds: nextSelectedIds,
            clickedCard: card
          },
          bubbles: true,
          composed: true
        })
      );
    }
    unselectAll() {
      this.selectedIds = [];
    }
    selectItem(id) {
      const strId = String(id);
      if (this.selectionMode === 1) {
        this.selectedIds = [strId];
      } else if (!this.selectedIds.includes(strId)) {
        this.selectedIds = [...this.selectedIds, strId];
      }
    }
    unselectItem(id) {
      const strId = String(id);
      this.selectedIds = this.selectedIds.filter((x2) => String(x2) !== strId);
    }
    getSelectedIds() {
      return [...this.selectedIds];
    }
    getSelectedCards() {
      const selectedSet = new Set(this.selectedIds.map((id) => String(id)));
      return this.cards.filter((c4) => selectedSet.has(String(c4.id)));
    }
  };
  __decorateClass([
    n4({ type: Array })
  ], TichuStock.prototype, "cards", 2);
  __decorateClass([
    n4({ type: Boolean })
  ], TichuStock.prototype, "pass", 2);
  __decorateClass([
    n4({ type: Number })
  ], TichuStock.prototype, "scale", 2);
  __decorateClass([
    n4({ type: Boolean })
  ], TichuStock.prototype, "tiki", 2);
  __decorateClass([
    n4({ type: String })
  ], TichuStock.prototype, "sortMode", 2);
  __decorateClass([
    n4({ type: Number })
  ], TichuStock.prototype, "selectionMode", 2);
  __decorateClass([
    n4({ type: Array })
  ], TichuStock.prototype, "selectedIds", 2);
  __decorateClass([
    n4({ type: Boolean })
  ], TichuStock.prototype, "dynamicOverlap", 2);
  __decorateClass([
    r5()
  ], TichuStock.prototype, "containerWidth", 2);
  customElements.define("tichu-stock", TichuStock);

  // src/elements/subscription-controller.ts
  function subscribe(host, provider, callback) {
    host.addController(new SubscriptionController(provider, callback));
  }
  var SubscriptionController = class {
    constructor(provider, callback) {
      this.provider = provider;
      this.callback = callback;
    }
    hostConnected() {
      this.sub?.unsubscribe();
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
  var TichuPlayer = class extends i4 {
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
    r5()
  ], TichuPlayer.prototype, "hand", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "combo", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "isLastComboPlayer", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "name", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "points", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "active", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "bet", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "player", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "passedToPrevious", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "passedToPartner", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "passedToNext", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "previousHand", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "partnerHand", 2);
  __decorateClass([
    r5()
  ], TichuPlayer.prototype, "nextHand", 2);
  customElements.define("tichu-player", TichuPlayer);

  // src/elements/tichu-score-board.ts
  var TichuScoreBoard = class extends i4 {
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
        ${this.renderTitle()} ${this.board.rounds.map((r6) => this.renderRound(r6))}
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
    renderRound(r6) {
      return x`
      <tr
        class=${e6({
        round: true,
        current: r6.round === this.round
      })}
      >
        <td>${r6.round}</td>
        ${r6.scores.slice(0, 2).map((s4) => x`<td>${s4.roundPoints}</td>`)}
        ${r6.scores.slice(0, 2).map((s4) => x`<td>${s4.gamePoints}</td>`)}
      </tr>
    `;
    }
  };
  __decorateClass([
    n4({ type: Object })
  ], TichuScoreBoard.prototype, "board", 2);
  __decorateClass([
    r5()
  ], TichuScoreBoard.prototype, "names", 2);
  __decorateClass([
    r5()
  ], TichuScoreBoard.prototype, "round", 2);
  customElements.define("tichu-score-board", TichuScoreBoard);

  // src/elements/tichu-replay.ts
  var fakeGamelogs = [];
  var fakePlayers = {};
  var TichuReplay = class extends i4 {
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
      const next = this.notifs.find((n5, i6) => i6 >= this.notifIndex && !isIgnored(n5));
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
    r5()
  ], TichuReplay.prototype, "wish", 2);
  __decorateClass([
    r5()
  ], TichuReplay.prototype, "playerIds", 2);
  __decorateClass([
    r5()
  ], TichuReplay.prototype, "notifIndex", 2);
  __decorateClass([
    r5()
  ], TichuReplay.prototype, "ignoredNotifType", 2);
  __decorateClass([
    r5()
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
  function swap(gamelogs, i6, j2) {
    if (!gamelogs[i6]) return;
    if (!gamelogs[j2]) return;
    const temp = gamelogs[i6];
    gamelogs[i6] = gamelogs[j2];
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
  var styles = i`
  :host {
    --border-radius: 6px;
    --elevation: 0px 1px 2px 0px rgba(60, 64, 67, 0.3), 0px 1px 3px 1px rgba(60, 64, 67, 0.15);
    color: #1f2328;
    font-family: Roboto, Arial, sans-serif;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  h3 {
    margin: 0;
    padding: 0;
    font-size: 20px;
    font-weight: 700;
    color: #1f2328;
  }

  a {
    color: #2b579a;
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }

  .theme0 {
    --bg-color-html: rgba(0, 0, 0, 0.3);
    --bg-color-play-area: rgba(255, 255, 255, 0.3);
    --bg-color-lighter: rgba(246, 231, 212, 0.8);
  }
  .theme1 {
    --bg-color-html: hsl(225 35% 15% / 1);
    --bg-color-play-area: hsl(225 20% 65% / 1);
    --bg-color-lighter: hsl(225 30% 90% / 1);
  }
  .theme2 {
    --bg-color-html: hsl(203 37% 20% / 1);
    --bg-color-play-area: hsl(50 15% 60% / 1);
    --bg-color-lighter: hsl(50 10% 80% / 1);
  }
  .theme3 {
    --bg-color-html: hsl(352 71% 25% / 1);
    --bg-color-play-area: hsl(342 56% 76% / 1);
    --bg-color-lighter: hsl(32 66% 90% / 1);
  }
  .theme4 {
    --bg-color-html: transparent;
    --bg-color-play-area: rgba(255, 255, 255, 0.3);
    --bg-color-lighter: rgba(255, 255, 255, 0.7);
  }
  .theme5 {
    --bg-color-html: hsl(0 0% 25% / 1);
    --bg-color-play-area: hsl(355 45% 50% / 1);
    --bg-color-lighter: hsl(40 100% 86% / 1);
    --bg-color-active: rgba(255, 155, 0, 0.8);
  }
  .theme6 {
    --bg-color-html: hsl(0 0% 20% / 1);
    --bg-color-play-area: hsl(0 0% 70% / 1);
    --bg-color-lighter: hsl(0 0% 90% / 1);
  }
  .theme7 {
    --bg-color-html: hsl(216, 69%, 20%);
    --bg-color-play-area: hsl(32, 43%, 75%);
    --bg-color-lighter: hsl(35, 58%, 94%);
  }
  .theme8 {
    --bg-color-html: hsl(222, 38%, 9%);
    --bg-color-play-area: hsl(212, 8%, 64%);
    --bg-color-lighter: hsl(41, 70%, 85%);
  }
  .theme9 {
    --bg-color-html: hsl(33 53% 25% / 1);
    --bg-color-play-area: hsl(33 40% 64% / 1);
    --bg-color-lighter: hsl(33 68% 85% / 1);
  }
  .theme10 {
    --bg-color-html: hsl(91, 23%, 26%);
    --bg-color-play-area: hsl(87, 24%, 61%);
    --bg-color-lighter: hsl(35, 69%, 94%);
  }

  .bgabutton {
    display: inline-block;
    padding: 6px 12px;
    font-size: 14px;
    font-weight: 700;
    line-height: 16px;
    border-radius: 6px;
    cursor: pointer;
    text-decoration: none !important;
    user-select: none;
    border: 1px solid rgba(0, 0, 0, 0.25);
    box-shadow: 0 1px 0 #000;
    text-shadow: rgba(0, 0, 0, 0.4) 0 1px 0;
    vertical-align: middle;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition:
      filter 0.12s ease,
      transform 0.06s ease;
  }
  .bgabutton:hover {
    filter: brightness(1.07);
    text-decoration: none !important;
  }
  .bgabutton:active {
    transform: translateY(1px);
  }
  .bgabutton_blue,
  .bgabutton_primary {
    color: #ffffff !important;
    background: linear-gradient(180deg, #4871b6 0%, #3b5f9c 100%);
    border-color: #2f4d80;
  }
  .bgabutton_red,
  .bgabutton_alert {
    color: #ffffff !important;
    background: linear-gradient(180deg, #c92727 0%, #b01e1e 100%);
    border-color: #8f1616;
  }
  .bgabutton_green {
    color: #ffffff !important;
    background: linear-gradient(180deg, #89a538 0%, #748d2d 100%);
    border-color: #5d7223;
  }
  .bgabutton_gray,
  .bgabutton_secondary {
    color: #1f2328 !important;
    background: linear-gradient(180deg, #e5e7eb 0%, #d1d5db 100%);
    border-color: #9ca3af;
  }

  .stockitem {
    border-radius: var(--border-radius, 6px);
    box-shadow: 2px 2px 5px 3px #666;
  }
  .stockitem.stockitem_selected {
    border: 1px solid #dda !important;
    box-shadow: 0px 0px 4px 1px #ff8;
    translate: 0 -20px;
  }

  .disabler {
    display: none;
    position: absolute;
    background: rgba(100, 100, 100, 0.6);
    border-radius: var(--border-radius, 6px);
    left: -4px;
    right: -4px;
    top: -4px;
    bottom: -4px;
    z-index: 10;
  }

  .icon {
    display: none;
    background-image: var(--icon-url);
    background-repeat: no-repeat;
  }
  .icon.star {
    background-size: 128px 64px;
    background-position: -112px -16px;
    width: 16px;
    height: 16px;
    display: inline-block;
  }
  .icon.hand {
    background-size: 128px 64px;
    background-position: -112px 0px;
    width: 16px;
    height: 16px;
    display: inline-block;
  }
  .icon.firstoutcolor {
    background-size: 128px 64px;
    background-position: -64px -32px;
    width: 16px;
    height: 32px;
  }
  .icon.grandtichublack {
    background-size: 128px 64px;
    background-position: 0px 0px;
    width: 32px;
    height: 32px;
  }
  .icon.grandtichucolor {
    background-size: 128px 64px;
    background-position: 0px -32px;
    width: 32px;
    height: 32px;
  }
  .icon.tichublack {
    background-size: 128px 64px;
    background-position: -32px 0px;
    width: 32px;
    height: 32px;
  }
  .icon.tichucolor {
    background-size: 128px 64px;
    background-position: -32px -32px;
    width: 26px;
    height: 26px;
  }
  .icon.big.grandtichublack {
    background-size: 256px 128px;
    background-position: 0px 0px;
    width: 64px;
    height: 64px;
  }
  .icon.big.grandtichucolor {
    background-size: 256px 128px;
    background-position: 0px -64px;
    width: 64px;
    height: 64px;
  }
  .icon.big.tichublack {
    background-size: 256px 128px;
    background-position: -64px 0px;
    width: 64px;
    height: 64px;
  }
  .icon.big.tichucolor {
    background-size: 256px 128px;
    background-position: -64px -64px;
    width: 62.4px;
    height: 62.4px;
  }
  .icon.temp {
    position: absolute;
    display: block;
    left: calc(50% - 128px);
    top: calc(50% - 128px);
    z-index: 100;
    pointer-events: none;
    transition: opacity 1s ease;
  }
  .icon.temp.fading-out {
    opacity: 0;
  }
  .icon.temp.grandtichublack,
  .icon.temp.grand-tichu-black {
    background-size: 1024px 512px;
    background-position: 0px 0px;
    width: 256px;
    height: 256px;
  }
  .icon.temp.grandtichucolor,
  .icon.temp.grand-tichu-color {
    background-size: 1024px 512px;
    background-position: 0px -256px;
    width: 256px;
    height: 256px;
  }
  .icon.temp.tichublack,
  .icon.temp.tichu-black {
    background-size: 1024px 512px;
    background-position: -256px 0px;
    width: 256px;
    height: 256px;
  }
  .icon.temp.tichucolor,
  .icon.temp.tichu-color {
    background-size: 1024px 512px;
    background-position: -256px -256px;
    width: 208px;
    height: 208px;
  }
  .icon.cardback {
    background-size: 128px 64px;
    background-position: -90px 0px;
    width: 22px;
    height: 32px;
  }
`;

  // src/elements/tichu-status.ts
  var TichuStatus = class extends i4 {
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

  // src/elements/tichu-player-panel.ts
  var t4 = (s4) => typeof _ === "function" ? _(s4) : s4;
  var TichuPlayerPanel = class extends i4 {
    constructor() {
      super();
      this.playerId = "";
      this.players = {};
      this.firstOutPlayerId = "";
      subscribe(
        this,
        () => window.gameModel.players$,
        (players) => {
          this.players = players;
          this.player = players[String(this.playerId)];
        }
      );
      subscribe(
        this,
        () => window.gameModel.firstOutPlayerId$,
        (firstOutPlayerId) => {
          this.firstOutPlayerId = firstOutPlayerId;
        }
      );
    }
    static get styles() {
      return [
        styles,
        i`
        :host {
          display: block;
          clear: both;
        }
        .ha_board {
          clear: both;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 4px;
          padding-top: 4px;
          font-weight: 600;
          color: #1f2328;
        }
        .ha_board .count {
          margin-right: 8px;
        }
      `
      ];
    }
    willUpdate(changedProperties) {
      if (changedProperties.has("playerId")) {
        this.player = this.players[String(this.playerId)];
      }
    }
    render() {
      const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
      this.style.setProperty("--icon-url", `url(${themeUrl}img/tichu-icons.png)`);
      const id = String(this.playerId);
      const p3 = this.player ?? this.players[id];
      const handcount = p3?.handcount ?? 0;
      const capturedPoints = p3?.capturedPoints ?? 0;
      const showGrandTichuColor = p3?.callGrandTichu === 200;
      const showGrandTichuBlack = p3?.callGrandTichu === -1;
      const showTichuColor = p3?.callTichu === 100;
      const showTichuBlack = p3?.callTichu === -1 && !showGrandTichuColor;
      const isFirstOut = Boolean(id) && this.firstOutPlayerId === id;
      const isPassReady = Boolean(p3?.passedCardReady);
      return x`
      <div class="ha_board">
        <div class="icon hand" title=${t4("Number of cards in hand")}></div>
        &#x00D7;<span
          id="handcount_${id}"
          class="count handcount ${id}"
          title=${t4("Number of cards in hand")}
          >${handcount}</span
        >
        <div class="icon star" title=${t4("Points captured in this round")}></div>
        &#x00D7;<span
          id="pointcount_${id}"
          class="count pointcount ${id}"
          title=${t4("Points captured in this round")}
          >${capturedPoints}</span
        >
        <div
          id="grandtichublack_${id}"
          class="icon grandtichublack ${id}"
          style="display: ${showGrandTichuBlack ? "inline-block" : "none"}"
          title=${t4("Grand Tichu bet")}
        ></div>
        <div
          id="grandtichucolor_${id}"
          class="icon grandtichucolor ${id}"
          style="display: ${showGrandTichuColor ? "inline-block" : "none"}"
          title=${t4("Grand Tichu bet")}
        ></div>
        <div
          id="tichublack_${id}"
          class="icon tichublack ${id}"
          style="display: ${showTichuBlack ? "inline-block" : "none"}"
          title=${t4("Tichu bet")}
        ></div>
        <div
          id="tichucolor_${id}"
          class="icon tichucolor ${id}"
          style="display: ${showTichuColor ? "inline-block" : "none"}"
          title=${t4("Tichu bet")}
        ></div>
        <div
          id="firstoutcolor_${id}"
          class="icon firstoutcolor ${id}"
          style="display: ${isFirstOut ? "inline-block" : "none"}"
          title=${t4("First player to go out")}
        ></div>
        <div
          id="cardback_${id}"
          class="icon cardback ${id}"
          style="display: ${isPassReady ? "inline-block" : "none"}"
          title=${t4("has passed")}
        ></div>
      </div>
    `;
    }
  };
  __decorateClass([
    n4({ type: String })
  ], TichuPlayerPanel.prototype, "playerId", 2);
  __decorateClass([
    r5()
  ], TichuPlayerPanel.prototype, "players", 2);
  __decorateClass([
    r5()
  ], TichuPlayerPanel.prototype, "player", 2);
  __decorateClass([
    r5()
  ], TichuPlayerPanel.prototype, "firstOutPlayerId", 2);
  customElements.define("tichu-player-panel", TichuPlayerPanel);

  // src/elements/tichu-value-choice.ts
  var t5 = (s4) => typeof _ === "function" ? _(s4) : s4;
  var MAHJONG_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  var TichuValueChoice = class extends i4 {
    constructor() {
      super();
      this.mode = "mahjong";
      this.stateName = "";
      this.isCurrentPlayerActive = false;
      this.selectedMahjongWish = null;
      this.phoenixAllowedValues = [];
      this.selectedPhoenixValue = null;
      subscribe(
        this,
        () => window.gameModel.stateName$,
        (stateName) => this.stateName = stateName
      );
      subscribe(
        this,
        () => window.gameModel.isCurrentPlayerActive$,
        (active) => this.isCurrentPlayerActive = active
      );
      subscribe(
        this,
        () => window.gameModel.selectedMahjongWish$,
        (wish) => this.selectedMahjongWish = wish
      );
      subscribe(
        this,
        () => window.gameModel.phoenixAllowedValues$,
        (vals) => this.phoenixAllowedValues = vals
      );
      subscribe(
        this,
        () => window.gameModel.selectedPhoenixValue$,
        (val) => this.selectedPhoenixValue = val
      );
    }
    static get styles() {
      return [
        styles,
        i`
        :host {
          display: block;
        }
        #mahjongpanel,
        #phoenixpanel {
          margin: 0px 15px 15px 15px;
          padding: 15px;
          background: var(--bg-color-lighter);
          border-radius: var(--border-radius);
          box-shadow: var(--elevation);
        }
        #mahjongpanel h3,
        #phoenixpanel h3 {
          margin-bottom: 15px;
          font-size: 20px;
        }
        #mahjong,
        #mahjongvalues,
        #phoenixChoice,
        #phoenixvalues {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          min-height: 105px;
        }
        .stockitem {
          width: 70px;
          height: 105px;
          background-image: var(--table-icons-url);
          background-repeat: no-repeat;
          border-radius: var(--border-radius);
          box-shadow: 2px 2px 5px 3px #666;
          cursor: pointer;
          position: relative;
          user-select: none;
        }
      `
      ];
    }
    render() {
      const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
      this.style.setProperty("--table-icons-url", `url(${themeUrl}img/tichu-icons-table.png)`);
      if (this.mode === "phoenix") {
        return this.renderPhoenix();
      }
      return this.renderMahjong();
    }
    renderMahjong() {
      const isVisible = this.stateName === "mahjongPlay" && this.isCurrentPlayerActive;
      return x`
      <div id="mahjongpanel" class="whiteblock" style="display: ${isVisible ? "block" : "none"}">
        <h3>${t5("Mahjong Wish")}</h3>
        <div id="mahjong" class="mahjongvalues">
          ${MAHJONG_VALUES.map((val) => {
        const idx = val - 2;
        const col = idx % 7;
        const row = Math.floor(idx / 7);
        const isSelected = this.selectedMahjongWish === val;
        return x`
              <div
                id="mahjong_item_${val}"
                data-value="${val}"
                class=${e6({
          stockitem: true,
          stockitem_selected: isSelected
        })}
                style="background-position: -${col * 70}px -${row * 105}px"
                @click=${() => this.onMahjongClick(val)}
              ></div>
            `;
      })}
        </div>
      </div>
    `;
    }
    renderPhoenix() {
      const isVisible = this.stateName === "phoenixPlay" && this.isCurrentPlayerActive;
      return x`
      <div id="phoenixpanel" class="whiteblock" style="display: ${isVisible ? "block" : "none"}">
        <h3>${t5("Phoenix Choice")}</h3>
        <div id="phoenixChoice" class="phoenixvalues">
          ${this.phoenixAllowedValues.map((val) => {
        const idx = val - 2;
        const col = idx % 7;
        const row = Math.floor(idx / 7);
        const isSelected = this.selectedPhoenixValue === val;
        return x`
              <div
                id="phoenixChoice_item_${val}"
                data-value="${val}"
                class=${e6({
          stockitem: true,
          stockitem_selected: isSelected
        })}
                style="background-position: -${col * 70}px -${row * 105}px"
                @click=${() => this.onPhoenixClick(val)}
              ></div>
            `;
      })}
        </div>
      </div>
    `;
    }
    onMahjongClick(val) {
      const next = this.selectedMahjongWish === val ? null : val;
      window.gameModel.setSelectedMahjongWish(next);
    }
    onPhoenixClick(val) {
      const next = this.selectedPhoenixValue === val ? null : val;
      window.gameModel.setSelectedPhoenixValue(next);
    }
  };
  __decorateClass([
    n4({ type: String })
  ], TichuValueChoice.prototype, "mode", 2);
  __decorateClass([
    r5()
  ], TichuValueChoice.prototype, "stateName", 2);
  __decorateClass([
    r5()
  ], TichuValueChoice.prototype, "isCurrentPlayerActive", 2);
  __decorateClass([
    r5()
  ], TichuValueChoice.prototype, "selectedMahjongWish", 2);
  __decorateClass([
    r5()
  ], TichuValueChoice.prototype, "phoenixAllowedValues", 2);
  __decorateClass([
    r5()
  ], TichuValueChoice.prototype, "selectedPhoenixValue", 2);
  customElements.define("tichu-value-choice", TichuValueChoice);

  // src/elements/tichu-last-played.ts
  var t6 = (s4) => typeof _ === "function" ? _(s4) : s4;
  var POSITIONS = ["bottom", "right", "top", "left"];
  var TichuLastPlayed = class extends i4 {
    constructor() {
      super();
      this.playerOrderBottomToLeft = [];
      this.players = {};
      this.lastCombos = {};
      this.lastComboPlayerId = "";
      this.activePlayerId = "";
      this.bombActivePlayerId = null;
      this.stateName = "";
      this.mahjongWish = 0;
      this.isTiki = false;
      this.clockwise = true;
      this.squareTable = false;
      this.firstOutPlayerId = "";
      this.round = 0;
      this.trick = 0;
      this.currentTrickValue = 0;
      this.currentTrick = [];
      subscribe(
        this,
        () => window.gameModel.playerOrderBottomToLeft$,
        (order) => this.playerOrderBottomToLeft = order
      );
      subscribe(
        this,
        () => window.gameModel.players$,
        (players) => this.players = players
      );
      subscribe(
        this,
        () => window.gameModel.lastCombos$,
        (combos) => this.lastCombos = combos
      );
      subscribe(
        this,
        () => window.gameModel.lastComboPlayerId$,
        (id) => this.lastComboPlayerId = id
      );
      subscribe(
        this,
        () => window.gameModel.activePlayerId$,
        (id) => this.activePlayerId = id
      );
      subscribe(
        this,
        () => window.gameModel.bombActivePlayerId$,
        (id) => this.bombActivePlayerId = id
      );
      subscribe(
        this,
        () => window.gameModel.stateName$,
        (name) => this.stateName = name
      );
      subscribe(
        this,
        () => window.gameModel.mahjongWish$,
        (wish) => this.mahjongWish = wish
      );
      subscribe(
        this,
        () => window.gameModel.isTiki$,
        (isTiki) => this.isTiki = isTiki
      );
      subscribe(
        this,
        () => window.gameModel.clockwise$,
        (clockwise) => this.clockwise = clockwise
      );
      subscribe(
        this,
        () => window.gameModel.squareTable$,
        (squareTable) => this.squareTable = squareTable
      );
      subscribe(
        this,
        () => window.gameModel.firstOutPlayerId$,
        (id) => this.firstOutPlayerId = id
      );
      subscribe(
        this,
        () => window.gameModel.round$,
        (round) => this.round = round
      );
      subscribe(
        this,
        () => window.gameModel.trick$,
        (trick) => this.trick = trick
      );
      subscribe(
        this,
        () => window.gameModel.currentTrickValue$,
        (val) => this.currentTrickValue = val
      );
      subscribe(
        this,
        () => window.gameModel.currentTrick$,
        (cards) => this.currentTrick = cards
      );
    }
    static get styles() {
      return [
        styles,
        i`
        :host {
          display: block;
        }
        #card-last-played-area {
          display: grid;
          padding: 0px 15px 15px 15px;
          grid-gap: 10px;
          grid-template-columns: 2fr 1fr;
          grid-template-rows: 1fr 1fr 1fr 1fr;
        }
        #card-last-played-area .top {
          grid-column: 1 / span 1;
          grid-row: 3 / span 1;
        }
        #card-last-played-area .left {
          grid-column: 1 / span 1;
          grid-row: 4 / span 1;
        }
        #card-last-played-area .right {
          grid-column: 1 / span 1;
          grid-row: 2 / span 1;
        }
        #card-last-played-area .bottom {
          grid-column: 1 / span 1;
          grid-row: 1 / span 1;
        }
        #card-last-played-area #mahjongIndicator {
          grid-column: 2 / span 1;
          grid-row: 2 / span 1;
          place-self: center;
        }
        #card-last-played-area tichu-status {
          grid-column: 2 / span 1;
          grid-row: 1 / span 1;
          place-self: start end;
          text-align: right;
          font-size: 20px;
        }

        #card-last-played-area.squareTable {
          grid-template-columns:
            minmax(200px, 2.5fr)
            minmax(200px, 2fr)
            minmax(20px, 1fr)
            minmax(200px, 2fr)
            minmax(200px, 2.5fr);
          grid-template-rows: 1fr 1fr 1fr;
        }
        #card-last-played-area.squareTable .top {
          grid-column: 2 / span 3;
          grid-row: 1 / span 1;
        }
        #card-last-played-area.squareTable .left {
          grid-column: 1 / span 2;
          grid-row: 2 / span 1;
        }
        #card-last-played-area.clockwise.squareTable .left {
          grid-column: 4 / span 2;
        }
        #card-last-played-area.squareTable .right {
          grid-column: 4 / span 2;
          grid-row: 2 / span 1;
        }
        #card-last-played-area.clockwise.squareTable .right {
          grid-column: 1 / span 2;
        }
        #card-last-played-area.squareTable .bottom {
          grid-column: 2 / span 3;
          grid-row: 3 / span 1;
        }
        #card-last-played-area.squareTable #mahjongIndicator {
          grid-column: 1 / span 1;
          grid-row: 1 / span 1;
        }
        #card-last-played-area.squareTable tichu-status {
          grid-column: 5 / span 1;
          grid-row: 1 / span 1;
        }

        .player-table {
          position: relative;
          border-radius: var(--border-radius);
          box-shadow: var(--elevation);
        }
        .player-table.disabled:not(.lastComboPlayer) .disabler {
          display: block;
        }

        .player-table > .whiteblock {
          display: flex;
          line-height: 24px;
          font-size: 20px;
          font-weight: bold;
          border: 4px solid transparent;
          padding: 6px;
          background: var(--bg-color-lighter);
          border-radius: var(--border-radius);
          min-height: 128px;
        }
        .player-table > .whiteblock.active,
        .player-table > .whiteblock.bomb {
          border: 4px solid var(--bg-color-active);
        }

        .last-played-player {
          width: 140px;
          padding-right: 10px;
          flex-shrink: 0;
        }
        .last-played-player h3.playertablename {
          font-size: 20px;
          font-weight: bold;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
        }
        .combo-description {
          display: block;
          font-size: 12px;
          font-weight: normal;
          color: #444;
          line-height: 16px;
        }
        .combo-description:empty {
          display: none;
        }
        .last-played-player .last-played-icons {
          top: 2px;
        }
        .last-played-player .last-played-icons .count {
          display: inline-block;
          width: 40px;
        }
        .lastcombo {
          width: 300px;
          flex-grow: 1;
        }

        #mahjongIndicator {
          display: none;
          width: 75px;
          height: 112.5px;
          background-image: var(--mahjong-bg-url);
          background-size: 75px 112.5px;
          border-radius: var(--border-radius);
        }
        #mahjongIndicator.visible {
          display: block;
        }
        .tiki #mahjongIndicator {
          background-image: var(--tiki-mahjong-bg-url);
        }
        .mahjong {
          width: 75px;
          height: 112.5px;
          background-image: var(--table-icons-url);
          background-size: 600px 225px;
          background-color: rgba(255, 255, 255, 0.5);
          border-radius: var(--border-radius);
        }
      `
      ];
    }
    render() {
      const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
      this.style.setProperty("--icon-url", `url(${themeUrl}img/tichu-icons.png)`);
      this.style.setProperty("--table-icons-url", `url(${themeUrl}img/tichu-icons-table.png)`);
      this.style.setProperty("--mahjong-bg-url", `url(${themeUrl}img/tichu-mahjong.png)`);
      this.style.setProperty("--tiki-mahjong-bg-url", `url(${themeUrl}img/tiki-tichu-mahjong.png)`);
      const isPassState = this.stateName === "giveCards" || this.stateName === "showPassedCards" || this.stateName === "acceptPassedCards";
      const wishVisible = this.mahjongWish >= 2 && this.mahjongWish <= 14;
      const wishIdx = wishVisible ? this.mahjongWish - 2 : 0;
      const wishCol = wishIdx % 7;
      const wishRow = Math.floor(wishIdx / 7);
      return x`
      <div
        id="card-last-played-area"
        class=${e6({
        squareTable: this.squareTable,
        clockwise: this.clockwise,
        tiki: this.isTiki
      })}
        style="display: ${isPassState ? "none" : "grid"}"
      >
        ${POSITIONS.map((pos, idx) => this.renderPlayerArea(pos, this.playerOrderBottomToLeft[idx]))}

        <div
          id="mahjongIndicator"
          class=${e6({ visible: wishVisible })}
          style="display: ${wishVisible ? "block" : "none"};"
        >
          ${wishVisible ? x`<div
                  class="mahjong"
                  id="mahjong_${this.mahjongWish}"
                  style="background-position: -${wishCol * 75}px -${wishRow * 112.5}px"
                ></div>` : ""}
        </div>

        <tichu-status
          roundCount=${this.round}
          trickCount=${this.trick}
          trickPoints=${this.currentTrickValue}
          trickSize=${this.currentTrick.length}
          .roundCount=${this.round}
          .trickCount=${this.trick}
          .trickPoints=${this.currentTrickValue}
          .trickSize=${this.currentTrick.length}
          @show-current-trick=${this.onShowCurrentTrick}
        ></tichu-status>
      </div>
    `;
    }
    renderPlayerArea(pos, playerId) {
      if (!playerId) return "";
      const id = String(playerId);
      const player = this.players[id];
      if (!player) return "";
      const combo = this.lastCombos[id] ?? { cards: [], description: "", passed: false };
      const isLastComboPlayer = Boolean(this.lastComboPlayerId) && this.lastComboPlayerId !== "0" && String(this.lastComboPlayerId) === id;
      const isDisabled = player.handcount === 0 && this.stateName !== "newRound" && this.stateName !== "endRound";
      const isDisablerVisible = isDisabled && !isLastComboPlayer;
      const bombTargetId = this.bombActivePlayerId || this.activePlayerId;
      const isBombActive = this.stateName === "playBomb" && Boolean(bombTargetId) && String(bombTargetId) === id;
      const isActive = !isBombActive && (this.stateName === "playComboOpen" || this.stateName === "playCombo" || this.stateName === "confirmTrick") && Boolean(this.activePlayerId) && String(this.activePlayerId) === id;
      const showGrandTichuColor = player.callGrandTichu === 200;
      const showGrandTichuBlack = player.callGrandTichu === -1;
      const showTichuColor = player.callTichu === 100;
      const showTichuBlack = player.callTichu === -1 && !showGrandTichuColor;
      const isFirstOut = Boolean(id) && this.firstOutPlayerId === id;
      const translatedDesc = combo.description ? t6(combo.description) : "";
      return x`
      <div
        class=${e6({
        "player-table": true,
        "last-played-container": true,
        [pos]: true,
        disabled: isDisabled,
        lastComboPlayer: isLastComboPlayer,
        active: isActive,
        bomb: isBombActive
      })}
        id="playertable_${id}"
        title=${translatedDesc}
      >
        <div class="disabler" style="display: ${isDisablerVisible ? "block" : "none"}"></div>
        <div
          class=${e6({
        whiteblock: true,
        active: isActive,
        bomb: isBombActive
      })}
        >
          <div class="last-played-player">
            <h3 class="playertablename" style="color: #${player.color}">
              <span class="player-name-text">${player.name}</span>
              <span id="combo_${id}" class="combo-description">${translatedDesc}</span>
            </h3>
            <div class="last-played-icons">
              <div
                class="icon hand"
                id="icon_hand_${id}"
                title=${t6("Number of cards in hand")}
              ></div>
              <div class="count handcount ${id}">${player.handcount}</div>
              <div
                class="icon star"
                id="icon_star_${id}"
                title=${t6("Points captured in this round")}
              ></div>
              <div class="count pointcount ${id}">${player.capturedPoints}</div>
            </div>
            <div class="icons">
              <div
                id="grandtichublack_${id}"
                class="icon grandtichublack ${id}"
                style="display: ${showGrandTichuBlack ? "inline-block" : "none"}"
                title=${t6("Grand Tichu bet")}
              ></div>
              <div
                id="grandtichucolor_${id}"
                class="icon big grandtichucolor ${id}"
                style="display: ${showGrandTichuColor ? "inline-block" : "none"}"
                title=${t6("Grand Tichu bet")}
              ></div>
              <div
                id="tichublack_${id}"
                class="icon tichublack ${id}"
                style="display: ${showTichuBlack ? "inline-block" : "none"}"
                title=${t6("Tichu bet")}
              ></div>
              <div
                id="tichucolor_${id}"
                class="icon big tichucolor ${id}"
                style="display: ${showTichuColor ? "inline-block" : "none"}"
                title=${t6("Tichu bet")}
              ></div>
              <div
                id="firstoutcolor_${id}"
                class="icon firstoutcolor ${id}"
                style="display: ${isFirstOut ? "inline-block" : "none"}"
                title=${t6("First player to go out")}
              ></div>
            </div>
          </div>
          <div id="lastcombo_${id}" class="lastcombo last-played-combo">
            ${combo.passed ? x`<span class="pass"
                    ><tichu-stock
                      .cards=${[]}
                      .pass=${true}
                      .scale=${0.75}
                      .tiki=${this.isTiki}
                    ></tichu-stock
                  ></span>` : x`<tichu-stock
                    .cards=${combo.cards}
                    .scale=${0.75}
                    sortMode="preserve"
                    .tiki=${this.isTiki}
                    .dynamicOverlap=${true}
                  ></tichu-stock>`}
          </div>
        </div>
      </div>
    `;
    }
    onShowCurrentTrick() {
      window.gameModel.setTrickModalOpen(true);
    }
  };
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "playerOrderBottomToLeft", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "players", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "lastCombos", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "lastComboPlayerId", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "activePlayerId", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "bombActivePlayerId", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "stateName", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "mahjongWish", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "isTiki", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "clockwise", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "squareTable", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "firstOutPlayerId", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "round", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "trick", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "currentTrickValue", 2);
  __decorateClass([
    r5()
  ], TichuLastPlayed.prototype, "currentTrick", 2);
  customElements.define("tichu-last-played", TichuLastPlayed);

  // src/elements/tichu-pass-area.ts
  var t7 = (s4) => typeof _ === "function" ? _(s4) : s4;
  var TichuPassArea = class extends i4 {
    constructor() {
      super();
      this.stateName = "";
      this.isSpectator = false;
      this.isCurrentPlayerActive = false;
      this.passSlots = [];
      this.players = {};
      this.isTiki = false;
      this.clockwise = true;
      subscribe(
        this,
        () => window.gameModel.stateName$,
        (stateName) => this.stateName = stateName
      );
      subscribe(
        this,
        () => window.gameModel.isSpectator$,
        (isSpectator) => this.isSpectator = isSpectator
      );
      subscribe(
        this,
        () => window.gameModel.isCurrentPlayerActive$,
        (active) => this.isCurrentPlayerActive = active
      );
      subscribe(
        this,
        () => window.gameModel.passSlots$,
        (slots) => this.passSlots = slots
      );
      subscribe(
        this,
        () => window.gameModel.players$,
        (players) => this.players = players
      );
      subscribe(
        this,
        () => window.gameModel.isTiki$,
        (isTiki) => this.isTiki = isTiki
      );
      subscribe(
        this,
        () => window.gameModel.clockwise$,
        (clockwise) => this.clockwise = clockwise
      );
    }
    static get styles() {
      return [
        styles,
        i`
        :host {
          display: block;
        }
        #playertables {
          width: 560px;
          margin: 0 auto;
          display: none;
          justify-content: space-evenly;
          flex-direction: row;
        }
        #playertables.visible {
          display: flex;
        }
        #playertables.clockwise {
          flex-direction: row-reverse;
        }
        #playertables .playertable {
          position: relative;
          text-align: center;
          width: 140px;
          height: 210px;
          border-radius: var(--border-radius);
          background: var(--bg-color-lighter);
          box-shadow: var(--elevation);
          padding: 10px;
          margin: 10px 0;
        }
        #playertables.giveCards.active .playertable {
          cursor: pointer;
        }
        #playertables .playertable_1,
        #playertables .playertable_3 {
          margin: 50px 0px 25px 0px;
        }
        #playertables .playertablename {
          font-weight: bold;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-bottom: 10px;
        }
        .playertablecard {
          position: relative;
          width: 120px;
          height: 155px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .playertablebackground {
          position: absolute;
          inset: 0;
          width: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
        }
        .playertablebackground .tichubets {
          min-height: 20px;
          margin-bottom: 10px;
        }
        .playertabletext {
          display: none;
          font-size: 13px;
          color: #1f2328;
        }
        #playertables.giveCards.active .playertabletext {
          display: block;
        }
        tichu-card.given-card,
        tichu-card.received-card {
          position: relative;
          z-index: 1;
          transition:
            transform 0.5s ease-in-out,
            opacity 0.5s ease-in-out;
        }
        tichu-card.slide-out {
          transform: translateY(-60px);
          opacity: 0;
        }
        tichu-card.slide-to-hand {
          transform: translateY(160px);
          opacity: 0;
        }
      `
      ];
    }
    render() {
      const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
      this.style.setProperty("--icon-url", `url(${themeUrl}img/tichu-icons.png)`);
      const hasPendingPassCards = this.passSlots.some(
        (s4) => s4.givenCard !== null || s4.receivedCard !== null || s4.animatingAccept
      );
      const isVisible = !this.isSpectator && (this.stateName === "giveCards" || this.stateName === "showPassedCards" || this.stateName === "acceptPassedCards" || hasPendingPassCards);
      return x`
      <div
        id="playertables"
        class=${e6({
        visible: isVisible,
        clockwise: this.clockwise,
        giveCards: this.stateName === "giveCards",
        active: this.isCurrentPlayerActive
      })}
        style="display: ${isVisible ? "flex" : "none"}"
      >
        ${this.passSlots.map((slot) => this.renderSlot(slot))}
      </div>
    `;
    }
    renderSlot(slot) {
      const targetPlayer = this.players[slot.playerId];
      const color = targetPlayer?.color ?? "000000";
      const name = targetPlayer?.name ?? "";
      const isGrandTichu = targetPlayer?.callGrandTichu === 200;
      const isTichu = targetPlayer?.callTichu === 100;
      return x`
      <div
        class="whiteblock playertable playertable_${slot.dir}"
        id="playertable_${slot.dir}"
        data-player-id="${slot.playerId}"
      >
        <div class="playertablename" style="color: #${color}">
          <span class="icons">
            <span
              class="icon grandtichucolor ${slot.playerId}"
              style="display: ${isGrandTichu ? "inline-block" : "none"}"
              title=${t7("Grand Tichu bet")}
            ></span>
            <span
              class="icon tichucolor ${slot.playerId}"
              style="display: ${isTichu ? "inline-block" : "none"}"
              title=${t7("Tichu bet")}
            ></span>
          </span>
          ${name}
        </div>
        <div
          class="playertablecard"
          id="give_${slot.dir}"
          @click=${() => this.onSlotClick(slot.dir - 1)}
        >
          <div class="givePassCard" id="giveplayertable_${slot.dir}"></div>
          <div class="receivePassCard" id="receiveplayertable_${slot.playerId}"></div>
          <div class="playertablebackground">
            <div class="tichubets">
              <div
                class="icon big grandtichucolor ${slot.playerId}"
                style="display: ${isGrandTichu ? "inline-block" : "none"}"
              ></div>
              <div
                class="icon big tichucolor ${slot.playerId}"
                style="display: ${isTichu ? "inline-block" : "none"}"
              ></div>
            </div>
            <div class="CardBack selectable playertabletext">
              <span>${t7("Select a card and click here")}</span>
            </div>
          </div>
          ${slot.givenCard ? x`<tichu-card
                  .card=${slot.givenCard}
                  .scale=${1}
                  .tiki=${this.isTiki}
                  class=${e6({
        "given-card": true,
        cardontable: true,
        "slide-out": slot.animatingAccept
      })}
                ></tichu-card>` : ""}
          ${slot.receivedCard ? x`<tichu-card
                  .card=${slot.receivedCard}
                  .scale=${1}
                  .tiki=${this.isTiki}
                  class=${e6({
        "received-card": true,
        cardontable: true,
        "slide-to-hand": slot.animatingAccept
      })}
                ></tichu-card>` : ""}
        </div>
      </div>
    `;
    }
    onSlotClick(index) {
      if (this.stateName !== "giveCards" || !this.isCurrentPlayerActive) return;
      this.dispatchEvent(
        new CustomEvent("pass-slot-click", {
          detail: { index },
          bubbles: true,
          composed: true
        })
      );
      const ui = window.gameui;
      if (ui && typeof ui.onGiveCard === "function") {
        ui.onGiveCard(index);
      } else {
        window.gameModel.toggleGiveCardSlot(index);
      }
    }
  };
  __decorateClass([
    r5()
  ], TichuPassArea.prototype, "stateName", 2);
  __decorateClass([
    r5()
  ], TichuPassArea.prototype, "isSpectator", 2);
  __decorateClass([
    r5()
  ], TichuPassArea.prototype, "isCurrentPlayerActive", 2);
  __decorateClass([
    r5()
  ], TichuPassArea.prototype, "passSlots", 2);
  __decorateClass([
    r5()
  ], TichuPassArea.prototype, "players", 2);
  __decorateClass([
    r5()
  ], TichuPassArea.prototype, "isTiki", 2);
  __decorateClass([
    r5()
  ], TichuPassArea.prototype, "clockwise", 2);
  customElements.define("tichu-pass-area", TichuPassArea);

  // src/elements/tichu-action-bar.ts
  var t8 = (s4) => typeof _ === "function" ? _(s4) : s4;
  var TichuActionBar = class extends i4 {
    constructor() {
      super();
      this.stateName = "";
      this.isCurrentPlayerActive = false;
      this.isSpectator = false;
      this.isRealtime = false;
      this.currentPlayer = null;
      this.hand = [];
      this.firstOutPlayerId = "";
      this.acceptingCardsCountdown = false;
      this.collectingTrickCountdown = false;
      subscribe(
        this,
        () => window.gameModel.stateName$,
        (stateName) => this.stateName = stateName
      );
      subscribe(
        this,
        () => window.gameModel.isCurrentPlayerActive$,
        (active) => this.isCurrentPlayerActive = active
      );
      subscribe(
        this,
        () => window.gameModel.isSpectator$,
        (isSpectator) => this.isSpectator = isSpectator
      );
      subscribe(
        this,
        () => window.gameModel.isRealtime$,
        (isRealtime) => this.isRealtime = isRealtime
      );
      subscribe(
        this,
        () => window.gameModel.currentPlayer$,
        (player) => this.currentPlayer = player
      );
      subscribe(
        this,
        () => window.gameModel.hand$,
        (hand) => this.hand = hand
      );
      subscribe(
        this,
        () => window.gameModel.firstOutPlayerId$,
        (id) => this.firstOutPlayerId = id
      );
      subscribe(
        this,
        () => window.gameModel.acceptingCardsCountdown$,
        (val) => this.acceptingCardsCountdown = val
      );
      subscribe(
        this,
        () => window.gameModel.collectingTrickCountdown$,
        (val) => this.collectingTrickCountdown = val
      );
    }
    static get styles() {
      return [
        styles,
        i`
        :host {
          display: block;
        }
        #buttons {
          padding: 10px 5px 10px 5px;
          min-height: 30px;
          display: flex;
          align-items: center;
          background-color: var(--bg-color-lighter);
          box-shadow: var(--elevation);
        }
        #buttons h3 {
          line-height: 20px;
          font-size: 20px;
          margin: 0;
        }
        #buttons .space1 {
          flex-grow: 1;
        }
        #buttons .space2 {
          flex-grow: 1.6;
        }
        #buttons .bgabutton {
          text-align: center;
          margin: 0;
          width: 100%;
          box-sizing: border-box;
          box-shadow: none;
          text-shadow: none;
        }
        #buttons #bomb_button {
          min-width: 100px;
          margin-left: 10px;
        }
        #buttons #play_button {
          min-width: 150px;
          margin-left: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        #buttons #pass_button {
          min-width: 150px;
          margin-left: 10px;
        }
        #buttons #pass_trick_button {
          min-width: 150px;
          margin-left: 10px;
        }
        #buttons #tichu_button {
          min-width: 100px;
          margin-left: 10px;
          margin-right: 15px;
        }
      `
      ];
    }
    render() {
      const showBomb = !this.isSpectator && (this.stateName === "playCombo" || this.stateName === "confirmTrick" || this.stateName === "mahjongPlay" || this.stateName === "phoenixPlay") && this.hand.length > 0;
      const showTichu = !this.isSpectator && this.currentPlayer !== null && this.currentPlayer.callTichu === -1 && this.currentPlayer.callGrandTichu !== 200 && !this.firstOutPlayerId && (this.hand.length === 14 || this.stateName === "grandTichuBets");
      return x`
      <div id="buttons">
        <div id="play_button">${this.renderPlayButtonContent()}</div>
        <div
          id="pass_button"
          style="display: ${this.hasPassButtonContent() ? "inline-block" : "none"}"
        >
          ${this.renderPassButtonContent()}
        </div>
        <div
          id="pass_trick_button"
          style="display: ${this.hasPassTrickButtonContent() ? "inline-block" : "none"}"
        >
          ${this.renderPassTrickButtonContent()}
        </div>
        <div class="space1"></div>
        <div id="bomb_button" style="display: ${showBomb ? "inline-block" : "none"}">
          ${showBomb ? x`<a
                  href="#"
                  id="myPlayBomb"
                  class="action-button bgabutton bgabutton_gray"
                  @click=${this.onPlayBomb}
                  ><span>${t8("Play a Bomb")}</span></a
                >` : ""}
        </div>
        <div id="tichu_button" style="display: ${showTichu ? "inline-block" : "none"}">
          ${showTichu ? x`<a
                  href="#"
                  id="myMakeTichuBet"
                  class="action-button bgabutton bgabutton_green"
                  title=${t8("Bet 100 Points, tha you will finish first")}
                  @click=${this.onTichuBet}
                  ><span>${t8("Tichu")}</span></a
                >` : ""}
        </div>
        <div class="space2"></div>
      </div>
    `;
    }
    renderPlayButtonContent() {
      if (this.acceptingCardsCountdown) {
        return x`<h3>${t8("Auto accepting in 2 seconds ...")}</h3>`;
      }
      if (this.collectingTrickCountdown) {
        return x`<h3>${t8("Auto collecting in 2 seconds ...")}</h3>`;
      }
      const canPlayCombo = !this.isSpectator && this.isCurrentPlayerActive && (this.stateName === "playComboOpen" || this.stateName === "playCombo" || this.stateName === "playBomb");
      const canCollect = !this.isSpectator && this.isCurrentPlayerActive && this.stateName === "confirmTrick" && !this.isRealtime && !this.collectingTrickCountdown;
      return x`
      <h3>${t8("My hand")}</h3>
      ${canPlayCombo ? x`<a
              href="#"
              id="myPlayCombo"
              class="action-button bgabutton bgabutton_blue"
              @click=${this.onPlayCombo}
              ><span>${t8("Play selected cards")}</span></a
            >` : ""}
      ${canCollect ? x`<a
              href="#"
              id="myConfirmTrick"
              class="action-button bgabutton bgabutton_blue"
              @click=${this.onCollect}
              ><span>${t8("Collect")}</span></a
            >` : ""}
    `;
    }
    hasPassButtonContent() {
      if (this.acceptingCardsCountdown || this.collectingTrickCountdown) return false;
      if (this.isSpectator) return false;
      if (this.isCurrentPlayerActive) {
        return this.stateName === "playCombo" || this.stateName === "playBomb";
      }
      return (this.stateName === "playCombo" || this.stateName === "confirmTrick") && this.hand.length > 0;
    }
    renderPassButtonContent() {
      if (this.acceptingCardsCountdown || this.collectingTrickCountdown) {
        return "";
      }
      if (this.isSpectator) return "";
      if (this.isCurrentPlayerActive) {
        if (this.stateName === "playCombo") {
          return x`<a
          href="#"
          id="myPass"
          class="action-button bgabutton bgabutton_red"
          @click=${(e7) => this.onPass(e7, true)}
          ><span>${t8("Pass")}</span></a
        >`;
        }
        if (this.stateName === "playBomb") {
          return x`<a
          href="#"
          id="myCancel"
          class="action-button bgabutton bgabutton_red"
          @click=${this.onCancelBomb}
          ><span>${t8("Cancel")}</span></a
        >`;
        }
        return "";
      }
      if ((this.stateName === "playCombo" || this.stateName === "confirmTrick") && this.hand.length > 0) {
        const passMode = this.currentPlayer?.pass ?? 0;
        if (passMode === 0) {
          return x`<a
          href="#"
          id="myPassOnce"
          class="action-button bgabutton bgabutton_red"
          title=${t8("Automatically pass next time(unless a new trick starts)")}
          @click=${(e7) => this.onPass(e7, true)}
          ><span>${t8("Auto-Pass once")}</span></a
        >`;
        }
        return x`<a
        href="#"
        id="myCancelAutopass"
        class="action-button bgabutton bgabutton_red"
        title=${t8("You have chosen to automatically pass during this trick. Click to cancel")}
        @click=${this.onCancelAutopass}
        ><span>${t8("Cancel Auto-Pass")}</span></a
      >`;
      }
      return "";
    }
    hasPassTrickButtonContent() {
      if (this.acceptingCardsCountdown || this.collectingTrickCountdown) return false;
      if (this.isSpectator) return false;
      if (this.isCurrentPlayerActive) {
        return this.stateName === "playCombo";
      }
      const passMode = this.currentPlayer?.pass ?? 0;
      return (this.stateName === "playCombo" || this.stateName === "confirmTrick") && this.hand.length > 0 && passMode < 2;
    }
    renderPassTrickButtonContent() {
      if (this.acceptingCardsCountdown || this.collectingTrickCountdown) {
        return "";
      }
      if (this.isSpectator) return "";
      const passMode = this.currentPlayer?.pass ?? 0;
      const showTrickPass = this.isCurrentPlayerActive && this.stateName === "playCombo" || !this.isCurrentPlayerActive && (this.stateName === "playCombo" || this.stateName === "confirmTrick") && this.hand.length > 0 && passMode < 2;
      if (showTrickPass) {
        return x`<a
        href="#"
        id="myPassTrick"
        class="action-button bgabutton bgabutton_gray"
        title=${t8("Automatically pass until the end of this trick.")}
        @click=${(e7) => this.onPass(e7, false)}
        ><span>${t8("Auto-Pass this Trick")}</span></a
      >`;
      }
      return "";
    }
    onPlayCombo(e7) {
      e7.preventDefault();
      this.dispatchEvent(
        new CustomEvent("action-play-combo", {
          bubbles: true,
          composed: true
        })
      );
      const ui = window.gameui;
      if (ui) {
        if (typeof ui.onPlayCombo === "function") {
          ui.onPlayCombo(e7);
        } else if (typeof ui.playCombo === "function") {
          ui.playCombo("playCombo");
        }
      }
    }
    onPass(e7, onlyOnce) {
      e7.preventDefault();
      this.dispatchEvent(
        new CustomEvent(onlyOnce ? "action-pass" : "action-pass-trick", {
          detail: { onlyOnce },
          bubbles: true,
          composed: true
        })
      );
      const ui = window.gameui;
      if (ui && typeof ui.onPass === "function") {
        ui.onPass(onlyOnce);
      }
    }
    onCancelAutopass(e7) {
      e7.preventDefault();
      this.dispatchEvent(
        new CustomEvent("action-cancel-autopass", {
          bubbles: true,
          composed: true
        })
      );
      const ui = window.gameui;
      if (ui && typeof ui.cancelAutopass === "function") {
        ui.cancelAutopass();
      }
    }
    onCancelBomb(e7) {
      e7.preventDefault();
      this.dispatchEvent(
        new CustomEvent("action-cancel-bomb", {
          bubbles: true,
          composed: true
        })
      );
      const ui = window.gameui;
      if (ui) {
        if (typeof ui.onCancelBomb === "function") {
          ui.onCancelBomb(e7);
        } else if (typeof ui.takeAction === "function") {
          ui.takeAction("cancel");
        }
      }
    }
    onCollect(e7) {
      e7.preventDefault();
      this.dispatchEvent(
        new CustomEvent("action-collect", {
          bubbles: true,
          composed: true
        })
      );
      const ui = window.gameui;
      if (ui && typeof ui.collect === "function") {
        ui.collect();
      }
    }
    onPlayBomb(e7) {
      e7.preventDefault();
      this.dispatchEvent(
        new CustomEvent("action-play-bomb", {
          bubbles: true,
          composed: true
        })
      );
      const ui = window.gameui;
      if (ui) {
        if (typeof ui.onPlayBomb === "function") {
          ui.onPlayBomb(e7);
        } else if (typeof ui.playCombo === "function") {
          ui.playCombo("playBomb");
        }
      }
    }
    onTichuBet(e7) {
      e7.preventDefault();
      this.dispatchEvent(
        new CustomEvent("action-tichu-bet", {
          bubbles: true,
          composed: true
        })
      );
      const ui = window.gameui;
      if (ui && typeof ui.onTichuBet === "function") {
        ui.onTichuBet(e7);
      }
    }
  };
  __decorateClass([
    r5()
  ], TichuActionBar.prototype, "stateName", 2);
  __decorateClass([
    r5()
  ], TichuActionBar.prototype, "isCurrentPlayerActive", 2);
  __decorateClass([
    r5()
  ], TichuActionBar.prototype, "isSpectator", 2);
  __decorateClass([
    r5()
  ], TichuActionBar.prototype, "isRealtime", 2);
  __decorateClass([
    r5()
  ], TichuActionBar.prototype, "currentPlayer", 2);
  __decorateClass([
    r5()
  ], TichuActionBar.prototype, "hand", 2);
  __decorateClass([
    r5()
  ], TichuActionBar.prototype, "firstOutPlayerId", 2);
  __decorateClass([
    r5()
  ], TichuActionBar.prototype, "acceptingCardsCountdown", 2);
  __decorateClass([
    r5()
  ], TichuActionBar.prototype, "collectingTrickCountdown", 2);
  customElements.define("tichu-action-bar", TichuActionBar);

  // src/elements/tichu-hand.ts
  var t9 = (s4) => typeof _ === "function" ? _(s4) : s4;
  var THEME_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  var TichuHand = class extends i4 {
    constructor() {
      super();
      this.isSpectator = false;
      this.hand = [];
      this.selectedCardIds = [];
      this.handSortOrder = "rank";
      this.stateName = "";
      this.isTiki = false;
      this.clockwise = true;
      this.squareTable = false;
      this.theme = 0;
      subscribe(
        this,
        () => window.gameModel.isSpectator$,
        (isSpectator) => this.isSpectator = isSpectator
      );
      subscribe(
        this,
        () => window.gameModel.hand$,
        (hand) => this.hand = hand
      );
      subscribe(
        this,
        () => window.gameModel.selectedCardIds$,
        (ids) => this.selectedCardIds = ids
      );
      subscribe(
        this,
        () => window.gameModel.handSortOrder$,
        (order) => this.handSortOrder = order
      );
      subscribe(
        this,
        () => window.gameModel.stateName$,
        (stateName) => this.stateName = stateName
      );
      subscribe(
        this,
        () => window.gameModel.isTiki$,
        (isTiki) => this.isTiki = isTiki
      );
      subscribe(
        this,
        () => window.gameModel.clockwise$,
        (clockwise) => this.clockwise = clockwise
      );
      subscribe(
        this,
        () => window.gameModel.squareTable$,
        (squareTable) => this.squareTable = squareTable
      );
      subscribe(
        this,
        () => window.gameModel.theme$,
        (theme) => this.theme = theme
      );
    }
    static get styles() {
      return [
        styles,
        i`
        :host {
          display: block;
        }
        #myhandwrap {
          padding-top: 10px;
          font-size: 14px;
        }
        #myhand {
          margin: 15px 250px 25px 15px;
          min-height: 150px;
        }
        #prefs {
          padding: 10px;
          border-top: 1px solid var(--bg-color-lighter);
          color: #1f2328;
        }
        #prefs a {
          color: var(--bg-color-lighter);
        }
        .reordercards {
          margin-left: 10px;
          cursor: pointer;
        }
        #themes {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          padding: 10px 0px 0px 0px;
          line-height: 16px;
        }
        #themes > * {
          margin-right: 15px;
        }
        a.themelink {
          display: flex;
          border: 1px solid rgba(255, 255, 255, 0.3);
          cursor: pointer;
        }
        a.themelink .bg {
          width: 14px;
          height: 14px;
        }
        a.themelink .bg1 {
          background-color: var(--bg-color-html);
        }
        a.themelink .bg2 {
          background-color: var(--bg-color-play-area);
        }
        a.themelink .bg3 {
          background-color: var(--bg-color-lighter);
        }
      `
      ];
    }
    getSelectionMode() {
      if (this.stateName === "giveCards") return 1;
      if (this.stateName === "grandTichuBets") return 0;
      return 2;
    }
    render() {
      const selectionMode = this.getSelectionMode();
      const isArchiveMode = Boolean(window.g_archive_mode);
      return x`
      <div
        id="myhandwrap"
        class="whiteblock"
        style="display: ${this.isSpectator ? "none" : "block"}"
      >
        <tichu-action-bar></tichu-action-bar>
        <div id="myhand">
          <tichu-stock
            .cards=${this.hand}
            .scale=${1}
            .tiki=${this.isTiki}
            .sortMode=${this.handSortOrder}
            .selectionMode=${selectionMode}
            .selectedIds=${this.selectedCardIds}
            .dynamicOverlap=${true}
            @selection-change=${this.onSelectionChange}
          ></tichu-stock>
        </div>
        <div id="prefs">
          <span>${t9("User Preferences:")}</span>
          <a
            href="#"
            class="reordercards"
            id="order_by_rank"
            style="display: ${this.handSortOrder === "color" ? "inline" : "none"}"
            @click=${this.onOrderByRank}
            >[${t9("Reorder cards by rank")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="order_by_color"
            style="display: ${this.handSortOrder === "rank" ? "inline" : "none"}"
            @click=${this.onOrderByColor}
            >[${t9("Reorder cards by color")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="list_table"
            style="display: ${this.squareTable ? "inline" : "none"}"
            title=${t9("You can change this permanently in the user settings")}
            @click=${(e7) => this.onTableLayout(e7, false)}
            >[${t9("List table")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="square_table"
            style="display: ${this.squareTable ? "none" : "inline"}"
            title=${t9("You can change this permanently in the user settings")}
            @click=${(e7) => this.onTableLayout(e7, true)}
            >[${t9("Square table")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="clockwise"
            style="display: ${this.clockwise ? "none" : "inline"}"
            title=${t9(
        "This will affect the arrangement of the square table and the order of players when passing the cards. You can change this permanently in the user settings"
      )}
            @click=${(e7) => this.onClockwiseChange(e7, true)}
            >[${t9("Play clockwise")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="counterClockwise"
            style="display: ${this.clockwise ? "inline" : "none"}"
            title=${t9(
        "This will affect the arrangement of the square table and the order of players when passing the cards. You can change this permanently in the user settings"
      )}
            @click=${(e7) => this.onClockwiseChange(e7, false)}
            >[${t9("Play counterclockwise")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="expReplay"
            style="display: ${isArchiveMode ? "inline" : "none"}"
            @click=${this.onExpReplay}
            >[${t9("Experimental Replay")}]</a
          >
          <div id="themes">
            <span>${t9("Color Themes:")}</span>
            ${THEME_NUMBERS.map(
        (themeNo) => x`
                <a
                  href="#"
                  class="themelink theme${themeNo}"
                  id="theme${themeNo}"
                  @click=${(e7) => this.onThemeClick(e7, themeNo)}
                >
                  <div class="bg bg1"></div>
                  <div class="bg bg2"></div>
                  <div class="bg bg3"></div>
                </a>
              `
      )}
          </div>
        </div>
      </div>
    `;
    }
    onSelectionChange(e7) {
      window.gameModel.setSelectedCardIds(e7.detail.selectedIds);
    }
    onOrderByRank(e7) {
      e7.preventDefault();
      window.gameModel.setHandSortOrder("rank");
      const ui = window.gameui;
      if (ui && typeof ui.onReorderByRank === "function") {
        ui.onReorderByRank(e7);
      }
    }
    onOrderByColor(e7) {
      e7.preventDefault();
      window.gameModel.setHandSortOrder("color");
      const ui = window.gameui;
      if (ui && typeof ui.onReorderByColor === "function") {
        ui.onReorderByColor(e7);
      }
    }
    onTableLayout(e7, squareTable) {
      e7.preventDefault();
      window.gameModel.setSquareTable(squareTable);
      const ui = window.gameui;
      if (ui && typeof ui.onReorderTable === "function") {
        ui.onReorderTable(squareTable);
      }
    }
    onClockwiseChange(e7, clockwise) {
      e7.preventDefault();
      window.gameModel.setClockwise(clockwise);
      const ui = window.gameui;
      if (ui && typeof ui.changeOrder === "function") {
        ui.changeOrder(clockwise);
      }
    }
    onExpReplay(e7) {
      e7.preventDefault();
      window.gameModel.setExperimentalReplayOpen(true);
      const ui = window.gameui;
      if (ui && typeof ui.toggleExperimentalReplay === "function") {
        ui.toggleExperimentalReplay(true);
      }
    }
    onThemeClick(e7, themeNo) {
      e7.preventDefault();
      window.gameModel.setTheme(themeNo);
      const ui = window.gameui;
      if (ui) {
        if (typeof ui.onThemeChange === "function") {
          ui.onThemeChange(themeNo);
        } else if (typeof ui.setTheme === "function") {
          ui.setTheme(themeNo);
        }
      }
    }
  };
  __decorateClass([
    r5()
  ], TichuHand.prototype, "isSpectator", 2);
  __decorateClass([
    r5()
  ], TichuHand.prototype, "hand", 2);
  __decorateClass([
    r5()
  ], TichuHand.prototype, "selectedCardIds", 2);
  __decorateClass([
    r5()
  ], TichuHand.prototype, "handSortOrder", 2);
  __decorateClass([
    r5()
  ], TichuHand.prototype, "stateName", 2);
  __decorateClass([
    r5()
  ], TichuHand.prototype, "isTiki", 2);
  __decorateClass([
    r5()
  ], TichuHand.prototype, "clockwise", 2);
  __decorateClass([
    r5()
  ], TichuHand.prototype, "squareTable", 2);
  __decorateClass([
    r5()
  ], TichuHand.prototype, "theme", 2);
  customElements.define("tichu-hand", TichuHand);

  // src/elements/tichu-played-cards.ts
  var t10 = (s4) => typeof _ === "function" ? _(s4) : s4;
  var COLORS = [1, 2, 3, 4];
  var VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  var SPECIAL_LABELS = {
    1: "D",
    2: "P",
    3: "H",
    4: "1"
  };
  var RANK_LABELS = {
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    11: "J",
    12: "Q",
    13: "K",
    14: "A"
  };
  var TichuPlayedCards = class extends i4 {
    constructor() {
      super();
      this.isAllInfoExposed = false;
      this.hand = [];
      this.currentTrick = [];
      this.capturedCards = [];
      this.isTiki = false;
      subscribe(
        this,
        () => window.gameModel.isAllInfoExposed$,
        (val) => this.isAllInfoExposed = val
      );
      subscribe(
        this,
        () => window.gameModel.hand$,
        (hand) => this.hand = hand
      );
      subscribe(
        this,
        () => window.gameModel.currentTrick$,
        (trick) => this.currentTrick = trick
      );
      subscribe(
        this,
        () => window.gameModel.capturedCards$,
        (captured) => this.capturedCards = captured
      );
      subscribe(
        this,
        () => window.gameModel.isTiki$,
        (isTiki) => this.isTiki = isTiki
      );
    }
    static get styles() {
      return [
        styles,
        i`
        :host {
          display: block;
        }
        #playedCards {
          --w: 40px;
          --h: 60px;
        }
        #playedCards h3 {
          padding: 10px 15px;
          background-color: var(--bg-color-lighter);
        }
        #playedCards #playedCardsFlexRow {
          display: flex;
          flex-direction: row;
          justify-content: center;
        }
        #playedCards #playedCardsFlexRow .space {
          flex-grow: 1;
        }
        #playedCards #playedCardsFlexCol {
          flex-grow: 0;
          display: flex;
          flex-direction: column;
          margin: 10px;
          padding: 5px;
          background-color: rgba(255, 255, 255, 0.2);
          border-radius: var(--border-radius);
        }
        #playedCards .type {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        #playedCards .arg {
          width: var(--w);
          height: var(--h);
          margin: 3px;
          border-radius: 3px;
          background-image: var(--card-sprite-url);
          background-position: calc(var(--x) * -1 * var(--w)) calc(var(--y) * -1 * var(--h));
          background-repeat: no-repeat;
          background-size: calc(var(--w) * 14) calc(var(--h) * 4);
          position: relative;
        }
        #playedCards .arg-label {
          font-size: 0;
          color: transparent;
          user-select: none;
        }
        #playedCards .arg.hand {
          opacity: 0.3;
        }
        #playedCards .arg.trick {
          visibility: hidden;
        }
        #playedCards .arg.captured {
          visibility: hidden;
        }
      `
      ];
    }
    getCardSet(cards) {
      const s4 = /* @__PURE__ */ new Set();
      for (const c4 of cards) {
        s4.add(`${Number(c4.type)}_${Number(c4.type_arg)}`);
      }
      return s4;
    }
    render() {
      const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
      const sprite = this.isTiki ? "img/tiki-cards.png" : "img/tichu-cards.png";
      this.style.setProperty("--card-sprite-url", `url(${themeUrl}${sprite})`);
      const capturedSet = this.getCardSet(this.capturedCards);
      const trickSet = this.getCardSet(this.currentTrick);
      const handSet = this.getCardSet(this.hand);
      return x`
      <div
        id="playedCards"
        class="whiteblock"
        style="display: ${this.isAllInfoExposed ? "block" : "none"}"
      >
        <h3>${t10("Played Cards")}</h3>
        <div id="playedCardsFlexRow">
          <div class="space"></div>
          <div id="playedCardsFlexCol">
            ${COLORS.map(
        (color) => x`
                <div id="playedType_${color}" class="type color${color}" style="--y: ${color - 1};">
                  ${VALUES.map((val) => {
          const key = `${color}_${val}`;
          const isCaptured = capturedSet.has(key);
          const isTrick = trickSet.has(key);
          const isHand = handSet.has(key);
          const label = val === 1 ? SPECIAL_LABELS[color] ?? "" : RANK_LABELS[val] ?? String(val);
          const classes = {
            arg: true,
            captured: isCaptured,
            trick: isTrick,
            hand: isHand
          };
          return x`
                      <div
                        id="card_${color}_${val}"
                        class=${e6(classes)}
                        style="--x: ${val - 1};"
                      >
                        <span
                          id="playedCard_${color}_${val}"
                          class=${e6({
            "arg-label": true,
            captured: isCaptured,
            trick: isTrick,
            hand: isHand
          })}
                          >${label}</span
                        >
                      </div>
                    `;
        })}
                </div>
              `
      )}
          </div>
          <div class="space"></div>
        </div>
      </div>
    `;
    }
  };
  __decorateClass([
    r5()
  ], TichuPlayedCards.prototype, "isAllInfoExposed", 2);
  __decorateClass([
    r5()
  ], TichuPlayedCards.prototype, "hand", 2);
  __decorateClass([
    r5()
  ], TichuPlayedCards.prototype, "currentTrick", 2);
  __decorateClass([
    r5()
  ], TichuPlayedCards.prototype, "capturedCards", 2);
  __decorateClass([
    r5()
  ], TichuPlayedCards.prototype, "isTiki", 2);
  customElements.define("tichu-played-cards", TichuPlayedCards);

  // src/elements/tichu-trick-modal.ts
  var t11 = (s4) => typeof _ === "function" ? _(s4) : s4;
  var TichuTrickModal = class extends i4 {
    constructor() {
      super();
      this.trickModalOpen = false;
      this.currentTrick = [];
      this.isTiki = false;
      subscribe(
        this,
        () => window.gameModel.trickModalOpen$,
        (open) => this.trickModalOpen = open
      );
      subscribe(
        this,
        () => window.gameModel.currentTrick$,
        (cards) => this.currentTrick = cards
      );
      subscribe(
        this,
        () => window.gameModel.isTiki$,
        (isTiki) => this.isTiki = isTiki
      );
    }
    static get styles() {
      return [
        styles,
        i`
        :host {
          display: block;
        }
        .custom_popin_underlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          z-index: 9500;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .custom_popin {
          background: #f6f0e6;
          color: #1f2328;
          border-radius: 8px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
          min-width: 540px;
          max-width: 90vw;
          max-height: 85vh;
          overflow: auto;
          border: 1px solid rgba(0, 0, 0, 0.2);
        }
        .custom_popin_titlebar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #e7dccb;
          border-bottom: 1px solid rgba(0, 0, 0, 0.12);
          font-size: 17px;
          font-weight: 700;
        }
        #popin_showCurrentTrickDialog_close {
          background: transparent;
          border: none;
          font-size: 20px;
          font-weight: 700;
          line-height: 1;
          color: #57606a;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          text-decoration: none;
        }
        #popin_showCurrentTrickDialog_close:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #1f2328;
        }
        .custom_popin_content {
          padding: 16px;
          min-width: 500px;
        }
        #currentTrickCards {
          width: 500px;
        }
      `
      ];
    }
    render() {
      if (!this.trickModalOpen) return "";
      return x`
      <div
        id="popin_showCurrentTrickDialog_underlay"
        class="custom_popin_underlay bga-popin-underlay"
        @click=${this.onUnderlayClick}
      >
        <div id="popin_showCurrentTrickDialog" class="custom_popin bga-popin-dialog">
          <div class="custom_popin_titlebar bga-popin-titlebar">
            <span id="popin_showCurrentTrickDialog_title" class="bga-popin-title">
              ${t11("Cards in current Trick")}
            </span>
            <a
              href="#"
              id="popin_showCurrentTrickDialog_close"
              class="bga-popin-close"
              title="Close"
              @click=${this.onClose}
              >X</a
            >
          </div>
          <div
            id="popin_showCurrentTrickDialog_contents"
            class="custom_popin_content bga-popin-content"
          >
            <div id="currentTrickCards">
              <tichu-stock
                .cards=${this.currentTrick}
                .scale=${0.75}
                sortMode="preserve"
                .tiki=${this.isTiki}
                .dynamicOverlap=${true}
              ></tichu-stock>
            </div>
          </div>
        </div>
      </div>
    `;
    }
    onUnderlayClick(e7) {
      if (e7.target === e7.currentTarget) {
        window.gameModel.setTrickModalOpen(false);
      }
    }
    onClose(e7) {
      e7.preventDefault();
      window.gameModel.setTrickModalOpen(false);
    }
  };
  __decorateClass([
    r5()
  ], TichuTrickModal.prototype, "trickModalOpen", 2);
  __decorateClass([
    r5()
  ], TichuTrickModal.prototype, "currentTrick", 2);
  __decorateClass([
    r5()
  ], TichuTrickModal.prototype, "isTiki", 2);
  customElements.define("tichu-trick-modal", TichuTrickModal);

  // src/elements/tichu-game.ts
  var THEME_NUMBERS2 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  var TichuGame = class extends i4 {
    constructor() {
      super();
      this.experimentalReplayOpen = false;
      this.clockwise = true;
      this.squareTable = false;
      this.theme = 0;
      this.isTiki = false;
      this.betAnimations = [];
      subscribe(
        this,
        () => window.gameModel.experimentalReplayOpen$,
        (open) => {
          this.experimentalReplayOpen = open;
          this.syncExternalClasses();
        }
      );
      subscribe(
        this,
        () => window.gameModel.clockwise$,
        (clockwise) => {
          this.clockwise = clockwise;
          this.syncExternalClasses();
        }
      );
      subscribe(
        this,
        () => window.gameModel.squareTable$,
        (squareTable) => {
          this.squareTable = squareTable;
          this.syncExternalClasses();
        }
      );
      subscribe(
        this,
        () => window.gameModel.theme$,
        (theme) => {
          this.theme = theme;
          this.syncExternalClasses();
        }
      );
      subscribe(
        this,
        () => window.gameModel.isTiki$,
        (isTiki) => {
          this.isTiki = isTiki;
          this.syncExternalClasses();
        }
      );
      subscribe(
        this,
        () => window.gameModel.betAnimations$,
        (anims) => this.betAnimations = anims
      );
    }
    static get styles() {
      return [
        styles,
        i`
        :host {
          display: block;
          position: relative;
          --bg-color-light: #eee;
          --bg-color-html: rgba(0, 0, 0, 0.3);
          --bg-color-play-area: rgba(255, 255, 255, 0.3);
          --bg-color-lighter: rgba(246, 231, 212, 0.8);
          --bg-color-active: rgba(200, 0, 0, 0.9);
        }
        #tichu-game-root {
          position: relative;
        }
      `
      ];
    }
    connectedCallback() {
      super.connectedCallback();
      this.syncExternalClasses();
    }
    syncExternalClasses() {
      if (typeof document === "undefined") return;
      const targets = [
        document.getElementById("overall-content"),
        document.getElementById("game_play_area"),
        document.body
      ];
      for (const el of targets) {
        if (!el) continue;
        for (const n5 of THEME_NUMBERS2) {
          el.classList.toggle(`theme${n5}`, this.theme === n5);
        }
        el.classList.toggle("tiki", this.isTiki);
        el.classList.toggle("clockwise", this.clockwise);
        el.classList.toggle("squareTable", this.squareTable);
        el.classList.toggle("listTable", !this.squareTable);
      }
    }
    render() {
      const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
      this.style.setProperty("--icon-url", `url(${themeUrl}img/tichu-icons.png)`);
      const rootClasses = {
        tiki: this.isTiki,
        clockwise: this.clockwise,
        squareTable: this.squareTable,
        listTable: !this.squareTable
      };
      for (const n5 of THEME_NUMBERS2) {
        rootClasses[`theme${n5}`] = this.theme === n5;
      }
      if (this.experimentalReplayOpen) {
        return x`
        <div id="tichu-game-root" class=${e6(rootClasses)}>
          <tichu-replay
            @exit=${() => window.gameModel.setExperimentalReplayOpen(false)}
          ></tichu-replay>
        </div>
      `;
      }
      return x`
      <div id="tichu-game-root" class=${e6(rootClasses)}>
        ${this.betAnimations.map(
        (anim) => x`
            <div
              id="temp_${anim.playerId}"
              class=${e6({
          icon: true,
          temp: true,
          "grand-tichu-color": anim.bet === 200,
          grandtichucolor: anim.bet === 200,
          "tichu-color": anim.bet !== 200,
          tichucolor: anim.bet !== 200,
          "fading-out": anim.fadingOut
        })}
              style="opacity: ${anim.fadingOut ? "0" : "1"}"
            ></div>
          `
      )}
        <tichu-value-choice mode="mahjong"></tichu-value-choice>
        <tichu-value-choice mode="phoenix"></tichu-value-choice>
        <tichu-last-played></tichu-last-played>
        <tichu-pass-area></tichu-pass-area>
        <tichu-hand></tichu-hand>
        <tichu-played-cards></tichu-played-cards>
        <tichu-trick-modal></tichu-trick-modal>
      </div>
    `;
    }
  };
  __decorateClass([
    r5()
  ], TichuGame.prototype, "experimentalReplayOpen", 2);
  __decorateClass([
    r5()
  ], TichuGame.prototype, "clockwise", 2);
  __decorateClass([
    r5()
  ], TichuGame.prototype, "squareTable", 2);
  __decorateClass([
    r5()
  ], TichuGame.prototype, "theme", 2);
  __decorateClass([
    r5()
  ], TichuGame.prototype, "isTiki", 2);
  __decorateClass([
    r5()
  ], TichuGame.prototype, "betAnimations", 2);
  customElements.define("tichu-game", TichuGame);

  // src/elements/elements.ts
  if (typeof document !== "undefined" && document.documentElement) {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    document.documentElement.style.setProperty("--icon-url", `url(${themeUrl}img/tichu-icons.png)`);
    document.documentElement.style.setProperty(
      "--table-icons-url",
      `url(${themeUrl}img/tichu-icons-table.png)`
    );
    document.documentElement.style.setProperty(
      "--mahjong-bg-url",
      `url(${themeUrl}img/tichu-mahjong.png)`
    );
    document.documentElement.style.setProperty(
      "--tiki-mahjong-bg-url",
      `url(${themeUrl}img/tiki-tichu-mahjong.png)`
    );
  }
  if (typeof window !== "undefined" && !window.gameModel) {
    window.gameModel = new GameModel();
  }
})();
/*! Bundled license information:

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
lit-html/lit-html.js:
lit-element/lit-element.js:
@lit/reactive-element/decorators/custom-element.js:
@lit/reactive-element/decorators/property.js:
@lit/reactive-element/decorators/state.js:
@lit/reactive-element/decorators/event-options.js:
@lit/reactive-element/decorators/base.js:
@lit/reactive-element/decorators/query.js:
@lit/reactive-element/decorators/query-all.js:
@lit/reactive-element/decorators/query-async.js:
@lit/reactive-element/decorators/query-assigned-nodes.js:
lit-html/directive.js:
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

@lit/reactive-element/decorators/query-assigned-elements.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directives/class-map.js:
  (**
   * @license
   * Copyright 2018 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
