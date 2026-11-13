<?php
declare(strict_types=1);

namespace Bga\GameFramework\Actions;

#[\Attribute]
class CheckAction {
    public function __construct(
        public bool $enabled = true,
    ) {}
}