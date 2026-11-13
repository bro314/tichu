<?php
declare(strict_types=1);

namespace Bga\GameFramework\Actions\Types;

#[\Attribute]
class FloatParam extends ActionType {
    public function __construct(
        ?string $name = null,
        public ?float $min = null, 
        public ?float $max = null,
    ) {
        parent::__construct($name);
    }

    public function getValue(string $paramName): float {
        $rawValue = $this->getRawValue($paramName);

        if (!is_numeric($rawValue)) {
            throw new \BadMethodCallException("$paramName should be a float"); 
        }
        
        $value = (float)$rawValue;

        if ($value !== null && $this->min !== null && $value < $this->min) {
            throw new \BadMethodCallException("$paramName should be >= $this->min");
        }
        if ($value !== null && $this->max !== null && $value > $this->max) {
            throw new \BadMethodCallException("$paramName should be <= $this->max");
        }

        return $value;
    }
}