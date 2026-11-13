<?php
declare(strict_types=1);

namespace Bga\GameFramework;

final class PlayerStats extends Stats
{
    private bool $useNo = false;

    /**
     * @param Table $game The Game class.
     */
    function __construct(Table $game)
    {
        parent::__construct($game);
    }

    /**
     * Set whether player arguments use player numbers (true) or player IDs (false).
     *
     * 📖 documented function.
     */
    public function setUseNo(bool $useNo): void
    {
        $this->useNo = $useNo;
    }

    /**
     * Return whether player arguments use player numbers.
     */
    public function isUseNo(): bool
    {
        return $this->useNo;
    }

    /**
     * Create a statistic entry with a default value.
     *
     * 📖 documented function.
     *
     * @param string|array $nameOrNames Statistic identifier(s) defined in `stats.json`.
     * @param int|float|bool $value Default value to register.
     * @param bool $updateTableStat if there is a table stat of the same name to init at the same time (for example, for a turnNumber counter that would store the turns played by each player but also the total of turns for the table)
     */
    public function init(string|array $nameOrNames, int|float|bool $value, bool $updateTableStat = false): void
    {
        $this->setInitStatValue('player', $nameOrNames, $value);
        if ($updateTableStat) {
            $this->setInitStatValue('table', $nameOrNames, $value);
        }
    }

    /**
     * Update a player statistic to the provided value.
     *
     * 📖 documented function.
     *
     * @param string $name Statistic identifier defined in `stats.json`.
     * @param int|float|bool $value Value to persist.
     * @param int $playerIdOrNo Target player ID, or player number when useNo is true.
     */
    public function set(string $name, int|float|bool $value, int $playerIdOrNo): void
    {
        $this->setByPlayerId($name, $value, $this->getPlayerId($playerIdOrNo));
    }

    private function setByPlayerId(string $name, int|float|bool $value, int $playerId): void
    {
        $this->game->setStat($value, $name, $playerId);
    }

    /**
     * Apply the same value to a player statistic for every player.
     *
     * 📖 documented function.
     *
     * @param string $name Statistic identifier defined in `stats.json`.
     * @param int|float|bool $value Value to persist for all players.
     */
    public function setAll(string $name, int|float|bool $value): void
    {
        $players = $this->game->loadPlayersBasicInfos();
        foreach ($players as $playerId => $player) {
            $this->setByPlayerId($name, $value, (int) $playerId);
        }
    }

    /**
     * Increment a player statistic by the given delta.
     *
     * 📖 documented function.
     *
     * @param string $name Statistic identifier defined in `stats.json`.
     * @param int|float $delta Signed difference to apply.
     * @param int $playerIdOrNo Target player ID, or player number when useNo is true.
     * @param bool $updateTableStat if there is a table stat of the same name to update at the same time (for example, for a turnNumber counter that would store the turns played by each player but also the total of turns for the table)
     */
    public function inc(string $name, int|float $delta, int $playerIdOrNo, bool $updateTableStat = false): void
    {
        $statType = $this->getStatType('player', $name)['type'];
        if ($statType === 'bool') {
            throw new SystemException('Impossible to increment boolean values');
        }
        $this->game->incStat($delta, $name, $this->getPlayerId($playerIdOrNo));
        if ($updateTableStat) {
            $this->game->incStat($delta, $name);
        }
    }

    /**
     * Increment a statistic for every player.
     *
     * 📖 documented function.
     *
     * @param string $name Statistic identifier defined in `stats.json`.
     * @param int|float $delta Signed difference to apply.
     */
    public function incAll(string $name, int|float $delta): void
    {
        $statType = $this->getStatType('player', $name)['type'];
        if ($statType === 'bool') {
            throw new SystemException('Impossible to increment boolean values');
        }
        $players = $this->game->loadPlayersBasicInfos();
        foreach ($players as $playerId => $player) {
            $this->game->incStat($delta, $name, (int) $playerId);
        }
    }

    /**
     * Fetch a player statistic.
     *
     * 📖 documented function.
     *
     * @param string $name Statistic identifier defined in `stats.json`.
     * @param int $playerIdOrNo Target player ID, or player number when useNo is true.
     *
     * @return int|float|bool The statistic value.
     */
    public function get(string $name, int $playerIdOrNo): int|float|bool
    {
        return $this->getTypedValue('player', $name, $this->game->getStat($name, $this->getPlayerId($playerIdOrNo)));
    }

    /**
     * Retrieve the statistic for all players, keyed by player ID or player number.
     *
     * 📖 documented function.
     *
     * @param string $name Statistic identifier defined in `stats.json`.
     *
     * @return array<int, int|float|bool> Statistic values keyed by player number when useNo is true, or player ID otherwise.
     */
    public function getAll(string $name): array
    {
        $result = [];
        $players = $this->game->loadPlayersBasicInfos();
        foreach ($players as $playerId => $player) {
            $playerKey = $this->useNo ? (int) $this->game->getPlayerNoById($playerId) : (int) $playerId;
            $result[$playerKey] = $this->getTypedValue('player', $name, $this->game->getStat($name, (int) $playerId));
        }
        return $result;
    }

    /**
     * Convert a player number to a player ID when useNo is true.
     */
    private function getPlayerId(int $playerIdOrNo): int
    {
        return $this->useNo ? (int) $this->game->getPlayerIdByNo($playerIdOrNo) : $playerIdOrNo;
    }
}
