import type { CardData as TichuCard } from "../types/tichu-contracts";

// Combo & Special Card Constants (mirrors modules/Constants.php)
export const INVALID_COMBO = -1;
export const PASS_COMBO = 0;
export const SINGLE_COMBO = 1;
export const PAIR_COMBO = 2;
export const TRIP_COMBO = 3;
export const RUNNING_PAIRS_COMBO = 4;
export const STRAIGHT_COMBO = 5;
export const FULL_HOUSE_COMBO = 6;
export const BOMB_COMBO = 7;
export const DOG_COMBO = 8;
export const NO_COMBO = 99;

export const SPECIAL_CARD_TYPE = 1;
export const TYPE_DRAGON = 1;
export const TYPE_PHOENIX = 2;
export const TYPE_DOG = 3;
export const TYPE_MAHJONG = 4;

type ComboCheckMethod =
  "Dog" | "Bomb" | "Single" | "Pair" | "Trip" | "RunningPair" | "Straight" | "FullHouse";

const COMBO_CHECK_ORDER: ReadonlyArray<[number, ComboCheckMethod]> = [
  [DOG_COMBO, "Dog"],
  [BOMB_COMBO, "Bomb"],
  [SINGLE_COMBO, "Single"],
  [PAIR_COMBO, "Pair"],
  [TRIP_COMBO, "Trip"],
  [RUNNING_PAIRS_COMBO, "RunningPair"],
  [STRAIGHT_COMBO, "Straight"],
  [FULL_HOUSE_COMBO, "FullHouse"],
];

interface CheckResult {
  cards: TichuCard[];
  phoenixValue: number | number[] | null;
  description: string;
}

export function cardRank(card: TichuCard): number {
  return Number(card.type_arg);
}

export function cardSuit(card: TichuCard): number {
  return Number(card.type);
}

export function makeSyntheticCard(rank: number, suit: number): TichuCard {
  return {
    id: `0`,
    type: String(suit),
    type_arg: String(rank),
  };
}

export function sortCards(cards: TichuCard[]): TichuCard[] {
  return [...cards].sort((a, b) => {
    const valDiff = cardRank(a) - cardRank(b);
    if (valDiff !== 0) return valDiff;
    return cardSuit(a) - cardSuit(b);
  });
}

function getDoubles(values: number[]): number[] {
  const res: number[] = [];
  for (let idx = 1; idx < values.length; idx++) {
    if (values[idx - 1] === values[idx]) {
      res.push(values[idx]!);
    }
  }
  return res;
}

/**
 * Mirrors `CardManager::cardToStr` (preserving HTML `&#39;s` entity for parity).
 */
export function cardToStr(cardOrVal: TichuCard | number, plural = false): string {
  const isCardObj = typeof cardOrVal === "object" && cardOrVal !== null;
  const val = isCardObj ? cardRank(cardOrVal) : Number(cardOrVal);
  switch (val) {
    case 1:
      if (!isCardObj) {
        return "1";
      }
      switch (cardSuit(cardOrVal)) {
        case TYPE_DRAGON:
          return "Dragon";
        case TYPE_PHOENIX:
          return "Phoenix";
        case TYPE_DOG:
          return "Dog";
        case TYPE_MAHJONG:
          return "Mahjong";
        default:
          return "1";
      }
    case 11:
      return plural ? "Jacks" : "Jack";
    case 12:
      return plural ? "Queens" : "Queen";
    case 13:
      return plural ? "Kings" : "King";
    case 14:
      return plural ? "Aces" : "Ace";
    default:
      return plural ? `${val}&#39;s` : String(val);
  }
}

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&#39;/g, "'");
}

export function rankToDisplayName(rank: number, plural = false): string {
  return decodeHtmlEntities(cardToStr(rank, plural));
}

export function comboTypeToLabel(type: number): string {
  switch (type) {
    case SINGLE_COMBO:
      return "single";
    case PAIR_COMBO:
      return "pair";
    case TRIP_COMBO:
      return "triple";
    case RUNNING_PAIRS_COMBO:
      return "running pairs";
    case STRAIGHT_COMBO:
      return "straight";
    case FULL_HOUSE_COMBO:
      return "full house";
    case BOMB_COMBO:
      return "bomb";
    case DOG_COMBO:
      return "Dog";
    default:
      return "combo";
  }
}

export interface LastComboLike {
  cards?: TichuCard[];
  type?: number;
  phoenixValue?: number | number[] | null;
  description?: string;
  player?: string | number;
  playerId?: string;
}

/**
 * Direct TypeScript port of `modules/Combo.php`.
 */
export class Combo {
  public cards: TichuCard[];
  public type: number;
  public phoenixValue: number | number[] | null;
  public description: string;
  public player: string;

  public static lastComboForTesting: Combo | null = null;
  public static readonly noCombo: Combo = new Combo([], NO_COMBO);

  constructor(
    cards: TichuCard[],
    type: number | null = null,
    phoenixValue: number | number[] | null = null,
    description: string | null = null,
    lastCombo: Combo | null = null,
  ) {
    if (type === null) {
      if (cards.length === 0) {
        this.cards = [];
        this.type = INVALID_COMBO;
        this.phoenixValue = null;
        this.description = "";
        this.player = "";
        return;
      }
      const sorted = sortCards(cards);
      for (const [comboType, methodName] of COMBO_CHECK_ORDER) {
        const res = Combo.runCheck(methodName, sorted, lastCombo);
        if (res !== null) {
          this.cards = res.cards;
          this.type = comboType;
          this.phoenixValue = res.phoenixValue;
          this.description = res.description;
          this.player = "";
          return;
        }
      }
      this.cards = sorted;
      this.type = INVALID_COMBO;
      this.phoenixValue = null;
      this.description = "";
      this.player = "";
    } else {
      this.cards = cards;
      this.type = type;
      this.phoenixValue = phoenixValue;
      this.description = description ?? "";
      this.player = "";
    }
  }

  public static fromLastComboState(state: LastComboLike | null | undefined): Combo {
    if (!state) {
      return Combo.noCombo;
    }
    const rawType = state.type !== undefined ? Number(state.type) : NO_COMBO;
    const cards = Array.isArray(state.cards) ? state.cards : [];
    if (rawType === NO_COMBO || (cards.length === 0 && rawType === PASS_COMBO)) {
      return Combo.noCombo;
    }
    if (cards.length === 0) {
      return Combo.noCombo;
    }
    const explicitType = rawType > 0 && rawType !== NO_COMBO ? rawType : null;
    const combo = new Combo(cards, null, null, null, Combo.noCombo);
    if (
      explicitType === SINGLE_COMBO &&
      combo.type === SINGLE_COMBO &&
      state.phoenixValue !== undefined &&
      state.phoenixValue !== null &&
      !Array.isArray(state.phoenixValue)
    ) {
      combo.phoenixValue = Number(state.phoenixValue);
      const valBelow = Number(combo.phoenixValue) - 0.5;
      combo.description = `Phoenix a half step above ${cardToStr(valBelow)}`;
    } else if (Array.isArray(combo.phoenixValue) && typeof state.phoenixValue === "number") {
      combo.setPhoenixValue(Number(state.phoenixValue));
    } else if (
      combo.type === SINGLE_COMBO &&
      combo.cards[0] &&
      cardRank(combo.cards[0]) === 1 &&
      cardSuit(combo.cards[0]) === TYPE_PHOENIX &&
      typeof state.phoenixValue === "number"
    ) {
      combo.phoenixValue = Number(state.phoenixValue);
    }
    if (state.description && !combo.description) {
      combo.description = state.description;
    }
    combo.player = String(state.player ?? state.playerId ?? "");
    return combo;
  }

  private static runCheck(
    methodName: ComboCheckMethod,
    cards: TichuCard[],
    lastCombo: Combo | null,
  ): CheckResult | null {
    switch (methodName) {
      case "Dog":
        return Combo.checkDog(cards);
      case "Bomb":
        return Combo.checkBomb(cards);
      case "Single":
        return Combo.checkSingle(cards, lastCombo);
      case "Pair":
        return Combo.checkPair(cards);
      case "Trip":
        return Combo.checkTrip(cards);
      case "RunningPair":
        return Combo.checkRunningPair(cards);
      case "Straight":
        return Combo.checkStraight(cards);
      case "FullHouse":
        return Combo.checkFullHouse(cards);
    }
  }

  public checkType(lastCombo: Combo | null = null): boolean {
    const entry = COMBO_CHECK_ORDER.find(([t]) => t === this.type);
    if (!entry) {
      this.type = INVALID_COMBO;
      return false;
    }
    const sorted = sortCards(this.cards);
    const res = Combo.runCheck(entry[1], sorted, lastCombo);
    if (res === null) {
      this.type = INVALID_COMBO;
      return false;
    }
    this.cards = res.cards;
    this.phoenixValue = res.phoenixValue;
    this.description = res.description;
    return true;
  }

  public recheckPhoenix(lastCombo: Combo | null = null): void {
    if (!Array.isArray(this.phoenixValue)) {
      return;
    }
    const effectiveLast = lastCombo ?? Combo.lastComboForTesting;
    if (
      effectiveLast === null ||
      effectiveLast.type === NO_COMBO ||
      effectiveLast.type === DOG_COMBO
    ) {
      return;
    }
    if (effectiveLast.type !== this.type || effectiveLast.cards.length !== this.cards.length) {
      this.setPhoenixValue(this.phoenixValue[0]!);
      return;
    }
    const val = effectiveLast.getFirstValue();
    if (this.type === STRAIGHT_COMBO) {
      const lowFirst = this.phoenixValue[1]!;
      if (lowFirst > val) {
        return;
      }
      this.setPhoenixValue(this.phoenixValue[0]!);
      return;
    }
    if (this.phoenixValue[0]! > val) {
      return;
    }
    this.setPhoenixValue(this.phoenixValue[1]!);
  }

  public canBeat(combo: Combo | null | undefined): boolean {
    if (this.type === INVALID_COMBO) {
      return false;
    }
    if (!combo || combo.type === NO_COMBO || combo.type === DOG_COMBO) {
      return true;
    }
    if (this.type === DOG_COMBO) {
      return false;
    }
    const length = this.cards.length;
    const cLength = combo.cards.length;

    if (this.type === BOMB_COMBO) {
      if (combo.type === BOMB_COMBO) {
        if (length === cLength) {
          return this.getFirstValue() > combo.getFirstValue();
        }
        return length > cLength;
      }
      return true;
    }
    if (this.type !== combo.type || length !== cLength) {
      return false;
    }
    return this.getFirstValue() > combo.getFirstValue();
  }

  public getFirstValue(): number {
    const card = this.cards[0];
    if (!card) return 0;
    const val = cardRank(card);
    if (cardSuit(card) === TYPE_PHOENIX && val === 1) {
      if (Array.isArray(this.phoenixValue)) {
        return Math.max(...this.phoenixValue);
      }
      return Number(this.phoenixValue);
    }
    if (cardSuit(card) === TYPE_DRAGON && val === 1) {
      return 15;
    }
    return val;
  }

  public hasMahjong(): boolean {
    const card = this.cards[0];
    if (!card) return false;
    return cardSuit(card) === TYPE_MAHJONG && cardRank(card) === 1;
  }

  public hasDragon(): boolean {
    const card = this.cards[0];
    if (!card) return false;
    return cardSuit(card) === TYPE_DRAGON && cardRank(card) === 1;
  }

  public getPoints(): number {
    let score = 0;
    for (const card of this.cards) {
      const rank = cardRank(card);
      const suit = cardSuit(card);
      if (rank === 5) score += 5;
      else if (rank === 10 || rank === 13) score += 10;
      else if (rank === 1 && suit === TYPE_PHOENIX) score -= 25;
      else if (rank === 1 && suit === TYPE_DRAGON) score += 25;
    }
    return score;
  }

  public setPhoenixValue(val: number): void {
    const pvArr = Array.isArray(this.phoenixValue) ? this.phoenixValue : null;
    if (this.type === STRAIGHT_COMBO) {
      const count = this.cards.length;
      let lowest: number | string;
      let highest: string;
      if (pvArr && val === pvArr[1]) {
        highest = cardToStr(this.cards[count - 1]!);
        lowest = val;
      } else {
        const first = this.cards.shift();
        if (first) this.cards.push(first);
        highest = cardToStr(val);
        lowest = cardRank(this.cards[0]!);
      }
      this.description = `Run of ${count} cards from ${lowest} to ${highest}`;
    } else {
      if (pvArr && val === pvArr[1]) {
        const moved = this.cards.splice(1, 2);
        this.cards.splice(3, 0, ...moved);
      }
      const trip = cardToStr(val, true);
      const pair = cardToStr(this.cards[4]!, true);
      this.description = `${trip} full of ${pair}`;
    }
    this.phoenixValue = val;
  }

  public static checkDog(cards: TichuCard[]): CheckResult | null {
    if (cards.length !== 1) return null;
    const card = cards[0]!;
    if (cardSuit(card) !== TYPE_DOG || cardRank(card) !== 1) return null;
    return {
      cards: [...cards],
      phoenixValue: null,
      description: "Dog",
    };
  }

  public static checkBomb(cards: TichuCard[]): CheckResult | null {
    if (cards.length < 4 || cardRank(cards[0]!) === 1) return null;
    let description: string;
    if (cards.length === 4) {
      if (cardRank(cards[0]!) !== cardRank(cards[3]!)) return null;
      description = `Bomb of four ${cardToStr(cards[0]!, true)}`;
    } else {
      const firstVal = cardRank(cards[0]!);
      const color = cardSuit(cards[0]!);
      for (let idx = 0; idx < cards.length; idx++) {
        const card = cards[idx]!;
        if (cardSuit(card) !== color) return null;
        if (cardRank(card) !== firstVal + idx) return null;
      }
      description = `Straight flush bomb starting from ${cardToStr(cards[0]!)} to ${cardToStr(cards[cards.length - 1]!)}`;
    }
    return {
      cards: [...cards],
      phoenixValue: null,
      description,
    };
  }

  public static checkSingle(
    cards: TichuCard[],
    lastCombo: Combo | null = null,
  ): CheckResult | null {
    if (cards.length !== 1) return null;
    let phoenixValue: number | null = null;
    const card = cards[0]!;
    if (cardRank(card) === 1 && cardSuit(card) === TYPE_DOG) return null;
    let description: string;
    if (cardRank(card) === 1 && cardSuit(card) === TYPE_PHOENIX) {
      const effectiveLast = lastCombo ?? Combo.lastComboForTesting ?? Combo.noCombo;
      const val =
        effectiveLast.type === SINGLE_COMBO && !effectiveLast.hasDragon()
          ? effectiveLast.getFirstValue()
          : 1;
      phoenixValue = val + 0.5;
      description = `Phoenix a half step above ${cardToStr(val)}`;
    } else {
      description = cardToStr(card);
    }
    return {
      cards: [...cards],
      phoenixValue,
      description,
    };
  }

  public static checkPair(cards: TichuCard[]): CheckResult | null {
    if (cards.length !== 2) return null;
    let phoenixValue: number | null = null;
    if (cardRank(cards[0]!) === 1) {
      if (cardSuit(cards[0]!) !== TYPE_PHOENIX) return null;
      phoenixValue = cardRank(cards[1]!);
      if (phoenixValue === 1) return null;
    } else {
      if (cardRank(cards[0]!) !== cardRank(cards[1]!)) return null;
    }
    return {
      cards: [...cards],
      phoenixValue,
      description: `Pair of ${cardToStr(cards[1]!, true)}`,
    };
  }

  public static checkTrip(cards: TichuCard[]): CheckResult | null {
    if (cards.length !== 3) return null;
    let phoenixValue: number | null = null;
    if (cardRank(cards[0]!) === 1) {
      if (cardSuit(cards[0]!) !== TYPE_PHOENIX) return null;
      phoenixValue = cardRank(cards[1]!);
      if (phoenixValue === 1 || cardRank(cards[2]!) !== phoenixValue) return null;
    } else {
      if (
        cardRank(cards[0]!) !== cardRank(cards[1]!) ||
        cardRank(cards[0]!) !== cardRank(cards[2]!)
      ) {
        return null;
      }
    }
    return {
      cards: [...cards],
      phoenixValue,
      description: `Triple of ${cardToStr(cards[1]!, true)}`,
    };
  }

  public static checkRunningPair(cards: TichuCard[]): CheckResult | null {
    const count = cards.length;
    if (count % 2 !== 0 || count < 4) return null;
    const work = [...cards];
    let phoenixValue: number | null = null;
    let phoenixIndex: number | null = null;
    let phoenix: TichuCard | null = null;
    if (cardRank(work[0]!) === 1) {
      if (cardSuit(work[0]!) !== TYPE_PHOENIX) return null;
      phoenix = work.shift() ?? null;
    }
    let value = cardRank(work[0]!);
    if (value === 1) return null;

    for (let i = 1; i < work.length; i++) {
      const card = work[i]!;
      const idx = i + (phoenixValue === null ? 0 : 1);
      if (idx % 2 === 0) {
        value++;
        if (cardRank(card) !== value) return null;
      } else {
        if (cardRank(card) !== value) {
          if (phoenix === null || phoenixValue !== null) return null;
          phoenixValue = value;
          phoenixIndex = i;
          value++;
          if (cardRank(card) !== value) return null;
        }
      }
    }
    if (phoenix !== null) {
      if (phoenixValue === null) {
        phoenixValue = value;
        work.push(phoenix);
      } else {
        work.splice(phoenixIndex!, 0, phoenix);
      }
    }
    const description = `${count / 2} consecutive doubles from ${cardToStr(work[0]!, false)} to ${cardToStr(work[count - 2]!, false)}`;
    return {
      cards: work,
      phoenixValue,
      description,
    };
  }

  public static checkStraight(cards: TichuCard[]): CheckResult | null {
    const count = cards.length;
    if (count < 5) return null;
    const work = [...cards];
    let phoenixValue: number | number[] | null = null;
    let phoenixIndex: number | null = null;
    let phoenix: TichuCard | null = null;
    if (cardRank(work[0]!) === 1) {
      const suit = cardSuit(work[0]!);
      if (suit === TYPE_PHOENIX) {
        if (cardRank(work[1]!) === 1 && cardSuit(work[1]!) !== TYPE_MAHJONG) {
          return null;
        }
        phoenix = work.shift() ?? null;
      } else if (suit === TYPE_MAHJONG) {
        // valid straight starting at 1 (Mahjong)
      } else {
        return null;
      }
    }
    let value = cardRank(work[0]!);
    for (let i = 0; i < work.length; i++) {
      const card = work[i]!;
      if (cardRank(card) !== value) {
        if (phoenix === null || phoenixValue !== null) return null;
        phoenixValue = value;
        phoenixIndex = i;
        value++;
        if (cardRank(card) !== value) return null;
      }
      value++;
    }
    let lowest = cardRank(work[0]!);
    if (phoenix !== null) {
      if (phoenixValue === null) {
        const values: number[] = [];
        if (value < 15) {
          values.push(value);
          phoenixIndex = count - 1;
        }
        if (value > count + 1) {
          values.push(value - count);
          phoenixIndex = 0;
          lowest = value - count;
        }
        phoenixValue = values.length === 1 ? values[0]! : values;
      }
      work.splice(phoenixIndex!, 0, phoenix);
    }
    const highestCardOrVal =
      phoenixIndex === count - 1 && typeof phoenixValue === "number"
        ? phoenixValue
        : work[count - 1]!;
    const highest = cardToStr(highestCardOrVal);
    const description = `Run of ${count} cards from ${lowest} to ${highest}`;
    return {
      cards: work,
      phoenixValue,
      description,
    };
  }

  public static checkFullHouse(cards: TichuCard[]): CheckResult | null {
    if (cards.length !== 5) return null;
    let work = [...cards];
    let phoenixValue: number | number[] | null = null;
    const distinct = Array.from(new Set(work.map((c) => cardRank(c))));
    if (cardRank(work[0]!) === 1) {
      if (cardSuit(work[0]!) !== TYPE_PHOENIX || cardRank(work[1]!) === 1) return null;
      if (distinct.length !== 3) return null;
      const first = cardRank(work[1]!);
      const last = cardRank(work[4]!);
      if (cardRank(work[2]!) === last) {
        phoenixValue = first;
        work = work.reverse();
      } else if (cardRank(work[3]!) === first) {
        phoenixValue = last;
        const p = work.shift();
        if (p) work.push(p);
      } else {
        phoenixValue = [first, last];
      }
    } else {
      if (distinct.length !== 2) return null;
      const first = cardRank(work[0]!);
      const last = cardRank(work[4]!);
      if (cardRank(work[1]!) !== first) return null;
      if (cardRank(work[3]!) !== last) return null;
      if (cardRank(work[2]!) === last) {
        work = work.reverse();
      }
    }
    return {
      cards: work,
      phoenixValue,
      description: `${cardToStr(work[1]!, true)} full of ${cardToStr(work[3]!, true)}`,
    };
  }
}

/**
 * Direct TypeScript port of `modules/Hand.php`.
 */
export class Hand {
  public cards: TichuCard[];
  public phoenix: TichuCard | null = null;

  constructor(cards: TichuCard[]) {
    this.cards = sortCards(cards);
    if (this.cards.length === 0) return;
    if (cardRank(this.cards[0]!) === 1 && cardSuit(this.cards[0]!) === TYPE_PHOENIX) {
      this.phoenix = this.cards[0]!;
    } else if (
      this.cards.length > 1 &&
      cardRank(this.cards[1]!) === 1 &&
      cardSuit(this.cards[1]!) === TYPE_PHOENIX
    ) {
      this.phoenix = this.cards[1]!;
    }
  }

  public canFulFillWish(wish: number, combo: Combo | null | undefined): boolean {
    if (wish < 2 || wish > 14) return false;
    const hasWish = this.cards.some((c) => cardRank(c) === wish);
    if (!hasWish) return false;

    if (!combo || combo.type === NO_COMBO || combo.type === DOG_COMBO) {
      return true;
    }

    const length = combo.cards.length;
    const wishBomb = this.getWishHighestBomb(wish);
    if (wishBomb !== null && wishBomb.canBeat(combo)) {
      return true;
    }

    const highestCombo = this.getWishHighestByType(combo.type, wish, length, combo);
    if (highestCombo === null) return false;
    return highestCombo.canBeat(combo);
  }

  private getWishHighestByType(
    comboType: number,
    wish: number,
    length: number,
    lastCombo: Combo | null = null,
  ): Combo | null {
    switch (comboType) {
      case SINGLE_COMBO:
        return this.getWishHighestSingle(wish, lastCombo);
      case PAIR_COMBO:
        return this.getWishHighestPair(wish);
      case TRIP_COMBO:
        return this.getWishHighestTrip(wish);
      case RUNNING_PAIRS_COMBO:
        return this.getWishHighestRunningPair(wish, length);
      case STRAIGHT_COMBO:
        return this.getWishHighestStraight(wish, length);
      case FULL_HOUSE_COMBO:
        return this.getWishHighestFullHouse(wish);
      case BOMB_COMBO:
        return this.getWishHighestBomb(wish);
      default:
        return null;
    }
  }

  public canBeat(combo: Combo | null | undefined): boolean {
    return this.findBeatingCombo(combo) !== null;
  }

  public findBeatingCombo(combo: Combo | null | undefined): Combo | null {
    if (this.cards.length === 0) return null;
    if (!combo || combo.type === NO_COMBO || combo.type === DOG_COMBO || combo.cards.length === 0) {
      return new Combo([this.cards[0]!], null, null, null, combo ?? null);
    }

    const length = combo.cards.length;
    let beatingCombo: Combo | null = null;
    switch (combo.type) {
      case SINGLE_COMBO:
        beatingCombo = this.getHighestSingle(combo);
        break;
      case PAIR_COMBO:
        beatingCombo = this.getHighestPair();
        break;
      case TRIP_COMBO:
        beatingCombo = this.getHighestTrip();
        break;
      case RUNNING_PAIRS_COMBO:
        beatingCombo = this.getHighestRunningPair(length);
        break;
      case STRAIGHT_COMBO:
        beatingCombo = this.getHighestStraight(length);
        break;
      case FULL_HOUSE_COMBO:
        beatingCombo = this.getHighestFullHouse();
        break;
      case BOMB_COMBO:
        beatingCombo = this.getHighestBomb();
        break;
    }

    if (beatingCombo !== null && beatingCombo.canBeat(combo)) {
      return beatingCombo;
    }

    const beatingBomb = this.getHighestBomb();
    if (beatingBomb !== null && beatingBomb.canBeat(combo)) {
      return beatingBomb;
    }

    return null;
  }

  public hasBomb(): boolean {
    return this.getHighestBomb() !== null;
  }

  public getHighestBomb(): Combo | null {
    let highest: Combo | null = null;
    for (let color = 1; color <= 4; color++) {
      const values = this.cards
        .filter((c) => cardSuit(c) === color && cardRank(c) !== 1)
        .map((c) => cardRank(c));

      for (let idx = 0; idx < values.length - 4; idx++) {
        for (let idy = idx + 4; idy < values.length; idy++) {
          const length = idy - idx + 1;
          if (values[idy] === values[idx]! + length - 1) {
            const cards: TichuCard[] = [];
            for (let v = values[idx]!; v <= values[idx]! + length - 1; v++) {
              cards.push(makeSyntheticCard(v, color));
            }
            const combo = new Combo(cards);
            if (highest === null || combo.canBeat(highest)) {
              highest = combo;
            }
          }
        }
      }
    }
    if (highest !== null) {
      return highest;
    }

    const values = this.cards.map((c) => cardRank(c));
    const fours: number[] = [];
    for (let idx = 3; idx < values.length; idx++) {
      const val = values[idx]!;
      if (val > 1 && values[idx - 3] === val) {
        fours.push(val);
      }
    }
    if (fours.length > 0) {
      const val = Math.max(...fours);
      return new Combo([
        makeSyntheticCard(val, 1),
        makeSyntheticCard(val, 2),
        makeSyntheticCard(val, 3),
        makeSyntheticCard(val, 4),
      ]);
    }
    return null;
  }

  public getTopSingleRank(): number {
    for (let n = 14; n >= 2; n--) {
      const filtered = this.cards.filter((c) => cardRank(c) === n);
      if (filtered.length === 1) {
        return cardRank(filtered[0]!);
      }
    }
    return 0;
  }

  public getTopRank(): number {
    for (let n = 14; n >= 2; n--) {
      const filtered = this.cards.filter((c) => cardRank(c) === n);
      if (filtered.length > 0) {
        return cardRank(filtered[0]!);
      }
    }
    return 0;
  }

  public getWishHighestSingle(wish: number, lastCombo: Combo | null = null): Combo | null {
    const card = this.cards.find((c) => cardRank(c) === wish);
    return card ? new Combo([card], null, null, null, lastCombo) : null;
  }

  public getHighestSingle(lastCombo: Combo | null = null): Combo | null {
    let highest: Combo | null = null;
    for (const card of this.cards) {
      const combo = new Combo([card], null, null, null, lastCombo);
      if (combo.type !== SINGLE_COMBO) continue;
      if (highest === null || combo.canBeat(highest)) {
        highest = combo;
      }
    }
    return highest;
  }

  public getWishHighestPair(wish: number): Combo | null {
    const filtered = this.cards.filter((c) => cardRank(c) === wish);
    if (this.phoenix && filtered.length > 0) {
      return new Combo([this.phoenix, filtered[0]!]);
    }
    if (filtered.length > 1) {
      return new Combo([filtered[0]!, filtered[1]!]);
    }
    return null;
  }

  public getHighestPair(): Combo | null {
    let highest: Combo | null = null;
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]!;
      if (this.phoenix) {
        const combo = new Combo([this.phoenix, card]);
        if (combo.type === PAIR_COMBO && (highest === null || combo.canBeat(highest))) {
          highest = combo;
        }
      }
      if (this.cards.length > i + 1) {
        const combo = new Combo([card, this.cards[i + 1]!]);
        if (combo.type === PAIR_COMBO && (highest === null || combo.canBeat(highest))) {
          highest = combo;
        }
      }
    }
    return highest;
  }

  public getWishHighestTrip(wish: number): Combo | null {
    const filtered = this.cards.filter((c) => cardRank(c) === wish);
    if (this.phoenix && filtered.length > 1) {
      return new Combo([this.phoenix, filtered[0]!, filtered[1]!]);
    }
    if (filtered.length > 2) {
      return new Combo(filtered.slice(0, 3));
    }
    return null;
  }

  public getHighestTrip(): Combo | null {
    let highest: Combo | null = null;
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]!;
      if (this.phoenix && this.cards.length > i + 1) {
        const combo = new Combo([this.phoenix, card, this.cards[i + 1]!]);
        if (combo.type === TRIP_COMBO && (highest === null || combo.canBeat(highest))) {
          highest = combo;
        }
      }
      if (this.cards.length > i + 2) {
        const combo = new Combo([card, this.cards[i + 1]!, this.cards[i + 2]!]);
        if (combo.type === TRIP_COMBO && (highest === null || combo.canBeat(highest))) {
          highest = combo;
        }
      }
    }
    return highest;
  }

  public getWishHighestRunningPair(wish: number, length: number): Combo | null {
    const values = this.cards.map((c) => cardRank(c));
    const distinct = Array.from(new Set(values));
    const doubles = getDoubles(values);
    const straights: number[] = [];
    const off = Math.floor(length / 2) - 1;
    const count = distinct.length;

    for (let idx = 0; idx < count; idx++) {
      const value = distinct[idx]!;
      if (value === 1) continue;
      if (wish !== 0 && value > wish) break;
      if (idx + off >= count) break;
      if (wish !== 0 && value + off < wish) continue;
      if (distinct[idx + off] === value + off) {
        straights.push(value);
      }
    }

    straights.reverse();
    for (const value of straights) {
      let phoenixVal: number | null = null;
      let fail = false;
      for (let i = 0; i <= off; i++) {
        const val = value + i;
        if (doubles.includes(val)) continue;
        if (this.phoenix !== null && phoenixVal === null) {
          phoenixVal = val;
        } else {
          fail = true;
          break;
        }
      }
      if (!fail) {
        const runVals: number[] = [];
        for (let v = value; v <= value + off; v++) {
          runVals.push(v, v);
        }
        runVals.sort((a, b) => a - b);
        const cards = runVals.map((v) => makeSyntheticCard(v, 1 + (v % 4)));
        return new Combo(cards);
      }
    }
    return null;
  }

  public getHighestRunningPair(length: number): Combo | null {
    return this.getWishHighestRunningPair(0, length);
  }

  public getWishHighestStraight(wish: number, length: number): Combo | null {
    if (this.cards.length < 5) return null;
    const values = this.cards.map((c) => cardRank(c));
    const distinct = Array.from(new Set(values));
    let straight: number | null = null;
    const off = length - 1;
    const count = distinct.length;

    if (this.phoenix === null) {
      for (let idx = 0; idx < count; idx++) {
        const value = distinct[idx]!;
        if (value === 1) continue;
        if (wish !== 0 && value > wish) break;
        if (idx + off >= count) break;
        if (wish !== 0 && value + off < wish) continue;
        if (distinct[idx + off] === value + off) {
          straight = value;
        }
      }
    } else {
      for (let idx = 0; idx < count; idx++) {
        const value = distinct[idx]!;
        if (value === 1) continue;
        if (wish !== 0 && value > wish) break;
        if (idx + off - 1 >= count) break;
        if (wish !== 0 && value + off < wish) continue;
        if (distinct[idx + off - 1]! <= value + off) {
          straight = value;
        }
      }
      if (straight !== null && straight + off === 15) {
        straight--;
      }
    }

    if (straight === null) return null;
    const cards: TichuCard[] = [];
    for (let v = straight; v <= straight + off; v++) {
      cards.push(makeSyntheticCard(v, 1 + (v % 4)));
    }
    return new Combo(cards);
  }

  public getHighestStraight(length: number): Combo | null {
    return this.getWishHighestStraight(0, length);
  }

  public getWishHighestFullHouse(wish: number): Combo | null {
    if (this.cards.length < 5) return null;
    const values = this.cards.map((c) => cardRank(c)).filter((v) => v > 1);
    const distinct = Array.from(new Set(values));
    if (distinct.length < 2) return null;
    const doubles = getDoubles(values);
    if (doubles.length < 2) return null;
    const distinctDoubles = Array.from(new Set(doubles));
    const triples = getDoubles(doubles);
    const tCount = triples.length;
    let fullHouse: [number, number] | null = null;

    if (this.phoenix) {
      if (tCount > 0) {
        const tVal = triples[tCount - 1]!;
        let dVal = wish === 0 ? tVal : wish;
        if (dVal === tVal) {
          dVal = distinct.reduce<number>((c, v) => (v === tVal ? c : v), distinct[0]!);
        }
        fullHouse = [tVal, dVal];
      }
      const dCount = distinctDoubles.length;
      if (dCount > 1 && (wish === 0 || distinctDoubles.includes(wish))) {
        const greatPair = distinctDoubles[dCount - 1]!;
        const smallPair = greatPair === wish || wish === 0 ? distinctDoubles[dCount - 2]! : wish;
        fullHouse = [greatPair, smallPair];
      }
    } else {
      if (
        (wish !== 0 && !distinctDoubles.includes(wish)) ||
        tCount === 0 ||
        distinctDoubles.length < 2
      ) {
        return null;
      }
      const tVal = triples[tCount - 1]!;
      let dVal = wish === 0 ? tVal : wish;
      if (dVal === tVal) {
        dVal = distinctDoubles.reduce<number>((c, v) => (v === tVal ? c : v), distinctDoubles[0]!);
      }
      fullHouse = [tVal, dVal];
    }

    if (fullHouse === null) return null;
    const cards: TichuCard[] = [
      makeSyntheticCard(fullHouse[0], 1),
      makeSyntheticCard(fullHouse[0], 1),
      makeSyntheticCard(fullHouse[0], 1),
      makeSyntheticCard(fullHouse[1], 2),
      makeSyntheticCard(fullHouse[1], 2),
    ];
    return new Combo(cards);
  }

  public getHighestFullHouse(): Combo | null {
    return this.getWishHighestFullHouse(0);
  }

  public getWishHighestBomb(wish: number): Combo | null {
    const filtered = this.cards.filter((c) => cardRank(c) === wish);
    let val: number | null = null;
    let length = 0;

    for (const card of filtered) {
      const color = cardSuit(card);
      const values = this.cards
        .filter((c) => cardSuit(c) === color && cardRank(c) !== 1)
        .map((c) => cardRank(c));
      const last = values.length - 1;
      if (last < 4) continue;

      for (let idx = 0; idx < values.length - 4; idx++) {
        const value = values[idx]!;
        if (value > wish) break;
        if (values[idx + 4] !== value + 4) continue;
        let i = idx + 5;
        while (i <= last && values[i] === value + i - idx) {
          i++;
        }
        const len = i - idx;
        if (
          wish < value + len &&
          (len > length || (len === length && (val === null || value > val)))
        ) {
          length = len;
          val = value;
        }
        idx = i - 1;
      }
    }

    if (length > 4 && val !== null) {
      const cards: TichuCard[] = [];
      for (let v = val; v <= val + length - 1; v++) {
        cards.push(makeSyntheticCard(v, 1));
      }
      return new Combo(cards);
    }
    if (filtered.length === 4) {
      return new Combo(filtered);
    }
    return null;
  }

  public findPlayableCombo(lastCombo: Combo | null = null, wish = 0): Combo | null {
    if (this.cards.length === 0) return null;

    const byRank: Record<number, TichuCard[]> = {};
    const bySuit: Record<number, Record<number, TichuCard>> = {
      1: {},
      2: {},
      3: {},
      4: {},
    };
    let mahjong: TichuCard | null = null;
    let dog: TichuCard | null = null;
    let dragon: TichuCard | null = null;
    const phoenix = this.phoenix;

    for (const card of this.cards) {
      const rank = cardRank(card);
      const suit = cardSuit(card);
      if (rank === 1) {
        if (suit === TYPE_MAHJONG) mahjong = card;
        else if (suit === TYPE_DOG) dog = card;
        else if (suit === TYPE_DRAGON) dragon = card;
      } else {
        if (!byRank[rank]) byRank[rank] = [];
        byRank[rank]!.push(card);
        bySuit[suit]![rank] = card;
      }
    }

    const isLeading =
      lastCombo === null ||
      lastCombo.type === NO_COMBO ||
      lastCombo.type === DOG_COMBO ||
      lastCombo.cards.length === 0;

    const tryCombo = (cards: TichuCard[]): Combo | null => {
      if (cards.length === 0) return null;
      if (wish > 0) {
        if (!cards.some((c) => cardRank(c) === wish)) return null;
      }
      const combo = new Combo(cards, null, null, null, lastCombo);
      if (combo.type === INVALID_COMBO || combo.type === NO_COMBO) return null;
      if (Array.isArray(combo.phoenixValue)) {
        const candidates = Array.from(new Set(combo.phoenixValue)).sort((a, b) => a - b);
        for (const cand of candidates) {
          const resolved = new Combo(cards, null, null, null, lastCombo);
          resolved.setPhoenixValue(cand);
          if (isLeading || resolved.canBeat(lastCombo)) {
            return resolved;
          }
        }
        return null;
      }
      if (!isLeading && !combo.canBeat(lastCombo)) return null;
      return combo;
    };

    const pickRank = (rank: number, count: number): TichuCard[] | null => {
      const bucket = byRank[rank];
      if (!bucket || bucket.length < count) return null;
      return bucket.slice(0, count);
    };

    const findSingle = (): Combo | null => {
      for (let r = 2; r <= 14; r++) {
        if (byRank[r] && byRank[r]!.length > 0) {
          const res = tryCombo([byRank[r]![0]!]);
          if (res !== null) return res;
        }
      }
      const specials = isLeading ? [mahjong, dog, phoenix, dragon] : [mahjong, phoenix, dragon];
      for (const special of specials) {
        if (special !== null) {
          const res = tryCombo([special]);
          if (res !== null) return res;
        }
      }
      return null;
    };

    const findPair = (): Combo | null => {
      for (let r = 2; r <= 14; r++) {
        const natural = pickRank(r, 2);
        if (natural !== null) {
          const res = tryCombo(natural);
          if (res !== null) return res;
        }
        if (phoenix !== null) {
          const single = pickRank(r, 1);
          if (single !== null) {
            const res = tryCombo([single[0]!, phoenix]);
            if (res !== null) return res;
          }
        }
      }
      return null;
    };

    const findTrip = (): Combo | null => {
      for (let r = 2; r <= 14; r++) {
        const natural = pickRank(r, 3);
        if (natural !== null) {
          const res = tryCombo(natural);
          if (res !== null) return res;
        }
        if (phoenix !== null) {
          const pair = pickRank(r, 2);
          if (pair !== null) {
            const res = tryCombo([...pair, phoenix]);
            if (res !== null) return res;
          }
        }
      }
      return null;
    };

    const findFullHouse = (): Combo | null => {
      for (let t = 2; t <= 14; t++) {
        const trip = pickRank(t, 3);
        const pairFromT = pickRank(t, 2);
        if (pairFromT === null) continue;
        for (let p = 2; p <= 14; p++) {
          if (p === t) continue;
          if (trip !== null) {
            const pair = pickRank(p, 2);
            if (pair !== null) {
              const res = tryCombo([...trip, ...pair]);
              if (res !== null) return res;
            }
          }
          if (phoenix !== null) {
            const pair = pickRank(p, 2);
            if (pair !== null) {
              const res = tryCombo([...pairFromT, ...pair, phoenix]);
              if (res !== null) return res;
            }
            if (trip !== null) {
              const single = pickRank(p, 1);
              if (single !== null) {
                const res = tryCombo([...trip, ...single, phoenix]);
                if (res !== null) return res;
              }
            }
          }
        }
      }
      return null;
    };

    const findRunningPairs = (pairCount: number): Combo | null => {
      for (let start = 2; start <= 15 - pairCount; start++) {
        const cards: TichuCard[] = [];
        let usedPhoenix = false;
        let valid = true;
        for (let r = start; r < start + pairCount; r++) {
          const avail = byRank[r]?.length ?? 0;
          if (avail >= 2) {
            cards.push(byRank[r]![0]!, byRank[r]![1]!);
          } else if (avail === 1 && !usedPhoenix && phoenix !== null) {
            cards.push(byRank[r]![0]!, phoenix);
            usedPhoenix = true;
          } else {
            valid = false;
            break;
          }
        }
        if (valid) {
          const res = tryCombo(cards);
          if (res !== null) return res;
        }
      }
      return null;
    };

    const findStraight = (len: number): Combo | null => {
      for (let start = 1; start <= 15 - len; start++) {
        const cards: TichuCard[] = [];
        let usedPhoenix = false;
        let valid = true;
        for (let r = start; r < start + len; r++) {
          if (r === 1) {
            if (mahjong !== null) cards.push(mahjong);
            else {
              valid = false;
              break;
            }
          } else if (byRank[r] && byRank[r]!.length > 0) {
            cards.push(byRank[r]![0]!);
          } else if (!usedPhoenix && phoenix !== null) {
            cards.push(phoenix);
            usedPhoenix = true;
          } else {
            valid = false;
            break;
          }
        }
        if (valid) {
          const res = tryCombo(cards);
          if (res !== null) return res;
        }
      }
      return null;
    };

    const findBomb = (): Combo | null => {
      for (let r = 2; r <= 14; r++) {
        const four = pickRank(r, 4);
        if (four !== null) {
          const res = tryCombo(four);
          if (res !== null) return res;
        }
      }
      for (let len = 5; len <= 14; len++) {
        for (let suit = 1; suit <= 4; suit++) {
          for (let start = 2; start <= 15 - len; start++) {
            const cards: TichuCard[] = [];
            let valid = true;
            for (let r = start; r < start + len; r++) {
              const c = bySuit[suit]?.[r];
              if (!c) {
                valid = false;
                break;
              }
              cards.push(c);
            }
            if (valid) {
              const res = tryCombo(cards);
              if (res !== null) return res;
            }
          }
        }
      }
      return null;
    };

    if (isLeading) {
      if (wish > 0) {
        const single = findSingle();
        if (single !== null) return single;
        const pair = findPair();
        if (pair !== null) return pair;
        const trip = findTrip();
        if (trip !== null) return trip;
        const fh = findFullHouse();
        if (fh !== null) return fh;
        for (let pairs = 2; pairs <= 7; pairs++) {
          const rp = findRunningPairs(pairs);
          if (rp !== null) return rp;
        }
        for (let len = 5; len <= 14; len++) {
          const st = findStraight(len);
          if (st !== null) return st;
        }
        return findBomb();
      }
      return findSingle();
    }

    const len = lastCombo!.cards.length;
    let found: Combo | null = null;
    switch (lastCombo!.type) {
      case SINGLE_COMBO:
        found = findSingle();
        break;
      case PAIR_COMBO:
        found = findPair();
        break;
      case TRIP_COMBO:
        found = findTrip();
        break;
      case FULL_HOUSE_COMBO:
        found = findFullHouse();
        break;
      case RUNNING_PAIRS_COMBO:
        found = findRunningPairs(Math.floor(len / 2));
        break;
      case STRAIGHT_COMBO:
        found = findStraight(len);
        break;
    }
    if (found !== null) return found;

    return findBomb();
  }
}

export interface ComboValidationResult {
  isValid: boolean;
  combo: Combo;
  type: number;
  description: string;
  cleanDescription: string;
  buttonLabel: string;
  reason: string | null;
  tooltip: string;
  requiresPhoenixChoice: boolean;
}

export interface PassValidationResult {
  canPass: boolean;
  buttonLabel: string;
  reason: string | null;
  tooltip: string;
  requiredComboType: number | null;
}

export function analyzeSelection(params: {
  selectedCards: TichuCard[];
  handCards: TichuCard[];
  lastCombo: Combo;
  stateName: string;
  mahjongWish: number;
}): ComboValidationResult {
  const { selectedCards, handCards, lastCombo, stateName, mahjongWish } = params;
  const isPlayBombState = stateName === "playBomb";

  if (selectedCards.length === 0) {
    return {
      isValid: false,
      combo: Combo.noCombo,
      type: NO_COMBO,
      description: "",
      cleanDescription: "",
      buttonLabel: isPlayBombState ? "Play Bomb (Select bomb)" : "Play (Select cards)",
      reason: "empty",
      tooltip: isPlayBombState
        ? "Select a bomb from your hand to play"
        : "Select cards from your hand to play",
      requiresPhoenixChoice: false,
    };
  }

  const combo = new Combo(selectedCards, null, null, null, lastCombo);
  combo.recheckPhoenix(lastCombo);
  const cleanDescription = decodeHtmlEntities(combo.description || "");
  const requiresPhoenixChoice = Array.isArray(combo.phoenixValue);

  if (combo.type === INVALID_COMBO) {
    return {
      isValid: false,
      combo,
      type: INVALID_COMBO,
      description: "",
      cleanDescription: "",
      buttonLabel: "Invalid combo",
      reason: "invalid_combo",
      tooltip: "Selected cards do not form a valid Tichu combination",
      requiresPhoenixChoice: false,
    };
  }

  if (isPlayBombState && combo.type !== BOMB_COMBO) {
    return {
      isValid: false,
      combo,
      type: combo.type,
      description: combo.description,
      cleanDescription,
      buttonLabel: "Must play a bomb",
      reason: "not_a_bomb",
      tooltip: "Select a 4-of-a-kind or straight flush bomb",
      requiresPhoenixChoice: false,
    };
  }

  const isLeading =
    lastCombo.type === NO_COMBO || lastCombo.type === DOG_COMBO || lastCombo.cards.length === 0;

  if (combo.type === DOG_COMBO && !isLeading) {
    return {
      isValid: false,
      combo,
      type: combo.type,
      description: combo.description,
      cleanDescription,
      buttonLabel: "Dog can only be led",
      reason: "dog_not_lead",
      tooltip: "The Dog can only be played when leading a trick",
      requiresPhoenixChoice: false,
    };
  }

  if (!combo.canBeat(lastCombo)) {
    const targetDesc =
      decodeHtmlEntities(lastCombo.description) || comboTypeToLabel(lastCombo.type);
    return {
      isValid: false,
      combo,
      type: combo.type,
      description: combo.description,
      cleanDescription,
      buttonLabel: `Must beat ${targetDesc}`,
      reason: "cannot_beat",
      tooltip: `Your ${cleanDescription || "combo"} does not beat ${targetDesc}`,
      requiresPhoenixChoice: false,
    };
  }

  if (mahjongWish >= 2 && mahjongWish <= 14) {
    const selectedContainsWish = selectedCards.some((c) => cardRank(c) === mahjongWish);
    if (!selectedContainsWish) {
      const hand = new Hand(handCards);
      if (hand.canFulFillWish(mahjongWish, lastCombo)) {
        const rankLabel = rankToDisplayName(mahjongWish);
        return {
          isValid: false,
          combo,
          type: combo.type,
          description: combo.description,
          cleanDescription,
          buttonLabel: `Must play wished ${rankLabel}`,
          reason: "must_fulfill_wish",
          tooltip: `You must fulfill the active Mahjong wish (${rankLabel})`,
          requiresPhoenixChoice: false,
        };
      }
    }
  }

  return {
    isValid: true,
    combo,
    type: combo.type,
    description: combo.description,
    cleanDescription,
    buttonLabel: `Play ${cleanDescription}`,
    reason: null,
    tooltip: requiresPhoenixChoice
      ? `Play ${cleanDescription} (choose Phoenix value next)`
      : `Play ${cleanDescription}`,
    requiresPhoenixChoice,
  };
}

export function validatePassAction(
  handCards: TichuCard[],
  lastCombo: Combo,
  mahjongWish: number,
): PassValidationResult {
  if (mahjongWish >= 2 && mahjongWish <= 14) {
    const hand = new Hand(handCards);
    if (hand.canFulFillWish(mahjongWish, lastCombo)) {
      const rankLabel = rankToDisplayName(mahjongWish);
      const playableCombo = hand.findPlayableCombo(lastCombo, mahjongWish);
      const isLeading =
        lastCombo.type === NO_COMBO || lastCombo.type === DOG_COMBO || lastCombo.cards.length === 0;
      const singleCanFulfill =
        isLeading ||
        (lastCombo.type === SINGLE_COMBO &&
          (hand.getWishHighestSingle(mahjongWish, lastCombo)?.canBeat(lastCombo) ?? false));

      const requiredType = playableCombo?.type ?? null;
      const comboName = requiredType !== null ? comboTypeToLabel(requiredType) : "combo";
      const tooltip = singleCanFulfill
        ? `Cannot pass: you must fulfill the Mahjong wish by playing ${rankLabel}`
        : `Cannot pass: you must fulfill the Mahjong wish (${rankLabel}) by playing a ${comboName}`;

      return {
        canPass: false,
        buttonLabel: `Must fulfill wish (${rankLabel})`,
        reason: "must_fulfill_wish",
        tooltip,
        requiredComboType: requiredType,
      };
    }
  }

  return {
    canPass: true,
    buttonLabel: "Pass",
    reason: null,
    tooltip: "",
    requiredComboType: null,
  };
}

export function canFinishHandInOnePlay(
  handCards: TichuCard[],
  selectedCards: TichuCard[],
  lastCombo: Combo,
  mahjongWish: number,
  stateName = "playCombo",
): Combo | null {
  if (
    handCards.length <= 1 ||
    selectedCards.length === 0 ||
    selectedCards.length >= handCards.length
  ) {
    return null;
  }
  const fullAnalysis = analyzeSelection({
    selectedCards: handCards,
    handCards,
    lastCombo,
    stateName,
    mahjongWish,
  });
  if (!fullAnalysis.isValid || fullAnalysis.type === DOG_COMBO) {
    return null;
  }
  return fullAnalysis.combo;
}
