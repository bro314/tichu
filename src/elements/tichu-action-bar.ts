import { html, css, LitElement } from "lit";
import { state } from "lit/decorators.js";
import {
  Combo,
  ComboValidationResult,
  PassValidationResult,
  analyzeSelection,
  canFinishHandInOnePlay,
  decodeHtmlEntities,
  validatePassAction,
} from "./combo-validator";
import { Card, LivePlayer, TrickLastComboState } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";

const t = (s: string) => (typeof _ === "function" ? _(s) : s);

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
  @state() private confirmWholeHandPending = false;
  @state() private wholeHandComboDesc = "";
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
          padding: 10px 5px 10px 5px;
          min-height: 30px;
          box-sizing: content-box;
          display: flex;
          background-color: var(--bg-color-lighter);
          box-shadow: var(--elevation);
        }
        #buttons h3 {
          line-height: 20px;
        }
        #buttons .space1 {
          flex-grow: 1;
        }
        #buttons .space2 {
          flex-grow: 1.6;
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
        #buttons #bomb_button {
          min-width: 100px;
          margin-left: 10px;
        }
        #buttons #play_button {
          min-width: 150px;
          margin-left: 10px;
        }
        #buttons #pass_button {
          min-width: 150px;
          margin-left: 10px;
        }
        #buttons #pass_trick_button {
          min-width: 150px;
          margin-left: 10px;
        }
        #buttons #tichu_button {
          min-width: 100px;
          margin-left: 10px;
          margin-right: 15px;
        }
        #wholeHandConfirmBanner {
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
        #wholeHandConfirmBanner .confirm-msg {
          font-weight: 600;
          margin-right: 6px;
        }
        #wholeHandConfirmBanner .bgabutton {
          margin: 0;
          padding: 4px 10px;
          font-size: 13px;
        }
      `,
    ];
  }

  constructor() {
    super();
    subscribe(
      this,
      () => window.gameModel.stateName$,
      (stateName) => {
        this.stateName = stateName;
        this.confirmWholeHandPending = false;
      },
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
      (hand) => {
        this.hand = hand;
        this.confirmWholeHandPending = false;
      },
    );
    subscribe(
      this,
      () => window.gameModel.selectedCardIds$,
      (ids) => {
        this.selectedCardIds = ids;
        this.confirmWholeHandPending = false;
      },
    );
    subscribe(
      this,
      () => window.gameModel.mahjongWish$,
      (wish) => (this.mahjongWish = wish),
    );
    subscribe(
      this,
      () => window.gameModel.trickLastCombo$,
      (lastCombo) => {
        this.trickLastCombo = lastCombo;
        this.confirmWholeHandPending = false;
      },
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
    const showBomb =
      !readOnly &&
      ((this.isCurrentPlayerActive && this.stateName === "confirmTrick") ||
        (!this.isCurrentPlayerActive &&
          (this.stateName === "playCombo" || this.stateName === "confirmTrick") &&
          this.hand.length > 0));

    const showTichu =
      !readOnly &&
      this.currentPlayer !== null &&
      this.currentPlayer.callTichu === -1 &&
      this.currentPlayer.callGrandTichu !== 200 &&
      !this.firstOutPlayerId;

    return html`
      <div id="buttons">
        <div id="play_button">${this.renderPlayButtonContent()}</div>
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
                  >${t("Play a Bomb")}</a
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
                  title=${t("Bet 100 Points, tha you will finish first")}
                  @click=${this.onTichuBet}
                  >${t("Tichu")}</a
                >`
              : ""
          }
        </div>
        <div class="space2"></div>
      </div>
      ${this.confirmWholeHandPending ? this.renderWholeHandConfirmBanner() : ""}
    `;
  }

  private renderWholeHandConfirmBanner() {
    return html`
      <div id="wholeHandConfirmBanner">
        <span class="confirm-msg">
          ${t(`Your whole hand is a legal play (${this.wholeHandComboDesc}) — finish in one play?`)}
        </span>
        <a
          href="#"
          id="confirmPlayWholeHand"
          class="action-button bgabutton bgabutton_blue"
          @click=${this.onConfirmPlayWholeHand}
          >${t("Finish in one play")}</a
        >
        <a
          href="#"
          id="confirmPlaySelected"
          class="action-button bgabutton bgabutton_gray"
          @click=${this.onConfirmPlaySelected}
          >${t("Play selected only")}</a
        >
        <a
          href="#"
          id="cancelPlayConfirm"
          class="action-button bgabutton bgabutton_red"
          @click=${this.onCancelPlayConfirm}
          >${t("Cancel")}</a
        >
      </div>
    `;
  }

  private renderPlayButtonContent() {
    if (this.isReadOnly()) {
      return html`<h3>${t("My hand")}</h3>`;
    }
    if (this.acceptingCardsCountdown) {
      return html`<h3>${t("Auto accepting in 2 seconds ...")}</h3>`;
    }
    if (this.collectingTrickCountdown) {
      return html`<h3>${t("Auto collecting in 2 seconds ...")}</h3>`;
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
        title=${t(validation.tooltip)}
        @click=${this.onPlayCombo}
        >${t(validation.buttonLabel)}</a
      >`;
    }

    const canCollect =
      this.isCurrentPlayerActive &&
      this.stateName === "confirmTrick" &&
      !this.isRealtime &&
      !this.collectingTrickCountdown;

    if (canCollect) {
      return html`<a
        href="#"
        id="myConfirmTrick"
        class="action-button bgabutton bgabutton_blue"
        @click=${this.onCollect}
        >${t("Collect")}</a
      >`;
    }

    return html`<h3>${t("My hand")}</h3>`;
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
          title=${passCheck.tooltip ? t(passCheck.tooltip) : ""}
          @click=${(e: Event) => this.onPass(e, true)}
          >${t(passCheck.buttonLabel)}</a
        >`;
      }
      if (this.stateName === "playBomb") {
        return html`<a
          href="#"
          id="myCancel"
          class="action-button bgabutton bgabutton_red"
          @click=${this.onCancelBomb}
          >${t("Cancel")}</a
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
          title=${t("Automatically pass next time(unless a new trick starts)")}
          @click=${(e: Event) => this.onPass(e, true)}
          >${t("Auto-Pass once")}</a
        >`;
      }
      return html`<a
        href="#"
        id="myCancelAutopass"
        class="action-button bgabutton bgabutton_red"
        title=${t("You have chosen to automatically pass during this trick. Click to cancel")}
        @click=${this.onCancelAutopass}
        >${t("Cancel Auto-Pass")}</a
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
        ? t(passCheck.tooltip)
        : t("Automatically pass until the end of this trick.");
      return html`<a
        href="#"
        id="myPassTrick"
        class="action-button bgabutton bgabutton_gray ${isDisabled ? "disabled" : ""}"
        title=${tooltip}
        @click=${(e: Event) => this.onPass(e, false)}
        >${t("Auto-Pass this Trick")}</a
      >`;
    }
    return "";
  }

  private onPlayCombo(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    const validation = this.getSelectionValidation();
    if (!validation.isValid) return;

    const wholeHandCombo = canFinishHandInOnePlay(
      this.hand,
      this.getSelectedCards(),
      this.getLastCombo(),
      this.mahjongWish,
      this.stateName,
    );
    if (wholeHandCombo && !this.confirmWholeHandPending) {
      this.wholeHandComboDesc = decodeHtmlEntities(wholeHandCombo.description || "");
      this.confirmWholeHandPending = true;
      return;
    }

    this.confirmWholeHandPending = false;
    this.executePlayCombo(e);
  }

  private onConfirmPlayWholeHand(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    this.confirmWholeHandPending = false;
    window.gameModel.setSelectedCardIds(this.hand.map((c) => String(c.id)));
    this.executePlayCombo(e);
  }

  private onConfirmPlaySelected(e: Event) {
    e.preventDefault();
    if (this.isReadOnly()) return;
    this.confirmWholeHandPending = false;
    this.executePlayCombo(e);
  }

  private onCancelPlayConfirm(e: Event) {
    e.preventDefault();
    this.confirmWholeHandPending = false;
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
