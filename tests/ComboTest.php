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
}
?>
