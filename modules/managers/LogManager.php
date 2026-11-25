<?php

use Bga\GameFramework\Table;

class LogManager
{
  private static ?LogManager $instance = null;
  public static function getInstance(): LogManager
  {
    if (self::$instance == null) {
      self::$instance = new LogManager();
    }
    return self::$instance;
  }

  // Clunky workaround for being able to unit test the Combo class, which requires to know about the last combo to assess the phoenix value.
  public static ?Combo $lastComboForTesting = null;

  public static function insert(int|string $playerId, string $action, mixed $args = []): void
  {
    $pId = (int) ($playerId == -1 ? Tichu::$instance->getActivePlayerId() : $playerId);
    $current = self::getCurrentDbRoundAndTrick();
    $round = (int) ($current["round"] ?? 0);
    $trick = (int) ($current["trick"] ?? 0);
    if ($action == "newTrick") {
      $trick =
        ((int) Table::getUniqueValueFromDB("SELECT IFNULL(MAX(log_trick),0) FROM actionlog")) + 1;
    }
    if ($action == "newRound") {
      $round++;
      $trick = 0;
    }

    $rawJson = json_encode($args);
    $escapedAction = Table::escapeStringForDB($action);
    $actionArgs = Table::escapeStringForDB($rawJson !== false ? $rawJson : "{}");
    Table::DbQuery(
      "INSERT INTO actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ($pId, $round, $trick, '$escapedAction', '$actionArgs')"
    );
  }

  /**
   * @param string|array<int, string> $action
   * @return ($single is true ? array<string, mixed>|null : array<int, array<string, mixed>>)
   */
  public static function getLastActions(
    string|array $action,
    bool $currentTrick = true,
    bool $single = false
  ): ?array {
    $arr = is_array($action) ? $action : [$action];
    $escapedArr = array_map(
      static fn($a): string => Table::escapeStringForDB((string) $a),
      $arr
    );
    $actions = implode("','", $escapedArr);

    $sql = "SELECT log_id id, log_player player, log_round round, log_trick trick, log_action action, log_arg arg	FROM actionlog WHERE log_action in ('$actions')";

    if ($currentTrick) {
      $sql .= " AND " . self::getCurrentTrickCond();
    }
    $sql .= " ORDER BY log_id DESC";
    $res = Table::getObjectListFromDB($sql);

    if (count($res) == 0) {
      return $single ? null : [];
    }
    $ret = [];
    foreach ($res as $row) {
      $row["arg"] = json_decode((string) $row["arg"], true);
      if ($single) {
        return $row;
      }
      $ret[] = $row;
    }
    return $ret;
  }

  /**
   * @param string|array<int, string> $action
   * @return array<string, mixed>|null
   */
  public static function getLastAction(string|array $action, bool $currentTrick = true): ?array
  {
    return self::getLastActions($action, $currentTrick, true);
  }

  /**
   * @return array<string, mixed>|null
   */
  public static function getCurrentDbRoundAndTrick(): ?array
  {
    return Table::getObjectFromDB(
      "SELECT IFNULL(MAX(log_round),0) AS round, IFNULL(MAX(log_trick),0) AS trick FROM actionlog WHERE log_round = (SELECT IFNULL(MAX(log_round), 0) FROM actionlog)"
    );
  }

  /**
   * @return array<string, mixed>|null
   */
  public static function getCurrentRoundAndTrick(): ?array
  {
    return Table::getObjectFromDB(
      "SELECT IFNULL(MAX(log_round),0) AS round, COUNT(DISTINCT CASE WHEN log_trick > 0 THEN log_trick END) AS trick FROM actionlog WHERE log_round = (SELECT IFNULL(MAX(log_round), 0) FROM actionlog)"
    );
  }

  public static function getCurrentTrickCond(): string
  {
    $curr = self::getCurrentDbRoundAndTrick();
    return "log_round=" .
      ((int) ($curr["round"] ?? 0)) .
      " AND log_trick=" .
      ((int) ($curr["trick"] ?? 0));
  }

  /**
   * @return int|float|array<int, int|float>|null
   */
  private static function normalizePhoenixValue(mixed $phoenixValue): int|float|array|null
  {
    if (is_array($phoenixValue)) {
      return array_values(
        array_map(static fn($v) => is_numeric($v) ? $v + 0 : (int) $v, $phoenixValue)
      );
    }
    if (is_numeric($phoenixValue)) {
      return $phoenixValue + 0;
    }
    return null;
  }

  /**
   * @return array{0: array<int|string, mixed>, 1: array<int, int>}
   */
  public static function getLastCombos(): array
  {
    // All "combo" and "pass" actions from the current trick.
    // Sorted descending by log id. So let's iterate over the array and find
    // the last action for each player.
    $actions = self::getLastActions(["combo", "pass"]);
    $combos = [];
    $passes = [];
    // We cannot simply look at the last 4 actions, because the dog might have
    // been played or a player has already gone out. So we go through all
    // actions and remember which player we have already processed.
    $playerIdsProcessed = [];
    foreach ($actions as $action) {
      $playerId = $action["player"];
      if (in_array($playerId, $playerIdsProcessed)) {
        continue;
      }
      $playerIdsProcessed[] = $playerId;

      if ($action["action"] == "pass") {
        $passes[] = intval($playerId);
      }
      if ($action["action"] == "combo") {
        if (is_array($action["arg"]) && array_key_exists("phoenixValue", $action["arg"])) {
          $action["arg"]["phoenixValue"] = self::normalizePhoenixValue(
            $action["arg"]["phoenixValue"]
          );
        }
        $combos[$playerId] = $action["arg"];
      }
    }
    return [$combos, $passes];
  }

  public static function getLastCombo(int $skip = 0, string $action = "combo"): Combo
  {
    if (self::$lastComboForTesting != null) {
      return self::$lastComboForTesting;
    }
    $lastComboActions = self::getLastActions($action);
    if (count($lastComboActions) > $skip) {
      $lastComboAction = $lastComboActions[$skip];
      $arg = $lastComboAction["arg"];
      $combo = new Combo(
        $arg["cards"],
        $arg["type"],
        self::normalizePhoenixValue($arg["phoenixValue"] ?? null),
        $arg["description"]
      );
      $combo->player = $lastComboAction["player"];
      return $combo;
    }
    return Combo::$noCombo;
  }

  public static function getLastComboPlayer(): int|string
  {
    $lastComboAction = self::getLastAction("combo");
    return is_null($lastComboAction) ? 0 : $lastComboAction["player"];
  }

  public static function playCombo(int|string $playerId, Combo $combo): void
  {
    $cards = Utils::filterColumns($combo->cards ?? [], ["id", "type", "type_arg"]);
    self::insert($playerId, "combo", [
      "description" => $combo->description,
      "type" => $combo->type,
      "cards" => $cards,
      "phoenixValue" => $combo->phoenixValue,
    ]);
  }

  public static function askPhoenix(int|string $playerId, Combo $combo): void
  {
    $cards = Utils::filterColumns($combo->cards ?? [], ["id", "type", "type_arg"]);
    self::insert($playerId, "phoenix", [
      "description" => $combo->description,
      "type" => $combo->type,
      "cards" => $cards,
      "phoenixValue" => $combo->phoenixValue,
    ]);
  }

  public static function hasPlayerPlayedOrPassedInCurrentRound(int|string $playerId): bool
  {
    $pId = (int) $playerId;
    if ($pId <= 0) {
      return false;
    }
    $curr = self::getCurrentDbRoundAndTrick();
    $round = (int) ($curr["round"] ?? 0);
    if ($round <= 0) {
      return false;
    }
    $count = (int) Table::getUniqueValueFromDB(
      "SELECT COUNT(*) FROM actionlog WHERE log_round = $round AND log_player = $pId AND log_action IN ('combo', 'pass')"
    );
    return $count > 0;
  }

  /**
   * Return recorded per-round score summaries in ascending chronological order.
   *
   * @return array<int, array<string, mixed>>
   */
  public static function getRoundScores(): array
  {
    $rows = self::getLastActions("roundScore", false);
    if (count($rows) === 0) {
      return [];
    }
    $rows = array_reverse($rows);
    $records = [];
    foreach ($rows as $row) {
      $arg = is_array($row["arg"] ?? null) ? $row["arg"] : [];
      $cardPoints = is_array($arg["cardPoints"] ?? null) ? $arg["cardPoints"] : [0, 0];
      $teamPoints = is_array($arg["teamPoints"] ?? null) ? $arg["teamPoints"] : [0, 0];
      $teamTotals = is_array($arg["teamTotals"] ?? null) ? $arg["teamTotals"] : [0, 0];
      $rawBets = is_array($arg["bets"] ?? null) ? $arg["bets"] : [];
      $bets = [];
      foreach ($rawBets as $pid => $betInfo) {
        if (!is_array($betInfo)) {
          continue;
        }
        $bets[(string) $pid] = [
          "type" => (string) ($betInfo["type"] ?? "T") === "GT" ? "GT" : "T",
          "won" => (bool) ($betInfo["won"] ?? false),
          "delta" => (int) ($betInfo["delta"] ?? 0),
        ];
      }
      $records[] = [
        "round" => (int) ($arg["round"] ?? $row["round"] ?? 0),
        "cardPoints" => [(int) ($cardPoints[0] ?? 0), (int) ($cardPoints[1] ?? 0)],
        "doubleVictory" => array_key_exists("doubleVictory", $arg)
          ? (int) $arg["doubleVictory"]
          : -1,
        "bets" => count($bets) > 0 ? $bets : (object) [],
        "teamPoints" => [(int) ($teamPoints[0] ?? 0), (int) ($teamPoints[1] ?? 0)],
        "teamTotals" => [(int) ($teamTotals[0] ?? 0), (int) ($teamTotals[1] ?? 0)],
      ];
    }
    return $records;
  }
}
?>
