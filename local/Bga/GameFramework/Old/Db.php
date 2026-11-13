<?php

declare(strict_types=1);

namespace Bga\GameFramework\Old;

use Bga\Exceptions\Services\Db\DatabaseDeadLockException;
use Bga\Exceptions\Services\Db\DatabaseException;
use Bga\Exceptions\Services\Db\DatabaseInvalidResultException;
use Bga\Exceptions\Services\Db\DatabaseQueryErrorException;
use Bga\Exceptions\Services\Db\DatabaseTimeOutException;
use Bga\Exceptions\Services\Db\UnableToFindDatabaseException;
use Bga\Exceptions\Services\Db\DabaseSyntaxErrorException;

use Monolog\Level;
use mysqli_sql_exception;
use mysqli;
use mysqli_result;
use feException;

/*
 * ⚠️ this class is used by Table, so any change on it might impact the games.
 */
class Db
{
    /**
     * The mysqli connection, created once connected.
     */
    private ?mysqli $db = null;

    /**
     * Used to trace DB queries duration
     */
    private ?float $startTime = null;

    /**
     * If set to "retry", queries producing deadlocks will be retried.
     * @deprecated
     */
    private string $deadlockMode = 'fail';

    /**
     * Auto reconnection flag
     */
    private bool $isAutoReconnect = false;

    public function __construct() {}

    /**
     * @return bool $this->isAutoReconnect
     */
    public function getAutoReconnect(): bool
    {
        return $this->isAutoReconnect;
    }
    /**
     * If true, we'll try reconnecting to the database when disconnected.
     * Should only be used for debugging purpose.
     * In normal situations, please configure a timeout.
     */
    public function setAutoReconnect(bool $isAutoReconnect): void
    {
        $this->isAutoReconnect = $isAutoReconnect;
    }

    /**
     * Connect to the database, if not already connected.
     */
    public function connect(): mysqli
    {
        global $g_config;
        if ($this->db) {
            // Already connected
            return $this->db;
        }

        $this->traceTimeStart();

        // Disable MySQLi error reporting (pre-8.1 behavior).
        // @see https://wiki.php.net/rfc/mysqli_default_errmode
        mysqli_report(MYSQLI_REPORT_OFF);

        global $bgaContainer;
        $bgaContainer->get(\Bga\Services\Sentry::class)->addBreadcrumb(category: 'query', message: 'connect master');

        $this->db = new mysqli(
            $g_config['db_host'],
            $g_config['db_user'],
            $g_config['db_password'],
            null,
            $g_config['db_port'] ?? null,
        );

        if ($this->db->connect_error) {
            throw new DatabaseException(
                'Wrong database configuration ' . $this->db->connect_errno . ': ' . $this->db->connect_error,
                false,
                false,
            );
        }

        if ($g_config['db_name'] != '') {
            if (!$this->db->select_db($g_config['db_name'])) {
                throw new UnableToFindDatabaseException('Cannnot find database ' . $g_config['db_name'], false, false);
            }
        }
        $this->traceTimeEnd();

        // Change character set to Unicode
        if (!$this->db->set_charset('utf8mb4')) {
            throw new DatabaseException("Error loading character set utf8mb4: %s\n", $this->db->error);
        }

        $this->applyDbSettings();

        return $this->db;
    }

    /**
     * Apply settings to the db (and some php settings), depending on the configuration and the type of job.
     */
    private function applyDbSettings(): void
    {
        global $g_config;
        global $g_user;
        global $is_job;

        $sessionVars = [];
        $sessionVars[] = "sql_mode = 'STRICT_TRANS_TABLES'";

        // Set the correct timeouts depending on user profile
        $waitTimeout = $g_config['db_timeout'];
        if ($is_job) {
            $waitTimeout = $g_config['db_job_timeout'];
        }
        $sessionVars[] = 'wait_timeout = ' . (int) $waitTimeout;
        $sessionVars[] = 'interactive_timeout = ' . (int) $waitTimeout;

        $type = 'player';
        if ($is_job) {
            $type = 'cronjob';
            // To avoid Mysql server is gone during cronjobs
            ini_set('mysql.connect_timeout', 300);
            ini_set('default_socket_timeout', 300);
        } elseif ($g_user->is_visitor()) {
            $type = 'visitor';
        } else {
            $type = 'player';
        }

        $maxExecutionTime = (int) $g_config['services_timeout']['mysql'][$type];
        $maxExecutionTimePhp = (int) $g_config['services_timeout']['php'][$type];

        if ($g_user->is_admin()) {
            $isNoLimit = false;
            if (isset($_GET['nolimit'])) {
                $isNoLimit = $_GET['nolimit'] === 'true';
                $_SESSION['nolimit'] = $isNoLimit;
            } else {
                $isNoLimit = $_SESSION['nolimit'] ?? false;
            }
            if ($isNoLimit) {
                $maxExecutionTime = null;
                $maxExecutionTimePhp = null;
            }
        }

        // max 10s PHP (Note: this is each job responsibility to increase this if not enough)
        set_time_limit($maxExecutionTimePhp ?: 10);

        if ($maxExecutionTime !== null) {
            $sessionVars[] = 'max_execution_time = ' . ((int) $maxExecutionTime) * 1000;
        }

        $this->query('SET SESSION ' . join(', ', $sessionVars));
    }

    /**
     * Assert we're connected to the DB, and that the connection is valid.
     * Reconnect if not.
     *
     * Note: only for master db.
     */
    public function assertConnection(): void
    {
        if ($this->db) {
            if ($this->db->query('SELECT 1') !== false) {
                // Seems ok!
                return;
            }
            $this->db->close();
        }
        $this->db = null;
        $this->connect();
    }

    /**
     * Helper function to start tracing duration
     */
    private function traceTimeStart(): void
    {
        $this->startTime = microtime(true);
    }

    /**
     * Helper function to trace duration
     */
    private function traceTimeEnd(): int
    {
        global $g_trace;
        if (!$this->startTime) {
            throw new \Exception('traceTimeStart not called');
        }
        $requestTime = (int) ((microtime(true) - $this->startTime) * 1000);
        $g_trace->incDbTime($requestTime);
        return $requestTime;
    }

    /**
     * Execute a query.
     * Connect to the database if necessary.
     */
    public function query(string $sql): null|mysqli_result|true
    {
        global $g_config;
        global $g_trace;

        $this->traceTimeStart();

        $db = $this->connect();

        global $bgaContainer;
        $bgaContainer->get(\Bga\Services\Sentry::class)->addBreadcrumb(
            category: 'query',
            message: $sql,
            metadata: [
                'database_connection' => $db === $this->db ? 'master' : 'slave',
            ],
        );

        try {
            $result = $db->query($sql);
        } catch (mysqli_sql_exception $e) {
            $result = null;
            $errno = $e->getCode();
        }

        $request_time = $this->traceTimeEnd();

        if ($g_config['trace_sql_queries']) {
            $g_trace->log(Level::Info, $request_time . ' ' . preg_replace('/\s*\n+\s*/', ' ', $sql));
        }

        if (!$result) {
            $error_txt =
                'Error (' . $db->errno . ') while processing SQL request: ' . $db->error . ' - Request: ' . $sql;

            $g_trace->log(Level::Error, $error_txt);
            if (!isset($errno)) {
                $errno = $db->errno;
            }
            if ($errno == 1213) {
                // This is a deadlock. Special message is issued
                throw new DatabaseDeadLockException(
                    'mysql_deadlock_restart_transaction',
                    false,
                    false,
                    FEX_mysql_deadlock_restart_transaction,
                    clienttranslate('Sorry, another player made the same action at the same time: please retry.'),
                );
            } elseif ($errno == 3024) {
                // Max execution time error
                throw new DatabaseTimeOutException(
                    'Maximum execution time exceeded (' . $db->host_info . ')',
                    false,
                    false,
                    FEX_mysql_max_execution_time_exceeded,
                    clienttranslate(
                        "Sorry, we didn't manage to process your request fast enough. Please retry. If the problem persists, please report a bug.",
                    ),
                );
            } elseif ($errno == 1064) {
                // SQL syntax error
                throw new DabaseSyntaxErrorException(
                    "Error while processing SQL request ({$db->host_info}): {$sql}\n{$db->error}",
                    false,
                    false,
                    FEX_sql_request_error,
                    clienttranslate('Error while processing database request'),
                );
            } elseif (in_array($errno, [2006,4031]) && $this->isAutoReconnect) {
                // MySQL server has gone away, reconnect
                $this->assertConnection();
                return $this->query($sql);
            } else {
                throw new DatabaseQueryErrorException(
                    'Error while processing SQL request (' . $db->host_info . '): ' . $sql . "\n" . $db->error,
                    false,
                    false,
                    FEX_sql_request_error,
                    clienttranslate('Error while processing database request'),
                );
            }
        }

        return $result;
    }

    /**
     * Returns the last inserted auto increment id.
     */
    public function getLastId(): int|string
    {
        $this->connect();
        $id = $this->db->insert_id;
        return $id;
    }

    /**
     * Returns number of the affected rows by the last query
     */
    public function getNumAffectedRows(): int
    {
        $this->connect();
        $nbr = (int) $this->db->affected_rows;
        return $nbr;
    }

    /**
     * Start a transaction
     */
    public function begin(): void
    {
        $this->query('BEGIN');
    }

    /**
     * Commit current transaction
     */
    public function commit(): void
    {
        $this->query('COMMIT');
    }

    /**
     * Rollback current transaction
     */
    public function rollback(): void
    {
        $this->query('ROLLBACK');
    }

    /**
     * Select a database.
     * 
     * @throws \Bga\Exceptions\Services\Db\UnableToFindDatabaseException if the database cannot be selected
     */
    public function select(string $dbname): true
    {
        $this->connect();
        $this->traceTimeStart();

        // Switch to this database
        if (!$this->db->select_db($dbname)) {
            throw new UnableToFindDatabaseException('Unable to find table database (1): ' . $dbname, false, false);
        }

        $this->traceTimeEnd();
        return true;
    }

    /**
     * Call commits, transactions
     */
    public function commitAllAndRestart()
    {
        $this->commit(); // Commit on DB
        $this->begin(); // And start a fresh transaction
    }

    /**
     * Set the behavior when deadlock occurs.
     * If set to "retry", then queries producing a deadlock will be reattempted once.
     *
     * Note: this is not managed in this class 😬, but only to be used with isDeadlockModeRetry()
     *
     * @deprecated
     */
    public function setDeadlockMode(string $mode): void
    {
        if ($mode != 'retry' && $mode != 'fail') {
            throw new feException('Wrong deadlock mode', false, false);
        }

        $this->deadlockMode = $mode;
    }

    /**
     * Returns true is deadlockMode is "retry".
     *
     * @deprecated
     */
    public function isDeadlockModeRetry(): bool
    {
        return $this->deadlockMode == 'retry';
    }

    /**
     * Execute all queries in one shot.
     *
     * @deprecated No real gain in doing multi queries
     */
    public function sendMultiQueries(array $queries): null|mysqli_result|true
    {
        global $g_config;
        global $g_trace;

        $this->traceTimeStart();
        $this->connect();

        $sql = join(';', $queries);

        global $bgaContainer;
        $bgaContainer->get(\Bga\Services\Sentry::class)->addBreadcrumb(
            category: 'query',
            message: $sql,
            metadata: [
                'database_connection' => 'master',
            ],
        );

        try {
            $result = $this->db->multi_query($sql);

            if ($result) {
                do {
                    if ($res = $this->db->store_result()) {
                        $res->close();
                    }

                    if (!$this->db->more_results()) {
                        break;
                    }
                } while ($this->db->next_result());

                if ($this->db->errno) {
                    // Error
                    $result = null;
                }
            } else {
                $result = null;
            }
        } catch (mysqli_sql_exception $e) {
            $result = null;
            $errno = $e->getCode();
        }

        $request_time = $this->traceTimeEnd();

        if ($g_config['trace_sql_queries']) {
            $g_trace->log(Level::Info, $request_time . ' ' . $sql);
        }

        if (!$result) {
            if (!isset($errno)) {
                $errno = $this->db->errno;
            }
            $g_trace->log(
                Level::Error,
                sprintf('Error (%s) while processing SQL request: %s - Request: %s', $errno, $this->db->error, $sql),
            );

            throw new DatabaseQueryErrorException(
                'Error while processing SQL request (' . $this->db->host_info . '): ' . $sql . "\n" . $this->db->error,
                false,
                false,
                FEX_sql_request_error,
                clienttranslate('Error while processing database request'),
            );
        }

        return $result;
    }

    /**
     * Returns a string ready to be inserted in DB.
     * Wrapper for db->real_escape_string.
     */
    public function escapeString(string $string): string
    {
        $this->connect();
        return $this->db->real_escape_string($string);
    }

    /**
     * Returns a string ready to be inserted in DB.
     * If it's null, returns "NULL".
     * Otherwise returns the string, escaped and quoted.
     */
    public function escapeStringOrNull(?string $string): string
    {
        if ($string === null) {
            return 'NULL';
        }
        return "'" . $this->escapeString($string) . "'";
    }

    /**
     * Returns an associative array of rows for the sql query.
     *
     * First column must be a primary or alternate key.
     */
    public function getCollection(string $sql, bool $bSingleValue = false): array
    {
        $dbres = $this->query($sql);
        $result = [];
        while ($row = $dbres->fetch_assoc()) {
            if ($bSingleValue) {
                $key = reset($row);
                $result[$key] = next($row);
            } else {
                $result[reset($row)] = $row;
            }
        }

        return $result;
    }

    /**
     * Returns a collection for the sql query as an associative array
     *
     * @throws DatabaseInvalidResultException if the result is empty.
     */
    public function getNonEmptyCollection(string $sql): ?array
    {
        $result = $this->getCollection($sql);

        if (count($result) == 0) {
            throw new DatabaseInvalidResultException(
                "Error : call to getCollection resulted in an empty resultset for the following query: \n" . $sql,
            );
        }

        return $result;
    }

    /**
     * Return an associative array of associative array.
     *
     * First array level correspond to first column.
     * Second array level correspond to second column.
     *
     * @param bool $bSingleValue if true, keep only third column on result
     */
    public function getDoubleKeyCollection(
        string $sql,
        bool $bSingleValue = false,
    ): array {
        $dbres = $this->query($sql);
        $result = [];
        while ($row = $dbres->fetch_assoc()) {
            $firstid = reset($row);
            $secondid = next($row);
            if (!isset($result[$firstid])) {
                $result[$firstid] = [];
            }

            if ($bSingleValue) {
                $result[$firstid][$secondid] = next($row);
            } else {
                $result[$firstid][$secondid] = $row;
            }
        }
        return $result;
    }

    /**
     *
     * Returns a unique value from DB or null if no value is found.
     *
     * @throws DatabaseInvalidResultException if more than 1 row is returned.
     */
    public function getUniqueValue(string $sql): ?string
    {
        $dbres = $this->query($sql);

        $result = [];
        while ($row = $dbres->fetch_row()) {
            $result[] = $row;
        }

        if (count($result) == 0) {
            return null;
        }
        if (count($result) > 1) {
            throw new DatabaseInvalidResultException(
                "Error : call to getUniqueValue resulted in a resultset with more than one row for the following query: \n" .
                    $sql,
            );
        }

        return $result[0][0];
    }

    /**
     *
     * Returns one row for the sql query as an associative array or null if there is no result.
     *
     * @throws DatabaseInvalidResultException if the query returns more than one row.
     */
    public function getObject(string $sql): ?array
    {
        $dbres = $this->query($sql);
        $result = [];
        while ($row = $dbres->fetch_assoc()) {
            $result[] = $row;
        }

        if (count($result) == 0) {
            return null;
        }
        if (count($result) > 1) {
            throw new DatabaseInvalidResultException(
                "Error : call to getObject resulted in a resultset with more than one row for the following query : \n" .
                    $sql,
            );
        }

        return $result[0];
    }

    /**
     *
     * Returns one row for the sql query as an associative array
     *
     * Raise an exception if the query doesn't return exactly one row
     *
     * @throws DatabaseInvalidResultException if not exactly one row is returned.
     */
    public function getNonEmptyObject(string $sql): array
    {
        $result = $this->getObject($sql);

        if ($result == null) {
            throw new DatabaseInvalidResultException(
                "Error : call to getObject resulted in an empty resultset for the following query : \n" . $sql,
            );
        }

        return $result;
    }

    /**
     * Returns several rows for the sql query as an array.
     */
    public function getObjectList(string $sql, bool $bUniqueValue = false): array
    {
        $dbres = $this->query($sql);

        $result = [];
        if ($bUniqueValue) {
            while ($row = $dbres->fetch_row()) {
                $result[] = $row[0];
            }
        } else {
            while ($row = $dbres->fetch_assoc()) {
                $result[] = $row;
            }
        }

        return $result;
    }
}
