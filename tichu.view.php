<?php
require_once APP_BASE_PATH . "view/common/game.view.php";

class view_tichu_tichu extends game_view
{
  /**
   * @return string
   */
  function getGameName()
  {
    return "tichu";
  }

  /**
   * @param array<string, mixed> $viewArgs
   * @return void
   */
  function build_page($viewArgs)
  {
  }
}
