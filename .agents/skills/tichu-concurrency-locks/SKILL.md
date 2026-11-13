---
name: tichu-concurrency-locks
description: >-
  Concurrency, transaction isolation, and row-locking protocol for Tichu on BGA MySQL 8.0
  (SERIALIZABLE vs REPEATABLE-READ, GET_LOCK in initTable, acquireGameLock, GLOBAL_LOCK_VERSION = 30,
  debugSaveState(4) mysqldump, and local/race-tests.php). Use whenever adding or modifying player
  actions, state transitions, multiactive states, out-of-turn interrupts (bombs, Tichu bets, autopass),
  or debugging MySQL deadlocks (Error 1213) and race conditions.
---

# Tichu Concurrency, Locking & Race Stress Testing

## 1. Why Concurrency Control Is Required on BGA & BGA Studio

BGA runs MySQL 8.0 (InnoDB) with `@@transaction_isolation = 'SERIALIZABLE'`, where every plain `SELECT` inside an open transaction is implicitly converted to `SELECT ... FOR SHARE` (acquiring shared `S` locks). Furthermore, on BGA Studio (`GamePageAction::performServerAction()`), the framework executes `$this->gamePage->debugSaveState(4)` between `initGameTableObjects()` and the game action — which runs `$this->db->commit()`, spawns an external `mysqldump` process on the table database, and calls `$this->db->begin()` to start a second transaction!

Requests on the same table **can run in parallel**: several tabs/devices of one player auto-collecting a trick, a Tichu call / bomb / autopass of another player arriving while the active player plays, or all 4 players betting Grand Tichu / passing cards within milliseconds. Without early serialization and isolation control, concurrent requests caused `mysql_deadlock_restart_transaction` (Error 1213) — both from `SERIALIZABLE` `S`-to-`X` lock upgrades on `global`/`card` and from Studio's `mysqldump` locking `card` while an action transaction held `X` on `global` and tried to `UPDATE card` — as well as `stNewTrick()` running twice when a second request validated against an outdated snapshot.

---

## 2. The 6-Part Locking Protocol in [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php)

Implemented in the `"Concurrency control"` section of `tichu.game.php`:

1. **`$this->bSelectGlobalsForUpdate = true` in `Tichu::__construct()`**:
   - In `GamePage::initGameTableObjects()` -> `TableInfos::get()`, BGA's very first query of the request is `SELECT global_id, global_value FROM global WHERE 1 [FOR UPDATE]`. Setting `bSelectGlobalsForUpdate = true` ensures that initial query takes an `X` lock instead of a `SERIALIZABLE` `S` lock, preventing `S`-to-`X` lock upgrade deadlocks before game code even runs.
2. **MySQL Advisory Lock (`GET_LOCK`) + `REPEATABLE-READ` in `initTable()`**:
   - `Table::setTable()` calls `$this->initTable()` at the end of `initGameTableObjects()`, **before** BGA Studio's `debugSaveState(4)` commits the initial transaction and spawns `mysqldump`.
   - `initTable()` calls `acquireAdvisoryLock()`, which runs `SELECT GET_LOCK('tichu_table_<id>', 20)` and `SET SESSION transaction_isolation = 'REPEATABLE-READ'` on real BGA servers (`class_exists(\Bga\GameFramework\Old\Db::class)`).
   - Because MySQL session advisory locks (`GET_LOCK`) persist across `COMMIT`/`BEGIN` boundaries for the lifetime of the request's DB connection, a second concurrent request blocks inside `initTable()` before it can spawn a concurrent `mysqldump` or start an overlapping action transaction, and `REPEATABLE-READ` prevents plain `SELECT`s from taking shared `S` locks.
3. **One Table Row Lock (`acquireGameLock()`), Always Acquired First in Every Mutating Entry Point**:
   - Every mutating entry point (all actions in [`tichu.action.php`](file:///Users/brohlfs/git/tichu/tichu.action.php), `zombieTurn`) calls `acquireGameLock()` / `acquireGameLockOrFail()` **before any other DB statement**. It ensures the advisory lock is held and runs `SELECT global_value FROM global WHERE global_id = 1 FOR UPDATE` (plus `global_id = 2` and `global_id = 30`). `getAllDatas()`/`arg*()` never call `acquireGameLock()`.
4. **Stale-Snapshot Detection (`isGameLockStale()`)**:
   - InnoDB does not refresh a transaction's read view when it acquires a lock, and the framework has already loaded the game state in `initGameTableObjects()` (which on Studio was in the first transaction before `debugSaveState(4)`), so a request that waited behind another request will have outdated cached state in `$this->gamestate`.
   - `acquireGameLock()` compares the locked (current) state ID (`global_id = 1`), active player (`global_id = 2`), and version row `global_id = 30` (`Tichu::GLOBAL_LOCK_VERSION = 30`, label `lockVersion`) with the cached/snapshot values (`isGameLockStale()`).
5. **Stale Policy & Fresh-Read Exceptions**:
   - Default: stale requests throw `UserException("The game changed while your action was being processed...")` (rolled back, nothing happens), except where the decision only uses data read freshly with the lock held:
     - `collect`: duplicates/late requests (state no longer `confirmTrick`) are **silent no-ops** (clients auto-collect from every tab).
     - `grandTichuBet`, `giveTheCards`, legacy `acceptCards`: validated with a fresh `player_is_multiactive` read (`checkMultiactiveActionFresh()`) and accepted even if stale; `setPlayerNonMultiactiveSafe()` replaces the framework's possibly stale "anyone still active?" check. Only the **last** passer of `giveTheCards`/`acceptCards` must retry when stale (the transition accepts everybody's cards); the last Grand Tichu bettor may transition on a stale snapshot because `stDealLastCards` only touches the deck.
     - `tichuBet`: own player row, own card counts, and `firstOutPlayer` are read `FOR UPDATE`, so a Tichu call is never lost because others acted concurrently.
     - `pass` out of turn (autopass) and `cancelAutopass`: decided on fresh state/active player/hand count; they don't bump the version because `stNextPlayer()` reads `player_pass` with `FOR UPDATE`. A stale _turn_ pass (e.g. duplicate from a second tab) is rejected instead of silently becoming an autopass.
6. **Version Bump (`bumpGameVersion()`)**:
   - Every request that changes shared game data calls `bumpGameVersion()` (once per request; re-creates row 30 for games started before it existed).

---

## 3. Non-Negotiable Rules for New or Modified Code

- New action endpoints: call `$this->acquireGameLockOrFail()` as the **first** statement (or design a fresh-read exception like above and document it here). Never take any other row lock (`FOR UPDATE`, `UPDATE`, `INSERT`) before the table lock.
- Never rely on plain `SELECT`s after waiting for a lock to see other requests' changes; use `FOR UPDATE` for current reads.
- **Never** enable `$this->bIndependantMultiactiveTable = true`: the code reads/writes `player_is_multiactive` directly.
- Verify with `npm run test:race` after touching any action, state action, or manager.

---

## 4. Running the Multi-Worker Race Stress Test (`npm run test:race`)

- **Command**: `npm run test:race` (`php local/race-tests.php`, ~60s + ~10s; **NOT** part of `npm test` or `npm run build`).
- **Execution Environment**: Spawns persistent PHP worker processes that execute emulated BGA requests (`action_tichu` -> `Tichu`) truly in parallel against the local MySQL 8.0 InnoDB server (`ebd_tichu_1` over `local/.mysql/mysql.sock` managed by [`local/mysql-ctl.sh`](file:///Users/brohlfs/git/tichu/local/mysql-ctl.sh)), running with BGA's default `--transaction-isolation=SERIALIZABLE` and `Tichu::initTable()`'s `GET_LOCK('tichu_table_1', 20)` + `SET SESSION transaction_isolation = 'REPEATABLE-READ'` and `SELECT ... FOR UPDATE` row locks.
- **Phase 1**: Targeted scenarios repeated `--reps` times with exact expectations:
  1. 4x concurrent `collect` + autopass
  2. 4 players' `grandTichuBet` + duplicate tabs
  3. 4 players' `giveTheCards`
  4. 3 Tichu calls vs. a pass
  5. 2 competing bombs vs. a pass
- **Phase 2**: `--duration` seconds of randomized bursts over whole games (legal moves duplicated from "other tabs", out-of-turn Tichu/autopass/bombs/confirmTichu, `getAllDatas` page loads, zombie turns, garbage requests), checking invariants after every burst:
  - 56 unique cards in valid locations
  - Per-state card distribution and multiactive sets
  - Table cards == logged trick cards
  - `newRound`/`newTrick` counted exactly once (`trick_number`/`round_number`/`tichu_number` stats match the action log)
  - Valid bets/scores
  - Monotonic lock version (`global_id = 30`)
  - No stuck game
  - **No exception other than `UserException`** (PHP warnings are fatal)
- **CLI Flags & Environment**:
  - Options: `--duration=60 --workers=8 --seed=N --reps=25 --skip-scenarios --verbose`
  - `--baseline`: sets `TICHU_DB_IGNORE_LOCKS=1` (stripping `GET_LOCK`, `SET SESSION transaction_isolation`, and `FOR UPDATE`) so concurrent workers collide under raw MySQL 8.0 `SERIALIZABLE` to demonstrate the detected races and deadlocks (expected to FAIL).
  - `RACE_DEBUG=1`: prints every scenario request result.
