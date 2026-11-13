<?php

declare(strict_types=1);

namespace Bga\GameFramework\GameResult;

/*
TODO later: check if we can give access to it at the beginning of the game for fixed team games (for the game to display team color/team name)
TODO later: think about teams outside of games (arena, tournament, ...)
*/
class GameResult
{
    public static final int $FORCED_WIN = 251;
    public static final int $FORCED_LOSS = 252;

    /**
     * Game outcome.
     */
    public Outcome $outcome = Outcome::NORMAL;

    /**
     * Abandon reason.
     */
    public ?AbandonReason $abandonReason = null;

    /**
     * Teams for all players that played to the end.
     *
     * @var Team[]|null Null until individualRanking(null) loads the table players.
     */
    public ?array $rankedTeams = [];

    /**
     * Players who left before the end.
     * multiple values possible for game with the keep_ranking_on_quit flag, else it will be only 0 or 1 value.
     */
    public array $neutralizedPlayerIds = [];

    /**
     * Progression of the game when neutralized. Use to compute percentage of ELO gained based on game progression.
     */
    public ?int $neutralizedProgression = null;

    /**
     * Scores for player IDs are loaded when the table completes the result.
     *
     * @var null|array{reverseScore: bool, reverseScoreAux: bool}
     */
    private ?array $deferredIndividualRanking = null;

    private function __construct() {}

    /**
     * Score all players separately (no-team game).
     *
     * @param array<int, Player|int|null>|null $players The players or their IDs. Null ranks all table players at completion.
     * @param bool $reverseScore Whether negative scores should be rewarded
     * @param bool $reverseScoreAux Whether auxiliary score ordering is reversed
     *
     * @return self
     */
    public static function individualRanking(
        ?array $players = null,
        bool $reverseScore = false,
        bool $reverseScoreAux = false,
    ) {
        if ($players === null) {
            $gameResult = new self();
            $gameResult->rankedTeams = null;
            $gameResult->deferredIndividualRanking = [
                'reverseScore' => $reverseScore,
                'reverseScoreAux' => $reverseScoreAux,
            ];
            return $gameResult;
        }

        foreach ($players as $player) {
            if (!$player instanceof Player) {
                $gameResult = self::teamRanking(array_map(
                    static fn(Player|int|null $player): Team => new Team(players: [$player]),
                    $players,
                ));
                $gameResult->deferredIndividualRanking = [
                    'reverseScore' => $reverseScore,
                    'reverseScoreAux' => $reverseScoreAux,
                ];
                return $gameResult;
            }
        }

        usort($players, static function (Player $playerA, Player $playerB) use ($reverseScore, $reverseScoreAux) {
            $scoreComparison = $reverseScore
                ? intval($playerA->score) <=> intval($playerB->score)
                : intval($playerB->score) <=> intval($playerA->score);
            if ($scoreComparison !== 0) {
                return $scoreComparison;
            }

            $scoreAuxComparison = $reverseScoreAux
                ? intval($playerA->scoreAux ?? 0) <=> intval($playerB->scoreAux ?? 0)
                : intval($playerB->scoreAux ?? 0) <=> intval($playerA->scoreAux ?? 0);
            if ($scoreAuxComparison !== 0) {
                return $scoreAuxComparison;
            }

            return 0;
        });

        $rankedTeams = [];

        // first, rank the player
        $currentRank = 0;
        foreach ($players as $player) {
            $team = Team::singlePlayerTeam($player);

            $sameResultAsPreviousTeam = false;
            if (count($rankedTeams) > 0) {
                $lastTeam = $rankedTeams[count($rankedTeams) - 1];
                if ($lastTeam->score === $team->score && $lastTeam->scoreAux === $team->scoreAux) {
                    $sameResultAsPreviousTeam = true;
                }
            }

            if (!$sameResultAsPreviousTeam) {
                $currentRank++;
            }
            $team->rank = $currentRank;

            $rankedTeams[] = $team;
        }

        // an individual ranking is the same as ranked teams of 1 player
        return self::teamRanking(
            $rankedTeams,
        );
    }

    /**
     * Same team for all winner(s), and all loser(s).
     *
     * @param Team $winners The winning players at this table. Currently, real players only.
     * @param Team $losers The losing players at this table. Currently, real players only.
     *
     * @return self
     */
    public static function losersNotRanked(
        Team $winners,
        Team $losers,
    ) {
        $winners->rank = 1;
        $losers->rank = 2;

        return self::teamRanking([
            $winners,
            $losers,
        ]);
    }

    /**
     * Build a solo game result (internally treated as a cooperative result).
     *
     * @param Player|int|null $player The player or player ID at this table. Null finds the only unnamed player.
     * @param int $score The solo score. For display only, the outcome is decided by $outcome.
     * @param bool $win indicates if the coop game is won or lost
     *
     * @return self
     */
    public static function solo(
        Player|int|null $player = null,
        int $score = 0,
        bool $win = true,
    ) {
        // actually, a solo game is a coop game of 1 player
        return self::coop([$player], $score, $win);
    }

    /**
     * Build a cooperative result with a single team representing all players.
     *
     * @param array<int, Player|int|null>|null $players The players or their IDs. Null uses all unnamed players.
     * @param int $score The team score. For display only, the outcome is decided by $outcome.
     * @param bool $win indicates if the coop game is won or lost
     *
     * @return self
     */
    public static function coop(
        ?array $players = null,
        int $score = 0,
        bool $win = true,
    ) {
        $team = new Team(
            players: $players,
            score: $score,
            rank: $win ? self::$FORCED_WIN : self::$FORCED_LOSS,
        );

        // a coop/solo game is a team game of 1 team
        $gameResult = self::teamRanking([$team]);

        return $gameResult;
    }

    /**
     * Build a result for a team-based ranking game.
     *
     * @param Team[] $teams The teams at this table. Currently, real players only.
     */
    public static function teamRanking(
        array $teams,
    ): self {

        $gameResult = new self();
        $gameResult->rankedTeams = $teams;

        return $gameResult;
    }

    /** @param array<int, Player> $tablePlayers */
    public function rankResolvedIndividualPlayers(array $tablePlayers): void
    {
        if ($this->deferredIndividualRanking === null) {
            return;
        }

        $players = array_values($tablePlayers);
        if ($this->rankedTeams !== null) {
            $players = [];
            foreach ($this->rankedTeams as $team) {
                array_push($players, ...$team->players);
            }
        }
        $rankedResult = self::individualRanking(
            $players,
            $this->deferredIndividualRanking['reverseScore'],
            $this->deferredIndividualRanking['reverseScoreAux'],
        );
        $this->rankedTeams = $rankedResult->rankedTeams;
        $this->deferredIndividualRanking = null;
    }

    /**
     * @return Team[]
     */
    public function getAllTeams(): array {
        return $this->rankedTeams ?? [];
    }

    /**
     * @return int[]
     */
    public function getPlayerIds(): array {
        $playerIds = [];
        foreach ($this->getAllTeams() as $team) {
            foreach ($team->players ?? [] as $player) {
                if ($player !== null) {
                    $playerIds[] = $player instanceof Player ? $player->id : $player;
                }
            }
        }

        return $playerIds;
    }
}
