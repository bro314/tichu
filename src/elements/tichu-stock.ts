import { html, css, LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import { Card } from "./model";
import { scaleAnimMs, shouldAnimate } from "./tichu-animation-layer";
import "./tichu-card";
import type { TichuCard } from "./tichu-card";
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

  @property({ attribute: false }) externalHiddenIds: string[] = [];

  @property({ type: Boolean }) hideAllCards = false;

  @state() private containerWidth = 0;

  @state() private pendingRevealIds: Set<string> = new Set();

  private prevRects: Map<string, DOMRect> = new Map();

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
        tichu-card[data-pending-reveal] {
          visibility: hidden;
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

  protected override willUpdate(changedProperties: PropertyValues) {
    super.willUpdate(changedProperties);
    if ((changedProperties.has("sortMode") || changedProperties.has("cards")) && this.shadowRoot) {
      this.prevRects.clear();
      if (!this.pass && !this.hideAllCards && shouldAnimate()) {
        const hiddenSet = new Set(this.externalHiddenIds.map(String));
        this.pendingRevealIds.forEach((id) => hiddenSet.add(id));
        const cardEls = Array.from(this.shadowRoot.querySelectorAll<TichuCard>("tichu-card"));
        for (const cardEl of cardEls) {
          if (cardEl.pass || cardEl.card?.id == null) continue;
          const id = String(cardEl.card.id);
          if (hiddenSet.has(id)) continue;
          this.prevRects.set(id, cardEl.getBoundingClientRect());
        }
      }
    }
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (changedProperties.has("dynamicOverlap")) {
      this.updateResizeObserver();
    }
    if (
      (changedProperties.has("sortMode") || changedProperties.has("cards")) &&
      this.prevRects.size > 0 &&
      !this.pass &&
      !this.hideAllCards &&
      shouldAnimate() &&
      this.shadowRoot
    ) {
      const hiddenSet = new Set(this.externalHiddenIds.map(String));
      this.pendingRevealIds.forEach((id) => hiddenSet.add(id));
      const durationMs = Math.max(12, scaleAnimMs(220));
      const baseWidth = Math.max(1, 100 * this.scale);
      const cardEls = Array.from(this.shadowRoot.querySelectorAll<TichuCard>("tichu-card"));
      for (const cardEl of cardEls) {
        if (cardEl.pass || cardEl.card?.id == null) continue;
        const id = String(cardEl.card.id);
        if (hiddenSet.has(id)) continue;
        const prev = this.prevRects.get(id);
        if (!prev) continue;

        if (typeof cardEl.getAnimations === "function") {
          for (const anim of cardEl.getAnimations()) {
            anim.cancel();
          }
        }
        const next = cardEl.getBoundingClientRect();
        const zoomFactor = next.width > 0 ? next.width / baseWidth : 1;
        const dx = (prev.left - next.left) / zoomFactor;
        const dy = (prev.top - next.top) / zoomFactor;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          cardEl.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
            {
              duration: durationMs,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            },
          );
          const prevFlipCount = Number(this.getAttribute("data-flip-count") || "0");
          this.setAttribute("data-flip-count", String(prevFlipCount + 1));
        }
      }
    }
    this.prevRects.clear();
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
    const hiddenSet = new Set(this.externalHiddenIds.map((id) => String(id)));
    this.pendingRevealIds.forEach((id) => hiddenSet.add(id));

    return html`
      <div
        id="stock"
        class=${classMap({
          bomb: hasBomb(this.cards),
        })}
      >
        ${repeat(
          sortedCards,
          (card) => String(card.id ?? ""),
          (card) => {
            const cardIdStr = String(card.id ?? "");
            const isHidden = this.hideAllCards || hiddenSet.has(cardIdStr);
            return html`
              <tichu-card
                data-card-id=${cardIdStr}
                ?data-pending-reveal=${isHidden}
                .card=${card}
                .scale=${this.scale}
                .tiki=${this.tiki}
                .selectable=${isSelectable}
                .selected=${isSelectable && selectedSet.has(cardIdStr)}
                .wishMatch=${
                  this.highlightedRank >= 2 &&
                  this.highlightedRank <= 14 &&
                  Number(card.type_arg) === this.highlightedRank
                }
                @card-click=${(e: CustomEvent<{ card: Card }>) => this.onCardClick(e, card)}
              ></tichu-card>
            `;
          },
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

  getCardRects(cardIds?: Array<string | number>): Map<number, DOMRect> {
    const result = new Map<number, DOMRect>();
    if (!this.shadowRoot) return result;
    const filter = cardIds ? new Set(cardIds.map((id) => Number(id))) : null;
    const cardEls = Array.from(this.shadowRoot.querySelectorAll<TichuCard>("tichu-card"));
    for (const cardEl of cardEls) {
      if (cardEl.pass || cardEl.card?.id == null) continue;
      const numId = Number(cardEl.card.id);
      if (Number.isNaN(numId)) continue;
      if (filter && !filter.has(numId)) continue;
      const innerCard = cardEl.shadowRoot?.getElementById("card");
      const rect = innerCard ? innerCard.getBoundingClientRect() : cardEl.getBoundingClientRect();
      result.set(numId, rect);
    }
    return result;
  }

  markPendingReveal(cardIds: Array<string | number>): void {
    if (!cardIds || cardIds.length === 0) return;
    const next = new Set(this.pendingRevealIds);
    for (const id of cardIds) {
      next.add(String(id));
    }
    this.pendingRevealIds = next;
  }

  revealCards(cardIds?: Array<string | number>): void {
    if (!cardIds) {
      if (this.pendingRevealIds.size > 0) {
        this.pendingRevealIds = new Set();
      }
      return;
    }
    if (this.pendingRevealIds.size === 0) return;
    const next = new Set(this.pendingRevealIds);
    let changed = false;
    for (const id of cardIds) {
      if (next.delete(String(id))) {
        changed = true;
      }
    }
    if (changed) {
      this.pendingRevealIds = next;
    }
  }
}
customElements.define("tichu-stock", TichuStock);
