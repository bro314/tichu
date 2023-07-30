<?php
define('USE_CARD', 1);
class MyDeck extends APP_GameClass {
	private $deck = null;

	function __construct() {
		$names = ['ingredients', 'favors'];
		$this->deck = self::getNew("module.common.deck");
		$this->deck->init('tile');
		$this->deck->autoreshuffle = true;
	}

	public static function toCard($arr) {
		return USE_CARD == 1 ? new Card($arr) : $arr;
	}

	public static function toCards($arr) {
		if(USE_CARD == 0) return $arr;
		foreach ($arr as $key => $a) {
			$arr[$key] = new Card($a);
		}
		return $arr;
	}

	public static function format($arr) {
		foreach ($arr as $key => $a) {
			$arr[$key] = $a->format;
		}
		return $arr;
	}


	function pickCard($from_location, $player_id) {return self::toCard($this->deck->pickCard($from_location, $player_id));}
	function pickCards($nbr, $from_location, $player_id) {return self::toCards($this->deck->pickCards($nbr, $from_location, $player_id));}
	function pickCardForLocation($from_location, $to_location, $location_arg=0) {return self::toCard($this->deck->pickCardForLocation($from_location, $to_location, $location_arg));}
	function pickCardsForLocation($nbr, $from_location, $to_location, $location_arg=0, $no_deck_reform=false) {return self::toCards($this->deck->pickCardsForLocation($nbr, $from_location, $to_location, $location_arg, $no_deck_reform));}
	function moveCard($card_id, $location, $location_arg=0) {$this->deck->moveCard($card_id, $location, $location_arg);}
	function moveCards($cards, $location, $location_arg=0) {$this->deck->moveCards($cards, $location, $location_arg);}
	function insertCard($card_id, $location, $location_arg) {$this->deck->insertCard($card_id, $location, $location_arg);}
	function insertCardOnExtremePosition($card_id, $location, $bOnTop) {$this->deck->insertCardOnExtremePosition($card_id, $location, $bOnTop);}
	function moveAllCardsInLocation($from_location, $to_location, $from_location_arg=null, $to_location_arg=0) {$this->deck->moveAllCardsInLocation($from_location, $to_location, $from_location_arg, $to_location_arg);}
	function moveAllCardsInLocationKeepOrder($from_location, $to_location) {$this->deck->moveAllCardsInLocationKeepOrder($from_location, $to_location);}
	function playCard($card_id) {$this->deck->playCard($card_id);}
	function getCard($card_id) {return self::toCard($this->deck->getCard($card_id));}
	function getCards($cards_array) {return self::toCards($this->deck->getCards($cards_array));}
	function getCardsInLocation($location, $location_arg = null, $order_by = null) {return self::toCards(array_values($this->deck->getCardsInLocation($location, $location_arg, $order_by)));}
	function getCardsMapInLocation($location, $location_arg = null, $order_by = null) {return self::toCards($this->deck->getCardsInLocation($location, $location_arg, $order_by));}
	function countCardInLocation($location, $location_arg=null) {return $this->deck->countCardInLocation($location, $location_arg);}
	function countCardsInLocations() {return $this->deck->countCardsInLocations();}
	function countCardsByLocationArgs($location) {return $this->deck->countCardsByLocationArgs($location);}
	function getPlayerHand($player_id) {return self::toCards(array_values($this->deck->getPlayerHand($player_id)));}
	function getCardOnTop($location) {return self::toCard($this->deck->getCardOnTop($location));}
	function getCardsOnTop($nbr, $location) {return self::toCards($this->deck->getCardsOnTop($nbr, $location));}
	function getExtremePosition($bGetMax ,$location) {return $this->deck->getExtremePosition($bGetMax ,$location);}
	function getCardsOfType($type, $type_arg=null) {return self::toCards($this->deck->getCardsOfType($type, $type_arg));}
	function getCardsOfTypeInLocation($type, $type_arg=null, $location, $location_arg = null) {return self::toCards($this->deck->getCardsOfTypeInLocation($type, $type_arg, $location, $location_arg));}
	function shuffle($location) {return $this->deck->shuffle($location);}

	function getCardsByPlayer(&$players) {
		foreach ($players as &$player) {
			$player['tiles'] = $this->getCardsInLocation($player['id']);
		}
	}

	function getPlayerGrid($pid) {
		$tiles = $this->getCardsInLocation($pid);
		if(count($tiles) == 0) return new PlayerGrid([
			"right" =>  0,
			"bottom" => 0,
		],[]);
		$bounds = self::getObjectFromDB("SELECT max(card_type_arg)+1 bottom, max(card_location_arg)+1 right FROM tile");
		return new PlayerGrid($bounds, $tiles, $pid);
	}

	function shiftRight($pId) {
		self::DbQuery("UPDATE tile SET card_location_arg=card_location_arg+1 WHERE card_location='$pId'");
	}

	function shiftDown($pId) {
		self::DbQuery("UPDATE tile SET card_type_arg=card_type_arg+1 WHERE card_location='$pId'");
	}

}

class Card extends APP_GameClass {
	public $id;
	public $location;
	public $pos;
	function __construct($arr) {
		$this->id = $arr['id'];
		$this->location = $arr['location'];
		if ($this->location == 'wheel' || $this->location == 'deck') $this->pos = $arr['location_arg'];
		else $this->pos = [$arr['type_arg'], $arr['location_arg']];
	}

	function store() {
		$type_arg = 0;
		$location_arg = $this->pos;
		$location = $this->location;
		$id = $this->id;
		if (is_array($location_arg)) {
			$type_arg = $location_arg[0];
			$location_arg = $location_arg[1];
		}
		self::DbQuery("UPDATE tile SET tile_type_arg=$type_arg, tile_location='$location', tile_location_arg=$location_arg WHERE tile_id=$id");
	}

	public function format() {
		return [
			'id' => $this->id,
			'location' => $this->location,
			'pos' => $this->pos
		];
	}
}
?>
