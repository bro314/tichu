import { html, css, LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";

const t = (s: string) => (typeof _ === "function" ? _(s) : s);

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
        }
        #mahjongpanel,
        #phoenixpanel {
          margin: 0px 15px 15px 15px;
          padding: 15px;
          background: var(--bg-color-lighter);
          border-radius: var(--border-radius);
          box-shadow: var(--elevation);
        }
        #mahjongpanel h3,
        #phoenixpanel h3 {
          margin-bottom: 15px;
          font-size: 20px;
        }
        #mahjong {
          display: grid;
          grid-template-columns: repeat(7, 70px);
          gap: 5px;
          min-height: 105px;
        }
        #phoenixChoice,
        #phoenixvalues {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          min-height: 105px;
        }
        .stockitem {
          width: 70px;
          height: 105px;
          background-image: var(--table-icons-url);
          background-repeat: no-repeat;
          border-radius: var(--border-radius);
          box-shadow: 2px 2px 5px 3px #666;
          cursor: pointer;
          position: relative;
          user-select: none;
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

  private renderMahjong() {
    const isVisible = this.stateName === "mahjongPlay" && this.isCurrentPlayerActive;
    return html`
      <div id="mahjongpanel" class="whiteblock" style="display: ${isVisible ? "block" : "none"}">
        <h3>${t("Mahjong Wish")}</h3>
        <div id="mahjong" class="mahjongvalues">
          ${MAHJONG_VALUES.map((val) => {
            const idx = val - 2;
            const col = idx % 7;
            const row = Math.floor(idx / 7);
            const isSelected = this.selectedMahjongWish === val;
            return html`
              <div
                id="mahjong_item_${val}"
                data-value="${val}"
                class=${classMap({
                  stockitem: true,
                  stockitem_selected: isSelected,
                })}
                style="background-position: -${col * 70}px -${row * 105}px"
                @click=${() => this.onMahjongClick(val)}
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
        <h3>${t("Phoenix Choice")}</h3>
        <div id="phoenixChoice" class="phoenixvalues">
          ${sortedPhoenixValues.map((val) => {
            const idx = val - 2;
            const col = idx % 7;
            const row = Math.floor(idx / 7);
            const isSelected = this.selectedPhoenixValue === val;
            return html`
              <div
                id="phoenixChoice_item_${val}"
                data-value="${val}"
                class=${classMap({
                  stockitem: true,
                  stockitem_selected: isSelected,
                })}
                style="background-position: -${col * 70}px -${row * 105}px"
                @click=${() => this.onPhoenixClick(val)}
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
