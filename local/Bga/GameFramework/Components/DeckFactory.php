<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components;

/**
 * Factory to create decks.
 */
final class DeckFactory {
    /**
     * Instanciate the counter factory.
     * 
     * @param Table $game the Game class
     */
    public function __construct(private \Bga\GameFramework\Table $game) {
    }

    /**
     * Create a Deck component and set the DB table name.
     * 
     * 📖 documented function.
     * 
     * @param string $tableName name of the DB table
     * @return Deck a new Deck object
     */
    public function createDeck(string $tableName): Deck {
        $deck = new Deck();
        $deck->init($tableName);
        return $deck;
    }
}
