<?php
declare(strict_types=1);

namespace Bga\GameFramework\Components\Counters;

use Bga\GameFramework\NotificationMessage;

/**
 * Represents a game counter that is stored in DB. For example, the number of rounds.
 * 
 * ⚠️ this class use $db and not game classes to bypass the `bga_` check.
 */
final class TableCounter {
    /**
     * Store if we initialized the `bga_table_counters` table, to avoid checking existence on each TableCounter->initDb.
     */
    private static ?bool $tableExists = null;

    /**
     * The value of the counter, to optimize in case of multiple reads.
     */
    private ?int $cachedValue = null;

    /**
     * Instanciate the counter. Should only be used through by Table::createTableCounter.
     * 
     * @param Table $game the Game class
     * @param string $name the name of the counter.
     * @param ?int $min the minimal value, default 0.
     * @param ?int $max the maximal value, default unset (null).
     */
    public function __construct(
        private \Bga\GameFramework\Table $game, 
        private string $name, private 
        ?int $min = 0, 
        private ?int $max = null,
    ) {
    }

    /**
     * Initialize the DB elements. Must be called during game `setupNewGame`.
     * 
     * 📖 documented function.
     * 
     * @param int $initialValue, if different than 0
     */
    public function initDb(int $initialValue = 0) {
        global $bgaContainer;
        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);

        if (self::$tableExists === null) {
            self::$tableExists = (bool)$db->getUniqueValue("SHOW TABLES LIKE 'bga_table_counters'");
        }
        if (!self::$tableExists) {
            $sql = <<<SQL
                CREATE TABLE IF NOT EXISTS `bga_table_counters` (
                    `name` varchar(50) NOT NULL,
                    `value` int(11) NOT NULL,
                    PRIMARY KEY (`name`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1;
            SQL;
            $db->query($sql);

            self::$tableExists = true;
        }

        $db->query("INSERT INTO `bga_table_counters` (`name`, `value`) VALUES  ('{$this->name}', {$initialValue})");
        $this->cachedValue = $initialValue;
    }

    /**
     * Returns the current value of the counter.
     * 
     * 📖 documented function.
     * 
     * @return int the value
     */
    public function get(): int {
        global $bgaContainer;

        if ($this->cachedValue === null) {
            /** @var \Bga\GameFramework\Old\Db */
            $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
            $this->cachedValue = (int)$db->getUniqueValue("SELECT `value` FROM `bga_table_counters` WHERE `name` = '{$this->name}'");
        }
        return $this->cachedValue;
    }

    /**
     * Set the value of the counter, and send a notif to update the value on the front side.
     * 
     * 📖 documented function.
     * 
     * @param int $value the new value
     * @param @param ?NotificationMessage $message the notif to send to the front, with a message and optional args. Empty message for no log, null for no notif at all (the front will not be updated).
     * @return int the new value
     * @throws OutOfRangeCounterException if the value is outside the min/max
     */
    public function set(int $value, ?NotificationMessage $message = new NotificationMessage()): int {

        global $bgaContainer;
        if ($this->min !== null && $value < $this->min) {
            throw new OutOfRangeCounterException("The counter value cannot be under {$this->min} (table counter: {$this->name}, value: {$value}, min: {$this->min})");
        }
        if ($this->max !== null && $value > $this->max) {
            throw new OutOfRangeCounterException("The counter value cannot be over {$this->max} (table counter: {$this->name}, value: {$value}, max: {$this->max})");
        }
        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);

        $before = $this->get();

        $db->query("UPDATE `bga_table_counters` SET `value` = $value WHERE `name` = '{$this->name}'");
        $this->cachedValue = $value;

        if ($message !== null) {
            $inc = $value - $before;
            $args = [
                'name' => $this->name,
                'value' => $value,
                'oldValue' => $before,
                'inc' => $inc, 
                'absInc' => abs($inc),
                ...$message->args,
            ];
                
            $this->game->notify->all('setTableCounter', $message->message, $args);
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
     * @param int $inc the value to add to the current value
     * @param @param ?NotificationMessage $message the notif to send to the front, with a message and optional args. Empty message for no log, null for no notif at all (the front will not be updated).
     * @return int the new value
     * @throws OutOfRangeCounterException if the value is outside the min/max
     */
    public function inc(int $inc, ?NotificationMessage $message = new NotificationMessage()): int {
        $before = $this->get();
        if ($inc === 0) {
            // no change, no need to notif
            return $before;
        }
        return $this->set($before + $inc, $message);
    }

    /**
     * Updates the result object, to be used in the `getAllDatas` function.
     * 
     * 📖 documented function.
     * 
     * @param array $result the object to update.
     * @param ?string $fieldName the field name to set in $result, if different than the counter name.
     */
    public function fillResult(array &$result, ?string $fieldName = null) {
        $value = $this->get();

        $result[$fieldName ?? $this->name] = $value;
    }
}
