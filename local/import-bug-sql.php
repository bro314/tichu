<?php
/**
 * Local MySQL 8.0 Bug SQL Importer for Tichu.
 *
 * Imports a production BGA bug SQL dump into the local MySQL 8.0 (`ebd_tichu_1`)
 * database and remaps all 7 player_id surfaces onto local `dashwood0..3` IDs
 * (`2385074..2385077`) using `LocalBugSqlLoader::loadBugReportSQL()`.
 *
 * CLI Usage:
 *   php local/import-bug-sql.php path/to/bug_12345.sql [--state=75] [--players=2385074,2385075,2385076,2385077] [--inspect]
 *   php local/import-bug-sql.php --inspect
 */

declare(strict_types=1);

$projectRoot = dirname(__DIR__);

if (!class_exists('Tichu', false)) {
  ob_start();
  require_once __DIR__ . '/bga-backend.php';
  require_once $projectRoot . '/tichu.game.php';
  ob_end_clean();
}

/**
 * Inspect the currently loaded Tichu MySQL database and return a structured diagnostic summary.
 *
 * @return array<string, mixed>
 */
function inspectBugDatabase(): array
{
  $game = new \Tichu();
  \Tichu::ensureLocalSchemaInitialized(false);
  $game->setTable(1, 'tichu', 1237, true);

  $globalsRaw = \APP_DbObject::getCollectionFromDb('SELECT global_id, global_value FROM global', true);
  $globals = [];
  foreach ($globalsRaw as $gId => $gVal) {
    $globals[(int) $gId] = (int) $gVal;
  }

  $stateInfo = $game->gamestate->state(true, false, true);
  $stateId = $globals[1] ?? (int) ($stateInfo['id'] ?? 0);
  $stateName = (string) ($stateInfo['name'] ?? 'unknown');

  $playersRaw = \APP_DbObject::getObjectListFromDB(
    'SELECT player_id, player_no, player_name, player_team, player_score, player_call_grand_tichu, player_call_tichu, player_pass, player_is_multiactive FROM player ORDER BY player_no ASC, player_id ASC'
  );
  $handCountsRaw = \APP_DbObject::getCollectionFromDb(
    "SELECT card_location_arg, COUNT(*) cnt FROM card WHERE card_location = 'hand' GROUP BY card_location_arg",
    true
  );
  $players = [];
  foreach ($playersRaw as $row) {
    $pId = (int) $row['player_id'];
    $players[] = [
      'id' => $pId,
      'no' => (int) $row['player_no'],
      'name' => (string) $row['player_name'],
      'team' => (int) $row['player_team'],
      'score' => (int) $row['player_score'],
      'handCount' => (int) ($handCountsRaw[(string) $pId] ?? ($handCountsRaw[$pId] ?? 0)),
      'grandTichu' => (int) $row['player_call_grand_tichu'],
      'tichu' => (int) $row['player_call_tichu'],
      'autopass' => (int) $row['player_pass'],
      'multiactive' => (int) $row['player_is_multiactive'] === 1,
    ];
  }

  $locCountsRaw = \APP_DbObject::getCollectionFromDb(
    'SELECT card_location, COUNT(*) cnt FROM card GROUP BY card_location',
    true
  );
  $byLocation = [];
  $totalCards = 0;
  foreach ($locCountsRaw as $loc => $cnt) {
    $countInt = (int) $cnt;
    $byLocation[(string) $loc] = $countInt;
    $totalCards += $countInt;
  }

  $actionLogsRaw = \APP_DbObject::getObjectListFromDB(
    'SELECT log_id, log_player, log_round, log_trick, log_action, log_arg FROM actionlog ORDER BY log_id DESC LIMIT 10'
  );
  $recentActionLogs = [];
  foreach (array_reverse($actionLogsRaw) as $log) {
    $recentActionLogs[] = [
      'id' => (int) $log['log_id'],
      'round' => (int) $log['log_round'],
      'trick' => (int) $log['log_trick'],
      'player' => (int) $log['log_player'],
      'action' => (string) $log['log_action'],
      'arg' => (string) $log['log_arg'],
    ];
  }

  $gamelogsRaw = \APP_DbObject::getObjectListFromDB(
    'SELECT gamelog_packet_id, gamelog_move_id, gamelog_private, gamelog_player, gamelog_notification FROM gamelog ORDER BY gamelog_packet_id DESC LIMIT 5'
  );
  $recentGamelogs = [];
  foreach (array_reverse($gamelogsRaw) as $glog) {
    $decoded = json_decode((string) $glog['gamelog_notification'], true);
    $types = [];
    if (is_array($decoded)) {
      if (isset($decoded['type'])) {
        $types[] = (string) $decoded['type'];
      } else {
        foreach ($decoded as $entry) {
          if (is_array($entry) && isset($entry['type'])) {
            $types[] = (string) $entry['type'];
          }
        }
      }
    }
    $recentGamelogs[] = [
      'packetId' => (int) $glog['gamelog_packet_id'],
      'moveId' => $glog['gamelog_move_id'] !== null ? (int) $glog['gamelog_move_id'] : null,
      'private' => (int) $glog['gamelog_private'] === 1,
      'player' => $glog['gamelog_player'] !== null ? (int) $glog['gamelog_player'] : null,
      'types' => $types,
    ];
  }

  return [
    'stateId' => $stateId,
    'stateName' => $stateName,
    'activePlayerId' => $globals[2] ?? 0,
    'globals' => [
      'firstOutPlayer' => $globals[21] ?? 0,
      'secondOutPlayer' => $globals[22] ?? 0,
      'doubleVictory' => $globals[23] ?? -1,
      'mahjongWish' => $globals[26] ?? 0,
      'mahjongOwner' => $globals[27] ?? 0,
      'isAllInfoExposed' => $globals[28] ?? 0,
      'lockVersion' => $globals[30] ?? 0,
    ],
    'players' => $players,
    'cards' => [
      'byLocation' => $byLocation,
      'totalCards' => $totalCards,
      'integrityOk' => $totalCards === 56,
    ],
    'recentActionLogs' => $recentActionLogs,
    'recentGamelogs' => $recentGamelogs,
  ];
}

/**
 * Format a bug database inspection payload as a compact human-readable report.
 *
 * @param array<string, mixed> $info
 */
function formatBugInspectionReport(array $info): string
{
  $lines = [];
  $lines[] = '=== Tichu Bug DB Inspection ===';
  $lines[] = sprintf(
    'State   : %d (%s) | Active player: %d',
    (int) $info['stateId'],
    (string) $info['stateName'],
    (int) $info['activePlayerId']
  );

  $cards = $info['cards'];
  $locParts = [];
  foreach ($cards['byLocation'] as $loc => $cnt) {
    $locParts[] = "{$loc}={$cnt}";
  }
  $lines[] = sprintf(
    'Cards   : %d/56 (%s) [%s]',
    (int) $cards['totalCards'],
    $cards['integrityOk'] ? 'OK' : 'MISMATCH',
    implode(', ', $locParts)
  );

  $g = $info['globals'];
  $lines[] = sprintf(
    'Globals : firstOut=%d secondOut=%d doubleVic=%d wish=%d mahjongOwner=%d lockVer=%d async=%d',
    (int) $g['firstOutPlayer'],
    (int) $g['secondOutPlayer'],
    (int) $g['doubleVictory'],
    (int) $g['mahjongWish'],
    (int) $g['mahjongOwner'],
    (int) $g['lockVersion'],
    (int) $g['isAllInfoExposed']
  );

  $lines[] = 'Players :';
  foreach ($info['players'] as $p) {
    $lines[] = sprintf(
      '  #%d id=%-7d name=%-12s team=%d score=%-4d hand=%-2d gt=%-3d t=%-2d pass=%d%s',
      (int) $p['no'],
      (int) $p['id'],
      (string) $p['name'],
      (int) $p['team'],
      (int) $p['score'],
      (int) $p['handCount'],
      (int) $p['grandTichu'],
      (int) $p['tichu'],
      (int) $p['autopass'],
      $p['multiactive'] ? ' [MULTIACTIVE]' : ''
    );
  }

  $lines[] = 'Recent actionlog:';
  foreach ($info['recentActionLogs'] as $log) {
    $lines[] = sprintf(
      '  [%d r%dt%d p=%d] %-16s %s',
      (int) $log['id'],
      (int) $log['round'],
      (int) $log['trick'],
      (int) $log['player'],
      (string) $log['action'],
      (string) $log['arg']
    );
  }

  if (!empty($info['recentGamelogs'])) {
    $lines[] = 'Recent gamelog:';
    foreach ($info['recentGamelogs'] as $glog) {
      $lines[] = sprintf(
        '  [pkt=%d move=%s%s] %s',
        (int) $glog['packetId'],
        $glog['moveId'] !== null ? (string) $glog['moveId'] : '-',
        $glog['private'] ? ' private p=' . (string) ($glog['player'] ?? '-') : '',
        implode(',', $glog['types'])
      );
    }
  }

  return implode("\n", $lines) . "\n";
}

final class LocalBugSqlLoader
{
  private static function assertLocalGame(\Tichu $game): void
  {
    if (!method_exists($game, 'ensureLocalSchemaInitialized')) {
      throw new \RuntimeException('LocalBugSqlLoader can only run against the local Tichu test runner.');
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
    $buffer = '';
    $len = strlen($sql);
    $inSingleQuote = false;
    $inDoubleQuote = false;
    $inBacktick = false;
    $inLineComment = false;
    $inBlockComment = false;

    for ($i = 0; $i < $len; $i++) {
      $ch = $sql[$i];
      $next = $i + 1 < $len ? $sql[$i + 1] : '';

      if ($inLineComment) {
        if ($ch === "\n") {
          $inLineComment = false;
          $buffer .= "\n";
        }
        continue;
      }

      if ($inBlockComment) {
        if ($ch === '*' && $next === '/') {
          $inBlockComment = false;
          $i++;
        }
        continue;
      }

      if ($inSingleQuote) {
        $buffer .= $ch;
        if ($ch === '\\' && $i + 1 < $len) {
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
        if ($ch === '\\' && $i + 1 < $len) {
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
        if ($ch === '`' && $next === '`') {
          $buffer .= $next;
          $i++;
          continue;
        }
        if ($ch === '`') {
          $inBacktick = false;
        }
        continue;
      }

      if ($ch === '/' && $next === '*') {
        $inBlockComment = true;
        $i++;
        continue;
      }

      if ($ch === '#' || ($ch === '-' && $next === '-' && ($i + 2 >= $len || ctype_space($sql[$i + 2])))) {
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

      if ($ch === '`') {
        $inBacktick = true;
        $buffer .= $ch;
        continue;
      }

      if ($ch === ';') {
        $trimmed = trim($buffer);
        if ($trimmed !== '') {
          $statements[] = $trimmed;
        }
        $buffer = '';
        continue;
      }

      $buffer .= $ch;
    }

    $trimmed = trim($buffer);
    if ($trimmed !== '') {
      $statements[] = $trimmed;
    }

    return $statements;
  }

  /**
   * Execute a BGA bug-report SQL dump against the active local table database.
   */
  public static function executeBugSqlDump(\Tichu $game, string $sql): void
  {
    self::assertLocalGame($game);
    foreach (self::splitSqlStatements($sql) as $stmt) {
      if (
        preg_match(
          '/^(?:LOCK\s+TABLES|UNLOCK\s+TABLES|CREATE\s+DATABASE|USE\s+|START\s+TRANSACTION|BEGIN\b|COMMIT\b)/i',
          $stmt
        )
      ) {
        continue;
      }
      $normalized = str_replace('DBPREFIX_', '', $stmt);
      if (preg_match('/\bbga_[a-z0-9_]+\b/i', $normalized) === 1) {
        self::runLocalBgaTableSql($normalized);
        continue;
      }
      \APP_DbObject::DbQuery($normalized);
    }
  }

  /**
   * Load and remap a production BGA bug SQL dump onto local player IDs.
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
   * @param int[] $studioPlayers Target player IDs ordered by seat (1..4)
   * @return array<string, mixed>
   */
  public static function loadBugReportSQL(
    \Tichu $game,
    int $reportId,
    array $studioPlayers = [],
    ?int $overrideStateId = null
  ): array {
    self::assertLocalGame($game);

    $targetIds = array_values(array_map('intval', $studioPlayers));

    if ($reportId > 0) {
      $sqlFile = dirname(__DIR__) . "/bug_{$reportId}.sql";
      if (is_file($sqlFile) && is_readable($sqlFile)) {
        $existingIds = array_map(
          'intval',
          \APP_DbObject::getObjectListFromDB(
            'SELECT player_id FROM player ORDER BY player_no ASC, player_id ASC',
            true
          )
        );
        $alreadyHasOnlyTargets =
          !empty($existingIds) && !empty($targetIds) && $existingIds === $targetIds;
        if (empty($existingIds) || $alreadyHasOnlyTargets) {
          $sqlContent = file_get_contents($sqlFile);
          if ($sqlContent === false) {
            throw new \RuntimeException("Unable to read bug SQL file: {$sqlFile}");
          }
          self::executeBugSqlDump($game, $sqlContent);
        }
      }
    }

    $oldPlayerRows = \APP_DbObject::getObjectListFromDB(
      'SELECT player_id, player_no, player_name, player_color, player_team FROM player ORDER BY player_no ASC, player_id ASC'
    );
    $prodCount = count($oldPlayerRows);
    if ($prodCount === 0) {
      throw new \RuntimeException('Cannot remap bug SQL: player table is empty.');
    }

    if (empty($targetIds)) {
      $baseId = 2385074;
      for ($i = 0; $i < $prodCount; $i++) {
        $targetIds[] = $baseId + $i;
      }
    }

    if (count($targetIds) !== $prodCount) {
      throw new \RuntimeException(
        "Incorrect player count (bug report has {$prodCount} players, local table has " .
          count($targetIds) .
          ' players)'
      );
    }

    if (count(array_unique($targetIds)) !== $prodCount) {
      throw new \RuntimeException('Target studio player IDs must be distinct.');
    }

    $oldIds = array_map(static fn(array $row): int => (int) $row['player_id'], $oldPlayerRows);
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

    $existingTables = array_flip(\APP_DbObject::getObjectListFromDB('SHOW TABLES', true));

    self::applyPlayerIdSqlPhase($tempMap, $existingTables);
    self::applyPlayerIdSqlPhase($finalMap, $existingTables);

    $actionLogRows = \APP_DbObject::getObjectListFromDB(
      "SELECT log_id, log_arg FROM actionlog WHERE log_arg IS NOT NULL AND log_arg <> ''"
    );
    foreach ($actionLogRows as $row) {
      $raw = (string) $row['log_arg'];
      $decoded = json_decode($raw, true);
      if (!is_array($decoded)) {
        continue;
      }
      $remapped = self::remapActionLogArg($decoded, $directMap);
      if ($remapped !== $decoded) {
        $encoded = json_encode($remapped, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded !== false) {
          $escaped = \APP_DbObject::escapeStringForDB($encoded);
          $logId = (int) $row['log_id'];
          \APP_DbObject::DbQuery("UPDATE actionlog SET log_arg = '{$escaped}' WHERE log_id = {$logId}");
        }
      }
    }

    if (isset($existingTables['gamelog'])) {
      $gamelogRows = \APP_DbObject::getObjectListFromDB(
        "SELECT gamelog_packet_id, gamelog_notification FROM gamelog WHERE gamelog_notification IS NOT NULL AND gamelog_notification <> ''"
      );
      foreach ($gamelogRows as $row) {
        $raw = (string) $row['gamelog_notification'];
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
          continue;
        }
        $remapped = self::remapGamelogPayload($decoded, $directMap);
        if ($remapped !== $decoded) {
          $encoded = json_encode($remapped, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
          if ($encoded !== false) {
            $escaped = \APP_DbObject::escapeStringForDB($encoded);
            $packetId = (int) $row['gamelog_packet_id'];
            \APP_DbObject::DbQuery(
              "UPDATE gamelog SET gamelog_notification = '{$escaped}' WHERE gamelog_packet_id = {$packetId}"
            );
          }
        }
      }
    }

    $remappedRows = \APP_DbObject::getObjectListFromDB(
      'SELECT player_id, player_no, player_color, player_team FROM player ORDER BY player_no ASC, player_id ASC'
    );
    foreach ($remappedRows as $idx => $pRow) {
      $pId = (int) $pRow['player_id'];
      $pNo = (int) $pRow['player_no'];
      if ($pNo < 1 || $pNo > $prodCount) {
        $pNo = $idx + 1;
      }
      $team = (int) $pRow['player_team'];
      if ($team !== 0 && $team !== 1) {
        $team = ($pNo - 1) % 2;
      }
      $color = trim((string) $pRow['player_color']);
      if ($color === '') {
        $color = $team === 0 ? '000000' : 'ff0000';
      }
      $escapedColor = \APP_DbObject::escapeStringForDB($color);
      $canal = \APP_DbObject::escapeStringForDB("canal_{$pId}");
      \APP_DbObject::DbQuery(
        "UPDATE player SET player_no = {$pNo}, player_team = {$team}, player_color = '{$escapedColor}', player_canal = '{$canal}' WHERE player_id = {$pId}"
      );
    }

    self::ensureBaselineGlobals($targetIds[0]);

    $previousStateId = (int) \APP_DbObject::getUniqueValueFromDB(
      'SELECT global_value FROM global WHERE global_id = 1'
    );
    $targetStateId = $overrideStateId;
    if ($targetStateId === null && $previousStateId === ST_GAME_END) {
      $targetStateId = ST_CONFIRM_TRICK;
    }

    if ($targetStateId !== null) {
      \APP_DbObject::DbQuery("UPDATE global SET global_value = {$targetStateId} WHERE global_id = 1");
    } else {
      $targetStateId = $previousStateId;
    }

    $activePlayerId = (int) \APP_DbObject::getUniqueValueFromDB(
      'SELECT global_value FROM global WHERE global_id = 2'
    );
    if (!in_array($activePlayerId, $targetIds, true)) {
      $activePlayerId = $targetIds[0];
      \APP_DbObject::DbQuery("UPDATE global SET global_value = {$activePlayerId} WHERE global_id = 2");
    }

    $isMultiactiveState = in_array(
      $targetStateId,
      [ST_GRAND_TICHU_BETS, ST_GIVE_CARDS, ST_SHOW_PASSED_CARDS],
      true
    );
    if (!$isMultiactiveState) {
      \APP_DbObject::DbQuery('UPDATE player SET player_is_multiactive = 0');
      if (isset($existingTables['playermultiactive'])) {
        \APP_DbObject::DbQuery('UPDATE playermultiactive SET ma_is_multiactive = 0');
      }
    }

    if ($targetStateId === ST_CONFIRM_TRICK && \LogManager::getLastAction('confirm') === null) {
      $roundAndTrick = \LogManager::getCurrentRoundAndTrick();
      $round = (int) ($roundAndTrick['round'] ?? 1);
      $trick = (int) ($roundAndTrick['trick'] ?? 1);
      $lastCombo = \LogManager::getLastCombo();
      $dragon = $lastCombo->type !== NO_COMBO && $lastCombo->hasDragon();
      $confirmArgs = json_encode(['nextPlayer' => $activePlayerId, 'dragon' => $dragon]);
      $escapedConfirmArgs = \APP_DbObject::escapeStringForDB(
        $confirmArgs !== false ? $confirmArgs : '{}'
      );
      \APP_DbObject::DbQuery(
        "INSERT INTO actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ({$activePlayerId}, {$round}, {$trick}, 'confirm', '{$escapedConfirmArgs}')"
      );
    }

    $game->reloadPlayersBasicInfos();
    $game->gamestate->reloadState();

    return [
      'reportId' => $reportId,
      'playerMap' => $directMap,
      'previousStateId' => $previousStateId,
      'stateId' => $targetStateId,
      'activePlayerId' => $activePlayerId,
    ];
  }

  /**
   * Apply one pass of player-ID remapping across all SQL columns.
   *
   * @param array<int, int> $idMap
   * @param array<string, int|string> $existingTables
   */
  private static function applyPlayerIdSqlPhase(array $idMap, array $existingTables): void
  {
    $globalIdList = implode(',', [
      GAMESTATE_ACTIVE_PLAYER,
      GAMESTATE_ADMIN_PLAYER,
      21,
      22,
      27,
      GAMESTATE_NEUTRALIZED_PLAYER_ID,
      GAMESTATE_UNDO_MOVES_PLAYER,
    ]);

    foreach ($idMap as $fromId => $toId) {
      $fromInt = (int) $fromId;
      $toInt = (int) $toId;

      \APP_DbObject::DbQuery("UPDATE player SET player_id = {$toInt} WHERE player_id = {$fromInt}");
      if (isset($existingTables['playermultiactive'])) {
        \APP_DbObject::DbQuery(
          "UPDATE playermultiactive SET ma_player_id = {$toInt} WHERE ma_player_id = {$fromInt}"
        );
      }
      if (isset($existingTables['replaysavepoint'])) {
        \APP_DbObject::DbQuery(
          "UPDATE replaysavepoint SET rsp_player_id = {$toInt} WHERE rsp_player_id = {$fromInt}"
        );
      }
      if (isset($existingTables['bga_user_preferences'])) {
        self::runLocalBgaTableSql(
          "UPDATE bga_user_preferences SET pgp_player = {$toInt} WHERE pgp_player = {$fromInt}"
        );
      }

      \APP_DbObject::DbQuery(
        "UPDATE global SET global_value = {$toInt} WHERE global_id IN ({$globalIdList}) AND global_value = {$fromInt}"
      );

      \APP_DbObject::DbQuery(
        "UPDATE card SET card_location_arg = {$toInt} WHERE card_location IN ('hand', 'temporary', 'captured') AND card_location_arg = {$fromInt}"
      );
      \APP_DbObject::DbQuery(
        "UPDATE card SET card_passed_from = {$toInt} WHERE card_passed_from = {$fromInt}"
      );

      \APP_DbObject::DbQuery(
        "UPDATE actionlog SET log_player = {$toInt} WHERE log_player = {$fromInt}"
      );

      if (isset($existingTables['gamelog'])) {
        \APP_DbObject::DbQuery(
          "UPDATE gamelog SET gamelog_player = {$toInt} WHERE gamelog_player = {$fromInt}"
        );
        \APP_DbObject::DbQuery(
          "UPDATE gamelog SET gamelog_current_player = {$toInt} WHERE gamelog_current_player = {$fromInt}"
        );
      }

      if (isset($existingTables['stats'])) {
        \APP_DbObject::DbQuery(
          "UPDATE stats SET stats_player_id = {$toInt} WHERE stats_player_id = {$fromInt}"
        );
      }
    }
  }

  /**
   * Execute SQL touching `bga_*` tables using the local DB connection in local test runs only.
   */
  private static function runLocalBgaTableSql(string $sql): void
  {
    global $bgaContainer;
    if (is_object($bgaContainer) && method_exists($bgaContainer, 'get')) {
      /** @var \Bga\GameFramework\Old\Db $db */
      $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
      $db->query($sql);
    }
  }

  /**
   * Ensure required framework and Tichu global rows exist after importing a dump.
   */
  private static function ensureBaselineGlobals(int $fallbackAdminPlayerId): void
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
      \Tichu::GLOBAL_LOCK_VERSION => 0,
      100 => 2,
      101 => 1,
      102 => 1,
      200 => 1,
      201 => 0,
      207 => 0,
    ];
    foreach ($defaults as $gId => $gVal) {
      \APP_DbObject::DbQuery(
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
    $playerKeys = [
      'active',
      'nextPlayer',
      'player',
      'player_id',
      'playerId',
      'firstout_id',
      'recipient',
    ];
    foreach ($arg as $k => $v) {
      if (in_array((string) $k, $playerKeys, true)) {
        $arg[$k] = self::remapIdValue($v, $idMap);
      } elseif ((string) $k === 'recipients' && is_array($v)) {
        $arg[$k] = array_map(
          static fn($item) => self::remapIdValue($item, $idMap),
          $v
        );
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
    if (array_key_exists('type', $payload)) {
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
    $type = (string) ($notif['type'] ?? '');
    if (isset($notif['args']) && is_array($notif['args'])) {
      if ($type === 'gameStateMultipleActiveUpdate') {
        $notif['args'] = array_map(
          static fn(mixed $v): mixed => self::remapIdValue($v, $idMap),
          $notif['args']
        );
      } else {
        $notif['args'] = self::remapNotificationNode($notif['args'], $idMap);
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
      'player_id',
      'player_id2',
      'player_id3',
      'player_id4',
      'firstout_id',
      'active_player',
      'passed_from',
      'active',
      'nextPlayer',
      'player',
      'playerId',
      'mahjongOwner',
      'firstoutplayer',
      'lastComboPlayer',
    ];
    $listPlayerKeys = ['multiactive', '_notified_privately', 'passes', 'playerorder'];
    $mapPlayerKeys = [
      'newScores',
      '_private',
      'players',
      'handcount',
      'capturedpoints',
      'allLastCombos',
      'total',
      'remaining',
      'initial',
    ];

    $isCardWithPlayerLoc =
      isset($node['location']) &&
      in_array($node['location'], ['hand', 'temporary', 'captured'], true);

    foreach ($node as $key => $val) {
      $keyStr = (string) $key;

      if (
        in_array($keyStr, $scalarPlayerKeys, true) ||
        ($keyStr === 'location_arg' &&
          ($isCardWithPlayerLoc || array_key_exists('passed_from', $node)))
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
}

/**
 * Import a BGA bug SQL file into local MySQL 8.0 and remap player IDs.
 *
 * @param int[]|null $targetPlayers
 * @return array<string, mixed>
 */
function importBugSqlFile(
  string $sqlFilePath,
  ?int $overrideStateId = null,
  ?array $targetPlayers = null
): array {
  if (!is_file($sqlFilePath) || !is_readable($sqlFilePath)) {
    throw new \RuntimeException("Bug SQL file not found or unreadable: {$sqlFilePath}");
  }

  $sqlContent = file_get_contents($sqlFilePath);
  if ($sqlContent === false || trim($sqlContent) === '') {
    throw new \RuntimeException("Bug SQL file is empty: {$sqlFilePath}");
  }

  $game = new \Tichu();
  \Tichu::ensureLocalSchemaInitialized(true);
  $game->setTable(1, 'tichu', 1237, true);
  \LocalBugSqlLoader::executeBugSqlDump($game, $sqlContent);

  $reportId = 0;
  if (preg_match('/bug_(\d+)\.sql$/i', basename($sqlFilePath), $matches)) {
    $reportId = (int) $matches[1];
  }

  $studioPlayers = $targetPlayers ?? [2385074, 2385075, 2385076, 2385077];
  $result = \LocalBugSqlLoader::loadBugReportSQL($game, $reportId, $studioPlayers, $overrideStateId);
  $game->onRequestEnd();

  return $result;
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
  $args = array_slice($argv ?? [], 1);
  $sqlPath = null;
  $overrideStateId = null;
  $targetPlayers = null;
  $inspect = false;

  foreach ($args as $arg) {
    if ($arg === '--help' || $arg === '-h') {
      echo "Usage:\n  php local/import-bug-sql.php <path/to/bug.sql> [--state=<id>] [--players=id1,id2,id3,id4] [--inspect]\n  php local/import-bug-sql.php --inspect\n";
      exit(0);
    }
    if ($arg === '--inspect' || $arg === '-i') {
      $inspect = true;
      continue;
    }
    if (str_starts_with($arg, '--state=')) {
      $rawState = substr($arg, strlen('--state='));
      if (!is_numeric($rawState)) {
        fwrite(STDERR, "Invalid --state value: {$rawState}\n");
        exit(1);
      }
      $overrideStateId = (int) $rawState;
      continue;
    }
    if (str_starts_with($arg, '--players=')) {
      $rawPlayers = substr($arg, strlen('--players='));
      $targetPlayers = array_map('intval', array_filter(explode(',', $rawPlayers), 'strlen'));
      continue;
    }
    if ($sqlPath === null) {
      $sqlPath = $arg;
    } else {
      fwrite(STDERR, "Unexpected argument: {$arg}\n");
      exit(1);
    }
  }

  if ($sqlPath === null && !$inspect) {
    fwrite(
      STDERR,
      "Usage: php local/import-bug-sql.php <path/to/bug.sql> [--state=<id>] [--players=id1,id2,id3,id4] [--inspect]\n"
    );
    exit(1);
  }

  try {
    if ($sqlPath !== null) {
      $res = importBugSqlFile($sqlPath, $overrideStateId, $targetPlayers);
      echo "Imported {$sqlPath}\n";
      echo "  Previous state : {$res['previousStateId']}\n";
      echo "  Current state  : {$res['stateId']}\n";
      echo "  Active player  : {$res['activePlayerId']}\n";
      echo "  Player remap   : " . json_encode($res['playerMap']) . "\n";
    }
    if ($inspect) {
      echo formatBugInspectionReport(inspectBugDatabase());
    }
    exit(0);
  } catch (\Throwable $e) {
    fwrite(STDERR, "Error importing bug SQL: " . $e->getMessage() . "\n");
    exit(1);
  }
}
