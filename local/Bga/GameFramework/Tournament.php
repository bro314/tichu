<?php
declare(strict_types=1);

namespace Bga\GameFramework;

/**
 * Tournament-related APIs for game tables.
 *
 * This is a thin plumbing layer for mainsite endpoints; validation and data handling live on the MS.
 *
 * @phpstan-type TournamentInfo array{
 *   id?: int,
 *   name?: string,
 *   championship_name?: string,
 *   oot_options?: string,
 *   tournament_group?: int,
 *   tournament_parent_id?: int|null,
 *   avatar?: string
 * }
 * @phpstan-type TournamentSeedInfo array{
 *   tournament_seed?: int,
 *   step_seed?: int,
 *   parent_tournament_seed?: int
 * }
 */
final class Tournament
{
    /**
     * Cached tournament info for this table.
     *
     * @phpstan-var TournamentInfo|null
     */
    private ?array $info = null;

    /**
     * Cached tournament seed info for this table.
     *
     * @phpstan-var TournamentSeedInfo|null
     */
    private ?array $seedInfo = null;

    /**
     * @param Table $game The current game table instance.
     * @param callable(string, array): mixed $masterNodeRequestCallable
     */
    public function __construct(private Table $game, private $masterNodeRequestCallable) {}

    /**
     * Returns true if this table is a tournament encounter.
     * 
     * 📖 documented function
     */
    public function isTournament(): bool
    {
        return $this->game->getGameStateValue('is_tournament') === '1';
    }

    /**
     * Retrieve tournament info for the current table.
     *
     * Returns an empty array when the table is not part of a tournament.
     *
     * @phpstan-return TournamentInfo
     */
    public function getInfo(): array
    {
        if ($this->info !== null) {
            return $this->info;
        }

        if (!$this->isTournament()) {
            $this->info = [];
            return $this->info;
        }

        $this->info = $this->mainsiteRequest('getTournamentInfo', [
            'table_id' => $this->game->table_id,
        ]);

        return $this->info;
    }

    /**
     * Retrieve tournament seeds for deterministic randomness.
     *
     * Returns an empty array when the table is not part of a tournament.
     *  
     * 📖 documented function
     *
     * @phpstan-return TournamentSeedInfo
     */
    public function getSeedInfo(): array
    {
        if ($this->seedInfo !== null) {
            return $this->seedInfo;
        }

        if (!$this->isTournament()) {
            $this->seedInfo = [];
            return $this->seedInfo;
        }

        $this->seedInfo = $this->mainsiteRequest('getTournamentSeedInfo', [
            'table_id' => $this->game->table_id,
        ]);

        return $this->seedInfo;
    }

    /**
     * Store player game data associated with $key for a tournament (of which the table must be a part of).
     *
     * The cumulative size of the data you can store for a given player for a tournament is 64 KiB.
     *
     * Note: As with every game framework API that interacts with the BGA mainsite, please use it thoughtfully.
     * 
     * 📖 documented function
     */
    public function storePlayerGameData(int $playerId, string $key, mixed $data): void
    {
        $this->mainsiteRequest('storeTournamentPlayerGameData', [
            'table_id' => $this->game->table_id,
            'player' => $playerId,
            'key' => $key,
            'data' => $data,
        ]);
    }

    /**
     * Get player game data associated with $key for a tournament.
     *
     * You can use '%' in $key to retrieve multiple values at once matching a pattern.
     *
     * If '%' is used the return value will be an array of key-value pairs (or [], if no match is found).
     * Otherwise, a single value is returned (or null, if no match is found).
     *
     * Returned values are decoded from JSON.
     * 
     * 📖 documented function
     *
     * @return mixed|array<string,mixed>
     */
    public function retrievePlayerGameData(int $playerId, string $key): mixed
    {
        return $this->mainsiteRequest('retrieveTournamentPlayerGameData', [
            'table_id' => $this->game->table_id,
            'player' => $playerId,
            'key' => $key,
        ]);
    }

    /**
     * Remove some tournament player game data associated with the given key.
     *
     * In any case, all data related to a tournament is removed when the tournament is finished.
     * 
     * 📖 documented function
     * 
     */
    public function removePlayerGameData(int $playerId, string $key): void
    {
        $this->mainsiteRequest('removeTournamentPlayerGameData', [
            'table_id' => $this->game->table_id,
            'player' => $playerId,
            'key' => $key,
        ]);
    }

    /**
     * Dispatch a request to the mainsite via the injected callable.
     * 
     * This helper is needed because $this->masterNodeRequestCallable is attribute, not a class method, so it cannot be directly called and must be dereferenced first.
     * 
     * @param array<string,mixed> $args
     */
    private function mainsiteRequest(string $method, array $args): mixed
    {
        return ($this->masterNodeRequestCallable)($method, $args);
    }
}
