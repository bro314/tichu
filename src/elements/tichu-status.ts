import { html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { button } from "./styles";
import { fire } from "./utils";

export class TichuStatus extends LitElement {
  @property({ type: Number }) roundCount = 0;
  @property({ type: Number }) trickCount = 0;
  @property({ type: Number }) trickPoints = 0;
  @property({ type: Number }) trickSize = 0;

  static override get styles() {
    return [button];
  }

  override render() {
    return html`
      <div>
        <div>Round: <span id="roundCounter">${this.roundCount}</span></div>
        <div>Trick: <span id="trickCounter">${this.trickCount}</span></div>
        <div>Trick Points: <span id="currentTrickCounter">${this.trickPoints}</span></div>
        <div>${this.renderButton()}</div>
      </div>
    `;
  }

  private renderButton() {
    if (this.trickSize === 0) return;
    return html`<button @click=${this.onShowClick}>Show current trick</button>`;
  }

  private onShowClick() {
    fire(this, "show-current-trick");
  }
}
customElements.define("tichu-status", TichuStatus);
