<?php
/**
 * Local router for running BGA Tichu via PHP's built-in web server:
 *   php -S localhost:8080 local/router.php
 */

$projectRoot = dirname(__DIR__);
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// 1. Static File Serving
$mimeTypes = [
  'js' => 'application/javascript; charset=utf-8',
  'mjs' => 'application/javascript; charset=utf-8',
  'css' => 'text/css; charset=utf-8',
  'html' => 'text/html; charset=utf-8',
  'json' => 'application/json; charset=utf-8',
  'png' => 'image/png',
  'jpg' => 'image/jpeg',
  'jpeg' => 'image/jpeg',
  'gif' => 'image/gif',
  'svg' => 'image/svg+xml',
  'ico' => 'image/x-icon',
  'mp3' => 'audio/mpeg',
  'ogg' => 'audio/ogg',
  'woff' => 'font/woff',
  'woff2' => 'font/woff2',
  'ttf' => 'font/ttf',
  'map' => 'application/json; charset=utf-8',
];

if ($uri === '/favicon.ico' && !is_file($projectRoot . '/favicon.ico')) {
  http_response_code(204);
  return true;
}

// Map /tichu/<static> (except /tichu/tichu/<action>.html) to /<static> in project root
if (strpos($uri, '/tichu/') === 0 && strpos($uri, '/tichu/tichu/') !== 0) {
  $mappedRel = substr($uri, strlen('/tichu'));
  $mappedFile = realpath($projectRoot . $mappedRel);
  if (
    $mappedFile !== false &&
    strpos($mappedFile, $projectRoot) === 0 &&
    is_file($mappedFile)
  ) {
    $ext = strtolower(pathinfo($mappedFile, PATHINFO_EXTENSION));
    if (!in_array($ext, ['php', 'sql', 'db', 'db-wal', 'db-shm'], true)) {
      if (isset($mimeTypes[$ext])) {
        header('Content-Type: ' . $mimeTypes[$ext]);
      }
      readfile($mappedFile);
      return true;
    }
  }
}

// Direct static files in project root or /local/*
if ($uri !== '/' && $uri !== '/table' && $uri !== '/index.php') {
  $candidate = realpath($projectRoot . $uri);
  if (
    $candidate !== false &&
    strpos($candidate, $projectRoot) === 0 &&
    is_file($candidate)
  ) {
    $ext = strtolower(pathinfo($candidate, PATHINFO_EXTENSION));
    if (!in_array($ext, ['php', 'sql', 'db', 'db-wal', 'db-shm'], true)) {
      if (php_sapi_name() === 'cli-server') {
        return false;
      }
      if (isset($mimeTypes[$ext])) {
        header('Content-Type: ' . $mimeTypes[$ext]);
      }
      readfile($candidate);
      return true;
    }
  }
}

// 2. Load Backend, Game, Action, View, and Bot (buffer to strip any UTF-8 BOM in legacy PHP files)
ob_start();
require_once __DIR__ . '/bga-backend.php';
require_once $projectRoot . '/tichu.game.php';
require_once $projectRoot . '/tichu.action.php';
require_once $projectRoot . '/tichu.view.php';
require_once __DIR__ . '/bot.php';
require_once __DIR__ . '/scenarios.php';
ob_end_clean();

$game = new \Tichu();

// Auto-initialize SQLite database if missing or empty
$dbPath = \APP_DbObject::getDbPath();
$needsInit = $dbPath !== ':memory:' && !file_exists($dbPath);
if (!$needsInit) {
  try {
    $needsInit = $game->getPlayersNumber() === 0;
  } catch (\Throwable $e) {
    $needsInit = true;
  }
}
if ($needsInit) {
  $game->createNewGame();
}

// Parse JSON body if present on POST requests
$rawBody = file_get_contents('php://input');
$jsonBody = [];
if (is_string($rawBody) && $rawBody !== '') {
  $decoded = json_decode($rawBody, true);
  if (is_array($decoded)) {
    $jsonBody = $decoded;
  }
}
$requestParams = array_merge($_GET, $_POST, $jsonBody);

// 3. Determine Current Viewer Player ($viewerPlayerId)
$basicPlayers = $game->loadPlayersBasicInfos();
$defaultPlayerId = !empty($basicPlayers) ? (int) array_key_first($basicPlayers) : 2385074;

$rawPlayerId = null;
if (isset($_GET['as']) && $_GET['as'] !== '') {
  $rawPlayerId = $_GET['as'];
} elseif (isset($_POST['as']) && $_POST['as'] !== '') {
  $rawPlayerId = $_POST['as'];
} elseif (isset($jsonBody['as']) && $jsonBody['as'] !== '') {
  $rawPlayerId = $jsonBody['as'];
} elseif (!empty($_SERVER['HTTP_X_BGA_PLAYER'])) {
  $rawPlayerId = $_SERVER['HTTP_X_BGA_PLAYER'];
} elseif (isset($_COOKIE['tichu_player_id']) && $_COOKIE['tichu_player_id'] !== '') {
  $rawPlayerId = $_COOKIE['tichu_player_id'];
}

if ($rawPlayerId !== null) {
  $viewerPlayerId = (int) $rawPlayerId;
  if ($viewerPlayerId !== 0 && !isset($basicPlayers[$viewerPlayerId])) {
    $viewerPlayerId = $defaultPlayerId;
  }
} else {
  $viewerPlayerId = $defaultPlayerId;
}

$isSpectator = $viewerPlayerId === 0;

if (isset($_GET['as']) && !headers_sent()) {
  setcookie('tichu_player_id', (string) $viewerPlayerId, [
    'path' => '/',
    'samesite' => 'Lax',
  ]);
}

/**
 * Helper: Build summary of all 4 players for the Top Local Dev Bar.
 */
if (!function_exists('buildDevBarPlayers')) {
  function buildDevBarPlayers(\Tichu $game, int $viewerPlayerId): array
  {
    $basic = $game->loadPlayersBasicInfos();
    $players = \PlayerManager::getPlayers();
    $handCounts = \CardManager::getDeck()->countCardsByLocationArgs('hand');

    $list = [];
    foreach ($basic as $pId => $bRow) {
      $pIdInt = (int) $pId;
      $pRow = $players[$pId] ?? [];
      $list[] = [
        'id' => $pIdInt,
        'no' => (int) ($bRow['player_no'] ?? 0),
        'name' => (string) ($bRow['player_name'] ?? ''),
        'color' => (string) ($bRow['player_color'] ?? '000000'),
        'team' => (int) ($pRow['team'] ?? $bRow['player_team'] ?? 0),
        'score' => (int) ($bRow['player_score'] ?? 0),
        'handCount' => (int) ($handCounts[$pId] ?? 0),
        'isActive' => $game->gamestate->isPlayerActive($pIdInt),
        'call_grand_tichu' => (int) ($pRow['call_grand_tichu'] ?? -1),
        'call_tichu' => (int) ($pRow['call_tichu'] ?? -1),
        'pass' => (int) ($pRow['pass'] ?? 0),
        'isViewer' => $pIdInt === $viewerPlayerId,
      ];
    }
    return $list;
  }
}

/**
 * Helper: Get current max packet_id from notifications table.
 */
if (!function_exists('getCurrentMaxPacketId')) {
  function getCurrentMaxPacketId(): int
  {
    return (int) (\APP_DbObject::getUniqueValueFromDB(
      'SELECT IFNULL(MAX(packet_id), 0) FROM notifications'
    ) ?? 0);
  }
}

/**
 * Helper: Send JSON response and terminate cleanly.
 */
if (!function_exists('sendJsonResponse')) {
  function sendJsonResponse(array $payload, int $statusCode = 200): bool
  {
    if (!headers_sent()) {
      http_response_code($statusCode);
      header('Content-Type: application/json; charset=utf-8');
      header('Cache-Control: no-store, no-cache, must-revalidate');
    }
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    return true;
  }
}

// 4. AJAX Game Action Endpoint: /tichu/tichu/<action>.html
if (preg_match('#^/tichu/tichu/([a-zA-Z0-9_]+)\.html$#', $uri, $matches)) {
  $actionName = $matches[1];
  $lastPacketId = getCurrentMaxPacketId();

  try {
    if ($isSpectator) {
      throw new \Bga\GameFramework\UserException('Spectators cannot perform game actions');
    }
    $game->setCurrentPlayerId($viewerPlayerId);
    $actionObj = new \action_tichu($game, $requestParams);
    if (!method_exists($actionObj, $actionName)) {
      throw new \Bga\GameFramework\UserException("Unknown game action: $actionName");
    }
    $actionObj->$actionName();

    $notifications = $game->getNotificationsSince($lastPacketId, $viewerPlayerId, false);
    $newLastPacketId = getCurrentMaxPacketId();
    $gamestate = $game->gamestate->state($viewerPlayerId);

    return sendJsonResponse([
      'status' => 1,
      'data' => [
        'valid' => 1,
        'notifications' => $notifications,
        'gamestate' => $gamestate,
        'last_packet_id' => $newLastPacketId,
        'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId),
      ],
    ]);
  } catch (\Throwable $e) {
    $game->endPlayerAction(true);
    return sendJsonResponse([
      'status' => 0,
      'error' => $e->getMessage(),
      'expected' => 1,
    ]);
  }
}

// 5. Local Control & Sync Endpoints (/local/...)

// GET /local/poll?as=<playerId>&since=<lastPacketId>
if ($uri === '/local/poll') {
  $since = isset($requestParams['since'])
    ? (int) $requestParams['since']
    : getCurrentMaxPacketId();
  $notifications = $game->getNotificationsSince(
    $since,
    $isSpectator ? null : $viewerPlayerId,
    false
  );
  $lastPacketId = getCurrentMaxPacketId();
  $gamestate = $game->gamestate->state($isSpectator ? null : $viewerPlayerId);

  return sendJsonResponse([
    'status' => 1,
    'notifications' => $notifications,
    'gamestate' => $gamestate,
    'last_packet_id' => $lastPacketId,
    'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId),
  ]);
}

// GET /local/state?as=<playerId>
if ($uri === '/local/state') {
  $gamedatas = $game->getFullClientPayload($viewerPlayerId);
  $gamelogs = $game->getAllGamelogsForReplay();

  return sendJsonResponse([
    'status' => 1,
    'playerId' => $viewerPlayerId,
    'isSpectator' => $isSpectator,
    'bRealtime' => !$game->bga->tableOptions->isTurnBased(),
    'gamedatas' => $gamedatas,
    'gamelogs' => $gamelogs,
    'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId),
    'options' => [
      'gameLength' => (int) $game->getGameStateValue('gameLength', 2),
      'playerTeams' => (int) $game->getGameStateValue('playerTeams', 1),
      'turnBased' => $game->bga->tableOptions->isTurnBased() ? 1 : 0,
    ],
  ]);
}

// POST /local/new-game
if ($uri === '/local/new-game') {
  try {
    $options = [
      'gameLength' => (int) ($requestParams['gameLength'] ?? $requestParams[100] ?? 2),
      'playerTeams' => (int) ($requestParams['playerTeams'] ?? $requestParams[101] ?? 1),
      'gameVariant' => (int) ($requestParams['gameVariant'] ?? $requestParams[102] ?? 1),
      'turnBased' => !empty($requestParams['turnBased']) ? 1 : 0,
    ];
    $game->createNewGame($options);

    $gamedatas = $game->getFullClientPayload($viewerPlayerId);
    $gamelogs = $game->getAllGamelogsForReplay();
    $lastPacketId = getCurrentMaxPacketId();

    return sendJsonResponse([
      'status' => 1,
      'playerId' => $viewerPlayerId,
      'isSpectator' => $isSpectator,
      'bRealtime' => !$game->bga->tableOptions->isTurnBased(),
      'gamedatas' => $gamedatas,
      'gamelogs' => $gamelogs,
      'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId),
      'last_packet_id' => $lastPacketId,
      'options' => $options,
    ]);
  } catch (\Throwable $e) {
    return sendJsonResponse([
      'status' => 0,
      'error' => $e->getMessage(),
      'expected' => 1,
    ]);
  }
}

// POST /local/test-scenario
if ($uri === '/local/test-scenario') {
  try {
    $scenario = (string) ($requestParams['scenario'] ?? 'grand_tichu');
    $gamedatas = \LocalTichuScenarios::setupScenario(
      $game,
      $scenario,
      $isSpectator ? $defaultPlayerId : $viewerPlayerId
    );
    if ($isSpectator) {
      $gamedatas = $game->getFullClientPayload(0);
    }
    $gamelogs = $game->getAllGamelogsForReplay();
    $lastPacketId = getCurrentMaxPacketId();

    return sendJsonResponse([
      'status' => 1,
      'scenario' => $scenario,
      'playerId' => $viewerPlayerId,
      'isSpectator' => $isSpectator,
      'bRealtime' => !$game->bga->tableOptions->isTurnBased(),
      'gamedatas' => $gamedatas,
      'gamelogs' => $gamelogs,
      'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId),
      'last_packet_id' => $lastPacketId,
    ]);
  } catch (\Throwable $e) {
    return sendJsonResponse([
      'status' => 0,
      'error' => $e->getMessage(),
      'expected' => 1,
    ]);
  }
}

// POST /local/bot
if ($uri === '/local/bot') {
  $mode = (string) ($requestParams['mode'] ?? 'others');
  $sincePacketId = isset($requestParams['since'])
    ? (int) $requestParams['since']
    : getCurrentMaxPacketId();
  $humanPlayerId = $isSpectator ? $defaultPlayerId : $viewerPlayerId;
  $targetBotId = isset($requestParams['botPlayerId']) ? (int) $requestParams['botPlayerId'] : null;

  try {
    $actions = [];
    if ($mode === 'step') {
      $stepRes = \LocalTichuBot::stepSingleBotTurn($game, $targetBotId);
      if (!empty($stepRes['acted'])) {
        $actions[] = $stepRes;
      }
    } elseif ($mode === 'until_me') {
      $maxSteps = isset($requestParams['maxSteps']) ? (int) $requestParams['maxSteps'] : 40;
      $actions = \LocalTichuBot::autoPlayUntilPlayer($game, $humanPlayerId, $maxSteps);
    } else {
      // Default: 'others'
      $maxSteps = isset($requestParams['maxSteps']) ? (int) $requestParams['maxSteps'] : 40;
      $actions = \LocalTichuBot::actForOtherPlayers($game, $humanPlayerId, $maxSteps);
    }

    $game->setCurrentPlayerId($viewerPlayerId);
    $notifications = $game->getNotificationsSince(
      $sincePacketId,
      $isSpectator ? null : $viewerPlayerId,
      false
    );
    $newLastPacketId = getCurrentMaxPacketId();
    $gamestate = $game->gamestate->state($isSpectator ? null : $viewerPlayerId);

    return sendJsonResponse([
      'status' => 1,
      'mode' => $mode,
      'actions' => $actions,
      'notifications' => $notifications,
      'gamestate' => $gamestate,
      'last_packet_id' => $newLastPacketId,
      'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId),
    ]);
  } catch (\Throwable $e) {
    $game->endPlayerAction(true);
    return sendJsonResponse([
      'status' => 0,
      'error' => $e->getMessage(),
      'expected' => 1,
    ]);
  }
}

// 6. Main Game Page (GET / or GET /table or GET /index.php)
if ($uri === '/' || $uri === '/table' || $uri === '/index.php') {
  $viewPlayerId = $isSpectator ? $defaultPlayerId : $viewerPlayerId;
  $game->setCurrentPlayerId($viewPlayerId);

  $view = new \view_tichu_tichu($game);
  $tplHtml = $view->render($projectRoot . '/tichu_tichu.tpl');

  $gamedatas = $game->getFullClientPayload($viewerPlayerId);
  $gamelogs = $game->getAllGamelogsForReplay();
  $devBarPlayers = buildDevBarPlayers($game, $viewerPlayerId);

  $bootstrapData = [
    'playerId' => $viewerPlayerId,
    'isSpectator' => $isSpectator,
    'bRealtime' => !$game->bga->tableOptions->isTurnBased(),
    'gamedatas' => $gamedatas,
    'gamelogs' => $gamelogs,
    'devBarPlayers' => $devBarPlayers,
    'options' => [
      'gameLength' => (int) $game->getGameStateValue('gameLength', 2),
      'playerTeams' => (int) $game->getGameStateValue('playerTeams', 1),
      'turnBased' => $game->bga->tableOptions->isTurnBased() ? 1 : 0,
    ],
  ];

  $overallClasses = [];
  if ($isSpectator) {
    $overallClasses[] = 'spectatorMode';
  }
  $initialStateName = (string) ($gamedatas['gamestate']['name'] ?? '');
  if ($initialStateName !== '') {
    $overallClasses[] = 'gamestate_' . $initialStateName;
  }
  $overallClassAttr = implode(' ', $overallClasses);

  if (!headers_sent()) {
    header('Content-Type: text/html; charset=utf-8');
  }
  ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tichu — Local BGA Runner</title>
  <link rel="stylesheet" href="/local/css/bga-shim.css">
  <link rel="stylesheet" href="/tichu.css">
</head>
<body class="theme0">
  <div id="local-dev-bar"></div>
  <div id="local-toast-container"></div>

  <div id="overall-content" class="<?php echo htmlspecialchars($overallClassAttr, ENT_QUOTES, 'UTF-8'); ?>">
    <div id="topbar"></div>

    <div id="page-title">
      <div id="maintitlebar_content">
        <div id="pagemaintitle_wrap">
          <span id="pagemaintitletext"></span>
        </div>
        <div id="generalactions"></div>
      </div>
    </div>

    <div id="page-content">
      <div id="main-game-layout">
        <div id="left-side">
          <div id="game_play_area_wrap">
            <div id="game_play_area">
              <?php echo $tplHtml; ?>
            </div>
          </div>
        </div>

        <div id="right-side">
          <div id="right-side-first-part">
            <div id="player_boards">
              <?php foreach ($gamedatas['playerorder'] as $orderedId):
                $p = $gamedatas['players'][$orderedId] ?? null;
                if (!$p) {
                  continue;
                }
                $pId = (int) $p['id'];
                $pName = (string) $p['name'];
                $pColor = (string) $p['color'];
                $pScore = (string) $p['score'];
                ?>
                <div class="player-board" id="overall_player_board_<?php echo $pId; ?>">
                  <div class="player_board_inner" id="player_board_inner_<?php echo $pId; ?>">
                    <div class="player-name" id="player_name_<?php echo $pId; ?>">
                      <a href="?as=<?php echo $pId; ?>" style="color: #<?php echo htmlspecialchars($pColor, ENT_QUOTES, 'UTF-8'); ?>">
                        <?php echo htmlspecialchars($pName, ENT_QUOTES, 'UTF-8'); ?>
                      </a>
                    </div>
                    <div class="player_score">
                      <span id="player_score_<?php echo $pId; ?>" class="player_score_value"><?php echo htmlspecialchars($pScore, ENT_QUOTES, 'UTF-8'); ?></span>
                      <span class="icon16 icon16_point">★</span>
                    </div>
                    <div class="player_config_row" id="player_board_<?php echo $pId; ?>"></div>
                  </div>
                </div>
              <?php endforeach; ?>
            </div>
          </div>

          <div id="logs_wrap">
            <div id="logs"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    window.BGA_LOCAL_INIT = <?php echo json_encode($bootstrapData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>;
  </script>
  <script src="/local/js/bga-shim.js"></script>
  <script src="/tichu.js"></script>
</body>
</html>
  <?php
  return true;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo "404 Not Found: " . htmlspecialchars($uri, ENT_QUOTES, 'UTF-8');
return true;
