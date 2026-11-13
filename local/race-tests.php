<?php
/**
 * Concurrency / race stress test for the Tichu backend (NOT part of `npm test`).
 *
 * Bombards one shared, file-backed SQLite game with bursts of truly parallel requests sent by
 * persistent PHP worker processes, and checks strict game invariants after every burst.
 *
 * Each worker request is executed like a BGA AJAX request (`action_tichu` -> `Tichu`), inside
 * the MySQL/InnoDB REPEATABLE READ emulation of local/bga-backend.php (TICHU_DB_MVCC=1):
 * plain reads see the snapshot taken when the "framework" loaded the game state, writes and
 * `SELECT ... FOR UPDATE` wait for other writers. This reproduces production races such as two
 * tabs auto-collecting the same trick (double stNewTrick()) or a Tichu call / bomb arriving
 * while the active player plays.
 *
 * Every burst contains the legal moves a client would send for the current state, duplicated
 * from "other tabs", plus out-of-turn actions of the other players (Tichu calls, autopass,
 * bombs, confirmTichu), page loads (getAllDatas), zombie turns and random garbage requests.
 * All requests of a burst start at the same microsecond.
 *
 * Usage:
 *   php local/race-tests.php [--duration=60] [--workers=8] [--seed=N] [--reps=25]
 *                            [--skip-scenarios] [--baseline] [--verbose]
 *
 *   Phase 1 runs targeted scenarios (concurrent collects, Grand Tichu bets, card passing,
 *   Tichu calls and competing bombs), each --reps times with exact expectations.
 *   Phase 2 fuzzes whole games with random bursts for --duration seconds.
 *
 *   --baseline  Ignore all `FOR UPDATE` locks (as if the game had no locking). Demonstrates
 *               that the test detects the races; expected to FAIL.
 *
 * Exit code 0 when no invariant violation, unexpected exception or stuck game was detected.
 */

$projectRoot = dirname(__DIR__);
$opts = parseOptions($argv);

if (isset($opts['worker'])) {
  runWorker();
  exit(0);
}
exit(runMain($opts));

// ============================================================================================
// Shared helpers
// ============================================================================================

function parseOptions(array $argv): array
{
  $opts = [];
  foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^--([a-z-]+)(?:=(.*))?$/', $arg, $m)) {
      $opts[$m[1]] = $m[2] ?? true;
    }
  }
  return $opts;
}

function loadGameCode(): void
{
  global $projectRoot;
  ob_start();
  require_once __DIR__ . '/bga-backend.php';
  require_once $projectRoot . '/tichu.game.php';
  require_once $projectRoot . '/tichu.action.php';
  require_once __DIR__ . '/bot.php';
  require_once __DIR__ . '/scenarios.php';
  ob_end_clean();
}

// ============================================================================================
// Worker process: executes one emulated BGA request per stdin line.
// ============================================================================================

function runWorker(): void
{
  error_reporting(E_ALL);
  loadGameCode();
  while (($line = fgets(STDIN)) !== false) {
    $req = json_decode($line, true);
    if (!is_array($req)) {
      continue;
    }
    if (($req['kind'] ?? '') === 'exit') {
      break;
    }
    // Synchronize the start of all requests of a burst.
    $wait = (float) $req['startAt'] - microtime(true);
    if ($wait > 0.002) {
      usleep((int) (($wait - 0.001) * 1e6));
    }
    while (microtime(true) < (float) $req['startAt']) {
      // spin
    }
    $res = executeRequest($req);
    fwrite(STDOUT, json_encode($res) . "\n");
    fflush(STDOUT);
  }
}

function executeRequest(array $req): array
{
  $t0 = microtime(true);
  // On BGA any PHP warning/notice corrupts the JSON response of an action.
  set_error_handler(function (int $severity, string $message, string $file, int $line) {
    if (!(error_reporting() & $severity)) {
      return false;
    }
    throw new \ErrorException($message, 0, $severity, $file, $line);
  });
  ob_start();
  $game = null;
  try {
    $game = new \Tichu();
    $playerId = (int) $req['player'];
    $game->setCurrentPlayerId($playerId);
    switch ($req['kind']) {
      case 'action':
        $action = new \action_tichu($game, $req['args'] ?? []);
        $name = $req['action'];
        if (!method_exists($action, $name)) {
          throw new \Bga\GameFramework\UserException("Unknown game action: $name");
        }
        $action->$name();
        break;
      case 'zombie':
        // The framework calls zombieTurn() for the active player (from its cached state).
        $game->beginPlayerAction();
        $game->acquireGameLockOrFail();
        $state = $game->gamestate->state();
        $active =
          $state['type'] === 'multipleactiveplayer'
            ? (int) ($state['multiactive'][0] ?? 0)
            : (int) $state['active_player'];
        if ($active > 0 && in_array($state['type'], ['activeplayer', 'multipleactiveplayer'], true)) {
          $game->zombieTurn($state, $active);
        }
        $game->endPlayerAction();
        break;
      case 'read':
        // Page load / F5: getAllDatas() must never fail or block on game locks.
        $game->beginPlayerAction();
        $game->getFullClientPayload($playerId);
        $game->endPlayerAction(true);
        break;
      default:
        throw new \RuntimeException('Unknown request kind ' . $req['kind']);
    }
    $result = ['status' => 'ok'];
  } catch (\Bga\GameFramework\UserException $e) {
    rollbackRequest($game);
    $result = ['status' => 'user', 'message' => $e->getMessage()];
  } catch (\Throwable $e) {
    rollbackRequest($game);
    $trace = array_slice(
      array_map(
        fn($f) => basename($f['file'] ?? '?') . ':' . ($f['line'] ?? '?') . ' ' . ($f['function'] ?? ''),
        $e->getTrace()
      ),
      0,
      8
    );
    $result = [
      'status' => 'fatal',
      'class' => get_class($e),
      'message' => $e->getMessage(),
      'where' => basename($e->getFile()) . ':' . $e->getLine(),
      'trace' => $trace,
    ];
  }
  ob_end_clean();
  restore_error_handler();
  $result['ms'] = round((microtime(true) - $t0) * 1000, 2);
  return $result;
}

function rollbackRequest($game): void
{
  try {
    if ($game !== null) {
      $game->endPlayerAction(true);
    }
  } catch (\Throwable $e) {
    // ignore
  }
}

// ============================================================================================
// Main process: plans bursts, dispatches them to the workers, checks invariants.
// ============================================================================================

function chance(float $p): bool
{
  return mt_rand() / mt_getrandmax() < $p;
}

function pick(array $arr)
{
  return $arr[array_rand($arr)];
}

function runMain(array $opts): int
{
  $duration = (float) ($opts['duration'] ?? 60);
  $numWorkers = max(2, (int) ($opts['workers'] ?? 8));
  $seed = isset($opts['seed']) ? (int) $opts['seed'] : random_int(1, 1 << 30);
  $baseline = isset($opts['baseline']);
  $verbose = isset($opts['verbose']);
  mt_srand($seed);

  shell_exec('bash ' . escapeshellarg(__DIR__ . '/mysql-ctl.sh') . ' ensure');
  loadGameCode();
  global $g_config;
  $dbLabel = 'MySQL 8.0 (' . ($g_config['db_name'] ?? 'ebd_tichu_1') . ')';

  echo "====================================================================\n";
  echo " Tichu Race / Concurrency Stress Test (MySQL 8.0 + BGA FW)\n";
  echo "====================================================================\n";
  printf(
    " duration=%ss workers=%d seed=%d mode=%s\n db=%s\n\n",
    $duration,
    $numWorkers,
    $seed,
    $baseline ? 'BASELINE (locks ignored, expected to fail)' : 'locking',
    $dbLabel
  );

  $stats = [
    'games' => 0,
    'gamesFinished' => 0,
    'rounds' => 0,
    'tricks' => 0,
    'bursts' => 0,
    'requests' => 0,
    'ok' => 0,
    'user' => 0,
    'stale' => 0,
    'fatal' => 0,
    'violations' => 0,
    'stuck' => 0,
    'maxBurst' => 0,
    'byAction' => [],
    'fatalKinds' => [],
    'violationKinds' => [],
    'latencies' => [],
  ];

  $workers = spawnWorkers($numWorkers, $baseline);

  // Phase 1: targeted scenarios.
  $scenarioReport = [];
  $scenarioFailures = [];
  if (!isset($opts['skip-scenarios'])) {
    $t = microtime(true);
    $scenarioFailures = runTargetedScenarios($workers, (int) ($opts['reps'] ?? 25), $scenarioReport);
    printScenarioReport($scenarioReport, $scenarioFailures);
    printf(" (scenarios took %.1fs)\n\n Randomized burst fuzzing for %ss ...\n", microtime(true) - $t, $duration);
  }

  // Phase 2: randomized bursts across whole games.
  $game = startNewGame($stats);
  $deadline = microtime(true) + $duration;
  $lastProgressKey = null;
  $burstsWithoutProgress = 0;
  $lastVersion = -1;
  $detailsPrinted = 0;
  $lastReport = microtime(true);

  while (microtime(true) < $deadline) {
    $snap = readSnapshot($game);
    if ($snap['id'] === ST_GAME_END) {
      $stats['gamesFinished']++;
      accumulateGameStats($stats);
      $game = startNewGame($stats);
      $lastVersion = -1;
      continue;
    }

    $burst = planBurst($game, $snap);
    $results = dispatchBurst($workers, $burst);
    $stats['bursts']++;
    $stats['maxBurst'] = max($stats['maxBurst'], count($burst));

    $burstFatal = [];
    foreach ($burst as $i => $req) {
      $res = $results[$i];
      $label = $req['label'];
      $stats['requests']++;
      $stats['byAction'][$label] ??= ['ok' => 0, 'user' => 0, 'stale' => 0, 'fatal' => 0];
      $status = $res['status'];
      if ($status === 'user' && str_contains($res['message'], 'changed while your action')) {
        $status = 'stale';
      }
      $stats[$status === 'stale' ? 'stale' : $status]++;
      if ($status === 'stale') {
        $stats['user']++;
      }
      $stats['byAction'][$label][$status]++;
      $stats['latencies'][] = $res['ms'] ?? 0;
      if ($status === 'fatal') {
        $kind = $res['class'] . ': ' . preg_replace('/\d+/', 'N', $res['message']) . ' @' . $res['where'];
        $stats['fatalKinds'][$kind] = ($stats['fatalKinds'][$kind] ?? 0) + 1;
        $burstFatal[] = [$req, $res];
      }
    }

    $violations = checkInvariants($game, $baseline ? null : $lastVersion);
    $lastVersion = (int) \APP_DbObject::getUniqueValueFromDB(
      'SELECT global_value FROM global WHERE global_id = ' . \Tichu::GLOBAL_LOCK_VERSION
    );

    // Liveness: the game must keep moving while legal moves are being sent.
    $after = readSnapshot($game);
    $progressKey = $after['id'] . '|' . $after['active'] . '|' . md5(json_encode($after['hands']));
    if ($progressKey === $lastProgressKey) {
      $burstsWithoutProgress++;
    } else {
      $burstsWithoutProgress = 0;
      $lastProgressKey = $progressKey;
    }
    if ($burstsWithoutProgress >= 150) {
      $violations[] = "STUCK: no progress for 150 bursts in state {$after['name']} (active {$after['active']})";
    }

    if (!empty($violations) || !empty($burstFatal)) {
      foreach ($violations as $v) {
        $k = preg_replace('/\d+/', 'N', $v);
        $stats['violationKinds'][$k] = ($stats['violationKinds'][$k] ?? 0) + 1;
      }
      $stats['violations'] += count($violations);
      if ($detailsPrinted < 3 || $verbose) {
        $detailsPrinted++;
        printFailureDetails($snap, $burst, $results, $violations);
      }
      if (!empty($violations)) {
        // Continue on a fresh game so one corruption does not cascade.
        accumulateGameStats($stats);
        $game = startNewGame($stats);
        $lastVersion = -1;
        $lastProgressKey = null;
        $burstsWithoutProgress = 0;
      }
    }

    if (microtime(true) - $lastReport >= 10) {
      $lastReport = microtime(true);
      printf(
        "  [%5.1fs] bursts=%d requests=%d ok=%d user=%d (stale=%d) fatal=%d violations=%d games=%d\n",
        $duration - ($deadline - microtime(true)),
        $stats['bursts'],
        $stats['requests'],
        $stats['ok'],
        $stats['user'],
        $stats['stale'],
        $stats['fatal'],
        $stats['violations'],
        $stats['games']
      );
    }
  }
  accumulateGameStats($stats);
  stopWorkers($workers);
  $result = printSummary($stats, $duration, $seed);
  if (!empty($scenarioFailures)) {
    echo " Targeted scenarios FAILED (see above).\n";
    return 1;
  }
  return $result;
}

function startNewGame(array &$stats): \Tichu
{
  $game = new \Tichu();
  $game->createNewGame(['gameLength' => 1, 'turnBased' => chance(0.3)]);
  $stats['games']++;
  return $game;
}

function accumulateGameStats(array &$stats): void
{
  $stats['rounds'] += (int) \APP_DbObject::getUniqueValueFromDB(
    "SELECT COUNT(*) FROM actionlog WHERE log_action = 'newRound'"
  );
  $stats['tricks'] += (int) \APP_DbObject::getUniqueValueFromDB(
    "SELECT COUNT(*) FROM actionlog WHERE log_action = 'newTrick'"
  );
}

function spawnWorkers(int $n, bool $baseline): array
{
  $workers = [];
  $env = array_merge(getenv(), [
    'TICHU_DB_IGNORE_LOCKS' => $baseline ? '1' : '0',
  ]);
  for ($i = 0; $i < $n; $i++) {
    $pipes = [];
    $proc = proc_open(
      [PHP_BINARY, '-d', 'memory_limit=512M', __FILE__, '--worker'],
      [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['file', sys_get_temp_dir() . "/tichu-race-worker-$i.log", 'w']],
      $pipes,
      dirname(__DIR__),
      $env
    );
    if (!is_resource($proc)) {
      throw new \RuntimeException('Failed to spawn worker');
    }
    $workers[] = ['proc' => $proc, 'in' => $pipes[0], 'out' => $pipes[1], 'id' => $i];
  }
  return $workers;
}

function stopWorkers(array $workers): void
{
  foreach ($workers as $w) {
    @fwrite($w['in'], json_encode(['kind' => 'exit']) . "\n");
    @fclose($w['in']);
    @fclose($w['out']);
    proc_close($w['proc']);
  }
}

/** Sends all requests of a burst so that they start at the same time; returns the results. */
function dispatchBurst(array $workers, array $burst): array
{
  $results = [];
  foreach (array_chunk($burst, count($workers), true) as $chunk) {
    $startAt = microtime(true) + 0.004;
    $assigned = [];
    $w = 0;
    foreach ($chunk as $idx => $req) {
      $req['startAt'] = $startAt;
      fwrite($workers[$w]['in'], json_encode($req) . "\n");
      $assigned[$idx] = $w;
      $w++;
    }
    foreach ($assigned as $idx => $wi) {
      $line = fgets($workers[$wi]['out']);
      if ($line === false) {
        $log = @file_get_contents(sys_get_temp_dir() . "/tichu-race-worker-$wi.log");
        throw new \RuntimeException("Worker $wi died. Log:\n" . $log);
      }
      $results[$idx] = json_decode($line, true);
    }
  }
  return $results;
}

function stateDef(\Tichu $game, int $stateId): ?array
{
  $def = $game->gamestate->states[$stateId] ?? null;
  if ($def === null) {
    return null;
  }
  return is_object($def) ? $def->toArray() : $def;
}

function readSnapshot(\Tichu $game): array
{
  $stateId = (int) \APP_DbObject::getUniqueValueFromDB('SELECT global_value FROM global WHERE global_id = 1');
  $def = stateDef($game, $stateId) ?? ['name' => 'unknown', 'type' => 'unknown'];
  $players = array_map('intval', \PlayerManager::getPlayerIds());
  sort($players);
  $hands = [];
  foreach ($players as $p) {
    $hands[$p] = array_values(\CardManager::getDeck()->getCardsInLocation('hand', $p, 'card_id'));
  }
  $multi = array_map(
    'intval',
    \APP_DbObject::getObjectListFromDB(
      'SELECT player_id FROM player WHERE player_is_multiactive = 1 ORDER BY player_no',
      true
    )
  );
  return [
    'id' => $stateId,
    'name' => $def['name'] ?? 'unknown',
    'type' => $def['type'] ?? 'unknown',
    'active' => (int) \APP_DbObject::getUniqueValueFromDB('SELECT global_value FROM global WHERE global_id = 2'),
    'multi' => $def['type'] === 'multipleactiveplayer' ? $multi : [],
    'players' => $players,
    'hands' => $hands,
  ];
}

// --------------------------------------------------------------------------------------------
// Targeted scenarios: known production race patterns, each repeated many times
// --------------------------------------------------------------------------------------------

function act(int $player, string $action, array $args = [], ?string $label = null): array
{
  return ['kind' => 'action', 'player' => $player, 'action' => $action, 'args' => $args, 'label' => $label ?? $action];
}

function statValue(string $name, int $pid = 0): int
{
  $game = \Tichu::$instance;
  if ($game === null) {
    return 0;
  }
  return (int) $game->getStat($name, $pid > 0 ? $pid : null);
}

function stateName(\Tichu $game): string
{
  return readSnapshot($game)['name'];
}

function driveBotUntil(\Tichu $game, string $stateName, int $maxSteps = 400): bool
{
  for ($i = 0; $i < $maxSteps; $i++) {
    $name = stateName($game);
    if ($name === $stateName) {
      return true;
    }
    if ($name === 'gameEnd') {
      return false;
    }
    \LocalTichuBot::stepSingleBotTurn($game);
  }
  return false;
}

/**
 * Runs each scenario $reps times. Returns a list of failure descriptions; $stats collects
 * per-scenario counters for the report.
 */
function runTargetedScenarios(array $workers, int $reps, array &$report): array
{
  $failures = [];
  $P0 = \LocalTichuScenarios::P0;
  $P1 = \LocalTichuScenarios::P1;
  $P2 = \LocalTichuScenarios::P2;
  $P3 = \LocalTichuScenarios::P3;
  $all = [$P0, $P1, $P2, $P3];

  $scenarios = [
    // Two or more tabs of the trick winner auto-collect at the same time (table 1001590).
    'collect x4 (+autopass)' => function () use ($workers, $all) {
      $game = new \Tichu();
      $game->createNewGame(['gameLength' => 1]);
      if (!driveBotUntil($game, 'confirmTrick')) {
        return ['skip' => true];
      }
      $winner = readSnapshot($game)['active'];
      $tricksBefore = statValue('trick_number');
      $wonBefore = array_sum(array_map(fn($p) => statValue('tricks_win', $p), $all));
      $reqs = [act($winner, 'collect'), act($winner, 'collect', [], 'collect(dup)'), act($winner, 'collect', [], 'collect(dup)'), act($winner, 'collect', [], 'collect(dup)')];
      foreach ($all as $p) {
        if ($p !== $winner) {
          $reqs[] = act($p, 'pass', ['onlyOnce' => 'true'], 'autopass');
        }
      }
      $results = dispatchBurst($workers, $reqs);
      $errs = [];
      $state = stateName($game);
      $wonAfter = array_sum(array_map(fn($p) => statValue('tricks_win', $p), $all));
      if ($state === 'chooseDragonGift') {
        if ($wonAfter !== $wonBefore) {
          $errs[] = 'tricks_win changed before the dragon gift';
        }
      } else {
        if (statValue('trick_number') !== $tricksBefore + 1) {
          $errs[] = 'trick_number +' . (statValue('trick_number') - $tricksBefore) . ' (expected +1)';
        }
        if ($wonAfter !== $wonBefore + 1) {
          $errs[] = 'tricks_win +' . ($wonAfter - $wonBefore) . ' (expected +1)';
        }
      }
      foreach (array_slice($results, 0, 4) as $r) {
        if ($r['status'] !== 'ok') {
          $errs[] = "collect returned {$r['status']}: " . ($r['message'] ?? '');
        }
      }
      return ['results' => $results, 'reqs' => $reqs, 'errors' => $errs, 'game' => $game];
    },

    // All four players (and a second tab each) decide on Grand Tichu at the same moment.
    'grandTichuBet x4 players (+dups)' => function () use ($workers, $all) {
      $game = new \Tichu();
      \LocalTichuScenarios::setupScenario($game, 'grand_tichu');
      $reqs = [];
      foreach ($all as $p) {
        $reqs[] = act($p, 'grandTichuBet', ['bet' => '0']);
        $reqs[] = act($p, 'grandTichuBet', ['bet' => '0'], 'grandTichuBet(dup)');
      }
      $results = dispatchBurst($workers, $reqs);
      $errs = [];
      if (stateName($game) !== 'giveCards') {
        $errs[] = 'state is ' . stateName($game) . ' instead of giveCards';
      }
      $okPerPlayer = [];
      foreach ($reqs as $i => $req) {
        if ($results[$i]['status'] === 'ok') {
          $okPerPlayer[$req['player']] = ($okPerPlayer[$req['player']] ?? 0) + 1;
        }
      }
      foreach ($all as $p) {
        if (($okPerPlayer[$p] ?? 0) !== 1) {
          $errs[] = "player $p: " . ($okPerPlayer[$p] ?? 0) . ' successful bets (expected 1)';
        }
      }
      return ['results' => $results, 'reqs' => $reqs, 'errors' => $errs, 'game' => $game];
    },

    // All four players pass their 3 cards at the same moment.
    'giveTheCards x4 players' => function () use ($workers, $all) {
      $game = new \Tichu();
      $game->createNewGame(['gameLength' => 1]);
      if (!driveBotUntil($game, 'giveCards') || count(readSnapshot($game)['multi']) !== 4) {
        return ['skip' => true];
      }
      $reqs = [];
      foreach ($all as $p) {
        $reqs[] = act($p, 'giveTheCards', ['cards' => implode(';', \LocalTichuBot::pickThreeCardsToGive($p))]);
      }
      $results = dispatchBurst($workers, $reqs);
      $errs = [];
      $retry = [];
      foreach ($reqs as $i => $req) {
        if ($results[$i]['status'] !== 'ok') {
          if (!str_contains($results[$i]['message'] ?? '', 'changed while')) {
            $errs[] = "player {$req['player']}: {$results[$i]['status']} {$results[$i]['message']}";
          }
          $retry[] = $req;
        }
      }
      if (count($retry) > 1) {
        $errs[] = count($retry) . ' players had to retry (only the last one may)';
      }
      // A client shows the error and the player clicks again.
      foreach ($retry as $req) {
        $r = dispatchBurst($workers, [$req])[0];
        if ($r['status'] !== 'ok') {
          $errs[] = "retry of player {$req['player']} failed: {$r['message']}";
        }
      }
      if (stateName($game) !== 'playComboOpen') {
        $errs[] = 'state is ' . stateName($game) . ' instead of playComboOpen';
      }
      return ['results' => $results, 'reqs' => $reqs, 'errors' => $errs, 'game' => $game, 'retries' => count($retry)];
    },

    // Three players call Tichu while the active player passes.
    'tichuBet x3 vs pass' => function () use ($workers, $P0, $P1, $P2, $P3) {
      $game = new \Tichu();
      \LocalTichuScenarios::setupScenario($game, 'bomb_interrupt'); // P1 active in playCombo
      $reqs = [act($P1, 'pass', ['onlyOnce' => 'true']), act($P1, 'tichuBet', ['bet' => '100']), act($P2, 'tichuBet', ['bet' => '100']), act($P3, 'tichuBet', ['bet' => '100']), act($P3, 'tichuBet', ['bet' => '100'], 'tichuBet(dup)')];
      $results = dispatchBurst($workers, $reqs);
      $errs = [];
      foreach ([$P1, $P2, $P3] as $p) {
        $calls = (int) \APP_DbObject::getUniqueValueFromDB("SELECT COUNT(*) FROM actionlog WHERE log_action = 'tichuCall' AND log_player = $p");
        $confirm = (int) \APP_DbObject::getUniqueValueFromDB("SELECT COUNT(*) FROM gamelog WHERE gamelog_player = $p AND gamelog_notification LIKE '%\"type\":\"confirmTichu\"%'");
        if ($calls + $confirm < 1) {
          $errs[] = "player $p: Tichu call lost";
        }
        if ($calls > 1 || statValue('tichu_number', $p) !== $calls) {
          $errs[] = "player $p: $calls tichuCall entries, tichu_number=" . statValue('tichu_number', $p);
        }
      }
      foreach ($reqs as $i => $req) {
        if ($req['action'] === 'tichuBet' && str_contains($results[$i]['message'] ?? '', 'changed while')) {
          $errs[] = "player {$req['player']}: Tichu call rejected as stale";
        }
      }
      return ['results' => $results, 'reqs' => $reqs, 'errors' => $errs, 'game' => $game];
    },

    // Two players bomb at the same time while the active player passes.
    'playBomb x2 vs pass' => function () use ($workers, $P0, $P1, $P2) {
      $game = new \Tichu();
      \LocalTichuScenarios::setupScenario($game, 'bomb_interrupt');
      $bomb8 = implode(';', \LocalTichuScenarios::getCardIds([[1, 8], [2, 8], [3, 8], [4, 8]]));
      $bomb7 = implode(';', \LocalTichuScenarios::getCardIds([[1, 7], [2, 7], [3, 7], [4, 7]]));
      $reqs = [act($P1, 'pass', ['onlyOnce' => 'true']), act($P0, 'playBomb', ['cards' => $bomb8]), act($P2, 'playBomb', ['cards' => $bomb7]), act($P2, 'playBomb', ['cards' => $bomb7], 'playBomb(dup)')];
      $results = dispatchBurst($workers, $reqs);
      $errs = [];
      $bombsAccepted = 0;
      foreach ($reqs as $i => $req) {
        if (str_starts_with($req['label'], 'playBomb') && $results[$i]['status'] === 'ok') {
          $bombsAccepted++;
        }
      }
      if ($bombsAccepted > 1) {
        $errs[] = "$bombsAccepted bomb interrupts accepted at once";
      }
      $s = readSnapshot($game);
      if ($bombsAccepted === 1 && $s['name'] !== 'playBomb') {
        $errs[] = "bomb accepted but state is {$s['name']}";
      }
      if ($s['name'] === 'playBomb') {
        // The bomber now plays the bomb (from two tabs).
        $bomb = $s['active'] === $P0 ? $bomb8 : $bomb7;
        $r2 = dispatchBurst($workers, [act($s['active'], 'playCombo', ['cards' => $bomb]), act($s['active'], 'playCombo', ['cards' => $bomb], 'playCombo(dup)')]);
        $okCount = count(array_filter($r2, fn($r) => $r['status'] === 'ok'));
        if ($okCount !== 1) {
          $errs[] = "bomb played $okCount times";
        }
        $results = array_merge($results, $r2);
      }
      return ['results' => $results, 'reqs' => $reqs, 'errors' => $errs, 'game' => $game];
    },
  ];

  foreach ($scenarios as $name => $fn) {
    $row = ['runs' => 0, 'ok' => 0, 'user' => 0, 'stale' => 0, 'fatal' => 0, 'failed' => 0, 'skipped' => 0, 'retries' => 0];
    for ($i = 0; $i < $reps; $i++) {
      $out = $fn();
      if (!empty($out['skip'])) {
        $row['skipped']++;
        continue;
      }
      $row['runs']++;
      $row['retries'] += $out['retries'] ?? 0;
      $errs = $out['errors'];
      foreach ($out['results'] as $r) {
        $status = $r['status'];
        if ($status === 'user' && str_contains($r['message'], 'changed while')) {
          $status = 'stale';
        }
        $row[$status]++;
        if ($status === 'fatal') {
          $errs[] = "FATAL {$r['class']}: {$r['message']} @{$r['where']}";
        }
      }
      $errs = array_merge($errs, checkInvariants($out['game'], null));
      if (!empty($errs)) {
        $row['failed']++;
        if (count($failures) < 10) {
          $failures[] = "$name: " . implode(' | ', array_unique($errs));
        }
      }
      if (getenv('RACE_DEBUG')) {
        foreach ($out['results'] as $k => $r) {
          $label = $out['reqs'][$k]['label'] ?? '?';
          echo "      [$name #$i] $label p=" . ($out['reqs'][$k]['player'] ?? '?') . " {$r['status']} " . ($r['message'] ?? '') . "\n";
        }
      }
    }
    $report[$name] = $row;
  }
  return $failures;
}

function printScenarioReport(array $report, array $failures): void
{
  echo " Targeted race scenarios (requests: ok / rejected / stale-retry / fatal):\n";
  foreach ($report as $name => $r) {
    printf(
      "   %-34s %3d runs %s  %4d / %4d / %4d / %d%s\n",
      $name,
      $r['runs'],
      $r['failed'] ? 'FAILED x' . $r['failed'] : 'pass     ',
      $r['ok'],
      $r['user'],
      $r['stale'],
      $r['fatal'],
      $r['retries'] ? "  ({$r['retries']} retries)" : ''
    );
  }
  foreach ($failures as $f) {
    echo "   ! $f\n";
  }
  echo "\n";
}

// --------------------------------------------------------------------------------------------
// Burst planning
// --------------------------------------------------------------------------------------------

function ids(array $cards): string
{
  return implode(';', array_map(fn($c) => (string) $c['id'], $cards));
}

/** Returns the cards of a four-of-a-kind bomb in $hand, or null. */
function findFourOfAKind(array $hand): ?array
{
  $byRank = [];
  foreach ($hand as $c) {
    if ((int) $c['type_arg'] >= 2) {
      $byRank[(int) $c['type_arg']][] = $c;
    }
  }
  foreach ($byRank as $cards) {
    if (count($cards) === 4) {
      return $cards;
    }
  }
  return null;
}

/** The move a well-behaved client of the active player would send in playCombo. */
function decidePlayComboMove(\Tichu $game, int $pid, array $hand): array
{
  $last = \LogManager::getLastCombo();
  $wish = (int) $game->getGameStateValue('mahjongWish');
  if ($wish > 0 && (new \Hand($hand))->canFulFillWish($wish, $last)) {
    $idsList = \LocalTichuBot::findPlayableComboIds($hand, $last, $wish);
    if (!empty($idsList)) {
      return ['playCombo', ['cards' => implode(';', $idsList)]];
    }
  }
  if (chance(0.45)) {
    $idsList = \LocalTichuBot::findPlayableComboIds($hand, $last, 0, true);
    if (!empty($idsList)) {
      return ['playCombo', ['cards' => implode(';', $idsList)]];
    }
  }
  return ['pass', ['onlyOnce' => 'true']];
}

function planBurst(\Tichu $game, array $s): array
{
  $reqs = [];
  $add = function (int $player, string $action, array $args = [], ?string $label = null) use (&$reqs) {
    $reqs[] = ['kind' => 'action', 'player' => $player, 'action' => $action, 'args' => $args, 'label' => $label ?? $action];
  };
  $active = $s['active'];
  $hands = $s['hands'];

  // 1. Legal moves for the current state.
  $primary = [];
  switch ($s['name']) {
    case 'grandTichuBets':
      foreach ($s['multi'] as $p) {
        $primary[] = [$p, 'grandTichuBet', ['bet' => chance(0.05) ? '200' : '0']];
      }
      break;
    case 'giveCards':
      foreach ($s['multi'] as $p) {
        $cardIds = \LocalTichuBot::pickThreeCardsToGive($p);
        shuffle($cardIds);
        $primary[] = [$p, 'giveTheCards', ['cards' => implode(';', $cardIds)]];
      }
      break;
    case 'showPassedCards':
      foreach ($s['multi'] as $p) {
        $primary[] = [$p, 'acceptCards', []];
      }
      break;
    case 'playComboOpen':
      $cardIds = \LocalTichuBot::pickOpeningComboCards($game, $active);
      $primary[] = [$active, 'playCombo', ['cards' => implode(';', $cardIds)]];
      break;
    case 'playCombo':
      [$a, $args] = decidePlayComboMove($game, $active, $hands[$active]);
      $primary[] = [$active, $a, $args];
      break;
    case 'mahjongPlay':
      $primary[] = [$active, 'makeAWish', ['wish' => (string) (chance(0.3) ? 15 : mt_rand(2, 14))]];
      break;
    case 'phoenixPlay':
      if (chance(0.15)) {
        $primary[] = [$active, 'cancelPhoenix', []];
      } else {
        $vals = \LogManager::getLastCombo(0, 'phoenix')->phoenixValue;
        $val = is_array($vals) && !empty($vals) ? pick($vals) : 2;
        $primary[] = [$active, 'choosePhoenix', ['phoenixValue' => (string) $val]];
      }
      break;
    case 'confirmTrick':
      $primary[] = [$active, 'collect', []];
      break;
    case 'chooseDragonGift':
      $primary[] = [$active, 'chooseDragonGift', ['player' => (string) mt_rand(0, 1)]];
      break;
    case 'playBomb':
      $bomb = findFourOfAKind($hands[$active] ?? []);
      if ($bomb !== null && (new \Combo($bomb))->canBeat(\LogManager::getLastCombo()) && chance(0.85)) {
        $primary[] = [$active, 'playCombo', ['cards' => ids($bomb)]];
      } else {
        $primary[] = [$active, 'cancel', []];
      }
      break;
  }
  foreach ($primary as [$p, $a, $args]) {
    $add($p, $a, $args);
    // The same move from other open tabs / devices of the same player.
    $dups = chance(0.5) ? mt_rand(1, 3) : 0;
    for ($i = 0; $i < $dups; $i++) {
      $add($p, $a, $args, "$a(dup)");
    }
  }

  // 2. Out-of-turn actions of all players.
  $inTrick = in_array($s['name'], ['playComboOpen', 'playCombo', 'confirmTrick'], true);
  foreach ($s['players'] as $p) {
    if (chance(0.05)) {
      $add($p, 'tichuBet', ['bet' => '100']);
    }
    if (chance(0.02)) {
      $add($p, 'confirmTichu', ['bet' => pick(['0', '100', '200'])]);
    }
    if ($inTrick) {
      if ($p !== $active && chance(0.2)) {
        $add($p, 'pass', ['onlyOnce' => chance(0.5) ? 'true' : 'false'], 'autopass');
      }
      if (chance(0.1)) {
        $add($p, 'cancelAutopass');
      }
      $bomb = findFourOfAKind($hands[$p] ?? []);
      if ($bomb !== null && chance(0.3)) {
        $add($p, 'playBomb', ['cards' => ids($bomb)]);
      }
    }
  }

  // 3. Page loads, zombie turns and garbage.
  if (chance(0.25)) {
    $reqs[] = ['kind' => 'read', 'player' => pick($s['players']), 'label' => 'getAllDatas'];
  }
  if (chance(0.03)) {
    $reqs[] = ['kind' => 'zombie', 'player' => pick($s['players']), 'label' => 'zombieTurn'];
  }
  if (chance(0.2)) {
    $reqs[] = fuzzRequest($s);
  }
  shuffle($reqs);
  return $reqs;
}

function fuzzRequest(array $s): array
{
  $player = pick($s['players']);
  $allCards = array_merge(...array_values($s['hands']));
  $randomCards = function () use ($allCards) {
    $n = mt_rand(0, 5);
    $out = [];
    for ($i = 0; $i < $n; $i++) {
      $out[] = chance(0.8) && !empty($allCards) ? pick($allCards)['id'] : mt_rand(-2, 70);
    }
    return implode(';', $out);
  };
  $actions = [
    'grandTichuBet' => fn() => ['bet' => pick(['0', '200', '100', 'x'])],
    'tichuBet' => fn() => ['bet' => pick(['100', '0'])],
    'confirmTichu' => fn() => ['bet' => pick(['0', '100', '200', '50'])],
    'makeAWish' => fn() => ['wish' => (string) mt_rand(-1, 20)],
    'choosePhoenix' => fn() => ['phoenixValue' => (string) mt_rand(0, 16)],
    'playCombo' => fn() => ['cards' => $randomCards()],
    'playBomb' => fn() => ['cards' => $randomCards()],
    'pass' => fn() => ['onlyOnce' => pick(['true', 'false', '1', '0'])],
    'cancelAutopass' => fn() => [],
    'giveTheCards' => fn() => ['cards' => $randomCards()],
    'acceptCards' => fn() => [],
    'collect' => fn() => [],
    'cancelPhoenix' => fn() => [],
    'cancel' => fn() => [],
    'chooseDragonGift' => fn() => ['player' => (string) mt_rand(0, 3)],
  ];
  $action = array_rand($actions);
  return [
    'kind' => 'action',
    'player' => $player,
    'action' => $action,
    'args' => $actions[$action](),
    'label' => "fuzz:$action",
  ];
}

// --------------------------------------------------------------------------------------------
// Invariants
// --------------------------------------------------------------------------------------------

function checkInvariants(\Tichu $game, ?int $lastVersion): array
{
  $errs = [];
  $db = '\APP_DbObject';
  $cards = $db::getObjectListFromDB(
    'SELECT card_id id, card_type type, card_type_arg type_arg, card_location location, card_location_arg location_arg, card_passed_from passed_from FROM card'
  );
  $players = array_map('intval', $db::getObjectListFromDB('SELECT player_id FROM player ORDER BY player_no', true));
  $playerRows = $db::getCollectionFromDB(
    'SELECT player_id, player_no, player_team team, player_score score, player_call_tichu call_tichu, player_call_grand_tichu call_grand_tichu, player_is_multiactive multi, player_pass pass FROM player'
  );

  // --- 56 cards, no duplicates, valid locations
  if (count($cards) !== 56) {
    $errs[] = 'card count is ' . count($cards) . ' instead of 56';
  }
  $faces = array_unique(array_map(fn($c) => $c['type'] . '-' . $c['type_arg'], $cards));
  if (count($faces) !== count($cards)) {
    $errs[] = 'duplicate card faces in card table';
  }
  $byLoc = ['deck' => 0, 'hand' => 0, 'temporary' => 0, 'combos' => 0, 'captured' => 0];
  $hand = array_fill_keys($players, 0);
  $givenBy = array_fill_keys($players, []);
  $combosIds = [];
  foreach ($cards as $c) {
    $loc = $c['location'];
    if (!array_key_exists($loc, $byLoc)) {
      $errs[] = "card {$c['id']} in invalid location '$loc'";
      continue;
    }
    $byLoc[$loc]++;
    $arg = (int) $c['location_arg'];
    if (in_array($loc, ['hand', 'temporary', 'captured'], true) && !in_array($arg, $players, true)) {
      $errs[] = "card {$c['id']} in $loc of unknown player $arg";
      continue;
    }
    if ($loc === 'hand') {
      $hand[$arg]++;
    }
    if ($loc === 'temporary') {
      $from = (int) $c['passed_from'];
      if (!in_array($from, $players, true) || $from === $arg) {
        $errs[] = "temporary card {$c['id']} passed from invalid player $from to $arg";
      } else {
        $givenBy[$from][] = $arg;
      }
    }
    if ($loc === 'combos') {
      $combosIds[] = (int) $c['id'];
    }
  }

  // --- state machine
  $stateId = (int) $db::getUniqueValueFromDB('SELECT global_value FROM global WHERE global_id = 1');
  $active = (int) $db::getUniqueValueFromDB('SELECT global_value FROM global WHERE global_id = 2');
  $def = stateDef($game, $stateId);
  if ($def === null) {
    $errs[] = "unknown state id $stateId";
    return $errs;
  }
  $type = $def['type'] ?? '';
  if (!in_array($type, ['activeplayer', 'multipleactiveplayer'], true) && $stateId !== ST_GAME_END) {
    $errs[] = "game rests in non-interactive state {$def['name']} ($type)";
  }
  $multi = array_values(array_filter($players, fn($p) => (int) $playerRows[$p]['multi'] === 1));
  if ($type === 'multipleactiveplayer' && empty($multi)) {
    $errs[] = "multiactive state {$def['name']} without any active player (stuck)";
  }
  if ($type === 'activeplayer' && !in_array($active, $players, true)) {
    $errs[] = "active player $active is not a player";
  }

  $playStates = [ST_PLAY_COMBO_OPEN, ST_PLAY_COMBO, ST_PLAY_BOMB, ST_PHOENIX_PLAY, ST_MAHJONG_PLAY, ST_CONFIRM_TRICK, ST_CHOOSE_DRAGON_GIFT];
  switch ($stateId) {
    case ST_GRAND_TICHU_BETS:
      if ($byLoc['deck'] !== 24 || $byLoc['hand'] !== 32) {
        $errs[] = "grandTichuBets: deck={$byLoc['deck']} hand={$byLoc['hand']} (expected 24/32)";
      }
      foreach ($players as $p) {
        if ($hand[$p] !== 8) {
          $errs[] = "grandTichuBets: player $p has {$hand[$p]} cards";
        }
        $undecided = (int) $playerRows[$p]['call_grand_tichu'] === -1;
        if ($undecided !== in_array($p, $multi, true)) {
          $errs[] = "grandTichuBets: player $p multiactive=" . (int) in_array($p, $multi, true) . " but call_grand_tichu={$playerRows[$p]['call_grand_tichu']}";
        }
      }
      break;
    case ST_GIVE_CARDS:
      if ($byLoc['deck'] !== 0 || $byLoc['combos'] !== 0 || $byLoc['captured'] !== 0) {
        $errs[] = 'giveCards: unexpected cards in deck/combos/captured';
      }
      foreach ($players as $p) {
        $given = $givenBy[$p];
        if ($hand[$p] + count($given) !== 14) {
          $errs[] = "giveCards: player $p has {$hand[$p]} in hand + " . count($given) . ' given != 14';
        }
        if (!in_array(count($given), [0, 3], true) || count(array_unique($given)) !== count($given)) {
          $errs[] = "giveCards: player $p passed cards to " . json_encode($given);
        }
        if ((count($given) === 0) !== in_array($p, $multi, true)) {
          $errs[] = "giveCards: player $p multiactive=" . (int) in_array($p, $multi, true) . ' but passed ' . count($given);
        }
      }
      break;
    default:
      if (in_array($stateId, $playStates, true)) {
        if ($byLoc['deck'] !== 0 || $byLoc['temporary'] !== 0) {
          $errs[] = "{$def['name']}: deck={$byLoc['deck']} temporary={$byLoc['temporary']} during play";
        }
        if (in_array($stateId, [ST_PLAY_COMBO_OPEN, ST_PLAY_COMBO], true) && ($hand[$active] ?? 0) === 0) {
          $errs[] = "{$def['name']}: active player $active has no cards";
        }
        // Cards on the table == cards logged as played in the current trick.
        $logged = [];
        foreach (\LogManager::getLastActions('combo') as $a) {
          foreach ($a['arg']['cards'] ?? [] as $c) {
            $logged[] = (int) $c['id'];
          }
        }
        sort($logged);
        sort($combosIds);
        if ($logged !== $combosIds) {
          $errs[] = "{$def['name']}: table cards " . json_encode($combosIds) . ' != logged trick cards ' . json_encode($logged);
        }
      }
  }

  // --- action log: rounds and tricks are counted exactly once
  $logs = $db::getObjectListFromDB(
    "SELECT log_id, log_player, log_round, log_trick, log_action FROM actionlog WHERE log_action IN ('newRound', 'newTrick', 'tichuCall') ORDER BY log_id"
  );
  $round = 0;
  $trick = 0;
  $newTricks = 0;
  $tichuCalls = array_fill_keys($players, 0);
  foreach ($logs as $l) {
    if ($l['log_action'] === 'newRound') {
      if ((int) $l['log_round'] !== $round + 1) {
        $errs[] = "actionlog: newRound {$l['log_round']} after round $round (log {$l['log_id']})";
      }
      $round = (int) $l['log_round'];
      $trick = 0;
    } elseif ($l['log_action'] === 'newTrick') {
      $newTricks++;
      if ((int) $l['log_round'] !== $round || (int) $l['log_trick'] !== $trick + 1) {
        $errs[] = "actionlog: duplicate/skipped newTrick r{$l['log_round']}t{$l['log_trick']} after r{$round}t{$trick} (log {$l['log_id']})";
      }
      $trick = (int) $l['log_trick'];
    } else {
      $tichuCalls[(int) $l['log_player']] = ($tichuCalls[(int) $l['log_player']] ?? 0) + 1;
    }
  }
  $stat = fn($name, $pid = 0) => statValue($name, $pid);
  if ($stat('trick_number') !== $newTricks) {
    $errs[] = "stats: trick_number={$stat('trick_number')} but $newTricks newTrick log entries";
  }
  if ($stat('round_number') !== $round) {
    $errs[] = "stats: round_number={$stat('round_number')} but $round rounds";
  }
  $tricksWon = 0;
  foreach ($players as $p) {
    $calls = $stat('tichu_number', $p) + $stat('grandtichu_number', $p);
    if ($calls !== $tichuCalls[$p]) {
      $errs[] = "stats: player $p tichu+grandtichu stats=$calls but {$tichuCalls[$p]} tichuCall log entries";
    }
    $tricksWon += $stat('tricks_win', $p);
  }
  if ($tricksWon > $newTricks) {
    $errs[] = "stats: $tricksWon tricks won but only $newTricks tricks started";
  }

  // --- players
  foreach ($players as $p) {
    $r = $playerRows[$p];
    if (!in_array((int) $r['call_tichu'], [-1, 0, 100], true) || !in_array((int) $r['call_grand_tichu'], [-1, 0, 200], true)) {
      $errs[] = "player $p has invalid bets tichu={$r['call_tichu']} grand={$r['call_grand_tichu']}";
    }
    if ((int) $r['call_tichu'] === 100 && (int) $r['call_grand_tichu'] === 200) {
      $errs[] = "player $p called both Tichu and Grand Tichu";
    }
    if ((int) $r['score'] % 5 !== 0) {
      $errs[] = "player $p has score {$r['score']}";
    }
    foreach ($players as $q) {
      if ($playerRows[$q]['team'] === $r['team'] && $playerRows[$q]['score'] !== $r['score']) {
        $errs[] = "team mates $p and $q have different scores";
      }
    }
  }
  $wish = (int) $db::getUniqueValueFromDB('SELECT global_value FROM global WHERE global_id = 26');
  if ($wish !== 0 && ($wish < 2 || $wish > 14)) {
    $errs[] = "invalid mahjong wish $wish";
  }

  // --- the version row only grows
  if ($lastVersion !== null && $lastVersion >= 0) {
    $version = (int) $db::getUniqueValueFromDB(
      'SELECT global_value FROM global WHERE global_id = ' . \Tichu::GLOBAL_LOCK_VERSION
    );
    if ($version < $lastVersion) {
      $errs[] = "lock version decreased from $lastVersion to $version";
    }
  }
  return array_values(array_unique($errs));
}

// --------------------------------------------------------------------------------------------
// Reporting
// --------------------------------------------------------------------------------------------

function printFailureDetails(array $snap, array $burst, array $results, array $violations): void
{
  echo "\n  ---- failure in state {$snap['name']} (active {$snap['active']}) ----\n";
  foreach ($violations as $v) {
    echo "  VIOLATION: $v\n";
  }
  foreach ($burst as $i => $req) {
    $res = $results[$i];
    $line = sprintf(
      '    %-22s p=%d %-6s',
      $req['label'],
      $req['player'],
      $res['status']
    );
    if ($res['status'] !== 'ok') {
      $line .= ' ' . ($res['class'] ?? '') . ' ' . $res['message'] . (isset($res['where']) ? " @{$res['where']}" : '');
    }
    echo $line . "\n";
    if ($res['status'] === 'fatal') {
      echo '        ' . implode("\n        ", $res['trace']) . "\n";
    }
  }
  $logs = \APP_DbObject::getObjectListFromDB(
    'SELECT log_id, log_player, log_round, log_trick, log_action FROM actionlog ORDER BY log_id DESC LIMIT 12'
  );
  echo "    last actionlog: " . implode(
    ', ',
    array_map(fn($l) => "#{$l['log_id']} r{$l['log_round']}t{$l['log_trick']} {$l['log_action']}({$l['log_player']})", array_reverse($logs))
  ) . "\n\n";
}

function printSummary(array $s, float $duration, int $seed): int
{
  sort($s['latencies']);
  $n = count($s['latencies']);
  $p = fn($q) => $n ? $s['latencies'][min($n - 1, (int) floor($q * $n))] : 0;
  echo "\n--------------------------------------------------------------------\n";
  printf(
    " %d bursts, %d requests (max %d per burst) in %.0fs = %.0f req/s\n",
    $s['bursts'],
    $s['requests'],
    $s['maxBurst'],
    $duration,
    $s['requests'] / max(1, $duration)
  );
  printf(
    " games started=%d finished=%d, rounds=%d, tricks=%d\n",
    $s['games'],
    $s['gamesFinished'],
    $s['rounds'],
    $s['tricks']
  );
  printf(
    " ok=%d  rejected (UserException)=%d  of which stale-retry=%d  FATAL=%d  VIOLATIONS=%d\n",
    $s['ok'],
    $s['user'],
    $s['stale'],
    $s['fatal'],
    $s['violations']
  );
  printf(" request latency ms: p50=%.1f p95=%.1f p99=%.1f max=%.1f\n", $p(0.5), $p(0.95), $p(0.99), $n ? $s['latencies'][$n - 1] : 0);
  echo "\n per action (ok / user / stale / fatal):\n";
  ksort($s['byAction']);
  foreach ($s['byAction'] as $label => $c) {
    printf("   %-26s %6d %6d %6d %6d\n", $label, $c['ok'], $c['user'], $c['stale'], $c['fatal']);
  }
  if (!empty($s['fatalKinds'])) {
    echo "\n unexpected exceptions:\n";
    arsort($s['fatalKinds']);
    foreach ($s['fatalKinds'] as $k => $c) {
      printf("   %5dx %s\n", $c, $k);
    }
  }
  if (!empty($s['violationKinds'])) {
    echo "\n invariant violations:\n";
    arsort($s['violationKinds']);
    foreach ($s['violationKinds'] as $k => $c) {
      printf("   %5dx %s\n", $c, $k);
    }
  }
  $failed = $s['fatal'] > 0 || $s['violations'] > 0;
  echo "--------------------------------------------------------------------\n";
  echo $failed ? " RESULT: FAILED (seed $seed)\n" : " RESULT: PASSED (seed $seed)\n";
  echo "====================================================================\n";
  return $failed ? 1 : 0;
}
