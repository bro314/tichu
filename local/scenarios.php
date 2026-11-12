<?php
/**
 * Deterministic Scenario Builder for the Local Tichu Runner.
 * Configures the SQLite database into exact, reproducible game states for
 * both backend integration tests and frontend browser/console testing.
 */

class LocalTichuScenarios
{
  public const P0 = 2385074; // dashwood0 (Team 0, seat 0)
  public const P1 = 2385075; // dashwood1 (Team 1, seat 1)
  public const P2 = 2385076; // dashwood2 (Team 0, seat 2 - P0's partner)
  public const P3 = 2385077; // dashwood3 (Team 1, seat 3 - P1's partner)

  /**
   * Lists all supported deterministic scenario names.
   */
  public static function getAvailableScenarios(): array
  {
    return [
      'grand_tichu',
      'give_cards',
      'mahjong_wish',
      'phoenix_ambiguous',
      'bomb_interrupt',
      'dragon_gift',
      'double_victory',
    ];
  }

  /**
   * Sets up the requested scenario on $game and returns $game->getFullClientPayload($viewerPlayerId).
   */
  public static function setupScenario(
    \Tichu $game,
    string $scenarioName,
    int $viewerPlayerId = self::P0
  ): array {
    switch ($scenarioName) {
      case 'grand_tichu':
        self::setupGrandTichu($game);
        break;

      case 'give_cards':
        self::setupGiveCards($game);
        break;

      case 'mahjong_wish':
        self::setupMahjongWish($game);
        break;

      case 'phoenix_ambiguous':
        self::setupPhoenixAmbiguous($game);
        break;

      case 'bomb_interrupt':
        self::setupBombInterrupt($game);
        break;

      case 'dragon_gift':
        self::setupDragonGift($game);
        break;

      case 'double_victory':
        self::setupDoubleVictory($game);
        break;

      default:
        throw new \Bga\GameFramework\UserException(
          "Unknown scenario '$scenarioName'. Available: " .
            implode(', ', self::getAvailableScenarios())
        );
    }

    return $game->getFullClientPayload($viewerPlayerId);
  }

  /**
   * Helper: Look up the card_id for a unique (type, type_arg) card in the 56-card Tichu deck.
   * Suits (type): 1..4. Ranks (type_arg): 1 (special) or 2..14.
   * Special cards (type_arg = 1):
   *   (1, 1) = Dragon, (2, 1) = Phoenix, (3, 1) = Dog, (4, 1) = Mahjong.
   */
  public static function getCardId(int $type, int $typeArg): int
  {
    $id = \APP_DbObject::getUniqueValueFromDB(
      "SELECT card_id FROM card WHERE card_type = '$type' AND card_type_arg = $typeArg LIMIT 1"
    );
    if ($id === null) {
      throw new \Bga\GameFramework\SystemException(
        "Card not found for type=$type, type_arg=$typeArg"
      );
    }
    return (int) $id;
  }

  /**
   * Helper: Convert an array of [type, type_arg] pairs into an array of string card IDs.
   */
  public static function getCardIds(array $specs): array
  {
    return array_map(
      static fn(array $spec) => (string) self::getCardId((int) $spec[0], (int) $spec[1]),
      $specs
    );
  }

  /**
   * Helper: Assign specific card specs ([type, type_arg]) to each player's hand,
   * and distribute all remaining unassigned cards according to $remainderMode:
   * - 'deck': put remaining cards into 'deck' (ordered 0..N-1)
   * - 'distribute_14': deal remaining cards into players' hands until each has 14 cards
   * - 'captured_p0': put remaining cards into 'captured' for P0
   */
  public static function assignPlayerHands(
    array $handsByPlayer,
    string $remainderMode = 'distribute_14'
  ): void {
    // First reset all cards to 'deck' with passed_from = NULL
    \APP_DbObject::DbQuery(
      "UPDATE card SET card_location = 'deck', card_location_arg = 0, card_passed_from = NULL"
    );

    $assignedIds = [];
    foreach ($handsByPlayer as $playerId => $specs) {
      $pId = (int) $playerId;
      foreach ($specs as $spec) {
        $cId = self::getCardId((int) $spec[0], (int) $spec[1]);
        $assignedIds[$cId] = $pId;
        \APP_DbObject::DbQuery(
          "UPDATE card SET card_location = 'hand', card_location_arg = $pId WHERE card_id = $cId"
        );
      }
    }

    $allIds = array_map(
      'intval',
      \APP_DbObject::getObjectListFromDB("SELECT card_id FROM card ORDER BY card_id ASC", true)
    );
    $unassignedIds = array_values(
      array_filter($allIds, static fn(int $id) => !isset($assignedIds[$id]))
    );

    if ($remainderMode === 'deck') {
      foreach ($unassignedIds as $idx => $cId) {
        \APP_DbObject::DbQuery(
          "UPDATE card SET card_location = 'deck', card_location_arg = $idx WHERE card_id = $cId"
        );
      }
      return;
    }

    if ($remainderMode === 'captured_p0') {
      if (!empty($unassignedIds)) {
        $inList = implode(',', $unassignedIds);
        \APP_DbObject::DbQuery(
          "UPDATE card SET card_location = 'captured', card_location_arg = " .
            self::P0 .
            " WHERE card_id IN ($inList)"
        );
      }
      return;
    }

    // Default 'distribute_14': fill each player's hand up to 14 cards, rest to deck
    $players = [self::P0, self::P1, self::P2, self::P3];
    $cursor = 0;
    $totalUnassigned = count($unassignedIds);
    foreach ($players as $pId) {
      $currentCount = (int) \APP_DbObject::getUniqueValueFromDB(
        "SELECT COUNT(*) FROM card WHERE card_location = 'hand' AND card_location_arg = $pId"
      );
      while ($currentCount < 14 && $cursor < $totalUnassigned) {
        $cId = $unassignedIds[$cursor++];
        \APP_DbObject::DbQuery(
          "UPDATE card SET card_location = 'hand', card_location_arg = $pId WHERE card_id = $cId"
        );
        $currentCount++;
      }
    }
    $deckIdx = 0;
    while ($cursor < $totalUnassigned) {
      $cId = $unassignedIds[$cursor++];
      \APP_DbObject::DbQuery(
        "UPDATE card SET card_location = 'deck', card_location_arg = $deckIdx WHERE card_id = $cId"
      );
      $deckIdx++;
    }
  }

  /**
   * Helper: Fast-forward a fresh game through Grand Tichu and Give Cards into
   * Round 1, Trick 1 (`playComboOpen`) with deterministic hands and P0 holding Mahjong.
   */
  private static function bootToPlayComboOpen(\Tichu $game, array $handsByPlayer): void
  {
    $game->createNewGame();

    // 1. All 4 players make no Grand Tichu bet -> transitions to giveCards
    foreach ([self::P0, self::P1, self::P2, self::P3] as $pId) {
      $game->setCurrentPlayerId($pId);
      $game->beginPlayerAction();
      $game->grandTichuBet(0);
      $game->endPlayerAction();
    }

    // 2. Each player passes 3 cards -> transitions through acceptPassedCards -> newTrick -> playComboOpen
    foreach ([self::P0, self::P1, self::P2, self::P3] as $pId) {
      $game->setCurrentPlayerId($pId);
      $game->beginPlayerAction();
      $passIds = \LocalTichuBot::pickThreeCardsToGive($pId);
      $game->giveTheCards($passIds);
      $game->endPlayerAction();
    }

    // 3. Assign the requested deterministic hands and set P0 as Mahjong owner & active player
    self::assignPlayerHands($handsByPlayer, 'distribute_14');
    $game->setGameStateValue('mahjongOwner', self::P0);
    $game->setGameStateValue('mahjongWish', 0);
    $game->gamestate->changeActivePlayer(self::P0);
    $game->setCurrentPlayerId(self::P0);
  }

  /**
   * Scenario 1: "grand_tichu"
   * Fresh game in `grandTichuBets` (`ST_GRAND_TICHU_BETS`) where P0 (`2385074`) has 8 strong cards
   * and all 4 players need to bet.
   */
  private static function setupGrandTichu(\Tichu $game): void
  {
    $game->createNewGame();

    // Give P0 8 powerhouse cards, and P1/P2/P3 8 known cards each, leaving 24 cards in deck
    $hands = [
      self::P0 => [
        [1, 1], // Dragon
        [2, 1], // Phoenix
        [4, 1], // Mahjong
        [1, 14], // A Swords
        [2, 14], // A Stars
        [3, 14], // A Pagodas
        [4, 14], // A Jade
        [1, 13], // K Swords
      ],
      self::P1 => [
        [1, 2],
        [1, 3],
        [1, 4],
        [1, 5],
        [1, 6],
        [1, 7],
        [1, 8],
        [1, 9],
      ],
      self::P2 => [
        [2, 2],
        [2, 3],
        [2, 4],
        [2, 5],
        [2, 6],
        [2, 7],
        [2, 8],
        [2, 9],
      ],
      self::P3 => [
        [3, 2],
        [3, 3],
        [3, 4],
        [3, 5],
        [3, 6],
        [3, 7],
        [3, 8],
        [3, 9],
      ],
    ];
    self::assignPlayerHands($hands, 'deck');
    $game->setCurrentPlayerId(self::P0);
  }

  /**
   * Scenario 2: "give_cards"
   * In `giveCards` (`ST_GIVE_CARDS`) where all 4 players were dealt 14 known cards,
   * and P1, P2, P3 have already passed their 3 cards so P0 passing 3 cards immediately
   * triggers `acceptPassedCards` -> `newTrick` -> `playComboOpen`.
   */
  private static function setupGiveCards(\Tichu $game): void
  {
    $game->createNewGame();

    foreach ([self::P0, self::P1, self::P2, self::P3] as $pId) {
      $game->setCurrentPlayerId($pId);
      $game->beginPlayerAction();
      $game->grandTichuBet(0);
      $game->endPlayerAction();
    }

    // Assign deterministic 14-card hands to all 4 players
    // Note: P0 holds Mahjong (4,1) and three 7s ((1,7),(2,7),(3,7)), while P2 (partner) holds (4,7)
    // and higher singles so if P2 passes (4,7) to P0, P0 completes a 4-of-a-kind bomb of 7s!
    $hands = [
      self::P0 => [
        [4, 1], // Mahjong
        [1, 2], // 2 Swords (to pass)
        [2, 2], // 2 Stars (to pass)
        [3, 2], // 2 Pagodas (to pass)
        [1, 7],
        [2, 7],
        [3, 7],
        [1, 9],
        [2, 9],
        [1, 10],
        [2, 11],
        [3, 12],
        [4, 13],
        [1, 14],
      ],
      self::P1 => [
        [1, 3],
        [2, 3],
        [3, 3],
        [1, 4],
        [2, 4],
        [3, 4],
        [1, 5],
        [2, 5],
        [3, 5],
        [1, 6],
        [2, 6],
        [3, 6],
        [4, 6],
        [2, 14],
      ],
      self::P2 => [
        [4, 2], // to previous player (P1)
        [4, 7], // 7 Jade -> passed to partner (P0) to complete P0's 7-bomb!
        [4, 3], // to next player (P3)
        [4, 4],
        [4, 5],
        [1, 8],
        [2, 8],
        [3, 8],
        [4, 8],
        [3, 9],
        [4, 9],
        [2, 10],
        [3, 10],
        [3, 14],
      ],
      self::P3 => [
        [1, 11],
        [3, 11],
        [4, 11],
        [1, 12],
        [2, 12],
        [4, 12],
        [1, 13],
        [2, 13],
        [3, 13],
        [4, 10],
        [4, 14],
        [1, 1], // Dragon
        [2, 1], // Phoenix
        [3, 1], // Dog
      ],
    ];
    self::assignPlayerHands($hands, 'distribute_14');

    // Have P1, P2, P3 pass their 3 cards now so only P0 needs to pass to trigger acceptPassedCards
    $p1Pass = self::getCardIds([[1, 3], [2, 3], [3, 3]]);
    $game->setCurrentPlayerId(self::P1);
    $game->beginPlayerAction();
    $game->giveTheCards($p1Pass);
    $game->endPlayerAction();

    // P2 passes [prev=P1: (4,2), partner=P0: (4,7), next=P3: (4,3)]
    $p2Pass = self::getCardIds([[4, 2], [4, 7], [4, 3]]);
    $game->setCurrentPlayerId(self::P2);
    $game->beginPlayerAction();
    $game->giveTheCards($p2Pass);
    $game->endPlayerAction();

    $p3Pass = self::getCardIds([[1, 11], [3, 11], [4, 11]]);
    $game->setCurrentPlayerId(self::P3);
    $game->beginPlayerAction();
    $game->giveTheCards($p3Pass);
    $game->endPlayerAction();

    $game->setCurrentPlayerId(self::P0);
  }

  /**
   * Scenario 3: "mahjong_wish"
   * In `playComboOpen` (`ST_PLAY_COMBO_OPEN`), P0 (`2385074`) is active and holds the Mahjong
   * (`type=4, type_arg=1`) + low singles, while P1 (`2385075`) holds a 9 (`type_arg=9`) and a Phoenix.
   * Playing Mahjong transitions to `mahjongPlay` -> `makeAWish(9)` -> P1 is forced to play the 9!
   */
  private static function setupMahjongWish(\Tichu $game): void
  {
    $hands = [
      self::P0 => [
        [4, 1], // Mahjong
        [1, 2],
        [1, 3],
        [1, 4],
        [1, 5],
        [1, 6],
        [1, 7],
        [1, 8],
        [1, 10],
        [1, 11],
        [1, 12],
        [1, 13],
        [1, 14],
        [3, 2],
      ],
      self::P1 => [
        [1, 9], // 9 Swords (must be played when wish=9)
        [2, 1], // Phoenix
        [2, 2],
        [2, 3],
        [2, 4],
        [2, 5],
        [2, 6],
        [2, 7],
        [2, 8],
        [2, 10],
        [2, 11],
        [2, 12],
        [2, 13],
        [2, 14],
      ],
      self::P2 => [
        [3, 3],
        [3, 4],
        [3, 5],
        [3, 6],
        [3, 7],
        [3, 8],
        [3, 10],
        [3, 11],
        [3, 12],
        [3, 13],
        [3, 14],
        [4, 2],
        [4, 3],
        [4, 4],
      ],
      self::P3 => [
        [4, 5],
        [4, 6],
        [4, 7],
        [4, 8],
        [2, 9],
        [3, 9],
        [4, 9],
        [4, 10],
        [4, 11],
        [4, 12],
        [4, 13],
        [4, 14],
        [1, 1], // Dragon
        [3, 1], // Dog
      ],
    ];

    self::bootToPlayComboOpen($game, $hands);
  }

  /**
   * Scenario 4: "phoenix_ambiguous"
   * In `playComboOpen` (`ST_PLAY_COMBO_OPEN`), P0 (`2385074`) is active and holds a 4-card run
   * `5, 6, 7, 8` (mixed suits) + Phoenix (`type=2, type_arg=1`).
   * Playing `[5, 6, 7, 8, Phoenix]` transitions to `phoenixPlay` (`ST_PHOENIX_PLAY`) with allowed
   * values `[9, 4]`, allowing testing both `cancelPhoenix` and `choosePhoenix(9)`.
   */
  private static function setupPhoenixAmbiguous(\Tichu $game): void
  {
    $hands = [
      self::P0 => [
        [2, 1], // Phoenix
        [1, 5], // 5 Swords
        [2, 6], // 6 Stars
        [3, 7], // 7 Pagodas
        [4, 8], // 8 Jade
        [1, 10], // Pair of 10s + Pair of 12s (also supports ambiguous Full House testing)
        [2, 10],
        [1, 12],
        [2, 12],
        [4, 1], // Mahjong
        [1, 2],
        [2, 3],
        [3, 4],
        [1, 14],
      ],
      self::P1 => [
        [1, 3],
        [1, 4],
        [2, 5],
        [3, 6],
        [4, 7],
        [1, 8],
        [1, 9],
        [3, 10],
        [1, 11],
        [3, 12],
        [1, 13],
        [2, 14],
        [2, 2],
        [3, 3],
      ],
    ];

    self::bootToPlayComboOpen($game, $hands);
  }

  /**
   * Scenario 5: "bomb_interrupt"
   * In `playCombo` (`ST_PLAY_COMBO`), P0 (`2385074`) just played a single Ace, P1 (`2385075`) is active,
   * and P2 (`2385076`) holds a 4-of-a-kind Bomb of four 7s (`type=1..4, type_arg=7`).
   * (P0 also holds a 4-of-a-kind Bomb of four 8s (`type=1..4, type_arg=8`)).
   * Allows testing out-of-turn `playBomb` -> `ST_PLAY_BOMB` -> `cancel` AND `playCombo` with the four 7s!
   */
  private static function setupBombInterrupt(\Tichu $game): void
  {
    $hands = [
      self::P0 => [
        [4, 1], // Mahjong
        [1, 14], // Ace Swords (to be played as lead single)
        [1, 8], // Bomb of four 8s in P0's hand
        [2, 8],
        [3, 8],
        [4, 8],
        [1, 2],
        [1, 3],
        [1, 4],
        [1, 5],
        [1, 6],
        [1, 9],
        [1, 10],
        [1, 11],
      ],
      self::P1 => [
        [2, 2],
        [2, 3],
        [2, 4],
        [2, 5],
        [2, 6],
        [2, 9],
        [2, 10],
        [2, 11],
        [2, 12],
        [2, 13],
        [2, 14],
        [3, 2],
        [3, 3],
        [3, 4],
      ],
      self::P2 => [
        [1, 7], // Bomb of four 7s in P2's hand
        [2, 7],
        [3, 7],
        [4, 7],
        [3, 5],
        [3, 6],
        [3, 9],
        [3, 10],
        [3, 11],
        [3, 12],
        [3, 13],
        [3, 14],
        [4, 2],
        [4, 3],
      ],
      self::P3 => [
        [4, 4],
        [4, 5],
        [4, 6],
        [4, 9],
        [4, 10],
        [4, 11],
        [4, 12],
        [4, 13],
        [4, 14],
        [1, 12],
        [1, 13],
        [1, 1], // Dragon
        [2, 1], // Phoenix
        [3, 1], // Dog
      ],
    ];

    self::bootToPlayComboOpen($game, $hands);

    // P0 plays the single Ace (1, 14) -> transitions to ST_PLAY_COMBO with P1 active
    $aceId = (string) self::getCardId(1, 14);
    $game->setCurrentPlayerId(self::P0);
    $game->beginPlayerAction();
    $game->playCombo([$aceId]);
    $game->endPlayerAction();
  }

  /**
   * Scenario 6: "dragon_gift"
   * In `playCombo` (`ST_PLAY_COMBO`), P0 (`2385074`) played the Dragon (`type=1, type_arg=1`, worth 25 pts)
   * on a 10-point King, P1 and P2 already passed, and P3 (`2385077`) is active.
   * When P3 passes, the game enters `confirmTrick` (`ST_CONFIRM_TRICK`) with P0 active, and when P0
   * calls `collect`, it enters `chooseDragonGift` (`ST_CHOOSE_DRAGON_GIFT`) with
   * `enemies: ["dashwood1", "dashwood3"]`!
   */
  private static function setupDragonGift(\Tichu $game): void
  {
    $hands = [
      self::P0 => [
        [4, 1], // Mahjong
        [1, 2], // 2 Swords (led first)
        [1, 1], // Dragon (played on P3's King)
        [1, 3],
        [1, 4],
        [1, 6],
        [1, 7],
        [1, 8],
        [1, 9],
        [1, 11],
        [1, 12],
        [1, 14],
        [2, 2],
        [2, 3],
      ],
      self::P1 => [
        [2, 4],
        [2, 6],
        [2, 7],
        [2, 8],
        [2, 9],
        [2, 11],
        [2, 12],
        [2, 14],
        [3, 2],
        [3, 3],
        [3, 4],
        [3, 6],
        [3, 7],
        [3, 8],
      ],
      self::P2 => [
        [3, 9],
        [3, 11],
        [3, 12],
        [3, 14],
        [4, 2],
        [4, 3],
        [4, 4],
        [4, 6],
        [4, 7],
        [4, 8],
        [4, 9],
        [4, 11],
        [4, 12],
        [4, 14],
      ],
      self::P3 => [
        [1, 13], // King Swords (10 pts)
        [1, 5],
        [2, 5],
        [3, 5],
        [4, 5],
        [1, 10],
        [2, 10],
        [3, 10],
        [4, 10],
        [2, 13],
        [3, 13],
        [4, 13],
        [2, 1], // Phoenix
        [3, 1], // Dog
      ],
    ];

    self::bootToPlayComboOpen($game, $hands);

    // P0 leads 2 Swords
    $twoId = (string) self::getCardId(1, 2);
    $game->setCurrentPlayerId(self::P0);
    $game->beginPlayerAction();
    $game->playCombo([$twoId]);
    $game->endPlayerAction();

    // P1 passes
    $game->setCurrentPlayerId(self::P1);
    $game->beginPlayerAction();
    $game->pass(true);
    $game->endPlayerAction();

    // P2 passes
    $game->setCurrentPlayerId(self::P2);
    $game->beginPlayerAction();
    $game->pass(true);
    $game->endPlayerAction();

    // P3 plays King Swords (1, 13) worth 10 pts
    $kingId = (string) self::getCardId(1, 13);
    $game->setCurrentPlayerId(self::P3);
    $game->beginPlayerAction();
    $game->playCombo([$kingId]);
    $game->endPlayerAction();

    // P0 plays Dragon (1, 1) worth 25 pts (total trick value = 35 pts)
    $dragonId = (string) self::getCardId(1, 1);
    $game->setCurrentPlayerId(self::P0);
    $game->beginPlayerAction();
    $game->playCombo([$dragonId]);
    $game->endPlayerAction();

    // P1 passes
    $game->setCurrentPlayerId(self::P1);
    $game->beginPlayerAction();
    $game->pass(true);
    $game->endPlayerAction();

    // P2 passes -> now P3 (2385077) is active in playCombo!
    $game->setCurrentPlayerId(self::P2);
    $game->beginPlayerAction();
    $game->pass(true);
    $game->endPlayerAction();

    $game->setCurrentPlayerId(self::P0);
  }

  /**
   * Scenario 7: "double_victory"
   * Near the end of a round where P0 (`2385074`, Team 0) is already `firstOutPlayer` (0 cards in hand),
   * P2 (`2385076`, Team 0 partner) is active in `playComboOpen` with only 1 card left in hand,
   * and P1/P3 still have cards. When P2 plays their last card, Team 0 achieves a Double Victory (+200 pts),
   * triggering `stEndRound` -> `tableWindow` & `newScores` -> `newRound`!
   */
  private static function setupDoubleVictory(\Tichu $game): void
  {
    $hands = [
      self::P0 => [],
      self::P1 => [
        [1, 2],
        [1, 3],
        [1, 4],
        [1, 6],
        [1, 7],
      ],
      self::P2 => [
        [1, 14], // Only 1 card left for P2 (Team 0 partner)
      ],
      self::P3 => [
        [2, 2],
        [2, 3],
        [2, 4],
        [2, 6],
        [2, 7],
      ],
    ];

    self::bootToPlayComboOpen($game, $hands);

    // Move remaining cards to 'captured' for P0 so P0 has 0 cards in hand and P2 has 1 card
    self::assignPlayerHands($hands, 'captured_p0');

    // Mark P0 as firstOutPlayer and make P2 active in playComboOpen
    $game->setGameStateValue('firstOutPlayer', self::P0);
    $game->setGameStateValue('secondOutPlayer', 0);
    $game->setGameStateValue('doubleVictory', -1);
    $game->gamestate->changeActivePlayer(self::P2);
    $game->setCurrentPlayerId(self::P2);
  }
}
