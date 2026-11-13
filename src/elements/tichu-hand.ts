import { html, css, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { Card } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";
import "./tichu-action-bar";
import "./tichu-stock";

const t = (s: string) => (typeof _ === "function" ? _(s) : s);

const THEME_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export class TichuHand extends LitElement {
  @state() private isSpectator = false;
  @state() private hand: Card[] = [];
  @state() private selectedCardIds: string[] = [];
  @state() private handSortOrder: "rank" | "color" = "rank";
  @state() private stateName = "";
  @state() private isTiki = false;
  @state() private clockwise = true;
  @state() private squareTable = false;
  @state() private theme = 0;

  static override get styles() {
    return [
      styles,
      css`
        :host {
          display: block;
        }
        #myhandwrap {
          padding-top: 10px;
          font-size: 14px;
        }
        #myhand {
          margin: 15px 250px 25px 15px;
          min-height: 150px;
        }
        #prefs {
          padding: 10px;
          border-top: 1px solid var(--bg-color-lighter);
          color: #1f2328;
        }
        #prefs a {
          color: var(--bg-color-lighter);
        }
        .reordercards {
          margin-left: 10px;
          cursor: pointer;
        }
        #themes {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          padding: 10px 0px 0px 0px;
          line-height: 16px;
        }
        #themes > * {
          margin-right: 15px;
        }
        a.themelink {
          display: flex;
          border: 1px solid rgba(255, 255, 255, 0.3);
          cursor: pointer;
        }
        a.themelink .bg {
          width: 14px;
          height: 14px;
        }
        a.themelink .bg1 {
          background-color: var(--bg-color-html);
        }
        a.themelink .bg2 {
          background-color: var(--bg-color-play-area);
        }
        a.themelink .bg3 {
          background-color: var(--bg-color-lighter);
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
      () => window.gameModel.handSortOrder$,
      (order) => (this.handSortOrder = order),
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
      () => window.gameModel.squareTable$,
      (squareTable) => (this.squareTable = squareTable),
    );
    subscribe(
      this,
      () => window.gameModel.theme$,
      (theme) => (this.theme = theme),
    );
  }

  private getSelectionMode(): 0 | 1 | 2 {
    if (this.stateName === "giveCards") return 1;
    if (this.stateName === "grandTichuBets") return 0;
    return 2;
  }

  override render() {
    const selectionMode = this.getSelectionMode();
    const isArchiveMode = Boolean((window as any).g_archive_mode);

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
            .selectionMode=${selectionMode}
            .selectedIds=${this.selectedCardIds}
            .dynamicOverlap=${true}
            @selection-change=${this.onSelectionChange}
          ></tichu-stock>
        </div>
        <div id="prefs">
          <span>${t("User Preferences:")}</span>
          <a
            href="#"
            class="reordercards"
            id="order_by_rank"
            style="display: ${this.handSortOrder === "color" ? "inline" : "none"}"
            @click=${this.onOrderByRank}
            >[${t("Reorder cards by rank")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="order_by_color"
            style="display: ${this.handSortOrder === "rank" ? "inline" : "none"}"
            @click=${this.onOrderByColor}
            >[${t("Reorder cards by color")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="list_table"
            style="display: ${this.squareTable ? "inline" : "none"}"
            title=${t("You can change this permanently in the user settings")}
            @click=${(e: Event) => this.onTableLayout(e, false)}
            >[${t("List table")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="square_table"
            style="display: ${this.squareTable ? "none" : "inline"}"
            title=${t("You can change this permanently in the user settings")}
            @click=${(e: Event) => this.onTableLayout(e, true)}
            >[${t("Square table")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="clockwise"
            style="display: ${this.clockwise ? "none" : "inline"}"
            title=${t(
              "This will affect the arrangement of the square table and the order of players when passing the cards. You can change this permanently in the user settings",
            )}
            @click=${(e: Event) => this.onClockwiseChange(e, true)}
            >[${t("Play clockwise")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="counterClockwise"
            style="display: ${this.clockwise ? "inline" : "none"}"
            title=${t(
              "This will affect the arrangement of the square table and the order of players when passing the cards. You can change this permanently in the user settings",
            )}
            @click=${(e: Event) => this.onClockwiseChange(e, false)}
            >[${t("Play counterclockwise")}]</a
          >
          <a
            href="#"
            class="reordercards"
            id="expReplay"
            style="display: ${isArchiveMode ? "inline" : "none"}"
            @click=${this.onExpReplay}
            >[${t("Experimental Replay")}]</a
          >
          <div id="themes">
            <span>${t("Color Themes:")}</span>
            ${THEME_NUMBERS.map(
              (themeNo) => html`
                <a
                  href="#"
                  class="themelink theme${themeNo}"
                  id="theme${themeNo}"
                  @click=${(e: Event) => this.onThemeClick(e, themeNo)}
                >
                  <div class="bg bg1"></div>
                  <div class="bg bg2"></div>
                  <div class="bg bg3"></div>
                </a>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  private onSelectionChange(e: CustomEvent<{ selectedIds: string[]; clickedCard: Card }>) {
    window.gameModel.setSelectedCardIds(e.detail.selectedIds);
  }

  private onOrderByRank(e: Event) {
    e.preventDefault();
    window.gameModel.setHandSortOrder("rank");
    const ui = (window as any).gameui;
    if (ui && typeof ui.onReorderByRank === "function") {
      ui.onReorderByRank(e);
    }
  }

  private onOrderByColor(e: Event) {
    e.preventDefault();
    window.gameModel.setHandSortOrder("color");
    const ui = (window as any).gameui;
    if (ui && typeof ui.onReorderByColor === "function") {
      ui.onReorderByColor(e);
    }
  }

  private onTableLayout(e: Event, squareTable: boolean) {
    e.preventDefault();
    window.gameModel.setSquareTable(squareTable);
    const ui = (window as any).gameui;
    if (ui && typeof ui.onReorderTable === "function") {
      ui.onReorderTable(squareTable);
    }
  }

  private onClockwiseChange(e: Event, clockwise: boolean) {
    e.preventDefault();
    window.gameModel.setClockwise(clockwise);
    const ui = (window as any).gameui;
    if (ui && typeof ui.changeOrder === "function") {
      ui.changeOrder(clockwise);
    }
  }

  private onExpReplay(e: Event) {
    e.preventDefault();
    window.gameModel.setExperimentalReplayOpen(true);
    const ui = (window as any).gameui;
    if (ui && typeof ui.toggleExperimentalReplay === "function") {
      ui.toggleExperimentalReplay(true);
    }
  }

  private onThemeClick(e: Event, themeNo: number) {
    e.preventDefault();
    window.gameModel.setTheme(themeNo);
    const ui = (window as any).gameui;
    if (ui) {
      if (typeof ui.onThemeChange === "function") {
        ui.onThemeChange(themeNo);
      } else if (typeof ui.setTheme === "function") {
        ui.setTheme(themeNo);
      }
    }
  }
}

customElements.define("tichu-hand", TichuHand);
