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
  canFinishHandInOnePlay,
  validatePassAction,
} from "../src/elements/combo-validator";
import { hasBomb } from "../src/elements/utils";

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
    "2&#39;s full of 3&#39;s",
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
// Smart Play UX Helpers (analyzeSelection, validatePassAction, canFinishHandInOnePlay)
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
  assert.equal(emptyRes.buttonLabel, "Play (Select cards)");

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
  assert.equal(invalidRes.buttonLabel, "Invalid combo");

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
  assert.equal(nonBombInterrupt.buttonLabel, "Must play a bomb");

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
  assert.equal(loseRes.buttonLabel, "Must beat Pair of Kings");

  // Valid combo (entities decoded for label)
  const validPairRes = analyzeSelection({
    selectedCards: [AQ, BQ],
    handCards: hand,
    lastCombo: new Combo([A0, B0]),
    stateName: "playCombo",
    mahjongWish: 0,
  });
  assert.equal(validPairRes.isValid, true);
  assert.equal(validPairRes.buttonLabel, "Play Pair of Queens");

  const validBombRes = analyzeSelection({
    selectedCards: [A5, B5, C5, D5],
    handCards: hand,
    lastCombo: new Combo([AA, BA]),
    stateName: "playBomb",
    mahjongWish: 0,
  });
  assert.equal(validBombRes.isValid, true);
  assert.equal(validBombRes.buttonLabel, "Play Bomb of four 5's");

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
  assert.equal(wishViolation.buttonLabel, "Must play wished 5");

  // Allowed when wish CANNOT be fulfilled (only single 5 against Ace, no bomb)
  const wishAllowed = analyzeSelection({
    selectedCards: [DR],
    handCards: [A5, DR],
    lastCombo: new Combo([AA]),
    stateName: "playCombo",
    mahjongWish: 5,
  });
  assert.equal(wishAllowed.isValid, true);
});

test("SmartPlayUX::validatePassAction wish guard and combo-specific tooltips", () => {
  // Cannot fulfill wish -> canPass is true
  const passOk = validatePassAction([A5, B9], new Combo([AA]), 5);
  assert.equal(passOk.canPass, true);

  // Fulfillable as single
  const singleWish = validatePassAction([A7, B9], new Combo([A3]), 7);
  assert.equal(singleWish.canPass, false);
  assert.equal(singleWish.buttonLabel, "Must fulfill wish (7)");
  assert.match(singleWish.tooltip, /7/);

  // Fulfillable ONLY as a bomb (wish is 5 over high Pair of Aces)
  const bombWish = validatePassAction([A5, B5, C5, D5, B9], new Combo([AA, BA]), 5);
  assert.equal(bombWish.canPass, false);
  assert.equal(bombWish.buttonLabel, "Must fulfill wish (5)");
  assert.equal(bombWish.requiredComboType, BOMB_COMBO);
  assert.match(bombWish.tooltip, /bomb/i);

  // Fulfillable ONLY as a pair (wish is 12 over Pair of 10s, with Queen + Phoenix)
  const pairWish = validatePassAction([AQ, PH], new Combo([A0, B0]), 12);
  assert.equal(pairWish.canPass, false);
  assert.equal(pairWish.buttonLabel, "Must fulfill wish (Queen)");
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

test("SmartPlayUX::canFinishHandInOnePlay prompt trigger", () => {
  const straightHand = [A5, B6, C7, D8, A9];
  // Playing only single 5 when whole 5-card hand forms a straight on lead
  const triggerLead = canFinishHandInOnePlay(straightHand, [A5], Combo.noCombo, 0, "playCombo");
  assert.ok(triggerLead !== null);
  assert.equal(triggerLead.type, STRAIGHT_COMBO);

  // Selecting all 5 cards does NOT prompt
  const noPromptAllSelected = canFinishHandInOnePlay(
    straightHand,
    straightHand,
    Combo.noCombo,
    0,
    "playCombo",
  );
  assert.equal(noPromptAllSelected, null);

  // If lastCombo is a Pair, a 5-card straight hand cannot beat it -> no prompt
  const noPromptCannotBeat = canFinishHandInOnePlay(
    straightHand,
    [A9],
    new Combo([A2, B2]),
    0,
    "playCombo",
  );
  assert.equal(noPromptCannotBeat, null);

  // If hand is [DOG], length === 1 -> no prompt
  const noPromptDog = canFinishHandInOnePlay([DOG], [DOG], Combo.noCombo, 0, "playCombo");
  assert.equal(noPromptDog, null);

  // Ambiguous Phoenix straight finished in one play (4,5,6,7,PH beating 2,3,4,5,6)
  const phHand = [B4, C5, D6, A7, PH];
  const lastStraight = new Combo([A2, B3, C4, D5, A6]);
  const phTrigger = canFinishHandInOnePlay(phHand, [A7], lastStraight, 0, "playCombo");
  assert.ok(phTrigger !== null);
  assert.equal(phTrigger.type, STRAIGHT_COMBO);
});
