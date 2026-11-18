# 08 — Local Bomb Staging, Persistent Bomb Button, Pre-Select & Turn-Based Delayed Bombs

- **Priority**: P1
- **Recommended Roadmap Day**: Day 4
- **Scope**: `dbmodel.sql`, `states.inc.php`, `tichu.action.php`, `tichu.game.php`, `modules/managers/LogManager.php`, `modules/managers/NotificationManager.php`, `src/types/tichu-contracts.ts`, `src/elements/game-model.ts`, `src/elements/tichu-action-bar.ts`, `src/elements/tichu-replay.ts`, `src/tichu.ts`, `src/studio-test.ts`, `tests/combo-validator.test.ts`, `local/integration-tests.php`, `local/race-tests.php` (supersedes legacy `09-bomb-staging-and-preselect-ux.md`)
- **Open BGA Tickets / Prod Issues Covered**: [#106651](https://boardgamearena.com/bug?id=106651) (8 votes, `acknowledged` — keep `[Play Bomb]` available on own turn for self-bombing & stop layout jumps), [#217733](https://boardgamearena.com/bug?id=217733) (4 votes, `acknowledged` — delayed bomb in turn-based Tichu without collect-prompt info leak)
- **Estimated Effort**: Medium-Large (client staging/pre-select state machine + atomic `playBomb`, `armDelayedBomb`/`cancelDelayedBomb`, `stNextPlayer()` loop, & race suite)
- **Dependencies & Shared ID Reservations**: Uses `combo-validator.ts` & `utils.ts::hasBomb()`; coordinates with Plan 09 ([Plan 09](file:///Users/brohlfs/git/tichu/plans/09-turn-based-confirm-trick-smart-autoskip.md)) inside `stNextPlayer()`; uses `actionlog` actions `armDelayedBomb` / `cancelDelayedBomb` (no `player_id` inside `log_arg`; `log_action` column widened from `varchar(16)` to `varchar(32)`). No new `game_preferences`, `stats`, or `global` IDs.

---

## 1. Why & Goal

Four UX, info-leak, and async-timing defects weaken bomb and out-of-turn play in Tichu:

1. **Disappearing Bomb Button & Self-Bomb Friction ([#106651](https://boardgamearena.com/bug?id=106651))**: `tichu-action-bar.ts` hides `#myPlayBomb` whenever `isCurrentPlayerActive` is true in `playComboOpen`/`playCombo`, shifting action bar buttons as turns change and forcing players who lead a card and immediately self-bomb to re-locate the button under time pressure.
2. **Bluff/Cancel Leak (`ST_PLAY_BOMB`)**: Clicking `#myPlayBomb` currently invokes `playBomb` immediately, broadcasting `"<player> wants to play a bomb."` to the table before any card is chosen; clicking Cancel leaks bomb possession or bluffing and adds unnecessary state contention.
3. **Turn-Based Bomb Timing Dilemma ([#217733](https://boardgamearena.com/bug?id=217733))**: Async players often want to give their partner a chance to play before bombing, without missing the window when everyone passes and the winner auto-/manually collects — and without adding an interactive bomb prompt at `ST_CONFIRM_TRICK` that leaks bomb ownership if declined.
4. **Slow Follow-Ups & Opaque Autopass**: Out-of-turn players holding an obvious beating combo lack a snapshot-guarded `"Pre-select"` queue (`The Crew` / `Coinche` pattern), and armed `AUTOPASS_ONCE` vs `AUTOPASS_TRICK` lacks a clear status pill.

Goal: Stage bombs locally with 1-request atomic submission, keep `#myPlayBomb` stable across turns, arm private turn-based delayed bombs in `actionlog`, add snapshot-guarded out-of-turn pre-selection, and surface a crisp armed-status pill.

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| File & Verified Lines                                                                                                                                                                         | Current Symbol / Behavior                                                                                                    | Gap / Constraint                                                                                                                                              |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`tichu-action-bar.ts:73-93,214-219,236-248`](file:///Users/brohlfs/git/tichu/src/elements/tichu-action-bar.ts#L214-L219)                                                                     | `showBomb` hides `#myPlayBomb` on active turn except `confirmTrick`; `#bomb_button` (`min-width: 100px`) empties             | Causes button jump & self-bomb miss (`#106651`); no staging UI, no pre-select, no autopass pill                                                               |
| [`tichu-action-bar.ts:523-540`](file:///Users/brohlfs/git/tichu/src/elements/tichu-action-bar.ts#L523-L540), [`tichu.ts:1321-1357`](file:///Users/brohlfs/git/tichu/src/tichu.ts#L1321-L1357) | `onPlayBomb` -> `playCombo("playBomb")` sends `{ cards: cardIds }` immediately                                               | Sends network request before confirmation; **old tabs with selected cards send non-empty `cards`!**                                                           |
| [`tichu.action.php:95-104`](file:///Users/brohlfs/git/tichu/tichu.action.php#L95-L104)                                                                                                        | `playBomb()` reads `getArg("cards", AT_numberlist, true)`                                                                    | Requires `cards`; lacks optional `atomic` flag and `armDelayedBomb` / `cancelDelayedBomb` endpoints                                                           |
| [`tichu.game.php:652-688`](file:///Users/brohlfs/git/tichu/tichu.game.php#L652-L688)                                                                                                          | `playBomb($cards_ids)` ignores `$cards_ids`, inserts `changePlayer` -> `ST_PLAY_BOMB`                                        | Always enters two-step `ST_PLAY_BOMB` (`61`)                                                                                                                  |
| [`tichu.game.php:485-547`](file:///Users/brohlfs/git/tichu/tichu.game.php#L485-L547)                                                                                                          | `completePlayCombo($playerId, $combo)` resets autopass only on `NO_COMBO`, always calls `nextState`                          | Cannot run directly inside `stNextPlayer()` because `ST_NEXT_PLAYER["nextPlayer"] => ST_PLAY_COMBO` (`states.inc.php:204`), skipping go-out/round-end checks! |
| [`states.inc.php:213-229`](file:///Users/brohlfs/git/tichu/states.inc.php#L213-L229)                                                                                                          | `ST_CONFIRM_TRICK` (`75`) `transitions` omit `"nextPlayer" => ST_NEXT_PLAYER`                                                | Atomic `playBomb` from `confirmTrick` calling `completePlayCombo` would fail without `"nextPlayer"` transition                                                |
| [`tichu.game.php:1375-1530`](file:///Users/brohlfs/git/tichu/tichu.game.php#L1375-L1530)                                                                                                      | `stNextPlayer()` evaluates `isAllInfoExposed` (`L1454-1468`) & `player_pass` (`L1478`), enters `ST_CONFIRM_TRICK` at `L1511` | Needs delayed-bomb evaluation at `$lastComboPlayer == $next` before `ST_CONFIRM_TRICK` / Plan 09 auto-skip                                                    |
| [`dbmodel.sql:46-54`](file:///Users/brohlfs/git/tichu/dbmodel.sql#L46-L54), [`tichu.game.php:1965-1973`](file:///Users/brohlfs/git/tichu/tichu.game.php#L1965-L1973)                          | `actionlog.log_action` is `varchar(16) NOT NULL`                                                                             | `"cancelDelayedBomb"` is **17 chars** — MySQL 8.0 strict mode fails unless widened to `varchar(32)`!                                                          |
| [`tichu.ts:939-941,1625`](file:///Users/brohlfs/git/tichu/src/tichu.ts#L939-L941), [`tichu-replay.ts:510-529`](file:///Users/brohlfs/git/tichu/src/elements/tichu-replay.ts#L510-L529)        | `onEnteringStatePlayCombo` is empty; `preparePlayCombo` checks `stateName === "playBomb"`                                    | Needs guarded `preselect` submit, bomb animation for `rawType === 7`, & `isIgnored("delayedBomb")`                                                            |

---

## 3. Architectural Decisions & Trade-offs

1. **Atomic Bomb Flag (`atomic: true`) vs. Bare `cards` Inference**:
   - **Recommended — Optional `atomic` arg on `playBomb` (`{ cards?: string; atomic?: boolean }`)**: Currently `tichu.ts:1346` sends `{ cards: selectedIds }` on `playBomb` even when an unrefreshed player clicked `"Play a Bomb"` with 1–2 non-bomb cards highlighted! Requiring `atomic: true` lets `NEW JS` execute atomic 1-request bombs while `OLD JS` tabs (where `atomic` is absent/false) still enter legacy `ST_PLAY_BOMB` cleanly instead of receiving `"This is not a valid bomb"`.
   - _Alternative rejected_: Triggering atomic mode on `!empty($cards_ids)` alone breaks old open JS tabs that have non-bomb cards selected when clicking Bomb.
2. **Delayed Bomb Storage & Trigger Placement (`#217733`)**:
   - **Recommended — Private `actionlog` rows (`armDelayedBomb` / `cancelDelayedBomb`) + `stNextPlayer()` loop via `executePlayCombo()`**: Zero extra DB table or `player` column needed; scoped to `(log_round, log_trick)` and ordered by `log_id ASC`. Extracting `executePlayCombo()` without `nextState()` lets `stNextPlayer()` execute the first valid armed bomb when `$lastComboPlayer == $next` (before `ST_CONFIRM_TRICK` and Plan 09 auto-skip) and tail-call `$this->stNextPlayer()`, preserving `playerGoOut`, `doubleVictory`, `player_pass` resets, and chained counter-bombs!
   - _Alternative rejected_: Creating a new `ST_DELAYED_BOMB` prompt state leaks bomb ownership whenever a player declines (`#217733`).
3. **Out-of-Turn Pre-Select Execution (`The Crew` / `Coinche` pattern)**:
   - **Recommended — Client-only `preselect$` with exact snapshot guard**: Stores `{ cardIds, description, round, trick, lastComboSignature, wish }`, forbids ambiguous Phoenix (`requiresPhoenixChoice`), cancels `autopass` on server first before arming, and auto-disarms with a visible notice on any table/hand/wish change.
   - _Alternative rejected_: Server-side pre-play queue adds multi-step state complexity for marginal gain over instant client dispatch on `onEnteringStatePlayCombo`.
4. **Delayed Bomb Cancellation Lock Policy**:
   - **Recommended**: `armDelayedBomb` uses `acquireGameLockOrFail()` (rejects if table moved/combo changed); `cancelDelayedBomb` uses `acquireGameLock()` + fresh state/log validation + `bumpGameVersion()` + `syncStaleReturnState()`, allowing cancel even if opponents passed while still throwing cleanly if the bomb already triggered or trick ended.

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

1. **`OLD DB -> NEW PHP + NEW JS`**: Running games have `actionlog.log_action` as `varchar(16)` and no `armDelayedBomb` rows. `upgradeTableDb($from_version)` idempotently checks `SHOW COLUMNS FROM actionlog LIKE 'log_action'` and widens `DBPREFIX_actionlog.log_action` to `varchar(32) NOT NULL` inside `try/catch` (BGA Bug #64 `zz_replay*` safe). `getAllDatas()` returns `armedDelayedBomb: []` when none exist.
2. **`OLD open JS tab <-> NEW PHP`**: `tichu.action.php::playBomb()` uses `getArg("cards", AT_numberlist, false, "")` and `getArg("atomic", AT_bool, false, false)`. Old tabs omit `atomic`, hitting legacy `ST_PLAY_BOMB` (`states.inc.php:156`) seamlessly; existing `playCombo` notifications only receive additive behavior.
3. **`NEW open JS tab <-> OLD PHP` (Rollback)**: `NEW PHP::getAllDatas()` always emits `armedDelayedBomb: string[]`; `NEW JS` gates `"Arm Delayed Bomb"` behind `Array.isArray(gamedatas.armedDelayedBomb)` (and handles `undefined` safely in `GameModel`). If an open `NEW JS` tab sends `playBomb({ cards, atomic: true })` to `OLD PHP`, `OLD PHP` ignores `atomic` and `$cards` and enters `ST_PLAY_BOMB`, where `NEW JS` still renders the fallback `"Play Bomb"` / `"Cancel"` buttons!
4. **`NEW DB / actionlog -> OLD PHP + OLD JS` (Rollback)**: Widening `varchar(16)` -> `varchar(32)` is lossless and invisible to `OLD PHP`. `armDelayedBomb` / `cancelDelayedBomb` reuse the active `(log_round, log_trick)` (never bumping `MAX(log_round)`/`MAX(log_trick)`) and `LogManager::getLastActions(['combo', 'pass'])` filters by action name, so `OLD PHP` ignores them completely.

- **Concurrency & Lock Invariants**: `playBomb`, `armDelayedBomb`, and `cancelDelayedBomb` call `acquireGameLock*()` as their first DB statement (`GLOBAL_LOCK_VERSION = 30`, `bSelectGlobalsForUpdate = true`). All non-transitioning paths (`armDelayedBomb`, `cancelDelayedBomb`) call `syncStaleReturnState()`.
- **`@thoun` `player_pass` Invariant**: `executePlayCombo()` resets `player_pass` to `AUTOPASS_NONE` (`0`) via `PlayerManager::setAutopass(AUTOPASS_NONE)` + `NotificationManager::autopass(AUTOPASS_NONE)` both on `NO_COMBO` leads and on every `BOMB_COMBO` (atomic or delayed) so stale autopasses never auto-skip after a bomb interrupt.
- **Replay / Bug SQL / Sandbox Compliance**: `<tichu-replay>` (`isIgnored()`) skips private `delayedBomb` notifications. `local/import-bug-sql.php` Surface 4 already remaps `actionlog.log_player` (`armDelayedBomb` / `cancelDelayedBomb` `log_arg` contains card IDs only, no `player_id`s). Zero `$bgaContainer`, `bga_*`, `Reflection*`, or FS/process calls exist in deployable files (`npm run test:contracts` passes).

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Schema, Transitions & Contracts (`dbmodel.sql`, `states.inc.php`, `tichu-contracts.ts`)

1. Update `dbmodel.sql:51` and `tichu.game.php:1970` `log_action` from `varchar(16)` to `varchar(32) NOT NULL`. In `Tichu::upgradeTableDb($from_version)` (`tichu.game.php:1950`), inspect `SHOW COLUMNS FROM actionlog LIKE 'log_action'` and run `applyDbUpgradeToAllDB("ALTER TABLE DBPREFIX_actionlog MODIFY COLUMN \`log_action\` varchar(32) NOT NULL")`wrapped in`try/catch`.
2. In `states.inc.php:223-228` (`ST_CONFIRM_TRICK`), add `"nextPlayer" => ST_NEXT_PLAYER` to `transitions`.
3. In `src/types/tichu-contracts.ts`: update `TichuActionMap` (`playBomb: { cards?: string; atomic?: boolean }`, `armDelayedBomb: { cards: string }`, `cancelDelayedBomb: {}`), `TichuNotificationMap` (`delayedBomb: { cards: string[] }`), and `TichuGamedatas` (`armedDelayedBomb?: string[]`).

### Step 2: Atomic `playBomb`, Delayed Bomb Actions & `stNextPlayer()` Loop (`tichu.action.php`, `tichu.game.php`, `NotificationManager.php`)

1. In `tichu.action.php::playBomb()` (`L95-104`), read `$cards_raw = $this->getArg("cards", AT_numberlist, false, "");` and `$atomic = (bool) $this->getArg("atomic", AT_bool, false, false);` -> pass to `$this->game->playBomb($cards, $atomic)`. Add `armDelayedBomb()` (`cards` `AT_numberlist, true`) and `cancelDelayedBomb()`.
2. In `NotificationManager.php`, add `public static function delayedBomb(int $playerId, array $cardIds)` emitting private `notifyPlayer($playerId, "delayedBomb", "", ["cards" => array_values(array_map("strval", $cardIds))])`.
3. In `tichu.game.php`, split `completePlayCombo($playerId, $combo)` into:
   - `private function executePlayCombo(int $playerId, Combo $combo): void`: runs `canBeat`, Dog-lead, & `checkMahjongWishFulfillment` checks; inserts `LogManager::playCombo`; calls `PlayerManager::setAutopass(AUTOPASS_NONE)` + `NotificationManager::autopass(AUTOPASS_NONE)` whenever `$lastCombo->type == NO_COMBO || $combo->type == BOMB_COMBO`; grants wish / closes 14-card Tichu / emits `playCombo` / moves cards to `"combos"` / increments `bomb_number`; if `$playerId` had an active `armDelayedBomb` in current trick, inserts `cancelDelayedBomb` + emits `NotificationManager::delayedBomb($playerId, [])`.
   - `completePlayCombo` calls `executePlayCombo` then `$this->gamestate->nextState($combo->hasMahjong() ? "mahjongPlayed" : "nextPlayer")`.
4. Update `Tichu::playBomb($cards_ids = [], $atomic = false)` (`L652-688`): under `acquireGameLockOrFail()`, require state `"playCombo"` or `"confirmTrick"`, reject `NO_COMBO` / `DOG_COMBO` `$lastCombo`. If `!$atomic || empty($cards_ids)`, preserve legacy `ST_PLAY_BOMB` transition; otherwise validate card IDs in hand, verify `$combo->type === BOMB_COMBO`, and call `$this->completePlayCombo($playerId, $combo)`.
5. Implement `Tichu::armDelayedBomb(array $cardIds)`: under `acquireGameLockOrFail()`, require `$this->isAllInfoExposed()`, state `ST_PLAY_COMBO`, `$playerId !== (int) $this->getActivePlayerId()`, `$lastComboPlayer != $playerId`, `type != NO_COMBO && != DOG_COMBO`, valid `BOMB_COMBO` in hand that `canBeat($lastCombo)` and satisfies `checkMahjongWishFulfillment`. Insert `armDelayedBomb` (`["cards" => array_map("intval", $cardIds)]`), emit `NotificationManager::delayedBomb($playerId, $cardIds)`, call `syncStaleReturnState()`.
6. Implement `Tichu::cancelDelayedBomb()`: under `acquireGameLock()`, require `$this->freshStateId === ST_PLAY_COMBO` and active `armDelayedBomb` row for `$playerId` in current trick (`LogManager::getCurrentTrickCond()`), call `bumpGameVersion()`, insert `cancelDelayedBomb` (`["cards" => []]`), emit `NotificationManager::delayedBomb($playerId, [])`, call `syncStaleReturnState()`.
7. In `Tichu::getAllDatas(int $currentPlayerId)`: compute `armedDelayedBomb` for `$currentPlayerId` from current trick's latest `armDelayedBomb`/`cancelDelayedBomb` (verifying cards still in hand) and always return `"armedDelayedBomb" => $cardIds`.
8. In `Tichu::stNextPlayer()` (`L1511`), when `$lastComboPlayer == $next`: scan current trick's `armDelayedBomb`/`cancelDelayedBomb` rows (`ORDER BY log_id ASC`) to find the earliest active armer (`player_zombie == 0`, `$armerId != $lastComboPlayer`, all cards in hand, valid `BOMB_COMBO` beating `$lastCombo`, wish-valid — auto-cancelling stale/beaten entries via `cancelDelayedBomb` + `NotificationManager::delayedBomb($armerId, [])`). If found, execute `$this->executePlayCombo($armerId, $bombCombo)` and `return $this->stNextPlayer();` before entering `ST_CONFIRM_TRICK` or Plan 09 auto-skip.

### Step 3: Client Model, Persistent Bomb Staging, Pre-Select & Armed Pill (`game-model.ts`, `tichu-action-bar.ts`, `tichu.ts`, `tichu-replay.ts`)

1. In `GameModel` (`src/elements/game-model.ts`): add `bombStagingMode: boolean`, `delayedBombSupported: boolean`, `armedDelayedBombCards: string[]`, `preselect: PreselectState | null`, and `preselectNotice: string` (plus selectors and setters). Add helper `computeLastComboSignature(trickLastCombo)`. Automatically clear `bombStagingMode` and `preselect` (setting `preselectNotice = "Pre-play cancelled: table changed"` when `preselect` was non-null) inside `applyPlayCombo`, `setMahjongWish`, `enterNewTrick`, `enterNewRound`, `enterEndRound`, and `setHand` (when preselected IDs leave hand). Also clear `armedDelayedBombCards` in `enterNewTrick`, `enterNewRound`, `enterEndRound`.
2. In `TichuActionBar` (`src/elements/tichu-action-bar.ts`):
   - Keep `#myPlayBomb` rendered in `#bomb_button` across `playComboOpen`, `playCombo`, `confirmTrick`, `playBomb` whenever `!readOnly && this.hand.length >= 4 && hasBomb(this.hand)`. Disable `#myPlayBomb` with helpful tooltip when `trickLastCombo` is `NO_COMBO`/`DOG_COMBO` (`!canBombNow`), and enable on own or opponent turn whenever a combo is on table (`playCombo` / `confirmTrick`), triggering `gameModel.setBombStagingMode(true)` locally (zero network traffic!).
   - When `bombStagingMode` is true: `#play_button` renders `#myConfirmBomb` (`"Confirm Bomb (<name>)"`, disabled until `analyzeSelection` with bomb check passes); `#pass_button` renders `#myCancelStagedBomb` (`"Cancel"`, exiting staging locally); when `isAllInfoExposed && delayedBombSupported && !isCurrentPlayerActive && stateName === "playCombo" && trickLastCombo.playerId !== currentPlayerId`, `#pass_trick_button` renders `#myArmDelayedBomb` (`"Arm Delayed Bomb"`).
   - When `!bombStagingMode && !isCurrentPlayerActive && stateName === "playCombo"` and selected cards form a valid beating combo with `!validation.requiresPhoenixChoice`: `#play_button` renders `#myPreselectPlay` (`"Pre-select (<name>)"`). Clicking it cancels `autopass` first (`takeAction("cancelAutopass", {}, ...)` if `pass > 0`) before saving `preselect` snapshot; clicking `#myPassOnce`/`#myPassTrick` clears `preselect`.
   - Render `#armedStatusBar` below `#buttons` displaying crisp removable pills for `pass === 1` (`"Auto-Pass once armed"`), `pass === 2` (`"Auto-Pass this trick armed"`), `preselect` (`"Pre-play: <desc>"`), `armedDelayedBombCards` (`"Delayed Bomb armed"`), and `preselectNotice`.
3. In `src/tichu.ts`: subscribe `notif_delayedBomb`, update `notif_playCombo` (`L1625`) to pass `this.stateName === "playBomb" || rawType === 7` for bomb flight animations, and in `onEnteringStatePlayCombo` (`L939`), when `this.isCurrentPlayerActive() && !this.isReadOnly() && !this.pendingConfirmTichu`, auto-submit `preselect.cardIds` via `playCombo` iff `{ round, trick, lastComboSignature, wish }` matches identically. Add `delayedBomb` to `isIgnored()` in `src/elements/tichu-replay.ts:510-529`.

---

## 6. Verification Checklist & Regression Tests

- [ ] **TS Validator & Client Runtime (`tests/combo-validator.test.ts` via `npm run test:validator`)**: Test `analyzeSelection` bomb staging, `GameModel` preselect auto-disarm on `applyPlayCombo` / `setMahjongWish` / `enterNewTrick` / `setHand`, `applyPass` preserving preselect, and `hydrateFromGamedatas` rollback tolerance when `armedDelayedBomb` is omitted.
- [ ] **MySQL 8.0 Integration (`local/integration-tests.php` via `npm test`)**:
  1. `playBomb($cards, atomic: true)` from `playCombo` and `confirmTrick` (including self-bomb & Mahjong wish fulfillment), plus legacy `playBomb(['cards' => ''], atomic: false)` backwards-compatibility and `ST_PLAY_BOMB` fallback.
  2. Turn-based `armDelayedBomb` privacy (`getAllDatas` exposes ONLY to armer, never opponents/spectators), firing in `stNextPlayer()` before `ST_CONFIRM_TRICK`, `player_pass` reset on bomb trigger, go-out/double-victory on delayed bomb, chained 2-delayed-bomb escalation, beaten delayed bomb auto-cancel, and `cancelDelayedBomb` (`varchar(32)` schema).
- [ ] **Multi-Worker Race Stress (`local/race-tests.php` via `npm run test:race`)**: Add targeted Phase 1 scenarios for (1) **2 concurrent atomic bombs vs `pass`** (strictly higher beats or second rejects cleanly; 56 cards & `bomb_number` match `actionlog`) and (2) **`armDelayedBomb` / `cancelDelayedBomb` vs last `pass` -> `collect`** (either delayed bomb triggers OR `collect` completes — never lost bomb, double trick win, or stuck `confirmTrick`), plus fuzz requests for `armDelayedBomb`, `cancelDelayedBomb`, and `atomic` `playBomb`.
- [ ] **Contracts, Static Analysis & Build**: Run `npm run test:contracts`, `npm run phpstan`, and `npm run build`.
- [ ] **Local & Studio Browser Verification (`window.tt` + `src/studio-test.ts`)**: Verify `#myPlayBomb` stays visible & unshifted across `playComboOpen` -> `playCombo` -> `confirmTrick`, self-bombing works, Cancel emits zero network calls, pre-select auto-submits on passes and cancels on table change, and turn-based delayed bomb triggers before Collect.

---

## 7. BGA Ticket Closure & Kickoff Prompt

- **Post-Deploy BGA Status Transitions** _(NEVER post on BGA without explicit user approval first!)_:
  - [#106651](https://boardgamearena.com/bug?id=106651): `acknowledged` -> `implemented`
    - _Plain-text reply draft_: `Implemented in release <YYMMDD-HHMM> (now live). The Play a Bomb button now stays in place even during your own turn (disabled until a combo is on the table, then immediately active for self-bombing), and clicking it stages your bomb locally so you can select and confirm in one request without leaking anything if you cancel. Thanks for the suggestion!`
  - [#217733](https://boardgamearena.com/bug?id=217733): `acknowledged` -> `implemented`
    - _Plain-text reply draft_: `Implemented in release <YYMMDD-HHMM> (now live). In turn-based games, staging a bomb out of turn now offers an Arm Delayed Bomb option (kept completely private). If all remaining players pass without beating the current trick, your armed bomb triggers automatically right before the trick winner collects — letting your partner play first without prompting or leaking bomb info.`

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/.agents/skills/tichu-concurrency-locks/SKILL.md, /Users/brohlfs/git/tichu/.agents/skills/bga-release-and-qa/SKILL.md, and /Users/brohlfs/git/tichu/plans/08-bomb-staging-self-bomb-preselect-and-delayed-bombs.md.
Implement Steps 1–3 cleanly (including widening `actionlog.log_action` to `varchar(32)` in `dbmodel.sql` + `upgradeTableDb`, adding `"nextPlayer" => ST_NEXT_PLAYER` to `ST_CONFIRM_TRICK`, `atomic` `playBomb`, private `armDelayedBomb`/`cancelDelayedBomb` + `stNextPlayer()` tail-loop via `executePlayCombo()`, persistent `#myPlayBomb`, local staging, pre-select, and armed-status pill).
Add all unit, integration, and `local/race-tests.php` scenarios from Section 6, then run `npm run test:contracts`, `npm run phpstan`, `npm run build`, and `npm run test:race`.
```
