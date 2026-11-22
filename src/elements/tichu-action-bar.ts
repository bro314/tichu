import { html, css, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import {
  Combo,
  ComboValidationResult,
  PassValidationResult,
  WishBombCallout,
  analyzeSelection,
  getWishBombOnlyCallout,
  validatePassAction,
} from "./combo-validator";
import { Card, LivePlayer, TrickLastComboState } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";

export class TichuActionBar extends LitElement {
  @state() private stateName = "";
  @state() private isCurrentPlayerActive = false;
  @state() private isSpectator = false;
  @state() private isRealtime = false;
  @state() private currentPlayer: LivePlayer | null = null;
  @state() private hand: Card[] = [];
  @state() private selectedCardIds: string[] = [];
  @state() private mahjongWish = 0;
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

  static override get styles() {
    return [
      styles,
      css`
        :host {
          display: block;
        }
        #buttons {
          padding: 10px 15px;
          min-height: 30px;
          box-sizing: content-box;
          display: grid;
          grid-template-columns: 180px 160px 170px minmax(8px, 1fr) 130px 105px minmax(8px, 1.6fr);
          column-gap: 10px;
          align-items: center;
          background-color: var(--bg-color-lighter);
          box-shadow: var(--elevation);
        }
        #buttons > div {
          min-width: 0;
        }
        #buttons h3 {
          margin: 0;
          font-size: 16px;
          line-height: 30px;
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
        #buttons #play_button.countdown ~ #pass_button,
        #buttons #play_button.countdown ~ #pass_trick_button {
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
          min-height: 30px;
        }
        #buttons #tichu_button {
          grid-column: 6;
          min-height: 30px;
        }
        #buttons .space2 {
          grid-column: 7;
        }
        :host-context(.lockedInterface) #buttons .bgabutton {
          visibility: hidden;
        }
        #buttons .bgabutton {
          text-align: center;
          margin: 0;
          width: 100%;
          box-sizing: border-box;
          box-shadow: none;
          text-shadow: none;
        }
        @media (max-width: 760px) {
          #buttons {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            row-gap: 8px;
          }
          #buttons #play_button.countdown {
            grid-column: 1 / 4;
          }
          #buttons .space1,
          #buttons .space2 {
            display: none;
          }
          #buttons #bomb_button {
            grid-column: 1;
            grid-row: 2;
          }
          #buttons #tichu_button {
            grid-column: 2;
            grid-row: 2;
          }
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

  private getPassValidation(): PassValidationResult {
    return validatePassAction(this.hand, this.getLastCombo(), this.mahjongWish);
  }

  override render() {
    const readOnly = this.isReadOnly();
    if (readOnly || this.stateName === "gameEnd") {
      return "";
    }

    const showBomb =
      (this.isCurrentPlayerActive && this.stateName === "confirmTrick") ||
      (!this.isCurrentPlayerActive &&
        (this.stateName === "playCombo" || this.stateName === "confirmTrick") &&
        this.hand.length > 0);

    const showTichu =
      this.currentPlayer !== null &&
      this.currentPlayer.callTichu === -1 &&
      this.currentPlayer.callGrandTichu !== 200 &&
      !this.firstOutPlayerId;

    const isCountdown = this.acceptingCardsCountdown || this.collectingTrickCountdown;
    const wishBombCallout = this.getWishBombCallout();

    return html`
      <div id="buttons">
        <div id="play_button" class=${isCountdown ? "countdown" : ""}>
          ${this.renderPlayButtonContent()}
        </div>
        <div id="pass_button">${this.renderPassButtonContent()}</div>
        <div id="pass_trick_button">${this.renderPassTrickButtonContent()}</div>
        <div class="space1"></div>
        <div id="bomb_button">
          ${
            showBomb
              ? html`<a
                  href="#"
                  id="myPlayBomb"
                  class="action-button bgabutton bgabutton_gray"
                  @click=${this.onPlayBomb}
                  >${_("Play a Bomb")}</a
                >`
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
                  data-tooltip-touch="longpress"
                  @click=${this.onTichuBet}
                  >${_("Tichu")}</a
                >`
              : ""
          }
        </div>
        <div class="space2"></div>
      </div>
      ${wishBombCallout ? this.renderWishBombCallout(wishBombCallout) : ""}
    `;
  }

  private getWishBombCallout(): WishBombCallout | null {
    if (this.isReadOnly() || this.acceptingCardsCountdown || this.collectingTrickCountdown) {
      return null;
    }
    const canPlayCombo =
      this.isCurrentPlayerActive &&
      (this.stateName === "playComboOpen" ||
        this.stateName === "playCombo" ||
        this.stateName === "playBomb");
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
      return html`<h3>${_("Auto accepting in 2 seconds ...")}</h3>`;
    }
    if (this.collectingTrickCountdown) {
      return html`<h3>${_("Auto collecting in 2 seconds ...")}</h3>`;
    }

    const canPlayCombo =
      this.isCurrentPlayerActive &&
      (this.stateName === "playComboOpen" ||
        this.stateName === "playCombo" ||
        this.stateName === "playBomb");

    if (canPlayCombo) {
      const validation = this.getSelectionValidation();
      return html`<a
        href="#"
        id="myPlayCombo"
        class="action-button bgabutton bgabutton_blue ${validation.isValid ? "" : "disabled"}"
        aria-disabled=${validation.isValid ? nothing : "true"}
        data-tooltip=${validation.tooltip || nothing}
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

    return "";
  }

  private renderPassButtonContent() {
    if (this.acceptingCardsCountdown || this.collectingTrickCountdown) {
      return "";
    }
    if (this.isReadOnly()) return "";

    if (this.isCurrentPlayerActive) {
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
        data-tooltip-touch=${isDisabled ? "tap" : "longpress"}
        @click=${(e: Event) => this.onPass(e, false)}
        >${_("Auto-Pass this Trick")}</a
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
}

customElements.define("tichu-action-bar", TichuActionBar);
