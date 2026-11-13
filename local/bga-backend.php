<?php
/**
 * Local BGA Environment Shim & Container Wiring for Tichu.
 *
 * Boots the real BGA server-side framework classes in `local/Bga/GameFramework/`
 * on top of our project-local MySQL 8.0 InnoDB instance (`local/mysql-ctl.sh`).
 */

namespace {
    if (!class_exists('feException')) {
        class feException extends \Exception
        {
            public bool $expected = false;
            public bool $visibility = true;
            public ?array $args = null;

            public function __construct(
                string $message = '',
                bool $expected = false,
                bool $visibility = true,
                int $code = 0,
                mixed $publicMsg = '',
                array $args = []
            ) {
                parent::__construct($message, (int) $code);
                $this->expected = $expected;
                $this->visibility = $visibility;
                $this->args = $args;
            }
        }
    }
}

namespace Bga\Exceptions\Services\Db {
    class DatabaseException extends \feException {}
    class UnableToConnectException extends DatabaseException {}
    class UnableToFindDatabaseException extends DatabaseException {}
    class DeadlockException extends DatabaseException {}
    class DatabaseDeadLockException extends DatabaseException {}
    class DatabaseInvalidResultException extends DatabaseException {}
    class DatabaseQueryErrorException extends DatabaseException {}
    class DatabaseTimeOutException extends DatabaseException {}
    class DabaseSyntaxErrorException extends DatabaseException {}
}

namespace Bga\Exceptions\Framework {
    class UnknownPlayerStatistic extends \feException {}
    class NoOutOfTimePlayersException extends \feException {}
    class CannotExpelPlayerException extends \feException {}
    class ZombieStateException extends \feException {}
    class UndoFrameworkException extends \feException {}
}

namespace Bga\Exceptions\Table {
    class TableWithoutPlayerException extends \feException {}
}

namespace Monolog {
    if (!enum_exists(Level::class)) {
        enum Level: int
        {
            case Debug = 100;
            case Info = 200;
            case Notice = 250;
            case Warning = 300;
            case Error = 400;
            case Critical = 500;
        }
    }
}

namespace Sentry {
    if (!class_exists(Breadcrumb::class)) {
        class Breadcrumb
        {
            public const LEVEL_INFO = 'info';
            public const TYPE_DEFAULT = 'default';
        }
    }
}

namespace Bga\Services {
    class Notify
    {
        public function publish(...$args): void {}
    }

    class Sentry
    {
        public function addBreadcrumb(...$args): void {}
        public function captureException(\Throwable $e): void {}
    }
}

namespace Bga\Services\Cache {
    class Apcu
    {
        private array $store = [];
        public function get(string $key, mixed $default = null): mixed
        {
            return $this->store[$key] ?? $default;
        }
        public function set(string $key, mixed $val, int $ttl = 0): bool
        {
            $this->store[$key] = $val;
            return true;
        }
    }

    class LocalRedis
    {
        private array $store = [];
        public function get(string $key): mixed
        {
            return $this->store[$key] ?? false;
        }
        public function set(string $key, mixed $val): bool
        {
            $this->store[$key] = $val;
            return true;
        }
    }
}

namespace Bga\Account {
    class SessionManager
    {
        public function setTemporaryMasquerade(?int $playerId): void
        {
            global $g_user;
            $g_user->setTemporaryMasquerade($playerId);
        }

        public function getBgaUserId(bool $nullIfNotLogged = false): ?int
        {
            global $g_user;
            return $g_user->get_id($nullIfNotLogged);
        }
    }
}

namespace Bga\Tables {
    class TableStatsManager
    {
        private ?array $cached = null;

        public function get(string $gameName): array
        {
            if ($this->cached !== null) {
                return $this->cached;
            }
            $stats_type = ['table' => [], 'player' => []];
            $file = dirname(__DIR__) . '/stats.inc.php';
            if (file_exists($file)) {
                require $file;
            }
            // Standard BGA built-in table & player stats referenced by Table.php
            $stats_type['table']['turns_number'] ??= ['id' => 1, 'name' => 'Number of turns', 'type' => 'int'];
            $stats_type['table']['player_number'] ??= ['id' => 2, 'name' => 'Number of players', 'type' => 'int'];
            $stats_type['table']['avg_points'] ??= ['id' => 3, 'name' => 'Average points', 'type' => 'float'];
            $stats_type['table']['best_score'] ??= ['id' => 4, 'name' => 'Best score', 'type' => 'int'];
            $stats_type['table']['interaction_nbr'] ??= ['id' => 5, 'name' => 'Interactions', 'type' => 'int'];

            $stats_type['player']['turns_number'] ??= ['id' => 1, 'name' => 'Number of turns', 'type' => 'int'];
            $stats_type['player']['reflexion_time'] ??= ['id' => 2, 'name' => 'Thinking time', 'type' => 'int'];
            $stats_type['player']['time_bonus_nbr'] ??= ['id' => 3, 'name' => 'Time bonuses', 'type' => 'int'];
            $stats_type['player']['reflexion_time_sd'] ??= ['id' => 4, 'name' => 'Thinking time SD', 'type' => 'float'];

            $this->cached = $stats_type;
            return $this->cached;
        }
    }

    class TableOptionsManager
    {
        private ?array $cachedOptions = null;

        public function get(string $gameName): array
        {
            return $this->getGameOptions($gameName);
        }

        public function getGameOptions(string $gameName): array
        {
            if ($this->cachedOptions !== null) {
                return $this->cachedOptions;
            }
            $game_options = [];
            $file = dirname(__DIR__) . '/gameoptions.inc.php';
            if (file_exists($file)) {
                require $file;
            }
            $this->cachedOptions = $game_options;
            return $this->cachedOptions;
        }

        public function getTimeLimits(int $timeProfile, string $gameName): array
        {
            return [
                'additional_time_per_move' => 86400,
                'initial_time_to_thing' => 259200,
                'maximum_time_per_move' => 259200,
                'extra_time_to_think_to_expel' => 86400,
                'no_move_on_extratime' => 0,
            ];
        }
    }

    class UserPreferencesManager
    {
        private ?array $cachedPrefs = null;

        public function get(string $gameName): array
        {
            if ($this->cachedPrefs !== null) {
                return $this->cachedPrefs;
            }
            $game_preferences = [];
            $file = dirname(__DIR__) . '/gameoptions.inc.php';
            if (file_exists($file)) {
                require $file;
            }
            $this->cachedPrefs = $game_preferences;
            return $this->cachedPrefs;
        }
    }

    class GameInfosManager
    {
        private ?array $cachedInfos = null;

        public function get(string $gameName): array
        {
            if ($this->cachedInfos !== null) {
                return $this->cachedInfos;
            }
            $gameinfos = [];
            $file = dirname(__DIR__) . '/gameinfos.inc.php';
            if (file_exists($file)) {
                require $file;
            }
            $this->cachedInfos = $gameinfos;
            return $this->cachedInfos;
        }
    }
}

namespace {
    // -------------------------------------------------------------------------
    // Global Constants
    // -------------------------------------------------------------------------
    $projectRoot = dirname(__DIR__);
    if (!defined('APP_BASE_PATH')) {
        define('APP_BASE_PATH', __DIR__ . '/');
    }
    if (!defined('APP_GAMES_PATH')) {
        define('APP_GAMES_PATH', $projectRoot . '/');
    }
    if (!defined('APP_GAMEMODULE_PATH')) {
        define('APP_GAMEMODULE_PATH', $projectRoot . '/');
    }

    if (!defined('AT_int')) {
        define('AT_int', 0);
        define('AT_posint', 1);
        define('AT_float', 2);
        define('AT_bool', 3);
        define('AT_enum', 4);
        define('AT_alphanum', 5);
        define('AT_alphanum_dash', 6);
        define('AT_numberlist', 7);
        define('AT_base64', 8);
        define('AT_json', 9);
    }

    if (!defined('GAMESTATE_LAST_MOVE')) {
        define('GAMESTATE_LAST_MOVE', 0);
        define('GAMESTATE_CURRENT_STATE', 1);
        define('GAMESTATE_ACTIVE_PLAYER', 2);
        define('GAMESTATE_NEXT_NOTIF_NO', 3);
        define('GAMESTATE_GAME_ID', 4);
        define('GAMESTATE_ADMIN_PLAYER', 5);
        define('GAMESTATE_PLAYERTURN_NBR', 6);
        define('GAMESTATE_GAMEPROGRESSION', 7);
        define('GAMESTATE_CLOCK_MODE', 200);
        define('GAMESTATE_CLOCK_MODE_ARG', 202);
        define('GAMESTATE_CLOCK_NIGHT', 203);
        define('GAMESTATE_GAME_LANG', 207);
        define('GAMESTATE_GAMEVERSION', 300);
        define('GAMESTATE_GAME_RESULT_NEUTRALIZED', 301);
        define('GAMESTATE_NEUTRALIZED_PLAYER_ID', 302);
        define('GAMESTATE_UNDO_MOVES_STORED', 303);
        define('GAMESTATE_UNDO_MOVES_PLAYER', 304);
        define('GAMESTATE_KEEP_RANKING_ON_QUIT', 305);
        define('GAMESTATE_IS_TOURNAMENT', 306);
        define('GAMESTATE_LOCK_TIMESTAMP', 307);
        define('GAMESTATE_DEFER_INITIAL_AI_TURN', 308);
    }

    if (!defined('FEX_bad_input_argument')) {
        define('FEX_NOCODE', 0);
        define('FEX_bad_input_argument', 100);
        define('FEX_game_not_found', 101);
        define('FEX_unexpected_exception', 102);
        define('FEX_sql_connection_error', 200);
        define('FEX_sql_select_db_error', 201);
        define('FEX_sql_deadlock_error', 202);
        define('FEX_sql_request_error', 203);
        define('FEX_application_deadlock_restart_transaction', 204);
        define('FEX_mysql_deadlock_restart_transaction', 1213);
        define('FEX_mysql_max_execution_time_exceeded', 3024);
    }

    if (!defined('T_SECOND')) {
        define('T_SECOND', 1);
        define('T_MINUTE', 60);
        define('T_HOUR', 3600);
        define('T_DAY', 86400);
    }

    // -------------------------------------------------------------------------
    // Global Helper Functions
    // -------------------------------------------------------------------------
    if (!function_exists('clienttranslate')) {
        function clienttranslate($text)
        {
            return (string) $text;
        }
    }

    if (!function_exists('totranslate')) {
        function totranslate($text)
        {
            return (string) $text;
        }
    }

    if (!function_exists('translate')) {
        function translate($game, $text, $domain = null)
        {
            return (string) $text;
        }
    }

    if (!function_exists('_')) {
        function _($text)
        {
            return (string) $text;
        }
    }

    if (!function_exists('bga_rand')) {
        function bga_rand(int $min, int $max): int
        {
            return random_int($min, $max);
        }
    }

    if (!function_exists('doublecheck')) {
        function doublecheck($val)
        {
            if (!is_numeric($val)) {
                throw new \feException("Invalid numeric value: " . var_export($val, true));
            }
            return $val;
        }
    }

    if (!function_exists('getCurrentGameVersion')) {
        function getCurrentGameVersion(string $gameName): string
        {
            return '999999-9999';
        }
    }

    if (!function_exists('mysql_fetch_assoc')) {
        function mysql_fetch_assoc($result)
        {
            if ($result instanceof \mysqli_result) {
                return $result->fetch_assoc() ?: false;
            }
            return false;
        }
    }

    if (!function_exists('mysql_fetch_row')) {
        function mysql_fetch_row($result)
        {
            if ($result instanceof \mysqli_result) {
                return $result->fetch_row() ?: false;
            }
            return false;
        }
    }

    if (!function_exists('unserialize_game_notifs')) {
        function unserialize_game_notifs(string $raw): array
        {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return $decoded;
            }
            $unser = @unserialize($raw);
            return is_array($unser) ? $unser : [];
        }
    }

    if (!function_exists('getKeyWithMaximum')) {
        function getKeyWithMaximum(array $array, bool $bCanReturnNullIfTwoMax = true, bool $bMaximum = true)
        {
            if (empty($array)) {
                return null;
            }
            $target = $bMaximum ? max($array) : min($array);
            $keys = array_keys($array, $target, true);
            if (count($keys) > 1 && $bCanReturnNullIfTwoMax) {
                return null;
            }
            return $keys[0];
        }
    }

    if (!function_exists('getKeysWithMaximum')) {
        function getKeysWithMaximum(array $array, bool $bMaximum = true): array
        {
            if (empty($array)) {
                return [];
            }
            $target = $bMaximum ? max($array) : min($array);
            return array_keys($array, $target, true);
        }
    }

    if (!function_exists('apcu_fetch')) {
        $GLOBALS['__bga_apcu_cache'] = [];
        function apcu_fetch($key, &$success = null)
        {
            if (array_key_exists((string) $key, $GLOBALS['__bga_apcu_cache'])) {
                $success = true;
                return $GLOBALS['__bga_apcu_cache'][(string) $key];
            }
            $success = false;
            return false;
        }
        function apcu_add($key, $var = null, int $ttl = 0)
        {
            if (is_array($key)) {
                foreach ($key as $k => $v) {
                    $GLOBALS['__bga_apcu_cache'][(string) $k] = $v;
                }
                return [];
            }
            $GLOBALS['__bga_apcu_cache'][(string) $key] = $var;
            return true;
        }
        function apcu_store($key, $var = null, int $ttl = 0)
        {
            return apcu_add($key, $var, $ttl);
        }
        function apcu_exists($keys)
        {
            return array_key_exists((string) $keys, $GLOBALS['__bga_apcu_cache']);
        }
    }

    // -------------------------------------------------------------------------
    // Core Legacy Platform Classes
    // -------------------------------------------------------------------------
    if (!class_exists('feException')) {
        class feException extends \Exception
        {
            public bool $expected = false;
            public bool $visibility = true;
            public ?array $args = null;

            public function __construct(
                string $message = '',
                bool $expected = false,
                bool $visibility = true,
                int $code = 0,
                mixed $publicMsg = '',
                array $args = []
            ) {
                parent::__construct($message, (int) $code);
                $this->expected = $expected;
                $this->visibility = $visibility;
                $this->args = $args;
            }
        }
    }

    if (!class_exists('Trace')) {
        class Trace
        {
            public mixed $log_error_forgame = null;
            public static function trace_sql(string $msg): void {}
            public static function createLogHandler(...$args): mixed
            {
                return null;
            }
            public function incDbTime(mixed $time = 0): void {}
            public function logFatalException(\Throwable $e): void {}
            public function error(string $msg): void {}
            public function __call(string $name, array $args): mixed
            {
                return null;
            }
            public static function __callStatic(string $name, array $args): mixed
            {
                return null;
            }
        }
    }

    if (!class_exists('Locale')) {
        class Locale
        {
            private static string $loc = 'en_US';
            public static function GetLocalization(): string
            {
                return self::$loc;
            }
            public static function SetLocalization(string $loc): void
            {
                self::$loc = $loc;
            }
        }
    }

    if (!class_exists('APP_Object')) {
        class APP_Object
        {
            public static function trace($message): void {}
            public static function debug($message): void {}
            public static function warn($message): void {}
            public static function error($message): void {}
            public static function dump($prefix, $object): void {}

            public static function masterNodeRequest(string $method, array $args = []): mixed
            {
                return ['ok' => true];
            }

            public static function getMasterNodeUrl(): string
            {
                return 'http://127.0.0.1:8080';
            }
        }
    }

    if (!class_exists('APP_Action')) {
        class APP_Action extends APP_Object
        {
            public array $args = [];
            public string $view = '';
            public array $viewArgs = [];

            public function __construct(array $args = [])
            {
                $this->args = !empty($args) ? $args : array_merge($_GET ?? [], $_POST ?? []);
            }

            public function setAjaxMode($bCheckCsrf = true): void {}

            public function isArg(string $name): bool
            {
                return array_key_exists($name, $this->args);
            }

            public function getArg(
                string $name,
                int $type,
                bool $mandatory = true,
                mixed $default = null,
                array $enum = [],
                bool $bCanFail = false
            ): mixed {
                if (!array_key_exists($name, $this->args)) {
                    if ($mandatory) {
                        throw new \Bga\GameFramework\UserException("Missing mandatory parameter: $name");
                    }
                    return $default;
                }
                $val = $this->args[$name];
                switch ($type) {
                    case AT_int:
                        if (!is_numeric($val)) {
                            throw new \Bga\GameFramework\UserException("Invalid integer parameter: $name");
                        }
                        return (int) $val;
                    case AT_posint:
                        if ($val === null || $val === '') {
                            if (!$mandatory) {
                                return $default;
                            }
                            throw new \Bga\GameFramework\UserException("Invalid positive integer parameter: $name");
                        }
                        if (!is_numeric($val) || (int) $val < 0) {
                            throw new \Bga\GameFramework\UserException("Invalid positive integer parameter: $name");
                        }
                        return (int) $val;
                    case AT_float:
                        if (!is_numeric($val)) {
                            throw new \Bga\GameFramework\UserException("Invalid float parameter: $name");
                        }
                        return (float) $val;
                    case AT_bool:
                        if ($val === 'true' || $val === '1' || $val === 1 || $val === true) {
                            return true;
                        }
                        if ($val === 'false' || $val === '0' || $val === 0 || $val === false || $val === '') {
                            return false;
                        }
                        throw new \Bga\GameFramework\UserException("Invalid boolean parameter: $name");
                    case AT_enum:
                        $strVal = (string) $val;
                        if (!empty($enum) && !in_array($strVal, array_map('strval', $enum), true)) {
                            throw new \Bga\GameFramework\UserException("Invalid enum value '$strVal' for parameter: $name");
                        }
                        return $strVal;
                    case AT_numberlist:
                        $strVal = (string) $val;
                        if ($strVal !== '' && !preg_match('/^[0-9;,_-]+$/', $strVal)) {
                            throw new \Bga\GameFramework\UserException("Invalid numberlist parameter: $name");
                        }
                        return $strVal;
                    case AT_json:
                        if (is_array($val)) {
                            return $val;
                        }
                        $decoded = json_decode((string) $val, true);
                        if ($decoded === null && strtolower((string) $val) !== 'null') {
                            throw new \Bga\GameFramework\UserException("Invalid JSON parameter: $name");
                        }
                        return $decoded;
                    default:
                        return (string) $val;
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Load Real BGA Framework Files (`local/Bga/GameFramework/`)
    // -------------------------------------------------------------------------
    $fwDir = __DIR__ . '/Bga/GameFramework';

    require_once $fwDir . '/StateType.php';
    require_once $fwDir . '/GameException.php';
    require_once $fwDir . '/UserException.php';
    require_once $fwDir . '/SystemException.php';
    require_once $fwDir . '/VisibleSystemException.php';

    require_once $fwDir . '/Actions/CheckAction.php';
    require_once $fwDir . '/Actions/Debug.php';
    require_once $fwDir . '/Actions/Types/ActionType.php';
    require_once $fwDir . '/Actions/Types/BoolParam.php';
    require_once $fwDir . '/Actions/Types/FloatParam.php';
    require_once $fwDir . '/Actions/Types/IntArrayParam.php';
    require_once $fwDir . '/Actions/Types/IntParam.php';
    require_once $fwDir . '/Actions/Types/JsonParam.php';
    require_once $fwDir . '/Actions/Types/StringParam.php';

    require_once $fwDir . '/Old/Db.php';
    require_once $fwDir . '/Old/APP_DbObject.php';
    require_once $fwDir . '/Old/APP_GameClass.php';

    require_once $fwDir . '/Db/Globals.php';
    require_once $fwDir . '/Legacy.php';
    require_once $fwDir . '/Logs.php';
    require_once $fwDir . '/Notify.php';
    require_once $fwDir . '/Stats.php';
    require_once $fwDir . '/TableStats.php';
    require_once $fwDir . '/PlayerStats.php';
    require_once $fwDir . '/TableInfos.php';
    require_once $fwDir . '/TableOptions.php';
    require_once $fwDir . '/UserPreferences.php';
    require_once $fwDir . '/Debug.php';

    require_once $fwDir . '/Components/Deck.php';
    require_once $fwDir . '/Components/DeckFactory.php';

    require_once $fwDir . '/States/GameState.php';
    require_once $fwDir . '/States/LegacyGameState.php';
    require_once $fwDir . '/GameState.php';
    require_once $fwDir . '/GameStateBuilder.php';
    require_once $fwDir . '/GamestateMachine.php';
    require_once $fwDir . '/Bga.php';
    require_once $fwDir . '/Table.php';
    require_once $fwDir . '/GameAction.php';

    // -------------------------------------------------------------------------
    // Global Aliases for Legacy BGA Classes
    // -------------------------------------------------------------------------
    if (!class_exists('APP_DbObject')) {
        class_alias(\Bga\GameFramework\Old\APP_DbObject::class, 'APP_DbObject');
    }
    if (!class_exists('APP_GameClass')) {
        class_alias(\Bga\GameFramework\Old\APP_GameClass::class, 'APP_GameClass');
    }
    if (!class_exists('APP_GameAction')) {
        class_alias(\Bga\GameFramework\GameAction::class, 'APP_GameAction');
    }
    if (!class_exists('Deck')) {
        class_alias(\Bga\GameFramework\Components\Deck::class, 'Deck');
    }
    if (!class_exists('Table')) {
        class_alias(\Bga\GameFramework\Table::class, 'Table');
    }
    if (!class_exists('GameState')) {
        class_alias(\Bga\GameFramework\GamestateMachine::class, 'GameState');
    }
    if (!class_exists('BgaUserException')) {
        class_alias(\Bga\GameFramework\UserException::class, 'BgaUserException');
    }
    if (!class_exists('BgaSystemException')) {
        class_alias(\Bga\GameFramework\SystemException::class, 'BgaSystemException');
    }
    if (!class_exists('BgaVisibleSystemException')) {
        class_alias(\Bga\GameFramework\VisibleSystemException::class, 'BgaVisibleSystemException');
    }

    // -------------------------------------------------------------------------
    // Global Configuration, Session User, Trace & Service Container
    // -------------------------------------------------------------------------
    global $g_config, $g_user, $g_trace, $bgaContainer;

    $g_config = [
        'db_host' => getenv('TICHU_MYSQL_HOST') ?: 'localhost',
        'db_user' => getenv('TICHU_MYSQL_USER') ?: 'root',
        'db_password' => getenv('TICHU_MYSQL_PASS') ?: '',
        'db_name' => getenv('TICHU_MYSQL_DB') ?: 'ebd_tichu_1',
        'db_socket' => getenv('TICHU_MYSQL_SOCKET') ?: (__DIR__ . '/.mysql/mysql.sock'),
        'db_timeout' => 30,
        'db_job_timeout' => 300,
        'trace_sql_queries' => false,
        'services_timeout' => [
            'mysql' => [
                'player' => 10,
                'visitor' => 5,
                'cronjob' => 300,
            ],
            'php' => [
                'player' => 10,
                'visitor' => 5,
                'cronjob' => 300,
            ],
        ],
        'app_domain' => 'studio.boardgamearena.com',
        'cluster_is_master' => true,
        'no_move_on_extratime' => false,
        'prevent_spectator_chat' => false,
        'enable_warning_before_expel' => false,
        'webpush_enabled' => false,
        'androidpush_enabled' => false,
    ];

    $g_trace = new Trace();

    $g_user = new class {
        public int $id = 2385074;
        public bool $isSpectator = false;
        public ?int $temporary_masquerade = null;

        public function is_logged(): bool
        {
            return true;
        }

        public function is_visitor(): bool
        {
            return $this->isSpectator;
        }

        public function is_admin(): bool
        {
            return false;
        }

        public function has_right(string $right): bool
        {
            return false;
        }

        public function __call(string $name, array $args): mixed
        {
            return false;
        }

        public function get_id(bool $bNullIfNotLogged = false): ?int
        {
            if (!$bNullIfNotLogged) {
                $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 12);
                $directCallerClass = $trace[2]['class'] ?? '';
                $isFrameworkCaller = str_starts_with($directCallerClass, 'Bga\\GameFramework\\');
                if (!$isFrameworkCaller) {
                    foreach ($trace as $frame) {
                        $cls = $frame['class'] ?? '';
                        $fn = $frame['function'] ?? '';
                        if ($cls === 'Tichu' && ($fn === 'setupNewGame' || $fn === 'zombieTurn' || str_starts_with($fn, 'arg'))) {
                            throw new \Bga\GameFramework\SystemException(
                                "Cannot call getCurrentPlayerId() inside $cls::$fn()"
                            );
                        }
                    }
                }
            }
            if ($this->temporary_masquerade !== null) {
                return $this->temporary_masquerade;
            }
            if ($this->isSpectator) {
                return 0;
            }
            return $this->id;
        }

        public function setTemporaryMasquerade(?int $playerId): void
        {
            $this->temporary_masquerade = $playerId;
        }
    };

    $bgaContainer = new class {
        private array $services = [];

        public function get(string $id): mixed
        {
            if (!isset($this->services[$id])) {
                $this->services[$id] = $this->create($id);
            }
            return $this->services[$id];
        }

        private function create(string $id): mixed
        {
            switch ($id) {
                case \Bga\GameFramework\Old\Db::class:
                    global $g_config;
                    if (!empty($g_config['db_socket']) && !file_exists($g_config['db_socket'])) {
                        $ctl = __DIR__ . '/mysql-ctl.sh';
                        if (is_file($ctl)) {
                            shell_exec('bash ' . escapeshellarg($ctl) . ' ensure');
                        }
                    }
                    $db = new \Bga\GameFramework\Old\Db($g_config['db_name']);
                    $db->connect();
                    return $db;
                case \Bga\Services\Notify::class:
                    return new \Bga\Services\Notify();
                case \Bga\Services\Sentry::class:
                    return new \Bga\Services\Sentry();
                case \Bga\Services\Cache\Apcu::class:
                    return new \Bga\Services\Cache\Apcu();
                case \Bga\Services\Cache\LocalRedis::class:
                    return new \Bga\Services\Cache\LocalRedis();
                case \Bga\Account\SessionManager::class:
                    return new \Bga\Account\SessionManager();
                case \Bga\Tables\TableStatsManager::class:
                    return new \Bga\Tables\TableStatsManager();
                case \Bga\Tables\TableOptionsManager::class:
                    return new \Bga\Tables\TableOptionsManager();
                case \Bga\Tables\UserPreferencesManager::class:
                    return new \Bga\Tables\UserPreferencesManager();
                case \Bga\Tables\GameInfosManager::class:
                    return new \Bga\Tables\GameInfosManager();
                case 'module.metasite.metasite':
                    return new class {
                        public function checkBeforeTranslation(string $text): void {}
                        public function __call(string $name, array $args): mixed
                        {
                            return null;
                        }
                    };
                default:
                    if (class_exists($id)) {
                        return new $id();
                    }
                    throw new \RuntimeException("Unknown container service: $id");
            }
        }
    };

    // -------------------------------------------------------------------------
    // Legacy Template View Rendering (`tichu.view.php`)
    // -------------------------------------------------------------------------
    class Page
    {
        public array $blocks = [];

        public function begin_block(string $template, string $block): void
        {
            if (!isset($this->blocks[$block])) {
                $this->blocks[$block] = [];
            }
        }

        public function reset_subblocks(string $block): void
        {
            $this->blocks[$block] = [];
        }

        public function insert_block(string $block, array $args): void
        {
            $this->blocks[$block][] = [
                'vars' => $args,
                'subblocks' => $this->blocks,
            ];
        }

        public function renderTemplate(string $tplContent, array $rootVars = []): string
        {
            $defaults = [
                'OVERALL_GAME_HEADER' => '',
                'OVERALL_GAME_FOOTER' => '',
                'GAMETHEMEURL' => '/',
            ];
            $vars = array_merge($defaults, $rootVars);
            return $this->expandBlocksAndVars($tplContent, $this->blocks, $vars);
        }

        private function expandBlocksAndVars(string $html, array $blocks, array $vars): string
        {
            $expanded = preg_replace_callback(
                '/<!--\s*BEGIN\s+(\w+)\s*-->(.*?)<!--\s*END\s+\1\s*-->/s',
                function (array $matches) use ($blocks, $vars): string {
                    $blockName = $matches[1];
                    $innerTemplate = $matches[2];
                    if (empty($blocks[$blockName])) {
                        return '';
                    }
                    $out = '';
                    foreach ($blocks[$blockName] as $entry) {
                        $mergedVars = array_merge($vars, $entry['vars'] ?? []);
                        $subBlocks = $entry['subblocks'] ?? [];
                        $out .= $this->expandBlocksAndVars($innerTemplate, $subBlocks, $mergedVars);
                    }
                    return $out;
                },
                $html
            );

            $replacements = [];
            foreach ($vars as $k => $v) {
                if (is_scalar($v) || $v === null) {
                    $replacements['{' . $k . '}'] = (string) $v;
                }
            }
            return strtr($expanded ?? $html, $replacements);
        }
    }

    class game_view
    {
        public $game;
        public Page $page;
        public array $tpl = [];

        public function __construct($game = null)
        {
            $this->game = $game ?? (\Tichu::$instance ?? null);
            $this->page = new Page();
        }

        public function _($text): string
        {
            return (string) $text;
        }

        public function render(?string $tplFile = null, array $viewArgs = []): string
        {
            if (method_exists($this, 'build_page')) {
                $this->build_page($viewArgs);
            }
            $file = $tplFile ?? (dirname(__DIR__) . '/tichu_tichu.tpl');
            $content = file_get_contents($file);
            if ($content === false) {
                return '';
            }
            return $this->page->renderTemplate($content, $this->tpl);
        }
    }
}
