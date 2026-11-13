<?php

declare(strict_types=1);

namespace Bga\GameFramework;

/**
 * A builder for game states.
 * To be called with `[game state id] => GameStateBuilder::create()->...[set all necessary properties]->build()`
 * in the states.inc.php file. 
 */
final class GameStateBuilder
{
    private GameState $gameState;

    private function __construct()
    {
        $this->gameState = new GameState();
    }

    /**
     * Create a new GameStateBuilder.
     */
    public static function create(): self
    {
        return new self();
    }

    /**
     * Return the game setup state (should have id 1).
     * To be called with `[game state id] => GameStateBuilder::gameSetup(10)->build()` if your first game state is 10.
     * If not set in the $machinestates array, it will be automatically created with a transition to state 2.
     * 
     * @param $nextStateId the id (or class name) of first real game state, just after the setup (default 2).
     */
    public static function gameSetup(int|string $nextStateId = 2): self
    {
        return self::create()
            ->name('gameSetup')
            ->description(clienttranslate('Game setup'))
            ->type(StateType::MANAGER)
            ->action('stGameSetup')
            ->transitions(['' => $nextStateId]);
    }

    /**
     * Return the game end score state (usually, id 98).
     * This is a common state used for end game scores & stats computation.
     * If the game dev uses it, they must define the function `stEndScore` with a call to `$this->gamestate->nextState();` at the end.
     */
    public static function endScore(): self
    {
        return self::create()
        ->name("endScore")
        ->description("")
        ->type(StateType::GAME)
        ->action("stEndScore")
        ->transitions([
            "" => 99,
        ]);
    }

    /**
     * Return the game end state (should have id 99).
     * If not set in the $machinestates array, it will be automatically created.
     */
    public static function gameEnd(): self
    {
        return self::create()
            ->name('gameEnd')
            ->description(clienttranslate('End of game'))
            ->type(StateType::MANAGER)
            ->action('stGameEnd');
    }

    /**
     * The name of the state.
     */
    public function name(string $name): self
    {
        $this->gameState->name = $name;
        return $this;
    }

    /**
     * The type of the state. MANAGER should not be used, except for setup and end game states.
     */
    public function type(StateType $type): self
    {
        $this->gameState->type = $type;
        return $this;
    }

    /**
     * The description for inactive players. Should be `clienttranslate('...')` if not empty.
     */
    public function description(string $description): self
    {
        $this->gameState->description = $description;
        return $this;
    }

    /**
     * The description for active players. Should be `clienttranslate('...')` if not empty.
     */
    public function descriptionMyTurn(string $descriptionMyTurn): self
    {
        $this->gameState->descriptionMyTurn = $descriptionMyTurn;
        return $this;
    }

    /**
     * The PHP function to call when entering the state.
     * Usually prefixed by `st`.
     */
    public function action(string $action): self
    {
        $this->gameState->action = $action;
        return $this;
    }

    /**
     * The PHP function returning the arguments to send to the front when entering the state.
     * Usually prefixed by `arg`.
     */
    public function args(string $args): self
    {
        $this->gameState->args = $args;
        return $this;
    }

    /**
     * The list of possible actions in the state.
     * Usually prefixed by `act`.
     */
    public function possibleActions(array $possibleActions): self
    {
        $this->gameState->possibleActions = $possibleActions;
        return $this;
    }

    /**
     * The list of transitions to other states. The key is the transition name and the value is the state to transition to.
     * Example: `['endTurn' => ST_END_TURN]`.
     */
    public function transitions(array $transitions): self
    {
        $this->gameState->transitions = $transitions;
        return $this;
    }

    /**
     * Set to true if the game progression has changed (to be recalculated with `getGameProgression`)
     */
    public function updateGameProgression(bool $update): self
    {
        $this->gameState->updateGameProgression = $update;
        return $this;
    }

    /**
     * For multi active states with inner private states, the initial state to go to.
     */
    public function initialPrivate(?int $initial): self
    {
        $this->gameState->initialPrivate = $initial;
        return $this;
    }

    /**
     * Export the built GameState.
     */
    public function build(): GameState
    {
        $this->gameState->validate();
        return $this->gameState;
    }
}
