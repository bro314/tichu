<?php
declare(strict_types=1);

namespace Bga\GameFramework;

final class Logs {

    function __construct(
        private $game,
        private Bga $bga,
    ) {
    }

    /**
     * Returns the current move id, when doing an action, that should be stored along informations to undo.
     * 
     * @return int the current move id
     */
    function getCurrentMoveId(): int {
        return (int)$this->game->gamestate->table_globals[\GAMESTATE_NEXT_NOTIF_NO];
    }

    /**
     * Remove all logs from a move id that was stored during an action using `getCurrentMoveId()`.
     * The game should be in the exact same point as it was before the stored action.
     */
    function remove(int $startMoveId): void {
        $this->game->DbQuery("DELETE FROM `gamelog` WHERE `gamelog_move_id` >= $startMoveId");
        $this->bga->notify->doNotWriteNextNotificationsToDatabase = true;
        $this->bga->notify->all('bgaRemoveLogs', '', ['startMoveId' => $startMoveId]);
    }
}
