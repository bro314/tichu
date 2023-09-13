<?php
class Hand
{
  public $cards;
  public $phoenix;
  private $containsBomb;

  public function __construct($cards)
  {
    $this->cards = $cards;
    $values = array_column($cards, "type_arg");
    $colors = array_column($cards, "type");
    array_multisort($values, SORT_ASC, $colors, SORT_ASC, $this->cards);
    if (count($this->cards) == 0) {
      return;
    }
    if ($this->cards[0]["type_arg"] == 1 && $this->cards[0]["type"] == TYPE_PHOENIX) {
      $this->phoenix = $this->cards[0];
    } elseif (
      count($this->cards) > 1 &&
      $this->cards[1]["type_arg"] == 1 &&
      $this->cards[1]["type"] == TYPE_PHOENIX
    ) {
      $this->phoenix = $this->cards[1];
    }
  }

  public function canFulFillWish($wish, $combo)
  {
    if ($combo->type == NO_COMBO || $combo->type == DOG_COMBO) {
      return in_array($wish, array_column($this->cards, "type_arg"));
    }
    if (!in_array($wish, array_column($this->cards, "type_arg"))) {
      return false;
    }
    if (is_null($combo)) {
      return true;
    }
    $length = count($combo->cards);
    $name = Combo::$comboNames[$combo->type];
    $highestCombo =
      self::getHighestBomb($this->cards, $wish, $length) ??
      call_user_func("self::getHighest$name", $this->cards, $wish, $length, $this->phoenix);

    if (is_null($highestCombo)) {
      return false;
    }
    return $highestCombo->canBeat($combo);
  }

  public function hasBomb()
  {
    if (!is_null($this->containsBomb)) {
      return $this->containsBomb;
    }
    $values = array_column($this->cards, "type_arg");
    $fours = array_filter(
      $values,
      function ($val, $idx) use ($values) {
        return $val > 1 && $idx > 2 && $values[$idx - 3] == $val;
      },
      ARRAY_FILTER_USE_BOTH
    );
    if (count($fours) > 0) {
      $this->containsBomb = true;
      return true;
    }
    for ($color = 1; $color <= 4; $color++) {
      $values = array_column(
        array_filter($this->cards, function ($card) use ($color) {
          return $card["type"] == $color && $card["type_arg"] != 1;
        }),
        "type_arg"
      );

      for ($idx = 0; $idx < count($values) - 4; $idx++) {
        $value = $values[$idx];
        if ($values[$idx + 4] == $value + 4) {
          $this->containsBomb = true;
          return true;
        }
      }
    }
    $this->containsBomb = false;
    return false;
  }

  /* getHighest... functions. Used to check if a wish can be fulfilled
   * arguments:
   * $cards: the cards of the hand. as usual filtered by type_arg(and type)
   * $wish: the wish that was made
   * $length: the length of the last combo
   * $phoenix: the phoenix card of the hand(or null)
   *
   * return: the highest combo of the respective type and given length that contains the wish
   *				 	or null if there is none. Sometimes the cards aren't the real ones,
   *					because it's easier and we only need them to check if the combo can beat the last one
   */

  public static function getHighestSingle($cards, $wish, $length, $phoenix)
  {
    $card = array_reduce($cards, function ($carry, $item) use ($wish) {
      return $carry ?? ($item["type_arg"] == $wish ? $item : null);
    });
    return new Combo([$card], SINGLE_COMBO);
  }

  public static function getHighestPair($cards, $wish, $length, $phoenix)
  {
    // get all cards with the wished type_arg
    $filtered = array_values(
      array_filter($cards, function ($card) use ($wish) {
        return $card["type_arg"] == $wish;
      })
    );
    if ($phoenix) {
      return new Combo([$phoenix, $filtered[0]], PAIR_COMBO, ($phoenixValue = $wish));
    }
    if (count($filtered) > 1) {
      return new Combo([$filtered[0], $filtered[1]], PAIR_COMBO);
    }
  }

  public static function getHighestTrip($cards, $wish, $length, $phoenix)
  {
    $filtered = array_values(
      array_filter($cards, function ($card) use ($wish) {
        return $card["type_arg"] == $wish;
      })
    );
    $count = count($filtered);
    if ($phoenix && $count > 1) {
      return new Combo([$phoenix, $filtered[0], $filtered[1]], TRIP_COMBO, ($phoenixValue = $wish));
    }
    if ($count > 2) {
      return new Combo(array_slice($filtered, 0, 3), TRIP_COMBO);
    }
  }

  public static function getHighestRunningPair($cards, $wish, $length, $phoenix)
  {
    $values = array_column($cards, "type_arg"); // array of values only
    $distinct = array_values(array_unique($values, SORT_NUMERIC)); // array of all distinct values
    $doubles = Utils::getDoubles($values); // an array of values that have a duplicate
    $straights = [];
    $off = $length / 2 - 1;
    $count = count($distinct);
    // first check if we can build a "straight" of half $length with the distinct values
    foreach ($distinct as $idx => $value) {
      if ($value == 1) {
        continue;
      }
      if ($value > $wish) {
        break;
      } // no need to search for running straights that start higher than wish
      if ($idx + $off >= $count) {
        break;
      } // not enough values left
      if ($value + $off < $wish) {
        continue;
      } // running pair of given length starting here would not contain wish
      // since the distinct values are ordered, if the value at the right position has the right value, so will the values between
      if ($distinct[$idx + $off] == $value + $off) {
        $straights[] = $value;
      }
    }
    $straights = array_reverse($straights); // reorder, so the highest one will be first
    // now, check each "straight", if we can make a running pair out of it
    foreach ($straights as $value) {
      $phoenixValue = null;
      $fail = false;
      for ($i = 0; $i <= $off; $i++) {
        $val = $value + $i; //$ith of the straight
        if (in_array($val, $doubles)) {
          continue;
        }
        // only one of this value available, check if phoenix is there and unused
        if (!is_null($phoenix) && is_null($phoenixValue)) {
          $phoenixValue = $val;
        } else {
          $fail = true;
          break;
        }
      }
      if (!$fail) {
        // it's easier to create dummy cards than filter out the right cards
        $values = range($value, $value + $off); //values of the pair
        array_splice($values, 0, 0, range($value, $value + $off)); //add them to itself
        sort($values, SORT_NUMERIC);
        $cards = array_map(function ($val) {
          return ["type_arg" => $val, "type" => 0];
        }, $values);
        return new Combo($cards, RUNNING_PAIRS_COMBO);
      }
    }
  }

  public static function getHighestStraight($cards, $wish, $length, $phoenix)
  {
    $count = count($cards);
    if ($count < 5) {
      return;
    }
    $values = array_column($cards, "type_arg"); // array of values only
    $distinct = array_values(array_unique($values, SORT_NUMERIC)); // array of all distinct values
    $straight = null;
    $off = $length - 1;
    $count = count($distinct);
    if (is_null($phoenix)) {
      foreach ($distinct as $idx => $value) {
        //basically the same as for running pairs
        if ($value == 1) {
          continue;
        }
        if ($value > $wish) {
          break;
        }
        if ($idx + $off >= $count) {
          break;
        }
        if ($value + $off < $wish) {
          continue;
        }
        if ($distinct[$idx + $off] == $value + $off) {
          $straight = $value;
        }
      }
    } else {
      foreach ($distinct as $idx => $value) {
        if ($value == 1) {
          continue;
        }
        if ($value > $wish) {
          break;
        }
        if ($idx + $off - 1 >= $count) {
          break;
        }
        if ($value + $off < $wish) {
          continue;
        }
        if ($distinct[$idx + $off - 1] <= $value + $off) {
          $straight = $value;
        }
      }
      if ($straight + $off == 15) {
        $straight--;
      } //happens if the best straight starts with phoenix and ends with ace
    }
    if (is_null($straight)) {
      return;
    }
    // since we only need the combo to check if it can beat the other, we can create dummy cards
    $cards = array_map(function ($val) {
      return ["type_arg" => $val, "type" => 0];
    }, range($straight, $straight + $off));
    return new Combo($cards, STRAIGHT_COMBO);
  }

  public static function getHighestFullHouse($cards, $wish, $length, $phoenix)
  {
    $values = array_column($cards, "type_arg"); // array of values only
    $distinct = array_values(array_unique($values, SORT_NUMERIC)); // array of all distinct values
    $doubles = Utils::getDoubles($values);
    if (count($doubles) < 2) {
      return;
    } //if no or only 1 value is equal to his successor, there is no full hose
    $distinctDoubles = array_values(array_unique($doubles, SORT_NUMERIC));
    // Utils::getDoubles basically removes the first occurence of each value, so if we apply it again on the result we get the triples
    $triples = Utils::getDoubles($doubles);
    $tCount = count($triples);
    $fullHouse = null;
    if ($phoenix) {
      if ($tCount > 0) {
        // get full houses with phoenix in double
        $tVal = $triples[$tCount - 1];
        $dVal = $wish;
        if ($dVal == $tVal) {
          $dVal = array_reduce($distinct, function ($c, $v) use ($wish) {
            return $v == $wish ? $c : $v;
          });
        }
        $fullHouse = [$tVal, $dVal];
      }

      // get full houses with phoenix in triple
      $count = count($distinctDoubles);
      if ($count > 1 && in_array($wish, $distinctDoubles)) {
        $greatPair = $distinctDoubles[$count - 1]; // biggest pair is of course the last one
        // if the biggest pair is not the wish, the smaller one  has to be
        $smallPair = $greatPair == $wish ? $distinctDoubles[$count - 2] : $wish;
        $fullHouse = [$greatPair, $smallPair];
      }
    } else {
      //no phoenix
      if (
        !in_array($wish, $distinctDoubles) || // the hand contains the wish only once
        $tCount == 0 || // no triple
        count($distinctDoubles) < 2
      ) {
        // no double except the triple
        return;
      }
      $tVal = $triples[$tCount - 1]; //highest triple
      $dVal = $wish;
      if ($dVal == $tVal) {
        //triple is already the wish, get highest other pair
        $dVal = array_reduce($distinctDoubles, function ($c, $v) use ($wish) {
          return $v == $wish ? $c : $v;
        });
      }
      if (!is_null($dVal)) {
        $fullHouse = [$tVal, $dVal];
      }
    }
    if (is_null($fullHouse)) {
      return;
    }
    // since we only need the combo to check if it can beat the other, we can create dummy cards
    $cards = [];
    for ($i = 0; $i < 3; $i++) {
      $cards[] = ["type_arg" => $fullHouse[0], "type" => 0];
    }
    for ($i = 0; $i < 2; $i++) {
      $cards[] = ["type_arg" => $fullHouse[1], "type" => 0];
    }
    return new Combo($cards, FULL_HOUSE_COMBO);
  }

  public static function getHighestBomb($cards, $wish, $l)
  {
    // get all cards with the wished value
    $filtered = array_values(
      array_filter($cards, function ($card) use ($wish) {
        return $card["type_arg"] == $wish;
      })
    );
    $val = null;
    $length = 0;
    // first check for straight flush containing one of the filtered cards
    foreach ($filtered as $card) {
      $color = $card["type"];
      // get the values of all cards of that color (except special cards ofc)
      $values = array_column(
        array_filter($cards, function ($card) use ($color) {
          return $card["type"] == $color && $card["type_arg"] != 1;
        }),
        "type_arg"
      );
      $last = count($values) - 1;
      if ($last < 4) {
        continue;
      }

      for ($idx = 0; $idx < count($values) - 4; $idx++) {
        $value = $values[$idx];
        if ($value > $wish) {
          break;
        } // no need to search for running straights that start higher than wish
        if ($values[$idx + 4] != $value + 4) {
          continue;
        } // no straight
        // straight of length 5 found! check how long it can be
        $i = $idx + 5;
        while ($i <= $last && $values[$i] == $value + $i - $idx) {
          $i++;
        }
        // check if it contains the wish and is better than any other found previously
        if ($wish < $value + $i && ($i > $length || ($i == $length && $value > $val))) {
          $length = $i - $idx;
          $val = $value;
        }
        $idx = $i - 1; //we can skip the values of this straight now
      }
    }
    // since we only need the combo to check if it can beat the other, we can create dummy cards
    if ($length > 4) {
      return new Combo(
        array_map(function ($v) {
          return ["type_arg" => $v, "type" => 0];
        }, range($val, $val + $length - 1)),
        BOMB_COMBO
      );
    }
    if (count($filtered) == 4) {
      return new Combo($filtered, BOMB_COMBO);
    }
  }
}
?>
