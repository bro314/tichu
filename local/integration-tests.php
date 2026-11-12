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

// Force in-memory SQLite database
putenv('TICHU_DB_PATH=:memory:');

ob_start();
require_once __DIR__ . '/bga-backend.php';
require_once $projectRoot . '/tichu.game.php';
require_once $projectRoot . '/tichu.action.php';
require_once $projectRoot . '/tichu.view.php';
require_once __DIR__ . '/bot.php';
require_once __DIR__ . '/scenarios.php';
ob_end_clean();

\APP_DbObject::setDbPath(':memory:');

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
  assertSameVal(24, $deck->countCardInLocation('deck'), '24 cards should remain in deck after dealing 8 each');
  foreach ([P0, P1, P2, P3] as $pId) {
    assertSameVal(8, $deck->countCardInLocation('hand', $pId), "Player $pId should hold 8 cards");
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
  $beforePacketId = (int) \APP_DbObject::getUniqueValueFromDB("SELECT IFNULL(MAX(packet_id), 0) FROM notifications");
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
  assertSameVal(0, $deck->countCardInLocation('deck'), 'Deck should be empty after dealing last 6 cards');
  foreach ([P0, P1, P2, P3] as $pId) {
    assertSameVal(14, $deck->countCardInLocation('hand', $pId), "Player $pId should now have 14 cards");
  }

  // Pass 3 cards for all 4 players so the game transitions to playComboOpen (trick 1, log_trick = 1)
  foreach ([P0, P1, P2, P3] as $pId) {
    $handCards = array_values($deck->getCardsInLocation('hand', $pId));
    $passIds = [$handCards[0]['id'], $handCards[1]['id'], $handCards[2]['id']];
    callAction($game, $pId, 'giveTheCards', ['cards' => implode(';', $passIds) . ';']);
  }
  assertSameVal('playComboOpen', $game->gamestate->state()['name'], 'Should transition to playComboOpen in Trick 1');
  assertSameVal(1, (int) \LogManager::getCurrentRoundAndTrick()['trick'], 'Trick should now be 1');

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
  callAction($game, P0, 'giveTheCards', ['cards' => implode(';', $p0PassIds) . ';']);

  $state = $game->gamestate->state(P0);
  assertSameVal('playComboOpen', $state['name'], 'Should transition to playComboOpen after all 4 players pass');
  assertSameVal((string) P0, $state['active_player'], 'P0 holds Mahjong and should be active in playComboOpen');
  assertSameVal(P0, (int) $game->getGameStateValue('mahjongOwner'), 'mahjongOwner should be P0');

  // Verify all 4 players have 14 cards in hand and 0 in temporary
  $deck = \CardManager::getDeck();
  assertSameVal(0, $deck->countCardInLocation('temporary'), 'No cards should remain in temporary');
  foreach ([P0, P1, P2, P3] as $pId) {
    assertSameVal(14, $deck->countCardInLocation('hand', $pId), "Player $pId should have 14 cards after accepting");
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

  // 2b. P1 cannot bypass the Mahjong wish by playing a bomb (2-3-4-5-6 Stars) that does not contain 9!
  $nonWishedBombIds = \LocalTichuScenarios::getCardIds([[2, 2], [2, 3], [2, 4], [2, 5], [2, 6]]);
  assertThrowsUserException(
    static fn() => callAction($game, P1, 'playCombo', ['cards' => implode(';', $nonWishedBombIds)]),
    'grant the Mahjong Wish',
    'P1 must not be allowed to bypass the Mahjong wish by playing a bomb not containing 9'
  );

  // 3. P1 plays the 9 -> fulfills wish and resets mahjongWish to 0!
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
  callAction($game, P0, 'playCombo', ['cards' => $mahjongId]);
  callAction($game, P0, 'makeAWish', ['wish' => 11]);
  $aceStarsId = (string) \LocalTichuScenarios::getCardId(2, 14);
  callAction($game, P1, 'playCombo', ['cards' => $aceStarsId]);
  assertSameVal((string) P2, $game->getActivePlayerId(), 'Turn should advance to P2 after P1 plays Ace');
  callAction($game, P2, 'pass', ['onlyOnce' => true]);
  assertSameVal((string) P3, $game->getActivePlayerId(), 'P2 must be allowed to pass when 5-9 straight flush does not contain wished Jack (11)');

  // 5. Verify a player holding both a bomb with the wished rank (four 11s) and a bomb without it (2-6 Stars)
  // when lastCombo = Ace cannot play the non-wished bomb and must play the wished bomb
  \LocalTichuScenarios::assignPlayerHands([
    P0 => [[2, 2]],
    P1 => [[2, 3]],
    P2 => [[3, 2]],
    P3 => [[1, 11], [2, 11], [3, 11], [4, 11], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8]],
  ], 'captured_p0');
  $nonWishedBomb2 = \LocalTichuScenarios::getCardIds([[2, 4], [2, 5], [2, 6], [2, 7], [2, 8]]);
  assertThrowsUserException(
    static fn() => callAction($game, P3, 'playCombo', ['cards' => implode(';', $nonWishedBomb2)]),
    'grant the Mahjong Wish',
    'P3 must not play a non-wished bomb when holding a bomb that fulfills the wish'
  );
  $wishedBomb = \LocalTichuScenarios::getCardIds([[1, 11], [2, 11], [3, 11], [4, 11]]);
  callAction($game, P3, 'playCombo', ['cards' => implode(';', $wishedBomb)]);
  assertSameVal(0, (int) $game->getGameStateValue('mahjongWish'), 'Playing the wished bomb of Jacks should grant the wish');
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
  assertSameVal(14, \CardManager::getDeck()->countCardInLocation('hand', P0), 'P0 should still have all 14 cards');

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
  assertSameVal(9, (int) $lastCombo->phoenixValue);

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

  $beforeDvPacketId = (int) \APP_DbObject::getUniqueValueFromDB("SELECT IFNULL(MAX(packet_id), 0) FROM notifications");
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

  $beforePairPacketId = (int) \APP_DbObject::getUniqueValueFromDB("SELECT IFNULL(MAX(packet_id), 0) FROM notifications");
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
// Runner Execution
// ============================================================================
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
];

echo "====================================================================\n";
echo " Tichu Local Backend Integration Test Suite (SQLite :memory:)\n";
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
