import { html, css, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { substituteTemplate } from "./combo-validator";
import "./game-model";
import {
  BetAnimation,
  ConcedeState,
  LivePlayer,
  getConcedeUiState,
  initialConcedeState,
} from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";
import "./tichu-value-choice";
import "./tichu-last-played";
import "./tichu-pass-area";
import "./tichu-hand";
import "./tichu-played-cards";
import "./tichu-trick-modal";
import "./tichu-settings-modal";
import "./tichu-score-modal";
import "./tichu-tooltip-layer";
import { getAnimationLayer } from "./tichu-animation-layer";
import { getTooltipLayer } from "./tichu-tooltip-layer";
import "./tichu-replay";

const THEME_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export class TichuGame extends LitElement {
  @state() private experimentalReplayOpen = false;
  @state() private clockwise = true;
  @state() private squareTable = true;
  @state() private theme = 0;
  @state() private isTiki = false;
  @state() private betAnimations: BetAnimation[] = [];
  @state() private concede: ConcedeState = { ...initialConcedeState };
  @state() private players: Record<string, LivePlayer> = {};
  @state() private currentPlayerId = "";
  @state() private isSpectator = false;
  @state() private stateName = "";
  @state() private round = 0;

  static override get styles() {
    return [
      styles,
      css`
        :host {
          display: block;
          position: relative;
          --bg-color-light: #eee;
          --bg-color-html: rgba(0, 0, 0, 0.3);
          --bg-color-play-area: rgba(255, 255, 255, 0.3);
          --bg-color-lighter: rgba(252, 246, 238, 0.86);
          --bg-color-active: #dc2626;
        }
        #tichu-game-root {
          position: relative;
        }
        #concede-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px 14px;
          margin: 0 0 10px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--tichu-surface-border, rgba(31, 35, 40, 0.16));
          background: var(--tichu-surface-bg, var(--bg-color-lighter));
          color: var(--tichu-text, #1f2328);
          box-shadow: var(--tichu-surface-shadow, var(--elevation));
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          font-size: 14px;
        }
        :host-context(html[data-theme="dark"]) #concede-banner {
          background: var(--tichu-surface-bg, rgba(30, 38, 52, 0.94));
          color: var(--tichu-text, #f1f5f9);
          border-color: var(--tichu-surface-border, rgba(148, 163, 184, 0.25));
        }
        .concede-banner-msg {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          line-height: 1.35;
        }
        .concede-banner-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .concede-action-btn {
          height: 32px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid var(--tichu-btn-sec-border, rgba(31, 35, 40, 0.2));
          background: var(--tichu-btn-sec-bg, #ffffff);
          color: var(--tichu-btn-sec-fg, #1f2328);
          box-shadow: var(--tichu-btn-sec-shadow, 0 1px 2px rgba(15, 23, 42, 0.08));
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background-color 140ms ease,
            box-shadow 140ms ease,
            transform 140ms ease;
        }
        .concede-action-btn.primary {
          border-color: #b91c1c;
          background: #dc2626;
          color: #ffffff;
        }
        .concede-action-btn.primary:hover {
          background: #b91c1c;
        }
        .concede-action-btn:not(.primary):hover {
          background: var(--tichu-btn-sec-bg-hover, #f3f4f6);
        }
        .concede-action-btn:active {
          transform: translateY(1px);
        }
        .concede-action-btn:focus-visible {
          outline: 2px solid #0b72b5;
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .concede-action-btn {
            transition: none;
          }
          .concede-action-btn:active {
            transform: none;
          }
        }
        @media (forced-colors: active) {
          #concede-banner,
          .concede-action-btn,
          .concede-action-btn.primary {
            border-color: ButtonText;
            color: ButtonText;
            background: Canvas;
          }
          .concede-action-btn:focus-visible {
            outline-color: Highlight;
          }
        }
      `,
    ];
  }

  constructor() {
    super();
    subscribe(
      this,
      () => window.gameModel.experimentalReplayOpen$,
      (open) => {
        this.experimentalReplayOpen = open;
        this.syncExternalClasses();
      },
    );
    subscribe(
      this,
      () => window.gameModel.clockwise$,
      (clockwise) => {
        this.clockwise = clockwise;
        this.syncExternalClasses();
      },
    );
    subscribe(
      this,
      () => window.gameModel.squareTable$,
      (squareTable) => {
        this.squareTable = squareTable;
        this.syncExternalClasses();
      },
    );
    subscribe(
      this,
      () => window.gameModel.theme$,
      (theme) => {
        this.theme = theme;
        this.syncExternalClasses();
      },
    );
    subscribe(
      this,
      () => window.gameModel.isTiki$,
      (isTiki) => {
        this.isTiki = isTiki;
        this.syncExternalClasses();
      },
    );
    subscribe(
      this,
      () => window.gameModel.betAnimations$,
      (anims) => (this.betAnimations = anims),
    );
    subscribe(
      this,
      () => window.gameModel.concede$,
      (concede) => (this.concede = concede),
    );
    subscribe(
      this,
      () => window.gameModel.players$,
      (players) => (this.players = players),
    );
    subscribe(
      this,
      () => window.gameModel.currentPlayerId$,
      (currentPlayerId) => (this.currentPlayerId = currentPlayerId),
    );
    subscribe(
      this,
      () => window.gameModel.isSpectator$,
      (isSpectator) => (this.isSpectator = isSpectator),
    );
    subscribe(
      this,
      () => window.gameModel.stateName$,
      (stateName) => (this.stateName = stateName),
    );
    subscribe(
      this,
      () => window.gameModel.round$,
      (round) => (this.round = round),
    );
  }

  private isReadOnly(): boolean {
    const ui = (window as any).gameui;
    if (ui && typeof ui.isReadOnly === "function") {
      return Boolean(ui.isReadOnly());
    }
    return (
      this.isSpectator ||
      typeof (window as any).g_replayFrom !== "undefined" ||
      Boolean((window as any).g_archive_mode)
    );
  }

  private onRespondConcede(accept: boolean, e: Event) {
    e.preventDefault();
    e.stopPropagation();
    const ui = (window as any).gameui;
    if (ui && typeof ui.onRespondConcede === "function") {
      ui.onRespondConcede(accept, e);
    }
  }

  private renderConcedeBanner() {
    if (this.isReadOnly()) return nothing;
    const concedeUi = getConcedeUiState({
      concede: this.concede,
      players: this.players,
      currentPlayerId: this.currentPlayerId,
      isSpectator: this.isSpectator,
      stateName: this.stateName,
      round: this.round,
    });
    if (!concedeUi.isPartnerPrompted && !concedeUi.isProposer) {
      return nothing;
    }

    const msg = concedeUi.isPartnerPrompted
      ? substituteTemplate(_("${player_name} proposes to concede the match."), {
          player_name: concedeUi.proposerName,
        })
      : substituteTemplate(_("Waiting for ${player_name} to respond to your concede proposal."), {
          player_name: concedeUi.partnerName,
        });

    return html`
      <div id="concede-banner" role="status" aria-live="polite">
        <span class="concede-banner-msg">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
            <line x1="4" y1="22" x2="4" y2="15"></line>
          </svg>
          <span>${msg}</span>
        </span>
        <div class="concede-banner-actions">
          ${
            concedeUi.isPartnerPrompted
              ? html`
                  <button
                    type="button"
                    id="concede_accept_btn"
                    class="concede-action-btn primary"
                    @click=${(e: Event) => this.onRespondConcede(true, e)}
                  >
                    ${_("Accept Concede")}
                  </button>
                  <button
                    type="button"
                    id="concede_decline_btn"
                    class="concede-action-btn"
                    @click=${(e: Event) => this.onRespondConcede(false, e)}
                  >
                    ${_("Decline")}
                  </button>
                `
              : html`
                  <button
                    type="button"
                    id="concede_cancel_btn"
                    class="concede-action-btn"
                    @click=${(e: Event) => this.onRespondConcede(false, e)}
                  >
                    ${_("Cancel")}
                  </button>
                `
          }
        </div>
      </div>
    `;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.syncExternalClasses();
    if (
      typeof document !== "undefined" &&
      document.body &&
      !document.querySelector("tichu-trick-modal")
    ) {
      document.body.appendChild(document.createElement("tichu-trick-modal"));
    }
    if (
      typeof document !== "undefined" &&
      document.body &&
      !document.querySelector("tichu-settings-modal")
    ) {
      document.body.appendChild(document.createElement("tichu-settings-modal"));
    }
    if (
      typeof document !== "undefined" &&
      document.body &&
      !document.querySelector("tichu-score-modal")
    ) {
      document.body.appendChild(document.createElement("tichu-score-modal"));
    }
    getAnimationLayer();
    getTooltipLayer();
  }

  private syncExternalClasses() {
    if (typeof document === "undefined") return;
    const targets = [
      document.documentElement,
      document.getElementById("overall-content"),
      document.getElementById("game_play_area"),
      document.body,
    ];

    for (const el of targets) {
      if (!el) continue;
      for (const n of THEME_NUMBERS) {
        el.classList.toggle(`theme${n}`, this.theme === n);
      }
      el.classList.toggle("tiki", this.isTiki);
      el.classList.toggle("clockwise", this.clockwise);
      el.classList.toggle("squareTable", this.squareTable);
      el.classList.toggle("listTable", !this.squareTable);
    }
  }

  override render() {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    this.style.setProperty("--ui-icons-url", `url(${themeUrl}img/tichu-ui-icons.png)`);

    const rootClasses: Record<string, boolean> = {
      tiki: this.isTiki,
      clockwise: this.clockwise,
      squareTable: this.squareTable,
      listTable: !this.squareTable,
    };
    for (const n of THEME_NUMBERS) {
      rootClasses[`theme${n}`] = this.theme === n;
    }

    if (this.experimentalReplayOpen) {
      return html`
        <div id="tichu-game-root" class=${classMap(rootClasses)}>
          <tichu-replay
            @exit=${() => window.gameModel.setExperimentalReplayOpen(false)}
          ></tichu-replay>
        </div>
      `;
    }

    return html`
      <div id="tichu-game-root" class=${classMap(rootClasses)}>
        ${this.betAnimations.map(
          (anim) => html`
            <div
              id="temp_${anim.playerId}"
              class=${classMap({
                icon: true,
                temp: true,
                "grand-tichu-color": anim.bet === 200,
                grandtichucolor: anim.bet === 200,
                "tichu-color": anim.bet !== 200,
                tichucolor: anim.bet !== 200,
                "fading-out": anim.fadingOut,
              })}
            ></div>
          `,
        )}
        ${this.renderConcedeBanner()}
        <tichu-value-choice mode="mahjong"></tichu-value-choice>
        <tichu-value-choice mode="phoenix"></tichu-value-choice>
        <tichu-last-played></tichu-last-played>
        <tichu-pass-area></tichu-pass-area>
        <tichu-hand></tichu-hand>
        <tichu-played-cards></tichu-played-cards>
      </div>
    `;
  }
}

customElements.define("tichu-game", TichuGame);
