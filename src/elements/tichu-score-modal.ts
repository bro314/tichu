import { css, html, LitElement, PropertyValues } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import type { LivePlayer, RoundScoreRecord } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";
import "./tichu-score-board";

export class TichuScoreModal extends LitElement {
  @state() private scoreModalOpen = false;
  @state() private players: Record<string, LivePlayer> = {};
  @state() private roundHistory: RoundScoreRecord[] = [];
  @state() private round = 0;
  @state() private targetScore = 1000;
  @state() private animationsEnabled = true;

  static override get styles() {
    return [
      styles,
      css`
        :host {
          display: block;
        }
        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }

        dialog {
          color-scheme: var(--tichu-dialog-scheme, light);
          background: var(--tichu-dialog-bg, #faf6ef);
          color: var(--tichu-dialog-text, #1f2328);
          border: 1px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.14));
          border-radius: 14px;
          padding: 0;
          margin: auto;
          width: min(620px, calc(100vw - 24px));
          max-width: calc(100vw - 24px);
          max-height: min(88vh, 720px);
          overflow: hidden;
          box-shadow: var(
            --tichu-dialog-shadow,
            0 20px 50px rgba(15, 23, 42, 0.36),
            0 4px 14px rgba(15, 23, 42, 0.16)
          );
          font-family: var(
            --tichu-font-sans,
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            Arial,
            sans-serif
          );
          font-size: 14px;
          line-height: 1.4;
          opacity: 0;
          translate: 0 10px;
          transition:
            opacity 180ms ease,
            translate 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
            overlay 180ms,
            display 180ms;
          transition-behavior: allow-discrete;
        }
        dialog[open] {
          display: flex;
          flex-direction: column;
          opacity: 1;
          translate: 0 0;
        }
        dialog::backdrop {
          background: rgba(15, 23, 42, 0.56);
          backdrop-filter: blur(3px);
          opacity: 0;
          transition:
            opacity 180ms ease,
            overlay 180ms,
            display 180ms;
          transition-behavior: allow-discrete;
        }
        dialog[open]::backdrop {
          opacity: 1;
        }

        @starting-style {
          dialog[open] {
            opacity: 0;
            translate: 0 10px;
          }
          dialog[open]::backdrop {
            opacity: 0;
          }
        }

        dialog.no-animations,
        dialog.no-animations::backdrop {
          transition: none;
          translate: none;
        }

        .dialog-shell {
          display: flex;
          flex-direction: column;
          width: 100%;
          min-height: 0;
          flex: 1 1 auto;
          max-height: inherit;
        }

        .dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 18px;
          border-bottom: 1px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.14));
          flex-shrink: 0;
        }
        .title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .title-icon {
          color: var(--tichu-dialog-accent, #0b72b5);
          flex-shrink: 0;
        }
        #tichu-score-title {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--tichu-dialog-text, #1f2328);
          line-height: 1.25;
        }
        .target-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          background: var(--tichu-dialog-segment-bg, #ebe4d8);
          color: var(--tichu-dialog-text-muted, #57606a);
          white-space: nowrap;
        }
        .close-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          padding: 0;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: var(--tichu-dialog-text-muted, #57606a);
          cursor: pointer;
          flex-shrink: 0;
          transition:
            background-color 140ms ease,
            color 140ms ease;
        }
        .close-btn:hover {
          background: var(--tichu-dialog-surface-hover, #f2ece2);
          color: var(--tichu-dialog-text, #1f2328);
        }
        .close-btn:focus-visible {
          outline: 2px solid var(--tichu-dialog-accent, #0b72b5);
          outline-offset: 2px;
        }

        .dialog-body {
          padding: 14px 18px;
          overflow-y: auto;
          flex: 1 1 auto;
          min-height: 0;
        }
        .score-card {
          background: var(--tichu-dialog-surface, #ffffff);
          border: 1px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.14));
          border-radius: 12px;
          overflow: hidden;
        }

        .dialog-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          padding: 10px 18px;
          border-top: 1px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.14));
          flex-shrink: 0;
        }
        .done-btn {
          padding: 7px 18px;
          border-radius: 8px;
          border: none;
          background: var(--tichu-dialog-accent, #0b72b5);
          color: var(--tichu-dialog-accent-fg, #ffffff);
          font-family: inherit;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 140ms ease;
        }
        .done-btn:hover {
          background: var(--tichu-dialog-accent-hover, #085c94);
        }
        .done-btn:focus-visible {
          outline: 2px solid var(--tichu-dialog-accent, #0b72b5);
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          dialog,
          dialog::backdrop,
          .close-btn,
          .done-btn {
            transition: none;
            translate: none;
          }
        }

        @media (forced-colors: active) {
          dialog {
            border: 2px solid CanvasText;
          }
          .score-card {
            border-color: ButtonText;
          }
          .done-btn {
            background: Highlight;
            color: HighlightText;
            border: 1px solid ButtonText;
          }
          button:focus-visible {
            outline: 2px solid Highlight;
            outline-offset: 2px;
          }
        }
      `,
    ];
  }

  constructor() {
    super();
    subscribe(
      this,
      () => window.gameModel.scoreModalOpen$,
      (open) => (this.scoreModalOpen = open),
    );
    subscribe(
      this,
      () => window.gameModel.players$,
      (players) => (this.players = players),
    );
    subscribe(
      this,
      () => window.gameModel.roundHistory$,
      (rounds) => (this.roundHistory = rounds),
    );
    subscribe(
      this,
      () => window.gameModel.round$,
      (round) => (this.round = round),
    );
    subscribe(
      this,
      () => window.gameModel.targetScore$,
      (targetScore) => (this.targetScore = targetScore),
    );
    subscribe(
      this,
      () => window.gameModel.animationsEnabled$,
      (animationsEnabled) => (this.animationsEnabled = animationsEnabled),
    );
  }

  protected override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    const dialog = this.shadowRoot?.getElementById(
      "tichu-score-dialog",
    ) as HTMLDialogElement | null;
    if (!dialog) return;

    if (this.scoreModalOpen) {
      if (!dialog.open && typeof dialog.showModal === "function") {
        dialog.showModal();
      }
    } else if (dialog.open && typeof dialog.close === "function") {
      dialog.close();
    }
  }

  override render() {
    return html`
      <dialog
        id="tichu-score-dialog"
        class=${classMap({ "no-animations": !this.animationsEnabled })}
        closedby="any"
        aria-labelledby="tichu-score-title"
        @close=${this.onDialogClose}
        @click=${this.onDialogClick}
      >
        <div class="dialog-shell">
          <div class="dialog-header">
            <div class="title-wrap">
              <svg
                class="title-icon"
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
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="12" y1="3" x2="12" y2="21"></line>
              </svg>
              <h2 id="tichu-score-title">${_("Scoreboard")}</h2>
              <span class="target-badge">${_("Target:")} ${this.targetScore}</span>
            </div>
            <button
              type="button"
              id="tichu-score-close"
              class="close-btn"
              aria-label=${_("Close")}
              @click=${this.onClose}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="dialog-body">
            <div class="score-card">
              <tichu-score-board
                .players=${Object.values(this.players)}
                .rounds=${this.roundHistory}
                .currentRound=${this.round}
              ></tichu-score-board>
            </div>
          </div>

          <div class="dialog-footer">
            <button type="button" class="done-btn" @click=${this.onClose}>${_("Close")}</button>
          </div>
        </div>
      </dialog>
    `;
  }

  onClose(e?: Event) {
    e?.preventDefault?.();
    window.gameModel.setScoreModalOpen(false);
  }

  onDialogClose() {
    if (window.gameModel?.getState().scoreModalOpen) {
      window.gameModel.setScoreModalOpen(false);
    }
  }

  onDialogClick(e: MouseEvent) {
    if (typeof HTMLDialogElement !== "undefined" && "closedBy" in HTMLDialogElement.prototype) {
      return;
    }
    const dialog = e.currentTarget as HTMLDialogElement | null;
    if (!dialog || e.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isDialogContent =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!isDialogContent && dialog.open && typeof dialog.close === "function") {
      dialog.close();
    }
  }
}

customElements.define("tichu-score-modal", TichuScoreModal);
