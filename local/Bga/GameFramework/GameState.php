<?php

declare(strict_types=1);

namespace Bga\GameFramework;

use InvalidArgumentException;

final class GameState implements \ArrayAccess
{
    public ?string $name = null;
    public ?StateType $type = null;
    public ?string $description = '';
    public ?string $descriptionMyTurn = '';
    public ?string $action = null;
    public ?string $args = null;
    public ?array $possibleActions = null;
    public ?array $transitions = null;
    public ?bool $updateGameProgression = false;
    public ?int $initialPrivate = null;

    /**
     * We save all properties here, to restore them on toArray, so non-supported properties are still sent to the front.
     */
    private array $allProperties = [];

    public bool $isLegacyGameState = false;
    public ?States\GameState $stateInstance = null; // null for 1 and 99

    public function validate(): void
    {
        if (!isset($this->name)) {
            throw new InvalidArgumentException("State 'name' must be defined.");
        }

        if (!isset($this->type)) {
            throw new InvalidArgumentException("State 'type' must be defined.");
        }

        /*if ($this->type === StateType::GAME && !isset($this->action)) {
            throw new InvalidArgumentException("The 'action' field should be set for game type state '{$this->name}'.");
        }*/

        if ($this->type === StateType::MANAGER && !in_array($this->name, ['gameSetup', 'gameEnd'])) {
            throw new InvalidArgumentException("The MANAGER type on state '{$this->name}' is reserved for gameSetup/gameEnd.");
        }
    }

    public static function fromArray(array $array): self {
        $gameState = new self();
        $gameState->allProperties = $array;

        if (isset($array['name'])) {
            $gameState->name = (string)$array['name'];
        }

        if (isset($array['type'])) {
            $gameState->type = gettype($array['type']) === 'string' ? StateType::from($array['type']) : $array['type'];
        }

        if (isset($array['description'])) {
            $gameState->description = (string)$array['description'];
        }

        if (isset($array['descriptionmyturn'])) {
            $gameState->descriptionMyTurn = (string)$array['descriptionmyturn'];
        }

        if (isset($array['action'])) {
            $gameState->action = (string)$array['action'];
        }

        if (isset($array['args'])) {
            $gameState->args = (string)$array['args'];
        }

        if (isset($array['possibleactions'])) {
            $gameState->possibleActions = $array['possibleactions'];
        }

        if (isset($array['transitions'])) {
            $gameState->transitions = $array['transitions'];
        }

        if (isset($array['updateGameProgression'])) {
            $gameState->updateGameProgression = (bool)$array['updateGameProgression']; // we force types because some games declare `"true" instead of `true`.
        }

        if (isset($array['initialprivate'])) {
            $gameState->initialPrivate = (int)$array['initialprivate'];
        }

        return $gameState;
    }

    public function toArray(): array
    {
        return array_merge($this->allProperties, [
            'name' => $this->name,
            'type' => $this->type->value,
            'description' => $this->description,
            'descriptionmyturn' => $this->descriptionMyTurn,
            'action' => $this->action,
            'args' => $this->args,
            'possibleactions' => $this->possibleActions,
            'transitions' => $this->transitions,
            'updateGameProgression' => $this->updateGameProgression,
            'initialprivate' => $this->initialPrivate,
        ]);
    }

    // ArrayAccess methods implementation
    public function offsetExists(mixed $offset): bool
    {
        return isset($this->toArray()[$offset]);
    }

    public function offsetGet(mixed $offset): mixed
    {
        return $this->toArray()[$offset] ?? null;
    }

    public function offsetSet(mixed $offset, mixed $value): void
    {
        throw new \LogicException('This GameState object is readonly. Modification via array access is not allowed.');
        /*if (property_exists($this, $offset)) {
            $this->$offset = $value;
        } else {
            $this->allProperties[$offset] = $value;
        }*/
    }

    public function offsetUnset(mixed $offset): void
    {
        throw new \LogicException('This GameState object is readonly. Unsetting properties via array access is not allowed.');
        /*if (property_exists($this, $offset)) {
            $this->$offset = null;
        } else {
            unset($this->allProperties[$offset]);
        }*/
    }
}

