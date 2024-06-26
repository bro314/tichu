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

    $this->tpl["MAHJONG"] = $this->_("Mahjong Wish");
    $this->tpl["PHOENIX"] = $this->_("Phoenix Choice");
    $this->tpl["MY_HAND"] = $this->_("My hand");
    $this->tpl["AUTO_ACCEPT"] = $this->_("Auto accepting in 2 seconds ...");
    $this->tpl["AUTO_COLLECT"] = $this->_("Auto collecting in 2 seconds ...");
    $this->tpl["REORDER_CARDS_BY_RANK"] = $this->_("Reorder cards by rank");
    $this->tpl["REORDER_CARDS_BY_COLOR"] = $this->_("Reorder cards by color");
    $this->tpl["SQUARE_TABLE"] = $this->_("Square table");
    $this->tpl["LIST_TABLE"] = $this->_("List table");
    $this->tpl["LAST_COMBO_PLAYED"] = $this->_("Last Combo played");
    $this->tpl["CARDS_PLAYED"] = $this->_("Cards played");
    $this->tpl["GRANDTICHU"] = $this->_("Grand Tichu");
    $this->tpl["TICHU"] = $this->_("Tichu");
    $this->tpl["NO_BET"] = $this->_("No bet");
    $this->tpl["BET_EXPLANATION"] = $this->_(
      "Bet you will be the first to shed all cards from hand"
    );
    $this->tpl["CLOCKWISE"] = $this->_("Play clockwise");
    $this->tpl["COUNTER_CLOCKWISE"] = $this->_("Play counterclockwise");
    $this->tpl["EXP_REPLAY"] = $this->_("Experimental Replay");

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

    $this->page->begin_block("tichu_tichu", "theme");
    $arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    foreach ($arr as &$value) {
      $this->page->insert_block("theme", [
        "THEME_NO" => $value,
      ]);
    }

    // Only show played cards in turn-based mode.
    if (Tichu::$instance->isAllInfoExposed()) {
      $this->page->begin_block("tichu_tichu", "played_arg");
      $this->page->begin_block("tichu_tichu", "played_type");
      for ($type = 1; $type <= 4; $type++) {
        $this->page->reset_subblocks("played_arg");

        for ($arg = 1; $arg <= 14; $arg++) {
          $this->page->insert_block("played_arg", [
            "Y" => $type - 1,
            "X" => $arg - 1,
            "TYPE" => $type,
            "ARG" => $arg,
          ]);
        }

        $this->page->insert_block("played_type", [
          "Y" => $type - 1,
          "TYPE" => $type,
        ]);
      }
    }
  }
}
