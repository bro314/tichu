<?php
class NotificationManager extends APP_GameClass
{
  public static function dealCards($player_id, $cards, $msg)
  {
    Tichu::$instance->notifyPlayer($player_id, "dealCards", clienttranslate($msg), [
      "cards" => $cards,
    ]);
  }

  public static function grandTichuBet($player_id, $player_name, $bet)
  {
    $msg =
      $bet == 0
        ? '${player_name} makes no Grand Tichu bet'
        : '
												${player_name} makes a Grand Tichu bet';
    Tichu::$instance->notifyAllPlayers("grandTichuBet", clienttranslate($msg), [
      "player_id" => $player_id,
      "player_name" => $player_name,
      "bet" => $bet,
    ]);
  }

  public static function tichuBet($player_id, $player_name, $bet)
  {
    $msg = $bet == 0 ? "" : clienttranslate('${player_name} makes a Tichu bet');
    Tichu::$instance->notifyAllPlayers("tichuBet", $msg, [
      "player_id" => $player_id,
      "player_name" => $player_name,
      "bet" => $bet,
    ]);
  }

  public static function log($msg, $args)
  {
    Tichu::$instance->notifyAllPlayers("log", clienttranslate($msg), $args);
  }

  public static function playCombo($playerId, $playerName, $combo, $msg)
  {
    Tichu::$instance->notifyAllPlayers("playCombo", $msg, [
      "player_id" => $playerId,
      "player_name" => $playerName,
      "combo_name" => $combo->description,
      "cards" => $combo->cards,
      "points" => CardManager::getTrickValue($combo->cards),
    ]);
  }

  public static function wishMade($player_id, $player_name, $wish, $textValue, $msg)
  {
    Tichu::$instance->notifyAllPlayers("wishMade", $msg, [
      "player_id" => $player_id,
      "player_name" => $player_name,
      "wish" => $wish,
      "text_value" => $textValue,
    ]);
  }

  public static function mahjongGranted()
  {
    Tichu::$instance->notifyAllPlayers("mahjongWishGranted", "", []);
  }

  public static function playerGoOut($player_id, $player_name, $firstOutPlayer)
  {
    Tichu::$instance->notifyAllPlayers(
      "playerGoOut",
      clienttranslate('${player_name} has shed the cards from hand '),
      [
        "firstout_id" => $firstOutPlayer,
        "player_id" => $player_id,
        "player_name" => $player_name,
      ]
    );
  }

  public static function pass($player_id, $player_name, $msg = null)
  {
    Tichu::$instance->notifyAllPlayers("pass", clienttranslate($msg ?? '${player_name} passes'), [
      "player_id" => $player_id,
      "player_name" => $player_name,
    ]);
  }

  public static function devConsole($msg)
  {
    Tichu::$instance->notifyAllPlayers("devConsole", "", ["msg" => $msg]);
  }

  public static function tableWindow($table)
  {
    Tichu::$instance->notifyAllPlayers("tableWindow", "", [
      "id" => "finalScoring",
      "title" => clienttranslate("Result of this Round"),
      "table" => $table,
      "closing" => clienttranslate("ok"),
    ]);
  }

  public static function newScores($newScores)
  {
    Tichu::$instance->notifyAllPlayers("newScores", "", [
      "newScores" => $newScores,
    ]);
  }

  public static function captureCards($player_id, $player_name, $trickValue)
  {
    Tichu::$instance->notifyAllPlayers(
      "captureCards",
      clienttranslate('${player_name} gets all cards valuing ${trick_value} points'),
      [
        "player_id" => $player_id,
        "player_name" => $player_name,
        "trick_value" => $trickValue,
      ]
    );
  }

  public static function autopass($val, $pId = null)
  {
    if (is_null($pId)) {
      Tichu::$instance->notifyAllPlayers("autopass", "", [
        "autopass" => $val,
      ]);
    } else {
      Tichu::$instance->notifyPlayer($pId, "autopass", "", [
        "autopass" => $val,
      ]);
    }
  }

  public static function confirmTichu($player_id, $grand, $msg = null)
  {
    $s = $grand ? " grand" : "";
    Tichu::$instance->notifyPlayer($player_id, "confirmTichu", "", [
      "grand" => $grand,
      "msg" => clienttranslate($msg ?? "Another tichu bet has just been made. Are you sure?"),
    ]);
  }

  public static function acceptCards($player_id)
  {
    $cards = CardManager::getCardsPassedTo($player_id);

    Tichu::$instance->notifyPlayer(
      $player_id,
      "acceptCards",
      clienttranslate(
        'You have accepted ${card1} from previous player, ${card2} from partner, ${card3} from next player.'
      ),
      [
        "cards" => $cards,
        "card1" => CardManager::cardToStr($cards[0]),
        "card2" => CardManager::cardToStr($cards[1]),
        "card3" => CardManager::cardToStr($cards[2]),
      ]
    );
  }

  public static function passCards($player_id, $cardIds)
  {
    Tichu::$instance->notifyPlayer(
      $player_id,
      "passCards",
      clienttranslate(
        'You have passed ${card1} to previous player, ${card2} to partner, ${card3} to next player.'
      ),
      [
        "cardIds" => $cardIds,
        "card1" => CardManager::cardToStr(CardManager::getDeck()->getCard($cardIds[0])),
        "card2" => CardManager::cardToStr(CardManager::getDeck()->getCard($cardIds[1])),
        "card3" => CardManager::cardToStr(CardManager::getDeck()->getCard($cardIds[2])),
      ]
    );
  }
}
?>
