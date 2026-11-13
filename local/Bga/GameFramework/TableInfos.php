<?php
declare(strict_types=1);

namespace Bga\GameFramework;

/**
 * Basic informations on a table read & write with cache feature
 * (Note: to be used with table on PLAY status only).
 */
class TableInfos
{
    private ?int $table_id = null;

    /**
     * @var array<int, array{
     *     id: int,
     *     game_id?: int,
     *     players: array<int, array{
     *         id: int|string,
     *         name: string,
     *         color: string,
     *         player_zombie: int,
     *         player_eliminated: int,
     *         player_beginner: string
     *     }>,
     *     globals: array<int|string, int|string>
     * }>
     */
    static array $tables_infos = [];

    function setTable(int $table_id): void
    {
        $this->table_id = $table_id;
    }

    /**
     * Get the table infos.
     * Get the tableinfos object from cache, if available
     */
    function get(bool $bSelectGlobalsForUpdate = false): array
    {
        if ($this->table_id == null) {
            throw new \feException('Table not set');
        }

        if (isset(self::$tables_infos[$this->table_id])) {
            return self::$tables_infos[$this->table_id];
        } // Table informations has been generated already => return the object

        // We have to generate table infos:
        $this->db_load($bSelectGlobalsForUpdate);
        return self::$tables_infos[$this->table_id];
    }

    /**
     * Force table info reload (ex: after game initialization).
     */
    function reload(): void
    {
        $this->db_load();
    }

    /**
     * Complete reload the tableinfos object from DB.
     * Note: "current DB agnostic"
     */
    function db_load(bool $bSelectGlobalsForUpdate = false): void
    {
        $tableInfos = [
            'id' => $this->table_id,
            'globals' => $this->getGlobalsFromDB($bSelectGlobalsForUpdate),
            'players' => [],
        ];

        $admin_player = $tableInfos['globals'][5] ?? null;

        if (isset($tableInfos['globals'][4])) {
            $tableInfos['game_id'] = $tableInfos['globals'][4]; // 4 = GAMESTATE_GAME_ID
        }

        // Players basic infos
        $sql = "SELECT `player_id`, `player_name`, `player_no`, `player_color`, (`player_id`='$admin_player') AS `player_is_admin`, `player_zombie`, `player_eliminated`, `player_next_notif_no`, `player_enter_game`, `player_ai`, HEX(`player_beginner`) AS `player_beginner` FROM `player` ORDER BY `player_no`";
        $players = Table::getObjectListFromDB($sql);
        foreach ($players as $player) {
            $player['concede'] = $player['player_zombie'] < 0 ? 1 : 0;
            $player['player_zombie'] = $player['player_zombie'] == 1 ? 1 : 0;
            $player['player_eliminated'] = $player['player_eliminated'] == 1 ? 1 : 0;
            $tableInfos['players'][$player['player_id']] = $player;
        }

        self::$tables_infos[$this->table_id] = $tableInfos;
    }

    /**
     * Return all globals from the DB as an array [ id => value ].
     */
    function getGlobalsFromDB(bool $forUpdate = false)
    {
        $sql = 'SELECT `global_id`, `global_value` FROM `global` WHERE 1 ';
        if ($forUpdate) {
            $sql .= 'FOR UPDATE';
        }
        return Table::getCollectionFromDB($sql, true);
    }

    // Table infos update methods /////////////

    /**
     * Insert or update a global on DB.
     */
    public function setGlobal(int $global_id, int $global_value)
    {
        if (isset(self::$tables_infos[$this->table_id]['globals'][$global_id])) {
            // Update in DB
            $sql = "UPDATE `global` SET `global_value`=$global_value WHERE `global_id`=$global_id ";
            Table::DbQuery($sql);
        } else {
            // New value
            $sql = "INSERT INTO `global` (`global_id`, `global_value`) VALUES 
                    ($global_id, $global_value) 
                    ON DUPLICATE KEY UPDATE `global_value`=$global_value";
            Table::DbQuery($sql);
        }

        if (isset(self::$tables_infos[$this->table_id])) {
            self::$tables_infos[$this->table_id]['globals'][$global_id] = $global_value;
        }
    }

    /**
     * Increment a global on DB (or set increment as the value if unset).
     */
    function incGlobal(int $global_id, int $increment)
    {
        if (isset(self::$tables_infos[$this->table_id]['globals'][$global_id])) {
            // Update in DB
            $sql = "UPDATE `global` SET `global_value`=`global_value` + $increment WHERE `global_id`=$global_id ";
            Table::DbQuery($sql);

            self::$tables_infos[$this->table_id]['globals'][$global_id] =
                self::$tables_infos[$this->table_id]['globals'][$global_id] + $increment;
        } else {
            // New value
            $sql = "INSERT INTO `global` (`global_id`, `global_value`) VALUES 
                    ($global_id, $increment) 
                    ON DUPLICATE KEY UPDATE `global_value`=$increment";
            Table::DbQuery($sql);

            if (isset(self::$tables_infos[$this->table_id])) {
                self::$tables_infos[$this->table_id]['globals'][$global_id] = $increment;
            }
        }
    }

    /**
     * Mark a player as Zombie.
     */
    function setZombie(int $player_id, bool $bMakeZombie = true): void
    {
        // make sure self::$tables_infos is populated
        $this->get();

        $newValue = $bMakeZombie ? 1 : 0;

        // Update in DB
        Table::DbQuery("UPDATE `player` SET `player_zombie` = $newValue WHERE `player_id` = $player_id");

        self::$tables_infos[$this->table_id]['players'][$player_id]['player_zombie'] = $newValue;
    }

    /**
     * Mark a player a conceder.
     */
    function setConcede(int $player_id): void
    {
        Table::DbQuery("UPDATE `player` SET `player_zombie`=-1 WHERE `player_id` = $player_id");
    }
}
