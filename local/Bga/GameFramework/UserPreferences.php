<?php
declare(strict_types=1);

namespace Bga\GameFramework;

/**
 * ⚠️ this class use $db and not game classes to bypass the `bga_` check.
 */
final class UserPreferences {

    function __construct() {
    }

    /**
     * Gets the value of a user preference for a player (cached in game DB).
     * 
     * 📖 documented function.
     * 
     * @param int $playerId the player id
     * @param int $prefId the preference id, as described in the gamepreferences.json file
     * @return int|null the user preference value, or null if unset
     */
    function get(int $playerId, int $prefId): ?int
    {
        global $bgaContainer;

        if ($playerId < 0) {
            return null;
        }

        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);
        $value = $db->getUniqueValue("SELECT pgp_value FROM bga_user_preferences WHERE pgp_player='$playerId' AND pgp_preference_id='$prefId' ");
        return $value !== null ? (int) $value : null;
    }

    /**
     * Updates the cache of user preferences.
     * Called when a player changes a user preference (updated on the current table), or when the table is opened (for running turn-based games).
     */
    function updateCache(int $playerId, int $prefId, int $prefValue): void
    {
        global $bgaContainer;
        if ($playerId < 0) {
            return;
        }

        /** @var \Bga\GameFramework\Old\Db */
        $db = $bgaContainer->get(\Bga\GameFramework\Old\Db::class);

        static $tableExists = null;
        if ($tableExists === null) {
            $tableExists = boolval($db->getUniqueValue("SHOW TABLES LIKE 'bga_user_preferences'"));
        }
        if (!$tableExists) {
            // in case the game was created before the framework update, we create it
            $db->query(
                'CREATE TABLE IF NOT EXISTS `bga_user_preferences` ( `pgp_player` int(10) UNSIGNED NOT NULL, `pgp_preference_id` int(10) UNSIGNED NOT NULL, `pgp_value` int(11) NOT NULL, PRIMARY KEY (`pgp_player`, `pgp_preference_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
            );
            $tableExists = true;
        }

        $db->query(
            "REPLACE INTO bga_user_preferences (pgp_player, pgp_preference_id, pgp_value) VALUES ($playerId, $prefId, $prefValue)"
        );
    }
}
