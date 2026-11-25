import { html, css, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Combo, Hand, substituteTemplate } from "./combo-validator";
import {
  AutoSortOrder,
  Card,
  CardGroupId,
  ConcedeState,
  HandSortOrder,
  LivePlayer,
  TrickLastComboState,
  canOrganizeHandInState,
  getConcedeUiState,
  getNextPlayersDesc,
  initialConcedeState,
} from "./game-model";
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
  @state() private baseSortOrder: AutoSortOrder = "rank";
  @state() private handSortOrder: HandSortOrder = "rank";
  @state() private customHandOrder: string[] = [];
  @state() private cardGroups: Record<string, CardGroupId> = {};
  @state() private liveAnnouncement = "";
  @state() private stateName = "";
  @state() private isTiki = false;
  @state() private clockwise = true;
  @state() private settingsModalOpen = false;
  @state() private mahjongWish = 0;
  @state() private players: Record<string, LivePlayer> = {};
  @state() private currentPlayerId = "";
  @state() private isAllInfoExposed = false;
  @state() private hasPlayedOrPassedInRound = false;
  @state() private round = 0;
  @state() private concede: ConcedeState = { ...initialConcedeState };
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
        #hand-organize-bar {
          margin: 4px 250px 0 15px;
          min-height: 34px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px 10px;
        }
        .organize-cluster {
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
        }
        .organize-divider {
          width: 1px;
          height: 20px;
          background: var(--tichu-divider, rgba(15, 23, 42, 0.16));
          flex-shrink: 0;
        }
        .group-cluster-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--tichu-text-muted, #334155);
          margin-right: 2px;
          user-select: none;
        }
        .org-btn {
          height: 28px;
          padding: 0 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border-radius: 7px;
          border: 1px solid var(--tichu-btn-sec-border, rgba(15, 23, 42, 0.18));
          background: var(--tichu-btn-sec-bg, rgba(255, 255, 255, 0.92));
          color: var(--tichu-btn-sec-fg, #1e293b);
          box-shadow: var(--tichu-btn-sec-shadow, 0 1px 2px rgba(15, 23, 42, 0.08));
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          line-height: 1;
          white-space: nowrap;
          cursor: pointer;
          transition:
            background-color 140ms ease,
            border-color 140ms ease,
            color 140ms ease,
            transform 120ms ease;
        }
        .org-btn:hover {
          background: var(--tichu-btn-sec-bg-hover, #ffffff);
        }
        .org-btn:active {
          background: var(--tichu-btn-sec-bg-active, #f1f5f9);
          transform: translateY(1px);
        }
        .org-btn[aria-pressed="true"] {
          background: var(--tichu-dialog-accent, #0b72b5);
          border-color: var(--tichu-dialog-accent, #0b72b5);
          color: var(--tichu-dialog-accent-fg, #ffffff);
        }
        .org-btn:focus-visible {
          outline: 2px solid var(--tichu-dialog-accent, #0b72b5);
          outline-offset: 2px;
        }
        .custom-pill {
          height: 28px;
          padding: 0 9px;
          display: inline-flex;
          align-items: center;
          border-radius: 7px;
          background: var(--tichu-dialog-accent, #0b72b5);
          color: var(--tichu-dialog-accent-fg, #ffffff);
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
          user-select: none;
        }
        .group-btn {
          min-width: 30px;
          padding: 0 8px;
        }
        .group-btn.group-1 {
          --group-color: #0284c7;
        }
        .group-btn.group-2 {
          --group-color: #d97706;
        }
        .group-btn.group-3 {
          --group-color: #059669;
        }
        .group-btn.group-4 {
          --group-color: #9333ea;
        }
        .group-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--group-color);
          flex-shrink: 0;
        }
        .group-btn.populated {
          border-color: var(--group-color);
        }
        .group-btn[aria-pressed="true"] {
          background: var(--group-color);
          border-color: var(--group-color);
          color: #ffffff;
        }
        .group-btn[aria-pressed="true"] .group-dot {
          background: #ffffff;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
          border: 0;
        }
        .spectator-settings-bar {
          display: flex;
          justify-content: flex-end;
          padding: 8px 15px 12px;
        }
        .hand-corner-controls {
          position: absolute;
          bottom: 14px;
          right: 15px;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .concede-btn {
          height: 36px;
          padding: 0 11px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-radius: 10px;
          border: 1px solid var(--tichu-surface-border, rgba(255, 255, 255, 0.6));
          background: var(--tichu-surface-bg, var(--bg-color-lighter));
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          color: var(--tichu-text, #1f2328);
          box-shadow: var(--tichu-surface-shadow, var(--elevation));
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          line-height: 1;
          cursor: pointer;
          transition:
            background-color 140ms ease,
            box-shadow 140ms ease,
            transform 140ms ease;
        }
        .concede-btn:hover {
          filter: brightness(1.05);
          box-shadow:
            0 2px 6px rgba(15, 23, 42, 0.24),
            0 1px 2px rgba(15, 23, 42, 0.14);
        }
        .concede-btn:active {
          transform: translateY(1px);
        }
        .concede-btn:focus-visible {
          outline: 2px solid #0b72b5;
          outline-offset: 2px;
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
          .concede-btn,
          .org-btn,
          .settings-btn,
          .settings-icon {
            transition: none;
          }
          .concede-btn:active,
          .org-btn:active,
          .settings-btn:active,
          .settings-btn:hover .settings-icon {
            transform: none;
          }
        }
        @media (forced-colors: active) {
          .concede-btn,
          .org-btn,
          .settings-btn {
            border-color: ButtonText;
            color: ButtonText;
          }
          .org-btn[aria-pressed="true"],
          .custom-pill {
            background: Highlight;
            color: HighlightText;
            border-color: Highlight;
          }
          .concede-btn:focus-visible,
          .org-btn:focus-visible,
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
      () => window.gameModel.baseSortOrder$,
      (order) => (this.baseSortOrder = order),
    );
    subscribe(
      this,
      () => window.gameModel.handSortOrder$,
      (order) => (this.handSortOrder = order),
    );
    subscribe(
      this,
      () => window.gameModel.customHandOrder$,
      (order) => (this.customHandOrder = order),
    );
    subscribe(
      this,
      () => window.gameModel.cardGroups$,
      (groups) => (this.cardGroups = groups),
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
    subscribe(
      this,
      () => window.gameModel.round$,
      (round) => (this.round = round),
    );
    subscribe(
      this,
      () => window.gameModel.concede$,
      (concede) => (this.concede = concede),
    );
  }

  private isReadOnly(): boolean {
    const ui = (window as any).gameui;
    if (ui && typeof ui.isReadOnly === "function") {
      return Boolean(ui.isReadOnly());
    }
    return (
      this.isSpectator ||
      typeof (window as any).g_replayFrom !== "undefined" ||
      Boolean((window as any).g_archive_mode)
    );
  }

  private getSelectionMode(): 0 | 1 | 2 {
    if (this.isReadOnly()) return 0;
    if (this.stateName === "giveCards") return 1;
    if (this.stateName === "grandTichuBets") return 0;
    return 2;
  }

  override render() {
    const selectionMode = this.getSelectionMode();
    const canOrganize =
      !this.isSpectator &&
      !this.isReadOnly() &&
      canOrganizeHandInState(this.stateName) &&
      this.hand.length > 0;
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

    const concedeUi = getConcedeUiState({
      concede: this.concede,
      players: this.players,
      currentPlayerId: this.currentPlayerId,
      isSpectator: this.isSpectator,
      stateName: this.stateName,
      round: this.round,
    });
    const showConcede = !this.isSpectator && !this.isReadOnly() && concedeUi.canPropose;

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
            .baseSortOrder=${this.baseSortOrder}
            .reorderable=${canOrganize}
            .customOrder=${this.customHandOrder}
            .cardGroups=${this.cardGroups}
            .selectionMode=${selectionMode}
            .selectedIds=${this.selectedCardIds}
            .dynamicOverlap=${true}
            .highlightedRank=${highlightedRank}
            .reserveFooter=${true}
            .passedOrigins=${passedOrigins}
            @selection-change=${this.onSelectionChange}
            @hand-reorder=${this.onHandReorder}
          ></tichu-stock>
        </div>
        ${
          !this.isSpectator && !this.isReadOnly() && this.hand.length > 0
            ? this.renderOrganizeBar(canOrganize, selectionMode)
            : nothing
        }
        <span class="sr-only" aria-live="polite">${this.liveAnnouncement}</span>
        ${
          !this.isSpectator
            ? html`<div class="hand-corner-controls">
                ${showConcede ? this.renderConcedeButton() : nothing} ${this.renderSettingsButton()}
              </div>`
            : nothing
        }
      </div>
      ${
        this.isSpectator
          ? html`<div class="spectator-settings-bar">${this.renderSettingsButton()}</div>`
          : nothing
      }
    `;
  }

  private renderOrganizeBar(canOrganize: boolean, selectionMode: 0 | 1 | 2) {
    const groupCounts: Record<CardGroupId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const c of this.hand) {
      const g = this.cardGroups[String(c.id)];
      if (g === 1 || g === 2 || g === 3 || g === 4) {
        groupCounts[g]++;
      }
    }
    const hasAnyGroup =
      groupCounts[1] > 0 || groupCounts[2] > 0 || groupCounts[3] > 0 || groupCounts[4] > 0;
    const selectedSet = new Set(this.selectedCardIds.map(String));
    const hasGroupedSelection = this.selectedCardIds.some((id) => {
      const g = this.cardGroups[String(id)];
      return g === 1 || g === 2 || g === 3 || g === 4;
    });

    return html`
      <div id="hand-organize-bar" role="toolbar" aria-label=${_("Card order")}>
        <div class="organize-cluster">
          <button
            type="button"
            id="order_by_rank"
            class="org-btn"
            aria-pressed=${this.handSortOrder === "rank" ? "true" : "false"}
            @click=${() => this.onSortClick("rank")}
          >
            ${_("Rank ↑")}
          </button>
          <button
            type="button"
            id="order_by_rank_desc"
            class="org-btn"
            aria-pressed=${this.handSortOrder === "rank-desc" ? "true" : "false"}
            @click=${() => this.onSortClick("rank-desc")}
          >
            ${_("Rank ↓")}
          </button>
          <button
            type="button"
            id="order_by_color"
            class="org-btn"
            aria-pressed=${this.handSortOrder === "color" ? "true" : "false"}
            @click=${() => this.onSortClick("color")}
          >
            ${_("Suit ↑")}
          </button>
          <button
            type="button"
            id="order_by_color_desc"
            class="org-btn"
            aria-pressed=${this.handSortOrder === "color-desc" ? "true" : "false"}
            @click=${() => this.onSortClick("color-desc")}
          >
            ${_("Suit ↓")}
          </button>
          ${
            this.handSortOrder === "preserve"
              ? html`<span id="order_custom" class="custom-pill" aria-current="true"
                  >${_("Custom")}</span
                >`
              : nothing
          }
        </div>
        ${
          canOrganize
            ? html`
                <span class="organize-divider" aria-hidden="true"></span>
                <div class="organize-cluster">
                  <span class="group-cluster-label">${_("Groups")}</span>
                  ${([1, 2, 3, 4] as const).map((g) => {
                    const count = groupCounts[g];
                    const allInGroupSelected =
                      count > 0 &&
                      selectedSet.size === count &&
                      this.hand
                        .filter((c) => this.cardGroups[String(c.id)] === g)
                        .every((c) => selectedSet.has(String(c.id)));
                    const tooltip =
                      selectedSet.size > 0 && selectionMode === 2
                        ? _("Assign selected cards to group")
                        : count > 0
                          ? _("Select cards in group")
                          : _("Select cards first, then click a group");
                    return html`
                      <button
                        type="button"
                        id=${`group_btn_${g}`}
                        class=${classMap({
                          "org-btn": true,
                          "group-btn": true,
                          [`group-${g}`]: true,
                          populated: count > 0,
                        })}
                        aria-pressed=${allInGroupSelected ? "true" : "false"}
                        data-tooltip=${tooltip}
                        data-tooltip-tier="slow"
                        data-tooltip-touch="longpress"
                        @click=${() => this.onGroupButtonClick(g)}
                      >
                        <span class="group-dot" aria-hidden="true"></span>
                        <span>${g}</span>
                      </button>
                    `;
                  })}
                  ${
                    hasGroupedSelection && selectionMode === 2
                      ? html`
                          <button
                            type="button"
                            id="group_btn_ungroup"
                            class="org-btn"
                            @click=${this.onUngroupSelected}
                          >
                            ${_("Ungroup")}
                          </button>
                        `
                      : nothing
                  }
                  ${
                    hasAnyGroup
                      ? html`
                          <button
                            type="button"
                            id="group_btn_clear"
                            class="org-btn"
                            @click=${this.onClearGroups}
                          >
                            ${_("Clear groups")}
                          </button>
                        `
                      : nothing
                  }
                </div>
              `
            : nothing
        }
      </div>
    `;
  }

  private renderConcedeButton() {
    const concedeLabel = _("Concede");
    const concedeTooltip = _("Propose to concede the match with your partner");
    return html`
      <button
        type="button"
        id="concede_button"
        class="concede-btn"
        data-tooltip=${concedeTooltip}
        data-tooltip-touch="longpress"
        aria-label=${concedeTooltip}
        @click=${this.onProposeConcede}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
          <line x1="4" y1="22" x2="4" y2="15"></line>
        </svg>
        <span>${concedeLabel}</span>
      </button>
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

  private onSortClick(order: AutoSortOrder) {
    window.gameModel.setHandSortOrder(order);
    const ui = (window as any).gameui;
    if (ui && typeof ui.onOrderChange === "function") {
      ui.onOrderChange(order);
    }
  }

  private onHandReorder(
    e: CustomEvent<{
      orderedIds: string[];
      movedCardId: string;
      targetGroup: CardGroupId | 0;
      source?: string;
    }>,
  ) {
    window.gameModel.commitCustomHandOrder(
      e.detail.orderedIds,
      e.detail.movedCardId,
      e.detail.targetGroup,
    );
    if (e.detail.source === "keyboard") {
      this.liveAnnouncement = _("Card moved");
    }
  }

  private onGroupButtonClick(groupId: CardGroupId) {
    if (this.getSelectionMode() !== 2 || !canOrganizeHandInState(this.stateName)) return;
    if (this.selectedCardIds.length > 0) {
      window.gameModel.assignCardGroup(this.selectedCardIds, groupId);
      this.liveAnnouncement = _("Assigned to group");
      return;
    }
    const matchingIds = this.hand
      .filter((c) => this.cardGroups[String(c.id)] === groupId)
      .map((c) => String(c.id));
    if (matchingIds.length > 0) {
      window.gameModel.setSelectedCardIds(matchingIds);
    }
  }

  private onUngroupSelected() {
    if (this.getSelectionMode() !== 2 || this.selectedCardIds.length === 0) return;
    window.gameModel.assignCardGroup(this.selectedCardIds, 0);
  }

  private onClearGroups() {
    window.gameModel.clearCardGroups();
  }

  onOpenSettings() {
    window.gameModel.setSettingsModalOpen(true);
  }

  onProposeConcede(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    const ui = (window as any).gameui;
    if (ui && typeof ui.onProposeConcede === "function") {
      ui.onProposeConcede(e);
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
}

customElements.define("tichu-hand", TichuHand);
