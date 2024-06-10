import { html, css, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { Card } from "./model";

export class TichuCard extends LitElement {
  @property({ type: Object }) card: Card | undefined;

  @property({ type: Boolean }) pass?: boolean;

  @property({ type: Boolean }) half?: boolean;

  static override get styles() {
    const url = "";
    return [
      css`
        div#card {
          width: var(--width);
          height: var(--height);
          background-image: var(--card-url);
          background-position-x: var(--x-pos);
          background-position-y: var(--y-pos);
          border-radius: calc(var(--width) / 25);
          box-shadow: 2px 2px 5px 2px #666;
        }
        div#card.pass {
          background-size: cover;
        }
      `,
    ];
  }

  override render() {
    const width = 100;
    const height = 150;
    const factor = this.half ? 0.5 : 1.0;
    this.style.setProperty("--width", `${factor * width}px`);
    this.style.setProperty("--height", `${factor * height}px`);

    if (this.pass) return this.renderPass();
    if (this.card === undefined) return;

    // 1: black (or dragon), 2: red (or phoenix), 3: blue (or dog), 4: green (or mahjong)
    const color = Number(this.card?.type);
    // 1-14 (1: special card, 14: Ace)
    const rank = Number(this.card?.type_arg);
    this.style.setProperty("--x-pos", `${-1 * width * (rank - 1)}px`);
    this.style.setProperty("--y-pos", `${-1 * height * (color - 1)}px`);
    return html`<div id="card" @click=${this.onClick}></div>`;
  }

  renderPass() {
    this.style.setProperty("--card-url", `url(${g_gamethemeurl}img/tichu-icons-pass.png)`);
    return html`<div id="card" class="pass"></div>`;
  }

  private onClick() {}
}
customElements.define("tichu-card", TichuCard);
