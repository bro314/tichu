---
name: bga-release-and-qa
description: >-
  BGA pre-release QA checklist, production release workflow on studiogame?game=tichu, live-game
  DB migration rules (upgradeTableDb & DBPREFIX_), @thoun autopass state-reset invariants,
  i18n/dummyTranslations validation, Shadow DOM vs BGA Tutorial Creator caveats, and BGA 2025-2026
  modernization workflow order. Use before building/deploying a BGA release, editing dbmodel.sql
  or upgradeTableDb, auditing translations/dark mode/autopass, or modernizing BGA APIs.
---

# BGA Release, Live-Game Safety, Autopass & QA Checklist

## 1. Pushing a Release to Production (`boardgamearena.com`)

- **CRITICAL SAFETY GUARDRAIL**: **NEVER** build a release or deploy a new version to production without getting **explicit, clear confirmation from the user first**. Safe actions like `Reload game informations` or `Dry run build (to check code warnings)` can be clicked anytime, but committing/building/deploying a release requires user approval.
- Once confirmed by the user, follow these steps on `https://studio.boardgamearena.com/studiogame?game=tichu`:
  1. Ensure all local changes are tested and compiled (`npm run build`, which runs `npm test` + `compile` + `bundle`, plus `npm run test:contracts`, `npm run phpstan`, and `await tt.runSuite({ speed: "instant" })` in the local runner if frontend code changed), synced via SFTP to `/tichu/` (`npm run deploy:sftp`), and verified on a Studio test table (**including with BGA Studio's `"Use minified JS / CSS"` toggle ON** whenever JS bundling or CSS changed).
  2. Under the **Build a new release version** section on `https://studio.boardgamearena.com/studiogame?game=tichu`:
     - Click **`⇨ Dry run build (to check code warnings)`** first and verify there are no blocking warnings or errors in the modal popup.
     - Fill in the **`Release note: what has changed since the last release?`** input field (max 250 chars).
     - Click **`⇨ Commit & build a new version now`**. This snapshots the SFTP `/tichu/` files into BGA's internal SVN/release system and builds a numbered release package (e.g., `YYMMDD-HHMM`).
  3. Under the **Versions available for production** section:
     - Locate the newly built version row and click its **Deploy** button to push it live to `boardgamearena.com`.

---

## 2. `@thoun`'s Autopass State-Reset Invariants (`player_pass`)

[`modules/Constants.php`](file:///Users/brohlfs/git/tichu/modules/Constants.php) defines the `player_pass` values stored in the `player` table:

- `AUTOPASS_NONE = 0`
- `AUTOPASS_ONCE = 1` (auto-pass once on next turn)
- `AUTOPASS_TRICK = 2` (auto-pass until end of current trick)

Explicit invariant: every state transition that resets or advances trick/round play must audit `player_pass` via `PlayerManager::setAutopass(...)` so a stale flag never auto-passes on an unexpected lead, bomb interrupt, or fulfillable Mahjong wish:

- **New Trick (`stNewTrick` in `tichu.game.php`)**: Calls `PlayerManager::setAutopass(0)` for all players when a new trick begins.
- **New Round (`stNewRound` in `tichu.game.php`)**: Calls `PlayerManager::setAutopass(0)` for all players when a new round begins.
- **Turn Evaluation (`stNextPlayer` in `tichu.game.php`)**:
  - Reads `SELECT player_id, player_pass FROM player FOR UPDATE` (because out-of-turn `pass` / `cancelAutopass` do not bump `GLOBAL_LOCK_VERSION`).
  - Evaluates `$autoPass = $pass > 0 && CardManager::canPass($pId, $wish, $lastCombo);` — if a Mahjong wish is active and the player can fulfill it (`$hand->canFulFillWish($wish, $lastCombo)`), **autopass is overridden** and the player becomes active normally.
  - Whenever `$pass == AUTOPASS_ONCE`, resets that player's `player_pass` to `AUTOPASS_NONE` (`0`) immediately via `PlayerManager::setAutopass(...)` and notifies (`NotificationManager::autopass(..., $pId)`) — both when auto-passing and when `AUTOPASS_ONCE` was blocked by a wish.

---

## 3. Live Game Migration Safety (`dbmodel.sql` & `upgradeTableDb`)

- **Never** delete states, change state IDs (`ST_*`), or change option/statistic IDs (`gameoptions.inc.php`, `stats.inc.php`) if games are running in production.
- **Never put `--` comments in [`dbmodel.sql`](file:///Users/brohlfs/git/tichu/dbmodel.sql)**: BGA Studio strips all newlines from `dbmodel.sql` before passing it as a single string to MySQL, so any `--` comment silently swallows the rest of the schema!
- **Never use `TRUNCATE` or `DROP` in runtime game logic**: They trigger an implicit MySQL commit and break BGA's automatic transaction rollback on exceptions.
- **Database Schema Upgrades**: Handle schema changes for running games inside `upgradeTableDb($from_version)` in [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php) using `DBPREFIX_<table_name>` (e.g., `ALTER TABLE DBPREFIX_player ...`). Wrap non-idempotent schema changes with `SHOW COLUMNS` / `try/catch` resilience for BGA Bug #64 (`zz_replay*` shadow tables).
- **PHP 8.4 / DB APIs**:
  - `getCollectionFromDb($sql)` keys by the first selected column and silently overwrites duplicate keys — always select a unique column first or use `getObjectListFromDB($sql)` (`getObjectListFromDB($sql, true)` for a flat 1D array).
  - Never emit PHP warnings/deprecations in AJAX responses (`JSON_ERROR_SYNTAX`): always use `{$var}` (never `${var}`) and `$this->` (never `self::`/`static::`) for non-static framework instance methods.
  - Never call `getCurrentPlayerId()` inside `setupNewGame()`, `zombieTurn()`, or `arg*()` state methods (throws `"Not logged"`).
- **ABSOLUTE NO-GO — Platform & Sandbox Boundaries**: No deployed file (`tichu.*.php`, `modules/**`) may ever access BGA platform internals (`$bgaContainer`, `\Bga\GameFramework\Old\Db`, `bga_*` tables such as `bga_user_preferences`, filesystem/process functions like `file_get_contents`/`exec`, or `Reflection*`). Enforced automatically by `npm run test:contracts`.

---

## 4. Translations (`clienttranslate`), Dark Mode & Safari CSS Checklist

- **Translations**:
  - `clienttranslate()` is statically extracted — pass literal strings only (no variables or string concatenation inside `clienttranslate()`), and wrap all player-facing `UserException` messages in `clienttranslate()`.
  - When a notification argument is used both for client logic/CSS and for log display, pass two separate keys (raw value + `clienttranslate()` label listed in `'i18n' => [...]`).
  - Append `&dummyTranslations` to a Studio table URL to wrap all translated client `_()` strings in `«»` (any bare English text indicates a missing `_()` wrapper).
- **BGA Dark Mode**: BGA toggles dark mode via `html[data-theme="dark"]` (not `@media (prefers-color-scheme: dark)`). Any custom UI container with a fixed light background must specify an explicit dark text `color`.
- **Safari CSS Filter Caveat (`.dj_safari`)**: Never apply `filter: drop-shadow(...)` across many card nodes simultaneously (causes severe Safari GPU lag on BGA; use `box-shadow` instead).

---

## 5. Shadow DOM, `.disabler` & BGA Interactive Tutorial Creator

Per [`docs/BGA_OPEN_SOURCE_ECOSYSTEM.md`](file:///Users/brohlfs/git/tichu/docs/BGA_OPEN_SOURCE_ECOSYSTEM.md) and `rbellec/claude-code-bga` (`tutorial-ready.md`), BGA's Interactive Tutorial Creator (`https://en.doc.boardgamearena.com/Tutorials_checklist`) inspects light-DOM `document.elementFromPoint(x, y)` targets and `bga_tutorial_...` light-DOM element IDs:

- Tichu renders its entire UI inside Lit Shadow DOM roots (`<tichu-game>`, `<tichu-hand>`, `<tichu-last-played>`, `<tichu-action-bar>`), uses a full-table `.disabler` overlay (`tichu-last-played.ts`), and auto-triggers `collect` on `confirmTrick`.
- Standard Tutorial Creator step recording cannot target elements inside Shadow DOM or click past `.disabler` unless light-DOM proxy anchors are provided and auto-`collect` / `.disabler` pointer blocking are paused during tutorial playback.

---

## 6. Official BGA 2025–2026 Modernization Workflows (`modernize-bga-game-project`)

Consult `https://doc.studio.boardgamearena.com/framework-documentation/ai-tooling/` (or [Plan 13](file:///Users/brohlfs/git/tichu/plans/13-modern-bga-frontend-esm-and-sound-cleanup.md) and [Plan 14](file:///Users/brohlfs/git/tichu/plans/14-modern-bga-backend-autowired-actions-and-namespaces.md)) when migrating Tichu's classic architecture toward modern BGA APIs. Before starting any migration workflow:

1. Refresh [`_ide_helper.php`](file:///Users/brohlfs/git/tichu/_ide_helper.php) and [`src/types/bga-framework.d.ts`](file:///Users/brohlfs/git/tichu/src/types/bga-framework.d.ts) from Studio.
2. Never create new PHP traits during migration, and always edit TypeScript in `src/` (then run `npm run build`) rather than patching `tichu.js`.
3. Follow BGA's ordered dependency chain:
   - **Config & Assets**: `mysql_fetch_assoc` -> `bga-jsonc-files` -> `bga-gameinfos-cleanup` (requires `gameinfos.jsonc`) -> `bga-fonts` -> `bga-sounds` (`sounds/` auto-loading) -> `bga-jstpl` -> `bga-default-states` (remove states `1` and `99` from `states.inc.php`) -> `bga-material`.
   - **Backend PHP**: `bga-new-table` -> `bga-new-apis` -> `bga-server-translations` -> `bga-namespaced-game` (`modules/php/Game.php`, requires relocated material first) -> `bga-autoload` -> `bga-strict-types` (excludes `*.inc.php`) -> `bga-autowired-actions` (`act*` methods + delete `tichu.action.php`, **must preserve `acquireGameLock()` & `#[CheckAction(false)]` on out-of-turn actions!**) -> `bga-mysql-strict-mode` -> `bga-php8-code` -> state classes (`bga-game-state-classes`, `bga-active-player-state-classes`, `bga-multi-active-player-state-classes`) -> `bga-zombie-random-move`.
   - **Frontend JS/TS**: `bga-js` -> `bga-replace-dojo` -> `bga-remove-view-tpl` (delete `tichu.view.php` & `tichu_tichu.tpl`) -> `bga-es6` (`modules/js/Game.js` ESM, requires `bga-js` complete with no `format_string_recursive` override).
   - **SFTP Deletion Warning**: Deleting `tichu.action.php`, `tichu.view.php`, or `tichu_tichu.tpl` in git does not remove them on BGA Studio — explicitly `rm` obsolete files over SFTP so Studio stops loading them.
