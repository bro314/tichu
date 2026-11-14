<?php
/**
 * Local MySQL 8.0 Bug SQL Importer for Tichu.
 *
 * Imports a production BGA bug SQL dump into the local MySQL 8.0 (`ebd_tichu_1`)
 * database and remaps all 7 player_id surfaces onto local `dashwood0..3` IDs
 * (`2385074..2385077`) using `Tichu::loadBugReportSQL()`.
 *
 * CLI Usage:
 *   php local/import-bug-sql.php path/to/bug_12345.sql [--state=75] [--players=2385074,2385075,2385076,2385077]
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

  foreach ($args as $arg) {
    if ($arg === '--help' || $arg === '-h') {
      echo "Usage: php local/import-bug-sql.php <path/to/bug.sql> [--state=<id>] [--players=id1,id2,id3,id4]\n";
      exit(0);
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

  if ($sqlPath === null) {
    fwrite(
      STDERR,
      "Usage: php local/import-bug-sql.php <path/to/bug.sql> [--state=<id>] [--players=id1,id2,id3,id4]\n"
    );
    exit(1);
  }

  try {
    $res = importBugSqlFile($sqlPath, $overrideStateId, $targetPlayers);
    echo "Imported {$sqlPath}\n";
    echo "  Previous state : {$res['previousStateId']}\n";
    echo "  Current state  : {$res['stateId']}\n";
    echo "  Active player  : {$res['activePlayerId']}\n";
    echo "  Player remap   : " . json_encode($res['playerMap']) . "\n";
    exit(0);
  } catch (\Throwable $e) {
    fwrite(STDERR, "Error importing bug SQL: " . $e->getMessage() . "\n");
    exit(1);
  }
}
