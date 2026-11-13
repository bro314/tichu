<?php

declare(strict_types=1);

namespace Bga\GameFramework\GameResult;

class Team
{
    /**
     * @param array<int, Player|int|null>|null $players Player objects, IDs, or unknown players. Null means all players not named in other teams.
     */
    public function __construct(
        public ?array $players = [],
        public int $score = 0,
        public ?int $scoreAux = null,
        public ?int $rank = null,
        public ?string $name = null, // team name, for team games (TODO)
        public ?string $color = null, // team color, for team games (TODO)
        public bool $conceded = false,
    ) {}

    public static function singlePlayerTeam(Player $player, ?int $rank = null) {
        return new self(
            players: [$player],
            score: $player->score,
            scoreAux: $player->scoreAux,
            rank: $rank,
        );
    }

}
