<?php
declare(strict_types=1);

namespace Bga\GameFramework\StudioTools;

const GAME_DUMPS_FOLDER = \APP_DATA_PATH . 'game-dumps/';

/**
 * Studio tools, like save/load dump files.
 * To be used on studio only.
 */
class StudioTools {

    #[\DI\Attribute\Inject]
    private \Bga\GameFramework\Old\Db $db;
    
    #[\DI\Attribute\Inject]
    private \Bga\InternalApi\MsApi $msApi;
    #[\DI\Attribute\Inject]
    protected \Bga\Config\ServerConfig $serverConfig;

    /**
     * Save a state in a slot, for the current dev.
     */
    public function saveState(string $gameName, int $table, int $stateId) {
        global $g_config;
        if(!$g_config['can_save_table_image']) {
            throw new \feException('Not authorized');
        }
        if (!$this->serverConfig->isStudio()) {
            die('This is only for use from the studio platform.');
        }
    
        $this->saveGameState($gameName, $this->getDevName(), $table, $stateId);
    }

    /**
     * Load a state in a slot, for the current dev.
     */
    public function loadSavedState(int $stateId) {
        global $g_config;
        if(!$g_config['can_save_table_image']) {
            throw new \feException('Not authorized');
        }
        if (!$this->serverConfig->isStudio()) {
            die('This is only for use from the studio platform.');
        }
  
        $this->loadGameState($this->getDevName(), $stateId);
    }

    /**
     * Load the dump of a bug report, automatically saved to slot 1 if successful.
     */
    public function loadBugReport(string $gameName, int $table, int $bug_report_id) {
        global $g_config, $g_user;
        if(!$g_config['can_save_table_image']) {
            throw new \feException('Not authorized');
        }
        if (!$this->serverConfig->isStudio()) {
            die('This is only for use from the studio platform.');
        }

        $dev_name = $this->getDevName();

        if (!$g_user->is_admin()) {
            /*
            // Commented as the GS cannot read this table. Ideally, it should ask the MS if the dev has admin rights for the project.
            // Check that the game is assigned to this user as an administrator
            // so other devs cannot read private data from a running table by creating a bug report and loading it on studio
            $accessrights = $this->studioGameDevelopersRepository->findAccessRights($gameName, $dev_name);

            if ($accessrights !== 'ad') {
                throw new \feException("You don't have enough rights for $gameName to do this.", true);
            }*/
        }

        $this->loadBugReportDump($gameName, $dev_name, $table, $bug_report_id);
    }

    /**
     * Get the dev name, without the end digit.
     */
    private function getDevName(): string {
        global $bgaContainer, $g_user;

        // Get player name
        $o_player = $bgaContainer->get('module.player.player');
        $player = $o_player->get($g_user->get_id());
        $dev_name = $player['fullname'];
        if (is_numeric(substr($dev_name, -1))) {
            $dev_name = substr($dev_name, 0, -1); // Note: use only the canonical name for Studio developper account
        }
        return $dev_name;
    }

    /**
     * Get the file path of a dump.
     */
    private function getDumpFileName(string $devName, int $stateId): string {
        return GAME_DUMPS_FOLDER . 'save_' . $devName . '_' . $stateId;
    }

    private function getTableDbName(string $gameName, int $tableId): string {
        return 'ebd_' . $gameName . '_' . $tableId;
    }

    /**
     * Save the content of the DB to a dump file.
     */
    private function saveGameState(string $gameName, string $devName, int $tableId, int $stateId): void {
        global $g_config;

        $dbname = $this->getTableDbName($gameName, $tableId);

        // we need to stop current transation, so the mysql command doesn't hang while waiting for action transaction to end.
        $this->db->commit();

        $command = vsprintf("MYSQL_PWD=\"%s\" mysqldump --no-tablespaces --databases --add-drop-database -h %s -u %s %s > %s", [
            $g_config['db_password_for_dbcreation'] ?? $g_config["db_password"], 
            $g_config["db_host"], 
            $g_config['db_user_for_dbcreation'] ?? $g_config["db_user"],
            $dbname,
            $this->getDumpFileName($devName, $stateId),
        ]);

        $result = shell_exec($command);

        // start a new transaction
        $this->db->begin();

        if ($result !== null) {
            throw new \feException('Error during command:' . $result);
        }
    }

    /**
     * Load the content of a dump file to the DB.
     */
    private function loadGameState(string $devName, int $stateId): void {
        global $g_config;

        $dumpFileName = $this->getDumpFileName($devName, $stateId);

        $dumpSize = filesize($dumpFileName);
        if (!$dumpSize) {
            throw new \feException('There is no saved state in this slot');
        }

        // we need to stop current transation, so the mysql command doesn't hang while waiting for action transaction to end.
        $this->db->commit();

        $command = vsprintf("MYSQL_PWD=\"%s\" mysql -h %s -u %s < %s 2>&1", [
            $g_config['db_password_for_dbcreation'] ?? $g_config["db_password"], 
            $g_config["db_host"], 
            $g_config['db_user_for_dbcreation'] ?? $g_config["db_user"],
            $dumpFileName,
        ]);

        $result = shell_exec($command);

        // start a new transaction
        $this->db->begin();

        if ($result !== null) {
            throw new \feException('Error during command:' . $result);
        }
    }

    /**
     * Fetch the content of a bug report dump file from production to a slot, to be loaded afterwards.
     */
    private function fetchBugReportDump(string $gameName, string $devName, int $table_id, int $report_id, int $stateId): void {
        // Get from production
        $sql = $this->msApi->getBugReportDump($gameName, $report_id);

        if ($sql == '') {
            throw new \BgaVisibleSystemException('There is no valid saved state for this game and this report ID');
        }

        // Remove the MariaDB warning added on prod bug report dumps
        $sql = str_replace('/*M!999999\- enable the sandbox mode */', '', $sql);
        // Adapt retrieved database name for target studio table
        $sql = preg_replace('/ebd_' . $gameName . '_[0-9]*/', 'ebd_' . $gameName . '_' . $table_id, $sql);

        // The dump may not have all tables such as gamelog. Make sure they are created too
        $dump_file_path = APP_BASE_PATH . 'Bga/GameFramework/dbmodel.sql';
        $sql .= "\n\n" . file_get_contents($dump_file_path);

        // Write result into the current dev save slot #1
        file_put_contents($this->getDumpFileName($devName, $stateId), $sql);
    }

    /**
     * Load the content of a bug report dump file to the DB.
     */
    public function loadBugReportDump(string $gameName, string $dev_name, int $table_id, int $bug_report_id) {
        $this->loadBugReportDumpToTable($gameName, $dev_name, $table_id, $bug_report_id);
    }

    /**
     * Load the content of a bug report dump file to a specific table DB.
     */
    public function loadBugReportDumpToTable(string $gameName, string $dev_name, int $table_id, int $bug_report_id) {
        global $g_config;

        if(!$g_config['can_save_table_image']) {
            throw new \feException('Not authorized');
        }
        if (!$this->serverConfig->isStudio()) {
            die('This is only for use from the studio platform.');
        }

        ini_set('memory_limit', '512M'); // needed to handle big files, some bug report dumps are over 100Mb
        
        $targetDbName = $this->getTableDbName($gameName, $table_id);
        $updatedSlot = 4;
        $backupSlot = 5;
        try {
            $studioPlayersIds = $this->db->getObjectList("SELECT player_id FROM `$targetDbName`.`player`", true);

            $this->saveGameState($gameName, $dev_name, $table_id, $backupSlot);

            // "load bug report" in control panel
            $this->fetchBugReportDump($gameName, $dev_name, $table_id, $bug_report_id, $updatedSlot);

            // "load state" at this table
            $this->loadGameState($dev_name, $updatedSlot);

            /*require_once( APP_GAMES_PATH."$gameName/current/$gameName.game.php");
            $table = new $gameName();
            if (method_exists($table, 'loadBugReportSQL')) {
                $table->loadBugReportSQL($bug_report_id, $studioPlayersIds);
            } else {*/
                $this->replaceProdPlayersIdsOnDump($this->getDumpFileName($dev_name, $updatedSlot), $studioPlayersIds);
                // load again the modified dump file
                $this->loadGameState($dev_name, $updatedSlot);

                $this->removeChatFromGameLog($targetDbName);
            /*}*/

            // save modified DB back in slot 1
            $this->saveGameState($gameName, $dev_name, $table_id, 1);
        } finally {
            foreach ([$updatedSlot, $backupSlot] as $slot) {
                $fileName = $this->getDumpFileName($dev_name, $slot);
                if (file_exists($fileName)) {
                    unlink($fileName);
                }
            }
        }
    }

    /**
     * Replace the prod player ids by the studio player ids, by scanning/replacing occurences in the dump file.
     */
    private function replaceProdPlayersIdsOnDump(string $dumpFileName, array $studioPlayersIds): void {
        $str = file_get_contents($dumpFileName);

        // we search the prod player ids in the dump file
        $match_players = [];
        preg_match('/INSERT INTO `player` VALUES\s*([^;]*);/s', $str, $match_players);
        $values = preg_split('/\),\s*\(/s', $match_players[1]);
        $prodPlayersIds = [];
        foreach ($values as $value) {
            $match_player_id = [];
            preg_match('/\\d+,(\\d+).*/', $value, $match_player_id);
            $prodPlayersIds[] = intval($match_player_id[1]);
        }

        $prodCount = count($prodPlayersIds);
        $studioCount = count($studioPlayersIds);
        if ($prodCount != $studioCount) {
            throw new \BgaVisibleSystemException("Incorrect player count (bug report has $prodCount players, studio table has $studioCount players)");
        }

        // we replace the prod player ids by the studio player ids
        $str = str_replace($prodPlayersIds, $studioPlayersIds, $str);
        file_put_contents($dumpFileName, $str);
    }

    private function removeChatFromGameLog(string $targetDbName) {
        // chat log don't have a move number
        $this->db->query("DELETE FROM `$targetDbName`.`gamelog` WHERE `gamelog_move_id` IS NULL");
    }
}
