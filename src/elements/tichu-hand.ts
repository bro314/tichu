import { html, css, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { Combo, Hand, substituteTemplate } from "./combo-validator";
import { Card, LivePlayer, TrickLastComboState, getNextPlayersDesc } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";
import "./tichu-action-bar";
import type { PassedOriginInfo } from "./tichu-card";
import "./tichu-stock";
import type { TichuStock } from "./tichu-stock";

const THEME_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export interface BuildPassedOriginsParams {
  hand: Card[];
  players: Record<string, LivePlayer>;
  currentPlayerId: string;
  clockwise: boolean;
  isAllInfoExposed: boolean;
  hasPlayedOrPassedInRound: boolean;
}

export function buildPassedOriginsMap(
  params: BuildPassedOriginsParams,
): Record<string, PassedOriginInfo> {
  const result: Record<string, PassedOriginInfo> = {};
  const {
    hand,
    players,
    currentPlayerId,
    clockwise,
    isAllInfoExposed,
    hasPlayedOrPassedInRound,
  } = params;

  const playersDesc = getNextPlayersDesc(players, currentPlayerId);
  const leftPlayer =
    playersDesc.length >= 4 ? (clockwise ? playersDesc[2] : playersDesc[0]) : undefined;
  const partnerPlayer = playersDesc.length >= 4 ? playersDesc[1] : undefined;
  const rightPlayer =
    playersDesc.length >= 4 ? (clockwise ? playersDesc[0] : playersDesc[2]) : undefined;

  const showGlow = !hasPlayedOrPassedInRound;
  const showAvatar = !hasPlayedOrPassedInRound || isAllInfoExposed;

  for (const card of hand) {
    const senderId = card.passed_from ? String(card.passed_from) : "";
    if (!senderId || Number(senderId) <= 0) continue;

    const sender = players[senderId];
    const playerName = sender?.name ?? "";
    const avatarUrl = sender?.avatarUrl ?? "";

    let seat: "left" | "partner" | "right";
    let tooltip: string;

    if (partnerPlayer && senderId === partnerPlayer.id) {
      seat = "partner";
      tooltip = substituteTemplate(_("Passed by ${player_name} (Partner)"), { player_name: playerName });
    } else if (leftPlayer && senderId === leftPlayer.id) {
      seat = "left";
      tooltip = substituteTemplate(_("Passed by ${player_name} (Left)"), { player_name: playerName });
    } else if (rightPlayer && senderId === rightPlayer.id) {
      seat = "right";
      tooltip = substituteTemplate(_("Passed by ${player_name} (Right)"), { player_name: playerName });
    } else if (sender) {
      seat = "left";
      tooltip = substituteTemplate(_("Passed by ${player_name}"), { player_name: playerName });
    } else {
      continue;
    }

    result[String(card.id)] = {
      playerId: senderId,
      playerName,
      avatarUrl,
      seat,
      tooltip,
      showGlow,
      showAvatar,
    };
  }

  return result;
}

export class TichuHand extends LitElement {
  @state() private isSpectator = false;
  @state() private hand: Card[] = [];
  @state() private selectedCardIds: string[] = [];
  @state() private handSortOrder: "rank" | "color" = "rank";
  @state() private stateName = "";
  @state() private isTiki = false;
  @state() private animationsEnabled = true;
  @state() private clockwise = true;
  @state() private squareTable = false;
  @state() private theme = 0;
  @state() private mahjongWish = 0;
  @state() private players: Record<string, LivePlayer> = {};
  @state() private currentPlayerId = "";
  @state() private isAllInfoExposed = false;
  @state() private hasPlayedOrPassedInRound = false;
  @state() private trickLastCombo: TrickLastComboState = {
    playerId: "",
    type: 99,
    cards: [],
    phoenixValue: null,
    description: "",
  };

  static override get styles() {
    return [
      styles,
      css`
        :host {
          display: block;
        }
        #myhandwrap {
          padding-top: 10px;
          font-size: 14px;
        }
        #myhand {
          margin: 15px 250px 6px 15px;
          min-height: 184px;
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
          padding: 0px 0px 10px 10px;
          line-height: 16px;
          color: #1f2328;
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
      `,
    ];
  }

  constructor() {
    super();
    subscribe(
      this,
      () => window.gameModel.isSpectator$,
      (isSpectator) => (this.isSpectator = isSpectator),
    );
    subscribe(
      this,
      () => window.gameModel.hand$,
      (hand) => (this.hand = hand),
    );
    subscribe(
      this,
      () => window.gameModel.selectedCardIds$,
      (ids) => (this.selectedCardIds = ids),
    );
    subscribe(
      this,
      () => window.gameModel.handSortOrder$,
      (order) => (this.handSortOrder = order),
    );
    subscribe(
      this,
      () => window.gameModel.stateName$,
      (stateName) => (this.stateName = stateName),
    );
    subscribe(
      this,
      () => window.gameModel.isTiki$,
      (isTiki) => (this.isTiki = isTiki),
    );
    subscribe(
      this,
      () => window.gameModel.animationsEnabled$,
      (animationsEnabled) => (this.animationsEnabled = animationsEnabled),
    );
    subscribe(
      this,
      () => window.gameModel.clockwise$,
      (clockwise) => (this.clockwise = clockwise),
    );
    subscribe(
      this,
      () => window.gameModel.squareTable$,
      (squareTable) => (this.squareTable = squareTable),
    );
    subscribe(
      this,
      () => window.gameModel.theme$,
      (theme) => (this.theme = theme),
    );
    subscribe(
      this,
      () => window.gameModel.mahjongWish$,
      (mahjongWish) => (this.mahjongWish = mahjongWish),
    );
    subscribe(
      this,
      () => window.gameModel.trickLastCombo$,
      (trickLastCombo) => (this.trickLastCombo = trickLastCombo),
    );
    subscribe(
      this,
      () => window.gameModel.players$,
      (players) => (this.players = players),
    );
    subscribe(
      this,
      () => window.gameModel.currentPlayerId$,
      (currentPlayerId) => (this.currentPlayerId = currentPlayerId),
    );
    subscribe(
      this,
      () => window.gameModel.isAllInfoExposed$,
      (isAllInfoExposed) => (this.isAllInfoExposed = isAllInfoExposed),
    );
    subscribe(
      this,
      () => window.gameModel.hasPlayedOrPassedInRound$,
      (hasPlayedOrPassedInRound) => (this.hasPlayedOrPassedInRound = hasPlayedOrPassedInRound),
    );
  }

  private getSelectionMode(): 0 | 1 | 2 {
    if (this.stateName === "giveCards") return 1;
    if (this.stateName === "grandTichuBets") return 0;
    return 2;
  }

  override render() {
    const selectionMode = this.getSelectionMode();
    const isArchiveMode = Boolean((window as any).g_archive_mode);
    const canFulfillWish =
      this.mahjongWish >= 2 &&
      this.mahjongWish <= 14 &&
      new Hand(this.hand).canFulFillWish(
        this.mahjongWish,
        Combo.fromLastComboState(this.trickLastCombo),
      );
    const highlightedRank = canFulfillWish ? this.mahjongWish : 0;
    const passedOrigins = buildPassedOriginsMap({
      hand: this.hand,
      players: this.players,
      currentPlayerId: this.currentPlayerId,
      clockwise: this.clockwise,
      isAllInfoExposed: this.isAllInfoExposed,
      hasPlayedOrPassedInRound: this.hasPlayedOrPassedInRound,
    });

    return html`
      <tichu-action-bar></tichu-action-bar>
      <div
        id="myhandwrap"
        class="whiteblock"
        style="display: ${this.isSpectator ? "none" : "block"}"
      >
        <div id="myhand">
          <tichu-stock
            .cards=${this.hand}
            .scale=${1.0}
            .tiki=${this.isTiki}
            .sortMode=${this.handSortOrder}
            .selectionMode=${selectionMode}
            .selectedIds=${this.selectedCardIds}
            .dynamicOverlap=${true}
            .highlightedRank=${highlightedRank}
            .reserveFooter=${true}
            .passedOrigins=${passedOrigins}
            @selection-change=${this.onSelectionChange}
          ></tichu-stock>
        </div>
        <div id="prefs">
          <span>${_("User Preferences:")}</span>
          <a
            href="#"
            class="reordercards"
            id="order_by_rank"
            style="display: ${this.handSortOrder === "color" ? "inline" : "none"}"
            @click=${this.onOrderByRank}
            >[${_("Reorder cards by rank")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="order_by_color"
            style="display: ${this.handSortOrder === "rank" ? "inline" : "none"}"
            @click=${this.onOrderByColor}
            >[${_("Reorder cards by color")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="list_table"
            style="display: ${this.squareTable ? "inline" : "none"}"
            @click=${(e: Event) => this.onTableLayout(e, false)}
            >[${_("List table")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="square_table"
            style="display: ${this.squareTable ? "none" : "inline"}"
            @click=${(e: Event) => this.onTableLayout(e, true)}
            >[${_("Square table")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="clockwise"
            style="display: ${this.clockwise ? "none" : "inline"}"
            title=${_(
              "This will affect the arrangement of the square table and the order of players when passing the cards.",
            )}
            @click=${(e: Event) => this.onClockwiseChange(e, true)}
            >[${_("Play clockwise")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="counterClockwise"
            style="display: ${this.clockwise ? "inline" : "none"}"
            title=${_(
              "This will affect the arrangement of the square table and the order of players when passing the cards.",
            )}
            @click=${(e: Event) => this.onClockwiseChange(e, false)}
            >[${_("Play counterclockwise")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="tiki_art"
            style="display: ${this.isTiki ? "none" : "inline"}"
            @click=${(e: Event) => this.onTikiClick(e, true)}
            >[${_("Tiki cards")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="standard_art"
            style="display: ${this.isTiki ? "inline" : "none"}"
            @click=${(e: Event) => this.onTikiClick(e, false)}
            >[${_("Standard cards")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="enable_animations"
            style="display: ${this.animationsEnabled ? "none" : "inline"}"
            @click=${(e: Event) => this.onAnimationsClick(e, true)}
            >[${_("Enable animations")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="disable_animations"
            style="display: ${this.animationsEnabled ? "inline" : "none"}"
            @click=${(e: Event) => this.onAnimationsClick(e, false)}
            >[${_("Disable animations")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="expReplay"
            style="display: ${isArchiveMode ? "inline" : "none"}"
            @click=${this.onExpReplay}
            >[${_("Experimental Replay")}]</a
          >
        </div>
        <div id="themes">
          <span>${_("Color Themes:")}</span>
          ${THEME_NUMBERS.map(
            (themeNo) => html`
              <a
                href="#"
                class="themelink theme${themeNo}"
                id="theme${themeNo}"
                @click=${(e: Event) => this.onThemeClick(e, themeNo)}
              >
                <div class="bg bg1"></div>
                <div class="bg bg2"></div>
                <div class="bg bg3"></div>
              </a>
            `,
          )}
        </div>
      </div>
    `;
  }

  private onSelectionChange(e: CustomEvent<{ selectedIds: string[]; clickedCard: Card }>) {
    window.gameModel.setSelectedCardIds(e.detail.selectedIds);
  }

  private onOrderByRank(e: Event) {
    e.preventDefault();
    window.gameModel.setHandSortOrder("rank");
    const ui = (window as any).gameui;
    if (ui && typeof ui.onReorderByRank === "function") {
      ui.onReorderByRank(e);
    }
  }

  private onOrderByColor(e: Event) {
    e.preventDefault();
    window.gameModel.setHandSortOrder("color");
    const ui = (window as any).gameui;
    if (ui && typeof ui.onReorderByColor === "function") {
      ui.onReorderByColor(e);
    }
  }

  private onTableLayout(e: Event, squareTable: boolean) {
    e.preventDefault();
    window.gameModel.setSquareTable(squareTable);
    const ui = (window as any).gameui;
    if (ui && typeof ui.onReorderTable === "function") {
      ui.onReorderTable(squareTable);
    }
  }

  private onClockwiseChange(e: Event, clockwise: boolean) {
    e.preventDefault();
    window.gameModel.setClockwise(clockwise);
    const ui = (window as any).gameui;
    if (ui && typeof ui.changeOrder === "function") {
      ui.changeOrder(clockwise);
    }
  }

  private onExpReplay(e: Event) {
    e.preventDefault();
    window.gameModel.setExperimentalReplayOpen(true);
    const ui = (window as any).gameui;
    if (ui && typeof ui.toggleExperimentalReplay === "function") {
      ui.toggleExperimentalReplay(true);
    }
  }

  private onTikiClick(e: Event, isTiki: boolean) {
    e.preventDefault();
    window.gameModel.setTiki(isTiki);
    const ui = (window as any).gameui;
    if (ui && typeof ui.changeTiki === "function") {
      ui.changeTiki(isTiki);
    }
  }

  private onAnimationsClick(e: Event, enabled: boolean) {
    e.preventDefault();
    window.gameModel.setAnimationsEnabled(enabled);
    const ui = (window as any).gameui;
    if (ui && typeof ui.changeAnimations === "function") {
      ui.changeAnimations(enabled);
    }
  }

  getStock(): TichuStock | null {
    return (this.shadowRoot?.querySelector("tichu-stock") as TichuStock | null) ?? null;
  }

  getCardRects(cardIds?: Array<string | number>): Map<number, DOMRect> {
    return this.getStock()?.getCardRects(cardIds) ?? new Map();
  }

  markPendingReveal(cardIds: Array<string | number>): void {
    this.getStock()?.markPendingReveal(cardIds);
  }

  revealCards(cardIds?: Array<string | number>): void {
    this.getStock()?.revealCards(cardIds);
  }

  getHandAnchorRect(): DOMRect | null {
    const handContainer = this.shadowRoot?.getElementById("myhand") ?? this;
    const rect = handContainer.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    let zoom = 1;
    const areaWrap = document.getElementById("game_play_area_wrap");
    if (areaWrap) {
      const m = areaWrap.style.transform.match(/scale\(([^)]+)\)/);
      if (m && m[1]) {
        const parsed = Number(m[1]);
        if (!Number.isNaN(parsed) && parsed > 0) zoom = parsed;
      }
    }
    const w = 100 * zoom;
    const h = 150 * zoom;
    return new DOMRect(
      rect.left + rect.width / 2 - w / 2,
      rect.top + rect.height / 2 - h / 2,
      w,
      h,
    );
  }

  private onThemeClick(e: Event, themeNo: number) {
    e.preventDefault();
    window.gameModel.setTheme(themeNo);
    const ui = (window as any).gameui;
    if (ui) {
      if (typeof ui.setTheme === "function") {
        ui.setTheme(themeNo);
      } else if (typeof ui.onThemeChange === "function") {
        ui.onThemeChange(themeNo);
      }
    }
  }
}

customElements.define("tichu-hand", TichuHand);
