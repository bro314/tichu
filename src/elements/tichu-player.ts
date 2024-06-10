import { html, css, LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Bet, Card, PlayerState } from "./model";
import "./tichu-stock";
import "./tichu-card";
import { subscribe } from "./subscription-controller";
import { hasBomb } from "./utils";

export class TichuPlayer extends LitElement {
  @property({ type: Number }) playerId = 0;

  @property({ type: Boolean }) reverse = false;

  @state() hand: Card[] = [];

  @state() combo?: Card[];

  @state() isLastComboPlayer = false;

  @state() name = "";

  @state() points = 0;

  @state() active = false;

  @state() bet = Bet.NO_BET_YET;

  @state() player?: PlayerState;

  @state() passedToPrevious?: Card;
  @state() passedToPartner?: Card;
  @state() passedToNext?: Card;

  @state() previousHand: Card[] = [];
  @state() partnerHand: Card[] = [];
  @state() nextHand: Card[] = [];

  constructor() {
    super();
    subscribe(
      this,
      () => window.model.player$(this.playerId),
      (player) => {
        this.player = player;
        this.hand = player?.cards ?? [];
        this.bet = player?.bet ?? Bet.NO_BET_YET;
        this.points = player?.roundPoints ?? 0;
        this.active = player?.active ?? false;
        this.name = player?.player?.name ?? "";
      }
    );
    subscribe(
      this,
      () => window.model.players$,
      (players) => {
        const nextId = window.model.nextPlayerId(this.playerId);
        const next = players.find((p) => p.player.id === nextId);
        this.nextHand = next?.cards ?? [];

        const partnerId = window.model.nextPlayerId(nextId);
        const partner = players.find((p) => p.player.id === partnerId);
        this.partnerHand = partner?.cards ?? [];

        const previousId = window.model.nextPlayerId(partnerId);
        const previous = players.find((p) => p.player.id === previousId);
        this.previousHand = previous?.cards ?? [];
      }
    );
    subscribe(
      this,
      () => window.model.latestCombo$(this.playerId),
      (combo) => {
        this.combo = combo?.cards;
      }
    );
    subscribe(
      this,
      () => window.model.lastComboPlayer$,
      (lastComboPlayer) => {
        this.isLastComboPlayer = lastComboPlayer === this.playerId;
      }
    );
    subscribe(
      this,
      () => window.model.passedCards$,
      (passedCards) => {
        this.passedToPrevious = undefined;
        this.passedToPartner = undefined;
        this.passedToNext = undefined;
        for (const passed of passedCards) {
          if (passed.from !== this.playerId) continue;
          if (passed.accepted) continue;
          const nextId = window.model.nextPlayerId(this.playerId);
          const partnerId = window.model.nextPlayerId(nextId);
          const previousId = window.model.nextPlayerId(partnerId);
          if (passed.to === previousId) this.passedToPrevious = passed.card;
          if (passed.to === partnerId) this.passedToPartner = passed.card;
          if (passed.to === nextId) this.passedToNext = passed.card;
        }
      }
    );
  }

  static override get styles() {
    return [
      css`
        :host {
          display: block;
          padding: 12px;
          padding: 6px;
          background: var(--bg-color-lighter);
          border-radius: var(--border-radius);
          max-width: 500px;
        }
        .title {
          line-height: 24px;
          font-size: 20px;
          display: flex;
          flex-direction: row-reverse;
          justify-content: space-between;
        }
        .reverse .title {
          flex-direction: row;
        }
        .title > div {
          padding: 2px 8px;
          border-radius: var(--border-radius);
          min-width: 110px;
        }
        .title .name {
          background-color: rgba(100, 100, 100, 0.2);
        }
        .title.out .name {
          background-color: rgba(0, 0, 0, 0.7);
        }
        .title.isLastComboPlayer .name {
          background-color: var(--bg-color-play-area);
        }
        .title.active .name {
          background-color: var(--bg-color-active);
          color: white;
        }
        .title .name {
          text-align: center;
        }
        .title .points {
          text-align: center;
        }
        .title .bet {
          text-align: center;
        }
        .title .bet {
          padding: 2px 16px;
        }
        .title .bet.tichu {
          background-color: rgb(27, 150, 77);
          color: white;
        }
        .title .bet.grandTichu {
          background-color: rgb(36, 165, 232);
          color: white;
        }
        .name {
          font-weight: bold;
        }
        .stocks {
          display: flex;
          justify-content: space-between;
          padding: 8px;
          zoom: 0.8;
        }
        .stocks.reverse {
          flex-direction: row-reverse;
        }
        .passed {
          display: flex;
          flex-direction: row-reverse;
          gap: 8px;
        }
        .reverse .passed {
          flex-direction: row;
        }
        .passed .small {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .reverse .passed .small {
          flex-direction: column-reverse;
        }
        .passed .passedCard {
          display: flex;
          flex-direction: column;
        }
        .passed .passedCard.partner {
          justify-content: space-between;
        }
        .passed tichu-card {
          margin-bottom: 4px;
          zoom: 0.85;
        }
        .passed .small tichu-card {
          zoom: 0.67;
        }
        .passedCard .bomb {
          background: red;
          color: white;
        }
        .icon {
          background-size: 128px 64px;
          display: inline-block;
          height: 16px;
          width: 16px;
          background-image: var(--icon-url);
        }
        .icon.star {
          background-position: -112px -16px;
        }
      `,
    ];
  }

  override render() {
    const passingCards = !!this.passedToPrevious || !!this.passedToPartner || !!this.passedToNext;
    return html`
      <div
        class=${classMap({
          reverse: this.reverse,
        })}
      >
        <div
          class=${classMap({
            title: true,
            isLastComboPlayer: this.isLastComboPlayer,
            active: this.active,
            out: this.hand.length === 0,
          })}
        >
          <div class="name">${this.name}</div>
          <div class="points">
            <div class="icon star"></div>
            ${this.points}
          </div>
          ${this.renderBet()}
        </div>
        <div
          class=${classMap({
            stocks: true,
            reverse: this.reverse,
          })}
        >
          <tichu-stock .cards=${this.hand}></tichu-stock>
          ${passingCards ? this.renderPassedCards() : this.renderCombo()}
        </div>
      </div>
    `;
  }

  private renderCombo() {
    return html`
      <tichu-stock ?pass=${this.combo?.length === 0} .cards=${this.combo ?? []}></tichu-stock>
    `;
  }

  private renderPassedCards() {
    if (!this.passedToPrevious && !this.passedToPartner && !this.passedToNext) return;
    const prevBefore = hasBomb(this.previousHand);
    const prevAfter = prevBefore || hasBomb([...this.previousHand, this.passedToPrevious!]);
    const partnerBefore = hasBomb(this.partnerHand);
    const partnerAfter = partnerBefore || hasBomb([...this.partnerHand, this.passedToPartner!]);
    const nextBefore = hasBomb(this.nextHand);
    const nextAfter = nextBefore || hasBomb([...this.nextHand, this.passedToNext!]);
    return html`
      <div class="passed">
        <div class="passedCard partner">
          <tichu-card .card=${this.passedToPartner}></tichu-card>
          <div class=${classMap({ bomb: partnerAfter && !partnerBefore })}>Partner</div>
        </div>
        <div class="small">
          <div class="passedCard">
            <tichu-card half .card=${this.passedToPrevious}></tichu-card>
            <div class=${classMap({ bomb: prevAfter && !prevBefore })}>Prev</div>
          </div>
          <div class="passedCard">
            <tichu-card half .card=${this.passedToNext}></tichu-card>
            <div class=${classMap({ bomb: nextAfter && !nextBefore })}>Next</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderBet() {
    switch (this.bet) {
      case Bet.INITIAL:
      case Bet.NO_BET_YET:
      case Bet.NO_BET:
        return html`<div></div>`;
      case Bet.TICHU:
        return html`<div class="bet tichu">Tichu</div>`;
      case Bet.GRAND_TICHU:
        return html`<div class="bet grandTichu">Grand Tichu</div>`;
    }
  }
}
customElements.define("tichu-player", TichuPlayer);
