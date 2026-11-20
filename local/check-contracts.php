<?php
/**
 * Static contract verification for Tichu (no DB or live server required).
 *
 * Checks:
 *  1. DB schema & upgradeTableDb() safety (no `--` comments, DBPREFIX_ usage).
 *  2. Translation & PHP 8.4 string interpolation safety (clienttranslate/totranslate, no `${var}`, static TS/JS `_()` literals, no wrapper mangling).
 *  3. State machine integrity & TICHU_CODE_VERSION <-> package.json sync.
 *  4. Notification contract (NotificationManager.php <-> TichuNotificationMap <-> tichu.ts <-> replay-engine.ts, raw notify ban, `${...}` i18n check).
 *  5. Action contract (tichu.action.php <-> TichuActionMap <-> tichu.ts).
 *  6. BGA Platform Internals & Sandbox Safety (no banned symbols, no bare PHP `shuffle()`).
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
 * Find previous non-whitespace, non-comment token index starting at $i.
 */
function prevSigToken(array $tokens, int $i): ?int
{
  while ($i >= 0) {
    $tok = $tokens[$i];
    if (is_array($tok) && in_array($tok[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
      $i--;
      continue;
    }
    return $i;
  }
  return null;
}

/**
 * Extract balanced `{ ... }` body following a regex match ending at `{`.
 */
function extractBalancedBraceBody(string $src, string $headerPattern): ?string
{
  if (!preg_match($headerPattern, $src, $m, PREG_OFFSET_CAPTURE)) {
    return null;
  }
  $start = $m[0][1] + strlen($m[0][0]);
  $depth = 1;
  $len = strlen($src);
  $pos = $start;
  while ($pos < $len && $depth > 0) {
    $ch = $src[$pos];
    if ($ch === "{") {
      $depth++;
    } elseif ($ch === "}") {
      $depth--;
      if ($depth === 0) {
        return substr($src, $start, $pos - $start);
      }
    }
    $pos++;
  }
  return null;
}

/**
 * Tokenize JS/TS code into significant code tokens while skipping comments and template static text
 * (recursing cleanly into `${ ... }` template expressions so Lit templates are checked accurately).
 *
 * @return array<int, array{0: string, 1: string, 2: int}>
 */
function tokenizeJsCode(string $src): array
{
  $tokens = [];
  $len = strlen($src);
  $i = 0;
  $line = 1;
  $stack = [];
  $mode = "code";
  $braceDepth = 0;

  while ($i < $len) {
    $ch = $src[$i];
    if ($mode === "template") {
      if ($ch === "\\") {
        if ($i + 1 < $len && $src[$i + 1] === "\n") {
          $line++;
        }
        $i += 2;
        continue;
      }
      if ($ch === "`") {
        $tokens[] = ["TEMPLATE_END", "`", $line];
        $top = array_pop($stack);
        $mode = $top["prevMode"] ?? "code";
        $braceDepth = $top["prevBrace"] ?? 0;
        $i++;
        continue;
      }
      if ($ch === "$" && $i + 1 < $len && $src[$i + 1] === "{") {
        $tokens[] = ["TEMPLATE_EXPR_START", "\${", $line];
        $stack[] = ["resumeTemplate" => true, "targetBrace" => $braceDepth];
        $mode = "code";
        $i += 2;
        continue;
      }
      if ($ch === "\n") {
        $line++;
      }
      $i++;
      continue;
    }

    if ($ch === "\n") {
      $line++;
      $i++;
      continue;
    }
    if (ctype_space($ch)) {
      $i++;
      continue;
    }

    // Line comment
    if ($ch === "/" && $i + 1 < $len && $src[$i + 1] === "/") {
      $nl = strpos($src, "\n", $i + 2);
      if ($nl === false) {
        break;
      }
      $i = $nl;
      continue;
    }
    // Block comment
    if ($ch === "/" && $i + 1 < $len && $src[$i + 1] === "*") {
      $end = strpos($src, "*/", $i + 2);
      $chunk = $end === false ? substr($src, $i) : substr($src, $i, $end + 2 - $i);
      $line += substr_count($chunk, "\n");
      if ($end === false) {
        break;
      }
      $i = $end + 2;
      continue;
    }
    // Regex literal
    if ($ch === "/") {
      $prevTok = end($tokens);
      $prevVal = $prevTok ? $prevTok[1] : ";";
      $canStartRegex = in_array(
        $prevVal,
        ["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", ";", "&&", "||", "??", "=>", "return", "case"],
        true
      );
      if ($canStartRegex) {
        $j = $i + 1;
        $inCharClass = false;
        while ($j < $len) {
          $rc = $src[$j];
          if ($rc === "\\") {
            $j += 2;
            continue;
          }
          if ($rc === "[") {
            $inCharClass = true;
            $j++;
            continue;
          }
          if ($rc === "]") {
            $inCharClass = false;
            $j++;
            continue;
          }
          if ($rc === "/" && !$inCharClass) {
            $j++;
            while ($j < $len && ctype_alpha($src[$j])) {
              $j++;
            }
            $tokens[] = ["REGEX", substr($src, $i, $j - $i), $line];
            $i = $j;
            continue 2;
          }
          if ($rc === "\n") {
            break;
          }
          $j++;
        }
      }
    }
    // Single or double quoted string literal
    if ($ch === "\"" || $ch === "'") {
      $quote = $ch;
      $j = $i + 1;
      $strLine = $line;
      while ($j < $len) {
        $sc = $src[$j];
        if ($sc === "\\") {
          if ($j + 1 < $len && $src[$j + 1] === "\n") {
            $line++;
          }
          $j += 2;
          continue;
        }
        if ($sc === $quote) {
          $j++;
          break;
        }
        if ($sc === "\n") {
          $line++;
        }
        $j++;
      }
      $tokens[] = ["STRING", substr($src, $i, $j - $i), $strLine];
      $i = $j;
      continue;
    }
    // Backtick template literal
    if ($ch === "`") {
      $tokens[] = ["TEMPLATE_START", "`", $line];
      $stack[] = ["resumeTemplate" => false, "prevMode" => $mode, "prevBrace" => $braceDepth];
      $mode = "template";
      $i++;
      continue;
    }
    if ($ch === "{") {
      $braceDepth++;
      $tokens[] = ["PUNCT", "{", $line];
      $i++;
      continue;
    }
    if ($ch === "}") {
      $top = end($stack);
      if ($top && !empty($top["resumeTemplate"]) && $braceDepth === $top["targetBrace"]) {
        array_pop($stack);
        $tokens[] = ["TEMPLATE_EXPR_END", "}", $line];
        $mode = "template";
        $i++;
        continue;
      }
      if ($braceDepth > 0) {
        $braceDepth--;
      }
      $tokens[] = ["PUNCT", "}", $line];
      $i++;
      continue;
    }
    if (ctype_alpha($ch) || $ch === "_" || $ch === "$") {
      $j = $i + 1;
      while ($j < $len && (ctype_alnum($src[$j]) || $src[$j] === "_" || $src[$j] === "$")) {
        $j++;
      }
      $tokens[] = ["IDENT", substr($src, $i, $j - $i), $line];
      $i = $j;
      continue;
    }
    $two = substr($src, $i, 2);
    if (in_array($two, ["&&", "||", "??", "=>", "?."], true)) {
      $tokens[] = ["PUNCT", $two, $line];
      $i += 2;
      continue;
    }
    $tokens[] = ["PUNCT", $ch, $line];
    $i++;
  }
  return $tokens;
}

/**
 * Mask out `// node_modules/...` esbuild module sections in `tichu.js` while preserving exact line numbers.
 */
function maskBundleNodeModules(string $bundleJs): string
{
  $lines = explode("\n", $bundleJs);
  $inNodeModules = false;
  foreach ($lines as $idx => $line) {
    if (preg_match('#^\s*//\s+(\S+\.(?:[cm]?js|ts))\s*$#', $line, $m)) {
      $inNodeModules = str_contains($m[1], "node_modules/");
      continue;
    }
    if ($inNodeModules && preg_match('/^\}\)\(\);\s*$/', $line)) {
      $inNodeModules = false;
      continue;
    }
    if ($inNodeModules) {
      $lines[$idx] = "";
    }
  }
  return implode("\n", $lines);
}

/**
 * Extract all `[placeholderKey, line]` pairs from `clienttranslate(...)` calls in a PHP token slice.
 *
 * @return array<int, array{0: string, 1: int}>
 */
function extractClientTranslatePlaceholdersFromTokens(array $tokens): array
{
  $found = [];
  $count = count($tokens);
  for ($i = 0; $i < $count; $i++) {
    $tok = $tokens[$i];
    if (!is_array($tok) || $tok[0] !== T_STRING || strtolower($tok[1]) !== "clienttranslate") {
      continue;
    }
    $prevIdx = prevSigToken($tokens, $i - 1);
    if ($prevIdx !== null && is_array($tokens[$prevIdx]) && $tokens[$prevIdx][0] === T_FUNCTION) {
      continue;
    }
    $openIdx = nextSigToken($tokens, $i + 1);
    if ($openIdx === null || $tokens[$openIdx] !== "(") {
      continue;
    }
    [$args, $closeIdx] = parseCallArgs($tokens, $openIdx);
    if (isset($args[0])) {
      foreach ($args[0] as $at) {
        if (is_array($at) && $at[0] === T_CONSTANT_ENCAPSED_STRING) {
          $str = unquotePhpString($at[1]);
          if (preg_match_all('/\$\{([A-Za-z0-9_]+)\}/', $str, $pm)) {
            foreach ($pm[1] as $ph) {
              $found[] = [$ph, $tok[2]];
            }
          }
          break;
        }
      }
    }
    $i = $closeIdx;
  }
  return $found;
}

/**
 * Check if a PHP argument slice declares `'i18n'` either directly in an array literal (`['i18n' => ...]`)
 * or on a local variable (`$args = ['i18n' => ...]` or `$args['i18n'] = ...`) prior to `$callIdx`.
 */
function phpArgDeclaresI18n(array $argTokens, array $scopeTokens, int $callIdx): bool
{
  $litKeys = extractArrayLiteralKeys($argTokens);
  if ($litKeys !== null) {
    return in_array("i18n", $litKeys, true);
  }
  $sig = [];
  foreach ($argTokens as $t) {
    if (is_array($t) && in_array($t[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
      continue;
    }
    $sig[] = $t;
  }
  if (count($sig) === 1 && is_array($sig[0]) && $sig[0][0] === T_VARIABLE) {
    $varName = $sig[0][1];
    $assignStart = 0;
    // Find latest `$varName = ...` before $callIdx
    for ($i = $callIdx - 1; $i >= 0; $i--) {
      $t = $scopeTokens[$i];
      if (is_array($t) && $t[0] === T_VARIABLE && $t[1] === $varName) {
        $nextIdx = nextSigToken($scopeTokens, $i + 1);
        if ($nextIdx !== null && $scopeTokens[$nextIdx] === "=") {
          $assignStart = $i;
          $rhsStart = nextSigToken($scopeTokens, $nextIdx + 1);
          if ($rhsStart !== null && $scopeTokens[$rhsStart] === "[") {
            // Collect balanced `[...]`
            $slice = [];
            $bDepth = 0;
            for ($k = $rhsStart; $k < $callIdx; $k++) {
              $slice[] = $scopeTokens[$k];
              if ($scopeTokens[$k] === "[") {
                $bDepth++;
              } elseif ($scopeTokens[$k] === "]") {
                $bDepth--;
                if ($bDepth === 0) {
                  break;
                }
              }
            }
            $rhsKeys = extractArrayLiteralKeys($slice);
            if ($rhsKeys !== null && in_array("i18n", $rhsKeys, true)) {
              return true;
            }
          }
          break;
        }
      }
    }
    // Check for `$varName["i18n"] =` or `$varName['i18n'] =` between $assignStart and $callIdx
    for ($i = $assignStart; $i < $callIdx; $i++) {
      $t = $scopeTokens[$i];
      if (!is_array($t) || $t[0] !== T_VARIABLE || $t[1] !== $varName) {
        continue;
      }
      $b1 = nextSigToken($scopeTokens, $i + 1);
      if ($b1 === null || $scopeTokens[$b1] !== "[") {
        continue;
      }
      $kIdx = nextSigToken($scopeTokens, $b1 + 1);
      if (
        $kIdx === null ||
        !is_array($scopeTokens[$kIdx]) ||
        $scopeTokens[$kIdx][0] !== T_CONSTANT_ENCAPSED_STRING ||
        unquotePhpString($scopeTokens[$kIdx][1]) !== "i18n"
      ) {
        continue;
      }
      $b2 = nextSigToken($scopeTokens, $kIdx + 1);
      if ($b2 === null || $scopeTokens[$b2] !== "]") {
        continue;
      }
      $eq = nextSigToken($scopeTokens, $b2 + 1);
      if ($eq !== null && $scopeTokens[$eq] === "=") {
        return true;
      }
    }
  }
  return false;
}

/**
 * Determine whether a `${key}` notification placeholder requires an `'i18n'` entry.
 */
function placeholderNeedsI18n(string $key): bool
{
  if (preg_match('/player_name/i', $key)) {
    return false;
  }
  $scalarAllowlist = ["trick_value"];
  return !in_array($key, $scalarAllowlist, true);
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
  if ($tsSrc === false) {
    continue;
  }
  if (preg_match('/\bclienttranslate\s*\(\s*(\$|`[^`]*\$\{)/', $tsSrc)) {
    addError($errors, "i18n", "$rel uses clienttranslate(\$...) interpolation");
  }
  if ($rel === "src/types/bga-framework.d.ts") {
    continue;
  }
  $jsTokens = tokenizeJsCode($tsSrc);
  $jtCount = count($jsTokens);
  for ($i = 0; $i < $jtCount; $i++) {
    [$jType, $jVal, $jLine] = $jsTokens[$i];
    if ($jType === "IDENT" && in_array($jVal, ["const", "let", "var", "function"], true)) {
      $nextTok = $jsTokens[$i + 1] ?? null;
      if ($nextTok !== null && $nextTok[0] === "IDENT" && in_array($nextTok[1], ["t", "translate", "_"], true)) {
        addError(
          $errors,
          "i18n",
          "$rel:$jLine declares forbidden local '$jVal {$nextTok[1]}' wrapper (use global _('...') directly so BGA extracts strings)"
        );
      }
    }
    if ($jType === "IDENT") {
      $prevTok = $jsTokens[$i - 1] ?? null;
      $nextTok = $jsTokens[$i + 1] ?? null;
      $isMemberOrFnDecl = $prevTok !== null && in_array($prevTok[1], [".", "?.", "function"], true);
      if (!$isMemberOrFnDecl && $nextTok !== null && $nextTok[1] === "(") {
        if (preg_match('/^(?:t[0-9]*|translate[0-9]*|_[0-9]+)$/', $jVal)) {
          addError(
            $errors,
            "i18n",
            "$rel:$jLine calls '$jVal(...)' instead of static global _('...')"
          );
        } elseif ($jVal === "_") {
          $arg1 = $jsTokens[$i + 2] ?? null;
          $arg2 = $jsTokens[$i + 3] ?? null;
          $arg3 = $jsTokens[$i + 4] ?? null;
          $isSingleQuotedLiteral =
            $arg1 !== null &&
            $arg1[0] === "STRING" &&
            (bool) preg_match('/^(?:"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')$/s', $arg1[1]) &&
            (($arg2 !== null && $arg2[1] === ")") ||
              ($arg2 !== null && $arg2[1] === "," && $arg3 !== null && $arg3[1] === ")"));
          if (!$isSingleQuotedLiteral) {
            addError(
              $errors,
              "i18n",
              "$rel:$jLine _() must receive a single quoted string literal without concatenation, variables, or template backticks"
            );
          }
        }
      }
    }
  }
}

$bundlePath = "$root/tichu.js";
if (is_file($bundlePath)) {
  $rawBundle = (string) file_get_contents($bundlePath);
  $maskedBundle = maskBundleNodeModules($rawBundle);
  $bundleTokens = tokenizeJsCode($maskedBundle);
  $btCount = count($bundleTokens);
  for ($i = 0; $i < $btCount; $i++) {
    [$bType, $bVal, $bLine] = $bundleTokens[$i];
    if ($bType !== "IDENT") {
      continue;
    }
    $prevTok = $bundleTokens[$i - 1] ?? null;
    $nextTok = $bundleTokens[$i + 1] ?? null;
    $isMemberOrFnDecl = $prevTok !== null && in_array($prevTok[1], [".", "?.", "function"], true);
    if (!$isMemberOrFnDecl && $nextTok !== null && $nextTok[1] === "(") {
      if (preg_match('/^(?:t[0-9]*|translate[0-9]*|_[0-9]+)$/', $bVal)) {
        addError(
          $errors,
          "i18n",
          "tichu.js:$bLine contains mangled/wrapper translation call '$bVal(...)'"
        );
      } elseif ($bVal === "_") {
        $arg1 = $bundleTokens[$i + 2] ?? null;
        $arg2 = $bundleTokens[$i + 3] ?? null;
        $arg3 = $bundleTokens[$i + 4] ?? null;
        $isSingleQuotedLiteral =
          $arg1 !== null &&
          $arg1[0] === "STRING" &&
          (bool) preg_match('/^(?:"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')$/s', $arg1[1]) &&
          (($arg2 !== null && $arg2[1] === ")") ||
            ($arg2 !== null && $arg2[1] === "," && $arg3 !== null && $arg3[1] === ")"));
        if (!$isSingleQuotedLiteral) {
          addError(
            $errors,
            "i18n",
            "tichu.js:$bLine _() call does not pass a single quoted string literal"
          );
        }
      }
    }
  }
}

// ============================================================================
// 3. State Machine Integrity & Version Sync
// ============================================================================
require_once "$root/modules/Constants.php";
$pkgJsonRaw = file_get_contents("$root/package.json");
$pkgJson = $pkgJsonRaw !== false ? json_decode($pkgJsonRaw, true) : null;
$pkgVersion = is_array($pkgJson) && isset($pkgJson["version"]) && is_string($pkgJson["version"])
  ? $pkgJson["version"]
  : "";
if (!defined("TICHU_CODE_VERSION") || !is_string(TICHU_CODE_VERSION) || TICHU_CODE_VERSION === "") {
  addError($errors, "VersionSync", "TICHU_CODE_VERSION must be defined as a non-empty string in modules/Constants.php");
} elseif ($pkgVersion !== TICHU_CODE_VERSION) {
  addError(
    $errors,
    "VersionSync",
    "TICHU_CODE_VERSION ('" . TICHU_CODE_VERSION . "') in modules/Constants.php does not match package.json version ('$pkgVersion')"
  );
} else {
  $lockPath = "$root/package-lock.json";
  if (is_file($lockPath)) {
    $lockJson = json_decode((string) file_get_contents($lockPath), true);
    $lockRootVer = is_array($lockJson) && isset($lockJson["version"]) ? (string) $lockJson["version"] : "";
    $lockPkgVer = is_array($lockJson) && isset($lockJson["packages"][""]["version"])
      ? (string) $lockJson["packages"][""]["version"]
      : "";
    if ($lockRootVer !== TICHU_CODE_VERSION || $lockPkgVer !== TICHU_CODE_VERSION) {
      addError(
        $errors,
        "VersionSync",
        "package-lock.json version ('$lockRootVer' / '$lockPkgVer') does not match TICHU_CODE_VERSION ('" . TICHU_CODE_VERSION . "')"
      );
    }
  }
  if (is_file($bundlePath)) {
    $rawBundle = (string) file_get_contents($bundlePath);
    if (strpos($rawBundle, '"' . TICHU_CODE_VERSION . '"') === false) {
      addError(
        $errors,
        "VersionSync",
        "tichu.js does not contain substituted string literal '\"" . TICHU_CODE_VERSION . "\"' (check package.json bundle --define:__TICHU_CODE_VERSION__)"
      );
    }
    if (preg_match('/\b__TICHU_CODE_VERSION__\b/', $rawBundle)) {
      addError($errors, "VersionSync", "tichu.js still contains unreplaced __TICHU_CODE_VERSION__ identifier");
    }
  }
}
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
// 4. Notification Contract, Raw Notify Ban & Notification ${...} i18n Check
// ============================================================================
$deployablePhpFiles = [];
foreach (
  [
    "tichu.game.php",
    "tichu.action.php",
    "tichu.view.php",
    "material.inc.php",
    "states.inc.php",
    "gameinfos.inc.php",
    "gameoptions.inc.php",
    "stats.inc.php",
  ]
  as $rootPhp
) {
  $fullPath = "$root/$rootPhp";
  if (is_file($fullPath)) {
    $deployablePhpFiles[] = $fullPath;
  }
}
if (is_dir("$root/modules")) {
  $modIter2 = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("$root/modules"));
  foreach ($modIter2 as $fileInfo) {
    if ($fileInfo->isFile() && $fileInfo->getExtension() === "php") {
      $deployablePhpFiles[] = $fileInfo->getPathname();
    }
  }
}

$notifPhpFile = "$root/modules/managers/NotificationManager.php";
$notifMethods = extractClassMethods($notifPhpFile, "NotificationManager");
$phpNotifs = []; // [type => string[]|null literal payload keys]
$notifMethodToType = []; // [methodName => emittedTypeName]

foreach ($notifMethods as $mName => $mInfo) {
  if (in_array($mName, ["broadcast", "notifyPlayerWithVersion"], true)) {
    continue;
  }
  $bt = $mInfo["bodyTokens"];
  $bCount = count($bt);
  for ($i = 0; $i < $bCount; $i++) {
    $tok = $bt[$i];
    if (
      !is_array($tok) ||
      $tok[0] !== T_STRING ||
      !in_array($tok[1], ["broadcast", "notifyPlayerWithVersion"], true)
    ) {
      continue;
    }
    $prevColons = prevSigToken($bt, $i - 1);
    $prevSelf = $prevColons !== null ? prevSigToken($bt, $prevColons - 1) : null;
    if (
      $prevColons === null ||
      !is_array($bt[$prevColons]) ||
      $bt[$prevColons][0] !== T_DOUBLE_COLON ||
      $prevSelf === null ||
      !is_array($bt[$prevSelf]) ||
      !in_array($bt[$prevSelf][1], ["self", "static", "NotificationManager"], true)
    ) {
      continue;
    }
    $isAll = $tok[1] === "broadcast";
    $openIdx = nextSigToken($bt, $i + 1);
    if ($openIdx === null || $bt[$openIdx] !== "(") {
      continue;
    }
    [$args, $closeIdx] = parseCallArgs($bt, $openIdx);
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
    $notifMethodToType[$mName] = $typeName;
    $rawKeys = extractArrayLiteralKeys($args[$payloadArgIdx]);
    $keys = $rawKeys !== null
      ? array_values(array_unique(array_merge(["codeVersion"], $rawKeys)))
      : null;
    if (!isset($phpNotifs[$typeName])) {
      $phpNotifs[$typeName] = $keys;
    } elseif ($keys !== null && is_array($phpNotifs[$typeName])) {
      $phpNotifs[$typeName] = array_values(array_unique(array_merge($phpNotifs[$typeName], $keys)));
    }
    $i = $closeIdx;
  }
}

// Check (b.1): `${key}` placeholders inside NotificationManager.php methods
foreach ($notifMethods as $mName => $mInfo) {
  if (in_array($mName, ["broadcast", "notifyPlayerWithVersion"], true)) {
    continue;
  }
  $typeName = $notifMethodToType[$mName] ?? null;
  if ($typeName === null) {
    continue;
  }
  $placeholders = extractClientTranslatePlaceholdersFromTokens($mInfo["bodyTokens"]);
  foreach ($placeholders as [$phKey, $phLine]) {
    if (!placeholderNeedsI18n($phKey)) {
      continue;
    }
    $declaredKeys = $phpNotifs[$typeName] ?? null;
    if (!is_array($declaredKeys) || !in_array("i18n", $declaredKeys, true)) {
      addError(
        $errors,
        "i18n",
        "NotificationManager.php:$phLine NotificationManager::$mName ('$typeName') placeholder '\${" . $phKey . "}' requires 'i18n' key in payload"
      );
    }
  }
}

foreach (["playCombo", "wishMade"] as $i18nNotif) {
  if (!isset($phpNotifs[$i18nNotif]) || !is_array($phpNotifs[$i18nNotif]) || !in_array("i18n", $phpNotifs[$i18nNotif], true)) {
    addError($errors, "i18n", "NotificationManager::$i18nNotif payload must declare 'i18n' key");
  }
}

// Disallow raw notifyAllPlayers / notifyPlayer outside NotificationManager::broadcast / notifyPlayerWithVersion
// and Tichu::setPlayerNonMultiactiveSafe('gameStateMultipleActiveUpdate'), AND check NotificationManager::* +
// new NotificationMessage(...) `${...}` placeholders across all deployable PHP files.
foreach ($deployablePhpFiles as $phpFile) {
  $relPath = str_replace("$root/", "", $phpFile);
  $tokens = token_get_all((string) file_get_contents($phpFile));
  $tCount = count($tokens);
  $currentFunction = null;
  $fnBraceEndDepth = null;
  $braceDepth = 0;
  $varPlaceholdersInScope = []; // [$varName => [[$phKey, $phLine], ...]]

  for ($i = 0; $i < $tCount; $i++) {
    $tok = $tokens[$i];
    if ($tok === "{" || (is_array($tok) && in_array($tok[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) {
      $braceDepth++;
      continue;
    }
    if ($tok === "}") {
      $braceDepth--;
      if ($fnBraceEndDepth !== null && $braceDepth === $fnBraceEndDepth) {
        $currentFunction = null;
        $fnBraceEndDepth = null;
        $varPlaceholdersInScope = [];
      }
      continue;
    }
    if (!is_array($tok)) {
      continue;
    }
    if ($tok[0] === T_FUNCTION) {
      $fnNameIdx = nextSigToken($tokens, $i + 1);
      if ($fnNameIdx !== null && is_array($tokens[$fnNameIdx]) && $tokens[$fnNameIdx][0] === T_STRING) {
        $currentFunction = $tokens[$fnNameIdx][1];
        $fnBraceEndDepth = $braceDepth;
        $varPlaceholdersInScope = [];
      }
      continue;
    }

    // Track `$var = clienttranslate(...)` assignments inside function bodies
    if (
      $tok[0] === T_VARIABLE &&
      ($fnBraceEndDepth === null || $braceDepth > $fnBraceEndDepth)
    ) {
      $eqIdx = nextSigToken($tokens, $i + 1);
      if ($eqIdx !== null && $tokens[$eqIdx] === "=") {
        // Scan statement RHS up to `;` at depth 0 for clienttranslate(...)
        $rhsTokens = [];
        $rDepth = 0;
        for ($k = $eqIdx + 1; $k < $tCount; $k++) {
          $rt = $tokens[$k];
          if ($rt === "(" || $rt === "[") {
            $rDepth++;
          } elseif ($rt === ")" || $rt === "]") {
            $rDepth--;
            if ($rDepth < 0) {
              break;
            }
          } elseif (($rt === ";" || $rt === "{" || $rt === "}") && $rDepth === 0) {
            break;
          }
          $rhsTokens[] = $rt;
        }
        $rhsPhs = extractClientTranslatePlaceholdersFromTokens($rhsTokens);
        if (!empty($rhsPhs)) {
          $varPlaceholdersInScope[$tok[1]] = array_merge(
            $varPlaceholdersInScope[$tok[1]] ?? [],
            $rhsPhs
          );
        }
      }
    }

    // Raw notifyAllPlayers / notifyPlayer check
    if ($tok[0] === T_STRING && in_array($tok[1], ["notifyAllPlayers", "notifyPlayer"], true)) {
      $prevIdx = prevSigToken($tokens, $i - 1);
      if ($prevIdx !== null && is_array($tokens[$prevIdx]) && $tokens[$prevIdx][0] === T_FUNCTION) {
        continue;
      }
      $openIdx = nextSigToken($tokens, $i + 1);
      if ($openIdx === null || $tokens[$openIdx] !== "(") {
        continue;
      }
      [$nArgs, $nClose] = parseCallArgs($tokens, $openIdx);
      $allowed = false;
      if (
        $relPath === "modules/managers/NotificationManager.php" &&
        (($tok[1] === "notifyAllPlayers" && $currentFunction === "broadcast") ||
          ($tok[1] === "notifyPlayer" && $currentFunction === "notifyPlayerWithVersion"))
      ) {
        $allowed = true;
      } elseif (
        $relPath === "tichu.game.php" &&
        $tok[1] === "notifyAllPlayers" &&
        $currentFunction === "setPlayerNonMultiactiveSafe" &&
        isset($nArgs[0])
      ) {
        foreach ($nArgs[0] as $at) {
          if (
            is_array($at) &&
            $at[0] === T_CONSTANT_ENCAPSED_STRING &&
            unquotePhpString($at[1]) === "gameStateMultipleActiveUpdate"
          ) {
            $allowed = true;
            break;
          }
        }
      }
      if (!$allowed) {
        addError(
          $errors,
          "NotifContract",
          "$relPath:{$tok[2]} calls raw {$tok[1]}() outside NotificationManager::broadcast/notifyPlayerWithVersion"
        );
      }
      continue;
    }

    // Check (b.2): NotificationManager::<method>(...) call sites
    if (
      $tok[0] === T_STRING &&
      $tok[1] === "NotificationManager"
    ) {
      $colIdx = nextSigToken($tokens, $i + 1);
      $mIdx = $colIdx !== null ? nextSigToken($tokens, $colIdx + 1) : null;
      $openIdx = $mIdx !== null ? nextSigToken($tokens, $mIdx + 1) : null;
      if (
        $colIdx !== null &&
        is_array($tokens[$colIdx]) &&
        $tokens[$colIdx][0] === T_DOUBLE_COLON &&
        $mIdx !== null &&
        is_array($tokens[$mIdx]) &&
        $tokens[$mIdx][0] === T_STRING &&
        $openIdx !== null &&
        $tokens[$openIdx] === "("
      ) {
        $calledMethod = $tokens[$mIdx][1];
        $callLine = $tokens[$mIdx][2];
        [$cArgs, $cClose] = parseCallArgs($tokens, $openIdx);
        $emittedType = $notifMethodToType[$calledMethod] ?? null;

        $callPlaceholders = [];
        foreach ($cArgs as $argSlice) {
          $callPlaceholders = array_merge(
            $callPlaceholders,
            extractClientTranslatePlaceholdersFromTokens($argSlice)
          );
          $sigSlice = [];
          foreach ($argSlice as $at) {
            if (is_array($at) && in_array($at[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
              continue;
            }
            $sigSlice[] = $at;
          }
          if (count($sigSlice) === 1 && is_array($sigSlice[0]) && $sigSlice[0][0] === T_VARIABLE) {
            $vName = $sigSlice[0][1];
            if (!empty($varPlaceholdersInScope[$vName])) {
              $callPlaceholders = array_merge($callPlaceholders, $varPlaceholdersInScope[$vName]);
            }
          }
        }

        foreach ($callPlaceholders as [$phKey, $phLine]) {
          if (!placeholderNeedsI18n($phKey)) {
            continue;
          }
          $hasI18n = false;
          if ($emittedType !== null && isset($phpNotifs[$emittedType]) && is_array($phpNotifs[$emittedType])) {
            $hasI18n = in_array("i18n", $phpNotifs[$emittedType], true);
          } elseif ($calledMethod === "log" && isset($cArgs[1])) {
            $hasI18n = phpArgDeclaresI18n($cArgs[1], $tokens, $i);
          }
          if (!$hasI18n) {
            addError(
              $errors,
              "i18n",
              "$relPath:$callLine NotificationManager::$calledMethod placeholder '\${" . $phKey . "}' (from line $phLine) requires 'i18n' in notification payload"
            );
          }
        }
        $i = $cClose;
        continue;
      }
    }

    // Check (b.3): new NotificationMessage(...) / new \Bga\GameFramework\NotificationMessage(...)
    if ($tok[0] === T_NEW) {
      $clsIdx = nextSigToken($tokens, $i + 1);
      if (
        $clsIdx !== null &&
        is_array($tokens[$clsIdx]) &&
        in_array($tokens[$clsIdx][0], [T_STRING, T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED], true) &&
        preg_match('/(?:^|\\\\)NotificationMessage$/', $tokens[$clsIdx][1])
      ) {
        $openIdx = nextSigToken($tokens, $clsIdx + 1);
        if ($openIdx !== null && $tokens[$openIdx] === "(") {
          [$nmArgs, $nmClose] = parseCallArgs($tokens, $openIdx);
          $nmLine = $tokens[$clsIdx][2];
          $nmPlaceholders = [];
          if (isset($nmArgs[0])) {
            $nmPlaceholders = extractClientTranslatePlaceholdersFromTokens($nmArgs[0]);
            $sig0 = [];
            foreach ($nmArgs[0] as $at) {
              if (is_array($at) && in_array($at[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
              }
              $sig0[] = $at;
            }
            if (count($sig0) === 1 && is_array($sig0[0]) && $sig0[0][0] === T_VARIABLE) {
              $vName = $sig0[0][1];
              if (!empty($varPlaceholdersInScope[$vName])) {
                $nmPlaceholders = array_merge($nmPlaceholders, $varPlaceholdersInScope[$vName]);
              }
            }
          }
          foreach ($nmPlaceholders as [$phKey, $phLine]) {
            if (!placeholderNeedsI18n($phKey)) {
              continue;
            }
            $hasI18n = isset($nmArgs[1]) && phpArgDeclaresI18n($nmArgs[1], $tokens, $i);
            if (!$hasI18n) {
              addError(
                $errors,
                "i18n",
                "$relPath:$nmLine NotificationMessage placeholder '\${" . $phKey . "}' requires 'i18n' in message args"
              );
            }
          }
          $i = $nmClose;
          continue;
        }
      }
    }
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
$notifSyncDurations = [];
$snBody = extractBalancedBraceBody($tichuTs, '/setupNotifications\s*\(\)\s*(?::\s*[^{]+)?\{/');
if ($snBody !== null) {
  if (preg_match('/const\s+notifs[^=]*=\s*\{(.*?)\};/s', $snBody, $mapMatch)) {
    if (
      preg_match_all(
        '/^\s*([A-Za-z0-9_]+)\s*:\s*([^,\r\n}]+)/m',
        $mapMatch[1],
        $nm,
        PREG_SET_ORDER
      )
    ) {
      foreach ($nm as $entry) {
        $subscribedNotifs[] = $entry[1];
        $notifSyncDurations[$entry[1]] = trim($entry[2]);
      }
    }
  }
}
preg_match_all('/^\s*notif_([A-Za-z0-9_]+)\s*\(/m', $tichuTs, $handlerMatches);
$handlerNotifs = $handlerMatches[1] ?? [];

$allKnownNotifs = array_values(array_unique(array_merge(array_keys($tsNotifs), array_keys($phpNotifs))));
foreach ($allKnownNotifs as $type) {
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

foreach ($notifSyncDurations as $type => $rawDur) {
  $headerPattern = '/^\s*notif_' . preg_quote($type, '/') . '\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/m';
  if (!preg_match($headerPattern, $tichuTs, $hm, PREG_OFFSET_CAPTURE)) {
    continue;
  }
  $start = $hm[0][1] + strlen($hm[0][0]);
  $tokens = tokenizeJsCode(substr($tichuTs, $start));
  $depth = 1;
  $hasDynamicDur = false;
  foreach ($tokens as $tok) {
    if ($tok[0] === "PUNCT" && $tok[1] === "{") {
      $depth++;
    } elseif ($tok[0] === "PUNCT" && $tok[1] === "}") {
      $depth--;
      if ($depth === 0) {
        break;
      }
    } elseif ($tok[0] === "IDENT" && $tok[1] === "setSynchronousDuration") {
      $hasDynamicDur = true;
    }
  }
  if ($rawDur === "undefined" && !$hasDynamicDur) {
    addError(
      $errors,
      "NotifContract",
      "src/tichu.ts setupNotifications() registers '$type: undefined' but notif_$type() never calls setSynchronousDuration()"
    );
  } elseif ($rawDur !== "undefined" && $hasDynamicDur) {
    addError(
      $errors,
      "NotifContract",
      "src/tichu.ts setupNotifications() registers '$type: $rawDur' AND notif_$type() calls setSynchronousDuration() (BGA double-timer collision)"
    );
  }
}

// Check src/elements/replay-engine.ts handles or explicitly ignores every notification entry
$replayEnginePath = "$root/src/elements/replay-engine.ts";
$replayEngineTs = is_file($replayEnginePath) ? (string) file_get_contents($replayEnginePath) : "";
if ($replayEngineTs === "") {
  addError($errors, "NotifContract", "Missing src/elements/replay-engine.ts");
} else {
  $replayHandled = [];
  $applyBody = extractBalancedBraceBody(
    $replayEngineTs,
    '/\bapplyReplayNotif\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/'
  );
  if ($applyBody !== null && preg_match_all('/type\s*===\s*"([A-Za-z0-9_]+)"/', $applyBody, $rm)) {
    $replayHandled = array_merge($replayHandled, $rm[1]);
  }
  $ignBody = extractBalancedBraceBody(
    $replayEngineTs,
    '/\bfunction\s+isIgnoredReplayNotif\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/'
  );
  if ($ignBody !== null && preg_match_all('/type\s*===\s*"([A-Za-z0-9_]+)"/', $ignBody, $im)) {
    $replayHandled = array_merge($replayHandled, $im[1]);
  }
  $replayHandled = array_unique($replayHandled);
  foreach ($allKnownNotifs as $type) {
    if (!in_array($type, $replayHandled, true)) {
      addError(
        $errors,
        "NotifContract",
        "Notification '$type' neither handled in applyReplayNotif() nor listed in isIgnoredReplayNotif() in src/elements/replay-engine.ts"
      );
    }
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
// 6. BGA Platform Internals & Sandbox Safety Check (Deployable PHP files)
// ============================================================================
if (file_exists("$root/modules/DebugTrait.php")) {
  addError(
    $errors,
    "PlatformSafety",
    "modules/DebugTrait.php must not exist in deployed modules/; keep debug/SQL loaders in local/"
  );
}

$forbiddenPlatformTokens = [
  "file_get_contents",
  "file_put_contents",
  "fopen",
  "unlink",
  "scandir",
  "opendir",
  "readdir",
  "glob",
  "exec",
  "shell_exec",
  "proc_open",
  "passthru",
  "system",
  "popen",
  "curl_init",
  "curl_exec",
  "fsockopen",
  "stream_socket_client",
  "ReflectionClass",
  "ReflectionMethod",
  "ReflectionProperty",
  "ReflectionObject",
  "ReflectionFunction",
];

foreach ($deployablePhpFiles as $phpFile) {
  $relPath = str_replace("$root/", "", $phpFile);
  $code = (string) file_get_contents($phpFile);
  if (
    preg_match(
      '/\$bgaContainer|Bga\\\\GameFramework\\\\Old\\\\Db|\bbga_user_preferences\b|\bmysqldump\b/i',
      $code,
      $rawMatch
    )
  ) {
    addError(
      $errors,
      "PlatformSafety",
      "$relPath contains forbidden internal platform reference '{$rawMatch[0]}' (including comments)"
    );
  }
  $tokens = token_get_all($code);
  $tokCount = count($tokens);
  for ($ti = 0; $ti < $tokCount; $ti++) {
    $tok = $tokens[$ti];
    if (!is_array($tok)) {
      continue;
    }
    $type = $tok[0];
    $text = $tok[1];
    $line = $tok[2];
    if ($type === T_COMMENT || $type === T_DOC_COMMENT) {
      continue;
    }
    // Check (c): Bare PHP shuffle( ban (allow $deck->shuffle(...), $deck?->shuffle(...), Foo::shuffle(...), function shuffle(...))
    if (
      ($type === T_STRING && strtolower($text) === "shuffle") ||
      ($type === T_NAME_FULLY_QUALIFIED && strtolower($text) === "\\shuffle")
    ) {
      $nextIdx = nextSigToken($tokens, $ti + 1);
      if ($nextIdx !== null && $tokens[$nextIdx] === "(") {
        $prevIdx = prevSigToken($tokens, $ti - 1);
        $prevTok = $prevIdx !== null ? $tokens[$prevIdx] : null;
        $isAllowedShuffle =
          $type === T_STRING &&
          is_array($prevTok) &&
          in_array(
            $prevTok[0],
            [T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR, T_DOUBLE_COLON, T_FUNCTION],
            true
          );
        if (!$isAllowedShuffle) {
          addError(
            $errors,
            "PlatformSafety",
            "$relPath:$line uses bare PHP shuffle(); use Table::bga_rand() Fisher-Yates or Deck::shuffle() instead"
          );
        }
      }
    }
    if ($type === T_VARIABLE && $text === '$bgaContainer') {
      addError(
        $errors,
        "PlatformSafety",
        "$relPath:$line references \$bgaContainer (absolute NO-GO in deployed Studio/prod code)"
      );
    } elseif ($type === T_EVAL) {
      addError(
        $errors,
        "PlatformSafety",
        "$relPath:$line uses eval() (refused by BGA Studio security scan)"
      );
    } elseif ($type === T_STRING && in_array($text, $forbiddenPlatformTokens, true)) {
      addError(
        $errors,
        "PlatformSafety",
        "$relPath:$line references forbidden filesystem/process/reflection symbol '$text'"
      );
    } elseif (
      in_array($type, [T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED], true) &&
      preg_match('/Bga\\\\GameFramework\\\\Old\\\\Db/i', $text)
    ) {
      addError(
        $errors,
        "PlatformSafety",
        "$relPath:$line references Bga\\GameFramework\\Old\\Db (absolute NO-GO in deployed Studio/prod code)"
      );
    } elseif (
      ($type === T_CONSTANT_ENCAPSED_STRING || $type === T_ENCAPSED_AND_WHITESPACE) &&
      preg_match('/\bbga_[a-z0-9_]+\b|Bga\\\\+GameFramework\\\\+Old\\\\+Db/i', $text, $m)
    ) {
      addError(
        $errors,
        "PlatformSafety",
        "$relPath:$line references internal platform identifier '{$m[0]}' (keep bga_* table SQL in local/ only)"
      );
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
