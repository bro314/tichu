import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import type { RoundBetOutcome, RoundScoreRecord } from "../types/tichu-contracts";
import { groupPlayersByTeam, type ScoreBoardPlayer, type TeamGroup } from "./utils";

export { groupPlayersByTeam };
export type { ScoreBoardPlayer, TeamGroup };

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export class TichuScoreBoard extends LitElement {
  @property({ type: Array }) players: ScoreBoardPlayer[] = [];
  @property({ type: Array }) rounds: RoundScoreRecord[] = [];
  @property({ type: Number }) currentRound = 0;
  @property({ type: Boolean, reflect: true }) compact = false;

  static override get styles() {
    return [
      css`
        :host {
          display: block;
          color: var(--tichu-dialog-text, #1f2328);
        }
        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }
        .score-table-wrap {
          width: 100%;
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13px;
          line-height: 1.35;
          font-variant-numeric: tabular-nums;
        }
        :host([compact]) table {
          font-size: 12px;
        }
        thead th {
          text-align: left;
          padding: 8px 10px;
          font-weight: 700;
          font-size: 12.5px;
          color: var(--tichu-dialog-text, #1f2328);
          background: var(--tichu-dialog-surface, #ffffff);
          border-bottom: 2px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.14));
          vertical-align: bottom;
        }
        thead th.col-round {
          width: 56px;
          text-align: center;
          white-space: nowrap;
        }
        thead th.col-team {
          min-width: 145px;
        }
        :host([compact]) thead th {
          padding: 5px 7px;
          font-size: 11.5px;
        }
        :host([compact]) thead th.col-team {
          min-width: 112px;
        }
        .team-names {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        tbody tr {
          background: var(--tichu-dialog-surface, #ffffff);
        }
        tbody tr:nth-child(even) {
          background: var(--tichu-score-stripe-bg, rgba(31, 35, 40, 0.025));
        }
        tbody tr.current {
          background: var(--tichu-score-current-bg, rgba(11, 114, 181, 0.09));
        }
        tbody td {
          padding: 8px 10px;
          border-bottom: 1px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.12));
          vertical-align: top;
        }
        :host([compact]) tbody td {
          padding: 5px 7px;
        }
        td.cell-round {
          text-align: center;
          font-weight: 700;
          color: var(--tichu-dialog-text-muted, #57606a);
          white-space: nowrap;
        }
        .score-main {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }
        .round-delta {
          font-weight: 600;
          font-size: 13px;
        }
        .round-delta.pos {
          color: var(--tichu-score-pos, #15803d);
        }
        .round-delta.neg {
          color: var(--tichu-score-neg, #dc2626);
        }
        .round-delta.zero {
          color: var(--tichu-dialog-text-muted, #57606a);
        }
        .running-total {
          font-weight: 700;
          font-size: 14px;
          color: var(--tichu-dialog-text, #1f2328);
        }
        :host([compact]) .running-total {
          font-size: 12.5px;
        }
        .score-meta {
          margin-top: 4px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--tichu-dialog-text-muted, #57606a);
        }
        :host([compact]) .score-meta {
          margin-top: 2px;
          font-size: 10.5px;
        }
        .cards-chip {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1px 6px;
          border-radius: 999px;
          background: var(--tichu-dialog-segment-bg, #ebe4d8);
          color: var(--tichu-dialog-text-muted, #57606a);
          font-weight: 600;
        }
        .dv-pill {
          display: inline-flex;
          align-items: center;
          padding: 1px 6px;
          border-radius: 999px;
          background: var(--tichu-score-dv-bg, rgba(217, 119, 6, 0.16));
          color: var(--tichu-score-dv-fg, #b45309);
          font-weight: 700;
        }
        .bet-pill {
          display: inline-flex;
          align-items: center;
          padding: 1px 6px;
          border-radius: 999px;
          font-weight: 700;
          max-width: 100%;
        }
        .bet-pill.won {
          background: var(--tichu-score-pos-bg, rgba(21, 128, 61, 0.14));
          color: var(--tichu-score-pos, #15803d);
        }
        .bet-pill.lost {
          background: var(--tichu-score-neg-bg, rgba(220, 38, 38, 0.14));
          color: var(--tichu-score-neg, #dc2626);
        }
        .prior-note {
          font-style: italic;
        }
        tfoot td {
          padding: 8px 10px;
          font-weight: 700;
          background: var(--tichu-dialog-surface, #ffffff);
          border-top: 2px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.14));
        }
        :host([compact]) tfoot td {
          padding: 5px 7px;
        }
        tfoot td.cell-round {
          color: var(--tichu-dialog-text, #1f2328);
        }
        tfoot td.cell-total {
          text-align: right;
          font-size: 14.5px;
        }
        :host([compact]) tfoot td.cell-total {
          font-size: 13px;
        }
        .empty-state {
          padding: 20px 12px;
          text-align: center;
          color: var(--tichu-dialog-text-muted, #57606a);
          font-size: 13px;
          background: var(--tichu-dialog-surface, #ffffff);
        }
      `,
    ];
  }

  override render() {
    const { team0, team1 } = groupPlayersByTeam(this.players);
    const team0Label = this.formatTeamLabel(team0, _("Team 1"));
    const team1Label = this.formatTeamLabel(team1, _("Team 2"));
    const playerNamesById = new Map<string, string>();
    const playerTeamById = new Map<string, 0 | 1>();
    for (const p of team0) {
      playerNamesById.set(String(p.id), p.name);
      playerTeamById.set(String(p.id), 0);
    }
    for (const p of team1) {
      playerNamesById.set(String(p.id), p.name);
      playerTeamById.set(String(p.id), 1);
    }

    const latestTotals = this.computeLatestTotals(team0, team1);

    return html`
      <div class="score-table-wrap">
        <table>
          <thead>
            <tr>
              <th class="col-round" scope="col">${_("Round")}</th>
              <th class="col-team" scope="col" title=${team0Label}>
                <span class="team-names">${team0Label}</span>
              </th>
              <th class="col-team" scope="col" title=${team1Label}>
                <span class="team-names">${team1Label}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            ${this.rounds.length === 0
              ? html`
                  <tr>
                    <td colspan="3" class="empty-state">
                      ${_(
                        "No rounds completed yet. Round-by-round scores will appear here after Round 1.",
                      )}
                    </td>
                  </tr>
                `
              : this.rounds.map((r) => this.renderRound(r, playerNamesById, playerTeamById))}
          </tbody>
          <tfoot>
            <tr>
              <td class="cell-round">${_("Total")}</td>
              <td class="cell-total">${latestTotals[0]}</td>
              <td class="cell-total">${latestTotals[1]}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  private formatTeamLabel(teamPlayers: ScoreBoardPlayer[], fallback: string): string {
    const names = teamPlayers.map((p) => p.name).filter((n) => Boolean(n));
    return names.length > 0 ? names.join(" & ") : fallback;
  }

  private computeLatestTotals(
    team0: ScoreBoardPlayer[],
    team1: ScoreBoardPlayer[],
  ): [number, number] {
    if (this.rounds.length > 0) {
      const last = this.rounds[this.rounds.length - 1]!;
      return [last.teamTotals[0], last.teamTotals[1]];
    }
    const s0 = team0[0]?.score !== undefined ? Number(team0[0].score) : 0;
    const s1 = team1[0]?.score !== undefined ? Number(team1[0].score) : 0;
    return [Number.isNaN(s0) ? 0 : s0, Number.isNaN(s1) ? 0 : s1];
  }

  private renderRound(
    r: RoundScoreRecord,
    playerNamesById: Map<string, string>,
    playerTeamById: Map<string, 0 | 1>,
  ) {
    const roundLabel = r.isSyntheticPrior
      ? r.priorThroughRound && r.priorThroughRound > 1
        ? `1–${r.priorThroughRound}`
        : _("Prior")
      : String(r.round);

    return html`
      <tr
        class=${classMap({
          round: true,
          prior: Boolean(r.isSyntheticPrior),
          current: !r.isSyntheticPrior && this.currentRound > 0 && r.round === this.currentRound,
        })}
      >
        <td class="cell-round">${roundLabel}</td>
        ${this.renderTeamCell(r, 0, playerNamesById, playerTeamById)}
        ${this.renderTeamCell(r, 1, playerNamesById, playerTeamById)}
      </tr>
    `;
  }

  private renderTeamCell(
    r: RoundScoreRecord,
    teamIdx: 0 | 1,
    playerNamesById: Map<string, string>,
    playerTeamById: Map<string, 0 | 1>,
  ) {
    const delta = r.teamPoints[teamIdx] ?? 0;
    const total = r.teamTotals[teamIdx] ?? 0;
    const deltaClass = delta > 0 ? "pos" : delta < 0 ? "neg" : "zero";

    const teamBets: Array<{ name: string; bet: RoundBetOutcome }> = [];
    for (const [pid, bet] of Object.entries(r.bets ?? {})) {
      if ((playerTeamById.get(String(pid)) ?? 0) === teamIdx) {
        teamBets.push({
          name: playerNamesById.get(String(pid)) ?? pid,
          bet,
        });
      }
    }

    return html`
      <td>
        <div class="score-main">
          <span class="round-delta ${deltaClass}">${formatSigned(delta)}</span>
          <span class="running-total">${total}</span>
        </div>
        ${r.isSyntheticPrior
          ? html`<div class="score-meta prior-note">${_("Prior rounds cumulative total")}</div>`
          : html`
              <div class="score-meta">
                ${r.doubleVictory === teamIdx
                  ? html`<span class="dv-pill">${_("1-2 (+200)")}</span>`
                  : r.doubleVictory >= 0
                    ? nothing
                    : html`<span class="cards-chip"
                        >${_("Cards")}: ${r.cardPoints[teamIdx] ?? 0}</span
                      >`}
                ${teamBets.map(
                  ({ name, bet }) => html`
                    <span class="bet-pill ${bet.won ? "won" : "lost"}">
                      ${name}: ${bet.type} ${formatSigned(bet.delta)}
                    </span>
                  `,
                )}
              </div>
            `}
      </td>
    `;
  }
}
customElements.define("tichu-score-board", TichuScoreBoard);
