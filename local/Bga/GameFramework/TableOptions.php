<?php
declare(strict_types=1);

namespace Bga\GameFramework;

final class TableOptions {

    function __construct(
        private $game,
    ) {}

    /**
     * Get the value of a table option.
     * 
     * 📖 documented function.
     * 
     * @param int $optionId the option id as in the gameoptions.json file
     * @return int|null the option value, or null if the option doesn't exist (for example on a table created before a new option was added).
     */
    public function get(int $optionId): ?int {
        /* Disable temporarily as it breaks some games 
        $tableOptions = $this->game->getGameOptions();
        if (!isset($tableOptions[$optionId])) {
            throw new SystemException("Invalid table option ID: $optionId");
        }
        */
        if ($optionId < 100 || $optionId >= 200) {
            if ($optionId !== 300) { // TEMP exception for games reading the game version this way
                // TODO Disable temporarily as it breaks some games throw new SystemException("Table options should be range 100-199, trying to read: $optionId");
            }

            // block on Studio only for now
            if (Table::getBgaEnvironment() === 'studio') {
                switch ($optionId) {
                    case 200: throw new SystemException("Table options should be range 100-199, trying to read 200. Please use \$this->bga->tableOptions->isTurnBased() or \$this->bga->tableOptions->isRealTime() instead.");
                    case 201: break; // to let the case of altered pass for now
                    case 207: throw new SystemException("Table options should be range 100-199, trying to read 207. Please use \$this->bga->tableOptions->getGameLanguage() instead.");
                    case 300: throw new SystemException("Table options should be range 100-199, trying to read 300. Please use \$this->bga->tableOptions->getGameVersion() instead.");
                    default: throw new SystemException("Table options should be range 100-199, trying to read $optionId. If you really need this data and think it should be readable, please contact Studio support.");
                }
            }
        }
        
        $rawValue = $this->game->gamestate->table_globals[$optionId] ?? null;
        return $rawValue === null ? null : (int)$rawValue;
    }

    /**
     * Set the value of a table option.
     * 
     * It should only be called for Random options, when setting one of the other values to this option, to keep the table updated to the picked random value.
     * 
     * 📖 documented function.
     * 
     * @param int $optionId the option id as in the gameoptions.json file
     * @param int $value the value to set the option to
     */
    public function set(int $optionId, int $value): void {
        $tableOptions = $this->game->getGameOptions();
        if (!isset($tableOptions[$optionId])) {
            throw new SystemException("Invalid table option ID: $optionId");
        }
        if (!isset($tableOptions[$optionId]['values'][$value])) {
            throw new SystemException("Invalid value $value for table option $optionId");
        }

        $this->game->gamestate->table_globals[$optionId] = $value;
        $this->game->o_tableinfos->setGlobal((int) $optionId, (int) $value);
    }

    /**
     * Indicates if the table is Turn-based.
     * 
     * 📖 documented function.
     * 
     * @return bool if the table is Turn-based.
     */
    public function isTurnBased(): bool {
        return $this->game->gamestate->table_globals[GAMESTATE_CLOCK_MODE] >= 10;
    }

    /**
     * Indicates if the table is Real-time.
     * 
     * 📖 documented function.
     * 
     * @return bool if the table is Real-time.
     */
    public function isRealTime(): bool {
        return !$this->isTurnBased();
    }

    /**
     * Returns the current game version
     * 
     * 📖 documented function.
     * 
     * @return int the game version
     */
    public function getGameVersion(): int {
        return (int)$this->game->gamestate->table_globals[GAMESTATE_GAMEVERSION];
    }

    /**
     * Get the selected language index as defined in the gameinfos file.
     *
     * 📖 documented function.
     *
     * @return int|null the selected language index, or null if the game has no game languages.
     */
    public function getGameLanguage(): ?int {
        $rawValue = $this->game->gamestate->table_globals[GAMESTATE_GAME_LANG] ?? null;
        return $rawValue === null ? null : (int)$rawValue;
    }
}
