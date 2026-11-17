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
  getWishBombOnlyCallout,
  validatePassAction,
} from "../src/elements/combo-validator";
import { hasBomb } from "../src/elements/utils";
import { GameModel } from "../src/elements/game-model";
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

  const mods = {
    TichuAnimationLayer: require("../src/elements/tichu-animation-layer").TichuAnimationLayer,
    TichuLastPlayed: require("../src/elements/tichu-last-played").TichuLastPlayed,
    TichuPassArea: require("../src/elements/tichu-pass-area").TichuPassArea,
    TichuStock: require("../src/elements/tichu-stock").TichuStock,
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
    const oppHandIconRect = new MockDOMRect(120, 180, 36, 54);
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
        Number(pid) === 2385075 ? oppPointsIconRect : null,
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
    assert.equal(selfPrep.fromRects.get(Number(A5.id)), handCardRect);
    assert.equal(selfPrep.fallbackFromRect, handAnchorRect);

    // 2. Opponent playCombo uses #icon_hand_<id> inside <tichu-last-played>, never #player_board_
    const oppPrep = layer.preparePlayCombo(2385075, [B6], "6", false);
    assert.equal(oppPrep.fromRects.size, 0);
    assert.equal(oppPrep.fallbackFromRect, oppHandIconRect);
    assert.equal(panelAccessed, false);

    // 3. Spectator mode treats every seat as opponent (uses #icon_hand_2385074, not hand)
    model.update({ isSpectator: true });
    const specPrep = layer.preparePlayCombo(2385074, [A5], "5", false);
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

    // 4. Capture sweep for self -> sweeps both played card and pass card into handAnchorRect
    model.update({ lastComboPlayerId: "2385074" });
    layer.runCaptureCardsSweep(2385074);
    assert.equal(recordedFlights.length, 1);
    assert.equal(recordedFlights[0]!.length, 2);
    const selfPassFlight = recordedFlights[0]!.find((f) => f.pass === true);
    const selfWinFlight = recordedFlights[0]!.find((f) => !f.pass);
    assert.ok(selfPassFlight, "Expected pass card to be swept during captureCards");
    assert.equal(selfPassFlight.toRect, handAnchorRect);
    assert.equal(selfPassFlight.fadeOut, true);
    assert.equal(selfWinFlight.toRect, handAnchorRect);
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
      assert.equal(timing.viewDelayMs, 1200);
      assert.equal(timing.flightDurationMs, 370);
      assert.equal(timing.totalDurationMs, 1570);

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
      assert.equal(acceptFlights[1].delayMs, 35);
      assert.equal(acceptFlights[2].delayMs, 70);

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
      assert.equal(handAnchor.left, 10 + 8 - 18);
      assert.equal(ptsAnchor.left, 50 + 8 - 18);

      // 8. TichuPassArea.getSlotCardTargetRect computes exact (left+20*zoom, top+40*zoom, 100*zoom, 150*zoom)
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
      assert.equal(targetRect.top, 200 + 40 * 0.8);
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
      ui.notif_tichuBet({ args: { player_id: 2385074, bet: Bet.TICHU } });
      assert.equal(model.getState().betAnimations.length, 0);
      assert.equal(laserPlayed, 0);
      assert.equal(syncDurations.at(-1), 1);

      // Re-enable via BGA preference callback
      ui.onPreferenceChange(105, 1);
      assert.equal(model.getState().animationsEnabled, true);
      assert.equal(ui.areAnimationsActive(), true);
      assert.equal(ui.shouldAnimate(), true);
      assert.equal(shouldAnimate(), true);

      // Toggle off via in-hand widget handler -> updates model, cancels layer, persists pref 105 = 2
      ui.changeAnimations(false);
      assert.equal(model.getState().animationsEnabled, false);
      assert.equal(cancelledLayerCalls, 1);
      assert.deepEqual(persistedPrefs.at(-1), [105, 2]);
      assert.equal(shouldAnimate(), false);
      ui.notif_grandTichuBet({ args: { player_id: 2385075, bet: Bet.GRAND_TICHU } });
      assert.equal(model.getState().betAnimations.length, 0);
      assert.equal(syncDurations.at(-1), 1);

      // Re-enable via changeAnimations(true) -> bet splash triggers when enabled
      ui.changeAnimations(true);
      assert.deepEqual(persistedPrefs.at(-1), [105, 1]);
      assert.equal(shouldAnimate(), true);
      ui.notif_tichuBet({ args: { player_id: 2385075, bet: Bet.TICHU } });
      assert.equal(model.getState().betAnimations.length, 1);
      assert.equal(laserPlayed, 1);
      assert.equal(syncDurations.at(-1), 1000);
    } finally {
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
            return { viewDelayMs: 1200, flightDurationMs: 370, totalDurationMs: 1570 };
          },
          prepareAcceptCards() {
            prepareCalls++;
            return { fromRects: fakeFromRects, durationMs: 370 };
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
        assert.equal(s.syncDurations.at(-1), 1570);
        assert.equal(scheduled.length, beforeLen + 1);
        const timer = scheduled[beforeLen]!;
        assert.equal(timer.delay, 1200);

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

      // 2. Animations disabled (pref 105 = 2) -> view still shown for 1200ms, no flight
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
        assert.equal(s.syncDurations.at(-1), 1200);
        assert.equal(scheduled.length, beforeLen + 1);
        const timer = scheduled[beforeLen]!;
        assert.equal(timer.delay, 1200);

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
