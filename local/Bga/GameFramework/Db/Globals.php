<?php
declare(strict_types=1);

namespace Bga\GameFramework\Db;

use Bga\GameFramework\Helpers\Json;
use Bga\GameFramework\Table;

// small wrapper for DB calls to be able to mock the DB calls
// and once the games have their own Db class, we'll just replace this
// ⚠️ this class use $db and not game classes to bypass the `bga_` check.
class DbForGlobals {

    public function getUniqueValue(string $sql) {
        global $bgaContainer;
        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
        return $db->getUniqueValue($sql);
    }
    public function getSingleValueCollection(string $sql) {
        global $bgaContainer;
        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
        return $db->getCollection($sql, true);
    }
    public function getCollection(string $sql, bool $bSingleValue = false) {
        global $bgaContainer;
        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
        return $db->getCollection($sql, $bSingleValue);
    }
    public function query(string $sql) {
        global $bgaContainer;
        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
        return $db->query($sql);
    }
}

class Globals {
    var DbForGlobals $db;

    public function __construct() {
        $this->db = new DbForGlobals();
    }

    /**
     * Check if a variable exists in DB.
     */
    public function has(string $name): bool {
        return (int)$this->db->getUniqueValue("SELECT count(*) FROM `bga_globals` where `name` = '$name'") > 0;
    }

    /**
     * Retrieve a variable stored in DB.
     */
    public function get(string $name, mixed $defaultValue = null, ?string $class = null) {
        $json_obj = $this->db->getUniqueValue("SELECT `value` FROM `bga_globals` where `name` = '$name'");
        if ($json_obj !== null) {
            return Json::decode($json_obj, $class);
        } else {
            return $defaultValue;
        }
    }

    /**
     * Retrieve all variables stored in DB (or a selected subset, if the function is called with parameters).
     */
    public function getAll(string ...$names): array {
        $sql = "SELECT `name`, `value` FROM `bga_globals`";
        if (count($names) > 0) {
            $namesWithQuotes = array_map(fn($name) => "'$name'", $names);
            $sql .= " WHERE `name` IN (".implode(',', $namesWithQuotes).")";
        }
        $json_objs = $this->db->getSingleValueCollection($sql);
        return array_map(fn($json_obj) => Json::decode($json_obj), $json_objs);
    }

    /**
     * Store a variable (simple value, array or object) in DB.
     */
    public function set(string $name, mixed $obj): void {
        $jsonObj = Json::encode($obj);
        $escapedJson = Table::escapeStringOrNullForDB($jsonObj);
        $this->db->query("INSERT INTO `bga_globals`(`name`, `value`)  VALUES ('$name', $escapedJson) ON DUPLICATE KEY UPDATE `value` = $escapedJson");
    }

    /**
     * Increment a numeric variable in DB. Returns the new value of the variable.
     */
    public function inc(string $name, int $inc): int {
        $currentValue = $this->get($name);
        if (is_int($currentValue)) {
            $newValue = $currentValue + $inc;
            $this->set($name, $newValue);
            return $newValue;
        } else {
            throw new \BgaVisibleSystemException("Error when incrementing a global variable: $name is not a numeric value.");
        }
    }

    /**
     * Delete variables stored in DB.
     */
    public function delete(string ...$names): void {
        if (count($names) === 0) {
            return;
        }
        $this->db->query("DELETE FROM `bga_globals` where `name` in (".implode(',', array_map(fn($name) => "'$name'", $names)).")");
    }
}
