<?php
declare(strict_types=1);

namespace Bga\GameFramework\Actions\Types;

use Bga\GameFramework\Helpers\Json;

#[\Attribute]
class JsonParam extends ActionType {
    public function __construct(
        ?string $name = null,
        public ?bool $associative = true,
        public ?bool $alphanum = true, 
        public ?string $class = null,
    ) {
        parent::__construct($name);
    }

    public function getValue(string $paramName): mixed {
        $rawValue = $this->getRawValue($paramName);
        
        $value = $this->associative && !$this->class ? json_decode($rawValue, true) : $this->decodeObjectValue($rawValue);

        if ($value !== null && $this->alphanum && !$this->validateJSonAlphaNum($value)) {
            throw new \BadMethodCallException("$paramName is not a valid JSON");
        }

        return $value;
    }

    private function decodeObjectValue(string $rawValue): mixed {
        $value = Json::decode($rawValue);
        if ($this->class === null) {
            return $value;
        }

        if (is_array($value)) {
            return array_map(
                fn(mixed $item) => $item instanceof \stdClass ? Json::decode(Json::encode($item), $this->class) : $item,
                $value,
            );
        }

        return Json::decode($rawValue, $this->class);
    }

    private function validateJSonAlphaNum(mixed $value): bool {
        if (is_array($value) || is_object($value)) {
            foreach ((array)$value as $key => $v) {
                if (!$this->validateJSonAlphaNum($key) || !$this->validateJSonAlphaNum($v)) {
                    return false;
                }
            }
            return true;
        }
        if (gettype($value) === 'string') {
            return preg_match("/^[_0-9a-zA-Z- ]*$/", $value) === 1;
        }
        return true;
    }

}
