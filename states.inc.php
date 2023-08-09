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
 * states.inc.php
 *
 * Tichu game states description
 *
 */

/*
	 Game state machine is a tool used to facilitate game developpement by doing common stuff that can be set up
	 in a very easy way from this configuration file.

	 Please check the BGA Studio presentation about game state to understand this, and associated documentation.

	 Summary:

	 States types:
	 _ activeplayer: in this type of state, we expect some action from the active player.
	 _ multipleactiveplayer: in this type of state, we expect some action from multiple players (the active players)
	 _ game: this is an intermediary state where we don't expect any actions from players. Your game logic must decide what is the next game state.
	 _ manager: special type for initial and final state

	 Arguments of game states:
	 _ name: the name of the GameState, in order you can recognize it on your own code.
	 _ description: the description of the current game state is always displayed in the action status bar on
									the top of the game. Most of the time this is useless for game state with "game" type.
	 _ descriptionmyturn: the description of the current game state when it's your turn.
	 _ type: defines the type of game states (activeplayer / multipleactiveplayer / game / manager)
	 _ action: name of the method to call when this game state become the current game state. Usually, the
						 action method is prefixed by "st" (ex: "stMyGameStateName").
	 _ possibleactions: array that specify possible player actions on this step. It allows you to use "checkAction"
											method on both client side (Javacript: this.checkAction) and server side (PHP: self::checkAction).
	 _ transitions: the transitions are the possible paths to go from a game state to another. You must name
									transitions in order to use transition names in "nextState" PHP method, and use IDs to
									specify the next game state for each transition.
	 _ args: name of the method to call to retrieve arguments for this gamestate. Arguments are sent to the
					 client side to be used on "onEnteringState" or to set arguments in the gamestate description.
	 _ updateGameProgression: when specified, the game progression is updated (=> call to your getGameProgression
														method).
*/

//		!! It is not a good idea to modify this file when a game is running !!


$machinestates = array(

		// The initial state. Please do not modify.
		ST_GAME_SETUP => array(
				"name" => "gameSetup",
				"description" => '',
				"type" => "manager",
				"action" => "stGameSetup",
				"transitions" => array( "" => ST_NEW_ROUND )
		),

		// Note: ID=2 => your first state

		ST_NEW_ROUND => array(
				"name" => "newRound",
				"description" => '',
				"type" => "game",
				"action" => "stNewRound",
				"transitions" => array( "GTBets" => ST_GRAND_TICHU_BETS )
		),

		ST_GRAND_TICHU_BETS => array(
				"name" => "grandTichuBets",
				"description" => clienttranslate('All players must choose if they want to bet a Grand Tichu'),
				"descriptionmyturn" => clienttranslate('${you} must choose if you want to bet a Grand Tichu'),
				"type" => "multipleactiveplayer",
				"possibleactions" => array( "grandTichuBet", "tichuBet" ),
				"transitions" => array( "dealLastCards" => ST_DEAL_LAST_CARDS )
		),

		ST_DEAL_LAST_CARDS => array(
				"name" => "dealLastCards",
				"description" => '',
				"type" => "game",
				"action" => "stDealLastCards",
				"transitions" => array( "giveCards" => ST_GIVE_CARDS )
		),

		ST_GIVE_CARDS => array(
				"name" => "giveCards",
				"description" => clienttranslate('All players must give a card to each other player'),
				"descriptionmyturn" => clienttranslate('${you} must give a card to each other player'),
				"action" => 'stGiveCards',
				"type" => "multipleactiveplayer",
				"possibleactions" => array( "giveCards" ),
				"transitions" => array( "showPassedCards" => ST_SHOW_PASSED_CARDS )
		),

		ST_SHOW_PASSED_CARDS => array(
				"name" => "showPassedCards",
				"description" => clienttranslate('Waiting for other players to accept cards'),
				"descriptionmyturn" => clienttranslate('${you} must accept cards'),
				"action" => 'stShowPassedCards',
				"type" => "multipleactiveplayer",
				"args" => "argShowPassedCards",
				"possibleactions" => array( "acceptCards" ),
				"transitions" => array( "acceptCards" => ST_NEW_TRICK )
		),

		ST_NEW_TRICK => array(
				"name" => "newTrick",
				"description" => '',
				"type" => "game",
				"action" => "stNewTrick",
				"updateGameProgression" => true,
				"transitions" => array( "firstCombo" => ST_PLAY_COMBO_OPEN )
		),

		ST_PLAY_COMBO_OPEN => array(
				"name" => "playComboOpen",
				"description" => clienttranslate('${actplayer} must play an opening card combination'),
				"descriptionmyturn" => clienttranslate('${you} must play an opening card combination'),
				"type" => "activeplayer",
				"args" => "argPlayComboOpen",
				"possibleactions" => array( "playCombo", "tichuBet" ),
				"transitions" => array(
						"phoenixPlay" => ST_PHOENIX_PLAY,
						"nextPlayer" => ST_NEXT_PLAYER,
						"mahjongPlayed" => ST_MAHJONG_PLAY,
						"zombiePass" => ST_NEXT_PLAYER
				)
		),

		ST_PLAY_COMBO => array(
				"name" => "playCombo",
				"description" => clienttranslate('${actplayer} must play a card combination, or pass'),
				"descriptionmyturn" => clienttranslate('${you} must play a card combination, or pass'),
				"type" => "activeplayer",
				"possibleactions" => array( "playCombo",	"tichuBet", "pass" ),
				"transitions" => array(
						"phoenixPlay"=>ST_PHOENIX_PLAY,
						"nextPlayer" => ST_NEXT_PLAYER,
						"changePlayer"=>ST_CHANGE_PLAYER,
						"mahjongPlayed" => ST_MAHJONG_PLAY,
						"zombiePass" => ST_NEXT_PLAYER
				)
		),

		ST_PLAY_BOMB => array(
				"name" => "playBomb",
				"description" => clienttranslate('${actplayer} wants to play a bomb.'),
				"descriptionmyturn" => clienttranslate('${you} must play a play a bomb.'),
				"type" => "activeplayer",
				"args" => "argPlayBomb",
				"possibleactions" => array( "playCombo",	"tichuBet", "pass" ),
				"transitions" => array(
						"changePlayer" => ST_CHANGE_PLAYER,
						"nextPlayer" => ST_NEXT_PLAYER,
						"zombiePass" => ST_CHANGE_PLAYER
				)
		),

		ST_PHOENIX_PLAY => array(
				"name" => "phoenixPlay",
                "description" => clienttranslate('${actplayer} must play a card combination, or pass'),
				"descriptionmyturn" => clienttranslate('${you} must choose a value for the phoenix'),
				"type" => "activeplayer",
				"args" => "argsPhoenixPlay",
				"possibleactions" => array( "phoenixPlay" ),
				"transitions" => array(
						"nextPlayer" => ST_NEXT_PLAYER,
						"playCombo" => ST_PLAY_COMBO,
						"cancel" => ST_PLAY_COMBO_OPEN,
						"mahjongPlayed" => ST_MAHJONG_PLAY
					)
		),

		ST_MAHJONG_PLAY => array(
				"name" => "mahjongPlay",
				"description" => clienttranslate('${actplayer} makes a wish'),
				"descriptionmyturn" => clienttranslate('${you} make a wish'),
				"type" => "activeplayer",
				"possibleactions" => array( "makeAWish" ),
				"transitions" => array(
						"nextPlayer" => ST_NEXT_PLAYER,
						"zombiePass" => ST_NEXT_PLAYER
				)
		),

		ST_NEXT_PLAYER => array(
				"name" => "nextPlayer",
				"description" => '',
				"type" => "game",
				"action" => "stNextPlayer",
				"transitions" => array(
						"nextPlayer" => ST_PLAY_COMBO,
						"chooseDragonGift" => ST_CHOOSE_DRAGON_GIFT,
						"newTrick" => ST_NEW_TRICK,
						"endRound" => ST_END_ROUND,
						"playComboOpen" => ST_PLAY_COMBO_OPEN,
						"confirmTrick" => ST_CONFIRM_TRICK
				)
		),

		ST_CONFIRM_TRICK => array(
			"name" => "confirmTrick",
			"description" => clienttranslate('${actplayer} must collect the trick. Bombs can still be played'),
			"descriptionmyturn" => clienttranslate('${you} must collect the trick. Bombs can still be played'),
			"type" => "activeplayer",
			"possibleactions" => array( "collect" ),
			"transitions" => array(
				"newTrick" => ST_NEW_TRICK,
				"chooseDragonGift" => ST_CHOOSE_DRAGON_GIFT,
				"changePlayer"=>ST_CHANGE_PLAYER,
				"zombiePass" => ST_NEW_TRICK
			)
		),

		ST_CHOOSE_DRAGON_GIFT => array(
				"name" => "chooseDragonGift",
				"description" => clienttranslate('${actplayer} must choose who to give the Dragon trick'),
				"descriptionmyturn" => clienttranslate('${you} must choose who to give the Dragon trick'),
				"type" => "activeplayer",
				"args" => "argChooseDragonGift",
				"possibleactions" => array( "chooseDragonGift" ),
				"transitions" => array(
						"newTrick" => ST_NEW_TRICK,
						"zombiePass" => ST_NEW_TRICK,
						"endRound" => ST_END_ROUND
				)
		),

		ST_CHANGE_PLAYER => array(
				"name" => "changePlayer",
				"description" => '',
				"type" => "game",
				"action" => "stChangePlayer",
				"transitions" => array(
						"playCombo" => ST_PLAY_COMBO,
						"playBomb" => ST_PLAY_BOMB,
						"confirmTrick" => ST_CONFIRM_TRICK
				)
		),

		ST_END_ROUND => array(
				"name" => "endRound",
				"description" => '',
				"type" => "game",
				"action" => "stEndRound",
				"transitions" => array(
						"endGame" => ST_GAME_END,
						"newRound" => ST_NEW_ROUND,
				)
		),


		// Final state.
		// Please do not modify.
		ST_GAME_END => array(
				"name" => "gameEnd",
				"description" => clienttranslate("End of game"),
				"type" => "manager",
				"action" => "stGameEnd",
				"args" => "argGameEnd"
		)

);