<?php
declare(strict_types=1);

namespace Bga\GameFramework;

class NotificationMessage {

    public function __construct(
        public string $message = '',
        public array $args = [],
    ) {}
}
