<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

require_once "modules/Combo.php";
require_once "modules/Constants.php";
require_once "tests/TestUtils.php";

final class ComboTest extends TestCase
{
  protected function setUp(): void
  {
    LogManager::$lastComboForTesting = new Combo([], NO_COMBO);
  }

  protected function tearDown(): void
  {
    LogManager::$lastComboForTesting = null;
  }

  public function testCheckSingle(): void
  {
    $this->assertEquals("2", Combo::checkSingle([A2])["description"]);
    $this->assertEquals("5", Combo::checkSingle([B5])["description"]);
    $this->assertEquals("Jack", Combo::checkSingle([CJ])["description"]);
    $this->assertEquals("Ace", Combo::checkSingle([DA])["description"]);

    $this->assertEquals("Dragon", Combo::checkSingle([DR])["description"]);
    $this->assertEquals(
      "Phoenix a half step above 1",
      Combo::checkSingle([card(TYPE_PHOENIX, 1)])["description"]
    );
    LogManager::$lastComboForTesting = new Combo([DR]);
    $this->assertEquals(1.5, Combo::checkSingle([PH])["phoenixValue"]);
    LogManager::$lastComboForTesting = new Combo([A0]);
    $phOnTen = new Combo([PH]);
    $this->assertEquals(10.5, $phOnTen->phoenixValue);
    LogManager::$lastComboForTesting = $phOnTen;
    $this->assertEquals(11.0, Combo::checkSingle([PH])["phoenixValue"]);
    $this->assertNull(Combo::checkSingle([DOG]));
    $this->assertEquals("Mahjong", Combo::checkSingle([MJ])["description"]);
  }

  public function testFullHouse(): void
  {
    $this->assertEquals(
      "2s full of 3s",
      Combo::checkFullHouse([card(1, 2), card(2, 2), card(3, 2), card(1, 3), card(2, 3)])[
        "description"
      ]
    );
  }

  public function testRecheckPhoenixStraight(): void
  {
    // Against 2-3-4-5-6 (firstValue = 2): both 3-4-5-6-7 (firstValue = 3) and 4-5-6-7-8 (firstValue = 4) beat it
    LogManager::$lastComboForTesting = new Combo([A2, B3, C4, D5, A6]);
    $comboBoth = new Combo([B4, C5, D6, A7, PH]);
    $comboBoth->recheckPhoenix();
    $this->assertEquals([8, 3], $comboBoth->phoenixValue);

    // Against 3-4-5-6-7 (firstValue = 3): only 4-5-6-7-8 (firstValue = 4, phoenixValue = 8) beats it
    LogManager::$lastComboForTesting = new Combo([A3, B4, C5, D6, A7]);
    $comboHighOnly = new Combo([B4, C5, D6, A7, PH]);
    $comboHighOnly->recheckPhoenix();
    $this->assertEquals(8, $comboHighOnly->phoenixValue);
    $this->assertEquals(4, $comboHighOnly->getFirstValue());
    $this->assertTrue($comboHighOnly->canBeat(LogManager::$lastComboForTesting));
  }

  public function testRecheckPhoenixFullHouse(): void
  {
    // Against 2-2-2-3-3 (firstValue = 2): both 4-4-4-8-8 (firstValue = 4) and 8-8-8-4-4 (firstValue = 8) beat it
    LogManager::$lastComboForTesting = new Combo([A2, B2, C2, A3, B3]);
    $comboBoth = new Combo([A4, B4, C8, D8, PH]);
    $comboBoth->recheckPhoenix();
    $this->assertEquals([4, 8], $comboBoth->phoenixValue);

    // Against 5-5-5-3-3 (firstValue = 5): only 8-8-8-4-4 (firstValue = 8) beats it
    LogManager::$lastComboForTesting = new Combo([A5, B5, C5, A3, B3]);
    $comboHighOnly = new Combo([A4, B4, C8, D8, PH]);
    $comboHighOnly->recheckPhoenix();
    $this->assertEquals(8, $comboHighOnly->phoenixValue);
    $this->assertEquals(8, $comboHighOnly->getFirstValue());
    $this->assertTrue($comboHighOnly->canBeat(LogManager::$lastComboForTesting));
  }

  public function testRecheckPhoenixMismatchedTypeOrLength(): void
  {
    // Against a different combo type (Single)
    LogManager::$lastComboForTesting = new Combo([A2]);
    $comboVsSingle = new Combo([B4, C5, D6, A7, PH]);
    $comboVsSingle->recheckPhoenix();
    $this->assertFalse(is_array($comboVsSingle->phoenixValue));
    $this->assertFalse($comboVsSingle->canBeat(LogManager::$lastComboForTesting));

    // Against a different length straight (6-card straight)
    LogManager::$lastComboForTesting = new Combo([A2, B3, C4, D5, A6, B7]);
    $comboVsSixCardStraight = new Combo([B4, C5, D6, A7, PH]);
    $comboVsSixCardStraight->recheckPhoenix();
    $this->assertFalse(is_array($comboVsSixCardStraight->phoenixValue));
    $this->assertFalse($comboVsSixCardStraight->canBeat(LogManager::$lastComboForTesting));

    // Against a 4-of-a-kind bomb
    LogManager::$lastComboForTesting = new Combo([A2, B2, C2, D2]);
    $this->assertEquals(BOMB_COMBO, LogManager::$lastComboForTesting->type);
    $comboVsBomb4 = new Combo([B4, C5, D6, A7, PH]);
    $comboVsBomb4->recheckPhoenix();
    $this->assertFalse(is_array($comboVsBomb4->phoenixValue));
    $this->assertFalse($comboVsBomb4->canBeat(LogManager::$lastComboForTesting));

    // Against a 5-card straight flush bomb of the same length
    LogManager::$lastComboForTesting = new Combo([A2, A3, A4, A5, A6]);
    $this->assertEquals(BOMB_COMBO, LogManager::$lastComboForTesting->type);
    $comboVsStraightFlushBomb = new Combo([B4, C5, D6, A7, PH]);
    $comboVsStraightFlushBomb->recheckPhoenix();
    $this->assertFalse(is_array($comboVsStraightFlushBomb->phoenixValue));
    $this->assertFalse($comboVsStraightFlushBomb->canBeat(LogManager::$lastComboForTesting));
  }

  public function testRecheckPhoenixLeadAndDog(): void
  {
    // Lead (NO_COMBO): both values remain available
    LogManager::$lastComboForTesting = new Combo([], NO_COMBO);
    $comboLead = new Combo([B4, C5, D6, A7, PH]);
    $comboLead->recheckPhoenix();
    $this->assertEquals([8, 3], $comboLead->phoenixValue);

    // Lead after Dog (DOG_COMBO): both values remain available
    LogManager::$lastComboForTesting = new Combo([DOG]);
    $this->assertEquals(DOG_COMBO, LogManager::$lastComboForTesting->type);
    $comboAfterDog = new Combo([B4, C5, D6, A7, PH]);
    $comboAfterDog->recheckPhoenix();
    $this->assertEquals([8, 3], $comboAfterDog->phoenixValue);
  }

  public function testBug257052SameSuitStraightWithPhoenixAndStringValues(): void
  {
    // 4 blue (Pagodas) 7-10 + Phoenix is a straight (6-10 or 7-J), NEVER a straight flush bomb
    $combo = new Combo([C7, C8, C9, C0, PH]);
    $this->assertSame(STRAIGHT_COMBO, $combo->type);
    $this->assertSame([11, 6], $combo->phoenixValue);

    // Selecting "11" as a string (like HTTP query param from BGA getArg) coerces to strict int 11
    $combo->setPhoenixValue("11");
    $this->assertSame(11, $combo->phoenixValue);
    $this->assertSame(7, $combo->getFirstValue());
    $this->assertSame("Run of 5 cards from 7 to Jack", $combo->description);
    $this->assertTrue((new Combo([A8, B9, C0, DJ, AQ]))->canBeat($combo));
    $this->assertFalse((new Combo([A7, B8, C9, D0, AJ]))->canBeat($combo));

    // Deck DB rows return string type / type_arg values; phoenixValue must remain strict int / int[]
    $strCard = static function (string $id, int $type, int $arg): array {
      return ["id" => $id, "type" => (string) $type, "type_arg" => (string) $arg];
    };
    $phStr = $strCard("99", TYPE_PHOENIX, 1);

    $pairCombo = new Combo([$phStr, $strCard("1", 3, 7)]);
    $this->assertSame(PAIR_COMBO, $pairCombo->type);
    $this->assertSame(7, $pairCombo->phoenixValue);

    $tripCombo = new Combo([$phStr, $strCard("1", 3, 7), $strCard("2", 1, 7)]);
    $this->assertSame(TRIP_COMBO, $tripCombo->type);
    $this->assertSame(7, $tripCombo->phoenixValue);

    $runningPairCombo = new Combo([
      $phStr,
      $strCard("1", 1, 7),
      $strCard("2", 2, 7),
      $strCard("3", 3, 8),
    ]);
    $this->assertSame(RUNNING_PAIRS_COMBO, $runningPairCombo->type);
    $this->assertSame(8, $runningPairCombo->phoenixValue);

    $straightCombo = new Combo([
      $phStr,
      $strCard("1", 3, 7),
      $strCard("2", 3, 8),
      $strCard("3", 3, 9),
      $strCard("4", 3, 10),
    ]);
    $this->assertSame(STRAIGHT_COMBO, $straightCombo->type);
    $this->assertSame([11, 6], $straightCombo->phoenixValue);

    $fhAabb = new Combo([
      $phStr,
      $strCard("1", 1, 4),
      $strCard("2", 2, 4),
      $strCard("3", 1, 8),
      $strCard("4", 2, 8),
    ]);
    $this->assertSame(FULL_HOUSE_COMBO, $fhAabb->type);
    $this->assertSame([4, 8], $fhAabb->phoenixValue);

    $fhAaab = new Combo([
      $phStr,
      $strCard("1", 1, 4),
      $strCard("2", 2, 4),
      $strCard("3", 3, 4),
      $strCard("4", 2, 8),
    ]);
    $this->assertSame(FULL_HOUSE_COMBO, $fhAaab->type);
    $this->assertSame(8, $fhAaab->phoenixValue);

    $fhAbbb = new Combo([
      $phStr,
      $strCard("1", 1, 4),
      $strCard("2", 1, 8),
      $strCard("3", 2, 8),
      $strCard("4", 3, 8),
    ]);
    $this->assertSame(FULL_HOUSE_COMBO, $fhAbbb->type);
    $this->assertSame(4, $fhAbbb->phoenixValue);
  }
}
?>
