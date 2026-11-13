import { html, css, LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import { LivePlayer } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";

const t = (s: string) => (typeof _ === "function" ? _(s) : s);

export class TichuPlayerPanel extends LitElement {
  @property({ type: String }) playerId = "";

  @state() private players: Record<string, LivePlayer> = {};
  @state() private player?: LivePlayer;
  @state() private firstOutPlayerId = "";

  static override get styles() {
    return [
      styles,
      css`
        :host {
          display: block;
          clear: both;
        }
        .ha_board {
          clear: both;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          padding-top: 4px;
          font-weight: 600;
          color: #1f2328;
        }
        .ha_board .count {
          margin-right: 8px;
        }
        .ha_board .icon:not(.hand):not(.star) {
          margin-right: 4px;
        }
      `,
    ];
  }

  constructor() {
    super();
    subscribe(
      this,
      () => window.gameModel.players$,
      (players) => {
        this.players = players;
        this.player = players[String(this.playerId)];
      },
    );
    subscribe(
      this,
      () => window.gameModel.firstOutPlayerId$,
      (firstOutPlayerId) => {
        this.firstOutPlayerId = firstOutPlayerId;
      },
    );
  }

  override willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("playerId")) {
      this.player = this.players[String(this.playerId)];
    }
  }

  override render() {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    this.style.setProperty("--icon-url", `url(${themeUrl}img/tichu-icons.png)`);

    const id = String(this.playerId);
    const p = this.player ?? this.players[id];
    const handcount = p?.handcount ?? 0;
    const capturedPoints = p?.capturedPoints ?? 0;
    const showGrandTichuColor = p?.callGrandTichu === 200;
    const showGrandTichuBlack = p?.callGrandTichu === -1;
    const showTichuColor = p?.callTichu === 100;
    const showTichuBlack = p?.callTichu === -1 && !showGrandTichuColor;
    const isFirstOut = Boolean(id) && this.firstOutPlayerId === id;
    const isPassReady = Boolean(p?.passedCardReady);

    return html`
      <div class="ha_board">
        <div class="icon hand" title=${t("Cards in hand")}></div>
        &#x00D7;<span id="handcount_${id}" class="count handcount ${id}" title=${t("Cards in hand")}
          >${handcount}</span
        >
        <div class="icon star" title=${t("Points captured")}></div>
        &#x00D7;<span
          id="pointcount_${id}"
          class="count pointcount ${id}"
          title=${t("Points captured")}
          >${capturedPoints}</span
        >
        <div
          id="grandtichublack_${id}"
          class="icon grandtichublack ${id}"
          style="display: ${showGrandTichuBlack ? "inline-block" : "none"}"
          title=${t("Grand Tichu bet yet to be made")}
        ></div>
        <div
          id="grandtichucolor_${id}"
          class="icon grandtichucolor ${id}"
          style="display: ${showGrandTichuColor ? "inline-block" : "none"}"
          title=${t("Grand Tichu bet")}
        ></div>
        <div
          id="tichublack_${id}"
          class="icon tichublack ${id}"
          style="display: ${showTichuBlack ? "inline-block" : "none"}"
          title=${t("Tichu bet yet to be made")}
        ></div>
        <div
          id="tichucolor_${id}"
          class="icon tichucolor ${id}"
          style="display: ${showTichuColor ? "inline-block" : "none"}"
          title=${t("Tichu bet")}
        ></div>
        <div
          id="firstoutcolor_${id}"
          class="icon firstoutcolor ${id}"
          style="display: ${isFirstOut ? "inline-block" : "none"}"
          title=${t("First player out")}
        ></div>
        <div
          id="cardback_${id}"
          class="icon cardback ${id}"
          style="display: ${isPassReady ? "inline-block" : "none"}"
          title=${t("has passed")}
        ></div>
      </div>
    `;
  }
}

customElements.define("tichu-player-panel", TichuPlayerPanel);
