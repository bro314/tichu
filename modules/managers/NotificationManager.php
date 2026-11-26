<?php

use Bga\GameFramework\Table;

class NotificationManager
{
  /**
   * @param array<string, mixed> $args
   */
  private static function broadcast(string $type, string $log, array $args): void
  {
    Tichu::$instance->notifyAllPlayers(
      $type,
      $log,
      array_merge(["codeVersion" => TICHU_CODE_VERSION], $args)
    );
  }

  /**
   * @param array<string, mixed> $args
   */
  private static function notifyPlayerWithVersion(
    int $playerId,
    string $type,
    string $log,
    array $args
  ): void {
    Tichu::$instance->notifyPlayer(
      $playerId,
      $type,
      $log,
      array_merge(["codeVersion" => TICHU_CODE_VERSION], $args)
    );
  }

  /**
   * @param array<int|string, array<string, mixed>> $cards
   */
  public static function dealCards(int|string $player_id, array $cards, string $msg): void
  {
    self::notifyPlayerWithVersion((int) $player_id, "dealCards", $msg, [
      "cards" => $cards,
    ]);
  }

  public static function grandTichuBet(
    int|string $player_id,
    string $player_name,
    int|string $bet
  ): void {
    $msg =
      $bet == 0
        ? clienttranslate('${player_name} makes no Grand Tichu bet')
        : clienttranslate('${player_name} makes a Grand Tichu bet');
    self::broadcast("grandTichuBet", $msg, [
      "player_id" => $player_id,
      "player_name" => $player_name,
      "bet" => (int) $bet,
    ]);
  }

  public static function tichuBet(
    int|string $player_id,
    string $player_name,
    int|string $bet
  ): void {
    $msg = $bet == 0 ? "" : clienttranslate('${player_name} makes a Tichu bet');
    self::broadcast("tichuBet", $msg, [
      "player_id" => $player_id,
      "player_name" => $player_name,
      "bet" => (int) $bet,
    ]);
  }

  /**
   * @param array<string, mixed> $args
   */
  public static function log(string $msg, array $args): void
  {
    self::broadcast("log", $msg, $args);
  }

  public static function playCombo(
    int|string $playerId,
    string $playerName,
    Combo $combo,
    string $msg
  ): void {
    $cards = $combo->cards ?? [];
    $hasComboPhoenix = (int) $combo->type !== SINGLE_COMBO && $combo->hasPhoenix();
    $phoenixRankVal =
      $hasComboPhoenix && $combo->phoenixValue !== null && !is_array($combo->phoenixValue)
        ? (int) $combo->phoenixValue
        : null;
    $phoenixRank = $phoenixRankVal !== null ? CardManager::cardToStr($phoenixRankVal) : "";
    $i18n = [];
    if ($phoenixRankVal !== null && CardManager::isTranslatableCardStr($phoenixRankVal)) {
      $i18n[] = "phoenix_rank";
    }
    self::broadcast("playCombo", $msg, [
      "i18n" => $i18n,
      "player_id" => $playerId,
      "player_name" => $playerName,
      "combo_name" => $combo->toLogSpec(),
      "phoenix_rank" => $phoenixRank,
      "cards" => $cards,
      "points" => CardManager::getTrickValue($cards),
      "type" => (int) $combo->type,
      "phoenixValue" => $combo->phoenixValue,
    ]);
  }

  public static function wishMade(
    int|string $player_id,
    string $player_name,
    int|string $wish,
    string $textValue,
    string $msg
  ): void {
    $i18nKeys = (int) $wish >= 11 && (int) $wish <= 14 ? ["text_value"] : [];
    self::broadcast("wishMade", $msg, [
      "i18n" => $i18nKeys,
      "player_id" => $player_id,
      "player_name" => $player_name,
      "wish" => $wish,
      "text_value" => $textValue,
    ]);
  }

  public static function mahjongGranted(): void
  {
    self::broadcast("mahjongWishGranted", "", []);
  }

  public static function playerGoOut(
    int|string $player_id,
    string $player_name,
    int|string $firstOutPlayer
  ): void {
    self::broadcast(
      "playerGoOut",
      clienttranslate('${player_name} has shed the cards from hand '),
      [
        "firstout_id" => $firstOutPlayer,
        "player_id" => $player_id,
        "player_name" => $player_name,
      ]
    );
  }

  public static function pass(
    int|string $player_id,
    string $player_name,
    ?string $msg = null
  ): void {
    self::broadcast("pass", $msg ?? clienttranslate('${player_name} passes'), [
      "player_id" => $player_id,
      "player_name" => $player_name,
    ]);
  }

  public static function devConsole(string $msg): void
  {
    if (Table::getBgaEnvironment() !== "studio") {
      Tichu::$instance->trace((string) $msg);
      return;
    }
    self::broadcast("devConsole", "", ["msg" => (string) $msg]);
  }

  /**
   * @param array<int, array<int, mixed>> $table
   */
  public static function tableWindow(array $table): void
  {
    self::broadcast("tableWindow", "", [
      "i18n" => ["title", "closing"],
      "id" => "finalScoring",
      "title" => clienttranslate("Result of this Round"),
      "table" => $table,
      "closing" => clienttranslate("ok"),
    ]);
  }

  /**
   * @param array<int|string, mixed> $newScores
   * @param array<string, mixed>|null $roundScore
   */
  public static function newScores(array $newScores, ?array $roundScore = null): void
  {
    self::broadcast("newScores", "", [
      "newScores" => $newScores,
      "roundScore" => $roundScore,
    ]);
  }

  public static function captureCards(
    int|string $player_id,
    string $player_name,
    int $trickValue
  ): void {
    self::broadcast(
      "captureCards",
      clienttranslate('${player_name} gets all cards valuing ${trick_value} points'),
      [
        "player_id" => $player_id,
        "player_name" => $player_name,
        "trick_value" => $trickValue,
      ]
    );
  }

  public static function autopass(int $val, int|string|null $pId = null): void
  {
    if (is_null($pId)) {
      self::broadcast("autopass", "", [
        "autopass" => $val,
      ]);
    } else {
      self::notifyPlayerWithVersion((int) $pId, "autopass", "", [
        "autopass" => $val,
      ]);
    }
  }

  public static function confirmTichu(
    int|string $player_id,
    bool $grand,
    ?string $msg = null
  ): void {
    self::notifyPlayerWithVersion((int) $player_id, "confirmTichu", "", [
      "grand" => $grand,
      "msg" => $msg ?? clienttranslate("Another tichu bet has just been made. Are you sure?"),
    ]);
  }

  public static function acceptCards(int|string $player_id): void
  {
    $cards = CardManager::getCardsPassedTo($player_id);
    $i18nKeys = [];
    if ($cards[0] !== null && CardManager::isTranslatableCardStr($cards[0])) {
      $i18nKeys[] = "card1";
    }
    if ($cards[1] !== null && CardManager::isTranslatableCardStr($cards[1])) {
      $i18nKeys[] = "card2";
    }
    if ($cards[2] !== null && CardManager::isTranslatableCardStr($cards[2])) {
      $i18nKeys[] = "card3";
    }

    self::notifyPlayerWithVersion(
      (int) $player_id,
      "acceptCards",
      clienttranslate(
        'You have accepted ${card1} from previous player, ${card2} from partner, ${card3} from next player.'
      ),
      [
        "i18n" => $i18nKeys,
        "cards" => $cards,
        "card1" => CardManager::cardToStr($cards[0]),
        "card2" => CardManager::cardToStr($cards[1]),
        "card3" => CardManager::cardToStr($cards[2]),
      ]
    );
  }

  /**
   * @param array<int, int|string> $cardIds
   */
  public static function passCards(int|string $player_id, array $cardIds): void
  {
    $deck = CardManager::getDeck();
    $c0 = $deck->getCard((int) $cardIds[0]);
    $c1 = $deck->getCard((int) $cardIds[1]);
    $c2 = $deck->getCard((int) $cardIds[2]);
    $i18nKeys = [];
    if ($c0 !== null && CardManager::isTranslatableCardStr($c0)) {
      $i18nKeys[] = "card1";
    }
    if ($c1 !== null && CardManager::isTranslatableCardStr($c1)) {
      $i18nKeys[] = "card2";
    }
    if ($c2 !== null && CardManager::isTranslatableCardStr($c2)) {
      $i18nKeys[] = "card3";
    }

    self::notifyPlayerWithVersion(
      (int) $player_id,
      "passCards",
      clienttranslate(
        'You have passed ${card1} to previous player, ${card2} to partner, ${card3} to next player.'
      ),
      [
        "i18n" => $i18nKeys,
        "cardIds" => $cardIds,
        "card1" => CardManager::cardToStr($c0),
        "card2" => CardManager::cardToStr($c1),
        "card3" => CardManager::cardToStr($c2),
      ]
    );
  }

  /**
   * @param array<int, array<string, mixed>> $cards
   */
  public static function unpassCards(
    int|string $playerId,
    array $cards,
    bool $reopenedByTichu,
    ?int $callerId = null,
    string $callerName = ""
  ): void {
    $cardIds = array_values(array_map(static fn(array $c): string => (string) $c["id"], $cards));
    $args = [
      "cardIds" => $cardIds,
      "cards" => array_values($cards),
      "reopenedByTichu" => $reopenedByTichu,
    ];
    if ($callerId !== null) {
      $args["callerId"] = $callerId;
      $args["callerName"] = $callerName;
    }
    self::notifyPlayerWithVersion((int) $playerId, "unpassCards", "", $args);
  }

  /**
   * @param array<string, mixed> $suggestion
   */
  public static function botSuggestion(int|string $player_id, array $suggestion): void
  {
    self::notifyPlayerWithVersion((int) $player_id, "botSuggestion", "", [
      "suggestion" => $suggestion,
    ]);
  }

  public static function concedeProposal(
    int $toPlayerId,
    int $playerId,
    string $playerName,
    int $team
  ): void {
    self::notifyPlayerWithVersion($toPlayerId, "concedeProposal", "", [
      "player_id" => $playerId,
      "player_name" => $playerName,
      "team" => $team,
    ]);
  }

  public static function concedeCancel(
    int $toPlayerId,
    int $playerId,
    string $playerName,
    string $reason
  ): void {
    self::notifyPlayerWithVersion($toPlayerId, "concedeCancel", "", [
      "player_id" => $playerId,
      "player_name" => $playerName,
      "reason" => $reason,
    ]);
  }

  public static function concedeResult(
    int $team,
    int $playerId,
    string $playerName,
    int $playerId2,
    string $playerName2
  ): void {
    self::broadcast(
      "concedeResult",
      clienttranslate('${player_name} and ${player_name2} concede the match!'),
      [
        "team" => $team,
        "player_id" => $playerId,
        "player_name" => $playerName,
        "player_id2" => $playerId2,
        "player_name2" => $playerName2,
      ]
    );
  }
}
?>
