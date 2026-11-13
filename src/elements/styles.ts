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
    margin: 5px 0;
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
    border-radius: 6px;
    cursor: pointer;
    text-decoration: none !important;
    box-shadow: 0 1px #000;
    color: #fff;
    text-shadow: #0006 0 1px 0;
    vertical-align: middle;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 10px;
    margin-bottom: 10px;
  }
  .bgabutton:hover {
    text-decoration: none !important;
  }
  .bgabutton_blue,
  .bgabutton_primary {
    background:
      var(
        --game-bga-button-primary,
        linear-gradient(180deg, #0b72b5 0%, #244587 100%) no-repeat border-box
      ),
      var(
        --game-bga-button-primary-border,
        linear-gradient(180deg, #809ac0, #5b6095) no-repeat border-box
      );
    color: var(--game-bga-color-white, #fff);
  }
  .bgabutton_blue:hover,
  .bgabutton_primary:hover {
    background:
      var(
        --game-bga-button-primary-hover,
        linear-gradient(180deg, #0692ea, #244587) no-repeat border-box
      ),
      var(
        --game-bga-button-primary-border,
        linear-gradient(180deg, #809ac0, #5b6095) no-repeat border-box
      );
  }
  .bgabutton_blue:active,
  .bgabutton_primary:active {
    background:
      var(
        --game-bga-button-primary-active,
        linear-gradient(180deg, #244587 0%, #0b72b5 100%) no-repeat border-box
      ),
      var(
        --game-bga-button-primary-border-active,
        linear-gradient(180deg, #5b6095, #809ac0) no-repeat border-box
      );
  }
  .bgabutton_red,
  .bgabutton_alert {
    background:
      var(--game-bga-button-alert, linear-gradient(180deg, #e42421, #86211f) no-repeat border-box),
      var(
        --game-bga-button-alert-border,
        linear-gradient(180deg, #e44e2a, #863534) no-repeat border-box
      );
    color: var(--game-bga-color-white, #fff);
  }
  .bgabutton_red:hover,
  .bgabutton_alert:hover {
    background:
      var(
        --game-bga-button-alert-hover,
        linear-gradient(180deg, #ff6247, #86211f) no-repeat border-box
      ),
      var(
        --game-bga-button-alert-border,
        linear-gradient(180deg, #e44e2a, #863534) no-repeat border-box
      );
  }
  .bgabutton_red:active,
  .bgabutton_alert:active {
    background:
      var(
        --game-bga-button-alert-active,
        linear-gradient(180deg, #86211f, #e42421) no-repeat border-box
      ),
      var(
        --game-bga-button-alert-border-active,
        linear-gradient(180deg, #863534, #e44e2a) no-repeat border-box
      );
  }
  .bgabutton_green {
    background: linear-gradient(180deg, #799332, #89a538);
    border: 1px solid #697f2b;
    color: #fff;
  }
  .bgabutton_green:hover {
    background: #89a538;
    color: #fff;
  }
  .bgabutton_green:active {
    background: #697f2b;
    border-top-color: #697f2b;
  }
  .bgabutton_gray,
  .bgabutton_secondary {
    background:
      var(
        --game-bga-button-secondary,
        linear-gradient(180deg, #f4f4f4 0%, #cacaca 100%) no-repeat border-box
      ),
      var(
        --game-bga-button-secondary-border,
        linear-gradient(180deg, #fff, #dedede) no-repeat border-box
      );
    color: var(--game-bga-button-secondary-text, #014090);
    padding: 5px 11px;
    position: relative;
    text-shadow: none;
  }
  .bgabutton_gray::after,
  .bgabutton_secondary::after {
    border: 1px solid var(--game-bga-button-secondary-outline, #ababab);
    border-radius: 5px;
    content: " ";
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    pointer-events: none;
    position: absolute;
  }
  .bgabutton_gray:hover,
  .bgabutton_secondary:hover {
    background:
      var(
        --game-bga-button-secondary-hover,
        linear-gradient(180deg, #fefefe, #cacaca) no-repeat border-box
      ),
      var(
        --game-bga-button-secondary-border-hover,
        linear-gradient(180deg, #fff, #e8e8e8) no-repeat border-box
      );
    color: var(--game-bga-button-secondary-text, #014090);
  }
  .bgabutton_gray:active,
  .bgabutton_secondary:active {
    background:
      var(
        --game-bga-button-secondary-active,
        linear-gradient(180deg, #cacaca 0%, #f4f4f4 100%) no-repeat border-box
      ),
      var(
        --game-bga-button-secondary-border-active,
        linear-gradient(180deg, #e8e8e8, #fff) no-repeat border-box
      );
    color: var(--game-bga-button-secondary-text, #014090);
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
