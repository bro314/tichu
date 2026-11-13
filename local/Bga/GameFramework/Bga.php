<?php
declare(strict_types=1);

namespace Bga\GameFramework;

/**
 * Object to regroup all framework subobjects.
 */
final class Bga {
    public Db\Globals $globals;
    public Notify $notify;
    public Logs $logs;
    public Legacy $legacy;
    public TableOptions $tableOptions;
    public UserPreferences $userPreferences;
    public TableStats $tableStats;
    public PlayerStats $playerStats;
    public Components\DeckFactory $deckFactory;
    public Debug $debug;

    function __construct(
        private $game,
        private $masterNodeRequestCallable,
    ) {
        $this->globals = new \Bga\GameFramework\Db\Globals();
        $this->notify = new \Bga\GameFramework\Notify($game);
        $this->logs = new \Bga\GameFramework\Logs($game, $this);
        $this->legacy = new \Bga\GameFramework\Legacy($game);
        $this->tableOptions = new \Bga\GameFramework\TableOptions($game);
        $this->userPreferences = new \Bga\GameFramework\UserPreferences();
        $this->tableStats = new \Bga\GameFramework\TableStats($game);
        $this->playerStats = new \Bga\GameFramework\PlayerStats($game);
        $this->deckFactory = new \Bga\GameFramework\Components\DeckFactory($game);
        $this->debug = new \Bga\GameFramework\Debug($game);
    }
}
