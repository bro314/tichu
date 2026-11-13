<?php
declare(strict_types=1);

namespace Bga\GameFramework\Actions;

#[\Attribute]
class Debug {
    public function __construct(
        public bool $reload = false,
    ) {}
}