import { css, html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { fire } from "./utils";

/** Compact icon-based status HUD for round, trick, trick points, and trick inspection. */
export class TichuStatus extends LitElement {
  @property({ type: Number }) roundCount = 0;
  @property({ type: Number }) trickCount = 0;
  @property({ type: Number }) trickPoints = 0;
  @property({ type: Number }) trickSize = 0;

  static override get styles() {
    return css`
      :host {
        display: inline-block;
      }
      .status-panel {
        display: inline-flex;
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
        padding: 8px 10px;
        color: #1f2328;
        background: var(--bg-color-lighter, rgba(246, 231, 212, 0.8));
        border-radius: var(--border-radius, 6px);
        box-shadow: var(
          --elevation,
          0px 1px 2px 0px rgba(60, 64, 67, 0.3),
          0px 1px 3px 1px rgba(60, 64, 67, 0.15)
        );
      }
      .status-row {
        display: grid;
        grid-template-columns: 22px minmax(2.5ch, auto);
        align-items: center;
        column-gap: 6px;
        line-height: 24px;
        cursor: help;
      }
      .status-value {
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }
      .status-icon {
        --icon-size: 22px;
        display: inline-block;
        width: var(--icon-size);
        height: var(--icon-size);
        background-image: var(--ui-icons-url);
        background-repeat: no-repeat;
        background-size: calc(var(--icon-size) * 4) calc(var(--icon-size) * 3);
        flex-shrink: 0;
      }
      .status-icon.round {
        background-position: 0 calc(var(--icon-size) * -2);
      }
      .status-icon.trick {
        background-position: calc(var(--icon-size) * -1) calc(var(--icon-size) * -2);
      }
      .status-icon.points {
        background-position: calc(var(--icon-size) * -2) calc(var(--icon-size) * -1);
      }
      .status-icon.eye {
        --icon-size: 24px;
        background-position: calc(var(--icon-size) * -2) calc(var(--icon-size) * -2);
      }
      .trick-action {
        margin-top: 3px;
        padding-top: 5px;
        border-top: 1px solid rgba(31, 35, 40, 0.13);
        display: flex;
        justify-content: center;
      }
      .trick-btn {
        width: 100%;
        min-width: 48px;
        min-height: 30px;
        padding: 3px 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 5px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        transition:
          background-color 140ms ease,
          transform 140ms ease;
      }
      .trick-btn .status-icon.eye {
        transition: transform 140ms ease;
      }
      .trick-btn:hover {
        background: rgba(31, 35, 40, 0.09);
      }
      .trick-btn:hover .status-icon.eye {
        transform: scale(1.1);
      }
      .trick-btn:active {
        background: rgba(31, 35, 40, 0.14);
        transform: translateY(1px);
      }
      .trick-btn:focus-visible {
        outline: 2px solid #0b72b5;
        outline-offset: 2px;
      }
      @media (prefers-reduced-motion: reduce) {
        .trick-btn,
        .trick-btn .status-icon.eye {
          transition: none;
        }
        .trick-btn:hover .status-icon.eye,
        .trick-btn:active {
          transform: none;
        }
      }
      @media (prefers-contrast: more) {
        .trick-action {
          border-top-color: currentColor;
        }
        .trick-btn {
          border: 1px solid currentColor;
        }
      }
      @media (forced-colors: active) {
        .trick-action {
          border-top-color: CanvasText;
        }
        .trick-btn {
          border: 1px solid ButtonText;
        }
        .trick-btn:focus-visible {
          outline-color: Highlight;
        }
      }
      .visually-hidden:where(:not(:focus-within, :active)) {
        position: absolute !important;
        clip-path: inset(50%) !important;
        overflow: hidden !important;
        width: 1px !important;
        height: 1px !important;
        margin: -1px !important;
        padding: 0 !important;
        border: 0 !important;
        white-space: nowrap !important;
      }
    `;
  }

  override render() {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    this.style.setProperty("--ui-icons-url", `url(${themeUrl}img/tichu-ui-icons.png)`);

    const roundLabel = _("Round:");
    const trickLabel = _("Trick:");
    const trickPointsLabel = _("Trick Points:");

    return html`
      <div class="status-panel">
        ${this.renderMetricRow("round", roundLabel, "roundCounter", this.roundCount)}
        ${this.renderMetricRow("trick", trickLabel, "trickCounter", this.trickCount)}
        ${this.renderMetricRow("points", trickPointsLabel, "currentTrickCounter", this.trickPoints)}
        ${this.renderButton()}
      </div>
    `;
  }

  private renderMetricRow(iconClass: string, label: string, counterId: string, value: number) {
    return html`
      <div class="status-row" title=${`${label} ${value}`}>
        <span class="status-icon ${iconClass}" aria-hidden="true"></span>
        <span class="visually-hidden">${label} </span>
        <span id=${counterId} class="status-value">${value}</span>
      </div>
    `;
  }

  private renderButton() {
    if (this.trickSize === 0) return "";
    const showTrickLabel = _("Show current trick");
    return html`<div class="trick-action">
      <button
        type="button"
        class="trick-btn"
        title=${showTrickLabel}
        aria-label=${showTrickLabel}
        @click=${this.onShowClick}
      >
        <span class="status-icon eye" aria-hidden="true"></span>
      </button>
    </div>`;
  }

  private onShowClick() {
    fire(this, "show-current-trick");
  }
}
customElements.define("tichu-status", TichuStatus);
