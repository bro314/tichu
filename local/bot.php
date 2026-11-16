<?php
/**
 * Local Tichu Runner bot wrapper around modules/Bot.php (TichuBot).
 * Automatically manages local runner DB transactions when called outside an active action.
 */

require_once dirname(__DIR__) . '/modules/Bot.php';

class LocalTichuBot extends \TichuBot
{
  /**
   * @return array<int|string, mixed>
   */
  private static function runInTransaction(\Tichu $game, callable $fn): array
  {
    $needTx = !$game->inPlayerAction;
    if ($needTx) {
      $game->beginPlayerAction();
    }
    $rollback = false;
    try {
      return $fn();
    } catch (\Throwable $e) {
      $rollback = true;
      throw $e;
    } finally {
      if ($needTx) {
        $game->endPlayerAction($rollback);
      }
    }
  }

  public static function actForOtherPlayers(
    \Tichu $game,
    int $humanPlayerId,
    int $maxSteps = 40
  ): array {
    return self::runInTransaction(
      $game,
      static fn(): array => parent::actForOtherPlayers($game, $humanPlayerId, $maxSteps)
    );
  }

  /**
   * Steps bot actions across both multipleactiveplayer and activeplayer states
   * until $humanPlayerId is active (or needs to act in a multiactive state).
   *
   * @return array<int, array<string, mixed>>
   */
  public static function autoPlayUntilPlayer(
    \Tichu $game,
    int $humanPlayerId,
    int $maxSteps = 40
  ): array {
    return self::runInTransaction($game, static function () use (
      $game,
      $humanPlayerId,
      $maxSteps
    ): array {
      $actions = [];
      $steps = 0;

      while ($steps < $maxSteps) {
        $state = $game->gamestate->state();
        $stateName = $state['name'] ?? '';
        $stateType = $state['type'] ?? '';
        $stateId = (int) ($state['id'] ?? 0);

        if ($stateId === 99 || $stateName === 'gameEnd') {
          break;
        }

        if ($stateType === 'multipleactiveplayer') {
          $actedInBatch = self::stepMultiactiveBatch(
            $game,
            $humanPlayerId,
            $stateId,
            $maxSteps,
            $actions,
            $steps
          );
          if (!$actedInBatch || $game->gamestate->isPlayerActive($humanPlayerId)) {
            break;
          }
          continue;
        }

        if ($stateType === 'activeplayer') {
          $activePlayerId = (int) $game->getActivePlayerId();
          if ($activePlayerId <= 0 || $activePlayerId === $humanPlayerId) {
            break;
          }
          if (!self::executeAndRecordBotStep($game, $activePlayerId, $actions, $steps)) {
            break;
          }
          continue;
        }

        break;
      }

      return $actions;
    });
  }

  public static function stepSingleBotTurn(\Tichu $game, ?int $botPlayerId = null): array
  {
    return self::runInTransaction(
      $game,
      static fn(): array => parent::stepSingleBotTurn($game, $botPlayerId)
    );
  }
}
