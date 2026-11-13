<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components\ItemManager;

use Bga\GameFramework\Helpers\Collection;

/**
 * Encapsulates all bucket ordering and move semantics for item managers.
 *
 * @template T of object
 */
class ItemOrderingService {
    /**
     * @param ItemField[] $fields
     * @param \Closure(?array): ?object $getItemFromDb
     * @param \Closure(): Collection<T> $getAllItems
     * @param \Closure(Location, bool, ?int, ?string): Collection<T> $getItemsInLocation
     */
    public function __construct(
        private ItemManagerDbService $db,
        private array $fields,
        private \Closure $getItemFromDb,
        private \Closure $getAllItems,
        private \Closure $getItemsInLocation,
    ) {
    }

    public function getItemFieldByKind(ItemFieldKind $kind, int $locationIndex = 0): ItemField {
        $field = null;
        if ($kind === ItemFieldKind::LOCATION) {
            $field = array_find($this->fields, fn($field) => $field->kind === $kind && $field->locationIndex === $locationIndex);
        } else {
            $field = array_find($this->fields, fn($field) => $field->kind === $kind);
        }
        if ($field === null) {
            throw new ItemManagerConfigurationException("Unknown item field kind '{$kind->value}'");
        }

        return $field;
    }

    /**
     * @return ItemField[]
     */
    public function getLocationFields(): array {
        $fields = array_values(array_filter(
            $this->fields,
            fn(ItemField $field) => $field->kind === ItemFieldKind::LOCATION,
        ));

        usort($fields, fn(ItemField $a, ItemField $b) => $a->locationIndex <=> $b->locationIndex);
        return $fields;
    }

    /**
     * @return array<int, string|int|null>
     */
    public function getLocationsForFields(Location $location): array {
        foreach ($location->locations as $index => $_location) {
            $this->getItemFieldByKind(ItemFieldKind::LOCATION, $index);
        }

        $locations = [];
        foreach ($this->getLocationFields() as $field) {
            $locations[$field->locationIndex] = $location->locations[$field->locationIndex] ?? null;
        }

        return $locations;
    }

    /**
     * @return array<int, string|int|null>
     */
    public function trimTrailingNullLocations(array $locations): array {
        $locations = array_values($locations);
        while (count($locations) > 0 && $locations[count($locations) - 1] === null) {
            array_pop($locations);
        }

        return $locations;
    }

    /**
     * @return array<int, string|int|null>
     */
    private function getItemLocations(object $item): array {
        $locations = [];
        foreach ($this->getLocationFields() as $field) {
            $locations[$field->locationIndex] = $item->{$field->name};
        }

        return $this->trimTrailingNullLocations($locations);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<int, string|int|null>
     */
    public function getLocationsFromRow(array $row): array {
        $locations = [];
        foreach ($this->getLocationFields() as $field) {
            $locations[$field->locationIndex] = $row[$field->name] ?? null;
        }

        return $this->trimTrailingNullLocations($locations);
    }

    /**
     * @return array<array{0: ItemField, 1: array<int, string|int>}>
     */
    public function getLocationFilters(Location $location): array {
        $filters = [];

        foreach ($location->locations as $index => $locationValue) {
            $filters[] = [$this->getItemFieldByKind(ItemFieldKind::LOCATION, $index), [$locationValue]];
        }

        return $filters;
    }

    /**
     * @return array<array{0: ItemField, 1: array<int, string|int>}>
     */
    public function getLocationFilterFilters(Location $locationFilter): array {
        $filters = [];

        foreach ($locationFilter->locations as $index => $locationValue) {
            if ($locationValue === null) {
                continue;
            }

            $filters[] = [
                $this->getItemFieldByKind(ItemFieldKind::LOCATION, $index),
                is_array($locationValue) ? $locationValue : [$locationValue],
            ];
        }

        return $filters;
    }

    private function itemMatchesLocation(object $item, Location $location): bool {
        $locations = $this->getLocationsForFields($location);
        foreach ($this->getLocationFields() as $field) {
            if ($item->{$field->name} !== $locations[$field->locationIndex]) {
                return false;
            }
        }

        return true;
    }

    public function getLocationWhereClause(Location $location): string {
        $wheres = [];
        foreach ($location->locations as $index => $locationValue) {
            $locationField = $this->getItemFieldByKind(ItemFieldKind::LOCATION, $index);
            $wheres[] = $this->db->sqlEqualValue($locationField, $locationValue);
        }

        return implode(' AND ', $wheres);
    }

    public function getLocationFilterWhereClause(Location $locationFilter): string {
        $wheres = [];
        foreach ($locationFilter->locations as $index => $locationValue) {
            if ($locationValue === null) {
                continue;
            }

            $locationField = $this->getItemFieldByKind(ItemFieldKind::LOCATION, $index);
            $wheres[] = is_array($locationValue)
                ? $this->db->sqlInValues($locationField, $locationValue)
                : $this->db->sqlEqualValue($locationField, $locationValue);
        }

        return implode(' AND ', $wheres);
    }

    public function getLocationKey(Location $location): string {
        $locations = $this->trimTrailingNullLocations($this->getLocationsForFields($location));
        return implode('|', array_map(
            fn(string|int|null $location) => $location === null ? 'null' : (string) $location,
            $locations,
        ));
    }

    /**
     * @return T[]
     */
    private function getOrderedItemsForLocation(Location $location): array {
        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        $orderField = $this->getItemFieldByKind(ItemFieldKind::ORDER);

        // Use the id as a stable tie-breaker when legacy data contains duplicate orders.
        $dbResults = $this->db->sqlGetRows(
            "*",
            $this->getLocationWhereClause($location),
            orderBy: "`{$orderField->dbField}` ASC, `{$idField->dbField}` ASC",
        );

        return array_map($this->getItemFromDb, $dbResults);
    }

    /**
     * @param T[] $items
     * @return T[]
     */
    private function getUniqueItemsById(array $items): array {
        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        $uniqueItems = [];

        foreach ($items as $item) {
            $uniqueItems[$item->{$idField->name}] = $item;
        }

        return array_values($uniqueItems);
    }

    /**
     * @param T[] $items
     * @param array<int|string, true> $movingIds
     * @return T[]
     */
    private function removeItemsFromList(array $items, array $movingIds): array {
        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);

        return array_values(array_filter(
            $items,
            fn($item) => !isset($movingIds[$item->{$idField->name}])
        ));
    }

    private function clampInsertPosition(int $position, int $maxPosition): int {
        return max(0, min($position, $maxPosition));
    }

    /**
     * When moving within the destination bucket, removing the moving items first
     * shifts later target slots to the left. Convert a current order value into
     * the matching insert index after the moving block has been removed.
     *
     * @param T[] $items
     */
    private function getInsertPositionAfterRemovingMovingItems(array $items, Location $to, int $position): int {
        $orderField = $this->getItemFieldByKind(ItemFieldKind::ORDER);
        $removedBeforePosition = 0;

        foreach ($items as $item) {
            if (
                $this->itemMatchesLocation($item, $to)
                && $item->{$orderField->name} !== null
                && $item->{$orderField->name} < $position
            ) {
                $removedBeforePosition++;
            }
        }

        return $position - $removedBeforePosition;
    }

    /**
     * @param T[] $items
     */
    private function persistLocationOrdering(array $items, Location $location): void {
        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        $locationFields = $this->getLocationFields();
        $orderField = $this->getItemFieldByKind(ItemFieldKind::ORDER);
        $locations = $this->getLocationsForFields($location);
        $updatesById = [];

        // After any move, rewrite the whole bucket so order stays dense and deterministic.
        foreach (array_values($items) as $order => $item) {
            $fieldValues = [];

            foreach ($locationFields as $locationField) {
                $locationValue = $locations[$locationField->locationIndex];
                if ($item->{$locationField->name} !== $locationValue) {
                    $item->{$locationField->name} = $locationValue;
                    $fieldValues[$locationField->name] = $locationValue;
                }
            }

            if ($item->{$orderField->name} !== $order) {
                $item->{$orderField->name} = $order;
                $fieldValues[$orderField->name] = $order;
            }

            if (!empty($fieldValues)) {
                $updatesById[$item->{$idField->name}] = $fieldValues;
            }
        }

        $this->db->updateRowsByMatchValues(
            $idField,
            array_merge($locationFields, [$orderField]),
            $updatesById,
        );
    }

    /**
     * Move a set of items as an ordered block, then reindex every affected location.
     *
     * @param T[] $items
     */
    private function moveItemsAsBlock(array $items, Location $to, ?int $position = null): void {
        // Deduplicate first so callers can safely pass overlapping arrays.
        $items = $this->getUniqueItemsById($items);
        if (count($items) === 0) {
            return;
        }

        $idField = $this->getItemFieldByKind(ItemFieldKind::ID);
        $orderField = $this->getItemFieldByKind(ItemFieldKind::ORDER);
        
        // sort the items by order, so moving multiple items from one location to another will keep ordering by default
        usort($items, fn($a, $b) => [$a->{$orderField->name}, $a->{$idField->name}] <=> [$b->{$orderField->name}, $b->{$idField->name}]);

        $movingIds = [];
        foreach ($items as $item) {
            $movingIds[$item->{$idField->name}] = true;
        }

        $affectedLocations = [];
        foreach ($items as $item) {
            $sourceLocations = $this->getItemLocations($item);
            $sourceKey = $this->getLocationKey(Location::from($sourceLocations));

            if (!isset($affectedLocations[$sourceKey])) {
                // Remove the whole moving block from each source bucket before inserting it elsewhere.
                $affectedLocations[$sourceKey] = [
                    'locations' => $sourceLocations,
                    'items' => $this->removeItemsFromList(
                        $this->getOrderedItemsForLocation(Location::from($sourceLocations)),
                        $movingIds
                    ),
                ];
            }
        }

        $destinationKey = $this->getLocationKey($to);
        if (!isset($affectedLocations[$destinationKey])) {
            $affectedLocations[$destinationKey] = [
                'locations' => $this->trimTrailingNullLocations($this->getLocationsForFields($to)),
                'items' => $this->getOrderedItemsForLocation($to),
            ];
        }

        $destinationItems = $affectedLocations[$destinationKey]['items'];
        // Clamp the target slot so callers can say "append" with any large index.
        $requestedPosition = $position === null
            ? count($destinationItems)
            : $this->getInsertPositionAfterRemovingMovingItems($items, $to, $position);
        $insertPosition = $this->clampInsertPosition($requestedPosition, count($destinationItems));
        array_splice($destinationItems, $insertPosition, 0, $items);
        $affectedLocations[$destinationKey]['items'] = $destinationItems;

        foreach ($affectedLocations as $affectedLocation) {
            $this->persistLocationOrdering(
                $affectedLocation['items'],
                Location::from($affectedLocation['locations']),
            );
        }
    }

    public function moveAllItemsInLocation(?Location $from, Location $to): void {
        // Preserve the current relative order of the source bucket while moving it as one block.
        $items = $from === null ? ($this->getAllItems)() : ($this->getItemsInLocation)($from, false, null, null);
        $this->moveItemsAsBlock($items->values(), $to);
    }

    public function appendToLocation(object $item, Location $to): void {
        $this->moveItemsAsBlock([$item], $to);
    }

    public function insertAt(object $item, Location $to, int $position): void {
        $this->moveItemsAsBlock([$item], $to, $position);
    }

    public function moveWithinLocation(object $item, int $position): void {
        $this->moveItemsAsBlock(
            [$item],
            Location::from($this->getItemLocations($item)),
            $position,
        );
    }

    public function setItemOrder(object $item, int $order): void {
        $this->moveWithinLocation($item, $order);
    }

    public function moveItem(object $item, Location $to, ?int $order = null): void {
        if ($order !== null) {
            $this->insertAt($item, $to, $order);
        } else {
            $this->appendToLocation($item, $to);
        }
    }

    /**
     * @param T[] $items
     */
    public function moveItems(array $items, Location $to, bool $prepend = false): void {
        $this->moveItemsAsBlock($items, $to, $prepend ? 0 : null);
    }
}
