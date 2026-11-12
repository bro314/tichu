/**
 * BGA Client-Side Framework Shim (`bga-shim.js`)
 *
 * Emulates BGA Studio's client environment (`dojo`, `declare`, `define`,
 * `ebg.core.gamegui`, `ebg.stock`, `ebg.counter`, `ebg.popindialog`,
 * `GameNotifQueue`, and the Local Developer Toolbar) so `tichu.js` runs
 * identically in a local browser without any BGA server connection.
 *
 * Compatible with both:
 *  - Legacy Dojo / ES5 `Tichu` (`ebg.stock`, `ebg.popindialog`, `jstpl_*`)
 *  - Modern ES6+ Lit & RxJS `Tichu`
 */
(function () {
  "use strict";

  const initialParams = new URLSearchParams(window.location.search || "");
  let pendingAutorun = initialParams.get("autorun");
  const initialAutorunSpeed = initialParams.get("speed") || "instant";

  const initPayload = window.BGA_LOCAL_INIT || {
    playerId: 2385074,
    isSpectator: false,
    bRealtime: true,
    gamedatas: {
      players: {},
      playerorder: [],
      gamestate: {
        id: "1",
        name: "gameSetup",
        type: "manager",
        args: {},
        possibleactions: [],
        multiactive: [],
      },
      gamestates: {},
      notifications: { last_packet_id: 0, move_nbr: 1 },
      hand: [],
      handcount: {},
      capturedpoints: {},
      capturedCards: [],
      currentTrick: [],
      currentTrickValue: 0,
      allLastCombos: {},
      passes: [],
      firstoutplayer: 0,
      lastComboPlayer: "0",
      lastComboDescription: "",
      mahjongOwner: 0,
      mahjongWish: 0,
      isAllInfoExposed: 0,
      round: 0,
      trick: 0,
    },
    gamelogs: [],
    devBarPlayers: [],
    options: { gameLength: 2, playerTeams: 1, turnBased: 0 },
  };

  // ==========================================================================
  // 1. BGA Global Variables & Helper Functions
  // ==========================================================================

  window.g_gamethemeurl = "/";
  localStorage.removeItem("tichu_local_archive_mode");
  const initialGamestate = (initPayload.gamedatas && initPayload.gamedatas.gamestate) || {};
  window.g_archive_mode =
    Number(initialGamestate.id) === 99 || initialGamestate.name === "gameEnd";
  // Keep a deep clone of raw gamelogs so <tichu-replay>'s in-place tidyUpGamelogs()
  // does not corrupt our master array.
  let masterGamelogs = Array.isArray(initPayload.gamelogs)
    ? JSON.parse(JSON.stringify(initPayload.gamelogs))
    : [];
  window.g_gamelogs = JSON.parse(JSON.stringify(masterGamelogs));
  window.g_replayFrom = undefined;
  window.g_tutorialwritten = undefined;

  window.$ = function (idOrEl) {
    if (!idOrEl) return null;
    if (typeof idOrEl === "string") {
      return document.getElementById(idOrEl);
    }
    return idOrEl;
  };

  window._ = function (str) {
    if (str === null || str === undefined) return "";
    return String(str);
  };

  window.__ = function (_domain, str) {
    if (str === null || str === undefined) return "";
    return String(str);
  };

  window.toint = function (val) {
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? 0 : n;
  };

  window.getLibUrl = function (name, version) {
    return `/libs/${name}/${version}`;
  };

  window.playSound = function (sound) {
    if (localStorage.getItem("tichu_local_mute") === "1") return;
    try {
      let audio = document.getElementById("audiosrc_" + sound);
      if (!audio) {
        audio = new Audio(window.g_gamethemeurl + "img/" + sound + ".mp3");
      }
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {});
      }
    } catch (_e) {
      // Ignore audio errors in headless/restricted browsers
    }
  };

  window.stopSound = function (sound) {
    try {
      const audio = document.getElementById("audiosrc_" + sound);
      if (audio && typeof audio.pause === "function") {
        audio.pause();
      }
    } catch (_e) {}
  };

  // ==========================================================================
  // 2. Dojo Toolkit Shim (`window.dojo`)
  // ==========================================================================

  const subscriptions = Object.create(null);

  /**
   * Sanitizes legacy Dojo CSS selectors where class names start with a digit
   * (e.g. `.grandtichucolor.2385074` -> `.grandtichucolor.\32 385074`) so native
   * `querySelectorAll` does not throw a SyntaxError.
   */
  function sanitizeSelector(selector) {
    if (typeof selector !== "string") return "";
    return selector.replace(/\.(\d+)/g, function (_match, digits) {
      if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return "." + CSS.escape(digits);
      }
      return '[class~="' + digits + '"]';
    });
  }

  function enhanceQueryList(elements) {
    const arr = Array.from(elements || []);

    arr.style = function (prop, val) {
      for (let i = 0; i < arr.length; i++) {
        const el = arr[i];
        if (!el || !el.style) continue;
        if (prop.indexOf("-") !== -1) {
          el.style.setProperty(prop, val);
        } else {
          el.style[prop] = val;
        }
      }
      return arr;
    };

    arr.innerHTML = function (html) {
      const str = html === null || html === undefined ? "" : String(html);
      for (let i = 0; i < arr.length; i++) {
        if (arr[i]) arr[i].innerHTML = str;
      }
      return arr;
    };

    arr.addClass = function (cls) {
      if (!cls) return arr;
      const tokens = String(cls).trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].classList) {
          arr[i].classList.add(...tokens);
        }
      }
      return arr;
    };

    arr.removeClass = function (cls) {
      if (!cls) return arr;
      const tokens = String(cls).trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].classList) {
          arr[i].classList.remove(...tokens);
        }
      }
      return arr;
    };

    arr.toggleClass = function (cls, force) {
      if (!cls) return arr;
      const tokens = String(cls).trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].classList) {
          for (const t of tokens) {
            arr[i].classList.toggle(t, force);
          }
        }
      }
      return arr;
    };

    arr.attr = function (name, val) {
      if (val === undefined) {
        return arr[0] ? arr[0].getAttribute(name) : null;
      }
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].setAttribute) {
          arr[i].setAttribute(name, String(val));
        }
      }
      return arr;
    };

    arr.connect = function (eventName, context, method) {
      for (let i = 0; i < arr.length; i++) {
        dojo.connect(arr[i], eventName, context, method);
      }
      return arr;
    };

    return arr;
  }

  const dojo = {
    byId: function (idOrEl) {
      return window.$(idOrEl);
    },

    query: function (selector, root) {
      const ctx = (root ? window.$(root) : document) || document;
      if (!selector) return enhanceQueryList([]);
      try {
        const cleanSelector = sanitizeSelector(selector);
        return enhanceQueryList(ctx.querySelectorAll(cleanSelector));
      } catch (_err) {
        return enhanceQueryList([]);
      }
    },

    style: function (nodeOrId, prop, val) {
      const el = window.$(nodeOrId);
      if (!el || !el.style) return undefined;
      if (typeof prop === "object" && prop !== null) {
        for (const k of Object.keys(prop)) {
          dojo.style(el, k, prop[k]);
        }
        return el;
      }
      if (val === undefined) {
        return el.style[prop] || window.getComputedStyle(el)[prop];
      }
      if (prop.indexOf("-") !== -1) {
        el.style.setProperty(prop, String(val));
      } else {
        el.style[prop] = val;
      }
      return val;
    },

    addClass: function (nodeOrId, cls) {
      const el = window.$(nodeOrId);
      if (!el || !el.classList || !cls) return;
      const tokens = String(cls).trim().split(/\s+/).filter(Boolean);
      if (tokens.length) el.classList.add(...tokens);
    },

    removeClass: function (nodeOrId, cls) {
      const el = window.$(nodeOrId);
      if (!el || !el.classList || !cls) return;
      const tokens = String(cls).trim().split(/\s+/).filter(Boolean);
      if (tokens.length) el.classList.remove(...tokens);
    },

    toggleClass: function (nodeOrId, cls, condition) {
      const el = window.$(nodeOrId);
      if (!el || !el.classList || !cls) return;
      const tokens = String(cls).trim().split(/\s+/).filter(Boolean);
      for (const t of tokens) {
        el.classList.toggle(t, condition);
      }
    },

    hasClass: function (nodeOrId, cls) {
      const el = window.$(nodeOrId);
      if (!el || !el.classList || !cls) return false;
      return el.classList.contains(String(cls).trim());
    },

    empty: function (nodeOrId) {
      const el = window.$(nodeOrId);
      if (el) el.innerHTML = "";
    },

    destroy: function (nodeOrId) {
      const el = window.$(nodeOrId);
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    },

    place: function (htmlOrNode, refNodeOrId, position) {
      const ref = window.$(refNodeOrId);
      if (!ref) return null;

      let nodeToInsert = null;
      let returnedElement = null;

      if (typeof htmlOrNode === "string") {
        const tpl = document.createElement("template");
        tpl.innerHTML = htmlOrNode.trim();
        returnedElement = tpl.content.firstElementChild;
        if (tpl.content.childNodes.length === 1) {
          nodeToInsert = tpl.content.firstChild;
        } else {
          nodeToInsert = tpl.content;
        }
      } else {
        nodeToInsert = window.$(htmlOrNode);
        returnedElement = nodeToInsert;
      }

      if (!nodeToInsert) return null;

      const pos = position || "last";
      switch (pos) {
        case "only":
          ref.innerHTML = "";
          ref.appendChild(nodeToInsert);
          break;
        case "first":
          ref.insertBefore(nodeToInsert, ref.firstChild);
          break;
        case "before":
          if (ref.parentNode) ref.parentNode.insertBefore(nodeToInsert, ref);
          break;
        case "after":
          if (ref.parentNode) ref.parentNode.insertBefore(nodeToInsert, ref.nextSibling);
          break;
        case "replace":
          if (ref.parentNode) ref.parentNode.replaceChild(nodeToInsert, ref);
          break;
        case "last":
        default:
          ref.appendChild(nodeToInsert);
          break;
      }

      return returnedElement;
    },

    hitch: function (scope, method) {
      const extraArgs = Array.prototype.slice.call(arguments, 2);
      if (arguments.length === 1 && typeof scope === "function") {
        return scope;
      }
      if (!method) {
        return typeof scope === "function" ? scope : function () {};
      }
      if (typeof method === "string") {
        return function () {
          const fn = scope && scope[method];
          if (typeof fn === "function") {
            return fn.apply(scope, extraArgs.concat(Array.prototype.slice.call(arguments)));
          }
        };
      }
      if (typeof method === "function") {
        return function () {
          return method.apply(scope, extraArgs.concat(Array.prototype.slice.call(arguments)));
        };
      }
      return function () {};
    },

    connect: function (objOrId, eventName, contextOrFn, methodOrUndefined) {
      const target = typeof objOrId === "string" ? window.$(objOrId) : objOrId;
      if (!target) return { remove: function () {} };

      const cleanEvent = String(eventName || "").replace(/^on/i, "");
      const handler =
        methodOrUndefined !== undefined
          ? dojo.hitch(contextOrFn, methodOrUndefined)
          : typeof contextOrFn === "function"
            ? contextOrFn
            : function () {};

      if (typeof target.addEventListener === "function") {
        target.addEventListener(cleanEvent, handler);
        return {
          remove: function () {
            target.removeEventListener(cleanEvent, handler);
          },
        };
      }
      return { remove: function () {} };
    },

    disconnect: function (handle) {
      if (handle && typeof handle.remove === "function") {
        handle.remove();
      }
    },

    subscribe: function (topic, context, method) {
      if (!subscriptions[topic]) {
        subscriptions[topic] = [];
      }
      const fn =
        method !== undefined
          ? dojo.hitch(context, method)
          : typeof context === "function"
            ? context
            : function () {};
      const handle = {
        topic: topic,
        fn: fn,
        remove: function () {
          const list = subscriptions[topic];
          if (!list) return;
          const idx = list.indexOf(handle);
          if (idx !== -1) list.splice(idx, 1);
        },
      };
      subscriptions[topic].push(handle);
      return handle;
    },

    unsubscribe: function (handle) {
      if (handle && typeof handle.remove === "function") {
        handle.remove();
      }
    },

    publish: function (topic, argsArray) {
      const list = subscriptions[topic];
      if (!list || !list.length) return;
      const copy = list.slice();
      for (let i = 0; i < copy.length; i++) {
        copy[i].fn.apply(null, argsArray || []);
      }
    },

    marginBox: function (nodeOrId) {
      const el = window.$(nodeOrId);
      if (!el) return { w: 0, h: 0, l: 0, t: 0 };
      return {
        w: el.clientWidth || el.offsetWidth || 0,
        h: el.clientHeight || el.offsetHeight || 0,
        l: el.offsetLeft || 0,
        t: el.offsetTop || 0,
      };
    },

    contentBox: function (nodeOrId) {
      return dojo.marginBox(nodeOrId);
    },

    position: function (nodeOrId) {
      const el = window.$(nodeOrId);
      if (!el) return { x: 0, y: 0, w: 0, h: 0 };
      const rect = el.getBoundingClientRect();
      return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    },

    trim: function (str) {
      return String(str ?? "").trim();
    },

    string: {
      substitute: function (template, map) {
        if (!template) return "";
        return String(template).replace(/\$\{([^}]+)\}/g, function (_m, key) {
          return map && map[key] !== undefined ? map[key] : "";
        });
      },
    },

    fx: {
      slideTo: function (cfg) {
        return {
          play: function () {
            const node = window.$(cfg.node);
            if (node && node.style) {
              node.style.top = cfg.top + (cfg.unit || "px");
              node.style.left = cfg.left + (cfg.unit || "px");
            }
            if (typeof cfg.onEnd === "function") cfg.onEnd(node);
          },
        };
      },
      chain: function (anims) {
        return {
          play: function () {
            for (const a of anims || []) {
              if (a && typeof a.play === "function") a.play();
            }
          },
        };
      },
    },

    fadeIn: function (cfg) {
      return {
        play: function () {
          const node = window.$(cfg.node);
          if (node && node.style) node.style.opacity = "1";
          if (typeof cfg.onEnd === "function") cfg.onEnd(node);
        },
      };
    },

    fadeOut: function (cfg) {
      return {
        play: function () {
          const node = window.$(cfg.node);
          if (node && node.style) node.style.opacity = "0";
          if (typeof cfg.onEnd === "function") cfg.onEnd(node);
        },
      };
    },
  };

  window.dojo = dojo;

  // ==========================================================================
  // 3. `ebg.counter`, `ebg.popindialog`, and `ebg.stock`
  // ==========================================================================

  class EbgCounter {
    constructor() {
      this.el = null;
      this.value = 0;
    }

    create(idOrEl) {
      this.el = window.$(idOrEl);
      if (this.el) {
        const parsed = parseInt(this.el.textContent || "0", 10);
        this.value = Number.isNaN(parsed) ? 0 : parsed;
      }
    }

    getValue() {
      return this.value;
    }

    setValue(val) {
      this.value = Number(val) || 0;
      if (this.el) {
        this.el.textContent = String(this.value);
      }
    }

    toValue(val) {
      this.setValue(val);
    }

    incValue(delta) {
      this.setValue(this.value + (Number(delta) || 0));
    }
  }

  class EbgPopinDialog {
    constructor() {
      this.id = "";
      this.title = "";
      this.content = "";
      this.underlayEl = null;
      this.dialogEl = null;
    }

    create(id) {
      this.id = String(id || "dialog");
      this.destroy();

      const underlay = document.createElement("div");
      underlay.className = "bga-popin-underlay";
      underlay.id = "popin_" + this.id + "_underlay";
      underlay.style.display = "none";

      const dialog = document.createElement("div");
      dialog.className = "bga-popin-dialog";
      dialog.id = "popin_" + this.id;

      dialog.innerHTML =
        '<div class="bga-popin-titlebar">' +
        '<span class="bga-popin-title" id="popin_' +
        this.id +
        '_title"></span>' +
        '<button type="button" class="bga-popin-close" title="Close">&times;</button>' +
        "</div>" +
        '<div class="bga-popin-content" id="popin_' +
        this.id +
        '_contents"></div>';

      underlay.appendChild(dialog);
      document.body.appendChild(underlay);

      const closeBtn = dialog.querySelector(".bga-popin-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => this.destroy());
      }
      underlay.addEventListener("click", (e) => {
        if (e.target === underlay) this.destroy();
      });

      this.underlayEl = underlay;
      this.dialogEl = dialog;
    }

    setTitle(title) {
      this.title = String(title ?? "");
      const titleEl = document.getElementById("popin_" + this.id + "_title");
      if (titleEl) titleEl.innerHTML = this.title;
    }

    setContent(html) {
      this.content = String(html ?? "");
      const contentEl = document.getElementById("popin_" + this.id + "_contents");
      if (contentEl) contentEl.innerHTML = this.content;
    }

    show() {
      if (this.underlayEl) {
        this.underlayEl.style.display = "flex";
      }
    }

    hide() {
      if (this.underlayEl) {
        this.underlayEl.style.display = "none";
      }
    }

    destroy() {
      const existing = document.getElementById("popin_" + this.id + "_underlay");
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
      this.underlayEl = null;
      this.dialogEl = null;
    }
  }

  class EbgStock {
    constructor() {
      this.page = null;
      this.container_div = null;
      this.control_name = null;
      this.item_width = 0;
      this.item_height = 0;
      this.item_margin = 5;
      this.image_items_per_row = null;
      this.image_in_vertical_row = false;
      this.backgroundSize = null;
      this.item_type = {};
      this.items = [];
      this.item_selected = {};
      this.next_item_id = 1;
      this.selectable = 2;
      this.selectionApparance = "border";
      this.apparenceBorderWidth = "1px";
      this.selectionClass = "stockitem_selected";
      this.extraClasses = "";
      this.centerItems = false;
      this.autowidth = false;
      this.order_items = true;
      this.horizontal_overlap = 0;
      this.vertical_overlap = 0;
      this.use_vertical_overlap_as_offset = true;
      this.onItemCreate = null;
      this.onItemDelete = null;
      this.onChangeSelection = function () {};
      this.hResize = null;
      this.duration = 200;
    }

    create(page, container_div, item_width, item_height) {
      const el = window.$(container_div);
      this.page = page;
      this.container_div = el;
      this.item_width = Number(item_width) || 0;
      this.item_height = Number(item_height) || 0;
      this.control_name = el ? el.id : "";
      if (el && el.style && el.style.position !== "absolute") {
        el.style.position = "relative";
      }
      this.hResize = dojo.connect(window, "onresize", this, function () {
        this.updateDisplay();
      });
      if (page && typeof page.registerEbgControl === "function") {
        page.registerEbgControl(this);
      }
    }

    destroy() {
      if (this.hResize) dojo.disconnect(this.hResize);
      this.items = [];
      this.page = null;
      this.container_div = null;
      this.control_name = null;
    }

    count() {
      return this.items.length;
    }

    addItemType(type, weight, image, image_position) {
      this.item_type[type] = {
        weight: window.toint(weight),
        image: String(image || ""),
        image_position: image_position ? Number(image_position) : 0,
      };
    }

    addToStock(type, from) {
      const id = this.next_item_id++;
      this.addToStockWithId(type, id, from);
    }

    addToStockWithId(type, id, from, location) {
      const item = { id: id, type: Number(type) };
      let pushEnd = true;
      if (location !== undefined) {
        if (location === ":first") {
          pushEnd = false;
        } else {
          item.loc = location;
        }
      }

      const existingDiv = window.$(this.getItemDivId(id));
      if (existingDiv) {
        for (let i = this.items.length - 1; i >= 0; i--) {
          if (String(this.items[i].id) === String(id)) {
            this.items.splice(i, 1);
          }
        }
        dojo.destroy(existingDiv);
      }

      if (pushEnd) {
        this.items.push(item);
      } else {
        this.items.unshift(item);
      }

      if (this.order_items) {
        this.sortItems();
      }
      this.updateDisplay(from);
    }

    removeFromStock(type, to, noupdate) {
      for (let i = 0; i < this.items.length; i++) {
        if (this.items[i].type == type) {
          this._removeFromStockItemInPosition(i, to, noupdate);
          return true;
        }
      }
      return false;
    }

    removeFromStockById(id, to, noupdate) {
      for (let i = 0; i < this.items.length; i++) {
        if (String(this.items[i].id) === String(id)) {
          this._removeFromStockItemInPosition(i, to, noupdate);
          return true;
        }
      }
      return false;
    }

    _removeFromStockItemInPosition(pos, _to, noupdate) {
      const item = this.items[pos];
      if (!item) return;
      const divId = this.getItemDivId(item.id);
      if (typeof this.onItemDelete === "function") {
        this.onItemDelete(divId, item.type, item.id);
      }
      this.items.splice(pos, 1);
      this.unselectItem(item.id);
      dojo.destroy(divId);
      if (noupdate !== true) {
        this.updateDisplay();
      }
    }

    removeAll() {
      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        if (typeof this.onItemDelete === "function") {
          this.onItemDelete(this.getItemDivId(item.id), item.type, item.id);
        }
      }
      this.items = [];
      this.item_selected = {};
      this.next_item_id = 1;
      if (this.container_div) {
        this.container_div.innerHTML = "";
      }
    }

    removeAllTo(to) {
      const ids = this.items.map((it) => it.id);
      for (const id of ids) {
        this.removeFromStockById(id, to, true);
      }
      this.updateDisplay();
    }

    getItemDivId(id) {
      return this.control_name + "_item_" + id;
    }

    sortItems() {
      this.items.sort((a, b) => {
        const wa = this.item_type[a.type] ? this.item_type[a.type].weight : 0;
        const wb = this.item_type[b.type] ? this.item_type[b.type].weight : 0;
        return wa > wb ? 1 : wa < wb ? -1 : 0;
      });
    }

    changeItemsWeight(weightsMap) {
      if (weightsMap && typeof weightsMap === "object") {
        for (const type of Object.keys(weightsMap)) {
          if (this.item_type[type]) {
            this.item_type[type].weight = Number(weightsMap[type]);
          }
        }
      }
      this.sortItems();
      this.updateDisplay();
    }

    setOverlap(horizontal_overlap, vertical_overlap) {
      this.horizontal_overlap = Number(horizontal_overlap) || 0;
      this.vertical_overlap = vertical_overlap === undefined ? 0 : Number(vertical_overlap) || 0;
      this.updateDisplay();
    }

    updateDisplay(_from) {
      const container = this.container_div || window.$(this.control_name);
      if (!container) return;

      let stepWidth = this.item_width;
      let overlapRemainder = 0;
      let zIndex = "auto";

      if (this.horizontal_overlap !== 0) {
        stepWidth = Math.round((this.item_width * this.horizontal_overlap) / 100);
        overlapRemainder = this.item_width - stepWidth;
        zIndex = 1;
      }

      let verticalOverlapPx = 0;
      if (this.vertical_overlap !== 0) {
        verticalOverlapPx =
          Math.round((this.item_height * this.vertical_overlap) / 100) *
          (this.use_vertical_overlap_as_offset ? 1 : -1);
      }

      const containerWidth = container.clientWidth || 600;
      const itemsPerRow = Math.max(
        1,
        Math.floor((containerWidth - overlapRemainder) / (stepWidth + this.item_margin)),
      );

      let maxRow = 0;
      let index = 0;

      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        const divId = this.getItemDivId(item.id);
        if (zIndex !== "auto") zIndex++;

        const row = Math.floor(index / itemsPerRow);
        maxRow = Math.max(maxRow, row);
        let top = maxRow * (this.item_height + verticalOverlapPx + this.item_margin);
        let left = (index - maxRow * itemsPerRow) * (stepWidth + this.item_margin);
        if (
          this.vertical_overlap !== 0 &&
          index % 2 === 0 &&
          this.use_vertical_overlap_as_offset
        ) {
          top += verticalOverlapPx;
        }
        index++;

        let itemDiv = window.$(divId);
        if (itemDiv) {
          itemDiv.style.top = top + "px";
          itemDiv.style.left = left + "px";
          if (zIndex !== "auto") {
            itemDiv.style.zIndex = String(zIndex);
          }
        } else {
          const typeDef = this.item_type[item.type];
          if (!typeDef) continue;

          itemDiv = document.createElement("div");
          itemDiv.id = divId;
          itemDiv.className = ("stockitem " + (this.extraClasses || "")).trim();
          if (this.selectable === 0) {
            itemDiv.classList.add("stockitem_unselectable");
          }
          if (this.isSelected(item.id)) {
            itemDiv.classList.add(this.selectionClass);
          }
          itemDiv.style.top = top + "px";
          itemDiv.style.left = left + "px";
          itemDiv.style.width = this.item_width + "px";
          itemDiv.style.height = this.item_height + "px";
          if (zIndex !== "auto") {
            itemDiv.style.zIndex = String(zIndex);
          }
          itemDiv.style.backgroundImage = "url('" + typeDef.image + "')";
          if (this.backgroundSize !== null) {
            itemDiv.style.backgroundSize = this.backgroundSize;
          }

          const pos = window.toint(typeDef.image_position);
          if (pos !== 0) {
            let bgX = 0;
            let bgY = 0;
            if (this.image_items_per_row) {
              const spriteRow = Math.floor(pos / this.image_items_per_row);
              const spriteCol = pos - spriteRow * this.image_items_per_row;
              if (this.image_in_vertical_row) {
                bgY = spriteCol * this.item_height;
                bgX = spriteRow * this.item_width;
              } else {
                bgX = spriteCol * this.item_width;
                bgY = spriteRow * this.item_height;
              }
            } else {
              bgX = pos * this.item_width;
              bgY = 0;
            }
            itemDiv.style.backgroundPosition = "-" + bgX + "px -" + bgY + "px";
          } else {
            itemDiv.style.backgroundPosition = "0px 0px";
          }

          container.appendChild(itemDiv);
          dojo.connect(itemDiv, "onclick", this, "onClickOnItem");

          if (typeof this.onItemCreate === "function") {
            this.onItemCreate(itemDiv, item.type, divId);
          }
        }
      }

      const totalHeight =
        (maxRow + 1) * (this.item_height + verticalOverlapPx + this.item_margin);
      container.style.height = totalHeight + "px";
    }

    setSelectionMode(mode) {
      if (mode !== this.selectable) {
        this.unselectAll();
        this.selectable = mode;
        if (this.control_name) {
          if (mode === 0) {
            dojo.query("#" + this.control_name + " .stockitem").addClass("stockitem_unselectable");
          } else {
            dojo
              .query("#" + this.control_name + " .stockitem_unselectable")
              .removeClass("stockitem_unselectable");
          }
        }
      }
    }

    setSelectionAppearance(appearance) {
      this.unselectAll();
      this.selectionApparance = appearance;
    }

    isSelected(id) {
      return Boolean(this.item_selected[String(id)]);
    }

    selectItem(id) {
      const itemDiv = window.$(this.getItemDivId(id));
      if (itemDiv) {
        if (this.selectionApparance === "border") {
          itemDiv.style.borderWidth = this.apparenceBorderWidth;
        } else if (this.selectionApparance === "class") {
          itemDiv.classList.add(this.selectionClass);
        }
      }
      this.item_selected[String(id)] = 1;
    }

    unselectItem(id) {
      const itemDiv = window.$(this.getItemDivId(id));
      if (itemDiv) {
        if (this.selectionApparance === "border") {
          itemDiv.style.borderWidth = "0px";
        } else if (this.selectionApparance === "class") {
          itemDiv.classList.remove(this.selectionClass);
        }
      }
      this.item_selected[String(id)] = 0;
    }

    unselectAll() {
      let changed = false;
      for (let i = 0; i < this.items.length; i++) {
        const id = this.items[i].id;
        if (this.isSelected(id)) {
          this.unselectItem(id);
          changed = true;
        }
      }
      this.item_selected = {};
      if (changed && typeof this.onChangeSelection === "function") {
        this.onChangeSelection(this.control_name);
      }
    }

    onClickOnItem(evt) {
      evt.stopPropagation();
      if (this.selectable === 0) return;
      const prefix = this.control_name + "_item_";
      const targetId = evt.currentTarget && evt.currentTarget.id ? evt.currentTarget.id : "";
      const itemId = targetId.substring(prefix.length);
      if (this.isSelected(itemId)) {
        this.unselectItem(itemId);
      } else {
        if (this.selectable === 1) {
          this.unselectAll();
        }
        this.selectItem(itemId);
      }
      if (typeof this.onChangeSelection === "function") {
        this.onChangeSelection(this.control_name, itemId);
      }
    }

    getSelectedItems() {
      const res = [];
      for (let i = 0; i < this.items.length; i++) {
        if (this.isSelected(this.items[i].id)) {
          res.push(this.items[i]);
        }
      }
      return res;
    }

    getUnselectedItems() {
      const res = [];
      for (let i = 0; i < this.items.length; i++) {
        if (!this.isSelected(this.items[i].id)) {
          res.push(this.items[i]);
        }
      }
      return res;
    }

    getAllItems() {
      return this.items.slice();
    }

    getItemNumber() {
      return this.items.length;
    }
  }

  // ==========================================================================
  // 4. Card Formatting, Console Announcer & Synchronous Notification Queue
  // ==========================================================================

  let consoleVerbose = true;

  const SUIT_CODES = { 1: "S", 2: "R", 3: "B", 4: "G" };
  const SUIT_SYMBOLS = { 1: "♠", 2: "★", 3: "💙", 4: "🟢" };
  const RANK_LABELS = {
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
    14: "A",
  };
  const SPECIAL_CODES = { 1: "DR", 2: "PH", 3: "DOG", 4: "MJ" };
  const SPECIAL_NAMES = { 1: "Dragon", 2: "Phoenix", 3: "Dog", 4: "Mahjong" };

  function cardFromStockType(stockTypeVal, id) {
    const st = Number(stockTypeVal);
    const color = Math.floor(st / 14) + 1;
    const value = (st % 14) + 1;
    return {
      id: String(id ?? ""),
      type: String(color),
      type_arg: String(value),
    };
  }

  function normalizeCardObj(cardOrItem) {
    if (!cardOrItem || typeof cardOrItem !== "object") return null;
    if (cardOrItem.type_arg !== undefined) {
      return {
        id: String(cardOrItem.id ?? ""),
        type: Number(cardOrItem.type),
        type_arg: Number(cardOrItem.type_arg),
      };
    }
    if (cardOrItem.type !== undefined) {
      const converted = cardFromStockType(cardOrItem.type, cardOrItem.id);
      return {
        id: converted.id,
        type: Number(converted.type),
        type_arg: Number(converted.type_arg),
      };
    }
    return null;
  }

  function formatCardCode(cardOrItem) {
    const c = normalizeCardObj(cardOrItem);
    if (!c) return "?";
    if (c.type_arg === 1) {
      return SPECIAL_CODES[c.type] || "SP";
    }
    return (SUIT_CODES[c.type] || "?") + (RANK_LABELS[c.type_arg] || String(c.type_arg));
  }

  function formatCardPretty(cardOrItem, withId) {
    const c = normalizeCardObj(cardOrItem);
    if (!c) return "?";
    let label = "";
    if (c.type_arg === 1) {
      label = SPECIAL_CODES[c.type] || "SP";
    } else {
      label = (RANK_LABELS[c.type_arg] || String(c.type_arg)) + (SUIT_SYMBOLS[c.type] || "");
    }
    if (withId && c.id) {
      return `${label}(#${c.id})`;
    }
    return label;
  }

  function formatRankLabel(rank) {
    const r = Number(rank);
    if (r === 1) return "MJ";
    if (r === 15) return "None";
    return RANK_LABELS[r] || String(rank);
  }

  function parseRankToken(tok) {
    if (tok === null || tok === undefined) return null;
    const s = String(tok).trim().toUpperCase();
    if (s === "NONE" || s === "NO" || s === "0" || s === "15") return 15;
    if (s === "J" || s === "JACK") return 11;
    if (s === "Q" || s === "QUEEN") return 12;
    if (s === "K" || s === "KING") return 13;
    if (s === "A" || s === "ACE") return 14;
    if (s === "MJ" || s === "MAHJONG" || s === "1") return 1;
    const n = parseInt(s, 10);
    if (!Number.isNaN(n) && n >= 2 && n <= 15) return n;
    return null;
  }

  function parseCardSpecToken(rawToken) {
    if (rawToken && typeof rawToken === "object") {
      const c = normalizeCardObj(rawToken);
      if (c && c.id) return { kind: "id", id: String(c.id) };
      if (c) return { kind: "exact", suit: c.type, rank: c.type_arg };
    }
    const raw = String(rawToken ?? "").trim();
    if (!raw) return null;

    if (raw.startsWith("#")) {
      return { kind: "id", id: raw.slice(1).trim() };
    }

    const upper = raw.toUpperCase();
    if (upper === "DR" || upper === "DRAGON") return { kind: "exact", suit: 1, rank: 1 };
    if (upper === "PH" || upper === "PHOENIX") return { kind: "exact", suit: 2, rank: 1 };
    if (upper === "DOG" || upper === "HOUND") return { kind: "exact", suit: 3, rank: 1 };
    if (upper === "MJ" || upper === "MAHJONG") return { kind: "exact", suit: 4, rank: 1 };

    // Suit + Rank (e.g. S5, RA, B10, GK) or Rank + Suit (e.g. 5S, 5♠, 10B, KG)
    const suitMap = {
      S: 1,
      "♠": 1,
      R: 2,
      "★": 2,
      "♥": 2,
      B: 3,
      "💙": 3,
      "♣": 3,
      G: 4,
      "🟢": 4,
      "♦": 4,
    };

    const suitFirst = upper.match(/^([SRBG♠★♥💙♣🟢♦])\s*(10|[2-9]|[JQKA])$/u);
    if (suitFirst) {
      const suit = suitMap[suitFirst[1]];
      const rank = parseRankToken(suitFirst[2]);
      if (suit && rank) return { kind: "exact", suit, rank };
    }

    const rankFirst = upper.match(/^(10|[2-9]|[JQKA])\s*([SRBG♠★♥💙♣🟢♦])$/u);
    if (rankFirst) {
      const rank = parseRankToken(rankFirst[1]);
      const suit = suitMap[rankFirst[2]];
      if (suit && rank) return { kind: "exact", suit, rank };
    }

    if (["J", "Q", "K", "A"].includes(upper)) {
      return { kind: "rank", rank: parseRankToken(upper) };
    }

    const num = Number(upper);
    if (Number.isInteger(num) && num > 0) {
      return { kind: "number", value: num, id: String(num) };
    }

    return null;
  }

  /**
   * Resolves a flexible card specification into an array of Card objects from `handCards`.
   * Accepts:
   * - Card IDs: `[12, 45]` or `"12;45"` or `["#12", "#45"]`
   * - Card codes: `["MJ"]`, `["S5", "R6", "B7", "G8", "PH"]`, `["7", "7", "7", "7"]`
   * - Ranks: `[2]` or `["A"]`
   */
  function resolveCardsFromHand(input, handCards) {
    const hand = (handCards || []).map(normalizeCardObj).filter(Boolean);
    if (input === undefined || input === null) {
      return null;
    }

    let tokens = [];
    let forceIdMode = false;
    if (typeof input === "string") {
      if (input.includes(";")) {
        forceIdMode = true;
        tokens = input
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        tokens = input
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } else if (Array.isArray(input)) {
      tokens = input;
    } else {
      tokens = [input];
    }

    if (tokens.length === 0) return [];

    const parsed = tokens.map(parseCardSpecToken);
    if (parsed.some((p) => !p)) {
      throw new Error(`Invalid card specification in: ${JSON.stringify(input)}`);
    }

    // Decide how to treat bare numbers:
    // If forceIdMode is true, or if all tokens are distinct numbers matching card IDs in hand
    // AND (at least one number > 14 OR at least one number doesn't match any rank in hand),
    // treat numbers as card IDs. Otherwise treat numbers 2..14 as ranks first (falling back to ID).
    const handIdSet = new Set(hand.map((c) => String(c.id)));
    const handRankSet = new Set(hand.map((c) => Number(c.type_arg)));
    const allNumeric = parsed.every((p) => p.kind === "number");
    const uniqueNumStrs = new Set(parsed.map((p) => String(p.value)));
    const allMatchHandIds =
      allNumeric &&
      uniqueNumStrs.size === parsed.length &&
      parsed.every((p) => handIdSet.has(String(p.value)));
    const anyGreaterThan14 = allNumeric && parsed.some((p) => p.value > 14);
    const anyMissingRank = allNumeric && parsed.some((p) => !handRankSet.has(p.value));

    const preferIdForNumbers =
      forceIdMode || (allMatchHandIds && (anyGreaterThan14 || anyMissingRank));

    const usedIds = new Set();
    const resolved = [];

    for (const spec of parsed) {
      let chosen = null;

      if (spec.kind === "id") {
        chosen = hand.find((c) => !usedIds.has(c.id) && String(c.id) === String(spec.id));
      } else if (spec.kind === "exact") {
        chosen = hand.find(
          (c) => !usedIds.has(c.id) && c.type === spec.suit && c.type_arg === spec.rank,
        );
      } else if (spec.kind === "rank") {
        chosen = hand.find((c) => !usedIds.has(c.id) && c.type_arg === spec.rank);
      } else if (spec.kind === "number") {
        if (preferIdForNumbers) {
          chosen = hand.find((c) => !usedIds.has(c.id) && String(c.id) === String(spec.value));
        }
        if (!chosen && spec.value >= 1 && spec.value <= 14) {
          chosen = hand.find((c) => !usedIds.has(c.id) && c.type_arg === spec.value);
        }
        if (!chosen) {
          chosen = hand.find((c) => !usedIds.has(c.id) && String(c.id) === String(spec.value));
        }
      }

      if (!chosen) {
        const availableStr = hand.map((c) => `${formatCardCode(c)}(#${c.id})`).join(", ");
        throw new Error(
          `Could not find card matching ${JSON.stringify(spec)} in hand: [${availableStr}]`,
        );
      }

      usedIds.add(chosen.id);
      resolved.push(chosen);
    }

    return resolved;
  }

  function consoleAnnounce(tag, msg, style) {
    if (!consoleVerbose) return;
    try {
      window.console.log(`%c${tag}%c ${msg}`, style || "font-weight:bold;color:#58a6ff", "");
    } catch (_e) {
      window.console.log(`${tag} ${msg}`);
    }
  }

  class GameNotifQueue {
    constructor(game) {
      this.game = game;
      this.queue = [];
      this.synchronous_notifs = Object.create(null);
      this.dynamicDuration = null;
      this.isProcessing = false;
      this.speedMode = "normal"; // "normal" | "fast" | "instant"
      this._processTimer = null;
      this._acceptCardsTimeouts = [];
      this.last_packet_id = Number(
        (initPayload.gamedatas &&
          initPayload.gamedatas.notifications &&
          initPayload.gamedatas.notifications.last_packet_id) ||
          0,
      );
      this.dispatchedUids = new Set();
      this.nextPrivateArgs = null;
      this.onDrainCallbacks = [];
    }

    setSpeed(mode) {
      const m = String(mode || "normal").toLowerCase();
      if (m === "instant" || m === "fast" || m === "normal") {
        this.speedMode = m;
      }
      return this.speedMode;
    }

    reset(newLastPacketId) {
      if (this._processTimer) {
        clearTimeout(this._processTimer);
        this._processTimer = null;
      }
      for (const tid of this._acceptCardsTimeouts.splice(0)) {
        clearTimeout(tid);
      }
      this.queue = [];
      this.isProcessing = false;
      this.dynamicDuration = null;
      this.nextPrivateArgs = null;
      if (newLastPacketId !== undefined && newLastPacketId !== null) {
        this.last_packet_id = Number(newLastPacketId) || 0;
      }
      this.dispatchedUids.clear();
      const cbs = this.onDrainCallbacks.splice(0);
      for (const cb of cbs) {
        try {
          cb();
        } catch (_e) {}
      }
    }

    setSynchronous(notifType, duration) {
      // duration === undefined means handler will call setSynchronousDuration(ms)
      this.synchronous_notifs[notifType] = duration;
    }

    setSynchronousDuration(duration) {
      this.dynamicDuration = Number(duration) || 1;
    }

    setIgnoreNotificationCheck(_notifType, _predicate) {}

    enqueuePackets(packets) {
      if (!Array.isArray(packets) || !packets.length) return;
      for (const pkt of packets) {
        const pktId = Number(pkt.packet_id || 0);
        if (pktId > this.last_packet_id) {
          this.last_packet_id = pktId;
        }
        // Keep master gamelogs updated for replay mode
        if (!masterGamelogs.some((existing) => String(existing.packet_id) === String(pkt.packet_id))) {
          masterGamelogs.push(JSON.parse(JSON.stringify(pkt)));
        }
        const dataArr = Array.isArray(pkt.data) ? pkt.data : [];
        for (const notif of dataArr) {
          if (notif.uid && this.dispatchedUids.has(notif.uid)) {
            continue;
          }
          if (notif.uid) {
            this.dispatchedUids.add(notif.uid);
          }
          this.queue.push(notif);
        }
      }
      window.g_gamelogs = JSON.parse(JSON.stringify(masterGamelogs));
      this.processNext();
    }

    whenDrained(cb) {
      if (!this.isProcessing && this.queue.length === 0) {
        cb();
      } else {
        this.onDrainCallbacks.push(cb);
      }
    }

    waitUntilIdle() {
      return new Promise((resolve) => {
        this.whenDrained(() => {
          setTimeout(resolve, 0);
        });
      });
    }

    _scaleDuration(ms) {
      const raw = Math.max(0, Number(ms) || 0);
      if (this.speedMode === "instant") {
        return Math.min(raw, 5);
      }
      if (this.speedMode === "fast") {
        return Math.min(raw, 80);
      }
      return raw;
    }

    processNext() {
      if (this.isProcessing) return;
      if (this.queue.length === 0) {
        const cbs = this.onDrainCallbacks.splice(0);
        for (const cb of cbs) {
          try {
            cb();
          } catch (_e) {}
        }
        if (this.game && typeof this.game._onQueueDrained === "function") {
          this.game._onQueueDrained();
        }
        return;
      }

      this.isProcessing = true;
      const notif = this.queue.shift();
      this.dynamicDuration = null;

      let waitMs = 0;
      const isSyncRegistered = Object.prototype.hasOwnProperty.call(
        this.synchronous_notifs,
        notif.type,
      );

      try {
        this.dispatchSingleNotif(notif);
      } catch (err) {
        console.error("Error dispatching notification:", notif, err);
      }

      if (isSyncRegistered) {
        const registeredDur = this.synchronous_notifs[notif.type];
        if (this.dynamicDuration !== null) {
          waitMs = this.dynamicDuration;
        } else if (typeof registeredDur === "number") {
          waitMs = registeredDur;
        } else {
          waitMs = 10;
        }
      }

      const scaledWaitMs = this._scaleDuration(waitMs);

      this._processTimer = setTimeout(() => {
        this._processTimer = null;
        this.isProcessing = false;
        this.processNext();
      }, Math.max(0, scaledWaitMs));
    }

    dispatchSingleNotif(notif) {
      const game = this.game;
      if (!game || !notif) return;

      // Render log message if non-empty
      if (notif.log && String(notif.log).trim() !== "") {
        game._appendLogEntry(notif.log, notif.args || {});
      }

      // Built-in framework state notifications
      if (notif.type === "gameStateChangePrivateArg") {
        this.nextPrivateArgs = notif.args;
        return;
      }

      if (notif.type === "gameStateChange") {
        const newState = notif.args;
        if (!newState) return;
        if (this.nextPrivateArgs !== null) {
          if (!newState.args || typeof newState.args !== "object" || Array.isArray(newState.args)) {
            newState.args = {};
          }
          if (!newState.args._private) {
            newState.args._private = this.nextPrivateArgs;
          }
          this.nextPrivateArgs = null;
        }
        game._transitionToState(newState);
        return;
      }

      if (notif.type === "gameStateMultipleActiveUpdate") {
        if (game.gamedatas && game.gamedatas.gamestate) {
          game.gamedatas.gamestate.multiactive = Array.isArray(notif.args)
            ? notif.args.map(String)
            : [];
          game.updatePageTitle(game.gamedatas.gamestate);
          game.onUpdateActionButtons(
            game.gamedatas.gamestate.name,
            game.gamedatas.gamestate.args,
          );
          game._renderDevBar();
          game._logStateAnnouncement();
        }
        return;
      }

      game._logNotifAnnouncement(notif);

      if (notif.type === "tableWindow") {
        game._showTableWindow(notif.args || {});
        return;
      }

      // Intercept setTimeout inside notif_acceptCards so the 2000ms slide delay respects speedMode
      if (notif.type === "acceptCards") {
        const origSetTimeout = window.setTimeout;
        const selfQueue = this;
        window.setTimeout = function (fn, delay, ...rest) {
          let adjustedDelay = delay;
          if (Number(delay) >= 1000) {
            if (selfQueue.speedMode === "instant") {
              adjustedDelay = 1;
            } else if (selfQueue.speedMode === "fast") {
              adjustedDelay = 50;
            }
          }
          const tid = origSetTimeout.call(window, fn, adjustedDelay, ...rest);
          selfQueue._acceptCardsTimeouts.push(tid);
          return tid;
        };
        try {
          dojo.publish(notif.type, [notif]);
        } finally {
          window.setTimeout = origSetTimeout;
        }
      } else {
        // Publish to game's dojo.subscribe handlers (e.g. notif_playCombo)
        dojo.publish(notif.type, [notif]);
      }

      // Keep gamedatas.hand, handcount, capturedpoints, and allLastCombos in sync after notifications
      game._syncGamedatasAfterNotif(notif);
    }
  }

  // ==========================================================================
  // 5. `ebg.core.gamegui` (`GameGui`) Base Class
  // ==========================================================================

  const DEFAULT_PREFS = {
    100: 1, // Table layout: 1 = List, 2 = Square
    101: 1, // Order of play: 1 = Counterclockwise, 2 = Clockwise
    102: 1, // Unselect before passing: 1 = Enabled, 2 = Disabled
    103: 2, // Edition: 1 = Tiki, 2 = Standard
    104: 0, // Color Theme: 0..10
  };

  class GameGui {
    constructor() {
      this.gamedatas = initPayload.gamedatas;
      this.player_id = Number(initPayload.playerId);
      this.isSpectator = Boolean(initPayload.isSpectator);
      this.bRealtime = Boolean(initPayload.bRealtime);
      this.instantaneousMode = false;
      this.scoreCtrl = {};
      this.ebgControls = [];
      this.prefs = {};
      this.devBarPlayers = initPayload.devBarPlayers || [];
      this.localOptions = initPayload.options || { gameLength: 2, playerTeams: 1, turnBased: 0 };
      this.notifqueue = new GameNotifQueue(this);
      this._botBusy = false;
      this._autoBotTimer = null;
      this._autoSwitchTimer = null;
      this._otherPlayerAutoCollectTimeout = null;
      this._devTooltipBound = false;

      this.statusBar = {
        setTitle: (title, args) => {
          const formatted = this.format_string_recursive(title, args || {});
          const el = document.getElementById("pagemaintitletext");
          if (el) el.innerHTML = formatted;
        },
        addActionButton: (label, callback, params = {}) => {
          const id = params.id || "status_btn_" + Math.random().toString(36).slice(2, 8);
          const color = params.color || "blue";
          this.addActionButton(id, label, callback, params.destination, false, color);
          return document.getElementById(id);
        },
        removeActionButtons: () => {
          this.removeActionButtons();
        },
      };

      this.sounds = {
        load: function () {},
        play: function (id) {
          window.playSound(id);
        },
      };
    }

    registerEbgControl(ctrl) {
      this.ebgControls.push(ctrl);
    }

    getCurrentPlayerId() {
      return this.player_id;
    }

    getCurrentPlayer() {
      return (this.gamedatas && this.gamedatas.players && this.gamedatas.players[this.player_id]) || null;
    }

    isCurrentPlayerSpectator() {
      return this.isSpectator;
    }

    isCurrentPlayerActive() {
      if (this.isSpectator) return false;
      const st = this.gamedatas && this.gamedatas.gamestate;
      if (!st) return false;
      if (st.type === "activeplayer") {
        return Number(st.active_player) === Number(this.player_id);
      }
      if (st.type === "multipleactiveplayer") {
        const list = Array.isArray(st.multiactive) ? st.multiactive : [];
        return list.some((id) => Number(id) === Number(this.player_id));
      }
      return false;
    }

    isPlayerActive(playerId) {
      const st = this.gamedatas && this.gamedatas.gamestate;
      if (!st) return false;
      if (st.type === "activeplayer") {
        return Number(st.active_player) === Number(playerId);
      }
      if (st.type === "multipleactiveplayer") {
        const list = Array.isArray(st.multiactive) ? st.multiactive : [];
        return list.some((id) => Number(id) === Number(playerId));
      }
      return false;
    }

    getActivePlayerId() {
      const st = this.gamedatas && this.gamedatas.gamestate;
      if (!st || st.type !== "activeplayer") return null;
      return st.active_player ? Number(st.active_player) : null;
    }

    getActivePlayers() {
      const st = this.gamedatas && this.gamedatas.gamestate;
      if (!st) return [];
      if (st.type === "activeplayer" && st.active_player) {
        return [Number(st.active_player)];
      }
      if (st.type === "multipleactiveplayer" && Array.isArray(st.multiactive)) {
        return st.multiactive.map(Number);
      }
      return [];
    }

    checkAction(action, nomessage) {
      if (!this.isCurrentPlayerActive()) {
        if (!nomessage) {
          this.showMessage(window._("This is not your turn"), "error");
        }
        return false;
      }
      return this.checkPossibleActions(action, nomessage);
    }

    checkPossibleActions(action, nomessage) {
      const st = this.gamedatas && this.gamedatas.gamestate;
      const possible = (st && Array.isArray(st.possibleactions) && st.possibleactions) || [];
      if (!possible.includes(action)) {
        if (!nomessage) {
          this.showMessage(window._("This move is not authorized now"), "error");
        }
        return false;
      }
      return true;
    }

    getGameUserPreference(prefId) {
      const key = "tichu_pref_" + prefId;
      const stored = localStorage.getItem(key);
      if (stored !== null && stored !== "") {
        const num = Number(stored);
        if (!Number.isNaN(num)) return num;
      }
      return DEFAULT_PREFS[prefId] !== undefined ? DEFAULT_PREFS[prefId] : 0;
    }

    setGameUserPreference(prefId, value) {
      const key = "tichu_pref_" + prefId;
      localStorage.setItem(key, String(value));
      if (typeof this.onGameUserPreferenceChanged === "function") {
        this.onGameUserPreferenceChanged(Number(prefId), Number(value));
      }
    }

    getTableOption(optionId) {
      if (optionId === 100) return this.localOptions.gameLength || 2;
      if (optionId === 101) return this.localOptions.playerTeams || 1;
      return 1;
    }

    format_block(jstplName, args) {
      const tpl = window[jstplName];
      if (typeof tpl !== "string") return "";
      return tpl.replace(/\$\{([^}]+)\}/g, function (_m, key) {
        return args && args[key] !== undefined ? args[key] : "";
      });
    }

    getFormattedPlayerName(playerId, params) {
      const p = this.gamedatas && this.gamedatas.players && this.gamedatas.players[playerId];
      if (!p) return "Player " + playerId;
      const label =
        params && params.replaceByYou && Number(playerId) === Number(this.player_id)
          ? window._("You")
          : p.name;
      return '<span style="font-weight:700;color:#' + (p.color || "000000") + '">' + label + "</span>";
    }

    format_string_recursive(log, args) {
      if (!log) return "";
      if (!args || typeof args !== "object") return String(log);

      return String(log).replace(/\$\{([^}]+)\}/g, (_match, key) => {
        if (key === "you") {
          return this.getFormattedPlayerName(this.player_id, { replaceByYou: true });
        }
        if (key === "actplayer") {
          const actId = this.gamedatas && this.gamedatas.gamestate && this.gamedatas.gamestate.active_player;
          if (actId) {
            return this.getFormattedPlayerName(actId, { replaceByYou: false });
          }
          return args.actplayer || "";
        }
        if (key === "player_name" && args.player_id && this.gamedatas.players[args.player_id]) {
          return this.getFormattedPlayerName(args.player_id, { replaceByYou: false });
        }
        const val = args[key];
        if (val === undefined || val === null) return "";
        if (typeof val === "object" && val.log !== undefined) {
          return this.format_string_recursive(val.log, val.args || {});
        }
        return String(val);
      });
    }

    updatePageTitle(state) {
      const st = state || (this.gamedatas && this.gamedatas.gamestate);
      if (!st) return;

      const isMyTurn = this.isCurrentPlayerActive();
      const rawDesc =
        isMyTurn && st.descriptionmyturn ? st.descriptionmyturn : st.description || "";
      const formatted = this.format_string_recursive(rawDesc, st.args || {});
      const titleEl = document.getElementById("pagemaintitletext");
      if (titleEl) {
        titleEl.innerHTML = formatted;
      }
    }

    addActionButton(id, label, method, destination, blinking, color) {
      const destEl = destination ? window.$(destination) : document.getElementById("generalactions");
      if (!destEl) return;

      const existing = document.getElementById(id);
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }

      const btn = document.createElement("a");
      btn.id = id;
      btn.href = "#";
      const btnColor = color || "blue";
      btn.className =
        "bgabutton bgabutton_" + btnColor + (blinking ? " blinking" : "");
      btn.innerHTML = String(label ?? "");

      const handler =
        typeof method === "string" ? dojo.hitch(this, method) : dojo.hitch(this, method);
      btn.addEventListener("click", (evt) => {
        evt.preventDefault();
        if (btn.classList.contains("disabled")) return;
        handler(evt);
      });

      destEl.appendChild(btn);
    }

    removeActionButtons() {
      const destEl = document.getElementById("generalactions");
      if (destEl) {
        destEl.innerHTML = "";
      }
    }

    disablePlayerPanel(playerId) {
      const panel = document.getElementById("overall_player_board_" + playerId);
      if (panel) panel.classList.add("disabled_panel");
    }

    enablePlayerPanel(playerId) {
      const panel = document.getElementById("overall_player_board_" + playerId);
      if (panel) panel.classList.remove("disabled_panel");
    }

    enableAllPlayerPanels() {
      dojo.query(".player-board").removeClass("disabled_panel");
    }

    addTooltip(nodeId, help, action) {
      const el = window.$(nodeId);
      if (!el) return;
      const text = [help, action]
        .filter(Boolean)
        .join(" — ")
        .replace(/<[^>]+>/g, " ");
      if (text) {
        el.setAttribute("title", text);
      } else {
        el.removeAttribute("title");
      }
    }

    addTooltipHtml(nodeId, html) {
      this.addTooltip(nodeId, html, "");
    }

    addTooltipToClass(cssClass, help, action) {
      const cleanClass = String(cssClass || "").replace(/^\./, "");
      if (!cleanClass) return;
      const text = [help, action]
        .filter(Boolean)
        .join(" — ")
        .replace(/<[^>]+>/g, " ");
      dojo.query("." + cleanClass).forEach((el) => {
        if (text) el.setAttribute("title", text);
      });
    }

    fadeOutAndDestroy(idOrEl, duration, delay) {
      const el = window.$(idOrEl);
      if (!el) return;
      const rawDur = duration !== undefined ? Number(duration) : 1000;
      const rawDel = delay !== undefined ? Number(delay) : 0;
      const mode = this.notifqueue ? this.notifqueue.speedMode : "normal";
      const dur = mode === "instant" ? Math.min(rawDur, 5) : mode === "fast" ? Math.min(rawDur, 60) : rawDur;
      const del = mode === "instant" ? Math.min(rawDel, 1) : mode === "fast" ? Math.min(rawDel, 30) : rawDel;

      setTimeout(() => {
        if (!el.parentNode) return;
        el.style.transition = `opacity ${dur}ms ease`;
        el.style.opacity = "0";
        setTimeout(() => {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, dur);
      }, del);
    }

    slideToObjectAndDestroy(idOrEl, targetIdOrEl, duration, delay) {
      const el = window.$(idOrEl);
      const target = window.$(targetIdOrEl);
      if (!el) return;
      if (!target) {
        dojo.destroy(el);
        return;
      }

      const rawDur = duration !== undefined ? Number(duration) : 500;
      const rawDel = delay !== undefined ? Number(delay) : 0;
      const mode = this.notifqueue ? this.notifqueue.speedMode : "normal";
      const dur = mode === "instant" ? Math.min(rawDur, 5) : mode === "fast" ? Math.min(rawDur, 60) : rawDur;
      const del = mode === "instant" ? Math.min(rawDel, 1) : mode === "fast" ? Math.min(rawDel, 20) : rawDel;

      setTimeout(() => {
        if (!el.parentNode) return;
        const startRect = el.getBoundingClientRect();
        const endRect = target.getBoundingClientRect();
        const scale = el.offsetWidth > 0 ? startRect.width / el.offsetWidth : 1;
        const dx =
          (endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2)) /
          (scale || 1);
        const dy =
          (endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2)) /
          (scale || 1);

        if (typeof el.animate === "function") {
          const anim = el.animate(
            [
              { transform: "translate(0px, 0px)", opacity: 1 },
              { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.2 },
            ],
            { duration: dur, easing: "ease-in-out", fill: "forwards" },
          );
          anim.onfinish = () => dojo.destroy(el);
        } else {
          dojo.destroy(el);
        }
      }, del);
    }

    showMessage(msg, type) {
      const container = document.getElementById("local-toast-container");
      if (!container) return;

      const toast = document.createElement("div");
      const kind = type === "error" ? "local-toast-error" : "local-toast-info";
      toast.className = "local-toast " + kind;
      toast.innerHTML =
        "<span>" +
        String(msg ?? "") +
        '</span><button type="button" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;line-height:1;">&times;</button>';

      const closeBtn = toast.querySelector("button");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        });
      }

      container.appendChild(toast);
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 4000);
    }

    ajaxcall(url, args, bind, resultHandler, allHandler) {
      clearTimeout(this._otherPlayerAutoCollectTimeout);
      const sep = url.indexOf("?") === -1 ? "?" : "&";
      const targetUrl =
        url + sep + "as=" + encodeURIComponent(this.isSpectator ? 0 : this.player_id);

      const actionMatch = String(url || "").match(/\/tichu\/tichu\/([a-zA-Z0-9_]+)\.html/);
      const actionName = actionMatch ? actionMatch[1] : String(url || "");
      this._logActionAnnouncement(actionName, args);

      const formParams = new URLSearchParams();
      if (args && typeof args === "object") {
        for (const k of Object.keys(args)) {
          if (args[k] !== undefined && args[k] !== null) {
            formParams.append(k, String(args[k]));
          }
        }
      }

      fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Bga-Player": String(this.isSpectator ? 0 : this.player_id),
        },
        body: formParams.toString(),
      })
        .then((r) => r.json())
        .then((payload) => {
          if (!payload || payload.status === 0) {
            const errMsg = (payload && payload.error) || "Action failed";
            consoleAnnounce(
              "[TICHU ERROR]",
              `${actionName} failed: ${errMsg}`,
              "font-weight:bold;color:#ff7b72",
            );
            this.showMessage(errMsg, "error");
            if (typeof allHandler === "function") {
              allHandler.call(bind || this, true, errMsg);
            }
            return;
          }

          const data = payload.data || {};
          if (Array.isArray(data.devBarPlayers)) {
            this.devBarPlayers = data.devBarPlayers;
          }
          if (Array.isArray(data.notifications) && data.notifications.length > 0) {
            this.notifqueue.enqueuePackets(data.notifications);
          } else if (data.gamestate) {
            this._transitionToState(data.gamestate);
            this._onQueueDrained();
          }
          this._renderDevBar();
          this._broadcastSync("state_updated");

          if (typeof resultHandler === "function") {
            resultHandler.call(bind || this, data);
          }
          if (typeof allHandler === "function") {
            allHandler.call(bind || this, false, data);
          }
        })
        .catch((err) => {
          this.showMessage(err.message || "Network error", "error");
          if (typeof allHandler === "function") {
            allHandler.call(bind || this, true, err.message);
          }
        });
    }

    bgaPerformAction(action, args = {}, params = {}) {
      if (params.checkAction !== false) {
        if (!this.checkAction(action)) return Promise.resolve();
      } else if (params.checkPossibleActions) {
        if (!this.checkPossibleActions(action)) return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        this.ajaxcall(
          `/tichu/tichu/${action}.html`,
          { ...args, lock: true },
          this,
          (res) => resolve(res),
          (isErr, res) => {
            if (isErr) reject(new Error(res));
          },
        );
      });
    }

    // ========================================================================
    // Console Announcer & Gamedatas Sync Helpers
    // ========================================================================

    _formatPlayerTag(playerId) {
      if (!playerId || Number(playerId) === 0) return "Spectator";
      const p =
        (this.gamedatas && this.gamedatas.players && this.gamedatas.players[playerId]) ||
        (this.devBarPlayers || []).find((dp) => Number(dp.id) === Number(playerId));
      if (!p) return `P?(${playerId})`;
      return `P${p.no}:${p.name}`;
    }

    _collectVisibleActionButtons() {
      const btns = [];
      const nodes = document.querySelectorAll(
        "#generalactions .bgabutton, #buttons .bgabutton, #buttons .action-button",
      );
      for (const node of nodes) {
        if (!node || node.classList.contains("hide") || node.style.display === "none") continue;
        const id = node.id || "btn";
        const label = (node.textContent || "").trim();
        btns.push({ id, label });
      }
      return btns;
    }

    _logStateAnnouncement() {
      const st = (this.gamedatas && this.gamedatas.gamestate) || {};
      if (!st.name) return;

      let activeStr = "-";
      if (st.type === "activeplayer" && st.active_player) {
        activeStr = this._formatPlayerTag(st.active_player);
      } else if (st.type === "multipleactiveplayer" && Array.isArray(st.multiactive)) {
        activeStr = "[" + st.multiactive.map((id) => this._formatPlayerTag(id)).join(", ") + "]";
      }

      const viewerStr = this.isSpectator
        ? "Spectator"
        : `${this._formatPlayerTag(this.player_id)} (${this.isCurrentPlayerActive() ? "MY TURN" : "WAITING"})`;

      const titleEl = document.getElementById("pagemaintitletext");
      const titleText = titleEl ? (titleEl.textContent || "").trim() : "";

      const btns = this._collectVisibleActionButtons()
        .map((b) => `${b.id}:"${b.label}"`)
        .join(", ");

      consoleAnnounce(
        "[TICHU STATE]",
        `${st.name} (#${st.id || "?"}, ${st.type || "?"}) | Active: ${activeStr} | Viewer: ${viewerStr} | Title: "${titleText}" | Buttons: [${btns}]`,
        "font-weight:bold;color:#79c0ff",
      );
    }

    _logActionAnnouncement(actionName, args) {
      const cleanArgs = {};
      if (args && typeof args === "object") {
        for (const k of Object.keys(args)) {
          if (k === "lock") continue;
          cleanArgs[k] = args[k];
        }
      }
      let extra = "";
      if (cleanArgs.cards && typeof cleanArgs.cards === "string") {
        const ids = cleanArgs.cards.split(";").filter(Boolean);
        const hand = (this.gamedatas && this.gamedatas.hand) || [];
        const labels = ids.map((id) => {
          const found = hand.find((c) => String(c.id) === String(id));
          return found ? formatCardCode(found) : `#${id}`;
        });
        if (labels.length > 0) {
          extra = ` (${labels.join(", ")})`;
        }
      }
      const actor = this.isSpectator ? "Spectator" : this._formatPlayerTag(this.player_id);
      consoleAnnounce(
        "[TICHU ACTION]",
        `${actor} -> ${actionName} ${JSON.stringify(cleanArgs)}${extra}`,
        "font-weight:bold;color:#f0883e",
      );
    }

    _logNotifAnnouncement(notif) {
      if (!notif || !notif.type) return;
      const args = notif.args || {};
      const plainLog = notif.log
        ? this.format_string_recursive(notif.log, args).replace(/<[^>]+>/g, "").trim()
        : "";

      const details = [];
      if (Array.isArray(args.cards)) {
        details.push(
          "cards=[" + args.cards.map((c) => `${formatCardCode(c)}(#${c.id})`).join(", ") + "]",
        );
      }
      if (Array.isArray(args.cardIds)) {
        details.push("cardIds=[" + args.cardIds.join(", ") + "]");
      }
      if (args.points !== undefined) {
        details.push(`points=${args.points}`);
      }
      if (args.trick_value !== undefined) {
        details.push(`trick_value=${args.trick_value}`);
      }
      if (args.bet !== undefined) {
        details.push(`bet=${args.bet}`);
      }
      if (args.wish !== undefined) {
        details.push(`wish=${formatRankLabel(args.wish)}`);
      }
      if (args.newScores !== undefined) {
        details.push(`newScores=${JSON.stringify(args.newScores)}`);
      }

      const logPart = plainLog ? `: "${plainLog}"` : "";
      const detailPart = details.length > 0 ? ` | ${details.join(" ")}` : "";
      consoleAnnounce(
        "[TICHU NOTIF]",
        `${notif.type}${logPart}${detailPart}`,
        "font-weight:bold;color:#d2a8ff",
      );
    }

    _logUiSummary() {
      if (!this.gamedatas) return;
      const gd = this.gamedatas;
      const wishStr =
        gd.mahjongWish && Number(gd.mahjongWish) > 0 && Number(gd.mahjongWish) < 15
          ? `, Wish: ${formatRankLabel(gd.mahjongWish)}`
          : "";

      const playersOrdered = Object.values(gd.players || {}).sort(
        (a, b) => Number(a.no) - Number(b.no),
      );
      const pSummaries = playersOrdered.map((p) => {
        const pId = Number(p.id);
        const hcEl = document.querySelector(`.handcount.${CSS.escape(String(pId))}`);
        const hc = hcEl
          ? hcEl.textContent.trim()
          : gd.handcount && gd.handcount[pId] !== undefined
            ? gd.handcount[pId]
            : "?";
        const ptEl = document.getElementById(`pointcount_${pId}`);
        const pts = ptEl
          ? ptEl.textContent.trim()
          : gd.capturedpoints && gd.capturedpoints[pId] !== undefined
            ? gd.capturedpoints[pId]
            : "0";
        const combo = this.allLastCombos && this.allLastCombos[pId];
        const passEl = document.querySelector(`#lastcombo_${pId} .pass`);
        let lastStr = "";
        if (combo && Array.isArray(combo.cards) && combo.cards.length > 0) {
          lastStr = `, last=[${combo.cards.map((c) => formatCardPretty(c, false)).join(" ")}]`;
        } else if (passEl) {
          lastStr = `, pass`;
        }
        return `P${p.no}:${p.name}(${hc}c, ${pts}pts${lastStr})`;
      });

      const handCards = (gd.hand || []).map((c) => formatCardPretty(c, false));
      const handStr = this.isSpectator
        ? "Spectator"
        : `Hand[${handCards.length}]: [${handCards.join(", ")}]`;

      consoleAnnounce(
        "[TICHU UI]",
        `R${gd.round} T${gd.trick} (TrickPts: ${gd.currentTrickValue}${wishStr}) | ${pSummaries.join(" | ")} | ${handStr}`,
        "font-weight:bold;color:#3fb950",
      );
    }

    _syncGamedatasAfterNotif(notif) {
      if (!notif || !this.gamedatas) return;
      const gd = this.gamedatas;
      const args = notif.args || {};

      if (notif.type === "dealCards" && Array.isArray(args.cards)) {
        const total = args.cards.length === 8 ? 8 : 14;
        if (!gd.handcount) gd.handcount = {};
        for (const pId of Object.keys(gd.players || {})) {
          gd.handcount[pId] = total;
        }
      } else if (notif.type === "playCombo" && Array.isArray(args.cards)) {
        const pId = Number(args.player_id);
        const playedIdSet = new Set(args.cards.map((c) => String(c.id)));
        if (pId === Number(this.player_id) && Array.isArray(gd.hand)) {
          gd.hand = gd.hand.filter((c) => !playedIdSet.has(String(c.id)));
        }
        const hcEl = document.querySelector(`.handcount.${CSS.escape(String(pId))}`);
        if (!gd.handcount) gd.handcount = {};
        if (hcEl) {
          gd.handcount[pId] = parseInt(hcEl.textContent || "0", 10) || 0;
        }
        if (!this.allLastCombos) this.allLastCombos = {};
        this.allLastCombos[pId] = {
          cards: args.cards,
          description: args.combo_name || "",
          type: 0,
          phoenixValue: null,
        };
        gd.allLastCombos = this.allLastCombos;
        gd.lastComboPlayer = String(pId);
        gd.lastComboDescription = args.combo_name || "";
      } else if (notif.type === "pass" && args.player_id) {
        const pId = Number(args.player_id);
        if (this.allLastCombos) {
          delete this.allLastCombos[pId];
        }
      } else if (notif.type === "wishMade") {
        gd.mahjongWish = Number(args.wish) === 15 ? 0 : Number(args.wish || 0);
      } else if (notif.type === "mahjongWishGranted") {
        gd.mahjongWish = 0;
      } else if (notif.type === "captureCards") {
        const pId = Number(args.player_id);
        if (!gd.capturedpoints) gd.capturedpoints = {};
        const ptEl = document.getElementById(`pointcount_${pId}`);
        if (ptEl) {
          gd.capturedpoints[pId] = parseInt(ptEl.textContent || "0", 10) || 0;
        }
      } else if (notif.type === "newScores" && args.newScores) {
        for (const pId of Object.keys(args.newScores)) {
          if (gd.players && gd.players[pId]) {
            gd.players[pId].score = String(args.newScores[pId]);
          }
        }
      }
    }

    _ensurePlayedCardsGrid() {
      const col = document.getElementById("playedCardsFlexCol");
      if (!col || col.children.length > 0) return;
      let html = "";
      for (let type = 1; type <= 4; type++) {
        html += `<div id="playedType_${type}" class="type" style="--y:${type - 1};">`;
        for (let arg = 1; arg <= 14; arg++) {
          html += `<div id="playedCard_${type}_${arg}" class="arg" style="--x:${arg - 1};"></div>`;
        }
        html += `</div>`;
      }
      col.innerHTML = html;
    }

    /**
     * Re-hydrates the live browser UI in-place without reloading the page.
     * Preserves the browser JS console context while updating the viewer seat,
     * table layout, hand stock, player boards, last played combos, and state machine.
     */
    _rehydrateSeatInPlace(payload) {
      if (!payload || !payload.gamedatas) return;

      const newLastPacketId =
        payload.last_packet_id !== undefined
          ? payload.last_packet_id
          : payload.gamedatas.notifications && payload.gamedatas.notifications.last_packet_id;

      this.notifqueue.reset(newLastPacketId);
      clearTimeout(this.autoCollectTimeout);
      clearTimeout(this.autoAcceptTimeout);
      clearTimeout(this._otherPlayerAutoCollectTimeout);
      clearTimeout(this._autoBotTimer);
      clearTimeout(this._autoSwitchTimer);

      // Clean up any open popin dialogs or temporary icon animations
      document.querySelectorAll(".bga-popin-underlay, #game_play_area .icon.temp").forEach((el) => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });

      this.player_id = Number(payload.playerId);
      this.isSpectator = Boolean(payload.isSpectator);
      this.bRealtime = Boolean(payload.bRealtime);
      this.gamedatas = payload.gamedatas;
      if (Array.isArray(payload.devBarPlayers)) {
        this.devBarPlayers = payload.devBarPlayers;
      }
      if (payload.options) {
        this.localOptions = payload.options;
      }
      if (Array.isArray(payload.gamelogs)) {
        masterGamelogs = JSON.parse(JSON.stringify(payload.gamelogs));
        window.g_gamelogs = JSON.parse(JSON.stringify(masterGamelogs));
      }

      const viewerParam = this.isSpectator ? 0 : this.player_id;
      try {
        if (!pendingAutorun) {
          window.history.replaceState(null, "", "?as=" + encodeURIComponent(viewerParam));
        }
        document.cookie =
          "tichu_player_id=" + encodeURIComponent(viewerParam) + "; path=/; SameSite=Lax";
      } catch (_e) {}

      const gd = this.gamedatas;
      const st = gd.gamestate || {};
      const isEnded = Number(st.id) === 99 || st.name === "gameEnd";
      window.g_archive_mode = isEnded;

      // 1. Update #overall-content & #game_play_area classes
      const overall = document.getElementById("overall-content");
      if (overall) {
        overall.classList.toggle("spectatorMode", this.isSpectator);
        overall.classList.toggle("archiveMode", isEnded);
        if (!isEnded) {
          overall.classList.remove("experimentalArchiveMode");
          this.experimentalArchiveModeEnabled = false;
        }
        Array.from(overall.classList).forEach((cls) => {
          if (cls.indexOf("gamestate_") === 0) {
            overall.classList.remove(cls);
          }
        });
        if (st.name) {
          overall.classList.add("gamestate_" + st.name);
        }
      }

      const playArea = document.getElementById("game_play_area");
      if (playArea) {
        playArea.classList.toggle("isAllInfoExposed", Number(gd.isAllInfoExposed) === 1);
      }
      if (Number(gd.isAllInfoExposed) === 1) {
        this._ensurePlayedCardsGrid();
      }

      // 2. Compute seat rotation relative to the new viewer (matching PlayerManager::getNextPlayers(null, true))
      const playersDesc = Object.values(gd.players || {}).sort(
        (a, b) => Number(b.no) - Number(a.no),
      );
      if (playersDesc.length === 4) {
        const refPlayerId =
          !this.isSpectator && gd.players[this.player_id]
            ? Number(this.player_id)
            : Number(playersDesc[3].id);
        const lastId = Number(playersDesc[3].id);
        let guard = 0;
        while (
          Number(playersDesc[3].id) !== refPlayerId &&
          Number(playersDesc[0].id) !== lastId &&
          guard++ < 4
        ) {
          playersDesc.push(playersDesc.shift());
        }

        // Update #playertables (the 3 pass recipients: DIR 1, 2, 3) in-place
        const playertablesEl = document.getElementById("playertables");
        if (playertablesEl) {
          const wrappers = Array.from(playertablesEl.children);
          for (let dirIdx = 0; dirIdx < 3; dirIdx++) {
            const targetP = playersDesc[dirIdx];
            const wrapper = wrappers[dirIdx];
            const tableDiv = wrapper && wrapper.children && wrapper.children[0];
            if (!targetP || !tableDiv) continue;
            const dir = dirIdx + 1;
            tableDiv.id = "playertable_" + targetP.id;
            tableDiv.className = "playertable playertable_" + dir;
            const nameEl = tableDiv.querySelector(".playertablename");
            if (nameEl) {
              nameEl.style.color = "#" + (targetP.color || "000000");
              nameEl.textContent = targetP.name;
            }
            const gtEl = tableDiv.querySelector(".tichubets .grandtichucolor");
            if (gtEl) {
              gtEl.className = "icon big grandtichucolor " + targetP.id;
            }
            const tEl = tableDiv.querySelector(".tichubets .tichucolor");
            if (tEl) {
              tEl.className = "icon big tichucolor " + targetP.id;
            }
            const recvEl = tableDiv.querySelector(".receivePassCard");
            if (recvEl) {
              recvEl.id = "receiveplayertable_" + targetP.id;
              recvEl.innerHTML = "";
            }
            const giveEl = tableDiv.querySelector(".givePassCard");
            if (giveEl) {
              giveEl.id = "giveplayertable_" + dir;
              giveEl.innerHTML = "";
            }
          }
        }

        // Update #card-last-played-area positions (bottom, right, top, left)
        const reversed = playersDesc.slice().reverse();
        const posClasses = ["bottom", "right", "top", "left"];
        for (let i = 0; i < reversed.length; i++) {
          const p = reversed[i];
          const container = document.querySelector(
            `#card-last-played-area .last-played-container#playertable_${p.id}`,
          );
          if (container) {
            container.classList.remove(
              "bottom",
              "right",
              "top",
              "left",
              "active",
              "disabled",
              "lastComboPlayer",
            );
            container.classList.add(posClasses[i]);
          }
        }
      }

      // 3. Re-populate playerHand stock & clear cardsToPass
      this.cardsToPass = [];
      dojo.query("#playertables .cardontable").forEach((el) => dojo.destroy(el));
      if (this.playerHand) {
        this.playerHand.removeAll();
        for (const card of gd.hand || []) {
          const stType = (Number(card.type) - 1) * 14 + (Number(card.type_arg) - 1);
          this.playerHand.addToStockWithId(stType, card.id);
        }
        if (typeof this.updateStockOverlap === "function") {
          this.updateStockOverlap(this.playerHand);
        }
      }

      // 4. Update all 4 player panels & table icons
      this.enableAllPlayerPanels();
      dojo.query(".grandtichublack, .tichublack, .grandtichucolor, .tichucolor, .firstoutcolor, .cardback").style(
        "display",
        "none",
      );

      for (const player of Object.values(gd.players || {})) {
        const pId = Number(player.id);
        if (gd.handcount[pId] === undefined) gd.handcount[pId] = 0;
        if (gd.capturedpoints[pId] === undefined) gd.capturedpoints[pId] = 0;

        if (this.scoreCtrl && this.scoreCtrl[pId]) {
          this.scoreCtrl[pId].setValue(player.score || 0);
        }

        if (String(player.call_grand_tichu) === "200") {
          dojo.query(".grandtichucolor." + pId).style("display", "inline-block");
          dojo.query(".tichublack." + pId).style("display", "none");
        } else if (String(player.call_grand_tichu) === "-1") {
          dojo.query(".grandtichublack." + pId).style("display", "inline-block");
        }

        if (String(player.call_tichu) === "100") {
          dojo.query(".tichucolor." + pId).style("display", "inline-block");
        } else if (
          String(player.call_tichu) === "-1" &&
          String(player.call_grand_tichu) !== "200"
        ) {
          dojo.query(".tichublack." + pId).style("display", "inline-block");
        }

        dojo.query(".handcount." + pId).innerHTML(String(gd.handcount[pId]));
        dojo.query(".pointcount." + pId).innerHTML(String(gd.capturedpoints[pId]));

        if (Number(gd.handcount[pId]) === 0) {
          this.disablePlayerPanel(pId);
          dojo.query("#playertable_" + pId).addClass("disabled");
        }
        if (pId === Number(gd.lastComboPlayer)) {
          dojo.query("#playertable_" + pId).addClass("lastComboPlayer");
        }
      }

      if (Number(gd.firstoutplayer) !== 0) {
        const foEl = document.getElementById("firstoutcolor_" + gd.firstoutplayer);
        if (foEl) foEl.style.display = "inline-block";
      }

      // 5. Update last combos and passes
      const playerIds = Object.keys(gd.players || {}).map((id) => parseInt(id, 10));
      if (typeof this.resetLastCombos === "function") {
        this.resetLastCombos();
      }
      this.allLastCombos = gd.allLastCombos || {};
      if (Number(gd.lastComboPlayer) > 0) {
        dojo.query("#playertable_" + gd.lastComboPlayer).addClass("lastComboPlayer");
      }
      if (typeof this.displayLastCombos === "function") {
        this.displayLastCombos(playerIds, gd.passes || []);
      }

      // 6. Update Mahjong wish, choice panels, status, played cards, and logs
      dojo.style("mahjongpanel", "display", "none");
      dojo.style("phoenixpanel", "display", "none");
      if (typeof this.updateMahjongWish === "function") {
        this.updateMahjongWish(gd.mahjongWish);
      }
      if (typeof this.updateStatus === "function") {
        this.updateStatus();
      }
      if (typeof this.updateCardsPlayed === "function") {
        this.updateCardsPlayed();
      }
      this._hydrateInitialLogs();

      // 7. Enter current state and update action buttons
      if (st && st.name) {
        this.updatePageTitle(st);
        if (typeof this.onEnteringState === "function") {
          this.onEnteringState(st.name, st);
        }
        if (typeof this.onUpdateActionButtons === "function") {
          this.onUpdateActionButtons(st.name, st.args);
        }
        if (
          st.name === "chooseDragonGift" &&
          typeof this.onEnteringStateChooseDragonGift === "function"
        ) {
          this.onEnteringStateChooseDragonGift(st.args);
        }
        this._scheduleOtherPlayerAutoCollect(st);
      }

      this._renderDevBar();
      this._logStateAnnouncement();
      this._logUiSummary();
    }

    _switchSeatInPlace(targetPlayerId) {
      const pId = Number(targetPlayerId) || 0;
      return fetch(`/local/state?as=${encodeURIComponent(pId)}`)
        .then((r) => r.json())
        .then((payload) => {
          if (payload && payload.status === 1) {
            this._rehydrateSeatInPlace(payload);
            this._onQueueDrained();
          }
          return payload;
        });
    }

    // ========================================================================
    // Internal State Transition, Log, TableWindow & Local Dev Bar Helpers
    // ========================================================================

    _transitionToState(newState) {
      if (!newState || !this.gamedatas) return;
      clearTimeout(this._otherPlayerAutoCollectTimeout);

      const prevState = this.gamedatas.gamestate;
      if (prevState && prevState.name && typeof this.onLeavingState === "function") {
        this.onLeavingState(prevState.name);
      }

      this.gamedatas.gamestate = newState;

      const isEnded = Number(newState.id) === 99 || newState.name === "gameEnd";
      window.g_archive_mode = isEnded;

      const overall = document.getElementById("overall-content");
      if (overall) {
        Array.from(overall.classList).forEach((cls) => {
          if (cls.indexOf("gamestate_") === 0) {
            overall.classList.remove(cls);
          }
        });
        if (newState.name) {
          overall.classList.add("gamestate_" + newState.name);
        }
        overall.classList.toggle("archiveMode", isEnded);
        if (!isEnded) {
          overall.classList.remove("experimentalArchiveMode");
          this.experimentalArchiveModeEnabled = false;
        }
      }

      this.updatePageTitle(newState);

      if (typeof this.onEnteringState === "function") {
        this.onEnteringState(newState.name, newState);
      }
      if (typeof this.onUpdateActionButtons === "function") {
        this.onUpdateActionButtons(newState.name, newState.args);
      }
      // Note: Tichu.prototype.onEnteringStateChooseDragonGift adds the two Dragon Gift buttons
      // inside onEnteringState, which onUpdateActionButtons's removeActionButtons() clears.
      // Re-invoking onEnteringStateChooseDragonGift ensures those buttons remain in #generalactions.
      if (
        newState.name === "chooseDragonGift" &&
        typeof this.onEnteringStateChooseDragonGift === "function"
      ) {
        this.onEnteringStateChooseDragonGift(newState.args);
      }

      this._scheduleOtherPlayerAutoCollect(newState);
      this._renderDevBar();
      this._logStateAnnouncement();
    }

    _scheduleOtherPlayerAutoCollect(stateObj) {
      clearTimeout(this._otherPlayerAutoCollectTimeout);
      const st = stateObj || (this.gamedatas && this.gamedatas.gamestate);
      if (!st || st.name !== "confirmTrick" || !this.bRealtime) return;
      if (this.isCurrentPlayerActive()) return;
      // When Auto-Switch is ON, the browser switches to the active trick winner,
      // whose own client instance runs the 2-second auto-collect timer.
      if (localStorage.getItem("tichu_local_autoswitch") === "1") return;

      const activePlayerId = Number(st.active_player || 0);
      if (!activePlayerId) return;

      this._otherPlayerAutoCollectTimeout = setTimeout(() => {
        this._collectForOtherPlayer(activePlayerId);
      }, 2000);
    }

    _collectForOtherPlayer(activePlayerId) {
      clearTimeout(this._otherPlayerAutoCollectTimeout);
      const st = this.gamedatas && this.gamedatas.gamestate;
      if (!st || st.name !== "confirmTrick") return;
      const targetId = Number(st.active_player || activePlayerId || 0);
      if (!targetId) return;

      fetch(`/tichu/tichu/collect.html?as=${encodeURIComponent(targetId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Bga-Player": String(targetId),
        },
        body: "lock=true",
      })
        .then((r) => r.json())
        .then((payload) => {
          if (!payload || payload.status === 0) return;
          // Poll notifications from the current viewer's perspective so private channel payloads match viewer
          this._pollServer();
          this._broadcastSync("state_updated");
        })
        .catch(() => {});
    }

    _appendLogEntry(rawLog, args) {
      const logsEl = document.getElementById("logs");
      if (!logsEl) return;
      const formatted = this.format_string_recursive(rawLog, args || {});
      if (!formatted.trim()) return;

      const entry = document.createElement("div");
      entry.className = "log";
      entry.innerHTML = formatted;
      logsEl.insertBefore(entry, logsEl.firstChild);
    }

    _hydrateInitialLogs() {
      const logsEl = document.getElementById("logs");
      if (!logsEl) return;
      logsEl.innerHTML = "";
      const myChan = "/player/p" + this.player_id;
      for (const pkt of masterGamelogs) {
        if (pkt.channel !== "/table/t1" && pkt.channel !== myChan) continue;
        for (const notif of pkt.data || []) {
          if (notif.log && String(notif.log).trim() !== "") {
            this._appendLogEntry(notif.log, notif.args || {});
          }
        }
      }
    }

    _showTableWindow(args) {
      const dlg = new EbgPopinDialog();
      dlg.create(args.id || "finalScoring");
      dlg.setTitle(window._(args.title || "Result of this Round"));

      const rows = Array.isArray(args.table) ? args.table : [];
      let html = '<table class="local-score-table">';
      for (let r = 0; r < rows.length; r++) {
        const row = Array.isArray(rows[r]) ? rows[r] : [];
        html += "<tr>";
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          const isHeader = r === 0 || (cell && typeof cell === "object" && cell.type === "header");
          const tag = isHeader ? "th" : "td";
          let text = "";
          if (cell && typeof cell === "object" && cell.str !== undefined) {
            text = this.format_string_recursive(cell.str, cell.args || {});
          } else if (cell !== null && cell !== undefined) {
            text = String(cell);
          }
          html += `<${tag}>${text}</${tag}>`;
        }
        html += "</tr>";
      }
      html += "</table>";

      dlg.setContent(html);
      dlg.show();
    }

    _setupSyncChannel() {
      try {
        if (typeof BroadcastChannel !== "undefined") {
          this._syncChannel = new BroadcastChannel("tichu_local_sync");
          this._syncChannel.onmessage = (evt) => {
            const msg = evt.data || {};
            if (msg.type === "new_game") {
              this._switchSeatInPlace(this.isSpectator ? 0 : this.player_id);
            } else if (msg.type === "state_updated") {
              this._pollServer();
            }
          };
        }
      } catch (_e) {}

      // Periodic poll for external CLI/bot updates
      setInterval(() => {
        if (!this.notifqueue.isProcessing && !this._botBusy) {
          this._pollServer();
        }
      }, 2000);
    }

    _broadcastSync(type) {
      try {
        if (this._syncChannel) {
          this._syncChannel.postMessage({ type: type, ts: Date.now() });
        }
      } catch (_e) {}
    }

    _pollServer() {
      const since = this.notifqueue.last_packet_id;
      const viewer = this.isSpectator ? 0 : this.player_id;
      fetch(`/local/poll?as=${encodeURIComponent(viewer)}&since=${encodeURIComponent(since)}`)
        .then((r) => r.json())
        .then((payload) => {
          if (!payload || payload.status !== 1) return;
          if (Array.isArray(payload.devBarPlayers)) {
            this.devBarPlayers = payload.devBarPlayers;
          }
          if (Array.isArray(payload.notifications) && payload.notifications.length > 0) {
            this.notifqueue.enqueuePackets(payload.notifications);
          }
          this._renderDevBar();
        })
        .catch(() => {});
    }

    _runBot(mode) {
      if (this._botBusy) return Promise.resolve(null);
      this._botBusy = true;
      this._renderDevBar();

      const since = this.notifqueue.last_packet_id;
      const viewer = this.isSpectator ? 0 : this.player_id;

      return fetch(`/local/bot?as=${encodeURIComponent(viewer)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: mode,
          as: viewer,
          since: since,
        }),
      })
        .then((r) => r.json())
        .then((payload) => {
          this._botBusy = false;
          if (!payload || payload.status !== 1) {
            if (payload && payload.error) {
              this.showMessage("Bot error: " + payload.error, "error");
            }
            this._renderDevBar();
            return payload;
          }
          if (Array.isArray(payload.actions)) {
            for (const act of payload.actions) {
              const pTag = this._formatPlayerTag(act.player_id);
              consoleAnnounce(
                "[TICHU ACTION]",
                `BOT ${pTag} -> ${act.action} ${JSON.stringify(act.args || {})}`,
                "font-weight:bold;color:#f0883e",
              );
            }
          }
          if (Array.isArray(payload.devBarPlayers)) {
            this.devBarPlayers = payload.devBarPlayers;
          }
          if (Array.isArray(payload.notifications) && payload.notifications.length > 0) {
            this.notifqueue.enqueuePackets(payload.notifications);
          }
          this._renderDevBar();
          this._broadcastSync("state_updated");
          return payload;
        })
        .catch((err) => {
          this._botBusy = false;
          this.showMessage("Bot error: " + err.message, "error");
          this._renderDevBar();
          return null;
        });
    }

    _startNewGame(turnBasedOverride, extraOptions) {
      const opts = extraOptions || {};
      const turnBased =
        turnBasedOverride !== undefined
          ? turnBasedOverride
          : opts.turnBased !== undefined
            ? opts.turnBased
            : this.localOptions.turnBased
              ? 1
              : 0;
      const gameLength = opts.gameLength !== undefined ? opts.gameLength : this.localOptions.gameLength || 2;
      const playerTeams = opts.playerTeams !== undefined ? opts.playerTeams : this.localOptions.playerTeams || 1;

      localStorage.removeItem("tichu_local_archive_mode");
      return fetch(`/local/new-game?as=${encodeURIComponent(this.isSpectator ? 0 : this.player_id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameLength: gameLength,
          playerTeams: playerTeams,
          turnBased: turnBased,
        }),
      })
        .then((r) => r.json())
        .then((payload) => {
          if (payload && payload.status === 1) {
            this._rehydrateSeatInPlace(payload);
            this._broadcastSync("new_game");
            this._onQueueDrained();
          } else {
            this.showMessage((payload && payload.error) || "Failed to start new game", "error");
          }
          return payload;
        })
        .catch((err) => {
          this.showMessage(err.message, "error");
          return null;
        });
    }

    _getNextAutoSwitchPlayerId() {
      const st = this.gamedatas && this.gamedatas.gamestate;
      if (!st || st.name === "gameEnd" || Number(st.id) === 99) return null;

      if (st.type === "activeplayer") {
        const activeId = Number(st.active_player || 0);
        if (activeId > 0 && (this.isSpectator || activeId !== Number(this.player_id))) {
          return activeId;
        }
        return null;
      }

      if (st.type === "multipleactiveplayer") {
        const multi = Array.isArray(st.multiactive)
          ? st.multiactive.map(Number).filter((n) => n > 0)
          : [];
        if (multi.length === 0) return null;
        if (!this.isSpectator && multi.includes(Number(this.player_id))) {
          return null;
        }
        const ordered = (this.devBarPlayers || []).map((p) => Number(p.id)).filter((n) => n > 0);
        if (ordered.length > 0) {
          const myIdx = ordered.indexOf(Number(this.player_id));
          const startIdx = myIdx >= 0 ? myIdx + 1 : 0;
          for (let offset = 0; offset < ordered.length; offset++) {
            const candidate = ordered[(startIdx + offset) % ordered.length];
            if (multi.includes(candidate)) {
              return candidate;
            }
          }
        }
        return multi[0];
      }

      return null;
    }

    _checkAutoSwitch() {
      if (localStorage.getItem("tichu_local_autoswitch") !== "1") return false;
      if (this.notifqueue.isProcessing || this.notifqueue.queue.length > 0) return false;

      const targetId = this._getNextAutoSwitchPlayerId();
      if (!targetId || (!this.isSpectator && targetId === Number(this.player_id))) {
        return false;
      }

      clearTimeout(this._autoSwitchTimer);
      this._autoSwitchTimer = setTimeout(() => {
        if (localStorage.getItem("tichu_local_autoswitch") !== "1") return;
        if (this.notifqueue.isProcessing || this.notifqueue.queue.length > 0) return;
        const finalTarget = this._getNextAutoSwitchPlayerId();
        if (finalTarget && (this.isSpectator || finalTarget !== Number(this.player_id))) {
          this._switchSeatInPlace(finalTarget);
        }
      }, 100);
      return true;
    }

    _onQueueDrained() {
      this._renderDevBar();
      this._logUiSummary();
      if (pendingAutorun) return;
      if (this._checkAutoSwitch()) return;
      if (localStorage.getItem("tichu_local_autobot") !== "1") return;
      if (this._botBusy) return;

      const st = this.gamedatas && this.gamedatas.gamestate;
      if (!st || st.name === "gameEnd" || Number(st.id) === 99) return;
      // In Real-Time confirmTrick, let the 2000ms auto-collect timer handle trick collection
      // so the human player has 2 seconds to view the trick or play a bomb.
      if (st.name === "confirmTrick" && this.bRealtime) return;

      const otherActive = (this.devBarPlayers || []).some(
        (p) => Number(p.id) !== Number(this.player_id) && p.isActive,
      );
      if (!otherActive) return;

      clearTimeout(this._autoBotTimer);
      this._autoBotTimer = setTimeout(() => {
        if (localStorage.getItem("tichu_local_autobot") !== "1" || this._botBusy) return;
        const curSt = this.gamedatas && this.gamedatas.gamestate;
        if (!curSt || (curSt.name === "confirmTrick" && this.bRealtime)) return;
        // In simultaneous states, act for all other players at once; in sequential states, step 1 bot at a time
        const mode = curSt.type === "multipleactiveplayer" ? "others" : "step";
        this._runBot(mode);
      }, 300);
    }

    _openReplayViewer() {
      const isCurrentlyOpen = Boolean(this.experimentalArchiveModeEnabled);
      if (isCurrentlyOpen) {
        if (typeof this.toggleExperimentalReplay === "function") {
          this.toggleExperimentalReplay(false);
        }
        this._renderDevBar();
        return Promise.resolve(false);
      }

      const viewer = this.isSpectator ? 0 : this.player_id;
      return fetch(`/local/state?as=${encodeURIComponent(viewer)}`)
        .then((r) => r.json())
        .then((payload) => {
          if (payload && Array.isArray(payload.gamelogs)) {
            masterGamelogs = payload.gamelogs;
            window.g_gamelogs = JSON.parse(JSON.stringify(masterGamelogs));
          }
          window.g_archive_mode = true;
          const overall = document.getElementById("overall-content");
          if (overall) overall.classList.add("archiveMode");

          // Remove any previous <tichu-replay> instance so it re-reads fresh window.g_gamelogs
          const oldReplay = document.getElementById("game_play_replay");
          if (oldReplay && oldReplay.parentNode) {
            oldReplay.parentNode.removeChild(oldReplay);
          }

          if (typeof this.toggleExperimentalReplay === "function") {
            this.toggleExperimentalReplay(true);
          }
          const newReplay = document.getElementById("game_play_replay");
          if (newReplay) {
            newReplay.addEventListener("exit", () => this._renderDevBar());
          }
          this._renderDevBar();
          return true;
        })
        .catch(() => false);
    }

    _setupDevBarTooltips(bar) {
      if (this._devTooltipBound || !bar) return;
      this._devTooltipBound = true;

      let tipEl = document.getElementById("local-dev-tooltip");
      if (!tipEl) {
        tipEl = document.createElement("div");
        tipEl.id = "local-dev-tooltip";
        tipEl.setAttribute("role", "tooltip");
        document.body.appendChild(tipEl);
      }

      const showTip = (target) => {
        const host = target && target.closest ? target.closest("[data-tooltip]") : null;
        if (!host || !bar.contains(host)) {
          tipEl.classList.remove("visible");
          return;
        }
        const text = host.getAttribute("data-tooltip");
        if (!text) {
          tipEl.classList.remove("visible");
          return;
        }
        tipEl.textContent = text;
        tipEl.classList.add("visible");

        const rect = host.getBoundingClientRect();
        const tipWidth = tipEl.offsetWidth || 240;
        const left = Math.min(
          Math.max(8, rect.left),
          Math.max(8, window.innerWidth - tipWidth - 8),
        );
        const top = rect.bottom + 7;
        tipEl.style.left = `${Math.round(left)}px`;
        tipEl.style.top = `${Math.round(top)}px`;
      };

      const hideTip = () => {
        tipEl.classList.remove("visible");
      };

      bar.addEventListener("mouseover", (e) => showTip(e.target));
      bar.addEventListener("focusin", (e) => showTip(e.target));
      bar.addEventListener("mouseout", (e) => {
        const next = e.relatedTarget;
        if (!next || !bar.contains(next) || !next.closest("[data-tooltip]")) {
          hideTip();
        }
      });
      bar.addEventListener("focusout", hideTip);
      bar.addEventListener("mousedown", hideTip);
    }

    _renderDevBar() {
      const bar = document.getElementById("local-dev-bar");
      if (!bar) return;

      this._setupDevBarTooltips(bar);

      const st = (this.gamedatas && this.gamedatas.gamestate) || {};
      const isGameEnd = Number(st.id) === 99 || st.name === "gameEnd";
      const autoBotOn = localStorage.getItem("tichu_local_autobot") === "1";
      const autoSwitchOn = localStorage.getItem("tichu_local_autoswitch") === "1";
      const isTiki = this.getGameUserPreference(103) == 1;
      const isTurnBased = Boolean(this.localOptions && this.localOptions.turnBased);
      const isMuted = localStorage.getItem("tichu_local_mute") === "1";

      const escapeAttr = (str) =>
        String(str ?? "")
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      let seatsHtml = "";
      const playersList = this.devBarPlayers || [];
      for (let i = 0; i < playersList.length; i++) {
        const p = playersList[i];
        const isViewer = !this.isSpectator && Number(p.id) === Number(this.player_id);
        const cls = [
          "devbar-seat",
          isViewer ? "is-viewer" : "",
          p.isActive ? "is-active-turn" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const seatTip = escapeAttr(
          `Switch view to ${p.name} (Team ${p.team + 1}, ${p.handCount} cards in hand). Green dot = waiting for this player's action.`,
        );
        seatsHtml +=
          `<a href="?as=${p.id}" data-seat-id="${p.id}" class="${cls}" title="${seatTip}" data-tooltip="${seatTip}">` +
          `<span class="devbar-color-dot" style="background:#${p.color}"></span>` +
          `<span>P${p.no}: ${p.name}</span>` +
          `<span class="devbar-meta">[${p.handCount}]</span>` +
          (p.isActive ? `<span class="devbar-turn-badge"></span>` : "") +
          `</a>`;
      }

      const specCls = "devbar-seat" + (this.isSpectator ? " is-viewer" : "");
      const specTip = escapeAttr(
        "Switch to Spectator view (hides private hands and action buttons).",
      );
      seatsHtml += `<a href="?as=0" data-seat-id="0" class="${specCls}" title="${specTip}" data-tooltip="${specTip}">👁 Spectator</a>`;

      const stateTip = escapeAttr(
        `Current BGA state machine state (${st.name || "-"}, type: ${st.type || "-"}).`,
      );
      const botOthersTip = escapeAttr(
        "Have bots play for the other 3 players (completes their Grand Tichu bets or 3-card passes in simultaneous states, or plays bot turns until your turn).",
      );
      const botStepTip = escapeAttr(
        "Execute a single bot action for whichever player is currently active.",
      );
      const autoBotTip = escapeAttr(
        "When ON, bots automatically act for the other 3 players so you can play a solo game without clicking bot buttons. (Turning this ON disables Auto-Switch.)",
      );
      const autoSwitchTip = escapeAttr(
        "When ON, automatically switches the active seat view to whichever player's turn it is to act. (Turning this ON disables Auto-Bot.)",
      );
      const exposedTip = escapeAttr(
        "Toggle between Real-Time mode and Turn-Based mode (Turn-Based mode exposes the Played Cards tracker and auto-passes unbeatable hands). Starts a new game.",
      );
      const tikiTip = escapeAttr(
        "Toggle between classic Tichu card artwork and Tiki Edition artwork.",
      );
      const replayTip = escapeAttr(
        "Open the Experimental Replay viewer for this finished game.",
      );
      const muteTip = escapeAttr(
        "Toggle game sound effects (Tichu / Grand Tichu laser sound) on or off.",
      );
      const newGameTip = escapeAttr(
        "Reset the database and start a fresh 4-player Tichu game.",
      );

      bar.innerHTML =
        `<div class="devbar-group">` +
        `<span class="devbar-brand">🀄 Tichu Local</span>` +
        `<span class="devbar-label">Seat:</span>` +
        seatsHtml +
        `</div>` +
        `<div class="devbar-group">` +
        `<span class="devbar-label" title="${stateTip}" data-tooltip="${stateTip}">State: <strong style="color:#e6edf3">${st.name || "-"}</strong></span>` +
        `<div class="devbar-divider"></div>` +
        `<button type="button" id="devbar_bot_others" class="devbar-btn bot-btn" ${this._botBusy ? "disabled" : ""} title="${botOthersTip}" data-tooltip="${botOthersTip}">🤖 Act for Others</button>` +
        `<button type="button" id="devbar_bot_step" class="devbar-btn bot-btn" ${this._botBusy ? "disabled" : ""} title="${botStepTip}" data-tooltip="${botStepTip}">🤖 Step 1</button>` +
        `<button type="button" id="devbar_autobot" class="devbar-btn ${autoBotOn ? "active-toggle" : ""}" title="${autoBotTip}" data-tooltip="${autoBotTip}">⚡ Auto-Bot: ${autoBotOn ? "ON" : "OFF"}</button>` +
        `<button type="button" id="devbar_autoswitch" class="devbar-btn ${autoSwitchOn ? "active-toggle" : ""}" title="${autoSwitchTip}" data-tooltip="${autoSwitchTip}">🔀 Auto-Switch: ${autoSwitchOn ? "ON" : "OFF"}</button>` +
        `<div class="devbar-divider"></div>` +
        `<button type="button" id="devbar_exposed" class="devbar-btn ${isTurnBased ? "active-toggle" : ""}" title="${exposedTip}" data-tooltip="${exposedTip}">${isTurnBased ? "🃏 Exposed Cards: ON" : "⏱ Real-Time"}</button>` +
        `<button type="button" id="devbar_tiki" class="devbar-btn ${isTiki ? "active-toggle" : ""}" title="${tikiTip}" data-tooltip="${tikiTip}">🗿 Tiki: ${isTiki ? "ON" : "OFF"}</button>` +
        (isGameEnd
          ? `<button type="button" id="devbar_replay" class="devbar-btn ${this.experimentalArchiveModeEnabled ? "active-toggle" : ""}" title="${replayTip}" data-tooltip="${replayTip}">📼 Replay</button>`
          : "") +
        `<button type="button" id="devbar_mute" class="devbar-btn" title="${muteTip}" data-tooltip="${muteTip}">${isMuted ? "🔇" : "🔊"}</button>` +
        `<button type="button" id="devbar_new_game" class="devbar-btn danger-btn" title="${newGameTip}" data-tooltip="${newGameTip}">🔄 New Game</button>` +
        `</div>`;

      // Bind in-place seat switching on seat buttons
      bar.querySelectorAll(".devbar-seat[data-seat-id]").forEach((seatEl) => {
        seatEl.addEventListener("click", (evt) => {
          if (evt.metaKey || evt.ctrlKey || evt.shiftKey) return;
          evt.preventDefault();
          const targetId = Number(seatEl.getAttribute("data-seat-id") || 0);
          this._switchSeatInPlace(targetId);
        });
      });

      const bindClick = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("click", fn);
      };

      bindClick("devbar_bot_others", () => this._runBot("others"));
      bindClick("devbar_bot_step", () => this._runBot("step"));
      bindClick("devbar_autobot", () => {
        const next = localStorage.getItem("tichu_local_autobot") === "1" ? "0" : "1";
        localStorage.setItem("tichu_local_autobot", next);
        if (next === "1") {
          localStorage.setItem("tichu_local_autoswitch", "0");
          clearTimeout(this._autoSwitchTimer);
        }
        this._renderDevBar();
        if (next === "1") {
          this._onQueueDrained();
        } else {
          clearTimeout(this._autoBotTimer);
        }
      });
      bindClick("devbar_autoswitch", () => {
        const next = localStorage.getItem("tichu_local_autoswitch") === "1" ? "0" : "1";
        localStorage.setItem("tichu_local_autoswitch", next);
        if (next === "1") {
          localStorage.setItem("tichu_local_autobot", "0");
          clearTimeout(this._autoBotTimer);
        }
        this._renderDevBar();
        if (next === "1") {
          this._checkAutoSwitch();
        } else {
          clearTimeout(this._autoSwitchTimer);
          this._scheduleOtherPlayerAutoCollect(this.gamedatas && this.gamedatas.gamestate);
        }
      });
      bindClick("devbar_exposed", () => {
        this._startNewGame(isTurnBased ? 0 : 1);
      });
      bindClick("devbar_tiki", () => {
        const nextVal = isTiki ? 2 : 1;
        this.setGameUserPreference(103, nextVal);
        const overall = document.getElementById("overall-content");
        if (overall) overall.classList.toggle("tiki", nextVal === 1);
        this._renderDevBar();
      });
      bindClick("devbar_replay", () => this._openReplayViewer());
      bindClick("devbar_mute", () => {
        const nextMute = isMuted ? "0" : "1";
        localStorage.setItem("tichu_local_mute", nextMute);
        this._renderDevBar();
      });
      bindClick("devbar_new_game", () => this._startNewGame());
    }
  }

  // ==========================================================================
  // 6. Expose `window.ebg`, `declare`, and `define` (ES5 & ES6 Class Ready)
  // ==========================================================================

  window.ebg = {
    core: {
      core: {},
      sitecore: {},
      gamegui: GameGui,
      i18n: {},
    },
    counter: EbgCounter,
    stock: EbgStock,
    popindialog: EbgPopinDialog,
    gamenotif: GameNotifQueue,
  };

  /**
   * Copies all properties and methods (including non-enumerable ES6 class
   * prototype methods!) from `sourceObj` and its prototype chain onto `target`.
   */
  function copyAllMembers(target, sourceObj) {
    if (!sourceObj) return target;

    const protoChain = [];
    let cur = sourceObj;
    while (cur && cur !== Object.prototype && cur !== Function.prototype) {
      protoChain.unshift(cur);
      cur = Object.getPrototypeOf(cur);
    }

    for (const obj of protoChain) {
      const names = Object.getOwnPropertyNames(obj);
      for (const name of names) {
        if (name === "constructor") continue;
        const desc = Object.getOwnPropertyDescriptor(obj, name);
        if (desc) {
          Object.defineProperty(target, name, desc);
        } else {
          target[name] = sourceObj[name];
        }
      }
    }
    return target;
  }

  function declare(className, _superclass, propsOrInstance) {
    const sourceObj =
      typeof propsOrInstance === "function" ? new propsOrInstance() : propsOrInstance;

    class CustomGameClass extends GameGui {
      constructor() {
        super();
        copyAllMembers(this, sourceObj);
      }
    }
    copyAllMembers(CustomGameClass.prototype, sourceObj);

    if (className) {
      const parts = String(className).split(".");
      let ns = window;
      for (let i = 0; i < parts.length - 1; i++) {
        ns[parts[i]] = ns[parts[i]] || {};
        ns = ns[parts[i]];
      }
      ns[parts[parts.length - 1]] = CustomGameClass;
    }

    if (className === "bgagame.tichu") {
      bootGameInstance(CustomGameClass);
    }

    return CustomGameClass;
  }

  // ==========================================================================
  // 7. `window.tichuTest` (`window.tt`) Interactive Console & Test Suite API
  // ==========================================================================

  function resolveSeatPlayerId(seatOrPlayerId) {
    const ui = window.gameui;
    const gd = (ui && ui.gamedatas) || initPayload.gamedatas || {};
    const players = Object.values(gd.players || {}).sort((a, b) => Number(a.no) - Number(b.no));

    if (seatOrPlayerId === undefined || seatOrPlayerId === null) {
      return ui ? (ui.isSpectator ? 0 : Number(ui.player_id)) : 2385074;
    }

    const rawStr = String(seatOrPlayerId).trim().toLowerCase();
    if (rawStr === "spectator" || rawStr === "spec" || rawStr === "-1") {
      return 0;
    }

    const pMatch = rawStr.match(/^p([0-3])$/);
    if (pMatch) {
      const seatNo = Number(pMatch[1]);
      const found = players.find((p) => Number(p.no) === seatNo);
      return found ? Number(found.id) : 2385074 + seatNo;
    }

    const num = Number(rawStr);
    if (Number.isInteger(num)) {
      if (num >= 0 && num <= 3) {
        const found = players.find((p) => Number(p.no) === num);
        return found ? Number(found.id) : 2385074 + num;
      }
      if (gd.players && gd.players[num]) {
        return num;
      }
    }

    const byName = players.find((p) => String(p.name || "").toLowerCase() === rawStr);
    if (byName) {
      return Number(byName.id);
    }

    throw new Error(
      `Unknown seat or player "${seatOrPlayerId}". Expected 0..3, "P0".."P3", 2385074..2385077, or "spectator".`,
    );
  }

  function pickThreeDefaultCardsFromHand(handCards) {
    const hand = (handCards || []).map(normalizeCardObj).filter(Boolean);
    if (hand.length < 3) return hand;

    const rankCounts = {};
    for (const c of hand) {
      rankCounts[c.type_arg] = (rankCounts[c.type_arg] || 0) + 1;
    }

    const sorted = hand.slice().sort((a, b) => {
      const aSpec = a.type_arg === 1 ? 1 : 0;
      const bSpec = b.type_arg === 1 ? 1 : 0;
      if (aSpec !== bSpec) return aSpec - bSpec;
      if (aSpec === 0) {
        const aFreq = rankCounts[a.type_arg] || 1;
        const bFreq = rankCounts[b.type_arg] || 1;
        if (aFreq !== bFreq) return aFreq - bFreq;
        if (a.type_arg !== b.type_arg) return a.type_arg - b.type_arg;
      }
      return Number(a.id) - Number(b.id);
    });

    return sorted.slice(0, 3);
  }

  function findBombInHand(handCards) {
    const hand = (handCards || []).map(normalizeCardObj).filter(Boolean);
    const byRank = {};
    const bySuit = { 1: {}, 2: {}, 3: {}, 4: {} };
    for (const c of hand) {
      if (c.type_arg >= 2) {
        if (!byRank[c.type_arg]) byRank[c.type_arg] = [];
        byRank[c.type_arg].push(c);
        bySuit[c.type][c.type_arg] = c;
      }
    }
    for (let r = 2; r <= 14; r++) {
      if (byRank[r] && byRank[r].length === 4) {
        return byRank[r];
      }
    }
    for (let s = 1; s <= 4; s++) {
      const ranks = Object.keys(bySuit[s])
        .map(Number)
        .sort((a, b) => a - b);
      for (let i = 0; i + 5 <= ranks.length; i++) {
        if (ranks[i + 4] === ranks[i] + 4) {
          return [
            bySuit[s][ranks[i]],
            bySuit[s][ranks[i + 1]],
            bySuit[s][ranks[i + 2]],
            bySuit[s][ranks[i + 3]],
            bySuit[s][ranks[i + 4]],
          ];
        }
      }
    }
    return null;
  }

  function pickDefaultPlayCardsFromHand(ui) {
    const gd = (ui && ui.gamedatas) || {};
    const hand = (gd.hand || []).map(normalizeCardObj).filter(Boolean);
    if (hand.length === 0) return [];

    // 1. If user already selected cards in #myhand, use those
    if (ui && ui.playerHand) {
      const selected = ui.playerHand.getSelectedItems();
      if (selected.length > 0) {
        const selIds = new Set(selected.map((it) => String(it.id)));
        return hand.filter((c) => selIds.has(String(c.id)));
      }
    }

    const stName = gd.gamestate && gd.gamestate.name;
    if (stName === "playBomb") {
      const bomb = findBombInHand(hand);
      if (bomb) return bomb;
    }

    const wish = Number(gd.mahjongWish || 0);
    if (wish >= 2 && wish <= 14) {
      const wished = hand.find((c) => c.type_arg === wish);
      if (wished) return [wished];
    }

    // Prefer Mahjong or Dog on opening lead, or lowest single
    if (stName === "playComboOpen") {
      const mj = hand.find((c) => c.type_arg === 1 && c.type === 4);
      if (mj) return [mj];
      const dog = hand.find((c) => c.type_arg === 1 && c.type === 3);
      if (dog) return [dog];
    }

    const normals = hand
      .filter((c) => c.type_arg >= 2)
      .sort((a, b) => a.type_arg - b.type_arg);
    if (normals.length > 0) return [normals[0]];
    return [hand[0]];
  }

  async function ensureViewerSeat(seat) {
    const ui = window.gameui;
    if (!ui || seat === undefined || seat === null) return;
    const targetId = resolveSeatPlayerId(seat);
    const currentId = ui.isSpectator ? 0 : Number(ui.player_id);
    if (targetId !== currentId) {
      await tt.switchSeat(seat);
    }
  }

  async function performActionAndDrain(actionName, args = {}, seat) {
    await ensureViewerSeat(seat);
    const ui = window.gameui;
    if (!ui) throw new Error("window.gameui is not initialized yet");

    await new Promise((resolve, reject) => {
      ui.ajaxcall(
        `/tichu/tichu/${actionName}.html`,
        { ...args, lock: true },
        ui,
        (data) => resolve(data),
        (isErr, res) => {
          if (isErr) reject(new Error(res || `${actionName} failed`));
        },
      );
    });

    await ui.notifqueue.waitUntilIdle();
    return tt.status(false);
  }

  const tt = {
    help() {
      const rows = [
        { Command: "tt.help()", Description: "Show this console command cheat-sheet" },
        { Command: "tt.status()", Description: "Inspect current state, players, hand, trick, and buttons" },
        { Command: "tt.hand(seat?)", Description: "Inspect cards in hand (e.g. tt.hand(0))" },
        { Command: "tt.assertUI()", Description: "Verify all live DOM elements match gamedatas invariants" },
        { Command: "tt.setSpeed('normal'|'fast'|'instant')", Description: "Set notification/animation queue speed" },
        { Command: "tt.setVerbose(true|false)", Description: "Toggle live [TICHU *] console announcements" },
        { Command: "await tt.newGame(opts?)", Description: "Start a fresh game in-place ({ gameLength, playerTeams, turnBased })" },
        { Command: "await tt.loadScenario(name, seat=0)", Description: "Load a deterministic scenario in-place without reloading" },
        { Command: "await tt.switchSeat(0..3|'spectator')", Description: "Switch viewer seat in-place without reloading" },
        { Command: "await tt.betGrandTichu(0|200, seat?)", Description: "Place Grand Tichu bet (0 = No bet, 200 = Grand Tichu)" },
        { Command: "await tt.betTichu(seat?)", Description: "Call Tichu (100 pts)" },
        { Command: "await tt.confirmTichu(100|200, seat?)", Description: "Confirm Tichu / Grand Tichu when prompted" },
        { Command: "await tt.giveCards(cards?, seat?)", Description: "Visually place & pass 3 cards (e.g. ['S2','R2','B2'])" },
        { Command: "await tt.play(cards?, seat?)", Description: "Select & play combo (e.g. ['MJ'], ['S5','R6','B7','G8','PH'])" },
        { Command: "await tt.bomb(cards?, seat?)", Description: "Interrupt with Play a Bomb (and play bomb cards if given)" },
        { Command: "await tt.cancelBomb(seat?)", Description: "Cancel out of playBomb state" },
        { Command: "await tt.pass(onlyOnce=true, seat?)", Description: "Pass turn (or set auto-pass if out of turn)" },
        { Command: "await tt.cancelAutopass(seat?)", Description: "Cancel out-of-turn auto-pass" },
        { Command: "await tt.wish(rank=15, seat?)", Description: "Make a Mahjong wish (2..14, 'J','Q','K','A', or 15='none')" },
        { Command: "await tt.choosePhoenix(rank, seat?)", Description: "Choose ambiguous Phoenix rank in phoenixPlay state" },
        { Command: "await tt.cancelPhoenix(seat?)", Description: "Cancel ambiguous Phoenix play and return to playCombo" },
        { Command: "await tt.collect(seat?)", Description: "Collect won trick in confirmTrick state" },
        { Command: "await tt.giveDragon(0|1, seat?)", Description: "Gift Dragon trick to opponent 0 or 1 in chooseDragonGift" },
        { Command: "await tt.step()", Description: "Execute 1 smart bot action and drain notifications into UI" },
        { Command: "await tt.actForOthers()", Description: "Have bots act for the other 3 players and drain into UI" },
        { Command: "await tt.runScenario(name, opts?)", Description: "Run end-to-end UI + backend test for a scenario" },
        { Command: "await tt.runSuite(opts?)", Description: "Run all 7 deterministic integration test scenarios live" },
        { Command: "await tt.runRound(opts?)", Description: "Play a full round live on screen with DOM assertions" },
        { Command: "await tt.runGame(opts?)", Description: "Play a full game to gameEnd and verify <tichu-replay>" },
      ];
      window.console.table(rows);
      return rows;
    },

    setVerbose(enabled = true) {
      consoleVerbose = Boolean(enabled);
      return consoleVerbose;
    },

    setSpeed(mode = "fast") {
      const ui = window.gameui;
      if (!ui || !ui.notifqueue) return mode;
      const applied = ui.notifqueue.setSpeed(mode);
      consoleAnnounce("[TICHU SPEED]", `Notification queue speed set to "${applied}"`);
      return applied;
    },

    status(logToConsole = true) {
      const ui = window.gameui;
      if (!ui || !ui.gamedatas) return null;
      const gd = ui.gamedatas;
      const st = gd.gamestate || {};

      const players = Object.values(gd.players || {})
        .sort((a, b) => Number(a.no) - Number(b.no))
        .map((p) => {
          const pId = Number(p.id);
          const hcEl = document.querySelector(`.handcount.${CSS.escape(String(pId))}`);
          const ptEl = document.getElementById(`pointcount_${pId}`);
          const scoreEl = document.getElementById(`player_score_${pId}`);
          return {
            seat: Number(p.no),
            id: pId,
            name: p.name,
            team: Number(p.team ?? Number(p.no) % 2),
            handCount: hcEl
              ? parseInt(hcEl.textContent || "0", 10)
              : Number(gd.handcount[pId] ?? 0),
            capturedPoints: ptEl
              ? parseInt(ptEl.textContent || "0", 10)
              : Number(gd.capturedpoints[pId] ?? 0),
            score: scoreEl
              ? parseInt(scoreEl.textContent || "0", 10)
              : Number(p.score ?? 0),
            grandTichu: Number(p.call_grand_tichu),
            tichu: Number(p.call_tichu),
            autopass: Number(p.pass || 0),
            isActive: ui.isPlayerActive(pId),
          };
        });

      const hand = (gd.hand || []).map((c) => ({
        id: String(c.id),
        code: formatCardCode(c),
        pretty: formatCardPretty(c, false),
        type: Number(c.type),
        type_arg: Number(c.type_arg),
      }));

      const tableCombos = {};
      for (const p of players) {
        const combo = ui.allLastCombos && ui.allLastCombos[p.id];
        if (combo && Array.isArray(combo.cards) && combo.cards.length > 0) {
          tableCombos[`P${p.seat}:${p.name}`] = {
            description: combo.description,
            cards: combo.cards.map(formatCardCode),
          };
        } else if (document.querySelector(`#lastcombo_${p.id} .pass`)) {
          tableCombos[`P${p.seat}:${p.name}`] = "PASS";
        } else {
          tableCombos[`P${p.seat}:${p.name}`] = null;
        }
      }

      const buttons = ui._collectVisibleActionButtons();

      const summary = {
        state: {
          id: Number(st.id || 0),
          name: st.name || "",
          type: st.type || "",
          possibleactions: st.possibleactions || [],
        },
        viewer: ui.isSpectator ? "spectator" : ui._formatPlayerTag(ui.player_id),
        viewerId: ui.isSpectator ? 0 : Number(ui.player_id),
        isMyTurn: ui.isCurrentPlayerActive(),
        activePlayer: st.active_player ? ui._formatPlayerTag(st.active_player) : null,
        activePlayerId: st.active_player ? Number(st.active_player) : null,
        multiactive: Array.isArray(st.multiactive)
          ? st.multiactive.map((id) => ui._formatPlayerTag(id))
          : [],
        round: Number(gd.round || 0),
        trick: Number(gd.trick || 0),
        trickPoints: Number(gd.currentTrickValue || 0),
        mahjongWish: Number(gd.mahjongWish || 0),
        firstOutPlayer: Number(gd.firstoutplayer || 0),
        players,
        hand,
        handCodes: hand.map((c) => c.code),
        tableCombos,
        buttons,
      };

      if (logToConsole) {
        ui._logStateAnnouncement();
        ui._logUiSummary();
      }
      return summary;
    },

    async hand(seatOrPlayerId) {
      if (seatOrPlayerId !== undefined && seatOrPlayerId !== null) {
        await ensureViewerSeat(seatOrPlayerId);
      }
      const ui = window.gameui;
      const cards = ((ui && ui.gamedatas && ui.gamedatas.hand) || []).map((c) => ({
        id: String(c.id),
        code: formatCardCode(c),
        pretty: formatCardPretty(c, true),
        suit: Number(c.type),
        rank: Number(c.type_arg),
      }));
      consoleAnnounce(
        "[TICHU HAND]",
        `${ui._formatPlayerTag(ui.player_id)} (${cards.length} cards): [${cards.map((c) => `${c.code}(#${c.id})`).join(", ")}]`,
        "font-weight:bold;color:#3fb950",
      );
      return cards;
    },

    assertUI() {
      const ui = window.gameui;
      if (!ui || !ui.gamedatas) {
        throw new Error("[ASSERT_UI FAILED] window.gameui or gamedatas is missing");
      }
      const gd = ui.gamedatas;
      const st = gd.gamestate || {};
      const stateName = st.name || "";

      // 1. Check #overall-content state class
      const overall = document.getElementById("overall-content");
      if (!overall) {
        throw new Error("[ASSERT_UI FAILED] #overall-content element missing from DOM");
      }
      if (stateName && !overall.classList.contains("gamestate_" + stateName)) {
        throw new Error(
          `[ASSERT_UI FAILED] #overall-content classList "${overall.className}" does not contain "gamestate_${stateName}"`,
        );
      }

      // 2. Check #myhand .stockitem count vs gamedatas.hand
      const myHandItems = document.querySelectorAll("#myhand .stockitem");
      if (!ui.isSpectator && stateName !== "endRound" && stateName !== "newRound") {
        const stagedPassCount = Array.isArray(ui.cardsToPass)
          ? ui.cardsToPass.filter(Boolean).length
          : 0;
        const expectedHandDom = Math.max(0, (gd.hand || []).length - stagedPassCount);
        if (myHandItems.length !== expectedHandDom) {
          throw new Error(
            `[ASSERT_UI FAILED] #myhand .stockitem count (${myHandItems.length}) !== expected hand size (${expectedHandDom}, gamedatas.hand=${(gd.hand || []).length}, staged=${stagedPassCount})`,
          );
        }
      }

      // 3. Check <tichu-status> attributes
      const statusEl = document.querySelector("#game_play_area_wrap tichu-status");
      if (!statusEl) {
        throw new Error("[ASSERT_UI FAILED] <tichu-status> element missing from DOM");
      }
      const attrRound = Number(statusEl.getAttribute("roundCount"));
      const attrTrick = Number(statusEl.getAttribute("trickCount"));
      const attrPts = Number(statusEl.getAttribute("trickPoints"));
      if (attrRound !== Number(gd.round)) {
        throw new Error(
          `[ASSERT_UI FAILED] <tichu-status> roundCount (${attrRound}) !== gamedatas.round (${gd.round})`,
        );
      }
      if (attrTrick !== Number(gd.trick)) {
        throw new Error(
          `[ASSERT_UI FAILED] <tichu-status> trickCount (${attrTrick}) !== gamedatas.trick (${gd.trick})`,
        );
      }
      if (attrPts !== Number(gd.currentTrickValue)) {
        throw new Error(
          `[ASSERT_UI FAILED] <tichu-status> trickPoints (${attrPts}) !== gamedatas.currentTrickValue (${gd.currentTrickValue})`,
        );
      }

      // 4. Check all 4 player panels and handcounts
      for (const p of Object.values(gd.players || {})) {
        const pId = Number(p.id);
        const hcNodes = document.querySelectorAll(`.handcount.${CSS.escape(String(pId))}`);
        if (hcNodes.length === 0) {
          throw new Error(`[ASSERT_UI FAILED] Missing .handcount.${pId} elements in DOM`);
        }
        const texts = Array.from(hcNodes).map((n) => (n.textContent || "").trim());
        const numVal = parseInt(texts[0], 10);
        if (Number.isNaN(numVal) || numVal < 0 || numVal > 14) {
          throw new Error(
            `[ASSERT_UI FAILED] Invalid handcount "${texts[0]}" for player ${pId}`,
          );
        }
        if (!ui.isSpectator && pId === Number(ui.player_id) && stateName !== "endRound") {
          const actualHandLen = (gd.hand || []).length;
          // During giveCards/showPassedCards/acceptPassedCards before acceptCards fires, handcount is 14 while hand has 11
          if (
            stateName !== "giveCards" &&
            stateName !== "showPassedCards" &&
            stateName !== "acceptPassedCards" &&
            numVal !== actualHandLen
          ) {
            throw new Error(
              `[ASSERT_UI FAILED] Viewer .handcount.${pId} (${numVal}) !== gamedatas.hand.length (${actualHandLen}) in state ${stateName}`,
            );
          }
        }
      }

      return {
        ok: true,
        state: stateName,
        viewer: ui.player_id,
        handDomCount: myHandItems.length,
        round: Number(gd.round),
        trick: Number(gd.trick),
        trickPoints: Number(gd.currentTrickValue),
      };
    },

    async newGame({ gameLength = 2, playerTeams = 1, turnBased = 0 } = {}) {
      const ui = window.gameui;
      if (!ui) throw new Error("window.gameui not initialized");
      await ui._startNewGame(turnBased, { gameLength, playerTeams, turnBased });
      await ui.notifqueue.waitUntilIdle();
      return tt.status(false);
    },

    async loadScenario(name, seat = 0) {
      const ui = window.gameui;
      if (!ui) throw new Error("window.gameui not initialized");
      const targetPlayerId = resolveSeatPlayerId(seat);
      consoleAnnounce(
        "[TICHU SCENARIO]",
        `Loading scenario "${name}" as ${targetPlayerId === 0 ? "Spectator" : `Player ${targetPlayerId}`}...`,
        "font-weight:bold;color:#58a6ff",
      );
      const res = await fetch(`/local/test-scenario?as=${encodeURIComponent(targetPlayerId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: name, as: targetPlayerId }),
      });
      const payload = await res.json();
      if (!payload || payload.status !== 1) {
        throw new Error((payload && payload.error) || `Failed to load scenario "${name}"`);
      }
      ui._rehydrateSeatInPlace(payload);
      await ui.notifqueue.waitUntilIdle();
      return tt.status(false);
    },

    async switchSeat(seatOrPlayerId) {
      const ui = window.gameui;
      if (!ui) throw new Error("window.gameui not initialized");
      const targetPlayerId = resolveSeatPlayerId(seatOrPlayerId);
      await ui._switchSeatInPlace(targetPlayerId);
      await ui.notifqueue.waitUntilIdle();
      return tt.status(false);
    },

    async betGrandTichu(bet = 0, seat) {
      const numBet = bet === true || Number(bet) === 200 ? 200 : 0;
      return performActionAndDrain("grandTichuBet", { bet: numBet }, seat);
    },

    async betTichu(seat) {
      return performActionAndDrain("tichuBet", { bet: 100 }, seat);
    },

    async confirmTichu(bet = 100, seat) {
      return performActionAndDrain("confirmTichu", { bet: Number(bet) }, seat);
    },

    async giveCards(cards, seat) {
      await ensureViewerSeat(seat);
      const ui = window.gameui;
      const gd = ui.gamedatas;

      // Reset any previously staged pass cards first
      if (typeof ui.onResetPassCards === "function" && Array.isArray(ui.cardsToPass)) {
        if (ui.cardsToPass.some(Boolean)) {
          ui.onResetPassCards();
        }
      }

      let chosenCards = null;
      if (cards === undefined || cards === null) {
        chosenCards = pickThreeDefaultCardsFromHand(gd.hand);
      } else {
        chosenCards = resolveCardsFromHand(cards, gd.hand);
      }

      if (!chosenCards || chosenCards.length !== 3) {
        throw new Error(`giveCards requires 3 cards, got ${chosenCards ? chosenCards.length : 0}`);
      }

      // Visually place the 3 cards into #playertables so the user sees them on screen
      if (ui.playerHand && typeof ui.onGiveCard === "function") {
        for (let i = 0; i < 3; i++) {
          ui.playerHand.unselectAll();
          ui.playerHand.selectItem(String(chosenCards[i].id));
          ui.onGiveCard(i);
        }
        const pauseMs =
          ui.notifqueue.speedMode === "instant"
            ? 1
            : ui.notifqueue.speedMode === "fast"
              ? 35
              : 140;
        await new Promise((r) => setTimeout(r, pauseMs));

        // Clean up the staged cardontable nodes before sending giveTheCards (matching onPassCards)
        for (let i = 0; i < 3; i++) {
          dojo.destroy("cardontable_" + ui.player_id + "_" + chosenCards[i].id);
        }
        ui.cardsToPass = [];
      }

      const toGiveStr = chosenCards.map((c) => c.id).join(";") + ";";
      return performActionAndDrain("giveTheCards", { cards: toGiveStr });
    },

    async play(cards, seat) {
      await ensureViewerSeat(seat);
      const ui = window.gameui;
      const gd = ui.gamedatas;

      let chosenCards = null;
      if (cards === undefined || cards === null) {
        chosenCards = pickDefaultPlayCardsFromHand(ui);
      } else {
        chosenCards = resolveCardsFromHand(cards, gd.hand);
      }

      if (!chosenCards || chosenCards.length === 0) {
        throw new Error("No cards selected or resolved for tt.play()");
      }

      // Visually select the cards in #myhand before playing
      if (ui.playerHand) {
        ui.playerHand.unselectAll();
        for (const c of chosenCards) {
          ui.playerHand.selectItem(String(c.id));
        }
        const pauseMs =
          ui.notifqueue.speedMode === "instant"
            ? 1
            : ui.notifqueue.speedMode === "fast"
              ? 25
              : 100;
        await new Promise((r) => setTimeout(r, pauseMs));
      }

      const cardIdStr = chosenCards.map((c) => c.id).join(";");
      return performActionAndDrain("playCombo", { cards: cardIdStr });
    },

    async bomb(cards, seat) {
      await ensureViewerSeat(seat);
      const ui = window.gameui;
      const curState = ui.gamedatas && ui.gamedatas.gamestate && ui.gamedatas.gamestate.name;

      if (curState !== "playBomb") {
        await performActionAndDrain("playBomb", { cards: "" });
        if (cards === undefined || cards === null) {
          return tt.status(false);
        }
      }

      // Now in playBomb state: play the specified bomb cards (or auto-detect bomb in hand)
      return tt.play(cards);
    },

    async cancelBomb(seat) {
      return performActionAndDrain("cancel", {}, seat);
    },

    async pass(onlyOnce = true, seat) {
      await ensureViewerSeat(seat);
      const ui = window.gameui;
      if (ui && ui.playerHand) {
        ui.playerHand.unselectAll();
      }
      return performActionAndDrain("pass", { onlyOnce: Boolean(onlyOnce) });
    },

    async cancelAutopass(seat) {
      return performActionAndDrain("cancelAutopass", {}, seat);
    },

    async wish(rank = 15, seat) {
      await ensureViewerSeat(seat);
      const ui = window.gameui;
      const parsedRank = parseRankToken(rank);
      if (!parsedRank || parsedRank < 2 || parsedRank > 15) {
        throw new Error(`Invalid Mahjong wish rank "${rank}". Expected 2..14, J/Q/K/A, or 15 (no wish).`);
      }
      if (ui && ui.mahjongValues) {
        ui.mahjongValues.unselectAll();
        ui.mahjongValues.selectItem(String(parsedRank));
      }
      return performActionAndDrain("makeAWish", { wish: parsedRank });
    },

    async choosePhoenix(rank, seat) {
      await ensureViewerSeat(seat);
      const ui = window.gameui;
      let parsedRank = rank !== undefined ? parseRankToken(rank) : null;
      if (!parsedRank && Array.isArray(ui.allowedValues) && ui.allowedValues.length > 0) {
        parsedRank = Number(ui.allowedValues[0]);
      }
      if (!parsedRank) {
        throw new Error(`Invalid Phoenix value "${rank}"`);
      }
      if (ui && ui.phoenixValues && Array.isArray(ui.phoenixValues.items)) {
        const matchItem = ui.phoenixValues.items.find((it) => Number(it.type) === parsedRank - 2);
        if (matchItem) {
          ui.phoenixValues.unselectAll();
          ui.phoenixValues.selectItem(String(matchItem.id));
        }
      }
      dojo.style("phoenixpanel", "display", "none");
      return performActionAndDrain("choosePhoenix", { phoenixValue: parsedRank });
    },

    async cancelPhoenix(seat) {
      await ensureViewerSeat(seat);
      dojo.style("phoenixpanel", "display", "none");
      return performActionAndDrain("cancelPhoenix", {});
    },

    async collect(seat) {
      const ui = window.gameui;
      const st = ui && ui.gamedatas && ui.gamedatas.gamestate;
      if (seat === undefined && st && st.name === "confirmTrick" && st.active_player) {
        const activeId = Number(st.active_player);
        if (ui.isSpectator || activeId !== Number(ui.player_id)) {
          await tt.switchSeat(activeId);
        }
      } else if (seat !== undefined) {
        await ensureViewerSeat(seat);
      }
      clearTimeout(ui.autoCollectTimeout);
      clearTimeout(ui._otherPlayerAutoCollectTimeout);
      return performActionAndDrain("collect", {});
    },

    async giveDragon(enemyIndex = 0, seat) {
      return performActionAndDrain("chooseDragonGift", { player: Number(enemyIndex) }, seat);
    },

    async step() {
      const ui = window.gameui;
      if (!ui) throw new Error("window.gameui not initialized");
      await ui._runBot("step");
      await ui.notifqueue.waitUntilIdle();
      return tt.status(false);
    },

    async actForOthers() {
      const ui = window.gameui;
      if (!ui) throw new Error("window.gameui not initialized");
      await ui._runBot("others");
      await ui.notifqueue.waitUntilIdle();
      return tt.status(false);
    },

    // ========================================================================
    // Automated Frontend + Backend Integration Test Runners
    // ========================================================================

    async runScenario(name, { speed = "fast" } = {}) {
      const ui = window.gameui;
      if (!ui) throw new Error("window.gameui not initialized");

      const prevSpeed = ui.notifqueue.speedMode;
      const prevAutoBot = localStorage.getItem("tichu_local_autobot");
      const prevAutoSwitch = localStorage.getItem("tichu_local_autoswitch");
      localStorage.setItem("tichu_local_autobot", "0");
      localStorage.setItem("tichu_local_autoswitch", "0");
      clearTimeout(ui._autoBotTimer);
      clearTimeout(ui._autoSwitchTimer);
      tt.setSpeed(speed);

      const t0 = performance.now();
      consoleAnnounce(
        "[TICHU TEST]",
        `▶ Running scenario "${name}" (speed=${speed})...`,
        "font-weight:bold;color:#ffa657",
      );

      const assertCond = (cond, msg) => {
        if (!cond) {
          throw new Error(`[SCENARIO "${name}" FAILED] ${msg}`);
        }
      };

      try {
        switch (name) {
          case "grand_tichu": {
            const s0 = await tt.loadScenario("grand_tichu", 0);
            tt.assertUI();
            assertCond(s0.state.name === "grandTichuBets", `Expected grandTichuBets, got ${s0.state.name}`);
            assertCond(s0.hand.length === 8, `Expected 8 cards in P0 hand, got ${s0.hand.length}`);
            assertCond(Boolean(document.getElementById("makeGTBet")), "Missing #makeGTBet button");
            assertCond(Boolean(document.getElementById("noBet")), "Missing #noBet button");

            await tt.betGrandTichu(200, 0);
            tt.assertUI();
            const gtIcon = document.querySelector(".grandtichucolor.\\32 385074");
            assertCond(
              gtIcon && gtIcon.style.display === "inline-block",
              "Expected P0 Grand Tichu badge to be visible",
            );

            const sAfter = await tt.actForOthers();
            tt.assertUI();
            assertCond(sAfter.state.name === "giveCards", `Expected giveCards, got ${sAfter.state.name}`);
            assertCond(sAfter.hand.length === 14, `Expected 14 cards in P0 hand, got ${sAfter.hand.length}`);
            break;
          }

          case "give_cards": {
            const s0 = await tt.loadScenario("give_cards", 0);
            tt.assertUI();
            assertCond(s0.state.name === "giveCards", `Expected giveCards, got ${s0.state.name}`);
            assertCond(s0.hand.length === 14, `Expected 14 cards in P0 hand, got ${s0.hand.length}`);

            const sAfter = await tt.giveCards(["S2", "R2", "B2"], 0);
            tt.assertUI();
            assertCond(
              sAfter.state.name === "playComboOpen",
              `Expected playComboOpen after all 4 players pass, got ${sAfter.state.name}`,
            );
            assertCond(sAfter.hand.length === 14, `Expected 14 cards after acceptCards, got ${sAfter.hand.length}`);
            const sevens = sAfter.hand.filter((c) => c.type_arg === 7);
            assertCond(
              sevens.length === 4,
              `Expected P0 to hold all four 7s (bomb completed by partner P2), got ${sevens.length}`,
            );
            break;
          }

          case "mahjong_wish": {
            const s0 = await tt.loadScenario("mahjong_wish", 0);
            tt.assertUI();
            assertCond(s0.state.name === "playComboOpen", `Expected playComboOpen, got ${s0.state.name}`);

            const sWishState = await tt.play(["MJ"], 0);
            tt.assertUI();
            assertCond(
              sWishState.state.name === "mahjongPlay",
              `Expected mahjongPlay after playing MJ, got ${sWishState.state.name}`,
            );
            assertCond(
              document.getElementById("mahjongpanel")?.style.display === "block",
              "Expected #mahjongpanel to be visible in mahjongPlay",
            );

            const sAfterWish = await tt.wish(9, 0);
            tt.assertUI();
            assertCond(sAfterWish.state.name === "playCombo", `Expected playCombo, got ${sAfterWish.state.name}`);
            assertCond(sAfterWish.mahjongWish === 9, `Expected mahjongWish === 9, got ${sAfterWish.mahjongWish}`);
            assertCond(
              document.getElementById("mahjongIndicator")?.style.display === "block",
              "Expected #mahjongIndicator to be visible when wish=9",
            );

            // Switch to P1 and fulfill the wish with S9
            await tt.switchSeat(1);
            tt.assertUI();
            const sGranted = await tt.play(["S9"], 1);
            tt.assertUI();
            assertCond(
              sGranted.mahjongWish === 0,
              `Expected mahjongWish to reset to 0 after fulfillment, got ${sGranted.mahjongWish}`,
            );
            assertCond(
              document.getElementById("mahjongIndicator")?.style.display === "none",
              "Expected #mahjongIndicator to hide after wish granted",
            );
            break;
          }

          case "phoenix_ambiguous": {
            const s0 = await tt.loadScenario("phoenix_ambiguous", 0);
            tt.assertUI();
            assertCond(s0.state.name === "playComboOpen", `Expected playComboOpen, got ${s0.state.name}`);

            const sPh = await tt.play(["S5", "R6", "B7", "G8", "PH"], 0);
            tt.assertUI();
            assertCond(
              sPh.state.name === "phoenixPlay",
              `Expected phoenixPlay for ambiguous straight, got ${sPh.state.name}`,
            );
            assertCond(
              document.getElementById("phoenixpanel")?.style.display === "block",
              "Expected #phoenixpanel to be visible in phoenixPlay",
            );

            // Test cancelPhoenix first
            const sCancel = await tt.cancelPhoenix(0);
            tt.assertUI();
            assertCond(
              sCancel.state.name === "playComboOpen",
              `Expected playComboOpen after cancelPhoenix, got ${sCancel.state.name}`,
            );
            assertCond(
              document.getElementById("phoenixpanel")?.style.display === "none",
              "Expected #phoenixpanel to be hidden after cancelPhoenix",
            );

            // Now play again and choose 9
            await tt.play(["S5", "R6", "B7", "G8", "PH"], 0);
            tt.assertUI();
            const sChosen = await tt.choosePhoenix(9, 0);
            tt.assertUI();
            assertCond(
              sChosen.state.name === "playCombo",
              `Expected playCombo after choosePhoenix(9), got ${sChosen.state.name}`,
            );
            assertCond(sChosen.hand.length === 9, `Expected 9 cards left in P0 hand, got ${sChosen.hand.length}`);
            break;
          }

          case "bomb_interrupt": {
            const s0 = await tt.loadScenario("bomb_interrupt", 2);
            tt.assertUI();
            assertCond(s0.state.name === "playCombo", `Expected playCombo, got ${s0.state.name}`);
            assertCond(
              s0.activePlayerId === 2385075,
              `Expected P1 (2385075) active, got ${s0.activePlayerId}`,
            );
            assertCond(
              Boolean(document.getElementById("myPlayBomb")),
              "Expected out-of-turn #myPlayBomb button for P2",
            );

            // Step 1: Enter playBomb state and cancel
            const sBombState = await tt.bomb(undefined, 2);
            tt.assertUI();
            assertCond(
              sBombState.state.name === "playBomb",
              `Expected playBomb state, got ${sBombState.state.name}`,
            );
            assertCond(
              sBombState.activePlayerId === 2385076,
              `Expected P2 (2385076) active in playBomb, got ${sBombState.activePlayerId}`,
            );

            const sCancelled = await tt.cancelBomb(2);
            tt.assertUI();
            assertCond(
              sCancelled.state.name === "playCombo" && sCancelled.activePlayerId === 2385075,
              "Expected cancelBomb to restore playCombo with P1 active",
            );

            // Step 2: Interrupt and play the 4-of-a-kind bomb of 7s
            const sBombed = await tt.bomb(["S7", "R7", "B7", "G7"], 2);
            tt.assertUI();
            assertCond(
              sBombed.state.name === "playCombo",
              `Expected playCombo after bomb played, got ${sBombed.state.name}`,
            );
            assertCond(sBombed.hand.length === 10, `Expected 10 cards left in P2 hand, got ${sBombed.hand.length}`);
            assertCond(
              document.querySelectorAll("#lastcombo_2385076 .stockitem").length === 4,
              "Expected 4 bomb cards displayed in #lastcombo_2385076",
            );
            break;
          }

          case "dragon_gift": {
            const s0 = await tt.loadScenario("dragon_gift", 3);
            tt.assertUI();
            assertCond(s0.state.name === "playCombo", `Expected playCombo, got ${s0.state.name}`);
            assertCond(s0.trickPoints === 35, `Expected 35 trickPoints, got ${s0.trickPoints}`);

            // P3 passes -> enters confirmTrick with P0 active
            const sConfirm = await tt.pass(true, 3);
            tt.assertUI();
            assertCond(
              sConfirm.state.name === "confirmTrick",
              `Expected confirmTrick, got ${sConfirm.state.name}`,
            );

            // P0 collects -> enters chooseDragonGift
            const sGift = await tt.collect(0);
            tt.assertUI();
            assertCond(
              sGift.state.name === "chooseDragonGift",
              `Expected chooseDragonGift, got ${sGift.state.name}`,
            );
            assertCond(
              Boolean(document.getElementById("giveDragonBefore_button")) &&
                Boolean(document.getElementById("giveDragonAfter_button")),
              "Expected Dragon Gift opponent buttons in #generalactions",
            );

            // Gift the 35-point Dragon trick to enemy index 0 (P1: dashwood1)
            const sNextTrick = await tt.giveDragon(0, 0);
            tt.assertUI();
            assertCond(
              sNextTrick.state.name === "playComboOpen",
              `Expected playComboOpen for Trick 2, got ${sNextTrick.state.name}`,
            );
            const p1 = sNextTrick.players.find((p) => p.seat === 1);
            assertCond(
              p1 && p1.capturedPoints === 35,
              `Expected P1 capturedPoints === 35, got ${p1 ? p1.capturedPoints : "?"}`,
            );
            break;
          }

          case "double_victory": {
            const s0 = await tt.loadScenario("double_victory", 2);
            tt.assertUI();
            assertCond(s0.state.name === "playComboOpen", `Expected playComboOpen, got ${s0.state.name}`);
            assertCond(s0.hand.length === 1, `Expected 1 card in P2 hand, got ${s0.hand.length}`);

            const sAfter = await tt.play(["SA"], 2);
            tt.assertUI();
            const p0 = sAfter.players.find((p) => p.seat === 0);
            const p2 = sAfter.players.find((p) => p.seat === 2);
            assertCond(
              p0 && p0.score === 200 && p2 && p2.score === 200,
              `Expected Team 0 score === 200 after Double Victory, got ${p0 ? p0.score : "?"}`,
            );
            assertCond(
              sAfter.round === 2 && sAfter.state.name === "grandTichuBets",
              `Expected Round 2 grandTichuBets, got R${sAfter.round} ${sAfter.state.name}`,
            );
            // Close the round scoring popin dialog if open
            document.querySelectorAll(".bga-popin-underlay").forEach((el) => el.remove());
            break;
          }

          default:
            throw new Error(`Unknown scenario "${name}"`);
        }

        const elapsedMs = Math.round(performance.now() - t0);
        consoleAnnounce(
          "[PASS]",
          `Scenario "${name}" passed all state & DOM assertions in ${elapsedMs}ms`,
          "font-weight:bold;color:#3fb950",
        );
        return { scenario: name, passed: true, failed: 0, durationMs: elapsedMs };
      } catch (err) {
        const elapsedMs = Math.round(performance.now() - t0);
        consoleAnnounce(
          "[FAIL]",
          `Scenario "${name}" failed after ${elapsedMs}ms: ${err.message}`,
          "font-weight:bold;color:#ff7b72",
        );
        throw err;
      } finally {
        tt.setSpeed(prevSpeed);
        if (prevAutoBot !== null) localStorage.setItem("tichu_local_autobot", prevAutoBot);
        else localStorage.removeItem("tichu_local_autobot");
        if (prevAutoSwitch !== null) localStorage.setItem("tichu_local_autoswitch", prevAutoSwitch);
        else localStorage.removeItem("tichu_local_autoswitch");
      }
    },

    async runSuite({ speed = "fast" } = {}) {
      const scenarios = [
        "grand_tichu",
        "give_cards",
        "mahjong_wish",
        "phoenix_ambiguous",
        "bomb_interrupt",
        "dragon_gift",
        "double_victory",
      ];
      const results = [];
      const suiteStart = performance.now();

      consoleAnnounce(
        "[TICHU SUITE]",
        `🚀 Running all ${scenarios.length} frontend + backend integration scenarios (speed=${speed})...`,
        "font-weight:bold;color:#58a6ff",
      );

      for (const name of scenarios) {
        try {
          const res = await tt.runScenario(name, { speed });
          results.push({ Scenario: name, Status: "PASS", DurationMs: res.durationMs, Error: "" });
        } catch (err) {
          results.push({
            Scenario: name,
            Status: "FAIL",
            DurationMs: 0,
            Error: err.message || String(err),
          });
        }
      }

      const totalMs = Math.round(performance.now() - suiteStart);
      const passedCount = results.filter((r) => r.Status === "PASS").length;
      const failedCount = scenarios.length - passedCount;
      window.console.table(results);
      consoleAnnounce(
        "[TICHU SUITE]",
        `✅ ${passedCount}/${scenarios.length} scenarios passed in ${totalMs}ms`,
        passedCount === scenarios.length
          ? "font-weight:bold;color:#3fb950"
          : "font-weight:bold;color:#ff7b72",
      );

      return {
        passed: passedCount === scenarios.length,
        passedCount,
        failed: failedCount,
        totalCount: scenarios.length,
        durationMs: totalMs,
        results,
      };
    },

    async runRound({ speed = "fast", followActive = true } = {}) {
      const ui = window.gameui;
      if (!ui) throw new Error("window.gameui not initialized");

      const prevSpeed = ui.notifqueue.speedMode;
      const prevAutoBot = localStorage.getItem("tichu_local_autobot");
      const prevAutoSwitch = localStorage.getItem("tichu_local_autoswitch");
      localStorage.setItem("tichu_local_autobot", "0");
      localStorage.setItem("tichu_local_autoswitch", "0");
      clearTimeout(ui._autoBotTimer);
      clearTimeout(ui._autoSwitchTimer);
      tt.setSpeed(speed);

      const t0 = performance.now();
      try {
        let cur = tt.status(false);
        if (!cur || cur.state.name === "gameEnd" || cur.round === 0) {
          cur = await tt.newGame();
        }
        const targetRound = cur.round;
        let steps = 0;
        const maxSteps = 350;

        consoleAnnounce(
          "[TICHU ROUND]",
          `▶ Playing Round ${targetRound} live in UI (speed=${speed}, followActive=${followActive})...`,
          "font-weight:bold;color:#ffa657",
        );

        while (steps < maxSteps) {
          cur = tt.status(false);
          tt.assertUI();

          if (cur.state.name === "gameEnd" || cur.round > targetRound) {
            break;
          }

          if (followActive) {
            const nextSeatId = ui._getNextAutoSwitchPlayerId();
            if (nextSeatId && (ui.isSpectator || nextSeatId !== Number(ui.player_id))) {
              await tt.switchSeat(nextSeatId);
              tt.assertUI();
            }
          }

          const stName = ui.gamedatas.gamestate.name;
          if (stName === "grandTichuBets") {
            if (followActive && ui.isCurrentPlayerActive()) {
              await tt.betGrandTichu(0);
            } else {
              await tt.actForOthers();
            }
          } else if (stName === "giveCards") {
            if (followActive && ui.isCurrentPlayerActive()) {
              await tt.giveCards();
            } else {
              await tt.actForOthers();
            }
          } else if (stName === "confirmTrick" && ui.isCurrentPlayerActive()) {
            await tt.collect();
          } else {
            await tt.step();
          }
          steps++;
        }

        // Dismiss round-end scoring modal if open
        document.querySelectorAll(".bga-popin-underlay").forEach((el) => el.remove());

        const elapsedMs = Math.round(performance.now() - t0);
        const finalStatus = tt.status(false);
        consoleAnnounce(
          "[TICHU ROUND]",
          `✅ Completed Round ${targetRound} in ${steps} steps (${elapsedMs}ms) | Scores: ${finalStatus.players.map((p) => `P${p.seat}:${p.score}`).join(", ")}`,
          "font-weight:bold;color:#3fb950",
        );
        return {
          passed: true,
          failed: 0,
          round: targetRound,
          steps,
          durationMs: elapsedMs,
          status: finalStatus,
        };
      } finally {
        tt.setSpeed(prevSpeed);
        if (prevAutoBot !== null) localStorage.setItem("tichu_local_autobot", prevAutoBot);
        else localStorage.removeItem("tichu_local_autobot");
        if (prevAutoSwitch !== null) localStorage.setItem("tichu_local_autoswitch", prevAutoSwitch);
        else localStorage.removeItem("tichu_local_autoswitch");
      }
    },

    async runGame({ speed = "fast", gameLength = 1, followActive = false } = {}) {
      const ui = window.gameui;
      if (!ui) throw new Error("window.gameui not initialized");

      const prevSpeed = ui.notifqueue.speedMode;
      const t0 = performance.now();
      tt.setSpeed(speed);

      try {
        consoleAnnounce(
          "[TICHU GAME]",
          `▶ Starting full game run (gameLength=${gameLength}, speed=${speed})...`,
          "font-weight:bold;color:#58a6ff",
        );
        await tt.newGame({ gameLength, playerTeams: 1, turnBased: 0 });
        let roundsPlayed = 0;
        const maxRounds = 25;

        while (roundsPlayed < maxRounds) {
          const st = tt.status(false);
          if (st.state.name === "gameEnd" || st.state.id === 99) {
            break;
          }
          await tt.runRound({ speed, followActive });
          roundsPlayed++;
        }

        const finalStatus = tt.status(false);
        tt.assertUI();
        if (finalStatus.state.name !== "gameEnd") {
          throw new Error(`Expected gameEnd state, got ${finalStatus.state.name}`);
        }

        // Open <tichu-replay> to verify end-of-game replay rendering
        await ui._openReplayViewer();
        const replayEl = document.getElementById("game_play_replay");
        if (!replayEl) {
          throw new Error("Expected <tichu-replay#game_play_replay> to be mounted at gameEnd");
        }

        const elapsedMs = Math.round(performance.now() - t0);
        consoleAnnounce(
          "[TICHU GAME]",
          `🏆 Game finished in ${roundsPlayed} rounds (${elapsedMs}ms)! Final Scores: ${finalStatus.players.map((p) => `P${p.seat}(${p.name}): ${p.score}`).join(" | ")} | <tichu-replay> verified!`,
          "font-weight:bold;color:#3fb950",
        );

        return {
          passed: true,
          failed: 0,
          roundsPlayed,
          durationMs: elapsedMs,
          finalScores: finalStatus.players.map((p) => ({
            seat: p.seat,
            name: p.name,
            score: p.score,
          })),
          replayMounted: Boolean(replayEl),
        };
      } finally {
        tt.setSpeed(prevSpeed);
      }
    },
  };

  window.tichuTest = tt;
  window.tt = tt;

  function bootGameInstance(GameClass) {
    const start = () => {
      if (window.gameui) return;
      const instance = new GameClass();
      window.gameui = instance;

      // Initialize score counters for all 4 players
      const players = (instance.gamedatas && instance.gamedatas.players) || {};
      for (const pId of Object.keys(players)) {
        const counter = new EbgCounter();
        counter.create("player_score_" + pId);
        counter.setValue(players[pId].score || 0);
        instance.scoreCtrl[Number(pId)] = counter;
        instance.scoreCtrl[pId] = counter;
      }

      // Intercept clicks on right-side player board name links so they also switch seats in-place
      document.querySelectorAll("#player_boards .player-name a[href^='?as=']").forEach((aEl) => {
        aEl.addEventListener("click", (evt) => {
          if (evt.metaKey || evt.ctrlKey || evt.shiftKey) return;
          evt.preventDefault();
          const href = aEl.getAttribute("href") || "";
          const m = href.match(/as=(\d+)/);
          if (m) {
            instance._switchSeatInPlace(Number(m[1]));
          }
        });
      });

      instance._renderDevBar();
      instance._hydrateInitialLogs();

      if (typeof instance.setup === "function") {
        instance.setup(instance.gamedatas);
      }

      const initialState = instance.gamedatas && instance.gamedatas.gamestate;
      if (initialState) {
        instance.updatePageTitle(initialState);
        if (typeof instance.onEnteringState === "function") {
          instance.onEnteringState(initialState.name, initialState);
        }
        if (typeof instance.onUpdateActionButtons === "function") {
          instance.onUpdateActionButtons(initialState.name, initialState.args);
        }
        if (
          initialState.name === "chooseDragonGift" &&
          typeof instance.onEnteringStateChooseDragonGift === "function"
        ) {
          instance.onEnteringStateChooseDragonGift(initialState.args);
        }
        instance._scheduleOtherPlayerAutoCollect(initialState);
      }

      instance._setupSyncChannel();
      instance._logStateAnnouncement();
      instance._onQueueDrained();

      window.console.log(
        "%c🀄 Tichu Local Console Ready!%c Type %ctt.help()%c for commands, %cawait tt.runSuite()%c for integration tests, or %cawait tt.runRound()%c to watch a live round.",
        "font-weight:bold;font-size:13px;color:#58a6ff",
        "",
        "font-weight:bold;color:#3fb950",
        "",
        "font-weight:bold;color:#f0883e",
        "",
        "font-weight:bold;color:#d2a8ff",
        "",
      );

      if (pendingAutorun) {
        const autorunTarget = pendingAutorun;
        const speed = initialAutorunSpeed;
        if (document.body && document.body.dataset) {
          document.body.dataset.testStatus = "RUNNING";
        }
        setTimeout(async () => {
          pendingAutorun = null;
          try {
            const viewerParam = instance.isSpectator ? 0 : instance.player_id;
            window.history.replaceState(null, "", "?as=" + encodeURIComponent(viewerParam));
          } catch (_e) {}

          try {
            let res;
            if (autorunTarget === "suite") {
              res = await window.tt.runSuite({ speed });
            } else if (autorunTarget === "round") {
              res = await window.tt.runRound({ speed, followActive: true });
            } else if (autorunTarget === "game") {
              res = await window.tt.runGame({ speed });
            } else {
              res = await window.tt.runScenario(autorunTarget, { speed });
            }
            window.lastTestResult = res;
            if (document.body && document.body.dataset) {
              document.body.dataset.testStatus =
                res.failed === 0 && res.passed !== false ? "PASS" : "FAIL";
              document.body.dataset.testSummary = JSON.stringify(res);
            }
          } catch (err) {
            const failRes = {
              passed: false,
              failed: 1,
              error: err && err.message ? err.message : String(err),
            };
            window.lastTestResult = failRes;
            if (document.body && document.body.dataset) {
              document.body.dataset.testStatus = "FAIL";
              document.body.dataset.testSummary = JSON.stringify(failRes);
            }
          } finally {
            try {
              const viewerParam = instance.isSpectator ? 0 : instance.player_id;
              window.history.replaceState(null, "", "?as=" + encodeURIComponent(viewerParam));
            } catch (_e) {}
          }
        }, 100);
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      setTimeout(start, 0);
    }
  }

  window.define = function (depsOrFactory, maybeFactory) {
    const factory = typeof depsOrFactory === "function" ? depsOrFactory : maybeFactory;
    if (typeof factory === "function") {
      return factory(window.dojo, declare);
    }
  };
  window.define.amd = true;
})();
