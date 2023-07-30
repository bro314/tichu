<?php
class LogManager extends APP_GameClass {

	public static function insert($playerId, $action, $args = []) {
		$playerId = $playerId == -1 ? Tichu::$instance->getActivePlayerId() : $playerId;
		$current = self::getCurrentRoundAndTrick();
		$round = $current['round'];
		$trick = $current['trick'];
		if($action == 'newTrick') {
			$trick++;
		}
		if($action == 'newRound') {
			$round++;
			$trick = 0;
		}

		$actionArgs = json_encode($args);
		self::DbQuery("INSERT INTO actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ($playerId, $round, $trick, '$action', '$actionArgs')");
	}

	public static function getLastActions($action, $currentTrick=true, $single=false) {
		$arr = is_array($action) ? $action : [$action];
		$actions = implode("','", $arr);

		$sql = "SELECT log_id id, log_player player, log_round round, log_trick trick, log_action action, log_arg arg	FROM actionlog WHERE log_action in ('$actions')";

		if($currentTrick) $sql .= " AND " . self::getCurrentTrickCond();
		$sql .= " ORDER BY log_id DESC";
		$res = self::getObjectListFromDB($sql);

		if(count($res) == 0) return $single ? null : [];
		$ret = [];
		foreach($res as $row) {
			$row['arg'] = json_decode($row['arg'], true);
			if($single) return $row;
			$ret[] = $row;
		}
		return $single ? null : $ret;
	}

	public static function getLastAction($action, $currentTrick=true) {
		return self::getLastActions($action, $currentTrick, true);
	}


	public static function getCurrentRoundAndTrick() {
		return self::getObjectFromDB("SELECT IFNULL(MAX(log_round),0) AS round, IFNULL(MAX(log_trick),0) AS trick FROM actionlog");
	}

	public static function getCurrentTrickCond() {
		$curr = self::getCurrentRoundAndTrick();
		return "log_round=" . $curr['round'] . " AND log_trick=" . $curr['trick'];
	}

	public static function getLastCombos() {
		//id->[description->text, cards->[type,type_arg]]
		$actions = self::getLastActions(["combo", "pass"]);
		$combos = [];
		$passes = [];
		foreach ($actions as $idx=>$row) {
			$pId = $row['player'];
			if($row['action'] == "pass") $passes[] = intval($pId);
			else $combos[$pId] = $row['arg'];
			if($idx == 3) break;
		}
		return [$combos, $passes];
	}

	public static function getLastCombo($skip = 0, $action='combo') {
		$lastComboActions = self::getLastActions($action);
		if(count($lastComboActions) > $skip) {
			$lastComboAction = $lastComboActions[$skip];
			$arg = $lastComboAction['arg'];
			$combo = new Combo($arg['cards'], $arg['type'], $arg['phoenixValue'], $arg['description']);
			$combo->player = $lastComboAction['player'];
			return $combo;
		}
		return Combo::$noCombo;
	}

	public static function getLastComboPlayer() {
		$lastComboAction = self::getLastAction('combo');
		return is_null($lastComboAction) ? 0 : $lastComboAction['player'];
	}


	public static function playCombo($playerId, $combo) {
		$cards = Utils::filterColumns($combo->cards, ["id", "type", "type_arg"]);
		self::insert($playerId, 'combo', ['description' => $combo->description, 'type' => $combo->type, 'cards'=>$cards, 'phoenixValue'=>$combo->phoenixValue]);
	}

	public static function chooseDragon($playerId, $enemies) {
		self::notifyPlayer( $lastComboPlayer, 'chooseDragon', clienttranslate('You have to choose the winner of the Dragon trick'), array(
								'enemies' => $enemies
						));
	}

	public static function askPhoenix($playerId, $combo) {
		$cards = Utils::filterColumns($combo->cards, ["id", "type", "type_arg"]);
		self::insert($playerId, 'phoenix', ['description' => $combo->description, 'type' => $combo->type, 'cards'=>$cards, 'phoenixValue'=>$combo->phoenixValue]);
	}
}
?>
