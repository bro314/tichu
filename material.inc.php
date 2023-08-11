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
 * material.inc.php
 *
 * Tichu game material description
 *
 * Here, you can describe the material of your game with PHP variables.
 *
 * This file is loaded in your game logic class constructor, ie these variables
 * are available everywhere in your game logic code.
 *
 */

require_once "modules/Combo.php";
require_once "modules/Constants.php";
require_once "modules/Hand.php";
require_once "modules/Utils.php";
require_once "modules/managers/CardManager.php";
require_once "modules/managers/LogManager.php";
require_once "modules/managers/NotificationManager.php";
require_once "modules/managers/PlayerManager.php";

$this->colors = [
  // type
  1 => ["name" => clienttranslate("Swords"), "nametr" => self::_("Swords")],
  2 => ["name" => clienttranslate("Stars"), "nametr" => self::_("Stars")],
  3 => ["name" => clienttranslate("Pagodas"), "nametr" => self::_("Pagodas")],
  4 => ["name" => clienttranslate("Jade"), "nametr" => self::_("Jade")],
];
$this->values_label = [
  // type_arg
  2 => "2",
  3 => "3",
  4 => "4",
  5 => "5",
  6 => "6",
  7 => "7",
  8 => "8",
  9 => "9",
  10 => "10",
  11 => clienttranslate("Jack"),
  12 => clienttranslate("Queen"),
  13 => clienttranslate("King"),
  14 => clienttranslate("Ace"),
];
$this->specials_label = [
  // type
  1 => clienttranslate("Dragon"),
  2 => clienttranslate("Phoenix"),
  3 => clienttranslate("Hound"),
  4 => clienttranslate("Mah Jong"),
];

$this->play_type = [
  1 => clienttranslate("a Single"),
  2 => clienttranslate("a Pair"),
  3 => clienttranslate("a Trio"),
  4 => clienttranslate("Consecutive Doubles"),
  5 => clienttranslate("a Run of 5"),
  6 => clienttranslate("a Run of 6"),
  7 => clienttranslate("a Run of 7"),
  8 => clienttranslate("a Run of 8"),
  9 => clienttranslate("a Run of 9"),
  10 => clienttranslate("a Run of 10"),
  11 => clienttranslate("a Run of 11"),
  12 => clienttranslate("a Run of 12"),
  13 => clienttranslate("a Run of 13"),
  14 => clienttranslate("a Run of 14"),
  15 => clienttranslate("a Full House"),
  20 => clienttranslate("the Hound"),
  30 => clienttranslate("a Bomb"),
];
/*

Example:

$this->card_types = array(
    1 => array( "card_name" => ...,
                ...
              )
);

*/
