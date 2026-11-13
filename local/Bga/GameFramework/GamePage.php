<?php
declare(strict_types=1);

namespace Bga\GameFramework;

use Bga\GameFramework\Actions\Debug;

/**
 * Handle the game Table class.
 */
class GamePage {
    protected /*Table*/ $game;
    protected string $gameName;
    protected int $tableId;

    #[\DI\Attribute\Inject]
    protected \Bga\GameFramework\Old\Db $db;
    #[\DI\Attribute\Inject]
    protected \Bga\Services\Notify $notify;
    #[\DI\Attribute\Inject]
    protected \Bga\GameFramework\StudioTools\StudioTools $studioTools;

    public function setup(string $gameName, int $tableId)/*: Table*/ {
        $this->gameName = $gameName;
        $this->tableId = $tableId;

        // make sure the DB is set to the game DB, in case the game constructor make DB calls (it shouldn't, but some do)
        $this->setGameDb();

        $this->setupGameInstance($gameName);

        return $this->game;
    }

    public function getGame()/*: Table*/ {
        return $this->game; // needed for gameserver.game.php actions
    }

    /**
     * Create the game instance of the main class for a game.
     *
     * Will try, in order, with root being the game's release directory:
     * - class \Bga\Games\<Gamename>\Game in root/modules/php/Game.php (using the autoloader)
     * - class \<Gamename in root/<gamename>.game.php (legacy way)
     *
     * The legacy way is not having the DI instanciation.
     */
    public function setupGameInstance(string $gameName): void {
        global $bgaContainer;

        if (isset($this->game)) {
            return;
        }

        // make sure the autoloader for `\Bga\Games\...` will only allow to load classes for $gameName
        BgaGameAutoloader::restrictToGame($gameName);

        /**
         * The APP_GameClass and APP_DbObject has been moved to \Bga\GameFramework\Old, but some games
         * still reference them as \APP_DbObject, so we create these aliases to not break the games referencing them directly.
         */
        foreach (['APP_GameClass', 'APP_DbObject'] as $aliasClassName) {
            if (!class_exists($aliasClassName, false)) {
                // to make sure we do not call class_alias twice for the same class
                class_alias("\\Bga\\GameFramework\\Old\\APP_DbObject", "\\$aliasClassName");
            }
        }

        // First check if a namespaced class exists.
        // Leverages the autoloader for this.
        $className = "\\Bga\\Games\\$gameName\\Game";
        try {
            if (class_exists($className)) {
                $this->game = $bgaContainer->make($className);
                return;
            }
        } catch (\Throwable $e) {
            $this->throwGameStartException($e, "Namespaced game module could not be loaded: $className");
        }

        // Fall back on the legacy way:
        // - the class should be named "Gamename" (capitalized gamename)
        // - it should be defined in the game's directory, in gamename.game.php.

        $classFilePath = APP_GAMES_PATH . "$gameName/current/$gameName.game.php";
        if (!file_exists($classFilePath)) {
            $gameFilePath = APP_GAMES_PATH . "$gameName/current/modules/php/Game.php";
            $gameFileExists = file_exists($gameFilePath);
            $exceptionMessage = $gameFileExists
                ? "Class \"$className\" not found in modules/php/Game.php"
                : "Legacy game module not found: $gameName.game.php";
            throw new \feException($exceptionMessage, false, false);
        }

        try {
            require_once $classFilePath;
        } catch (\CompileError $e) {
            throw new \feException(
                "Legacy game module could not be loaded: $gameName.game.php: " .
                    $e->getMessage() .
                    '(' .
                    $e->getFile() .
                    ' line ' .
                    $e->getLine() .
                    ')',
                false,
                false,
            );
        } catch (\Throwable $e) {
            $this->throwGameStartException($e, "Legacy game module could not be loaded: $gameName.game.php");
        }

        // Get class name
        $className = ucwords($gameName);
        if (!class_exists($className)) {
            throw new \feException("Class '$className' for legacy game module not found", false, false);
        }

        $this->game = new $className();
    }

    /**
     * Throw a generic exception if the game class cannot be loaded.
     * 
     * If we're in a dev context, add more details : the exception message and stack trace.
     */
    private function throwGameStartException(\Throwable $e, string $message): void {
        if (in_array(Table::getBgaEnvironment(), ['studio', 'dev'])) {
            // give a more detailled message of the issue
            $message .= ": " . $e->getMessage() . PHP_EOL . PHP_EOL . $e->getTraceAsString();
        }
        throw new \feException($message, false, false);
    }

    /**
     * Select the game-table database for the current GS page.
     *
     * Missing GS databases are normal for old ended tables whose game DB has been cleaned up. For example,
     * players may open a GS link from a game-result email days later. Redirect those cases back to the MS table
     * page. If MS still considers the table live, surface the missing DB as a real service error.
     */
    public function setGameDb(): void {
        global $g_config;

        try {
            $this->db->select("ebd_{$this->gameName}_{$this->tableId}");
        } catch (\feException $e) {
            if ($g_config['dev_mode']) {
                throw $e;
            }

            // Ugly compatibility adapter: masterNodeRequest() and getMasterNodeUrl() still live as protected
            // methods on the legacy DB object, so expose only what this framework class needs.
            $moduleObject = new class extends \Bga\GameFramework\Old\APP_DbObject {
                public function callMasterNodeRequest($method, $args) {
                    return parent::masterNodeRequest($method, $args);
                }

                public function getMasterNodeUrl($bForceHttp = false) {
                    return parent::getMasterNodeUrl($bForceHttp);
                }
            };

            try {
                $tableStatusResult = $moduleObject->callMasterNodeRequest('getTableStatus', ['table_id' => $this->tableId]);
                $tableStatus = isset($tableStatusResult['status']) ? (string) $tableStatusResult['status'] : null;
            } catch (\Throwable) {
                $tableStatus = null;
            }

            if (in_array($tableStatus, ['play', 'asyncplay'], true)) {
                throw new \RuntimeException(
                    "Game table database not found for {$this->gameName} table #{$this->tableId}: " . $e->getMessage(),
                );
            }

            $url = $g_config['cluster_is_master']
                ? '/table?table=' . $this->tableId
                : $moduleObject->getMasterNodeUrl() . '/table?table=' . $this->tableId;
            header('Location: ' . $url);
            exit();
        }
    }

    public function initGameTableObjects(?string $lockUuid, ?int $aiPlayer): int {
        global $g_user;

        $this->setGameDb();

        // Get table basic infos
        $o_tableinfos = new TableInfos();
        $o_tableinfos->setTable($this->tableId);
        $tableinfos = $o_tableinfos->get(!empty($this->game->bSelectGlobalsForUpdate));
        $gameId = $tableinfos['game_id'];

        $this->game->lock_uuid = $lockUuid;

        // Ai player playing
        if ($aiPlayer !== null) {
            $is_ai = $this->db->getUniqueValue("SELECT player_ai FROM player WHERE player_id='$aiPlayer'");

            if ($is_ai == 1) {
                //  So we can autologin as this user !
                $g_user->setTemporaryMasquerade($aiPlayer);

                // Save that this AI has played, during 2 seconds
                $key = 'ai_played_' . $this->tableId . '_' . $aiPlayer;
                if (\apcu_exists($key)) { // APCUREF:keep, AI is disabled for now
                    // The AI has played recently => send a 2 seconds synchronous notification in order the player can understand what is happening
                    $this->game->notifyAllPlayers('aiPlayerWaitingDelay', '', []);
                } else {
                    \apcu_store($key, 1, 2); // APCUREF:keep, AI is disabled for now
                }
            } else {
                throw new \feException("Player $aiPlayer is not an AI !");
            }
        }

        // Play on correct Arena game check
        // Note: this check is also done:
        //  - on client side (it disabled the ajaxcalls + there is a CSS protection on the page), but it can be easily cheated by players
        //  - at the end of the move (metasite/asyncMove). However, this can also use to cheat on some case where it allows you to reveal some private infos. See for example: https://boardgamearena.com/bug?id=64945
        //  - thus, we need this additional check before the moves happened. Note that this one relies on APCU, so it is not perfect and we may miss some moves. This is one this is important
        //   to keep all the other checks (client side for usability, end of move for security in most case, this one for tricky cases)
        //
        if ($lockUuid !== null) {
            if ($g_user->is_logged()) {
                $key_gamePageInfos = 'gamePageInfos_' . $this->tableId . '_' . $g_user->get_id();
                $gamePageInfos = \apcu_fetch($key_gamePageInfos); // APCUREF:keep, to be reworked entirely
                if ($gamePageInfos) {
                    if (isset($gamePageInfos['table_to_play_id']) && $gamePageInfos['table_to_play_id'] != $this->tableId) {
                        // You cannot play on this table for now
                        $urlGame = '/play?table=' . $gamePageInfos['table_to_play_id'];
                        $error_text = bga_format(_('You must play first on *this game*.'), [
                            '*' => fn($text) => '<a href="' .
                                htmlspecialchars($urlGame) .
                                '" target="_blank">' .
                                htmlspecialchars($text) .
                                '</a>',
                        ]);
                        throw new \feException($error_text, true);
                    }
                }
            }
        }

        $this->game->setTable((int)$this->tableId, $this->gameName, (int)$gameId);

        return (int)$gameId;
    }
    
    /**
     * Is it still used??? Remove here and in GamePageAction if not.
     */
    public function getAllTableDatas(): array {
        return $this->game->getAllTableDatas();
    }

    /**
     * Chat message.
     */
    public function say(string $message): void {
        $this->game->say($message);
    }

    public function wouldLikeToThink(): void {
        $this->game->wouldLikeToThink();
    }

    /**
     * Maintain the user online.
     */
    public function wakeup(bool $active, bool $is_yourturn_ack, mixed $table_id): void {
        global $bgaContainer;

        $o_status = $bgaContainer->get('module.website.status');
        $o_status->wakeUp($active, $is_yourturn_ack, $table_id, $this->game->isRealtime());
    }

    public function wakeupPlayers(): void {
        $this->game->wakeupPlayers();
    }

    /**
     * Get notifications from game history.
     */
    public function getNotificationHistory(int $from_notif, ?int $to_notif, bool $private_included, bool $loghistory_included, string $archive): array {
        $history = $this->game->getNotificationHistory(
            $from_notif,
            $to_notif,
            $private_included,
            $archive,
            $loghistory_included,
        );

        return $history;
    }

    public function aiNotPlaying(): void {
        $this->game->aiNotPlaying();
    }

    public function aiError(string $error): void {
        $this->game->aiError($error, $this->game->getCurrentPlayerId(true));
    }

    public function skipPlayersOutOfTime($bWarn): array {
        return $this->game->skipPlayersOutOfTime($bWarn);
    }

    public function zombieBack(): void {
        $this->game->zombieBack();
    }

    /**
     * Show a player cursor position for a table.
     */
    public function showCursor(mixed $infos): void {
        global $g_user;
        $this->notify->notifyNow('/table/t' . $this->tableId, 'showCursor', '', [
            'path' => $infos,
            'player_id' => $g_user->get_id(),
        ]);
    }

    /**
     * Show a player cursor click for a table.
     */
    function showCursorClick(mixed $infos): void {
        global $g_user;
        $this->notify->notifyNow('/table/t' . $this->tableId, 'showCursorClick', '', [
            'path' => $infos,
            'player_id' => $g_user->get_id(),
        ]);
    }

    public function endLockScreen(): bool {
        return $this->game->endLockScreen();
    }

    public function sendNotifications(): void {
        $this->game->sendNotifications();
    }

    public function getAjaxResponseResult(mixed $result): mixed {
        $this->game->onEndAjaxAction();
        $this->game->checkActivePlayersChange();
        $this->game->checkReturnState();
        $this->game->asyncEliminatePlayers();
        $this->game->ensureLockNotification();

        $this->game->sendNotifications(); // Note: we must send notifications first so that ajaxSpecialResult is filled before ajaxResponse

        if ($this->game !== null && isset($this->game->ajaxSpecialResult) && $result == null) {
            $result = $this->game->ajaxSpecialResult;
        }

        if ($this->game !== null && isset($this->game->saveReplayPointAfterNotificationsSending)) {
            $this->game->saveReplayPointUsingReplaySavePoint();
        }

        return $result;
    }

    /**
     * Notify the current table when a game-specific user preference is changed.
     */
    public function onGameUserPreferenceChanged(int $userId, int $id, int $value): void {
        $this->game->userPreferences->updateCache($userId, $id, $value);
    }

    /**
     * Save the current state of the table (DB dump) to a save slot.
     * 
     * 🐛 Studio debug function 🐛
     */
    public function debugSaveState(int $slot): void {
        $this->studioTools->saveState($this->gameName, $this->tableId, $slot);
    }

    /**
     * Load a saved slot (DB dump) to the current table.
     * 
     * 🐛 Studio debug function 🐛
     */
    public function debugLoadSavedState(int $slot): void {
        $this->studioTools->loadSavedState($slot);
    }

    /**
     * Load a saved DB dump linked to a bug report to the current table.
     * 
     * 🐛 Studio debug function 🐛
     */
    public function debugLoadBugReport(int $bugReportId): void {
        $this->studioTools->loadBugReport($this->gameName, $this->tableId, $bugReportId);
    }

    public function isRealtimeTable(): bool {
        return $this->game->gamestate->table_globals[ GAMESTATE_CLOCK_MODE ] < 10;
    }

    /**
     * Mark the table as conceded.
     *
     * @param int|null $conceder_player_id Player ID of the conceding player; null when all players concede together (coop).
     * @param bool $is_coop Whether the table is in cooperative mode, meaning every player must be marked as conceded.
     * @param bool $is_solo Whether the table is a solo setup, used to adjust concession notifications.
     */
    public function concede(int|null $conceder_player_id = null, bool $is_coop = false, bool $is_solo = false) {
        if ($is_coop) {
            $players = $this->game->loadPlayersBasicInfos();

            foreach ($players as $player_id => $player) {
                $this->game->o_tableinfos->setConcede((int) $player_id);
            }

            $this->game->notifyConcede($player_id, !$is_solo);
        } else {
            if ($conceder_player_id === null) {
                throw new \BgaSystemException('The conceder player id must be sent for non-coop games');
            }
            $this->game->o_tableinfos->setConcede($conceder_player_id);
            $this->game->notifyConcede($conceder_player_id);
        }

        // Force end of game so that no action can be possible (ex: afer an abandon)
        $this->game->bThisIsConcede = true;

        // ... and jump to end state
        $this->game->gamestate->jumpToState(99); // Note: 99 = game end

        $this->game->sendNotifications();
    }

    /**
     * List the Debug functions the developer can use on Studio.
     * 
     * 🐛 Studio debug function 🐛
     */
    public function getGameDebugFunctions(): array {
        $functions = [];

        $functionNames = array_filter(get_class_methods($this->game), fn($name) => strpos($name, 'debug_') === 0);
        foreach ($functionNames as $functionName) {
            if (in_array($functionName, [
                'debug_bgaPlayMoves',
                'debug_updateBgaTableCounter',
                'debug_updateBgaPlayerCounter',
            ])) {
                continue;
            }

            $shortName = substr($functionName, 6);
            $reflectionMethod = new \ReflectionMethod($this->game, $functionName);
            $attributes = $reflectionMethod->getAttributes(Debug::class);
            $debugAttribute = count($attributes) > 0 ? $attributes[0]?->newInstance() : null;
            $functions[$shortName] = [
                'reload' => $debugAttribute?->reload ?? false,
                'parameters' => [],
            ];
            foreach ($reflectionMethod->getParameters() as $param) {
                $functions[$shortName]['parameters'][] = [
                    'name' => $param->name,
                    'type' => $param->getType() !== null ? $param->getType()->getName() : null,
                    'optional' => $param->isOptional(),
                    'defaultValue' => $param->isOptional() ? $param->getDefaultValue() : null,
                ];
            }
        }

        return $functions;
    }
}
