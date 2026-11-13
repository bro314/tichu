<?php

declare(strict_types=1);

namespace Bga\GameFramework\GameResult;

class Player
{
    public function __construct(
        public int $id, // TODO nullable for fake players?
        public string $name, // mandatory for fake players, do we store it for real players in case it changed on MS after the game?
        public string $color = '000000',
        public ?int $score = null, // is it needed, do team games also have individual scores?
        public ?int $scoreAux = null, // is it needed, do team games also have individual scores?
    ) {}

    /**
     * @return Player
     */
    public static function fromPlayerDb(array $playerDb): self {
        return new self(
            id: (int)$playerDb['player_id'],
            name: $playerDb['player_name'],
            color: $playerDb['player_color'],
            score: (int)$playerDb['player_score'],
            scoreAux: ($playerDb['player_score_aux'] ?? null) !== null ? (int)$playerDb['player_score_aux'] : null,
        );
    }

    /**
     * @return Player[]
     */
    public static function fromPlayersDb(array $playersDb): array {
        return array_map(fn($playerDb) => self::fromPlayerDb($playerDb), $playersDb);
    }
}

