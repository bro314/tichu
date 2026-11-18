# 15 — Partnership Mutual Concede (`global 31`, Zero-Stall Handshake & Replay Support)

- **Priority**: P2
- **Recommended Roadmap Day**: Day 6
- **Scope**: `modules/Constants.php`, `states.inc.php`, `tichu.game.php`, `tichu.action.php`, `modules/managers/PlayerManager.php`, `modules/managers/LogManager.php`, `modules/managers/NotificationManager.php`, `src/types/tichu-contracts.ts`, `src/elements/game-model.ts`, `src/tichu.ts`, `src/elements/tichu-hand.ts`, `src/elements/tichu-game.ts`, `src/elements/tichu-replay.ts`, `tichu.css`, `local/import-bug-sql.php`, `local/integration-tests.php`, `local/race-tests.php`, `tests/combo-validator.test.ts`
- **Open BGA Tickets / Prod Issues Covered**: [#36963](https://boardgamearena.com/bug?id=36963) (13 votes, `acknowledged`, _"Possibility of conceding the game"_)
- **Estimated Effort**: Medium (1–2 days: lock-safe out-of-turn PHP handshake + always-visible Lit concede controls + Replay/SQL tooling + MySQL race & integration suites)
- **Dependencies & Shared ID Reservations**: Owns **Global ID `31` (`concedeProposalBy`)** and `actionlog` `log_action` keys `concedeProposal`, `concedeAccept`, and `concedeCancel` (`{ "team": int }`). Must NOT collide with prefs `106`–`108` (Plans 06/13/14), stats `13`/`17`–`22` (Plan 12), or sibling `actionlog` actions (Plans 07/08/10). Builds on the `Plan 00` (archived in [00-roadmap-index.md](file:///Users/brohlfs/git/tichu/plans/00-roadmap-index.md)) lock/concurrency baseline.

---

## 1. Why & Goal

BGA's built-in "Concede the game" control only activates in 2-player matches; at 4-player tables BGA only offers collective `forceEndOfGame()` ([Table.php](file:///Users/brohlfs/git/tichu/local/Bga/GameFramework/Table.php#L1879-L1898)), which zeroes player scores rather than awarding the win to the leading partnership. As requested in [#36963](https://boardgamearena.com/bug?id=36963) (with commenters pointing to BGA Spades' partnership concede), 1000- and 2000-point Tichu games routinely produce insurmountable deficits (e.g., `-400` vs `+750`) that force trailing partnerships to grind through several extra rounds.

**Goal**: Deliver a non-blocking, lock-safe, mutually agreed **Partnership Concede** flow driven by `global 31` (`concedeProposalBy`):

1. Any non-zombie player whose team trails after Round 1 by at least `CONCEDE_MIN_DEFICIT` (`300`) can propose a concede once per round without pausing gameplay.
2. Only the proposer and their partner see the offer; if declined (or superseded by `stEndRound`), opponents never learn a concede was discussed.
3. If accepted (or triggered when the partner is already a zombie), the game cleanly clears multiactive/autopass state and finishes at `ST_GAME_END` (`99`) with the leading team awarded the ELO/ranking victory.

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| Surface                          | Verified Current State                                                                                                                                                                                                                                                                                                                                                                                                              | Design Consequence for Plan 15                                                                                                                                |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Globals & Fallback Writes**    | [tichu.game.php](file:///Users/brohlfs/git/tichu/tichu.game.php#L22) defines `GLOBAL_LOCK_VERSION = 30`; [globals 21..30](file:///Users/brohlfs/git/tichu/tichu.game.php#L46-L61) stop at `30`. [acquireGameLock](file:///Users/brohlfs/git/tichu/tichu.game.php#L120-L184) shows the `UPDATE global ...` + `DbAffectedRow() == 0` `INSERT` fallback for running tables.                                                            | Register `"concedeProposalBy" => 31`, read via `getGameStateValue("concedeProposalBy", 0)`, and write with `INSERT` fallback.                                 |
| **Game State Transitions**       | [states.inc.php](file:///Users/brohlfs/git/tichu/states.inc.php#L263) only declares `"endGame" => ST_GAME_END` on `ST_END_ROUND` (`90`). [GamestateMachine.php](file:///Users/brohlfs/git/tichu/local/Bga/GameFramework/GamestateMachine.php#L486-L505) validates transition keys on `nextState()`.                                                                                                                                 | Add `"endGame" => ST_GAME_END` to every interactive state (`type` = `activeplayer` / `multipleactiveplayer`) without introducing any new state IDs.           |
| **Score Ranking on End**         | [Table.php](file:///Users/brohlfs/git/tichu/local/Bga/GameFramework/Table.php#L3113-L3147) & [Table.php](file:///Users/brohlfs/git/tichu/local/Bga/GameFramework/Table.php#L3237-L3255) finalize rankings in `updatePlayerScoresBasedOnGameResults()` from `player_score DESC` while honoring quit neutralization. [gameinfos.inc.php](file:///Users/brohlfs/git/tichu/gameinfos.inc.php#L61) sets `"losers_not_ranked" => true`.   | Ensuring `$winningTeamScore > $concedingTeamScore` before transitioning to `99` awards the match win naturally without hacking scores.                        |
| **Out-of-Turn Endpoints**        | [tichu.action.php](file:///Users/brohlfs/git/tichu/tichu.action.php#L1-L190) has 15 endpoints; out-of-turn endpoints bypass `checkAction()` and rely on `acquireGameLockOrFail()` + [syncStaleReturnState](file:///Users/brohlfs/git/tichu/tichu.game.php#L196-L203).                                                                                                                                                               | Add `proposeConcede()` and `respondConcede(accept: AT_bool)` with `acquireGameLockOrFail()`.                                                                  |
| **Players, Teams & Scores**      | [PlayerManager.php](file:///Users/brohlfs/git/tichu/modules/managers/PlayerManager.php#L1-L220) assigns `team` (`0`/`1`), provides `getPartner`, `getScores`, `setAutopass`, and tracks `player_zombie`. [getAllDatas](file:///Users/brohlfs/git/tichu/tichu.game.php#L405) parses `id, no` (leaving `team` stringy); [LivePlayer](file:///Users/brohlfs/git/tichu/src/elements/game-model.ts#L22-L36) omits `team`.                | Add `team` to `Utils::parseInt` and `TichuPlayer` / `LivePlayer`; check team scores and partner zombie state under lock.                                      |
| **Actionlog Width & Round End**  | [dbmodel.sql](file:///Users/brohlfs/git/tichu/dbmodel.sql#L46-L54) constrains `actionlog.log_action` to `varchar(16) NOT NULL` (`#L51`). [stEndRound](file:///Users/brohlfs/git/tichu/tichu.game.php#L1532-L1714) computes round scores (`gameLength` `[500, 1000, 2000]` at `#L1704`) and transitions to `newRound` / `endGame`.                                                                                                   | `concedeProposal` (15), `concedeAccept` (13), and `concedeCancel` (13) all fit `varchar(16)`. `stEndRound()` must cancel open offers before advancing rounds. |
| **UI Visibility & Dialogs**      | [tichu-last-played.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-last-played.ts#L318) hides `#card-last-played-area` (and `<tichu-status>` at `#L338-L348`) during `isPassState`. [tichu-hand.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-hand.ts#L180-L270) renders `#prefs` visibly for all active states. [src/tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts#L644-L652) uses `pendingConfirmTichu`. | Render `[Concede match]` in `#prefs` and partner controls in a top `<tichu-game>` banner; guard with separate `pendingConfirmConcede`.                        |
| **Contracts, Replay & Importer** | [check-contracts.php](file:///Users/brohlfs/git/tichu/local/check-contracts.php#L604-L755) enforces PHP/TS/Replay parity (`isIgnored()` at [tichu-replay.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-replay.ts#L510-L529)). [import-bug-sql.php](file:///Users/brohlfs/git/tichu/local/import-bug-sql.php#L635-L643) remaps globals `21, 22, 27` in `$globalIdList`.                                                     | Sync `TichuNotificationMap`, `TichuActionMap`, `TichuReplay::isIgnored()`, and `import-bug-sql.php` (`global 31`).                                            |

---

## 3. Architectural Decisions & Trade-offs

1. **Eligibility & Anti-Abuse Policy — `CONCEDE_MIN_DEFICIT = 300`, `round >= 2`, Max 1 Proposal/Team/Round (Recommended)**
   - **Rule**: A non-zombie, non-spectator player may propose concede only when:
     - `round >= CONCEDE_MIN_ROUND` (`2`) — prevents Round-1 `0–0` rage-concedes before a single hand settles ([gameoptions.inc.php](file:///Users/brohlfs/git/tichu/gameoptions.inc.php#L28-L45) supports `500`, `1000`, `2000` pt targets).
     - `opponentScore - ownTeamScore >= CONCEDE_MIN_DEFICIT` (`300`) — matches BGA Spades' philosophy (~200-pt lead in 500-pt Spades) scaled cleanly for Tichu so both 500-pt quick matches (e.g., `-100` vs `+250`) and 1000/2000-pt matches can exit genuinely hopeless games while small swings stay disallowed.
     - `global 31 == 0` (no open proposal already pending) AND `LogManager` confirms zero prior `concedeProposal` rows for `log_player IN ($playerId, $partnerId)` in the current `log_round` (eliminates spam-nagging a partner who already declined this round).
   - **Rejected Alternative**: Requiring a `500`-pt deficit (effectively disables concede in `500`-pt games) or omitting per-round rate limits (enables griefing).

2. **Non-Blocking Out-of-Turn Handshake via `global 31` + Zombie Fast-Path (Recommended)**
   - **Zero Stall**: Gameplay never pauses into a synthetic `ST_CONCEDE` state; card passing, Tichu calls, and trick play continue normally while `global 31` holds the proposer's `player_id`.
   - **Zero Information Leak**: `proposeConcede` and `respondConcede(false)` emit **private** `notifyPlayer()` messages strictly to `$playerId` and `$partnerId`—never `notifyAllPlayers()`. Opponents and spectators never learn a trailing team considered conceding.
   - **Zombie Partner Fast-Path**: Under `acquireGameLockOrFail()`, if the proposer's partner has `player_zombie != 0` in the locked `player` row, `proposeConcede()` bypasses waiting for `respondConcede` and completes the concede immediately so a lone human isn't held hostage.
   - **Round-End Auto-Cancel**: `stEndRound()` ([tichu.game.php](file:///Users/brohlfs/git/tichu/tichu.game.php#L1532-L1714)) resets `global 31 = 0`, logs `concedeCancel`, and privately notifies both teammates if a proposal remained open when the last hand finished, preventing stale Round-`N` proposals from surviving into Round-`N+1` scores.
   - **Rejected Alternative**: A blocking `multipleactiveplayer` concede state (breaks turn timers and creates denial-of-turn exploits).

3. **Termination Path — Explicit `"endGame" => ST_GAME_END` Transitions Across Interactive States (Recommended)**
   - Add `"endGame" => ST_GAME_END` to every `activeplayer` / `multipleactiveplayer` state in [states.inc.php](file:///Users/brohlfs/git/tichu/states.inc.php#L1-L267) (`grandTichuBets`, `giveCards`, `showPassedCards`, `playComboOpen`, `playCombo`, and special-card prompt states).
   - Inside `completeConcede()`: clear `player_is_multiactive = 0` when ending from a `multipleactiveplayer` state, reset `PlayerManager::setAutopass(0)` for all players, verify `$opponentScore > $concedingScore`, emit public `concedeResult` (`clienttranslate('${team_names} concede the match!')`), and call `$this->gamestate->nextState("endGame")`.
   - **Rejected Alternative**: Calling undocumented `jumpToState(ST_GAME_END)` directly (`GamestateMachine::nextState()` keeps transition graphs explicit for [check-contracts.php](file:///Users/brohlfs/git/tichu/local/check-contracts.php#L559-L569) while reusing existing `ST_GAME_END = 99`).

4. **UI Surface & Modal Isolation (Recommended)**
   - Put `[Concede match]` inside `#prefs` in [tichu-hand.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-hand.ts#L197-L270) (always rendered for active players, even when `isPassState` hides `<tichu-last-played>`).
   - Guard proposer submission with `this.confirmationDialog(...)` ([bga-framework.d.ts](file:///Users/brohlfs/git/tichu/src/types/bga-framework.d.ts#L1016-L1023)) using `this.pendingConfirmConcede`—completely isolated from `pendingConfirmTichu` ([src/tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts#L644-L652)) so a simultaneous Tichu confirmation dialog never collides.
   - Show the partner's prompt as a non-modal top banner (`#concede-banner` inside `<tichu-game>`) with `Accept Concede` and `Decline` buttons so incoming card selections aren't interrupted.

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

| Compatibility Direction                                    | Concrete Invariant & Handling                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. `OLD DB -> NEW PHP + NEW JS`**                        | Pre-deploy tables have no `global_id = 31` row and no DDL is needed. Reads use `$this->getGameStateValue("concedeProposalBy", 0)`. Writes run `UPDATE global SET global_value = ... WHERE global_id = 31` followed by `INSERT` if `$this->DbAffectedRow() == 0` (matching [tichu.game.php](file:///Users/brohlfs/git/tichu/tichu.game.php#L170-L174)). New `log_action` names fit existing `varchar(16)` ([dbmodel.sql](file:///Users/brohlfs/git/tichu/dbmodel.sql#L51)). |
| **2. `OLD open JS tab <-> NEW PHP`**                       | Unreloaded old tabs lack `[Concede match]` / `#concede-banner` and safely skip unknown `concedeProposal` / `concedeCancel` / `concedeResult` notifications. If a teammate with an updated tab concedes, BGA's standard `gameStateChange` to `99` transitions old tabs to game-end scoring cleanly.                                                                                                                                                                         |
| **3. `NEW open JS tab <-> OLD PHP` (Rollback)**            | After rollback, `getAllDatas()` omits `gamedatas.concede`, so `GameModel` hides concede controls immediately (`eligible = false`). If an old tab still fires `proposeConcede.html` / `respondConcede.html` during the rollback window, missing-action AJAX failures do not mutate DB state.                                                                                                                                                                                |
| **4. `NEW DB / actionlog -> OLD PHP + OLD JS` (Rollback)** | `concedeProposal` / `concedeAccept` / `concedeCancel` rows in `actionlog` are ignored by old [LogManager](file:///Users/brohlfs/git/tichu/modules/managers/LogManager.php#L1-L188) callers (`pass`/`combo`/`confirm`). An ended table in `ST_GAME_END` (`99`) remains valid for old PHP, and an orphan `global 31` row is ignored because old `initGameStateLabels()` never accesses `31`.                                                                                 |

- **Locking & Concurrency Protocol**: Both `proposeConcede()` and `respondConcede()` MUST call `$this->acquireGameLockOrFail()` first (ensuring `bSelectGlobalsForUpdate = true` + `GET_LOCK` + `REPEATABLE-READ` per [tichu-concurrency-locks](file:///Users/brohlfs/git/tichu/.agents/skills/tichu-concurrency-locks/SKILL.md)). Both validate `$this->freshStateId` rather than stale pre-lock snapshots: `proposeConcede()` rejects `ST_GAME_END` and automatic `game` states (`10, 30, 46, 50, 55, 90`), and calls `syncStaleReturnState()` if non-transitioning. If `playCombo` (ending a round via `stEndRound`) races with `respondConcede(true)`, MySQL row/table locks serialize them: if `stEndRound` commits first, it resets `global 31 = 0` (and may reach `ST_GAME_END`), causing `respondConcede(true)` to fail cleanly with a `Bga\GameFramework\UserException`.
- **`@thoun` `player_pass` Autopass Invariant**: Proposing or declining a concede never touches `player_pass`. Before calling `nextState("endGame")` in `completeConcede()`, reset `PlayerManager::setAutopass(0)` for all players alongside `player_is_multiactive = 0` so no stale multiactive/autopass state lingers at match end.
- **`<tichu-replay>` Impact**: [tichu-replay.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-replay.ts#L510-L529) MUST include `type === "concedeProposal" || type === "concedeCancel" || type === "concedeResult"` in `isIgnored()`. Because `concedeProposal` / `concedeCancel` are private notifications and `segmentNotifMoves()` (`#L626-L743`) walks public round/trick boundaries, ignoring all three prevents replay halts (`ignoredNotifType`) and keeps [check-contracts.php](file:///Users/brohlfs/git/tichu/local/check-contracts.php#L747-L755) green.
- **`local/import-bug-sql.php` 7-Surface Audit**: Add `31` to `$globalIdList` in `applyPlayerIdSqlPhase()` ([import-bug-sql.php](file:///Users/brohlfs/git/tichu/local/import-bug-sql.php#L635-L643)) guarded so only non-zero values (`global_value > 0`) remap (preserving sentinel `0`), and add `31 => 0` in `ensureBaselineGlobals()` (`#L716-L739`). Store strictly `{ "team": int }` (zero `player_id` inside `log_arg` JSON; `log_player` remaps via Surface 4 SQL), and avoid `player_id` keys or register them in `remapNotificationNode()` (`#L850-L877`) if present in `gamelog`.
- **Studio `ABSOLUTE NO-GO` Compliance**: Zero platform-internal queries (`bga_*`, `$bgaContainer`, `Reflection*`, filesystem calls); verified by `npm run test:contracts`.

---

## 5. Step-by-Step Implementation Blueprint

1. **Constants & State Machine ([Constants.php](file:///Users/brohlfs/git/tichu/modules/Constants.php#L1-L57), [states.inc.php](file:///Users/brohlfs/git/tichu/states.inc.php#L1-L267))**
   - Add `const CONCEDE_MIN_DEFICIT = 300;` and `const CONCEDE_MIN_ROUND = 2;` in `Constants.php`.
   - Add `"endGame" => ST_GAME_END` to transitions of every `activeplayer` / `multipleactiveplayer` state in `states.inc.php` (never touch state IDs or add new states).

2. **Backend State, Managers & Action Handlers ([tichu.game.php](file:///Users/brohlfs/git/tichu/tichu.game.php), [PlayerManager.php](file:///Users/brohlfs/git/tichu/modules/managers/PlayerManager.php), [LogManager.php](file:///Users/brohlfs/git/tichu/modules/managers/LogManager.php), [NotificationManager.php](file:///Users/brohlfs/git/tichu/modules/managers/NotificationManager.php), [tichu.action.php](file:///Users/brohlfs/git/tichu/tichu.action.php))**
   - Register `"concedeProposalBy" => 31` in `initGameStateLabels()` (`tichu.game.php#L46-L61`) and `$this->setGameStateInitialValue("concedeProposalBy", 0)` in `setupNewGame()` (`#L343-L351`). Add `setConcedeProposalBy(int $value): void`:
     ```php
     $this->DbQuery("UPDATE global SET global_value = $value WHERE global_id = 31");
     if ($this->DbAffectedRow() == 0) {
       $this->DbQuery("INSERT INTO global (global_id, global_value) VALUES (31, $value)");
     }
     ```
   - Add `PlayerManager::getTeamScores(array $players): array` (`[0 => sumTeam0, 1 => sumTeam1]`) and `LogManager::hasConcedeProposalInRound(int $round, array $teamPlayerIds): bool` checking `SELECT COUNT(*) FROM actionlog WHERE log_round = $round AND log_action = 'concedeProposal' AND log_player IN (...)`.
   - Add emitters in `NotificationManager`:
     - `concedeProposal(int $toPlayerId, int $proposerId, string $proposerName, int $team)` (`notifyPlayer` only)
     - `concedeCancel(int $toPlayerId, int $byPlayerId, string $byName, string $reason)` (`notifyPlayer` only)
     - `concedeResult(int $concedingTeam, string $teamNames)` (`notifyAllPlayers` with `clienttranslate('${team_names} concede the match!')`)
   - In `getAllDatas(int $currentPlayerId)`: parse `team` (`Utils::parseInt($players, ["id", "no", "team"])`) and include `"concede"` scoped to the viewer (`proposalBy`: `$proposerId` only when `$proposerId` matches `$currentPlayerId` or their partner, else `0`; `usedThisRound`: bool; `minDeficit`: `CONCEDE_MIN_DEFICIT`; `minRound`: `CONCEDE_MIN_ROUND`).
   - Implement `Tichu::proposeConcede(): void` & `Tichu::respondConcede(bool $accept): void` under `$this->acquireGameLockOrFail()`:
     - Reject spectators, zombie actors, `ST_GAME_END`, and non-interactive `game` states using `$this->freshStateId`.
     - Check round & deficit (`$opponentScore - $teamScore >= CONCEDE_MIN_DEFICIT`, `$round >= CONCEDE_MIN_ROUND`).
     - In `proposeConcede`: check `global 31 == 0` and `!LogManager::hasConcedeProposalInRound(...)`. If `$players[$partnerId]['player_zombie'] != 0`, call `completeConcede(...)` directly; else set `global 31 = $playerId`, insert `concedeProposal` `{ "team": $team }`, send two private `concedeProposal` notifications, call `syncStaleReturnState()`.
     - In `respondConcede($accept)`: require `global 31 == $partnerId`. If `!$accept`, reset `global 31 = 0`, insert `concedeCancel` `{ "team": $team }`, send two private `concedeCancel` notifications, call `syncStaleReturnState()`. If `$accept`, call `completeConcede(...)`.
     - `completeConcede()`: verify `$opponentScore > $concedingScore`, reset `global 31 = 0`, log `concedeAccept` `{ "team": $team }`, clear `player_is_multiactive = 0` when in `multipleactiveplayer`, reset `PlayerManager::setAutopass(0)`, emit `concedeResult`, and call `$this->gamestate->nextState("endGame")`.
   - In `stEndRound()` (`tichu.game.php#L1532-L1714`) before transitioning (`#L1702-L1714`): if `$proposerId = (int) $this->getGameStateValue("concedeProposalBy", 0) > 0`, reset `global 31 = 0`, log `concedeCancel`, and privately notify `$proposerId` + partner (`reason = "round_end"`).
   - Expose `proposeConcede()` and `respondConcede()` (`$this->getArg("accept", AT_bool, true)`) in `tichu.action.php` without `checkAction()`.

3. **TS Contracts & RxJS Model ([tichu-contracts.ts](file:///Users/brohlfs/git/tichu/src/types/tichu-contracts.ts), [game-model.ts](file:///Users/brohlfs/git/tichu/src/elements/game-model.ts))**
   - Add `team: number` to `TichuPlayer` / `LivePlayer`, `concede` to `TichuGamedatas`, `proposeConcede` / `respondConcede` to `TichuActionMap`, and `concedeProposal` / `concedeCancel` / `concedeResult` to `TichuNotificationMap`.
   - Add `concedeState$` (`BehaviorSubject<{ proposalBy: number; usedThisRound: boolean; minDeficit: number; minRound: number }>`) in `GameModel`, reset `proposalBy` / `usedThisRound` on `enterNewRound()`, and compute eligibility (`!isSpectator && round >= minRound && deficit >= minDeficit && proposalBy === 0 && !usedThisRound`).

4. **Dojo Adapter, Lit Components, CSS & Replay ([src/tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts), [tichu-hand.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-hand.ts), [tichu-game.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-game.ts), [tichu-replay.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-replay.ts), [tichu.css](file:///Users/brohlfs/git/tichu/tichu.css))**
   - Subscribe `concedeProposal`, `concedeCancel`, `concedeResult` in `setupNotifications()`. Wire `proposeConcede()` (guarded by `pendingConfirmConcede` + `this.confirmationDialog`) and `respondConcede(accept)` via `takeAction(..., { lock: false })`.
   - Render `[Concede match]` in `#prefs` ([tichu-hand.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-hand.ts#L197-L270)) and `#concede-banner` inside `<tichu-game>` ([tichu-game.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-game.ts)) with partner `Accept Concede` / `Decline` buttons and `html[data-theme="dark"]` styling.
   - Add `concedeProposal`, `concedeCancel`, and `concedeResult` to `isIgnored()` in [tichu-replay.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-replay.ts#L510-L529).

5. **Bug Importer ([import-bug-sql.php](file:///Users/brohlfs/git/tichu/local/import-bug-sql.php))**
   - Add `31` to `$globalIdList` in `applyPlayerIdSqlPhase()` (`#L635-L643`, updating only when `global_value > 0`) and `31 => 0` in `ensureBaselineGlobals()` (`#L716-L739`).

---

## 6. Verification Checklist & Regression Tests

- [ ] **PHPUnit (`npm run test:unit`)**: Add pure unit assertions if team-score delta helper is extracted into `PlayerManager`.
- [ ] **TS Validator & Replay Suite (`npm run test:validator`)**: Extend [combo-validator.test.ts](file:///Users/brohlfs/git/tichu/tests/combo-validator.test.ts#L2944-L3020) to verify `GameModel` eligibility boundaries (Round 1 blocked, `-299` blocked, `-300` in Round 2 allowed), F5 rehydration with `gamedatas.concede` (proposer vs partner vs opponent visibility), and `TichuReplay` stepping cleanly past `concedeProposal`, `concedeCancel`, and `concedeResult`.
- [ ] **MySQL 8.0 Integration Suite (`npm run test:integration`)**: Add `test_partnership_mutual_concede()` in [integration-tests.php](file:///Users/brohlfs/git/tichu/local/integration-tests.php#L1200) testing:
  1. Round-1 and `< 300` deficit rejection (`UserException`).
  2. Strict notification privacy (opponents receive 0 packets on `proposeConcede` and `respondConcede(false)`).
  3. 1-proposal-per-team-per-round anti-spam guard after a partner decline.
  4. `stEndRound()` clearing a dangling `global 31` proposal cleanly.
  5. Multiactive concede during `giveCards` clearing `player_is_multiactive` and finishing in `ST_GAME_END` (`99`) with winning team ranking highest.
  6. Zombie partner solo concede fast-path + missing `global 31` pre-deploy `INSERT` fallback.
- [ ] **Concurrency Race Stress (`npm run test:race`)**: Add a targeted scenario in `runTargetedScenarios()` ([race-tests.php](file:///Users/brohlfs/git/tichu/local/race-tests.php#L539-L754)) racing partner `respondConcede(accept=true)` concurrently against active player's final `playCombo` triggering `stEndRound()`, plus include `proposeConcede` / `respondConcede` in `planBurst()` (`#L898-L918`) & `fuzzRequest()` (`#L940-L977`) with zero Error-1213 deadlocks and clean `checkInvariants()`.
- [ ] **Contracts, PHPStan, Bug Importer & Build**: Run `npm run test:contracts`, `npm run phpstan`, `npm run build`, and verify `npm run bug:import -- --inspect` remaps non-zero `global 31` while preserving `0`.
- [ ] **Local Browser E2E (`npm run local` + `window.tt`)**: Confirm `[Concede match]` visibility rules, non-blocking partner banner across `giveCards` and `playCombo`, opponent isolation on decline, and clean end-game screen on accept (dark + light themes).

---

## 7. BGA Ticket Closure & Kickoff Prompt

- **BGA Bug Tracker Transition** _(NEVER post on BGA without explicit user approval)_:
  - [#36963](https://boardgamearena.com/bug?id=36963): `acknowledged` -> `implemented`
- **Plain-Text Developer Reply Draft** _(no Markdown backticks)_:

```text
Implemented partnership mutual concede for trailing teams! Once past Round 1 and trailing by 300 or more points, either player on the trailing team can propose a concede from the footer links below their hand (maximum one proposal per team per round). The proposal stays completely private to your partnership unless accepted: your partner sees an Accept / Decline banner without pausing gameplay, and if your partner has left as a zombie you can concede immediately. Accepting ends the match cleanly and awards the win to the leading team.
```

### Kickoff Prompt for a Fresh Agent

```text
Implement Plan 15 (Partnership Mutual Concede) following plans/15-partnership-mutual-concede.md and AGENTS.md.
Critical invariants:
1. Use reserved global ID 31 (`concedeProposalBy`) read via `getGameStateValue("concedeProposalBy", 0)` and written via `UPDATE` + `INSERT` fallback (`DbAffectedRow() == 0`). Add `31` (remapping only when `global_value > 0`) to `local/import-bug-sql.php` (`applyPlayerIdSqlPhase` + `ensureBaselineGlobals`). Never touch prefs 106-108 or stats 13/17-22.
2. Keep concede 100% out-of-turn under `acquireGameLockOrFail()` (no `ST_CONCEDE` state). Enforce `CONCEDE_MIN_DEFICIT = 300`, `CONCEDE_MIN_ROUND = 2`, 1 proposal/team/round, strict opponent lead, zombie partner fast-path, `stEndRound()` auto-cancel, and private `notifyPlayer` notifications on propose/decline.
3. Add `"endGame" => ST_GAME_END` transitions to interactive states in `states.inc.php`; clear `player_is_multiactive = 0` and `PlayerManager::setAutopass(0)` before calling `nextState("endGame")`.
4. Place `[Concede match]` in `TichuHand` `#prefs` (visible during passing), render partner banner in `TichuGame`, isolate `pendingConfirmConcede` from `pendingConfirmTichu`, and ignore `concedeProposal` / `concedeCancel` / `concedeResult` in `TichuReplay::isIgnored()`.
5. Add TS, MySQL integration (`test_partnership_mutual_concede`), and `race-tests.php` concurrent concede-vs-endRound tests, then run `npm run build && npm run test:contracts && npm run phpstan && npm run test:race`.
```
