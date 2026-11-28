# 01 — Turn-Based `ST_CONFIRM_TRICK` Smart Auto-Skip, Atomic Bombs & Delayed Bombs

- **Priority**: P1
- **Impact**: **Medium–High** (Phase 1: Medium — eliminates dead async `"Collect"` waits and consolidates end-round checks; Phase 2: High — fixes `ST_PLAY_BOMB` bluff/cancel info leak, closes `#217733`, and closes `@thoun` bomb autopass gap; Phase 3: Medium — out-of-turn pre-select & `#armedStatusBar`)
- **Complexity**: **Low (Phase 1)** -> **High (Phase 2)** -> **Medium (Phase 3)**
- **Sequencing**: Merges former Plans `08` and `09`. **Phase 1** ships independently as a pure PHP quick win (zero schema, JS, or migration risk); **Phase 2** adds live `actionlog.log_action` `varchar(32)` migration, atomic `playBomb`, local bomb staging, and turn-based delayed bombs (`#217733`); **Phase 3** adds pure client-side out-of-turn `preselect$` and `#armedStatusBar`.
- **Scope**: `dbmodel.sql`, `states.inc.php`, `tichu.action.php`, `tichu.game.php`, `modules/managers/LogManager.php`, `modules/managers/NotificationManager.php`, `src/types/tichu-contracts.ts`, `src/elements/game-model.ts`, `src/elements/tichu-action-bar.ts`, `src/elements/replay-engine.ts`, `src/tichu.ts`, `src/studio-test.ts`, `tests/`, `local/integration-tests.php`, `local/race-tests.php`
- **Open BGA Tickets Covered**:
  - [#217733](https://boardgamearena.com/bug?id=217733) (`acknowledged`, 4 votes — *"Delayed bomb in turn based Tichu"*, fulfilled by Phase 2 + Phase 1)
  - Related live investigation: [#258730](https://boardgamearena.com/bug?id=258730) (`infoneeded`, 2 votes — *"Cant play bomb on own Dragon"*; touches `ST_CONFIRM_TRICK` / `ST_CHOOSE_DRAGON_GIFT` bomb eligibility — factor outcome into Phase 2)
- **Already Shipped Prerequisites (Preserved as Invariants)**:
  - `#106651` (`implemented`, `064e04d`): `#myPlayBomb` stays visible on own turn (`playComboOpen` / `playCombo` / `confirmTrick`) whenever `hand.length > 0` and submits own-turn bombs directly via `playCombo`.
  - `#257868` (`fixed`, `25629ca`): Non-lead bombs (`BOMB_COMBO` onto an active non-Dog trick) are **exempt** from fulfilling an active Mahjong wish (`tichu.game.php:706-713`, `combo-validator.ts:1934-1956`), while bombs containing the wished rank still grant and clear `mahjongWish = 0`.
  - `#258541` (`fixed`, `39e3a10`): Removed dead Phoenix-in-bomb dialog from `onChoosePhoenix`.
  - `#257954` (`implemented`, `bfbd344` / `b36236c`): Fixed 6-column CSS Grid action bar (`tichu-action-bar.ts:43-101`).
- **Shared ID Reservations**: Uses `actionlog` events `armDelayedBomb` / `cancelDelayedBomb` (card IDs only in `log_arg`; widens `log_action` from `varchar(16)` to `varchar(32)`). Reserves **zero** new `gameoptions.inc.php` options/prefs, `stats.inc.php` IDs, `global` IDs (current highest: `GLOBAL_CONCEDE_PROPOSAL_BY = 31`), or `ST_*` state IDs.

---

## 1. Why & Goal

1. **Dead Turn-Based `"Collect"` Waits (Phase 1)**: When every other active player passes (`$lastComboPlayer == $next`), `Tichu::stNextPlayer()` (`tichu.game.php:2136-2145`) unconditionally enters `ST_CONFIRM_TRICK` (`75`). In real-time games, `autoCollectTimeout` collects after 2s (`src/tichu.ts:1245-1251`). In **turn-based** games, forcing the winner to log in just to click `"Collect"` even when no other player holds `>= 4` cards (making any bomb mathematically impossible) stalls async games for hours or days — and turns Dragon tricks into two separate async turns (`"Collect"`, then `"Choose Dragon Gift"`). Meanwhile `collect()` (`tichu.game.php:1731-1771`) duplicates capture logic and omits `$inPlay` / `$doubleVic` end-round checks.
2. **Bluff/Cancel Info Leak & Delayed Turn-Based Bombs (`#217733`, Phase 2)**: Clicking `#myPlayBomb` out of turn or in `confirmTrick` currently dispatches `playBomb` immediately (`src/tichu.ts:1503-1539`), broadcasting `"<player> wants to play a bomb."` (`ST_PLAY_BOMB`) before a card is selected; clicking Cancel leaks bomb ownership or bluffing. In turn-based games, players also want to let their partner play before bombing without missing the window when everyone passes — and without an interactive prompt at `ST_CONFIRM_TRICK` that leaks bomb info if declined. In addition, `executePlayCombo` currently only resets `player_pass` on `NO_COMBO` leads (`tichu.game.php:739-741`), leaving stale autopasses armed after a `BOMB_COMBO` interrupt.
3. **Out-of-Turn Pre-Select & Armed Pills (Phase 3)**: Out-of-turn players lack a snapshot-guarded `"Pre-select"` queue (`The Crew` / `Coinche` pattern) and a clear `#armedStatusBar` summary of armed autopass / delayed-bomb / pre-play state.

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| File & Verified Lines | Current Symbol / Behavior | Gap / Constraint |
| :--- | :--- | :--- |
| `states.inc.php:165-178, 210-238` | `ST_PLAY_BOMB` (`61`), `ST_NEXT_PLAYER` (`70`), `ST_CONFIRM_TRICK` (`75`) | `ST_CONFIRM_TRICK` defines `newTrick`, `chooseDragonGift`, `changePlayer`, `zombiePass`, `endGame` (`5e186ff`), but **lacks** `"endRound" => ST_END_ROUND` (Phase 1) and `"nextPlayer" => ST_NEXT_PLAYER` (Phase 2). |
| `tichu.game.php:683-770` | `completePlayCombo(int\|string $playerId, Combo $combo): void` | Unconditionally calls `nextState(...)` (`L765-769`), so it cannot run inside `stNextPlayer()` (`ST_NEXT_PLAYER["nextPlayer"] => ST_PLAY_COMBO` skips go-out/round-end); resets `player_pass` only on `NO_COMBO` (`L739-741`), missing `BOMB_COMBO`. Preserves `$isNonLeadBomb` (`L706-713`). |
| `tichu.game.php:1731-1771` | `collect()` | Duplicates capture + `captureCards` + `tricks_win` and always transitions `"newTrick"` (no `$inPlay` / `$doubleVic` end-round check). |
| `tichu.game.php:1999-2155` | `stNextPlayer()` (`$lastComboPlayer == $next` at `L2136-2145`) | Unconditionally logs `"confirm"` and jumps to `ST_CONFIRM_TRICK` (`75`); no delayed-bomb scan, no turn-based `< 4`-card auto-confirm. |
| `tichu.game.php:1161-1192`, `tichu.action.php:95-104` | `playBomb` | `tichu.action.php` requires `cards` (`AT_numberlist, true`) with no `atomic` bool; `Tichu::playBomb()` ignores `$cards_ids` and always enters `ST_PLAY_BOMB`. Missing `armDelayedBomb` / `cancelDelayedBomb`. |
| `dbmodel.sql:51`, `tichu.game.php:2663-2766` | `actionlog.log_action varchar(16) NOT NULL` | `"cancelDelayedBomb"` is **17 chars** — MySQL 8.0 strict mode rejects it unless `upgradeTableDb()` & `dbmodel.sql` widen to `varchar(32)`. |
| `modules/managers/LogManager.php:46-78` | `getLastActions($action, true)` | Returns current `(log_round, log_trick)` rows `ORDER BY log_id DESC` (FIFO scan needs `array_reverse`). |
| `src/elements/tichu-action-bar.ts:43-101, 227-258, 590-612` | Fixed 6-col Grid (`#bomb_button` in `grid-column: 5`) | `064e04d` keeps `#myPlayBomb` visible whenever `hand.length > 0` (`isBombPlayOnOwnTurn()`); out-of-turn / `confirmTrick` still trigger legacy `playBomb` immediately (`src/tichu.ts:1503-1539`). No staging UI, no pre-select, no `#armedStatusBar`. |
| `src/tichu.ts:1084-1086, 1503-1539, 1915` | `onEnteringStatePlayCombo`, `onPlayBomb`, `notif_playCombo` | `onEnteringStatePlayCombo` is empty; `notif_playCombo` (`L1915`) checks `this.stateName === "playBomb"` only (missing `rawType === 7` for atomic/delayed bombs). |
| `src/elements/replay-engine.ts:225-248` | `isIgnoredReplayNotif(type)` | Extracted from `tichu-replay.ts`; ignores `confirmTrick` / `game` states; must also ignore `"delayedBomb"`. |
| `local/integration-tests.php:1109-1131` | Test 9 Part B | Sets `isAllInfoExposed = 1` with 4 cards per opponent and P0 playing Dragon; asserts stopping in `confirmTrick` (must remain green!). |

---

## 3. Architectural Decisions & Trade-offs

1. **Auto-Skip Predicate `shouldAutoConfirmTrick(int $winnerId, array $handCounts, bool $dragon): bool` (Phase 1)**:
   - Return `true` **iff**: (a) `$this->bga->tableOptions->isTurnBased()` is `true` (never auto-skip real-time games), **AND** (b) every other seat still in hand (`$pId != $winnerId` in `$handCounts`) has `< 4` cards.
   - **Self-Dragon-bomb sub-guard**: Also return `false` when `$dragon && (int) ($handCounts[$winnerId] ?? 0) >= 4` so a Dragon winner holding `>= 4` cards keeps the rare rule-legal option to bomb their own Dragon (+25 pts) instead of gifting it. *(Confirm with user if 1-click Dragon gift is preferred over self-Dragon-bombing; factor `#258730` outcome into final behavior.)*
   - Zero hidden-info leak: `handcount` is public and bombs require `>= 4` cards (`Combo::checkBomb`). Pausing whenever any opponent holds `>= 4` cards leaks zero info and preserves Test 9 Part B.
2. **Unified `executePlayCombo(int $playerId, Combo $combo): void` Helper (Phase 1/2 Alignment)**:
   - Extract `executePlayCombo()` out of `completePlayCombo()` without `nextState(...)` so both `completePlayCombo()` and Phase 2's `stNextPlayer()` delayed-bomb execution share the exact same validation, logging, `@thoun` autopass reset, wish grant, and card movement logic.
3. **Atomic Bomb Flag (`atomic: true`) vs. Bare `cards` Inference (Phase 2)**:
   - Require optional `atomic` (`AT_bool`, default `false`) on `playBomb({ cards?, atomic? })`. Old unrefreshed `NEW/OLD` tabs clicking `"Play Bomb"` with non-bomb cards selected omit `atomic` and still hit legacy `ST_PLAY_BOMB` cleanly instead of getting an error.
4. **Private Delayed Bomb Storage & Execution Order (`#217733`, Phase 2)**:
   - Store `armDelayedBomb` / `cancelDelayedBomb` in `actionlog` (current `log_round`, `log_trick`, `ORDER BY log_id ASC`, card IDs only).
   - At `$lastComboPlayer == $next` in `stNextPlayer()`: **Step A** scan FIFO delayed bombs -> execute earliest valid beating bomb via `executePlayCombo()` (non-lead bombs are exempt from fulfilling an active wish per `#257868`, while wish-containing bombs clear `mahjongWish = 0`), reset bomber's `player_pass = 0`, tail-call `$this->stNextPlayer(); return;` -> **Step B** evaluate `shouldAutoConfirmTrick()` (calling `resolveTrickCollection()` + `giveExtraTime` on `"chooseDragonGift"`) -> **Step C** log `"confirm"` and enter `ST_CONFIRM_TRICK`.
   - Lock policies: `armDelayedBomb` uses `acquireGameLockOrFail()`; `cancelDelayedBomb` uses `acquireGameLock()` + fresh log check + `bumpGameVersion()` + `syncStaleReturnState()`.
5. **Out-of-Turn Pre-Select (Phase 3)**:
   - Client-only `preselect$` with exact snapshot `{ cardIds, description, round, trick, lastComboSignature, wish }`; forbids `requiresPhoenixChoice`, cancels server `autopass` first before arming, auto-disarms with notice on any table/hand/wish change.

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

- **`OLD DB -> NEW PHP + NEW JS`**: Phase 1 has zero schema changes. Phase 2 `upgradeTableDb($from_version)` idempotently widens `DBPREFIX_actionlog.log_action` to `varchar(32) NOT NULL` inside `try/catch` (checking `SHOW COLUMNS FROM actionlog LIKE 'log_action'`). `getAllDatas()` emits `armedDelayedBomb: []` when absent.
- **`OLD open JS tab <-> NEW PHP`**: Phase 1 auto-skip uses existing transitions/notifications (late `collect` returns cleanly via `syncStaleReturnState()`). Phase 2 old tabs omit `atomic` and enter legacy `ST_PLAY_BOMB`; `armDelayedBomb` is never called by old tabs.
- **`NEW open JS tab <-> OLD PHP` (Rollback)**: `NEW JS` gates `"Arm Delayed Bomb"` on `Array.isArray(gamedatas.armedDelayedBomb)` and falls back to `ST_PLAY_BOMB` buttons if `OLD PHP` ignores `atomic: true`.
- **`NEW DB / actionlog -> OLD PHP + OLD JS` (Rollback)**: Widening `varchar(16)` -> `varchar(32)` is lossless; `armDelayedBomb`/`cancelDelayedBomb` stay in active `(log_round, log_trick)` and are ignored by `LogManager::getLastActions(['combo', 'pass'])`.
- **Concurrency, `@thoun` Autopass & Replay**: All mutating entry points acquire `GLOBAL_LOCK_VERSION = 30` first; `executePlayCombo()` resets `player_pass` + emits `NotificationManager::autopass(0)` on `BOMB_COMBO` as well as `NO_COMBO`; `resolveTrickCollection()` resets `player_pass` before `"endRound"`; `replay-engine.ts::isIgnoredReplayNotif` skips `"delayedBomb"`; `local/import-bug-sql.php` Surface 4 already remaps `log_player`.

---

## 5. Step-by-Step Implementation Blueprint

### Phase 1 — Turn-Based `ST_CONFIRM_TRICK` Smart Auto-Skip (Ships Standalone)

1. **`states.inc.php:225-238`**: Add `"endRound" => ST_END_ROUND` to `ST_CONFIRM_TRICK["transitions"]` (preserving all existing transitions including `"endGame"`).
2. **`tichu.game.php:683-770`**: Extract `private function executePlayCombo(int $playerId, Combo $combo): void` (containing validation, `#257868` wish exemption, logging, autopass reset, wish grant, card move, and `bomb_number`) and have `completePlayCombo()` call `executePlayCombo()` + `nextState(...)`.
3. **`tichu.game.php:1731-1771`**: Extract `private function resolveTrickCollection(int $winnerId, bool $dragon): string` handling Dragon branch, `tricks_win`, `"combos"` -> `"captured"`, `NotificationManager::captureCards`, `$inPlay`/`$doubleVic` check, and `PlayerManager::setAutopass(0)` + `NotificationManager::autopass(0)` before `"endRound"`. Refactor `collect()` to call `resolveTrickCollection()`.
4. **`tichu.game.php` + `stNextPlayer()` (`L2136-2145`)**: Add `shouldAutoConfirmTrick(int $winnerId, array $handCounts, bool $dragon): bool` (with PHPStan Level 6 `@param array<int|string, int|string> $handCounts`). At `$lastComboPlayer == $next`, run `shouldAutoConfirmTrick` -> `changeActivePlayer` -> `resolveTrickCollection` -> `nextState($transition)` -> conditional `giveExtraTime($lastComboPlayer)` on `"chooseDragonGift"`, else fall through to `"confirm"` + `ST_CONFIRM_TRICK`.
5. **Tests**: PHPUnit test for `shouldAutoConfirmTrick` + MySQL integration test in `local/integration-tests.php` covering `< 4` turn-based non-Dragon, Dragon `< 4` vs `>= 4` + zombie (`#808761`), and `>= 4` / real-time pause (keeping Test 9 Part B green).

### Phase 2 — Atomic Bombs, Local Staging & Turn-Based Delayed Bombs (`#217733`)

1. **Schema & Transitions**:
   - Widen `dbmodel.sql:51` and `tichu.game.php` fallback SQL (`L2683`) `log_action` to `varchar(32) NOT NULL`; add idempotent `ALTER TABLE DBPREFIX_actionlog MODIFY COLUMN log_action varchar(32) NOT NULL` in `upgradeTableDb()` (`tichu.game.php:2663-2766`) inside `try/catch`.
   - Add `"nextPlayer" => ST_NEXT_PLAYER` to `ST_CONFIRM_TRICK["transitions"]` (`states.inc.php:225-238`).
   - Update `src/types/tichu-contracts.ts`: `playBomb: { cards?: string; atomic?: boolean }`, `armDelayedBomb: { cards: string }`, `cancelDelayedBomb: {}`, `delayedBomb: { cards: string[] }`, `TichuGamedatas.armedDelayedBomb?: string[]`.
2. **Backend (`tichu.action.php`, `NotificationManager.php`, `tichu.game.php`)**:
   - `tichu.action.php:95-104`: make `cards` optional (`AT_numberlist, false, ""`), add `atomic` (`AT_bool, false, false`), and add `armDelayedBomb` + `cancelDelayedBomb`.
   - `NotificationManager.php`: add `delayedBomb(int $playerId, array $cardIds)` using `notifyPlayerWithVersion`.
   - `executePlayCombo()`: also reset `player_pass` + emit `NotificationManager::autopass(0)` on `BOMB_COMBO`; auto-cancel any active `armDelayedBomb` of `$playerId` in current trick.
   - `Tichu::playBomb($cards_ids = [], $atomic = false)`: under `acquireGameLockOrFail()`, preserve legacy `ST_PLAY_BOMB` when `!$atomic || empty($cards_ids)`, else validate bomb in hand and call `completePlayCombo($playerId, $combo)` (factor in any `#258730` Dragon-confirm ruling).
   - Add `armDelayedBomb`, `cancelDelayedBomb`, `getAllDatas()` `armedDelayedBomb` hydration, and `stNextPlayer()` FIFO delayed-bomb loop (`array_reverse(LogManager::getLastActions(["armDelayedBomb", "cancelDelayedBomb"]))`) calling `executePlayCombo()` (with `#257868` non-lead wish exemption, clearing wish if bomb contains wished rank) + clearing bomber `player_pass` + tail-calling `$this->stNextPlayer()`.
3. **Client Bomb Staging & Replay (`game-model.ts`, `tichu-action-bar.ts`, `src/tichu.ts`, `replay-engine.ts`)**:
   - `GameModel`: add `bombStagingMode`, `delayedBombSupported`, `armedDelayedBombCards`; clear on `applyPlayCombo`, `setMahjongWish`, `enterNewTrick`, `enterNewRound`, `enterEndRound`.
   - `TichuActionBar`: preserve fixed 6-col grid (`#bomb_button` in `grid-column: 5`) and `064e04d` own-turn visibility; clicking `#myPlayBomb` enters local `bombStagingMode` (zero network traffic; disabled with tooltip on `NO_COMBO`/`DOG_COMBO` or when `!hasBomb(hand)` out of turn). In staging mode: `#play_button` -> `#myConfirmBomb`, `#pass_button` -> `#myCancelStagedBomb`, `#pass_trick_button` -> `#myArmDelayedBomb` (when turn-based & `delayedBombSupported` & out of turn & `trickLastCombo.playerId !== currentPlayerId`).
   - `src/tichu.ts`: subscribe `notif_delayedBomb`; update `notif_playCombo` (`L1915`) to check `this.stateName === "playBomb" || rawType === 7`.
   - `src/elements/replay-engine.ts:225-248`: add `"delayedBomb"` to `isIgnoredReplayNotif()`.

### Phase 3 — Out-of-Turn Pre-Select & `#armedStatusBar` (Client-Only)

1. `GameModel`: add `preselect`, `preselectNotice`, `computeLastComboSignature()`; auto-disarm with notice on table/hand/wish change (`applyPass` preserves).
2. `TichuActionBar`: render `#myPreselectPlay` when `!bombStagingMode && !isCurrentPlayerActive && stateName === "playCombo"` with valid beating non-ambiguous selection (canceling server `autopass` first); render `#armedStatusBar` removable pills below `#buttons` for `pass === 1|2`, `preselect`, `armedDelayedBombCards`, and `preselectNotice`.
3. `src/tichu.ts:1084-1086`: in `onEnteringStatePlayCombo`, auto-submit `preselect.cardIds` iff active, not read-only, `!pendingConfirmTichu`, and snapshot matches identically.

---

## 6. Verification Checklist & Regression Tests

- [ ] **Phase 1**: PHPUnit `shouldAutoConfirmTrick` + `local/integration-tests.php` `< 4` vs `>= 4` vs Dragon/zombie tests + `npm run test:race` + `npm run build && npm run test:contracts && npm run phpstan`.
- [ ] **Phase 2**: `tests/combo-validator.test.ts` bomb staging & rollback tests; `local/integration-tests.php` atomic `playBomb` (incl. self-bomb & `#257868`), legacy `ST_PLAY_BOMB`, delayed bomb privacy/FIFO/go-out/chained-bombs/`varchar(32)`/`cancelDelayedBomb`; `local/race-tests.php` 2x atomic bomb vs `pass` & `armDelayedBomb`/`cancelDelayedBomb` vs last `pass` -> `collect`; Studio `window.tt` verification (plus `Restart test table` or upgrade check for `dbmodel.sql`).
- [ ] **Phase 3**: `tests/combo-validator.test.ts` preselect auto-disarm & `#armedStatusBar` tests + local/Studio Playwright flow.

---

## 7. BGA Ticket Closure Draft (`#217733`)

> **NEVER** update BGA ticket status or post replies on `boardgamearena.com` without explicit user approval after production deploy!

- **#217733** (`acknowledged` -> `implemented` once Phase 1 + Phase 2 are both live in production):
  - `Implemented in release <YYMMDD-HHMM> (now live). In turn-based games, staging a bomb out of turn now offers an Arm Delayed Bomb option (kept completely private). If all remaining players pass without beating the current trick, your armed bomb triggers automatically right before collection — letting your partner play first without prompting or leaking bomb info. Tricks where no other player holds 4 or more cards also now collect automatically (while keeping the interactive Dragon gift choice). Refreshing the page (F5) loads the update — thanks for the suggestion!`
