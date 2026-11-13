<?php
declare(strict_types=1);

namespace Bga\GameFramework\GameResult;

enum AbandonReason: string
{
    case SYNCHRO_ERROR_CORRUPTED = 'synchro_error_corrupted'; // For technical reasons your table has been terminated. We apologize for the inconvenience and appreciate your understanding.
    case ABANDON_BY_DECISION = 'abandon_by_decision'; // Collective abandon
    case EXPRESS_STOP = 'express_stop'; // Dev studio action
    case DIDNTSTART_PLAYERS_LEFT = 'didntstart_players_left';
    case SYNCHRO_ERROR_FINISHED_ON_GS = 'synchro_error_finished_on_gs';
    case SYNCHRO_ERROR_NOT_ON_GS = 'synchro_error_not_on_gs';
    case ERROR_TOURNAMENT_WRONG_NUMBER = 'error_tournament_wrongnumber'; // Not the good number of players for this encounter => cancel it with immediate result
    case ABANDON_BY_TOURNAMENT_TIMEOUT = 'abandon_by_tournamenttimeout';
    case DIDNT_START_CRON_INIT_TIMEOUT = 'didntstart_cron_init_timeout';
    case DIDNT_START_CRON_TIMEOUT = 'didntstart_cron_timeout';
    case MATCHMAKING_PLAYER_CANCELED = 'matchmaking_player_canceled';
    case MATCHMAKING_OTHER_STARTED = 'matchmaking_other_started';
    case MATCHMAKING_PLAYER_OFFLINE = 'matchmaking_player_offline';
    case DIDNTPLAY_CRON_TIMEOUT = 'didntplay_cron_timeout';
    case NEUTRALIZED_AFTER_SKIPTURN = 'neutralized_after_skipturn';
    case NEUTRALIZED_AFTER_SKIPTURN_ERROR = 'neutralized_after_skipturn_error';
}