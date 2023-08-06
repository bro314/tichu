<?php
/**
*------
* BGA framework: © Gregory Isabelli <gisabelli@boardgamearena.com> & Emmanuel Colin <ecolin@boardgamearena.com>
* Tichu implementation : © Yannick Priol <camertwo@hotmail.com>
* Credits : Gregory Isabelli, Emmanuel Colin, David Bonnin, Jean Portemer, Bryan McGinnis.
*
* This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
* See http://en.boardgamearena.com/#!doc/Studio for more information.
* -----
*
* tichu.game.php
*
* This is the main file for your game logic.
*
* In this PHP file, you are going to defines the rules of the game.
*
*/


require_once( APP_GAMEMODULE_PATH.'module/table/table.game.php' );




class Tichudashwood extends Table {
	public static $instance;
	function __construct() {
			// Your global variables labels:
			//  Here, you can assign labels to global variables you are using for this game.
			//  You can use any number of global variables with IDs between 10 and 99.
			//  If your game has options (variants), you also have to associate here a label to
			//  the corresponding ID in gameoptions.inc.php.
			// Note: afterwards, you can get/set the global variables with getGameStateValue/setGameStateInitialValue/setGameStateValue
			parent::__construct();
			self::$instance = $this;
			Combo::$noCombo = new Combo([], NO_COMBO);

			self::initGameStateLabels( array(

					"firstOutPlayer"    => 21,     // first player getting rid of his cards
					"secondOutPlayer"   => 22,     // second player getting rid of his cards
					"doubleVictory"     => 23,     // team scoring a double victory
					"mahjongWish"       => 26,     // value wished by Mahjong Owner
					"mahjongOwner"      => 27,     // Mahjong Owner, 0 when wish is granted

					"gameLength"        => 100,    // 1 = 500pts, 2 = 1000pts, 3 = 2000pts
					"playerTeams"       => 101,    // 1 = 13 vs 24, 2 = 12 vs 34, 3 = 14 vs 23, 4 = random
					"gameVariant"       => 102     // 1 = tichu standard
			) );

	}

	// Used for translations and stuff. Please do not modify.
	protected function getGameName( ) {
			return "tichudashwood";
	}

	/*
			setupNewGame:

			This method is called only once, when a new game is launched.
			In this method, you must setup the game according to the game rules, so that
			the game is ready to be played.
	*/
	protected function setupNewGame( $players, $options = array() ) {
			$sql = "DELETE FROM player WHERE 1 ";
			self::DbQuery( $sql );



			PlayerManager::setupPlayers($players);
			self::reloadPlayersBasicInfos();
			CardManager::setupCards();

			/************ Start the game initialization *****/

			// Init global values with their initial values
			self::setGameStateInitialValue( 'firstOutPlayer', 0 );
			self::setGameStateInitialValue( 'secondOutPlayer', 0 );
			self::setGameStateInitialValue( 'doubleVictory', -1 );
			self::setGameStateInitialValue( 'mahjongWish', 0 );
			self::setGameStateInitialValue( 'mahjongOwner', 0 );

			// Init game statistics
			// (note: statistics used in this file must be defined in your stats.inc.php file)
			self::initStat( 'table', 'round_number', 0 );
			self::initStat( 'table', 'trick_number', 0 );
			self::initStat( 'player', 'tricks_win', 0 );
			self::initStat( 'player', 'bomb_number', 0 );
			self::initStat( 'player', 'tichu_number', 0 );
			self::initStat( 'player', 'grandtichu_number', 0 );
			self::initStat( 'player', 'tichu_won_number', 0 );
			self::initStat( 'player', 'grandtichu_won_number', 0 );

			$this->activeNextPlayer();
	}

	/*
			getAllDatas:

			Gather all informations about current game situation (visible by the current player).

			The method is called each time the game interface is displayed to a player, ie:
			_ when the game starts
			_ when a player refreshes the game page (F5)
	*/
	protected function getAllDatas() {
			$deck = CardManager::getDeck();
			$players = PlayerManager::getPlayers();
			$current_player_id = self::getCurrentPlayerId();    // !! We must only return informations visible by this player !!
			$names = [];
			$result = [];
			foreach($players as $player) $names[$player['no']] = $player['name'];
			foreach($players as &$player) {
					if($player['id'] == $current_player_id)
						$result['hasBomb'] = $player['has_bomb'] == 1;
					else { // hide secret fields
						unset($player['has_bomb']);
						unset($player['pass']);
					}
			}
			unset($player);


			$result['players'] = Utils::parseInt($players, ['id', 'no', 'has_bomb']);

			$result['hand'] = array_values($deck->getCardsInLocation( 'hand', $current_player_id ));

			$ticHand = new Hand($result['hand']);
			$result['handcount'] = $deck->countCardsByLocationArgs( 'hand' );
			$result['capturedpoints'] = CardManager::calculatCapturedPoints();
			$result['allcombos'] = $deck->getCardsInLocation( 'allcombos' );
			$result['firstoutplayer'] = intval(self::getGameStateValue( 'firstOutPlayer' ));
			$result['mahjongOwner'] = intval(self::getGameStateValue( 'mahjongOwner' ));
			$result['mahjongWish'] = intval(self::getGameStateValue( 'mahjongWish' ));

			$lastCombo = LogManager::getLastCombo();
			$result['lastComboPlayer'] = $lastCombo->player;
			$result['cardslastcombo'] = $lastCombo->cards;
			$result['lastComboDescription'] = $lastCombo->description;
			list($lastCombos, $passes) = LogManager::getLastCombos($current_player_id);
			$result['allLastCombos'] = $lastCombos;
			$result['passes'] = $passes;
			$currentTrick = array_values($deck->getCardsInLocation('combos'));
			$result['currentTrick'] = $currentTrick;
			$result['currentTrickValue'] = CardManager::getTrickValue($currentTrick);

			return $result;
	}

	/*
			getGameProgression:

			Compute and return the current game progression.
			The number returned must be an integer beween 0 (=the game just started) and
			100 (= the game is finished or almost finished).

			This method is called each time we are in a game state with the "updateGameProgression" property set to true
			(see states.inc.php)
	*/
	function getGameProgression() {
			$p = [5,10,20][self::getGameStateValue('gameLength')-1];
			return round( min( 100, PlayerManager::getHighestScore() / $p ) );
	}

	function test() {
		LogManager::getLastComboPlayer();
		Utils::die(date('Y-m-d H:i', time()));
	}

	//////////////////////////////////////////////////////////////////////////////
	//////////// Utility functions
	////////////

	public static function getCurrentId() {return self::$instance->getCurrentPlayerId();}

	function completePlayCombo($playerId, $combo) {
			$player = PlayerManager::getPlayer($playerId);
			$mahjongOwner = self::getGameStateValue( 'mahjongOwner' );
			$wish = self::getGameStateValue( 'mahjongWish' );
			$cards = $combo->cards;
			$cardIds = array_column($combo->cards, 'id');
			$deck = CardManager::getDeck();
			$cardsInHand = $deck->getCardsInLocation( 'hand', $playerId );
			$currentHand = new Hand($cardsInHand);
			$remainingCards = array_values(array_filter($cardsInHand, function($card) use ($cardIds) {return !in_array($card['id'], $cardIds);}));
			$remainingHand = new Hand($remainingCards);
			$lastCombo = LogManager::getLastCombo(1);
			if($lastCombo->type == NO_COMBO) PlayerManager::setAutopass(0);

			if($combo->type == DOG_COMBO && $lastCombo->type != NO_COMBO)
				throw new feException( self::_('the Dog can only be played as a lead'), true );
			if(!$combo->canBeat($lastCombo))
				throw new feException( self::_("This combo can't beat the last combo"), true );

			$notification_description = clienttranslate('${player_name} plays ${combo_name}');
			if($wish != 0) {
					if(in_array($wish, array_column($cards, 'type_arg'))) {
							$notification_description = clienttranslate('${player_name} plays ${combo_name} and grants Mahjong\'s owner wish');
							self::setGameStateValue( 'mahjongWish' , 0);
							NotificationManager::mahjongGranted();
					} else {
							if($combo->type != BOMB_COMBO && $currentHand->canFulFillWish($wish, $lastCombo))
								throw new feException( sprintf( self::_("You must grant the Mahjong Wish and play a %s"),
									CardManager::cardToStr($wish) ), true );
					}
			}

			if(count($cardsInHand) == 14 && $player['call_tichu'] == -1) {
					PlayerManager::tichuBet($playerId, 0);
					NotificationManager::tichuBet($playerId, self::getCurrentPlayerName(), 0);
			}


			if ($player['has_bomb'] && !$remainingHand->hasBomb()) {
				NotificationManager::hasBomb($playerId, false);
				PlayerManager::setHasBomb($playerId, 0);
			}

			NotificationManager::playCombo($playerId, self::getCurrentPlayerName(), $combo, $notification_description);
			$deck->moveCards($cardIds, 'combos');

			if($combo->type== BOMB_COMBO) self::incStat( 1, 'bomb_number', $playerId );

			if( $combo->hasMahjong() )
					$this->gamestate->nextState('mahjongPlayed');
			else
					$this->gamestate->nextState('nextPlayer');


	}

	//////////////////////////////////////////////////////////////////////////////
	//////////// Player actions
	////////////

	/*
	chooseDragonGift
	move all cards captured this trick to the opponent chosen by Dragon player.
	we calculate trick value and notify elements to be updated
	*/
	function chooseDragonGift($playertogive)  {
		self::checkAction( 'chooseDragonGift' );
		$players = PlayerManager::getPlayers();
		$trickWinner = LogManager::getLastComboPlayer();
		$nextPlayers = PlayerManager::getNextPlayers($trickWinner);
		$dragonGivenToId =  $nextPlayers[$playertogive*2]['id'];


		self::incStat( 1, 'tricks_win', $trickWinner );
		$deck = CardManager::getDeck();

		$cardsCaptured = $deck->getCardsInLocation( 'combos');
		$trickValue = CardManager::getTrickValue( $cardsCaptured );

		$deck->moveAllCardsInLocation( 'combos', 'captured', null, $dragonGivenToId);

		NotificationManager::log('${player_name} wins the trick', ['player_name' => $players[$trickWinner]['name']]);
		NotificationManager::captureCards($dragonGivenToId, $players[$dragonGivenToId]['name'], $trickValue);

		$inPlay = array_keys($deck->countCardsByLocationArgs('hand'));
		$doubleVic = count($inPlay) == 2 && $players[$inPlay[0]]['team'] == $players[$inPlay[1]]['team'];
		if($doubleVic) self::setGameStateValue( 'doubleVictory', 1-$players[$inPlay[0]]['team'] );
		if(count($inPlay) == 1 || $doubleVic) {
			$this->gamestate->nextState( 'endRound' );
		} else {
			$action = LogManager::getLastAction('confirm')['arg'];
			$this->gamestate->nextState('newTrick');
		}
	}

	/*
	// giveTheCards
	// Checks if cards can be sent
	// get array player_id => direction with self::getPlayersToDirection()
	// update DB location, location_arg and card_passed_from
	// notify passCards
	// Move to next gamestate
	*/
	function giveTheCards( $card_ids )  {
			self::checkAction( "giveCards" );

			$player_id = self::getCurrentPlayerId();

			if( count( $card_ids ) != 3 )
					throw new feException( self::_("You must give exactly 3 cards") );

			$cards = CardManager::getDeck()->getCards( $card_ids );
			if( count( $cards ) != 3 )
					throw new feException( self::_("Some of these cards don't exist") );

			foreach( $cards as $card )
			{
					if( $card['location'] != 'hand' || $card['location_arg'] != $player_id )
							throw new feException( self::_("Some of these cards are not in your hand") );
			}

			// Determine which players to give the cards to
			$player_to_give_cards = null;
			$nextPlayers = PlayerManager::getNextPlayers(null, true);
			foreach ($card_ids as $idx => $card) {
				CardManager::getDeck()->moveCard($card, 'temporary', $nextPlayers[$idx]['id']);
				CardManager::setPassedCards($card_ids, $player_id);
			}
			NotificationManager::passCards($player_id, $card_ids);
			$this->gamestate->setPlayerNonMultiactive( $player_id, "showPassedCards" );
	}

	/*
	// Play Bomb:
	// first check if last card played is the Hound
	// second check : you can't steal the right to lead of another player
	// check if it's a bomb with checkCombo
	// check if tichu bet is still possible
	// reset number of consecutive pass
	// update GameStateValues
	// create new combo in DB
	// check if a MahjongWish has been granted
	// update cards position in DB and notify PlayCombo to JS
	*/
	function playBomb($cards_ids )  {
		$name = $this->gamestate->state()['name'];
		if($name != 'playCombo' && $name != 'confirmTrick')
			throw new feException( self::_("You can't play a bomb right now"), true );

		$playerId = self::getCurrentPlayerId();
		$lastCombo = LogManager::getLastCombo();
		if ($lastCombo == null && $playerId != self::getActivePlayerId()) {
				throw new feException( self::_('You can\'t bomb before the trick starts'), true );
		}

		if($lastCombo != null && $lastCombo->type == DOG_COMBO && $playerId != self::getActivePlayerId()) {
				throw new feException( self::_('You can\'t bomb the dog'), true );
		}

		LogManager::insert(self::getCurrentPlayerId(), 'changePlayer', ['transition' => 'playBomb', 'active' => self::getActivePlayerId(), 'last' => $name]);
		$this->gamestate->nextState('changePlayer');
		/*$cards = array_values(CardManager::getDeck()->getCards($cards_ids));
		$combo = new Combo($cards, BOMB_COMBO);
		if(!$combo->checkType())
			throw new feException( self::_("This is not a bomb"), true );
		LogManager::playCombo($playerId, $combo);
		$this->completePlayCombo($playerId, $combo, true);*/
	}

	function choosePhoenix( $phoenixValue )  {
			self::checkAction( 'phoenixPlay' );
			$pId = self::getActivePlayerId();
			$combo = LogManager::getLastCombo(0,'phoenix');
			if(!in_array($phoenixValue, $combo->phoenixValue))
				throw new feException( self::_('You have chosen an invalid value for the phoenix, choose a new hand'), true );
			$combo->setPhoenixValue($phoenixValue);
			LogManager::playCombo($pId, $combo);
			$this->completePlayCombo($pId, $combo);
	}

	function playCombo( $cards_ids ) {
			self::checkAction( 'playCombo' );
			$cards = array_values(CardManager::getDeck()->getCards($cards_ids));
			$combo = new Combo($cards);
			if($combo->type == INVALID_COMBO)
				throw new feException( self::_("You must play a valid combo"), true );
			if($this->gamestate->state()['name'] == 'playBomb' && $combo->type != BOMB_COMBO)
				throw new feException( self::_("This is not a valid bomb"), true );
			$playerId = self::getCurrentPlayerId();
			if(is_array($combo->phoenixValue)) $combo->recheckPhoenix();

			if(is_array($combo->phoenixValue)) {
				LogManager::askPhoenix($playerId, $combo);
				$this->gamestate->nextState('phoenixPlay');
			} else {
				LogManager::playCombo($playerId, $combo);
				$this->completePlayCombo($playerId, $combo);
			}
	}

	function pass($onlyOnce)  {
		$player_id = self::getCurrentPlayerId();
		if($player_id == self::getActivePlayerId()) {
			if($this->gamestate->state()['name'] == 'playComboOpen') return;
			$currentMahjongWish = self::getGameStateValue( 'mahjongWish' );
			if( $currentMahjongWish > 0) {
				$cardsInHand = CardManager::getDeck()->getPlayerHand($player_id);
				$hand = new Hand($cardsInHand, $this);
				if($hand->canFulfillWish($currentMahjongWish, LogManager::getLastCombo()))
				throw new feException( sprintf( self::_("You must grant the Mahjong Wish and play a %s "),
				CardManager::cardToStr($currentMahjongWish) ), true );
			}

			LogManager::insert($player_id, 'pass');
			NotificationManager::pass($player_id, self::getActivePlayerName());
			if(!$onlyOnce) {
				PlayerManager::setAutopass(2, $player_id);
				NotificationManager::autopass(2, $player_id);
			}
			$this->gamestate->nextState( 'nextPlayer' );
		} else {
			PlayerManager::setAutopass($onlyOnce ? 1 : 2, $player_id);
			NotificationManager::autopass($onlyOnce ? 1 : 2, $player_id);
		}

	}

	function cancelAutopass() {
		PlayerManager::setAutopass(0, self::getCurrentPlayerId());
		NotificationManager::autopass(0, self::getCurrentPlayerId());
	}

	function cancel() {
		$action = LogManager::getLastAction('changePlayer');
		LogManager::insert($action['arg']['active'], 'changePlayer', ['transition' => $action['arg']['last']]);
		$this->gamestate->nextState('changePlayer');
	}

	/*
	// grandTichuBet:
	// check if the player has 8 cards, if he has already made a grand tichu bet
	// update tichu bet to 0 if grand tichu bet is done
	// update grand tichu bet
	// notify grandTichuBet for updating players panel
	// move to next gamestate
	*/
	function grandTichuBet( $bet, $confirmed=false ) {
		self::checkAction( 'grandTichuBet' );
		$player_id = self::getCurrentPlayerId();
		$player = PlayerManager::getPlayer($player_id);
		if($player['call_tichu'] != -1) return;

		$handcount = CardManager::getDeck()->countCardInLocation( 'hand', $player_id );
		if( $handcount <> 8 )
			throw new feException( "Can't make grand tichu bet: you don\'t have 8 cards" );

		if( $player['call_grand_tichu'] >= 0 )
			throw new feException( "Can't make bet: you already bet" );

		$lastTichuCall = LogManager::getLastAction('tichuCall');
		$now = time();
		if( $bet == 200 ){
			if(!$confirmed &&
					$lastTichuCall != null &&
					$now - intval($lastTichuCall['arg']) < TICHU_CONFIRMATION_TRESHOLD) {
				NotificationManager::confirmTichu($player_id, true);
				return;
			}
			LogManager::insert($player_id, 'tichuCall', $now);
			self::incStat( 1, 'grandtichu_number', $player_id );
		}
		PlayerManager::grandTichuBet($player_id, $bet);
		NotificationManager::grandTichuBet($player_id, $player['name'], $bet);
		$this->gamestate->setPlayerNonMultiactive($player_id, "dealLastCards");
	}

	/*
	// TichuBet:
	// check if the player has already made a tichu bet
	// update grand tichu bet to 0 if only 8 cards dealt
	// update tichu bet
	// notify TichuBet for updating players panel
	// move to next gamestate
	*/
	function tichuBet($confirmed=false) {
		$player_id = self::getCurrentPlayerId();
		$player = PlayerManager::getPlayer($player_id);
		if($player['call_grand_tichu'] == 200)
			throw new feException("You already made a grand tichu bet.");
		$state = $this->gamestate->state();
		$lastTichuCall = LogManager::getLastAction('tichuCall');
		$now = time();
		if(!$confirmed &&
				$lastTichuCall != null &&
				$now - intval($lastTichuCall['arg']) < TICHU_CONFIRMATION_TRESHOLD) {
			NotificationManager::confirmTichu($player_id, false);
			return;
		}
		if(!$confirmed && $this->getGameStateValue('firstOutPlayer') != 0) {
			NotificationManager::confirmTichu($player_id, false, "You can't win this tichu bet anymore. Are you sure?");
			return;
		}
		LogManager::insert($player_id, 'tichuCall', $now);
		self::incStat( 1, 'tichu_number', $player_id );
		PlayerManager::tichuBet($player_id, 100);
		NotificationManager::tichuBet($player_id, self::getCurrentPlayerName(), 100);
		if( $state['name'] == 'grandTichuBets' ) {
			$this->gamestate->setPlayerNonMultiactive($player_id, 'dealLastCards');
		}
	}

	function confirmTichu($bet) {
		if($bet == 200) $this->grandTichuBet(200, true);
		else $this->tichuBet(true);
	}

	/*
	// acceptCards:
	// destroy cards created on cardontable_
	// AJAX cards to giveTheCards PHP
	*/
	function acceptCards() {
			$player_id = self::getCurrentPlayerId();
			NotificationManager::acceptCards($player_id);

			$deck = CardManager::getDeck();
			$cards = $deck->getCardsInLocation( "temporary", $player_id );


			$deck->moveAllCardsInLocation( "temporary", "hand", $player_id, $player_id );
			$hand = new Hand($deck->getCardsInLocation("hand", $player_id));

			PlayerManager::setHasBomb($player_id, $hand->hasBomb() ? 1 : 0);

			$this->gamestate->setPlayerNonMultiactive( $player_id, "acceptCards" );
	}

	/*
	// makeAWish:
	// $wish<13 : value between 0 and 13 means 2 to Ace
	// modify GSV mahjongWish
	// notify players about value chosen
	// next state
	*/
	function makeAWish( $wish ) {
			self::checkAction( 'makeAWish' );

			if ($wish == 15) {
					$msg = clienttranslate('${player_name} owns the Mahjong and has no wish');
					$textValue = '0';
			} else {
					self::setGameStateValue( 'mahjongWish', $wish);
					$textValue = $this->values_label[$wish];
					$msg = clienttranslate('${player_name} owns the Mahjong and wants a ${text_value}');
			}
			NotificationManager::wishMade(self::getActivePlayerId(), self::getActivePlayerName(), $wish, $textValue, $msg);
			$this->gamestate->nextState("nextPlayer");
	}

	function collect() {
		$action = LogManager::getLastAction('confirm');
		$pId = $action['player'];
		$action = $action['arg'];
		if($action['dragon']) $this->gamestate->nextState('chooseDragonGift');
		else {
			$deck = CardManager::getDeck();
			$trickValue = CardManager::getTrickValue($deck->getCardsInLocation('combos'));
			$deck->moveAllCardsInLocation( 'combos', 'captured', null, $pId);
			NotificationManager::captureCards($pId, self::getCurrentPlayerName(), $trickValue);
			$this->gamestate->nextState('newTrick');
		}

	}

	function cancelPhoenix() {
		$last = LogManager::getLastCombo();
		if($last->type == NO_COMBO)
				$this->gamestate->nextState('cancel');
		else {
			$this->gamestate->nextState('playCombo');
		}
	}
	//////////////////////////////////////////////////////////////////////////////
	//////////// Game state arguments
	////////////

	function argShowPassedCards() {
		return ['_private' => $result['passedCards'] = CardManager::getPassedCards()];
	}

	function argsPhoenixPlay() {
		$vals = LogManager::getLastCombo(0,'phoenix')->phoenixValue;
		return [ '_private' => ['active' => [
			'values' => array_map('intval', $vals)
		]]];
	}

	/*
	// ChooseDragonGift:
	// get opponents before and after the Dragon player
	// notify Dragon player
	*/
	function argChooseDragonGift() {
		$lastComboPlayer = LogManager::getLastComboPlayer();
		$nextPlayers = array_column(PlayerManager::getNextPlayers($lastComboPlayer), 'name');
		return ['enemies' => [$nextPlayers[0], $nextPlayers[2]]];
	}

	function argPlayComboOpen() {
		return LogManager::getCurrentRoundAndTrick();
	}

	function argPlayBomb() {
		return LogManager::getLastAction('changePlayer')['arg'];
	}
	//////////////////////////////////////////////////////////////////////////////
	//////////// Game state actions
	////////////

	/*
	// New round:
	// Reset GameStateValues and increase Statistic Values
	// Shuffle and deal cards to all players
	// Notif newRound enables PlayersPanel
	// Notif newDealPart1 sends 8 first cards to all players�??hand
	// Move to next gamestate
	*/
	function stNewRound() {
			LogManager::insert(0,'newRound');
			self::setGameStateValue( 'firstOutPlayer', 0 );
			self::setGameStateValue( 'secondOutPlayer', 0 );
			self::setGameStateValue( 'doubleVictory', -1 );
			self::setGameStateValue( 'mahjongWish', 0 );
			self::setGameStateValue( 'mahjongOwner', 0 );

			self::incStat( 1, 'round_number' );

			//self::DbQuery( "DELETE FROM combo WHERE 1" );   // Remove all combo on table

			CardManager::resetPassedCards();
			$deck = CardManager::getDeck();
			$deck->shuffle('deck');

			$players = PlayerManager::getPlayerIds();
			PlayerManager::resetTichus();
			foreach( $players as $player_id) {
				$cards = $deck->pickCards( 8, 'deck', $player_id );
				NotificationManager::dealCards($player_id, $cards, 'A new round starts. The 8 first cards are dealt');
			}

			$this->gamestate->setAllPlayersMultiactive();
			$this->gamestate->nextState( "GTBets" );
			// make all players multiactive just before entering the state
	}

	/*
	// DealLastCards
	// Check if all 4 players have chosen about the Grand Tichu bet
	// Deal the remaining 6 cards
	// Notif newDealPart2 sends last 6 cards to all players�??hand
	// Move to next gamestate
	*/
	function stDealLastCards()  {
			$players = PlayerManager::getPlayerIds();
			foreach( $players as $player_id) {
				$cards = CardManager::getDeck()->pickCards( 6, 'deck', $player_id );
				NotificationManager::dealCards($player_id, $cards, 'The last 6 cards are dealt');
			}
			$this->gamestate->nextState( "giveCards" );
	}

	function stGiveCards() {
		$this->gamestate->setAllPlayersMultiactive();
	}

	function stShowPassedCards() {
		$this->gamestate->setAllPlayersMultiactive();
	}

	/*
	// New trick:
	// Reset GameStateValues and increase Statistic Values
	// Clear combo DB
	// Check who starts the new trick.
	// if it�??s a new round, it�??s the Mahjong Owner.
	// if not, we check if the winner of last trick still has cards in hand
	// if not, we check the next one
	// if not, we check the next one and that�??s all because case of one single player ends the round.
	// Notif log
	*/
	function stNewTrick() {
			self::incStat( 1, 'trick_number' );
			$lastWinner = LogManager::getLastComboPlayer();
			LogManager::insert(0,'newTrick');
			PlayerManager::setAutopass(0);
			NotificationManager::autopass(0);

			$deck = CardManager::getDeck();

			if( $lastWinner == 0 ) {   //first trick of a new round, owner of Mah Jong starts
				$card = array_values($deck->getCardsOfType(TYPE_MAHJONG,1))[0];
				$mahjongOwnerId = $card['location_arg'];
				self::setGameStateValue( 'mahjongOwner', $mahjongOwnerId );
				$this->gamestate->changeActivePlayer( $mahjongOwnerId );
				$this->giveExtraTime($mahjongOwnerId);
				$notify = 'A new round starts. ${player_name} has the Mahjong';
				$bombs = PlayerManager::getBombStatus();
				foreach ($bombs as $k => $v) {
					NotificationManager::hasBomb($k, intval($v));
				}
				self::dump("vinayakr_debug bombs", $bombs);
			} else {   //this is not the first trick
				$hand_count = $deck->countCardsByLocationArgs( 'hand' );

				if( isset( $hand_count[ $lastWinner ] ) )  {   //winner of last trick is still in play
					$this->gamestate->changeActivePlayer( $lastWinner );
					$this->giveExtraTime($lastWinner);

					$notify = '${player_name} has won the previous trick and starts a new one.';
				} else {   //winner of last trick has no more cards. We check the next 2 players
					$nextPlayers = PlayerManager::getNextPlayers($lastWinner);
					while(!isset($hand_count[$nextPlayers[0]['id']])) array_shift($nextPlayers);
					$nextPlayerId = $nextPlayers[0]['id'];
					$this->gamestate->changeActivePlayer( $nextPlayerId );
					$this->giveExtraTime($nextPlayerId);
					$notify = '${player_name} is the next player and starts a new trick.';
				}
			}
			NotificationManager::log($notify, ['player_name' => self::getActivePlayerName()]);

			$this->gamestate->nextState( 'firstCombo' );
	}

	/*
	// Next player:
	// check if the player has shed his cards for a possible doubleVictory
	// check if only one player remaining. He gives his cards to first player out and the round is over.
	// check for double victory
	// check if trick is over after enough Passes.
	// check for Hound play : skip next player
	// then switch to next player in play
	*/
	function stNextPlayer() {
		$lastCombo = LogManager::getLastCombo();
		$lastComboPlayer = $lastCombo->player;
		// get last player who played or passed
		if($lastCombo->type==BOMB_COMBO) {
			$player_id = LogManager::getLastActions(["combo", "pass"])[0]['player'];
			$this->gamestate->changeActivePlayer( $player_id );
		} else {
			$player_id = self::getActivePlayerId();
		}
		$players = PlayerManager::getPlayers();
		$doubleVictory = null;
		$deck = CardManager::getDeck();
		if( $deck->countCardInLocation( 'hand', $player_id ) == 0 )  {
				// This player gets out of the trick
			$firstOutPlayer = self::getGameStateValue( 'firstOutPlayer' );
			if ( $firstOutPlayer==0 ) {// If he is the first, record it
				self::setGameStateValue( 'firstOutPlayer', $player_id );
				$firstOutPlayer = $player_id;
			} elseif( self::getGameStateValue( 'secondOutPlayer' )==0 ) {// If he is the second, record it
				self::setGameStateValue( 'secondOutPlayer', $player_id );
				$secondOutPlayerTeam = $players[$player_id]['team'];
				if($players[$firstOutPlayer]['team'] == $secondOutPlayerTeam) {
					self::setGameStateValue( 'doubleVictory', $secondOutPlayerTeam );
					$this->gamestate->nextState( 'endRound' );
					return;
				}
			}
			NotificationManager::playerGoOut($player_id, self::getActivePlayerName(), $firstOutPlayer);
		}

		// get number of players still in round
		$player_still_in_round = PlayerManager::numPlayersStillInRound();

		$next_players = PlayerManager::getNextPlayers( $player_id ); //next players (including those without cards)
		$handCounts = $handCounts ?? CardManager::getDeck()->countCardsByLocationArgs('hand');
		$next = null;
		if ($lastCombo->type == DOG_COMBO && $player_still_in_round > 1) {
			// Dog transfers right to deal to partner so next player is skipped
			$next_players[] = array_shift($next_players);
			foreach($next_players as $player) {
				if(isset( $handCounts[$player['id']])) {
					$next = $player['id'];
					break;
				}
			}
			$this->gamestate->changeActivePlayer($next);
			$this->giveExtraTime($next);
			$this->gamestate->nextState( 'playComboOpen' );
			return;
		}


		// search for next Player with enough cards, but don't go beyond the player who played the last combo
		$amount = min(count($lastCombo->cards),4);
		if($lastCombo->hasDragon()) $amount = 4;
		$wish = $this->getGameStateValue('mahjongWish');
		foreach($next_players as $player) {
			$pId = $player['id'];
			if($lastComboPlayer == $pId) {
				$next = $pId;
				break;
			}
			if(!isset( $handCounts[$pId])) continue;
			if($player['pass'] == 1 && PlayerManager::canPass($pId, $wish, $lastCombo)) {
				PlayerManager::setAutopass(0, $pId);
				NotificationManager::autopass(0, $pId);
				NotificationManager::pass($pId, $player['name']);
				continue;
			}
			if($player['pass'] == 2 && PlayerManager::canPass($pId, $wish, $lastCombo)) {
				NotificationManager::pass($pId, $player['name']);
				continue;
			}
			if($handCounts[$pId] < $amount) {
					NotificationManager::pass($pId, $player['name']);
					continue;
			}
			$next = $pId;
			break;
		}
		if($player_still_in_round == 1 || $lastComboPlayer == $next) {
			// trick is complete(either because the 3rd player finished or all players passed)
			$dragon = $lastCombo->hasDragon();
			if( $player_still_in_round == 1 ) {
				self::incStat( 1, 'tricks_win', $lastComboPlayer );
				if($dragon) {
					$this->gamestate->changeActivePlayer( $lastComboPlayer );
					$this->giveExtraTime($lastComboPlayer);
					$this->gamestate->nextState( 'chooseDragonGift' );
				} else {
					$trickValue = CardManager::getTrickValue($deck->getCardsInLocation('combos'));
					$deck->moveAllCardsInLocation( 'combos', 'captured', null, $lastComboPlayer);
					NotificationManager::captureCards($lastComboPlayer, $players[$lastComboPlayer]['name'], $trickValue);
					$this->gamestate->nextState( 'endRound' );
				}
			} else {
				$this->gamestate->changeActivePlayer( $lastComboPlayer );
				$this->giveExtraTime($lastComboPlayer);
				LogManager::insert($lastComboPlayer, 'confirm', ['nextPlayer' => $next, 'dragon' => $dragon]);
				$this->gamestate->nextState( 'confirmTrick' );
			}

		} else {
				// Continue the current trick play
				// => go to next player with cards in hand

				$this->gamestate->changeActivePlayer($next);
				$this->giveExtraTime($next);

				$this->gamestate->nextState( 'nextPlayer' );
		}
	}

	function stEndRound() {
			$team_points = [0,0];
			$team_points_GT = [0,0];
			$team_points_T = [0,0];
			$deck = CardManager::getDeck();

			$firstOutPlayer = self::getGameStateValue( 'firstOutPlayer' );

			$players = PlayerManager::getPlayers();

			$doubleVic = self::getGameStateValue( 'doubleVictory' );
			if($doubleVic >= 0) {
					$team_points[$doubleVic] = 200;
					NotificationManager::log('It\'s a double victory for ${player_name}\'s team. They score 200 points.',
						['player_name' => $players[$firstOutPlayer]['name']]);
			} else {
					//get last player
					$lastPlayerId = array_keys($deck->countCardsByLocationArgs('hand'))[0];
					$deck->moveAllCardsInLocation('captured', 'captured', $lastPlayerId, $firstOutPlayer);

					$ids = array_keys(array_filter($players, function($player) {return $player['team'] == "0";}));
					$cards = array_merge($deck->getCardsInLocation('captured', $ids[0]), $deck->getCardsInLocation('captured', $ids[1]));
					if($players[$lastPlayerId]['team'] == 1) $cards = array_merge($cards, $deck->getCardsInLocation('hand', $lastPlayerId));
					$result = CardManager::getTrickValue($cards, true);
					$team_points[0] = $result['score'];
					$team_points[1] = 100 - $team_points[0];


			}

			$bBetsGTMade = false;
			$bBetsTMade = false;
			$teams = [[],[]];
			foreach( $players as $player_id => $player ) {
					$teams[$player['team']][] = $player;
					if( $player['call_grand_tichu'] == 200) {
							$bBetsGTMade = true;
							if( $player_id == $firstOutPlayer ) {
									self::incStat( 1, 'grandtichu_won_number', $player_id );
									$team_points[$player['team']] += 200;
									$team_points_GT[$player['team']] += 200;
									NotificationManager::log('${player_name} has made the Grand Tichu and team scores 200 points!',
									['player_name' => $player['name']]);
							} else {
									$team_points[$player['team']] -= 200;
									$team_points_GT[$player['team']] -= 200;
									NotificationManager::log('${player_name} has not made the Grand Tichu and the team loses 200 points!',
											['player_name' => $player['name']]);
							}
					}

					if( $player['call_tichu'] == 100) {
							$bBetsTMade = true;
							if( $player_id == $firstOutPlayer ) {
									self::incStat( 1, 'tichu_won_number', $player_id );
									$team_points[$player['team']] += 100;
									$team_points_T[$player['team']] += 100;
									NotificationManager::log('${player_name} has made the Tichu and the team scores 100 points!',
											['player_name' => $player['name']]);
							} else {
									$team_points[$player['team']] -= 100;
									$team_points_T[$player['team']] -= 100;
									NotificationManager::log('${player_name} has not made the Tichu and the team loses 100 points!',
											['player_name' => $player['name']]);
							}
					}
			}


			// ////////// Display table window with results /////////////////
			$table = [];

			// Header line

			$firstRow = [''];
			$firstRow[] = array(
					'str' => 'Team ${first_player_name} and ${third_player_name}',
					'args' => array(
							'first_player_name' => $teams[0][0]['name'],
							'third_player_name' => $teams[0][1]['name']
					) ,
					'type' => 'header'
			);
			$firstRow[] = array(
					'str' => 'Team ${second_player_name} and ${fourth_player_name}',
					'args' => array(
							'second_player_name' => $teams[1][0]['name'],
							'fourth_player_name' => $teams[1][1]['name']
					) ,
					'type' => 'header'
			);
			$table[] = $firstRow;
			$createRow = function($title, $val, $val2) {
				return [ ['str'=>clienttranslate($title), 'args' => []], $val, $val2 ];
			};

			if( $doubleVic >= 0 ) {
					// Double Victory Points
					$table[] = $createRow('Double Victory Points',$doubleVic == 0 ? 200 : 0,$doubleVic == 1 ? 200 : 0);
			} else {
					$val = $result['table'][5]*5;
					$table[] = $createRow('5 Points',$val,20-$val);

					$val = $result['table'][10]*10;
					$table[] = $createRow('10 Points',$val,40-$val);

					$val = $result['table'][13]*10;
					$table[] = $createRow('K Points',$val,40-$val);

					$val = in_array(TYPE_PHOENIX,$result['special']) ? -25 : 0;
					$table[] = $createRow('Phoenix Points',$val,-25-$val);

					$val = in_array(TYPE_DRAGON,$result['special']) ? 25 : 0;
					$table[] = $createRow('Dragon Points',$val,25-$val);
			}
			if($bBetsGTMade) // Grand Tichu
					$table[] = $createRow('Grand Tichu Points',$team_points_GT[0],$team_points_GT[1]);

			if( $bBetsTMade) // Tichu
					$table[] = $createRow('Tichu Points',$team_points_T[0],$team_points_T[1]);

			// Total Points
			$table[] = $createRow('Total Points',$team_points[0],$team_points[1]);

			NotificationManager::tableWindow($table);

			// Save points to db
			PlayerManager::updateScores($team_points);

			$deck->moveAllCardsInLocation( null, 'deck' );

			$newScores = PlayerManager::getScores();
			NotificationManager::newScores($newScores);


			$max_score = max( $newScores );

			$end_points = [500,1000,2000][self::getGameStateValue('gameLength')-1];

			if($max_score >= $end_points) {
					$scores = array_unique($newScores);
					if( count($scores) > 1 ) {
							$this->gamestate->nextState("endGame");
							return;
					} // else both teams are above $end_points with the same score : game goes on
			}
			$this->gamestate->nextState( 'newRound' );
	}

	function stChangePlayer() {
		$action = LogManager::getLastAction('changePlayer');
		$this->gamestate->changeActivePlayer($action['player']);
		$this->gamestate->nextState( $action['arg']['transition'] );
	}


	//////////////////////////////////////////////////////////////////////////////
	//////////// Zombie
	////////////

	/*
			zombieTurn:

			This method is called each time it is the turn of a player who has quit the game (= "zombie" player).
			You can do whatever you want in order to make sure the turn of this player ends appropriately
			(ex: pass).
	*/
	function zombieTurn( $state, $active_player ) {
			$statename = $state['name'];
			NotificationManager::log('${playerName} makes a zombie turn');
			if ($state['type'] === "activeplayer") {
					switch ($statename) {
					case "playComboOpen":
					case "playCombo":
							$this->pass();
							break;
					case "mahjongWish":
							$this->makeAWish(13);
							break;
					case "choiceDragonGift":
							$this->chooseDragonGift(0);
							break;
					}
					$this->gamestate->nextState( "zombiePass" );
					return;
			}

			if ($state['type'] == "multipleactiveplayer") {
					// States when a confirm is required from the players, or in a poll to continue the game or not
					// Make sure player is in a non blocking status for role turn
					switch ($statename) {
					case "grandTichuBets":
							$this->grandTichuBet(0);
							break;

					case "giveCards":
							$this->zombiGiveCards();
							break;

					case "showPassedCards":
							$this->acceptCards();
							break;

					default:
							self::DbQuery(sprintf("UPDATE player SET player_is_multiactive = 0 WHERE player_id = '%s'", $active_player));
							$this->gamestate->updateMultiactiveOrNextState('');
					return;
					}
			}

			throw new feException("Zombie mode not supported at this game state: ".$statename);
	}

	function zombiGiveCards() { //3 random cards are given
			$player_idm = self::getCurrentPlayerId();
			$cards = CardManager::getDeck()->getCardsInLocation('hand', $player_idm);
			shuffle($cards);
			$cards_ids = array_column(array_splice($cards,0,3), 'id');
			$this->giveTheCards($card_ids);
	}


	///////////////////////////////////////////////////////////////////////////////////:
	////////// DB upgrade
	//////////

	/*
			upgradeDb:

			You don't have to care about this until your game has been published on BGA.
			Once your game is on BGA, this method is called everytime the system detects a game running with your old
			Database scheme.
			In this case, if you change your Database scheme, you just have to apply the needed changes in order to
			update the game database and allow the game to continue to run with your new version.

	*/
	function upgradeTableDb( $from_version ) {

		if( $from_version <= 2102011339 ) { // revision 78876
			// ! important ! Use DBPREFIX_<table_name> for all tables
			//checking if column exists
			//Utils::die("TEST");
			$players = self::getObjectListFromDB("SELECT * FROM player");
			if(!isset($players[0]['player_has_bomb']))
				self::applyDbUpgradeToAllDB("ALTER TABLE DBPREFIX_player ADD `player_has_bomb` INT NOT NULL DEFAULT '0'");
			if(!isset($players[0]['player_pass']))
				self::applyDbUpgradeToAllDB("ALTER TABLE DBPREFIX_player ADD `player_pass` INT NOT NULL DEFAULT '0'");
			self::applyDbUpgradeToAllDB("CREATE TABLE IF NOT EXISTS DBPREFIX_actionlog (
				`log_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
				`log_player` int(10) NOT NULL,
				`log_round` int(10) unsigned NOT NULL,
				`log_trick` int(10) unsigned NOT NULL,
				`log_action` varchar(16) NOT NULL,
				`log_arg` varchar(1024),
				PRIMARY KEY (`log_id`)
			) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=1;");
			$state = $this->gamestate->state()['name'];
			self::DbQuery("INSERT INTO actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES (0,0,0, 'newRound', '')");
			$combos = self::getCollectionFromDb("SELECT combo_player_id, combo_display FROM combo", true);
			$n = 0;
			$deck = CardManager::getDeck();
			foreach ($combos as $pId => $cardIds) {
				if(strlen($cardIds) == 0) {
					LogManager::insert($pId, 'pass');
					continue;
				}
				$cards = array_values($deck->getCards(explode(',', $cardIds)));
				$combo = new Combo($cards);
				if(is_array($combo->phoenixValue))
					$combo->setPhoenixValue(self::getUniqueValueFromDB("SELECT global_value FROM global WHERE global_id=29"));
				LogManager::playCombo($pId, $combo);
			}
			$passes = self::getUniqueValueFromDB("SELECT global_value FROM global WHERE global_id=19");
			$deck->moveAllCardsInLocation('lastcombo', 'combos');
			$deck->moveAllCardsInLocation('allcombos', 'combos');
			$playerids = self::getObjectListFromDB("SELECT player_id FROM player ORDER BY player_no", true);
			foreach ($playerids as $pId) {
				$handcards = $deck->getCardsInLocation('hand', $pId);
				$hand = new Hand($handcards);
				if($hand->hasBomb()) PlayerManager::setHasBomb($pId, 1);
			}
			switch ($state) {
				case 'grandTichuBets':
				case 'giveCards':
				case 'showPassedCards':
					LogManager::insert(0,'newRound');
					break;
				case 'phoenixPlay':
					$cards = array_values($deck->getCardsInLocation('phoenixPlay'));
					$player = $cards[0]['location_arg'];
					$combo = new Combo($cards);
					if(!is_array($combo->phoenixValue)) $combo->phoenixValue = [$combo->phoenixValue];
					LogManager::askPhoenix($player, $combo);
					$deck->moveAllCardsInLocation('phoenixPlay', 'hand', null, $player);
					break;
			}
		}
	}

	function upgradeTableDb1( $from_version ) {
		if( $from_version <= 2101032301 ) {
			// ! important ! Use DBPREFIX_<table_name> for all tables
			$players = self::getObjectListFromDB("SELECT * FROM player");
			if(!isset($players[0]['player_has_bomb']))
				self::applyDbUpgradeToAllDB("ALTER TABLE DBPREFIX_player ADD `player_has_bomb` INT NOT NULL DEFAULT '0'");
			if(!isset($players[0]['player_pass']))
				self::applyDbUpgradeToAllDB("ALTER TABLE DBPREFIX_player ADD `player_pass` INT NOT NULL DEFAULT '0'");
			self::applyDbUpgradeToAllDB("CREATE TABLE IF NOT EXISTS DBPREFIX_actionlog (
				`log_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
				`log_player` int(10) NOT NULL,
				`log_round` int(10) unsigned NOT NULL,
				`log_trick` int(10) unsigned NOT NULL,
				`log_action` varchar(16) NOT NULL,
				`log_arg` varchar(1024),
				PRIMARY KEY (`log_id`)
			) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=1;");
			$state = $this->gamestate->state()['name'];
			self::applyDbUpgradeToAllDB("INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES (0,0,0, 'newRound', '')");
			$combos = self::getCollectionFromDb("SELECT combo_player_id, combo_display FROM combo", true);
			$n = 0;
			$deck = CardManager::getDeck();
			foreach ($combos as $pId => $cardIds) {
				if(strlen($cardIds) == 0) {
					self::applyDbUpgradeToAllDB("INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ($pId,0,0, 'pass', '')");
					continue;
				}
				$cards = array_values($deck->getCards(explode(',', $cardIds)));
				$combo = new Combo($cards);
				if(is_array($combo->phoenixValue))
					$combo->setPhoenixValue(self::getUniqueValueFromDB("SELECT global_value FROM global WHERE global_id=29"));
				$cards = Utils::filterColumns($combo->cards, ["id", "type", "type_arg"]);
				$args = json_encode(['description' => $combo->description, 'type' => $combo->type, 'cards'=>$cards, 'phoenixValue'=>$combo->phoenixValue]);
				self::applyDbUpgradeToAllDB("INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ($pId,0,0, 'combo', '$args')");
			}
			self::applyDbUpgradeToAllDB("UPDATE DBPREFIX_card SET card_location='combos' WHERE card_location IN ('lastcombo', 'allcombos')");
			$playerids = self::getObjectListFromDB("SELECT player_id FROM player ORDER BY player_no");
			switch ($state) {
				case 'grandTichuBets':
				case 'giveCards':
				case 'showPassedCards':
					self::applyDbUpgradeToAllDB("INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES (0,1,0, 'newRound', '')");
					break;
				case 'phoenixPlay':
					$cards = array_values($deck->getCardsInLocation('phoenixPlay'));
					$player = $cards[0]['location_arg'];
					$combo = new Combo($cards);
					$cards = Utils::filterColumns($combo->cards, ["id", "type", "type_arg"]);
					$args = json_encode(['description' => $combo->description, 'type' => $combo->type, 'cards'=>$cards, 'phoenixValue'=>$combo->phoenixValue]);
					self::applyDbUpgradeToAllDB("INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ($player,0,0, 'phoenix', '$args')");
					$deck->moveAllCardsInLocation('phoenixPlay', 'hand', null, $player);
					self::applyDbUpgradeToAllDB("UPDATE DBPREFIX_card SET card_location='hand' WHERE card_location='phoenixPlay'");
					break;
			}
		}
	}

}
