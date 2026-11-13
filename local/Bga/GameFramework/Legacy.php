<?php
declare(strict_types=1);

namespace Bga\GameFramework;

final class Legacy {

    function __construct(
        private $game,
    ) {}

    /**
     * Get data associated with $key for the current game.
     * 
     * This data is common to ALL tables from the same game for this player, and persist from one table to another.
     * 
     * Note: calling this function has an important cost => please call it few times (possibly: only ONCE) for each player for 1 game if possible
     * 
     * 📖 documented function.
     * 
     * @param string $key the key of the legacy data to get
     * @param int $playerId the player id (or 0 for data shared on all tables)
     * @param mixed $defaultValue the value to return if the key doesn't exist in the legacy data for this player
     */
    public function get(string $key, int $playerId, mixed $defaultValue = null): mixed {
        $rawValue = $this->game->retrieveLegacyData($playerId, $key) ?? [ $key => $defaultValue];
        $value = array_key_exists($key, $rawValue) ? json_decode($rawValue[$key]) : $defaultValue;
        return $value;
    }

    /**
     * Store some data associated with $key for the given user / current game
     * In the opposite of all other game data, this data will PERSIST after the end of this table, and can be re-used in a future table with the same game.
     * 
     * IMPORTANT: The only possible place where you can use this method is when the game is over at your table (last game action). Otherwise, there is a risk of conflicts between ongoing games.
     * 
     * Each key for a given user and game can store up to 64 KiB of JSON data.
     * 
     * NOTICE: You can store some persistant data across all tables from your game using the specific player_id 0 which is unused. In such case, it's even more important to manage correctly the size of your data to avoid any exception or issue while storing updated data (ie. you can use this for some kind of leaderbord for solo game or contest)
     * 
     * 📖 documented function.
     * 
     * @param string $key the key of the legacy data to save
     * @param int $playerId the player id (or 0 for data shared on all tables)
     * @param mixed $value the value to save as the legacy data for this player
     * @param int $ttl time-to-live: the maximum, and default, is 365 days.
     */
    public function set(string $key, int $playerId, mixed $value, int $ttl = 365): void {
        $this->game->storeLegacyData($playerId, $key, $value, $ttl);
    }

    /**
     * Remove some legacy data with the given key
     * 
     * 📖 documented function.
     * 
     * @param string $key the key of the legacy data to remove
     * @param int $playerId the player id (or 0 for data shared on all tables)
     */
    public function delete(string $key, int $playerId): void {
        $this->game->removeLegacyData($playerId, $key);
    }

    /**
     * Get data associated with the team for the current game.
     * 
     * This data is common to ALL tables from the same game for this team, and persist from one table to another.
     * 
     * Note: calling this function has an important cost => please call it few times (possibly: only ONCE) for 1 game if possible
     * 
     * 📖 documented function.
     * 
     * @param mixed $defaultValue the value to return if the legacy data doesn't exist or is null for this team
     */
    public function getTeam(mixed $defaultValue = null): mixed {
        $rawValue = $this->game->retrieveLegacyTeamData();
        $value = $rawValue !== null && !empty($rawValue) ? json_decode($rawValue) : $defaultValue;
        return $value;
    }

    /**
     * Store some data associated to the team of the current table (all players at the table) / current game
     * In the opposite of all other game data, this data will PERSIST after the end of this table, and can be re-used in a future table with the same game.
     * 
     * IMPORTANT: The only possible place where you can use this method is when the game is over at your table (last game action). Otherwise, there is a risk of conflicts between ongoing games.
     * 
     * In any way, the total data you can store for a given team+game is 64k
     * 
     * 📖 documented function.
     * 
     * @param mixed $value the value to save as the legacy data for this team
     * @param int $ttl time-to-live: the maximum, and default, is 365 days.
     */
    public function setTeam(mixed $value, int $ttl = 365): void {
        $this->game->storeLegacyTeamData($value, $ttl);
    }

    /**
     * Remove the legacy data for a team
     * 
     * 📖 documented function.
     */
    public function deleteTeam(): void {
        $this->game->removeLegacyTeamData();
    }
}
