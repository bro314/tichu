import { html, css, LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import { LivePlayer } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";

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
          display: flow-root;
          clear: both;
          color: var(--game-bga-player-panel-color, #000);
        }
        .ha_board {
          display: flex;
          align-items: center;
          gap: 4px;
          block-size: 28px;
          margin-block-start: 8px;
          margin-inline: 4px;
        }
        .panel-stats {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 0 0 auto;
          min-inline-size: 96px;
        }
        .panel-bets {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          flex: 1 1 auto;
          min-inline-size: 0;
        }
        .panel-pass {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex: 0 0 28px;
        }
        .icon-slot {
          display: flex;
          align-items: center;
          justify-content: center;
          inline-size: 28px;
          block-size: 28px;
          flex: 0 0 28px;
        }
        .stat-group {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          flex-shrink: 0;
        }
        .icon {
          flex-shrink: 0;
        }
        .count {
          line-height: 1;
          font-variant-numeric: tabular-nums;
          text-box: trim-both cap alphabetic;
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

  getBadgeRect(): DOMRect | null {
    const anchor =
      this.shadowRoot?.querySelector(".icon.hand") ??
      this.shadowRoot?.querySelector(".ha_board") ??
      this;
    const rect = anchor.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    const areaWrap = document.getElementById("game_play_area_wrap");
    let zoom = 1;
    if (areaWrap) {
      const m = areaWrap.style.transform.match(/scale\(([^)]+)\)/);
      if (m && m[1]) {
        const parsed = Number(m[1]);
        if (!Number.isNaN(parsed) && parsed > 0) zoom = parsed;
      }
    }
    const w = 50 * zoom;
    const h = 75 * zoom;
    return new DOMRect(
      rect.left + rect.width / 2 - w / 2,
      rect.top + rect.height / 2 - h / 2,
      w,
      h,
    );
  }

  override render() {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    this.style.setProperty("--ui-icons-url", `url(${themeUrl}img/tichu-ui-icons.png)`);

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

    // prettier-ignore
    return html`
      <div class="ha_board">
        <div class="panel-stats">
          <span class="stat-group" data-tooltip=${_("Cards in hand")} data-tooltip-touch="tap"><span class="icon hand"></span><span id="handcount_${id}" class="count handcount ${id}">${handcount}</span></span>
          <span class="stat-group" data-tooltip=${_("Points captured")} data-tooltip-touch="tap"><span class="icon star"></span><span id="pointcount_${id}" class="count pointcount ${id}">${capturedPoints}</span></span>
        </div>
        <div class="panel-bets">
          <div class="icon-slot">
            <div id="grandtichublack_${id}" class="icon grandtichublack ${id}" style="display: ${showGrandTichuBlack ? "block" : "none"}" data-tooltip=${_("Grand Tichu bet yet to be made")} data-tooltip-touch="tap"></div>
            <div id="grandtichucolor_${id}" class="icon grandtichucolor ${id}" style="display: ${showGrandTichuColor ? "block" : "none"}" data-tooltip=${_("Grand Tichu bet")} data-tooltip-touch="tap"></div>
          </div>
          <div class="icon-slot">
            <div id="tichublack_${id}" class="icon tichublack ${id}" style="display: ${showTichuBlack ? "block" : "none"}" data-tooltip=${_("Tichu bet yet to be made")} data-tooltip-touch="tap"></div>
            <div id="tichucolor_${id}" class="icon tichucolor ${id}" style="display: ${showTichuColor ? "block" : "none"}" data-tooltip=${_("Tichu bet")} data-tooltip-touch="tap"></div>
          </div>
          <div class="icon-slot">
            <div id="firstoutcolor_${id}" class="icon firstoutcolor ${id}" style="display: ${isFirstOut ? "block" : "none"}" data-tooltip=${_("First player out")} data-tooltip-touch="tap"></div>
          </div>
        </div>
        <div class="panel-pass">
          <div class="icon-slot">
            <div id="cardback_${id}" class="icon cardback ${id}" style="display: ${isPassReady ? "block" : "none"}" data-tooltip=${_("has passed")} data-tooltip-touch="tap"></div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("tichu-player-panel", TichuPlayerPanel);
