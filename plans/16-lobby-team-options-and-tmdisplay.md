# 16 — Lobby Team Defaults (`Teams: At random`) & `tmdisplay` Lobby Visibility

- **Priority**: P2
- **Recommended Roadmap Day**: Day 7
- **Scope**: `gameoptions.inc.php`, `local/scenarios.php`, `local/Bga/GameFramework/Table.php`, `local/router.php`, `local/js/bga-shim.js`, `local/import-bug-sql.php`, `local/integration-tests.php`, `src/studio-test.ts`
- **Open BGA Tickets / Prod Issues Covered**: [#95467](https://boardgamearena.com/bug?id=95467) (4v, `acknowledged` — default `At random`), [#95469](https://boardgamearena.com/bug?id=95469) (3v, `inforequest` — lobby `tmdisplay` visibility), and platform rematch context [#35575](https://boardgamearena.com/bug?id=35575) (10v, closed `rejected`)
- **Estimated Effort**: Small (1–2h config change, local test-determinism pinning, Studio option reload)
- **Dependencies & Shared ID Reservations**: Uses `totranslate` contract checks from [Plan 17](file:///Users/brohlfs/git/tichu/plans/17-ci-pipeline-replay-tests-and-contract-hardening.md) and fallback sync in [bga-bug-triage](file:///Users/brohlfs/git/tichu/.agents/skills/bga-bug-triage/SKILL.md); leaves `03 — Zero-Reload Preferences` (archived in [00-roadmap-index.md](file:///Users/brohlfs/git/tichu/plans/00-roadmap-index.md)) (`100..105`) untouched. Preserves option `101` (`1..4`) unchanged; zero collision with reserved `$game_preferences` `106..108` (Plans 06/13/14), Plan 05 `localStorage` hand keys, Plan 12 `stats` (`13`, `17..22`), Plan 15 `global` (`31`), or new `actionlog` actions.

---

## 1. Why & Goal

Over 95% of BGA Tichu tables open with `Teams: At random` (`101 = 4`), yet option `101` still defaults to `1` (`1st/3rd versus 2nd/4th`). Casual/newcomer creators who leave defaults untouched silently expose themselves to pre-arranged partnerships ([#95467](https://boardgamearena.com/bug?id=95467)). Compounding this, BGA's Svelte open-table lobby suppresses an option's `tmdisplay` badge whenever the table matches the option's default (or viewer filter baseline). With `"default" => 1`, fixed `1/3 vs 2/4` tables display **no** team badge in the lobby ([#95469](https://boardgamearena.com/bug?id=95469)), making fixed-seat and default tables indistinguishable without clicking into each table.

Goal:

1. Flip `$game_options[101]['default']` from `1` (`1/3 vs 2/4`) to `4` (`At random`), making fixed-team selections surface their `tmdisplay` badge in open-table lobby cards and custom-options summaries.
2. Add an explicit `"Teams: "` prefix to option `101` `tmdisplay` strings because BGA strips the option title whenever `tmdisplay` is set.
3. Audit and pin every local/Studio test fixture assuming default `playerTeams === 1`, keeping tests 100% deterministic while syncing local defaults with production.

---

## 2. Current Codebase Reality (Line-Accurate Audit)

### Game Options, Constants & Player Setup

- [gameoptions.inc.php](file:///Users/brohlfs/git/tichu/gameoptions.inc.php#L46-L64): Option `101` (`"Teams"`) defines values `1` (`"1/3 vs 2/4"` at [L51](file:///Users/brohlfs/git/tichu/gameoptions.inc.php#L51)), `2` (`"1/2 vs 3/4"` at [L55](file:///Users/brohlfs/git/tichu/gameoptions.inc.php#L55)), `3` (`"1/4 vs 2/3"` at [L59](file:///Users/brohlfs/git/tichu/gameoptions.inc.php#L59)), `4` (`"At random"`, `"tmdisplay" => totranslate("Random")` at [L61](file:///Users/brohlfs/git/tichu/gameoptions.inc.php#L61)), and `"default" => 1`.
- [Constants.php](file:///Users/brohlfs/git/tichu/modules/Constants.php#L2-L5): Defines `TEAM_1_3 = 1`, `TEAM_1_2 = 2`, `TEAM_1_4 = 3`, `TEAM_RANDOM = 4`.
- [tichu.game.php](file:///Users/brohlfs/git/tichu/tichu.game.php#L59) & [L339](file:///Users/brohlfs/git/tichu/tichu.game.php#L339): Maps `"playerTeams" => 101` in `initGameStateLabels()`; `setupNewGame()` invokes `PlayerManager::setupPlayers($players)` once at table start.
- [PlayerManager.php](file:///Users/brohlfs/git/tichu/modules/managers/PlayerManager.php#L37-L69): When `playerTeams == TEAM_RANDOM`, runs `shuffle($playerIds)` ([L39](file:///Users/brohlfs/git/tichu/modules/managers/PlayerManager.php#L39)) and assigns alternating `($counter - 1) % 2` teams; otherwise seats using `player_table_order`.

### BGA Platform `tmdisplay` & Rematch Mechanics (`#95469` & `#35575`)

- [main.js](file:///Users/brohlfs/git/tichu/bga-platform/js/sveltec/dist/main.js#L33755-L33798) (`CT()`, invoked for open/setup lobby tables at [L83078](file:///Users/brohlfs/git/tichu/bga-platform/js/sveltec/dist/main.js#L83078)) & [L80932-L80971](file:///Users/brohlfs/git/tichu/bga-platform/js/sveltec/dist/main.js#L80932-L80971):
  - `if (null === o || o === s) return;` ([L33765](file:///Users/brohlfs/git/tichu/bga-platform/js/sveltec/dist/main.js#L33765)) and `u = o === e` ([L80945-L80948](file:///Users/brohlfs/git/tichu/bga-platform/js/sveltec/dist/main.js#L80945-L80948)) omit option badges matching the viewer's filter/default.
  - When shown, `c = e.tmdisplay ? a : \`${t.name}: ${a}\``([L33781-L33784](file:///Users/brohlfs/git/tichu/bga-platform/js/sveltec/dist/main.js#L33781-L33784), [L80952-L80954](file:///Users/brohlfs/git/tichu/bga-platform/js/sveltec/dist/main.js#L80952-L80954)) strips`"Teams: "`whenever`tmdisplay` is non-empty.
- [ly_metasite.js](file:///Users/brohlfs/git/tichu/bga-platform/js/modules/layer/ly_metasite.js#L52714-L52719), [ly_studio.js](file:///Users/brohlfs/git/tichu/bga-platform/js/modules/layer/ly_studio.js#L23265-L23275), & [Table.php](file:///Users/brohlfs/git/tichu/local/Bga/GameFramework/Table.php#L605): `"Propose a rematch"` hits `createnew.html` with `{ game, rematch }`, copying table options (`101 = 4`) and setting `$bIsRematchSwappingPlayerOrder` ([L709](file:///Users/brohlfs/git/tichu/local/Bga/GameFramework/Table.php#L709)) to rotate first player, never passing prior random team pairings (`#35575` & `#43105` closed `rejected`; `#95699` banning custom teams also `rejected`).

### Test-Determinism Audit (Every `playerTeams === 1` Assumption)

| Surface                                        | Exact Lines / Symbols                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Current Behavior & Impact When Default = `4`                                                                                                                                                                                             |
| :--------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Table::createNewGame` + `TableOptionsManager` | [Table.php#L768-L772](file:///Users/brohlfs/git/tichu/local/Bga/GameFramework/Table.php#L768-L772), [L5241](file:///Users/brohlfs/git/tichu/local/Bga/GameFramework/Table.php#L5241); [bga-backend.php#L183-L195](file:///Users/brohlfs/git/tichu/local/bga-backend.php#L183-L195)                                                                                                                                                                                                                                                                                                                                                                                                                          | `TableOptionsManager::getGameOptions()` reads `gameoptions.inc.php`, but local `createNewGame()` hardcodes `?? 1` instead of reading `[101]['default']`.                                                                                 |
| Deterministic Scenarios (**BREAKS if synced**) | [scenarios.php#L10-L13](file:///Users/brohlfs/git/tichu/local/scenarios.php#L10-L13), [L197](file:///Users/brohlfs/git/tichu/local/scenarios.php#L197), [L231](file:///Users/brohlfs/git/tichu/local/scenarios.php#L231), [L288](file:///Users/brohlfs/git/tichu/local/scenarios.php#L288)                                                                                                                                                                                                                                                                                                                                                                                                                  | Assumes `P0/P2` Team 0, `P1/P3` Team 1, sequential turns, while `bootToPlayComboOpen()`, `setupGrandTichu()`, `setupGiveCards()` call `createNewGame()` with zero args.                                                                  |
| Integration Tests                              | [integration-tests.php#L104-L160](file:///Users/brohlfs/git/tichu/local/integration-tests.php#L104-L160), [L1122..L2638](file:///Users/brohlfs/git/tichu/local/integration-tests.php#L2398)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | All 16 direct `createNewGame` calls (`104,140,156,1122,1208,1492,1655,1745,2085,2134,2166,2284,2326,2363,2398,2431,2588,2638`) pass `playerTeams`, but scenario tests rely on `scenarios.php`. Needs empty-arg `createNewGame([])` test. |
| Race Stress Tests                              | [race-tests.php#L386](file:///Users/brohlfs/git/tichu/local/race-tests.php#L386), [L552](file:///Users/brohlfs/git/tichu/local/race-tests.php#L552), [L592..L683](file:///Users/brohlfs/git/tichu/local/race-tests.php#L592)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `L386, L552, L620` omit `playerTeams` (safe: `checkInvariants` inspects `player_team` dynamically); `L592, L658, L683` use `setupScenario()`.                                                                                            |
| Local HTTP/JS Runner                           | [router.php#L100](file:///Users/brohlfs/git/tichu/local/router.php#L100), [L420](file:///Users/brohlfs/git/tichu/local/router.php#L420), [L434](file:///Users/brohlfs/git/tichu/local/router.php#L434), [L574](file:///Users/brohlfs/git/tichu/local/router.php#L574); [bga-shim.js#L56](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L56), [L1766](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L1766), [L1951](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L1951), [L2962](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L2962), [L3674](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L3674), [L4415](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L4415) | Fallbacks hardcode `1`; `tt.runGame` ([L4415](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L4415)) explicitly passes `playerTeams: 1`.                                                                                           |
| Studio Runner                                  | [studio-test.ts#L2367-L2403](file:///Users/brohlfs/git/tichu/src/studio-test.ts#L2367-L2403), [L962](file:///Users/brohlfs/git/tichu/src/studio-test.ts#L962), [L4027](file:///Users/brohlfs/git/tichu/src/studio-test.ts#L4027)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `expressStartNew` only sets `id=100`, so Studio tables will default to `101=4`; `getSortedPlayers()`, `getRefreshBarSnapshot()`, `actMyTurn()` already read dynamic seats/teams.                                                         |

---

## 3. Architectural Decisions & Trade-offs

1. **Sync Local Runner Default to `gameoptions.inc.php` & Pin Scenarios**:
   - **Recommended**: Change `local/Bga/GameFramework/Table.php:5241` to default via `(int) ($this->getGameOptions()[101]['default'] ?? 4)` (note this lies inside `//// Local Runner Integration Helpers`), update `local/router.php` & `local/js/bga-shim.js` fallbacks from `1` to `4` (keeping `tt.runGame` at `playerTeams: 1`), and explicitly pass `['playerTeams' => TEAM_1_3]` in `local/scenarios.php:197,231,288`.
   - _Alternative rejected_: Leaving local runner fallbacks hardcoded to `1` — hides `At random` bugs locally and drifts from production.
2. **Self-Descriptive `tmdisplay` Labels (`"Teams: ..."`)**:
   - **Recommended**: Update `gameoptions.inc.php:51,55,59,61` `tmdisplay` strings to `"Teams: 1/3 vs 2/4"`, `"Teams: 1/2 vs 3/4"`, `"Teams: 1/4 vs 2/3"`, and `"Teams: Random"`. Since `main.js:33782` & `80953` omit option labels when `tmdisplay` exists, bare `"1/3 vs 2/4"` looks ambiguous next to `"Classic"`, whereas `"Teams: 1/3 vs 2/4"` reads clearly in lobby cards and `Custom options` lists.
   - _Trade-off / Alternative_: Keeping `"1/3 vs 2/4"` reuses old community translations while `"Teams: ..."` introduces 4 new English fallback strings until translated via BGA Translation Tool.
3. **Rematch Behavior (`#35575`) & RNG Scope**:
   - **Recommended**: Make zero runtime changes to `PlayerManager::setupPlayers()` and add no cross-table rematch state. BGA rematches preserve chosen fixed-team rules (`1/3 vs 2/4`, now badged in lobby!) with rotated first player, whereas `"At random"` intentionally re-rolls teams cleanly via `shuffle($playerIds)` (already verified on `#43105`). Replacing `shuffle()` with `bga_rand` Fisher-Yates stays an optional later cleanup outside this config-only release.

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

- **Direction 1 (`OLD DB -> NEW PHP + NEW JS`)**: 100% compatible. Running tables already materialized `global[101]` and `player.player_team` / `player.player_no` at setup; only newly opened tables receive default `101 = 4`.
- **Direction 2 (`OLD open JS tab <-> NEW PHP`)**: 100% compatible. Open tables never query `gameoptions.inc.php` defaults dynamically (`getAllDatas` serves `players` team/seat fields directly).
- **Direction 3 (`NEW open JS tab <-> OLD PHP` rollback)**: 100% compatible. Zero production `tichu.js` changes are required (`expressStartNew` is Studio/dev-only).
- **Direction 4 (`NEW DB / actionlog -> OLD PHP + OLD JS` rollback)**: 100% compatible. No new states, DB columns, globals, or `actionlog` events; clicking `Reload game options configuration` after reverting `gameoptions.inc.php` restores `"default" => 1` immediately.
- **Locking & Engine Invariants**:
  - **Concurrency Locks (`acquireGameLockOrFail` / `syncStaleReturnState` / `GLOBAL_LOCK_VERSION = 30`)**: Unaffected — `playerTeams` is read strictly inside `setupNewGame()` before concurrent actions exist.
  - **`@thoun` `player_pass` Autopass & `<tichu-replay>`**: Unaffected (`player_team`/`player_no` remain static throughout each hand/replay).
  - **`local/import-bug-sql.php` (7-surface remapper)**: `ensureBaselineGlobals()` ([L714,L733-L735](file:///Users/brohlfs/git/tichu/local/import-bug-sql.php#L733-L735)) defaults missing `101 => 1`; bump fallback to `4` for parity (old dumps already have `player_team` persisted on Surface 1 `player`).
  - **`ABSOLUTE NO-GO` & `workspace.blocked-files`**: `gameoptions.inc.php` uses literal `totranslate()` arguments enforced by [local/check-contracts.php](file:///Users/brohlfs/git/tichu/local/check-contracts.php#L405-L431); zero `bga_*` references, forbidden PHP APIs, `dbmodel.sql` `--` comments, or edits to upstream `local/Bga/GameFramework/Table.php` above `//// Local Runner Integration Helpers`.

---

## 5. Step-by-Step Implementation Blueprint

1. **Edit `gameoptions.inc.php` ([L46-L64](file:///Users/brohlfs/git/tichu/gameoptions.inc.php#L46-L64))**:
   - Set `"default" => 4` on option `101`.
   - Update `"tmdisplay"` values:
     - `1` (`L51`): `totranslate("Teams: 1/3 vs 2/4")`
     - `2` (`L55`): `totranslate("Teams: 1/2 vs 3/4")`
     - `3` (`L59`): `totranslate("Teams: 1/4 vs 2/3")`
     - `4` (`L61`): `totranslate("Teams: Random")`
2. **Pin Deterministic Scenarios (`local/scenarios.php`)**:
   - Replace `$game->createNewGame();` in `bootToPlayComboOpen()` (`L197`), `setupGrandTichu()` (`L231`), and `setupGiveCards()` (`L288`) with `$game->createNewGame(['playerTeams' => TEAM_1_3]);`.
3. **Sync Local BGA Runner Defaults (`4`)**:
   - [Table.php#L5241](file:///Users/brohlfs/git/tichu/local/Bga/GameFramework/Table.php#L5241): Replace `?? 1` with `?? (int) ($this->getGameOptions()[101]['default'] ?? 4)`.
   - [router.php#L420,L434,L574](file:///Users/brohlfs/git/tichu/local/router.php#L420): Update fallback `1` to `4` (leaving `L100` to pick up `Table::createNewGame()`'s `4`).
   - [bga-shim.js#L56,L1766,L1951,L2962,L3674](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L56): Update default `playerTeams` from `1` to `4`; keep `tt.runGame` (`L4415`) passing `playerTeams: 1`.
   - [import-bug-sql.php#L733-L735](file:///Users/brohlfs/git/tichu/local/import-bug-sql.php#L733-L735): Update `101 => 1` baseline fallback to `4`.
4. **Optional Studio Fixed-Team Override (`src/studio-test.ts#L2367-L2390`)**:
   - Extend `expressStartNew({ gameLength = 2, playerTeams }: { gameLength?: number; playerTeams?: number } = {})`: if `playerTeams !== undefined`, send `/table/table/changeoption.html?table=${newTableId}&id=101&value=${Number(playerTeams)}`; otherwise omit so Studio uses its reloaded `101 = 4` default.
5. **Add Regression Assertions (`local/integration-tests.php` Test 1 after [L160](file:///Users/brohlfs/git/tichu/local/integration-tests.php#L160))**:
   - Assert `$game->getGameOptions()[101]['default'] === TEAM_RANDOM` and exact `"Teams: ..."` `tmdisplay` strings.
   - Call `$game->createNewGame([])` with omitted options, verify `playerTeams == TEAM_RANDOM`, and verify `SELECT player_id, player_no, player_team FROM player ORDER BY player_no` produces alternating `0,1,0,1`.
6. **Upload & Reload Studio Options Cache**:
   - Sync via `npm run deploy:sftp -- gameoptions.inc.php tichu.js` (if `studio-test.ts` changed).
   - On `https://studio.boardgamearena.com/studiogame?game=tichu`, click **`Reload game options configuration`** (`a.bga-button`) so BGA Studio picks up `default => 4` and updated `tmdisplay` badges (never build/deploy production without explicit user approval).

---

## 6. Verification Checklist & Regression Tests

- [ ] `composer test` — PHPUnit unit suite (`ComboTest.php`, `HandTest.php`) passes.
- [ ] `npm run test:validator` — TypeScript validator & Studio client runtime tests pass.
- [ ] `php local/integration-tests.php` — all 18 MySQL 8.0 suites pass (verifying both pinned `TEAM_1_3` scenarios and new omitted-option `createNewGame([])` `TEAM_RANDOM` checks).
- [ ] `npm run phpstan` & `npm run test:contracts` — static analysis and `totranslate()` literal-string validation pass cleanly.
- [ ] `npm run test:race` — multi-worker stress tests (`race-tests.php` `L386, L552, L620` under `TEAM_RANDOM = 4` + pinned `L592, L658, L683`) show zero invariant failures or MySQL deadlocks.
- [ ] `npm run build` — compiles `tichu.js` cleanly if `src/studio-test.ts` was touched.
- [ ] **Local & Studio Lobby Verification**: Start `npm run local` (`http://127.0.0.1:8080`) and confirm fresh games default to `playerTeams = 4` while scenarios stay fixed `P0+P2` vs `P1+P3`; on Studio after clicking `Reload game options configuration`, confirm `tt.expressStartNew()` starts with random teams and opening a non-default `1/3 vs 2/4` table shows `Teams: 1/3 vs 2/4` in the open-tables lobby.

---

## 7. BGA Ticket Closure & Kickoff Prompt

> [!CAUTION]
> **NEVER** post replies or change ticket statuses on `boardgamearena.com`, and **NEVER** build or deploy a production release on `studiogame?game=tichu`, without **explicit user approval** first. Avoid backticks in BGA ticket replies.

- **#95467** (`acknowledged` -> `implemented`, after production deploy):
  > Teams: At random is now the default table option when opening a new Tichu table. Players who want arranged seats (1/3 vs 2/4, 1/2 vs 3/4, or 1/4 vs 2/3) can still choose them explicitly in the table options.
- **#95469** (`inforequest` -> `implemented` after production deploy & lobby verification):
  > Thank you for reporting this! Previously, BGA automatically hid a game option's lobby badge whenever a table matched the game's default value (1/3 vs 2/4), and short labels replaced the "Teams:" prefix. Now that Teams: At random is the default and all team choices carry "Teams: ..." badges, tables with fixed seating (1/3 vs 2/4, 1/2 vs 3/4, or 1/4 vs 2/3) clearly display their team assignment directly in the lobby list.
- **#35575** (already closed `rejected` on `2026-11-18`; do not reopen): Documented that BGA's rematch flow clones table options (`At random`) and swaps starting seat order without copying prior random teams; picking `Teams: 1/3 vs 2/4` preserves partners across rematches and now shows a clear lobby badge.

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/.agents/skills/bga-release-and-qa/SKILL.md, /Users/brohlfs/git/tichu/.agents/skills/bga-studio-testing/SKILL.md, and /Users/brohlfs/git/tichu/plans/16-lobby-team-options-and-tmdisplay.md.
Implement Plan 16 step-by-step: flip gameoptions.inc.php option 101 default to 4 and update tmdisplay strings to "Teams: ...", pin local/scenarios.php (L197, L231, L288) to TEAM_1_3, align Table.php/router.php/bga-shim.js/import-bug-sql.php fallbacks to 4, add optional playerTeams to expressStartNew in src/studio-test.ts, and add Test 1 default-option regressions in local/integration-tests.php.
Run `npm run build`, `npm run phpstan`, `npm run test:contracts`, and `npm run test:race`, deploy via `npm run deploy:sftp`, click "Reload game options configuration" on studiogame?game=tichu, and verify both Studio lobby badges and random-team expressStartNew. Stop before building a production release or posting on BGA bugs without explicit user approval.
```
