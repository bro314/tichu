import { css, html, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

export const TOOLTIP_TIMINGS = {
  hoverOpenMs: 200,
  warmOpenMs: 30,
  warmWindowMs: 350,
  hideGraceMs: 110,
  longPressMs: 400,
  moveCancelPx: 8,
  mouseOffsetPx: 10,
  touchOffsetPx: 18,
  viewportPaddingPx: 10,
} as const;

export type TooltipPlacement = "top" | "bottom";
export type TooltipTouchMode = "tap" | "longpress" | "none";

export interface TooltipRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface TooltipPositionResult {
  left: number;
  top: number;
  placement: TooltipPlacement;
  arrowX: number;
}

interface TouchSession {
  pointerId: number;
  target: HTMLElement;
  mode: TooltipTouchMode;
  startX: number;
  startY: number;
  moved: boolean;
  longPressFired: boolean;
}

export function supportsNativePopover(): boolean {
  return typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;
}

export function computeTooltipPosition(
  anchorRect: TooltipRect,
  tipSize: { width: number; height: number },
  viewport: { width: number; height: number },
  offsetPx: number = TOOLTIP_TIMINGS.mouseOffsetPx,
  paddingPx: number = TOOLTIP_TIMINGS.viewportPaddingPx,
): TooltipPositionResult {
  const topCandidate = anchorRect.top - tipSize.height - offsetPx;
  const bottomCandidate = anchorRect.bottom + offsetPx;
  const spaceAbove = anchorRect.top - paddingPx;
  const spaceBelow = viewport.height - anchorRect.bottom - paddingPx;

  let placement: TooltipPlacement = "top";
  let rawTop = topCandidate;

  if (topCandidate < paddingPx && spaceBelow > spaceAbove) {
    placement = "bottom";
    rawTop = bottomCandidate;
  }

  const maxTop = Math.max(paddingPx, viewport.height - tipSize.height - paddingPx);
  const top = Math.max(paddingPx, Math.min(maxTop, rawTop));

  const anchorCenter = anchorRect.left + anchorRect.width / 2;
  const maxLeft = Math.max(paddingPx, viewport.width - tipSize.width - paddingPx);
  const left = Math.max(paddingPx, Math.min(maxLeft, anchorCenter - tipSize.width / 2));

  const minArrow = Math.min(14, tipSize.width / 2);
  const maxArrow = Math.max(minArrow, tipSize.width - 14);
  const arrowX = Math.max(minArrow, Math.min(maxArrow, anchorCenter - left));

  return {
    left: Math.round(left),
    top: Math.round(top),
    placement,
    arrowX: Math.round(arrowX),
  };
}

export function isTooltipTriggerDisabled(el: HTMLElement): boolean {
  return (
    el.classList?.contains("disabled") ||
    el.getAttribute("aria-disabled") === "true" ||
    (el as HTMLButtonElement).disabled === true
  );
}

export function resolveTouchMode(el: HTMLElement): TooltipTouchMode {
  const explicit = el.getAttribute("data-tooltip-touch");
  if (explicit === "tap" || explicit === "longpress" || explicit === "none") {
    return explicit;
  }
  if (isTooltipTriggerDisabled(el)) {
    return "tap";
  }
  const tag = el.tagName ? el.tagName.toUpperCase() : "";
  if (
    tag === "BUTTON" ||
    tag === "A" ||
    tag === "INPUT" ||
    tag === "SELECT" ||
    tag === "TEXTAREA" ||
    el.getAttribute("role") === "button" ||
    el.classList?.contains("selectable")
  ) {
    return "longpress";
  }
  return "tap";
}

export function getTooltipLayer(): TichuTooltipLayer | null {
  if (typeof document === "undefined") return null;
  let layer = document.querySelector("tichu-tooltip-layer") as TichuTooltipLayer | null;
  if (!layer && document.body) {
    layer = document.createElement("tichu-tooltip-layer") as TichuTooltipLayer;
    document.body.appendChild(layer);
  }
  return layer;
}

export class TichuTooltipLayer extends LitElement {
  @state() isOpen = false;
  @state() titleText = "";
  @state() bodyText = "";
  @state() metaText = "";
  @state() placement: TooltipPlacement = "top";
  @state() isTouchOpen = false;
  @state() private positioned = false;

  activeTarget: HTMLElement | null = null;

  private usePopover = supportsNativePopover();
  private listenersAttached = false;
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private focusSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTarget: HTMLElement | null = null;
  private hoveredTrigger: HTMLElement | null = null;
  private hoveringTooltipBox = false;
  private openSource: "hover" | "touch" | "focus" | "disabled-click" | null = null;
  private suppressedTarget: HTMLElement | null = null;
  private lastClosedAt = 0;
  private touchSession: TouchSession | null = null;
  private suppressNextClickUntil = 0;
  private skipOutsidePointerDownForTarget: HTMLElement | null = null;

  static override get styles() {
    return css`
      :host {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 10050;
      }
      .tooltip-box {
        position: fixed;
        inset: auto;
        margin: 0;
        z-index: 10050;
        display: none;
        box-sizing: border-box;
        width: max-content;
        max-width: min(280px, calc(100vw - 20px));
        padding: 7px 11px;
        border-radius: 8px;
        background: var(--tichu-tooltip-bg, #1c2331);
        color: var(--tichu-tooltip-fg, #f8fafc);
        border: 1px solid var(--tichu-tooltip-border, rgba(255, 255, 255, 0.14));
        box-shadow: var(
          --tichu-tooltip-shadow,
          0 10px 26px rgba(15, 23, 42, 0.34),
          0 2px 6px rgba(15, 23, 42, 0.2)
        );
        font-family: Roboto, Arial, sans-serif;
        font-size: 13.5px;
        line-height: 1.4;
        text-align: left;
        overflow: visible;
        overflow-wrap: break-word;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(3px);
        transition:
          opacity 110ms ease,
          transform 110ms ease;
      }
      .tooltip-box[data-placement="bottom"] {
        transform: translateY(-3px);
      }
      .tooltip-box.has-rich {
        padding: 9px 12px;
      }
      .tooltip-box:is(.open, :popover-open) {
        display: block;
      }
      .tooltip-box.positioned:is(.open, :popover-open) {
        opacity: 1;
        transform: translateY(0);
      }
      .tooltip-title {
        font-weight: 700;
        font-size: 14px;
        margin-bottom: 2px;
      }
      .tooltip-body {
        font-weight: 400;
      }
      .tooltip-meta {
        margin-top: 6px;
        padding-top: 5px;
        border-top: 1px solid var(--tichu-tooltip-divider, rgba(255, 255, 255, 0.14));
        font-size: 12.5px;
        color: var(--tichu-tooltip-muted, #cbd5e1);
      }
      .tooltip-arrow {
        position: absolute;
        left: var(--arrow-x, 50%);
        width: 10px;
        height: 10px;
        background: var(--tichu-tooltip-bg, #1c2331);
        border-right: 1px solid var(--tichu-tooltip-border, rgba(255, 255, 255, 0.14));
        border-bottom: 1px solid var(--tichu-tooltip-border, rgba(255, 255, 255, 0.14));
        pointer-events: none;
      }
      .tooltip-box[data-placement="top"] .tooltip-arrow {
        bottom: -6px;
        transform: translateX(-50%) rotate(45deg);
      }
      .tooltip-box[data-placement="bottom"] .tooltip-arrow {
        top: -6px;
        transform: translateX(-50%) rotate(-135deg);
      }
      @media (prefers-reduced-motion: reduce) {
        .tooltip-box {
          transition: none;
          transform: none;
        }
        .tooltip-box[data-placement="bottom"] {
          transform: none;
        }
      }
      @media (forced-colors: active) {
        .tooltip-box {
          background: Canvas;
          color: CanvasText;
          border-color: CanvasText;
        }
        .tooltip-arrow {
          background: Canvas;
          border-color: CanvasText;
        }
      }
    `;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.usePopover = supportsNativePopover();
    this.attachGlobalListeners();
  }

  override disconnectedCallback() {
    this.detachGlobalListeners();
    this.clearAllTimers();
    this.hide();
    super.disconnectedCallback();
  }

  attachGlobalListeners() {
    if (
      this.listenersAttached ||
      typeof document === "undefined" ||
      typeof document.addEventListener !== "function"
    ) {
      return;
    }
    this.listenersAttached = true;
    document.addEventListener("pointerover", this.onPointerOver, true);
    document.addEventListener("pointerout", this.onPointerOut, true);
    document.addEventListener("pointerdown", this.onPointerDown, true);
    document.addEventListener("pointermove", this.onPointerMove, true);
    document.addEventListener("pointerup", this.onPointerUp, true);
    document.addEventListener("pointercancel", this.onPointerCancel, true);
    document.addEventListener("focusin", this.onFocusIn, true);
    document.addEventListener("focusout", this.onFocusOut, true);
    document.addEventListener("keydown", this.onKeyDown, true);
    document.addEventListener("keyup", this.onKeyUp, true);
    document.addEventListener("click", this.onClickCapture, true);
    document.addEventListener("contextmenu", this.onContextMenu, true);
    document.addEventListener("scroll", this.onScrollOrResize, true);
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("resize", this.onScrollOrResize);
      window.addEventListener("blur", this.onWindowBlur);
    }
  }

  detachGlobalListeners() {
    if (
      !this.listenersAttached ||
      typeof document === "undefined" ||
      typeof document.removeEventListener !== "function"
    ) {
      return;
    }
    this.listenersAttached = false;
    document.removeEventListener("pointerover", this.onPointerOver, true);
    document.removeEventListener("pointerout", this.onPointerOut, true);
    document.removeEventListener("pointerdown", this.onPointerDown, true);
    document.removeEventListener("pointermove", this.onPointerMove, true);
    document.removeEventListener("pointerup", this.onPointerUp, true);
    document.removeEventListener("pointercancel", this.onPointerCancel, true);
    document.removeEventListener("focusin", this.onFocusIn, true);
    document.removeEventListener("focusout", this.onFocusOut, true);
    document.removeEventListener("keydown", this.onKeyDown, true);
    document.removeEventListener("keyup", this.onKeyUp, true);
    document.removeEventListener("click", this.onClickCapture, true);
    document.removeEventListener("contextmenu", this.onContextMenu, true);
    document.removeEventListener("scroll", this.onScrollOrResize, true);
    if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
      window.removeEventListener("resize", this.onScrollOrResize);
      window.removeEventListener("blur", this.onWindowBlur);
    }
  }

  showForElement(
    el: HTMLElement,
    isTouch = false,
    source: "hover" | "touch" | "focus" | "disabled-click" = isTouch ? "touch" : "hover",
  ): boolean {
    if ((el as any).isConnected === false) {
      this.hide();
      return false;
    }
    const title = el.getAttribute("data-tooltip-title")?.trim() ?? "";
    const body = el.getAttribute("data-tooltip")?.trim() ?? "";
    const meta = el.getAttribute("data-tooltip-meta")?.trim() ?? "";
    if (!title && !body) {
      this.hide();
      return false;
    }
    this.clearHideTimer();
    this.clearOpenTimer();
    this.pendingTarget = null;
    this.activeTarget = el;
    this.openSource = source;
    this.titleText = title;
    this.bodyText = body;
    this.metaText = meta;
    this.isTouchOpen = isTouch;
    this.positioned = false;
    this.isOpen = true;
    this.syncPopoverAndPosition();
    return true;
  }

  hide() {
    this.clearOpenTimer();
    this.clearHideTimer();
    this.clearFocusSyncTimer();
    this.pendingTarget = null;
    this.hoveringTooltipBox = false;
    this.openSource = null;
    if (this.isOpen) {
      this.lastClosedAt = Date.now();
    }
    this.isOpen = false;
    this.isTouchOpen = false;
    this.positioned = false;
    this.activeTarget = null;
    this.syncPopoverAndPosition();
  }

  protected override updated(changed: Map<string, unknown>) {
    if (
      changed.has("isOpen") ||
      changed.has("titleText") ||
      changed.has("bodyText") ||
      changed.has("metaText") ||
      changed.has("isTouchOpen")
    ) {
      this.syncPopoverAndPosition();
    }
  }

  private syncPopoverAndPosition() {
    const box = this.shadowRoot?.querySelector<HTMLElement>(".tooltip-box");
    if (!box) return;

    if (!this.isOpen || !this.activeTarget || (this.activeTarget as any).isConnected === false) {
      box.classList.remove("positioned");
      if (this.usePopover && typeof (box as any).hidePopover === "function") {
        try {
          if (box.matches(":popover-open")) {
            (box as any).hidePopover();
          }
        } catch (_e) {
          // Ignore if already closed or disconnected
        }
      }
      return;
    }

    if (this.usePopover && typeof (box as any).showPopover === "function") {
      try {
        if (!box.matches(":popover-open")) {
          (box as any).showPopover();
        }
      } catch (_e) {
        // Fallback .open class keeps it visible at z-index 10050
      }
    }

    if (typeof this.activeTarget.getBoundingClientRect !== "function") return;
    const anchorRect = this.activeTarget.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const vh = typeof window !== "undefined" ? window.innerHeight : 768;
    const offsetPx = this.isTouchOpen
      ? TOOLTIP_TIMINGS.touchOffsetPx
      : TOOLTIP_TIMINGS.mouseOffsetPx;

    const pos = computeTooltipPosition(
      anchorRect,
      {
        width: boxRect.width || 180,
        height: boxRect.height || 36,
      },
      { width: vw, height: vh },
      offsetPx,
      TOOLTIP_TIMINGS.viewportPaddingPx,
    );

    this.placement = pos.placement;
    box.setAttribute("data-placement", pos.placement);
    box.style.left = `${pos.left}px`;
    box.style.top = `${pos.top}px`;
    box.style.setProperty("--arrow-x", `${pos.arrowX}px`);
    this.positioned = true;
    box.classList.add("positioned");
  }

  private clearAllTimers() {
    this.clearOpenTimer();
    this.clearHideTimer();
    this.clearLongPressTimer();
    this.clearFocusSyncTimer();
  }

  private clearOpenTimer() {
    if (this.openTimer !== null) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }

  private clearHideTimer() {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private clearLongPressTimer() {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private clearFocusSyncTimer() {
    if (this.focusSyncTimer !== null) {
      clearTimeout(this.focusSyncTimer);
      this.focusSyncTimer = null;
    }
  }

  private isInsideTooltipLayer(event: Event): boolean {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    for (const node of path) {
      if (node === this) return true;
    }
    return false;
  }

  private findTooltipTrigger(event: Event): HTMLElement | null {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    for (const node of path) {
      if ((node as HTMLElement | null)?.id === "studio-test-bar") {
        return null;
      }
    }
    for (const node of path) {
      if (!node || typeof (node as HTMLElement).getAttribute !== "function") continue;
      const el = node as HTMLElement;
      if (el === this || el.tagName === "TICHU-TOOLTIP-LAYER") return null;
      const body = el.getAttribute("data-tooltip")?.trim() ?? "";
      const title = el.getAttribute("data-tooltip-title")?.trim() ?? "";
      if (body || title) return el;
    }
    return null;
  }

  private findTooltipTriggerFromNode(start: Node | null): HTMLElement | null {
    let curr: Node | null = start;
    let found: HTMLElement | null = null;
    while (curr) {
      const el = curr as HTMLElement;
      if (el === this || el.tagName === "TICHU-TOOLTIP-LAYER" || el.id === "studio-test-bar") {
        return null;
      }
      if (!found && typeof el.getAttribute === "function") {
        const body = el.getAttribute("data-tooltip")?.trim() ?? "";
        const title = el.getAttribute("data-tooltip-title")?.trim() ?? "";
        if (body || title) {
          found = el;
        }
      }
      curr = curr.parentNode ?? (curr as ShadowRoot).host ?? null;
    }
    return found;
  }

  private getDeepActiveElement(): HTMLElement | null {
    if (typeof document === "undefined") return null;
    let active = (document.activeElement as Element | null) ?? null;
    while (active && (active as HTMLElement).shadowRoot?.activeElement) {
      const next = (active as HTMLElement).shadowRoot!.activeElement;
      if (!next || next === active) break;
      active = next;
    }
    return active as HTMLElement | null;
  }

  private refreshOpenContentIfChanged(el: HTMLElement) {
    if ((el as any).isConnected === false) {
      this.hide();
      return;
    }
    const title = el.getAttribute("data-tooltip-title")?.trim() ?? "";
    const body = el.getAttribute("data-tooltip")?.trim() ?? "";
    const meta = el.getAttribute("data-tooltip-meta")?.trim() ?? "";
    if (!title && !body) {
      this.hide();
      return;
    }
    if (title !== this.titleText || body !== this.bodyText || meta !== this.metaText) {
      this.titleText = title;
      this.bodyText = body;
      this.metaText = meta;
      this.syncPopoverAndPosition();
    }
  }

  private scheduleHide() {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.hide();
    }, TOOLTIP_TIMINGS.hideGraceMs);
  }

  private updateHoverFromEvent(e: PointerEvent) {
    if (e.pointerType === "touch") return;
    if (this.isInsideTooltipLayer(e)) {
      this.hoveringTooltipBox = true;
      this.hoveredTrigger = null;
      this.clearHideTimer();
      return;
    }
    this.hoveringTooltipBox = false;
    const trigger = this.findTooltipTrigger(e);
    if (!trigger) {
      this.hoveredTrigger = null;
      this.suppressedTarget = null;
      if (this.pendingTarget) {
        this.clearOpenTimer();
        this.pendingTarget = null;
      }
      if (this.isOpen && this.openSource === "hover" && this.hideTimer === null) {
        this.scheduleHide();
      }
      return;
    }
    if (this.suppressedTarget && this.suppressedTarget !== trigger) {
      this.suppressedTarget = null;
    }
    if (trigger === this.suppressedTarget) {
      this.hoveredTrigger = trigger;
      return;
    }
    if (trigger === this.hoveredTrigger) {
      if (this.isOpen && this.activeTarget === trigger) {
        this.clearHideTimer();
        this.refreshOpenContentIfChanged(trigger);
        return;
      }
      if (this.pendingTarget === trigger && this.openTimer !== null) {
        return;
      }
    }

    this.hoveredTrigger = trigger;
    this.clearHideTimer();
    if (this.isOpen && this.activeTarget === trigger) {
      this.openSource = "hover";
      this.refreshOpenContentIfChanged(trigger);
      return;
    }

    this.clearOpenTimer();
    this.pendingTarget = trigger;
    const isWarm = this.isOpen || Date.now() - this.lastClosedAt < TOOLTIP_TIMINGS.warmWindowMs;
    const delay = isWarm ? TOOLTIP_TIMINGS.warmOpenMs : TOOLTIP_TIMINGS.hoverOpenMs;

    this.openTimer = setTimeout(() => {
      this.openTimer = null;
      if (this.pendingTarget === trigger && this.hoveredTrigger === trigger) {
        this.showForElement(trigger, false, "hover");
      }
    }, delay);
  }

  private onPointerOver = (e: PointerEvent) => {
    this.updateHoverFromEvent(e);
  };

  private onPointerOut = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const related = (e.relatedTarget as Node | null) ?? null;
    if (
      related &&
      (related === this || (typeof this.contains === "function" && this.contains(related)))
    ) {
      return;
    }
    const current = this.pendingTarget ?? this.hoveredTrigger ?? this.activeTarget;
    if (related && current && typeof current.contains === "function" && current.contains(related)) {
      return;
    }

    this.hoveredTrigger = null;
    this.hoveringTooltipBox = false;
    this.suppressedTarget = null;
    if (this.pendingTarget) {
      this.clearOpenTimer();
      this.pendingTarget = null;
    }

    if (this.isOpen && this.openSource === "hover" && this.hideTimer === null) {
      this.scheduleHide();
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.isInsideTooltipLayer(e)) return;
    const trigger = this.findTooltipTrigger(e);

    if (e.pointerType !== "touch") {
      if (trigger && isTooltipTriggerDisabled(trigger)) {
        this.suppressedTarget = null;
        this.showForElement(trigger, false, "disabled-click");
      } else {
        if (trigger) {
          this.suppressedTarget = trigger;
        }
        if (this.isOpen || this.pendingTarget) {
          this.hide();
        }
      }
      return;
    }

    // Touch interaction
    this.clearLongPressTimer();
    if (!trigger) {
      this.touchSession = null;
      if (this.isOpen) this.hide();
      return;
    }

    const mode = resolveTouchMode(trigger);
    if (mode === "none") {
      this.touchSession = null;
      if (this.isOpen) this.hide();
      return;
    }

    if (this.isOpen && this.activeTarget !== trigger) {
      this.hide();
    }

    const session: TouchSession = {
      pointerId: e.pointerId,
      target: trigger,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      longPressFired: false,
    };
    this.touchSession = session;

    if (mode === "longpress") {
      this.longPressTimer = setTimeout(() => {
        this.longPressTimer = null;
        if (this.touchSession === session && !session.moved) {
          session.longPressFired = true;
          this.suppressNextClickUntil = Date.now() + 650;
          this.showForElement(trigger, true, "touch");
        }
      }, TOOLTIP_TIMINGS.longPressMs);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "touch") {
      this.updateHoverFromEvent(e);
      return;
    }
    if (!this.touchSession || e.pointerId !== this.touchSession.pointerId) return;
    const dist = Math.hypot(
      e.clientX - this.touchSession.startX,
      e.clientY - this.touchSession.startY,
    );
    if (dist > TOOLTIP_TIMINGS.moveCancelPx) {
      this.touchSession.moved = true;
      this.clearLongPressTimer();
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.touchSession || e.pointerId !== this.touchSession.pointerId) return;
    const session = this.touchSession;
    this.clearLongPressTimer();
    this.touchSession = null;

    if (session.moved) return;

    if (session.mode === "tap") {
      if (this.isOpen && this.activeTarget === session.target) {
        this.hide();
      } else {
        this.skipOutsidePointerDownForTarget = session.target;
        this.showForElement(session.target, true, "touch");
      }
      return;
    }

    // Longpress mode: if user lifted early (quick tap), allow click & hide any stale tooltip
    if (!session.longPressFired && this.isOpen) {
      this.hide();
    }
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (this.touchSession && e.pointerId === this.touchSession.pointerId) {
      this.clearLongPressTimer();
      this.touchSession = null;
    }
  };

  private syncKeyboardFocusTooltip() {
    const active = this.getDeepActiveElement();
    if (!active) {
      if (this.isOpen && this.openSource === "focus") {
        this.hide();
      }
      return;
    }
    const trigger = this.findTooltipTriggerFromNode(active);
    if (!trigger) {
      if (this.isOpen && this.openSource === "focus") {
        this.hide();
      }
      return;
    }
    let isFocusVisible = false;
    try {
      isFocusVisible = trigger.matches(":focus-visible") || active.matches(":focus-visible");
    } catch (_err) {
      isFocusVisible = false;
    }
    if (isFocusVisible) {
      this.showForElement(trigger, false, "focus");
    } else if (this.isOpen && this.openSource === "focus") {
      this.hide();
    }
  }

  private onFocusIn = (e: FocusEvent) => {
    const trigger = this.findTooltipTrigger(e);
    if (trigger) {
      let isFocusVisible = false;
      try {
        isFocusVisible = trigger.matches(":focus-visible");
      } catch (_err) {
        isFocusVisible = false;
      }
      if (isFocusVisible) {
        this.showForElement(trigger, false, "focus");
        return;
      }
    }
    this.syncKeyboardFocusTooltip();
  };

  private onFocusOut = () => {
    if (this.isOpen && this.openSource === "focus") {
      this.hide();
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && (this.isOpen || this.pendingTarget)) {
      this.suppressedTarget = this.activeTarget ?? this.pendingTarget;
      this.hide();
      return;
    }
    if (e.key === "Tab") {
      this.clearFocusSyncTimer();
      this.focusSyncTimer = setTimeout(() => {
        this.focusSyncTimer = null;
        this.syncKeyboardFocusTooltip();
      }, 0);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Tab") {
      this.syncKeyboardFocusTooltip();
    }
  };

  private onWindowBlur = () => {
    this.hoveredTrigger = null;
    this.hoveringTooltipBox = false;
    this.suppressedTarget = null;
    if (this.isOpen || this.pendingTarget) {
      this.hide();
    }
  };

  private onClickCapture = (e: MouseEvent) => {
    if (Date.now() < this.suppressNextClickUntil) {
      this.suppressNextClickUntil = 0;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const trigger = this.findTooltipTrigger(e);
    if (trigger && this.skipOutsidePointerDownForTarget === trigger) {
      this.skipOutsidePointerDownForTarget = null;
      return;
    }
    this.skipOutsidePointerDownForTarget = null;
    if (trigger && isTooltipTriggerDisabled(trigger)) {
      return;
    }
    if (this.isOpen && !this.isInsideTooltipLayer(e)) {
      this.hide();
    }
  };

  private onContextMenu = (e: Event) => {
    if (this.touchSession?.longPressFired || Date.now() < this.suppressNextClickUntil) {
      e.preventDefault();
    }
  };

  private onScrollOrResize = (e: Event) => {
    if (!this.isOpen) return;
    if (e.type === "scroll" && this.isInsideTooltipLayer(e)) return;
    this.hide();
  };

  override render() {
    const hasRich = Boolean(this.titleText || this.metaText);
    return html`
      <div
        class=${classMap({
          "tooltip-box": true,
          open: this.isOpen,
          positioned: this.positioned,
          "has-rich": hasRich,
        })}
        role="tooltip"
        popover=${this.usePopover ? "manual" : nothing}
        data-placement=${this.placement}
      >
        ${this.titleText ? html`<div class="tooltip-title">${this.titleText}</div>` : nothing}
        ${this.bodyText ? html`<div class="tooltip-body">${this.bodyText}</div>` : nothing}
        ${this.metaText ? html`<div class="tooltip-meta">${this.metaText}</div>` : nothing}
        <div class="tooltip-arrow" aria-hidden="true"></div>
      </div>
    `;
  }
}

customElements.define("tichu-tooltip-layer", TichuTooltipLayer);
