---
name: bga-release-and-qa
description: >-
  BGA prepare a release / prepare release playbook, pre-release QA checklist, production release &
  rollback workflow on studiogame?game=tichu, backwards/forwards compatibility & live-tab
  client/server skew rules, live-game DB migration rules (upgradeTableDb & DBPREFIX_), @thoun
  autopass state-reset invariants, i18n/dummyTranslations validation, Shadow DOM vs BGA Tutorial
  Creator caveats, and BGA 2025-2026 modernization workflow order. Use whenever the user says
  "prepare a release" / "prepare release", before building/deploying/rolling back a BGA release,
  editing dbmodel.sql, upgradeTableDb, actions, notifications, states, or actionlog, auditing
  translations/dark mode/autopass, or modernizing BGA APIs.
---

# BGA Release, Live-Game Safety, Autopass & QA Checklist

## 0. `"Prepare a Release"` End-to-End Playbook (Trigger: `"prepare a release"` / `"prepare release"`)

When the user asks to **prepare a release**, run this full sequence and **stop at Step 9** for explicit user approval before building a Studio release package, deploying to production, or posting BGA bug replies:

1. **Inventory & Baseline**:
   - Identify the active production version (`local/bugs/prod-errors-state.json` `lastProdVersion` and/or `getStudioGameVersions.html`) and corresponding git commit.
   - Inspect all commits (`git log --stat <last-release-commit>..HEAD`) and uncommitted working-tree changes (`git status`).
   - Audit 4-way compatibility (Section 3) and ensure raw/intermediate assets (such as `img/highres/` and `img/svg/`) stay in `.gitignore` and excluded from `local/sftp-sync.sh`.
2. **Version Bump**:
   - Bump `TICHU_CODE_VERSION` (`YYYY-MM-DD.N`) in [`modules/Constants.php`](file:///Users/brohlfs/git/tichu/modules/Constants.php), `"version"` in [`package.json`](file:///Users/brohlfs/git/tichu/package.json), and both root `"version"` and `packages[""].version` in [`package-lock.json`](file:///Users/brohlfs/git/tichu/package-lock.json). **Never** edit `version.php`.
3. **Full Local Verification**:
   - With `/opt/homebrew/bin` on `PATH`, run `npm run build` (`npm test` + `tsc` + `esbuild` bundle), `npm run test:contracts`, `npm run phpstan`, and `npm run test:race`.
   - Run a local browser sanity check on `http://127.0.0.1:8080` via the `browser` subagent (`Model: "flash"`, `captureScreenshot: false`, `waitFor <= 24000ms`): `clearConsoleIssues`, `#tt_btn_smoke`, `#tt_btn_round`, verify new/changed UI components, verify zero console errors, and close the browser tab (`page.close()`).
4. **SFTP Sync to BGA Studio**:
   - Run `PATH="/opt/homebrew/bin:$PATH" bash local/sftp-sync.sh --since <last-release-commit>` (or `npm run deploy:sftp:all` for a full resync — both upload deployable PHP/JS/CSS/TPL/SQL files plus top-level runtime `img/` assets while rejecting `img/*/*` subdirectories, after passing `check-contracts.php`, avoiding redundant re-uploads of unchanged multi-MB static images on `--since`). Confirm exit code `0` and zero SFTP errors.
5. **BGA Studio Verification (`https://studio.boardgamearena.com`)**:
   - Open `https://studio.boardgamearena.com/studiogame?game=tichu`: verify zero `workspace.blocked-files` / security banners; reload game config (`Reload game informations`, `Reload statistics configuration`, `Reload game options configuration`) if `states.inc.php`, `gameinfos.inc.php`, `gameoptions.inc.php`, or `stats.inc.php` changed.
   - Click **`⇨ Dry run build (to check code warnings)`** and verify zero blocking errors or warnings in `#studioCommandResults`.
   - Turn ON **`Use minified JS`** AND **`Use minified CSS`** under **Studio tools**.
   - On a Studio test table (cleaning up dangling `CANCEL`/`Express stop` first): run `#tt_btn_smoke`, verify new/changed UI features, sprites, tooltips/modals, version parity, `&dummyTranslations` (`«»` check), and play a full game (`#tt_btn_game` to `state 99` with real animations ON — or 4-tab `startAutoPlayMe` whenever PHP actions, locks, or state transitions changed) with zero console errors or UI assertion failures.
   - Click **`Express stop`** on the table, **click `Revert` on BOTH `Use minified JS` and `Use minified CSS`**, and close the browser tab (`page.close()`).
6. **Fix Any Issues Found**:
   - Fix any failure, add a targeted regression test, and re-run Steps 3–5 until completely green.
7. **Format, Commit & Push**:
   - Run `npx prettier --write` on modified TS/JS/CSS/MD/JSON files (never `tichu.game.php`), re-run `npm run build && npm run test:contracts && npm run phpstan` if formatting touched code (and re-sync via `npm run deploy:sftp` so Studio matches `HEAD`), verify `git status` is clean of scratch/unwanted files, commit on `main`, and push via:
     `git push https://www.github.com/bro314/tichu.git main && git update-ref refs/remotes/origin/main HEAD`
8. **Read-Only Bug & Production Error Audit**:
   - Review `local/bugs/open-issues.json` and `local/bugs/prod-errors-state.json` (plus read-only BGA bug tracker / Sentry checks if logged in) to identify tickets resolved or progressed by the release.
9. **HARD STOP — Present Release Readiness Report & Ask Approval**:
   - Summarize: (a) test & Studio dry-run results, (b) what changed since the last release + a ready-to-paste Studio release note (`<= 250` chars), (c) BGA tickets needing updates + plain-text draft replies (no backticks), (d) highest-risk production areas to watch post-deploy. Wait for explicit user confirmation before clicking `Commit & build a new version now`, `Deploy to production`, or posting BGA bug comments.

---

## 1. Pushing a Release to Production (`boardgamearena.com`) & Rolling Back

- **CRITICAL SAFETY GUARDRAIL**: **NEVER** build a release or deploy a new version to production without getting **explicit, clear confirmation from the user first**. Safe actions like `Reload game informations` or `Dry run build (to check code warnings)` can be clicked anytime, but committing/building/deploying a release requires user approval.
- Once confirmed by the user, follow these steps on `https://studio.boardgamearena.com/studiogame?game=tichu`:
  1. Bump `TICHU_CODE_VERSION` in [`modules/Constants.php`](file:///Users/brohlfs/git/tichu/modules/Constants.php) together with `"version"` in [`package.json`](file:///Users/brohlfs/git/tichu/package.json) and [`package-lock.json`](file:///Users/brohlfs/git/tichu/package-lock.json) (e.g., `YYYY-MM-DD.N` — **never** edit `version.php`). Ensure all local changes are tested and compiled (`npm run build`, which runs `npm test` + `compile` + `bundle` injecting `__TICHU_CODE_VERSION__`, plus `npm run test:contracts`, `npm run phpstan`, and `await tt.runSuite({ speed: "instant" })` in the local runner if frontend code changed), synced via SFTP to `/tichu/` (`npm run deploy:sftp`), and verified on a Studio test table (**including with BGA Studio's `"Use minified JS"` / `"Use minified CSS"` modes ON** whenever JS bundling or CSS changed).
     - **Svelte Control Panel DOM Selectors (`studiogame?game=tichu`)**:
       - All Studio action buttons (`Reload game informations`, `Reload statistics configuration`, `Reload game options configuration`, `⇨ Dry run build (to check code warnings)`, `Use minified JS`, `Use minified CSS`, `Revert`) render as `a.bga-button` links (not `<button>` tags).
       - Clicking any action button mounts `div.studio-command-modal` on `document.body`, showing `div[aria-busy="true"]` while running and then `div#studioCommandResults` (warnings/errors use `.studio-command-blocks__alert--warning` / `.studio-command-blocks__alert--error`). Dismiss between actions via `div.studio-command-modal a.bga-button` (`"Close"`).
       - Under **Studio tools**, `Use minified JS` and `Use minified CSS` are button pairs (`Use minified ...` + `Revert`) inside separate `<li>` items; scope `"Revert"` by `page.locator('li', { hasText: 'Use minified JS' }).getByText('Revert', { exact: true })` (and likewise for CSS) and **always click `Revert` on both after testing** so Studio does not serve cached minified assets instead of subsequent SFTP uploads.
  2. Under the **Build a new release version** section on `https://studio.boardgamearena.com/studiogame?game=tichu`:
     - Click **`⇨ Dry run build (to check code warnings)`** first and verify there are no blocking warnings or errors in the modal popup.
     - Fill in the **`Release note: what has changed since the last release?`** input field (max 250 chars).
     - Click **`⇨ Commit & build a new version now`**. This snapshots the SFTP `/tichu/` files into BGA's internal SVN/release system and builds a numbered release package (e.g., `YYMMDD-HHMM`).
     - **Fast `chrome-devtools` MCP `evaluate_script` alternative** (once the user confirms building without deploying):
       - Prefer reusing an already-open `https://studio.boardgamearena.com/*` tab (e.g., `/controlpanel` or `/studiogame?game=tichu`), because BGA Studio's `SameSite` session cookie redirects cold `new_page` top-level navigations to `/account?warn` while same-origin `fetch()` calls carry the session cleanly.
       - Check `POST /studiogame/studiogame/getStudioGamePageData.html` (`{ game: "tichu" }`) -> verify `data.workspace["blocked-files"]` is `[]` and `error` is `null`.
       - Run `POST /studio/project/dryRunBuild.html` (`{ gamename: "tichu" }`) and `POST /studio/project/build.html` (`{ gamename: "tichu", comment }`) with `Accept: "application/json"` and `X-Request-Token: window.bgaConfig.requestToken` (both return `{ blocks, buildInfos }` directly without a `{ status: 1 }` wrapper), then verify `POST /studiogame/studiogame/getStudioGameVersions.html` (`{ game: "tichu" }`).
  3. Under the **Versions available for production** section:
     - Locate the newly built version row and click its **Deploy** button (`Deploy to production`) to push it live to `boardgamearena.com`.
  4. **Rolling Back a Production Release**:
     - Rolling back on `studiogame?game=tichu` means clicking **`Deploy to production`** on the previous stable build in the **Versions available for production** history (`proddeploy.html`). Always keep at least one known-good release build in the version history (never delete the previous build right after deploying).

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

## 3. Live Game Migration, Wire Skew & Rollback Compatibility

### How BGA Platform Handles Deployments & Rollbacks Under the Hood

- **Open browser tabs are NEVER auto-reloaded** on game deploy or rollback, and BGA's `ajaxcall` / Centrifuge notification pipeline performs **no game-version check** (`code 806` `"Update needed!"` is CSRF token expiry, and `force_browser_reload` is only for BGA platform upgrades). Already-open tabs keep their in-memory `.tpl` DOM, `tichu.css`, and `tichu.js` talking directly to the newly deployed (or rolled-back) PHP backend until the user refreshes (`F5`). Fresh page loads serve `.tpl`, `tichu.js`, and `tichu.css` atomically from the active release (`YYMMDD-HHMM`).
- **`upgradeTableDb($from_version)` & `game_db_version` (`global_id = 300`) are strictly one-way**: `Table::setTable()` only runs `upgradeTableDb($from_version)` and updates `global[300]` when `$game_version > $db_version`. On a rollback (`OLD < NEW`), **no downgrade hook runs** and `global[300]` stays at `NEW` on every table that processed a request while `NEW` was live — creating a split `$from_version` baseline across tables for the _next_ release. All `upgradeTableDb` logic must therefore use idempotent schema guards (`SHOW COLUMNS`, `CREATE TABLE IF NOT EXISTS`, `try/catch` for `zz_replay*` shadow tables).

### The 4-Direction Compatibility Checklist (Audit Before Modifying Actions, Notifications, States, `actionlog`, or Schema)

1. **Forward DB / State / Replay (`OLD DB -> NEW PHP + NEW JS`)**: Never delete states or change `ST_*`, option, preference, or stat IDs. Default newly added `global` rows safely when absent on running tables (`getGameStateValue("...", 0)` + `INSERT` fallback if `UPDATE` affects 0 rows). Keep `<tichu-replay>` and `g_replayFrom` tolerant of historical `gamelog` payload types (e.g., `Number(args.bet)` for `"200"` vs `200`).
2. **Forward Live-Tab Skew (`OLD JS open tab <-> NEW PHP`)**: Preserve `tichu.action.php` endpoint names, parameter names/types/enums, and `states.inc.php` `possibleactions` expected by the currently live `tichu.js`. Keep `NotificationManager.php` notification names and existing payload keys/types intact (additive keys only).
3. **Rollback Live-Tab Skew (`NEW JS open tab <-> OLD PHP`)**: `NEW` JS (`src/tichu.ts`, `GameModel`, `Combo`) must gracefully handle `undefined` for newly added `getAllDatas` or `NotificationManager` fields (especially when client-side validators disable/gate Play or Pass buttons!) and must not depend on brand-new action endpoints unless phased across releases.
4. **Rollback DB / Log Forwards Compatibility (`NEW DB/Logs -> OLD PHP + OLD JS`)**: Because BGA has no `downgradeTableDb`, never drop/rename columns or card locations, park tables in newly added states, or change `actionlog` round/trick query invariants expected by `OLD` PHP in a single release. Use a **two-release expand-then-contract** rollout for any breaking schema, action, or log change.

### Client Version Reload Banner (`checkVersion` in `src/tichu.ts`)

- `TICHU_CODE_VERSION` (`modules/Constants.php`, synced with `package.json` & `package-lock.json` `"version"` and injected into `tichu.js` via `--define:__TICHU_CODE_VERSION__`) is emitted as `codeVersion` on `getAllDatas()` and every `NotificationManager` notification (`broadcast()` / `notifyPlayerWithVersion()`).
- In live non-read-only tabs (`!this.isReadOnly()`), `setup()` compares `__TICHU_CODE_VERSION__` against `gamedatas.codeVersion` (catching CDN-cached stale JS on initial load), and `traceNotif()` -> `checkVersion()` compares each incoming notification's `codeVersion` against `this.initialCodeVersion` — detecting **both** forward upgrades (`V1 -> V2`) and rollbacks (`V2 -> V1`, where `global[300]` `game_db_version` stays monotonic). Notifications from pre-`codeVersion` builds fall back to `gameVersion` (`global[300]`) parity.

### Schema, DB & Platform Rules

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
  - `clienttranslate()` (PHP) and global `_("...")` (`tichu.js`) are statically extracted by BGA Translation HQ — pass single quoted literal strings only (no variables, `+` concatenation, backtick templates, or local `const t` / `function translate` wrappers, which `esbuild` mangles into invisible `t5(...)` calls in `tichu.js`). Enforced on both `src/**/*.ts` and built `tichu.js` by `npm run test:contracts`.
  - When a notification argument is used both for client logic/CSS and for log display, pass two separate keys (raw value + `clienttranslate()` label listed in `'i18n' => [...]`, omitting bare numeric strings `"0"` / `"2".."10"` via `CardManager::isTranslatableCardStr()`).
  - Append `&dummyTranslations` to a Studio table URL to wrap all translated client `_()` strings in `«»` (note: `&dummyTranslations` hooks runtime `globalThis._`, so always pair it with `npm run test:contracts` to guarantee static extractability).
- **BGA Dark Mode**: BGA toggles dark mode via `html[data-theme="dark"]` (not `@media (prefers-color-scheme: dark)`). Any custom UI container with a fixed light background must specify an explicit dark text `color`.
- **Safari CSS Filter Caveat (`.dj_safari`)**: Never apply `filter: drop-shadow(...)` across many card nodes simultaneously (causes severe Safari GPU lag on BGA; use `box-shadow` instead).

---

## 5. Shadow DOM, `.disabler` & BGA Interactive Tutorial Creator

Per [`docs/BGA_OPEN_SOURCE_ECOSYSTEM.md`](file:///Users/brohlfs/git/tichu/docs/BGA_OPEN_SOURCE_ECOSYSTEM.md) and `rbellec/claude-code-bga` (`tutorial-ready.md`), BGA's Interactive Tutorial Creator (`https://en.doc.boardgamearena.com/Tutorials_checklist`) inspects light-DOM `document.elementFromPoint(x, y)` targets and `bga_tutorial_...` light-DOM element IDs:

- Tichu renders its entire UI inside Lit Shadow DOM roots (`<tichu-game>`, `<tichu-hand>`, `<tichu-last-played>`, `<tichu-action-bar>`), uses a full-table `.disabler` overlay (`tichu-last-played.ts`), and auto-triggers `collect` on `confirmTrick`.
- Standard Tutorial Creator step recording cannot target elements inside Shadow DOM or click past `.disabler` unless light-DOM proxy anchors are provided and auto-`collect` / `.disabler` pointer blocking are paused during tutorial playback.

---

## 6. Official BGA 2025–2026 Modernization Workflows (`modernize-bga-game-project`)

Consult `https://doc.studio.boardgamearena.com/framework-documentation/ai-tooling/` (or [Plan 13](file:///Users/brohlfs/git/tichu/plans/13-modern-bga-sounds-and-polyphonic-audio.md) and [Plan 18](file:///Users/brohlfs/git/tichu/plans/18-bundle-diet-modern-bga-esm-autowired-actions-and-tutorials.md)) when migrating Tichu's classic architecture toward modern BGA APIs. Before starting any migration workflow:

1. Refresh [`_ide_helper.php`](file:///Users/brohlfs/git/tichu/_ide_helper.php) and [`src/types/bga-framework.d.ts`](file:///Users/brohlfs/git/tichu/src/types/bga-framework.d.ts) from Studio.
2. Never create new PHP traits during migration, and always edit TypeScript in `src/` (then run `npm run build`) rather than patching `tichu.js`.
3. Follow BGA's ordered dependency chain:
   - **Config & Assets**: `mysql_fetch_assoc` -> `bga-jsonc-files` -> `bga-gameinfos-cleanup` (requires `gameinfos.jsonc`) -> `bga-fonts` -> `bga-sounds` (`sounds/` auto-loading) -> `bga-jstpl` -> `bga-default-states` (remove states `1` and `99` from `states.inc.php`) -> `bga-material`.
   - **Backend PHP**: `bga-new-table` -> `bga-new-apis` -> `bga-server-translations` -> `bga-namespaced-game` (`modules/php/Game.php`, requires relocated material first) -> `bga-autoload` -> `bga-strict-types` (excludes `*.inc.php`) -> `bga-autowired-actions` (`act*` methods + delete `tichu.action.php`, **must preserve `acquireGameLock()` & `#[CheckAction(false)]` on out-of-turn actions!**) -> `bga-mysql-strict-mode` -> `bga-php8-code` -> state classes (`bga-game-state-classes`, `bga-active-player-state-classes`, `bga-multi-active-player-state-classes`) -> `bga-zombie-random-move`.
   - **Frontend JS/TS**: `bga-js` -> `bga-replace-dojo` -> `bga-remove-view-tpl` (delete `tichu.view.php` & `tichu_tichu.tpl`) -> `bga-es6` (`modules/js/Game.js` ESM, requires `bga-js` complete with no `format_string_recursive` override).
   - **SFTP Deletion Warning**: Deleting `tichu.action.php`, `tichu.view.php`, or `tichu_tichu.tpl` in git does not remove them on BGA Studio — explicitly `rm` obsolete files over SFTP so Studio stops loading them.
