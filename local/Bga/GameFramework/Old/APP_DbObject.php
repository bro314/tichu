<?php
declare(strict_types=1);

namespace Bga\GameFramework\Old;

use Sentry\Breadcrumb;
use \Monolog\Level;

/**
  * APP_DbObject.php
  *
  * Base class for every object that need a database connection
  *
  * @deprecated
  */

  abstract class APP_DbObject
  {
  	static private $usePrefix = '';
  	static private $usePrefix_tablelist = null;

    /**
     * Assert connection to the database.
     * @Deprecated
     */
  	static function ConnectDb()
  	{
        global $bgaContainer;
        $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->assertConnection();
  	}

    final public static function DbQuery( $sql, $specific_db=null )
  	{
        global $bgaContainer;
        self::assertNoBgaTable($sql);
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->query((string) $sql);
  	}

    final public static function DbGetLastId()
    {
        global $bgaContainer;
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->getLastId();
    }

    final public static function DbAffectedRow()
    {
        global $bgaContainer;
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->getNumAffectedRows();
    }

    static function DbStartTransaction()
    {
        global $bgaContainer;
        $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->begin();
    }
    static function DbCommit()
    {
        global $bgaContainer;
        $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->commit();
    }
    static function DbRollback()
    {
        global $bgaContainer;
        $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->rollback();
    }

    static function DbRestartTransaction()
    {
        global $bgaContainer;
        $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->rollback();
        $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->begin();
    }
    
    static function DbSelect( $dbname )
    {
        global $bgaContainer;
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->select((string) $dbname);
    }

    static function CommitAllAndRestart()
    {
        global $bgaContainer;
        $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->commit();
        $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->begin();
    }

    static function setDeadlockMode( $mode )
    {
        global $bgaContainer;
        $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->setDeadlockMode((string) $mode);
    }
    static function isDeadlockModeRetry()
    {
        global $bgaContainer;
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->isDeadlockModeRetry();
    }

    static function sendMultiQueries(array $queries)
    {
        global $bgaContainer;
        foreach ($queries as $sql) {
            self::assertNoBgaTable($sql);
        }
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->sendMultiQueries($queries);
    }

//////////////////////////////////////////////////////////////////////////////
//////////// Generic data access methods
////////////

    final public static function escapeStringForDB( $string )
    {
        global $bgaContainer;
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->escapeString((string) $string);
    }

    final public static function escapeStringOrNullForDB($string): string
    {
        global $bgaContainer;
        if ($string !== null) {
            $string = (string) $string;
        }
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->escapeStringOrNull($string);
    }

    final public static function getCollectionFromDB( $sql, $bSingleValue=false )
    {
        global $bgaContainer;
        self::assertNoBgaTable($sql);
        return $bgaContainer
            ->get(\Bga\GameFramework\Old\Db::class)
            ->getCollection((string) $sql, (bool) $bSingleValue);
    }

    final public static function getNonEmptyCollectionFromDB( $sql )
    {
        global $bgaContainer;
        self::assertNoBgaTable($sql);
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->getNonEmptyCollection((string) $sql);
    }

    final public static function getDoubleKeyCollectionFromDB( $sql, $bSingleValue=false )
    {
        global $bgaContainer;
        self::assertNoBgaTable($sql);
        return $bgaContainer
            ->get(\Bga\GameFramework\Old\Db::class)
            ->getDoubleKeyCollection((string) $sql, (bool) $bSingleValue);
    }

    final public static function getUniqueValueFromDB( $sql )
    {
        global $bgaContainer;
        self::assertNoBgaTable($sql);
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->getUniqueValue((string) $sql);
    }
    
    static public function mysql_fetch_row( $dbres )
    {
        if( ! is_object( $dbres ) )
            throw new \feException( "Try to call mysql_fetch_row on a non object" );

        // Note: this method exists for compatibility with the old mysql PHP driver function
        return $dbres->fetch_row();
    }
    static public function mysql_query( $sql, $specific_db=null )
    {
        return self::DbQuery( $sql, $specific_db );
    }
    
    final public static function getObjectFromDB( $sql )
    {
        global $bgaContainer;
        self::assertNoBgaTable($sql);
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->getObject((string) $sql);
    }

    final public static function getNonEmptyObjectFromDB( $sql )
    {
        global $bgaContainer;
        self::assertNoBgaTable($sql);
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->getNonEmptyObject((string) $sql);
    }

    final public static function getObjectListFromDB( $sql, $bUniqueValue=false )
    {
        global $bgaContainer;
        self::assertNoBgaTable($sql);
        return $bgaContainer
            ->get(\Bga\GameFramework\Old\Db::class)
            ->getObjectList((string) $sql, (bool) $bUniqueValue);
    }

    // Converts a database retrieved datetime field into a php DateTime using the proper database timezone (+2:00)
    static protected function getDateTimeFromDbDate( $dbdatetime )
    {
        global $bgaContainer;
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->getDateTimeFromDbDate((string) $dbdatetime);
    }

    // Converts a database retrieved datetime field into a timestamp using the proper database timezone (+2:00)
    static protected function getTimestampFromDbDate( $dbdatetime )
    {
        global $bgaContainer;
        return $bgaContainer->get(\Bga\GameFramework\Old\Db::class)->getTimestampFromDbDate((string) $dbdatetime);
    }
    
    // SQL parsing
    // See http://www.phpclasses.org/browse/file/12857.html
    function sqlParsing( $file )
    {  
        $result = array();


    
        // Getting the SQL file content        
        $content = file_get_contents($file);
                
        // Processing the SQL file content             
        $file_content = explode("\n",$content);            
      
      
        $query = "";
        
          // Parsing the SQL file content            
          foreach($file_content as $sql_line)
          {        
             if(trim($sql_line) != "" && strpos($sql_line, "--") === false)
             {            
                $query .= $sql_line;
                  // Checking whether the line is a valid statement
                  if(preg_match("/(.*);/", $sql_line))
                  {
                     $query = substr($query, 0, strlen($query)-1);                       
                     
                     while( substr($query, -1 ) == ';' )
                     {
                        $query = substr($query, 0, strlen($query)-1);
                     }
                     
                       //Executing the parsed string, returns the error code in failure
                       $result[] = $query;
                       $query = "";
                  }
             }
          } //End of foreach
        
        return $result;
    } //End of function 

    /**
     * For now we enforce it in Studio only to make sure we don't break existing games.
     * Developers will need to use API instead of requesting BGA tables on Studio, hopefuly reducing the number of impacted production games step by step.
     */
    private static function assertNoBgaTable(string $sql): void {
        if (\Bga\GameFramework\Table::getBgaEnvironment() !== 'studio') {
            return;
        }

        if (self::referencesBgaTable($sql)) { // forbid games to access `bga_*` tables
            throw new \Bga\GameFramework\SystemException('Do not access the BGA tables directly, use the API');
        }
    }

    /**
     * This is not a complete SQL parser; it only recognizes table-bearing clauses
     * well enough to avoid matching bga_ inside string values or column names.
     */
    private static function referencesBgaTable(string $sql): bool
    {
        $tokens = self::tokenizeSql($sql);
        $tokenCount = count($tokens);

        for ($index = 0; $index < $tokenCount; $index++) {
            $keyword = self::getWord($tokens[$index]);
            if ($keyword === null) {
                continue;
            }

            if (in_array($keyword, ['from', 'join', 'straight_join'], true)) {
                if (self::tableListContainsBgaTable($tokens, $index + 1, [
                    'where',
                    'group',
                    'order',
                    'having',
                    'limit',
                    'union',
                    'procedure',
                    'for',
                    'lock',
                    'on',
                    'using',
                    'join',
                    'left',
                    'right',
                    'inner',
                    'outer',
                    'cross',
                    'natural',
                    'straight_join',
                ])) {
                    return true;
                }
                continue;
            }

            if ($keyword === 'update') {
                if (self::tableListContainsBgaTable($tokens, $index + 1, ['set', 'where', 'order', 'limit'])) {
                    return true;
                }
                continue;
            }

            if (in_array($keyword, ['insert', 'replace'], true)) {
                if (self::insertLikeClauseContainsBgaTable($tokens, $index)) {
                    return true;
                }
                continue;
            }

            if ($keyword === 'into') {
                [$tableName] = self::readTableName($tokens, $index + 1);
                if ($tableName !== null && self::isBgaTableName($tableName)) {
                    return true;
                }
                continue;
            }

            if (in_array($keyword, ['create', 'drop', 'alter', 'truncate', 'desc', 'describe'], true)) {
                if (self::statementTableClauseContainsBgaTable($tokens, $index, $keyword)) {
                    return true;
                }
                continue;
            }

            if ($keyword === 'rename' && self::renameTableClauseContainsBgaTable($tokens, $index)) {
                return true;
            }

            if ($keyword === 'lock' && self::lockTablesClauseContainsBgaTable($tokens, $index)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<int, array{type: string, value: string}> $tokens
     * @param array<int, string> $terminators
     */
    private static function tableListContainsBgaTable(array $tokens, int $index, array $terminators): bool
    {
        $tokenCount = count($tokens);
        $terminators = array_flip($terminators);

        while ($index < $tokenCount) {
            $keyword = self::getWord($tokens[$index]);
            if ($keyword !== null && isset($terminators[$keyword])) {
                return false;
            }

            if (self::isSymbol($tokens[$index], '(')) {
                $index = self::skipParenthesizedExpression($tokens, $index);
                $index = self::skipTableAlias($tokens, $index);
                $index = self::advanceToNextTableListEntry($tokens, $index, $terminators);
                continue;
            }

            [$tableName, $nextIndex] = self::readTableName($tokens, $index);
            if ($tableName !== null) {
                if (self::isBgaTableName($tableName)) {
                    return true;
                }

                $index = self::advanceToNextTableListEntry($tokens, $nextIndex, $terminators);
                continue;
            }

            $index++;
        }

        return false;
    }

    /**
     * @param array<int, array{type: string, value: string}> $tokens
     */
    private static function statementTableClauseContainsBgaTable(array $tokens, int $index, string $statementKeyword): bool
    {
        $index++;

        if (in_array($statementKeyword, ['create', 'drop'], true)) {
            $index = self::skipWords($tokens, $index, ['temporary']);
        }

        if ($statementKeyword === 'truncate') {
            $index = self::skipWords($tokens, $index, ['table']);
        } elseif (!in_array($statementKeyword, ['desc', 'describe'], true)) {
            $tableKeyword = self::getWord($tokens[$index] ?? null);
            if ($tableKeyword !== 'table') {
                return false;
            }
            $index++;
        }

        $index = self::skipTableExistenceClause($tokens, $index);
        if (self::tableListContainsBgaTable($tokens, $index, ['as', 'like', 'select', 'where', 'order', 'limit'])) {
            return true;
        }

        return $statementKeyword === 'create' && self::createTableLikeClauseContainsBgaTable($tokens, $index);
    }

    /**
     * @param array<int, array{type: string, value: string}> $tokens
     */
    private static function insertLikeClauseContainsBgaTable(array $tokens, int $index): bool
    {
        $index++;
        $index = self::skipWords($tokens, $index, ['low_priority', 'delayed', 'high_priority', 'ignore']);
        $index = self::skipWords($tokens, $index, ['into']);

        [$tableName] = self::readTableName($tokens, $index);
        return $tableName !== null && self::isBgaTableName($tableName);
    }

    /**
     * @param array<int, array{type: string, value: string}> $tokens
     */
    private static function createTableLikeClauseContainsBgaTable(array $tokens, int $index): bool
    {
        $tokenCount = count($tokens);

        for (; $index < $tokenCount; $index++) {
            $keyword = self::getWord($tokens[$index]);
            if (in_array($keyword, ['as', 'select', 'where', 'order', 'limit'], true)) {
                return false;
            }

            if ($keyword === 'like') {
                [$tableName] = self::readTableName($tokens, $index + 1);
                return $tableName !== null && self::isBgaTableName($tableName);
            }
        }

        return false;
    }

    /**
     * @param array<int, array{type: string, value: string}> $tokens
     */
    private static function renameTableClauseContainsBgaTable(array $tokens, int $index): bool
    {
        $index++;
        if (self::getWord($tokens[$index] ?? null) !== 'table') {
            return false;
        }

        $index++;
        $tokenCount = count($tokens);

        while ($index < $tokenCount) {
            [$oldTableName, $index] = self::readTableName($tokens, $index);
            if ($oldTableName !== null && self::isBgaTableName($oldTableName)) {
                return true;
            }

            if (self::getWord($tokens[$index] ?? null) !== 'to') {
                return false;
            }
            $index++;

            [$newTableName, $index] = self::readTableName($tokens, $index);
            if ($newTableName !== null && self::isBgaTableName($newTableName)) {
                return true;
            }

            if (!self::isSymbol($tokens[$index] ?? null, ',')) {
                return false;
            }
            $index++;
        }

        return false;
    }

    /**
     * @param array<int, array{type: string, value: string}> $tokens
     */
    private static function lockTablesClauseContainsBgaTable(array $tokens, int $index): bool
    {
        $index++;
        if (self::getWord($tokens[$index] ?? null) !== 'tables') {
            return false;
        }

        $index++;
        $tokenCount = count($tokens);

        while ($index < $tokenCount) {
            [$tableName, $index] = self::readTableName($tokens, $index);
            if ($tableName !== null && self::isBgaTableName($tableName)) {
                return true;
            }

            while ($index < $tokenCount && !self::isSymbol($tokens[$index], ',')) {
                $index++;
            }

            if (!self::isSymbol($tokens[$index] ?? null, ',')) {
                return false;
            }
            $index++;
        }

        return false;
    }

    /**
     * @param array<int, array{type: string, value: string}> $tokens
     * @return array{0: ?string, 1: int}
     */
    private static function readTableName(array $tokens, int $index): array
    {
        $index = self::skipWords($tokens, $index, ['low_priority', 'delayed', 'high_priority', 'ignore', 'only']);

        if (!self::isIdentifier($tokens[$index] ?? null)) {
            return [null, $index];
        }

        $tableName = $tokens[$index]['value'];
        $index++;

        while (self::isSymbol($tokens[$index] ?? null, '.') && self::isIdentifier($tokens[$index + 1] ?? null)) {
            $tableName = $tokens[$index + 1]['value'];
            $index += 2;
        }

        return [$tableName, $index];
    }

    /**
     * @param array<int, array{type: string, value: string}> $tokens
     * @param array<string, int> $terminators
     */
    private static function advanceToNextTableListEntry(array $tokens, int $index, array $terminators): int
    {
        $depth = 0;
        $tokenCount = count($tokens);

        while ($index < $tokenCount) {
            if (self::isSymbol($tokens[$index], '(')) {
                $depth++;
            } elseif (self::isSymbol($tokens[$index], ')')) {
                $depth = max(0, $depth - 1);
            } elseif ($depth === 0 && self::isSymbol($tokens[$index], ',')) {
                return $index + 1;
            } elseif ($depth === 0) {
                $keyword = self::getWord($tokens[$index]);
                if ($keyword !== null && isset($terminators[$keyword])) {
                    return $index;
                }
            }

            $index++;
        }

        return $index;
    }

    /**
     * @param array<int, array{type: string, value: string}> $tokens
     */
    private static function skipParenthesizedExpression(array $tokens, int $index): int
    {
        $depth = 0;
        $tokenCount = count($tokens);

        while ($index < $tokenCount) {
            if (self::isSymbol($tokens[$index], '(')) {
                $depth++;
            } elseif (self::isSymbol($tokens[$index], ')')) {
                $depth--;
                if ($depth === 0) {
                    return $index + 1;
                }
            }

            $index++;
        }

        return $index;
    }

    /**
     * @param array<int, array{type: string, value: string}> $tokens
     */
    private static function skipTableAlias(array $tokens, int $index): int
    {
        if (self::getWord($tokens[$index] ?? null) === 'as') {
            $index++;
        }

        if (self::isIdentifier($tokens[$index] ?? null)) {
            return $index + 1;
        }

        return $index;
    }

    /**
     * @param array<int, array{type: string, value: string}> $tokens
     */
    private static function skipTableExistenceClause(array $tokens, int $index): int
    {
        if (self::getWord($tokens[$index] ?? null) !== 'if') {
            return $index;
        }

        $index++;
        if (self::getWord($tokens[$index] ?? null) === 'not') {
            $index++;
        }
        if (self::getWord($tokens[$index] ?? null) === 'exists') {
            $index++;
        }

        return $index;
    }

    /**
     * @param array<int, array{type: string, value: string}> $tokens
     * @param array<int, string> $words
     */
    private static function skipWords(array $tokens, int $index, array $words): int
    {
        $words = array_flip($words);
        while (isset($tokens[$index])) {
            $word = self::getWord($tokens[$index]);
            if ($word === null || !isset($words[$word])) {
                return $index;
            }
            $index++;
        }

        return $index;
    }

    private static function isBgaTableName(string $tableName): bool
    {
        return str_starts_with(strtolower($tableName), 'bga_');
    }

    /**
     * @param ?array{type: string, value: string} $token
     */
    private static function getWord(?array $token): ?string
    {
        if (($token['type'] ?? null) !== 'word') {
            return null;
        }

        return strtolower($token['value']);
    }

    /**
     * @param ?array{type: string, value: string} $token
     */
    private static function isIdentifier(?array $token): bool
    {
        return in_array($token['type'] ?? null, ['word', 'quoted'], true);
    }

    /**
     * @param ?array{type: string, value: string} $token
     */
    private static function isSymbol(?array $token, string $symbol): bool
    {
        return ($token['type'] ?? null) === 'symbol' && $token['value'] === $symbol;
    }

    /**
     * @return array<int, array{type: string, value: string}>
     */
    private static function tokenizeSql(string $sql): array
    {
        $tokens = [];
        $length = strlen($sql);
        $index = 0;

        while ($index < $length) {
            $char = $sql[$index];

            if (ctype_space($char)) {
                $index++;
                continue;
            }

            if ($char === '-' && ($sql[$index + 1] ?? null) === '-') {
                $index = self::skipUntilLineEnd($sql, $index + 2);
                continue;
            }

            if ($char === '#') {
                $index = self::skipUntilLineEnd($sql, $index + 1);
                continue;
            }

            if ($char === '/' && ($sql[$index + 1] ?? null) === '*') {
                $commentEnd = strpos($sql, '*/', $index + 2);
                $index = $commentEnd === false ? $length : $commentEnd + 2;
                continue;
            }

            if (in_array($char, ['`', '"', "'"], true)) {
                [$value, $index] = self::readQuotedSqlToken($sql, $index, $char);
                $tokens[] = ['type' => 'quoted', 'value' => $value];
                continue;
            }

            if ($char === '[') {
                [$value, $index] = self::readBracketQuotedSqlToken($sql, $index);
                $tokens[] = ['type' => 'quoted', 'value' => $value];
                continue;
            }

            if (ctype_alnum($char) || $char === '_' || $char === '$') {
                $start = $index;
                do {
                    $index++;
                } while (
                    $index < $length
                    && (ctype_alnum($sql[$index]) || $sql[$index] === '_' || $sql[$index] === '$')
                );
                $tokens[] = ['type' => 'word', 'value' => substr($sql, $start, $index - $start)];
                continue;
            }

            $tokens[] = ['type' => 'symbol', 'value' => $char];
            $index++;
        }

        return $tokens;
    }

    private static function skipUntilLineEnd(string $sql, int $index): int
    {
        $lineEnd = strcspn($sql, "\r\n", $index);
        return $index + $lineEnd;
    }

    /**
     * @return array{0: string, 1: int}
     */
    private static function readQuotedSqlToken(string $sql, int $index, string $quote): array
    {
        $value = '';
        $length = strlen($sql);
        $index++;

        while ($index < $length) {
            $char = $sql[$index];
            if ($char === '\\' && $index + 1 < $length) {
                $value .= $sql[$index + 1];
                $index += 2;
                continue;
            }

            if ($char === $quote) {
                if (($sql[$index + 1] ?? null) === $quote) {
                    $value .= $quote;
                    $index += 2;
                    continue;
                }

                return [$value, $index + 1];
            }

            $value .= $char;
            $index++;
        }

        return [$value, $index];
    }

    /**
     * @return array{0: string, 1: int}
     */
    private static function readBracketQuotedSqlToken(string $sql, int $index): array
    {
        $end = strpos($sql, ']', $index + 1);
        if ($end === false) {
            return [substr($sql, $index + 1), strlen($sql)];
        }

        return [substr($sql, $index + 1, $end - $index - 1), $end + 1];
    }

    //////////////////////////////////////////////////////////////////////
    ///// Table prefixing
   
   	function DbUsePrefix( $prefix )
	{
	    self::$usePrefix = $prefix;
	}
	
	function getCurrentPrefix()
	{
	    return self::$usePrefix;
	}
	
    static function applyPrefix( $sql )
	{
        $usePrefix = self::$usePrefix;
        self::$usePrefix = '';    // Disable prefix during incalls

        // Check this is a SELECT
        if( !preg_match( '/^\s*SELECT[^a-zA-Z0-9_]/', $sql ) )
        {        
	    	self::$usePrefix = $usePrefix;
            return $sql;    // Not a select
        }

        // At first, get the list of all tables that could be replaced
	    if( self::$usePrefix_tablelist === null )
	    {
	        // Load tables list
	        self::$usePrefix_tablelist = array();
	        $tables = self::getObjectListFromDB( "SHOW TABLES", true );
            $prefix = "zz_savepoint_";
            $other_prefix = "zz_replay";
        
            foreach( $tables as $table )
            {
                if( substr( $table, 0, strlen( $prefix ) ) == $prefix )
                {
                    // Save point => do not copy
                }
                else if( substr( $table, 0, strlen( $other_prefix ) ) == $other_prefix )
                {
                    // Save point => do not copy
                }
                else
                {
                    self::$usePrefix_tablelist[$table] = 1;
                }
	        }
	    }
	    
	    // Get tables used by this request
	    $explain = self::getObjectListFromDB( "EXPLAIN ".$sql );
	    $tables_used = array();
	    foreach( $explain as $explain_item )
	    {
	        if( $explain_item['table'] !== null )
	        {
	            if( isset( self::$usePrefix_tablelist[ $explain_item['table'] ] ) )
    	            $tables_used[] = $explain_item['table'];
	        }
	    }
	
	    if( count( $tables_used ) == 0 )
	    {
	        self::$usePrefix = $usePrefix;
	        return $sql;    // No game table used in this request
	    }   
	    
	    // Now, replace tables name by prefix
	    $sql .= ' ';
        foreach( $tables_used as $table )
        {
            $pattern = '/([^a-zA-Z0-9_])'.$table.'([^a-zA-Z0-9_])/';
            $replacement = '$1'.$usePrefix.$table.'$2';
            $sql = preg_replace( $pattern, $replacement, $sql );
        }

	
	    // Restore prefix before return
	    self::$usePrefix = $usePrefix;

	    return $sql;
	}

    //////////////////////////////////////////////////////////////////////
    ///// Time lock protections
    /////
    // These methods uses APC to provide a time lock protection (ex: against spam)
    //

    /**
     * Enforce a per-user time lock for repeated actions.
     *
     * @param string $action Action identifier.
     * @param int|string $userId User id used in the cache key.
     * @param int $timeSec Lock duration in seconds.
     * @return bool True when the action is allowed and the lock is set.
     */
    protected function ensure_enough_time_since_last_action( string $action, int|string $userId, int $timeSec ): bool
    {
        // If this user did the same action less than $timeSec before, return false
        // If not, return true and record that this user did this action
        $cache_key = "timelock:{$action}:{$userId}";
        global $bgaContainer;
        $cacheApcu = $bgaContainer->get(\Bga\Services\Cache\Apcu::class);
        $item = $cacheApcu->getItem($cache_key);
        if ($item->isHit()) {
            return false;
        }
        $item->set(1);
        $item->expiresAfter(\DateInterval::createFromDateString("{$timeSec} seconds"));
        $cacheApcu->save($item);
        return true;
    }

	/////////////////////////////////////////////////////////////////:
	/// Exchange between nodes (BGA cluster)
    
    function chooseMetasiteInCluster()
    {
        global $g_config;

        $total_weight = 0;
        foreach( $g_config['cluster_metasite_request_server'] as $metasite )
        {
            $total_weight += $metasite['weight'];
        }

        $chosen = rand( 0,  $total_weight-1 );

        $weight = 0;
        foreach( $g_config['cluster_metasite_request_server'] as $metasite )
        {
            $weight += $metasite['weight'];

            if( $weight > $chosen )
            {
                break ;
            }
        }

        return $metasite['server'];
    }
	
	protected function getMasterNodeUrl( $bForceHttp = false )
	{
	    global $g_config;
	    if( $g_config['cluster_is_master'] )
        {
            if( $bForceHttp )
                return 'http://'.$g_config['app_domain'];
            else
                return getHttpOrHttps().'://'.$g_config['app_domain'];
        }	
        else
        {
            $masterNodeDomain = strstr( $g_config['app_domain'], '.' );
            
            if( $bForceHttp )
            {
                // Use the internal url
                if( isset( $g_config['cluster_metasite_request_server']))
                {
                    if( is_array($g_config['cluster_metasite_request_server']) )
                    {
                        return 'http://'.self::chooseMetasiteInCluster();
                    }
                    else
                    {
                        // Configuration when there is only 1 MS
                        return 'http://'.$g_config['cluster_metasite_request_server'];
                    }
                }
                else
                {
                    return 'http://'.ltrim( $masterNodeDomain, '.' ); // For legacy
                }

            }
            else
                return getHttpOrHttps().'://'.ltrim( $masterNodeDomain, '.' );
        }
	}
	
	// Call a method on the master node and return the answer
	// If master node = current node, make a direct (local) method call
	protected function masterNodeRequest( $method, $args )
	{
	    global $g_config;
	    global $bgaContainer;
	    global $g_user;
	    
	    if( $g_user->is_logged() )
    	    $args['current_player_id'] = $g_user->get_id();
	    
	    if( $g_config['cluster_is_master'] )
	    {
	        // This IS master node
	        
	        $current_db = self::getUniqueValueFromDB( "SELECT database()" );
	        self::DbSelect( $g_config['db_name'] );
	        
            $o_module = $bgaContainer->get( 'module.metasite.metasite' );
            try 
            {
                $result = $o_module->$method( $args );
            }
            catch( \Exception $e )
            {
                self::DbSelect( $current_db );
                throw $e;
            }
            self::DbSelect( $current_db );
	        
	        
	        return $result;
	    }
	    else
	    {
	        // Make a network request to master node
	         
	        // Determine master node URL
            $masterNodeUrl = self::getMasterNodeUrl(  true  );
            $service = "/metasite/metasite/$method.html?job&jobpass=".$bgaContainer->get(\Bga\Config\SecretConfig::class)->getJobAuthenticationPassword();
            
            if( isset( $args['table_id'] ) )
                $service .= '&t='.$args['table_id'];

            $timeout_profile = 'cluster';
            if( $method == 'gameResult' )
                $timeout_profile = 'cluster_long';
            else if (($args['game'] ?? '') == 'altered-api')
                $timeout_profile = 'external_altered';

            $url = $masterNodeUrl.$service;
            $json_result = self::bgaCallUrl( $url, $timeout_profile, $args );         

            if( $json_result === null || $json_result === false) {
                throw new \Bga\Exceptions\Framework\RemoteMSErrorException();
            }

            $json_result = str_replace("\xEF\xBB\xBF",'',$json_result); // (happend sometime - see https://stackoverflow.com/questions/10290849/how-to-remove-multiple-utf-8-bom-sequences)

            $result = json_decode( $json_result, true );

            if( $result === null )
            {
                // DISABLED: we should not hide usefule debugging data. Dangerous error messages should be hidden to jobs
//                if( $g_user->is_admin() )
                    throw new \feException( "Wrong formatted data from main BGA website: ".$json_result );
//                else
//                    throw new feException( "Wrong formatted data from main BGA website" );
            }
	        
	        if( $result['status'] == 1 )
	            return $result['data']; // Right answer from BGA website
	        else         
	        {
	            // Exception from the metasite => propagate the exception here
	            throw new \feException( $result['error'], $result['expected']!=0, true, $result['code'] );
    	    }
	    }
	}
	
	
	/////////////////////////////////////////////////////////////////:
	/// External resource usage
	
	// Call an url and return its content.
	// Note: see config.init.php for timeout_profile (ex of possible values: 'internal', 'external'...)
	public static function bgaCallUrl( $url, $timeout_profile, $postData=null, $bUseCurl=false, $headers=array() )
	{
	    global $g_trace, $g_config;
	    
	    if( isset( $g_config['services_timeout'][ $timeout_profile ] ) )
	        $timeout = $g_config['services_timeout'][ $timeout_profile ];
	    else
	        throw new \feException("Wrong timeout profile");

	    $opts = array( 'http' => array(
	        'timeout' => $timeout
	    ) );
	    
	    if( $postData !== null )
	    {
            $serialized_data = (in_array('Content-Type: application/json', $headers) ? $postData : http_build_query( $postData ));
	        $serialized_data_log = urldecode( $serialized_data );
	        $opts['http']['method'] = 'POST';
	        $opts['http']['header'] = "Content-type: application/x-www-form-urlencoded\r\n" . 'Content-Length: ' . strlen($serialized_data) . "\r\n";
	        $opts['http']['content'] = $serialized_data;
	    }
	    else
	    {
	        $serialized_data = '-';
	        $serialized_data_log = "-";
	    }
	    
	    
	    // We skip certificate validation, because letsencrypt does not work with file_get_contents on production server
	    $opts['ssl']= array(
                "verify_peer"=>false,
                "verify_peer_name"=>false,
            );
	    
        $context  = stream_context_create($opts);

  	    global $g_trace;
       
  	    $start_time = microtime( true );

        $responseHeaders = null;
		if( !$bUseCurl )
		{
	        $res = @file_get_contents( $url, false, $context ); 
            $responseHeaders = http_get_last_response_headers();
        }
		else
		{
			$ch = curl_init();

			curl_setopt($ch, CURLOPT_AUTOREFERER, TRUE);
			curl_setopt($ch, CURLOPT_HEADER, 0);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
			curl_setopt($ch, CURLOPT_URL, $url);
			curl_setopt($ch, CURLOPT_FOLLOWLOCATION, TRUE);
			curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5); 
			curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
            if ($postData) {
                curl_setopt($ch, CURLOPT_POST, 1);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $serialized_data);
            }
            else {
                curl_setopt($ch, CURLOPT_POST, 0);
            }
            if (count($headers) > 0) {
                curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            }
            
			$res = curl_exec($ch);
			curl_close($ch);
		}
		
        $endtime = microtime( true );
        $request_time = ($endtime - $start_time)*1000;    

  	    $g_trace->incExtRequestTime( $request_time );

        $log = substr( $url, 0, 128 ).' '.substr( $serialized_data_log, 0, 128 ).' '; // input
        if (is_array($responseHeaders) && isset($responseHeaders[0])) {
            $log .= $responseHeaders[0] . ' ';
        } else {
            $log .= "no header ";
        }
        $log .= round($request_time).' ';

        global $bgaContainer;
        $bgaContainer->get(\Bga\Services\Sentry::class)->addBreadcrumb(category: $bUseCurl ? "curl" : "file_get_contents",
                                                                       type: Breadcrumb::TYPE_HTTP,
                                                                       message: $url,
                                                                       metadata: [
                                                                           "http.method" => $postData === null ? "GET" : "POST",
                                                                           "http.query" => $serialized_data,
                                                                           "timeout" => $timeout,
                                                                       ]);
        $timeout_limit_ms = 1000*$timeout;
        if( $res === false && $request_time > $timeout_limit_ms )
        {
            $log .= "(!TIMEOUT: $timeout_limit_ms)";
      	    $g_trace->extCall_log( $log );
      	    return null;
      	}
        else        
        {
            $log .= substr( $res ?: '', 0, 128 );
  	        $g_trace->extCall_log( $log );
            return $res;     	   
        }
	} 

    // Previously in the APP_Object class

    /**
     * Watch a value.
     *
     * @param $label
     * @param $value
     * @return void
     *
     * @deprecated This method does not contain any code. Do not use it.
     */
    public function watch($label, $value)
    {
        //
    }

    /**
     * Log a debug message.
     *
     * @param  string $message
     * @return void
     */
    public function debug($message)
    {
        global $g_trace;
        $g_trace->log(Level::Debug, $message);
    }

    /**
     * Log a standard message (info).
     *
     * @param  string $message
     * @return void
     */
    public function trace($message)
    {
        global $g_trace;
        $g_trace->log(Level::Info, $message);
    }

    /**
     * Log a warning message.
     *
     * @param  string $message
     * @return void
     */
    public function warn($message)
    {
        global $g_trace;
        $g_trace->log(Level::Warning, $message);
    }

    /**
     * Log an error message.
     *
     * @param  string $message
     * @return void
     */
    public function error($message)
    {
        global $g_trace;
        $g_trace->log(Level::Error, $message);
    }

    /**
     * Dump an object into the log.
     *
     * @param  string $label
     * @param  mixed $object
     * @return void
     */
    public function dump($label, $object)
    {
        global $g_trace;

        ob_start();
        var_dump($object);

        $g_trace->log(Level::Info, $label . ' = ' . ob_get_contents());
        ob_clean();
    } 

  }


