<?php
class Combo
{
  /** @var array<int, array<string, mixed>>|null */
  public ?array $cards = null;
  public int $type = INVALID_COMBO;
  /** @var int|float|array<int, int|float>|null */
  public int|float|array|null $phoenixValue = null;
  public ?string $description = null;
  public int|string|null $player = null;

  /** @var array<int, string> */
  public static array $comboNames = [
    DOG_COMBO => "Dog",
    BOMB_COMBO => "Bomb",
    SINGLE_COMBO => "Single",
    PAIR_COMBO => "Pair",
    TRIP_COMBO => "Trip",
    RUNNING_PAIRS_COMBO => "RunningPair",
    STRAIGHT_COMBO => "Straight",
    FULL_HOUSE_COMBO => "FullHouse",
  ];

  public static Combo $noCombo;

  /**
   * If a type is given, the members will just be set with the arguments. it can still be validated with checkType()
   * If no type is given, it will first sort the cards by value and color,
   * so the special cards will come first(by order of the types, see constants.php), then all the 2s, etc
   * then, it will go through each combotype and check, whether the combo is of that type, until it gets a hit.
   * Bomb has to be checked before straight, of course
   * when a combotype is valid, the respective checkFunction returns an array containing
   * 		- the ordered cards,
   *		- the description,
   *		- the phoenixvalue (null if no phoenix, array if more than 1 possibilities)
   *
   * @param array<int|string, array<string, mixed>> $cards
   * @param int|float|array<int, int|float>|null $phoenixValue
   */
  public function __construct(
    array $cards,
    int|string|null $type = null,
    int|float|array|null $phoenixValue = null,
    ?string $description = null
  ) {
    $cards = array_values($cards);
    if (is_null($type)) {
      if (count($cards) == 0) {
        $this->type = INVALID_COMBO;
        return;
      }
      $colors = array_column($cards, "type");
      $values = array_column($cards, "type_arg");
      array_multisort($values, SORT_ASC, $colors, SORT_ASC, $cards);
      foreach (self::$comboNames as $comboType => $name) {
        $res = call_user_func([self::class, "check$name"], $cards);
        if (!is_null($res)) {
          //combo is of that type
          $this->cards = $res["cards"];
          $this->type = $comboType;
          $this->phoenixValue = $res["phoenixValue"];
          $this->description = $res["description"];
          return;
        }
      }
      $this->type = INVALID_COMBO;
    } else {
      $this->cards = $cards;
      $this->type = (int) $type;
      $this->phoenixValue = $phoenixValue;
      $this->description = $description ?? "";
    }
  }

  // check if the given type is valid, and set ordered cards, phoenixvalue and description, if so
  public function checkType(): bool
  {
    $cards = $this->cards ?? [];
    $typeName = self::$comboNames[$this->type];
    $colors = array_column($cards, "type");
    $values = array_column($cards, "type_arg");
    array_multisort($values, SORT_ASC, $colors, SORT_ASC, $cards);
    $this->cards = $cards;
    $res = call_user_func([self::class, "check$typeName"], $this->cards);
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
  public function recheckPhoenix(): void
  {
    if (!is_array($this->phoenixValue)) {
      return;
    }
    $lastCombo = LogManager::getLastCombo();
    if (in_array($lastCombo->type, [NO_COMBO, DOG_COMBO])) {
      return;
    }
    $cards = $this->cards ?? [];
    $lastCards = $lastCombo->cards ?? [];
    if ($lastCombo->type != $this->type || count($lastCards) != count($cards)) {
      $this->setPhoenixValue($this->phoenixValue[0]); // will throw in completePlayCombo
      return;
    }
    $val = $lastCombo->getFirstValue();
    if ($this->type == STRAIGHT_COMBO) {
      $lowFirst = $this->phoenixValue[1];
      if ($lowFirst > $val) {
        return; // both values can beat it
      }
      // low option can't beat it; use high option, completePlayCombo will check if it beats $lastCombo
      $this->setPhoenixValue($this->phoenixValue[0]);
      return;
    }
    if ($this->phoenixValue[0] > $val) {
      return;
    } // both values can beat it
    //smaller value can't beat it. use higher value, completePlayCombo will check anyway if it can beat it
    $this->setPhoenixValue($this->phoenixValue[1]); // will throw in completePlayCombo
  }

  // check if the combo can be played on a given combo
  public function canBeat(Combo $combo): bool
  {
    if ($combo->type == NO_COMBO || $combo->type == DOG_COMBO) {
      return true;
    } //opening, all can be played
    $length = count($this->cards ?? []);
    $cLength = count($combo->cards ?? []);

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

  /**
   * get the value of the first card for comparison, if phoenix, return the phoenixvalue, if dragon, return 15(higher than any single card)
   *
   * @return int|float|array<int, int|float>|null
   */
  public function getFirstValue(): int|float|array|null
  {
    if (empty($this->cards)) {
      return 0;
    }
    $card = $this->cards[0];
    $val = (int) $card["type_arg"];
    if ($card["type"] == TYPE_PHOENIX && $val == 1) {
      return is_numeric($this->phoenixValue) ? $this->phoenixValue + 0 : $this->phoenixValue;
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
  public function hasMahjong(): bool
  {
    //can only be the first card
    if (empty($this->cards)) {
      return false;
    }
    $card = $this->cards[0];
    return $card["type"] == TYPE_MAHJONG && $card["type_arg"] == 1;
  }

  public function hasDragon(): bool
  {
    //can only be the only card
    if (empty($this->cards)) {
      return false;
    }
    $card = $this->cards[0];
    return $card["type"] == TYPE_DRAGON && $card["type_arg"] == 1;
  }

  public function hasPhoenix(): bool
  {
    if (empty($this->cards)) {
      return false;
    }
    foreach ($this->cards as $card) {
      if ((int) $card["type"] === TYPE_PHOENIX && (int) $card["type_arg"] === 1) {
        return true;
      }
    }
    return false;
  }

  /*
   * set the value of the phoenix, if a chice was needed.
   * there are only 2 cases, where the value would have to be chosen:
   * In a straight, if it can be the first or last.
   * In a full house when it's togehter with 2 pairs.
   */
  public function setPhoenixValue(int|float|string $val): void
  {
    $val = is_numeric($val) ? (int) $val : $val;
    $cards = $this->cards ?? [];
    $prevPhoenix = is_array($this->phoenixValue) ? $this->phoenixValue : [0, 0];
    if ($this->type == STRAIGHT_COMBO) {
      $count = count($cards);
      if ($val == $prevPhoenix[1]) {
        // lower value was chosen
        $highest = CardManager::cardToStr($cards[$count - 1]);
        $lowest = $val; // lowest is always a number
      } else {
        $cards[] = array_shift($cards); // move phoenix to the end
        $highest = CardManager::cardToStr($val);
        $lowest = (int) $cards[0]["type_arg"]; // lowest is always a number
      }
      $this->cards = $cards;
      $this->description = "Run of $count cards from $lowest to $highest";
    } else {
      // full house
      if ($val == $prevPhoenix[1]) {
        // just move the first pair to the end
        array_splice($cards, 3, 0, array_splice($cards, 1, 2));
      }
      $this->cards = $cards;
      $trip = CardManager::cardToStr($val, true);
      $pair = CardManager::cardToStr($this->cards[4], true);
      $this->description = "$trip full of $pair";
    }
    $this->phoenixValue = (int) $val;
  }

  /**
   * Build a BGA Translation HQ static-extractable recursive `{ log, args }` spec (or scalar
   * numeric rank string for numeric singles) without altering canonical `$this->description`.
   *
   * @return array{log: string, args: array<string, mixed>}|string
   */
  public function toLogSpec(): array|string
  {
    $cards = $this->cards ?? [];
    $count = count($cards);
    switch ($this->type) {
      case DOG_COMBO:
        return [
          "log" => clienttranslate("Dog"),
          "args" => [],
        ];

      case SINGLE_COMBO:
        if ($count === 0) {
          return $this->description ?? "";
        }
        $card = $cards[0];
        if ((int) $card["type_arg"] === 1 && (int) $card["type"] === TYPE_PHOENIX) {
          $rawBase = is_numeric($this->phoenixValue) ? (float) $this->phoenixValue - 0.5 : 1;
          $baseVal =
            (float) $rawBase == (int) $rawBase ? (int) $rawBase : strval($rawBase);
          $args = ["rank" => CardManager::cardToStr($baseVal)];
          if (CardManager::isTranslatableCardStr($baseVal)) {
            $args["i18n"] = ["rank"];
          }
          return [
            "log" => clienttranslate('Phoenix a half step above ${rank}'),
            "args" => $args,
          ];
        }
        if (CardManager::isTranslatableCardStr($card)) {
          return [
            "log" => CardManager::cardToStr($card),
            "args" => [],
          ];
        }
        return CardManager::cardToStr($card);

      case PAIR_COMBO:
        $args = ["rank" => CardManager::cardToStr($cards[1], true)];
        if (CardManager::isTranslatableCardStr($cards[1], true)) {
          $args["i18n"] = ["rank"];
        }
        return [
          "log" => clienttranslate('Pair of ${rank}'),
          "args" => $args,
        ];

      case TRIP_COMBO:
        $args = ["rank" => CardManager::cardToStr($cards[1], true)];
        if (CardManager::isTranslatableCardStr($cards[1], true)) {
          $args["i18n"] = ["rank"];
        }
        return [
          "log" => clienttranslate('Triple of ${rank}'),
          "args" => $args,
        ];

      case RUNNING_PAIRS_COMBO:
        $lowestCard = $cards[0];
        $highestCard = $cards[$count - 2];
        $i18n = [];
        if (CardManager::isTranslatableCardStr($lowestCard, false)) {
          $i18n[] = "lowest";
        }
        if (CardManager::isTranslatableCardStr($highestCard, false)) {
          $i18n[] = "highest";
        }
        $args = [
          "pair_count" => (int) ($count / 2),
          "lowest" => CardManager::cardToStr($lowestCard, false),
          "highest" => CardManager::cardToStr($highestCard, false),
        ];
        if (!empty($i18n)) {
          $args["i18n"] = $i18n;
        }
        return [
          "log" => clienttranslate('${pair_count} consecutive doubles from ${lowest} to ${highest}'),
          "args" => $args,
        ];

      case STRAIGHT_COMBO:
        $firstIsPhoenix =
          (int) $cards[0]["type_arg"] === 1 && (int) $cards[0]["type"] === TYPE_PHOENIX;
        $lastIsPhoenix =
          (int) $cards[$count - 1]["type_arg"] === 1 &&
          (int) $cards[$count - 1]["type"] === TYPE_PHOENIX;
        if ($firstIsPhoenix) {
          $lowestTarget = is_array($this->phoenixValue)
            ? (int) $this->phoenixValue[1]
            : (int) $this->phoenixValue;
        } else {
          $lowestTarget = (int) $cards[0]["type_arg"];
        }
        if ($lastIsPhoenix) {
          $highestTarget = is_array($this->phoenixValue)
            ? (int) $this->phoenixValue[0]
            : (int) $this->phoenixValue;
        } else {
          $highestTarget = $cards[$count - 1];
        }
        $i18n = [];
        if (CardManager::isTranslatableCardStr($lowestTarget, false)) {
          $i18n[] = "lowest";
        }
        if (CardManager::isTranslatableCardStr($highestTarget, false)) {
          $i18n[] = "highest";
        }
        $args = [
          "count" => $count,
          "lowest" => CardManager::cardToStr($lowestTarget, false),
          "highest" => CardManager::cardToStr($highestTarget, false),
        ];
        if (!empty($i18n)) {
          $args["i18n"] = $i18n;
        }
        return [
          "log" => clienttranslate('Run of ${count} cards from ${lowest} to ${highest}'),
          "args" => $args,
        ];

      case FULL_HOUSE_COMBO:
        $tripCard = $cards[1];
        $pairCard = $cards[3];
        $i18n = [];
        if (CardManager::isTranslatableCardStr($tripCard, true)) {
          $i18n[] = "trip_rank";
        }
        if (CardManager::isTranslatableCardStr($pairCard, true)) {
          $i18n[] = "pair_rank";
        }
        $args = [
          "trip_rank" => CardManager::cardToStr($tripCard, true),
          "pair_rank" => CardManager::cardToStr($pairCard, true),
        ];
        if (!empty($i18n)) {
          $args["i18n"] = $i18n;
        }
        return [
          "log" => clienttranslate('${trip_rank} full of ${pair_rank}'),
          "args" => $args,
        ];

      case BOMB_COMBO:
        if ($count === 4) {
          $args = ["rank" => CardManager::cardToStr($cards[0], true)];
          if (CardManager::isTranslatableCardStr($cards[0], true)) {
            $args["i18n"] = ["rank"];
          }
          return [
            "log" => clienttranslate('Bomb of four ${rank}'),
            "args" => $args,
          ];
        }
        $lowestCard = $cards[0];
        $highestCard = $cards[$count - 1];
        $i18n = [];
        if (CardManager::isTranslatableCardStr($lowestCard, false)) {
          $i18n[] = "lowest";
        }
        if (CardManager::isTranslatableCardStr($highestCard, false)) {
          $i18n[] = "highest";
        }
        $args = [
          "lowest" => CardManager::cardToStr($lowestCard, false),
          "highest" => CardManager::cardToStr($highestCard, false),
        ];
        if (!empty($i18n)) {
          $args["i18n"] = $i18n;
        }
        return [
          "log" => clienttranslate('Straight flush bomb starting from ${lowest} to ${highest}'),
          "args" => $args,
        ];

      default:
        return $this->description ?? "";
    }
  }

  /************************************************
   * check functions as descriped in the constructor
   * keep in mind the cards are sorted!
   ****************************************************/

  /**
   * @param array<int, array<string, mixed>> $cards
   * @return array{cards: array<int, array<string, mixed>>, phoenixValue: null, description: string}|null
   */
  public static function checkDog(array $cards): ?array
  {
    if (count($cards) > 1) {
      return null;
    }
    if ($cards[0]["type"] != TYPE_DOG || $cards[0]["type_arg"] != 1) {
      return null;
    }
    return [
      "cards" => $cards,
      "phoenixValue" => null,
      "description" => "Dog",
    ];
  }

  /**
   * @param array<int, array<string, mixed>> $cards
   * @return array{cards: array<int, array<string, mixed>>, phoenixValue: null, description: string}|null
   */
  public static function checkBomb(array $cards): ?array
  {
    if (count($cards) < 4 || $cards[0]["type_arg"] == 1) {
      return null;
    }
    $description = null;
    if (count($cards) == 4) {
      if ($cards[0]["type_arg"] != $cards[3]["type_arg"]) {
        return null;
      }
      $description = "Bomb of four " . CardManager::cardToStr($cards[0], true);
    } else {
      $firstVal = $cards[0]["type_arg"];
      $color = $cards[0]["type"];
      foreach ($cards as $idx => $card) {
        if ($card["type"] != $color) {
          return null;
        }
        if ($card["type_arg"] != $firstVal + $idx) {
          return null;
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

  /**
   * @param array<int, array<string, mixed>> $cards
   * @return array{cards: array<int, array<string, mixed>>, phoenixValue: float|null, description: string}|null
   */
  public static function checkSingle(array $cards): ?array
  {
    if (count($cards) > 1) {
      return null;
    }
    $phoenixValue = null;
    $card = $cards[0];
    if ($card["type_arg"] == 1 && $card["type"] == TYPE_DOG) {
      return null;
    }
    if ($card["type_arg"] == 1 && $card["type"] == TYPE_PHOENIX) {
      //get Value from last combo of this trick
      $lastCombo = LogManager::getLastCombo();
      $val = 1;
      if ($lastCombo->type == SINGLE_COMBO && !$lastCombo->hasDragon()) {
        $firstVal = $lastCombo->getFirstValue();
        if (is_numeric($firstVal)) {
          $val = $firstVal + 0;
        }
      }
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

  /**
   * @param array<int, array<string, mixed>> $cards
   * @return array{cards: array<int, array<string, mixed>>, phoenixValue: int|null, description: string}|null
   */
  public static function checkPair(array $cards): ?array
  {
    if (count($cards) != 2) {
      return null;
    }
    $phoenixValue = null;
    if ($cards[0]["type_arg"] == 1) {
      if ($cards[0]["type"] != TYPE_PHOENIX) {
        return null;
      }
      $phoenixValue = (int) $cards[1]["type_arg"];
      if ($phoenixValue == 1) {
        return null;
      }
    } else {
      if ($cards[0]["type_arg"] != $cards[1]["type_arg"]) {
        return null;
      }
    }

    return [
      "cards" => $cards,
      "phoenixValue" => $phoenixValue,
      "description" => "Pair of " . CardManager::cardToStr($cards[1], true),
    ];
  }

  /**
   * @param array<int, array<string, mixed>> $cards
   * @return array{cards: array<int, array<string, mixed>>, phoenixValue: int|null, description: string}|null
   */
  public static function checkTrip(array $cards): ?array
  {
    if (count($cards) != 3) {
      return null;
    }
    $phoenixValue = null;
    if ($cards[0]["type_arg"] == 1) {
      if ($cards[0]["type"] != TYPE_PHOENIX) {
        return null;
      }
      $phoenixValue = (int) $cards[1]["type_arg"];
      if ($phoenixValue == 1 || $cards[2]["type_arg"] != $phoenixValue) {
        return null;
      }
    } else {
      if (
        $cards[0]["type_arg"] != $cards[1]["type_arg"] ||
        $cards[0]["type_arg"] != $cards[2]["type_arg"]
      ) {
        return null;
      }
    }

    return [
      "cards" => $cards,
      "phoenixValue" => $phoenixValue,
      "description" => "Triple of " . CardManager::cardToStr($cards[1], true),
    ];
  }

  /**
   * @param array<int, array<string, mixed>> $cards
   * @return array{cards: array<int, array<string, mixed>>, phoenixValue: int|null, description: string}|null
   */
  public static function checkRunningPair(array $cards): ?array
  {
    $count = count($cards);
    if ($count % 2 != 0 || $count < 4) {
      return null;
    }
    $phoenixValue = null;
    $phoenixIndex = 0;
    $phoenix = null;
    if ($cards[0]["type_arg"] == 1) {
      if ($cards[0]["type"] != TYPE_PHOENIX) {
        return null;
      }
      $phoenix = array_shift($cards);
    }
    $value = (int) $cards[0]["type_arg"];
    if ($value == 1) {
      return null;
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
          return null;
        }
      } else {
        if ($card["type_arg"] != $value) {
          //check if phoenix is available(and unused) and do the check for newPair
          if (is_null($phoenix) || !is_null($phoenixValue)) {
            return null;
          }
          $phoenixValue = $value;
          $phoenixIndex = $i;
          $value++;
          if ($card["type_arg"] != $value) {
            return null;
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

  /**
   * @param array<int, array<string, mixed>> $cards
   * @return array{cards: array<int, array<string, mixed>>, phoenixValue: int|array<int, int>|null, description: string}|null
   */
  public static function checkStraight(array $cards): ?array
  {
    $count = count($cards);
    if ($count < 5) {
      return null;
    }
    $phoenixValue = null;
    $phoenixIndex = null;
    $phoenix = null;
    if ($cards[0]["type_arg"] == 1) {
      switch ($cards[0]["type"]) {
        case TYPE_PHOENIX:
          if ($cards[1]["type_arg"] == 1 && $cards[1]["type"] != TYPE_MAHJONG) {
            return null;
          }
          $phoenix = array_shift($cards);
          break;
        case TYPE_MAHJONG:
          break;
        default:
          return null;
      }
    }
    $value = (int) $cards[0]["type_arg"];
    foreach ($cards as $i => $card) {
      if ($card["type_arg"] != $value) {
        if (is_null($phoenix) || !is_null($phoenixValue)) {
          return null;
        }
        $phoenixValue = $value;
        $phoenixIndex = $i;
        $value++;
        if ($card["type_arg"] != $value) {
          return null;
        }
      }
      $value++;
    }
    $lowest = (int) $cards[0]["type_arg"];
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
      array_splice($cards, (int) $phoenixIndex, 0, [$phoenix]); //if both are possible phoenixIndex is 0
    }

    $highest = CardManager::cardToStr(
      $phoenixIndex === $count - 1 && !is_array($phoenixValue) ? $phoenixValue : $cards[$count - 1]
    );
    //description will be recalculated if phoenix is set.
    $description = "Run of $count cards from $lowest to $highest"; //lowest is always a number
    return [
      "cards" => $cards,
      "phoenixValue" => $phoenixValue,
      "description" => $description,
    ];
  }

  /**
   * @param array<int, array<string, mixed>> $cards
   * @return array{cards: array<int, array<string, mixed>>, phoenixValue: int|array<int, int>|null, description: string}|null
   */
  public static function checkFullHouse(array $cards): ?array
  {
    if (count($cards) != 5) {
      return null;
    }
    $phoenixValue = null;
    $distinct = array_unique(array_column($cards, "type_arg")); // get distinct values
    if ($cards[0]["type_arg"] == 1) {
      // special card, check if phoenix
      if ($cards[0]["type"] != TYPE_PHOENIX || $cards[1]["type_arg"] == 1) {
        return null;
      } //special card other than phoenix
      if (count($distinct) != 3) {
        return null;
      }
      $first = (int) $cards[1]["type_arg"];
      $last = (int) $cards[4]["type_arg"];
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
        return null;
      }
      $first = (int) $cards[0]["type_arg"];
      $last = (int) $cards[4]["type_arg"];
      if ($cards[1]["type_arg"] != $first) {
        return null;
      }
      if ($cards[3]["type_arg"] != $last) {
        return null;
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
