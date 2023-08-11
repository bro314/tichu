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
    if (self::isArg("notifwindow")) {
      $this->view = "common_notifwindow";
      $this->viewArgs["table"] = self::getArg("table", AT_posint, true);
    } else {
      $this->view = "tichu_tichu";
      self::trace("Complete reinitialization of board game");
    }
  }

  // TODO: defines your action entry points there

  public function grandTichuBet()
  {
    self::setAjaxMode();
    $bet = self::getArg("bet", AT_enum, true, false, ["0", "200"]);
    $result = $this->game->grandTichuBet($bet);
    self::ajaxResponse();
  }

  public function tichuBet()
  {
    self::setAjaxMode();
    $bet = self::getArg("bet", AT_enum, true, false, ["0", "100"]);
    $this->game->tichuBet();
    self::ajaxResponse();
  }

  public function confirmTichu()
  {
    self::setAjaxMode();
    $bet = self::getArg("bet", AT_enum, true, false, ["100", "200"]);
    $this->game->confirmTichu($bet);
    self::ajaxResponse();
  }

  public function makeAWish()
  {
    self::setAjaxMode();
    $wish = self::getArg("wish", AT_posint, false, null);
    $this->game->makeAWish($wish);
    self::ajaxResponse();
  }

  public function choosePhoenix()
  {
    self::setAjaxMode();
    $phoenixValue = self::getArg("phoenixValue", AT_posint, false, null);
    $this->game->choosePhoenix($phoenixValue);
    self::ajaxResponse();
  }

  public function playCombo()
  {
    self::setAjaxMode();
    $cards_raw = self::getArg("cards", AT_numberlist, true);

    $cards = strlen($cards_raw) == 0 ? [] : explode(";", $cards_raw);

    $this->game->playCombo($cards);
    self::ajaxResponse();
  }

  public function playBomb()
  {
    self::setAjaxMode();
    $cards_raw = self::getArg("cards", AT_numberlist, true);

    $cards = strlen($cards_raw) == 0 ? [] : explode(";", $cards_raw);

    $this->game->playBomb($cards);
    self::ajaxResponse();
  }

  public function pass()
  {
    self::setAjaxMode();
    $onlyOnce = self::getArg("onlyOnce", AT_bool, false, null);
    $this->game->pass($onlyOnce);
    self::ajaxResponse();
  }

  public function cancelAutopass()
  {
    self::setAjaxMode();
    $this->game->cancelAutopass();
    self::ajaxResponse();
  }

  public function giveTheCards()
  {
    self::setAjaxMode();
    $cards_raw = self::getArg("cards", AT_numberlist, true);
    // Removing last ';' if exists
    if (substr($cards_raw, -1) == ";") {
      $cards_raw = substr($cards_raw, 0, -1);
    }
    $cards = explode(";", $cards_raw);

    $this->game->giveTheCards($cards);
    self::ajaxResponse();
  }

  public function acceptCards()
  {
    self::setAjaxMode();
    $this->game->acceptCards();
    self::ajaxResponse();
  }

  public function collect()
  {
    self::setAjaxMode();
    $this->game->collect();
    self::ajaxResponse();
  }

  public function cancelPhoenix()
  {
    self::setAjaxMode();
    $this->game->cancelPhoenix();
    self::ajaxResponse();
  }

  public function cancel()
  {
    self::setAjaxMode();
    $this->game->cancel();
    self::ajaxResponse();
  }

  public function chooseDragonGift()
  {
    self::setAjaxMode();
    $playertogive = self::getArg("player", AT_posint, false, null);
    $this->game->chooseDragonGift($playertogive);
    self::ajaxResponse();
  }

  /*
		Example:

		public function myAction() {
				self::setAjaxMode();

				// Retrieve arguments
				// Note: these arguments correspond to what has been sent through the javascript "ajaxcall" method
				$arg1 = self::getArg( "myArgument1", AT_posint, true );
				$arg2 = self::getArg( "myArgument2", AT_posint, true );

				// Then, call the appropriate method in your game logic, like "playCard" or "myAction"
				$this->game->myAction( $arg1, $arg2 );

				self::ajaxResponse( );
		}

		*/
}
