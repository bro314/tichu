<?php
declare(strict_types=1);

namespace Bga\GameFramework\Actions\Types;

#[\Attribute]
class IntArrayParam extends ActionType {
    public function __construct(
        ?string $name = null,
        public ?int $min = null, 
        public ?int $max = null,
    ) {
        parent::__construct($name);
    }

    public function getValue(string $paramName): array {
        $rawValue = $this->getRawValue($paramName);
        
        // accept both $_REQUEST['paramName'] as comma/semi-colon separated string  and $_REQUEST['paramName[]'] as array
        $rawArray = gettype($rawValue) === 'array' ? $rawValue : preg_split('[,|;]', $rawValue);

        // filter any non-numeric values, and convert values as int
        $value = array_map(fn($valueAsString) => intval($valueAsString), array_values(array_filter($rawArray, fn($raw) => is_numeric($raw))));

        if ($value !== null && $this->min !== null && count($value) < $this->min) {
            throw new \BadMethodCallException("$paramName length should be >= $this->min");
        }
        if ($value !== null && $this->max !== null && count($value) > $this->max) {
            throw new \BadMethodCallException("$paramName length should be <= $this->max");
        }

        return $value;
    }
}