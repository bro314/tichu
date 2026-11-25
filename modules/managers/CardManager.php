<?php

use Bga\GameFramework\Table;

class CardManager
{
  private static ?CardManager $instance = null;
  public static function getInstance(): CardManager
  {
    if (self::$instance == null) {
      self::$instance = new CardManager();
    }
    return self::$instance;
  }

  /** @var \Bga\GameFramework\Components\Deck|null */
  private static $deck = null;

  /**
   * @return \Bga\GameFramework\Components\Deck
   */
  public static function getDeck()
  {
    if (self::$deck == null) {
      self::$deck = Tichu::$instance->bga->deckFactory->createDeck("card");
    }
    return self::$deck;
  }

  public static function setupCards(): void
  {
    $cards = []; //(0 => 0)
    for ($color = 1; $color < 5; $color++) {
      // swords=1, stars=2, pagodas=3, jade=4
      for ($value = 1; $value <= 14; $value++) {
        //  2, 3, 4, ... K, A
        $cards[] = [
          "type" => (string) $color,
          "type_arg" => $value,
          "nbr" => 1,
        ];
      }
    }
    self::getDeck()->createCards($cards, "deck");
  }

  /**
   * @return array<int|string, array<int, array<string, mixed>>>
   */
  public static function getPassedCards(): array
  {
    $sql =
      "SELECT card_id id, card_type type, card_type_arg type_arg, card_location_arg location_arg, card_passed_from passed_from FROM card WHERE card_location = 'temporary'";
    $res = Table::getObjectListFromDB($sql);
    $ret = [];
    foreach ($res as $row) {
      $pId = $row["location_arg"];
      if (!isset($ret[$pId])) {
        $ret[$pId] = [];
      }
      $ret[$pId][] = $row;
    }
    return $ret;
  }

  /**
   * @return array<int, array<string, mixed>>
   */
  public static function getCardsInLocation(string $location, int|string $location_arg): array
  {
    $escapedLocation = Table::escapeStringForDB((string) $location);
    $locArg = (int) $location_arg;
    $sql = "
    SELECT card_id id, card_type type, card_type_arg type_arg, card_location_arg location_arg, card_passed_from passed_from
    FROM card
    WHERE card_location = '$escapedLocation' AND card_location_arg = $locArg
    ";
    return Table::getObjectListFromDB($sql);
  }

  /**
   * @return array<int|string, int>
   */
  public static function calculateCapturedPoints(): array
  {
    $players = PlayerManager::getPlayerIds();
    return Utils::map(function ($pId): int {
      return (int) self::getTrickValue(
        self::getDeck()->getCardsInLocation("captured", (int) $pId)
      );
    }, $players);
  }

  /**
   * Return array of three cards that were passed to this player.
   * [0]: previous player
   * [1]: partner
   * [2]: next player
   *
   * @return array<int, array<string, mixed>|null>
   */
  public static function getCardsPassedTo(int|string $pId): array
  {
    $playerId = (int) $pId;
    $cardsEntries = array_values(
      Table::getObjectListFromDB(
        "SELECT card_id id, card_type type, card_type_arg type_arg, card_passed_from passed_from FROM card WHERE card_location = 'temporary' AND card_location_arg=$playerId"
      )
    );
    $cards = [null, null, null];
    $nextPlayers = PlayerManager::getNextPlayers($playerId);
    foreach ($cardsEntries as $card) {
      if ($card["passed_from"] == $nextPlayers[2]["id"]) {
        $cards[0] = $card;
      } elseif ($card["passed_from"] == $nextPlayers[1]["id"]) {
        $cards[1] = $card;
      } elseif ($card["passed_from"] == $nextPlayers[0]["id"]) {
        $cards[2] = $card;
      }
    }
    return $cards;
  }

  /**
   * Return the 3 temporary cards given by `$playerId`, ordered to match
   * `PlayerManager::getNextPlayers($playerId, true)` slots `[0..2]` (prev, partner, next).
   *
   * @return array<int, array<string, mixed>>
   */
  public static function getGivenTemporaryCardsOrdered(int $playerId, bool $forUpdate = false): array
  {
    $sql =
      "SELECT card_id id, card_type type, card_type_arg type_arg, card_location_arg location_arg, card_passed_from passed_from FROM card WHERE card_location = 'temporary' AND card_passed_from = $playerId";
    if ($forUpdate) {
      $sql .= " FOR UPDATE";
    }
    $rows = array_values(Table::getObjectListFromDB($sql));
    if (empty($rows)) {
      return [];
    }
    $nextPlayers = PlayerManager::getNextPlayers($playerId, true);
    $ordered = [];
    $usedIds = [];
    for ($idx = 0; $idx < 3; $idx++) {
      $recipientId = (int) ($nextPlayers[$idx]["id"] ?? 0);
      foreach ($rows as $row) {
        $cid = (int) $row["id"];
        if (isset($usedIds[$cid])) {
          continue;
        }
        if ((int) $row["location_arg"] === $recipientId) {
          $ordered[] = $row;
          $usedIds[$cid] = true;
          break;
        }
      }
    }
    foreach ($rows as $row) {
      $cid = (int) $row["id"];
      if (!isset($usedIds[$cid])) {
        $ordered[] = $row;
      }
    }
    return $ordered;
  }

  /**
   * Return a player's 3 `'temporary'` passed cards back to `'hand'` (`card_passed_from = NULL`).
   * Preserves original recipient `location_arg` on the returned array so the client can pre-slot
   * the retracted draft back into the matching pass targets.
   *
   * @return array<int, array<string, mixed>>
   */
  public static function returnTemporaryCardsToHand(int $playerId): array
  {
    $cards = self::getGivenTemporaryCardsOrdered($playerId, true);
    if (count($cards) !== 3) {
      throw new \Bga\GameFramework\UserException(
        clienttranslate("You have not passed your cards yet")
      );
    }
    Table::DbQuery(
      "UPDATE card SET card_location = 'hand', card_location_arg = $playerId, card_passed_from = NULL WHERE card_location = 'temporary' AND card_passed_from = $playerId"
    );
    return $cards;
  }

  public static function resetPassedCards(): void
  {
    Table::DbQuery("UPDATE card SET card_passed_from=NULL ");
  }

  /**
   * @param array<int|string, int|string> $ids
   */
  public static function setPassedCards(array $ids, int|string $playerId): void
  {
    $ids = array_values(
      array_filter(array_map("intval", $ids), static fn(int $id): bool => $id > 0)
    );
    if (empty($ids)) {
      return;
    }
    $pId = (int) $playerId;
    $join = implode(",", $ids);
    Table::DbQuery("UPDATE card SET card_passed_from=$pId WHERE card_id IN ($join)");
  }

  /**
   * @param array<string, mixed>|int|float|string|null $card
   */
  public static function cardToStr(array|int|float|string|null $card, bool $plural = false): string
  {
    $val = is_array($card) ? $card["type_arg"] ?? "" : $card;
    if (!is_numeric($val) || (float) $val != (int) $val) {
      return $plural ? strval($val) . "s" : strval($val);
    }
    switch ((int) $val) {
      case 1:
        if (!is_array($card)) {
          return "1";
        }
        switch ((int) ($card["type"] ?? 0)) {
          case 1:
            return clienttranslate("Dragon");
          case 2:
            return clienttranslate("Phoenix");
          case 3:
            return clienttranslate("Dog");
          case 4:
            return clienttranslate("Mahjong");
        }
        break;
      case 2:
        return $plural ? clienttranslate("2s") : "2";
      case 3:
        return $plural ? clienttranslate("3s") : "3";
      case 4:
        return $plural ? clienttranslate("4s") : "4";
      case 5:
        return $plural ? clienttranslate("5s") : "5";
      case 6:
        return $plural ? clienttranslate("6s") : "6";
      case 7:
        return $plural ? clienttranslate("7s") : "7";
      case 8:
        return $plural ? clienttranslate("8s") : "8";
      case 9:
        return $plural ? clienttranslate("9s") : "9";
      case 10:
        return $plural ? clienttranslate("10s") : "10";
      case 11:
        return $plural ? clienttranslate("Jacks") : clienttranslate("Jack");
      case 12:
        return $plural ? clienttranslate("Queens") : clienttranslate("Queen");
      case 13:
        return $plural ? clienttranslate("Kings") : clienttranslate("King");
      case 14:
        return $plural ? clienttranslate("Aces") : clienttranslate("Ace");
      default:
        if ($plural) {
          return strval($val) . "s";
        }
        return strval($val);
    }
    return strval($val);
  }

  /**
   * @param array<string, mixed>|int|string $card
   */
  public static function isTranslatableCardStr(array|int|string $card, bool $plural = false): bool
  {
    $val = is_array($card) ? $card["type_arg"] ?? null : $card;
    if (!is_numeric($val) || (float) $val != (int) $val) {
      return false;
    }
    $intVal = (int) $val;
    if ($intVal === 1) {
      if (!is_array($card)) {
        return false;
      }
      $suit = (int) ($card["type"] ?? 0);
      return $suit >= 1 && $suit <= 4;
    }
    if ($intVal >= 11 && $intVal <= 14) {
      return true;
    }
    if ($plural && $intVal >= 2 && $intVal <= 10) {
      return true;
    }
    return false;
  }

  /**
   * @param array<int|string, array<string, mixed>> $cards
   * @return ($asTable is true ? array{table: array<int, int>, special: array<int, int|string>, score: int} : int)
   */
  public static function getTrickValue(array $cards, bool $asTable = false): array|int
  {
    $score = 0;
    $table = Utils::map(function (int $i): int {
      return 0;
    }, range(2, 14));
    $special = [];
    foreach ($cards as $card) {
      $val = (int) $card["type_arg"];
      if ($val == 1) {
        $special[] = $card["type"];
      } else {
        $table[$val]++;
      }

      if ($val == 5) {
        $score += 5;
      } elseif ($val == 10) {
        $score += 10;
      } elseif ($val == 13) {
        $score += 10;
      } elseif ($val == 1 && $card["type"] == 2) {
        // Phoenix
        $score -= 25;
      } elseif ($val == 1 && $card["type"] == 1) {
        // Dragon
        $score += 25;
      }
    }
    return $asTable ? ["table" => $table, "special" => $special, "score" => $score] : $score;
  }

  public static function numPlayersStillInRound(): int
  {
    return count(self::getDeck()->countCardsByLocationArgs("hand"));
  }

  public static function canPass(int|string $pId, int|string $wish, ?Combo $lastCombo): bool
  {
    if ($wish == 0) {
      return true;
    }
    $cards = self::getDeck()->getCardsInLocation("hand", (int) $pId);
    $hand = new Hand($cards);
    return !$hand->canFulFillWish($wish, $lastCombo);
  }
}
?>
