<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components\Counters;

use Bga\GameFramework\SystemException;

final class OutOfRangeCounterException extends SystemException
{
    public function __construct(string $message = "")
    {
        parent::__construct($message);
    }
}