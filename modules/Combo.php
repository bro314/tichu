<?php
class Combo extends APP_GameClass
{
  public $cards;
  public $type;
  public $phoenixValue;
  public $description;
  public $player;

  public static $comboNames = [
    DOG_COMBO => "Dog",
    BOMB_COMBO => "Bomb",
    SINGLE_COMBO => "Single",
    PAIR_COMBO => "Pair",
    TRIP_COMBO => "Trip",
    RUNNING_PAIRS_COMBO => "RunningPair",
    STRAIGHT_COMBO => "Straight",
    FULL_HOUSE_COMBO => "FullHouse",
  ];

  public static $noCombo;

  /*
   * If a type is given, the members will just be set with the arguments. it can still be validated with checkType()
   * If no type is given, it will first sort the cards by value and color,
   * so the special cards will come first(by order of the types, see constants.php), then all the 2's, etc
   * then, it will go through each combotype and check, whether the combo is of that type, until it gets a hit.
   * Bomb has to be checked before straight, of course
   * when a combotype is valid, the respective checkFunction returns an array containing
   * 		- the ordered cards,
   *		- the description,
   *		- the phoenixvalue (null if no phoenix, array if more than 1 possibilities)
   */
  public function __construct($cards, $type = null, $phoenixValue = null, $description = null)
  {
    if (is_null($type)) {
      if (count($cards) == 0) {
        $this->type = INVALID_COMBO;
        return;
      }
      $colors = array_column($cards, "type");
      $values = array_column($cards, "type_arg");
      array_multisort($values, SORT_ASC, $colors, SORT_ASC, $cards);
      foreach (self::$comboNames as $type => $name) {
        $res = call_user_func("self::check$name", $cards);
        if (!is_null($res)) {
          //combo is of that type
          $this->cards = $res["cards"];
          $this->type = $type;
          $this->phoenixValue = $res["phoenixValue"];
          $this->description = $res["description"];
          return;
        }
      }
      $this->type = INVALID_COMBO;
    } else {
      $this->cards = $cards;
      $this->type = $type;
      $this->phoenixValue = $phoenixValue;
      $this->description = $description ?? "";
    }
  }

  // check if the given type is valid, and set ordered cards, phoenixvalue and description, if so
  public function checkType()
  {
    $typeName = self::$comboNames[$this->type];
    $colors = array_column($this->cards, "type");
    $values = array_column($this->cards, "type_arg");
    array_multisort($values, SORT_ASC, $colors, SORT_ASC, $this->cards);
    $res = call_user_func("self::check$typeName", $this->cards);
    if (is_null($res)) {
      $this->type = INVALID_COMBO;
      return false;
    } else {
      $this->cards = $res["cards"];
      $this->phoenixValue = $res["phoenixValue"];
      $this->description = $res["description"];
      return true;
    }
  }

  //check which phoenixvalues can be played
  public function recheckPhoenix()
  {
    $lastCombo = LogManager::getLastCombo();
    if (in_array($lastCombo->type, [NO_COMBO, DOG_COMBO])) {
      return;
    }
    if ($lastCombo->type != $this->type) {
      $this->setPhoenixValue($this->phoenixValue[0]); // will throw in completePlayCombo
      return;
    }
    $val = $lastCombo->getFirstValue();
    if ($this->phoenixValue[0] > $val) {
      return;
    } // both values can beat it
    //smaller value can't beat it. use higher value, completePlayCombo will check anyway if it can beat it
    $this->setPhoenixValue($this->phoenixValue[1]); // will throw in completePlayCombo
  }

  // check if the combo can be played on a given combo
  public function canBeat($combo)
  {
    if ($combo->type == NO_COMBO || $combo->type == DOG_COMBO) {
      return true;
    } //opening, all can be played
    $length = count($this->cards);
    $cLength = count($combo->cards);

    if ($this->type == BOMB_COMBO) {
      if ($combo->type == BOMB_COMBO) {
        if ($length == $cLength) {
          return $this->getFirstValue() > $combo->getFirstValue();
        }
        return $length > $cLength;
      }
      return true;
    }
    if ($this->type != $combo->type || $length != $cLength) {
      return false;
    }
    return $this->getFirstValue() > $combo->getFirstValue();
  }

  // get the value of the first card for comparison, if phoenix, return the phoenixvalue, if dragon, return 15(higher than any single card)
  public function getFirstValue()
  {
    $card = $this->cards[0];
    $val = $card["type_arg"];
    if ($card["type"] == TYPE_PHOENIX && $val == 1) {
      return $this->phoenixValue;
    }
    if ($card["type"] == TYPE_DRAGON && $val == 1) {
      return 15;
    }
    return $val;
  }

  /*
   * check if combo has the mahjong.
   * Since the cards are ordered and the mahjong can only be the only crd or the first in a straight,
   * we just need to check the first card.
   */
  public function hasMahjong()
  {
    //can only be the first card
    $card = $this->cards[0];
    return $card["type"] == TYPE_MAHJONG && $card["type_arg"] == 1;
  }

  public function hasDragon()
  {
    //can only be the only card
    $card = $this->cards[0];
    return $card["type"] == TYPE_DRAGON && $card["type_arg"] == 1;
  }

  /*
   * set the value of the phoenix, if a chice was needed.
   * there are only 2 cases, where the value would have to be chosen:
   * In a straight, if it can be the first or last.
   * In a full house when it's togehter with 2 pairs.
   */
  public function setPhoenixValue($val)
  {
    if ($this->type == STRAIGHT_COMBO) {
      $count = count($this->cards);
      if ($val == $this->phoenixValue[1]) {
        // lower value was chosen
        $highest = CardManager::cardToStr($this->cards[$count - 1]);
        $lowest = $val; // lowest is always a number
      } else {
        $this->cards[] = array_shift($this->cards); // move phoenix to the end
        $highest = CardManager::cardToStr($val);
        $lowest = $this->cards[0]["type_arg"]; // lowest is always a number
      }
      $this->description = "Run of $count cards from $lowest to $highest";
    } else {
      // full house
      if ($val == $this->phoenixValue[1]) {
        // just move the first pair to the end
        array_splice($this->cards, 3, 0, array_splice($this->cards, 1, 2));
      }
      $trip = CardManager::cardToStr($val, true);
      $pair = CardManager::cardToStr($this->cards[4], true);
      $this->description = "$trip full of $pair";
    }
    $this->phoenixValue = $val;
  }

  /************************************************
   * check functions as descriped in the constructor
   * keep in mind the cards are sorted!
   ****************************************************/

  public static function checkDog($cards)
  {
    if (count($cards) > 1) {
      return;
    }
    if ($cards[0]["type"] != TYPE_DOG || $cards[0]["type_arg"] != 1) {
      return;
    }
    return [
      "cards" => $cards,
      "phoenixValue" => null,
      "description" => "Dog",
    ];
  }

  public static function checkBomb($cards)
  {
    if (count($cards) < 4 || $cards[0]["type_arg"] == 1) {
      return;
    }
    $description = null;
    if (count($cards) == 4) {
      if ($cards[0]["type_arg"] != $cards[3]["type_arg"]) {
        return;
      }
      $description = "Bomb of four " . CardManager::cardToStr($cards[0], true);
    } else {
      $firstVal = $cards[0]["type_arg"];
      $color = $cards[0]["type"];
      foreach ($cards as $idx => $card) {
        if ($card["type"] != $color) {
          return;
        }
        if ($card["type_arg"] != $firstVal + $idx) {
          return;
        }
      }
      $description =
        "Straight flush bomb starting from " .
        CardManager::cardToStr($cards[0]) .
        " to " .
        CardManager::cardToStr($cards[count($cards) - 1]);
    }
    return [
      "cards" => $cards,
      "phoenixValue" => null,
      "description" => $description,
    ];
  }

  public static function checkSingle($cards)
  {
    if (count($cards) > 1) {
      return;
    }
    $phoenixValue = null;
    $card = $cards[0];
    if ($card["type_arg"] == 1 && $card["type"] == TYPE_DOG) {
      return;
    }
    if ($card["type_arg"] == 1 && $card["type"] == TYPE_PHOENIX) {
      //get Value from last combo of this trick
      $lastCombo = LogManager::getLastCombo();
      $val = $lastCombo->type == SINGLE_COMBO ? $lastCombo->cards[0]["type_arg"] : 1;
      $phoenixValue = $val + 0.5;
      $description = "Phoenix a half step above " . CardManager::cardToStr($val);
    } else {
      $description = CardManager::cardToStr($card);
    }

    return [
      "cards" => $cards,
      "phoenixValue" => $phoenixValue,
      "description" => $description,
    ];
  }

  public static function checkPair($cards)
  {
    if (count($cards) != 2) {
      return;
    }
    $phoenixValue = null;
    if ($cards[0]["type_arg"] == 1) {
      if ($cards[0]["type"] != TYPE_PHOENIX) {
        return;
      }
      $phoenixValue = $cards[1]["type_arg"];
      if ($phoenixValue == 1) {
        return;
      }
    } else {
      if ($cards[0]["type_arg"] != $cards[1]["type_arg"]) {
        return;
      }
    }

    return [
      "cards" => $cards,
      "phoenixValue" => $phoenixValue,
      "description" => "Pair of " . CardManager::cardToStr($cards[1], true),
    ];
  }

  public static function checkTrip($cards)
  {
    if (count($cards) != 3) {
      return;
    }
    $phoenixValue = null;
    if ($cards[0]["type_arg"] == 1) {
      if ($cards[0]["type"] != TYPE_PHOENIX) {
        return;
      }
      $phoenixValue = $cards[1]["type_arg"];
      if ($phoenixValue == 1 || $cards[2]["type_arg"] != $phoenixValue) {
        return;
      }
    } else {
      if (
        $cards[0]["type_arg"] != $cards[1]["type_arg"] ||
        $cards[0]["type_arg"] != $cards[2]["type_arg"]
      ) {
        return;
      }
    }

    return [
      "cards" => $cards,
      "phoenixValue" => $phoenixValue,
      "description" => "Triple of " . CardManager::cardToStr($cards[1], true),
    ];
  }

  public static function checkRunningPair($cards)
  {
    $count = count($cards);
    if ($count % 2 != 0 || $count < 4) {
      return;
    }
    $phoenixValue = null;
    $phoenixIndex = null;
    $phoenix = null;
    if ($cards[0]["type_arg"] == 1) {
      if ($cards[0]["type"] != TYPE_PHOENIX) {
        return;
      }
      $phoenix = array_shift($cards);
    }
    $value = $cards[0]["type_arg"];
    if ($value == 1) {
      return;
    }
    foreach ($cards as $i => $card) {
      if ($i == 0) {
        continue;
      }
      $idx = $i + (is_null($phoenixValue) ? 0 : 1); //if the phoenix has been used, shift idx
      if ($idx % 2 == 0) {
        //new Pair
        $value++;
        if ($card["type_arg"] != $value) {
          return;
        }
      } else {
        if ($card["type_arg"] != $value) {
          //check if phoenix is available(and unused) and do the check for newPair
          if (is_null($phoenix) || !is_null($phoenixValue)) {
            return;
          }
          $phoenixValue = $value;
          $phoenixIndex = $i;
          $value++;
          if ($card["type_arg"] != $value) {
            return;
          }
        }
      }
    }
    if (!is_null($phoenix)) {
      if (is_null($phoenixValue)) {
        //if the loop founds no gap, it's the last one.
        $phoenixValue = $value;
        $cards[] = $phoenix;
      } else {
        array_splice($cards, $phoenixIndex, 0, [$phoenix]);
      }
    }

    $description =
      $count / 2 .
      " consecutive doubles from " .
      CardManager::cardToStr($cards[0], false) .
      " to " .
      CardManager::cardToStr($cards[$count - 2], false); //first card of each pair cant be phoenix

    return [
      "cards" => $cards,
      "phoenixValue" => $phoenixValue,
      "description" => $description,
    ];
  }

  public static function checkStraight($cards)
  {
    $count = count($cards);
    if ($count < 5) {
      return;
    }
    $phoenixValue = null;
    $phoenixIndex = null;
    $phoenix = null;
    if ($cards[0]["type_arg"] == 1) {
      switch ($cards[0]["type"]) {
        case TYPE_PHOENIX:
          if ($cards[1]["type_arg"] == 1 && $cards[1]["type"] != TYPE_MAHJONG) {
            return;
          }
          $phoenix = array_shift($cards);
          break;
        case TYPE_MAHJONG:
          break;
        default:
          return;
      }
    }
    $value = $cards[0]["type_arg"];
    foreach ($cards as $i => $card) {
      if ($card["type_arg"] != $value) {
        if (is_null($phoenix) || !is_null($phoenixValue)) {
          return;
        }
        $phoenixValue = $value;
        $phoenixIndex = $i;
        $value++;
        if ($card["type_arg"] != $value) {
          return;
        }
      }
      $value++;
    }
    $lowest = $cards[0]["type_arg"];
    if (!is_null($phoenix)) {
      if (is_null($phoenixValue)) {
        // no gap detected
        $values = [];
        if ($value < 15) {
          // last card was no ace, phoenix can be put at end
          $values[] = $value;
          $phoenixIndex = $count - 1;
        }
        if ($value > $count + 1) {
          // first card was not 2, phoenix can be put at start
          $values[] = $value - $count;
          $phoenixIndex = 0;
          $lowest = $value - $count; //needed for description
        }
        $phoenixValue = count($values) == 1 ? $values[0] : $values;
      }
      array_splice($cards, $phoenixIndex, 0, [$phoenix]); //if both are possible phoenixIndex is 0
    }

    $highest = CardManager::cardToStr(
      $phoenixIndex == $count - 1 ? $phoenixValue : $cards[$count - 1]
    );
    //description will be recalculated if phoenix is set.
    $description = "Run of $count cards from $lowest to $highest"; //lowest is always a number
    return [
      "cards" => $cards,
      "phoenixValue" => $phoenixValue,
      "description" => $description,
    ];
  }

  public static function checkFullHouse($cards)
  {
    if (count($cards) != 5) {
      return;
    }
    $phoenixValue = null;
    $phoenixIndex = null;
    $distinct = array_unique(array_column($cards, "type_arg")); // get distinct values
    if ($cards[0]["type_arg"] == 1) {
      // special card, check if phoenix
      if ($cards[0]["type"] != TYPE_PHOENIX || $cards[1]["type_arg"] == 1) {
        return;
      } //special card other than phoenix
      if (count($distinct) != 3) {
        return;
      }
      $first = $cards[1]["type_arg"];
      $last = $cards[4]["type_arg"];
      if ($cards[2]["type_arg"] == $last) {
        //ABBB
        $phoenixValue = $first;
        $cards = array_reverse($cards);
      } elseif ($cards[3]["type_arg"] == $first) {
        //AAAB
        $phoenixValue = $last;
        $cards[] = array_shift($cards); // put phoenix at the end
      } else {
        //AABB
        $phoenixValue = [$first, $last];
      }
    } else {
      if (count($distinct) != 2) {
        return;
      }
      $first = $cards[0]["type_arg"];
      $last = $cards[4]["type_arg"];
      if ($cards[1]["type_arg"] != $first) {
        return;
      }
      if ($cards[3]["type_arg"] != $last) {
        return;
      }

      if ($cards[2]["type_arg"] == $last) {
        $cards = array_reverse($cards);
      } //trip should come first
    }

    return [
      "cards" => $cards,
      "phoenixValue" => $phoenixValue,
      "description" =>
        CardManager::cardToStr($cards[1], true) .
        " full of " .
        CardManager::cardToStr($cards[3], true), // idx 1 and 3 can't be phoenix
    ];
  }
}
?>
