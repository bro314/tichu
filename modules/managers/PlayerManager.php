<?php

use Bga\GameFramework\Table;

class PlayerManager
{
  private static ?PlayerManager $instance = null;
  public static function getInstance(): PlayerManager
  {
    if (self::$instance == null) {
      self::$instance = new PlayerManager();
    }
    return self::$instance;
  }

  /**
   * @param array<int|string, array<string, mixed>> $players
   */
  public static function setupPlayers(array $players): void
  {
    // Set the colors (red & black) of the players with HTML color code
    $default_colors = ["000000", "ff0000", "000000", "ff0000"];
    // Note: if you added some extra field on "player" table in the database (dbmodel.sql), you can initialize it there.
    $sql =
      "INSERT INTO player (player_id, player_no, player_score, player_team, player_color, player_canal, player_name, player_avatar) VALUES ";
    $values = [];
    $counter = 0;

    $order_values = [];
    foreach ($players as $player_id => $player) {
      $order_values[] = $player["player_table_order"];
    }
    sort($order_values);

    $position = [];
    foreach ($order_values as $key => $val) {
      $position[$val] = $key + 1;
    }

    $playerIds = array_keys($players);
    if (Tichu::$instance->getGameStateValue("playerTeams") == TEAM_RANDOM) {
      for ($i = count($playerIds) - 1; $i > 0; $i--) {
        $j = bga_rand(0, $i);
        [$playerIds[$i], $playerIds[$j]] = [$playerIds[$j], $playerIds[$i]];
      }
    }

    foreach ($playerIds as $player_id) {
      $player = $players[$player_id];
      $color = "ffffff"; // Default to white (should never be left to white unless the following doesn't work)
      $player_no = 9; // Default to 9 (should never be left to 9 unless the following doesn't work)
      $player_team = 0; // Default to team 0 unless overwritten below
      $counter++;

      if (Tichu::$instance->getGameStateValue("playerTeams") == TEAM_RANDOM) {
        $color = (string) array_shift($default_colors);
        $player_no = $counter;
        $player_team = ($counter - 1) % 2;
      } elseif (isset($player["player_table_order"])) {
        $table_order = $position[$player["player_table_order"]]; // By default TEAM_1_3

        if (Tichu::$instance->getGameStateValue("playerTeams") == TEAM_1_2) {
          // If TEAM_1_2 swap 2 and 3
          $table_order = $table_order == 2 ? 3 : ($table_order == 3 ? 2 : $table_order);
        } elseif (Tichu::$instance->getGameStateValue("playerTeams") == TEAM_1_4) {
          // If TEAM_1_4 swap 4 and 3
          $table_order = $table_order == 3 ? 4 : ($table_order == 4 ? 3 : $table_order);
        }

        if (isset($default_colors[$table_order - 1])) {
          $player_no = $table_order;
          $player_team = ($table_order - 1) % 2;
          $color = $default_colors[$player_team];
        }
      }

      $pIdInt = (int) $player_id;
      $pNoInt = (int) $player_no;
      $pTeamInt = (int) $player_team;
      $escapedColor = Table::escapeStringForDB($color);
      $escapedCanal = Table::escapeStringForDB((string) ($player["player_canal"] ?? ""));
      $escapedName = Table::escapeStringForDB((string) ($player["player_name"] ?? ""));
      $escapedAvatar = Table::escapeStringForDB((string) ($player["player_avatar"] ?? ""));

      $values[] =
        "('" .
        $pIdInt .
        "','" .
        $pNoInt .
        "',0,'$pTeamInt','$escapedColor','" .
        $escapedCanal .
        "','" .
        $escapedName .
        "','" .
        $escapedAvatar .
        "')";
    }

    $sql .= implode(",", $values);
    Table::DbQuery($sql);
  }

  /**
   * @param array<string, scalar> $where
   */
  public static function getSelectStmnt(array $where = []): string
  {
    $fields = ["id", "team", "name", "no", "score", "call_grand_tichu", "call_tichu", "pass"];
    $selects = implode(
      ", ",
      array_map(function (string $s): string {
        return "player_$s $s";
      }, $fields)
    );
    $sql = "SELECT $selects FROM player";
    if (count($where) > 0) {
      $conditions = array_map(
        function (string $key, mixed $value): string {
          $col = substr($key, 0, 7) === "player_" ? $key : "player_$key";
          $escaped = Table::escapeStringForDB((string) $value);
          return "$col = '$escaped'";
        },
        array_keys($where),
        $where
      );
      $sql .= " WHERE " . implode(" AND ", $conditions);
    }
    return $sql;
  }

  /**
   * @return array<int, string>
   */
  public static function getPlayerIds(): array
  {
    return Table::getObjectListFromDB("SELECT player_id FROM player", true);
  }

  /**
   * @return array<int|string, array<string, mixed>>
   */
  public static function getPlayers(): array
  {
    return Table::getCollectionFromDb(self::getSelectStmnt());
  }

  /**
   * @return array<string, mixed>|null
   */
  public static function getPlayer(int|string $id): ?array
  {
    return Table::getObjectFromDB(self::getSelectStmnt(["id" => $id]));
  }

  public static function getHighestScore(): int|float
  {
    return (int) Table::getUniqueValueFromDB("SELECT MAX(player_score) FROM player");
  }

  /**
   * @return array<string, mixed>
   */
  public static function getPartner(int|string $pId): array
  {
    $next_players = self::getNextPlayers($pId);
    return $next_players[1];
  }

  /**
   * Lock and read the partner's current bet columns inside an active transaction
   * (`FOR UPDATE`) so concurrent bets cannot be missed due to REPEATABLE-READ snapshots.
   *
   * @return array<string, mixed>|null
   */
  public static function getPartnerForUpdate(int|string $pId): ?array
  {
    $partner = self::getPartner($pId);
    $partnerId = (int) ($partner["id"] ?? 0);
    if ($partnerId <= 0) {
      return null;
    }
    return Table::getObjectFromDB(
      "SELECT player_id id, player_call_tichu call_tichu, player_call_grand_tichu call_grand_tichu FROM player WHERE player_id = $partnerId FOR UPDATE"
    );
  }

  /**
   * @return array<int, array<string, mixed>>
   */
  public static function getNextPlayers(int|string $pId, bool $desc = false): array
  {
    $id = (int) $pId;
    $sql = self::getSelectStmnt() . " ORDER BY player_no";
    if ($desc) {
      $sql .= " DESC";
    }
    $players = Table::getObjectListFromDB($sql);
    $lastId = $players[3]["id"]; // for preventing infinite loop for spectators
    while ($players[3]["id"] != $id && $players[0]["id"] != $lastId) {
      $players[] = array_shift($players);
    }
    return $players;
  }

  /**
   * @param array<int, array<string, mixed>>|int|string $mixed
   */
  public static function getNextPlayerWithCards(
    array|int|string $mixed,
    int|string|null $lastPlayerId = null,
    int $amount = 1
  ): int|string|null {
    $next_players = is_array($mixed) ? $mixed : self::getNextPlayers($mixed);
    $handCounts = CardManager::getDeck()->countCardsByLocationArgs("hand");
    foreach ($next_players as $player) {
      if ($lastPlayerId == $player["id"]) {
        return $lastPlayerId;
      }
      if (isset($handCounts[$player["id"]]) && $handCounts[$player["id"]] >= $amount) {
        return $player["id"];
      }
    }
    return null;
  }

  /**
   * @return array<int|string, mixed>
   */
  public static function getScores(): array
  {
    return Table::getCollectionFromDb("SELECT player_id, player_score FROM player", true);
  }

  public static function resetTichus(): void
  {
    Table::DbQuery("UPDATE player SET player_call_tichu=-1, player_call_grand_tichu=-1");
  }

  public static function grandTichuBet(int|string $pId, int|string $bet): void
  {
    $playerId = (int) $pId;
    $betVal = (int) $bet;
    Table::DbQuery(
      "UPDATE player SET player_call_grand_tichu=$betVal WHERE player_id=$playerId"
    );
    if ($betVal > 0) {
      Table::DbQuery("UPDATE player SET player_call_tichu=0 WHERE player_id=$playerId");
    }
  }

  public static function tichuBet(int|string $pId, int|string $bet): void
  {
    $playerId = (int) $pId;
    $betVal = (int) $bet;
    Table::DbQuery(
      "UPDATE player SET player_call_tichu=$betVal, player_call_grand_tichu=0 WHERE player_id=$playerId"
    );
  }

  /**
   * @param array<int, int> $team_points
   */
  public static function updateScores(array $team_points): void
  {
    for ($t = 0; $t < 2; $t++) {
      $points = (int) $team_points[$t];
      $team = (int) $t;
      if ($points != 0) {
        $sql = "UPDATE player SET player_score=player_score+$points
									WHERE player_team='$team' ";
        Table::DbQuery($sql);
      }
    }
  }

  public static function setAutopass(int|string $val, int|string|null $pId = null): void
  {
    $passVal = (int) $val;
    $sql = "UPDATE player SET player_pass=$passVal";
    if (!is_null($pId)) {
      $playerId = (int) $pId;
      $sql .= " WHERE player_id=$playerId";
    }
    Table::DbQuery($sql);
  }
}
?>
