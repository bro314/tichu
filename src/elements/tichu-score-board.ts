import { html, css, LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import { RoundScore, ScoreBoard } from "./model";
import { classMap } from "lit/directives/class-map.js";
import { subscribe } from "./subscription-controller";

export class TichuScoreBoard extends LitElement {
  @property({ type: Object }) board!: ScoreBoard;

  @state() names: string[] = [];

  @state() round: number = 0;

  static override get styles() {
    return [
      css`
        :host {
          display: block;
        }
        table {
          border-spacing: 0;
          font-size: smaller;
        }
        tr.title {
          font-weight: bold;
        }
        tr.current {
          background-color: whitesmoke;
        }
        td {
          padding: 2px;
          width: 75px;
          max-width: 75px;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center;
        }
      `,
    ];
  }

  constructor() {
    super();
    subscribe(
      this,
      () => window.model.round$,
      (round) => (this.round = round)
    );
    subscribe(
      this,
      () => window.model.playerNames$,
      (names) => (this.names = names)
    );
  }

  override render() {
    return html`
      <table>
        ${this.renderTitle()} ${this.board.rounds.map((r) => this.renderRound(r))}
      </table>
    `;
  }

  private renderTitle() {
    const team1 = `${this.names[0]} ${this.names[2]}`;
    const team2 = `${this.names[1]} ${this.names[3]}`;
    return html`
      <tr class="title">
        <td>Round</td>
        <td>${team1}</td>
        <td>${team2}</td>
        <td>${team1}</td>
        <td>${team2}</td>
      </tr>
    `;
  }

  private renderRound(r: RoundScore) {
    return html`
      <tr
        class=${classMap({
          round: true,
          current: r.round === this.round,
        })}
      >
        <td>${r.round}</td>
        ${r.scores.slice(0, 2).map((s) => html`<td>${s.roundPoints}</td>`)}
        ${r.scores.slice(0, 2).map((s) => html`<td>${s.gamePoints}</td>`)}
      </tr>
    `;
  }
}
customElements.define("tichu-score-board", TichuScoreBoard);
