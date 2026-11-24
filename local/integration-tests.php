<?php
/**
 * Fast, comprehensive backend-only integration test runner for Tichu.
 * Executes full game state machine, action endpoints, bot, and scenario tests
 * in `:memory:` SQLite in well under 1 second.
 *
 * Run:
 *   /opt/homebrew/bin/php local/integration-tests.php
 */

$suiteStart = microtime(true);
$projectRoot = dirname(__DIR__);

if (getenv('TICHU_MYSQL_DB') === false || getenv('TICHU_MYSQL_DB') === '') {
  putenv('TICHU_MYSQL_DB=ebd_tichu_test');
}

ob_start();
require_once __DIR__ . '/bga-backend.php';
require_once $projectRoot . '/tichu.game.php';
require_once $projectRoot . '/tichu.action.php';
require_once $projectRoot . '/tichu.view.php';
require_once __DIR__ . '/bot.php';
require_once __DIR__ . '/scenarios.php';
require_once __DIR__ . '/import-bug-sql.php';
ob_end_clean();

const P0 = \LocalTichuScenarios::P0; // 2385074 (Team 0)
const P1 = \LocalTichuScenarios::P1; // 2385075 (Team 1)
const P2 = \LocalTichuScenarios::P2; // 2385076 (Team 0 - P0's partner)
const P3 = \LocalTichuScenarios::P3; // 2385077 (Team 1 - P1's partner)

class TestAssertionError extends \Exception {}

function assertSameVal($expected, $actual, string $msg = ''): void
{
  if ($expected !== $actual) {
    $expStr = var_export($expected, true);
    $actStr = var_export($actual, true);
    throw new TestAssertionError(
      ($msg !== '' ? "$msg — " : '') . "Expected $expStr, got $actStr"
    );
  }
}

function assertTrueVal(bool $cond, string $msg = 'Assertion failed'): void
{
  if (!$cond) {
    throw new TestAssertionError($msg);
  }
}

function assertThrowsUserException(callable $fn, ?string $expectedSubstring = null, string $msg = ''): void
{
  try {
    $fn();
  } catch (\Bga\GameFramework\UserException $e) {
    if ($expectedSubstring !== null && stripos($e->getMessage(), $expectedSubstring) === false) {
      throw new TestAssertionError(
        ($msg !== '' ? "$msg — " : '') .
          "Expected UserException containing '$expectedSubstring', got '" .
          $e->getMessage() .
          "'"
      );
    }
    return;
  } catch (\Throwable $e) {
    throw new TestAssertionError(
      ($msg !== '' ? "$msg — " : '') .
        'Expected UserException, got ' .
        get_class($e) .
        ': ' .
        $e->getMessage()
    );
  }
  throw new TestAssertionError(
    ($msg !== '' ? "$msg — " : '') . 'Expected UserException to be thrown, but none was thrown'
  );
}

/**
 * Helper to invoke an action through `action_tichu` just like an HTTP AJAX request.
 */
function callAction(\Tichu $game, int $playerId, string $actionName, array $args = []): void
{
  $game->setCurrentPlayerId($playerId);
  $action = new \action_tichu($game, $args);
  try {
    $action->$actionName();
  } catch (\Throwable $e) {
    $game->endPlayerAction(true);
    throw $e;
  }
}

// ============================================================================
// Test 1: test_new_game_and_deal_8_cards
// ============================================================================
function test_new_game_and_deal_8_cards(): void
{
  $game = new \Tichu();
  $game->createNewGame([
    'gameLength' => 1, // 500 pts
    'playerTeams' => TEAM_1_3,
    'turnBased' => 0,
  ]);

  $state = $game->gamestate->state(P0);
  assertSameVal((string) ST_GRAND_TICHU_BETS, $state['id'], 'Initial state ID should be 20');
  assertSameVal('grandTichuBets', $state['name'], 'Initial state name should be grandTichuBets');
  assertSameVal('multipleactiveplayer', $state['type'], 'grandTichuBets should be multipleactiveplayer');
  assertSameVal(4, count($state['multiactive']), 'All 4 players should be multiactive');

  $deck = \CardManager::getDeck();
  assertSameVal(24, (int) $deck->countCardInLocation('deck'), '24 cards should remain in deck after dealing 8 each');
  foreach ([P0, P1, P2, P3] as $pId) {
    assertSameVal(8, (int) $deck->countCardInLocation('hand', $pId), "Player $pId should hold 8 cards");
  }

  $payload = $game->getFullClientPayload(P0);
  assertSameVal(1, (int) $payload['round'], 'Round should be 1');
  assertSameVal(0, (int) $payload['trick'], 'Trick should be 0');
  assertSameVal([P0, P1, P2, P3], $payload['playerorder'], 'Player order for P0 should start with P0');
  assertTrueVal(array_key_exists('pass', $payload['players'][P0]), 'Viewer P0 should see own pass field');
  assertTrueVal(!array_key_exists('pass', $payload['players'][P1]), 'Other player pass field must be hidden');
  assertSameVal('0', (string) $payload['players'][P0]['team'], 'P0 should be on Team 0');
  assertSameVal('1', (string) $payload['players'][P1]['team'], 'P1 should be on Team 1');
  assertSameVal('0', (string) $payload['players'][P2]['team'], 'P2 should be on Team 0');
  assertSameVal('1', (string) $payload['players'][P3]['team'], 'P3 should be on Team 1');
  assertSameVal('000000', (string) $payload['players'][P0]['color'], 'P0 color in TEAM_1_3 should be 000000');
  assertSameVal('ff0000', (string) $payload['players'][P1]['color'], 'P1 color in TEAM_1_3 should be ff0000');
  assertSameVal('1', (string) $payload['players'][P0]['no'], 'P0 player_no in TEAM_1_3 should be 1 (1-based for MySQL AUTO_INCREMENT PK)');
  assertSameVal('2', (string) $payload['players'][P1]['no'], 'P1 player_no in TEAM_1_3 should be 2');
  assertSameVal('3', (string) $payload['players'][P2]['no'], 'P2 player_no in TEAM_1_3 should be 3');
  assertSameVal('4', (string) $payload['players'][P3]['no'], 'P3 player_no in TEAM_1_3 should be 4');

  // Verify TEAM_1_2 player_color and team assignments
  $game->createNewGame([
    'gameLength' => 1,
    'playerTeams' => TEAM_1_2,
    'turnBased' => 0,
  ]);
  $payload12 = $game->getFullClientPayload(P0);
  assertSameVal('0', (string) $payload12['players'][P0]['team'], 'P0 should be on Team 0 in TEAM_1_2');
  assertSameVal('0', (string) $payload12['players'][P1]['team'], 'P1 should be on Team 0 in TEAM_1_2');
  assertSameVal('1', (string) $payload12['players'][P2]['team'], 'P2 should be on Team 1 in TEAM_1_2');
  assertSameVal('1', (string) $payload12['players'][P3]['team'], 'P3 should be on Team 1 in TEAM_1_2');
  assertSameVal('000000', (string) $payload12['players'][P0]['color'], 'P0 color in TEAM_1_2 should be 000000');
  assertSameVal('000000', (string) $payload12['players'][P1]['color'], 'P1 color in TEAM_1_2 should be 000000');
  assertSameVal('ff0000', (string) $payload12['players'][P2]['color'], 'P2 color in TEAM_1_2 should be ff0000');
  assertSameVal('ff0000', (string) $payload12['players'][P3]['color'], 'P3 color in TEAM_1_2 should be ff0000');

  // Verify TEAM_RANDOM assigns two players to team 0 ("000000", seats 1 & 3) and two to team 1 ("ff0000", seats 2 & 4)
  $game->createNewGame([
    'gameLength' => 1,
    'playerTeams' => TEAM_RANDOM,
    'turnBased' => 0,
  ]);
  $randomRows = \APP_DbObject::getObjectListFromDB("SELECT player_id, player_no, player_team, player_color FROM player ORDER BY player_no ASC");
  assertSameVal(4, count($randomRows), 'TEAM_RANDOM should insert 4 players');
  assertSameVal('1', (string) $randomRows[0]['player_no'], 'Seat 1 player_no should be 1');
  assertSameVal('0', (string) $randomRows[0]['player_team'], 'Seat 1 player_team should be 0');
  assertSameVal('000000', (string) $randomRows[0]['player_color'], 'Seat 1 player_color should be 000000');
  assertSameVal('2', (string) $randomRows[1]['player_no'], 'Seat 2 player_no should be 2');
  assertSameVal('1', (string) $randomRows[1]['player_team'], 'Seat 2 player_team should be 1');
  assertSameVal('ff0000', (string) $randomRows[1]['player_color'], 'Seat 2 player_color should be ff0000');
  assertSameVal('3', (string) $randomRows[2]['player_no'], 'Seat 3 player_no should be 3');
  assertSameVal('0', (string) $randomRows[2]['player_team'], 'Seat 3 player_team should be 0');
  assertSameVal('000000', (string) $randomRows[2]['player_color'], 'Seat 3 player_color should be 000000');
  assertSameVal('4', (string) $randomRows[3]['player_no'], 'Seat 4 player_no should be 4');
  assertSameVal('1', (string) $randomRows[3]['player_team'], 'Seat 4 player_team should be 1');
  assertSameVal('ff0000', (string) $randomRows[3]['player_color'], 'Seat 4 player_color should be ff0000');

  // Verify scenario "grand_tichu" deals the 8 expected powerhouse cards to P0
  $gtPayload = \LocalTichuScenarios::setupScenario($game, 'grand_tichu', P0);
  assertSameVal('grandTichuBets', $gtPayload['gamestate']['name']);
  assertSameVal(8, count($gtPayload['hand']), 'P0 should have 8 cards in grand_tichu scenario');
  $dragonId = \LocalTichuScenarios::getCardId(1, 1);
  $handIds = array_map(static fn($c) => (int) $c['id'], $gtPayload['hand']);
  assertTrueVal(in_array($dragonId, $handIds, true), 'P0 should hold the Dragon in grand_tichu scenario');
}

// ============================================================================
// Test 2: test_grand_tichu_and_tichu_bets_and_confirmation_threshold
// ============================================================================
function test_grand_tichu_and_tichu_bets_and_confirmation_threshold(): void
{
  $game = new \Tichu();
  \LocalTichuScenarios::setupScenario($game, 'grand_tichu', P0);

  // P0 calls Grand Tichu (200)
  callAction($game, P0, 'grandTichuBet', ['bet' => '200']);
  $p0 = \PlayerManager::getPlayer(P0);
  assertSameVal('200', (string) $p0['call_grand_tichu'], 'P0 call_grand_tichu should be 200');
  assertSameVal('0', (string) $p0['call_tichu'], 'P0 call_tichu should be set to 0 when betting GT');
  assertSameVal(1.0, (float) $game->getStat('grandtichu_number', P0), 'P0 grandtichu_number stat should be 1');
  assertTrueVal(!$game->gamestate->isPlayerActive(P0), 'P0 should no longer be multiactive after GT bet');

  // P0 cannot also call regular Tichu after calling Grand Tichu
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'tichuBet', ['bet' => '100']),
    'already made a grand tichu bet',
    'Calling Tichu after Grand Tichu should fail'
  );

  // P1 tries to call Grand Tichu (200) immediately after P0 (< 60s threshold) -> triggers confirmTichu notification!
  $beforePacketId = (int) \APP_DbObject::getUniqueValueFromDB("SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog");
  callAction($game, P1, 'grandTichuBet', ['bet' => '200']);
  $p1 = \PlayerManager::getPlayer(P1);
  assertSameVal('-1', (string) $p1['call_grand_tichu'], 'P1 GT bet should require confirmation within 60s threshold');
  assertTrueVal($game->gamestate->isPlayerActive(P1), 'P1 should still be active awaiting confirmTichu');

  $p1Notifs = $game->getNotificationsSince($beforePacketId, P1, false);
  $confirmNotif = null;
  foreach ($p1Notifs as $pkt) {
    if (($pkt['data'][0]['type'] ?? '') === 'confirmTichu') {
      $confirmNotif = $pkt['data'][0]['args'];
      break;
    }
  }
  assertTrueVal($confirmNotif !== null, 'P1 should receive a confirmTichu notification');
  assertSameVal(true, (bool) $confirmNotif['grand'], 'confirmTichu should have grand=true');

  // P1 confirms the Grand Tichu bet via confirmTichu(200)
  callAction($game, P1, 'confirmTichu', ['bet' => '200']);
  $p1 = \PlayerManager::getPlayer(P1);
  assertSameVal('200', (string) $p1['call_grand_tichu'], 'P1 call_grand_tichu should be 200 after confirmTichu');
  assertTrueVal(!$game->gamestate->isPlayerActive(P1), 'P1 should be non-multiactive after confirming GT');

  // P2 calls regular Tichu (100) during grandTichuBets:
  // First call within threshold triggers confirmTichu(grand=false); then confirmTichu(100) places the bet
  callAction($game, P2, 'tichuBet', ['bet' => '100']);
  assertSameVal('-1', (string) \PlayerManager::getPlayer(P2)['call_tichu'], 'P2 tichuBet should ask confirmation first');
  callAction($game, P2, 'confirmTichu', ['bet' => '100']);
  $p2 = \PlayerManager::getPlayer(P2);
  assertSameVal('100', (string) $p2['call_tichu'], 'P2 call_tichu should be 100 after confirmTichu');
  assertSameVal('0', (string) $p2['call_grand_tichu'], 'P2 call_grand_tichu should be 0');
  assertSameVal(1.0, (float) $game->getStat('tichu_number', P2), 'P2 tichu_number stat should be 1');
  assertTrueVal(!$game->gamestate->isPlayerActive(P2), 'P2 should be set non-multiactive in grandTichuBets');

  // P3 bets 0 (no Grand Tichu) -> completes grandTichuBets, triggers stDealLastCards -> giveCards!
  callAction($game, P3, 'grandTichuBet', ['bet' => '0']);
  $state = $game->gamestate->state(P0);
  assertSameVal((string) ST_GIVE_CARDS, $state['id'], 'Should transition to ST_GIVE_CARDS (40)');
  assertSameVal('giveCards', $state['name']);

  $deck = \CardManager::getDeck();
  assertSameVal(0, (int) $deck->countCardInLocation('deck'), 'Deck should be empty after dealing last 6 cards');
  foreach ([P0, P1, P2, P3] as $pId) {
    assertSameVal(14, (int) $deck->countCardInLocation('hand', $pId), "Player $pId should now have 14 cards");
  }

  // Pass 3 cards for all 4 players so the game transitions to playComboOpen (trick 1, log_trick = 1)
  foreach ([P0, P1, P2, P3] as $pId) {
    $handCards = array_values($deck->getCardsInLocation('hand', $pId));
    $passIds = [$handCards[0]['id'], $handCards[1]['id'], $handCards[2]['id']];
    callAction($game, $pId, 'giveTheCards', ['cards' => implode(';', $passIds) . ';']);
  }
  assertSameVal('playComboOpen', $game->gamestate->state()['name'], 'Should transition to playComboOpen in Trick 1');
  assertSameVal(1, (int) \LogManager::getCurrentRoundAndTrick()['trick'], 'Trick should now be 1');

  // Verify P0's Grand Tichu bet, passing, and card acceptance were recorded in actionlog
  $gtLog = \LogManager::getLastAction('grandTichuBet', false);
  assertTrueVal($gtLog !== null, 'grandTichuBet action should be recorded in actionlog');
  $giveLog = \LogManager::getLastAction('giveCards', false);
  assertTrueVal($giveLog !== null && count($giveLog['arg']['recipients'] ?? []) === 3, 'giveCards action should record cards and 3 recipients');
  $acceptLog = \LogManager::getLastAction('acceptCards', false);
  assertTrueVal($acceptLog !== null && count($acceptLog['arg']['cards'] ?? []) === 3, 'acceptCards action should record 3 accepted cards');

  // P3 calls Tichu (100) in playComboOpen (log_trick = 1) right after P2's tichuCall in grandTichuBets (log_trick = 0):
  // Must still trigger confirmTichu across the newTrick boundary!
  callAction($game, P3, 'tichuBet', ['bet' => '100']);
  assertSameVal(
    '-1',
    (string) \PlayerManager::getPlayer(P3)['call_tichu'],
    'P3 tichuBet in playComboOpen should still require confirmation after a recent tichuCall in log_trick=0'
  );
  callAction($game, P3, 'confirmTichu', ['bet' => '100']);
  assertSameVal('100', (string) \PlayerManager::getPlayer(P3)['call_tichu'], 'P3 call_tichu should be 100 after confirmTichu');

  // Calling tichuBet a second time after already calling Tichu (call_tichu == 100) must throw UserException
  assertThrowsUserException(
    static fn() => callAction($game, P3, 'tichuBet', ['bet' => '100']),
    'cannot call Tichu',
    'Calling tichuBet a second time after already calling Tichu must throw UserException'
  );

  // Calling tichuBet after playing a card (countCardInLocation("hand") < 14) must throw UserException
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  assertSameVal(13, (int) $deck->countCardInLocation('hand', P0), 'P0 should have 13 cards after playing Mahjong');
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'tichuBet', ['bet' => '100']),
    'after playing a card',
    'Calling tichuBet after playing a card must throw UserException'
  );
}

// ============================================================================
// Test 3: test_give_cards_and_accept_passed_cards_and_bomb_passing_stat
// ============================================================================
function test_give_cards_and_accept_passed_cards_and_bomb_passing_stat(): void
{
  $game = new \Tichu();
  $payload = \LocalTichuScenarios::setupScenario($game, 'give_cards', P0);
  assertSameVal('giveCards', $payload['gamestate']['name'], 'Scenario give_cards should be in giveCards state');
  assertSameVal([ (string) P0 ], $payload['gamestate']['multiactive'], 'Only P0 should remain multiactive');

  $p0PassIds = \LocalTichuScenarios::getCardIds([[1, 2], [2, 2], [3, 2]]);
  $p1CardId = (string) \LocalTichuScenarios::getCardId(2, 14);

  // Validation: fewer than 3 cards must fail
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'giveTheCards', ['cards' => $p0PassIds[0] . ';' . $p0PassIds[1]]),
    'exactly 3 cards',
    'Passing 2 cards should throw UserException'
  );

  // Validation: card not in P0's hand must fail
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'giveTheCards', ['cards' => $p0PassIds[0] . ';' . $p0PassIds[1] . ';' . $p1CardId]),
    'not in your hand',
    'Passing another player card should throw UserException'
  );

  // P0 passes 3 valid cards -> triggers stAcceptPassedCards -> detectBombPassing -> stNewTrick -> playComboOpen!
  $beforeAcceptPacketId = (int) \APP_DbObject::getUniqueValueFromDB("SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog");
  callAction($game, P0, 'giveTheCards', ['cards' => implode(';', $p0PassIds) . ';']);

  // Verify notification ordering: acceptPassedCards -> acceptCards -> newTrick for both P0 and P1
  foreach ([P0, P1] as $viewerId) {
    $viewerNotifs = $game->getNotificationsSince($beforeAcceptPacketId, $viewerId, false);
    $seq = [];
    foreach ($viewerNotifs as $pkt) {
      $d = $pkt['data'][0] ?? [];
      $t = $d['type'] ?? '';
      if ($t === 'gameStateChange') {
        $seq[] = 'state:' . ($d['args']['name'] ?? '');
      } elseif ($t === 'acceptCards' || $t === 'passCards') {
        $seq[] = $t;
      }
    }
    $idxAcceptState = array_search('state:acceptPassedCards', $seq, true);
    $idxAcceptNotif = array_search('acceptCards', $seq, true);
    $idxNewTrickState = array_search('state:newTrick', $seq, true);
    assertTrueVal(
      $idxAcceptState !== false && $idxAcceptNotif !== false && $idxNewTrickState !== false,
      "Expected acceptPassedCards, acceptCards, and newTrick notifications for player $viewerId, got: " . implode(', ', $seq)
    );
    assertTrueVal(
      $idxAcceptState < $idxAcceptNotif && $idxAcceptNotif < $idxNewTrickState,
      "Expected acceptPassedCards < acceptCards < newTrick for player $viewerId, got: " . implode(', ', $seq)
    );
  }

  $state = $game->gamestate->state(P0);
  assertSameVal('playComboOpen', $state['name'], 'Should transition to playComboOpen after all 4 players pass');
  assertSameVal((string) P0, $state['active_player'], 'P0 holds Mahjong and should be active in playComboOpen');
  assertSameVal(P0, (int) $game->getGameStateValue('mahjongOwner'), 'mahjongOwner should be P0');

  // Verify all 4 players have 14 cards in hand and 0 in temporary
  $deck = \CardManager::getDeck();
  assertSameVal(0, (int) $deck->countCardInLocation('temporary'), 'No cards should remain in temporary');
  foreach ([P0, P1, P2, P3] as $pId) {
    assertSameVal(14, (int) $deck->countCardInLocation('hand', $pId), "Player $pId should have 14 cards after accepting");
  }

  // Verify P2 passing (4, 7) to P0 completed P0's 4-of-a-kind bomb of 7s and incremented bombs_completed_by_partner!
  assertSameVal(
    1.0,
    (float) $game->getStat('bombs_completed_by_partner', P0),
    'P0 bombs_completed_by_partner stat should be incremented to 1'
  );
  $p0Hand = new \Hand(array_values($deck->getCardsInLocation('hand', P0)));
  assertTrueVal($p0Hand->hasBomb(), 'P0 should now hold a completed bomb of 7s');
}

// ============================================================================
// Test 4: test_mahjong_lead_wish_creation_enforcement_and_fulfillment
// ============================================================================
function test_mahjong_lead_wish_creation_enforcement_and_fulfillment(): void
{
  $game = new \Tichu();
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);

  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);

  $state = $game->gamestate->state(P0);
  assertSameVal('mahjongPlay', $state['name'], 'Playing Mahjong should enter mahjongPlay state');
  assertSameVal((string) P0, $state['active_player'], 'P0 should remain active to make a wish');

  // P0 wishes for a 9
  callAction($game, P0, 'makeAWish', ['wish' => 9]);
  assertSameVal(9, (int) $game->getGameStateValue('mahjongWish'), 'mahjongWish global should be 9');
  $wishLog = \LogManager::getLastAction('mahjongWish', false);
  assertTrueVal($wishLog !== null && (int) ($wishLog['arg']['wish'] ?? 0) === 9, 'mahjongWish should be recorded in actionlog');

  $state = $game->gamestate->state(P1);
  assertSameVal('playCombo', $state['name'], 'After making wish, state should be playCombo');
  assertSameVal((string) P1, $state['active_player'], 'P1 should be active');

  // P1 holds (1, 9) and (2, 10) and Phoenix (2, 1).
  // 1. P1 cannot pass because P1 can fulfill the wish!
  assertThrowsUserException(
    static fn() => callAction($game, P1, 'pass', ['onlyOnce' => true]),
    'grant the Mahjong Wish',
    'P1 must not be allowed to pass when holding a playable 9'
  );

  // 2. P1 cannot play a 10 or Phoenix instead of the wished 9!
  $tenId = (string) \LocalTichuScenarios::getCardId(2, 10);
  assertThrowsUserException(
    static fn() => callAction($game, P1, 'playCombo', ['cards' => $tenId]),
    'grant the Mahjong Wish',
    'P1 must not be allowed to play a 10 when holding a playable 9'
  );

  // 2b. P1 CAN play a non-wished bomb (2-3-4-5-6 Stars) on their turn over Mahjong (Option A),
  // leaving mahjongWish active at 9!
  $nonWishedBombIds = \LocalTichuScenarios::getCardIds([[2, 2], [2, 3], [2, 4], [2, 5], [2, 6]]);
  callAction($game, P1, 'playCombo', ['cards' => implode(';', $nonWishedBombIds)]);
  assertSameVal(9, (int) $game->getGameStateValue('mahjongWish'), 'Non-wished bomb must leave mahjongWish active at 9');
  assertSameVal((string) P2, $game->getActivePlayerId(), 'Turn should advance to P2 after P1 plays non-wished bomb');

  // 3. Re-setup mahjong_wish: P1 plays the 9 -> fulfills wish and resets mahjongWish to 0!
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  callAction($game, P0, 'makeAWish', ['wish' => 9]);
  $nineId = (string) \LocalTichuScenarios::getCardId(1, 9);
  callAction($game, P1, 'playCombo', ['cards' => $nineId]);

  assertSameVal(0, (int) $game->getGameStateValue('mahjongWish'), 'mahjongWish should reset to 0 once fulfilled');
  assertSameVal((string) P2, $game->getActivePlayerId(), 'Turn should advance to P2');

  // 4. Verify a player with [A2, A3, A5, A6, A7, A8, A9, AJ] when wish = 11 and lastCombo = Ace
  // is allowed to pass (not deadlocked by getWishHighestBomb index vs length bug)
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[4, 1], [2, 2]],
    P1 => [[2, 14], [2, 3]],
    P2 => [[1, 2], [1, 3], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [1, 11]],
    P3 => [[3, 2], [3, 3]],
  ], 'captured_p0');
  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  callAction($game, P0, 'makeAWish', ['wish' => 11]);
  $aceStarsId = (string) \LocalTichuScenarios::getCardId(2, 14);
  callAction($game, P1, 'playCombo', ['cards' => $aceStarsId]);
  assertSameVal((string) P2, $game->getActivePlayerId(), 'Turn should advance to P2 after P1 plays Ace');
  callAction($game, P2, 'pass', ['onlyOnce' => true]);
  assertSameVal((string) P3, $game->getActivePlayerId(), 'P2 must be allowed to pass when 5-9 straight flush does not contain wished Jack (11)');

  // 5. Verify a player holding both a bomb with the wished rank (four 11s) and a bomb without it (4-8 Stars)
  // when lastCombo = Ace still cannot pass, CAN play the non-wished bomb (leaving wish active),
  // and playing the wished bomb clears mahjongWish to 0.
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[2, 2]],
    P1 => [[2, 3]],
    P2 => [[3, 2]],
    P3 => [[1, 11], [2, 11], [3, 11], [4, 11], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8]],
  ], 'captured_p0');
  assertThrowsUserException(
    static fn() => callAction($game, P3, 'pass', ['onlyOnce' => true]),
    'grant the Mahjong Wish',
    'P3 still must not pass when holding a bomb that fulfills the wish'
  );
  $nonWishedBomb2 = \LocalTichuScenarios::getCardIds([[2, 4], [2, 5], [2, 6], [2, 7], [2, 8]]);
  callAction($game, P3, 'playCombo', ['cards' => implode(';', $nonWishedBomb2)]);
  assertSameVal(11, (int) $game->getGameStateValue('mahjongWish'), 'Playing a non-wished bomb must keep mahjongWish active at 11');

  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[4, 1], [2, 2]],
    P1 => [[2, 14], [2, 3]],
    P2 => [[3, 2], [3, 3]],
    P3 => [[1, 11], [2, 11], [3, 11], [4, 11], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8]],
  ], 'captured_p0');
  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  callAction($game, P0, 'makeAWish', ['wish' => 11]);
  $aceStarsId = (string) \LocalTichuScenarios::getCardId(2, 14);
  callAction($game, P1, 'playCombo', ['cards' => $aceStarsId]);
  callAction($game, P2, 'pass', ['onlyOnce' => true]);
  $wishedBomb = \LocalTichuScenarios::getCardIds([[1, 11], [2, 11], [3, 11], [4, 11]]);
  callAction($game, P3, 'playCombo', ['cards' => implode(';', $wishedBomb)]);
  assertSameVal(0, (int) $game->getGameStateValue('mahjongWish'), 'Playing the wished bomb of Jacks should grant the wish');

  // 6. Verify wish = 15 ("No wish") clears wish and allows next player holding a 9 to pass cleanly
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  assertSameVal('mahjongPlay', $game->gamestate->state(P0)['name'], 'Playing Mahjong should enter mahjongPlay state');

  callAction($game, P0, 'makeAWish', ['wish' => 15]);
  assertSameVal(0, (int) $game->getGameStateValue('mahjongWish'), 'wish=15 should keep mahjongWish global at 0');
  $noWishLog = \LogManager::getLastAction('mahjongWish', false);
  assertTrueVal($noWishLog !== null && (int) ($noWishLog['arg']['wish'] ?? 0) === 15, 'mahjongWish=15 should be recorded in actionlog');

  assertSameVal('playCombo', $game->gamestate->state(P1)['name'], 'After wish=15, state should advance to playCombo');
  assertSameVal((string) P1, $game->getActivePlayerId(), 'P1 should be active after wish=15');
  callAction($game, P1, 'pass', ['onlyOnce' => true]);
  assertSameVal((string) P2, $game->getActivePlayerId(), 'P1 must be allowed to pass when wish=15 (no wish)');

  // 7. Out-of-turn playBomb -> ST_PLAY_BOMB -> playCombo with a non-wished bomb succeeds even while holding the wished card
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[4, 1], [1, 2]],
    P1 => [[1, 14], [1, 3]],
    P2 => [[1, 9], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6]],
    P3 => [[3, 2], [3, 3], [3, 4], [3, 5]],
  ], 'captured_p0');
  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  callAction($game, P0, 'makeAWish', ['wish' => 9]);
  assertSameVal((string) P1, $game->getActivePlayerId(), 'P1 should be active before P2 out-of-turn bomb');

  callAction($game, P2, 'playBomb', ['cards' => '']);
  assertSameVal('playBomb', $game->gamestate->state(P2)['name'], 'Out-of-turn playBomb should enter ST_PLAY_BOMB');
  $outOfTurnNonWishBomb = \LocalTichuScenarios::getCardIds([[2, 2], [2, 3], [2, 4], [2, 5], [2, 6]]);
  callAction($game, P2, 'playCombo', ['cards' => implode(';', $outOfTurnNonWishBomb)]);
  assertSameVal(9, (int) $game->getGameStateValue('mahjongWish'), 'Out-of-turn non-wished bomb must leave mahjongWish active at 9');
  assertSameVal((string) P3, $game->getActivePlayerId(), 'Turn should advance to P3 after P2 plays non-wished bomb');

  // 8. Leading a new trick (playComboOpen) with a non-wished bomb while holding wished rank still requires fulfilling wish (Option A)
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[4, 1], [1, 2]],
    P1 => [[1, 14], [1, 3]],
    P2 => [[1, 9], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [1, 7], [2, 7], [3, 7], [4, 7]],
    P3 => [[3, 2], [3, 3]],
  ], 'captured_p0');
  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  callAction($game, P0, 'makeAWish', ['wish' => 9]);
  $aceSwordsId = (string) \LocalTichuScenarios::getCardId(1, 14);
  callAction($game, P1, 'playCombo', ['cards' => $aceSwordsId]);
  $p2SfBomb = \LocalTichuScenarios::getCardIds([[2, 2], [2, 3], [2, 4], [2, 5], [2, 6]]);
  callAction($game, P2, 'playCombo', ['cards' => implode(';', $p2SfBomb)]);
  assertSameVal('confirmTrick', $game->gamestate->state(P2)['name'], 'P2 should enter confirmTrick after P3/P0/P1 (<4 cards) auto-pass');
  callAction($game, P2, 'collect', []);
  assertSameVal('playComboOpen', $game->gamestate->state(P2)['name'], 'P2 should lead the next trick in playComboOpen');
  assertSameVal((string) P2, $game->getActivePlayerId(), 'P2 should be active leader in playComboOpen');
  assertSameVal(9, (int) $game->getGameStateValue('mahjongWish'), 'mahjongWish should still be 9 on new trick lead');

  $p2LeadBomb = \LocalTichuScenarios::getCardIds([[1, 7], [2, 7], [3, 7], [4, 7]]);
  assertThrowsUserException(
    static fn() => callAction($game, P2, 'playCombo', ['cards' => implode(';', $p2LeadBomb)]),
    'grant the Mahjong Wish',
    'Leading a fresh trick with a non-wished bomb while holding wished 9 must still require fulfilling the wish (Option A)'
  );
  $p2NineId = (string) \LocalTichuScenarios::getCardId(1, 9);
  callAction($game, P2, 'playCombo', ['cards' => $p2NineId]);
  assertSameVal(0, (int) $game->getGameStateValue('mahjongWish'), 'Leading the wished 9 must fulfill and reset mahjongWish to 0');
}

// ============================================================================
// Test 5: test_dog_lead_transfer_and_restrictions
// ============================================================================
function test_dog_lead_transfer_and_restrictions(): void
{
  $game = new \Tichu();
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);

  // Move Dog (3, 1) into P1's hand and (3, 9) into P3's hand so we can test playing Dog mid-trick (illegal)
  $dogId = (string) \LocalTichuScenarios::getCardId(3, 1);
  $twoId = (string) \LocalTichuScenarios::getCardId(1, 2);
  \APP_DbObject::DbQuery("UPDATE card SET card_location = 'hand', card_location_arg = " . P1 . " WHERE card_id = $dogId");

  // P0 leads a single 2
  callAction($game, P0, 'playCombo', ['cards' => $twoId]);
  assertSameVal('playCombo', $game->gamestate->state()['name']);
  assertSameVal((string) P1, $game->getActivePlayerId());

  // P1 tries to play the Dog on top of P0's single 2 -> must throw UserException
  assertThrowsUserException(
    static fn() => callAction($game, P1, 'playCombo', ['cards' => $dogId]),
    'Dog can only be played as a lead',
    'Dog cannot be played in ST_PLAY_COMBO on top of a trick'
  );

  // Now reset to playComboOpen with Dog in P0's hand
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  $dogId = (string) \LocalTichuScenarios::getCardId(3, 1);
  \APP_DbObject::DbQuery("UPDATE card SET card_location = 'hand', card_location_arg = " . P0 . " WHERE card_id = $dogId");

  // P0 leads the Dog -> skips P1 and gives playComboOpen lead to partner P2!
  callAction($game, P0, 'playCombo', ['cards' => $dogId]);
  $state = $game->gamestate->state(P2);
  assertSameVal('playComboOpen', $state['name'], 'Playing Dog must transition to playComboOpen');
  assertSameVal((string) P2, $state['active_player'], 'Dog played by P0 must transfer lead to partner P2');

  // Verify no one can bomb the Dog while it's the last combo
  assertThrowsUserException(
    static fn() => callAction($game, P1, 'playBomb', ['cards' => '']),
    'can\'t play a bomb right now',
    'Cannot bomb during playComboOpen after Dog'
  );

  // Also test Dog when partner P2 has 0 cards in hand -> transfers lead to P3!
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  $dogId = (string) \LocalTichuScenarios::getCardId(3, 1);
  \APP_DbObject::DbQuery("UPDATE card SET card_location = 'captured', card_location_arg = " . P0 . " WHERE card_location = 'hand' AND card_location_arg = " . P2);
  \APP_DbObject::DbQuery("UPDATE card SET card_location = 'hand', card_location_arg = " . P0 . " WHERE card_id = $dogId");
  $game->gamestate->changeActivePlayer(P0);
  callAction($game, P0, 'playCombo', ['cards' => $dogId]);
  assertSameVal('playComboOpen', $game->gamestate->state()['name']);
  assertSameVal((string) P3, $game->getActivePlayerId(), 'When partner P2 has no cards, Dog transfers lead to P3');
}

// ============================================================================
// Test 6: test_phoenix_single_and_ambiguous_combo_choice_and_cancel
// ============================================================================
function test_phoenix_single_and_ambiguous_combo_choice_and_cancel(): void
{
  $game = new \Tichu();

  // Part A: Ambiguous 5-card straight with Phoenix ([5, 6, 7, 8, Phoenix] -> 9 or 4)
  $payload = \LocalTichuScenarios::setupScenario($game, 'phoenix_ambiguous', P0);
  assertSameVal('playComboOpen', $payload['gamestate']['name']);

  $runIds = \LocalTichuScenarios::getCardIds([
    [2, 1], // Phoenix
    [1, 5],
    [2, 6],
    [3, 7],
    [4, 8],
  ]);

  callAction($game, P0, 'playCombo', ['cards' => implode(';', $runIds)]);
  $state = $game->gamestate->state(P0);
  assertSameVal('phoenixPlay', $state['name'], 'Ambiguous Phoenix straight should enter phoenixPlay');
  assertSameVal([9, 4], $state['args']['_private']['values'] ?? [], 'Allowed Phoenix values should be [9, 4]');

  // Test cancelPhoenix -> returns to playComboOpen and keeps cards in P0's hand
  callAction($game, P0, 'cancelPhoenix');
  $stateAfterCancel = $game->gamestate->state(P0);
  assertSameVal('playComboOpen', $stateAfterCancel['name'], 'cancelPhoenix on opening lead should return to playComboOpen');
  assertSameVal(14, (int) \CardManager::getDeck()->countCardInLocation('hand', P0), 'P0 should still have all 14 cards');

  // Play the ambiguous run again and choose Phoenix = 9
  callAction($game, P0, 'playCombo', ['cards' => implode(';', $runIds)]);
  assertSameVal('phoenixPlay', $game->gamestate->state(P0)['name']);

  // Invalid choice (e.g. 11) must throw UserException
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'choosePhoenix', ['phoenixValue' => 11]),
    'invalid value for the phoenix',
    'Choosing disallowed Phoenix value 11 should fail'
  );

  // Valid choice (9) completes the combo and advances to P1 in playCombo
  callAction($game, P0, 'choosePhoenix', ['phoenixValue' => 9]);
  $stateAfterChoose = $game->gamestate->state(P1);
  assertSameVal('playCombo', $stateAfterChoose['name'], 'After choosePhoenix(9), state should be playCombo');
  assertSameVal((string) P1, $stateAfterChoose['active_player'], 'P1 should be active');
  $lastCombo = \LogManager::getLastCombo();
  assertSameVal('Run of 5 cards from 5 to 9', $lastCombo->description);
  assertSameVal(9, $lastCombo->phoenixValue);

  // Part B: Phoenix played as a single card (1.5 when led, or lastCard + 0.5 in playCombo)
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  $tenSwordsId = (string) \LocalTichuScenarios::getCardId(1, 10);
  $phoenixId = (string) \LocalTichuScenarios::getCardId(2, 1);
  $tenPagodasId = (string) \LocalTichuScenarios::getCardId(3, 10);
  $jackPagodasId = (string) \LocalTichuScenarios::getCardId(3, 11);

  // P0 leads 10 Swords
  callAction($game, P0, 'playCombo', ['cards' => $tenSwordsId]);
  // P1 plays Phoenix single -> worth 10.5
  callAction($game, P1, 'playCombo', ['cards' => $phoenixId]);
  $phxSingleCombo = \LogManager::getLastCombo();
  assertSameVal(10.5, (float) $phxSingleCombo->phoenixValue, 'Phoenix on a 10 should have value 10.5');
  assertSameVal('Phoenix a half step above 10', $phxSingleCombo->description);

  // P2 cannot beat 10.5 with a 10
  assertThrowsUserException(
    static fn() => callAction($game, P2, 'playCombo', ['cards' => $tenPagodasId]),
    "can't beat the last combo",
    'A 10 cannot beat Phoenix at 10.5'
  );

  // P2 CAN beat 10.5 with a Jack (11)
  callAction($game, P2, 'playCombo', ['cards' => $jackPagodasId]);
  assertSameVal((string) P3, $game->getActivePlayerId());

  // Part C: Playing [4, 5, 6, 7, PH] over a 3-4-5-6-7 straight -> auto-resolves Phoenix to 8 (4-5-6-7-8) without ST_PHOENIX_PLAY
  \LocalTichuScenarios::setupScenario($game, 'phoenix_ambiguous', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 3], [2, 4], [3, 5], [4, 6], [1, 7], [1, 2]],
    P1 => [[1, 4], [2, 5], [3, 6], [4, 7], [2, 1], [2, 2]],
    P2 => [[4, 5], [1, 6], [2, 7], [3, 8], [4, 9], [3, 2]],
    P3 => [[4, 2], [4, 3]],
  ], 'captured_p0');
  $p0Straight3to7 = \LocalTichuScenarios::getCardIds([[1, 3], [2, 4], [3, 5], [4, 6], [1, 7]]);
  callAction($game, P0, 'playCombo', ['cards' => implode(';', $p0Straight3to7)]);
  assertSameVal('playCombo', $game->gamestate->state()['name']);
  assertSameVal((string) P1, $game->getActivePlayerId());

  $p1Straight4to7Phx = \LocalTichuScenarios::getCardIds([[1, 4], [2, 5], [3, 6], [4, 7], [2, 1]]);
  callAction($game, P1, 'playCombo', ['cards' => implode(';', $p1Straight4to7Phx)]);
  assertSameVal('playCombo', $game->gamestate->state()['name'], 'Playing [4,5,6,7,PH] over 3-4-5-6-7 should auto-resolve to 4-5-6-7-8 without phoenixPlay');
  assertSameVal((string) P2, $game->getActivePlayerId(), 'Turn should advance directly to P2');
  $resolvedCombo = \LogManager::getLastCombo();
  assertSameVal(8, (int) $resolvedCombo->phoenixValue, 'Phoenix should auto-resolve to 8');
  assertSameVal('Run of 5 cards from 4 to 8', $resolvedCombo->description);

  // Part D: Playing [4, 5, 6, 7, PH] over a 2-3-4-5-6 straight -> enters ST_PHOENIX_PLAY because both 3-4-5-6-7 and 4-5-6-7-8 beat it
  \LocalTichuScenarios::setupScenario($game, 'phoenix_ambiguous', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [1, 9]],
    P1 => [[1, 4], [2, 5], [3, 6], [4, 7], [2, 1], [2, 9]],
    P2 => [[4, 5], [1, 6], [2, 7], [3, 8], [4, 9], [3, 2]],
    P3 => [[4, 2], [4, 3]],
  ], 'captured_p0');
  $p0Straight2to6 = \LocalTichuScenarios::getCardIds([[1, 2], [1, 3], [2, 4], [3, 5], [4, 6]]);
  $p1Straight4to7Phx = \LocalTichuScenarios::getCardIds([[1, 4], [2, 5], [3, 6], [4, 7], [2, 1]]);
  callAction($game, P0, 'playCombo', ['cards' => implode(';', $p0Straight2to6)]);
  callAction($game, P1, 'playCombo', ['cards' => implode(';', $p1Straight4to7Phx)]);
  $stateBothBeat = $game->gamestate->state(P1);
  assertSameVal('phoenixPlay', $stateBothBeat['name'], 'Playing [4,5,6,7,PH] over 2-3-4-5-6 must enter phoenixPlay because both 3..7 and 4..8 beat 2..6');
  assertSameVal([8, 3], $stateBothBeat['args']['_private']['values'] ?? []);
  callAction($game, P1, 'choosePhoenix', ['phoenixValue' => 3]);
  assertSameVal('playCombo', $game->gamestate->state()['name']);
  assertSameVal('Run of 5 cards from 3 to 7', \LogManager::getLastCombo()->description);

  // Part E: Ambiguous Phoenix combo violating an active Mahjong wish when player can fulfill the wish -> throws UserException before ST_PHOENIX_PLAY
  \LocalTichuScenarios::setupScenario($game, 'phoenix_ambiguous', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 4], [2, 5], [3, 6], [4, 7], [2, 1], [1, 9]],
    P1 => [[2, 2], [2, 3]],
    P2 => [[3, 2], [3, 3]],
    P3 => [[4, 2], [4, 3]],
  ], 'captured_p0');
  $p0Straight4to7Phx = \LocalTichuScenarios::getCardIds([[1, 4], [2, 5], [3, 6], [4, 7], [2, 1]]);
  $game->setGameStateValue('mahjongWish', 9);
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'playCombo', ['cards' => implode(';', $p0Straight4to7Phx)]),
    'Mahjong Wish',
    'Ambiguous Phoenix combo that ignores executable Mahjong wish must throw UserException before entering phoenixPlay'
  );
  assertSameVal('playComboOpen', $game->gamestate->state()['name'], 'State must remain playComboOpen after Mahjong wish rejection');

  // Part F: cancelPhoenix() after a DOG_COMBO lead returns to ST_PLAY_COMBO_OPEN (playComboOpen), not ST_PLAY_COMBO
  \LocalTichuScenarios::setupScenario($game, 'phoenix_ambiguous', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[3, 1], [1, 2]],
    P1 => [[2, 2], [2, 3]],
    P2 => [[1, 4], [2, 5], [3, 6], [4, 7], [2, 1], [3, 9]],
    P3 => [[4, 2], [4, 3]],
  ], 'captured_p0');
  $dogCardId = (string) \LocalTichuScenarios::getCardId(3, 1);
  $p2Straight4to7Phx = \LocalTichuScenarios::getCardIds([[1, 4], [2, 5], [3, 6], [4, 7], [2, 1]]);
  callAction($game, P0, 'playCombo', ['cards' => $dogCardId]);
  assertSameVal('playComboOpen', $game->gamestate->state()['name']);
  assertSameVal((string) P2, $game->getActivePlayerId());

  callAction($game, P2, 'playCombo', ['cards' => implode(';', $p2Straight4to7Phx)]);
  assertSameVal('phoenixPlay', $game->gamestate->state()['name']);
  callAction($game, P2, 'cancelPhoenix');
  assertSameVal('playComboOpen', $game->gamestate->state()['name'], 'cancelPhoenix after Dog lead must return to playComboOpen');
  assertSameVal((string) P2, $game->getActivePlayerId());

  // Part G: Bug #257052 — 7-10 same-suit + Phoenix chosen via string '11' stays a 7-J straight and is beaten by 8-Q
  \LocalTichuScenarios::setupScenario($game, 'phoenix_ambiguous', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[3, 7], [3, 8], [3, 9], [3, 10], [2, 1], [1, 2]],
    P1 => [[1, 8], [2, 9], [4, 10], [1, 11], [2, 12], [2, 2]],
    P2 => [[3, 2], [1, 3], [2, 4], [3, 5], [4, 6]],
    P3 => [[4, 2], [2, 3], [3, 4], [4, 5], [1, 6]],
  ], 'captured_p0');
  $blue7to10Phx = \LocalTichuScenarios::getCardIds([[3, 7], [3, 8], [3, 9], [3, 10], [2, 1]]);
  callAction($game, P0, 'playCombo', ['cards' => implode(';', $blue7to10Phx)]);
  $stateBug = $game->gamestate->state(P0);
  assertSameVal('phoenixPlay', $stateBug['name'], '4 blue straight cards + Phoenix must enter phoenixPlay');
  assertSameVal([11, 6], $stateBug['args']['_private']['values'] ?? []);

  // Pass phoenixValue as string '11' just like HTTP query parameters on BGA
  callAction($game, P0, 'choosePhoenix', ['phoenixValue' => '11']);
  assertSameVal('playCombo', $game->gamestate->state()['name']);
  assertSameVal((string) P1, $game->getActivePlayerId());
  $lastComboBug = \LogManager::getLastCombo();
  assertSameVal(STRAIGHT_COMBO, $lastComboBug->type, '4 same-suit cards + Phoenix must be STRAIGHT_COMBO, not BOMB_COMBO');
  assertSameVal(11, $lastComboBug->phoenixValue, 'choosePhoenix("11") must persist strict integer 11');
  assertSameVal(7, $lastComboBug->getFirstValue(), '7-J straight with Phoenix=11 must have firstValue 7');

  $payloadP1 = $game->getFullClientPayload(P1);
  assertSameVal(11, $payloadP1['lastCombo']['phoenixValue'] ?? null, 'getAllDatas lastCombo phoenixValue must be strict int 11');
  assertSameVal(11, $payloadP1['allLastCombos'][P0]['phoenixValue'] ?? null, 'getAllDatas allLastCombos phoenixValue must be strict int 11');

  // Legacy actionlog rows storing "phoenixValue":"11" as a string must also normalize to strict int 11
  \APP_DbObject::DbQuery(
    "UPDATE actionlog SET log_arg = REPLACE(log_arg, '\"phoenixValue\":11', '\"phoenixValue\":\"11\"') WHERE log_action = 'combo'"
  );
  assertSameVal(11, \LogManager::getLastCombo()->phoenixValue, 'Legacy string phoenixValue in actionlog must normalize to int 11');
  $legacyPayloadP1 = $game->getFullClientPayload(P1);
  assertSameVal(11, $legacyPayloadP1['lastCombo']['phoenixValue'] ?? null, 'Legacy getAllDatas lastCombo phoenixValue must normalize to int 11');
  assertSameVal(11, $legacyPayloadP1['allLastCombos'][P0]['phoenixValue'] ?? null, 'Legacy getAllDatas allLastCombos phoenixValue must normalize to int 11');

  // P1 beats 7-J with 8-Q
  $p1Straight8toQ = \LocalTichuScenarios::getCardIds([[1, 8], [2, 9], [4, 10], [1, 11], [2, 12]]);
  callAction($game, P1, 'playCombo', ['cards' => implode(';', $p1Straight8toQ)]);
  assertSameVal('playCombo', $game->gamestate->state()['name']);
  assertSameVal((string) P2, $game->getActivePlayerId());
  assertSameVal('Run of 5 cards from 8 to Queen', \LogManager::getLastCombo()->description);
}

// ============================================================================
// Test 7: test_bomb_out_of_turn_interrupt_cancel_and_play
// ============================================================================
function test_bomb_out_of_turn_interrupt_cancel_and_play(): void
{
  $game = new \Tichu();
  $payload = \LocalTichuScenarios::setupScenario($game, 'bomb_interrupt', P0);

  assertSameVal('playCombo', $payload['gamestate']['name'], 'bomb_interrupt should start in playCombo');
  assertSameVal((string) P1, $payload['gamestate']['active_player'], 'P1 should be active after P0 played Ace');

  // Out-of-turn P2 interrupts with playBomb
  callAction($game, P2, 'playBomb', ['cards' => '']);
  $bombState = $game->gamestate->state(P2);
  assertSameVal('playBomb', $bombState['name'], 'playBomb should transition to ST_PLAY_BOMB (61)');
  assertSameVal((string) P2, $bombState['active_player'], 'P2 should now be the active player in playBomb');

  // P2 cancels the bomb interrupt -> returns to playCombo with P1 active!
  callAction($game, P2, 'cancel');
  $restoredState = $game->gamestate->state(P1);
  assertSameVal('playCombo', $restoredState['name'], 'Cancelling playBomb should restore playCombo');
  assertSameVal((string) P1, $restoredState['active_player'], 'P1 should be restored as active player');

  // P2 interrupts with playBomb again
  callAction($game, P2, 'playBomb', ['cards' => '']);
  assertSameVal('playBomb', $game->gamestate->state()['name']);

  // Playing a non-bomb in playBomb state must fail
  $nonBombId = (string) \LocalTichuScenarios::getCardId(3, 5);
  assertThrowsUserException(
    static fn() => callAction($game, P2, 'playCombo', ['cards' => $nonBombId]),
    'not a valid bomb',
    'Playing a single in playBomb state must throw UserException'
  );

  // P2 plays the 4-of-a-kind Bomb of four 7s
  $sevenBombIds = \LocalTichuScenarios::getCardIds([
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
  ]);
  callAction($game, P2, 'playCombo', ['cards' => implode(';', $sevenBombIds)]);

  assertSameVal(1.0, (float) $game->getStat('bomb_number', P2), 'P2 bomb_number stat should be 1');
  $afterBombState = $game->gamestate->state();
  assertSameVal('playCombo', $afterBombState['name'], 'After playing bomb, state should be playCombo');
  assertSameVal((string) P3, $afterBombState['active_player'], 'Turn after P2 bomb should advance to P3');

  // Now P0 interrupts out-of-turn with a higher Bomb of four 8s to beat P2's Bomb of four 7s!
  $eightBombIds = \LocalTichuScenarios::getCardIds([
    [1, 8],
    [2, 8],
    [3, 8],
    [4, 8],
  ]);
  callAction($game, P0, 'playBomb', ['cards' => '']);
  callAction($game, P0, 'playCombo', ['cards' => implode(';', $eightBombIds)]);
  assertSameVal(1.0, (float) $game->getStat('bomb_number', P0), 'P0 bomb_number stat should be 1');
  assertSameVal((string) P1, $game->getActivePlayerId(), 'Turn after P0 bomb should advance to P1');
}

// ============================================================================
// Test 8: test_dragon_trick_win_and_choose_dragon_gift
// ============================================================================
function test_dragon_trick_win_and_choose_dragon_gift(): void
{
  $game = new \Tichu();
  $payload = \LocalTichuScenarios::setupScenario($game, 'dragon_gift', P0);

  assertSameVal('playCombo', $payload['gamestate']['name']);
  assertSameVal((string) P3, $payload['gamestate']['active_player'], 'P3 should be active in dragon_gift scenario');
  assertSameVal(35, (int) $payload['currentTrickValue'], 'Current trick value should be 35 (King 10 + Dragon 25)');

  // P3 passes -> all 3 other players have passed on P0's Dragon -> enters confirmTrick with P0 active!
  callAction($game, P3, 'pass', ['onlyOnce' => true]);
  $confirmState = $game->gamestate->state(P0);
  assertSameVal('confirmTrick', $confirmState['name'], 'Should enter confirmTrick after P3 passes');
  assertSameVal((string) P0, $confirmState['active_player'], 'P0 (Dragon player) should be active in confirmTrick');

  // P0 collects the trick -> since Dragon won, transitions to chooseDragonGift!
  callAction($game, P0, 'collect');
  $giftState = $game->gamestate->state(P0);
  assertSameVal('chooseDragonGift', $giftState['name'], 'Collecting a Dragon trick must enter chooseDragonGift');
  assertSameVal((string) P0, $giftState['active_player']);
  assertSameVal(['dashwood1', 'dashwood3'], $giftState['args']['enemies'] ?? [], 'Enemies should be dashwood1 and dashwood3');

  // P0 gives the 35-point Dragon trick to enemy index 1 (dashwood3 = P3)
  callAction($game, P0, 'chooseDragonGift', ['player' => 1]);

  $afterGiftPayload = $game->getFullClientPayload(P0);
  assertSameVal('playComboOpen', $afterGiftPayload['gamestate']['name'], 'Should start a new trick after gifting Dragon');
  assertSameVal((string) P0, $afterGiftPayload['gamestate']['active_player'], 'P0 won the trick and leads the next trick');
  assertSameVal(35, (int) $afterGiftPayload['capturedpoints'][P3], 'P3 should have 35 captured points from the Dragon gift');
  assertSameVal(0, (int) $afterGiftPayload['capturedpoints'][P0], 'P0 should have 0 captured points');
  assertSameVal(1.0, (float) $game->getStat('tricks_win', P0), 'P0 tricks_win stat should be 1');
  $dragonLog = \LogManager::getLastAction('chooseDragonGift', false);
  assertTrueVal($dragonLog !== null && (int) ($dragonLog['arg']['recipient'] ?? 0) === P3 && (int) ($dragonLog['arg']['trickValue'] ?? 0) === 35, 'chooseDragonGift should record recipient and trickValue in actionlog');
}

// ============================================================================
// Test 9: test_autopass_once_trick_and_cancel_plus_turn_based_smart_skip
// ============================================================================
function test_autopass_once_trick_and_cancel_plus_turn_based_smart_skip(): void
{
  $game = new \Tichu();

  // Part A: Autopass Once (1), Autopass Trick (2), and cancelAutopass (0)
  \LocalTichuScenarios::setupScenario($game, 'bomb_interrupt', P0);
  // In bomb_interrupt, P0 just played Ace and P1 is active in playCombo.
  assertSameVal((string) P1, $game->getActivePlayerId());

  // Out-of-turn P2 sets autopass once (onlyOnce = true -> pass = 1)
  callAction($game, P2, 'pass', ['onlyOnce' => true]);
  assertSameVal('1', (string) \PlayerManager::getPlayer(P2)['pass'], 'P2 pass column should be 1 (AUTOPASS_ONCE)');

  // Out-of-turn P3 sets autopass trick (onlyOnce = false -> pass = 2), cancels it, then sets it again
  callAction($game, P3, 'pass', ['onlyOnce' => false]);
  assertSameVal('2', (string) \PlayerManager::getPlayer(P3)['pass'], 'P3 pass column should be 2 (AUTOPASS_TRICK)');
  callAction($game, P3, 'cancelAutopass');
  assertSameVal('0', (string) \PlayerManager::getPlayer(P3)['pass'], 'P3 pass column should be 0 after cancelAutopass');
  callAction($game, P3, 'pass', ['onlyOnce' => false]);
  assertSameVal('2', (string) \PlayerManager::getPlayer(P3)['pass'], 'P3 pass column should be 2 again');

  // Now active player P1 passes -> stNextPlayer auto-passes P2 (resetting P2 pass=0) and P3 (keeping P3 pass=2)
  // and immediately reaches confirmTrick for P0!
  callAction($game, P1, 'pass', ['onlyOnce' => true]);
  assertSameVal('confirmTrick', $game->gamestate->state()['name'], 'Autopass on P2 and P3 should complete the trick to confirmTrick');
  assertSameVal((string) P0, $game->getActivePlayerId(), 'P0 should be active to collect the trick');
  assertSameVal('0', (string) \PlayerManager::getPlayer(P2)['pass'], 'AUTOPASS_ONCE (P2) must reset to 0 after firing once');
  assertSameVal('2', (string) \PlayerManager::getPlayer(P3)['pass'], 'AUTOPASS_TRICK (P3) stays 2 until trick ends');

  // In confirmTrick, non-active player P2 calling pass(true) succeeds and sets AUTOPASS_ONCE (1),
  // whereas active player P0 calling pass(true) in confirmTrick throws UserException
  callAction($game, P2, 'pass', ['onlyOnce' => true]);
  assertSameVal('1', (string) \PlayerManager::getPlayer(P2)['pass'], 'Non-active P2 can set AUTOPASS_ONCE during confirmTrick');
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'pass', ['onlyOnce' => true]),
    'pass',
    'Active player P0 cannot call pass during confirmTrick'
  );

  // Collecting the trick starts a new trick and resets all autopass flags to 0
  $beforeTricksWinP0 = (float) $game->getStat('tricks_win', P0);
  callAction($game, P0, 'collect');
  assertSameVal('playComboOpen', $game->gamestate->state()['name']);
  assertSameVal('0', (string) \PlayerManager::getPlayer(P3)['pass'], 'stNewTrick must reset all autopass flags to 0');
  assertSameVal($beforeTricksWinP0 + 1.0, (float) $game->getStat('tricks_win', P0), 'Collecting a normal trick via collect() must increment tricks_win by 1');

  // Part B: Turn-based smart skip (isAllInfoExposed = 1)
  // In isAllInfoExposed mode, stNextPlayer checks if the combined remaining cards across ALL hands
  // can beat the last combo. Set up hands with 4 cards each (so $handCounts[$pId] >= 4),
  // but no 4-of-a-kind or straight flush across the combined remaining cards!
  \LocalTichuScenarios:: assignPlayerHands(
    [
      P0 => [[1, 1], [1, 2], [1, 3], [1, 4], [1, 6]], // Dragon + 4 singles
      P1 => [[2, 2], [2, 3], [2, 4], [2, 6]],
      P2 => [[3, 2], [3, 3], [3, 4], [3, 6]],
      P3 => [[4, 7], [4, 8], [4, 9], [4, 11]],
    ],
    'captured_p0'
  );
  $dragonId = \LocalTichuScenarios::getCardId(1, 1);
  $game->setGameStateValue('isAllInfoExposed', 1);

  callAction($game, P0, 'playCombo', ['cards' => (string) $dragonId]);
  assertSameVal(
    'confirmTrick',
    $game->gamestate->state()['name'],
    'In isAllInfoExposed mode, playing an unbeatable Dragon with no bombs remaining must smart-skip P1, P2, P3 to confirmTrick'
  );
  assertSameVal((string) P0, $game->getActivePlayerId());

  // Part C: AUTOPASS_ONCE reset when blocked by Mahjong wish
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  $mahjongCardId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongCardId]);
  // Set P1's autopass to AUTOPASS_ONCE (1) before P0 wishes for 9 (which P1 holds)
  \PlayerManager::setAutopass(AUTOPASS_ONCE, P1);
  assertSameVal('1', (string) \PlayerManager::getPlayer(P1)['pass'], 'P1 pass should initially be 1 (AUTOPASS_ONCE)');
  $beforeWishPacketId = (int) \APP_DbObject::getUniqueValueFromDB("SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog");
  callAction($game, P0, 'makeAWish', ['wish' => 9]);
  assertSameVal('playCombo', $game->gamestate->state()['name']);
  assertSameVal((string) P1, $game->getActivePlayerId(), 'P1 must become active because P1 holds the wished 9');
  assertSameVal('0', (string) \PlayerManager::getPlayer(P1)['pass'], 'P1 AUTOPASS_ONCE must reset to 0 when blocked by Mahjong wish');
  $p1WishNotifs = $game->getNotificationsSince($beforeWishPacketId, P1, false);
  $autopassResetNotif = null;
  foreach ($p1WishNotifs as $pkt) {
    if (($pkt['data'][0]['type'] ?? '') === 'autopass') {
      $autopassResetNotif = $pkt['data'][0]['args'];
      break;
    }
  }
  assertTrueVal($autopassResetNotif !== null, 'P1 should receive an autopass notification when AUTOPASS_ONCE is reset');
  assertSameVal(0, (int) ($autopassResetNotif['autopass'] ?? -1), 'autopass notification should have autopass=0');
}

// ============================================================================
// Test 10: test_double_victory_and_normal_round_scoring
// ============================================================================
function test_double_victory_and_normal_round_scoring(): void
{
  $game = new \Tichu();

  // Part A: Double Victory + Tichu / Grand Tichu bonuses
  $payload = \LocalTichuScenarios::setupScenario($game, 'double_victory', P2);
  assertSameVal('playComboOpen', $payload['gamestate']['name']);
  assertSameVal((string) P2, $payload['gamestate']['active_player'], 'P2 should be active in double_victory scenario');
  assertSameVal(P0, (int) $payload['firstoutplayer'], 'P0 should already be firstOutPlayer');

  // Set P0 (firstOutPlayer, Team 0) to have called Tichu (+100) and P1 (Team 1) to have called Grand Tichu (-200)
  \PlayerManager::tichuBet(P0, 100);
  \PlayerManager::grandTichuBet(P1, 200);

  // Advance Round 1 trick counter to 3 before Round 1 ends so we verify global-monotonic
  // DB `log_trick` (rollback compatibility) alongside per-round logical `trick` in Round 2.
  \LogManager::insert(0, 'newTrick');
  \LogManager::insert(0, 'newTrick');

  $beforeDvPacketId = (int) \APP_DbObject::getUniqueValueFromDB("SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog");
  $lastCardId = (string) \LocalTichuScenarios::getCardId(1, 14);
  callAction($game, P2, 'playCombo', ['cards' => $lastCardId]);

  $dvNotifs = $game->getNotificationsSince($beforeDvPacketId, P0, false);
  $p2GoOutNotif = null;
  foreach ($dvNotifs as $pkt) {
    if (($pkt['data'][0]['type'] ?? '') === 'playerGoOut' && (int) ($pkt['data'][0]['args']['player_id'] ?? 0) === P2) {
      $p2GoOutNotif = $pkt['data'][0]['args'];
      break;
    }
  }
  assertTrueVal($p2GoOutNotif !== null, 'Double Victory must still emit playerGoOut notification for the 2nd player out (partner P2)');
  assertSameVal(P0, (int) ($p2GoOutNotif['firstout_id'] ?? 0), 'playerGoOut on Double Victory should reference firstOutPlayer P0');

  // Should score Double Victory (200) + Tichu (100) = 300 for Team 0, and -200 for Team 1, then start Round 2!
  $scores = \PlayerManager::getScores();
  assertSameVal(300, (int) $scores[P0], 'Team 0 (P0) should score 200 (Double Victory) + 100 (Tichu) = 300');
  assertSameVal(300, (int) $scores[P2], 'Team 0 (P2) should score 300');
  assertSameVal(-200, (int) $scores[P1], 'Team 1 (P1) should score -200 (failed Grand Tichu)');
  assertSameVal(-200, (int) $scores[P3], 'Team 1 (P3) should score -200');
  assertSameVal('grandTichuBets', $game->gamestate->state()['name'], 'Game should transition to Round 2 grandTichuBets');
  assertSameVal(2, (int) \LogManager::getCurrentRoundAndTrick()['round'], 'Round counter should now be 2');
  assertSameVal(0, (int) \LogManager::getCurrentRoundAndTrick()['trick'], 'Trick counter should reset to 0 at start of Round 2');

  // Advance Round 2 through grandTichuBets and giveCards into Trick 1 (playComboOpen)
  foreach ([P0, P1, P2, P3] as $pId) {
    callAction($game, $pId, 'grandTichuBet', ['bet' => '0']);
  }
  $deckR2 = \CardManager::getDeck();
  foreach ([P0, P1, P2, P3] as $pId) {
    $handCards = array_values($deckR2->getCardsInLocation('hand', $pId));
    $passIds = [$handCards[0]['id'], $handCards[1]['id'], $handCards[2]['id']];
    callAction($game, $pId, 'giveTheCards', ['cards' => implode(';', $passIds) . ';']);
  }
  assertSameVal('playComboOpen', $game->gamestate->state()['name'], 'Round 2 should advance to playComboOpen');
  assertSameVal(2, (int) \LogManager::getCurrentRoundAndTrick()['round'], 'Round counter should remain 2');
  assertSameVal(1, (int) \LogManager::getCurrentRoundAndTrick()['trick'], 'Round 2 first trick counter should be 1');
  assertSameVal(4, (int) \LogManager::getCurrentDbRoundAndTrick()['trick'], 'Round 2 first trick DB log_trick should stay globally monotonic (4) for rollback safety');
  assertSameVal(
    (int) \APP_DbObject::getUniqueValueFromDB('SELECT MAX(log_trick) FROM actionlog'),
    (int) \LogManager::getCurrentDbRoundAndTrick()['trick'],
    'Unscoped MAX(log_trick) must match current Round 2 Trick 1 DB log_trick'
  );

  // Playing in Round 2 Trick 1 must record combo under log_round=2 and the monotonic MAX(log_trick)
  $activeR2 = (int) $game->getActivePlayerId();
  $r2CardId = (string) array_values($deckR2->getCardsInLocation('hand', $activeR2))[0]['id'];
  callAction($game, $activeR2, 'playCombo', ['cards' => $r2CardId]);
  assertTrueVal(\LogManager::getLastCombo()->type !== NO_COMBO, 'Round 2 Trick 1 combo should be readable via LogManager::getLastCombo()');
  assertSameVal(
    1,
    (int) \APP_DbObject::getUniqueValueFromDB(
      "SELECT COUNT(*) FROM actionlog WHERE log_action = 'combo' AND log_round = 2 AND log_trick = (SELECT MAX(log_trick) FROM actionlog)"
    ),
    'Round 2 Trick 1 combo row must match unscoped MAX(log_round)/MAX(log_trick) query'
  );

  // Part B: Normal Round Scoring (3 players go out, 4th player's captured cards -> firstOutPlayer, hand -> opposing team)
  \LocalTichuScenarios::setupScenario($game, 'double_victory', P2);
  // Make P1 (Team 1) already out as secondOutPlayer (0 cards in hand), while P3 (Team 1) is the 4th player with cards in hand!
  // Move all cards to 'deck' first, then place exact point cards to verify the 100-point partition:
  // - P0 (firstOutPlayer, Team 0) has captured: four 10s = 40 pts
  // - P3 (last player remaining, Team 1) has captured: three Kings = 30 pts (transfers to firstOutPlayer P0 -> Team 0!)
  // - P3 has in hand: Dragon (25 pts) + four 5s (20 pts) = 45 pts (unplayed hand of Team 1 last player -> counts for Team 0!)
  // - P1 (Team 1, already out) has captured: King (10 pts) + Phoenix (-25 pts) = -15 pts
  // - P2 (Team 0, about to go out 3rd) has 1 card in hand: (1, 2) (0 pts)
  // Total Team 0 card points = 40 (P0 cap) + 30 (P3 cap transferred to P0) + 45 (P3 hand) + 0 (P2 trick) = 115 pts!
  // Total Team 1 card points = 100 - 115 = -15 pts (which matches P1's King 10 + Phoenix -25 = -15)!
  \APP_DbObject::DbQuery("UPDATE card SET card_location = 'deck', card_location_arg = 0");

  $p0CapIds = \LocalTichuScenarios::getCardIds([[1, 10], [2, 10], [3, 10], [4, 10]]); // 40 pts
  \CardManager::getDeck()->moveCards($p0CapIds, 'captured', P0);

  $p3CapIds = \LocalTichuScenarios::getCardIds([[1, 13], [2, 13], [3, 13]]); // 30 pts
  \CardManager::getDeck()->moveCards($p3CapIds, 'captured', P3);

  $p1CapIds = \LocalTichuScenarios::getCardIds([[4, 13], [2, 1]]); // 10 - 25 = -15 pts
  \CardManager::getDeck()->moveCards($p1CapIds, 'captured', P1);

  $p3HandIds = \LocalTichuScenarios::getCardIds([[1, 1], [1, 5], [2, 5], [3, 5], [4, 5]]); // 25 + 20 = 45 pts
  \CardManager::getDeck()->moveCards($p3HandIds, 'hand', P3);

  $p2LastId = (string) \LocalTichuScenarios::getCardId(1, 2); // 0 pts
  \CardManager::getDeck()->moveCard($p2LastId, 'hand', P2);

  $game->setGameStateValue('firstOutPlayer', P0);
  $game->setGameStateValue('secondOutPlayer', P1);
  $game->setGameStateValue('doubleVictory', -1);
  $game->gamestate->changeActivePlayer(P2);

  // P2 plays their last card -> goes out 3rd -> only P3 remains in round -> triggers normal stEndRound!
  callAction($game, P2, 'playCombo', ['cards' => $p2LastId]);

  $normalScores = \PlayerManager::getScores();
  assertSameVal(115, (int) $normalScores[P0], 'Team 0 should score 115 points in normal round');
  assertSameVal(115, (int) $normalScores[P2], 'Team 0 partner should score 115 points');
  assertSameVal(-15, (int) $normalScores[P1], 'Team 1 should score -15 points (100 - 115)');
  assertSameVal(-15, (int) $normalScores[P3], 'Team 1 partner should score -15 points');

  // Part C: 3rd player goes out with a Dragon combo ($player_still_in_round == 1) -> tricks_win increases by 1 (not 2)
  \LocalTichuScenarios::setupScenario($game, 'double_victory', P2);
  \APP_DbObject::DbQuery("UPDATE card SET card_location = 'captured', card_location_arg = " . P0);
  $dragonId = (string) \LocalTichuScenarios::getCardId(1, 1);
  $p3RemainingId = (string) \LocalTichuScenarios::getCardId(1, 2);
  \CardManager::getDeck()->moveCard($dragonId, 'hand', P2);
  \CardManager::getDeck()->moveCard($p3RemainingId, 'hand', P3);
  $game->setGameStateValue('firstOutPlayer', P0);
  $game->setGameStateValue('secondOutPlayer', P1);
  $game->setGameStateValue('doubleVictory', -1);
  $game->gamestate->changeActivePlayer(P2);

  $beforeP2TricksWin = (float) $game->getStat('tricks_win', P2);
  callAction($game, P2, 'playCombo', ['cards' => $dragonId]);
  assertSameVal('chooseDragonGift', $game->gamestate->state()['name'], '3rd player going out with Dragon should enter chooseDragonGift');
  callAction($game, P2, 'chooseDragonGift', ['player' => 0]);
  assertSameVal(
    $beforeP2TricksWin + 1.0,
    (float) $game->getStat('tricks_win', P2),
    '3rd player going out with Dragon and gifting must increment tricks_win by 1, not 2'
  );

  // Part D: 3rd player goes out with a pair while 4th player has only 1 card (and autopass enabled) -> no spurious pass notification for 4th player
  \LocalTichuScenarios::setupScenario($game, 'double_victory', P2);
  \APP_DbObject::DbQuery("UPDATE card SET card_location = 'captured', card_location_arg = " . P0);
  $pairIds = \LocalTichuScenarios::getCardIds([[1, 6], [2, 6]]);
  \CardManager::getDeck()->moveCards($pairIds, 'hand', P2);
  \CardManager::getDeck()->moveCard($p3RemainingId, 'hand', P3);
  \PlayerManager::setAutopass(2, P3);
  $game->setGameStateValue('firstOutPlayer', P0);
  $game->setGameStateValue('secondOutPlayer', P1);
  $game->setGameStateValue('doubleVictory', -1);
  $game->gamestate->changeActivePlayer(P2);

  $beforePairPacketId = (int) \APP_DbObject::getUniqueValueFromDB("SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog");
  callAction($game, P2, 'playCombo', ['cards' => implode(';', $pairIds)]);
  $pairNotifs = $game->getNotificationsSince($beforePairPacketId, P0, false);
  $spuriousP3Pass = false;
  foreach ($pairNotifs as $pkt) {
    $notifType = $pkt['data'][0]['type'] ?? '';
    if (($notifType === 'pass' || $notifType === 'passes') && (int) ($pkt['data'][0]['args']['player_id'] ?? 0) === P3) {
      $spuriousP3Pass = true;
    }
  }
  assertTrueVal(!$spuriousP3Pass, '4th player P3 must not emit a spurious pass notification when 3rd player P2 goes out');

  // Part E: 3rd player goes out by playing the Dog as their last card ($player_still_in_round == 1) -> round ends immediately
  \LocalTichuScenarios::setupScenario($game, 'double_victory', P2);
  \APP_DbObject::DbQuery("UPDATE card SET card_location = 'captured', card_location_arg = " . P0);
  $dogCardId = (string) \LocalTichuScenarios::getCardId(3, 1);
  \CardManager::getDeck()->moveCard($dogCardId, 'hand', P2);
  \CardManager::getDeck()->moveCard($p3RemainingId, 'hand', P3);
  $game->setGameStateValue('firstOutPlayer', P0);
  $game->setGameStateValue('secondOutPlayer', P1);
  $game->setGameStateValue('doubleVictory', -1);
  $game->gamestate->changeActivePlayer(P2);

  $beforeDogTricksWin = (float) $game->getStat('tricks_win', P2);
  callAction($game, P2, 'playCombo', ['cards' => $dogCardId]);
  assertSameVal(
    'grandTichuBets',
    $game->gamestate->state()['name'],
    'When 3rd player plays Dog as their last card, the round must end immediately (transitioning to next round grandTichuBets)'
  );
  assertSameVal(
    $beforeDogTricksWin,
    (float) $game->getStat('tricks_win', P2),
    'Playing Dog as last card must not increment tricks_win'
  );
}

// ============================================================================
// Test 11: test_full_multi_round_game_to_completion
// ============================================================================
function test_full_multi_round_game_to_completion(): void
{
  $game = new \Tichu();
  // Start a 500-point game (gameLength = 1)
  $game->createNewGame([
    'gameLength' => 1,
    'playerTeams' => TEAM_1_3,
    'turnBased' => 0,
  ]);

  $maxTotalSteps = 3000;
  $steps = 0;
  $roundsObserved = 1;
  $boostedRound3 = false;

  while ($steps < $maxTotalSteps) {
    $state = $game->gamestate->state();
    $stateId = (int) ($state['id'] ?? 0);
    $stateName = $state['name'] ?? '';

    if ($stateId === ST_GAME_END || $stateName === 'gameEnd') {
      break;
    }

    $curRound = (int) \LogManager::getCurrentRoundAndTrick()['round'];
    $roundsObserved = max($roundsObserved, $curRound);

    // In Round 2+, let P0 bet Grand Tichu in grandTichuBets
    if ($stateName === 'grandTichuBets' && $game->gamestate->isPlayerActive(P0) && $curRound >= 2) {
      callAction($game, P0, 'grandTichuBet', ['bet' => '200']);
      if ($game->gamestate->isPlayerActive(P0)) {
        callAction($game, P0, 'confirmTichu', ['bet' => '200']);
      }
      $steps++;
      continue;
    }

    // By Round 2's opening trick, give P0 a dominant hand (1 card left: Dragon) so P0 wins their Grand Tichu
    // and guarantees reaching >= 500 points within 2-3 full rounds without random-walk flakiness.
    if ($stateName === 'playComboOpen' && $curRound >= 2 && !$boostedRound3) {
      $boostedRound3 = true;
      $dragonId = \LocalTichuScenarios::getCardId(1, 1);
      \APP_DbObject::DbQuery(
        "UPDATE card SET card_location = 'captured', card_location_arg = " .
          P0 .
          " WHERE card_location = 'hand' AND card_location_arg = " .
          P0 .
          " AND card_id != $dragonId"
      );
      \APP_DbObject::DbQuery(
        "UPDATE card SET card_location = 'hand', card_location_arg = " . P0 . " WHERE card_id = $dragonId"
      );
      $game->gamestate->changeActivePlayer(P0);
    }

    // Reset boost flag when a new round starts
    if ($stateName === 'grandTichuBets') {
      $boostedRound3 = false;
    }

    $res = \LocalTichuBot::stepSingleBotTurn($game);
    assertTrueVal(!empty($res['acted']), "Bot should be able to act in state '$stateName' (step $steps)");
    $steps++;
  }

  $finalState = $game->gamestate->state();
  assertSameVal((string) ST_GAME_END, $finalState['id'], "Game should reach ST_GAME_END (99) within $maxTotalSteps steps (took $steps steps)");
  assertSameVal('gameEnd', $finalState['name']);
  assertTrueVal($roundsObserved >= 2, 'Multi-round game should play at least 2 rounds');

  $scores = array_map('intval', \PlayerManager::getScores());
  assertTrueVal(max($scores) >= 500, 'Winning team score must be >= 500 points');
  assertTrueVal(count(array_unique($scores)) > 1, 'Team scores at game end must not be tied');

  // Verify replay gamelogs structure
  $gamelogs = $game->getAllGamelogsForReplay();
  assertTrueVal(count($gamelogs) > 50, 'getAllGamelogsForReplay() should contain full game notification packets');
  $firstPacket = $gamelogs[0];
  assertTrueVal(isset($firstPacket['packet_id'], $firstPacket['move_id'], $firstPacket['channel'], $firstPacket['data']), 'Replay packet must have BGA packet keys');
}

// ============================================================================
// Test 12: test_zombie_turns_across_all_states
// ============================================================================
function test_zombie_turns_across_all_states(): void
{
  global $g_config;
  $game = new \Tichu();

  // 1. grandTichuBets (multipleactiveplayer)
  $game->createNewGame([
    'gameLength' => 1,
    'playerTeams' => TEAM_1_3,
    'turnBased' => 0,
  ]);
  callAction($game, P0, 'grandTichuBet', ['bet' => '0']);
  callAction($game, P1, 'grandTichuBet', ['bet' => '0']);
  callAction($game, P2, 'grandTichuBet', ['bet' => '0']);
  assertSameVal('grandTichuBets', $game->gamestate->state()['name']);

  // Set currentPlayerId to P0 (different from zombie P3)
  $game->setCurrentPlayerId(P0);
  $game->zombieTurn($game->gamestate->state(), P3);

  assertSameVal('0', (string) \PlayerManager::getPlayer(P3)['call_grand_tichu'], 'Zombie P3 should bet 0 in grandTichuBets');
  assertSameVal('giveCards', $game->gamestate->state()['name'], 'After zombie P3 bets in grandTichuBets, game should transition to giveCards');
  $deck = \CardManager::getDeck();
  foreach ([P0, P1, P2, P3] as $pId) {
    assertSameVal(14, (int) $deck->countCardInLocation('hand', $pId), "Player $pId should have 14 cards in giveCards");
  }

  // 2. giveCards (multipleactiveplayer)
  foreach ([P0, P1, P2] as $pId) {
    $handCards = array_values($deck->getCardsInLocation('hand', $pId));
    $passIds = [$handCards[0]['id'], $handCards[1]['id'], $handCards[2]['id']];
    callAction($game, $pId, 'giveTheCards', ['cards' => implode(';', $passIds) . ';']);
  }
  assertSameVal('giveCards', $game->gamestate->state()['name']);

  // Set currentPlayerId to P0 (different from zombie P3)
  $game->setCurrentPlayerId(P0);
  $game->zombieTurn($game->gamestate->state(), P3);

  assertSameVal('playComboOpen', $game->gamestate->state()['name'], 'After zombie P3 gives cards, game should transition to playComboOpen');
  assertSameVal(0, (int) $deck->countCardInLocation('temporary'), 'No cards should remain in temporary after giveCards');
  foreach ([P0, P1, P2, P3] as $pId) {
    assertSameVal(14, (int) $deck->countCardInLocation('hand', $pId), "Player $pId should have 14 cards in playComboOpen");
  }

  // 3a. playComboOpen (activeplayer - normal open lead)
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  assertSameVal('playComboOpen', $game->gamestate->state()['name']);
  assertSameVal((string) P0, $game->getActivePlayerId());

  $beforeOpenPacketId = (int) \APP_DbObject::getUniqueValueFromDB("SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog");
  $game->setCurrentPlayerId(P1);
  $game->zombieTurn($game->gamestate->state(), P0);

  assertSameVal('playCombo', $game->gamestate->state()['name'], 'Zombie P0 playing in playComboOpen should transition to playCombo');
  assertSameVal((string) P1, $game->getActivePlayerId(), 'Turn should advance to P1');
  assertSameVal(13, (int) $deck->countCardInLocation('hand', P0), 'Zombie P0 should have 13 cards left after open lead');
  assertSameVal(1, (int) $deck->countCardInLocation('combos'), '1 card should be in combos');

  $openNotifs = $game->getNotificationsSince($beforeOpenPacketId, P0, false);
  $playNotifArgs = null;
  foreach ($openNotifs as $pkt) {
    if (($pkt['data'][0]['type'] ?? '') === 'playCombo') {
      $playNotifArgs = $pkt['data'][0]['args'];
      break;
    }
  }
  assertTrueVal($playNotifArgs !== null, 'Zombie playComboOpen should emit playCombo notification');
  assertSameVal('dashwood0', $playNotifArgs['player_name'] ?? '', 'playCombo notification must use zombie player name, not currentPlayerId name');

  // 3b. playComboOpen (activeplayer - when Mahjong wish is active and zombie holds the wished rank)
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 2], [2, 9], [3, 12]],
    P1 => [[2, 3], [2, 4]],
    P2 => [[3, 3], [3, 4]],
    P3 => [[4, 3], [4, 4]],
  ], 'captured_p0');
  $game->setGameStateValue('mahjongWish', 9);
  $game->gamestate->changeActivePlayer(P0);

  $game->setCurrentPlayerId(P1);
  $game->zombieTurn($game->gamestate->state(), P0);

  assertSameVal(0, (int) $game->getGameStateValue('mahjongWish'), 'Zombie P0 in playComboOpen holding wished 9 must play it and grant the wish');
  assertSameVal('playCombo', $game->gamestate->state()['name']);
  assertSameVal((string) P1, $game->getActivePlayerId());

  // 3c. playComboOpen (activeplayer - when zombie holds ONLY Phoenix)
  \LocalTichuScenarios::setupScenario($game, 'phoenix_ambiguous', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[2, 1]], // Phoenix only
    P1 => [[1, 5], [1, 6]],
    P2 => [[2, 5], [2, 6]],
    P3 => [[3, 5], [3, 6]],
  ], 'captured_p0');
  $game->gamestate->changeActivePlayer(P0);

  $game->setCurrentPlayerId(P1);
  $game->zombieTurn($game->gamestate->state(), P0);

  $lastPlayedCombo = \LogManager::getLastCombo();
  assertSameVal(SINGLE_COMBO, $lastPlayedCombo->type, 'Zombie holding only Phoenix should lead Single combo');
  assertSameVal(1.5, (float) $lastPlayedCombo->phoenixValue, 'Phoenix lead should have phoenixValue 1.5');
  assertSameVal(0, (int) $deck->countCardInLocation('hand', P0), 'Zombie P0 should have 0 cards in hand after leading only card');
  assertSameVal((int) P0, (int) $game->getGameStateValue('firstOutPlayer'), 'P0 shedding all cards should be firstOutPlayer');
  assertSameVal('playCombo', $game->gamestate->state()['name'], 'Game should transition to playCombo');
  assertSameVal((string) P1, $game->getActivePlayerId(), 'Turn should advance to P1');

  // 4. playCombo (activeplayer)
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  callAction($game, P0, 'makeAWish', ['wish' => 9]);
  assertSameVal('playCombo', $game->gamestate->state()['name']);
  assertSameVal((string) P1, $game->getActivePlayerId());

  // P1 holds (1, 9) in mahjong_wish and MUST fulfill wish when zombieTurn runs in playCombo
  $game->setCurrentPlayerId(P0);
  $game->zombieTurn($game->gamestate->state(), P1);

  assertSameVal(0, (int) $game->getGameStateValue('mahjongWish'), 'Zombie P1 holding wished 9 in playCombo must play it and grant the wish');
  assertSameVal(13, (int) $deck->countCardInLocation('hand', P1), 'Zombie P1 should have 13 cards after fulfilling wish');
  assertSameVal('playCombo', $game->gamestate->state()['name'], 'Game should stay in playCombo after zombie P1 plays 9');
  assertSameVal((string) P2, $game->getActivePlayerId(), 'Active player should now be P2');

  // Now mahjongWish is 0; zombie P2 in playCombo without lead/wish should pass cleanly
  $game->setCurrentPlayerId(P0);
  $game->zombieTurn($game->gamestate->state(), P2);

  assertSameVal('playCombo', $game->gamestate->state()['name'], 'Zombie P2 passing in playCombo should advance to P3 in playCombo');
  assertSameVal((string) P3, $game->getActivePlayerId(), 'Active player should now be P3');

  // 5. mahjongPlay (activeplayer)
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  assertSameVal('mahjongPlay', $game->gamestate->state()['name']);
  assertSameVal((string) P0, $game->getActivePlayerId());

  $game->setCurrentPlayerId(P1);
  $game->zombieTurn($game->gamestate->state(), P0);

  assertSameVal(0, (int) $game->getGameStateValue('mahjongWish'), 'Zombie P0 in mahjongPlay should make no wish (0)');
  assertSameVal('playCombo', $game->gamestate->state()['name'], 'Zombie P0 in mahjongPlay should transition to playCombo');
  assertSameVal((string) P1, $game->getActivePlayerId(), 'Active player after mahjongPlay zombieTurn should be P1');

  // 6. phoenixPlay (activeplayer)
  \LocalTichuScenarios::setupScenario($game, 'phoenix_ambiguous', P0);
  $runIds = \LocalTichuScenarios::getCardIds([
    [2, 1], // Phoenix
    [1, 5],
    [2, 6],
    [3, 7],
    [4, 8],
  ]);
  callAction($game, P0, 'playCombo', ['cards' => implode(';', $runIds)]);
  assertSameVal('phoenixPlay', $game->gamestate->state()['name']);
  assertSameVal((string) P0, $game->getActivePlayerId());

  $game->setCurrentPlayerId(P1);
  $game->zombieTurn($game->gamestate->state(), P0);

  assertSameVal('playCombo', $game->gamestate->state()['name'], 'Zombie P0 in phoenixPlay should resolve Phoenix and transition to playCombo');
  assertSameVal((string) P1, $game->getActivePlayerId(), 'Active player after phoenixPlay zombieTurn should be P1');
  assertSameVal(9, (int) \LogManager::getLastCombo()->phoenixValue, 'Zombie P0 should choose first Phoenix option (9)');

  // 7. playBomb (activeplayer)
  \LocalTichuScenarios::setupScenario($game, 'bomb_interrupt', P0);
  assertSameVal('playCombo', $game->gamestate->state()['name']);
  assertSameVal((string) P1, $game->getActivePlayerId());
  callAction($game, P2, 'playBomb', ['cards' => '']);
  assertSameVal('playBomb', $game->gamestate->state()['name']);
  assertSameVal((string) P2, $game->getActivePlayerId());

  $game->setCurrentPlayerId(P0);
  $game->zombieTurn($game->gamestate->state(), P2);

  assertSameVal('playCombo', $game->gamestate->state()['name'], 'Zombie P2 in playBomb should cancel bomb interrupt and return to playCombo');
  assertSameVal((string) P1, $game->getActivePlayerId(), 'Original active player P1 should be restored after playBomb zombieTurn');

  // 8. confirmTrick (activeplayer)
  \LocalTichuScenarios::setupScenario($game, 'bomb_interrupt', P0);
  callAction($game, P1, 'pass', ['onlyOnce' => true]);
  callAction($game, P2, 'pass', ['onlyOnce' => true]);
  callAction($game, P3, 'pass', ['onlyOnce' => true]);
  assertSameVal('confirmTrick', $game->gamestate->state()['name']);
  assertSameVal((string) P0, $game->getActivePlayerId());

  $beforeConfirmTricksWin = (float) $game->getStat('tricks_win', P0);
  $game->setCurrentPlayerId(P1);
  $game->zombieTurn($game->gamestate->state(), P0);

  assertSameVal('playComboOpen', $game->gamestate->state()['name'], 'Zombie P0 in confirmTrick should collect trick and start new trick');
  assertSameVal((string) P0, $game->getActivePlayerId(), 'P0 should lead the new trick');
  assertSameVal($beforeConfirmTricksWin + 1.0, (float) $game->getStat('tricks_win', P0), 'P0 tricks_win should increment by 1');

  // 8b. First round, first trick: Mahjong owner (P1) does a zombie turn in playComboOpen
  // (keeping Mahjong in hand), P0 wins the trick with Ace, and collects (including duplicate collect guard).
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 14], [1, 2]],
    P1 => [[4, 1], [3, 13]], // Mahjong + King
    P2 => [[2, 3], [2, 4]],
    P3 => [[4, 3], [4, 4]],
  ], 'captured_p0');
  $game->setGameStateValue('mahjongOwner', P1);
  $game->gamestate->changeActivePlayer(P1);
  $game->zombieTurn($game->gamestate->state(), P1); // P1 plays King, keeps Mahjong
  $game->zombieTurn($game->gamestate->state(), P2); // P2 passes
  $game->zombieTurn($game->gamestate->state(), P3); // P3 passes
  $aceId = (string) \LocalTichuScenarios::getCardId(1, 14);
  callAction($game, P0, 'playCombo', ['cards' => $aceId]);
  $game->zombieTurn($game->gamestate->state(), P1); // P1 passes
  $game->zombieTurn($game->gamestate->state(), P2); // P2 passes
  $game->zombieTurn($game->gamestate->state(), P3); // P3 passes
  assertSameVal('confirmTrick', $game->gamestate->state()['name']);
  callAction($game, P0, 'collect');
  // Simulate a duplicate/concurrent collect call (e.g., from a second open browser tab)
  $game->collect(false);
  assertSameVal('playComboOpen', $game->gamestate->state()['name'], 'After Trick 1 collection, state must remain playComboOpen');
  assertSameVal((string) P0, $game->getActivePlayerId(), 'Trick 1 winner P0 (not Mahjong holder P1) must lead Trick 2');
  assertSameVal(2, (int) \LogManager::getCurrentRoundAndTrick()['trick'], 'Trick counter must be 2, not incremented twice');

  // 9. chooseDragonGift (activeplayer)
  \LocalTichuScenarios::setupScenario($game, 'dragon_gift', P0);
  callAction($game, P3, 'pass', ['onlyOnce' => true]);
  assertSameVal('confirmTrick', $game->gamestate->state()['name']);
  callAction($game, P0, 'collect');
  assertSameVal('chooseDragonGift', $game->gamestate->state()['name']);
  assertSameVal((string) P0, $game->getActivePlayerId());

  $game->setCurrentPlayerId(P1);
  $game->zombieTurn($game->gamestate->state(), P0);

  $afterDragonPayload = $game->getFullClientPayload(P0);
  assertSameVal('playComboOpen', $afterDragonPayload['gamestate']['name'], 'Zombie P0 in chooseDragonGift should gift Dragon and start new trick');
  assertSameVal((string) P0, $afterDragonPayload['gamestate']['active_player'], 'P0 should lead the next trick');
  assertSameVal(35, (int) $afterDragonPayload['capturedpoints'][P1], 'Enemy 0 (P1) should receive the 35-point Dragon trick from zombie P0');

  // 10a. End-to-end Production Sentry #808761 regression:
  // Live pass.html -> checkZombieTurn() passes zombie P3 -> confirms trick won by zombie P0 (state 75)
  // -> nested checkZombieTurn() -> zombieTurn(confirmTrick, P0) -> collect(false) -> playComboOpen lead.
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 14], [1, 2], [2, 3]],
    P1 => [[1, 5], [1, 6]],
    P2 => [[2, 5], [2, 6]],
    P3 => [[3, 5], [3, 6]],
  ], 'captured_p0');
  $game->setGameStateValue('mahjongWish', 0);
  $game->gamestate->changeActivePlayer(P0);
  callAction($game, P0, 'playCombo', ['cards' => (string) \LocalTichuScenarios::getCardId(1, 14)]);

  \APP_DbObject::DbQuery('UPDATE player SET player_zombie = 1 WHERE player_id IN (' . P0 . ', ' . P3 . ')');
  $game->reloadPlayersBasicInfos();

  callAction($game, P1, 'pass', ['onlyOnce' => true]);
  $beforeZombieChainPkt = (int) \APP_DbObject::getUniqueValueFromDB(
    'SELECT COALESCE(MAX(gamelog_packet_id), 0) FROM gamelog'
  );
  $beforeZombieChainTricksWin = (float) $game->getStat('tricks_win', P0);

  callAction($game, P2, 'pass', ['onlyOnce' => true]);

  assertSameVal(
    'playCombo',
    $game->gamestate->state(true, false, true)['name'],
    'Zombie P0 collecting trick in confirmTrick and leading Trick 2 must advance to playCombo'
  );
  assertSameVal(P1, (int) $game->getActivePlayerId(), 'Live player P1 must be active after zombie P0 leads');
  assertSameVal(
    $beforeZombieChainTricksWin + 1.0,
    (float) $game->getStat('tricks_win', P0),
    'Zombie P0 tricks_win should increment by 1 via collect(false)'
  );
  assertSameVal(1, (int) $deck->countCardInLocation('hand', P0), 'Zombie P0 should have led 1 of its 2 remaining cards');
  foreach ($game->getNotificationsSince($beforeZombieChainPkt, P1) as $pkt) {
    foreach ($pkt['data'] ?? [] as $notif) {
      assertTrueVal(
        ($notif['type'] ?? '') !== 'zombieModeFail',
        'Nested zombieTurn collect(false) flow (#808761) must never emit zombieModeFail'
      );
    }
  }
  \APP_DbObject::DbQuery('UPDATE player SET player_zombie = 0');
  $game->reloadPlayersBasicInfos();

  // 10b. End-to-end stale-snapshot multiactive transition into zombie giveCards:
  // Concurrent P2 bet makes P3's grandTichuBet stale, then P3 finishes betting and transitions to
  // giveCards where P0 is already a zombie; nested checkZombieTurn() must clear gameLockStale.
  $zombieGame = new \Tichu();
  $zombieGame->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
  callAction($zombieGame, P0, 'grandTichuBet', ['bet' => '0']);
  \APP_DbObject::DbQuery('UPDATE player SET player_zombie = 1 WHERE player_id = ' . P0);
  $zombieGame->reloadPlayersBasicInfos();
  callAction($zombieGame, P1, 'grandTichuBet', ['bet' => '0']);

  $otherDb = new \mysqli(
    (string) ($g_config['db_host'] ?? 'localhost'),
    (string) ($g_config['db_user'] ?? 'root'),
    (string) ($g_config['db_password'] ?? ''),
    (string) ($g_config['db_name'] ?? 'ebd_tichu_1'),
    (int) ($g_config['db_port'] ?? 0),
    (string) ($g_config['db_socket'] ?? '')
  );
  assertTrueVal(!$otherDb->connect_errno, 'Failed to open secondary MySQL connection: ' . $otherDb->connect_error);
  try {
    $beforeStaleZombiePkt = (int) \APP_DbObject::getUniqueValueFromDB(
      'SELECT COALESCE(MAX(gamelog_packet_id), 0) FROM gamelog'
    );
    $zombieGame->setCurrentPlayerId(P3);
    $zombieGame->beginPlayerAction();

    $otherDb->query('UPDATE player SET player_call_grand_tichu = 0, player_is_multiactive = 0 WHERE player_id = ' . P2);
    $otherDb->query(
      'UPDATE global SET global_value = global_value + 1 WHERE global_id = ' . \Tichu::GLOBAL_LOCK_VERSION
    );

    $zombieGame->grandTichuBet(0);
    $zombieGame->endPlayerAction(false);

    assertSameVal('giveCards', $zombieGame->gamestate->state(true, false, true)['name'], 'Game should reach giveCards');
    assertSameVal(
      11,
      (int) \CardManager::getDeck()->countCardInLocation('hand', P0),
      'Zombie P0 must pass 3 cards immediately on giveCards entry'
    );
    assertSameVal(
      3,
      (int) \APP_DbObject::getUniqueValueFromDB(
        "SELECT COUNT(*) FROM card WHERE card_location = 'temporary' AND card_passed_from = " . P0
      ),
      'Zombie P0 should have 3 cards in temporary'
    );
    foreach ($zombieGame->getNotificationsSince($beforeStaleZombiePkt, P1) as $pkt) {
      foreach ($pkt['data'] ?? [] as $notif) {
        assertTrueVal(
          ($notif['type'] ?? '') !== 'zombieModeFail',
          'Stale multiactive transition into zombie giveCards must never emit zombieModeFail'
        );
      }
    }
  } finally {
    $otherDb->close();
  }
}

// ============================================================================
// Test 13: test_action_and_parameter_validation_and_card_to_str
// ============================================================================
function test_action_and_parameter_validation_and_card_to_str(): void
{
  $game = new \Tichu();

  // 1. cancel() outside playBomb must throw UserException
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  assertSameVal('playComboOpen', $game->gamestate->state()['name']);
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'cancel'),
    null,
    'Calling cancel() outside playBomb must throw UserException'
  );

  // 2. acceptCards() outside showPassedCards must throw UserException
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'acceptCards'),
    null,
    'Calling acceptCards() outside showPassedCards must throw UserException'
  );

  // 3. confirmTichu() with invalid bet must throw UserException
  assertThrowsUserException(
    static fn() => $game->confirmTichu(999),
    null,
    'Calling confirmTichu(999) with invalid bet must throw UserException'
  );

  // 4. playCombo([]) (empty card array) and playCombo([9999]) (non-existent card ID) must throw UserException
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'playCombo', ['cards' => '']),
    'at least one card',
    'Calling playCombo([]) with empty card array must throw UserException'
  );
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'playCombo', ['cards' => '9999']),
    'in your hand',
    'Calling playCombo([9999]) with card not in hand must throw UserException'
  );

  // 5. makeAWish(99) (invalid wish rank) must throw UserException
  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  assertSameVal('mahjongPlay', $game->gamestate->state()['name']);
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'makeAWish', ['wish' => 99]),
    'Invalid wish value',
    'Calling makeAWish(99) must throw UserException'
  );
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'makeAWish', ['wish' => 1]),
    'Invalid wish value',
    'Calling makeAWish(1) must throw UserException'
  );

  // 6. chooseDragonGift(5) (invalid opponent index) must throw UserException
  \LocalTichuScenarios::setupScenario($game, 'dragon_gift', P0);
  callAction($game, P3, 'pass', ['onlyOnce' => true]);
  callAction($game, P0, 'collect');
  assertSameVal('chooseDragonGift', $game->gamestate->state()['name']);
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'chooseDragonGift', ['player' => 5]),
    'Invalid player choice',
    'Calling chooseDragonGift(5) must throw UserException'
  );

  // 7. playBomb() when player has < 4 cards in hand must throw UserException
  \LocalTichuScenarios::setupScenario($game, 'bomb_interrupt', P0);
  // Leave P2 with only 3 cards in hand
  \APP_DbObject::DbQuery(
    "UPDATE card SET card_location = 'captured', card_location_arg = " .
      P0 .
      " WHERE card_location = 'hand' AND card_location_arg = " .
      P2
  );
  $threeCardIds = \LocalTichuScenarios::getCardIds([[1, 7], [2, 7], [3, 7]]);
  \CardManager::getDeck()->moveCards($threeCardIds, 'hand', P2);
  assertSameVal(3, (int) \CardManager::getDeck()->countCardInLocation('hand', P2), 'P2 should have 3 cards in hand');
  assertThrowsUserException(
    static fn() => callAction($game, P2, 'playBomb', ['cards' => '']),
    'cannot play a bomb',
    'Calling playBomb() with fewer than 4 cards in hand must throw UserException'
  );

  // 8. CardManager::cardToStr() with type_arg == 1 returns special card names and does not fall through to case 11 (Jack)
  assertSameVal('Dragon', \CardManager::cardToStr(['type' => 1, 'type_arg' => 1]), 'type 1, type_arg 1 should be Dragon');
  assertSameVal('Phoenix', \CardManager::cardToStr(['type' => 2, 'type_arg' => 1]), 'type 2, type_arg 1 should be Phoenix');
  assertSameVal('Dog', \CardManager::cardToStr(['type' => 3, 'type_arg' => 1]), 'type 3, type_arg 1 should be Dog');
  assertSameVal('Mahjong', \CardManager::cardToStr(['type' => 4, 'type_arg' => 1]), 'type 4, type_arg 1 should be Mahjong');
  assertTrueVal(
    \CardManager::cardToStr(['type' => 0, 'type_arg' => 1]) !== 'Jack',
    'cardToStr case 1 must have a break statement and not fall through to case 11 (Jack)'
  );
}

// ============================================================================
// Runner Execution
// ============================================================================
// ============================================================================
// Test 14: test_table_lock_version_and_duplicate_requests
// (Concurrency itself is covered by `npm run test:race`; this checks the sequential contract.)
// ============================================================================
function test_table_lock_version_and_duplicate_requests(): void
{
  $game = new \Tichu();
  $game->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
  $version = fn() => (int) \APP_DbObject::getUniqueValueFromDB(
    'SELECT global_value FROM global WHERE global_id = ' . \Tichu::GLOBAL_LOCK_VERSION
  );
  assertSameVal(0, $version(), 'lockVersion must be initialized to 0 by setupNewGame');

  callAction($game, P0, 'grandTichuBet', ['bet' => '0']);
  assertSameVal(1, $version(), 'A Grand Tichu bet must bump the lock version');

  // Own-row-only actions do not bump the version (stNextPlayer reads autopass flags freshly).
  callAction($game, P1, 'cancelAutopass');
  assertSameVal(1, $version(), 'cancelAutopass must not bump the lock version');

  // A duplicate bet is rejected and rolled back (no version bump).
  assertThrowsUserException(fn() => callAction($game, P0, 'grandTichuBet', ['bet' => '0']));
  assertSameVal(1, $version(), 'A rejected request must not bump the lock version');

  // Duplicate / late collect requests are silent no-ops.
  callAction($game, P1, 'collect');
  assertSameVal('grandTichuBets', $game->gamestate->state()['name'], 'collect outside confirmTrick is a no-op');
  assertSameVal(1, $version(), 'A no-op collect must not bump the lock version');

  // Games started before the version row existed get it on their first change.
  \APP_DbObject::DbQuery('DELETE FROM global WHERE global_id = ' . \Tichu::GLOBAL_LOCK_VERSION);
  callAction($game, P1, 'grandTichuBet', ['bet' => '0']);
  assertSameVal(1, $version(), 'The lock version row must be re-created for running games');

  // 1. Post-initTable() transaction rollback check:
  // acquireAdvisoryLock() must leave an active MySQL transaction open so throwing UserException
  // after bumpGameVersion() rolls back cleanly (Production has no debugSaveState(4) begin()).
  assertThrowsUserException(
    static fn() => callAction($game, P0, 'makeAWish', ['wish' => '99']),
    '',
    'Calling makeAWish out of state must throw UserException'
  );
  assertSameVal(1, $version(), 'Rollback must undo lockVersion bump after UserException');

  // 2. Duplicate collect with pre-lock cached state 50 (ST_NEW_TRICK, Production Issue #807743):
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \APP_DbObject::DbQuery('UPDATE global SET global_value = ' . ST_NEW_TRICK . ' WHERE global_id = 1');
  \Bga\GameFramework\TableInfos::$tables_infos = [];
  $game->o_tableinfos->db_load(false);
  $game->gamestate->loadStateMachine($game, 'tichu', 1);
  assertSameVal(
    ST_NEW_TRICK,
    (int) $game->gamestate->state_id(),
    'Pre-lock cached state should simulate ST_NEW_TRICK (50)'
  );
  \APP_DbObject::DbQuery('UPDATE global SET global_value = ' . ST_PLAY_COMBO_OPEN . ' WHERE global_id = 1');
  \APP_DbObject::DbQuery(
    'UPDATE global SET global_value = global_value + 1 WHERE global_id = ' . \Tichu::GLOBAL_LOCK_VERSION
  );
  $game->onRequestEnd();
  $game->setCurrentPlayerId(P0);
  $game->inPlayerAction = true;
  $game->collect();
  $game->endPlayerAction(false);
  assertSameVal(
    ST_PLAY_COMBO_OPEN,
    (int) $game->gamestate->state_id(),
    'Duplicate collect must reload stale cached state 50 to 55 before checkReturnState()'
  );

  // 3. Pre-mutation validation in completePlayCombo():
  $mahjongId = (int) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => (string) $mahjongId]);
  callAction($game, P0, 'makeAWish', ['wish' => 9]);
  $tenId = (int) \LocalTichuScenarios::getCardId(2, 10);
  $game->setCurrentPlayerId(P1);
  $game->beginPlayerAction();
  $threwWish = false;
  try {
    $game->playCombo([$tenId]);
  } catch (\Bga\GameFramework\UserException $e) {
    $threwWish = true;
    assertSameVal(
      1,
      (int) \APP_DbObject::getUniqueValueFromDB("SELECT COUNT(*) FROM actionlog WHERE log_action = 'combo'"),
      'completePlayCombo() must throw before LogManager::playCombo() writes to actionlog'
    );
  }
  $game->endPlayerAction(true);
  assertTrueVal($threwWish, 'Playing 10 when wish=9 is fulfillable must throw UserException');
}

function test_stale_snapshot_multiactive_and_notif_ordering(): void
{
  global $g_config;

  $game = new \Tichu();
  $game->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);

  // 1. "synchro" notification interleaving: gameStateChange(newRound) -> private dealCards -> gameStateChange(grandTichuBets).
  $initialPackets = $game->getNotificationsSince(0, P0);
  $initialEvents = [];
  foreach ($initialPackets as $pkt) {
    foreach ($pkt['data'] ?? [] as $notif) {
      $type = (string) ($notif['type'] ?? '');
      $stateName = $type === 'gameStateChange' ? ((string) ($notif['args']['name'] ?? '')) : '';
      $initialEvents[] = $stateName !== '' ? "{$type}:{$stateName}" : $type;
    }
  }
  $newRoundIdx = array_search('gameStateChange:newRound', $initialEvents, true);
  $dealCardsIdx = array_search('dealCards', $initialEvents, true);
  $gtBetsIdx = array_search('gameStateChange:grandTichuBets', $initialEvents, true);
  assertTrueVal(
    $newRoundIdx !== false && $dealCardsIdx !== false && $gtBetsIdx !== false,
    'Initial packets must include gameStateChange:newRound, dealCards, and gameStateChange:grandTichuBets'
  );
  assertTrueVal(
    $newRoundIdx < $dealCardsIdx && $dealCardsIdx < $gtBetsIdx,
    'synchro interleaving must deliver gameStateChange:newRound -> dealCards -> gameStateChange:grandTichuBets'
  );

  // 2. Stale-snapshot multiactive handling (setPlayerNonMultiactiveSafe):
  // P0 bets first; now P1, P2, P3 are multiactive.
  callAction($game, P0, 'grandTichuBet', ['bet' => '0']);

  // Open P3's request snapshot (sees P1, P2, P3 active and lockVersion = 1), then commit P2 acting on a second connection.
  $otherDb = new \mysqli(
    (string) ($g_config['db_host'] ?? 'localhost'),
    (string) ($g_config['db_user'] ?? 'root'),
    (string) ($g_config['db_password'] ?? ''),
    (string) ($g_config['db_name'] ?? 'ebd_tichu_1'),
    (int) ($g_config['db_port'] ?? 0),
    (string) ($g_config['db_socket'] ?? '')
  );
  assertTrueVal(!$otherDb->connect_errno, 'Failed to open secondary MySQL connection: ' . $otherDb->connect_error);

  try {
    $beforeStalePkt = (int) \APP_DbObject::getUniqueValueFromDB('SELECT COALESCE(MAX(gamelog_packet_id), 0) FROM gamelog');
    $game->setCurrentPlayerId(P3);
    $game->beginPlayerAction();

    $otherDb->query('UPDATE player SET player_call_grand_tichu = 0, player_is_multiactive = 0 WHERE player_id = ' . P2);
    $otherDb->query('UPDATE global SET global_value = global_value + 1 WHERE global_id = ' . \Tichu::GLOBAL_LOCK_VERSION);

    $game->grandTichuBet(0);
    $game->endPlayerAction(false);

    $stalePackets = $game->getNotificationsSince($beforeStalePkt, P0);
    $multiActiveUpdates = [];
    foreach ($stalePackets as $pkt) {
      foreach ($pkt['data'] ?? [] as $notif) {
        if (($notif['type'] ?? '') === 'gameStateMultipleActiveUpdate') {
          $multiActiveUpdates[] = $notif['args'] ?? [];
        }
      }
    }
    assertSameVal(1, count($multiActiveUpdates), 'Expected one gameStateMultipleActiveUpdate from stale grandTichuBet');
    assertSameVal(
      [strval(P1)],
      $multiActiveUpdates[0],
      'Stale-snapshot setPlayerNonMultiactiveSafe must only broadcast remaining active P1 (never stale P2)'
    );

    // P1 finishes betting -> deals remaining 6 cards -> transitions to ST_GIVE_CARDS (40).
    callAction($game, P1, 'grandTichuBet', ['bet' => '0']);
    assertSameVal('giveCards', $game->gamestate->state(true, false, true)['name'], 'Should enter giveCards');

    $pickThree = static function (int $playerId): array {
      $cards = array_values(\CardManager::getDeck()->getCardsInLocation('hand', $playerId));
      return array_slice(array_map(static fn($c) => (int) $c['id'], $cards), 0, 3);
    };
    callAction($game, P0, 'giveTheCards', ['cards' => implode(';', $pickThree(P0))]);
    callAction($game, P1, 'giveTheCards', ['cards' => implode(';', $pickThree(P1))]);

    // P2 and P3 remain multiactive. Start P3's snapshot, then commit P2 passing on $otherDb so P3 becomes last passer on a stale snapshot.
    $p2Cards = $pickThree(P2);
    $p2Recipients = array_map(static fn($p) => (int) $p['id'], \PlayerManager::getNextPlayers(P2, true));
    $p3Cards = $pickThree(P3);
    $game->setCurrentPlayerId(P3);
    $game->beginPlayerAction();

    foreach ($p2Cards as $idx => $cid) {
      $recId = $p2Recipients[$idx];
      $otherDb->query(
        "UPDATE card SET card_location = 'temporary', card_location_arg = {$recId}, card_passed_from = " .
          P2 .
          " WHERE card_id = {$cid}"
      );
    }
    $otherDb->query('UPDATE player SET player_is_multiactive = 0 WHERE player_id = ' . P2);
    $otherDb->query('UPDATE global SET global_value = global_value + 1 WHERE global_id = ' . \Tichu::GLOBAL_LOCK_VERSION);

    assertThrowsUserException(
      static fn() => $game->giveTheCards($p3Cards),
      'game changed',
      'Last passer in giveCards on a stale snapshot (staleTransitionSafe = false) must throw UserException'
    );
    $game->endPlayerAction(true);

    // Rollback must preserve P3 hand in 'hand' and remain in giveCards; retrying fresh as last passer P3 succeeds.
    assertSameVal(14, (int) \CardManager::getDeck()->countCardInLocation('hand', P3), 'Rollback must keep P3 cards in hand');
    assertSameVal('giveCards', $game->gamestate->state(true, false, true)['name'], 'State must remain giveCards');

    $beforeTrickPkt = (int) \APP_DbObject::getUniqueValueFromDB('SELECT COALESCE(MAX(gamelog_packet_id), 0) FROM gamelog');
    callAction($game, P3, 'giveTheCards', ['cards' => implode(';', $p3Cards)]);

    // stAcceptPassedCards() runs automatically -> stNewTrick() -> playComboOpen -> play 1 card -> stNextPlayer()
    $afterOpenState = $game->gamestate->state(true, false, true);
    assertSameVal('playComboOpen', $afterOpenState['name'], 'Should reach playComboOpen after last passer retries');
    $starterId = (int) $afterOpenState['active_player'];
    $starterCards = array_values(\CardManager::getDeck()->getCardsInLocation('hand', $starterId));
    $mahjongId = null;
    foreach ($starterCards as $c) {
      if ((int) $c['type'] === TYPE_MAHJONG && (int) $c['type_arg'] === 1) {
        $mahjongId = (int) $c['id'];
        break;
      }
    }
    $leadCard = $mahjongId ?? (int) $starterCards[0]['id'];
    callAction($game, $starterId, 'playCombo', ['cards' => (string) $leadCard]);
    if ($mahjongId !== null && $game->gamestate->state(true, false, true)['name'] === 'mahjongPlay') {
      callAction($game, $starterId, 'makeAWish', ['wish' => '15']);
    }

    // 3. giveExtraTime() vs nextState() ordering: in every move with updateReflexionTime, gameStateChange must precede it.
    $trickPackets = $game->getNotificationsSince($beforeTrickPkt, $starterId);
    $seenReflexionNotif = false;
    $eventsByMove = [];
    foreach ($trickPackets as $pkt) {
      $moveId = (string) ($pkt['move_id'] ?? '');
      foreach ($pkt['data'] ?? [] as $notif) {
        $eventsByMove[$moveId][] = $notif['type'] ?? '';
      }
    }
    foreach ($eventsByMove as $moveId => $types) {
      $gsIdx = array_search('gameStateChange', $types, true);
      foreach ($types as $idx => $type) {
        if ($type === 'updateReflexionTime') {
          $seenReflexionNotif = true;
          assertTrueVal(
            $gsIdx !== false && $gsIdx < $idx,
            "In move {$moveId}, gameStateChange must arrive before updateReflexionTime"
          );
        }
      }
    }
    assertTrueVal($seenReflexionNotif, 'Expected updateReflexionTime notification in real-time play');
  } finally {
    $otherDb->close();
  }
}

function test_production_bug_sql_loader_and_player_id_remapping(): void {
  $fixturePath = __DIR__ . '/fixtures/bug_fixture.sql';
  $result = importBugSqlFile($fixturePath);

  assertSameVal(ST_GAME_END, $result['previousStateId'], 'Fixture should originate from ST_GAME_END');
  assertSameVal(ST_CONFIRM_TRICK, $result['stateId'], 'Completed game fixture should reopen to ST_CONFIRM_TRICK');
  assertSameVal(P1, $result['activePlayerId'], 'Active player 90002 should remap to P1');

  $expectedMap = [
    90001 => P0,
    90002 => P1,
    90003 => P2,
    90004 => P3,
  ];
  assertSameVal($expectedMap, $result['playerMap'], 'Player ID map should match player_no 1..4 order');

  $players = \APP_DbObject::getObjectListFromDB(
    'SELECT player_id, player_no, player_is_multiactive FROM player ORDER BY player_no ASC'
  );
  assertSameVal(4, count($players), 'Four players should exist after fixture import');
  assertSameVal([P0, P1, P2, P3], array_map(fn($r) => (int) $r['player_id'], $players), 'Players should be remapped in seat order');
  foreach ($players as $row) {
    assertSameVal(0, (int) $row['player_is_multiactive'], 'Multiactive flags must be cleared when reopening into ST_CONFIRM_TRICK');
  }

  $multiactiveRows = (int) \APP_DbObject::getUniqueValueFromDB(
    'SELECT COUNT(*) FROM playermultiactive WHERE ma_is_multiactive = 1'
  );
  assertSameVal(0, $multiactiveRows, 'playermultiactive must be cleared when reopening into non-multiactive state');

  // Verify global values: remapped player IDs vs preserved non-player values.
  $globals = \APP_DbObject::getCollectionFromDb('SELECT global_id, global_value FROM global', true);
  assertSameVal((string) ST_CONFIRM_TRICK, (string) $globals['1'], 'global_id 1 should be ST_CONFIRM_TRICK');
  assertSameVal((string) P1, (string) $globals['2'], 'GAMESTATE_ACTIVE_PLAYER should remap 90002 -> P1');
  assertSameVal((string) P0, (string) $globals['5'], 'GAMESTATE_ADMIN_PLAYER should remap 90001 -> P0');
  assertSameVal((string) P0, (string) $globals['21'], 'firstOutPlayer should remap 90001 -> P0');
  assertSameVal((string) P2, (string) $globals['27'], 'mahjongOwner should remap 90003 -> P2');
  assertSameVal((string) P3, (string) $globals['302'], 'neutralized player global should remap 90004 -> P3');
  assertSameVal('9', (string) $globals['26'], 'mahjongWish non-player global must stay 9');
  assertSameVal('17', (string) $globals['30'], 'GLOBAL_LOCK_VERSION non-player global must stay 17');

  // Verify no production IDs remain anywhere across the 7 surfaces.
  $oldIds = ['90001', '90002', '90003', '90004'];
  $dumpChecks = [
    'global' => \APP_DbObject::getObjectListFromDB('SELECT global_id, global_value FROM global'),
    'card' => \APP_DbObject::getObjectListFromDB('SELECT card_id, card_location, card_location_arg, card_passed_from FROM card'),
    'actionlog' => \APP_DbObject::getObjectListFromDB('SELECT log_id, log_player, log_action, log_arg FROM actionlog'),
    'gamelog' => \APP_DbObject::getObjectListFromDB('SELECT gamelog_packet_id, gamelog_player, gamelog_current_player, gamelog_notification FROM gamelog'),
    'stats' => \APP_DbObject::getObjectListFromDB('SELECT stats_type, stats_player_id, stats_value FROM stats'),
    'bga_user_preferences' => (function (): array {
      global $bgaContainer;
      /** @var \Bga\GameFramework\Old\Db $db */
      $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
      return $db->getObjectList('SELECT pgp_player, pgp_preference_id, pgp_value FROM bga_user_preferences');
    })(),
    'replaysavepoint' => \APP_DbObject::getObjectListFromDB('SELECT rsp_player_id, rsp_move_id, rsp_gamedatas FROM replaysavepoint'),
  ];
  foreach ($dumpChecks as $table => $rows) {
    $json = json_encode($rows);
    assertTrueVal(is_string($json), "Failed to encode {$table} rows");
    foreach ($oldIds as $oldId) {
      assertTrueVal(!str_contains($json, $oldId), "Old production ID {$oldId} must not remain in {$table}");
    }
  }

  // Verify card ownership, passed_from, and non-player combo card location_arg values.
  $p0CapturedCount = (int) \APP_DbObject::getUniqueValueFromDB(
    "SELECT COUNT(*) FROM card WHERE card_location = 'captured' AND card_location_arg = " . P0
  );
  assertTrueVal($p0CapturedCount > 0, 'P0 (firstOutPlayer) should own captured cards');
  $p1HandCount = (int) \APP_DbObject::getUniqueValueFromDB(
    "SELECT COUNT(*) FROM card WHERE card_location = 'hand' AND card_location_arg = " . P1
  );
  assertTrueVal($p1HandCount > 0, 'P1 should hold cards in hand');
  $comboZeroCount = (int) \APP_DbObject::getUniqueValueFromDB(
    "SELECT COUNT(*) FROM card WHERE card_location = 'combos' AND card_location_arg = 0"
  );
  assertSameVal(2, $comboZeroCount, 'Combos cards should preserve card_location_arg = 0');
  $passedFromP0 = (int) \APP_DbObject::getUniqueValueFromDB(
    'SELECT COUNT(*) FROM card WHERE card_passed_from = ' . P0
  );
  assertTrueVal($passedFromP0 > 0, 'card_passed_from should remap 90001 -> P0');

  // Verify actionlog preserves HTML-encoded apostrophe and timestamp while remapping JSON player keys.
  $logs = \APP_DbObject::getObjectListFromDB('SELECT log_player, log_action, log_arg FROM actionlog ORDER BY log_id ASC');
  $tichuTimestampFound = false;
  $escapedComboFound = false;
  $changePlayerRemapped = false;
  $confirmRemapped = false;
  foreach ($logs as $log) {
    $arg = json_decode((string) $log['log_arg'], true);
    if ($log['log_action'] === 'tichuCall') {
      assertSameVal(P0, (int) $log['log_player'], 'tichuCall log_player should remap to P0');
      assertSameVal(1700000000, $arg, 'tichuCall scalar timestamp must not be altered');
      $tichuTimestampFound = true;
    }
    if ($log['log_action'] === 'combo') {
      $comboDesc = $arg['description'] ?? '';
      if (is_string($comboDesc) && str_contains($comboDesc, 'Pair of 2&#39;s')) {
        assertSameVal(P0, (int) $log['log_player'], 'Pair of 2s combo log_player should remap to P0');
        $escapedComboFound = true;
      }
    }
    if ($log['log_action'] === 'changePlayer') {
      assertSameVal(P2, (int) $log['log_player'], 'changePlayer log_player should remap to P2');
      assertSameVal(P0, (int) ($arg['active'] ?? 0), 'changePlayer active should remap to P0');
      $changePlayerRemapped = true;
    }
    if ($log['log_action'] === 'confirm') {
      assertSameVal(P1, (int) ($arg['nextPlayer'] ?? 0), 'confirm nextPlayer should remap to P1');
      $confirmRemapped = true;
    }
  }
  assertTrueVal($tichuTimestampFound, 'Fixture should contain tichuCall entry with preserved timestamp');
  assertTrueVal($escapedComboFound, 'Fixture should preserve HTML semicolon inside Pair of 2&#39;s');
  assertTrueVal($changePlayerRemapped, 'Fixture should remap changePlayer active & log_player');
  assertTrueVal($confirmRemapped, 'Fixture should remap confirm nextPlayer');

  // Verify Tichu instance loads cleanly, produces valid client payload & gamelogs, and can collect the trick.
  $game = new \Tichu();
  $payloadP0 = $game->getFullClientPayload(P0);
  $payloadP1 = $game->getFullClientPayload(P1);
  assertSameVal(ST_CONFIRM_TRICK, (int) $payloadP0['gamestate']['id'], 'Payload gamestate should be ST_CONFIRM_TRICK');
  assertSameVal((string) P1, (string) $payloadP1['gamestate']['active_player'], 'Payload active_player should be P1');
  assertTrueVal(isset($payloadP0['players'][P0], $payloadP1['players'][P1]), 'Payload players must contain remapped IDs');

  $gamelogs = $game->getAllGamelogsForReplay();
  assertTrueVal(count($gamelogs) >= 4, 'Gamelog packets should be preserved');
  $gamelogJson = json_encode($gamelogs);
  assertTrueVal(is_string($gamelogJson) && str_contains($gamelogJson, (string) P0) && str_contains($gamelogJson, (string) P3), 'Gamelog packets should contain remapped IDs');

  callAction($game, P1, 'collect');
  assertSameVal('playComboOpen', $game->gamestate->state(true, false, true)['name'], 'Collecting confirmed trick should transition to playComboOpen');

  // Verify two-phase collision-free swapping when target IDs overlap with existing IDs.
  $swapResult = \LocalBugSqlLoader::loadBugReportSQL($game, 0, [P2, P3, P0, P1]);
  assertSameVal([P0 => P2, P1 => P3, P2 => P0, P3 => P1], $swapResult['playerMap'], 'Two-phase swap should rotate overlapping player IDs without collision');
  $swappedActive = (int) \APP_DbObject::getUniqueValueFromDB('SELECT global_value FROM global WHERE global_id = 2');
  assertSameVal(P3, $swappedActive, 'Active player P1 should have swapped cleanly to P3');

  // Verify optional state override parameter.
  $overrideResult = importBugSqlFile($fixturePath, ST_PLAY_COMBO);
  assertSameVal(ST_PLAY_COMBO, $overrideResult['stateId'], 'Explicit state override should land on ST_PLAY_COMBO');

  // Verify recipient & recipients JSON actionlog remapping.
  $remappedRecipients = \LocalBugSqlLoader::remapActionLogArg(
    ['recipient' => 90004, 'recipients' => [90002, 90003, 90004]],
    $result['playerMap']
  );
  assertSameVal(P3, $remappedRecipients['recipient'], 'remapActionLogArg should remap recipient');
  assertSameVal([P1, P2, P3], $remappedRecipients['recipients'], 'remapActionLogArg should remap recipients list');

  // Verify inspectBugDatabase() & formatBugInspectionReport() against imported state.
  $inspection = inspectBugDatabase();
  assertSameVal(56, $inspection['cards']['totalCards'], 'Inspection should count all 56 cards');
  assertTrueVal((bool) $inspection['cards']['integrityOk'], 'Inspection integrityOk should be true');
  $report = formatBugInspectionReport($inspection);
  assertTrueVal(str_contains($report, '56/56'), 'Inspection report should include 56/56 card summary');
  assertTrueVal(str_contains($report, 'playCombo'), 'Inspection report should include overridden playCombo state name');
}

// ============================================================================
// Test 17: test_studio_debug_bot_step_and_bot_others
// ============================================================================
function callDebugAction(\Tichu $game, int $viewerId, string $method): void
{
  $game->setCurrentPlayerId($viewerId);
  $game->beginPlayerAction();
  try {
    $game->bga->debug->setExecutingDebugAction();
    $game->$method();
    $game->endPlayerAction();
  } catch (\Throwable $e) {
    $game->endPlayerAction(true);
    throw $e;
  }
}

function test_studio_debug_bot_step_and_bot_others(): void
{
  assertSameVal('studio', \Tichu::getBgaEnvironment(), 'Local runner must report studio environment for debug_* actions');

  $game = new \Tichu();
  $game->createNewGame([
    'gameLength' => 1,
    'playerTeams' => TEAM_1_3,
    'turnBased' => 0,
  ]);

  // 1. P0 bets 0 in grandTichuBets, then debug_botOthers() completes P1/P2/P3 -> transitions to giveCards
  callAction($game, P0, 'grandTichuBet', ['bet' => '0']);
  callDebugAction($game, P0, 'debug_botOthers');
  assertSameVal('giveCards', $game->gamestate->state()['name'], 'debug_botOthers should finish grandTichuBets and enter giveCards');

  // 2. In giveCards (multiactive), debug_botStep() while viewing as P0 must pick a non-viewer bot first
  callDebugAction($game, P0, 'debug_botStep');
  $activeAfterOneStep = array_map('intval', $game->gamestate->getActivePlayerList());
  assertTrueVal(in_array(P0, $activeAfterOneStep, true), 'debug_botStep should not pass cards for viewer P0 when other bots are active');
  assertSameVal(3, count($activeAfterOneStep), 'One bot should have passed cards after debug_botStep');

  // Remaining bots pass via debug_botOthers(), leaving only P0 multiactive
  callDebugAction($game, P0, 'debug_botOthers');
  $activeAfterOthers = array_map('intval', $game->gamestate->getActivePlayerList());
  assertSameVal([P0], $activeAfterOthers, 'Only viewer P0 should remain multiactive in giveCards after debug_botOthers');

  // P0 passes 3 cards -> transitions to playComboOpen
  $p0Pass = \LocalTichuBot::pickThreeCardsToGive(P0);
  callAction($game, P0, 'giveTheCards', ['cards' => implode(';', $p0Pass)]);
  assertSameVal('playComboOpen', $game->gamestate->state()['name']);

  // 3. Test activeplayer stepping with viewer P0 != active bot, including confirmTrick -> collect()
  //    Verify refreshLockStateAfterBotStep() keeps freshStateId synchronized across multiple steps in one request!
  //    In bomb_interrupt: P0 led Ace (1,14), P1 is active in playCombo.
  \LocalTichuScenarios::setupScenario($game, 'bomb_interrupt', P0);
  callDebugAction($game, P0, 'debug_botOthers');
  $stAfter = $game->gamestate->state();
  assertTrueVal(
    in_array($stAfter['name'], ['playCombo', 'playComboOpen', 'confirmTrick'], true),
    'debug_botOthers should advance cleanly from P1 in playCombo (got ' . $stAfter['name'] . ')'
  );

  // Verify confirmTrick -> collect(false) -> chooseDragonGift(0, false) -> playComboOpen in one debug_botOthers call.
  // In dragon_gift: P0 played Dragon, P1 & P2 passed, P3 is active. Viewing as P1 causes P3 to pass,
  // transitioning through confirmTrick (P0) and chooseDragonGift (P0) until P1 becomes active.
  \LocalTichuScenarios::setupScenario($game, 'dragon_gift', P0);
  callDebugAction($game, P1, 'debug_botOthers');
  $stateAfterDragon = $game->gamestate->state();
  assertSameVal((string) P1, (string) $stateAfterDragon['active_player'], 'debug_botOthers as P1 should collect Dragon trick, gift it, and stop when P1 becomes active');
  $lastTrickWinLogs = \APP_DbObject::getObjectListFromDB("SELECT log_player, log_action FROM actionlog WHERE log_action = 'chooseDragonGift'");
  assertSameVal(1, count($lastTrickWinLogs), 'Dragon gift must have been chosen during single debug_botOthers request');
  assertSameVal(P0, (int) $lastTrickWinLogs[0]['log_player'], 'Dragon gift log_player must be P0 (trick winner), not viewer P1');

  // 4. Test spectator mode (viewer = 0): debug_botStep/debug_botOthers act for all 4 players,
  //    and getNotificationsSince(..., 0, false) excludes private notifications (dealCards, passCards).
  $game->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
  callDebugAction($game, 0, 'debug_botStep');
  assertSameVal(3, count($game->gamestate->getActivePlayerList()), 'Spectator debug_botStep should advance 1 player in grandTichuBets');
  callDebugAction($game, 0, 'debug_botOthers');
  assertSameVal('giveCards', $game->gamestate->state()['name'], 'Spectator debug_botOthers should complete grandTichuBets for all remaining players');
  callDebugAction($game, 0, 'debug_botOthers');
  assertSameVal('playComboOpen', $game->gamestate->state()['name'], 'Spectator debug_botOthers should complete giveCards for all 4 players');

  $p0Packets = $game->getNotificationsSince(0, P0, false);
  $p0Types = [];
  foreach ($p0Packets as $pkt) {
    foreach ($pkt['data'] ?? [] as $notif) {
      $p0Types[] = (string) ($notif['type'] ?? '');
    }
  }
  assertTrueVal(in_array('dealCards', $p0Types, true), 'Player P0 must receive private dealCards notifications');
  assertTrueVal(in_array('passCards', $p0Types, true), 'Player P0 must receive private passCards notifications');

  $specPackets = $game->getNotificationsSince(0, 0, false);
  foreach ($specPackets as $pkt) {
    $channel = (string) ($pkt['channel'] ?? '');
    assertTrueVal(!str_starts_with($channel, '/player/p'), 'Spectator must not receive /player/p* channels (got ' . $channel . ')');
    foreach ($pkt['data'] ?? [] as $notif) {
      $type = (string) ($notif['type'] ?? '');
      assertTrueVal(
        !in_array($type, ['dealCards', 'passCards', 'acceptCards', 'confirmTichu'], true),
        'Spectator must not receive private notification type ' . $type
      );
    }
  }

  // 5. Test LocalTichuBot::autoPlayUntilPlayer() across multiactive -> active states
  $game->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
  callAction($game, P0, 'grandTichuBet', ['bet' => '0']);
  $actions = \LocalTichuBot::autoPlayUntilPlayer($game, P0);
  assertSameVal(3, count($actions), 'autoPlayUntilPlayer should act for the 3 bots in grandTichuBets and stop when P0 is active in giveCards');
  assertSameVal('giveCards', $game->gamestate->state()['name']);
  assertTrueVal($game->gamestate->isPlayerActive(P0), 'P0 must be active in giveCards');

  // 6. Verify each bot step in actForOtherPlayers produces a distinct gamelog_move_id
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 2], [1, 14]],
    P1 => [[2, 3], [2, 10]],
    P2 => [[3, 4], [3, 11]],
    P3 => [[4, 5], [4, 12]],
  ], 'captured_p0');
  callAction($game, P0, 'playCombo', ['cards' => (string) \LocalTichuScenarios::getCardId(1, 2)]);
  $beforeBatchPkt = (int) \APP_DbObject::getUniqueValueFromDB(
    'SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog'
  );
  $batchActions = \LocalTichuBot::actForOtherPlayers($game, P0);
  assertSameVal(3, count($batchActions), 'actForOtherPlayers should step P1, P2, and P3 before returning to P0');
  $batchPackets = $game->getNotificationsSince($beforeBatchPkt, P0, false);
  $moveIdsByAction = [];
  foreach ($batchPackets as $pkt) {
    foreach ($pkt['data'] ?? [] as $notif) {
      if (in_array($notif['type'] ?? '', ['playCombo', 'pass'], true)) {
        $moveIdsByAction[] = (string) ($pkt['move_id'] ?? '');
      }
    }
  }
  assertSameVal(3, count($moveIdsByAction), 'Expected 3 playCombo/pass notifications from bot batch');
  assertSameVal(
    3,
    count(array_unique($moveIdsByAction)),
    'Each bot step in actForOtherPlayers must get its own distinct gamelog_move_id'
  );

  // 7. Verify debug_botSuggest computes TichuBot's move read-only and emits a private botSuggestion notification
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [
      [1, 14], [2, 14], [3, 14], [2, 1],
      [1, 2], [2, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [1, 10],
    ],
    P1 => [[3, 2]],
    P2 => [[4, 2]],
    P3 => [[4, 3]],
  ], 'distribute_14');
  $game->gamestate->changeActivePlayer(P0);
  $lockVerBefore = (int) \APP_DbObject::getUniqueValueFromDB(
    'SELECT global_value FROM global WHERE global_id = ' . \Tichu::GLOBAL_LOCK_VERSION
  );
  $stateBefore = (string) ($game->gamestate->state()['name'] ?? '');
  $p0HandBefore = array_map(
    static fn($c) => (string) $c['id'],
    array_values(\CardManager::getDeck()->getCardsInLocation('hand', P0))
  );
  $beforeSuggestPkt = (int) \APP_DbObject::getUniqueValueFromDB(
    'SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog'
  );
  $directChoice = \TichuBot::chooseNextAction($game, P0);

  callDebugAction($game, P0, 'debug_botSuggest');

  $lockVerAfter = (int) \APP_DbObject::getUniqueValueFromDB(
    'SELECT global_value FROM global WHERE global_id = ' . \Tichu::GLOBAL_LOCK_VERSION
  );
  $p0HandAfter = array_map(
    static fn($c) => (string) $c['id'],
    array_values(\CardManager::getDeck()->getCardsInLocation('hand', P0))
  );
  assertSameVal($lockVerBefore, $lockVerAfter, 'debug_botSuggest must not bump GLOBAL_LOCK_VERSION');
  assertSameVal($stateBefore, (string) ($game->gamestate->state()['name'] ?? ''), 'debug_botSuggest must not change state');
  assertSameVal($p0HandBefore, $p0HandAfter, 'debug_botSuggest must not mutate hand cards');
  assertSameVal('-1', (string) \PlayerManager::getPlayer(P0)['call_tichu'], 'debug_botSuggest must not call Tichu eagerly');

  $suggestPacketsP0 = $game->getNotificationsSince($beforeSuggestPkt, P0, false);
  $botNotif = null;
  foreach ($suggestPacketsP0 as $pkt) {
    foreach ($pkt['data'] ?? [] as $notif) {
      if (($notif['type'] ?? '') === 'botSuggestion') {
        $botNotif = $notif;
      }
    }
  }
  assertTrueVal($botNotif !== null, 'P0 must receive private botSuggestion notification');
  assertSameVal($directChoice, $botNotif['args']['suggestion'] ?? null, 'botSuggestion payload must match TichuBot::chooseNextAction');
  assertTrueVal(!empty($botNotif['args']['suggestion']['acted']), 'botSuggestion should recommend acting for active P0');
  assertSameVal('playCombo', (string) ($botNotif['args']['suggestion']['action'] ?? ''), 'Expected playCombo suggestion');
  assertTrueVal(!empty($botNotif['args']['suggestion']['callTichuFirst']), 'Expected callTichuFirst=true for 14 cards + 4 high cards');

  foreach ([P1, 0] as $otherViewer) {
    $otherPackets = $game->getNotificationsSince($beforeSuggestPkt, $otherViewer, false);
    foreach ($otherPackets as $pkt) {
      foreach ($pkt['data'] ?? [] as $notif) {
        assertTrueVal(($notif['type'] ?? '') !== 'botSuggestion', "Viewer $otherViewer must not receive P0's private botSuggestion");
      }
    }
  }

  $beforeSpecSuggest = (int) \APP_DbObject::getUniqueValueFromDB(
    'SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog'
  );
  callDebugAction($game, 0, 'debug_botSuggest');
  $afterSpecSuggest = (int) \APP_DbObject::getUniqueValueFromDB(
    'SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog'
  );
  assertSameVal($beforeSpecSuggest, $afterSpecSuggest, 'Spectator debug_botSuggest must be a no-op with no notifications');
}

// ============================================================================
// Test 18: test_smart_bot_strategy_and_decisions
// ============================================================================
function test_smart_bot_strategy_and_decisions(): void
{
  $game = new \Tichu();

  // 1. Grand Tichu: bot calls GT (200) iff >= 2 of [4 Aces, Dragon, Phoenix]
  $game->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 14], [2, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7]], // Ace + Phoenix (2 high) -> GT
    P1 => [[2, 14], [1, 13], [2, 13], [3, 13], [2, 2], [2, 3], [2, 4], [2, 5]], // 1 Ace only -> 0
    P2 => [[3, 14], [4, 14], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7]], // 2 Aces -> GT
    P3 => [[1, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8]], // Dragon only (1 high) -> 0
  ], 'deck');

  \LocalTichuBot::stepSingleBotTurn($game, P0);
  \LocalTichuBot::stepSingleBotTurn($game, P1);
  \LocalTichuBot::stepSingleBotTurn($game, P2);
  // Let P3 act as zombie (must bet 0 even if holding high cards; here verify normal bot first, zombie tested below)
  \LocalTichuBot::stepSingleBotTurn($game, P3);

  assertSameVal('200', (string) \PlayerManager::getPlayer(P0)['call_grand_tichu'], 'P0 with Ace+Phoenix should call Grand Tichu');
  assertSameVal('0', (string) \PlayerManager::getPlayer(P1)['call_grand_tichu'], 'P1 with 1 Ace should not call Grand Tichu');
  assertSameVal('200', (string) \PlayerManager::getPlayer(P2)['call_grand_tichu'], 'P2 with 2 Aces should call Grand Tichu');
  assertSameVal('0', (string) \PlayerManager::getPlayer(P3)['call_grand_tichu'], 'P3 with Dragon only should not call Grand Tichu');

  // 2. Mahjong wish: 90% wish in 2..7, never wish (15) when partner called Grand Tichu
  assertSameVal(15, \TichuBot::pickMahjongWish(P0, 1, 4), 'P0 must wish 15 (none) when partner P2 called GT');
  assertSameVal(15, \TichuBot::pickMahjongWish(P2, 1, 4), 'P2 must wish 15 (none) when partner P0 called GT');
  // P1's partner is P3 (who did not call GT)
  assertSameVal(4, \TichuBot::pickMahjongWish(P1, 1, 4), 'P1 should make wish in 2..7 on roll <= 90');
  assertSameVal(7, \TichuBot::pickMahjongWish(P1, 90, 7), 'P1 should make wish in 2..7 on roll == 90');
  assertSameVal(15, \TichuBot::pickMahjongWish(P1, 91, 4), 'P1 should make no wish (15) on roll > 90');
  for ($i = 0; $i < 50; $i++) {
    $w = \TichuBot::pickMahjongWish(P1);
    assertTrueVal(($w >= 2 && $w <= 7) || $w === 15, "Random bot wish must be 2..7 or 15, got $w");
  }

  // Also test Mahjong wish via stepSingleBotTurn in mahjongPlay when partner called GT
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \PlayerManager::grandTichuBet(P2, 200);
  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  assertSameVal('mahjongPlay', $game->gamestate->state()['name']);
  \LocalTichuBot::stepSingleBotTurn($game, P0);
  assertSameVal(0, (int) $game->getGameStateValue('mahjongWish'), 'Bot in mahjongPlay must make no wish when partner called GT');

  // 3. Card passing (giveCards): best to partner, lowest 2 to opponents + GT Dog exceptions
  // 3a. Normal case (no GT): P1 passes to [opp0=P0, partner=P3, opp2=P2]
  $game->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
  foreach ([P0, P1, P2, P3] as $pId) {
    callAction($game, $pId, 'grandTichuBet', ['bet' => '0']);
  }
  \LocalTichuScenarios::assignPlayerHands([
    P1 => [
      [1, 1], // Dragon (best)
      [1, 14], // Ace
      [1, 13], // King
      [3, 1], // Dog (must NOT go to opponents in normal case)
      [1, 2], // 2 (lowest)
      [1, 3], // 3 (2nd lowest)
      [1, 5],
      [1, 6],
      [1, 7],
      [1, 8],
      [1, 9],
      [1, 10],
      [1, 11],
      [1, 12],
    ],
  ], 'distribute_14');

  $p1PassIds = \TichuBot::pickThreeCardsToGive(P1);
  callAction($game, P1, 'giveTheCards', ['cards' => implode(';', $p1PassIds)]);
  $dragonId = (string) \LocalTichuScenarios::getCardId(1, 1);
  $twoId = (string) \LocalTichuScenarios::getCardId(1, 2);
  $threeId = (string) \LocalTichuScenarios::getCardId(1, 3);
  $dogId = (string) \LocalTichuScenarios::getCardId(3, 1);
  $tempForPartner = array_values(\CardManager::getDeck()->getCardsInLocation('temporary', P3));
  $tempForOpp0 = array_values(\CardManager::getDeck()->getCardsInLocation('temporary', P0));
  $tempForOpp2 = array_values(\CardManager::getDeck()->getCardsInLocation('temporary', P2));
  assertSameVal($dragonId, (string) $tempForPartner[0]['id'], 'Partner P3 must receive Dragon (best card)');
  assertSameVal($twoId, (string) $tempForOpp0[0]['id'], 'Opponent P0 must receive lowest card (2)');
  assertSameVal($threeId, (string) $tempForOpp2[0]['id'], 'Opponent P2 must receive 2nd lowest card (3)');

  // 3b. Self called GT with Dog: passes Dog to partner P3, low cards to P0 and P2
  $game->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
  foreach ([P0, P1, P2, P3] as $pId) {
    callAction($game, $pId, 'grandTichuBet', ['bet' => $pId === P1 ? '200' : '0']);
  }
  \LocalTichuScenarios::assignPlayerHands([
    P1 => [
      [1, 1], // Dragon
      [2, 1], // Phoenix
      [1, 14], // Ace
      [3, 1], // Dog -> must go to partner P3
      [1, 2],
      [1, 3],
      [1, 5],
      [1, 6],
      [1, 7],
      [1, 8],
      [1, 9],
      [1, 10],
      [1, 11],
      [1, 12],
    ],
  ], 'distribute_14');
  $p1PassGtDog = \TichuBot::pickThreeCardsToGive(P1);
  callAction($game, P1, 'giveTheCards', ['cards' => implode(';', $p1PassGtDog)]);
  $dogId3b = (string) \LocalTichuScenarios::getCardId(3, 1);
  $twoId3b = (string) \LocalTichuScenarios::getCardId(1, 2);
  $threeId3b = (string) \LocalTichuScenarios::getCardId(1, 3);
  $tempForPartner = array_values(\CardManager::getDeck()->getCardsInLocation('temporary', P3));
  $tempForOpp0 = array_values(\CardManager::getDeck()->getCardsInLocation('temporary', P0));
  $tempForOpp2 = array_values(\CardManager::getDeck()->getCardsInLocation('temporary', P2));
  assertSameVal($dogId3b, (string) $tempForPartner[0]['id'], 'Self-GT bot with Dog must pass Dog to partner P3');
  assertSameVal($twoId3b, (string) $tempForOpp0[0]['id'], 'Self-GT opponent P0 must receive lowest card (2)');
  assertSameVal($threeId3b, (string) $tempForOpp2[0]['id'], 'Self-GT opponent P2 must receive 2nd lowest card (3)');

  // 3c. Self called GT without Dog: passes a low card to partner P3 and low cards to opponents
  $game->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
  foreach ([P0, P1, P2, P3] as $pId) {
    callAction($game, $pId, 'grandTichuBet', ['bet' => $pId === P1 ? '200' : '0']);
  }
  \LocalTichuScenarios::assignPlayerHands([
    P1 => [
      [1, 1],
      [2, 1],
      [1, 14],
      [2, 14],
      [1, 2],
      [1, 3],
      [1, 4],
      [1, 6],
      [1, 7],
      [1, 8],
      [1, 9],
      [1, 10],
      [1, 11],
      [1, 12],
    ],
  ], 'distribute_14');
  $p1PassGtNoDog = \TichuBot::pickThreeCardsToGive(P1);
  callAction($game, P1, 'giveTheCards', ['cards' => implode(';', $p1PassGtNoDog)]);
  $passedRanks = array_map(
    static fn($c) => (int) $c['type_arg'],
    array_values(\CardManager::getDeck()->getCards($p1PassGtNoDog))
  );
  sort($passedRanks);
  assertSameVal([2, 3, 4], $passedRanks, 'Self-GT bot without Dog must pass 3 low cards (2, 3, 4) and keep high cards');

  // 3d. Opponent called GT (P0 in slot 0, and P2 in slot 2): passes Dog to GT opponent
  foreach ([P0, P2] as $gtOpp) {
    $game->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
    foreach ([P0, P1, P2, P3] as $pId) {
      callAction($game, $pId, 'grandTichuBet', ['bet' => $pId === $gtOpp ? '200' : '0']);
    }
    \LocalTichuScenarios::assignPlayerHands([
      P1 => [
        [1, 1], // Dragon -> partner P3
        [3, 1], // Dog -> GT opponent
        [1, 2],
        [1, 3],
        [1, 4],
        [1, 6],
        [1, 7],
        [1, 8],
        [1, 9],
        [1, 10],
        [1, 11],
        [1, 12],
        [1, 13],
        [1, 14],
      ],
    ], 'distribute_14');
    $passIds = \TichuBot::pickThreeCardsToGive(P1);
    callAction($game, P1, 'giveTheCards', ['cards' => implode(';', $passIds)]);
    $dragonId3d = (string) \LocalTichuScenarios::getCardId(1, 1);
    $dogId3d = (string) \LocalTichuScenarios::getCardId(3, 1);
    $tempPartner = array_values(\CardManager::getDeck()->getCardsInLocation('temporary', P3));
    $tempGtOpp = array_values(\CardManager::getDeck()->getCardsInLocation('temporary', $gtOpp));
    assertSameVal($dragonId3d, (string) $tempPartner[0]['id'], "When opp $gtOpp calls GT, partner P3 still gets Dragon");
    assertSameVal($dogId3d, (string) $tempGtOpp[0]['id'], "When opp $gtOpp calls GT, $gtOpp must receive Dog");
  }

  // 4. Leading a trick (playComboOpen): lowest rank combined into Pair / Running Pairs / Straight / Full House / Single
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);

  // 4a. Lowest card 2 in a Pair -> leads Pair of 2s
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 2], [2, 2], [1, 7], [1, 9]],
    P1 => [[2, 3]],
    P2 => [[3, 3]],
    P3 => [[4, 3]],
  ], 'captured_p0');
  $game->gamestate->changeActivePlayer(P0);
  \LocalTichuBot::stepSingleBotTurn($game, P0);
  $ledPair = \LogManager::getLastCombo();
  assertSameVal(PAIR_COMBO, (int) $ledPair->type, 'Leading with [2, 2, 7, 9] should lead Pair of 2s');
  assertSameVal(2, (int) $ledPair->getFirstValue());

  // 4b. Lowest card 2 in Running Pairs -> leads Running Pairs 2-2-3-3
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 2], [2, 2], [1, 3], [2, 3], [1, 9]],
    P1 => [[2, 4]],
    P2 => [[3, 4]],
    P3 => [[4, 4]],
  ], 'captured_p0');
  $game->gamestate->changeActivePlayer(P0);
  \LocalTichuBot::stepSingleBotTurn($game, P0);
  $ledRp = \LogManager::getLastCombo();
  assertSameVal(RUNNING_PAIRS_COMBO, (int) $ledRp->type, 'Leading with [2,2,3,3,9] should lead Running Pairs');
  assertSameVal(4, count($ledRp->cards));

  // 4c. Lowest card 2 in a Straight -> leads Straight 2..6 (not bomb when another suit breaks flush)
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 6], [1, 11]],
    P1 => [[2, 4]],
    P2 => [[3, 4]],
    P3 => [[4, 4]],
  ], 'captured_p0');
  $game->gamestate->changeActivePlayer(P0);
  \LocalTichuBot::stepSingleBotTurn($game, P0);
  $ledStraight = \LogManager::getLastCombo();
  assertSameVal(STRAIGHT_COMBO, (int) $ledStraight->type, 'Leading with [2,3,4,5,6] should lead Straight');
  assertSameVal(5, count($ledStraight->cards));

  // 4d. Lowest card 2 in a Full House -> leads Full House 5-5-5-2-2
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 2], [2, 2], [1, 5], [2, 5], [3, 5], [1, 11]],
    P1 => [[2, 4]],
    P2 => [[3, 4]],
    P3 => [[4, 4]],
  ], 'captured_p0');
  $game->gamestate->changeActivePlayer(P0);
  \LocalTichuBot::stepSingleBotTurn($game, P0);
  $ledFh = \LogManager::getLastCombo();
  assertSameVal(FULL_HOUSE_COMBO, (int) $ledFh->type, 'Leading with [2,2,5,5,5,J] should lead Full House');

  // 4e. Lowest card 2 is singleton -> leads single 2
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 2], [1, 5], [2, 5], [1, 8], [2, 8], [3, 8]],
    P1 => [[2, 4]],
    P2 => [[3, 4]],
    P3 => [[4, 4]],
  ], 'captured_p0');
  $game->gamestate->changeActivePlayer(P0);
  \LocalTichuBot::stepSingleBotTurn($game, P0);
  $ledSingle = \LogManager::getLastCombo();
  assertSameVal(SINGLE_COMBO, (int) $ledSingle->type, 'Leading with singleton 2 should lead single 2');
  assertSameVal(2, (int) $ledSingle->getFirstValue());

  // 5. Following in playCombo: always beat opponent, never beat partner, preserve Phoenix when natural combo exists
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 3], [1, 14]], // P0 plays 3
    P1 => [[2, 4], [2, 5]], // P1 (opp) beats 3 with 4
    P2 => [[2, 1], [3, 10], [3, 14]], // P2 (P0's partner) should pass when P1? Wait: P1 led over P0, so P2 beats P1! Let's test both!
    P3 => [[4, 2]], // P3 passes on P2's 10
  ], 'captured_p0');
  $game->gamestate->changeActivePlayer(P0);
  callAction($game, P0, 'playCombo', ['cards' => (string) \LocalTichuScenarios::getCardId(1, 3)]);
  // P1 is opponent of P0 -> MUST beat 3 with 4
  $resP1 = \LocalTichuBot::stepSingleBotTurn($game, P1);
  assertSameVal('playCombo', $resP1['action'], 'P1 must beat opponent P0 single 3');
  assertSameVal(4, (int) \LogManager::getLastCombo()->getFirstValue());
  // P2 is opponent of P1 -> MUST beat 4 with 10 (not Phoenix)
  $resP2 = \LocalTichuBot::stepSingleBotTurn($game, P2);
  assertSameVal('playCombo', $resP2['action'], 'P2 must beat opponent P1 single 4');
  assertSameVal(10, (int) \LogManager::getLastCombo()->getFirstValue());
  // P3 passes (only has 2)
  \LocalTichuBot::stepSingleBotTurn($game, P3);
  // Now P0 (partner of P2!) holds Ace (14), but P2 is currently winning the trick -> P0 MUST pass!
  $resP0 = \LocalTichuBot::stepSingleBotTurn($game, P0);
  assertSameVal('pass', $resP0['action'], 'P0 must never play above partner P2');

  // Test beating multi-card combos (Full House) and natural pair preference over Phoenix
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 3], [2, 3], [3, 3], [1, 2], [2, 2], [1, 12]], // Plays 3s full of 2s
    P1 => [[1, 6], [2, 6], [3, 6], [3, 4], [4, 4]], // Beats with 6s full of 4s
    P2 => [[2, 1], [1, 8], [2, 8], [4, 14]],
    P3 => [[4, 2]],
  ], 'captured_p0');
  $fhP0Ids = \LocalTichuScenarios::getCardIds([[1, 3], [2, 3], [3, 3], [1, 2], [2, 2]]);
  callAction($game, P0, 'playCombo', ['cards' => implode(';', $fhP0Ids)]);
  $resP1Fh = \LocalTichuBot::stepSingleBotTurn($game, P1);
  assertSameVal('playCombo', $resP1Fh['action'], 'P1 must always beat opponent Full House when able');
  assertSameVal(FULL_HOUSE_COMBO, (int) \LogManager::getLastCombo()->type);

  // Natural pair preference over Phoenix: against pair of 4s with [PH, 5, 6, 6], plays [6, 6]
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 4], [2, 4], [1, 12]],
    P1 => [[2, 1], [1, 5], [1, 6], [2, 6]],
    P2 => [[3, 2]],
    P3 => [[4, 2]],
  ], 'captured_p0');
  $pair4Ids = \LocalTichuScenarios::getCardIds([[1, 4], [2, 4]]);
  callAction($game, P0, 'playCombo', ['cards' => implode(';', $pair4Ids)]);
  \LocalTichuBot::stepSingleBotTurn($game, P1);
  $pairPlayed = \LogManager::getLastCombo();
  assertSameVal(PAIR_COMBO, (int) $pairPlayed->type);
  assertSameVal(6, (int) $pairPlayed->getFirstValue(), 'Bot should prefer natural pair of 6s over [Phoenix, 5]');

  // 6. Tichu call: only directly before playing a card when holding >= 4 of the 6 high cards
  $game->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
  foreach ([P0, P1, P2, P3] as $pId) {
    callAction($game, $pId, 'grandTichuBet', ['bet' => '0']);
  }
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[4, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [1, 10], [1, 11], [1, 12], [1, 13], [3, 1]],
    P1 => [[1, 14], [2, 14], [3, 14], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10], [2, 11]],
    P2 => [[3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [2, 12], [2, 13]],
    P3 => [[4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10], [4, 11], [4, 12], [4, 13], [4, 14], [1, 1]],
  ], 'distribute_14');
  // In giveCards, P1 has 14 cards & 4 high cards -> passing must NOT call Tichu
  \LocalTichuBot::stepSingleBotTurn($game, P1);
  assertSameVal('-1', (string) \PlayerManager::getPlayer(P1)['call_tichu'], 'Bot must NOT call Tichu during giveCards');

  // In playCombo: P3 (P1 partner) leads 2, P0 passes, P1 passes with 14 cards & 4 high cards -> must NOT call Tichu when passing
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P3);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[4, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [1, 10], [1, 11], [1, 12], [1, 13], [3, 1]],
    P1 => [[1, 14], [2, 14], [3, 14], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10], [2, 11]], // 14 cards, 4 high cards
    P2 => [[3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [2, 12], [2, 13]],
    P3 => [[4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10], [4, 11], [4, 12], [4, 13], [4, 14], [1, 1]],
  ], 'distribute_14');
  $game->gamestate->changeActivePlayer(P3);
  callAction($game, P3, 'playCombo', ['cards' => (string) \LocalTichuScenarios::getCardId(4, 2)]);
  callAction($game, P0, 'pass', ['onlyOnce' => true]);
  $p1PassRes = \LocalTichuBot::stepSingleBotTurn($game, P1);
  assertSameVal('pass', $p1PassRes['action']);
  assertSameVal('-1', (string) \PlayerManager::getPlayer(P1)['call_tichu'], 'Bot must NOT call Tichu when passing');
  // Now P2 plays 3 (beating P3's 2) -> P3 & P0 pass -> P1 beats opponent P2's 3 and calls Tichu directly before playing!
  callAction($game, P2, 'playCombo', ['cards' => (string) \LocalTichuScenarios::getCardId(3, 3)]);
  callAction($game, P3, 'pass', ['onlyOnce' => true]);
  callAction($game, P0, 'pass', ['onlyOnce' => true]);
  $p1PlayRes = \LocalTichuBot::stepSingleBotTurn($game, P1);
  assertSameVal('playCombo', $p1PlayRes['action']);
  assertSameVal('100', (string) \PlayerManager::getPlayer(P1)['call_tichu'], 'Bot must call Tichu directly before playing card when holding >= 4 high cards');

  // Also test Tichu call right before leading in playComboOpen
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P1);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[4, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [1, 10], [1, 11], [1, 12], [1, 13], [3, 1]],
    P1 => [[1, 14], [2, 14], [3, 14], [1, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10], [2, 11]], // 14 cards, 4 high cards
    P2 => [[3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [2, 12], [2, 13]],
    P3 => [[4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10], [4, 11], [4, 12], [4, 13], [4, 14], [2, 1]],
  ], 'distribute_14');
  $game->gamestate->changeActivePlayer(P1);
  $p1LeadRes = \LocalTichuBot::stepSingleBotTurn($game, P1);
  assertSameVal('playCombo', $p1LeadRes['action']);
  assertSameVal('100', (string) \PlayerManager::getPlayer(P1)['call_tichu'], 'Bot must call Tichu directly before leading in playComboOpen when holding >= 4 high cards');

  // 7. Zombie contrast: zombieTurn must NOT apply smart bot rules (bets 0 in GT, passes on opp single, wishes 15)
  $game->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 14], [2, 14], [3, 14], [4, 14], [1, 1], [2, 1], [1, 2], [1, 3]], // 6 high cards!
  ], 'deck');
  $game->setCurrentPlayerId(P1);
  $game->zombieTurn($game->gamestate->state(), P0);
  assertSameVal('0', (string) \PlayerManager::getPlayer(P0)['call_grand_tichu'], 'Zombie with 6 high cards must still bet 0 in grandTichuBets');

  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 2]],
    P1 => [[1, 14]], // holds Ace against opponent P0's 2
    P2 => [[2, 3]],
    P3 => [[3, 3]],
  ], 'captured_p0');
  callAction($game, P0, 'playCombo', ['cards' => (string) \LocalTichuScenarios::getCardId(1, 2)]);
  $game->setCurrentPlayerId(P0);
  $game->zombieTurn($game->gamestate->state(), P1);
  assertSameVal((string) P2, (string) $game->getActivePlayerId(), 'Zombie P1 holding Ace against opponent 2 still passes');
}

// ============================================================================
// Test 19: test_day1_security_version_i18n_and_zombie_128k_guard
// ============================================================================
function test_day1_security_version_i18n_and_zombie_128k_guard(): void
{
  $game = new \Tichu();
  $callGetAllDatas = static function (\Tichu $g, int $pid): array {
    $fn = \Closure::bind(fn() => $this->getAllDatas($pid), $g, \Tichu::class);
    return $fn();
  };

  // 1. Real-time (isAllInfoExposed == 0) getAllDatas()['capturedCards'] === [] vs isAllInfoExposed == 1 populated capturedCards
  \LocalTichuScenarios::setupScenario($game, 'dragon_gift', P0);
  callAction($game, P3, 'pass', ['onlyOnce' => true]);
  callAction($game, P0, 'collect');
  callAction($game, P0, 'chooseDragonGift', ['player' => 0]);

  $capturedInDb = (int) \CardManager::getDeck()->countCardInLocation('captured');
  assertTrueVal($capturedInDb > 0, 'Cards must be present in captured location after Dragon trick');

  $rtDatas = $callGetAllDatas($game, P0);
  assertSameVal(0, (int) ($rtDatas['isAllInfoExposed'] ?? -1), 'Real-time game must have isAllInfoExposed == 0');
  assertSameVal([], $rtDatas['capturedCards'], 'Real-time getAllDatas() must never expose capturedCards');

  $game->setGameStateValue('isAllInfoExposed', 1);
  $tbDatas = $callGetAllDatas($game, P0);
  assertSameVal(1, (int) ($tbDatas['isAllInfoExposed'] ?? 0), 'Turn-based flag must expose all info');
  assertSameVal($capturedInDb, count($tbDatas['capturedCards']), 'isAllInfoExposed == 1 must populate capturedCards');

  // 2. Zero devConsole notifications recorded in gamelog when getBgaEnvironment() !== 'studio'
  //    (spawn clean subprocess setting app_domain = '0.boardgamearena.com' before Table::getBgaEnvironment() caches static value)
  $prodSubscript = <<<'PHP'
$projectRoot = $argv[1];
require_once $projectRoot . '/local/bga-backend.php';
$g_config['app_domain'] = '0.boardgamearena.com';
require_once $projectRoot . '/tichu.game.php';
require_once $projectRoot . '/tichu.action.php';
require_once $projectRoot . '/local/scenarios.php';
if (\Tichu::getBgaEnvironment() !== 'prod') {
  fwrite(STDERR, 'Expected prod env, got ' . \Tichu::getBgaEnvironment());
  exit(2);
}
$g = new \Tichu();
$g->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 1]);
$p0 = \LocalTichuScenarios::P0;
$p1 = \LocalTichuScenarios::P1;
$p2 = \LocalTichuScenarios::P2;
$p3 = \LocalTichuScenarios::P3;
foreach ([$p0, $p1, $p2, $p3] as $pid) {
  $g->setCurrentPlayerId($pid);
  (new \action_tichu($g, ['bet' => '0']))->grandTichuBet();
}
foreach ([$p0, $p1, $p2, $p3] as $pid) {
  $cards = array_values(\CardManager::getDeck()->getCardsInLocation('hand', $pid));
  $ids = [$cards[0]['id'], $cards[1]['id'], $cards[2]['id']];
  $g->setCurrentPlayerId($pid);
  (new \action_tichu($g, ['cards' => implode(';', $ids)]))->giveTheCards();
}
$beforePkt = (int) \APP_DbObject::getUniqueValueFromDB('SELECT COALESCE(MAX(gamelog_packet_id), 0) FROM gamelog');
$st = $g->gamestate->state(true, false, true);
$starter = (int) $st['active_player'];
$starterCards = array_values(\CardManager::getDeck()->getCardsInLocation('hand', $starter));
$leadId = (int) $starterCards[0]['id'];
foreach ($starterCards as $c) {
  if ((int) $c['type'] === TYPE_MAHJONG && (int) $c['type_arg'] === 1) {
    $leadId = (int) $c['id'];
    break;
  }
}
$g->setCurrentPlayerId($starter);
(new \action_tichu($g, ['cards' => (string) $leadId]))->playCombo();
if ($g->gamestate->state(true, false, true)['name'] === 'mahjongPlay') {
  $g->setCurrentPlayerId($starter);
  (new \action_tichu($g, ['wish' => '15']))->makeAWish();
}
\NotificationManager::devConsole('secret opponent hand info');
$g->sendNotifications();
$devConsoleCount = (int) \APP_DbObject::getUniqueValueFromDB(
  "SELECT COUNT(*) FROM gamelog WHERE gamelog_packet_id > {$beforePkt} AND gamelog_notification LIKE '%\"devConsole\"%'"
);
if ($devConsoleCount !== 0) {
  fwrite(STDERR, "Found {$devConsoleCount} devConsole packets in prod mode");
  exit(3);
}
echo "PROD_NO_DEVCONSOLE_OK";
PHP;
  $cmd = escapeshellarg(PHP_BINARY) . ' -r ' . escapeshellarg($prodSubscript) . ' ' . escapeshellarg(dirname(__DIR__)) . ' 2>&1';
  $subOut = [];
  $subExit = 0;
  exec($cmd, $subOut, $subExit);
  $subOutputStr = implode("\n", $subOut);
  assertSameVal(0, $subExit, 'Prod non-studio devConsole check failed: ' . $subOutputStr);
  assertTrueVal(str_contains($subOutputStr, 'PROD_NO_DEVCONSOLE_OK'), 'Expected PROD_NO_DEVCONSOLE_OK marker');

  // 3. getAllDatas()['codeVersion'] === TICHU_CODE_VERSION and outgoing NotificationManager notifications include codeVersion
  $game->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
  $freshDatas = $callGetAllDatas($game, P0);
  assertSameVal(TICHU_CODE_VERSION, $freshDatas['codeVersion'] ?? null, 'getAllDatas() must expose codeVersion === TICHU_CODE_VERSION');

  $beforeVerPkt = (int) \APP_DbObject::getUniqueValueFromDB('SELECT COALESCE(MAX(gamelog_packet_id), 0) FROM gamelog');
  callAction($game, P0, 'grandTichuBet', ['bet' => '200']);
  callAction($game, P1, 'grandTichuBet', ['bet' => '0']);
  callAction($game, P2, 'grandTichuBet', ['bet' => '0']);
  callAction($game, P3, 'grandTichuBet', ['bet' => '0']);
  $p0Pass = \LocalTichuBot::pickThreeCardsToGive(P0);
  callAction($game, P0, 'giveTheCards', ['cards' => implode(';', $p0Pass)]);

  $verPackets = $game->getNotificationsSince($beforeVerPkt, P0, false);
  $checkedNotifTypes = [];
  $customNotifSet = [
    'dealCards',
    'grandTichuBet',
    'tichuBet',
    'log',
    'playCombo',
    'wishMade',
    'mahjongWishGranted',
    'playerGoOut',
    'pass',
    'devConsole',
    'tableWindow',
    'newScores',
    'captureCards',
    'autopass',
    'confirmTichu',
    'acceptCards',
    'passCards',
    'botSuggestion',
  ];
  foreach ($verPackets as $pkt) {
    foreach ($pkt['data'] ?? [] as $notif) {
      $nType = (string) ($notif['type'] ?? '');
      if (in_array($nType, $customNotifSet, true)) {
        assertSameVal(
          TICHU_CODE_VERSION,
          $notif['args']['codeVersion'] ?? null,
          "Notification '{$nType}' must carry codeVersion === TICHU_CODE_VERSION"
        );
        $checkedNotifTypes[$nType] = true;
      }
    }
  }
  assertTrueVal(isset($checkedNotifTypes['grandTichuBet']), 'Should have verified broadcast grandTichuBet codeVersion');
  assertTrueVal(isset($checkedNotifTypes['dealCards']), 'Should have verified private dealCards codeVersion');
  assertTrueVal(isset($checkedNotifTypes['passCards']), 'Should have verified private passCards codeVersion');

  // 4. LogManager single-quote escaping, CardManager::setPassedCards([]) safe no-op, PlayerManager::getSelectStmnt & getNextPlayers
  $quoteAction = "q'test";
  $quotePayload = [
    'note' => "O'Malley's \"Grand\" Tichu \\ backslash 'quote'",
    'nested' => ["it's fine"],
  ];
  \LogManager::insert(P0, $quoteAction, $quotePayload);
  $fetchedLogs = \LogManager::getLastActions([$quoteAction], 1);
  assertSameVal(1, count($fetchedLogs), 'LogManager::getLastActions must find action containing single quote');
  assertSameVal((string) P0, (string) $fetchedLogs[0]['player'], 'Round-tripped log player should be P0');
  assertSameVal($quotePayload, $fetchedLogs[0]['arg'], 'LogManager::insert & getLastActions must round-trip single quotes cleanly');

  $tempCountBefore = (int) \CardManager::getDeck()->countCardInLocation('temporary');
  \CardManager::setPassedCards([], P0);
  \CardManager::setPassedCards([0, -1], P0);
  $tempCountAfter = (int) \CardManager::getDeck()->countCardInLocation('temporary');
  assertSameVal($tempCountBefore, $tempCountAfter, 'CardManager::setPassedCards([]) must be a safe no-op');

  $selectSql = \PlayerManager::getSelectStmnt(['player_id' => P0, 'name' => "D'Artagnan"]);
  assertTrueVal(
    str_contains($selectSql, "player_id = '" . P0 . "'"),
    "PlayerManager::getSelectStmnt(['player_id' => P0]) must retain = '<id>' comparison, got: $selectSql"
  );
  assertTrueVal(
    str_contains($selectSql, "D\\'Artagnan"),
    "PlayerManager::getSelectStmnt must escape single quotes, got: $selectSql"
  );
  $queriedPlayers = \APP_DbObject::getCollectionFromDb(\PlayerManager::getSelectStmnt(['player_id' => P0]));
  assertSameVal(1, count($queriedPlayers), 'getSelectStmnt([player_id => P0]) query must return exactly P0');
  assertSameVal((string) P0, (string) $queriedPlayers[P0]['id']);

  $game->setCurrentPlayerId(0);
  $nextAsc = array_map(static fn($p) => (int) $p['id'], \PlayerManager::getNextPlayers(P0, false));
  $nextDesc = array_map(static fn($p) => (int) $p['id'], \PlayerManager::getNextPlayers(P0, true));
  assertSameVal([P1, P2, P3, P0], $nextAsc, 'PlayerManager::getNextPlayers(P0, false) must order [P1, P2, P3, P0] without session');
  assertSameVal([P3, P2, P1, P0], $nextDesc, 'PlayerManager::getNextPlayers(P0, true) must order [P3, P2, P1, P0] without session');

  // 5. Mahjong wish UserException carrying NotificationMessage template and $e->args['rank'] (face card + numeric rank)
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  $mahjongId = (string) \LocalTichuScenarios::getCardId(4, 1);
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  callAction($game, P0, 'makeAWish', ['wish' => 11]); // Jack (translatable rank)
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[2, 2]],
    P1 => [[1, 11], [1, 10]], // holds Jack (11) and 10
    P2 => [[3, 2]],
    P3 => [[4, 2]],
  ], 'captured_p0');
  $game->gamestate->changeActivePlayer(P1);

  // 5a. playCombo violation on Jack wish -> template + args['rank'] = 'Jack' + args['i18n'] = ['rank']
  $caughtPlayJack = null;
  try {
    callAction($game, P1, 'playCombo', ['cards' => (string) \LocalTichuScenarios::getCardId(1, 10)]);
  } catch (\Bga\GameFramework\UserException $e) {
    $caughtPlayJack = $e;
  }
  assertTrueVal($caughtPlayJack !== null, 'Playing 10 when holding wished Jack must throw UserException');
  assertSameVal(
    'You must grant the Mahjong Wish and play a ${rank}',
    $caughtPlayJack->getMessage(),
    'Mahjong wish playCombo UserException must preserve NotificationMessage template'
  );
  assertSameVal('Jack', $caughtPlayJack->args['rank'] ?? null, 'Mahjong wish args[rank] should be Jack');
  assertSameVal(['rank'], $caughtPlayJack->args['i18n'] ?? null, 'Translatable Jack wish must include i18n => [rank]');

  // 5b. pass violation on numeric 9 wish -> template + args['rank'] = '9' (no i18n on bare number)
  $game->setGameStateValue('mahjongWish', 9);
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[2, 2]],
    P1 => [[1, 9], [1, 10]],
    P2 => [[3, 2]],
    P3 => [[4, 2]],
  ], 'captured_p0');
  $caughtPassNine = null;
  try {
    callAction($game, P1, 'pass', ['onlyOnce' => true]);
  } catch (\Bga\GameFramework\UserException $e) {
    $caughtPassNine = $e;
  }
  assertTrueVal($caughtPassNine !== null, 'Passing when holding wished 9 must throw UserException');
  assertSameVal(
    'You must grant the Mahjong Wish and play a ${rank}',
    $caughtPassNine->getMessage(),
    'Mahjong wish pass UserException must preserve NotificationMessage template'
  );
  assertSameVal('9', $caughtPassNine->args['rank'] ?? null, 'Mahjong wish args[rank] should be 9');
  assertTrueVal(!isset($caughtPassNine->args['i18n']), 'Numeric wish 9 must omit i18n array');

  // 6a. All-4-zombie cascade terminating cleanly in ST_GAME_END (99)
  $allZombieGame = new \Tichu();
  $allZombieGame->createNewGame(['gameLength' => 1, 'playerTeams' => TEAM_1_3, 'turnBased' => 0]);
  \APP_DbObject::DbQuery('UPDATE player SET player_zombie = 1');
  $allZombieGame->reloadPlayersBasicInfos();
  $allZombieGame->setCurrentPlayerId(P0);
  $allZombieGame->beginPlayerAction();
  foreach ([P0, P1, P2, P3] as $zPid) {
    $curSt = $allZombieGame->gamestate->state(true, false, true);
    if ((int) ($curSt['id'] ?? 0) === ST_GAME_END) {
      break;
    }
    $allZombieGame->zombieTurn($curSt, $zPid);
  }
  $allZombieGame->endPlayerAction(false);
  assertSameVal(
    ST_GAME_END,
    (int) $allZombieGame->gamestate->state_id(),
    'All-4-zombie table must jump cleanly to ST_GAME_END (99)'
  );
  // Subsequent zombieTurn in ST_GAME_END must be a clean no-op
  $allZombieGame->zombieTurn($allZombieGame->gamestate->state(true, false, true), P1);
  assertSameVal(ST_GAME_END, (int) $allZombieGame->gamestate->state_id(), 'zombieTurn at ST_GAME_END must stay at 99');

  // 6b. Multi-turn 3-zombie cascade flushing packets mid-request (% 15) with per-packet size well below 131072 bytes
  $cascadeGame = new \Tichu();
  \LocalTichuScenarios::setupScenario($cascadeGame, 'mahjong_wish', P0);
  // Set gameLength = 3 (2000 pts) so round end transitions into Round 2 rather than ending immediately if scores stay low
  $cascadeGame->setGameStateValue('gameLength', 3);
  // Give P0 just 1 card ([1, 2]) and distribute 14 cards each to zombies P1, P2, P3 (42 cards), rest captured by P0 (13 cards)
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[1, 2]],
    P1 => [
      [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9],
      [1, 10], [1, 11], [1, 12], [1, 13], [1, 14], [2, 2], [2, 3],
    ],
    P2 => [
      [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10],
      [2, 11], [2, 12], [2, 13], [2, 14], [3, 2], [3, 3], [3, 4],
    ],
    P3 => [
      [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10], [3, 11],
      [3, 12], [3, 13], [3, 14], [4, 2], [4, 3], [4, 4], [4, 5],
    ],
  ], 'captured_p0');
  \APP_DbObject::DbQuery('UPDATE player SET player_zombie = 1 WHERE player_id IN (' . P1 . ', ' . P2 . ', ' . P3 . ')');
  \APP_DbObject::DbQuery('UPDATE player SET player_zombie = 0 WHERE player_id = ' . P0);
  $cascadeGame->reloadPlayersBasicInfos();
  $cascadeGame->gamestate->changeActivePlayer(P0);

  // P0 plays its single remaining card -> zombies P1, P2, P3 pass -> P0 collects its going-out trick ->
  // now P0 has 0 cards so zombies P1, P2, P3 cascade through all remaining tricks of Round 1 and into
  // Round 2's grandTichuBets (where P0 becomes multiactive again) in a single HTTP collect request!
  callAction($cascadeGame, P0, 'playCombo', ['cards' => (string) \LocalTichuScenarios::getCardId(1, 2)]);
  assertSameVal('confirmTrick', $cascadeGame->gamestate->state(true, false, true)['name'], 'P0 should confirm its going-out trick');

  $beforeCascadePkt = (int) \APP_DbObject::getUniqueValueFromDB('SELECT COALESCE(MAX(gamelog_packet_id), 0) FROM gamelog');
  $beforeZombieTurnRows = (int) \APP_DbObject::getUniqueValueFromDB("SELECT COUNT(*) FROM actionlog WHERE log_action = 'zombieTurn'");

  callAction($cascadeGame, P0, 'collect');

  $afterZombieTurnRows = (int) \APP_DbObject::getUniqueValueFromDB("SELECT COUNT(*) FROM actionlog WHERE log_action = 'zombieTurn'");
  $zombieStepsExecuted = $afterZombieTurnRows - $beforeZombieTurnRows;
  assertTrueVal(
    $zombieStepsExecuted >= 30,
    "Expected >= 30 zombie steps in 3-zombie cascade, got {$zombieStepsExecuted}"
  );

  $cascadeRows = \APP_DbObject::getObjectListFromDB(
    "SELECT gamelog_packet_id, gamelog_move_id, LENGTH(gamelog_notification) AS byte_len, gamelog_notification FROM gamelog WHERE gamelog_packet_id > {$beforeCascadePkt} ORDER BY gamelog_packet_id ASC"
  );
  assertTrueVal(count($cascadeRows) > 0, 'Cascade must record notification packets in gamelog');
  $distinctMoves = [];
  $maxPacketBytes = 0;
  $zombieLogMsgCount = 0;
  foreach ($cascadeRows as $cRow) {
    $byteLen = (int) $cRow['byte_len'];
    if ($byteLen > $maxPacketBytes) {
      $maxPacketBytes = $byteLen;
    }
    assertTrueVal(
      $byteLen < 131072,
      "Every gamelog packet must stay well below 131072 bytes (got {$byteLen})"
    );
    if ($cRow['gamelog_move_id'] !== null) {
      $distinctMoves[(string) $cRow['gamelog_move_id']] = true;
    }
    $decodedNotifs = json_decode((string) $cRow['gamelog_notification'], true);
    if (is_array($decodedNotifs)) {
      foreach ($decodedNotifs as $dn) {
        if (($dn['type'] ?? '') === 'log' && str_contains((string) ($dn['log'] ?? ''), 'makes a zombie turn')) {
          $zombieLogMsgCount++;
        }
      }
    }
  }
  assertTrueVal(
    count($distinctMoves) >= 3,
    'Mid-request sendNotifications() (% 15) must flush multiple move batches (got ' . count($distinctMoves) . ')'
  );
  assertTrueVal(
    $maxPacketBytes < 65536,
    "Mid-request flushes should keep max packet size < 64 KB (got {$maxPacketBytes} bytes)"
  );
  assertSameVal(
    3,
    $zombieLogMsgCount,
    'Zombie turn log message must be deduplicated to once per zombie player (3) per request'
  );
  $afterCascadeStateName = (string) ($cascadeGame->gamestate->state(true, false, true)['name'] ?? '');
  assertTrueVal(
    in_array($afterCascadeStateName, ['grandTichuBets', 'giveCards'], true),
    "Cascade must pause cleanly at Round 2 multiactive state where live P0 is active (got {$afterCascadeStateName})"
  );
  assertTrueVal($cascadeGame->gamestate->isPlayerActive(P0), 'Live player P0 must be active after 3-zombie cascade');
}

// ============================================================================
// Test 20: test_passed_card_origin_and_first_move_persistence
// ============================================================================
function test_passed_card_origin_and_first_move_persistence(): void
{
  $game = new \Tichu();
  $callGetAllDatas = static function (\Tichu $g, int $pid): array {
    $fn = \Closure::bind(fn() => $this->getAllDatas($pid), $g, \Tichu::class);
    return $fn();
  };

  \LocalTichuScenarios::setupScenario($game, 'give_cards', P0);
  $beforePassDatas = $callGetAllDatas($game, P0);
  assertSameVal(false, $beforePassDatas['hasPlayedOrPassedInRound'] ?? null, 'Before passing, hasPlayedOrPassedInRound must be false');

  $p0PassIds = \LocalTichuScenarios::getCardIds([[1, 2], [2, 2], [3, 2]]);
  callAction($game, P0, 'giveTheCards', ['cards' => implode(';', $p0PassIds) . ';']);
  assertSameVal('playComboOpen', $game->gamestate->state()['name'], 'Should transition to playComboOpen after passing');

  // 1. P0 receives (1,3) from P1, (4,7) from P2, and (4,11) from P3; other 11 cards have null passed_from
  $datasP0 = $callGetAllDatas($game, P0);
  assertSameVal(14, count($datasP0['hand']), 'P0 hand must contain 14 cards after acceptCards');
  assertSameVal(false, $datasP0['hasPlayedOrPassedInRound'] ?? null, 'hasPlayedOrPassedInRound must be false immediately after acceptCards');

  $expectedOriginsP0 = [
    (string) \LocalTichuScenarios::getCardId(1, 3) => (string) P1,
    (string) \LocalTichuScenarios::getCardId(4, 7) => (string) P2,
    (string) \LocalTichuScenarios::getCardId(4, 11) => (string) P3,
  ];
  $foundPassedCountP0 = 0;
  foreach ($datasP0['hand'] as $c) {
    $cid = (string) $c['id'];
    if (isset($expectedOriginsP0[$cid])) {
      assertSameVal($expectedOriginsP0[$cid], (string) $c['passed_from'], "Card $cid passed_from mismatch");
      $foundPassedCountP0++;
    } else {
      assertSameVal(null, $c['passed_from'], "Non-passed card $cid must have null passed_from");
    }
  }
  assertSameVal(3, $foundPassedCountP0, 'P0 must see exactly 3 cards with passed_from');

  // 2. P1 only sees P1's own hand and own passed_from; spectator sees empty hand and false
  $datasP1 = $callGetAllDatas($game, P1);
  assertSameVal(14, count($datasP1['hand']), 'P1 hand must contain 14 cards');
  assertSameVal(false, $datasP1['hasPlayedOrPassedInRound'] ?? null, 'P1 hasPlayedOrPassedInRound must initially be false');
  $p1HandIds = array_map(static fn($c) => (string) $c['id'], $datasP1['hand']);
  foreach (array_keys($expectedOriginsP0) as $p0ReceivedId) {
    assertTrueVal(!in_array($p0ReceivedId, $p1HandIds, true), 'P1 hand must not contain P0 received cards');
  }
  $datasSpec = $callGetAllDatas($game, 0);
  assertSameVal([], $datasSpec['hand'], 'Spectator getAllDatas hand must be empty');
  assertSameVal(false, $datasSpec['hasPlayedOrPassedInRound'] ?? null, 'Spectator hasPlayedOrPassedInRound must be false');

  // 3. Calling Tichu does NOT flip hasPlayedOrPassedInRound
  callAction($game, P0, 'tichuBet', ['bet' => '100']);
  assertSameVal(
    false,
    $callGetAllDatas($game, P0)['hasPlayedOrPassedInRound'] ?? null,
    'Calling Tichu must keep hasPlayedOrPassedInRound === false'
  );

  // 4. P0 plays a single card -> P0 flips to true, while P1 stays false until P1 passes
  $single9 = (string) \LocalTichuScenarios::getCardId(1, 9);
  callAction($game, P0, 'playCombo', ['cards' => $single9]);
  assertSameVal(
    true,
    $callGetAllDatas($game, P0)['hasPlayedOrPassedInRound'] ?? null,
    'Playing a combo must set hasPlayedOrPassedInRound === true for P0'
  );
  assertSameVal(
    false,
    $callGetAllDatas($game, P1)['hasPlayedOrPassedInRound'] ?? null,
    'P0 playing must not affect P1 hasPlayedOrPassedInRound'
  );

  callAction($game, P1, 'pass', ['onlyOnce' => true]);
  assertSameVal(
    true,
    $callGetAllDatas($game, P1)['hasPlayedOrPassedInRound'] ?? null,
    'Passing must set hasPlayedOrPassedInRound === true for P1'
  );

  // 5. New round resets both passed_from and hasPlayedOrPassedInRound
  \LocalTichuScenarios::setupScenario($game, 'double_victory', P2);
  \APP_DbObject::DbQuery('UPDATE card SET card_passed_from = ' . P1 . ' WHERE card_location = "hand" AND card_location_arg = ' . P2 . ' LIMIT 1');
  $lastCardId = (string) \LocalTichuScenarios::getCardId(1, 14);
  callAction($game, P2, 'playCombo', ['cards' => $lastCardId]);
  assertSameVal('grandTichuBets', $game->gamestate->state()['name'], 'Double victory should advance to next round grandTichuBets');

  $nonNullPassedAfterReset = (int) \APP_DbObject::getUniqueValueFromDB('SELECT COUNT(*) FROM card WHERE card_passed_from IS NOT NULL');
  assertSameVal(0, $nonNullPassedAfterReset, 'stNewRound must clear card_passed_from on all cards');

  $r2DatasP0 = $callGetAllDatas($game, P0);
  assertSameVal(false, $r2DatasP0['hasPlayedOrPassedInRound'] ?? null, 'New round must reset hasPlayedOrPassedInRound to false');
  foreach ($r2DatasP0['hand'] as $c) {
    assertSameVal(null, $c['passed_from'], 'New round hand cards must have null passed_from');
  }
}

// ============================================================================
// Test 21: test_partner_tichu_confirmation_beyond_threshold (#80004)
// ============================================================================
function test_partner_tichu_confirmation_beyond_threshold(): void
{
  $game = new \Tichu();
  \LocalTichuScenarios::setupScenario($game, 'grand_tichu', P0);

  $findConfirmNotif = static function (\Tichu $g, int $sincePacketId, int $playerId): ?array {
    $pkts = $g->getNotificationsSince($sincePacketId, $playerId, false);
    foreach ($pkts as $pkt) {
      foreach ($pkt['data'] ?? [] as $ev) {
        if (($ev['type'] ?? '') === 'confirmTichu') {
          return $ev['args'] ?? null;
        }
      }
    }
    return null;
  };

  // 1) P0 calls Grand Tichu (200), then simulate turn-based delay (> 2 hours ago)
  callAction($game, P0, 'grandTichuBet', ['bet' => '200']);
  assertSameVal('200', (string) \PlayerManager::getPlayer(P0)['call_grand_tichu']);
  $oldTs = (string) (time() - 7200);
  \APP_DbObject::DbQuery("UPDATE actionlog SET log_arg = '$oldTs' WHERE log_action = 'tichuCall'");

  // 2) P2 (P0's partner) calls Grand Tichu (200) hours later -> MUST trigger partner confirmTichu!
  $beforePkt = (int) \APP_DbObject::getUniqueValueFromDB('SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog');
  callAction($game, P2, 'grandTichuBet', ['bet' => '200']);
  assertSameVal('-1', (string) \PlayerManager::getPlayer(P2)['call_grand_tichu'], 'Partner GT bet >60s later must require confirmation');
  assertTrueVal($game->gamestate->isPlayerActive(P2), 'P2 must remain multiactive while awaiting partner GT confirmation');
  $confirmP2 = $findConfirmNotif($game, $beforePkt, P2);
  assertTrueVal($confirmP2 !== null, 'P2 must receive confirmTichu notification');
  assertSameVal(true, (bool) $confirmP2['grand'], 'P2 confirmTichu must have grand=true');
  assertTrueVal(
    str_contains((string) ($confirmP2['msg'] ?? ''), 'partner has already called Tichu'),
    'P2 confirmTichu must show partner warning message'
  );

  // 3) P1 (opponent, whose partner P3 has NOT called) calls Grand Tichu (200) hours later -> commits immediately!
  callAction($game, P1, 'grandTichuBet', ['bet' => '200']);
  assertSameVal('200', (string) \PlayerManager::getPlayer(P1)['call_grand_tichu'], 'Opponent GT bet >60s later must commit without prompt');
  assertTrueVal(!$game->gamestate->isPlayerActive(P1), 'P1 should be non-multiactive after committing GT');

  // 4) P2 confirms through the partner warning -> commits Grand Tichu (200)
  callAction($game, P2, 'confirmTichu', ['bet' => '200']);
  assertSameVal('200', (string) \PlayerManager::getPlayer(P2)['call_grand_tichu'], 'P2 GT bet must commit after confirmTichu(200)');
  assertTrueVal(!$game->gamestate->isPlayerActive(P2), 'P2 should be non-multiactive after confirming GT');

  // 5) Advance to giveCards (P3 declines GT), age tichuCall > 2 hours, then P3 (P1's partner) calls regular Tichu (100)
  callAction($game, P3, 'grandTichuBet', ['bet' => '0']);
  assertSameVal('giveCards', $game->gamestate->state()['name']);
  \APP_DbObject::DbQuery("UPDATE actionlog SET log_arg = '$oldTs' WHERE log_action = 'tichuCall'");

  $beforePkt = (int) \APP_DbObject::getUniqueValueFromDB('SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog');
  callAction($game, P3, 'tichuBet', ['bet' => '100']);
  assertSameVal('-1', (string) \PlayerManager::getPlayer(P3)['call_tichu'], 'Partner Tichu after partner GT >60s later must require confirmation');
  $confirmP3 = $findConfirmNotif($game, $beforePkt, P3);
  assertTrueVal($confirmP3 !== null, 'P3 must receive confirmTichu notification');
  assertSameVal(false, (bool) $confirmP3['grand'], 'P3 confirmTichu must have grand=false');
  assertTrueVal(
    str_contains((string) ($confirmP3['msg'] ?? ''), 'partner has already called Tichu'),
    'P3 confirmTichu must show partner warning message'
  );
  callAction($game, P3, 'confirmTichu', ['bet' => '100']);
  assertSameVal('100', (string) \PlayerManager::getPlayer(P3)['call_tichu'], 'P3 Tichu bet must commit after confirmTichu(100)');

  // 6) Partner called regular Tichu (100) hours earlier in playComboOpen -> partner Tichu (100) requires confirmation
  \LocalTichuScenarios::setupScenario($game, 'mahjong_wish', P0);
  callAction($game, P0, 'tichuBet', ['bet' => '100']);
  assertSameVal('100', (string) \PlayerManager::getPlayer(P0)['call_tichu']);
  \APP_DbObject::DbQuery("UPDATE actionlog SET log_arg = '$oldTs' WHERE log_action = 'tichuCall'");

  $beforePkt = (int) \APP_DbObject::getUniqueValueFromDB('SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog');
  callAction($game, P2, 'tichuBet', ['bet' => '100']);
  assertSameVal('-1', (string) \PlayerManager::getPlayer(P2)['call_tichu'], 'Partner Tichu after partner Tichu >60s later must require confirmation');
  $confirmP2Tichu = $findConfirmNotif($game, $beforePkt, P2);
  assertTrueVal($confirmP2Tichu !== null, 'P2 must receive confirmTichu for regular Tichu');
  assertTrueVal(
    str_contains((string) ($confirmP2Tichu['msg'] ?? ''), 'partner has already called Tichu'),
    'P2 regular Tichu confirmTichu must show partner warning message'
  );

  // 7) Unwinnable (firstOutPlayer != 0) takes precedence over partner warning
  \APP_DbObject::DbQuery('UPDATE global SET global_value = ' . P1 . ' WHERE global_id = 21');
  $beforePkt = (int) \APP_DbObject::getUniqueValueFromDB('SELECT IFNULL(MAX(gamelog_packet_id), 0) FROM gamelog');
  callAction($game, P2, 'tichuBet', ['bet' => '100']);
  $confirmUnwinnable = $findConfirmNotif($game, $beforePkt, P2);
  assertTrueVal($confirmUnwinnable !== null, 'P2 must receive confirmTichu when firstOutPlayer != 0');
  assertTrueVal(
    str_contains((string) ($confirmUnwinnable['msg'] ?? ''), "can't win this tichu bet"),
    'Unwinnable warning must take precedence over partner warning'
  );

  // 8) Resetting Tichus for a new round clears partner bet so P2 is not prompted
  \APP_DbObject::DbQuery('UPDATE global SET global_value = 0 WHERE global_id = 21');
  \PlayerManager::resetTichus();
  callAction($game, P2, 'tichuBet', ['bet' => '100']);
  assertSameVal('100', (string) \PlayerManager::getPlayer(P2)['call_tichu'], 'After resetTichus in new round, P2 must commit without partner prompt');
}

$tests = [
  'test_new_game_and_deal_8_cards',
  'test_grand_tichu_and_tichu_bets_and_confirmation_threshold',
  'test_give_cards_and_accept_passed_cards_and_bomb_passing_stat',
  'test_mahjong_lead_wish_creation_enforcement_and_fulfillment',
  'test_dog_lead_transfer_and_restrictions',
  'test_phoenix_single_and_ambiguous_combo_choice_and_cancel',
  'test_bomb_out_of_turn_interrupt_cancel_and_play',
  'test_dragon_trick_win_and_choose_dragon_gift',
  'test_autopass_once_trick_and_cancel_plus_turn_based_smart_skip',
  'test_double_victory_and_normal_round_scoring',
  'test_full_multi_round_game_to_completion',
  'test_zombie_turns_across_all_states',
  'test_action_and_parameter_validation_and_card_to_str',
  'test_table_lock_version_and_duplicate_requests',
  'test_stale_snapshot_multiactive_and_notif_ordering',
  'test_production_bug_sql_loader_and_player_id_remapping',
  'test_studio_debug_bot_step_and_bot_others',
  'test_smart_bot_strategy_and_decisions',
  'test_day1_security_version_i18n_and_zombie_128k_guard',
  'test_passed_card_origin_and_first_move_persistence',
  'test_partner_tichu_confirmation_beyond_threshold',
];

echo "====================================================================\n";
echo " Tichu Local Backend Integration Test Suite (MySQL 8.0 + BGA FW)\n";
echo "====================================================================\n";

$passed = 0;
$failed = 0;

foreach ($tests as $testFn) {
  $t0 = microtime(true);
  try {
    $testFn();
    $elapsedMs = (microtime(true) - $t0) * 1000.0;
    printf("[PASS] %-62s (%6.2f ms)\n", $testFn, $elapsedMs);
    $passed++;
  } catch (\Throwable $e) {
    $elapsedMs = (microtime(true) - $t0) * 1000.0;
    printf("[FAIL] %-62s (%6.2f ms)\n", $testFn, $elapsedMs);
    echo "       Error: " . $e->getMessage() . "\n";
    echo "       At:    " . $e->getFile() . ":" . $e->getLine() . "\n";
    $failed++;
  }
}

$totalMs = (microtime(true) - $suiteStart) * 1000.0;
echo "--------------------------------------------------------------------\n";
printf(
  " Results: %d passed, %d failed, %d total | Total time: %.2f ms\n",
  $passed,
  $failed,
  count($tests),
  $totalMs
);
echo "====================================================================\n";

exit($failed === 0 ? 0 : 1);
