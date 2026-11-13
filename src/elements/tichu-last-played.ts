import { html, css, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Card, LastComboState, LivePlayer } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";
import "./tichu-status";
import "./tichu-stock";

const t = (s: string) => (typeof _ === "function" ? _(s) : s);

const POSITIONS = ["bottom", "right", "top", "left"] as const;

export class TichuLastPlayed extends LitElement {
  @state() private playerOrderBottomToLeft: string[] = [];
  @state() private players: Record<string, LivePlayer> = {};
  @state() private lastCombos: Record<string, LastComboState> = {};
  @state() private lastComboPlayerId = "";
  @state() private activePlayerId = "";
  @state() private bombActivePlayerId: string | null = null;
  @state() private stateName = "";
  @state() private mahjongWish = 0;
  @state() private isTiki = false;
  @state() private clockwise = true;
  @state() private squareTable = false;
  @state() private round = 0;
  @state() private trick = 0;
  @state() private currentTrickValue = 0;
  @state() private currentTrick: Card[] = [];

  static override get styles() {
    return [
      styles,
      css`
        :host {
          display: block;
        }
        #card-last-played-area {
          display: grid;
          padding: 0px 15px 15px 15px;
          grid-gap: 10px;
          grid-template-columns: 2fr 1fr;
          grid-template-rows: 1fr 1fr 1fr 1fr;
        }
        #card-last-played-area .top {
          grid-column: 1 / span 1;
          grid-row: 3 / span 1;
        }
        #card-last-played-area .left {
          grid-column: 1 / span 1;
          grid-row: 4 / span 1;
        }
        #card-last-played-area .right {
          grid-column: 1 / span 1;
          grid-row: 2 / span 1;
        }
        #card-last-played-area .bottom {
          grid-column: 1 / span 1;
          grid-row: 1 / span 1;
        }
        #card-last-played-area #mahjongIndicator {
          grid-column: 2 / span 1;
          grid-row: 2 / span 1;
          place-self: center;
        }
        #card-last-played-area tichu-status {
          grid-column: 2 / span 1;
          grid-row: 1 / span 1;
          place-self: start end;
          text-align: right;
          font-size: 20px;
        }

        #card-last-played-area.squareTable {
          grid-template-columns:
            minmax(200px, 2.5fr)
            minmax(200px, 2fr)
            minmax(20px, 1fr)
            minmax(200px, 2fr)
            minmax(200px, 2.5fr);
          grid-template-rows: 1fr 1fr 1fr;
        }
        #card-last-played-area.squareTable .top {
          grid-column: 2 / span 3;
          grid-row: 1 / span 1;
        }
        #card-last-played-area.squareTable .left {
          grid-column: 1 / span 2;
          grid-row: 2 / span 1;
        }
        #card-last-played-area.clockwise.squareTable .left {
          grid-column: 4 / span 2;
        }
        #card-last-played-area.squareTable .right {
          grid-column: 4 / span 2;
          grid-row: 2 / span 1;
        }
        #card-last-played-area.clockwise.squareTable .right {
          grid-column: 1 / span 2;
        }
        #card-last-played-area.squareTable .bottom {
          grid-column: 2 / span 3;
          grid-row: 3 / span 1;
        }
        #card-last-played-area.squareTable #mahjongIndicator {
          grid-column: 1 / span 1;
          grid-row: 1 / span 1;
        }
        #card-last-played-area.squareTable tichu-status {
          grid-column: 5 / span 1;
          grid-row: 1 / span 1;
        }

        .last-played-container {
          position: relative;
          display: flex;
          line-height: 24px;
          font-size: 20px;
          font-weight: bold;
          border: 4px solid transparent;
          padding: 6px;
          background: var(--bg-color-lighter);
          border-radius: var(--border-radius);
          box-shadow: var(--elevation);
        }
        .last-played-container.active,
        .last-played-container.bomb {
          border: 4px solid var(--bg-color-active);
        }
        .last-played-container.disabled:not(.lastComboPlayer) .disabler {
          display: block;
        }

        .last-played-player {
          width: 140px;
          padding-right: 10px;
          box-sizing: content-box;
          flex-shrink: 0;
        }
        .playertablename {
          font-weight: bold;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .last-played-player .last-played-icons {
          top: 2px;
        }
        .last-played-player .last-played-icons .count {
          display: inline-block;
          width: 40px;
        }
        .last-played-combo {
          width: 300px;
          min-height: 117.5px;
          flex-grow: 1;
        }

        #mahjongIndicator {
          display: none;
          width: 75px;
          height: 112.5px;
          background-image: var(--mahjong-bg-url);
          background-size: 75px 112.5px;
          border-radius: var(--border-radius);
        }
        #mahjongIndicator.visible {
          display: block;
        }
        .tiki #mahjongIndicator {
          background-image: var(--tiki-mahjong-bg-url);
        }
        .mahjong {
          width: 75px;
          height: 112.5px;
          background-image: var(--table-icons-url);
          background-size: 600px 225px;
          background-color: rgba(255, 255, 255, 0.5);
          border-radius: var(--border-radius);
        }
      `,
    ];
  }

  constructor() {
    super();
    subscribe(
      this,
      () => window.gameModel.playerOrderBottomToLeft$,
      (order) => (this.playerOrderBottomToLeft = order),
    );
    subscribe(
      this,
      () => window.gameModel.players$,
      (players) => (this.players = players),
    );
    subscribe(
      this,
      () => window.gameModel.lastCombos$,
      (combos) => (this.lastCombos = combos),
    );
    subscribe(
      this,
      () => window.gameModel.lastComboPlayerId$,
      (id) => (this.lastComboPlayerId = id),
    );
    subscribe(
      this,
      () => window.gameModel.activePlayerId$,
      (id) => (this.activePlayerId = id),
    );
    subscribe(
      this,
      () => window.gameModel.bombActivePlayerId$,
      (id) => (this.bombActivePlayerId = id),
    );
    subscribe(
      this,
      () => window.gameModel.stateName$,
      (name) => (this.stateName = name),
    );
    subscribe(
      this,
      () => window.gameModel.mahjongWish$,
      (wish) => (this.mahjongWish = wish),
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
      () => window.gameModel.round$,
      (round) => (this.round = round),
    );
    subscribe(
      this,
      () => window.gameModel.trick$,
      (trick) => (this.trick = trick),
    );
    subscribe(
      this,
      () => window.gameModel.currentTrickValue$,
      (val) => (this.currentTrickValue = val),
    );
    subscribe(
      this,
      () => window.gameModel.currentTrick$,
      (cards) => (this.currentTrick = cards),
    );
  }

  override render() {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    this.style.setProperty("--icon-url", `url(${themeUrl}img/tichu-icons.png)`);
    this.style.setProperty("--table-icons-url", `url(${themeUrl}img/tichu-icons-table.png)`);
    this.style.setProperty("--mahjong-bg-url", `url(${themeUrl}img/tichu-mahjong.png)`);
    this.style.setProperty("--tiki-mahjong-bg-url", `url(${themeUrl}img/tiki-tichu-mahjong.png)`);

    const isPassState =
      this.stateName === "giveCards" ||
      this.stateName === "showPassedCards" ||
      this.stateName === "acceptPassedCards";

    const wishVisible = this.mahjongWish >= 2 && this.mahjongWish <= 14;
    const wishIdx = wishVisible ? this.mahjongWish - 2 : 0;
    const wishCol = wishIdx % 7;
    const wishRow = Math.floor(wishIdx / 7);

    return html`
      <div
        id="card-last-played-area"
        class=${classMap({
          squareTable: this.squareTable,
          clockwise: this.clockwise,
          tiki: this.isTiki,
        })}
        style="display: ${isPassState ? "none" : "grid"}"
      >
        ${POSITIONS.map((pos, idx) => this.renderPlayerArea(pos, this.playerOrderBottomToLeft[idx]))}

        <div
          id="mahjongIndicator"
          class=${classMap({ visible: wishVisible })}
          style="display: ${wishVisible ? "block" : "none"};"
        >
          ${
            wishVisible
              ? html`<div
                  class="mahjong"
                  id="mahjong_${this.mahjongWish}"
                  style="background-position: -${wishCol * 75}px -${wishRow * 112.5}px"
                ></div>`
              : ""
          }
        </div>

        <tichu-status
          roundCount=${this.round}
          trickCount=${this.trick}
          trickPoints=${this.currentTrickValue}
          trickSize=${this.currentTrick.length}
          .roundCount=${this.round}
          .trickCount=${this.trick}
          .trickPoints=${this.currentTrickValue}
          .trickSize=${this.currentTrick.length}
          @show-current-trick=${this.onShowCurrentTrick}
        ></tichu-status>
      </div>
    `;
  }

  private renderPlayerArea(pos: string, playerId: string | undefined) {
    if (!playerId) return "";
    const id = String(playerId);
    const player = this.players[id];
    if (!player) return "";

    const combo = this.lastCombos[id] ?? { cards: [], description: "", passed: false };
    const isLastComboPlayer =
      Boolean(this.lastComboPlayerId) &&
      this.lastComboPlayerId !== "0" &&
      String(this.lastComboPlayerId) === id;
    const isDisabled =
      player.handcount === 0 && this.stateName !== "newRound" && this.stateName !== "endRound";
    const isDisablerVisible = isDisabled && !isLastComboPlayer;

    const bombTargetId = this.bombActivePlayerId || this.activePlayerId;
    const isBombActive =
      this.stateName === "playBomb" && Boolean(bombTargetId) && String(bombTargetId) === id;
    const isActive =
      !isBombActive &&
      (this.stateName === "playComboOpen" ||
        this.stateName === "playCombo" ||
        this.stateName === "confirmTrick") &&
      Boolean(this.activePlayerId) &&
      String(this.activePlayerId) === id;

    const showGrandTichuColor = player.callGrandTichu === 200;
    const showTichuColor = player.callTichu === 100;
    const translatedDesc = combo.description ? t(combo.description) : "";

    return html`
      <div
        class=${classMap({
          "player-table": true,
          "last-played-container": true,
          [pos]: true,
          disabled: isDisabled,
          lastComboPlayer: isLastComboPlayer,
          active: isActive,
          bomb: isBombActive,
        })}
        id="playertable_${id}"
        title=${translatedDesc}
      >
        <div class="disabler" style="display: ${isDisablerVisible ? "block" : "none"}"></div>
        <div class="last-played-player">
          <div class="playertablename" style="color: #${player.color}">${player.name}</div>
          <div class="last-played-icons">
            <div class="icon hand" id="icon_hand_${id}" title=${t("Cards in hand")}></div>
            <div class="count handcount ${id}">${player.handcount}</div>
            <div class="icon star" id="icon_star_${id}" title=${t("Points captured")}></div>
            <div class="count pointcount ${id}">${player.capturedPoints}</div>
          </div>
          <div>
            <div
              id="grandtichucolor_${id}"
              class="icon big grandtichucolor ${id}"
              style="display: ${showGrandTichuColor ? "inline-block" : "none"}"
              title=${t("Grand Tichu bet")}
            ></div>
            <div
              id="tichucolor_${id}"
              class="icon big tichucolor ${id}"
              style="display: ${showTichuColor ? "inline-block" : "none"}"
              title=${t("Tichu bet")}
            ></div>
          </div>
        </div>
        <div id="lastcombo_${id}" class="lastcombo last-played-combo">
          ${
            combo.passed
              ? html`<span class="pass"
                  ><tichu-stock
                    .cards=${[]}
                    .pass=${true}
                    .scale=${0.75}
                    .tiki=${this.isTiki}
                  ></tichu-stock
                ></span>`
              : html`<tichu-stock
                  .cards=${combo.cards}
                  .scale=${0.75}
                  sortMode="preserve"
                  .tiki=${this.isTiki}
                  .dynamicOverlap=${true}
                ></tichu-stock>`
          }
        </div>
      </div>
    `;
  }

  private onShowCurrentTrick() {
    window.gameModel.setTrickModalOpen(true);
  }
}

customElements.define("tichu-last-played", TichuLastPlayed);
