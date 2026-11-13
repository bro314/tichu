<?php
declare(strict_types=1);

namespace Bga\GameFramework\Helpers;

/**
 * @template T
 * @extends \ArrayObject<int|string, T>
 */
class Collection extends \ArrayObject
{
  /**
   * Return the keys used by this collection.
   *
   * @return array<int, int|string>
   */
  public function keys(): array
  {
    return array_keys($this->getArrayCopy());
  }

  /**
   * Check whether the collection contains no items.
   *
   * @return bool
   */
  public function isEmpty(): bool
  {
    return empty($this->getArrayCopy());
  }

  /**
   * Return the first value in insertion order, or null when the collection is empty.
   *
   * @return T|null
   */
  public function first(): mixed
  {
    $arr = $this->values();
    return isset($arr[0]) ? $arr[0] : null;
  }

  /**
   * Return the last value in insertion order, or null when the collection is empty.
   *
   * @return T|null
   */
  public function last(): mixed
  {
    $arr = $this->values();
    return empty($arr) ? null : $arr[count($arr) - 1];
  }

  /**
   * Return a new collection with the given object stored under its id.
   * Note that if the collection already has an object with the same key, it will be replaced
   *
   * @param T $obj Object to add to the collection
   * @param ?int $id the id of the object, if it's not stored under the 'id' key
   * @return Collection<T>
   */
  public function add(mixed $obj, ?int $id = null): Collection
  {
    $items = $this->all();
    $items[$id ?? $this->getObjectValue($obj, 'id')] = $obj;
    return new Collection($items);
  }

  /**
   * Check whether the collection contains an item for the given key.
   *
   * @param int|string $key Key to look for.
   * @return bool
   */
  public function has(int|string $key): bool
  {
    return array_key_exists($key, $this->getArrayCopy());
  }

  /**
   * Return a random value from the collection, or null when it is empty.
   *
   * @return T|null
   */
  public function random(): mixed
  {
    $arr = $this->getArrayCopy();
    if (empty($arr)) {
      return null;
    }

    $key = array_rand($arr, 1);
    return $arr[$key];
  }

  /**
   * Return all values without preserving their original keys.
   *
   * @return T[]
   */
  public function values(): array
  {
    return array_values($this->getArrayCopy());
  }

  /**
   * Return all items as a native PHP array while preserving keys.
   *
   * @return array<int|string, T>
   */
  public function all(): array
  {
    return $this->getArrayCopy();
  }

  /**
   * Return a new collection without values found in another collection.
   *
   * @param Collection<T> $remove Collection of values to remove.
   * @param callable(T, T): bool|null $compareFn Optional equality comparator.
   * @return Collection<T>
   */
  public function diff(Collection $remove, ?callable $compareFn = null): Collection
  {
    return $this->filter(function ($value) use ($remove, $compareFn) {
      return !$remove->some(function ($removedValue) use ($value, $compareFn) {
        return $compareFn !== null ? $compareFn($value, $removedValue) : $value === $removedValue;
      });
    });
  }

  /**
   * Return a new collection containing one property value extracted from each item.
   *
   * @param string $property Property, array key, or getter suffix to read.
   * @return Collection<mixed>
   */
  public function pluck(string $property): Collection
  {
    return $this->map(fn($item) => $this->getObjectValue($item, $property));
  }

  /**
   * Return the first value matching the predicate, or null when none matches.
   *
   * @param (callable(T): bool)|(callable(T, int|string): bool) $fn Predicate receiving value and optionally key.
   * @return T|null
   */
  public function find(callable $fn): mixed
  {
    foreach ($this->all() as $key => $value) {
      if ($fn($value, $key)) {
        return $value;
      }
    }

    return null;
  }

  /**
   * Return the key of the first value matching the predicate, or null when none matches.
   *
   * @param (callable(T): bool)|(callable(T, int|string): bool) $fn Predicate receiving value and optionally key.
   * @return int|string|null
   */
  public function findKey(callable $fn): int|string|null
  {
    foreach ($this->all() as $key => $value) {
      if ($fn($value, $key)) {
        return $key;
      }
    }

    return null;
  }

  /**
   * Count all values, or only values matching a predicate when provided.
   *
   * @param ((callable(T): bool)|(callable(T, int|string): bool))|null $fn Predicate receiving value and optionally key.
   * @return int
   */
  public function count(?callable $fn = null): int
  {
    return $fn === null
      ? parent::count()
      : count(array_filter($this->all(), $fn, ARRAY_FILTER_USE_BOTH));
  }

  /**
   * Check whether at least one value matches the predicate.
   *
   * @param (callable(T): bool)|(callable(T, int|string): bool) $fn Predicate receiving value and optionally key.
   * @return bool
   */
  public function some(callable $fn): bool
  {
    foreach ($this->all() as $key => $value) {
      if ($fn($value, $key)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check whether every value matches the predicate.
   *
   * @param (callable(T): bool)|(callable(T, int|string): bool) $fn Predicate receiving value and optionally key.
   * @return bool
   */
  public function every(callable $fn): bool
  {
    foreach ($this->all() as $key => $value) {
      if (!$fn($value, $key)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Return a new collection with each value transformed by the callback.
   *
   * @template U
   * @param (callable(T): U)|(callable(T, int|string): U) $func Callback receiving value and optionally key.
   * @return Collection<U>
   */
  public function map(callable $func): Collection
  {
    $result = [];
    foreach ($this->all() as $key => $value) {
      $result[$key] = $func($value, $key);
    }
    return new Collection($result);
  }

  /**
   * Return a new collection containing this collection plus keys not already present from another collection.
   *
   * @param Collection<T> $arr Collection to merge after this one.
   * @return Collection<T>
   */
  public function merge(Collection $arr): Collection
  {
    return new Collection($this->all() + $arr->all());
  }

  /**
   * Reduce the collection values to a single value.
   *
   * @template U
   * @param callable(U, T): U $func Reducer receiving accumulator and value.
   * @param U $init Initial accumulator value.
   * @return U
   */
  public function reduce(callable $func, mixed $init): mixed
  {
    return array_reduce($this->values(), $func, $init);
  }

  /**
   * Return a new collection containing only values matching the predicate.
   *
   * @param (callable(T): bool)|(callable(T, int|string): bool) $func Predicate receiving value and optionally key.
   * @return Collection<T>
   */
  public function filter(callable $func): Collection
  {
    return new Collection(array_filter($this->all(), $func, ARRAY_FILTER_USE_BOTH));
  }

  /**
   * Return a new collection containing a key-preserving slice of this collection.
   *
   * @param int $offset Starting offset.
   * @param int|null $length Maximum number of items to return, or null for all remaining items.
   * @return Collection<T>
   */
  public function slice(int $offset, ?int $length = null): Collection
  {
    return new Collection(array_slice($this->all(), $offset, $length, true));
  }

  /**
   * Return a new collection containing the first N items.
   *
   * @param int $n Number of items to return.
   * @return Collection<T>
   */
  public function take(int $n): Collection
  {
    return $this->slice(0, $n);
  }

  /**
   * Check whether the collection contains the given object.
   *
   * @param T $t Value to look for.
   * @return bool
   */
  public function contains(mixed $t): bool
  {
    return in_array($t, $this->getArrayCopy());
  }

  /**
   * Return a new collection sorted with a value comparator while preserving keys.
   *
   * @param callable(T, T): int $callback Comparator compatible with uasort().
   * @return Collection<T>
   */
  public function sort($callback): Collection
  {
    $t = $this->getArrayCopy();
    \uasort($t, $callback);
    return new Collection($t);
  }

  /*****
   * Méthods for collection of object
   */
  /**
   * Return a new collection containing items where a field matches a value.
   *
   * Array values are treated as an allowed set, and string values containing "%"
   * are matched as SQL-like patterns.
   *
   * @param string $field Field, array key, or getter suffix to read.
   * @param mixed $value Value, list of values or pattern.
   * @param bool $strict Use strict comparison for scalar values and allowed sets.
   * @return Collection<T>
   */
  public function where(string $field, mixed $value, bool $strict = true): Collection
  {
    return $this->filter(function ($obj) use ($field, $value, $strict) {
        $objValue = $this->getObjectValue($obj, $field);
        return $this->matchesValue($objValue, $value, $strict);
      });
  }

  /**
   * Count items where a field matches a value.
   *
   * Array values are treated as an allowed set, and string values containing "%"
   * are matched as SQL-like patterns.
   *
   * @param string $field Field, array key, or getter suffix to read.
   * @param mixed $value Value, list of values or pattern.
   * @param bool $strict Use strict comparison for scalar values and allowed sets.
   * @return int
   */
  public function countWhere(string $field, mixed $value, bool $strict = true): int
  {
    return $this->count(function ($obj) use ($field, $value, $strict) {
      $objValue = $this->getObjectValue($obj, $field);
      return $this->matchesValue($objValue, $value, $strict);
    });
  }

  /**
   * Return a new collection containing items where a field does not match a value.
   *
   * Array values are treated as a disallowed set, and string values containing "%"
   * are matched as SQL-like patterns.
   *
   * @param string $field Field, array key, or getter suffix to read.
   * @param mixed $value Value, list of values or pattern.
   * @param bool $strict Use strict comparison for scalar values and allowed sets.
   * @return Collection<T>
   */
  public function whereNot(string $field, mixed $value, bool $strict = true): Collection
  {
    return $this->filter(function ($obj) use ($field, $value, $strict) {
        $objValue = $this->getObjectValue($obj, $field);
        return !$this->matchesValue($objValue, $value, $strict);
      });
  }

  /**
   * Return a new collection containing items where a field is null.
   *
   * @param string $field Field, array key, or getter suffix to read.
   * @return Collection<T>
   */
  public function whereNull(string $field): Collection
  {
    return $this->filter(function ($obj) use ($field) {
      $objValue = $this->getObjectValue($obj, $field);
      return is_null($objValue);
    });
  }

  /**
   * Return a new collection sorted by a field value.
   *
   * @param string $field Field, array key, or getter suffix to read.
   * @param string $asc 'ASC' or 'DESC', default 'ASC'.
   * @return Collection<T>
   */
  public function sortBy(string $field, string $asc = 'ASC'): Collection
  {
    return $this->sort(function ($a, $b) use ($field, $asc) {
      $order = $this->getObjectValue($a, $field) <=> $this->getObjectValue($b, $field);
      return strtolower($asc) == 'desc' ? -$order : $order;
    });
  }

  /**
   * Group items by a field value or callback result.
   *
   * Original keys are retained within each group.
   *
   * @param string|((callable(T): (int|string))|(callable(T, int|string): (int|string))) $criteria Field, array key, getter suffix, or callback.
   * @return Collection<Collection<T>>
   */
  public function groupBy(string|callable $criteria): Collection
  {
    $groups = [];
    foreach ($this->all() as $key => $item) {
      $groupKey = is_string($criteria)
        ? $this->getObjectValue($item, $criteria)
        : $criteria($item, $key);

      if (!is_int($groupKey) && !is_string($groupKey)) {
        throw new \InvalidArgumentException('The group key must be an integer or string.');
      }

      if (!isset($groups[$groupKey])) {
        $groups[$groupKey] = [];
      }
      $groups[$groupKey][$key] = $item;
    }

    return new Collection(array_map(fn(array $items) => new Collection($items), $groups));
  }

  /**
   * Return a new collection with each item's field updated on a cloned item.
   *
   * The update uses a setter named set<Field>() when available, otherwise it
   * writes to a matching public property.
   *
   * @param string $field Field or setter suffix to update.
   * @param mixed $value Value to assign.
   * @return Collection<T>
   */
  public function update(string $field, mixed $value): Collection
  {
    $method = 'set' . ucfirst($field);
    $items = $this->all();
    foreach ($items as $key => $obj) {
      if (is_array($obj)) {
        $updated = $obj;
        $updated[$field] = $value;
      } else {
        if (!is_object($obj)) {
          throw new \BadMethodCallException("Cannot update field '{$field}' on a scalar item.");
        }

        $updated = clone $obj;
        if (method_exists($updated, $method)) {
          $updated->$method($value);
        } elseif (property_exists($updated, $field)) {
          $updated->{$field} = $value;
        } else {
          throw new \BadMethodCallException("Cannot update field '{$field}' without {$method}() or a matching property.");
        }
      }
      $items[$key] = $updated;
    }
    // PHPStan cannot retain T after the runtime array/object narrowing above.
    // @phpstan-ignore return.type
    return new Collection($items);
  }

  /**
   * Read a field value from an array, getter, or public object property.
   *
   * @param object|array $object Item to read from.
   * @param string $field Field, array key, or getter suffix to read.
   * @return mixed
   */
  private function getObjectValue(object|array $object, string $field): mixed {
    if (is_array($object)) {
      return $object[$field] ?? null;
    }
    // first check for a getter
    $method = 'get' . ucfirst($field);
    if (method_exists($object, $method)) {
      return $object->$method();
    }
    // if no getter, access the field directly
    return property_exists($object, $field) ? $object->{$field} : null;
  }

  /**
   * Check whether a field value matches a target value, allowed set, or SQL-like pattern.
   *
   * @param mixed $objectValue Field value read from an item.
   * @param mixed $value Value, list of values, or pattern to match.
   * @param bool $strict Use strict comparison for scalar values and allowed sets.
   * @return bool
   */
  private function matchesValue(mixed $objectValue, mixed $value, bool $strict = true): bool
  {
    if (is_array($value)) {
      return in_array($objectValue, $value, $strict);
    }

    if (is_string($value) && str_contains($value, '%')) {
      return ($strict ? is_string($objectValue) : (is_scalar($objectValue) || $objectValue instanceof \Stringable))
        && $this->like_match($value, (string) $objectValue);
    }

    if (is_object($objectValue) !== is_object($value) || is_array($objectValue)) {
      return false;
    }

    return $strict ? $objectValue === $value : $objectValue == $value;
  }

  /**
   * Check whether a subject matches a SQL-like pattern using "%" as wildcard.
   *
   * @param string $pattern Pattern containing optional "%" wildcards.
   * @param string $subject Value to test.
   * @return bool
   */
  private function like_match(string $pattern, string $subject): bool
  {
    $pattern = str_replace('%', '.*', preg_quote($pattern, '/'));
    return (bool) preg_match("/^{$pattern}$/i", $subject);
  }
}
