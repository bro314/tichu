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
 * tichu.view.php
 *
 * This is your "view" file.
 *
 * The method "build_page" below is called each time the game interface is displayed to a player, ie:
 * _ when the game starts
 * _ when a player refreshes the game page (F5)
 *
 * "build_page" method allows you to dynamically modify the HTML generated for the game interface. In
 * particular, you can set here the values of variables elements defined in tichudashwood_tichudashwood.tpl (elements
 * like {MY_VARIABLE_ELEMENT}), and insert HTML block elements (also defined in your HTML template file)
 *
 * Note: if the HTML of your game interface is always the same, you don't have to place anything here.
 *
 */

require_once(APP_BASE_PATH . "view/common/game.view.php");

class view_tichudashwood_tichudashwood extends game_view
{
    function getGameName()
    {
        return "tichudashwood";
    }

    function build_page($viewArgs)
    {
        // Get players & players number
        $players = $this->game->loadPlayersBasicInfos();
        $numPlayers = count($players);

        /*********** Place your code below:  ************/


        // this will make our My Hand text translatable
        $this->tpl['MAHJONG'] = self::_("Mahjong Wish");
        $this->tpl['PHOENIX'] = self::_("Phoenix Choice");
        $this->tpl['MY_HAND'] = self::_("My hand");
        $this->tpl['REORDER_CARDS_BY_RANK'] = self::_("Reorder cards by rank");
        $this->tpl['REORDER_CARDS_BY_COLOR'] = self::_("Reorder cards by color");
        $this->tpl['SQUARE_TABLE'] = self::_("Square table");
        $this->tpl['LIST_TABLE'] = self::_("List table");
        $this->tpl['LAST_COMBO_PLAYED'] = self::_("Last Combo played");
        $this->tpl['CARDS_PLAYED'] = self::_("Cards played");
        $this->tpl['GRANDTICHU'] = self::_("Grand Tichu");
        $this->tpl['TICHU'] = self::_("Tichu");
        $this->tpl['NO_BET'] = self::_("No bet");
        $this->tpl['BET_EXPLANATION'] = self::_("Bet you will be the first to shed all cards from hand");
        $this->tpl['CLOCKWISE'] = self::_("Play clockwise");
        $this->tpl['COUNTER_CLOCKWISE'] = self::_("Play counterclockwise");


        $player_to_dir = PlayerManager::getNextPlayers(null, true);

        $this->page->begin_block("tichudashwood_tichudashwood", "player");
        foreach ($player_to_dir as $dir => $player) {
          if($dir < 3)
            $this->page->insert_block("player", array("PLAYER_ID" => $player['id'],
                "PLAYER_NAME" => $player['name'],
                "PLAYER_COLOR" => $players[$player['id']]['player_color'],
                "DIR" => $dir+1));

        }

				$clazzNames = ['bottom', 'right', 'top', 'left'];
				//$clazzNames = ['right', 'top', 'left', 'bottom'];

        $this->page->begin_block("tichudashwood_tichudashwood", "last_played");
        //array_splice($player_to_dir, 0, 0,array_splice($player_to_dir, 3, 1,[])); // move last to first
				$player_to_dir = array_reverse($player_to_dir);
        foreach ($player_to_dir as $i => $player) {
            $this->page->insert_block("last_played", array("PLAYER_ID" => $player['id'],
                "PLAYER_NAME" => $players[$player['id']]['player_name'],
                "PLAYER_COLOR" => $players[$player['id']]['player_color'],
								"POSITION" => $clazzNames[$i]));
        }


        /*

        // Examples: set the value of some element defined in your tpl file like this: {MY_VARIABLE_ELEMENT}

        // Display a specific number / string
        $this->tpl['MY_VARIABLE_ELEMENT'] = $number_to_display;

        // Display a string to be translated in all languages:
        $this->tpl['MY_VARIABLE_ELEMENT'] = self::_("A string to be translated");

        // Display some HTML content of your own:
        $this->tpl['MY_VARIABLE_ELEMENT'] = self::raw( $some_html_code );

        */

        /*

        // Example: display a specific HTML block for each player in this game.
        // (note: the block is defined in your .tpl file like this:
        //      <!-- BEGIN myblock -->
        //          ... my HTML code ...
        //      <!-- END myblock -->


        $this->page->begin_block( "tichudashwood_tichudashwood", "myblock" );
        foreach( $players as $player )
        {
            $this->page->insert_block( "myblock", array(
                                                    "PLAYER_NAME" => $player['player_name'],
                                                    "SOME_VARIABLE" => $some_value
                                                    ...
                                                     ) );
        }

        */


        /*********** Do not change anything below this line  ************/
    }
}
