<?php
class Utils extends APP_GameClass
{
  public static function die($args = null)
  {
    throw new BgaVisibleSystemException(json_encode($args, JSON_PRETTY_PRINT));
  }

  // Array helpers

  public static function filterColumns($arr, $keys)
  {
    return array_map(function ($row) use ($keys) {
      return self::map(function ($key) use ($row) {
        return $row[$key];
      }, $keys);
    }, $arr);
  }

  public static function parseInt($arr, $columns)
  {
    foreach ($arr as $idx => $row) {
      foreach ($row as $key => $val) {
        $arr[$idx][$key] = in_array($key, $columns) ? intval($val) : $val;
      }
    }
    return $arr;
  }

  // like array_map, but the entriess off arr will be the keys
  public static function map($callback, $arr)
  {
    return array_combine(array_values($arr), array_map($callback, $arr));
  }

  // return an array of values that have a duplicate
  // note: if a value appears 3-4x in the argument, it will appear 2-3x in the results
  // the argument has to be sorted by type_arg
  public static function getDoubles($values)
  {
    //get all values that equal the value before hem
    $res = array_filter(
      $values,
      function ($val, $idx) use ($values) {
        return $idx > 0 && $values[$idx - 1] == $val;
      },
      ARRAY_FILTER_USE_BOTH
    );
    return array_values($res); // since array_fiilter keeps the keys we need to apply array_values
  }
}
?>
