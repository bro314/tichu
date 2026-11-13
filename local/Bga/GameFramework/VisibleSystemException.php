<?php
declare(strict_types=1);

namespace Bga\GameFramework;

/**
 * Exception visible to the players, added to the production logs (unexpected errors). Only to help the game dev have more information on a complex bug.
 */
class VisibleSystemException extends GameException
{
    /**
     * @param string|NotificationMessage $message Error message (not translated) with optional arguments.
     */
    public function __construct(string|NotificationMessage $message)
    {
        parent::__construct($message, false, true);
    }
}
