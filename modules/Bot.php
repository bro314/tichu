<?php
/**
 * Smart, rule-compliant bot implementation for Tichu.
 * Shared by BGA Studio debug actions (`debug_botStep`, `debug_botOthers`, `debug_botSuggest`)
 * and the local development runner (`LocalTichuBot`).
 */

class TichuBot
{
  /**
   * Executes one bot step for $botId and refreshes lock state if the bot acted.
   *
   * @param array<int, array<string, mixed>> $actions
   */
  protected static function executeAndRecordBotStep(
    \Tichu $game,
    int $botId,
    array &$actions,
    int &$steps
  ): bool {
    $res = self::stepSingleBotTurn($game, $botId);
    if (empty($res['acted'])) {
      return false;
    }
    $game->refreshLockStateAfterBotStep();
    $actions[] = $res;
    $steps++;
    return true;
  }

  /**
   * Steps every active non-human player once in the current multipleactiveplayer state.
   *
   * @param array<int, array<string, mixed>> $actions
   */
  protected static function stepMultiactiveBatch(
    \Tichu $game,
    int $humanPlayerId,
    int $stateId,
    int $maxSteps,
    array &$actions,
    int &$steps
  ): bool {
    $actedInBatch = false;
    $multiactive = $game->gamestate->getActivePlayerList();
    foreach ($multiactive as $pIdStr) {
      $botId = (int) $pIdStr;
      if ($botId <= 0 || $botId === $humanPlayerId) {
        continue;
      }
      $curState = $game->gamestate->state();
      if (
        (int) ($curState['id'] ?? 0) !== $stateId ||
        !$game->gamestate->isPlayerActive($botId)
      ) {
        break;
      }
      if (self::executeAndRecordBotStep($game, $botId, $actions, $steps)) {
        $actedInBatch = true;
        if ($steps >= $maxSteps) {
          break;
        }
      }
    }
    return $actedInBatch;
  }

  /**
   * Advances the game state when other players (everyone except $humanPlayerId) need to act.
   * - In a multipleactiveplayer state (grandTichuBets, giveCards, showPassedCards), acts ONCE for
   *   each non-human active player in that state and then stops (even if the state transitions).
   * - In an activeplayer state where $humanPlayerId is not active, steps bot turns until
   *   $humanPlayerId becomes active, the state type changes, or $maxSteps is reached.
   *
   * @return array<int, array<string, mixed>>
   */
  public static function actForOtherPlayers(
    \Tichu $game,
    int $humanPlayerId,
    int $maxSteps = 40
  ): array {
    $maxSteps = max(1, min($maxSteps, 40));
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
      self::stepMultiactiveBatch($game, $humanPlayerId, $initialStateId, $maxSteps, $actions, $steps);
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

      if (!self::executeAndRecordBotStep($game, $activePlayerId, $actions, $steps)) {
        break;
      }
    }

    return $actions;
  }

  /**
   * Computes one legal move for $botPlayerId (or the currently active / first multiactive player)
   * without mutating any game or database state.
   *
   * @return array<string, mixed>
   */
  public static function chooseNextAction(\Tichu $game, ?int $botPlayerId = null): array
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
        $viewerId = (int) $game->getCurrentPlayerId();
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

    switch ($stateName) {
      case 'grandTichuBets':
        $handCards = array_values(
          \CardManager::getDeck()->getCardsInLocation('hand', $botPlayerId)
        );
        $bet = self::shouldCallGrandTichu($handCards) ? 200 : 0;
        return [
          'acted' => true,
          'player_id' => $botPlayerId,
          'state' => $stateName,
          'action' => 'grandTichuBet',
          'args' => ['bet' => $bet],
        ];

      case 'giveCards':
        $cardIds = self::pickThreeCardsToGive($botPlayerId);
        return [
          'acted' => true,
          'player_id' => $botPlayerId,
          'state' => $stateName,
          'action' => 'giveTheCards',
          'args' => ['cards' => $cardIds],
        ];

      case 'showPassedCards':
        return [
          'acted' => true,
          'player_id' => $botPlayerId,
          'state' => $stateName,
          'action' => 'acceptCards',
          'args' => [],
        ];

      case 'mahjongPlay':
        $wish = self::pickMahjongWish($botPlayerId);
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
        return [
          'acted' => true,
          'player_id' => $botPlayerId,
          'state' => $stateName,
          'action' => 'choosePhoenix',
          'args' => ['phoenixValue' => $chosenVal],
        ];

      case 'chooseDragonGift':
        return [
          'acted' => true,
          'player_id' => $botPlayerId,
          'state' => $stateName,
          'action' => 'chooseDragonGift',
          'args' => ['player' => 0],
        ];

      case 'confirmTrick':
        return [
          'acted' => true,
          'player_id' => $botPlayerId,
          'state' => $stateName,
          'action' => 'collect',
          'args' => [],
        ];

      case 'playBomb':
        return [
          'acted' => true,
          'player_id' => $botPlayerId,
          'state' => $stateName,
          'action' => 'cancel',
          'args' => [],
        ];

      case 'playComboOpen':
        $handCards = array_values(
          \CardManager::getDeck()->getCardsInLocation('hand', $botPlayerId)
        );
        $cardIds = self::pickOpeningComboCards($game, $botPlayerId);
        $callTichuFirst = self::shouldCallTichu($game, $botPlayerId, $handCards);
        return [
          'acted' => true,
          'player_id' => $botPlayerId,
          'state' => $stateName,
          'action' => 'playCombo',
          'callTichuFirst' => $callTichuFirst,
          'args' => ['cards' => $cardIds],
        ];

      case 'playCombo':
        return self::decideInPlayCombo($game, $botPlayerId);

      default:
        return [
          'acted' => false,
          'player_id' => $botPlayerId,
          'state' => $stateName,
          'reason' => "Unhandled state '$stateName'",
        ];
    }
  }

  /**
   * Executes one legal move for $botPlayerId (or the currently active / first multiactive player).
   *
   * @return array<string, mixed>
   */
  public static function stepSingleBotTurn(\Tichu $game, ?int $botPlayerId = null): array
  {
    $decision = self::chooseNextAction($game, $botPlayerId);
    if (empty($decision['acted'])) {
      return $decision;
    }

    $targetId = (int) $decision['player_id'];
    $action = (string) $decision['action'];
    $args = is_array($decision['args'] ?? null) ? $decision['args'] : [];

    switch ($action) {
      case 'grandTichuBet':
        $game->grandTichuBet((int) ($args['bet'] ?? 0), true, $targetId);
        break;

      case 'giveTheCards':
        $game->giveTheCards($args['cards'] ?? [], $targetId);
        break;

      case 'acceptCards':
        $game->acceptCards($targetId);
        break;

      case 'makeAWish':
        $game->makeAWish((int) ($args['wish'] ?? 15), false);
        break;

      case 'choosePhoenix':
        $game->choosePhoenix((int) ($args['phoenixValue'] ?? 2), false);
        break;

      case 'chooseDragonGift':
        $game->chooseDragonGift((int) ($args['player'] ?? 0), false);
        break;

      case 'collect':
        $game->collect(false);
        break;

      case 'cancel':
        $game->cancel(false);
        break;

      case 'playCombo':
        if (!empty($decision['callTichuFirst'])) {
          $game->tichuBet(true, $targetId);
        }
        $game->playCombo($args['cards'] ?? [], false, $targetId);
        break;

      case 'pass':
        $game->pass((bool) ($args['onlyOnce'] ?? true), $targetId);
        break;

      default:
        return [
          'acted' => false,
          'player_id' => $targetId,
          'state' => $decision['state'] ?? '',
          'reason' => "Unhandled action '$action'",
        ];
    }

    return $decision;
  }

  /**
   * Counts how many of the 6 top high cards (4 Aces, Dragon, Phoenix) are in $handCards.
   *
   * @param array<int, array<string, mixed>> $handCards
   */
  public static function countHighCards(array $handCards): int
  {
    $count = 0;
    foreach ($handCards as $card) {
      $rank = (int) $card['type_arg'];
      $suit = (int) $card['type'];
      if (
        $rank === 14 ||
        ($rank === 1 && ($suit === TYPE_DRAGON || $suit === TYPE_PHOENIX))
      ) {
        $count++;
      }
    }
    return $count;
  }

  /**
   * Returns true if the bot holds at least 2 of the 6 high cards (4 Aces, Dragon, Phoenix).
   *
   * @param array<int, array<string, mixed>> $handCards
   */
  public static function shouldCallGrandTichu(array $handCards): bool
  {
    return self::countHighCards($handCards) >= 2;
  }

  /**
   * Returns true if the bot still has all 14 cards, has not yet called Grand Tichu or Tichu,
   * nobody has gone out yet, and holds at least 4 of the 6 high cards.
   *
   * @param array<int, array<string, mixed>> $handCards
   */
  public static function shouldCallTichu(\Tichu $game, int $botPlayerId, array $handCards): bool
  {
    if (count($handCards) !== 14 || self::countHighCards($handCards) < 4) {
      return false;
    }
    if ((int) $game->getGameStateValue('firstOutPlayer') !== 0) {
      return false;
    }
    $player = \PlayerManager::getPlayer($botPlayerId);
    if (!$player) {
      return false;
    }
    return (int) ($player['call_grand_tichu'] ?? -1) !== 200 &&
      (int) ($player['call_tichu'] ?? -1) === -1;
  }

  /**
   * Picks a Mahjong wish (2..7 with 90% probability, or 15 = no wish).
   * Never makes a wish when the bot's partner has called Grand Tichu.
   */
  public static function pickMahjongWish(
    int $botPlayerId,
    ?int $chanceRoll = null,
    ?int $wishRoll = null
  ): int {
    $partner = \PlayerManager::getPartner($botPlayerId);
    if ((int) ($partner['call_grand_tichu'] ?? -1) === 200) {
      return 15;
    }
    $roll = $chanceRoll ?? bga_rand(1, 100);
    if ($roll <= 90) {
      return $wishRoll ?? bga_rand(2, 7);
    }
    return 15;
  }

  /**
   * Selects 3 valid cards from $botPlayerId's hand to pass in ST_GIVE_CARDS:
   * [cardToOpp0, cardToPartner, cardToOpp2] matching Tichu::giveTheCards recipient order
   * (`PlayerManager::getNextPlayers($botPlayerId, true)`).
   *
   * - Normal: best card to partner, two lowest non-Dog cards to opponents.
   * - Self called Grand Tichu: Dog (or another low card) to partner, low cards to opponents.
   * - Opponent called Grand Tichu: Dog to that Grand Tichu opponent if held.
   *
   * @return string[]
   */
  public static function pickThreeCardsToGive(int $botPlayerId): array
  {
    $deck = \CardManager::getDeck();
    $handCards = array_values($deck->getCardsInLocation('hand', $botPlayerId));
    if (count($handCards) < 3) {
      return array_map(static fn($c) => (string) $c['id'], $handCards);
    }

    $nextPlayers = \PlayerManager::getNextPlayers($botPlayerId, true);
    $opp0CalledGT = (int) ($nextPlayers[0]['call_grand_tichu'] ?? -1) === 200;
    $opp2CalledGT = (int) ($nextPlayers[2]['call_grand_tichu'] ?? -1) === 200;
    $selfCalledGT = (int) ($nextPlayers[3]['call_grand_tichu'] ?? -1) === 200;

    $rankCounts = [];
    $dogCard = null;
    foreach ($handCards as $c) {
      $rank = (int) $c['type_arg'];
      $suit = (int) $c['type'];
      $rankCounts[$rank] = ($rankCounts[$rank] ?? 0) + 1;
      if ($rank === 1 && $suit === TYPE_DOG) {
        $dogCard = $c;
      }
    }

    // Strength order for partner's best card: Dragon (16) > Phoenix (15) > 2..14 > Mahjong (1) > Dog (0)
    $partnerStrength = static function (array $c): int {
      $rank = (int) $c['type_arg'];
      $suit = (int) $c['type'];
      if ($rank === 1) {
        if ($suit === TYPE_DRAGON) {
          return 16;
        }
        if ($suit === TYPE_PHOENIX) {
          return 15;
        }
        if ($suit === TYPE_MAHJONG) {
          return 1;
        }
        return 0;
      }
      return $rank;
    };

    // Ascending weakness order for low cards: 2..14 < Mahjong (15) < Phoenix (16) < Dragon (17) < Dog (18)
    $lowRankOrder = static function (array $c): int {
      $rank = (int) $c['type_arg'];
      $suit = (int) $c['type'];
      if ($rank === 1) {
        if ($suit === TYPE_MAHJONG) {
          return 15;
        }
        if ($suit === TYPE_PHOENIX) {
          return 16;
        }
        if ($suit === TYPE_DRAGON) {
          return 17;
        }
        return 18;
      }
      return $rank;
    };

    $compareBest = static function (array $a, array $b) use ($partnerStrength, $rankCounts): int {
      $cmp = $partnerStrength($b) <=> $partnerStrength($a);
      if ($cmp !== 0) {
        return $cmp;
      }
      $aFreq = (int) $a['type_arg'] === 1 ? 1 : ($rankCounts[(int) $a['type_arg']] ?? 1);
      $bFreq = (int) $b['type_arg'] === 1 ? 1 : ($rankCounts[(int) $b['type_arg']] ?? 1);
      if ($aFreq !== $bFreq) {
        return $aFreq <=> $bFreq;
      }
      return ((int) $a['id']) <=> ((int) $b['id']);
    };

    $compareLowest = static function (array $a, array $b) use ($lowRankOrder, $rankCounts): int {
      $cmp = $lowRankOrder($a) <=> $lowRankOrder($b);
      if ($cmp !== 0) {
        return $cmp;
      }
      $aFreq = (int) $a['type_arg'] === 1 ? 1 : ($rankCounts[(int) $a['type_arg']] ?? 1);
      $bFreq = (int) $b['type_arg'] === 1 ? 1 : ($rankCounts[(int) $b['type_arg']] ?? 1);
      if ($aFreq !== $bFreq) {
        return $aFreq <=> $bFreq;
      }
      return ((int) $a['id']) <=> ((int) $b['id']);
    };

    $usedIds = [];
    $markUsed = static function (array $card) use (&$usedIds): array {
      $usedIds[(string) $card['id']] = true;
      return $card;
    };
    $remainingCards = static function () use ($handCards, &$usedIds): array {
      return array_values(
        array_filter($handCards, static fn(array $c): bool => !isset($usedIds[(string) $c['id']]))
      );
    };

    $slot0 = null;
    $slot1 = null;
    $slot2 = null;

    // 1. Opponent Grand Tichu exception: pass Dog to GT opponent if possible
    if ($dogCard !== null) {
      if ($opp0CalledGT) {
        $slot0 = $markUsed($dogCard);
      } elseif ($opp2CalledGT) {
        $slot2 = $markUsed($dogCard);
      }
    }

    // 2. Partner slot (slot 1)
    if ($selfCalledGT) {
      if ($dogCard !== null && !isset($usedIds[(string) $dogCard['id']])) {
        $slot1 = $markUsed($dogCard);
      } else {
        $avail = $remainingCards();
        usort($avail, $compareLowest);
        $slot1 = $markUsed($avail[0]);
      }
    } else {
      $avail = $remainingCards();
      usort($avail, $compareBest);
      $slot1 = $markUsed($avail[0]);
    }

    // 3. Opponent slots (slot 0 and slot 2)
    $avail = $remainingCards();
    usort($avail, $compareLowest);
    if ($slot0 === null) {
      $slot0 = $markUsed(array_shift($avail));
    }
    if ($slot2 === null) {
      $slot2 = $markUsed(array_shift($avail));
    }

    return [(string) $slot0['id'], (string) $slot1['id'], (string) $slot2['id']];
  }

  /**
   * Builds the largest natural multi-card combo containing $targetRank, or the single card
   * of $targetRank if no natural combo includes it.
   *
   * @param array<int, array<int, array<string, mixed>>> $byRank
   * @param array<string, mixed>|null $mahjong
   * @return string[]
   */
  public static function findOpeningComboForTargetRank(
    int $targetRank,
    array $byRank,
    ?array $mahjong
  ): array {
    if ($targetRank === 1) {
      if ($mahjong === null) {
        return [];
      }
      $straightCards = [$mahjong];
      $r = 2;
      while ($r <= 14 && !empty($byRank[$r])) {
        $straightCards[] = $byRank[$r][0];
        $r++;
      }
      if (count($straightCards) >= 5) {
        $combo = new \Combo($straightCards);
        if ($combo->type !== INVALID_COMBO && $combo->type !== NO_COMBO) {
          return array_map(static fn(array $c): string => (string) $c['id'], $combo->cards);
        }
      }
      return [(string) $mahjong['id']];
    }

    if (empty($byRank[$targetRank])) {
      return [];
    }

    // Priority order on ties: Full House > Straight > Running Pairs > Triple > Pair
    $candidates = [];

    // 1. Full House (5 cards)
    $targetCount = count($byRank[$targetRank]);
    if ($targetCount >= 3) {
      $bestPairRank = null;
      for ($p = 2; $p <= 14; $p++) {
        if ($p !== $targetRank && count($byRank[$p] ?? []) === 2) {
          $bestPairRank = $p;
          break;
        }
      }
      if ($bestPairRank === null) {
        for ($p = 2; $p <= 14; $p++) {
          if ($p !== $targetRank && count($byRank[$p] ?? []) >= 2) {
            $bestPairRank = $p;
            break;
          }
        }
      }
      if ($bestPairRank !== null) {
        $candidates[] = array_merge(
          array_slice($byRank[$targetRank], 0, 3),
          array_slice($byRank[$bestPairRank], 0, 2)
        );
      }
    } elseif ($targetCount >= 2) {
      $bestTripRank = null;
      for ($t = 2; $t <= 14; $t++) {
        if ($t !== $targetRank && count($byRank[$t] ?? []) === 3) {
          $bestTripRank = $t;
          break;
        }
      }
      if ($bestTripRank === null) {
        for ($t = 2; $t <= 14; $t++) {
          if ($t !== $targetRank && count($byRank[$t] ?? []) >= 3) {
            $bestTripRank = $t;
            break;
          }
        }
      }
      if ($bestTripRank !== null) {
        $candidates[] = array_merge(
          array_slice($byRank[$bestTripRank], 0, 3),
          array_slice($byRank[$targetRank], 0, 2)
        );
      }
    }

    // 2. Straight (5+ cards)
    $hasRank = static fn(int $r): bool => $r === 1 ? $mahjong !== null : !empty($byRank[$r]);
    $start = $targetRank;
    $end = $targetRank;
    while ($start > 1 && $hasRank($start - 1)) {
      $start--;
    }
    while ($end < 14 && $hasRank($end + 1)) {
      $end++;
    }
    if ($end - $start + 1 >= 5) {
      $straightCards = [];
      for ($r = $start; $r <= $end; $r++) {
        $straightCards[] = $r === 1 ? $mahjong : $byRank[$r][0];
      }
      if ($start >= 2) {
        $firstSuit = (int) $straightCards[0]['type'];
        $allSameSuit = true;
        foreach ($straightCards as $sc) {
          if ((int) $sc['type'] !== $firstSuit) {
            $allSameSuit = false;
            break;
          }
        }
        if ($allSameSuit) {
          foreach (range($start, $end) as $idx => $r) {
            if (count($byRank[$r]) > 1) {
              $straightCards[$idx] = $byRank[$r][1];
              break;
            }
          }
        }
      }
      $candidates[] = $straightCards;
    }

    // 3. Running Pairs (4+ cards)
    if ($targetCount >= 2) {
      $rpStart = $targetRank;
      $rpEnd = $targetRank;
      while ($rpStart > 2 && count($byRank[$rpStart - 1] ?? []) >= 2) {
        $rpStart--;
      }
      while ($rpEnd < 14 && count($byRank[$rpEnd + 1] ?? []) >= 2) {
        $rpEnd++;
      }
      if ($rpEnd - $rpStart + 1 >= 2) {
        $rpCards = [];
        for ($r = $rpStart; $r <= $rpEnd; $r++) {
          $rpCards[] = $byRank[$r][0];
          $rpCards[] = $byRank[$r][1];
        }
        $candidates[] = $rpCards;
      }
    }

    // 4. Triple (3 cards)
    if ($targetCount >= 3) {
      $candidates[] = array_slice($byRank[$targetRank], 0, 3);
    }

    // 5. Pair (2 cards)
    if ($targetCount >= 2) {
      $candidates[] = array_slice($byRank[$targetRank], 0, 2);
    }

    $bestCombo = null;
    $bestLen = 0;
    foreach ($candidates as $cand) {
      $combo = new \Combo($cand);
      if ($combo->type === INVALID_COMBO || $combo->type === NO_COMBO) {
        continue;
      }
      $len = count($combo->cards);
      if ($len > $bestLen) {
        $bestLen = $len;
        $bestCombo = $combo;
      }
    }

    if ($bestCombo !== null) {
      return array_map(static fn(array $c): string => (string) $c['id'], $bestCombo->cards);
    }

    return [(string) $byRank[$targetRank][0]['id']];
  }

  /**
   * Picks a valid opening combo in ST_PLAY_COMBO_OPEN.
   *
   * @return string[]
   */
  public static function pickOpeningComboCards(\Tichu $game, int $botPlayerId): array
  {
    $deck = \CardManager::getDeck();
    $handCards = array_values($deck->getCardsInLocation('hand', $botPlayerId));
    if (empty($handCards)) {
      return [];
    }

    $byRank = [];
    $dog = null;
    $mahjong = null;
    $phoenix = null;
    $dragon = null;
    foreach ($handCards as $card) {
      $rank = (int) $card['type_arg'];
      $suit = (int) $card['type'];
      if ($rank === 1) {
        if ($suit === TYPE_DOG) {
          $dog = $card;
        } elseif ($suit === TYPE_MAHJONG) {
          $mahjong = $card;
        } elseif ($suit === TYPE_PHOENIX) {
          $phoenix = $card;
        } elseif ($suit === TYPE_DRAGON) {
          $dragon = $card;
        }
      } else {
        $byRank[$rank][] = $card;
      }
    }

    $hand = new \Hand($handCards);
    $wish = (int) $game->getGameStateValue('mahjongWish');

    // 1. If Mahjong wish is active and bot has the wished rank, MUST fulfill it
    if ($wish > 0 && $hand->canFulFillWish($wish, \Combo::$noCombo)) {
      return self::findOpeningComboForTargetRank($wish, $byRank, $mahjong);
    }

    // 2. If bot holds the Dog, leading the Dog is valid and passes lead to partner
    if ($dog !== null) {
      return [(string) $dog['id']];
    }

    // 3. If bot holds the Mahjong, lead a straight starting with Mahjong or Mahjong single
    if ($mahjong !== null) {
      return self::findOpeningComboForTargetRank(1, $byRank, $mahjong);
    }

    // 4. Lead the lowest normal rank, preferring to combine it into a natural combo
    if (!empty($byRank)) {
      $lowestRank = min(array_keys($byRank));
      return self::findOpeningComboForTargetRank($lowestRank, $byRank, $mahjong);
    }

    // 5. Fallback: only special cards left (prefer Phoenix over Dragon)
    if ($phoenix !== null) {
      return [(string) $phoenix['id']];
    }
    if ($dragon !== null) {
      return [(string) $dragon['id']];
    }
    return [(string) $handCards[0]['id']];
  }

  /**
   * Decides a legal move in ST_PLAY_COMBO (either playing a beating combo or passing)
   * without mutating game state.
   *
   * @return array<string, mixed>
   */
  private static function decideInPlayCombo(\Tichu $game, int $botPlayerId): array
  {
    $deck = \CardManager::getDeck();
    $handCards = array_values($deck->getCardsInLocation('hand', $botPlayerId));
    $hand = new \Hand($handCards);
    $wish = (int) $game->getGameStateValue('mahjongWish');
    $lastCombo = \LogManager::getLastCombo();

    $mustFulfillWish = $wish > 0 && $hand->canFulFillWish($wish, $lastCombo);
    if ($mustFulfillWish) {
      $wishCardIds = self::findPlayableComboIds($handCards, $lastCombo, $wish, true, true);
      if (empty($wishCardIds)) {
        $fallbackCombo = $hand->findPlayableCombo($lastCombo, $wish);
        if ($fallbackCombo !== null && !empty($fallbackCombo->cards)) {
          $wishCardIds = array_map(static fn($c) => (string) $c['id'], $fallbackCombo->cards);
        }
      }
      if (!empty($wishCardIds)) {
        return [
          'acted' => true,
          'player_id' => $botPlayerId,
          'state' => 'playCombo',
          'action' => 'playCombo',
          'callTichuFirst' => self::shouldCallTichu($game, $botPlayerId, $handCards),
          'args' => ['cards' => $wishCardIds, 'wishFulfilled' => $wish],
        ];
      }
    }

    $partner = \PlayerManager::getPartner($botPlayerId);
    $partnerId = (int) ($partner['id'] ?? 0);
    $lastPlayerId = (int) ($lastCombo->player ?? 0);

    // Never play above partner (unless forced by Mahjong wish above)
    if ($lastPlayerId !== $partnerId && $lastPlayerId !== $botPlayerId) {
      $beatingIds = self::findPlayableComboIds($handCards, $lastCombo, 0, true, false);
      if (!empty($beatingIds)) {
        return [
          'acted' => true,
          'player_id' => $botPlayerId,
          'state' => 'playCombo',
          'action' => 'playCombo',
          'callTichuFirst' => self::shouldCallTichu($game, $botPlayerId, $handCards),
          'args' => ['cards' => $beatingIds],
        ];
      }
    }

    // Default: pass once
    return [
      'acted' => true,
      'player_id' => $botPlayerId,
      'state' => 'playCombo',
      'action' => 'pass',
      'args' => ['onlyOnce' => true],
    ];
  }

  /**
   * Finds real card IDs from $handCards that form a legal Combo beating $lastCombo.
   * When $wish > 0, only returns combos that contain a card with type_arg == $wish (or a bomb with $wish).
   *
   * @param array<int, array<string, mixed>> $handCards
   * @return string[]|null
   */
  public static function findPlayableComboIds(
    array $handCards,
    \Combo $lastCombo,
    int $wish = 0,
    bool $allowSpecialsAndBombs = true,
    bool $allowBombsOnNonBomb = false
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
      if ($combo->type === INVALID_COMBO || $combo->type === NO_COMBO) {
        return null;
      }
      if ($combo->type === DOG_COMBO && $lastCombo->type !== NO_COMBO) {
        return null;
      }
      if (is_array($combo->phoenixValue)) {
        $combo->recheckPhoenix();
      }
      if (is_array($combo->phoenixValue)) {
        $anyBeats = false;
        foreach ($combo->phoenixValue as $candVal) {
          $resolved = new \Combo($cards);
          $resolved->setPhoenixValue($candVal);
          if ($resolved->canBeat($lastCombo)) {
            $anyBeats = true;
            break;
          }
        }
        if (!$anyBeats) {
          return null;
        }
      } elseif (!$combo->canBeat($lastCombo)) {
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
    $allowPhoenix = $phoenix !== null && ($wish > 0 || $allowSpecialsAndBombs);
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
        foreach ($allowPhoenix ? [false, true] : [false] as $usePhoenix) {
          for ($rank = 2; $rank <= 14; $rank++) {
            if ($wish > 0 && $rank !== $wish) {
              continue;
            }
            $cardsOfRank = $byRank[$rank] ?? [];
            if (!$usePhoenix && count($cardsOfRank) >= 2) {
              $ids = $validateCandidate([$cardsOfRank[0], $cardsOfRank[1]]);
              if ($ids !== null) {
                return $ids;
              }
            } elseif ($usePhoenix && $phoenix !== null && count($cardsOfRank) === 1) {
              $ids = $validateCandidate([$phoenix, $cardsOfRank[0]]);
              if ($ids !== null) {
                return $ids;
              }
            }
          }
        }
        break;

      case TRIP_COMBO:
        foreach ($allowPhoenix ? [false, true] : [false] as $usePhoenix) {
          for ($rank = 2; $rank <= 14; $rank++) {
            if ($wish > 0 && $rank !== $wish) {
              continue;
            }
            $cardsOfRank = $byRank[$rank] ?? [];
            if (!$usePhoenix && count($cardsOfRank) >= 3) {
              $ids = $validateCandidate(array_slice($cardsOfRank, 0, 3));
              if ($ids !== null) {
                return $ids;
              }
            } elseif ($usePhoenix && $phoenix !== null && count($cardsOfRank) === 2) {
              $ids = $validateCandidate([$phoenix, $cardsOfRank[0], $cardsOfRank[1]]);
              if ($ids !== null) {
                return $ids;
              }
            }
          }
        }
        break;

      case RUNNING_PAIRS_COMBO:
        $numPairs = (int) ($comboLen / 2);
        foreach ($allowPhoenix ? [false, true] : [false] as $usePhoenix) {
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
              } elseif ($usePhoenix && $phoenix !== null && count($cList) === 1 && !$phoenixUsed) {
                $cand[] = $cList[0];
                $cand[] = $phoenix;
                $phoenixUsed = true;
              } else {
                $possible = false;
                break;
              }
            }
            if ($possible && (!$usePhoenix || $phoenixUsed)) {
              $ids = $validateCandidate($cand);
              if ($ids !== null) {
                return $ids;
              }
            }
          }
        }
        break;

      case STRAIGHT_COMBO:
        foreach ($allowPhoenix ? [false, true] : [false] as $usePhoenix) {
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
              } elseif ($usePhoenix && $phoenix !== null && !$phoenixUsed) {
                $cand[] = $phoenix;
                $phoenixUsed = true;
              } else {
                $possible = false;
                break;
              }
            }
            if ($possible && (!$usePhoenix || $phoenixUsed)) {
              $ids = $validateCandidate($cand);
              if ($ids !== null) {
                return $ids;
              }
            }
          }
        }
        break;

      case FULL_HOUSE_COMBO:
        foreach ($allowPhoenix ? [false, true] : [false] as $usePhoenix) {
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
              if (!$usePhoenix && $needPhoenix === 0) {
                $cand = array_merge(array_slice($tCards, 0, 3), array_slice($pCards, 0, 2));
                $ids = $validateCandidate($cand);
                if ($ids !== null) {
                  return $ids;
                }
              } elseif ($usePhoenix && $phoenix !== null && $needPhoenix === 1) {
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
        }
        break;
    }

    // 3. Check bombs if allowed or if required by Mahjong wish
    if ($wish > 0 || ($allowSpecialsAndBombs && ($comboType === BOMB_COMBO || $allowBombsOnNonBomb))) {
      $bombIds = $findBombIds();
      if ($bombIds !== null) {
        return $bombIds;
      }
    }

    return null;
  }
}
