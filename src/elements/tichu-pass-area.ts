import { html, css, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { LivePlayer, PassSlotState } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";
import { getPlayAreaZoomFactor } from "./tichu-animation-layer";
import "./tichu-card";
import "./tichu-status";
import type { TichuCard } from "./tichu-card";

export const PASS_SLOT_CARD_OFFSET_X = 20;
export const PASS_SLOT_CARD_OFFSET_Y = 84;

export class TichuPassArea extends LitElement {
  @state() private stateName = "";
  @state() private isSpectator = false;
  @state() private isCurrentPlayerActive = false;
  @state() private passSlots: PassSlotState[] = [];
  @state() private reopenedPassNotice: string | null = null;
  @state() private players: Record<string, LivePlayer> = {};
  @state() private isTiki = false;
  @state() private clockwise = true;
  @state() private round = 0;
  @state() private pendingRevealCardIds: Set<string> = new Set();
  @state() private failedAvatarKeys: Set<string> = new Set();
  @state() private compactLayout = false;
  @state() private slotScale = 1.0;

  private resizeObserver?: ResizeObserver;

  static override get styles() {
    return [
      styles,
      css`
        :host {
          display: block;
          position: relative;
        }
        tichu-status {
          position: absolute;
          top: 0;
          right: 15px;
          text-align: right;
          font-size: 20px;
          z-index: 6;
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
          height: 248px;
          border-radius: var(--border-radius, 8px);
          border: 1px solid var(--tichu-surface-border, rgba(255, 255, 255, 0.55));
          background: var(--tichu-surface-bg, var(--bg-color-lighter));
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: var(--tichu-surface-shadow, var(--elevation));
          padding: 10px;
          margin: 10px 0;
        }
        #playertables.giveCards.active .playertable {
          cursor: pointer;
        }
        #playertables .playertable_1,
        #playertables .playertable_3 {
          margin: 40px 0px 15px 0px;
        }
        .playertable-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          margin-bottom: 8px;
        }
        .playertable-avatar-wrap {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          box-sizing: border-box;
          background: #334155;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          flex-shrink: 0;
        }
        .playertable-avatar-wrap.partner {
          border: 2px solid #0f9d58;
        }
        .playertable-avatar-wrap.opponent {
          border: 2px solid #475569;
        }
        .playertable-avatar-img {
          width: 100%;
          height: 100%;
          aspect-ratio: 1;
          border-radius: 50%;
          object-fit: cover;
          display: block;
        }
        .playertable-avatar-fallback {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          text-transform: uppercase;
          user-select: none;
        }
        .playertable-avatar-wrap.partner .playertable-avatar-fallback {
          background: #0f9d58;
        }
        .playertable-avatar-wrap.opponent .playertable-avatar-fallback {
          background: #334155;
        }
        #playertables .playertablename {
          width: 100%;
          font-weight: bold;
          height: 22px;
          line-height: 22px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .playertablecard {
          width: 100px;
          height: 150px;
          margin: 0 auto;
        }
        .playertablebackground {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: var(--border-radius);
          pointer-events: none;
          transition:
            border-color 150ms ease,
            background-color 150ms ease;
        }
        #playertables.giveCards.active .playertable:not(.has-card) .playertablebackground {
          border: 2px dashed rgba(31, 35, 40, 0.22);
        }
        #playertables.giveCards.active .playertable:not(.has-card):hover .playertablebackground {
          border-color: rgba(31, 35, 40, 0.48);
          background-color: rgba(255, 255, 255, 0.22);
        }
        .playertablebackground .tichubets {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .playertable-bet-corner {
          position: absolute;
          top: 6px;
          right: 6px;
          z-index: 6;
          pointer-events: auto;
        }
        .playertable-bet-corner .icon.small {
          --icon-size: 24px;
        }
        .reopen-banner {
          width: calc(100% - 12px);
          max-width: 560px;
          box-sizing: border-box;
          margin: 0 auto 8px;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid rgba(217, 119, 6, 0.45);
          background: rgba(254, 243, 199, 0.94);
          color: #78350f;
          font-size: 13px;
          font-weight: 600;
          text-align: center;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12);
        }
        :host-context(html[data-theme="dark"]) .reopen-banner {
          border-color: rgba(251, 191, 36, 0.45);
          background: rgba(120, 53, 15, 0.9);
          color: #fef3c7;
        }
        tichu-card.given-card,
        tichu-card.received-card {
          position: absolute;
          top: 84px;
          left: 20px;
          z-index: 5;
        }
        tichu-card[data-pending-reveal] {
          visibility: hidden;
        }

        /* Compact responsive layout (< 720px) */
        .pass-status-wrap.compact {
          display: flex;
          justify-content: flex-end;
          padding: 0 6px 4px 6px;
        }
        .pass-status-wrap.compact tichu-status {
          position: static;
          top: auto;
          right: auto;
        }
        #playertables.compact {
          width: 100%;
          max-width: 560px;
          padding: 0 6px;
          gap: 6px;
          align-items: flex-start;
          justify-content: center;
          box-sizing: border-box;
        }
        #playertables.compact .playertable {
          flex: 1 1 0;
          min-width: 0;
          max-width: 140px;
          width: auto;
          height: auto;
          padding: 6px;
          margin: 4px 0 8px 0;
        }
        #playertables.compact .playertable_1,
        #playertables.compact .playertable_3 {
          margin: 22px 0 8px 0;
        }
        #playertables.compact .playertable-header {
          gap: 3px;
          margin-bottom: 6px;
        }
        #playertables.compact .playertable-avatar-wrap {
          width: 32px;
          height: 32px;
        }
        #playertables.compact .playertable-avatar-fallback {
          font-size: 13px;
        }
        #playertables.compact .playertablename {
          font-size: 13px;
          height: 18px;
          line-height: 18px;
        }
        #playertables.compact .playertable-bet-corner {
          top: 4px;
          right: 4px;
        }
        #playertables.compact .playertable-bet-corner .icon.small {
          --icon-size: 20px;
        }
        #playertables.compact .playertablecard {
          position: relative;
          width: var(--slot-card-w, 100px);
          height: var(--slot-card-h, 150px);
          margin: 0 auto;
        }
        #playertables.compact .playertablebackground .tichubets .icon.big {
          --icon-size: 48px;
        }
        #playertables.compact tichu-card.given-card,
        #playertables.compact tichu-card.received-card {
          top: 0;
          left: 0;
        }
        @media (forced-colors: active) {
          .playertable-avatar-wrap,
          #playertables.giveCards.active .playertable:not(.has-card) .playertablebackground {
            border-color: CanvasText;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .playertablebackground {
            transition: none;
          }
        }
      `,
    ];
  }

  constructor() {
    super();
    subscribe(
      this,
      () => window.gameModel.stateName$,
      (stateName) => (this.stateName = stateName),
    );
    subscribe(
      this,
      () => window.gameModel.isSpectator$,
      (isSpectator) => (this.isSpectator = isSpectator),
    );
    subscribe(
      this,
      () => window.gameModel.isCurrentPlayerActive$,
      (active) => (this.isCurrentPlayerActive = active),
    );
    subscribe(
      this,
      () => window.gameModel.passSlots$,
      (slots) => (this.passSlots = slots),
    );
    subscribe(
      this,
      () => window.gameModel.reopenedPassNotice$,
      (notice) => (this.reopenedPassNotice = notice),
    );
    subscribe(
      this,
      () => window.gameModel.players$,
      (players) => (this.players = players),
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
      () => window.gameModel.round$,
      (round) => (this.round = round),
    );
  }

  override connectedCallback() {
    super.connectedCallback();
    this.updateResponsiveLayout(this.clientWidth);
    if (typeof ResizeObserver !== "undefined" && !this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        const entryWidth = entries[0]?.contentRect?.width;
        const w = typeof entryWidth === "number" && entryWidth > 0 ? entryWidth : this.clientWidth;
        this.updateResponsiveLayout(w);
      });
      this.resizeObserver.observe(this);
    }
  }

  override disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    super.disconnectedCallback();
  }

  updateResponsiveLayout(width: number) {
    if (!width || width <= 0) return;
    const nextCompact = width < 720;
    let nextScale = 1.0;
    if (width < 480) {
      const slotWidth = (width - 24) / 3;
      const cardAvail = slotWidth - 18;
      nextScale = Math.max(0.7, Math.min(1.0, Math.floor((cardAvail / 100) * 100) / 100));
    }
    if (nextCompact !== this.compactLayout) {
      this.compactLayout = nextCompact;
    }
    if (nextScale !== this.slotScale) {
      this.slotScale = nextScale;
    }
  }

  override render() {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    this.style.setProperty("--ui-icons-url", `url(${themeUrl}img/tichu-ui-icons.png)`);

    const hasPendingPassCards = this.passSlots.some(
      (s) => s.givenCard !== null || s.receivedCard !== null || s.animatingAccept,
    );
    const isVisible =
      !this.isSpectator &&
      (this.stateName === "giveCards" ||
        this.stateName === "showPassedCards" ||
        this.stateName === "acceptPassedCards" ||
        hasPendingPassCards);
    const cardW = Math.round(100 * this.slotScale);
    const cardH = Math.round(150 * this.slotScale);

    return html`
      ${
        isVisible
          ? html`<div class=${classMap({ "pass-status-wrap": true, compact: this.compactLayout })}>
              <tichu-status
                roundOnly
                ?compact=${this.compactLayout}
                roundCount=${this.round}
                .roundCount=${this.round}
                @show-scores=${this.onShowScores}
              ></tichu-status>
            </div>`
          : nothing
      }
      ${
        isVisible && this.stateName === "giveCards" && this.reopenedPassNotice
          ? html`<div class="reopen-banner" role="status">${this.reopenedPassNotice}</div>`
          : nothing
      }
      <div
        id="playertables"
        class=${classMap({
          visible: isVisible,
          clockwise: this.clockwise,
          giveCards: this.stateName === "giveCards",
          active: this.isCurrentPlayerActive,
          compact: this.compactLayout,
        })}
        style="display: ${isVisible ? "flex" : "none"}; --slot-card-w: ${cardW}px; --slot-card-h: ${cardH}px;"
      >
        ${this.passSlots.map((slot) => this.renderSlot(slot))}
      </div>
    `;
  }

  private onShowScores() {
    window.gameModel.setScoreModalOpen(true);
  }

  private onAvatarError(avatarKey: string) {
    if (this.failedAvatarKeys.has(avatarKey)) return;
    const next = new Set(this.failedAvatarKeys);
    next.add(avatarKey);
    this.failedAvatarKeys = next;
  }

  private renderSlot(slot: PassSlotState) {
    const targetPlayer = this.players[slot.playerId];
    const color = targetPlayer?.color ?? "000000";
    const name = targetPlayer?.name ?? "";
    const avatarUrl = targetPlayer?.avatarUrl ?? "";
    const avatarKey = `${slot.playerId}|${avatarUrl}`;
    const showImg = Boolean(avatarUrl) && !this.failedAvatarKeys.has(avatarKey);
    const initial = (name.trim()[0] ?? "?").toUpperCase();
    const isPartner = slot.dir === 2;
    const isGrandTichu = targetPlayer?.callGrandTichu === 200;
    const isTichu = targetPlayer?.callTichu === 100;
    const hasCard = slot.givenCard !== null || slot.receivedCard !== null;
    const showSelectHint = this.stateName === "giveCards" && this.isCurrentPlayerActive && !hasCard;
    const slotTooltip = showSelectHint ? _("Select a card and click here") : nothing;
    const givenHidden = slot.givenCard
      ? this.pendingRevealCardIds.has(String(slot.givenCard.id))
      : false;

    return html`
      <div
        class=${classMap({
          whiteblock: true,
          playertable: true,
          [`playertable_${slot.dir}`]: true,
          "has-card": hasCard,
        })}
        id="playertable_${slot.dir}"
        data-player-id="${slot.playerId}"
        data-tooltip=${slotTooltip}
        data-tooltip-tier=${showSelectHint ? "slow" : nothing}
        data-tooltip-touch=${showSelectHint ? "longpress" : nothing}
        @click=${() => this.onSlotClick(slot.dir - 1)}
      >
        <div
          class="playertable-bet-corner"
          style="display: ${(isGrandTichu || isTichu) && hasCard ? "block" : "none"}"
        >
          <div
            class="icon small grandtichucolor ${slot.playerId}"
            style="display: ${isGrandTichu ? "inline-block" : "none"}"
            data-tooltip=${_("Grand Tichu bet")}
            data-tooltip-touch="tap"
          ></div>
          <div
            class="icon small tichucolor ${slot.playerId}"
            style="display: ${isTichu ? "inline-block" : "none"}"
            data-tooltip=${_("Tichu bet")}
            data-tooltip-touch="tap"
          ></div>
        </div>
        <div class="playertable-header">
          <div
            class=${classMap({
              "playertable-avatar-wrap": true,
              partner: isPartner,
              opponent: !isPartner,
            })}
          >
            ${
              showImg
                ? html`<img
                    class="playertable-avatar-img"
                    src=${avatarUrl}
                    alt=""
                    width="36"
                    height="36"
                    @error=${() => this.onAvatarError(avatarKey)}
                  />`
                : html`<span class="playertable-avatar-fallback" aria-hidden="true"
                    >${initial}</span
                  >`
            }
          </div>
          <div class="playertablename" style=${this.getPlayerNameColorStyle(color)}>${name}</div>
        </div>
        <div class="playertablecard" id="give_${slot.dir}">
          <div class="givePassCard" id="giveplayertable_${slot.dir}"></div>
          <div class="receivePassCard" id="receiveplayertable_${slot.playerId}"></div>
          <div class="playertablebackground">
            <div class="tichubets">
              <div
                class="icon big grandtichucolor ${slot.playerId}"
                style="display: ${isGrandTichu ? "inline-block" : "none"}"
                data-tooltip=${_("Grand Tichu bet")}
                data-tooltip-touch="tap"
              ></div>
              <div
                class="icon big tichucolor ${slot.playerId}"
                style="display: ${isTichu ? "inline-block" : "none"}"
                data-tooltip=${_("Tichu bet")}
                data-tooltip-touch="tap"
              ></div>
            </div>
          </div>
          ${
            slot.givenCard
              ? html`<tichu-card
                  data-card-id=${slot.givenCard.id ?? ""}
                  ?data-pending-reveal=${givenHidden}
                  .card=${slot.givenCard}
                  .scale=${this.slotScale}
                  .tiki=${this.isTiki}
                  class=${classMap({
                    "given-card": true,
                    cardontable: true,
                  })}
                ></tichu-card>`
              : ""
          }
          ${
            slot.receivedCard
              ? html`<tichu-card
                  .card=${slot.receivedCard}
                  .scale=${this.slotScale}
                  .tiki=${this.isTiki}
                  class=${classMap({
                    "received-card": true,
                    cardontable: true,
                  })}
                ></tichu-card>`
              : ""
          }
        </div>
      </div>
    `;
  }

  isPassAreaVisible(): boolean {
    const tables = this.shadowRoot?.getElementById("playertables");
    if (!tables) return false;
    const rect = tables.getBoundingClientRect();
    return Boolean(rect && rect.width > 0 && rect.height > 0);
  }

  markPendingReveal(cardIds: Array<string | number>): void {
    if (!cardIds || cardIds.length === 0) return;
    const next = new Set(this.pendingRevealCardIds);
    for (const id of cardIds) {
      next.add(String(id));
    }
    this.pendingRevealCardIds = next;
  }

  revealCards(cardIds?: Array<string | number>): void {
    const filter = cardIds ? new Set(cardIds.map(String)) : null;
    if (this.shadowRoot?.querySelectorAll) {
      const nodes = Array.from(
        this.shadowRoot.querySelectorAll<HTMLElement>("tichu-card[data-pending-reveal]"),
      );
      for (const el of nodes) {
        const cid = el.getAttribute("data-card-id") ?? "";
        if (!filter || filter.has(cid)) {
          el.removeAttribute("data-pending-reveal");
        }
      }
    }
    if (!cardIds) {
      if (this.pendingRevealCardIds.size > 0) {
        this.pendingRevealCardIds = new Set();
      }
      return;
    }
    if (this.pendingRevealCardIds.size === 0) return;
    const next = new Set(this.pendingRevealCardIds);
    let changed = false;
    for (const id of cardIds) {
      if (next.delete(String(id))) {
        changed = true;
      }
    }
    if (changed) {
      this.pendingRevealCardIds = next;
    }
  }

  private collectCardRects(
    selector: string,
    cardIds?: Array<string | number>,
  ): Map<number, DOMRect> {
    const result = new Map<number, DOMRect>();
    if (!this.shadowRoot) return result;
    const filter = cardIds ? new Set(cardIds.map((id) => Number(id))) : null;
    const cardEls = Array.from(this.shadowRoot.querySelectorAll<TichuCard>(selector));
    for (const cardEl of cardEls) {
      if (!cardEl.card?.id) continue;
      const numId = Number(cardEl.card.id);
      if (Number.isNaN(numId)) continue;
      if (filter && !filter.has(numId)) continue;
      const innerCard = cardEl.shadowRoot?.getElementById("card");
      const rect = innerCard ? innerCard.getBoundingClientRect() : cardEl.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        result.set(numId, rect);
      }
    }
    return result;
  }

  getReceivedCardRects(): Map<number, DOMRect> {
    return this.collectCardRects("tichu-card.received-card");
  }

  getGivenCardRects(cardIds?: Array<string | number>): Map<number, DOMRect> {
    const result = this.collectCardRects("tichu-card.given-card", cardIds);
    const filter = cardIds ? new Set(cardIds.map((id) => Number(id))) : null;
    if (!filter || result.size < filter.size) {
      this.passSlots.forEach((slot, idx) => {
        if (!slot.givenCard?.id) return;
        const numId = Number(slot.givenCard.id);
        if (Number.isNaN(numId)) return;
        if (filter && !filter.has(numId)) return;
        if (!result.has(numId)) {
          const slotRect = this.getSlotCardTargetRect(idx);
          if (slotRect) result.set(numId, slotRect);
        }
      });
    }
    return result;
  }

  getSlotCardTargetRect(slotIndex: number): DOMRect | null {
    const cardBox = this.shadowRoot?.getElementById(`give_${slotIndex + 1}`);
    if (cardBox) {
      const boxRect = cardBox.getBoundingClientRect();
      if (boxRect && boxRect.width > 0 && boxRect.height > 0) {
        return boxRect;
      }
    }
    const slotEl = this.shadowRoot?.getElementById(`playertable_${slotIndex + 1}`);
    if (!slotEl) return null;
    const rect = slotEl.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    const zoom = getPlayAreaZoomFactor();
    return new DOMRect(
      rect.left + PASS_SLOT_CARD_OFFSET_X * zoom,
      rect.top + PASS_SLOT_CARD_OFFSET_Y * zoom,
      100 * zoom,
      150 * zoom,
    );
  }

  getSlotCardRectByPlayerId(playerId: string | number): DOMRect | null {
    const id = String(playerId);
    const idx = this.passSlots.findIndex((s) => String(s.playerId) === id);
    if (idx < 0) return null;
    return this.getSlotCardTargetRect(idx);
  }

  getSeatAnchorRect(playerId: string | number): DOMRect | null {
    const id = String(playerId);
    const slotEl = this.shadowRoot?.querySelector<HTMLElement>(
      `.playertable[data-player-id="${id}"]`,
    );
    if (!slotEl) return null;
    const rect = slotEl.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    const w = Math.max(50, Math.min(rect.width * 0.7, 100));
    const h = w * 1.5;
    return new DOMRect(
      rect.left + rect.width / 2 - w / 2,
      rect.top + rect.height / 2 - h / 2,
      w,
      h,
    );
  }

  private getPlayerNameColorStyle(hexColor: string): string {
    const clean = String(hexColor || "000000")
      .replace(/^#/, "")
      .toLowerCase();
    if (clean === "000000" || clean === "000") {
      return `color: var(--tichu-team-dark-fg, #${clean})`;
    }
    if (clean === "ff0000" || clean === "cc0000" || clean === "e00000" || clean === "f00") {
      return `color: var(--tichu-team-red-fg, #${clean})`;
    }
    return `color: #${clean}`;
  }

  private onSlotClick(index: number) {
    if (this.stateName !== "giveCards" || !this.isCurrentPlayerActive) return;
    this.dispatchEvent(
      new CustomEvent("pass-slot-click", {
        detail: { index },
        bubbles: true,
        composed: true,
      }),
    );
    const ui = (window as any).gameui;
    if (ui && typeof ui.onGiveCard === "function") {
      ui.onGiveCard(index);
    } else {
      window.gameModel.toggleGiveCardSlot(index);
    }
  }
}

customElements.define("tichu-pass-area", TichuPassArea);
