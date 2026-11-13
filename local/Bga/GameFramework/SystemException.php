<?php
declare(strict_types=1);

namespace Bga\GameFramework;

/**
 * Exception not visible to the players, added to the production logs (unexpected errors). Should not be translated.
 */
class SystemException extends GameException
{
    /**
     * @param string|NotificationMessage $message Error message (not translated) with optional arguments.
     */
    public function __construct(string|NotificationMessage $message)
    {
        parent::__construct($message, false, false);
    }
}
