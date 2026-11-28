import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";
import { fire } from "./utils";

/** Compact icon-based status HUD for round, trick, trick points, trick inspection, and scoreboard. */
export class TichuStatus extends LitElement {
  @property({ type: Number }) roundCount = 0;
  @property({ type: Number }) trickCount = 0;
  @property({ type: Number }) trickPoints = 0;
  @property({ type: Number }) trickSize = 0;
  @property({ type: Boolean }) roundOnly = false;
  @property({ type: Boolean, reflect: true }) compact = false;

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
        padding: 8px 12px;
        color: var(--tichu-text, #1e293b);
        background: var(--tichu-surface-bg, var(--bg-color-lighter, rgba(252, 246, 238, 0.88)));
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid var(--tichu-surface-border, rgba(255, 255, 255, 0.55));
        border-radius: var(--border-radius, 12px);
        box-shadow: var(
          --tichu-surface-shadow,
          var(
            --elevation,
            0 1px 2px rgba(15, 23, 42, 0.08),
            0 4px 12px rgba(15, 23, 42, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.65)
          )
        );
      }
      .status-row {
        display: grid;
        grid-template-columns: 22px minmax(2.5ch, auto);
        align-items: center;
        column-gap: 6px;
        font-size: 16px;
        line-height: 22px;
        cursor: default;
      }
      .status-value {
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        color: var(--tichu-text, #1e293b);
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
        --icon-size: 22px;
        background-position: calc(var(--icon-size) * -2) calc(var(--icon-size) * -2);
      }
      .status-icon.scoreboard {
        --icon-size: 22px;
        background-position: calc(var(--icon-size) * -3) calc(var(--icon-size) * -2);
      }
      .status-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
      .status-action-btn {
        flex: 1 1 0;
        min-width: 26px;
        min-height: 26px;
        padding: 2px 4px;
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
      .status-action-btn .status-icon {
        transition: transform 140ms ease;
      }
      .status-action-btn:hover {
        background: rgba(31, 35, 40, 0.09);
      }
      .status-action-btn:hover .status-icon {
        transform: scale(1.1);
      }
      .status-action-btn:active {
        background: rgba(31, 35, 40, 0.14);
        transform: translateY(1px);
      }
      .status-action-btn:focus-visible {
        outline: 2px solid #0b72b5;
        outline-offset: 2px;
      }
      @media (prefers-reduced-motion: reduce) {
        .status-action-btn,
        .status-action-btn .status-icon {
          transition: none;
        }
        .status-action-btn:hover .status-icon,
        .status-action-btn:active {
          transform: none;
        }
      }
      @media (prefers-contrast: more) {
        .status-action-btn {
          border: 1px solid currentColor;
        }
      }
      @media (forced-colors: active) {
        .status-action-btn {
          border: 1px solid ButtonText;
        }
        .status-action-btn:focus-visible {
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
      :host([compact]) .status-panel {
        padding: 4px 6px;
        gap: 2px;
        border-radius: 10px;
      }
      :host([compact]) .status-row {
        grid-template-columns: 18px minmax(2ch, auto);
        column-gap: 4px;
        font-size: 13.5px;
        line-height: 18px;
      }
      :host([compact]) .status-icon {
        --icon-size: 18px;
      }
      :host([compact]) .status-actions {
        gap: 2px;
      }
      :host([compact]) .status-action-btn {
        min-width: 22px;
        min-height: 22px;
        padding: 1px 2px;
      }
      :host([compact]) .status-panel.round-only {
        flex-direction: row;
        align-items: center;
        gap: 8px;
        padding: 3px 8px;
      }
    `;
  }

  override render() {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    this.style.setProperty("--ui-icons-url", `url(${themeUrl}img/tichu-ui-icons.png)`);

    const roundLabel = _("Round:");
    if (this.roundOnly) {
      return html`
        <div class="status-panel round-only">
          ${this.renderMetricRow("round", roundLabel, "roundCounter", this.roundCount)}
          ${this.renderActions(false)}
        </div>
      `;
    }

    const trickLabel = _("Trick:");
    const trickPointsLabel = _("Trick Points:");

    return html`
      <div class="status-panel">
        ${this.renderMetricRow("round", roundLabel, "roundCounter", this.roundCount)}
        ${this.renderMetricRow("trick", trickLabel, "trickCounter", this.trickCount)}
        ${this.renderMetricRow("points", trickPointsLabel, "currentTrickCounter", this.trickPoints)}
        ${this.renderActions(this.trickSize > 0)}
      </div>
    `;
  }

  private renderMetricRow(iconClass: string, label: string, counterId: string, value: number) {
    return html`
      <div class="status-row" data-tooltip=${`${label} ${value}`} data-tooltip-touch="tap">
        <span class="status-icon ${iconClass}" aria-hidden="true"></span>
        <span class="visually-hidden">${label} </span>
        <span id=${counterId} class="status-value">${value}</span>
      </div>
    `;
  }

  private renderActions(showEye: boolean) {
    const eyeBtn = showEye ? this.renderEyeButton() : nothing;
    const scoreboardLabel = _("Scoreboard");
    return html`<div class="status-actions">
      ${eyeBtn}
      <button
        type="button"
        id="showScores"
        class="status-action-btn score-btn"
        data-tooltip=${scoreboardLabel}
        data-tooltip-touch="longpress"
        aria-label=${scoreboardLabel}
        @click=${this.onShowScoresClick}
      >
        <span class="status-icon scoreboard" aria-hidden="true"></span>
      </button>
    </div>`;
  }

  private renderEyeButton() {
    const showTrickLabel = _("Show current trick");
    return html`<button
      type="button"
      class="status-action-btn trick-btn"
      data-tooltip=${showTrickLabel}
      data-tooltip-touch="longpress"
      aria-label=${showTrickLabel}
      @click=${this.onShowClick}
    >
      <span class="status-icon eye" aria-hidden="true"></span>
    </button>`;
  }

  private onShowClick() {
    fire(this, "show-current-trick");
  }

  private onShowScoresClick() {
    fire(this, "show-scores");
  }
}
customElements.define("tichu-status", TichuStatus);
