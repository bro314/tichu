#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CRED_FILE=".vscode/bga-credentials.json"
SFTP_FILE=".vscode/sftp.json"

if [[ -f "$CRED_FILE" ]]; then
  HOST=$(jq -r '.sftp.host' "$CRED_FILE")
  PORT=$(jq -r '.sftp.port' "$CRED_FILE")
  USER=$(jq -r '.sftp.username' "$CRED_FILE")
  PW=$(jq -r '.sftp.password' "$CRED_FILE")
  REMOTE_PATH=$(jq -r '.sftp.remotePath' "$CRED_FILE")
elif [[ -f "$SFTP_FILE" ]]; then
  HOST=$(jq -r '.host' "$SFTP_FILE")
  PORT=$(jq -r '.port' "$SFTP_FILE")
  USER=$(jq -r '.username' "$SFTP_FILE")
  PW=$(jq -r '.password' "$SFTP_FILE")
  REMOTE_PATH=$(jq -r '.remotePath' "$SFTP_FILE")
else
  echo "Error: Missing $CRED_FILE and $SFTP_FILE" >&2
  exit 1
fi

is_deployable() {
  local f="$1"
  case "$f" in
    dbmodel.sql|gameinfos.inc.php|gameoptions.inc.php|material.inc.php|states.inc.php|stats.inc.php|tichu.action.php|tichu.css|tichu.game.php|tichu.js|tichu.view.php|tichu_tichu.tpl|modules/*.php|modules/managers/*.php|img/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

FILES=()

if [[ "${1:-}" == "--all" ]]; then
  FILES=(
    dbmodel.sql
    gameinfos.inc.php
    gameoptions.inc.php
    material.inc.php
    states.inc.php
    stats.inc.php
    tichu.action.php
    tichu.css
    tichu.game.php
    tichu.js
    tichu.view.php
    tichu_tichu.tpl
    modules/*.php
    modules/managers/*.php
  )
elif [[ $# -gt 0 ]]; then
  for arg in "$@"; do
    rel="${arg#./}"
    if ! is_deployable "$rel"; then
      echo "Skipping non-deployable file: $rel" >&2
      continue
    fi
    if [[ ! -f "$rel" ]]; then
      echo "Error: File not found: $rel" >&2
      exit 1
    fi
    FILES+=("$rel")
  done
else
  # Default: always upload tichu.js (gitignored bundle) + any modified deployable files in git status
  if [[ -f "tichu.js" ]]; then
    FILES+=("tichu.js")
  fi
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    file="${line:3}"
    # Handle renames "old -> new"
    file="${file##* -> }"
    if [[ -f "$file" ]] && is_deployable "$file" && [[ "$file" != "tichu.js" ]]; then
      FILES+=("$file")
    fi
  done < <(git status --porcelain)
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No deployable files to upload."
  exit 0
fi

SFTP_CMDS=""
for f in "${FILES[@]}"; do
  SFTP_CMDS+="send \"put $f ${REMOTE_PATH}$f\r\"\nexpect \"sftp>\"\n"
done

echo "Uploading ${#FILES[@]} file(s) to ${USER}@${HOST}:${REMOTE_PATH}: ${FILES[*]}"

/usr/bin/expect -c "
set timeout 30
spawn sftp -P ${PORT} -o StrictHostKeyChecking=no ${USER}@${HOST}
expect \"Password:\"
send \"${PW}\r\"
expect \"sftp>\"
$(printf "%b" "$SFTP_CMDS")
send \"bye\r\"
expect eof
"
