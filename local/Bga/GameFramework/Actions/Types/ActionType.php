<?php
declare(strict_types=1);

namespace Bga\GameFramework\Actions\Types;

abstract class ActionType {
    private static $rawValueResolver = null;

    public function __construct(public ?string $name = null) {}

    public function getRawValue(string $paramName) {
        if (self::$rawValueResolver !== null) {
            return call_user_func(self::$rawValueResolver, $paramName);
        }
        return $_REQUEST[$paramName];
    }

    public static function setRawValueResolver(?callable $rawValueResolver): void
    {
        self::$rawValueResolver = $rawValueResolver;
    }

    public abstract function getValue(string $paramName);
}
