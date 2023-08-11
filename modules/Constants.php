<?php
define("TEAM_1_3", 1); // By table order (1st/3rd versus 2nd/4th)
define("TEAM_1_2", 2); // By table order (1st/2nd versus 3rd/4th)
define("TEAM_1_4", 3); // By table order (1st/4th versus 2nd/3rd)
define("TEAM_RANDOM", 4); // At random

define("ST_GAME_SETUP", 1);
define("ST_NEW_ROUND", 10);
define("ST_GRAND_TICHU_BETS", 20);
define("ST_DEAL_LAST_CARDS", 30);
define("ST_GIVE_CARDS", 40);
define("ST_SHOW_PASSED_CARDS", 45);
define("ST_NEW_TRICK", 50);
define("ST_PLAY_COMBO_OPEN", 55);
define("ST_PLAY_COMBO", 60);
define("ST_PLAY_BOMB", 61);
define("ST_PHOENIX_PLAY", 63);
define("ST_MAHJONG_PLAY", 65);
define("ST_NEXT_PLAYER", 70);
define("ST_CONFIRM_TRICK", 75);
define("ST_CHOOSE_DRAGON_GIFT", 80);
define("ST_CHANGE_PLAYER", 85);
define("ST_END_ROUND", 90);
define("ST_GAME_END", 99);

define("COMBO_MULTIPLIER", 10);
define("SPECIAL_CARD_TYPE", 1);

define("INVALID_COMBO", -1);
define("PASS_COMBO", 0);
define("SINGLE_COMBO", 1); //should remain smallest combo value
define("PAIR_COMBO", 2);
define("TRIP_COMBO", 3);
define("RUNNING_PAIRS_COMBO", 4);
define("STRAIGHT_COMBO", 5);
define("FULL_HOUSE_COMBO", 6);
define("BOMB_COMBO", 7);
define("DOG_COMBO", 8); //should remain greatest combo value
define("NO_COMBO", 99);

// card_types of special cards
define("TYPE_DRAGON", 1);
define("TYPE_PHOENIX", 2);
define("TYPE_DOG", 3);
define("TYPE_MAHJONG", 4);

// player_pass values
define("AUTOPASS_NONE", 0);
define("AUTOPASS_ONCE", 1);
define("AUTOPASS_TRICK", 2);

// time in s after a called (grand) tichu, where player have to confirm to call antoher tichu
define("TICHU_CONFIRMATION_TRESHOLD", 60);
?>
