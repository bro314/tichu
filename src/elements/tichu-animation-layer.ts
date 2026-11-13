import { css, LitElement } from "lit";
import { CardData } from "./game-model";
import type { TichuHand } from "./tichu-hand";
import type { TichuLastPlayed } from "./tichu-last-played";
import type { TichuPassArea } from "./tichu-pass-area";
import type { TichuPlayerPanel } from "./tichu-player-panel";
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
  const ui = getGameUi();
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

  private getPassAreaElement(): TichuPassArea | null {
    return (
      (this.getGameElement()?.shadowRoot?.querySelector("tichu-pass-area") as TichuPassArea) ?? null
    );
  }

  private getPlayerBadgeRect(playerId: number | string): DOMRect | null {
    const id = String(playerId);
    const panel = (document.querySelector(`tichu-player-panel[player-id="${id}"]`) ??
      document.getElementById(`player_board_${id}`)?.querySelector("tichu-player-panel")) as
      TichuPlayerPanel | null | undefined;
    return panel?.getBadgeRect() ?? null;
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
      cardEl.card = flight.card;
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

  prepareAcceptCards(cards: CardData[]): AcceptCardsPrep {
    if (!shouldAnimate() || cards.length === 0) {
      return { fromRects: new Map(), durationMs: 50 };
    }
    const fromRects = this.getPassAreaElement()?.getReceivedCardRects() ?? new Map();
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
    const fallbackFromRect =
      this.getLastPlayedElement()?.getDeckOriginRect() ?? this.getCenterFallbackRect(75, 112.5);
    const fallbackToRect = handEl.getHandAnchorRect() ?? this.getCenterFallbackRect(75, 112.5);
    const durationMs = Math.max(12, scaleAnimMs(260));
    const staggerMs = scaleAnimMs(35);

    const flights: CardFlight[] = cards.map((card, idx) => ({
      card,
      fromRect: fromRects.get(Number(card.id)) ?? fallbackFromRect,
      toRect: toRects.get(Number(card.id)) ?? fallbackToRect,
      delayMs: idx * staggerMs,
      durationMs,
    }));

    await this.flyCards(flights, () => handEl.revealCards(cardIds));
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
    const currentPlayerId = Number(window.gameModel?.getState().currentPlayerId ?? 0);
    const isSelf = playerId === currentPlayerId;

    const handEl = this.getHandElement();
    const lastPlayedEl = this.getLastPlayedElement();
    const fromRects = isSelf && handEl ? handEl.getCardRects(cardIds) : new Map<number, DOMRect>();
    const fallbackFromRect = isSelf
      ? (handEl?.getHandAnchorRect() ?? this.getCenterFallbackRect(75, 112.5))
      : (this.getPlayerBadgeRect(playerId) ??
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

    const winnerId = String(window.gameModel?.getState().lastComboPlayerId || recipientPlayerId);
    const toRect =
      this.getPlayerBadgeRect(recipientPlayerId) ??
      lastPlayedEl.getSeatAnchorRect(recipientPlayerId) ??
      this.getCenterFallbackRect(50, 75);

    const nonWinnerEntries = entries.filter((e) => e.playerId !== winnerId);
    const winnerEntries = entries.filter((e) => e.playerId === winnerId);
    const hasNonWinner = nonWinnerEntries.length > 0;
    const winnerLingerMs = hasNonWinner ? scaleAnimMs(150) : scaleAnimMs(60);
    const staggerMs = scaleAnimMs(15);
    const sweepDurationMs = Math.max(12, scaleAnimMs(260));

    const flights: CardFlight[] = [];
    let maxDelayMs = 0;

    nonWinnerEntries.forEach((entry, idx) => {
      const delayMs = idx * staggerMs;
      if (delayMs > maxDelayMs) maxDelayMs = delayMs;
      flights.push({
        card: entry.card,
        fromRect: entry.rect,
        toRect,
        delayMs,
        durationMs: sweepDurationMs,
        fadeOut: true,
      });
    });

    winnerEntries.forEach((entry, idx) => {
      const delayMs = winnerLingerMs + idx * staggerMs;
      if (delayMs > maxDelayMs) maxDelayMs = delayMs;
      flights.push({
        card: entry.card,
        fromRect: entry.rect,
        toRect,
        delayMs,
        durationMs: sweepDurationMs,
        fadeOut: true,
      });
    });

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
