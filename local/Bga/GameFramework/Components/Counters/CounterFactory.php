<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components\Counters;

use Bga\GameFramework\SystemException;

/**
 * Factory to create counters.
 */
final class CounterFactory {
    /**
     * @var array<string,TableCounter>
     */
    private array $tableCounters = [];

    /**
     * @var array<string,PlayerCounter>
     */
    private array $playerCounters = [];

    /**
     * Instanciate the counter factory.
     * 
     * @param Table $game the Game class
     */
    public function __construct(private \Bga\GameFramework\Table $game) {
    }

    /**
     * Create a PlayerCounter component.
     * 
     * 📖 documented function.
     * 
     * @param string $name the name of the counter, used to link it to the JS counter
     * @param ?int $min the minimum value of the counter (null = no minimum)
     * @param ?int $max the maximum value of the counter (null = no maximum)
     * @param CounterVisibility|(callable(): CounterVisibility) $visibility the value or a callback evaluated when visibility is checked
     * @param bool $useNo use player no instead of player id
     * @param bool $strict set if the player no or id passed as a function param should be validated
     * @return PlayerCounter a new PlayerCounter object
     */
    public function createPlayerCounter(
        string $name, 
        ?int $min = 0, 
        ?int $max = null, 
        CounterVisibility|callable $visibility = CounterVisibility::VISIBLE,
        bool $useNo = false,
        ?bool $strict = null,
    ): PlayerCounter {
        if (array_key_exists($name, $this->playerCounters)) {
            throw new SystemException("You already declared a PlayerCounter named $name");
        }
        $counter = new PlayerCounter($this->game, $name, $min, $max, $visibility, $useNo, $strict);
        $this->playerCounters[$name] = $counter;

        return $counter;
    }

    /**
     * Create a TableCounter component.
     * 
     * 📖 documented function.
     * 
     * @param string $name the name of the counter, used to link it to the JS counter
     * @param ?int $min the minimum value of the counter (null = no minimum)
     * @param ?int $max the maximum value of the counter (null = no maximum)
     * @return TableCounter a new TableCounter object
     */
    public function createTableCounter(
        string $name, 
        ?int $min = 0, 
        ?int $max = null, 
    ): TableCounter {
        if (array_key_exists($name, $this->tableCounters)) {
            throw new SystemException("You already declared a TableCounter named $name");
        }
        $counter = new TableCounter($this->game, $name, $min, $max);
        $this->tableCounters[$name] = $counter;

        return $counter;
    }

    /**
     * Return the table counters created by the game.
     *
     * @return array<string,TableCounter>
     */
    public function getRegisteredTableCounters(): array {
        return $this->tableCounters;
    }

    /**
     * Return the player counters created by the game.
     *
     * @return array<string,PlayerCounter>
     */
    public function getRegisteredPlayerCounters(): array {
        return $this->playerCounters;
    }
}
