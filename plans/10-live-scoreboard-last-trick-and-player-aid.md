# 10 — Live Scoreboard, Last Trick Viewer & Player Aid

- **Priority**: P2 (Brings high-utility replay/table inspection & onboarding tools directly into live gameplay)
- **Scope**: `src/elements/tichu-score-board.ts`, `src/elements/tichu-trick-modal.ts`, `src/elements/tichu-status.ts`, `src/elements/tichu-help.ts` (new), `src/elements/game-model.ts`, `src/tichu.ts`, `tichu.game.php` (`getAllDatas`, `LogManager.php`, `stEndRound`), `src/types/tichu-contracts.ts`
- **Estimated Effort**: Medium (3 clean, complementary live-game HUD dialogs)
- **Dependencies / Sibling Interactions**: Uses `document.body` modal mounting (`<tichu-trick-modal>` pattern) to avoid `rescale()` containing-block traps; aligns `roundScore` log events with [01](file:///Users/brohlfs/git/tichu/plans/01-static-contracts-phpstan-and-ci.md) contracts and [13](file:///Users/brohlfs/git/tichu/plans/13-modern-bga-frontend-esm-and-sound-cleanup.md) if modals later standardize.

---

## 1. Why & Goal

Players jumping into a live Tichu table currently lack three everyday informational tools that top BGA trick-taking/climbing implementations (`Odin`, `The Crew`, `Coinche`, `Tarot`) provide right on the HUD:

1. **Live Round-by-Round Score Sheet**: Currently, `<tichu-score-board>` ONLY works inside archive replay mode (`tichu-replay.ts`) — it reads `window.model.round$`/`playerNames$`, hardcodes teams as `names[0] + names[2]` vs `names[1] + names[3]` (breaking if seats/team assignment mode `101` varies or players are displayed differently!), and live players can only see total scores in sidebar panels (`#player_board_<id>`) rather than round-by-round Tichu bonuses, Double Victories, and point breakdowns!
2. **"Show Last Completed Trick"**: `<tichu-status>` only has `"Show current trick"` (using `<tichu-trick-modal>`, whose DOM still carries leftover `#popin_showLastTrickDialog` IDs!). Once a trick finishes (`confirmTrick` / `dragonGift`), players frequently want to check _what just won the previous trick_ (especially in turn-based games!).
3. **Quick Player-Aid Reference Modal (`?`)**: New or returning Tichu players constantly forget special card point values (`Dragon +25`, `Phoenix -25`, `5/10/K`), exact bomb rankings (`4-of-a-kind` vs `5+ Straight Flush`), Tichu (`+100`) vs Grand Tichu (`+200`) timing, and Mahjong wish rules.

---

## 2. Open-Source BGA References

- **`Coinche` / `Tarot` / `The Crew`**: Compact `"Last Trick"` button beside the trick counter showing the most recently completed trick (winner + sequence of combos played), disabled on Trick 1 of a round.
- **`bga-score-sheet` concept (implemented cleanly via Lit, no extra dependency!)**: Per-round ledger modal showing each round's Card Points, Tichu / Grand Tichu +/-100/+200 bonuses, Double Victory (+200), and Running Total.
- **`Odin` & `Seven Wonders` HUD Help Button (`?`)**: Non-intrusive floating `?` icon opening a crisp BGA-styled quick-reference modal without leaving the table tab.

---

## 3. Current State in Tichu

- **`src/elements/tichu-score-board.ts` (lines 1–93)**:
  - Tightly coupled to replay globals `window.model.round$` / `window.model.playerNames$`.
  - Assumes 2v2 teams are always `[0, 2]` vs `[1, 3]` rather than grouping by `player.team` (`player_team` column stored in DB!).
- **`tichu.game.php` (`stEndRound`) & `LogManager.php`**:
  - Already computes per-round team scores, Tichu bonuses, Double Victories, and sends a table notification (`endRound` / score dialog rows) — inspect exact payload & `actionlog` storage! Note `actionlog` resets or inserts `newRound`; persisting lightweight `roundScore` summary rows in `actionlog` guarantees `getAllDatas()` reconstructs full round history across `F5` reloads cleanly!
- **`src/elements/tichu-trick-modal.ts` (lines 1–155)**:
  - Mounted directly on `document.body` (per `AGENTS.md`). Has leftover `#popin_showLastTrickDialog` IDs inside what currently shows only `currentTrick`.

---

## 4. Decisions & Alternatives for You

1. **Where to store round-by-round score history for live reload (`F5`)**:
   - **Option A (Recommended)**: Insert a small `roundScore` JSON row into existing `actionlog` (`LogManager::insert($firstPlayerId, 'roundScore', $summaryJson)`) inside `stEndRound()`, and expose `roundHistory` cleanly in `getAllDatas()`. Zero `dbmodel.sql` schema migration needed (100% safe for already-running live games!), works across browser reloads and multi-device logins!
   - **Option B**: Reconstruct from `gamelog` on the server or only accumulate client-side from notifications. _Rejected_ — parsing `gamelog` in `getAllDatas()` is fragile, and client-only state wipes on `F5`.
2. **Last Completed Trick Visibility Rules**:
   - **Option A (Recommended)**: Store `lastCompletedTrick` (just the most recent completed trick of the _current round_ — winner + ordered combo list) in `GameModel` (`lastCompletedTrick$`), populated on `confirmTrick` / `dragonGift` (and cleared on `newRound`), plus hydrated from `actionlog` in `getAllDatas()` so `F5` preserves it. Note: Showing the _immediately preceding_ completed trick is standard in turn-based Tichu and avoids endless scrolling through all past tricks (keeping trick memory meaningful in real-time, or optionally toggleable with `isAllInfoExposed`? Keeping just the **1 previous trick** is universally appreciated and non-controversial!).
   - **Option B**: Restrict `"Show last trick"` only to turn-based (`isAllInfoExposed`) mode. _Wait_ — let you decide easily with a 1-line check!
3. **Fixing `<tichu-score-board>` Team Grouping**:
   - **Option A (Recommended)**: Refactor `<tichu-score-board>` into a pure reactive Lit component accepting `players`, `teams`, and `roundHistory` properties/observables (usable by **both** `<tichu-replay>` AND live `<tichu-game>`!), grouping teams explicitly by `player.team` (`1` vs `2` / `0` vs `1`) rather than positional index `[0,2]` vs `[1,3]`!

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Decouple `<tichu-score-board>` & Persist `roundScore` in `actionlog`

- Inspect `tichu.game.php` (`stEndRound`, `getAllDatas`), `modules/managers/LogManager.php`, `src/elements/tichu-score-board.ts`, and `src/elements/tichu-replay.ts`.
- In `stEndRound()` (`tichu.game.php`), record structured `roundScore` JSON in `actionlog` (`round`, `team1Score`, `team2Score`, `team1Total`, `team2Total`, `doubleVictoryTeam?`, `tichuCalls`: per-player +/- bet outcome).
- Include `roundHistory` in `getAllDatas()` and in the `endRound` (or `newScores`) notification payload (`src/types/tichu-contracts.ts` if Plan 01 landed).
- Refactor `<tichu-score-board>` so it accepts clean inputs (`players` grouped by `player.team`, `rounds`), works inside **both** `<tichu-replay>` and a live modal triggered from a `"Scores"` pill in `<tichu-status>` (showing round-by-round breakdown + current totals).

### Step 2: Generalize `<tichu-trick-modal>` for Both "Current Trick" & "Last Trick"

- Clean up `<tichu-trick-modal>` (`src/elements/tichu-trick-modal.ts`):
  - Rename leftover `#popin_showLastTrickDialog` IDs cleanly (e.g., `#popin_showTrickDialog` / modal `mode: "current" | "last"`).
  - Add `lastCompletedTrick$` to `GameModel`, updated when `confirmTrick` / `dragonGift` clears the current trick, reset on `newRound`, and hydrated in `getAllDatas()` from `LogManager` (`confirm` of `trick - 1` within current `round`!).
  - Add `"Last trick"` button next to `"Show current trick"` in `<tichu-status>` (disabled cleanly when `trick <= 1` or `lastCompletedTrick` is empty), passing `mode: "last"` and showing `winnerName` (+ Dragon gift recipient if applicable!) at the top of `<tichu-trick-modal>`.

### Step 3: Create Floating `<tichu-help>` Player-Aid Modal (`?`)

- Create `src/elements/tichu-help.ts` mounted cleanly on `document.body` (just like `<tichu-trick-modal>`, dark-mode aware `html[data-theme="dark"]`!) triggered by a compact `?` button in `<tichu-status>` or `#prefs`.
- Include concise, translatable tabs/sections:
  1. **Special Cards**: Mahjong (`1` + wish), Dog (`pass lead to partner`), Phoenix (`wildcard`, `+0.5` single, `-25 pts`), Dragon (`15`, `+25 pts`, gift trick).
  2. **Combo Hierarchy & Bombs**: Single → Pair → Stairs → Trio → Full House → Straight; 4-of-a-Kind Bomb < 5+ Straight Flush Bomb (anytime interrupt!).
  3. **Scoring & Bets**: `5 = 5`, `10/K = 10`, `Dragon = +25`, `Phoenix = -25`; Tichu (`±100`), Grand Tichu (`±200`), Double Victory (`+200`).

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **`rescale()` Transform Trap**: Any modal rendered inside `<tichu-game>` breaks `position: fixed` on scaled studio windows! Always mount score-sheet, trick, and help modals on `document.body` (and clean them up properly if game tears down) following `<tichu-trick-modal>`.
- **Zero Breaking Schema Changes**: Storing `roundScore` in `actionlog` (which already stores variable `log_action` + JSON `log_arg`!) avoids any `ALTER TABLE` or `upgradeTableDb` risk on live production tables. Note: check `LogManager.php` / `stNewRound()` to make sure `stNewRound` doesn't purge `roundScore` rows needed for the scoreboard! (If `actionlog` is cleared each round, keep `roundScore` rows or store cumulative JSON in a `global` / preserved `log_action`!)
- **Replay Compatibility**: Ensure refactoring `<tichu-score-board>` does not break `<tichu-replay>` on `g_archive_mode` — verify replay still renders every round row and per-team header accurately.
- **Sibling Plans**: Coordinate `GameModel` & `TichuGamedatas` types with [01](file:///Users/brohlfs/git/tichu/plans/01-static-contracts-phpstan-and-ci.md); ensure `tichu-status.ts` buttons stay localized (`t(...)`) per [00](file:///Users/brohlfs/git/tichu/plans/00-live-bugs-and-bga-compliance-fixes.md) and fit compactly at `500px` mobile widths per [06](file:///Users/brohlfs/git/tichu/plans/06-mobile-viewport-and-14-card-hand-layout.md).

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] Completing Round 1 -> Round 2 populates live `"Scoreboard"` modal cleanly with per-round card points, Tichu/Grand Tichu bets, Double Victory, and team totals grouped by `player.team`; survives `F5` reload!
- [ ] Archive replay (`<tichu-replay>`) still renders `<tichu-score-board>` identically (with fixed `player.team` headers).
- [ ] `"Show last trick"` displays the previous trick's cards and winner (plus Dragon recipient when gifted), disables cleanly on Trick 1, and survives `F5`.
- [ ] `"?"` Player Aid opens smoothly on both `1280px` desktop and `375px` mobile (dark & light BGA themes!).
- [ ] `npm run build` and `npm test` (unit + integration) pass cleanly.

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/src/elements/tichu-score-board.ts, /Users/brohlfs/git/tichu/src/elements/tichu-trick-modal.ts, /Users/brohlfs/git/tichu/modules/managers/LogManager.php, and /Users/brohlfs/git/tichu/plans/10-live-scoreboard-last-trick-and-player-aid.md.
Confirm Section 4 decisions with the user (especially actionlog retention across rounds and Last Trick availability in real-time vs turn-based) and execute Steps 1–3.
Build (`npm run build`), run `npm test`, and test Scoreboard, Last Trick across F5, Replay Mode, and `?` Help Modal on `npm run local`.
```
