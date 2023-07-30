<?php
class NotificationManager extends APP_GameClass {

	public static function dealCards($player_id, $cards, $msg) {
		Tichudashwood::$instance->notifyPlayer( $player_id, 'dealCards', clienttranslate($msg), array(
								'cards' => $cards,
		));
	}

	public static function grandTichuBet($player_id, $player_name, $bet) {
		$msg = $bet == 0 ? '${player_name} makes no Grand Tichu bet' : '
												${player_name} makes a Grand Tichu bet';
		Tichudashwood::$instance->notifyAllPlayers( "grandTichuBet", clienttranslate($msg), array(
								"player_id" => $player_id,
								"player_name" => $player_name,
								"bet" => $bet
		));
	}

	public static function tichuBet($player_id, $player_name, $bet) {
		$msg = $bet == 0 ? '' : clienttranslate('${player_name} makes a Tichu bet');
		Tichudashwood::$instance->notifyAllPlayers( "tichuBet", $msg, [
								"player_id" => $player_id,
								"player_name" => $player_name,
								"bet" => $bet
		]);
	}

	public static function hasBomb($player_id, $hasBomb) {
		Tichudashwood::$instance->notifyPlayer($player_id, 'hasBomb', '', ['hasBomb' => $hasBomb]);
	}

	public static function log($msg, $args) {
		Tichudashwood::$instance->notifyAllPlayers( 'log', clienttranslate($msg), $args );
	}

	public static function playCombo($playerId, $playerName, $combo, $msg) {
		Tichudashwood::$instance->notifyAllPlayers('playCombo', $msg, [
			'player_id' => $playerId,
			'player_name' => $playerName,
			'combo_name' => $combo->description,
			'cards' => $combo->cards,
			'points' => CardManager::getTrickValue($combo->cards)
		]);
	}

	public static function wishMade($player_id, $player_name, $wish, $textValue, $msg) {
		Tichudashwood::$instance->notifyAllPlayers( 'wishMade', $msg, [
			'player_id' => $player_id,
			'player_name' => $player_name,
			'wish' => $wish,
			'text_value' => $textValue
		]);
	}

	public static function mahjongGranted() {
		Tichudashwood::$instance->notifyAllPlayers( 'mahjongWishGranted', '', []);
	}


	public static function playerGoOut($player_id, $player_name, $firstOutPlayer) {
		Tichudashwood::$instance->notifyAllPlayers( 'playerGoOut', clienttranslate('${player_name} has shed the cards from hand '), [
								'firstout_id' => $firstOutPlayer,
								'player_id' => $player_id,
								'player_name' => $player_name
		]);
	}

	public static function pass($player_id, $player_name, $msg=null) {
		Tichudashwood::$instance->notifyAllPlayers( 'pass', clienttranslate($msg ?? '${player_name} passes'), [
				'player_id' => $player_id,
				'player_name' => $player_name
		]);
	}



	public static function tableWindow($table) {
		Tichudashwood::$instance->notifyAllPlayers("tableWindow", '', [
				"id" => 'finalScoring',
				"title" => clienttranslate("Result of this Round") ,
				"table" => $table,
				"closing" => clienttranslate( "ok" )
		]);
	}

	public static function newScores($newScores) {
		Tichudashwood::$instance->notifyAllPlayers("newScores", '', [
				'newScores' => $newScores
		]);
	}

	public static function captureCards($player_id, $player_name, $trickValue) {
		Tichudashwood::$instance->notifyAllPlayers( 'captureCards', clienttranslate('${player_name} gets all cards valuing ${trick_value} points'), array(
                'player_id' => $player_id,
                'player_name' => $player_name,
                'trick_value' => $trickValue
            ) );
	}

	public static function autopass($val, $pId=null) {
		if(is_null($pId)) {
			Tichudashwood::$instance->notifyAllPlayers("autopass", '', [
					'autopass' => $val,
			]);
		} else {
			Tichudashwood::$instance->notifyPlayer($pId, "autopass", '', [
				'autopass' => $val,
			]);
		}
	}

	public static function confirmTichu($player_id, $grand, $msg=null) {
		$s = $grand ? ' grand' : '';
		Tichudashwood::$instance->notifyPlayer($player_id, 'confirmTichu', '', [
			'grand' => $grand,
			'msg' => clienttranslate($msg ?? 'Another tichu bet has just been made. Are you sure?')
		]);
	}

	public static function acceptCards($player_id) {
		Tichudashwood::$instance->notifyPlayer($player_id, 'acceptCards', '', ["cards" => CardManager::getCardsPassedBy($player_id)]);
	}

	public static function passCards($player_id, $cardIds) {
		Tichudashwood::$instance->notifyPlayer($player_id, 'passCards', '', $cardIds);
	}
}
?>
