<?php
//declare(strict_types=1);

namespace Bga\GameFramework;

use \Locale;
use Bga\GameFramework\Actions\Types\JsonParam;

const GAME_GLOBAL_LAST_MOVE_TIMESTAMP = 'last_move_timestamp';
const GAME_GLOBAL_NEXT_MOVE_ID = 'next_move_id';
const GAME_GLOBAL_BGA_RANKING_MODE = 'bgaranking_mode';
const GAME_GLOBAL_PLAYER_TURN_NUMBER = 'playerturn_nbr';
const GAME_GLOBAL_GAME_PROGRESSION = 'gameprogression';
const GAME_GLOBAL_REFLEXION_TIME_PROFILE = 'reflexion_time_profile';
const GAME_GLOBAL_INITIAL_REFLEXION_TIME = 'initial_reflexion_time';
const GAME_GLOBAL_ADDITIONAL_REFLEXION_TIME = 'additional_reflexion_time';

const BGA_INITIAL_STATE_ID = '_BGA_INITIAL_STATE_ID';

/**
 * Base classe for all games main table class
 */
abstract class Table extends Old\APP_GameClass
{
    var /*array*/ $players = [];
    var /*?int*/ $table_id = null;
    var /*string*/ $gamename;
    var /*?int*/ $gameid = null;
    public ?\Bga\GameFramework\GamestateMachine $gamestate = null;
    var ?TableInfos $o_tableinfos = null;
    var $bGameAbandonForced = false;
    private mixed $gameResult = null;
    /**
     *  Possible values :
     *  'synchro_error_corrupted' => For technical reasons your table has been terminated. We apologize for the inconvenience and appreciate your understanding.
     *  'abandon_by_decision' => collective abandon
     *  'express_stop' => dev studio action
     *  'didntstart_players_left'
     *  'synchro_error_finished_on_gs'
     *  'synchro_error_not_on_gs'
     *  'error_tournament_wrongnumber' => Not the good number of player for this encounter => cancel it with immediate result
     *  'abandon_by_tournamenttimeout'
     *  'didntstart_cron_init_timeout'
     *  'didntstart_cron_timeout'
     *  'matchmaking_player_canceled'
     *  'didntplay_cron_timeout'
     */
    private ?string $GameAbandonReason = null;

    var $bGameAbandonForcedByMetasite = false;
    var $bGameAbandonByTournamentTimeout = false;
    var $bZombieTurnWarningSent = false;
    var $nbrZombieTurnCycle = 0;
    var $activePlayersWhenActionStarted = [];
    var $setupPlayersInfos = null;
    public $ajaxSpecialResult = null;
    var $bIndependantMultiactiveTable = false; // always false???
    var /*protected bool*/ $bSelectGlobalsForUpdate = false;
    var /*array*/ $player_preferences = [];
    var /*?int*/ $saveReplayPointAfterNotificationsSending;
    var /*private bool*/ $bEndLockScreenCase = false;
    var /*private bool*/ $bGameResultSendToMS = false;
    var /*private bool*/ $bDoNotTriggercheckActivePlayersChange = false;

    public $tie_breaker_description = ''; // deprecated, should be remove from games declaring it as it is now in the gameinfos

    // Notifications packets (1 packet = notifications send together in 1 centrifuge packet)
    // packet_id => array of notifications
    private $notifications = [];

    // If "true" : we are undoing the latest notifications (get back in time)
    protected $notifications_undo = false;

    // Current notification packet for this target (target = player_id or 'all')
    private $target_to_notification_packet = [];
    private $next_notification_packet_id = 1;

    // Target for this notification packet
    private $notification_packet_to_target = [];

    private $undoSaveOnMoveEnd = false;
    public bool $bThisIsConcede = false;

    var $private_notification = false; // Next notification to be sent privacy
    var $chatmessage_notification = false; // Next notification is a chat message (higher priority & different warning sound)
    var $not_a_move_notification = false; // Next notification is not a move and shouldn't increase the move counter
    var $gamestate_labels = [
        GAME_GLOBAL_LAST_MOVE_TIMESTAMP => 0,
        GAME_GLOBAL_NEXT_MOVE_ID => 3,
        GAME_GLOBAL_REFLEXION_TIME_PROFILE => GAMESTATE_CLOCK_MODE,
        GAME_GLOBAL_BGA_RANKING_MODE => 201,
        GAME_GLOBAL_PLAYER_TURN_NUMBER => 6,
        GAME_GLOBAL_GAME_PROGRESSION => 7,
        GAME_GLOBAL_INITIAL_REFLEXION_TIME => 8,
        GAME_GLOBAL_ADDITIONAL_REFLEXION_TIME => 9,
    ];
    var $lock_uuid = null;

    /**
     * List of the players to eliminate on the MS side at the end of the action
     * Shape of each entry: [eliminatedPlayerId, currentPlayerId]
     */
    private array $playersToEliminateAtTheEndOfTurn = [];
    public bool $isGameStateChangedAtTheEndOfTurn = false;

    /**
     * List of bot events queued during the action and flushed once the DB transaction is committed.
     *
     * @var array<int, array{player_id: int, payload: array<string, mixed>}>
     */
    private array $queuedBotEvents = [];

    public \Bga\GameFramework\Bga $bga;
    public \Bga\GameFramework\Db\Globals $globals;
    public \Bga\GameFramework\Notify $notify;
    public \Bga\GameFramework\Legacy $legacy;
    public \Bga\GameFramework\TableOptions $tableOptions;
    public \Bga\GameFramework\UserPreferences $userPreferences;
    public \Bga\GameFramework\TableStats $tableStats;
    public \Bga\GameFramework\PlayerStats $playerStats;
    public \Bga\GameFramework\Components\DeckFactory $deckFactory;
    public \Bga\GameFramework\Debug $debug;

    /**
     * Return the BGA environment this table is running on.
     * This should be used for debug purpose only.
     * 
     * 📖 documented function.
     * 
     * @return string "studio" or "prod"
     */
    final public static function getBgaEnvironment(): string
    {
        static $bgaEnvironment = null;

        if ($bgaEnvironment !== null) {
            return $bgaEnvironment;
        }

        global $g_config;
        $split_domain = explode('.', $g_config['app_domain']);

        // Get the significant domain (discard numeric prefix for gameservers)
        $bga_env = is_numeric($split_domain[0]) ? $split_domain[1] : $split_domain[0];

        // Translate to env name
        $map_env = [
            'far' => 'dev',
            'studio' => 'studio',
            'preprod' => 'preprod',
            'boardgamearena' => 'prod',
        ];
        $bgaEnvironment = isset($map_env[$bga_env]) ? $map_env[$bga_env] : 'unknown';
        return $bgaEnvironment;
    }

    /**
     * Run game code, setting the Sentry context and activating exceptionOnWarning if set in gameinfos.
     */
    final public static function runGameCode(string $gameName, $function) {
        return $function();
    }

    /**
     * Report gamename for translation function.
     */
    protected function getGameName()/*: string*/ {
        if ($this->gamename === null) {
            $className = explode('\\', get_class($this));
            $this->gamename = strtolower(end($className));
        }
        return $this->gamename;
    }

    /**
     * Where you retrieve all game data during a complete reload of the game. Return value must be associative
     * array. Value of `players` is reserved for returning players data from players table, if you set it must
     * follow certain rules.
     */
    //abstract protected function getAllDatas()/*: array*/;

    /**
     * Method to override to set up each game.
     * Initialize global value. This is not required if you ok with default value if 0. This should be called from
     * `Table::setupNewGame()` function.
     */
    abstract protected function setupNewGame(/*array*/$players, /*array*/$options = [])/*: void*/;

    /**
     * To be overriden by each game.
     * We cannot add the return type until all game specifies it, because it won't be compatible with unspecified.
     * 
     * This method is called each time it is the turn of a player who has quit the game (= "zombie" player).
     * You can do whatever you want in order to make sure the turn of this player ends appropriately
     * (ex: pass).
     *
     * Important: your zombie code will be called when the player leaves the game. This action is triggered
     * from the main site and propagated to the gameserver from a server, not from a browser.
     * As a consequence, there is no current player associated to this action. In your zombieTurn function,
     * you must _never_ use `getCurrentPlayerId()` or `getCurrentPlayerName()`, otherwise it will fail with a
     * "Not logged" error message.
     *
     * @param array{ type: string, name: string } $state
     * @param int $active_player
     * @return void
     */ 
    //abstract protected function zombieTurn(/*array*/ $state, /*int*/ $active_player )/*: void*/;

    /**
     * Just used by LegacyGameState so it can call zombieTurn even if the game declare it protected
     */
    final public function runLegacyGameStateZombieTurn(array $state, int $playerId) {
        try {
            $this->zombieTurn($state, $playerId);
        } catch (\Exception $e) {
            if ($state['type'] === 'private') {
                // for private states, zombieTurn was called as if the type were 'multipleactiveplayer'
                // we try first the real type 'private' as some devs fixed it, but for the other games 
                // if it fails with 'private' we try again with 'multipleactiveplayer'
                $this->zombieTurn([...$state, 'type' => 'multipleactiveplayer'], $playerId);
            } else {
                throw $e;
            }
        }
    }

    /**
     * Translation function using appropriate gettext domain
     * 
     * 📖 was a documented function.
     * 
     * @deprecated use clienttranslate instead. Until the games stop to override it, we cant make it typed/final
     */
    /*final*/ public function _(/*string*/ $text)/*: string*/
    {
        if ($text == '') {
            return '';
        }
        // Note: avoid void gettext ("display gettext info") bug
        else {
            return translate($this->getGameName(), $text, LC_MESSAGES);
        }
    }

    function __construct()
    {
        if (file_exists(APP_GAMES_PATH . $this->getGameName() . '/current/material.inc.php')) {
            require APP_GAMES_PATH . $this->getGameName() . '/current/material.inc.php';
        } elseif (file_exists(APP_GAMEMODULE_PATH . 'module/' . $this->getGameName() . '/material.inc.php')) {
            require APP_GAMEMODULE_PATH . 'module/' . $this->getGameName() . '/material.inc.php';
        } elseif (file_exists(APP_GAMEMODULE_PATH . '/material.inc.php')) {
            require APP_GAMEMODULE_PATH . '/material.inc.php';
        }

        $this->bga = new \Bga\GameFramework\Bga(
            $this,
            fn (string $method, array $args): mixed => $this->masterNodeRequest($method, $args)
        );
        $this->globals = $this->bga->globals;
        $this->notify = $this->bga->notify;
        $this->legacy = $this->bga->legacy;
        $this->tableOptions = $this->bga->tableOptions;
        $this->userPreferences = $this->bga->userPreferences;
        $this->tableStats = $this->bga->tableStats;
        $this->playerStats = $this->bga->playerStats;
        $this->deckFactory = $this->bga->deckFactory;
        $this->debug = $this->bga->debug;

        // Ensure framework globals are always available, even if the game never calls initGameStateLabels().
        $this->initGameStateLabels();
    }

    /**
     * First function to be call: setup the object
     * (Note: the "basic" setup is used for the table creation, where there is no player and no game state)
     */
    final function setTable(int $table_id, string $gamename, int $gameid, bool $basicSetup = false): void
    {
        self::trace('setTable');
        $this->table_id = $table_id;
        $this->gamename = $gamename;
        $this->gameid = $gameid;

        $this->o_tableinfos = new TableInfos();
        $this->o_tableinfos->setTable((int) $this->table_id);

        $this->gamestate = new GamestateMachine();
        $this->gamestate->loadStateMachine($this, $this->gamename, (int)$this->table_id);

        if (!$basicSetup) {
            // Upgrade game DB structure if needed
            $db_version = intval(self::getGameStateValue('game_db_version'));
            $game_version = self::gameVersionToDbVersion(getCurrentGameVersion($this->getGameName()));

            if (
                ($game_version == 999999999 ? 9999999999 : $game_version) >
                ($db_version == 999999999 ? 9999999999 : $db_version)
            ) {
                // We need some adjustment for patch testing on the local version since the value is adjusted to fit into an int(11)
                $this->upgradeTableDbInternal($db_version, $game_version);

                // Done ! Mark this DB as updated
                self::setGameStateValue('game_db_version', $game_version);
            }

            $this->activePlayersWhenActionStarted = $this->gamestate->getActivePlayerList();
        }

        $this->initTable();
    }

    /**
     * Apply an SQL upgrade of the tables.
     * Use DBPREFIX_<table_name> for all tables in the $sql parameter.
     * 
     * 📖 documented function.
     * 
     * ⚠️ this function use $db and not Table DB functions to bypass the `bga_` check.
     * 
     * @param $sql the SQL to run, with table names prefixed by DBPREFIX_
     * @return void
     */
    final public static function applyDbUpgradeToAllDB(string $sql): void
    {
        global $bgaContainer;
        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
        $db->query(str_replace('DBPREFIX_', '', $sql));

        try {
            // Note: these tables may not exists
            $db->query(str_replace('DBPREFIX_', 'zz_savepoint_', $sql));
        } catch (\feException $e) {
            // ... so ignore the errors it this is the case !
        }
    }

    /**
     * Called for every php callback by the framework, and it can be implemented by the game (empty by default).
     *
     * You can use it in rare cases where you need to read database and manipulate some data before ANY php * entry
     * functions are called (such as `getAllDatas`, `action*`, `st*`, etc.).
     *
     * Note: it is not called before `arg**` methods.
     * 
     * 📖 was a documented function.
     * 
     * @return void
     */
    protected function initTable()/*: void*/
    {
    }

    /**
     * For authorized games using external API only.
     * Use this from game code instead of calling `masterNodeRequest('getGameSpecificMetaInfos', ...)` directly.
     *
     * Example:
     *   $accessibleFactionIds = $this->getGenericGameInfos('accessible_factions');
     *
     * This wrapper is current-player scoped and should be called from the GS only.
     * 
     * 📖 documented function.
     * 
     * @param string $api the api
     * @param array $args the arguments to send
     * @return array the result of the external API call
     */
    final public function getGenericGameInfos(string $api, array $args = []): array
    {
        $newArgs = $args;
        // Add/override main fields before sending
        $newArgs['current_player_id'] = $this->getCurrentPlayerId(true);
        $newArgs['table_id'] = $this->table_id;
        $newArgs['api'] = $api;
        $newArgs['game'] = $this->gamename;
        if (isset($newArgs['player_id'])) { // if the dev requests data for a specific player, it must be a player at the table
            $player_id = (int) $newArgs['player_id'];
            $players = $this->loadPlayersBasicInfos();
            if (!array_key_exists($player_id, $players)) {
                throw new SystemException(
                    "Player {$player_id} is not playing here on table #{$this->table_id}"
                );
            }
        }
        return $this->masterNodeRequest('getGameSpecificMetaInfos', $newArgs);
    }

    /**
     * Called during getAllDatas : check if we have a zombie player, if yes, is he active (meaning table is stuck), if yes run the zombie code again.
     * If the dev fixed the zombie code, it will unlock the table that was waiting for a zombie player to play, else it will log an error so the dev can have detail on what is failing.
     */
    private function checkStuckedZombiePlayers(): void
    {
        $players = $this->loadPlayersBasicInfos();
        $zombiePlayers = array_filter($players, fn($player) => $player['player_zombie'] == 1);
        if (empty($zombiePlayers)) {
            return; // no zombie players, nothing to check
        }
        $zombiePlayerIds = array_values(array_map(fn($player) => (int)$player['player_id'], $zombiePlayers));
        $activePlayerIds = array_values(array_map(fn($activePlayerId) => (int)$activePlayerId, $this->gamestate->getActivePlayerList()));
        $activeZombiePlayerIds = array_values(array_intersect($zombiePlayerIds, $activePlayerIds));
        if (empty($activeZombiePlayerIds)) {
            return; // the zombie players are not active, nothing to check
        }

        $unlockedAtLeastOne = false;
        foreach ($activeZombiePlayerIds as $activePlayerId) {
            try {
                $this->trace("Stucked zombie turn, player $activePlayerId");

                $state = $this->gamestate->getCurrentState($activePlayerId);
                $this->gamestate->runStateClassZombie($state, $activePlayerId);
                $unlockedAtLeastOne = true;
            } catch (\Throwable $e) {
                $this->error("Active player $activePlayerId is stuck in zombie mode, running the zombie code failed: ".$e);
            }
        }

        if ($unlockedAtLeastOne) {
            try {
                $this->checkReturnState();
            } catch (\Throwable $e) {
                $this->error("checkStuckedZombiePlayers failed in checkReturnState: ".$e);
            }
        }
    }


    /**
     * Get all datas of the game for a complete setup or reset.
     * Note: NEVER return any admin/moderation/sensible data here since it can be accessed using identity spoofing using replaysavepoint
     */
    final public function getAllTableDatas(bool $bOnlyCurrentGameState = false): array
    {
        try {
            $this->checkStuckedZombiePlayers();
        } catch (\Throwable $e) {
            $this->error("checkStuckedZombiePlayers failed: ".$e);
        }        

        /** @var int */
        $currentPlayerId = (int)$this->getCurrentPlayerId();

        $functionName = 'getAllDatas';

        $reflection = new \ReflectionClass($this);
        if (!$reflection->hasMethod($functionName)) {
            throw new \BgaSystemException("The game has no $functionName method.");
        }

        $method = $reflection->getMethod($functionName);
        $parameters = $method->getParameters();

        $functionParameters = [];
        foreach ($parameters as $index => $parameter) {
            $paramName = $parameter->getName();
            $paramType = $parameter->getType()?->getName();
            if (in_array($paramName, ['playerNo', 'player_no', 'currentPlayerNo', 'current_player_no']) && $paramType === 'int') {
                $players = $this->loadPlayersBasicInfos();
                $player = array_find($players, fn($p) => (int)$p['player_id'] === $currentPlayerId);
                $functionParameters[] =  $player ? (int)$player['player_no'] : null; // current player id could be a spectator, so we cannot use getPlayerNoById that would trigger an exception
            } else if (in_array($paramName, ['playerId', 'player_id', 'currentPlayerId', 'current_player_id']) && $paramType === 'int') {
                $functionParameters[] = $currentPlayerId;
            }

            if (count($functionParameters) <= $index) { // nothing matching the param
                //throw new \BgaSystemException("Unknown '$paramType $paramName' parameter on $functionName function");
                $this->warn("Unknown '$paramType $paramName' parameter on $functionName function");
            }
        }

        $result = \Bga\GameFramework\Table::runGameCode($this->getGameName(), fn() => $this->$functionName(...$functionParameters));

        // Add game state
        $state = $this->gamestate->state(false, !$bOnlyCurrentGameState);
        if ($state) {
            // Adding current game state to result

            // (note: filter private infos if any)
            if (isset($state['args']['_private'])) {
                $state_args_for_player = null;
                foreach ($state['args']['_private'] as $target_id => $player_private_args) {
                    if (is_numeric($target_id)) {
                        if ($this->bga->notify->getUseNo()) {
                            $currentPlayerNo = null;
                            $players = $this->loadPlayersBasicInfos();
                            if (array_key_exists($currentPlayerId, $players)) {
                                $currentPlayerNo = (int)$players[$currentPlayerId]['player_no'];
                            }
                            if ($currentPlayerNo !== null && $target_id == $currentPlayerNo) {
                                $state_args_for_player = $player_private_args;
                            }
                        } else {
                            if ($target_id == $currentPlayerId) {
                                $state_args_for_player = $player_private_args;
                            }
                        }
                    } elseif ($target_id == 'active') {
                        if ($this->gamestate->isPlayerActive($currentPlayerId)) {
                            $state_args_for_player = $player_private_args;
                        }
                    }
                }

                unset($state['args']['_private']);
                if (isset($state_args_for_player)) {
                    if ($this->bga->notify->isMergePrivate($state['args'])) {
                        $state['args'] = [...$state['args'], ...$state_args_for_player];
                    } else {
                        $state['args']['_private'] = $state_args_for_player;
                    }
                }
            }
            unset($state['args']['_merge_private']);

            $result['gamestate'] = $state;
            $result['gamestate']['updateGameProgression'] = $this->getSafeGameProgression(); // Note: add the game progression if it is not compute on this state

            if (array_key_exists('private_states', $state) && sizeof($state['private_states']) > 0) {
                //remove private states of other players
                $privateStates = $state['private_states'];

                $result['gamestate']['private_state'] = null;
                if (array_key_exists($currentPlayerId, $privateStates)) {
                    $result['gamestate']['private_state'] = $privateStates[$currentPlayerId];
                }
                unset($result['gamestate']['private_states']);
            }
        }

        // Table speed
        $result['tablespeed'] = self::getGameStateValue(GAME_GLOBAL_REFLEXION_TIME_PROFILE);

        $result['game_result_neutralized'] = self::getGameStateValue('game_result_neutralized');
        $result['neutralized_player_id'] = self::getGameStateValue('neutralized_player_id');

        // Add players information
        $this->bgaInternalLoadPlayersBasicInfos();
        foreach ($this->players as $player_id => $player) {
            $result['players'][$player_id]['color'] = $player['player_color'];
            $result['players'][$player_id]['name'] = $player['player_name'];
            $result['players'][$player_id]['zombie'] = $player['player_zombie'];
            $result['players'][$player_id]['eliminated'] = $player['player_eliminated'];
            $result['players'][$player_id]['beginner'] = $player['player_beginner'] !== null;
        }

        // Player ordering
        $players = self::loadPlayersBasicInfos();
        $nextPlayer = self::createNextPlayerTable(array_keys($players));
        if (isset($players[$currentPlayerId])) {
            // Is part of the game
            $player_order = [$currentPlayerId];
            $current_player = $currentPlayerId;
            $current_player = $nextPlayer[$current_player];
            while ($current_player != $currentPlayerId) {
                $player_order[] = $current_player;
                $current_player = $nextPlayer[$current_player];
            }
        } else {
            // Is a spectator
            $player_order = array_keys($players);
        }
        $result['playerorder'] = $player_order;

        if (!$bOnlyCurrentGameState) {
            // Add machine states
            $result['gamestates'] = $this->gamestate->getStatesAsArray();
        }

        // Add notification no datas
        $result['notifications'] = self::getCurrentNotificationNextNo($currentPlayerId);

        return $result;
    }

    /**
     * Check the "current_player" spectator status. If true, the user accessing the game is a spectator (not part of
     * the game). For this user, the interface should display all public information, and no private information
     * (like a friend sitting at the same table as players and just spectating the game).
     * 
     * 📖 documented function.
     *
     * @return bool if the current player is a spectator (not in the list of players for this table)
     */
    public function isSpectator()/*: bool*/
    {
        global $bgaContainer;
        $playerId = $bgaContainer->get(\Bga\Account\SessionManager::class)->getBgaUserId(nullIfNotLogged: true);
        $players = self::loadPlayersBasicInfos();

        return !isset($players[$playerId]);
    }

    /**
     * Launch a complete setup of this game, including a removal of all pre existing datas
     * players contains the (ordered) list of "player_id => array( player_id, player_name, player_is_admin )" for the table,
     * and a reinitialization of game state machine.
     * Note: if player array is null: reset game with same players
     */
    final public function setupNewGameTable(
        int $game_id,
        array $players = [],
        array $options = [],
        bool $bIsRematchSwappingPlayerOrder = false,
        array $player_prefs = [],
        array $game_flags = [],
        array $table_metadata = []
    ): void {
        self::trace('setupNewGameTable');

        if (count($players) == 0) {
            self::trace('Reset game with same players');
            $players = self::loadPlayersBasicInfos();
        }

        // Regenerate player's canals & get admin
        $admin_player = null;
        foreach ($players as $player_id => &$player) {
            if ($player['player_is_admin']) {
                $admin_player = (int)$player_id;
            }

            // for compatibility with games that still have `addslashes( $player['player_avatar'] )` in their code
            $player['player_canal'] = '';
            $player['player_avatar'] = '';
        }

        // Reset globals
        self::DbQuery('DELETE FROM global WHERE 1 ');

        // Add game_id globals
        $this->o_tableinfos->setGlobal(\GAMESTATE_GAME_ID, (int) $game_id);

        // Add game version
        $game_version = getCurrentGameVersion($this->getGameName());
        $db_version = self::gameVersionToDbVersion($game_version);
        $this->o_tableinfos->setGlobal(\GAMESTATE_GAMEVERSION, (int) $db_version);

        $this->o_tableinfos->setGlobal(\GAMESTATE_GAME_RESULT_NEUTRALIZED, 0);
        $this->o_tableinfos->setGlobal(\GAMESTATE_NEUTRALIZED_PLAYER_ID, 0);
        $this->o_tableinfos->setGlobal(\GAMESTATE_UNDO_MOVES_STORED, 0);
        $this->o_tableinfos->setGlobal(\GAMESTATE_UNDO_MOVES_PLAYER, 0);

        $this->o_tableinfos->setGlobal(
            \GAMESTATE_KEEP_RANKING_ON_QUIT, 
            $game_flags['keep_ranking_on_quit'] ? 1 : 0
        );

        $this->o_tableinfos->setGlobal(
            \GAMESTATE_IS_TOURNAMENT, 
            $table_metadata['is_tournament'] ? 1 : 0
        );

        $this->o_tableinfos->setGlobal(
            \GAMESTATE_DEFER_INITIAL_AI_TURN,
            !empty($game_flags['defer_initial_ai_turn']) ? 1 : 0
        );
        $this->gamestate->table_globals[\GAMESTATE_DEFER_INITIAL_AI_TURN] =
            !empty($game_flags['defer_initial_ai_turn']) ? 1 : 0;

        $this->gamestate->resetGameState($admin_player);

        // Add game options
        $options[GAMESTATE_LAST_MOVE] = 0;
        $options[GAMESTATE_GAMEPROGRESSION] = 0;
        $options[GAMESTATE_PLAYERTURN_NBR] = 0;
        foreach ($options as $option_id => $option_value) {
            $this->gamestate->table_globals[$option_id] = $option_value;
            $this->o_tableinfos->setGlobal((int) $option_id, (int) $option_value);
        }

        if ($this->bIndependantMultiactiveTable) {
            $sql =
                "INSERT INTO playermultiactive (ma_player_id) VALUES ('" .
                implode("'),('", array_keys($players)) .
                "')";
            self::DbQuery($sql);
        }

        $this->setupPlayersInfos = $players;
        $this->player_preferences = $player_prefs;

        // remove the player data we don't want to send to the game setup
        foreach ($players as &$player) {
            unset($player['player_is_premium']);
            // used internally unset($player['player_is_ai']);
            // used internally for player color prefs unset($player['player_colorprefs']);
            // TODO player_is_admin here, but it's currently used by some games
        }
        unset($player);

        global $g_trace;
        $g_trace->log_error_forgame = \Trace::createLogHandler("file", "game_err_{$this->getGameName()}.log", \Monolog\Level::Warning );
        $setupResult = \Bga\GameFramework\Table::runGameCode($this->getGameName(), fn() => $this->setupNewGame($players, $options));
        $g_trace->log_error_forgame = null;

        $initialStateId = $this->getInitialStateId($setupResult);

        self::undoAndReplayInit();

        // Initialize statistics common to all games
        self::initStat('player', 'reflexion_time', 0);

        // Notify all players that a new game has started
        self::notifyAllPlayers('gameStateChange', '', $this->gamestate->state());
        $this->isGameStateChangedAtTheEndOfTurn = true;

        if ($bIsRematchSwappingPlayerOrder) {
            self::notifyAllPlayers(
                'simpleNote',
                clienttranslate('Rematch with the exact same players detected: starting player has been rotated.'),
                $this->gamestate->state()
            );
        }

        // Start game
        $this->start($initialStateId);

        // Then, send notifications created during the startup process
        self::sendNotifications();
        $this->gamestate->bGameCreationRequest = false;
    }

    private function getInitialStateId(mixed $setupResult): int|null {
        $initialStateId = null;
        if (gettype($setupResult) === 'string' && str_starts_with($setupResult, 'Bga\Games')) {
            // it's a state class name, so we redirect to corresponding state
            $initialStateId = $this->gamestate->getStateIdByClassName($setupResult);
            if ($initialStateId === null) {
                throw new \BgaSystemException("setupNewGame is redirecting to inexisting state class $setupResult");
            }
        } else if (gettype($setupResult) === 'integer') {
            if (!array_key_exists($setupResult, $this->gamestate->getStatesAsArray())) {
                throw new \BgaSystemException("setupNewGame is redirecting to inexisting state id $setupResult");
            }
            $initialStateId = $setupResult;
        }
        return $initialStateId;
    }

    /**
     * Transform game string version into DB integer version.
     */
    private function gameVersionToDbVersion(string $game_version)
    {
        if ($game_version == '999999-9999') {
            return intval(999999999);
        } else {
            $game_version = str_replace('-', '', $game_version); // Transform into INT
            return intval($game_version);
        }
    }

    /**
     * List all tables options for the current game.
     */
    function getTableOptions(): array
    {
        global $bgaContainer;
        $tableOptionsManager = $bgaContainer->get(\Bga\Tables\TableOptionsManager::class);
        return $tableOptionsManager->get($this->getGameName());
    }

    /**
     * List all the game options for the current game.
     */
    final public function getGameOptions(): array {
        global $bgaContainer;
        $tableOptionsManager = $bgaContainer->get(\Bga\Tables\TableOptionsManager::class);
        return $tableOptionsManager->getGameOptions($this->getGameName());
    }

    /**
     * List all user preferences for the current game.
     */
    function getTablePreferences(): array
    {
        global $bgaContainer;
        $userPreferencesManager = $bgaContainer->get(\Bga\Tables\UserPreferencesManager::class);
        return $userPreferencesManager->get($this->getGameName());
    }

    /**
     * Return game infos for the current game.
     */
    function getGameinfos()
    {
        global $bgaContainer;
        $gameInfosManager = $bgaContainer->get(\Bga\Tables\GameInfosManager::class);
        return $gameInfosManager->get($this->getGameName());
    }

    /**
     * Start a new game (from game setup)
     */
    private function start(int|null $initialStateId): void
    {
        $this->trace('Starting game');

        $this->gamestate->bGameCreationRequest = true;

        if ($this->getGameStateValue('lock_screen_timestamp') == 0) {
            // No lock screen
            if ($initialStateId !== null) {
                $this->gamestate->jumpToState($initialStateId);
            } else {
                $this->gamestate->nextState('');
            }
        } else if ($initialStateId !== null) {
            // lock screen
            $this->globals->set(BGA_INITIAL_STATE_ID, $initialStateId);
        }
    }

    /**
     * Can be used in state machine to make everybody active as `st` method of multiplayeractive state, it just
     * calls `gamestate->setAllPlayersMultiactive`.
     * 
     * 📖 documented function.
     *
     * @return void
     */
    final public function stMakeEveryoneActive(): void
    {
        $this->gamestate->setAllPlayersMultiactive();
    }

    /**
     * Get an associative array with generic data about players (ie: not game specific data).
     * In opposition to bgaInternalLoadPlayersBasicInfos, only the information the game dev can read are sent.
     * 
     * 📖 documented function.
     *
     * @return array<int, array{
     *   player_id: string, 
     *   player_name: string, 
     *   player_color: string, 
     *   player_no: string,
     *   player_zombie: int,
     *   player_eliminated: int,
     *   player_beginner: string,
     *   concede: int,
     * }>
     */
    final public function loadPlayersBasicInfos(): array
    {
        $players = $this->bgaInternalLoadPlayersBasicInfos();

        foreach ($players as &$player) {
            unset($player['player_next_notif_no']);
            // Keep this compatibility field for released games, but do not expose its internal value.
            $player['player_ai'] = 0;
            $player['player_canal'] = '';
            $player['player_avatar'] = '';
        }
        unset($player);

        return $players;
    }

    /**
     * Get an associative array with generic data about players (ie: not game specific data), including data only used internally.
     *
     * @return array<int, array{
     *   player_id: string,
     *   player_name: string,
     *   player_color: string,
     *   player_no: string,
     *   player_zombie: int,
     *   player_eliminated: int,
     *   player_next_notif_no: string,
     *   player_ai: string,
     *   player_beginner: string,
     *   concede: int,
     * }>
     */
    final public function bgaInternalLoadPlayersBasicInfos(): array
    {
        if (count($this->players) == 0) {
            // Now, we get players basic infos from Tableinfos object
            $tableinfos = $this->o_tableinfos->get();

            if (!isset($tableinfos['players'])) {
                throw new \feException(
                    'Table ' . $this->table_id . ' : error : loadPlayersBasicInfos didnt return any infos on players!'
                );
            }

            $this->players = $tableinfos['players'];
        }
        return $this->players;
    }

    /**
     * Initialize or reload players information.
     * 
     * 📖 documented function.
     *
     * @return void
     */
    final public function reloadPlayersBasicInfos(): void
    {
        $this->players = [];
        if ($this->setupPlayersInfos) {
            // Initial players infos hasn't been setup yet => must do this first
            $this->initSetupPlayersInfos();
            $this->setupPlayersInfos = null;
        }

        $this->o_tableinfos->reload();
    }

    /**
     * Re-attribute colors based on players' preferences.
     * 
     * 📖 documented function.
     *
     * @param array<int, array> $players
     * @param array<string> $all_colors
     * @return void
     */
    final public function reattributeColorsBasedOnPreferences(array $players, array $all_colors): void
    {
        $colors_available = [];
        foreach ($all_colors as $color) {
            $colors_available[$color] = true;
        }

        $players_colors_prefs = [];
        $players_with_color_prefs = [];
        $table_administrator = null;
        foreach ($players as $player_id => $player) {
            if ($player['player_is_admin']) {
                $table_administrator = $player_id;
            }

            if (isset($player['player_colorprefs'])) {
                if (count($player['player_colorprefs']) > 0) {
                    $players_with_color_prefs[$player_id] = $players[$player_id]['player_name'];
                }
                $players_colors_prefs[$player_id] = $player['player_colorprefs'];
            } else {
                $players_colors_prefs[$player_id] = [];
            }
        }

        $player_to_color = [];

        // At first, attribute a color to the table administrator if it has some colors prefereces
        if ($table_administrator !== null && count($players_colors_prefs[$table_administrator]) > 0) {
            $color = $this->getBestColorFromColorPrefs($colors_available, $players_colors_prefs[$table_administrator]);
            unset($colors_available[$color]);
            $player_to_color[$table_administrator] = $color;
        }

        // Then, attribute a color to each player with colors preferences
        // Shuffle first so that there is no bias towards low user id
        $player_ids = array_keys($players_colors_prefs);
        shuffle($player_ids);
        foreach ($player_ids as $player_id) {
            $color_prefs = $players_colors_prefs[$player_id];
            if ($player_id != $table_administrator && count($color_prefs) > 0) {
                $color = $this->getBestColorFromColorPrefs($colors_available, $color_prefs);

                unset($colors_available[$color]);
                $player_to_color[$player_id] = $color;
            }
        }

        // Finally, attribute remaining colors to remaining players
        foreach ($players_colors_prefs as $player_id => $color_prefs) {
            if (!isset($player_to_color[$player_id])) {
                if (count($colors_available) === 0) {
                    $color = '000000';
                } else {
                    reset($colors_available);
                    $color = key($colors_available);
                    unset($colors_available[$color]);
                }
                $player_to_color[$player_id] = $color;
            }
        }

        // Then, we can update DB
        foreach ($player_to_color as $player_id => $color) {
            self::DbQuery("UPDATE player SET player_color='$color' WHERE player_id='$player_id'");

            if (isset($players_with_color_prefs[$player_id])) {
                $players_with_color_prefs[$player_id] =
                    '<span style="color:#' . $color . '">' . $players_with_color_prefs[$player_id] . '</span>';
            }
        }

        if (count($players_with_color_prefs) > 0) {
            $log = clienttranslate(
                'Colors of ${players} have been chosen according to their preferences. ${change_preferences}'
            );

            if (count($players_with_color_prefs) == 1) {
                $log = clienttranslate(
                    'Color of ${players} has been chosen according to his/her preferences. ${change_preferences}'
                );
            }

            self::notifyAllPlayers('simpleNote', $log, [
                'players' => '<b>' . implode('</b>, <b>', $players_with_color_prefs) . '</b>',
                'change_preferences' => [
                    'log' => '<a href="' . self::getMasterNodeUrl() . '/preferences" target="_blank">${label}</a>',
                    'args' => [
                        'i18n' => ['label'],
                        'label' => clienttranslate('Change my preferences.'),
                    ],
                ],
            ]);
        }
    }

    /**
     * Returns an array of user preference colors to game colors.
     * Game colors must be among those which are passed to reattributeColorsBasedOnPreferences()
     * Each game color can be an array of suitable colors, or a single color:
     * [
     *    // The first available color chosen:
     *    'ff0000' => ['990000', 'aa1122'],
     *    // This color is chosen, if available
     *    '0000ff' => '000099',
     * ]
     * If no color can be matched from this array, then the default implementation is used.
     * 
     * 📖 documented function.
     *
     * @return array<string, ?string>
     */
    function getSpecificColorPairings(): array
    {
        return [];
    }

    /**
     * Get color for player, based on color preferences.
     */
    private function getBestColorFromColorPrefs(array $colorsAvailable, array $colorPrefs): string
    {
        if (count($colorsAvailable) === 0) {
            // No colours left
            if (count($colorPrefs) > 0) {
                // Just give the player their first preference
                return $colorPrefs[0];
            } else {
                // Black
                return '000000';
            }
        }
        $specificColorPairings = $this->getSpecificColorPairings();
        foreach ($colorPrefs as $prefColor) {
            if (isset($specificColorPairings[$prefColor])) {
                $colorSuggestions = (array) $specificColorPairings[$prefColor];
                // Take the first suggested color available
                foreach ($colorSuggestions as $suggestedColor) {
                    if (isset($colorsAvailable[$suggestedColor])) {
                        return $suggestedColor;
                    }
                }
            }
        }
        return $this->getDefaultBestColorFromColorPrefs($colorsAvailable, $colorPrefs);
    }

    /**
     * Get closest color for player, based on color preferences.
     */
    private function getDefaultBestColorFromColorPrefs(array $colors_available, array $color_prefs)
    {
        if (count($colors_available) == 1) {
            // Only one possible choice
            reset($colors_available);
            return key($colors_available);
        }

        // Give a score to each available colors
        // (Note : the least the score is, the better the color)
        $color_to_score = [];

        // When measuring distances of primary colours, we also check pastel variants and take the minimum
        // This is because pastel versions of these colours are often too far away to be considered
        // In essense "ff0000" should be considered "I want the colour offered by the boardgame which is most red"
        $primaryColorVariants = [
            'ff0000' => ['ff6961'],
            '008000' => ['77dd77'],
            '0000ff' => ['009fe0'],
        ];

        foreach ($colors_available as $color => $dummy) {
            $color_pref_malus = 0;

            foreach ($color_prefs as $colorpref) {
                // Compute distance between this color and preference
                // (note : 0 means "identical color")
                $distance = $this->colorDiff($color, $colorpref);
                if (isset($primaryColorVariants[$colorpref])) {
                    foreach ($primaryColorVariants[$colorpref] as $variant) {
                        $distance = min($distance, $this->colorDiff($color, $variant));
                    }
                }

                if (!isset($color_to_score[$color])) {
                    $color_to_score[$color] = $distance + $color_pref_malus;
                } else {
                    $color_to_score[$color] = min($distance + $color_pref_malus, $color_to_score[$color]);
                }

                // Note : a distance of 128 in a color component
                //      = a distance of 16000 of score
                //      = a rank in color preference
                $color_pref_malus += 7000;
            }
        }

        return getKeyWithMaximum($color_to_score, false, false);
    }

    /**
     * Calculate squared distance between two RGB hex colors.
     *
     * @param string $rgb1
     * @param string $rgb2
     * @return int
     */
    private function colorDiff(string $rgb1, string $rgb2): int
    {
        // Do the math on each tuple.
        $red1 = hexdec(substr($rgb1, 0, 2));
        $green1 = hexdec(substr($rgb1, 2, 2));
        $blue1 = hexdec(substr($rgb1, 4, 2));

        $red2 = hexdec(substr($rgb2, 0, 2));
        $green2 = hexdec(substr($rgb2, 2, 2));
        $blue2 = hexdec(substr($rgb2, 4, 2));

        return ($red1 - $red2) * ($red1 - $red2) +
            ($green1 - $green2) * ($green1 - $green2) +
            ($blue1 - $blue2) * ($blue1 - $blue2);
    }

    /**
     * Initialise player's player_is_ai and player_beginner columns.
     */
    private function initSetupPlayersInfos(): void
    {
        foreach ($this->setupPlayersInfos as $player_id => $player) {
            if ($player['player_is_ai'] == 1) {
                // Mark it as "AI"
                self::DbQuery("UPDATE player SEt player_ai='1' WHERE player_id='$player_id'");
            }

            if ($player['beginner'] == 1 && $player['player_is_ai'] != 1) {
                // Note: AI is NEVER a beginner
                self::DbQuery(
                    "UPDATE player SET player_beginner=0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF WHERE player_id='$player_id'"
                );
            }
        }
    }

    /**
     * Returns the number of players playing at the table.
     * 
     * 📖 documented function.
     *
     * @return int the number of players at the table
     */
    final public function getPlayersNumber(): int
    {
        if (count($this->players) == 0) {
            self::loadPlayersBasicInfos();
        }
        return count($this->players);
    }

    /**
     * Check if the current player can perform a specific action in the current game state, and optionally throw an
     * exception if they can't.
     *
     * The action is valid if it is listed in the "possibleactions" array for the current game state (see game
     * state description). This method MUST be the first one called in ALL your PHP methods that handle player
     * actions, in order to make sure a player doesn't perform an action not allowed by the rules at the point in
     * the game. It should not be called from methods where the current player is not necessarily the active player,
     * otherwise it may fail with an "It is not your turn" exception.
     *
     * If `bThrowException` is set to `false`, the function returns false in case of failure instead of throwing an
     * exception. This is useful when several actions are possible, in order to test each of them without throwing
     * exceptions.
     * 
     * 📖 documented function.
     *
     * @param string $actionName the name of the action
     * @param bool $bThrowException indicates if the function should return an exception if the action cannot be used
     * @return bool if the action can be used
     * @throws \BgaSystemException if `$bThrowException` is true and a failure occurs
     */
    /*final*/ public function checkAction(/*string*/ $actionName, /*bool*/ $bThrowException = true)/*: bool*/
    {
        return $this->gamestate->checkPlayerAction($actionName, $bThrowException);
    }

    /**
     * Check if it is the first time player enter in the game.
     */
    final public function checkGameStart(): bool
    {
        global $g_user;
        $player_id = $g_user->get_id();
        $sql = "SELECT player_id,player_enter_game FROM player WHERE player_id='$player_id'";
        $dbres = self::DbQuery($sql);
        $row = mysql_fetch_assoc($dbres);
        if ($row) {
            if ($row['player_enter_game'] == 0) {
                // Update in DB
                $sql = "UPDATE player SET player_enter_game='1' WHERE player_id='$player_id' ";
                self::DbQuery($sql);

                return true;
            }
        }

        return false;
    }

    ///////////////////////////////////////////////////////////
    /// Game state value

    /**
     * Setup correspondance "labels to id"
     * 
     * This method should be located at the beginning of constructor. This is where you
     * define the globals used in your game logic, by assigning them IDs.
     *
     * You can define up to 80 globals, with IDs from 10 to 89 (inclusive, there can be gaps). Also you must use
     * this method to access value of game options Game_options_and_preferences:_gameoptions.inc.php, in that case,
     * IDs need to be between 100 and 199. You must not use globals outside the range defined above, as those values
     * are used by other components of the framework.
     * 
     * 📖 documented function.
     *
     * @param array<string, int> $labels
     */
    final public function initGameStateLabels(array $labels = []): void
    {
        $this->gamestate_labels = $labels;

        // Game standard options
        $this->gamestate_labels[GAME_GLOBAL_REFLEXION_TIME_PROFILE] = GAMESTATE_CLOCK_MODE;
        $this->gamestate_labels[GAME_GLOBAL_BGA_RANKING_MODE] = 201;
        $this->gamestate_labels['gameprogression'] = 7;
        $this->gamestate_labels[GAME_GLOBAL_INITIAL_REFLEXION_TIME] = 8;
        $this->gamestate_labels[GAME_GLOBAL_ADDITIONAL_REFLEXION_TIME] = 9;
        $this->gamestate_labels[GAME_GLOBAL_NEXT_MOVE_ID] = 3;
        $this->gamestate_labels[GAME_GLOBAL_PLAYER_TURN_NUMBER] = 6;
        $this->gamestate_labels['game_db_version'] = GAMESTATE_GAMEVERSION;

        $this->gamestate_labels['game_language'] = GAMESTATE_GAME_LANG;

        $this->gamestate_labels['game_result_neutralized'] = GAMESTATE_GAME_RESULT_NEUTRALIZED;
        $this->gamestate_labels['neutralized_player_id'] = GAMESTATE_NEUTRALIZED_PLAYER_ID;
        $this->gamestate_labels['undo_moves_stored'] = GAMESTATE_UNDO_MOVES_STORED;
        $this->gamestate_labels['undo_moves_player'] = GAMESTATE_UNDO_MOVES_PLAYER;

        $this->gamestate_labels['keep_ranking_on_quit'] = GAMESTATE_KEEP_RANKING_ON_QUIT;
        
        $this->gamestate_labels['is_tournament'] = GAMESTATE_IS_TOURNAMENT;

        $this->gamestate_labels['lock_screen_timestamp'] = GAMESTATE_LOCK_TIMESTAMP;

        if (!empty($labels) && $this->table_id === null) {
            self::ensureLocalSchemaInitialized(false);
            $this->table_id = 1;
            $this->gamename = $this->getGameName();
            $this->gameid = 1237;
            $this->o_tableinfos = new TableInfos();
            $this->o_tableinfos->setTable(1);
            $this->gamestate = new GamestateMachine();
            $this->gamestate->loadStateMachine($this, $this->gamename, 1);
        }
    }

    /**
     * Initialize global value. This is not required if you ok with default value if 0. This should be called from
     * `setupNewGame()` function.
     * 
     * 📖 documented function.
     * 
     * @param string $value_label the label
     * @param string $value_value the initial value
     * @return void
     */
    final public function setGameStateInitialValue(/*string*/ $value_label, /*int*/ $value_value): void
    {
        $value_id = $this->gamestate_labels[$value_label];
        if (!$value_id) {
            throw new \feException('Unknown gamestate label: ' . $value_label);
        }

        $this->gamestate->table_globals[$value_id] = $value_value;
        $this->o_tableinfos->setGlobal((int) $value_id, (int) $value_value);
    }

    /**
     * Retrieve the value of a global. Returns $default if global has not been initialized (by
     * `setGameStateInitialValue`).
     *
     * NOTE: this method use globals "cache" if you directly manipulated globals table OR call this function after
     * `undoRestorePoint()` - it won't work as expected.
     * 
     * 📖 documented function.
     * 
     * @param string $value_label the label
     * @param ?int $default a default value if the label doesn't have an associated value
     * @return int|string the value
     */
    final public function getGameStateValue(/*string*/ $value_label, /*?int*/ $default = null): int|string
    {
        $value_id = $this->gamestate_labels[$value_label];
        if (!$value_id) {
            throw new \feException('Unknown gamestate label: ' . $value_label);
        }

        if (!isset($this->gamestate->table_globals[$value_id])) {
            if ($default === null) {
                return 0;
            }
            // Now, we consider that a game state value is 0 until it has been set for the first time
            else {
                return $default;
            }
        }

        return $this->gamestate->table_globals[$value_id];
    }

    /**
     * Set the current value of a global.
     * 
     * 📖 documented function.
     * 
     * @param string $value_label the label
     * @param int $value_value the value to store
     * @return void 
     */
    final public function setGameStateValue(/*string*/ $value_label, /*int*/ $value_value): void
    {
        $value_id = $this->gamestate_labels[$value_label];
        if (!$value_id) {
            throw new \feException('Unknown gamestate label: ' . $value_label);
        }

        if (!isset($this->gamestate->table_globals[$value_id])) {
            // Init this game state value first
            self::setGameStateInitialValue($value_label, $value_value);
        }

        $this->gamestate->table_globals[$value_id] = $value_value;

        $this->o_tableinfos->setGlobal((int) $value_id, (int) $value_value);
    }

    /**
     * Increment the current value of a global. If increment is negative, decrement the value of the global.
     *
     * Return the final value of the global. If global was not initialized it will initialize it as 0.
     *
     * NOTE: this method use globals "cache" if you directly manipulated globals table OR call this function after
     * `undoRestorePoint()` - it won't work as expected.
     * 
     * 📖 documented function.
     * 
     * @param string $value_label the label
     * @param int $increment the increment to add to the current value
     * @return int the new value 
     */
    final public function incGameStateValue(/*string*/ $value_label, /*int*/ $increment): int
    {
        $value_id = $this->gamestate_labels[$value_label];
        if (!$value_id) {
            throw new \feException('Unknown gamestate label: ' . $value_label);
        }

        if (!isset($this->gamestate->table_globals[$value_id])) {
            // Init this game state value first
            self::setGameStateInitialValue($value_label, 0);
            $value = 0;
        } else {
            $value = $this->gamestate->table_globals[$value_id];
        }

        $this->gamestate->table_globals[$value_id] = $value + $increment;
        $this->o_tableinfos->incGlobal((int) $value_id, (int) $increment);

        return $value + $increment;
    }

    /**
     * Get the "active_player", whatever what is the current state type.
     *
     * Note: it does NOT mean that this player is active right now, because state type could be "game" or
     * "multiplayer".
     *
     * Note: avoid using this method in a "multiplayer" state because it does not mean anything.
     * 
     * 📖 documented function.
     * 
     * @return string the active player id typed as string
     */
    final public function getActivePlayerId()/*string|int*/
    {
        $activePlayerId = $this->gamestate->getPlayerActiveThisTurn();
        return $activePlayerId !== null ? (string)$activePlayerId : null;
    }

    /**
     * Get the "active_player" name
     *
     * Note: avoid using this method in a "multiplayer" state because it does not mean anything.
     * 
     * 📖 documented function.
     * 
     * @return string the active player name
     */
    final public function getActivePlayerName(): string {
        $players = self::loadPlayersBasicInfos();
        $activePlayerId = (int)self::getActivePlayerId();
        if (isset($players[$activePlayerId])) {
            return $players[$activePlayerId]['player_name'];
        } else {
            $this->warn("Trying to call getActivePlayerName with no active player");
            return '';
        }
    }

    /**
     * Get the "current_player". The current player is the one from which the action originated (the one who sent
     * the request). In general, you shouldn't use this method, unless you are in "multiplayer" state.
     *
     * **NOTE: This is not necessarily the active player!**
     *
     * @see https://doc.studio.boardgamearena.com/framework-documentation/back-end/main-game-logic/#file-structure
     * 
     * 📖 documented function.
     * 
     * @return string the current player id, typed as string
     */
    public function getCurrentPlayerId(/*bool*/ $bReturnNullIfNotLogged = false)
    {
        global $g_user;
        $userId = $g_user->get_id(bNullIfNotLogged: $bReturnNullIfNotLogged);
        return $userId !== null ? (string) $userId : null;
    }

    /**
     * Get the "current_player" name.
     *
     * Note: avoid using this method in a "multiplayer" state because it does not mean anything.
     * 
     * 📖 documented function.
     * 
     * @return string the current player name.
     * @throws \BgaSystemException if the current player is not at the table (i.e. spectator).
     */
    public function getCurrentPlayerName()/*: string*/
    {
        return $this->getPlayerNameById((int)$this->getCurrentPlayerId());
    }

    /**
     * Get the "current_player" color.
     *
     * Note: avoid using this method in a "multiplayer" state because it does not mean anything.
     * 
     * 📖 documented function.
     * 
     * @return string the current player color.
     * @throws \BgaSystemException if the current player is not at the table (i.e. spectator).
     */
    public function getCurrentPlayerColor()/*: string*/
    {
        return $this->getPlayerColorById((int)$this->getCurrentPlayerId());
    }

    /**
     * Check the "current_player" zombie status. If true, player is zombie, i.e. left or was kicked out of the game.
     * 
     * 📖 documented function.
     * 
     * @return bool if the current player is a zombie
     * @throws \BgaSystemException if the current player is not at the table (i.e. spectator).
     */
    public function isCurrentPlayerZombie()/*: bool*/
    {
        global $g_user;
        $players = self::loadPlayersBasicInfos();
        $playerId = $g_user->get_id();
        if (!isset($players[$playerId])) {
            throw new \BgaSystemException(
                "Player {$playerId} is not playing here on table #{$this->table_id} (3)"
            );
        }

        return $players[$playerId]['player_zombie'] == 1;
    }

    /**
     * Alias for getPlayersNumber.
     * 
     * 📖 documented function.
     *
     * @return int the number of players at the table
     */
    public function getPlayerCount()/*: int*/
    {
        return $this->getPlayersNumber();
    }

    /**
     * Get the player name by player id.
     * 
     * 📖 documented function.
     * 
     * @param int $player_id the player id 
     * @return string the player name
     */
    public function getPlayerNameById(/*int*/ $player_id)/*: string*/
    {
        $players = self::loadPlayersBasicInfos();

        if (!array_key_exists((int)$player_id, $players)) {
            throw new \BgaSystemException(
                "Player {$player_id} is not playing here on table #{$this->table_id}"
            );
        }

        return $players[$player_id]['player_name'];
    }

    /**
     * Get the player name by player no.
     * 
     * 📖 documented function.
     * 
     * @param int $playerNo the player no 
     * @return string the player name
     */
    public function getPlayerNameByNo(int $playerNo): string
    {
        foreach ($this->loadPlayersBasicInfos() as $playerId => $player) {
            if ((int) $player['player_no'] === $playerNo) {
                return $player['player_name'];
            }
        }

        throw new SystemException(
            "Player {$playerNo} is not playing here on table #{$this->table_id}"
        );
    }

    /**
     * Get 'player_no' (number) by player id.
     * 
     * 📖 documented function.
     * 
     * @param int $player_id the player id 
     * @return string the player no typed as string
     */
    public function getPlayerNoById(/*int*/ $player_id)
    {
        $players = self::loadPlayersBasicInfos();

        if (!array_key_exists((int)$player_id, $players)) {
            throw new \BgaSystemException(
                "Player {$player_id} is not playing here on table #{$this->table_id}"
            );
        }

        return $players[$player_id]['player_no'];
    }

    /**
     * Get the player id by player no.
     * 
     * 📖 documented function.
     * 
     * @param int $playerNo the player no 
     * @return int the player id
     */
    public function getPlayerIdByNo(/*int*/$playerNo)/*: int*/ {
        $players = self::loadPlayersBasicInfos();

        foreach ($players as $playerId => $player) {
            if ((int) $player['player_no'] === (int) $playerNo) {
                return (int) $playerId;
            }
        }

        throw new \BgaSystemException(
            "Player no {$playerNo} is not playing here on table #{$this->table_id}"
        );
    }


    /**
     * Get the player color by player id.
     * 
     * 📖 documented function.
     * 
     * @param int $player_id the player id 
     * @return string the player color
     */
    public function getPlayerColorById(/*int*/ $player_id)/*: string*/
    {
        $players = self::loadPlayersBasicInfos();

        if (!array_key_exists((int)$player_id, $players)) {
            throw new \BgaSystemException(
                "Player {$playerId} is not playing here on table #{$this->table_id}"
            );
        }

        return $players[$player_id]['player_color'];
    }

    /**
     * Get the player color by player no.
     * 
     * 📖 documented function.
     * 
     * @param int $playerNo the player no 
     * @return string the player color
     */
    final public function getPlayerColorByNo(int $playerNo): string
    {
        foreach ($this->loadPlayersBasicInfos() as $playerId => $player) {
            if ((int) $player['player_no'] === $playerNo) {
                return $player['player_color'];
            }
        }

        throw new SystemException(
            "Player {$playerNo} is not playing here on table #{$this->table_id}"
        );
    }

    /**
     * Return the creator of the table. 
     * Should not be used: will return null or 0 if the table was created automatically for a tournament.
     */
    public function getTableAdminPlayerId()
    {
        return self::getUniqueValueFromDB('SELECT global_value value FROM global WHERE global_id = 5');
    }

    /**
     * Using $players array creates a map of current => next as in example from getNextPlayerTable(), however you
     * can use custom order here. If parameter $bLoop is set to true then last player will points to first (creating
     * a loop), false otherwise. In any case index 0 points to first player (first element of $players array).
     *
     * Note: This function DOES NOT change the order in database, it only creates a map using key/values as descibed.
     *
     * 📖 documented function.
     * 
     * @param array<int> $players the player ids
     * @param bool if a last line should be added to make a loop
     * @return array<int, int>
     */
    public function createNextPlayerTable(/*array*/ $players, /*bool*/ $bLoop = true)/*: array*/
    {
        $next_player = [];

        $prev = null;
        $first = null;
        foreach ($players as $player_id) {
            if ($prev != null) {
                $next_player[$prev] = $player_id;
            }
            if ($first == null) {
                $first = $player_id;
            }
            $prev = $player_id;
        }

        if ($bLoop) {
            $next_player[$player_id] = $first;
        }
        // Loop
        else {
            $next_player[$player_id] = null;
        } // No loop

        $next_player[0] = $first; // If no active player => the first one

        return $next_player;
    }

    /**
     * Return an associative array which associate each player with the next player around the table.
     *
     * In addition, key 0 is associated to the first player to play.
     *
     * 📖 documented function.
     *
     * @return array<int, int>
     */
    function getNextPlayerTable()/*: array*/
    {
        $players = $this->loadPlayersBasicInfos();
        return self::createNextPlayerTable(array_keys($players));
    }

    /**
     * Using $players array creates a map of current => prev as in example from getPrevPlayerTable(), however you
     * can use custom order here. If parameter $bLoop is set to true then first player will points to last (creating
     * a loop), false otherwise. In any case index 0 points to first player (first element of $players array).
     *
     * Note: This function DOES NOT change the order in database, it only creates a map using key/values as descibed.
     * 
     * @param array<int> $players the player ids
     * @param bool if a last line should be added to make a loop
     * @return array<int, int>
     */
    public function createPrevPlayerTable(/*array*/ $players)/*: array*/
    {
        $result = self::createNextPlayerTable($players);
        unset($result[0]);
        $result = array_flip($result);
        return $result;
    }

    /**
     * Return an associative array which associate each player with the previous player around the table.
     *
     * 📖 documented function.
     *
     * @return array<int, int>
     */
    function getPrevPlayerTable()/*: array*/
    {
        $players = $this->loadPlayersBasicInfos();
        return self::createPrevPlayerTable(array_keys($players));
    }

    /**
     * Get player playing after given player in natural playing order.
     *
     * 📖 documented function.
     *
     * @param int $player_id a player id
     * @return int the player after
     */
    function getPlayerAfter(/*int*/ $player_id)
    {
        $next_player_table = self::getNextPlayerTable();

        if (!array_key_exists((int)$player_id, $next_player_table)) {
            throw new \BgaSystemException(
                "Player {$playerId} is not playing here on table #{$this->table_id}"
            );
        }

        return $next_player_table[$player_id];
    }

    /**
     * Get the number of the player after the given player in natural playing order.
     *
     * 📖 documented function.
     *
     * @param int $playerNo the player number
     * @return int the next player number
     */
    final public function getPlayerNoAfter(int $playerNo): int
    {
        $playerId = $this->getPlayerIdByNo($playerNo);
        $nextPlayerId = $this->getPlayerAfter($playerId);

        return (int)$this->getPlayerNoById($nextPlayerId);
    }

    /**
     * Get player playing before given player in natural playing order.
     *
     * 📖 documented function.
     *
     * @param int $player_id a player id
     * @return int the player before
     */
    function getPlayerBefore(/*int*/ $player_id)
    {
        $prev_player_table = self::getPrevPlayerTable();

        if (!array_key_exists((int)$player_id, $prev_player_table)) {
            throw new \BgaSystemException(
                "Player {$playerId} is not playing here on table #{$this->table_id}"
            );
        }

        return $prev_player_table[$player_id];
    }

    /**
     * Get the number of the player before the given player in natural playing order.
     *
     * 📖 documented function.
     *
     * @param int $playerNo the player number
     * @return int the previous player number
     */
    final public function getPlayerNoBefore(int $playerNo): int
    {
        $playerId = $this->getPlayerIdByNo($playerNo);
        $previousPlayerId = $this->getPlayerBefore($playerId);

        return (int)$this->getPlayerNoById($previousPlayerId);
    }

    /**
     * Make the next player active in the natural player order.
     *
     * NOTE: you must transition to a state in the action triggering this call, so the change of active player is notified to the front.
     *
     * 📖 documented function.
     *
     * @return int the new active player id
     */
    public function activeNextPlayer()
    {
        self::trace('activeNextPlayer');

        $players = $this->loadPlayersBasicInfos();
        $state = $this->gamestate->state(); // needed for active_player

        // Build next player table
        $next_player = self::createNextPlayerTable(array_keys($players));

        // Make next player active
        $active_player = $next_player[$state['active_player']];
        $this->gamestate->changeActivePlayer($active_player);

        return $active_player;
    }

    /**
     * Make the previous player active (in the natural player order).
     *
     * NOTE: you must transition to a state in the action triggering this call, so the change of active player is notified to the front.
     *
     * 📖 documented function.
     *
     * @return int the new active player id
     */
    public function activePrevPlayer()
    {
        self::trace('activePrevPlayer');

        $players = $this->loadPlayersBasicInfos();
        $state = $this->gamestate->state(); // needed for active_player

        // Build next player table
        $prev_player = self::createPrevPlayerTable(array_keys($players));

        // Make next player active
        $active_player = $prev_player[$state['active_player']];
        $this->gamestate->changeActivePlayer($active_player);

        return $active_player;
    }

    /**
     * Forcing the end of game on GS side
     * @return bool true if this generated a "gameResult" back to MS
     */
    public function forceEndOfGame(/*string*/$reason): bool
    {
        self::notifyAllPlayers(
            'simpleNote',
            clienttranslate('All players (with a positive clock) choosed to abandon this game.'),
            []
        );

        // Force end of game so that no action can be possible (ex: afer an abandon)
        $this->bGameAbandonForced = true;
        $this->GameAbandonReason = $reason;

        // This table is currently in destruction (destroyTable) on MS side
        $this->bGameAbandonForcedByMetasite = true;

        // Save that the game has been abandonned:
        // _ all players scores to ZERO
        // _ all players auxiliary scores to -4242
        self::DbQuery("UPDATE player SET player_score='0', player_score_aux='-4242'");

        self::reloadPlayersBasicInfos();
        $this->gamestate->jumpToState(99);

        return $this->bGameResultSendToMS;
    }

    ////////////////////////////////////////
    //// Reflexion time action

    /**
     * Give standard extra time to this player (standard extra time is a game option)
     *
     * 📖 documented function.
     *
     * @param int $player_id the player id
     * @return void
     */
    public function giveExtraTime(/*int*/ $player_id, /*?int*/ $specific_time = null)/*: void*/
    {
        global $g_config;
        if (!self::isAsync()) {
            if ($specific_time === null) {
                $additional_time = self::getGameStateValue(GAME_GLOBAL_ADDITIONAL_REFLEXION_TIME);
            } else {
                $additional_time = $specific_time;
            }

            // We must call "reflexionTimeUpdate" here for the following reason:
            // - we are going to update the "player_remaining_reflexion_time"
            // - however, some time may has been spent from the beginning of the move (ie: player_start_reflexion_time is far away)
            // - thus, if we do not update the "player_start_reflexion_time" the extratime may have zero effect since there is a upper limit
            //   for the remaining reflexion time
            // - when we call giveExtraTime, we explitely want to give more time to a player. We do not want his time to be over the max, but we
            //   want that this maximum could be reached
            // - as a consequence, we need "player_start_reflexion_time" to be reseted to "now()" by a call to "reflexionTimeUpdate"
            $this->gamestate->reflexionTimeUpdate();

            // Initial reflexion time is also the maximum possible reflexion time
            $maximum_time = self::getGameStateValue(GAME_GLOBAL_INITIAL_REFLEXION_TIME);

            $players = self::loadPlayersBasicInfos();

            if (!isset($players[$player_id])) {
                throw new \feException('Tried to give extratime to non-existent player ' . $player_id);
            }

            if ($players[$player_id]['player_beginner'] !== null) {
                // Beginner => time is x2
                //$maximum_time *= 2;            // We do not double maximum time anymore for beginners (only additional time)
                $additional_time *= 2;
            }

            $sql = "UPDATE player SET player_remaining_reflexion_time=LEAST( $maximum_time, player_remaining_reflexion_time+$additional_time ) WHERE player_id='$player_id' ";
            self::DbQuery($sql);

            $this->gamestate->incReflexionTime($player_id, $additional_time, $maximum_time);

            if ($specific_time === null) {
                $this->incStat(1, 'time_bonus_nbr', $player_id);
            }
        }

        // Note: reflexion time for async mode is a completely different story
        //       (see sendAsyncTableMove in gamestate.game.php)
    }

    ////////////////////////////////////////
    //// Zombie players

    /**
     * Check if it is a zombie turn. If so, trigger the zombie action
     * Now: check also AI turn
     */
    function checkZombieTurn()/*: void*/
    {
        // Note: zombie turn are something with a weak fiability
        // => we cannot be sure that this function will succeed
        // BUT, if it fails it is blocking the game
        // => catch any exception and makes everyone quits the table is someone quit the game
        $last_zombie_player = null;
        $players = $this->bgaInternalLoadPlayersBasicInfos();

        try {
            self::trace('checkZombieTurn');

            $state = $this->gamestate->state();
            $active_player_list = $this->gamestate->getActivePlayerList();

            self::trace('action player number = ' . count($active_player_list));
            foreach ($active_player_list as $active_player) {
                if (isset($players[$active_player])) {
                    if (
                        $players[$active_player]['player_zombie'] == 1 ||
                        $players[$active_player]['player_eliminated'] == 1
                    ) {
                        // Protection against infinite loop (could happend in some cases)
                        $this->nbrZombieTurnCycle++;
                        $maximumZombieTurns = $this->bga->debug->isExecutingDebugAction() ? 10000 : 100;
                        if ($this->nbrZombieTurnCycle > $maximumZombieTurns) {
                            throw new \feException('Zombie infinite loop');
                        }
                        self::trace('Zombie turn, player ' . $active_player);

                        global $g_user;
                        $g_user->setTemporaryMasquerade($active_player);
                        $last_zombie_player = $active_player;

                        $state = $this->gamestate->getCurrentState($this->getCurrentPlayerId());
                        $this->gamestate->runStateClassZombie($state, (int)$active_player);
                        $g_user->setTemporaryMasquerade(null);
                    } elseif ($players[$active_player]['player_ai'] == 1) {
                        try {
                            // This is an AI player, and he must play
                            $this->aiPlayer((int) $active_player);
                        } catch (\feException $exception) {
                            $exception->aiException = true;
                            throw $exception;
                        }
                    }
                }
            }

            if ($last_zombie_player !== null) {
                // Note: if at least 1 zombie has played
                self::checkReturnState();
            }
        } catch (\feException | GameException $exception) {
            if ($this->bGameAbandonForced == true) {
                // Work already done
            } elseif ($this->bZombieTurnWarningSent == true) {
                throw $exception;
            } elseif (isset($exception->aiException)) {
                // Ai exception => must be processed like any AI exception
                throw $exception;
            } else {
                // Zombie code is sometimes weird or incomplete, so we introduce some tolerance here:

                // 1°) if there is an error in zombie code, at first we log it anyway so we can check it and fix it
                global $g_trace;
                $g_trace->logFatalException($exception);

                // ... and make sure the following code is executed only once even we are in nested checkZombieTurn
                $this->bZombieTurnWarningSent = true;

                // 2°) then we signal the current player that the zombie code has failed.

                if (!self::isAsync()) {
                    $this->notifications = [];
                    self::notifyAllPlayers(
                        'zombieModeFail',
                        clienttranslate('Error during Skip turn execution : you may need to abandon the game.'),
                        []
                    );
                    $this->sendNotifications();

                    throw new \feException($exception);
                } else {
                    // This code was deprecated, and REINTRODUCED in Jan 2016 for TURN BASED
                    // Reason : on turn based, in case zombie code failed, the turn of other players NEVER comes. We then have to abandon game, and mail players so they can undertand what happened

                    global $g_user;
                    if ($g_user->is_logged() || $this->bEndLockScreenCase) {
                        // Note about bEndLockScreenCase: this make sure the game is abandonned in case there is a unlock screen after a player left the game + zombie code fail (= unrecoverable solution)
                        global $g_config;

                        //  3°) Is this the first request to fail ?
                        //      (note : we cannot introduce a "confirmation" because the player who was expelled really quits the game with changed COMMITED, so we cannot do this action again)
                        $this->notifications = [];
                        self::notifyAllPlayers(
                            'zombieModeFail',
                            clienttranslate(
                                'Error during Skip turn execution : this game has been cancelled. Please leave the game.'
                            ),
                            []
                        );
                        $this->sendNotifications();

                        $this->bGameAbandonForced = true;

                        self::masterNodeRequest('forceAbandon', [
                            'table_id' => $this->table_id,
                            'player' => $last_zombie_player,
                            'players' => array_keys($players),
                        ]);
                    } else {
                        // Specific case: this action is trigged by a cronjob.
                        // At now we throw an exception.
                        throw $exception;
                    }
                }
            }
        }
    }

    /**
     * Resume the startup AI turn once the metasite transaction has been committed.
     */
    public function resumeDeferredInitialAiTurn(): void
    {
        if (!$this->shouldDeferInitialAiTurn()) {
            return;
        }

        $this->o_tableinfos->setGlobal(\GAMESTATE_DEFER_INITIAL_AI_TURN, 0);
        $this->gamestate->table_globals[\GAMESTATE_DEFER_INITIAL_AI_TURN] = 0;

        $this->checkZombieTurn();
    }

    public function shouldDeferInitialAiTurn(): bool
    {
        return (int) ($this->gamestate->table_globals[\GAMESTATE_DEFER_INITIAL_AI_TURN] ?? 0) === 1;
    }

    /**
     * Expell out of time players.
     */
    final public function skipPlayersOutOfTime(bool $bWarn = false, bool $bNoWarn = false): array
    {
        global $g_user, $g_config;

        // Skipping turn (using Zombie method) of ONE player who are currently active and out of time (the one which is the MOST out of time)
        $playersinfos = $this->loadPlayersBasicInfos();
        //$player_count = count($playersinfos);
        $zombie_count = 0;
        $delay_to_play = 20;
        foreach ($playersinfos as $player_id => $player) {
            if ($player['player_zombie'] == 1) {
                $zombie_count++;
            }
        }

        if ($g_config['enable_warning_before_expel'] == false) {
            $bWarn = false;
        } // If no warning before expel, remove the warning phase

        // Get current player timer
        $currentPlayerId = (int)$this->getCurrentPlayerId();

        // Impossible to kick a player in a "no_kick" tournament
        if (($this->bga->tournament->getInfo()['oot_options'] ?? null) === 'no_kick') {
            throw new \feException(clienttranslate("It's impossible to kick the player because the tournament's rules prevent it."), true );    
        }

        $playerinfos = $this->getObjectFromDB("SELECT player_zombie, player_eliminated, player_start_reflexion_time, UNIX_TIMESTAMP( NOW() ) - UNIX_TIMESTAMP( player_start_reflexion_time ) think_since, player_remaining_reflexion_time
    		FROM player WHERE player_id = $currentPlayerId");

        $current_player_remaining_time = 0;
        if (boolval($playerinfos['player_eliminated'])) {
            throw new \feException(clienttranslate('You cannot skip turn of other players if you are eliminated'), true);
        } else if ($playerinfos['player_zombie'] == 1) {
            throw new \feException(clienttranslate('You cannot skip turn of other players while your own turns are skipped'), true);
        } else {
            if ($playerinfos['player_start_reflexion_time'] === null) {
                // Not his turn: reflexion time = remaining reflexion time
                $current_player_remaining_time = $playerinfos['player_remaining_reflexion_time'];
            } else {
                // On his turn: reflexion time = remaining reflexion time - think time this move
                $current_player_remaining_time =
                    $playerinfos['player_remaining_reflexion_time'] - $playerinfos['think_since'];
            }
        }

        // Get all players out of time at now (that are not already zombies and excluding current user)
        $players = $this->getObjectListFromDB("SELECT player_id, player_name, player_zombie, player_remaining_reflexion_time - UNIX_TIMESTAMP( NOW() ) + UNIX_TIMESTAMP( player_start_reflexion_time ) remaining_time FROM player
    		WHERE player_start_reflexion_time IS NOT NULL AND player_zombie='0'
            AND player_id != $currentPlayerId
    		AND UNIX_TIMESTAMP( NOW() ) - UNIX_TIMESTAMP( player_start_reflexion_time ) > player_remaining_reflexion_time
    		ORDER BY remaining_time ASC LIMIT 0,1");

        $to_be_expelled = [];

        if (empty($players)) {
            throw new \Bga\Exceptions\Framework\NoOutOfTimePlayersException();
        }

        // check first if there is an exception (not in the same loop as expelling, since we call another server)
        foreach ($players as $player) {
            if ($player['remaining_time'] > $current_player_remaining_time) {
                // The player who tries to skip turn has even LESS time than the targetted player !

                // => throw a violent exception
                throw new \Bga\Exceptions\Framework\CannotExpelPlayerException(
                    clienttranslate(
                        'You are more late than the player you try to skip turn. Please wait until the active player becomes more late than you to skip their turn.'
                    )
                );
            } 
        }

        foreach ($players as $player) {
            $playerId = (int) $player['player_id'];
            $sql = <<<SQL
                SELECT
                    COALESCE(MAX(CASE WHEN gamelog_current_player = $playerId THEN gamelog_move_id END), -1) lastPlayerMoveId,
                    COALESCE(MAX(CASE WHEN gamelog_current_player != $playerId THEN gamelog_move_id END), -1) lastOtherPlayerMoveId
                FROM gamelog
                SQL;
            $lastMoves = $this->getObjectFromDB($sql);
            $lastPlayerMoveId = (int) $lastMoves['lastPlayerMoveId'];
            $lastOtherPlayerMoveId = (int) $lastMoves['lastOtherPlayerMoveId'];

            // Use a new prefix because the old keys used the table move ID and stored only a timestamp.
            $warningKeyPrefix = 'expel_notice_last_move_' . $playerId . '_' . $this->table_id . '_';
            $key = $warningKeyPrefix . $lastPlayerMoveId;
            $warning = apcu_fetch($key); // APCUREF:keep, only for game table.
            $delay_to_play = 20;

            if ($warning !== false) {
                // Keep an active warning's delay when another player moves.
                $delay_to_play = $warning['delay'];
            } elseif ($lastPlayerMoveId > $lastOtherPlayerMoveId) {
                // Each earlier warning in this player's consecutive moves halves the delay once.
                // Include the move before the sequence: its warning was issued before the first move.
                $sql = <<<SQL
                    SELECT DISTINCT gamelog_move_id
                    FROM gamelog
                    WHERE gamelog_current_player = $playerId
                        AND gamelog_move_id > $lastOtherPlayerMoveId
                        AND gamelog_move_id < $lastPlayerMoveId
                    UNION
                    SELECT COALESCE(MAX(gamelog_move_id), -1)
                    FROM gamelog
                    WHERE gamelog_current_player = $playerId
                        AND gamelog_move_id <= $lastOtherPlayerMoveId
                    SQL;
                $previousPlayerMoveIds = $this->getObjectListFromDB($sql, true);

                foreach ($previousPlayerMoveIds as $previousPlayerMoveId) {
                    $previousWarning = apcu_fetch($warningKeyPrefix . $previousPlayerMoveId); // APCUREF:keep, only for game table.
                    if ($previousWarning !== false && $previousWarning['moveId'] > $lastOtherPlayerMoveId) {
                        $delay_to_play = (int) floor($delay_to_play / 2);
                    }
                }
            }

            if ($delay_to_play == 0) {
                // Too much abuse of the system => immediate expel
                $bWarn = false;
                $bNoWarn = true;
            }

            $isRealTime = $this->bga->tableOptions->isRealTime();
            if ($bWarn && $isRealTime) {
                // Note : this warning delay is only for realtime play
                // Only send a warning to this player

                if ($warning === false) {
                    // Note : we are using "notifyNow" here to avoid incrementing move_id
                    $this->notifyNow(
                        '/table/t' . $this->table_id,
                        'skipTurnOfPlayerWarning',
                        clienttranslate(
                            '${player_name} is out of time and is warned : in ${delay} seconds he/she will be expelled from the game if he/she does not play.'
                        ),
                        [
                            'player_name' => $player['player_name'],
                            'player_id' => $player['player_id'],
                            'delay' => $delay_to_play,
                        ]
                    );

                    apcu_add($key, [
                        'timestamp' => time(),
                        'delay' => $delay_to_play,
                        // Keep the table move ID only to detect warnings before another player's move.
                        'moveId' => $this->getGameStateValue(GAME_GLOBAL_NEXT_MOVE_ID),
                    ], 60 * 10); // APCUREF:keep, only for game table.
                }

                $to_be_expelled[] = $player['player_name'];
            } else {
                if (!$bNoWarn) {
                    if ($isRealTime && $g_config['enable_warning_before_expel']) {
                        if ($warning === false) {
                            throw new \Bga\Exceptions\Framework\CannotExpelPlayerException(
                                'It looks that this player has played: you should refresh the page.'
                            );
                        } else {
                            if (time() > $warning['timestamp'] + $delay_to_play) {
                                // Okay, more than 20 sec! (or the appropriate delay)
                            } else {
                                throw new \Bga\Exceptions\Framework\CannotExpelPlayerException("You must wait $delay_to_play seconds.");
                            }
                        }
                    }
                }

                if ($g_user->is_logged()) {
                    $this->notifyAllPlayers(
                        'skipTurnOfPlayer',
                        clienttranslate('${player_name} is out of time, so ${player_name2} skips his/her turn'),
                        [
                            'player_name' => $player['player_name'],
                            'player_name2' => $this->getPlayerNameById($currentPlayerId),
                            'player_id' => $player['player_id'],
                            'zombie' => $isRealTime,
                        ]
                    );
                } else {
                    $this->notifyAllPlayers(
                        'skipTurnOfPlayer',
                        clienttranslate('${player_name} is out of time, so the system skips his/her turn'),
                        [
                            'player_name' => $player['player_name'],
                            'player_id' => $player['player_id'],
                            'zombie' => $isRealTime,
                        ]
                    );
                }

                $to_be_expelled[] = $player['player_name'];

                $this->sendNotifications();
                $this->CommitAllAndRestart(); // Note: expelOutOfTimePlayer is coming back on GS as a "zombie" MS->GS call. If we do not commit,
                //   this "zombie" call is causing a deadlock. As we didn't do anything important on GS side until now,
                //   we can afford an earlier commit here.
                // Okay, expel this player from the game
                $this->masterNodeRequest('expelOutOfTimePlayer', [
                    'table_id' => $this->table_id,
                    'player_id' => $player['player_id'],
                ]);
            }
        }

        return [
            'names' => $to_be_expelled,
            'delay' => $delay_to_play,
        ];
    }

    /**
     * called when some player has been zombified because he quits the game (or have been "skipped").
     */
    public function onPlayerHasBeenZombified(/*int*/ $player_id): void
    {
        $players = self::loadPlayersBasicInfos();

        // FIRST CHECK IF GAME ALLOWS SCORE TO BE KEPT IN CASE OF PLAYER QUIT
        // (do not neutralize game)
        if (self::getGameStateValue('keep_ranking_on_quit') == 1) {
            // send notification to warn that the game will continue normally
            $message = 
                clienttranslate('${player_name} has left the table and will lose this game regardless of the outcome.')
                .'<br><br>'.
                clienttranslate("Since this does not affect gameplay, the game will continue normally.")
                .'<br>'.
                clienttranslate("For this reason, quitting the game will result in a penalty.")
                .'<br><br>'.
                clienttranslate("If you prefer, you may also propose to abandon the game collectively.");

            self::notifyAllPlayers(
                'gameQuitNoNeutralization',
                $message,
                [
                    'player_id' => $player_id,
                    'player_name' => $players[$player_id]['player_name'],
                    'remaning_players' => self::getUniqueValueFromDb("SELECT COUNT(*) FROM player WHERE player_zombie = 0")
                ]
            );

            return;
        }
        
        $isGameNeutralized = self::getGameStateValue('game_result_neutralized') > 0;

        // NEUTRALIZING GAME QUIT
        if (!$isGameNeutralized) {
            // first quitter -> trigger neutralization
            $progression = $this->gamestate->getCurrentMainStateId() === 99 ? 100 : min(100, max(1, $this->getGameProgression())); // exclude 0 progression (sometimes used as indicator of "no neutralization", since games can theoretically be neutralized at 100% progression)
            self::setGameStateValue('game_result_neutralized', $progression);
            self::setGameStateValue('neutralized_player_id', $player_id);

            self::notifyAllPlayers(
                'gameResultNeutralized',
                clienttranslate('${player_name} has quit the game and is going to lose this game whatever happens.'),
                [
                    'progression' => $progression,
                    'player_id' => $player_id,
                    'player_name' => $players[$player_id]['player_name'],
                ]
            );

            return;
        }
        // later quitters -> no penalty
        self::notifyAllPlayers(
            'gameQuitWithNoPenalty',
            clienttranslate('${player_name} quitted the game after someone else quit the game (= no penalties).'),
            [
                'player_id' => $player_id,
                'player_name' => $players[$player_id]['player_name'],
            ]
        );
    }

    /**
     * Force abandon of the table, for example when the game did not manage to play a player zombie turn 
     */
    public function forceAbandon()/*: void*/
    {
        $playersinfos = self::loadPlayersBasicInfos();

        self::masterNodeRequest('forceAbandon', [
            'table_id' => $this->table_id,
            'player' => null,
            'players' => array_keys($playersinfos),
        ]);

        $this->bGameAbandonForced = true;
    }

    /**
     * When a players goes back to a game as a zombie.
     */
    public function zombieBack()/*: void*/
    {
        // Current player wants to get back in the game
        global $g_user;
        $player_id = $g_user->get_id();

        $players = self::loadPlayersBasicInfos();

        // Check this is a zombie
        $playerinfos = self::getObjectFromDB("SELECT player_zombie, player_start_reflexion_time, UNIX_TIMESTAMP( NOW() ) - UNIX_TIMESTAMP( player_start_reflexion_time ) think_since, player_remaining_reflexion_time
    		FROM player WHERE player_id='$player_id'");

        if ($playerinfos['player_zombie'] == 1) {

            // note that if for such cases we don't prevent players to get back in the game, and they happen to quit the table once again, they will get another penalty!
            if (self::getGameStateValue('keep_ranking_on_quit') == 1) {

                throw new \feException(
                    clienttranslate("This game doesn't allow you to get back in the game after leaving"),
                    true
                );
            }

            if ($playerinfos['player_start_reflexion_time'] === null) {
                // Not his turn: reflexion time = remaining reflexion time
                if ($playerinfos['player_remaining_reflexion_time'] < 0) {
                    throw new \feException(
                        clienttranslate("You cannot get back into the game while your time to think hasn't get back above 0."),
                        true
                    );
                }
            } else {
                // On his turn: reflexion time = remaining reflexion time - think time this move
                if ($playerinfos['player_remaining_reflexion_time'] - $playerinfos['think_since'] < 0) {
                    throw new \feException(
                        clienttranslate("You cannot get back into the game while your time to think hasn't get back above 0."),
                        true
                    );
                }
            }


            $this->o_tableinfos->setZombie((int) $player_id, false);

            self::notifyAllPlayers('zombieBack', clienttranslate('${player_name} gets back in the game'), [
                'player_id' => $player_id,
                'player_name' => $players[$player_id]['player_name'],
            ]);
        }
    }

    /**
     * Make an AI player play.
     */
    public function aiPlayer(int $playerId)/*: void*/
    {
        global $bgaContainer;
        $sessionManager = $bgaContainer->get(\Bga\Account\SessionManager::class);

        try {
            $sessionManager->setTemporaryMasquerade($playerId);

            // Indicate to the AI webservice that this is its turn to play
            $args = [
                'player_id' => $playerId,
                'table_id' => $this->table_id,
                'data' => $this->getAllTableDatas(true),
            ];
            $botResult = self::masterNodeRequest('aiPlay', $args);
        }
        finally {
            /** @fixme Try to see if specific to local env with local GS.  Otherwise, produces errors during notifications registration. */
            //            $sessionManager->setTemporaryMasquerade(null);
        }

        if ($botResult['ok'] !== true) {
            throw new \feException(clienttranslate('The bot reported an error: ${error}'), args: ['error' => print_r($botResult, true)]);
        } else {
            // Okay, AI is going to think !
        }
    }

    /**
     * Notify an AI player about one post-action event through the metasite bot service.
     *
     * @param int $playerId AI player identifier at the current table.
     * @return void
     */
    public function aiPlayEvent(int $playerId, array $payload): void
    {
        global $bgaContainer;
        $sessionManager = $bgaContainer->get(\Bga\Account\SessionManager::class);

        try {
            $sessionManager->setTemporaryMasquerade($playerId);

            self::masterNodeRequest('aiPlayEvent', [
                'player_id' => $playerId,
                'table_id' => $this->table_id,
                'data' => $payload,
            ]);
        }
        catch (\Throwable $exception) {
            global $g_trace;
            $g_trace->logFatalException($exception);
        }
    }

    /**
     * Notify AI players when the current post-action state matches one of their subscribed events.
     */
    public function notifyEventsToBots(int $playerId, string $notificationType, string $notificationLog, array $notificationArgs): void
    {
        global $g_trace;
        global $bgaContainer;

        if ($this->shouldDeferInitialAiTurn()) {
            return;
        }

        // Bot instances are deleted when the game result is recorded.
        // They cannot react to notifications from the final game state.
        if ($this->gamestate->getCurrentMainStateId() === 99) {
            return;
        }

        $notifiedEvent = [
            'type' => $notificationType,
            'log' => $notificationLog,
            'args' => $notificationArgs
        ];
        
        $cacheLocalRedis = $bgaContainer->get(\Bga\Services\Cache\LocalRedis::class);
        $eventValidatorService = new \Bga\Bots\EventValidatorService();

        $players = $this->bgaInternalLoadPlayersBasicInfos();
        $player = $players[$playerId] ?? [];
        if (! $player['player_ai']) {
            return;
        }

        try {
            $metadata = $cacheLocalRedis->get("bot.instance.metadata.{$this->table_id}.{$playerId}", function (
                \Symfony\Contracts\Cache\ItemInterface $item,
                bool &$save,
            ) use ($playerId): ?array {
                $metadata = self::masterNodeRequest('getBotMetadata', [
                    'player_id' => $playerId,
                    'table_id' => $this->table_id,
                ]);

                if ($metadata === null) {
                    $save = false;
                    return null;
                }

                $item->expiresAfter(\DateInterval::createFromDateString('1 hour'));

                return $metadata;
            });

            if ($metadata === null) {
                return;
            }

            foreach ($metadata['subscribed_events'] ?? [] as $subscribedEvent) {
                if (!is_array($subscribedEvent)) {
                    continue;
                }

                if (!$eventValidatorService->validateSubscribedEvent($subscribedEvent, $notifiedEvent, $this->gamestate, $player)) {
                    continue;
                }

                $this->queueBotEvent($playerId, $notifiedEvent);

                return;
            }
        } catch (\Throwable $exception) {
            $g_trace->logFatalException($exception);
        }
    }

    /**
     * Queue one bot event so it can be sent after the current DB transaction is committed.
     *
     * @param int $playerId AI player identifier at the current table.
     * @param array<string, mixed> $payload Event payload forwarded to the bot service after commit.
     * @return void
     */
    public function queueBotEvent(int $playerId, array $payload): void
    {
        $this->queuedBotEvents[] = [
            'player_id' => $playerId,
            'payload' => $payload,
        ];
    }

    /**
     * Flush all bot events queued during the current action after the DB transaction is committed.
     *
     * @return void
     */
    public function flushQueuedBotEvents(): void
    {
        $queuedBotEvents = $this->queuedBotEvents;
        $this->queuedBotEvents = [];

        foreach ($queuedBotEvents as $queuedBotEvent) {
            $this->aiPlayEvent($queuedBotEvent['player_id'], $queuedBotEvent['payload']);
        }
    }

    /**
     * Force AI players to play.
     */
    public function aiNotPlaying()/*: void*/
    {
        self::checkZombieTurn();
    }

    /**
     * Notify an AI player error.
     */
    /**
     * Notify table clients that the current bot failed to play.
     *
     * The player id lets clients discard an error that arrived after that bot's
     * turn ended, instead of showing a relaunch action that cannot do anything.
     */
    public function aiError(/*string*/ $error, ?string $playerId = null)/*: void*/
    {
        self::notifyNow('/table/t' . $this->table_id, 'aiError', '', [
            'error' => $error,
            'player_id' => $playerId !== null ? (int) $playerId : null,
        ]);
    }

    ////////////////////////////////////////
    //// Common actions for all games

    /**
     * Add a message in the chat.
     */
    public function say(/*string*/ $message)/*: void*/
    {
        self::trace("Saying: '" . $message . "'");

        if ($message == '') {
            return;
        }

        global $g_user, $bgaContainer, $g_config;

        if (strlen($message) > 300) {
            $message = substr($message, 0, 300) . '...';
        }

        $this->chatmessage_notification = true;

        if (!self::ensure_enough_time_since_last_action('privatechat', $g_user->get_id(), 1)) {
            throw new \feException(clienttranslate('There is a minimum of ${seconds} seconds between messages'), true, args: ['seconds' => 1]);
        }

        $o_grade = $bgaContainer->get('module.mainsite.grade');
        $o_grade->checkRight('chat_speak');

        // note: nothing to do except sending notifications

        $this->private_notification = true;

        $o_player = $bgaContainer->get('module.player.player');
        $player = $o_player->get($g_user->get_id());

        if ($g_config['prevent_spectator_chat'] ?? false) {
            $players = self::loadPlayersBasicInfos();
            if (!isset($players[$g_user->get_id()])) {
                if ($o_grade->hasRight('moderator_panel_access')) {
                    // Judges can speak anyway
                } else {
                    throw new \feException(clienttranslate('Spectators are not authorized to speak'), true);
                }
            }
        }

        self::notifyAllPlayers('chatmessage', '${player_name} ${message}', [
            'player_name' => $player['fullname'],
            'player_id' => $g_user->get_id(),
            'message' => $this->adaptMessage($message, $g_user->get_id()),
        ]);

        global $g_trace;
        $g_trace->chat_log($message, 'T' . $this->table_id);
    }

    public function wouldLikeToThink(): void
    {
        $playerId = (int) $this->getCurrentPlayerId();
        $players = $this->loadPlayersBasicInfos();
        if (!isset($players[$playerId])) {
            throw new \feException(clienttranslate('Spectators are not authorized to speak'), true);
        }

        if (!$this->ensure_enough_time_since_last_action('tablechat', $playerId, 2)) {
            throw new \feException(
                clienttranslate('There is a minimum of ${seconds} seconds between messages'),
                true,
                args: ['seconds' => 2],
            );
        }

        // Publish outside move notifications: this message must not advance the move counter or enter replay history.
        $this->notifyNow(
            '/table/t' . $this->table_id,
            'wouldlikethink',
            clienttranslate('${player_name} would like to think a little bit before playing this move.'),
            [
                'player_name' => $players[$playerId]['player_name'],
                'player_id' => $playerId,
            ],
        );
    }

    /**
     * This function do the exact same as "say()", but without sending any notification
     * The goal is to be able to moderate this message using the usual tool.
     * This function should be used by all games developers, as soon as there is some free text that the players can use in the game, which
     * is visible by all players.
     *
     * 📖 documented function.
     * 
     * @param int $player_id the player id
     * @param string $message the message to log
     */
    public function logTextForModeration(/*int*/ $player_id, /*string*/ $message)
    {
        if ($message == '') {
            return;
        }

        if (strlen($message) > 300) {
            $message = substr($message, 0, 300) . '...';
        }

        $players = self::loadPlayersBasicInfos();
        if (!isset($players[$player_id])) {
            throw new \feException('logText for moderation: this player is not at this table');
        }

        self::masterNodeRequest('logTextForModeration', [
            'player' => $player_id,
            'table_id' => $this->table_id,
            'game_id' => $this->gameid,
            'message' => $message,
        ]);
    }

    /**
     * Allow games to control sent messages through the chat. Used by "werewolves" only.
     */
    protected function adaptMessage($message, $player_id)
    {
        // To be overriden by games
        return $message;
    }

    /**
     * Return a number between 0 and 100 describing the game progression.
     *
     * 📖 documented function.
     * 
     * @return int the progression between 0 and 100
     */
    public function getGameProgression()
    {
        // To be override by games
        return 0;
    }

    /**
     * Return the authoritative current reflexion-time snapshot for active players.
     *
     * After a reconnect, the client may have missed elapsed thinking time for players who are
     * currently active. We therefore return a server-side snapshot for active players only.
     *
     * @return array{
     *     players:list<array{player_id:string, remaining_time:string}>
     * }
     */
    public function getCurrentReflexionTimes(): array
    {
        $reflexionSnapshot = $this->gamestate->getCurrentReflexionTimeSnapshot();
        $players = [];

        foreach ($this->gamestate->getActivePlayerList() as $playerId) {
            if (!array_key_exists($playerId, $reflexionSnapshot['total'])) {
                continue;
            }

            $players[] = [
                'player_id' => (string) $playerId,
                'remaining_time' => (string) $reflexionSnapshot['total'][$playerId],
            ];
        }

        return [
            'players' => $players,
        ];
    }

    ////////////////////////////////////////
    //// Statistics methods

    /**
     * Get the "stat_type" object for the current game.
     */
    public function getStatTypes(): array
    {
        global $bgaContainer;
        $tableStatsManager = $bgaContainer->get(\Bga\Tables\TableStatsManager::class);
        return $tableStatsManager->get($this->getGameName());
    }

    // Convert a type id in its label
    private function stat_type_id_to_name(string $table_or_player, $type_id)
    {
        $stat_types = self::getStatTypes();
        if ($table_or_player != 'table' && $table_or_player != 'player') {
            throw new \feException('Wrong statistic type');
        }

        foreach ($stat_types[$table_or_player] as $label => $infos) {
            if ($infos['id'] == $type_id) {
                return $label;
            }
        }

        //throw new \feException( "Unknown statistic id:".$table_or_player." ".$type_id );
        //Flexibility in order not to break games if the stat has been removed; we just don't want to display it anymore, even if it exists in the database for this game.
        return null;
    }

   /**
     * Create a statistic entry with a default value.
     *
     * This method must be called for each statistic of your game, in your setupNewGame method. If you neglect to
     * call this for a statistic, and also do not update the value during the course of a certain game using
     * `setStat` or `incStat`, the value of the stat will be undefined rather than 0. This will result in it being
     * ignored at the end of the game, as if it didn't apply to that particular game, and excluded from cumulative
     * statistics. As a consequence - if do not want statistic to be applied, do not init it, or call set or inc
     * on it.
     *
     * 📖 documented function.
     * 
     * @deprecated use $this->tableStats->init or $this->playerStats->init
     *
     * @param string $table_or_player must be set to "table" if this is a table statistic, or "player" if this is a player statistic.
     * @param string $name the name of your statistic, as it has been defined in your stats.json file.
     * @param mixed $value the initial value of the statistic.
     * @param ?int $player_id to initiate a single player. By default, null means all players.
     */
    function initStat(/*string*/ $table_or_player, /*string*/ $name, $value, /*?int */$player_id = null)
    {
        $stat_types = self::getStatTypes();

        $sql = 'INSERT INTO stats (stats_type, stats_player_id, stats_value) VALUES ';

        if ($table_or_player == 'table') {
            if (!isset($stat_types['table'][$name])) {
                throw new \feException('Unknown statistic id: ' . $table_or_player . ' ' . $name);
            }

            $values[] =
                "('" .
                $stat_types['table'][$name]['id'] .
                "',NULL,'" .
                self::escapeStringForDB(doublecheck($value)) .
                "')";
        } elseif ($table_or_player == 'player') {
            // Players stats
            $players = self::loadPlayersBasicInfos();

            if (!isset($stat_types['player'][$name])) {
                throw new \feException('Unknown statistic id: ' . $table_or_player . ' ' . $name);
            }

            if ($player_id == null) {
                if (empty($players)) {
                    throw new \Bga\GameFramework\SystemException("Player statistic $name cannot be initialized before players are set up.");
                }
                foreach ($players as $id => $player) {
                    $values[] =
                        "('" .
                        $stat_types['player'][$name]['id'] .
                        "','$id','" .
                        self::escapeStringForDB(doublecheck($value)) .
                        "')";
                }
            } else {
                $values[] =
                    "('" .
                    $stat_types['player'][$name]['id'] .
                    "','$player_id','" .
                    self::escapeStringForDB(doublecheck($value)) .
                    "')";
            }
        } else {
            throw new \feException('Wrong table_or_player type');
        }

        $sql .= implode(',', $values ?? []);
        self::DbQuery($sql);
    }

    /**
     * Return the value of statistic specified by $name. Useful when creating derivative statistics such as average.
     *
     * 📖 documented function.
     * 
     * @deprecated use $this->tableStats->get or $this->playerStats->get
     * 
     * @param string $name the name of your statistic, as it has been defined in your stats.json file.
     * @param ?int $player_id the player to get the stat. If null, it will return the table stat.
     */
    function getStat(/*string*/ $name, /*?int*/ $player_id = null)
    {
        $stat_type = self::getStatTypes();
        $players = self::loadPlayersBasicInfos();

        if ($player_id == null) {
            if (!isset($stat_type['table'][$name])) {
                throw new \feException('(table) statistic does not exists: ' . $name);
            }
        } else {
            if (!isset($stat_type['player'][$name])) {
                throw new \feException('(player) statistic does not exists: ' . $name);
            }
            if (!isset($players[$player_id])) {
                throw new \feException('getStat: Unknown player id: ' . $player_id);
            }
        }

        if ($player_id == null) {
            $type_id = $stat_type['table'][$name]['id'];
            $sql = "SELECT stats_value FROM stats WHERE stats_type='$type_id' AND stats_player_id IS NULL ";
        } else {
            $type_id = $stat_type['player'][$name]['id'];
            $sql = "SELECT stats_value FROM stats WHERE stats_type='$type_id' AND stats_player_id='$player_id' ";
        }

        $dbres = self::DbQuery($sql);
        $row = mysql_fetch_assoc($dbres);
        if (!$row) {
            return 0;
        }

        return $row['stats_value'];
    }

    /**
     * Set a statistic `$name` to `$value`.
     *
     * 📖 documented function.
     * 
     * @deprecated use $this->tableStats->set or $this->playerStats->set
     * 
     * @param mixed $value the value of the statistic.
     * @param string $name the name of your statistic, as it has been defined in your stats.json file.
     * @param ?int $player_id the player to set the stat. If null, it will set the table stat.
     */
    function setStat(/*mixed*/ $value, /*string*/ $name, /*?int*/ $player_id = null, /*bool*/ $bDoNotLoop = false)/*: void*/
    {
        $stat_type = self::getStatTypes();
        $players = self::loadPlayersBasicInfos();

        if ($player_id == null) {
            if (!isset($stat_type['table'][$name])) {
                throw new \feException('(table) statistic does not exists: ' . $name);
            }
            $type_id = $stat_type['table'][$name]['id'];
            $sql =
                "UPDATE stats SET stats_value='" .
                doublecheck($value) .
                "' WHERE stats_type='$type_id' AND stats_player_id IS NULL ";
        } else {
            if (!isset($stat_type['player'][$name])) {
                throw new \feException('(player) statistic does not exists: ' . $name);
            }
            if (!isset($players[$player_id])) {
                throw new \feException('setStat: Unknown player id: ' . $player_id);
            }

            $type_id = $stat_type['player'][$name]['id'];
            $sql =
                "UPDATE stats SET stats_value='" .
                doublecheck($value) .
                "' WHERE stats_type='$type_id' AND stats_player_id='$player_id' ";
        }

        self::DbQuery($sql);

        if (self::DbAffectedRow() == 0) {
            if ($bDoNotLoop) {
                throw new \feException('setStat: failed to auto init statistics ' . $name);
            }

            // Init stat first
            if ($player_id == null) {
                if (
                    self::getUniqueValueFromDB(
                        "SELECT stats_value FROM stats WHERE stats_type='$type_id' AND stats_player_id IS NULL "
                    ) === null
                ) {
                    self::initStat('table', $name, $value);
                    return; // Job has been done
                } else {
                    return;
                } // This is just a setStat call that did not change the current value
            } else {
                if (
                    self::getUniqueValueFromDB(
                        "SELECT stats_value FROM stats WHERE stats_type='$type_id' AND stats_player_id='$player_id' "
                    ) === null
                ) {
                    self::initStat('player', $name, $value, $player_id);
                    return; // Job has been done
                } else {
                    return;
                } // This is just a setStat call that did not change the current value
            }
        }
    }

    /**
     * Increment (or decrement) specified statistic value by `$inc` value. Same behavior as `Table::setStat()`
     * function.
     *
     * 📖 documented function.
     * 
     * @deprecated use $this->tableStats->inc or $this->playerStats->inc
     * 
     * @param mixed $delta the value of the add to the current stat value.
     * @param string $name the name of your statistic, as it has been defined in your stats.json file.
     * @param ?int $player_id the player to inc the stat. If null, it will inc the table stat.
     */
    function incStat($delta, /*string*/ $name, /*?int*/ $player_id = null, /*bool*/ $bDoNotLoop = false)
    {
        if ($delta != 0) {
            $stat_type = self::getStatTypes();
            $players = self::loadPlayersBasicInfos();

            if ($player_id == null) {
                if (!isset($stat_type['table'][$name])) {
                    throw new \feException('Unknown table statistic: ' . $name);
                }

                $type_id = $stat_type['table'][$name]['id'];
                $sql =
                    "UPDATE stats SET stats_value=stats_value+'" .
                    doublecheck($delta) .
                    "' WHERE stats_type='$type_id' AND stats_player_id IS NULL ";
            } else {
                if (!isset($stat_type['player'][$name])) {
                    throw new \Bga\Exceptions\Framework\UnknownPlayerStatistic('Unknown player statistic: ' . $name);
                }
                if (!isset($players[$player_id])) {
                    throw new \Bga\Exceptions\Framework\UnknownPlayerStatistic('incStat: Unknown player id: ' . $player_id);
                }

                $type_id = $stat_type['player'][$name]['id'];
                $sql =
                    "UPDATE stats SET stats_value=stats_value+'" .
                    doublecheck($delta) .
                    "' WHERE stats_type='$type_id' AND stats_player_id='$player_id' ";
            }

            self::DbQuery($sql);

            if (self::DbAffectedRow() == 0) {
                if ($bDoNotLoop) {
                    throw new \feException('incStat: failed to auto init statistics ' . $name);
                }

                // Init stat first
                if ($player_id == null) {
                    self::initStat('table', $name, 0);
                } else {
                    self::initStat('player', $name, 0);
                }

                // ... then loop
                self::incStat($delta, $name, $player_id, true);
            }
        }
    }

    ////////////////////////////////////////
    //// End of game management

    public function updatePlayerScoresBasedOnGameResults(): void
    {
        $neutralized_progression = self::getGameStateValue('game_result_neutralized');
        $game_results_neutralized = $neutralized_progression != 0;
        $neutralized_player_id = self::getGameStateValue('neutralized_player_id');
        $keepRankingOnPlayerQuit = boolval($this->getGameStateValue('keep_ranking_on_quit'));

        // GAME RESULT HAVE BEEN NEUTRALIZED (set quitter score to 0 and everybody else's to 1)
        if ($keepRankingOnPlayerQuit) {
            // CHECK IF GAME ALLOWS RANKING TO NOT BE NEUTRALIZED IN CASE OF PLAYER QUIT   
            // in this case, set score to -1 for quitters (zombie = 1) to ensure they rank last and do not change other players score 
            self::DbQuery(
                "UPDATE player SET player_score = -1, player_score_aux = 0 WHERE player_zombie = 1"
            );
        } else if ($game_results_neutralized) {
            // Set generic scores (neutralized game)
            self::DbQuery(
                "UPDATE player SET player_score=1,player_score_aux=0 WHERE player_id!='$neutralized_player_id'"
            );
            self::DbQuery(
                "UPDATE player SET player_score=0,player_score_aux=0 WHERE player_id='$neutralized_player_id'"
            );
        }

        // CHECK IF THERE ARE CONCEDING PLAYERS
        // neutralize scores if that's the case
        if ($this->getUniqueValueFromDB("SELECT count(*) FROM player WHERE player_zombie = -1") > 0) {
            $this->DbQuery(
                "UPDATE player SET player_score = 0, player_score_aux = 0 WHERE player_zombie = -1"
            );
            $this->DbQuery(
                "UPDATE player SET player_score = 1, player_score_aux = 0 WHERE player_zombie = 0"
            );
        }
    }

    private function getTableStatsForGameResult(array $stats_types, array $statsDb): array {
        $tableStats = [];
        
        $playerScores = $this->getCollectionFromDb("SELECT `player_id` `id`, `player_score` `score` FROM `player`", true);

        $playerCount = count($playerScores);
        if ($playerCount > 0) {
            $scores = array_map(fn($playerScore) => (int)$playerScore, $playerScores);
            $totalScore = array_sum($scores);
            $bestScore = max($scores);
            $tableStats[$stats_types['table']['player_number']['id']] = $playerCount;
            $tableStats[$stats_types['table']['avg_points']['id']] = $totalScore / $playerCount;
            $tableStats[$stats_types['table']['best_score']['id']] = $bestScore;
        }

        foreach ($statsDb as $statDb) {
            if ($statDb['stats_player_id'] == null) {
                // stat is of table
                $type_id = $this->stat_type_id_to_name('table', $statDb['stats_type']);
                if ($type_id !== null) {
                    $stat_id = $stats_types['table'][$type_id]['id'];
                    $tableStats[$stat_id] = $statDb['stats_value'];
                }
            }
        }

        return $tableStats;
    }

    private function getPlayersStatsForGameResult(array $stats_types, array $statsDb): array {
        $players = [];

        foreach ($statsDb as $statDb) {
            if ($statDb['stats_player_id'] != null) {
                $playerId = (int)$statDb['stats_player_id'];
                if (!isset($players[$playerId])) {
                    $players[$playerId] = [];
                }
                // stat is of player
                $type_id = $this->stat_type_id_to_name('player', $statDb['stats_type']);
                if ($type_id !== null) {
                    $stat_id = $stats_types['player'][$type_id]['id'];
                    $players[$playerId][$stat_id] = $statDb['stats_value'];
                }
            }
        }

        return $players;
    }

    private function setDefaultGameResultToIndividualRanking(): void {
        $this->gameResult = null;
    }

    public function bgaSetGameResult(mixed $gameResult) {
        $this->gameResult = $gameResult;
    }

    private function completeGameResult() {}

    private function checkGameResultValidity() {}

    /**
     * Notify all players about concede.
     */
    function notifyConcede(/*int*/ $player_id, /*bool */$concede_all = false)
    {
        $players = self::loadPlayersBasicInfos();

        if ($concede_all) {
            self::notifyAllPlayers(
                'allPlayersConcedeGame',
                clienttranslate('All players have decided to concede this game.'),
                []
            );
            return;
        }

        self::notifyAllPlayers('playerConcedeGame', clienttranslate('${player_name} concedes this game.'), [
            'player_name' => $players[$player_id]['player_name'],
            'player_id' => $player_id,
        ]);
    }

    /**
     * Arg Function called at the end of each game at gameEnd state (mandatory).
     * it returns datas suitable for a display on the score dialog.
     */
    final function argGameEnd(): array
    {
        return [];
    }

    /**
     * St Function called at the end of each game at gameEnd state (mandatory).
     * It records the result of the game in website loging tables.
     */
    final function stGameEnd(): void
    {
        if ($this->bGameAbandonForced == true && self::getGameStateValue('game_result_neutralized') == 0) {
            return;
        }

        $this->setReflexionTimeStandardDeviation();
        $this->notify->all('simpleNode', clienttranslate('End of game'), []);
        $this->bGameResultSendToMS = true;
    }

    /**
     * Returns true if there is 1 real player (AI players are ignored).
     */
    public function isSoloGame()/*: bool*/
    {
        // Is this a solo game (= all opponents are AI?)

        $players = $this->bgaInternalLoadPlayersBasicInfos();

        $nb_real_player = 0;
        foreach ($players as $player) {
            if ($player['player_ai'] == 1) {
                // This is an AI
            } else {
                $nb_real_player++;
            }
        }

        return $nb_real_player == 1;
    }

    ////////////////////////////////////////
    //// Notification system

    /**
     * Send a notification to all players of the game and spectators (public).
     * 
     * 📖 documented function.
     * 
     * @deprecated use $this->notify->all
     */
    function notifyAllPlayers(/*string*/ $notification_type, /*string*/ $notification_log = '', /*array*/ $notification_args = [])/*: void*/
    {
        self::notifyPlayer('all', $notification_type, $notification_log, $notification_args);
    }

    /**
     * Send a notification to a single player of the game.
     * 
     * 📖 documented function.
     * 
     * @deprecated use $this->notify->player
     */
    function notifyPlayer(/*int|string*/ $player_id, /*string*/ $notification_type, /*string*/ $notification_log = '', /*array*/ $notification_args = [])/*: void*/
    {
        if ($notification_log === null) {
            throw new \feException(
                "Can't notify with null notification log message - please use an empty string instead"
            );
        }


        // we deep clone the notification_args, so if an object in it is changed after the call to notifyAllPlayers, the notification args are not changed
        // JSON_PARTIAL_OUTPUT_ON_ERROR makes a valid json even if there are circular references, they will just be replaced by null. That's already what centrifuge->publish is doing anyway
        $clonedNotificationArgs = (array)json_decode(json_encode($notification_args, JSON_PARTIAL_OUTPUT_ON_ERROR));

        $notification = [
            'uid' => uniqid(),
            'type' => $notification_type,
            'log' => $notification_log,
            'args' => $clonedNotificationArgs,
        ];

        $players = $this->bgaInternalLoadPlayersBasicInfos();

        if ($player_id != 'all') {
            // Synchronization between player channel and main channel
            $mainchannel_synchro_id = 0;
            if (isset($this->target_to_notification_packet['all'])) {
                if (isset($this->notifications[$this->target_to_notification_packet['all']])) {
                    $mainchannel_synchro_id = count($this->notifications[$this->target_to_notification_packet['all']]);
                }
            }
            $notification['synchro'] = $mainchannel_synchro_id;
            if ($players[$player_id]['player_ai']) {
                $this->notifyEventsToBots($player_id, $notification_type, $notification_log, $notification_args);
            }
        } else {
            foreach ($players as $notifiedPlayerId => $playerInfo) {
                if (!$playerInfo['player_ai']) {
                    continue;
                }

                $this->notifyEventsToBots(
                    (int) $notifiedPlayerId,
                    $notification_type,
                    $notification_log,
                    $notification_args,
                );
            }
        }

        $packet_id = null;
        if (!isset($this->target_to_notification_packet[$player_id])) {
            // There is no current notifications packet for this target => create it
            $packet_id = $this->next_notification_packet_id;
            $this->next_notification_packet_id++;

            $this->notifications[$packet_id] = [];
            $this->target_to_notification_packet[$player_id] = $packet_id;
            $this->notification_packet_to_target[$packet_id] = $player_id;
        } else {
            $packet_id = $this->target_to_notification_packet[$player_id];
        }

        //    self::dump( "Publishing notification", $notification );

        $this->notifications[$packet_id][] = $notification;

        if (
            !$this->inPlayerAction &&
            ($this->gamestate === null || $this->gamestate->getTransitionDepth() === 0) &&
            in_array($notification_type, ['autopass', 'confirmTichu'], true)
        ) {
            $this->sendNotifications();
        }
    }

    /**
     * To be overriden (called just before "sendNotifications" request
     * TODO check if the games using it could do the same thing without this function.
     */
    function onEndAjaxAction()
    {
    }

    /**
     * Check that at the end of our game action we are in a safe state:
     * _ active player is not a zombie
     * _ current state is an active one (not a "game" one)
     * _ ... and in case we are in async mode, signal active players to metasite
     */
    public function checkReturnState()
    {
        if (!$this->bGameAbandonForced) {
            $state = $this->gamestate->state(true, false, true);
            $state_id = $this->gamestate->state_id();

            $active_player_list = $this->gamestate->getActivePlayerList();
            $players = self::loadPlayersBasicInfos();

            if (in_array($state['type'], [StateType::ACTIVE_PLAYER->value, StateType::MULTIPLE_ACTIVE_PLAYER->value])) {
                // Check active player is not a zombie
                foreach ($active_player_list as $active_player) {
                    if (isset($players[$active_player]) && $players[$active_player]['player_zombie'] == 1) {
                        throw new \Bga\Exceptions\Framework\ZombieStateException("Can't manage zombie player in this game state (" . $state_id . ')');
                    }
                }
            } elseif ($state['type'] === StateType::GAME->value) {
                throw new \feException('Unexpected final game state (' . $state_id . ')');
            }
        }
    }

    /**
     * At the end of the player action, we call the MS to notify the eliminated players.
     * For internal use only, dev should not know/use it.
     */
    final public function asyncEliminatePlayers() {
        if (empty($this->playersToEliminateAtTheEndOfTurn)) {
            return;
        }

        $eliminatedPlayerIds = array_map(fn($playersToEliminate) => $playersToEliminate[0], $this->playersToEliminateAtTheEndOfTurn);
        $activePlayerWhenActionEnd = array_map(fn($activePlayerId) => (int)$activePlayerId, $this->gamestate->getActivePlayerList());
        if (array_any($eliminatedPlayerIds, fn($eliminatedPlayerId) => in_array($eliminatedPlayerId, $activePlayerWhenActionEnd))) {
            throw new \feException("Can't eliminate an active player");
        }

        foreach ($this->playersToEliminateAtTheEndOfTurn as $playerToEliminate) {
            $this->masterNodeRequest('eliminatePlayer', [
                'table_id' => $this->table_id,
                'player_id' => $playerToEliminate[0],
                'current' => $playerToEliminate[1],
            ]);
        }
        $this->playersToEliminateAtTheEndOfTurn = [];

        // If all players are eliminated, make sure we are at the end of the game at the end of the action
        if ($this->gamestate->getCurrentMainStateId() !== 99 && intval($this->getUniqueValueFromDB("SELECT COUNT(*) FROM `player` WHERE `player_eliminated` = 0")) === 0) {
            $this->gamestate->jumpToState(99);
        }
    }

    /**
     * Send notifications to player. This method is called at the end of each AJAX action, but can
     * be called more often if long operations are beeing performed.
     */
    public function sendNotifications()
    {
        if (count($this->notifications) > 0) {
            self::trace('Sending notifications');

            global $g_config;

            $players = self::loadPlayersBasicInfos();

            // If there are some notifications to send to main channel, all private channels must be synchronized with this one.
            if (
                isset($this->target_to_notification_packet['all']) &&
                !$this->chatmessage_notification &&
                !$this->not_a_move_notification
            ) {
                // Note: to avoid conflicts between processes when updating next notification no, we must
                //  increment the "counter" first and read it after to ensure it is impossible that 2 transactions
                //  update it at the same time

                $next_move_index = $this->gamestate_labels[GAME_GLOBAL_NEXT_MOVE_ID];

                $increment = 1;
                if ($this->notifications_undo) {
                    $increment = -1;
                }

                $subsql = "UPDATE global SET global_value=global_value+$increment WHERE global_id='$next_move_index' ";
                self::DbQuery($subsql);

                $subsql = "SELECT global_value FROM global WHERE global_id='$next_move_index' ";
                $dbres = self::DbQuery($subsql);
                $row = mysql_fetch_assoc($dbres);
                if (!$row) {
                    throw new \feException('FATAL: did not retrieve current move_id counter');
                }

                $move_id = $row['global_value'] - 1;
            } else {
                $move_id = null;
            }

            // At first, send player channel notifications
            foreach ($this->notifications as $packet_id => $notifications) {
                $player_id = $this->notification_packet_to_target[$packet_id];

                if ($player_id != 'all') {
                    // Specific player notification
                    $this->sendNotificationPacket($player_id, $move_id, $notifications);
                }
            }

            // Then, send table notifications
            foreach ($this->notifications as $packet_id => $notifications) {
                $player_id = $this->notification_packet_to_target[$packet_id];

                if ($player_id == 'all') {
                    // Broadcast to all players
                    $this->sendNotificationPacket($player_id, $move_id, $notifications);
                }
            }

            // Empty notifications
            $this->notifications = [];
            $this->target_to_notification_packet = [];
            $this->notification_packet_to_target = [];
            $this->chatmessage_notification = false;
            $this->not_a_move_notification = false;

            if ($this->undoSaveOnMoveEnd) {
                $this->doUndoSavePoint();
            }
        }
    }

    /**
     * Ensure a locked final AJAX action has a packet that can release its interface lock.
     *
     * This must be called only after the action has completed, because sendNotifications()
     * is also used to flush intermediate notification batches during long operations.
     */
    public function ensureLockNotification(): void
    {
        if ($this->lock_uuid === null || count($this->notifications) > 0) {
            return;
        }

        // The lock type is not sent to the game server, so we send a dummy notification to unlock the interface
        $this->notifyAllPlayers('dummy');
    }

    /**
     * Send the specified notifications bunch to the specified player (or to ALL players if player_id=all)
     */
    private function sendNotificationPacket($player_id, $move_id, $notifications)
    {
        $players = self::loadPlayersBasicInfos();

        if ($player_id == 'all') {
            $channel = '/table/t' . $this->table_id;
        } else {
            $channel = '/player/p' . $player_id;
        }

        global $g_user;
        $current_player_id = 0;

        if ($g_user->is_logged()) {
            $current_player_id = $g_user->get_id();
        }

        // Keep the move author in live notifications and in stored notifications for resends.
        if ($move_id !== null) {
            foreach ($notifications as $notificationId => $notification) {
                $notifications[$notificationId]['movePlayerIdForFireDlg'] = (int) $current_player_id;
            }
        }

        $is_private = $this->chatmessage_notification ? 1 : 0; // Note: private notifications can't be accessed with replay

        reset($notifications);
        $first = key($notifications);
        end($notifications);
        $last = key($notifications);

        if ($this->lock_uuid) {
            // Interface lock: adding it in the last notification
            $notifications[$last]['lock_uuid'] = $this->lock_uuid;
        }

        if (isset($players[$current_player_id]) && $move_id !== null) {
            // Add hash about the query sent (play moves in replay feature)
            $notifications[$first]['h'] = self::getPlayerQueryHash($current_player_id, $move_id);
        }

        // Insert into gamelog and get the corresponding packet id

        if ($notifications[$last]['type'] == 'resetInterfaceWithAllDatas') {
            // Do not log anything in gamelog for UNDO
            $notif_string = self::escapeStringForDB(json_encode([]));
        } else {
            $notif_string = self::escapeStringForDB(json_encode($notifications));
        }

        // DEPRECATED : no need to remove invisible character since we are now using utf8mb4 for gamenotif table
        //      $notif_string = preg_replace('/[\x00-\x1F\x80-\xFF]/', '', $notif_string);

        if (!$this->bga->debug->isExecutingDebugAction() && strlen($notif_string) >= 131072) {
            // Limit notification string to 128k
            throw new \feException(
                'Error: generated notifications are larger than 128k (' . strlen($notif_string) . ')'
            );
        }

        if ($current_player_id < 0) {
            // We should not register a move for a visitor
            throw new \feException('Error: registering a move for a visitor should not happen');
        }

        if (!$this->notifications_undo) {
            if (!$this->bga->notify->doNotWriteNextNotificationsToDatabase) {
                $sql =
                    "INSERT INTO gamelog (gamelog_move_id, gamelog_private, gamelog_time, gamelog_player, gamelog_current_player, gamelog_notification)
                            VALUES
                            ( " .
                    ($move_id === null ? 'NULL' : "'$move_id'") .
                    ", '$is_private', NOW(), " .
                    ($player_id == 'all' ? 'NULL' : "'$player_id'") .
                    ",'$current_player_id', '$notif_string')";
                self::DbQuery($sql);
            }
        } else {
            // We are UNDOING a move => remove all we placed in the gamelog before corresponding to the previous move
            $sql =
                "UPDATE gamelog SET gamelog_notification='" .
                self::escapeStringForDB(serialize([])) .
                "' WHERE gamelog_move_id='" .
                ($move_id + 1) .
                "'";
            self::DbQuery($sql);

            // Insert a dummy packet in gamelog just to make sure we increase the notifpacket counter
            $sql =
                "INSERT INTO gamelog (gamelog_move_id, gamelog_private, gamelog_time, gamelog_player, gamelog_current_player, gamelog_notification)
                        VALUES
                        ( NULL, '0', NOW(), " .
                ($player_id == 'all' ? 'NULL' : "'$player_id'") .
                ",'$current_player_id', '" .
                self::escapeStringForDB(serialize([])) .
                "')";
            self::DbQuery($sql);
        }

        $notif_packet_id = self::DbGetLastId();

        $prevpacket = self::getCollectionFromDB(
            "SELECT COALESCE( gamelog_player, 0 ), MAX( gamelog_packet_id )
                                                                   FROM gamelog
                                                                   WHERE gamelog_packet_id<$notif_packet_id
                                                                   GROUP BY gamelog_player",
            true
        );

        // Push notification data to client using centrifuge
        global $bgaContainer;
        $notify = $bgaContainer->get(\Bga\Services\Notify::class);
        $notify->publish(
            $channel,
            $notifications,
            'sequence',
            intval($notif_packet_id),
            intval($this->chatmessage_notification),
            false,
            $move_id,
            $prevpacket,
            $this->table_id,
            $this->gamename
        );
    }

    /**
     * Return table next notification no and player next notification no:
     */
    private function getCurrentNotificationNextNo(int $player_id = -1)
    {
        return self::getObjectFromDB("SELECT COALESCE( MAX( gamelog_packet_id ), 0 ) last_packet_id,
                                       COALESCE( MAX( gamelog_move_id ), 0 ) move_nbr
                                       FROM gamelog
                                       WHERE gamelog_player IS NULL OR gamelog_player='$player_id'");
    }

    /**
     * Generates a hash for a playerId and a moveId.
     */
    private function getPlayerQueryHash($player_id, $move_id)
    {
        $query = $_GET + $_POST;

        // Remove unnecessary things
        unset($query['module']);
        unset($query['class']);
        unset($query['dojo_preventCache']);
        unset($query['testuser']);
        unset($query['lock']);
        unset($query['noerrortracking']);
        unset($query['movePlayerIdForFireDlg']);

        // Note : we keep table_id, so you cannot use the hash to determine what move has been played from one table to another

        // Note : we add move_id, so you cannot use the hash to determine what move has been played from one move to another
        $query['__move_id__'] = $move_id;

        // Note : we add player_id, because we have to remember which player we are
        $query['__player_id__'] = $player_id;

        ksort($query);

        $json = json_encode($query, JSON_NUMERIC_CHECK);
        $hash = md5($json);

        return substr($hash, 0, 6);
    }

    ///////////// Logs history

    /**
     *  Get notifications from game history
     */
    public function getNotificationHistory($from_notif, $to_notif, $private_included, $archive, $bHistoryIncluded) /*: array*/
    {
        global $bgaContainer;
        global $g_user;
        $player_id = null;
        if ($g_user->is_logged()) {
            $player_id = $g_user->get_id();
        }

        if ($archive != '') {
            if (!hash_equals($bgaContainer->get(\Bga\Config\SecretConfig::class)->getJobAuthenticationPassword(), $archive)) {
                throw new \feException('Cannot access notification archives: wrong credentials');
            }
        }

        $players = self::loadPlayersBasicInfos();
        $bSpectator = false;
        if (!isset($players[$player_id])) {
            $bSpectator = true;
        }

        $retrieve_notif_from = $from_notif;
        if ($bHistoryIncluded) {
            $retrieve_notif_from -= 200;
        } //// Retrieve 200 more packets just to fill notification history => we only load 200 last because otherwise games with a lot of notif may be really slow (see below)
        //            $retrieve_notif_from = 0;     //// Retrieve ALL packets from the beginning =====> was causing games load to be really slow https://boardgamearena.com/bug?id=24727

        $sql =
            'SELECT gamelog_packet_id, gamelog_move_id, gamelog_player, gamelog_notification, UNIX_TIMESTAMP( gamelog_time ) time ';
        $sql .= 'FROM gamelog ';
        $sql .= "WHERE gamelog_packet_id >= $retrieve_notif_from ";

        if ($to_notif !== null && $to_notif >= $from_notif) {
            $sql .= "AND gamelog_packet_id <= $to_notif ";
        }

        if ($bSpectator || !$private_included) {
            $sql .= " AND gamelog_private='0' ";
        } // Spectators (including game reviewer) are not allowed to see private notifications

        if (!$archive) {
            $sql .= "AND ( gamelog_player IS NULL OR gamelog_player='$player_id')";
        }

        $sql .= ' ORDER BY gamelog_packet_id ASC ';

        $dbres = self::DbQuery($sql);
        $result = [];

        while ($row = mysql_fetch_assoc($dbres)) {
            $notif_data = unserialize_game_notifs($row['gamelog_notification']);

            $packet_history_type = $row['gamelog_packet_id'] >= $from_notif ? 'resend' : 'history';

            if ($packet_history_type == 'history') {
                // This will only be used to display logs => we can remove all notifications with no logs

                $simplified_notif_data = [];

                foreach ($notif_data as $single_notif) {
                    if (isset($single_notif['log']) && $single_notif['log'] != '') {
                        // Simplify args : do not take args that are not used in "log"
                        // (except 'i18n' that is needed for correct internationalization)
                        // (except: player_id for chatlog that is used on client side)
                        if (isset($single_notif['args'])) {
                            $simplified_args = [];
                            foreach ($single_notif['args'] as $arg_id => $arg_content) {
                                $listOfArgsToPreserve = ['i18n', 'separator', 'player_id', '_notified_privately'];

                                if (
                                    array_key_exists('preserve', $single_notif['args']) &&
                                    is_array($single_notif['args']['preserve'])
                                ) {
                                    $listOfArgsToPreserve = array_merge(
                                        $listOfArgsToPreserve,
                                        $single_notif['args']['preserve']
                                    );
                                }

                                $shouldBePreserved = array_search($arg_id, $listOfArgsToPreserve) !== false;

                                if (strpos($single_notif['log'], $arg_id) !== false || $shouldBePreserved) {
                                    $simplified_args[$arg_id] = $arg_content;
                                }
                            }
                            $single_notif['args'] = $simplified_args;
                        }

                        $simplified_notif_data[] = $single_notif;
                    }
                }

                $notif_data = $simplified_notif_data;
            }

            //            if (count($notif_data) > 0) {
                $result[] = [
                    'channel' =>
                        $row['gamelog_player'] == null
                            ? '/table/t' . $this->table_id
                            : '/player/p' . $row['gamelog_player'],
                    'table_id' => $this->table_id,
                    'packet_id' => $row['gamelog_packet_id'],
                    'packet_type' => $packet_history_type,
                    'move_id' => $row['gamelog_move_id'],
                    'time' => $row['time'],
                    'data' => $notif_data,
                ];
                //            }
        }

        return $result;
    }

    /**
     * DEBUG function: make players in timeout sand skip their turn.
     * TODO move them in debug_ system.
     */
    function timeout()
    {
        $sql = 'UPDATE player SET player_remaining_reflexion_time=-1 WHERE player_start_reflexion_time IS NOT NULL ';
        self::DbQuery($sql);
        self::CommitAllAndRestart();
        $this->skipPlayersOutOfTime(false, true);
    }

    /**
     * DEBUG function: make players in timeout so its turn can be skipped.
     * TODO move them in debug_ system.
     */
    function timeover()
    {
        $sql = 'UPDATE player SET player_remaining_reflexion_time=-1 WHERE player_start_reflexion_time IS NOT NULL ';
        self::DbQuery($sql);
        self::CommitAllAndRestart();
    }

    ////////////// Player elimination

    /**
     * In some games, this is useful to eliminate a player from the game in order he/she can start another game
     * without waiting for the current game end.
     *
     * @see https://doc.studio.boardgamearena.com/framework-documentation/back-end/main-game-logic/player-score/#players-leaving-elimination-and-concessions
     * 
     * 📖 documented function.
     * 
     * @param int $player_id the player to eliminate
     * @return void
     */
    public function eliminatePlayer(/*int*/ $player_id)
    {
        // Check if player is playing at this table and is not active

        $player = $this->getObjectFromDB(
            "SELECT `player_name`, `player_start_reflexion_time`, `player_eliminated`, `player_zombie` FROM `player` WHERE `player_id` = $player_id"
        );

        if ($player == null) {
            throw new \feException('Try to eliminate a player that is not playing at this table');
        }

        if ($player['player_eliminated'] == 1) {
            // Already been eliminated => nothing to do
            return;
        }

        if ($player['player_zombie'] == 1) {
            // If the player is a zombie, they have already been put out of the game on the mainsite
        } else {
            // Signal mainsite that this player has been eliminated
            $this->playersToEliminateAtTheEndOfTurn[] = [(int)$player_id, $this->getCurrentPlayerId(true)];
        }

        // Okay, we can eliminate this player on the gs side
        $this->DbQuery("UPDATE `player` SET `player_eliminated` = 1 WHERE `player_id` = $player_id");
        $this->notifyAllPlayers(
            'playerEliminated',
            clienttranslate('${player_name} has been eliminated from the game'),
            [
                'player_name' => $player['player_name'],
                'who_quits' => $player_id,
            ]
        );

        // Reset players basic infos in order in can be updated
        $this->reloadPlayersBasicInfos();
    }

    /**
     * Returns an index of the selected language as defined in gameinfos file.
     * 
     * 📖 documented function.
     */
    public function getGameLanguage()
    {
        return self::getGameStateValue('game_language');
    }

    /**
     * Returns true if game is turn based, false if it is realtime
     * 
     * 📖 documented function.
     * 
     * @deprecated use $this->tableOptions->isTurnBased()
     */
    function isAsync()/* bool*/
    {
        return $this->tableOptions->isTurnBased();
    }

    /**
     * Returns true if game is realtime, false if it is async.
     * 
     * 📖 documented function.
     * 
     * @deprecated use $this->tableOptions->isRealTime()
     */
    function isRealtime()/*: bool*/
    {
        return !self::isAsync();
    }

    /**
     * Notify the newly active players.
     */
    function checkActivePlayersChange($bOnTableCreation = false)
    {
        if ($this->bDoNotTriggercheckActivePlayersChange) {
            return;
        }

        // the change of active player will be sent in the gameStateChange, so we must have one gameStateChange notification sent to change the active player from an active state
        if ($this->gamestate->hasActivePlayerChanged() && !$this->isGameStateChangedAtTheEndOfTurn) {
            throw new \feException(
                'Impossible to change active player during ' . StateType::ACTIVE_PLAYER->value . ' type state, except if you do a state transition',
            );
        }

        $activePlayerWhenActionEnd = $this->gamestate->getActivePlayerList();

        $new_active_players = array_diff($activePlayerWhenActionEnd, $this->activePlayersWhenActionStarted);
        $new_inactive_players = array_diff($this->activePlayersWhenActionStarted, $activePlayerWhenActionEnd);

        if (count($new_active_players) != 0 || count($new_inactive_players) != 0) {
            if (self::isAsync()) {
                // Must send an asyncTableMove !
                $this->gamestate->sendAsyncTableMove([
                    'new_active' => $new_active_players,
                    'new_inactive' => $new_inactive_players,
                    'new_table' => $bOnTableCreation,
                ]);
            } else {
                global $g_config;
                if (
                    (isset($g_config['webpush_enabled']) && $g_config['webpush_enabled']) ||
                    (isset($g_config['androidpush_enabled']) && $g_config['androidpush_enabled'])
                ) {
                    // Web push notification to new active players that it's their turn to play
                    $o_webpush = new ebgWebPush();
                    $o_androidpush = new FirebaseNotificationChannel();

                    // Get gameserver number
                    $fragmented_domain = explode('.', $g_config['app_domain']);
                    $gameserver = array_shift($fragmented_domain);

                    // Get current locale to restore it later
                    $locale_to_restore = Locale::GetLocalization();

                    // Get players infos
                    $players_infos = apcu_fetch('players_infos_table_' . $this->table_id); // Can come from createGame or from a previous call to getGenericGameinfos // APCUREF:keep, only on game server

                    if ($players_infos === false) {
                        $players = $this->loadPlayersBasicInfos();

                        $gamePageInfos = self::masterNodeRequest('getGenericGameinfos', [
                            'table_id' => $this->table_id,
                            'player_ids' => array_keys($players),
                            'playersInfosOnly' => true,
                        ]);

                        // Cache players infos
                        apcu_store('players_infos_table_' . $this->table_id, $gamePageInfos['players'], 24 * 3600); // APCUREF:keep, only on game server

                        $players_infos = $gamePageInfos['players'];
                    }

                    if (count($players_infos) > 1) {
                        // No notifications for solo games: the player knows!
                        foreach ($new_active_players as $table_player_id) {
                            if (!isset($players_infos[$table_player_id])) {
                                self::trace(
                                    "Players infos missing for player $table_player_id, could not decide if we should send web push notification or not."
                                );
                                continue;
                            }

                            // Set proper locale for the player to be notified into the proper language
                            if (isset($players_infos[$table_player_id]['language'])) {
                                Locale::SetLocalizationFromShortCode($players_infos[$table_player_id]['language']);
                            }

                            $url = self::getMasterNodeUrl() . '/tableview?table=' . $this->table_id;

                            // Opponents
                            $against = '';
                            $first_opponent = '';
                            foreach ($players_infos as $player_info_id => $player_info) {
                                if ($player_info_id == $table_player_id) {
                                    continue;
                                }

                                if ($first_opponent == '') {
                                    $first_opponent = $player_info['player_name'];
                                } else {
                                    $second_opponent = $player_info['player_name'];
                                    break;
                                }
                            }
                            if (count($players_infos) == 2) {
                                $against =
                                    ' ' . str_replace('${opponent}', $first_opponent, _('(against ${opponent})'));
                            }
                            if (count($players_infos) == 3) {
                                $against =
                                    ' ' .
                                    str_replace(
                                        ['${first_opponent}', '${second_opponent}'],
                                        [$first_opponent, $second_opponent],
                                        _('(against ${first_opponent} and ${second_opponent})')
                                    );
                            }
                            if (count($players_infos) > 3) {
                                $against =
                                    ' ' .
                                    str_replace(
                                        ['${first_opponent}', '${number}'],
                                        [$first_opponent, count($players_infos) - 2],
                                        _('(against ${first_opponent} and ${number} other players)')
                                    );
                            }

                            // Notify
                            if (
                                isset($g_config['webpush_enabled']) &&
                                $g_config['webpush_enabled'] &&
                                isset($players_infos[$table_player_id]['browserSubscriptions']) &&
                                count($players_infos[$table_player_id]['browserSubscriptions']) > 0 &&
                                $players_infos[$table_player_id]['yourTurnRTNotifications'] == 1
                            ) {
                                $notifContent = [
                                    'title' => _("It's your turn to play!"),
                                    'options' => [
                                        'body' =>
                                            "\n" .
                                            str_replace(
                                                ['${table_id}', '${game_name}'],
                                                [$this->table_id . $against, _($this->gamename . '_displayed')],
                                                _('You are expected at "${game_name}" real-time table #${table_id}.')
                                            ) .
                                            "\n\n",
                                        'tag' => 'bgaYourTurnNotification',
                                        'requireInteraction' =>
                                            isset($players_infos[$table_player_id]['stickyNotifications']) &&
                                            $players_infos[$table_player_id]['stickyNotifications'],
                                        'data' => [
                                            'url' => $url, // Will bring back the user to the appropriate tab or reopen it if needed
                                            'type' => 'notification-yourturn-realtime', // Analytics category
                                        ],
                                    ],
                                ];

                                //NB: this call makes a self::CommitAllAndRestart(); so that the cron webpush process can see the notifications to send
                                $o_webpush->pushNotificationToBrowsers(
                                    $players_infos[$table_player_id]['browserSubscriptions'],
                                    $notifContent
                                );
                            }

                            if (
                                isset($g_config['androidpush_enabled']) &&
                                $g_config['androidpush_enabled'] &&
                                isset($players_infos[$table_player_id]['androidSubscriptions']) &&
                                isset($players_infos[$table_player_id]['androidSubscriptions'][$this->gamename]) &&
                                count($players_infos[$table_player_id]['androidSubscriptions'][$this->gamename]) > 0 &&
                                isset($g_config['androidpush_authkey_' . $this->gamename])
                            ) {
                                $notifContent = [
                                    'notification' => [
                                        'title' => _("It's your turn to play!"),
                                        'body' =>
                                            "\n" .
                                            str_replace(
                                                ['${table_id}', '${game_name}'],
                                                [$this->table_id . $against, _($this->gamename . '_displayed')],
                                                _('You are expected at "${game_name}" real-time table #${table_id}.')
                                            ) .
                                            "\n\n",
                                        'tag' => 'bgaYourTurnNotification',
                                    ],
                                    'data' => [
                                        'url' => $url, // Will bring back the user to the appropriate tab or reopen it if needed
                                        'type' => 'notification-yourturn-realtime', // Analytics category
                                        'table' => $this->table_id,
                                    ],
                                ];

                                //NB: this call makes a self::CommitAllAndRestart(); so that the cron androidpush process can see the notifications to send
                                $o_androidpush->pushNotificationToDevices(
                                    $players_infos[$table_player_id]['androidSubscriptions'][$this->gamename],
                                    $notifContent
                                );
                            }
                        }
                    }

                    // Restore previous locale
                    Locale::SetLocalization($locale_to_restore);
                }
            }
        }

        if (count($new_active_players) != 0) {
            if (self::isAsync()) {
                // Note: used as a counter for turn based interactions
                self::incStat(1, 'interaction_nbr');
            }
        }
    }

    /**
     * Apply DB upgrades
     */
    private function upgradeTableDbInternal(int $from_version, int $game_version)
    {
        // add the table for globals, for game tables not already having it (tables created before 240710-1000)
        $this->applyDbUpgradeToAllDB("CREATE TABLE IF NOT EXISTS `DBPREFIX_bga_globals` (`name` varchar(50) NOT NULL, `value` json, PRIMARY KEY (`name`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        $this->upgradeTableDb($from_version);

        if ($from_version <= 2200000000 && $game_version >= 2200000000) {
            $sql = 'ALTER TABLE `DBPREFIX_global` MODIFY COLUMN `global_value` BIGINT(11) NOT NULL';
            $this->applyDbUpgradeToAllDB($sql);
        }
    }

    /**
     * Migrate database if you change it after release on production.
     * 
     * 📖 documented function.
     *
     * @param int $from_version the table game version before the update (without the dash)
     * @return void
     */
    public function upgradeTableDb(/*int*/ $from_version)
    {
        // To be override by games
    }

    ///////////////////////////////////////////////////////////////////////////////////////////:
    //// Replay from savepoint feature

    public function saveReplayPoint(/*int*/ $move_id)/*: void*/
    {
        $this->saveReplayPointAfterNotificationsSending = $move_id;
    }

    public function saveReplayPointUsingReplaySavePoint()/*: void*/
    {
        if (isset($this->saveReplayPointAfterNotificationsSending)) {
            $move_id = $this->saveReplayPointAfterNotificationsSending;

            $players = $this->loadPlayersBasicInfos();

            global $g_user;

            foreach ($players as $player_id => $player) {
                $g_user->setTemporaryMasquerade($player_id);
                $gamedatas = $this->getAllTableDatas();
                $g_user->temporary_masquerade = null; // Note: we should modify directly the variable here, because a call to setTemporaryMasquerade would kill the session

                $gamedatas_json = json_encode($gamedatas);

                $sql =
                    "REPLACE INTO replaysavepoint
                        (rsp_player_id,rsp_move_id,rsp_gamedatas)
                        VALUES
                        ('$player_id','$move_id','" .
                    $this->escapeStringForDB($gamedatas_json) .
                    "')";

                $this->DbQuery($sql);

                // Remove savepoint more than 31 moves old
                // (because they are not likely to be used and are taking a lot of space)
                $move_limit = $move_id - 30;
                $sql = "DELETE FROM replaysavepoint WHERE rsp_move_id <= $move_limit";
                $this->DbQuery($sql);
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////:
    //// Undo feature

    /**
     * ⚠️ this function use $db and not Table DB functions to bypass the `bga_` check.
     */
    private function undoAndReplayInit(): void
    {
        global $bgaContainer;

        $gameinfos = $this->getGameinfos();

        $prefixes = [];

        if (isset($gameinfos['db_undo_support'])) {
            $prefixes[] = 'zz_savepoint_';
        }

        if (count($prefixes) > 0) {
            /** @var \Bga\GameFramework\Old\Db */
            $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);

            // Copy all tables to their respective savepoints
            $tables = $db->getObjectList('SHOW TABLES', true);

            $queries = [];
            foreach ($tables as $table) {
                foreach ($prefixes as $prefix) {
                    if ($table != 'replaysavepoint' && $table != 'bga_user_preferences') {
                        // Do not copy these ones
                        $copy = $prefix . $table;
                        $queries[] = "CREATE TABLE `$copy` LIKE `$table`";
                    }
                }
            }
            $db->sendMultiQueries($queries);

            /*
            // removed: causing too much "SHOW COLUMNS" and taking too much time during table creation
            foreach ($tables as $table) {
                foreach ($prefixes as $prefix) {
                    // remove auto_increment from tables
                    $copy = $prefix . $table;
                    $this->removeAutoIncrementFromTable( $copy ); 
                }
            }
            */
        }
    }

    /**
     * Return the fields list of a table, in a comma separated string, to use in SQL requests.
     * 
     * ⚠️ this function use $db and not Table DB functions to bypass the `bga_` check.
     */
    public function getFieldsListOfTable(/*string*/ $table)/*: string*/
    {
        global $bgaContainer;

        $db_version = intval($this->getGameStateValue('game_db_version'));
        $key = $this->getGameName() . '_' . $db_version . '_' . $table;

        if ($result = apcu_fetch($key)) { // APCUREF:keep, only for game table.
            return $result;
        } else {
            $result = [];

            /** @var \Bga\GameFramework\Old\Db */
            $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
            $fields = $db->getObjectList("SHOW COLUMNS FROM `$table`");

            foreach ($fields as $field) {
                $result[] = $field['Field'];
            }

            $result = '`' . implode('`,`', $result) . '`';

            apcu_add($key, $result); // APCUREF:keep, only for game table.

            return $result;
        }
    }

    /**
     * Return true / false depending if the current game situation correspond to the savepoint (because a savepoint or an undo has just been done)
     * Only used by "takenoko", move this code to the game?
     */
    function undoIsCurrentlyOnSavepoint()/*: bool*/
    {
        $current_move_id = $this->getUniqueValueFromDB("SELECT `global_value` FROM `global` WHERE `global_id`='3'");

        if (count($this->notifications) > 0) {
            // Some notifications are waiting to be sent, so in reality we are at "move+1"
            $current_move_id++;
        }

        try {
            $saved_move_id = $this->getUniqueValueFromDB(
                "SELECT `global_value` FROM `zz_savepoint_global` WHERE `global_id`='3'"
            );
        } catch (\feException $e) {
            // May failed if the undo has not been configured yet
            // => in this case, ignore it and pretend that we are in UNDO point (this was no UNDO button is displayed on interface, as this is the most common usage of this method)
            return true;
        }

        if ($saved_move_id != $current_move_id) {
            return false;
        } else {
            return true;
        }
    }

    /**
     * Save the whole game situation inside an "Undo save point".
     * 
     * 📖 documented function.
     */
    public function undoSavepoint()
    {
        //        if( $this->isAsync() )
        $this->undoSaveOnMoveEnd = true;
    }

    /**
     * Apply the undo save point at the end of the action.
     * Should be private, but it is used in some games.
     * 
     * ⚠️ this function use $b and not Table DB functions to bypass the `bga_` check.
     */
    function doUndoSavePoint()
    {
        global $bgaContainer;
        if ($this->gamestate->isMultiactiveState()) {
            throw new \Bga\Exceptions\Framework\UndoFrameworkException(clienttranslate('UNDO cannot be used for multiple active players game states'));
        }

        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);

        // Note: it previously used mysqldump instead of zz tables, but it was too slow during restore

        // Copy all tables to their respective savepoints

        $tables = $db->getObjectList('SHOW TABLES', true);
        $prefix = 'zz_savepoint_';
        $other_prefix = 'zz_replay';
        $this->setGameStateValue('undo_moves_player', $this->getActivePlayerId());

        // Check that undo tables exists
        $bUndoConfigured = false;
        foreach ($tables as $table) {
            if ($table !== 'zz_savepoint_bga_globals' && str_starts_with($table, $prefix)) {
                $bUndoConfigured = true;
            }
        }

        if (!$bUndoConfigured) {
            // Undo has not been configured
            // (may be because we added undo AFTER the game has been released)
            // => ignore the doUndoSave saving
            return;
        }

        foreach ($tables as $table) {
            if (str_starts_with($table, $prefix)) {
                // Save point => do not copy
            } elseif (str_starts_with($table, $other_prefix)) {
            } elseif ($table == 'replaysavepoint' ||  $table == 'bga_user_preferences') {
            } else {
                // This table must be saved into its copy
                $copy = $prefix . $table;
                $db->query("DELETE FROM `$copy`");
                $fields = $this->getFieldsListOfTable($table);
                try {
                    $db->query("INSERT INTO `$copy` ($fields) SELECT $fields FROM `$table`");
                } catch (\Exception $ex) {
                    //after introducing private parallel states there was a problem with undo
                    $fields = str_replace(',`player_state`', '', $fields);
                    $db->query("INSERT INTO `$copy` ($fields) SELECT $fields FROM `$table`");
                }
            }
        }
    }

    /**
     * Restore the situation previously saved as an "Undo save point".
     * 
     * 📖 documented function.
     * 
     * ⚠️ this function use $db and not Table DB functions to bypass the `bga_` check.
     */
    public function undoRestorePoint()
    {
        global $bgaContainer;

        //   if( $this->isAsync() )
        $this->notifyAllPlayers('undoRestorePoint', clienttranslate('${player_name} takes back his move'), [
            'player_name' => $this->getActivePlayerName(),
        ]);

        //$undo_moves_stored = $this->getGameStateValue( 'undo_moves_stored' );

        // if( $undo_moves_stored == 0 )
        //   throw new \Bga\Exceptions\Framework\UndoFrameworkException( "No UNDO is stored at now" );

        $undo_moves_player = $this->getGameStateValue('undo_moves_player');
        if ($undo_moves_player != $this->getActivePlayerId()) {
            throw new \Bga\Exceptions\Framework\UndoFrameworkException(clienttranslate("The stored UNDO corresponds to another player's turn : you cannot restore it"));
        }

        if ($this->gamestate->isMultiactiveState()) {
            throw new \Bga\Exceptions\Framework\UndoFrameworkException(clienttranslate('UNDO cannot be used for multiple active players game states'));
        }

        //$this->incGameStateValue( 'undo_moves_stored', -1 ); // Unstack the move

        // Note: it previously used mysqldump instead of zz tables, but it was too slow during restore

        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);

        // Copy all savepoints tables back to their respective table
        $tables = $db->getObjectList('SHOW TABLES', true);
        $prefix = 'zz_savepoint_';
        $other_prefix = 'zz_replay';

        // Check that undo tables exists
        $bUndoConfigured = false;
        foreach ($tables as $table) {
            if (substr($table, 0, strlen($prefix)) == $prefix) {
                $bUndoConfigured = true;
            }
        }

        if (!$bUndoConfigured) {
            // Undo has not been configured
            // (may be because we added undo AFTER the game has been released)
            throw new \Bga\Exceptions\Framework\UndoFrameworkException(
                clienttranslate(
                    'Sorry, this undo function has just been introduced and will be available for your next game only.'
                ),
                true
            );
        }

        // Particular case: keep current "zombie" states and reflexion time
        // Note: for the ACTIVE player we must NOT keep reflexion time values (start and remaining) for the case where some extra time has been added between
        //  the save and the restore. If some extra time has been added, keeping the time can lead to infinite loop (action => extratime => undo)
        //  where the player can accumulate as much time as he wants
        $db->query(
            "UPDATE `zz_savepoint_player`, `player`
                            SET    `zz_savepoint_player`.`player_zombie`=`player`.`player_zombie`,
                                   `zz_savepoint_player`.`player_start_reflexion_time`=`player`.`player_start_reflexion_time`,
                                   `zz_savepoint_player`.`player_remaining_reflexion_time`=`player`.`player_remaining_reflexion_time`
                            WHERE  `zz_savepoint_player`.`player_id`=`player`.`player_id`
                              AND  `zz_savepoint_player`.`player_id`!=" . $this->getActivePlayerId()
        );

        // Another particular case: keep globals that cannot be undone
        // GAMESTATE_GAME_RESULT_NEUTRALIZED
        // GAMESTATE_NEUTRALIZED_PLAYER_ID
        $db->query("UPDATE `zz_savepoint_global`, `global`
                            SET `zz_savepoint_global`.`global_value`=`global`.`global_value`
                            WHERE `zz_savepoint_global`.`global_id`=`global`.`global_id`
                              AND `global`.`global_id` IN (301, 302)");

        foreach ($tables as $table) {
            if (substr($table, 0, strlen($prefix)) == $prefix) {
                // Save point => must be restored
                $original = substr($table, strlen($prefix));
                $copy = $table;

                if ($original == 'gamelog') {
                    // Particular case: keep private messages
                    $db->query("DELETE FROM `$original` WHERE `gamelog_private`!='1'");
                    $db->query("INSERT INTO `$original` SELECT * FROM `$copy` WHERE `gamelog_private`!='1'");
                } else {
                    $db->query("DELETE FROM `$original`");
                    $fields = $this->getFieldsListOfTable($original);
                    try {
                        $db->query("INSERT INTO `$original` ($fields) SELECT $fields FROM `$copy`");
                    } catch (\Exception $ex) {
                        //after introducing private parallel states there was a problem with undo
                        $fields = str_replace(',`player_state`', '', $fields);
                        $db->query("INSERT INTO `$original` ($fields) SELECT $fields FROM `$copy`");
                    }
                }
            } elseif (substr($table, 0, strlen($other_prefix)) == $other_prefix) {
                // Don't touch this other table too
            } else {
                // This table is an original and must be restored
            }
        }

        // After restoring the savepoint data, we must reload the gamestate to clear cached values.
        // WARNING: this breaks games changing game states after the redo as it can change the state too. So it should NOT be done systematically as it hasn't been done from the start.
        // (it's documented instead for devs who would need it)
        //$this->gamestate->reloadState();

        // Notify all players with their respective getAllDatas so they can restore their interfaces
        /*    $players = $this->loadPlayersBasicInfos();
            global $g_user;
            foreach( $players as $player_id => $player )
            {
                $g_user->setTemporaryMasquerade( $player_id );
                $newGameDatas = $this->getAllTableDatas();

                $this->notifyPlayer( $player_id, 'resetInterfaceWithAllDatas', '', $newGameDatas );

                $g_user->setTemporaryMasquerade( null );
            }*/

        // At the end of the undo, we must erase the old savepoint by the new one.
        // This may be paradoxal, but this way we ensure that the savepoint gets all the recent updates that was not concerned by the undo,
        // including the latest notifications "undoRestorePoint".
        // Also, it allows us to have a reliable undoIsCurrentlyOnSavepoint
        self::undoSavepoint(); // we cannot use $this->undoSavepoint(); because some games override it but expect this line to call the Table one, not the overriden one! One those games replace overrides by wrappers, we can use $this.
        //     else
        //    throw new \feException( "Undo function is not available in realtime" );
    }

    /**
     * Force end of a tournament game, because tournament table time is over.
     * We order players depending on their remaining TIME, then we stop the game immediately
     */
    public function forceGameTournamendEnd()
    {
        $this->bGameAbandonByTournamentTimeout = true;

        // At first, make sure times are up to date
        $this->gamestate->reflexionTimeUpdate();

        $sql = "SELECT player_id, player_remaining_reflexion_time
                FROM player ";

        $player_to_time = self::getCollectionFromDB($sql, true);

        asort($player_to_time);

        $score = 0;
        foreach ($player_to_time as $player_id => $time) {
            $sql = "UPDATE player SET player_score='$score',player_score_aux='-4243' WHERE player_id='$player_id'";
            self::DbQuery($sql);

            $score++;
        }

        self::reloadPlayersBasicInfos();
        $this->gamestate->jumpToState(99);
    }

    /**
     * used during Arena End of Season procedure to manage ongoing turn based games
     * partial result is:
     * - player with most thinking time loses
     * - everybody else wins (but don't gain Arena or ELO)
     * this is done to avoid stalling the game by not playing when you arena is close to ending, to avoid losing.
     * @return array{
     *      game: int,
     *      player: array<playerId, scoreRank>
     *  }
     */
    public function getTablePartialArenaResult(): array
    {
        // make sure times are up to date
        $this->gamestate->reflexionTimeUpdate();

        // get player with more thinking time spent
        $sql = "SELECT stats_player_id
                FROM `stats`
                WHERE `stats_type` = 1 AND stats_player_id IS NOT NULL
                ORDER BY stats_value DESC";
        $players = self::getObjectListFromDb($sql, true);
        $loser = $players[0];

        // everyone wins (rank = 1)
        $players = array_fill_keys($players, 1);
        // except for the player who used most time (first in returned)
        $players[$loser] = 2;

        // set table to training mode and no time limit
        self::setGameStateValue(GAME_GLOBAL_BGA_RANKING_MODE, 1); // training mode
        self::setGameStateValue(GAME_GLOBAL_REFLEXION_TIME_PROFILE, 20); // turn based + no time limit

        // notify everybody
        self::notifyAllPlayers('simpleNote', '<b>' . clienttranslate('The arena season has just ended!') . '</b>', []);
        self::notifyAllPlayers(
            'simpleNote',
            clienttranslate(
                '${player_name} is the player who consumed most thinking time and thus will be considered the loser of the game (${see_more_link}).'
            ),
            [
                'player_name' => self::getPlayerNameById($loser),
                'see_more_link' => [
                    'log' =>
                        '<a href="' .
                        self::getMasterNodeUrl() .
                        '/faq?anchor=faq_arena_arenaturnbasedendseason" target="_blank">${label}</a>',
                    'args' => [
                        'i18n' => ['label'],
                        'label' => clienttranslate('see more'),
                    ],
                ],
            ]
        );
        self::notifyAllPlayers(
            'simpleNote',
            clienttranslate('Note: you can continue to play in Training mode or leave the game with no penalty.'),
            []
        );

        return [
            'game' => $this->gameid,
            'players' => $players,
        ];
    }

    /**
     * Alias for getGameName
     */
    public function getCurrentGameName()
    {
        return $this->getGameName();
    }

    /**
     * Indicates if the lock screen is still showed.
     */
    public function endLockScreen(): bool
    {
        if ($this->gamestate->getCurrentMainState()->name != 'gameSetup') {
            return false;
        } // Return false to make sure client stop sending requests

        $lockScreenTime = self::getGameStateValue('lock_screen_timestamp');
        if (time() > $lockScreenTime) {
            $this->bEndLockScreenCase = true;

            $initialStateId = $this->globals->get(BGA_INITIAL_STATE_ID);
            if ($initialStateId !== null) {
                $this->globals->delete(BGA_INITIAL_STATE_ID);
                $this->gamestate->jumpToState($initialStateId);
            } else {
                $this->gamestate->nextState('');
            }
            return false; // Return false to make sure client stop sending requests
        } else {
            // Too early :
            // Do nothing and return true to make sure the client continue to send requests
            return true;
        }
    }

    /**
     * Switch the game from Real-time to Turn-based.
     */
    public function switchToTurnbased()/*: void*/ {
        $previousTimeProfile = (int)$this->getGameStateValue(GAME_GLOBAL_REFLEXION_TIME_PROFILE);
        $newTimeProfile = null;
        $initialReflexionHours = null;
        $additionalReflexionHours = null;
        switch ($previousTimeProfile) {
            case 0: // Realtime • Fast speed
                $newTimeProfile = 13; // Turn-based • 4 moves per day (+6h00 per turn (maximum 24h00))
                $initialReflexionHours = 24;
                $additionalReflexionHours = 6;
                break; 
            case 1: // Realtime • Normal speed
                $newTimeProfile = 15; // Turn-based • 2 moves per day (+12h00 per turn (maximum 36h00))
                $initialReflexionHours = 36;
                $additionalReflexionHours = 12;
                break; 
            case 2: // Realtime • Slow speed
                $newTimeProfile = 17; // Turn-based • 1 move per day (+24h00 per turn (maximum 3 days))
                $initialReflexionHours = 48;
                $additionalReflexionHours = 24;
                break; 
            case 9: // Realtime • No time limit (friendly mode)
                $newTimeProfile = 20; // Turn-based • No time limit (friendly mode)
                $initialReflexionHours = 2160;
                $additionalReflexionHours = 720;
                break; 
            default:
                throw new \feException('Unknown time profile for switchToTurnbased');
        }

        // Adjust time to think
        $this->setGameStateValue(GAME_GLOBAL_INITIAL_REFLEXION_TIME, $initialReflexionHours * 3600);
        $this->setGameStateValue(GAME_GLOBAL_ADDITIONAL_REFLEXION_TIME, $additionalReflexionHours * 3600);

        // Give every player the initial reflexion time
        $players = $this->loadPlayersBasicInfos();
        foreach ($players as $player_id => $player) {
            $this->giveExtraTime($player_id, $initialReflexionHours * 3600);
        }

        // Change current time profile to the matching turn-based one
        $this->setGameStateValue(GAME_GLOBAL_REFLEXION_TIME_PROFILE, $newTimeProfile);

        // Notify everyone
        $this->notifyAllPlayers(
            'switchToTurnbased',
            clienttranslate('This Realtime table has been switched to Turnbased table.'),
            []
        );

        $this->activePlayersWhenActionStarted = []; // Make the system believe that no one was active before, so the active player can be notified of the change
        $this->checkActivePlayersChange();
    }

    /**
     * Received when it seems that some player "A" is not knowing that it is his turn
     * As he may have miss a notification, we send an empty notification to enabled the "notification resynchro" on player "A" client and make sure he knows this is his turn.
     */
    public function wakeupPlayers()/*: void*/
    {
        $this->not_a_move_notification = true; // note: do not increase the move counter
        self::notifyAllPlayers('wakeupPlayers', '', []);
    }

    private function setReflexionTimeStandardDeviation(): void
    {
        $maximum_time = self::getGameStateValue(GAME_GLOBAL_INITIAL_REFLEXION_TIME);

        $players = self::loadPlayersBasicInfos();

        $player_turn_delta = [];
        $player_turn_lasttime = [];
        $player_to_time_serie = [];
        foreach ($players as $player_id => $player) {
            $player_turn_lasttime[$player_id] = $maximum_time;
            $player_turn_delta[$player_id] = 0;
            $player_to_time_serie[$player_id] = [];
        }

        $sql = "SELECT gamelog_notification
                FROM gamelog
                ORDER BY gamelog_packet_id ASC";

        $packets = self::getObjectListFromDB($sql, true);

        foreach ($packets as $packet) {
            $notifs = json_decode($packet, true);

            foreach ($notifs as $notif) {
                if ($notif['type'] == 'gameStateChange') {
                    foreach ($notif['args']['reflexion']['total'] as $player_id => $time) {
                        if ($time !== null) {
                            if ($time < $player_turn_lasttime[$player_id]) {
                                // Some time has been consumed
                                $player_turn_delta[$player_id] += $player_turn_lasttime[$player_id] - $time;
                                $player_turn_lasttime[$player_id] = $time;
                            } elseif ($time > $player_turn_lasttime[$player_id]) {
                                // Some time has been credited!
                                // this is a turn end !
                                $player_to_time_serie[$player_id][] = $player_turn_delta[$player_id];
                                $player_turn_lasttime[$player_id] = $time;
                                $player_turn_delta[$player_id] = 0;
                            }
                        }
                    }
                }
            }
        }

        // Final turn

        foreach ($player_turn_delta as $player_id => $delta) {
            if ($delta > 0) {
                $player_to_time_serie[$player_id][] = $delta;
            }
        }

        foreach ($player_to_time_serie as $player_id => $serie) {
            $dev = $this->standardDeviation($serie);

            self::setStat($dev, 'reflexion_time_sd', $player_id);
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////// Game "legacy" data management ////////////////////////////////

    /**
     * Store some data associated with $key for the given user / current game.
     *
     * In the opposite of all other game data, this data will PERSIST after the end of this table, and can be
     * re-used in a future table with the same game.
     *
     * IMPORTANT: The only possible place where you can use this method is when the game is over at your table
     * (last game action). Otherwise, there is a risk of conflicts between ongoing games.
     * 
     * TTL is a time-to-live: the maximum, and default, is 365 days.
     *
     * Each key for a given user and game can store up to 64 KiB of JSON data.
     *
     * NOTICE: You can store some persistent data across all tables from your game using the specific player_id 0
     * which is unused. In such case, it's even more important to manage correctly the size of your data to avoid
     * any exception or issue while storing updated data (ie. you can use this for some kind of leaderboard for solo
     * game or contest).
     *
     * Note: This function cannot be called during game setup (will throw an error).
     * 
     * 📖 was a documented function.
     */
    function storeLegacyData(/*int*/ $player_id, /*string*/ $key, $data, /*int*/ $ttl = 365): void
    {
        // Check if this player is at current table
        $players = self::loadPlayersBasicInfos();

        if ($player_id != 0 && !isset($players[$player_id])) {
            throw new \feException("storeLegacyData: $player_id is not playing at this table");
        }

        if ($key != preg_replace('/[^a-zA-Z0-9]+/', '', $key)) {
            throw new \feException('storeLegacyData: Key must only contain a-z, A-Z or 0-9');
        }

        if (strlen($key) < 1 or strlen($key) > 16) {
            throw new \feException('storeLegacyData: Key must contains between 1 and 16 characters');
        }

        // GS => MS request
        self::masterNodeRequest('storeLegacyData', [
            'table_id' => $this->table_id,
            'player' => $player_id,
            'key' => $key,
            'data' => $data,
            'ttl' => $ttl,
        ]);
    }

    /**
     * Calculate the standard deviation for a series of values.
     *
     * @param array<int, int|float> $values
     * @return float
     */
    private function standardDeviation(array $values): float
    {
        $values_count = count($values);
        if ($values_count === 0) {
            return 0.0;
        }

        $mean = array_sum($values) / $values_count;
        $variance = 0.0;
        foreach ($values as $value) {
            $variance += pow($value - $mean, 2);
        }
        $variance /= $values_count;

        return (float) sqrt($variance);
    }

    /**
     * Same as storeLegacyData, except that it stores some data for the whole team within the current table
     * Ie: if players A, B and C are at a table, the legacy data will be saved for future table with (exactly) A, B and C on the table.
     * This is useful for games which are intended to be played several time by the same team.
     * Each team and game can store up to 64 KiB of JSON data. Catch FEX_legacy_size_exceeded if this limit is exceeded.
     * 
     * 📖 was a documented function.
     */
    function storeLegacyTeamData($data, /*int*/ $ttl = 365): void
    {
        $players = self::loadPlayersBasicInfos();

        // Get all the players ids
        $player_ids = array_keys($players);
        sort($player_ids);
        $key = implode('_', $player_ids);
        $key = substr(md5($key), 0, 16); // Note: we are using md5+substr to get a unique key name for this group of players

        $first_player = reset($player_ids); // Note: data is stored in the player with the lowest ID

        $this->storeLegacyData($first_player, $key, $data, $ttl);
    }

    /**
     * Get data associated with $key for the current game.
     * 
     * This data is common to ALL tables from the same game for this player, and persist from one table to another.
     * Note: calling this function has an important cost => please call it few times (possibly: only ONCE) for each player for 1 game if possible
     * .Note: you can use '%' in $key to retrieve all keys matching the given patterns
     * 
     * 📖 was a documented function.
     */
    function retrieveLegacyData(/*int*/ $player_id, /*string*/ $key): mixed
    {
        $players = self::loadPlayersBasicInfos();

        if ($player_id != 0 && !isset($players[$player_id])) {
            throw new \feException("storeLegacyData: $player_id is not playing at this table");
        }

        // GS => MS request
        $result = self::masterNodeRequest('retrieveLegacyData', [
            'table_id' => $this->table_id,
            'player' => $player_id,
            'key' => $key,
        ]);

        return $result;
    }

    /**
     * Same as retrieveLegacyData, except that it retrieves some data for the whole team within the current table (set by storeLegacyTeamData)
     * (see storeLegacyTeamData for more infos)
     * 
     * 📖 was a documented function.
     */
    function retrieveLegacyTeamData(): mixed
    {
        $players = self::loadPlayersBasicInfos();

        // Get all the players ids
        $player_ids = array_keys($players);
        sort($player_ids);
        $key = implode('_', $player_ids);
        $key = substr(md5($key), 0, 16); // Note: we are using md5+substr to get a unique key name for this group of players

        $first_player = reset($player_ids); // Note: data is stored in the player with the lowest ID

        $result = $this->retrieveLegacyData($first_player, $key);
        if (count($result) > 0) {
            return reset($result);
        } else {
            return $result;
        }
    }

    /**
     * Remove some legacy data with the given key.
     * 
     * 📖 was a documented function.
     */
    function removeLegacyData(/*int*/ $player_id, /*string*/ $key): void
    {
        $players = self::loadPlayersBasicInfos();

        if ($player_id != 0 && !isset($players[$player_id])) {
            throw new \feException("storeLegacyData: $player_id is not playing at this table");
        }

        // GS => MS request
        self::masterNodeRequest('removeLegacyData', [
            'table_id' => $this->table_id,
            'player' => $player_id,
            'key' => $key,
        ]);
    }

    /**
     * Same as removeLegacyData, except that it remove some data for the whole team within the current table (set by storeLegacyTeamData)
     * (see storeLegacyTeamData for more infos)
     * 
     * 📖 was a documented function.
     */
    function removeLegacyTeamData(): void
    {
        $players = self::loadPlayersBasicInfos();

        // Get all the players ids
        $player_ids = array_keys($players);
        sort($player_ids);
        $key = implode('_', $player_ids);
        $key = substr(md5($key), 0, 16); // Note: we are using md5+substr to get a unique key name for this group of players

        $first_player = reset($player_ids); // Note: data is stored in the player with the lowest ID

        $this->removeLegacyData($first_player, $key);
    }

    /**
     * Gets the value of a user preference for a player (cached in game DB). Null if unset.
     * 
     * 📖 was a documented function.
     * 
     * @deprecated use $this->userPreferences->get
     */
    function getGameUserPreference(int $playerId, int $prefId): ?int {
        return $this->userPreferences->get($playerId, $prefId);
    }

    /**
     * Returns the progression defined by the game in getGameProgression, fallback to 0 on exception.
     * Returns 100 if the game is finished, without calling game getGameProgression.
     */
    function getSafeGameProgression(): int {
        try {
            if ($this->gamestate->getCurrentMainStateId() === 99) {
                return 100;
            }

            $rawGameProgression = $this->getGameProgression();
            return min(100, max(0, (int)round((float)$rawGameProgression)));
        } catch (\Throwable $e) {
            $this->error("Error when calling getGameProgression: ".$e);
        }
        // if there is an exception during getGameProgression, we consider progression is 0
        return 0;
    }

    /**
     * Play zombie moves from the Studio debug menu.
     */
    final public function debug_bgaPlayMoves(int $moves = 1): void {
        if ($moves < 0) {
            throw new \InvalidArgumentException('The number of zombie moves must not be negative.');
        }

        $this->bga->debug->playUntil(fn(int $count) => $count >= $moves);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////
    //// Local Runner Integration Helpers

    public bool $inPlayerAction = false;
    private static bool $localSchemaEnsured = false;

    public static function ensureLocalSchemaInitialized(bool $clearData = false): void
    {
        global $bgaContainer;
        /** @var \Bga\GameFramework\Old\Db $db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);

        $needsCreate = false;
        if (!self::$localSchemaEnsured) {
            $tables = $db->getObjectList("SHOW TABLES LIKE 'card'", true);
            $cols = empty($tables) ? [] : $db->getObjectList("SHOW COLUMNS FROM `player` LIKE 'player_team'", true);
            if (empty($tables) || empty($cols)) {
                $needsCreate = true;
            } else {
                self::$localSchemaEnsured = true;
            }
        }

        if ($needsCreate) {
            $stdSchemaFile = dirname(__DIR__, 2) . '/bga-std-schema.sql';
            $gameSchemaFile = dirname(__DIR__, 3) . '/dbmodel.sql';

            $dropTables = [
                'global',
                'player',
                'stats',
                'gamelog',
                'replaysavepoint',
                'bga_user_preferences',
                'playermultiactive',
                'bga_globals',
                'card',
                'actionlog',
            ];
            foreach ($dropTables as $tbl) {
                $db->query("DROP TABLE IF EXISTS `$tbl`");
            }

            foreach ([$stdSchemaFile, $gameSchemaFile] as $file) {
                $sql = file_get_contents($file);
                if ($sql === false) {
                    throw new \RuntimeException("Unable to read schema file: $file");
                }
                $cleanSql = preg_replace('!/\*.*?\*/!s', '', $sql) ?? $sql;
                $cleanSql = preg_replace('/^\s*--.*$/m', '', $cleanSql) ?? $cleanSql;
                foreach (explode(';', $cleanSql) as $stmt) {
                    $stmt = trim($stmt);
                    if ($stmt !== '') {
                        $db->query($stmt);
                    }
                }
            }
            self::$localSchemaEnsured = true;
            return;
        }

        if ($clearData) {
            $clearTables = [
                'global',
                'player',
                'stats',
                'gamelog',
                'replaysavepoint',
                'bga_user_preferences',
                'playermultiactive',
                'card',
                'actionlog',
            ];
            foreach ($clearTables as $tbl) {
                $db->query("DELETE FROM `$tbl`");
            }
            foreach (['gamelog', 'card', 'actionlog'] as $autoIncTbl) {
                $db->query("ALTER TABLE `$autoIncTbl` AUTO_INCREMENT = 1");
            }
        }
    }

    public function setCurrentPlayerId(int $playerId): void
    {
        global $g_user;
        $g_user->id = $playerId;
        $g_user->isSpectator = false;
    }

    public function setSpectatorMode(bool $isSpectator): void
    {
        global $g_user;
        $g_user->isSpectator = $isSpectator;
    }

    public function beginPlayerAction(): void
    {
        if (!empty($this->notifications)) {
            $this->sendNotifications();
        }
        $this->nbrZombieTurnCycle = 0;
        global $bgaContainer;
        /** @var \Bga\GameFramework\Old\Db $db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);

        $db->query("SET SESSION transaction_isolation = 'REPEATABLE-READ'");
        $db->query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
        $this->inPlayerAction = true;

        TableInfos::$tables_infos = [];
        $this->players = [];
        if ($this->o_tableinfos !== null) {
            $this->o_tableinfos->reload();
        }
        if ($this->gamestate !== null) {
            $this->gamestate->loadStateMachine($this, $this->gamename, (int) ($this->table_id ?? 1));
        }
    }

    public function endPlayerAction(bool $rollback = false): void
    {
        global $bgaContainer;
        /** @var \Bga\GameFramework\Old\Db $db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);

        try {
            if ($rollback) {
                $this->notifications = [];
                $this->target_to_notification_packet = [];
                $this->notification_packet_to_target = [];
                $this->chatmessage_notification = false;
                $this->not_a_move_notification = false;
                $db->rollback();
            } else {
                if (!empty($this->notifications)) {
                    $this->sendNotifications();
                }
                $db->commit();
            }
        } finally {
            $this->inPlayerAction = false;
            try {
                $db->query('DO RELEASE_ALL_LOCKS()');
            } catch (\Throwable $e) {
            }
            if (method_exists($this, 'onRequestEnd')) {
                $this->onRequestEnd();
            }
        }
    }

    public function rollbackPlayerAction(): void
    {
        $this->endPlayerAction(true);
    }

    public function createNewGame(array $options = [], ?array $customPlayers = null): void
    {
        if ($this->inPlayerAction) {
            $this->endPlayerAction(true);
        }

        self::ensureLocalSchemaInitialized(true);

        TableInfos::$tables_infos = [];
        $this->players = [];
        $this->notifications = [];
        $this->target_to_notification_packet = [];
        $this->notification_packet_to_target = [];
        $this->chatmessage_notification = false;
        $this->not_a_move_notification = false;
        if (method_exists($this, 'onRequestEnd')) {
            $this->onRequestEnd();
        }

        $gameLength = (int) ($options[100] ?? $options['gameLength'] ?? 2);
        $playerTeams = (int) ($options[101] ?? $options['playerTeams'] ?? 1);
        $gameVariant = (int) ($options[102] ?? $options['gameVariant'] ?? 1);
        $turnBased = !empty($options['turnBased']) || ((int) ($options[200] ?? 0) >= 10);

        $globalOptions = [
            8 => 300,
            9 => 30,
            100 => $gameLength,
            101 => $playerTeams,
            102 => $gameVariant,
            200 => $turnBased ? 20 : 1,
            201 => 0,
            207 => 0,
        ];

        $players = $customPlayers ?? [
            2385074 => [
                'player_name' => 'dashwood0',
                'player_canal' => 'canal_2385074',
                'player_avatar' => '000000',
                'player_table_order' => 1,
            ],
            2385075 => [
                'player_name' => 'dashwood1',
                'player_canal' => 'canal_2385075',
                'player_avatar' => '000000',
                'player_table_order' => 2,
            ],
            2385076 => [
                'player_name' => 'dashwood2',
                'player_canal' => 'canal_2385076',
                'player_avatar' => '000000',
                'player_table_order' => 3,
            ],
            2385077 => [
                'player_name' => 'dashwood3',
                'player_canal' => 'canal_2385077',
                'player_avatar' => '000000',
                'player_table_order' => 4,
            ],
        ];

        $idx = 0;
        foreach ($players as $pId => &$pInfo) {
            $pInfo['player_id'] = (int) $pId;
            $pInfo['player_is_admin'] = $pInfo['player_is_admin'] ?? ($idx === 0 ? 1 : 0);
            $pInfo['player_is_ai'] = $pInfo['player_is_ai'] ?? 0;
            $pInfo['beginner'] = $pInfo['beginner'] ?? 0;
            $idx++;
        }
        unset($pInfo);

        $this->setCurrentPlayerId((int) array_key_first($players));
        $this->setTable(1, $this->getGameName(), 1237, true);
        $this->setupNewGameTable(
            1237,
            $players,
            $globalOptions,
            false,
            [],
            [
                'keep_ranking_on_quit' => false,
                'defer_initial_ai_turn' => false,
            ],
            [
                'is_tournament' => false,
            ]
        );
        $this->endPlayerAction(false);
    }

    public function getMoveId(): int
    {
        $val = self::getUniqueValueFromDB('SELECT global_value FROM global WHERE global_id = 3');
        return $val !== null ? max(1, (int) $val - 1) : 1;
    }

    public function getFullClientPayload(int $viewerPlayerId): array
    {
        if (!empty($this->notifications)) {
            $this->sendNotifications();
        }

        global $g_user;
        if (!$g_user->isSpectator) {
            $this->setCurrentPlayerId($viewerPlayerId);
        }

        TableInfos::$tables_infos = [];
        $this->players = [];
        if ($this->o_tableinfos !== null) {
            $this->o_tableinfos->reload();
        }
        if ($this->gamestate !== null) {
            $this->gamestate->loadStateMachine($this, $this->gamename, (int) ($this->table_id ?? 1));
        }

        $datas = $this->getAllTableDatas();
        $basic = $this->bgaInternalLoadPlayersBasicInfos();
        $scores = self::getCollectionFromDB('SELECT player_id, player_score, player_score_aux FROM player');

        foreach ($datas['players'] as $pId => &$pRow) {
            $bRow = $basic[$pId] ?? [];
            $sRow = $scores[$pId] ?? [];
            $pRow['id'] = (int) $pId;
            $pRow['no'] = (int) ($pRow['no'] ?? $bRow['player_no'] ?? 0);
            $pRow['name'] = $pRow['name'] ?? $bRow['player_name'] ?? '';
            $pRow['color'] = $bRow['player_color'] ?? '000000';
            $pRow['color_back'] = null;
            $pRow['score'] = (string) ($pRow['score'] ?? $sRow['player_score'] ?? '0');
            $pRow['score_aux'] = (string) ($sRow['player_score_aux'] ?? '0');
            $pRow['zombie'] = (int) ($bRow['player_zombie'] ?? 0);
            $pRow['eliminated'] = (int) ($bRow['player_eliminated'] ?? 0);
            $pRow['is_ai'] = '0';
            $pRow['beginner'] = false;
            $pRow['avatar'] = '000000';
        }
        unset($pRow);

        $lastPacketId = (int) (self::getUniqueValueFromDB(
            'SELECT COALESCE(MAX(gamelog_packet_id), 0) FROM gamelog'
        ) ?? 0);

        $datas['notifications'] = [
            'last_packet_id' => $lastPacketId,
            'move_nbr' => $this->getMoveId(),
        ];

        return $datas;
    }

    public function getNotificationsSince(
        int $lastPacketId = 0,
        ?int $viewerPlayerId = null,
        bool $allChannels = false
    ): array {
        if (!empty($this->notifications)) {
            $this->sendNotifications();
        }

        $sql = 'SELECT gamelog_packet_id, gamelog_move_id, gamelog_player, UNIX_TIMESTAMP(gamelog_time) AS created_at, gamelog_notification FROM gamelog WHERE gamelog_packet_id > ' . (int) $lastPacketId;
        if (!$allChannels && $viewerPlayerId !== null) {
            $sql .= ' AND (gamelog_player IS NULL OR gamelog_player = ' . (int) $viewerPlayerId . ')';
        }
        $sql .= ' ORDER BY gamelog_packet_id ASC';

        $rows = self::getObjectListFromDB($sql);
        $packets = [];
        $lastMoveId = '1';

        foreach ($rows as $row) {
            $packetId = (string) $row['gamelog_packet_id'];
            if ($row['gamelog_move_id'] !== null) {
                $lastMoveId = (string) $row['gamelog_move_id'];
            }
            $moveId = $row['gamelog_move_id'] !== null ? (string) $row['gamelog_move_id'] : $lastMoveId;
            $channel = $row['gamelog_player'] === null
                ? '/table/t' . ($this->table_id ?? 1)
                : '/player/p' . (int) $row['gamelog_player'];
            $time = (string) ($row['created_at'] ?? time());

            $notifs = json_decode((string) $row['gamelog_notification'], true);
            if (!is_array($notifs)) {
                continue;
            }

            foreach ($notifs as $notif) {
                if (!is_array($notif)) {
                    continue;
                }
                $type = (string) ($notif['type'] ?? '');
                $args = is_array($notif['args'] ?? null) ? $notif['args'] : [];

                if (!$allChannels && $viewerPlayerId !== null && $row['gamelog_player'] === null) {
                    if (
                        $type === 'gameStateChange' &&
                        !empty($args['_notified_privately']) &&
                        in_array((int) $viewerPlayerId, array_map('intval', (array) $args['_notified_privately']), true)
                    ) {
                        continue;
                    }
                }

                if ($allChannels && $row['gamelog_player'] !== null && $type === 'gameStateChange') {
                    continue;
                }

                unset($args['_notified_privately']);
                $notif['args'] = $args;
                if (!isset($notif['h'])) {
                    $notif['h'] = substr(md5((string) ($notif['uid'] ?? $packetId)), 0, 6);
                }

                $packets[] = [
                    'packet_id' => $packetId,
                    'packet_type' => 'single',
                    'move_id' => $moveId,
                    'channel' => $channel,
                    'table_id' => (int) ($this->table_id ?? 1),
                    'time' => $time,
                    'data' => [$notif],
                ];
            }
        }

        return $packets;
    }

    public function getAllGamelogsForReplay(): array
    {
        return $this->getNotificationsSince(0, null, true);
    }
}
