<?php
class DBManager extends APP_GameClass
{
  public static function getPlayerIds()
  {
    return self::getObjectListFromDB("SELECT player_id FROM player", true);
  }

  public static function getPlayers($append = "")
  {
    return array_values(
      Utils::removePrefix(
        self::getObjectListFromDB(self::getPlayerSelect() . $append)
      )
    );
  }

  public static function getPlayersMap($append = "")
  {
    return Utils::removePrefix(
      self::getCollectionFromDb(self::getPlayerSelect() . $append)
    );
  }

  public static function getPlayer($pid)
  {
    $sql = self::getPlayerSelect() . " WHERE player_id=$pid";
    $arr = Utils::removePrefix(self::getObjectFromDB($sql));
    return $arr;
  }

  private static function getPlayerSelect()
  {
    return "SELECT player_id, player_name, player_score, player_no, player_pos, player_workers, player_gold, player_potions, player_hospital, player_unused FROM player";
  }

  public static function getDiscs(&$player)
  {
    $data = self::getObjectListFromDB("SELECT * FROM discs");
    foreach ($player as $k => $p) {
      $player[$k]["discs"] = [];
    }
    foreach ($data as $row) {
      $pid = $row["player"];
      $player[$pid]["discs"][] = $row;
    }
  }

  public static function getPlayerDiscs($pid)
  {
    return self::getObjectListFromDB("SELECT * FROM discs WHERE player=$pid");
  }
}
?>
