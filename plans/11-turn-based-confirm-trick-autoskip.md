# 11 — Turn-Based `ST_CONFIRM_TRICK` Smart Auto-Skip

- **Priority**: P2 (Eliminates pointless 1–2 day turn-based stalls when nobody left has 4 cards to bomb)
- **Scope**: `tichu.game.php` (`stNextPlayer`, `stConfirmTrick`, `confirmTrick` / `collect`, new shared helper `resolveTrickCollection()`), `local/integration-tests.php`, `tests/`
- **Estimated Effort**: Small (Focused backend logic + careful unit/integration verification)
- **Dependencies / Sibling Interactions**: Check [07 — Bug SQL Loader](file:///Users/brohlfs/git/tichu/plans/07-production-bug-sql-loader.md) if reproducing turn-based trick-collection bug reports; respects `@thoun` autopass resets from [02](file:///Users/brohlfs/git/tichu/plans/02-agent-skills-and-docs-restructure.md).

---

## 1. Why & Goal

In Tichu's rules, after all remaining active players pass on a trick, the game pauses in `ST_CONFIRM_TRICK` (`60`) and asks the trick winner to click `"Collect"` — giving opponents a final window to play an out-of-turn **Bomb** before the trick is captured.

In **real-time** games, a quick click takes 1 second. In **turn-based (async)** games, however, forcing the winner to log in for a separate notification just to click `"Collect"` **even when it is mathematically impossible for any player at the table to hold a bomb** (e.g., everyone remaining has `< 4` cards!) adds hours or days of dead waiting per trick.

Goal: Safely auto-collect tricks in turn-based mode when **no opponent could possibly bomb** (while ALWAYS keeping `ST_CHOOSE_DRAGON_GIFT` interactive whenever the Dragon won!).

---

## 2. Open-Source BGA References

- **BGA Turn-Based Detection (`isAsync()` / `$this->bga->tableOptions->isTurnBased()` in `_ide_helper.php`)**: Tichu already sets global `isAllInfoExposed = 1` in `setupNewGame()` when `isAsync()` is true, and already auto-skips doomed players in `stNextPlayer()` when `isAllInfoExposed` is enabled.
- **`The Crew` / `Coinche` / `Tichu` async ergonomics**: Automated server pass/collection whenever remaining public card counts or public turn-based exposed state guarantee zero legal interruption exists.

---

## 3. Current State in Tichu

- `tichu.game.php`:
  - `setupNewGame()`: detects `$this->isAsync()` (check exact method used around line 310!) and sets `isAllInfoExposed` global (`28`) to `1`.
  - `stNextPlayer()`: detects when everyone else passed (`nextPlayer == trickWinner`) and transitions to `ST_CONFIRM_TRICK` (`60`), setting `confirm` log entry and making trick winner active.
  - `collect()` (`confirmTrick` action in `tichu.game.php`): checks Dragon win (`ST_CHOOSE_DRAGON_GIFT`) or captures cards, clears table, checks round/1-2 out end conditions, and advances to `ST_NEW_TRICK` or `ST_END_ROUND`.
- **CRITICAL**: Never silently auto-skip in **real-time** games (even with `< 4` cards, players expect brief visual pacing of the trick before it clears, OR at minimum you decide explicitly below!).

---

## 4. Decisions & Alternatives for You

1. **Strict Zero-Info-Leak Rule vs. Full Turn-Based Card Inspection (`isAllInfoExposed`)**:
   - **Option A (Recommended — Zero Hidden Info Leak, Safe Everywhere in Turn-Based)**: Auto-skip `ST_CONFIRM_TRICK` in turn-based mode **ONLY IF**:
     - `isTurnBased` (`isAsync()` / `isAllInfoExposed == 1`), **AND**
     - no **opponent** (actually check _all other players with cards_, since even a partner technically could bomb in edge cases, or check `max(handCount of other players) < 4`) holds `>= 4` cards! Because individual player hand counts are **100% public information** on the UI scoreboard, auto-skipping when every other player has `< 4` cards leaks **zero** private information (nobody can possibly form a 4-card or 5-card bomb with 0–3 cards!).
   - **Option B (Aggressive `isAllInfoExposed` Mode)**: Since turn-based Tichu already sets `isAllInfoExposed = 1` and already skips turns in `stNextPlayer()` using `$handRemainingCards->findBeatingCombo($lastCombo)`, ALSO check `Hand::hasBombBeating($lastCombo)` across all other players' hands in `isAllInfoExposed` mode!
     - _Trade-off_: Eliminates _even more_ clicks in turn-based mode, **but** note the subtle deduction risk: if an opponent has 6 cards and `ST_CONFIRM_TRICK` auto-skips immediately, the winner deduces that opponent has no beating bomb! Wait — `stNextPlayer()` in Tichu _already_ auto-passes players using `$handRemainingCards` when `isAllInfoExposed`! Make sure the user explicitly picks Option A (public `< 4` cards only) vs Option B (`isAllInfoExposed` bomb check).

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Extract Shared `resolveTrickCollection()` Helper in `tichu.game.php`

- Read `stNextPlayer()`, `stConfirmTrick()` (if present), `collect()` / `confirmTrick()`, and `chooseDragonGift()` in `tichu.game.php`.
- Notice `AGENTS.md` / Code Quality rule: **never duplicate logic** between `collect()` (manual button click) and the auto-skip branch!
- Extract `private function resolveTrickCollection(int $winnerId): string` returning the next state transition (`"chooseDragonGift"`, `"endRound"`, or `"newTrick"`), performing:
  - Dragon check -> if Dragon won the trick, return `"chooseDragonGift"` (NEVER auto-gift Dragon — player must choose which opponent receives the trick!).
  - Otherwise capture combo cards to `$winnerId`, notify `confirmTrick` / `captureCards`, clear `player_pass` autopass flags, check end-of-round conditions, and return `"endRound"` or `"newTrick"`.

### Step 2: Check Bomb Possibility Before Entering `ST_CONFIRM_TRICK`

- Create a clean, unit-tested predicate `private function shouldAutoConfirmTrick(int $winnerId): bool`:
  - Check turn-based / async condition (`$this->isAsync()` / `isAllInfoExposed`).
  - Under **Option A**: inspect remaining hand counts of every player `!= $winnerId` (actually excluding `$winnerId`? Wait: can `$winnerId` bomb their own trick? Technically Tichu rules don't forbid bombing your own trick unless pointless, so check `otherPlayers` or all active players — checking all players `!= $winnerId` having `< 4` cards is the safe exact condition, or all players `< 4`!). If `max($otherHandCounts) < 4`, return `true`.
  - Under **Option B**: if `isAllInfoExposed`, check whether any player `!= $winnerId` holds a bomb beating `$lastCombo` (`Hand::findBeatingBombs($lastCombo)`).
- Inside `stNextPlayer()` (or `stConfirmTrick()` action state — check `states.inc.php` whether state `60` is `activeplayer` directly entered from `stNextPlayer()`!):
  - If `shouldAutoConfirmTrick($winnerId)` returns `true`: call `$transition = $this->resolveTrickCollection($winnerId);` and `$this->gamestate->nextState($transition);` directly (still emitting `playCombo` / `pass` / `confirmTrick` notifications cleanly so the client sees the trick captured without getting stuck waiting on `"Collect"`!).

### Step 3: Add PHPUnit & MySQL 8.0 Integration Tests

- Add tests in `local/integration-tests.php`:
  1. **Turn-based + opponent has 3 cards + non-Dragon trick**: auto-collects straight to `ST_NEW_TRICK` / `ST_END_ROUND` without stopping in `ST_CONFIRM_TRICK`.
  2. **Turn-based + opponent has 3 cards + Dragon won trick**: transitions straight to `ST_CHOOSE_DRAGON_GIFT` (does NOT skip Dragon gift!).
  3. **Turn-based + opponent has >= 4 cards** (Option A) OR **real-time mode + opponent has 3 cards**: stops normally in `ST_CONFIRM_TRICK`.

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **Dragon Won the Trick**: Even if everyone has 0–3 cards, a trick won by the **Dragon MUST go to `ST_CHOOSE_DRAGON_GIFT`** because the winner has a mandatory strategic choice of _which opponent_ gets the cards (including +25 pts and 5/10/K)! Verify `states.inc.php` transitions from `ST_NEXT_PLAYER` -> `ST_CHOOSE_DRAGON_GIFT` directly if bypassing `ST_CONFIRM_TRICK`, OR execute `stConfirmTrick` (`game` vs `activeplayer` — inspect `states.inc.php` around state `60` first so we don't invent a missing transition in `states.inc.php`!). If `ST_NEXT_PLAYER` only has `'confirmTrick' => ST_CONFIRM_TRICK`, add the missing transitions `'newTrick' => ST_NEW_TRICK`, `'endRound' => ST_END_ROUND`, `'chooseDragonGift' => ST_CHOOSE_DRAGON_GIFT` cleanly in `states.inc.php` (without changing any state IDs!).
- **Animation Readability**: Even when auto-skipped on the server, the client still receives `pass` followed by `confirmTrick` notifications in sequence, so [Plan 05](file:///Users/brohlfs/git/tichu/plans/05-flip-card-flight-animations.md)'s trick linger lets the player see the trick capture cleanly!
- **Bot Test Compatibility (`local/bot.php`)**: Make sure `LocalTichuBot` and existing `integration-tests.php` scenarios (which likely test real-time mode or expect `ST_CONFIRM_TRICK`) remain green!

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] All 3 new integration test cases in `local/integration-tests.php` pass (auto-skip `< 4` cards async, Dragon gift preserved, real-time / `>= 4` cards unaffected).
- [ ] `states.inc.php` transitions verified by `local/check-contracts.php` (if Plan 01 installed) — zero broken transition labels!
- [ ] Zero duplicated capture logic between `collect()` and auto-confirm path.
- [ ] `npm test` and `npm run build` pass cleanly.

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/states.inc.php, /Users/brohlfs/git/tichu/tichu.game.php (`stNextPlayer`, `collect`, `isAsync`, `isAllInfoExposed`), and /Users/brohlfs/git/tichu/plans/11-turn-based-confirm-trick-autoskip.md.
Confirm Option A (public `< 4` cards only in turn-based mode) vs Option B (`isAllInfoExposed` bomb check) with the user, then implement Steps 1–3 cleanly with shared `resolveTrickCollection()`.
Run `composer test`, `npm run test:integration`, and `npm run build`, reporting exact test coverage and results.
```
