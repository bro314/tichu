<?php

use Bga\GameFramework\Actions\Debug;
use Bga\GameFramework\VisibleSystemException;

trait DebugTrait
{
  private function assertStudioEnvironment(): void
  {
    if (self::getBgaEnvironment() !== "studio") {
      throw new VisibleSystemException("Debug helpers are only available in Studio.");
    }
  }

  /**
   * Split a raw SQL dump into individual executable statements while preserving
   * semicolons inside single-quoted, double-quoted, or backticked literals.
   *
   * @return string[]
   */
  public static function splitSqlStatements(string $sql): array
  {
    $statements = [];
    $buffer = "";
    $len = strlen($sql);
    $inSingleQuote = false;
    $inDoubleQuote = false;
    $inBacktick = false;
    $inLineComment = false;
    $inBlockComment = false;

    for ($i = 0; $i < $len; $i++) {
      $ch = $sql[$i];
      $next = $i + 1 < $len ? $sql[$i + 1] : "";

      if ($inLineComment) {
        if ($ch === "\n") {
          $inLineComment = false;
          $buffer .= "\n";
        }
        continue;
      }

      if ($inBlockComment) {
        if ($ch === "*" && $next === "/") {
          $inBlockComment = false;
          $i++;
        }
        continue;
      }

      if ($inSingleQuote) {
        $buffer .= $ch;
        if ($ch === "\\" && $i + 1 < $len) {
          $buffer .= $sql[$i + 1];
          $i++;
          continue;
        }
        if ($ch === "'" && $next === "'") {
          $buffer .= $next;
          $i++;
          continue;
        }
        if ($ch === "'") {
          $inSingleQuote = false;
        }
        continue;
      }

      if ($inDoubleQuote) {
        $buffer .= $ch;
        if ($ch === "\\" && $i + 1 < $len) {
          $buffer .= $sql[$i + 1];
          $i++;
          continue;
        }
        if ($ch === '"' && $next === '"') {
          $buffer .= $next;
          $i++;
          continue;
        }
        if ($ch === '"') {
          $inDoubleQuote = false;
        }
        continue;
      }

      if ($inBacktick) {
        $buffer .= $ch;
        if ($ch === "`" && $next === "`") {
          $buffer .= $next;
          $i++;
          continue;
        }
        if ($ch === "`") {
          $inBacktick = false;
        }
        continue;
      }

      if ($ch === "/" && $next === "*") {
        $inBlockComment = true;
        $i++;
        continue;
      }

      if ($ch === "#" || ($ch === "-" && $next === "-" && ($i + 2 >= $len || ctype_space($sql[$i + 2])))) {
        $inLineComment = true;
        continue;
      }

      if ($ch === "'") {
        $inSingleQuote = true;
        $buffer .= $ch;
        continue;
      }

      if ($ch === '"') {
        $inDoubleQuote = true;
        $buffer .= $ch;
        continue;
      }

      if ($ch === "`") {
        $inBacktick = true;
        $buffer .= $ch;
        continue;
      }

      if ($ch === ";") {
        $trimmed = trim($buffer);
        if ($trimmed !== "") {
          $statements[] = $trimmed;
        }
        $buffer = "";
        continue;
      }

      $buffer .= $ch;
    }

    $trimmed = trim($buffer);
    if ($trimmed !== "") {
      $statements[] = $trimmed;
    }

    return $statements;
  }

  /**
   * Execute a BGA bug-report SQL dump against the active table database.
   */
  public function executeBugSqlDump(string $sql): void
  {
    $this->assertStudioEnvironment();
    foreach (self::splitSqlStatements($sql) as $stmt) {
      if (
        preg_match(
          '/^(?:LOCK\s+TABLES|UNLOCK\s+TABLES|CREATE\s+DATABASE|USE\s+|START\s+TRANSACTION|BEGIN\b|COMMIT\b)/i',
          $stmt
        )
      ) {
        continue;
      }
      $normalized = str_replace("DBPREFIX_", "", $stmt);
      if (preg_match('/\bbga_[a-z0-9_]+\b/i', $normalized) === 1) {
        // Real BGA Studio forbids APP_DbObject queries against bga_* tables; run via LocalDb locally only.
        $this->runLocalBgaTableSql($normalized);
        continue;
      }
      $this->DbQuery($normalized);
    }
  }

  /**
   * Load and remap a production BGA bug SQL dump onto Studio/local player IDs.
   *
   * Supports both BGA Studio (which pre-imports the bug SQL into the table DB before invoking
   * loadBugReportSQL) and direct SQL file loading (`bug_<reportId>.sql` in the game root).
   *
   * Uses collision-free two-phase offset remapping across all 7 Tichu player_id surfaces:
   *  1. player (and playermultiactive / replaysavepoint / bga_user_preferences)
   *  2. global (global_id IN 2, 5, 21, 22, 27, 302, 304)
   *  3. card (card_location_arg for hand/temporary/captured AND card_passed_from)
   *  4. actionlog (log_player AND log_arg JSON keys like active, nextPlayer)
   *  5. gamelog (gamelog_player, gamelog_current_player AND gamelog_notification JSON)
   *  6. stats (stats_player_id)
   *  7. player_is_multiactive flags
   *
   * @param int $reportId BGA bug report ID (or 0 when SQL was already loaded into the DB)
   * @param int[] $studioPlayers Target player IDs ordered by seat (1..4)
   * @param int|null $overrideStateId Optional state ID to force global_id = 1 to
   * @return array<string, mixed>
   */
  public function loadBugReportSQL(
    int $reportId,
    array $studioPlayers = [],
    ?int $overrideStateId = null
  ): array {
    $this->assertStudioEnvironment();

    $targetIds = array_values(array_map("intval", $studioPlayers));

    if ($reportId > 0) {
      $sqlFile = dirname(__DIR__) . "/bug_{$reportId}.sql";
      if (is_file($sqlFile) && is_readable($sqlFile)) {
        $existingIds = array_map(
          "intval",
          $this->getObjectListFromDB("SELECT player_id FROM player ORDER BY player_no ASC, player_id ASC", true)
        );
        $alreadyHasOnlyTargets =
          !empty($existingIds) && !empty($targetIds) && $existingIds === $targetIds;
        if (empty($existingIds) || $alreadyHasOnlyTargets) {
          $sqlContent = file_get_contents($sqlFile);
          if ($sqlContent === false) {
            throw new VisibleSystemException("Unable to read bug SQL file: {$sqlFile}");
          }
          $this->executeBugSqlDump($sqlContent);
        }
      }
    }

    $oldPlayerRows = $this->getObjectListFromDB(
      "SELECT player_id, player_no, player_name, player_color, player_team FROM player ORDER BY player_no ASC, player_id ASC"
    );
    $prodCount = count($oldPlayerRows);
    if ($prodCount === 0) {
      throw new VisibleSystemException("Cannot remap bug SQL: player table is empty.");
    }

    if (empty($targetIds)) {
      $baseId = (int) $this->getCurrentPlayerId();
      if ($baseId <= 0) {
        $baseId = 2385074;
      }
      for ($i = 0; $i < $prodCount; $i++) {
        $targetIds[] = $baseId + $i;
      }
    }

    if (count($targetIds) !== $prodCount) {
      throw new VisibleSystemException(
        "Incorrect player count (bug report has {$prodCount} players, studio table has " .
          count($targetIds) .
          " players)"
      );
    }

    if (count(array_unique($targetIds)) !== $prodCount) {
      throw new VisibleSystemException("Target studio player IDs must be distinct.");
    }

    $oldIds = array_map(static fn(array $row): int => (int) $row["player_id"], $oldPlayerRows);
    $maxUsedId = max(array_merge([90000000], $oldIds, $targetIds));
    $tempBase = $maxUsedId + 1000;

    $directMap = [];
    $tempMap = [];
    $finalMap = [];
    foreach ($oldIds as $idx => $oldId) {
      $tempId = $tempBase + $idx;
      $newId = $targetIds[$idx];
      $directMap[$oldId] = $newId;
      $tempMap[$oldId] = $tempId;
      $finalMap[$tempId] = $newId;
    }

    $existingTables = array_flip($this->getObjectListFromDB("SHOW TABLES", true));

    // Phase 1 & Phase 2: collision-free two-phase SQL remapping
    $this->applyPlayerIdSqlPhase($tempMap, $existingTables);
    $this->applyPlayerIdSqlPhase($finalMap, $existingTables);

    // Remap embedded JSON in actionlog.log_arg
    $actionLogRows = $this->getObjectListFromDB(
      "SELECT log_id, log_arg FROM actionlog WHERE log_arg IS NOT NULL AND log_arg <> ''"
    );
    foreach ($actionLogRows as $row) {
      $raw = (string) $row["log_arg"];
      $decoded = json_decode($raw, true);
      if (!is_array($decoded)) {
        continue;
      }
      $remapped = self::remapActionLogArg($decoded, $directMap);
      if ($remapped !== $decoded) {
        $encoded = json_encode($remapped, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded !== false) {
          $escaped = $this->escapeStringForDB($encoded);
          $logId = (int) $row["log_id"];
          $this->DbQuery("UPDATE actionlog SET log_arg = '{$escaped}' WHERE log_id = {$logId}");
        }
      }
    }

    // Remap embedded JSON in gamelog.gamelog_notification
    if (isset($existingTables["gamelog"])) {
      $gamelogRows = $this->getObjectListFromDB(
        "SELECT gamelog_packet_id, gamelog_notification FROM gamelog WHERE gamelog_notification IS NOT NULL AND gamelog_notification <> ''"
      );
      foreach ($gamelogRows as $row) {
        $raw = (string) $row["gamelog_notification"];
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
          continue;
        }
        $remapped = self::remapGamelogPayload($decoded, $directMap);
        if ($remapped !== $decoded) {
          $encoded = json_encode($remapped, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
          if ($encoded !== false) {
            $escaped = $this->escapeStringForDB($encoded);
            $packetId = (int) $row["gamelog_packet_id"];
            $this->DbQuery(
              "UPDATE gamelog SET gamelog_notification = '{$escaped}' WHERE gamelog_packet_id = {$packetId}"
            );
          }
        }
      }
    }

    // Ensure player metadata (1-based seat order, canal, team color) is valid for client rendering
    $remappedRows = $this->getObjectListFromDB(
      "SELECT player_id, player_no, player_color, player_team FROM player ORDER BY player_no ASC, player_id ASC"
    );
    foreach ($remappedRows as $idx => $pRow) {
      $pId = (int) $pRow["player_id"];
      $pNo = (int) $pRow["player_no"];
      if ($pNo < 1 || $pNo > $prodCount) {
        $pNo = $idx + 1;
      }
      $team = (int) $pRow["player_team"];
      if ($team !== 0 && $team !== 1) {
        $team = ($pNo - 1) % 2;
      }
      $color = trim((string) $pRow["player_color"]);
      if ($color === "") {
        $color = $team === 0 ? "000000" : "ff0000";
      }
      $escapedColor = $this->escapeStringForDB($color);
      $canal = $this->escapeStringForDB("canal_{$pId}");
      $this->DbQuery(
        "UPDATE player SET player_no = {$pNo}, player_team = {$team}, player_color = '{$escapedColor}', player_canal = '{$canal}' WHERE player_id = {$pId}"
      );
    }

    // Ensure essential globals exist (lockVersion, options, game state)
    $this->ensureBaselineGlobals($targetIds[0]);

    $previousStateId = (int) $this->getUniqueValueFromDB(
      "SELECT global_value FROM global WHERE global_id = 1"
    );
    $targetStateId = $overrideStateId;
    if ($targetStateId === null && $previousStateId === ST_GAME_END) {
      $targetStateId = ST_CONFIRM_TRICK;
    }

    if ($targetStateId !== null) {
      $this->DbQuery("UPDATE global SET global_value = {$targetStateId} WHERE global_id = 1");
    } else {
      $targetStateId = $previousStateId;
    }

    // Ensure active player (global_id = 2) points to a valid remapped player ID
    $activePlayerId = (int) $this->getUniqueValueFromDB(
      "SELECT global_value FROM global WHERE global_id = 2"
    );
    if (!in_array($activePlayerId, $targetIds, true)) {
      $activePlayerId = $targetIds[0];
      $this->DbQuery("UPDATE global SET global_value = {$activePlayerId} WHERE global_id = 2");
    }

    // Keep player_is_multiactive consistent with the target state type
    $isMultiactiveState = in_array(
      $targetStateId,
      [ST_GRAND_TICHU_BETS, ST_GIVE_CARDS, ST_SHOW_PASSED_CARDS],
      true
    );
    if (!$isMultiactiveState) {
      $this->DbQuery("UPDATE player SET player_is_multiactive = 0");
      if (isset($existingTables["playermultiactive"])) {
        $this->DbQuery("UPDATE playermultiactive SET ma_is_multiactive = 0");
      }
    }

    // If unblocked into ST_CONFIRM_TRICK without a confirm row in the current trick, add one so collect() works
    if ($targetStateId === ST_CONFIRM_TRICK && LogManager::getLastAction("confirm") === null) {
      $roundAndTrick = LogManager::getCurrentRoundAndTrick();
      $round = (int) ($roundAndTrick["round"] ?? 1);
      $trick = (int) ($roundAndTrick["trick"] ?? 1);
      $lastCombo = LogManager::getLastCombo();
      $dragon = $lastCombo->type !== NO_COMBO && $lastCombo->hasDragon();
      $confirmArgs = json_encode(["nextPlayer" => $activePlayerId, "dragon" => $dragon]);
      $escapedConfirmArgs = $this->escapeStringForDB($confirmArgs !== false ? $confirmArgs : "{}");
      $this->DbQuery(
        "INSERT INTO actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ({$activePlayerId}, {$round}, {$trick}, 'confirm', '{$escapedConfirmArgs}')"
      );
    }

    $this->reloadPlayersBasicInfos();
    $this->gamestate->reloadState();

    return [
      "reportId" => $reportId,
      "playerMap" => $directMap,
      "previousStateId" => $previousStateId,
      "stateId" => $targetStateId,
      "activePlayerId" => $activePlayerId,
    ];
  }

  /**
   * Apply one pass of player-ID remapping across all SQL columns.
   *
   * @param array<int, int> $idMap
   * @param array<string, int|string> $existingTables
   */
  private function applyPlayerIdSqlPhase(array $idMap, array $existingTables): void
  {
    $globalIdList = implode(",", [
      GAMESTATE_ACTIVE_PLAYER,
      GAMESTATE_ADMIN_PLAYER,
      21, // firstOutPlayer
      22, // secondOutPlayer
      27, // mahjongOwner
      GAMESTATE_NEUTRALIZED_PLAYER_ID,
      GAMESTATE_UNDO_MOVES_PLAYER,
    ]);

    foreach ($idMap as $fromId => $toId) {
      $fromInt = (int) $fromId;
      $toInt = (int) $toId;

      $this->DbQuery("UPDATE player SET player_id = {$toInt} WHERE player_id = {$fromInt}");
      if (isset($existingTables["playermultiactive"])) {
        $this->DbQuery(
          "UPDATE playermultiactive SET ma_player_id = {$toInt} WHERE ma_player_id = {$fromInt}"
        );
      }
      if (isset($existingTables["replaysavepoint"])) {
        $this->DbQuery(
          "UPDATE replaysavepoint SET rsp_player_id = {$toInt} WHERE rsp_player_id = {$fromInt}"
        );
      }
      if (isset($existingTables["bga_user_preferences"])) {
        $this->runLocalBgaTableSql(
          "UPDATE bga_user_preferences SET pgp_player = {$toInt} WHERE pgp_player = {$fromInt}"
        );
      }

      $this->DbQuery(
        "UPDATE global SET global_value = {$toInt} WHERE global_id IN ({$globalIdList}) AND global_value = {$fromInt}"
      );

      $this->DbQuery(
        "UPDATE card SET card_location_arg = {$toInt} WHERE card_location IN ('hand', 'temporary', 'captured') AND card_location_arg = {$fromInt}"
      );
      $this->DbQuery(
        "UPDATE card SET card_passed_from = {$toInt} WHERE card_passed_from = {$fromInt}"
      );

      $this->DbQuery(
        "UPDATE actionlog SET log_player = {$toInt} WHERE log_player = {$fromInt}"
      );

      if (isset($existingTables["gamelog"])) {
        $this->DbQuery(
          "UPDATE gamelog SET gamelog_player = {$toInt} WHERE gamelog_player = {$fromInt}"
        );
        $this->DbQuery(
          "UPDATE gamelog SET gamelog_current_player = {$toInt} WHERE gamelog_current_player = {$fromInt}"
        );
      }

      if (isset($existingTables["stats"])) {
        $this->DbQuery(
          "UPDATE stats SET stats_player_id = {$toInt} WHERE stats_player_id = {$fromInt}"
        );
      }
    }
  }

  /**
   * Execute SQL touching `bga_*` tables using the local DB connection when running locally.
   * BGA Studio forbids `DbQuery()` access to `bga_*` tables and rejects those statements.
   */
  private function runLocalBgaTableSql(string $sql): void
  {
    if (!method_exists($this, "ensureLocalSchemaInitialized")) {
      return;
    }
    global $bgaContainer;
    if (is_object($bgaContainer) && method_exists($bgaContainer, "get")) {
      /** @var \Bga\GameFramework\Old\Db $db */
      $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
      $db->query($sql);
    }
  }

  /**
   * Ensure required framework and Tichu global rows exist after importing a dump.
   */
  private function ensureBaselineGlobals(int $fallbackAdminPlayerId): void
  {
    $defaults = [
      1 => ST_NEW_ROUND,
      2 => $fallbackAdminPlayerId,
      3 => 1,
      4 => 1237,
      5 => $fallbackAdminPlayerId,
      6 => 0,
      7 => 0,
      8 => 300,
      9 => 30,
      21 => 0,
      22 => 0,
      23 => -1,
      26 => 0,
      27 => 0,
      28 => 0,
      self::GLOBAL_LOCK_VERSION => 0,
      100 => 2,
      101 => 1,
      102 => 1,
      200 => 1,
      201 => 0,
      207 => 0,
    ];
    foreach ($defaults as $gId => $gVal) {
      $this->DbQuery(
        "INSERT IGNORE INTO global (global_id, global_value) VALUES ({$gId}, {$gVal})"
      );
    }
  }

  /**
   * Remap a scalar value if it matches a source player ID, preserving int vs string type.
   *
   * @param array<int, int> $idMap
   */
  private static function remapIdValue(mixed $val, array $idMap): mixed
  {
    if (is_int($val)) {
      return $idMap[$val] ?? $val;
    }
    if (is_string($val) && preg_match('/^\d+$/', $val)) {
      $intVal = (int) $val;
      if (isset($idMap[$intVal])) {
        return (string) $idMap[$intVal];
      }
    }
    return $val;
  }

  /**
   * Remap player IDs inside a decoded actionlog.log_arg structure.
   *
   * @param array<mixed> $arg
   * @param array<int, int> $idMap
   * @return array<mixed>
   */
  public static function remapActionLogArg(array $arg, array $idMap): array
  {
    $playerKeys = ["active", "nextPlayer", "player", "player_id", "playerId", "firstout_id"];
    foreach ($arg as $k => $v) {
      if (in_array((string) $k, $playerKeys, true)) {
        $arg[$k] = self::remapIdValue($v, $idMap);
      } elseif (is_array($v)) {
        $arg[$k] = self::remapActionLogArg($v, $idMap);
      }
    }
    return $arg;
  }

  /**
   * Remap player IDs inside a decoded gamelog.gamelog_notification payload.
   *
   * @param array<mixed> $payload
   * @param array<int, int> $idMap
   * @return array<mixed>
   */
  public static function remapGamelogPayload(array $payload, array $idMap): array
  {
    if (array_key_exists("type", $payload)) {
      return self::remapSingleNotification($payload, $idMap);
    }

    foreach ($payload as $idx => $entry) {
      if (is_array($entry)) {
        $payload[$idx] = self::remapGamelogPayload($entry, $idMap);
      }
    }
    return $payload;
  }

  /**
   * @param array<mixed> $notif
   * @param array<int, int> $idMap
   * @return array<mixed>
   */
  private static function remapSingleNotification(array $notif, array $idMap): array
  {
    $type = (string) ($notif["type"] ?? "");
    if (isset($notif["args"]) && is_array($notif["args"])) {
      if ($type === "gameStateMultipleActiveUpdate") {
        $notif["args"] = array_map(
          static fn(mixed $v): mixed => self::remapIdValue($v, $idMap),
          $notif["args"]
        );
      } else {
        $notif["args"] = self::remapNotificationNode($notif["args"], $idMap);
      }
    }
    return $notif;
  }

  /**
   * Recursively remap known player-ID fields, ID lists, and player-ID-keyed maps inside notification args.
   *
   * @param array<mixed> $node
   * @param array<int, int> $idMap
   * @return array<mixed>
   */
  private static function remapNotificationNode(array $node, array $idMap): array
  {
    $scalarPlayerKeys = [
      "player_id",
      "player_id2",
      "player_id3",
      "player_id4",
      "firstout_id",
      "active_player",
      "passed_from",
      "active",
      "nextPlayer",
      "player",
      "playerId",
      "mahjongOwner",
      "firstoutplayer",
      "lastComboPlayer",
    ];
    $listPlayerKeys = ["multiactive", "_notified_privately", "passes", "playerorder"];
    $mapPlayerKeys = [
      "newScores",
      "_private",
      "players",
      "handcount",
      "capturedpoints",
      "allLastCombos",
      "total",
      "remaining",
      "initial",
    ];

    $isCardWithPlayerLoc =
      isset($node["location"]) &&
      in_array($node["location"], ["hand", "temporary", "captured"], true);

    foreach ($node as $key => $val) {
      $keyStr = (string) $key;

      if (
        in_array($keyStr, $scalarPlayerKeys, true) ||
        ($keyStr === "location_arg" && ($isCardWithPlayerLoc || array_key_exists("passed_from", $node)))
      ) {
        $node[$key] = self::remapIdValue($val, $idMap);
        continue;
      }

      if (in_array($keyStr, $listPlayerKeys, true) && is_array($val)) {
        $node[$key] = array_map(
          static fn(mixed $item): mixed => self::remapIdValue($item, $idMap),
          $val
        );
        continue;
      }

      if (in_array($keyStr, $mapPlayerKeys, true) && is_array($val)) {
        $remappedMap = [];
        foreach ($val as $mapKey => $mapVal) {
          $newMapKey = self::remapIdValue($mapKey, $idMap);
          $remappedMap[$newMapKey] = is_array($mapVal)
            ? self::remapNotificationNode($mapVal, $idMap)
            : $mapVal;
        }
        $node[$key] = $remappedMap;
        continue;
      }

      if (is_array($val)) {
        $node[$key] = self::remapNotificationNode($val, $idMap);
      }
    }

    return $node;
  }

  /**
   * Studio debug helper: reopen a finished game (state 99) into an interactive state.
   */
  #[Debug(reload: true)]
  public function debug_reopenFinishedGame(int $stateId = ST_CONFIRM_TRICK): void
  {
    $this->assertStudioEnvironment();
    $this->DbQuery("UPDATE global SET global_value = {$stateId} WHERE global_id = 1");
    $isMultiactive = in_array(
      $stateId,
      [ST_GRAND_TICHU_BETS, ST_GIVE_CARDS, ST_SHOW_PASSED_CARDS],
      true
    );
    if (!$isMultiactive) {
      $this->DbQuery("UPDATE player SET player_is_multiactive = 0");
    }
    $this->gamestate->jumpToState($stateId);
  }

  /**
   * Studio debug helper: fast-forward the current round into stEndRound() for scoring verification.
   */
  #[Debug(reload: true)]
  public function debug_goToEndOfRound(): void
  {
    $this->assertStudioEnvironment();
    $players = PlayerManager::getPlayerIds();
    if (count($players) < 2) {
      throw new VisibleSystemException("Not enough players to end round.");
    }
    $winnerId = (int) $players[0];
    $lastId = (int) $players[count($players) - 1];

    $firstOut = (int) $this->getGameStateValue("firstOutPlayer", 0);
    if ($firstOut <= 0) {
      $this->setGameStateValue("firstOutPlayer", $winnerId);
    }

    $deck = CardManager::getDeck();
    $deck->moveAllCardsInLocation("combos", "captured", null, $winnerId);
    $deck->moveAllCardsInLocation("temporary", "captured", null, $winnerId);
    foreach ($players as $pId) {
      $pInt = (int) $pId;
      if ($pInt !== $lastId) {
        $deck->moveAllCardsInLocation("hand", "captured", $pInt, $winnerId);
      }
    }
    // Ensure last player holds at least 1 card if all hands were empty
    if ((int) $deck->countCardInLocation("hand", $lastId) === 0) {
      $captured = array_values($deck->getCardsInLocation("captured"));
      if (!empty($captured)) {
        $deck->moveCard((int) $captured[0]["id"], "hand", $lastId);
      }
    }

    $this->gamestate->jumpToState(ST_END_ROUND);
  }

  /**
   * Studio debug helper: give the current player a 4-of-a-kind bomb of 7s.
   */
  #[Debug(reload: true)]
  public function debug_dealBombToCurrentPlayer(): void
  {
    $this->assertStudioEnvironment();
    $playerId = (int) $this->getCurrentPlayerId();
    $bombCards = $this->getObjectListFromDB(
      "SELECT card_id FROM card WHERE card_type_arg = 7 ORDER BY card_type ASC"
    );
    if (count($bombCards) < 4) {
      throw new VisibleSystemException("Could not find all four 7s in card table.");
    }
    $bombIds = array_map(static fn(array $r): int => (int) $r["card_id"], $bombCards);
    $deck = CardManager::getDeck();
    $currentHand = array_values($deck->getCardsInLocation("hand", $playerId));
    $missingFromHand = array_values(
      array_filter(
        $bombIds,
        static fn(int $id): bool => !in_array($id, array_map("intval", array_column($currentHand, "id")), true)
      )
    );

    if (!empty($missingFromHand)) {
      $swapTargets = array_values(
        array_filter(
          $currentHand,
          static fn(array $c): bool => !in_array((int) $c["id"], $bombIds, true)
        )
      );
      foreach ($missingFromHand as $idx => $bombCardId) {
        $origRow = $this->getObjectFromDB(
          "SELECT card_location, card_location_arg FROM card WHERE card_id = {$bombCardId}"
        );
        if (isset($swapTargets[$idx]) && $origRow) {
          $swapId = (int) $swapTargets[$idx]["id"];
          $origLoc = $this->escapeStringForDB((string) $origRow["card_location"]);
          $origArg = (int) $origRow["card_location_arg"];
          $this->DbQuery(
            "UPDATE card SET card_location = '{$origLoc}', card_location_arg = {$origArg}, card_passed_from = NULL WHERE card_id = {$swapId}"
          );
        }
        $this->DbQuery(
          "UPDATE card SET card_location = 'hand', card_location_arg = {$playerId}, card_passed_from = NULL WHERE card_id = {$bombCardId}"
        );
      }
    }
  }
}
