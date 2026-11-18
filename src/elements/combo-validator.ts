import type { CardData as TichuCard, I18nLogPayload } from "../types/tichu-contracts";

if (typeof (globalThis as any)._ !== "function") {
  (globalThis as any)._ = (s: string) => s;
}

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
 * Mirrors `CardManager::cardToStr`.
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
      return plural ? `${val}s` : String(val);
  }
}

export function decodeHtmlEntities(text: unknown): string {
  if (typeof text !== "string") return "";
  return text.replace(/(\d)(?:&#39;|')s\b/g, "$1s").replace(/&#39;/g, "'");
}

export function substituteTemplate(tpl: string, args: Record<string, string | number>): string {
  const dojoSubstitute = (globalThis as any).dojo?.string?.substitute;
  if (typeof dojoSubstitute === "function") {
    try {
      return String(dojoSubstitute(tpl, args));
    } catch (_e) {
      // fall through to regex substitution
    }
  }
  return String(tpl).replace(/\$\{([^}]+)\}/g, (_match, key: string) => {
    const val = args[key];
    return val !== undefined && val !== null ? String(val) : "";
  });
}

export function translateDynamic(raw: string): string {
  if (typeof raw !== "string" || raw === "") return "";
  const fn = (globalThis as Record<string, unknown>)["_"];
  return typeof fn === "function" ? (fn as (s: string) => string)(raw) : raw;
}

export function rankToLocalizedName(cardOrRank: TichuCard | number, plural = false): string {
  const isCardObj = typeof cardOrRank === "object" && cardOrRank !== null;
  const val = isCardObj ? cardRank(cardOrRank) : Number(cardOrRank);
  switch (val) {
    case 1:
      if (!isCardObj) {
        return "1";
      }
      switch (cardSuit(cardOrRank)) {
        case TYPE_DRAGON:
          return _("Dragon");
        case TYPE_PHOENIX:
          return _("Phoenix");
        case TYPE_DOG:
          return _("Dog");
        case TYPE_MAHJONG:
          return _("Mahjong");
        default:
          return "1";
      }
    case 2:
      return plural ? _("2s") : "2";
    case 3:
      return plural ? _("3s") : "3";
    case 4:
      return plural ? _("4s") : "4";
    case 5:
      return plural ? _("5s") : "5";
    case 6:
      return plural ? _("6s") : "6";
    case 7:
      return plural ? _("7s") : "7";
    case 8:
      return plural ? _("8s") : "8";
    case 9:
      return plural ? _("9s") : "9";
    case 10:
      return plural ? _("10s") : "10";
    case 11:
      return plural ? _("Jacks") : _("Jack");
    case 12:
      return plural ? _("Queens") : _("Queen");
    case 13:
      return plural ? _("Kings") : _("King");
    case 14:
      return plural ? _("Aces") : _("Ace");
    default:
      return plural ? `${val}s` : String(val);
  }
}

export function rankToDisplayName(rank: number, plural = false): string {
  return decodeHtmlEntities(cardToStr(rank, plural));
}

function isPhoenixCard(card: TichuCard | undefined): boolean {
  return Boolean(card && cardRank(card) === 1 && cardSuit(card) === TYPE_PHOENIX);
}

/**
 * Coerce a wire/DB scalar `phoenixValue` (number or numeric string like `"11"` or `"10.5"`)
 * into a finite number, returning `null` for empty/null/array values.
 */
export function normalizePhoenixScalar(val: unknown): number | null {
  if (
    val === null ||
    val === undefined ||
    val === "" ||
    typeof val === "boolean" ||
    Array.isArray(val)
  ) {
    return null;
  }
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize a `phoenixValue` payload (`number`, numeric `string`, array, or `null`)
 * into numeric form (`number | number[] | null`).
 */
export function normalizePhoenixValue(val: unknown): number | number[] | null {
  if (Array.isArray(val)) {
    const nums = val
      .map((item) => normalizePhoenixScalar(item))
      .filter((item): item is number => item !== null);
    return nums.length > 0 ? nums : null;
  }
  return normalizePhoenixScalar(val);
}

function parseRankWord(word: string): number | null {
  const trimmed = decodeHtmlEntities(word).trim();
  switch (trimmed) {
    case "Jack":
    case "Jacks":
      return 11;
    case "Queen":
    case "Queens":
      return 12;
    case "King":
    case "Kings":
      return 13;
    case "Ace":
    case "Aces":
      return 14;
    default: {
      const m = /^(\d+)s?$/.exec(trimmed);
      if (!m || !m[1]) return null;
      const n = Number(m[1]);
      return n >= 1 && n <= 10 ? n : null;
    }
  }
}

export function comboTypeToLabel(type: number): string {
  switch (type) {
    case SINGLE_COMBO:
      return _("single");
    case PAIR_COMBO:
      return _("pair");
    case TRIP_COMBO:
      return _("triple");
    case RUNNING_PAIRS_COMBO:
      return _("running pairs");
    case STRAIGHT_COMBO:
      return _("straight");
    case FULL_HOUSE_COMBO:
      return _("full house");
    case BOMB_COMBO:
      return _("bomb");
    case DOG_COMBO:
      return _("Dog");
    default:
      return _("combo");
  }
}

export interface LastComboLike {
  cards?: TichuCard[];
  type?: number;
  phoenixValue?: number | string | Array<number | string> | null;
  description?: string | I18nLogPayload;
  player?: string | number;
  playerId?: string;
}

export function formatI18nLogPayload(
  payload: I18nLogPayload,
  opts?: { translate?: boolean },
): string {
  const rawLog = typeof payload?.log === "string" ? payload.log : "";
  if (!rawLog) return "";
  const shouldTranslate = opts?.translate !== false;
  const rawArgs =
    payload?.args && typeof payload.args === "object" && !Array.isArray(payload.args)
      ? payload.args
      : {};
  const i18nKeys = Array.isArray(rawArgs.i18n) ? rawArgs.i18n.map(String) : [];
  const i18nSet = new Set(i18nKeys);
  const subArgs: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(rawArgs)) {
    if (k === "i18n") continue;
    if (v && typeof v === "object" && "log" in (v as Record<string, unknown>)) {
      subArgs[k] = formatI18nLogPayload(v as I18nLogPayload, { translate: shouldTranslate });
    } else if (typeof v === "string") {
      subArgs[k] = shouldTranslate && i18nSet.has(k) ? translateDynamic(v) : v;
    } else if (typeof v === "number") {
      subArgs[k] = v;
    } else if (v !== null && v !== undefined) {
      subArgs[k] = String(v);
    }
  }
  const logStr = shouldTranslate ? translateDynamic(rawLog) : rawLog;
  if (!shouldTranslate) {
    return String(logStr).replace(/\$\{([^}]+)\}/g, (_match, key: string) => {
      const val = subArgs[key];
      return val !== undefined && val !== null ? String(val) : "";
    });
  }
  return substituteTemplate(logStr, subArgs);
}

export function normalizeComboDescriptionInput(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && typeof (raw as I18nLogPayload).log === "string") {
    return formatI18nLogPayload(raw as I18nLogPayload, { translate: false });
  }
  return "";
}

export function formatLocalizedComboDescription(
  combo: (LastComboLike & { passed?: boolean }) | Combo | null | undefined,
): string {
  if (!combo) return "";
  if (!(combo instanceof Combo) && combo.passed) {
    return "";
  }
  const rawDesc = normalizeComboDescriptionInput(combo.description);
  const cards = Array.isArray(combo.cards) ? combo.cards : [];
  if (cards.length === 0) {
    if (
      combo.description &&
      typeof combo.description === "object" &&
      typeof (combo.description as I18nLogPayload).log === "string"
    ) {
      return formatI18nLogPayload(combo.description as I18nLogPayload, { translate: true });
    }
    return rawDesc ? translateDynamic(decodeHtmlEntities(rawDesc)) : "";
  }

  const resolved =
    combo instanceof Combo
      ? combo
      : Combo.fromLastComboState({
          ...combo,
          description: rawDesc,
        });

  if (
    resolved.type === INVALID_COMBO ||
    resolved.type === NO_COMBO ||
    resolved.type === PASS_COMBO ||
    resolved.cards.length === 0
  ) {
    return rawDesc ? translateDynamic(decodeHtmlEntities(rawDesc)) : "";
  }

  switch (resolved.type) {
    case DOG_COMBO:
      return _("Dog");

    case SINGLE_COMBO: {
      const card = resolved.cards[0]!;
      if (isPhoenixCard(card)) {
        const baseVal =
          typeof resolved.phoenixValue === "number" && Number.isFinite(resolved.phoenixValue)
            ? Math.round(resolved.phoenixValue - 0.5)
            : 1;
        return substituteTemplate(_("Phoenix a half step above ${rank}"), {
          rank: rankToLocalizedName(baseVal, false),
        });
      }
      return rankToLocalizedName(card, false);
    }

    case PAIR_COMBO:
      return substituteTemplate(_("Pair of ${rank}"), {
        rank: rankToLocalizedName(resolved.cards[1]!, true),
      });

    case TRIP_COMBO:
      return substituteTemplate(_("Triple of ${rank}"), {
        rank: rankToLocalizedName(resolved.cards[1]!, true),
      });

    case RUNNING_PAIRS_COMBO: {
      const count = resolved.cards.length;
      return substituteTemplate(
        _("${pair_count} consecutive doubles from ${lowest} to ${highest}"),
        {
          pair_count: count / 2,
          lowest: rankToLocalizedName(resolved.cards[0]!, false),
          highest: rankToLocalizedName(resolved.cards[count - 2]!, false),
        },
      );
    }

    case STRAIGHT_COMBO: {
      const count = resolved.cards.length;
      let lowRank: number;
      let highRank: number;
      if (isPhoenixCard(resolved.cards[0])) {
        highRank = cardRank(resolved.cards[count - 1]!);
        lowRank =
          typeof resolved.phoenixValue === "number"
            ? resolved.phoenixValue
            : Array.isArray(resolved.phoenixValue) && resolved.phoenixValue[1] !== undefined
              ? resolved.phoenixValue[1]!
              : highRank - count + 1;
      } else {
        lowRank = cardRank(resolved.cards[0]!);
        highRank =
          isPhoenixCard(resolved.cards[count - 1]) && typeof resolved.phoenixValue === "number"
            ? resolved.phoenixValue
            : cardRank(resolved.cards[count - 1]!);
      }
      return substituteTemplate(_("Run of ${count} cards from ${lowest} to ${highest}"), {
        count,
        lowest: rankToLocalizedName(lowRank, false),
        highest: rankToLocalizedName(highRank, false),
      });
    }

    case FULL_HOUSE_COMBO:
      return substituteTemplate(_("${trip_rank} full of ${pair_rank}"), {
        trip_rank: rankToLocalizedName(resolved.cards[1]!, true),
        pair_rank: rankToLocalizedName(resolved.cards[3]!, true),
      });

    case BOMB_COMBO:
      if (resolved.cards.length === 4) {
        return substituteTemplate(_("Bomb of four ${rank}"), {
          rank: rankToLocalizedName(resolved.cards[0]!, true),
        });
      }
      return substituteTemplate(_("Straight flush bomb starting from ${lowest} to ${highest}"), {
        lowest: rankToLocalizedName(resolved.cards[0]!, false),
        highest: rankToLocalizedName(resolved.cards[resolved.cards.length - 1]!, false),
      });

    default:
      return rawDesc ? translateDynamic(decodeHtmlEntities(rawDesc)) : "";
  }
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
    const scalarPhoenix = normalizePhoenixScalar(state.phoenixValue);
    const rawDescription = normalizeComboDescriptionInput(state.description);
    if (explicitType === SINGLE_COMBO && combo.type === SINGLE_COMBO && scalarPhoenix !== null) {
      combo.phoenixValue = scalarPhoenix;
      const valBelow = scalarPhoenix - 0.5;
      combo.description = `Phoenix a half step above ${cardToStr(valBelow)}`;
    } else if (Array.isArray(combo.phoenixValue)) {
      if (scalarPhoenix !== null && combo.phoenixValue.includes(scalarPhoenix)) {
        combo.setPhoenixValue(scalarPhoenix);
      } else {
        Combo.resolveMissingPhoenixMetadata(combo, cards, rawDescription);
      }
    } else if (combo.type === SINGLE_COMBO && isPhoenixCard(combo.cards[0])) {
      if (scalarPhoenix !== null) {
        combo.phoenixValue = scalarPhoenix;
        const valBelow = scalarPhoenix - 0.5;
        combo.description = `Phoenix a half step above ${cardToStr(valBelow)}`;
      } else {
        Combo.resolveMissingPhoenixMetadata(combo, cards, rawDescription);
      }
    }
    if (rawDescription && !combo.description) {
      combo.description = rawDescription;
    }
    combo.player = String(state.player ?? state.playerId ?? "");
    return combo;
  }

  public static inferPlayedCombo(
    cards: TichuCard[],
    prevLastCombo?: LastComboLike | Combo | null,
    description?: string | I18nLogPayload,
  ): Combo {
    if (!Array.isArray(cards) || cards.length === 0) {
      return Combo.noCombo;
    }
    const rawDescription = normalizeComboDescriptionInput(description);
    const prev =
      prevLastCombo instanceof Combo ? prevLastCombo : Combo.fromLastComboState(prevLastCombo);
    const combo = new Combo(cards, null, null, null, prev);
    if (Array.isArray(combo.phoenixValue)) {
      Combo.resolveMissingPhoenixMetadata(combo, cards, rawDescription);
    } else if (
      combo.type === SINGLE_COMBO &&
      combo.cards.length === 1 &&
      isPhoenixCard(combo.cards[0]) &&
      prev.type === NO_COMBO &&
      rawDescription
    ) {
      Combo.resolveMissingPhoenixMetadata(combo, cards, rawDescription);
    }
    if (rawDescription && !combo.description) {
      combo.description = rawDescription;
    }
    return combo;
  }

  private static resolveMissingPhoenixMetadata(
    combo: Combo,
    rawCards: TichuCard[],
    description?: string,
  ): void {
    if (Array.isArray(combo.phoenixValue) && combo.phoenixValue.length === 2) {
      const opt0 = combo.phoenixValue[0]!;
      const opt1 = combo.phoenixValue[1]!;
      if (combo.type === STRAIGHT_COMBO) {
        if (rawCards.length >= 5 && isPhoenixCard(rawCards[rawCards.length - 1])) {
          combo.setPhoenixValue(opt0);
        } else if (rawCards.length >= 5 && isPhoenixCard(rawCards[0])) {
          combo.setPhoenixValue(opt1);
        } else if (description) {
          const m = /^Run of \d+ cards from (\d+)\b/.exec(decodeHtmlEntities(description));
          if (m && m[1]) {
            combo.setPhoenixValue(Number(m[1]) === opt1 ? opt1 : opt0);
          }
        }
      } else if (combo.type === FULL_HOUSE_COMBO) {
        const c1 = rawCards[1];
        const c2 = rawCards[2];
        if (
          rawCards.length === 5 &&
          isPhoenixCard(rawCards[0]) &&
          c1 &&
          c2 &&
          cardRank(c1) === cardRank(c2)
        ) {
          const chosen = cardRank(c1);
          if (chosen === opt0 || chosen === opt1) {
            combo.setPhoenixValue(chosen);
          }
        } else if (description) {
          const m = /^(.+?)\s+full of\b/.exec(decodeHtmlEntities(description));
          if (m && m[1]) {
            const parsed = parseRankWord(m[1]);
            if (parsed === opt0 || parsed === opt1) {
              combo.setPhoenixValue(parsed);
            }
          }
        }
      }
      return;
    }

    if (
      combo.type === SINGLE_COMBO &&
      combo.cards.length === 1 &&
      isPhoenixCard(combo.cards[0]) &&
      description
    ) {
      const m = /^Phoenix a half step above\s+(.+)$/.exec(decodeHtmlEntities(description));
      if (m && m[1]) {
        const baseRank = parseRankWord(m[1]);
        if (baseRank !== null) {
          combo.phoenixValue = baseRank + 0.5;
          combo.description = `Phoenix a half step above ${cardToStr(baseRank)}`;
        }
      }
    }
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
    const numVal = Number(val);
    const pvArr = Array.isArray(this.phoenixValue) ? this.phoenixValue : null;
    if (this.type === STRAIGHT_COMBO) {
      const count = this.cards.length;
      let lowest: number | string;
      let highest: string;
      if (pvArr && numVal === pvArr[1]) {
        highest = cardToStr(this.cards[count - 1]!);
        lowest = numVal;
      } else {
        const first = this.cards.shift();
        if (first) this.cards.push(first);
        highest = cardToStr(numVal);
        lowest = cardRank(this.cards[0]!);
      }
      this.description = `Run of ${count} cards from ${lowest} to ${highest}`;
    } else {
      if (pvArr && numVal === pvArr[1]) {
        const moved = this.cards.splice(1, 2);
        this.cards.splice(3, 0, ...moved);
      }
      const trip = cardToStr(numVal, true);
      const pair = cardToStr(this.cards[4]!, true);
      this.description = `${trip} full of ${pair}`;
    }
    this.phoenixValue = numVal;
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

  public getWishHighestByType(
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
      for (let tripRank = 2; tripRank <= 14; tripRank++) {
        const trip = pickRank(tripRank, 3);
        const pairFromT = pickRank(tripRank, 2);
        if (pairFromT === null) continue;
        for (let p = 2; p <= 14; p++) {
          if (p === tripRank) continue;
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
  const defaultButtonLabel = isPlayBombState ? _("Play Bomb") : _("Play");

  if (selectedCards.length === 0) {
    return {
      isValid: false,
      combo: Combo.noCombo,
      type: NO_COMBO,
      description: "",
      cleanDescription: "",
      buttonLabel: defaultButtonLabel,
      reason: "empty",
      tooltip: isPlayBombState
        ? _("Select a bomb from your hand to play")
        : _("Select cards from your hand to play"),
      requiresPhoenixChoice: false,
    };
  }

  const combo = new Combo(selectedCards, null, null, null, lastCombo);
  combo.recheckPhoenix(lastCombo);
  const cleanDescription = decodeHtmlEntities(combo.description || "");
  const localizedDescription = formatLocalizedComboDescription(combo);
  const requiresPhoenixChoice = Array.isArray(combo.phoenixValue);

  if (combo.type === INVALID_COMBO) {
    return {
      isValid: false,
      combo,
      type: INVALID_COMBO,
      description: "",
      cleanDescription: "",
      buttonLabel: defaultButtonLabel,
      reason: "invalid_combo",
      tooltip: _("Selected cards do not form a valid Tichu combination"),
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
      buttonLabel: defaultButtonLabel,
      reason: "not_a_bomb",
      tooltip: _("Select a 4-of-a-kind or straight flush bomb"),
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
      buttonLabel: defaultButtonLabel,
      reason: "dog_not_lead",
      tooltip: _("The Dog can only be played when leading a trick"),
      requiresPhoenixChoice: false,
    };
  }

  if (!combo.canBeat(lastCombo)) {
    const targetDesc =
      formatLocalizedComboDescription(lastCombo) || comboTypeToLabel(lastCombo.type);
    return {
      isValid: false,
      combo,
      type: combo.type,
      description: combo.description,
      cleanDescription,
      buttonLabel: defaultButtonLabel,
      reason: "cannot_beat",
      tooltip: substituteTemplate(_("Your ${combo} does not beat ${target}"), {
        combo: localizedDescription || _("combo"),
        target: targetDesc,
      }),
      requiresPhoenixChoice: false,
    };
  }

  if (mahjongWish >= 2 && mahjongWish <= 14) {
    const selectedContainsWish = selectedCards.some((c) => cardRank(c) === mahjongWish);
    if (!selectedContainsWish) {
      const hand = new Hand(handCards);
      if (hand.canFulFillWish(mahjongWish, lastCombo)) {
        const rankLabel = rankToLocalizedName(mahjongWish, false);
        return {
          isValid: false,
          combo,
          type: combo.type,
          description: combo.description,
          cleanDescription,
          buttonLabel: defaultButtonLabel,
          reason: "must_fulfill_wish",
          tooltip: substituteTemplate(_("You must fulfill the active Mahjong wish (${rank})"), {
            rank: rankLabel,
          }),
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
    buttonLabel: defaultButtonLabel,
    reason: null,
    tooltip: requiresPhoenixChoice
      ? substituteTemplate(_("Play ${combo} (choose Phoenix value next)"), {
          combo: localizedDescription,
        })
      : substituteTemplate(_("Play ${combo}"), {
          combo: localizedDescription,
        }),
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
      const rankLabel = rankToLocalizedName(mahjongWish, false);
      const playableCombo = hand.findPlayableCombo(lastCombo, mahjongWish);
      const isLeading =
        lastCombo.type === NO_COMBO || lastCombo.type === DOG_COMBO || lastCombo.cards.length === 0;
      const singleCanFulfill =
        isLeading ||
        (lastCombo.type === SINGLE_COMBO &&
          (hand.getWishHighestSingle(mahjongWish, lastCombo)?.canBeat(lastCombo) ?? false));

      const requiredType = playableCombo?.type ?? null;
      const comboName = requiredType !== null ? comboTypeToLabel(requiredType) : _("combo");
      const tooltip = singleCanFulfill
        ? substituteTemplate(
            _("Cannot pass: you must fulfill the Mahjong wish by playing ${rank}"),
            { rank: rankLabel },
          )
        : substituteTemplate(
            _("Cannot pass: you must fulfill the Mahjong wish (${rank}) by playing a ${combo}"),
            { rank: rankLabel, combo: comboName },
          );

      return {
        canPass: false,
        buttonLabel: _("Pass"),
        reason: "must_fulfill_wish",
        tooltip,
        requiredComboType: requiredType,
      };
    }
  }

  return {
    canPass: true,
    buttonLabel: _("Pass"),
    reason: null,
    tooltip: "",
    requiredComboType: null,
  };
}

export type WishBombKind =
  "4-of-a-kind bomb" | "straight flush bomb" | "4-of-a-kind or straight flush bomb";

export interface WishBombCallout {
  wish: number;
  wishLabel: string;
  bombKind: WishBombKind;
  bombDescription: string;
  combo: Combo;
  message: string;
}

export function getWishBombOnlyCallout(
  handCards: TichuCard[],
  lastCombo: Combo,
  mahjongWish: number,
): WishBombCallout | null {
  if (mahjongWish < 2 || mahjongWish > 14) {
    return null;
  }
  const isLeading =
    !lastCombo ||
    lastCombo.type === NO_COMBO ||
    lastCombo.type === DOG_COMBO ||
    lastCombo.cards.length === 0;
  if (isLeading) {
    return null;
  }

  const hand = new Hand(handCards);
  if (!hand.canFulFillWish(mahjongWish, lastCombo)) {
    return null;
  }

  // If the player can fulfill the wish by playing the non-bomb combo type of the trick, no bomb callout is needed.
  if (lastCombo.type !== BOMB_COMBO) {
    const regularWishCombo = hand.getWishHighestByType(
      lastCombo.type,
      mahjongWish,
      lastCombo.cards.length,
      lastCombo,
    );
    if (regularWishCombo !== null && regularWishCombo.canBeat(lastCombo)) {
      return null;
    }
  }

  const wishCards = hand.cards.filter((c) => cardRank(c) === mahjongWish);
  let fourBomb: Combo | null = null;
  if (wishCards.length === 4) {
    const candidate = new Combo(wishCards);
    if (candidate.type === BOMB_COMBO && candidate.canBeat(lastCombo)) {
      fourBomb = candidate;
    }
  }

  let sfBomb: Combo | null = null;
  for (const card of wishCards) {
    const color = cardSuit(card);
    const suitCards = hand.cards.filter((c) => cardSuit(c) === color && cardRank(c) !== 1);
    if (suitCards.length < 5) continue;
    for (let idx = 0; idx <= suitCards.length - 5; idx++) {
      const startRank = cardRank(suitCards[idx]!);
      if (startRank > mahjongWish) break;
      if (cardRank(suitCards[idx + 4]!) !== startRank + 4) continue;
      let end = idx + 5;
      while (end < suitCards.length && cardRank(suitCards[end]!) === startRank + (end - idx)) {
        end++;
      }
      const len = end - idx;
      if (mahjongWish < startRank + len) {
        const candidate = new Combo(suitCards.slice(idx, end));
        if (
          candidate.type === BOMB_COMBO &&
          candidate.canBeat(lastCombo) &&
          (sfBomb === null || candidate.canBeat(sfBomb))
        ) {
          sfBomb = candidate;
        }
      }
      idx = end - 1;
    }
  }

  if (fourBomb === null && sfBomb === null) {
    return null;
  }

  const wishLabel = rankToLocalizedName(mahjongWish, false);
  let bombKind: WishBombKind;
  let bombKindLabel: string;
  let bombDescription: string;
  let combo: Combo;

  if (fourBomb !== null && sfBomb !== null) {
    bombKind = "4-of-a-kind or straight flush bomb";
    bombKindLabel = _("4-of-a-kind or straight flush bomb");
    bombDescription = `${formatLocalizedComboDescription(fourBomb)} / ${formatLocalizedComboDescription(sfBomb)}`;
    combo = sfBomb;
  } else if (fourBomb !== null) {
    bombKind = "4-of-a-kind bomb";
    bombKindLabel = _("4-of-a-kind bomb");
    bombDescription = formatLocalizedComboDescription(fourBomb);
    combo = fourBomb;
  } else {
    bombKind = "straight flush bomb";
    bombKindLabel = _("straight flush bomb");
    bombDescription = formatLocalizedComboDescription(sfBomb!);
    combo = sfBomb!;
  }

  const message = substituteTemplate(
    _("You must fulfill the Mahjong wish (${rank}) by playing a ${bomb_kind} (${bomb})."),
    {
      rank: wishLabel,
      bomb_kind: bombKindLabel,
      bomb: bombDescription,
    },
  );

  return {
    wish: mahjongWish,
    wishLabel,
    bombKind,
    bombDescription,
    combo,
    message,
  };
}
