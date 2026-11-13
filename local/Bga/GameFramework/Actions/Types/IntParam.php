<?php
declare(strict_types=1);

namespace Bga\GameFramework\Actions\Types;

#[\Attribute]
class IntParam extends ActionType {
    public function __construct(
        ?string $name = null,
        public ?int $min = null, 
        public ?int $max = null,
    ) {
        parent::__construct($name);
    }

    public function getValue(string $paramName): int {
        $rawValue = $this->getRawValue($paramName);

        if (!is_numeric($rawValue)) {
            throw new \BadMethodCallException("$paramName should be an integer"); 
        }
        
        $value = (int)$rawValue;

        if ($value !== null && $this->min !== null && $value < $this->min) {
            throw new \BadMethodCallException("$paramName should be >= $this->min");
        }
        if ($value !== null && $this->max !== null && $value > $this->max) {
            throw new \BadMethodCallException("$paramName should be <= $this->max");
        }

        return $value;
    }
}