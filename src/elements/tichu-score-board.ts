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
        :host([compact]) {
          width: 100%;
          box-sizing: border-box;
          border-radius: var(--border-radius, 12px);
          border: 1px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.16));
          box-shadow: var(--elevation, 0 2px 8px rgba(15, 23, 42, 0.14));
          overflow: hidden;
        }
        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }
        .score-table-wrap {
          width: 100%;
          background: var(--tichu-dialog-surface, #ffffff);
          overflow-x: hidden;
        }
        table {
          width: 100%;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13px;
          line-height: 1.3;
          font-variant-numeric: tabular-nums;
        }
        :host([compact]) table {
          font-size: 12px;
          line-height: 1.25;
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
        :host([compact]) thead th {
          padding: 4px 6px;
          font-size: 11.5px;
        }
        :host([compact]) thead th.col-round {
          width: 44px;
        }
        .team-names {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        tbody tr {
          background: transparent;
        }
        tbody tr:nth-child(even) {
          background: var(--tichu-score-stripe-bg, rgba(31, 35, 40, 0.035));
        }
        tbody tr.current,
        tbody tr.current:nth-child(even) {
          background: var(--tichu-score-current-bg, rgba(11, 114, 181, 0.12));
        }
        tbody td {
          padding: 7px 10px;
          border-bottom: 1px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.12));
          vertical-align: middle;
        }
        :host([compact]) tbody td {
          padding: 3px 6px;
        }
        td.cell-round {
          text-align: center;
          font-weight: 700;
          color: var(--tichu-dialog-text-muted, #57606a);
          white-space: nowrap;
        }
        .score-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          min-width: 0;
        }
        :host([compact]) .score-main {
          gap: 4px;
        }
        .round-delta-wrap {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
        }
        :host([compact]) .round-delta-wrap {
          gap: 3px;
        }
        .round-delta {
          font-weight: 600;
          font-size: 13px;
        }
        :host([compact]) .round-delta {
          font-size: 12px;
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
          font-size: 13.5px;
          color: var(--tichu-dialog-text, #1f2328);
          flex-shrink: 0;
        }
        :host([compact]) .running-total {
          font-size: 12px;
        }
        .score-tag {
          display: inline-flex;
          align-items: center;
          padding: 0 5px;
          border-radius: 4px;
          font-size: 10.5px;
          font-weight: 700;
          line-height: 1.45;
          flex-shrink: 0;
        }
        :host([compact]) .score-tag {
          padding: 0 4px;
          font-size: 10px;
          line-height: 1.4;
        }
        .score-tag.dv {
          background: var(--tichu-score-dv-bg, rgba(217, 119, 6, 0.16));
          color: var(--tichu-score-dv-fg, #b45309);
        }
        .score-tag.won {
          background: var(--tichu-score-pos-bg, rgba(21, 128, 61, 0.14));
          color: var(--tichu-score-pos, #15803d);
        }
        .score-tag.lost {
          background: var(--tichu-score-neg-bg, rgba(220, 38, 38, 0.14));
          color: var(--tichu-score-neg, #dc2626);
        }
        .score-tag.prior {
          background: var(--tichu-dialog-segment-bg, #ebe4d8);
          color: var(--tichu-dialog-text-muted, #57606a);
          font-weight: 600;
        }
        tfoot td {
          padding: 8px 10px;
          font-weight: 700;
          background: var(--tichu-dialog-surface, #ffffff);
          border-top: 2px solid var(--tichu-dialog-border, rgba(31, 35, 40, 0.14));
        }
        :host([compact]) tfoot td {
          padding: 4px 6px;
        }
        tfoot td.cell-round {
          color: var(--tichu-dialog-text, #1f2328);
        }
        tfoot td.cell-total {
          text-align: right;
          font-size: 14px;
        }
        :host([compact]) tfoot td.cell-total {
          font-size: 12.5px;
        }
        .empty-state {
          padding: 20px 12px;
          text-align: center;
          color: var(--tichu-dialog-text-muted, #57606a);
          font-size: 13px;
          background: transparent;
        }
        :host([compact]) .empty-state {
          padding: 10px 8px;
          font-size: 12px;
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

  private buildCellTitle(
    r: RoundScoreRecord,
    teamIdx: 0 | 1,
    teamBets: Array<{ name: string; bet: RoundBetOutcome }>,
  ): string {
    if (r.isSyntheticPrior) {
      return _("Prior rounds cumulative total");
    }
    const parts: string[] = [];
    if (r.doubleVictory === teamIdx) {
      parts.push(_("1-2 (+200)"));
    } else if (r.doubleVictory < 0) {
      parts.push(`${_("Cards")}: ${r.cardPoints[teamIdx] ?? 0}`);
    }
    for (const { name, bet } of teamBets) {
      parts.push(`${name}: ${bet.type} ${formatSigned(bet.delta)}`);
    }
    return parts.join(" · ");
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

    const cellTitle = this.buildCellTitle(r, teamIdx, teamBets);
    return html`
      <td title=${cellTitle}>
        <div class="score-main">
          <span class="round-delta-wrap">
            <span class="round-delta ${deltaClass}">${formatSigned(delta)}</span>
            ${r.isSyntheticPrior
              ? html`<span class="score-tag prior">${_("Prior")}</span>`
              : nothing}
            ${!r.isSyntheticPrior && r.doubleVictory === teamIdx
              ? html`<span class="score-tag dv">1-2</span>`
              : nothing}
            ${!r.isSyntheticPrior
              ? teamBets.map(
                  ({ bet }) => html`
                    <span class="score-tag ${bet.won ? "won" : "lost"}">${bet.type}</span>
                  `,
                )
              : nothing}
          </span>
          <span class="running-total">${total}</span>
        </div>
      </td>
    `;
  }
}
customElements.define("tichu-score-board", TichuScoreBoard);
