import { html, css, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { Card, LivePlayer } from "./game-model";
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
          display: flex;
          align-items: center;
          background-color: var(--bg-color-lighter);
          box-shadow: var(--elevation);
        }
        #buttons h3 {
          line-height: 20px;
          font-size: 20px;
          margin: 0;
        }
        #buttons .space1 {
          flex-grow: 1;
        }
        #buttons .space2 {
          flex-grow: 1.6;
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
          display: flex;
          align-items: center;
          gap: 10px;
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

  override render() {
    const showBomb =
      !this.isSpectator &&
      (this.stateName === "playCombo" ||
        this.stateName === "confirmTrick" ||
        this.stateName === "mahjongPlay" ||
        this.stateName === "phoenixPlay") &&
      this.hand.length > 0;

    const showTichu =
      !this.isSpectator &&
      this.currentPlayer !== null &&
      this.currentPlayer.callTichu === -1 &&
      this.currentPlayer.callGrandTichu !== 200 &&
      !this.firstOutPlayerId &&
      (this.hand.length === 14 || this.stateName === "grandTichuBets");

    return html`
      <div id="buttons">
        <div id="play_button">${this.renderPlayButtonContent()}</div>
        <div
          id="pass_button"
          style="display: ${this.hasPassButtonContent() ? "inline-block" : "none"}"
        >
          ${this.renderPassButtonContent()}
        </div>
        <div
          id="pass_trick_button"
          style="display: ${this.hasPassTrickButtonContent() ? "inline-block" : "none"}"
        >
          ${this.renderPassTrickButtonContent()}
        </div>
        <div class="space1"></div>
        <div id="bomb_button" style="display: ${showBomb ? "inline-block" : "none"}">
          ${
            showBomb
              ? html`<a
                  href="#"
                  id="myPlayBomb"
                  class="action-button bgabutton bgabutton_gray"
                  @click=${this.onPlayBomb}
                  ><span>${t("Play a Bomb")}</span></a
                >`
              : ""
          }
        </div>
        <div id="tichu_button" style="display: ${showTichu ? "inline-block" : "none"}">
          ${
            showTichu
              ? html`<a
                  href="#"
                  id="myMakeTichuBet"
                  class="action-button bgabutton bgabutton_green"
                  title=${t("Bet 100 Points, tha you will finish first")}
                  @click=${this.onTichuBet}
                  ><span>${t("Tichu")}</span></a
                >`
              : ""
          }
        </div>
        <div class="space2"></div>
      </div>
    `;
  }

  private renderPlayButtonContent() {
    if (this.acceptingCardsCountdown) {
      return html`<h3>${t("Auto accepting in 2 seconds ...")}</h3>`;
    }
    if (this.collectingTrickCountdown) {
      return html`<h3>${t("Auto collecting in 2 seconds ...")}</h3>`;
    }

    const canPlayCombo =
      !this.isSpectator &&
      this.isCurrentPlayerActive &&
      (this.stateName === "playComboOpen" ||
        this.stateName === "playCombo" ||
        this.stateName === "playBomb");

    const canCollect =
      !this.isSpectator &&
      this.isCurrentPlayerActive &&
      this.stateName === "confirmTrick" &&
      !this.isRealtime &&
      !this.collectingTrickCountdown;

    return html`
      <h3>${t("My hand")}</h3>
      ${
        canPlayCombo
          ? html`<a
              href="#"
              id="myPlayCombo"
              class="action-button bgabutton bgabutton_blue"
              @click=${this.onPlayCombo}
              ><span>${t("Play selected cards")}</span></a
            >`
          : ""
      }
      ${
        canCollect
          ? html`<a
              href="#"
              id="myConfirmTrick"
              class="action-button bgabutton bgabutton_blue"
              @click=${this.onCollect}
              ><span>${t("Collect")}</span></a
            >`
          : ""
      }
    `;
  }

  private hasPassButtonContent(): boolean {
    if (this.acceptingCardsCountdown || this.collectingTrickCountdown) return false;
    if (this.isSpectator) return false;
    if (this.isCurrentPlayerActive) {
      return this.stateName === "playCombo" || this.stateName === "playBomb";
    }
    return (
      (this.stateName === "playCombo" || this.stateName === "confirmTrick") && this.hand.length > 0
    );
  }

  private renderPassButtonContent() {
    if (this.acceptingCardsCountdown || this.collectingTrickCountdown) {
      return "";
    }
    if (this.isSpectator) return "";

    if (this.isCurrentPlayerActive) {
      if (this.stateName === "playCombo") {
        return html`<a
          href="#"
          id="myPass"
          class="action-button bgabutton bgabutton_red"
          @click=${(e: Event) => this.onPass(e, true)}
          ><span>${t("Pass")}</span></a
        >`;
      }
      if (this.stateName === "playBomb") {
        return html`<a
          href="#"
          id="myCancel"
          class="action-button bgabutton bgabutton_red"
          @click=${this.onCancelBomb}
          ><span>${t("Cancel")}</span></a
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
          ><span>${t("Auto-Pass once")}</span></a
        >`;
      }
      return html`<a
        href="#"
        id="myCancelAutopass"
        class="action-button bgabutton bgabutton_red"
        title=${t("You have chosen to automatically pass during this trick. Click to cancel")}
        @click=${this.onCancelAutopass}
        ><span>${t("Cancel Auto-Pass")}</span></a
      >`;
    }

    return "";
  }

  private hasPassTrickButtonContent(): boolean {
    if (this.acceptingCardsCountdown || this.collectingTrickCountdown) return false;
    if (this.isSpectator) return false;
    if (this.isCurrentPlayerActive) {
      return this.stateName === "playCombo";
    }
    const passMode = this.currentPlayer?.pass ?? 0;
    return (
      (this.stateName === "playCombo" || this.stateName === "confirmTrick") &&
      this.hand.length > 0 &&
      passMode < 2
    );
  }

  private renderPassTrickButtonContent() {
    if (this.acceptingCardsCountdown || this.collectingTrickCountdown) {
      return "";
    }
    if (this.isSpectator) return "";

    const passMode = this.currentPlayer?.pass ?? 0;
    const showTrickPass =
      (this.isCurrentPlayerActive && this.stateName === "playCombo") ||
      (!this.isCurrentPlayerActive &&
        (this.stateName === "playCombo" || this.stateName === "confirmTrick") &&
        this.hand.length > 0 &&
        passMode < 2);

    if (showTrickPass) {
      return html`<a
        href="#"
        id="myPassTrick"
        class="action-button bgabutton bgabutton_gray"
        title=${t("Automatically pass until the end of this trick.")}
        @click=${(e: Event) => this.onPass(e, false)}
        ><span>${t("Auto-Pass this Trick")}</span></a
      >`;
    }
    return "";
  }

  private onPlayCombo(e: Event) {
    e.preventDefault();
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
