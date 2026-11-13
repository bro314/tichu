<?php
declare(strict_types=1);

namespace Bga\GameFramework\Helpers;

final class Json {
    private function __construct() {}

    /**
     * When an associative array is encoded then decoded from json, it is transformed as an object.
     * We add a flag to mark it as an associative array so we can fix the type after decoding. Recursive for multi-level cases.
     */
    private static function setAssociativeArrayFlag(mixed &$value): void {
        if (is_array($value)) {
            foreach ($value as $arrKey => &$arrValue) {
                self::setAssociativeArrayFlag($arrValue);
            }

            if (!array_is_list($value)) {
                $value['___bga_associative_array_flag'] = true;
            }
        } else if (is_object($value)) {
            foreach ($value as $arrKey => &$arrValue) {
                self::setAssociativeArrayFlag($arrValue);
            }
        }
    }

    /**
     * When an associative array is encoded then decoded from json, it is transformed as an object.
     * We change the object to array if the flag is present, and when remove the flag. Recursive for multi-level cases.
     */
    private static function applyAssociativeArrayFlag(mixed &$value): void {
        if (is_array($value)) {
            foreach ($value as $arrKey => &$arrValue) {
                self::applyAssociativeArrayFlag($arrValue);
            }
        } else if (is_object($value)) {
            foreach ($value as $arrKey => &$arrValue) {
                self::applyAssociativeArrayFlag($arrValue);
            }

            if (property_exists($value, '___bga_associative_array_flag')) {
                $value = (array)$value;
                unset($value['___bga_associative_array_flag']);
            }
        }
    }

    /**
     * Transforms an object to JSON. Adds a special flag to remember associative arrays.
     */
    private static function objectToJson(mixed $obj): string {
        self::setAssociativeArrayFlag($obj);
        return json_encode($obj);
    }

    /**
     * Transforms a JSON to an object. If a special flag is detected, transforms the object to an associative array.
     */
    private static function jsonToObject(string $json_obj): mixed {
        $object = json_decode($json_obj);
        self::applyAssociativeArrayFlag($object);
        return $object;
    }

    /**
     * Map the fields of an stdClass to an Object based on requested class.
     */
    private static function getObjectPropertyValue(string $class, string $property, mixed $value): mixed {
        if ($value instanceof \stdClass) {
            $reflectionProperty = new \ReflectionProperty($class, $property);
            $propertyClass = null;
            $type = $reflectionProperty->getType();
            if (!$type->isBuiltin() && $type instanceof \ReflectionNamedType) {
                $propertyClass = $type->getName();
            }

            if ($propertyClass !== null) {
                return self::getObject($value, $propertyClass);
            }
        }
        
        return $value;
    }

    /**
     * Map the fields of an stdClass to an Object based on requested class.
     */
    private static function getObject(Object $stdClass, string $class): Object {
        $stdClassValues = get_object_vars($stdClass);
        $reflection = new \ReflectionClass($class);
        $mandatoryConstructorParams = [];
        $constructor = $reflection->getConstructor();
        if ($constructor !== null) {
            foreach ($constructor->getParameters() as $parameter) {
                if ($parameter->isOptional()) {
                    continue;
                }
                $mandatoryConstructorParams[] = $parameter->getName();
            }
        }
        $mandatoryConstructorValues = array_map(fn($property) => self::getObjectPropertyValue($class, $property, $stdClassValues[$property]), $mandatoryConstructorParams);

        $object = new $class(...$mandatoryConstructorValues);

        foreach ($stdClassValues as $property => $value) {
            if (property_exists($object, $property)) {
                $object->$property = self::getObjectPropertyValue($class, $property, $value);
            }
        }

        return $object;
    }

    /**
     * Decode an object stored in JSON. Will return associative arrays as such.
     * 
     * @param $class the class to map the object into
     */
    public static function decode(string $json_obj, ?string $class = null): mixed {
        $stdClass = self::jsonToObject($json_obj);
        if ($class === null || gettype($stdClass) !== 'object') {
            return $stdClass;
        }
        
        return self::getObject($stdClass, $class);        
    }

    /**
     * Encode an object to JSON. Will add a flag to mark associative arrays so `decode` can return them as expected.
     */
    public static function encode(mixed $obj): string {
        return self::objectToJson($obj);
    }
}
