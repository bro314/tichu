<?php
class PlayerManager extends APP_GameClass
{
  private static $instance = null;
  public static function getInstance()
  {
    if (self::$instance == null) {
      self::$instance = new PlayerManager();
    }
    return self::$instance;
  }

  public static function setupPlayers($players)
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

    foreach ($players as $player_id => $player) {
      $color = "ffffff"; // Default to white (should never be left to white unless the following doesn't work)
      $player_no = 9; // Default to 9 (should never be left to 9 unless the following doesn't work)
      $counter++;

      if (Tichu::$instance->getGameStateValue("playerTeams") == TEAM_RANDOM) {
        $color = array_shift($default_colors); // Random since the $players order is random
        $player_no = $counter;
        $player_team = $counter % 2;
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
          $color = $default_colors[$table_order - 1];
          $player_no = $table_order - 1;
          $player_team = $player_no % 2;
        }
      }

      $values[] =
        "('" .
        $player_id .
        "','" .
        $player_no .
        "',0,'$player_team','$color','" .
        $player["player_canal"] .
        "','" .
        addslashes($player["player_name"]) .
        "','" .
        addslashes($player["player_avatar"]) .
        "')";
    }

    $sql .= implode(",", $values);
    self::getInstance()->DbQuery($sql);
  }

  private static function getSelectStmnt($where = [])
  {
    $fields = ["id", "team", "name", "no", "score", "call_grand_tichu", "call_tichu", "pass"];
    $selects = implode(
      ", ",
      array_map(function ($s) {
        return "player_$s $s";
      }, $fields)
    );
    $sql = "SELECT $selects FROM player";
    if (count($where) > 0) {
      $conditions = array_map(
        function ($key, $value) {
          return substr($key, 0, 7) == "player_" ? $key : "player_$key" . " = '$value'";
        },
        array_keys($where),
        $where
      );
      $sql .= " WHERE " . implode(" AND ", $conditions);
    }
    return $sql;
  }

  public static function getPlayerIds()
  {
    return self::getInstance()->getObjectListFromDB("SELECT player_id FROM player", true);
  }

  public static function getPlayers()
  {
    return self::getInstance()->getCollectionFromDb(self::getSelectStmnt());
  }

  public static function getPlayer($id)
  {
    return self::getInstance()->getObjectFromDB(self::getSelectStmnt(["id" => $id]));
  }

  public static function getHighestScore()
  {
    return self::getInstance()->getUniqueValueFromDB("SELECT MAX(player_score) FROM player");
  }

  public static function getPartner($pId)
  {
    $next_players = self::getNextPlayers($pId);
    return $next_players[1];
  }

  public static function getNextPlayers($pId = null, $desc = false)
  {
    $id = $pId ?? Tichu::getCurrentId();
    $sql = self::getSelectStmnt() . " ORDER BY player_no";
    if ($desc) {
      $sql .= " DESC";
    }
    $players = self::getInstance()->getObjectListFromDB($sql);
    $lastId = $players[3]["id"]; // for preventing infinite loop for spectators
    while ($players[3]["id"] != $id && $players[0]["id"] != $lastId) {
      $players[] = array_shift($players);
    }
    return $players;
  }

  public static function getNextPlayerWithCards($mixed, $lastPlayerId = null, $amount = 1)
  {
    $next_players = is_array($mixed) ? $mixed : self::getNextPlayers($mixed);
    $handCounts = $handCounts ?? CardManager::getDeck()->countCardsByLocationArgs("hand");
    foreach ($next_players as $player) {
      if ($lastPlayerId == $player["id"]) {
        return $lastPlayerId;
      }
      if (isset($handCounts[$player["id"]]) && $handCounts[$player["id"]] >= $amount) {
        return $player["id"];
      }
    }
  }

  public static function getScores()
  {
    return self::getInstance()->getCollectionFromDb(
      "SELECT player_id, player_score FROM player",
      true
    );
  }

  public static function resetTichus()
  {
    self::getInstance()->DbQuery(
      "UPDATE player SET player_call_tichu=-1, player_call_grand_tichu=-1"
    );
  }

  public static function grandTichuBet($pId, $bet)
  {
    self::getInstance()->DbQuery(
      "UPDATE player SET player_call_grand_tichu=$bet WHERE player_id=$pId"
    );
    if ($bet > 0) {
      self::getInstance()->DbQuery("UPDATE player SET player_call_tichu=0 WHERE player_id='$pId' ");
    }
  }

  public static function tichuBet($pId, $bet)
  {
    self::getInstance()->DbQuery(
      "UPDATE player SET player_call_tichu=$bet, player_call_grand_tichu=0 WHERE player_id=$pId"
    );
  }

  public static function updateScores($team_points)
  {
    for ($t = 0; $t < 2; $t++) {
      $points = $team_points[$t];
      if ($points != 0) {
        $sql = "UPDATE player SET player_score=player_score+$points
									WHERE player_team='$t' ";
        self::getInstance()->DbQuery($sql);
      }
    }
  }

  public static function setAutopass($val, $pId = null)
  {
    $sql = "UPDATE player SET player_pass=$val";
    if (!is_null($pId)) {
      $sql .= " WHERE player_id=$pId";
    }
    self::getInstance()->DbQuery($sql);
  }
}
?>
