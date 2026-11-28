import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import type { AutoSortOrder, HandSortOrder } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";

const THEME_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function getThemeLabel(themeNo: number): string {
  switch (themeNo) {
    case 0:
      return _("wood dark");
    case 1:
      return _("midnight slate");
    case 2:
      return _("blue gray");
    case 3:
      return _("pink");
    case 4:
      return _("warm linen");
    case 5:
      return _("red beige");
    case 6:
      return _("gray");
    case 7:
      return _("blue brown");
    case 8:
      return _("blue beige");
    case 9:
      return _("brown");
    case 10:
      return _("jade felt");
    default:
      return "";
  }
}

export class TichuSettingsModal extends LitElement {
  @state() private settingsModalOpen = false;
  @state() private handSortOrder: HandSortOrder = "rank";
  @state() private squareTable = true;
  @state() private clockwise = true;
  @state() private isTiki = false;
  @state() private animationsEnabled = true;
  @state() private confirmPassWithSelection = true;
  @state() private theme = 0;

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
          border-radius: 8px;
          padding: 0;
          margin: auto;
          width: min(560px, calc(100vw - 32px));
          max-width: calc(100vw - 32px);
          max-height: min(92vh, 760px);
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
        #tichu-settings-title {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--tichu-dialog-text, #1f2328);
          line-height: 1.25;
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
          padding: 12px 18px;
          overflow-y: auto;
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .settings-group {
          flex-shrink: 0;
          background: var(--tichu-dialog-surface, #ffffff);
          border: 1px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.14));
          border-radius: 8px;
          overflow: hidden;
        }
        .setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 9px 12px;
        }
        .setting-row + .setting-row {
          border-top: 1px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.14));
        }
        .setting-row.switch-row {
          cursor: pointer;
          user-select: none;
          transition: background-color 140ms ease;
        }
        .setting-row.switch-row:hover {
          background: var(--tichu-dialog-surface-hover, #f2ece2);
        }
        .setting-info {
          min-width: 0;
          flex: 1 1 auto;
        }
        .setting-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--tichu-dialog-text, #1f2328);
          line-height: 1.35;
        }
        .row-hint {
          margin: 3px 0 0;
          font-size: 0.75rem;
          line-height: 1.35;
          color: var(--tichu-dialog-text-muted, #57606a);
        }

        .sr-only-input {
          position: absolute;
          opacity: 0;
          width: 1px;
          height: 1px;
          margin: 0;
          pointer-events: none;
        }

        .segmented {
          display: inline-flex;
          flex-shrink: 0;
          align-items: center;
          padding: 3px;
          border-radius: 8px;
          background: var(--tichu-dialog-segment-bg, #ebe4d8);
          border: 1px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.14));
          gap: 2px;
        }
        .segment {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 11px;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 600;
          line-height: 1.25;
          color: var(--tichu-dialog-text-muted, #57606a);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
          transition:
            background-color 140ms ease,
            color 140ms ease,
            box-shadow 140ms ease;
        }
        .segment:hover {
          color: var(--tichu-dialog-text, #1f2328);
        }
        .segment.active {
          background: var(--tichu-dialog-accent, #0b72b5);
          color: var(--tichu-dialog-accent-fg, #ffffff);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.16);
        }
        .segment.capitalize {
          text-transform: capitalize;
        }
        .segment:has(.sr-only-input:focus-visible) {
          outline: 2px solid var(--tichu-dialog-accent, #0b72b5);
          outline-offset: 2px;
        }

        .switch {
          position: relative;
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
          cursor: pointer;
          padding: 2px;
        }
        .switch-track {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          border-radius: 999px;
          background: var(--tichu-dialog-switch-off, #c2bab0);
          border: 1px solid var(--tichu-dialog-switch-border, rgba(31, 35, 40, 0.28));
          transition:
            background-color 160ms ease,
            border-color 160ms ease;
        }
        .switch-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          transition: transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .switch.checked .switch-track {
          background: var(--tichu-dialog-accent, #0b72b5);
          border-color: var(--tichu-dialog-accent, #0b72b5);
        }
        .switch.checked .switch-thumb {
          transform: translateX(20px);
        }
        .switch:has(.sr-only-input:focus-visible) .switch-track {
          outline: 2px solid var(--tichu-dialog-accent, #0b72b5);
          outline-offset: 2px;
        }

        @media (max-width: 500px) {
          .setting-row:not(.switch-row) {
            flex-wrap: wrap;
          }
        }

        .theme-fieldset {
          flex-shrink: 0;
          margin: 0;
          padding: 0;
          border: none;
          min-width: 0;
        }
        .section-heading {
          padding: 0 2px;
          margin-bottom: 10px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--tichu-dialog-text-muted, #57606a);
        }
        .theme-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 7px;
        }
        @media (max-width: 480px) {
          .theme-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .theme-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 5px;
          border-radius: 8px;
          border: 1.5px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.14));
          background: var(--tichu-dialog-surface, #ffffff);
          cursor: pointer;
          user-select: none;
          transition:
            border-color 100ms ease,
            box-shadow 100ms ease,
            background-color 100ms ease;
        }
        .theme-card:hover {
          background: var(--tichu-dialog-surface-hover, #f2ece2);
          border-color: var(--tichu-dialog-text-muted, #57606a);
        }
        .theme-card.selected {
          border-color: var(--tichu-dialog-accent, #0b72b5);
          box-shadow: 0 0 0 1px var(--tichu-dialog-accent, #0b72b5);
        }
        .theme-card:has(.sr-only-input:focus-visible) {
          outline: 2px solid var(--tichu-dialog-accent, #0b72b5);
          outline-offset: 2px;
        }
        .theme-swatch {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          height: 22px;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid rgba(0, 0, 0, 0.12);
        }
        .theme0 .theme-swatch {
          background: linear-gradient(135deg, #cbb28e 0%, #bda077 100%);
        }
        .theme-swatch .bg {
          width: 100%;
          height: 100%;
        }
        .theme-swatch .bg1 {
          background-color: var(--bg-color-html);
        }
        .theme-swatch .bg2 {
          background-color: var(--bg-color-play-area);
        }
        .theme-swatch .bg3 {
          background-color: var(--bg-color-lighter);
        }
        .theme-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
          padding: 0 2px;
          min-height: 18px;
        }
        .theme-name {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--tichu-dialog-text, #1f2328);
          text-transform: capitalize;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .theme-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--tichu-dialog-accent, #0b72b5);
          color: var(--tichu-dialog-accent-fg, #ffffff);
          flex-shrink: 0;
        }

        .archive-section {
          flex-shrink: 0;
          display: flex;
          justify-content: flex-start;
        }
        .archive-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.14));
          background: var(--tichu-dialog-surface, #ffffff);
          color: var(--tichu-dialog-text, #1f2328);
          font-family: inherit;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 140ms ease;
        }
        .archive-btn:hover {
          background: var(--tichu-dialog-surface-hover, #f2ece2);
        }
        .archive-btn:focus-visible {
          outline: 2px solid var(--tichu-dialog-accent, #0b72b5);
          outline-offset: 2px;
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
          .setting-row.switch-row,
          .segment,
          .switch-track,
          .switch-thumb,
          .theme-card,
          .archive-btn,
          .done-btn {
            transition: none;
            translate: none;
          }
        }

        @media (forced-colors: active) {
          dialog {
            border: 2px solid CanvasText;
          }
          .settings-group,
          .segmented,
          .theme-card,
          .archive-btn {
            border-color: ButtonText;
          }
          .segment.active {
            background: Highlight;
            color: HighlightText;
            forced-color-adjust: none;
          }
          .switch-track {
            border-color: ButtonText;
          }
          .switch.checked .switch-track {
            background: Highlight;
            border-color: Highlight;
            forced-color-adjust: none;
          }
          .switch-thumb {
            background: Canvas;
            border: 1px solid ButtonText;
          }
          .theme-card.selected {
            border-color: Highlight;
            outline: 1px solid Highlight;
          }
          .theme-check {
            background: Highlight;
            color: HighlightText;
            forced-color-adjust: none;
          }
          .done-btn {
            background: Highlight;
            color: HighlightText;
            border: 1px solid ButtonText;
          }
          button:focus-visible,
          .segment:has(.sr-only-input:focus-visible),
          .switch:has(.sr-only-input:focus-visible) .switch-track,
          .theme-card:has(.sr-only-input:focus-visible) {
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
      () => window.gameModel.settingsModalOpen$,
      (open) => (this.settingsModalOpen = open),
    );
    subscribe(
      this,
      () => window.gameModel.handSortOrder$,
      (order) => (this.handSortOrder = order),
    );
    subscribe(
      this,
      () => window.gameModel.squareTable$,
      (squareTable) => (this.squareTable = squareTable),
    );
    subscribe(
      this,
      () => window.gameModel.clockwise$,
      (clockwise) => (this.clockwise = clockwise),
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
      () => window.gameModel.confirmPassWithSelection$,
      (confirmPassWithSelection) => (this.confirmPassWithSelection = confirmPassWithSelection),
    );
    subscribe(
      this,
      () => window.gameModel.theme$,
      (theme) => (this.theme = theme),
    );
  }

  protected override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    const dialog = this.shadowRoot?.getElementById(
      "tichu-settings-dialog",
    ) as HTMLDialogElement | null;
    if (!dialog) return;

    if (this.settingsModalOpen) {
      if (!dialog.open && typeof dialog.showModal === "function") {
        dialog.showModal();
      }
    } else if (dialog.open && typeof dialog.close === "function") {
      dialog.close();
    }
  }

  override render() {
    const isArchiveMode = Boolean((window as any).g_archive_mode);

    return html`
      <dialog
        id="tichu-settings-dialog"
        class=${classMap({ "no-animations": !this.animationsEnabled })}
        closedby="any"
        aria-labelledby="tichu-settings-title"
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
                <circle cx="12" cy="12" r="3"></circle>
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                ></path>
              </svg>
              <h2 id="tichu-settings-title">${_("Settings")}</h2>
            </div>
            <button
              type="button"
              id="tichu-settings-close"
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
            <div class="settings-group">
              <div class="setting-row">
                <div class="setting-info">
                  <span id="pref-sort-label" class="setting-label">${_("Card order")}</span>
                  ${
                    this.handSortOrder === "preserve"
                      ? html`<p class="row-hint">${_("Custom order active for this round")}</p>`
                      : nothing
                  }
                </div>
                <div class="segmented" role="radiogroup" aria-labelledby="pref-sort-label">
                  <label
                    class=${classMap({ segment: true, active: this.handSortOrder === "rank" })}
                  >
                    <input
                      type="radio"
                      name="tichu-hand-sort"
                      class="sr-only-input"
                      .checked=${this.handSortOrder === "rank"}
                      @change=${() => this.onHandSortChange("rank")}
                    />
                    <span>${_("Rank ↑")}</span>
                  </label>
                  <label
                    class=${classMap({
                      segment: true,
                      active: this.handSortOrder === "rank-desc",
                    })}
                  >
                    <input
                      type="radio"
                      name="tichu-hand-sort"
                      class="sr-only-input"
                      .checked=${this.handSortOrder === "rank-desc"}
                      @change=${() => this.onHandSortChange("rank-desc")}
                    />
                    <span>${_("Rank ↓")}</span>
                  </label>
                  <label
                    class=${classMap({ segment: true, active: this.handSortOrder === "color" })}
                  >
                    <input
                      type="radio"
                      name="tichu-hand-sort"
                      class="sr-only-input"
                      .checked=${this.handSortOrder === "color"}
                      @change=${() => this.onHandSortChange("color")}
                    />
                    <span>${_("Suit ↑")}</span>
                  </label>
                  <label
                    class=${classMap({
                      segment: true,
                      active: this.handSortOrder === "color-desc",
                    })}
                  >
                    <input
                      type="radio"
                      name="tichu-hand-sort"
                      class="sr-only-input"
                      .checked=${this.handSortOrder === "color-desc"}
                      @change=${() => this.onHandSortChange("color-desc")}
                    />
                    <span>${_("Suit ↓")}</span>
                  </label>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span id="pref-layout-label" class="setting-label">${_("Table Layout")}</span>
                </div>
                <div class="segmented" role="radiogroup" aria-labelledby="pref-layout-label">
                  <label class=${classMap({ segment: true, active: !this.squareTable })}>
                    <input
                      type="radio"
                      name="tichu-table-layout"
                      class="sr-only-input"
                      .checked=${!this.squareTable}
                      @change=${() => this.onTableLayoutChange(false)}
                    />
                    <span>${_("List")}</span>
                  </label>
                  <label class=${classMap({ segment: true, active: this.squareTable })}>
                    <input
                      type="radio"
                      name="tichu-table-layout"
                      class="sr-only-input"
                      .checked=${this.squareTable}
                      @change=${() => this.onTableLayoutChange(true)}
                    />
                    <span>${_("Square")}</span>
                  </label>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span id="pref-order-label" class="setting-label">${_("Order of play")}</span>
                  <p id="pref-order-hint" class="row-hint">
                    ${_(
                      "This will affect the arrangement of the square table and the order of players when passing the cards.",
                    )}
                  </p>
                </div>
                <div
                  class="segmented"
                  role="radiogroup"
                  aria-labelledby="pref-order-label"
                  aria-describedby="pref-order-hint"
                >
                  <label
                    class=${classMap({
                      segment: true,
                      capitalize: true,
                      active: !this.clockwise,
                    })}
                  >
                    <input
                      type="radio"
                      name="tichu-play-order"
                      class="sr-only-input"
                      .checked=${!this.clockwise}
                      @change=${() => this.onClockwiseChange(false)}
                    />
                    <span>${_("counterclockwise")}</span>
                  </label>
                  <label
                    class=${classMap({
                      segment: true,
                      capitalize: true,
                      active: this.clockwise,
                    })}
                  >
                    <input
                      type="radio"
                      name="tichu-play-order"
                      class="sr-only-input"
                      .checked=${this.clockwise}
                      @change=${() => this.onClockwiseChange(true)}
                    />
                    <span>${_("clockwise")}</span>
                  </label>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span id="pref-art-label" class="setting-label">${_("Tiki Edition Art")}</span>
                </div>
                <div class="segmented" role="radiogroup" aria-labelledby="pref-art-label">
                  <label class=${classMap({ segment: true, active: !this.isTiki })}>
                    <input
                      type="radio"
                      name="tichu-card-art"
                      class="sr-only-input"
                      .checked=${!this.isTiki}
                      @change=${() => this.onTikiChange(false)}
                    />
                    <span>${_("Standard cards")}</span>
                  </label>
                  <label class=${classMap({ segment: true, active: this.isTiki })}>
                    <input
                      type="radio"
                      name="tichu-card-art"
                      class="sr-only-input"
                      .checked=${this.isTiki}
                      @change=${() => this.onTikiChange(true)}
                    />
                    <span>${_("Tiki cards")}</span>
                  </label>
                </div>
              </div>

              <label class="setting-row switch-row">
                <span class="setting-info">
                  <span class="setting-label">${_("Animations")}</span>
                </span>
                <span class=${classMap({ switch: true, checked: this.animationsEnabled })}>
                  <input
                    id="pref-animations-toggle"
                    type="checkbox"
                    role="switch"
                    class="sr-only-input"
                    .checked=${this.animationsEnabled}
                    @change=${(e: Event) =>
                      this.onAnimationsChange((e.target as HTMLInputElement).checked)}
                  />
                  <span class="switch-track" aria-hidden="true">
                    <span class="switch-thumb"></span>
                  </span>
                </span>
              </label>

              <label class="setting-row switch-row">
                <span class="setting-info">
                  <span class="setting-label">${_("Prevent passing when cards are selected")}</span>
                </span>
                <span class=${classMap({ switch: true, checked: this.confirmPassWithSelection })}>
                  <input
                    id="pref-pass-guard-toggle"
                    type="checkbox"
                    role="switch"
                    class="sr-only-input"
                    .checked=${this.confirmPassWithSelection}
                    @change=${(e: Event) =>
                      this.onConfirmPassChange((e.target as HTMLInputElement).checked)}
                  />
                  <span class="switch-track" aria-hidden="true">
                    <span class="switch-thumb"></span>
                  </span>
                </span>
              </label>
            </div>

            <fieldset class="theme-fieldset">
              <legend class="section-heading">${_("Color Theme")}</legend>
              <div class="theme-grid">
                ${THEME_NUMBERS.map((themeNo) => {
                  const isSelected = this.theme === themeNo;
                  const label = getThemeLabel(themeNo);
                  return html`
                    <label
                      class=${classMap({
                        "theme-card": true,
                        [`theme${themeNo}`]: true,
                        selected: isSelected,
                      })}
                    >
                      <input
                        type="radio"
                        name="tichu-color-theme"
                        class="sr-only-input"
                        .checked=${isSelected}
                        @change=${() => this.onThemeSelect(themeNo)}
                      />
                      <span class="theme-swatch" aria-hidden="true">
                        <span class="bg bg1"></span>
                        <span class="bg bg2"></span>
                        <span class="bg bg3"></span>
                      </span>
                      <span class="theme-meta">
                        <span class="theme-name">${label}</span>
                        ${
                          isSelected
                            ? html`<span class="theme-check" aria-hidden="true">
                                <svg
                                  viewBox="0 0 16 16"
                                  width="11"
                                  height="11"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2.4"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                >
                                  <polyline points="3.5 8.5 6.5 11.5 12.5 4.5"></polyline>
                                </svg>
                              </span>`
                            : nothing
                        }
                      </span>
                    </label>
                  `;
                })}
              </div>
            </fieldset>

            ${
              isArchiveMode
                ? html`
                    <div class="archive-section">
                      <button
                        type="button"
                        id="expReplay"
                        class="archive-btn"
                        @click=${this.onExpReplay}
                      >
                        ${_("Experimental Replay")}
                      </button>
                    </div>
                  `
                : nothing
            }
          </div>

          <div class="dialog-footer">
            <button type="button" class="done-btn" @click=${this.onClose}>${_("Close")}</button>
          </div>
        </div>
      </dialog>
    `;
  }

  onHandSortChange(order: AutoSortOrder) {
    window.gameModel.setHandSortOrder(order);
    const ui = (window as any).gameui;
    if (order === "rank" && ui && typeof ui.onReorderByRank === "function") {
      ui.onReorderByRank();
    } else if (order === "color" && ui && typeof ui.onReorderByColor === "function") {
      ui.onReorderByColor();
    } else if (ui && typeof ui.onOrderChange === "function") {
      ui.onOrderChange(order);
    }
  }

  onTableLayoutChange(squareTable: boolean) {
    window.gameModel.setSquareTable(squareTable);
    const ui = (window as any).gameui;
    if (ui && typeof ui.onReorderTable === "function") {
      ui.onReorderTable(squareTable);
    }
  }

  onClockwiseChange(clockwise: boolean) {
    window.gameModel.setClockwise(clockwise);
    const ui = (window as any).gameui;
    if (ui && typeof ui.changeOrder === "function") {
      ui.changeOrder(clockwise);
    }
  }

  onTikiChange(isTiki: boolean) {
    window.gameModel.setTiki(isTiki);
    const ui = (window as any).gameui;
    if (ui && typeof ui.changeTiki === "function") {
      ui.changeTiki(isTiki);
    }
  }

  onAnimationsChange(enabled: boolean) {
    window.gameModel.setAnimationsEnabled(enabled);
    const ui = (window as any).gameui;
    if (ui && typeof ui.changeAnimations === "function") {
      ui.changeAnimations(enabled);
    }
  }

  onConfirmPassChange(enabled: boolean) {
    window.gameModel.setConfirmPassWithSelection(enabled);
    const ui = (window as any).gameui;
    if (ui && typeof ui.changeConfirmPassWithSelection === "function") {
      ui.changeConfirmPassWithSelection(enabled);
    }
  }

  onThemeSelect(themeNo: number) {
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

  onExpReplay(e?: Event) {
    e?.preventDefault?.();
    window.gameModel.setSettingsModalOpen(false);
    window.gameModel.setExperimentalReplayOpen(true);
    const ui = (window as any).gameui;
    if (ui && typeof ui.toggleExperimentalReplay === "function") {
      ui.toggleExperimentalReplay(true);
    }
  }

  onClose(e?: Event) {
    e?.preventDefault?.();
    window.gameModel.setSettingsModalOpen(false);
  }

  onDialogClose() {
    if (window.gameModel?.getState().settingsModalOpen) {
      window.gameModel.setSettingsModalOpen(false);
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

customElements.define("tichu-settings-modal", TichuSettingsModal);
