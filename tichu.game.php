﻿<?php
require_once APP_GAMEMODULE_PATH . "module/table/table.game.php";

class Tichu extends Table
{
  public static $instance;
  function __construct()
  {
    parent::__construct();
    $this->bSelectGlobalsForUpdate = true;
    self::$instance = $this;
    Combo::$noCombo = new Combo([], NO_COMBO);

    $this->initGameStateLabels([
      // globals
      "firstOutPlayer" => 21, // first player getting rid of his cards
      "secondOutPlayer" => 22, // second player getting rid of his cards
      "doubleVictory" => 23, // team scoring a double victory
      "mahjongWish" => 26, // value wished by Mahjong Owner
      "mahjongOwner" => 27, // Mahjong Owner, 0 when wish is granted
      "isAllInfoExposed" => 28, // Should the played card be shown and players smartly skipped? 0=FALSE, 1=TRUE

      //options
      "gameLength" => 100, // 1 = 500pts, 2 = 1000pts, 3 = 2000pts
      "playerTeams" => 101, // 1 = 13 vs 24, 2 = 12 vs 34, 3 = 14 vs 23, 4 = random
      "gameVariant" => 102, // 1 = tichu standard
    ]);
  }

  // Used for translations and stuff. Please do not modify.
  protected function getGameName()
  {
    return "tichu";
  }

  /*
			setupNewGame:

			This method is called only once, when a new game is launched.
			In this method, you must setup the game according to the game rules, so that
			the game is ready to be played.
	*/
  protected function setupNewGame($players, $options = [])
  {
    $sql = "DELETE FROM player WHERE 1 ";
    $this->DbQuery($sql);

    PlayerManager::setupPlayers($players);
    $this->reloadPlayersBasicInfos();
    CardManager::setupCards();

    // Init globals
    $this->setGameStateInitialValue("firstOutPlayer", 0);
    $this->setGameStateInitialValue("secondOutPlayer", 0);
    $this->setGameStateInitialValue("doubleVictory", -1);
    $this->setGameStateInitialValue("mahjongWish", 0);
    $this->setGameStateInitialValue("mahjongOwner", 0);
    $this->setGameStateInitialValue("isAllInfoExposed", $this->isAsync() ? 1 : 0);

    // Init statistics
    $this->initStat("table", "round_number", 0);
    $this->initStat("table", "trick_number", 0);
    $this->initStat("player", "tricks_win", 0);
    $this->initStat("player", "bomb_number", 0);
    $this->initStat("player", "tichu_number", 0);
    $this->initStat("player", "grandtichu_number", 0);
    $this->initStat("player", "tichu_won_number", 0);
    $this->initStat("player", "grandtichu_won_number", 0);
    $this->initStat("player", "bombs_completed_by_partner", 0);

    $this->activeNextPlayer();
  }

  /**
   * Returns true, if the game is turn based now and was also turn based when the game was
   * started.
   */
  public function isAllInfoExposed()
  {
    // In the future we can just return the "isAllInfoExposed" game state. We are only setting
    // a default value for migrating in-progress games correctly.
    return $this->getGameStateValue("isAllInfoExposed", $this->isAsync() ? 1 : 0) == 1;
  }

  /*
			getAllDatas:

			Gather all informations about current game situation (visible by the current player).

			The method is called each time the game interface is displayed to a player, ie:
			_ when the game starts
			_ when a player refreshes the game page (F5)
	*/
  protected function getAllDatas()
  {
    $deck = CardManager::getDeck();
    $players = PlayerManager::getPlayers();
    $current_player_id = $this->getCurrentPlayerId(); // !! We must only return informations visible by this player !!
    $names = [];
    $result = [];
    foreach ($players as $player) {
      $names[$player["no"]] = $player["name"];
    }
    foreach ($players as &$player) {
      if ($player["id"] != $current_player_id) {
        // hide secret fields
        unset($player["pass"]);
      }
    }
    unset($player);

    $result["players"] = Utils::parseInt($players, ["id", "no"]);

    $result["hand"] = array_values($deck->getCardsInLocation("hand", $current_player_id));
    $result["handcount"] = $deck->countCardsByLocationArgs("hand");
    $result["capturedpoints"] = CardManager::calculateCapturedPoints();
    $result["firstoutplayer"] = intval($this->getGameStateValue("firstOutPlayer"));
    $result["mahjongOwner"] = intval($this->getGameStateValue("mahjongOwner"));
    $result["mahjongWish"] = intval($this->getGameStateValue("mahjongWish"));
    $result["isAllInfoExposed"] = intval($this->isAllInfoExposed());

    $lastCombo = LogManager::getLastCombo();
    $result["lastComboPlayer"] = $lastCombo->player;
    $result["lastComboDescription"] = $lastCombo->description;

    list($lastCombos, $passes) = LogManager::getLastCombos($current_player_id);
    $result["allLastCombos"] = $lastCombos;
    $result["passes"] = $passes;

    $result["capturedCards"] = array_values($deck->getCardsInLocation("captured"));

    $currentTrick = array_values($deck->getCardsInLocation("combos"));
    $result["currentTrick"] = $currentTrick;
    $result["currentTrickValue"] = CardManager::getTrickValue($currentTrick);

    $roundAndTrick = LogManager::getCurrentRoundAndTrick();
    $result["round"] = $roundAndTrick["round"];
    $result["trick"] = $roundAndTrick["trick"];

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
  function getGameProgression()
  {
    $p = [5, 10, 20][$this->getGameStateValue("gameLength") - 1];
    return round(min(100, PlayerManager::getHighestScore() / $p));
  }

  public static function getCurrentId()
  {
    return self::$instance->getCurrentPlayerId();
  }

  function completePlayCombo($playerId, $combo)
  {
    $player = PlayerManager::getPlayer($playerId);
    $mahjongOwner = $this->getGameStateValue("mahjongOwner");
    $wish = $this->getGameStateValue("mahjongWish");
    $cards = $combo->cards;
    $cardIds = array_column($combo->cards, "id");
    $deck = CardManager::getDeck();
    $cardsInHand = $deck->getCardsInLocation("hand", $playerId);
    $currentHand = new Hand($cardsInHand);
    $remainingCards = array_values(
      array_filter($cardsInHand, function ($card) use ($cardIds) {
        return !in_array($card["id"], $cardIds);
      })
    );
    $remainingHand = new Hand($remainingCards);
    $lastCombo = LogManager::getLastCombo(1);
    if ($lastCombo->type == NO_COMBO) {
      PlayerManager::setAutopass(0);
    }

    if ($combo->type == DOG_COMBO && $lastCombo->type != NO_COMBO) {
      throw new feException($this->_("the Dog can only be played as a lead"), true);
    }
    if (!$combo->canBeat($lastCombo)) {
      throw new feException($this->_("This combo can't beat the last combo"), true);
    }

    $notification_description = clienttranslate('${player_name} plays ${combo_name}');
    if ($wish != 0) {
      if (in_array($wish, array_column($cards, "type_arg"))) {
        $notification_description = clienttranslate(
          '${player_name} plays ${combo_name} and grants Mahjong\'s owner wish'
        );
        $this->setGameStateValue("mahjongWish", 0);
        NotificationManager::mahjongGranted();
      } else {
        if ($combo->type != BOMB_COMBO && $currentHand->canFulFillWish($wish, $lastCombo)) {
          throw new feException(
            sprintf(
              $this->_("You must grant the Mahjong Wish and play a %s"),
              CardManager::cardToStr($wish)
            ),
            true
          );
        }
      }
    }

    if (count($cardsInHand) == 14 && $player["call_tichu"] == -1) {
      PlayerManager::tichuBet($playerId, 0);
      NotificationManager::tichuBet($playerId, $this->getCurrentPlayerName(), 0);
    }

    NotificationManager::playCombo(
      $playerId,
      $this->getCurrentPlayerName(),
      $combo,
      $notification_description
    );
    $deck->moveCards($cardIds, "combos");

    if ($combo->type == BOMB_COMBO) {
      $this->incStat(1, "bomb_number", $playerId);
    }

    if ($combo->hasMahjong()) {
      $this->gamestate->nextState("mahjongPlayed");
    } else {
      $this->gamestate->nextState("nextPlayer");
    }
  }

  function chooseDragonGift($playertogive)
  {
    $this->checkAction("chooseDragonGift");
    $players = PlayerManager::getPlayers();
    $trickWinner = LogManager::getLastComboPlayer();
    $nextPlayers = PlayerManager::getNextPlayers($trickWinner);
    $dragonGivenToId = $nextPlayers[$playertogive * 2]["id"];

    $this->incStat(1, "tricks_win", $trickWinner);
    $deck = CardManager::getDeck();

    $cardsCaptured = $deck->getCardsInLocation("combos");
    $trickValue = CardManager::getTrickValue($cardsCaptured);

    $deck->moveAllCardsInLocation("combos", "captured", null, $dragonGivenToId);

    NotificationManager::log('${player_name} wins the trick', [
      "player_name" => $players[$trickWinner]["name"],
    ]);
    NotificationManager::captureCards(
      $dragonGivenToId,
      $players[$dragonGivenToId]["name"],
      $trickValue
    );

    $inPlay = array_keys($deck->countCardsByLocationArgs("hand"));
    $doubleVic =
      count($inPlay) == 2 && $players[$inPlay[0]]["team"] == $players[$inPlay[1]]["team"];
    if ($doubleVic) {
      $this->setGameStateValue("doubleVictory", 1 - $players[$inPlay[0]]["team"]);
    }
    if (count($inPlay) == 1 || $doubleVic) {
      $this->gamestate->nextState("endRound");
    } else {
      $action = LogManager::getLastAction("confirm")["arg"];
      $this->gamestate->nextState("newTrick");
    }
  }

  function checkCardsInHand($cards, $player_id)
  {
    foreach ($cards as $card) {
      if ($card["location"] != "hand" || $card["location_arg"] != $player_id) {
        throw new feException($this->_("Some of these cards are not in your hand"));
      }
    }
  }

  function giveTheCards($card_ids)
  {
    $this->checkAction("giveCards");

    $player_id = $this->getCurrentPlayerId();

    if (count($card_ids) != 3) {
      throw new feException($this->_("You must give exactly 3 cards"));
    }

    $cards = CardManager::getDeck()->getCards($card_ids);
    if (count($cards) != 3) {
      throw new feException($this->_("Some of these cards don't exist"));
    }
    $this->checkCardsInHand($cards, $player_id);

    $player_to_give_cards = null;
    $nextPlayers = PlayerManager::getNextPlayers(null, true);
    CardManager::setPassedCards($card_ids, $player_id);
    foreach ($card_ids as $idx => $cardId) {
      CardManager::getDeck()->moveCard($cardId, "temporary", $nextPlayers[$idx]["id"]);
    }
    NotificationManager::passCards($player_id, $card_ids);

    // legacy: $this->gamestate->setPlayerNonMultiactive($player_id, "showPassedCards");
    $this->gamestate->setPlayerNonMultiactive($player_id, "acceptPassedCards");
  }

  function playBomb($cards_ids)
  {
    $name = $this->gamestate->state()["name"];
    if ($name != "playCombo" && $name != "confirmTrick") {
      throw new feException($this->_("You can't play a bomb right now"), true);
    }

    $playerId = $this->getCurrentPlayerId();
    $lastCombo = LogManager::getLastCombo();
    if ($lastCombo == null && $playerId != $this->getActivePlayerId()) {
      throw new feException($this->_('You can\'t bomb before the trick starts'), true);
    }

    if (
      $lastCombo != null &&
      $lastCombo->type == DOG_COMBO &&
      $playerId != $this->getActivePlayerId()
    ) {
      throw new feException($this->_('You can\'t bomb the dog'), true);
    }

    LogManager::insert($this->getCurrentPlayerId(), "changePlayer", [
      "transition" => "playBomb",
      "active" => $this->getActivePlayerId(),
      "last" => $name,
    ]);
    $this->gamestate->nextState("changePlayer");
  }

  function choosePhoenix($phoenixValue)
  {
    $this->checkAction("phoenixPlay");
    $pId = $this->getActivePlayerId();
    $combo = LogManager::getLastCombo(0, "phoenix");
    if (!in_array($phoenixValue, $combo->phoenixValue)) {
      throw new feException(
        $this->_("You have chosen an invalid value for the phoenix, choose a new hand"),
        true
      );
    }
    $combo->setPhoenixValue($phoenixValue);
    LogManager::playCombo($pId, $combo);
    $this->completePlayCombo($pId, $combo);
  }

  function playCombo($cards_ids)
  {
    $this->checkAction("playCombo");
    $playerId = $this->getCurrentPlayerId();
    $cards = array_values(CardManager::getDeck()->getCards($cards_ids));
    $this->checkCardsInHand($cards, $playerId);

    $combo = new Combo($cards);
    if ($combo->type == INVALID_COMBO) {
      throw new feException($this->_("You must play a valid combo"), true);
    }
    if ($this->gamestate->state()["name"] == "playBomb" && $combo->type != BOMB_COMBO) {
      throw new feException($this->_("This is not a valid bomb"), true);
    }
    if (is_array($combo->phoenixValue)) {
      $combo->recheckPhoenix();
    }

    if (is_array($combo->phoenixValue)) {
      LogManager::askPhoenix($playerId, $combo);
      $this->gamestate->nextState("phoenixPlay");
    } else {
      LogManager::playCombo($playerId, $combo);
      $this->completePlayCombo($playerId, $combo);
    }
  }

  function pass($onlyOnce)
  {
    if ($this->gamestate->state()["name"] != "playCombo") {
      throw new feException($this->_("You can't pass right now"), true);
    }

    $player_id = $this->getCurrentPlayerId();
    if ($player_id != $this->getActivePlayerId()) {
      PlayerManager::setAutopass($onlyOnce ? 1 : 2, $player_id);
      NotificationManager::autopass($onlyOnce ? 1 : 2, $player_id);
      return;
    }

    $currentMahjongWish = $this->getGameStateValue("mahjongWish");
    if ($currentMahjongWish > 0) {
      $cardsInHand = CardManager::getDeck()->getPlayerHand($player_id);
      $hand = new Hand($cardsInHand, $this);
      if ($hand->canFulfillWish($currentMahjongWish, LogManager::getLastCombo())) {
        throw new feException(
          sprintf(
            $this->_("You must grant the Mahjong Wish and play a %s "),
            CardManager::cardToStr($currentMahjongWish)
          ),
          true
        );
      }
    }

    LogManager::insert($player_id, "pass");
    NotificationManager::pass($player_id, $this->getActivePlayerName());
    if (!$onlyOnce) {
      PlayerManager::setAutopass(2, $player_id);
      NotificationManager::autopass(2, $player_id);
    }
    $this->gamestate->nextState("nextPlayer");
  }

  function cancelAutopass()
  {
    PlayerManager::setAutopass(0, $this->getCurrentPlayerId());
    NotificationManager::autopass(0, $this->getCurrentPlayerId());
  }

  function cancel()
  {
    $action = LogManager::getLastAction("changePlayer");
    LogManager::insert($action["arg"]["active"], "changePlayer", [
      "transition" => $action["arg"]["last"],
    ]);
    $this->gamestate->nextState("changePlayer");
  }

  function grandTichuBet($bet, $confirmed = false)
  {
    $this->checkAction("grandTichuBet");
    $player_id = $this->getCurrentPlayerId();
    $player = PlayerManager::getPlayer($player_id);
    if ($player["call_tichu"] != -1) {
      return;
    }
    $handcount = CardManager::getDeck()->countCardInLocation("hand", $player_id);
    if ($handcount != 8) {
      throw new feException("Can't make grand tichu bet: you don\'t have 8 cards");
    }
    if ($player["call_grand_tichu"] >= 0) {
      throw new feException("Can't make bet: you already bet");
    }

    $lastTichuCall = LogManager::getLastAction("tichuCall");
    $now = time();
    if ($bet == 200) {
      if (
        !$confirmed &&
        $lastTichuCall != null &&
        $now - intval($lastTichuCall["arg"]) < TICHU_CONFIRMATION_TRESHOLD
      ) {
        NotificationManager::confirmTichu($player_id, true);
        return;
      }
      LogManager::insert($player_id, "tichuCall", $now);
      $this->incStat(1, "grandtichu_number", $player_id);
    }
    PlayerManager::grandTichuBet($player_id, $bet);
    NotificationManager::grandTichuBet($player_id, $player["name"], $bet);
    $this->gamestate->setPlayerNonMultiactive($player_id, "dealLastCards");
  }

  function tichuBet($confirmed = false)
  {
    $player_id = $this->getCurrentPlayerId();
    $player = PlayerManager::getPlayer($player_id);
    if ($player["call_grand_tichu"] == 200) {
      throw new feException("You already made a grand tichu bet.");
    }
    $state = $this->gamestate->state();
    $lastTichuCall = LogManager::getLastAction("tichuCall");
    $now = time();
    if (
      !$confirmed &&
      $lastTichuCall != null &&
      $now - intval($lastTichuCall["arg"]) < TICHU_CONFIRMATION_TRESHOLD
    ) {
      NotificationManager::confirmTichu($player_id, false);
      return;
    }
    if (!$confirmed && $this->getGameStateValue("firstOutPlayer") != 0) {
      NotificationManager::confirmTichu(
        $player_id,
        false,
        "You can't win this tichu bet anymore. Are you sure?"
      );
      return;
    }
    LogManager::insert($player_id, "tichuCall", $now);
    $this->incStat(1, "tichu_number", $player_id);
    PlayerManager::tichuBet($player_id, 100);
    NotificationManager::tichuBet($player_id, $this->getCurrentPlayerName(), 100);
    if ($state["name"] == "grandTichuBets") {
      $this->gamestate->setPlayerNonMultiactive($player_id, "dealLastCards");
    }
  }

  function confirmTichu($bet)
  {
    if ($bet == 200) {
      $this->grandTichuBet(200, true);
    } else {
      $this->tichuBet(true);
    }
  }

  function detectBombPassing($player_id)
  {
    $cardPassedFromPartner = CardManager::getCardsPassedTo($player_id)[1];

    // You cannot complete a bomb by passing a special card.
    if ($cardPassedFromPartner["type_arg"] == 1) {
      return;
    }
    // Passing a King or Ace is quite natural. If that happens to complete a
    // bomb, then this is probably just lucky and not suspicious.
    if ($cardPassedFromPartner["type_arg"] > 12) {
      return;
    }

    // The new passed cards are still in "temporary" location.
    $beforeCards = CardManager::getCardsInLocation("hand", $player_id);
    $beforeHasBomb = (new Hand($beforeCards))->hasBomb();

    // The player already had a bomb, so don't bother to check, if they got
    // another one completed.
    if ($beforeHasBomb) {
      return;
    }

    $afterCards = array_merge($beforeCards, [$cardPassedFromPartner]);
    $afterHasBomb = (new Hand($afterCards))->hasBomb();

    // No bomb, even after passing, so no cheating.
    if (!$afterHasBomb) {
      return;
    }

    // Now, let's check the hand of the partner. Did the passed card have the highest rank?
    // Or at least the highest rank of all singles? Then the pass is quite natural.
    $partner = PlayerManager::getPartner($player_id);
    $partnerCards = CardManager::getCardsInLocation("hand", $partner["id"]);
    // The partner may already have accepted passed cards *to* him, so we have to filter those.
    $partnerCardsNotPassed = array_filter($partnerCards, function ($card) {
      return $card["passed_from"] == null;
    });
    // Let's add the passed card *from* partner back to the partner hand.
    $partnerCardsRelevant = array_merge($partnerCardsNotPassed, [$cardPassedFromPartner]);
    $partnerHand = new Hand($partnerCardsRelevant);
    $partnerTopSingleRank = $partnerHand->getTopSingleRank();
    if ($cardPassedFromPartner["type_arg"] == $partnerTopSingleRank) {
      return;
    }
    $partnerTopRank = $partnerHand->getTopRank();
    if ($cardPassedFromPartner["type_arg"] == $partnerTopRank) {
      return;
    }

    // The pass was not natural and completed a bomb. Count it!
    $this->incStat(1, "bombs_completed_by_partner", $player_id);
  }

  /**
   * This auto accepts cards for all players in the new "acceptPassedCards" state.
   * The transition "allCardsAccepted" immediately proceeds to a "new trick".
   */
  function acceptCardsForAllPlayers()
  {
    $players = PlayerManager::getPlayerIds();
    foreach ($players as $player_id) {
      $this->acceptCardsForPlayer($player_id);
    }

    $this->gamestate->nextState("allCardsAccepted");
  }

  /**
   * This is called by a player action in the legacy "showPassedCards" state.
   */
  function acceptCards()
  {
    $player_id = $this->getCurrentPlayerId();
    $this->acceptCardsForPlayer($player_id);
    $this->gamestate->setPlayerNonMultiactive($player_id, "acceptCards");
  }

  /**
   * This is used by both (new and legacy) states for accepting passed cards into
   * players' hands.
   */
  function acceptCardsForPlayer($player_id)
  {
    $this->detectBombPassing($player_id);

    NotificationManager::acceptCards($player_id);

    $deck = CardManager::getDeck();
    $deck->moveAllCardsInLocation("temporary", "hand", $player_id, $player_id);
  }

  function makeAWish($wish)
  {
    $this->checkAction("makeAWish");

    if ($wish == 15) {
      $msg = clienttranslate('${player_name} owns the Mahjong and has no wish');
      $textValue = "0";
    } else {
      $this->setGameStateValue("mahjongWish", $wish);
      $textValue = $this->values_label[$wish];
      $msg = clienttranslate('${player_name} owns the Mahjong and wants a ${text_value}');
    }
    NotificationManager::wishMade(
      $this->getActivePlayerId(),
      $this->getActivePlayerName(),
      $wish,
      $textValue,
      $msg
    );
    $this->gamestate->nextState("nextPlayer");
  }

  function collect()
  {
    $this->checkAction("collect");
    $action = LogManager::getLastAction("confirm");
    $pId = $action["player"];
    $action = $action["arg"];
    if ($action["dragon"]) {
      $this->gamestate->nextState("chooseDragonGift");
    } else {
      $deck = CardManager::getDeck();
      $trickValue = CardManager::getTrickValue($deck->getCardsInLocation("combos"));
      $deck->moveAllCardsInLocation("combos", "captured", null, $pId);
      NotificationManager::captureCards($pId, $this->getCurrentPlayerName(), $trickValue);
      $this->gamestate->nextState("newTrick");
    }
  }

  function cancelPhoenix()
  {
    $last = LogManager::getLastCombo();
    if ($last->type == NO_COMBO) {
      $this->gamestate->nextState("cancel");
    } else {
      $this->gamestate->nextState("playCombo");
    }
  }

  // arg for legacy state
  function argShowPassedCards()
  {
    return [
      "_private" => ($result["passedCards"] = CardManager::getPassedCards()),
    ];
  }

  // arg for new state
  function argAcceptPassedCards()
  {
    return [
      "_private" => ($result["passedCards"] = CardManager::getPassedCards()),
    ];
  }

  function argsPhoenixPlay()
  {
    $vals = LogManager::getLastCombo(0, "phoenix")->phoenixValue;
    return [
      "_private" => [
        "active" => [
          "values" => array_map("intval", $vals),
        ],
      ],
    ];
  }

  function argChooseDragonGift()
  {
    $lastComboPlayer = LogManager::getLastComboPlayer();
    $nextPlayers = array_column(PlayerManager::getNextPlayers($lastComboPlayer), "name");
    return ["enemies" => [$nextPlayers[0], $nextPlayers[2]]];
  }

  function argPlayComboOpen()
  {
    return LogManager::getCurrentRoundAndTrick();
  }

  function argPlayBomb()
  {
    return LogManager::getLastAction("changePlayer")["arg"];
  }

  function stNewRound()
  {
    LogManager::insert(0, "newRound");
    $this->setGameStateValue("firstOutPlayer", 0);
    $this->setGameStateValue("secondOutPlayer", 0);
    $this->setGameStateValue("doubleVictory", -1);
    $this->setGameStateValue("mahjongWish", 0);
    $this->setGameStateValue("mahjongOwner", 0);

    $this->incStat(1, "round_number");

    CardManager::resetPassedCards();
    $deck = CardManager::getDeck();
    $deck->shuffle("deck");

    $players = PlayerManager::getPlayerIds();
    PlayerManager::resetTichus();
    foreach ($players as $player_id) {
      $cards = $deck->pickCards(8, "deck", $player_id);
      NotificationManager::dealCards(
        $player_id,
        $cards,
        "A new round starts. The 8 first cards are dealt"
      );
    }

    $this->gamestate->setAllPlayersMultiactive();
    $this->gamestate->nextState("GTBets");
  }

  function stDealLastCards()
  {
    $players = PlayerManager::getPlayerIds();
    foreach ($players as $player_id) {
      $cards = CardManager::getDeck()->pickCards(6, "deck", $player_id);
      NotificationManager::dealCards($player_id, $cards, "The last 6 cards are dealt");
    }
    $this->gamestate->nextState("giveCards");
  }

  function stGiveCards()
  {
    $this->gamestate->setAllPlayersMultiactive();
  }

  // legacy state that requires all players to accept cards as an action
  function stShowPassedCards()
  {
    $this->gamestate->setAllPlayersMultiactive();
  }

  // new state that accepts cards automatically for all players
  function stAcceptPassedCards()
  {
    $this->acceptCardsForAllPlayers();
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
  function stNewTrick()
  {
    $this->incStat(1, "trick_number");
    $lastWinner = LogManager::getLastComboPlayer();
    LogManager::insert(0, "newTrick");
    PlayerManager::setAutopass(0);
    NotificationManager::autopass(0);

    $deck = CardManager::getDeck();

    if ($lastWinner == 0) {
      $card = array_values($deck->getCardsOfType(TYPE_MAHJONG, 1))[0];
      $mahjongOwnerId = $card["location_arg"];
      $this->setGameStateValue("mahjongOwner", $mahjongOwnerId);
      $this->gamestate->changeActivePlayer($mahjongOwnerId);
      $this->giveExtraTime($mahjongOwnerId);
      $notify = 'A new round starts. ${player_name} has the Mahjong';
    } else {
      //this is not the first trick
      $hand_count = $deck->countCardsByLocationArgs("hand");

      if (isset($hand_count[$lastWinner])) {
        //winner of last trick is still in play
        $this->gamestate->changeActivePlayer($lastWinner);
        $this->giveExtraTime($lastWinner);

        $notify = '${player_name} has won the previous trick and starts a new one.';
      } else {
        //winner of last trick has no more cards. We check the next 2 players
        $nextPlayers = PlayerManager::getNextPlayers($lastWinner);
        while (!isset($hand_count[$nextPlayers[0]["id"]])) {
          array_shift($nextPlayers);
        }
        $nextPlayerId = $nextPlayers[0]["id"];
        $this->gamestate->changeActivePlayer($nextPlayerId);
        $this->giveExtraTime($nextPlayerId);
        $notify = '${player_name} is the next player and starts a new trick.';
      }
    }
    NotificationManager::log($notify, [
      "player_name" => $this->getActivePlayerName(),
    ]);

    $this->gamestate->nextState("firstCombo");
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
  function stNextPlayer()
  {
    $lastCombo = LogManager::getLastCombo();
    $lastComboPlayer = $lastCombo->player;
    // get last player who played or passed
    if ($lastCombo->type == BOMB_COMBO) {
      $player_id = LogManager::getLastActions(["combo", "pass"])[0]["player"];
      $this->gamestate->changeActivePlayer($player_id);
    } else {
      $player_id = $this->getActivePlayerId();
    }
    $players = PlayerManager::getPlayers();
    $doubleVictory = null;
    $deck = CardManager::getDeck();
    if ($deck->countCardInLocation("hand", $player_id) == 0) {
      // This player gets out of the trick
      $firstOutPlayer = $this->getGameStateValue("firstOutPlayer");
      if ($firstOutPlayer == 0) {
        // If he is the first, record it
        $this->setGameStateValue("firstOutPlayer", $player_id);
        $firstOutPlayer = $player_id;
      } elseif ($this->getGameStateValue("secondOutPlayer") == 0) {
        // If he is the second, record it
        $this->setGameStateValue("secondOutPlayer", $player_id);
        $secondOutPlayerTeam = $players[$player_id]["team"];
        if ($players[$firstOutPlayer]["team"] == $secondOutPlayerTeam) {
          $this->setGameStateValue("doubleVictory", $secondOutPlayerTeam);
          $this->gamestate->nextState("endRound");
          return;
        }
      }
      NotificationManager::playerGoOut($player_id, $this->getActivePlayerName(), $firstOutPlayer);
    }

    // get number of players still in round
    $player_still_in_round = CardManager::numPlayersStillInRound();

    $next_players = PlayerManager::getNextPlayers($player_id); //next players (including those without cards)
    $handCounts = $handCounts ?? CardManager::getDeck()->countCardsByLocationArgs("hand");
    $next = null;
    if ($lastCombo->type == DOG_COMBO && $player_still_in_round > 1) {
      // Dog transfers right to deal to partner so next player is skipped
      $next_players[] = array_shift($next_players);
      foreach ($next_players as $player) {
        if (isset($handCounts[$player["id"]])) {
          $next = $player["id"];
          break;
        }
      }
      $this->gamestate->changeActivePlayer($next);
      $this->giveExtraTime($next);
      $this->gamestate->nextState("playComboOpen");
      return;
    }

    // Can the total remaining cards beat the last combo? If not, then
    // skip all players in "isAllInfoExposed" mode.
    $impossibleToBeat = false;
    if ($this->isAllInfoExposed()) {
      $remainingCards = $deck->getCardsInLocation("hand");
      $handRemainingCards = new Hand($remainingCards);
      $beatingCombo = $handRemainingCards->findBeatingCombo($lastCombo);
      $impossibleToBeat = is_null($beatingCombo);
      NotificationManager::devConsole(
        "Remaining " .
          count($remainingCards) .
          " cards can beat combo '" .
          $lastCombo->description .
          "'? " .
          ($impossibleToBeat ? "NO" : $beatingCombo->description)
      );
    }

    // search for next Player with enough cards, but don't go beyond the player who played the last combo
    $amount = min(count($lastCombo->cards), 4);
    if ($lastCombo->hasDragon()) {
      $amount = 4;
    }
    $wish = $this->getGameStateValue("mahjongWish");
    foreach ($next_players as $player) {
      $pId = $player["id"];
      if ($lastComboPlayer == $pId) {
        $next = $pId;
        break;
      }
      if (!isset($handCounts[$pId])) {
        continue;
      }
      $autoPass = $player["pass"] > 0 && CardManager::canPass($pId, $wish, $lastCombo);
      $cantBeat = $handCounts[$pId] < $amount || ($this->isAllInfoExposed() && $impossibleToBeat);
      if ($autoPass || $cantBeat) {
        $autoPassOnlyOnce = $player["pass"] == 1;
        if ($autoPassOnlyOnce) {
          PlayerManager::setAutopass(0, $pId);
          NotificationManager::autopass(0, $pId);
        }
        LogManager::insert($pId, "pass");
        NotificationManager::pass($pId, $player["name"]);
        continue;
      }
      $next = $pId;
      break;
    }
    if ($player_still_in_round == 1 || $lastComboPlayer == $next) {
      // trick is complete(either because the 3rd player finished or all players passed)
      $dragon = $lastCombo->hasDragon();
      if ($player_still_in_round == 1) {
        $this->incStat(1, "tricks_win", $lastComboPlayer);
        if ($dragon) {
          $this->gamestate->changeActivePlayer($lastComboPlayer);
          $this->giveExtraTime($lastComboPlayer);
          $this->gamestate->nextState("chooseDragonGift");
        } else {
          $trickValue = CardManager::getTrickValue($deck->getCardsInLocation("combos"));
          $deck->moveAllCardsInLocation("combos", "captured", null, $lastComboPlayer);
          NotificationManager::captureCards(
            $lastComboPlayer,
            $players[$lastComboPlayer]["name"],
            $trickValue
          );
          $this->gamestate->nextState("endRound");
        }
      } else {
        $this->gamestate->changeActivePlayer($lastComboPlayer);
        $this->giveExtraTime($lastComboPlayer);
        LogManager::insert($lastComboPlayer, "confirm", [
          "nextPlayer" => $next,
          "dragon" => $dragon,
        ]);
        $this->gamestate->nextState("confirmTrick");
      }
    } else {
      // Continue the current trick play
      // => go to next player with cards in hand

      $this->gamestate->changeActivePlayer($next);
      $this->giveExtraTime($next);

      $this->gamestate->nextState("nextPlayer");
    }
  }

  function stEndRound()
  {
    $team_points = [0, 0];
    $team_points_GT = [0, 0];
    $team_points_T = [0, 0];
    $deck = CardManager::getDeck();

    $firstOutPlayer = $this->getGameStateValue("firstOutPlayer");

    $players = PlayerManager::getPlayers();

    $doubleVic = $this->getGameStateValue("doubleVictory");
    if ($doubleVic >= 0) {
      $team_points[$doubleVic] = 200;
      NotificationManager::log(
        'It\'s a double victory for ${player_name}\'s team. They score 200 points.',
        ["player_name" => $players[$firstOutPlayer]["name"]]
      );
    } else {
      //get last player
      $lastPlayerId = array_keys($deck->countCardsByLocationArgs("hand"))[0];
      $deck->moveAllCardsInLocation("captured", "captured", $lastPlayerId, $firstOutPlayer);

      $ids = array_keys(
        array_filter($players, function ($player) {
          return $player["team"] == "0";
        })
      );
      $cards = array_merge(
        $deck->getCardsInLocation("captured", $ids[0]),
        $deck->getCardsInLocation("captured", $ids[1])
      );
      if ($players[$lastPlayerId]["team"] == 1) {
        $cards = array_merge($cards, $deck->getCardsInLocation("hand", $lastPlayerId));
      }
      $result = CardManager::getTrickValue($cards, true);
      $team_points[0] = $result["score"];
      $team_points[1] = 100 - $team_points[0];
    }

    $bBetsGTMade = false;
    $bBetsTMade = false;
    $teams = [[], []];
    foreach ($players as $player_id => $player) {
      $teams[$player["team"]][] = $player;
      if ($player["call_grand_tichu"] == 200) {
        $bBetsGTMade = true;
        if ($player_id == $firstOutPlayer) {
          $this->incStat(1, "grandtichu_won_number", $player_id);
          $team_points[$player["team"]] += 200;
          $team_points_GT[$player["team"]] += 200;
          NotificationManager::log(
            '${player_name} has made the Grand Tichu and team scores 200 points!',
            ["player_name" => $player["name"]]
          );
        } else {
          $team_points[$player["team"]] -= 200;
          $team_points_GT[$player["team"]] -= 200;
          NotificationManager::log(
            '${player_name} has not made the Grand Tichu and the team loses 200 points!',
            ["player_name" => $player["name"]]
          );
        }
      }

      if ($player["call_tichu"] == 100) {
        $bBetsTMade = true;
        if ($player_id == $firstOutPlayer) {
          $this->incStat(1, "tichu_won_number", $player_id);
          $team_points[$player["team"]] += 100;
          $team_points_T[$player["team"]] += 100;
          NotificationManager::log(
            '${player_name} has made the Tichu and the team scores 100 points!',
            ["player_name" => $player["name"]]
          );
        } else {
          $team_points[$player["team"]] -= 100;
          $team_points_T[$player["team"]] -= 100;
          NotificationManager::log(
            '${player_name} has not made the Tichu and the team loses 100 points!',
            ["player_name" => $player["name"]]
          );
        }
      }
    }

    // ////////// Display table window with results /////////////////
    $table = [];

    // Header line

    $firstRow = [""];
    $firstRow[] = [
      "str" => 'Team ${first_player_name} and ${third_player_name}',
      "args" => [
        "first_player_name" => $teams[0][0]["name"],
        "third_player_name" => $teams[0][1]["name"],
      ],
      "type" => "header",
    ];
    $firstRow[] = [
      "str" => 'Team ${second_player_name} and ${fourth_player_name}',
      "args" => [
        "second_player_name" => $teams[1][0]["name"],
        "fourth_player_name" => $teams[1][1]["name"],
      ],
      "type" => "header",
    ];
    $table[] = $firstRow;
    $createRow = function ($title, $val, $val2) {
      return [["str" => clienttranslate($title), "args" => []], $val, $val2];
    };

    if ($doubleVic >= 0) {
      // Double Victory Points
      $table[] = $createRow(
        "Double Victory Points",
        $doubleVic == 0 ? 200 : 0,
        $doubleVic == 1 ? 200 : 0
      );
    } else {
      $val = $result["table"][5] * 5;
      $table[] = $createRow("5 Points", $val, 20 - $val);

      $val = $result["table"][10] * 10;
      $table[] = $createRow("10 Points", $val, 40 - $val);

      $val = $result["table"][13] * 10;
      $table[] = $createRow("K Points", $val, 40 - $val);

      $val = in_array(TYPE_PHOENIX, $result["special"]) ? -25 : 0;
      $table[] = $createRow("Phoenix Points", $val, -25 - $val);

      $val = in_array(TYPE_DRAGON, $result["special"]) ? 25 : 0;
      $table[] = $createRow("Dragon Points", $val, 25 - $val);
    }
    if ($bBetsGTMade) {
      // Grand Tichu
      $table[] = $createRow("Grand Tichu Points", $team_points_GT[0], $team_points_GT[1]);
    }

    if ($bBetsTMade) {
      // Tichu
      $table[] = $createRow("Tichu Points", $team_points_T[0], $team_points_T[1]);
    }

    // Total Points
    $table[] = $createRow("Total Points", $team_points[0], $team_points[1]);

    NotificationManager::tableWindow($table);

    // Save points to db
    PlayerManager::updateScores($team_points);

    $deck->moveAllCardsInLocation(null, "deck");

    $newScores = PlayerManager::getScores();
    NotificationManager::newScores($newScores);

    $max_score = max($newScores);

    $end_points = [500, 1000, 2000][$this->getGameStateValue("gameLength") - 1];

    if ($max_score >= $end_points) {
      $scores = array_unique($newScores);
      if (count($scores) > 1) {
        $this->gamestate->nextState("endGame");
        return;
      } // else both teams are above $end_points with the same score : game goes on
    }
    $this->gamestate->nextState("newRound");
  }

  function stChangePlayer()
  {
    $action = LogManager::getLastAction("changePlayer");
    $this->gamestate->changeActivePlayer($action["player"]);
    $this->gamestate->nextState($action["arg"]["transition"]);
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
  function zombieTurn($state, $active_player)
  {
    $statename = $state["name"];
    NotificationManager::log('${playerName} makes a zombie turn', [
      "player_name" => $active_player["name"],
    ]);
    if ($state["type"] === "activeplayer") {
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
      $this->gamestate->nextState("zombiePass");
      return;
    }

    if ($state["type"] == "multipleactiveplayer") {
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
          $this->DbQuery(
            sprintf(
              "UPDATE player SET player_is_multiactive = 0 WHERE player_id = '%s'",
              $active_player
            )
          );
          $this->gamestate->updateMultiactiveOrNextState("");
          return;
      }
    }

    throw new feException("Zombie mode not supported at this game state: " . $statename);
  }

  function zombiGiveCards()
  {
    //3 random cards are given
    $player_idm = $this->getCurrentPlayerId();
    $cards = CardManager::getDeck()->getCardsInLocation("hand", $player_idm);
    shuffle($cards);
    $cards_ids = array_column(array_splice($cards, 0, 3), "id");
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
  function upgradeTableDb($from_version)
  {
    if ($from_version <= 2102011339) {
      // revision 78876
      // ! important ! Use DBPREFIX_<table_name> for all tables
      //checking if column exists
      //Utils::die("TEST");
      $players = $this->getObjectListFromDB("SELECT * FROM player");
      // player_has_bomb is obsolete.
      if (!isset($players[0]["player_has_bomb"])) {
        $this->applyDbUpgradeToAllDB(
          "ALTER TABLE DBPREFIX_player ADD `player_has_bomb` INT NOT NULL DEFAULT '0'"
        );
      }
      if (!isset($players[0]["player_pass"])) {
        $this->applyDbUpgradeToAllDB(
          "ALTER TABLE DBPREFIX_player ADD `player_pass` INT NOT NULL DEFAULT '0'"
        );
      }
      $this->applyDbUpgradeToAllDB("CREATE TABLE IF NOT EXISTS DBPREFIX_actionlog (
				`log_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
				`log_player` int(10) NOT NULL,
				`log_round` int(10) unsigned NOT NULL,
				`log_trick` int(10) unsigned NOT NULL,
				`log_action` varchar(16) NOT NULL,
				`log_arg` varchar(1024),
				PRIMARY KEY (`log_id`)
			) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=1;");
      $state = $this->gamestate->state()["name"];
      $this->DbQuery(
        "INSERT INTO actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES (0,0,0, 'newRound', '')"
      );
      $combos = $this->getCollectionFromDb(
        "SELECT combo_player_id, combo_display FROM combo",
        true
      );
      $n = 0;
      $deck = CardManager::getDeck();
      foreach ($combos as $pId => $cardIds) {
        if (strlen($cardIds) == 0) {
          LogManager::insert($pId, "pass");
          continue;
        }
        $cards = array_values($deck->getCards(explode(",", $cardIds)));
        $combo = new Combo($cards);
        if (is_array($combo->phoenixValue)) {
          $combo->setPhoenixValue(
            $this->getUniqueValueFromDB("SELECT global_value FROM global WHERE global_id=29")
          );
        }
        LogManager::playCombo($pId, $combo);
      }
      $deck->moveAllCardsInLocation("lastcombo", "combos");
      $deck->moveAllCardsInLocation("allcombos", "combos");
      switch ($state) {
        case "grandTichuBets":
        case "giveCards":
        case "showPassedCards":
          LogManager::insert(0, "newRound");
          break;
        case "phoenixPlay":
          $cards = array_values($deck->getCardsInLocation("phoenixPlay"));
          $player = $cards[0]["location_arg"];
          $combo = new Combo($cards);
          if (!is_array($combo->phoenixValue)) {
            $combo->phoenixValue = [$combo->phoenixValue];
          }
          LogManager::askPhoenix($player, $combo);
          $deck->moveAllCardsInLocation("phoenixPlay", "hand", null, $player);
          break;
      }
    }
  }

  function upgradeTableDb1($from_version)
  {
    if ($from_version <= 2101032301) {
      // ! important ! Use DBPREFIX_<table_name> for all tables
      // player_has_bomb is obsolete.
      $players = $this->getObjectListFromDB("SELECT * FROM player");
      if (!isset($players[0]["player_has_bomb"])) {
        $this->applyDbUpgradeToAllDB(
          "ALTER TABLE DBPREFIX_player ADD `player_has_bomb` INT NOT NULL DEFAULT '0'"
        );
      }
      if (!isset($players[0]["player_pass"])) {
        $this->applyDbUpgradeToAllDB(
          "ALTER TABLE DBPREFIX_player ADD `player_pass` INT NOT NULL DEFAULT '0'"
        );
      }
      $this->applyDbUpgradeToAllDB("CREATE TABLE IF NOT EXISTS DBPREFIX_actionlog (
				`log_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
				`log_player` int(10) NOT NULL,
				`log_round` int(10) unsigned NOT NULL,
				`log_trick` int(10) unsigned NOT NULL,
				`log_action` varchar(16) NOT NULL,
				`log_arg` varchar(1024),
				PRIMARY KEY (`log_id`)
			) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=1;");
      $state = $this->gamestate->state()["name"];
      $this->applyDbUpgradeToAllDB(
        "INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES (0,0,0, 'newRound', '')"
      );
      $combos = $this->getCollectionFromDb(
        "SELECT combo_player_id, combo_display FROM combo",
        true
      );
      $n = 0;
      $deck = CardManager::getDeck();
      foreach ($combos as $pId => $cardIds) {
        if (strlen($cardIds) == 0) {
          $this->applyDbUpgradeToAllDB(
            "INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ($pId,0,0, 'pass', '')"
          );
          continue;
        }
        $cards = array_values($deck->getCards(explode(",", $cardIds)));
        $combo = new Combo($cards);
        if (is_array($combo->phoenixValue)) {
          $combo->setPhoenixValue(
            $this->getUniqueValueFromDB("SELECT global_value FROM global WHERE global_id=29")
          );
        }
        $cards = Utils::filterColumns($combo->cards, ["id", "type", "type_arg"]);
        $args = json_encode([
          "description" => $combo->description,
          "type" => $combo->type,
          "cards" => $cards,
          "phoenixValue" => $combo->phoenixValue,
        ]);
        $this->applyDbUpgradeToAllDB(
          "INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ($pId,0,0, 'combo', '$args')"
        );
      }
      $this->applyDbUpgradeToAllDB(
        "UPDATE DBPREFIX_card SET card_location='combos' WHERE card_location IN ('lastcombo', 'allcombos')"
      );
      $playerids = $this->getObjectListFromDB("SELECT player_id FROM player ORDER BY player_no");
      switch ($state) {
        case "grandTichuBets":
        case "giveCards":
        case "showPassedCards":
          $this->applyDbUpgradeToAllDB(
            "INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES (0,1,0, 'newRound', '')"
          );
          break;
        case "phoenixPlay":
          $cards = array_values($deck->getCardsInLocation("phoenixPlay"));
          $player = $cards[0]["location_arg"];
          $combo = new Combo($cards);
          $cards = Utils::filterColumns($combo->cards, ["id", "type", "type_arg"]);
          $args = json_encode([
            "description" => $combo->description,
            "type" => $combo->type,
            "cards" => $cards,
            "phoenixValue" => $combo->phoenixValue,
          ]);
          $this->applyDbUpgradeToAllDB(
            "INSERT INTO DBPREFIX_actionlog (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) VALUES ($player,0,0, 'phoenix', '$args')"
          );
          $deck->moveAllCardsInLocation("phoenixPlay", "hand", null, $player);
          $this->applyDbUpgradeToAllDB(
            "UPDATE DBPREFIX_card SET card_location='hand' WHERE card_location='phoenixPlay'"
          );
          break;
      }
    }
  }
}
