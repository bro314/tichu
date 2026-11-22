import { html, css, LitElement, PropertyValues, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Card } from "./model";

export interface PassedOriginInfo {
  playerId: string;
  playerName: string;
  avatarUrl: string;
  seat: "left" | "partner" | "right";
  tooltip: string;
  showGlow: boolean;
  showAvatar: boolean;
}

export interface CardTooltipParts {
  title: string;
  body: string;
  meta: string;
}

export function getDefaultCardTooltipParts(card: Card | undefined): {
  title: string;
  body: string;
} {
  if (!card) return { title: "", body: "" };
  const color = Number(card.type);
  const rank = Number(card.type_arg);
  if (rank === 10 || rank === 13) return { title: "", body: _("Scores 10 points") };
  if (rank === 5) return { title: "", body: _("Scores 5 points") };
  if (rank === 1) {
    if (color === 1) {
      return {
        title: _("Dragon"),
        body: _(
          "Highest single card. Scores 25 points. Trick given to an opponent if Dragon wins it.",
        ),
      };
    }
    if (color === 2) {
      return {
        title: _("Phoenix"),
        body: _(
          "Scores -25 points. Takes the place of any normal card in a combo but not a bomb. As a Single, worth 1.5 when led, beats any other card but the Dragon by 0.5.",
        ),
      };
    }
    if (color === 3) {
      return {
        title: _("Dog"),
        body: _(
          "The Hound must be played as a leading single card. Player's partner (or the next one if he's gone out) can lead.",
        ),
      };
    }
    if (color === 4) {
      return {
        title: _("Mahjong"),
        body: _("Scores 0 points. Owner of this card plays first. Player can make a wish."),
      };
    }
  }
  return { title: "", body: "" };
}

export function getDefaultCardTooltip(card: Card | undefined): string {
  return getDefaultCardTooltipParts(card).body;
}

export class TichuCard extends LitElement {
  @property({ type: Object }) card: Card | undefined;

  @property({ type: Boolean }) pass = false;

  @property({ type: Boolean }) half = false;

  @property({ type: Number }) scale = 1.0;

  @property({ type: Boolean }) selected = false;

  @property({ type: Boolean }) selectable = false;

  @property({ type: Boolean }) tiki = false;

  @property({ type: Boolean }) wishMatch = false;

  @property({ type: String }) tooltip = "";

  @property({ type: Boolean }) reserveFooter = false;

  @property({ attribute: false }) passedOrigin: PassedOriginInfo | null = null;

  @state() private avatarLoadFailed = false;

  private lastAvatarUrl = "";

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
          translate: 0 0;
          width: var(--width);
          height: var(--height);
          background-image: var(--card-url);
          background-size: var(--bg-width) var(--bg-height);
          background-position-x: var(--x-pos);
          background-position-y: var(--y-pos);
          border-radius: var(--tichu-card-radius, 8px);
          box-shadow: var(
            --tichu-card-shadow,
            0 0 0 1px rgba(15, 23, 42, 0.12),
            0 2px 4px rgba(15, 23, 42, 0.16),
            0 6px 14px rgba(15, 23, 42, 0.18)
          );
          box-sizing: border-box;
          transition:
            translate var(--tichu-card-select-ms, 100ms)
              var(--tichu-anim-easing, cubic-bezier(0.22, 1, 0.36, 1)),
            box-shadow var(--tichu-card-glow-ms, 120ms) ease;
        }
        div#card.selectable {
          cursor: pointer;
        }
        div#card.passed-highlight {
          box-shadow:
            0 0 0 2px #0ea5e9,
            0 0 12px rgba(14, 165, 233, 0.55),
            0 4px 12px rgba(15, 23, 42, 0.18);
        }
        div#card.wish-match {
          box-shadow:
            0 0 0 2px #f59e0b,
            0 0 12px rgba(245, 158, 11, 0.58),
            0 4px 12px rgba(15, 23, 42, 0.18);
        }
        div#card.stockitem_selected {
          translate: 0 -20px;
          border: none !important;
          box-shadow: var(
            --tichu-card-selected-shadow,
            0 0 0 2.5px var(--tichu-select-ring, #0284c7),
            0 0 0 4.5px var(--tichu-select-glow, rgba(56, 189, 248, 0.32)),
            0 10px 22px rgba(15, 23, 42, 0.28)
          );
        }
        div#card.passed-highlight.stockitem_selected {
          box-shadow:
            0 0 0 2.5px #0ea5e9,
            0 0 0 4.5px rgba(14, 165, 233, 0.35),
            0 10px 22px rgba(15, 23, 42, 0.28);
        }
        div#card.wish-match.stockitem_selected {
          box-shadow:
            0 0 0 2.5px #f59e0b,
            0 0 0 4.5px rgba(245, 158, 11, 0.38),
            0 10px 22px rgba(15, 23, 42, 0.28);
        }
        div#card.pass {
          background-size: cover;
          background-position: center;
          opacity: 0.92;
          box-shadow: var(
            --tichu-card-shadow,
            0 0 0 1px rgba(15, 23, 42, 0.12),
            0 2px 4px rgba(15, 23, 42, 0.16),
            0 6px 14px rgba(15, 23, 42, 0.18)
          );
        }
        .card-footer {
          position: relative;
          width: var(--width);
          height: var(--card-footer-height, 34px);
          pointer-events: none;
        }
        .passed-avatar-wrap {
          position: absolute;
          top: 6px;
          left: clamp(
            0px,
            calc(var(--card-visible-width, var(--width)) / 2 - 13px),
            calc(var(--width) / 2 - 13px)
          );
          width: 26px;
          height: 26px;
          border-radius: 50%;
          box-sizing: border-box;
          background: #334155;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition:
            opacity 280ms ease,
            visibility 0s linear 280ms;
        }
        .passed-avatar-wrap.visible {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transition:
            opacity 220ms ease,
            visibility 0s linear 0s;
        }
        .passed-avatar-wrap.partner {
          border: 2px solid #0f9d58;
        }
        .passed-avatar-wrap.opponent {
          border: 2px solid #475569;
        }
        .passed-avatar-img {
          width: 100%;
          height: 100%;
          aspect-ratio: 1;
          border-radius: 50%;
          object-fit: cover;
          display: block;
        }
        .passed-avatar-fallback {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          text-transform: uppercase;
          user-select: none;
        }
        .passed-avatar-wrap.partner .passed-avatar-fallback {
          background: #0f9d58;
        }
        .passed-avatar-wrap.opponent .passed-avatar-fallback {
          background: #334155;
        }
        @media (forced-colors: active) {
          div#card.passed-highlight,
          div#card.wish-match {
            outline: 2px solid Highlight;
            outline-offset: 1px;
          }
          .passed-avatar-wrap {
            border-color: CanvasText;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          div#card,
          .passed-avatar-wrap,
          .passed-avatar-wrap.visible {
            transition: none;
          }
        }
      `,
    ];
  }

  protected override willUpdate(changedProperties: PropertyValues) {
    super.willUpdate(changedProperties);
    if (changedProperties.has("passedOrigin")) {
      const nextUrl = this.passedOrigin?.avatarUrl ?? "";
      if (nextUrl !== this.lastAvatarUrl) {
        this.lastAvatarUrl = nextUrl;
        this.avatarLoadFailed = false;
      }
    }
  }

  getComputedTooltip(): string {
    if (this.tooltip) return this.tooltip;
    if (this.pass) return _("Pass");
    const base = getDefaultCardTooltip(this.card);
    if (this.passedOrigin && (this.passedOrigin.showAvatar || this.passedOrigin.showGlow)) {
      return base ? `${base} — ${this.passedOrigin.tooltip}` : this.passedOrigin.tooltip;
    }
    return base;
  }

  getComputedTooltipParts(): CardTooltipParts {
    if (this.tooltip) return { title: "", body: this.tooltip, meta: "" };
    if (this.pass) return { title: "", body: _("Pass"), meta: "" };
    const base = getDefaultCardTooltipParts(this.card);
    if (this.passedOrigin && (this.passedOrigin.showAvatar || this.passedOrigin.showGlow)) {
      if (base.title || base.body) {
        return {
          title: base.title,
          body: base.body,
          meta: this.passedOrigin.tooltip,
        };
      }
      return { title: "", body: this.passedOrigin.tooltip, meta: "" };
    }
    return { title: base.title, body: base.body, meta: "" };
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

    const tooltipParts = this.getComputedTooltipParts();
    const origin = this.passedOrigin;
    const showGlow = Boolean(origin?.showGlow);
    const isPartner = origin?.seat === "partner";
    const showImg = Boolean(origin?.avatarUrl) && !this.avatarLoadFailed;
    const initial = (origin?.playerName?.trim()?.[0] ?? "?").toUpperCase();

    return html`<div
        id="card"
        class=${classMap({
          card: true,
          stockitem: true,
          stockitem_selected: this.selected,
          selectable: this.selectable,
          "passed-highlight": showGlow,
          "wish-match": this.wishMatch,
        })}
        data-card-id=${this.card.id ?? ""}
        data-tooltip=${tooltipParts.body || nothing}
        data-tooltip-title=${tooltipParts.title || nothing}
        data-tooltip-meta=${tooltipParts.meta || nothing}
        data-tooltip-touch=${this.selectable ? "longpress" : "tap"}
        @click=${this.onClick}
      ></div>
      ${
        this.reserveFooter
          ? html`<div class="card-footer">
              ${
                origin
                  ? html`<div
                      class=${classMap({
                        "passed-avatar-wrap": true,
                        visible: origin.showAvatar,
                        partner: isPartner,
                        opponent: !isPartner,
                      })}
                      data-tooltip=${origin.showAvatar ? origin.tooltip : nothing}
                      data-tooltip-touch="tap"
                      aria-label=${origin.showAvatar ? origin.tooltip : ""}
                    >
                      ${
                        showImg
                          ? html`<img
                              class="passed-avatar-img"
                              src=${origin.avatarUrl}
                              alt=""
                              width="22"
                              height="22"
                              @error=${this.onAvatarError}
                            />`
                          : html`<span class="passed-avatar-fallback" aria-hidden="true"
                              >${initial}</span
                            >`
                      }
                    </div>`
                  : ""
              }
            </div>`
          : ""
      }`;
  }

  private onAvatarError() {
    this.avatarLoadFailed = true;
  }

  renderPass(themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "") {
    const passSprite = this.tiki ? "img/tiki-icons-pass.png" : "img/tichu-icons-pass.png";
    this.style.setProperty("--card-url", `url(${themeUrl}${passSprite})`);
    return html`<div
      id="card"
      class="card stockitem pass"
      data-card-id=""
      data-tooltip=${this.getComputedTooltip() || nothing}
      data-tooltip-touch="tap"
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
