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

// Auto-initialize MySQL database if missing or empty (only for page/state/action requests;
// never on /local/poll, /local/abort, /local/new-game, or /local/scenario so resets cannot race).
if (!in_array($uri, ['/local/poll', '/local/abort', '/local/new-game', '/local/scenario'], true)) {
  $needsInit = false;
  try {
    $needsInit = $game->getPlayersNumber() === 0;
  } catch (\Throwable $e) {
    $needsInit = true;
  }
  if ($needsInit) {
    $game->createNewGame();
  }
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
try {
  $basicPlayers = $game->loadPlayersBasicInfos();
} catch (\Throwable $e) {
  $basicPlayers = [];
}
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

/**
 * Helper: Build summary of all 4 players for the Top Local Dev Bar.
 */
if (!function_exists('buildDevBarPlayers')) {
  function buildDevBarPlayers(\Tichu $game, int $viewerPlayerId, ?array $gamestate = null): array
  {
    $basic = $game->loadPlayersBasicInfos();
    $players = \PlayerManager::getPlayers();
    $handCounts = \CardManager::getDeck()->countCardsByLocationArgs('hand');
    $state = $gamestate ?? $game->gamestate->state(true, false, true);
    $stateType = (string) ($state['type'] ?? '');
    $activePlayer = (int) ($state['active_player'] ?? 0);
    $multiactiveSet = [];
    if ($stateType === 'multipleactiveplayer') {
      foreach ($state['multiactive'] ?? [] as $mId) {
        $multiactiveSet[(string) $mId] = true;
      }
    }

    $list = [];
    foreach ($basic as $pId => $bRow) {
      $pIdInt = (int) $pId;
      $pRow = $players[$pId] ?? [];
      $isActive = false;
      if ($stateType === 'multipleactiveplayer') {
        $isActive = isset($multiactiveSet[(string) $pIdInt]);
      } elseif ($stateType === 'activeplayer') {
        $isActive = $activePlayer === $pIdInt;
      }
      $list[] = [
        'id' => $pIdInt,
        'no' => (int) ($bRow['player_no'] ?? 0),
        'name' => (string) ($bRow['player_name'] ?? ''),
        'color' => (string) ($bRow['player_color'] ?? '000000'),
        'team' => (int) ($pRow['team'] ?? $bRow['player_team'] ?? 0),
        'score' => (int) ($bRow['player_score'] ?? 0),
        'handCount' => (int) ($handCounts[$pId] ?? 0),
        'isActive' => $isActive,
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
 * Helper: Compute BGA player-name contrast text-shadow style from hex color.
 */
if (!function_exists('getLocalPlayerNameTextShadowStyle')) {
  function getLocalPlayerNameTextShadowStyle(string $color): string
  {
    $hex = ltrim(trim($color), '#');
    if (strlen($hex) === 3) {
      $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
    }
    if (!preg_match('/^[0-9a-fA-F]{6}$/', $hex)) {
      $hex = '000000';
    }
    $r = hexdec(substr($hex, 0, 2));
    $g = hexdec(substr($hex, 2, 2));
    $b = hexdec(substr($hex, 4, 2));
    $lum = (0.299 * $r + 0.587 * $g + 0.114 * $b) / 255.0;
    $shadowColor =
      $lum > 0.6
        ? 'var(--game-bga-text-shadow-color-black)'
        : 'var(--game-bga-text-shadow-color-white)';
    return "text-shadow: 0 0 1px {$shadowColor}, 0 0 2px {$shadowColor}, 0 0 3px {$shadowColor};";
  }
}

/**
 * Helper: Return deterministic local fake avatar URL based on seat number (`no`).
 */
if (!function_exists('getLocalPlayerAvatarUrl')) {
  function getLocalPlayerAvatarUrl(array $player, int $fallbackIndex): string
  {
    $pNo = (int) ($player['no'] ?? 0);
    $idx = $pNo > 0 ? ($pNo - 1) % 4 : abs($fallbackIndex) % 4;
    return '/local/img/avatars/avatar-' . $idx . '.svg';
  }
}

/**
 * Helper: Get current max gamelog_packet_id from gamelog table.
 */
if (!function_exists('getCurrentMaxPacketId')) {
  function getCurrentMaxPacketId(): int
  {
    return (int) (\APP_DbObject::getUniqueValueFromDB(
      'SELECT COALESCE(MAX(gamelog_packet_id), 0) FROM gamelog'
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

/**
 * Helper: Load current gamestate for a viewer (`0` = spectator, strips `_private` args).
 */
if (!function_exists('stateForViewer')) {
  function stateForViewer(\Tichu $game, int $notifPlayerId): ?array
  {
    $gamestate = $game->gamestate->state($notifPlayerId);
    if ($notifPlayerId === 0 && is_array($gamestate) && isset($gamestate['args']['_private'])) {
      unset($gamestate['args']['_private']);
    }
    return $gamestate;
  }
}

$abortFile = __DIR__ . '/.mysql/abort.json';

// 4. AJAX Game Action Endpoint: /tichu/tichu/<action>.html
if (preg_match('#^/tichu/tichu/([a-zA-Z0-9_]+)\.html$#', $uri, $matches)) {
  $actionName = $matches[1];
  $lastPacketId = getCurrentMaxPacketId();

  try {
    $isDebugAction = strpos($actionName, 'debug_') === 0 && method_exists($game, $actionName);
    if ($isSpectator && !$isDebugAction) {
      throw new \Bga\GameFramework\UserException('Spectators cannot perform game actions');
    }
    $game->setCurrentPlayerId($isSpectator ? 0 : $viewerPlayerId);
    if ($isDebugAction) {
      $game->beginPlayerAction();
      $game->bga->debug->setExecutingDebugAction();
      $game->$actionName();
      $game->endPlayerAction();
    } else {
      $actionObj = new \action_tichu($game, $requestParams);
      if (!method_exists($actionObj, $actionName)) {
        throw new \Bga\GameFramework\UserException("Unknown game action: $actionName");
      }
      $actionObj->$actionName();
    }

    $sincePacketId =
      isset($requestParams['since']) && $requestParams['since'] !== ''
        ? (int) $requestParams['since']
        : $lastPacketId;
    $notifPlayerId = $isSpectator ? 0 : $viewerPlayerId;
    $notifications = $game->getNotificationsSince($sincePacketId, $notifPlayerId, false);
    $newLastPacketId = getCurrentMaxPacketId();
    $gamestate = stateForViewer($game, $notifPlayerId);

    return sendJsonResponse([
      'status' => 1,
      'data' => [
        'valid' => 1,
        'notifications' => $notifications,
        'gamestate' => $gamestate,
        'last_packet_id' => $newLastPacketId,
        'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId, $gamestate),
      ],
    ]);
  } catch (\Throwable $e) {
    $game->endPlayerAction(true);
    return sendJsonResponse([
      'status' => 0,
      'error' => $e->getMessage(),
      'args' =>
        $e instanceof \Bga\GameFramework\GameException && $e->args !== null ? $e->args : null,
      'expected' => 1,
    ]);
  }
}

// 5. Local Control & Sync Endpoints (/local/...)

// GET /local/poll?as=<playerId>&since=<lastPacketId>
if ($uri === '/local/poll') {
  $abortData = null;
  if (is_file($abortFile)) {
    $decodedAbort = json_decode((string) file_get_contents($abortFile), true);
    if (is_array($decodedAbort)) {
      $abortData = $decodedAbort;
    }
  }
  $hasPlayers = false;
  try {
    $hasPlayers = $game->getPlayersNumber() > 0;
  } catch (\Throwable $e) {
    $hasPlayers = false;
  }
  if (!$hasPlayers) {
    return sendJsonResponse([
      'status' => 1,
      'notifications' => [],
      'gamestate' => null,
      'last_packet_id' => 0,
      'abort' => $abortData,
    ]);
  }
  $currentMaxPacketId = getCurrentMaxPacketId();
  $since = isset($requestParams['since'])
    ? (int) $requestParams['since']
    : $currentMaxPacketId;
  $notifPlayerId = $isSpectator ? 0 : $viewerPlayerId;
  if ($since > $currentMaxPacketId) {
    $gamestate = stateForViewer($game, $notifPlayerId);
    return sendJsonResponse([
      'status' => 1,
      'reset' => true,
      'notifications' => [],
      'gamestate' => $gamestate,
      'last_packet_id' => $currentMaxPacketId,
      'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId, $gamestate),
      'abort' => $abortData,
    ]);
  }
  $notifications = $game->getNotificationsSince($since, $notifPlayerId, false);
  $lastPacketId = getCurrentMaxPacketId();
  $gamestate = stateForViewer($game, $notifPlayerId);

  return sendJsonResponse([
    'status' => 1,
    'notifications' => $notifications,
    'gamestate' => $gamestate,
    'last_packet_id' => $lastPacketId,
    'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId, $gamestate),
    'abort' => $abortData,
  ]);
}

// POST /local/abort
if ($uri === '/local/abort') {
  if (!empty($requestParams['clear'])) {
    if (is_file($abortFile)) {
      @unlink($abortFile);
    }
    return sendJsonResponse([
      'ok' => true,
      'cleared' => true,
    ]);
  }

  if (is_file($abortFile)) {
    $existing = json_decode((string) file_get_contents($abortFile), true);
    if (is_array($existing)) {
      return sendJsonResponse([
        'ok' => true,
        'abort' => $existing,
      ]);
    }
  }

  $details = $requestParams['details'] ?? null;
  if ($details === null) {
    $extra = [];
    foreach (['consoleIssues', 'actionErrors', 'state'] as $key) {
      if (isset($requestParams[$key])) {
        $extra[$key] = $requestParams[$key];
      }
    }
    $details = $extra !== [] ? $extra : null;
  }

  $abortData = [
    'playerId' => isset($requestParams['playerId'])
      ? $requestParams['playerId']
      : ($isSpectator ? 0 : $viewerPlayerId),
    'reason' => (string) ($requestParams['reason'] ?? 'Issue detected'),
    'details' => $details,
    'timestamp' => (int) ($requestParams['timestamp'] ?? round(microtime(true) * 1000)),
  ];

  $abortDir = dirname($abortFile);
  if (!is_dir($abortDir)) {
    @mkdir($abortDir, 0775, true);
  }
  file_put_contents(
    $abortFile,
    json_encode($abortData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
    LOCK_EX
  );

  return sendJsonResponse([
    'ok' => true,
    'abort' => $abortData,
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
    'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId, $gamedatas['gamestate'] ?? null),
    'options' => [
      'gameLength' => (int) $game->getGameStateValue('gameLength', 2),
      'playerTeams' => (int) $game->getGameStateValue('playerTeams', 1),
      'turnBased' => $game->bga->tableOptions->isTurnBased() ? 1 : 0,
    ],
  ]);
}

// POST /local/new-game
if ($uri === '/local/new-game') {
  if (is_file($abortFile)) {
    @unlink($abortFile);
  }
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
      'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId, $gamedatas['gamestate'] ?? null),
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
if ($uri === '/local/test-scenario' || $uri === '/local/scenario') {
  if (is_file($abortFile)) {
    @unlink($abortFile);
  }
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
      'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId, $gamedatas['gamestate'] ?? null),
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
    $game->setCurrentPlayerId($humanPlayerId);
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
    $notifPlayerId = $isSpectator ? 0 : $viewerPlayerId;
    $notifications = $game->getNotificationsSince($sincePacketId, $notifPlayerId, false);
    $newLastPacketId = getCurrentMaxPacketId();
    $gamestate = stateForViewer($game, $notifPlayerId);

    return sendJsonResponse([
      'status' => 1,
      'mode' => $mode,
      'actions' => $actions,
      'notifications' => $notifications,
      'gamestate' => $gamestate,
      'last_packet_id' => $newLastPacketId,
      'devBarPlayers' => buildDevBarPlayers($game, $viewerPlayerId, $gamestate),
    ]);
  } catch (\Throwable $e) {
    $game->endPlayerAction(true);
    return sendJsonResponse([
      'status' => 0,
      'error' => $e->getMessage(),
      'args' =>
        $e instanceof \Bga\GameFramework\GameException && $e->args !== null ? $e->args : null,
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
  $devBarPlayers = buildDevBarPlayers($game, $viewerPlayerId, $gamedatas['gamestate'] ?? null);

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

  $initialState = $gamedatas['gamestate'] ?? [];
  $initialStateType = (string) ($initialState['type'] ?? '');
  $activePlayerIds = [];
  if ($initialStateName !== 'gameEnd' && (int) ($initialState['id'] ?? 0) !== 99) {
    if ($initialStateType === 'activeplayer') {
      $activeId = (int) ($initialState['active_player'] ?? 0);
      if ($activeId > 0) {
        $activePlayerIds[] = $activeId;
      }
    } elseif ($initialStateType === 'multipleactiveplayer') {
      $multi = is_array($initialState['multiactive'] ?? null) ? $initialState['multiactive'] : [];
      $activePlayerIds = array_values(
        array_filter(array_map('intval', $multi), static fn($id) => $id > 0)
      );
    }
  }
  $isViewerActive = !$isSpectator && in_array($viewerPlayerId, $activePlayerIds, true);

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
  <link rel="stylesheet" href="/local/css/bga-shim.css?v=<?php echo (int) @filemtime(__DIR__ . '/css/bga-shim.css'); ?>">
  <link rel="stylesheet" href="/tichu.css?v=<?php echo (int) @filemtime($projectRoot . '/tichu.css'); ?>">
</head>
<body id="ebd-body" class="notouch-device theme0<?php echo $isViewerActive ? ' current_player_is_active' : ''; ?>">
  <div id="local-dev-bar"></div>
  <div id="local-toast-container"></div>

  <div id="overall-content" class="<?php echo htmlspecialchars($overallClassAttr, ENT_QUOTES, 'UTF-8'); ?>">
    <div id="topbar"></div>

    <div id="page-title" class="roundedbox">
      <div id="maintitlebar_content" class="roundedboxinner">
        <div id="pagemaintitle_wrap">
          <span id="active_player_statusbar" class="textalign" style="display: <?php echo $isViewerActive ? 'inline-block' : 'none'; ?>;">
            <img id="active_player_statusbar_icon" class="textalign_inner" src="/local/img/layout/active_player.gif" alt="" />
          </span>
          <span id="pagemaintitletext">&nbsp;</span>
          <div id="generalactions"></div>
        </div>
        <div id="gameaction_status_wrap" style="display: none;">
          <span id="gameaction_status"></span>
          <span id="synchronous_notif_icon" style="display: none;"></span>
        </div>
      </div>
    </div>
    <div id="after-page-title"></div>

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
              <?php
              $playerBoardIdx = 0;
              foreach ($gamedatas['playerorder'] as $orderedId):
                $p = $gamedatas['players'][$orderedId] ?? null;
                if (!$p) {
                  continue;
                }
                $pId = (int) $p['id'];
                $pName = (string) $p['name'];
                $pColor = ltrim((string) ($p['color'] ?? '000000'), '#') ?: '000000';
                $pScore = (string) $p['score'];
                $isCurrentViewer = !$isSpectator && $pId === $viewerPlayerId;
                $isPlayerActive = in_array($pId, $activePlayerIds, true);
                $avatarUrl = getLocalPlayerAvatarUrl($p, $playerBoardIdx++);
                $nameShadowStyle = getLocalPlayerNameTextShadowStyle($pColor);
                $escapedColor = htmlspecialchars($pColor, ENT_QUOTES, 'UTF-8');
                $escapedName = htmlspecialchars($pName, ENT_QUOTES, 'UTF-8');
                $escapedScore = htmlspecialchars($pScore, ENT_QUOTES, 'UTF-8');
                $escapedAvatarUrl = htmlspecialchars($avatarUrl, ENT_QUOTES, 'UTF-8');
                ?>
                <div class="player-board<?php echo $isCurrentViewer ? ' current-player-board' : ''; ?>" id="overall_player_board_<?php echo $pId; ?>" style="border-color: #<?php echo $escapedColor; ?>;">
                  <div class="player_board_inner" id="player_board_inner_<?php echo $pId; ?>">
                    <div class="emblemwrap" id="avatarwrap_<?php echo $pId; ?>" style="display: <?php echo $isPlayerActive ? 'none' : 'block'; ?>;">
                      <img src="<?php echo $escapedAvatarUrl; ?>" alt="" class="avatar emblem" id="avatar_<?php echo $pId; ?>" />
                      <div class="emblempremium"></div>
                    </div>
                    <div id="rtc_placeholder_<?php echo $pId; ?>" class="rtc_placeholder"></div>
                    <div class="emblemwrap" id="avatar_active_wrap_<?php echo $pId; ?>" style="display: <?php echo $isPlayerActive ? 'block' : 'none'; ?>;">
                      <img src="/local/img/layout/active_player.gif" alt="" class="avatar avatar_active" id="avatar_active_<?php echo $pId; ?>" />
                      <div class="icon20 icon20_night this_is_night"></div>
                    </div>
                    <div class="player-name" id="player_name_<?php echo $pId; ?>">
                      <a href="?as=<?php echo $pId; ?>" target="_blank" rel="noopener" style="color: #<?php echo $escapedColor; ?>; <?php echo $nameShadowStyle; ?>"><?php echo $escapedName; ?></a>
                    </div>
                    <div id="player_board_<?php echo $pId; ?>" class="player_board_content">
                      <div class="player_score">
                        <span id="player_score_<?php echo $pId; ?>" class="player_score_value"><?php echo $escapedScore; ?></span>
                        <span class="icon16 icon16_point" id="icon_point_<?php echo $pId; ?>">★</span>
                      </div>
                      <div class="player-board-game-specific-content"></div>
                      <div class="player_table_status" id="player_table_status_<?php echo $pId; ?>" style="display: none;"></div>
                    </div>
                    <?php if ($isCurrentViewer): ?>
                      <div id="current_player_board"></div>
                    <?php endif; ?>
                    <div id="player_panel_content_<?php echo $pId; ?>" class="player_panel_content"></div>
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
  <script src="/local/js/bga-shim.js?v=<?php echo (int) @filemtime(__DIR__ . '/js/bga-shim.js'); ?>"></script>
  <script src="/tichu.js?v=<?php echo (int) @filemtime($projectRoot . '/tichu.js'); ?>"></script>
</body>
</html>
  <?php
  return true;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo "404 Not Found: " . htmlspecialchars($uri, ENT_QUOTES, 'UTF-8');
return true;
