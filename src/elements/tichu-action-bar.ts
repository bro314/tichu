import { html, css, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import {
  Combo,
  ComboValidationResult,
  PassValidationResult,
  WishBombCallout,
  analyzeSelection,
  getWishBombOnlyCallout,
  substituteTemplate,
  validatePassAction,
} from "./combo-validator";
import {
  Card,
  LivePlayer,
  PassSlotState,
  PendingConfirmTichu,
  TrickLastComboState,
} from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";
import { Bet } from "../types/tichu-contracts";

export class TichuActionBar extends LitElement {
  @state() private stateName = "";
  @state() private isCurrentPlayerActive = false;
  @state() private isSpectator = false;
  @state() private isRealtime = false;
  @state() private currentPlayer: LivePlayer | null = null;
  @state() private players: Record<string, LivePlayer> = {};
  @state() private hand: Card[] = [];
  @state() private selectedCardIds: string[] = [];
  @state() private passSlots: PassSlotState[] = [];
  @state() private mahjongWish = 0;
  @state() private selectedMahjongWish: number | null = null;
  @state() private selectedPhoenixValue: number | null = null;
  @state() private clockwise = true;
  @state() private dragonGiftEnemies: [string, string] | null = null;
  @state() private pendingConfirmTichu: PendingConfirmTichu | null = null;
  @state() private trickLastCombo: TrickLastComboState = {
    playerId: "",
    type: 99,
    cards: [],
    phoenixValue: null,
    description: "",
  };
  @state() private firstOutPlayerId = "";
  @state() private acceptingCardsCountdown = false;
  @state() private collectingTrickCountdown = false;
  @state() private compactMode: "desktop" | "medium" | "mobile" = "desktop";

  private resizeObserver?: ResizeObserver;

  static override get styles() {
    return [
      styles,
      css`
        :host {
          display: block;
        }
        #buttons {
          padding: 10px 15px;
          min-height: 32px;
          box-sizing: content-box;
          display: grid;
          grid-template-columns: repeat(3, minmax(130px, 160px)) minmax(24px, 1fr) repeat(
              2,
              minmax(130px, 160px)
            );
          column-gap: 10px;
          align-items: center;
          background: var(--tichu-bar-bg, var(--bg-color-lighter));
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-top: 1px solid
            var(--tichu-bar-top, var(--tichu-surface-border, rgba(255, 255, 255, 0.55)));
          border-bottom: 1px solid var(--tichu-bar-bottom, rgba(15, 23, 42, 0.1));
          box-shadow: var(
            --tichu-bar-shadow,
            0 2px 10px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.65)
          );
        }
        #buttons > div {
          min-width: 0;
        }
        #buttons h3 {
          margin: 0;
          font-size: 16px;
          line-height: 32px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        #buttons #play_button {
          grid-column: 1;
        }
        #buttons #play_button.countdown {
          grid-column: 1 / 4;
        }
        #buttons #play_button.span-two {
          grid-column: 1 / 3;
        }
        #buttons #play_button.countdown ~ #pass_button,
        #buttons #play_button.countdown ~ #pass_trick_button,
        #buttons #play_button.span-two ~ #pass_button {
          display: none;
        }
        #buttons #pass_button {
          grid-column: 2;
        }
        #buttons #pass_trick_button {
          grid-column: 3;
        }
        #buttons .space1 {
          grid-column: 4;
        }
        #buttons #bomb_button {
          grid-column: 5;
          min-height: 32px;
        }
        #buttons #tichu_button {
          grid-column: 6;
          min-height: 32px;
        }
        #buttons.preplay-bar:not(.compact-mobile) {
          grid-template-columns: minmax(0, 1fr) repeat(3, minmax(130px, 160px));
        }
        #buttons.preplay-bar.compact-medium:not(.compact-mobile) {
          grid-template-columns: minmax(0, 1fr) repeat(3, minmax(110px, 150px));
        }
        #buttons.preplay-bar.give-cards-active:not(.compact-mobile) {
          grid-template-columns: minmax(0, 1fr) minmax(130px, 160px) minmax(165px, 200px) minmax(
              130px,
              160px
            );
        }
        #buttons.preplay-bar.give-cards-active.compact-medium:not(.compact-mobile) {
          grid-template-columns: minmax(0, 1fr) minmax(105px, 145px) minmax(150px, 185px) minmax(
              100px,
              140px
            );
        }
        #buttons.preplay-bar:not(.compact-mobile) #play_button,
        #buttons.preplay-bar:not(.compact-mobile) #pass_button,
        #buttons.preplay-bar:not(.compact-mobile) #pass_trick_button {
          display: none;
        }
        #buttons.preplay-bar:not(.compact-mobile) .space1 {
          grid-column: 2;
        }
        #buttons.preplay-bar:not(.compact-mobile) #bomb_button {
          grid-column: 3;
          min-height: 32px;
        }
        #buttons.preplay-bar:not(.compact-mobile) #tichu_button {
          grid-column: 4;
          min-height: 32px;
        }
        #buttons.dragon-gift-mode {
          grid-template-columns: repeat(2, minmax(220px, 320px)) 1fr;
        }
        #buttons.dragon-gift-mode.compact-medium,
        #buttons.dragon-gift-mode.compact-mobile {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        #buttons.dragon-gift-mode #dragon_before_button {
          grid-column: 1;
          grid-row: 1;
        }
        #buttons.dragon-gift-mode #dragon_after_button {
          grid-column: 2;
          grid-row: 1;
        }
        #buttons.confirm-tichu #confirm_tichu_msg {
          grid-column: 1 / 5;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.25;
          color: var(--tichu-text, #1f2328);
        }
        #buttons.confirm-grand-tichu:not(.compact-mobile) {
          grid-template-columns: minmax(0, 1fr) repeat(3, minmax(130px, 160px));
        }
        #buttons.confirm-grand-tichu.compact-medium:not(.compact-mobile) {
          grid-template-columns: minmax(0, 1fr) repeat(3, minmax(110px, 150px));
        }
        #buttons.confirm-grand-tichu:not(.compact-mobile) #confirm_tichu_msg {
          grid-column: 1;
        }
        #buttons.confirm-grand-tichu:not(.compact-mobile) .space1 {
          grid-column: 2;
        }
        #buttons.confirm-grand-tichu:not(.compact-mobile) #bomb_button {
          grid-column: 3;
          min-height: 32px;
        }
        #buttons.confirm-grand-tichu:not(.compact-mobile) #tichu_button {
          grid-column: 4;
          min-height: 32px;
        }
        :host-context(.lockedInterface) #buttons .bgabutton {
          visibility: hidden;
        }
        #buttons .bgabutton {
          text-align: center;
          margin: 0;
          padding: 7px 10px;
          width: 100%;
          box-sizing: border-box;
          text-shadow: none;
        }
        #wishBombCallout {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          padding: 8px 12px;
          background-color: var(--bg-color-lighter);
          border-top: 1px solid rgba(0, 0, 0, 0.15);
          box-shadow: var(--elevation);
          font-size: 13px;
        }
        #wishBombCallout .callout-msg {
          font-weight: 600;
          margin-right: 6px;
        }
        #buttons.compact-medium {
          padding: 8px 10px;
          column-gap: 6px;
          grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(6px, 0.25fr) repeat(
              2,
              minmax(0, 1fr)
            );
        }
        #buttons.compact-medium .bgabutton {
          padding: 7px 6px;
          font-size: 13px;
        }
        #buttons.compact-mobile {
          padding: 8px 6px;
          column-gap: 6px;
          row-gap: 6px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        #buttons.compact-mobile #play_button {
          grid-column: 1;
          grid-row: 1;
          min-height: 36px;
        }
        #buttons.compact-mobile #play_button.countdown {
          grid-column: 1 / 4;
        }
        #buttons.compact-mobile #play_button.span-two {
          grid-column: 1 / 3;
        }
        #buttons.compact-mobile #pass_button {
          grid-column: 2;
          grid-row: 1;
          min-height: 36px;
        }
        #buttons.compact-mobile #pass_trick_button {
          grid-column: 3;
          grid-row: 1;
          min-height: 36px;
        }
        #buttons.compact-mobile .space1 {
          grid-column: 1;
          grid-row: 2;
          min-height: 36px;
        }
        #buttons.compact-mobile #bomb_button {
          grid-column: 2;
          grid-row: 2;
          min-height: 36px;
        }
        #buttons.compact-mobile #tichu_button {
          grid-column: 3;
          grid-row: 2;
          min-height: 36px;
        }
        #buttons.compact-mobile .bgabutton {
          padding: 8px 4px;
          font-size: 12px;
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        #buttons.compact-mobile.compact-single-row #play_button,
        #buttons.compact-mobile.compact-single-row #pass_button,
        #buttons.compact-mobile.compact-single-row #pass_trick_button {
          display: none;
        }
        #buttons.compact-mobile.compact-single-row .space1,
        #buttons.compact-mobile.compact-single-row #bomb_button,
        #buttons.compact-mobile.compact-single-row #tichu_button {
          grid-row: 1;
        }
        #buttons.compact-mobile.compact-single-row.give-cards-active {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr) minmax(0, 0.85fr);
        }
        #buttons.compact-mobile.compact-two-col-top {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        #buttons.compact-mobile.compact-two-col-top #pass_trick_button,
        #buttons.compact-mobile.compact-two-col-top .space1,
        #buttons.compact-mobile.compact-two-col-top #bomb_button,
        #buttons.compact-mobile.compact-two-col-top #tichu_button {
          display: none;
        }
        #buttons.compact-mobile.compact-top-only .space1,
        #buttons.compact-mobile.compact-top-only #bomb_button,
        #buttons.compact-mobile.compact-top-only #tichu_button {
          display: none;
        }
        #buttons.compact-mobile.confirm-tichu #confirm_tichu_msg {
          grid-column: 1 / 4;
          grid-row: 1;
          min-height: 36px;
          display: flex;
          align-items: center;
          font-size: 12px;
        }
        #buttons.compact-mobile.confirm-tichu #bomb_button {
          grid-column: 1 / 3;
          grid-row: 2;
        }
        #buttons.compact-mobile.confirm-tichu #tichu_button {
          grid-column: 3;
          grid-row: 2;
        }
        #buttons.compact-mobile.confirm-tichu.confirm-preplay.give-cards-active {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr) minmax(0, 0.85fr);
        }
        #buttons.compact-mobile.confirm-tichu.confirm-preplay #bomb_button {
          grid-column: 1 / 3;
          grid-row: 1;
        }
        #buttons.compact-mobile.confirm-tichu.confirm-preplay #tichu_button {
          grid-column: 3;
          grid-row: 1;
        }
        #buttons.compact-mobile.confirm-tichu.confirm-preplay #confirm_tichu_msg {
          grid-column: 1 / 4;
          grid-row: 2;
          min-height: 24px;
        }
        #buttons.compact-mobile.confirm-tichu.confirm-grand-tichu.confirm-preplay .space1 {
          grid-column: 1;
          grid-row: 1;
        }
        #buttons.compact-mobile.confirm-tichu.confirm-grand-tichu.confirm-preplay #bomb_button {
          grid-column: 2;
          grid-row: 1;
        }
        #buttons.compact-mobile.confirm-tichu.confirm-grand-tichu.confirm-preplay #tichu_button {
          grid-column: 3;
          grid-row: 1;
        }
      `,
    ];
  }

  constructor() {
    super();
    subscribe(
      this,
      () => window.gameModel.stateName$,
      (stateName) => (this.stateName = stateName),
    );
    subscribe(
      this,
      () => window.gameModel.isCurrentPlayerActive$,
      (active) => (this.isCurrentPlayerActive = active),
    );
    subscribe(
      this,
      () => window.gameModel.isSpectator$,
      (isSpectator) => (this.isSpectator = isSpectator),
    );
    subscribe(
      this,
      () => window.gameModel.isRealtime$,
      (isRealtime) => (this.isRealtime = isRealtime),
    );
    subscribe(
      this,
      () => window.gameModel.currentPlayer$,
      (player) => (this.currentPlayer = player),
    );
    subscribe(
      this,
      () => window.gameModel.players$,
      (players) => (this.players = players),
    );
    subscribe(
      this,
      () => window.gameModel.hand$,
      (hand) => (this.hand = hand),
    );
    subscribe(
      this,
      () => window.gameModel.selectedCardIds$,
      (ids) => (this.selectedCardIds = ids),
    );
    subscribe(
      this,
      () => window.gameModel.mahjongWish$,
      (wish) => (this.mahjongWish = wish),
    );
    subscribe(
      this,
      () => window.gameModel.trickLastCombo$,
      (lastCombo) => (this.trickLastCombo = lastCombo),
    );
    subscribe(
      this,
      () => window.gameModel.firstOutPlayerId$,
      (id) => (this.firstOutPlayerId = id),
    );
    subscribe(
      this,
      () => window.gameModel.acceptingCardsCountdown$,
      (val) => (this.acceptingCardsCountdown = val),
    );
    subscribe(
      this,
      () => window.gameModel.collectingTrickCountdown$,
      (val) => (this.collectingTrickCountdown = val),
    );
    subscribe(
      this,
      () => window.gameModel.passSlots$,
      (slots) => (this.passSlots = slots),
    );
    subscribe(
      this,
      () => window.gameModel.selectedMahjongWish$,
      (wish) => (this.selectedMahjongWish = wish),
    );
    subscribe(
      this,
      () => window.gameModel.selectedPhoenixValue$,
      (val) => (this.selectedPhoenixValue = val),
    );
    subscribe(
      this,
      () => window.gameModel.clockwise$,
      (clockwise) => (this.clockwise = clockwise),
    );
    subscribe(
      this,
      () => window.gameModel.dragonGiftEnemies$,
      (enemies) => (this.dragonGiftEnemies = enemies),
    );
    subscribe(
      this,
      () => window.gameModel.pendingConfirmTichu$,
      (pending) => (this.pendingConfirmTichu = pending),
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

  private getSelectedCards(): Card[] {
    const selectedSet = new Set(this.selectedCardIds.map((id) => String(id)));
    return this.hand.filter((c) => selectedSet.has(String(c.id)));
  }

  private getLastCombo(): Combo {
    return Combo.fromLastComboState(this.trickLastCombo);
  }

  private getSelectionValidation(): ComboValidationResult {
    return analyzeSelection({
      selectedCards: this.getSelectedCards(),
      handCards: this.hand,
      lastCombo: this.getLastCombo(),
      stateName: this.stateName,
      mahjongWish: this.mahjongWish,
    });
  }

  private getBombSelectionValidation(): ComboValidationResult {
    return analyzeSelection({
      selectedCards: this.getSelectedCards(),
      handCards: this.hand,
      lastCombo: this.getLastCombo(),
      stateName: "playBomb",
      mahjongWish: this.mahjongWish,
    });
  }

  private getPassValidation(): PassValidationResult {
    return validatePassAction(this.hand, this.getLastCombo(), this.mahjongWish);
  }

  private isBombPlayOnOwnTurn(): boolean {
    return (
      this.isCurrentPlayerActive &&
      (this.stateName === "playComboOpen" || this.stateName === "playCombo")
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

  updateResponsiveMode(width: number) {
    const nextMode: "desktop" | "medium" | "mobile" =
      !width || width >= 740 ? "desktop" : width >= 540 ? "medium" : "mobile";
    if (nextMode !== this.compactMode) {
      this.compactMode = nextMode;
    }
  }

  private getFilledPassSlotCount(): number {
    return this.passSlots.filter((s) => s.givenCard !== null).length;
  }

  override render() {
    const readOnly = this.isReadOnly();
    if (readOnly || this.stateName === "gameEnd") {
      return "";
    }

    const isConfirmTichu = this.pendingConfirmTichu !== null;
    const isCountdown = this.acceptingCardsCountdown || this.collectingTrickCountdown;
    const isPrePlayState =
      this.stateName === "grandTichuBets" ||
      this.stateName === "giveCards" ||
      this.stateName === "acceptPassedCards" ||
      this.stateName === "showPassedCards";
    const isPrePlayBar = !isConfirmTichu && !isCountdown && isPrePlayState;
    const isGiveCardsActive =
      isPrePlayBar && this.stateName === "giveCards" && this.isCurrentPlayerActive;
    const isPrePlaySingleRow = this.compactMode === "mobile" && isPrePlayBar;

    const isMahjongActive =
      !isConfirmTichu && this.stateName === "mahjongPlay" && this.isCurrentPlayerActive;
    const isPhoenixActive =
      !isConfirmTichu && this.stateName === "phoenixPlay" && this.isCurrentPlayerActive;
    const isDragonGiftActive =
      !isConfirmTichu &&
      this.stateName === "chooseDragonGift" &&
      this.isCurrentPlayerActive &&
      this.dragonGiftEnemies !== null;

    const isBombAsPlay = this.isBombPlayOnOwnTurn();
    const showBomb =
      !isPrePlayBar &&
      !isConfirmTichu &&
      !isDragonGiftActive &&
      this.hand.length > 0 &&
      (isBombAsPlay || this.stateName === "playCombo" || this.stateName === "confirmTrick");

    const showTichu =
      !isConfirmTichu &&
      !isDragonGiftActive &&
      this.currentPlayer !== null &&
      this.currentPlayer.callTichu === -1 &&
      this.currentPlayer.callGrandTichu !== 200 &&
      !this.firstOutPlayerId;

    const isMobileTwoColTop = this.compactMode === "mobile" && isMahjongActive;
    const isMobileTopOnly = this.compactMode === "mobile" && isPhoenixActive && !showTichu;

    const wishBombCallout = isConfirmTichu ? null : this.getWishBombCallout();

    if (isConfirmTichu && this.pendingConfirmTichu) {
      const grand = Boolean(this.pendingConfirmTichu.grand);
      const isConfirmPrePlay = !isCountdown && isPrePlayState;
      const isConfirmGiveCardsActive =
        isConfirmPrePlay && this.stateName === "giveCards" && this.isCurrentPlayerActive;
      const partnerCalled = this.currentPlayer
        ? Object.values(this.players).some(
            (p) =>
              p.id !== this.currentPlayer?.id &&
              p.team === this.currentPlayer?.team &&
              (p.callTichu === 100 || p.callGrandTichu === 200),
          )
        : false;
      const confirmMsg = partnerCalled
        ? _(
            "Your partner has already called Tichu. Only one player can finish first — are you sure?",
          )
        : this.pendingConfirmTichu.msg;

      if (grand) {
        return html`
          <div
            id="buttons"
            class=${classMap({
              "compact-medium": this.compactMode === "medium",
              "compact-mobile": this.compactMode === "mobile",
              "confirm-tichu": true,
              "confirm-grand-tichu": true,
              "confirm-preplay": true,
            })}
          >
            <div id="confirm_tichu_msg" role="alert">${confirmMsg}</div>
            <div class="space1">
              <a
                href="#"
                id="cancelTichu"
                class="action-button bgabutton bgabutton_gray"
                @click=${this.onCancelConfirmTichu}
                >${_("No Grand Tichu")}</a
              >
            </div>
            <div id="bomb_button">
              <a
                href="#"
                id="confirmTichu"
                data-grand="1"
                class="action-button bgabutton bgabutton_blue"
                @click=${this.onConfirmTichu}
                >${_("Confirm")}</a
              >
            </div>
            <div id="tichu_button"></div>
          </div>
        `;
      }

      return html`
        <div
          id="buttons"
          class=${classMap({
            "compact-medium": this.compactMode === "medium",
            "compact-mobile": this.compactMode === "mobile",
            "confirm-tichu": true,
            "confirm-preplay": isConfirmPrePlay,
            "give-cards-active": isConfirmGiveCardsActive,
          })}
        >
          <div id="confirm_tichu_msg" role="alert">${confirmMsg}</div>
          <div id="bomb_button">
            <a
              href="#"
              id="cancelTichu"
              class="action-button bgabutton bgabutton_gray"
              @click=${this.onCancelConfirmTichu}
              >${_("No Tichu")}</a
            >
          </div>
          <div id="tichu_button">
            <a
              href="#"
              id="confirmTichu"
              data-grand="0"
              class="action-button bgabutton bgabutton_green"
              @click=${this.onConfirmTichu}
              >${_("Confirm")}</a
            >
          </div>
        </div>
      `;
    }

    if (isDragonGiftActive && this.dragonGiftEnemies) {
      const leftIdx = this.clockwise ? 0 : 1;
      const rightIdx = this.clockwise ? 1 : 0;
      const leftName = this.dragonGiftEnemies[leftIdx] ?? "";
      const rightName = this.dragonGiftEnemies[rightIdx] ?? "";
      const giveLeftText = substituteTemplate(_("Give cards to ${player_name}"), {
        player_name: leftName,
      });
      const giveRightText = substituteTemplate(_("Give cards to ${player_name}"), {
        player_name: rightName,
      });
      return html`
        <div
          id="buttons"
          class=${classMap({
            "compact-medium": this.compactMode === "medium",
            "compact-mobile": this.compactMode === "mobile",
            "dragon-gift-mode": true,
          })}
        >
          <div id="dragon_before_button">
            <a
              href="#"
              id="giveDragonBefore_button"
              class="action-button bgabutton bgabutton_blue"
              @click=${(e: Event) => this.onGiveDragon(e, leftIdx)}
              >${giveLeftText}</a
            >
          </div>
          <div id="dragon_after_button">
            <a
              href="#"
              id="giveDragonAfter_button"
              class="action-button bgabutton bgabutton_blue"
              @click=${(e: Event) => this.onGiveDragon(e, rightIdx)}
              >${giveRightText}</a
            >
          </div>
        </div>
      `;
    }

    return html`
      <div
        id="buttons"
        class=${classMap({
          "compact-medium": this.compactMode === "medium",
          "compact-mobile": this.compactMode === "mobile",
          "compact-single-row": isPrePlaySingleRow,
          "compact-two-col-top": isMobileTwoColTop,
          "compact-top-only": isMobileTopOnly,
          "preplay-bar": isPrePlayBar,
          "give-cards-active": isGiveCardsActive,
        })}
      >
        <div
          id="play_button"
          class=${classMap({
            countdown: isCountdown,
            "span-two": isPhoenixActive,
          })}
        >
          ${this.renderPlayButtonContent()}
        </div>
        <div id="pass_button">${this.renderPassButtonContent()}</div>
        <div id="pass_trick_button">${this.renderPassTrickButtonContent()}</div>
        <div class="space1">${isPrePlayBar ? this.renderPrePlayLeftSlot() : ""}</div>
        <div id="bomb_button">
          ${
            isPrePlayBar
              ? this.renderPrePlayMiddleSlot()
              : showBomb
                ? this.renderBombButtonContent(isBombAsPlay)
                : ""
          }
        </div>
        <div id="tichu_button">
          ${
            showTichu
              ? html`<a
                  href="#"
                  id="myMakeTichuBet"
                  class="action-button bgabutton bgabutton_green"
                  data-tooltip=${_("Bet 100 Points, that you will finish first")}
                  data-tooltip-tier="slow"
                  data-tooltip-touch="longpress"
                  @click=${this.onTichuBet}
                  >${_("Tichu")}</a
                >`
              : ""
          }
        </div>
      </div>
      ${wishBombCallout ? this.renderWishBombCallout(wishBombCallout) : ""}
    `;
  }

  private renderPrePlayLeftSlot() {
    if (
      this.stateName === "grandTichuBets" &&
      this.currentPlayer !== null &&
      this.currentPlayer.callGrandTichu === -1
    ) {
      return html`<a
        href="#"
        id="noBet"
        class="action-button bgabutton bgabutton_gray"
        @click=${this.onNoGrandTichuBet}
        >${_("No bet")}</a
      >`;
    }
    if (this.stateName === "giveCards" && this.isCurrentPlayerActive) {
      const resetDisabled = this.getFilledPassSlotCount() === 0;
      return html`<a
        href="#"
        id="resetPassCards_button"
        class="action-button bgabutton bgabutton_gray ${resetDisabled ? "disabled" : ""}"
        aria-disabled=${resetDisabled ? "true" : nothing}
        @click=${this.onResetPassCards}
        >${_("Reset choices")}</a
      >`;
    }
    return "";
  }

  private renderPrePlayMiddleSlot() {
    if (
      this.stateName === "grandTichuBets" &&
      this.currentPlayer !== null &&
      this.currentPlayer.callGrandTichu === -1
    ) {
      return html`<a
        href="#"
        id="makeGTBet"
        class="action-button bgabutton bgabutton_blue"
        data-tooltip=${_("Bet 200 Points, that you will finish first")}
        data-tooltip-tier="slow"
        data-tooltip-touch="longpress"
        @click=${this.onGrandTichuBet}
        >${_("Grand Tichu")}</a
      >`;
    }
    if (this.stateName === "giveCards") {
      if (this.isCurrentPlayerActive) {
        const passDisabled = this.getFilledPassSlotCount() < 3;
        return html`<a
          href="#"
          id="passCards_button"
          class="action-button bgabutton bgabutton_blue ${passDisabled ? "disabled" : ""}"
          aria-disabled=${passDisabled ? "true" : nothing}
          data-tooltip=${passDisabled ? _("You must select exactly 3 cards") : nothing}
          data-tooltip-touch=${passDisabled ? "tap" : nothing}
          @click=${this.onPassCards}
          >${_("Pass selected cards")}</a
        >`;
      }
      return html`<a
        href="#"
        id="unpassCards_button"
        class="action-button bgabutton bgabutton_gray"
        @click=${this.onUnpassCards}
        >${_("Undo Pass")}</a
      >`;
    }
    if (this.stateName === "showPassedCards" && this.isCurrentPlayerActive) {
      return html`<a
        href="#"
        id="acceptCards_button"
        class="action-button bgabutton bgabutton_blue"
        @click=${this.onAcceptCards}
        >${_("Accept cards")}</a
      >`;
    }
    return "";
  }

  private renderBombButtonContent(isBombAsPlay: boolean) {
    if (isBombAsPlay) {
      const validation = this.getBombSelectionValidation();
      const bombTooltipTier =
        validation.isValid && !validation.requiresPhoenixChoice ? "slow" : nothing;
      return html`<a
        href="#"
        id="myPlayBomb"
        class="action-button bgabutton bgabutton_gray ${validation.isValid ? "" : "disabled"}"
        aria-disabled=${validation.isValid ? nothing : "true"}
        data-tooltip=${validation.tooltip || nothing}
        data-tooltip-tier=${bombTooltipTier}
        data-tooltip-touch=${validation.isValid ? "longpress" : "tap"}
        @click=${this.onPlayBomb}
        >${_("Play Bomb")}</a
      >`;
    }
    return html`<a
      href="#"
      id="myPlayBomb"
      class="action-button bgabutton bgabutton_gray"
      @click=${this.onPlayBomb}
      >${_("Play Bomb")}</a
    >`;
  }

  private getWishBombCallout(): WishBombCallout | null {
    if (this.isReadOnly() || this.acceptingCardsCountdown || this.collectingTrickCountdown) {
      return null;
    }
    const canPlayCombo =
      this.isCurrentPlayerActive &&
      (this.stateName === "playComboOpen" || this.stateName === "playCombo");
    if (!canPlayCombo) {
      return null;
    }
    return getWishBombOnlyCallout(this.hand, this.getLastCombo(), this.mahjongWish);
  }

  private renderWishBombCallout(callout: WishBombCallout) {
    return html`
      <div id="wishBombCallout">
        <span class="callout-msg">${callout.message}</span>
      </div>
    `;
  }

  private renderPlayButtonContent() {
    if (this.isReadOnly()) {
      return "";
    }
    if (this.acceptingCardsCountdown) {
      return html`<h3>${_("Auto accepting ...")}</h3>`;
    }
    if (this.collectingTrickCountdown) {
      return html`<h3>${_("Auto collecting ...")}</h3>`;
    }

    const canPlayCombo =
      this.isCurrentPlayerActive &&
      (this.stateName === "playComboOpen" ||
        this.stateName === "playCombo" ||
        this.stateName === "playBomb");

    if (canPlayCombo) {
      const validation = this.getSelectionValidation();
      const playTooltipTier =
        validation.isValid && !validation.requiresPhoenixChoice ? "slow" : nothing;
      return html`<a
        href="#"
        id="myPlayCombo"
        class="action-button bgabutton bgabutton_blue ${validation.isValid ? "" : "disabled"}"
        aria-disabled=${validation.isValid ? nothing : "true"}
        data-tooltip=${validation.tooltip || nothing}
        data-tooltip-tier=${playTooltipTier}
        data-tooltip-touch=${validation.isValid ? "longpress" : "tap"}
        @click=${this.onPlayCombo}
        >${validation.buttonLabel}</a
      >`;
    }

    const canCollect =
      this.isCurrentPlayerActive &&
      this.stateName === "confirmTrick" &&
      !this.collectingTrickCountdown;

    if (canCollect) {
      return html`<a
        href="#"
        id="myConfirmTrick"
        class="action-button bgabutton bgabutton_blue"
        @click=${this.onCollect}
        >${_("Collect")}</a
      >`;
    }

    if (this.isCurrentPlayerActive && this.stateName === "mahjongPlay") {
      const wishDisabled = this.selectedMahjongWish === null;
      return html`<a
        href="#"
        id="chooseWish"
        class="action-button bgabutton bgabutton_blue ${wishDisabled ? "disabled" : ""}"
        aria-disabled=${wishDisabled ? "true" : nothing}
        data-tooltip=${wishDisabled ? _("You need to choose ONE value to wish") : nothing}
        data-tooltip-touch=${wishDisabled ? "tap" : nothing}
        @click=${this.onMakeAWish}
        >${_("Make a wish")}</a
      >`;
    }

    if (this.isCurrentPlayerActive && this.stateName === "phoenixPlay") {
      const phoenixDisabled = this.selectedPhoenixValue === null;
      return html`<a
        href="#"
        id="choosePhoenix"
        class="action-button bgabutton bgabutton_blue ${phoenixDisabled ? "disabled" : ""}"
        aria-disabled=${phoenixDisabled ? "true" : nothing}
        data-tooltip=${phoenixDisabled ? _("You need to choose ONE value for the Phoenix") : nothing}
        data-tooltip-touch=${phoenixDisabled ? "tap" : nothing}
        @click=${this.onChoosePhoenix}
        >${_("Choose a value for the Phoenix")}</a
      >`;
    }

    return "";
  }

  private renderPassButtonContent() {
    if (this.acceptingCardsCountdown || this.collectingTrickCountdown) {
      return "";
    }
    if (this.isReadOnly()) return "";

    if (this.isCurrentPlayerActive) {
      if (this.stateName === "mahjongPlay") {
        return html`<a
          href="#"
          id="noWish_button"
          class="action-button bgabutton bgabutton_gray"
          @click=${this.onNoWish}
          >${_("No wish")}</a
        >`;
      }
      if (this.stateName === "playCombo") {
        const passCheck = this.getPassValidation();
        return html`<a
          href="#"
          id="myPass"
          class="action-button bgabutton bgabutton_red ${passCheck.canPass ? "" : "disabled"}"
          aria-disabled=${passCheck.canPass ? nothing : "true"}
          data-tooltip=${passCheck.tooltip || nothing}
          data-tooltip-touch=${passCheck.canPass ? "longpress" : "tap"}
          @click=${(e: Event) => this.onPass(e, true)}
          >${passCheck.buttonLabel}</a
        >`;
      }
      if (this.stateName === "playBomb") {
        return html`<a
          href="#"
          id="myCancel"
          class="action-button bgabutton bgabutton_red"
          @click=${this.onCancelBomb}
          >${_("Cancel")}</a
        >`;
      }
      return "";
    }

    if (
      (this.stateName === "playCombo" || this.stateName === "confirmTrick") &&
      this.hand.length > 0
    ) {
      const passMode = this.currentPlayer?.pass ?? 0;
      if (passMode === 0) {
        return html`<a
          href="#"
          id="myPassOnce"
          class="action-button bgabutton bgabutton_red"
          data-tooltip=${_("Automatically pass next time (unless a new trick starts)")}
          data-tooltip-tier="slow"
          data-tooltip-touch="longpress"
          @click=${(e: Event) => this.onPass(e, true)}
          >${_("Auto-Pass once")}</a
        >`;
      }
      return html`<a
        href="#"
        id="myCancelAutopass"
        class="action-button bgabutton bgabutton_red"
        data-tooltip=${_("You have chosen to automatically pass during this trick. Click to cancel")}
        data-tooltip-tier="slow"
        data-tooltip-touch="longpress"
        @click=${this.onCancelAutopass}
        >${_("Cancel Auto-Pass")}</a
      >`;
    }

    return "";
  }

  private renderPassTrickButtonContent() {
    if (this.acceptingCardsCountdown || this.collectingTrickCountdown) {
      return "";
    }
    if (this.isReadOnly()) return "";

    if (this.isCurrentPlayerActive && this.stateName === "phoenixPlay") {
      return html`<a
        href="#"
        id="cancelPhoenix"
        class="action-button bgabutton bgabutton_red"
        @click=${this.onCancelPhoenix}
        >${_("Cancel")}</a
      >`;
    }

    const passMode = this.currentPlayer?.pass ?? 0;
    const showTrickPass =
      (this.isCurrentPlayerActive && this.stateName === "playCombo") ||
      (!this.isCurrentPlayerActive &&
        (this.stateName === "playCombo" || this.stateName === "confirmTrick") &&
        this.hand.length > 0 &&
        passMode < 2);

    if (showTrickPass) {
      const passCheck = this.isCurrentPlayerActive
        ? this.getPassValidation()
        : { canPass: true, tooltip: "" };
      const isDisabled = !passCheck.canPass;
      const tooltip = isDisabled
        ? passCheck.tooltip
        : _("Automatically pass until the end of this trick.");
      return html`<a
        href="#"
        id="myPassTrick"
        class="action-button bgabutton bgabutton_gray ${isDisabled ? "disabled" : ""}"
        aria-disabled=${isDisabled ? "true" : nothing}
        data-tooltip=${tooltip || nothing}
        data-tooltip-tier=${isDisabled ? nothing : "slow"}
        data-tooltip-touch=${isDisabled ? "tap" : "longpress"}
        @click=${(e: Event) => this.onPass(e, false)}
        >${_("Auto-Pass Trick")}</a
      >`;
    }
    return "";
  }

  private onPlayCombo(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    const validation = this.getSelectionValidation();
    if (!validation.isValid) return;

    this.executePlayCombo(e);
  }

  private executePlayCombo(e: Event) {
    this.dispatchEvent(
      new CustomEvent("action-play-combo", {
        bubbles: true,
        composed: true,
      }),
    );
    const ui = (window as any).gameui;
    if (ui) {
      if (typeof ui.onPlayCombo === "function") {
        ui.onPlayCombo(e);
      } else if (typeof ui.playCombo === "function") {
        ui.playCombo("playCombo");
      }
    }
  }

  private onPass(e: Event, onlyOnce: boolean) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    if (this.isCurrentPlayerActive && !this.getPassValidation().canPass) return;
    this.dispatchEvent(
      new CustomEvent(onlyOnce ? "action-pass" : "action-pass-trick", {
        detail: { onlyOnce },
        bubbles: true,
        composed: true,
      }),
    );
    const ui = (window as any).gameui;
    if (ui && typeof ui.onPass === "function") {
      ui.onPass(onlyOnce);
    }
  }

  private onCancelAutopass(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    this.dispatchEvent(
      new CustomEvent("action-cancel-autopass", {
        bubbles: true,
        composed: true,
      }),
    );
    const ui = (window as any).gameui;
    if (ui && typeof ui.cancelAutopass === "function") {
      ui.cancelAutopass();
    }
  }

  private onCancelBomb(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    this.dispatchEvent(
      new CustomEvent("action-cancel-bomb", {
        bubbles: true,
        composed: true,
      }),
    );
    const ui = (window as any).gameui;
    if (ui) {
      if (typeof ui.onCancelBomb === "function") {
        ui.onCancelBomb(e);
      } else if (typeof ui.takeAction === "function") {
        ui.takeAction("cancel");
      }
    }
  }

  private onCollect(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    this.dispatchEvent(
      new CustomEvent("action-collect", {
        bubbles: true,
        composed: true,
      }),
    );
    const ui = (window as any).gameui;
    if (ui && typeof ui.collect === "function") {
      ui.collect();
    }
  }

  private onPlayBomb(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    if (this.isBombPlayOnOwnTurn()) {
      if (!this.getBombSelectionValidation().isValid) return;
      this.executePlayCombo(e);
      return;
    }
    this.dispatchEvent(
      new CustomEvent("action-play-bomb", {
        bubbles: true,
        composed: true,
      }),
    );
    const ui = (window as any).gameui;
    if (ui) {
      if (typeof ui.onPlayBomb === "function") {
        ui.onPlayBomb(e);
      } else if (typeof ui.playCombo === "function") {
        ui.playCombo("playBomb");
      }
    }
  }

  private onTichuBet(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    this.dispatchEvent(
      new CustomEvent("action-tichu-bet", {
        bubbles: true,
        composed: true,
      }),
    );
    const ui = (window as any).gameui;
    if (ui && typeof ui.onTichuBet === "function") {
      ui.onTichuBet(e);
    }
  }

  private onGrandTichuBet(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.onGrandTichuBet === "function") {
      ui.onGrandTichuBet(Bet.GRAND_TICHU);
    }
  }

  private onNoGrandTichuBet(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.onGrandTichuBet === "function") {
      ui.onGrandTichuBet(Bet.NO_BET);
    }
  }

  private onPassCards(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    if (this.getFilledPassSlotCount() < 3) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.onPassCards === "function") {
      ui.onPassCards();
    }
  }

  private onResetPassCards(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    if (this.getFilledPassSlotCount() === 0) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.onResetPassCards === "function") {
      ui.onResetPassCards();
    }
  }

  private onUnpassCards(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.onUnpassCards === "function") {
      ui.onUnpassCards();
    }
  }

  private onAcceptCards(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.onAcceptCards === "function") {
      ui.onAcceptCards();
    }
  }

  private onMakeAWish(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    if (this.selectedMahjongWish === null) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.onMakeAWish === "function") {
      ui.onMakeAWish(e);
    }
  }

  private onNoWish(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.onNoWish === "function") {
      ui.onNoWish(e);
    }
  }

  private onChoosePhoenix(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    if (this.selectedPhoenixValue === null) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.onChoosePhoenix === "function") {
      ui.onChoosePhoenix(e);
    }
  }

  private onCancelPhoenix(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.cancelPhoenix === "function") {
      ui.cancelPhoenix();
    }
  }

  private onGiveDragon(e: Event, playerIdx: number) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.onGiveDragon === "function") {
      ui.onGiveDragon(playerIdx);
    }
  }

  private onConfirmTichu(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.onConfirmTichu === "function") {
      ui.onConfirmTichu(e);
    }
  }

  private onCancelConfirmTichu(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    const ui = (window as any).gameui;
    if (ui && typeof ui.onCancelConfirmTichu === "function") {
      ui.onCancelConfirmTichu(e);
    }
  }
}

customElements.define("tichu-action-bar", TichuActionBar);
