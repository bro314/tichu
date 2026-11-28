# 02 — Optional Tichu & Grand Tichu Confirmation Preference (`Pref 106`) — **SUPERSEDED**

> [!NOTE]
> **Superseded (2026-11-27)**: Replaced by **mobile/touch-only `"Tichu"` confirmation** in `src/tichu.ts` + `tichu.game.php` (`Tichu::isMobileConfirmContext()` sending `tichuBet` with `confirm: 1` to trigger the standard backend `confirmTichu` `#page-title` `"no tichu"` / `"confirm"` prompt, no new `Pref 106`, desktop kept one-click, Grand Tichu kept immediate) plus `confirmationDialog` in `local/js/bga-shim.js` (for `onProposeConcede`). Kept for historical reference and `#119164` closure notes.

- **Status**: **Superseded** (`2026-11-27`)
- **Priority**: P1
- **Impact**: **Medium–High** (resolves highest-voted remaining open ticket `#119164` [6v] for mobile/mis-click protection on irrevocable bets, and adds missing `confirmationDialog` to `local/js/bga-shim.js`, unblocking local interactive testing of `onProposeConcede` too)
- **Complexity**: **Medium** (touches PHP options/actions, TS contracts, `GameModel`, `src/tichu.ts`, `<tichu-settings-modal>`, and `bga-shim.js`; zero DB schema, `states.inc.php`, or new row-locking work)
- **Sequencing**: Refreshed from former Plan `06`. Gated on confirming `#119164` UX scope with maintainer (3-mode selector vs. simpler On/Off toggle).
- **Scope**: `gameoptions.inc.php`, `tichu.action.php`, `tichu.game.php`, `src/types/tichu-contracts.ts`, `src/elements/game-model.ts`, `src/elements/tichu-settings-modal.ts`, `src/tichu.ts`, `local/js/bga-shim.js`, `tests/combo-validator.test.ts`, `local/integration-tests.php` (Optional follow-up: `src/elements/tichu-pass-area.ts`, `src/elements/tichu-action-bar.ts`)
- **Open BGA Tickets Covered**:
  - [#119164](https://boardgamearena.com/bug?id=119164) (`acknowledged`, 6 votes — _"Option to require confirmation on Tichu bet"_; button-shift half already shipped via CSS Grid `ab32fe5`/`bfbd344`/`b36236c`, re-opened `2026-11-26` specifically for optional mobile/mis-click confirmation)
- **Already Shipped Sibling Tickets (Removed from Scope)**:
  - `#80004` (`implemented`, `c58d4c0`, release `261124-1242`): Server-side `PlayerManager::getPartnerForUpdate()` + `hasPartnerBetInCurrentRound()` in `grandTichuBet` and `tichuBet` (with MySQL integration & `race-tests.php` regressions).
  - `#97310` (`implemented` / closed on BGA): Action-bar layout overhaul (`bfbd344` / `b36236c`). Optional inline Pass/Reset buttons & subdued passing-phase Tichu styling are preserved below as an optional follow-up only.
- **Shared ID Reservations**: **Owns `$game_preferences[106]`** (`Confirm Tichu / Grand Tichu bets`, `needReload => false`). Sibling prefs: `100..105` live, `107` (Plan 05), `108` (Plan 04).

---

## 1. Why & Goal

Even with stable fixed-grid action bar buttons (`#257954`) and the server-side partner warning (`#80004`), mobile and fast-clicking players still risk accidental one-tap Grand Tichu (`200`) or Tichu (`100`) bets (`#119164`, 6 votes, re-opened `2026-11-26`). BGA's `$game_preferences` currently stops at `105` (`Animations`), and `local/js/bga-shim.js` lacks `GameGui.prototype.confirmationDialog` entirely (which also prevents local interactive testing of `onProposeConcede`).

**Goal**: Add zero-reload User Preference `106` (`Confirm Tichu / Grand Tichu bets`) with two-way `<tichu-settings-modal>` sync, client `this.confirmationDialog` protection (avoiding double-prompts via optional `confirmed` / `confirmMode` args), and `confirmationDialog` support in `local/js/bga-shim.js`.

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| Component               | Verified Location & Symbols                                                            | Current Behavior & Gap                                                                                                                                                                                                                      |
| :---------------------- | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **User Prefs**          | `gameoptions.inc.php:74-135`                                                           | `$game_preferences` defines `100`–`105` (`105` = `Animations`, `needReload => false`). Key `106` is free.                                                                                                                                   |
| **Settings Modal**      | `src/elements/tichu-settings-modal.ts:40-48, 706-920`                                  | Replaced the old `#prefs` text bar (`e7a76b0`); hosts hand sort + prefs `100`–`105` with two-way `persistUserPreference` sync. Needs Pref `106` control.                                                                                    |
| **AJAX Endpoints**      | `tichu.action.php:44-66`                                                               | `grandTichuBet`, `tichuBet`, `confirmTichu` parse `bet` (`AT_enum`) only; `tichuBet()` forwards zero args.                                                                                                                                  |
| **Contracts**           | `src/types/tichu-contracts.ts:154-157`, `local/check-contracts.php:653-710, 1721-1800` | `TichuActionMap` strictly verified 1:1 against `tichu.action.php` (`parseTsContractMap` supports multi-line entries).                                                                                                                       |
| **Server Bet Handlers** | `tichu.game.php:1361-1570`                                                             | `hasPartnerBetInCurrentRound()` (`L1361-1369`) + `grandTichuBet()` (`L1371-1434`) + `tichuBet()` (`L1436-1570`, incl. `#31597` pass-reopen at `L1524-1570`). Currently has no `$confirmMode` bypass for `"Only when unwinnable"`.           |
| **Client Prefs & Bets** | `src/tichu.ts:454-520, 1491-1501, 1650`                                                | `readPrefs`/`onPreferenceChange` stop at `105`; `onGrandTichuBet`/`onTichuBet` call `takeAction` directly with no `confirmationDialog`. Live `confirmationDialog` precedent is `onProposeConcede` (`L1650`, NOT removed `onChoosePhoenix`). |
| **Action Bar**          | `src/elements/tichu-action-bar.ts:43-101, 227-292`                                     | Uses fixed 6-col CSS Grid (`#bomb_button` `col 5`, `#tichu_button` `col 6`); `"Play Bomb"` stays visible on own turn (`064e04d`). Zero horizontal shift already achieved.                                                                   |
| **Replay Ignore**       | `src/elements/replay-engine.ts:233`                                                    | `isIgnoredReplayNotif` already skips `"confirmTichu"`.                                                                                                                                                                                      |
| **Model & Shim**        | `src/elements/game-model.ts:154-217`, `local/js/bga-shim.js:1749-1778, 4573`           | `LiveGamePrefs` stops at `105`, lacks `confirmTichu` & `lastTichuCallAtMs`; `bga-shim.js` hardcodes `[100..105]` and has **no `GameGui.prototype.confirmationDialog`**.                                                                     |

---

## 3. Architectural Decisions & Trade-offs

1. **Two-Layer Confirmation + `confirmed` / `confirmMode` Contract**:
   - Keep server validation authoritative via existing `NotificationManager::confirmTichu` while adding optional `confirmed` (`AT_bool`, default `false`) and `confirmMode` (`AT_enum` `["1","2","3"]`, default `"1"`) args in `tichu.action.php` and `TichuActionMap`.
   - When Pref `106` triggers client `confirmationDialog`, acceptance sends `confirmed: true` so the server commits without a duplicate prompt. Otherwise `confirmed: false` + `confirmMode` lets the server evaluate locked DB state (`confirmMode = 3` still enforces `global_id = 21` `firstOutPlayer != 0`, skipping only partner/`60s`).
   - _Rejected_: Querying `bga_user_preferences` on PHP (`ABSOLUTE NO-GO`), or client-only checks (leaves old open tabs / concurrent races unprotected).
2. **Pref `106` Modes**:
   - `1` = `Smart (partner called, recent call, card passing, or unwinnable)` [default]
   - `2` = `Always confirm`
   - `3` = `Only when unwinnable`
   - _(Note: confirm before implementing whether 3 modes vs. a simple `Never` / `Always confirm` toggle better matches `#119164` feedback.)_
   - Never prompt on `#noBet` (`grandTichuBet(0)`).

| Triggering Situation              | `1`: Smart (Default)                                | `2`: Always Confirm                            | `3`: Only When Unwinnable               | Old Open Tab (`confirmMode=1`)   |
| :-------------------------------- | :-------------------------------------------------- | :--------------------------------------------- | :-------------------------------------- | :------------------------------- |
| **`#noBet` (`grandTichuBet(0)`)** | Never prompts                                       | Never prompts                                  | Never prompts                           | Never prompts                    |
| **Partner called `100`/`200`**    | Client dialog (`confirmed=1`); server race fallback | Client dialog (`confirmed=1`)                  | Skipped (`confirmMode=3`)               | Server `confirmTichu` (`#80004`) |
| **Recent `tichuCall` `< 60s`**    | Client dialog (`confirmed=1`); server fallback      | Client dialog (`confirmed=1`)                  | Skipped (`confirmMode=3`)               | Server `confirmTichu`            |
| **Calling Tichu in `giveCards`**  | Client dialog (`confirmed=1`)                       | Client dialog (`confirmed=1`)                  | Skipped (`confirmMode=3`)               | No dialog                        |
| **`firstOutPlayer != 0`**         | Server `confirmTichu` fallback                      | Client dialog (`confirmed=1`); server fallback | Server `confirmTichu` (`confirmMode=3`) | Server `confirmTichu`            |
| **Routine solo bet**              | Immediate commit                                    | Client dialog (`confirmed=1`)                  | Immediate commit                        | Immediate commit                 |

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

- **`OLD DB -> NEW PHP + NEW JS`**: Zero `dbmodel.sql`, `upgradeTableDb()`, or `global` changes; `safeGetPref(106, 1)` defaults cleanly to `1`.
- **`OLD open JS tab <-> NEW PHP`**: Old tabs omit `confirmed`/`confirmMode`; `tichu.action.php` defaults to `false` / `"1"`, keeping `#80004` server protection intact.
- **`NEW open JS tab <-> OLD PHP` (Rollback)**: `APP_GameAction::getArg` ignores unrequested `confirmed`/`confirmMode` params cleanly.
- **`NEW DB / actionlog -> OLD PHP + OLD JS` (Rollback)**: Zero DB, `global`, state, or `actionlog` changes — 100% lossless rollback.
- **Locking & `@thoun` Autopass**: Preserve `syncStaleReturnState()` on `confirmTichu` early returns in `grandTichuBet` / `tichuBet`; `player_pass` untouched.

---

## 5. Step-by-Step Implementation Blueprint

1. **Preference `106` (`gameoptions.inc.php:126-135`)**:
   - Append `$game_preferences[106]` (`"name" => totranslate("Confirm Tichu / Grand Tichu bets")`, `"needReload" => false`, `"default" => 1`, values `1`–`3` with `totranslate(...)`).
2. **Server `$confirmMode` Support (`tichu.game.php:1371-1570`, `tichu.action.php:44-58`)**:
   - In `tichu.action.php`, parse optional `$confirmed = (bool) $this->getArg("confirmed", AT_bool, false, false)` and `$confirmMode = (int) $this->getArg("confirmMode", AT_enum, false, "1", ["1", "2", "3"])` in `grandTichuBet()` and `tichuBet()`, forwarding `$confirmMode` & `$confirmed`.
   - Update `Tichu::grandTichuBet($bet, $confirmed = false, $player_id = null, $confirmMode = 1)` and `Tichu::tichuBet($confirmed = false, $player_id = null, $confirmMode = 1)`: keep `$firstOutPlayer != 0` (`global_id = 21`) unconditional in `tichuBet`, and gate `hasPartnerBetInCurrentRound()` + `TICHU_CONFIRMATION_TRESHOLD` on `(int) $confirmMode !== 3`.
   - Mirror optional `confirmed?: boolean | 0 | 1; confirmMode?: "1" | "2" | "3" | 1 | 2 | 3;` in `TichuActionMap` (`src/types/tichu-contracts.ts:154-157`).
3. **RxJS Store (`src/elements/game-model.ts:154-217`)**:
   - Add `confirmTichu: 1 | 2 | 3` (`1`) to `LiveGamePrefs`, `setConfirmTichuPref(val)`, and `lastTichuCallAtMs: number | null` to `LiveGameState` (updated on `tichuBet`/`grandTichuBet(200)`, cleared in `enterNewRound`). Export `hasPartnerBetInRound(players, currentPlayerId)` using `getNextPlayersDesc(players, currentPlayerId)[1]`.
4. **Client Confirmation & Settings Modal (`src/tichu.ts`, `src/elements/tichu-settings-modal.ts`)**:
   - Wire pref `106` into `safeGetPref`, `readPrefs`, `onPreferenceChange` (`src/tichu.ts:454-520`), and add `changeConfirmTichuPref(val)` calling `persistUserPreference(106, val)` (skipping when `isReadOnly()`).
   - Add `<select>` / segmented control for Pref `106` in `src/elements/tichu-settings-modal.ts:706-920` subscribed to `confirmTichu$` with two-way sync.
   - Implement `getLocalTichuConfirmMessage(isGrand: boolean): string | null` (using static `_("...")` literals, never prompting on `bet === 0`) and wrap `onGrandTichuBet`/`onTichuBet` (`src/tichu.ts:1491-1501`) in `this.confirmationDialog` (matching `onProposeConcede` at `L1650`, sending `confirmed: 1` on accept or `confirmed: 0, confirmMode`).
5. **Local Runner Shim (`local/js/bga-shim.js:1749-1778, 4573`)**:
   - Add `106: 1` to `DEFAULT_PREFS`, `this.prefs`, and `[100..106]` init loop.
   - Implement `GameGui.prototype.confirmationDialog(text, cb, cancelCb)` rendering `#confirmation_dialog_yes` / `#confirmation_dialog_no` (unblocks both Pref `106` and `onProposeConcede` locally).
6. **Optional Follow-Up (only if still desired since `#97310` is closed)**:
   - Inline `#pass_cards_inline_btn` / `#reset_pass_inline_btn` below `#playertables` in `<tichu-pass-area>` (`src/elements/tichu-pass-area.ts:284-313`, keeping `#passCards_button`/`#resetPassCards_button` in `#generalactions`), and subdued `.passing-phase` styling on `#myMakeTichuBet` during `giveCards`.

---

## 6. Verification Checklist & Regression Tests

- [ ] **Client Unit & Lit Tests (`tests/combo-validator.test.ts` via `npm run test:validator`)**: Pref `106` modes `1`/`2`/`3`, `bet = 0` never prompting, `confirmed: 1` dispatch, `<tichu-settings-modal>` two-way sync, spectator `isReadOnly()` guard.
- [ ] **MySQL 8.0 Integration (`local/integration-tests.php`)**: Extend `test_partner_tichu_confirmation_beyond_threshold` (`L3386-3482`) for `confirmMode = 3` (skips partner/`60s`, still enforces `global_id = 21`) and `confirmed = true` direct commit.
- [ ] **Full Gate**: `npm run build && npm run test:contracts && npm run phpstan`, plus Playwright check on `http://127.0.0.1:8080` exercising `#confirmation_dialog_yes`/`_no` and `<tichu-settings-modal>` live toggle (plus Studio `Reload game options configuration`).

---

## 7. BGA Ticket Closure Draft (`#119164`)

> **NEVER** change BGA ticket status or post replies on `boardgamearena.com` without explicit user approval after production deploy!

- **#119164** (`acknowledged` -> `implemented`):
  - `Implemented in release <YYMMDD-HHMM> (now live). Tapping the Tichu button on mobile and touch devices now asks for confirmation first to prevent accidental mis-taps, while desktop remains one-click (existing server safeguards for partner calls and finished players still apply everywhere). Refreshing the page (F5) loads the update — thanks for the feedback!`
