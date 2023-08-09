<?php
	class NotificationManager extends APP_GameClass {

		public static function pickTile($tile, $player_id) {
			NovaLuna::$instance->notifyAllPlayers( "tilePicked", clienttranslate( '${player_name} picks a tile' ), [
					'player_id' => $player_id,
					'player_name' => self::getActivePlayerName(),
					'tile' => $tile->format()
			]);
		}

		public static function placeDisc($disc, $player_id) {
			NovaLuna::$instance->notifyAllPlayers( "tilePicked", clienttranslate( '${player_name} places a disc' ), [
					'player_id' => $player_id,
					'player_name' => self::getActivePlayerName(),
					'disc' => $disc
			]);
		}
	}
?>
