<?php
declare(strict_types=1);

namespace Bga\GameFramework;

/**
 * Handle every action happening to the game page (any page in the GS).
 * Redirect all in-game actions to the action class of the game (GameAction).
 */
class GamePageAction extends \APP_Action
{
    #[\DI\Attribute\Inject]
    protected \Bga\Config\ServerConfig $serverConfig;

    protected string $gameName;
    protected GamePage $gamePage;
    /*Table*/ protected $game;

    public function initGameTableObjects(): void {
        global $g_config, $bgaContainer;

        if ($g_config['cluster_lock_local_gameserver_usage']) {
            throw new \feException('Gameserver is locked by configuration', true);
        }

        $gameName = $this->getInternalArg('module', AT_alphanum, true);
        $tableId = $this->getInternalArg('table', AT_posint, true);

        $this->gameName = $gameName;

        $lockUuid = $this->isInternalArg('lock') ? $this->getInternalArg('lock', AT_uuid, true) : null;
        $aiPlayer = isset($_GET['ai_player']) ? intval($_GET['ai_player']) : null;

        $this->gamePage = $bgaContainer->get(GamePage::class);
        $this->game = $this->gamePage->setup($gameName, (int) $tableId);
        $gameId = $this->gamePage->initGameTableObjects($lockUuid, $aiPlayer);

        $this->viewArgs['current_table'] = $tableId;
        $this->viewArgs['current_game_id'] = $gameId;
        $this->viewArgs['current_game_name'] = $gameName;
        $this->viewArgs['current_game_name_displayed'] = getGameNameDisplayed($gameName);

        if ($this->isArg('replayFrom')) {
            $this->viewArgs['replayFrom'] = $this->getArg('replayFrom', AT_posint, true);
        } elseif ($this->isArg('replayLastTurn')) {
            $this->viewArgs['replayLastTurn'] = $this->getArg('replayLastTurn', AT_posint, true);
            $this->viewArgs['replayLastTurnPlayer'] = $this->getArg('replayLastTurnPlayer', AT_posint, true);
        }
    }

    /**
     * Is it still used??? Remove here and in GamePage if not.
     */
    public function gamedatas() {
        $this->setAjaxMode();

        $result = $this->gamePage->getAllTableDatas();
        $this->ajaxResponseWithResult($result);
    }

    /**
     * Retrieve game data from the table.  This is currenly used by
     * the Hive application maintained by Jean-Baptiste Chaubet
     */
    public function gamedataonly()
    {
        $this->setAjaxMode(false);

        self::initGameTableObjects();

        $this->viewArgs['data'] = $this->game->getAllTableDatas();
        $this->view = "general_json";
    }

    /**
     * Chat message.
     */
    public function say() {
        $this->setAjaxMode();
        $message = $this->getArg('msg', AT_html_safe, true);
        $this->gamePage->say($message);
        $this->ajaxResponseWithResult(null);
    }

    public function wouldLikeToThink(): void {
        $this->setAjaxMode();
        $this->gamePage->wouldLikeToThink();
        $this->ajaxResponseWithResult(null);
    }

    /**
     * Maintain the user online.
     */
    public function wakeup() {
        global $bgaContainer;

        $this->setAjaxMode();

        $active = $this->isArg('active');
        $is_yourturn_ack = $this->isArg('myturnack');
        $table_id = $this->getArg('table', AT_posint, false, null);

        $this->gamePage->wakeup($active, $is_yourturn_ack, $table_id);

        $this->ajaxResponseWithResult(null);
    }

    public function wakeupPlayers() {
        $this->setAjaxMode();

        $this->gamePage->wakeupPlayers();

        $this->ajaxResponseWithResult(null);
    }

    /**
     * Return the authoritative current reflexion-time snapshot.
     *
     * This GS game-page action exists so the browser can refresh timers after a reconnect
     * without going through the job-only /gameserver module.
     */
    public function getReflexionTime() {
        $this->setAjaxMode();

        $this->ajaxResponseWithResult($this->game->getCurrentReflexionTimes());
    }

    public function getDebugCounters(): void {
        global $g_config;

        $this->setAjaxMode();

        if (!$this->serverConfig->areGameDebugToolsEnabled()) {
            throw new \BadMethodCallException('Debug functions are not active in this environment');
        }

        $tableCounters = [];
        foreach ($this->game->counterFactory->getRegisteredTableCounters() as $name => $counter) {
            $tableCounters[$name] = ['value' => $counter->get()];
        }

        $playerCounters = [];
        foreach ($this->game->counterFactory->getRegisteredPlayerCounters() as $name => $counter) {
            $playerCounters[$name] = ['values' => $counter->getAllWithIdKey()];
        }

        $this->ajaxResponseWithResult([
            'debugTableCounters' => $tableCounters,
            'debugPlayerCounters' => $playerCounters,
        ]);
    }

    public function getDebugGlobals(): void {
        global $g_config;

        $this->setAjaxMode();

        if (!$this->serverConfig->areGameDebugToolsEnabled()) {
            throw new \BadMethodCallException('Debug functions are not active in this environment');
        }

        $this->ajaxResponseWithResult($this->game->globals->getAll());
    }

    public function getDebugStateActions(): void {
        global $g_config;

        $this->setAjaxMode();
        if (!$this->serverConfig->areGameDebugToolsEnabled()) {
            throw new \BadMethodCallException('Debug functions are not active in this environment');
        }

        $state = $this->game->gamestate->getCurrentState((int) $this->game->getCurrentPlayerId());
        if ($state === null) {
            $this->ajaxResponseWithResult([]);
            return;
        }

        $gameAction = $this->getGameActionClass();
        $actions = [];
        foreach ($state->possibleActions ?? [] as $name) {
            $handler = $gameAction;
            if (!method_exists($handler, $name)) {
                $handler = $state->stateInstance;
                if ($state->isLegacyGameState || $handler === null || !method_exists($handler, $name)) {
                    $handler = $this->game;
                }
            }

            $parameters = [];
            $usesRequestArgs = $handler === $gameAction;
            if (method_exists($handler, $name)) {
                foreach ((new \ReflectionMethod($handler, $name))->getParameters() as $parameter) {
                    $type = $parameter->getType();
                    $typeName = $type instanceof \ReflectionNamedType ? $type->getName() : null;
                    $isPlayerParameter = $typeName === 'int' && in_array($parameter->name, [
                        'currentPlayerNo', 'current_player_no', 'currentPlayerId', 'current_player_id',
                        'activePlayerNo', 'active_player_no', 'activePlayerId', 'active_player_id',
                    ]);
                    $isStateArgsParameter = $typeName === 'array' && in_array($parameter->name, ['arg', 'args']);
                    if ($isPlayerParameter || $isStateArgsParameter) {
                        continue;
                    }

                    $requestName = $parameter->name;
                    $inputType = $typeName;
                    foreach ($parameter->getAttributes() as $attribute) {
                        $instance = $attribute->newInstance();
                        if ($instance instanceof Actions\Types\ActionType) {
                            $requestName = $instance->name ?? $requestName;
                            $inputType = $instance instanceof Actions\Types\JsonParam ? 'json' : $inputType;
                            break;
                        }
                    }
                    $parameters[] = [
                        'name' => $requestName,
                        'type' => $inputType,
                        'optional' => $parameter->isOptional() || $parameter->allowsNull(),
                        'defaultValue' => $parameter->isDefaultValueAvailable() ? $parameter->getDefaultValue() : null,
                    ];
                }
            }
            $actions[] = ['name' => $name, 'parameters' => $parameters, 'usesRequestArgs' => $usesRequestArgs];
        }

        $this->ajaxResponseWithResult($actions);
    }

    public function updateDebugGlobal(): void {
        global $g_config;

        $this->setAjaxMode();

        if (!$this->serverConfig->areGameDebugToolsEnabled()) {
            throw new \BadMethodCallException('Debug functions are not active in this environment');
        }

        $name = $this->getArg('name', AT_alphanum_dash, true);
        $value = $this->getArg('value', AT_json, true);
        $this->game->globals->set($name, $value);

        $this->ajaxResponseWithResult(null);
    }

    public function deleteDebugGlobal(): void {
        global $g_config;

        $this->setAjaxMode();

        if (!$this->serverConfig->areGameDebugToolsEnabled()) {
            throw new \BadMethodCallException('Debug functions are not active in this environment');
        }

        $name = $this->getArg('name', AT_alphanum_dash, true);
        $this->game->globals->delete($name);

        $this->ajaxResponseWithResult(null);
    }

    /**
     * Get notifications from game history.
     */
    public function notificationHistory() {
        $this->setAjaxMode();
        $from_notif = (int) $this->getArg('from', AT_posint, true);
        $to_notif = $this->getArg('to', AT_posint, false);
        $private_included = (bool) $this->getArg('privateinc', AT_bool, true); // 0 or 1
        $loghistory_included = (bool) $this->getArg('history', AT_bool, false, false); // 0 or 1
        $archive = $this->getArg('archive', AT_alphanum, false, ''); // (note: job password)

        $history = $this->gamePage->getNotificationHistory(
            $from_notif,
            $to_notif !== null ? (int) $to_notif : null,
            $private_included,
            $loghistory_included,
            $archive,
        );

        $this->ajaxResponse([
            'valid' => 1, 
            'data' => $history
        ]);
        $this->gamePage->sendNotifications();
    }

    public function ajaxResponseWithResult($result) {
        $this->ajaxResponse([
            'valid' => 1, 
            'data' => $this->gamePage->getAjaxResponseResult($result)
        ]);
    }

    /**
     * Flush queued bot events after the action transaction is committed.
     */
    public function flushQueuedBotEventsAfterCommit(): void
    {
        $this->game->flushQueuedBotEvents();
    }

    public function aiNotPlaying() {
        $this->setAjaxMode();

        $this->gamePage->aiNotPlaying();

        $this->ajaxResponseWithResult(null);
    }

    public function aiError() {
        $this->setAjaxMode();
        $error = $this->getArg('error', AT_html_safe, true);

        $this->gamePage->aiError($error);

        $this->ajaxResponseWithResult(null);
    }

    public function skipPlayersOutOfTime() {
        $this->setAjaxMode();
        $bWarn = $this->getArg('warn', AT_bool, false, false);

        $result = $this->gamePage->skipPlayersOutOfTime($bWarn);

        $this->ajaxResponseWithResult($result);
    }

    public function zombieBack() {
        $this->setAjaxMode();
        $this->gamePage->zombieBack();
        $this->ajaxResponseWithResult(null);
    }

    public function showCursor() {
        $this->setAjaxMode();
        $infos = $this->getArg('path', AT_json, true);
        $this->gamePage->showCursor($infos);
        $this->ajaxResponseWithResult(null);
    }

    public function showCursorClick() {
        $this->setAjaxMode();
        $infos = $this->getArg('path', AT_json, true);
        $this->gamePage->showCursorClick($infos);
        $this->ajaxResponseWithResult(null);
    }

    public function endLockScreen() {
        $this->setAjaxMode();
        $bShouldContinue = $this->gamePage->endLockScreen();
        $this->ajaxResponseWithResult(['c' => $bShouldContinue]);
    }

    /**
     * Notify the current table when a game-specific user preference is changed.
     */
    public function onGameUserPreferenceChanged() {
        global $g_user;

        $this->setAjaxMode();

        $userId = (int) $g_user->get_id();
        $id = (int) $this->getArg('id', AT_posint, true);
        $value = (int) $this->getArg('value', AT_posint, true);

        $this->gamePage->onGameUserPreferenceChanged($userId, $id, $value);

        $this->ajaxResponseWithResult(null);
    }

    //////////////////////////// DEBUG functions (for development) /////////////////////////////////

    public function bgaSaveState() {
        $this->setAjaxMode();
        $slot = (int) $this->getArg('state', AT_posint, true);

        $this->gamePage->debugSaveState($slot);

        $this->ajaxResponse();
    }

    public function bgaLoadSavedState() {
        $this->setAjaxMode();
        $slot = (int) $this->getArg('state', AT_posint, true);

        $this->gamePage->debugLoadSavedState($slot);

        $this->ajaxResponse();
    }

    public function bgaLoadBugReport() {
        $this->setAjaxMode();
        $bugReportId = (int) $this->getArg('bugReportId', AT_posint, true);

        $this->gamePage->debugLoadBugReport($bugReportId);

        $this->ajaxResponse();
    }

    //////////////////////////// LOG access functions (for development) /////////////////////////////////

    public function logaccess() {
        global $g_config, $g_user;

        if (!$this->serverConfig->areGameDebugToolsEnabled()) {
            return;
        }

        $lines = (int)$this->getArg('n', AT_posint, false, 100);
        $table_id = (int)$this->getArg('table', AT_posint, false, 100);
        $err = (int)$this->getArg('err', AT_posint, false, 0);

        $this->userInfos = $g_user->getInfos();
        $name = $this->userInfos['name'];
        if (is_numeric(substr($name, -1, 1))) {
            // Studio user => remove the last digit
            $name = substr($name, 0, -1);
        }

        $header = "<div style='padding: 10px;margin: 0;background-color: black; color: white;'>";
        if ($err == 1) {
            $header .= "BGA unexpected exceptions logs &nbsp;&nbsp;&nbsp;<a href='?err=0&table=$table_id#bottom'  style='color: gray'>[switch to request&sql log]</a><br/>";
        } else {
            $header .= "BGA request&SQL logs &nbsp;&nbsp;&nbsp;<a href='?err=1&table=$table_id#bottom' style='color: gray'>[switch to error log]</a><br/>";
        }
        $header .= "<form method='POST' action=''>";
        $header .= "<input type='hidden' name='table' value='$table_id'></input>";
        $header .= "<input type='hidden' name='err' value='$err'></input>";
        $header .= "Display <input type='text' name='n' size='6' value='$lines'></input> last lines. <input type='submit' value='Refresh' ></input>";
        $header .= '</form>';
        $header .= '</div>';

        echo $header;
        echo '<hr/>';

        $basename = $err == 1 ? 'errtournoi.log' : 'tournoi.log';
        if ($g_config['split_log_file_per_users']) {
            $file = $g_config['app_log_path'] . $basename . '.' . $name;
        } else {
            $file = $g_config['app_log_path'] . $basename;
        }

        $logs = $this->realLastBigfileLines($file, $lines);

        echo nl2br($logs);

        echo '<hr/>';
        echo "<a name='bottom'></a>";
        echo $header;
    }

    /**
     * Read the last N lines of a large file without loading it entirely.
     *
     * Note: not used in games.
     *
     * @param string $file
     * @param int $num
     * @return string
     */
    private function realLastBigfileLines(string $file, int $num): string
    {
        $line = '';

        $f = fopen($file, 'r');
        $cursor = -1;

        fseek($f, $cursor, SEEK_END);
        $char = fgetc($f);

        /**
         * Trim trailing newline chars of the file
         */
        while ($char === "\n" || $char === "\r") {
            fseek($f, $cursor--, SEEK_END);
            $char = fgetc($f);
        }

        for ($i = 0; $i < $num; $i++) {
            /**
             * Read until the start of file or first newline char
             */
            while ($char !== false && $char !== "\n" && $char !== "\r") {
                /**
                 * Prepend the new char
                 */
                $line = $char . $line;
                fseek($f, $cursor--, SEEK_END);
                $char = fgetc($f);
            }

            $line = $char . $line;
            $char = fgetc($f);
        }

        return $line;
    }

    /**
     * Loads the view of a game.
     */
    public function __default() {
        $this->view = $this->moduleName . '_' . $this->moduleName;
        $this->trace('Complete reinitialization of board game');
    }

    protected function getGameActionClass()/*: GameAction*/ {        
        $className = GameAction::class;
        $classFile = APP_GAMES_PATH . $this->gameName . '/current/' . $this->gameName . '.action.php';
        if (file_exists($classFile)) {
            $className = 'action_' . $this->gameName;
        } else {
            $classFile = null;
        }

        if ($classFile) {
            require_once $classFile;
        }

        $gameAction = new $className();
        $gameAction->initGameObject($this->gameName, $this->game, $this);
        $gameAction->copyParameterOverridesFrom($this);

        return $gameAction;
    }

    public function performServerAction(string $action): void {
        global $g_config;

        // if the function exists in the GamePageAction file, just call it
        if (method_exists($this, $action)) {
            $this->$action();
            return;
        }
        // else it is a game action, call the appropriate function in the GameAction

        if ($g_config['can_save_table_image'] && $this->serverConfig->isStudio()) {
            // save game state in slot 4 before doing the action, so the dev can revert the last action
            $this->gamePage->debugSaveState(4);
        }

        $gameName = $this->viewArgs['current_game_name'] ?? $this->gameName ?? null;

        \Bga\GameFramework\Table::runGameCode($gameName, fn() => $this->getGameActionClass()->performServerAction($action));
    }
}
