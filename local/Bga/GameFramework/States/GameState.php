<?php

declare(strict_types=1);

namespace Bga\GameFramework\States;

use \Bga\GameFramework\StateType;

abstract class GameState
{
    public \Bga\GameFramework\Bga $bga;
    public \Bga\GameFramework\Db\Globals $globals;
    public \Bga\GameFramework\Notify $notify;
    public \Bga\GameFramework\Legacy $legacy;
    public \Bga\GameFramework\TableOptions $tableOptions;
    public \Bga\GameFramework\UserPreferences $userPreferences;
    public \Bga\GameFramework\TableStats $tableStats;
    public \Bga\GameFramework\PlayerStats $playerStats;
    public \Bga\GameFramework\Components\DeckFactory $deckFactory;
    public ?\Bga\GameFramework\GameStateMachine $gamestate = null;

    /**
     * @param \Bga\GameFramework\Table $game
     */
    public function __construct(
        $game, 
        public int $id, 
        public StateType $type,

        public ?string $name = null,
        public string $description = '',
        public string $descriptionMyTurn = '',
        public array $transitions = [],
        public bool $updateGameProgression = false,
        public int|string|null $initialPrivate = null,
    ) {
        $this->bga = $game->bga;
        $this->globals = $this->bga->globals;
        $this->notify = $this->bga->notify;
        $this->legacy = $this->bga->legacy;
        $this->tableOptions = $this->bga->tableOptions;
        $this->userPreferences = $this->bga->userPreferences;
        $this->tableStats = $this->bga->tableStats;
        $this->playerStats = $this->bga->playerStats;
        $this->deckFactory = $this->bga->deckFactory;
        $this->gamestate = $game->gamestate;
    }

    public function getName(): string {
        if (!empty($this->name)) {
            return $this->name;
        }

        return (new \ReflectionClass($this))->getShortName();
    }

    /**
     * Returns a random choice from an array of possible choices, for Zombie Mode level 1.
     * 
     * 📖 documented function.
     * 
     * @param array $choices an of $choiceKey
     * @return bool a random $choiceKey
     */
    public function getRandomZombieChoice(array $choices): mixed {
        if (count($choices) === 0) {
            return null;
        }
        return $choices[bga_rand(0, count($choices) - 1)]; // random choice over possible moves
    }

    /**
     * Returns a random top choice from an array of possible choices, for Zombie Mode level 2.
     * 
     * 📖 documented function.
     * 
     * @param array $choices an associative array of $choiceKey => $associatedPoints.
     * @param bool $reversed if the least points would be the best answer, instead of the top points
     * @return bool the best $choiceKey
     */
    public function getBestZombieChoice(array $choices, bool $reversed = false): mixed {
        if (count($choices) === 0) {
            return null;
        }

        $bestPoints = $reversed ? min($choices) : max($choices);
        $bestPointsKeys = array_keys($choices, $bestPoints); // filter to get only the choices offering the best points
        return $bestPointsKeys[bga_rand(0, count($bestPointsKeys) - 1)]; // random choice over top points possible moves, in case there is more than one
    }
}
