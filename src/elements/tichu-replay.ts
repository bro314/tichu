import { html, css, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { Model, ScoreBoard } from "./model";
import "./tichu-player";
import "./tichu-stock";
import "./tichu-card";
import "./tichu-score-board";
import "./utils";
import { subscribe } from "./subscription-controller";
import {
  createScoreBoard,
  isIgnoredReplayNotif,
  NotifsPacket,
  ReplayEngine,
  ReplayNotif,
  segmentNotifMoves,
  tidyUpGamelogs,
} from "./replay-engine";

export { createScoreBoard, isIgnoredReplayNotif, ReplayEngine, segmentNotifMoves, tidyUpGamelogs };
export type { NotifsPacket, ReplayNotif };

const fakeGamelogs: NotifsPacket[] = [];
const fakePlayers = {};

declare global {
  interface Window {
    g_gamelogs: NotifsPacket[];
    g_archive_mode: boolean;
    model: Model;
    gameui: { gamedatas: Gamedatas };
  }
}

export class TichuReplay extends LitElement {
  @state() private wish = 0;

  @state() private playerIds: number[] = [];

  @state() private notifIndex = 0;

  @state() private ignoredNotifType = "";

  @state() private scoreBoard: ScoreBoard = { rounds: [] };

  private model: Model = new Model();

  private engine: ReplayEngine;

  static override get styles() {
    return [
      css`
        :host {
          display: block;
          background-color: var(--bg-color-play-area);
          padding: 24px 8px 8px 8px;
          margin: 0px auto;
          box-sizing: border-box;
          border-radius: var(--border-radius);
        }
        div.buttons {
          margin-bottom: 8px;
          text-align: center;
        }
        div.subtitle {
          margin: 8px;
          text-align: center;
        }
        button {
          font-size: 14px;
          font-weight: 700;
          border-radius: var(--border-radius);
          padding: 6px 12px;
          margin-right: 8px;
          min-width: 150px;
        }
        button.green {
          color: #fff;
          background: #89a538;
          background: -o-linear-gradient(top, #799332, #89a538);
          border: 1px solid #697f2b;
        }
        button.red {
          color: #fff;
          background: #c92727;
          background: -o-linear-gradient(top, #c20b0b, #c92727);
          border: 1px solid #b20a0a;
        }
        button.blue {
          color: #fff;
          background: #4871b6;
          background: -o-linear-gradient(top, #4065a3, #4871b6);
          border: 1px solid #37578c;
        }
        button.darkgray {
          color: #fff;
          background: #787878;
          background: -o-linear-gradient(top, #888, #787878);
          border: 1px solid #505050;
        }
        button.gray {
          color: #060606;
          background: #d8d8d8;
          border: 1px solid #060606;
        }
        .grid {
          display: grid;
        }
        div.debug {
          font-size: 10px;
          margin-top: 12px;
          display: none;
        }
        button.debug {
          display: none;
        }

        .grid {
          display: grid;
          grid-gap: 8px;
          grid-template-columns: 2fr 1fr;
          grid-template-rows: 1fr 1fr 1fr 1fr;
        }
        .grid .top {
          grid-column: 1 / span 1;
          grid-row: 3 / span 1;
        }
        .grid .left {
          grid-column: 1 / span 1;
          grid-row: 4 / span 1;
        }
        .grid .right {
          grid-column: 1 / span 1;
          grid-row: 2 / span 1;
        }
        .grid .bottom {
          grid-column: 1 / span 1;
          grid-row: 1 / span 1;
        }
        .grid .wishCell {
          grid-column: 2 / span 1;
          grid-row: 2 / span 1;
          place-self: center;
          text-align: center;
        }
        .grid tichu-status {
          grid-column: 2 / span 1;
          grid-row: 1 / span 1;
          place-self: start end;
          text-align: right;
          font-size: 20px;
        }
        .grid tichu-score-board {
          grid-column: 2 / span 1;
          grid-row: 3 / span 1;
          place-self: center;
        }

        .squareTable .grid {
          grid-template-columns:
            minmax(70px, 0fr)
            minmax(300px, 1fr)
            minmax(70px, 0fr)
            minmax(300px, 1fr)
            minmax(70px, 0fr);
          grid-template-rows: 0fr 0fr 0fr 0fr;
        }
        .squareTable .grid .top {
          grid-column: 3 / span 2;
          grid-row: 1 / span 1;
        }
        .squareTable .grid .left {
          grid-column: 1 / span 2;
          grid-row: 2 / span 1;
        }
        .clockwise.squareTable .grid .left {
          grid-column: 4 / span 2;
        }
        .squareTable .grid .right {
          grid-column: 4 / span 2;
          grid-row: 2 / span 1;
        }
        .clockwise.squareTable .grid .right {
          grid-column: 1 / span 2;
        }
        .squareTable .grid .bottom {
          grid-column: 2 / span 2;
          grid-row: 3 / span 1;
        }
        .squareTable .grid .wishCell {
          grid-column: 3 / span 1;
          grid-row: 2 / span 1;
        }
        .squareTable .grid .controls {
          grid-column: 1 / span 2;
          grid-row: 1 / span 1;
          place-self: center;
        }
        .squareTable .grid .exit {
          grid-column: 1 / span 2;
          grid-row: 4 / span 1;
          margin-top: 50px;
        }
        .squareTable .grid tichu-status {
          grid-column: 4 / span 1;
          grid-row: 1 / span 1;
        }
        .squareTable .grid tichu-score-board {
          grid-column: 4 / span 2;
          grid-row: 3 / span 2;
          place-self: center;
        }
        .squareTable .grid {
          grid-column: 4 / span 2;
          grid-row: 3 / span 2;
          place-self: center;
        }
        .player {
          display: flex;
          justify-content: flex-end;
        }
        .player.reverse {
          justify-content: flex-start;
        }
        .player tichu-player {
          flex-grow: 1;
        }
        .wishIcon {
          width: 60px;
          height: 90px;
          background-size: 480px 180px;
          background-color: rgba(255, 255, 255, 0.5);
          border-radius: var(--border-radius);
          background-image: var(--wish-url);
          background-position-x: calc((-1px) * var(--wish-x));
          background-position-y: calc((-1px) * var(--wish-y));
        }
      `,
    ];
  }

  constructor() {
    super();

    window.model = this.model;
    const gamelogs = window.g_archive_mode ? window.g_gamelogs : fakeGamelogs;
    this.engine = new ReplayEngine(gamelogs, undefined, this.model);

    subscribe(
      this,
      () => this.model.wish$,
      (x) => (this.wish = x),
    );
    subscribe(
      this,
      () => this.model.playerIds$,
      (x) => (this.playerIds = x),
    );
    subscribe(
      this,
      () => this.model.playerIds$,
      (x) => (this.scoreBoard = createScoreBoard(this.engine.getNotifs(), x)),
    );
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("keydown", this.keyListener);
  }

  override disconnectedCallback(): void {
    document.removeEventListener("keydown", this.keyListener);
    super.disconnectedCallback();
  }

  private keyListener = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      if (e.shiftKey) {
        this.prevRound();
      } else {
        this.prevMove();
      }
    } else if (e.key === "ArrowRight") {
      if (e.shiftKey) {
        this.nextRound();
      } else {
        this.nextMove();
      }
    } else {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  override firstUpdated() {
    const players = window.g_archive_mode
      ? Object.values(window.gameui.gamedatas.players)
      : (fakePlayers as Player[]);
    this.engine.init(players);
    this.engine.nextRound();
    this.syncFromEngine();
  }

  override render() {
    this.style.setProperty("--card-url", `url(${g_gamethemeurl}img/tichu-cards.png)`);
    this.style.setProperty("--icon-url", `url(${g_gamethemeurl}img/tichu-icons.png)`);
    this.style.setProperty("--ui-icons-url", `url(${g_gamethemeurl}img/tichu-ui-icons.png)`);
    this.style.setProperty("--wish-url", `url(${g_gamethemeurl}img/tichu-icons-table.png)`);

    const ids = this.playerIds;
    if (!ids || !ids[0] || ids[0] <= 0) return;
    const notifs = this.engine.getNotifs();
    const last = notifs[this.notifIndex - 1];
    const next = notifs.find((n, i) => i >= this.notifIndex && !isIgnoredReplayNotif(n));
    return html`
      <div class="squareTable">
        <div class="grid">
          <div class="controls">
            <div class="buttons">
              <button class="red debug" @click=${this.prev}>${_("Previous Notif")}</button>
              <button class="red" @click=${this.prevMove}>${_("Previous Move (←)")}</button>
              <button class="red" @click=${this.prevRound}>${_("Previous Round (Shift ←)")}</button>
            </div>
            <div class="buttons">
              <button class="green debug" @click=${this.next}>${_("Next Notif")}</button>
              <button class="green" @click=${this.nextMove}>${_("Next Move (→)")}</button>
              <button class="green" @click=${this.nextRound}>${_("Next Round (Shift →)")}</button>
            </div>
          </div>
          <div class="wishCell">${this.renderWish()}</div>
          <div class="player top reverse">
            <tichu-player reverse .playerId=${ids[0] ?? 0}></tichu-player>
          </div>
          <div class="player left">
            <tichu-player .playerId=${ids[1] ?? 0}></tichu-player>
          </div>
          <div class="player bottom">
            <tichu-player .playerId=${ids[2] ?? 0}></tichu-player>
          </div>
          <div class="player right reverse">
            <tichu-player reverse .playerId=${ids[3] ?? 0}></tichu-player>
          </div>
          <tichu-score-board .board=${this.scoreBoard}></tichu-score-board>
          <div class="exit">
            <div>
              <button class="darkgray" @click=${this.exit}>${_("Back to Classic View")}</button>
            </div>
          </div>
        </div>
        <div class="debug">
          <div class="subtitle">
            <span>notifIndex: ${this.notifIndex}</span>
            <span>moveId: ${notifs[this.notifIndex]?.move_id}</span>
          </div>
          <div class="subtitle">
            <span
              >Last: ${last?.type}${last && last.player_id > 0 ? ` (${last?.player_id})` : ""}</span
            >
            <span
              >Next: ${next?.type}${last && last.player_id > 0 ? ` (${last?.player_id})` : ""}</span
            >
            <span>${this.ignoredNotifType ? ` IGNORED: ${this.ignoredNotifType}` : ""}</span>
          </div>
          <button class="darkgray" @click=${this.dumpState}>Dump State</button>
          <div>g_archive_mode: ${window.g_archive_mode}</div>
          <div>notifs: ${notifs.length}</div>
          <div>notif: ${JSON.stringify(notifs[this.notifIndex])}</div>
        </div>
      </div>
    `;
  }

  private exit() {
    this.dispatchEvent(new CustomEvent("exit", { detail: {}, composed: true, bubbles: true }));
  }

  private renderWish() {
    if (this.wish < 2) return;
    if (this.wish > 14) return;
    const w = this.wish - 2;
    const x = (w % 7) * 60;
    const y = ((w - (w % 7)) / 7) * 90;
    this.style.setProperty("--wish-x", `${x}`);
    this.style.setProperty("--wish-y", `${y}`);
    return html` <div class="wishIcon"></div> `;
  }

  private dumpState() {
    console.log(JSON.stringify(this.model.getState()));
  }

  private syncFromEngine() {
    this.notifIndex = this.engine.getNotifIndex();
    this.ignoredNotifType = this.engine.getIgnoredNotifType();
    this.scoreBoard = this.engine.getScoreBoard();
  }

  private prevMove() {
    this.engine.prevMove();
    this.syncFromEngine();
  }

  private nextMove() {
    this.engine.nextMove();
    this.syncFromEngine();
  }

  private prevRound() {
    this.engine.prevRound();
    this.syncFromEngine();
  }

  private nextRound() {
    this.engine.nextRound();
    this.syncFromEngine();
  }

  private prev() {
    this.engine.stepBack();
    this.syncFromEngine();
  }

  private next() {
    this.engine.stepForward();
    this.syncFromEngine();
  }
}
customElements.define("tichu-replay", TichuReplay);
