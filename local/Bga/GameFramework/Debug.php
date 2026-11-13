<?php
declare(strict_types=1);

namespace Bga\GameFramework;

final class Debug {
    private bool $isExecutingDebugAction = false;

    function __construct(
        private $game,
    ) {}

    /**
     * Play automatically some zombie moves.
     * 
     * 📖 documented function.
     */
    public function playUntil(callable $fn) {
        $count = 0;
        while (!$fn($count)) {
            $count++;
            foreach($this->game->gamestate->getActivePlayerList() as $playerId) {
                $playerId = (int)$playerId;
                $this->game->gamestate->runStateClassZombie($this->game->gamestate->getCurrentState($playerId), $playerId);
            }
        }
    }

    final public function isExecutingDebugAction(): bool
    {
        return $this->isExecutingDebugAction;
    }
    final public function setExecutingDebugAction(): void
    {
        $this->isExecutingDebugAction = true;
    }
}
