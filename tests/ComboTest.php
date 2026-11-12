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
      "2&#39;s full of 3&#39;s",
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
}
?>
