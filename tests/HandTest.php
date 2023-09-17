<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

require_once "modules/Hand.php";
require_once "modules/Constants.php";
require_once "tests/TestUtils.php";

final class HandTest extends TestCase
{
  protected function setUp(): void
  {
    LogManager::$lastComboForTesting = new Combo([], NO_COMBO);
  }

  protected function tearDown(): void
  {
    LogManager::$lastComboForTesting = null;
  }

  public function testGetTopSingleRank(): void
  {
    $this->assertEquals(2, (new Hand([A2]))->getTopSingleRank());
    $this->assertEquals(14, (new Hand([AA]))->getTopSingleRank());
    $this->assertEquals(13, (new Hand([AA, BA, AK]))->getTopSingleRank());
    $this->assertEquals(12, (new Hand([AA, BA, CQ, AK, BK, CK, A2, DR, C5]))->getTopSingleRank());

    $this->assertEquals(0, (new Hand([]))->getTopSingleRank());
    $this->assertEquals(0, (new Hand([DR]))->getTopSingleRank());
    $this->assertEquals(0, (new Hand([AA, BA]))->getTopSingleRank());
    $this->assertEquals(0, (new Hand([A5, B5]))->getTopSingleRank());
    $this->assertEquals(0, (new Hand([A2, B2, AA, BA]))->getTopSingleRank());
  }

  public function testGetTopRank(): void
  {
    $this->assertEquals(2, (new Hand([A2]))->getTopRank());
    $this->assertEquals(14, (new Hand([AA]))->getTopRank());
    $this->assertEquals(14, (new Hand([A2, A5, AA, A0]))->getTopRank());
    $this->assertEquals(14, (new Hand([AA, BA, CQ, AK, BK, CK, A2, DR, C5]))->getTopRank());

    $this->assertEquals(0, (new Hand([]))->getTopRank());
    $this->assertEquals(0, (new Hand([DR]))->getTopRank());
    $this->assertEquals(14, (new Hand([AA, BA]))->getTopRank());
    $this->assertEquals(5, (new Hand([A5, B5]))->getTopRank());
    $this->assertEquals(14, (new Hand([A2, B2, AA, BA]))->getTopRank());
  }

  public function testHasBomb(): void
  {
    $this->assertTrue((new Hand([A2, B2, C2, D2]))->hasBomb());
    $this->assertTrue((new Hand([A0, B0, C0, D0]))->hasBomb());
    $this->assertTrue((new Hand([AA, BA, CA, DA]))->hasBomb());

    $this->assertTrue((new Hand([A2, A3, A4, A5, A6]))->hasBomb());

    $this->assertFalse((new Hand([A2, B2, C2]))->hasBomb());
    $this->assertFalse((new Hand([DR, PH, DOG, PH]))->hasBomb());
  }

  public function assertHighestSingle($expected, $cards): void
  {
    if ($expected == null) {
      $this->assertNull((new Hand($cards))->getHighestSingle());
    } else {
      $this->assertEquals($expected, (new Hand($cards))->getHighestSingle()->cards);
    }
  }

  public function testGetHighestSingle(): void
  {
    $this->assertHighestSingle([AA], [A2, B2, AA, B9]);
    $this->assertHighestSingle([A0], [A2, B5, A0, B9]);
    $this->assertHighestSingle([DR], [A2, DR, AA, BA]);
    $this->assertHighestSingle([A3], [PH, A2, A3]);
    $this->assertHighestSingle([DR], [DR]);
    $this->assertHighestSingle([PH], [PH]);
    $this->assertHighestSingle([MJ], [MJ]);
    $this->assertHighestSingle(null, []);
    $this->assertHighestSingle(null, [DOG]);
  }

  public function assertHighestPair($expected, $cards): void
  {
    if ($expected == null) {
      $this->assertNull((new Hand($cards))->getHighestPair());
    } else {
      $this->assertEquals($expected, (new Hand($cards))->getHighestPair()->cards);
    }
  }

  public function testGetHighestPair(): void
  {
    $this->assertHighestPair([A2, B2], [A2, B2, AA, B9]);
    $this->assertHighestPair([A2, B2], [A2, B2, AA, B9, DR, DOG, MJ]);
    $this->assertHighestPair([B7, D7], [A2, B2, C5, D7, DQ, AJ, B7, AK]);
    $this->assertHighestPair([AA, BA], [A2, DR, AA, BA]);
    $this->assertHighestPair([PH, A3], [PH, A2, A3]);
    $this->assertHighestPair([PH, A0], [A2, B5, C7, A0, B9, DR, MJ, DOG, PH]);
    $this->assertHighestPair(null, [A2, B5, C7, A0, B9, DR, MJ, DOG]);
    $this->assertHighestPair(null, []);
    $this->assertHighestPair(null, [DR]);
    $this->assertHighestPair(null, [PH]);
    $this->assertHighestPair(null, [MJ]);
    $this->assertHighestPair(null, [DOG]);
  }

  public function assertHighestTrip($expected, $cards): void
  {
    if ($expected == null) {
      $this->assertNull((new Hand($cards))->getHighestTrip());
    } else {
      $this->assertEquals($expected, (new Hand($cards))->getHighestTrip()->cards);
    }
  }

  public function testGetHighestTrip(): void
  {
    $this->assertHighestTrip([A2, B2, C2], [A2, B2, C2, AA, B9]);
    $this->assertHighestTrip([A2, B2, C2], [A2, B2, C2, AA, B9, DR, DOG, MJ]);
    $this->assertHighestTrip([A7, B7, D7], [A2, B2, C2, C5, D7, DQ, A7, AJ, B7, AK]);
    $this->assertHighestTrip([AA, BA, CA], [A2, DR, AA, BA, CA]);
    $this->assertHighestTrip([PH, A3, B3], [PH, A2, A3, A4, B3]);
    $this->assertHighestTrip([PH, A0, D0], [A2, B5, C7, A0, B9, DR, MJ, D0, DOG, PH]);
    $this->assertHighestTrip(null, [A2, B5, D7, C7, A0, C5, B9, D2, DR, MJ, DOG]);
    $this->assertHighestTrip(null, []);
    $this->assertHighestTrip(null, [DR]);
    $this->assertHighestTrip(null, [PH]);
    $this->assertHighestTrip(null, [MJ]);
    $this->assertHighestTrip(null, [DOG]);
  }

  private function assertHighestRunningPair($length, $expected, $cards): void
  {
    if ($expected == null) {
      $this->assertNull((new Hand($cards))->getHighestRunningPair($length));
    } else {
      $this->assertEquals($expected, (new Hand($cards))->getHighestRunningPair($length)->cards);
    }
  }

  public function testGetHighestRunningPair(): void
  {
    $this->assertHighestRunningPair(4, [C2, C2, D3, D3], [A2, B2, A3, B3]);
    $this->assertHighestRunningPair(4, [A8, A8, B9, B9], [A2, B2, A3, B3, A8, B8, A9, B9]);
    $this->assertHighestRunningPair(4, null, [A2, B5, D7, C7, A0, C5, B9, D2, DR, MJ, DOG]);
    $this->assertHighestRunningPair(4, null, []);
    $this->assertHighestRunningPair(4, null, [DR]);
    $this->assertHighestRunningPair(4, null, [PH]);
    $this->assertHighestRunningPair(4, null, [MJ]);
    $this->assertHighestRunningPair(4, null, [DOG]);
  }

  private function assertHighestStraight($length, $expected, $cards): void
  {
    if ($expected == null) {
      $this->assertNull((new Hand($cards))->getHighestStraight($length));
    } else {
      $this->assertEquals($expected, (new Hand($cards))->getHighestStraight($length)->cards);
    }
  }

  public function testGetHighestStraight(): void
  {
    $this->assertHighestStraight(5, [C2, D3, A4, B5, C6], [A2, A3, B4, C5, D6]);
    $this->assertHighestStraight(5, [C2, D3, A4, B5, C6], [A2, A3, PH, C5, D6]);
    $this->assertHighestStraight(5, [D3, A4, B5, C6, D7], [PH, A3, B4, C5, D6]);
    $this->assertHighestStraight(7, [A8, B9, C0, DJ, AQ, BK, CA], [AA, AK, CQ, CJ, C0, A9, A8]);
    $this->assertHighestStraight(7, [A8, B9, C0, DJ, AQ, BK, CA], [AA, AK, CQ, CJ, C0, A9, PH]);
    $this->assertHighestStraight(5, null, []);
    $this->assertHighestStraight(5, null, [
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
  }

  private function assertHighestFullHouse($expected, $cards): void
  {
    if ($expected == null) {
      $this->assertNull((new Hand($cards))->getHighestFullHouse());
    } else {
      $this->assertEquals($expected, (new Hand($cards))->getHighestFullHouse()->cards);
    }
  }

  public function testGetHighestFullHouse(): void
  {
    $this->assertHighestFullHouse([A2, A2, A2, B3, B3], [A2, B2, C2, A3, B3]);
    $this->assertHighestFullHouse([A3, A3, A3, B2, B2], [A2, B2, C2, A3, B3, C3]);
    $this->assertHighestFullHouse([A3, A3, A3, B2, B2], [A2, B2, C2, A3, B3, C3, PH]);
    $this->assertHighestFullHouse([A3, A3, A3, B2, B2], [A2, A3, B3, C3, PH]);
    $this->assertHighestFullHouse([A3, A3, A3, B2, B2], [A2, B2, A3, B3, PH]);
    $this->assertHighestFullHouse(
      [AA, AA, AA, B7, B7],
      [A2, B2, A3, B3, A7, B7, AA, BA, DR, MJ, DOG, PH]
    );
    $this->assertHighestFullHouse(null, [A2, B2, A3, B3, A7, B7, AA, BA, DR, MJ, DOG]);
    $this->assertHighestFullHouse(null, [A2, B2, C2, PH]);
    $this->assertHighestFullHouse(null, [A2, B2, C2, D2, PH]);
    $this->assertHighestFullHouse(null, []);
  }

  private function assertHighestBomb($expected, $cards): void
  {
    if ($expected == null) {
      $this->assertNull((new Hand($cards))->getHighestBomb());
    } else {
      $this->assertEquals($expected, (new Hand($cards))->getHighestBomb()->cards);
    }
  }

  public function testGetHighestBomb(): void
  {
    $this->assertHighestBomb([A2, B2, C2, D2], [A2, B2, C2, D2]);
    $this->assertHighestBomb([AA, BA, CA, DA], [AA, BA, CA, DA]);
    $this->assertHighestBomb([AA, BA, CA, DA], [A2, B2, C2, D2, AA, BA, CA, DA]);
    $this->assertHighestBomb([A2, A3, A4, A5, A6], [A2, A3, A4, A5, A6]);
    $this->assertHighestBomb([A2, A3, A4, A5, A6], [A2, A3, A4, A5, A6, AA, BA, CA, DA]);
    $this->assertHighestBomb([A2, A3, A4, A5, A6], [A2, A3, A4, A5, A6, B2, B3, B4, B5, B6]);
    $this->assertHighestBomb([B3, B4, B5, B6, B7], [A2, A3, A4, A5, A6, B7, B3, B4, B5, B6]);
    $this->assertHighestBomb(
      [A2, A3, A4, A5, A6, A7],
      [A2, A3, A4, A5, A6, A7, B7, B3, B4, B5, B6]
    );
    $this->assertHighestBomb([A2, A3, A4, A5, A6, A7, A8], [A2, A3, A4, A5, A6, A7, A8, AA]);
    $this->assertHighestBomb([A7, B7, C7, D7], [A2, A7, D7, C7, B7, B2, C2, D2]);
    $this->assertHighestBomb(null, []);
    $this->assertHighestBomb(null, [DR, PH, DOG, MJ]);
    $this->assertHighestBomb(null, [A2, B2, C2, A3, B3, C3, A4, B4, C4, A5, B5, DR, PH, DOG, MJ]);
  }

  private function assertCanBeat($expected, $handCards, $comboCards): void
  {
    $lastCombo = new Combo($comboCards);
    LogManager::$lastComboForTesting = $lastCombo;
    $this->assertEquals($expected, (new Hand($handCards))->canBeat($lastCombo));
  }

  public function testCanBeat(): void
  {
    $this->assertCanBeat(true, [A3], [A2]);
    $this->assertCanBeat(true, [DR], [A2]);
    $this->assertCanBeat(true, [PH], [A2]);
    $this->assertCanBeat(false, [], [A2]);
    $this->assertCanBeat(false, [B2, C2, D2, MJ, DOG], [A2]);
    $this->assertCanBeat(true, [A2, B5, C9, DQ], [B0]);
    $this->assertCanBeat(false, [A2, B2, C2, A3, B3, C3], [A9]);
    $this->assertCanBeat(false, [AA, BA, CA, AK, BK, CK], [DR]);
    $this->assertCanBeat(true, [A2, B2, C2, D2, A3, B3, C3], [A9]);
    $this->assertCanBeat(true, [A2, B2, C2, D2, A3, B3, C3], [DR]);

    $this->assertCanBeat(false, [], [DOG]);
    $this->assertCanBeat(true, [A2], [DOG]);
    $this->assertCanBeat(true, [PH], [DOG]);
    $this->assertCanBeat(true, [DR], [DOG]);
    $this->assertCanBeat(true, [MJ], [DOG]);

    $this->assertCanBeat(false, [], [MJ]);
    $this->assertCanBeat(false, [DOG], [MJ]);
    $this->assertCanBeat(true, [A2], [MJ]);
    $this->assertCanBeat(true, [PH], [MJ]);
    $this->assertCanBeat(true, [DR], [MJ]);

    $this->assertCanBeat(false, [], [A2, B2]);
    $this->assertCanBeat(false, [DR, PH, MJ, DOG, C2, D2, C3, D3], [A3, B3]);
    $this->assertCanBeat(true, [DR, PH, MJ, DOG, C2, D2, C3, D3, A4], [A3, B3]);
    $this->assertCanBeat(true, [A2, B2, C2, D2], [A3, B3]);

    $this->assertCanBeat(
      true,
      [DR, PH, C0, D0, BJ, CJ, AQ, DQ, AK, CK, BA, CA, DA],
      [C9, B0, AJ, CQ, DK]
    );
  }

  public function testCanFulFillWish(): void
  {
    // SINGLE
    $this->assertTrue((new Hand([A3]))->canFulFillWish(3, new Combo([], NO_COMBO)));
    $this->assertTrue((new Hand([A3]))->canFulFillWish(3, new Combo([B2])));
    $this->assertFalse((new Hand([A3]))->canFulFillWish(3, new Combo([B3])));
    $this->assertFalse((new Hand([A3]))->canFulFillWish(4, new Combo([], NO_COMBO)));
    $this->assertTrue((new Hand([A3, B3, C3, D3]))->canFulFillWish(3, new Combo([A5])));

    // PAIR
    $this->assertTrue((new Hand([A3, B3]))->canFulFillWish(3, new Combo([B2, C2])));
    $this->assertTrue((new Hand([A3, PH]))->canFulFillWish(3, new Combo([B2, C2])));
    $this->assertFalse((new Hand([A3, B3]))->canFulFillWish(4, new Combo([B2, C2])));
    $this->assertFalse((new Hand([A3, B3]))->canFulFillWish(3, new Combo([B4, C4])));
    $this->assertTrue((new Hand([A3, B3, C3, D3]))->canFulFillWish(3, new Combo([A5, B5])));

    // TRIP
    $this->assertTrue((new Hand([A3, B3, C3]))->canFulFillWish(3, new Combo([B2, C2, D2])));
    $this->assertTrue((new Hand([A3, PH, C3]))->canFulFillWish(3, new Combo([B2, C2, D2])));
    $this->assertFalse((new Hand([A3, B3, C3]))->canFulFillWish(4, new Combo([B2, C2, D2])));
    $this->assertFalse((new Hand([A3, B3, C3]))->canFulFillWish(3, new Combo([B4, C4, D4])));
    $this->assertTrue((new Hand([A3, B3, C3, D3]))->canFulFillWish(3, new Combo([A5, B5, C5])));

    // RUNNING PAIRS
    $this->assertTrue((new Hand([A6, D6, C7, B7]))->canFulFillWish(6, new Combo([B2, C2, D3, A3])));
    $this->assertTrue((new Hand([A6, D6, C5, B5]))->canFulFillWish(6, new Combo([B2, C2, D3, A3])));
    $this->assertFalse((new Hand([A6, D6, B5]))->canFulFillWish(6, new Combo([B2, C2, D3, A3])));
    $this->assertFalse(
      (new Hand([A6, D6, C5, B5]))->canFulFillWish(7, new Combo([B2, C2, D3, A3]))
    );

    // STRAIGHT
    $this->assertTrue(
      (new Hand([A7, D8, C9, B0, AJ]))->canFulFillWish(7, new Combo([B2, C3, D4, A5, B6]))
    );
    $this->assertTrue(
      (new Hand([A7, D8, C9, B0, AJ]))->canFulFillWish(10, new Combo([B2, C3, D4, A5, B6]))
    );
    $this->assertTrue((new Hand([A2, A3, A4, A5, A6]))->canFulFillWish(2, new Combo([], NO_COMBO)));
    $this->assertFalse(
      (new Hand([DR, A2, A3, A4, A5]))->canFulFillWish(2, new Combo([B2, C3, D4, A5, B6]))
    );

    // FULL HOUSE
    $this->assertFalse(
      (new Hand([A6, B6, C6, A7, PH]))->canFulFillWish(5, new Combo([B2, C2, D3, A3, B3]))
    );
    $this->assertTrue(
      (new Hand([A6, D6, C7, B7, A7]))->canFulFillWish(6, new Combo([B2, C2, D3, A3, B3]))
    );
    $this->assertTrue(
      (new Hand([A6, D6, C6, B7, A7]))->canFulFillWish(6, new Combo([B2, C2, D3, A3, B3]))
    );
    $this->assertTrue(
      (new Hand([A6, D6, C6, B7, PH]))->canFulFillWish(6, new Combo([B2, C2, D3, A3, B3]))
    );
    $this->assertTrue(
      (new Hand([A6, D6, C6, B7, PH]))->canFulFillWish(7, new Combo([B2, C2, D3, A3, B3]))
    );
    $this->assertTrue(
      (new Hand([PH, D6, C6, B7, A7]))->canFulFillWish(6, new Combo([B2, C2, D3, A3, B3]))
    );
    $this->assertTrue(
      (new Hand([PH, D6, C6, B7, A7]))->canFulFillWish(7, new Combo([B2, C2, D3, A3, B3]))
    );
    $this->assertTrue(
      (new Hand([A6, B6, C6, A9, B9, PH]))->canFulFillWish(9, new Combo([B2, C2, D8, A8, B8]))
    );
    $this->assertFalse(
      (new Hand([A6, B6, C6, PH]))->canFulFillWish(6, new Combo([B2, C2, D3, A3, B3]))
    );
    $this->assertFalse(
      (new Hand([A6, D6, C8, B7, A7]))->canFulFillWish(6, new Combo([B2, C2, D3, A3, B3]))
    );
    $this->assertFalse(
      (new Hand([A6, D6, DR, MJ, DOG, PH]))->canFulFillWish(6, new Combo([B2, C2, D3, A3, B3]))
    );
    $this->assertFalse(
      (new Hand([A6, D6, C7, B7, A7, A8]))->canFulFillWish(8, new Combo([B2, C2, D3, A3, B3]))
    );
    $this->assertFalse((new Hand([]))->canFulFillWish(8, new Combo([B2, C2, D3, A3, B3])));
    $this->assertFalse(
      (new Hand([DR, MJ, DOG]))->canFulFillWish(8, new Combo([B2, C2, D3, A3, B3]))
    );

    // BOMB
    $this->assertTrue((new Hand([A3, B3, C3, D3]))->canFulFillWish(3, new Combo([A2, B2, C2, D2])));
    $this->assertTrue(
      (new Hand([A2, A3, A4, A5, A6]))->canFulFillWish(2, new Combo([A3, B3, C3, D3]))
    );
    $this->assertFalse(
      (new Hand([A3, B3, C3, A4, B4, C4, D4, A7, A8, A9, A0, AJ]))->canFulFillWish(
        3,
        new Combo([A2, B2, C2, D2])
      )
    );
  }
}
?>
