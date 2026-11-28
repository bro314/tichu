import { html, css, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { rankToLocalizedName } from "./combo-validator";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";

const MAHJONG_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export class TichuValueChoice extends LitElement {
  @property({ type: String }) mode: "mahjong" | "phoenix" = "mahjong";

  @state() private stateName = "";
  @state() private isCurrentPlayerActive = false;
  @state() private selectedMahjongWish: number | null = null;
  @state() private phoenixAllowedValues: number[] = [];
  @state() private selectedPhoenixValue: number | null = null;

  static override get styles() {
    return [
      styles,
      css`
        :host {
          display: block;
          container-type: inline-size;
        }
        #mahjongpanel,
        #phoenixpanel {
          box-sizing: border-box;
          max-width: 100%;
          --choice-w: clamp(38px, calc((100vw - 64px) / 7), 70px);
          --choice-h: calc(var(--choice-w) * 1.5);
          --choice-gap: 5px;
          margin: 0px 15px 15px 15px;
          padding: 15px;
          background: var(--tichu-surface-bg, var(--bg-color-lighter));
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--tichu-surface-border, rgba(255, 255, 255, 0.55));
          border-radius: var(--border-radius, 12px);
          box-shadow: var(--tichu-surface-shadow, var(--elevation));
        }
        #mahjongpanel h3,
        #phoenixpanel h3 {
          margin-bottom: 15px;
          font-size: 20px;
        }
        #mahjong {
          display: grid;
          grid-template-columns: repeat(7, var(--choice-w));
          gap: var(--choice-gap);
          min-height: var(--choice-h);
        }
        #phoenixChoice,
        #phoenixvalues {
          display: flex;
          flex-wrap: wrap;
          gap: var(--choice-gap);
          min-height: var(--choice-h);
        }
        .stockitem {
          width: var(--choice-w);
          height: var(--choice-h);
          background-color: #fff;
          background-image: var(--table-icons-url);
          background-repeat: no-repeat;
          background-origin: border-box;
          background-size: calc(var(--choice-w) * 8) calc(var(--choice-h) * 2);
          background-position: calc(var(--col, 0) * -1 * var(--choice-w))
            calc(var(--row, 0) * -1 * var(--choice-h));
          border-radius: var(--tichu-card-radius, 8px);
          box-shadow: var(
            --tichu-card-shadow,
            0 0 0 1px rgba(15, 23, 42, 0.12),
            0 2px 4px rgba(15, 23, 42, 0.16),
            0 6px 14px rgba(15, 23, 42, 0.18)
          );
          cursor: pointer;
          position: relative;
          user-select: none;
        }
        @supports (width: 1cqi) {
          #mahjongpanel,
          #phoenixpanel {
            --choice-w: 70px;
          }
          @container (max-width: 599px) {
            #mahjongpanel,
            #phoenixpanel {
              --choice-gap: 4px;
              --choice-w: clamp(38px, calc((100cqi - 58px) / 7), 70px);
              margin: 0px 6px 10px 6px;
              padding: 10px;
            }
            #mahjongpanel h3,
            #phoenixpanel h3 {
              margin-bottom: 10px;
              font-size: 16px;
            }
            #mahjong {
              justify-content: center;
            }
            .stockitem {
              border-radius: 6px;
            }
          }
        }
        #mahjong_item_15 {
          background-color: #e5e7eb;
        }
        .stockitem.stockitem_selected {
          z-index: 1;
        }
        .stockitem:focus-visible {
          outline: 3px solid #0b72b5;
          outline-offset: 2px;
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
      () => window.gameModel.isCurrentPlayerActive$,
      (active) => (this.isCurrentPlayerActive = active),
    );
    subscribe(
      this,
      () => window.gameModel.selectedMahjongWish$,
      (wish) => (this.selectedMahjongWish = wish),
    );
    subscribe(
      this,
      () => window.gameModel.phoenixAllowedValues$,
      (vals) => (this.phoenixAllowedValues = vals),
    );
    subscribe(
      this,
      () => window.gameModel.selectedPhoenixValue$,
      (val) => (this.selectedPhoenixValue = val),
    );
  }

  override render() {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    this.style.setProperty("--table-icons-url", `url(${themeUrl}img/tichu-icons-table.png)`);

    if (this.mode === "phoenix") {
      return this.renderPhoenix();
    }
    return this.renderMahjong();
  }

  private getTileLabel(val: number): string {
    return val === 15 ? _("No wish") : rankToLocalizedName(val, false);
  }

  private onTileKeyDown(e: KeyboardEvent, onActivate: () => void) {
    if (e.key === "Enter") {
      e.preventDefault();
      onActivate();
    } else if (e.key === " ") {
      e.preventDefault();
    }
  }

  private onTileKeyUp(e: KeyboardEvent, onActivate: () => void) {
    if (e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  }

  private renderMahjong() {
    const isVisible = this.stateName === "mahjongPlay" && this.isCurrentPlayerActive;
    return html`
      <div id="mahjongpanel" class="whiteblock" style="display: ${isVisible ? "block" : "none"}">
        <h3>${_("Mahjong Wish")}</h3>
        <div id="mahjong" class="mahjongvalues">
          ${MAHJONG_VALUES.map((val) => {
            const idx = val - 2;
            const col = idx % 7;
            const row = Math.floor(idx / 7);
            const isSelected = this.selectedMahjongWish === val;
            const label = this.getTileLabel(val);
            return html`
              <div
                id="mahjong_item_${val}"
                data-value="${val}"
                role="button"
                tabindex="0"
                aria-pressed=${isSelected ? "true" : "false"}
                aria-label=${label}
                data-tooltip=${val === 15 ? label : nothing}
                data-tooltip-touch=${val === 15 ? "longpress" : nothing}
                class=${classMap({
                  stockitem: true,
                  stockitem_selected: isSelected,
                })}
                style="--col: ${col}; --row: ${row};"
                @click=${() => this.onMahjongClick(val)}
                @keydown=${(e: KeyboardEvent) =>
                  this.onTileKeyDown(e, () => this.onMahjongClick(val))}
                @keyup=${(e: KeyboardEvent) => this.onTileKeyUp(e, () => this.onMahjongClick(val))}
              ></div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private renderPhoenix() {
    const isVisible = this.stateName === "phoenixPlay" && this.isCurrentPlayerActive;
    const sortedPhoenixValues = [...this.phoenixAllowedValues].sort((a, b) => a - b);
    return html`
      <div id="phoenixpanel" class="whiteblock" style="display: ${isVisible ? "block" : "none"}">
        <h3>${_("Phoenix Choice")}</h3>
        <div id="phoenixChoice" class="phoenixvalues">
          ${sortedPhoenixValues.map((val) => {
            const idx = val - 2;
            const col = idx % 7;
            const row = Math.floor(idx / 7);
            const isSelected = this.selectedPhoenixValue === val;
            const label = this.getTileLabel(val);
            return html`
              <div
                id="phoenixChoice_item_${val}"
                data-value="${val}"
                role="button"
                tabindex="0"
                aria-pressed=${isSelected ? "true" : "false"}
                aria-label=${label}
                class=${classMap({
                  stockitem: true,
                  stockitem_selected: isSelected,
                })}
                style="--col: ${col}; --row: ${row};"
                @click=${() => this.onPhoenixClick(val)}
                @keydown=${(e: KeyboardEvent) =>
                  this.onTileKeyDown(e, () => this.onPhoenixClick(val))}
                @keyup=${(e: KeyboardEvent) => this.onTileKeyUp(e, () => this.onPhoenixClick(val))}
              ></div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private onMahjongClick(val: number) {
    const next = this.selectedMahjongWish === val ? null : val;
    window.gameModel.setSelectedMahjongWish(next);
  }

  private onPhoenixClick(val: number) {
    const next = this.selectedPhoenixValue === val ? null : val;
    window.gameModel.setSelectedPhoenixValue(next);
  }
}

customElements.define("tichu-value-choice", TichuValueChoice);
