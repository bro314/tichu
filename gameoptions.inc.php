<?php

/**
 *------
 * BGA framework: © Gregory Isabelli <gisabelli@boardgamearena.com> & Emmanuel Colin <ecolin@boardgamearena.com>
 * Tichu implementation : © <Your name here> <Your email address here>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * gameoptions.inc.php
 *
 * Tichu game options description
 *
 * In this file, you can define your game options (= game variants).
 *
 * Note: If your game has no variant, you don't have to modify this file.
 *
 * Note²: All options defined in this file should have a corresponding "game state labels"
 *        with the same ID (see "initGameStateLabels" in tichu.game.php)
 *
 * !! It is not a good idea to modify this file when a game is running !!
 *
 */

$game_options = [
  100 => [
    "name" => totranslate("Game length"),
    "values" => [
      1 => [
        "name" => totranslate("Half Game (500 points)"),
        "tmdisplay" => totranslate("Half game"),
      ],
      2 => [
        "name" => totranslate("Classic (1000 points)"),
        "tmdisplay" => totranslate("Classic"),
      ],
      3 => [
        "name" => totranslate("Long Game  (2000 points)"),
        "tmdisplay" => totranslate("Long game"),
      ],
    ],
    "default" => 2,
  ],
  101 => [
    "name" => totranslate("Teams"),
    "values" => [
      1 => ["name" => totranslate("By table order (1st/3rd versus 2nd/4th)")],
      2 => ["name" => totranslate("By table order (1st/2nd versus 3rd/4th)")],
      3 => ["name" => totranslate("By table order (1st/4th versus 2nd/3rd)")],
      4 => ["name" => totranslate("At random")],
    ],
    "default" => 1,
  ],
  102 => [
    "name" => totranslate("Game Variant"),
    "values" => [
      1 => ["name" => totranslate("Standard 4-player Tichu")],
    ],
    "default" => 1,
  ],
];

$game_preferences = [
  100 => [
    "name" => totranslate("Table Layout"),
    "needReload" => true, // after user changes this preference game interface would auto-reload
    "values" => [
      1 => ["name" => totranslate("List")],
      2 => ["name" => totranslate("Square")],
    ],
  ],
  101 => [
    "name" => totranslate("Order of play"),
    "needReload" => true, // after user changes this preference game interface would auto-reload
    "values" => [
      1 => ["name" => totranslate("counterclockwise")],
      2 => ["name" => totranslate("clockwise")],
    ],
  ],
  102 => [
    "name" => totranslate("Prevent passing when cards are selected"),
    "needReload" => true, // after user changes this preference game interface would auto-reload
    "values" => [
      1 => ["name" => totranslate("enabled")],
      2 => ["name" => totranslate("disabled")],
    ],
  ],
  103 => [
    "name" => totranslate("Tiki Edition Art"),
    "needReload" => true, // after user changes this preference game interface would auto-reload
    "values" => [
      1 => ["name" => totranslate("enabled")],
      2 => ["name" => totranslate("disabled")],
    ],
    "default" => 2,
  ],
];
