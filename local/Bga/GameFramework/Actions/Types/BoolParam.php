<?php
declare(strict_types=1);

namespace Bga\GameFramework\Actions\Types;

#[\Attribute]
class BoolParam extends ActionType {
    public function __construct(
        ?string $name = null,
    ) {
        parent::__construct($name);
    }

    public function getValue(string $paramName): bool {
        $rawValue = $this->getRawValue($paramName);
        
        $value = $rawValue !== 0 && $rawValue!== 'false' && $rawValue !== '0' && $rawValue !== false;

        return $value;
    }
}