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
  PW=$(jq -r '.sftp.password // ""' "$CRED_FILE")
  PRIVATE_KEY_PATH=$(jq -r '.sftp.privateKeyPath // ""' "$CRED_FILE")
  REMOTE_PATH=$(jq -r '.sftp.remotePath' "$CRED_FILE")
elif [[ -f "$SFTP_FILE" ]]; then
  HOST=$(jq -r '.host' "$SFTP_FILE")
  PORT=$(jq -r '.port' "$SFTP_FILE")
  USER=$(jq -r '.username' "$SFTP_FILE")
  PW=$(jq -r '.password // ""' "$SFTP_FILE")
  PRIVATE_KEY_PATH=$(jq -r '.privateKeyPath // ""' "$SFTP_FILE")
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

# Always block upload if any deployable file violates static contracts or BGA platform safety rules.
php local/check-contracts.php >/dev/null

SFTP_CMDS=""
for f in "${FILES[@]}"; do
  SFTP_CMDS+="send \"put $f ${REMOTE_PATH}$f\r\"\nexpect \"sftp>\"\n"
done

echo "Uploading ${#FILES[@]} file(s) to ${USER}@${HOST}:${REMOTE_PATH}: ${FILES[*]}"

if [[ -n "$PRIVATE_KEY_PATH" ]]; then
  SSH_AUTH_OPTS="-F /dev/null -i ${PRIVATE_KEY_PATH/#\~/$HOME} -o IdentitiesOnly=yes -o IdentityAgent=none -o PreferredAuthentications=publickey"
else
  SSH_AUTH_OPTS="-F /dev/null -o PreferredAuthentications=password -o PubkeyAuthentication=no -o IdentityAgent=none"
fi

set +e
OUTPUT=$(/usr/bin/expect -c "
set timeout 30
set sent_pw 0
spawn sftp -P ${PORT} -o StrictHostKeyChecking=no -o ServerAliveInterval=10 -o ServerAliveCountMax=3 -o ConnectTimeout=15 ${SSH_AUTH_OPTS} ${USER}@${HOST}
expect {
  -nocase \"password:\" {
    if {\$sent_pw > 0} { exit 2 }
    set sent_pw 1
    send \"${PW}\r\"
    exp_continue
  }
  \"sftp>\" {}
  -nocase \"permission denied\" { exit 2 }
  eof { exit 2 }
  timeout { exit 3 }
}
$(printf "%b" "$SFTP_CMDS")
send \"bye\r\"
expect eof
")
EXPECT_RC=$?
set -e
printf "%s\n" "$OUTPUT"
if [[ $EXPECT_RC -ne 0 ]]; then
  echo "Error: SFTP connection or authentication failed (exit $EXPECT_RC)." >&2
  exit 1
fi

AFTER_CONNECT=$(printf "%s\n" "$OUTPUT" | awk '/Connected to/{flag=1; next} flag')
if [[ -z "$AFTER_CONNECT" ]]; then
  echo "Error: SFTP did not connect cleanly." >&2
  exit 1
fi
if printf "%s\n" "$AFTER_CONNECT" | grep -qE "Permission denied|not found|Failure|Couldn't|Connection reset|Broken pipe|Connection closed|not open|timed out"; then
  echo "Error: SFTP upload failed (see errors above)." >&2
  exit 1
fi
