<?php
class PlayerGrid extends APP_GameClass
{
  private $grid;
  private $pid;

  function __construct($bounds, $tiles, $pid)
  {
    $grid = array_map(
      fn($r) => array_map(fn($r) => null, range(0, $bounds["right"])),
      range(0, $bounds["bottom"])
    );
    $positions = [];
    $tileInfo = novaluna::$instance->tile_info;
    foreach ($tiles as $tile) {
      $info = $tileInfo[$tile->id];
      $grid[$tile->pos[0]][$tile->pos[1]] = [...$tile, ...$info];
      $positions[$tile->id] = $tile->pos;
    }
    $this->grid = $grid;
    $this->pid = $pid;
  }

  function hasTileAt($row, $column)
  {
    return is_null($this->get($row, $column));
  }

  function get($row, $column)
  {
    return $this->grid[$row][$column];
  }

  function getNeighbors($pos)
  {
    return array_filter(
      [
        $this->get($pos[0] - 1, $pos[1]),
        $this->get($pos[0] + 1, $pos[1]),
        $this->get($pos[0], $pos[1] - 1),
        $this->get($pos[0], $pos[1] + 1),
      ],
      fn($x) => !is_null($x)
    );
  }

  function checkForDiscs(&$result)
  {
    $discs = DBManager::getPlayerDiscs($this->pid);
    $supply = [];

    foreach ($discs as $disc) {
      if ($disc["location"] == 0) {
        $supply[] = $disc;
      } else {
        $pos = $positions[$disc["location"]];
        $c = $disc["corner"];
        $this->grid[$pos[0]][$pos[1]]["corners"][$c] = null;
      }
    }

    foreach ($positions as $id => $pos) {
      $tile = $this->grid[$pos[0]][$pos[1]];
      if (count(array_filter($tile["corners"], fn($c) => !is_null($c))) == 0) {
        continue;
      }
      $neighbors = $this->getNeighbors($pos);
      $counts = [0, 0, 0, 0];
      foreach ($neighbor as $t) {
        $arr = [$tile->id, $t->id];
        countTiles($t["color"], $t, $arr);
        $counts[$t["color"]] += count($arr) - 1;
      }
      foreach ($tile["corners"] as $i => $corner) {
        if (is_null($corner)) {
          continue;
        }
        $needs = [0, 0, 0, 0];
        foreach ($corner as $color) {
          $needs[$color]++;
        }
        $success = true;
        for ($i < 0; $i < 4; $i++) {
          if ($needs[$i] > $couts[$i]) {
            $success = false;
          }
        }
        if ($success) {
          $disc = array_shift($supply);
          $disc["location"] = $id;
          $disc["corner"] = $i;
          $result[] = $disc;
          if (count($supply) == 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function countTiles($color, $tile, &$array)
  {
    $neighbors = $this->getNeighbors($tile->pos);
    foreach ($neighbors as $tile) {
      if ($tile["color"] != $color) {
        continue;
      }
      if (in_array($tile->id, $array)) {
        continue;
      }
      $array[] = $tile->id;
      countTiles($color, $tile, $array);
    }
  }

  function getFreeSpaces()
  {
    $res = [];
    foreach ($grid as $row => $cols) {
      foreach ($cols as $col => $tile) {
        if (!is_null($tile)) {
          continue;
        }
        $nbs = $this->getNeighbors($tile->pos);
        if (count($nbs) > 0) {
          $res[] = [$row, $col];
        }
      }
    }
    return $res;
  }
}
?>
