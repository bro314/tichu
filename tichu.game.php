<?php

use Bga\GameFramework\Table;
use Bga\GameFramework\UserException;
use Bga\GameFramework\VisibleSystemException;

require_once __DIR__ . "/modules/Constants.php";

/**
 * @method void sendNotifications()
 */
class Tichu extends Table
{
  public static Tichu $instance;

  /** @var array<int, array{name: string, nametr: string}> */
  public array $colors;
  /** @var array<int, string> */
  public array $values_label;
  /** @var array<int, string> */
  public array $specials_label;
  /** @var array<int, string> */
  public array $play_type;

  /**
   * Global row used as a table-wide change counter ("version") by acquireGameLock().
   * Every request that changes game data shared between players increments it.
   */
  const GLOBAL_LOCK_VERSION = 30;

  /** Whether this request already holds the MySQL advisory lock (see initTable()). */
  private bool $advisoryLockHeld = false;
  /** Whether this request already holds the table lock (see acquireGameLock()). */
  private bool $gameLockHeld = false;
  /** Whether this request's consistent snapshot / cached game state is outdated. */
  private bool $gameLockStale = false;
  /** Whether this request already incremented the version row. */
  private bool $gameVersionBumped = false;
  /** State id and active player as read with the lock held (latest committed values). */
  private int $freshStateId = 0;
  private int $freshActivePlayerId = 0;
  /** Lock version loaded into `$this->gamestate` during Table::setTable() before initTable(). */
  private ?int $initialLockVersion = null;
  private int $lockedVersion = 0;
  private int $zombieStepsInRequest = 0;
  /** @var array<int, bool> */
  private array $zombieLoggedInRequest = [];

  function __construct()
  {
    parent::__construct();
    self::$instance = $this;
    $this->bSelectGlobalsForUpdate = true;
    Combo::$noCombo = new Combo([], NO_COMBO);

    $this->initGameStateLabels([
      // globals
      "firstOutPlayer" => 21, // first player getting rid of his cards
      "secondOutPlayer" => 22, // second player getting rid of his cards
      "doubleVictory" => 23, // team scoring a double victory
      "mahjongWish" => 26, // value wished by Mahjong Owner
      "mahjongOwner" => 27, // Mahjong Owner, 0 when wish is granted
      "isAllInfoExposed" => 28, // Should the played card be shown and players smartly skipped? 0=FALSE, 1=TRUE
      // 29 was used by a legacy version for the phoenix value (see upgradeTableDb).
      "lockVersion" => self::GLOBAL_LOCK_VERSION, // table-wide change counter, see acquireGameLock()

      //options
      "gameLength" => 100, // 1 = 500pts, 2 = 1000pts, 3 = 2000pts
      "playerTeams" => 101, // 1 = 13 vs 24, 2 = 12 vs 34, 3 = 14 vs 23, 4 = random
      "gameVariant" => 102, // 1 = tichu standard
    ]);
  }

  //////////////////////////////////////////////////////////////////////////////
  //////////// Concurrency control
  ////////////
  //
  // Two requests on the same table can overlap (two tabs auto-collecting, a bomb or Tichu call
  // arriving while the active player plays, or 4 players betting/passing simultaneously).
  //
  // Protocol (see AGENTS.md & .agents/skills/tichu-concurrency-locks/SKILL.md):
  //  1. `$this->bSelectGlobalsForUpdate = true` locks `global` rows at the start of the request so
  //     concurrent requests do not trigger InnoDB SERIALIZABLE shared-to-exclusive deadlock upgrades.
  //  2. `initTable()` acquires a session-level MySQL advisory lock (`GET_LOCK('tichu_table_<id>', 20)`)
  //     and switches the session isolation level to `REPEATABLE-READ`.
  //  3. Every mutating entry point calls `acquireGameLock()` BEFORE any other DB statement to lock
  //     the entire `global` table (`WHERE 1 FOR UPDATE`) in ascending PK order matching
  //     `TableInfos::getGlobalsFromDB(true)` (preventing `global(1) -> global(0)` vs `global(0) -> global(1)`
  //     AB-BA deadlocks with concurrent requests) and reject stale snapshots via `lockVersion` (30).
  //  4. Out-of-turn player-local actions (Tichu bets, passing cards, autopass toggles) rely on the
  //     row lock rather than failing on `lockVersion`; duplicate `collect` requests are ignored.
  //  5. Every shared-state mutation calls `bumpGameVersion()` so overlapping requests detect changes.

  protected function initTable(): void
  {
    $this->acquireAdvisoryLock();
  }

  private function acquireAdvisoryLock(): void
  {
    if ($this->advisoryLockHeld) {
      return;
    }
    $this->advisoryLockHeld = true;
    $this->initialLockVersion =
      isset($this->gamestate) && is_array($this->gamestate->table_globals ?? null)
        ? (int) $this->getGameStateValue("lockVersion", 0)
        : null;
    // Release any InnoDB locks acquired before initTable() (e.g. Table::setTable() locking
    // `global`/`player` under SERIALIZABLE) before waiting on GET_LOCK, so an overlapping
    // request inside Studio's debugSaveState(4) snapshot dump after DbCommit() cannot deadlock
    // against us in AB-BA order across GET_LOCK and InnoDB row locks.
    $this->DbQuery("COMMIT");
    $this->DbQuery("SET SESSION transaction_isolation = 'REPEATABLE-READ'");
    $tableId = max(1, (int) ($this->table_id ?? 1));
    $acquired = $this->getUniqueValueFromDB("SELECT GET_LOCK('tichu_table_{$tableId}', 10)");
    if ((int) $acquired !== 1) {
      $this->logProdWarn("advisory_lock_timeout", ["acquired" => $acquired]);
    }
    // Start a fresh REPEATABLE-READ transaction & consistent snapshot now that GET_LOCK is held
    // (on Studio, debugSaveState(4) commits this empty transaction, runs snapshot dump under
    // GET_LOCK, and calls begin(); on Production, no framework begin() runs after initTable()).
    $this->DbQuery("START TRANSACTION WITH CONSISTENT SNAPSHOT");
  }

  /**
   * Serializes this request with all other mutating requests of the table.
   * Must be called before any other DB statement of a mutating entry point. Re-entrant.
   */
  public function acquireGameLock(): void
  {
    if ($this->gameLockHeld) {
      return;
    }
    $this->acquireAdvisoryLock();
    $lockedGlobals = $this->getCollectionFromDB(
      "SELECT global_id, global_value FROM global WHERE 1 FOR UPDATE",
      true
    );
    $this->gameLockHeld = true;
    $this->freshStateId = (int) ($lockedGlobals[1] ?? 0);
    $this->freshActivePlayerId = (int) ($lockedGlobals[2] ?? 0);
    $versionId = self::GLOBAL_LOCK_VERSION;
    $currentVersion = (int) ($lockedGlobals[$versionId] ?? 0);
    $this->lockedVersion = $currentVersion;
    $snapshotVersion = (int) ($this->getUniqueValueFromDB(
      "SELECT global_value FROM global WHERE global_id = $versionId"
    ) ?? 0);
    $loadedVersion =
      $this->initialLockVersion ??
      (isset($this->gamestate) ? (int) $this->getGameStateValue("lockVersion", 0) : $currentVersion);
    $this->gameLockStale =
      $this->freshStateId !== (int) $this->gamestate->getCurrentMainStateId() ||
      $this->freshActivePlayerId !== (int) $this->getActivePlayerId() ||
      $currentVersion !== $snapshotVersion ||
      $currentVersion !== $loadedVersion;
  }

  /**
   * Like acquireGameLock(), but rejects the request if it was processed against an outdated
   * view of the game, and marks the game as changed.
   */
  public function acquireGameLockOrFail(): void
  {
    $this->acquireGameLock();
    if ($this->gameLockStale) {
      $this->throwGameStateChanged();
    }
    $this->bumpGameVersion();
  }

  /**
   * Re-acquires the full `global` row lock in ascending PK order after a framework
   * CommitAllAndRestart() (such as GamestateMachine::jumpToState(ST_GAME_END)), so
   * end-of-request sendNotifications() (global_id=3) -> setGlobal(0, time()) cannot
   * AB-BA deadlock with concurrent requests' TableInfos::db_load(FOR UPDATE) (0 -> 3).
   */
  private function relockGlobalsAfterFrameworkCommit(): void
  {
    $this->getCollectionFromDB(
      "SELECT global_id, global_value FROM global WHERE 1 FOR UPDATE",
      true
    );
  }

  /** Increments the table-wide version row (at most once per request). */
  public function bumpGameVersion(): void
  {
    $this->acquireGameLock();
    if ($this->gameVersionBumped) {
      return;
    }
    $versionId = self::GLOBAL_LOCK_VERSION;
    $this->DbQuery("UPDATE global SET global_value = global_value + 1 WHERE global_id = $versionId");
    if ($this->DbAffectedRow() == 0) {
      // Games started before the version row existed. Safe: we hold the table lock.
      $this->DbQuery("INSERT INTO global (global_id, global_value) VALUES ($versionId, 1)");
      $nextVersion = 1;
    } else {
      $nextVersion = $this->lockedVersion + 1;
    }
    $this->lockedVersion = $nextVersion;
    $this->initialLockVersion = $nextVersion;
    if (isset($this->gamestate) && is_array($this->gamestate->table_globals ?? null)) {
      $this->gamestate->table_globals[$versionId] = $nextVersion;
    }
    $this->gameVersionBumped = true;
  }

  public function isGameLockStale(): bool
  {
    return $this->gameLockStale;
  }

  /**
   * Refreshes cached TableInfos & GamestateMachine from the post-GET_LOCK snapshot when an
   * action accepts a stale request without calling gamestate->nextState(), so Table::checkReturnState()
   * never inspects outdated pre-lock state (e.g. intermediate game state 50 on duplicate collect).
   */
  private function syncStaleReturnState(): void
  {
    if (!$this->gameLockStale) {
      return;
    }
    $this->reloadPlayersBasicInfos();
    $this->gamestate->reloadState();
  }

  public function refreshLockStateAfterBotStep(): void
  {
    if (isset($this->gamestate)) {
      $this->freshStateId = (int) $this->gamestate->getCurrentMainStateId();
      $this->freshActivePlayerId = (int) $this->getActivePlayerId();
    }
    if (method_exists($this, "sendNotifications")) {
      $this->sendNotifications();
    }
  }

  /** Called by the local backend at the end of every emulated request. */
  public function onRequestEnd(): void
  {
    $this->advisoryLockHeld = false;
    $this->gameLockHeld = false;
    $this->gameLockStale = false;
    $this->gameVersionBumped = false;
    $this->initialLockVersion = null;
    $this->lockedVersion = 0;
    $this->zombieStepsInRequest = 0;
    $this->zombieLoggedInRequest = [];
  }

  private function throwGameStateChanged(): void
  {
    $this->logProdWarn("stale_lock_rejected", [
      "snapshotState" => (int) $this->gamestate->getCurrentMainStateId(),
      "snapshotActive" => (int) $this->getActivePlayerId(),
    ]);
    throw new UserException(
      clienttranslate(
        "The game changed while your action was being processed. Please check and try again."
      )
    );
  }

  /**
   * Emit a structured warning to BGA's production error log (`game_err_tichu.log`).
   * Only call on unexpected invariant violations, lock anomalies, or zombie fallbacks.
   *
   * @param array<string, mixed> $context
   */
  private function logProdWarn(string $event, array $context = []): void
  {
    $tableId = (int) ($this->table_id ?? 0);
    $json = json_encode($context);
    $suffix = $json !== false && $json !== "[]" && $json !== "{}" ? " " . $json : "";
    $this->warn(
      "[tichu:{$event}] table={$tableId} state={$this->freshStateId} active={$this->freshActivePlayerId}{$suffix}"
    );
  }

  /** Reads whether a player is (still) multiactive, with the table lock held. */
  private function isPlayerMultiactiveFresh(int $playerId): bool
  {
    return (int) $this->getUniqueValueFromDB(
      "SELECT player_is_multiactive FROM player WHERE player_id = $playerId FOR UPDATE"
    ) === 1;
  }

  /**
   * Validates a multiactive action (Grand Tichu bet, passing cards, legacy accept) against
   * the latest committed data. Other players acting at the same time only change their own
   * rows, so a stale snapshot is acceptable here, as long as the player is still active.
   */
  private function checkMultiactiveActionFresh(int $playerId, int $stateId, string $action): void
  {
    $this->acquireGameLock();
    if (!$this->gameLockStale) {
      $this->checkAction($action); // regular framework validation (snapshot is current)
    } elseif ($this->freshStateId !== $stateId) {
      $this->throwGameStateChanged();
    }
    if (!$this->isPlayerMultiactiveFresh($playerId)) {
      throw new UserException(clienttranslate("You have already made your choice"));
    }
    $this->bumpGameVersion();
  }

  /**
   * setPlayerNonMultiactive() that is safe when this request's snapshot is stale: the
   * framework's "is anybody still active?" check might then see players as active who already
   * acted in a concurrent request, and the game would never leave the multiactive state.
   *
   * @param bool $staleTransitionSafe whether the next state's actions may run on a stale
   *   snapshot (true only if they do not read data written by the other players in this state)
   */
  private function setPlayerNonMultiactiveSafe(
    int $playerId,
    string $transition,
    bool $staleTransitionSafe
  ): void {
    if (!$this->gameLockStale) {
      $this->gamestate->setPlayerNonMultiactive($playerId, $transition);
      return;
    }
    $otherActiveIds = array_values(
      array_map(
        "strval",
        $this->getObjectListFromDB(
          "SELECT player_id FROM player WHERE player_is_multiactive = 1 AND player_id <> $playerId FOR UPDATE",
          true
        )
      )
    );
    if (count($otherActiveIds) > 0) {
      // On a stale REPEATABLE-READ snapshot, GamestateMachine::setPlayerNonMultiactive() ->
      // updateMultiactiveOrNextState() -> reflexionTimeUpdate() -> state() -> loadMultipleActive(false)
      // reloads the stale snapshot and broadcasts a gameStateMultipleActiveUpdate notification that
      // re-includes players who already acted in an earlier committed transaction. Update this player's
      // row directly and broadcast the authoritative locked active player list instead.
      $this->DbQuery("UPDATE player SET player_is_multiactive = 0 WHERE player_id = $playerId");
      $this->notifyAllPlayers("gameStateMultipleActiveUpdate", "", $otherActiveIds);
      $this->syncStaleReturnState();
      return;
    }
    if (!$staleTransitionSafe) {
      $this->throwGameStateChanged();
    }
    $this->DbQuery("UPDATE player SET player_is_multiactive = 0 WHERE player_id = $playerId");
    $this->gamestate->nextState($transition);
  }

  /**
   * setupNewGame:
   *
   * This method is called only once, when a new game is launched.
   * In this method, you must setup the game according to the game rules, so that
   * the game is ready to be played.
   *
   * @param array<int|string, array<string, mixed>> $players
   * @param array<int|string, mixed> $options
   * @return int
   */
  protected function setupNewGame($players, $options = [])
  {
    $sql = "DELETE FROM player WHERE 1 ";
    $this->DbQuery($sql);

    PlayerManager::setupPlayers($players);
    $this->reloadPlayersBasicInfos();
    CardManager::setupCards();

    // Init globals
    $this->setGameStateInitialValue("firstOutPlayer", 0);
    $this->setGameStateInitialValue("secondOutPlayer", 0);
    $this->setGameStateInitialValue("doubleVictory", -1);
    $this->setGameStateInitialValue("mahjongWish", 0);
    $this->setGameStateInitialValue("mahjongOwner", 0);
    $this->setGameStateInitialValue("isAllInfoExposed", $this->bga->tableOptions->isTurnBased() ? 1 : 0);
    $this->setGameStateInitialValue("lockVersion", 0);

    // Init statistics
    $this->initStat("table", "round_number", 0);
    $this->initStat("table", "trick_number", 0);
    $this->initStat("player", "tricks_win", 0);
    $this->initStat("player", "bomb_number", 0);
    $this->initStat("player", "tichu_number", 0);
    $this->initStat("player", "grandtichu_number", 0);
    $this->initStat("player", "tichu_won_number", 0);
    $this->initStat("player", "grandtichu_won_number", 0);
    $this->initStat("player", "bombs_completed_by_partner", 0);

    $this->activeNextPlayer();

    return \ST_NEW_ROUND;
  }

  /**
   * Returns true, if the game is turn based now and was also turn based when the game was
   * started.
   */
  public function isAllInfoExposed(): bool
  {
    // In the future we can just return the "isAllInfoExposed" game state. We are only setting
    // a default value for migrating in-progress games correctly.
    return $this->getGameStateValue("isAllInfoExposed", $this->bga->tableOptions->isTurnBased() ? 1 : 0) == 1;
  }

  /**
   * getAllDatas:
   *
   * Gather all informations about current game situation (visible by the current player).
   *
   * The method is called each time the game interface is displayed to a player, ie:
   * _ when the game starts
   * _ when a player refreshes the game page (F5)
   *
   * @return array<string, mixed>
   */
  protected function getAllDatas(int $currentPlayerId): array
  {
    $deck = CardManager::getDeck();
    $players = PlayerManager::getPlayers();
    $names = [];
    $result = [];
    foreach ($players as $player) {
      $names[$player["no"]] = $player["name"];
    }
    foreach ($players as &$player) {
      if ($player["id"] != $currentPlayerId) {
        // hide secret fields
        unset($player["pass"]);
      }
    }
    unset($player);

    $result["players"] = Utils::parseInt($players, ["id", "no"]);

    $result["hand"] = array_values(CardManager::getCardsInLocation("hand", $currentPlayerId));
    $result["hasPlayedOrPassedInRound"] = LogManager::hasPlayerPlayedOrPassedInCurrentRound(
      $currentPlayerId
    );
    $result["handcount"] = $deck->countCardsByLocationArgs("hand");
    $result["capturedpoints"] = CardManager::calculateCapturedPoints();
    $result["firstoutplayer"] = intval($this->getGameStateValue("firstOutPlayer"));
    $result["mahjongOwner"] = intval($this->getGameStateValue("mahjongOwner"));
    $result["mahjongWish"] = intval($this->getGameStateValue("mahjongWish"));
    $isAllInfoExposed = (bool) $this->isAllInfoExposed();
    $result["isAllInfoExposed"] = $isAllInfoExposed ? 1 : 0;

    $lastCombo = LogManager::getLastCombo();
    $result["lastComboPlayer"] = $lastCombo->player;
    $result["lastComboDescription"] = $lastCombo->description;
    $result["lastCombo"] = [
      "player" => $lastCombo->player,
      "type" => (int) $lastCombo->type,
      "cards" => $lastCombo->cards ?? [],
      "phoenixValue" => $lastCombo->phoenixValue,
      "description" => $lastCombo->description ?? "",
    ];

    list($lastCombos, $passes) = LogManager::getLastCombos();
    $result["allLastCombos"] = $lastCombos;
    $result["passes"] = $passes;

    $result["capturedCards"] = $isAllInfoExposed
      ? array_values($deck->getCardsInLocation("captured"))
      : [];

    $currentTrick = array_values($deck->getCardsInLocation("combos"));
    $result["currentTrick"] = $currentTrick;
    $result["currentTrickValue"] = CardManager::getTrickValue($currentTrick);

    $roundAndTrick = LogManager::getCurrentRoundAndTrick();
    $result["round"] = $roundAndTrick["round"] ?? 0;
    $result["trick"] = $roundAndTrick["trick"] ?? 0;
    $result["gameVersion"] = intval($this->getGameStateValue("game_db_version", 0));
    $result["codeVersion"] = TICHU_CODE_VERSION;

    return $result;
  }

  /*
			getGameProgression:

			Compute and return the current game progression.
			The number returned must be an integer beween 0 (=the game just started) and
			100 (= the game is finished or almost finished).

			This method is called each time we are in a game state with the "updateGameProgression" property set to true
			(see states.inc.php)
	*/
  function getGameProgression()
  {
    $gameLengthIdx = max(0, min(2, (int) $this->getGameStateValue("gameLength") - 1));
    $p = [5, 10, 20][$gameLengthIdx];
    return (int) round(min(100, PlayerManager::getHighestScore() / $p));
  }

  /**
   * @deprecated Pass explicit player ID instead of relying on session state.
   */
  public static function getCurrentId(): int|string
  {
    return self::$instance->getCurrentPlayerId();
  }

  /**
   * @param array<int|string, array<string, mixed>> $cards
   */
  function checkMahjongWishFulfillment(
    int|string $playerId,
    array $cards,
    ?Combo $lastCombo,
    ?Hand $currentHand = null
  ): void {
    $wish = (int) $this->getGameStateValue("mahjongWish");
    if ($wish != 0 && !in_array($wish, array_column($cards, "type_arg"))) {
      if ($currentHand === null) {
        $cardsInHand = CardManager::getDeck()->getCardsInLocation("hand", (int) $playerId);
        $currentHand = new Hand($cardsInHand);
      }
      if ($currentHand->canFulFillWish($wish, $lastCombo)) {
        $rankStr = CardManager::cardToStr($wish);
        $args = ["rank" => $rankStr];
        if (CardManager::isTranslatableCardStr($wish)) {
          $args["i18n"] = ["rank"];
        }
        throw new UserException(
          new \Bga\GameFramework\NotificationMessage(
            clienttranslate('You must grant the Mahjong Wish and play a ${rank}'),
            $args
          )
        );
      }
    }
  }

  function completePlayCombo(int|string $playerId, Combo $combo): void
  {
    $player = PlayerManager::getPlayer($playerId);
    $wish = $this->getGameStateValue("mahjongWish");
    $cards = $combo->cards ?? [];
    $cardIds = array_column($cards, "id");
    $deck = CardManager::getDeck();
    $cardsInHand = $deck->getCardsInLocation("hand", (int) $playerId);
    $currentHand = new Hand($cardsInHand);
    $lastCombo = LogManager::getLastCombo();

    if ($combo->type == DOG_COMBO && $lastCombo->type != NO_COMBO) {
      throw new UserException(clienttranslate("the Dog can only be played as a lead"));
    }
    if (!$combo->canBeat($lastCombo)) {
      throw new UserException(clienttranslate("This combo can't beat the last combo"));
    }

    $wishGranted = false;
    if ($wish != 0) {
      if (in_array($wish, array_column($cards, "type_arg"))) {
        $wishGranted = true;
      } else {
        $isNonLeadBomb =
          $combo->type == BOMB_COMBO &&
          $lastCombo->type != NO_COMBO &&
          $lastCombo->type != DOG_COMBO;
        if (!$isNonLeadBomb) {
          $this->checkMahjongWishFulfillment($playerId, $cards, $lastCombo, $currentHand);
        }
      }
    }

    $hasComboPhoenix =
      (int) $combo->type !== SINGLE_COMBO &&
      $combo->hasPhoenix() &&
      $combo->phoenixValue !== null &&
      !is_array($combo->phoenixValue);

    if ($wishGranted && $hasComboPhoenix) {
      $notification_description = clienttranslate(
        '${player_name} plays ${combo_name}, Phoenix as ${phoenix_rank}, and grants Mahjong\'s owner wish'
      );
    } elseif ($wishGranted) {
      $notification_description = clienttranslate(
        '${player_name} plays ${combo_name} and grants Mahjong\'s owner wish'
      );
    } elseif ($hasComboPhoenix) {
      $notification_description = clienttranslate(
        '${player_name} plays ${combo_name}, Phoenix as ${phoenix_rank}'
      );
    } else {
      $notification_description = clienttranslate('${player_name} plays ${combo_name}');
    }

    LogManager::playCombo($playerId, $combo);
    if ($lastCombo->type == NO_COMBO) {
      PlayerManager::setAutopass(0);
    }
    if ($wishGranted) {
      $this->setGameStateValue("mahjongWish", 0);
      NotificationManager::mahjongGranted();
    }

    $playerName = (string) ($player["name"] ?? $this->getActivePlayerName());
    if (count($cardsInHand) == 14 && ($player["call_tichu"] ?? -1) == -1) {
      PlayerManager::tichuBet($playerId, 0);
      NotificationManager::tichuBet($playerId, $playerName, 0);
    }

    NotificationManager::playCombo(
      $playerId,
      $playerName,
      $combo,
      $notification_description
    );
    $deck->moveCards($cardIds, "combos");

    if ($combo->type == BOMB_COMBO) {
      $this->incStat(1, "bomb_number", (int) $playerId);
    }

    if ($combo->hasMahjong()) {
      $this->gamestate->nextState("mahjongPlayed");
    } else {
      $this->gamestate->nextState("nextPlayer");
    }
  }

  function chooseDragonGift(int|string $playertogive, bool $checkAction = true): void
  {
    $this->acquireGameLockOrFail();
    if ($checkAction) {
      $this->checkAction("chooseDragonGift");
    }
    $playertogive = (int) $playertogive;
    if ($playertogive !== 0 && $playertogive !== 1) {
      throw new UserException(clienttranslate("Invalid player choice"));
    }
    $players = PlayerManager::getPlayers();
    $trickWinner = LogManager::getLastComboPlayer();
    $nextPlayers = PlayerManager::getNextPlayers($trickWinner);
    $dragonGivenToId = $nextPlayers[$playertogive * 2]["id"];

    $this->incStat(1, "tricks_win", (int) $trickWinner);
    $deck = CardManager::getDeck();

    $cardsCaptured = $deck->getCardsInLocation("combos");
    $trickValue = CardManager::getTrickValue($cardsCaptured);

    $deck->moveAllCardsInLocation("combos", "captured", null, (int) $dragonGivenToId);
    LogManager::insert($trickWinner, "chooseDragonGift", [
      "recipient" => (int) $dragonGivenToId,
      "trickValue" => (int) $trickValue,
    ]);

    NotificationManager::log(clienttranslate('${player_name} wins the trick'), [
      "player_name" => $players[$trickWinner]["name"],
    ]);
    NotificationManager::captureCards(
      $dragonGivenToId,
      $players[$dragonGivenToId]["name"],
      $trickValue
    );

    $inPlay = array_keys($deck->countCardsByLocationArgs("hand"));
    $doubleVic =
      count($inPlay) == 2 && $players[$inPlay[0]]["team"] == $players[$inPlay[1]]["team"];
    if ($doubleVic) {
      $this->setGameStateValue("doubleVictory", 1 - $players[$inPlay[0]]["team"]);
    }
    if (count($inPlay) == 1 || $doubleVic) {
      $this->gamestate->nextState("endRound");
    } else {
      $this->gamestate->nextState("newTrick");
    }
  }

  /**
   * @param array<int|string, array<string, mixed>> $cards
   */
  function checkCardsInHand(array $cards, int|string $player_id): void
  {
    foreach ($cards as $card) {
      if ($card["location"] != "hand" || $card["location_arg"] != $player_id) {
        throw new UserException(clienttranslate("Some of these cards are not in your hand"));
      }
    }
  }

  /**
   * @param array<int, int|string> $card_ids
   */
  function giveTheCards(array $card_ids, int|string|null $player_id = null): void
  {
    if ($player_id === null) {
      $player_id = (int) $this->getCurrentPlayerId();
      $this->checkMultiactiveActionFresh($player_id, ST_GIVE_CARDS, "giveCards");
    } else {
      $this->acquireGameLockOrFail();
    }

    if (count($card_ids) != 3) {
      throw new UserException(clienttranslate("You must give exactly 3 cards"));
    }

    $intCardIds = array_values(array_map("intval", $card_ids));
    try {
      $cards = CardManager::getDeck()->getCards($intCardIds);
    } catch (\feException $e) {
      throw new UserException(clienttranslate("Some of these cards don't exist"));
    }
    if (count($cards) != 3) {
      throw new UserException(clienttranslate("Some of these cards don't exist"));
    }
    $this->checkCardsInHand($cards, $player_id);

    $nextPlayers = PlayerManager::getNextPlayers($player_id, true);
    CardManager::setPassedCards($card_ids, $player_id);
    foreach ($card_ids as $idx => $cardId) {
      CardManager::getDeck()->moveCard(
        (int) $cardId,
        "temporary",
        (int) $nextPlayers[$idx]["id"]
      );
    }
    LogManager::insert($player_id, "giveCards", [
      "cards" => $intCardIds,
      "recipients" => [
        (int) $nextPlayers[0]["id"],
        (int) $nextPlayers[1]["id"],
        (int) $nextPlayers[2]["id"],
      ],
    ]);
    NotificationManager::passCards($player_id, $card_ids);

    // legacy: $this->gamestate->setPlayerNonMultiactive($player_id, "showPassedCards");
    // The last player's request accepts the passed cards of everybody (stAcceptPassedCards),
    // which must not run on a stale snapshot.
    $this->setPlayerNonMultiactiveSafe((int) $player_id, "acceptPassedCards", false);
  }

  /**
   * @param array<int, int|string> $cards_ids
   */
  function playBomb(array $cards_ids): void
  {
    $this->acquireGameLockOrFail();
    $name = $this->gamestate->getCurrentMainState()->name;
    if ($name != "playCombo" && $name != "confirmTrick") {
      throw new UserException(clienttranslate("You can't play a bomb right now"));
    }

    $playerId = $this->getCurrentPlayerId();
    if (CardManager::getDeck()->countCardInLocation("hand", (int) $playerId) < 4) {
      throw new UserException(clienttranslate("You cannot play a bomb now"));
    }

    $lastCombo = LogManager::getLastCombo();
    if (
      ($name === "playCombo" && $lastCombo->type == NO_COMBO) ||
      ($lastCombo->type == NO_COMBO && $playerId != $this->getActivePlayerId())
    ) {
      throw new UserException(clienttranslate('You can\'t bomb before the trick starts'));
    }

    if ($lastCombo->type == DOG_COMBO && $playerId != $this->getActivePlayerId()) {
      throw new UserException(clienttranslate('You can\'t bomb the dog'));
    }

    LogManager::insert($this->getCurrentPlayerId(), "changePlayer", [
      "transition" => "playBomb",
      "active" => $this->getActivePlayerId(),
      "last" => $name,
    ]);
    $this->gamestate->nextState("changePlayer");
  }

  function choosePhoenix(int|string|null $phoenixValue, bool $checkAction = true): void
  {
    $this->acquireGameLockOrFail();
    if ($checkAction) {
      $this->checkAction("phoenixPlay");
    }
    $pId = $this->getActivePlayerId();
    $combo = LogManager::getLastCombo(0, "phoenix");
    if ($phoenixValue === null || $phoenixValue === "" || !is_numeric($phoenixValue)) {
      throw new UserException(
        clienttranslate("You have chosen an invalid value for the phoenix, choose a new hand")
      );
    }
    $phoenixValue = (int) $phoenixValue;
    $allowedValues = is_array($combo->phoenixValue)
      ? array_map("intval", $combo->phoenixValue)
      : [];
    if (!in_array($phoenixValue, $allowedValues, true)) {
      throw new UserException(
        clienttranslate("You have chosen an invalid value for the phoenix, choose a new hand")
      );
    }
    $combo->setPhoenixValue($phoenixValue);
    $this->completePlayCombo($pId, $combo);
  }

  /**
   * @param array<int, int|string> $cards_ids
   */
  function playCombo(
    array $cards_ids,
    bool $checkAction = true,
    int|string|null $player_id = null
  ): void {
    $this->acquireGameLockOrFail();
    if ($checkAction) {
      $this->checkAction("playCombo");
    }
    $playerId = $player_id !== null ? (int) $player_id : (int) $this->getCurrentPlayerId();
    if (empty($cards_ids)) {
      throw new UserException(clienttranslate("You must select at least one card"));
    }
    if (count($cards_ids) != count(array_unique($cards_ids))) {
      throw new UserException(clienttranslate("You don't have all these cards in your hand"));
    }
    $intCardIds = array_values(array_map("intval", $cards_ids));
    try {
      $cards = array_values(CardManager::getDeck()->getCards($intCardIds));
    } catch (\feException $e) {
      throw new UserException(clienttranslate("You don't have all these cards in your hand"));
    }
    if (count($cards) != count(array_unique($cards_ids))) {
      throw new UserException(clienttranslate("You don't have all these cards in your hand"));
    }
    $this->checkCardsInHand($cards, $playerId);

    $combo = new Combo($cards);
    if ($combo->type == INVALID_COMBO) {
      throw new UserException(clienttranslate("You must play a valid combo"));
    }
    if ($this->gamestate->getCurrentMainState()->name == "playBomb" && $combo->type != BOMB_COMBO) {
      throw new UserException(clienttranslate("This is not a valid bomb"));
    }
    if (is_array($combo->phoenixValue)) {
      $combo->recheckPhoenix();
    }

    if (is_array($combo->phoenixValue)) {
      $this->checkMahjongWishFulfillment($playerId, $cards, LogManager::getLastCombo());
      LogManager::askPhoenix($playerId, $combo);
      $this->gamestate->nextState("phoenixPlay");
    } else {
      $this->completePlayCombo($playerId, $combo);
    }
  }

  function pass(bool|int|string|null $onlyOnce, int|string|null $player_id = null): void
  {
    if ($player_id === null) {
      $this->acquireGameLock();
      $player_id = (int) $this->getCurrentPlayerId();
      if ($player_id != $this->freshActivePlayerId) {
        if ($this->gameLockStale && $player_id == (int) $this->getActivePlayerId()) {
          // The player passed on their turn, but a concurrent request (e.g. the same pass from
          // another tab) already moved the game on. Don't turn this into an autopass setting.
          $this->throwGameStateChanged();
        }
        // Autopass (out of turn): decided on data read with the lock held, so it is safe even if
        // this request's snapshot is stale. It only changes the player's own autopass flag, which
        // stNextPlayer() reads freshly, so it does not bump the version either.
        $handCount = (int) $this->getUniqueValueFromDB(
          "SELECT COUNT(*) FROM card WHERE card_location = 'hand' AND card_location_arg = $player_id FOR UPDATE"
        );
        if (!in_array($this->freshStateId, [ST_PLAY_COMBO, ST_CONFIRM_TRICK]) || $handCount == 0) {
          throw new UserException(clienttranslate("You cannot pass now"));
        }
        PlayerManager::setAutopass($onlyOnce ? 1 : 2, $player_id);
        NotificationManager::autopass($onlyOnce ? 1 : 2, $player_id);
        $this->syncStaleReturnState();
        return;
      }
    } else {
      $player_id = (int) $player_id;
    }

    $this->acquireGameLockOrFail();
    $name = $this->gamestate->getCurrentMainState()->name;
    if ($name != "playCombo") {
      throw new UserException(clienttranslate("You cannot pass now"));
    }
    if ($player_id !== (int) $this->getActivePlayerId()) {
      throw new UserException(clienttranslate("This is not your turn"));
    }

    $currentMahjongWish = (int) $this->getGameStateValue("mahjongWish");
    if ($currentMahjongWish > 0) {
      $cardsInHand = CardManager::getDeck()->getPlayerHand($player_id);
      $hand = new Hand($cardsInHand);
      if ($hand->canFulFillWish($currentMahjongWish, LogManager::getLastCombo())) {
        $rankStr = CardManager::cardToStr($currentMahjongWish);
        $args = ["rank" => $rankStr];
        if (CardManager::isTranslatableCardStr($currentMahjongWish)) {
          $args["i18n"] = ["rank"];
        }
        throw new UserException(
          new \Bga\GameFramework\NotificationMessage(
            clienttranslate('You must grant the Mahjong Wish and play a ${rank}'),
            $args
          )
        );
      }
    }

    LogManager::insert($player_id, "pass");
    $pRow = PlayerManager::getPlayer($player_id);
    $playerName = $pRow["name"] ?? $this->getActivePlayerName();
    NotificationManager::pass($player_id, $playerName);
    if (!$onlyOnce) {
      PlayerManager::setAutopass(2, $player_id);
      NotificationManager::autopass(2, $player_id);
    }
    $this->gamestate->nextState("nextPlayer");
  }

  function cancelAutopass(): void
  {
    // Only changes the player's own autopass flag (read freshly by stNextPlayer()), so neither
    // a stale snapshot nor a version bump matters. The lock still orders it with other requests.
    $this->acquireGameLock();
    PlayerManager::setAutopass(0, $this->getCurrentPlayerId());
    NotificationManager::autopass(0, $this->getCurrentPlayerId());
    $this->syncStaleReturnState();
  }

  function cancel(bool $checkAction = true): void
  {
    $this->acquireGameLockOrFail();
    if ($checkAction) {
      $this->checkAction("cancel");
    }
    $action = LogManager::getLastAction("changePlayer");
    LogManager::insert($action["arg"]["active"], "changePlayer", [
      "transition" => $action["arg"]["last"],
    ]);
    $this->gamestate->nextState("changePlayer");
  }

  private function hasPartnerBetInCurrentRound(int $playerId): bool
  {
    $partner = PlayerManager::getPartnerForUpdate($playerId);
    if ($partner === null) {
      return false;
    }
    return (int) ($partner["call_tichu"] ?? -1) === 100 ||
      (int) ($partner["call_grand_tichu"] ?? -1) === 200;
  }

  function grandTichuBet(
    int|string $bet,
    bool $confirmed = false,
    int|string|null $player_id = null
  ): void {
    if ($player_id === null) {
      $player_id = (int) $this->getCurrentPlayerId();
      $this->checkMultiactiveActionFresh($player_id, ST_GRAND_TICHU_BETS, "grandTichuBet");
    } else {
      $this->acquireGameLockOrFail();
    }
    // Own row: can only be changed by this player's own requests, which are excluded by the
    // fresh multiactive check above (both bets and Tichu calls end the player's turn here).
    $player = PlayerManager::getPlayer($player_id);
    if (($player["call_tichu"] ?? -1) != -1) {
      $this->syncStaleReturnState();
      return;
    }
    $handcount = CardManager::getDeck()->countCardInLocation("hand", (int) $player_id);
    if ($handcount != 8) {
      throw new UserException(clienttranslate("Can't make grand tichu bet: you don't have 8 cards"));
    }
    if (($player["call_grand_tichu"] ?? -1) >= 0) {
      throw new UserException(clienttranslate("Can't make bet: you already bet"));
    }

    $lastTichuCall = LogManager::getLastAction("tichuCall", false);
    $currentRound = (int) (LogManager::getCurrentRoundAndTrick()["round"] ?? 0);
    $now = time();
    if ($bet == 200) {
      if (!$confirmed && $this->hasPartnerBetInCurrentRound((int) $player_id)) {
        NotificationManager::confirmTichu(
          $player_id,
          true,
          clienttranslate(
            "Your partner has already called Tichu. Only one player can finish first — are you sure?"
          )
        );
        $this->syncStaleReturnState();
        return;
      }
      if (
        !$confirmed &&
        $lastTichuCall != null &&
        (int) ($lastTichuCall["round"] ?? -1) === $currentRound &&
        $now - intval($lastTichuCall["arg"]) < TICHU_CONFIRMATION_TRESHOLD
      ) {
        NotificationManager::confirmTichu($player_id, true);
        $this->syncStaleReturnState();
        return;
      }
      LogManager::insert($player_id, "tichuCall", $now);
      $this->incStat(1, "grandtichu_number", (int) $player_id);
    }
    PlayerManager::grandTichuBet($player_id, $bet);
    LogManager::insert($player_id, "grandTichuBet", ["bet" => (int) $bet]);
    NotificationManager::grandTichuBet(
      $player_id,
      (string) ($player["name"] ?? ""),
      $bet
    );
    // stDealLastCards() only deals from the deck, which nobody else touches in this state.
    $this->setPlayerNonMultiactiveSafe((int) $player_id, "dealLastCards", true);
  }

  function tichuBet(bool $confirmed = false, int|string|null $player_id = null): void
  {
    // A Tichu call only depends on the caller's own row and cards, which are read with the lock
    // held below, so it is accepted even if other players acted concurrently (stale snapshot).
    $this->acquireGameLock();
    $player_id = $player_id !== null ? (int) $player_id : (int) $this->getCurrentPlayerId();
    $player = $this->getObjectFromDB(
      "SELECT player_name name, player_call_tichu call_tichu, player_call_grand_tichu call_grand_tichu FROM player WHERE player_id = $player_id FOR UPDATE"
    );
    if (($player["call_grand_tichu"] ?? -1) == 200) {
      throw new UserException(clienttranslate("You already made a grand tichu bet."));
    }
    if (($player["call_tichu"] ?? -1) == 100) {
      throw new UserException(clienttranslate("You cannot call Tichu anymore"));
    }
    $stateId = $this->freshStateId;
    if (
      !in_array($stateId, [
        ST_GRAND_TICHU_BETS,
        ST_GIVE_CARDS,
        ST_SHOW_PASSED_CARDS,
        ST_ACCEPT_PASSED_CARDS,
        ST_NEW_TRICK,
        ST_PLAY_COMBO_OPEN,
        ST_PLAY_COMBO,
        ST_MAHJONG_PLAY,
        ST_PHOENIX_PLAY,
        ST_PLAY_BOMB,
        ST_CONFIRM_TRICK,
        ST_CHOOSE_DRAGON_GIFT,
      ])
    ) {
      throw new UserException(clienttranslate("You cannot call Tichu anymore"));
    }
    $countCards = function (string $location) use ($player_id): int {
      $escapedLoc = $this->escapeStringForDB($location);
      return (int) $this->getUniqueValueFromDB(
        "SELECT COUNT(*) FROM card WHERE card_location = '$escapedLoc' AND card_location_arg = $player_id FOR UPDATE"
      );
    };
    if ($stateId == ST_GRAND_TICHU_BETS) {
      if ($countCards("hand") != 8) {
        throw new UserException(clienttranslate("You cannot call Tichu after playing a card"));
      }
    } elseif ($stateId != ST_GIVE_CARDS) {
      if ($countCards("hand") + $countCards("temporary") != 14) {
        throw new UserException(clienttranslate("You cannot call Tichu after playing a card"));
      }
    }
    if (($player["call_tichu"] ?? -1) != -1) {
      throw new UserException(clienttranslate("You cannot call Tichu anymore"));
    }
    $firstOutPlayer = (int) $this->getUniqueValueFromDB(
      "SELECT global_value FROM global WHERE global_id = 21 FOR UPDATE"
    );
    if (!$confirmed && $firstOutPlayer != 0) {
      NotificationManager::confirmTichu(
        $player_id,
        false,
        clienttranslate("You can't win this tichu bet anymore. Are you sure?")
      );
      $this->syncStaleReturnState();
      return;
    }
    if (!$confirmed && $this->hasPartnerBetInCurrentRound($player_id)) {
      NotificationManager::confirmTichu(
        $player_id,
        false,
        clienttranslate(
          "Your partner has already called Tichu. Only one player can finish first — are you sure?"
        )
      );
      $this->syncStaleReturnState();
      return;
    }
    $lastTichuCall = LogManager::getLastAction("tichuCall", false);
    $currentRound = (int) (LogManager::getCurrentRoundAndTrick()["round"] ?? 0);
    $now = time();
    if (
      !$confirmed &&
      $lastTichuCall != null &&
      (int) ($lastTichuCall["round"] ?? -1) === $currentRound &&
      $now - intval($lastTichuCall["arg"]) < TICHU_CONFIRMATION_TRESHOLD
    ) {
      NotificationManager::confirmTichu($player_id, false);
      $this->syncStaleReturnState();
      return;
    }
    $this->bumpGameVersion();
    LogManager::insert($player_id, "tichuCall", $now);
    $this->incStat(1, "tichu_number", $player_id);
    PlayerManager::tichuBet($player_id, 100);
    NotificationManager::tichuBet($player_id, (string) ($player["name"] ?? ""), 100);
    if ($stateId == ST_GRAND_TICHU_BETS) {
      $this->setPlayerNonMultiactiveSafe($player_id, "dealLastCards", true);
    } else {
      $this->syncStaleReturnState();
    }
  }

  function confirmTichu(int|string $bet): void
  {
    $bet = (int) $bet;
    if (!in_array($bet, [0, 100, 200], true)) {
      throw new UserException(clienttranslate("Invalid Tichu bet"));
    }
    if ($bet == 0) {
      return;
    }
    if ($bet == 200) {
      $this->grandTichuBet(200, true);
    } else {
      $this->tichuBet(true);
    }
  }

  function detectBombPassing(int|string $player_id): void
  {
    $cardPassedFromPartner = CardManager::getCardsPassedTo($player_id)[1];
    if ($cardPassedFromPartner === null) {
      return;
    }

    // You cannot complete a bomb by passing a special card.
    if ($cardPassedFromPartner["type_arg"] == 1) {
      return;
    }
    // Passing a King or Ace is quite natural. If that happens to complete a
    // bomb, then this is probably just lucky and not suspicious.
    if ($cardPassedFromPartner["type_arg"] > 12) {
      return;
    }

    // The new passed cards are still in "temporary" location.
    $beforeCards = CardManager::getCardsInLocation("hand", $player_id);
    $beforeHasBomb = (new Hand($beforeCards))->hasBomb();

    // The player already had a bomb, so don't bother to check, if they got
    // another one completed.
    if ($beforeHasBomb) {
      return;
    }

    $afterCards = array_merge($beforeCards, [$cardPassedFromPartner]);
    $afterHasBomb = (new Hand($afterCards))->hasBomb();

    // No bomb, even after passing, so no cheating.
    if (!$afterHasBomb) {
      return;
    }

    // Now, let's check the hand of the partner. Did the passed card have the highest rank?
    // Or at least the highest rank of all singles? Then the pass is quite natural.
    $partner = PlayerManager::getPartner($player_id);
    $partnerCards = CardManager::getCardsInLocation("hand", $partner["id"]);
    // The partner may already have accepted passed cards *to* him, so we have to filter those.
    $partnerCardsNotPassed = array_filter($partnerCards, function (array $card): bool {
      return $card["passed_from"] == null;
    });
    // Let's add the passed card *from* partner back to the partner hand.
    $partnerCardsRelevant = array_merge($partnerCardsNotPassed, [$cardPassedFromPartner]);
    $partnerHand = new Hand($partnerCardsRelevant);
    $partnerTopSingleRank = $partnerHand->getTopSingleRank();
    if ($cardPassedFromPartner["type_arg"] == $partnerTopSingleRank) {
      return;
    }
    $partnerTopRank = $partnerHand->getTopRank();
    if ($cardPassedFromPartner["type_arg"] == $partnerTopRank) {
      return;
    }

    // The pass was not natural and completed a bomb. Count it!
    $this->incStat(1, "bombs_completed_by_partner", (int) $player_id);
  }

  /**
   * This auto accepts cards for all players in the new "acceptPassedCards" state.
   * The transition "allCardsAccepted" immediately proceeds to a "new trick".
   */
  function acceptCardsForAllPlayers(): void
  {
    $players = PlayerManager::getPlayerIds();
    foreach ($players as $player_id) {
      $this->acceptCardsForPlayer($player_id);
    }

    $this->gamestate->nextState("allCardsAccepted");
  }

  /**
   * This is called by a player action in the legacy "showPassedCards" state.
   */
  function acceptCards(int|string|null $player_id = null): void
  {
    if ($player_id === null) {
      $player_id = (int) $this->getCurrentPlayerId();
      $this->checkMultiactiveActionFresh($player_id, ST_SHOW_PASSED_CARDS, "acceptCards");
    } else {
      $this->acquireGameLockOrFail();
    }
    $this->acceptCardsForPlayer($player_id);
    $this->setPlayerNonMultiactiveSafe((int) $player_id, "acceptCards", false);
  }

  /**
   * This is used by both (new and legacy) states for accepting passed cards into
   * players' hands.
   */
  function acceptCardsForPlayer(int|string $player_id): void
  {
    $pId = (int) $player_id;
    $this->detectBombPassing($pId);

    NotificationManager::acceptCards($pId);

    $deck = CardManager::getDeck();
    $acceptedCards = array_values($deck->getCardsInLocation("temporary", $pId));
    LogManager::insert($pId, "acceptCards", [
      "cards" => array_map(static fn($c) => (int) $c["id"], $acceptedCards),
    ]);
    $deck->moveAllCardsInLocation("temporary", "hand", $pId, $pId);
  }

  function makeAWish(int|string $wish, bool $checkAction = true): void
  {
    $this->acquireGameLockOrFail();
    if ($checkAction) {
      $this->checkAction("makeAWish");
    }
    $wish = (int) $wish;
    if ($wish < 2 || $wish > 15) {
      throw new UserException(clienttranslate("Invalid wish value"));
    }

    if ($wish == 15) {
      $msg = clienttranslate('${player_name} owns the Mahjong and has no wish');
      $textValue = "0";
    } else {
      $this->setGameStateValue("mahjongWish", $wish);
      $textValue = $this->values_label[$wish];
      $msg = clienttranslate('${player_name} owns the Mahjong and wants a ${text_value}');
    }
    LogManager::insert($this->getActivePlayerId(), "mahjongWish", ["wish" => (int) $wish]);
    NotificationManager::wishMade(
      $this->getActivePlayerId(),
      $this->getActivePlayerName(),
      $wish,
      $textValue,
      $msg
    );
    $this->gamestate->nextState("nextPlayer");
  }

  function collect(bool $checkAction = true): void
  {
    // Clients auto-collect, so every open tab/device of the trick winner may send this.
    // Duplicates (the trick was already collected) are silently ignored.
    $this->acquireGameLock();
    $expectedStateId = $checkAction
      ? $this->freshStateId
      : (int) $this->gamestate->getCurrentMainStateId();
    if ($expectedStateId !== ST_CONFIRM_TRICK) {
      $this->syncStaleReturnState();
      return;
    }
    if ($checkAction) {
      $this->acquireGameLockOrFail();
      $this->checkAction("collect");
    } else {
      $this->bumpGameVersion();
    }
    $action = LogManager::getLastAction("confirm");
    if ($action === null) {
      $this->logProdWarn("collect_missing_confirm_log");
      return;
    }
    $pId = (int) $action["player"];
    $action = $action["arg"];
    if (!empty($action["dragon"])) {
      $this->gamestate->nextState("chooseDragonGift");
    } else {
      $this->incStat(1, "tricks_win", $pId);
      $deck = CardManager::getDeck();
      $trickValue = CardManager::getTrickValue($deck->getCardsInLocation("combos"));
      $deck->moveAllCardsInLocation("combos", "captured", null, $pId);
      $player = PlayerManager::getPlayer($pId);
      NotificationManager::captureCards(
        $pId,
        $player["name"] ?? $this->getActivePlayerName(),
        $trickValue
      );
      $this->gamestate->nextState("newTrick");
    }
  }

  function cancelPhoenix(): void
  {
    $this->acquireGameLockOrFail();
    $this->checkAction("cancelPhoenix");
    $last = LogManager::getLastCombo();
    if (in_array($last->type, [NO_COMBO, DOG_COMBO])) {
      $this->gamestate->nextState("cancel");
    } else {
      $this->gamestate->nextState("playCombo");
    }
  }

  /**
   * arg for legacy state
   *
   * @return array<string, mixed>
   */
  function argShowPassedCards(): array
  {
    $private = CardManager::getPassedCards();
    return [
      "_private" => $private,
    ];
  }

  /**
   * arg for new state
   *
   * @return array<string, mixed>
   */
  function argAcceptPassedCards(): array
  {
    $private = CardManager::getPassedCards();
    return [
      "_private" => $private,
    ];
  }

  /**
   * @return array<string, mixed>
   */
  function argsPhoenixPlay(): array
  {
    $vals = LogManager::getLastCombo(0, "phoenix")->phoenixValue;
    $valsArr = is_array($vals) ? $vals : ($vals !== null ? [$vals] : []);
    return [
      "_private" => [
        "active" => [
          "values" => array_map("intval", $valsArr),
        ],
      ],
    ];
  }

  /**
   * @return array<string, mixed>
   */
  function argChooseDragonGift(): array
  {
    $lastComboPlayer = LogManager::getLastComboPlayer();
    $nextPlayers = array_column(PlayerManager::getNextPlayers($lastComboPlayer), "name");
    return ["enemies" => [$nextPlayers[0], $nextPlayers[2]]];
  }

  /**
   * @return array<string, mixed>
   */
  function argPlayComboOpen(): array
  {
    return LogManager::getCurrentRoundAndTrick() ?? [];
  }

  /**
   * @return array<string, mixed>
   */
  function argPlayBomb(): array
  {
    $last = LogManager::getLastAction("changePlayer");
    return is_array($last["arg"] ?? null) ? $last["arg"] : [];
  }

  function stNewRound(): void
  {
    LogManager::insert(0, "newRound");
    $this->setGameStateValue("firstOutPlayer", 0);
    $this->setGameStateValue("secondOutPlayer", 0);
    $this->setGameStateValue("doubleVictory", -1);
    $this->setGameStateValue("mahjongWish", 0);
    $this->setGameStateValue("mahjongOwner", 0);

    $this->incStat(1, "round_number");

    CardManager::resetPassedCards();
    $deck = CardManager::getDeck();
    $deck->shuffle("deck");

    $players = PlayerManager::getPlayerIds();
    PlayerManager::resetTichus();
    foreach ($players as $player_id) {
      $cards = $deck->pickCards(8, "deck", (int) $player_id);
      NotificationManager::dealCards(
        $player_id,
        $cards,
        clienttranslate("A new round starts. The 8 first cards are dealt")
      );
    }

    $this->gamestate->setAllPlayersMultiactive();
    $this->gamestate->nextState("GTBets");
  }

  function stDealLastCards(): void
  {
    $players = PlayerManager::getPlayerIds();
    foreach ($players as $player_id) {
      $cards = CardManager::getDeck()->pickCards(6, "deck", (int) $player_id);
      NotificationManager::dealCards(
        $player_id,
        $cards,
        clienttranslate("The last 6 cards are dealt")
      );
    }
    $this->gamestate->nextState("giveCards");
  }

  function stGiveCards(): void
  {
    $this->gamestate->setAllPlayersMultiactive();
  }

  // legacy state that requires all players to accept cards as an action
  function stShowPassedCards(): void
  {
    $this->gamestate->setAllPlayersMultiactive();
  }

  // new state that accepts cards automatically for all players
  function stAcceptPassedCards(): void
  {
    $this->acceptCardsForAllPlayers();
  }

  /*
	// New trick:
	// Reset GameStateValues and increase Statistic Values
	// Clear combo DB
	// Check who starts the new trick.
	// if it�??s a new round, it�??s the Mahjong Owner.
	// if not, we check if the winner of last trick still has cards in hand
	// if not, we check the next one
	// if not, we check the next one and that�??s all because case of one single player ends the round.
	// Notif log
	*/
  function stNewTrick(): void
  {
    $this->incStat(1, "trick_number");
    $currentRoundAndTrick = LogManager::getCurrentRoundAndTrick();
    $isFirstTrickOfRound = (int) ($currentRoundAndTrick["trick"] ?? 0) === 0;
    $lastWinner = LogManager::getLastComboPlayer();
    LogManager::insert(0, "newTrick");
    PlayerManager::setAutopass(0);
    NotificationManager::autopass(0);

    $deck = CardManager::getDeck();
    $totalCards = (int) $this->getUniqueValueFromDB("SELECT COUNT(*) FROM card");
    if ($totalCards !== 56) {
      $this->logProdWarn("card_count_mismatch", [
        "totalCards" => $totalCards,
        "where" => "stNewTrick",
      ]);
    }

    $starterId = 0;
    if ($isFirstTrickOfRound) {
      $card = array_values($deck->getCardsOfType((string) TYPE_MAHJONG, 1))[0];
      $mahjongOwnerId = (int) $card["location_arg"];
      $this->setGameStateValue("mahjongOwner", $mahjongOwnerId);
      $this->gamestate->changeActivePlayer($mahjongOwnerId);
      $starterId = $mahjongOwnerId;
      $notify = clienttranslate('A new round starts. ${player_name} has the Mahjong');
    } else {
      //this is not the first trick
      if ($lastWinner == 0) {
        $lastWinner = $this->getActivePlayerId();
      }
      $hand_count = $deck->countCardsByLocationArgs("hand");

      if (isset($hand_count[$lastWinner])) {
        //winner of last trick is still in play
        $this->gamestate->changeActivePlayer((int) $lastWinner);
        $starterId = (int) $lastWinner;

        $notify = clienttranslate(
          '${player_name} has won the previous trick and starts a new one.'
        );
      } else {
        //winner of last trick has no more cards. We check the next 2 players
        $nextPlayers = PlayerManager::getNextPlayers($lastWinner);
        while (!isset($hand_count[$nextPlayers[0]["id"]])) {
          array_shift($nextPlayers);
        }
        $nextPlayerId = (int) $nextPlayers[0]["id"];
        $this->gamestate->changeActivePlayer($nextPlayerId);
        $starterId = $nextPlayerId;
        $notify = clienttranslate('${player_name} is the next player and starts a new trick.');
      }
    }
    NotificationManager::log($notify, [
      "player_name" => $this->getActivePlayerName(),
    ]);

    $this->gamestate->nextState("firstCombo");
    // Grant extra time after leaving the "game" state so clients receive gameStateChange
    // (with reflexion.total populated) before updateReflexionTime.
    $this->giveExtraTime($starterId);
  }

  /*
	// Next player:
	// check if the player has shed his cards for a possible doubleVictory
	// check if only one player remaining. He gives his cards to first player out and the round is over.
	// check for double victory
	// check if trick is over after enough Passes.
	// check for Hound play : skip next player
	// then switch to next player in play
	*/
  function stNextPlayer(): void
  {
    $lastCombo = LogManager::getLastCombo();
    $lastComboPlayer = (int) $lastCombo->player;
    // get last player who played or passed
    if ($lastCombo->type == BOMB_COMBO) {
      $player_id = (int) LogManager::getLastActions(["combo", "pass"])[0]["player"];
      $this->gamestate->changeActivePlayer($player_id);
    } else {
      $player_id = (int) $this->getActivePlayerId();
    }
    $players = PlayerManager::getPlayers();
    $deck = CardManager::getDeck();
    if ($deck->countCardInLocation("hand", $player_id) == 0) {
      // This player gets out of the trick
      $firstOutPlayer = (int) $this->getGameStateValue("firstOutPlayer");
      if ($firstOutPlayer == 0) {
        // If he is the first, record it
        $this->setGameStateValue("firstOutPlayer", $player_id);
        $firstOutPlayer = $player_id;
      }
      NotificationManager::playerGoOut($player_id, $this->getActivePlayerName(), $firstOutPlayer);
      if ($firstOutPlayer != $player_id && $this->getGameStateValue("secondOutPlayer") == 0) {
        // If he is the second, record it
        $this->setGameStateValue("secondOutPlayer", $player_id);
        $secondOutPlayerTeam = $players[$player_id]["team"];
        if ($players[$firstOutPlayer]["team"] == $secondOutPlayerTeam) {
          $this->setGameStateValue("doubleVictory", $secondOutPlayerTeam);
          $this->gamestate->nextState("endRound");
          return;
        }
      }
    }

    // get number of players still in round
    $player_still_in_round = CardManager::numPlayersStillInRound();
    if ($player_still_in_round == 1) {
      if ($lastCombo->type == DOG_COMBO) {
        $deck->moveAllCardsInLocation("combos", "captured", null, $lastComboPlayer);
        $this->gamestate->nextState("endRound");
      } elseif ($lastCombo->hasDragon()) {
        $this->gamestate->changeActivePlayer($lastComboPlayer);
        $this->gamestate->nextState("chooseDragonGift");
        $this->giveExtraTime($lastComboPlayer);
      } else {
        $this->incStat(1, "tricks_win", $lastComboPlayer);
        $trickValue = CardManager::getTrickValue($deck->getCardsInLocation("combos"));
        $deck->moveAllCardsInLocation("combos", "captured", null, $lastComboPlayer);
        NotificationManager::captureCards(
          $lastComboPlayer,
          $players[$lastComboPlayer]["name"],
          $trickValue
        );
        $this->gamestate->nextState("endRound");
      }
      return;
    }

    $next_players = PlayerManager::getNextPlayers($player_id); //next players (including those without cards)
    $handCounts = CardManager::getDeck()->countCardsByLocationArgs("hand");
    $next = 0;
    if ($lastCombo->type == DOG_COMBO) {
      // Dog transfers right to deal to partner so next player is skipped
      $next_players[] = array_shift($next_players);
      foreach ($next_players as $player) {
        if (isset($handCounts[$player["id"]])) {
          $next = (int) $player["id"];
          break;
        }
      }
      $this->gamestate->changeActivePlayer($next);
      $this->gamestate->nextState("playComboOpen");
      $this->giveExtraTime($next);
      return;
    }

    // Can the total remaining cards beat the last combo? If not, then
    // skip all players in "isAllInfoExposed" mode.
    $impossibleToBeat = false;
    if ($this->isAllInfoExposed()) {
      $remainingCards = $deck->getCardsInLocation("hand");
      $handRemainingCards = new Hand($remainingCards);
      $beatingCombo = $handRemainingCards->findBeatingCombo($lastCombo);
      $impossibleToBeat = is_null($beatingCombo);
      if ($this->getBgaEnvironment() === "studio") {
        NotificationManager::devConsole(
          "Remaining " .
            count($remainingCards) .
            " cards can beat combo '" .
            $lastCombo->description .
            "'? " .
            ($impossibleToBeat ? "NO" : (string) $beatingCombo->description)
        );
      }
    }

    // search for next Player with enough cards, but don't go beyond the player who played the last combo
    $amount = min(count($lastCombo->cards ?? []), 4);
    if ($lastCombo->hasDragon()) {
      $amount = 4;
    }
    $wish = $this->getGameStateValue("mahjongWish");
    // Autopass flags are changed by out-of-turn requests that do not bump the lock version
    // (see pass() / cancelAutopass()), so read their latest committed values.
    $autopassFlags = $this->getCollectionFromDB(
      "SELECT player_id, player_pass FROM player FOR UPDATE",
      true
    );
    foreach ($next_players as $player) {
      $pId = (int) $player["id"];
      if ($lastComboPlayer == $pId) {
        $next = $pId;
        break;
      }
      if (!isset($handCounts[$pId])) {
        continue;
      }
      $pass = (int) ($autopassFlags[$pId] ?? AUTOPASS_NONE);
      $autoPass = $pass > 0 && CardManager::canPass($pId, $wish, $lastCombo);
      $cantBeat = $handCounts[$pId] < $amount || ($this->isAllInfoExposed() && $impossibleToBeat);
      if ($autoPass || $cantBeat) {
        $autoPassOnlyOnce = $pass == AUTOPASS_ONCE;
        if ($autoPassOnlyOnce) {
          PlayerManager::setAutopass(0, $pId);
          NotificationManager::autopass(0, $pId);
        }
        LogManager::insert($pId, "pass");
        NotificationManager::pass($pId, $player["name"]);
        continue;
      }
      if ($pass == AUTOPASS_ONCE) {
        PlayerManager::setAutopass(AUTOPASS_NONE, $pId);
        NotificationManager::autopass(AUTOPASS_NONE, $pId);
      }
      $next = $pId;
      break;
    }
    if ($lastComboPlayer == $next) {
      // trick is complete because all other players passed
      $dragon = $lastCombo->hasDragon();
      $this->gamestate->changeActivePlayer($lastComboPlayer);
      LogManager::insert($lastComboPlayer, "confirm", [
        "nextPlayer" => $next,
        "dragon" => $dragon,
      ]);
      $this->gamestate->nextState("confirmTrick");
      $this->giveExtraTime($lastComboPlayer);
    } else {
      // Continue the current trick play
      // => go to next player with cards in hand

      $this->gamestate->changeActivePlayer($next);

      $this->gamestate->nextState("nextPlayer");
      $this->giveExtraTime($next);
    }
  }

  function stEndRound(): void
  {
    $team_points = [0, 0];
    $team_points_GT = [0, 0];
    $team_points_T = [0, 0];
    $deck = CardManager::getDeck();

    $firstOutPlayer = (int) $this->getGameStateValue("firstOutPlayer");

    $players = PlayerManager::getPlayers();

    $result = [];
    $doubleVic = (int) $this->getGameStateValue("doubleVictory");
    if ($doubleVic >= 0) {
      $team_points[$doubleVic] = 200;
      NotificationManager::log(
        clienttranslate('It\'s a double victory for ${player_name}\'s team. They score 200 points.'),
        ["player_name" => $players[$firstOutPlayer]["name"]]
      );
    } else {
      //get last player
      $lastPlayerId = (int) array_keys($deck->countCardsByLocationArgs("hand"))[0];
      $deck->moveAllCardsInLocation("captured", "captured", $lastPlayerId, $firstOutPlayer);

      $ids = array_keys(
        array_filter($players, function (array $player): bool {
          return $player["team"] == "0";
        })
      );
      $cards = array_merge(
        $deck->getCardsInLocation("captured", (int) $ids[0]),
        $deck->getCardsInLocation("captured", (int) $ids[1])
      );
      if ($players[$lastPlayerId]["team"] == 1) {
        $cards = array_merge($cards, $deck->getCardsInLocation("hand", $lastPlayerId));
      }
      $result = CardManager::getTrickValue($cards, true);
      $team_points[0] = $result["score"];
      $team_points[1] = 100 - $team_points[0];
    }

    $bBetsGTMade = false;
    $bBetsTMade = false;
    $teams = [[], []];
    foreach ($players as $player_id => $player) {
      $teams[$player["team"]][] = $player;
      if ($player["call_grand_tichu"] == 200) {
        $bBetsGTMade = true;
        if ($player_id == $firstOutPlayer) {
          $this->incStat(1, "grandtichu_won_number", (int) $player_id);
          $team_points[$player["team"]] += 200;
          $team_points_GT[$player["team"]] += 200;
          NotificationManager::log(
            clienttranslate('${player_name} has made the Grand Tichu and team scores 200 points!'),
            ["player_name" => $player["name"]]
          );
        } else {
          $team_points[$player["team"]] -= 200;
          $team_points_GT[$player["team"]] -= 200;
          NotificationManager::log(
            clienttranslate(
              '${player_name} has not made the Grand Tichu and the team loses 200 points!'
            ),
            ["player_name" => $player["name"]]
          );
        }
      }

      if ($player["call_tichu"] == 100) {
        $bBetsTMade = true;
        if ($player_id == $firstOutPlayer) {
          $this->incStat(1, "tichu_won_number", (int) $player_id);
          $team_points[$player["team"]] += 100;
          $team_points_T[$player["team"]] += 100;
          NotificationManager::log(
            clienttranslate('${player_name} has made the Tichu and the team scores 100 points!'),
            ["player_name" => $player["name"]]
          );
        } else {
          $team_points[$player["team"]] -= 100;
          $team_points_T[$player["team"]] -= 100;
          NotificationManager::log(
            clienttranslate('${player_name} has not made the Tichu and the team loses 100 points!'),
            ["player_name" => $player["name"]]
          );
        }
      }
    }

    // ////////// Display table window with results /////////////////
    $table = [];

    // Header line

    $firstRow = [""];
    $firstRow[] = [
      "str" => clienttranslate('Team ${first_player_name} and ${third_player_name}'),
      "args" => [
        "first_player_name" => $teams[0][0]["name"],
        "third_player_name" => $teams[0][1]["name"],
      ],
      "type" => "header",
    ];
    $firstRow[] = [
      "str" => clienttranslate('Team ${second_player_name} and ${fourth_player_name}'),
      "args" => [
        "second_player_name" => $teams[1][0]["name"],
        "fourth_player_name" => $teams[1][1]["name"],
      ],
      "type" => "header",
    ];
    $table[] = $firstRow;
    $createRow = function (string $title, int $val, int $val2): array {
      return [["str" => $title, "args" => []], $val, $val2];
    };

    if ($doubleVic >= 0) {
      // Double Victory Points
      $table[] = $createRow(
        clienttranslate("Double Victory Points"),
        $doubleVic == 0 ? 200 : 0,
        $doubleVic == 1 ? 200 : 0
      );
    } else {
      $val = $result["table"][5] * 5;
      $table[] = $createRow(clienttranslate("5 Points"), $val, 20 - $val);

      $val = $result["table"][10] * 10;
      $table[] = $createRow(clienttranslate("10 Points"), $val, 40 - $val);

      $val = $result["table"][13] * 10;
      $table[] = $createRow(clienttranslate("K Points"), $val, 40 - $val);

      $val = in_array(TYPE_PHOENIX, $result["special"]) ? -25 : 0;
      $table[] = $createRow(clienttranslate("Phoenix Points"), $val, -25 - $val);

      $val = in_array(TYPE_DRAGON, $result["special"]) ? 25 : 0;
      $table[] = $createRow(clienttranslate("Dragon Points"), $val, 25 - $val);
    }
    if ($bBetsGTMade) {
      // Grand Tichu
      $table[] = $createRow(
        clienttranslate("Grand Tichu Points"),
        $team_points_GT[0],
        $team_points_GT[1]
      );
    }

    if ($bBetsTMade) {
      // Tichu
      $table[] = $createRow(
        clienttranslate("Tichu Points"),
        $team_points_T[0],
        $team_points_T[1]
      );
    }

    // Total Points
    $table[] = $createRow(clienttranslate("Total Points"), $team_points[0], $team_points[1]);

    NotificationManager::tableWindow($table);

    // Save points to db
    PlayerManager::updateScores($team_points);

    $deck->moveAllCardsInLocation(null, "deck");

    $newScores = PlayerManager::getScores();
    NotificationManager::newScores($newScores);

    $max_score = max($newScores);

    $end_points = [500, 1000, 2000][$this->getGameStateValue("gameLength") - 1];

    if ($max_score >= $end_points) {
      $scores = array_unique($newScores);
      if (count($scores) > 1) {
        $this->gamestate->nextState("endGame");
        $this->relockGlobalsAfterFrameworkCommit();
        return;
      } // else both teams are above $end_points with the same score : game goes on
    }
    $this->gamestate->nextState("newRound");
  }

  function stChangePlayer(): void
  {
    $action = LogManager::getLastAction("changePlayer");
    if ($action === null || !isset($action["player"], $action["arg"]["transition"])) {
      $this->logProdWarn("change_player_missing_log");
      return;
    }
    $this->gamestate->changeActivePlayer((int) $action["player"]);
    $this->gamestate->nextState($action["arg"]["transition"]);
  }

  //////////////////////////////////////////////////////////////////////////////
  //////////// Zombie
  ////////////

  /**
   * zombieTurn:
   *
   * This method is called each time it is the turn of a player who has quit the game (= "zombie" player).
   * You can do whatever you want in order to make sure the turn of this player ends appropriately
   * (ex: pass).
   *
   * @param array<string, mixed> $state
   * @param int|string $active_player
   * @return void
   */
  function zombieTurn($state, $active_player)
  {
    if (
      ((int) ($state["id"] ?? 0)) === ST_GAME_END ||
      ($state["name"] ?? "") === "gameEnd" ||
      (int) $this->gamestate->getCurrentMainStateId() === ST_GAME_END
    ) {
      return;
    }
    if ($this->gameLockHeld) {
      // Nested zombieTurn triggered via BGA checkZombieTurn() after an already-locked action
      // transitioned the state machine in this request: refresh lock-tracked state/player and
      // clear any pre-transition multiactive stale flag (#808761).
      $this->gameLockStale = false;
      $this->freshStateId = (int) $this->gamestate->getCurrentMainStateId();
      $this->freshActivePlayerId = (int) $active_player;
      $this->bumpGameVersion();
    } else {
      $this->acquireGameLockOrFail();
    }
    if ($this->freshStateId === ST_GAME_END) {
      return;
    }
    $livePlayers = (int) $this->getUniqueValueFromDB(
      "SELECT COUNT(*) FROM player WHERE player_zombie = 0 AND player_eliminated = 0"
    );
    if ($livePlayers === 0) {
      $this->logProdWarn("all_players_zombie_end", ["state" => $state["name"] ?? ""]);
      $this->gamestate->jumpToState(ST_GAME_END);
      $this->relockGlobalsAfterFrameworkCommit();
      return;
    }

    $statename = (string) ($state["name"] ?? "");
    $activePlayerId = (int) $active_player;
    $player = PlayerManager::getPlayer($activePlayerId);
    $player_name = (string) ($player["name"] ?? $this->getActivePlayerName());
    if (!isset($this->zombieLoggedInRequest[$activePlayerId])) {
      $this->zombieLoggedInRequest[$activePlayerId] = true;
      NotificationManager::log(clienttranslate('${player_name} makes a zombie turn'), [
        "player_name" => $player_name,
      ]);
    }
    $this->logProdWarn("zombie_turn", [
      "player" => $activePlayerId,
      "state" => $statename,
    ]);
    LogManager::insert($activePlayerId, "zombieTurn", [
      "state" => $statename,
      "type" => (string) ($state["type"] ?? ""),
    ]);
    $this->zombieStepsInRequest++;
    if ($this->zombieStepsInRequest % 15 === 0) {
      $this->sendNotifications();
    }
    if ($state["type"] === "activeplayer") {
      switch ($statename) {
        case "playComboOpen":
          $cards = array_values(
            CardManager::getDeck()->getCardsInLocation("hand", $activePlayerId)
          );
          if (empty($cards)) {
            $this->gamestate->nextState("zombiePass");
            return;
          }
          $hand = new Hand($cards);
          $wish = (int) $this->getGameStateValue("mahjongWish");
          $combo = $hand->findPlayableCombo(null, $wish > 0 ? $wish : 0);
          if ($combo === null) {
            $combo = new Combo([$cards[0]]);
          }
          $this->completePlayCombo($activePlayerId, $combo);
          return;
        case "playCombo":
          $lastCombo = LogManager::getLastCombo();
          $wish = (int) $this->getGameStateValue("mahjongWish");
          $mustLead =
            $lastCombo->type == NO_COMBO ||
            $lastCombo->type == DOG_COMBO;
          $cards = array_values(
            CardManager::getDeck()->getCardsInLocation("hand", $activePlayerId)
          );
          if (!empty($cards)) {
            $hand = new Hand($cards);
            $mustFulfillWish = $wish > 0 && $hand->canFulFillWish($wish, $lastCombo);
            if ($mustLead || $mustFulfillWish) {
              $combo = $hand->findPlayableCombo($lastCombo, $mustFulfillWish ? $wish : 0);
              if ($combo !== null) {
                $this->completePlayCombo($activePlayerId, $combo);
                return;
              }
            }
          }
          LogManager::insert($activePlayerId, "pass");
          NotificationManager::pass($activePlayerId, $player_name);
          $this->gamestate->nextState("zombiePass");
          return;
        case "mahjongPlay":
          $this->makeAWish(15, false);
          return;
        case "phoenixPlay":
          $combo = LogManager::getLastCombo(0, "phoenix");
          if (is_array($combo->phoenixValue) && !empty($combo->phoenixValue)) {
            $this->choosePhoenix($combo->phoenixValue[0], false);
          } else {
            $this->gamestate->nextState("zombiePass");
          }
          return;
        case "playBomb":
          $action = LogManager::getLastAction("changePlayer");
          if ($action && isset($action["arg"]["active"], $action["arg"]["last"])) {
            LogManager::insert($action["arg"]["active"], "changePlayer", [
              "transition" => $action["arg"]["last"],
            ]);
            $this->gamestate->nextState("zombiePass");
          } else {
            $this->gamestate->nextState("zombiePass");
          }
          return;
        case "confirmTrick":
          $this->collect(false);
          return;
        case "chooseDragonGift":
          $this->chooseDragonGift(0, false);
          return;
      }
      $this->gamestate->nextState("zombiePass");
      return;
    }

    if ($state["type"] == "multipleactiveplayer") {
      // States when a confirm is required from the players, or in a poll to continue the game or not
      // Make sure player is in a non blocking status for role turn
      switch ($statename) {
        case "grandTichuBets":
          if (($player["call_tichu"] ?? -1) == -1 && ($player["call_grand_tichu"] ?? -1) < 0) {
            $this->grandTichuBet(0, true, $activePlayerId);
          } else {
            $this->gamestate->setPlayerNonMultiactive($activePlayerId, "dealLastCards");
          }
          return;

        case "giveCards":
          $this->zombiGiveCards($activePlayerId);
          return;

        case "showPassedCards":
          $this->acceptCards($activePlayerId);
          return;

        default:
          $this->DbQuery(
            "UPDATE player SET player_is_multiactive = 0 WHERE player_id = $activePlayerId"
          );
          $this->gamestate->updateMultiactiveOrNextState("");
          return;
      }
    }

    throw new VisibleSystemException("Zombie mode not supported at this game state: " . $statename);
  }

  function zombiGiveCards(int|string|null $player_id = null): void
  {
    //3 random cards are given
    $player_idm = (int) ($player_id ?? $this->getCurrentPlayerId());
    $cards = array_values(CardManager::getDeck()->getCardsInLocation("hand", $player_idm));
    if (count($cards) >= 3) {
      $card_ids = [];
      for ($i = 0; $i < 3; $i++) {
        $idx = bga_rand(0, count($cards) - 1);
        $card_ids[] = $cards[$idx]["id"];
        array_splice($cards, $idx, 1);
      }
      $this->giveTheCards($card_ids, $player_idm);
    } else {
      $this->logProdWarn("zombie_give_cards_short_hand", [
        "player" => $player_idm,
        "count" => count($cards),
      ]);
      $this->gamestate->setPlayerNonMultiactive($player_idm, "acceptPassedCards");
    }
  }

  //////////////////////////////////////////////////////////////////////////////
  //////////// Studio Debug Helpers
  ////////////

  public function debug_botStep(): void
  {
    if ($this->getBgaEnvironment() !== "studio") {
      throw new VisibleSystemException("Debug actions are only available in Studio.");
    }
    $this->acquireGameLockOrFail();
    \TichuBot::stepSingleBotTurn($this);
  }

  public function debug_botOthers(): void
  {
    if ($this->getBgaEnvironment() !== "studio") {
      throw new VisibleSystemException("Debug actions are only available in Studio.");
    }
    $this->acquireGameLockOrFail();
    \TichuBot::actForOtherPlayers($this, (int) $this->getCurrentPlayerId());
  }

  public function debug_botSuggest(): void
  {
    if ($this->getBgaEnvironment() !== "studio") {
      throw new VisibleSystemException("Debug actions are only available in Studio.");
    }
    $this->acquireGameLock();
    $this->gamestate->reloadState();
    $playerId = (int) $this->getCurrentPlayerId();
    $players = $this->loadPlayersBasicInfos();
    if ($playerId <= 0 || !isset($players[$playerId])) {
      return;
    }
    $suggestion = \TichuBot::chooseNextAction($this, $playerId);
    NotificationManager::botSuggestion($playerId, $suggestion);
  }

  ///////////////////////////////////////////////////////////////////////////////////:
  ////////// DB upgrade
  //////////

  /**
   * upgradeDb:
   *
   * You don't have to care about this until your game has been published on BGA.
   * Once your game is on BGA, this method is called everytime the system detects a game running with your old
   * Database scheme.
   * In this case, if you change your Database scheme, you just have to apply the needed changes in order to
   * update the game database and allow the game to continue to run with your new version.
   *
   * @param int $from_version
   * @return void
   */
  function upgradeTableDb($from_version)
  {
    if ($from_version <= 2102011339) {
      // ! important ! Use DBPREFIX_<table_name> for all tables
      // player_has_bomb is obsolete.
      if (empty($this->getObjectListFromDB("SHOW COLUMNS FROM player LIKE 'player_has_bomb'"))) {
        $this->applyDbUpgradeToAllDB(
          "ALTER TABLE DBPREFIX_player ADD `player_has_bomb` INT NOT NULL DEFAULT '0'"
        );
      }
      if (empty($this->getObjectListFromDB("SHOW COLUMNS FROM player LIKE 'player_pass'"))) {
        $this->applyDbUpgradeToAllDB(
          "ALTER TABLE DBPREFIX_player ADD `player_pass` INT NOT NULL DEFAULT '0'"
        );
      }
      $this->applyDbUpgradeToAllDB("CREATE TABLE IF NOT EXISTS DBPREFIX_actionlog (
				`log_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
				`log_player` int(10) NOT NULL,
				`log_round` int(10) unsigned NOT NULL,
				`log_trick` int(10) unsigned NOT NULL,
				`log_action` varchar(16) NOT NULL,
				`log_arg` varchar(1024),
				PRIMARY KEY (`log_id`)
			) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=1;");
      $state = $this->gamestate->getCurrentMainState()->name;
      $this->applyDbUpgradeToAllDB(
        "INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES (0,0,0, 'newRound', '')"
      );
      try {
        if (!empty($this->getObjectListFromDB("SHOW TABLES LIKE '%combo'"))) {
          $combos = $this->getCollectionFromDb(
            "SELECT combo_player_id, combo_display FROM combo",
            true
          );
          $deck = CardManager::getDeck();
          foreach ($combos as $pId => $cardIds) {
            $pIdInt = (int) $pId;
            if (strlen((string) $cardIds) == 0) {
              $this->applyDbUpgradeToAllDB(
                "INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ($pIdInt,0,0, 'pass', '')"
              );
              continue;
            }
            $intIds = array_map("intval", explode(",", (string) $cardIds));
            $cards = array_values($deck->getCards($intIds));
            $combo = new Combo($cards);
            if (is_array($combo->phoenixValue)) {
              $combo->setPhoenixValue(
                (string) $this->getUniqueValueFromDB(
                  "SELECT global_value FROM global WHERE global_id=29"
                )
              );
            }
            $cards = Utils::filterColumns($combo->cards ?? [], ["id", "type", "type_arg"]);
            $rawArgs = json_encode([
              "description" => $combo->description,
              "type" => $combo->type,
              "cards" => $cards,
              "phoenixValue" => $combo->phoenixValue,
            ]);
            $args = $this->escapeStringForDB($rawArgs !== false ? $rawArgs : "{}");
            $this->applyDbUpgradeToAllDB(
              "INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ($pIdInt,0,0, 'combo', '$args')"
            );
          }
        }
      } catch (\Throwable $e) {
      }
      $this->applyDbUpgradeToAllDB(
        "UPDATE DBPREFIX_card SET card_location='combos' WHERE card_location IN ('lastcombo', 'allcombos')"
      );
      switch ($state) {
        case "grandTichuBets":
        case "giveCards":
        case "showPassedCards":
          $this->applyDbUpgradeToAllDB(
            "INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES (0,1,0, 'newRound', '')"
          );
          break;
        case "phoenixPlay":
          $cards = array_values(CardManager::getDeck()->getCardsInLocation("phoenixPlay"));
          if (!empty($cards)) {
            $player = (int) $cards[0]["location_arg"];
            $combo = new Combo($cards);
            $cards = Utils::filterColumns($combo->cards ?? [], ["id", "type", "type_arg"]);
            $rawArgs = json_encode([
              "description" => $combo->description,
              "type" => $combo->type,
              "cards" => $cards,
              "phoenixValue" => $combo->phoenixValue,
            ]);
            $args = $this->escapeStringForDB($rawArgs !== false ? $rawArgs : "{}");
            $this->applyDbUpgradeToAllDB(
              "INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ($player,0,0, 'phoenix', '$args')"
            );
            CardManager::getDeck()->moveAllCardsInLocation("phoenixPlay", "hand", null, $player);
            $this->applyDbUpgradeToAllDB(
              "UPDATE DBPREFIX_card SET card_location='hand' WHERE card_location='phoenixPlay'"
            );
          }
          break;
      }
    }
  }
}
