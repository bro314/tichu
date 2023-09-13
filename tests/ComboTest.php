<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

require_once "modules/Combo.php";
require_once "modules/Constants.php";

function card($type, $arg)
{
  return [
    "type" => $type,
    "type_arg" => $arg,
  ];
}

final class ComboTest extends TestCase
{
  public function testCheckSingle(): void
  {
    $this->assertEquals("2", Combo::checkSingle([card(1, 2)])["description"]);
    $this->assertEquals("5", Combo::checkSingle([card(2, 5)])["description"]);
    $this->assertEquals("Jack", Combo::checkSingle([card(3, 11)])["description"]);
    $this->assertEquals("Ace", Combo::checkSingle([card(4, 14)])["description"]);

    $this->assertEquals("Dragon", Combo::checkSingle([card(TYPE_DRAGON, 1)])["description"]);
    // requires DB access
    //$this->assertEquals("Phoenix", Combo::checkSingle([card(TYPE_PHOENIX, 1)])["description"]);
    $this->assertNull(Combo::checkSingle([card(TYPE_DOG, 1)]));
    $this->assertEquals("Mahjong", Combo::checkSingle([card(TYPE_MAHJONG, 1)])["description"]);
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
