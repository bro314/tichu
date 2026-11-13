<?php

declare(strict_types=1);

namespace Bga\GameFramework\Components\ItemManager;

enum ItemFieldKind: string
{
    case ID = 'id';
    case LOCATION = 'location';
    case ORDER = 'order';
}
