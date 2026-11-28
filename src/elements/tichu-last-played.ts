import { html, css, LitElement, PropertyValues } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Card, LastComboState, LivePlayer, PassSlotState } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";
import { ANIM_TIMINGS } from "./anim-timings";
import { getPlayAreaZoomFactor } from "./tichu-animation-layer";
import "./tichu-status";
import "./tichu-stock";
import type { TichuStock } from "./tichu-stock";

const POSITIONS = ["bottom", "right", "top", "left"] as const;

export class TichuLastPlayed extends LitElement {
  @state() private playerOrderBottomToLeft: string[] = [];
  @state() private players: Record<string, LivePlayer> = {};
  @state() private lastCombos: Record<string, LastComboState> = {};
  @state() private lastComboPlayerId = "";
  @state() private activePlayerId = "";
  @state() private bombActivePlayerId: string | null = null;
  @state() private stateName = "";
  @state() private isSpectator = false;
  @state() private passSlots: PassSlotState[] = [];
  @state() private mahjongWish = 0;
  @state() private isTiki = false;
  @state() private clockwise = true;
  @state() private squareTable = true;
  @state() private firstOutPlayerId = "";
  @state() private round = 0;
  @state() private trick = 0;
  @state() private currentTrickValue = 0;
  @state() private currentTrick: Card[] = [];
  @state() private winningHighlightPlayerId: string | null = null;
  @state() private pendingRevealByPlayer: Record<string, string[]> = {};
  @state() private hideAllForSweep = false;
  @state() private compactLayout = false;
  @state() private narrowCards = false;
  @state() private failedAvatarKeys: Set<string> = new Set();

  private resizeObserver?: ResizeObserver;

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
          line-height: 1.35;
          font-size: 16px;
          font-weight: bold;
          border: 2px solid var(--tichu-surface-border, rgba(255, 255, 255, 0.55));
          padding: 8px 10px;
          background: var(--tichu-surface-bg, var(--bg-color-lighter));
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: var(--border-radius, 8px);
          box-shadow: var(--tichu-surface-shadow, var(--elevation));
        }
        .last-played-container.active,
        .last-played-container.bomb {
          border: 2px solid var(--tichu-active-border, var(--bg-color-active, #dc2626));
          background: var(
            --tichu-surface-active-bg,
            var(--tichu-surface-bg, var(--bg-color-lighter))
          );
          box-shadow: var(
            --tichu-active-shadow,
            0 0 0 3px var(--tichu-active-glow, rgba(220, 38, 38, 0.22)),
            0 8px 22px rgba(15, 23, 42, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.85)
          );
        }
        .last-played-container.winning-linger {
          box-shadow: 0 0 16px rgba(251, 191, 36, 0.8);
          border-color: rgba(251, 191, 36, 0.95);
          transition:
            box-shadow var(--tichu-winning-linger-ms, 100ms) ease,
            border-color var(--tichu-winning-linger-ms, 100ms) ease;
        }
        @media (prefers-reduced-motion: reduce) {
          .last-played-container.winning-linger {
            transition: none;
          }
        }
        @media (forced-colors: active) {
          .last-played-container {
            border-color: CanvasText;
          }
          .last-played-container.active,
          .last-played-container.bomb {
            border-color: Highlight;
            outline: 2px solid Highlight;
          }
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
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.015em;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .last-played-player .last-played-icons {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }
        .last-played-player .last-played-icons .count {
          display: inline-block;
          font-size: 14.5px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--tichu-text-muted, #334155);
          min-width: 24px;
        }
        .last-played-player .stat-group {
          display: inline;
        }
        .last-played-player .last-played-bets {
          line-height: 0;
        }
        .last-played-combo {
          display: flex;
          align-items: center;
          width: 300px;
          min-height: 112.5px;
          flex-grow: 1;
        }
        .last-played-combo > tichu-stock {
          flex: 1;
          min-width: 0;
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

        /* Compact responsive layout (< 720px) */
        #card-last-played-area.compact {
          padding: 0 6px 8px 6px;
          grid-gap: 6px;
        }
        #card-last-played-area.compact:not(.squareTable) {
          grid-template-columns: minmax(0, 1fr) 60px;
          grid-template-rows: auto auto auto auto;
        }
        #card-last-played-area.squareTable.compact {
          grid-template-columns: 60px minmax(0, 1fr) minmax(0, 1fr) 60px;
          grid-template-rows: auto auto auto;
        }
        #card-last-played-area.squareTable.compact .top {
          grid-column: 2 / span 2;
          grid-row: 1 / span 1;
        }
        #card-last-played-area.squareTable.compact .left {
          grid-column: 1 / span 2;
          grid-row: 2 / span 1;
        }
        #card-last-played-area.clockwise.squareTable.compact .left {
          grid-column: 3 / span 2;
        }
        #card-last-played-area.squareTable.compact .right {
          grid-column: 3 / span 2;
          grid-row: 2 / span 1;
        }
        #card-last-played-area.clockwise.squareTable.compact .right {
          grid-column: 1 / span 2;
        }
        #card-last-played-area.squareTable.compact .bottom {
          grid-column: 2 / span 2;
          grid-row: 3 / span 1;
        }
        #card-last-played-area.squareTable.compact #mahjongIndicator {
          grid-column: 1 / span 1;
          grid-row: 1 / span 1;
        }
        #card-last-played-area.squareTable.compact tichu-status {
          grid-column: 4 / span 1;
          grid-row: 1 / span 1;
          place-self: start end;
        }
        #card-last-played-area.compact #mahjongIndicator,
        #card-last-played-area.compact #mahjongIndicator .mahjong {
          width: 54px;
          height: 81px;
        }
        #card-last-played-area.compact #mahjongIndicator {
          background-size: 54px 81px;
        }
        #card-last-played-area.compact #mahjongIndicator .mahjong {
          background-size: 432px 162px;
        }
        .compact .last-played-container {
          flex-direction: column;
          padding: 5px 6px;
          gap: 4px;
          min-width: 0;
          border-radius: var(--border-radius, 8px);
        }
        .compact .last-played-player {
          display: flex;
          align-items: center;
          gap: 4px;
          width: 100%;
          padding-right: 0;
          box-sizing: border-box;
          min-width: 0;
          line-height: 1;
        }
        .lp-avatar-wrap {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          box-sizing: border-box;
          background: #334155;
        }
        .lp-avatar-wrap.teammate {
          border: 2px solid #0f9d58;
        }
        .lp-avatar-wrap.opponent {
          border: 2px solid #475569;
        }
        .lp-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          border-radius: 50%;
        }
        .lp-avatar-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #ffffff;
          text-transform: uppercase;
          user-select: none;
        }
        .lp-avatar-wrap.teammate .lp-avatar-fallback {
          background: #0f9d58;
        }
        .lp-avatar-wrap.opponent .lp-avatar-fallback {
          background: #334155;
        }
        .compact .last-played-player .last-played-icons {
          gap: 5px;
          margin-bottom: 0;
          flex-shrink: 0;
        }
        .compact .last-played-player .stat-group {
          display: inline-flex;
          align-items: center;
          gap: 2px;
        }
        .compact .last-played-player .icon.hand,
        .compact .last-played-player .icon.star {
          --icon-size: 15px;
          vertical-align: middle;
        }
        .compact .last-played-player .last-played-icons .count {
          font-size: 12.5px;
          min-width: auto;
          line-height: 1;
        }
        .compact .last-played-badges {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }
        .compact .last-played-badges .icon {
          --icon-size: 20px;
          display: inline-block;
        }
        .compact .last-played-combo {
          width: 100%;
          min-width: 0;
          min-height: 112.5px;
          justify-content: center;
        }
        .compact .last-played-combo > tichu-stock {
          --stock-justify: center;
        }
        .compact .last-played-combo .pass {
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .compact .last-played-combo .pass > tichu-stock {
          width: 100%;
          --stock-justify: center;
        }
        .compact.narrow-cards .last-played-combo {
          min-height: 90px;
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
      () => window.gameModel.isSpectator$,
      (isSpectator) => (this.isSpectator = isSpectator),
    );
    subscribe(
      this,
      () => window.gameModel.passSlots$,
      (slots) => (this.passSlots = slots),
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
      () => window.gameModel.firstOutPlayerId$,
      (firstOutPlayerId) => (this.firstOutPlayerId = firstOutPlayerId),
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

  override connectedCallback() {
    super.connectedCallback();
    this.updateResponsiveMode(this.clientWidth);
    if (typeof ResizeObserver !== "undefined" && !this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        const entryWidth = entries[0]?.contentRect?.width;
        const w = typeof entryWidth === "number" && entryWidth > 0 ? entryWidth : this.clientWidth;
        this.updateResponsiveMode(w);
      });
      this.resizeObserver.observe(this);
    }
  }

  override disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    super.disconnectedCallback();
  }

  private updateResponsiveMode(width: number) {
    if (!width || width <= 0) return;
    const nextCompact = width < 720;
    const nextNarrow = width < 560;
    if (nextCompact !== this.compactLayout) {
      this.compactLayout = nextCompact;
    }
    if (nextNarrow !== this.narrowCards) {
      this.narrowCards = nextNarrow;
    }
  }

  private onAvatarError(avatarKey: string) {
    if (this.failedAvatarKeys.has(avatarKey)) return;
    const next = new Set(this.failedAvatarKeys);
    next.add(avatarKey);
    this.failedAvatarKeys = next;
  }

  override render() {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    this.style.setProperty("--ui-icons-url", `url(${themeUrl}img/tichu-ui-icons.png)`);
    this.style.setProperty("--table-icons-url", `url(${themeUrl}img/tichu-icons-table.png)`);
    this.style.setProperty("--mahjong-bg-url", `url(${themeUrl}img/tichu-mahjong.png)`);
    this.style.setProperty("--tiki-mahjong-bg-url", `url(${themeUrl}img/tiki-tichu-mahjong.png)`);

    const hasPendingPassCards =
      !this.isSpectator &&
      this.passSlots.some(
        (s) => s.givenCard !== null || s.receivedCard !== null || s.animatingAccept,
      );
    const isPassState =
      this.stateName === "giveCards" ||
      this.stateName === "showPassedCards" ||
      this.stateName === "acceptPassedCards" ||
      hasPendingPassCards;

    const wishVisible = this.mahjongWish >= 2 && this.mahjongWish <= 14;
    const wishIdx = wishVisible ? this.mahjongWish - 2 : 0;
    const wishCol = wishIdx % 7;
    const wishRow = Math.floor(wishIdx / 7);
    const mjW = this.compactLayout ? 54 : 75;
    const mjH = this.compactLayout ? 81 : 112.5;

    return html`
      <div
        id="card-last-played-area"
        class=${classMap({
          squareTable: this.squareTable,
          clockwise: this.clockwise,
          tiki: this.isTiki,
          compact: this.compactLayout,
          "narrow-cards": this.narrowCards,
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
                  style="background-position: -${wishCol * mjW}px -${wishRow * mjH}px"
                ></div>`
              : ""
          }
        </div>

        <tichu-status
          ?compact=${this.compactLayout}
          roundCount=${this.round}
          trickCount=${this.trick}
          trickPoints=${this.currentTrickValue}
          trickSize=${this.currentTrick.length}
          .roundCount=${this.round}
          .trickCount=${this.trick}
          .trickPoints=${this.currentTrickValue}
          .trickSize=${this.currentTrick.length}
          @show-current-trick=${this.onShowCurrentTrick}
          @show-scores=${this.onShowScores}
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
    const showGrandTichuBlack = player.callGrandTichu === -1;
    const showTichuColor = player.callTichu === 100;
    const showTichuBlack = player.callTichu === -1 && !showGrandTichuColor;
    const isFirstOut = Boolean(id) && this.firstOutPlayerId === id;
    const stockScale = this.narrowCards ? 0.6 : 0.75;

    const avatarUrl = player.avatarUrl ?? "";
    const avatarKey = `${id}|${avatarUrl}`;
    const showImg = Boolean(avatarUrl) && !this.failedAvatarKeys.has(avatarKey);
    const initial = (String(player.name || "").trim()[0] ?? "?").toUpperCase();
    const isTeammate = !this.isSpectator && (pos === "bottom" || pos === "top");
    const spectatorBorderStyle = this.isSpectator
      ? `border-color: #${String(player.color || "475569").replace(/^#/, "")}`
      : "";

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
          "winning-linger": this.winningHighlightPlayerId === id,
        })}
        id="playertable_${id}"
        data-player-id=${id}
      >
        <div class="disabler" style="display: ${isDisablerVisible ? "block" : "none"}"></div>
        ${
          this.compactLayout
            ? html`
                <div class="last-played-player">
                  <div
                    class=${classMap({
                      "lp-avatar-wrap": true,
                      teammate: isTeammate,
                      opponent: !isTeammate,
                    })}
                    style=${spectatorBorderStyle}
                    data-tooltip=${player.name}
                    data-tooltip-touch="tap"
                    aria-label=${player.name}
                  >
                    ${
                      showImg
                        ? html`<img
                            class="lp-avatar-img"
                            src=${avatarUrl}
                            alt=""
                            width="22"
                            height="22"
                            @error=${() => this.onAvatarError(avatarKey)}
                          />`
                        : html`<span class="lp-avatar-fallback" aria-hidden="true"
                            >${initial}</span
                          >`
                    }
                  </div>
                  <div class="last-played-icons">
                    <span
                      class="stat-group"
                      data-tooltip=${_("Cards in hand")}
                      data-tooltip-touch="tap"
                    >
                      <div class="icon hand" id="icon_hand_${id}"></div>
                      <div class="count handcount ${id}">${player.handcount}</div>
                    </span>
                    <span
                      class="stat-group"
                      data-tooltip=${_("Points captured")}
                      data-tooltip-touch="tap"
                    >
                      <div class="icon star" id="icon_star_${id}"></div>
                      <div class="count pointcount ${id}">${player.capturedPoints}</div>
                    </span>
                  </div>
                  <div class="last-played-badges">
                    ${
                      showGrandTichuColor
                        ? html`<div
                            id="grandtichucolor_${id}"
                            class="icon grandtichucolor ${id}"
                            data-tooltip=${_("Grand Tichu bet")}
                            data-tooltip-touch="tap"
                          ></div>`
                        : showGrandTichuBlack
                          ? html`<div
                              id="grandtichublack_${id}"
                              class="icon grandtichublack ${id}"
                              data-tooltip=${_("Grand Tichu bet yet to be made")}
                              data-tooltip-touch="tap"
                            ></div>`
                          : ""
                    }
                    ${
                      showTichuColor
                        ? html`<div
                            id="tichucolor_${id}"
                            class="icon tichucolor ${id}"
                            data-tooltip=${_("Tichu bet")}
                            data-tooltip-touch="tap"
                          ></div>`
                        : showTichuBlack
                          ? html`<div
                              id="tichublack_${id}"
                              class="icon tichublack ${id}"
                              data-tooltip=${_("Tichu bet yet to be made")}
                              data-tooltip-touch="tap"
                            ></div>`
                          : ""
                    }
                    ${
                      isFirstOut
                        ? html`<div
                            id="firstoutcolor_${id}"
                            class="icon firstoutcolor ${id}"
                            data-tooltip=${_("First player out")}
                            data-tooltip-touch="tap"
                          ></div>`
                        : ""
                    }
                  </div>
                </div>
              `
            : html`
                <div class="last-played-player">
                  <div class="playertablename" style=${this.getPlayerNameColorStyle(player.color)}>
                    ${player.name}
                  </div>
                  <div class="last-played-icons">
                    <span
                      class="stat-group"
                      data-tooltip=${_("Cards in hand")}
                      data-tooltip-touch="tap"
                    >
                      <div class="icon hand" id="icon_hand_${id}"></div>
                      <div class="count handcount ${id}">${player.handcount}</div>
                    </span>
                    <span
                      class="stat-group"
                      data-tooltip=${_("Points captured")}
                      data-tooltip-touch="tap"
                    >
                      <div class="icon star" id="icon_star_${id}"></div>
                      <div class="count pointcount ${id}">${player.capturedPoints}</div>
                    </span>
                  </div>
                  <div class="last-played-bets">
                    <div
                      id="grandtichucolor_${id}"
                      class="icon big grandtichucolor ${id}"
                      style="display: ${showGrandTichuColor ? "inline-block" : "none"}"
                      data-tooltip=${_("Grand Tichu bet")}
                      data-tooltip-touch="tap"
                    ></div>
                    <div
                      id="tichucolor_${id}"
                      class="icon big tichucolor ${id}"
                      style="display: ${showTichuColor ? "inline-block" : "none"}"
                      data-tooltip=${_("Tichu bet")}
                      data-tooltip-touch="tap"
                    ></div>
                  </div>
                </div>
              `
        }
        <div id="lastcombo_${id}" class="lastcombo last-played-combo">
          ${
            combo.passed
              ? html`<span class="pass"
                  ><tichu-stock
                    data-player-id=${id}
                    .cards=${[]}
                    .pass=${true}
                    .scale=${stockScale}
                    .tiki=${this.isTiki}
                    .hideAllCards=${this.hideAllForSweep}
                  ></tichu-stock
                ></span>`
              : html`<tichu-stock
                  data-player-id=${id}
                  .cards=${combo.cards}
                  .scale=${stockScale}
                  .disableCardTooltips=${true}
                  sortMode="preserve"
                  .tiki=${this.isTiki}
                  .dynamicOverlap=${true}
                  .externalHiddenIds=${this.pendingRevealByPlayer[id] ?? []}
                  .hideAllCards=${this.hideAllForSweep}
                ></tichu-stock>`
          }
        </div>
      </div>
    `;
  }

  protected override willUpdate(changedProperties: PropertyValues) {
    super.willUpdate(changedProperties);
    const stateReset =
      changedProperties.has("stateName") &&
      (this.stateName === "newTrick" ||
        this.stateName === "newRound" ||
        this.stateName === "playComboOpen" ||
        this.stateName === "endRound");
    if (stateReset || changedProperties.has("trick")) {
      this.hideAllForSweep = false;
      this.winningHighlightPlayerId = null;
      this.pendingRevealByPlayer = {};
    }
  }

  getPlayerStock(playerId: string | number): TichuStock | null {
    const id = String(playerId);
    return (
      (this.shadowRoot?.querySelector(
        `tichu-stock[data-player-id="${id}"]`,
      ) as TichuStock | null) ?? null
    );
  }

  getComboCardRects(
    playerId: string | number,
    cardIds?: Array<string | number>,
  ): Map<number, DOMRect> {
    return this.getPlayerStock(playerId)?.getCardRects(cardIds) ?? new Map();
  }

  markPendingReveal(playerId: string | number, cardIds: Array<string | number>): void {
    this.hideAllForSweep = false;
    const id = String(playerId);
    const existing = new Set(this.pendingRevealByPlayer[id] ?? []);
    for (const cid of cardIds) {
      existing.add(String(cid));
    }
    this.pendingRevealByPlayer = {
      ...this.pendingRevealByPlayer,
      [id]: Array.from(existing),
    };
  }

  private syncClearPendingRevealDom(
    targetPlayerId?: string,
    cardIds?: Array<string | number>,
  ): void {
    if (!this.shadowRoot?.querySelectorAll) return;
    const stocks =
      targetPlayerId !== undefined
        ? ([this.getPlayerStock(targetPlayerId)].filter(Boolean) as TichuStock[])
        : Array.from(this.shadowRoot.querySelectorAll<TichuStock>("tichu-stock[data-player-id]"));
    const filter = cardIds ? new Set(cardIds.map(String)) : null;
    for (const stock of stocks) {
      if (!stock.shadowRoot?.querySelectorAll) continue;
      const nodes = Array.from(
        stock.shadowRoot.querySelectorAll<HTMLElement>("tichu-card[data-pending-reveal]"),
      );
      for (const el of nodes) {
        const cid = el.getAttribute("data-card-id") ?? "";
        if (!filter || filter.has(cid)) {
          el.removeAttribute("data-pending-reveal");
        }
      }
    }
  }

  revealCards(playerId?: string | number, cardIds?: Array<string | number>): void {
    if (playerId === undefined) {
      this.hideAllForSweep = false;
      this.pendingRevealByPlayer = {};
      this.syncClearPendingRevealDom();
      return;
    }
    const id = String(playerId);
    this.syncClearPendingRevealDom(id, cardIds);
    if (!cardIds) {
      const copy = { ...this.pendingRevealByPlayer };
      delete copy[id];
      this.pendingRevealByPlayer = copy;
      return;
    }
    const removeSet = new Set(cardIds.map(String));
    const current = this.pendingRevealByPlayer[id];
    if (!current || current.length === 0) return;
    const remaining = current.filter((cid) => !removeSet.has(cid));
    const copy = { ...this.pendingRevealByPlayer };
    if (remaining.length > 0) {
      copy[id] = remaining;
    } else {
      delete copy[id];
    }
    this.pendingRevealByPlayer = copy;
  }

  getAllTableComboCards(): Array<{ playerId: string; card: Card; rect: DOMRect; pass?: boolean }> {
    const result: Array<{ playerId: string; card: Card; rect: DOMRect; pass?: boolean }> = [];
    if (!this.shadowRoot) return result;
    const stocks = Array.from(
      this.shadowRoot.querySelectorAll<TichuStock>("tichu-stock[data-player-id]"),
    );
    for (const stock of stocks) {
      const pid = stock.getAttribute("data-player-id");
      if (!pid) continue;
      if (stock.pass) {
        const rect = stock.getPassCardRect();
        if (rect) {
          result.push({
            playerId: pid,
            card: { id: `pass_${pid}`, type: "0", type_arg: "0" },
            rect,
            pass: true,
          });
        }
        continue;
      }
      const rectMap = stock.getCardRects();
      for (const card of stock.cards) {
        const rect = rectMap.get(Number(card.id));
        if (rect) {
          result.push({ playerId: pid, card, rect });
        }
      }
    }
    return result;
  }

  hideAllComboCards(): void {
    this.hideAllForSweep = true;
  }

  setWinningComboHighlight(playerId: string | number | null): void {
    this.winningHighlightPlayerId = playerId !== null ? String(playerId) : null;
  }

  getPlayerHandIconRect(playerId: string | number): DOMRect | null {
    return this.getIconAnchorRect(`icon_hand_${playerId}`, ANIM_TIMINGS.opponentStartScale);
  }

  getPlayerPointsIconRect(playerId: string | number): DOMRect | null {
    return this.getIconAnchorRect(`icon_star_${playerId}`, 0.36);
  }

  private getIconAnchorRect(elementId: string, scale = 0.36): DOMRect | null {
    const el = this.shadowRoot?.getElementById(elementId);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    const zoom = getPlayAreaZoomFactor();
    const baseW = Math.round(100 * scale * 100) / 100;
    const w = baseW * zoom;
    const h = baseW * 1.5 * zoom;
    return new DOMRect(
      rect.left + rect.width / 2 - w / 2,
      rect.top + rect.height / 2 - h / 2,
      w,
      h,
    );
  }

  getSeatAnchorRect(playerId: string | number): DOMRect | null {
    const id = String(playerId);
    const el =
      this.shadowRoot?.getElementById(`lastcombo_${id}`) ??
      this.shadowRoot?.getElementById(`playertable_${id}`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    const zoom = getPlayAreaZoomFactor();
    const cardScale = this.narrowCards ? 0.6 : 0.75;
    const w = 100 * cardScale * zoom;
    const h = 150 * cardScale * zoom;
    return new DOMRect(
      rect.left + rect.width / 2 - w / 2,
      rect.top + rect.height / 2 - h / 2,
      w,
      h,
    );
  }

  getDeckOriginRect(): DOMRect | null {
    const area =
      this.shadowRoot?.getElementById("card-last-played-area") ??
      this.shadowRoot?.querySelector("tichu-status") ??
      this;
    const rect = area.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    const zoom = getPlayAreaZoomFactor();
    const w = 65 * zoom;
    const h = 97.5 * zoom;
    return new DOMRect(
      rect.left + rect.width / 2 - w / 2,
      rect.top + rect.height / 2 - h / 2,
      w,
      h,
    );
  }

  private getPlayerNameColorStyle(hexColor: string): string {
    const clean = String(hexColor || "000000")
      .replace(/^#/, "")
      .toLowerCase();
    if (clean === "000000" || clean === "000") {
      return `color: var(--tichu-team-dark-fg, #${clean})`;
    }
    if (clean === "ff0000" || clean === "cc0000" || clean === "e00000" || clean === "f00") {
      return `color: var(--tichu-team-red-fg, #${clean})`;
    }
    return `color: #${clean}`;
  }

  private onShowCurrentTrick() {
    window.gameModel.setTrickModalOpen(true);
  }

  private onShowScores() {
    window.gameModel.setScoreModalOpen(true);
  }
}

customElements.define("tichu-last-played", TichuLastPlayed);
