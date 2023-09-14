<?php
class CardManager extends APP_GameClass
{
  private static $deck = null;
  public static function getDeck()
  {
    if (self::$deck == null) {
      self::$deck = self::getNew("module.common.deck");
      self::$deck->init("card");
    }
    return self::$deck;
  }

  public static function setupCards()
  {
    $cards = []; //(0 => 0)
    for ($color = 1; $color < 5; $color++) {
      // swords=1, stars=2, pagodas=3, jade=4
      for ($value = 1; $value <= 14; $value++) {
        //  2, 3, 4, ... K, A
        $cards[] = [
          "type" => $color,
          "type_arg" => $value,
          "nbr" => 1,
        ];
      }
    }
    self::getDeck()->createCards($cards, "deck");
  }

  public static function getPassedCards()
  {
    $sql =
      "SELECT card_id id, card_type type, card_type_arg type_arg, card_location_arg location_arg, card_passed_from passed_from FROM card WHERE card_location = 'temporary'";
    $res = self::getObjectListFromDB($sql);
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

  public static function calculatCapturedPoints()
  {
    $captured_points = [];
    $players = PlayerManager::getPlayerIds();
    return Utils::map(function ($pId) {
      return self::getTrickValue(self::getDeck()->getCardsInLocation("captured", $pId));
    }, $players);
  }

  // Return array of three cards that were passed to this player.
  // [0]: previous player
  // [1]: partner
  // [2]: next player
  public static function getCardsPassedTo($pId)
  {
    $cardsEntries = array_values(
      self::getObjectListFromDB(
        "SELECT card_id id, card_type type, card_type_arg type_arg, card_passed_from passed_from FROM card WHERE card_location = 'temporary' AND card_location_arg=$pId"
      )
    );
    $cards = [null, null, null];
    $nextPlayers = PlayerManager::getNextPlayers($pId);
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

  public static function resetPassedCards()
  {
    self::DbQuery("UPDATE card SET card_passed_from=NULL ");
  }

  public static function setPassedCards($ids, $playerId)
  {
    $join = implode(",", $ids);
    self::DbQuery("UPDATE card SET card_passed_from=$playerId WHERE card_id IN ($join)");
  }

  public static function cardToStr($card, $plural = false)
  {
    $val = is_array($card) ? $card["type_arg"] : $card;
    switch ($val) {
      case 1:
        if (!is_array($card)) {
          return "1";
        }
        switch ($card["type"]) {
          case 1:
            return "Dragon";
          case 2:
            return "Phoenix";
          case 3:
            return "Dog";
          case 4:
            return "Mahjong";
        }
      case 11:
        if ($plural) {
          return "Jacks";
        }
        return "Jack";
      case 12:
        if ($plural) {
          return "Queens";
        }
        return "Queen";
      case 13:
        if ($plural) {
          return "Kings";
        }
        return "King";
      case 14:
        if ($plural) {
          return "Aces";
        }
        return "Ace";
      default:
        if ($plural) {
          return strval($val) . "&#39;s";
        }
        return strval($val);
    }
  }

  public static function getTrickValue($cards, $asTable = false)
  {
    $score = 0;
    $table = Utils::map(function ($i) {
      return 0;
    }, range(2, 14));
    $special = [];
    foreach ($cards as $card) {
      $val = $card["type_arg"];
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
}
?>
