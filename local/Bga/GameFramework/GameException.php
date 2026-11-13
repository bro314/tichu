<?php
declare(strict_types=1);

namespace Bga\GameFramework;

/**
 * Base exception shared by exceptions triggered by games.
 */
abstract class GameException extends \Exception
{
    /**
     * Parameters to format the message.
     *
     * @var array<string, mixed>|null
     */
    public ?array $args = null;

    /**
     * @param string|NotificationMessage $message    Raw message or notification message (with args).
     * @param bool                       $expected   if the exception is expected, we don't log them.
     * @param bool                       $visibility if the exception message should be visible to players.
     */
    public function __construct(string|NotificationMessage $message, public bool $expected = false, private bool $visibility = true)
    {
        parent::__construct($message instanceof NotificationMessage ? $message->message : $message, FEX_NOCODE);
        if ($message instanceof NotificationMessage) {
            $this->args = $message->args;
        }
    }

    public function isPublic(): bool
    {
        return $this->visibility;
    }

    public function isExpected(): bool
    {
        return $this->expected;
    }

    /**
     * Only to stay compatible with catch that also handles feException
     */
    public function getPublicMsg(): string
    {
        return '';
    }
}
