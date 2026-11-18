<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

require_once "tests/stubs.php";
require_once "modules/Constants.php";
require_once "modules/Utils.php";
require_once "modules/managers/CardManager.php";
require_once "modules/managers/LogManager.php";
require_once "modules/managers/PlayerManager.php";
require_once "modules/managers/NotificationManager.php";
require_once "modules/Combo.php";
require_once "modules/Hand.php";
require_once "tests/TestUtils.php";

final class ComboTest extends TestCase
{
  protected function setUp(): void
  {
    LogManager::$lastComboForTesting = new Combo([], NO_COMBO);
    APP_DbObject::$lastQuery = null;
    APP_DbObject::$mockObjectListResult = null;
    APP_DbObject::$quietQueries = true;
    Table::$mockBgaEnvironment = "studio";
  }

  protected function tearDown(): void
  {
    LogManager::$lastComboForTesting = null;
    APP_DbObject::$lastQuery = null;
    APP_DbObject::$mockObjectListResult = null;
    APP_DbObject::$quietQueries = false;
    Table::$mockBgaEnvironment = "studio";
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

  public function testStubsEscapeStringAndNotificationMessage(): void
  {
    $this->assertSame(
      "O\\'Brien\\'s \\\"hand\\\" \\\\ test",
      \Bga\GameFramework\Table::escapeStringForDB("O'Brien's \"hand\" \\ test")
    );
    $this->assertSame("42", \Bga\GameFramework\Table::escapeStringForDB(42));

    $this->assertSame("studio", \Bga\GameFramework\Table::getBgaEnvironment());
    Table::$mockBgaEnvironment = "prod";
    $this->assertSame("prod", \Bga\GameFramework\Table::getBgaEnvironment());

    $notifMsg = new \Bga\GameFramework\NotificationMessage(
      'You must grant the Mahjong Wish and play a ${rank}',
      ["rank" => "Jack", "i18n" => ["rank"]]
    );
    $this->assertSame(
      'You must grant the Mahjong Wish and play a ${rank}',
      $notifMsg->message
    );
    $this->assertSame(["rank" => "Jack", "i18n" => ["rank"]], $notifMsg->args);

    $ex = new \Bga\GameFramework\UserException($notifMsg);
    $this->assertSame(
      'You must grant the Mahjong Wish and play a ${rank}',
      $ex->getMessage()
    );
    $this->assertSame(["rank" => "Jack", "i18n" => ["rank"]], $ex->args);
  }

  public function testPlayerManagerGetSelectStmntAndSqlSafety(): void
  {
    $baseSql = PlayerManager::getSelectStmnt();
    $this->assertStringNotContainsString(" WHERE ", $baseSql);

    $filteredSql = PlayerManager::getSelectStmnt([
      "player_id" => 2385074,
      "name" => "O'Brien",
      "team" => 1,
    ]);
    $this->assertStringContainsString("player_id = '2385074'", $filteredSql);
    $this->assertStringContainsString("player_name = 'O\\'Brien'", $filteredSql);
    $this->assertStringContainsString("player_team = '1'", $filteredSql);

    // CardManager::setPassedCards with empty or non-positive IDs is a safe no-op
    APP_DbObject::$lastQuery = null;
    CardManager::setPassedCards([], 101);
    $this->assertNull(APP_DbObject::$lastQuery);
    CardManager::setPassedCards([0, -5, "abc"], "101");
    $this->assertNull(APP_DbObject::$lastQuery);
    CardManager::setPassedCards(["12", 34], "101");
    $this->assertSame(
      "UPDATE card SET card_passed_from=101 WHERE card_id IN (12,34)",
      APP_DbObject::$lastQuery
    );

    // LogManager::getLastActions escapes action names
    APP_DbObject::$lastQuery = null;
    LogManager::getLastActions(["combo", "O'Reilly"], false);
    $this->assertNotNull(APP_DbObject::$lastQuery);
    $this->assertStringContainsString("('combo','O\\'Reilly')", APP_DbObject::$lastQuery);
  }

  public function testPlayerManagerGetNextPlayersWithoutActiveSession(): void
  {
    // Tichu::$instance is uninitialized (no active game/session), proving getNextPlayers($pId)
    // never falls back to Tichu::getCurrentId().
    $mockSeatAsc = [
      ["id" => "101", "no" => "1", "name" => "P1", "team" => "0"],
      ["id" => "102", "no" => "2", "name" => "P2", "team" => "1"],
      ["id" => "103", "no" => "3", "name" => "P3", "team" => "0"],
      ["id" => "104", "no" => "4", "name" => "P4", "team" => "1"],
    ];
    APP_DbObject::$mockObjectListResult = $mockSeatAsc;

    $from101 = PlayerManager::getNextPlayers(101);
    $this->assertSame(["102", "103", "104", "101"], array_column($from101, "id"));

    $from103 = PlayerManager::getNextPlayers(103);
    $this->assertSame(["104", "101", "102", "103"], array_column($from103, "id"));

    $fromStr102 = PlayerManager::getNextPlayers("102");
    $this->assertSame(["103", "104", "101", "102"], array_column($fromStr102, "id"));

    // Unknown spectator ID (0) terminates cleanly without infinite loop
    $fromSpectator = PlayerManager::getNextPlayers(0);
    $this->assertCount(4, $fromSpectator);

    // Descending order
    APP_DbObject::$mockObjectListResult = array_reverse($mockSeatAsc);
    $from101Desc = PlayerManager::getNextPlayers(101, true);
    $this->assertSame(["104", "103", "102", "101"], array_column($from101Desc, "id"));
    $this->assertNotNull(APP_DbObject::$lastQuery);
    $this->assertStringEndsWith("ORDER BY player_no DESC", APP_DbObject::$lastQuery);
  }

  public function testCardToStrAndIsTranslatableCardStr(): void
  {
    // Special cards
    $this->assertSame("Dragon", CardManager::cardToStr(DR));
    $this->assertSame("Phoenix", CardManager::cardToStr(PH));
    $this->assertSame("Dog", CardManager::cardToStr(DOG));
    $this->assertSame("Mahjong", CardManager::cardToStr(MJ));
    foreach ([DR, PH, DOG, MJ] as $special) {
      $this->assertTrue(CardManager::isTranslatableCardStr($special, false));
      $this->assertTrue(CardManager::isTranslatableCardStr($special, true));
    }

    // Malformed special card returns fallback "1" (never null) and is not translatable
    $malformed = ["type" => 0, "type_arg" => 1];
    $this->assertSame("1", CardManager::cardToStr($malformed));
    $this->assertFalse(CardManager::isTranslatableCardStr($malformed, false));
    $this->assertFalse(CardManager::isTranslatableCardStr($malformed, true));

    // Out-of-range / special scalar numbers
    foreach ([0, 1, 15, "0", "1", "15"] as $nonRank) {
      $this->assertSame((string) $nonRank, CardManager::cardToStr($nonRank, false));
      $this->assertFalse(CardManager::isTranslatableCardStr($nonRank, false));
      $this->assertFalse(CardManager::isTranslatableCardStr($nonRank, true));
    }

    // Numeric ranks 2..10: singular is NOT translatable, plural ("2s".."10s") IS translatable
    for ($r = 2; $r <= 10; $r++) {
      $cardArr = card(1, $r);
      $this->assertSame((string) $r, CardManager::cardToStr($cardArr, false));
      $this->assertSame((string) $r, CardManager::cardToStr($r, false));
      $this->assertSame("{$r}s", CardManager::cardToStr($cardArr, true));
      $this->assertSame("{$r}s", CardManager::cardToStr((string) $r, true));

      $this->assertFalse(CardManager::isTranslatableCardStr($cardArr, false));
      $this->assertFalse(CardManager::isTranslatableCardStr($r, false));
      $this->assertFalse(CardManager::isTranslatableCardStr((string) $r, false));
      $this->assertTrue(CardManager::isTranslatableCardStr($cardArr, true));
      $this->assertTrue(CardManager::isTranslatableCardStr($r, true));
      $this->assertTrue(CardManager::isTranslatableCardStr((string) $r, true));
    }

    // Face cards 11..14: both singular and plural ARE translatable
    $faces = [
      11 => ["Jack", "Jacks", AJ],
      12 => ["Queen", "Queens", BQ],
      13 => ["King", "Kings", CK],
      14 => ["Ace", "Aces", DA],
    ];
    foreach ($faces as $rank => [$singular, $plural, $cardArr]) {
      $this->assertSame($singular, CardManager::cardToStr($cardArr, false));
      $this->assertSame($singular, CardManager::cardToStr($rank, false));
      $this->assertSame($plural, CardManager::cardToStr($cardArr, true));
      $this->assertSame($plural, CardManager::cardToStr((string) $rank, true));

      $this->assertTrue(CardManager::isTranslatableCardStr($cardArr, false));
      $this->assertTrue(CardManager::isTranslatableCardStr($rank, false));
      $this->assertTrue(CardManager::isTranslatableCardStr($cardArr, true));
      $this->assertTrue(CardManager::isTranslatableCardStr((string) $rank, true));
    }
  }

  public function testComboToLogSpecAcrossAllShapesAndPhoenix(): void
  {
    // 1. DOG_COMBO
    $dog = new Combo([DOG]);
    $this->assertSame("Dog", $dog->description);
    $this->assertSame(["log" => "Dog", "args" => []], $dog->toLogSpec());

    // 2a. SINGLE_COMBO (numeric, face, special)
    $singleNum = new Combo([A7]);
    $this->assertSame("7", $singleNum->description);
    $this->assertSame("7", $singleNum->toLogSpec());

    $singleFace = new Combo([CJ]);
    $this->assertSame("Jack", $singleFace->description);
    $this->assertSame(["log" => "Jack", "args" => []], $singleFace->toLogSpec());

    $singleDragon = new Combo([DR]);
    $this->assertSame("Dragon", $singleDragon->description);
    $this->assertSame(["log" => "Dragon", "args" => []], $singleDragon->toLogSpec());

    $singleMj = new Combo([MJ]);
    $this->assertSame("Mahjong", $singleMj->description);
    $this->assertSame(["log" => "Mahjong", "args" => []], $singleMj->toLogSpec());

    // 2b. SINGLE_COMBO Phoenix (led, over numeric, over face)
    LogManager::$lastComboForTesting = new Combo([], NO_COMBO);
    $phLead = new Combo([PH]);
    $this->assertSame("Phoenix a half step above 1", $phLead->description);
    $this->assertSame(
      [
        "log" => 'Phoenix a half step above ${rank}',
        "args" => ["rank" => "1"],
      ],
      $phLead->toLogSpec()
    );

    LogManager::$lastComboForTesting = new Combo([A7]);
    $phOn7 = new Combo([PH]);
    $this->assertSame("Phoenix a half step above 7", $phOn7->description);
    $this->assertSame(
      [
        "log" => 'Phoenix a half step above ${rank}',
        "args" => ["rank" => "7"],
      ],
      $phOn7->toLogSpec()
    );

    LogManager::$lastComboForTesting = new Combo([CJ]);
    $phOnJack = new Combo([PH]);
    $this->assertSame("Phoenix a half step above Jack", $phOnJack->description);
    $this->assertSame(
      [
        "log" => 'Phoenix a half step above ${rank}',
        "args" => ["rank" => "Jack", "i18n" => ["rank"]],
      ],
      $phOnJack->toLogSpec()
    );
    LogManager::$lastComboForTesting = new Combo([], NO_COMBO);

    // 3. PAIR_COMBO
    $pairNum = new Combo([A5, B5]);
    $this->assertSame("Pair of 5s", $pairNum->description);
    $this->assertSame(
      [
        "log" => 'Pair of ${rank}',
        "args" => ["rank" => "5s", "i18n" => ["rank"]],
      ],
      $pairNum->toLogSpec()
    );

    $pairPhFace = new Combo([PH, CQ]);
    $this->assertSame("Pair of Queens", $pairPhFace->description);
    $this->assertSame(
      [
        "log" => 'Pair of ${rank}',
        "args" => ["rank" => "Queens", "i18n" => ["rank"]],
      ],
      $pairPhFace->toLogSpec()
    );

    // 4. TRIP_COMBO
    $tripNum = new Combo([A8, B8, C8]);
    $this->assertSame("Triple of 8s", $tripNum->description);
    $this->assertSame(
      [
        "log" => 'Triple of ${rank}',
        "args" => ["rank" => "8s", "i18n" => ["rank"]],
      ],
      $tripNum->toLogSpec()
    );

    $tripPhFace = new Combo([PH, AK, BK]);
    $this->assertSame("Triple of Kings", $tripPhFace->description);
    $this->assertSame(
      [
        "log" => 'Triple of ${rank}',
        "args" => ["rank" => "Kings", "i18n" => ["rank"]],
      ],
      $tripPhFace->toLogSpec()
    );

    // 5. RUNNING_PAIRS_COMBO (numeric-only, numeric-to-face, face-to-face)
    $rpNum = new Combo([A4, B4, C5, D5]);
    $this->assertSame("2 consecutive doubles from 4 to 5", $rpNum->description);
    $this->assertSame(
      [
        "log" => '${pair_count} consecutive doubles from ${lowest} to ${highest}',
        "args" => ["pair_count" => 2, "lowest" => "4", "highest" => "5"],
      ],
      $rpNum->toLogSpec()
    );

    $rpMixed = new Combo([A0, B0, CJ, DJ, AQ, BQ]);
    $this->assertSame("3 consecutive doubles from 10 to Queen", $rpMixed->description);
    $this->assertSame(
      [
        "log" => '${pair_count} consecutive doubles from ${lowest} to ${highest}',
        "args" => [
          "pair_count" => 3,
          "lowest" => "10",
          "highest" => "Queen",
          "i18n" => ["highest"],
        ],
      ],
      $rpMixed->toLogSpec()
    );

    $rpFaces = new Combo([AJ, BJ, CQ, PH]);
    $this->assertSame("2 consecutive doubles from Jack to Queen", $rpFaces->description);
    $this->assertSame(
      [
        "log" => '${pair_count} consecutive doubles from ${lowest} to ${highest}',
        "args" => [
          "pair_count" => 2,
          "lowest" => "Jack",
          "highest" => "Queen",
          "i18n" => ["lowest", "highest"],
        ],
      ],
      $rpFaces->toLogSpec()
    );

    // 6. STRAIGHT_COMBO (Mahjong, face high, ambiguous Phoenix, resolved high/low Phoenix)
    $stMj = new Combo([MJ, A2, B3, C4, D5]);
    $this->assertSame("Run of 5 cards from 1 to 5", $stMj->description);
    $this->assertSame(
      [
        "log" => 'Run of ${count} cards from ${lowest} to ${highest}',
        "args" => ["count" => 5, "lowest" => "1", "highest" => "5"],
      ],
      $stMj->toLogSpec()
    );

    $stAmb = new Combo([C7, C8, C9, C0, PH]);
    $this->assertSame([11, 6], $stAmb->phoenixValue);
    $this->assertSame("Run of 5 cards from 6 to 10", $stAmb->description);
    $this->assertSame(
      [
        "log" => 'Run of ${count} cards from ${lowest} to ${highest}',
        "args" => ["count" => 5, "lowest" => "6", "highest" => "10"],
      ],
      $stAmb->toLogSpec()
    );

    $stAmb->setPhoenixValue(11);
    $this->assertSame("Run of 5 cards from 7 to Jack", $stAmb->description);
    $this->assertSame(
      [
        "log" => 'Run of ${count} cards from ${lowest} to ${highest}',
        "args" => ["count" => 5, "lowest" => "7", "highest" => "Jack", "i18n" => ["highest"]],
      ],
      $stAmb->toLogSpec()
    );

    $stLow = new Combo([C7, C8, C9, C0, PH]);
    $stLow->setPhoenixValue(6);
    $this->assertSame("Run of 5 cards from 6 to 10", $stLow->description);
    $this->assertSame(
      [
        "log" => 'Run of ${count} cards from ${lowest} to ${highest}',
        "args" => ["count" => 5, "lowest" => "6", "highest" => "10"],
      ],
      $stLow->toLogSpec()
    );

    $stForcedLow = new Combo([PH, BJ, CQ, DK, AA]);
    $this->assertSame(10, $stForcedLow->phoenixValue);
    $this->assertSame("Run of 5 cards from 10 to Ace", $stForcedLow->description);
    $this->assertSame(
      [
        "log" => 'Run of ${count} cards from ${lowest} to ${highest}',
        "args" => ["count" => 5, "lowest" => "10", "highest" => "Ace", "i18n" => ["highest"]],
      ],
      $stForcedLow->toLogSpec()
    );

    // 7. FULL_HOUSE_COMBO (natural, ambiguous Phoenix, resolved Phoenix both ways)
    $fhNat = new Combo([A2, B2, C2, A3, B3]);
    $this->assertSame("2s full of 3s", $fhNat->description);
    $this->assertSame(
      [
        "log" => '${trip_rank} full of ${pair_rank}',
        "args" => [
          "trip_rank" => "2s",
          "pair_rank" => "3s",
          "i18n" => ["trip_rank", "pair_rank"],
        ],
      ],
      $fhNat->toLogSpec()
    );

    $fhAmb = new Combo([PH, A4, B4, CJ, DJ]);
    $this->assertSame([4, 11], $fhAmb->phoenixValue);
    $this->assertSame(
      [
        "log" => '${trip_rank} full of ${pair_rank}',
        "args" => [
          "trip_rank" => "4s",
          "pair_rank" => "Jacks",
          "i18n" => ["trip_rank", "pair_rank"],
        ],
      ],
      $fhAmb->toLogSpec()
    );

    $fhAmb->setPhoenixValue(11);
    $this->assertSame("Jacks full of 4s", $fhAmb->description);
    $this->assertSame(
      [
        "log" => '${trip_rank} full of ${pair_rank}',
        "args" => [
          "trip_rank" => "Jacks",
          "pair_rank" => "4s",
          "i18n" => ["trip_rank", "pair_rank"],
        ],
      ],
      $fhAmb->toLogSpec()
    );

    // 8. BOMB_COMBO (4-of-a-kind)
    $bomb4 = new Combo([A9, B9, C9, D9]);
    $this->assertSame("Bomb of four 9s", $bomb4->description);
    $this->assertSame(
      [
        "log" => 'Bomb of four ${rank}',
        "args" => ["rank" => "9s", "i18n" => ["rank"]],
      ],
      $bomb4->toLogSpec()
    );

    $bomb4Faces = new Combo([AA, BA, CA, DA]);
    $this->assertSame("Bomb of four Aces", $bomb4Faces->description);
    $this->assertSame(
      [
        "log" => 'Bomb of four ${rank}',
        "args" => ["rank" => "Aces", "i18n" => ["rank"]],
      ],
      $bomb4Faces->toLogSpec()
    );

    // 9. BOMB_COMBO (straight flush)
    $sfNum = new Combo([A2, A3, A4, A5, A6]);
    $this->assertSame("Straight flush bomb starting from 2 to 6", $sfNum->description);
    $this->assertSame(
      [
        "log" => 'Straight flush bomb starting from ${lowest} to ${highest}',
        "args" => ["lowest" => "2", "highest" => "6"],
      ],
      $sfNum->toLogSpec()
    );

    $sfFace = new Combo([B9, B0, BJ, BQ, BK]);
    $this->assertSame("Straight flush bomb starting from 9 to King", $sfFace->description);
    $this->assertSame(
      [
        "log" => 'Straight flush bomb starting from ${lowest} to ${highest}',
        "args" => ["lowest" => "9", "highest" => "King", "i18n" => ["highest"]],
      ],
      $sfFace->toLogSpec()
    );
  }
}
?>
