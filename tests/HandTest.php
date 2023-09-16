<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

require_once "modules/Hand.php";
require_once "modules/Constants.php";
require_once "tests/TestUtils.php";

final class HandTest extends TestCase
{
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
}
?>
