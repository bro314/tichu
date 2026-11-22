import { html, css, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { Combo, Hand, substituteTemplate } from "./combo-validator";
import { Card, LivePlayer, TrickLastComboState, getNextPlayersDesc } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";
import "./tichu-action-bar";
import type { PassedOriginInfo } from "./tichu-card";
import "./tichu-stock";
import type { TichuStock } from "./tichu-stock";

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
  const { hand, players, currentPlayerId, clockwise, isAllInfoExposed, hasPlayedOrPassedInRound } =
    params;

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
      tooltip = substituteTemplate(_("Passed by ${player_name} (Partner)"), {
        player_name: playerName,
      });
    } else if (leftPlayer && senderId === leftPlayer.id) {
      seat = "left";
      tooltip = substituteTemplate(_("Passed by ${player_name} (Left)"), {
        player_name: playerName,
      });
    } else if (rightPlayer && senderId === rightPlayer.id) {
      seat = "right";
      tooltip = substituteTemplate(_("Passed by ${player_name} (Right)"), {
        player_name: playerName,
      });
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
  @state() private clockwise = true;
  @state() private settingsModalOpen = false;
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
          position: relative;
          padding: 10px 0 12px;
          font-size: 14px;
        }
        #myhand {
          margin: 15px 250px 6px 15px;
          min-height: 184px;
        }
        .spectator-settings-bar {
          display: flex;
          justify-content: flex-end;
          padding: 8px 15px 12px;
        }
        #myhandwrap .settings-btn {
          position: absolute;
          top: 14px;
          right: 15px;
          z-index: 2;
        }
        .settings-btn {
          width: 36px;
          height: 36px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 1px solid var(--tichu-surface-border, rgba(255, 255, 255, 0.6));
          background: var(--tichu-surface-bg, var(--bg-color-lighter));
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          color: var(--tichu-text, #1f2328);
          box-shadow: var(--tichu-surface-shadow, var(--elevation));
          cursor: pointer;
          transition:
            background-color 140ms ease,
            box-shadow 140ms ease,
            transform 140ms ease;
        }
        .settings-btn:hover {
          filter: brightness(1.05);
          box-shadow:
            0 2px 6px rgba(15, 23, 42, 0.24),
            0 1px 2px rgba(15, 23, 42, 0.14);
        }
        .settings-btn:active {
          transform: translateY(1px);
        }
        .settings-icon {
          transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .settings-btn:hover .settings-icon {
          transform: rotate(30deg);
        }
        .settings-btn:focus-visible {
          outline: 2px solid #0b72b5;
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .settings-btn,
          .settings-icon {
            transition: none;
          }
          .settings-btn:active,
          .settings-btn:hover .settings-icon {
            transform: none;
          }
        }
        @media (forced-colors: active) {
          .settings-btn {
            border-color: ButtonText;
            color: ButtonText;
          }
          .settings-btn:focus-visible {
            outline-color: Highlight;
          }
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
      () => window.gameModel.clockwise$,
      (clockwise) => (this.clockwise = clockwise),
    );
    subscribe(
      this,
      () => window.gameModel.settingsModalOpen$,
      (open) => (this.settingsModalOpen = open),
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
        ${!this.isSpectator ? this.renderSettingsButton() : nothing}
      </div>
      ${
        this.isSpectator
          ? html`<div class="spectator-settings-bar">${this.renderSettingsButton()}</div>`
          : nothing
      }
    `;
  }

  private renderSettingsButton() {
    const settingsLabel = _("Settings");
    return html`
      <button
        type="button"
        id="settings_button"
        class="settings-btn"
        data-tooltip=${settingsLabel}
        data-tooltip-touch="longpress"
        aria-label=${settingsLabel}
        aria-haspopup="dialog"
        aria-expanded=${this.settingsModalOpen ? "true" : "false"}
        @click=${this.onOpenSettings}
      >
        <svg
          class="settings-icon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
          ></path>
        </svg>
      </button>
    `;
  }

  private onSelectionChange(e: CustomEvent<{ selectedIds: string[]; clickedCard: Card }>) {
    window.gameModel.setSelectedCardIds(e.detail.selectedIds);
  }

  onOpenSettings() {
    window.gameModel.setSettingsModalOpen(true);
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
}

customElements.define("tichu-hand", TichuHand);
