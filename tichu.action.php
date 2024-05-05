<?php
/**
 *------
 * BGA framework: © Gregory Isabelli <gisabelli@boardgamearena.com> & Emmanuel Colin <ecolin@boardgamearena.com>
 * Tichu implementation : © Yannick Priol <camertwo@hotmail.com>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * tichu.action.php
 *
 * Tichu main action entry point
 *
 *
 * In this file, you are describing all the methods that can be called from your
 * user interface logic (javascript).
 *
 * If you define a method "myAction" here, then you can call it from your javascript code with:
 * this.ajaxcall( "/tichu/tichu/myAction.html", ...)
 *
 */

class action_tichu extends APP_GameAction
{
  // Constructor: please do not modify
  public function __default()
  {
    if ($this->isArg("notifwindow")) {
      $this->view = "common_notifwindow";
      $this->viewArgs["table"] = $this->getArg("table", AT_posint, true);
    } else {
      $this->view = "tichu_tichu";
      $this->trace("Complete reinitialization of board game");
    }
  }

  // TODO: defines your action entry points there

  public function grandTichuBet()
  {
    $this->setAjaxMode();
    $bet = $this->getArg("bet", AT_enum, true, false, ["0", "200"]);
    $result = $this->game->grandTichuBet($bet);
    $this->ajaxResponse();
  }

  public function tichuBet()
  {
    $this->setAjaxMode();
    $bet = $this->getArg("bet", AT_enum, true, false, ["0", "100"]);
    $this->game->tichuBet();
    $this->ajaxResponse();
  }

  public function confirmTichu()
  {
    $this->setAjaxMode();
    $bet = $this->getArg("bet", AT_enum, true, false, ["100", "200"]);
    $this->game->confirmTichu($bet);
    $this->ajaxResponse();
  }

  public function makeAWish()
  {
    $this->setAjaxMode();
    $wish = $this->getArg("wish", AT_posint, false, null);
    $this->game->makeAWish($wish);
    $this->ajaxResponse();
  }

  public function choosePhoenix()
  {
    $this->setAjaxMode();
    $phoenixValue = $this->getArg("phoenixValue", AT_posint, false, null);
    $this->game->choosePhoenix($phoenixValue);
    $this->ajaxResponse();
  }

  public function playCombo()
  {
    $this->setAjaxMode();
    $cards_raw = $this->getArg("cards", AT_numberlist, true);

    $cards = strlen($cards_raw) == 0 ? [] : explode(";", $cards_raw);

    $this->game->playCombo($cards);
    $this->ajaxResponse();
  }

  public function playBomb()
  {
    $this->setAjaxMode();
    $cards_raw = $this->getArg("cards", AT_numberlist, true);

    $cards = strlen($cards_raw) == 0 ? [] : explode(";", $cards_raw);

    $this->game->playBomb($cards);
    $this->ajaxResponse();
  }

  public function pass()
  {
    $this->setAjaxMode();
    $onlyOnce = $this->getArg("onlyOnce", AT_bool, false, null);
    $this->game->pass($onlyOnce);
    $this->ajaxResponse();
  }

  public function cancelAutopass()
  {
    $this->setAjaxMode();
    $this->game->cancelAutopass();
    $this->ajaxResponse();
  }

  // DANGER: The actual action is named "giveCards".
  public function giveTheCards()
  {
    $this->setAjaxMode();
    $cards_raw = $this->getArg("cards", AT_numberlist, true);
    // Removing last ';' if exists
    if (substr($cards_raw, -1) == ";") {
      $cards_raw = substr($cards_raw, 0, -1);
    }
    $cards = explode(";", $cards_raw);

    $this->game->giveTheCards($cards);
    $this->ajaxResponse();
  }

  public function acceptCards()
  {
    $this->setAjaxMode();
    $this->game->acceptCards();
    $this->ajaxResponse();
  }

  public function collect()
  {
    $this->setAjaxMode();
    $this->game->collect();
    $this->ajaxResponse();
  }

  public function cancelPhoenix()
  {
    $this->setAjaxMode();
    $this->game->cancelPhoenix();
    $this->ajaxResponse();
  }

  public function cancel()
  {
    $this->setAjaxMode();
    $this->game->cancel();
    $this->ajaxResponse();
  }

  public function chooseDragonGift()
  {
    $this->setAjaxMode();
    $playertogive = $this->getArg("player", AT_posint, false, null);
    $this->game->chooseDragonGift($playertogive);
    $this->ajaxResponse();
  }

  /*
		Example:

		public function myAction() {
				$this->setAjaxMode();

				// Retrieve arguments
				// Note: these arguments correspond to what has been sent through the javascript "ajaxcall" method
				$arg1 = $this->getArg( "myArgument1", AT_posint, true );
				$arg2 = $this->getArg( "myArgument2", AT_posint, true );

				// Then, call the appropriate method in your game logic, like "playCard" or "myAction"
				$this->game->myAction( $arg1, $arg2 );

				$this->ajaxResponse( );
		}

		*/
}
