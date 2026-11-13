<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components\ItemManager;

use Bga\GameFramework\SystemException;
use Bga\GameFramework\Table;
use Bga\GameFramework\Helpers\Collection;

function array_shuffle_bga_rand(array &$array): void {
    $n = count($array);
    for ($i = $n - 1; $i > 0; $i--) {
        // Use bga_rand instead of rand()
        $j = bga_rand(0, $i);
        // Swap elements at indices $i and $j
        [$array[$i], $array[$j]] = [$array[$j], $array[$i]];
    }
}

class ItemManagerConfigurationException extends SystemException {}

/**
 * @template T of object
 */
class ItemManager {
    private ItemManagerDbService $db;
    private ItemOrderingService $ordering;

    /**
     * The DB table name.
     */
    private string $tableName;

    /**
     * The Item object fields
     * @var ItemField[]
     */
    private array $fields = [];

    /**
     * The possible locations
     * @var ItemLocation[]
     */
    private array $locations = [];
    /**
     * @var array<string, ItemLocation>
     */
    private array $locationsByName = [];

    /**
     * Optional resolver to map a DB row to a specific item class.
     * Signature: fn(?array $dbItem): ?string.
     * Any callable form is accepted (Closure, [$object, 'method'], etc.).
     */
    private ?\Closure $classNameResolver = null;

    /**
     * Signature: fn(string $tableName, array $countChanges): void.
     * $countChanges is keyed by an encoded location and each value contains
     * ['location' => array, 'count' => int].
     */
    private ?\Closure $countChangeCallback = null;

    /**
     * @param class-string<T> $className The Item object class.
     */
    public function __construct(
        private string $className,
        ?callable $classNameResolver = null,
        ?callable $dbUpdateCallback = null,
        ?callable $countChangeCallback = null,
    ) {
        $this->classNameResolver = $classNameResolver ? \Closure::fromCallable($classNameResolver) : null;
        $this->countChangeCallback = $countChangeCallback ? \Closure::fromCallable($countChangeCallback) : null;
        $parser = new ItemParser($this->className);
        $this->tableName = $parser->getTableName();
        $this->fields = $parser->getFields();

        $this->db = new ItemManagerDbService($this->tableName, $dbUpdateCallback);
        $this->ordering = new ItemOrderingService(
            $this->db,
            $this->fields,
            \Closure::fromCallable([$this, 'getItemFromDb']),
            \Closure::fromCallable([$this, 'getAllItems']),
            \Closure::fromCallable([$this, 'getItemsInLocation']),
        );
    }
    /**
     * Create the DB table. 
     * Should be called at the beginning of Game::setupNewGame.
     */
    public function initDb(): void {
        $columns = "";
        $idFieldName = null;

        foreach ($this->fields as &$field) {
            $sqlType = $this->db->getSqlType($field);

            $columns .= "`{$field->dbField}` $sqlType";
            if ($field->kind === ItemFieldKind::ID) {
                $idFieldName = $field->dbField;
                if ($field->type === 'int') {
                    $columns .= " AUTO_INCREMENT";
                }
            }
            $columns .= ", ";
        }
        $columns .= "PRIMARY KEY (`{$idFieldName}`)";
        $this->db->sqlCreate(
            $columns
        );
    }

    /**
     * Register a location available for managed items.
     */
    public function addLocation(ItemLocation $location): void {
        $this->addLocations([$location]);
    }

    /**
     * @param array<int, mixed> $locations
     */
    public function addLocations(array $locations): void {
        foreach ($locations as $location) {
            if (!$location instanceof ItemLocation) {
                throw new ItemManagerConfigurationException("Expected ItemLocation instances in addLocations() on {$this->className}");
            }
            if ($this->getLocationByName($location->name)) {
                throw new ItemManagerConfigurationException("Duplicate location '{$location->name}' on {$this->className}");
            }

            $this->locations[] = $location;
            $this->locationsByName[$location->name] = $location;
        }

        $this->validateRegisteredLocationReferences();
    }

    public function getLocationByName(string|int $locationName): ?ItemLocation {
        if (array_key_exists($locationName, $this->locationsByName)) {
            return $this->locationsByName[$locationName];
        }
        foreach ($this->locationsByName as $name => $location) {
            $name = (string) $name;
            if (str_ends_with($name, '*') || str_ends_with($name, '%')) {
                $strippedName = substr($name, 0, -1);
                if (str_starts_with($locationName, $strippedName)) {
                    return $location;
                }
            }
        }
        return null;
    }

    private function getLocationByLocation(Location $location): ?ItemLocation {
        return $this->getLocationByName($location->locations[0]);
    }

    /**
     * Create new items in the DB.
     * 
     * $itemsTypes should be like this :
     * [
     *   ['location' => 'deck', 'type' => 0, 'item_nbr' => 2],
     *   ['location' => 'table', 'locationArg' => 1, 'type' => 1, 'flipped' => true],
     * ]
     * 
     * item_nbr is a special field, that will create this number of items. If unset, defaults to 1.
     * 
     * @param array[] $itemsTypes An array of arrays, where each inner array follows the described structure.
     */
    public function createItems(array $itemsTypes): void {
        $fieldsToInsert = $this->getPersistedFields();
        $rows = $this->buildCreateRows($itemsTypes, $fieldsToInsert);
		if (count($rows) === 0) {
            return; // Avoid SQL error if items list is empty
        }

	    // Shuffle rows to avoid that items of the same ID have always the same type.
	    array_shuffle_bga_rand($rows);
        $this->assignInitialOrders($rows);

        $countBeforeByLocationKey = $this->captureLocationCounts($this->getLocationsFromRows($rows));
        $this->db->insertRows($fieldsToInsert, $rows, $this->fields);
        $this->emitCountChanges($countBeforeByLocationKey);
    }

    /**
     * Move all items from one location to another.
     */
    public function moveAllItemsInLocation(Location|array|string|int|null $from, Location|array|string|int $to): void {
        $fromLocation = $from !== null ? Location::from($from) : null;
        $toLocation = Location::from($to);
        if ($fromLocation !== null) {
            $this->assertKnownLocation($fromLocation);
        }
        $this->assertKnownLocation($toLocation);
        $countLocations = [$toLocation];
        if ($fromLocation !== null) {
            $countLocations[] = $fromLocation;
        } else if ($this->countChangeCallback !== null) {
            $countLocations = array_merge($countLocations, $this->getLocationsFromItems($this->getAllItems()->values()));
        }
        $countBeforeByLocationKey = $this->captureLocationCounts($countLocations);
        $this->ordering->moveAllItemsInLocation($fromLocation, $toLocation);
        $this->emitCountChanges($countBeforeByLocationKey);
    }

    /**
     * Pick an item from a location into another location.
     *
     * @param string $from location to pick the item
     * @param string $to location to put the picked item
     * 
     * @return T|null An object of the type specified by $this->className, or null if no item is picked.
     */
    public function pickItem(Location|array|string|int $from, Location|array|string|int $to): ?object {
        $fromLocation = Location::from($from);
        $toLocation = Location::from($to);
        $items = $this->pickItems(1, $fromLocation, $toLocation);
        return $items->first();
    }

    /**
     * Pick items from a location into another location.
     *
     * @param int $number the number of items to pick
     * @param string $from location to pick the items
     * @param string $to location to put the picked items
     * 
     * @return Collection<T> A collection of objects keyed by item id, of the type specified by $this->className.
     */
    public function pickItems(int $number, Location|array|string|int $from, Location|array|string|int $to): Collection {
        $fromLocation = Location::from($from);
        $toLocation = Location::from($to);
        $this->assertKnownLocation($fromLocation);
        $this->assertKnownLocation($toLocation);
        $itemLocation = $this->getLocationByLocation($fromLocation);

        if ($itemLocation?->randomPick) {
            $this->shuffle($fromLocation);
        }

        $items = $this->getItemsInLocation($fromLocation, reversed: true, limit: $number);

        // if we cannot find enough items, try to re-shuffle
        if (count($items) < $number) {
            if ($itemLocation && $itemLocation->autoReshuffleFrom !== null) {
                // reshuffle
                $this->moveAllItemsInLocation($itemLocation->autoReshuffleFrom, $fromLocation);
                $this->shuffle($fromLocation);
                if ($itemLocation->autoReshuffleCallback !== null) {
                    ($itemLocation->autoReshuffleCallback)();
                }

                $items = $this->getItemCollection(array_merge(
                    $items->values(),
                    $this->getItemsInLocation($fromLocation, reversed: true, limit: ($number - count($items)))->values()
                ));
            }
        }

        if (count($items) > 0) {
            $this->moveItems($items->values(), $toLocation);
        }
        return $items;
    }

    /**
     * Set the order of a managed item within its location.
     *
     * @param int|T $itemOrItemId Managed item object or item id.
     */
    public function setItemOrder(object|int $itemOrItemId, int $order): void {
        $originalItemsById = $this->getOriginalItemsById([$itemOrItemId]);
        $item = $this->getRequiredItemById($this->getItemIdFromItemOrItemId($itemOrItemId));
        $this->ordering->setItemOrder($item, $order);
        $this->syncOriginalItemsFromUpdatedItems($originalItemsById, [$item], [$this->getItemFieldByKind(ItemFieldKind::ORDER)]);
    }

    /**
     * Move one managed item to a location.
     * 
     * Insert before the item currently at $order. Use 0 to prepend.
     *
     * @param int|T $itemOrItemId Managed item object or item id.
     */
    public function moveItem(object|int $itemOrItemId, Location|array|string|int $to, ?int $order = null): void {
        $toLocation = Location::from($to);
        $originalItemsById = $this->getOriginalItemsById([$itemOrItemId]);
        $item = $this->getRequiredItemById($this->getItemIdFromItemOrItemId($itemOrItemId));
        $this->assertKnownLocation($toLocation);
        $countBeforeByLocationKey = $this->captureLocationCounts([
            $this->getLocationFromItem($item),
            $toLocation,
        ]);
        $this->ordering->moveItem($item, $toLocation, $order);
        $this->emitCountChanges($countBeforeByLocationKey);
        $this->syncOriginalItemsFromUpdatedItems($originalItemsById, [$item], $this->getMoveUpdatedFields());
    }

    /**
     * Move managed items to a location.
     *
     * @param array<int|T>|Collection<int|T> $itemsOrItemIds Managed item objects or item ids.
     * @param bool $prepend add the items at the beginning of the location (=index 0,1,2) instead of default to end of the location (max order + 1, +2, ...)
     */
    public function moveItems(array|Collection $itemsOrItemIds, Location|array|string|int $to, bool $prepend = false): void {
        $itemsOrItemIds = $this->collectionToArray($itemsOrItemIds);
        $toLocation = Location::from($to);
        $originalItemsById = $this->getOriginalItemsById($itemsOrItemIds);
        $itemIds = array_values(array_map(fn($itemOrItemId) => $this->getItemIdFromItemOrItemId($itemOrItemId), $itemsOrItemIds));
        $items = $this->getRequiredItemsByIds($itemIds);
        $this->assertKnownLocation($toLocation);
        $countBeforeByLocationKey = $this->captureLocationCounts(array_merge(
            $this->getLocationsFromItems($items),
            [$toLocation],
        ));
        $this->ordering->moveItems($items, $toLocation, $prepend);
        $this->emitCountChanges($countBeforeByLocationKey);
        $this->syncOriginalItemsFromUpdatedItems($originalItemsById, $items, $this->getMoveUpdatedFields());
    }

    /**
     * Get a list of item matching values for a field name.
     * Example : getItemsByFieldName('type', [3, 4]) to return all items of type 3 or 4. getItemsByFieldName('type', 3]) to return all items of type 3.
     *
     * @param mixed $values A single value or an array of values.
     * 
     * @return Collection<T> A collection of objects keyed by item id, of the type specified by $this->className.
     */
    public function getItemsByFieldName(string $fieldName, mixed $values, ?int $limit = null, ?string $sortByField = null, bool $reversed = false): Collection {
        return $this->getItemsByField($this->getItemField($fieldName), $values, $limit, $sortByField, $reversed);
    }

    /**
     * Get a list of item matching multiple queries (with AND) of values for a field name.
     * Example : getItemsByFieldNames([
     *   'type' => [3, 4],
     *   'location' => 'hand',
     *   'locationArg' => $playerId,
     * ]) to return all items of type 3 or 4 in the hand of player $playerId.
     *
     * Also accepts the tuple syntax: [['type', [3, 4]], ['location', 'hand']].
     * 
     * @return Collection<T> A collection of objects keyed by item id, of the type specified by $this->className.
     */
    public function getItemsByFieldNames(array $filters, ?int $limit = null, ?string $sortByField = null, bool $reversed = false): Collection {
        return $this->getItemsByFields(
            $this->normalizeNamedFieldFilters($filters),
            $limit,
            $sortByField,
            $reversed
        );
    }

    /**
     * See getItemsByFieldName
     *
     * @param mixed $values A single value or an array of values.
     * 
     * @return Collection<T> A collection of objects keyed by item id, of the type specified by $this->className.
     */
    public function getItemsByField(ItemField $field, mixed $values, ?int $limit = null, ?string $sortByField = null, bool $reversed = false): Collection {
        return $this->getItemsByFields([[$field, $values]], $limit, $sortByField, $reversed);
    }

    /**
     * See getItemsByFieldNames
     * 
     * @param array<array{0: ItemField, 1: mixed}> $filters
     * @return Collection<T> A collection of objects keyed by item id, of the type specified by $this->className.
     */
    public function getItemsByFields(array $filters, ?int $limit = null, ?string $sortByField = null, bool $reversed = false): Collection {
        return $this->queryItemsByFields($this->normalizeFieldFilters($filters), $limit, $sortByField, $reversed);
    }

    /**
     * @param array<string, mixed>|array<array{0: string, 1: mixed}> $filters
     * @return array<array{0: ItemField, 1: array}>
     */
    private function normalizeNamedFieldFilters(array $filters): array {
        $normalizedFilters = [];
        foreach ($filters as $fieldName => $filter) {
            if (is_string($fieldName)) {
                $normalizedFilters[] = [$this->getItemField($fieldName), $this->normalizeFilterValues($filter)];
                continue;
            }

            if (!is_array($filter) || !array_key_exists(0, $filter) || !array_key_exists(1, $filter)) {
                throw new ItemManagerConfigurationException("Expected getItemsByFieldNames filters to be associative field => values pairs or [fieldName, values] tuples for {$this->className}");
            }

            $tupleFieldName = $filter[0];
            if (!is_string($tupleFieldName)) {
                throw new ItemManagerConfigurationException("Expected getItemsByFieldNames tuple field name to be a string for {$this->className}");
            }

            $normalizedFilters[] = [$this->getItemField($tupleFieldName), $this->normalizeFilterValues($filter[1])];
        }
        return $normalizedFilters;
    }

    /**
     * @param array<array{0: ItemField, 1: mixed}> $filters
     * @return array<array{0: ItemField, 1: array}>
     */
    private function normalizeFieldFilters(array $filters): array {
        return array_map(
            fn(array $filter) => [$filter[0], $this->normalizeFilterValues($filter[1])],
            $filters
        );
    }

    /**
     * getItemsByFieldName(s) values parameter should be an array. If it's not, transform it to a single value array.
     */
    private function normalizeFilterValues(mixed $values): array {
        return is_array($values) ? $values : [$values];
    }

    /**
     * @param array<array{0: ItemField, 1: array}> $filters
     * @return Collection<T> A collection of objects keyed by item id, of the type specified by $this->className.
     */
    private function queryItemsByFields(array $filters, ?int $limit = null, null | string | ItemField $sortByField = null, bool $reversed = false): Collection {
        $conditions = [];
        foreach ($filters as [$field, $values]) {
            if (count($values) === 0) {
                return new Collection();
            }

            $conditions[] = $this->db->sqlInValues($this->getManagedField($field), $values);
        }

        $where = count($conditions) === 0 ? null : implode(" AND ", $conditions);
        $orderBy = null;
        if ($sortByField !== null) {
            $managedSortField = $sortByField instanceof ItemField ? $sortByField : $this->getItemField($sortByField);
            $orderBy = "`{$managedSortField->dbField}` ".($reversed ? 'DESC' : 'ASC');
        }
        $dbResults = $this->db->sqlGetRows("*", $where, orderBy: $orderBy, limit: $limit);
        return $this->getItemCollectionFromDbRows($dbResults);
    }

    /**
     * @return T|null An object of the type specified by $this->className, or null if no item is picked.
     */
    public function getItemById(int $id): ?object {
        $items = $this->getItemsByIds([$id]);
        return $items->first();
    }

    /**
     * @param int[] $ids
     * @return Collection<T> A collection of objects keyed by item id, of the type specified by $this->className.
     */
    public function getItemsByIds(array $ids, ?string $sortByField = null, bool $reversed = false): Collection {
        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);

        return $this->getItemsByField($idField, $ids, sortByField: $sortByField, reversed: $reversed);
    }

    /**
     * @return T
     */
    private function getRequiredItemById(int $id): object {
        $item = $this->getItemById($id);
        if ($item === null) {
            throw new SystemException("Unknown item id '{$id}' on {$this->className}");
        }

        return $item;
    }

    /**
     * @param int[] $ids
     * @return T[]
     */
    private function getRequiredItemsByIds(array $ids): array {
        $items = $this->getItemsByIds($ids);
        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        $foundIds = [];

        foreach ($items as $item) {
            $foundIds[$item->{$idField->name}] = true;
        }

        foreach ($ids as $id) {
            if (!isset($foundIds[$id])) {
                throw new SystemException("Unknown item id '{$id}' on {$this->className}");
            }
        }

        return $items->values();
    }

    /**
     * @param mixed $itemOrItemId
     */
    private function getItemIdFromItemOrItemId(mixed $itemOrItemId): int {
        if (is_int($itemOrItemId)) {
            return $itemOrItemId;
        }

        if (!is_object($itemOrItemId)) {
            throw new ItemManagerConfigurationException("Expected managed item objects or item ids for {$this->className}");
        }

        // We don't call assertManagedItem here because if the game pass an stdClass in the shape of the item, it's enough to get its id.
        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        $itemId = $itemOrItemId->{$idField->name} ?? null;
        if (!is_int($itemId)) {
            throw new ItemManagerConfigurationException("Expected integer item id for {$this->className}");
        }

        return $itemId;
    }

    /**
     * @param array<int|T> $itemsOrItemIds
     * @return array<int, object[]>
     */
    private function getOriginalItemsById(array $itemsOrItemIds): array {
        $originalItemsById = [];

        foreach ($itemsOrItemIds as $itemOrItemId) {
            if (!is_object($itemOrItemId)) {
                continue;
            }

            $itemId = $this->getItemIdFromItemOrItemId($itemOrItemId);
            $originalItemsById[$itemId][] = $itemOrItemId;
        }

        return $originalItemsById;
    }

    /**
     * @return ItemField[]
     */
    private function getMoveUpdatedFields(): array {
        return array_merge($this->getLocationFields(), [$this->getItemFieldByKind(ItemFieldKind::ORDER)]);
    }

    /**
     * @param ItemField[] $fields
     */
    private function copyItemFields(object $sourceItem, object $targetItem, array $fields): void {
        foreach ($fields as $field) {
            $targetItem->{$field->name} = $sourceItem->{$field->name};
        }
    }

    /**
     * @param array<int, object[]> $originalItemsById
     * @param T[] $updatedItems
     * @param ItemField[] $fields
     */
    private function syncOriginalItemsFromUpdatedItems(array $originalItemsById, array $updatedItems, array $fields): void {
        if (count($originalItemsById) === 0) {
            return;
        }

        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        foreach ($updatedItems as $updatedItem) {
            $itemId = $updatedItem->{$idField->name};
            if (!isset($originalItemsById[$itemId])) {
                continue;
            }

            foreach ($originalItemsById[$itemId] as $originalItem) {
                $this->copyItemFields($updatedItem, $originalItem, $fields);
            }
        }
    }

    /**
     * @param array<int, object[]> $originalItemsById
     * @param array<int, int> $newIdsByOldId
     */
    private function syncOriginalItemIds(array $originalItemsById, array $newIdsByOldId): void {
        if (count($originalItemsById) === 0) {
            return;
        }

        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        foreach ($newIdsByOldId as $oldId => $newId) {
            foreach ($originalItemsById[$oldId] ?? [] as $originalItem) {
                $originalItem->{$idField->name} = $newId;
            }
        }
    }

    /**
     * Build the SQL where clause for a location and optional location arg.
     */
    private function getLocationWhereClause(Location $location): string {
        $this->assertKnownLocation($location);
        return $this->ordering->getLocationWhereClause($location);
    }

    /**
     * Build the SQL where clause for a read-only location filter.
     */
    private function getLocationFilterWhereClause(Location $locationFilter): string {
        $this->assertKnownLocationFilter($locationFilter);
        return $this->ordering->getLocationFilterWhereClause($locationFilter);
    }

    /**
     * Count the items in a location.
     *
     * Use null for a non-trailing location part as a wildcard filter.
     */
    public function countItemsInLocation(Location|array|string|int $location): int {
        $fromLocation = Location::filter($location);
        $dbResult = $this->db->sqlGetValue("count(*)", $this->getLocationFilterWhereClause($fromLocation));
        return (int)$dbResult;
    }

    /**
     * Get the highest order value currently used in a location.
     */
    public function getMaxOrderInLocation(Location|array|string|int $location): int {
        $fromLocation = Location::from($location);
        $orderField = $this->getItemFieldByKind(ItemFieldKind::ORDER);

        $dbResult = $this->db->sqlGetValue("max(`{$orderField->dbField}`)", $this->getLocationWhereClause($fromLocation));
        return (int)$dbResult;
    }

    private function getNextOrderInLocation(Location $location): int {
        $orderField = $this->getItemFieldByKind(ItemFieldKind::ORDER);
        $dbResult = $this->db->sqlGetValue("max(`{$orderField->dbField}`)", $this->getLocationWhereClause($location));

        return $dbResult === null ? 0 : ((int)$dbResult) + 1;
    }

    /**
     * @return Collection<T> A collection of objects keyed by item id, of the type specified by $this->className.
     *
     * Use null for a non-trailing location part as a wildcard filter.
     */
    public function getItemsInLocation(Location|array|string|int $location, bool $reversed = false, ?int $limit = null, ?string $sortByField = null): Collection {
        $fromLocation = Location::filter($location);
        $this->assertKnownLocationFilter($fromLocation);

        return $this->queryItemsByFields(
            $this->ordering->getLocationFilterFilters($fromLocation),
            $limit,
            $sortByField !== null ? $this->getItemField($sortByField) : $this->getItemFieldByKind(ItemFieldKind::ORDER),
            $reversed
        );
    }

    /**
     * @return Collection<T> A collection of objects keyed by item id, of the type specified by $this->className.
     */
    public function getAllItems(?int $limit = null): Collection {
        $dbResults = $this->db->sqlGetRows("*", limit: $limit);
        return $this->getItemCollectionFromDbRows($dbResults);
    }

	/**
     * @return T|null An object of the type specified by $this->className, or null if no item is picked.
     */
    public function getItemOnTop(Location|array|string|int $location): ?object {
        $fromLocation = Location::from($location);
        $items = $this->getItemsOnTop(1, $fromLocation);
        return $items->first();
	}

	/**
     * @return Collection<T> A collection of objects keyed by item id, of the type specified by $this->className.
     */
    public function getItemsOnTop(int $number, Location|array|string|int $location): Collection {
        $fromLocation = Location::from($location);
        return $this->getItemsInLocation($fromLocation, true, $number);
	}

    /**
     * Update the DB value based on the Item fields.
     * Set $fields to set which fields to update (all if null)
     */
    public function updateItem(object $item, array|string|null $fields = null): void {
        $this->updateItems([$item], $fields);
    }

    /**
     * Update the DB values based on the Item fields.
     * Set $fields to set which fields to update (all if null)
     *
     * @param T[]|Collection<T> $items
     */
    public function updateItems(array|Collection $items, array|string|null $fields = null): void {
        $items = $this->collectionToArray($items);
        $this->assertManagedItems($items);
        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        if (is_string($fields)) {
            $fields = [$fields];
        }
        if (is_array($fields)) {
            $fields = $this->normalizeFieldNames($fields);
        }

        $updatedFields = [];

        foreach ($this->fields as $field) {
            $toUpdate = $fields === null || in_array($field->name, $fields, true);
            if ($toUpdate && $field->kind !== ItemFieldKind::ID) {
                $updatedFields[] = $field;
            }
        }

        if (count($updatedFields) === 0) {
            return;
        }

        $updatesById = [];
        foreach ($items as $item) {
            $updatedValues = [];
            foreach ($updatedFields as $field) {
                $updatedValues[$field->name] = $item->{$field->name};
            }
            $updatesById[$item->{$idField->name}] = $updatedValues;
        }

        $countBeforeByLocationKey = $this->captureLocationCountsForUpdate($items, $updatedFields);
        $this->db->updateRowsByMatchValues(
            $idField,
            $updatedFields,
            $updatesById,
        );
        $this->emitCountChanges($countBeforeByLocationKey);
    }

    /**
     * Update the DB value based on the Item fields.
     * Set $fields to set which fields to update (all if null)
     */
    public function updateAllItems(string $fieldName, mixed $value): void {
        $field = $this->getItemField($fieldName);
        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        $updatesById = [];
        $items = [];

        if ($field->kind !== ItemFieldKind::ID) {
            $items = $this->getAllItems()->values();
            foreach ($items as $item) {
                $updatesById[$item->{$idField->name}] = [
                    $field->name => $value,
                ];
            }
        }

        if (count($updatesById) === 0) {
            return;
        }

        $countBeforeByLocationKey = $field->kind === ItemFieldKind::LOCATION
            ? $this->captureLocationCountsForUpdateAll($items, $field, $value)
            : [];
        $this->db->updateRowsByMatchValues($idField, [$field], $updatesById);
        $this->emitCountChanges($countBeforeByLocationKey);
    }

    /**
     * Get a managed field by property name.
     */
    public function getItemField(string $name): ItemField {
        $field = array_find($this->fields, fn($field) => $field->name === $name);
        if ($field === null) {
            throw new ItemManagerConfigurationException("Unknown item field '{$name}' on {$this->className}");
        }

        return $field;
    }

    /**
     * Get a managed field by semantic kind.
     */
    public function getItemFieldByKind(ItemFieldKind $kind, int $locationIndex = 0): ItemField {
        return $this->ordering->getItemFieldByKind($kind, $locationIndex);
    }

    /**
     * @return ItemField[]
     */
    private function getLocationFields(): array {
        return $this->ordering->getLocationFields();
    }

    /**
     * @param array<string, mixed> $row
     * @return array<int, string|int|null>
     */
    private function getLocationsFromRow(array $row): array {
        return $this->ordering->getLocationsFromRow($row);
    }

    /**
     * @return array<int, string|int|null>
     */
    private function getLocationFromLocation(Location $location): array {
        return $this->ordering->trimTrailingNullLocations($this->ordering->getLocationsForFields($location));
    }

    /**
     * @return array<int, string|int|null>
     */
    private function getLocationFromItem(object $item): array {
        $locations = [];
        foreach ($this->getLocationFields() as $field) {
            $locations[$field->locationIndex] = $item->{$field->name};
        }

        return $this->ordering->trimTrailingNullLocations($locations);
    }

    /**
     * @param T[] $items
     * @return array<int, array<int, string|int|null>>
     */
    private function getLocationsFromItems(array $items): array {
        return array_map(fn($item) => $this->getLocationFromItem($item), $items);
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<int, string|int|null>>
     */
    private function getLocationsFromRows(array $rows): array {
        return array_map(fn(array $row) => $this->getLocationsFromRow($row), $rows);
    }

    /**
     * @param array<int, Location|array<int, string|int|null>> $locations
     * @return array<string, array{location: array<int, string|int|null>, count: int}>
     */
    private function captureLocationCounts(array $locations): array {
        if ($this->countChangeCallback === null) {
            return [];
        }

        $countBeforeByLocationKey = [];
        foreach ($locations as $location) {
            $locationArray = $location instanceof Location
                ? $this->getLocationFromLocation($location)
                : $this->ordering->trimTrailingNullLocations($location);
            if (count($locationArray) === 0) {
                continue;
            }

            $locationKey = $this->getCountLocationKey($locationArray);
            if (isset($countBeforeByLocationKey[$locationKey])) {
                continue;
            }

            $countBeforeByLocationKey[$locationKey] = [
                'location' => $locationArray,
                'count' => $this->countItemsInExactLocation($locationArray),
            ];
        }

        return $countBeforeByLocationKey;
    }

    /**
     * @param array<int, string|int|null> $location
     */
    private function countItemsInExactLocation(array $location): int {
        $dbResult = $this->db->sqlGetValue(
            "count(*)",
            $this->ordering->getLocationWhereClause(Location::from($location)),
        );

        return (int)$dbResult;
    }

    /**
     * @param array<int, string|int|null> $location
     */
    private function getCountLocationKey(array $location): string {
        return (string)json_encode(array_values($location));
    }

    /**
     * @param array<string, array{location: array<int, string|int|null>, count: int}> $countBeforeByLocationKey
     */
    private function emitCountChanges(array $countBeforeByLocationKey): void {
        if ($this->countChangeCallback === null || count($countBeforeByLocationKey) === 0) {
            return;
        }

        $countChanges = [];
        foreach ($countBeforeByLocationKey as $locationKey => $countBefore) {
            $newCount = $this->countItemsInExactLocation($countBefore['location']);
            if ($newCount === $countBefore['count']) {
                continue;
            }

            $countChanges[$locationKey] = [
                'location' => $countBefore['location'],
                'count' => $newCount,
            ];
        }

        if (count($countChanges) === 0) {
            return;
        }

        ($this->countChangeCallback)($this->tableName, $countChanges);
    }

    /**
     * @param T[] $updatedItems
     * @param ItemField[] $updatedFields
     * @return array<string, array{location: array<int, string|int|null>, count: int}>
     */
    private function captureLocationCountsForUpdate(array $updatedItems, array $updatedFields): array {
        if ($this->countChangeCallback === null || !$this->hasLocationField($updatedFields)) {
            return [];
        }

        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        $itemIds = array_values(array_map(fn($item) => $item->{$idField->name}, $updatedItems));
        $originalItems = $this->getItemsByIds($itemIds)->values();

        return $this->captureLocationCounts(array_merge(
            $this->getLocationsFromItems($originalItems),
            $this->getLocationsFromItems($updatedItems),
        ));
    }

    /**
     * @param T[] $items
     * @return array<string, array{location: array<int, string|int|null>, count: int}>
     */
    private function captureLocationCountsForUpdateAll(array $items, ItemField $updatedField, mixed $value): array {
        if ($this->countChangeCallback === null) {
            return [];
        }

        $newLocations = [];
        foreach ($items as $item) {
            $location = $this->getLocationFromItem($item);
            $location[$updatedField->locationIndex] = $value;
            $newLocations[] = $this->ordering->trimTrailingNullLocations($location);
        }

        return $this->captureLocationCounts(array_merge(
            $this->getLocationsFromItems($items),
            $newLocations,
        ));
    }

    /**
     * @param ItemField[] $fields
     */
    private function hasLocationField(array $fields): bool {
        return array_find($fields, fn($field) => $field->kind === ItemFieldKind::LOCATION) !== null;
    }

    /**
     * Resolve the concrete class name to instantiate for a DB row.
     *
     * @param array<string, mixed>|null $dbItem
     */
    public function getClassName(?array $dbItem): ?string {
        if ($this->classNameResolver !== null) {
            $resolvedClassName = ($this->classNameResolver)($dbItem);
            return $resolvedClassName ?? $this->className;
        }
        return $this->className;
    }

    /**
     * @return T|null An object of the type specified by $this->className, or null if no item is picked.
     */
    public function getItemFromDb(?array $dbItem): ?object {
        if (!$dbItem) {
            return null;
        }

        $className = $this->getClassName($dbItem) ?? $this->className;
        if (!class_exists($className)) {
            throw new ItemManagerConfigurationException("Resolved item class '{$className}' does not exist for {$this->className}");
        }
        if (!is_a($className, $this->className, true)) {
            throw new ItemManagerConfigurationException("Resolved item class '{$className}' must extend {$this->className}");
        }
        $item = new $className();

        foreach ($this->fields as &$field) {
            $valueFromSql = $this->db->getValueFromSql($field, $dbItem[$field->dbField] ?? null);

            if ($valueFromSql === null) {
                // check if the property can be set to null
                $reflectionProperty = new \ReflectionProperty($this->className, $field->name);
                if (!$reflectionProperty->getType()->allowsNull()) {
                    $valueFromSql = $reflectionProperty->getDefaultValue();
                }
            }

            $item->{$field->name} = $valueFromSql;
        }
        
        if (method_exists($item, 'setup')) {
            $item->setup($dbItem);
        }

        return $item;
    }

    /**
     * Shuffle the order of the items in a location.
     */
    public function shuffle(Location|array|string|int $location): void {
        $fromLocation = Location::from($location);
        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        $orderField = $this->getItemFieldByKind(ItemFieldKind::ORDER);

        $item_ids = $this->db->sqlGetRows("`{$idField->dbField}`", $this->getLocationWhereClause($fromLocation));
        $item_ids = array_values(array_map(fn($dbObject) => intval($dbObject[$idField->dbField]), $item_ids));
        
        array_shuffle_bga_rand( $item_ids );

        $updatesById = [];
        foreach ($item_ids as $index => $item_id) {
            $updatesById[$item_id] = [
                $orderField->name => $index,
            ];
        }

        $this->db->updateRowsByMatchValues($idField, [$orderField], $updatesById);
    }

    /**
     * Change the ids of some items.
     * Usually, items that were visible in the front, and are put back invisible, so the user cannot track the id.
     *
     * @param int[] $itemIds
     * @return array<int, int> old id => new id
     */
    private function changeIdsByItemIds(array $itemIds): array {
        if (empty($itemIds)) {
            return [];
        }

        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        $maxCurrentId = (int)$this->db->sqlGetValue("max(`{$idField->dbField}`)");
        $oldIds = [];
        $newIds = [];
        foreach ($itemIds as $itemId) {
            $oldIds[] = $itemId;
            $newIds[] = $maxCurrentId + $itemId;
        }
        array_shuffle_bga_rand($newIds);

        $updatesById = [];
        $newIdsByOldId = [];
        foreach ($oldIds as $index => $oldId) {
            $newId = $newIds[$index];
            $updatesById[$oldId] = [
                $idField->name => $newId,
            ];
            $newIdsByOldId[$oldId] = $newId;
        }

        $this->db->updateRowsByMatchValues($idField, [$idField], $updatesById);

        return $newIdsByOldId;
    }

    /**
     * Change the ids of some items.
     * Usually, items that were visible in the front, and are put back invisible, so the user cannot track the id.
     *
     * @param array<int|T>|Collection<int|T> $itemsOrItemIds Managed item objects or item ids.
     * @return array<int, int> old id => new id
     */
    public function changeIds(array|Collection $itemsOrItemIds): array {
        $itemsOrItemIds = $this->collectionToArray($itemsOrItemIds);
        $originalItemsById = $this->getOriginalItemsById($itemsOrItemIds);
        $itemIds = array_values(array_map(fn($itemOrItemId) => $this->getItemIdFromItemOrItemId($itemOrItemId), $itemsOrItemIds));
        $this->getRequiredItemsByIds($itemIds);
        $newIdsByOldId = $this->changeIdsByItemIds($itemIds);
        $this->syncOriginalItemIds($originalItemsById, $newIdsByOldId);

        return $newIdsByOldId;
    }

    /**
     * Change the ids of some items.
     * Usually, items that were visible in the front, and are put back invisible, so the user cannot track the id.
     */
    public function changeIdsForLocation(Location|array|string|int $location): void {
        $fromLocation = Location::from($location);
        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        $dbResults = $this->db->sqlGetRows("`{$idField->dbField}`", $this->getLocationWhereClause($fromLocation));
        $itemIds = array_values(array_map(fn($dbObject) => intval($dbObject[$idField->dbField]), $dbResults));
        $this->changeIdsByItemIds($itemIds);
    }

    /**
     * @return ItemField[]
     */
    private function getPersistedFields(): array {
        return array_values(array_filter(
            $this->fields,
            fn($field) => $field->kind !== ItemFieldKind::ID || $field->type !== 'int'
        ));
    }

    /**
     * @template U
     * @param array<int|string, U>|Collection<U> $items
     * @return array<int|string, U>
     */
    private function collectionToArray(array|Collection $items): array {
        return $items instanceof Collection ? $items->all() : $items;
    }

    /**
     * @param array<int, array<string, mixed>> $dbRows
     * @return Collection<T>
     */
    private function getItemCollectionFromDbRows(array $dbRows): Collection {
        return $this->getItemCollection(array_map(fn($dbItem) => $this->getItemFromDb($dbItem), $dbRows));
    }

    /**
     * @param T[] $items
     * @return Collection<T>
     */
    private function getItemCollection(array $items): Collection {
        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        $itemsById = [];

        foreach ($items as $item) {
            $itemsById[$item->{$idField->name}] = $item;
        }

        return new Collection($itemsById);
    }

    /**
     * @param array[] $itemsTypes
     * @param ItemField[] $fieldsToInsert
     * @return array<int, array<string, mixed>>
     */
    private function buildCreateRows(array $itemsTypes, array $fieldsToInsert): array {
        $locationField = $this->getItemFieldByKind(ItemFieldKind::LOCATION);
        $locationFields = $this->getLocationFields();
        $rows = [];

        foreach ($itemsTypes as $itemType) {
            $this->assertValidCreateItemKeys($itemType);

            $location = $itemType[$locationField->name] ?? null;
            if ((!is_string($location) && !is_int($location)) || $location === '') {
                throw new ItemManagerConfigurationException("Missing or invalid location when creating {$this->className} items");
            }

            $itemNumber = (int)($itemType['item_nbr'] ?? 1);
            if ($itemNumber < 0) {
                throw new ItemManagerConfigurationException("item_nbr must be >= 0 when creating {$this->className} items");
            }

            $row = [];
            foreach ($fieldsToInsert as $field) {
                $row[$field->name] = $itemType[$field->name] ?? null;
            }
            $locations = [];
            foreach ($locationFields as $field) {
                $locations[$field->locationIndex] = $row[$field->name] ?? null;
            }
            $this->assertKnownLocation(Location::from($locations));

            for ($i = 0; $i < $itemNumber; $i++) {
                $rows[] = $row;
            }
        }

        return $rows;
    }

    /**
     * @param array<string, mixed> $itemType
     */
    private function assertValidCreateItemKeys(array $itemType): void {
        $validKeys = array_fill_keys(array_map(fn($field) => $field->name, $this->fields), true);
        $validKeys['item_nbr'] = true;

        foreach (array_keys($itemType) as $key) {
            if (!array_key_exists($key, $validKeys)) {
                throw new ItemManagerConfigurationException("Unknown item property '{$key}' when creating {$this->className} items");
            }
        }
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     */
    private function assignInitialOrders(array &$rows): void {
        $orderField = $this->getItemFieldByKind(ItemFieldKind::ORDER);
        $nextOrderByLocation = [];

        foreach ($rows as $row) {
            $existingOrder = $row[$orderField->name] ?? null;
            if ($existingOrder === null) {
                continue;
            }

            $location = Location::from($this->getLocationsFromRow($row));
            $locationKey = $this->ordering->getLocationKey($location);
            if (!array_key_exists($locationKey, $nextOrderByLocation)) {
                $nextOrderByLocation[$locationKey] = $this->getNextOrderInLocation($location);
            }
            $nextOrderByLocation[$locationKey] = max(
                $nextOrderByLocation[$locationKey],
                ((int)$existingOrder) + 1,
            );
        }

        foreach ($rows as &$row) {
            if (($row[$orderField->name] ?? null) !== null) {
                continue;
            }

            $location = Location::from($this->getLocationsFromRow($row));
            $locationKey = $this->ordering->getLocationKey($location);
            if (!array_key_exists($locationKey, $nextOrderByLocation)) {
                $nextOrderByLocation[$locationKey] = $this->getNextOrderInLocation($location);
            }
            $row[$orderField->name] = $nextOrderByLocation[$locationKey];
            $nextOrderByLocation[$locationKey] = $row[$orderField->name] + 1;
        }
    }

    /**
     * Validate that registered locations reference only known locations.
     */
    private function validateRegisteredLocationReferences(): void {
        foreach ($this->locations as $location) {
            if ($location->autoReshuffleFrom !== null && !isset($this->locationsByName[$location->autoReshuffleFrom])) {
                throw new ItemManagerConfigurationException("Unknown autoReshuffleFrom location '{$location->autoReshuffleFrom}' on {$this->className}");
            }
        }
    }

    /**
     * Ensure a location is registered when locations are declared.
     */
    private function assertKnownLocation(Location $location): void {
        $locationName = $location->locations[0];
        $itemLocation = $this->getLocationByName($locationName);
        if (!$itemLocation) {
            throw new ItemManagerConfigurationException("Unknown location '{$locationName}' on {$this->className}");
        }

        $declaredLocationCount = count($this->getLocationFields());
        if (count($location->locations) > $declaredLocationCount) {
            throw new ItemManagerConfigurationException("Location '{$locationName}' on {$this->className} uses ".count($location->locations)." locations but only {$declaredLocationCount} LOCATION ItemField attributes are declared");
        }

        foreach ($location->locations as $locationIndex => $locationValue) {
            $field = $this->getItemFieldByKind(ItemFieldKind::LOCATION, $locationIndex);
            $matchesFieldType = match ($field->type) {
                'int' => is_int($locationValue),
                'string' => is_string($locationValue),
                default => true,
            };

            if (!$matchesFieldType) {
                throw new ItemManagerConfigurationException("Location '{$locationName}' on {$this->className} has invalid type for \${$field->name} (locationIndex {$locationIndex}): expected {$field->type}, got ".get_debug_type($locationValue));
            }
        }
    }

    /**
     * Ensure a read-only location filter references registered fields and uses compatible types.
     */
    private function assertKnownLocationFilter(Location $locationFilter): void {
        $locationNameFilter = $locationFilter->locations[0];
        $locationNames = is_array($locationNameFilter) ? $locationNameFilter : [$locationNameFilter];
        foreach ($locationNames as $locationName) {
            if (gettype($locationName) === 'string' && str_contains($locationName, '%')) {
                continue; // joker location, probably not declared in the locations
            }
            $itemLocation = $this->getLocationByName($locationName);
            if (!$itemLocation) {
                throw new ItemManagerConfigurationException("Unknown location '{$locationName}' on {$this->className}");
            }
        }
        $locationLabel = is_array($locationNameFilter) ? json_encode($locationNameFilter) : (string)$locationNameFilter;

        $declaredLocationCount = count($this->getLocationFields());
        if (count($locationFilter->locations) > $declaredLocationCount) {
            throw new ItemManagerConfigurationException("Location filter '{$locationLabel}' on {$this->className} uses ".count($locationFilter->locations)." locations but only {$declaredLocationCount} LOCATION ItemField attributes are declared");
        }

        foreach ($locationFilter->locations as $locationIndex => $locationValue) {
            if ($locationValue === null) {
                continue;
            }

            $field = $this->getItemFieldByKind(ItemFieldKind::LOCATION, $locationIndex);
            $values = is_array($locationValue) ? $locationValue : [$locationValue];
            foreach ($values as $value) {
                $matchesFieldType = match ($field->type) {
                    'int' => is_int($value),
                    'string' => is_string($value),
                    default => true,
                };

                if (!$matchesFieldType) {
                    throw new ItemManagerConfigurationException("Location filter '{$locationLabel}' on {$this->className} has invalid type for \${$field->name} (locationIndex {$locationIndex}): expected {$field->type}, got ".get_debug_type($value));
                }
            }
        }
    }

    /**
     * Ensure the item is an instance managed by this item manager.
     *
     * @param T $item
     */
    private function assertManagedItem(object $item): void {
        if (!$item instanceof $this->className) {
            throw new ItemManagerConfigurationException("Expected instance of {$this->className}, got ".get_class($item));
        }
    }

    /**
     * Ensure all items are instances managed by this item manager.
     *
     * @param T[] $items
     */
    private function assertManagedItems(array $items): void {
        foreach ($items as $item) {
            $this->assertManagedItem($item);
        }
    }

    /**
     * @param string[] $fieldNames
     * @return string[]
     */
    private function normalizeFieldNames(array $fieldNames): array {
        $normalizedFieldNames = [];

        foreach ($fieldNames as $fieldName) {
            $normalizedFieldNames[] = $this->getItemField($fieldName)->name;
        }

        return $normalizedFieldNames;
    }

    /**
     * Ensure the field belongs to this item manager.
     */
    private function getManagedField(ItemField $field): ItemField {
        $managedField = array_find(
            $this->fields,
            fn($candidate) => $candidate->name === $field->name && $candidate->dbField === $field->dbField
        );
        if ($managedField === null) {
            throw new ItemManagerConfigurationException("Unknown item field '{$field->name}' on {$this->className}");
        }

        return $managedField;
    }

    /**
     * To be called in upgradeTableDb to update the table created before a new columns were added.
     * 
     * Example with a target field added to the card object:
     *   if ($from_version <= 2607011209) {
     *       $this->cardManager->items->upgradeTableDbAddColumns(['target']);
     *   }
     * 
     * @param string[] $fieldNames the names of the new fields that have been added in the item class
     */
    public function upgradeTableDbAddColumns(array $fieldNames) {
        $columns = [];

        foreach ($this->fields as &$field) {
            if (!in_array($field->name, $fieldNames)) {
                continue; // not a new field
            }
            $result = Table::getUniqueValueFromDB("SHOW COLUMNS FROM `{$this->tableName}` LIKE '{$field->dbField}'");
            if (!is_null($result)) {
                continue; // the DB already has this field
            }

            $sqlType = $this->db->getSqlType($field);

            $columns[] = "ADD COLUMN `{$field->dbField}` $sqlType";
        }
        if (empty($columns)) {
            return;
        }
        $sql = "ALTER TABLE `DBPREFIX_{$this->tableName}` ".implode(',', $columns);
        Table::applyDbUpgradeToAllDB($sql);
    }
}
