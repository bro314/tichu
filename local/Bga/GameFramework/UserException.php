<?php
declare(strict_types=1);

namespace Bga\GameFramework;

/**
 * Exception visible to the players, not added to the production logs (expected errors). Should be translated.
 */
class UserException extends GameException
{
    /**
     * @param string|NotificationMessage $message Error message to be surrounded by `clienttranslate`, with optional arguments.
     */
    public function __construct(string|NotificationMessage $message)
    {
        parent::__construct($message, true, true);
    }
}
