<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

require_once "modules/Hand.php";
require_once "modules/Constants.php";
require_once "tests/TestUtils.php";

final class HandTest extends TestCase
{
  public function testHasBomb(): void
  {
    $this->assertTrue((new Hand([A2, B2, C2, D2]))->hasBomb());
    $this->assertTrue((new Hand([A0, B0, C0, D0]))->hasBomb());
    $this->assertTrue((new Hand([AA, BA, CA, DA]))->hasBomb());

    $this->assertTrue((new Hand([A2, A3, A4, A5, A6]))->hasBomb());

    $this->assertFalse((new Hand([A2, B2, C2]))->hasBomb());
    $this->assertFalse((new Hand([DR, PH, DOG, PH]))->hasBomb());
  }
}
?>
