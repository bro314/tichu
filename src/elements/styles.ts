import { css } from "lit";

export const button = css`
  button {
    display: inline-block;
    font-family: Roboto, Arial, sans-serif;
    font-size: 14px;
    font-weight: 700;
    text-align: center;
    margin-top: 10px;
    border: 1px solid #060606;
    border-radius: 6px;
    padding: 6px 12px;
    width: 100%;
    box-sizing: border-box;
    box-shadow: none;
    text-shadow: none;
    color: #060606;
    background: transparent;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const styles = css`
  :host {
    --border-radius: 12px;
    --tichu-card-radius: 8px;
    --elevation:
      0 1px 2px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.65);
    color: var(--tichu-text, #1f2328);
    font-family: var(
      --tichu-font-sans,
      Inter,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Arial,
      sans-serif
    );
    -webkit-font-smoothing: antialiased;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  h3 {
    margin: 5px 0;
    padding: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--tichu-text, #1f2328);
  }

  a {
    color: #2b579a;
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }

  .theme0 {
    --bg-color-html: rgba(0, 0, 0, 0.3);
    --bg-color-play-area: rgba(255, 255, 255, 0.3);
    --bg-color-lighter: rgba(252, 246, 238, 0.86);
  }
  .theme1 {
    --bg-color-html: hsl(225 35% 15% / 1);
    --bg-color-play-area: hsl(225 20% 65% / 1);
    --bg-color-lighter: hsl(225 30% 90% / 1);
  }
  .theme2 {
    --bg-color-html: hsl(203 37% 20% / 1);
    --bg-color-play-area: hsl(50 15% 60% / 1);
    --bg-color-lighter: hsl(50 10% 80% / 1);
  }
  .theme3 {
    --bg-color-html: hsl(352 71% 25% / 1);
    --bg-color-play-area: hsl(342 56% 76% / 1);
    --bg-color-lighter: hsl(32 66% 90% / 1);
  }
  .theme4 {
    --bg-color-html: transparent;
    --bg-color-play-area: rgba(255, 255, 255, 0.3);
    --bg-color-lighter: rgba(255, 255, 255, 0.7);
  }
  .theme5 {
    --bg-color-html: hsl(0 0% 25% / 1);
    --bg-color-play-area: hsl(355 45% 50% / 1);
    --bg-color-lighter: hsl(40 100% 86% / 1);
    --bg-color-active: rgba(255, 155, 0, 0.8);
  }
  .theme6 {
    --bg-color-html: hsl(0 0% 20% / 1);
    --bg-color-play-area: hsl(0 0% 70% / 1);
    --bg-color-lighter: hsl(0 0% 90% / 1);
  }
  .theme7 {
    --bg-color-html: hsl(216, 69%, 20%);
    --bg-color-play-area: hsl(32, 43%, 75%);
    --bg-color-lighter: hsl(35, 58%, 94%);
  }
  .theme8 {
    --bg-color-html: hsl(222, 38%, 9%);
    --bg-color-play-area: hsl(212, 8%, 64%);
    --bg-color-lighter: hsl(41, 70%, 85%);
  }
  .theme9 {
    --bg-color-html: hsl(33 53% 25% / 1);
    --bg-color-play-area: hsl(33 40% 64% / 1);
    --bg-color-lighter: hsl(33 68% 85% / 1);
  }
  .theme10 {
    --bg-color-html: hsl(91, 23%, 26%);
    --bg-color-play-area: hsl(87, 24%, 61%);
    --bg-color-lighter: hsl(35, 69%, 94%);
  }

  .bgabutton {
    display: inline-block;
    padding: 7px 14px;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: 0.01em;
    border-radius: 8px;
    cursor: pointer;
    text-decoration: none !important;
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
    color: #fff;
    text-shadow: none;
    vertical-align: middle;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 10px;
    margin-bottom: 10px;
    transition:
      background-color 140ms ease,
      border-color 140ms ease,
      box-shadow 140ms ease,
      transform 120ms ease,
      filter 140ms ease;
  }
  .bgabutton:hover {
    text-decoration: none !important;
  }
  .bgabutton:active:not(.disabled) {
    transform: translateY(1px);
  }
  .bgabutton:focus-visible {
    outline: 2px solid var(--tichu-select-ring, #0284c7);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .bgabutton {
      transition: none;
    }
    .bgabutton:active:not(.disabled) {
      transform: none;
    }
  }
  .bgabutton.disabled,
  .bgabutton.disabled:hover,
  .bgabutton.disabled:active {
    opacity: 0.52;
    cursor: not-allowed;
    filter: grayscale(0.35);
    box-shadow: none;
    transform: none;
  }
  .bgabutton_blue,
  .bgabutton_primary {
    background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
    border: 1px solid #1e40af;
    color: #ffffff;
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  .bgabutton_blue:hover,
  .bgabutton_primary:hover {
    background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
    border-color: #1d4ed8;
  }
  .bgabutton_blue:active,
  .bgabutton_primary:active {
    background: linear-gradient(180deg, #1d4ed8 0%, #1e40af 100%);
  }
  .bgabutton_red,
  .bgabutton_alert {
    background: linear-gradient(180deg, #dc2626 0%, #b91c1c 100%);
    border: 1px solid #991b1b;
    color: #ffffff;
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
  }
  .bgabutton_red:hover,
  .bgabutton_alert:hover {
    background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
    border-color: #b91c1c;
  }
  .bgabutton_red:active,
  .bgabutton_alert:active {
    background: linear-gradient(180deg, #b91c1c 0%, #991b1b 100%);
  }
  .bgabutton_green {
    background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
    border: 1px solid #166534;
    color: #ffffff;
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  .bgabutton_green:hover {
    background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%);
    border-color: #15803d;
    color: #ffffff;
  }
  .bgabutton_green:active {
    background: linear-gradient(180deg, #15803d 0%, #166534 100%);
  }
  .bgabutton_gray,
  .bgabutton_secondary {
    background: var(--tichu-btn-sec-bg, rgba(255, 255, 255, 0.92));
    border: 1px solid var(--tichu-btn-sec-border, rgba(15, 23, 42, 0.16));
    color: var(--tichu-btn-sec-fg, #1e293b);
    box-shadow: var(
      --tichu-btn-sec-shadow,
      0 1px 2px rgba(15, 23, 42, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.9)
    );
    position: relative;
    text-shadow: none;
  }
  .bgabutton_gray:hover,
  .bgabutton_secondary:hover {
    background: var(--tichu-btn-sec-bg-hover, #ffffff);
    border-color: var(--tichu-btn-sec-border, rgba(15, 23, 42, 0.24));
    color: var(--tichu-btn-sec-fg, #1e293b);
  }
  .bgabutton_gray:active,
  .bgabutton_secondary:active {
    background: var(--tichu-btn-sec-bg-active, #f1f5f9);
    color: var(--tichu-btn-sec-fg, #1e293b);
  }

  .stockitem {
    border-radius: var(--tichu-card-radius, 8px);
    box-shadow: var(
      --tichu-card-shadow,
      0 0 0 1px rgba(15, 23, 42, 0.12),
      0 2px 4px rgba(15, 23, 42, 0.16),
      0 6px 14px rgba(15, 23, 42, 0.18)
    );
  }
  .stockitem.stockitem_selected {
    border: none !important;
    box-shadow: var(
      --tichu-card-selected-shadow,
      0 0 0 2.5px var(--tichu-select-ring, #0284c7),
      0 0 0 4.5px var(--tichu-select-glow, rgba(56, 189, 248, 0.32)),
      0 10px 22px rgba(15, 23, 42, 0.28)
    );
    translate: 0 -20px;
  }

  .disabler {
    display: none;
    position: absolute;
    background: rgba(15, 23, 42, 0.42);
    border-radius: var(--border-radius, 12px);
    left: -2px;
    right: -2px;
    top: -2px;
    bottom: -2px;
    z-index: 10;
  }

  .icon {
    --icon-size: 28px;
    display: none;
    width: var(--icon-size);
    height: var(--icon-size);
    background-image: var(--ui-icons-url);
    background-repeat: no-repeat;
    background-size: calc(var(--icon-size) * 4) calc(var(--icon-size) * 3);
    vertical-align: middle;
  }
  .icon.star {
    --icon-size: 18px;
    background-position: calc(var(--icon-size) * -2) calc(var(--icon-size) * -1);
    display: inline-block;
    vertical-align: -3px;
  }
  .icon.hand {
    --icon-size: 18px;
    background-position: calc(var(--icon-size) * -1) calc(var(--icon-size) * -1);
    display: inline-block;
    vertical-align: -3px;
  }
  .icon.firstoutcolor {
    --icon-size: 28px;
    background-position: 0 calc(var(--icon-size) * -1);
  }
  .icon.grandtichucolor {
    --icon-size: 28px;
    background-position: 0 0;
  }
  .icon.grandtichublack {
    --icon-size: 28px;
    background-position: calc(var(--icon-size) * -1) 0;
  }
  .icon.tichucolor {
    --icon-size: 28px;
    background-position: calc(var(--icon-size) * -2) 0;
  }
  .icon.tichublack {
    --icon-size: 28px;
    background-position: calc(var(--icon-size) * -3) 0;
  }
  .icon.big.grandtichucolor {
    --icon-size: 56px;
    background-position: 0 0;
  }
  .icon.big.grandtichublack {
    --icon-size: 56px;
    background-position: calc(var(--icon-size) * -1) 0;
  }
  .icon.big.tichucolor {
    --icon-size: 56px;
    background-position: calc(var(--icon-size) * -2) 0;
  }
  .icon.big.tichublack {
    --icon-size: 56px;
    background-position: calc(var(--icon-size) * -3) 0;
  }
  .icon.temp {
    --icon-size: 256px;
    position: absolute;
    display: block;
    left: calc(50% - 128px);
    top: calc(50% - 128px);
    z-index: 100;
    pointer-events: none;
    opacity: 1;
    scale: 1;
    transition:
      opacity var(--tichu-bet-enter-ms, 140ms)
        var(--tichu-anim-easing, cubic-bezier(0.22, 1, 0.36, 1)),
      scale var(--tichu-bet-enter-ms, 140ms)
        var(--tichu-anim-easing, cubic-bezier(0.22, 1, 0.36, 1));
  }
  @starting-style {
    .icon.temp {
      opacity: 0;
      scale: 0.78;
    }
  }
  .icon.temp.fading-out {
    opacity: 0;
    scale: 1.05;
    transition:
      opacity var(--tichu-bet-fade-ms, 350ms) ease,
      scale var(--tichu-bet-fade-ms, 350ms) ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .icon.temp,
    .icon.temp.fading-out {
      transition: none;
      scale: 1;
    }
    @starting-style {
      .icon.temp {
        opacity: 1;
        scale: 1;
      }
    }
  }
  .icon.temp.grandtichucolor,
  .icon.temp.grand-tichu-color {
    --icon-size: 256px;
    background-position: 0 0;
  }
  .icon.temp.grandtichublack,
  .icon.temp.grand-tichu-black {
    --icon-size: 256px;
    background-position: calc(var(--icon-size) * -1) 0;
  }
  .icon.temp.tichucolor,
  .icon.temp.tichu-color {
    --icon-size: 256px;
    background-position: calc(var(--icon-size) * -2) 0;
  }
  .icon.temp.tichublack,
  .icon.temp.tichu-black {
    --icon-size: 256px;
    background-position: calc(var(--icon-size) * -3) 0;
  }
  .icon.cardback {
    --icon-size: 28px;
    background-position: calc(var(--icon-size) * -3) calc(var(--icon-size) * -1);
  }
  [data-tooltip-touch="longpress"] {
    -webkit-touch-callout: none;
  }
`;
