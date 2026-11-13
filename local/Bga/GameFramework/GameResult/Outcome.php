<?php
declare(strict_types=1);

namespace Bga\GameFramework\GameResult;

enum Outcome: string
{
    CASE NORMAL = 'normal';
    case WIN = 'win'; // deprecated, to remove
    case LOSS = 'loss'; // deprecated, to remove
    case CONCEDE = 'concede';
    case NEUTRALIZED = 'neutralized';
    case ABANDON = 'abandon';
}