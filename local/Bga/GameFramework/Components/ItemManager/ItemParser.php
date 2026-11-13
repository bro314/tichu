<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components\ItemManager;

/**
 * Reads item attributes and validates that the item class can be managed safely.
 *
 * @template T of object
 */
class ItemParser {
    private const SUPPORTED_FIELD_TYPES = ['bool', 'int', 'float', 'double', 'string', 'json'];
    private const RESERVED_FIELD_SIGNATURES = [
        ItemFieldKind::ID->value => ['phpType' => ['int'], 'nullable' => false, 'fieldType' => ['int']],
        ItemFieldKind::ORDER->value => ['phpType' => ['int'], 'nullable' => false, 'fieldType' => ['int']],
    ];
    /** @var array<string, class-string> */
    private static array $registeredTableNames = [];

    private string $tableName;

    /**
     * @var ItemField[]
     */
    private array $fields = [];

    /**
     * @param class-string<T> $className
     */
    public function __construct(private string $className) {
        $this->readTableName();
        $this->registerTableName();
        $this->readFields();
        $this->validateMandatoryFields();
    }

    public function getTableName(): string {
        return $this->tableName;
    }

    /**
     * @return ItemField[]
     */
    public function getFields(): array {
        return $this->fields;
    }

    private function registerTableName(): void {
        $existingClassName = self::$registeredTableNames[$this->tableName] ?? null;
        if ($existingClassName !== null) {
            throw new ItemManagerConfigurationException("An ItemManager for table '{$this->tableName}' is already registered by {$existingClassName}; cannot register {$this->className}");
        }

        self::$registeredTableNames[$this->tableName] = $this->className;
    }

    private function validateMandatoryFields(): void {
        foreach ([ItemFieldKind::ID, ItemFieldKind::LOCATION, ItemFieldKind::ORDER] as $mandatoryKind) {
            if (!array_find($this->fields, fn($field) => $field->kind === $mandatoryKind)) {
                throw new ItemManagerConfigurationException("A mandatory #[ItemField(kind: {$mandatoryKind->value})] attribute is missing on a {$this->className} field");
            }
        }
    }

    /**
     * Read the DB table name with #[Item]
     */
    private function readTableName(): void {
        $reflectionClass = new \ReflectionClass($this->className);
        $attributes = $reflectionClass->getAttributes(Item::class);
        if (empty($attributes)) {
            throw new ItemManagerConfigurationException("#[Item] attribute is not set on {$this->className}");
        }
        
        $attributeInstance = $attributes[0]->newInstance();

        if (empty($attributeInstance->tableName)) {
            $this->tableName = $reflectionClass->getShortName();
        } else {
            $this->tableName = $attributeInstance->tableName;
        }
    }

    /**
     * Read the fields of the item with #[ItemField]
     */
    private function readFields(): void {
        $reflectionClass = new \ReflectionClass($this->className);
        $seenKinds = [];
        $seenDbFields = [];

        foreach ($reflectionClass->getProperties() as $property) {
            $attributes = $property->getAttributes(ItemField::class);
            if (empty($attributes)) {
                continue;
            }

            $attributeInstance = $attributes[0]->newInstance();
            $attributeInstance->name = $property->getName();
            $typeInfo = $this->getPropertyTypeInfo($property);

            if (empty($attributeInstance->dbField)) {
                $attributeInstance->dbField = $attributeInstance->name;
            }

            if (isset($seenDbFields[$attributeInstance->dbField])) {
                throw new ItemManagerConfigurationException("Duplicate DB column '{$attributeInstance->dbField}' on {$this->className}::\${$attributeInstance->name}; already used by \${$seenDbFields[$attributeInstance->dbField]}");
            }
            $seenDbFields[$attributeInstance->dbField] = $attributeInstance->name;

            if ($attributeInstance->kind !== null) {
                $kindValue = $attributeInstance->kind->value;
                $seenKindKey = $kindValue;
                if ($attributeInstance->kind === ItemFieldKind::LOCATION) {
                    $seenKindKey .= ":{$attributeInstance->locationIndex}";
                }

                if (isset($seenKinds[$seenKindKey])) {
                    $duplicateDescription = $attributeInstance->kind === ItemFieldKind::LOCATION
                        ? "Duplicate #[ItemField(kind: '{$kindValue}', locationIndex: {$attributeInstance->locationIndex})]"
                        : "Duplicate #[ItemField(kind: '{$kindValue}')]";
                    throw new ItemManagerConfigurationException("{$duplicateDescription} on {$this->className}::\${$attributeInstance->name}; already used by \${$seenKinds[$seenKindKey]}");
                }
                $seenKinds[$seenKindKey] = $attributeInstance->name;
            }

            $this->configureFieldType($attributeInstance, $property, $typeInfo);
            $this->validateReservedFieldSignature($attributeInstance, $typeInfo);
            $this->fields[] = $attributeInstance;
        }

        $this->validateLocationIndexes();
    }

    private function validateLocationIndexes(): void {
        $locationIndexes = array_map(
            fn(ItemField $field) => $field->locationIndex,
            array_filter($this->fields, fn(ItemField $field) => $field->kind === ItemFieldKind::LOCATION)
        );

        sort($locationIndexes);
        $expectedIndexes = count($locationIndexes) === 0
            ? []
            : range(0, count($locationIndexes) - 1);

        if ($locationIndexes !== $expectedIndexes) {
            throw new ItemManagerConfigurationException("LOCATION ItemField attributes on {$this->className} must form a 0-indexed contiguous list of locationIndex values; got [".implode(', ', $locationIndexes)."]");
        }
    }

    /**
     * @return array{phpType: string|string[], nullable: bool, inferredFieldType: string, class: ?string}
     */
    private function getPropertyTypeInfo(\ReflectionProperty $property): array {
        $type = $property->getType();
        if ($type === null) {
            throw new ItemManagerConfigurationException("{$this->className}::\${$property->getName()} has #[ItemField] but no declared PHP type");
        }

        if ($type instanceof \ReflectionNamedType) {
            return $this->buildPropertyTypeInfo($property, $type->getName(), $type->allowsNull());
        }

        if ($type instanceof \ReflectionUnionType) {
            $nullable = false;
            $namedTypes = [];

            foreach ($type->getTypes() as $unionType) {
                if (!$unionType instanceof \ReflectionNamedType) {
                    throw new ItemManagerConfigurationException("{$this->className}::\${$property->getName()} uses an unsupported complex union type");
                }

                if ($unionType->getName() === 'null') {
                    $nullable = true;
                    continue;
                }

                $namedTypes[] = $unionType->getName();
            }

            sort($namedTypes);
            if ($namedTypes === ['int', 'string']) {
                return [
                    'phpType' => $namedTypes,
                    'nullable' => $nullable,
                    'inferredFieldType' => 'string',
                    'class' => null,
                ];
            }

            if (count($namedTypes) !== 1) {
                throw new ItemManagerConfigurationException("{$this->className}::\${$property->getName()} must use a single PHP type, optionally nullable");
            }

            return $this->buildPropertyTypeInfo($property, $namedTypes[0], $nullable);
        }

        throw new ItemManagerConfigurationException("{$this->className}::\${$property->getName()} uses an unsupported PHP type");
    }

    /**
     * @return array{phpType: string, nullable: bool, inferredFieldType: string, class: ?string}
     */
    private function buildPropertyTypeInfo(\ReflectionProperty $property, string $phpType, bool $nullable): array {
        $fieldType = match ($phpType) {
            'bool', 'int', 'string' => $phpType,
            'float' => 'float',
            'array' => 'json',
            default => null,
        };

        if ($fieldType === null) {
            if ($this->isJsonClassType($phpType)) {
                $fieldType = 'json';
            } else {
                throw new ItemManagerConfigurationException("{$this->className}::\${$property->getName()} uses unsupported PHP type '{$phpType}' for #[ItemField]");
            }
        }

        return [
            'phpType' => $phpType,
            'nullable' => $nullable,
            'inferredFieldType' => $fieldType,
            'class' => $fieldType === 'json' && $phpType !== 'array' ? $phpType : null,
        ];
    }

    private function configureFieldType(ItemField $field, \ReflectionProperty $property, array $typeInfo): void {
        if (empty($field->type)) {
            $field->type = $typeInfo['inferredFieldType'];
        } else if (!in_array($field->type, self::SUPPORTED_FIELD_TYPES, true)) {
            throw new ItemManagerConfigurationException("{$this->className}::\${$property->getName()} declares unsupported ItemField type '{$field->type}'");
        } else if (!$this->isCompatibleFieldType($field->type, $typeInfo['inferredFieldType'])) {
            $phpType = $this->formatPropertyType($typeInfo['phpType'], $typeInfo['nullable']);
            throw new ItemManagerConfigurationException("{$this->className}::\${$property->getName()} declares ItemField type '{$field->type}' but PHP type {$phpType} maps to '{$typeInfo['inferredFieldType']}'");
        }

        if ($field->type === 'json' && $field->class === null) {
            $field->class = $typeInfo['class'];
        }
    }

    private function validateReservedFieldSignature(ItemField $field, array $typeInfo): void {
        if ($field->kind === ItemFieldKind::LOCATION) {
            $this->validateLocationFieldSignature($field, $typeInfo);
            return;
        }

        if ($field->kind === null) {
            return;
        }

        $expected = self::RESERVED_FIELD_SIGNATURES[$field->kind->value];
        $matchesPhpType = in_array($typeInfo['phpType'], $expected['phpType'], true);
        $matchesNullability = $typeInfo['nullable'] === $expected['nullable'];
        $matchesFieldType = in_array($field->type, $expected['fieldType'], true);

        if ($matchesPhpType && $matchesNullability && $matchesFieldType) {
            return;
        }

        $expectedPhpType = $this->formatPropertyType($expected['phpType'], $expected['nullable']);
        $actualPhpType = $this->formatPropertyType($typeInfo['phpType'], $typeInfo['nullable']);

        throw new ItemManagerConfigurationException("{$this->className}::\${$field->name} with kind '{$field->kind->value}' must be declared as {$expectedPhpType} with ItemField type '".implode('|', $expected['fieldType'])."', got {$actualPhpType} / '{$field->type}'");
    }

    private function validateLocationFieldSignature(ItemField $field, array $typeInfo): void {
        $expected = [
            'phpType' => ['int', 'string'],
            'nullable' => $field->locationIndex !== 0,
            'fieldType' => ['int', 'string'],
        ];

        $matchesPhpType = is_array($typeInfo['phpType'])
            ? $typeInfo['phpType'] === ['int', 'string']
            : in_array($typeInfo['phpType'], $expected['phpType'], true);
        $matchesNullability = $typeInfo['nullable'] === $expected['nullable'];
        $matchesFieldType = in_array($field->type, $expected['fieldType'], true);

        if ($matchesPhpType && $matchesNullability && $matchesFieldType) {
            return;
        }

        $expectedPhpType = $this->formatPropertyType($expected['phpType'], $expected['nullable']);
        $actualPhpType = $this->formatPropertyType($typeInfo['phpType'], $typeInfo['nullable']);

        throw new ItemManagerConfigurationException("{$this->className}::\${$field->name} with kind '{$field->kind->value}' and locationIndex {$field->locationIndex} must be declared as {$expectedPhpType} with ItemField type '".implode('|', $expected['fieldType'])."', got {$actualPhpType} / '{$field->type}'");
    }

    private function isCompatibleFieldType(string $declaredFieldType, string $inferredFieldType): bool {
        if ($declaredFieldType === $inferredFieldType) {
            return true;
        }

        return $declaredFieldType === 'double' && $inferredFieldType === 'float';
    }

    private function isJsonClassType(string $phpType): bool {
        return class_exists($phpType) || interface_exists($phpType) || enum_exists($phpType);
    }

    private function formatPropertyType(string|array $phpType, bool $nullable): string {
        $phpTypes = is_array($phpType) ? $phpType : [$phpType];
        if ($nullable) {
            $phpTypes[] = 'null';
        }
        return implode('|', $phpTypes);
    }
}
