import { html, css, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { LivePlayer, PassSlotState } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";
import "./tichu-card";
import type { TichuCard } from "./tichu-card";

const t = (s: string) => (typeof _ === "function" ? _(s) : s);

export class TichuPassArea extends LitElement {
  @state() private stateName = "";
  @state() private isSpectator = false;
  @state() private isCurrentPlayerActive = false;
  @state() private passSlots: PassSlotState[] = [];
  @state() private players: Record<string, LivePlayer> = {};
  @state() private isTiki = false;
  @state() private clockwise = true;

  static override get styles() {
    return [
      styles,
      css`
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
          height: 24px;
          line-height: 24px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-bottom: 10px;
        }
        .playertablecard {
          width: 120px;
          height: 155px;
          margin: 0 auto;
        }
        .playertablebackground {
          position: relative;
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
          position: absolute;
          top: 40px;
          left: 20px;
          z-index: 5;
          transition:
            transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
            opacity 0.5s ease-in;
          will-change: transform, opacity;
        }
        tichu-card.slide-out {
          transform: translateY(-60px);
          opacity: 0;
        }
        tichu-card.slide-to-hand {
          transform: translateY(180px);
          opacity: 0;
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
  }

  override render() {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    this.style.setProperty("--icon-url", `url(${themeUrl}img/tichu-icons.png)`);

    const hasPendingPassCards = this.passSlots.some(
      (s) => s.givenCard !== null || s.receivedCard !== null || s.animatingAccept,
    );
    const isVisible =
      !this.isSpectator &&
      (this.stateName === "giveCards" ||
        this.stateName === "showPassedCards" ||
        this.stateName === "acceptPassedCards" ||
        hasPendingPassCards);

    return html`
      <div
        id="playertables"
        class=${classMap({
          visible: isVisible,
          clockwise: this.clockwise,
          giveCards: this.stateName === "giveCards",
          active: this.isCurrentPlayerActive,
        })}
        style="display: ${isVisible ? "flex" : "none"}"
      >
        ${this.passSlots.map((slot) => this.renderSlot(slot))}
      </div>
    `;
  }

  private renderSlot(slot: PassSlotState) {
    const targetPlayer = this.players[slot.playerId];
    const color = targetPlayer?.color ?? "000000";
    const name = targetPlayer?.name ?? "";
    const isGrandTichu = targetPlayer?.callGrandTichu === 200;
    const isTichu = targetPlayer?.callTichu === 100;
    const hasCard = slot.givenCard !== null || slot.receivedCard !== null;

    return html`
      <div
        class="whiteblock playertable playertable_${slot.dir}"
        id="playertable_${slot.dir}"
        data-player-id="${slot.playerId}"
        @click=${() => this.onSlotClick(slot.dir - 1)}
      >
        <div class="playertablename" style="color: #${color}">${name}</div>
        <div class="playertablecard" id="give_${slot.dir}">
          <div class="givePassCard" id="giveplayertable_${slot.dir}"></div>
          <div class="receivePassCard" id="receiveplayertable_${slot.playerId}"></div>
          <div class="playertablebackground">
            <div class="tichubets">
              <div
                class="icon big grandtichucolor ${slot.playerId}"
                style="display: ${isGrandTichu ? "inline-block" : "none"}"
                title=${t("Grand Tichu bet")}
              ></div>
              <div
                class="icon big tichucolor ${slot.playerId}"
                style="display: ${isTichu ? "inline-block" : "none"}"
                title=${t("Tichu bet")}
              ></div>
            </div>
            <div
              class="CardBack selectable playertabletext"
              style=${hasCard ? "display: none" : ""}
            >
              <span>${t("Select a card and click here")}</span>
            </div>
          </div>
          ${
            slot.givenCard
              ? html`<tichu-card
                  .card=${slot.givenCard}
                  .scale=${1.0}
                  .tiki=${this.isTiki}
                  class=${classMap({
                    "given-card": true,
                    cardontable: true,
                    "slide-out": slot.animatingAccept,
                  })}
                ></tichu-card>`
              : ""
          }
          ${
            slot.receivedCard
              ? html`<tichu-card
                  .card=${slot.receivedCard}
                  .scale=${1.0}
                  .tiki=${this.isTiki}
                  class=${classMap({
                    "received-card": true,
                    cardontable: true,
                    "slide-to-hand": slot.animatingAccept,
                  })}
                ></tichu-card>`
              : ""
          }
        </div>
      </div>
    `;
  }

  getReceivedCardRects(): Map<number, DOMRect> {
    const result = new Map<number, DOMRect>();
    if (!this.shadowRoot) return result;
    const cardEls = Array.from(
      this.shadowRoot.querySelectorAll<TichuCard>("tichu-card.received-card"),
    );
    for (const cardEl of cardEls) {
      if (!cardEl.card?.id) continue;
      const numId = Number(cardEl.card.id);
      if (Number.isNaN(numId)) continue;
      const innerCard = cardEl.shadowRoot?.getElementById("card");
      const rect = innerCard ? innerCard.getBoundingClientRect() : cardEl.getBoundingClientRect();
      result.set(numId, rect);
    }
    return result;
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
