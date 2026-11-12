<?php
/**
 * Self-contained local SQLite-backed BGA Framework implementation for Tichu.
 * Zero modifications to existing game files required.
 */

namespace {
  error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);

  if (!defined('APP_GAMEMODULE_PATH')) {
    define('APP_GAMEMODULE_PATH', __DIR__ . '/');
  }
  if (!defined('APP_BASE_PATH')) {
    define('APP_BASE_PATH', __DIR__ . '/');
  }

  // Argument type constants
  if (!defined('AT_int')) define('AT_int', 0);
  if (!defined('AT_posint')) define('AT_posint', 1);
  if (!defined('AT_float')) define('AT_float', 2);
  if (!defined('AT_email')) define('AT_email', 3);
  if (!defined('AT_url')) define('AT_url', 4);
  if (!defined('AT_bool')) define('AT_bool', 5);
  if (!defined('AT_enum')) define('AT_enum', 6);
  if (!defined('AT_alphanum')) define('AT_alphanum', 7);
  if (!defined('AT_username')) define('AT_username', 8);
  if (!defined('AT_login')) define('AT_login', 9);
  if (!defined('AT_numberlist')) define('AT_numberlist', 13);
  if (!defined('AT_uuid')) define('AT_uuid', 17);
  if (!defined('AT_version')) define('AT_version', 18);
  if (!defined('AT_cityname')) define('AT_cityname', 20);
  if (!defined('AT_filename')) define('AT_filename', 21);
  if (!defined('AT_groupname')) define('AT_groupname', 22);
  if (!defined('AT_timezone')) define('AT_timezone', 23);
  if (!defined('AT_mediawikipage')) define('AT_mediawikipage', 24);
  if (!defined('AT_html_id')) define('AT_html_id', 26);
  if (!defined('AT_alphanum_dash')) define('AT_alphanum_dash', 27);
  if (!defined('AT_date')) define('AT_date', 28);
  if (!defined('AT_num')) define('AT_num', 29);
  if (!defined('AT_alpha_strict')) define('AT_alpha_strict', 30);
  if (!defined('AT_namewithaccent')) define('AT_namewithaccent', 31);
  if (!defined('AT_json')) define('AT_json', 32);
  if (!defined('AT_base64')) define('AT_base64', 33);

  if (!defined('FEX_bad_input_argument')) define('FEX_bad_input_argument', 300);

  if (!function_exists('totranslate')) {
    function totranslate($text)
    {
      return $text;
    }
  }

  if (!function_exists('clienttranslate')) {
    function clienttranslate($x)
    {
      return $x;
    }
  }

  if (!function_exists('bga_rand')) {
    function bga_rand($min, $max)
    {
      return random_int((int) $min, (int) $max);
    }
  }

  if (!function_exists('getKeysWithMaximum')) {
    function getKeysWithMaximum($array, $bWithMaximum = true)
    {
      if (empty($array)) {
        return [];
      }
      $max = max($array);
      $keys = array_keys($array, $max);
      return $bWithMaximum ? ['max' => $max, 'keys' => $keys] : $keys;
    }
  }

  if (!function_exists('getKeyWithMaximum')) {
    function getKeyWithMaximum($array)
    {
      if (empty($array)) {
        return null;
      }
      $max = max($array);
      return array_search($max, $array);
    }
  }

  if (!class_exists('feException')) {
    class feException extends \Exception
    {
      public bool $expected;
      public bool $visibility;
      public string $publicMsg;

      public function __construct(
        $message,
        $expected = false,
        $visibility = true,
        $code = 100,
        $publicMsg = ''
      ) {
        parent::__construct((string) $message, (int) $code);
        $this->expected = (bool) $expected;
        $this->visibility = (bool) $visibility;
        $this->publicMsg = (string) $publicMsg;
      }
    }
  }
}

namespace Bga\GameFramework {
  class UserException extends \feException
  {
    public function __construct($message, $code = 100)
    {
      parent::__construct($message, true, true, $code);
    }
  }

  class SystemException extends \feException
  {
    public function __construct($message, $code = 100)
    {
      parent::__construct($message, false, false, $code);
    }
  }

  class VisibleSystemException extends SystemException
  {
    public function __construct($message, $code = 100)
    {
      parent::__construct($message, $code);
    }
  }

  class TableOptions
  {
    public function get(int $optionId): ?int
    {
      $val = Table::getUniqueValueFromDB(
        "SELECT global_value FROM global WHERE global_id = " . (int) $optionId
      );
      return $val !== null ? (int) $val : null;
    }

    public function set(int $optionId, int $value): void
    {
      Table::DbQuery(
        "INSERT OR REPLACE INTO global (global_id, global_value) VALUES (" .
          (int) $optionId .
          ", " .
          (int) $value .
          ")"
      );
    }

    public function isTurnBased(): bool
    {
      $val = Table::getUniqueValueFromDB("SELECT global_value FROM global WHERE global_id = 200");
      return ((int) $val) === 1;
    }

    public function isRealTime(): bool
    {
      return !$this->isTurnBased();
    }

    public function getGameVersion(): int
    {
      return 999999999;
    }

    public function getGameLanguage(): ?int
    {
      return 0;
    }
  }

  class DeckFactory
  {
    public function createDeck(string $tableName = 'card'): \Deck
    {
      return new \Deck($tableName);
    }
  }

  class Bga
  {
    public TableOptions $tableOptions;
    public DeckFactory $deckFactory;

    public function __construct()
    {
      $this->tableOptions = new TableOptions();
      $this->deckFactory = new DeckFactory();
    }
  }
}

namespace {
  if (!class_exists('BgaUserException')) {
    class_alias(\Bga\GameFramework\UserException::class, 'BgaUserException');
  }
  if (!class_exists('BgaSystemException')) {
    class_alias(\Bga\GameFramework\SystemException::class, 'BgaSystemException');
  }
  if (!class_exists('BgaVisibleSystemException')) {
    class_alias(\Bga\GameFramework\VisibleSystemException::class, 'BgaVisibleSystemException');
  }

  class APP_Object
  {
    function dump($v, $value)
    {
      error_log("$v=" . print_r($value, true));
    }

    function info($value)
    {
      error_log("[INFO] $value");
    }

    function trace($value)
    {
      // no-op in local runner to keep stdout clean for JSON responses
    }

    function debug($value)
    {
      error_log("[DEBUG] $value");
    }

    function watch($value)
    {
      error_log("[WATCH] $value");
    }

    function warn($value)
    {
      error_log("[WARN] $value");
    }

    function error($msg)
    {
      error_log("[ERROR] $msg");
    }
  }

  class APP_DbObject extends APP_Object
  {
    protected static ?\PDO $pdo = null;
    protected static string $dbPath = '';
    protected static int $lastAffectedRows = 0;

    public static function setDbPath(string $path): void
    {
      if (self::$dbPath !== $path) {
        self::$pdo = null;
        self::$dbPath = $path;
      }
    }

    public static function getDbPath(): string
    {
      if (self::$dbPath !== '') {
        return self::$dbPath;
      }
      $envPath = getenv('TICHU_DB_PATH');
      if ($envPath !== false && $envPath !== '') {
        return $envPath;
      }
      return __DIR__ . '/tichu.db';
    }

    public static function setPdo(?\PDO $pdo): void
    {
      self::$pdo = $pdo;
    }

    public static function getPdo(): \PDO
    {
      if (self::$pdo === null) {
        $path = self::getDbPath();
        $dsn = $path === ':memory:' ? 'sqlite::memory:' : 'sqlite:' . $path;
        $pdo = new \PDO($dsn);
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
        // Match BGA mysqli behavior where fetched scalar columns are strings (while NULL stays null)
        $pdo->setAttribute(\PDO::ATTR_STRINGIFY_FETCHES, true);
        if ($path !== ':memory:') {
          $pdo->exec('PRAGMA journal_mode = WAL;');
          $pdo->exec('PRAGMA synchronous = NORMAL;');
          $pdo->exec('PRAGMA busy_timeout = 5000;');
        }
        self::$pdo = $pdo;
      }
      return self::$pdo;
    }

    public static function initSchema(?string $schemaFile = null): void
    {
      $file = $schemaFile ?? (__DIR__ . '/schema.sql');
      $sql = file_get_contents($file);
      if ($sql === false) {
        throw new \Bga\GameFramework\SystemException("Failed to read schema file: $file");
      }
      self::getPdo()->exec($sql);
    }

    public static function DbQuery($sql)
    {
      $pdo = self::getPdo();
      // Convert MySQL backslash-escaped single quotes from addslashes() to SQLite ''
      $normalizedSql = str_replace("\\'", "''", $sql);
      $stmt = $pdo->query($normalizedSql);
      self::$lastAffectedRows = $stmt ? $stmt->rowCount() : 0;
      return $stmt;
    }

    public static function getUniqueValueFromDB($sql)
    {
      $stmt = self::DbQuery($sql);
      $row = $stmt->fetch(\PDO::FETCH_NUM);
      return $row !== false ? $row[0] : null;
    }

    public static function getObjectFromDB($sql)
    {
      $stmt = self::DbQuery($sql);
      $row = $stmt->fetch(\PDO::FETCH_ASSOC);
      return $row !== false ? $row : null;
    }

    public static function getNonEmptyObjectFromDB($sql)
    {
      $row = self::getObjectFromDB($sql);
      if (empty($row)) {
        throw new \Bga\GameFramework\SystemException("Empty result for getNonEmptyObjectFromDB: $sql");
      }
      return $row;
    }

    public static function getObjectListFromDB($sql, $bUniqueValue = false)
    {
      $stmt = self::DbQuery($sql);
      if ($bUniqueValue) {
        $rows = $stmt->fetchAll(\PDO::FETCH_NUM);
        return array_map(static fn($r) => $r[0], $rows);
      }
      return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    public static function getCollectionFromDB($sql, $bSingleValue = false)
    {
      $stmt = self::DbQuery($sql);
      $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);
      $result = [];
      foreach ($rows as $row) {
        $vals = array_values($row);
        $key = $vals[0];
        $result[$key] = $bSingleValue ? ($vals[1] ?? null) : $row;
      }
      return $result;
    }

    public static function getNonEmptyCollectionFromDB($sql)
    {
      $res = self::getCollectionFromDB($sql);
      if (empty($res)) {
        throw new \Bga\GameFramework\SystemException("Empty collection from DB: $sql");
      }
      return $res;
    }

    public static function getDoubleKeyCollectionFromDB($sql, $bSingleValue = false)
    {
      $stmt = self::DbQuery($sql);
      $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);
      $result = [];
      foreach ($rows as $row) {
        $vals = array_values($row);
        $k1 = $vals[0];
        $k2 = $vals[1];
        if (!isset($result[$k1])) {
          $result[$k1] = [];
        }
        $result[$k1][$k2] = $bSingleValue ? ($vals[2] ?? null) : $row;
      }
      return $result;
    }

    public static function DbGetLastId()
    {
      return self::getPdo()->lastInsertId();
    }

    public static function DbAffectedRow()
    {
      return self::$lastAffectedRows;
    }

    public static function escapeStringForDB($string)
    {
      return str_replace("'", "''", (string) $string);
    }
  }

  class APP_Action extends APP_DbObject {}

  class APP_GameAction extends APP_Action
  {
    public $game;
    public $view;
    public array $viewArgs = [];
    protected ?array $requestArgs = null;
    protected bool $ajaxMode = false;
    protected bool $responseSent = false;
    protected $responseData = null;

    public function __construct($game = null, ?array $requestArgs = null)
    {
      $this->game = $game ?? (\Tichu::$instance ?? null);
      $this->requestArgs = $requestArgs;
    }

    public function setGame($game): void
    {
      $this->game = $game;
    }

    public function setRequestArgs(?array $args): void
    {
      $this->requestArgs = $args;
    }

    protected function getEffectiveRequestArgs(): array
    {
      return $this->requestArgs !== null ? $this->requestArgs : $_REQUEST;
    }

    public function getResponseData()
    {
      return $this->responseData;
    }

    protected function isArg($argName): bool
    {
      $args = $this->getEffectiveRequestArgs();
      return array_key_exists($argName, $args);
    }

    protected function getArg(
      $name,
      $type,
      $mandatory = true,
      $default = null,
      $argTypeDetails = [],
      $bCanFail = false
    ) {
      $args = $this->getEffectiveRequestArgs();
      if (!array_key_exists($name, $args)) {
        if ($mandatory) {
          throw new \Bga\GameFramework\UserException(
            "Missing mandatory argument: $name",
            FEX_bad_input_argument
          );
        }
        return $default;
      }
      $val = $args[$name];
      switch ($type) {
        case AT_int:
        case AT_posint:
          return (int) $val;
        case AT_float:
          return (float) $val;
        case AT_bool:
          if (is_bool($val)) {
            return $val;
          }
          $str = strtolower(trim((string) $val));
          return in_array($str, ['1', 'true', 'yes', 'on'], true);
        case AT_enum:
          $strVal = (string) $val;
          if (!empty($argTypeDetails)) {
            $allowed = array_map('strval', $argTypeDetails);
            if (!in_array($strVal, $allowed, true)) {
              throw new \Bga\GameFramework\UserException(
                "Invalid enum value '$strVal' for argument '$name'",
                FEX_bad_input_argument
              );
            }
          }
          return $strVal;
        case AT_json:
          return is_string($val) ? json_decode($val, true) : $val;
        case AT_numberlist:
        case AT_alphanum:
        default:
          return (string) $val;
      }
    }

    protected function setAjaxMode($bCheckCsrf = true)
    {
      $this->ajaxMode = true;
      $game = $this->game ?? (\Tichu::$instance ?? null);
      if ($game) {
        $this->game = $game;
        $game->beginPlayerAction();
      }
    }

    protected function ajaxResponse($data = '')
    {
      $this->responseSent = true;
      $this->responseData = $data;
      if ($this->game) {
        $this->game->endPlayerAction();
      }
    }
  }

  class Deck
  {
    private string $table;

    public function __construct(string $table = 'card')
    {
      $this->table = $table;
    }

    public function init(string $table): void
    {
      $this->table = $table;
    }

    private function selectColumns(): string
    {
      return "SELECT card_id AS id, card_type AS type, card_type_arg AS type_arg, card_location AS location, card_location_arg AS location_arg, card_passed_from AS passed_from FROM {$this->table}";
    }

    public function createCards(array $cards, string $location = 'deck', int $location_arg = 0): void
    {
      $pdo = APP_DbObject::getPdo();
      $ownTx = !$pdo->inTransaction();
      if ($ownTx) {
        $pdo->beginTransaction();
      }
      try {
        $stmt = $pdo->prepare(
          "INSERT INTO {$this->table} (card_type, card_type_arg, card_location, card_location_arg) VALUES (?, ?, ?, ?)"
        );
        foreach ($cards as $cardDef) {
          $nbr = (int) ($cardDef['nbr'] ?? 1);
          $type = (string) $cardDef['type'];
          $typeArg = (int) $cardDef['type_arg'];
          for ($i = 0; $i < $nbr; $i++) {
            $stmt->execute([$type, $typeArg, $location, $location_arg]);
          }
        }
        if ($ownTx) {
          $pdo->commit();
        }
      } catch (\Throwable $e) {
        if ($ownTx && $pdo->inTransaction()) {
          $pdo->rollBack();
        }
        throw $e;
      }
    }

    public function shuffle(string $location): void
    {
      $locEsc = APP_DbObject::escapeStringForDB($location);
      $ids = APP_DbObject::getObjectListFromDB(
        "SELECT card_id FROM {$this->table} WHERE card_location = '$locEsc' ORDER BY card_id ASC",
        true
      );
      if (empty($ids)) {
        return;
      }
      shuffle($ids);
      $pdo = APP_DbObject::getPdo();
      $ownTx = !$pdo->inTransaction();
      if ($ownTx) {
        $pdo->beginTransaction();
      }
      try {
        $stmt = $pdo->prepare(
          "UPDATE {$this->table} SET card_location_arg = ? WHERE card_id = ?"
        );
        foreach ($ids as $index => $cardId) {
          $stmt->execute([$index, (int) $cardId]);
        }
        if ($ownTx) {
          $pdo->commit();
        }
      } catch (\Throwable $e) {
        if ($ownTx && $pdo->inTransaction()) {
          $pdo->rollBack();
        }
        throw $e;
      }
    }

    public function pickCards(int $nbr, string $from_location, int $player_id): array
    {
      return $this->pickCardsForLocation($nbr, $from_location, 'hand', $player_id);
    }

    public function pickCard(string $from_location, int $player_id): ?array
    {
      $cards = $this->pickCards(1, $from_location, $player_id);
      return !empty($cards) ? reset($cards) : null;
    }

    public function pickCardsForLocation(
      int $nbr,
      string $from_location,
      string $to_location,
      int $to_location_arg = 0,
      bool $no_deck_reform = false
    ): array {
      $fromEsc = APP_DbObject::escapeStringForDB($from_location);
      $limit = max(0, (int) $nbr);
      $rows = APP_DbObject::getObjectListFromDB(
        $this->selectColumns() .
          " WHERE card_location = '$fromEsc' ORDER BY card_location_arg ASC, card_id ASC LIMIT $limit"
      );
      if (empty($rows)) {
        return [];
      }
      $ids = array_map(static fn($r) => (int) $r['id'], $rows);
      $this->moveCards($ids, $to_location, $to_location_arg);
      return array_values($this->getCards($ids));
    }

    public function pickCardForLocation(
      string $from_location,
      string $to_location,
      int $to_location_arg = 0
    ): ?array {
      $cards = $this->pickCardsForLocation(1, $from_location, $to_location, $to_location_arg);
      return !empty($cards) ? reset($cards) : null;
    }

    public function getCard($card_id): ?array
    {
      return APP_DbObject::getObjectFromDB(
        $this->selectColumns() . " WHERE card_id = " . (int) $card_id
      );
    }

    public function getCards(array $card_array): array
    {
      if (empty($card_array)) {
        return [];
      }
      $ids = array_map('intval', $card_array);
      $inList = implode(',', $ids);
      return APP_DbObject::getCollectionFromDB(
        $this->selectColumns() . " WHERE card_id IN ($inList)"
      );
    }

    public function getCardsInLocation(
      string $location,
      $location_arg = null,
      ?string $order_by = null
    ): array {
      $locEsc = APP_DbObject::escapeStringForDB($location);
      $sql = $this->selectColumns() . " WHERE card_location = '$locEsc'";
      if ($location_arg !== null) {
        $sql .= " AND card_location_arg = " . (int) $location_arg;
      }
      if ($order_by !== null && $order_by !== '') {
        $sql .= " ORDER BY $order_by";
      }
      return APP_DbObject::getCollectionFromDB($sql);
    }

    public function getPlayerHand($player_id): array
    {
      return $this->getCardsInLocation('hand', $player_id);
    }

    public function countCardInLocation(string $location, $location_arg = null): int
    {
      $locEsc = APP_DbObject::escapeStringForDB($location);
      $sql = "SELECT COUNT(*) FROM {$this->table} WHERE card_location = '$locEsc'";
      if ($location_arg !== null) {
        $sql .= " AND card_location_arg = " . (int) $location_arg;
      }
      return (int) APP_DbObject::getUniqueValueFromDB($sql);
    }

    public function countCardsInLocation(string $location, $location_arg = null): int
    {
      return $this->countCardInLocation($location, $location_arg);
    }

    public function countCardsByLocationArgs(string $location): array
    {
      $locEsc = APP_DbObject::escapeStringForDB($location);
      $sql = "SELECT card_location_arg, COUNT(*) AS cnt FROM {$this->table} WHERE card_location = '$locEsc' GROUP BY card_location_arg";
      $raw = APP_DbObject::getCollectionFromDB($sql, true);
      $res = [];
      foreach ($raw as $locArg => $cnt) {
        if ((int) $cnt > 0) {
          $res[$locArg] = (int) $cnt;
        }
      }
      return $res;
    }

    public function getCardsOfType($type, $type_arg = null): array
    {
      $typeEsc = APP_DbObject::escapeStringForDB((string) $type);
      $sql = $this->selectColumns() . " WHERE card_type = '$typeEsc'";
      if ($type_arg !== null) {
        $sql .= " AND card_type_arg = " . (int) $type_arg;
      }
      return APP_DbObject::getCollectionFromDB($sql);
    }

    public function getCardsOfTypeInLocation(
      $type,
      $type_arg = null,
      ?string $location = null,
      $location_arg = null
    ): array {
      $typeEsc = APP_DbObject::escapeStringForDB((string) $type);
      $sql = $this->selectColumns() . " WHERE card_type = '$typeEsc'";
      if ($type_arg !== null) {
        $sql .= " AND card_type_arg = " . (int) $type_arg;
      }
      if ($location !== null) {
        $locEsc = APP_DbObject::escapeStringForDB($location);
        $sql .= " AND card_location = '$locEsc'";
      }
      if ($location_arg !== null) {
        $sql .= " AND card_location_arg = " . (int) $location_arg;
      }
      return APP_DbObject::getCollectionFromDB($sql);
    }

    public function moveCard($card_id, string $location, $location_arg = 0): void
    {
      $locEsc = APP_DbObject::escapeStringForDB($location);
      $locArg = (int) ($location_arg ?? 0);
      APP_DbObject::DbQuery(
        "UPDATE {$this->table} SET card_location = '$locEsc', card_location_arg = $locArg WHERE card_id = " .
          (int) $card_id
      );
    }

    public function moveCards(array $cards, string $location, $location_arg = 0): void
    {
      if (empty($cards)) {
        return;
      }
      $locEsc = APP_DbObject::escapeStringForDB($location);
      $locArg = (int) ($location_arg ?? 0);
      $ids = implode(',', array_map('intval', $cards));
      APP_DbObject::DbQuery(
        "UPDATE {$this->table} SET card_location = '$locEsc', card_location_arg = $locArg WHERE card_id IN ($ids)"
      );
    }

    public function moveAllCardsInLocation(
      ?string $from_location,
      string $to_location,
      $from_location_arg = null,
      $to_location_arg = 0
    ): void {
      $toEsc = APP_DbObject::escapeStringForDB($to_location);
      $toArg = (int) ($to_location_arg ?? 0);
      $sql = "UPDATE {$this->table} SET card_location = '$toEsc', card_location_arg = $toArg";
      $where = [];
      if ($from_location !== null) {
        $fromEsc = APP_DbObject::escapeStringForDB($from_location);
        $where[] = "card_location = '$fromEsc'";
      }
      if ($from_location_arg !== null) {
        $where[] = "card_location_arg = " . (int) $from_location_arg;
      }
      if (!empty($where)) {
        $sql .= " WHERE " . implode(" AND ", $where);
      }
      APP_DbObject::DbQuery($sql);
    }
  }

  class GameState
  {
    private $game;
    public array $states = [];
    private int $transitionDepth = 0;

    public function getTransitionDepth(): int
    {
      return $this->transitionDepth;
    }

    public function __construct($game = null)
    {
      $this->game = $game;
      $statesFile = dirname(__DIR__) . '/states.inc.php';
      if (file_exists($statesFile)) {
        $machinestates = [];
        require $statesFile;
        $this->states = $machinestates;
      }
      if (!isset($this->states[1])) {
        $this->states[1] = [
          'name' => 'gameSetup',
          'description' => '',
          'type' => 'manager',
          'transitions' => ['' => 10],
        ];
      }
      if (!isset($this->states[99])) {
        $this->states[99] = [
          'name' => 'gameEnd',
          'description' => clienttranslate('End of game'),
          'descriptionmyturn' => clienttranslate('End of game'),
          'type' => 'manager',
          'possibleactions' => [],
          'transitions' => [],
        ];
      }
    }

    public function getStateId(): int
    {
      $val = APP_DbObject::getUniqueValueFromDB(
        "SELECT global_value FROM global WHERE global_id = 1"
      );
      return $val !== null ? (int) $val : 10;
    }

    public function setStateId(int $stateId): void
    {
      APP_DbObject::DbQuery(
        "INSERT OR REPLACE INTO global (global_id, global_value) VALUES (1, " . (int) $stateId . ")"
      );
    }

    public function getActivePlayerId(): string
    {
      $val = APP_DbObject::getUniqueValueFromDB(
        "SELECT global_value FROM global WHERE global_id = 2"
      );
      return $val !== null ? (string) $val : '0';
    }

    public function changeActivePlayer($player_id): void
    {
      APP_DbObject::DbQuery(
        "INSERT OR REPLACE INTO global (global_id, global_value) VALUES (2, " .
          (int) $player_id .
          ")"
      );
    }

    public function getPlayerActiveThisTurn(): string
    {
      return $this->getActivePlayerId();
    }

    private function getMultiactivePlayers(): array
    {
      $list = APP_DbObject::getObjectListFromDB(
        "SELECT player_id FROM player WHERE player_is_multiactive = 1 ORDER BY player_no ASC",
        true
      );
      return array_values(array_map('strval', $list));
    }

    public function getActivePlayerList(): array
    {
      $stateId = $this->getStateId();
      $def = $this->states[$stateId] ?? ['type' => 'game'];
      $type = $def['type'] ?? 'game';
      if ($type === 'activeplayer') {
        $act = $this->getActivePlayerId();
        return $act && $act !== '0' ? [(string) $act] : [];
      }
      if ($type === 'multipleactiveplayer') {
        return $this->getMultiactivePlayers();
      }
      return [];
    }

    public function isMutiactiveState(): bool
    {
      $stateId = $this->getStateId();
      return ($this->states[$stateId]['type'] ?? '') === 'multipleactiveplayer';
    }

    public function isMultiactiveState(): bool
    {
      return $this->isMutiactiveState();
    }

    public function isPlayerActive($player_id): bool
    {
      $stateId = $this->getStateId();
      $type = $this->states[$stateId]['type'] ?? 'game';
      if ($type === 'activeplayer') {
        return (string) $this->getActivePlayerId() === (string) $player_id;
      }
      if ($type === 'multipleactiveplayer') {
        return in_array((string) $player_id, $this->getActivePlayerList(), true);
      }
      return false;
    }

    private function computeRawArgs(array $def): array
    {
      if (!empty($def['args']) && $this->game && method_exists($this->game, $def['args'])) {
        $res = $this->game->{$def['args']}();
        return is_array($res) ? $res : [];
      }
      return [];
    }

    private function resolveArgsForViewer(array $rawArgs, ?int $viewerPlayerId): array
    {
      if (!array_key_exists('_private', $rawArgs)) {
        return $rawArgs;
      }
      $args = $rawArgs;
      $privateMap = $rawArgs['_private'];
      unset($args['_private']);

      if ($viewerPlayerId === null || !is_array($privateMap)) {
        return $args;
      }

      if (array_key_exists('active', $privateMap)) {
        if ($this->isPlayerActive($viewerPlayerId)) {
          $args['_private'] = $privateMap['active'];
        }
      } elseif (array_key_exists($viewerPlayerId, $privateMap)) {
        $args['_private'] = $privateMap[$viewerPlayerId];
      } elseif (array_key_exists((string) $viewerPlayerId, $privateMap)) {
        $args['_private'] = $privateMap[(string) $viewerPlayerId];
      }

      return $args;
    }

    public function state(?int $viewerPlayerId = null): array
    {
      $stateId = $this->getStateId();
      $def = $this->states[$stateId] ?? [
        'name' => 'unknown',
        'description' => '',
        'descriptionmyturn' => '',
        'type' => 'game',
        'possibleactions' => [],
        'transitions' => [],
      ];
      $rawArgs = $this->computeRawArgs($def);
      return $this->buildStateArray($stateId, $def, $rawArgs, $viewerPlayerId);
    }

    private function buildStateArray(
      int $stateId,
      array $def,
      array $rawArgs,
      ?int $viewerPlayerId
    ): array {
      $type = $def['type'] ?? 'game';
      $activePlayer = (string) $this->getActivePlayerId();
      $multiactive = $type === 'multipleactiveplayer' ? $this->getActivePlayerList() : [];
      $args = $this->resolveArgsForViewer($rawArgs, $viewerPlayerId);

      $stateArr = [
        'id' => (string) $stateId,
        'name' => $def['name'] ?? '',
        'type' => $type,
        'description' => $def['description'] ?? '',
        'descriptionmyturn' => $def['descriptionmyturn'] ?? ($def['description'] ?? ''),
        'possibleactions' => $def['possibleactions'] ?? [],
        'transitions' => $def['transitions'] ?? [],
        'active_player' => $activePlayer,
        'multiactive' => $multiactive,
        'args' => $args,
        'reflexion' => ['total' => []],
      ];

      if (!empty($def['updateGameProgression']) && $this->game && method_exists($this->game, 'getGameProgression')) {
        $stateArr['updateGameProgression'] = (int) $this->game->getGameProgression();
      }

      return $stateArr;
    }

    public function getCurrentMainState(): object
    {
      return (object) $this->state();
    }

    public function getCurrentMainStateId(): int
    {
      return $this->getStateId();
    }

    public function getAllStatesForClient(): array
    {
      $out = [];
      foreach ($this->states as $id => $def) {
        $out[$id] = [
          'id' => (string) $id,
          'name' => $def['name'] ?? '',
          'type' => $def['type'] ?? 'game',
          'description' => $def['description'] ?? '',
          'descriptionmyturn' => $def['descriptionmyturn'] ?? ($def['description'] ?? ''),
          'possibleactions' => $def['possibleactions'] ?? [],
          'transitions' => $def['transitions'] ?? [],
          'updateGameProgression' => !empty($def['updateGameProgression']) ? 1 : 0,
        ];
      }
      return $out;
    }

    public function getStateNumberByTransition($transition = ''): int
    {
      $stateId = $this->getStateId();
      $def = $this->states[$stateId] ?? [];
      $transitions = $def['transitions'] ?? [];
      foreach ($transitions as $name => $nextId) {
        if ($transition === $name || $transition === '' || $transition === null) {
          return (int) $nextId;
        }
      }
      if (is_numeric($transition) && isset($this->states[(int) $transition])) {
        return (int) $transition;
      }
      throw new \feException(
        "This transition ($transition) is impossible at this state ($stateId)"
      );
    }

    public function nextState($transition = ''): void
    {
      $nextId = $this->getStateNumberByTransition((string) $transition);
      $this->jumpToState($nextId);
    }

    public function jumpToState(int $stateNum): void
    {
      if ($this->transitionDepth === 0 && $this->game) {
        $this->game->ensureMoveStarted();
      }
      $this->transitionDepth++;
      try {
        $this->setStateId($stateNum);
        $def = $this->states[$stateNum] ?? [];
        $rawArgs = $this->computeRawArgs($def);
        $publicState = $this->buildStateArray($stateNum, $def, $rawArgs, null);

        if ($this->game) {
          if (isset($rawArgs['_private']) && is_array($rawArgs['_private'])) {
            $privateMap = $rawArgs['_private'];
            if (array_key_exists('active', $privateMap)) {
              $actId = (int) $this->getActivePlayerId();
              if ($actId > 0) {
                $this->game->notifyPlayer(
                  $actId,
                  'gameStateChangePrivateArg',
                  '',
                  $privateMap['active']
                );
              }
            } else {
              foreach ($privateMap as $pId => $privData) {
                if (is_numeric($pId) && (int) $pId > 0) {
                  $this->game->notifyPlayer((int) $pId, 'gameStateChangePrivateArg', '', $privData);
                }
              }
            }
          }

          $this->game->notifyAllPlayers('gameStateChange', '', $publicState);

          if (!empty($def['action']) && method_exists($this->game, $def['action'])) {
            $actionMethod = $def['action'];
            $this->game->$actionMethod();
          }
        }
      } finally {
        $this->transitionDepth--;
        if ($this->transitionDepth === 0 && $this->game) {
          $this->game->onTopLevelTransitionComplete();
        }
      }
    }

    public function setAllPlayersMultiactive(): void
    {
      APP_DbObject::DbQuery("UPDATE player SET player_is_multiactive = 1");
      if ($this->game) {
        $this->game->notifyAllPlayers(
          'gameStateMultipleActiveUpdate',
          '',
          $this->getMultiactivePlayers()
        );
      }
    }

    public function setPlayersMultiactive($players, $next_state, $bExclusive = false): bool
    {
      if ($this->transitionDepth === 0 && $this->game) {
        $this->game->ensureMoveStarted();
      }
      $this->transitionDepth++;
      try {
        if ($bExclusive) {
          APP_DbObject::DbQuery("UPDATE player SET player_is_multiactive = 0");
        }
        if (!empty($players)) {
          $ids = implode(',', array_map('intval', $players));
          APP_DbObject::DbQuery(
            "UPDATE player SET player_is_multiactive = 1 WHERE player_id IN ($ids)"
          );
        }
        $activeList = $this->getMultiactivePlayers();
        if ($this->game) {
          $this->game->notifyAllPlayers('gameStateMultipleActiveUpdate', '', $activeList);
        }
        if (count($activeList) === 0 && $next_state !== '' && $next_state !== null) {
          $this->nextState($next_state);
          return true;
        }
        return false;
      } finally {
        $this->transitionDepth--;
        if ($this->transitionDepth === 0 && $this->game) {
          $this->game->onTopLevelTransitionComplete();
        }
      }
    }

    public function setPlayerNonMultiactive($player_id, $next_state): bool
    {
      if ($this->transitionDepth === 0 && $this->game) {
        $this->game->ensureMoveStarted();
      }
      $this->transitionDepth++;
      try {
        APP_DbObject::DbQuery(
          "UPDATE player SET player_is_multiactive = 0 WHERE player_id = " . (int) $player_id
        );
        $activeList = $this->getMultiactivePlayers();
        if ($this->game) {
          $this->game->notifyAllPlayers('gameStateMultipleActiveUpdate', '', $activeList);
        }
        if (count($activeList) === 0) {
          if ($next_state !== '' && $next_state !== null) {
            $this->nextState($next_state);
          }
          return true;
        }
        return false;
      } finally {
        $this->transitionDepth--;
        if ($this->transitionDepth === 0 && $this->game) {
          $this->game->onTopLevelTransitionComplete();
        }
      }
    }

    public function updateMultiactiveOrNextState($next_state_if_none): bool
    {
      if ($this->transitionDepth === 0 && $this->game) {
        $this->game->ensureMoveStarted();
      }
      $this->transitionDepth++;
      try {
        $activeList = $this->getMultiactivePlayers();
        if ($this->game) {
          $this->game->notifyAllPlayers('gameStateMultipleActiveUpdate', '', $activeList);
        }
        if (count($activeList) === 0 && $next_state_if_none !== '' && $next_state_if_none !== null) {
          $this->nextState($next_state_if_none);
          return true;
        }
        return false;
      } finally {
        $this->transitionDepth--;
        if ($this->transitionDepth === 0 && $this->game) {
          $this->game->onTopLevelTransitionComplete();
        }
      }
    }

    public function checkPossibleAction(string $action): void
    {
      $stateId = $this->getStateId();
      $def = $this->states[$stateId] ?? [];
      $possible = $def['possibleactions'] ?? [];
      if (!in_array($action, $possible, true)) {
        $stateName = $def['name'] ?? (string) $stateId;
        throw new \Bga\GameFramework\UserException(
          "Action '$action' is not allowed in current game state '$stateName'"
        );
      }
    }

    public function reloadState(): array
    {
      return $this->state();
    }
  }
}

namespace Bga\GameFramework {
  abstract class Table extends \APP_DbObject
  {
    public Bga $bga;
    public ?\GameState $gamestate = null;
    public bool $bSelectGlobalsForUpdate = false;
    public bool $not_a_move_notification = false;
    protected array $stateLabels = [];
    protected int $currentPlayerId = 2385074;
    protected array $basicPlayersCache = [];
    protected bool $moveInProgress = false;
    protected bool $inAjaxAction = false;
    protected bool $ownActionTransaction = false;

    public function __construct()
    {
      $this->bga = new Bga();
      $materialFile = dirname(__DIR__) . '/material.inc.php';
      if (file_exists($materialFile)) {
        require $materialFile;
      }
      $this->gamestate = new \GameState($this);
    }

    public static function _($s): string
    {
      return (string) $s;
    }

    public function setCurrentPlayerId(int $playerId): void
    {
      $this->currentPlayerId = $playerId;
    }

    public function getCurrentPlayerId(): int
    {
      return $this->currentPlayerId;
    }

    public function getCurrentPlayerName(): string
    {
      $players = $this->loadPlayersBasicInfos();
      return $players[$this->currentPlayerId]['player_name'] ?? '';
    }

    public function getCurrentPlayerColor(): string
    {
      $players = $this->loadPlayersBasicInfos();
      return $players[$this->currentPlayerId]['player_color'] ?? '000000';
    }

    public function isCurrentPlayerZombie(): bool
    {
      $players = $this->loadPlayersBasicInfos();
      return !empty($players[$this->currentPlayerId]['player_zombie']);
    }

    public function getActivePlayerId()
    {
      return $this->gamestate->getActivePlayerId();
    }

    public function getActivePlayerName(): string
    {
      $actId = (int) $this->getActivePlayerId();
      $players = $this->loadPlayersBasicInfos();
      return $players[$actId]['player_name'] ?? '';
    }

    public function loadPlayersBasicInfos(): array
    {
      $rows = self::getCollectionFromDB(
        "SELECT player_id, player_no, player_name, player_color, player_score, player_score_aux, player_zombie, player_eliminated, player_is_multiactive, player_avatar, player_canal, player_team FROM player ORDER BY player_no ASC"
      );
      $this->basicPlayersCache = $rows;
      return $rows;
    }

    public function reloadPlayersBasicInfos(): void
    {
      $this->loadPlayersBasicInfos();
    }

    public function getPlayersNumber(): int
    {
      return (int) self::getUniqueValueFromDB("SELECT COUNT(*) FROM player");
    }

    public function getPlayerNameById($player_id): string
    {
      $players = $this->loadPlayersBasicInfos();
      return $players[$player_id]['player_name'] ?? '';
    }

    public function getPlayerNoById($player_id): int
    {
      $players = $this->loadPlayersBasicInfos();
      return (int) ($players[$player_id]['player_no'] ?? 0);
    }

    public function getPlayerColorById($player_id): string
    {
      $players = $this->loadPlayersBasicInfos();
      return $players[$player_id]['player_color'] ?? '000000';
    }

    public function initGameStateLabels(array $labels): void
    {
      $this->stateLabels = $labels;
    }

    protected function resolveGlobalId($labelOrId): int
    {
      if (isset($this->stateLabels[$labelOrId])) {
        return (int) $this->stateLabels[$labelOrId];
      }
      if (is_numeric($labelOrId)) {
        return (int) $labelOrId;
      }
      throw new SystemException("Unknown game state label: $labelOrId");
    }

    public function setGameStateInitialValue($value_label, $value_value): void
    {
      $id = $this->resolveGlobalId($value_label);
      self::DbQuery(
        "INSERT OR REPLACE INTO global (global_id, global_value) VALUES ($id, " .
          (int) $value_value .
          ")"
      );
    }

    public function getGameStateValue($value_label, $default = 0)
    {
      $id = $this->resolveGlobalId($value_label);
      $val = self::getUniqueValueFromDB(
        "SELECT global_value FROM global WHERE global_id = $id"
      );
      return $val !== null ? (int) $val : $default;
    }

    public function setGameStateValue($value_label, $value_value): void
    {
      $id = $this->resolveGlobalId($value_label);
      self::DbQuery(
        "INSERT OR REPLACE INTO global (global_id, global_value) VALUES ($id, " .
          (int) $value_value .
          ")"
      );
    }

    public function incGameStateValue($value_label, $increment): int
    {
      $cur = (int) $this->getGameStateValue($value_label, 0);
      $next = $cur + (int) $increment;
      $this->setGameStateValue($value_label, $next);
      return $next;
    }

    protected function activeNextPlayer(): int
    {
      $players = array_values($this->loadPlayersBasicInfos());
      if (empty($players)) {
        return 0;
      }
      $actId = (string) $this->getActivePlayerId();
      $count = count($players);
      for ($i = 0; $i < $count; $i++) {
        if ((string) $players[$i]['player_id'] === $actId) {
          $next = (int) $players[($i + 1) % $count]['player_id'];
          $this->gamestate->changeActivePlayer($next);
          return $next;
        }
      }
      $first = (int) $players[0]['player_id'];
      $this->gamestate->changeActivePlayer($first);
      return $first;
    }

    protected function activePrevPlayer(): int
    {
      $players = array_values($this->loadPlayersBasicInfos());
      if (empty($players)) {
        return 0;
      }
      $actId = (string) $this->getActivePlayerId();
      $count = count($players);
      for ($i = 0; $i < $count; $i++) {
        if ((string) $players[$i]['player_id'] === $actId) {
          $prev = (int) $players[($i + $count - 1) % $count]['player_id'];
          $this->gamestate->changeActivePlayer($prev);
          return $prev;
        }
      }
      $first = (int) $players[0]['player_id'];
      $this->gamestate->changeActivePlayer($first);
      return $first;
    }

    public function checkAction($actionName, $bThrowException = true): bool
    {
      try {
        $this->gamestate->checkPossibleAction($actionName);
        if (!$this->gamestate->isPlayerActive($this->currentPlayerId)) {
          throw new UserException(clienttranslate("This is not your turn"));
        }
        $this->ensureMoveStarted();
        return true;
      } catch (\Throwable $e) {
        if ($bThrowException) {
          throw $e;
        }
        return false;
      }
    }

    public function beginPlayerAction(): void
    {
      $pdo = self::getPdo();
      if (!$pdo->inTransaction()) {
        $pdo->beginTransaction();
        $this->ownActionTransaction = true;
      }
      $this->inAjaxAction = true;
      $this->ensureMoveStarted();
    }

    public function endPlayerAction(bool $rollback = false): void
    {
      $pdo = self::getPdo();
      if ($this->ownActionTransaction && $pdo->inTransaction()) {
        if ($rollback) {
          $pdo->rollBack();
        } else {
          $pdo->commit();
        }
      }
      $this->ownActionTransaction = false;
      $this->inAjaxAction = false;
      $this->moveInProgress = false;
    }

    public function rollbackPlayerAction(): void
    {
      $this->endPlayerAction(true);
    }

    public function ensureMoveStarted(): void
    {
      if (!$this->moveInProgress) {
        $this->incrementMoveId();
        $this->moveInProgress = true;
      }
    }

    public function onTopLevelTransitionComplete(): void
    {
      if (!$this->inAjaxAction) {
        $this->moveInProgress = false;
      }
    }

    public function initStat($table_or_player, $name, $value, $player_id = null): void
    {
      $nameEsc = self::escapeStringForDB($name);
      $val = (float) $value;
      if ($table_or_player === 'table') {
        self::DbQuery(
          "INSERT OR REPLACE INTO stats (stats_type, stats_player_id, stats_value) VALUES ('$nameEsc', 0, $val)"
        );
      } else {
        if ($player_id !== null) {
          $pId = (int) $player_id;
          self::DbQuery(
            "INSERT OR REPLACE INTO stats (stats_type, stats_player_id, stats_value) VALUES ('$nameEsc', $pId, $val)"
          );
        } else {
          $playerIds = self::getObjectListFromDB("SELECT player_id FROM player", true);
          foreach ($playerIds as $pId) {
            $pIdInt = (int) $pId;
            self::DbQuery(
              "INSERT OR REPLACE INTO stats (stats_type, stats_player_id, stats_value) VALUES ('$nameEsc', $pIdInt, $val)"
            );
          }
        }
      }
    }

    public function setStat($value, $name, $player_id = null, $bDoNotLoop = false): void
    {
      $nameEsc = self::escapeStringForDB($name);
      $val = (float) $value;
      $pId = $player_id !== null ? (int) $player_id : 0;
      self::DbQuery(
        "INSERT OR REPLACE INTO stats (stats_type, stats_player_id, stats_value) VALUES ('$nameEsc', $pId, $val)"
      );
    }

    public function incStat($delta, $name, $player_id = null): void
    {
      $cur = (float) $this->getStat($name, $player_id);
      $this->setStat($cur + (float) $delta, $name, $player_id);
    }

    public function getStat($name, $player_id = null)
    {
      $nameEsc = self::escapeStringForDB($name);
      $pId = $player_id !== null ? (int) $player_id : 0;
      $val = self::getUniqueValueFromDB(
        "SELECT stats_value FROM stats WHERE stats_type = '$nameEsc' AND stats_player_id = $pId"
      );
      return $val !== null ? (float) $val : 0;
    }

    public function getMoveId(): int
    {
      $val = self::getUniqueValueFromDB("SELECT global_value FROM global WHERE global_id = 3");
      return $val !== null ? (int) $val : 1;
    }

    public function incrementMoveId(): int
    {
      $next = $this->getMoveId() + 1;
      self::DbQuery("INSERT OR REPLACE INTO global (global_id, global_value) VALUES (3, $next)");
      return $next;
    }

    public function notifyAllPlayers($type, $message, $args = []): void
    {
      $this->insertNotification('/table/t1', (string) $type, (string) ($message ?? ''), $args);
    }

    public function notifyPlayer(
      $player_id,
      $notification_type,
      $notification_log,
      $notification_args = []
    ): void {
      $channel = '/player/p' . (int) $player_id;
      $this->insertNotification(
        $channel,
        (string) $notification_type,
        (string) ($notification_log ?? ''),
        $notification_args
      );
    }

    protected function insertNotification(
      string $channel,
      string $type,
      string $log,
      $args
    ): void {
      $this->ensureMoveStarted();
      $pdo = self::getPdo();
      $moveId = $this->getMoveId();
      $jsonArgs = json_encode($args ?? []);
      $stmt = $pdo->prepare(
        "INSERT INTO notifications (move_id, channel, type, log, args, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      );
      $stmt->execute([$moveId, $channel, $type, $log, $jsonArgs, time()]);

      // If called directly on $game (outside APP_GameAction and outside a state transition)
      // for an action that does not transition state (e.g. out-of-turn autopass, confirmTichu, or mid-round tichuBet),
      // close the move so the next direct call starts a fresh move_id.
      if (!$this->inAjaxAction && $this->gamestate && $this->gamestate->getTransitionDepth() === 0) {
        if ($type === 'autopass' || $type === 'confirmTichu') {
          $this->moveInProgress = false;
        } elseif ($type === 'tichuBet' && $this->gamestate->getStateId() !== 20 && (int) ($args['bet'] ?? 0) === 100) {
          $this->moveInProgress = false;
        }
      }
    }

    public function getNotificationsSince(
      int $lastPacketId = 0,
      ?int $viewerPlayerId = null,
      bool $allChannels = false
    ): array {
      $sql = "SELECT packet_id, move_id, channel, type, log, args, created_at FROM notifications WHERE packet_id > " . (int) $lastPacketId;
      if (!$allChannels && $viewerPlayerId !== null) {
        $pChan = '/player/p' . (int) $viewerPlayerId;
        $sql .= " AND (channel = '/table/t1' OR channel = '$pChan')";
      }
      $sql .= " ORDER BY packet_id ASC";
      $rows = self::getObjectListFromDB($sql);
      $packets = [];
      $pendingPrivateArg = null;
      foreach ($rows as $row) {
        $decodedArgs = json_decode($row['args'], true);
        if ($decodedArgs === null && $row['args'] !== 'null') {
          $decodedArgs = [];
        }
        if (!$allChannels && $viewerPlayerId !== null) {
          if ($row['type'] === 'gameStateChangePrivateArg' && $row['channel'] === '/player/p' . (int) $viewerPlayerId) {
            $pendingPrivateArg = $decodedArgs;
          } elseif ($row['type'] === 'gameStateChange' && $pendingPrivateArg !== null) {
            if (!isset($decodedArgs['args']) || !is_array($decodedArgs['args'])) {
              $decodedArgs['args'] = [];
            }
            $decodedArgs['args']['_private'] = $pendingPrivateArg;
            $pendingPrivateArg = null;
          }
        }
        $packets[] = [
          'packet_id' => (string) $row['packet_id'],
          'packet_type' => 'single',
          'move_id' => (string) $row['move_id'],
          'channel' => $row['channel'],
          'table_id' => 1,
          'time' => (string) $row['created_at'],
          'data' => [
            [
              'uid' => 'notif_' . $row['packet_id'],
              'type' => $row['type'],
              'log' => $row['log'],
              'args' => $decodedArgs,
              'h' => substr(md5('notif_' . $row['packet_id']), 0, 6),
            ],
          ],
        ];
      }
      return $packets;
    }

    public function getAllGamelogsForReplay(): array
    {
      return $this->getNotificationsSince(0, null, true);
    }

    public function giveExtraTime($player_id, $specific_time = null): void {}
    public function reattributeColorsBasedOnPreferences($players, $colors): void {}
    public function applyDbChangeToAllDB($sql): void {}
    public function applyDbUpgradeToAllDB($sql): void {}
    public function undoSavepoint(): void {}
    public function undoRestorePoint(): void {}
    public function say($text): void {}

    public function getBgaEnvironment(): string
    {
      return 'studio';
    }

    public function getGameinfos(): array
    {
      $gameinfos = [];
      require dirname(__DIR__) . '/gameinfos.inc.php';
      return $gameinfos;
    }

    abstract protected function setupNewGame($players, $options = []);
    abstract protected function getAllDatas(int $currentPlayerId);

    /**
     * Initializes a fresh local SQLite database and starts a new 4-player Tichu game.
     */
    public function createNewGame(array $options = [], ?array $customPlayers = null): void
    {
      self::initSchema();

      $gameLength = (int) ($options[100] ?? $options['gameLength'] ?? 2);
      $playerTeams = (int) ($options[101] ?? $options['playerTeams'] ?? 1);
      $gameVariant = (int) ($options[102] ?? $options['gameVariant'] ?? 1);
      $turnBased = !empty($options['turnBased']) ? 1 : 0;

      // Initialize reserved & option globals before setupNewGame runs
      self::DbQuery("INSERT OR REPLACE INTO global (global_id, global_value) VALUES (1, 1)");
      self::DbQuery("INSERT OR REPLACE INTO global (global_id, global_value) VALUES (2, 0)");
      self::DbQuery("INSERT OR REPLACE INTO global (global_id, global_value) VALUES (3, 1)");
      self::DbQuery("INSERT OR REPLACE INTO global (global_id, global_value) VALUES (100, $gameLength)");
      self::DbQuery("INSERT OR REPLACE INTO global (global_id, global_value) VALUES (101, $playerTeams)");
      self::DbQuery("INSERT OR REPLACE INTO global (global_id, global_value) VALUES (102, $gameVariant)");
      self::DbQuery("INSERT OR REPLACE INTO global (global_id, global_value) VALUES (200, $turnBased)");

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

      $this->setCurrentPlayerId((int) array_key_first($players));
      $this->moveInProgress = true;
      try {
        $nextStateId = $this->setupNewGame($players, $options);
        $this->gamestate->jumpToState((int) $nextStateId);
      } finally {
        $this->moveInProgress = false;
      }
    }

    /**
     * Returns the complete client `gamedatas` structure for `$viewerPlayerId`.
     */
    public function getFullClientPayload(int $viewerPlayerId): array
    {
      $this->setCurrentPlayerId($viewerPlayerId);
      $datas = $this->getAllDatas($viewerPlayerId);
      $basic = $this->loadPlayersBasicInfos();

      foreach ($datas['players'] as $pId => &$pRow) {
        $bRow = $basic[$pId] ?? [];
        $pRow['id'] = (int) $pId;
        $pRow['no'] = (int) ($pRow['no'] ?? $bRow['player_no'] ?? 0);
        $pRow['name'] = $pRow['name'] ?? $bRow['player_name'] ?? '';
        $pRow['color'] = $bRow['player_color'] ?? '000000';
        $pRow['color_back'] = null;
        $pRow['score'] = (string) ($pRow['score'] ?? $bRow['player_score'] ?? '0');
        $pRow['score_aux'] = (string) ($bRow['player_score_aux'] ?? '0');
        $pRow['zombie'] = (int) ($bRow['player_zombie'] ?? 0);
        $pRow['eliminated'] = (int) ($bRow['player_eliminated'] ?? 0);
        $pRow['is_ai'] = '0';
        $pRow['beginner'] = false;
        $pRow['avatar'] = $bRow['player_avatar'] ?? '000000';
      }
      unset($pRow);

      // Compute playerorder starting from $viewerPlayerId in seat order (player_no ASC)
      $orderedIds = array_map(
        static fn($r) => (int) $r['player_id'],
        array_values($basic)
      );
      $count = count($orderedIds);
      for ($i = 0; $i < $count; $i++) {
        if ($orderedIds[0] === $viewerPlayerId) {
          break;
        }
        $orderedIds[] = array_shift($orderedIds);
      }

      $lastPacketId = (int) (self::getUniqueValueFromDB(
        "SELECT IFNULL(MAX(packet_id), 0) FROM notifications"
      ) ?? 0);

      $datas['playerorder'] = $orderedIds;
      $datas['gamestate'] = $this->gamestate->state($viewerPlayerId);
      $datas['gamestates'] = $this->gamestate->getAllStatesForClient();
      $datas['tablespeed'] = $this->bga->tableOptions->isTurnBased() ? 20 : 1;
      $datas['notifications'] = [
        'last_packet_id' => $lastPacketId,
        'move_nbr' => $this->getMoveId(),
      ];

      return $datas;
    }
  }
}

namespace {
  if (!class_exists('Table')) {
    class_alias(\Bga\GameFramework\Table::class, 'Table');
  }

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
