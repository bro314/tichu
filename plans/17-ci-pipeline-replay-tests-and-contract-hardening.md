# 17 — GitHub Actions MySQL 8.0 CI, `<tichu-replay>` Stream Tests & Contract Hardening

- **Priority**: P1
- **Recommended Roadmap Day**: Day 1
- **Scope**: `.github/workflows/ci.yml` (new), `tests/replay.test.ts` (new), `tests/fixtures/replay-stream.json` (new), `src/elements/replay-engine.ts` (new), `src/elements/tichu-replay.ts`, `src/elements/model.ts`, `src/elements/utils.ts`, `src/elements/tichu-*.ts` (10 elements), `src/types/tichu-contracts.ts`, `local/check-contracts.php`, `local/bga-backend.php`, `local/mysql-ctl.sh`, `local/integration-tests.php`, `modules/managers/PlayerManager.php`, `modules/managers/NotificationManager.php`, `phpstan.neon`, `tichu.game.php`, `tichu.action.php`, `tichu.view.php`, `modules/*.php`, `modules/managers/*.php`, `package.json`, `composer.json` (supersedes `plans/01-static-contracts-phpstan-and-ci.md`)
- **Open BGA Tickets / Prod Issues Covered**: None (`[]`); proactively prevents silent archive-replay breakage, BGA i18n extraction regressions (protecting [#78193](https://boardgamearena.com/bug?id=78193) / [#175241](https://boardgamearena.com/bug?id=175241)), non-BGA RNG drift, and PHP 8.4 type bugs.
- **Estimated Effort**: Medium–Large (CI + MySQL TCP adapter ~1h; headless replay extraction + stream tests ~2.5h; contract hardening + i18n/RNG fixes ~1.5h; PHPStan Level 6 typing across 10 PHP files ~2.5h)
- **Dependencies & Shared ID Reservations**: Supersedes `01-static-contracts-phpstan-and-ci.md` (archived in [00-roadmap-index.md](file:///Users/brohlfs/git/tichu/plans/00-roadmap-index.md)). Zero changes to `gameoptions.inc.php` (`106`–`108`), `stats.inc.php` (`13`, `17`–`22`), `global` (`31`), or `actionlog` schemas; coordinates `roundScore` / `newScores` replay tolerance with [Plan 10](file:///Users/brohlfs/git/tichu/plans/10-live-round-scoreboard-and-replay-teams.md).

---

## 1. Why & Goal

`plans/01` (archived in [00-roadmap-index.md](file:///Users/brohlfs/git/tichu/plans/00-roadmap-index.md)) delivered `src/types/tichu-contracts.ts`, `local/check-contracts.php`, and `phpstan.neon` (`level: 5`), yet **three high-leverage blind spots** still let silent regressions reach production:

1. **No GitHub Actions CI**: `.github/workflows/ci.yml` does not exist, and `local/mysql-ctl.sh` / `local/bga-backend.php` assume a macOS Homebrew Unix socket (`local/.mysql/mysql.sock`) instead of supporting TCP MySQL 8.0 service containers cleanly.
2. **Zero automated tests for `<tichu-replay>` & `Model` (1,064 lines)**: `tichu-replay.ts` + `model.ts` mix pure notification replay logic with Lit DOM registration, so broken replay handlers, `TEAM_RANDOM`/`TEAM_1_2` score misalignment, or backward-scrub drift go undetected for months.
3. **Silent i18n, RNG, and PHP type gaps**: Ten Lit Shadow DOM elements wrap `_()` inside `const t = ...` / `function translate(...)`, which `esbuild` compiles into unextractable `t5("...")`..`t13("...")` calls in `tichu.js`; `PlayerManager.php` still calls `shuffle()`; `NotificationManager` `acceptCards`/`passCards` omit `'i18n'` for `${card1..3}`; and `phpstan.neon` sits at `level: 5` (hiding 335 missing type annotations at `level: 6`).

Goal: Make every push/PR enforce full PHP 8.4 + MySQL 8.0 (`SERIALIZABLE`) + TS + Prettier + PHPStan Level 6 + contract + headless `<tichu-replay>` verification automatically.

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| Surface                     | Verified State & Symbols                                                                                                                                                                                                                             | Exact File / Lines                                                                                                                                                                                                                                                                                                                                              |
| :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI & MySQL env wiring       | No `.github/` dir; `mysql-ctl.sh` checks Homebrew paths only; `$g_config` lacks `db_port` and forces `local/.mysql/mysql.sock` via `?:` triggering `shell_exec("mysql-ctl.sh ensure")`; `integration-tests.php` hardcodes port `0` on `$otherDb`.    | [`package.json`](file:///Users/brohlfs/git/tichu/package.json#L7-L28), [`local/mysql-ctl.sh`](file:///Users/brohlfs/git/tichu/local/mysql-ctl.sh#L17-L80), [`local/bga-backend.php`](file:///Users/brohlfs/git/tichu/local/bga-backend.php#L728-L866), [`local/integration-tests.php`](file:///Users/brohlfs/git/tichu/local/integration-tests.php#L1498-L1781) |
| Replay stream & model       | `TichuReplay` (`751` lines) + `Model` (`313` lines) = `1,064` lines with 0 tests; `next()` increments `notifIndex++` before `if (!notif) return`; `newScores` passes unnormalized `args.newScores[id]`; `customElements.define` blocks Node imports. | [`src/elements/tichu-replay.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-replay.ts#L1-L751), [`src/elements/model.ts`](file:///Users/brohlfs/git/tichu/src/elements/model.ts#L141-L313), [`src/elements/tichu-score-board.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-score-board.ts#L64-L90)                                            |
| Translation wrappers        | 9 elements define `const t = ...` (bundled to `t5`..`t13` in `tichu.js:14080-16544`) and `tichu-card.ts` defines `translate()` (`tichu.js:11164`); `tichu.js` is gitignored (`.gitignore:7`).                                                        | [`src/elements/tichu-card.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-card.ts#L6-L106), [`src/elements/tichu-action-bar.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-action-bar.ts#L16), [`src/types/bga-framework.d.ts`](file:///Users/brohlfs/git/tichu/src/types/bga-framework.d.ts#L66)                                              |
| Notification `'i18n'` & RNG | `acceptCards` (`${card1..3}`) & `passCards` lack `'i18n'`; `PlayerManager::setupPlayers` calls bare PHP `shuffle($playerIds)` on `TEAM_RANDOM`.                                                                                                      | [`modules/managers/NotificationManager.php`](file:///Users/brohlfs/git/tichu/modules/managers/NotificationManager.php#L146-L180), [`modules/managers/PlayerManager.php`](file:///Users/brohlfs/git/tichu/modules/managers/PlayerManager.php#L38-L40), [`local/check-contracts.php`](file:///Users/brohlfs/git/tichu/local/check-contracts.php#L641-L755)        |
| PHPStan Level 6             | Running `--level=6` reports `335` errors across 10 files (`160` param, `157` return, `12` property, `6` iterableValue); `Bot.php` has `0`. Parent `Table::setupNewGame`, `Table::upgradeTableDb`, `game_view::build_page` are untyped in stubs.      | [`phpstan.neon`](file:///Users/brohlfs/git/tichu/phpstan.neon#L1-L22), [`_ide_helper.php`](file:///Users/brohlfs/git/tichu/_ide_helper.php#L2192-L3790), [`local/Bga/GameFramework/Table.php`](file:///Users/brohlfs/git/tichu/local/Bga/GameFramework/Table.php#L187-L4166)                                                                                    |

---

## 3. Architectural Decisions & Trade-offs

1. **CI MySQL 8.0 Wiring (`TICHU_MYSQL_HOST` TCP vs. separate CI test script)**:
   - **Recommended**: Teach `local/mysql-ctl.sh` (`ensure`/`start`) to exit `0` when `TICHU_MYSQL_HOST` is non-empty, add `db_port` (`TICHU_MYSQL_PORT`) + conditional `db_socket` (`null` when `TICHU_MYSQL_HOST` is set and `TICHU_MYSQL_SOCKET` is empty) in `local/bga-backend.php`, and wire `db_port` in `integration-tests.php` secondary `$otherDb` connections. Keeps identical `npm run test:integration` and optional `workflow_dispatch` `npm run test:race` commands on macOS and Linux (`elaskavaia/bga-mars` / `thoun/bga-cards` CI exemplar).
2. **Headless `<tichu-replay>` Testing (`replay-engine.ts` vs. JSDOM/Lit mocks)**:
   - **Recommended**: Extract pure DOM-free `ReplayEngine` (`tidyUpGamelogs`, `segmentNotifMoves`, `createScoreBoard`, `isIgnoredReplayNotif`, `applyReplayNotif`, forward/backward `stepForward`/`stepBack`/`nextMove`/`prevMove`) into `src/elements/replay-engine.ts` imported by both `src/elements/tichu-replay.ts` and `tests/replay.test.ts` (bundled via `esbuild --platform=node` alongside `tests/combo-validator.test.ts`). Avoids fragile DOM shims while testing the exact production replay reducer. Re-export `tidyUpGamelogs`/`segmentNotifMoves` from `tichu-replay.ts` for compatibility.
3. **Eliminating Translation Wrappers (`_("...")` + single global fallback vs. `esbuild` plugin)**:
   - **Recommended**: Replace `const t = ...` / `function translate(...)` across all 10 `src/elements/tichu-*.ts` files with direct `_("...")` calls (ambiently typed in `bga-framework.d.ts:66`), and install `(globalThis as any)._ ??= (s: string) => s;` once in `src/elements/utils.ts` (imported by elements/tests without shadowing `_` in module scope). Guarantees `esbuild` emits extractable `_("...")` literals in `tichu.js` with zero build complexity (matching `bga-sharedcode` / `elaskavaia/bga-mars` extractor linting).
4. **PHPStan Level 6 Typing Strategy (LSP-safe PHPDoc + safe native types vs. baseline ignore)**:
   - **Recommended**: Fix all `335` diagnostics directly with zero `phpstan-baseline.neon` suppression. Use native PHP return/param types where callers and parents agree (`int|string` where `tichu.action.php` `AT_posint` passes numeric strings), and PHPDoc `@param`/`@return` on overrides whose BGA parent stubs are untyped (`Tichu::setupNewGame`, `Tichu::upgradeTableDb`, `view_tichu_tichu::build_page`), mirroring `rbellec/bga_duelly`'s strict `_ide_helper.php` `scanFiles` discipline.

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

- **`OLD DB -> NEW PHP + NEW JS`**: No `dbmodel.sql`, `ST_*`, option, pref, or stat changes. Replacing `shuffle($playerIds)` with `bga_rand` only affects initial `setupNewGame()` seating on `TEAM_RANDOM`. Adding `i18n => ['card1', 'card2', 'card3']` in `NotificationManager` is purely additive.
- **`OLD open JS tab <-> NEW PHP`**: Old JS tabs ignore unknown `i18n` metadata on `acceptCards`/`passCards` cleanly and keep calling existing `tichu.action.php` signatures (note: never tighten `tichu.game.php` method params away from string/int tolerance like `int|string`).
- **`NEW open JS tab <-> OLD PHP` (Rollback)**: `tichu-replay.ts` / `replay-engine.ts` must keep tolerating legacy `"200"` string vs `200` int (`Number(args.bet)`), numeric string `newScores`, and absent `i18n` keys. Direct `_("...")` emits identical runtime calls against BGA's global `_()`.
- **`NEW DB / actionlog -> OLD PHP + OLD JS` (Rollback)**: Zero schema or `actionlog` payload changes; fully rollback-safe with zero migration required.
- **Locking, Autopass & Safety Invariants**: Concurrency locks (`acquireGameLock()`, `acquireGameLockOrFail()`, `syncStaleReturnState()`, `GLOBAL_LOCK_VERSION = 30`), `@thoun` `player_pass` resets, and `local/import-bug-sql.php` 7-surface remapping are untouched. Check `local/check-contracts.php` Section 6 + `sftp-sync.sh` allowlist so `tests/`, `.github/`, `src/elements/replay-engine.ts`, and `local/` never upload to Studio (`workspace.blocked-files` stays `[]`).

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Make Local MySQL Adapter CI-Ready & Create `.github/workflows/ci.yml`

1. In [`local/mysql-ctl.sh`](file:///Users/brohlfs/git/tichu/local/mysql-ctl.sh#L50-L55), short-circuit `start_mysql()` (`ensure`/`start`) with `return 0` when `[[ -n "${TICHU_MYSQL_HOST:-}" ]]` before macOS binary lookup.
2. In [`local/bga-backend.php`](file:///Users/brohlfs/git/tichu/local/bga-backend.php#L728-L734), add `'db_port' => getenv('TICHU_MYSQL_PORT') ? (int) getenv('TICHU_MYSQL_PORT') : null`, and resolve `'db_socket'` to `null` when `TICHU_MYSQL_HOST` is set and `TICHU_MYSQL_SOCKET` is unset/empty. Update `new \mysqli(...)` in [`local/integration-tests.php`](file:///Users/brohlfs/git/tichu/local/integration-tests.php#L1498-L1505) & [`L1774-L1781`](file:///Users/brohlfs/git/tichu/local/integration-tests.php#L1774-L1781) to pass `(int) ($g_config['db_port'] ?? 0)` and `$g_config['db_socket'] ?? ''`.
3. Create `.github/workflows/ci.yml`:
   - `on: { push: { branches: [main] }, pull_request: { branches: [main] }, workflow_dispatch: {} }`.
   - Job `ci` (`ubuntu-latest`) with `services.mysql` (`image: mysql:8.0`, env `MYSQL_ROOT_PASSWORD: tichu_ci`, `ports: ["3306:3306"]`, command `--transaction-isolation=SERIALIZABLE --sql-mode=STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION --default-time-zone=+00:00 --character-set-server=utf8mb4`, healthcheck `mysqladmin ping`), `shivammathur/setup-php@v2` (`php-version: '8.4'`, `extensions: mysqli, mbstring, json`), `actions/setup-node@v4` (`node-version: '22'`, `cache: 'npm'`).
   - Run: `composer install --no-interaction --prefer-dist`, `npm ci`, `npm run test:unit`, `npm run test:validator`, `npm run compile && npm run bundle`, `npm run test:contracts`, `npm run phpstan`, `npm run test:integration` (env `TICHU_MYSQL_HOST=127.0.0.1`, `TICHU_MYSQL_PORT=3306`, `TICHU_MYSQL_USER=root`, `TICHU_MYSQL_PASS=tichu_ci`, `TICHU_MYSQL_DB=ebd_tichu_test`), and `npx prettier --check "src/**/*.ts" "*.css" "plans/*.md" "AGENTS.md" ".agents/**/*.md"`.
   - Optional job `race` (`if: github.event_name == 'workflow_dispatch'`) with same MySQL 8.0 service running `npm run test:race -- --duration=20 --reps=10`.

### Step 2: Headless `<tichu-replay>` Engine & `tests/replay.test.ts` Stream Suite

1. Create `src/elements/replay-engine.ts` moving `tidyUpGamelogs`, `segmentNotifMoves`, `createScoreBoard`, `isIgnoredReplayNotif`, and a DOM-free `ReplayEngine` class (wrapping `Model`, `states[]`, `notifIndex`, `ignoredNotifType`, `applyReplayNotif()`, `stepForward()` guarding `notifIndex >= notifs.length`, `stepBack()`, `nextMove()`, `prevMove()`, `nextRound()`, `prevRound()`) out of `src/elements/tichu-replay.ts`. Normalize `Number(args.newScores[playerId])` when calling `model.setGamePoints`.
2. Refactor [`src/elements/tichu-replay.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-replay.ts#L245-L751) to delegate state stepping to `ReplayEngine` and re-export `tidyUpGamelogs`, `segmentNotifMoves`, `createScoreBoard`.
3. Create `tests/fixtures/replay-stream.json` (captured from `Tichu::getAllGamelogsForReplay()` via `local/integration-tests.php` plus deterministic edge-case streams) and `tests/replay.test.ts`:
   - Exercise: GT bet `200` int **and** legacy `"200"` string, `tichuBet` (`100`/`0`), `passCards` -> `acceptCards`, `wishMade` + `mahjongWishGranted`, ambiguous Phoenix straight/full-house `playCombo`, Dragon win (`captureCards`), bomb interrupt + cancel + bomb win, Double Victory, multi-round `newScores`/`tableWindow` (and future-tolerant `roundScore`), zombie turn (`pass`/`playCombo`), `TEAM_RANDOM`, and `TEAM_1_2` seat permutation.
   - Step `0..N` and assert `ignoredNotifType === ""`, 56-card conservation (hands + unaccepted passes + trick combos + captured = 56, zero duplicate IDs), and exact per-team `scoreBoard` totals; then step `N..0` asserting `deepEqual(engine.getState(), forwardStates[i])` at every index `i`!
4. Wire `tests/replay.test.ts` into [`package.json`](file:///Users/brohlfs/git/tichu/package.json#L8) `test:validator` (`esbuild` bundle + `node` execution so `npm test` runs it automatically).

### Step 3: Migrate Element Translations to `_("...")` & Fix RNG / `NotificationManager` `'i18n'`

1. In [`src/elements/utils.ts`](file:///Users/brohlfs/git/tichu/src/elements/utils.ts#L1-L44), initialize `(globalThis as any)._ ??= (s: string) => s;` (no local `_` binding!) and import `./utils` where needed; replace all `t("...")` and `translate("...")` calls with direct `_("...")` across `tichu-action-bar.ts`, `tichu-card.ts`, `tichu-hand.ts`, `tichu-last-played.ts`, `tichu-pass-area.ts`, `tichu-played-cards.ts`, `tichu-player-panel.ts`, `tichu-status.ts`, `tichu-trick-modal.ts`, and `tichu-value-choice.ts`.
2. In [`modules/managers/PlayerManager.php`](file:///Users/brohlfs/git/tichu/modules/managers/PlayerManager.php#L38-L40), replace `shuffle($playerIds)` with a Fisher-Yates loop using `bga_rand(0, $i)`.
3. In [`modules/managers/NotificationManager.php`](file:///Users/brohlfs/git/tichu/modules/managers/NotificationManager.php#L146-L180), add `"i18n" => ["card1", "card2", "card3"]` to `acceptCards` and `passCards` (and add `i18n?: string[]` to [`src/types/tichu-contracts.ts`](file:///Users/brohlfs/git/tichu/src/types/tichu-contracts.ts#L67-L68)).

### Step 4: Harden `local/check-contracts.php`

Update [`local/check-contracts.php`](file:///Users/brohlfs/git/tichu/local/check-contracts.php) with four enforced checks:

- **(a) Translation wrapper ban**: Scan `src/**/*.ts` for `const|let|var|function` bindings of `t`, `translate`, or `_` and JS calls `(?<![\w.:-])(?:t|translate)\s*\(` (outside CSS `transform:`); scan built `tichu.js` (when present, always in CI after `bundle`) for `/\b(?:t[0-9]*|translate[0-9]*|_[0-9]+)\s*\(\s*(?:["'`]|[A-Za-z_$][\w$.]_\s_\))/`.
- **(b) Notification `${...}` `'i18n'` check**: Extract all `${key}` placeholders from `clienttranslate(...)` strings in `NotificationManager.php` and `NotificationManager::*` call sites in `tichu.game.php`/`modules/**`; reject any non-player placeholder (`!preg_match('/player_name/i', $key)` and not in scalar allowlist `['trick_value']`) omitted from `'i18n' => [...]`.
- **(c) Zero PHP `shuffle(` check**: Tokenize all deployable PHP (`tichu.*.php`, `*.inc.php`, `modules/**/*.php`) and fail on any `T_STRING` `"shuffle"` followed by `(` not preceded by `->`, `?->`, `::`, or `function` (preserving `$deck->shuffle("deck")`).
- **(d) Direct `NotificationManager` <-> `tichu.ts` & `replay-engine.ts`/`tichu-replay.ts` check**: Scan all deployed PHP for direct `notifyAllPlayers`/`notifyPlayer` calls (disallowing raw sends outside `NotificationManager.php` except framework multiactive updates), and verify every `NotificationManager` event name directly against both `src/tichu.ts` (`setupNotifications` + `notif_*` or explicit `$bgaBuiltinNotifs` allowlist) and `src/elements/replay-engine.ts` (`applyReplayNotif` + `isIgnoredReplayNotif`).

### Step 5: Upgrade `phpstan.neon` to `level: 6` & Fix All 335 Type Diagnostics

1. Set `level: 6` in [`phpstan.neon`](file:///Users/brohlfs/git/tichu/phpstan.neon#L2) (and align `composer.json` `phpstan` script if desired).
2. Annotate the 10 affected PHP files (`tichu.game.php`, `NotificationManager.php`, `Hand.php`, `Combo.php`, `PlayerManager.php`, `LogManager.php`, `CardManager.php`, `tichu.action.php`, `Utils.php`, `tichu.view.php`) with exact property, param, return, and iterable PHPDoc/native types — keeping `Tichu::setupNewGame`, `Tichu::upgradeTableDb`, and `view_tichu_tichu::build_page` parameters typed via PHPDoc only (never stricter native parameter hints against untyped parent BGA stubs), and typing numeric string/int bridge args as `int|string` where `action_tichu` (`AT_posint`/`AT_int`) or tests pass both.
3. Run `npm run format` on modified TS/MD files (and verify [`00-roadmap-index.md`](file:///Users/brohlfs/git/tichu/plans/00-roadmap-index.md) status).

---

## 6. Verification Checklist & Regression Tests

- [ ] `npm run test:unit` (PHPUnit `tests/ComboTest.php`, `tests/HandTest.php`) exits `0`.
- [ ] `npm run test:validator` runs both `tests/combo-validator.test.ts` and new `tests/replay.test.ts` (`0..N`, `N..0`, `ignoredNotifType === ""`, 56-card conservation, `TEAM_RANDOM`/`TEAM_1_2` scoreboard totals, `"200"` vs `200` GT bet) and exits `0`.
- [ ] `npm run compile && npm run bundle` produces `tichu.js` with `_("Round:")`, `_("Play a Bomb")`, `_("Scores 10 points")` etc. verbatim and zero `t5(...)` / `translate(...)` / `_2(...)` calls.
- [ ] `npm run test:contracts` exits `0` AND temporary synthetic violations (adding `t("x")`, bare `shuffle($a)`, un-`i18n`'d `${foo}`, or unhandled `NotificationManager` method) each fail with clear `[i18n]`/`[PlatformSafety]`/`[NotifContract]` messages.
- [ ] `npm run phpstan` (`level: 6`) exits `0` with `0` errors and zero `phpstan-baseline.neon` suppression.
- [ ] `npm run test:integration` passes all 18 MySQL 8.0 suites locally AND under CI `TICHU_MYSQL_HOST=127.0.0.1` TCP mode (`mysql-ctl.sh ensure` skipped cleanly).
- [ ] `npx prettier --check "src/**/*.ts" "*.css" "plans/*.md" "AGENTS.md" ".agents/**/*.md"` exits `0`.
- [ ] On `npm run local` (plus Studio SFTP sync), run `tt.runSuite({ speed: "instant" })`, toggle `&dummyTranslations` (`?dummyTranslations`) to confirm `<tichu-status>`/`<tichu-hand>`/`<tichu-action-bar>` wrap in `«...»`, and verify Archive Replay (`Experimental Replay`) steps forward/backward cleanly.

---

## 7. BGA Ticket Closure & Kickoff Prompt

- **BGA Tracker Updates**: None (`covered_bugs = []`, `0` prod Sentry issues). **Reminder**: Never post status updates or replies on `boardgamearena.com` without explicit user approval, and never use Markdown backticks in BGA bug reply text.

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/local/check-contracts.php, /Users/brohlfs/git/tichu/phpstan.neon, /Users/brohlfs/git/tichu/src/elements/tichu-replay.ts, /Users/brohlfs/git/tichu/src/elements/model.ts, and /Users/brohlfs/git/tichu/plans/17-ci-pipeline-replay-tests-and-contract-hardening.md.
Confirm Section 3 architectural choices with the user, then implement Steps 1–5 cleanly:
1. Make `local/mysql-ctl.sh`, `local/bga-backend.php`, and `local/integration-tests.php` support CI TCP MySQL env vars (`TICHU_MYSQL_HOST`, `TICHU_MYSQL_PORT`) and add `.github/workflows/ci.yml`.
2. Extract DOM-free `src/elements/replay-engine.ts`, wire `tichu-replay.ts` to it, add `tests/fixtures/replay-stream.json` + `tests/replay.test.ts` (forward `0..N` + backward `N..0` deep equality + 56-card conservation + `TEAM_RANDOM`/`TEAM_1_2` scoring), and include it in `npm run test:validator`.
3. Migrate `t()` / `translate()` wrappers in all 10 `src/elements/tichu-*.ts` files to direct `_()`, replace `shuffle()` in `modules/managers/PlayerManager.php`, add `'i18n'` for `${card1..3}` in `NotificationManager.php` + `tichu-contracts.ts`, and enforce all 4 hardened checks in `local/check-contracts.php`.
4. Upgrade `phpstan.neon` to `level: 6` and resolve all 335 type diagnostics (respecting untyped BGA parent stubs via PHPDoc).
Verify `npm run build`, `npm run test:contracts`, `npm run phpstan`, `npx prettier --check`, and `npm run local` `&dummyTranslations` + Experimental Replay.
```
