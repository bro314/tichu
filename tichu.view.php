<?php
require_once APP_BASE_PATH . "view/common/game.view.php";

class view_tichu_tichu extends game_view
{
  function getGameName()
  {
    return "tichu";
  }

  function build_page($viewArgs)
  {
    $players = $this->game->loadPlayersBasicInfos();
    $numPlayers = count($players);

    $this->tpl["MAHJONG"] = self::_("Mahjong Wish");
    $this->tpl["PHOENIX"] = self::_("Phoenix Choice");
    $this->tpl["MY_HAND"] = self::_("My hand");
    $this->tpl["AUTO_ACCEPT"] = self::_("Auto accepting in 2 seconds ...");
    $this->tpl["AUTO_COLLECT"] = self::_("Auto collecting in 2 seconds ...");
    $this->tpl["REORDER_CARDS_BY_RANK"] = self::_("Reorder cards by rank");
    $this->tpl["REORDER_CARDS_BY_COLOR"] = self::_("Reorder cards by color");
    $this->tpl["SQUARE_TABLE"] = self::_("Square table");
    $this->tpl["LIST_TABLE"] = self::_("List table");
    $this->tpl["LAST_COMBO_PLAYED"] = self::_("Last Combo played");
    $this->tpl["CARDS_PLAYED"] = self::_("Cards played");
    $this->tpl["GRANDTICHU"] = self::_("Grand Tichu");
    $this->tpl["TICHU"] = self::_("Tichu");
    $this->tpl["NO_BET"] = self::_("No bet");
    $this->tpl["BET_EXPLANATION"] = self::_(
      "Bet you will be the first to shed all cards from hand"
    );
    $this->tpl["CLOCKWISE"] = self::_("Play clockwise");
    $this->tpl["COUNTER_CLOCKWISE"] = self::_("Play counterclockwise");

    $player_to_dir = PlayerManager::getNextPlayers(null, true);

    $this->page->begin_block("tichu_tichu", "player");
    foreach ($player_to_dir as $dir => $player) {
      if ($dir < 3) {
        $this->page->insert_block("player", [
          "PLAYER_ID" => $player["id"],
          "PLAYER_NAME" => $player["name"],
          "PLAYER_COLOR" => $players[$player["id"]]["player_color"],
          "DIR" => $dir + 1,
        ]);
      }
    }

    $clazzNames = ["bottom", "right", "top", "left"];

    $this->page->begin_block("tichu_tichu", "last_played");
    $player_to_dir = array_reverse($player_to_dir);
    foreach ($player_to_dir as $i => $player) {
      $this->page->insert_block("last_played", [
        "PLAYER_ID" => $player["id"],
        "PLAYER_NAME" => $players[$player["id"]]["player_name"],
        "PLAYER_COLOR" => $players[$player["id"]]["player_color"],
        "POSITION" => $clazzNames[$i],
      ]);
    }
  }
}
