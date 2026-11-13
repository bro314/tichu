<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components\Counters;

enum CounterVisibility: string
{
    CASE VISIBLE = 'visible';
    CASE SELF = 'self';
    case HIDDEN = 'hidden';
}
