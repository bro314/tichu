<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components\Counters;

use Bga\GameFramework\NotificationMessage;
use Bga\GameFramework\SystemException;

/**
 * Represents a player counter that is stored in DB, one value for each player. For example, the money the player have.
 * 
 * ⚠️ this class use $db and not game classes to bypass the `bga_` check.
 */
final class PlayerCounter {
    /**
     * Store if we initialized the `bga_player_counters` table, to avoid checking existence on each PlayerCounter->initDb.
     */
    private static ?bool $tableExists = null;

    /**
     * The values of the counter, to optimize in case of multiple reads, as an associative array $playerId => $value.
     */
    private ?array $cachedValues = null;

    /** @var CounterVisibility|(callable(): CounterVisibility) */
    private mixed $visibility;

    /**
     * Instanciate the counter. Should only be used through by Table::createPlayerCounter.
     * 
     * @param Table $game the Game class
     * @param string $name the name of the counter. Set to 'player_score' / 'player_score_aux' to update the values used by the framework for the scoring.
     * @param ?int $min the minimal value, default 0.
     * @param ?int $max the maximal value, default unset (null).
     * @param CounterVisibility|(callable(): CounterVisibility) $visibility the value or a callback evaluated when visibility is checked
     * @param bool $useNo use player no instead of player id
     * @param bool $strict set if the player no or id passed as a function param should be validated
     */
    public function __construct(
        private \Bga\GameFramework\Table $game, 
        private string $name, 
        private ?int $min = 0, 
        private ?int $max = null, 
        CounterVisibility|callable $visibility = CounterVisibility::VISIBLE,
        private bool $useNo = false,
        private ?bool $strict = null,
    ) {
        $this->visibility = $visibility;
    }

    /**
     * Returns if the counter name is a special field the should be managed in the player table.
     */
    private function isPlayerTableField(): bool {
        return in_array($this->name, ['player_score', 'player_score_aux']);
    }

    /**
     * Returns the table name to use, so we update the correct table if are in a special field.
     */
    private function getTable(): string {
        return $this->isPlayerTableField() ? 'player' : 'bga_player_counters';
    }

    private function getVisibility(): CounterVisibility {
        return is_callable($this->visibility) ? ($this->visibility)() : $this->visibility;
    }

    /**
     * Return if the counter is visible by anyone.
     * 
     * 📖 documented function.
     */
    public function isVisible(): bool {
        return $this->getVisibility() === CounterVisibility::VISIBLE;
    }

    /**
     * Return if the counter is invisible.
     * 
     * 📖 documented function.
     */
    public function isHidden(): bool {
        return $this->getVisibility() === CounterVisibility::HIDDEN;
    }

    /**
     * Return if the counter is visible by the current player only.
     * 
     * 📖 documented function.
     */
    public function isSelf(): bool {
        return $this->getVisibility() === CounterVisibility::SELF;
    }

    /**
     * Set the counter visibility.
     *
     * @param CounterVisibility|(callable(): CounterVisibility) $visibility the value or a callback evaluated when visibility is checked
     * 
     * 📖 documented function.
     */
    public function setVisibility(CounterVisibility|callable $visibility): void {
        $this->visibility = $visibility;
    }

    /**
     * Tell if the counter input will be player no (true) or player id (false)
     * 
     * 📖 documented function.
     */
    public function setUseNo(bool $useNo): void {
        $this->useNo = $useNo;
    }

    /**
     * Tell if the counter use player no instead of player id
     */
    public function isUseNo(): bool {
        return $this->useNo;
    }


    /**
     * Tell if the counter input will be validated. If true, the counter will trigger an exception if the no or id doesn't exist in the game.
     * 
     * 📖 documented function.
     */
    public function setStrict(bool $strict): void {
        $this->strict = $strict;
    }

    public function isStrict(): bool {
        if ($this->strict === null) {
            return $this->useNo; // strict by default for 'no', but not for 'id' for backward compatibility
        }
        return $this->strict;
    }

    /**
     * Initialize the DB elements. Must be called during game `setupNewGame`.
     * 
     * 📖 documented function.
     * 
     * @param array $playerIdsOrNos the player ids (or player no if you set useNo: true)
     * @param int $initialValue, if different than 0
     */
    public function initDb(array $playerIdsOrNos, int $initialValue = 0): void {
        global $bgaContainer;

        if ($this->isPlayerTableField()) {
            if ($initialValue !== 0) {
                $this->setAll($initialValue, null);
            }
            return;
        }

        $playerIds = array_map(fn($playerIdOrNo) => $this->getPlayerId($playerIdOrNo), $playerIdsOrNos);

        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);

        if (self::$tableExists === null) {
            self::$tableExists = (bool)$db->getUniqueValue("SHOW TABLES LIKE 'bga_player_counters'");
        }
        if (!self::$tableExists) {
            $sql = <<<SQL
                CREATE TABLE IF NOT EXISTS `bga_player_counters` (
                    `player_id` int(11) unsigned NOT NULL,
                    PRIMARY KEY (`player_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1;
            SQL;
            $db->query($sql);

            if (count($playerIds) > 0) {
                $db->query(
                    sprintf(
                        "INSERT INTO `bga_player_counters` (`player_id`) VALUES %s",
                        implode(",", array_map(fn($playerId) => "($playerId)", $playerIds))
                    )
                );
            }

            self::$tableExists = true;
        }

        $db->query("ALTER TABLE `bga_player_counters` ADD `{$this->name}` INT NOT NULL DEFAULT {$initialValue}");
        $this->cachedValues = [];
        foreach ($playerIds as $playerId) {
            $this->cachedValues[$playerId] = $initialValue;
        }
    }

    /**
     * Returns the current value of the counter.
     * 
     * 📖 documented function.
     * 
     * @param int $playerIdOrNo the player id (or no if useNo: true)
     * @return int the value
     * @throws UnknownPlayerException if $playerId is not in the player ids initialized by initDb
     */
    public function get(int $playerIdOrNo): int {
        $playerId = $this->getPlayerId($playerIdOrNo);
        $values = $this->getAllWithIdKey();
        if (!array_key_exists($playerId, $values)) {
            throw new UnknownPlayerException("The player {$playerId} is not initialized for player counter {$this->name}");
        }
        return $values[$playerId];
    }

    /**
     * Set the value of the counter, and send a notif to update the value on the front side.
     * 
     * 📖 documented function.
     * 
     * @param int $playerIdOrNo the player id (or no if useNo: true)
     * @param int $value the new value
     * @param ?NotificationMessage $message the notif to send to the front, with a message and optional args. Empty message for no log, null for no notif at all (the front will not be updated).
     * @return int the new value
     * @throws OutOfRangeCounterException if the value is outside the min/max
     * @throws UnknownPlayerException if $playerId is not in the player ids initialized by initDb
     */
    public function set(int $playerIdOrNo, int $value, ?NotificationMessage $message = new NotificationMessage()): int {
        global $bgaContainer;
        
        if ($this->min !== null && $value < $this->min) {
            throw new OutOfRangeCounterException("The counter value cannot be under {$this->min} (player counter: {$this->name}, value: {$value}, min: {$this->min})");
        }
        if ($this->max !== null && $value > $this->max) {
            throw new OutOfRangeCounterException("The counter value cannot be over {$this->max} (player counter: {$this->name}, value: {$value}, max: {$this->max})");
        }

        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);

        $before = $this->get($playerIdOrNo);

        $playerId = $this->getPlayerId($playerIdOrNo);

        $db->query("UPDATE `{$this->getTable()}` SET `{$this->name}` = $value WHERE `player_id` = $playerId");
        $this->cachedValues[$playerId] = $value;

        if ($message !== null) {
            $inc = $value - $before;
            $notifArgs = [
                'playerId' => $playerId,
                'name' => $this->name,
            ];

            if (str_contains($message->message, '${player_name}')) {
                $notifArgs['player_name'] = $this->game->getPlayerNameById($playerId);
            }

            if ($this->isVisible()) {
                $notifArgs['value'] = $value;
                $notifArgs['oldValue'] = $before;
                $notifArgs['inc'] = $inc;
                $notifArgs['absInc'] = abs($inc);
            } else if ($this->isSelf()) {
                $notifArgs['_private'][$playerId] = [
                    'value' => $value,
                    'oldValue' => $before,
                    'inc' => $inc, 
                    'absInc' => abs($inc),
                ];
                $notifArgs['_merge_private'] = true;
            }

            $args = [
                ...$notifArgs,
                ...$message->args,
            ];
                
            $this->game->notify->all('setPlayerCounter', $message->message, $args);
        }

        return $value;
    }

    /**
     * Increment the value of the counter, and send a notif to update the value on the front side.
     * 
     * Note: if the inc is 0, no notif will be sent.
     * 
     * 📖 documented function.
     * 
     * @param int $playerIdOrNo the player id (or no if useNo: true)
     * @param int $inc the value to add to the current value
     * @param ?NotificationMessage $message the notif to send to the front, with a message and optional args. Empty message for no log, null for no notif at all (the front will not be updated).
     * @return int the new value
     * @throws OutOfRangeCounterException if the value is outside the min/max
     * @throws UnknownPlayerException if $playerId is not in the player ids initialized by initDb
     */
    public function inc(int $playerIdOrNo, int $inc, ?NotificationMessage $message = new NotificationMessage()): int {
        $before = $this->get($playerIdOrNo);
        if ($inc === 0) {
            // no change, no need to notif
            return $before;
        }
        
        return $this->set($playerIdOrNo, $before + $inc, $message);
    }

    /**
     * Return the lowest value.
     * 
     * 📖 documented function.
     * 
     * @return int the lowest value
     */
    public function getMin(): int {
        return min($this->getAllWithIdKey());
    }

    /**
     * Return the highest value.
     * 
     * 📖 documented function.
     * 
     * @return int the highest value
     */
    public function getMax(): int {
        return max($this->getAllWithIdKey());
    }
    
    /**
     * Return the values for each player, as an associative array $playerId => $value.
     * 
     * @return array<int, int> the values
     */
    public function getAllWithIdKey(): array {
        global $bgaContainer;
        if ($this->cachedValues === null) {
            /** @var \Bga\GameFramework\Old\Db */
            $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
            $values = $db->getCollection("SELECT `player_id`, `{$this->name}` FROM `{$this->getTable()}`", true);
            $this->cachedValues = array_map(fn($val) => (int)$val, $values);
        }
        return $this->cachedValues;
    }
    
    /**
     * Return the values for each player, as an associative array ($playerId or $playerNo) => $value.
     * 
     * 📖 documented function.
     * 
     * @return array<int, int> the values
     */
    public function getAll(): array {
        $values = $this->getAllWithIdKey();
        if ($this->useNo) {
            $valuesWithNo = [];
            foreach ($values as $playerId => $value) {
                $valuesWithNo[(int)$this->game->getPlayerNoById($playerId)] = $value;
            }
            return $valuesWithNo;
        }
        return $values;
    }

    /**
     * Set the value of the counter for all the players, and send a notif to update the value on the front side.
     * 
     * This function is not compatible with visibility SELF.
     * 
     * 📖 documented function.
     * 
     * @param int $value the new value
     * @param ?NotificationMessage $message the notif to send to the front, with a message and optional args. Empty message for no log, null for no notif at all (the front will not be updated).
     * @return int the new value
     * @throws OutOfRangeCounterException if the value is outside the min/max
     */
    public function setAll(int $value, ?NotificationMessage $message = new NotificationMessage()): int {
        global $bgaContainer;

        if ($this->min !== null && $value < $this->min) {
            throw new \OutOfRangeCounterException("The counter value cannot be under {$this->min} (player counter: {$this->name}, value: {$value}, min: {$this->min})");
        }
        if ($this->max !== null && $value > $this->max) {
            throw new \OutOfRangeCounterException("The counter value cannot be over {$this->max} (player counter: {$this->name}, value: {$value}, max: {$this->max})");
        }

        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
        $db->query("UPDATE `{$this->getTable()}` SET `{$this->name}` = $value");
        if ($this->cachedValues !== null) {
            foreach ($this->cachedValues as $playerId => $oldValue) {
                $this->cachedValues[$playerId] = $value;
            }
        }

        if ($message !== null) {
            $args = [
                'name' => $this->name,
                'value' => $value,
                ...$message->args,
            ];
                
            $this->game->notify->all('setPlayerCounterAll', $message->message, $args);
        }

        return $value;
    }

    /**
     * Updates the result object, to be used in the `getAllDatas` function.
     * Will set the value on each $result["players"] sub-array.
     * 
     * 📖 documented function.
     * 
     * @param array $result the object to update.
     * @param ?string $fieldName the field name to set in $result["players"], if different than the counter name.
     * @param ?int $currentPlayerId the current player id, needed if the counter has self visibility
     */
    public function fillResult(array &$result, ?string $fieldName = null, ?int $currentPlayerId = null) {
        if ($this->isSelf() && $currentPlayerId === null) {
            throw new SystemException('Impossible to fill the result with visibility SELF and no current playerId');
        }

        $values = $this->getAllWithIdKey();

        foreach ($result["players"] as $playerId => &$player) {
            $value = $values[$playerId];
            if ($this->isHidden() || ($this->isSelf() && $playerId !== $currentPlayerId)) {
                $value = null;
            }
            $player[$fieldName ?? $this->name] = $value;
        }
    }

    /**
     * Transforms a player no or id to a player id, depending on $this->useNo.
     * Do the strict checks if they are active.
     */
    private function getPlayerId(int $playerIdOrNo): int {
        $playerId = $this->useNo ? (int)$this->game->getPlayerIdByNo($playerIdOrNo) : $playerIdOrNo;
        if ($this->isStrict() && !array_key_exists($playerId, $this->game->loadPlayersBasicInfos())) {
            throw new UnknownPlayerException("Player ".($this->useNo ? "no" : "id")." $playerIdOrNo does not exist at the table (player counter: {$this->name})");
        }
        return $playerId;
    }
}
