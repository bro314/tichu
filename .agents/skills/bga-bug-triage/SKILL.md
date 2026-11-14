---
name: bga-bug-triage
description: >-
  Triage, reproduce, and fix production bug reports for Tichu on Board Game Arena
  (boardgamearena.com/bugs?game=1237 and bug?id=<BUG_ID>), inspect Studio SQL/request logs,
  remap player IDs across Tichu's 7 database surfaces, and write PHPUnit or MySQL 8.0 integration
  regression tests. Use whenever the user mentions a BGA bug ID, production bug report, or SQL bug dump.
---

# BGA Bug Triage & Reproduction Playbook

## 1. BGA Bug Tracker & Studio Log URLs

- **Tichu Bug List (Game ID `1237`)**: `https://boardgamearena.com/bugs?game=1237`
- **Specific Bug Report**: `https://boardgamearena.com/bug?id=<BUG_ID>`
- **Studio Server SQL & Request Logs**: `https://studio.boardgamearena.com/1/tichu/tichu/logaccess.html?table=<TABLE_ID>`

Whenever the user references a reported bug (by ID, title, or topic) or asks to inspect, reply to, or update the status of a bug, look it up at `https://boardgamearena.com/bugs?game=1237` (or `https://boardgamearena.com/bug?id=<BUG_ID>`).

---

## 2. End-to-End Bug Triage & Reproduction Workflow

1. **Gather Context from the Report**:
   - Record the bug ID, table ID, move number, active state (`states.inc.php`), player perspectives, and relevant `gamelog` notifications or browser console errors.
2. **Choose the Fastest Reproduction Tier**:
   - **Pure card/combo/hand/wish bug**: Write a failing test in [`tests/ComboTest.php`](file:///Users/brohlfs/git/tichu/tests/ComboTest.php) or [`tests/HandTest.php`](file:///Users/brohlfs/git/tichu/tests/HandTest.php) and run `npm run test:unit`.
   - **State machine / scoring / autopass / locking bug**: Add a scenario or regression test in [`local/scenarios.php`](file:///Users/brohlfs/git/tichu/local/scenarios.php) / [`local/integration-tests.php`](file:///Users/brohlfs/git/tichu/local/integration-tests.php) (run `npm test`) or [`local/race-tests.php`](file:///Users/brohlfs/git/tichu/local/race-tests.php) (run `npm run test:race`).
   - **Full production SQL dump (`bug_<id>.sql`)**: Import locally into MySQL 8.0 (`ebd_tichu_1`) and inspect its state/cards/logs with:
     ```bash
     npm run bug:import -- path/to/bug_<id>.sql [--state=75] [--inspect]
     npm run bug:inspect
     ```
     Then start `npm run local` and inspect `http://127.0.0.1:8080`. On BGA Studio, [`DebugTrait`](file:///Users/brohlfs/git/tichu/modules/DebugTrait.php) exposes `loadBugReportSQL(int $reportId, array $studioPlayers)` plus `#[Debug(reload: true)]` helpers (`debug_reopenFinishedGame`, `debug_goToEndOfRound`, `debug_dealBombToCurrentPlayer`).
   - **Live browser & production log inspection**:
     - Client console: BGA attaches the tail of the browser JS console to bug reports. [`src/tichu.ts`](file:///Users/brohlfs/git/tichu/src/tichu.ts) logs `[tichu]` state/action/notif breadcrumbs (last 50 in `window.__tichuBreadcrumbs`), warns on hand-count mismatches or deploy version mismatches (`checkVersion`), and exposes `window.tichuDebugSnapshot()` for one-command inspection of state, hand, trick, prefs, and breadcrumbs.
     - Server production logs: [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php) emits structured `$this->logProdWarn(...)` (`game_err_tichu.log`) on lock/stale-state rejections, card-count mismatches, missing logs, and zombie fallbacks, and records `grandTichuBet`, `giveCards`, `acceptCards`, `mahjongWish`, `chooseDragonGift`, and `zombieTurn` in `actionlog` alongside tricks/combos/bets.
3. **Remapping Production SQL Dumps Safely (7 `player_id` Surfaces)**:
   - Production dumps use live BGA `player_id`s and often end in state `99` (`ST_GAME_END`).
   - **Never** do a naive 1-pass `player_id` replacement (breaks if old/target IDs overlap or seats swap). [`DebugTrait::loadBugReportSQL()`](file:///Users/brohlfs/git/tichu/modules/DebugTrait.php) performs **two-phase offset remapping** (`oldId -> maxId + 1000 + idx -> targetId`, e.g., local/Studio `dashwood0`..`dashwood3` = `2385074`..`2385077`) across **all 7 Tichu `player_id` surfaces**:
     1. `player.player_id` (ordered by `player_no ASC, player_id ASC`) + `playermultiactive`, `replaysavepoint`, `bga_user_preferences`
     2. `global.global_value` (`global_id IN (2, 5, 21, 22, 27, 302, 304)` — active/admin player, `firstOutPlayer`, `secondOutPlayer`, `mahjongOwner`, neutralized/undo player)
     3. `card.card_location_arg` (when `card_location` IN `'hand'`, `'temporary'`, `'captured'`) **and** `card.card_passed_from`
     4. `actionlog.log_player` **and** embedded JSON keys inside `actionlog.log_arg` (`changePlayer.active`, `confirm.nextPlayer`)
     5. `gamelog.gamelog_player`, `gamelog.gamelog_current_player`, and `gamelog.gamelog_notification` JSON (`player_id`, `player_id2`, `player_id3`, `firstout_id`, `active_player`, `passed_from`, `newScores`, `_private`, `multiactive`, `_notified_privately`, `reflexion`, etc. — decoded via JSON rather than blind `str_replace`)
     6. `stats.stats_player_id`
     7. `player.player_is_multiactive`
   - If `global_id = 1` is `99` (`ST_GAME_END`), it is automatically reset to `75` (`ST_CONFIRM_TRICK`) (or pass `--state=<id>` to override, e.g. `--state=60` for `ST_PLAY_COMBO`) so the BGA client UI renders the table instead of the end-of-game podium.
4. **Verify Before Closing**:
   - Confirm the regression test fails before the fix and passes after.
   - Run `npm run build` (`npm test` + TypeScript compile + `esbuild` bundle), `npm run test:contracts`, and `npm run phpstan` (+ `npm run test:race` if actions, state transitions, or locks changed).
   - If verifying on BGA Studio, follow [bga-studio-testing](../bga-studio-testing/SKILL.md).
