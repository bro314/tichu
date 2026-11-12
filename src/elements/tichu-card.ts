import { html, css, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Card } from "./model";

function translate(text: string): string {
  return typeof _ === "function" ? _(text) : text;
}

export function getDefaultCardTooltip(card: Card | undefined): string {
  if (!card) return "";
  const color = Number(card.type);
  const rank = Number(card.type_arg);
  if (rank === 10 || rank === 13) return translate("Scores 10 points");
  if (rank === 5) return translate("Scores 5 points");
  if (rank === 1) {
    if (color === 1)
      return translate(
        "Highest single card. Scores 25 points. Trick given to an opponent if Dragon wins it.",
      );
    if (color === 2)
      return translate(
        "Scores -25 points. Takes the place of any normal card in a combo but not a bomb. As a Single, worth 1.5 when led, beats any other card but the Dragon by 0.5.",
      );
    if (color === 3)
      return translate(
        "The Hound must be played as a leading single card. Player's partner (or the next one if he's gone out) can lead.",
      );
    if (color === 4)
      return translate("Scores 0 points. Owner of this card plays first. Player can make a wish.");
  }
  return "";
}

export class TichuCard extends LitElement {
  @property({ type: Object }) card: Card | undefined;

  @property({ type: Boolean }) pass = false;

  @property({ type: Boolean }) half = false;

  @property({ type: Number }) scale = 1.0;

  @property({ type: Boolean }) selected = false;

  @property({ type: Boolean }) selectable = false;

  @property({ type: Boolean }) tiki = false;

  @property({ type: String }) tooltip = "";

  static override get styles() {
    return [
      css`
        :host {
          display: inline-block;
          position: relative;
        }
        div#card {
          position: relative;
          top: 0;
          width: var(--width);
          height: var(--height);
          background-image: var(--card-url);
          background-size: var(--bg-width) var(--bg-height);
          background-position-x: var(--x-pos);
          background-position-y: var(--y-pos);
          border-radius: calc(var(--width) / 25);
          box-shadow: 2px 2px 5px 2px #666;
          box-sizing: border-box;
        }
        div#card.selectable {
          cursor: pointer;
        }
        div#card.stockitem_selected {
          translate: 0 -20px;
          border: 1px solid #dda !important;
          box-shadow: 0px 0px 4px 1px #ff8;
        }
        div#card.pass {
          background-size: cover;
          background-position: center;
        }
      `,
    ];
  }

  getComputedTooltip(): string {
    if (this.tooltip) return this.tooltip;
    if (this.pass) return translate("Pass");
    return getDefaultCardTooltip(this.card);
  }

  override render() {
    const baseWidth = 100;
    const baseHeight = 150;
    const factor = this.half ? 0.5 : this.scale;
    const width = factor * baseWidth;
    const height = factor * baseHeight;
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";

    this.style.setProperty("--width", `${width}px`);
    this.style.setProperty("--height", `${height}px`);
    this.style.setProperty("--bg-width", `${14 * width}px`);
    this.style.setProperty("--bg-height", `${4 * height}px`);

    if (this.pass) return this.renderPass(themeUrl);
    if (this.card === undefined) return;

    const cardSprite = this.tiki ? "img/tiki-cards.png" : "img/tichu-cards.png";
    this.style.setProperty("--card-url", `url(${themeUrl}${cardSprite})`);

    // 1: black (or dragon), 2: red (or phoenix), 3: blue (or dog), 4: green (or mahjong)
    const color = Number(this.card.type);
    // 1-14 (1: special card, 14: Ace)
    const rank = Number(this.card.type_arg);
    this.style.setProperty("--x-pos", `${-1 * width * (rank - 1)}px`);
    this.style.setProperty("--y-pos", `${-1 * height * (color - 1)}px`);

    const tooltipText = this.getComputedTooltip();

    return html`<div
      id="card"
      class=${classMap({
        card: true,
        stockitem: true,
        stockitem_selected: this.selected,
        selectable: this.selectable,
      })}
      data-card-id=${this.card.id ?? ""}
      title=${tooltipText}
      @click=${this.onClick}
    ></div>`;
  }

  renderPass(themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "") {
    const passSprite = this.tiki ? "img/tiki-icons-pass.png" : "img/tichu-icons-pass.png";
    this.style.setProperty("--card-url", `url(${themeUrl}${passSprite})`);
    return html`<div
      id="card"
      class="card stockitem pass"
      data-card-id=""
      title=${this.getComputedTooltip()}
    ></div>`;
  }

  private onClick(e: MouseEvent) {
    if (!this.selectable || !this.card) return;
    this.dispatchEvent(
      new CustomEvent("card-click", {
        detail: { card: this.card },
        bubbles: true,
        composed: true,
      }),
    );
  }
}
customElements.define("tichu-card", TichuCard);
