import { html, css, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { Card } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";
import "./tichu-stock";

const t = (s: string) => (typeof _ === "function" ? _(s) : s);

export class TichuTrickModal extends LitElement {
  @state() private trickModalOpen = false;
  @state() private currentTrick: Card[] = [];
  @state() private isTiki = false;

  static override get styles() {
    return [
      styles,
      css`
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
      `,
    ];
  }

  constructor() {
    super();
    subscribe(
      this,
      () => window.gameModel.trickModalOpen$,
      (open) => (this.trickModalOpen = open),
    );
    subscribe(
      this,
      () => window.gameModel.currentTrick$,
      (cards) => (this.currentTrick = cards),
    );
    subscribe(
      this,
      () => window.gameModel.isTiki$,
      (isTiki) => (this.isTiki = isTiki),
    );
  }

  override render() {
    if (!this.trickModalOpen) return "";

    return html`
      <div
        id="popin_showCurrentTrickDialog_underlay"
        class="custom_popin_underlay bga-popin-underlay"
        @click=${this.onUnderlayClick}
      >
        <div id="popin_showCurrentTrickDialog" class="custom_popin bga-popin-dialog">
          <div class="custom_popin_titlebar bga-popin-titlebar">
            <span id="popin_showCurrentTrickDialog_title" class="bga-popin-title">
              ${t("Cards in current Trick")}
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

  private onUnderlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      window.gameModel.setTrickModalOpen(false);
    }
  }

  private onClose(e: Event) {
    e.preventDefault();
    window.gameModel.setTrickModalOpen(false);
  }
}

customElements.define("tichu-trick-modal", TichuTrickModal);
