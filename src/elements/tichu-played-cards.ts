import { html, css, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Card } from "./game-model";
import { styles } from "./styles";
import { subscribe } from "./subscription-controller";

const t = (s: string) => (typeof _ === "function" ? _(s) : s);

const COLORS = [1, 2, 3, 4] as const;
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
const SPECIAL_LABELS: Record<number, string> = {
  1: "D",
  2: "P",
  3: "H",
  4: "1",
};
const RANK_LABELS: Record<number, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export class TichuPlayedCards extends LitElement {
  @state() private isAllInfoExposed = false;
  @state() private hand: Card[] = [];
  @state() private currentTrick: Card[] = [];
  @state() private capturedCards: Card[] = [];
  @state() private isTiki = false;

  static override get styles() {
    return [
      styles,
      css`
        :host {
          display: block;
        }
        #playedCards {
          --w: 40px;
          --h: 60px;
        }
        #playedCards h3 {
          padding: 10px 15px;
          background-color: var(--bg-color-lighter);
        }
        #playedCards #playedCardsFlexRow {
          display: flex;
          flex-direction: row;
          justify-content: center;
        }
        #playedCards #playedCardsFlexRow .space {
          flex-grow: 1;
        }
        #playedCards #playedCardsFlexCol {
          flex-grow: 0;
          display: flex;
          flex-direction: column;
          margin: 10px;
          padding: 5px;
          background-color: rgba(255, 255, 255, 0.2);
          border-radius: var(--border-radius);
        }
        #playedCards .type {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        #playedCards .arg {
          width: var(--w);
          height: var(--h);
          margin: 3px;
          border-radius: 3px;
          background-image: var(--card-sprite-url);
          background-position: calc(var(--x) * -1 * var(--w)) calc(var(--y) * -1 * var(--h));
          background-repeat: no-repeat;
          background-size: calc(var(--w) * 14) calc(var(--h) * 4);
          position: relative;
        }
        #playedCards .arg-label {
          font-size: 0;
          color: transparent;
          user-select: none;
        }
        #playedCards .arg.hand {
          opacity: 0.3;
        }
        #playedCards .arg.trick {
          visibility: hidden;
        }
        #playedCards .arg.captured {
          visibility: hidden;
        }
      `,
    ];
  }

  constructor() {
    super();
    subscribe(
      this,
      () => window.gameModel.isAllInfoExposed$,
      (val) => (this.isAllInfoExposed = val),
    );
    subscribe(
      this,
      () => window.gameModel.hand$,
      (hand) => (this.hand = hand),
    );
    subscribe(
      this,
      () => window.gameModel.currentTrick$,
      (trick) => (this.currentTrick = trick),
    );
    subscribe(
      this,
      () => window.gameModel.capturedCards$,
      (captured) => (this.capturedCards = captured),
    );
    subscribe(
      this,
      () => window.gameModel.isTiki$,
      (isTiki) => (this.isTiki = isTiki),
    );
  }

  private getCardSet(cards: Card[]): Set<string> {
    const s = new Set<string>();
    for (const c of cards) {
      s.add(`${Number(c.type)}_${Number(c.type_arg)}`);
    }
    return s;
  }

  override render() {
    const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
    const sprite = this.isTiki ? "img/tiki-cards.png" : "img/tichu-cards.png";
    this.style.setProperty("--card-sprite-url", `url(${themeUrl}${sprite})`);

    const capturedSet = this.getCardSet(this.capturedCards);
    const trickSet = this.getCardSet(this.currentTrick);
    const handSet = this.getCardSet(this.hand);

    return html`
      <div
        id="playedCards"
        class="whiteblock"
        style="display: ${this.isAllInfoExposed ? "block" : "none"}"
      >
        <h3>${t("Played Cards")}</h3>
        <div id="playedCardsFlexRow">
          <div class="space"></div>
          <div id="playedCardsFlexCol">
            ${COLORS.map(
              (color) => html`
                <div id="playedType_${color}" class="type color${color}" style="--y: ${color - 1};">
                  ${VALUES.map((val) => {
                    const key = `${color}_${val}`;
                    const isCaptured = capturedSet.has(key);
                    const isTrick = trickSet.has(key);
                    const isHand = handSet.has(key);
                    const label =
                      val === 1 ? (SPECIAL_LABELS[color] ?? "") : (RANK_LABELS[val] ?? String(val));
                    const classes = {
                      arg: true,
                      captured: isCaptured,
                      trick: isTrick,
                      hand: isHand,
                    };
                    return html`
                      <div
                        id="card_${color}_${val}"
                        class=${classMap(classes)}
                        style="--x: ${val - 1};"
                      >
                        <span
                          id="playedCard_${color}_${val}"
                          class=${classMap({
                            "arg-label": true,
                            captured: isCaptured,
                            trick: isTrick,
                            hand: isHand,
                          })}
                          >${label}</span
                        >
                      </div>
                    `;
                  })}
                </div>
              `,
            )}
          </div>
          <div class="space"></div>
        </div>
      </div>
    `;
  }
}

customElements.define("tichu-played-cards", TichuPlayedCards);
