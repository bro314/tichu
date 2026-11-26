import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { CardData as TichuCard } from "../src/types/tichu-contracts";
import {
  BOMB_COMBO,
  Combo,
  DOG_COMBO,
  FULL_HOUSE_COMBO,
  Hand,
  INVALID_COMBO,
  NO_COMBO,
  PAIR_COMBO,
  RUNNING_PAIRS_COMBO,
  SINGLE_COMBO,
  STRAIGHT_COMBO,
  TRIP_COMBO,
  TYPE_DOG,
  TYPE_DRAGON,
  TYPE_MAHJONG,
  TYPE_PHOENIX,
  analyzeSelection,
  decodeHtmlEntities,
  formatLocalizedComboDescription,
  getWishBombOnlyCallout,
  rankToLocalizedName,
  substituteTemplate,
  translateDynamic,
  validatePassAction,
} from "../src/elements/combo-validator";
import { groupPlayersByTeam, hasBomb } from "../src/elements/utils";
import {
  CARD_GROUPS_UI_STORAGE_KEY,
  CUSTOM_HAND_ORDER_MAX_ENTRIES,
  CUSTOM_HAND_ORDER_STORAGE_KEY,
  CUSTOM_HAND_ORDER_TTL_MS,
  GameModel,
  canOrganizeHandInState,
  getConcedeUiState,
} from "../src/elements/game-model";
import { Bet } from "../src/types/tichu-contracts";

let nextCardId = 1;
function card(type: number, typeArg: number): TichuCard {
  return {
    id: String(nextCardId++),
    type: String(type),
    type_arg: String(typeArg),
  };
}

function normCard(c: TichuCard): { type: number; type_arg: number } {
  return { type: Number(c.type), type_arg: Number(c.type_arg) };
}

function normCards(cards: TichuCard[]): Array<{ type: number; type_arg: number }> {
  return cards.map(normCard);
}

// Card constants matching tests/TestUtils.php
const DR = card(TYPE_DRAGON, 1);
const PH = card(TYPE_PHOENIX, 1);
const DOG = card(TYPE_DOG, 1);
const MJ = card(TYPE_MAHJONG, 1);

const A2 = card(1, 2);
const B2 = card(2, 2);
const C2 = card(3, 2);
const D2 = card(4, 2);

const A3 = card(1, 3);
const B3 = card(2, 3);
const C3 = card(3, 3);
const D3 = card(4, 3);

const A4 = card(1, 4);
const B4 = card(2, 4);
const C4 = card(3, 4);
const D4 = card(4, 4);

const A5 = card(1, 5);
const B5 = card(2, 5);
const C5 = card(3, 5);
const D5 = card(4, 5);

const A6 = card(1, 6);
const B6 = card(2, 6);
const C6 = card(3, 6);
const D6 = card(4, 6);

const A7 = card(1, 7);
const B7 = card(2, 7);
const C7 = card(3, 7);
const D7 = card(4, 7);

const A8 = card(1, 8);
const B8 = card(2, 8);
const C8 = card(3, 8);
const D8 = card(4, 8);

const A9 = card(1, 9);
const B9 = card(2, 9);
const C9 = card(3, 9);
const D9 = card(4, 9);

const A0 = card(1, 10);
const B0 = card(2, 10);
const C0 = card(3, 10);
const D0 = card(4, 10);

const AJ = card(1, 11);
const BJ = card(2, 11);
const CJ = card(3, 11);
const DJ = card(4, 11);

const AQ = card(1, 12);
const BQ = card(2, 12);
const CQ = card(3, 12);
const DQ = card(4, 12);

const AK = card(1, 13);
const BK = card(2, 13);
const CK = card(3, 13);
const DK = card(4, 13);

const AA = card(1, 14);
const BA = card(2, 14);
const CA = card(3, 14);
const DA = card(4, 14);

beforeEach(() => {
  Combo.lastComboForTesting = new Combo([], NO_COMBO);
});

afterEach(() => {
  Combo.lastComboForTesting = null;
});

// =========================================================================
// ComboTest.php parity
// =========================================================================

test("ComboTest::testCheckSingle", () => {
  assert.equal(Combo.checkSingle([A2])?.description, "2");
  assert.equal(Combo.checkSingle([B5])?.description, "5");
  assert.equal(Combo.checkSingle([CJ])?.description, "Jack");
  assert.equal(Combo.checkSingle([DA])?.description, "Ace");

  assert.equal(Combo.checkSingle([DR])?.description, "Dragon");
  assert.equal(
    Combo.checkSingle([card(TYPE_PHOENIX, 1)])?.description,
    "Phoenix a half step above 1",
  );
  Combo.lastComboForTesting = new Combo([DR]);
  assert.equal(Combo.checkSingle([PH])?.phoenixValue, 1.5);
  Combo.lastComboForTesting = new Combo([A0]);
  const phOnTen = new Combo([PH]);
  assert.equal(phOnTen.phoenixValue, 10.5);
  Combo.lastComboForTesting = phOnTen;
  assert.equal(Combo.checkSingle([PH])?.phoenixValue, 11.0);
  assert.equal(Combo.checkSingle([DOG]), null);
  assert.equal(Combo.checkSingle([MJ])?.description, "Mahjong");
});

test("ComboTest::testFullHouse", () => {
  assert.equal(
    Combo.checkFullHouse([card(1, 2), card(2, 2), card(3, 2), card(1, 3), card(2, 3)])?.description,
    "2s full of 3s",
  );
});

test("ComboTest::testRecheckPhoenixStraight", () => {
  // Against 2-3-4-5-6 (firstValue = 2): both 3-4-5-6-7 and 4-5-6-7-8 beat it
  Combo.lastComboForTesting = new Combo([A2, B3, C4, D5, A6]);
  const comboBoth = new Combo([B4, C5, D6, A7, PH]);
  comboBoth.recheckPhoenix();
  assert.deepEqual(comboBoth.phoenixValue, [8, 3]);

  // Against 3-4-5-6-7 (firstValue = 3): only 4-5-6-7-8 (phoenixValue = 8) beats it
  Combo.lastComboForTesting = new Combo([A3, B4, C5, D6, A7]);
  const comboHighOnly = new Combo([B4, C5, D6, A7, PH]);
  comboHighOnly.recheckPhoenix();
  assert.equal(comboHighOnly.phoenixValue, 8);
  assert.equal(comboHighOnly.getFirstValue(), 4);
  assert.equal(comboHighOnly.canBeat(Combo.lastComboForTesting), true);
});

test("ComboTest::testRecheckPhoenixFullHouse", () => {
  // Against 2-2-2-3-3: both 4-4-4-8-8 and 8-8-8-4-4 beat it
  Combo.lastComboForTesting = new Combo([A2, B2, C2, A3, B3]);
  const comboBoth = new Combo([A4, B4, C8, D8, PH]);
  comboBoth.recheckPhoenix();
  assert.deepEqual(comboBoth.phoenixValue, [4, 8]);

  // Against 5-5-5-3-3: only 8-8-8-4-4 (phoenixValue = 8) beats it
  Combo.lastComboForTesting = new Combo([A5, B5, C5, A3, B3]);
  const comboHighOnly = new Combo([A4, B4, C8, D8, PH]);
  comboHighOnly.recheckPhoenix();
  assert.equal(comboHighOnly.phoenixValue, 8);
  assert.equal(comboHighOnly.getFirstValue(), 8);
  assert.equal(comboHighOnly.canBeat(Combo.lastComboForTesting), true);
});

test("ComboTest::testRecheckPhoenixMismatchedTypeOrLength", () => {
  Combo.lastComboForTesting = new Combo([A2]);
  const comboVsSingle = new Combo([B4, C5, D6, A7, PH]);
  comboVsSingle.recheckPhoenix();
  assert.equal(Array.isArray(comboVsSingle.phoenixValue), false);
  assert.equal(comboVsSingle.canBeat(Combo.lastComboForTesting), false);

  Combo.lastComboForTesting = new Combo([A2, B3, C4, D5, A6, B7]);
  const comboVsSixCardStraight = new Combo([B4, C5, D6, A7, PH]);
  comboVsSixCardStraight.recheckPhoenix();
  assert.equal(Array.isArray(comboVsSixCardStraight.phoenixValue), false);
  assert.equal(comboVsSixCardStraight.canBeat(Combo.lastComboForTesting), false);

  Combo.lastComboForTesting = new Combo([A2, B2, C2, D2]);
  assert.equal(Combo.lastComboForTesting.type, BOMB_COMBO);
  const comboVsBomb4 = new Combo([B4, C5, D6, A7, PH]);
  comboVsBomb4.recheckPhoenix();
  assert.equal(Array.isArray(comboVsBomb4.phoenixValue), false);
  assert.equal(comboVsBomb4.canBeat(Combo.lastComboForTesting), false);

  Combo.lastComboForTesting = new Combo([A2, A3, A4, A5, A6]);
  assert.equal(Combo.lastComboForTesting.type, BOMB_COMBO);
  const comboVsStraightFlushBomb = new Combo([B4, C5, D6, A7, PH]);
  comboVsStraightFlushBomb.recheckPhoenix();
  assert.equal(Array.isArray(comboVsStraightFlushBomb.phoenixValue), false);
  assert.equal(comboVsStraightFlushBomb.canBeat(Combo.lastComboForTesting), false);
});

test("ComboTest::testRecheckPhoenixLeadAndDog", () => {
  Combo.lastComboForTesting = new Combo([], NO_COMBO);
  const comboLead = new Combo([B4, C5, D6, A7, PH]);
  comboLead.recheckPhoenix();
  assert.deepEqual(comboLead.phoenixValue, [8, 3]);

  Combo.lastComboForTesting = new Combo([DOG]);
  assert.equal(Combo.lastComboForTesting.type, DOG_COMBO);
  const comboAfterDog = new Combo([B4, C5, D6, A7, PH]);
  comboAfterDog.recheckPhoenix();
  assert.deepEqual(comboAfterDog.phoenixValue, [8, 3]);
});

// =========================================================================
// HandTest.php parity
// =========================================================================

test("HandTest::testGetTopSingleRank", () => {
  assert.equal(new Hand([A2]).getTopSingleRank(), 2);
  assert.equal(new Hand([AA]).getTopSingleRank(), 14);
  assert.equal(new Hand([AA, BA, AK]).getTopSingleRank(), 13);
  assert.equal(new Hand([AA, BA, CQ, AK, BK, CK, A2, DR, C5]).getTopSingleRank(), 12);

  assert.equal(new Hand([]).getTopSingleRank(), 0);
  assert.equal(new Hand([DR]).getTopSingleRank(), 0);
  assert.equal(new Hand([AA, BA]).getTopSingleRank(), 0);
  assert.equal(new Hand([A5, B5]).getTopSingleRank(), 0);
  assert.equal(new Hand([A2, B2, AA, BA]).getTopSingleRank(), 0);
});

test("HandTest::testGetTopRank", () => {
  assert.equal(new Hand([A2]).getTopRank(), 2);
  assert.equal(new Hand([AA]).getTopRank(), 14);
  assert.equal(new Hand([A2, A5, AA, A0]).getTopRank(), 14);
  assert.equal(new Hand([AA, BA, CQ, AK, BK, CK, A2, DR, C5]).getTopRank(), 14);

  assert.equal(new Hand([]).getTopRank(), 0);
  assert.equal(new Hand([DR]).getTopRank(), 0);
  assert.equal(new Hand([AA, BA]).getTopRank(), 14);
  assert.equal(new Hand([A5, B5]).getTopRank(), 5);
  assert.equal(new Hand([A2, B2, AA, BA]).getTopRank(), 14);
});

test("HandTest::testHasBomb (and utils::hasBomb delegation)", () => {
  for (const cards of [
    [A2, B2, C2, D2],
    [A0, B0, C0, D0],
    [AA, BA, CA, DA],
    [A2, A3, A4, A5, A6],
  ]) {
    assert.equal(new Hand(cards).hasBomb(), true);
    assert.equal(hasBomb(cards), true);
  }

  for (const cards of [
    [A2, B2, C2],
    [DR, PH, DOG, PH],
  ]) {
    assert.equal(new Hand(cards).hasBomb(), false);
    assert.equal(hasBomb(cards), false);
  }
});

test("HandTest::testGetHighestSingle", () => {
  const assertHighestSingle = (expected: TichuCard[] | null, cards: TichuCard[]) => {
    const res = new Hand(cards).getHighestSingle();
    if (expected === null) assert.equal(res, null);
    else assert.deepEqual(normCards(res!.cards), normCards(expected));
  };
  assertHighestSingle([AA], [A2, B2, AA, B9]);
  assertHighestSingle([A0], [A2, B5, A0, B9]);
  assertHighestSingle([DR], [A2, DR, AA, BA]);
  assertHighestSingle([A3], [PH, A2, A3]);
  assertHighestSingle([DR], [DR]);
  assertHighestSingle([PH], [PH]);
  assertHighestSingle([MJ], [MJ]);
  assertHighestSingle(null, []);
  assertHighestSingle(null, [DOG]);
});

test("HandTest::testGetHighestPair", () => {
  const assertHighestPair = (expected: TichuCard[] | null, cards: TichuCard[]) => {
    const res = new Hand(cards).getHighestPair();
    if (expected === null) assert.equal(res, null);
    else assert.deepEqual(normCards(res!.cards), normCards(expected));
  };
  assertHighestPair([A2, B2], [A2, B2, AA, B9]);
  assertHighestPair([A2, B2], [A2, B2, AA, B9, DR, DOG, MJ]);
  assertHighestPair([B7, D7], [A2, B2, C5, D7, DQ, AJ, B7, AK]);
  assertHighestPair([AA, BA], [A2, DR, AA, BA]);
  assertHighestPair([PH, A3], [PH, A2, A3]);
  assertHighestPair([PH, A0], [A2, B5, C7, A0, B9, DR, MJ, DOG, PH]);
  assertHighestPair(null, [A2, B5, C7, A0, B9, DR, MJ, DOG]);
  assertHighestPair(null, []);
  assertHighestPair(null, [DR]);
  assertHighestPair(null, [PH]);
  assertHighestPair(null, [MJ]);
  assertHighestPair(null, [DOG]);
});

test("HandTest::testGetHighestTrip", () => {
  const assertHighestTrip = (expected: TichuCard[] | null, cards: TichuCard[]) => {
    const res = new Hand(cards).getHighestTrip();
    if (expected === null) assert.equal(res, null);
    else assert.deepEqual(normCards(res!.cards), normCards(expected));
  };
  assertHighestTrip([A2, B2, C2], [A2, B2, C2, AA, B9]);
  assertHighestTrip([A2, B2, C2], [A2, B2, C2, AA, B9, DR, DOG, MJ]);
  assertHighestTrip([A7, B7, D7], [A2, B2, C2, C5, D7, DQ, A7, AJ, B7, AK]);
  assertHighestTrip([AA, BA, CA], [A2, DR, AA, BA, CA]);
  assertHighestTrip([PH, A3, B3], [PH, A2, A3, A4, B3]);
  assertHighestTrip([PH, A0, D0], [A2, B5, C7, A0, B9, DR, MJ, D0, DOG, PH]);
  assertHighestTrip(null, [A2, B5, D7, C7, A0, C5, B9, D2, DR, MJ, DOG]);
  assertHighestTrip(null, []);
  assertHighestTrip(null, [DR]);
  assertHighestTrip(null, [PH]);
  assertHighestTrip(null, [MJ]);
  assertHighestTrip(null, [DOG]);
});

test("HandTest::testGetHighestRunningPair", () => {
  const assertHighestRunningPair = (
    length: number,
    expected: TichuCard[] | null,
    cards: TichuCard[],
  ) => {
    const res = new Hand(cards).getHighestRunningPair(length);
    if (expected === null) assert.equal(res, null);
    else assert.deepEqual(normCards(res!.cards), normCards(expected));
  };
  assertHighestRunningPair(4, [C2, C2, D3, D3], [A2, B2, A3, B3]);
  assertHighestRunningPair(4, [A8, A8, B9, B9], [A2, B2, A3, B3, A8, B8, A9, B9]);
  assertHighestRunningPair(4, null, [A2, B5, D7, C7, A0, C5, B9, D2, DR, MJ, DOG]);
  assertHighestRunningPair(4, null, []);
  assertHighestRunningPair(4, null, [DR]);
  assertHighestRunningPair(4, null, [PH]);
  assertHighestRunningPair(4, null, [MJ]);
  assertHighestRunningPair(4, null, [DOG]);
});

test("HandTest::testGetHighestStraight", () => {
  const assertHighestStraight = (
    length: number,
    expected: TichuCard[] | null,
    cards: TichuCard[],
  ) => {
    const res = new Hand(cards).getHighestStraight(length);
    if (expected === null) assert.equal(res, null);
    else assert.deepEqual(normCards(res!.cards), normCards(expected));
  };
  assertHighestStraight(5, [C2, D3, A4, B5, C6], [A2, A3, B4, C5, D6]);
  assertHighestStraight(5, [C2, D3, A4, B5, C6], [A2, A3, PH, C5, D6]);
  assertHighestStraight(5, [D3, A4, B5, C6, D7], [PH, A3, B4, C5, D6]);
  assertHighestStraight(7, [A8, B9, C0, DJ, AQ, BK, CA], [AA, AK, CQ, CJ, C0, A9, A8]);
  assertHighestStraight(7, [A8, B9, C0, DJ, AQ, BK, CA], [AA, AK, CQ, CJ, C0, A9, PH]);
  assertHighestStraight(5, null, []);
  assertHighestStraight(5, null, [
    A2,
    B2,
    C2,
    D2,
    A3,
    B3,
    C3,
    D3,
    D4,
    C5,
    A7,
    C8,
    B9,
    A0,
    AQ,
    BQ,
    CQ,
    DQ,
    AK,
    AA,
    DR,
    MJ,
    DOG,
  ]);
});

test("HandTest::testGetHighestFullHouse", () => {
  const assertHighestFullHouse = (expected: TichuCard[] | null, cards: TichuCard[]) => {
    const res = new Hand(cards).getHighestFullHouse();
    if (expected === null) assert.equal(res, null);
    else assert.deepEqual(normCards(res!.cards), normCards(expected));
  };
  assertHighestFullHouse([A2, A2, A2, B3, B3], [A2, B2, C2, A3, B3]);
  assertHighestFullHouse([A3, A3, A3, B2, B2], [A2, B2, C2, A3, B3, C3]);
  assertHighestFullHouse([A3, A3, A3, B2, B2], [A2, B2, C2, A3, B3, C3, PH]);
  assertHighestFullHouse([A3, A3, A3, B2, B2], [A2, A3, B3, C3, PH]);
  assertHighestFullHouse([A3, A3, A3, B2, B2], [A2, B2, A3, B3, PH]);
  assertHighestFullHouse([AA, AA, AA, B7, B7], [A2, B2, A3, B3, A7, B7, AA, BA, DR, MJ, DOG, PH]);
  assertHighestFullHouse(null, [A2, B2, A3, B3, A7, B7, AA, BA, DR, MJ, DOG]);
  assertHighestFullHouse(null, [A2, B2, C2, PH]);
  assertHighestFullHouse(null, [A2, B2, C2, D2, PH]);
  assertHighestFullHouse(null, []);
});

test("HandTest::testGetHighestBomb", () => {
  const assertHighestBomb = (expected: TichuCard[] | null, cards: TichuCard[]) => {
    const res = new Hand(cards).getHighestBomb();
    if (expected === null) assert.equal(res, null);
    else assert.deepEqual(normCards(res!.cards), normCards(expected));
  };
  assertHighestBomb([A2, B2, C2, D2], [A2, B2, C2, D2]);
  assertHighestBomb([AA, BA, CA, DA], [AA, BA, CA, DA]);
  assertHighestBomb([AA, BA, CA, DA], [A2, B2, C2, D2, AA, BA, CA, DA]);
  assertHighestBomb([A2, A3, A4, A5, A6], [A2, A3, A4, A5, A6]);
  assertHighestBomb([A2, A3, A4, A5, A6], [A2, A3, A4, A5, A6, AA, BA, CA, DA]);
  assertHighestBomb([A2, A3, A4, A5, A6], [A2, A3, A4, A5, A6, B2, B3, B4, B5, B6]);
  assertHighestBomb([B3, B4, B5, B6, B7], [A2, A3, A4, A5, A6, B7, B3, B4, B5, B6]);
  assertHighestBomb([A2, A3, A4, A5, A6, A7], [A2, A3, A4, A5, A6, A7, B7, B3, B4, B5, B6]);
  assertHighestBomb([A2, A3, A4, A5, A6, A7, A8], [A2, A3, A4, A5, A6, A7, A8, AA]);
  assertHighestBomb([A7, B7, C7, D7], [A2, A7, D7, C7, B7, B2, C2, D2]);
  assertHighestBomb(null, []);
  assertHighestBomb(null, [DR, PH, DOG, MJ]);
  assertHighestBomb(null, [A2, B2, C2, A3, B3, C3, A4, B4, C4, A5, B5, DR, PH, DOG, MJ]);
});

test("HandTest::testCanBeat", () => {
  const assertCanBeat = (expected: boolean, handCards: TichuCard[], comboCards: TichuCard[]) => {
    const lastCombo = new Combo(comboCards);
    Combo.lastComboForTesting = lastCombo;
    assert.equal(new Hand(handCards).canBeat(lastCombo), expected);
  };
  assertCanBeat(true, [A3], [A2]);
  assertCanBeat(true, [DR], [A2]);
  assertCanBeat(true, [PH], [A2]);
  assertCanBeat(false, [], [A2]);
  assertCanBeat(false, [B2, C2, D2, MJ, DOG], [A2]);
  assertCanBeat(true, [A2, B5, C9, DQ], [B0]);
  assertCanBeat(false, [A2, B2, C2, A3, B3, C3], [A9]);
  assertCanBeat(false, [AA, BA, CA, AK, BK, CK], [DR]);
  assertCanBeat(true, [A2, B2, C2, D2, A3, B3, C3], [A9]);
  assertCanBeat(true, [A2, B2, C2, D2, A3, B3, C3], [DR]);

  assertCanBeat(false, [], [DOG]);
  assertCanBeat(true, [A2], [DOG]);
  assertCanBeat(true, [PH], [DOG]);
  assertCanBeat(true, [DR], [DOG]);
  assertCanBeat(true, [MJ], [DOG]);

  assertCanBeat(false, [], [MJ]);
  assertCanBeat(false, [DOG], [MJ]);
  assertCanBeat(true, [A2], [MJ]);
  assertCanBeat(true, [PH], [MJ]);
  assertCanBeat(true, [DR], [MJ]);

  assertCanBeat(false, [], [A2, B2]);
  assertCanBeat(false, [DR, PH, MJ, DOG, C2, D2, C3, D3], [A3, B3]);
  assertCanBeat(true, [DR, PH, MJ, DOG, C2, D2, C3, D3, A4], [A3, B3]);
  assertCanBeat(true, [A2, B2, C2, D2], [A3, B3]);

  assertCanBeat(true, [DR, PH, C0, D0, BJ, CJ, AQ, DQ, AK, CK, BA, CA, DA], [C9, B0, AJ, CQ, DK]);
});

test("HandTest::testCanFulFillWish", () => {
  // SINGLE
  assert.equal(new Hand([A3]).canFulFillWish(3, new Combo([], NO_COMBO)), true);
  assert.equal(new Hand([A3]).canFulFillWish(3, new Combo([B2])), true);
  assert.equal(new Hand([A3]).canFulFillWish(3, new Combo([B3])), false);
  assert.equal(new Hand([A3]).canFulFillWish(4, new Combo([], NO_COMBO)), false);
  assert.equal(new Hand([A3, B3, C3, D3]).canFulFillWish(3, new Combo([A5])), true);

  // PAIR
  assert.equal(new Hand([A3, B3]).canFulFillWish(3, new Combo([B2, C2])), true);
  assert.equal(new Hand([A3, PH]).canFulFillWish(3, new Combo([B2, C2])), true);
  assert.equal(new Hand([A3, B3]).canFulFillWish(4, new Combo([B2, C2])), false);
  assert.equal(new Hand([A3, B3]).canFulFillWish(3, new Combo([B4, C4])), false);
  assert.equal(new Hand([A3, B3, C3, D3]).canFulFillWish(3, new Combo([A5, B5])), true);

  // TRIP
  assert.equal(new Hand([A3, B3, C3]).canFulFillWish(3, new Combo([B2, C2, D2])), true);
  assert.equal(new Hand([A3, PH, C3]).canFulFillWish(3, new Combo([B2, C2, D2])), true);
  assert.equal(new Hand([A3, B3, C3]).canFulFillWish(4, new Combo([B2, C2, D2])), false);
  assert.equal(new Hand([A3, B3, C3]).canFulFillWish(3, new Combo([B4, C4, D4])), false);
  assert.equal(new Hand([A3, B3, C3, D3]).canFulFillWish(3, new Combo([A5, B5, C5])), true);

  // RUNNING PAIRS
  assert.equal(new Hand([A6, D6, C7, B7]).canFulFillWish(6, new Combo([B2, C2, D3, A3])), true);
  assert.equal(new Hand([A6, D6, C5, B5]).canFulFillWish(6, new Combo([B2, C2, D3, A3])), true);
  assert.equal(new Hand([A6, D6, B5]).canFulFillWish(6, new Combo([B2, C2, D3, A3])), false);
  assert.equal(new Hand([A6, D6, C5, B5]).canFulFillWish(7, new Combo([B2, C2, D3, A3])), false);

  // STRAIGHT
  assert.equal(
    new Hand([A7, D8, C9, B0, AJ]).canFulFillWish(7, new Combo([B2, C3, D4, A5, B6])),
    true,
  );
  assert.equal(
    new Hand([A7, D8, C9, B0, AJ]).canFulFillWish(10, new Combo([B2, C3, D4, A5, B6])),
    true,
  );
  assert.equal(new Hand([A2, A3, A4, A5, A6]).canFulFillWish(2, new Combo([], NO_COMBO)), true);
  assert.equal(
    new Hand([DR, A2, A3, A4, A5]).canFulFillWish(2, new Combo([B2, C3, D4, A5, B6])),
    false,
  );

  // FULL HOUSE
  assert.equal(
    new Hand([A6, B6, C6, A7, PH]).canFulFillWish(5, new Combo([B2, C2, D3, A3, B3])),
    false,
  );
  assert.equal(
    new Hand([A6, D6, C7, B7, A7]).canFulFillWish(6, new Combo([B2, C2, D3, A3, B3])),
    true,
  );
  assert.equal(
    new Hand([A6, D6, C6, B7, A7]).canFulFillWish(6, new Combo([B2, C2, D3, A3, B3])),
    true,
  );
  assert.equal(
    new Hand([A6, D6, C6, B7, PH]).canFulFillWish(6, new Combo([B2, C2, D3, A3, B3])),
    true,
  );
  assert.equal(
    new Hand([A6, D6, C6, B7, PH]).canFulFillWish(7, new Combo([B2, C2, D3, A3, B3])),
    true,
  );
  assert.equal(
    new Hand([PH, D6, C6, B7, A7]).canFulFillWish(6, new Combo([B2, C2, D3, A3, B3])),
    true,
  );
  assert.equal(
    new Hand([PH, D6, C6, B7, A7]).canFulFillWish(7, new Combo([B2, C2, D3, A3, B3])),
    true,
  );
  assert.equal(
    new Hand([A6, B6, C6, A9, B9, PH]).canFulFillWish(9, new Combo([B2, C2, D8, A8, B8])),
    true,
  );
  assert.equal(
    new Hand([A6, B6, C6, PH]).canFulFillWish(6, new Combo([B2, C2, D3, A3, B3])),
    false,
  );
  assert.equal(
    new Hand([A6, D6, C8, B7, A7]).canFulFillWish(6, new Combo([B2, C2, D3, A3, B3])),
    false,
  );
  assert.equal(
    new Hand([A6, D6, DR, MJ, DOG, PH]).canFulFillWish(6, new Combo([B2, C2, D3, A3, B3])),
    false,
  );
  assert.equal(
    new Hand([A6, D6, C7, B7, A7, A8]).canFulFillWish(8, new Combo([B2, C2, D3, A3, B3])),
    false,
  );
  assert.equal(new Hand([]).canFulFillWish(8, new Combo([B2, C2, D3, A3, B3])), false);
  assert.equal(new Hand([DR, MJ, DOG]).canFulFillWish(8, new Combo([B2, C2, D3, A3, B3])), false);

  // BOMB
  assert.equal(new Hand([A3, B3, C3, D3]).canFulFillWish(3, new Combo([A2, B2, C2, D2])), true);
  assert.equal(new Hand([A2, A3, A4, A5, A6]).canFulFillWish(2, new Combo([A3, B3, C3, D3])), true);
  assert.equal(
    new Hand([A3, B3, C3, A4, B4, C4, D4, A7, A8, A9, A0, AJ]).canFulFillWish(
      3,
      new Combo([A2, B2, C2, D2]),
    ),
    false,
  );
  assert.equal(
    new Hand([A2, A3, A5, A6, A7, A8, A9, AJ]).canFulFillWish(11, new Combo([AA])),
    false,
  );
  assert.equal(
    new Hand([A5, A6, A7, A8, A9, A0, B2, B3, B5, B6, B7, B8, B9]).canFulFillWish(
      7,
      new Combo([C2, C3, C4, C5, C6, C7]),
    ),
    true,
  );
  assert.equal(
    new Hand([A5, A6, A7, A8, A9, B2, B4, B5, B6, B7, B8]).canFulFillWish(
      6,
      new Combo([C4, C5, C6, C7, C8]),
    ),
    true,
  );

  // Null-safety checks
  assert.equal(new Hand([A3]).canFulFillWish(3, null), true);
  assert.equal(new Hand([A3]).canFulFillWish(4, null), false);
  assert.equal(new Hand([A3]).getWishHighestSingle(4), null);
  assert.equal(new Hand([PH, A3]).getWishHighestPair(4), null);
});

test("HandTest::testFindPlayableCombo", () => {
  Combo.lastComboForTesting = null;
  const lead = new Hand([DR, A5, B2, MJ]).findPlayableCombo(null, 0);
  assert.ok(lead !== null);
  assert.equal(lead.type, SINGLE_COMBO);
  assert.deepEqual(normCards(lead.cards), normCards([B2]));
  assert.equal(lead.cards[0]!.id, B2.id);

  const leadWish = new Hand([B2, C9, DK]).findPlayableCombo(null, 9);
  assert.ok(leadWish !== null);
  assert.equal(leadWish.type, SINGLE_COMBO);
  assert.deepEqual(normCards(leadWish.cards), normCards([C9]));

  const lastPair = new Combo([A4, B4]);
  Combo.lastComboForTesting = lastPair;
  const pairWish = new Hand([PH, A7, C8]).findPlayableCombo(lastPair, 7);
  assert.ok(pairWish !== null);
  assert.equal(pairWish.type, PAIR_COMBO);
  assert.equal(pairWish.canBeat(lastPair), true);

  const lastStraight = new Combo([A4, B5, C6, D7, A8]);
  Combo.lastComboForTesting = lastStraight;
  const straightWish = new Hand([PH, A5, B6, C7, D8]).findPlayableCombo(lastStraight, 6);
  assert.ok(straightWish !== null);
  assert.equal(straightWish.type, STRAIGHT_COMBO);
  assert.equal(Array.isArray(straightWish.phoenixValue), false);
  assert.equal(straightWish.phoenixValue, 9);
  assert.equal(straightWish.canBeat(lastStraight), true);

  const lastHighPair = new Combo([AA, BA]);
  Combo.lastComboForTesting = lastHighPair;
  const bombWish = new Hand([A5, B5, C5, D5]).findPlayableCombo(lastHighPair, 5);
  assert.ok(bombWish !== null);
  assert.equal(bombWish.type, BOMB_COMBO);
  assert.equal(bombWish.canBeat(lastHighPair), true);
});

// =========================================================================
// Smart Play UX Helpers (analyzeSelection, validatePassAction, getWishBombOnlyCallout)
// =========================================================================

test("SmartPlayUX::analyzeSelection states and validation", () => {
  const hand = [A3, A5, B5, C5, D5, AQ, BQ, DR];

  // Empty selection
  const emptyRes = analyzeSelection({
    selectedCards: [],
    handCards: hand,
    lastCombo: Combo.noCombo,
    stateName: "playCombo",
    mahjongWish: 0,
  });
  assert.equal(emptyRes.isValid, false);
  assert.equal(emptyRes.reason, "empty");
  assert.equal(emptyRes.buttonLabel, "Play");
  assert.equal(emptyRes.tooltip, "Select cards from your hand to play");

  const emptyBombRes = analyzeSelection({
    selectedCards: [],
    handCards: hand,
    lastCombo: Combo.noCombo,
    stateName: "playBomb",
    mahjongWish: 0,
  });
  assert.equal(emptyBombRes.isValid, false);
  assert.equal(emptyBombRes.reason, "empty");
  assert.equal(emptyBombRes.buttonLabel, "Play Bomb");
  assert.equal(emptyBombRes.tooltip, "Select a bomb from your hand to play");

  // Invalid combo
  const invalidRes = analyzeSelection({
    selectedCards: [A3, AQ],
    handCards: hand,
    lastCombo: Combo.noCombo,
    stateName: "playCombo",
    mahjongWish: 0,
  });
  assert.equal(invalidRes.isValid, false);
  assert.equal(invalidRes.reason, "invalid_combo");
  assert.equal(invalidRes.buttonLabel, "Play");
  assert.equal(invalidRes.tooltip, "Selected cards do not form a valid Tichu combination");

  // Dog when not leading
  const dogFollowRes = analyzeSelection({
    selectedCards: [DOG],
    handCards: [DOG, A3],
    lastCombo: new Combo([A2]),
    stateName: "playCombo",
    mahjongWish: 0,
  });
  assert.equal(dogFollowRes.isValid, false);
  assert.equal(dogFollowRes.reason, "dog_not_lead");
  assert.equal(dogFollowRes.buttonLabel, "Play");
  assert.equal(dogFollowRes.tooltip, "The Dog can only be played when leading a trick");

  // Non-bomb in playBomb state
  const nonBombInterrupt = analyzeSelection({
    selectedCards: [AQ, BQ],
    handCards: hand,
    lastCombo: new Combo([A2, B2]),
    stateName: "playBomb",
    mahjongWish: 0,
  });
  assert.equal(nonBombInterrupt.isValid, false);
  assert.equal(nonBombInterrupt.reason, "not_a_bomb");
  assert.equal(nonBombInterrupt.buttonLabel, "Play Bomb");
  assert.equal(nonBombInterrupt.tooltip, "Select a 4-of-a-kind or straight flush bomb");

  // Cannot beat lastCombo
  const loseRes = analyzeSelection({
    selectedCards: [AQ, BQ],
    handCards: hand,
    lastCombo: new Combo([AK, BK]),
    stateName: "playCombo",
    mahjongWish: 0,
  });
  assert.equal(loseRes.isValid, false);
  assert.equal(loseRes.reason, "cannot_beat");
  assert.equal(loseRes.buttonLabel, "Play");
  assert.equal(loseRes.tooltip, "Your Pair of Queens does not beat Pair of Kings");

  // Valid combo (entities decoded for label)
  const validPairRes = analyzeSelection({
    selectedCards: [AQ, BQ],
    handCards: hand,
    lastCombo: new Combo([A0, B0]),
    stateName: "playCombo",
    mahjongWish: 0,
  });
  assert.equal(validPairRes.isValid, true);
  assert.equal(validPairRes.buttonLabel, "Play");
  assert.equal(validPairRes.tooltip, "Play Pair of Queens");

  const validBombRes = analyzeSelection({
    selectedCards: [A5, B5, C5, D5],
    handCards: hand,
    lastCombo: new Combo([AA, BA]),
    stateName: "playBomb",
    mahjongWish: 0,
  });
  assert.equal(validBombRes.isValid, true);
  assert.equal(validBombRes.buttonLabel, "Play Bomb");
  assert.equal(validBombRes.tooltip, "Play Bomb of four 5s");

  // Mahjong wish violation when wish CAN be fulfilled
  const wishViolation = analyzeSelection({
    selectedCards: [DR],
    handCards: hand,
    lastCombo: new Combo([B3]),
    stateName: "playCombo",
    mahjongWish: 5,
  });
  assert.equal(wishViolation.isValid, false);
  assert.equal(wishViolation.reason, "must_fulfill_wish");
  assert.equal(wishViolation.buttonLabel, "Play");
  assert.equal(wishViolation.tooltip, "You must fulfill the active Mahjong wish (5)");

  // Allowed when wish CANNOT be fulfilled (only single 5 against Ace, no bomb)
  const wishAllowed = analyzeSelection({
    selectedCards: [DR],
    handCards: [A5, DR],
    lastCombo: new Combo([AA]),
    stateName: "playCombo",
    mahjongWish: 5,
  });
  assert.equal(wishAllowed.isValid, true);

  // Bug #257868 (Option A): non-lead bombs are allowed without fulfilling active Mahjong wish
  const sfBombHand = [A5, B2, B3, B4, B5, B6, A7, B7, C7, D7];
  const nonWishFourBomb = analyzeSelection({
    selectedCards: [A7, B7, C7, D7],
    handCards: sfBombHand,
    lastCombo: new Combo([A3]),
    stateName: "playCombo",
    mahjongWish: 5,
  });
  assert.equal(nonWishFourBomb.isValid, true);
  assert.equal(nonWishFourBomb.reason, null);
  assert.equal(nonWishFourBomb.buttonLabel, "Play");

  const nonWishSfBomb = analyzeSelection({
    selectedCards: [B2, B3, B4, B5, B6],
    handCards: [A8, B2, B3, B4, B5, B6],
    lastCombo: new Combo([A3]),
    stateName: "playCombo",
    mahjongWish: 8,
  });
  assert.equal(nonWishSfBomb.isValid, true);
  assert.equal(nonWishSfBomb.reason, null);

  const nonWishBombOutOfTurn = analyzeSelection({
    selectedCards: [A7, B7, C7, D7],
    handCards: sfBombHand,
    lastCombo: new Combo([A3]),
    stateName: "playBomb",
    mahjongWish: 5,
  });
  assert.equal(nonWishBombOutOfTurn.isValid, true);
  assert.equal(nonWishBombOutOfTurn.reason, null);
  assert.equal(nonWishBombOutOfTurn.buttonLabel, "Play Bomb");

  // Beaten non-wish bomb must still fail with cannot_beat
  const beatenNonWishBomb = analyzeSelection({
    selectedCards: [A7, B7, C7, D7],
    handCards: sfBombHand,
    lastCombo: new Combo([AA, BA, CA, DA]),
    stateName: "playCombo",
    mahjongWish: 5,
  });
  assert.equal(beatenNonWishBomb.isValid, false);
  assert.equal(beatenNonWishBomb.reason, "cannot_beat");

  // Leading a trick (playComboOpen / after Dog) with a non-wish bomb still enforces wish (Option A)
  const leadEmptyNonWishBomb = analyzeSelection({
    selectedCards: [A7, B7, C7, D7],
    handCards: sfBombHand,
    lastCombo: Combo.noCombo,
    stateName: "playComboOpen",
    mahjongWish: 5,
  });
  assert.equal(leadEmptyNonWishBomb.isValid, false);
  assert.equal(leadEmptyNonWishBomb.reason, "must_fulfill_wish");

  const leadDogNonWishBomb = analyzeSelection({
    selectedCards: [A7, B7, C7, D7],
    handCards: sfBombHand,
    lastCombo: new Combo([DOG]),
    stateName: "playComboOpen",
    mahjongWish: 5,
  });
  assert.equal(leadDogNonWishBomb.isValid, false);
  assert.equal(leadDogNonWishBomb.reason, "must_fulfill_wish");

  // Passing still blocked even when holding both a wish-fulfilling combo/bomb and a non-wish bomb
  const passBlockedWithBombs = validatePassAction(
    [A5, B5, C5, D5, A7, B7, C7, D7],
    new Combo([AA, BA]),
    5,
  );
  assert.equal(passBlockedWithBombs.canPass, false);
  assert.equal(passBlockedWithBombs.reason, "must_fulfill_wish");
});

test("SmartPlayUX::validatePassAction wish guard and combo-specific tooltips", () => {
  // Cannot fulfill wish -> canPass is true
  const passOk = validatePassAction([A5, B9], new Combo([AA]), 5);
  assert.equal(passOk.canPass, true);

  // Fulfillable as single
  const singleWish = validatePassAction([A7, B9], new Combo([A3]), 7);
  assert.equal(singleWish.canPass, false);
  assert.equal(singleWish.buttonLabel, "Pass");
  assert.match(singleWish.tooltip, /7/);

  // Fulfillable ONLY as a bomb (wish is 5 over high Pair of Aces)
  const bombWish = validatePassAction([A5, B5, C5, D5, B9], new Combo([AA, BA]), 5);
  assert.equal(bombWish.canPass, false);
  assert.equal(bombWish.buttonLabel, "Pass");
  assert.equal(bombWish.requiredComboType, BOMB_COMBO);
  assert.match(bombWish.tooltip, /bomb/i);

  // Fulfillable ONLY as a pair (wish is 12 over Pair of 10s, with Queen + Phoenix)
  const pairWish = validatePassAction([AQ, PH], new Combo([A0, B0]), 12);
  assert.equal(pairWish.canPass, false);
  assert.equal(pairWish.buttonLabel, "Pass");
  assert.equal(pairWish.requiredComboType, PAIR_COMBO);
  assert.match(pairWish.tooltip, /pair/i);

  // Reconstructed single Phoenix from server lastComboState
  const reconstructed = Combo.fromLastComboState({
    cards: [PH],
    type: SINGLE_COMBO,
    phoenixValue: 10.5,
    description: "Phoenix a half step above 10",
  });
  assert.equal(reconstructed.type, SINGLE_COMBO);
  assert.equal(reconstructed.getFirstValue(), 10.5);
  assert.equal(new Combo([AJ]).canBeat(reconstructed), true);
  assert.equal(new Combo([A0]).canBeat(reconstructed), false);
});

test("SmartPlayUX::getWishBombOnlyCallout triggers only when wish requires a bomb", () => {
  // No active wish -> null
  assert.equal(getWishBombOnlyCallout([A5, B5, C5, D5], new Combo([AA, BA]), 0), null);

  // Leading a trick (no combo or Dog) -> null because a single fulfills the wish
  assert.equal(getWishBombOnlyCallout([A5, B5, C5, D5], Combo.noCombo, 5), null);
  assert.equal(getWishBombOnlyCallout([A5, A6, A7, A8, A9], new Combo([DOG]), 7), null);

  // Fulfillable via the trick's combo type -> null
  assert.equal(getWishBombOnlyCallout([A5, B5, C5, D5], new Combo([A3]), 5), null);
  assert.equal(getWishBombOnlyCallout([A5, B5, C5, D5], new Combo([A3, B3]), 5), null);
  assert.equal(
    getWishBombOnlyCallout([A5, A6, A7, A8, A9], new Combo([B2, C3, D4, A5, B6]), 7),
    null,
  );

  // Cannot fulfill wish at all -> null
  assert.equal(getWishBombOnlyCallout([A5, DR], new Combo([AA]), 5), null);
  assert.equal(getWishBombOnlyCallout([A5, B5, C5, D5], new Combo([AA, BA, CA, DA]), 5), null);

  // Fulfillable ONLY by a 4-of-a-kind bomb
  const fourBombPair = getWishBombOnlyCallout([A5, B5, C5, D5, B9], new Combo([AA, BA]), 5);
  assert.ok(fourBombPair !== null);
  assert.equal(fourBombPair.bombKind, "4-of-a-kind bomb");
  assert.equal(fourBombPair.bombDescription, "Bomb of four 5s");
  assert.match(fourBombPair.message, /4-of-a-kind bomb/);
  assert.match(fourBombPair.message, /5/);

  const fourBombSingle = getWishBombOnlyCallout([AQ, BQ, CQ, DQ], new Combo([AA]), 12);
  assert.ok(fourBombSingle !== null);
  assert.equal(fourBombSingle.bombKind, "4-of-a-kind bomb");
  assert.equal(fourBombSingle.bombDescription, "Bomb of four Queens");
  assert.match(fourBombSingle.message, /4-of-a-kind bomb/);
  assert.match(fourBombSingle.message, /Queen/);

  // Fulfillable ONLY by a straight flush bomb
  const sfBombPair = getWishBombOnlyCallout([A5, A6, A7, A8, A9, B2], new Combo([B0, C0]), 7);
  assert.ok(sfBombPair !== null);
  assert.equal(sfBombPair.bombKind, "straight flush bomb");
  assert.equal(sfBombPair.bombDescription, "Straight flush bomb starting from 5 to 9");
  assert.match(sfBombPair.message, /straight flush bomb/);
  assert.match(sfBombPair.message, /7/);

  const sfBombStraight = getWishBombOnlyCallout(
    [A3, A4, A5, A6, A7],
    new Combo([B8, C9, D0, AJ, BQ]),
    5,
  );
  assert.ok(sfBombStraight !== null);
  assert.equal(sfBombStraight.bombKind, "straight flush bomb");
  assert.equal(sfBombStraight.bombDescription, "Straight flush bomb starting from 3 to 7");
  assert.match(sfBombStraight.message, /straight flush bomb/);

  // Against Bomb of four Aces: four 7s cannot beat it, only the straight flush bomb can
  const sfOverFourBomb = getWishBombOnlyCallout(
    [A5, A6, A7, A8, A9, B7, C7, D7],
    new Combo([AA, BA, CA, DA]),
    7,
  );
  assert.ok(sfOverFourBomb !== null);
  assert.equal(sfOverFourBomb.bombKind, "straight flush bomb");

  // Both a 4-of-a-kind bomb and a straight flush bomb can fulfill the wish
  const bothBombs = getWishBombOnlyCallout(
    [A5, A6, A7, A8, A9, B7, C7, D7],
    new Combo([AA, BA]),
    7,
  );
  assert.ok(bothBombs !== null);
  assert.equal(bothBombs.bombKind, "4-of-a-kind or straight flush bomb");
  assert.match(bothBombs.message, /4-of-a-kind or straight flush bomb/);
});

// =========================================================================
// Studio & Local Client Runtime Regressions (GameModel + Tichu adapter)
// =========================================================================

test("GameModel::enterNewRound preserves 8-card initial deal", () => {
  const model = new GameModel();
  model.hydrateFromGamedatas(
    {
      players: {
        "2385074": { id: "2385074", name: "p0", color: "000000", no: 1, score: "0" } as any,
        "2385075": { id: "2385075", name: "p1", color: "ff0000", no: 2, score: "0" } as any,
        "2385076": { id: "2385076", name: "p2", color: "000000", no: 3, score: "0" } as any,
        "2385077": { id: "2385077", name: "p3", color: "ff0000", no: 4, score: "0" } as any,
      },
      playerorder: ["2385074", "2385075", "2385076", "2385077"],
      gamestate: {
        id: "20",
        name: "grandTichuBets",
        type: "multipleactiveplayer",
        args: {},
      } as any,
      round: 1,
      trick: 0,
      hand: [],
    },
    "2385074",
    false,
    true,
  );

  // Deal 8 cards arriving prior to enterNewRound() must stay intact.
  const eightCards = [A2, B3, C4, D5, A6, B7, C8, D9];
  model.dealCards(eightCards);
  assert.equal(model.getState().hand.length, 8);

  model.enterNewRound();
  assert.equal(model.getState().hand.length, 8);
  assert.equal(model.getState().players["2385074"]?.handcount, 8);

  // Non-8-card leftover hand resets cleanly to empty on enterNewRound().
  model.setHand([A2, B3]);
  model.enterNewRound();
  assert.equal(model.getState().hand.length, 0);
  assert.equal(model.getState().players["2385074"]?.handcount, 0);
});

function loadTichuAdapterForNodeTests() {
  const g = globalThis as any;
  const publishedTopics: Array<{ topic: string; args: any[] }> = [];
  const parentGameStateCalls: any[] = [];
  const parentReflexionCalls: any[] = [];

  if (!g.window) g.window = g;
  if (!g.document) {
    g.document = {
      getElementById: () => null,
      querySelector: () => null,
    };
  }
  g._ = (s: string) => s;

  const baseProto = {
    ntf_gameStateChange(notif: any) {
      parentGameStateCalls.push(notif);
    },
    ntf_updateReflexionTime(notif: any) {
      parentReflexionCalls.push(notif);
    },
  };
  g.ebg = {
    core: {
      gamegui: Object.assign(function GameGui() {}, { prototype: baseProto }),
    },
    counter: function Counter() {},
  };
  g.dojo = {
    publish(topic: string, args: any[] = []) {
      publishedTopics.push({ topic, args });
    },
    subscribe() {
      return {};
    },
    unsubscribe() {},
  };

  let declaredClass: any = null;
  const declareMock = (_name: string, _base: any, props: any) => {
    const Ctor: any = function DeclaredTichu() {};
    Ctor.prototype = Object.create(baseProto);
    const proto = Object.getPrototypeOf(props);
    if (proto && proto !== Object.prototype) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === "constructor") continue;
        const desc = Object.getOwnPropertyDescriptor(proto, key);
        if (desc && typeof desc.value === "function") {
          Ctor.prototype[key] = desc.value;
        }
      }
    }
    // Mimic Dojo declare's safeMixin copying enumerable properties (including installLegacyAccessors) via `for..in`.
    for (const key in props) {
      const desc = Object.getOwnPropertyDescriptor(props, key);
      if (desc && (desc.get || desc.set)) {
        Object.defineProperty(Ctor.prototype, key, desc);
      } else {
        Ctor.prototype[key] = props[key];
      }
    }
    declaredClass = Ctor;
    return Ctor;
  };
  g.define = (_deps: string[], factory: (dojoArg: any, declareArg: any) => any) => {
    return factory(g.dojo, declareMock);
  };

  const { Tichu } = require("../src/tichu");
  return { Tichu, declaredClass, publishedTopics, parentGameStateCalls, parentReflexionCalls };
}

test("Tichu studio adapter regressions: legacy accessors, reflexion/args, confirmTichu recursion, orphaned lock", () => {
  const { Tichu, declaredClass, publishedTopics, parentGameStateCalls } =
    loadTichuAdapterForNodeTests();
  const ui = new declaredClass();
  ui.player_id = 2385074;
  ui.gamedatas = {
    players: {
      2385074: { id: "2385074", name: "p0", score: "0" },
      2385075: { id: "2385075", name: "p1", score: "0" },
    },
    gamestate: {
      id: "60",
      name: "playCombo",
      type: "activeplayer",
      active_player: "2385074",
      descriptionmyturn: "Your turn",
      args: {},
    },
    hand: [],
  };

  // 1. Enumerable legacy accessors survive Dojo declare mixin
  for (const prop of ["allowedValues", "clockwise", "cardsToPass"]) {
    const desc = Object.getOwnPropertyDescriptor(Tichu.prototype, prop);
    assert.ok(desc, `${prop} descriptor must exist on Tichu.prototype`);
    assert.equal(desc.enumerable, true, `${prop} must be enumerable for Dojo declare`);
    assert.equal(prop in ui, true, `${prop} must exist on declared instance`);
  }

  // 2. Empty PHP args: [] normalized to {} and reflexion maps initialized on ntf_gameStateChange
  const gsNotif = {
    args: {
      name: "playCombo",
      args: [],
      reflexion: { total: [] },
    },
  };
  ui.ntf_gameStateChange(gsNotif);
  assert.equal(Array.isArray(gsNotif.args.args), false);
  assert.deepEqual(gsNotif.args.args, {});
  assert.equal(typeof gsNotif.args.reflexion.total["2385074"], "number");
  assert.equal(typeof gsNotif.args.reflexion.initial["2385074"], "number");
  assert.equal(typeof gsNotif.args.reflexion.initial_ts["2385074"], "number");
  assert.equal(parentGameStateCalls.length, 1);

  // 3. confirmTichu <-> updatePageTitle <-> onUpdateActionButtons mutual recursion guard
  let actionButtonsRenders = 0;
  ui.stateName = "playCombo";
  ui.removeActionButtons = () => {};
  ui.addActionButton = () => {};
  ui.playLaserSound = () => {};
  ui.notifqueue = {
    queue: [],
    waiting_from_notifend: "wait-1",
    notificationResendInProgress: false,
    setSynchronousDuration() {},
  };
  ui.onUpdateActionButtons = (_state: string, _args: any) => {
    actionButtonsRenders++;
    if (actionButtonsRenders > 20) {
      throw new RangeError("Simulated stack overflow");
    }
    ui.renderConfirmTichuButtons();
  };
  // Mimic ly_studio.js:22688 updatePageTitle() synchronously invoking onUpdateActionButtons().
  ui.updatePageTitle = () => {
    ui.onUpdateActionButtons(ui.stateName, ui.gamedatas.gamestate.args || {});
  };

  ui.notif_confirmTichu({
    args: { grand: false, msg: "Confirm Tichu?" },
  });
  assert.equal(actionButtonsRenders, 1);

  ui.notif_tichuBet({
    args: { player_id: 2385074, bet: Bet.TICHU },
  });
  assert.equal(ui.gamedatas.gamestate.descriptionmyturn, "Your turn");

  // 4. Orphaned "Updating game situation ..." lockInterface release
  let locked = true;
  ui.isInterfaceLocked = () => locked;
  ui.unlockInterface = (uuid?: string) => {
    if (uuid === ui.interface_locked_by_id) locked = false;
  };
  ui.bga = { actions: { ajaxcall_running: 0 } };
  ui.ajaxcall_running = 0;
  ui.interface_status = "queued";
  ui.interface_locked_by_id = "lock-123";

  // Must NOT unlock while waiting on a synchronous notification
  ui.onNotificationPacketDispatched();
  assert.equal(locked, true);

  // Must unlock once notifqueue & AJAX are idle
  ui.notifqueue.waiting_from_notifend = null;
  const pubBefore = publishedTopics.length;
  ui.onNotificationPacketDispatched();
  assert.equal(locked, false);
  assert.equal(publishedTopics.length, pubBefore + 1);
  assert.equal(publishedTopics[pubBefore]?.topic, "lockInterface");
  assert.equal(publishedTopics[pubBefore]?.args?.[0]?.status, "updated");
  assert.equal(publishedTopics[pubBefore]?.args?.[0]?.uuid, "lock-123");

  // 5. confirmTrick trick-2+ auto-collect under Studio hook order
  // (onLeavingState -> onUpdateActionButtons -> onEnteringState)
  const g = globalThis as any;
  const savedGameModel = g.window.gameModel;
  const savedSetTimeout = g.window.setTimeout;
  try {
    const model = new GameModel();
    model.hydrateFromGamedatas(
      {
        players: {
          "2385074": {
            id: "2385074",
            name: "p0",
            color: "000000",
            no: 1,
            score: "0",
            call_grand_tichu: "0",
          } as any,
          "2385075": { id: "2385075", name: "p1", color: "ff0000", no: 2, score: "0" } as any,
        },
        playerorder: ["2385074", "2385075"],
        gamestate: {
          id: "75",
          name: "confirmTrick",
          type: "activeplayer",
          active_player: "2385074",
          args: {},
        } as any,
        round: 1,
        trick: 2,
        hand: [],
      },
      "2385074",
      false,
      true,
    );
    g.window.gameModel = model;

    let scheduledAutoCollectDelay: number | null = null;
    g.window.setTimeout = (_fn: () => void, delay = 0) => {
      scheduledAutoCollectDelay = Number(delay);
      return 777;
    };

    const collectUi = new declaredClass();
    collectUi.player_id = 2385074;
    collectUi.isSpectator = false;
    collectUi.bRealtime = true;
    collectUi.collectSent = true;
    collectUi.isCurrentPlayerActive = () => true;
    collectUi.getActivePlayerId = () => 2385074;
    collectUi.removeActionButtons = () => {};
    collectUi.gamedatas = {
      players: {
        "2385074": { id: "2385074", name: "p0", score: "0", call_grand_tichu: "0" },
      },
      gamestate: {
        id: "75",
        name: "confirmTrick",
        type: "activeplayer",
        active_player: "2385074",
        args: {},
      },
      hand: [],
    };

    collectUi.onLeavingState("confirmTrick");
    collectUi.onLeavingState("playCombo");
    collectUi.onUpdateActionButtons("confirmTrick", {});
    collectUi.onEnteringState("confirmTrick", collectUi.gamedatas.gamestate);

    assert.equal(collectUi.collectSent, false);
    assert.equal(model.getState().collectingTrickCountdown, true);
    assert.equal(scheduledAutoCollectDelay, 2000);
    assert.equal(collectUi.autoCollectTimeout, 777);
  } finally {
    g.window.gameModel = savedGameModel;
    g.window.setTimeout = savedSetTimeout;
  }
});

test("initStudioTestHelper unifies step/actForOthers and debounces Auto-Bot timers", async () => {
  const g = globalThis as any;
  const savedWindow = g.window;
  const savedDocument = g.document;
  const savedSession = g.sessionStorage;
  const savedLocal = g.localStorage;
  const savedCSS = g.CSS;

  try {
    const perfCalls: Array<{ action: string; args: any; opts: any }> = [];
    const scheduledTimers: Array<{ id: number; delay: number; fn: () => void; cleared: boolean }> =
      [];
    let nextTimerId = 1;

    const sessionMap = new Map<string, string>();
    const sessionMock = {
      getItem: (k: string) => (sessionMap.has(k) ? sessionMap.get(k)! : null),
      setItem: (k: string, v: string) => {
        sessionMap.set(k, String(v));
      },
      removeItem: (k: string) => {
        sessionMap.delete(k);
      },
    };

    const localMap = new Map<string, string>();
    const localMock = {
      getItem: (k: string) => (localMap.has(k) ? localMap.get(k)! : null),
      setItem: (k: string, v: string) => {
        localMap.set(k, String(v));
      },
      removeItem: (k: string) => {
        localMap.delete(k);
      },
    };

    const showMessages: Array<{ msg: string; type: string }> = [];
    const clearedTimerIds: number[] = [];

    const ui: any = {
      player_id: 2385074,
      isSpectator: false,
      bRealtime: true,
      instantaneousMode: true,
      autoCollectTimeout: 4242,
      showMessage(msg: string, type: string) {
        showMessages.push({ msg, type });
      },
      gamedatas: {
        players: {
          "2385074": { id: "2385074", name: "p0", no: 1, color: "000000", score: "0" },
          "2385075": { id: "2385075", name: "p1", no: 2, color: "ff0000", score: "0" },
        },
        gamestate: {
          id: "60",
          name: "playCombo",
          type: "activeplayer",
          active_player: "2385075",
          multiactive: [],
          args: {},
        },
        hand: [],
        handcount: { 2385074: 14, 2385075: 14 },
        capturedpoints: { 2385074: 0, 2385075: 0 },
        round: 1,
        trick: 1,
        currentTrickValue: 0,
      },
      isPlayerActive(pid: number) {
        const st = ui.gamedatas.gamestate;
        return st.type === "activeplayer" && Number(st.active_player) === Number(pid);
      },
      isCurrentPlayerActive() {
        return ui.isPlayerActive(ui.player_id);
      },
      bga: {
        actions: {
          ajaxcall_running: 0,
          async performAction(action: string, args: any, opts: any) {
            perfCalls.push({ action, args, opts });
            return { ok: true };
          },
        },
        players: {
          getActivePlayerIds() {
            const st = ui.gamedatas.gamestate;
            return st.active_player ? [Number(st.active_player)] : [];
          },
        },
      },
    };

    g.CSS = { escape: (s: string) => String(s) };
    g.sessionStorage = sessionMock;
    g.localStorage = localMock;
    g.document = {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      body: null,
    };
    g.window = {
      location: { hostname: "studio.boardgamearena.com", search: "" },
      console: globalThis.console,
      addEventListener: () => {},
      setTimeout(fn: () => void, delay = 0) {
        const entry = { id: nextTimerId++, delay: Number(delay), fn, cleared: false };
        scheduledTimers.push(entry);
        return entry.id;
      },
      clearTimeout(id: number) {
        clearedTimerIds.push(id);
        const found = scheduledTimers.find((t) => t.id === id);
        if (found) found.cleared = true;
      },
      gameui: ui,
    };

    const { initStudioTestHelper } = require("../src/studio-test");
    initStudioTestHelper(ui);
    const tt = g.window.tt;
    assert.ok(tt, "window.tt must be initialized");

    // 1. tt.step(1) -> debug_botStep; tt.step(4) -> debug_bgaPlayMoves; tt.actForOthers() -> debug_botOthers
    await tt.step(1);
    await tt.step(4);
    await tt.actForOthers();
    assert.deepEqual(
      perfCalls.map((c) => [c.action, c.args, c.opts]),
      [
        ["debug_botStep", {}, { checkAction: false, lock: false }],
        ["debug_bgaPlayMoves", { moves: 4 }, { checkAction: false, lock: false }],
        ["debug_botOthers", {}, { checkAction: false, lock: false }],
      ],
    );

    // 2. Auto-Bot OFF -> onQueueDrained schedules nothing
    tt.onQueueDrained();
    assert.equal(scheduledTimers.length, 0);

    // 3. Auto-Bot ON -> repeated onQueueDrained() debounces to one 300ms timer
    sessionMock.setItem("tichu_autobot", "1");
    tt.onQueueDrained();
    tt.onQueueDrained();
    const activeNormal = scheduledTimers.filter((t) => !t.cleared);
    assert.equal(activeNormal.length, 1);
    assert.equal(activeNormal[0]!.delay, 300);

    // 4. Real-time confirmTrick when another player won -> debounces to 2000ms timer
    ui.gamedatas.gamestate.name = "confirmTrick";
    ui.gamedatas.gamestate.active_player = "2385075";
    tt.onQueueDrained();
    const activeConfirm = scheduledTimers.filter((t) => !t.cleared);
    assert.equal(activeConfirm.length, 1);
    assert.equal(activeConfirm[0]!.delay, 2000);

    // 5. When it becomes viewer's turn -> clears pending Auto-Bot timer and schedules nothing
    ui.gamedatas.gamestate.active_player = "2385074";
    tt.onQueueDrained();
    assert.equal(scheduledTimers.filter((t) => !t.cleared).length, 0);

    // 6. confirmTrick with active human winner preserves autoCollectTimeout in actForOthers()
    ui.gamedatas.gamestate.name = "confirmTrick";
    ui.gamedatas.gamestate.active_player = "2385074";
    ui.autoCollectTimeout = 4242;
    clearedTimerIds.length = 0;
    const perfCountBefore = perfCalls.length;
    await tt.actForOthers();
    assert.equal(
      perfCalls.length,
      perfCountBefore,
      "actForOthers must no-op when human owns confirmTrick",
    );
    assert.ok(
      !clearedTimerIds.includes(4242),
      "actForOthers must not cancel human winner's autoCollectTimeout",
    );

    // 7. Auto-Bot retries with exponential backoff (300 -> 600 -> 1200) and auto-disables after 3 no-ops
    ui.gamedatas.gamestate.name = "playCombo";
    ui.gamedatas.gamestate.active_player = "2385075";
    scheduledTimers.length = 0;
    sessionMock.setItem("tichu_autobot", "1");
    tt.onQueueDrained();
    let pending = scheduledTimers.filter((t) => !t.cleared);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]!.delay, 300);

    await pending[0]!.fn();
    pending = scheduledTimers.filter((t) => !t.cleared).slice(-1);
    assert.equal(pending[0]!.delay, 600);

    await pending[0]!.fn();
    pending = scheduledTimers.filter((t) => !t.cleared).slice(-1);
    assert.equal(pending[0]!.delay, 1200);

    await pending[0]!.fn();
    assert.equal(
      sessionMock.getItem("tichu_autobot"),
      "0",
      "Auto-Bot should auto-disable after 3 no-ops",
    );
    assert.equal(showMessages.length, 1);
    assert.equal(showMessages[0]!.type, "error");
    assert.equal(scheduledTimers.filter((t) => !t.cleared && t.id > pending[0]!.id).length, 0);

    // 8. Cross-tab Auto-Bot ownership: if another tab owns Auto-Bot for a different seat,
    //    this tab automatically disables its tichu_autobot flag and does not schedule actForOthers().
    scheduledTimers.length = 0;
    sessionMock.setItem("tichu_autobot", "1");
    localMock.setItem(
      "tichu_autobot_owner_0",
      JSON.stringify({ tabId: "other-tab", playerId: 2385075, updatedAt: Date.now() }),
    );
    const perfBeforeConflict = perfCalls.length;
    tt.onQueueDrained();
    assert.equal(
      sessionMock.getItem("tichu_autobot"),
      "0",
      "Auto-Bot should disable when another seat tab owns Auto-Bot",
    );
    assert.equal(
      scheduledTimers.filter((t) => !t.cleared).length,
      0,
      "No Auto-Bot timer should be scheduled when another seat tab owns Auto-Bot",
    );
    assert.equal(perfCalls.length, perfBeforeConflict);
  } finally {
    g.window = savedWindow;
    g.document = savedDocument;
    g.sessionStorage = savedSession;
    g.localStorage = savedLocal;
    g.CSS = savedCSS;
  }
});

test("tt.suggest and tt.actMyTurn strictly follow server botSuggestion notifications", async () => {
  const g = globalThis as any;
  const savedWindow = g.window;
  const savedDocument = g.document;
  const savedSession = g.sessionStorage;
  const savedLocal = g.localStorage;
  const savedCSS = g.CSS;
  const savedDojo = g.dojo;

  try {
    const ajaxCalls: Array<{ url: string; args: any }> = [];
    const perfCalls: string[] = [];
    const listeners = new Map<string, Array<{ fn: (...args: any[]) => void }>>();

    const dojoMock = {
      subscribe(topic: string, context: any, method: any) {
        const list = listeners.get(topic) || [];
        const fn =
          typeof method === "function"
            ? method.bind(context)
            : typeof context === "function"
              ? context
              : (...args: any[]) => context?.[method]?.(...args);
        const handle = {
          fn,
          remove() {
            const idx = list.indexOf(handle);
            if (idx !== -1) list.splice(idx, 1);
          },
        };
        list.push(handle);
        listeners.set(topic, list);
        return handle;
      },
      unsubscribe(handle: any) {
        handle?.remove?.();
      },
      publish(topic: string, args: any[]) {
        const list = (listeners.get(topic) || []).slice();
        for (const h of list) {
          h.fn(...(args || []));
        }
      },
    };

    const statusEl = {
      roundCount: 1,
      trickCount: 1,
      trickPoints: 0,
      getAttribute(name: string) {
        return name in statusEl ? String((statusEl as any)[name]) : null;
      },
    };

    const ui: any = {
      player_id: 2385074,
      isSpectator: false,
      instantaneousMode: true,
      gamedatas: {
        players: {
          "2385074": { id: "2385074", name: "p0", no: 1, color: "000000", score: "0", team: 0 },
          "2385075": { id: "2385075", name: "p1", no: 2, color: "ff0000", score: "0", team: 1 },
        },
        gamestate: {
          id: "49",
          name: "playComboOpen",
          type: "activeplayer",
          active_player: "2385074",
          multiactive: [],
          args: {},
        },
        hand: [
          { id: "14", type: "1", type_arg: "14" },
          { id: "28", type: "2", type_arg: "14" },
        ],
        handcount: { 2385074: 2, 2385075: 14 },
        capturedpoints: { 2385074: 0, 2385075: 0 },
        round: 1,
        trick: 1,
        currentTrickValue: 0,
      },
      isPlayerActive(pid: number) {
        return Number(ui.gamedatas.gamestate.active_player) === Number(pid);
      },
      isCurrentPlayerActive() {
        return ui.isPlayerActive(ui.player_id);
      },
      ajaxcall(url: string, args: any, _ctx: any, cb: () => void) {
        ajaxCalls.push({ url, args });
        if (url.endsWith("/playCombo.html")) {
          ui.gamedatas.hand = [];
          ui.gamedatas.handcount[2385074] = 0;
          ui.gamedatas.gamestate.active_player = "2385075";
        }
        cb();
      },
      bga: {
        actions: {
          ajaxcall_running: 0,
          async performAction(action: string) {
            perfCalls.push(action);
            if (action === "debug_botSuggest") {
              const suggestion = {
                acted: true,
                player_id: 2385074,
                state: "playComboOpen",
                action: "playCombo",
                callTichuFirst: true,
                args: { cards: ["14", "28"] },
              };
              dojoMock.publish("botSuggestion", [{ type: "botSuggestion", args: { suggestion } }]);
            }
            return { ok: true };
          },
        },
        players: {
          getActivePlayerIds() {
            return [Number(ui.gamedatas.gamestate.active_player)];
          },
        },
      },
    };

    const emptyMap = { getItem: () => null, setItem() {}, removeItem() {} };
    g.CSS = { escape: (s: string) => String(s) };
    g.sessionStorage = emptyMap;
    g.localStorage = emptyMap;
    g.dojo = dojoMock;
    g.document = {
      getElementById: (id: string) =>
        id === "overall-content"
          ? { className: "gamestate_playComboOpen", classList: { contains: () => true } }
          : null,
      querySelector: (sel: string) => (sel.includes("tichu-status") ? statusEl : null),
      querySelectorAll: (sel: string) => {
        if (sel.includes("#myhand .stockitem")) {
          return ui.gamedatas.hand.map((c: any) => ({ id: c.id }));
        }
        if (sel.includes(".handcount.2385074")) {
          return [{ textContent: String(ui.gamedatas.handcount[2385074]) }];
        }
        if (sel.includes(".handcount.2385075")) {
          return [{ textContent: String(ui.gamedatas.handcount[2385075]) }];
        }
        if (sel.includes("tichu-status")) return [statusEl];
        return [];
      },
      body: null,
    };
    g.window = {
      location: { hostname: "studio.boardgamearena.com", search: "" },
      console: globalThis.console,
      addEventListener: () => {},
      dojo: dojoMock,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      gameui: ui,
    };

    const { initStudioTestHelper } = require("../src/studio-test");
    initStudioTestHelper(ui);
    const tt = g.window.tt;

    const directSuggestion = await tt.suggest();
    assert.equal(directSuggestion.action, "playCombo");
    assert.equal(directSuggestion.callTichuFirst, true);
    assert.equal(
      listeners.get("botSuggestion")?.length || 0,
      0,
      "tt.suggest must unsubscribe listener",
    );

    const actRes = await tt.actMyTurn();
    assert.equal(actRes.acted, true);
    assert.equal(actRes.action, "tichuBet+play(SA,RA)");
    assert.deepEqual(
      ajaxCalls.map((c) => [c.url, c.args]),
      [
        ["/tichu/tichu/tichuBet.html", { bet: 100, lock: true }],
        ["/tichu/tichu/playCombo.html", { cards: "14;28", lock: true }],
      ],
    );
    assert.equal(perfCalls.filter((a) => a === "debug_botSuggest").length, 2);
    assert.equal(
      listeners.get("botSuggestion")?.length || 0,
      0,
      "actMyTurn must clean up listener",
    );

    const notMyTurnRes = await tt.actMyTurn();
    assert.equal(notMyTurnRes.acted, false);
    assert.equal(notMyTurnRes.reason, "not_my_turn");
    assert.equal(
      perfCalls.filter((a) => a === "debug_botSuggest").length,
      2,
      "actMyTurn must not call debug_botSuggest when not viewer's turn",
    );
  } finally {
    g.window = savedWindow;
    g.document = savedDocument;
    g.sessionStorage = savedSession;
    g.localStorage = savedLocal;
    g.CSS = savedCSS;
    g.dojo = savedDojo;
  }
});

// =========================================================================
// Animation Origin / Destination, Pass-Card Flights & Trick Pass Sweep Tests
// =========================================================================

class MockDOMRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  x: number;
  y: number;
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.left = x;
    this.top = y;
    this.width = width;
    this.height = height;
    this.right = x + width;
    this.bottom = y + height;
  }
  toJSON() {
    return {
      x: this.x,
      y: this.y,
      left: this.left,
      top: this.top,
      width: this.width,
      height: this.height,
      right: this.right,
      bottom: this.bottom,
    };
  }
}

function withMockLitEnv(
  fn: (mods: {
    TichuAnimationLayer: any;
    TichuLastPlayed: any;
    TichuPassArea: any;
    TichuStock: any;
    TichuActionBar: any;
    TichuValueChoice: any;
    TichuCardEl: any;
    TichuHand: any;
    TichuStatus: any;
    TichuScoreBoard: any;
    TichuSettingsModal: any;
    TichuTooltipLayer: any;
    TOOLTIP_TIMINGS: any;
    computeTooltipPosition: any;
    resolveTouchMode: any;
    resolveTooltipTier: any;
    areSlowTooltipsHidden: any;
    getThemeLabel: (themeNo: number) => string;
    buildPassedOriginsMap: any;
    computeCardVisibleWidthPx: any;
  }) => Promise<void> | void,
): Promise<void> {
  const g = globalThis as any;
  const saved = {
    window: g.window,
    document: g.document,
    Element: g.Element,
    HTMLElement: g.HTMLElement,
    DOMRect: g.DOMRect,
    customElements: g.customElements,
  };

  class MockElement {
    style: Record<string, any> = {
      setProperty(k: string, v: string) {
        this[k] = v;
      },
    };
    private attrs = new Map<string, string>();
    get shadowRoot(): any {
      return null;
    }
    attachShadow() {
      return {};
    }
    setAttribute(k: string, v: string) {
      this.attrs.set(k, String(v));
    }
    getAttribute(k: string) {
      return this.attrs.has(k) ? this.attrs.get(k)! : null;
    }
    removeAttribute(k: string) {
      this.attrs.delete(k);
    }
    hasAttribute(k: string) {
      return this.attrs.has(k);
    }
    toggleAttribute(k: string, force?: boolean) {
      const next = force === undefined ? !this.attrs.has(k) : Boolean(force);
      if (next) this.attrs.set(k, "");
      else this.attrs.delete(k);
      return next;
    }
    animate() {
      return { finished: Promise.resolve(), cancel() {} };
    }
  }

  g.Element = MockElement;
  g.HTMLElement = MockElement;
  g.DOMRect = MockDOMRect;
  g.customElements = { define() {}, get: () => undefined };
  g.document = {
    hidden: false,
    visibilityState: "visible",
    createTreeWalker: () => ({ currentNode: null, nextNode: () => null }),
    createComment: () => ({}),
    createTextNode: () => ({}),
    createElement: () => new MockElement(),
    getElementById: () => null,
    querySelector: () => null,
    body: null,
  };
  g.window = {
    matchMedia: () => ({ matches: false }),
    innerWidth: 1200,
    innerHeight: 900,
  };

  const stockMod = require("../src/elements/tichu-stock");
  const handMod = require("../src/elements/tichu-hand");
  const cardMod = require("../src/elements/tichu-card");
  const passAreaMod = require("../src/elements/tichu-pass-area");
  const settingsModalMod = require("../src/elements/tichu-settings-modal");
  const tooltipLayerMod = require("../src/elements/tichu-tooltip-layer");
  const mods = {
    TichuAnimationLayer: require("../src/elements/tichu-animation-layer").TichuAnimationLayer,
    TichuLastPlayed: require("../src/elements/tichu-last-played").TichuLastPlayed,
    TichuPassArea: passAreaMod.TichuPassArea,
    PASS_SLOT_CARD_OFFSET_X: passAreaMod.PASS_SLOT_CARD_OFFSET_X,
    PASS_SLOT_CARD_OFFSET_Y: passAreaMod.PASS_SLOT_CARD_OFFSET_Y,
    TichuStock: stockMod.TichuStock,
    TichuActionBar: require("../src/elements/tichu-action-bar").TichuActionBar,
    TichuValueChoice: require("../src/elements/tichu-value-choice").TichuValueChoice,
    TichuCardEl: cardMod.TichuCard,
    TichuHand: handMod.TichuHand,
    TichuStatus: require("../src/elements/tichu-status").TichuStatus,
    TichuScoreBoard: require("../src/elements/tichu-score-board").TichuScoreBoard,
    TichuSettingsModal: settingsModalMod.TichuSettingsModal,
    TichuTooltipLayer: tooltipLayerMod.TichuTooltipLayer,
    TOOLTIP_TIMINGS: tooltipLayerMod.TOOLTIP_TIMINGS,
    computeTooltipPosition: tooltipLayerMod.computeTooltipPosition,
    resolveTouchMode: tooltipLayerMod.resolveTouchMode,
    resolveTooltipTier: tooltipLayerMod.resolveTooltipTier,
    areSlowTooltipsHidden: tooltipLayerMod.areSlowTooltipsHidden,
    getThemeLabel: settingsModalMod.getThemeLabel,
    buildPassedOriginsMap: handMod.buildPassedOriginsMap,
    computeCardVisibleWidthPx: stockMod.computeCardVisibleWidthPx,
  };

  return Promise.resolve(fn(mods)).finally(() => {
    g.window = saved.window;
    g.document = saved.document;
    g.Element = saved.Element;
    g.HTMLElement = saved.HTMLElement;
    g.DOMRect = saved.DOMRect;
    g.customElements = saved.customElements;
  });
}

test("Animations::playCombo and captureCardsSweep use <tichu-hand> for self and <tichu-last-played> icons for opponents (never player panels)", async () => {
  await withMockLitEnv(({ TichuAnimationLayer }) => {
    const g = globalThis as any;
    const model = new GameModel();
    model.hydrateFromGamedatas(
      {
        players: {
          "2385074": { id: "2385074", name: "p0", color: "000000", no: 1, score: "0" } as any,
          "2385075": { id: "2385075", name: "p1", color: "ff0000", no: 2, score: "0" } as any,
          "2385076": { id: "2385076", name: "p2", color: "000000", no: 3, score: "0" } as any,
          "2385077": { id: "2385077", name: "p3", color: "ff0000", no: 4, score: "0" } as any,
        },
        playerorder: ["2385074", "2385075", "2385076", "2385077"],
        gamestate: {
          id: "60",
          name: "playCombo",
          type: "activeplayer",
          active_player: "2385074",
          args: {},
        } as any,
        hand: [A5, B6],
      },
      "2385074",
      false,
      true,
    );
    g.window.gameModel = model;

    const handCardRect = new MockDOMRect(200, 620, 100, 150);
    const handAnchorRect = new MockDOMRect(350, 620, 100, 150);
    const selfPointsIconRect = new MockDOMRect(80, 500, 36, 54);
    const oppHandIconRect = new MockDOMRect(120, 180, 58, 87);
    const oppPointsIconRect = new MockDOMRect(160, 180, 36, 54);
    const tableAceRect = new MockDOMRect(400, 200, 75, 112.5);
    const tablePassRect = new MockDOMRect(400, 340, 75, 112.5);

    let panelAccessed = false;
    const mockHand = {
      getCardRects: (ids: Array<string | number>) => {
        const m = new Map<number, DOMRect>();
        for (const id of ids) m.set(Number(id), handCardRect as any);
        return m;
      },
      getHandAnchorRect: () => handAnchorRect,
      revealCards() {},
    };
    const mockLastPlayed = {
      markPendingReveal() {},
      revealCards() {},
      hideAllComboCards() {},
      setWinningComboHighlight() {},
      getPlayerHandIconRect: (pid: number) => (Number(pid) === 2385075 ? oppHandIconRect : null),
      getPlayerPointsIconRect: (pid: number) =>
        Number(pid) === 2385075
          ? oppPointsIconRect
          : Number(pid) === 2385074
            ? selfPointsIconRect
            : null,
      getSeatAnchorRect: () => new MockDOMRect(999, 999, 75, 112.5),
      getAllTableComboCards: () => [
        { playerId: "2385074", card: AA, rect: tableAceRect as any },
        {
          playerId: "2385075",
          card: { id: "pass_2385075", type: "0", type_arg: "0" },
          rect: tablePassRect as any,
          pass: true,
        },
      ],
    };
    const mockGameEl = {
      shadowRoot: {
        querySelector: (sel: string) => {
          if (sel === "tichu-hand") return mockHand;
          if (sel === "tichu-last-played") return mockLastPlayed;
          return null;
        },
      },
    };
    g.document.querySelector = (sel: string) => {
      if (sel === "tichu-game") return mockGameEl;
      if (sel.includes("tichu-player-panel")) {
        panelAccessed = true;
        return { getBadgeRect: () => new MockDOMRect(900, 50, 50, 75) };
      }
      return null;
    };
    g.document.getElementById = (id: string) => {
      if (id.startsWith("player_board_")) {
        panelAccessed = true;
        return { querySelector: () => ({ getBadgeRect: () => new MockDOMRect(900, 50, 50, 75) }) };
      }
      return null;
    };

    const layer = Object.create(TichuAnimationLayer.prototype);
    layer.activeBatches = new Set();
    layer.totalFlights = 0;

    // 1. Self playCombo uses hand card rect
    const selfPrep = layer.preparePlayCombo(2385074, [A5], "5", false);
    assert.equal(selfPrep.isSelf, true);
    assert.equal(selfPrep.fromRects.get(Number(A5.id)), handCardRect);
    assert.equal(selfPrep.fallbackFromRect, handAnchorRect);

    // 2. Opponent playCombo uses #icon_hand_<id> inside <tichu-last-played>, never #player_board_
    const oppPrep = layer.preparePlayCombo(2385075, [B6], "6", false);
    assert.equal(oppPrep.isSelf, false);
    assert.equal(oppPrep.fromRects.size, 0);
    assert.equal(oppPrep.fallbackFromRect, oppHandIconRect);
    assert.equal(panelAccessed, false);

    // 3. Spectator mode treats every seat as opponent (uses #icon_hand_2385074, not hand)
    model.update({ isSpectator: true });
    const specPrep = layer.preparePlayCombo(2385074, [A5], "5", false);
    assert.equal(specPrep.isSelf, false);
    assert.equal(specPrep.fromRects.size, 0);
    assert.notEqual(specPrep.fallbackFromRect, handAnchorRect);
    model.update({ isSpectator: false });

    // Capture flights passed to flyCards
    const recordedFlights: any[][] = [];
    layer.flyCards = (flights: any[], onCleanup?: () => void) => {
      recordedFlights.push(flights);
      onCleanup?.();
      return Promise.resolve();
    };

    // 4. Capture sweep for self -> sweeps both played card and pass card into #icon_star_<id>
    model.update({ lastComboPlayerId: "2385074" });
    layer.runCaptureCardsSweep(2385074);
    assert.equal(recordedFlights.length, 1);
    assert.equal(recordedFlights[0]!.length, 2);
    const selfPassFlight = recordedFlights[0]!.find((f) => f.pass === true);
    const selfWinFlight = recordedFlights[0]!.find((f) => !f.pass);
    assert.ok(selfPassFlight, "Expected pass card to be swept during captureCards");
    assert.equal(selfPassFlight.toRect, selfPointsIconRect);
    assert.equal(selfPassFlight.fadeOut, true);
    assert.equal(selfWinFlight.toRect, selfPointsIconRect);
    assert.ok(
      selfWinFlight.delayMs > selfPassFlight.delayMs,
      "Winning combo should linger after pass cards",
    );

    // 5. Capture sweep for opponent -> sweeps into #icon_star_<id> in <tichu-last-played>, never panel
    layer.runCaptureCardsSweep(2385075);
    assert.equal(recordedFlights.length, 2);
    for (const f of recordedFlights[1]!) {
      assert.equal(f.toRect, oppPointsIconRect);
      assert.equal(f.fadeOut, true);
    }
    assert.equal(panelAccessed, false);

    // 6. applyCaptureCards clears lastCombos immediately so cards cannot flicker back after sweep
    model.applyPlayCombo(2385074, [AA], "Ace", 0, 1, null);
    model.applyPass(2385075);
    assert.equal(model.getState().lastCombos["2385074"]?.cards.length, 1);
    assert.equal(model.getState().lastCombos["2385075"]?.passed, true);
    model.applyCaptureCards(2385074, 25);
    assert.equal(model.getState().players["2385074"]?.capturedPoints, 25);
    assert.equal(model.getState().lastComboPlayerId, "2385074");
    for (const comboState of Object.values(model.getState().lastCombos)) {
      assert.equal(comboState.cards.length, 0);
      assert.equal(comboState.passed, false);
      assert.equal(comboState.description, "");
    }
  });
});

test("Animations::pass-card selection, reset, submit slide-out, and acceptCards flights", async () => {
  await withMockLitEnv(
    async ({ TichuAnimationLayer, TichuLastPlayed, TichuPassArea, TichuStock }) => {
      const g = globalThis as any;
      const model = new GameModel();
      model.hydrateFromGamedatas(
        {
          players: {
            "2385074": { id: "2385074", name: "p0", color: "000000", no: 1, score: "0" } as any,
            "2385075": { id: "2385075", name: "p1", color: "ff0000", no: 2, score: "0" } as any,
            "2385076": { id: "2385076", name: "p2", color: "000000", no: 3, score: "0" } as any,
            "2385077": { id: "2385077", name: "p3", color: "ff0000", no: 4, score: "0" } as any,
          },
          playerorder: ["2385074", "2385075", "2385076", "2385077"],
          gamestate: {
            id: "40",
            name: "giveCards",
            type: "multipleactiveplayer",
            multiactive: ["2385074"],
            args: {},
          } as any,
          hand: [A2, B3, C4, D5],
        },
        "2385074",
        false,
        true,
      );
      g.window.gameModel = model;

      let passVisible = true;
      const pendingPassReveals = new Set<string>();
      const pendingHandReveals = new Set<string>();
      const handRects = new Map<number, DOMRect>([
        [Number(A2.id), new MockDOMRect(100, 620, 100, 150) as any],
        [Number(B3.id), new MockDOMRect(140, 620, 100, 150) as any],
        [Number(C4.id), new MockDOMRect(180, 620, 100, 150) as any],
      ]);
      const slotRects = [
        new MockDOMRect(80, 180, 100, 150),
        new MockDOMRect(260, 140, 100, 150),
        new MockDOMRect(440, 180, 100, 150),
      ];

      const mockPassArea = {
        updateComplete: Promise.resolve(),
        isPassAreaVisible: () => passVisible,
        markPendingReveal: (ids: Array<string | number>) => {
          ids.forEach((id) => pendingPassReveals.add(String(id)));
        },
        revealCards: (ids?: Array<string | number>) => {
          if (!ids) pendingPassReveals.clear();
          else ids.forEach((id) => pendingPassReveals.delete(String(id)));
        },
        getSlotCardTargetRect: (idx: number) => slotRects[idx] ?? null,
        getSlotCardRectByPlayerId: (pid: string | number) => {
          const idx = model.getState().passSlots.findIndex((s) => s.playerId === String(pid));
          return idx >= 0 ? (slotRects[idx] ?? null) : null;
        },
        getReceivedCardRects: () => new Map<number, DOMRect>(),
        getGivenCardRects: (cardIds?: Array<string | number>) => {
          const res = new Map<number, DOMRect>();
          const filter = cardIds ? new Set(cardIds.map(Number)) : null;
          model.getState().passSlots.forEach((slot, idx) => {
            if (!slot.givenCard) return;
            const nId = Number(slot.givenCard.id);
            if (filter && !filter.has(nId)) return;
            res.set(nId, slotRects[idx]! as any);
          });
          return res;
        },
      };
      const mockHand = {
        updateComplete: Promise.resolve(),
        getStock: () => ({ updateComplete: Promise.resolve() }),
        getCardRects: (ids: Array<string | number>) => {
          const res = new Map<number, DOMRect>();
          for (const id of ids) {
            const r = handRects.get(Number(id));
            if (r) res.set(Number(id), r);
          }
          return res;
        },
        getHandAnchorRect: () => new MockDOMRect(200, 620, 100, 150),
        markPendingReveal: (ids: Array<string | number>) => {
          ids.forEach((id) => pendingHandReveals.add(String(id)));
        },
        revealCards: (ids?: Array<string | number>) => {
          if (!ids) pendingHandReveals.clear();
          else ids.forEach((id) => pendingHandReveals.delete(String(id)));
        },
      };
      const mockGameEl = {
        shadowRoot: {
          querySelector: (sel: string) => {
            if (sel === "tichu-pass-area") return mockPassArea;
            if (sel === "tichu-hand") return mockHand;
            return null;
          },
        },
      };

      const layer = Object.create(TichuAnimationLayer.prototype);
      layer.activeBatches = new Set();
      layer.totalFlights = 0;
      const flownBatches: any[][] = [];
      layer.flyCards = (flights: any[], onCleanup?: () => void) => {
        flownBatches.push(flights);
        onCleanup?.();
        return Promise.resolve();
      };
      layer.canAnimate = () => true;

      g.document.querySelector = (sel: string) => {
        if (sel === "tichu-animation-layer") return layer;
        if (sel === "tichu-game") return mockGameEl;
        return null;
      };

      // 1. Selecting a pass card triggers hand -> pass slot flight
      model.setSelectedCardIds([A2.id]);
      model.toggleGiveCardSlot(0);
      await new Promise((r) => setTimeout(r, 0));
      assert.equal(flownBatches.length, 1);
      assert.equal(flownBatches[0]![0].fromRect, handRects.get(Number(A2.id)));
      assert.equal(flownBatches[0]![0].toRect, slotRects[0]);
      assert.equal(pendingPassReveals.size, 0);

      // 2. Unselecting a pass card triggers pass slot -> hand flight
      model.toggleGiveCardSlot(0);
      await new Promise((r) => setTimeout(r, 0));
      assert.equal(flownBatches.length, 2);
      assert.equal(flownBatches[1]![0].fromRect, slotRects[0]);
      assert.equal(flownBatches[1]![0].toRect, handRects.get(Number(A2.id)));
      assert.equal(pendingHandReveals.size, 0);

      // 3. Stage 3 cards and reset -> flies all 3 back to hand
      model.setSelectedCardIds([A2.id]);
      model.toggleGiveCardSlot(0);
      model.setSelectedCardIds([B3.id]);
      model.toggleGiveCardSlot(1);
      model.setSelectedCardIds([C4.id]);
      model.toggleGiveCardSlot(2);
      await new Promise((r) => setTimeout(r, 0));
      const batchesBeforeReset = flownBatches.length;
      model.resetPassCards();
      await new Promise((r) => setTimeout(r, 0));
      assert.equal(flownBatches.length, batchesBeforeReset + 1);
      assert.equal(flownBatches[flownBatches.length - 1]!.length, 3);

      // 4. Submit passCards -> slides staged cards upward & fades out
      model.setSelectedCardIds([A2.id]);
      model.toggleGiveCardSlot(0);
      model.setSelectedCardIds([B3.id]);
      model.toggleGiveCardSlot(1);
      model.setSelectedCardIds([C4.id]);
      model.toggleGiveCardSlot(2);
      await new Promise((r) => setTimeout(r, 0));
      const batchesBeforeOut = flownBatches.length;
      const outRes = layer.runPassCardsOutFlight([A2.id, B3.id, C4.id]);
      assert.ok(outRes.durationMs >= 200);
      assert.equal(flownBatches.length, batchesBeforeOut + 1);
      const outFlights = flownBatches[flownBatches.length - 1]!;
      assert.equal(outFlights.length, 3);
      assert.equal(outFlights[0].fadeOut, true);
      assert.equal(outFlights[0].toRect.top, outFlights[0].fromRect.top - 60);

      // 5. acceptCards timing & flight when passArea is visible -> uses slot rects by passed_from with 0ms delay (viewDelay happens before prepareAcceptCards)
      const timing = layer.getAcceptCardsTiming(3);
      assert.equal(timing.viewDelayMs, 850);
      assert.equal(timing.flightDurationMs, 269);
      assert.equal(timing.totalDurationMs, 1119);

      const slots = model.getState().passSlots;
      const recv0 = { ...D6, passed_from: slots[0]!.playerId };
      const recv1 = { ...A7, passed_from: slots[1]!.playerId };
      const recv2 = { ...B8, passed_from: slots[2]!.playerId };
      const acceptPrep = layer.prepareAcceptCards([recv0, recv1, recv2]);
      assert.equal(acceptPrep.fromRects.size, 3);
      assert.equal(acceptPrep.fromRects.get(Number(recv0.id)), slotRects[0]);
      assert.equal(acceptPrep.fromRects.get(Number(recv1.id)), slotRects[1]);
      assert.equal(acceptPrep.fromRects.get(Number(recv2.id)), slotRects[2]);
      await layer.runAcceptCardsFlight([recv0, recv1, recv2], acceptPrep.fromRects);
      const acceptFlights = flownBatches[flownBatches.length - 1]!;
      assert.equal(acceptFlights.length, 3);
      assert.equal(acceptFlights[0].delayMs, 0);
      assert.equal(acceptFlights[1].delayMs, 22);
      assert.equal(acceptFlights[2].delayMs, 44);

      // 6. acceptCards when passArea is NOT visible -> skips animation completely
      passVisible = false;
      const hiddenPrep = layer.prepareAcceptCards([recv0, recv1, recv2]);
      assert.equal(hiddenPrep.fromRects.size, 0);
      assert.equal(pendingHandReveals.size, 0);
      const countBeforeHidden = flownBatches.length;
      await layer.runAcceptCardsFlight([recv0, recv1, recv2], hiddenPrep.fromRects);
      assert.equal(flownBatches.length, countBeforeHidden);

      // 7. TichuLastPlayed.getAllTableComboCards includes pass:true from pass stocks
      const passStock = Object.create(TichuStock.prototype);
      Object.defineProperties(passStock, {
        pass: { value: true, configurable: true },
        cards: { value: [], configurable: true },
        getAttribute: {
          value: (k: string) => (k === "data-player-id" ? "2385075" : null),
        },
        shadowRoot: {
          value: {
            querySelector: () => ({
              shadowRoot: {
                getElementById: () => ({
                  getBoundingClientRect: () => new MockDOMRect(50, 60, 75, 112.5),
                }),
              },
            }),
          },
        },
      });
      const fakeLastPlayed = Object.create(TichuLastPlayed.prototype);
      Object.defineProperty(fakeLastPlayed, "shadowRoot", {
        value: {
          querySelectorAll: () => [passStock],
          getElementById: (id: string) =>
            id === "icon_hand_2385075"
              ? { getBoundingClientRect: () => new MockDOMRect(10, 20, 16, 16) }
              : id === "icon_star_2385075"
                ? { getBoundingClientRect: () => new MockDOMRect(50, 20, 16, 16) }
                : null,
        },
      });
      const allEntries = fakeLastPlayed.getAllTableComboCards();
      assert.equal(allEntries.length, 1);
      assert.equal(allEntries[0].pass, true);
      assert.equal(allEntries[0].playerId, "2385075");
      const handAnchor = fakeLastPlayed.getPlayerHandIconRect(2385075);
      const ptsAnchor = fakeLastPlayed.getPlayerPointsIconRect(2385075);
      assert.equal(handAnchor.left, 10 + 8 - 29);
      assert.equal(ptsAnchor.left, 50 + 8 - 18);

      // 8. TichuPassArea.getSlotCardTargetRect computes exact (left+20*zoom, top+84*zoom, 100*zoom, 150*zoom)
      g.document.getElementById = (id: string) =>
        id === "game_play_area_wrap" ? { style: { transform: "scale(0.8)" } } : null;
      const fakePassArea = Object.create(TichuPassArea.prototype);
      Object.defineProperty(fakePassArea, "shadowRoot", {
        value: {
          getElementById: (id: string) =>
            id === "playertable_1"
              ? { getBoundingClientRect: () => new MockDOMRect(100, 200, 112, 168) }
              : null,
        },
      });
      const targetRect = fakePassArea.getSlotCardTargetRect(0);
      assert.equal(targetRect.left, 100 + 20 * 0.8);
      assert.equal(targetRect.top, 200 + 84 * 0.8);
      assert.equal(targetRect.width, 100 * 0.8);
      assert.equal(targetRect.height, 150 * 0.8);
    },
  );
});

test("Animations preference (105): readPrefs, onPreferenceChange, changeAnimations, shouldAnimate, and bet splash gating", async () => {
  await withMockLitEnv(() => {
    const g = globalThis as any;
    const { shouldAnimate } = require("../src/elements/tichu-animation-layer");
    const { Tichu, declaredClass } = loadTichuAdapterForNodeTests();

    const savedGameModel = g.window.gameModel;
    const savedGameUi = g.window.gameui;
    const savedPlaySound = g.playSound;
    const savedHidden = g.document.hidden;
    const savedVisibilityState = g.document.visibilityState;
    try {
      const ui = new (declaredClass || Tichu)();
      ui.player_id = 2385074;
      ui.isSpectator = false;
      ui.bgaAnimationsActive = () => true;
      ui.isReadOnly = () => false;
      ui.isCurrentPlayerActive = () => false;
      ui.removeActionButtons = () => {};
      ui.onUpdateActionButtons = () => {};
      ui.updatePageTitle = () => {};
      const persistedPrefs: Array<[number, number]> = [];
      ui.prefs = { 105: { value: 2 } };
      ui.getGameUserPreference = (id: number) => (id === 105 ? ui.prefs[105].value : 1);
      ui.setGameUserPreference = (id: number, val: number) => {
        persistedPrefs.push([id, val]);
        ui.prefs[id] = { value: val };
      };
      const syncDurations: number[] = [];
      ui.notifqueue = {
        setSynchronousDuration(ms: number) {
          syncDurations.push(ms);
        },
      };
      let cancelledLayerCalls = 0;
      ui.getAnimationLayer = () => ({
        cancelAll() {
          cancelledLayerCalls++;
        },
      });
      ui.gamedatas = {
        players: {
          "2385074": {
            id: "2385074",
            name: "p0",
            color: "000000",
            no: 1,
            score: "0",
            call_grand_tichu: "0",
            call_tichu: "-1",
          },
          "2385075": {
            id: "2385075",
            name: "p1",
            color: "ff0000",
            no: 2,
            score: "0",
            call_grand_tichu: "0",
            call_tichu: "-1",
          },
        },
        gamestate: {
          id: "50",
          name: "playCombo",
          type: "activeplayer",
          active_player: "2385074",
          args: {},
        },
        hand: [],
      };

      const prefs = ui.readPrefs();
      assert.equal(prefs[105], 2);
      assert.equal(prefs.animationsEnabled, false);

      const model = new GameModel();
      model.hydrateFromGamedatas(ui.gamedatas, "2385074", false, true, prefs);
      g.window.gameModel = model;
      g.window.gameui = ui;

      assert.equal(model.getState().animationsEnabled, false);
      assert.equal(ui.areAnimationsActive(), false);
      assert.equal(ui.shouldAnimate(), false);
      assert.equal(shouldAnimate(), false);

      let laserPlayed = 0;
      g.playSound = () => {
        laserPlayed++;
      };
      // Disabling Animations (pref 105 = 2) skips visual bet splash, but keeps Tichu sound active
      ui.notif_tichuBet({ args: { player_id: 2385074, bet: Bet.TICHU } });
      assert.equal(model.getState().betAnimations.length, 0);
      assert.equal(laserPlayed, 1);
      assert.equal(syncDurations.at(-1), 1);

      // Re-enable via BGA preference callback
      ui.onPreferenceChange(105, 1);
      assert.equal(model.getState().animationsEnabled, true);
      assert.equal(ui.areAnimationsActive(), true);
      assert.equal(ui.shouldAnimate(), true);
      assert.equal(shouldAnimate(), true);

      // Toggle off via in-hand widget handler -> updates model, cancels layer, persists pref 105 = 2,
      // skips visual splash while still playing Grand Tichu sound
      ui.changeAnimations(false);
      assert.equal(model.getState().animationsEnabled, false);
      assert.equal(cancelledLayerCalls, 1);
      assert.deepEqual(persistedPrefs.at(-1), [105, 2]);
      assert.equal(shouldAnimate(), false);
      ui.notif_grandTichuBet({ args: { player_id: 2385075, bet: Bet.GRAND_TICHU } });
      assert.equal(model.getState().betAnimations.length, 0);
      assert.equal(laserPlayed, 2);
      assert.equal(syncDurations.at(-1), 1);

      // Background tab, instantaneousMode, and bgaAnimationsActive() === false keep sound muted
      g.document.hidden = true;
      g.document.visibilityState = "hidden";
      ui.notif_tichuBet({ args: { player_id: 2385074, bet: Bet.TICHU } });
      assert.equal(laserPlayed, 2);
      g.document.hidden = false;
      g.document.visibilityState = "visible";

      ui.instantaneousMode = true;
      ui.notif_grandTichuBet({ args: { player_id: 2385075, bet: Bet.GRAND_TICHU } });
      assert.equal(laserPlayed, 2);
      ui.instantaneousMode = false;

      ui.bgaAnimationsActive = () => false;
      ui.notif_tichuBet({ args: { player_id: 2385075, bet: Bet.TICHU } });
      assert.equal(laserPlayed, 2);
      ui.bgaAnimationsActive = () => true;

      // Re-enable via changeAnimations(true) -> bet splash and sound trigger when enabled
      ui.changeAnimations(true);
      assert.deepEqual(persistedPrefs.at(-1), [105, 1]);
      assert.equal(shouldAnimate(), true);
      ui.notif_tichuBet({ args: { player_id: 2385075, bet: Bet.TICHU } });
      assert.equal(model.getState().betAnimations.length, 1);
      assert.equal(laserPlayed, 3);
      assert.equal(syncDurations.at(-1), 600);
    } finally {
      g.document.hidden = savedHidden;
      g.document.visibilityState = savedVisibilityState;
      g.window.gameModel = savedGameModel;
      g.window.gameui = savedGameUi;
      g.playSound = savedPlaySound;
    }
  });
});

test("TichuReplay::tidyUpGamelogs and segmentNotifMoves isolate batched bot moves, pre-trick phases, and round transitions", async () => {
  await withMockLitEnv(() => {
    const {
      tidyUpGamelogs,
      segmentNotifMoves,
    }: {
      tidyUpGamelogs: (logs: any[]) => void;
      segmentNotifMoves: (notifs: any[]) => void;
    } = require("../src/elements/tichu-replay");

    const P0 = 2385074;
    const P1 = 2385075;
    const P2 = 2385076;
    const P3 = 2385077;

    let uidCounter = 1;
    const n = (type: string, args: any = {}) => ({
      uid: `u${uidCounter++}`,
      type,
      log: "",
      args,
    });
    const pkt = (channel: string, moveId: string, data: any[]) => ({
      packet_id: String(uidCounter),
      packet_type: "single" as const,
      channel,
      move_id: moveId,
      data,
    });

    const gamelogs: any[] = [
      // Index 0 ignored packet must be stripped even at position 0
      pkt("/table/t1", "1", [n("log")]),
      // Round 1: initial 8 cards + multiactive update
      pkt(`/player/p${P0}`, "1", [n("dealCards", { cards: [{ id: "1", location_arg: P0 }] })]),
      pkt(`/player/p${P1}`, "1", [n("dealCards", { cards: [{ id: "2", location_arg: P1 }] })]),
      pkt(`/player/p${P2}`, "1", [n("dealCards", { cards: [{ id: "3", location_arg: P2 }] })]),
      pkt(`/player/p${P3}`, "1", [n("dealCards", { cards: [{ id: "4", location_arg: P3 }] })]),
      pkt("/table/t1", "1", [
        n("gameStateChange", { type: "game" }),
        n("gameStateMultipleActiveUpdate", [String(P0), String(P1), String(P2), String(P3)]),
      ]),
      // Grand Tichu bets split across move_ids 2 and 3
      pkt("/table/t1", "2", [
        n("grandTichuBet", { player_id: P0, bet: 0 }),
        n("gameStateMultipleActiveUpdate", [String(P1), String(P2), String(P3)]),
        n("grandTichuBet", { player_id: P1, bet: 0 }),
      ]),
      pkt("/table/t1", "3", [
        n("grandTichuBet", { player_id: P2, bet: 0 }),
        n("grandTichuBet", { player_id: P3, bet: 200 }),
      ]),
      // Round 1: last 6 cards
      pkt(`/player/p${P0}`, "3", [n("dealCards", { cards: [{ id: "5", location_arg: P0 }] })]),
      pkt(`/player/p${P1}`, "3", [n("dealCards", { cards: [{ id: "6", location_arg: P1 }] })]),
      pkt(`/player/p${P2}`, "3", [n("dealCards", { cards: [{ id: "7", location_arg: P2 }] })]),
      pkt(`/player/p${P3}`, "3", [n("dealCards", { cards: [{ id: "8", location_arg: P3 }] })]),
      // Pass cards: 3 separate, 4th joined with acceptCards, plus /table/t1 activeplayer transition
      pkt(`/player/p${P1}`, "4", [n("passCards", { cardIds: ["2", "6", "10"] })]),
      pkt("/table/t1", "4", [
        n("gameStateMultipleActiveUpdate", [String(P0), String(P2), String(P3)]),
      ]),
      pkt(`/player/p${P2}`, "4", [n("passCards", { cardIds: ["3", "7", "11"] })]),
      pkt(`/player/p${P3}`, "4", [n("passCards", { cardIds: ["4", "8", "12"] })]),
      pkt(`/player/p${P0}`, "5", [
        n("passCards", { cardIds: ["1", "5", "9"] }),
        n("gameStateChange", { type: "game" }),
        n("acceptCards", {}),
      ]),
      pkt(`/player/p${P1}`, "5", [n("acceptCards", {})]),
      pkt(`/player/p${P2}`, "5", [n("acceptCards", {})]),
      pkt(`/player/p${P3}`, "5", [n("acceptCards", {})]),
      pkt("/table/t1", "5", [n("gameStateChange", { type: "activeplayer", active_player: P1 })]),
      // Trick play batched into a single server move_id ("6"):
      //   - P1 calls Tichu, plays Mahjong, makes a wish
      //   - P2 calls Tichu out of turn, then P3 grants wish (with implicit tichuBet=0) and plays
      //   - P0 and P1 pass, then P3 captures trick
      pkt("/table/t1", "6", [
        n("tichuBet", { player_id: P1, bet: 100 }),
        n("playCombo", { player_id: P1, cards: [MJ], points: 0 }),
        n("wishMade", { player_id: P1, wish: 5 }),
        n("gameStateChange", { type: "activeplayer", active_player: P2 }),
        n("tichuBet", { player_id: P2, bet: 100 }),
        n("mahjongWishGranted", {}),
        n("tichuBet", { player_id: P3, bet: 0 }),
        n("playCombo", { player_id: P3, cards: [A5], points: 5 }),
        n("gameStateChange", { type: "activeplayer", active_player: P0 }),
        n("pass", { player_id: P0 }),
        n("pass", { player_id: P1 }),
        n("captureCards", { player_id: P3, trick_value: 5 }),
      ]),
      // Round-ending play + capture + newScores + Round 2 initial deal batched into move_id "7":
      pkt("/table/t1", "7", [
        n("playCombo", { player_id: P3, cards: [DR], points: 25 }),
        n("playerGoOut", { player_id: P3, firstout_id: P3 }),
        n("captureCards", { player_id: P3, trick_value: 25 }),
        n("tableWindow", {}),
        n("newScores", { newScores: { [P0]: 0, [P1]: 200, [P2]: 0, [P3]: 200 } }),
      ]),
      pkt(`/player/p${P0}`, "7", [n("dealCards", { cards: [{ id: "13", location_arg: P0 }] })]),
      pkt(`/player/p${P1}`, "7", [n("dealCards", { cards: [{ id: "14", location_arg: P1 }] })]),
      pkt(`/player/p${P2}`, "7", [n("dealCards", { cards: [{ id: "15", location_arg: P2 }] })]),
      pkt(`/player/p${P3}`, "7", [n("dealCards", { cards: [{ id: "16", location_arg: P3 }] })]),
    ];

    tidyUpGamelogs(gamelogs);
    const notifs: any[] = [];
    for (const packet of gamelogs) {
      const player_id = packet.channel.startsWith("/player/p")
        ? Number(packet.channel.substring(9))
        : -1;
      for (const d of packet.data) {
        notifs.push({ ...d, player_id, move_id: packet.move_id });
      }
    }
    segmentNotifMoves(notifs);

    const moves: string[][] = [];
    for (const notif of notifs) {
      if (
        notif.type === "log" ||
        notif.type === "playerGoOut" ||
        notif.type === "tableWindow" ||
        (notif.type === "gameStateChange" && notif.args?.type === "game")
      ) {
        continue;
      }
      const prevMove = moves.at(-1);
      const pid =
        notif.args?.player_id ??
        notif.args?.active_player ??
        (notif.player_id > 0 ? notif.player_id : undefined);
      const tag = `${notif.type}${pid ? `:${pid}` : ""}`;
      const moveIdx = Number(notif.move_id) - 1;
      if (!prevMove || moves.length <= moveIdx) {
        while (moves.length <= moveIdx) moves.push([]);
      }
      moves[moveIdx]!.push(tag);
    }

    assert.deepEqual(moves, [
      // Move 1: Round 1 initial 8-card deal
      [
        "gameStateMultipleActiveUpdate",
        `dealCards:${P0}`,
        `dealCards:${P1}`,
        `dealCards:${P2}`,
        `dealCards:${P3}`,
      ],
      // Move 2: Grand Tichu bets
      [
        `grandTichuBet:${P0}`,
        "gameStateMultipleActiveUpdate",
        `grandTichuBet:${P1}`,
        `grandTichuBet:${P2}`,
        `grandTichuBet:${P3}`,
      ],
      // Move 3: Round 1 last 6-card deal
      [`dealCards:${P0}`, `dealCards:${P1}`, `dealCards:${P2}`, `dealCards:${P3}`],
      // Move 4: Pass cards (all 4 passCards together, before acceptCards)
      [
        `passCards:${P1}`,
        "gameStateMultipleActiveUpdate",
        `passCards:${P2}`,
        `passCards:${P3}`,
        `passCards:${P0}`,
      ],
      // Move 5: Accept cards + playComboOpen activeplayer transition
      [
        `gameStateChange:${P1}`,
        `acceptCards:${P0}`,
        `acceptCards:${P1}`,
        `acceptCards:${P2}`,
        `acceptCards:${P3}`,
      ],
      // Move 6: P1 Tichu + Mahjong play + wishMade + activeplayer transition
      [`tichuBet:${P1}`, `playCombo:${P1}`, `wishMade:${P1}`, `gameStateChange:${P2}`],
      // Move 7: P2 out-of-turn Tichu bet is NOT merged into P3's play
      [`tichuBet:${P2}`],
      // Move 8: P3 wish grant + implicit tichuBet(0) + playCombo + activeplayer transition
      ["mahjongWishGranted", `tichuBet:${P3}`, `playCombo:${P3}`, `gameStateChange:${P0}`],
      // Moves 9-11: Each pass and captureCards in its own step
      [`pass:${P0}`],
      [`pass:${P1}`],
      [`captureCards:${P3}`],
      // Move 12: Round-ending playCombo
      [`playCombo:${P3}`],
      // Move 13: Round-ending captureCards
      [`captureCards:${P3}`],
      // Move 14: Round transition newScores + Round 2 initial deal
      ["newScores", `dealCards:${P0}`, `dealCards:${P1}`, `dealCards:${P2}`, `dealCards:${P3}`],
    ]);
  });
});

test("notif_acceptCards keeps received-cards view visible even when animations pref 105 is disabled, and survives leaving giveCards", async () => {
  await withMockLitEnv(() => {
    const g = globalThis as any;
    const { Tichu, declaredClass } = loadTichuAdapterForNodeTests();

    const savedGameModel = g.window.gameModel;
    const savedGameUi = g.window.gameui;
    const savedWinSetTimeout = g.window.setTimeout;
    const savedGlobalClearTimeout = g.clearTimeout;

    try {
      const scheduled: Array<{ id: number; delay: number; fn: () => void; cleared: boolean }> = [];
      let nextTimerId = 100;
      g.window.setTimeout = (fn: () => void, delay = 0) => {
        const entry = { id: nextTimerId++, delay: Number(delay), fn, cleared: false };
        scheduled.push(entry);
        return entry.id;
      };
      g.clearTimeout = (id: any) => {
        const found = scheduled.find((t) => t.id === id);
        if (found) found.cleared = true;
      };

      const hand11 = [A2, B2, C2, D2, A3, B3, C3, D3, A4, B4, C4];
      const received3 = [
        { ...D6, passed_from: "2385077" },
        { ...A7, passed_from: "2385076" },
        { ...B8, passed_from: "2385075" },
      ];

      const setupScenario = (pref105: number) => {
        const ui = new (declaredClass || Tichu)();
        ui.player_id = 2385074;
        ui.isSpectator = false;
        ui.instantaneousMode = false;
        ui.bgaAnimationsActive = () => true;
        ui.isReadOnly = () => false;
        ui.isCurrentPlayerActive = () => false;
        ui.removeActionButtons = () => {};
        ui.onUpdateActionButtons = () => {};
        ui.updatePageTitle = () => {};
        ui.prefs = { 105: { value: pref105 } };
        ui.getGameUserPreference = (id: number) => (id === 105 ? ui.prefs[105].value : 1);

        const syncDurations: number[] = [];
        ui.notifqueue = {
          setSynchronousDuration(ms: number) {
            syncDurations.push(ms);
          },
        };

        let prepareCalls = 0;
        let runCalls = 0;
        const fakeFromRects = new Map<number, DOMRect>([
          [Number(D6.id), { left: 10, top: 10, width: 100, height: 150 } as any],
        ]);
        ui.getAnimationLayer = () => ({
          cancelAll() {},
          getAcceptCardsTiming() {
            return { viewDelayMs: 850, flightDurationMs: 269, totalDurationMs: 1119 };
          },
          prepareAcceptCards() {
            prepareCalls++;
            return { fromRects: fakeFromRects, durationMs: 269 };
          },
          runAcceptCardsFlight() {
            runCalls++;
            return Promise.resolve();
          },
        });

        ui.gamedatas = {
          players: {
            "2385074": { id: "2385074", name: "p0", color: "000000", no: 1, score: "0" },
            "2385075": { id: "2385075", name: "p1", color: "ff0000", no: 2, score: "0" },
            "2385076": { id: "2385076", name: "p2", color: "000000", no: 3, score: "0" },
            "2385077": { id: "2385077", name: "p3", color: "ff0000", no: 4, score: "0" },
          },
          gamestate: { id: "40", name: "giveCards", type: "multipleactiveplayer", args: {} },
          hand: [...hand11],
        };

        const model = new GameModel();
        model.hydrateFromGamedatas(ui.gamedatas, "2385074", false, true, ui.readPrefs());
        g.window.gameModel = model;
        g.window.gameui = ui;

        return {
          ui,
          model,
          syncDurations,
          getPrepareCalls: () => prepareCalls,
          getRunCalls: () => runCalls,
        };
      };

      // 1. Animations enabled (pref 105 = 1)
      {
        const s = setupScenario(1);
        const beforeLen = scheduled.length;
        s.ui.notif_acceptCards({ args: { cards: received3 } });
        assert.equal(s.model.getState().hand.length, 11);
        assert.deepEqual(
          s.model.getState().passSlots.map((slot) => slot.receivedCard?.id),
          [D6.id, A7.id, B8.id],
        );
        assert.equal(s.syncDurations.at(-1), 1119);
        assert.equal(scheduled.length, beforeLen + 1);
        const timer = scheduled[beforeLen]!;
        assert.equal(timer.delay, 850);

        // Leaving giveCards must NOT cancel the pending received-cards display timer
        s.ui.onLeavingState("giveCards");
        assert.equal(timer.cleared, false);
        assert.equal(s.model.getState().hand.length, 11);

        // Once the view delay completes, prepareAcceptCards + finishAcceptCards + runAcceptCardsFlight run
        timer.fn();
        assert.equal(s.getPrepareCalls(), 1);
        assert.equal(s.getRunCalls(), 1);
        assert.equal(s.model.getState().hand.length, 14);
        assert.deepEqual(
          s.model.getState().passSlots.map((slot) => slot.receivedCard),
          [null, null, null],
        );

        // Entering acceptPassedCards after finishAcceptCards must not re-populate passSlots
        s.model.enterShowPassedCards(received3);
        assert.deepEqual(
          s.model.getState().passSlots.map((slot) => slot.receivedCard),
          [null, null, null],
        );
      }

      // 2. Animations disabled (pref 105 = 2) -> view still shown for 850ms, no flight
      {
        const s = setupScenario(2);
        assert.equal(s.ui.shouldAnimate(), false);
        assert.equal(s.ui.shouldSkipReceivedCardsView(), false);
        const beforeLen = scheduled.length;
        s.ui.notif_acceptCards({ args: { cards: received3 } });
        assert.equal(s.model.getState().hand.length, 11);
        assert.deepEqual(
          s.model.getState().passSlots.map((slot) => slot.receivedCard?.id),
          [D6.id, A7.id, B8.id],
        );
        assert.equal(s.syncDurations.at(-1), 850);
        assert.equal(scheduled.length, beforeLen + 1);
        const timer = scheduled[beforeLen]!;
        assert.equal(timer.delay, 850);

        timer.fn();
        assert.equal(s.getPrepareCalls(), 0);
        assert.equal(s.getRunCalls(), 0);
        assert.equal(s.model.getState().hand.length, 14);
        assert.deepEqual(
          s.model.getState().passSlots.map((slot) => slot.receivedCard),
          [null, null, null],
        );
      }

      // 3. instantaneousMode = true -> flushes immediately without waiting 1200ms
      {
        const s = setupScenario(1);
        s.ui.instantaneousMode = true;
        assert.equal(s.ui.shouldSkipReceivedCardsView(), true);
        const beforeLen = scheduled.length;
        s.ui.notif_acceptCards({ args: { cards: received3 } });
        assert.equal(scheduled.length, beforeLen);
        assert.equal(s.syncDurations.at(-1), 1);
        assert.equal(s.model.getState().hand.length, 14);
        assert.deepEqual(
          s.model.getState().passSlots.map((slot) => slot.receivedCard),
          [null, null, null],
        );
      }
    } finally {
      g.window.gameModel = savedGameModel;
      g.window.gameui = savedGameUi;
      g.window.setTimeout = savedWinSetTimeout;
      g.clearTimeout = savedGlobalClearTimeout;
    }
  });
});

test("Legacy playCombo notification fallback (rollback & archive compatibility)", () => {
  const phoenixCard = card(TYPE_PHOENIX, 1);
  const basePlayers = {
    1: {
      id: 1,
      name: "P1",
      color: "000000",
      no: 1,
      score: 0,
      call_tichu: "-1",
      call_grand_tichu: "-1",
      pass: "0",
    },
    2: {
      id: 2,
      name: "P2",
      color: "ff0000",
      no: 2,
      score: 0,
      call_tichu: "-1",
      call_grand_tichu: "-1",
      pass: "0",
    },
    3: {
      id: 3,
      name: "P3",
      color: "000000",
      no: 3,
      score: 0,
      call_tichu: "-1",
      call_grand_tichu: "-1",
      pass: "0",
    },
    4: {
      id: 4,
      name: "P4",
      color: "ff0000",
      no: 4,
      score: 0,
      call_tichu: "-1",
      call_grand_tichu: "-1",
      pass: "0",
    },
  };

  // 1. Single King (13) followed by Single Phoenix with omitted type/phoenixValue and non-English combo_name
  {
    const model = new GameModel();
    model.hydrateFromGamedatas(
      {
        players: basePlayers as any,
        hand: [card(1, 5), card(2, 14)],
        handcount: { 1: 2, 2: 5, 3: 5, 4: 5 },
      },
      1,
      false,
      true,
    );
    model.applyPlayCombo(2, [card(1, 13)], "Roi", 10);
    model.applyPlayCombo(3, [phoenixCard], "Phénix", -25);

    const last = model.getState().trickLastCombo;
    assert.equal(last.type, SINGLE_COMBO);
    assert.equal(last.phoenixValue, 13.5);
    const parsed = Combo.fromLastComboState(last);
    assert.equal(parsed.type, SINGLE_COMBO);
    assert.equal(parsed.phoenixValue, 13.5);

    // Hand has a 5 and Ace; since Single Phoenix is 13.5 (not 1.5!), Ace beats it, 5 does not -> Pass allowed even with wish=5
    const passCheck = validatePassAction(model.getState().hand, parsed, 5);
    assert.equal(passCheck.canPass, true);
  }

  // 2. Ambiguous Straight with omitted type/phoenixValue and non-English combo_name:
  //    server places Phoenix at end for high option ([5,6,7,8,Ph] => 5..9) and at start for low option ([Ph,5,6,7,8] => 4..8)
  {
    const highCards = [card(1, 5), card(2, 6), card(3, 7), card(4, 8), phoenixCard];
    const modelHigh = new GameModel();
    modelHigh.hydrateFromGamedatas({ players: basePlayers as any, hand: [] }, 1, false, true);
    modelHigh.applyPlayCombo(2, highCards, "Suite de 5 à 9", 5);
    assert.equal(modelHigh.getState().trickLastCombo.type, STRAIGHT_COMBO);
    assert.equal(modelHigh.getState().trickLastCombo.phoenixValue, 9);
    const highLast = Combo.fromLastComboState({
      cards: highCards,
      type: 0,
      phoenixValue: null,
      description: "Suite de 5 à 9",
    });
    assert.equal(highLast.phoenixValue, 9);
    assert.equal(highLast.getFirstValue(), 5);
    const straight5to9 = new Combo([card(1, 5), card(2, 6), card(3, 7), card(4, 8), card(1, 9)]);
    const straight6to10 = new Combo([card(1, 6), card(2, 7), card(3, 8), card(4, 9), card(1, 10)]);
    assert.equal(straight5to9.canBeat(highLast), false);
    assert.equal(straight6to10.canBeat(highLast), true);

    const lowCards = [phoenixCard, card(1, 5), card(2, 6), card(3, 7), card(4, 8)];
    const modelLow = new GameModel();
    modelLow.hydrateFromGamedatas({ players: basePlayers as any, hand: [] }, 1, false, true);
    modelLow.applyPlayCombo(2, lowCards, "Suite de 4 à 8", 5);
    assert.equal(modelLow.getState().trickLastCombo.type, STRAIGHT_COMBO);
    assert.equal(modelLow.getState().trickLastCombo.phoenixValue, 4);
    const lowLast = Combo.fromLastComboState({
      cards: lowCards,
      type: 0,
      phoenixValue: null,
      description: "Suite de 4 à 8",
    });
    assert.equal(lowLast.phoenixValue, 4);
    assert.equal(lowLast.getFirstValue(), 4);
    assert.equal(straight5to9.canBeat(lowLast), true);
  }

  // 3. Ambiguous Full House with omitted type/phoenixValue and non-English combo_name:
  //    server places [Phoenix, tripleRank, tripleRank, pairRank, pairRank]
  {
    const fhSevensCards = [phoenixCard, card(1, 7), card(2, 7), card(1, 8), card(2, 8)];
    const modelSevens = new GameModel();
    modelSevens.hydrateFromGamedatas({ players: basePlayers as any, hand: [] }, 1, false, true);
    modelSevens.applyPlayCombo(2, fhSevensCards, "Full aux 7 par les 8", 0);
    assert.equal(modelSevens.getState().trickLastCombo.type, FULL_HOUSE_COMBO);
    assert.equal(modelSevens.getState().trickLastCombo.phoenixValue, 7);
    const sevensLast = Combo.fromLastComboState({
      cards: fhSevensCards,
      type: 0,
      phoenixValue: null,
      description: "Full aux 7 par les 8",
    });
    assert.equal(sevensLast.phoenixValue, 7);
    assert.equal(sevensLast.getFirstValue(), 7);
    const fhEightsOverTwos = new Combo([
      card(1, 8),
      card(2, 8),
      card(3, 8),
      card(1, 2),
      card(2, 2),
    ]);
    assert.equal(fhEightsOverTwos.canBeat(sevensLast), true);

    const fhEightsCards = [phoenixCard, card(1, 8), card(2, 8), card(1, 7), card(2, 7)];
    const modelEights = new GameModel();
    modelEights.hydrateFromGamedatas({ players: basePlayers as any, hand: [] }, 1, false, true);
    modelEights.applyPlayCombo(2, fhEightsCards, "Full aux 8 par les 7", 0);
    assert.equal(modelEights.getState().trickLastCombo.type, FULL_HOUSE_COMBO);
    assert.equal(modelEights.getState().trickLastCombo.phoenixValue, 8);
    const eightsLast = Combo.fromLastComboState({
      cards: fhEightsCards,
      type: 0,
      phoenixValue: null,
      description: "Full aux 8 par les 7",
    });
    assert.equal(eightsLast.phoenixValue, 8);
    assert.equal(eightsLast.getFirstValue(), 8);
    assert.equal(fhEightsOverTwos.canBeat(eightsLast), false);
  }
});

test("Bug #257052: 7-10 suited + Phoenix as Jack with string phoenixValue is a 7-J straight beaten by 8-Q", () => {
  const basePlayers = {
    1: {
      id: 1,
      name: "P1",
      color: "000000",
      no: 1,
      score: 0,
      call_tichu: "-1",
      call_grand_tichu: "-1",
      pass: "0",
    },
    2: {
      id: 2,
      name: "P2",
      color: "ff0000",
      no: 2,
      score: 0,
      call_tichu: "-1",
      call_grand_tichu: "-1",
      pass: "0",
    },
    3: {
      id: 3,
      name: "P3",
      color: "000000",
      no: 3,
      score: 0,
      call_tichu: "-1",
      call_grand_tichu: "-1",
      pass: "0",
    },
    4: {
      id: 4,
      name: "P4",
      color: "ff0000",
      no: 4,
      score: 0,
      call_tichu: "-1",
      call_grand_tichu: "-1",
      pass: "0",
    },
  };

  // 1. 7-10 of blue (Pagodas) + Phoenix is classified as STRAIGHT_COMBO (never BOMB_COMBO)
  const suitedPlusPh = new Combo([C7, C8, C9, C0, PH]);
  assert.equal(suitedPlusPh.type, STRAIGHT_COMBO);
  assert.deepEqual(suitedPlusPh.phoenixValue, [11, 6]);

  const myHand = [A8, B9, C0, DJ, AQ, A7, B8, D0, AJ];
  const straight8toQ = [A8, B9, C0, DJ, AQ];
  const straight7toJ = [A7, B8, C9, D0, AJ];

  // 2. Live playCombo notification carrying string phoenixValue: "11"
  const liveModel = new GameModel();
  liveModel.hydrateFromGamedatas(
    {
      players: basePlayers as any,
      hand: myHand,
      handcount: { 1: myHand.length, 2: 5, 3: 5, 4: 5 },
    },
    1,
    false,
    true,
  );
  liveModel.applyPlayCombo(
    2,
    [C7, C8, C9, C0, PH],
    "Run of 5 cards from 7 to Jack",
    10,
    STRAIGHT_COMBO,
    "11" as any,
  );
  assert.equal(liveModel.getState().trickLastCombo.phoenixValue, 11);
  assert.equal(typeof liveModel.getState().trickLastCombo.phoenixValue, "number");

  const reconstructedLive = Combo.fromLastComboState(liveModel.getState().trickLastCombo);
  assert.equal(reconstructedLive.type, STRAIGHT_COMBO);
  assert.equal(reconstructedLive.phoenixValue, 11);
  assert.equal(reconstructedLive.getFirstValue(), 7);

  const play8toQ = analyzeSelection({
    selectedCards: straight8toQ,
    handCards: myHand,
    lastCombo: reconstructedLive,
    stateName: "playCombo",
    mahjongWish: 0,
  });
  assert.equal(play8toQ.isValid, true);
  assert.equal(play8toQ.buttonLabel, "Play");

  const play7toJ = analyzeSelection({
    selectedCards: straight7toJ,
    handCards: myHand,
    lastCombo: reconstructedLive,
    stateName: "playCombo",
    mahjongWish: 0,
  });
  assert.equal(play7toJ.isValid, false);
  assert.equal(play7toJ.reason, "cannot_beat");

  // 3. F5 page-refresh path: getAllDatas with string phoenixValue: "11"
  const refreshModel = new GameModel();
  refreshModel.hydrateFromGamedatas(
    {
      players: basePlayers as any,
      hand: myHand,
      handcount: { 1: myHand.length, 2: 5, 3: 5, 4: 5 },
      lastCombo: {
        player: "2",
        cards: [C7, C8, C9, C0, PH],
        type: STRAIGHT_COMBO,
        phoenixValue: "11" as any,
        description: "Run of 5 cards from 7 to Jack",
      },
      allLastCombos: {
        2: {
          cards: [C7, C8, C9, C0, PH],
          type: STRAIGHT_COMBO,
          phoenixValue: "11" as any,
          description: "Run of 5 cards from 7 to Jack",
        },
      },
    } as any,
    1,
    false,
    true,
  );
  assert.equal(refreshModel.getState().trickLastCombo.phoenixValue, 11);
  assert.equal(refreshModel.getState().lastCombos["2"]?.phoenixValue, 11);

  const reconstructedRefresh = Combo.fromLastComboState(refreshModel.getState().trickLastCombo);
  assert.equal(reconstructedRefresh.type, STRAIGHT_COMBO);
  assert.equal(reconstructedRefresh.phoenixValue, 11);
  assert.equal(reconstructedRefresh.getFirstValue(), 7);

  const play8toQAfterRefresh = analyzeSelection({
    selectedCards: straight8toQ,
    handCards: myHand,
    lastCombo: reconstructedRefresh,
    stateName: "playCombo",
    mahjongWish: 0,
  });
  assert.equal(play8toQAfterRefresh.isValid, true);
  assert.equal(play8toQAfterRefresh.buttonLabel, "Play");

  // 4. String phoenixValue coverage for low-end straight, ambiguous full house, and single Phoenix
  const lowStraight = Combo.fromLastComboState({
    cards: [PH, C7, C8, C9, C0],
    type: STRAIGHT_COMBO,
    phoenixValue: "6",
    description: "Run of 5 cards from 6 to 10",
  });
  assert.equal(lowStraight.phoenixValue, 6);
  assert.equal(lowStraight.getFirstValue(), 6);
  assert.equal(new Combo(straight7toJ).canBeat(lowStraight), true);

  const lowFullHouse = Combo.fromLastComboState({
    cards: [PH, A4, B4, C8, D8],
    type: FULL_HOUSE_COMBO,
    phoenixValue: "4",
    description: "4s full of 8s",
  });
  assert.equal(lowFullHouse.phoenixValue, 4);
  assert.equal(lowFullHouse.getFirstValue(), 4);
  assert.equal(new Combo([A5, B5, C5, A2, B2]).canBeat(lowFullHouse), true);

  const singlePhoenix = Combo.fromLastComboState({
    cards: [PH],
    type: SINGLE_COMBO,
    phoenixValue: "10.5",
    description: "Phoenix a half step above 10",
  });
  assert.equal(singlePhoenix.phoenixValue, 10.5);
  assert.equal(singlePhoenix.getFirstValue(), 10.5);
  assert.equal(new Combo([AJ]).canBeat(singlePhoenix), true);
  assert.equal(new Combo([A0]).canBeat(singlePhoenix), false);
});

test("Plan 01: GameModel and Tichu adapter gate capturedCards on isAllInfoExposed and checkVersion detects rollbacks", () => {
  const basePlayers = {
    1: { id: 1, name: "P1", color: "000000", no: 1, score: 0 },
    2: { id: 2, name: "P2", color: "ff0000", no: 2, score: 0 },
    3: { id: 3, name: "P3", color: "000000", no: 3, score: 0 },
    4: { id: 4, name: "P4", color: "ff0000", no: 4, score: 0 },
  };

  // 1. Real-time (isAllInfoExposed: 0) -> capturedCards stays [] on hydrate and enterNewTrick
  const realtimeModel = new GameModel();
  realtimeModel.hydrateFromGamedatas(
    {
      players: basePlayers as any,
      isAllInfoExposed: 0,
      capturedCards: [A5, B0],
      currentTrick: [DK],
    },
    1,
    false,
    true,
  );
  assert.equal(realtimeModel.getState().isAllInfoExposed, false);
  assert.deepEqual(realtimeModel.getState().capturedCards, []);

  realtimeModel.applyPlayCombo(2, [AA], "Ace", 0, SINGLE_COMBO);
  realtimeModel.enterNewTrick();
  assert.deepEqual(realtimeModel.getState().capturedCards, []);

  // 2. Turn-based / exposed (isAllInfoExposed: 1) -> hydrates, appends on enterNewTrick, clears on enterNewRound
  const exposedModel = new GameModel();
  exposedModel.hydrateFromGamedatas(
    {
      players: basePlayers as any,
      isAllInfoExposed: 1,
      capturedCards: [A5],
      currentTrick: [B0],
    },
    1,
    false,
    false,
  );
  assert.equal(exposedModel.getState().isAllInfoExposed, true);
  assert.equal(exposedModel.getState().capturedCards.length, 1);
  assert.equal(exposedModel.getState().capturedCards[0]?.id, A5.id);

  exposedModel.applyPlayCombo(2, [DK], "King", 10, SINGLE_COMBO);
  exposedModel.enterNewTrick();
  assert.deepEqual(
    exposedModel.getState().capturedCards.map((c) => c.id),
    [A5.id, B0.id, DK.id],
  );

  exposedModel.enterNewRound();
  assert.deepEqual(exposedModel.getState().capturedCards, []);

  // 3. Tichu adapter onEnteringStateNewTrick capturedCards gate + rollback-aware checkVersion
  const { Tichu } = loadTichuAdapterForNodeTests();
  const ui: any = new Tichu();
  const shownMessages: string[] = [];
  ui.player_id = 1;
  ui.isSpectator = false;
  ui.showMessage = (msg: string) => {
    shownMessages.push(msg);
  };
  ui.gamedatas = {
    players: basePlayers,
    codeVersion: "2026-11-18.2",
    gameVersion: 5,
    isAllInfoExposed: 0,
    capturedCards: [],
    currentTrick: [A5, DK],
    trick: 1,
  };
  ui.initialCodeVersion = "2026-11-18.2";

  ui.onEnteringStateNewTrick({});
  assert.deepEqual(ui.gamedatas.capturedCards, []);

  ui.gamedatas.isAllInfoExposed = 1;
  ui.gamedatas.currentTrick = [B0];
  ui.onEnteringStateNewTrick({});
  assert.equal(ui.gamedatas.capturedCards.length, 1);
  assert.equal(ui.gamedatas.capturedCards[0]?.id, B0.id);

  // Read-only mode always skips version check
  ui.isSpectator = true;
  assert.equal(ui.checkVersion("2026-11-18.1", 5), true);
  assert.equal(shownMessages.length, 0);

  // Active player: matching codeVersion passes
  ui.isSpectator = false;
  assert.equal(ui.checkVersion("2026-11-18.2", 5), true);
  assert.equal(shownMessages.length, 0);

  // Rollback (V2 -> V1 where gameVersion stays 5, but codeVersion regresses to 2026-11-18.1)
  assert.equal(ui.checkVersion("2026-11-18.1", 5), false);
  assert.equal(shownMessages.length, 1);
  assert.equal(ui.getDebugSnapshot().codeVersion, "2026-11-18.2");

  // Legacy numeric single-argument fallback when codeVersion is absent
  ui.versionWarningShown = false;
  ui.initialCodeVersion = "";
  assert.equal(ui.checkVersion(4), false);
  assert.equal(shownMessages.length, 2);
});

test("Plan 02: i18n static extraction helpers, formatLocalizedComboDescription, and I18nLogPayload tolerance", () => {
  const g = globalThis as any;
  const savedUnderscore = g._;
  const savedDojo = g.dojo;

  try {
    // 1. Non-string decodeHtmlEntities guard
    assert.equal(decodeHtmlEntities(null), "");
    assert.equal(decodeHtmlEntities(undefined), "");
    assert.equal(decodeHtmlEntities(42), "");
    assert.equal(decodeHtmlEntities({ log: "Pair of ${rank}", args: { rank: "Queens" } }), "");
    assert.equal(decodeHtmlEntities("Pair of 2&#39;s"), "Pair of 2s");

    // 2. Bracket-mock globalThis._ ("«...»") in Node (without dojo.string.substitute)
    delete g.dojo;
    g._ = (s: string) => `«${s}»`;

    assert.equal(
      substituteTemplate(_("Give cards to ${player_name}"), { player_name: "Alice" }),
      "«Give cards to Alice»",
    );
    assert.equal(translateDynamic("Custom Server String"), "«Custom Server String»");
    assert.equal(rankToLocalizedName(2, false), "2");
    assert.equal(rankToLocalizedName(2, true), "«2s»");
    assert.equal(rankToLocalizedName(12, false), "«Queen»");
    assert.equal(rankToLocalizedName(12, true), "«Queens»");
    assert.equal(rankToLocalizedName(DR, false), "«Dragon»");
    assert.equal(rankToLocalizedName(PH, false), "«Phoenix»");
    assert.equal(rankToLocalizedName(DOG, false), "«Dog»");
    assert.equal(rankToLocalizedName(MJ, false), "«Mahjong»");

    // 3. formatLocalizedComboDescription across all 9 combo shapes (while Combo.description stays canonical English!)
    const dogCombo = new Combo([DOG]);
    assert.equal(dogCombo.description, "Dog");
    assert.equal(formatLocalizedComboDescription(dogCombo), "«Dog»");

    const singleNum = new Combo([A7]);
    assert.equal(singleNum.description, "7");
    assert.equal(formatLocalizedComboDescription(singleNum), "7");

    const singleFace = new Combo([AQ]);
    assert.equal(singleFace.description, "Queen");
    assert.equal(formatLocalizedComboDescription(singleFace), "«Queen»");

    const singleDragon = new Combo([DR]);
    assert.equal(singleDragon.description, "Dragon");
    assert.equal(formatLocalizedComboDescription(singleDragon), "«Dragon»");

    const singlePhoenixOnJack = new Combo([PH], null, null, null, new Combo([AJ]));
    assert.equal(singlePhoenixOnJack.description, "Phoenix a half step above Jack");
    assert.equal(
      formatLocalizedComboDescription(singlePhoenixOnJack),
      "«Phoenix a half step above «Jack»»",
    );

    const pairNum = new Combo([A5, B5]);
    assert.equal(pairNum.description, "Pair of 5s");
    assert.equal(formatLocalizedComboDescription(pairNum), "«Pair of «5s»»");

    const pairFace = new Combo([AJ, BJ]);
    assert.equal(pairFace.description, "Pair of Jacks");
    assert.equal(formatLocalizedComboDescription(pairFace), "«Pair of «Jacks»»");

    const tripCombo = new Combo([AK, BK, CK]);
    assert.equal(tripCombo.description, "Triple of Kings");
    assert.equal(formatLocalizedComboDescription(tripCombo), "«Triple of «Kings»»");

    const stairsCombo = new Combo([A0, B0, AJ, BJ, AQ, BQ]);
    assert.equal(stairsCombo.description, "3 consecutive doubles from 10 to Queen");
    assert.equal(
      formatLocalizedComboDescription(stairsCombo),
      "«3 consecutive doubles from 10 to «Queen»»",
    );

    const straightCombo = new Combo([A7, B8, C9, D0, AJ]);
    assert.equal(straightCombo.description, "Run of 5 cards from 7 to Jack");
    assert.equal(
      formatLocalizedComboDescription(straightCombo),
      "«Run of 5 cards from 7 to «Jack»»",
    );

    const fhCombo = new Combo([AQ, BQ, CQ, A2, B2]);
    assert.equal(fhCombo.description, "Queens full of 2s");
    assert.equal(formatLocalizedComboDescription(fhCombo), "««Queens» full of «2s»»");

    const bomb4Combo = new Combo([AA, BA, CA, DA]);
    assert.equal(bomb4Combo.description, "Bomb of four Aces");
    assert.equal(formatLocalizedComboDescription(bomb4Combo), "«Bomb of four «Aces»»");

    const sfBombCombo = new Combo([A9, A0, AJ, AQ, AK]);
    assert.equal(sfBombCombo.description, "Straight flush bomb starting from 9 to King");
    assert.equal(
      formatLocalizedComboDescription(sfBombCombo),
      "«Straight flush bomb starting from 9 to «King»»",
    );

    // Fallback when cards are absent
    assert.equal(
      formatLocalizedComboDescription({ cards: [], description: "Legacy combo text" }),
      "«Legacy combo text»",
    );

    // 4. Localized analyzeSelection, validatePassAction, and getWishBombOnlyCallout
    const cannotBeatRes = analyzeSelection({
      selectedCards: [AQ, BQ],
      handCards: [AQ, BQ, A5],
      lastCombo: new Combo([AK, BK]),
      stateName: "playCombo",
      mahjongWish: 0,
    });
    assert.equal(cannotBeatRes.buttonLabel, "«Play»");
    assert.equal(
      cannotBeatRes.tooltip,
      "«Your «Pair of «Queens»» does not beat «Pair of «Kings»»»",
    );

    const wishFailRes = analyzeSelection({
      selectedCards: [DR],
      handCards: [AQ, DR],
      lastCombo: new Combo([A3]),
      stateName: "playCombo",
      mahjongWish: 12,
    });
    assert.equal(wishFailRes.tooltip, "«You must fulfill the active Mahjong wish («Queen»)»");

    const passFailRes = validatePassAction([AQ, BQ], new Combo([A0, B0]), 12);
    assert.equal(passFailRes.canPass, false);
    assert.equal(passFailRes.buttonLabel, "«Pass»");
    assert.equal(
      passFailRes.tooltip,
      "«Cannot pass: you must fulfill the Mahjong wish («Queen») by playing a «pair»»",
    );

    const calloutRes = getWishBombOnlyCallout([AQ, BQ, CQ, DQ], new Combo([AA]), 12);
    assert.ok(calloutRes !== null);
    assert.equal(calloutRes.wishLabel, "«Queen»");
    assert.equal(
      calloutRes.message,
      "«You must fulfill the Mahjong wish («Queen») by playing a «4-of-a-kind bomb» («Bomb of four «Queens»»).»",
    );

    // 5. I18nLogPayload { log, args } in GameModel.applyPlayCombo and Tichu.notif_playCombo + Dragon gift (#175241)
    const model = new GameModel();
    model.hydrateFromGamedatas(
      {
        players: {
          1: { id: 1, name: "P1", color: "000000", no: 1, score: 0 } as any,
          2: { id: 2, name: "P2", color: "ff0000", no: 2, score: 0 } as any,
        },
        hand: [],
      },
      1,
      false,
      true,
    );
    model.applyPlayCombo(
      2,
      [AQ, BQ],
      {
        log: "Pair of ${rank}",
        args: { rank: "Queens", i18n: ["rank"] },
      },
      0,
      PAIR_COMBO,
    );
    assert.equal(model.getState().trickLastCombo.description, "Pair of Queens");
    assert.equal(model.getState().lastCombos["2"]?.description, "Pair of Queens");
    assert.equal(
      formatLocalizedComboDescription(model.getState().trickLastCombo),
      "«Pair of «Queens»»",
    );

    // Also test with dojo.string.substitute for Dragon gift (#175241) and confirmTichu buttons
    const { Tichu } = loadTichuAdapterForNodeTests();
    g._ = (s: string) => `«${s}»`;
    g.dojo.string = {
      substitute(tpl: string, args: Record<string, unknown>) {
        return String(tpl).replace(/\$\{([^}]+)\}/g, (_m, k) => String(args[k] ?? ""));
      },
    };
    const ui: any = new Tichu();
    const addedButtons: Array<{ id: string; label: string }> = [];
    ui.player_id = 1;
    ui.isCurrentPlayerActive = () => true;
    ui.removeActionButtons = () => {
      addedButtons.length = 0;
    };
    ui.addActionButton = (id: string, label: string) => {
      addedButtons.push({ id, label });
    };
    ui.notifqueue = {
      setSynchronousDuration() {},
    };
    ui.gamedatas = {
      players: { 1: { id: "1", name: "P1" }, 2: { id: "2", name: "P2" } },
      gamestate: {
        name: "chooseDragonGift",
        args: { enemies: [{ name: "LeftEnemy" }, { name: "RightEnemy" }] },
      },
      hand: [],
      handcount: { 1: 5, 2: 5 },
      currentTrick: [],
      currentTrickValue: 0,
    };
    ui.onEnteringStateChooseDragonGift(ui.gamedatas.gamestate.args);
    assert.deepEqual(addedButtons, [
      { id: "giveDragonBefore_button", label: "«Give cards to LeftEnemy»" },
      { id: "giveDragonAfter_button", label: "«Give cards to RightEnemy»" },
    ]);

    ui.notif_playCombo({
      args: {
        player_id: 2,
        player_name: "P2",
        combo_name: {
          log: "Pair of ${rank}",
          args: { rank: "Queens", i18n: ["rank"] },
        },
        cards: [AQ, BQ],
        points: 0,
        type: PAIR_COMBO,
      },
    });
    assert.equal(typeof ui.gamedatas.lastComboDescription, "string");
    assert.equal(ui.gamedatas.lastComboDescription, "Pair of Queens");
    assert.equal(ui.gamedatas.lastCombo.description, "Pair of Queens");

    ui.pendingConfirmTichu = { grand: true, msg: "Confirm?", titleSave: "Turn" };
    ui.renderConfirmTichuButtons();
    assert.equal(addedButtons[0]?.label, "«no grand tichu»");
    ui.pendingConfirmTichu = { grand: false, msg: "Confirm?", titleSave: "Turn" };
    ui.renderConfirmTichuButtons();
    assert.equal(addedButtons[0]?.label, "«no tichu»");

    // Out-of-turn confirmTichu updates both descriptionmyturn and description, and restores both on cancel
    ui.gamedatas.gamestate = {
      name: "playCombo",
      description: "${actplayer} must play",
      descriptionmyturn: "${you} must play",
      args: {},
    };
    ui.stateName = "playCombo";
    ui.pendingConfirmTichu = null;
    ui.updatePageTitle = () => {};
    ui.onUpdateActionButtons = () => {};
    let cancelHandler: (() => void) | null = null;
    ui.addActionButton = (id: string, label: string, cb?: () => void) => {
      addedButtons.push({ id, label });
      if (id === "cancelTichu" && cb) cancelHandler = cb;
    };
    const partnerMsg =
      "Your partner has already called Tichu. Only one player can finish first — are you sure?";
    ui.notif_confirmTichu({
      args: { grand: false, msg: partnerMsg },
    });
    assert.equal(ui.gamedatas.gamestate.descriptionmyturn, partnerMsg);
    assert.equal(ui.gamedatas.gamestate.description, partnerMsg);
    assert.ok(cancelHandler, "cancelTichu button should register a click handler");
    (cancelHandler as () => void)();
    assert.equal(ui.gamedatas.gamestate.descriptionmyturn, "${you} must play");
    assert.equal(ui.gamedatas.gamestate.description, "${actplayer} must play");
  } finally {
    g._ = savedUnderscore;
    g.dojo = savedDojo;
  }
});

function serializeLitTemplate(val: any): string {
  if (val === null || val === undefined || val === false || typeof val === "symbol") return "";
  if (Array.isArray(val)) return val.map(serializeLitTemplate).join("");
  if (typeof val === "object" && "_$litDirective$" in val && Array.isArray(val.values)) {
    if (Array.isArray(val.values[0]) && typeof val.values[val.values.length - 1] === "function") {
      const tplFn = val.values[val.values.length - 1];
      return val.values[0]
        .map((item: any, idx: number) => serializeLitTemplate(tplFn(item, idx)))
        .join("");
    }
    if (
      val.values.length === 1 &&
      val.values[0] &&
      typeof val.values[0] === "object" &&
      !Array.isArray(val.values[0]) &&
      !("strings" in val.values[0])
    ) {
      return Object.entries(val.values[0])
        .filter(([, v]) => Boolean(v))
        .map(([k]) => k)
        .join(" ");
    }
  }
  if (typeof val === "object" && Array.isArray(val.strings) && Array.isArray(val.values)) {
    let out = "";
    for (let i = 0; i < val.strings.length; i++) {
      out += val.strings[i];
      if (i < val.values.length) {
        out += serializeLitTemplate(val.values[i]);
      }
    }
    return out;
  }
  return String(val);
}

test("Plan 03: fixed-grid action bar removes 'My hand', suppresses readOnly/gameEnd, and adds one-click Mahjong 'No wish'", async () => {
  await withMockLitEnv(({ TichuActionBar, TichuValueChoice }) => {
    const g = globalThis as any;
    const savedUnderscore = g._;
    const savedGameModel = g.window.gameModel;
    const savedGameUi = g.window.gameui;

    try {
      const { Tichu } = loadTichuAdapterForNodeTests();
      g._ = (s: string) => `«${s}»`;

      const model = new GameModel();
      model.hydrateFromGamedatas(
        {
          players: {
            "2385074": {
              id: "2385074",
              name: "P0",
              color: "000000",
              no: 1,
              score: "0",
              call_tichu: "-1",
              call_grand_tichu: "0",
              pass: "0",
            } as any,
            "2385075": {
              id: "2385075",
              name: "P1",
              color: "ff0000",
              no: 2,
              score: "0",
              call_tichu: "-1",
              call_grand_tichu: "0",
              pass: "0",
            } as any,
          },
          playerorder: ["2385074", "2385075"],
          gamestate: {
            id: "65",
            name: "mahjongPlay",
            type: "activeplayer",
            active_player: "2385074",
            args: {},
          } as any,
          hand: [A2, B5, C9],
        },
        "2385074",
        false,
        true,
      );
      g.window.gameModel = model;

      // 1. Tichu adapter: mahjongPlay buttons + onNoWish + onMakeAWish
      const ui: any = new Tichu();
      const addedButtons: Array<{ id: string; label: string; callback: string; color?: string }> =
        [];
      const takenActions: Array<{ action: string; args: any }> = [];
      const errorMessages: Array<{ msg: string; type: string }> = [];
      let allowMahjongAction = true;

      ui.player_id = 2385074;
      ui.isSpectator = false;
      ui.isReadOnly = () => false;
      ui.isCurrentPlayerActive = () => true;
      ui.getActivePlayerId = () => 2385074;
      ui.removeActionButtons = () => {
        addedButtons.length = 0;
      };
      ui.addActionButton = (
        id: string,
        label: string,
        callback: string,
        _dest?: any,
        _blinking?: boolean,
        color?: string,
      ) => {
        addedButtons.push({ id, label, callback, color });
      };
      ui.checkAction = (action: string) => action === "makeAWish" && allowMahjongAction;
      ui.takeAction = (action: string, args: any) => {
        takenActions.push({ action, args });
      };
      ui.showMessage = (msg: string, type: string) => {
        errorMessages.push({ msg, type });
      };
      ui.gamedatas = {
        players: {
          "2385074": { id: "2385074", name: "P0", call_grand_tichu: "0" },
        },
        gamestate: { name: "mahjongPlay", active_player: "2385074", args: {} },
      };

      ui.onUpdateActionButtons("mahjongPlay", {});
      assert.deepEqual(addedButtons, [
        { id: "chooseWish", label: "«Make a wish»", callback: "onMakeAWish", color: undefined },
        { id: "noWish_button", label: "«No wish»", callback: "onNoWish", color: "gray" },
      ]);

      // Selecting an 8 then clicking "No wish" resets selection and sends wish: 15
      model.setSelectedMahjongWish(8);
      ui.onNoWish({ preventDefault() {}, stopPropagation() {} });
      assert.equal(model.getState().selectedMahjongWish, null);
      assert.deepEqual(takenActions, [{ action: "makeAWish", args: { wish: 15 } }]);

      // Legacy tile 15 + Make a wish remains compatible
      model.setSelectedMahjongWish(15);
      ui.onMakeAWish({ preventDefault() {}, stopPropagation() {} });
      assert.equal(model.getState().selectedMahjongWish, null);
      assert.deepEqual(takenActions.at(-1), { action: "makeAWish", args: { wish: 15 } });

      // Empty Make a wish still warns
      ui.onMakeAWish();
      assert.equal(errorMessages.length, 1);
      assert.equal(errorMessages[0]?.msg, "«You need to choose ONE value to wish»");

      // Both no-op when checkAction returns false
      allowMahjongAction = false;
      const countBeforeDenied = takenActions.length;
      ui.onNoWish();
      ui.onMakeAWish();
      assert.equal(takenActions.length, countBeforeDenied);

      // 2. TichuValueChoice: accessible tile 15 attributes + keyboard activation (Enter keydown / Space keyup)
      const valueChoice = new TichuValueChoice();
      valueChoice.mode = "mahjong";
      valueChoice.performUpdate = () => {};
      valueChoice.connectedCallback();
      try {
        const renderedChoice = serializeLitTemplate(valueChoice.render());
        assert.match(renderedChoice, /id="mahjong_item_15"/);
        assert.equal(renderedChoice.includes("mahjong-no-wish-label"), false);
        assert.match(renderedChoice, /role="button"/);
        assert.match(renderedChoice, /aria-label=["']?«No wish»["']?/);
        assert.match(renderedChoice, /data-tooltip=["']?«No wish»["']?/);
        assert.match(renderedChoice, /data-tooltip-touch=["']?longpress["']?/);
        assert.equal(renderedChoice.includes("title="), false);
        assert.match(renderedChoice, /aria-label=["']?«Queen»["']?/);

        let prevented = 0;
        const makeKeyEvt = (key: string) =>
          ({
            key,
            preventDefault() {
              prevented++;
            },
          }) as any;
        valueChoice.onTileKeyDown(makeKeyEvt(" "), () => valueChoice.onMahjongClick(15));
        assert.equal(
          model.getState().selectedMahjongWish,
          null,
          "Space keydown must not activate yet",
        );
        assert.equal(prevented, 1);

        valueChoice.onTileKeyUp(makeKeyEvt(" "), () => valueChoice.onMahjongClick(15));
        assert.equal(model.getState().selectedMahjongWish, 15, "Space keyup selects tile");

        valueChoice.onTileKeyDown(makeKeyEvt("Enter"), () => valueChoice.onMahjongClick(15));
        assert.equal(model.getState().selectedMahjongWish, null, "Enter keydown toggles selection");
      } finally {
        valueChoice.disconnectedCallback();
      }

      // 3. TichuActionBar: CSS Grid styles, readOnly/gameEnd suppression, zero "My hand", fixed slot stability
      const actionBarCss = (TichuActionBar.styles || [])
        .map((s: any) => s.cssText || String(s))
        .join("\n");
      assert.match(actionBarCss, /display:\s*grid/);
      assert.match(
        actionBarCss,
        /grid-template-columns:\s*repeat\(3,\s*minmax\(130px,\s*160px\)\)\s+minmax\(24px,\s*1fr\)\s+repeat\(2,\s*minmax\(130px,\s*160px\)\)/,
      );
      assert.match(actionBarCss, /min-height:\s*32px/);
      assert.doesNotMatch(
        actionBarCss,
        /max-width:\s*760px|grid-row:\s*2|\.space2/,
        "Action bar must stay single-row with equal-width buttons and flush-right Bomb/Tichu",
      );

      const bar = new TichuActionBar();
      bar.performUpdate = () => {};
      let mockReadOnly = false;
      g.window.gameui = { isReadOnly: () => mockReadOnly };
      bar.connectedCallback();
      try {
        for (const [stateName, activeId] of [
          ["grandTichuBets", "2385074"],
          ["giveCards", "2385074"],
          ["playComboOpen", "2385074"],
          ["playCombo", "2385075"],
          ["mahjongPlay", "2385074"],
          ["confirmTrick", "2385074"],
        ] as const) {
          model.setGameState(stateName, {
            activePlayerId: activeId,
            activePlayerIds: [activeId],
            isCurrentPlayerActive: activeId === "2385074",
          });
          const htmlOut = serializeLitTemplate(bar.render());
          assert.equal(
            htmlOut.includes("My hand"),
            false,
            `Action bar must not render "My hand" in ${stateName}`,
          );
          for (const slotId of [
            "play_button",
            "pass_button",
            "pass_trick_button",
            "bomb_button",
            "tichu_button",
          ]) {
            assert.ok(
              htmlOut.includes(`id="${slotId}"`),
              `Slot #${slotId} must stay mounted in ${stateName}`,
            );
          }
        }

        // Flip showBomb true <-> false: all slot wrappers including #bomb_button & #tichu_button remain present
        model.setGameState("playCombo", {
          activePlayerId: "2385075",
          activePlayerIds: ["2385075"],
          isCurrentPlayerActive: false,
        });
        const outWithBomb = serializeLitTemplate(bar.render());
        assert.ok(outWithBomb.includes('id="myPlayBomb"'));
        assert.ok(outWithBomb.includes('id="myMakeTichuBet"'));

        // #wishBombCallout renders in playCombo when only a bomb fulfills wish,
        // and stays suppressed in playBomb (bug #257868: bombs in playBomb need not fulfill wish)
        model.setHand([A5, B5, C5, D5, A7, B7, C7, D7]);
        model.setMahjongWish(5);
        model.applyPlayCombo("2385075", [AA, BA], "Pair of Aces", 0, PAIR_COMBO, null);
        model.setGameState("playCombo", {
          activePlayerId: "2385074",
          activePlayerIds: ["2385074"],
          isCurrentPlayerActive: true,
        });
        const outWishCallout = serializeLitTemplate(bar.render());
        assert.ok(outWishCallout.includes('id="wishBombCallout"'));

        model.setGameState("playBomb", {
          activePlayerId: "2385074",
          activePlayerIds: ["2385074"],
          isCurrentPlayerActive: true,
        });
        const outPlayBombNoCallout = serializeLitTemplate(bar.render());
        assert.equal(outPlayBombNoCallout.includes('id="wishBombCallout"'), false);

        model.setMahjongWish(0);
        model.setHand([A5, B5, C5, D5, A7]);
        model.enterNewTrick();

        // Bug #106651: Keep #myPlayBomb visible on own turn (playComboOpen & playCombo)
        // and behave identically to "Play" (disabled until selection is valid, invokes onPlayCombo)
        let playComboCalls = 0;
        let playBombCalls = 0;
        const dispatchedEvents: string[] = [];
        (bar as any).dispatchEvent = (evt: any) => {
          dispatchedEvents.push(evt?.type ?? "");
          return true;
        };
        g.window.gameui = {
          isReadOnly: () => mockReadOnly,
          onPlayCombo: () => {
            playComboCalls++;
          },
          onPlayBomb: () => {
            playBombCalls++;
          },
        };
        const fakeEvent = { preventDefault: () => {} } as any;

        model.setSelectedCardIds([]);
        model.setGameState("playComboOpen", {
          activePlayerId: "2385074",
          activePlayerIds: ["2385074"],
          isCurrentPlayerActive: true,
        });
        const outOpenNoSel = serializeLitTemplate(bar.render());
        assert.ok(
          outOpenNoSel.includes('id="myPlayBomb"'),
          "#myPlayBomb stays visible in playComboOpen",
        );
        assert.match(outOpenNoSel, /id="myPlayBomb"[^>]*class="[^"]*disabled/);
        (bar as any).onPlayBomb(fakeEvent);
        assert.equal(
          playComboCalls,
          0,
          "Clicking disabled #myPlayBomb on own turn must not submit",
        );
        assert.equal(
          playBombCalls,
          0,
          "Clicking #myPlayBomb on own turn must not invoke out-of-turn playBomb",
        );

        // Valid non-bomb selection in playComboOpen keeps #myPlayBomb disabled (only bombs enable it)
        model.setSelectedCardIds([A7.id]);
        const outOpenNonBomb = serializeLitTemplate(bar.render());
        assert.ok(outOpenNonBomb.includes('id="myPlayBomb"'));
        assert.match(outOpenNonBomb, /id="myPlayBomb"[^>]*class="[^"]*disabled/);
        (bar as any).onPlayBomb(fakeEvent);
        assert.equal(playComboCalls, 0, "Non-bomb selection must not submit via #myPlayBomb");
        assert.equal(playBombCalls, 0);

        // Valid bomb selection in playComboOpen enables #myPlayBomb and submits via onPlayCombo
        model.setSelectedCardIds([A5.id, B5.id, C5.id, D5.id]);
        const outOpenValidBomb = serializeLitTemplate(bar.render());
        assert.ok(outOpenValidBomb.includes('id="myPlayBomb"'));
        assert.doesNotMatch(outOpenValidBomb, /id="myPlayBomb"[^>]*class="[^"]*disabled/);
        (bar as any).onPlayBomb(fakeEvent);
        assert.equal(
          playComboCalls,
          1,
          "Valid bomb on own turn in playComboOpen calls onPlayCombo",
        );
        assert.equal(playBombCalls, 0);
        assert.equal(dispatchedEvents[dispatchedEvents.length - 1], "action-play-combo");

        model.applyPlayCombo("2385075", [AA], "Ace", 0, SINGLE_COMBO, null);
        model.setGameState("playCombo", {
          activePlayerId: "2385074",
          activePlayerIds: ["2385074"],
          isCurrentPlayerActive: true,
        });
        // Even a valid beating non-bomb (not applicable vs Ace, test with 7 vs 2 below) or invalid selection stays disabled
        model.setSelectedCardIds([A7.id]);
        const outPlayComboInvalid = serializeLitTemplate(bar.render());
        assert.ok(
          outPlayComboInvalid.includes('id="myPlayBomb"'),
          "#myPlayBomb stays visible on own turn in playCombo",
        );
        assert.match(outPlayComboInvalid, /id="myPlayBomb"[^>]*class="[^"]*disabled/);
        (bar as any).onPlayBomb(fakeEvent);
        assert.equal(
          playComboCalls,
          1,
          "Invalid selection on own turn does not submit via #myPlayBomb",
        );

        // Valid beating non-bomb in playCombo (Single 7 over Single 5) must STILL keep #myPlayBomb disabled
        model.applyPlayCombo("2385075", [A5], "5", 0, SINGLE_COMBO, null);
        model.setSelectedCardIds([A7.id]);
        const outPlayComboValidNonBomb = serializeLitTemplate(bar.render());
        assert.match(outPlayComboValidNonBomb, /id="myPlayBomb"[^>]*class="[^"]*disabled/);
        (bar as any).onPlayBomb(fakeEvent);
        assert.equal(
          playComboCalls,
          1,
          "Valid non-bomb in playCombo must not submit via #myPlayBomb",
        );

        model.setSelectedCardIds([A5.id, B5.id, C5.id, D5.id]);
        const outPlayComboValidBomb = serializeLitTemplate(bar.render());
        assert.doesNotMatch(outPlayComboValidBomb, /id="myPlayBomb"[^>]*class="[^"]*disabled/);
        (bar as any).onPlayBomb(fakeEvent);
        assert.equal(
          playComboCalls,
          2,
          "Valid bomb on own turn in playCombo submits via onPlayCombo",
        );
        assert.equal(playBombCalls, 0);
        assert.equal(dispatchedEvents[dispatchedEvents.length - 1], "action-play-combo");

        // In confirmTrick on own turn, #myPlayBomb stays enabled and invokes onPlayBomb (interrupting Collect)
        model.setSelectedCardIds([]);
        model.setGameState("confirmTrick", {
          activePlayerId: "2385074",
          activePlayerIds: ["2385074"],
          isCurrentPlayerActive: true,
        });
        const outConfirmTrick = serializeLitTemplate(bar.render());
        assert.ok(outConfirmTrick.includes('id="myPlayBomb"'));
        assert.doesNotMatch(outConfirmTrick, /id="myPlayBomb"[^>]*class="[^"]*disabled/);
        (bar as any).onPlayBomb(fakeEvent);
        assert.equal(playBombCalls, 1, "Clicking #myPlayBomb in confirmTrick invokes onPlayBomb");
        assert.equal(dispatchedEvents[dispatchedEvents.length - 1], "action-play-bomb");

        // Out of turn in playCombo, #myPlayBomb stays enabled and invokes onPlayBomb
        model.setGameState("playCombo", {
          activePlayerId: "2385075",
          activePlayerIds: ["2385075"],
          isCurrentPlayerActive: false,
        });
        (bar as any).onPlayBomb(fakeEvent);
        assert.equal(playBombCalls, 2, "Clicking #myPlayBomb out of turn invokes onPlayBomb");
        assert.equal(dispatchedEvents[dispatchedEvents.length - 1], "action-play-bomb");

        // Empty hand hides #myPlayBomb even in playComboOpen
        model.setHand([]);
        model.enterNewTrick();
        model.setGameState("playComboOpen", {
          activePlayerId: "2385074",
          activePlayerIds: ["2385074"],
          isCurrentPlayerActive: true,
        });
        const outWithoutBomb = serializeLitTemplate(bar.render());
        assert.equal(outWithoutBomb.includes('id="myPlayBomb"'), false);
        assert.ok(outWithoutBomb.includes('id="bomb_button"'));
        assert.ok(outWithoutBomb.includes('id="tichu_button"'));
        assert.ok(outWithoutBomb.includes('id="myMakeTichuBet"'));

        // Countdown class spans columns 1..3 cleanly
        model.setCollectingTrickCountdown(true);
        const outCountdown = serializeLitTemplate(bar.render());
        assert.match(outCountdown, /id="play_button"\s+class=["']?countdown["']?/);
        model.setCollectingTrickCountdown(false);

        // Suppressed at gameEnd and for read-only / spectators
        model.setGameState("gameEnd", { activePlayerId: "", isCurrentPlayerActive: false });
        assert.equal(serializeLitTemplate(bar.render()), "");

        model.setGameState("playCombo", {
          activePlayerId: "2385075",
          activePlayerIds: ["2385075"],
          isCurrentPlayerActive: false,
        });
        mockReadOnly = true;
        assert.equal(serializeLitTemplate(bar.render()), "");
      } finally {
        bar.disconnectedCallback();
      }
    } finally {
      g._ = savedUnderscore;
      g.window.gameModel = savedGameModel;
      g.window.gameui = savedGameUi;
    }
  });
});

test("Bug #257404: received-card glow, below-card avatar, first-move dismiss, and isAllInfoExposed persistence", async () => {
  await withMockLitEnv(
    ({ TichuCardEl, TichuStock, buildPassedOriginsMap, computeCardVisibleWidthPx }) => {
      const g = globalThis as any;
      const savedUnderscore = g._;
      try {
        g._ = (s: string) => s;

        const basePlayers = {
          "2385074": { id: "2385074", name: "Alice", color: "000000", no: 1, score: "0" },
          "2385075": { id: "2385075", name: "Bob", color: "ff0000", no: 2, score: "0" },
          "2385076": { id: "2385076", name: "Carol", color: "000000", no: 3, score: "0" },
          "2385077": { id: "2385077", name: "Dave", color: "ff0000", no: 4, score: "0" },
        };
        const avatarUrls = {
          "2385074": "/avatars/alice.png",
          "2385075": "/avatars/bob.png",
          "2385076": "/avatars/carol.png",
          "2385077": "",
        };

        // 1. normalizeCard ignores null/""/0 passed_from and preserves positive sender IDs;
        //    hydrateFromGamedatas preserves hasPlayedOrPassedInRound + avatarUrl
        const model = new GameModel();
        model.hydrateFromGamedatas(
          {
            players: basePlayers as any,
            isAllInfoExposed: 0,
            hasPlayedOrPassedInRound: false,
            hand: [
              { ...A2, passed_from: null } as any,
              { ...B3, passed_from: "" } as any,
              { ...C4, passed_from: "0" } as any,
              { ...D5, passed_from: "2385075" } as any,
              { ...A6, passed_from: "2385076" } as any,
              { ...B7, passed_from: "2385077" } as any,
            ],
          },
          "2385074",
          false,
          true,
          undefined,
          avatarUrls,
        );

        const st0 = model.getState();
        assert.equal(st0.hasPlayedOrPassedInRound, false);
        assert.equal(st0.players["2385075"]?.avatarUrl, "/avatars/bob.png");
        assert.equal(st0.players["2385077"]?.avatarUrl, "");
        assert.equal(st0.hand[0]?.passed_from, undefined);
        assert.equal(st0.hand[1]?.passed_from, undefined);
        assert.equal(st0.hand[2]?.passed_from, undefined);
        assert.equal(st0.hand[3]?.passed_from, "2385075");
        assert.equal(st0.hand[4]?.passed_from, "2385076");
        assert.equal(st0.hand[5]?.passed_from, "2385077");

        // 2. Calling Tichu or opponent play/pass must NOT dismiss current player's highlight
        model.applyTichuBet("2385074", 100);
        model.applyPlayCombo("2385075", [C8], "8", 0, SINGLE_COMBO);
        model.applyPass("2385076");
        assert.equal(model.getState().hasPlayedOrPassedInRound, false);

        // 3. Current player playCombo flips hasPlayedOrPassedInRound to true
        model.applyPlayCombo("2385074", [A2], "2", 0, SINGLE_COMBO);
        assert.equal(model.getState().hasPlayedOrPassedInRound, true);

        // 4. enterNewRound resets; finishAcceptCards keeps false; current player applyPass flips to true; enterEndRound resets
        model.enterNewRound();
        assert.equal(model.getState().hasPlayedOrPassedInRound, false);
        model.finishAcceptCards([{ ...D5, passed_from: "2385075" }]);
        assert.equal(model.getState().hasPlayedOrPassedInRound, false);
        model.applyPass("2385074");
        assert.equal(model.getState().hasPlayedOrPassedInRound, true);
        model.enterEndRound();
        assert.equal(model.getState().hasPlayedOrPassedInRound, false);

        // 5. buildPassedOriginsMap: clockwise vs counterclockwise + 2x2 lifecycle matrix
        // For P0 (no=1): playersDesc = [P3(Dave,prev), P2(Carol,partner), P1(Bob,next), P0]
        //   clockwise=false -> Left=Dave, Partner=Carol, Right=Bob
        //   clockwise=true  -> Left=Bob,  Partner=Carol, Right=Dave
        const handSample = [
          { ...A2 },
          { ...D5, passed_from: "2385075" }, // Bob (next)
          { ...A6, passed_from: "2385076" }, // Carol (partner)
          { ...B7, passed_from: "2385077" }, // Dave (prev)
        ];
        const mapCcwBefore = buildPassedOriginsMap({
          hand: handSample,
          players: st0.players,
          currentPlayerId: "2385074",
          clockwise: false,
          isAllInfoExposed: false,
          hasPlayedOrPassedInRound: false,
        });
        assert.equal(mapCcwBefore[A2.id], undefined);
        assert.equal(mapCcwBefore[D5.id]?.seat, "right");
        assert.equal(mapCcwBefore[D5.id]?.tooltip, "Passed by Bob (Right)");
        assert.equal(mapCcwBefore[D5.id]?.showGlow, true);
        assert.equal(mapCcwBefore[D5.id]?.showAvatar, true);

        assert.equal(mapCcwBefore[A6.id]?.seat, "partner");
        assert.equal(mapCcwBefore[A6.id]?.tooltip, "Passed by Carol (Partner)");

        assert.equal(mapCcwBefore[B7.id]?.seat, "left");
        assert.equal(mapCcwBefore[B7.id]?.tooltip, "Passed by Dave (Left)");

        const mapCwAfterRt = buildPassedOriginsMap({
          hand: handSample,
          players: st0.players,
          currentPlayerId: "2385074",
          clockwise: true,
          isAllInfoExposed: false,
          hasPlayedOrPassedInRound: true,
        });
        assert.equal(mapCwAfterRt[D5.id]?.seat, "left");
        assert.equal(mapCwAfterRt[D5.id]?.tooltip, "Passed by Bob (Left)");
        assert.equal(mapCwAfterRt[D5.id]?.showGlow, false);
        assert.equal(mapCwAfterRt[D5.id]?.showAvatar, false);
        assert.equal(mapCwAfterRt[B7.id]?.seat, "right");
        assert.equal(mapCwAfterRt[B7.id]?.tooltip, "Passed by Dave (Right)");

        const mapCwAfterTb = buildPassedOriginsMap({
          hand: handSample,
          players: st0.players,
          currentPlayerId: "2385074",
          clockwise: true,
          isAllInfoExposed: true,
          hasPlayedOrPassedInRound: true,
        });
        assert.equal(mapCwAfterTb[D5.id]?.showGlow, false);
        assert.equal(mapCwAfterTb[D5.id]?.showAvatar, true);
        assert.equal(mapCwAfterTb[A6.id]?.showGlow, false);
        assert.equal(mapCwAfterTb[A6.id]?.showAvatar, true);

        // 6. TichuCard rendering: footer reservation, glow, wish precedence, img vs fallback, visible vs faded
        const cardCss = (TichuCardEl.styles || [])
          .map((s: any) => s.cssText || String(s))
          .join("\n");
        const idxPassedHighlight = cardCss.indexOf("div#card.passed-highlight");
        const idxWishMatch = cardCss.indexOf("div#card.wish-match");
        assert.ok(
          idxPassedHighlight >= 0 && idxWishMatch > idxPassedHighlight,
          ".wish-match must override .passed-highlight",
        );

        const plainCard = new TichuCardEl();
        plainCard.card = A2;
        plainCard.reserveFooter = false;
        const plainHtml = serializeLitTemplate(plainCard.render());
        assert.equal(plainHtml.includes("card-footer"), false);

        const reservedNonPassed = new TichuCardEl();
        reservedNonPassed.card = A2;
        reservedNonPassed.reserveFooter = true;
        reservedNonPassed.passedOrigin = null;
        const reservedNonPassedHtml = serializeLitTemplate(reservedNonPassed.render());
        assert.ok(reservedNonPassedHtml.includes('class="card-footer"'));
        assert.equal(reservedNonPassedHtml.includes("passed-avatar-wrap"), false);

        const activeImgCard = new TichuCardEl();
        activeImgCard.card = D5;
        activeImgCard.reserveFooter = true;
        activeImgCard.passedOrigin = mapCcwBefore[D5.id];
        const activeImgHtml = serializeLitTemplate(activeImgCard.render());
        assert.ok(activeImgHtml.includes("passed-highlight"));
        assert.ok(activeImgHtml.includes("passed-avatar-wrap visible opponent"));
        assert.match(activeImgHtml, /src=["']?\/avatars\/bob\.png["']?/);
        assert.equal(activeImgHtml.includes("passed-dir-hint"), false);
        assert.equal(activeImgCard.getComputedTooltip(), "");
        assert.equal(activeImgHtml.includes("Scores 5 points"), false);
        assert.match(
          activeImgHtml,
          /class=["']?passed-avatar-wrap visible opponent["']?[^>]*data-tooltip=["']?Passed by Bob \(Right\)["']?/,
        );

        const fallbackCard = new TichuCardEl();
        fallbackCard.card = B7;
        fallbackCard.reserveFooter = true;
        fallbackCard.passedOrigin = mapCcwBefore[B7.id];
        const fallbackHtml = serializeLitTemplate(fallbackCard.render());
        assert.ok(fallbackHtml.includes("passed-avatar-fallback"));
        assert.match(fallbackHtml, />D<\/span\s*>/);
        assert.equal(fallbackHtml.includes("passed-dir-hint"), false);

        const fadedRtCard = new TichuCardEl();
        fadedRtCard.card = D5;
        fadedRtCard.reserveFooter = true;
        fadedRtCard.passedOrigin = mapCwAfterRt[D5.id];
        const fadedRtHtml = serializeLitTemplate(fadedRtCard.render());
        assert.equal(fadedRtHtml.includes("passed-highlight"), false);
        assert.equal(fadedRtHtml.includes("passed-avatar-wrap visible"), false);
        assert.ok(fadedRtHtml.includes("passed-avatar-wrap"));
        assert.equal(fadedRtCard.getComputedTooltip(), "");

        // 7. TichuStock sets --stock-height: 184px when reserveFooter=true vs 150px when false
        const stockPlain = new TichuStock();
        stockPlain.cards = handSample;
        stockPlain.reserveFooter = false;
        stockPlain.render();
        assert.equal(stockPlain.style["--stock-height"], "150px");
        assert.equal(stockPlain.style["--card-footer-height"], "0px");

        const stockReserved = new TichuStock();
        stockReserved.cards = handSample;
        stockReserved.reserveFooter = true;
        stockReserved.passedOrigins = mapCcwBefore;
        const stockHtml = serializeLitTemplate(stockReserved.render());
        assert.equal(stockReserved.style["--stock-height"], "184px");
        assert.equal(stockReserved.style["--card-footer-height"], "34px");
        assert.equal(stockReserved.style["--stock-card-width"], "100px");
        assert.ok(stockReserved.style["--card-visible-width"]);
        assert.ok(stockHtml.includes("<tichu-card"));
        assert.equal(computeCardVisibleWidthPx(100, -75), 25);
        assert.equal(computeCardVisibleWidthPx(100, -90), 16);
        assert.equal(computeCardVisibleWidthPx(100, 0), 100);
      } finally {
        g._ = savedUnderscore;
      }
    },
  );
});

test("TichuPassArea: tooltip-only select hint, avatar above name, fallback initial, and card offset alignment", async () => {
  await withMockLitEnv(({ TichuPassArea, PASS_SLOT_CARD_OFFSET_X, PASS_SLOT_CARD_OFFSET_Y }) => {
    const g = globalThis as any;
    const savedUnderscore = g._;
    const savedGameModel = g.window.gameModel;
    try {
      g._ = (s: string) => "«" + s + "»";

      const passCss = (TichuPassArea.styles || [])
        .map((s: any) => s.cssText || String(s))
        .join("\n");
      assert.equal(PASS_SLOT_CARD_OFFSET_X, 20);
      assert.equal(PASS_SLOT_CARD_OFFSET_Y, 84);
      assert.ok(
        passCss.includes("top: 84px"),
        "Card absolute top must match PASS_SLOT_CARD_OFFSET_Y",
      );
      assert.equal(
        passCss.includes(".playertabletext"),
        false,
        "Legacy .playertabletext CSS should be removed",
      );
      assert.match(
        passCss,
        /\.icon\.big\.grandtichucolor\s*\{[^}]*--icon-size:\s*56px;[^}]*background-position:\s*0 0;/,
        "Grand Tichu big icon should use uniform 56x56 sprite cell (0, 0)",
      );
      assert.match(
        passCss,
        /\.icon\.big\.tichucolor\s*\{[^}]*--icon-size:\s*56px;[^}]*background-position:\s*calc\(var\(--icon-size\) \* -2\) 0;/,
        "Tichu big icon should use uniform 56x56 sprite cell (2, 0)",
      );

      const model = new GameModel();
      model.hydrateFromGamedatas(
        {
          players: {
            "2385074": { id: "2385074", name: "dashwood0", color: "000000", no: 1, score: "0" },
            "2385075": { id: "2385075", name: "dashwood1", color: "ff0000", no: 2, score: "0" },
            "2385076": { id: "2385076", name: "dashwood2", color: "000000", no: 3, score: "0" },
            "2385077": { id: "2385077", name: "dashwood3", color: "ff0000", no: 4, score: "0" },
          } as any,
          gamestate: {
            id: "40",
            name: "giveCards",
            type: "multipleactiveplayer",
            multiactive: ["2385074"],
            args: {},
          } as any,
          hand: [A2, B3, C4, D5],
        },
        "2385074",
        false,
        true,
        undefined,
        {
          "2385074": "/avatars/d0.png",
          "2385075": "/avatars/d1.png",
          "2385076": "/avatars/d2.png",
          "2385077": "",
        },
      );
      g.window.gameModel = model;

      const passArea = new TichuPassArea();
      passArea.performUpdate = () => {};
      passArea.connectedCallback();
      try {
        // 1. Active giveCards with 3 empty slots
        const htmlEmpty = serializeLitTemplate(passArea.render());
        assert.equal(htmlEmpty.includes("playertabletext"), false);
        assert.equal(htmlEmpty.includes("<span>«Select a card and click here»</span>"), false);

        const tooltipMatches =
          htmlEmpty.match(
            /data-tooltip="«Select a card and click here»"|data-tooltip=«Select a card and click here»/g,
          ) ?? [];
        assert.equal(
          tooltipMatches.length,
          3,
          "All 3 empty active slots should carry the select data-tooltip",
        );
        assert.equal(htmlEmpty.includes("title="), false);

        // Avatar appears above name inside .playertable-header, with partner ring on dir=2 (dashwood2) and opponent on dir=1/3
        const getSlotHtml = (htmlStr: string, dir: number) => {
          const idIdx = htmlStr.indexOf(`id="playertable_${dir}"`);
          if (idIdx < 0) return "";
          const start = htmlStr.lastIndexOf("<div", idIdx);
          const nextIdIdx = htmlStr.indexOf(`id="playertable_${dir + 1}"`);
          const end = nextIdIdx >= 0 ? htmlStr.lastIndexOf("<div", nextIdIdx) : htmlStr.length;
          return htmlStr.slice(start, end);
        };

        const slot1Html = getSlotHtml(htmlEmpty, 1);
        const slot2Html = getSlotHtml(htmlEmpty, 2);
        const slot3Html = getSlotHtml(htmlEmpty, 3);
        assert.ok(slot1Html && slot2Html && slot3Html);

        // dir=1 is dashwood3 (empty avatarUrl -> fallback "D", opponent class)
        assert.ok(slot1Html.includes("playertable-header"));
        assert.ok(slot1Html.includes("playertable-avatar-wrap opponent"));
        assert.ok(slot1Html.includes("playertable-avatar-fallback"));
        assert.match(slot1Html, />D<\/span\s*>/);
        assert.ok(
          slot1Html.indexOf("playertable-avatar-wrap") < slot1Html.indexOf("playertablename"),
        );

        // dir=2 is dashwood2 (partner class, img /avatars/d2.png)
        assert.ok(slot2Html.includes("playertable-avatar-wrap partner"));
        assert.match(
          slot2Html,
          /<img[\s\S]*class="playertable-avatar-img"[\s\S]*src=["']?\/avatars\/d2\.png["']?/,
        );
        assert.ok(
          slot2Html.indexOf("playertable-avatar-wrap") < slot2Html.indexOf("playertablename"),
        );

        // dir=3 is dashwood1 (opponent class, img /avatars/d1.png)
        assert.ok(slot3Html.includes("playertable-avatar-wrap opponent"));
        assert.match(
          slot3Html,
          /<img[\s\S]*class="playertable-avatar-img"[\s\S]*src=["']?\/avatars\/d1\.png["']?/,
        );

        // 2. Avatar load error switches that slot to fallback initial
        (passArea as any).onAvatarError("2385076|/avatars/d2.png");
        const htmlAfterErr = serializeLitTemplate(passArea.render());
        const errSlot2 = getSlotHtml(htmlAfterErr, 2);
        assert.equal(errSlot2.includes("playertable-avatar-img"), false);
        assert.ok(errSlot2.includes("playertable-avatar-fallback"));
        assert.match(errSlot2, />D<\/span\s*>/);

        // 3. Slot with givenCard sets has-card, drops select tooltip, keeps header avatar + name
        model.update({
          passSlots: model
            .getState()
            .passSlots.map((s, idx) => (idx === 0 ? { ...s, givenCard: A2 } : s)),
        });
        const htmlOneGiven = serializeLitTemplate(passArea.render());
        const givenSlot1 = getSlotHtml(htmlOneGiven, 1);
        assert.ok(givenSlot1.includes("has-card"));
        assert.equal(givenSlot1.includes("Select a card and click here"), false);
        assert.ok(givenSlot1.includes("playertable-avatar-wrap"));
        assert.ok(givenSlot1.includes("dashwood3"));
        const remainingTooltips = htmlOneGiven.match(/Select a card and click here/g) ?? [];
        assert.equal(remainingTooltips.length, 2);

        // 4. Inactive player or acceptPassedCards omits select tooltip while keeping avatar + name
        model.setGameState("giveCards", { isCurrentPlayerActive: false });
        const htmlInactive = serializeLitTemplate(passArea.render());
        assert.equal(htmlInactive.includes("Select a card and click here"), false);
        assert.ok(htmlInactive.includes("playertable-avatar-wrap"));
        assert.ok(htmlInactive.includes("dashwood1"));

        model.setGameState("acceptPassedCards", { isCurrentPlayerActive: true });
        model.update({
          passSlots: model.getState().passSlots.map((s) => ({
            ...s,
            givenCard: null,
            receivedCard: B3,
          })),
        });
        const htmlAccept = serializeLitTemplate(passArea.render());
        assert.equal(htmlAccept.includes("Select a card and click here"), false);
        assert.ok(htmlAccept.includes("playertable-avatar-wrap"));
        assert.ok(htmlAccept.includes("dashwood2"));
      } finally {
        passArea.disconnectedCallback();
      }
    } finally {
      g._ = savedUnderscore;
      g.window.gameModel = savedGameModel;
    }
  });
});

test("TichuStatus renders compact PNG icon HUD with accessible labels and tooltips", async () => {
  await withMockLitEnv(({ TichuStatus, TichuLastPlayed }) => {
    const g = globalThis as any;
    const savedUnderscore = g._;
    const savedThemeUrl = g.g_gamethemeurl;
    const translatedKeys: string[] = [];

    try {
      g._ = (s: string) => {
        translatedKeys.push(s);
        return s;
      };
      g.g_gamethemeurl = "/tichu/";

      const sharedCssRaw = (TichuLastPlayed.styles || [])
        .map((s: any) => s?.cssText ?? String(s ?? ""))
        .join("\n");
      assert.ok(
        sharedCssRaw.includes("var(--ui-icons-url)"),
        "Shared styles should reference var(--ui-icons-url)",
      );
      assert.ok(
        sharedCssRaw.includes("calc(var(--icon-size) * 4) calc(var(--icon-size) * 3)"),
        "Shared .icon styles should use the 4x3 sprite grid",
      );
      assert.equal(
        /url\(["']?img\//.test(sharedCssRaw),
        false,
        'Shared Shadow DOM CSS must not hardcode url("img/...")',
      );

      const status = new TichuStatus();
      const cssRaw = TichuStatus.styles?.cssText ?? String(TichuStatus.styles ?? "");
      assert.ok(cssRaw.includes("var(--ui-icons-url)"), "CSS should reference var(--ui-icons-url)");
      assert.ok(
        cssRaw.includes("calc(var(--icon-size) * 4) calc(var(--icon-size) * 3)"),
        "TichuStatus CSS should use the 4x3 sprite grid",
      );
      assert.ok(cssRaw.includes("var(--bg-color-lighter"), "Panel should match player boards");
      assert.ok(/var\(\s*--elevation\b/.test(cssRaw), "Panel should apply --elevation shadow");
      assert.ok(cssRaw.includes("border: none"), "Eye button should be borderless by default");
      assert.ok(
        cssRaw.includes("prefers-contrast: more"),
        "CSS should support prefers-contrast: more for subtle accents",
      );
      assert.ok(cssRaw.includes("cursor: default"), "Status rows should use default cursor");
      assert.equal(
        cssRaw.includes("cursor: help"),
        false,
        "Status rows should not show ? help cursor",
      );
      assert.ok(cssRaw.includes(".visually-hidden"), "CSS should include .visually-hidden helper");
      assert.ok(cssRaw.includes(":focus-visible"), "CSS should style :focus-visible");
      assert.equal(
        /url\(["']?img\//.test(cssRaw),
        false,
        'Shadow DOM CSS must not hardcode url("img/...")',
      );

      // 1. trickSize = 0 hides the Show current trick eye button while keeping the Scoreboard button
      status.roundCount = 2;
      status.trickCount = 5;
      status.trickPoints = -25;
      status.trickSize = 0;

      const htmlZero = serializeLitTemplate(status.render());
      assert.equal(status.style["--ui-icons-url"], "url(/tichu/img/tichu-ui-icons.png)");
      assert.match(htmlZero, /id=["']?roundCounter["']?[^>]*>2<\/span>/);
      assert.match(htmlZero, /id=["']?trickCounter["']?[^>]*>5<\/span>/);
      assert.match(htmlZero, /id=["']?currentTrickCounter["']?[^>]*>-25<\/span>/);

      assert.match(htmlZero, /data-tooltip=(?:"Round: 2"|Round: 2(?:\s|>))/);
      assert.match(htmlZero, /data-tooltip=(?:"Trick: 5"|Trick: 5(?:\s|>))/);
      assert.match(htmlZero, /data-tooltip=(?:"Trick Points: -25"|Trick Points: -25(?:\s|>))/);
      assert.equal(htmlZero.includes("title="), false);

      assert.match(htmlZero, /class="status-icon round"[^>]*aria-hidden="true"/);
      assert.match(htmlZero, /class="status-icon trick"[^>]*aria-hidden="true"/);
      assert.match(htmlZero, /class="status-icon points"[^>]*aria-hidden="true"/);
      assert.ok(htmlZero.includes('<span class="visually-hidden">Round: </span>'));
      assert.ok(htmlZero.includes('<span class="visually-hidden">Trick: </span>'));
      assert.ok(htmlZero.includes('<span class="visually-hidden">Trick Points: </span>'));
      assert.equal(htmlZero.includes("status-icon eye"), false);
      assert.ok(htmlZero.includes('class="status-actions"'));
      assert.match(htmlZero, /id=["']?showScores["']?/);
      assert.match(htmlZero, /class="status-icon scoreboard"[^>]*aria-hidden="true"/);

      // 2. trickSize = 4 renders both eye and scoreboard icon-only buttons inside .status-actions
      translatedKeys.length = 0;
      status.trickSize = 4;
      const htmlWithTrick = serializeLitTemplate(status.render());
      assert.ok(
        htmlWithTrick.includes('class="status-actions"'),
        "status-actions wrapper should render",
      );
      const btns = htmlWithTrick.match(/<button[\s\S]*?<\/button>/g) || [];
      assert.equal(
        btns.length,
        2,
        "Both eye and scoreboard buttons should render when trickSize > 0",
      );
      const eyeBtnHtml = btns[0]!;
      assert.ok(eyeBtnHtml.includes('type="button"'));
      assert.match(eyeBtnHtml, /data-tooltip=(?:"Show current trick"|Show current trick(?:\s|>))/);
      assert.match(eyeBtnHtml, /data-tooltip-touch=(?:"longpress"|longpress(?:\s|>))/);
      assert.equal(eyeBtnHtml.includes("title="), false);
      assert.match(eyeBtnHtml, /aria-label=(?:"Show current trick"|Show current trick(?:\s|>))/);
      assert.match(eyeBtnHtml, /class="status-icon eye"[^>]*aria-hidden="true"/);
      assert.equal(
        eyeBtnHtml.replace(/<[^>]+>/g, "").trim(),
        "",
        "Eye button should contain no visible text",
      );

      const scoreBtnHtml = btns[1]!;
      assert.ok(scoreBtnHtml.includes('type="button"'));
      assert.match(scoreBtnHtml, /id=["']?showScores["']?/);
      assert.match(scoreBtnHtml, /data-tooltip=(?:"Scoreboard"|Scoreboard(?:\s|>))/);
      assert.match(scoreBtnHtml, /aria-label=(?:"Scoreboard"|Scoreboard(?:\s|>))/);
      assert.match(scoreBtnHtml, /class="status-icon scoreboard"[^>]*aria-hidden="true"/);
      assert.equal(
        scoreBtnHtml.replace(/<[^>]+>/g, "").trim(),
        "",
        "Scoreboard button should contain no visible text",
      );
      assert.deepEqual(translatedKeys, [
        "Round:",
        "Trick:",
        "Trick Points:",
        "Show current trick",
        "Scoreboard",
      ]);

      // 3. roundOnly mode (used on <tichu-pass-area>) renders roundCounter + Scoreboard button and hides trick/points/eye
      translatedKeys.length = 0;
      status.roundOnly = true;
      const htmlRoundOnly = serializeLitTemplate(status.render());
      assert.match(htmlRoundOnly, /id=["']?roundCounter["']?[^>]*>2<\/span>/);
      assert.equal(htmlRoundOnly.includes("trickCounter"), false);
      assert.equal(htmlRoundOnly.includes("currentTrickCounter"), false);
      assert.equal(htmlRoundOnly.includes("status-icon eye"), false);
      assert.match(htmlRoundOnly, /id=["']?showScores["']?/);
      assert.deepEqual(translatedKeys, ["Round:", "Scoreboard"]);
    } finally {
      g._ = savedUnderscore;
      g.g_gamethemeurl = savedThemeUrl;
    }
  });
});

test("Settings modal: GameModel state, pref 102 two-way sync, TichuHand gear button, and TichuSettingsModal controls", async () => {
  await withMockLitEnv(({ TichuHand, TichuSettingsModal, getThemeLabel }) => {
    const g = globalThis as any;
    const savedUnderscore = g._;
    const savedGameModel = g.window.gameModel;
    const savedGameUi = g.window.gameui;
    const savedArchiveMode = g.g_archive_mode;
    const { Tichu, declaredClass } = loadTichuAdapterForNodeTests();

    try {
      g._ = (s: string) => s;

      // 1. GameModel settingsModalOpen$ lifecycle
      const model = new GameModel();
      const observedOpen: boolean[] = [];
      const sub = model.settingsModalOpen$.subscribe((v) => observedOpen.push(v));
      assert.equal(model.getState().settingsModalOpen, false);
      model.setSettingsModalOpen(true);
      assert.equal(model.getState().settingsModalOpen, true);
      model.setSettingsModalOpen(false);
      assert.equal(model.getState().settingsModalOpen, false);
      model.setSettingsModalOpen(true);

      model.hydrateFromGamedatas(
        {
          players: {
            "2385074": { id: "2385074", name: "p0", color: "000000", no: 1, score: "0" } as any,
          },
          gamestate: {
            id: "50",
            name: "playCombo",
            type: "activeplayer",
            active_player: "2385074",
            args: {},
          } as any,
          hand: [A5, B6],
        },
        "2385074",
        false,
        true,
      );
      assert.equal(
        model.getState().settingsModalOpen,
        false,
        "hydrateFromGamedatas resets settingsModalOpen to false",
      );
      assert.deepEqual(observedOpen, [false, true, false, true, false]);
      sub.unsubscribe();

      // 2. Tichu pref 102 two-way sync
      g.window.gameModel = model;
      const ui = new (declaredClass || Tichu)();
      ui.player_id = 2385074;
      ui.isSpectator = false;
      ui.isReadOnly = () => false;
      const persistedPrefs: Array<[number, number]> = [];
      ui.prefs = { 102: { value: 1 } };
      ui.getGameUserPreference = (id: number) => ui.prefs[id]?.value ?? 1;
      ui.setGameUserPreference = (id: number, val: number) => {
        persistedPrefs.push([id, val]);
        ui.prefs[id] = { value: val };
      };
      ui.changeConfirmPassWithSelection(false);
      assert.equal(model.getState().confirmPassWithSelection, false);
      assert.deepEqual(persistedPrefs.at(-1), [102, 2]);
      ui.changeConfirmPassWithSelection(true);
      assert.equal(model.getState().confirmPassWithSelection, true);
      assert.deepEqual(persistedPrefs.at(-1), [102, 1]);
      ui.onPreferenceChange(102, 2);
      assert.equal(model.getState().confirmPassWithSelection, false);
      ui.onPreferenceChange(102, 1);
      assert.equal(model.getState().confirmPassWithSelection, true);

      // 3. TichuHand omits #prefs/#themes, renders gear button, and opens settings modal
      const hand = new TichuHand();
      hand.performUpdate = () => {};
      hand.connectedCallback();
      try {
        const handHtml = serializeLitTemplate(hand.render());
        assert.equal(handHtml.includes('id="prefs"'), false);
        assert.equal(handHtml.includes('id="themes"'), false);
        assert.ok(handHtml.includes('id="settings_button"'));
        assert.ok(handHtml.includes('aria-haspopup="dialog"'));
        assert.match(handHtml, /aria-expanded=(?:"false"|false)/);
        assert.equal(handHtml.includes("spectator-settings-bar"), false);

        hand.onOpenSettings();
        assert.equal(model.getState().settingsModalOpen, true);
        const handHtmlOpen = serializeLitTemplate(hand.render());
        assert.match(handHtmlOpen, /aria-expanded=(?:"true"|true)/);

        // Spectator mode keeps gear button accessible in .spectator-settings-bar
        model.update({ isSpectator: true });
        const specHandHtml = serializeLitTemplate(hand.render());
        assert.ok(specHandHtml.includes("spectator-settings-bar"));
        assert.ok(specHandHtml.includes('id="settings_button"'));
        model.update({ isSpectator: false });
      } finally {
        hand.disconnectedCallback();
      }

      // 4. TichuSettingsModal rendering, labels, and handler delegation
      for (let t = 0; t <= 10; t++) {
        assert.ok(getThemeLabel(t).length > 0, `Theme ${t} should have a non-empty label`);
      }

      const calls: Array<[string, unknown]> = [];
      const mockUi = {
        onReorderByRank: () => calls.push(["rank", true]),
        onReorderByColor: () => calls.push(["color", true]),
        onReorderTable: (sq: boolean) => calls.push(["table", sq]),
        changeOrder: (cw: boolean) => calls.push(["order", cw]),
        changeTiki: (tiki: boolean) => calls.push(["tiki", tiki]),
        changeAnimations: (en: boolean) => calls.push(["animations", en]),
        changeConfirmPassWithSelection: (en: boolean) => calls.push(["confirmPass", en]),
        setTheme: (th: number) => calls.push(["theme", th]),
        toggleExperimentalReplay: (en: boolean) => calls.push(["replay", en]),
      };
      g.window.gameui = mockUi;

      const modal = new TichuSettingsModal();
      modal.performUpdate = () => {};
      modal.connectedCallback();
      try {
        g.g_archive_mode = false;
        g.window.g_archive_mode = false;
        const modalHtml = serializeLitTemplate(modal.render());
        assert.ok(modalHtml.includes('id="tichu-settings-dialog"'));
        assert.ok(modalHtml.includes('closedby="any"'));
        assert.ok(modalHtml.includes("Card order"));
        assert.ok(modalHtml.includes("Table Layout"));
        assert.ok(modalHtml.includes("Order of play"));
        assert.ok(modalHtml.includes("Tiki Edition Art"));
        assert.ok(modalHtml.includes("Animations"));
        assert.ok(modalHtml.includes("Prevent passing when cards are selected"));
        assert.ok(modalHtml.includes("Color Theme"));
        assert.equal(modalHtml.includes('id="expReplay"'), false);
        for (let t = 0; t <= 10; t++) {
          assert.ok(modalHtml.includes(`theme${t}`), `Expected theme${t} card in settings modal`);
        }

        g.g_archive_mode = true;
        g.window.g_archive_mode = true;
        const modalArchiveHtml = serializeLitTemplate(modal.render());
        assert.ok(modalArchiveHtml.includes('id="expReplay"'));

        modal.onHandSortChange("color");
        modal.onHandSortChange("rank");
        modal.onTableLayoutChange(true);
        modal.onClockwiseChange(true);
        modal.onTikiChange(true);
        modal.onAnimationsChange(false);
        modal.onConfirmPassChange(false);
        modal.onThemeSelect(7);
        modal.onExpReplay();

        assert.deepEqual(calls, [
          ["color", true],
          ["rank", true],
          ["table", true],
          ["order", true],
          ["tiki", true],
          ["animations", false],
          ["confirmPass", false],
          ["theme", 7],
          ["replay", true],
        ]);
        assert.equal(model.getState().handSortOrder, "rank");
        assert.equal(model.getState().squareTable, true);
        assert.equal(model.getState().clockwise, true);
        assert.equal(model.getState().isTiki, true);
        assert.equal(model.getState().animationsEnabled, false);
        assert.equal(model.getState().confirmPassWithSelection, false);
        assert.equal(model.getState().theme, 7);
        assert.equal(model.getState().experimentalReplayOpen, true);
        assert.equal(model.getState().settingsModalOpen, false);

        model.setSettingsModalOpen(true);
        modal.onDialogClose();
        assert.equal(model.getState().settingsModalOpen, false);
        model.setSettingsModalOpen(true);
        modal.onClose();
        assert.equal(model.getState().settingsModalOpen, false);
      } finally {
        modal.disconnectedCallback();
      }
    } finally {
      g._ = savedUnderscore;
      g.window.gameModel = savedGameModel;
      g.window.gameui = savedGameUi;
      g.g_archive_mode = savedArchiveMode;
      g.window.g_archive_mode = savedArchiveMode;
    }
  });
});

test("setupNotifications() double-timer invariant and dynamic durations for pass, passCards early return, wishMade, and newScores", async () => {
  await withMockLitEnv(() => {
    const g = globalThis as any;
    const { Tichu, declaredClass } = loadTichuAdapterForNodeTests();
    const { resetAnimTimings, installWindowAnimTimings } = require("../src/elements/anim-timings");
    installWindowAnimTimings();
    resetAnimTimings();

    const savedGameModel = g.window.gameModel;
    const savedGameUi = g.window.gameui;
    const savedDojo = g.dojo;
    try {
      const subscriptions: Array<[string, string]> = [];
      g.dojo = {
        subscribe(type: string, _ctx: any, methodName: string) {
          subscriptions.push([type, methodName]);
        },
      };

      const ui = new (declaredClass || Tichu)();
      ui.player_id = 2385074;
      ui.isSpectator = false;
      ui.instantaneousMode = false;
      ui.bgaAnimationsActive = () => true;
      ui.isReadOnly = () => false;
      ui.disablePlayerPanel = () => {};
      ui.scoreCtrl = {};
      ui.prefs = { 105: { value: 1 } };
      ui.getGameUserPreference = (id: number) => (id === 105 ? ui.prefs[105].value : 1);

      const registeredSync = new Map<string, number | undefined>();
      const syncDurations: number[] = [];
      ui.notifqueue = {
        setSynchronous(type: string, dur: number | undefined) {
          registeredSync.set(type, dur);
        },
        setSynchronousDuration(ms: number) {
          syncDurations.push(ms);
        },
      };

      ui.setupNotifications();

      const dynamicNotifs = [
        "dealCards",
        "grandTichuBet",
        "tichuBet",
        "playCombo",
        "wishMade",
        "pass",
        "captureCards",
        "newScores",
        "acceptCards",
        "passCards",
      ];
      for (const name of dynamicNotifs) {
        assert.equal(
          registeredSync.get(name),
          undefined,
          `Expected '${name}' to register undefined duration to avoid double-timer collisions`,
        );
      }
      const staticNotifs = [
        "confirmTichu",
        "mahjongWishGranted",
        "playerGoOut",
        "autopass",
        "devConsole",
        "botSuggestion",
      ];
      for (const name of staticNotifs) {
        assert.equal(registeredSync.get(name), 1);
      }

      const model = new GameModel();
      ui.gamedatas = {
        players: {
          "2385074": { id: "2385074", name: "p0", color: "000000", no: 1, score: "0" },
          "2385075": { id: "2385075", name: "p1", color: "ff0000", no: 2, score: "0" },
        },
        gamestate: { id: "60", name: "playCombo", type: "activeplayer", args: {} },
        hand: [],
      };
      model.hydrateFromGamedatas(ui.gamedatas, "2385074", false, true, ui.readPrefs());
      g.window.gameModel = model;
      g.window.gameui = ui;

      // Early malformed passCards return must still call setSynchronousDuration(1)
      ui.notif_passCards({ args: { cardIds: null } as any });
      assert.equal(syncDurations.at(-1), 1);

      // Dynamic durations when animations are active
      ui.getAnimationLayer = () => ({
        getPassNotifDuration: () => 130,
        runPassTokenPop: () => Promise.resolve(),
      });
      ui.notif_pass({ args: { player_id: 2385075 } });
      assert.equal(syncDurations.at(-1), 130);

      ui.notif_wishMade({ args: { wish: 7 } });
      assert.equal(syncDurations.at(-1), 150);

      ui.notif_newScores({ args: { newScores: { "2385074": 120, "2385075": -20 } } });
      assert.equal(syncDurations.at(-1), 700);

      // Pref 105 disabled -> all three fall back to 1ms
      ui.onPreferenceChange(105, 2);
      ui.notif_pass({ args: { player_id: 2385075 } });
      assert.equal(syncDurations.at(-1), 1);

      ui.notif_wishMade({ args: { wish: 8 } });
      assert.equal(syncDurations.at(-1), 1);

      ui.notif_newScores({ args: { newScores: { "2385074": 150, "2385075": -50 } } });
      assert.equal(syncDurations.at(-1), 1);
    } finally {
      resetAnimTimings();
      g.dojo = savedDojo;
      g.window.gameModel = savedGameModel;
      g.window.gameui = savedGameUi;
    }
  });
});

test("ANIM_TIMINGS and window.__tichuAnim proxy live mutation, presets, reset, and CSS variable sync", async () => {
  await withMockLitEnv(() => {
    const g = globalThis as any;
    const {
      ANIM_TIMINGS,
      installWindowAnimTimings,
      resetAnimTimings,
    } = require("../src/elements/anim-timings");

    const cssVars = new Map<string, string>();
    g.document.documentElement = {
      style: {
        setProperty(k: string, v: string) {
          cssVars.set(k, v);
        },
      },
    };
    const model = new GameModel();
    g.window.gameModel = model;

    try {
      installWindowAnimTimings();
      resetAnimTimings();

      const ctrl = g.window.__tichuAnim;
      assert.ok(ctrl);
      assert.equal(ctrl.playComboMs, 180);
      assert.equal(ctrl.cardSelectMs, 100);
      assert.equal(ctrl.betSplashNotifMs, 600);
      assert.deepEqual(ctrl.presets, ["snappy", "legacy", "fast", "relaxed"]);
      assert.equal(cssVars.get("--tichu-card-select-ms"), "100ms");
      assert.equal(cssVars.get("--tichu-bet-enter-ms"), "140ms");

      // Live property mutation syncs ANIM_TIMINGS and CSS vars
      ctrl.cardSelectMs = 145;
      assert.equal(ANIM_TIMINGS.cardSelectMs, 145);
      assert.equal(cssVars.get("--tichu-card-select-ms"), "145ms");

      // Preset switching
      ctrl.preset("legacy");
      assert.equal(ANIM_TIMINGS.playComboMs, 250);
      assert.equal(ANIM_TIMINGS.acceptViewDelayMs, 1200);
      assert.equal(cssVars.get("--tichu-card-select-ms"), "0ms");

      ctrl.preset("fast");
      assert.equal(ANIM_TIMINGS.playComboMs, 120);
      assert.equal(ANIM_TIMINGS.acceptViewDelayMs, 550);

      // Disabling animations via GameModel forces CSS transition vars to 0ms and restoring recovers them
      model.setAnimationsEnabled(false);
      assert.equal(cssVars.get("--tichu-card-select-ms"), "0ms");
      assert.equal(cssVars.get("--tichu-bet-fade-ms"), "0ms");

      model.setAnimationsEnabled(true);
      assert.equal(cssVars.get("--tichu-card-select-ms"), "70ms");

      // Reset restores snappy defaults
      ctrl.reset();
      assert.equal(ANIM_TIMINGS.playComboMs, 180);
      assert.equal(ANIM_TIMINGS.cardSelectMs, 100);
      assert.equal(cssVars.get("--tichu-card-select-ms"), "100ms");
    } finally {
      resetAnimTimings();
      g.window.gameModel = undefined;
    }
  });
});

test("TichuAnimationLayer::flyCards creates synchronous ghost-card divs, kink-free fadeIn/pulse keyframes, and cleans up after onCleanup", async () => {
  await withMockLitEnv(async ({ TichuAnimationLayer }) => {
    const g = globalThis as any;
    const { resetAnimTimings } = require("../src/elements/anim-timings");
    resetAnimTimings();

    const createdTags: string[] = [];
    const animateCalls: Array<{ keyframes: any[]; options: any }> = [];
    const shadowChildren: any[] = [];
    const events: string[] = [];

    class RecordingElement {
      tagName: string;
      className = "";
      children: RecordingElement[] = [];
      style: Record<string, any> = {};
      private attrs = new Map<string, string>();
      constructor(tag: string) {
        this.tagName = tag.toLowerCase();
      }
      appendChild(child: RecordingElement) {
        this.children.push(child);
        return child;
      }
      setAttribute(k: string, v: string) {
        this.attrs.set(k, String(v));
      }
      getAttribute(k: string) {
        return this.attrs.has(k) ? this.attrs.get(k)! : null;
      }
      remove() {
        const idx = shadowChildren.indexOf(this);
        if (idx >= 0) shadowChildren.splice(idx, 1);
        events.push(`remove:${this.className}`);
      }
      animate(keyframes: any[], options: any) {
        animateCalls.push({ keyframes, options });
        return {
          finished: Promise.resolve(),
          cancel() {},
        };
      }
    }

    g.document.createElement = (tag: string) => {
      createdTags.push(tag.toLowerCase());
      return new RecordingElement(tag);
    };
    g.document.getElementById = () => null;
    const model = new GameModel();
    g.window.gameModel = model;

    try {
      const layer = Object.create(TichuAnimationLayer.prototype);
      layer.activeBatches = new Set();
      layer.totalFlights = 0;
      layer.setAttribute = () => {};
      Object.defineProperty(layer, "shadowRoot", {
        value: {
          appendChild(el: any) {
            shadowChildren.push(el);
            return el;
          },
          querySelectorAll(sel: string) {
            if (sel === ".ghost-wrapper") {
              return shadowChildren.filter((el) => el.className === "ghost-wrapper");
            }
            return [];
          },
        },
        configurable: true,
      });

      const fromRect = new MockDOMRect(100, 200, 58, 87) as any;
      const toRect = new MockDOMRect(300, 260, 75, 112.5) as any;

      await layer.flyCards(
        [
          {
            card: AA,
            fromRect,
            toRect,
            durationMs: 200,
            fadeIn: true,
            pulse: true,
          },
          {
            card: { id: "pass_2385075", type: "0", type_arg: "0" },
            fromRect,
            toRect,
            durationMs: 200,
            pass: true,
          },
        ],
        () => {
          events.push(`cleanup:ghosts=${shadowChildren.length}`);
        },
      );

      // Only plain div ghosts are created (never tichu-card LitElements)
      assert.equal(createdTags.includes("tichu-card"), false);
      assert.deepEqual(createdTags, ["div", "div", "div", "div"]);
      assert.equal(animateCalls.length, 2);

      // Verify synchronous styles and keyframes on first card (fadeIn + pulse)
      const kf0 = animateCalls[0]!.keyframes;
      assert.equal(kf0.length, 4);
      assert.equal(kf0[0].offset, 0);
      assert.equal(kf0[0].opacity, 0);
      assert.equal(kf0[1].offset, 0.25);
      assert.equal(kf0[1].opacity, 1);
      assert.equal("transform" in kf0[1], false);
      assert.equal(kf0[2].offset, 0.5);
      assert.equal("opacity" in kf0[2], false);
      assert.ok(String(kf0[2].transform).includes("scale("));
      assert.equal(kf0[3].offset, 1);
      assert.equal(kf0[3].opacity, 1);

      // Verify cleanup callback runs BEFORE ghost wrappers are removed from shadow DOM
      assert.equal(events[0], "cleanup:ghosts=2");
      assert.equal(events[1], "remove:ghost-wrapper");
      assert.equal(events[2], "remove:ghost-wrapper");
      assert.equal(shadowChildren.length, 0);
    } finally {
      resetAnimTimings();
    }
  });
});

test("TichuCard::getComputedTooltipParts returns structured special tooltips and touch gestures", async () => {
  await withMockLitEnv(({ TichuCardEl }) => {
    const g = globalThis as any;
    const savedUnderscore = g._;
    try {
      g._ = (s: string) => s;

      // 1. Dragon has structured slow-tier rules tooltip; passedOrigin lives on the avatar badge (fast)
      const card = new TichuCardEl();
      card.card = { id: "53", type: "1", type_arg: "1" };
      card.selectable = true;
      card.reserveFooter = true;
      card.passedOrigin = {
        playerId: "2385076",
        playerName: "dashwood2",
        avatarUrl: "",
        seat: "partner",
        tooltip: "Passed by dashwood2 (Partner)",
        showGlow: true,
        showAvatar: true,
      };
      assert.deepEqual(card.getComputedTooltipParts(), {
        title: "Dragon",
        body: "Highest single card. Scores 25 points. Trick given to an opponent if Dragon wins it.",
        meta: "",
      });
      const dragonHtml = serializeLitTemplate(card.render());
      assert.match(dragonHtml, /data-tooltip-title=["']?Dragon["']?/);
      assert.match(dragonHtml, /data-tooltip-tier=["']?slow["']?/);
      assert.match(dragonHtml, /data-tooltip-touch=["']?longpress["']?/);
      assert.match(
        dragonHtml,
        /class=["']?passed-avatar-wrap[^"'\n]*["']?[^>]*data-tooltip=["']?Passed by dashwood2 \(Partner\)["']?[^>]*data-tooltip-touch=["']?tap["']?/,
      );
      assert.equal(/\stitle=/.test(dragonHtml), false);

      // 2. Normal cards (2, 5, 10, K) have no card-face tooltip (even with passedOrigin; avatar badge carries origin)
      for (const rank of ["2", "5", "10", "13"]) {
        card.card = { id: rank, type: "1", type_arg: rank };
        card.selectable = false;
        assert.deepEqual(card.getComputedTooltipParts(), {
          title: "",
          body: "",
          meta: "",
        });
      }
      const twoHtml = serializeLitTemplate(card.render());
      assert.equal(/id=["']?card["']?[^>]*data-tooltip=[^\s>]/.test(twoHtml), false);
      assert.equal(/id=["']?card["']?[^>]*data-tooltip-tier=[^\s>]/.test(twoHtml), false);
      assert.equal(/\stitle=/.test(twoHtml), false);

      // 3. Phoenix, Dog, Mahjong have titles; disableTooltip suppresses all card tooltips (e.g. inside #lastcombo)
      card.passedOrigin = null;
      card.card = { id: "54", type: "2", type_arg: "1" };
      assert.equal(card.getComputedTooltipParts().title, "Phoenix");
      card.card = { id: "55", type: "3", type_arg: "1" };
      assert.equal(card.getComputedTooltipParts().title, "Dog");
      card.card = { id: "56", type: "4", type_arg: "1" };
      assert.equal(card.getComputedTooltipParts().title, "Mahjong");
      card.disableTooltip = true;
      assert.deepEqual(card.getComputedTooltipParts(), { title: "", body: "", meta: "" });
      card.disableTooltip = false;

      // 4. Pass placeholder card has no tooltip
      card.pass = true;
      assert.equal(card.getComputedTooltip(), "");
      const passHtml = serializeLitTemplate(card.render());
      assert.equal(passHtml.includes("data-tooltip="), false);
    } finally {
      g._ = savedUnderscore;
    }
  });
});

test("TichuTooltipLayer positioning, touch mode resolution, hover/warm/Escape, and touch gestures", async () => {
  await withMockLitEnv(
    ({
      TichuTooltipLayer,
      TOOLTIP_TIMINGS,
      computeTooltipPosition,
      resolveTouchMode,
      resolveTooltipTier,
      areSlowTooltipsHidden,
    }) => {
      // 1. computeTooltipPosition: top placement, flip to bottom, horizontal clamp & arrowX clamp
      const topNormal = computeTooltipPosition(
        { left: 400, top: 300, right: 440, bottom: 324, width: 40, height: 24 },
        { width: 160, height: 40 },
        { width: 1000, height: 800 },
        10,
        10,
      );
      assert.equal(topNormal.placement, "top");
      assert.equal(topNormal.left, 340);
      assert.equal(topNormal.top, 250);
      assert.equal(topNormal.arrowX, 80);

      const flippedBottom = computeTooltipPosition(
        { left: 6, top: 12, right: 30, bottom: 36, width: 24, height: 24 },
        { width: 180, height: 44 },
        { width: 390, height: 844 },
        10,
        10,
      );
      assert.equal(flippedBottom.placement, "bottom");
      assert.equal(flippedBottom.left, 10);
      assert.equal(flippedBottom.top, 46);
      assert.equal(flippedBottom.arrowX, 14);

      // 2. resolveTouchMode: disabled -> tap, interactive -> longpress, static -> tap, explicit override
      const makeEl = (tag: string, attrs: Record<string, string> = {}, classes: string[] = []) => {
        const classSet = new Set(classes);
        return {
          tagName: tag,
          classList: { contains: (c: string) => classSet.has(c) },
          getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
          contains: (other: any) => other === this,
          matches: () => false,
          getBoundingClientRect: () => ({
            left: 200,
            top: 200,
            right: 260,
            bottom: 230,
            width: 60,
            height: 30,
          }),
        } as any;
      };
      assert.equal(resolveTouchMode(makeEl("DIV")), "tap");
      assert.equal(resolveTouchMode(makeEl("BUTTON")), "longpress");
      assert.equal(resolveTouchMode(makeEl("A", {}, ["action-button", "disabled"])), "tap");
      assert.equal(resolveTouchMode(makeEl("A", { "aria-disabled": "true" })), "tap");
      assert.equal(resolveTouchMode(makeEl("DIV", {}, ["card", "selectable"])), "longpress");
      assert.equal(resolveTouchMode(makeEl("BUTTON", { "data-tooltip-touch": "tap" })), "tap");

      // 3. Interactive delegation & timers
      const g = globalThis as any;
      const savedSetTimeout = g.setTimeout;
      const savedClearTimeout = g.clearTimeout;
      const savedDateNow = Date.now;
      const savedDoc = g.document;
      const savedWin = g.window;

      let nowMs = 10000;
      let nextTimerId = 1;
      const timers = new Map<number, { fn: () => void; at: number }>();
      const docListeners = new Map<string, Set<Function>>();
      const winListeners = new Map<string, Set<Function>>();

      const emit = (type: string, eventInit: Record<string, any> = {}, onWin = false) => {
        const evt = {
          type,
          defaultPrevented: false,
          propagationStopped: false,
          preventDefault() {
            this.defaultPrevented = true;
          },
          stopPropagation() {
            this.propagationStopped = true;
          },
          composedPath: () => eventInit.path ?? [eventInit.target].filter(Boolean),
          ...eventInit,
        };
        const map = onWin ? winListeners : docListeners;
        for (const fn of [...(map.get(type) ?? [])]) {
          fn(evt);
        }
        return evt;
      };

      const advance = (ms: number) => {
        nowMs += ms;
        let ran = true;
        while (ran) {
          ran = false;
          for (const [id, entry] of [...timers.entries()]) {
            if (entry.at <= nowMs) {
              timers.delete(id);
              entry.fn();
              ran = true;
            }
          }
        }
      };

      try {
        Date.now = () => nowMs;
        g.setTimeout = (fn: () => void, delay = 0) => {
          const id = nextTimerId++;
          timers.set(id, { fn, at: nowMs + delay });
          return id;
        };
        g.clearTimeout = (id: number) => {
          timers.delete(id);
        };
        g.document = {
          ...savedDoc,
          addEventListener(type: string, fn: Function) {
            if (!docListeners.has(type)) docListeners.set(type, new Set());
            docListeners.get(type)!.add(fn);
          },
          removeEventListener(type: string, fn: Function) {
            docListeners.get(type)?.delete(fn);
          },
        };
        g.window = {
          ...savedWin,
          addEventListener(type: string, fn: Function) {
            if (!winListeners.has(type)) winListeners.set(type, new Set());
            winListeners.get(type)!.add(fn);
          },
          removeEventListener(type: string, fn: Function) {
            winListeners.get(type)?.delete(fn);
          },
        };

        const layer = new TichuTooltipLayer();
        layer.performUpdate = () => {};
        const cssRaw = TichuTooltipLayer.styles?.cssText ?? String(TichuTooltipLayer.styles ?? "");
        assert.ok(cssRaw.includes("var(--tichu-tooltip-bg"), "Should use theme tooltip bg var");
        assert.ok(
          cssRaw.includes("overflow: visible"),
          "Should override UA [popover] overflow: auto so the protruding arrow never triggers a scrollbar",
        );
        assert.ok(
          cssRaw.includes(":is(.open, :popover-open)"),
          "Should combine .open and :popover-open with :is() for forgiving selector parsing",
        );
        assert.ok(cssRaw.includes("prefers-reduced-motion: reduce"));

        layer.connectedCallback();
        try {
          const statEl = makeEl("DIV", {
            "data-tooltip": "Cards in hand",
            "data-tooltip-touch": "tap",
          });
          const iconInner = makeEl("SPAN");
          statEl.contains = (n: any) => n === statEl || n === iconInner;

          const starEl = makeEl("DIV", {
            "data-tooltip": "Points captured",
            "data-tooltip-touch": "tap",
          });
          starEl.contains = (n: any) => n === starEl;

          // Hover delay: 199ms still closed, 200ms opens via composedPath across shadow boundary
          emit("pointerover", { pointerType: "mouse", target: statEl, path: [iconInner, statEl] });
          advance(TOOLTIP_TIMINGS.hoverOpenMs - 1);
          assert.equal(layer.isOpen, false);
          advance(1);
          assert.equal(layer.isOpen, true);
          assert.equal(layer.bodyText, "Cards in hand");
          assert.equal(layer.activeTarget, statEl);

          // Moving onto tooltip box itself keeps it open (WCAG 1.4.13 hoverable)
          emit("pointerout", { pointerType: "mouse", relatedTarget: layer });
          emit("pointerover", { pointerType: "mouse", path: [layer] });
          advance(TOOLTIP_TIMINGS.hideGraceMs + 20);
          assert.equal(layer.isOpen, true);

          // Warm switch to another trigger opens in 30ms
          emit("pointerout", { pointerType: "mouse", relatedTarget: starEl });
          emit("pointerover", { pointerType: "mouse", path: [starEl] });
          advance(TOOLTIP_TIMINGS.warmOpenMs);
          assert.equal(layer.isOpen, true);
          assert.equal(layer.bodyText, "Points captured");

          // Escape dismisses without reopening until pointerout
          emit("keydown", { key: "Escape" });
          assert.equal(layer.isOpen, false);
          emit("pointerover", { pointerType: "mouse", path: [starEl] });
          advance(TOOLTIP_TIMINGS.hoverOpenMs + 50);
          assert.equal(layer.isOpen, false);
          emit("pointerout", { pointerType: "mouse", relatedTarget: null });

          // Touch tap on static element toggles open and closed; outside tap dismisses
          emit("pointerdown", {
            pointerType: "touch",
            pointerId: 1,
            clientX: 220,
            clientY: 210,
            path: [statEl],
          });
          emit("pointerup", {
            pointerType: "touch",
            pointerId: 1,
            clientX: 220,
            clientY: 210,
            path: [statEl],
          });
          assert.equal(layer.isOpen, true);
          assert.equal(layer.isTouchOpen, true);
          emit("pointerdown", {
            pointerType: "touch",
            pointerId: 2,
            clientX: 10,
            clientY: 10,
            path: [],
          });
          assert.equal(layer.isOpen, false);

          // Touch long-press on enabled button fires at 400ms and suppresses ensuing synthetic click
          const btnEl = makeEl("BUTTON", {
            "data-tooltip": "Bet 200 Points",
            "data-tooltip-touch": "longpress",
          });
          btnEl.contains = (n: any) => n === btnEl;
          emit("pointerdown", {
            pointerType: "touch",
            pointerId: 3,
            clientX: 220,
            clientY: 210,
            path: [btnEl],
          });
          advance(TOOLTIP_TIMINGS.longPressMs - 10);
          assert.equal(layer.isOpen, false);
          advance(10);
          assert.equal(layer.isOpen, true);
          assert.equal(layer.bodyText, "Bet 200 Points");
          emit("pointerup", {
            pointerType: "touch",
            pointerId: 3,
            clientX: 220,
            clientY: 210,
            path: [btnEl],
          });
          const blockedClick = emit("click", { path: [btnEl] });
          assert.equal(blockedClick.defaultPrevented, true);
          assert.equal(blockedClick.propagationStopped, true);

          // Drag >8px cancels long-press
          layer.hide();
          emit("pointerdown", {
            pointerType: "touch",
            pointerId: 4,
            clientX: 220,
            clientY: 210,
            path: [btnEl],
          });
          emit("pointermove", {
            pointerType: "touch",
            pointerId: 4,
            clientX: 235,
            clientY: 210,
            path: [btnEl],
          });
          advance(TOOLTIP_TIMINGS.longPressMs + 50);
          emit("pointerup", {
            pointerType: "touch",
            pointerId: 4,
            clientX: 235,
            clientY: 210,
            path: [btnEl],
          });
          assert.equal(layer.isOpen, false);

          // Disabled button tap shows tooltip immediately
          const disabledBtn = makeEl(
            "A",
            { "data-tooltip": "Combo does not beat 10", "aria-disabled": "true" },
            ["action-button", "disabled"],
          );
          emit("pointerdown", {
            pointerType: "touch",
            pointerId: 5,
            clientX: 220,
            clientY: 210,
            path: [disabledBtn],
          });
          emit("pointerup", {
            pointerType: "touch",
            pointerId: 5,
            clientX: 220,
            clientY: 210,
            path: [disabledBtn],
          });
          assert.equal(layer.isOpen, true);
          assert.equal(layer.bodyText, "Combo does not beat 10");
          layer.hide();
          advance(TOOLTIP_TIMINGS.warmWindowMs + 10);

          // 4. pointermove-only Shadow DOM hover lifecycle (no pointerover/pointerout)
          const makeMutableEl = (
            tag: string,
            initialAttrs: Record<string, string> = {},
            extra: Record<string, any> = {},
          ) => {
            const attrs: Record<string, string> = { ...initialAttrs };
            return {
              tagName: tag,
              id: extra.id ?? "",
              parentNode: extra.parentNode ?? null,
              shadowRoot: extra.shadowRoot ?? null,
              isConnected: true,
              classList: { contains: () => false },
              getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
              setAttribute: (k: string, v: string) => {
                attrs[k] = String(v);
              },
              contains: (other: any) => other === extra.self,
              matches: (sel: string) => (extra.focusVisible && sel === ":focus-visible") || false,
              getBoundingClientRect: () => ({
                left: 940,
                top: 290,
                right: 990,
                bottom: 310,
                width: 50,
                height: 20,
              }),
            } as any;
          };

          const tichuGameHost = makeMutableEl("TICHU-GAME");
          const boardBg = makeMutableEl("DIV", {}, { parentNode: tichuGameHost });
          const row0 = makeMutableEl(
            "DIV",
            { "data-tooltip": "Round: 1", "data-tooltip-touch": "tap" },
            { parentNode: boardBg },
          );
          const row0Icon = makeMutableEl("SPAN", {}, { parentNode: row0 });
          const row0Value = makeMutableEl("SPAN", {}, { parentNode: row0 });
          const row1 = makeMutableEl(
            "DIV",
            { "data-tooltip": "Trick: 1", "data-tooltip-touch": "tap" },
            { parentNode: boardBg },
          );
          const row2 = makeMutableEl(
            "DIV",
            { "data-tooltip": "Trick Points: 35", "data-tooltip-touch": "tap" },
            { parentNode: boardBg },
          );
          const trickBtn = makeMutableEl(
            "BUTTON",
            { "data-tooltip": "Show current trick", "data-tooltip-touch": "longpress" },
            { parentNode: boardBg, focusVisible: true },
          );
          const innerFocusHost = makeMutableEl(
            "TICHU-STATUS",
            {},
            {
              parentNode: boardBg,
              shadowRoot: { activeElement: trickBtn },
            },
          );
          tichuGameHost.shadowRoot = { host: tichuGameHost, activeElement: innerFocusHost };

          // Moving over neutral board space inside <tichu-game> opens nothing
          emit("pointermove", { pointerType: "mouse", path: [boardBg, tichuGameHost] });
          advance(TOOLTIP_TIMINGS.hoverOpenMs + 50);
          assert.equal(layer.isOpen, false);

          // Moving onto row0, then across child .status-icon and .status-value before hoverOpenMs does NOT reset the timer
          emit("pointermove", {
            pointerType: "mouse",
            path: [row0Icon, row0, boardBg, tichuGameHost],
          });
          advance(120);
          assert.equal(layer.isOpen, false);
          emit("pointermove", {
            pointerType: "mouse",
            path: [row0Value, row0, boardBg, tichuGameHost],
          });
          advance(TOOLTIP_TIMINGS.hoverOpenMs - 120);
          assert.equal(layer.isOpen, true);
          assert.equal(layer.bodyText, "Round: 1");
          assert.equal(layer.activeTarget, row0);

          // Direct pointermove transitions: row0 -> row1 -> gap -> row2 -> .trick-btn in warmOpenMs (30ms) without pointerover/pointerout
          emit("pointermove", { pointerType: "mouse", path: [row1, boardBg, tichuGameHost] });
          advance(TOOLTIP_TIMINGS.warmOpenMs);
          assert.equal(layer.isOpen, true);
          assert.equal(layer.bodyText, "Trick: 1");
          assert.equal(layer.activeTarget, row1);

          // Brief gap (< hideGraceMs) then onto row2
          emit("pointermove", { pointerType: "mouse", path: [boardBg, tichuGameHost] });
          advance(40);
          emit("pointermove", { pointerType: "mouse", path: [row2, boardBg, tichuGameHost] });
          advance(TOOLTIP_TIMINGS.warmOpenMs);
          assert.equal(layer.isOpen, true);
          assert.equal(layer.bodyText, "Trick Points: 35");
          assert.equal(layer.activeTarget, row2);

          // Live attribute change on hovered row2 updates bodyText on pointermove without hiding
          row2.setAttribute("data-tooltip", "Trick Points: 55");
          emit("pointermove", { pointerType: "mouse", path: [row2, boardBg, tichuGameHost] });
          assert.equal(layer.isOpen, true);
          assert.equal(layer.bodyText, "Trick Points: 55");

          // Move directly onto .trick-btn
          emit("pointermove", { pointerType: "mouse", path: [trickBtn, boardBg, tichuGameHost] });
          advance(TOOLTIP_TIMINGS.warmOpenMs);
          assert.equal(layer.isOpen, true);
          assert.equal(layer.bodyText, "Show current trick");
          assert.equal(layer.activeTarget, trickBtn);

          // Repeated pointermove over empty board space every 25ms still closes after hideGraceMs (110ms)
          emit("pointermove", { pointerType: "mouse", path: [boardBg, tichuGameHost] });
          advance(25);
          emit("pointermove", { pointerType: "mouse", path: [boardBg, tichuGameHost] });
          advance(25);
          emit("pointermove", { pointerType: "mouse", path: [boardBg, tichuGameHost] });
          advance(25);
          assert.equal(layer.isOpen, true);
          emit("pointermove", { pointerType: "mouse", path: [boardBg, tichuGameHost] });
          advance(35);
          assert.equal(
            layer.isOpen,
            false,
            "Continuous pointermove on empty space must not reset hideGraceMs",
          );

          // Escape suppression on pointermove clears only after leaving trigger
          advance(TOOLTIP_TIMINGS.warmWindowMs + 10);
          emit("pointermove", { pointerType: "mouse", path: [row0, boardBg, tichuGameHost] });
          advance(TOOLTIP_TIMINGS.hoverOpenMs);
          assert.equal(layer.isOpen, true);
          emit("keydown", { key: "Escape" });
          assert.equal(layer.isOpen, false);
          emit("pointermove", { pointerType: "mouse", path: [row0, boardBg, tichuGameHost] });
          advance(TOOLTIP_TIMINGS.hoverOpenMs + 50);
          assert.equal(
            layer.isOpen,
            false,
            "Escape must keep row0 suppressed while pointer stays on row0",
          );
          emit("pointermove", { pointerType: "mouse", path: [boardBg, tichuGameHost] });
          emit("pointermove", { pointerType: "mouse", path: [row0, boardBg, tichuGameHost] });
          advance(TOOLTIP_TIMINGS.hoverOpenMs);
          assert.equal(layer.isOpen, true, "Leaving row0 and returning re-enables tooltip");

          // Mouse pointerdown on enabled trigger hides and suppresses jitter reopen until moving off
          emit("pointerdown", { pointerType: "mouse", path: [row0, boardBg, tichuGameHost] });
          assert.equal(layer.isOpen, false);
          emit("pointermove", {
            pointerType: "mouse",
            path: [row0Value, row0, boardBg, tichuGameHost],
          });
          advance(TOOLTIP_TIMINGS.warmOpenMs + 50);
          assert.equal(
            layer.isOpen,
            false,
            "Click jitter over same trigger must not reopen immediately",
          );
          emit("pointermove", { pointerType: "mouse", path: [row1, boardBg, tichuGameHost] });
          advance(TOOLTIP_TIMINGS.warmOpenMs);
          assert.equal(layer.isOpen, true);
          assert.equal(layer.bodyText, "Trick: 1");

          // Triggers inside #studio-test-bar are ignored
          const devBar = makeMutableEl("DIV", {}, { id: "studio-test-bar" });
          const devBtn = makeMutableEl(
            "BUTTON",
            { "data-tooltip": "Run Smoke Test" },
            { parentNode: devBar },
          );
          emit("pointermove", { pointerType: "mouse", path: [devBtn, devBar] });
          advance(TOOLTIP_TIMINGS.hideGraceMs + 10);
          assert.equal(layer.isOpen, false, "#studio-test-bar triggers must be ignored");

          // Keyboard Tab inside nested Shadow DOM updates focus tooltip via deep activeElement walk, and window blur closes it
          g.document.activeElement = tichuGameHost;
          emit("keydown", { key: "Tab" });
          advance(0);
          assert.equal(layer.isOpen, true);
          assert.equal(layer.bodyText, "Show current trick");
          assert.equal(layer.activeTarget, trickBtn);

          const noTipBtn = makeMutableEl("BUTTON", {}, { parentNode: boardBg, focusVisible: true });
          innerFocusHost.shadowRoot.activeElement = noTipBtn;
          emit("keyup", { key: "Tab" });
          assert.equal(
            layer.isOpen,
            false,
            "Tabbing onto element without data-tooltip hides focus tooltip",
          );

          innerFocusHost.shadowRoot.activeElement = trickBtn;
          emit("keyup", { key: "Tab" });
          assert.equal(layer.isOpen, true);
          emit("blur", {}, true);
          assert.equal(layer.isOpen, false, "Window blur closes open tooltip");

          // 5. Two-tier timing (fast vs slow), no warm-open for slow, and BGA gameui.bHideTooltips suppression
          assert.equal(resolveTooltipTier(row0), "fast");
          const slowDragon = makeMutableEl(
            "DIV",
            {
              "data-tooltip-title": "Dragon",
              "data-tooltip": "Highest single card.",
              "data-tooltip-tier": "slow",
              "data-tooltip-touch": "longpress",
            },
            { parentNode: boardBg },
          );
          const slowPhoenix = makeMutableEl(
            "DIV",
            {
              "data-tooltip-title": "Phoenix",
              "data-tooltip": "Wildcard.",
              "data-tooltip-tier": "slow",
              "data-tooltip-touch": "longpress",
            },
            { parentNode: boardBg },
          );
          assert.equal(resolveTooltipTier(slowDragon), "slow");

          // Open a fast tooltip, then move onto a slow trigger: old fast tooltip hides immediately, slow waits full 1200ms
          advance(TOOLTIP_TIMINGS.warmWindowMs + 10);
          emit("pointermove", { pointerType: "mouse", path: [row0, boardBg, tichuGameHost] });
          advance(TOOLTIP_TIMINGS.hoverOpenMs);
          assert.equal(layer.isOpen, true);
          assert.equal(layer.bodyText, "Round: 1");

          emit("pointermove", { pointerType: "mouse", path: [slowDragon, boardBg, tichuGameHost] });
          assert.equal(layer.isOpen, false, "Moving from fast to slow must hide old fast tooltip");
          advance(TOOLTIP_TIMINGS.hoverOpenMs + 200);
          assert.equal(layer.isOpen, false, "Slow tooltip must not open at fast or warm timing");
          advance(TOOLTIP_TIMINGS.slowHoverOpenMs - (TOOLTIP_TIMINGS.hoverOpenMs + 200));
          assert.equal(layer.isOpen, true);
          assert.equal(layer.titleText, "Dragon");

          // Moving from slowDragon to slowPhoenix must NOT warm-open in 60ms
          emit("pointermove", {
            pointerType: "mouse",
            path: [slowPhoenix, boardBg, tichuGameHost],
          });
          assert.equal(
            layer.isOpen,
            false,
            "Switching between slow triggers hides previous slow tooltip",
          );
          advance(TOOLTIP_TIMINGS.warmOpenMs + 200);
          assert.equal(layer.isOpen, false, "Slow-to-slow must not warm-open");
          advance(TOOLTIP_TIMINGS.slowHoverOpenMs - (TOOLTIP_TIMINGS.warmOpenMs + 200));
          assert.equal(layer.isOpen, true);
          assert.equal(layer.titleText, "Phoenix");

          // Closing a slow tooltip must NOT warm-open a subsequent fast tooltip
          layer.hide();
          emit("pointermove", { pointerType: "mouse", path: [row0, boardBg, tichuGameHost] });
          advance(TOOLTIP_TIMINGS.warmOpenMs + 20);
          assert.equal(layer.isOpen, false, "Closing slow tooltip must not warm up fast tooltip");
          advance(TOOLTIP_TIMINGS.hoverOpenMs - (TOOLTIP_TIMINGS.warmOpenMs + 20));
          assert.equal(layer.isOpen, true);
          layer.hide();

          // BGA global bHideTooltips suppresses slow tooltips while keeping fast tooltips active
          const savedGameui = g.gameui;
          try {
            g.gameui = { bHideTooltips: true };
            assert.equal(areSlowTooltipsHidden(), true);

            emit("pointermove", {
              pointerType: "mouse",
              path: [slowDragon, boardBg, tichuGameHost],
            });
            advance(TOOLTIP_TIMINGS.slowHoverOpenMs + 100);
            assert.equal(
              layer.isOpen,
              false,
              "Slow tooltip must be suppressed when gameui.bHideTooltips is true",
            );
            assert.equal(
              layer.showForElement(slowDragon, false, "focus"),
              false,
              "showForElement must refuse slow tooltip when bHideTooltips is true",
            );

            // Fast tooltip still opens even when bHideTooltips is true
            advance(TOOLTIP_TIMINGS.warmWindowMs + 10);
            emit("pointermove", { pointerType: "mouse", path: [row0, boardBg, tichuGameHost] });
            advance(TOOLTIP_TIMINGS.hoverOpenMs);
            assert.equal(
              layer.isOpen,
              true,
              "Fast icon/error tooltip must still show when gameui.bHideTooltips is true",
            );
            assert.equal(layer.bodyText, "Round: 1");
            layer.hide();

            // When a slow child is nested inside a fast parent and bHideTooltips is true, hover falls through to the fast parent
            const fastParent = makeMutableEl(
              "DIV",
              { "data-tooltip": "Full house of Kings over 5s" },
              { parentNode: boardBg },
            );
            emit("pointermove", {
              pointerType: "mouse",
              path: [slowDragon, fastParent, boardBg, tichuGameHost],
            });
            advance(TOOLTIP_TIMINGS.hoverOpenMs);
            assert.equal(layer.isOpen, true);
            assert.equal(layer.bodyText, "Full house of Kings over 5s");
            layer.hide();
          } finally {
            g.gameui = savedGameui;
          }
        } finally {
          layer.disconnectedCallback();
          assert.equal(timers.size, 0, "All timers should be cleared on disconnect");
        }
      } finally {
        Date.now = savedDateNow;
        g.setTimeout = savedSetTimeout;
        g.clearTimeout = savedClearTimeout;
        g.document = savedDoc;
        g.window = savedWin;
      }
    },
  );
});

test("GameModel hydrates roundHistory, handles rollback fallback, and upserts live roundScore", () => {
  const model = new GameModel();
  const basePlayers = {
    "1": { id: "1", name: "Alice", color: "000000", no: 1, team: 0, score: "165" },
    "2": { id: "2", name: "Bob", color: "ff0000", no: 2, team: 1, score: "35" },
    "3": { id: "3", name: "Carol", color: "000000", no: 3, team: 0, score: "165" },
    "4": { id: "4", name: "Dave", color: "ff0000", no: 4, team: 1, score: "35" },
  };

  model.hydrateFromGamedatas(
    {
      players: basePlayers,
      round: 2,
      trick: 1,
      targetScore: 500,
      roundHistory: [
        {
          round: 1,
          cardPoints: [65, 35],
          doubleVictory: -1,
          bets: { "1": { type: "T", won: true, delta: 100 } },
          teamPoints: [165, 35],
          teamTotals: [165, 35],
        },
      ],
      gamestate: { name: "playComboOpen", active_player: "1" },
    } as any,
    "1",
    false,
    true,
  );

  assert.equal(model.getState().targetScore, 500);
  assert.equal(model.getState().players["1"]!.team, 0);
  assert.equal(model.getState().players["2"]!.team, 1);
  assert.equal(model.getState().roundHistory.length, 1);
  assert.equal(model.getState().roundHistory[0]!.bets["1"]!.delta, 100);

  // Upsert round 2 via applyNewScores with explicit roundScore
  const round2Record = {
    round: 2,
    cardPoints: [0, 0] as [number, number],
    doubleVictory: 1,
    bets: { "4": { type: "GT" as const, won: true, delta: 200 } },
    teamPoints: [0, 400] as [number, number],
    teamTotals: [165, 435] as [number, number],
  };
  model.applyNewScores({ "1": 165, "2": 435, "3": 165, "4": 435 }, round2Record);
  assert.equal(model.getState().roundHistory.length, 2);
  assert.equal(model.getState().roundHistory[1]!.doubleVictory, 1);

  // Idempotent upsert on duplicate round 2 notification
  model.applyNewScores({ "1": 165, "2": 435, "3": 165, "4": 435 }, round2Record);
  assert.equal(model.getState().roundHistory.length, 2);

  // Modal state toggle
  assert.equal(model.getState().scoreModalOpen, false);
  model.setScoreModalOpen(true);
  assert.equal(model.getState().scoreModalOpen, true);
  model.setScoreModalOpen(false);
  assert.equal(model.getState().scoreModalOpen, false);

  // Rollback fallback: missing roundHistory on Round 3 synthesizes prior row from player scores
  const rollbackModel = new GameModel();
  rollbackModel.hydrateFromGamedatas(
    {
      players: {
        "1": { id: "1", name: "Alice", color: "000000", no: 1, team: 0, score: "200" },
        "2": { id: "2", name: "Bob", color: "ff0000", no: 2, team: 1, score: "100" },
        "3": { id: "3", name: "Carol", color: "000000", no: 3, team: 0, score: "200" },
        "4": { id: "4", name: "Dave", color: "ff0000", no: 4, team: 1, score: "100" },
      },
      round: 3,
      trick: 0,
      gamestate: { name: "grandTichuBets" },
    } as any,
    "1",
    false,
    true,
  );
  assert.equal(rollbackModel.getState().roundHistory.length, 1);
  assert.equal(rollbackModel.getState().roundHistory[0]!.isSyntheticPrior, true);
  assert.equal(rollbackModel.getState().roundHistory[0]!.priorThroughRound, 2);
  assert.deepEqual(rollbackModel.getState().roundHistory[0]!.teamTotals, [200, 100]);

  // Rollback newScores without roundScore synthesizes round delta row
  rollbackModel.applyNewScores({ "1": 240, "2": 160, "3": 240, "4": 160 }, null);
  assert.equal(rollbackModel.getState().roundHistory.length, 2);
  assert.deepEqual(rollbackModel.getState().roundHistory[1]!.teamPoints, [40, 60]);
  assert.deepEqual(rollbackModel.getState().roundHistory[1]!.teamTotals, [240, 160]);
});

test("groupPlayersByTeam groups strictly by player.team across TEAM_1_2, TEAM_1_4, and TEAM_RANDOM", () => {
  // TEAM_1_2 style where player.team overrides alternating seats
  const groupedCustom = groupPlayersByTeam([
    { id: 10, name: "P1", no: 1, team: 0 },
    { id: 20, name: "P2", no: 2, team: 0 },
    { id: 30, name: "P3", no: 3, team: 1 },
    { id: 40, name: "P4", no: 4, team: 1 },
  ]);
  assert.deepEqual(
    groupedCustom.team0.map((p) => p.id),
    [10, 20],
  );
  assert.deepEqual(
    groupedCustom.team1.map((p) => p.id),
    [30, 40],
  );

  // TEAM_RANDOM with string team values and unsorted input order
  const groupedRandom = groupPlayersByTeam([
    { id: 4, name: "Dave", no: 4, team: "0" },
    { id: 2, name: "Bob", no: 2, team: "1" },
    { id: 3, name: "Carol", no: 3, team: "1" },
    { id: 1, name: "Alice", no: 1, team: "0" },
  ]);
  assert.deepEqual(
    groupedRandom.team0.map((p) => p.id),
    [1, 4],
  );
  assert.deepEqual(
    groupedRandom.team1.map((p) => p.id),
    [2, 3],
  );

  // Legacy fallback when team is omitted
  const groupedFallback = groupPlayersByTeam([
    { id: 1, name: "A", no: 1 },
    { id: 2, name: "B", no: 2 },
    { id: 3, name: "C", no: 3 },
    { id: 4, name: "D", no: 4 },
  ]);
  assert.deepEqual(
    groupedFallback.team0.map((p) => p.id),
    [1, 3],
  );
  assert.deepEqual(
    groupedFallback.team1.map((p) => p.id),
    [2, 4],
  );
});

test("TichuScoreBoard uses opaque fixed-layout table, no-scroll wrap, and unified single-line rows", async () => {
  await withMockLitEnv(({ TichuScoreBoard }) => {
    const cssRaw = (TichuScoreBoard.styles || [])
      .map((s: any) => s?.cssText ?? String(s ?? ""))
      .join("\n");
    assert.ok(cssRaw.includes("table-layout: fixed"), "Table must use fixed layout to truncate team names");
    assert.ok(
      /\.score-table-wrap[\s\S]*?background:\s*var\(--tichu-dialog-surface/.test(cssRaw),
      "score-table-wrap must have an opaque surface background beneath zebra/current rows",
    );
    assert.ok(cssRaw.includes(":host([compact])"), "CSS should style compact host card");
    assert.equal(
      cssRaw.includes("overflow-y: auto"),
      false,
      "Compact scoreboard must never create an internal vertical scrollbar",
    );

    const board = new TichuScoreBoard();
    board.players = [
      { id: "1", name: "Alice", no: 1, team: 0 },
      { id: "2", name: "Bob", no: 2, team: 1 },
      { id: "3", name: "Carol", no: 3, team: 0 },
      { id: "4", name: "Dave", no: 4, team: 1 },
    ];
    board.rounds = [
      {
        round: 1,
        cardPoints: [0, 0],
        doubleVictory: 0,
        bets: { "1": { type: "GT", won: true, delta: 200 } },
        teamPoints: [400, 0],
        teamTotals: [400, 0],
      },
      {
        round: 2,
        cardPoints: [65, 35],
        doubleVictory: -1,
        bets: { "2": { type: "T", won: false, delta: -100 } },
        teamPoints: [65, -65],
        teamTotals: [465, -65],
      },
    ];
    board.currentRound = 2;

    // Both compact (replay) and full (live modal) render the unified single-line layout with title details
    for (const isCompact of [true, false]) {
      board.compact = isCompact;
      const htmlStr = serializeLitTemplate(board.render());
      assert.equal(htmlStr.includes("score-meta"), false, "Must not render two-line score-meta");
      assert.equal(htmlStr.includes("cards-chip"), false, "Must not render two-line Cards: chip");
      assert.ok(htmlStr.includes("score-tag dv"), "Should keep 1-2 micro tag");
      assert.ok(htmlStr.includes("score-tag won"), "Should keep GT won tag");
      assert.ok(htmlStr.includes("score-tag lost"), "Should keep T lost tag");
      assert.ok(htmlStr.includes("+400"), "Must display signed delta");
      assert.ok(htmlStr.includes("465"), "Must display running total");
      assert.ok(htmlStr.includes("Alice: GT +200"), "Full bet detail should appear in title tooltip");
      assert.ok(htmlStr.includes("Cards: 65"), "Card point detail should appear in title tooltip");
    }
  });
});

test("GameModel concede eligibility boundaries, F5 rehydration, round reset, and rollback safety", () => {
  const makePlayers = (team0Score: number, team1Score: number) => ({
    "10": {
      id: 10,
      name: "Alice",
      color: "000000",
      no: 1,
      team: 0,
      score: team0Score,
      call_tichu: Bet.NO_BET_YET,
      call_grand_tichu: Bet.NO_BET_YET,
    },
    "20": {
      id: 20,
      name: "Bob",
      color: "ff0000",
      no: 2,
      team: 1,
      score: team1Score,
      call_tichu: Bet.NO_BET_YET,
      call_grand_tichu: Bet.NO_BET_YET,
    },
    "30": {
      id: 30,
      name: "Carol",
      color: "000000",
      no: 3,
      team: 0,
      score: team0Score,
      call_tichu: Bet.NO_BET_YET,
      call_grand_tichu: Bet.NO_BET_YET,
    },
    "40": {
      id: 40,
      name: "Dave",
      color: "ff0000",
      no: 4,
      team: 1,
      score: team1Score,
      call_tichu: Bet.NO_BET_YET,
      call_grand_tichu: Bet.NO_BET_YET,
    },
  });

  // 1. Rollback safety: omitted gamedatas.concede keeps concede disabled
  const legacyModel = new GameModel();
  legacyModel.hydrateFromGamedatas(
    {
      players: makePlayers(0, 500) as any,
      round: 2,
      trick: 1,
      gamestate: { name: "playCombo", active_player: "10" },
    },
    10,
    false,
    true,
  );
  const legacyUi = getConcedeUiState({
    concede: legacyModel.getState().concede,
    players: legacyModel.getState().players,
    currentPlayerId: legacyModel.getState().currentPlayerId,
    isSpectator: legacyModel.getState().isSpectator,
    stateName: legacyModel.getState().stateName,
    round: legacyModel.getState().round,
  });
  assert.equal(legacyUi.canPropose, false);
  assert.equal(legacyUi.isProposer, false);
  assert.equal(legacyUi.isPartnerPrompted, false);

  // 2. Round 1 blocked even with large deficit
  const model = new GameModel();
  model.hydrateFromGamedatas(
    {
      players: makePlayers(0, 450) as any,
      round: 1,
      trick: 1,
      gamestate: { name: "playCombo", active_player: "10" },
      concede: {
        proposalBy: 0,
        usedThisRound: false,
        partnerIsZombie: false,
        minDeficit: 400,
        minRound: 2,
      },
    },
    10,
    false,
    true,
  );
  assert.equal(
    getConcedeUiState({
      concede: model.getState().concede,
      players: model.getState().players,
      currentPlayerId: "10",
      isSpectator: false,
      stateName: "playCombo",
      round: 1,
    }).canPropose,
    false,
  );

  // 3. Round 2 deficit thresholds: 395 blocked, 400 allowed (teammate scores must NOT be summed)
  model.hydrateFromGamedatas(
    {
      players: makePlayers(0, 395) as any,
      round: 2,
      trick: 0,
      gamestate: { name: "giveCards", multiactive: ["10", "20", "30", "40"] },
      concede: {
        proposalBy: 0,
        usedThisRound: false,
        partnerIsZombie: false,
        minDeficit: 400,
        minRound: 2,
      },
    },
    10,
    false,
    true,
  );
  assert.equal(
    getConcedeUiState({
      concede: model.getState().concede,
      players: model.getState().players,
      currentPlayerId: "10",
      isSpectator: false,
      stateName: "giveCards",
      round: 2,
    }).canPropose,
    false,
  );

  model.hydrateFromGamedatas(
    {
      players: makePlayers(-100, 300) as any,
      round: 2,
      trick: 0,
      gamestate: { name: "giveCards", multiactive: ["10", "20", "30", "40"] },
      concede: {
        proposalBy: 0,
        usedThisRound: false,
        partnerIsZombie: false,
        minDeficit: 400,
        minRound: 2,
      },
    },
    10,
    false,
    true,
  );
  assert.equal(
    getConcedeUiState({
      concede: model.getState().concede,
      players: model.getState().players,
      currentPlayerId: "10",
      isSpectator: false,
      stateName: "giveCards",
      round: 2,
    }).canPropose,
    true,
  );

  // 4. Spectator always blocked
  assert.equal(
    getConcedeUiState({
      concede: model.getState().concede,
      players: model.getState().players,
      currentPlayerId: "10",
      isSpectator: true,
      stateName: "giveCards",
      round: 2,
    }).canPropose,
    false,
  );

  // 5. Proposer -> Partner prompt -> Cancel -> usedThisRound blocks -> enterNewRound resets
  model.applyConcedeProposal(10);
  const proposerUi = getConcedeUiState({
    concede: model.getState().concede,
    players: model.getState().players,
    currentPlayerId: "10",
    isSpectator: false,
    stateName: "giveCards",
    round: 2,
  });
  assert.equal(proposerUi.isProposer, true);
  assert.equal(proposerUi.isPartnerPrompted, false);
  assert.equal(proposerUi.canPropose, false);
  assert.equal(proposerUi.partnerName, "Carol");

  const partnerUi = getConcedeUiState({
    concede: model.getState().concede,
    players: model.getState().players,
    currentPlayerId: "30",
    isSpectator: false,
    stateName: "giveCards",
    round: 2,
  });
  assert.equal(partnerUi.isPartnerPrompted, true);
  assert.equal(partnerUi.isProposer, false);
  assert.equal(partnerUi.proposerName, "Alice");

  model.applyConcedeCancel();
  const afterCancel = getConcedeUiState({
    concede: model.getState().concede,
    players: model.getState().players,
    currentPlayerId: "10",
    isSpectator: false,
    stateName: "giveCards",
    round: 2,
  });
  assert.equal(afterCancel.isProposer, false);
  assert.equal(
    afterCancel.canPropose,
    false,
    "usedThisRound must prevent re-proposing in same round",
  );

  model.enterNewRound();
  const nextRoundUi = getConcedeUiState({
    concede: model.getState().concede,
    players: model.getState().players,
    currentPlayerId: "10",
    isSpectator: false,
    stateName: "grandTichuBets",
    round: model.getState().round,
  });
  assert.equal(nextRoundUi.canPropose, true, "enterNewRound must clear usedThisRound");

  // 6. Zombie partner fast-path preserves canPropose while proposal is pending
  model.hydrateFromGamedatas(
    {
      players: makePlayers(0, 300) as any,
      round: 2,
      trick: 1,
      gamestate: { name: "playCombo", active_player: "10" },
      concede: {
        proposalBy: 10,
        usedThisRound: true,
        partnerIsZombie: true,
        minDeficit: 300,
        minRound: 2,
      },
    },
    10,
    false,
    true,
  );
  const zombieUi = getConcedeUiState({
    concede: model.getState().concede,
    players: model.getState().players,
    currentPlayerId: "10",
    isSpectator: false,
    stateName: "playCombo",
    round: 2,
  });
  assert.equal(zombieUi.canPropose, true);
  model.applyConcedeResult();
  assert.equal(model.getState().concede.proposalBy, 0);
});

test("Bug #22264: sort weights, sortHandCards with Group 1..4, computeDropTarget, and canOrganizeHandInState", async () => {
  await withMockLitEnv(() => {
    const {
      getLogicalRankWeight,
      getWeightByRank,
      getWeightByRankDesc,
      getWeightByColor,
      getWeightByColorDesc,
      sortHandCards,
      computeDropTarget,
    } = require("../src/elements/tichu-stock");

    assert.equal(getLogicalRankWeight(DOG), 0);
    assert.equal(getLogicalRankWeight(MJ), 1);
    assert.equal(getLogicalRankWeight(A2), 2);
    assert.equal(getLogicalRankWeight(AA), 14);
    assert.equal(getLogicalRankWeight(PH), 15);
    assert.equal(getLogicalRankWeight(DR), 16);

    const sample: TichuCard[] = [A2, DR, B9, MJ, AA, PH, DOG, C5];
    assert.deepEqual(
      sortHandCards(sample, "rank").map((c: TichuCard) => c.id),
      [DOG.id, MJ.id, A2.id, C5.id, B9.id, AA.id, PH.id, DR.id],
    );
    assert.deepEqual(
      sortHandCards(sample, "rank-desc").map((c: TichuCard) => c.id),
      [DR.id, PH.id, AA.id, B9.id, C5.id, A2.id, MJ.id, DOG.id],
    );

    const suitSample: TichuCard[] = [DR, DA, AA, A2, PH, B0, MJ, B2, DOG];
    assert.deepEqual(
      sortHandCards(suitSample, "color").map((c: TichuCard) => c.id),
      [DOG.id, MJ.id, A2.id, AA.id, B2.id, B0.id, DA.id, PH.id, DR.id],
    );
    assert.deepEqual(
      sortHandCards(suitSample, "color-desc").map((c: TichuCard) => c.id),
      [DR.id, PH.id, AA.id, A2.id, B0.id, B2.id, DA.id, MJ.id, DOG.id],
    );

    // Table combo passthrough when preserve has empty customOrder & empty groups
    assert.deepEqual(
      sortHandCards([DR, A2, MJ], "preserve").map((c: TichuCard) => c.id),
      [DR.id, A2.id, MJ.id],
    );

    // Left-pinned Group 1..4 with intra-group auto-sort and custom preserve + fallback
    const grouped = sortHandCards([A2, C5, B9, AA, DR], "rank-desc", "rank", [], {
      [A2.id]: 2,
      [B9.id]: 1,
      [C5.id]: 1,
    });
    assert.deepEqual(
      grouped.map((c: TichuCard) => c.id),
      [B9.id, C5.id, A2.id, DR.id, AA.id],
    );

    const customGrouped = sortHandCards(
      [A2, C5, B9, AA, DR],
      "preserve",
      "rank-desc",
      [C5.id, B9.id, A2.id],
      {
        [A2.id]: 2,
        [B9.id]: 1,
        [C5.id]: 1,
      },
    );
    // Group 1 (C5 then B9 by customOrder), Group 2 (A2), Ungrouped (DR then AA by baseSortOrder rank-desc)
    assert.deepEqual(
      customGrouped.map((c: TichuCard) => c.id),
      [C5.id, B9.id, A2.id, DR.id, AA.id],
    );

    // computeDropTarget across groups and boundaries
    const mids = [100, 130, 180, 210];
    const groups = [1, 1, 2, 0];
    // Stay in place keeps original group
    assert.deepEqual(computeDropTarget(105, mids, 0, groups), { dropIndex: 0, targetGroup: 1 });
    // Drag card 0 rightward past card 1 (stays Group 1)
    assert.deepEqual(computeDropTarget(145, mids, 0, groups), { dropIndex: 1, targetGroup: 1 });
    // Drag card 0 into Group 2 (just past card 2 at 180)
    assert.deepEqual(computeDropTarget(185, mids, 0, groups), { dropIndex: 2, targetGroup: 2 });
    // Drag card 0 across boundary toward ungrouped (past midpoint 195)
    assert.deepEqual(computeDropTarget(200, mids, 0, groups), { dropIndex: 2, targetGroup: 0 });
    // Drag card 0 to far right ungrouped
    assert.deepEqual(computeDropTarget(240, mids, 0, groups), { dropIndex: 3, targetGroup: 0 });
    // Drag ungrouped card 3 into Group 1
    assert.deepEqual(computeDropTarget(80, mids, 3, groups), { dropIndex: 0, targetGroup: 1 });

    // computeGroupStripes spans from very left to very right of each group without overlapping next group
    const { computeGroupStripes } = require("../src/elements/tichu-stock");
    const cardsForStripes = [A2, C5, B9, AA, DR];
    // 1-card group followed by multi-card group followed by ungrouped
    const stripes = computeGroupStripes(
      cardsForStripes,
      { [A2.id]: 1, [C5.id]: 2, [B9.id]: 2 },
      100,
      -60,
      22,
    );
    assert.equal(stripes.length, 2);
    // Card 0 left=0, Card 1 left=100-60+22=62 -> stripe 1 capped at 62-2=60
    assert.deepEqual(stripes[0], {
      groupId: 1,
      startIndex: 0,
      endIndex: 0,
      leftPx: 0,
      widthPx: 60,
      cardIds: [A2.id],
    });
    // Card 1 left=62, Card 2 left=102, Card 3 (ungrouped) left=102+40+22=164 -> stripe 2 right=min(102+100, 164-2)=162 -> width=100
    assert.deepEqual(stripes[1], {
      groupId: 2,
      startIndex: 1,
      endIndex: 2,
      leftPx: 62,
      widthPx: 100,
      cardIds: [C5.id, B9.id],
    });
    // All cards in one group -> full cardLeft[last] + itemWidth span
    const fullStripe = computeGroupStripes(
      [A2, C5, B9],
      { [A2.id]: 3, [C5.id]: 3, [B9.id]: 3 },
      100,
      -60,
      22,
    );
    assert.deepEqual(fullStripe, [
      {
        groupId: 3,
        startIndex: 0,
        endIndex: 2,
        leftPx: 0,
        widthPx: 180,
        cardIds: [A2.id, C5.id, B9.id],
      },
    ]);

    // State gate: only after card passing is completed
    for (const s of [
      "",
      "newRound",
      "grandTichuBets",
      "dealLastCards",
      "giveCards",
      "showPassedCards",
      "acceptPassedCards",
      "endRound",
      "gameEnd",
    ]) {
      assert.equal(canOrganizeHandInState(s), false, `Expected ${s} to disallow custom organize`);
    }
    for (const s of [
      "newTrick",
      "playComboOpen",
      "playCombo",
      "playBomb",
      "phoenixPlay",
      "mahjongPlay",
      "nextPlayer",
      "confirmTrick",
      "chooseDragonGift",
      "changePlayer",
    ]) {
      assert.equal(canOrganizeHandInState(s), true, `Expected ${s} to allow custom organize`);
    }
  });
});

test("Bug #22264: GameModel per-table custom hand persistence, round wipe, 90-day TTL, 50-entry cap, and post-passing gate", () => {
  const g = globalThis as any;
  const savedLocalStorage = g.localStorage;
  const savedDateNow = Date.now;
  const backing = new Map<string, string>();
  let nowMs = 1_800_000_000_000;

  g.localStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => {
      backing.set(k, String(v));
    },
    removeItem: (k: string) => {
      backing.delete(k);
    },
  };
  Date.now = () => nowMs;

  try {
    const makePlayers = () => ({
      "1": { id: "1", name: "Alice", color: "000000", no: 1, team: 0, score: 0 },
      "2": { id: "2", name: "Bob", color: "ff0000", no: 2, team: 1, score: 0 },
      "3": { id: "3", name: "Carol", color: "000000", no: 3, team: 0, score: 0 },
      "4": { id: "4", name: "Dave", color: "ff0000", no: 4, team: 1, score: 0 },
    });
    const handCards = [A2, C5, B9, AA, DR];

    const model = new GameModel();
    // 1. Pre-passing states reject custom ordering and grouping
    model.hydrateFromGamedatas(
      {
        players: makePlayers() as any,
        hand: handCards,
        round: 2,
        trick: 0,
        gamestate: { name: "giveCards", multiactive: ["1"] },
      },
      1,
      false,
      false,
      undefined,
      undefined,
      777,
    );
    model.commitCustomHandOrder([DR.id, A2.id, C5.id, B9.id, AA.id]);
    model.assignCardGroup([DR.id, AA.id], 1);
    assert.equal(model.getState().handSortOrder, "rank");
    assert.deepEqual(model.getState().customHandOrder, []);
    assert.deepEqual(model.getState().cardGroups, {});
    assert.equal(backing.get(CUSTOM_HAND_ORDER_STORAGE_KEY), undefined);

    // 2. Post-passing state persists custom order & groups under tableId_playerId
    model.setGameState("playComboOpen", { activePlayerId: "1", isCurrentPlayerActive: true });
    assert.equal(model.getState().cardGroupsUiEnabled, false);
    model.setCardGroupsUiEnabled(true);
    assert.equal(backing.get(CARD_GROUPS_UI_STORAGE_KEY), "1");
    assert.equal(model.getState().cardGroupsUiEnabled, true);
    model.setCardGroupsUiEnabled(false);
    assert.equal(backing.get(CARD_GROUPS_UI_STORAGE_KEY), "0");
    assert.equal(model.getState().cardGroupsUiEnabled, false);
    model.commitCustomHandOrder([DR.id, C5.id, B9.id, AA.id, A2.id], C5.id, 1);
    model.assignCardGroup([B9.id], 1);
    assert.equal(model.getState().handSortOrder, "preserve");
    assert.deepEqual(model.getState().cardGroups, { [C5.id]: 1, [B9.id]: 1 });
    assert.ok(backing.get(CUSTOM_HAND_ORDER_STORAGE_KEY)?.includes('"777_1"'));

    // 3. Switching auto-sort updates tichu_hand_sort_order, exits preserve, keeps groups intact
    model.setHandSortOrder("rank-desc");
    assert.equal(backing.get("tichu_hand_sort_order"), "rank-desc");
    assert.equal(model.getState().handSortOrder, "rank-desc");
    assert.deepEqual(model.getState().customHandOrder, []);
    assert.deepEqual(model.getState().cardGroups, { [C5.id]: 1, [B9.id]: 1 });

    // Re-commit custom order and test F5 rehydration for same table & round
    model.commitCustomHandOrder([DR.id, C5.id, B9.id, AA.id, A2.id]);
    const refreshed = new GameModel();
    refreshed.hydrateFromGamedatas(
      {
        players: makePlayers() as any,
        hand: handCards,
        round: 2,
        trick: 3,
        gamestate: { name: "playCombo", active_player: "2" },
      },
      1,
      false,
      false,
      undefined,
      undefined,
      777,
    );
    assert.equal(refreshed.getState().handSortOrder, "preserve");
    assert.deepEqual(refreshed.getState().customHandOrder, [DR.id, C5.id, B9.id, AA.id, A2.id]);
    assert.deepEqual(refreshed.getState().cardGroups, { [C5.id]: 1, [B9.id]: 1 });

    // 4. Different tableId stays isolated
    const otherTable = new GameModel();
    otherTable.hydrateFromGamedatas(
      {
        players: makePlayers() as any,
        hand: handCards,
        round: 2,
        trick: 3,
        gamestate: { name: "playCombo", active_player: "2" },
      },
      1,
      false,
      false,
      undefined,
      undefined,
      888,
    );
    assert.equal(otherTable.getState().handSortOrder, "rank-desc");
    assert.deepEqual(otherTable.getState().customHandOrder, []);
    assert.deepEqual(otherTable.getState().cardGroups, {});

    // 5. Playing cards prunes IDs from customHandOrder and cardGroups
    refreshed.applyPlayCombo(1, [C5], "Single", 0, 1);
    assert.equal(refreshed.getState().customHandOrder.includes(C5.id), false);
    assert.equal(refreshed.getState().cardGroups[C5.id], undefined);
    assert.equal(refreshed.getState().cardGroups[B9.id], 1);

    // 6. Round completion immediately wipes localStorage entry for this table
    refreshed.enterEndRound();
    assert.equal(refreshed.getState().handSortOrder, "rank-desc");
    assert.deepEqual(refreshed.getState().customHandOrder, []);
    assert.deepEqual(refreshed.getState().cardGroups, {});
    assert.equal(backing.get(CUSTOM_HAND_ORDER_STORAGE_KEY), undefined);

    // 7. 90-day TTL expiration & 50-entry LRU cap
    const storeSeed: Record<string, any> = {};
    storeSeed["100_1"] = {
      round: 1,
      order: [DR.id],
      groups: {},
      updatedAt: nowMs - CUSTOM_HAND_ORDER_TTL_MS - 1000, // expired (> 3 months)
    };
    for (let i = 1; i <= 55; i++) {
      storeSeed[`${2000 + i}_1`] = {
        round: 1,
        order: [A2.id],
        groups: {},
        updatedAt: nowMs - (60 - i) * 1000,
      };
    }
    backing.set(CUSTOM_HAND_ORDER_STORAGE_KEY, JSON.stringify(storeSeed));

    // Trigger write via a valid table save -> expired "100_1" and oldest entries > 50 must be pruned
    model.hydrateFromGamedatas(
      {
        players: makePlayers() as any,
        hand: handCards,
        round: 4,
        trick: 1,
        gamestate: { name: "playComboOpen", active_player: "1" },
      },
      1,
      false,
      false,
      undefined,
      undefined,
      999,
    );
    model.commitCustomHandOrder([A2.id, C5.id, B9.id, AA.id, DR.id]);
    const finalStore = JSON.parse(backing.get(CUSTOM_HAND_ORDER_STORAGE_KEY) || "{}");
    assert.equal(finalStore["100_1"], undefined, "Entry older than 90 days must expire");
    assert.ok("999_1" in finalStore);
    assert.equal(Object.keys(finalStore).length, CUSTOM_HAND_ORDER_MAX_ENTRIES);
  } finally {
    g.localStorage = savedLocalStorage;
    Date.now = savedDateNow;
  }
});

test("Bug #22264: TichuHand organize bar and TichuSettingsModal 4-way sort UI", async () => {
  await withMockLitEnv(() => {
    const g = globalThis as any;
    const savedUnderscore = g._;
    const savedGameModel = g.window.gameModel;
    const savedGameUi = g.window.gameui;

    g._ = (s: string) => s;
    const model = new GameModel();
    g.window.gameModel = model;
    const calls: string[] = [];
    g.window.gameui = {
      isReadOnly: () => false,
      onOrderChange: (o: string) => calls.push(`order:${o}`),
      onReorderByRank: () => calls.push("rank"),
      onReorderByColor: () => calls.push("color"),
    };

    try {
      const { TichuHand } = require("../src/elements/tichu-hand");
      const { TichuSettingsModal } = require("../src/elements/tichu-settings-modal");

      model.hydrateFromGamedatas(
        {
          players: {
            "1": { id: "1", name: "Alice", color: "000000", no: 1, team: 0, score: 0 },
            "2": { id: "2", name: "Bob", color: "ff0000", no: 2, team: 1, score: 0 },
            "3": { id: "3", name: "Carol", color: "000000", no: 3, team: 0, score: 0 },
            "4": { id: "4", name: "Dave", color: "ff0000", no: 4, team: 1, score: 0 },
          } as any,
          hand: [A2, C5, B9, AA, DR],
          round: 1,
          trick: 0,
          gamestate: { name: "giveCards", multiactive: ["1"] },
        },
        1,
        false,
        false,
        undefined,
        undefined,
        555,
      );

      const hand = new TichuHand();
      hand.performUpdate = () => {};
      hand.connectedCallback();
      try {
        // Pre-passing giveCards: single sort dropdown shown, toggle & group buttons omitted
        const prePassHtml = serializeLitTemplate(hand.render());
        assert.ok(prePassHtml.includes('id="hand-organize-bar"'));
        assert.ok(prePassHtml.includes('id="hand_sort_select"'));
        assert.ok(prePassHtml.includes("Rank ↑"));
        assert.ok(prePassHtml.includes("Rank ↓"));
        assert.ok(prePassHtml.includes("Suit ↑"));
        assert.ok(prePassHtml.includes("Suit ↓"));
        assert.equal(prePassHtml.includes('id="order_by_rank"'), false);
        assert.equal(prePassHtml.includes('id="toggle_card_groups"'), false);
        assert.equal(/id=["']?group_btn_1["']?/.test(prePassHtml), false);

        // Post-passing playCombo with cardGroupsUiEnabled=false: toggle shown, group buttons hidden
        model.setGameState("playCombo", { activePlayerId: "1", isCurrentPlayerActive: true });
        const toggleClosedHtml = serializeLitTemplate(hand.render());
        assert.ok(toggleClosedHtml.includes('id="toggle_card_groups"'));
        assert.match(toggleClosedHtml, /id="toggle_card_groups"[^>]*aria-pressed=(?:"false"|false)/);
        assert.equal(/id=["']?group_btn_1["']?/.test(toggleClosedHtml), false);

        // Toggling Card groups opens group buttons 1..4
        (hand as any).onToggleCardGroups();
        assert.equal(model.getState().cardGroupsUiEnabled, true);
        const playHtml = serializeLitTemplate(hand.render());
        assert.match(playHtml, /id="toggle_card_groups"[^>]*aria-pressed=(?:"true"|true)/);
        assert.match(playHtml, /id=["']?group_btn_1["']?/);
        assert.match(playHtml, /id=["']?group_btn_4["']?/);

        // Assign selected cards to Group 1, then click group stripe to select & toggle off
        model.setSelectedCardIds([A2.id, C5.id]);
        (hand as any).onGroupButtonClick(1);
        assert.deepEqual(model.getState().cardGroups, { [A2.id]: 1, [C5.id]: 1 });
        assert.deepEqual(model.getState().selectedCardIds, []);

        (hand as any).onGroupStripeClick({ detail: { groupId: 1 } });
        assert.deepEqual(model.getState().selectedCardIds, [A2.id, C5.id]);
        (hand as any).onGroupStripeClick({ detail: { groupId: 1 } });
        assert.deepEqual(model.getState().selectedCardIds, []);

        // Dropdown value change updates sort order
        (hand as any).onSortSelectChange({ target: { value: "color-desc" } });
        assert.equal(model.getState().handSortOrder, "color-desc");
        assert.ok(calls.includes("order:color-desc"));

        // Custom option appears in dropdown when handSortOrder === "preserve"
        model.commitCustomHandOrder([DR.id, AA.id, B9.id, A2.id, C5.id]);
        const customHtml = serializeLitTemplate(hand.render());
        assert.ok(customHtml.includes("Custom"));
      } finally {
        hand.disconnectedCallback();
      }

      const modal = new TichuSettingsModal();
      modal.performUpdate = () => {};
      modal.connectedCallback();
      try {
        const modalHtml = serializeLitTemplate(modal.render());
        assert.ok(modalHtml.includes("Rank ↑"));
        assert.ok(modalHtml.includes("Rank ↓"));
        assert.ok(modalHtml.includes("Suit ↑"));
        assert.ok(modalHtml.includes("Suit ↓"));
        assert.ok(modalHtml.includes("Custom order active for this round"));

        modal.onHandSortChange("rank-desc");
        assert.equal(model.getState().handSortOrder, "rank-desc");
        assert.ok(calls.includes("order:rank-desc"));
      } finally {
        modal.disconnectedCallback();
      }
    } finally {
      g._ = savedUnderscore;
      g.window.gameModel = savedGameModel;
      g.window.gameui = savedGameUi;
    }
  });
});
