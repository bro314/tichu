<?php

namespace Bga\GameFramework;

use const Bga\GameFramework\GAME_GLOBAL_REFLEXION_TIME_PROFILE;
use const Bga\GameFramework\GAME_GLOBAL_GAME_PROGRESSION;

/**
 * State machine corresponding to the game.
 */
class GamestateMachine extends Old\APP_DbObject
{
    var $o_game = null;
    private ?int $currentStateId = null;
    private $active_player = null; // usually array, but can be an int in a string
    public $states = []; // should be private, but some games access it directly.
    var $table_id = null;
    var $game = null;
    private mixed $state_args = null; // usually array, but a game could return any type
    var $table_globals = [];
    var $admin_player = null;
    private bool $lock_state_args = false;
    private ?array $multiple_active = null;
    private ?array $reflexion_time = null;
    private ?TableInfos $o_tableinfos = null;
    public bool $bGameCreationRequest = false; // Note: true if we are during the game creation request
    private int $nested_jumptostate = 0;
    private int $save_every = 10; // it's a constant?
    private ?array $playerPrivateStates = null;
    private bool $privateStateCacheSkippedArgs = false;
    private bool $activePlayerChanged = false;

    /**
     * Load the state machine from the states.inc.php file.
     */
    public function loadStateMachine(Table $o_game, string $game, int $table_id): void
    {
        $this->table_id = $table_id;
        $this->o_game = $o_game;
        $this->game = $game;

        $this->o_tableinfos = new TableInfos();
        $this->o_tableinfos->setTable((int) $table_id);

        $this->states = [];

        if (count($this->states) == 0) {
            // Load state machine from a game configuration file
            $statesFile = file_exists(APP_GAMES_PATH . $game . '/current/states.inc.php')
                ? APP_GAMES_PATH . $game . '/current/states.inc.php'
                : APP_GAMEMODULE_PATH . '/states.inc.php';
            if (file_exists($statesFile)) {
                require $statesFile;
                foreach ($machinestates as $stateId => $machinestate) {
                    $this->states[$stateId] = gettype($machinestate) === 'array' ?
                        GameState::fromArray($machinestate) : // state described as array
                        $machinestate; // state built with the GameStateBuilder                  
                    $this->initLegacyStateClass($stateId, $this->states[$stateId]);                    
                }
            }

            if (!array_key_exists(1, $this->states)) {
                $this->states[1] = GameStateBuilder::gameSetup()->build();
                $this->initLegacyStateClass(1, $this->states[1]);
            }
            if (!array_key_exists(99, $this->states)) {
                $this->states[99] = GameStateBuilder::gameEnd()->build();
                $this->initLegacyStateClass(9, $this->states[99]);
            }

            // all legacy states are loaded, with a LegacyGameState state class. We can now load states in the modules/php/States folder.
            $this->addGameStateClasses($game);
            $this->mapInitialPrivateStates();

            $this->checkStatesDefinition();
        }

        // Get current state from db
        // Note on globals:
        //  id<10: game states globals common to all games
        //  10 <= id < 100: game state globals specific to a game
        //  100 <= id: game options
        //
        $this->table_globals = $this->o_tableinfos->getGlobalsFromDB();
        $currentStateId = 1;
        foreach ($this->table_globals as $global_id => $global_value) {
            if ($global_id == \GAMESTATE_CURRENT_STATE) {
                $currentStateId = $global_value;
            }
            if ($global_id == \GAMESTATE_ACTIVE_PLAYER) {
                $this->active_player = $global_value;
            }
            if ($global_id == \GAMESTATE_ADMIN_PLAYER) {
                $this->admin_player = $global_value;
            }
        }

        self::setCurrentState($currentStateId);
    }

    protected function checkStatesDefinition()
    {
        foreach ($this->states as $stateId => $state) {
            // check existence of the referenced method of action/args fields
            foreach (['action', 'args'] as $fieldName) {
                if (
                    isset($state->$fieldName) &&
                    !method_exists($this->o_game, $state->$fieldName) &&
                    $state->type !== StateType::MANAGER
                ) {
                    // don't test manager states, because stGameSetup is defined in the template but doesn't actually exists in Table
                    // at first we just add an error log, because it might break some old games.
                    $this->o_game->error(
                        "State '$fieldName' method '{$state->$fieldName}' not found in Game class for state $stateId.",
                    );
                    // TODO: replace the error log by the exception below:
                    // throw new \InvalidArgumentException( "State '$fieldName' method '{$state[$fieldName]}' not found in Game class for state $stateId.");
                }
            }

            // check existence of the referenced states of transitions
            if ($state->type !== StateType::MANAGER && isset($state->transitions) && gettype($state->transitions) === 'array') {
                foreach ($state->transitions as $transitionName => $destinationStateId) {
                    if (gettype($destinationStateId) === 'integer' && !array_key_exists($destinationStateId, $this->states)) {
                        // at first we just add an error log, because it might break some old games.
                        $this->o_game->error(
                            "Transition '{$transitionName}' redirects to unexisting state id $destinationStateId for state $stateId.",
                        );
                        // TODO: replace the error log by the exception below:
                        // throw new \InvalidArgumentException("Transition '{$transitionName}' redirects to unexisting state id $destinationStateId for state $stateId.");
                    }
                }
            }
        }
    }

    /**
     * Reload state machine and return current state.
     * 
     * 📖 documented function.
     * 
     * @return array the result of gamstate->state()
     */
    public function reloadState(): array
    {
        $this->loadStateMachine($this->o_game, $this->game, (int) $this->table_id);
        return $this->state();
    }

    /**
     * Init the game state to the first state (1).
     */
    public function resetGameState(?int $admin_player): void
    {
        $currentStateId = 1; // Start state
        $this->active_player = 0; // No active player when game start

        // General setup methods
        $this->o_tableinfos->setGlobal(\GAMESTATE_CURRENT_STATE, $currentStateId);
        $this->o_tableinfos->setGlobal(\GAMESTATE_ACTIVE_PLAYER, 0);
        $this->o_tableinfos->setGlobal(\GAMESTATE_ADMIN_PLAYER, (int) $admin_player);
        $this->o_tableinfos->setGlobal(\GAMESTATE_NEXT_NOTIF_NO, 1);

        $this->active_player = 0;
        $this->admin_player = $admin_player;
        $this->table_globals[\GAMESTATE_NEXT_NOTIF_NO] = 1;

        self::setCurrentState($currentStateId);
    }

    /**
     * Returns the current state id.
     * 
     * 📖 documented function.
     * 
     * @return int the state id
     */
    public function state_id()
    {
        return $this->currentStateId;
    }

    /**
     * Returns current gamestate infos.
     * It's the current gameState as an array, with added contextual information like active player, computed args, ...
     * 
     * 📖 documented function.
     * 
     * @return array the current state information
     */
    public function state(
        /*bool|int|null*/ $bSkipStateArgs = false,
        /*bool*/ $bOnlyVariableContent = false,
        /*bool*/ $bSkipReflexionTimeLoad = false,
    ) {
        /*: ?array*/
        $viewerPlayerId = null;
        if (is_int($bSkipStateArgs) && $bSkipStateArgs > 1) {
            $viewerPlayerId = $bSkipStateArgs;
            $bSkipStateArgs = false;
        } else {
            $bSkipStateArgs = (bool) $bSkipStateArgs;
        }

        if ($this->currentStateId) {
            $currentState = $this->getCurrentMainState();
            if ($currentState === null) {
                throw new \feException('Unknown state: ' . $this->currentStateId);
            }

            $gamestate = $currentState->toArray();
            $gamestate['id'] = (string) $this->currentStateId;
            $gamestate['active_player'] = (string) $this->active_player;

            if ($bSkipStateArgs) {
                $gamestate['args'] = null;
            } else {
                if (!$this->lock_state_args && $this->nested_jumptostate === 0) {
                    $this->state_args = null;
                }
                if ($this->state_args == null) {
                    self::loadStateArgs();
                }
                $gamestate['args'] = $this->state_args;
                if ($viewerPlayerId !== null && isset($gamestate['args']['_private']) && is_array($gamestate['args']['_private'])) {
                    $privateForViewer =
                        $gamestate['args']['_private'][$viewerPlayerId]
                        ?? $gamestate['args']['_private'][(string) $viewerPlayerId]
                        ?? null;
                    if ($privateForViewer === null && isset($gamestate['args']['_private']['active']) && $this->isPlayerActive($viewerPlayerId)) {
                        $privateForViewer = $gamestate['args']['_private']['active'];
                    }
                    $gamestate['args']['_private'] = $privateForViewer;
                }
            }

            if ($bSkipReflexionTimeLoad) {
                $gamestate['reflexion'] = null;
            } else {
                if ($this->reflexion_time == null) {
                    self::loadReflexionTime();
                }
            }

            $gamestate['reflexion'] = $this->reflexion_time;

            if ($currentState->type === StateType::MULTIPLE_ACTIVE_PLAYER) {
                if ($this->multiple_active == null || $this->nested_jumptostate === 0) {
                    self::loadMultipleActive(false);
                }

                $gamestate['multiactive'] = $this->multiple_active;
            }

            if ($this->isPrivateMasterState()) {
                if ($this->playerPrivateStates == null) {
                    $this->loadPlayerPrivateStates($bSkipStateArgs);
                }

                if ($this->privateStateCacheSkippedArgs && !$bSkipStateArgs) {
                    $this->loadPlayerPrivateStates($bSkipStateArgs);
                }

                $gamestate['private_states'] = $this->playerPrivateStates;
            }

            if ($bOnlyVariableContent) {
                // Return only variable content
                $res = [
                    'id' => (string) $this->currentStateId,
                    'name' => $gamestate['name'],
                    'type' => $gamestate['type'],
                    'description' => $gamestate['description'],
                    'descriptionmyturn' => $gamestate['descriptionmyturn'],
                    'possibleactions' => $gamestate['possibleactions'] ?? [],
                    'transitions' => $gamestate['transitions'] ?? [],
                    'active_player' => $gamestate['active_player'],
                    'args' => $gamestate['args'],
                    'reflexion' => $gamestate['reflexion'],
                ];

                if (isset($gamestate['multiactive'])) {
                    $res['multiactive'] = $gamestate['multiactive'];
                }

                if ($this->isPrivateMasterState()) {
                    $res['private_states'] = [];
                    foreach ($gamestate['private_states'] as $playerId => $state) {
                        $res['private_states'][$playerId] = [
                            'id' => $state['id'] ?? null,
                            'args' => isset($state['args']) ? $state['args'] : [],
                        ];
                    }
                }

                return $res;
            } else {
                return $gamestate;
            } // Return everything
        } else {
            return null;
        }
    }

    /**
     * Check if an action is valid regarding current game state (exception if fails)
     * 
     * @param string $action_name the action name to test against current state possibleActions
     * @param bool $bThrowException if set to "false", the function return false in case of failure instead of throwing an exception
     */
    function checkPlayerAction(string $action_name, bool $bThrowException = true): bool
    {
        $checkPossibleAction = $this->checkPossibleAction($action_name, $bThrowException);
        if (!$checkPossibleAction) {
            return false;
        }

        global $g_user;
        $currentPlayerId = (int)$g_user->get_id();
        $currentState = $this->getCurrentState($currentPlayerId);

        if ($currentState->type === StateType::ACTIVE_PLAYER) {
            $activePlayerId = $this->getPlayerActiveThisTurn();
            if ($activePlayerId != $currentPlayerId) {
                $this->trace("This is not turn of player ".$g_user->get_id()." (this is turn of player {$activePlayerId})");
                if ($bThrowException) {
                    if ($g_user->is_visitor()) {
                        throw new UserException(
                            clienttranslate('You are disconnected from Board Game Arena, please login'),
                        );
                    } else {
                        throw new UserException(clienttranslate('This is not your turn'));
                    }
                } else {
                    return false;
                }
            }
        } elseif ($currentState->type === StateType::MULTIPLE_ACTIVE_PLAYER || $currentState->type === StateType::PRIVATE) {
            // Check if current player is "multi active"
            if ($this->o_game->bIndependantMultiactiveTable) {
                $sql =
                    "SELECT `ma_is_multiactive` `player_is_multiactive` FROM `playermultiactive` WHERE `ma_player_id`='" .
                    $g_user->get_id() .
                    "' LOCK IN SHARE MODE";
            } else {
                $sql =
                    "SELECT `player_is_multiactive` FROM `player` WHERE `player_id`='" .
                    $g_user->get_id() .
                    "' LOCK IN SHARE MODE";
            }
            $dbres = $this->DbQuery($sql);
            $row = mysql_fetch_assoc($dbres);
            if (!$row) {
                if ($bThrowException) {
                    if ($g_user->is_visitor()) {
                        throw new UserException(
                            clienttranslate('You are disconnected from Board Game Arena, please login'),
                        );
                    } else {
                        throw new UserException(clienttranslate('This is not your turn'));
                    }
                } else {
                    return false;
                }
            }

            if ($row['player_is_multiactive'] != 1) {
                $this->trace(
                    'This is not turn of player ' .
                        $g_user->get_id() .
                        ' (player_is_multiactive=' .
                        $row['player_is_multiactive'] .
                        ')',
                );
                if ($bThrowException) {
                    throw new UserException(clienttranslate('This is not your turn'));
                } else {
                    return false;
                }
            }
        } else {
            if ($bThrowException) {
                throw new UserException('Game state type does not allow player actions '.$currentState->type->value);
            } else {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if action is possible regarding current game state (exception if fails)
     * !! DO NOT check if current player is active (use `checkPlayerAction` instead)
     * 
     * 📖 documented function.
     * 
     * @param string $action_name the action name to test against current state possibleActions
     * @param bool $bThrowException if set to "false", the function return false in case of failure instead of throwing an exception
     */
    function checkPossibleAction(string $action_name, bool $bThrowException = true): bool
    {
        global $g_user;
        $currentPlayerId = (int)$g_user->get_id();
        $currentState = $this->getCurrentState($currentPlayerId);

        if ($currentState == null) {
            throw new \feException('Game not initialized yet');
        }

        if (in_array((string)$action_name, $currentState->possibleActions ?? [])) {
            return true;
        }

        $this->trace("Game action impossible: {$action_name} for state {$currentState->name}");
        if ($bThrowException) {
            throw new UserException(
                clienttranslate('This game action is impossible right now'),
            );
        } else {
            return false;
        }
    }

    /**
     * Go to next game state.
     * This function triggers possible actions linked to this game state.
     * 
     * 📖 documented function.
     * 
     * @param string $transition the transition name
     */
    function nextState(/*string*/ $transition = '') /*: void*/
    {
        self::trace("nextState with transition: '" . $transition . "'");
        $state = $this->getCurrentMainState();

        if ($state == null) {
            throw new \feException('Game not initialized yet');
        }

        if ($state->name == 'gameEnd') {
            return;
        } // This is the end of the game, so there is no more "nextState" possible

        // Get corresponding transition
        if ($transition == '') {
            if (count($state->transitions) != 1) {
                self::trace(
                    'in state ' .
                        $state->name .
                        ' possible transitions: ' .
                        count($state->transitions) .
                        ': ' .
                        implode(',', $state->transitions),
                );
                throw new \feException('More than one possible transition at this state');
            }
            $next_state = reset($state->transitions); // Note: return first element
        } else {
            $action_is_possible = false;
            foreach ($state->transitions as $possible_action => $possible_next_state) {
                if ($transition == $possible_action) {
                    $action_is_possible = true;
                    $next_state = $possible_next_state;
                }
            }

            if (!$action_is_possible) {
                throw new \feException(
                    "This transition ($transition) is impossible at this state (" . $this->currentStateId . ')',
                );
            }
        }

        self::jumpToState($next_state);
    }

    /**
     * Jump to specified state, without any checks.
     * 
     * 📖 documented function.
     * 
     * @param int|class-string<Bga\GameFramework\States\GameState> $next_state the state id, or class name if using Class states
     */
    function jumpToState(/*int|string*/ $next_state, /*bool*/ $bWithActions = true)
    {
        /*: void*/ self::trace("jump to state $next_state");

        if (gettype($next_state) === 'string' && str_starts_with($next_state, 'Bga\Games')) {
            // it's a state class name, so we replace next_state by its id
            $next_state = $this->getStateIdByClassName($next_state);
        }

        // Update all active player's reflexion time
        self::reflexionTimeUpdate();

        // Now, switch to next state
        $this->setCurrentState($next_state);
        if ($next_state == 99) {
            // it's in gameEnd args, which are computed before stGameEnd, so we compute it here instead of the beginning of stGameEnd
            $this->o_game->updatePlayerScoresBasedOnGameResults();
        }
        $this->o_tableinfos->setGlobal(\GAMESTATE_CURRENT_STATE, (int) $next_state);
        $state = $this->state(); // needed for args
        self::trace("New game state: '" . $state['name'] . "'");

        // Last move (used to signal to metasite that the table is "alive")
        // (note: last_move is the "0" global)
        self::DbQuery("UPDATE `global` SET `global_value` = UNIX_TIMESTAMP(NOW()) WHERE `global_id` = 0");

        // Game progression
        if (isset($state['updateGameProgression'])) {
            $newProgression = $this->o_game->getSafeGameProgression();
            $state['updateGameProgression'] = $newProgression;

            $this->o_game->setGameStateValue(GAME_GLOBAL_GAME_PROGRESSION, $newProgression);
        }

        // Update "player_start_reflexion_time" field
        self::initiateStartReflexionTime();

        $arg = gettype($state['args']) === 'array' ? array_slice($state['args'], 0) : null; // copy for action params, so _private should not be stripped (TOTEST)

        $notifyGameStateChange = !($state['args']['_no_notify'] ?? false);

        // Removing unnecessary informations from game state (to save space in network/BDD)
        $state_light = [
            'id' => (string) $this->currentStateId,
            'name' => $state['name'] ?? '',
            'description' => $state['description'] ?? '',
            'descriptionmyturn' => $state['descriptionmyturn'] ?? '',
            'possibleactions' => $state['possibleactions'] ?? [],
            'transitions' => $state['transitions'] ?? [],
            'active_player' => $state['active_player'],
            'args' => $state['args'],
            'type' => $state['type'], // Note: type is mandatory to update turn based counters on MS
            'reflexion' => $state['reflexion'],
        ];
        //        $state_light = $state;    // OLD VERSION => must be kept during few days for compatibility

        if (isset($state['multiactive'])) {
            $state_light['multiactive'] = $state['multiactive'];
        }
        if (isset($state['updateGameProgression'])) {
            $state_light['updateGameProgression'] = $state['updateGameProgression'];
        }

        $notifiedPrivately = [];
        // Notify all players of this game state change
        if ($notifyGameStateChange && isset($state['args']['_private'])) {
            $mergePrivate = $this->o_game->bga->notify->isMergePrivate($state['args']);
            // Notify individual players of the game change, setting args._private as their private information
            foreach ($state['args']['_private'] as $target_id => $player_private_args) {
                $public_args = $state['args'];
                unset($public_args['_private']);
                $state_light_private = $mergePrivate ?
                    [...$state_light, 'args' => [...$public_args, ...$player_private_args]] :
                    [...$state_light, 'args' => [...$public_args, '_private' => $player_private_args]];
                if (is_numeric($target_id)) {
                    $player_id = $this->o_game->bga->notify->getUseNo() ?
                        $this->o_game->getPlayerIdByNo((int)$target_id) :
                        (int)$target_id;
                    // Notify player with this ID
                    $notifiedPrivately[] = $player_id;
                    $this->o_game->notifyPlayer($player_id, 'gameStateChange', '', $state_light_private);
                } elseif ($target_id == 'active') {
                    $players_ids = self::getActivePlayerList();
                    foreach ($players_ids as $player_id) {
                        $notifiedPrivately[] = (int)$player_id;
                        $this->o_game->notifyPlayer($player_id, 'gameStateChange', '', $state_light_private);
                    }
                }
            }
            unset($state_light['args']['_private']);
        }
        unset($state_light['args']['_merge_private']);

        // tell that this notif going to /table should ignore the players already notified privately
        if (count($notifiedPrivately) > 0) {
            $state_light['_notified_privately'] = $notifiedPrivately;
        }
        if ($notifyGameStateChange) {
            $this->o_game->notifyAllPlayers('gameStateChange', '', $state_light);
            $this->o_game->isGameStateChangedAtTheEndOfTurn = true;
        }

        if ($bWithActions) {
            // Launch game action corresponding to this new state
            $this->nested_jumptostate++;
            $currentState = $this->getCurrentMainState();
            $result = $this->runStateClassOnEnteringState($currentState, $arg ?? []);
            if (!$currentState->isLegacyGameState) {
                $this->applyStateHandlerRedirection($result);
            }
            $this->nested_jumptostate--;

            // Detect the last gamestate before giving the hand back to players
            if ($this->nested_jumptostate == 0) {
                // Every 10 moves, save all datas to the Database to optimize replays
                $move_id = $this->table_globals[GAMESTATE_NEXT_NOTIF_NO];

                if ($move_id % $this->save_every == 2) {
                    // Note: we always make sure the move #2 is saved (first move after init)
                    $this->o_game->saveReplayPoint($move_id);
                }

                // During table startup, the first AI turn can be resumed only after the MS transaction commits.
                // If normal play has already begun, that callback was missed; do not let its stale flag
                // prevent every subsequent AI turn from being scheduled.
                if ($this->o_game->shouldDeferInitialAiTurn()) {
                    if ($this->table_globals[GAMESTATE_PLAYERTURN_NBR] > 0) {
                        $this->o_game->resumeDeferredInitialAiTurn();
                    }
                } else {
                    $this->o_game->checkZombieTurn();
                }

                if (!$this->o_game->inPlayerAction && !$this->bGameCreationRequest) {
                    $this->o_game->sendNotifications();
                }
            }
        }

        if ($next_state == 99) {
            // This is the end of the game.
            // Before going further (and send notifications), we commit everything, to ensure that the GS is in a "end of the game" state.
            // If we don't do this and some error happens with notification service, then the MS believe that the game is over while the GS believe it is not.
            // By doing this, if some error happens with notification service afterwards, then the player will re-issue his move and will get a "this game has been ended". With a F5 he will recover
            //  from this situation
            self::CommitAllAndRestart();
        }

        self::trace('after jump to nextState');
    }

    /**
     * According to current time profile, return time limits of current table.
     */
    function getAsyncTimeLimits(): array
    {
        $time_profile = (int) $this->o_game->getGameStateValue(GAME_GLOBAL_REFLEXION_TIME_PROFILE);

        if ($time_profile < 10) {
            throw new \feException('getAsyncTimeLimits called with a realtime table');
        }

        global $bgaContainer;
        $tableOptionsManager = $bgaContainer->get(\Bga\Tables\TableOptionsManager::class);
        return $tableOptionsManager->getTimeLimits($time_profile, $this->game);
    }

    /**
     * Send an "asynctablemove" notification to metasite to signal which players are active on the table.
     * in general case, $active_players_change is not null and is used to know which players are newly active and newly inactive.
     */
    public function sendAsyncTableMove(?array $active_players_change = null): void
    {
        // If we are in async mode, we must intercept the last state jump to signal current state to server
        if ($this->o_game->isAsync()) {
            $players = $this->o_game->loadPlayersBasicInfos();
            if (!$players) {
                throw new \Bga\Exceptions\Table\TableWithoutPlayerException('No players are defined on this table!');
            }

            $asyncTimeLimits = $this->getAsyncTimeLimits();
            $additional_time = $asyncTimeLimits['additional_time_per_move'];

            // Give async thinking time to active players
            $maximum_time = $asyncTimeLimits['initial_time_to_thing'];
            if ($maximum_time === null) {
                $maximum_time = $this->table_globals[GAMESTATE_CLOCK_MODE_ARG];
            }

            if ($maximum_time === null) {
                throw new \feException('maximum time is null !!!');
            }

            $players_over_maximum_time = self::getObjectListFromDB(
                "SELECT `player_id` FROM `player` WHERE `player_remaining_reflexion_time`>$maximum_time",
                true,
            );

            if ($active_players_change !== null) {
                if (count($active_players_change['new_active']) > 0) {
                    $players_to_receive_additional_time = [];
                    foreach ($active_players_change['new_active'] as $player_id) {
                        if (!in_array($player_id, $players_over_maximum_time)) {
                            // We filter here players that are over maximum reflexion time. If you are over reflexion time,
                            $players_to_receive_additional_time[] = $player_id;
                        } // you probably used a time joker and you just have to consume your joker without being limited (but you don't receive extra time of course)
                    }

                    if (count($players_to_receive_additional_time) > 0) {
                        $sql = "UPDATE `player` SET `player_remaining_reflexion_time`=LEAST( $maximum_time, `player_remaining_reflexion_time`+$additional_time )
                                WHERE `player_start_reflexion_time` IS NOT NULL
                                  AND `player_remaining_reflexion_time`<$maximum_time "; // Note: this latest check is a security to make sure we do not decrease player_remaining_reflexion_time if it is higher than the max

                        // Note: with this additional filter, we don't give additional time to players that we already actives before
                        $sql .= " AND `player_id` IN ('" . implode("','", $active_players_change['new_active']) . "') ";

                        self::DbQuery($sql);
                    }
                }
            }

            $clock_night = 0;
            if (
                isset($this->table_globals[GAMESTATE_CLOCK_NIGHT]) &&
                $this->table_globals[GAMESTATE_CLOCK_NIGHT] != 0
            ) {
                $clock_night = $this->table_globals[GAMESTATE_CLOCK_NIGHT];
            }

            // Get current active players + time to think
            $active_players = self::getCollectionFromDB("SELECT `player_id`, UNIX_TIMESTAMP( `player_start_reflexion_time` ) `start`,
                    `player_remaining_reflexion_time` `remaining_time`
                    FROM `player`
                    WHERE `player_start_reflexion_time` IS NOT NULL");

            foreach ($active_players as $i => $player) {
                $bSkipIncreaseTime = false; // By default, increase time for everyone
                if ($active_players_change !== null) {
                    $bSkipIncreaseTime = true; // Normal case: increase time for no one, except...
                    if (in_array($player['player_id'], $active_players_change['new_active'])) {
                        $bSkipIncreaseTime = false; // ... those newly actives
                    }
                }

                if (in_array($player['player_id'], $players_over_maximum_time)) {
                    $bSkipIncreaseTime = true;
                }

                $time_to_add = 0;
                if (!$bSkipIncreaseTime) {
                    $time_to_add = $additional_time;
                    self::incReflexionTime($player['player_id'], $additional_time, $maximum_time);
                }

                $active_players[$i]['time_penalty_limit'] = $this->addTimeDeltaToTimestamp(
                    $player['start'],
                    $player['remaining_time'],
                    $clock_night,
                );

                // Note: DEPRECATED
                $active_players[$i]['time_expel_limit'] = min(
                    $player['start'] + $asyncTimeLimits['maximum_time_per_move'],
                    $player['start'] +
                        $player['remaining_time'] +
                        $time_to_add +
                        $asyncTimeLimits['extra_time_to_think_to_expel'],
                );
            }

            global $g_user;
            $current_player_id = $g_user->is_logged() ? $g_user->get_id() : null;

            $progression = $this->o_game->getGameStateValue(GAME_GLOBAL_GAME_PROGRESSION) ?: 0;
            $res = self::masterNodeRequest('asyncTableMove', [
                'table_id' => $this->table_id,
                'current' => $current_player_id,
                'players' => $active_players,
                'all' => array_keys($players),
                'new_table' =>
                    isset($active_players_change) && isset($active_players_change['new_table'])
                        ? $active_players_change['new_table']
                        : false,
                'progression' => $progression,
            ]);
            $this->o_game->ajaxSpecialResult = ['tbyt' => $res]; // Turn based your turn
        }
    }

    /**
     * If this state specify a state argument function, call it.
     */
    private function loadStateArgs(): void
    {
        if ($this->state_args != null) {
            return;
        } // Arguments already loads

        if ($this->lock_state_args) {
            return;
        } // This has been called from an "arg" method => avoid an infinite loop when trying to retrieve current state

        $gamestate = $this->getCurrentMainState();
        $this->lock_state_args = true;
        $this->state_args = $this->getStateClassArgs($gamestate);
        $this->lock_state_args = false;
    }

    final function hasActivePlayerChanged(): bool {
        return $this->activePlayerChanged;
    }

    /**
     * Changes the active player. 
     * 
     * NOTE: you must transition to a state in the action triggering this call, so the change of active player is notified to the front.
     * 
     * 📖 documented function.
     * 
     * @param int $player_id the new active player.
     */
    function changeActivePlayer(/*int*/ $player_id)/*: void*/
    {
        if ($this->getCurrentMainState()->type === StateType::ACTIVE_PLAYER) {
            $this->activePlayerChanged = true;
        }

        $players = $this->o_game->loadPlayersBasicInfos();
        if (!isset($players[$player_id])) {
            throw new \feException('Try to active a player that is not part of the game: ' . $player_id);
        }

        $this->active_player = (string) $player_id;
        $this->o_tableinfos->setGlobal(GAMESTATE_ACTIVE_PLAYER, $player_id);

        $this->o_tableinfos->incGlobal(GAMESTATE_PLAYERTURN_NBR, 1);

        // Notify
        //$this->o_game->notifyAllPlayers( 'newActivePlayer', '', $player_id );
        // Issue: we can't notify now because on many case we are still in previous game state
        //   => change of active player will be done with the "gameStateChange" notification
        // If this is needed one day, we can introduce a "updateActivePlayer" which send explicitely the notification
    }

    /**
     * Get the "active_player", whatever what is the current state type
     * Note: it does NOT mean that this player is active right now, because state type could be "game" or "multiplayer"
     */
    public function getPlayerActiveThisTurn(): ?int
    {
        if ($this->currentStateId) {
            return (int)$this->active_player;
        } else {
            return null;
        }
    }

    /**
     * Return the list of active players. Return a list of one element if activeplayer type state.
     * 
     * 📖 documented function.
     * 
     * @return string[] The list of active players (ids typed as strings).
     */
    public function getActivePlayerList() /*: array*/
    {
        $state = self::state(true, false, true); // used for active_player and multiactive

        if ($state['type'] === StateType::ACTIVE_PLAYER->value) {
            return [$state['active_player']];
        } elseif ($state['type'] === StateType::MULTIPLE_ACTIVE_PLAYER->value) {
            return $state['multiactive'];
        } else {
            return [];
        }
    }

    /**
     * Returns if the current state is multiactive.
     * 
     * 📖 was a documented function.
     */
    public function isMutiactiveState()/*: bool*/
    {        
        return $this->isMultiactiveState();
    }

    /**
     * Returns if the current state is multiactive.
     * 
     * 📖 documented function.
     * 
     * @return bool if the main state is MULTIPLE_ACTIVE_PLAYER.
     */
    public function isMultiactiveState(): bool
    {        
        return $this->getCurrentMainState()->type === StateType::MULTIPLE_ACTIVE_PLAYER;
    }

    /**
     * Return true if specified player is active right now.
     * This method take into account game state type, ie nobody is active if game state is "game" and several
     * players can be active if game state is "multiplayer"
     * 
     * 📖 documented function.
     * 
     * @param int $player_id the player id
     * @return bool if this player is active.
     */
    public function isPlayerActive(/*int*/ $player_id)/*: bool*/
    {
        $state = $this->getCurrentMainState();
        if ($state->type === StateType::ACTIVE_PLAYER) {
            return $this->active_player == $player_id;
        } elseif ($state->type === StateType::MULTIPLE_ACTIVE_PLAYER) {
            // Check if current player is "multi active"
            if ($this->o_game->bIndependantMultiactiveTable) {
                $sql = "SELECT `ma_is_multiactive` `player_is_multiactive` FROM `playermultiactive` WHERE `ma_player_id`='$player_id' LOCK IN SHARE MODE";
            } else {
                $sql = "SELECT `player_is_multiactive` FROM `player` WHERE `player_id`='$player_id' LOCK IN SHARE MODE";
            }
            $dbres = self::DbQuery($sql);
            $row = mysql_fetch_assoc($dbres);
            if (!$row) {
                return false; // Note: it happens for Spectators => we must return false instead of throwing an exception here
                //throw new feException( "Unable to retrieve multiactivity status for player ".$player_id );
            }

            if ($row['player_is_multiactive'] == 1) {
                return true;
            }
        }

        return false;
    }

    /**
     * Change current state and update associated arguments
     */
    private function setCurrentState(int $newStateId)
    {
        $this->currentStateId = $newStateId;
        $this->state_args = null;
    }

    /**
     * Returns the list of players multiple active and load it into this->multiple_active
     */
    private function loadMultipleActive(bool $bLockInShareMode = true): void
    {
        // Note: for multiactive activity, we should always take the last situation as it can evolved anytime.
        //  => we should face deadlocks if it happens
        self::setDeadlockMode('retry'); // Players can play at the same time => allow the retry

        $this->multiple_active = [];
        if ($this->o_game->bIndependantMultiactiveTable) {
            $sql = 'SELECT `ma_player_id` `player_id`, `ma_is_multiactive` `player_is_multiactive` FROM `playermultiactive` ';
        } else {
            $sql = 'SELECT `player_id`, `player_is_multiactive` FROM `player` ';
        }

        if ($bLockInShareMode) {
            $sql .= 'LOCK IN SHARE MODE ';
        }
        $dbres = self::DbQuery($sql);
        while ($row = mysql_fetch_assoc($dbres)) {
            if ($row['player_is_multiactive'] == 1) {
                $this->multiple_active[] = $row['player_id'];
            }
        }
    }

    /**
     * All playing players are made active. Update notification is sent to all players (this will trigger
     * `onUpdateActionButtons`).
     *
     * Usually, you use this method at the beginning of a game state (e.g., `stGameState`) which transitions to a
     * `multipleactiveplayer` state in which multiple players have to perform some action. Do not use this method if
     * you're going to make some more changes in the active player list. (I.e., if you want to take away
     * `multipleactiveplayer` status immediately afterward, use `setPlayersMultiactive` instead).
     * 
     * 📖 documented function.
     */
    public function setAllPlayersMultiactive()
    {
        /*: void*/
        if ($this->o_game->bIndependantMultiactiveTable) {
            $sql = "UPDATE `playermultiactive` SET `ma_is_multiactive` = 1 WHERE `ma_is_multiactive` = 0";
        } else {
            $sql = "UPDATE `player` SET `player_is_multiactive` = 1 WHERE `player_is_multiactive` = 0";
        }
        self::DbQuery($sql);
        self::updateMultiactiveOrNextState(''); // Not: we are not supposed to go "next step"
    }

    /**
     * All playing players are made inactive. Transition to next state.
     * 
     * 📖 documented function.
     * 
     * @param string|int|class-string<Bga\GameFramework\States\GameState> $next_state the transition name, or state id, or class name if using Class states
     */
    public function setAllPlayersNonMultiactive(/*int|string*/ $next_state)
    {
        /*: bool*/ if ($this->o_game->bIndependantMultiactiveTable) {
            $sql = "UPDATE `playermultiactive` SET `ma_is_multiactive` = 0 WHERE `ma_is_multiactive` != 0";
        } else {
            $sql = "UPDATE `player` SET `player_is_multiactive` = 0 WHERE `player_is_multiactive` != 0";
        }
        self::DbQuery($sql);

        $bGoToNextState = self::updateMultiactiveOrNextState($next_state);

        return $bGoToNextState;
    }

    /**
     * Make a specific list of players active during a multiactive game state. Update notification is sent to all
     * players whose state changed.
     *
     * - "players" is the array of player id that should be made active. If "players" is not empty the value of
     * "next_state" will be ignored (you can put whatever you want).
     * - If "bExclusive" parameter is not set or false it doesn't deactivate other previously active players. If
     * it's set to true, the players who will be multiactive at the end are only these in "$players" array.
     * - In case "players" is empty, the method trigger the "next_state" transition to go to the next game state.
     * 
     * 📖 documented function.
     * 
     * @param int[] $players the players to activate
     * @param string|int|class-string<Bga\GameFramework\States\GameState>|callable $next_state the transition name, or state id, or class name if using Class states
     * @param bool $bInactivePlayersNotOnTheList if the players not in the list should be made inactive
     * @return bool if the call moved to the next state
     */
    public function setPlayersMultiactive(
        /*array*/ $players,
        /*int|string|callable*/ $next_state,
        /*bool*/ $bInactivePlayersNotOnTheList = false,
    ) {
        if (count($players) == 0) {
            if ($this->o_game->bIndependantMultiactiveTable) {
                $sql = "UPDATE `playermultiactive` SET `ma_is_multiactive` = 0 WHERE `ma_is_multiactive` != 0";
            } else {
                $sql = "UPDATE `player` SET `player_is_multiactive` = 0 WHERE `player_is_multiactive` != 0";
            }
            self::DbQuery($sql);
        } else {
            if ($bInactivePlayersNotOnTheList) {
                if ($this->o_game->bIndependantMultiactiveTable) {
                    $sql = "UPDATE `playermultiactive` SET `ma_is_multiactive` = 0 WHERE `ma_is_multiactive` != 0";
                } else {
                    $sql = "UPDATE `player` SET `player_is_multiactive` = 0 WHERE `player_is_multiactive` != 0";
                }
                self::DbQuery($sql);
            }

            if ($this->o_game->bIndependantMultiactiveTable) {
                $sql =
                    "UPDATE `playermultiactive` SET `ma_is_multiactive` = 1 WHERE `ma_is_multiactive` != 1 AND `ma_player_id` IN ('" .
                    implode("','", $players) .
                    "')";
            } else {
                $sql =
                    "UPDATE `player` SET `player_is_multiactive` = 1 WHERE `player_is_multiactive` != 1 AND `player_id` IN ('" .
                    implode("','", $players) .
                    "')";
            }
            self::DbQuery($sql);
        }

        return self::updateMultiactiveOrNextState($next_state); // Not: we are not supposed to go "next step"
    }

    /**
     * During a multi-active game state, make the specified player inactive.
     *
     * Usually, you call this method during a multi-active game state after a player did his action. It is also
     * possible to call it directly from multiplayer action handler. If this player was the last active player, the
     * method trigger the "next_state" transition to go to the next game state.
     * 
     * 📖 documented function.
     * 
     * @param int $player_id the players to make inactive
     * @param string|int|class-string<Bga\GameFramework\States\GameState>|callable $next_state the transition name, or state id, or class name if using Class states
     * @return bool if the call moved to the next state
     */
    public function setPlayerNonMultiactive(/*int*/ $player_id, /*int|string|callable*/ $next_state)
    {
        /*: bool*/ if ($this->o_game->bIndependantMultiactiveTable) {
            $sql = "SELECT `ma_is_multiactive` `player_is_multiactive` FROM `playermultiactive` WHERE `ma_player_id`='$player_id'";
        } else {
            $sql = "SELECT `player_is_multiactive` FROM `player` WHERE `player_id`='$player_id'";
        }

        if (self::getUniqueValueFromDb($sql) != 0) {
            if ($this->o_game->bIndependantMultiactiveTable) {
                $sql = "UPDATE `playermultiactive` SET `ma_is_multiactive` = 0 WHERE `ma_player_id`='$player_id' ";
            } else {
                $sql = "UPDATE `player` SET `player_is_multiactive` = 0 WHERE `player_id`='$player_id' ";
            }
            self::DbQuery($sql);

            $bGoToNextState = self::updateMultiactiveOrNextState($next_state);

            return $bGoToNextState;
        } else {
            return false;
        }
    }

    /**
     * Sends update notification about multiplayer changes. All multiactive set* functions above do that, however if
     * you want to change state manually using db queries for complex calculations, you have to call this yourself
     * after.
     *
     * Do not call this if you're calling one of the other setters above.
     * 
     * 📖 documented function.
     * 
     * @param string|int|class-string<Bga\GameFramework\States\GameState>|callable $next_state the transition name, or state id, or class name if using Class states
     * @return bool if the call moved to the next state
     */
    public function updateMultiactiveOrNextState(/*int|string|callable*/ $next_state_if_none)/*: bool*/
    {
        $bGoToNextState = false;
        self::loadMultipleActive(true);

        self::reflexionTimeUpdate();

        if (count($this->multiple_active) == 0) {
            // Okay, now we now that everyone has set its "player_is_multiactive" to 0, which mean everyone has played.
            // BUT: to go to next state, we have to be sure that all players has commited their play ! Because otherwise
            // there is a big risk that some player's play won't be taken into account !
            // To be sure everything is fine, we wait until the number of active player is really 0 WITHOUT lock in share mode
            // (meaning: all change must have been commited to be seen by this request).
            /*$time_start = microtime(true);
            $bContinue = true;
            while( $bContinue )
            {
                $sql = "SELECT `player_id` FROM `player` WHERE `player_is_multiactive` = 1 ";
                $dbres = self::DbQuery( $sql );
                $wait_for = array();
                while( $row = mysql_fetch_assoc( $dbres ) )
                {
                    $wait_for[] = $row['player_id'];
                }
                if( count( $wait_for ) == 0 )
                {
                    // YES: everyone has really really played, and we can go to next step safely
                    $bContinue = false;
                }
                else
                {
                    $time_current = microtime(true);
                    $time = $time_current - $time_start;
                    if( $time > 5 ) // 5sec
                        throw new feException( "Sorry, 2 players plays exactly at the same moment. Please retry." );
                
                    self::trace( "Detecting that some player(s) (".implode( ",", $wait_for ).") did not have time to commit his play. Waiting ..." );
                    sleep( 1 );
                }
            }*/

            $bGoToNextState = true;

            // The previous approach is not so bad but the problem is we are unable to know from this transaction
            // if the other players transactions has been finished (the query without lock is not realiable enough for this)
            // Then, if we detect this issue, we throw an exception and the player should retry his query.
            if ($this->o_game->bIndependantMultiactiveTable) {
                $sql = "SELECT COUNT( `ma_player_id` ) `cnt` FROM `playermultiactive` WHERE `ma_is_multiactive` = 1 ";
            } else {
                $sql = "SELECT COUNT( `player_id` ) `cnt` FROM `player` WHERE `player_is_multiactive` = 1 ";
            }
            $dbres = self::DbQuery($sql);
            $row = mysql_fetch_assoc($dbres);
            if ($row['cnt'] > 0) {
                // In this case, we treat it as a deadlock
                self::trace('Detecting that some player(s) did not have time to commit his play. Restarting ...');
                sleep(0);
                throw new \feException(
                    'Multiactive player deadlock, restarting action',
                    false,
                    false,
                    \FEX_application_deadlock_restart_transaction,
                );
            }

            $this->o_tableinfos->incGlobal(GAMESTATE_PLAYERTURN_NBR, 1); // We increment this one here cause it's a common path to all multiactive player turn

            $transitionOrState = !is_string($next_state_if_none) && is_callable($next_state_if_none)
                ? \Bga\GameFramework\Table::runGameCode($this->game, $next_state_if_none)
                : $next_state_if_none;

            // redirect to transition, state id of state class
            $this->applyStateHandlerRedirection($transitionOrState);
        } else {
            $this->o_game->notifyAllPlayers('gameStateMultipleActiveUpdate', '', $this->multiple_active);
        }

        self::initiateStartReflexionTime();

        return $bGoToNextState;
    }
    //////////////////////////////////////////////////////////////////////////////////////////////////////
    //////
    //////     REFLEXION TIME MANAGEMENT
    //////

    /**
     * Return the number of seconds between 2 timestamps, taking into account night profile.
     *
     * @param int $start
     * @param int $end
     * @param int $night_profile
     * @return int
     */
    private function deltaBetweenTimestamp(int $start, int $end, int $night_profile): int
    {
        return max(0, $end - $start);
    }

    /**
     * Given a timestamp, add the given number of seconds.
     *
     * @param int $start
     * @param int|null $diff
     * @param int $night_profile
     * @return int
     */
    private function addTimeDeltaToTimestamp(int $start, ?int $diff, int $night_profile): int
    {
        return $start + (int) $diff;
    }

    /**
     * Return the current reflexion-time snapshot as computed by the framework.
     *
     * This reuses the same logic as the regular game-state payload so callers do not have to
     * duplicate the timer computation rules (for example async playing-hours handling).
     *
     * @return array{total: array<string, int|string|null>}
     */
    public function getCurrentReflexionTimeSnapshot(): array
    {
        $this->loadReflexionTime();

        return $this->reflexion_time;
    }

    /**
     * Load current player reflexion time according to current time and remaining reflexion time
     * and place it into private variable
     * (note: these reflexion times are returned to the client in "reflexion" object)
     */
    private function loadReflexionTime(): void
    {
        if ($this->reflexion_time != null) {
            return;
        } // already loads

        $clock_night = 0;
        if ($this->o_game->isAsync()) {
            if (
                isset($this->table_globals[GAMESTATE_CLOCK_NIGHT]) &&
                $this->table_globals[GAMESTATE_CLOCK_NIGHT] != 0
            ) {
                $clock_night = $this->table_globals[GAMESTATE_CLOCK_NIGHT];
            }
        }

        $this->reflexion_time = [
            'total' => [],
        ];

        $sql = "SELECT `player_id`, `player_remaining_reflexion_time`,
                UNIX_TIMESTAMP( `player_start_reflexion_time` ) `start_reflexion_time`, UNIX_TIMESTAMP( NOW() ) `now_time`
                FROM `player` ";
        $dbres = self::DbQuery($sql);
        while ($row = mysql_fetch_assoc($dbres)) {
            $remaining = $row['player_remaining_reflexion_time'];
            if ($row['start_reflexion_time'] != null) {
                // This player is thinking right now => must take into account "start_reflexion_time" for starting point
                $reflexion_for = $this->deltaBetweenTimestamp(
                    $row['start_reflexion_time'],
                    $row['now_time'],
                    $clock_night,
                );

                $remaining -= $reflexion_for;
                $this->reflexion_time['total'][$row['player_id']] = $remaining;
            } else {
                // This player is not thinking right now => take "now" as starting point
                $this->reflexion_time['total'][$row['player_id']] = $remaining;
            }
        }
    }

    /**
     * Increase local value of reflexion time.
     */
    public function incReflexionTime(/*int*/ $player_id, /*int*/ $time, /*?int*/ $max = null)
    {
        if (isset($this->reflexion_time['total'][$player_id])) {
            if ($max === null) {
                $this->reflexion_time['total'][$player_id] += $time;
            } else {
                $this->reflexion_time['total'][$player_id] = min(
                    $max,
                    $this->reflexion_time['total'][$player_id] + $time,
                );
            }
        }
        $this->o_game->notifyAllPlayers('updateReflexionTime', '', [
            'player_id' => $player_id,
            'delta' => $time,
            'max' => $max,
        ]);
    }

    /**
     * This method is called each time game state changed or multiactive players changed (+ all giveExtraTime calls)
     * in order to perform clock's related stuff.
     */
    public function reflexionTimeUpdate()
    {
        /*: void*/
        global $g_config;

        $players = $this->o_game->loadPlayersBasicInfos();
        $players_ids = array_keys($players);
        $players_ids_list = " ('" . implode("','", $players_ids) . "') ";
        $active_players_ids = self::getActivePlayerList();
        $active_players_ids_list = " ('" . implode("','", $active_players_ids) . "') ";

        // Get current reflexion time for all active players at this table
        $sql = "SELECT `player_id`, `player_remaining_reflexion_time`, UNIX_TIMESTAMP( NOW() ) `now`, UNIX_TIMESTAMP( `player_start_reflexion_time` ) `start_reflexion_time`, `player_over_time` 
                FROM `player` ";

        // Note: standard case:
        $sql .= "WHERE `player_start_reflexion_time` IS NOT NULL
            AND `player_remaining_reflexion_time` IS NOT NULL "; // Note: during first load of the page, player_remaining_reflexion_time could be null...

        $dbres = self::DbQuery($sql);

        $clock_night = 0;
        if ($this->o_game->isAsync()) {
            if (
                isset($this->table_globals[GAMESTATE_CLOCK_NIGHT]) &&
                $this->table_globals[GAMESTATE_CLOCK_NIGHT] != 0
            ) {
                $clock_night = $this->table_globals[GAMESTATE_CLOCK_NIGHT];
            }
        }

        $player_to_reflexion_time = [];
        while ($row = mysql_fetch_assoc($dbres)) {
            // If user is no more active, we must
            // substract reflexion_time from player's reflexion time
            $user_id = $row['player_id'];
            $start_reflexion_time = $row['start_reflexion_time'];
            $now = $row['now'];

            $reflexion_time = $this->deltaBetweenTimestamp($start_reflexion_time, $now, $clock_night);

            $move_remaining = $row['player_remaining_reflexion_time'];
            $bPlayerOverTime = $row['player_over_time'] == 1;
            if ($reflexion_time > $move_remaining) {
                // If over the time for this move (note: "time for this move" include "total time"
                if ($bPlayerOverTime) {
                    // This player already gets a clock penalty
                } else if (!$this->o_game->isSoloGame()) {
                    // No clock penalty for solo games
                    // Give a clock penalty
                    $sql = "UPDATE `player` SET `player_over_time` = 1 WHERE `player_id`='$user_id'";
                    self::DbQuery($sql);

                    if (!$this->o_game->bGameAbandonForced) {
                        self::masterNodeRequest('clockPenalty', [
                            'player_id' => $user_id,
                            'table_id' => $this->table_id,
                        ]);
                    }
                }
            }

            if (
                $reflexion_time > $move_remaining &&
                $g_config['no_move_on_extratime'] &&
                !$this->o_game->bThisIsConcede &&
                !$this->o_game->bGameAbandonForced &&
                !$this->o_game->bGameAbandonByTournamentTimeout
            ) {
                throw new \feException(clienttranslate('Time is over!'), true);
            }

            // In any case, update the remaining reflexion time
            // Reset the start reflexion time to "NOW()" to make sure the time is not substracted twice

            $clock_mode = $this->table_globals[GAMESTATE_CLOCK_MODE];

            if ($clock_mode >= 0 && $clock_mode <= 3) {
                // Realtime games, except tournament ones
                // (Note : we always add +1 sec to take into account request time - little help in favor of the players)
                // Important: CANNOT do this for "limited time" (ex: tournament games) because it increases the available time, and the game will be closed by the "endAllGamesThatExceedMaxDuration" tournament cronjob before any players has a negative time.
                if ($reflexion_time >= 1) {
                    $reflexion_time--;
                }
            }

            $sql = "UPDATE `player` SET `player_remaining_reflexion_time`=`player_remaining_reflexion_time`-$reflexion_time, `player_start_reflexion_time`=NOW() WHERE `player_id`='$user_id' ";
            self::DbQuery($sql);

            $player_to_reflexion_time[$user_id] = $reflexion_time;
        }

        $this->reflexion_time = null; // Reset reflexion time

        // Add reflexion time to statistics
        foreach ($player_to_reflexion_time as $player_id => $reflexion_time) {
            $this->o_game->incStat($reflexion_time, 'reflexion_time', $player_id);
        }
    }

    /**
     * update player_start_reflexion_time field in table DB
     * Called at the beginning of a move, in order "player_start_reflexion_time" can be set to "NOW()".
     */
    private function initiateStartReflexionTime(): void
    {
        $active_players_ids = self::getActivePlayerList();
        $active_players_ids_list = " ('" . implode("','", $active_players_ids) . "') ";
        $this->o_game->loadPlayersBasicInfos();

        $sql = 'UPDATE `player` SET `player_start_reflexion_time`=NULL';
        self::DbQuery($sql);

        if (count($active_players_ids) > 0) {
            $sql =
                "UPDATE `player` SET `player_start_reflexion_time`=NOW() 
                    WHERE `player_id` IN " . $active_players_ids_list;
            self::DbQuery($sql);
        }
    }

    /**
     * Returns true if we are on the main state of a multiactive private state.
     */
    private function isPrivateMasterState(): bool
    {
        $currentState = $this->getCurrentMainState();
        if ($currentState->type !== StateType::MULTIPLE_ACTIVE_PLAYER) {
            return false;
        }
        return isset($currentState->initialPrivate);
    }

    /**
     * Load the private states for a multiactive private state.
     */
    private function loadPlayerPrivateStates(bool $bSkipStateArgs = false): void
    {
        $this->playerPrivateStates = [];

        if (sizeof($this->multiple_active) > 0) {
            $sql =
                'SELECT `player_id`, `player_state` FROM `player` WHERE `player_id` IN (' .
                implode(',', $this->multiple_active) .
                ')';
            $dbres = self::DbQuery($sql);
            while ($row = mysql_fetch_assoc($dbres)) {
                $privateStateId = $row['player_state'];
                $playerId = $row['player_id'];

                if ($privateStateId === null) {
                    $this->playerPrivateStates[$playerId] = null;
                } else {
                    if (!array_key_exists($privateStateId, $this->states)) {
                        throw new \feException(
                            "Player {$playerId} is in an unknown private state $privateStateId",
                        );
                    }

                    $state = $this->states[$privateStateId];
                    $this->playerPrivateStates[$playerId] = $state->toArray();
                    $this->playerPrivateStates[$playerId]['id'] = $privateStateId;

                    $hasStateClassArgs = method_exists($state->stateInstance, 'getArgs');
                    if ($hasStateClassArgs) {
                        if (!$bSkipStateArgs) {
                            $this->playerPrivateStates[$playerId]['args'] = $this->getStateClassArgs($state, (int)$playerId);
                            $this->privateStateCacheSkippedArgs = false;
                        } else {
                            $this->privateStateCacheSkippedArgs = true;
                        }
                    }
                }
            }            
        }
    }

    /**
     * This return the private state or null if not initialized or not in private state.
     * 
     * 📖 documented function.
     * 
     * @deprecated use getCurrentState($playerId)
     * 
     * @param int $playerId the current player id
     * @return array the current private state for the player as an array
     */
    public function getPrivateState(/*int*/ $playerId)/*: ?array*/
    {
         $gamestate = $this->state(); // needed for private_states

        if (!isset($gamestate['private_states'])) {
            return null; // no private states on this state
        }
        if (!isset($gamestate['private_states'][$playerId])) {
            return null; // this player is not in a private state
        }

        return $gamestate['private_states'][$playerId];
    }

    /**
     * Players with specified ids will transition to next private state specified by provided transition.
     * Same considerations apply as for the method above.
     * 
     * 📖 documented function.
     *
     * @param array<int> $playerIds the player ids to transition
     * @param string|int|class-string<Bga\GameFramework\States\GameState> $transition the transition name, or state id, or class name if using Class states
     */
    public function nextPrivateStateForPlayers(/*array*/ $playerIds, /*int|string*/ $transition)/*: void*/
    {
        foreach ($playerIds as $playerId) {
            $this->nextPrivateState($playerId, $transition);
        }
    }

    /**
     * All active players will transition to next private state by specified transition.
     *
     * - Note: game needs to be in a master state which allows private parallel states
     * - Note: transition should lead to another private state (i.e. a state with type defined as 'private'
     * - Note: transition should be defined in private state in which the players currently are.
     * - Note: this method can run action or args methods of the target state
     * - Note: this is usually used after initializing the private state to move players to specific private state
     * according to the game logic
     * 
     * 📖 documented function.
     * 
     * @param string|int|class-string<Bga\GameFramework\States\GameState> $transition the transition name, or state id, or class name if using Class states
     */
    public function nextPrivateStateForAllActivePlayers(/*int|string*/ $transition)/*: void*/
    {
        if ($this->multiple_active == null) {
            $this->loadMultipleActive(false);
        }
        $ids = $this->multiple_active;
        $this->nextPrivateStateForPlayers($ids, $transition);
    }

    /**
     * Player with specified id will transition to next private state specified by provided transition.
     *
     * - Note: game needs to be in a master state which allows private parallel states
     * - Note: transition should lead to another private state (i.e. a state with type defined as 'private'
     * - Note: transition should be defined in private state in which the players currently are.
     * - Note: this method can run action or args methods of the target state for specified player
     * - Note: this is usually used after some player actions to move to next private state
     * 
     * 📖 documented function.
     * 
     * @param int $playerId the player id
     * @param string|int|class-string<Bga\GameFramework\States\GameState> $transition the transition name, or state id, or class name if using Class states
     */
    public function nextPrivateState(/*int*/ $playerId, /*int|string*/ $transition)/*: void*/
    {
        if (!$this->isPrivateMasterState()) {
            throw new \feException(
                'Private state can only be changed in a multiactive state with initialprivate parameter',
            );
        }

        if (gettype($transition) === 'string') {
            if (str_starts_with($transition, 'Bga\Games')) {
                // it's a state class name, so we redirect to corresponding state
                $newStateId = $this->getStateIdByClassName($transition);
            } else if (is_numeric($transition)) {
                $newStateId = (int) $transition;
            } else {
                $currentState = $this->getCurrentState($playerId);

                if (!isset($currentState->transitions[$transition])) {
                    throw new \feException("Transition '$transition' does not exist in private state {$currentState->name}");
                }

                $newStateId = $currentState->transitions[$transition];

                if (!isset($this->states[$newStateId])) {
                    throw new \feException(
                        "Transition '$transition' in {$currentState->name} lead to a non-existing state $newStateId",
                    );
                }
            }
        } else if (gettype($transition) === 'integer') {
            $newStateId = $transition;
        }

        $this->setPrivateState($playerId, $newStateId);
    }

    /**
     * For player with specified id a new private state would be set.
     *
     * - Note: game needs to be in a master state which allows private parallel states
     * - Note: this should be rarely used as it doesn't check if the transition is allowed (it doesn't even specify
     * transition). This can be useful in very complex cases when standard state machine is not adequate (i.e.
     * specific cards can lead to some micro action in various states where defining transitions back and forth can
     * become very tedious.)
     * - Note: this method can run action or args methods of the target state for specified player
     * 
     * 📖 documented function.
     * 
     * @param int $playerId the player id
     * @param int $newStateId the new state id
     */
    public function setPrivateState(/*int*/ $playerId, /*int*/ $newStateId)/*: void*/
    {
        if (gettype($newStateId) === 'string') {
            if (str_starts_with($newStateId, 'Bga\Games')) {
                // it's a state class name, so we redirect to corresponding state
                $newStateId = $this->getStateIdByClassName($newStateId);
            } else if (is_numeric($newStateId)) {
                $newStateId = (int) $newStateId;
            } else {
                throw new \feException("setPrivateState must be called with a state id or a state class, called with '$newStateId'");
            }
        }

        if (!array_key_exists($newStateId, $this->states)) {
            throw new \feException("State $newStateId doesn't exists");
        }

        $newState = $this->states[$newStateId];
        if ($newState->type != StateType::PRIVATE) {
            throw new \feException("State $newStateId is not defined as a private state");
        }

        self::DbQuery("UPDATE `player` SET `player_state` = $newStateId WHERE `player_id` = $playerId");

        if ($this->playerPrivateStates == null) {
            $this->playerPrivateStates = [];
        }

        $this->playerPrivateStates[$playerId] = $newState->toArray();
        $this->playerPrivateStates[$playerId]['id'] = $newStateId;

        // Call action if it exists
        $changedState = $this->runStateClassOnEnteringState($newState, [], $playerId);
        // If another transition occured while computing this action, no need to compute the args and send notification
        if ($changedState === true) {
            return;
        }

        // Compute args if any provided
        $this->playerPrivateStates[$playerId]['args'] = $this->getStateClassArgs($newState, (int)$playerId);

        if (!($this->playerPrivateStates[$playerId]['args']['_no_notify'] ?? false)) {
            // Update state and args on UI using notification
            $this->o_game->notifyPlayer($playerId, 'newPrivateState', '', [
                'id' => $newStateId,
                'args' => $this->playerPrivateStates[$playerId]['args'],
            ]);
        }
    }

    /**
     * All active players in a multiactive state are entering a first private state defined in the master state's
     * initialprivate parameter.
     *
     * Every time you need to start a private parallel states you need to call this or similar methods below.
     *
     * - Note: at least one player needs to be active (see above) and current game state must be a multiactive state
     * with initialprivate parameter defined
     * - Note: initialprivate parameter of master state should be set to the id of the first private state. This
     * private state needs to be defined in states.php with the type set to 'private'.
     * - Note: this method is usually preceded with activating some or all players
     * - Note: initializing private state can run action or args methods of the initial private state
     * 
     * 📖 documented function.
     */
    public function initializePrivateStateForAllActivePlayers()/*: void*/
    {
        if ($this->multiple_active == null) {
            $this->loadMultipleActive(false);
        }
        $ids = $this->multiple_active;
        $this->initializePrivateStateForPlayers($ids);
    }

    /**
     * Players with specified ids are entering a first private state defined in the master state initialprivate
     * parameter.
     * 
     * 📖 documented function.
     *
     * @param array<int> $playerIds
     */
    public function initializePrivateStateForPlayers(/*array*/ $ids)/*: void*/
    {
        foreach ($ids as $id) {
            $this->initializePrivateState($id);
        }
    }

    /**
     * Player with the specified id is entering a first private state defined in the master state initial private
     * parameter.
     *
     * Everytime you need to start a private parallel states you need to call this or similar methods above
     *
     * - Note: player needs to be active (see above) and current game state must be a multiactive state with initial
     * private parameter defined
     * - Note: initial private parameter of master state should be set to the id of the first private state. This
     * private state needs to be defined in states.php with the type set to 'private'.
     * - Note: this method is usually preceded with activating that player
     * - Note: initializing private state can run action or args methods of the initial private state
     * 
     * 📖 documented function.
     *
     * @param int $playerId
     */
    public function initializePrivateState(/*int*/ $playerId)/*: void*/
    {
        if (!$this->isPrivateMasterState()) {
            throw new \feException(
                'Private state can only be changed in a multiactive state with initialprivate parameter',
            );
        }

        $initialStateId = $this->getCurrentMainState()->initialPrivate;

        $this->setPrivateState($playerId, $initialStateId);
    }

    /**
     * For player with specified id private state will be reset to null, which means they will get out of private
     * parallel states and be in a master state like the private states are not used.
     *
     * - Note: game needs to be in a master state which allows private parallel states
     * - Note: this is usually used when deactivating player to clean up their parallel state
     * - Note: After unseating private state only actions on master state are possible
     * - Note: Usually it is not necessary to unset private state as it will be initialized to first private state
     * when private states are needed again. Nevertheless, it is generally better to clean private state when not
     * needed to avoid bugs.
     * 
     * 📖 documented function.
     *
     * @param int $playerId
     */
    public function unsetPrivateState(/*int*/ $playerId)/*: void*/
    {
        if (!$this->isPrivateMasterState()) {
            throw new \feException(
                'Private state can only be changed in a multiactive state with initialprivate parameter',
            );
        }

        self::DbQuery("UPDATE `player` SET `player_state` = null WHERE `player_id` = $playerId");
    }

    /**
     * For players with specified ids private state will be reset to null, which means they will get out of private
     * parallel states and be in a master state like the private states are not used.
     * 
     * 📖 documented function.
     *
     * @param array<int> $playerIds
     */
    public function unsetPrivateStateForPlayers(/*array*/ $ids)/*: void*/
    {
        if (!$this->isPrivateMasterState()) {
            throw new \feException(
                'Private state can only be changed in a multiactive state with initialprivate parameter',
            );
        }

        $ids = explode(',', $ids);

        self::DbQuery("UPDATE `player` SET `player_state` = null WHERE `player_id` in ($$ids)");
    }

    /**
     * All players private state will be reset to null, which means they will get out of private parallel states and
     * be in a master state like the private states are not used.
     *
     * - Note: game needs to be in a master state which allows private parallel states
     * - Note: this is usually used to clean up after leaving a master state in which private states were used, but
     * can be used in other cases when we want to exit private parallel states and use a regular multiactive state
     * for all players
     * - Note: After unseating private state only actions on master state are possible
     * - Note: Usually it is not necessary to unset private states as they will be initialized to first private
     * state when private states are needed again. Nevertheless, it is generally better to clean private state after
     * exiting private parallel states to avoid bugs.
     */
    public function unsetPrivateStateForAllPlayers()/*: void*/
    {
        if (!$this->isPrivateMasterState()) {
            throw new \feException(
                'Private state can only be changed in a multiactive state with initialprivate parameter',
            );
        }

        self::DbQuery('UPDATE `player` SET `player_state` = null');
    }

    /**
     * Returns the game states as an array. Used for the front side.
     * 
     * 📖 documented function.
     * 
     * @return array<array> the states, typed as arrays.
     */
    public function getStatesAsArray(): array {
        return array_map(fn($state) => $state->toArray(), $this->states);
    }

    /**
     * Returns the current state for a player. If the player is in private parallel state, it means the current private state for this player.
     * 
     * 📖 documented function.
     * 
     * @param int $playerId the current player id
     * @return GameState the game state the player is in
     */
    public function getCurrentState(?int $playerId): ?GameState {
        return $this->states[$this->getCurrentStateId($playerId)] ?? null;
    }

    /**
     * Returns the current state class instance for a player. If the player is in private parallel state, it means the current private state for this player.
     * 
     * 📖 documented function.
     * 
     * @param int $playerId the current player id
     * @return ?States\GameState the game state class instance the player is in
     */
    public function getCurrentStateClass(?int $playerId): ?States\GameState {
        return $this->getCurrentState($playerId)?->stateInstance;
    }

    /**
     * Returns the current state id for a player. If the player is in private parallel state, it means the current private state for this player.
     * 
     * 📖 documented function.
     * 
     * @param int $playerId the current player id
     * @return int the game state id the player is in
     */
    public function getCurrentStateId(?int $playerId): ?int {
        if (!$playerId || !$this->isPrivateMasterState()) {
            return $this->getCurrentMainStateId();
        }
        if ($this->multiple_active == null) {
            $this->loadMultipleActive(false);
        }
        if (!in_array($playerId, $this->multiple_active)) {
            return $this->getCurrentMainStateId();
        }
        $privateStateId = $this->getUniqueValueFromDB("SELECT `player_state` FROM `player` WHERE `player_id` = {$playerId}");
        if (!$privateStateId) {
            return $this->getCurrentMainStateId();
        }
        if (!array_key_exists($privateStateId, $this->states)) {
            throw new \feException(
                "Player {$playerId} is in an unknown private state $privateStateId",
            );
        }
        return (int)$privateStateId;
    }

    /**
     * Returns the current main state, ignoring private parallel states.
     * 
     * 📖 documented function.
     * 
     * @return GameState the current main game state (ignoring private states)
     */
    public function getCurrentMainState(): ?GameState {
        return $this->states[$this->getCurrentMainStateId()] ?? null;
    }

    /**
     * Returns the current main state class instance, ignoring private parallel states.
     * 
     * 📖 documented function.
     * 
     * @return ?States\GameState the current main game state class instance (ignoring private states)
     */
    public function getCurrentMainStateClass(): ?States\GameState {
        return $this->getCurrentMainState()?->stateInstance;
    }

    /**
     * Returns the current main state id, ignoring private parallel states.
     * 
     * 📖 documented function.
     * 
     * @return int the current main game state id (ignoring private states)
     */
    public function getCurrentMainStateId(): ?int {
        return $this->currentStateId;
    }

    /**
     * Run a State Handler state initialization (a function called `onEnteringState`) when entering the state.
     * Return the result of the state handler
     */
    public function runStateClassOnEnteringState(GameState $state, array $stateArgs, ?int $privateStatePlayerId = null): mixed {
        $reflection = new \ReflectionClass($state->stateInstance);

        $functionName = 'onEnteringState';

        if (!$reflection->hasMethod($functionName)) {
            return null;
        }

        $method = $reflection->getMethod($functionName);
        $parameters = $method->getParameters();

        $functionParameters = [];
        foreach ($parameters as $index => $parameter) {
            $paramName = $parameter->getName();
            $paramType = $parameter->getType()->getName();
            if (in_array($paramName, ['arg', 'args']) && $paramType === 'array') {
                $functionParameters[] = $privateStatePlayerId !== null ? $this->getStateClassArgs($state, $privateStatePlayerId) : $stateArgs;
            } else if (in_array($paramName, ['playerNo', 'player_no', 'currentPlayerNo', 'current_player_no']) && $paramType === 'int') {
                $functionParameters[] = (int)$this->o_game->getPlayerNoById($privateStatePlayerId);
            } else if (in_array($paramName, ['playerId', 'player_id', 'currentPlayerId', 'current_player_id']) && $paramType === 'int') {
                $functionParameters[] = $privateStatePlayerId;
            } else if (in_array($paramName, ['activePlayerNo', 'active_player_no']) && $paramType === 'int') {
                $functionParameters[] = (int)$this->o_game->getPlayerNoById((int)$this->o_game->getActivePlayerId());
            } else if (in_array($paramName, ['activePlayerId', 'active_player_id']) && $paramType === 'int') {
                $functionParameters[] = (int)$this->o_game->getActivePlayerId();
            }

            if (count($functionParameters) <= $index) { // nothing matching the param
                throw new \BgaSystemException("Unknown '$paramType $paramName' parameter on $functionName function for state class ".get_class($state->stateInstance));
            }
        }

        $result = \Bga\GameFramework\Table::runGameCode($this->game, fn() => $state->stateInstance->$functionName(...$functionParameters));

        return $result;
    }

    /**
     * Returns the State Handler args.
     */
    public function getStateClassArgs(GameState $state, ?int $privateStatePlayerId = null): mixed {
        $reflection = new \ReflectionClass($state->stateInstance);

        $functionName = 'getArgs';

        if (!$reflection->hasMethod($functionName)) {
            return [];
        }

        $method = $reflection->getMethod($functionName);
        $parameters = $method->getParameters();

        $functionParameters = [];
        foreach ($parameters as $index => $parameter) {
            $paramName = $parameter->getName();
            $paramType = $parameter->getType()->getName();
            if (in_array($paramName, ['playerNo', 'player_no', 'currentPlayerNo', 'current_player_no']) && $paramType === 'int') {
                $functionParameters[] = (int)$this->o_game->getPlayerNoById($privateStatePlayerId);
            } else if (in_array($paramName, ['playerId', 'player_id', 'currentPlayerId', 'current_player_id']) && $paramType === 'int') {
                $functionParameters[] = $privateStatePlayerId;
            } else if (in_array($paramName, ['activePlayerNo', 'active_player_no']) && $paramType === 'int') {
                $functionParameters[] = (int)$this->o_game->getPlayerNoById((int)$this->o_game->getActivePlayerId());
            } else if (in_array($paramName, ['activePlayerId', 'active_player_id']) && $paramType === 'int') {
                $functionParameters[] = (int)$this->o_game->getActivePlayerId();
            }

            if (count($functionParameters) <= $index) { // nothing matching the param
                throw new \BgaSystemException("Unknown '$paramType $paramName' parameter on $functionName function for state class ".get_class($state->stateInstance));
            }
        }

        $result = \Bga\GameFramework\Table::runGameCode($this->game, fn() => $state->stateInstance->$functionName(...$functionParameters));

        return $result;
    }

    /**
     * Run a State Handler state zombie function.
     * Use its return with applyStateHandlerRedirection to redirect to the next state.
     * 
     * 📖 documented function (for debug purposes only).
     */
    public function runStateClassZombie(GameState $state, int $playerId): void {
        $reflection = new \ReflectionClass($state->stateInstance);

        $functionName = 'zombie';

        if (!$reflection->hasMethod($functionName)) {
            return;
        }

        $method = $reflection->getMethod($functionName);
        $parameters = $method->getParameters();

        $functionParameters = [];
        foreach ($parameters as $index => $parameter) {
            $paramName = $parameter->getName();
            if ($index === 0) {
                if (in_array($paramName, ['playerNo', 'player_no', 'currentPlayerNo', 'current_player_no', 'activePlayerNo', 'active_player_no'])) {
                    $functionParameters[] = (int)$this->o_game->getPlayerNoById($playerId);
                } else {
                    $functionParameters[] = $playerId;
                }
                continue; // first parameter should always be the zombie player id or zombie player no
            }
            $paramType = $parameter->getType()->getName();
            if (in_array($paramName, ['arg', 'args']) && $paramType === 'array') {
                $stateArgs = $this->getStateClassArgs($state, $playerId);
                $functionParameters[] = $stateArgs;
            }

            if (count($functionParameters) <= $index) { // nothing matching the param
                throw new \BgaSystemException("Unknown '$paramType $paramName' parameter on $functionName function for state class ".get_class($state->stateInstance));
            }
        }

        $result = \Bga\GameFramework\Table::runGameCode($this->game, fn() => $state->stateInstance->$functionName(...$functionParameters));
        
        if (!$state->isLegacyGameState) {
            $this->applyStateHandlerRedirection($result);
        }
    }

    /**
     * Redirect after a state action, a player action or a zombie function, based on the result.
     * If the result is a string, call the returned transition.
     * If the result is a number, jump to the returned state id.
     */
    public function applyStateHandlerRedirection(mixed $result) {
        if ($result instanceof \Bga\GameFramework\GameResult\GameResult) {
            $this->o_game->bgaSetGameResult($result);
            $this->jumpToState(99);
        } else if (gettype($result) === 'string') {
            if (str_starts_with($result, 'Bga\Games')) {
                // it's a state class name, so we redirect to corresponding state
                $this->jumpToState($this->getStateIdByClassName($result));
            } else {
                $this->nextState($result);
            }
        } else if (gettype($result) === 'integer') {
            $this->jumpToState($result);
        }
    }

    /**
     * Scan the modules/php/States dir of the game, to load the states in it.
     */
    protected function addGameStateClasses(string $gameName): void {
        $statesDir = APP_GAMES_PATH . $gameName . '/current/modules/php/States';
        if (!is_dir($statesDir)) {
            return;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($statesDir, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $fileInfo) {
            if (!$fileInfo->isFile() || $fileInfo->getExtension() !== 'php') {
                continue;
            }

            $filePath = $fileInfo->getPathname();
            $relativePath = substr($filePath, strlen($statesDir) + 1);
            $relativeDir = dirname($relativePath);
            $expectedNamespace = "Bga\\Games\\$gameName\\States";
            if ($relativeDir !== '.') {
                $expectedNamespace .= '\\' . str_replace(DIRECTORY_SEPARATOR, '\\', $relativeDir);
            }

            $filePhpTokens = token_get_all(file_get_contents($filePath));
            $isTrait = array_any($filePhpTokens, fn($token) => $token[0] === T_TRAIT);
            if ($isTrait) {
                continue; // ignore files that contains a Trait
            }

            // check the namespace of the file, throw an exception if it doesn't match expected
            $namespaceTokenKey = array_find_key($filePhpTokens, fn($token) => $token[0] === T_NAMESPACE);
            if (!$namespaceTokenKey) {
                throw new \BgaSystemException("State class modules/php/States/$relativePath should be of namespace $expectedNamespace (no namespace found)");
            } else {
                $foundNamespace = $filePhpTokens[$namespaceTokenKey + 2][1];
                if (strtolower($foundNamespace) !== strtolower($expectedNamespace)) {
                    throw new \BgaSystemException("State class modules/php/States/$relativePath should be of namespace $expectedNamespace (found $foundNamespace)");
                }
            }

            // try to load the file, and returns an exception if the class name is not the expected one or it's not extending framework States\GameState class
            $stateClassName = "\\$expectedNamespace\\" . $fileInfo->getBasename('.php');
            if (!class_exists($stateClassName)) {
                throw new \BgaSystemException("Class $stateClassName not found in modules/php/States/$relativePath, make sure the class name is the same as the filename");
            }
            if ((new \ReflectionClass($stateClassName))->isAbstract()) {
                continue;
            }
            if (!is_subclass_of($stateClassName, States\GameState::class)) {
                throw new \BgaSystemException("Class $stateClassName does not extends \Bga\GameFramework\States\GameState");
            }

            $this->addGameStateClass($stateClassName);
        }
    }

    /**
     * Load a state class and add it to the states array.
     */
    protected function addGameStateClass(string $stateClassName): void {
        $stateInstance = new $stateClassName($this->o_game);

        if ($stateInstance->id === null) {
            /*
            // no specified id, assign the first available
            // technically we can do that, but as we store current state by its id, 
            // if we release a new version of a running game and it shift some state ids, it will break the game!
            $availableId = 2;
            while (array_key_exists($availableId, $this->states)) {
                $availableId++;
                if ($availableId === 99) {
                    $availableId++;
                }
            }
            $stateInstance->id = $availableId;*/
            throw new \BgaSystemException("An id is required for state class $stateClassName");
        } else {
            if ($stateInstance->id <= 1 || $stateInstance->id === 99) {
                throw new \BgaSystemException("Invalid id for state class $stateClassName (1 and 99 are reserved)");
            }

            if (array_key_exists($stateInstance->id, $this->states)) {
                throw new \BgaSystemException("Invalid id for state class $stateClassName (already used by another state)");
            }
        }

        if ($stateInstance->type === null) {
            throw new \BgaSystemException("The type is mandatory for state class $stateClassName");
        } else if ($stateInstance->type === StateType::MANAGER) {
            throw new \BgaSystemException("Invalid type for state class $stateClassName, use GAME instead of MANAGER");
        }

        $stateInstanceReflection = new \ReflectionClass($stateInstance);

        $hasZombieFunction = $stateInstanceReflection->hasMethod('zombie') && $stateInstanceReflection->getMethod('zombie')->isPublic();
        
        if ($stateInstance->type === StateType::GAME && $hasZombieFunction) {
            throw new \BgaSystemException("No need for zombie function for state class $stateClassName as it's a GAME state");
        }

        $mustHaveZombieFunction = $stateInstance->type !== StateType::GAME;
        if ($stateInstance->type === StateType::MULTIPLE_ACTIVE_PLAYER && $stateInstance->initialPrivate !== null) {
            $mustHaveZombieFunction = false;
        }
        if ($mustHaveZombieFunction && !$hasZombieFunction) {
            throw new \BgaSystemException("A zombie function is needed for state class $stateClassName");
        }

        // find all public methods that have the PossibleAction attribute
        $possibleActions = [];
        foreach ($stateInstanceReflection->getMethods(\ReflectionMethod::IS_PUBLIC) as $method) {
            $attributes = $method->getAttributes(\Bga\GameFramework\States\PossibleAction::class);
            if (!empty($attributes)) {
                $possibleActions[] = $method->getName();
            }
        }

        // we don't map initialPrivate here, it will be mapped in mapInitialPrivateStates called when all states are loaded
        $this->states[$stateInstance->id] = GameStateBuilder::create()
            ->name($stateInstance->getName())
            ->type($stateInstance->type)
            ->description($stateInstance->description)
            ->descriptionMyTurn($stateInstance->descriptionMyTurn)
            ->possibleActions($possibleActions)
            ->transitions($stateInstance->transitions)
            ->updateGameProgression($stateInstance->updateGameProgression)
            ->build();

        $this->states[$stateInstance->id]->stateInstance = $stateInstance;
    }

    /**
     * When all states are loaded, we can set the $state->initialPrivate values (int expected) based on the state class (that might contain an int or a state class name)
     */
    protected function mapInitialPrivateStates() {
        foreach($this->states as &$state) {
            if ($state->stateInstance->initialPrivate !== null && $state->initialPrivate === null) {
                if (gettype($state->stateInstance->initialPrivate) === 'string') {
                    if (str_starts_with($state->stateInstance->initialPrivate, 'Bga\Games')) {
                        // it's a state class name, so we redirect to corresponding state
                        $state->initialPrivate = $this->getStateIdByClassName($state->stateInstance->initialPrivate);
                    } else {
                        throw new \feException("initialPrivate must be declared with a state id or a state class, declared with '{$state->stateInstance->initialPrivate}'");
                    }
                } else {
                    $state->initialPrivate = $state->stateInstance->initialPrivate;
                }
            }
        }
    }

    /**
     * Initialize the state instance for a game state (from states.inc.php).
     */
    public function initLegacyStateClass(int $stateId, GameState $gameState) {
        $gameState->isLegacyGameState = true;
        $gameState->stateInstance = new States\LegacyGameState($this->o_game, $stateId, $gameState);
    }

    /**
     * Returns a State class instance by its class name.
     */
    public function getStateClassByClassName(string $stateClassName): ?States\GameState {
        $stateId = $this->getStateIdByClassName($stateClassName);
        return $stateId === null ? null : $this->states[$stateId]->stateInstance;
    }

    /**
     * Returns a State id by its class name.
     */
    function getStateIdByClassName(string $stateClassName): ?int {
        $cleanStateClassName = str_replace('\\', '', strtolower($stateClassName));
        foreach ($this->states as $id => $state) {
            if ($state->stateInstance !== null) {
                $currentStateClassName = get_class($state->stateInstance);
                if (str_replace('\\', '', strtolower($currentStateClassName)) === $cleanStateClassName) {
                    return $id;
                }
            }
        }
        return null;
    }

    public function getTransitionDepth(): int
    {
        return $this->nested_jumptostate;
    }

    public function getStateId(): int
    {
        return (int) $this->currentStateId;
    }

    public function getAllStatesForClient(): array
    {
        return $this->getStatesAsArray();
    }
}
