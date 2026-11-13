<?php
declare(strict_types=1);

namespace Bga\GameFramework;

abstract class Stats {
    public function __construct(protected Table $game) {
        $this->game = $game;
    }

    protected function getStatType(string $tableOrPlayer, string $name): array {
        $stat_types = $this->game->getStatTypes();
        if (!isset($stat_types[$tableOrPlayer][$name])) {
            throw new SystemException("Unknown $tableOrPlayer statistic: $name");
        }
        return $stat_types[$tableOrPlayer][$name];
    }

    protected function getTypedValue(string $tableOrPlayer, string $name, mixed $rawValue): int|float|bool {
        $type = $this->getStatType($tableOrPlayer, $name)['type'];
        return match($type) {
            'int' => (int)$rawValue,
            'float' => (float)$rawValue,
            'bool' => (bool)$rawValue,
            default => throw new SystemException("Unknown $tableOrPlayer statistic type: $type"),
        };
    }

    protected function setInitStatValue(string $tableOrPlayer, string|array $nameOrNames, int|float|bool $value, ?int $playerId = null): void {
        $names = gettype($nameOrNames) === 'string' ? [$nameOrNames] : $nameOrNames;
        $values = [];
        foreach ($names as $name) {
            $statId = intval($this->getStatType($tableOrPlayer, $name)['id']);
            $sqlValue = gettype($value) === 'boolean' ? ($value ? 1 : 0) : $value;

            if ($tableOrPlayer === 'table') {
                $values[] = "($statId, NULL, $sqlValue)";
            } elseif ($tableOrPlayer === 'player') {
                if ($playerId === null) {
                    $players = $this->game->loadPlayersBasicInfos();
                    if (empty($players)) {
                        throw new SystemException("Player statistic $name cannot be initialized before players are set up.");
                    }
                    foreach ($players as $id => $_) {
                        $values[] = "($statId, $id, $sqlValue)";
                    }
                } else {
                    $values[] = "($statId, $playerId, $sqlValue)";
                }
            } else {
                throw new SystemException('Wrong table_or_player type');
            }
        }

        if ($values === []) {
            return;
        }

        $sql = 'INSERT INTO stats (stats_type, stats_player_id, stats_value) VALUES ' . implode(',', $values);
        $this->game->DbQuery($sql);
    }
}
