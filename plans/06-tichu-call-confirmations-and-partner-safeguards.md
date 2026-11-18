# 06 — Tichu & Grand Tichu Confirmation Safeguards (Pref 106, Partner Warning & Pass Placement)

- **Priority**: P1
- **Recommended Roadmap Day**: Day 3
- **Scope**: `gameoptions.inc.php`, `modules/managers/PlayerManager.php`, `tichu.game.php`, `tichu.action.php`, `src/types/tichu-contracts.ts`, `src/elements/game-model.ts`, `src/tichu.ts`, `src/elements/tichu-pass-area.ts`, `src/elements/tichu-action-bar.ts`, `local/js/bga-shim.js`, `tests/combo-validator.test.ts`, `local/integration-tests.php`, `local/race-tests.php`
- **Open BGA Tickets / Prod Issues Covered**: [#97310](https://boardgamearena.com/bug?id=97310) (14 votes, `acknowledged`), [#80004](https://boardgamearena.com/bug?id=80004) (1 vote, `acknowledged`), [#119164](https://boardgamearena.com/bug?id=119164) (4 votes, `acknowledged`)
- **Estimated Effort**: Medium (1–1.5 days across PHP lock-safe partner validation, Pref `106` client modal guards, inline pass buttons, zero-shift bomb spacer, local shim dialog, and unit/MySQL/race/UI regression tests)
- **Dependencies & Shared ID Reservations**:
  - **Owns** `$game_preferences[106]` (**Confirm Tichu / Grand Tichu bets**, `needReload => false`: `1` = Smart [default], `2` = Always confirm, `3` = Only when unwinnable).
  - **Sibling reservations (non-overlapping)**: `$game_preferences` `107` (Plan 13) & `108` (Plan 14); `localStorage` hand sort/order keys (Plan 05); `stats.inc.php` `13`, `17..22` (Plan 12); `global` `31` (Plan 15); `actionlog` events (`unpassCards` Plan 07, `armDelayedBomb`/`cancelDelayedBomb` Plan 08, `roundScore` Plan 10, `concede*` Plan 15).
  - **Coordination**: Keeps `#passCards_button` / `#resetPassCards_button` and server `#confirmTichu` working for Studio tests; aligns with Plan 07 (`ST_GIVE_CARDS` flow) and Plan 08 (`<tichu-action-bar>` bomb UX).

---

## 1. Why & Goal

Three high-signal `acknowledged` community suggestions (#97310, #80004, #119164 — 19 combined votes) highlight gaps where players call Tichu or Grand Tichu accidentally or without teammate context:

1. **Turn-Based Partner Blind Spot (#80004)**: `grandTichuBet` and `tichuBet` currently emit `NotificationManager::confirmTichu` only within `60`s (`TICHU_CONFIRMATION_TRESHOLD`) of a prior `tichuCall` or when `firstOutPlayer != 0`. In turn-based games, calling Tichu hours after a partner's call produces **zero** warning — even though only one player can finish first (while still requiring confirm-through allowance, never a hard block, for bot/dead-hand edge cases).
2. **Card-Passing Spatial Trap (#97310)**: During `ST_GIVE_CARDS` (`40`), `#passCards_button` sits in top `#generalactions` (`#pagemaintitletext`), while bright-green `#myMakeTichuBet` (`"Tichu"`) sits directly above `#myhand` where players look to confirm their 3-card pass.
3. **Missing Preference & Bomb Layout Jump (#119164)**: Players cannot tune confirmation behavior (`needReload => false` Pref `106`), and removing `#myPlayBomb` shrinks `#bomb_button` from its translated label width back to `min-width: 100px`, pulling `#myMakeTichuBet` leftward right under a double-click.

**Goal**: Enforce lock-safe server partner checks across any elapsed time, introduce live Pref `106` client `confirmationDialog` guards without double-prompting, place Pass/Reset buttons inside `<tichu-pass-area>` with muted pass-phase Tichu styling, and eliminate horizontal shift in `<tichu-action-bar>`.

## 2. Current Codebase Reality (Line-Accurate Audit)

| Component               | Exact Verified Location & Symbols                                                                                                                                                                                    | Current Behavior & Gap                                                                                                                                                                                     |
| :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User Prefs**          | [gameoptions.inc.php](file:///Users/brohlfs/git/tichu/gameoptions.inc.php#L126-L135)                                                                                                                                 | `$game_preferences` ends at `105` (`Animations`, `needReload => false`, `default => 1`). Key `106` is unimplemented.                                                                                       |
| **Threshold Const**     | [Constants.php](file:///Users/brohlfs/git/tichu/modules/Constants.php#L55-L57)                                                                                                                                       | Defines `TICHU_CONFIRMATION_TRESHOLD = 60` seconds for same-round recency prompts.                                                                                                                         |
| **Partner Lookup**      | [PlayerManager.php](file:///Users/brohlfs/git/tichu/modules/managers/PlayerManager.php#L91), [L132-L136](file:///Users/brohlfs/git/tichu/modules/managers/PlayerManager.php#L132-L136)                               | `getSelectStmnt` selects `call_grand_tichu`, `call_tichu`; `getPartner($pId)` reads `getNextPlayers($pId)[1]` via plain `SELECT` (no `FOR UPDATE`).                                                        |
| **Confirm Notif**       | [NotificationManager.php](file:///Users/brohlfs/git/tichu/modules/managers/NotificationManager.php#L138-L144)                                                                                                        | `confirmTichu($player_id, $grand, $msg = null)` notifies `player_id` with `{ grand, msg }`. Already ignored by [tichu-replay.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-replay.ts#L515).       |
| **AJAX Endpoints**      | [tichu.action.php](file:///Users/brohlfs/git/tichu/tichu.action.php#L44-L66)                                                                                                                                         | `grandTichuBet`, `tichuBet`, and `confirmTichu` parse `bet` (`AT_enum`) only; `tichuBet()` forwards zero args.                                                                                             |
| **Contracts**           | [tichu-contracts.ts](file:///Users/brohlfs/git/tichu/src/types/tichu-contracts.ts#L66), [L77-L79](file:///Users/brohlfs/git/tichu/src/types/tichu-contracts.ts#L77-L79)                                              | `TichuNotificationMap.confirmTichu` and `TichuActionMap` strictly verified 1:1 by [check-contracts.php](file:///Users/brohlfs/git/tichu/local/check-contracts.php#L658-L814).                              |
| **Grand Tichu Bet**     | [tichu.game.php](file:///Users/brohlfs/git/tichu/tichu.game.php#L845-L890)                                                                                                                                           | `grandTichuBet($bet, $confirmed = false, $player_id = null)` locks via `checkMultiactiveActionFresh` (bumps version #L280); checks `< 60s` only (#L868-L884); no partner check.                            |
| **Tichu Bet**           | [tichu.game.php](file:///Users/brohlfs/git/tichu/tichu.game.php#L892-L978), [L980-L994](file:///Users/brohlfs/git/tichu/tichu.game.php#L980-L994)                                                                    | `tichuBet` calls `acquireGameLock()` (#L896) + `FOR UPDATE` (#L898-L900, #L956-L958); checks `< 60s` & `global_id = 21` (#L943-L967); bumps version at #L968. `confirmTichu` (#L980-L994) forwards `true`. |
| **Client Prefs & Bets** | [tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts#L382-L448), [L1291-L1319](file:///Users/brohlfs/git/tichu/src/tichu.ts#L1291-L1319), [L1774-L1816](file:///Users/brohlfs/git/tichu/src/tichu.ts#L1774-L1816) | Reads `100..105` via `safeGetPref`; `onGrandTichuBet`/`onTichuBet` send AJAX directly (no `confirmationDialog` unlike `onChoosePhoenix` #L1397-L1405). `notif_confirmTichu` renders `#confirmTichu`.       |
| **Pass & GT Top UI**    | [tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts#L1057-L1067), [L1105-L1128](file:///Users/brohlfs/git/tichu/src/tichu.ts#L1105-L1128)                                                                        | `giveCards` renders `#resetPassCards_button` & `#passCards_button` only in top `#generalactions`; GT renders `#noBet` & `#makeGTBet` (`"tha you will finish first"` typo at #L1126).                       |
| **Pass Panel**          | [tichu-pass-area.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-pass-area.ts#L159-L187)                                                                                                                      | Renders `#playertables` with 3 `.playertable` slots and zero pass/reset buttons.                                                                                                                           |
| **Action Bar & Shift**  | [tichu-action-bar.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-action-bar.ts#L73-L93), [L212-L267](file:///Users/brohlfs/git/tichu/src/elements/tichu-action-bar.ts#L212-L267)                             | `#bomb_button` (`min-width: 100px`) shrinks wider `"Play a Bomb"` labels back to `100px` when `!showBomb`, pulling `#tichu_button` left. `#play_button` renders `<h3>My hand</h3>` in `giveCards`.         |
| **Model & Shim**        | [game-model.ts](file:///Users/brohlfs/git/tichu/src/elements/game-model.ts#L69-L180), [bga-shim.js](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L4497)                                                      | `LiveGamePrefs` lacks pref `106` & `lastTichuCallAtMs`; `bga-shim.js` hardcodes `[100..105]` and lacks `GameGui.prototype.confirmationDialog`.                                                             |

## 3. Architectural Decisions & Trade-offs

1. **Two-Layer Confirmation + `confirmed` / `confirmMode` Contract**
   - **Recommended**: Keep server validation authoritative via existing `NotificationManager::confirmTichu` (`TichuNotificationMap` unchanged) while adding optional `confirmed` (`AT_bool`, default `false`) and `confirmMode` (`AT_enum` `["1","2","3"]`, default `"1"`) args in `tichu.action.php` and `TichuActionMap`. When Pref `106` shows client `confirmationDialog`, acceptance sends `confirmed: true` so the server commits without a duplicate prompt. Otherwise `confirmed: false` + `confirmMode` lets the server evaluate locked DB state cleanly (`confirmMode = 3` checks `global_id = 21` only, skipping partner/`60s`).
   - **Rejected Alternatives**: Querying `bga_user_preferences` on the PHP server (`ABSOLUTE NO-GO` violation), or client-only checks (leaves old open JS tabs unprotected and cannot catch concurrent races).

2. **Pref `106` Behavior Matrix**

| Triggering Situation                      | `1`: Smart (Default)                                   | `2`: Always Confirm                            | `3`: Only When Unwinnable               | Old Open Tab (`confirmMode=1`)  |
| :---------------------------------------- | :----------------------------------------------------- | :--------------------------------------------- | :-------------------------------------- | :------------------------------ |
| **`#noBet` (`grandTichuBet(0)`)**         | Never prompts                                          | Never prompts                                  | Never prompts                           | Never prompts                   |
| **Partner called `100`/`200` this round** | Client dialog (`confirmed=1`); server fallback if race | Client dialog (`confirmed=1`)                  | Skipped (`confirmMode=3`)               | Server `confirmTichu` (#80004)  |
| **Recent `tichuCall` `< 60s` ago**        | Client dialog (`confirmed=1`); server fallback         | Client dialog (`confirmed=1`)                  | Skipped (`confirmMode=3`)               | Server `confirmTichu`           |
| **Calling Tichu during `giveCards`**      | Client dialog (`confirmed=1`, #97310)                  | Client dialog (`confirmed=1`)                  | Skipped (`confirmMode=3`)               | No dialog (protected on reload) |
| **`firstOutPlayer != 0` (`global[21]`)**  | Server `confirmTichu` fallback                         | Client dialog (`confirmed=1`); server fallback | Server `confirmTichu` (`confirmMode=3`) | Server `confirmTichu`           |
| **Routine solo bet**                      | Immediate commit                                       | Client dialog (`confirmed=1`)                  | Immediate commit                        | Immediate commit                |

3. **Modal `confirmationDialog` vs. Inline Two-Step Button**
   - **Recommended**: Use BGA `this.confirmationDialog` (proven in `onChoosePhoenix` at [tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts#L1397-L1405)) for client prompts while keeping `renderConfirmTichuButtons` ([tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts#L1774-L1816)) for server `confirmTichu` fallbacks, old tabs, and [studio-test.ts](file:///Users/brohlfs/git/tichu/src/studio-test.ts#L2498-L2654). Centered modals eliminate double-click accidents (#119164) uniformly across `#makeGTBet` and `#myMakeTichuBet`.
4. **Pass-Area Controls, Muted Tichu & Zero-Shift Bomb Spacer (#97310, #119164)**
   - **Recommended**: Render `"Pass selected cards"` and `"Reset choices"` inside `<tichu-pass-area>` below `#playertables` while **keeping** `#passCards_button` / `#resetPassCards_button` in `#generalactions` for Playwright and BGA muscle memory; style `#myMakeTichuBet` with subdued `.passing-phase` styling in `giveCards`.
   - **Zero-Shift Bomb Slot**: When `!showBomb` in `<tichu-action-bar>`, render `<span class="bomb-spacer" aria-hidden="true">${_("Play a Bomb")}</span>` inside `#bomb_button` (`visibility: hidden; pointer-events: none` mirroring `.bgabutton` box padding/font). This guarantees `0px` horizontal shift of `#tichu_button` across all translations while keeping `#myPlayBomb` absent from the DOM, matching declarative Shadow DOM standards in [BGA_OPEN_SOURCE_ECOSYSTEM.md](file:///Users/brohlfs/git/tichu/docs/BGA_OPEN_SOURCE_ECOSYSTEM.md).

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

1. **`OLD DB -> NEW PHP + NEW JS`**: Zero `dbmodel.sql` or `upgradeTableDb()` changes needed. Existing `player_call_tichu`, `player_call_grand_tichu`, `global[21]`, and `actionlog` `tichuCall` supply everything; `safeGetPref(106, 1)` defaults safely to `1`.
2. **`OLD open JS tab <-> NEW PHP`**: Old tabs omit `confirmed` and `confirmMode`; `tichu.action.php` defaults them to `false` and `"1"`, delivering immediate server `#80004` partner protection via existing `notif_confirmTichu` -> `confirmTichu`.
3. **`NEW open JS tab <-> OLD PHP` (rollback)**: Old `APP_GameAction::getArg` ignores unrequested `confirmed` / `confirmMode` parameters. Modes `1` and `2` keep client `confirmationDialog` protection; Mode `3` conservatively reverts to old PHP's `60s`/unwinnable checks with zero runtime errors.
4. **`NEW DB / actionlog -> OLD PHP + OLD JS` (rollback)**: Zero schema, `global`, state, notification, or `actionlog` changes mean any game continues and replays cleanly after rollback.

- **Concurrency & Row-Locking Invariants**:
  - `grandTichuBet` enters `checkMultiactiveActionFresh` (`GET_LOCK` + snapshot + `bumpGameVersion` at `#L280`) and **must** call `$this->syncStaleReturnState()` on `confirmTichu` early return without clearing multiactive (`setPlayerNonMultiactiveSafe` runs only on commit).
  - `tichuBet` acquires `acquireGameLock()` (`#L896`), locks self row (`#L898-L900`) and `global[21]` (`#L956-L958`) `FOR UPDATE`, calls `syncStaleReturnState()` on prompt returns, and bumps version only on commit (`#L968`).
  - Add `PlayerManager::getPartnerForUpdate(int $pId)` using `SELECT ... FOR UPDATE` on the partner row under table `GET_LOCK` (`GLOBAL_LOCK_VERSION = 30`), preventing stale `REPEATABLE-READ` snapshots during concurrent `ST_GRAND_TICHU_BETS` bets without deadlock risk.
- **`@thoun` `player_pass` Autopass Impact**: Betting and Pref `106` never touch `player_pass`; resets in `stNewTrick`, `stNewRound`, and `stNextPlayer` remain untouched.
- **`<tichu-replay>` & `import-bug-sql.php` Impact**: `confirmTichu` is ignored in [tichu-replay.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-replay.ts#L515); pass controls render only in live states; `persistUserPreference` skips `isReadOnly()`; zero new `player_id` DB/JSON surfaces impact `local/import-bug-sql.php`.
- **`ABSOLUTE NO-GO` Compliance**: Server PHP never reads `bga_user_preferences`, `$bgaContainer`, or blocked APIs; Pref `106` stays client-side and passes strict action contracts checked by `npm run test:contracts`.

## 5. Step-by-Step Implementation Blueprint

1. **Preference `106` ([gameoptions.inc.php](file:///Users/brohlfs/git/tichu/gameoptions.inc.php#L126-L135))**: Append `106` after `105` with `"name" => totranslate("Confirm Tichu / Grand Tichu bets")`, `"needReload" => false`, `"default" => 1`:
   ```php
   "values" => [
     1 => ["name" => totranslate("Smart (partner called, recent call, card passing, or unwinnable)")],
     2 => ["name" => totranslate("Always confirm")],
     3 => ["name" => totranslate("Only when unwinnable")],
   ],
   ```
2. **Locked Partner Helper ([PlayerManager.php](file:///Users/brohlfs/git/tichu/modules/managers/PlayerManager.php#L132-L136))**: Add `public static function getPartnerForUpdate(int $pId): array` resolving `$partnerId = (int) self::getPartner($pId)["id"];` and querying:
   `SELECT player_id id, player_call_tichu call_tichu, player_call_grand_tichu call_grand_tichu FROM player WHERE player_id = $partnerId FOR UPDATE`.
3. **Server Checks ([tichu.game.php](file:///Users/brohlfs/git/tichu/tichu.game.php#L845-L978))**:
   - Add `private function hasPartnerBetInCurrentRound(int $playerId): bool` checking `call_tichu === 100 || call_grand_tichu === 200` on `PlayerManager::getPartnerForUpdate($playerId)`.
   - Update signatures: `grandTichuBet($bet, $confirmed = false, $player_id = null, $confirmMode = 1)` and `tichuBet($confirmed = false, $player_id = null, $confirmMode = 1)`.
   - In `grandTichuBet` (`$bet == 200 && !$confirmed && (int) $confirmMode !== 3`): check `hasPartnerBetInCurrentRound` BEFORE `TICHU_CONFIRMATION_TRESHOLD`, emitting `NotificationManager::confirmTichu($player_id, true, clienttranslate("Your partner has already called Tichu. Only one player can finish first — are you sure?"))` + `$this->syncStaleReturnState(); return;`.
   - In `tichuBet` (`!$confirmed`): check `$firstOutPlayer != 0` first across **all** `confirmMode` values (`global_id = 21 FOR UPDATE`); when `(int) $confirmMode !== 3`, check `hasPartnerBetInCurrentRound` second with the exact same literal `clienttranslate(...)` message (`$grand = false`) + `syncStaleReturnState(); return;`, then `TICHU_CONFIRMATION_TRESHOLD` third.
4. **AJAX Args & Contracts ([tichu.action.php](file:///Users/brohlfs/git/tichu/tichu.action.php#L44-L66), [tichu-contracts.ts](file:///Users/brohlfs/git/tichu/src/types/tichu-contracts.ts#L77-L79))**:
   - Parse `$confirmed = (bool) $this->getArg("confirmed", AT_bool, false, false);` and `$confirmMode = (int) $this->getArg("confirmMode", AT_enum, false, "1", ["1", "2", "3"]);` in `grandTichuBet()` and `tichuBet()`, forwarding `$confirmMode` and `$confirmed`.
   - Keep `TichuActionMap` properties single-line (`check-contracts.php#L314`) adding `confirmed?: boolean | 0 | 1; confirmMode?: "1" | "2" | "3" | 1 | 2 | 3;` to `grandTichuBet` and `tichuBet`.
5. **RxJS Store ([game-model.ts](file:///Users/brohlfs/git/tichu/src/elements/game-model.ts#L69-L180), [L489-L565](file:///Users/brohlfs/git/tichu/src/elements/game-model.ts#L489-L565))**:
   - Add `confirmTichu: 1 | 2 | 3` (`1`) to `LiveGamePrefs`, `setConfirmTichuPref(val)`, and `lastTichuCallAtMs: number | null` to `LiveGameState` (set in `applyTichuBet` and `applyGrandTichuBet(..., 200)`; reset on new round). Export `hasPartnerBetInRound(players, currentPlayerId)` via `getNextPlayersDesc(players, currentPlayerId)[1]`.
6. **Client Confirmation & Pass Events ([tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts#L382-L448), [L1291-L1319](file:///Users/brohlfs/git/tichu/src/tichu.ts#L1291-L1319))**:
   - Wire pref `106` into `safeGetPref`, `readPrefs`, and `onPreferenceChange`.
   - Implement `getLocalTichuConfirmMessage(isGrand: boolean): string | null`: skip `bet === 0` (`#noBet`); in mode `3` return `null` (server handles `global[21]` + skips partner/`60s`); in mode `1` check (a) `hasPartnerBetInRound`, (b) `!isGrand && gamestate.name === "giveCards"`, (c) `lastTichuCallAtMs < 60_000`; in mode `2` always return contextual prompt or `_("Are you sure you want to call Grand Tichu (200 points)?")` / `_("Are you sure you want to call Tichu (100 points)?")`.
   - In `onGrandTichuBet(bet)` / `onTichuBet(evt?)`: wrap in `this.confirmationDialog(msg, () => sendBet(true, pref))` when non-null, else call `sendBet(false, pref)`. Listen on `<tichu-pass-area>` for `"tichu-pass-cards"` -> `onPassCards()` and `"tichu-reset-pass-cards"` -> `#resetPassCards_button` reset handler.
7. **Pass Area & Action Bar UI ([tichu-pass-area.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-pass-area.ts#L159-L187), [tichu-action-bar.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-action-bar.ts#L73-L93), [L212-L267](file:///Users/brohlfs/git/tichu/src/elements/tichu-action-bar.ts#L212-L267))**:
   - In `<tichu-pass-area>` during `giveCards`, render `.pass-actions` below `#playertables` with `#pass_cards_inline_btn` (`bgabutton_blue`, `?disabled=${filledCount < 3}`, `_("Pass selected cards")`) and `#reset_pass_inline_btn` (`bgabutton_gray`, `?disabled=${filledCount === 0}`, `_("Reset choices")`) dispatching `CustomEvent`s (`bubbles: true, composed: true`).
   - In `<tichu-action-bar>`, add `.passing-phase` subdued styling on `#myMakeTichuBet` during `giveCards`, and render `.bomb-spacer` containing `_("Play a Bomb")` (`visibility: hidden; pointer-events: none` + `.bgabutton` padding/font) when `!showBomb` (leaving existing `"tha you will finish first"` tooltip key unchanged unless explicitly regenerating BGA translations).
8. **Local Runner Shim ([bga-shim.js](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L4497))**: Add `106: 1` to `DEFAULT_PREFS`, extend pref registration loop `[100..106]`, and implement `GameGui.prototype.confirmationDialog(text, cb, cancelCb)` with `#confirmation_dialog_yes` / `#confirmation_dialog_no`.

## 6. Verification Checklist & Regression Tests

- [ ] **Client Unit & Lit Tests (`npm run test:validator`)**: Extend [combo-validator.test.ts](file:///Users/brohlfs/git/tichu/tests/combo-validator.test.ts#L1051-L1084) covering Pref `106` modes `1`/`2`/`3` (`grandTichuBet(0)` never prompts, partner warning, `giveCards` prompt, `confirmationDialog` -> `confirmed: true`, legacy server `notif_confirmTichu`), `<tichu-pass-area>` `#pass_cards_inline_btn` enablement & events, `<tichu-action-bar>` `.passing-phase` class, and `.bomb-spacer` fixed width when `!showBomb`.
- [ ] **Contracts & PHPStan (`npm run test:contracts && npm run phpstan`)**: Enforce 1:1 `getArg` <-> `TichuActionMap` (`confirmed`, `confirmMode`), single-literal `clienttranslate`/`totranslate`, `tichu-replay.ts` handling, and zero blocked BGA APIs.
- [ ] **MySQL 8.0 Integration ([integration-tests.php](file:///Users/brohlfs/git/tichu/local/integration-tests.php#L186-L298))**: Keep recency tests green; add tests proving partner `100`/`200` call **> 60s ago** triggers `confirmTichu` (`confirmMode = 1`), skips partner/`60s` while still warning on `firstOutPlayer != 0` under `confirmMode = 3`, commits with `confirmed = true`, and resets cleanly next round.
- [ ] **Concurrency Stress (`npm run test:race`, [race-tests.php](file:///Users/brohlfs/git/tichu/local/race-tests.php#L656-L678))**: Confirm zero deadlocks and add concurrent dual-partner `grandTichuBet(200)` race proving one commits and the second sees committed partner row via `FOR UPDATE` and receives `confirmTichu`.
- [ ] **Full Build & Local/Studio E2E (`npm run build`, `window.tt`)**: Playwright on `http://127.0.0.1:8080` & Studio: toggle Pref `106` live, submit 3 pass cards via `#pass_cards_inline_btn`, exercise `#confirmation_dialog_yes`/`_no`, verify `0px` horizontal drift on `#myMakeTichuBet` when Bomb toggles off, and confirm [studio-test.ts](file:///Users/brohlfs/git/tichu/src/studio-test.ts#L2498-L2654) flows stay green.

## 7. BGA Ticket Closure & Kickoff Prompt

> **IMPORTANT**: NEVER transition BGA bug statuses or post replies on `boardgamearena.com` without **explicit user approval** after production verification on `studiogame?game=tichu`.

- **Post-Deploy BGA Transitions (`acknowledged` -> `implemented`) & Plain-Text Replies (zero Markdown backticks!)**:
  - **#97310** (`implemented`):
    Implemented! During card passing, "Pass selected cards" and "Reset choices" buttons now appear directly below the three pass boxes inside the pass area (while keeping the top status bar buttons active). Calling Tichu during card passing is also visually de-emphasized and guarded by a confirmation dialog under the new "Confirm Tichu / Grand Tichu bets" preference (Smart default).
  - **#80004** (`implemented`):
    Implemented! Both Tichu and Grand Tichu now trigger a confirmation warning whenever your partner has already called Tichu or Grand Tichu in the same round, even hours later in turn-based games. Because the Tichu rules still permit calling after a partner in rare situations, you can confirm through the warning rather than being blocked.
  - **#119164** (`implemented`):
    Implemented! Added user preference #106 ("Confirm Tichu / Grand Tichu bets" with Smart, Always confirm, and Only when unwinnable modes, applied live without page reload) and reserved fixed space for the Play a Bomb button so the Tichu button never shifts sideways under your cursor when Bomb availability changes.

### Kickoff Prompt for a Fresh Agent

```markdown
Implement Plan 06 (`plans/06-tichu-call-confirmations-and-partner-safeguards.md`) for Tichu on BGA.

First read:

- `AGENTS.md`
- `plans/06-tichu-call-confirmations-and-partner-safeguards.md`
- `.agents/skills/tichu-concurrency-locks/SKILL.md`
- `.agents/skills/bga-release-and-qa/SKILL.md`
- `.agents/skills/bga-studio-testing/SKILL.md`

Key constraints:

1. Own only `$game_preferences[106]` (`1` Smart, `2` Always, `3` Only when unwinnable; `needReload => false`); NEVER read `bga_user_preferences` on PHP (`ABSOLUTE NO-GO`).
2. Add `PlayerManager::getPartnerForUpdate($pId)` (`FOR UPDATE` under `GET_LOCK`), check partner bets before the 60s threshold in `grandTichuBet` & `tichuBet`, keep `global_id = 21` (`$firstOutPlayer != 0`) first in `tichuBet`, and always call `syncStaleReturnState()` on `confirmTichu` early returns.
3. Add optional `confirmed` (`AT_bool`) and `confirmMode` (`AT_enum` `"1"|"2"|"3"`) in `tichu.action.php` & single-line `TichuActionMap` in `src/types/tichu-contracts.ts`; keep `confirmTichu` fallback and `#passCards_button`/`#resetPassCards_button` working.
4. Implement client `confirmationDialog` triggers in `src/tichu.ts` (never prompt on `#noBet` / `bet = 0`), inline Pass/Reset buttons in `<tichu-pass-area>`, subdued `.passing-phase` Tichu button & `.bomb-spacer` anti-shift CSS in `<tichu-action-bar>`, plus `confirmationDialog` + `106` support in `local/js/bga-shim.js`.
5. Add unit/Lit, MySQL 8.0, and dual-partner `race-tests.php` regressions; finish with `npm run build && npm run test:contracts && npm run phpstan && npm run test:race` and Playwright verification on `http://127.0.0.1:8080`. Do NOT deploy or update BGA tickets without explicit user approval.
```
