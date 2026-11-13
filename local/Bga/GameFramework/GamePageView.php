<?php
 /**
  * Base class for every game view of the game (complete static HTML/CSS/JS reset view)
  */
declare(strict_types=1);

namespace Bga\GameFramework;

use \BgaSystemException;

require_once( \APP_BASE_PATH.'view/common/ebg.view.php' );

class GamePageView extends \ebg_view
{
    #[\DI\Attribute\Inject]
    protected \Bga\GameFramework\Old\Db $db;
    #[\DI\Attribute\Inject]
    private \Bga\Tables\GameInfosManager $gameInfosManager;
    #[\DI\Attribute\Inject]
    protected \Bga\Config\ServerConfig $serverConfig;
    #[\DI\Attribute\Inject]
    private \Bga\Config\FeatureFlags $featureFlags;
    #[\DI\Attribute\Inject]
    private \Bga\Account\SessionManager $sessionManager;

    var /*string*/ $game_name;
    var $table_id;
    protected GamePage $gamePage;
    protected /*Table*/ $game;
    var $game_id;

    var $bIsSpectator = true;
    var $bArchiveMode = false;
    
    var /*array*/ $gamePageInfos = null;

    var $replaysavepoint_move_id;
    var $replay_from_this_situation;

    private array $bgaGameData = [
        'globalPreferences' => [],
        'userPreferences' => [],
        'tableOptions' => [],
        'menu' => [],
        'credits' => [
            'publishers' => [],
        ],
    ];
    private bool $recoveredCachedGamePageInfos = false;

    private static bool $isGeneratingBotArchiveSnapshots = false;

    /////////////////////
    // Translation system

    // Report gamename for translation function
    protected function getGameName() {
        if ($this->game_name !== null) {
            return $this->game_name;
        } else {
            return explode('_', $this->template_name)[0];
        }
    }

    // Translation function using appropriate gettext domain
    protected function _( $text ) {

        if( $text=='' )
            return '';  // Note: avoid void gettext ("display gettext info") bug
        else
        {
            return '@$to_translate_from$@'.$text.'@$to_translate_end$@';
            // Note: the markers above are replace with HTML in APP_template.inc.php
        }
    }

    /**
     * @return string[] the list of image filenames at the root of the img folder.
     */
    private function getPreloadedImages(): array
    {
        return $this->getPreloadableFiles(
            directory: 'img',
            preloadableExtensions: [
                'gif',
                'jpg',
                'png',
                // Note: SVG is intentionally excluded because it breaks Origin preloading.
            ],
            excludedFiles: [
                '.',
                '..',
                'game_icon.png',
                'game_banner.jpg',
                'game_banner500.jpg',
                'publisher.png',
                'publisher2.png',
            ],
            excludedPrefixes: [
                'game_display',
                'game_box',
            ],
        );
    }

    /**
     * @return array<string, string[]> Available formats for each sound at the root of the sounds folder.
     */
    private function getSoundFormats(): array
    {
        $soundFiles = $this->getPreloadableFiles(
            directory: 'sounds',
            preloadableExtensions: [
                'mp3',
                'ogg',
            ],
            excludedFiles: [
                '.',
                '..',
            ],
            excludedPrefixes: [],
        );

        $soundFormats = [];
        foreach ($soundFiles as $soundFile) {
            $soundName = pathinfo($soundFile, PATHINFO_FILENAME);
            $soundFormats[$soundName][] = pathinfo($soundFile, PATHINFO_EXTENSION);
        }

        return $soundFormats;
    }


    /**
     * @return string[] the list of font filenames at the root of the fonts folder.
     */
    private function getPreloadedFonts(): array
    {
        return $this->getPreloadableFiles(
            directory: 'fonts',
            preloadableExtensions: [
                'otf',
                'ttf',
                'woff',
                'woff2',
            ],
            excludedFiles: [
                '.',
                '..',
            ],
            excludedPrefixes: [],
        );
    }

    /**
     * @param string[] $preloadableExtensions
     * @param string[] $excludedFiles
     * @param string[] $excludedPrefixes
     * @param bool $stripExtension indicates if the extension should be removed from the filename
     * @return string[] list of files at the root of the directory
     */
    private function getPreloadableFiles(
        string $directory,
        array $preloadableExtensions,
        array $excludedFiles = [],
        array $excludedPrefixes = [],
        bool $stripExtension = false,
    ): array {
        $path = APP_GAMES_PATH . $this->game_name . "/current/{$directory}/";
        if (!is_dir($path)) {
            return [];
        }

        $handle = opendir($path);
        if ($handle === false) {
            return [];
        }

        $preloadableFiles = [];
        while (false !== ($filename = readdir($handle))) {
            if (in_array($filename, $excludedFiles, true)) {
                continue;
            }

            foreach ($excludedPrefixes as $excludedPrefix) {
                if (str_starts_with($filename, $excludedPrefix)) {
                    continue 2;
                }
            }

            $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            if ($extension === '' || !in_array($extension, $preloadableExtensions, true)) {
                continue;
            }

            $preloadableFiles[] = $stripExtension ? substr($filename, 0, -(strlen($extension) + 1)) : $filename;
        }

        closedir($handle);

        return $preloadableFiles;
    }

    ///////////////////////////////////
    // View generation main entry point

    function generate_content( $viewArgs )
    {
        self::trace( "Generate content of game view" );

        global $g_config, $bgaContainer;

        $o_gamemedia = $bgaContainer->get( "module.mainsite.gamemedia" );
                
        $this->bArchiveMode = $this->isArchiveMode();

        // Initialize game elements
        $this->table_id = $viewArgs['current_table'];
        self::set_game_name( $viewArgs['current_game_name'] );
        $this->gamePage = $bgaContainer->get(GamePage::class);
        $this->game = $this->gamePage->setup( $viewArgs['current_game_name'], (int) $this->table_id);

        self::setCanonicalUrlNoHash($viewArgs['current_game_name'].'?table='.$this->table_id);

        $this->tpl['BACK_TO_HOMEPAGE'] = _("Back to homepage");
        $this->tpl['REFRESH'] = _("Refresh");
        $this->tpl['LEAVE_THE_TABLE'] = _("Leave the table");

        $this->tpl['LOADING_SCREEN_DISPLAY'] = 'flex';
        $this->tpl['REPLAY_MASK_VISIBILITY'] =  'none';
        $this->tpl['LOADING_GAME'] = _("Opening the game box...");

        $this->tpl['BGAGAME_CLASS'] = 'bgagame-' . $viewArgs['current_game_name'];

        $this->tpl['CENTRIFUGE_CONFIGURATION'] = self::raw(json_encode($this->serverConfig->getCentrifugeConfiguration()));

        if( $g_config['dev_mode'])
        {
            // Note: development requires frequent refresh and loading screen is not needed (we are in local mode) so we do not enable it
         //   $this->tpl['LOADING_SCREEN_DISPLAY'] = 'none';
        }

        // Logo
        if( $g_config['external_site_logo'] !== null )
            $this->tpl['LOGO_URL'] = $g_config['external_site_logo'];
        else
            $this->tpl['LOGO_URL'] = getThemeUrl().'img/logo/logo.png';
        if( $g_config['external_site_logo_inprogress'] !== null )
            $this->tpl['LOGO_INPROGRESS_URL'] = $g_config['external_site_logo_inprogress'];
        else
            $this->tpl['LOGO_INPROGRESS_URL'] = getThemeUrl().'img/logo/waiting.apng';			

        $this->tpl['ARCHIVE_MODE'] = 'false';
        $this->bgaGameData['isArchiveMode'] = false;
        
        $this->tpl['ADDITIONAL_GLOBAL_CLASS'] .= ' game_interface';

        $currentPlayerId = (int)$this->sessionManager->getBgaUserId();
        $this->bgaGameData['currentPlayerId'] = $currentPlayerId;

        if( ! $this->bArchiveMode )
        {
            $this->game->setTable((int)$this->table_id, $this->game_name, (int)$viewArgs['current_game_id'] );

            $players = $this->game->bgaInternalLoadPlayersBasicInfos();

            $nextPlayer = $this->game->createNextPlayerTable(array_keys($players));
            $player_order = [];
            if (isset($players[$currentPlayerId])) {
                $this->bIsSpectator = false;

                // Is part of the game
                $player_order = [$currentPlayerId];
                $current_player = $currentPlayerId;
                $current_player = $nextPlayer[$current_player];
                while ($current_player != $currentPlayerId) {
                    $player_order[] = $current_player;
                    $current_player = $nextPlayer[$current_player];
                }
            } else {
                // Is a spectator
                $player_order = array_keys($players);
            }
            // Store the player order, starting with the current player (or first player if spectator)
            $this->bgaGameData['playerOrder'] = $player_order;

            if( !$this->bIsSpectator )
            {
                // Check if it's the first time we display the game (for gamearchive HTML output)
                $bFirstGameDisplay = $this->game->checkGameStart();

                if( $bFirstGameDisplay )
                {
                    $archive_dir = APP_DATA_PATH.'gamearchive/'.$this->table_id;
                    if (!file_exists($archive_dir)) {
                        // there can be concurrent access where all players trigger this code at the same time, 
                        // resulting in a mkdir warning (directory exists) even if we check it just before, so we add the @.
                        @mkdir($archive_dir);
                    }

                    $g_config['responsesaveoutput'] = $this->table_id."/".$this->table_id."_".$currentPlayerId;
                    $this->generateInitialBotArchiveSnapshots($players, $viewArgs, $currentPlayerId);
                }
            }

            if( isset( $viewArgs['replayLastTurn'] ) )
            {
                // Specific: replay from last move
                $viewArgs['replayFrom'] = self::getLastMoveOf( $viewArgs['replayLastTurnPlayer'], $viewArgs['replayLastTurn'] );
            }
        
            if( isset( $viewArgs['replayFrom'] )   )
            {
                // Specific: replay from a certain point
                
                // Check if current version = archive version, otherwise disable the function
                
                $replay_mode_selected = self::setReplayModeOn( $viewArgs );

                if( $replay_mode_selected == 'replay_from_start' )
                {
                    // We replay from start with the initial HTML archive
                    // => there is no need to generate any view here
                    // ==> stop there
                    return ;
                }
                else if( $replay_mode_selected == 'replay_from_savepoint' )
                {
                    // We can generate the view normally, except that all the Database
                    // calls will be redirected to "zz_replayXX" tables so that the view
                    // will be generated as it were at the savepoint.
                    $this->tpl['ARCHIVE_MODE'] = self::raw( 'false;globalThis.g_replayFrom = '.$viewArgs['replayFrom'] );
                    $this->tpl['REPLAY_MASK_VISIBILITY'] =  'block';
                }
                else if( $replay_mode_selected == 'replay_from_savepoint_table' )
                {
                    $this->tpl['ARCHIVE_MODE'] = self::raw( 'false;globalThis.g_replayFrom = '.$viewArgs['replayFrom'] );
                    $this->tpl['REPLAY_MASK_VISIBILITY'] =  'block';
                 
                    $this->replay_from_this_situation = $this->db->getUniqueValue( "SELECT rsp_gamedatas FROM replaysavepoint WHERE rsp_move_id='".$this->replaysavepoint_move_id."' AND rsp_player_id = $currentPlayerId " );

                    if( $this->replay_from_this_situation === null )
                        throw new \feException( "Error: cannot find any gamedatas for player $currentPlayerId for move ".$this->replaysavepoint_move_id );
                }                
                else
                {
                    // Problem during archive loading
                    // => jump to normal mode
                }
            }                


        }

        $this->tpl['GAMENAME_DISPLAYED'] = $viewArgs['current_game_name_displayed'];
        $this->bgaGameData['gameNameDisplayed'] = $viewArgs['current_game_name_displayed'];
        $this->game_id = $this->tpl['GAME_ID'] = $viewArgs['current_game_id'];
        $this->game_id = $this->tpl['THISGAME_ID'] = $viewArgs['current_game_id'];
        $this->tpl['PAGE_GLOBAL_TITLE'] = self::raw( $viewArgs['current_game_name_displayed'] );
        $this->tpl['PAGE_META_DESCRIPTION'] = sprintf(_('Play %s online from your browser with the whole world!'), $viewArgs['current_game_name_displayed'] );

        $this->tpl['CENTRIFUGE_CREDENTIALS'] = md5( 'bgacometd'.$currentPlayerId.$bgaContainer->get(\Bga\Config\SecretConfig::class)->getCentrifugeSecret() );

        $this->tpl['PREVIOUSLY_ON'] = _("Previously on").' '.$viewArgs['current_game_name_displayed'].' #'.$this->table_id.' ...';
        $this->tpl['SKIP_REPLAY'] = _("Skip last moves replay");
        $this->tpl['GAME_UPDATED_WARNING'] = _("This game has been updated since game start: thus the replay is EXPERIMENTAL.");

        $this->tpl['GO_TO_NEXT_TABLE'] = _("Go to next table");
        $this->tpl['AI_NOT_PLAYING'] = _("The bot is not playing... click here to relaunch it!");
        $this->tpl['SKIP_PLAYER_TURN'] = _("Skip turn of players out of time");

        $this->tpl['BACK_TO_TABLE_PAGE'] = _("Go back");
        $this->tpl['GAMESERVER_CONNECTION_LOADING'] = _("Connecting to your game...");
        
        if( $g_config['load_js_and_css_sources'] )
        {
            // Do not use studio_built (in case we modified something in gamegui, Stock...)
        }
        else
        {
            self::import_js('modules/layer/ly_studio' );
        }
        $this->tpl['GAME_BLOCKED_MESSAGE'] = self::raw( sprintf( _('The game is blocked ? Press F5 or %s'), '<a href="{CURRENT_GAME_URL}">'._('click here').'</a>' ) );

        $allImages = $this->getPreloadedImages();
        $soundFormats = $this->getSoundFormats();
        $allFonts = $this->getPreloadedFonts();

        if (!isset($this->tpl['PAGE_FACEBOOK_IMAGE'])) {
            $this->tpl['PAGE_FACEBOOK_IMAGE'] = $o_gamemedia->getMediaUrl($viewArgs['current_game_name'], 'box');
        }
        if (!isset($this->tpl['PAGE_META_IMAGE'])) {
            $this->tpl['PAGE_META_IMAGE'] = getThemeUrl() . 'img/logo/logo.png';
        }
        
        $game_version = getCurrentGameVersion( $viewArgs['current_game_name'] );
        $this->tpl['GAME_VERSION'] = $game_version;
        $this->tpl['ESMODULE'] = file_exists(APP_GAMES_PATH . $this->game_name . '/current/' . 'modules/js/Game.js') ? 'true' : 'false';
        $this->tpl['ADDITIONAL_PACKAGE'] = self::raw(',{
            name: "bgagame",
            location: "'.getThemeUrl( $viewArgs['current_game_name'] ).'"
        }');        
        $this->tpl['GAMETHEMEURL'] = getThemeUrl( $viewArgs['current_game_name'] );
        $this->tpl['IMGPRELOADING'] = self::raw(json_encode($allImages));
        $this->bgaGameData['preloadedSounds'] = array_keys($soundFormats);
        $this->bgaGameData['soundFormats'] = $soundFormats;
        $this->bgaGameData['preloadedFonts'] = $allFonts;

  	    $this->tpl['SERVICE_URL'] = getHttpOrHttps().'://'.$g_config['app_domain'].'/';

        // Send bot IDs to the metasite, which can read bot personality data.
        $botPlayerIds = array_keys(array_filter(
            $this->game->bgaInternalLoadPlayersBasicInfos(),
            static fn(array $player): bool => (int)$player['player_ai'] === 1,
        ));
        $this->recoveredCachedGamePageInfos = false;

        if( ! $this->bArchiveMode )
        {
            $players = $this->game->loadPlayersBasicInfos();
            $key_gamePageInfos = 'gamePageInfos_' .$this->table_id.'_'.$currentPlayerId;

            try 
            {
                // Get all needed informations from BGA Master node before refreshing
                $this->gamePageInfos = self::masterNodeRequest( 'getGenericGameinfos', array(
                    'table_id' => $this->table_id,
                    'player_ids' => array_keys( $players ),
                    'bot_player_ids' => $botPlayerIds,
                    'tags' => true,
                ) );

                // update game user preferences cache
                foreach ($this->gamePageInfos['gamepreferences'] as $prefId => $pref) {
                    if ($pref['value'] !== null) {
                        $this->game->userPreferences->updateCache($currentPlayerId, (int)$prefId, (int)$pref['value']);
                    }
                }
            
                // Cache players infos
                // TODO: we may want to store $this->gamePageInfos and not only players !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                apcu_store( 'players_infos_table_' . $this->table_id, $this->gamePageInfos['players'], 24*3600 ); // APCUREF:keep, only on game server

                // Now we also store everything, just in case of a MS failure
                apcu_store( $key_gamePageInfos, $this->gamePageInfos, 3600 ); // APCUREF:keep, to be reworked entirely
            }
            catch( \feException $e )
            {
                // MS gives an error
                // => try to recover from the error, to allow players to continue their game despite the MS outage
                if( $g_config['dev_mode'] )
                    throw $e;   //... except in dev mode, where we should display all errors

                $this->gamePageInfos = apcu_fetch( $key_gamePageInfos ); // APCUREF:keep, to be reworked entirely

                if( $this->gamePageInfos )
                {
                    // We can continue :)
                    $this->recoveredCachedGamePageInfos = true;
                }
                else
                    throw $e;
            }
    
        }
        else
        {
            // Get all needed informations from BGA Master node before refreshing
            $this->gamePageInfos = self::masterNodeRequest( 'getGenericGameinfos', array(
                'table_id' => $this->table_id,
                'archive' => true,
                'bot_player_ids' => $botPlayerIds,
                'tags' => true,
            ) );      
        }
        $this->tpl['LOADING_GAME_BOX_URL'] = $o_gamemedia->getBoxUrl((int)$viewArgs['current_game_id'], $viewArgs['current_game_name'], 280, $this->gamePageInfos['media'] ?? []);
        
        // Players metasite informations
        $this->tpl['PLAYERS_DATA'] = self::raw(  json_encode( $this->gamePageInfos['players'] ) );
        
        // RTC mode
        $this->tpl['RTC_MODE'] = $this->gamePageInfos['rtc_mode'];
        $this->tpl['RTC_ROOM'] = $this->gamePageInfos['rtc_room'];

        $this->tpl['BEFORE_PAGE_TITLE'] = '';

		// Zombieback
		$this->tpl['ZOMBIEBACK_DESCRIPTION'] = _("Your time to think has expired and all your turns are skipped.");
        $this->tpl['ZOMBIEBACK_BUTTON'] = _("Get back in the game");

        $this->tpl['GAME_IS_ALPHA'] = $this->gamePageInfos['public_alpha_game'] ? 'true': 'false';
        $this->tpl['GAME_STATUS'] = $this->gamePageInfos['game_status'];
        $this->tpl['GAME_GROUP'] = $this->gamePageInfos['game_group'];

        $this->tpl['GAME_KEEP_RANKING_ON_PLAYER_QUIT'] = $this->gamePageInfos['keep_ranking_on_player_quit'] ? 'true' : 'false';

        // Media chat evaluation: should this player evaluate the audio video chat if they use it?
        $this->tpl['MEDIA_CHAT_RATING'] = isset($_SESSION['forceMediaChatRating']) && $_SESSION['forceMediaChatRating'] ? 'true' : ($this->gamePageInfos['must_rate_media_chat'] ? 'true' : 'false');
        
        // Is there another table in arena that this player **have** to play for (prevent cheating) ?
        // If so, show an invasive banner "You should play on this other table first", and an overlay to prevent playing.
        $tableToPlayId = $this->gamePageInfos['table_to_play_id'] ?? null;
        $currentPlayerId = $this->sessionManager->getBgaUserId();
        $currentPlayerStatus = $this->gamePageInfos['players_statuses'][$currentPlayerId]['status'] ?? null;

        // Don't show the banner if this table is the table to play, or if the player is not playing.
        if (
            $tableToPlayId !== null &&
            $tableToPlayId != $this->table_id &&
            in_array($currentPlayerStatus, ['play', 'playasync'])
        ) {
            $url_game = self::getMasterNodeUrl() . "/tableview?table={$tableToPlayId}";
            $this->bgaGameData['arenaTableToPlayUrl'] = $url_game;
        }

        // Arena near end
        if( isset( $this->gamePageInfos['arena_near_end']))
        {
            $arena_season = $this->gamePageInfos['arena_near_end']; // only sent if the table is an arena one
            if (isset($arena_season['end'])) {
                $arena_season['end'] = gmdate(DATE_ATOM, (int) $arena_season['end']);
            }
            $this->bgaGameData['arenaNearEndSeason'] = $arena_season;      
        }
        
        // Generate view template (action to do before content generation)
        self::pre_generate( $viewArgs );

        // Generate right panel, with players boards
        self::build_rightpanel( $viewArgs );

        // Generation content (page specific)
        $viewArgs['gamepreferences'] = $this->gamePageInfos['gamepreferences'];

        $gameView = $this->getGameView($this->game_name);
        if ($gameView !== null) {
            \Bga\GameFramework\Table::runGameCode($this->game_name, fn() => $gameView->build_page($viewArgs));
            $this->tpl = array_merge($this->tpl, $gameView->tpl);
        }
        
        $this->page->insert_block( 'noindex_directive', []);

        $this->bgaGameData['gameserverId'] = $g_config['cluster_gameserver_id'] ?? '';
        $this->bgaGameData['gamename'] = $this->game_name;
        $this->bgaGameData['tableId'] = $this->table_id;

        // Generate view template (action to do after content generation)
        $this->post_generate( $viewArgs );        
    }

    protected function set_game_name( $name )
    {
        $this->game_name = $name;

        // Modular game CSS

        $relativePath = file_exists(APP_GAMES_PATH . $this->game_name . '/current/' . 'modules/css/Game.css') ? 
            'modules/css/Game.css' : 
            $this->game_name.'.css';

		$this->import_css_absolute(getThemeUrl( $this->game_name ).$relativePath);

        $this->tpl['GAMENAME'] = $name;
    }
    
    protected function isArchiveMode()
    {
        return false;
    }

    protected function isRealtimeTable(): bool {
        return $this->gamePage->isRealtimeTable();
    }

    /**
     * Generate the initial replay snapshot for every AI seat.
     *
     * Archive HTML is normally written when a player first opens the game page.
     * Bots do not open that page themselves, so without these renders no archive
     * exists for their viewpoint. This only runs while the first human page is
     * being generated, before any move can reveal information.
     *
     * @param array<int, array{player_ai: string|int}> $players
     * @param array<string, mixed> $viewArgs
     */
    private function generateInitialBotArchiveSnapshots(array $players, array $viewArgs, int $currentPlayerId): void
    {
        global $g_config, $bgaContainer;

        /** This guard will protect against recursive archive generation since we are instanciatig a GamePageView to
         *  build the archive.  This is a poor design that we should live with.  */
        if (self::$isGeneratingBotArchiveSnapshots) {
            return;
        }

        $botPlayerIds = array_keys(array_filter(
            $players,
            static fn(array $player): bool => (int) $player['player_ai'] === 1,
        ));
        if ($botPlayerIds === []) {
            return;
        }

        self::$isGeneratingBotArchiveSnapshots = true;
        try {
            foreach ($botPlayerIds as $botPlayerId) {
                $this->sessionManager->setTemporaryMasquerade((int) $botPlayerId);
                try {
                    $template = $bgaContainer->make(\APP_Template::class);
                    if (!$template->load_tpl($this->template_name)) {
                        throw new \BgaSystemException("Unable to load game template {$this->template_name}");
                    }

                    $botView = $bgaContainer->make(self::class, [
                        'template_object' => $template,
                        'main_template_name' => $this->template_name,
                    ]);
                    $botView->generate($viewArgs);
                    $template->display(
                        $botView->getTemplateDatas(),
                        $this->template_name,
                        $this->table_id . '/' . $this->table_id . '_' . $botPlayerId,
                        true,
                    );
                } finally {
                    $this->sessionManager->setTemporaryMasquerade($currentPlayerId);
                }
            }
        } finally {
            self::$isGeneratingBotArchiveSnapshots = false;
            $g_config['responsesaveoutput'] = $this->table_id . '/' . $this->table_id . '_' . $currentPlayerId;
        }
    }


////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////   View template generation ///////////////////////////////////////////////////////////



    private function pre_generate( $viewArgs )
    {
		global $g_config;

 		$this->page->load_tpl( "overall_game_header" );
		$this->page->load_tpl( "overall_game_footer" );

		if($this->serverConfig->areGameDebugToolsEnabled()) {
            $this->bgaGameData['debugFunctions'] = $this->gamePage->getGameDebugFunctions();
            $this->bgaGameData['displayDebug'] = [
                'dbAdminUrl' => $g_config['db_admin_url'].'/index.php?db=ebd_'.$this->game_name.'_'.$this->table_id,
            ];
        }

        // Disabling cookie consent during game (only for metasite)
        $this->tpl['COOKIE_CONSENT_ENABLED'] = 'false';

        // BGA CSS
        self::import_css( 'common' );
        self::import_css( 'gameserver' );
    }

    private function post_generate( $viewArgs )
    {
        global $g_config;

        // Disabling Google automatic translation of the page, as this is causing some additional <font> content
        // that may break some game JS (or replays)
        $this->tpl['ADDITIONAL_HTML_PARAMETERS'] = self::raw('class="notranslate" translate="no" ');
        $this->tpl['ADDITIONAL_META'] = self::raw('<meta name="google" content="notranslate" /> ');
        
        if( ! $this->bArchiveMode  )
        {
            if( isset( $this->replay_from_this_situation ) )
            {
                // "replay from this point" case
                $datas = json_decode( $this->replay_from_this_situation, true );
                $this->tpl['GAMEDATAS'] = self::raw( $this->replay_from_this_situation );
            }
            else
            {
                // Standard case
		        $datas = $this->gamePage->getAllTableDatas();
                // integrate the player avatars in the gamedatas from $this->gamePageInfos
                if (isset($datas['players'])) {
                    foreach($this->gamePageInfos['players'] as $playerId => $player) {
                        if ($datas['players'][$playerId]) {
                            $datas['players'][$playerId]['avatar'] = $player['avatar'];
                        }
                    }
                }
    		    $this->tpl['GAMEDATAS'] = self::raw(  json_encode( $datas ) );
		    }

            if( ! isset( $viewArgs['replayFrom'] ) )
            {

                if( ( isset( $datas['gamestate']['name'] ) && $datas['gamestate']['name'] != 'gameEnd' )
                 || ( isset( $datas['gamestate']['id'] ) && $datas['gamestate']['id'] != 99 ) )
                {            
                    // Check players coherent with MS
                    $players = $this->game->loadPlayersBasicInfos();
                    self::watch( "players", $players );


                    if( count( $this->gamePageInfos[ 'players_at_table' ] ) != count( $players ) )
                    {
                        global $g_trace; $g_trace->troubleshoot_log( "Player count at table ".$this->table_id. " is different on the MS (".count( $this->gamePageInfos[ 'players_at_table' ] ).") and on the GS (".count( $players ).")" );
                        $this->tpl['BEFORE_PAGE_TITLE'] = self::raw( "<div class='whiteblock'><b>WARNING: the number of players at this table (".count( $players ).") is not coherent with the number of players as known by BGA (".count( $this->gamePageInfos[ 'players_at_table' ] )."). We recommend you to abandon this table and report this as a website bug!</b></div>");
                    }
                    else
                    {
                        foreach( $this->gamePageInfos[ 'players_at_table' ] as $player_at_table_id )
                        {
                            if( ! isset( $players[ $player_at_table_id ] ) )
                            {
                                global $g_trace; $g_trace->troubleshoot_log( "Player $player_at_table_id status at table ".$this->table_id. " is at the table on the MS but not on the GS" );
                                $this->tpl['BEFORE_PAGE_TITLE'] = self::raw( "<div class='whiteblock'><b>WARNING: some players at this table are not coherent with the players known by BGA (e.g. player $player_at_table_id). We recommend you to abandon this table and report this as a website bug!</b></div>");
                                break;
                            }
                            else if( $this->gamePageInfos[ 'players_statuses' ][ $player_at_table_id ]['status'] == 'eliminated' && $players[ $player_at_table_id ]['player_eliminated'] == 0 )
                            {
                                global $g_trace; $g_trace->troubleshoot_log( "Player $player_at_table_id status at table ".$this->table_id. " is eliminated on the MS but not on the GS" );
                                $this->tpl['BEFORE_PAGE_TITLE'] = self::raw( "<div class='whiteblock'><b>WARNING: the status of players eliminated at this table is not coherent with the status known by BGA (e.g. for player $player_at_table_id). We recommend you to abandon this table and report this as a website bug!</b></div>");
                                break;
                            }
                            // No warning for zombies as it's a legit case if the player choses to re-join a game
                        }
                    }
                }
            }
        }
        else
        {
            $this->tpl['GAMEDATAS'] = "''";
        }
        
		$this->tpl['TABLE_ID'] = $this->table_id;

        $this->tpl['LB_REMAINING_REFLEXION_TIME'] = _('LB_REMAINING_REFLEXION_TIME');
        $this->tpl['LB_EXPEL_PLAYER_OVER_TIME_LIMIT'] = _('LB_EXPEL_PLAYER_OVER_TIME_LIMIT');
        $this->tpl['LB_LOGS_HAS_BEEN_DETACHED'] = _('LB_LOGS_HAS_BEEN_DETACHED');
        $this->tpl['LB_REATTACHED_LOGS'] = _('LB_REATTACHED_LOGS');
        $this->tpl['LB_VIEW_NEXT_MOVE'] = _('LB_VIEW_NEXT_MOVE');
        $this->tpl['LB_APPLICATION_LOADING'] = _('LB_APPLICATION_LOADING');
        $this->tpl['LB_YES'] = _('LB_YES');
        $this->tpl['LB_NO'] = _('LB_NO');
        $this->tpl['LB_PENDING'] = _('LB_PENDING');
        $this->tpl['LB_TIMOUT'] = _('LB_TIMOUT');
        $this->tpl['LB_OFFLINE'] = _('LB_OFFLINE');
        $this->tpl['LB_I_WOULD_LIKE_TO_THINK_A_LITTLE_THANKYOU'] = _('I would like to think a little, thank you');
        $this->tpl['CURRENT_GAME_URL'] = self::raw( '/'.$this->game_name.'?table='.$this->table_id );


        $this->tpl['VERSION_DISPLAY'] = '';
        $this->tpl['VERSION_ICON'] = '';
        $this->tpl['JUSTIFY_TOPBAR_CONTENT'] = '';
        $this->tpl['VERSION_LABEL'] = '';
        $this->tpl['VERSION_TITLE'] = '' ;
        $this->tpl['VERSION_DESCRIPTION'] = ''; 
        $this->tpl['VERSION_DESCRIPTION_MORE'] = ''; 
        $this->tpl['VERSION_GRADIENT_CLASS'] = ''; 

        if(in_array($this->gamePageInfos['game_status'], ['private_alpha', 'alpha']) && !$this->bArchiveMode){
            $this->tpl['VERSION_LABEL'] = 'ALPHA';
            $this->tpl['VERSION_TITLE'] = _('ALPHA version'); 
            $this->tpl['VERSION_DESCRIPTION'] = _('As this is an early version of the game, you agree not to share information about it.'); 
            $this->tpl['VERSION_DESCRIPTION_MORE'] = _('More'); 
            $this->tpl['VERSION_ICON'] = self::raw('<img src="'.getThemeUrl().'img/common/svg/gameitem/alphaIcon.svg" class="h-full" alt="'.$this->tpl['VERSION_TITLE'].'"></img>');
            $this->tpl['VERSION_GRADIENT_CLASS'] = $this->gamePageInfos['game_status'] == 'private_alpha' ? 'private-alpha-banner__gradient' : 'alpha-banner__gradient'; 
        } else if($this->gamePageInfos['game_status'] == 'beta' && !$this->bArchiveMode){
            $this->tpl['VERSION_LABEL'] = 'BETA';
            $this->tpl['VERSION_TITLE'] = _('BETA version'); 
            $this->tpl['VERSION_DESCRIPTION'] = _('As this is an early version of the game, you agree that bugs can still occur.'); 
            $this->tpl['VERSION_DESCRIPTION_MORE'] = _('More'); 
            $this->tpl['VERSION_ICON'] = self::raw('<img src="'.getThemeUrl().'img/common/svg/gameitem/betaIcon.svg" class="h-full" alt="'.$this->tpl['VERSION_TITLE'].'"></img>');
            $this->tpl['VERSION_GRADIENT_CLASS'] = 'beta-banner__gradient'; 
        } else {
            $this->tpl['JUSTIFY_TOPBAR_CONTENT'] = 'justify-center'; 
            $this->tpl['VERSION_DISPLAY'] = 'hide-banner hidden'; 
        }
        
        $this->tpl['LB_TABLE'] = _('LB_TABLE');
        $this->tpl['LB_MOVE'] = _('LB_MOVE');
        
        $this->tpl['LB_WHO_ARE_WE'] = _('LB_WHO_ARE_WE');
        $this->tpl['LB_CONTACT_US'] = _('LB_CONTACT_US');
        
        $this->tpl['MUTE_SOUND'] = $this->gamePageInfos['preference']['general']['muteSound']==0 ? 'false' : 'true';
        $this->tpl['SOUNDMODE'] = $this->gamePageInfos['preference']['general']['soundMode'];
        $this->tpl['SOUND_VOLUME'] = round($this->gamePageInfos['preference']['general']['soundVolume'] / 100, 2);
        $this->tpl['SOUNDS_LIST'] = self::raw( json_encode( $this->gamePageInfos['preference']['soundlist'] ) );

        if( $this->gamePageInfos['preference']['general']['displayClubBanner'] == false )
            $this->tpl['ADDITIONAL_GLOBAL_CLASS'].= ' dontdisplaycm ';

        $this->tpl['IS_COOP'] = $this->gamePageInfos['is_coop'] ? 'true':'false';
        $this->tpl['IS_SOLO'] = $this->game->isSoloGame() ? 'true' : 'false';   // Note: time is disabled for solo game
        $this->tpl['ACTIVE_EVENTS'] = $g_config['active_event_system'] ? 'true':'false';


        $this->tpl['GAME_RESULTS'] = _("Game results");
        $this->tpl['FINAL_SITUATION'] = _("Final situation");

        $players = $this->game->loadPlayersBasicInfos();

        if( isset( $g_config['moderator_can_determine_gameresult'] ) && $g_config['moderator_can_determine_gameresult'] && !$this->bArchiveMode )
        {
            if( $this->gamePageInfos['currentplayerinfos']['grade'] >= 4 )
            {

                // This is a moderator !
                $html = '<div class="whiteblock"><h3>Judge decision</h3>';
                foreach( $players as $thisplayer_id => $thisplayer )
                {
                    $html .= '<span id="judgegivevictory_'.$thisplayer_id.'" class="judgegivevictory bgabutton bgabutton_blue">'._("Give victory to").' '.$thisplayer['player_name'].'</span> &nbsp; ';
                }
                $html .= '<span id="judgegivevictory_0" class="judgegivevictory bgabutton bgabutton_blue">'._("Draw").'</span> ';
                $html .= '</div>';
                $this->tpl['BEFORE_PAGE_TITLE'] = self::raw( $html );
            }            
        }

        $css_code = $this->gamePageInfos['custom_css'];        
        if( $css_code !== null && $css_code != '' )
        {        
            $this->tpl['CUSTOM_CSS'] = self::raw( '<link rel="stylesheet" type="text/css" href="'.self::getMasterNodeUrl().'/player/customcss"/>' );
        }

        $this->setLockScreen();

        $this->tpl['MSLOBBY'] = $this->gamePageInfos['lobby'];

        $this->bgaGameData['isVisitor'] = $this->sessionManager->isCurrentUserVisitor();
        $this->bgaGameData['isSpectator'] = $this->bIsSpectator;
        $rawPlayers = $this->game->loadPlayersBasicInfos();
        $internalPlayers = $this->game->bgaInternalLoadPlayersBasicInfos();
        usort($rawPlayers, fn($a, $b) => (int)$a['player_no'] <=> (int)$b['player_no']);
        $this->bgaGameData['players'] = [];
        foreach ($rawPlayers as $rawPlayer) {
            $playerId = (int)$rawPlayer['player_id'];
            $playerData = [
                'id' => $playerId,
                'no' => (int)$rawPlayer['player_no'],
                'isBot' => (bool)$internalPlayers[$playerId]['player_ai'],
            ];
            if ($playerData['isBot']) {
                $botDisplayData = $this->gamePageInfos['bot_display_data'][$playerId] ?? null;
                if ($botDisplayData === null && $this->recoveredCachedGamePageInfos) {
                    // Older cached responses have no bot display data; keep the game page available during a metasite outage.
                    $botDisplayData = [
                        'name' => $rawPlayer['player_name'],
                        'avatarUrl' => '/theme/img/common/bot-avatar-0.png',
                    ];
                }
                if ($botDisplayData !== null) {
                    $playerData['botDisplayName'] = $botDisplayData['name'];
                    $playerData['avatarUrl'] = $botDisplayData['avatarUrl'];
                }
            }
            $this->bgaGameData['players'][] = $playerData;
        }
        $this->tpl['BGAGAMEDATA'] = $this->raw(json_encode($this->bgaGameData));

		$this->page->parse("OVERALL_GAME_HEADER", "overall_game_header");
		$this->page->parse("OVERALL_GAME_FOOTER", "overall_game_footer");
    }

    private function setLockScreen() {
        global $g_config, $bgaContainer;


        $o_player = $bgaContainer->get( "module.player.player" );
        $o_gamemedia = $bgaContainer->get( "module.mainsite.gamemedia" );
        
        $player = $o_player->get( $this->sessionManager->getBgaUserId() );

        $locking_time = isset($this->game->gamestate->table_globals[GAMESTATE_LOCK_TIMESTAMP]) ? 
            ($this->game->gamestate->table_globals[GAMESTATE_LOCK_TIMESTAMP] - time() + 1) : // Note : +1 otherwise the clients launch the timer too early
            0;

        // Get user country & exchange rate
        $currency = '';
        $country = \Locale::getCountryInfos( $player['country'] );
        
        if( isset( $g_config['price_structure']['currencies'][ strtolower( $country['cur'] ) ] ) ) {
            // This player is from a country with a supported currency :)
            $currency = strtolower( $country['cur'] );
        } else {
            $currency = 'eur';  // Otherwise, switch to EURO // TODO: find the best currency for each country
        }
        $premiumGames = [];
        foreach ([['games', false], ['expansions', true]] as [$premiumGamesType, $isExpansion]) {
            foreach ($this->gamePageInfos['premiumgames'][$premiumGamesType] as $premiumGamesRaw) {
                $premiumGames[] = [
                    'id' => $premiumGamesRaw['id'],
                    'name' => $premiumGamesRaw['name'],
                    'nameDisplayed' => getGameNameDisplayed($premiumGamesRaw['name']),
                    'boxUrl' => $o_gamemedia->getBoxUrl($premiumGamesRaw['id'], $premiumGamesRaw['name'], 180),
                    'expansion' => $isExpansion,
                ];
            }
        }
        $paymentMethodSet = $g_config['payment_method'] == 'paypal' || $g_config['payment_method'] == 'wechat' || $g_config['payment_method'] == 'ideal' ;
        $discount_rate = round( 100-( 100*$g_config['price_structure']['plans'][$currency][12]['price'] / $g_config['price_structure']['plans'][$currency][1]['price'] ) );
        
        $this->bgaGameData['lockScreen'] = [
            'lockingTime' => $locking_time,
            'prices' => [
                [
                    'discountRate' => $discount_rate,
                    'monthNumber' => $paymentMethodSet ? 12 : _("Yearly"),
                    'monthSubline' => $paymentMethodSet ? _('months') : '',
                    'price' => $g_config['price_structure']['plans'][$currency][12]['price'],
                    'months' => 12,
                ],
                [
                    'discountRate' => null,
                    'monthNumber' => $paymentMethodSet ? 2 : _("Monthly"),
                    'monthSubline' => $paymentMethodSet ? _('months') : '',
                    'price' => $g_config['price_structure']['plans'][$currency][1]['price'],
                    'months' => 2,
                ],
            ],
            'currencySymbol' => $g_config['price_structure']['currencies'][$currency]['symbol'],
            'currentPlayerPremium' => $player['is_premium'] == 1,
            'premiumGames' => $premiumGames,
        ];
    }

    private function build_rightpanel( $viewArgs ) {
        global $g_config, $bgaContainer;
        
        // Buy game
        $this->tpl['BUYLINKID'] = self::raw( $this->gamePageInfos['BUYLINKID'] );
        $this->tpl['BUYLINKDOMAIN'] = $this->gamePageInfos['BUYLINKDOMAIN'];
        $this->tpl['BUY_GAME_DISPLAY'] = ($this->gamePageInfos['BUYLINKID'] == null ? 'none' : 'inline-block');
        $this->tpl['BUY_THIS_GAME'] = _("Buy this game");
        $this->bgaGameData['buyThisGame'] = [
            'link' => $this->gamePageInfos['BUYLINKID'],
            'label' => $this->gamePageInfos['BUYLINKDOMAIN'],
        ];

        // Rankings
        $game_hide_ranking = $this->gamePageInfos['game_hide_ranking'] == 1;
        $this->bgaGameData['showRanking'] = !$game_hide_ranking;

        // User preferences for this game
        $this->tpl['PREFERENCES_VALUES'] = self::raw( json_encode( $this->gamePageInfos['gamepreferences'] ) );

        // At first, preferences global to all games
        $globalPref = array(
            'logsSecondColumn' => array(
                'name' => _("Display game logs"),
                'value' => $this->gamePageInfos['preference']['general'][ 'logsSecondColumn' ],
                'values' => array(
                   0 => array( 'name' => _('Below player panels' ) ),
                   1 => array( 'name' => _('On a second column') )
                ),
            ),
     //       'showOpponentCursor' => array(
     //           'name' => _("Show my mouse cursor to opponents"),
     //           'value' => $this->gamePageInfos['preference']['general'][ 'showOpponentCursor' ],
     //           'values' => array(
     //              0 => array( 'name' => _('Yes' ) ),
     //              1 => array( 'name' => _('No (but you will not see your opponent cursors)') )
     //           )
     //       )
        );
        foreach( $globalPref as $pref_id => $pref ) {
            $frontValues = [];
            
            foreach( $pref['values'] as $value_id => $value ) {
                $frontValues[] = [
                    'label' => $value['name'],
                    'value' => (int)$value_id,
                ];
            }

            $this->bgaGameData['globalPreferences'][] = [
                'id' => $pref_id, // a string, not a number!
                'name' => $pref['name'],
                'value' => (int)$pref['value'],
                'options' => $frontValues,
            ];
        }
        
        // Then, preferences for this specific game
        foreach( $this->gamePageInfos['gamepreferences'] as $pref_id => $pref ) {
            $frontValues = [];
            
            foreach( $pref['values'] as $value_id => $value ) {
                $frontValues[] = [
                    'label' => $value['name'],
                    'value' => (int)$value_id,
                    'cssPref' => $value['cssPref'] ?? null,
                ];
            }

            $this->bgaGameData['userPreferences'][] = [
                'id' => (int)$pref_id,
                'name' => $pref['name'],
                'value' => (int)$pref['value'],
                'options' => $frontValues,
            ];
        }
        
        // game options on premium panel
        if( ! $this->bArchiveMode )
        {
            $gameoptions = $this->game->getTableOptions();
            foreach( $gameoptions as $gameoption_id => $gameoption )
            {
                if( isset( $this->game->gamestate->table_globals[ $gameoption_id ] ) )
                {
                    $int_value = $this->game->gamestate->table_globals[ $gameoption_id ];
                    if( isset( $gameoption['values'][ $int_value ] ) )
                    {
                        $additional_description = '';
                    
                        if( $gameoption_id == 200 ) // Time profile
                        {
                            if( $int_value == 20 || $int_value == 9 )
                            {   // No time limit
                                $this->tpl['ADDITIONAL_GLOBAL_CLASS'] .= ' no_time_limit';
                            }
                            else
                            {
                                // Add corresponding time profile
                                $time_string = _('${initial_time} + ${additional_time} / turn');
                                $time_string = str_replace( '${initial_time}', '<span class="reftime_format">'.$this->game->getGameStateValue(GAME_GLOBAL_INITIAL_REFLEXION_TIME).'</span>', $time_string );
                                $time_string = str_replace( '${additional_time}', '<span class="reftime_format">'.$this->game->getGameStateValue(GAME_GLOBAL_ADDITIONAL_REFLEXION_TIME).'</span>', $time_string );
                                
                                $additional_description = ' ('.$time_string.')';
                            }
                        }

                        if( $gameoption_id == 201 ) // Game mode
                        {
                            if( $int_value == 1 )
                                $this->tpl['ADDITIONAL_GLOBAL_CLASS'] .= ' training_mode';
                            else if( $int_value == 2 )
                                $this->tpl['ADDITIONAL_GLOBAL_CLASS'] .= ' arena_mode';

                        }

                        $this->bgaGameData['tableOptions'][] = [
                            "id" => $gameoption_id,
                            "name" => $gameoption['name'],
                            "value" => (int)$int_value,
                            "valueLabel" => $gameoption['values'][ $int_value ]['name'].$additional_description
                        ];
                    }
                }
            }
        }
        
        // Realtime/async
        $bRealtime = $this->isRealtimeTable();
        $this->bgaGameData['isRealTime'] = $bRealtime;
        $this->bgaGameData['gameVersion'] = $this->game->tableOptions->getGameVersion();
        $this->tpl['REALTIME_MODE'] = $bRealtime ? 1 : 0;
        if( $bRealtime )
            $this->tpl['ADDITIONAL_GLOBAL_CLASS'] .= ' playmode_realtime';
        else
            $this->tpl['ADDITIONAL_GLOBAL_CLASS'] .= ' playmode_turnbased';

        $this->tpl['ADDITIONAL_GLOBAL_CLASS'] .= ' desktop_version ';

        // $this->tpl['ADDITIONAL_GLOBAL_CLASS'] .= ' new_gameux ';


		$this->tpl['LB_GAME_PROGRESSION'] = _('Progression');
        $this->tpl['LB_THIS_PLAYER_IS_NOT_PLAYING_WHAT_TO_DO'] = _('LB_THIS_PLAYER_IS_NOT_PLAYING_WHAT_TO_DO');

        $currentPlayerId = (int)$this->sessionManager->getBgaUserId();
        $this->tpl['CURRENT_PLAYER_ID'] = $currentPlayerId;

        $this->tpl['DECISIONSTATUS'] = self::raw( json_encode( $this->gamePageInfos['decision'] ) );
        
        
        // Publishers banners
        $this->page->begin_block( "overall_game_footer", "annoucement" );
        $o_utils = $bgaContainer->get( "module.website.utilities" );
        $no = 0;
        foreach( $this->gamePageInfos['pubbanners'] as $banner_id => $banner )
        {

            $html = $o_utils->getBannerHtmlFromInfos( $banner['id'], $banner['type'], '', $banner['url'] );
            $this->page->insert_block( "annoucement", array(
                "NO" =>$no,
                "BANNER" => self::raw( $html )
            ) );
            
            $no++;
        }

        $masterNodeUrl = $this->getMasterNodeUrl();

        // Spectator warning block
        if( $this->bIsSpectator && !$this->bArchiveMode )
        {
            $tpl = array();
            if( $this->sessionManager->isCurrentUserVisitor() )
            {                
                $tpl['LOGIN_INFOS'] = _('LB_LOG_IN');
                $tpl['LOGIN_URL'] = $masterNodeUrl.'/account';
                $this->tpl['CURRENT_PLAYER_NAME'] = "Visitor".$currentPlayerId;
            }
            else           
            {
	            $o_player = $bgaContainer->get( "module.player.player" );
	            $user = $o_player->get($currentPlayerId);
            
                $tpl['LOGIN_INFOS'] = $user['fullname'];
                $tpl['LOGIN_URL'] = $masterNodeUrl.'/player?id='.$currentPlayerId;
                $this->tpl['CURRENT_PLAYER_NAME'] = $user['fullname'];
            }
        }
        
        if( $this->sessionManager->isCurrentUserVisitor() )
        {
	        $this->tpl['CONNECT_HREF'] = "/player/login";
	        $this->tpl['CONNECT_DISCONNECT'] = _('Connect');
	        $this->tpl['DISCONNECT_VISIBILITY'] = 'none';
	        $this->tpl['DISCONNECT_VVISIBILITY'] = 'hidden';
	        $this->tpl['CONNECT_VISIBILITY'] = 'inline';
	        $this->tpl['CURRENT_PLAYER_NAME'] = "Visitor".$currentPlayerId;  
	        $this->tpl['TUTORIAL'] = 'false';
        }
        else
        {
            $o_player = $bgaContainer->get( "module.player.player" );
            $user = $o_player->get($currentPlayerId);

	        $this->tpl['CONNECT_HREF'] = "/player/login/logout.html";
	        $this->tpl['CONNECT_DISCONNECT'] = _('Disconnect');
	        $this->tpl['DISCONNECT_VISIBILITY'] = 'inline';
	        $this->tpl['DISCONNECT_VISIBILITY'] = 'visible';
	        $this->tpl['CONNECT_VISIBILITY'] = 'none';
	        $this->tpl['CURRENT_PLAYER_NAME'] = $user['fullname'];        
            $this->tpl['TUTORIAL'] = ( $user['tutorial_active']==1 ) ? 'true' : 'false';
        }

        
        
        if( isset( $_SESSION['tutorial_shown'] ) )
        {
            // Tutorial has been shown already during this session => don't show it twice
            $this->tpl['TUTORIAL'] = 'false';
        }
        
        $this->page->begin_block( 'overall_game_footer', 'tutorial' );
        if( $this->tpl['TUTORIAL']=='true' )
        {
          //  $this->page->insert_block( 'tutorial', array(
          //      'TUTO_TEXT1' => _('Status bar: The next game action to do is always displayed here'),
          //      'TUTO_TEXT2' => _('Players panels: displays infos about players. Hourglass = current player.'),
          //      'TUTO_TEXT3' => _('In the gamelog right there, you can follow what happened in the game during the last moves.'),
          //      'TUTO_TEXT4' => _('You may scroll to see the whole game, game help and options.'),
          //      'OK_GO_TO_GAME' => _("Allright, let's play!")
          //  ) );
            $_SESSION['tutorial_shown'] = true;
            $_SESSION['tutorial_shown'] = false;    // UPDATE: disable tutorial during game
        }

        // BGA metasite tutorial (controls by showTutorialOnce (100% distinct from a specific game tutorial)
        $bga_metasite_tutorial_seen = beginnerHexStringToArray( 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' );    // See everything
        if( ! $this->sessionManager->isCurrentUserVisitor() )
        {
            if( isset( $this->gamePageInfos['players'][$currentPlayerId]['tutorial_seen'] ) )
                $bga_metasite_tutorial_seen = beginnerHexStringToArray( $this->gamePageInfos['players'][$currentPlayerId]['tutorial_seen'] );
        }
        $this->tpl['METASITETUTORIAL_SEEN'] = self::raw( json_encode( $bga_metasite_tutorial_seen ) );
            
        $this->tpl['METASITEURL'] = $masterNodeUrl;
        $this->bgaGameData['metasiteUrl'] = $masterNodeUrl;
        $this->tpl['GAMESERVER_ID'] = $g_config['cluster_gameserver_id'] ?? '';
        $this->tpl['SERVER_ID'] = 'N/A';
        $this->tpl['LB_HELP'] = _("Help");
        $this->tpl['LB_LOG_IN'] = _("LB_LOG_IN");
        $this->tpl['ITS_YOUR_TURN'] = _("It's your turn!");
        
        $gameinfos = $this->gameInfosManager->get( $this->game_name );
        if( isset( $gameinfos['tie_breaker_description'] ) && $gameinfos['tie_breaker_description'] != '' )
            $this->tpl['TIEBREAKER'] = $gameinfos['tie_breaker_description'];
        else
            $this->tpl['TIEBREAKER'] = '';

        if( isset( $gameinfos['tie_breaker_split'] ) && $gameinfos['tie_breaker_split'] != '' )
            $this->tpl['TIEBREAKERSPLIT'] = self::raw( json_encode( $gameinfos['tie_breaker_split'] ) );
        else
            $this->tpl['TIEBREAKERSPLIT'] = self::raw( 'false' );


        if( isset( $gameinfos['losers_not_ranked'] ) )
            $this->tpl['LOSERS_NOT_RANKED'] = $gameinfos['losers_not_ranked'] ? 'true' : 'false';
        else
            $this->tpl['LOSERS_NOT_RANKED'] = 'false';


        $gameInterfaceWidth = $gameinfos['game_interface_width'];

        $this->tpl['INTERFACE_MIN_WIDTH'] = $gameInterfaceWidth['min'];

        $autoscale = $gameInterfaceWidth['autoscale'];
        // currently we accept true (default), false (the dev needs to handle the scale down), and temporarily 'viewport'.
        $this->tpl['INTERFACE_AUTOSCALE'] = $autoscale === 'viewport' ? "'viewport'" : ($autoscale ? 'true' : 'false');

        $this->page->insert_block('nomobilezoom_directive', [
            'VIEWPORT' => 'width=device-width, initial-scale=1.0',
        ]);

        if( $this->gamePageInfos['turnBasedNotes'] === null )
            $this->tpl['TURN_BASED_NOTES'] = self::raw('""');
        else
            $this->tpl['TURN_BASED_NOTES'] = self::raw( json_encode( $this->gamePageInfos['turnBasedNotes'] ) );

        if( isset( $this->gamePageInfos['tb_your_turn'] ) )
            $this->tpl['TB_YOUR_TURN'] = $this->gamePageInfos['tb_your_turn'];
        else
            $this->tpl['TB_YOUR_TURN'] = 0;

        if( ! $this->bArchiveMode )
        {
            $players = $this->game->loadPlayersBasicInfos();   
                     
            if ($g_config['express_switchuser']) {
                $this->bgaGameData['expressSwitch'] = [];
                // If we are in the Studio (with the Red arrow to switch user), 
                // take the first unused test player to make it a spectator
                $player0id = min(array_keys($players)); // supposing it's player 0
                for ($i = 1; $i < 9; $i++) {
                    if (!array_key_exists($player0id + $i, $players)) {
                        $this->bgaGameData['expressSwitch']['spectatorId'] = $player0id + $i;
                        break;
                    }
                }
            }

            foreach( $players as $player_id => $localPlayer ) {
                $player = $this->gamePageInfos['players'][ $player_id ];                
                if((int)$player_id === $currentPlayerId) {
                    $this->tpl['CURRENT_PLAYER_NAME'] = $localPlayer['player_name'];
                }
            }
        }
        
        $this->tpl['PREMIUM'] = $this->gamePageInfos['is_premium'] ? 1 : 0;
        $this->tpl['LB_GAME_RESULT'] = _("LB_GAME_RESULT");
        $this->tpl['LB_STATISTICS'] = _("LB_STATISTICS");
        
        // Groups
        $this->tpl['GROUPS'] = self::raw( json_encode( $this->gamePageInfos['groups'] ) );  
                
        // Credits
        $this->tpl['PUBLISHER_VISIBILITY'] = ( $this->gamePageInfos['game_publisher_link'] == '' ) ? 'none':'block';
        $this->tpl['SECOND_PUBLISHER_VISIBILITY'] = ( $this->gamePageInfos['game_second_publisher'] == '' ) ? 'none':'block';
        
        $this->tpl['PUBLISHER_LINK']=$this->gamePageInfos['game_publisher_link'];
        $this->tpl['SECOND_PUBLISHER_LINK']=$this->gamePageInfos['game_second_publisher_url'];

        $o_gamemedia = $bgaContainer->get( "module.mainsite.gamemedia" );
        $media = $this->gamePageInfos['media'];
        if (isset($media['publisher'])) {
            $index = 0;
            foreach ($media['publisher'] as $key => $timestamp) {
                $publisherImageUrl = $o_gamemedia->getMediaUrl($this->game_name, 'publisher', null, $key, $media);
                $this->bgaGameData['credits']['publishers'][$index]['logoUrl'] = $publisherImageUrl;
                $index++;
            }
        }
        if (isset($this->bgaGameData['credits']['publishers'][0]) && !empty($this->gamePageInfos['game_publisher_link'])) {
            $this->bgaGameData['credits']['publishers'][0]['link'] = $this->gamePageInfos['game_publisher_link'];
        }
        if (isset($this->bgaGameData['credits']['publishers'][1]) && !empty($this->gamePageInfos['game_second_publisher_url'])) {
            $this->bgaGameData['credits']['publishers'][1]['link'] = $this->gamePageInfos['game_second_publisher_url'];
        }

        $o_gamemetadata = $bgaContainer->get('module.mainsite.gamemetadata');
        $metadata = $this->gamePageInfos['metadata'];

        $this->bgaGameData['credits']['author'] = $o_gamemetadata->getMetadataValue($metadata, "designer");
        $this->bgaGameData['credits']['artist'] = $o_gamemetadata->getMetadataValue($metadata, "artist");
        $this->bgaGameData['credits']['developer'] = $g_config['disable_dev_infos'] ? null : $this->gamePageInfos['dev_infos'];

        // Docked chat
  	    $this->tpl['DOCKED_CHAT'] = $g_config['bottom_chat_docked_ingame'] ? 'true' : 'false';

        $playersStatuses = array_values($this->gamePageInfos['players_statuses']);
        $tablePlayersCount = count($playersStatuses);
        $playingPlayers = array_filter($playersStatuses, fn($p) => $p['status'] !== 'zombie');
        $playingPlayersCount = count($playingPlayers);

        $this->bgaGameData['menu']['showConcedeButton'] = false;
        
        if ($playingPlayersCount === 1) {
            $this->bgaGameData['menu']['showConcedeButton'] = true;  
        } else if (!$this->gamePageInfos['is_coop']) {
            if ($playingPlayersCount === 2 && $this->gamePageInfos['keep_ranking_on_player_quit']) {
                $this->bgaGameData['menu']['showConcedeButton'] = true;  
            }
            else if ($tablePlayersCount === 2) {
                $this->bgaGameData['menu']['showConcedeButton'] = true;  
            }
        }

        $this->bgaGameData['menu']['showAbandonButton'] = !(count($this->gamePageInfos['players']) === 1 && $this->gamePageInfos['is_coop']);
        $this->bgaGameData['isCoop'] = $this->gamePageInfos['is_coop'] > 0;

        // If the game results are neutralized, hides concede and abandon button
        if ($this->game->getGameStateValue('game_result_neutralized') > 0) {
            $this->bgaGameData['menu']['showConcedeButton'] = false;
            $this->bgaGameData['menu']['showAbandonButton'] = false;
        }
  	    
  	    // Footer menu
        $this->tpl['TOURNAMENT_ID'] = 'null';
        $this->tpl['TOURNAMENT_OOT_OPTIONS'] = 'null';
        $this->tpl['TOURNAMENT_INFO'] = 'null';

        $tournamentInfo = $this->game->bga->tournament->getInfo();
        if (!empty($tournamentInfo)) {
            $this->bgaGameData['tournamentId'] = $tournamentInfo['id'];
            $this->tpl['TOURNAMENT_ID'] = $tournamentInfo['id'];
            $this->tpl['TOURNAMENT_OOT_OPTIONS'] = $tournamentInfo['oot_options'];
            $this->tpl['TOURNAMENT_INFO'] = [json_encode([
                'id' => $tournamentInfo['id'],
                'name' => $tournamentInfo['name'],
                'championship_name' => $tournamentInfo['name'],
                'avatar' => $tournamentInfo['avatar']
            ])];
        }

        $this->tpl['BLOCK_CHAT'] = '';
        if( isset( $this->gamePageInfos['block_chat'] ) )
            $this->tpl['BLOCK_CHAT'] = 'globalThis.gameui.discussblock=1;';

        $this->tpl['ADDITIONAL_JS'] = '';

        foreach ([
            'ingame_player_panels',
            'bot_profiles',
        ] as $featureFlag) {
            $active = false;
            
            try {
                $active = $this->featureFlags->isFlagActive($featureFlag);

                $this->tpl['ADDITIONAL_JS'] .= "globalThis.gameui.bgaInternal.flags['$featureFlag']=".($active ? 'true' : 'false').";";
            } catch (\Exception $e) {}
        }

        $this->tpl['EMERGENCY_MSG'] = self::raw( json_encode( $this->gamePageInfos['emergency'] ) );

        $this->tpl['RESULTS_PROCESSED_BY_BGA'] = _("Recording game results + computing statistics in progress...");
        
        if(!$this->sessionManager->isCurrentUserVisitor() ) {
            
            // Hotseat mode (admin view case)
            $this->tpl['HOTSEAT_INTERFACE'] = 'normal';

            if (($this->gamePageInfos['players'][$currentPlayerId ]['type'] ?? 'real') === 'hotseat') {
                $this->tpl['HOTSEAT_INTERFACE'] = 'hotseataccount';
            }
        }    

        $hotseatplayers = [];
        foreach($this->gamePageInfos['players'] as $player) {
            if (($player['type'] ?? 'real') === 'hotseat') {
                // Hotseat player!
                $hotseatplayers[] = (int)$player['user_id'];
            }
        }

        if (count($hotseatplayers) > 0) {
            // if there are hotseat players, they are playing with the table admin
            $hotseatplayers[] = (int)$this->gamePageInfos['admin_id'];
        }
        
        $this->tpl['HOTSEATPLAYERS'] = self::raw( json_encode( $hotseatplayers ) );

        // Ambiant music
        $this->bgaGameData['music'] = [
            'partnerUrl' => 'https://melodice.org',
            'partnerName' => 'Melodice.org',
            'url' => 'https://melodice.org/playlist/'.$gameinfos['bgg_id'].'/?utm_source=boardgamearena',
        ];
    }


    function setReplayModeOn( $viewArgs )
    {
        // Set replay mode: we must remove the current view and replace it by our game archive

        $current_player_id = $this->sessionManager->getBgaUserId();

        $players = $this->game->loadPlayersBasicInfos();
        $bSpectator = ! isset( $players[ $current_player_id ] ) ;
        
        $replay_from_move = $viewArgs['replayFrom'];

        
        
        // We do not support replay from the middle of the game for spectators
        // => fallback to replay_from_start
        if (!$bSpectator) {
            $best_available_replay = $this->db->getUniqueValue( "SELECT rsp_move_id FROM replaysavepoint
                    WHERE rsp_player_id='$current_player_id'
                      AND rsp_move_id < $replay_from_move
                    ORDER BY rsp_move_id DESC
                    LIMIT 0,1" );

            if( $best_available_replay !== null )
            {
                $this->replaysavepoint_move_id = $best_available_replay;
                return 'replay_from_savepoint_table';   // There are some available datas to replay from :)
            }
        }
        
        // FALLBACK CASE: "Replay from start" case, based on game archive

        
  		// Check if there is some archive file for this table/player
  		$gamearchive = 	APP_DATA_PATH.'gamearchive/'.$this->table_id."/".$this->table_id.'_'.$current_player_id.'.html';

  		if( ! is_file( $gamearchive ) )
  		    return 'error';   // Error: can't find game archive => jump to normal mode

        
        $game_name = $viewArgs['current_game_name'];
        $this->page->load_tpl( 'mainsite_archive', $game_name.'_'.$game_name );


        // Get all needed informations from BGA Master node before refreshing
        $this->gamePageInfos = self::masterNodeRequest( 'getGenericGameinfos', array(
            'table_id' => $this->table_id,
            'player_ids' => array_keys( $players )
        ) );       

        $html = file_get_contents( $gamearchive );

        $html = str_replace( "g_archive_mode = false;", "g_archive_mode = false;globalThis.g_replayFrom = ".$viewArgs['replayFrom'].';', $html );
        $html = str_replace( 'id="loader_mask" style="display:none;"', 'id="loader_mask" style="display:flex;"', $html );

        // Replace CSRF token registered in the archive static files with the current user valid one
        $html = preg_replace( "/requestToken:.*,/", "requestToken: '".($_SESSION['request_token'] ?? '')."',", $html );

        // Additional Javascript
        // (overriding)
        $insert_js = '';
                
        // Current decision
        $insert_js .= 'gameui.decision='.json_encode( $this->gamePageInfos['decision'] ).";\n";
        
        // current gamepreferences
        $insert_js .= 'gameui.prefs='.json_encode( $this->gamePageInfos['gamepreferences'] ).";\n";

        // Current sound preferences
        // DEPRECATED as it is now managed using local storage

        // Check game archive version against current version
        $current_game_version = getCurrentGameVersion( $this->getGameName() );
        $thistable_game_version = $this->gamePageInfos['game_version'];
       
        if( $current_game_version != $thistable_game_version ) 
            $insert_js .= "gameui.gameUpgraded=true;\n";
        
        // Add current reflexion time
        $stateActualized = $this->game->gamestate->state();
        $insert_js .= 'gameui.updatedReflexionTime='.json_encode( $stateActualized['reflexion'] ).";\n";

        
        $insert_js .= 'gameui.completesetup(';
        $html = str_replace( 'gameui.completesetup(', $insert_js, $html );

        $this->tpl['HTML_ARCHIVED'] = self::raw( $html );   
        
        return 'replay_from_start';     
    }

    function getLastMoveOf( $player_id, $number_move_back )
    {
        // Get the last $number_move_back move back for concerned player

        $allmoves = $this->db->getObjectList( "SELECT gamelog_move_id move, gamelog_current_player player FROM gamelog WHERE gamelog_move_id IS NOT NULL ORDER BY gamelog_packet_id DESC" );

        $last_player = null;
        $last_move = null;
        $last_good_move = null;

        foreach( $allmoves as $move )
        {
            if( $move['player'] != $last_player )
            {
                if( $last_player == $player_id )
                {
                    // We just finished a sequence of move where the current player was our targeted player
                    // => this move is an interesting move for our current player
                    $last_good_move = $move['move'];
                    $number_move_back--;
                    if( $number_move_back == 0 )
                    {
                        return $last_good_move+1;
                    }
                }

                $last_player = $move['player'];
            }
            else
            {   // Continue until the player change (we are only interested by players changes
            }

        }

        return 0;   // Not found => replay from the beginning
    }
    
    protected function getGameView(string $gameName)/*: ?GameView*/ {
        $classFile = APP_GAMES_PATH . $gameName . '/current/' . $gameName . '.view.php';
        if (!file_exists($classFile)) {
            return null;
        }
        $className = 'view_' . $gameName.'_' . $gameName;
        require_once $classFile;

        $gameView = new $className($this->page, $this->template_name);
        $gameView->game_name = $gameName;
        $gameView->game = $this->game;

        // used by puertorico,terranova,ageofinnovation,terramystica as an old substitute for $game->userPreferences->get(int $playerId, int $prefId)
        $gameView->gamePageInfos = $this->gamePageInfos; 
        
        return $gameView;
    }

  }
