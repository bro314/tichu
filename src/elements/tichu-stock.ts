import { html, css, LitElement, PropertyValues, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import type { AutoSortOrder, CardGroupId, HandSortOrder } from "./game-model";
import { Card } from "./model";
import { ANIM_TIMINGS } from "./anim-timings";
import { scaleAnimMs, shouldAnimate } from "./tichu-animation-layer";
import "./tichu-card";
import type { PassedOriginInfo, TichuCard } from "./tichu-card";
import { getTooltipLayer } from "./tichu-tooltip-layer";
import { hasBomb } from "./utils";

export const GROUP_GAP_PX = 22;
export const DRAG_DEADZONE_PX = 16;

export type StockRowMode = "auto" | "single" | "two";

export function computeCardVisibleWidthPx(itemWidth: number, marginRight: number): number {
  return Math.min(itemWidth, Math.max(16, itemWidth + marginRight));
}

export function getLogicalRankWeight(card: Card): number {
  const color = Number(card.type);
  const value = Number(card.type_arg);
  if (value === 1) {
    if (color === 3) return 0; // Dog
    if (color === 4) return 1; // Mahjong
    if (color === 2) return 15; // Phoenix
    if (color === 1) return 16; // Dragon
  }
  return value;
}

export function getWeightByRank(card: Card): number {
  const color = Number(card.type);
  const logicalRank = getLogicalRankWeight(card);
  return 2 * (4 * logicalRank + (color - 1));
}

export function getWeightByRankDesc(card: Card): number {
  const color = Number(card.type);
  const logicalRank = getLogicalRankWeight(card);
  return 2 * (4 * (16 - logicalRank) + (color - 1));
}

export function getWeightByColor(card: Card): number {
  const color = Number(card.type);
  const value = Number(card.type_arg);
  if (value === 1) {
    if (color === 3) return 0; // Dog
    if (color === 4) return 2; // Mahjong
    if (color === 2) return 200; // Phoenix
    if (color === 1) return 202; // Dragon
  }
  const type = (color - 1) * 14 + (value - 1);
  return 10 + 2 * type;
}

export function getWeightByColorDesc(card: Card): number {
  const color = Number(card.type);
  const value = Number(card.type_arg);
  if (value === 1) {
    if (color === 1) return 0; // Dragon
    if (color === 2) return 2; // Phoenix
    if (color === 4) return 200; // Mahjong
    if (color === 3) return 202; // Dog
  }
  const type = (color - 1) * 14 + (14 - value);
  return 10 + 2 * type;
}

export function compareCardsByAutoSort(a: Card, b: Card, mode: AutoSortOrder): number {
  switch (mode) {
    case "rank-desc":
      return getWeightByRankDesc(a) - getWeightByRankDesc(b);
    case "color":
      return getWeightByColor(a) - getWeightByColor(b);
    case "color-desc":
      return getWeightByColorDesc(a) - getWeightByColorDesc(b);
    case "rank":
    default:
      return getWeightByRank(a) - getWeightByRank(b);
  }
}

function getGroupSortPriority(groupId: number | undefined): number {
  if (groupId === 1 || groupId === 2 || groupId === 3 || groupId === 4) {
    return groupId;
  }
  return 5; // Ungrouped last
}

export function sortHandCards(
  cards: Card[],
  sortMode: HandSortOrder,
  baseSortOrder: AutoSortOrder = "rank",
  customOrder: string[] = [],
  cardGroups: Record<string, CardGroupId> = {},
): Card[] {
  const hasGroups = Object.keys(cardGroups).length > 0;
  if (sortMode === "preserve" && customOrder.length === 0 && !hasGroups) {
    return [...cards];
  }

  const customIndexMap = new Map<string, number>();
  customOrder.forEach((id, idx) => customIndexMap.set(String(id), idx));

  return [...cards].sort((a, b) => {
    const idA = String(a.id ?? "");
    const idB = String(b.id ?? "");
    const gA = getGroupSortPriority(cardGroups[idA]);
    const gB = getGroupSortPriority(cardGroups[idB]);
    if (gA !== gB) return gA - gB;

    if (sortMode === "preserve") {
      const idxA = customIndexMap.get(idA);
      const idxB = customIndexMap.get(idB);
      if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
      if (idxA !== undefined) return -1;
      if (idxB !== undefined) return 1;
      return compareCardsByAutoSort(a, b, baseSortOrder);
    }

    return compareCardsByAutoSort(a, b, sortMode);
  });
}

export function computeDropTarget(
  pointerX: number,
  slotMidpoints: number[],
  fromIndex: number,
  cardGroupList: number[] = [],
): { dropIndex: number; targetGroup: CardGroupId | 0 } {
  const n = slotMidpoints.length;
  if (n === 0) return { dropIndex: 0, targetGroup: 0 };

  let dropIndex = 0;
  const remainingIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === fromIndex) continue;
    remainingIndices.push(i);
    if (pointerX > slotMidpoints[i]!) {
      dropIndex++;
    }
  }

  const rawOrigGroup = cardGroupList[fromIndex] ?? 0;
  const originalGroup: CardGroupId | 0 =
    rawOrigGroup >= 1 && rawOrigGroup <= 4 ? (rawOrigGroup as CardGroupId) : 0;

  if (dropIndex === fromIndex) {
    return { dropIndex, targetGroup: originalGroup };
  }

  const remCount = remainingIndices.length;
  if (remCount === 0) {
    return { dropIndex: 0, targetGroup: originalGroup };
  }

  const groupOfOrig = (origIdx: number): CardGroupId | 0 => {
    const g = cardGroupList[origIdx] ?? 0;
    return g >= 1 && g <= 4 ? (g as CardGroupId) : 0;
  };

  if (dropIndex === 0) {
    return { dropIndex, targetGroup: groupOfOrig(remainingIndices[0]!) };
  }
  if (dropIndex >= remCount) {
    return { dropIndex: remCount, targetGroup: groupOfOrig(remainingIndices[remCount - 1]!) };
  }

  const leftOrig = remainingIndices[dropIndex - 1]!;
  const rightOrig = remainingIndices[dropIndex]!;
  const leftGroup = groupOfOrig(leftOrig);
  const rightGroup = groupOfOrig(rightOrig);
  if (leftGroup === rightGroup) {
    return { dropIndex, targetGroup: leftGroup };
  }
  const boundaryMid = (slotMidpoints[leftOrig]! + slotMidpoints[rightOrig]!) / 2;
  return {
    dropIndex,
    targetGroup: pointerX <= boundaryMid ? leftGroup : rightGroup,
  };
}

export interface DropSlot2D {
  midX: number;
  midY: number;
  row: number;
}

export function computeDropTarget2D(
  pointerX: number,
  pointerY: number,
  slots: DropSlot2D[],
  fromIndex: number,
  cardGroupList: number[] = [],
): { dropIndex: number; targetGroup: CardGroupId | 0; targetRow: number } {
  const n = slots.length;
  if (n === 0) return { dropIndex: 0, targetGroup: 0, targetRow: 0 };

  const rowSums = new Map<number, { sumY: number; count: number }>();
  for (const s of slots) {
    const entry = rowSums.get(s.row) ?? { sumY: 0, count: 0 };
    entry.sumY += s.midY;
    entry.count++;
    rowSums.set(s.row, entry);
  }
  let targetRow = slots[0]!.row;
  let bestDist = Infinity;
  rowSums.forEach((entry, row) => {
    const avgY = entry.sumY / entry.count;
    const dist = Math.abs(pointerY - avgY);
    if (dist < bestDist) {
      bestDist = dist;
      targetRow = row;
    }
  });

  let dropIndex = 0;
  const remainingIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === fromIndex) continue;
    remainingIndices.push(i);
    const s = slots[i]!;
    if (s.row < targetRow || (s.row === targetRow && pointerX > s.midX)) {
      dropIndex++;
    }
  }

  const rawOrigGroup = cardGroupList[fromIndex] ?? 0;
  const originalGroup: CardGroupId | 0 =
    rawOrigGroup >= 1 && rawOrigGroup <= 4 ? (rawOrigGroup as CardGroupId) : 0;

  if (dropIndex === fromIndex && slots[fromIndex]?.row === targetRow) {
    return { dropIndex, targetGroup: originalGroup, targetRow };
  }

  const remCount = remainingIndices.length;
  if (remCount === 0) {
    return { dropIndex: 0, targetGroup: originalGroup, targetRow };
  }

  const groupOfOrig = (origIdx: number): CardGroupId | 0 => {
    const g = cardGroupList[origIdx] ?? 0;
    return g >= 1 && g <= 4 ? (g as CardGroupId) : 0;
  };

  if (dropIndex === 0) {
    return { dropIndex, targetGroup: groupOfOrig(remainingIndices[0]!), targetRow };
  }
  if (dropIndex >= remCount) {
    return {
      dropIndex: remCount,
      targetGroup: groupOfOrig(remainingIndices[remCount - 1]!),
      targetRow,
    };
  }

  const leftOrig = remainingIndices[dropIndex - 1]!;
  const rightOrig = remainingIndices[dropIndex]!;
  const leftGroup = groupOfOrig(leftOrig);
  const rightGroup = groupOfOrig(rightOrig);
  if (leftGroup === rightGroup) {
    return { dropIndex, targetGroup: leftGroup, targetRow };
  }

  const leftRow = slots[leftOrig]!.row;
  const rightRow = slots[rightOrig]!.row;
  if (leftRow !== rightRow) {
    return {
      dropIndex,
      targetGroup: leftRow === targetRow ? leftGroup : rightGroup,
      targetRow,
    };
  }

  const boundaryMid = (slots[leftOrig]!.midX + slots[rightOrig]!.midX) / 2;
  return {
    dropIndex,
    targetGroup: pointerX <= boundaryMid ? leftGroup : rightGroup,
    targetRow,
  };
}

export interface StockLayout {
  twoRows: boolean;
  row1Count: number;
  effectiveScale: number;
  itemWidth: number;
  itemHeight: number;
  marginRight: number;
  visibleWidth: number;
  boundaryVisibleWidth: number;
  rowGapPx: number;
}

function getCardGroupFromMap(cardGroups: Record<string, CardGroupId>, card: Card): CardGroupId | 0 {
  const g = cardGroups[String(card.id ?? "")];
  return g === 1 || g === 2 || g === 3 || g === 4 ? g : 0;
}

function countBoundariesForCards(cards: Card[], cardGroups: Record<string, CardGroupId>): number {
  if (cards.length <= 1) return 0;
  let count = 0;
  for (let i = 0; i < cards.length - 1; i++) {
    if (
      getCardGroupFromMap(cardGroups, cards[i]!) !== getCardGroupFromMap(cardGroups, cards[i + 1]!)
    ) {
      count++;
    }
  }
  return count;
}

function computeMarginRightForCards(
  cards: Card[],
  scale: number,
  containerWidth: number,
  cardGroups: Record<string, CardGroupId>,
  dynamicOverlap: boolean,
  fixedOverlap: number,
): number {
  const itemWidth = 100 * scale;

  if (!dynamicOverlap) {
    return -fixedOverlap * scale;
  }
  if (cards.length <= 1) {
    return 0;
  }

  const boundaryCount = countBoundariesForCards(cards, cardGroups);
  const availWidth = containerWidth > 0 ? containerWidth : 600;
  const usableWidth = Math.max(itemWidth + 24, availWidth - boundaryCount * GROUP_GAP_PX - 2);
  const rawStep = (usableWidth - itemWidth) / (cards.length - 1);
  const minStep = Math.max(12, Math.round(itemWidth * 0.14));
  const maxStep = Math.round(itemWidth * 0.65);
  const step = Math.max(minStep, Math.min(maxStep, Math.floor(rawStep * 10) / 10));

  return Math.round((step - itemWidth) * 10) / 10;
}

export function computeStockLayout(params: {
  sortedCards: Card[];
  scale: number;
  containerWidth: number;
  cardGroups: Record<string, CardGroupId>;
  dynamicOverlap: boolean;
  overlap: number;
  wrapRows: boolean;
  reserveFooter: boolean;
  rowMode?: StockRowMode;
}): StockLayout {
  const {
    sortedCards,
    scale,
    containerWidth,
    cardGroups,
    dynamicOverlap,
    overlap,
    wrapRows,
    reserveFooter,
    rowMode = "auto",
  } = params;

  const effectiveScale =
    wrapRows && containerWidth > 0 && containerWidth < 430 ? Math.min(scale, 0.75) : scale;
  const singleMargin = computeMarginRightForCards(
    sortedCards,
    effectiveScale,
    containerWidth,
    cardGroups,
    dynamicOverlap,
    overlap,
  );
  const singleVisibleSlice = 100 * effectiveScale + singleMargin;
  let twoRows = false;
  if (wrapRows) {
    if (rowMode === "two") {
      twoRows = sortedCards.length >= 2;
    } else if (rowMode === "single") {
      twoRows = false;
    } else {
      twoRows = Boolean(
        sortedCards.length >= 8 && containerWidth > 0 && singleVisibleSlice < 42 * effectiveScale,
      );
    }
  }

  if (!twoRows) {
    const itemWidth = 100 * effectiveScale;
    const itemHeight = 150 * effectiveScale;
    return {
      twoRows: false,
      row1Count: sortedCards.length,
      effectiveScale,
      itemWidth,
      itemHeight,
      marginRight: singleMargin,
      visibleWidth: computeCardVisibleWidthPx(itemWidth, singleMargin),
      boundaryVisibleWidth: computeCardVisibleWidthPx(itemWidth, singleMargin + GROUP_GAP_PX),
      rowGapPx: 0,
    };
  }

  const row1Count = Math.ceil(sortedCards.length / 2);
  const row1 = sortedCards.slice(0, row1Count);
  const row2 = sortedCards.slice(row1Count);
  const row1Margin = computeMarginRightForCards(
    row1,
    effectiveScale,
    containerWidth,
    cardGroups,
    dynamicOverlap,
    overlap,
  );
  const row2Margin = computeMarginRightForCards(
    row2,
    effectiveScale,
    containerWidth,
    cardGroups,
    dynamicOverlap,
    overlap,
  );
  const marginRight = Math.min(row1Margin, row2Margin);
  const itemWidth = 100 * effectiveScale;
  const itemHeight = 150 * effectiveScale;

  return {
    twoRows: true,
    row1Count,
    effectiveScale,
    itemWidth,
    itemHeight,
    marginRight,
    visibleWidth: computeCardVisibleWidthPx(itemWidth, marginRight),
    boundaryVisibleWidth: computeCardVisibleWidthPx(itemWidth, marginRight + GROUP_GAP_PX),
    rowGapPx: reserveFooter ? (effectiveScale < 1 ? 8 : 10) : 24,
  };
}

export interface GroupStripeSpan {
  groupId: CardGroupId;
  startIndex: number;
  endIndex: number;
  leftPx: number;
  widthPx: number;
  cardIds: string[];
}

export function computeGroupStripes(
  sortedCards: Card[],
  cardGroups: Record<string, CardGroupId>,
  itemWidth: number,
  marginRight: number,
  groupGapPx: number = GROUP_GAP_PX,
): GroupStripeSpan[] {
  const n = sortedCards.length;
  if (n === 0) return [];

  const getGrp = (idx: number): CardGroupId | 0 => {
    const g = cardGroups[String(sortedCards[idx]!.id ?? "")];
    return g === 1 || g === 2 || g === 3 || g === 4 ? g : 0;
  };

  const cardLeft: number[] = new Array(n);
  cardLeft[0] = 0;
  for (let i = 0; i < n - 1; i++) {
    const gap = getGrp(i) !== getGrp(i + 1) ? groupGapPx : 0;
    cardLeft[i + 1] = cardLeft[i]! + itemWidth + marginRight + gap;
  }

  const stripes: GroupStripeSpan[] = [];
  let i = 0;
  while (i < n) {
    const g = getGrp(i);
    if (g === 0) {
      i++;
      continue;
    }
    let end = i;
    const cardIds = [String(sortedCards[i]!.id ?? "")];
    while (end + 1 < n && getGrp(end + 1) === g) {
      end++;
      cardIds.push(String(sortedCards[end]!.id ?? ""));
    }
    const leftPx = cardLeft[i]!;
    const rawRight = cardLeft[end]! + itemWidth;
    const rightPx = end < n - 1 ? Math.min(rawRight, cardLeft[end + 1]! - 2) : rawRight;
    const widthPx = Math.max(24, rightPx - leftPx);
    stripes.push({
      groupId: g,
      startIndex: i,
      endIndex: end,
      leftPx,
      widthPx,
      cardIds,
    });
    i = end + 1;
  }
  return stripes;
}

export class TichuStock extends LitElement {
  @property({ type: Array }) cards: Card[] = [];

  @property({ type: Boolean }) pass = false;

  @property({ type: Number }) scale = 1.0;

  @property({ type: Boolean }) tiki = false;

  @property({ type: String }) sortMode: HandSortOrder = "rank";

  @property({ type: String }) baseSortOrder: AutoSortOrder = "rank";

  @property({ type: Boolean }) reorderable = false;

  @property({ attribute: false }) customOrder: string[] = [];

  @property({ attribute: false }) cardGroups: Record<string, CardGroupId> = {};

  @property({ type: Number }) selectionMode: 0 | 1 | 2 = 0;

  @property({ type: Array }) selectedIds: string[] = [];

  @property({ type: Boolean }) dynamicOverlap = false;

  @property({ type: Number }) overlap = 75;

  @property({ type: Number }) highlightedRank = 0;

  @property({ attribute: false }) externalHiddenIds: string[] = [];

  @property({ type: Boolean }) hideAllCards = false;

  @property({ type: Boolean }) reserveFooter = false;

  @property({ type: Boolean }) disableCardTooltips = false;

  @property({ type: Boolean }) wrapRows = false;

  @property({ type: String }) rowMode: StockRowMode = "auto";

  @property({ attribute: false }) passedOrigins: Record<string, PassedOriginInfo> = {};

  @state() private containerWidth = 0;

  @state() private pendingRevealIds: Set<string> = new Set();

  @state() private dragActive = false;

  @state() private dragCardId = "";

  @state() private dragFromIndex = -1;

  @state() private dragDropIndex = -1;

  @state() private dragFromRow = 0;

  @state() private dragTargetRow = 0;

  @state() private dragTargetGroup: CardGroupId | 0 = 0;

  @state() private dragDeltaX = 0;

  @state() private dragDeltaY = 0;

  @state() private dropIndicatorX: number | null = null;

  @state() private dropIndicatorRow = 0;

  @state() private suppressTranslateTransition = false;

  private lastEffectiveScale = 1.0;

  private lastComputedTwoRows = false;

  private lastEmittedTwoRows: boolean | null = null;

  private prevRects: Map<string, DOMRect> = new Map();

  private dragReleaseRects: Map<string, DOMRect> = new Map();

  private resizeObserver?: ResizeObserver;

  private suppressClickCardId: string | null = null;

  private suppressClickTimer: ReturnType<typeof setTimeout> | null = null;

  private pendingDrag: {
    pointerId: number;
    cardId: string;
    fromIndex: number;
    fromRow: number;
    twoRows: boolean;
    startX: number;
    startY: number;
    active: boolean;
    slotMidpoints: number[];
    slotMeta: Array<{ midX: number; midY: number; row: number; left: number; right: number }>;
    slotBounds: Array<{ left: number; right: number }>;
    cardGroupList: number[];
    cardStepPx: number;
    zoomFactor: number;
    stockLeft: number;
  } | null = null;

  static override get styles() {
    return [
      css`
        :host {
          display: block;
        }
        div#stock {
          position: relative;
          display: flex;
          justify-content: var(--stock-justify, flex-start);
          height: var(--stock-height, 150px);
        }
        div#stock.two-rows {
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          height: auto;
          padding-top: 20px;
          gap: var(--stock-row-gap, 10px);
        }
        .stock-row {
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .stock-row-inner {
          position: relative;
          display: inline-flex;
          height: var(--stock-height, 150px);
        }
        div#stock.reorderable {
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
        }
        div#stock.bomb {
          /* border-left: 15px solid red; */
        }
        tichu-card:not(:last-child) {
          margin-right: var(--card-margin-right, -75px);
        }
        tichu-card.group-boundary:not(:last-child) {
          margin-right: calc(var(--card-margin-right, -75px) + 22px);
          --card-visible-width: var(--card-boundary-visible-width, var(--stock-card-width, 100px));
        }
        tichu-card:last-child {
          --card-visible-width: var(--stock-card-width, 100px);
        }
        tichu-card {
          zoom: 1;
        }
        tichu-card[data-pending-reveal] {
          visibility: hidden;
        }
        .drop-indicator {
          position: absolute;
          top: -4px;
          width: 3px;
          height: calc(var(--stock-card-height, 150px) + 8px);
          border-radius: 999px;
          background: var(--tichu-select-ring, #0284c7);
          box-shadow: 0 0 8px var(--tichu-select-glow, rgba(56, 189, 248, 0.45));
          pointer-events: none;
          z-index: 25;
        }
        button.group-stripe-bar {
          position: absolute;
          top: calc(var(--stock-card-height, 150px) / 2 - 10px);
          height: 20px;
          z-index: 6;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border-radius: 5px;
          background: var(--group-color, #0284c7);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.88);
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.34);
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          line-height: 1;
          cursor: pointer;
          user-select: none;
          translate: 0 0;
          transition:
            translate var(--tichu-card-select-ms, 100ms)
              var(--tichu-anim-easing, cubic-bezier(0.22, 1, 0.36, 1)),
            filter 120ms ease;
        }
        button.group-stripe-bar.group-1 {
          --group-color: #0284c7;
        }
        button.group-stripe-bar.group-2 {
          --group-color: #d97706;
        }
        button.group-stripe-bar.group-3 {
          --group-color: #059669;
        }
        button.group-stripe-bar.group-4 {
          --group-color: #9333ea;
        }
        button.group-stripe-bar.all-selected {
          translate: 0 -20px;
        }
        button.group-stripe-bar:hover {
          filter: brightness(1.08);
        }
        button.group-stripe-bar:focus-visible {
          outline: 2.5px solid var(--tichu-select-ring, #0284c7);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          button.group-stripe-bar {
            transition: none;
          }
        }
        @media (forced-colors: active) {
          button.group-stripe-bar {
            background: Highlight;
            color: HighlightText;
            border-color: CanvasText;
          }
          button.group-stripe-bar:focus-visible {
            outline-color: Highlight;
          }
        }
      `,
    ];
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.clientWidth > 0 && this.clientWidth !== this.containerWidth) {
      this.containerWidth = this.clientWidth;
    }
    this.updateResizeObserver();
  }

  override disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.pendingDrag = null;
    this.clearSuppressClick();
    this.resetDragState();
    super.disconnectedCallback();
  }

  private clearSuppressClick() {
    this.suppressClickCardId = null;
    if (this.suppressClickTimer !== null) {
      clearTimeout(this.suppressClickTimer);
      this.suppressClickTimer = null;
    }
  }

  private armSuppressClick(cardId: string) {
    this.clearSuppressClick();
    this.suppressClickCardId = cardId;
    this.suppressClickTimer = setTimeout(() => {
      this.suppressClickCardId = null;
      this.suppressClickTimer = null;
    }, 50);
  }

  private resetDragState() {
    this.dragActive = false;
    this.dragCardId = "";
    this.dragFromIndex = -1;
    this.dragDropIndex = -1;
    this.dragFromRow = 0;
    this.dragTargetRow = 0;
    this.dragTargetGroup = 0;
    this.dragDeltaX = 0;
    this.dragDeltaY = 0;
    this.dropIndicatorX = null;
    this.dropIndicatorRow = 0;
  }

  protected override willUpdate(changedProperties: PropertyValues) {
    super.willUpdate(changedProperties);
    if (changedProperties.has("cards") && (this.pendingDrag || this.dragActive)) {
      const pointerId = this.pendingDrag?.pointerId;
      this.pendingDrag = null;
      this.resetDragState();
      this.dragReleaseRects.clear();
      if (pointerId !== undefined) {
        const stockEl = this.shadowRoot?.getElementById("stock");
        try {
          if (stockEl?.hasPointerCapture?.(pointerId)) {
            stockEl.releasePointerCapture(pointerId);
          }
        } catch (_e) {
          // ignore
        }
      }
    }

    const layoutChanged =
      changedProperties.has("sortMode") ||
      changedProperties.has("baseSortOrder") ||
      changedProperties.has("cards") ||
      changedProperties.has("customOrder") ||
      changedProperties.has("cardGroups") ||
      changedProperties.has("rowMode");

    if (layoutChanged && this.shadowRoot) {
      this.prevRects.clear();
      if (this.dragReleaseRects.size > 0) {
        this.dragReleaseRects.forEach((rect, id) => {
          this.prevRects.set(id, rect);
        });
        this.dragReleaseRects.clear();
      } else if (!this.pass && !this.hideAllCards && shouldAnimate()) {
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
    if (changedProperties.has("dynamicOverlap") || changedProperties.has("wrapRows")) {
      this.updateResizeObserver();
    }
    const layoutChanged =
      changedProperties.has("sortMode") ||
      changedProperties.has("baseSortOrder") ||
      changedProperties.has("cards") ||
      changedProperties.has("customOrder") ||
      changedProperties.has("cardGroups") ||
      changedProperties.has("rowMode");

    if (
      layoutChanged &&
      this.prevRects.size > 0 &&
      !this.pass &&
      !this.hideAllCards &&
      shouldAnimate() &&
      this.shadowRoot
    ) {
      const hiddenSet = new Set(this.externalHiddenIds.map(String));
      this.pendingRevealIds.forEach((id) => hiddenSet.add(id));
      const durationMs = Math.max(12, scaleAnimMs(ANIM_TIMINGS.handFlipMs));
      const baseWidth = Math.max(1, 100 * this.lastEffectiveScale);
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
              easing: ANIM_TIMINGS.easing,
            },
          );
          const prevFlipCount = Number(this.getAttribute("data-flip-count") || "0");
          this.setAttribute("data-flip-count", String(prevFlipCount + 1));
        }
      }
    }
    this.prevRects.clear();
    if (this.suppressTranslateTransition) {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
          this.suppressTranslateTransition = false;
        });
      } else {
        this.suppressTranslateTransition = false;
      }
    }
    if (this.lastComputedTwoRows !== this.lastEmittedTwoRows) {
      this.lastEmittedTwoRows = this.lastComputedTwoRows;
      this.dispatchEvent(
        new CustomEvent("layout-change", {
          detail: { twoRows: this.lastComputedTwoRows },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private updateResizeObserver() {
    if ((this.dynamicOverlap || this.wrapRows) && typeof ResizeObserver !== "undefined") {
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
    return sortHandCards(
      this.cards,
      this.sortMode,
      this.baseSortOrder,
      this.customOrder,
      this.cardGroups,
    );
  }

  private getGroupForCard(cardId: string): CardGroupId | 0 {
    const g = this.cardGroups[cardId];
    return g === 1 || g === 2 || g === 3 || g === 4 ? g : 0;
  }

  private getCardShiftX(idx: number, stepPx: number, twoRows = false): number {
    if (!this.dragActive || this.dragFromIndex < 0 || this.dragDropIndex < 0) return 0;
    if (twoRows && this.dragTargetRow !== this.dragFromRow) return 0;
    if (idx === this.dragFromIndex) return 0;
    if (this.dragFromIndex < this.dragDropIndex) {
      if (idx > this.dragFromIndex && idx <= this.dragDropIndex) {
        return -stepPx;
      }
    } else if (this.dragFromIndex > this.dragDropIndex) {
      if (idx >= this.dragDropIndex && idx < this.dragFromIndex) {
        return stepPx;
      }
    }
    return 0;
  }

  private getEffectiveContainerWidth(): number {
    return this.containerWidth || this.clientWidth || 0;
  }

  private computeCurrentLayout(sortedCards: Card[]): StockLayout {
    return computeStockLayout({
      sortedCards,
      scale: this.scale,
      containerWidth: this.getEffectiveContainerWidth(),
      cardGroups: this.cardGroups,
      dynamicOverlap: this.dynamicOverlap,
      overlap: this.overlap,
      wrapRows: this.wrapRows,
      reserveFooter: this.reserveFooter,
      rowMode: this.rowMode,
    });
  }

  private renderCardRowContent(
    rowCards: Card[],
    rowStartIndex: number,
    rowIdx: number,
    layout: StockLayout,
    isSelectable: boolean,
    selectedSet: Set<string>,
    hiddenSet: Set<string>,
    stepPx: number,
    groupStripeAriaPrefix: string,
  ) {
    const stripes =
      !this.dragActive && !this.hideAllCards
        ? computeGroupStripes(rowCards, this.cardGroups, layout.itemWidth, layout.marginRight)
        : [];
    const showIndicator =
      this.dragActive &&
      this.dropIndicatorX !== null &&
      (!layout.twoRows || this.dropIndicatorRow === rowIdx);

    return html`
      ${repeat(
        rowCards,
        (card) => String(card.id ?? ""),
        (card, localIdx) => {
          const idx = rowStartIndex + localIdx;
          const cardIdStr = String(card.id ?? "");
          const isHidden = this.hideAllCards || hiddenSet.has(cardIdStr);
          const group = this.getGroupForCard(cardIdStr);
          const nextCard = rowCards[localIdx + 1];
          const isGroupBoundary =
            nextCard !== undefined && group !== this.getGroupForCard(String(nextCard.id ?? ""));
          const isDragging = this.dragActive && cardIdStr === this.dragCardId;
          const shiftX = this.getCardShiftX(idx, stepPx, layout.twoRows);
          return html`
            <tichu-card
              data-card-id=${cardIdStr}
              class=${classMap({ "group-boundary": isGroupBoundary })}
              ?data-pending-reveal=${isHidden}
              .card=${card}
              .scale=${layout.effectiveScale}
              .tiki=${this.tiki}
              .selectable=${isSelectable}
              .reorderable=${this.reorderable && !this.hideAllCards}
              .selected=${isSelectable && selectedSet.has(cardIdStr)}
              .group=${group}
              .dragging=${isDragging}
              .dragX=${isDragging ? this.dragDeltaX : 0}
              .dragY=${isDragging ? this.dragDeltaY : 0}
              .shiftX=${shiftX}
              .noTransition=${this.suppressTranslateTransition}
              .wishMatch=${
                this.highlightedRank >= 2 &&
                this.highlightedRank <= 14 &&
                Number(card.type_arg) === this.highlightedRank
              }
              .reserveFooter=${this.reserveFooter}
              .disableTooltip=${this.disableCardTooltips}
              .passedOrigin=${this.passedOrigins[cardIdStr] ?? null}
              @card-click=${(e: CustomEvent<{ card: Card }>) => this.onCardClick(e, card)}
            ></tichu-card>
          `;
        },
      )}
      ${stripes.map((s) => {
        const allSelected =
          isSelectable && s.cardIds.length > 0 && s.cardIds.every((id) => selectedSet.has(id));
        return html`<button
          type="button"
          class=${classMap({
            "group-stripe-bar": true,
            [`group-${s.groupId}`]: true,
            "all-selected": allSelected,
          })}
          data-group-stripe=${s.groupId}
          style=${`left: ${s.leftPx}px; width: ${s.widthPx}px;`}
          aria-pressed=${allSelected ? "true" : "false"}
          aria-label=${`${groupStripeAriaPrefix} ${s.groupId}`}
          data-tooltip=${_("Select cards in group")}
          data-tooltip-tier="slow"
          data-tooltip-touch="longpress"
          @click=${(e: Event) => this.onGroupStripeClick(e, s.groupId)}
        >
          ${s.groupId}
        </button>`;
      })}
      ${
        showIndicator
          ? html`<div
              class="drop-indicator"
              aria-hidden="true"
              style="left: ${this.dropIndicatorX}px"
            ></div>`
          : nothing
      }
    `;
  }

  override render() {
    if (this.pass) {
      const itemWidth = 100 * this.scale;
      const itemHeight = 150 * this.scale;
      this.lastEffectiveScale = this.scale;
      this.lastComputedTwoRows = false;
      this.style.setProperty("--stock-height", `${itemHeight}px`);
      this.style.setProperty("--card-footer-height", "0px");
      this.style.setProperty("--stock-card-width", `${itemWidth}px`);
      this.style.setProperty("--stock-card-height", `${itemHeight}px`);
      return this.renderPass();
    }

    const sortedCards = this.getSortedCards();
    const layout = this.computeCurrentLayout(sortedCards);
    this.lastEffectiveScale = layout.effectiveScale;
    this.lastComputedTwoRows = layout.twoRows;
    const footerHeight = this.reserveFooter ? Math.round(34 * layout.effectiveScale) : 0;

    this.style.setProperty("--stock-height", `${layout.itemHeight + footerHeight}px`);
    this.style.setProperty("--card-footer-height", `${footerHeight}px`);
    this.style.setProperty("--stock-card-width", `${layout.itemWidth}px`);
    this.style.setProperty("--stock-card-height", `${layout.itemHeight}px`);
    this.style.setProperty("--card-visible-width", `${layout.visibleWidth}px`);
    this.style.setProperty("--card-boundary-visible-width", `${layout.boundaryVisibleWidth}px`);
    this.style.setProperty("--card-margin-right", `${layout.marginRight}px`);
    this.style.setProperty("--stock-row-gap", `${layout.rowGapPx}px`);

    const isSelectable = this.selectionMode > 0;
    const selectedSet = new Set(this.selectedIds.map((id) => String(id)));
    const hiddenSet = new Set(this.externalHiddenIds.map((id) => String(id)));
    this.pendingRevealIds.forEach((id) => hiddenSet.add(id));
    const stepPx = Math.max(16, layout.itemWidth + layout.marginRight);
    const groupStripeAriaPrefix = _("Select cards in group");

    if (layout.twoRows) {
      const row1Cards = sortedCards.slice(0, layout.row1Count);
      const row2Cards = sortedCards.slice(layout.row1Count);
      return html`
        <div
          id="stock"
          ?data-dragging-active=${this.dragActive}
          class=${classMap({
            "two-rows": true,
            bomb: hasBomb(this.cards),
            reorderable: this.reorderable && !this.hideAllCards,
          })}
          @pointerdown=${this.onStockPointerDown}
          @pointermove=${this.onStockPointerMove}
          @pointerup=${this.onStockPointerUp}
          @pointercancel=${this.onStockPointerCancel}
          @keydown=${this.onStockKeyDown}
        >
          <div class="stock-row">
            <div class="stock-row-inner" data-row="0">
              ${this.renderCardRowContent(
                row1Cards,
                0,
                0,
                layout,
                isSelectable,
                selectedSet,
                hiddenSet,
                stepPx,
                groupStripeAriaPrefix,
              )}
            </div>
          </div>
          <div class="stock-row">
            <div class="stock-row-inner" data-row="1">
              ${this.renderCardRowContent(
                row2Cards,
                layout.row1Count,
                1,
                layout,
                isSelectable,
                selectedSet,
                hiddenSet,
                stepPx,
                groupStripeAriaPrefix,
              )}
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <div
        id="stock"
        ?data-dragging-active=${this.dragActive}
        class=${classMap({
          bomb: hasBomb(this.cards),
          reorderable: this.reorderable && !this.hideAllCards,
        })}
        @pointerdown=${this.onStockPointerDown}
        @pointermove=${this.onStockPointerMove}
        @pointerup=${this.onStockPointerUp}
        @pointercancel=${this.onStockPointerCancel}
        @keydown=${this.onStockKeyDown}
      >
        ${this.renderCardRowContent(
          sortedCards,
          0,
          0,
          layout,
          isSelectable,
          selectedSet,
          hiddenSet,
          stepPx,
          groupStripeAriaPrefix,
        )}
      </div>
    `;
  }

  private onGroupStripeClick(e: Event, groupId: CardGroupId) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("group-stripe-click", {
        detail: { groupId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private findCardElementFromEvent(e: Event): TichuCard | null {
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    for (const node of path) {
      const el = node as HTMLElement | null;
      if (!el || typeof el.classList === "undefined") continue;
      if (
        el.classList.contains("passed-avatar-wrap") ||
        el.classList.contains("group-stripe-bar")
      ) {
        return null;
      }
      if (el.tagName === "TICHU-CARD") {
        return el as TichuCard;
      }
    }
    return null;
  }

  private onStockPointerDown(e: PointerEvent) {
    this.clearSuppressClick();
    if (!this.reorderable || this.pass || this.hideAllCards) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const cardEl = this.findCardElementFromEvent(e);
    const cardId = cardEl?.card?.id != null ? String(cardEl.card.id) : "";
    if (!cardId) return;

    const sortedCards = this.getSortedCards();
    const fromIndex = sortedCards.findIndex((c) => String(c.id ?? "") === cardId);
    if (fromIndex < 0) return;

    this.pendingDrag = {
      pointerId: e.pointerId,
      cardId,
      fromIndex,
      fromRow: 0,
      twoRows: false,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      slotMidpoints: [],
      slotMeta: [],
      slotBounds: [],
      cardGroupList: [],
      cardStepPx: 25,
      zoomFactor: 1,
      stockLeft: 0,
    };
  }

  private onStockPointerMove(e: PointerEvent) {
    const pending = this.pendingDrag;
    if (!pending || e.pointerId !== pending.pointerId) return;

    const dx = e.clientX - pending.startX;
    const dy = e.clientY - pending.startY;

    if (!pending.active) {
      if (Math.abs(dy) > DRAG_DEADZONE_PX && Math.abs(dy) > Math.abs(dx)) {
        this.pendingDrag = null;
        return;
      }
      if (Math.abs(dx) <= DRAG_DEADZONE_PX || Math.abs(dx) < Math.abs(dy)) {
        return;
      }

      if (!this.shadowRoot) {
        this.pendingDrag = null;
        return;
      }
      const stockEl = this.shadowRoot.getElementById("stock");
      if (!stockEl) {
        this.pendingDrag = null;
        return;
      }

      const sortedCards = this.getSortedCards();
      const cardEls = Array.from(this.shadowRoot.querySelectorAll<TichuCard>("tichu-card"));
      if (cardEls.length !== sortedCards.length || sortedCards.length <= 1) {
        this.pendingDrag = null;
        return;
      }

      const layout = this.computeCurrentLayout(sortedCards);
      const baseWidth = Math.max(1, 100 * layout.effectiveScale);
      const firstRect = cardEls[0]!.getBoundingClientRect();
      const zoomFactor = firstRect.width > 0 ? firstRect.width / baseWidth : 1;
      const stockRect = stockEl.getBoundingClientRect();
      const rowInners = layout.twoRows
        ? Array.from(stockEl.querySelectorAll<HTMLElement>(".stock-row-inner"))
        : [];
      const rowLefts = rowInners.map((el) => el.getBoundingClientRect().left);

      const slotMidpoints: number[] = [];
      const slotMeta: Array<{
        midX: number;
        midY: number;
        row: number;
        left: number;
        right: number;
      }> = [];
      const slotBounds: Array<{ left: number; right: number }> = [];
      const cardGroupList: number[] = [];
      for (let i = 0; i < cardEls.length; i++) {
        const rect = cardEls[i]!.getBoundingClientRect();
        const row = layout.twoRows && i >= layout.row1Count ? 1 : 0;
        const containerLeft = layout.twoRows ? (rowLefts[row] ?? stockRect.left) : stockRect.left;
        const left = (rect.left - containerLeft) / zoomFactor;
        const right = (rect.right - containerLeft) / zoomFactor;
        const midX = (rect.left + rect.right) / 2;
        const midY = (rect.top + rect.bottom) / 2;
        slotMidpoints.push(midX);
        slotMeta.push({ midX, midY, row, left, right });
        slotBounds.push({ left, right });
        cardGroupList.push(this.getGroupForCard(String(sortedCards[i]!.id ?? "")));
      }

      const cardStepPx = Math.max(16, baseWidth + layout.marginRight);

      pending.active = true;
      pending.twoRows = layout.twoRows;
      pending.fromRow = layout.twoRows && pending.fromIndex >= layout.row1Count ? 1 : 0;
      pending.slotMidpoints = slotMidpoints;
      pending.slotMeta = slotMeta;
      pending.slotBounds = slotBounds;
      pending.cardGroupList = cardGroupList;
      pending.cardStepPx = cardStepPx;
      pending.zoomFactor = zoomFactor;
      pending.stockLeft = stockRect.left;

      getTooltipLayer()?.hide();
      try {
        stockEl.setPointerCapture(e.pointerId);
      } catch (_err) {
        // ignore if unsupported
      }

      this.dragActive = true;
      this.dragCardId = pending.cardId;
      this.dragFromIndex = pending.fromIndex;
      this.dragFromRow = pending.fromRow;
    }

    if (e.cancelable) {
      e.preventDefault();
    }

    const scaledDx = dx / pending.zoomFactor;
    const scaledDy = pending.twoRows ? dy / pending.zoomFactor : 0;

    let dropIndex: number;
    let targetGroup: CardGroupId | 0;
    let targetRow = 0;
    let indicatorX: number | null = null;

    if (pending.twoRows) {
      const res2d = computeDropTarget2D(
        e.clientX,
        e.clientY,
        pending.slotMeta,
        pending.fromIndex,
        pending.cardGroupList,
      );
      dropIndex = res2d.dropIndex;
      targetGroup = res2d.targetGroup;
      targetRow = res2d.targetRow;

      const origGroup = (pending.cardGroupList[pending.fromIndex] ?? 0) as CardGroupId | 0;
      const movedPosition =
        dropIndex !== pending.fromIndex ||
        targetRow !== pending.fromRow ||
        targetGroup !== origGroup;
      if (movedPosition) {
        const remainingInOrder: number[] = [];
        for (let i = 0; i < pending.slotMeta.length; i++) {
          if (i !== pending.fromIndex) remainingInOrder.push(i);
        }
        const beforeInTargetRow = remainingInOrder
          .slice(0, dropIndex)
          .filter((idx) => pending.slotMeta[idx]!.row === targetRow);
        const allInTargetRow = remainingInOrder.filter(
          (idx) => pending.slotMeta[idx]!.row === targetRow,
        );
        if (allInTargetRow.length === 0) {
          indicatorX = 0;
        } else if (beforeInTargetRow.length === 0) {
          indicatorX = Math.max(0, pending.slotMeta[allInTargetRow[0]!]!.left - 4);
        } else if (beforeInTargetRow.length >= allInTargetRow.length) {
          const lastIdx = allInTargetRow[allInTargetRow.length - 1]!;
          indicatorX = pending.slotMeta[lastIdx]!.right + 4;
        } else {
          const nextIdx = allInTargetRow[beforeInTargetRow.length]!;
          indicatorX = pending.slotMeta[nextIdx]!.left - 2;
        }
      }
    } else {
      const res1d = computeDropTarget(
        e.clientX,
        pending.slotMidpoints,
        pending.fromIndex,
        pending.cardGroupList,
      );
      dropIndex = res1d.dropIndex;
      targetGroup = res1d.targetGroup;

      const origGroup = (pending.cardGroupList[pending.fromIndex] ?? 0) as CardGroupId | 0;
      if (dropIndex !== pending.fromIndex || targetGroup !== origGroup) {
        const n = pending.slotBounds.length;
        if (dropIndex <= 0) {
          indicatorX = Math.max(0, pending.slotBounds[0]!.left - 4);
        } else if (dropIndex >= n - 1) {
          indicatorX = pending.slotBounds[n - 1]!.right + 4;
        } else if (dropIndex < pending.fromIndex) {
          indicatorX = pending.slotBounds[dropIndex]!.left - 2;
        } else {
          indicatorX = pending.slotBounds[dropIndex]!.left + pending.cardStepPx - 2;
        }
      }
    }

    this.dragDeltaX = scaledDx;
    this.dragDeltaY = scaledDy;
    this.dragDropIndex = dropIndex;
    this.dragTargetRow = targetRow;
    this.dragTargetGroup = targetGroup;
    this.dropIndicatorX = indicatorX;
    this.dropIndicatorRow = targetRow;
  }

  private onStockPointerUp(e: PointerEvent) {
    this.finishPointerDrag(e, false);
  }

  private onStockPointerCancel(e: PointerEvent) {
    this.finishPointerDrag(e, true);
  }

  private finishPointerDrag(e: PointerEvent, cancelled: boolean) {
    const pending = this.pendingDrag;
    if (!pending || e.pointerId !== pending.pointerId) return;
    this.pendingDrag = null;

    const stockEl = this.shadowRoot?.getElementById("stock");
    try {
      if (stockEl?.hasPointerCapture?.(e.pointerId)) {
        stockEl.releasePointerCapture(e.pointerId);
      }
    } catch (_err) {
      // ignore
    }

    if (!pending.active) {
      this.resetDragState();
      return;
    }

    this.armSuppressClick(pending.cardId);

    if (!cancelled && this.shadowRoot) {
      const sortedCards = this.getSortedCards();
      const fromIndex = pending.fromIndex;
      const dropIndex = this.dragDropIndex;
      const targetGroup = this.dragTargetGroup;
      const origGroup = (pending.cardGroupList[fromIndex] ?? 0) as CardGroupId | 0;

      if (
        fromIndex >= 0 &&
        fromIndex < sortedCards.length &&
        dropIndex >= 0 &&
        (dropIndex !== fromIndex || targetGroup !== origGroup)
      ) {
        this.dragReleaseRects.clear();
        const cardEls = Array.from(this.shadowRoot.querySelectorAll<TichuCard>("tichu-card"));
        for (const cardEl of cardEls) {
          if (cardEl.pass || cardEl.card?.id == null) continue;
          this.dragReleaseRects.set(String(cardEl.card.id), cardEl.getBoundingClientRect());
        }
        this.suppressTranslateTransition = true;

        const ids = sortedCards.map((c) => String(c.id ?? ""));
        const [movedId] = ids.splice(fromIndex, 1);
        if (movedId) {
          ids.splice(dropIndex, 0, movedId);
          this.resetDragState();
          this.dispatchEvent(
            new CustomEvent("hand-reorder", {
              detail: {
                orderedIds: ids,
                movedCardId: movedId,
                targetGroup,
                source: "pointer",
              },
              bubbles: true,
              composed: true,
            }),
          );
          return;
        }
      }
    }

    this.resetDragState();
  }

  private async onStockKeyDown(e: KeyboardEvent) {
    if (!this.reorderable || this.pass || this.hideAllCards) return;
    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;

    const cardEl = this.findCardElementFromEvent(e);
    const cardId = cardEl?.card?.id != null ? String(cardEl.card.id) : "";
    if (!cardId) return;

    const sortedCards = this.getSortedCards();
    const fromIndex = sortedCards.findIndex((c) => String(c.id ?? "") === cardId);
    if (fromIndex < 0) return;

    const delta = e.key === "ArrowLeft" ? -1 : 1;
    const dropIndex = fromIndex + delta;
    if (dropIndex < 0 || dropIndex >= sortedCards.length) return;

    e.preventDefault();
    e.stopPropagation();

    const ids = sortedCards.map((c) => String(c.id ?? ""));
    const neighborId = ids[dropIndex]!;
    const targetGroup = this.getGroupForCard(neighborId);
    const [movedId] = ids.splice(fromIndex, 1);
    if (!movedId) return;
    ids.splice(dropIndex, 0, movedId);

    this.dispatchEvent(
      new CustomEvent("hand-reorder", {
        detail: {
          orderedIds: ids,
          movedCardId: movedId,
          targetGroup,
          source: "keyboard",
        },
        bubbles: true,
        composed: true,
      }),
    );

    await this.updateComplete;
    const nextCardEl = this.shadowRoot?.querySelector<TichuCard>(
      `tichu-card[data-card-id="${movedId}"]`,
    );
    const inner = nextCardEl?.shadowRoot?.getElementById("card") as HTMLElement | null;
    inner?.focus?.();
  }

  renderPass() {
    return html`<div id="stock">
      <tichu-card
        pass
        ?data-pending-reveal=${this.hideAllCards}
        .scale=${this.scale}
        .tiki=${this.tiki}
      ></tichu-card>
    </div>`;
  }

  private onCardClick(e: CustomEvent<{ card: Card }>, card: Card) {
    e.stopPropagation();
    if (this.suppressClickCardId !== null) {
      const suppressedId = this.suppressClickCardId;
      this.clearSuppressClick();
      if (suppressedId === String(card.id)) {
        return;
      }
    }
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

  getPassCardRect(): DOMRect | null {
    if (!this.shadowRoot || !this.pass) return null;
    const cardEl = this.shadowRoot.querySelector<TichuCard>("tichu-card");
    if (!cardEl) return null;
    const innerCard = cardEl.shadowRoot?.getElementById("card");
    const rect = innerCard ? innerCard.getBoundingClientRect() : cardEl.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return rect;
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
    const filter = cardIds ? new Set(cardIds.map(String)) : null;
    if (!this.hideAllCards && this.shadowRoot?.querySelectorAll) {
      const externalSet = new Set(this.externalHiddenIds.map(String));
      const nodes = Array.from(
        this.shadowRoot.querySelectorAll<HTMLElement>("tichu-card[data-pending-reveal]"),
      );
      for (const el of nodes) {
        const cid = el.getAttribute("data-card-id") ?? "";
        if (externalSet.has(cid)) continue;
        if (!filter || filter.has(cid)) {
          el.removeAttribute("data-pending-reveal");
        }
      }
    }
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
