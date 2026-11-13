import { html, css, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import "./game-model";
import { BetAnimation } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";
import "./tichu-value-choice";
import "./tichu-last-played";
import "./tichu-pass-area";
import "./tichu-hand";
import "./tichu-played-cards";
import "./tichu-trick-modal";
import "./tichu-replay";

const THEME_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export class TichuGame extends LitElement {
  @state() private experimentalReplayOpen = false;
  @state() private clockwise = true;
  @state() private squareTable = false;
  @state() private theme = 0;
  @state() private isTiki = false;
  @state() private betAnimations: BetAnimation[] = [];

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
          --bg-color-lighter: rgba(246, 231, 212, 0.8);
          --bg-color-active: rgba(200, 0, 0, 0.9);
        }
        #tichu-game-root {
          position: relative;
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
  }

  private syncExternalClasses() {
    if (typeof document === "undefined") return;
    const targets = [
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
    this.style.setProperty("--icon-url", `url(${themeUrl}img/tichu-icons.png)`);

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
              style="opacity: ${anim.fadingOut ? "0" : "1"}"
            ></div>
          `,
        )}
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
