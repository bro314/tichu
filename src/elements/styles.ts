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
    --border-radius: 6px;
    --elevation: 0px 1px 2px 0px rgba(60, 64, 67, 0.3), 0px 1px 3px 1px rgba(60, 64, 67, 0.15);
    color: #1f2328;
    font-family: Roboto, Arial, sans-serif;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  h3 {
    margin: 0;
    padding: 0;
    font-size: 20px;
    font-weight: 700;
    color: #1f2328;
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
    --bg-color-lighter: rgba(246, 231, 212, 0.8);
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
    padding: 6px 12px;
    font-size: 14px;
    font-weight: 700;
    line-height: 16px;
    border-radius: 6px;
    cursor: pointer;
    text-decoration: none !important;
    user-select: none;
    border: 1px solid rgba(0, 0, 0, 0.25);
    box-shadow: 0 1px 0 #000;
    text-shadow: rgba(0, 0, 0, 0.4) 0 1px 0;
    vertical-align: middle;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition:
      filter 0.12s ease,
      transform 0.06s ease;
  }
  .bgabutton:hover {
    filter: brightness(1.07);
    text-decoration: none !important;
  }
  .bgabutton:active {
    transform: translateY(1px);
  }
  .bgabutton_blue,
  .bgabutton_primary {
    color: #ffffff !important;
    background: linear-gradient(180deg, #4871b6 0%, #3b5f9c 100%);
    border-color: #2f4d80;
  }
  .bgabutton_red,
  .bgabutton_alert {
    color: #ffffff !important;
    background: linear-gradient(180deg, #c92727 0%, #b01e1e 100%);
    border-color: #8f1616;
  }
  .bgabutton_green {
    color: #ffffff !important;
    background: linear-gradient(180deg, #89a538 0%, #748d2d 100%);
    border-color: #5d7223;
  }
  .bgabutton_gray,
  .bgabutton_secondary {
    color: #1f2328 !important;
    background: linear-gradient(180deg, #e5e7eb 0%, #d1d5db 100%);
    border-color: #9ca3af;
  }

  .stockitem {
    border-radius: var(--border-radius, 6px);
    box-shadow: 2px 2px 5px 3px #666;
  }
  .stockitem.stockitem_selected {
    border: 1px solid #dda !important;
    box-shadow: 0px 0px 4px 1px #ff8;
    translate: 0 -20px;
  }

  .disabler {
    display: none;
    position: absolute;
    background: rgba(100, 100, 100, 0.6);
    border-radius: var(--border-radius, 6px);
    left: -4px;
    right: -4px;
    top: -4px;
    bottom: -4px;
    z-index: 10;
  }

  .icon {
    display: none;
    background-image: var(--icon-url);
    background-repeat: no-repeat;
  }
  .icon.star {
    background-size: 128px 64px;
    background-position: -112px -16px;
    width: 16px;
    height: 16px;
    display: inline-block;
  }
  .icon.hand {
    background-size: 128px 64px;
    background-position: -112px 0px;
    width: 16px;
    height: 16px;
    display: inline-block;
  }
  .icon.firstoutcolor {
    background-size: 128px 64px;
    background-position: -64px -32px;
    width: 16px;
    height: 32px;
  }
  .icon.grandtichublack {
    background-size: 128px 64px;
    background-position: 0px 0px;
    width: 32px;
    height: 32px;
  }
  .icon.grandtichucolor {
    background-size: 128px 64px;
    background-position: 0px -32px;
    width: 32px;
    height: 32px;
  }
  .icon.tichublack {
    background-size: 128px 64px;
    background-position: -32px 0px;
    width: 32px;
    height: 32px;
  }
  .icon.tichucolor {
    background-size: 128px 64px;
    background-position: -32px -32px;
    width: 26px;
    height: 26px;
  }
  .icon.big.grandtichublack {
    background-size: 256px 128px;
    background-position: 0px 0px;
    width: 64px;
    height: 64px;
  }
  .icon.big.grandtichucolor {
    background-size: 256px 128px;
    background-position: 0px -64px;
    width: 64px;
    height: 64px;
  }
  .icon.big.tichublack {
    background-size: 256px 128px;
    background-position: -64px 0px;
    width: 64px;
    height: 64px;
  }
  .icon.big.tichucolor {
    background-size: 256px 128px;
    background-position: -64px -64px;
    width: 62.4px;
    height: 62.4px;
  }
  .icon.temp {
    position: absolute;
    display: block;
    left: calc(50% - 128px);
    top: calc(50% - 128px);
    z-index: 100;
    pointer-events: none;
    transition: opacity 1s ease;
  }
  .icon.temp.fading-out {
    opacity: 0;
  }
  .icon.temp.grandtichublack,
  .icon.temp.grand-tichu-black {
    background-size: 1024px 512px;
    background-position: 0px 0px;
    width: 256px;
    height: 256px;
  }
  .icon.temp.grandtichucolor,
  .icon.temp.grand-tichu-color {
    background-size: 1024px 512px;
    background-position: 0px -256px;
    width: 256px;
    height: 256px;
  }
  .icon.temp.tichublack,
  .icon.temp.tichu-black {
    background-size: 1024px 512px;
    background-position: -256px 0px;
    width: 256px;
    height: 256px;
  }
  .icon.temp.tichucolor,
  .icon.temp.tichu-color {
    background-size: 1024px 512px;
    background-position: -256px -256px;
    width: 208px;
    height: 208px;
  }
  .icon.cardback {
    background-size: 128px 64px;
    background-position: -90px 0px;
    width: 22px;
    height: 32px;
  }
`;
