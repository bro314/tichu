<?php
class Utils
{
  public static function die(mixed $args = null): never
  {
    $encoded = json_encode($args, JSON_PRETTY_PRINT);
    throw new BgaVisibleSystemException($encoded !== false ? $encoded : "");
  }

  // Array helpers

  /**
   * @param array<int|string, array<string, mixed>> $arr
   * @param array<int, string> $keys
   * @return array<int|string, array<string, mixed>>
   */
  public static function filterColumns(array $arr, array $keys): array
  {
    return array_map(function (array $row) use ($keys): array {
      return self::map(function (string $key) use ($row): mixed {
        return $row[$key];
      }, $keys);
    }, $arr);
  }

  /**
   * @param array<int|string, array<string, mixed>> $arr
   * @param array<int, string> $columns
   * @return array<int|string, array<string, mixed>>
   */
  public static function parseInt(array $arr, array $columns): array
  {
    foreach ($arr as $idx => $row) {
      foreach ($row as $key => $val) {
        $arr[$idx][$key] = in_array($key, $columns) ? intval($val) : $val;
      }
    }
    return $arr;
  }

  /**
   * like array_map, but the entries of arr will be the keys
   *
   * @template TKey of array-key
   * @template TVal
   * @param callable(TKey): TVal $callback
   * @param array<int|string, TKey> $arr
   * @return array<TKey, TVal>
   */
  public static function map(callable $callback, array $arr): array
  {
    return array_combine(array_values($arr), array_map($callback, $arr));
  }

  /**
   * return an array of values that have a duplicate
   * note: if a value appears 3-4x in the argument, it will appear 2-3x in the results
   * the argument has to be sorted by type_arg
   *
   * @param array<int, int|string> $values
   * @return array<int, int|string>
   */
  public static function getDoubles(array $values): array
  {
    //get all values that equal the value before hem
    $res = array_filter(
      $values,
      function ($val, $idx) use ($values): bool {
        return $idx > 0 && $values[$idx - 1] == $val;
      },
      ARRAY_FILTER_USE_BOTH
    );
    return array_values($res); // since array_filter keeps the keys we need to apply array_values
  }
}
?>
