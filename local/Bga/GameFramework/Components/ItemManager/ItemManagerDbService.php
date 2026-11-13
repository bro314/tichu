<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components\ItemManager;

use Bga\GameFramework\Helpers\Json;
use Bga\GameFramework\Table;

class ItemManagerDbService {
    private ?\Closure $dbUpdateCallback;

    public function __construct(
        protected string $tableName,
        ?callable $dbUpdateCallback = null,
    ) {
        $this->dbUpdateCallback = $dbUpdateCallback ? \Closure::fromCallable($dbUpdateCallback) : null;
    }

    public function getSqlType(ItemField $field): string {
        $sqlType = match($field->type) {
            'bool' => 'TINYINT',
            'int' => 'INT',
            'float' => 'FLOAT',
            'double' => 'DOUBLE',
            'string' => 'VARCHAR(256)', // force to allow 2bits for char length (> 255)
            'json' => $field->serialize ? 'TEXT' : 'JSON',
            default => throw new ItemManagerConfigurationException("Unsupported item field type '{$field->type}'"),
        };
        return $sqlType;
    }

    public function sqlCreate(string $columns) {
        Table::DbQuery("CREATE TABLE `{$this->tableName}` ($columns) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;");
    }

    /**
     * @param ItemField[] $insertFields
     * @param array<int, array<string, mixed>> $rows
     * @param ItemField[]|null $callbackFields
     */
    public function insertRows(array $insertFields, array $rows, ?array $callbackFields = null): void {
        if (count($insertFields) === 0 || count($rows) === 0) {
            return;
        }

        $columns = implode(',', array_map(fn($field) => "`{$field->dbField}`", $insertFields));
        $values = array_map(function(array $row) use ($insertFields) {
            $rowValues = [];
            foreach ($insertFields as $field) {
                $rowValues[] = $this->getSqlValue($field, $row[$field->name] ?? null);
            }

            return "(".implode(",", $rowValues).")";
        }, $rows);

        Table::DbQuery("INSERT INTO `{$this->tableName}` ($columns) VALUES ".implode(",", $values));
        $this->emitDbUpdate('INSERT', $this->buildInsertedDbUpdateLines($callbackFields ?? $insertFields, $rows));
    }

    /**
     * @param ItemField[] $fields
     * @param array<int|string, array<string, mixed>> $valuesByMatchValue
     */
    public function updateRowsByMatchValues(ItemField $matchField, array $fields, array $valuesByMatchValue): void {
        if (count($fields) === 0 || count($valuesByMatchValue) === 0) {
            return;
        }

        $matchValues = array_keys($valuesByMatchValue);
        $updates = [];

        foreach ($fields as $field) {
            $cases = [];
            foreach ($valuesByMatchValue as $matchValue => $fieldValues) {
                if (!array_key_exists($field->name, $fieldValues)) {
                    continue;
                }

                $cases[] = "WHEN ".$this->getSqlValue($matchField, $matchValue)." THEN ".$this->getSqlValue($field, $fieldValues[$field->name]);
            }

            if (count($cases) === 0) {
                continue;
            }

            $updates[] = "`{$field->dbField}` = CASE `{$matchField->dbField}` ".implode(' ', $cases)." ELSE `{$field->dbField}` END";
        }

        if (count($updates) === 0) {
            return;
        }

        $this->runUpdate(
            implode(', ', $updates),
            $this->sqlInValues($matchField, $matchValues),
            $this->buildDbUpdateLines($fields, $valuesByMatchValue, $matchField),
        );
    }

    public function sqlGetValue(string $column, string $condition = '1') {
        return Table::getUniqueValueFromDB("SELECT $column FROM `{$this->tableName}` WHERE $condition");
    }

    private function buildSelectSql(string $columns = '*', ?string $condition = null, ?string $orderBy = null, ?int $limit = null): string {
        $sql = "SELECT $columns FROM `{$this->tableName}`";
        if ($condition !== null) {
            $sql .= " WHERE $condition";
        }
        if ($orderBy !== null) {
            $sql .= " ORDER BY $orderBy";
        }
        if ($limit !== null) {
            $sql .= " LIMIT $limit";
        }
        return $sql;
    }

    public function sqlGetRows(string $columns = '*', ?string $condition = null, ?string $orderBy = null, ?int $limit = null): array {
        return Table::getObjectListFromDB($this->buildSelectSql($columns, $condition, $orderBy, $limit));
    }

    public function sqlGetMap(string $columns = '*', ?string $condition = null, ?string $orderBy = null, ?int $limit = null): array {
        $sql = $this->buildSelectSql($columns, $condition, $orderBy, $limit);
        return Table::getCollectionFromDb($sql);
    }

    public function sqlEqual(ItemField $field, mixed $item): string {
        return $this->sqlEqualValue($field, $item->{$field->name});
    }

    public function sqlEqualValue(ItemField $field, mixed $value): string {
        if ($value === null) {
            return "`{$field->dbField}` IS NULL";
        }
        if (gettype($value) === 'string' && str_contains($value, '%')) {
            return "`{$field->dbField}` LIKE ".$this->getSqlValue($field, $value);
        }
        return "`{$field->dbField}` = ".$this->getSqlValue($field, $value);
    }

    public function sqlGreaterValue(ItemField $field, mixed $value, bool $orEqual = false): string {
        $operator = $orEqual ? '>=' : '>';
        return "`{$field->dbField}` $operator ".$this->getSqlValue($field, $value);
    }

    public function sqlLowerValue(ItemField $field, mixed $value, bool $orEqual = false): string {
        $operator = $orEqual ? '<=' : '<';
        return "`{$field->dbField}` $operator ".$this->getSqlValue($field, $value);
    }

    public function sqlInValues(ItemField $field, array $values): string {
        $values = array_values($values);

        if (count($values) === 1) {
            return $this->sqlEqualValue($field, $values[0]);
        }

        return "`{$field->dbField}` IN (".implode(',', array_map(fn($value) => $this->getSqlValue($field, $value), $values)).")";
    }

    public function getSqlValue(ItemField $field, mixed $value): string {
        $sqlValueStr = 'NULL';
        if ($value !== null) {
            if ($field->type === 'bool') {
                $sqlValueStr = $value ? '1' : '0';
            } else if ($field->type === 'json') {
                $jsonObj = $field->serialize ? serialize($value) : Json::encode($value);
                $sqlValueStr = "'".Table::escapeStringForDB($jsonObj)."'";
            } else {
                $sqlValueStr = "'".Table::escapeStringForDB((string) $value)."'";
            }
        }
        return $sqlValueStr;
    }

    public function getValueFromSql(ItemField $field, ?string $sqlValue): mixed {
        $value = null;
        if ($sqlValue !== null) {
            if ($field->type === 'bool') {
                $value = boolval($sqlValue);
            } else if ($field->type === 'int') {
                $value = intval($sqlValue);
            } else if ($field->type === 'json') {
                $value = $field->serialize ? unserialize($sqlValue) : Json::decode($sqlValue, $field->class);
            } else {
                $value = $sqlValue;
            }
        }
        return $value;
    }

    private function runUpdate(string $updates, string $condition, array $updatedLines = []): void {
        Table::DbQuery("UPDATE `{$this->tableName}` SET $updates WHERE $condition");
        $this->emitDbUpdate('UPDATE', $updatedLines);
    }

    /**
     * @param ItemField[] $fields
     * @param array<int, array<string, mixed>> $rows
     * @return array<int|string, array<string, mixed>>
     */
    private function buildInsertedDbUpdateLines(array $fields, array $rows): array {
        $idField = array_find($fields, fn($field) => $field->kind === ItemFieldKind::ID);
        $insertedLines = [];

        if ($idField === null) {
            return $insertedLines;
        }

        $firstInsertedId = $idField->type === 'int' ? Table::DbGetLastId() : 0;

        foreach ($rows as $index => $row) {
            $insertedLine = [];
            foreach ($fields as $field) {
                if (!array_key_exists($field->name, $row)) {
                    continue;
                }

                $insertedLine[$field->dbField] = $row[$field->name];
            }

            $idValue = $rows[$index][$idField->name] ?? null;
            if ($idValue === null) {
                if ($firstInsertedId <= 0) {
                    continue;
                }
                $idValue = $firstInsertedId + $index;
            }

            $insertedLines[$idValue] = [$idField->dbField => $idValue] + array_diff_key($insertedLine, [$idField->dbField => true]);
        }

        return $insertedLines;
    }

    /**
     * @param ItemField[] $fields
     * @param array<int|string, array<string, mixed>> $rows
     * @return array<int|string, array<string, mixed>>
     */
    private function buildDbUpdateLines(array $fields, array $rows, ?ItemField $matchField = null): array {
        $updatedLines = [];

        foreach ($rows as $matchValue => $fieldValues) {
            $updatedLine = [];
            foreach ($fields as $field) {
                if ($matchField !== null && $field->dbField === $matchField->dbField) {
                    continue;
                }

                if (!array_key_exists($field->name, $fieldValues)) {
                    continue;
                }

                $updatedLine[$field->dbField] = $fieldValues[$field->name];
            }

            if (count($updatedLine) > 0) {
                $updatedLines[$matchValue] = $updatedLine;
            }
        }

        return $updatedLines;
    }

    private function emitDbUpdate(string $operation, array $updatedLines): void {
        if ($this->dbUpdateCallback === null || count($updatedLines) === 0) {
            return;
        }

        ($this->dbUpdateCallback)($this->tableName, $updatedLines, $operation);
    }
}
