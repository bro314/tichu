/*
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Tichu implementation : © Ben Rohlfs et al.
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */
import type { GameModel, LiveGamePrefs } from "./elements/game-model";
import { initStudioTestHelper } from "./studio-test";

enum Bet {
  // Player can still make a bet.
  NO_BET_YET = "-1",
  // Player cannot bet anymore.
  NO_BET = "0",
  TICHU = "100",
  GRAND_TICHU = "200",
}

interface Card {
  id: string;
  type: string;
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
  interface Window {
    gameModel: GameModel;
  }

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
    acceptCards: {};
    playCombo: {};
  }

  interface Player {
    call_tichu: Bet;
    call_grand_tichu: Bet;
    pass: string;
    no: number;
  }

  interface Gamedatas {
    allLastCombos: Record<number, Combo>;
    capturedpoints: Record<number, number>;
    capturedCards: Card[];
    currentTrick: Card[];
    currentTrickValue: number;
    firstoutplayer: number;
    hand: Card[];
    handcount: Record<number, number>;
    lastComboDescription: string;
    lastComboPlayer: string;
    mahjongOwner: number;
    mahjongWish: number;
    isAllInfoExposed: number;
    passes: number[];
    round: number;
    trick: number;
  }
}

export class Tichu {
  autoCollectTimeout?: number;
  autoAcceptTimeout?: number;
  collectSent = false;
  experimentalArchiveModeEnabled = false;
  allLastCombos: Record<number, Combo | undefined> = {};
  stateName = "";
  active_player?: string;

  playerHand = {
    getAllItems: () => {
      const hand = window.gameModel ? window.gameModel.getState().hand : this.gamedatas?.hand || [];
      return hand.map((c: any) => ({
        id: Number(c.id),
        type: (Number(c.type) - 1) * 14 + (Number(c.type_arg) - 1),
      }));
    },
    getSelectedItems: () => {
      if (!window.gameModel) return [];
      const st = window.gameModel.getState();
      const selectedSet = new Set(st.selectedCardIds.map(String));
      return st.hand
        .filter((c) => selectedSet.has(String(c.id)))
        .map((c) => ({
          id: Number(c.id),
          type: (Number(c.type) - 1) * 14 + (Number(c.type_arg) - 1),
        }));
    },
    selectItem: (id: string | number) => {
      if (!window.gameModel) return;
      const idStr = String(id);
      const st = window.gameModel.getState();
      if (st.stateName === "giveCards") {
        window.gameModel.setSelectedCardIds([idStr]);
      } else if (!st.selectedCardIds.includes(idStr)) {
        window.gameModel.setSelectedCardIds([...st.selectedCardIds, idStr]);
      }
    },
    unselectAll: () => {
      window.gameModel?.clearSelection();
    },
    removeAll: () => {
      window.gameModel?.clearSelection();
    },
    addToStockWithId: (_type: number, _id: string | number) => {},
    removeFromStockById: (_id: string | number) => {},
    count: () => {
      return window.gameModel
        ? window.gameModel.getState().hand.length
        : (this.gamedatas?.hand || []).length;
    },
  };

  mahjongValues = {
    get items() {
      return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((v) => ({
        id: v,
        type: v - 2,
      }));
    },
    getSelectedItems: () => {
      const val = window.gameModel?.getState().selectedMahjongWish ?? null;
      return val !== null ? [{ id: val, type: val - 2 }] : [];
    },
    selectItem: (id: string | number) => {
      const num = Number(id);
      window.gameModel?.setSelectedMahjongWish(Number.isNaN(num) ? null : num);
    },
    unselectAll: () => {
      window.gameModel?.setSelectedMahjongWish(null);
    },
  };

  phoenixValues = {
    get items() {
      const allowed = window.gameModel?.getState().phoenixAllowedValues ?? [];
      return allowed.map((v) => ({ id: v, type: v - 2 }));
    },
    getSelectedItems: () => {
      const val = window.gameModel?.getState().selectedPhoenixValue ?? null;
      return val !== null ? [{ id: val, type: val - 2 }] : [];
    },
    selectItem: (id: string | number) => {
      const num = Number(id);
      window.gameModel?.setSelectedPhoenixValue(Number.isNaN(num) ? null : num);
    },
    unselectAll: () => {
      window.gameModel?.setSelectedPhoenixValue(null);
    },
  };

  get allowedValues(): number[] {
    return window.gameModel?.getState().phoenixAllowedValues ?? [];
  }

  set allowedValues(vals: number[]) {
    window.gameModel?.setPhoenixAllowedValues(Array.isArray(vals) ? vals.map(Number) : []);
  }

  get clockwise(): boolean {
    return window.gameModel ? window.gameModel.getState().clockwise : true;
  }

  set clockwise(val: boolean) {
    window.gameModel?.setClockwise(Boolean(val));
  }

  get cardsToPass(): (number | null)[] {
    if (!window.gameModel) return [];
    const slots = window.gameModel.getState().passSlots;
    const handIds = new Set((this.gamedatas?.hand || []).map((c: any) => Number(c.id)));
    return slots.map((s) => {
      if (!s.givenCard) return null;
      const idNum = Number(s.givenCard.id);
      return handIds.has(idNum) ? idNum : null;
    });
  }

  set cardsToPass(_val: (number | null)[]) {
    // Compatibility setter for test harnesses
  }

  readPrefs(): LiveGamePrefs {
    let theme = Number(this.getGameUserPreference(104));
    if (Number.isNaN(theme)) {
      const stored = localStorage.getItem("tichu_theme");
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
      theme,
    };
  }

  initPreferencesObserver() {
    document.querySelectorAll(".preference_control").forEach((el) => {
      el.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLSelectElement | HTMLInputElement | null;
        const match = target?.id?.match(/^preference_[cf]ontrol_(\d+)$/);
        if (!target || !match) return;
        const pref = Number(match[1]);
        const newValue = Number(target.value);
        if (this.prefs && this.prefs[pref]) {
          this.prefs[pref].value = String(newValue);
        }
        this.onPreferenceChange(pref, newValue);
      });
    });
  }

  onPreferenceChange(prefId: number, prefValue: number) {
    switch (Number(prefId)) {
      case 100:
        this.onLayoutChange(prefValue == 2);
        break;
      case 101:
        this.onDirectionChange(prefValue != 1);
        break;
      case 103:
        window.gameModel?.setTiki(prefValue == 1);
        break;
      case 104:
        this.onThemeChange(Number(prefValue));
        break;
    }
  }

  rehydrateModel() {
    const gamedatas = this.gamedatas;
    if (!gamedatas) return;
    this.allLastCombos = gamedatas.allLastCombos || {};
    this.stateName = gamedatas.gamestate?.name || "";
    this.active_player = gamedatas.gamestate?.active_player;

    const overall = document.getElementById("overall-content");
    if (overall) {
      overall.classList.toggle("spectatorMode", Boolean(this.isSpectator));
      overall.classList.toggle("archiveMode", Boolean((window as any).g_archive_mode));
    }

    const playArea = document.getElementById("game_play_area");
    if (playArea) {
      playArea.classList.toggle("isAllInfoExposed", Number(gamedatas.isAllInfoExposed) === 1);
      if (!playArea.querySelector("tichu-game")) {
        const gameEl = document.createElement("tichu-game");
        playArea.appendChild(gameEl);
      }
    }

    window.gameModel?.hydrateFromGamedatas(
      gamedatas,
      this.player_id,
      this.isSpectator,
      this.bRealtime,
      this.readPrefs(),
    );

    this.enableAllPlayerPanels();
    const stName = gamedatas.gamestate?.name || "";
    for (const player of Object.values(gamedatas.players || {})) {
      const pId = Number(player.id);
      const board = document.getElementById(`player_board_${pId}`);
      if (board) {
        board
          .querySelectorAll(".ha_board, tichu-player-panel")
          .forEach((el) => el.parentNode?.removeChild(el));
        const panel = document.createElement("tichu-player-panel") as any;
        panel.playerId = String(pId);
        panel.setAttribute("player-id", String(pId));
        board.appendChild(panel);
      }
      if (
        Number(gamedatas.handcount?.[pId] ?? 0) === 0 &&
        stName !== "newRound" &&
        stName !== "endRound"
      ) {
        this.disablePlayerPanel(pId);
      }
    }
  }

  setup(gamedatas: Gamedatas) {
    this.gamedatas = gamedatas;
    this.rehydrateModel();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        this.rescale();
      });
      const wrap =
        document.getElementById("game_play_area_wrap") || document.getElementById("game_play_area");
      if (wrap) ro.observe(wrap);
    }

    document.addEventListener("visibilitychange", () => {
      if (
        document.visibilityState === "visible" &&
        this.gamedatas?.gamestate?.name === "showPassedCards" &&
        this.isCurrentPlayerActive()
      ) {
        window.gameModel?.setAcceptingCardsCountdown(true);
        clearTimeout(this.autoAcceptTimeout);
        this.autoAcceptTimeout = window.setTimeout(() => this.onAcceptCards(), 2000);
      }
    });

    this.initPreferencesObserver();
    this.setupNotifications();
    initStudioTestHelper(this);
  }

  onEnteringState(stateName: string, stateObject: any) {
    this.stateName = stateName;
    this.active_player = stateObject?.active_player;
    if (this.gamedatas && stateObject) {
      this.gamedatas.gamestate = stateObject;
    }
    const overall = document.getElementById("overall-content");
    if (overall && stateName) {
      overall.classList.add(`gamestate_${stateName}`);
    }

    if (stateName !== "confirmTrick") {
      clearTimeout(this.autoCollectTimeout);
    }
    if (stateName !== "showPassedCards") {
      clearTimeout(this.autoAcceptTimeout);
    }

    window.gameModel?.setGameState(stateName, {
      activePlayerId: stateObject?.active_player ?? this.getActivePlayerId(),
      activePlayerIds: Array.isArray(stateObject?.multiactive)
        ? stateObject.multiactive
        : undefined,
      isCurrentPlayerActive: this.isCurrentPlayerActive(),
    });

    const args = stateObject?.args;
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
  }

  onEnteringStateNewRound(_args?: any) {
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
      for (const id in this.gamedatas.players) {
        this.gamedatas.players[id]!.call_tichu = Bet.NO_BET_YET;
        this.gamedatas.players[id]!.call_grand_tichu = Bet.NO_BET_YET;
        this.gamedatas.players[id]!.pass = "0";
        if (this.gamedatas.capturedpoints) {
          this.gamedatas.capturedpoints[Number(id)] = 0;
        }
      }
    }
    this.allLastCombos = {};
    window.gameModel?.enterNewRound();
  }

  onEnteringStateGrandTichuBets(_args?: any) {
    window.gameModel?.enterGrandTichuBets();
  }

  onEnteringStateGiveCards(_args?: any) {
    window.gameModel?.clearSelection();
  }

  onEnteringStateShowPassedCards(args?: any) {
    this.showPassedCards(args);
  }

  onEnteringStateAcceptPassedCards(args?: any) {
    this.showPassedCards(args);
  }

  showPassedCards(args?: any) {
    if (this.gamedatas?.handcount) {
      for (const pId of Object.keys(this.gamedatas.players || {})) {
        this.gamedatas.handcount[Number(pId)] = 14;
      }
    }
    const rawReceived = args?._private ?? (this.gamedatas?.gamestate as any)?.args?._private;
    const received = Array.isArray(rawReceived) ? rawReceived : undefined;
    window.gameModel?.enterShowPassedCards(received);
  }

  onEnteringStateNewTrick(_args?: any) {
    if (this.gamedatas) {
      this.gamedatas.capturedCards = [
        ...(this.gamedatas.capturedCards || []),
        ...(this.gamedatas.currentTrick || []),
      ];
      this.gamedatas.currentTrick = [];
      this.gamedatas.currentTrickValue = 0;
      this.gamedatas.trick++;
      this.gamedatas.allLastCombos = {};
      this.gamedatas.passes = [];
      this.gamedatas.lastComboPlayer = "0";
      this.gamedatas.lastComboDescription = "";
      for (const p of Object.values(this.gamedatas.players || {})) {
        p.pass = "0";
      }
    }
    this.allLastCombos = {};
    window.gameModel?.enterNewTrick();
  }

  onEnteringStatePlayComboOpen(_args?: any) {
    // Handled reactively by <tichu-last-played>
  }

  onEnteringStatePlayCombo(_args?: any) {
    // Handled reactively by <tichu-last-played>
  }

  onEnteringStateMahjongPlay(_args?: any) {
    window.gameModel?.enterMahjongPlay();
  }

  onEnteringStatePhoenixPlay(args?: any) {
    const rawValues =
      args?._private?.values ??
      args?.values ??
      (this.gamedatas?.gamestate as any)?.args?._private?.values ??
      (this.gamedatas?.gamestate as any)?.args?.values ??
      [];
    const values = Array.isArray(rawValues) ? rawValues.map(Number) : [];
    window.gameModel?.enterPhoenixPlay(values);
  }

  onEnteringStatePlayBomb(args?: any) {
    const bombPlayerId = args?.active ?? this.active_player ?? this.getActivePlayerId();
    if (bombPlayerId) {
      window.gameModel?.enterPlayBomb(bombPlayerId);
    }
  }

  onEnteringStateChooseDragonGift(args?: any) {
    const enemies = args?.enemies ?? (this.gamedatas?.gamestate as any)?.args?.enemies;
    if (!this.isCurrentPlayerActive() || !enemies) return;
    const left = this.clockwise ? 0 : 1;
    const right = this.clockwise ? 1 : 0;
    const leftLabel = typeof enemies[left] === "object" ? enemies[left].name : enemies[left];
    const rightLabel = typeof enemies[right] === "object" ? enemies[right].name : enemies[right];
    this.addActionButton("giveDragonBefore_button", _("Give cards to " + leftLabel), () =>
      this.onGiveDragon(left),
    );
    this.addActionButton("giveDragonAfter_button", _("Give cards to " + rightLabel), () =>
      this.onGiveDragon(right),
    );
  }

  onEnteringStateConfirmTrick(_args?: any) {
    this.collectSent = false;
  }

  onEnteringStateEndRound(_args?: any) {
    this.enableAllPlayerPanels();
    if (this.gamedatas) {
      this.gamedatas.hand = [];
      this.gamedatas.allLastCombos = {};
      for (const pId of Object.keys(this.gamedatas.players || {})) {
        const idNum = Number(pId);
        if (this.gamedatas.handcount) this.gamedatas.handcount[idNum] = 0;
        if (this.gamedatas.capturedpoints) this.gamedatas.capturedpoints[idNum] = 0;
      }
    }
    this.allLastCombos = {};
    window.gameModel?.enterEndRound();
  }

  onLeavingState(stateName: string) {
    clearTimeout(this.autoAcceptTimeout);
    clearTimeout(this.autoCollectTimeout);
    window.gameModel?.setAcceptingCardsCountdown(false);
    window.gameModel?.setCollectingTrickCountdown(false);
    const overall = document.getElementById("overall-content");
    if (overall && stateName) {
      overall.classList.remove(`gamestate_${stateName}`);
    }
  }

  onUpdateActionButtons(stateName: string, args: any) {
    this.stateName = stateName;
    document
      .getElementById("game_play_area")
      ?.classList.toggle("isCurrentPlayerActive", this.isCurrentPlayerActive());
    this.removeActionButtons();

    window.gameModel?.setGameState(stateName, {
      activePlayerId: this.getActivePlayerId(),
      activePlayerIds: Array.isArray((this.gamedatas?.gamestate as any)?.multiactive)
        ? (this.gamedatas.gamestate as any).multiactive
        : undefined,
      isCurrentPlayerActive: this.isCurrentPlayerActive(),
    });

    if (this.isCurrentPlayerActive()) {
      switch (stateName) {
        case "giveCards":
          this.addActionButton(
            "resetPassCards_button",
            _("Reset choices"),
            "onResetPassCards",
            undefined,
            false,
            "gray",
          );
          this.addActionButton("passCards_button", _("Pass selected cards"), "onPassCards");
          break;

        case "showPassedCards":
          clearTimeout(this.autoAcceptTimeout);
          if (document.visibilityState === "visible") {
            window.gameModel?.setAcceptingCardsCountdown(true);
            this.autoAcceptTimeout = window.setTimeout(() => this.onAcceptCards(), 2000);
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
            "onChoosePhoenix",
          );
          this.addActionButton("cancelPhoenix", _("Cancel"), "cancelPhoenix");
          break;

        case "chooseDragonGift":
          this.onEnteringStateChooseDragonGift(args);
          break;

        case "confirmTrick":
          clearTimeout(this.autoCollectTimeout);
          if (this.bRealtime && !this.collectSent) {
            window.gameModel?.setCollectingTrickCountdown(true);
            this.autoCollectTimeout = window.setTimeout(() => this.collect(), 2000);
          }
          break;
      }
    }

    if (!this.isSpectator && this.gamedatas?.players) {
      const player = this.gamedatas.players[this.player_id];
      if (player && String(player.call_grand_tichu) === Bet.NO_BET_YET) {
        this.addActionButton(
          "noBet",
          _("No bet"),
          () => this.onGrandTichuBet(Bet.NO_BET),
          undefined,
          false,
          "gray",
        );
        this.addTooltip("noBet", _("Don't call Grand Tichu"), "");

        this.addActionButton(
          "makeGTBet",
          _("Grand Tichu"),
          () => this.onGrandTichuBet(Bet.GRAND_TICHU),
          undefined,
          false,
          "red",
        );
        this.addTooltip("makeGTBet", _("Bet 200 Points, tha you will finish first"), "");
      }
    }
  }

  // ===========================================================================
  // Preference & View Action Handlers
  // ===========================================================================

  onThemeChange(themeNumber: number) {
    localStorage.setItem("tichu_theme", String(themeNumber));
    window.gameModel?.setTheme(Number(themeNumber));
  }

  setTheme(themeNumber: number) {
    this.onThemeChange(themeNumber);
  }

  onOrderChange(order: "rank" | "color") {
    window.gameModel?.setHandSortOrder(order);
  }

  onReorderByRank(evt?: Event) {
    if (evt) {
      evt.preventDefault?.();
      evt.stopPropagation?.();
    }
    this.onOrderChange("rank");
  }

  onReorderByColor(evt?: Event) {
    if (evt) {
      evt.preventDefault?.();
      evt.stopPropagation?.();
    }
    this.onOrderChange("color");
  }

  onLayoutChange(square: boolean) {
    window.gameModel?.setSquareTable(Boolean(square));
  }

  onReorderTable(square: boolean) {
    this.onLayoutChange(square);
  }

  onDirectionChange(clockwise: boolean) {
    window.gameModel?.setClockwise(Boolean(clockwise));
  }

  changeOrder(clockwise: boolean) {
    this.onDirectionChange(clockwise);
  }

  toggleExperimentalReplay(enable?: boolean) {
    this.experimentalArchiveModeEnabled = enable ?? !this.experimentalArchiveModeEnabled;
    window.gameModel?.setExperimentalReplayOpen(false);
    const overall = document.getElementById("overall-content");
    if (overall) {
      overall.classList.toggle("experimentalArchiveMode", this.experimentalArchiveModeEnabled);
    }
    if (this.experimentalArchiveModeEnabled && !document.getElementById("game_play_replay")) {
      const replay = document.createElement("tichu-replay");
      replay.setAttribute("id", "game_play_replay");
      replay.addEventListener("exit", () => this.toggleExperimentalReplay(false));
      const wrap =
        document.getElementById("game_play_area_wrap") ||
        document.getElementById("game_play_area")?.parentElement;
      wrap?.appendChild(replay);
    }
    this.rescale();
  }

  rescale() {
    const areaElement = document.getElementById("game_play_area");
    const replayElement = document.getElementById("game_play_replay");
    const gameElement = this.experimentalArchiveModeEnabled ? replayElement : areaElement;
    const areaWrapElement = document.getElementById("game_play_area_wrap");
    if (!areaWrapElement || !gameElement) return;

    const widthAvailable = areaWrapElement.clientWidth;
    const heightAvailable = document.documentElement.clientHeight - 120;

    const widthMax = 1200;
    const widthMin = this.experimentalArchiveModeEnabled ? 1000 : 900;
    const heightMin = this.experimentalArchiveModeEnabled ? 600 : 800;

    const widthFactor = Math.max(widthAvailable / widthMin, 0.4);
    const heightFactor = Math.max(heightAvailable / heightMin, 0.7);
    const factor = Math.min(widthFactor, heightFactor, 1.0);

    areaWrapElement.style.transform = `scale(${factor})`;
    areaWrapElement.style.transformOrigin = factor === 1.0 ? "top center" : "top left";
    gameElement.style.width = `${Math.max(
      Math.min(widthAvailable / factor, widthMax),
      widthMin,
    )}px`;
  }

  // ===========================================================================
  // Player Action Methods
  // ===========================================================================

  onGiveCard(index: number) {
    if (this.gamedatas?.gamestate?.name !== "giveCards" || !this.isCurrentPlayerActive()) return;
    window.gameModel?.toggleGiveCardSlot(index);
  }

  onResetPassCards() {
    if (!this.checkAction("giveCards", true)) return;
    window.gameModel?.resetPassCards();
  }

  onPassCards() {
    if (!this.checkAction("giveCards", false)) return;
    const givenIds = window.gameModel?.getCardsToGiveIds() ?? null;
    if (!givenIds || givenIds.length !== 3) {
      this.showMessage(_("You must select exactly 3 cards"), "error");
      return;
    }
    const toGive = givenIds.join(";") + ";";
    this.takeAction("giveTheCards", { cards: toGive });
  }

  onAcceptCards() {
    clearTimeout(this.autoAcceptTimeout);
    window.gameModel?.setAcceptingCardsCountdown(false);
    if (!this.checkAction("acceptCards")) return;
    this.takeAction("acceptCards", {});
  }

  onGrandTichuBet(bet: Bet) {
    this.takeAction("grandTichuBet", { bet });
  }

  onTichuBet(evt?: Event) {
    if (evt) {
      evt.preventDefault?.();
      evt.stopPropagation?.();
    }
    this.takeAction("tichuBet", { bet: Bet.TICHU });
  }

  onPlayBomb(evt?: Event) {
    if (evt) {
      evt.preventDefault?.();
      evt.stopPropagation?.();
    }
    this.playCombo("playBomb");
  }

  onCancelBomb(evt?: Event) {
    if (evt) {
      evt.preventDefault?.();
      evt.stopPropagation?.();
    }
    this.takeAction("cancel");
  }

  onPlayCombo(evt?: Event) {
    if (evt) {
      evt.preventDefault?.();
      evt.stopPropagation?.();
    }
    if (!this.checkAction("playCombo")) return;
    this.playCombo("playCombo");
  }

  playCombo(actionName: string) {
    const items = this.playerHand.getSelectedItems();
    this.playerHand.unselectAll();
    const cardIds = items.map((item) => item.id).join(";");
    if (items.length === 0 && actionName === "playCombo") {
      this.showMessage(_("You have to select some cards first"), "error");
      return;
    }
    clearTimeout(this.autoCollectTimeout);
    this.takeAction(actionName, { cards: cardIds });
  }

  onPass(onlyOnce: boolean) {
    const selected = this.playerHand.getSelectedItems();
    if (selected.length > 0 && this.getGameUserPreference(102) == 1) {
      this.showMessage(
        _(
          "You have to unselect your cards first. (You can disable this safeguard in the user settings)",
        ),
        "error",
      );
      return;
    }
    this.playerHand.unselectAll();
    this.takeAction("pass", { onlyOnce });
  }

  cancelAutopass(evt?: Event) {
    if (evt) {
      evt.preventDefault?.();
      evt.stopPropagation?.();
    }
    this.takeAction("cancelAutopass");
  }

  onChoosePhoenix(evt?: Event) {
    if (evt) {
      evt.preventDefault?.();
      evt.stopPropagation?.();
    }
    const val = window.gameModel?.getState().selectedPhoenixValue ?? null;
    if (val === null) {
      this.showMessage(_("You need to choose ONE value for the Phoenix"), "error");
      return;
    }
    const phoenixValue = Number(val);
    if ((window.gameModel?.getState().hand.length ?? 0) === 1 && phoenixValue === 14) {
      this.confirmationDialog(
        _(
          "Do you really want to choose Ace for the Phoenix in this bomb? It looks like your only remaining card can not be played on this bomb.",
        ),
        () => this.choosePhoenix(phoenixValue),
      );
      return;
    }
    this.choosePhoenix(phoenixValue);
  }

  choosePhoenix(phoenixValue: number) {
    window.gameModel?.setSelectedPhoenixValue(null);
    this.takeAction("choosePhoenix", { phoenixValue });
  }

  cancelPhoenix() {
    window.gameModel?.setSelectedPhoenixValue(null);
    this.takeAction("cancelPhoenix");
  }

  onMakeAWish(evt?: Event) {
    if (evt) {
      evt.preventDefault?.();
      evt.stopPropagation?.();
    }
    const wish = window.gameModel?.getState().selectedMahjongWish ?? null;
    if (wish === null) {
      this.showMessage(_("You need to choose ONE value to wish"), "error");
      return;
    }
    window.gameModel?.setSelectedMahjongWish(null);
    this.takeAction("makeAWish", { wish });
  }

  onGiveDragon(player: number) {
    if (!this.checkAction("chooseDragonGift")) return;
    this.takeAction("chooseDragonGift", { player });
  }

  onChooseDragonGift(player: number) {
    this.onGiveDragon(player);
  }

  collect() {
    clearTimeout(this.autoCollectTimeout);
    window.gameModel?.setCollectingTrickCountdown(false);
    if (this.collectSent) return;
    if (!this.checkAction("collect")) return;
    this.collectSent = true;
    this.takeAction("collect");
  }

  takeAction(action: string, args: any = {}) {
    args.lock = true;
    this.ajaxcall("/tichu/tichu/" + action + ".html", args, this, () => {});
  }

  // ===========================================================================
  // Notification Subscriptions & Handlers
  // ===========================================================================

  setupNotifications() {
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

  notif_devConsole(notif: Notif & { args: NotifTypes["devConsole"] }) {
    window.console.log(`DEV NOTIF: ${notif.args.msg}`);
  }

  notif_dealCards(notif: Notif & { args: NotifTypes["dealCards"] }) {
    const cards = notif.args.cards || [];
    const totalCards = cards.length === 8 ? 8 : 14;
    if (this.gamedatas) {
      if (totalCards === 8) {
        this.gamedatas.hand = [...cards];
      } else {
        const existingIds = new Set((this.gamedatas.hand || []).map((c) => String(c.id)));
        for (const card of cards) {
          if (!existingIds.has(String(card.id))) {
            this.gamedatas.hand.push(card);
          }
        }
      }
      if (!this.gamedatas.handcount) this.gamedatas.handcount = {};
      for (const pId of Object.keys(this.gamedatas.players || {})) {
        this.gamedatas.handcount[Number(pId)] = totalCards;
      }
    }
    window.gameModel?.dealCards(cards);
  }

  notif_passCards(notif: Notif & { args: NotifTypes["passCards"] }) {
    const ids: string[] = notif.args.cardIds ?? (notif.args as unknown as string[]);
    if (!Array.isArray(ids)) return;
    if (this.gamedatas?.hand) {
      const idSet = new Set(ids.map(String));
      this.gamedatas.hand = this.gamedatas.hand.filter((c) => !idSet.has(String(c.id)));
    }
    window.gameModel?.applyPassCardsNotif(ids);
  }

  notif_acceptCards(notif: Notif & { args: NotifTypes["acceptCards"] }) {
    clearTimeout(this.autoAcceptTimeout);
    window.gameModel?.setAcceptingCardsCountdown(false);
    const cards = notif.args.cards || [];

    const acceptFn = () => {
      if (this.gamedatas) {
        if (!this.gamedatas.hand) this.gamedatas.hand = [];
        const existingIds = new Set(this.gamedatas.hand.map((c) => String(c.id)));
        for (const card of cards) {
          if (!existingIds.has(String(card.id))) {
            this.gamedatas.hand.push(card);
          }
        }
      }
      window.gameModel?.finishAcceptCards(cards);
    };

    if ((this as any).instantaneousMode) {
      acceptFn();
    } else {
      setTimeout(() => window.gameModel?.startAcceptCardsAnimation(), 1500);
      setTimeout(acceptFn, 2000);
    }
  }

  notif_playCombo(notif: Notif & { args: NotifTypes["playCombo"] }) {
    const playerId = Number(notif.args.player_id);
    const cards = notif.args.cards || [];
    const comboName = notif.args.combo_name || "";
    const points = Number(notif.args.points || 0);

    if (this.gamedatas) {
      this.gamedatas.currentTrick = [...(this.gamedatas.currentTrick || []), ...cards];
      this.gamedatas.currentTrickValue = Number(this.gamedatas.currentTrickValue || 0) + points;
      if (!this.gamedatas.handcount) this.gamedatas.handcount = {};
      const prevCount = Number(this.gamedatas.handcount[playerId] ?? 0);
      const nextCount = Math.max(0, prevCount - cards.length);
      this.gamedatas.handcount[playerId] = nextCount;

      if (playerId === Number(this.player_id) && Array.isArray(this.gamedatas.hand)) {
        const playedIds = new Set(cards.map((c: Card) => String(c.id)));
        this.gamedatas.hand = this.gamedatas.hand.filter((c) => !playedIds.has(String(c.id)));
      }
      this.allLastCombos[playerId] = {
        cards,
        description: comboName,
        type: 0,
        phoenixValue: null,
      };
      this.gamedatas.allLastCombos = this.allLastCombos as Record<number, Combo>;
      this.gamedatas.lastComboPlayer = String(playerId);
      this.gamedatas.lastComboDescription = comboName;
    }

    window.gameModel?.applyPlayCombo(playerId, cards, comboName, points);
  }

  notif_pass(notif: Notif & { args: NotifTypes["pass"] }) {
    const playerId = Number(notif.args.player_id);
    if (this.allLastCombos) {
      delete this.allLastCombos[playerId];
    }
    window.gameModel?.applyPass(playerId);
  }

  notif_captureCards(notif: Notif & { args: NotifTypes["captureCards"] }) {
    const playerId = Number(notif.args.player_id);
    const trickValue = Number(notif.args.trick_value || 0);

    if (this.gamedatas) {
      if (!this.gamedatas.capturedpoints) this.gamedatas.capturedpoints = {};
      const prevPts = Number(this.gamedatas.capturedpoints[playerId] ?? 0);
      this.gamedatas.capturedpoints[playerId] = prevPts + trickValue;
    }

    window.gameModel?.applyCaptureCards(playerId, trickValue);
  }

  notif_grandTichuBet(notif: Notif & { args: NotifTypes["grandTichuBet"] }) {
    const playerId = Number(notif.args.player_id);
    const bet = String(notif.args.bet) as Bet;
    if (this.gamedatas?.players?.[playerId]) {
      this.gamedatas.players[playerId]!.call_grand_tichu = bet;
      if (bet === Bet.GRAND_TICHU) {
        this.gamedatas.players[playerId]!.call_tichu = Bet.NO_BET;
      }
    }
    window.gameModel?.applyGrandTichuBet(playerId, bet);
    if (bet === Bet.GRAND_TICHU) {
      window.gameModel?.triggerBetAnimation(playerId, 200);
      playSound("tichu_laser");
      this.notifqueue.setSynchronousDuration(1000);
    } else {
      this.notifqueue.setSynchronousDuration(1);
    }
    this.onUpdateActionButtons(this.stateName, {});
  }

  notif_tichuBet(notif: Notif & { args: NotifTypes["tichuBet"] }) {
    const playerId = Number(notif.args.player_id);
    const bet = String(notif.args.bet) as Bet;
    if (this.gamedatas?.players?.[playerId]) {
      this.gamedatas.players[playerId]!.call_tichu = bet;
      this.gamedatas.players[playerId]!.call_grand_tichu = Bet.NO_BET;
    }
    window.gameModel?.applyTichuBet(playerId, bet);
    if (bet === Bet.TICHU) {
      window.gameModel?.triggerBetAnimation(playerId, 100);
      playSound("tichu_laser");
      this.notifqueue.setSynchronousDuration(1000);
    } else {
      this.notifqueue.setSynchronousDuration(1);
    }
    this.onUpdateActionButtons(this.stateName, {});
  }

  notif_confirmTichu(notif: Notif & { args: NotifTypes["confirmTichu"] }) {
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
      this.takeAction("confirmTichu", { bet: notif.args.grand ? Bet.GRAND_TICHU : Bet.TICHU }),
    );
  }

  notif_mahjongWishGranted(_notif: Notif) {
    if (this.gamedatas) {
      this.gamedatas.mahjongWish = 0;
    }
    window.gameModel?.setMahjongWish(0);
  }

  notif_wishMade(notif: Notif & { args: NotifTypes["wishMade"] }) {
    const wish = Number(notif.args.wish);
    if (this.gamedatas) {
      this.gamedatas.mahjongWish = wish > 0 && wish < 15 ? wish : 0;
    }
    window.gameModel?.setMahjongWish(wish);
  }

  notif_playerGoOut(notif: Notif & { args: NotifTypes["playerGoOut"] }) {
    const playerId = Number(notif.args.player_id);
    const firstOutId = Number(notif.args.firstout_id);
    if (playerId === firstOutId && this.gamedatas) {
      this.gamedatas.firstoutplayer = playerId;
    }
    this.disablePlayerPanel(playerId);
    window.gameModel?.applyPlayerGoOut(playerId, firstOutId);
  }

  notif_newScores(notif: Notif & { args: NotifTypes["newScores"] }) {
    const newScores = notif.args.newScores || {};
    for (const player_id in newScores) {
      const pId = Number(player_id);
      this.scoreCtrl[pId]?.toValue(newScores[pId]!);
      if (this.gamedatas?.players?.[pId]) {
        (this.gamedatas.players[pId] as any).score = String(newScores[pId]!);
      }
    }
    window.gameModel?.applyNewScores(newScores);
  }

  notif_autopass(notif: Notif & { args: NotifTypes["autopass"] }) {
    if (!this.isSpectator && this.gamedatas?.players?.[this.player_id]) {
      this.gamedatas.players[this.player_id]!.pass = notif.args.autopass;
    }
    window.gameModel?.setAutopass(notif.args.autopass);
    this.onUpdateActionButtons(this.stateName, {});
  }
}

export interface Tichu extends GameGui {}

define(["dojo", "dojo/_base/declare", "ebg/core/gamegui", "ebg/counter"], function (
  // @ts-ignore
  dojo,
  // @ts-ignore
  declare,
) {
  return declare("bgagame.tichu", ebg.core.gamegui, new Tichu());
});
