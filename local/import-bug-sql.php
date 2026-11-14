<?php
/**
 * Local MySQL 8.0 Bug SQL Importer for Tichu.
 *
 * Imports a production BGA bug SQL dump into the local MySQL 8.0 (`ebd_tichu_1`)
 * database and remaps all 7 player_id surfaces onto local `dashwood0..3` IDs
 * (`2385074..2385077`) using `Tichu::loadBugReportSQL()`.
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
  $game->executeBugSqlDump($sqlContent);

  $reportId = 0;
  if (preg_match('/bug_(\d+)\.sql$/i', basename($sqlFilePath), $matches)) {
    $reportId = (int) $matches[1];
  }

  $studioPlayers = $targetPlayers ?? [2385074, 2385075, 2385076, 2385077];
  $result = $game->loadBugReportSQL($reportId, $studioPlayers, $overrideStateId);
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
