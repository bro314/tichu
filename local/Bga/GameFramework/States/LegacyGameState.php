<?php

declare(strict_types=1);

namespace Bga\GameFramework\States;

use \Bga\GameFramework\StateType;

/**
 * A GameState class that will be instanciated for all states that don't have a GameState class (states described in the states.inc.php file)
 */
class LegacyGameState extends GameState
{
    public function __construct(protected /*\Bga\GameFramework\Table*/ $game, int $stateId, protected \Bga\GameFramework\GameState $gameState) {
        parent::__construct($game, 
            id: $stateId, 
            type: $gameState->type,

            name: $gameState->name,
            description: $gameState->description ?? '',
            descriptionMyTurn: $gameState->descriptionMyTurn ?? '',
            transitions: $gameState->transitions ?? [],
            updateGameProgression: $gameState->updateGameProgression ?? false,
            initialPrivate: $gameState->initialPrivate,
        );

    }

    /**
     * Whether it's onEnteringState or getArgs, there is no parameters, 
     * except for private states that have the playerId and current state as array in parameter.
     */
    private function getFunctionsArgs(?int $playerId): array {
        if ($this->type === StateType::PRIVATE && $playerId !== null) {
            return [$playerId, $this->gameState->toArray()];
        } else {
            return [];
        }        
    }

    public function onEnteringState(?int $playerId): mixed {
        if ($this->gameState->action) {
            $args = $this->getFunctionsArgs($playerId);
            $result = $this->game->{$this->gameState->action}(...$args);
            return $this->type === StateType::PRIVATE ? $result : null;
        }
        return null;
    }

    public function getArgs(?int $playerId): ?array {
        if ($this->gameState->args) {
            $args = $this->getFunctionsArgs($playerId);
            return $this->game->{$this->gameState->args}(...$args) ?? [];
        }
        return $this->type === StateType::PRIVATE ? null : [];
    }

    public function zombie(int $playerId): void {
        $this->game->runLegacyGameStateZombieTurn($this->gameState->toArray(), $playerId);
    }
}

