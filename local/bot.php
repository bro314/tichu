<?php
/**
 * Smart, rule-compliant bot helper for the Local Tichu Runner.
 * Enables effortless solo testing by acting for non-human seats or stepping bot turns.
 */

class LocalTichuBot
{
  /**
   * Advances the game state when other players (everyone except $humanPlayerId) need to act.
   * - In a multipleactiveplayer state (grandTichuBets, giveCards, showPassedCards), acts ONCE for
   *   each non-human active player in that state and then stops (even if the state transitions).
   * - In an activeplayer state where $humanPlayerId is not active, steps bot turns until
   *   $humanPlayerId becomes active, the state type changes, or $maxSteps is reached.
   */
  public static function actForOtherPlayers(
    \Tichu $game,
    int $humanPlayerId,
    int $maxSteps = 40
  ): array {
    $actions = [];
    $steps = 0;

    $initialState = $game->gamestate->state();
    $initialStateType = $initialState['type'] ?? '';
    $initialStateId = (int) ($initialState['id'] ?? 0);

    if ($initialStateId === 99 || ($initialState['name'] ?? '') === 'gameEnd') {
      return $actions;
    }

    // If starting in a multipleactiveplayer state, complete only THIS multiactive phase for the other players
    if ($initialStateType === 'multipleactiveplayer') {
      $multiactive = $game->gamestate->getActivePlayerList();
      foreach ($multiactive as $pIdStr) {
        $botId = (int) $pIdStr;
        if ($botId <= 0 || $botId === $humanPlayerId) {
          continue;
        }
        $curState = $game->gamestate->state();
        if (
          (int) ($curState['id'] ?? 0) !== $initialStateId ||
          !$game->gamestate->isPlayerActive($botId)
        ) {
          break;
        }
        $res = self::stepSingleBotTurn($game, $botId);
        if (!empty($res['acted'])) {
          $actions[] = $res;
          $steps++;
          if ($steps >= $maxSteps) {
            break;
          }
        }
      }
      return $actions;
    }

    // Otherwise, in an activeplayer state, step bot turns until $humanPlayerId is active (or state type changes)
    while ($steps < $maxSteps) {
      $state = $game->gamestate->state();
      $stateName = $state['name'] ?? '';
      $stateType = $state['type'] ?? '';
      $stateId = (int) ($state['id'] ?? 0);

      if ($stateId === 99 || $stateName === 'gameEnd' || $stateType !== 'activeplayer') {
        break;
      }

      $activePlayerId = (int) $game->getActivePlayerId();
      if ($activePlayerId <= 0 || $activePlayerId === $humanPlayerId) {
        break;
      }

      $res = self::stepSingleBotTurn($game, $activePlayerId);
      if (!empty($res['acted'])) {
        $actions[] = $res;
        $steps++;
      } else {
        break;
      }
    }

    return $actions;
  }

  /**
   * Steps bot actions across both multipleactiveplayer and activeplayer states
   * until $humanPlayerId is active (or needs to act in a multiactive state).
   */
  public static function autoPlayUntilPlayer(
    \Tichu $game,
    int $humanPlayerId,
    int $maxSteps = 40
  ): array {
    $actions = [];
    $steps = 0;

    while ($steps < $maxSteps) {
      $state = $game->gamestate->state();
      $stateName = $state['name'] ?? '';
      $stateType = $state['type'] ?? '';
      $stateId = (int) ($state['id'] ?? 0);

      if ($stateId === 99 || $stateName === 'gameEnd') {
        break;
      }

      if ($stateType === 'multipleactiveplayer') {
        $multiactive = $game->gamestate->getActivePlayerList();
        $otherActive = [];
        foreach ($multiactive as $pIdStr) {
          $pId = (int) $pIdStr;
          if ($pId > 0 && $pId !== $humanPlayerId) {
            $otherActive[] = $pId;
          }
        }
        if (empty($otherActive)) {
          break;
        }
        $actedInBatch = false;
        foreach ($otherActive as $botId) {
          $curState = $game->gamestate->state();
          if (
            (int) ($curState['id'] ?? 0) !== $stateId ||
            !$game->gamestate->isPlayerActive($botId)
          ) {
            break;
          }
          $res = self::stepSingleBotTurn($game, $botId);
          if (!empty($res['acted'])) {
            $actions[] = $res;
            $steps++;
            $actedInBatch = true;
            if ($steps >= $maxSteps) {
              break 2;
            }
          }
        }
        if (!$actedInBatch || $game->gamestate->isPlayerActive($humanPlayerId)) {
          break;
        }
        continue;
      }

      if ($stateType === 'activeplayer') {
        $activePlayerId = (int) $game->getActivePlayerId();
        if ($activePlayerId <= 0 || $activePlayerId === $humanPlayerId) {
          break;
        }
        $res = self::stepSingleBotTurn($game, $activePlayerId);
        if (!empty($res['acted'])) {
          $actions[] = $res;
          $steps++;
        } else {
          break;
        }
        continue;
      }

      break;
    }

    return $actions;
  }

  /**
   * Executes one legal move for $botPlayerId (or the currently active / first multiactive player).
   */
  public static function stepSingleBotTurn(\Tichu $game, ?int $botPlayerId = null): array
  {
    $state = $game->gamestate->state();
    $stateName = $state['name'] ?? '';
    $stateType = $state['type'] ?? '';
    $stateId = (int) ($state['id'] ?? 0);

    if ($stateId === 99 || $stateName === 'gameEnd') {
      return [
        'acted' => false,
        'state' => $stateName,
        'reason' => 'Game has ended',
      ];
    }

    if ($botPlayerId === null || $botPlayerId <= 0) {
      if ($stateType === 'multipleactiveplayer') {
        $activeList = $game->gamestate->getActivePlayerList();
        if (empty($activeList)) {
          return [
            'acted' => false,
            'state' => $stateName,
            'reason' => 'No multiactive players remaining',
          ];
        }
        $viewerId = $game->getCurrentPlayerId();
        $chosen = (int) $activeList[0];
        foreach ($activeList as $candidateId) {
          if ((int) $candidateId !== $viewerId) {
            $chosen = (int) $candidateId;
            break;
          }
        }
        $botPlayerId = $chosen;
      } elseif ($stateType === 'activeplayer') {
        $botPlayerId = (int) $game->getActivePlayerId();
      } else {
        return [
          'acted' => false,
          'state' => $stateName,
          'reason' => "State '$stateName' does not accept player actions",
        ];
      }
    }

    if ($botPlayerId <= 0 || !$game->gamestate->isPlayerActive($botPlayerId)) {
      return [
        'acted' => false,
        'player_id' => $botPlayerId,
        'state' => $stateName,
        'reason' => "Player $botPlayerId is not active in state '$stateName'",
      ];
    }

    $previousPlayerId = $game->getCurrentPlayerId();
    $game->setCurrentPlayerId($botPlayerId);
    $game->beginPlayerAction();

    try {
      switch ($stateName) {
        case 'grandTichuBets':
          $game->grandTichuBet(0);
          return [
            'acted' => true,
            'player_id' => $botPlayerId,
            'state' => $stateName,
            'action' => 'grandTichuBet',
            'args' => ['bet' => 0],
          ];

        case 'giveCards':
          $cardIds = self::pickThreeCardsToGive($botPlayerId);
          $game->giveTheCards($cardIds);
          return [
            'acted' => true,
            'player_id' => $botPlayerId,
            'state' => $stateName,
            'action' => 'giveTheCards',
            'args' => ['cards' => $cardIds],
          ];

        case 'showPassedCards':
          $game->acceptCards();
          return [
            'acted' => true,
            'player_id' => $botPlayerId,
            'state' => $stateName,
            'action' => 'acceptCards',
            'args' => [],
          ];

        case 'mahjongPlay':
          $wish = 15; // 15 = no wish
          $game->makeAWish($wish);
          return [
            'acted' => true,
            'player_id' => $botPlayerId,
            'state' => $stateName,
            'action' => 'makeAWish',
            'args' => ['wish' => $wish],
          ];

        case 'phoenixPlay':
          $pendingCombo = \LogManager::getLastCombo(0, 'phoenix');
          $vals = is_array($pendingCombo->phoenixValue)
            ? array_values($pendingCombo->phoenixValue)
            : [(int) ($pendingCombo->phoenixValue ?? 2)];
          $chosenVal = (int) ($vals[0] ?? 2);
          $game->choosePhoenix($chosenVal);
          return [
            'acted' => true,
            'player_id' => $botPlayerId,
            'state' => $stateName,
            'action' => 'choosePhoenix',
            'args' => ['phoenixValue' => $chosenVal],
          ];

        case 'chooseDragonGift':
          $game->chooseDragonGift(0);
          return [
            'acted' => true,
            'player_id' => $botPlayerId,
            'state' => $stateName,
            'action' => 'chooseDragonGift',
            'args' => ['player' => 0],
          ];

        case 'confirmTrick':
          $game->collect();
          return [
            'acted' => true,
            'player_id' => $botPlayerId,
            'state' => $stateName,
            'action' => 'collect',
            'args' => [],
          ];

        case 'playBomb':
          $game->cancel();
          return [
            'acted' => true,
            'player_id' => $botPlayerId,
            'state' => $stateName,
            'action' => 'cancel',
            'args' => [],
          ];

        case 'playComboOpen':
          $cardIds = self::pickOpeningComboCards($game, $botPlayerId);
          $game->playCombo($cardIds);
          return [
            'acted' => true,
            'player_id' => $botPlayerId,
            'state' => $stateName,
            'action' => 'playCombo',
            'args' => ['cards' => $cardIds],
          ];

        case 'playCombo':
          return self::actInPlayCombo($game, $botPlayerId);

        default:
          return [
            'acted' => false,
            'player_id' => $botPlayerId,
            'state' => $stateName,
            'reason' => "Unhandled state '$stateName'",
          ];
      }
    } finally {
      $game->endPlayerAction();
      $game->setCurrentPlayerId($previousPlayerId);
    }
  }

  /**
   * Selects 3 valid cards from $botPlayerId's hand to pass in ST_GIVE_CARDS.
   * Prefers lowest non-special single cards so passing feels natural.
   */
  public static function pickThreeCardsToGive(int $botPlayerId): array
  {
    $deck = \CardManager::getDeck();
    $handCards = array_values($deck->getCardsInLocation('hand', $botPlayerId));
    if (count($handCards) < 3) {
      return array_map(static fn($c) => (string) $c['id'], $handCards);
    }

    // Count frequency of each rank to prefer passing true singles over pairs/trips/bombs
    $rankCounts = [];
    foreach ($handCards as $c) {
      $rank = (int) $c['type_arg'];
      $rankCounts[$rank] = ($rankCounts[$rank] ?? 0) + 1;
    }

    usort($handCards, static function (array $a, array $b) use ($rankCounts): int {
      $aRank = (int) $a['type_arg'];
      $bRank = (int) $b['type_arg'];
      $aSpecial = $aRank === 1 ? 1 : 0;
      $bSpecial = $bRank === 1 ? 1 : 0;

      // Non-special cards first
      if ($aSpecial !== $bSpecial) {
        return $aSpecial <=> $bSpecial;
      }

      // Among non-special cards, prefer lower frequency (singles before pairs/trips/bombs)
      if ($aSpecial === 0) {
        $aFreq = $rankCounts[$aRank] ?? 1;
        $bFreq = $rankCounts[$bRank] ?? 1;
        if ($aFreq !== $bFreq) {
          return $aFreq <=> $bFreq;
        }
        if ($aRank !== $bRank) {
          return $aRank <=> $bRank;
        }
      }

      return ((int) $a['id']) <=> ((int) $b['id']);
    });

    $chosen = array_slice($handCards, 0, 3);
    return array_map(static fn($c) => (string) $c['id'], $chosen);
  }

  /**
   * Picks a valid opening combo in ST_PLAY_COMBO_OPEN.
   */
  public static function pickOpeningComboCards(\Tichu $game, int $botPlayerId): array
  {
    $deck = \CardManager::getDeck();
    $handCards = array_values($deck->getCardsInLocation('hand', $botPlayerId));
    if (empty($handCards)) {
      return [];
    }

    $hand = new \Hand($handCards);
    $wish = (int) $game->getGameStateValue('mahjongWish');

    // 1. If Mahjong wish is active and bot has the wished rank, MUST fulfill it (cannot play Dog or another rank)
    if ($wish > 0 && $hand->canFulFillWish($wish, \Combo::$noCombo)) {
      foreach ($handCards as $card) {
        if ((int) $card['type_arg'] === $wish) {
          return [(string) $card['id']];
        }
      }
    }

    // 2. If bot holds the Dog, leading the Dog is valid and passes lead to partner
    foreach ($handCards as $card) {
      if ((int) $card['type_arg'] === 1 && (int) $card['type'] === TYPE_DOG) {
        return [(string) $card['id']];
      }
    }

    // 3. If bot holds the Mahjong, lead the Mahjong single
    foreach ($handCards as $card) {
      if ((int) $card['type_arg'] === 1 && (int) $card['type'] === TYPE_MAHJONG) {
        return [(string) $card['id']];
      }
    }

    // 4. Lead lowest non-special card (rank 2..14)
    $normalCards = array_filter($handCards, static fn($c) => (int) $c['type_arg'] >= 2);
    if (!empty($normalCards)) {
      usort(
        $normalCards,
        static fn($a, $b) => ((int) $a['type_arg']) <=> ((int) $b['type_arg'])
      );
      return [(string) $normalCards[0]['id']];
    }

    // 5. Fallback: only special cards left (Phoenix or Dragon)
    return [(string) $handCards[0]['id']];
  }

  /**
   * Executes a legal move in ST_PLAY_COMBO (either playing a beating combo or passing).
   */
  private static function actInPlayCombo(\Tichu $game, int $botPlayerId): array
  {
    $deck = \CardManager::getDeck();
    $handCards = array_values($deck->getCardsInLocation('hand', $botPlayerId));
    $hand = new \Hand($handCards);
    $wish = (int) $game->getGameStateValue('mahjongWish');
    $lastCombo = \LogManager::getLastCombo();

    // Check if the bot is required to fulfill the Mahjong wish
    if ($wish > 0 && $hand->canFulFillWish($wish, $lastCombo)) {
      $wishCardIds = self::findPlayableComboIds($handCards, $lastCombo, $wish);
      if (!empty($wishCardIds)) {
        try {
          $game->playCombo($wishCardIds);
          return [
            'acted' => true,
            'player_id' => $botPlayerId,
            'state' => 'playCombo',
            'action' => 'playCombo',
            'args' => ['cards' => $wishCardIds, 'wishFulfilled' => $wish],
          ];
        } catch (\Throwable $e) {
          // If playing failed for any unexpected reason, fall through
        }
      }
    }

    // Optional: try playing a simple beating single or pair ~40% of the time so solo play is lively
    $shouldTryBeat =
      in_array((int) $lastCombo->type, [SINGLE_COMBO, PAIR_COMBO], true) &&
      (int) $lastCombo->player !== $botPlayerId &&
      bga_rand(1, 100) <= 45;

    if ($shouldTryBeat) {
      $beatingIds = self::findPlayableComboIds($handCards, $lastCombo, 0, false);
      if (!empty($beatingIds)) {
        try {
          $game->playCombo($beatingIds);
          return [
            'acted' => true,
            'player_id' => $botPlayerId,
            'state' => 'playCombo',
            'action' => 'playCombo',
            'args' => ['cards' => $beatingIds],
          ];
        } catch (\Throwable $e) {
          // Fall back to pass below
        }
      }
    }

    // Default: pass once
    try {
      $game->pass(true);
      return [
        'acted' => true,
        'player_id' => $botPlayerId,
        'state' => 'playCombo',
        'action' => 'pass',
        'args' => ['onlyOnce' => true],
      ];
    } catch (\Throwable $passEx) {
      // If passing threw an exception (e.g. must fulfill wish), find any valid beating combo
      $fallbackIds =
        self::findPlayableComboIds($handCards, $lastCombo, $wish, true) ??
        self::findPlayableComboIds($handCards, $lastCombo, 0, true);
      if (!empty($fallbackIds)) {
        $game->playCombo($fallbackIds);
        return [
          'acted' => true,
          'player_id' => $botPlayerId,
          'state' => 'playCombo',
          'action' => 'playCombo',
          'args' => ['cards' => $fallbackIds],
        ];
      }
      throw $passEx;
    }
  }

  /**
   * Finds real card IDs from $handCards that form a legal Combo beating $lastCombo.
   * When $wish > 0, only returns combos that contain a card with type_arg == $wish (or a bomb with $wish).
   */
  public static function findPlayableComboIds(
    array $handCards,
    \Combo $lastCombo,
    int $wish = 0,
    bool $allowSpecialsAndBombs = true
  ): ?array {
    if (empty($handCards)) {
      return null;
    }

    $byRank = [];
    $bySuit = [1 => [], 2 => [], 3 => [], 4 => []];
    $dragon = null;
    $phoenix = null;
    $mahjong = null;

    foreach ($handCards as $c) {
      $rank = (int) $c['type_arg'];
      $suit = (int) $c['type'];
      if ($rank === 1) {
        if ($suit === TYPE_DRAGON) {
          $dragon = $c;
        } elseif ($suit === TYPE_PHOENIX) {
          $phoenix = $c;
        } elseif ($suit === TYPE_MAHJONG) {
          $mahjong = $c;
        }
      } else {
        $byRank[$rank][] = $c;
        $bySuit[$suit][$rank] = $c;
      }
    }

    $comboType = (int) $lastCombo->type;
    $comboLen = count($lastCombo->cards ?? []);

    // Helper to validate a candidate card list against $lastCombo and $wish
    $validateCandidate = static function (array $cards) use ($lastCombo, $wish): ?array {
      if ($wish > 0) {
        $hasWish = false;
        foreach ($cards as $c) {
          if ((int) $c['type_arg'] === $wish) {
            $hasWish = true;
            break;
          }
        }
        if (!$hasWish) {
          return null;
        }
      }
      $combo = new \Combo($cards);
      if ($combo->type === INVALID_COMBO) {
        return null;
      }
      if (is_array($combo->phoenixValue)) {
        $combo->recheckPhoenix();
      }
      if (!$combo->canBeat($lastCombo)) {
        return null;
      }
      return array_map(static fn($c) => (string) $c['id'], $combo->cards);
    };

    // 1. Check bombs first if $wish > 0 (since Hand::canFulFillWish checks bombs first)
    $findBombIds = static function () use ($byRank, $bySuit, $validateCandidate): ?array {
      // Straight flush bombs (length 5..13)
      for ($suit = 1; $suit <= 4; $suit++) {
        $suitCards = $bySuit[$suit];
        if (count($suitCards) < 5) {
          continue;
        }
        $ranks = array_keys($suitCards);
        sort($ranks, SORT_NUMERIC);
        $n = count($ranks);
        for ($i = 0; $i < $n; $i++) {
          for ($len = 5; $i + $len <= $n; $len++) {
            if ($ranks[$i + $len - 1] === $ranks[$i] + $len - 1) {
              $cand = [];
              for ($k = 0; $k < $len; $k++) {
                $cand[] = $suitCards[$ranks[$i + $k]];
              }
              $ids = $validateCandidate($cand);
              if ($ids !== null) {
                return $ids;
              }
            }
          }
        }
      }
      // 4-of-a-kind bombs
      for ($rank = 2; $rank <= 14; $rank++) {
        if (count($byRank[$rank] ?? []) === 4) {
          $ids = $validateCandidate($byRank[$rank]);
          if ($ids !== null) {
            return $ids;
          }
        }
      }
      return null;
    };

    // 2. Match the current trick's combo type
    switch ($comboType) {
      case NO_COMBO:
      case DOG_COMBO:
      case SINGLE_COMBO:
        for ($rank = 2; $rank <= 14; $rank++) {
          if ($wish > 0 && $rank !== $wish) {
            continue;
          }
          if (!empty($byRank[$rank])) {
            $ids = $validateCandidate([$byRank[$rank][0]]);
            if ($ids !== null) {
              return $ids;
            }
          }
        }
        if ($wish === 0 && $allowSpecialsAndBombs) {
          if ($phoenix !== null) {
            $ids = $validateCandidate([$phoenix]);
            if ($ids !== null) {
              return $ids;
            }
          }
          if ($dragon !== null) {
            $ids = $validateCandidate([$dragon]);
            if ($ids !== null) {
              return $ids;
            }
          }
        }
        break;

      case PAIR_COMBO:
        for ($rank = 2; $rank <= 14; $rank++) {
          if ($wish > 0 && $rank !== $wish) {
            continue;
          }
          $cardsOfRank = $byRank[$rank] ?? [];
          if (count($cardsOfRank) >= 2) {
            $ids = $validateCandidate([$cardsOfRank[0], $cardsOfRank[1]]);
            if ($ids !== null) {
              return $ids;
            }
          } elseif (count($cardsOfRank) === 1 && $phoenix !== null && ($wish > 0 || $allowSpecialsAndBombs)) {
            $ids = $validateCandidate([$phoenix, $cardsOfRank[0]]);
            if ($ids !== null) {
              return $ids;
            }
          }
        }
        break;

      case TRIP_COMBO:
        for ($rank = 2; $rank <= 14; $rank++) {
          if ($wish > 0 && $rank !== $wish) {
            continue;
          }
          $cardsOfRank = $byRank[$rank] ?? [];
          if (count($cardsOfRank) >= 3) {
            $ids = $validateCandidate(array_slice($cardsOfRank, 0, 3));
            if ($ids !== null) {
              return $ids;
            }
          } elseif (count($cardsOfRank) === 2 && $phoenix !== null) {
            $ids = $validateCandidate([$phoenix, $cardsOfRank[0], $cardsOfRank[1]]);
            if ($ids !== null) {
              return $ids;
            }
          }
        }
        break;

      case RUNNING_PAIRS_COMBO:
        $numPairs = (int) ($comboLen / 2);
        for ($start = 2; $start <= 14 - $numPairs + 1; $start++) {
          $end = $start + $numPairs - 1;
          if ($wish > 0 && ($wish < $start || $wish > $end)) {
            continue;
          }
          $cand = [];
          $phoenixUsed = false;
          $possible = true;
          for ($r = $start; $r <= $end; $r++) {
            $cList = $byRank[$r] ?? [];
            if (count($cList) >= 2) {
              $cand[] = $cList[0];
              $cand[] = $cList[1];
            } elseif (count($cList) === 1 && $phoenix !== null && !$phoenixUsed) {
              $cand[] = $cList[0];
              $cand[] = $phoenix;
              $phoenixUsed = true;
            } else {
              $possible = false;
              break;
            }
          }
          if ($possible) {
            $ids = $validateCandidate($cand);
            if ($ids !== null) {
              return $ids;
            }
          }
        }
        break;

      case STRAIGHT_COMBO:
        for ($start = 1; $start <= 14 - $comboLen + 1; $start++) {
          $end = $start + $comboLen - 1;
          if ($wish > 0 && ($wish < $start || $wish > $end)) {
            continue;
          }
          $cand = [];
          $phoenixUsed = false;
          $possible = true;
          for ($r = $start; $r <= $end; $r++) {
            if ($r === 1) {
              if ($mahjong !== null) {
                $cand[] = $mahjong;
              } else {
                $possible = false;
                break;
              }
            } elseif (!empty($byRank[$r])) {
              $cand[] = $byRank[$r][0];
            } elseif ($phoenix !== null && !$phoenixUsed) {
              $cand[] = $phoenix;
              $phoenixUsed = true;
            } else {
              $possible = false;
              break;
            }
          }
          if ($possible) {
            $ids = $validateCandidate($cand);
            if ($ids !== null) {
              return $ids;
            }
          }
        }
        break;

      case FULL_HOUSE_COMBO:
        for ($tripRank = 2; $tripRank <= 14; $tripRank++) {
          for ($pairRank = 2; $pairRank <= 14; $pairRank++) {
            if ($tripRank === $pairRank) {
              continue;
            }
            if ($wish > 0 && $tripRank !== $wish && $pairRank !== $wish) {
              continue;
            }
            $tCards = $byRank[$tripRank] ?? [];
            $pCards = $byRank[$pairRank] ?? [];
            if (empty($tCards) || empty($pCards)) {
              continue;
            }
            $needPhoenix = max(0, 3 - count($tCards)) + max(0, 2 - count($pCards));
            if ($needPhoenix === 0) {
              $cand = array_merge(array_slice($tCards, 0, 3), array_slice($pCards, 0, 2));
              $ids = $validateCandidate($cand);
              if ($ids !== null) {
                return $ids;
              }
            } elseif ($needPhoenix === 1 && $phoenix !== null) {
              $cand = array_merge(
                array_slice($tCards, 0, min(3, count($tCards))),
                array_slice($pCards, 0, min(2, count($pCards))),
                [$phoenix]
              );
              $ids = $validateCandidate($cand);
              if ($ids !== null) {
                return $ids;
              }
            }
          }
        }
        break;
    }

    // 3. Check bombs if allowed or if required by Mahjong wish
    if ($wish > 0 || $allowSpecialsAndBombs) {
      $bombIds = $findBombIds();
      if ($bombIds !== null) {
        return $bombIds;
      }
    }

    return null;
  }
}
