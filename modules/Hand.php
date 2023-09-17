<?php
class Hand
{
  public $cards;
  public $phoenix;

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
      $this->getWishHighestBomb($wish, $length) ??
      call_user_func([$this, "getWishHighest$name"], $wish, $length);

    if (is_null($highestCombo)) {
      return false;
    }
    return $highestCombo->canBeat($combo);
  }

  public function canBeat($combo)
  {
    return !is_null($this->findBeatingCombo($combo));
  }

  public function findBeatingCombo($combo)
  {
    if (count($this->cards) == 0) {
      return null;
    }
    if (
      is_null($combo) ||
      $combo->type == NO_COMBO ||
      $combo->type == DOG_COMBO ||
      count($combo->cards) == 0
    ) {
      return new Combo([$this->cards[0]]);
    }

    $length = count($combo->cards);
    $name = Combo::$comboNames[$combo->type];
    $beatingCombo = call_user_func([$this, "getHighest$name"], $length);
    if (!is_null($beatingCombo) && $beatingCombo->canBeat($combo)) {
      return $beatingCombo;
    }

    $beatingBomb = $this->getHighestBomb();
    if (!is_null($beatingBomb) && $beatingBomb->canBeat($combo)) {
      return $beatingBomb;
    }

    return null;
  }

  public function hasBomb()
  {
    return $this->getHighestBomb() != null;
  }

  public function getHighestBomb()
  {
    // straight bombs
    $highest = null;
    for ($color = 1; $color <= 4; $color++) {
      $values = array_column(
        array_filter($this->cards, function ($card) use ($color) {
          return $card["type"] == $color && $card["type_arg"] != 1;
        }),
        "type_arg"
      );

      for ($idx = 0; $idx < count($values) - 4; $idx++) {
        for ($idy = $idx + 4; $idy < count($values); $idy++) {
          $length = $idy - $idx + 1;
          if ($values[$idy] == $values[$idx] + $length - 1) {
            $cards = array_map(function ($val) use ($color) {
              return ["type_arg" => $val, "type" => $color];
            }, range($values[$idx], $values[$idx] + $length - 1));
            $combo = new Combo($cards);
            if ($highest == null || $combo->canBeat($highest)) {
              $highest = $combo;
            }
          }
        }
      }
    }
    if ($highest != null) {
      return $highest;
    }

    // four bombs
    $values = array_column($this->cards, "type_arg");
    $fours = array_filter(
      $values,
      function ($val, $idx) use ($values) {
        return $val > 1 && $idx > 2 && $values[$idx - 3] == $val;
      },
      ARRAY_FILTER_USE_BOTH
    );
    if (count($fours) > 0) {
      $val = max($fours);
      $cards = [
        ["type_arg" => $val, "type" => 1],
        ["type_arg" => $val, "type" => 2],
        ["type_arg" => $val, "type" => 3],
        ["type_arg" => $val, "type" => 4],
      ];
      return new Combo($cards);
    }

    return null;
  }

  /**
   * Returns the rank of the highest card that is not part of a pair, triple or 4-bomb.
   * Returns 0, if the hand has no cards or only special cards, or no singles.
   */
  public function getTopSingleRank()
  {
    foreach (range(14, 2) as $n) {
      $filtered = array_values(
        array_filter($this->cards, function ($card) use ($n) {
          return $card["type_arg"] == $n;
        })
      );
      if (count($filtered) == 1) {
        return $filtered[0]["type_arg"];
      }
    }
    return 0;
  }

  /**
   * Returns the rank of the highest card, not counting special cards.
   * Returns 0, if the hand has no cards or only special cards, or no singles.
   */
  public function getTopRank()
  {
    foreach (range(14, 2) as $n) {
      $filtered = array_values(
        array_filter($this->cards, function ($card) use ($n) {
          return $card["type_arg"] == $n;
        })
      );
      if (count($filtered) > 0) {
        return $filtered[0]["type_arg"];
      }
    }
    return 0;
  }

  /* getWishHighest... functions. Used to check if a wish can be fulfilled
   * arguments:
   * $wish: the wish that was made
   * $length: the length of the last combo (only relevant for straights)
   *
   * return: the highest combo of the respective type and given length that contains the wish
   *				 	or null if there is none. Sometimes the cards aren't the real ones,
   *					because it's easier and we only need them to check if the combo can beat the last one
   */

  public function getWishHighestSingle($wish)
  {
    $card = array_reduce($this->cards, function ($carry, $item) use ($wish) {
      return $carry ?? ($item["type_arg"] == $wish ? $item : null);
    });
    return new Combo([$card]);
  }

  public function getHighestSingle()
  {
    $highest = null;
    foreach ($this->cards as $card) {
      $combo = new Combo([$card]);
      if ($combo->type != SINGLE_COMBO) {
        continue;
      }
      if ($highest == null || $combo->canBeat($highest)) {
        $highest = $combo;
      }
    }
    return $highest;
  }

  public function getWishHighestPair($wish)
  {
    // get all cards with the wished type_arg
    $filtered = array_values(
      array_filter($this->cards, function ($card) use ($wish) {
        return $card["type_arg"] == $wish;
      })
    );
    if ($this->phoenix) {
      return new Combo([$this->phoenix, $filtered[0]]);
    }
    if (count($filtered) > 1) {
      return new Combo([$filtered[0], $filtered[1]]);
    }
  }

  public function getHighestPair()
  {
    $highest = null;
    foreach ($this->cards as $i => $card) {
      if ($this->phoenix) {
        $combo = new Combo([$this->phoenix, $card]);
        if ($combo->type == PAIR_COMBO) {
          if ($highest == null || $combo->canBeat($highest)) {
            $highest = $combo;
          }
        }
      }
      if (count($this->cards) > $i + 1) {
        $combo = new Combo([$card, $this->cards[$i + 1]]);
        if ($combo->type == PAIR_COMBO) {
          if ($highest == null || $combo->canBeat($highest)) {
            $highest = $combo;
          }
        }
      }
    }
    return $highest;
  }

  public function getWishHighestTrip($wish)
  {
    $filtered = array_values(
      array_filter($this->cards, function ($card) use ($wish) {
        return $card["type_arg"] == $wish;
      })
    );
    $count = count($filtered);
    if ($this->phoenix && $count > 1) {
      return new Combo([$this->phoenix, $filtered[0], $filtered[1]]);
    }
    if ($count > 2) {
      return new Combo(array_slice($filtered, 0, 3));
    }
  }

  public function getHighestTrip()
  {
    $highest = null;
    foreach ($this->cards as $i => $card) {
      if ($this->phoenix && count($this->cards) > $i + 1) {
        $combo = new Combo([$this->phoenix, $card, $this->cards[$i + 1]]);
        if ($combo->type == TRIP_COMBO) {
          if ($highest == null || $combo->canBeat($highest)) {
            $highest = $combo;
          }
        }
      }
      if (count($this->cards) > $i + 2) {
        $combo = new Combo([$card, $this->cards[$i + 1], $this->cards[$i + 2]]);
        if ($combo->type == TRIP_COMBO) {
          if ($highest == null || $combo->canBeat($highest)) {
            $highest = $combo;
          }
        }
      }
    }
    return $highest;
  }

  public function getWishHighestRunningPair($wish, $length)
  {
    $values = array_column($this->cards, "type_arg"); // array of values only
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
      if ($wish != 0 && $value > $wish) {
        break;
      } // no need to search for running straights that start higher than wish
      if ($idx + $off >= $count) {
        break;
      } // not enough values left
      if ($wish != 0 && $value + $off < $wish) {
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
        if (!is_null($this->phoenix) && is_null($phoenixValue)) {
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
          return ["type_arg" => $val, "type" => 1 + ($val % 4)];
        }, $values);
        return new Combo($cards);
      }
    }
  }

  public function getHighestRunningPair($length)
  {
    return $this->getWishHighestRunningPair(0, $length);
  }

  public function getWishHighestStraight($wish, $length)
  {
    $count = count($this->cards);
    if ($count < 5) {
      return;
    }
    $values = array_column($this->cards, "type_arg"); // array of values only
    $distinct = array_values(array_unique($values, SORT_NUMERIC)); // array of all distinct values
    $straight = null;
    $off = $length - 1;
    $count = count($distinct);
    if (is_null($this->phoenix)) {
      foreach ($distinct as $idx => $value) {
        //basically the same as for running pairs
        if ($value == 1) {
          continue;
        }
        if ($wish != 0 && $value > $wish) {
          break;
        }
        if ($idx + $off >= $count) {
          break;
        }
        if ($wish != 0 && $value + $off < $wish) {
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
        if ($wish != 0 && $value > $wish) {
          break;
        }
        if ($idx + $off - 1 >= $count) {
          break;
        }
        if ($wish != 0 && $value + $off < $wish) {
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
      return ["type_arg" => $val, "type" => 1 + ($val % 4)];
    }, range($straight, $straight + $off));
    return new Combo($cards);
  }

  public function getHighestStraight($length)
  {
    return $this->getWishHighestStraight(0, $length);
  }

  public function getWishHighestFullHouse($wish)
  {
    // We need at least 5 cards.
    if (count($this->cards) < 5) {
      return;
    }
    // just the values and no special cards
    $values = array_values(
      array_filter(array_column($this->cards, "type_arg"), function ($val) {
        return $val > 1;
      })
    );
    $distinct = array_values(array_unique($values, SORT_NUMERIC));
    // We need at least 2 distinct values.
    if (count($distinct) < 2) {
      return;
    }
    $doubles = Utils::getDoubles($values);
    // We need at least 2 doubles or a triple.
    if (count($doubles) < 2) {
      return;
    }
    $distinctDoubles = array_values(array_unique($doubles, SORT_NUMERIC));
    // Utils::getDoubles basically removes the first occurence of each value, so if we apply it again on the result we get the triples
    $triples = Utils::getDoubles($doubles);
    $tCount = count($triples);
    $fullHouse = null;
    if ($this->phoenix) {
      if ($tCount > 0) {
        // Find full houses with phoenix in double.
        $tVal = $triples[$tCount - 1];
        // We already know that we have at least one card fulfilling the wish.
        $dVal = $wish == 0 ? $tVal : $wish;
        // We have a triple without the phoenix and at least 5 cards. So we can complete the full house wish with any other value.
        if ($dVal == $tVal) {
          $dVal = array_reduce($distinct, function ($c, $v) use ($tVal) {
            return $v == $tVal ? $c : $v;
          });
        }
        $fullHouse = [$tVal, $dVal];
      }
      // Find full houses with phoenix in triple. If that exists, then it will be higher or equal to an already found full house.
      $count = count($distinctDoubles);
      if ($count > 1 && ($wish == 0 || in_array($wish, $distinctDoubles))) {
        $greatPair = $distinctDoubles[$count - 1]; // biggest pair is of course the last one
        // if the biggest pair is not the wish, the smaller one  has to be
        $smallPair = $greatPair == $wish || $wish == 0 ? $distinctDoubles[$count - 2] : $wish;
        $fullHouse = [$greatPair, $smallPair];
      }
    } else {
      // no phoenix
      if (
        ($wish != 0 && !in_array($wish, $distinctDoubles)) || // wish is not in double or triple
        $tCount == 0 || // no triple
        count($distinctDoubles) < 2 // no double except the triple
      ) {
        return;
      }
      $tVal = $triples[$tCount - 1]; // highest triple
      // If there is a wish, then we already know that a double exists fulfilling it.
      $dVal = $wish == 0 ? $tVal : $wish;
      // Triple is already the wish (or there is no wish), so find any other pair.
      if ($dVal == $tVal) {
        $dVal = array_reduce($distinctDoubles, function ($c, $v) use ($tVal) {
          return $v == $tVal ? $c : $v;
        });
      }
      $fullHouse = [$tVal, $dVal];
    }
    if (is_null($fullHouse)) {
      return;
    }
    // since we only need the combo to check if it can beat the other, we can create dummy cards
    $cards = [];
    for ($i = 0; $i < 3; $i++) {
      $cards[] = ["type_arg" => $fullHouse[0], "type" => 1];
    }
    for ($i = 0; $i < 2; $i++) {
      $cards[] = ["type_arg" => $fullHouse[1], "type" => 2];
    }
    return new Combo($cards);
  }

  public function getHighestFullHouse()
  {
    return $this->getWishHighestFullHouse(0);
  }

  public function getWishHighestBomb($wish)
  {
    // get all cards with the wished value
    $filtered = array_values(
      array_filter($this->cards, function ($card) use ($wish) {
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
        array_filter($this->cards, function ($card) use ($color) {
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
          return ["type_arg" => $v, "type" => 1];
        }, range($val, $val + $length - 1))
      );
    }
    if (count($filtered) == 4) {
      return new Combo($filtered);
    }
  }
}
?>
