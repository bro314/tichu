<?php
/**
 * Static contract verification for Tichu (no DB or live server required).
 *
 * Checks:
 *  1. DB schema & upgradeTableDb() safety (no `--` comments, DBPREFIX_ usage).
 *  2. Translation & PHP 8.4 string interpolation safety (clienttranslate/totranslate, no `${var}`, i18n keys).
 *  3. State machine integrity (unique ST_* constants, valid transitions, BFS reachability, action/args/possibleactions).
 *  4. Notification contract (NotificationManager.php <-> TichuNotificationMap <-> tichu.ts <-> tichu-replay.ts).
 *  5. Action contract (tichu.action.php <-> TichuActionMap <-> tichu.ts).
 */

declare(strict_types=1);

$root = dirname(__DIR__);
$errors = [];

function addError(array &$errors, string $category, string $message): void
{
  $errors[] = "[$category] $message";
}

function unquotePhpString(string $raw): string
{
  if (strlen($raw) >= 2 && ($raw[0] === "'" || $raw[0] === '"')) {
    return stripcslashes(substr($raw, 1, -1));
  }
  return $raw;
}

/**
 * Find next non-whitespace, non-comment token index starting at $i.
 */
function nextSigToken(array $tokens, int $i): ?int
{
  $count = count($tokens);
  while ($i < $count) {
    $tok = $tokens[$i];
    if (is_array($tok) && in_array($tok[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
      $i++;
      continue;
    }
    return $i;
  }
  return null;
}

/**
 * Parse a balanced argument list starting at the '(' token index.
 * Returns [argument token arrays, closing ')' token index].
 */
function parseCallArgs(array $tokens, int $openParenIdx): array
{
  $args = [];
  $current = [];
  $depth = 0;
  $bracketDepth = 0;
  $count = count($tokens);
  for ($i = $openParenIdx + 1; $i < $count; $i++) {
    $tok = $tokens[$i];
    if ($tok === "(") {
      $depth++;
      $current[] = $tok;
    } elseif ($tok === ")") {
      if ($depth === 0) {
        if (!empty($current)) {
          $args[] = $current;
        }
        return [$args, $i];
      }
      $depth--;
      $current[] = $tok;
    } elseif ($tok === "[") {
      $bracketDepth++;
      $current[] = $tok;
    } elseif ($tok === "]") {
      $bracketDepth--;
      $current[] = $tok;
    } elseif ($tok === "," && $depth === 0 && $bracketDepth === 0) {
      $args[] = $current;
      $current = [];
    } else {
      $current[] = $tok;
    }
  }
  return [$args, $count - 1];
}

/**
 * Extract top-level literal array keys from a `[ ... ]` or `array(...)` token slice.
 * Returns null if the argument is dynamic (not an array literal), or list of string keys.
 */
function extractArrayLiteralKeys(array $argTokens): ?array
{
  $sig = [];
  foreach ($argTokens as $tok) {
    if (is_array($tok) && in_array($tok[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
      continue;
    }
    $sig[] = $tok;
  }
  if (empty($sig)) {
    return null;
  }

  $startIdx = 0;
  $endIdx = count($sig) - 1;
  if ($sig[0] === "[" && $sig[$endIdx] === "]") {
    $startIdx = 1;
    $endIdx--;
  } elseif (
    is_array($sig[0]) &&
    $sig[0][0] === T_ARRAY &&
    isset($sig[1]) &&
    $sig[1] === "(" &&
    $sig[$endIdx] === ")"
  ) {
    $startIdx = 2;
    $endIdx--;
  } else {
    return null;
  }

  $keys = [];
  $depth = 0;
  $pendingKey = null;
  for ($i = $startIdx; $i <= $endIdx; $i++) {
    $tok = $sig[$i];
    if ($tok === "[" || $tok === "(" || $tok === "{") {
      $depth++;
      continue;
    }
    if ($tok === "]" || $tok === ")" || $tok === "}") {
      $depth--;
      continue;
    }
    if ($depth !== 0) {
      continue;
    }
    if (is_array($tok) && $tok[0] === T_CONSTANT_ENCAPSED_STRING && $pendingKey === null) {
      $pendingKey = unquotePhpString($tok[1]);
    } elseif (is_array($tok) && $tok[0] === T_DOUBLE_ARROW) {
      if ($pendingKey !== null) {
        $keys[] = $pendingKey;
        $pendingKey = null;
      }
    } elseif ($tok === ",") {
      $pendingKey = null;
    } else {
      $pendingKey = null;
    }
  }
  return $keys;
}

/**
 * Extract methods of a named PHP class from tokens.
 * Returns array of [methodName => ['visibility' => 'public'|'protected'|'private', 'bodyTokens' => [...], 'line' => int]].
 */
function extractClassMethods(string $phpFile, string $targetClass): array
{
  $code = file_get_contents($phpFile);
  if ($code === false) {
    return [];
  }
  $tokens = token_get_all($code);
  $count = count($tokens);
  $inTargetClass = false;
  $braceDepth = 0;
  $classBraceDepth = null;
  $visibility = "public";
  $methods = [];

  for ($i = 0; $i < $count; $i++) {
    $tok = $tokens[$i];
    if (!$inTargetClass) {
      if (is_array($tok) && $tok[0] === T_CLASS) {
        $nameIdx = nextSigToken($tokens, $i + 1);
        if ($nameIdx !== null && is_array($tokens[$nameIdx]) && $tokens[$nameIdx][1] === $targetClass) {
          $inTargetClass = true;
          $classBraceDepth = $braceDepth;
        }
      }
      if ($tok === "{" || (is_array($tok) && in_array($tok[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) {
        $braceDepth++;
      } elseif ($tok === "}") {
        $braceDepth--;
      }
      continue;
    }

    if ($tok === "{" || (is_array($tok) && in_array($tok[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) {
      $braceDepth++;
    } elseif ($tok === "}") {
      $braceDepth--;
      if ($braceDepth === $classBraceDepth) {
        break;
      }
    }

    if ($braceDepth !== $classBraceDepth + 1) {
      continue;
    }

    if (is_array($tok) && in_array($tok[0], [T_PUBLIC, T_PROTECTED, T_PRIVATE], true)) {
      $visibility = strtolower($tok[1]);
    } elseif (is_array($tok) && $tok[0] === T_FUNCTION) {
      $nameIdx = nextSigToken($tokens, $i + 1);
      if ($nameIdx !== null && is_array($tokens[$nameIdx]) && $tokens[$nameIdx][0] === T_STRING) {
        $methodName = $tokens[$nameIdx][1];
        $methodLine = $tokens[$nameIdx][2];
        // Find opening '{' of method body
        $bodyStart = $nameIdx + 1;
        while ($bodyStart < $count && $tokens[$bodyStart] !== "{") {
          $bodyStart++;
        }
        $bodyTokens = [];
        $mDepth = 0;
        $j = $bodyStart;
        for (; $j < $count; $j++) {
          $t = $tokens[$j];
          $bodyTokens[] = $t;
          if ($t === "{" || (is_array($t) && in_array($t[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) {
            $mDepth++;
          } elseif ($t === "}") {
            $mDepth--;
            if ($mDepth === 0) {
              break;
            }
          }
        }
        $methods[$methodName] = [
          "visibility" => $visibility,
          "bodyTokens" => $bodyTokens,
          "line" => $methodLine,
        ];
        $i = $j;
      }
      $visibility = "public";
    }
  }
  return $methods;
}

/**
 * Extract named TypeScript interface block properties from src/types/tichu-contracts.ts.
 * Returns [key => string[] property names (empty array if Record<...> or {})].
 */
function parseTsContractMap(string $tsSource, string $interfaceName): array
{
  $pattern = '/export\s+interface\s+' . preg_quote($interfaceName, "/") . '\s*\{/';
  if (!preg_match($pattern, $tsSource, $m, PREG_OFFSET_CAPTURE)) {
    return [];
  }
  $start = $m[0][1] + strlen($m[0][0]);
  $depth = 1;
  $len = strlen($tsSource);
  $pos = $start;
  while ($pos < $len && $depth > 0) {
    $ch = $tsSource[$pos];
    if ($ch === "{") {
      $depth++;
    } elseif ($ch === "}") {
      $depth--;
      if ($depth === 0) {
        break;
      }
    }
    $pos++;
  }
  $body = substr($tsSource, $start, $pos - $start);
  // Strip line comments and block comments inside the interface body
  $body = preg_replace('!/\*.*?\*/!s', "", $body);
  $body = preg_replace('!//.*$!m', "", $body);

  $entries = [];
  $i = 0;
  $bLen = strlen($body);
  while ($i < $bLen) {
    while ($i < $bLen && (ctype_space($body[$i]) || $body[$i] === ";")) {
      $i++;
    }
    if ($i >= $bLen) {
      break;
    }
    if (!preg_match('/\G(?:"([A-Za-z0-9_]+)"|\'([A-Za-z0-9_]+)\'|([A-Za-z0-9_]+))\s*:\s*/', $body, $km, 0, $i)) {
      $i++;
      continue;
    }
    $key = $km[1] !== "" ? $km[1] : ($km[2] !== "" ? $km[2] : $km[3]);
    $i += strlen($km[0]);
    if ($i < $bLen && $body[$i] === "{") {
      $objDepth = 1;
      $objStart = $i + 1;
      $i++;
      while ($i < $bLen && $objDepth > 0) {
        if ($body[$i] === "{") {
          $objDepth++;
        } elseif ($body[$i] === "}") {
          $objDepth--;
        }
        $i++;
      }
      $objBody = substr($body, $objStart, ($i - 1) - $objStart);
      $props = [];
      // Parse top-level property names inside the object type
      $pDepth = 0;
      $lines = preg_split('/[;\n]/', $objBody);
      foreach ($lines as $line) {
        $trim = trim($line);
        if ($trim === "") {
          continue;
        }
        if ($pDepth === 0 && preg_match('/^(?:"([A-Za-z0-9_]+)"|([A-Za-z0-9_]+))\??\s*:/', $trim, $pm)) {
          $props[] = $pm[1] !== "" ? $pm[1] : $pm[2];
        }
        $pDepth += substr_count($trim, "{") - substr_count($trim, "}");
      }
      $entries[$key] = $props;
    } else {
      // Single-line type expression up to ';'
      $semi = strpos($body, ";", $i);
      $i = $semi === false ? $bLen : $semi + 1;
      $entries[$key] = null; // opaque/Record type
    }
  }
  return $entries;
}

// ============================================================================
// 1. DB Schema & upgradeTableDb()
// ============================================================================
$dbSchemaPath = "$root/dbmodel.sql";
$dbSql = file_get_contents($dbSchemaPath);
if ($dbSql === false) {
  addError($errors, "DB", "Missing dbmodel.sql");
} else {
  $sqlNoComments = trim((string) preg_replace('!/\*.*?\*/!s', "", $dbSql));
  // Strip single-quoted and backticked strings before checking for `--` comments
  $sqlNoStrings = preg_replace(["/'(?:\\\\.|[^'])*'/", '/`[^`]*`/'], "''", $sqlNoComments);
  if (strpos($sqlNoStrings, "--") !== false) {
    addError($errors, "DB", "dbmodel.sql contains forbidden '--' SQL comment (BGA strips newlines before executing)");
  }
  if ($sqlNoComments === "" || substr($sqlNoComments, -1) !== ";") {
    addError($errors, "DB", "dbmodel.sql must contain non-empty SQL ending with ';'");
  }
}

$gameMethods = extractClassMethods("$root/tichu.game.php", "Tichu");
if (!isset($gameMethods["upgradeTableDb"])) {
  addError($errors, "DB", "Tichu::upgradeTableDb() method not found in tichu.game.php");
} else {
  // Only applyDbUpgradeToAllDB() substitutes `DBPREFIX_`; read helpers like
  // getObjectListFromDB / getCollectionFromDb / getUniqueValueFromDB query raw table names directly.
  $upgradeTokens = $gameMethods["upgradeTableDb"]["bodyTokens"];
  for ($i = 0, $uc = count($upgradeTokens); $i < $uc; $i++) {
    $tok = $upgradeTokens[$i];
    if (!is_array($tok) || $tok[0] !== T_STRING || $tok[1] !== "applyDbUpgradeToAllDB") {
      continue;
    }
    $openIdx = nextSigToken($upgradeTokens, $i + 1);
    if ($openIdx === null || $upgradeTokens[$openIdx] !== "(") {
      continue;
    }
    [$callArgs, $closeIdx] = parseCallArgs($upgradeTokens, $openIdx);
    foreach ($callArgs as $argTokens) {
      foreach ($argTokens as $at) {
        if (!is_array($at) || !in_array($at[0], [T_CONSTANT_ENCAPSED_STRING, T_ENCAPSED_AND_WHITESPACE], true)) {
          continue;
        }
        $str = $at[0] === T_CONSTANT_ENCAPSED_STRING ? unquotePhpString($at[1]) : $at[1];
        $line = $at[2];
        if (
          preg_match_all(
            '/\b(?:FROM|INTO|UPDATE|ALTER\s+TABLE|CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|DROP\s+TABLE(?:\s+IF\s+EXISTS)?|JOIN)\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/i',
            $str,
            $tm
          )
        ) {
          foreach ($tm[1] as $tableRef) {
            if (strpos($tableRef, "DBPREFIX_") !== 0) {
              addError(
                $errors,
                "DB",
                "applyDbUpgradeToAllDB() SQL on line $line references table '$tableRef' without DBPREFIX_"
              );
            }
          }
        }
      }
    }
    $i = $closeIdx;
  }
}

// ============================================================================
// 2. Translation & PHP 8.4 String Interpolation
// ============================================================================
$phpFiles = [
  "$root/tichu.game.php",
  "$root/tichu.action.php",
  "$root/tichu.view.php",
  "$root/states.inc.php",
  "$root/material.inc.php",
  "$root/gameoptions.inc.php",
  "$root/stats.inc.php",
];
$modIter = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("$root/modules"));
foreach ($modIter as $fileInfo) {
  if ($fileInfo->isFile() && $fileInfo->getExtension() === "php") {
    $phpFiles[] = $fileInfo->getPathname();
  }
}

foreach ($phpFiles as $file) {
  $rel = str_replace("$root/", "", $file);
  $src = file_get_contents($file);
  if ($src === false) {
    continue;
  }
  $tokens = token_get_all($src);
  $count = count($tokens);
  for ($i = 0; $i < $count; $i++) {
    $tok = $tokens[$i];
    if (!is_array($tok)) {
      continue;
    }
    if ($tok[0] === T_DOLLAR_OPEN_CURLY_BRACES) {
      addError($errors, "PHP8.4", "$rel:{$tok[2]} uses deprecated \${var} string interpolation");
    }
    if ($tok[0] === T_STRING && in_array(strtolower($tok[1]), ["clienttranslate", "totranslate"], true)) {
      $fnName = $tok[1];
      $fnLine = $tok[2];
      // Skip function definitions (`function clienttranslate`)
      $prev = $i - 1;
      while ($prev >= 0 && is_array($tokens[$prev]) && $tokens[$prev][0] === T_WHITESPACE) {
        $prev--;
      }
      if ($prev >= 0 && is_array($tokens[$prev]) && $tokens[$prev][0] === T_FUNCTION) {
        continue;
      }
      $openIdx = nextSigToken($tokens, $i + 1);
      if ($openIdx === null || $tokens[$openIdx] !== "(") {
        continue;
      }
      [$args, $closeIdx] = parseCallArgs($tokens, $openIdx);
      if (count($args) !== 1) {
        addError($errors, "i18n", "$rel:$fnLine $fnName() must receive exactly 1 literal string argument");
        $i = $closeIdx;
        continue;
      }
      $sig = [];
      foreach ($args[0] as $at) {
        if (is_array($at) && in_array($at[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
          continue;
        }
        $sig[] = $at;
      }
      if (count($sig) !== 1 || !is_array($sig[0]) || $sig[0][0] !== T_CONSTANT_ENCAPSED_STRING) {
        addError(
          $errors,
          "i18n",
          "$rel:$fnLine $fnName() argument must be a single literal string without variables or concatenation"
        );
      }
      $i = $closeIdx;
    }
  }
}

$tsIter = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("$root/src"));
foreach ($tsIter as $fileInfo) {
  if (!$fileInfo->isFile() || $fileInfo->getExtension() !== "ts") {
    continue;
  }
  $rel = str_replace("$root/", "", $fileInfo->getPathname());
  $tsSrc = file_get_contents($fileInfo->getPathname());
  if ($tsSrc !== false && preg_match('/\bclienttranslate\s*\(\s*(\$|`[^`]*\$\{)/', $tsSrc)) {
    addError($errors, "i18n", "$rel uses clienttranslate(\$...) interpolation");
  }
}

// ============================================================================
// 3. State Machine Integrity
// ============================================================================
require_once "$root/modules/Constants.php";
if (!function_exists("clienttranslate")) {
  function clienttranslate($text)
  {
    return $text;
  }
}

// Check ST_* constant uniqueness via tokens on Constants.php
$constTokens = token_get_all((string) file_get_contents("$root/modules/Constants.php"));
$stValues = [];
for ($i = 0, $c = count($constTokens); $i < $c; $i++) {
  $t = $constTokens[$i];
  if (
    is_array($t) &&
    $t[0] === T_CONSTANT_ENCAPSED_STRING &&
    strpos(unquotePhpString($t[1]), "ST_") === 0
  ) {
    $constName = unquotePhpString($t[1]);
    $val = constant($constName);
    if (isset($stValues[$val])) {
      addError(
        $errors,
        "FSM",
        "Duplicate state ID $val for constants $constName and {$stValues[$val]}"
      );
    }
    $stValues[$val] = $constName;
  }
}

$machinestates = [];
require "$root/states.inc.php";

$actionMethods = extractClassMethods("$root/tichu.action.php", "action_tichu");
$actionAliasMap = [
  "giveCards" => "giveTheCards",
  "phoenixPlay" => "choosePhoenix",
];

if (!isset($machinestates[ST_NEW_ROUND])) {
  addError($errors, "FSM", "ST_NEW_ROUND (" . ST_NEW_ROUND . ") missing from \$machinestates");
}
$validStateTargets = array_fill_keys(array_keys($machinestates), true);
$validStateTargets[ST_GAME_SETUP] = true;
$validStateTargets[ST_GAME_END] = true;

foreach ($machinestates as $stateId => $state) {
  $stateName = $state["name"] ?? (string) $stateId;
  if (!empty($state["action"]) && $state["action"] !== "stGameSetup") {
    $act = $state["action"];
    if (!isset($gameMethods[$act])) {
      addError($errors, "FSM", "State $stateId ($stateName) action '$act' missing from class Tichu");
    }
  }
  if (!empty($state["args"])) {
    $argMethod = $state["args"];
    if (!isset($gameMethods[$argMethod])) {
      addError($errors, "FSM", "State $stateId ($stateName) args '$argMethod' missing from class Tichu");
    }
  }
  if (!empty($state["possibleactions"])) {
    foreach ($state["possibleactions"] as $pa) {
      $endpoint = $actionAliasMap[$pa] ?? $pa;
      if (!isset($actionMethods[$endpoint]) || $actionMethods[$endpoint]["visibility"] !== "public") {
        addError(
          $errors,
          "FSM",
          "State $stateId ($stateName) possibleaction '$pa' (endpoint '$endpoint') missing public method on action_tichu"
        );
      }
    }
  }
  if (!empty($state["transitions"])) {
    foreach ($state["transitions"] as $transName => $targetId) {
      if (!isset($validStateTargets[$targetId])) {
        addError(
          $errors,
          "FSM",
          "State $stateId ($stateName) transition '$transName' points to unknown state ID $targetId"
        );
      }
    }
  }
}

// BFS reachability from ST_NEW_ROUND (setupNewGame returns ST_NEW_ROUND)
$visited = [];
$queue = [];
if (isset($machinestates[ST_NEW_ROUND])) {
  $visited[ST_NEW_ROUND] = true;
  $queue[] = ST_NEW_ROUND;
}
while (!empty($queue)) {
  $cur = array_shift($queue);
  $transitions = $machinestates[$cur]["transitions"] ?? [];
  foreach ($transitions as $targetId) {
    if (isset($validStateTargets[$targetId]) && empty($visited[$targetId])) {
      $visited[$targetId] = true;
      if (isset($machinestates[$targetId])) {
        $queue[] = $targetId;
      }
    }
  }
}
foreach ($machinestates as $stateId => $state) {
  if (empty($visited[$stateId])) {
    $stateName = $state["name"] ?? (string) $stateId;
    addError($errors, "FSM", "State $stateId ($stateName) is unreachable from ST_NEW_ROUND");
  }
}
if (empty($visited[ST_GAME_END])) {
  addError($errors, "FSM", "ST_GAME_END (" . ST_GAME_END . ") is unreachable from ST_NEW_ROUND");
}

// ============================================================================
// 4. Notification Contract
// ============================================================================
$notifPhpFile = "$root/modules/managers/NotificationManager.php";
$notifTokens = token_get_all((string) file_get_contents($notifPhpFile));
$phpNotifs = []; // [type => string[]|null literal payload keys]
for ($i = 0, $c = count($notifTokens); $i < $c; $i++) {
  $tok = $notifTokens[$i];
  if (is_array($tok) && $tok[0] === T_STRING && in_array($tok[1], ["notifyAllPlayers", "notifyPlayer"], true)) {
    $isAll = $tok[1] === "notifyAllPlayers";
    $openIdx = nextSigToken($notifTokens, $i + 1);
    if ($openIdx === null || $notifTokens[$openIdx] !== "(") {
      continue;
    }
    [$args, $closeIdx] = parseCallArgs($notifTokens, $openIdx);
    $typeArgIdx = $isAll ? 0 : 1;
    $payloadArgIdx = $isAll ? 2 : 3;
    if (!isset($args[$typeArgIdx], $args[$payloadArgIdx])) {
      continue;
    }
    $typeName = null;
    foreach ($args[$typeArgIdx] as $at) {
      if (is_array($at) && $at[0] === T_CONSTANT_ENCAPSED_STRING) {
        $typeName = unquotePhpString($at[1]);
        break;
      }
    }
    if ($typeName === null) {
      continue;
    }
    $keys = extractArrayLiteralKeys($args[$payloadArgIdx]);
    if (!isset($phpNotifs[$typeName])) {
      $phpNotifs[$typeName] = $keys;
    } elseif ($keys !== null && is_array($phpNotifs[$typeName])) {
      $phpNotifs[$typeName] = array_values(array_unique(array_merge($phpNotifs[$typeName], $keys)));
    }
    $i = $closeIdx;
  }
}

foreach (["playCombo", "wishMade"] as $i18nNotif) {
  if (!isset($phpNotifs[$i18nNotif]) || !is_array($phpNotifs[$i18nNotif]) || !in_array("i18n", $phpNotifs[$i18nNotif], true)) {
    addError($errors, "i18n", "NotificationManager::$i18nNotif payload must declare 'i18n' key");
  }
}

$contractsTs = (string) file_get_contents("$root/src/types/tichu-contracts.ts");
$tsNotifs = parseTsContractMap($contractsTs, "TichuNotificationMap");
$tsActions = parseTsContractMap($contractsTs, "TichuActionMap");

if (empty($tsNotifs)) {
  addError($errors, "Contracts", "Could not parse TichuNotificationMap in src/types/tichu-contracts.ts");
}
if (empty($tsActions)) {
  addError($errors, "Contracts", "Could not parse TichuActionMap in src/types/tichu-contracts.ts");
}

foreach ($phpNotifs as $type => $phpKeys) {
  if (!array_key_exists($type, $tsNotifs)) {
    addError($errors, "NotifContract", "PHP notification '$type' missing from TichuNotificationMap");
    continue;
  }
  $tsKeys = $tsNotifs[$type];
  if (is_array($phpKeys) && is_array($tsKeys)) {
    foreach ($phpKeys as $pk) {
      if (!in_array($pk, $tsKeys, true)) {
        addError(
          $errors,
          "NotifContract",
          "PHP notification '$type' payload key '$pk' missing from TichuNotificationMap['$type']"
        );
      }
    }
    foreach ($tsKeys as $tk) {
      if (!in_array($tk, $phpKeys, true)) {
        addError(
          $errors,
          "NotifContract",
          "TS TichuNotificationMap['$type'] property '$tk' not emitted by NotificationManager.php"
        );
      }
    }
  }
}

foreach (array_keys($tsNotifs) as $type) {
  if (!array_key_exists($type, $phpNotifs)) {
    addError(
      $errors,
      "NotifContract",
      "TS TichuNotificationMap entry '$type' not emitted by NotificationManager.php"
    );
  }
}

// Check src/tichu.ts setupNotifications() and notif_* methods
$tichuTs = (string) file_get_contents("$root/src/tichu.ts");
$bgaBuiltinNotifs = ["log", "tableWindow"];
$subscribedNotifs = [];
if (preg_match('/setupNotifications\s*\(\)\s*\{(.*?)\n  \}/s', $tichuTs, $snMatch)) {
  $snBody = $snMatch[1];
  if (preg_match('/const\s+notifs[^=]*=\s*\{(.*?)\};/s', $snBody, $mapMatch)) {
    if (preg_match_all('/^\s*([A-Za-z0-9_]+)\s*:/m', $mapMatch[1], $nm)) {
      $subscribedNotifs = $nm[1];
    }
  }
}
preg_match_all('/^\s*notif_([A-Za-z0-9_]+)\s*\(/m', $tichuTs, $handlerMatches);
$handlerNotifs = $handlerMatches[1] ?? [];

foreach (array_keys($tsNotifs) as $type) {
  if (in_array($type, $bgaBuiltinNotifs, true)) {
    continue;
  }
  if (!in_array($type, $subscribedNotifs, true)) {
    addError($errors, "NotifContract", "Notification '$type' not subscribed in src/tichu.ts setupNotifications()");
  }
  if (!in_array($type, $handlerNotifs, true)) {
    addError($errors, "NotifContract", "Notification handler notif_$type() missing in src/tichu.ts");
  }
}
foreach ($subscribedNotifs as $sub) {
  if (!array_key_exists($sub, $tsNotifs)) {
    addError($errors, "NotifContract", "src/tichu.ts subscribes to unknown notification '$sub'");
  }
}
foreach ($handlerNotifs as $h) {
  if (!array_key_exists($h, $tsNotifs)) {
    addError($errors, "NotifContract", "src/tichu.ts defines handler notif_$h() not in TichuNotificationMap");
  }
}

// Check src/elements/tichu-replay.ts handles or explicitly ignores every TichuNotificationMap entry
$replayTs = (string) file_get_contents("$root/src/elements/tichu-replay.ts");
$replayHandled = [];
if (preg_match('/private\s+next\s*\(\)\s*\{(.*?)\n  \}/s', $replayTs, $nextMatch)) {
  if (preg_match_all('/type\s*===\s*"([A-Za-z0-9_]+)"/', $nextMatch[1], $rm)) {
    $replayHandled = array_merge($replayHandled, $rm[1]);
  }
}
if (preg_match('/function\s+isIgnored\s*\([^\)]*\)\s*\{(.*?)\n\}/s', $replayTs, $ignMatch)) {
  if (preg_match_all('/type\s*===\s*"([A-Za-z0-9_]+)"/', $ignMatch[1], $im)) {
    $replayHandled = array_merge($replayHandled, $im[1]);
  }
}
$replayHandled = array_unique($replayHandled);
foreach (array_keys($tsNotifs) as $type) {
  if (!in_array($type, $replayHandled, true)) {
    addError(
      $errors,
      "NotifContract",
      "Notification '$type' neither handled in next() nor listed in isIgnored() in src/elements/tichu-replay.ts"
    );
  }
}

// ============================================================================
// 5. Action Contract (tichu.action.php <-> TichuActionMap <-> tichu.ts)
// ============================================================================
$phpActions = []; // [actionName => string[] getArg names]
foreach ($actionMethods as $methodName => $info) {
  if ($info["visibility"] !== "public" || strpos($methodName, "__") === 0) {
    continue;
  }
  $argNames = [];
  $bt = $info["bodyTokens"];
  $bCount = count($bt);
  for ($i = 0; $i < $bCount; $i++) {
    $tok = $bt[$i];
    if (is_array($tok) && $tok[0] === T_STRING && $tok[1] === "getArg") {
      $openIdx = nextSigToken($bt, $i + 1);
      if ($openIdx === null || $bt[$openIdx] !== "(") {
        continue;
      }
      [$gArgs, $closeIdx] = parseCallArgs($bt, $openIdx);
      if (isset($gArgs[0])) {
        foreach ($gArgs[0] as $at) {
          if (is_array($at) && $at[0] === T_CONSTANT_ENCAPSED_STRING) {
            $argNames[] = unquotePhpString($at[1]);
            break;
          }
        }
      }
      $i = $closeIdx;
    }
  }
  $phpActions[$methodName] = array_values(array_unique($argNames));
}

foreach ($phpActions as $actName => $phpArgNames) {
  if (!array_key_exists($actName, $tsActions)) {
    addError($errors, "ActionContract", "PHP action '$actName' in tichu.action.php missing from TichuActionMap");
    continue;
  }
  $tsProps = $tsActions[$actName] ?? [];
  foreach ($phpArgNames as $argName) {
    if (!in_array($argName, $tsProps, true)) {
      addError(
        $errors,
        "ActionContract",
        "PHP action '$actName' getArg('$argName') missing from TichuActionMap['$actName']"
      );
    }
  }
  foreach ($tsProps as $prop) {
    if (!in_array($prop, $phpArgNames, true)) {
      addError(
        $errors,
        "ActionContract",
        "TS TichuActionMap['$actName'] property '$prop' not read via getArg() in tichu.action.php"
      );
    }
  }
}

foreach (array_keys($tsActions) as $actName) {
  if (!array_key_exists($actName, $phpActions)) {
    addError($errors, "ActionContract", "TS TichuActionMap action '$actName' missing from tichu.action.php");
  }
}

$tsScanIter = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("$root/src"));
foreach ($tsScanIter as $fileInfo) {
  if (!$fileInfo->isFile() || $fileInfo->getExtension() !== "ts") {
    continue;
  }
  $rel = str_replace("$root/", "", $fileInfo->getPathname());
  $srcContent = (string) file_get_contents($fileInfo->getPathname());
  if (preg_match_all('/\.takeAction\(\s*"([A-Za-z0-9_]+)"/', $srcContent, $taMatches)) {
    foreach (array_unique($taMatches[1]) as $calledAction) {
      if (!array_key_exists($calledAction, $tsActions)) {
        addError(
          $errors,
          "ActionContract",
          "$rel calls takeAction('$calledAction') not present in TichuActionMap"
        );
      }
    }
  }
}

// ============================================================================
// Report
// ============================================================================
if (!empty($errors)) {
  fwrite(STDERR, "Contract check FAILED with " . count($errors) . " error(s):\n");
  foreach ($errors as $err) {
    fwrite(STDERR, "  - $err\n");
  }
  exit(1);
}

$stateCount = count($machinestates);
$notifCount = count($tsNotifs);
$actionCount = count($tsActions);
echo "Contract checks PASSED: $stateCount states reachable, $notifCount notifications verified, $actionCount actions verified, DB/i18n/PHP8.4 clean.\n";
exit(0);
