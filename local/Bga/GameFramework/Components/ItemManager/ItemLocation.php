<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components\ItemManager;

class ItemLocation {
    public string|int|null $autoReshuffleFrom;
    public ?\Closure $autoReshuffleCallback;

    /**
     * @param string|int $name the name of the location. String names can end with * or % as a wildcard. For example 'played*' to store "played${playerNo}" as the location
     * @param bool $randomPick indicates if the location(s) should be reshuffled when picking. Usually, picking from a bag.
     */
    public function __construct(
        public string|int $name,
        public bool $randomPick = false,
        string|int|ItemLocation|null $autoReshuffleFrom = null,
        ?callable $autoReshuffleCallback = null,
    ) {
        $this->autoReshuffleFrom = $autoReshuffleFrom instanceof ItemLocation ? $autoReshuffleFrom->name : $autoReshuffleFrom;
        $this->autoReshuffleCallback = $autoReshuffleCallback ? \Closure::fromCallable($autoReshuffleCallback) : null;
    }

    /**
     * Create the 4 usual locations: deck, discard, table and hand.
     * 
     * @param bool $reshuffleDiscardToDeck if deck is automatically rebuild from the discard when needed (default true)
     * @return ItemLocation[] default locations
     */
    public static function getDefaults(bool $reshuffleDiscardToDeck = true): array {
        return [
                new ItemLocation('deck', autoReshuffleFrom: $reshuffleDiscardToDeck ? 'discard' : null),
                new ItemLocation('discard'),
                new ItemLocation('table'),
                new ItemLocation('hand'),
        ];
    }
}
