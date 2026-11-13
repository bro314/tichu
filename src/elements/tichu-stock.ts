import { html, css, LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Card } from "./model";
import "./tichu-card";
import { hasBomb } from "./utils";

export function getWeightByRank(card: Card): number {
  const color = Number(card.type);
  const value = Number(card.type_arg);
  return 2 * (4 * (value - 1) + (color - 1));
}

export function getWeightByColor(card: Card): number {
  const color = Number(card.type);
  const value = Number(card.type_arg);
  const type = (color - 1) * 14 + (value - 1);
  return value === 1 ? 2 * type : 100 + 2 * type;
}

export class TichuStock extends LitElement {
  @property({ type: Array }) cards: Card[] = [];

  @property({ type: Boolean }) pass = false;

  @property({ type: Number }) scale = 1.0;

  @property({ type: Boolean }) tiki = false;

  @property({ type: String }) sortMode: "rank" | "color" | "preserve" = "rank";

  @property({ type: Number }) selectionMode: 0 | 1 | 2 = 0;

  @property({ type: Array }) selectedIds: string[] = [];

  @property({ type: Boolean }) dynamicOverlap = false;

  @property({ type: Number }) highlightedRank = 0;

  @state() private containerWidth = 0;

  private resizeObserver?: ResizeObserver;

  static override get styles() {
    return [
      css`
        :host {
          display: block;
        }
        div#stock {
          display: flex;
          height: var(--stock-height, 150px);
        }
        div#stock.bomb {
          /* border-left: 15px solid red; */
        }
        tichu-card:not(:last-child) {
          margin-right: var(--card-margin-right, -75px);
        }
        tichu-card {
          zoom: 1;
        }
      `,
    ];
  }

  override connectedCallback() {
    super.connectedCallback();
    this.updateResizeObserver();
  }

  override disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    super.disconnectedCallback();
  }

  override updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    if (changedProperties.has("dynamicOverlap")) {
      this.updateResizeObserver();
    }
  }

  private updateResizeObserver() {
    if (this.dynamicOverlap && typeof ResizeObserver !== "undefined") {
      if (!this.resizeObserver) {
        this.resizeObserver = new ResizeObserver(() => {
          const w = this.clientWidth;
          if (w !== this.containerWidth) {
            this.containerWidth = w;
          }
        });
        this.resizeObserver.observe(this);
      }
    } else {
      this.resizeObserver?.disconnect();
      this.resizeObserver = undefined;
    }
  }

  private getSortedCards(): Card[] {
    if (this.sortMode === "preserve") {
      return [...this.cards];
    }
    if (this.sortMode === "color") {
      return [...this.cards].sort((a, b) => getWeightByColor(a) - getWeightByColor(b));
    }
    return [...this.cards].sort((a, b) => getWeightByRank(a) - getWeightByRank(b));
  }

  private computeMarginRightPx(): number {
    const itemWidth = 100 * this.scale;
    const itemMargin = 5;

    if (!this.dynamicOverlap) {
      return -75 * this.scale;
    }

    if (this.cards.length <= 1) {
      return 0;
    }

    const width = this.containerWidth || this.clientWidth || 600;
    const availableWidthForOverlapPerItem =
      (width - (itemWidth + itemMargin)) / (this.cards.length - 1);
    let overlap = Math.floor(
      ((availableWidthForOverlapPerItem - itemMargin - 1) / itemWidth) * 100,
    );
    if (overlap > 60) overlap = 60;
    if (overlap < 12) overlap = 12;

    const step = Math.round((itemWidth * overlap) / 100) + itemMargin;
    return step - itemWidth;
  }

  override render() {
    const itemHeight = 150 * this.scale;
    const marginRight = this.computeMarginRightPx();
    this.style.setProperty("--stock-height", `${itemHeight}px`);
    this.style.setProperty("--card-margin-right", `${marginRight}px`);

    if (this.pass) return this.renderPass();

    const sortedCards = this.getSortedCards();
    const isSelectable = this.selectionMode > 0;
    const selectedSet = new Set(this.selectedIds.map((id) => String(id)));

    return html`
      <div
        id="stock"
        class=${classMap({
          bomb: hasBomb(this.cards),
        })}
      >
        ${sortedCards.map(
          (card) => html`
            <tichu-card
              .card=${card}
              .scale=${this.scale}
              .tiki=${this.tiki}
              .selectable=${isSelectable}
              .selected=${isSelectable && selectedSet.has(String(card.id))}
              .wishMatch=${
                this.highlightedRank >= 2 &&
                this.highlightedRank <= 14 &&
                Number(card.type_arg) === this.highlightedRank
              }
              @card-click=${(e: CustomEvent<{ card: Card }>) => this.onCardClick(e, card)}
            ></tichu-card>
          `,
        )}
      </div>
    `;
  }

  renderPass() {
    return html`<div id="stock">
      <tichu-card pass .scale=${this.scale} .tiki=${this.tiki}></tichu-card>
    </div>`;
  }

  private onCardClick(e: CustomEvent<{ card: Card }>, card: Card) {
    e.stopPropagation();
    if (this.selectionMode === 0) return;

    const cardId = String(card.id);
    const currentlySelected = this.selectedIds.map((id) => String(id));
    const isAlreadySelected = currentlySelected.includes(cardId);

    let nextSelectedIds: string[];
    if (this.selectionMode === 1) {
      nextSelectedIds = isAlreadySelected ? [] : [cardId];
    } else {
      nextSelectedIds = isAlreadySelected
        ? currentlySelected.filter((id) => id !== cardId)
        : [...currentlySelected, cardId];
    }

    this.selectedIds = nextSelectedIds;
    this.dispatchEvent(
      new CustomEvent("selection-change", {
        detail: {
          selectedIds: nextSelectedIds,
          clickedCard: card,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  unselectAll() {
    this.selectedIds = [];
  }

  selectItem(id: string | number) {
    const strId = String(id);
    if (this.selectionMode === 1) {
      this.selectedIds = [strId];
    } else if (!this.selectedIds.includes(strId)) {
      this.selectedIds = [...this.selectedIds, strId];
    }
  }

  unselectItem(id: string | number) {
    const strId = String(id);
    this.selectedIds = this.selectedIds.filter((x) => String(x) !== strId);
  }

  getSelectedIds(): string[] {
    return [...this.selectedIds];
  }

  getSelectedCards(): Card[] {
    const selectedSet = new Set(this.selectedIds.map((id) => String(id)));
    return this.cards.filter((c) => selectedSet.has(String(c.id)));
  }
}
customElements.define("tichu-stock", TichuStock);
