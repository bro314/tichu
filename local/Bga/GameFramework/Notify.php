<?php
declare(strict_types=1);

namespace Bga\GameFramework;

final class Notify {

    /**
     * List of notification function decorators.
     */
    private array $decorators = [];

    public bool $doNotWriteNextNotificationsToDatabase = false;

    private bool $mergePrivate = false;
    private bool $useNo = false;

    function __construct(
        private $game,
    ) {
        // automatically register as decorator functions named `decorateNotifArgs` on the game class
        if (method_exists($this->game, 'decorateNotifArgs')) {
            $this->decorators[] = fn(string $message, array $args) => $this->game->decorateNotifArgs($message, $args);
        }
    }

    /**
     * Add a decorator function, to be applied on args when a notif function is called.
     *
     * 📖 documented function.
     *
     * @param callable $fn The decorator function. Expected signature: `function(string $message, array $args): array`
     * @return void
     */
    public function addDecorator(callable $fn) {
        $this->decorators[] = $fn;
    }

    /**
     * Tell if notification targets will be player no (true) or player id (false).
     *
     * 📖 documented function.
     */
    public function setUseNo(bool $useNo): void {
        $this->useNo = $useNo;
    }

    public function getUseNo(): bool {
        return $this->useNo;
    }

    /**
     * Send a notification to a single player of the game.
     * 
     * 📖 documented function.
     *
     * @param int $playerIdOrNo the player ID (or no if useNo: true) to send the notification to.
     * @param string $notifName a comprehensive string code that explain what is the notification for.
     * @param (string | NotificationMessage) $message some text that can be displayed on player's log window (should be surrounded by clienttranslate if not empty).
     * @param array $args notification arguments.
     */
    public function player(int $playerIdOrNo, string $notifName, string | NotificationMessage $message = '', array $args = []): void {
        if ($message instanceof NotificationMessage) {
            if (count($args) > 0) {
                throw new \BgaSystemException("args parameter should not be specified when using NotificationMessage (notif $notifName)");
            }
            $args = $message->args;
            $message = $message->message;
        }
        $playerId = $this->getPlayerId($playerIdOrNo, $notifName);
        $this->game->notifyPlayer($playerId, $notifName, $message, $this->getDecoratedArgs($message, $args));
    }

    /**
     * Send a notification to all players of the game and spectators (public).
     * 
     * 📖 documented function.
     *
     * @param string $notifName a comprehensive string code that explain what is the notification for.
     * @param (string | NotificationMessage) $message some text that can be displayed on player's log window (should be surrounded by clienttranslate if not empty).
     * @param array $args notification arguments.
     */
    public function all(string $notifName, string | NotificationMessage $message = '', array $args = []): void {
        if ($message instanceof NotificationMessage) {
            if (count($args) > 0) {
                throw new \BgaSystemException("args parameter should not be specified when using NotificationMessage (notif $notifName)");
            }
            $args = $message->args;
            $message = $message->message;
        }

        $decoratedArgs = $this->getDecoratedArgs($message, $args);

        $notifiedPrivately = [];
        // Notify all players of this game state change
        if (isset($decoratedArgs['_private'])) {
            $mergePrivate = $this->isMergePrivate($decoratedArgs);
            // Notify individual players of the game change, setting args._private as their private information
            foreach ($decoratedArgs['_private'] as $target_id => $private_args) {
                $playerId = $this->getPlayerId((int)$target_id, $notifName);
                $publicArgs = $decoratedArgs;
                unset($publicArgs['_private']);
                unset($publicArgs['_merge_private']);
                $privateMessage = $message;
                if ($private_args instanceof NotificationMessage) {
                    $privateMessage = $private_args->message;
                    $private_args = $private_args->args;
                }
                $decoratedPrivateArgs = $this->getDecoratedArgs($privateMessage, $private_args);
                $args_with_private = $mergePrivate ? 
                    [...$publicArgs, ...$decoratedPrivateArgs] :
                    [...$publicArgs, '_private' => $decoratedPrivateArgs];
                // Notify player with this ID
                $notifiedPrivately[] = (int)$playerId;
                $this->game->notifyPlayer($playerId, $notifName, $privateMessage, $args_with_private);
            }
            unset($decoratedArgs['_private']);
        }
        unset($decoratedArgs['_merge_private']);

        // tell that this notif going to /table should ignore the players already notified privately
        if (count($notifiedPrivately) > 0) {
            $decoratedArgs['_notified_privately'] = $notifiedPrivately;
        }

        $this->game->notifyAllPlayers($notifName, $message, $decoratedArgs);
    }

    /**
     * Apply all decorator functions to the $args.
     */
    protected function getDecoratedArgs(string $message, array $args = []): array {
        foreach ($this->decorators as $decorator) {
            $args = $decorator($message, $args);
        }
        return $args;
    }

    /**
     * If called, all _private informations sent to the front will be merged to the args (if not called, they will stay into args._private).
     * If you want to only merge some _private, add `_merge_private => true` to the relevant args instead.
     * 
     * 📖 documented function.
     */
    public function alwaysMergePrivate() {
        $this->mergePrivate = true;
    }

    public function isMergePrivate(array $args = []): bool {
        if (isset($args['_merge_private'])) {
            return boolval($args['_merge_private']);
        }
        return $this->mergePrivate;
    }

    private function getPlayerId(int $playerIdOrNo, string $notifName): int {
        $playerId = $this->useNo ? (int)$this->game->getPlayerIdByNo($playerIdOrNo) : $playerIdOrNo;
        if (\Bga\GameFramework\Table::getBgaEnvironment() === 'studio' && !array_key_exists($playerId, $this->game->loadPlayersBasicInfos())) {
            throw new \BgaSystemException("Player ".($this->useNo ? "no" : "id")." $playerIdOrNo does not exist at the table (notif: $notifName)");
        }
        return $playerId;
    }
}
