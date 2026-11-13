#!/usr/bin/env bash
set -euo pipefail

# Project-local MySQL 8.0 controller for the BGA Tichu local runner & test suites.
# Runs an isolated mysqld instance on a Unix socket inside local/.mysql/ with
# BGA Studio's exact transaction isolation (SERIALIZABLE) and zero global system changes.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MYSQL_DIR="${SCRIPT_DIR}/.mysql"
DATA_DIR="${MYSQL_DIR}/data"
SOCK_PATH="${MYSQL_DIR}/mysql.sock"
PID_FILE="${MYSQL_DIR}/mysqld.pid"
ERR_LOG="${MYSQL_DIR}/mysqld.err"
DEFAULT_DB="${TICHU_DB_NAME:-ebd_tichu_1}"

# Resolve Homebrew mysql@8.0 bin directory
MYSQL_BIN_DIR=""
if [[ -x "/opt/homebrew/opt/mysql@8.0/bin/mysqld" ]]; then
  MYSQL_BIN_DIR="/opt/homebrew/opt/mysql@8.0/bin"
elif [[ -x "/usr/local/opt/mysql@8.0/bin/mysqld" ]]; then
  MYSQL_BIN_DIR="/usr/local/opt/mysql@8.0/bin"
else
  for candidate in /opt/homebrew/Cellar/mysql@8.0/*/bin /usr/local/Cellar/mysql@8.0/*/bin; do
    if [[ -x "${candidate}/mysqld" ]]; then
      MYSQL_BIN_DIR="${candidate}"
      break
    fi
  done
fi

if [[ -z "${MYSQL_BIN_DIR}" ]]; then
  echo "Error: mysql@8.0 binaries not found. Install via: brew install mysql@8.0" >&2
  exit 1
fi

MYSQLD="${MYSQL_BIN_DIR}/mysqld"
MYSQL="${MYSQL_BIN_DIR}/mysql"
MYSQLADMIN="${MYSQL_BIN_DIR}/mysqladmin"

is_running() {
  [[ -S "${SOCK_PATH}" ]] && "${MYSQLADMIN}" --no-defaults --socket="${SOCK_PATH}" -u root ping >/dev/null 2>&1
}

ensure_db() {
  "${MYSQL}" --no-defaults --socket="${SOCK_PATH}" -u root -e \
    "CREATE DATABASE IF NOT EXISTS \`${DEFAULT_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
}

start_mysql() {
  if is_running; then
    ensure_db
    return 0
  fi

  mkdir -p "${MYSQL_DIR}"

  if [[ ! -d "${DATA_DIR}/mysql" ]]; then
    rm -rf "${DATA_DIR}"
    mkdir -p "${DATA_DIR}"
    "${MYSQLD}" --no-defaults \
      --initialize-insecure \
      --datadir="${DATA_DIR}" \
      --log-error="${ERR_LOG}" >/dev/null 2>&1
  fi

  nohup "${MYSQLD}" --no-defaults \
    --datadir="${DATA_DIR}" \
    --socket="${SOCK_PATH}" \
    --pid-file="${PID_FILE}" \
    --log-error="${ERR_LOG}" \
    --skip-networking \
    --mysqlx=0 \
    --transaction-isolation=SERIALIZABLE \
    --sql-mode=STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION \
    --default-time-zone=+00:00 \
    --character-set-server=utf8mb4 \
    --innodb-flush-log-at-trx-commit=2 \
    --innodb-buffer-pool-size=64M \
    --skip-log-bin >/dev/null 2>&1 &

  local retries=60
  while (( retries > 0 )); do
    if is_running; then
      ensure_db
      return 0
    fi
    sleep 0.1
    (( retries-- ))
  done

  echo "Error: mysqld failed to start within 6s. Check ${ERR_LOG}:" >&2
  tail -n 30 "${ERR_LOG}" >&2 || true
  exit 1
}

stop_mysql() {
  if is_running; then
    "${MYSQLADMIN}" --no-defaults --socket="${SOCK_PATH}" -u root shutdown >/dev/null 2>&1 || true
  fi
  rm -f "${SOCK_PATH}" "${PID_FILE}"
}

cmd="${1:-ensure}"
case "${cmd}" in
  ensure)
    start_mysql
    ;;
  start)
    start_mysql
    echo "MySQL 8.0 running on ${SOCK_PATH} (db: ${DEFAULT_DB})"
    ;;
  stop)
    stop_mysql
    echo "MySQL 8.0 stopped."
    ;;
  status)
    if is_running; then
      "${MYSQL}" --no-defaults --socket="${SOCK_PATH}" -u root "${DEFAULT_DB}" -e \
        "SELECT VERSION() AS mysql_version, @@transaction_isolation AS isolation, DATABASE() AS db_name;"
    else
      echo "MySQL 8.0 is not running."
      exit 1
    fi
    ;;
  reset)
    stop_mysql
    rm -rf "${MYSQL_DIR}"
    start_mysql
    echo "MySQL 8.0 reset and running on ${SOCK_PATH} (db: ${DEFAULT_DB})"
    ;;
  *)
    echo "Usage: $0 {ensure|start|stop|status|reset}" >&2
    exit 1
    ;;
esac
