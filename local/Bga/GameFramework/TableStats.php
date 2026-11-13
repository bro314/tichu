<?php
declare(strict_types=1);

namespace Bga\GameFramework;

final class TableStats extends Stats {

    /**
     * @param Table $game The Game class.
     */
    function __construct(Table $game) {
        parent::__construct($game);
    }

    /**
     * Create a statistic entry with a default value.
     *
     * 📖 documented function.
     *
     * @param string|array $nameOrNames Statistic identifier(s) defined in `stats.json`.
     * @param int|float|bool $value Default value to register.
     */
    public function init(string|array $nameOrNames, int|float|bool $value): void {
        $this->setInitStatValue('table', $nameOrNames, $value);
    }

    /**
     * Update a table statistic to the provided value.
     *
     * 📖 documented function.
     *
     * @param string $name Statistic identifier defined in `stats.json`.
     * @param int|float|bool $value Value to persist.
     */
    public function set(string $name, int|float|bool $value): void {
        $this->game->setStat($value, $name);
    }

    /**
     * Increment a table statistic by the given delta.
     *
     * 📖 documented function.
     *
     * @param string $name Statistic identifier defined in `stats.json`.
     * @param int|float $delta Signed difference to apply.
     */
    public function inc(string $name, int|float $delta): void {
        $statType = $this->getStatType('table', $name)['type'];
        if ($statType === 'bool') {
            throw new SystemException('Impossible to increment boolean values');
        }
        $this->game->incStat($delta, $name);
    }

    /**
     * Fetch a table statistic.
     *
     * 📖 documented function.
     *
     * @param string $name Statistic identifier defined in `stats.json`.
     *
     * @return int|float|bool The statistic value.
     */
    public function get(string $name): int|float|bool {
        return $this->getTypedValue('table', $name, $this->game->getStat($name));
    }
}
