import { css, LitElement } from "lit";
import { CardData } from "./game-model";
import type { TichuHand } from "./tichu-hand";
import type { TichuLastPlayed } from "./tichu-last-played";
import type { TichuPassArea } from "./tichu-pass-area";
import "./tichu-card";
import type { TichuCard } from "./tichu-card";
import { hasBomb } from "./utils";

export interface CardFlight {
  card: CardData;
  fromRect: DOMRect;
  toRect: DOMRect;
  delayMs?: number;
  durationMs?: number;
  fadeOut?: boolean;
  pulse?: boolean;
  tiki?: boolean;
  pass?: boolean;
}

export interface PlayComboPrep {
  fromRects: Map<number, DOMRect>;
  fallbackFromRect: DOMRect;
  isBomb: boolean;
  durationMs: number;
}

export interface AcceptCardsPrep {
  fromRects: Map<number, DOMRect>;
  durationMs: number;
}

interface ActiveBatch {
  elements: HTMLElement[];
  animations: Animation[];
  cleanup: () => void;
}

function getGameUi(): any {
  return typeof window !== "undefined" ? (window as any).gameui : undefined;
}

export function shouldAnimate(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  if (document.hidden || document.visibilityState === "hidden") {
    return false;
  }
  if ((window as any).__tichuSpeed === "instant") {
    return false;
  }
  const gm = (window as any).gameModel;
  if (gm && typeof gm.getState === "function" && gm.getState()?.animationsEnabled === false) {
    return false;
  }
  const ui = getGameUi();
  if (Number(ui?.prefs?.[105]?.value) === 2) {
    return false;
  }
  if (ui?.instantaneousMode) {
    return false;
  }
  if (ui?.notifqueue?.speedMode === "instant") {
    return false;
  }
  if (typeof ui?.bgaAnimationsActive === "function" && !ui.bgaAnimationsActive()) {
    return false;
  }
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return false;
  }
  if (typeof Element === "undefined" || typeof Element.prototype.animate !== "function") {
    return false;
  }
  return true;
}

export function getAnimationSpeedScale(): number {
  if (!shouldAnimate()) {
    return 0;
  }
  const speed = (window as any).__tichuSpeed ?? getGameUi()?.notifqueue?.speedMode;
  if (speed === "fast") {
    return 0.15;
  }
  return 1;
}

export function scaleAnimMs(ms: number): number {
  return Math.max(0, Math.round(ms * getAnimationSpeedScale()));
}

export function getPlayAreaZoomFactor(): number {
  if (typeof document === "undefined") return 1;
  const areaWrap = document.getElementById("game_play_area_wrap");
  if (areaWrap) {
    const m = areaWrap.style.transform.match(/scale\(([^)]+)\)/);
    if (m && m[1]) {
      const parsed = Number(m[1]);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  return 1;
}

export function getAnimationLayer(): TichuAnimationLayer | null {
  if (typeof document === "undefined") return null;
  let layer = document.querySelector("tichu-animation-layer") as TichuAnimationLayer | null;
  if (!layer && document.body) {
    layer = document.createElement("tichu-animation-layer") as TichuAnimationLayer;
    document.body.appendChild(layer);
  }
  return layer;
}

export class TichuAnimationLayer extends LitElement {
  private activeBatches: Set<ActiveBatch> = new Set();
  private totalFlights = 0;

  private updateObservabilityAttrs(activeGhostsDelta = 0): void {
    const currentGhosts = this.shadowRoot?.querySelectorAll(".ghost-wrapper").length ?? 0;
    this.setAttribute("data-flight-count", String(this.totalFlights));
    this.setAttribute("data-active-ghosts", String(Math.max(0, currentGhosts + activeGhostsDelta)));
  }

  static override get styles() {
    return css`
      :host {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 950;
        overflow: hidden;
        display: block;
      }
      .ghost-wrapper {
        position: fixed;
        top: 0;
        left: 0;
        width: 100px;
        height: 150px;
        pointer-events: none;
        transform-origin: top left;
        will-change: transform, opacity;
      }
    `;
  }

  private getGameElement(): HTMLElement | null {
    return document.querySelector("tichu-game");
  }

  private getHandElement(): TichuHand | null {
    return (this.getGameElement()?.shadowRoot?.querySelector("tichu-hand") as TichuHand) ?? null;
  }

  private getLastPlayedElement(): TichuLastPlayed | null {
    return (
      (this.getGameElement()?.shadowRoot?.querySelector("tichu-last-played") as TichuLastPlayed) ??
      null
    );
  }

  canAnimate(): boolean {
    return shouldAnimate();
  }

  private getPassAreaElement(): TichuPassArea | null {
    return (
      (this.getGameElement()?.shadowRoot?.querySelector("tichu-pass-area") as TichuPassArea) ?? null
    );
  }

  private getCenterFallbackRect(width = 75, height = 112.5): DOMRect {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    return new DOMRect((vw - width) / 2, (vh - height) / 2, width, height);
  }

  flyCards(flights: CardFlight[], onCleanup?: () => void): Promise<void> {
    if (!shouldAnimate() || flights.length === 0 || !this.shadowRoot) {
      onCleanup?.();
      return Promise.resolve();
    }

    const isTiki =
      window.gameModel?.getState().isTiki ??
      document.getElementById("game_play_area")?.classList.contains("tiki") ??
      false;

    const elements: HTMLElement[] = [];
    const animations: Animation[] = [];
    const shadow = this.shadowRoot;

    for (const flight of flights) {
      const wrapper = document.createElement("div");
      wrapper.className = "ghost-wrapper";

      const cardEl = document.createElement("tichu-card") as TichuCard;
      if (flight.pass) {
        cardEl.pass = true;
      } else {
        cardEl.card = flight.card;
      }
      cardEl.scale = 1.0;
      cardEl.tiki = flight.tiki ?? isTiki;
      wrapper.appendChild(cardEl);
      shadow.appendChild(wrapper);
      elements.push(wrapper);

      const fromW = flight.fromRect.width > 0 ? flight.fromRect.width : 75;
      const toW = flight.toRect.width > 0 ? flight.toRect.width : 75;
      const fromScale = fromW / 100;
      const toScale = toW / 100;

      const startTransform = `translate3d(${flight.fromRect.left}px, ${flight.fromRect.top}px, 0) scale(${fromScale})`;
      const endTransform = `translate3d(${flight.toRect.left}px, ${flight.toRect.top}px, 0) scale(${toScale})`;

      const keyframes: Keyframe[] = [{ transform: startTransform, opacity: 1 }];
      if (flight.pulse) {
        const midLeft = (flight.fromRect.left + flight.toRect.left) / 2;
        const midTop = (flight.fromRect.top + flight.toRect.top) / 2;
        const pulseScale = Math.max(fromScale, toScale) * 1.12;
        keyframes.push({
          offset: 0.5,
          transform: `translate3d(${midLeft}px, ${midTop}px, 0) scale(${pulseScale})`,
          opacity: 1,
        });
      }
      keyframes.push({
        transform: endTransform,
        opacity: flight.fadeOut ? 0 : 1,
      });

      const anim = wrapper.animate(keyframes, {
        duration: Math.max(12, Math.round(flight.durationMs ?? 250)),
        delay: Math.max(0, Math.round(flight.delayMs ?? 0)),
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      });
      animations.push(anim);
    }

    this.totalFlights += flights.length;
    this.updateObservabilityAttrs();

    let cleaned = false;
    return new Promise<void>((resolve) => {
      const batch: ActiveBatch = {
        elements,
        animations,
        cleanup: () => {
          if (cleaned) return;
          cleaned = true;
          this.activeBatches.delete(batch);
          for (const el of elements) {
            el.remove();
          }
          this.updateObservabilityAttrs();
          onCleanup?.();
          resolve();
        },
      };

      this.activeBatches.add(batch);
      Promise.allSettled(animations.map((a) => a.finished)).then(() => {
        batch.cleanup();
      });
    });
  }

  cancelAll(): void {
    const batches = Array.from(this.activeBatches);
    for (const batch of batches) {
      for (const anim of batch.animations) {
        try {
          anim.cancel();
        } catch (_e) {
          // ignore
        }
      }
      batch.cleanup();
    }
    this.getHandElement()?.revealCards();
    this.getPassAreaElement()?.revealCards();
    const lastPlayedEl = this.getLastPlayedElement();
    if (lastPlayedEl) {
      lastPlayedEl.setWinningComboHighlight(null);
      lastPlayedEl.revealCards();
    }
  }

  prepareDealCards(cards: CardData[]): number {
    if (!shouldAnimate() || cards.length === 0) {
      return 100;
    }
    const cardIds = cards.map((c) => c.id);
    this.getHandElement()?.markPendingReveal(cardIds);
    const durEach = scaleAnimMs(220);
    const stagger = scaleAnimMs(25);
    const totalMs = durEach + Math.max(0, cards.length - 1) * stagger + scaleAnimMs(40);
    return Math.max(40, totalMs);
  }

  async runDealCardsFlight(cards: CardData[]): Promise<void> {
    const handEl = this.getHandElement();
    const cardIds = cards.map((c) => c.id);
    if (!shouldAnimate() || !handEl || cards.length === 0) {
      handEl?.revealCards(cardIds);
      return;
    }

    await handEl.updateComplete;
    const stock = handEl.getStock();
    if (stock) {
      await stock.updateComplete;
    }

    const toRects = handEl.getCardRects(cardIds);
    const fallbackToRect = handEl.getHandAnchorRect() ?? this.getCenterFallbackRect(75, 112.5);
    const fromRect =
      this.getLastPlayedElement()?.getDeckOriginRect() ?? this.getCenterFallbackRect(65, 97.5);
    const durationMs = Math.max(12, scaleAnimMs(220));
    const staggerMs = scaleAnimMs(25);

    const flights: CardFlight[] = cards.map((card, idx) => ({
      card,
      fromRect,
      toRect: toRects.get(Number(card.id)) ?? fallbackToRect,
      delayMs: idx * staggerMs,
      durationMs,
    }));

    await this.flyCards(flights, () => handEl.revealCards(cardIds));
  }

  getAcceptCardsTiming(cardCount: number): {
    viewDelayMs: number;
    flightDurationMs: number;
    totalDurationMs: number;
  } {
    const viewDelayMs = scaleAnimMs(1200);
    const flightDurationMs = Math.max(
      40,
      scaleAnimMs(260) + Math.max(0, cardCount - 1) * scaleAnimMs(35) + scaleAnimMs(40),
    );
    return {
      viewDelayMs,
      flightDurationMs,
      totalDurationMs: viewDelayMs + flightDurationMs,
    };
  }

  prepareAcceptCards(cards: CardData[]): AcceptCardsPrep {
    const passAreaEl = this.getPassAreaElement();
    if (!shouldAnimate() || cards.length === 0 || !passAreaEl?.isPassAreaVisible()) {
      return { fromRects: new Map(), durationMs: 50 };
    }
    const existingRects = passAreaEl.getReceivedCardRects();
    const fromRects = new Map<number, DOMRect>();
    cards.forEach((card, idx) => {
      const idNum = Number(card.id);
      if (Number.isNaN(idNum)) return;
      const fromExisting = existingRects.get(idNum);
      if (fromExisting) {
        fromRects.set(idNum, fromExisting);
        return;
      }
      const passedFrom = card.passed_from ?? (card as any).card_passed_from;
      const slotRect =
        (passedFrom ? passAreaEl.getSlotCardRectByPlayerId(passedFrom) : null) ??
        passAreaEl.getSlotCardTargetRect(idx);
      if (slotRect) {
        fromRects.set(idNum, slotRect);
      }
    });
    if (fromRects.size === 0) {
      return { fromRects, durationMs: 50 };
    }
    this.getHandElement()?.markPendingReveal(cards.map((c) => c.id));
    const durationMs = Math.max(
      40,
      scaleAnimMs(260) + Math.max(0, cards.length - 1) * scaleAnimMs(35) + scaleAnimMs(40),
    );
    return { fromRects, durationMs };
  }

  async runAcceptCardsFlight(cards: CardData[], fromRects: Map<number, DOMRect>): Promise<void> {
    const handEl = this.getHandElement();
    const cardIds = cards.map((c) => c.id);
    if (!shouldAnimate() || !handEl || cards.length === 0 || fromRects.size === 0) {
      handEl?.revealCards(cardIds);
      return;
    }

    await handEl.updateComplete;
    const stock = handEl.getStock();
    if (stock) {
      await stock.updateComplete;
    }

    const toRects = handEl.getCardRects(cardIds);
    const fallbackToRect = handEl.getHandAnchorRect() ?? this.getCenterFallbackRect(75, 112.5);
    const durationMs = Math.max(12, scaleAnimMs(260));
    const staggerMs = scaleAnimMs(35);

    const flights: CardFlight[] = [];
    cards.forEach((card, idx) => {
      const fromRect = fromRects.get(Number(card.id));
      if (!fromRect) return;
      flights.push({
        card,
        fromRect,
        toRect: toRects.get(Number(card.id)) ?? fallbackToRect,
        delayMs: idx * staggerMs,
        durationMs,
      });
    });

    if (flights.length === 0) {
      handEl.revealCards(cardIds);
      return;
    }

    await this.flyCards(flights, () => handEl.revealCards(cardIds));
  }

  prepareGiveCardToSlot(card: CardData): DOMRect | null {
    const passAreaEl = this.getPassAreaElement();
    const handEl = this.getHandElement();
    if (!shouldAnimate() || !passAreaEl?.isPassAreaVisible() || !handEl) {
      return null;
    }
    const fromRect =
      handEl.getCardRects([card.id]).get(Number(card.id)) ?? handEl.getHandAnchorRect();
    if (!fromRect) {
      return null;
    }
    passAreaEl.markPendingReveal([card.id]);
    return fromRect;
  }

  async runGiveCardToSlotFlight(
    card: CardData,
    slotIndex: number,
    fromRect: DOMRect | null,
  ): Promise<void> {
    const passAreaEl = this.getPassAreaElement();
    if (!shouldAnimate() || !passAreaEl || !fromRect || !passAreaEl.isPassAreaVisible()) {
      passAreaEl?.revealCards([card.id]);
      return;
    }

    await passAreaEl.updateComplete;

    const toRect =
      passAreaEl.getGivenCardRects([card.id]).get(Number(card.id)) ??
      passAreaEl.getSlotCardTargetRect(slotIndex);
    if (!toRect) {
      passAreaEl.revealCards([card.id]);
      return;
    }

    const durationMs = Math.max(12, scaleAnimMs(220));
    await this.flyCards(
      [
        {
          card,
          fromRect,
          toRect,
          durationMs,
        },
      ],
      () => passAreaEl.revealCards([card.id]),
    );
  }

  prepareReturnPassCardsToHand(cards: CardData[]): Map<number, DOMRect> {
    const passAreaEl = this.getPassAreaElement();
    const handEl = this.getHandElement();
    if (!shouldAnimate() || cards.length === 0 || !passAreaEl?.isPassAreaVisible() || !handEl) {
      return new Map();
    }
    const cardIds = cards.map((c) => c.id);
    const fromRects = passAreaEl.getGivenCardRects(cardIds);
    passAreaEl.revealCards(cardIds);
    if (fromRects.size === 0) {
      return fromRects;
    }
    handEl.markPendingReveal(cardIds);
    return fromRects;
  }

  async runReturnPassCardsToHandFlight(
    cards: CardData[],
    fromRects: Map<number, DOMRect>,
  ): Promise<void> {
    const handEl = this.getHandElement();
    const cardIds = cards.map((c) => c.id);
    if (!shouldAnimate() || !handEl || cards.length === 0 || fromRects.size === 0) {
      handEl?.revealCards(cardIds);
      return;
    }

    await handEl.updateComplete;
    const stock = handEl.getStock();
    if (stock) {
      await stock.updateComplete;
    }

    const toRects = handEl.getCardRects(cardIds);
    const fallbackToRect = handEl.getHandAnchorRect() ?? this.getCenterFallbackRect(75, 112.5);
    const durationMs = Math.max(12, scaleAnimMs(220));
    const staggerMs = scaleAnimMs(25);

    const flights: CardFlight[] = [];
    cards.forEach((card, idx) => {
      const fromRect = fromRects.get(Number(card.id));
      if (!fromRect) return;
      flights.push({
        card,
        fromRect,
        toRect: toRects.get(Number(card.id)) ?? fallbackToRect,
        delayMs: idx * staggerMs,
        durationMs,
      });
    });

    if (flights.length === 0) {
      handEl.revealCards(cardIds);
      return;
    }

    await this.flyCards(flights, () => handEl.revealCards(cardIds));
  }

  runPassCardsOutFlight(cardIds?: Array<string | number>): {
    durationMs: number;
    promise: Promise<void>;
  } {
    const passAreaEl = this.getPassAreaElement();
    if (!shouldAnimate() || !passAreaEl?.isPassAreaVisible()) {
      return { durationMs: 50, promise: Promise.resolve() };
    }

    const passSlots = window.gameModel?.getState().passSlots ?? [];
    const filter = cardIds && cardIds.length > 0 ? new Set(cardIds.map(String)) : null;
    const givenRects = passAreaEl.getGivenCardRects(cardIds);

    const entries: Array<{ card: CardData; fromRect: DOMRect }> = [];
    passSlots.forEach((slot, idx) => {
      const card = slot.givenCard;
      if (!card) return;
      if (filter && !filter.has(String(card.id))) return;
      const fromRect = givenRects.get(Number(card.id)) ?? passAreaEl.getSlotCardTargetRect(idx);
      if (fromRect) {
        entries.push({ card, fromRect });
      }
    });

    if (entries.length === 0) {
      return { durationMs: 50, promise: Promise.resolve() };
    }

    this.cancelAll();

    const outDurationMs = Math.max(12, scaleAnimMs(240));
    const staggerMs = scaleAnimMs(25);
    const flights: CardFlight[] = entries.map(({ card, fromRect }, idx) => {
      const scale = fromRect.width > 0 ? fromRect.width / 100 : 1;
      return {
        card,
        fromRect,
        toRect: new DOMRect(
          fromRect.left,
          fromRect.top - 60 * scale,
          fromRect.width,
          fromRect.height,
        ),
        delayMs: idx * staggerMs,
        durationMs: outDurationMs,
        fadeOut: true,
      };
    });

    const promise = this.flyCards(flights);
    const durationMs = Math.max(
      40,
      outDurationMs + Math.max(0, flights.length - 1) * staggerMs + scaleAnimMs(40),
    );
    return { durationMs, promise };
  }

  preparePlayCombo(
    playerId: number,
    cards: CardData[],
    comboName: string,
    isBombState: boolean,
  ): PlayComboPrep {
    const isBomb = isBombState || hasBomb(cards) || comboName.toLowerCase().includes("bomb");
    if (!shouldAnimate() || cards.length === 0) {
      return {
        fromRects: new Map(),
        fallbackFromRect: this.getCenterFallbackRect(75, 112.5),
        isBomb,
        durationMs: 100,
      };
    }

    const cardIds = cards.map((c) => c.id);
    const st = window.gameModel?.getState();
    const isSelf = !st?.isSpectator && playerId === Number(st?.currentPlayerId ?? 0);

    const handEl = this.getHandElement();
    const lastPlayedEl = this.getLastPlayedElement();
    const fromRects = isSelf && handEl ? handEl.getCardRects(cardIds) : new Map<number, DOMRect>();
    const fallbackFromRect = isSelf
      ? (handEl?.getHandAnchorRect() ?? this.getCenterFallbackRect(75, 112.5))
      : (lastPlayedEl?.getPlayerHandIconRect(playerId) ??
        lastPlayedEl?.getSeatAnchorRect(playerId) ??
        this.getCenterFallbackRect(50, 75));

    lastPlayedEl?.markPendingReveal(playerId, cardIds);

    const baseDur = scaleAnimMs(isBomb ? 320 : 250);
    const stagger = scaleAnimMs(20);
    const durationMs = Math.max(
      40,
      baseDur + Math.max(0, cards.length - 1) * stagger + scaleAnimMs(40),
    );

    return { fromRects, fallbackFromRect, isBomb, durationMs };
  }

  async runPlayComboFlight(
    playerId: number,
    cards: CardData[],
    prep: PlayComboPrep,
  ): Promise<void> {
    const lastPlayedEl = this.getLastPlayedElement();
    const cardIds = cards.map((c) => c.id);
    if (!shouldAnimate() || !lastPlayedEl || cards.length === 0) {
      lastPlayedEl?.revealCards(playerId, cardIds);
      return;
    }

    await lastPlayedEl.updateComplete;
    const stock = lastPlayedEl.getPlayerStock(playerId);
    if (stock) {
      await stock.updateComplete;
    }

    const toRects = lastPlayedEl.getComboCardRects(playerId, cardIds);
    const fallbackToRect =
      lastPlayedEl.getSeatAnchorRect(playerId) ?? this.getCenterFallbackRect(65, 97.5);
    const durationMs = Math.max(12, scaleAnimMs(prep.isBomb ? 320 : 250));
    const staggerMs = scaleAnimMs(20);

    const flights: CardFlight[] = cards.map((card, idx) => ({
      card,
      fromRect: prep.fromRects.get(Number(card.id)) ?? prep.fallbackFromRect,
      toRect: toRects.get(Number(card.id)) ?? fallbackToRect,
      delayMs: idx * staggerMs,
      durationMs,
      pulse: prep.isBomb,
    }));

    await this.flyCards(flights, () => lastPlayedEl.revealCards(playerId, cardIds));
  }

  runCaptureCardsSweep(recipientPlayerId: number): { durationMs: number; promise: Promise<void> } {
    if (!shouldAnimate()) {
      return { durationMs: 100, promise: Promise.resolve() };
    }
    const lastPlayedEl = this.getLastPlayedElement();
    if (!lastPlayedEl) {
      return { durationMs: 100, promise: Promise.resolve() };
    }

    const entries = lastPlayedEl.getAllTableComboCards();
    if (entries.length === 0) {
      return { durationMs: 100, promise: Promise.resolve() };
    }

    const st = window.gameModel?.getState();
    const isSelf =
      !st?.isSpectator && Number(recipientPlayerId) === Number(st?.currentPlayerId ?? 0);
    const winnerId = String(st?.lastComboPlayerId || recipientPlayerId);
    const toRect = isSelf
      ? (this.getHandElement()?.getHandAnchorRect() ??
        lastPlayedEl.getPlayerPointsIconRect(recipientPlayerId) ??
        lastPlayedEl.getSeatAnchorRect(recipientPlayerId) ??
        this.getCenterFallbackRect(75, 112.5))
      : (lastPlayedEl.getPlayerPointsIconRect(recipientPlayerId) ??
        lastPlayedEl.getSeatAnchorRect(recipientPlayerId) ??
        this.getCenterFallbackRect(36, 54));

    const nonWinnerEntries = entries.filter((e) => e.playerId !== winnerId);
    const winnerEntries = entries.filter((e) => e.playerId === winnerId);
    const hasNonWinner = nonWinnerEntries.length > 0;
    const winnerLingerMs = hasNonWinner ? scaleAnimMs(150) : scaleAnimMs(60);
    const staggerMs = scaleAnimMs(15);
    const sweepDurationMs = Math.max(12, scaleAnimMs(260));

    const flights: CardFlight[] = [];
    let maxDelayMs = 0;

    const pushFlights = (
      list: Array<{ playerId: string; card: CardData; rect: DOMRect; pass?: boolean }>,
      baseDelayMs: number,
    ) => {
      list.forEach((entry, idx) => {
        const delayMs = baseDelayMs + idx * staggerMs;
        if (delayMs > maxDelayMs) maxDelayMs = delayMs;
        flights.push({
          card: entry.card,
          fromRect: entry.rect,
          toRect,
          delayMs,
          durationMs: sweepDurationMs,
          fadeOut: true,
          pass: Boolean(entry.pass),
        });
      });
    };

    pushFlights(nonWinnerEntries, 0);
    pushFlights(winnerEntries, winnerLingerMs);

    lastPlayedEl.hideAllComboCards();
    lastPlayedEl.setWinningComboHighlight(winnerId);

    const promise = this.flyCards(flights, () => {
      lastPlayedEl.setWinningComboHighlight(null);
      lastPlayedEl.revealCards();
    });

    const durationMs = Math.max(60, maxDelayMs + sweepDurationMs + scaleAnimMs(50));
    return { durationMs, promise };
  }
}

customElements.define("tichu-animation-layer", TichuAnimationLayer);
