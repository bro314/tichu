<?php declare(strict_types=1);

require_once "modules/Constants.php";

function card($type, $arg)
{
  return [
    "type" => $type,
    "type_arg" => $arg,
  ];
}

define("DR", card(TYPE_DRAGON, 1));
define("PH", card(TYPE_PHOENIX, 1));
define("DOG", card(TYPE_DOG, 1));
define("MJ", card(TYPE_MAHJONG, 1));

define("A2", card(1, 2));
define("B2", card(2, 2));
define("C2", card(3, 2));
define("D2", card(4, 2));

define("A3", card(1, 3));
define("B3", card(2, 3));
define("C3", card(3, 3));
define("D3", card(4, 3));

define("A4", card(1, 4));
define("B4", card(2, 4));
define("C4", card(3, 4));
define("D4", card(4, 4));

define("A5", card(1, 5));
define("B5", card(2, 5));
define("C5", card(3, 5));
define("D5", card(4, 5));

define("A6", card(1, 6));
define("B6", card(2, 6));
define("C6", card(3, 6));
define("D6", card(4, 6));

define("A7", card(1, 7));
define("B7", card(2, 7));
define("C7", card(3, 7));
define("D7", card(4, 7));

define("A8", card(1, 8));
define("B8", card(2, 8));
define("C8", card(3, 8));
define("D8", card(4, 8));

define("A9", card(1, 9));
define("B9", card(2, 9));
define("C9", card(3, 9));
define("D9", card(4, 9));

define("A0", card(1, 10));
define("B0", card(2, 10));
define("C0", card(3, 10));
define("D0", card(4, 10));

define("AJ", card(1, 11));
define("BJ", card(2, 11));
define("CJ", card(3, 11));
define("DJ", card(4, 11));

define("AQ", card(1, 12));
define("BQ", card(2, 12));
define("CQ", card(3, 12));
define("DQ", card(4, 12));

define("AK", card(1, 13));
define("BK", card(2, 13));
define("CK", card(3, 13));
define("DK", card(4, 13));

define("AA", card(1, 14));
define("BA", card(2, 14));
define("CA", card(3, 14));
define("DA", card(4, 14));
?>
