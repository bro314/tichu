<?php
declare(strict_types=1);

namespace Bga\GameFramework;

use \Bga\GameFramework\Actions\CheckAction;
use \Bga\GameFramework\Actions\Types\ActionType;
use \Bga\GameFramework\Actions\Types\IntParam;
use \Bga\GameFramework\Actions\Types\BoolParam;
use \Bga\GameFramework\Actions\Types\FloatParam;
use \Bga\GameFramework\Actions\Types\JsonParam;
use \Bga\GameFramework\Actions\Types\StringParam;
use \BgaSystemException;

/**
 * Base class for every game action.
 * This class might be used as a parent for custom action classes in <gamename>.action.php.
 */
class GameAction extends \APP_Action
{
    protected string $gameName = 'tichu';
    /**
     * @var ?Table
     */
    protected /*?Table*/ $game = null;
    protected mixed $gamePageAction = null;
    
    // Constructor
    function __construct(mixed $game = null, array $args = [])
    {
        if ($game !== null) {
            $this->game = $game;
        }
        parent::__construct($args);
    }
    
    public function initGameObject(string $gameName, /*Table*/ $game, mixed $gamePageAction = null): void {
        $this->gameName = $gameName;
        $this->game = $game;
        $this->gamePageAction = $gamePageAction;
    }

    public function setAjaxMode($bCheckCsrf = true): void
    {
        if ($this->game !== null) {
            $this->game->beginPlayerAction();
        }
    }

    /**
     * ajaxResponse for games: cannot return any response.
     * (Note: errors are signaled with exceptions)
     */
    protected function ajaxResponse( $data = '' ) {
        if ($data != '') {
            throw new \feException('Game action cannot return any data', false, false);
        }

        if ($this->game !== null) {
            $this->game->endPlayerAction();
        }
        if ($this->gamePageAction !== null) {
            $this->gamePageAction->ajaxResponseWithResult(null);
        }
    }

    /**
     * Games are not supposed to return any value, but some do, so we must keep this function.
     * terraformingmars/memoir/unconditionalsurrender/spaceempires/kingdomino/galacticera/eminentdomain/altered
     */
    protected function ajaxResponseWithResult($result) {
        if ($this->game !== null) {
            $this->game->endPlayerAction();
        }
        if ($this->gamePageAction !== null) {
            $this->gamePageAction->ajaxResponseWithResult($result);
        }
    }

    private function bgaGetDefaultActionType(string $phpType, string $method): ActionType {
        switch ($phpType) {
            case 'int':
                return new IntParam();
            case 'bool':
                return new BoolParam();
            case 'float':
            case 'double':
                return new FloatParam();
            case 'string':
                return new StringParam();
            default:
                throw new \BadMethodCallException("$method parameter type $phpType is not supported by action autowiring function, you need to specify a Param type");
        }
    }

    private function bgaGetParameterValue(\ReflectionParameter $param, string $method): mixed {
        // first, try to find an attribute to read the parameter
        $attrs = $param->getAttributes();
        $typeAttribute = null;
        foreach ($attrs as $attributeReflection) {
            $attribute = $attributeReflection->newInstance();
            if ($attribute instanceof ActionType) {
                $typeAttribute = $attribute;
                break;
            }
        }

        $paramName = $typeAttribute?->name ?? $param->name;
        
        $paramType = $param->getType() instanceof \ReflectionNamedType ? $param->getType()->getName() : null;
        if (in_array($paramName, ['currentPlayerNo', 'current_player_no']) && $paramType === 'int') {
            return (int)$this->game->getPlayerNoById((int)$this->getCurrentPlayerId());
        } else if (in_array($paramName, ['currentPlayerId', 'current_player_id']) && $paramType === 'int') {
            return (int)$this->getCurrentPlayerId();
        } else if (in_array($paramName, ['activePlayerNo', 'active_player_no']) && $paramType === 'int') {
            return (int)$this->game->getPlayerNoById((int)$this->game->getActivePlayerId());
        } else if (in_array($paramName, ['activePlayerId', 'active_player_id']) && $paramType === 'int') {
            return (int)$this->game->getActivePlayerId();
        } else if (in_array($paramName, ['arg', 'args']) && $paramType === 'array') {
            $currentPlayerId = (int)$this->getCurrentPlayerId();
            $state = $this->game->gamestate->getCurrentState($currentPlayerId);
            return $this->game->gamestate->getStateClassArgs($state, $currentPlayerId);
        } else if (!$this->isArg($paramName) || $this->getRawArgValue($paramName) === null) {
            // handle inexistant / null values
            if ($param->isDefaultValueAvailable()) {
                return $param->getDefaultValue();
            } else if ($param->allowsNull()) {
                return null;
            } else {
                throw new \BadMethodCallException("$method parameter $paramName is mandatory");
            }
        }

        // if there is no attribute, we define a default one based on the PHP type
        if ($typeAttribute === null) {
            if ($param->getType() === null) {
                throw new \BadMethodCallException("$method parameter $paramName type is not defined");
            }
            if (!($param->getType() instanceof \ReflectionNamedType)) {
                throw new \BadMethodCallException("$method parameter $paramName is not a simple type and is not supported by action autowiring function, you need to declare the $method method in .action.php");
            }

            // getType is instanceof ReflectionNamedType in this case
            // the function will return an exception if the type is not a basic one
            $typeAttribute = $this->bgaGetDefaultActionType($param->getType()->getName(), $method);
        }

        // if the dev write ` #[JsonParam] Obj $object`, add the class Obj to the JsonParam attribute automatically
        if (
            $typeAttribute instanceof JsonParam
            && $param->getType() instanceof \ReflectionNamedType
            && !$param->getType()->isBuiltin()
            && $typeAttribute->class === null
        ) {
            $typeAttribute->class = $param->getType()->getName();
        }

        return $typeAttribute->getValue($paramName);
    }

	public function performServerAction(string $action): void {
        if (str_starts_with($action, 'debug_') && !(new \Bga\Config\ServerConfig())->areGameDebugToolsEnabled()) {
            throw new \BadMethodCallException("Debug functions are not active in this environment");
        }
        // if the function exists in the .action.php file, just call it
        if (method_exists($this, $action)) {
		    $this->$action();
            return;
        }
        
        $actFunction = str_starts_with($action, 'act');
        $debugFunction = str_starts_with($action, 'debug_');
        if (!$actFunction && !$debugFunction) {
            // only methods starting with `act` or `debug_` can be automatically wired to .game.php, to prevent the front to calling any function by requesting game/game/changeActivePlayer.php for example
            // idea of enhancement : also allow a #[DebugFunction] instead of the `debug_` prefix.
            throw new \BadMethodCallException("$action method is not defined in .action.php . Don't forget to add prefix 'act' for auto-wiring!");
        }

        $state = $this->game->gamestate->getCurrentState($this->getCurrentPlayerId());
        $actionHandler = $state->stateInstance;
        if ($debugFunction || $state->isLegacyGameState || !method_exists($state->stateInstance, $action)) {
            // debug functions are not linked to a particular state, so they are defined in the main game class
            // legacy game states don't define the functions, they are still in the main game class
            // if the action doesn't exists in the state class, we fallback to the game class
            $actionHandler = $this->game;
        }

        if (!method_exists($actionHandler, $action)) {
            throw new \BadMethodCallException("$action method is not defined in this game");
        }

        $reflectionMethod = new \ReflectionMethod($actionHandler, $action);

        // if it's an action, check if it's in possibleActions, unless the dev disabled the check with `#[CheckAction(false)]`
        if ($actFunction) {
            // Get the first CheckAction attribute (if any)
            $attributes = $reflectionMethod->getAttributes(CheckAction::class);
            $checkActionAttribute = count($attributes) > 0 ? $attributes[0]?->newInstance() : null;

            // Perform the action check if enabled
            if ($checkActionAttribute?->enabled ?? true) {
                $this->game->checkAction($action);
            }
        }
        if ($debugFunction) {
            $this->game->bga->debug->setExecutingDebugAction();
        }

        $this->setAjaxMode();
        // auto-wiring is valid, we call the requested function with the REQUEST parameters using the parameter typing
        $params = $reflectionMethod->getParameters();
        ActionType::setRawValueResolver(fn(string $paramName) => $this->getRawArgValue($paramName));
        try {
            $args = array_map(fn($param) => $this->bgaGetParameterValue($param, $action), $params);
        } finally {
            ActionType::setRawValueResolver(null);
        }

        $result = $actionHandler->$action(...$args);
        if (!$state->isLegacyGameState) {
            // Use its return with applyStateHandlerRedirection to redirect to the next state.
            $this->game->gamestate->applyStateHandlerRedirection($result);
        }

        $this->ajaxResponse();
	}

    /**
     * Get the player id of the player requesting the action.
     */
    protected function getCurrentPlayerId(): int
    {
        global $g_user;
        return (int)$g_user->get_id(false, false);
    }
    
    /**
     * DB functions, that should not be called in the action.php file of the games
     */

  	static function ConnectDb()
  	{
        throw new BgaSystemException("The action.php file should use the game class to access the database");
  	}

    static public function DbQuery( $sql, $specific_db=null )
  	{
        throw new BgaSystemException("The action.php file should use the game class to access the database");
  	}

    static function DbGetLastId()
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    static function DbAffectedRow()
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    static function DbStartTransaction()
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }
    static function DbCommit()
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }
    static function DbRollback()
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    static function DbRestartTransaction()
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }
    
    static function DbSelect( $dbname )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    static function CommitAllAndRestart()
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    static function setDeadlockMode( $mode )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }
    static function isDeadlockModeRetry()
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    static protected function sendMultiQueries(array $queries)
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    static public function escapeStringForDB( $string )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    static public function escapeStringOrNullForDB($string): string
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    static public function getCollectionFromDB( $sql, $bSingleValue=false )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    protected function getNonEmptyCollectionFromDB( $sql )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    protected function getDoubleKeyCollectionFromDB( $sql, $bSingleValue=false )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    static public function getUniqueValueFromDB( $sql )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }
    
    static public function mysql_fetch_row( $dbres )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }
    static public function mysql_query( $sql, $specific_db=null )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }
    
    protected function getObjectFromDB( $sql )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    protected function getNonEmptyObjectFromDB( $sql )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    static protected function getObjectListFromDB( $sql, $bUniqueValue=false )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    // Converts a database retrieved datetime field into a php DateTime using the proper database timezone (+2:00)
    static protected function getDateTimeFromDbDate( $dbdatetime )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }

    // Converts a database retrieved datetime field into a timestamp using the proper database timezone (+2:00)
    static protected function getTimestampFromDbDate( $dbdatetime )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }
    
    function sqlParsing( $file )
    {
        throw new BgaSystemException("The action.php file should use the game class to access the database");
    }
}
