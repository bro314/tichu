import { html, css, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { Bet, Model, PlayerScore, RoundScore, ScoreBoard, State } from "./model";
import "./tichu-player";
import "./tichu-stock";
import "./tichu-card";
import "./tichu-score-board";
import { playerIdFromChannel } from "./utils";
import { subscribe } from "./subscription-controller";

const fakeGamelogs: NotifsPacket[] = [];
const fakePlayers = {};

declare global {
  interface Window {
    g_gamelogs: NotifsPacket[];
    g_archive_mode: boolean;
    model: Model;
    gameui: { gamedatas: Gamedatas };
  }
  interface Notif {
    player_id: number;
  }
}

export class TichuReplay extends LitElement {
  @state() private wish = 0;

  @state() private playerIds: number[] = [];

  @state() private notifIndex = 0;

  @state() private ignoredNotifType = "";

  @state() private scoreBoard!: ScoreBoard;

  private model: Model = new Model();

  private notifs: Notif[] = [];

  /** State at index i is the state before replaying notification i. */
  private states: State[] = [];

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
    let gamelogs = window.g_archive_mode ? window.g_gamelogs : fakeGamelogs;
    if (typeof (gamelogs as any)?.data?.data === "object") {
      gamelogs = (gamelogs as any)?.data?.data as NotifsPacket[];
    }
    tidyUpGamelogs(gamelogs);
    for (const packet of gamelogs) {
      this.notifs.push(
        ...packet.data.map((data) => {
          const player_id = playerIdFromChannel(packet.channel);
          return { ...data, player_id, move_id: packet.move_id };
        })
      );
    }

    subscribe(
      this,
      () => this.model.wish$,
      (x) => (this.wish = x)
    );
    subscribe(
      this,
      () => this.model.playerIds$,
      (x) => (this.playerIds = x)
    );
    subscribe(
      this,
      () => this.model.playerIds$,
      (x) => (this.scoreBoard = createScoreBoard(this.notifs, x))
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
    this.model.init(players);
    this.recordState();
    this.nextRound();
  }

  override render() {
    this.style.setProperty("--card-url", `url(${g_gamethemeurl}img/tichu-cards.png)`);
    this.style.setProperty("--icon-url", `url(${g_gamethemeurl}img/tichu-icons.png)`);
    this.style.setProperty("--wish-url", `url(${g_gamethemeurl}img/tichu-icons-table.png)`);

    const ids = this.playerIds;
    if (!ids || !ids[0] || ids[0] <= 0) return;
    const last = this.notifs[this.notifIndex - 1];
    const next = this.notifs.find((n, i) => i >= this.notifIndex && !isIgnored(n));
    return html`
      <div class="squareTable">
        <div class="grid">
          <div class="controls">
            <div class="buttons">
              <button class="red debug" @click=${this.prev}>Previous Notif</button>
              <button class="red" @click=${this.prevMove}>Previous Move (←)</button>
              <button class="red" @click=${this.prevRound}>Previous Round (Shift ←)</button>
            </div>
            <div class="buttons">
              <button class="green debug" @click=${this.next}>Next Notif</button>
              <button class="green" @click=${this.nextMove}>Next Move (→)</button>
              <button class="green" @click=${this.nextRound}>Next Round (Shift →)</button>
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
              <button class="darkgray" @click=${this.exit}>Back to Classic View</button>
            </div>
          </div>
        </div>
        <div class="debug">
          <div class="subtitle">
            <span>notifIndex: ${this.notifIndex}</span>
            <span>moveId: ${this.notifs[this.notifIndex]?.move_id}</span>
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
          <div>notifs: ${this.notifs.length}</div>
          <div>notif: ${JSON.stringify(this.notifs[this.notifIndex])}</div>
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

  private prevMove() {
    let sameMove = true;
    const moveId = this.notifs[this.notifIndex - 1]?.move_id;
    while (sameMove) {
      this.prev();
      const prev = this.notifs[this.notifIndex - 1];
      sameMove = !!prev && moveId === prev?.move_id;
    }
  }

  private nextMove() {
    let sameMove = true;
    let moveId = this.notifs[this.notifIndex]?.move_id;
    while (sameMove) {
      this.next();
      const next = this.notifs[this.notifIndex];
      sameMove = !!next && next?.move_id === moveId;
    }
  }

  private prevRound() {
    while (this.notifIndex > 0) {
      this.prevMove();
      const cards = this.model.getState().passedCards;
      if (cards.length === 12 && !cards.some((c) => c.accepted)) return;
    }
  }

  private nextRound() {
    while (this.notifs[this.notifIndex]) {
      this.nextMove();
      const cards = this.model.getState().passedCards;
      if (cards.length === 12 && !cards.some((c) => c.accepted)) return;
    }
  }

  private prev() {
    if (this.notifIndex === 0) return;
    this.notifIndex--;
    this.model.setState(this.states[this.notifIndex]!);
  }

  private next() {
    const notif = this.notifs[this.notifIndex];
    this.notifIndex++;
    if (!notif) return;
    const type = notif.type as string;
    const args = notif.args as any;
    if (type === "dealCards") {
      const playerId = Number(args.cards[0].location_arg);
      this.model.dealCards(playerId, args.cards);
    } else if (type === "playCombo") {
      const playerId = Number(args.player_id);
      this.model.playCombo(playerId, args.cards, args.points);
    } else if (type === "pass") {
      const playerId = Number(args.player_id);
      this.model.pass(playerId);
    } else if (type === "grandTichuBet") {
      const playerId = Number(args.player_id);
      this.model.setBet(playerId, args.bet === "200" ? Bet.GRAND_TICHU : Bet.NO_BET_YET);
    } else if (type === "tichuBet") {
      const playerId = Number(args.player_id);
      this.model.setBet(playerId, args.bet === 100 ? Bet.TICHU : Bet.NO_BET);
    } else if (type === "gameStateMultipleActiveUpdate") {
      const playerIds = args.map((id: string) => Number(id));
      this.model.setActive(playerIds);
    } else if (type === "gameStateChange" && args.type === "activeplayer") {
      const playerId = Number(args.active_player);
      this.model.setActive([playerId]);
    } else if (type === "acceptCards") {
      this.model.acceptCards(notif.player_id);
    } else if (type === "passCards") {
      const cardIds: string[] = args.cardIds;
      this.model.passCards(notif.player_id, cardIds);
    } else if (type === "wishMade") {
      const wish = Number(args.wish);
      this.model.setWish(wish);
    } else if (type === "mahjongWishGranted") {
      this.model.setWish(0);
    } else if (type === "captureCards") {
      const playerId = Number(args.player_id);
      const trickValue = Number(args.trick_value);
      this.model.captureCards(playerId, trickValue);
    } else if (type === "newScores") {
      const playerIds = this.model.getPlayerIds();
      for (const playerId of playerIds) {
        const gamePoints = args.newScores[`${playerId}`];
        this.model.setGamePoints(playerId, gamePoints);
      }
      this.model.beginNewRound();
    } else if (isIgnored(notif)) {
      // fine
    } else {
      this.ignoredNotifType = type;
    }
    this.recordState();
  }

  recordState() {
    this.states[this.notifIndex] = { ...this.model.getState() };
  }
}
customElements.define("tichu-replay", TichuReplay);

function isIgnored(notif: Notif) {
  const type = notif.type as string;
  const args = notif.args as any;
  if (type === "autopass") return true;
  if (type === "hasBomb") return true;
  if (type === "log") return true;
  if (type === "playerGoOut") return true;
  if (type === "simpleNode") return true;
  if (type === "tableWindow") return true;
  if (type === "updateReflexionTime") return true;
  if (type === "wakeupPlayers") return true;
  if (type === "gameStateChangePrivateArg") return true;
  if (type === "gameStateChange" && args.type === "game") return true;
  if (type === "gameStateChange" && args.type === "manager") return true;
  if (type === "gameStateChange" && args.type === "multipleactiveplayer") return true;
  return false;
}

function createScoreBoard(notifs: Notif[], playerIds: number[]): ScoreBoard {
  const rounds: RoundScore[] = [];
  let roundCount = 1;
  let newScores: { [player_id: string]: string } = {};
  let oldScores: { [player_id: string]: string } = {};
  for (const notif of notifs) {
    if ((notif.type as string) !== "newScores") continue;

    oldScores = newScores;
    newScores = (notif.args as any).newScores;

    const scores: PlayerScore[] = [];
    for (const id of playerIds) {
      const oldGamePoints = toNumber(oldScores[`${id}`]);
      const gamePoints = toNumber(newScores[`${id}`]);
      const roundPoints = gamePoints - oldGamePoints;
      scores.push({ id, gamePoints, roundPoints });
    }
    const round: RoundScore = { round: roundCount++, scores };
    rounds.push(round);
  }
  return { rounds };
}

function toNumber(s?: string) {
  const n = Number(s ?? "") ?? 0;
  return isNaN(n) ? 0 : n;
}

function tidyUpGamelogs(gamelogs: NotifsPacket[]) {
  for (let index = 0; index < gamelogs.length; index++) {
    const thisPacket = gamelogs[index];
    let prevPacket = gamelogs[index - 1];
    if (!thisPacket || !prevPacket) continue;

    const allIgnored = thisPacket.data.every(isIgnored);
    if (allIgnored) {
      gamelogs.splice(index, 1);
      index -= 1;
      continue;
    }

    // All GT bets should be one move.
    const thisgt = thisPacket.data.some((notif) => (notif.type as string) === "grandTichuBet");
    const prevgt = prevPacket.data.some((notif) => (notif.type as string) === "grandTichuBet");
    if (thisgt && prevgt) thisPacket.move_id = prevPacket.move_id;

    // The last passCards
    const thispcjoined =
      thisPacket.data.length > 1 &&
      thisPacket.data.some((notif) => (notif.type as string) === "passCards");
    if (thispcjoined) {
      const pcData = thisPacket.data.filter((notif) => (notif.type as string) === "passCards");
      const otherData = thisPacket.data.filter((notif) => (notif.type as string) !== "passCards");
      const pcPacket = { ...thisPacket, data: pcData };
      thisPacket.data = otherData;
      gamelogs.splice(index, 0, pcPacket);
      index -= 1;
      continue;
    }

    // All PassCards moves should be one.
    const thispc =
      thisPacket.data.length === 1 &&
      thisPacket.data.some(
        (notif) =>
          (notif.type as string) === "passCards" ||
          (notif.type as string) === "gameStateMultipleActiveUpdate"
      );
    const prevpc =
      prevPacket.data.length === 1 &&
      prevPacket.data.some(
        (notif) =>
          (notif.type as string) === "passCards" ||
          (notif.type as string) === "gameStateMultipleActiveUpdate"
      );
    if (thispc && prevpc) thisPacket.move_id = prevPacket.move_id;

    // Make sure that public updates (/table) come before private updates (/player).
    if (thisPacket?.move_id !== prevPacket?.move_id) continue;
    if (!thisPacket?.channel.startsWith("/table/t")) continue;
    if (!prevPacket?.channel.startsWith("/player/p")) continue;
    swap(gamelogs, index, index - 1);
    index -= 2;
  }
}

function swap(gamelogs: NotifsPacket[], i: number, j: number) {
  if (!gamelogs[i]) return;
  if (!gamelogs[j]) return;
  const temp = gamelogs[i];
  gamelogs[i] = gamelogs[j]!;
  gamelogs[j] = temp!;
}
