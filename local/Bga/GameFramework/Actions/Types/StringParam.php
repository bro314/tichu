<?php
declare(strict_types=1);

namespace Bga\GameFramework\Actions\Types;

#[\Attribute]
class StringParam extends ActionType {
    public function __construct(
        ?string $name = null,
        public ?bool $alphanum = false, 
        public ?bool $alphanum_dash = false, 
        public ?bool $base64 = false, 
        public ?array $enum = null,
    ) {
        parent::__construct($name);
    }

    public function getValue(string $paramName): string {
        $rawValue = $this->getRawValue($paramName);
        
        $value = (string)$rawValue;

        if ($value !== null && $this->alphanum && preg_match( "/^[0-9a-zA-Z_ ]*$/", $value ) !== 1 ) {
            throw new \BadMethodCallException("$paramName should be alphanum");
        }
        if ($value !== null && $this->alphanum_dash && preg_match( "/^[0-9a-zA-Z_\- ]*$/", $value ) !== 1 ) {
            throw new \BadMethodCallException("$paramName should be alphanum and dash");
        }
        if ($value !== null && $this->base64 && preg_match( "/^[0-9a-zA-Z_\-\=\/\+]*$/", $value ) !== 1 ) {
            throw new \BadMethodCallException("$paramName should be base64");
        }

        if ($this->enum !== null && !in_array($value, $this->enum)) {
            throw new \BadMethodCallException("$paramName should be one of: ".implode(', ', $this->enum));
        }

        return $value;
    }
}