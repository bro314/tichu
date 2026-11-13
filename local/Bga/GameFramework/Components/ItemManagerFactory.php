<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components;

use Bga\GameFramework\Components\ItemManager\ItemManager;

/**
 * Fake object to simulate $this->bga->itemManagerFactory
 */
final class ItemManagerFactory {
    /**
     * Creates an ItemManager for the given item class.
     *
     * The item class must declare an #[Item] attribute, and its managed fields
     * must be declared with #[ItemField] attributes.
     *
     * @template T of object
     * @param class-string<T> $className Item base class managed by this manager.
     * @param (callable(array<string, mixed>|null): class-string<T>|null)|null $classNameResolver Optional resolver used to instantiate a subclass from a DB row.
     * @param \Bga\GameFramework\Components\ItemManager\ItemLocation[] $locations Locations accepted by this manager.
     * @param (callable(string, array<int|string, array<string, mixed>>, string): void)|null $dbUpdateCallback Optional callback receiving table name, updated DB lines keyed by item id, and operation ('INSERT' or 'UPDATE').
     * @param (callable(string, array<string, array{location: array<int, string|int|null>, count: int}>): void)|null $countChangeCallback Optional callback receiving table name and changed item counts keyed by encoded location.
     * @return ItemManager<T>
     */
    public function createItemManager(
        string $className,
        ?callable $classNameResolver = null,
        array $locations = [],
        ?callable $dbUpdateCallback = null,
        ?callable $countChangeCallback = null,
    ): ItemManager {

        $itemManager = new ItemManager($className, $classNameResolver, $dbUpdateCallback, $countChangeCallback);
        if (!empty($locations)) {
            $itemManager->addLocations($locations);
        }
        return $itemManager;
    }
}
