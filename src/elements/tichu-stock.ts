import { html, css, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { Card } from "./model";
import "./tichu-card";
import { hasBomb } from "./utils";
import { classMap } from "lit/directives/class-map.js";

function sortFn(c: Card, d: Card) {
  const cRank = Number(c.type_arg);
  const dRank = Number(d.type_arg);
  if (cRank != dRank) return cRank - dRank;

  const cColor = Number(c.type);
  const dColor = Number(d.type);
  return cColor - dColor;
}

export class TichuStock extends LitElement {
  @property({ type: Array }) cards: Card[] = [];

  @property({ type: Boolean }) pass?: boolean;

  static override get styles() {
    return [
      css`
        :host {
          display: block;
        }
        div#stock {
          display: flex;
          height: 150px;
        }
        div#stock.bomb {
          /* border-left: 15px solid red; */
        }
        tichu-card:not(:last-child) {
          margin-right: -75px;
        }
        tichu-card {
          zoom: 1;
        }
      `,
    ];
  }

  override render() {
    if (this.pass) return this.renderPass();
    return html`
      <div
        id="stock"
        class=${classMap({
          bomb: hasBomb(this.cards),
        })}
      >
        ${this.cards.sort(sortFn).map((card) => html`<tichu-card .card=${card}></tichu-card>`)}
      </div>
    `;
  }

  renderPass() {
    return html`<div id="stock"><tichu-card pass></tichu-card></div>`;
  }
}
customElements.define("tichu-stock", TichuStock);
