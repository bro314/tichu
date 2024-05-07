import { html, LitElement } from "lit";

export class TichuElement extends LitElement {
  override render() {
    return html`<div>Hello, lit world?</div>` as unknown as symbol;
  }
}
customElements.define("tichu-element", TichuElement);
