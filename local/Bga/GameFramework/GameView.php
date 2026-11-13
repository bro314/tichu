<?php
 /**
  * Base class for every game view of the game (complete static HTML/CSS/JS reset view)
  */
declare(strict_types=1);

namespace Bga\GameFramework;

use \BgaSystemException;

  require_once( \APP_BASE_PATH.'view/common/ebg.view.php' );


  class GameView extends \ebg_view
  {

    var $game_name;
    var $table_id;
    var $game;
    var $game_id;

    var $bIsSpectator = true;
    var $bArchiveMode = false;
    
    var /*array*/ $gamePageInfos = null;

    var $replaysavepoint_move_id;
    var $replay_from_this_situation;

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

    ///////////////////////////////////
    // View generation main entry point


    /**
     * Function to be overriden by the children.
     */
    protected function build_page( $viewArgs ) {}

    /**
     * Get the player id of the player requesting the view.
     */
    protected function getCurrentPlayerId(): int
    {
        global $g_user;
        return (int)$g_user->get_id(false, false);
    }
    
    /**
     * DB functions, that should not be called in the view.php file of the games
     */

  	static function ConnectDb()
  	{
        throw new BgaSystemException("The view.php file should use the game class to access the database");
  	}

    static public function DbQuery( $sql, $specific_db=null )
  	{
        throw new BgaSystemException("The view.php file should use the game class to access the database");
  	}

    static function DbGetLastId()
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    static function DbAffectedRow()
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    static function DbStartTransaction()
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }
    static function DbCommit()
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }
    static function DbRollback()
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    static function DbRestartTransaction()
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }
    
    static function DbSelect( $dbname )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    static function CommitAllAndRestart()
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    static function setDeadlockMode( $mode )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }
    static function isDeadlockModeRetry()
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    static protected function sendMultiQueries(array $queries)
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    static public function escapeStringForDB( $string )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    static public function escapeStringOrNullForDB($string): string
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    static public function getCollectionFromDB( $sql, $bSingleValue=false )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    protected function getNonEmptyCollectionFromDB( $sql )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    protected function getDoubleKeyCollectionFromDB( $sql, $bSingleValue=false )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    static public function getUniqueValueFromDB( $sql )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }
    
    static public function mysql_fetch_row( $dbres )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }
    static public function mysql_query( $sql, $specific_db=null )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }
    
    protected function getObjectFromDB( $sql )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    protected function getNonEmptyObjectFromDB( $sql )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    static protected function getObjectListFromDB( $sql, $bUniqueValue=false )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    // Converts a database retrieved datetime field into a php DateTime using the proper database timezone (+2:00)
    static protected function getDateTimeFromDbDate( $dbdatetime )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

    // Converts a database retrieved datetime field into a timestamp using the proper database timezone (+2:00)
    static protected function getTimestampFromDbDate( $dbdatetime )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }
    
    function sqlParsing( $file )
    {
        throw new BgaSystemException("The view.php file should use the game class to access the database");
    }

  }
