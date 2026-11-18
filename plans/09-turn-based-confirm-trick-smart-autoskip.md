# 09 — Turn-Based `ST_CONFIRM_TRICK` Smart Auto-Skip (Coordinated with Delayed Bombs & Dragon)

- **Priority**: P2
- **Recommended Roadmap Day**: Day 5
- **Scope**: [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php) (`stNextPlayer`, `collect`, `completePlayCombo`, new `resolveTrickCollection()`, new `shouldAutoConfirmTrick()`, Plan 08 hook `triggerArmedDelayedBombIfAny()`), [`states.inc.php`](file:///Users/brohlfs/git/tichu/states.inc.php) (`ST_CONFIRM_TRICK` additive `"endRound"` transition), [`local/integration-tests.php`](file:///Users/brohlfs/git/tichu/local/integration-tests.php), [`tests/`](file:///Users/brohlfs/git/tichu/tests)
- **Open BGA Tickets / Prod Issues Covered**: [#217733](https://boardgamearena.com/bug?id=217733) (_"Delayed bomb in turn based Tichu"_, `acknowledged`, `4` votes — fulfilled jointly with Plan 08)
- **Estimated Effort**: Small (1 focused backend session + unit, MySQL 8.0 integration, and 8-worker concurrency verification; zero client JS/CSS changes)
- **Dependencies & Shared ID Reservations**: Supersedes `plans/11-turn-based-confirm-trick-autoskip.md` (archived in [00-roadmap-index.md](file:///Users/brohlfs/git/tichu/plans/00-roadmap-index.md)). Coordinates directly with **Plan 08** (`armDelayedBomb` / `cancelDelayedBomb` in `actionlog` with `{ "cards": int[] }`, `log_player = $playerId`, scoped to current `log_round` & `log_trick`), `plans/05-flip-card-flight-animations.md` (archived in [00-roadmap-index.md](file:///Users/brohlfs/git/tichu/plans/00-roadmap-index.md)) (`runCaptureCardsSweep`), and [`tichu-concurrency-locks`](file:///Users/brohlfs/git/tichu/.agents/skills/tichu-concurrency-locks/SKILL.md). Reserves **zero** new `gameoptions.inc.php` prefs, `stats.inc.php` IDs, `global` IDs, or `actionlog` action names.

---

## 1. Why & Goal

In Tichu, once every other active player passes (`$lastComboPlayer == $next`), [`Tichu::stNextPlayer()`](file:///Users/brohlfs/git/tichu/tichu.game.php#L1511-L1521) unconditionally transitions to `ST_CONFIRM_TRICK` (`75`), asking the trick winner to click `"Collect"` so opponents have a final out-of-turn **Bomb** window. In real-time games, [`Tichu::onUpdateActionButtons()`](file:///Users/brohlfs/git/tichu/src/tichu.ts#L1095-L1101) auto-collects after a 2-second visual linger (`autoCollectTimeout`). In **turn-based (async)** games (`bRealtime === false`), however, forcing the winner to log in for a separate `"Collect"` turn **even when no other player holds `>= 4` cards** (making any bomb mathematically impossible) adds hours or days of dead wait per trick — and turns Dragon tricks into two separate async turns (`"Collect"`, then `"Choose Dragon Gift"`).

Goals:

1. **Eliminate dead async `"Collect"` waits** by auto-skipping `ST_CONFIRM_TRICK` (`75`) in turn-based games whenever no other player can hold a bomb — while **always** keeping `ST_CHOOSE_DRAGON_GIFT` (`80`) interactive when Dragon won.
2. **Coordinate strictly with Plan 08's Delayed Bombs ([#217733](https://boardgamearena.com/bug?id=217733))** so `triggerArmedDelayedBombIfAny()` fires in FIFO order _before_ auto-skip evaluation or `ST_CONFIRM_TRICK` entry.
3. **Consolidate trick capture** into one `resolveTrickCollection(int $winnerId, bool $dragon): string` helper shared identically by manual `collect()` and `stNextPlayer()` (fixing `plans/11-turn-based-confirm-trick-autoskip.md` (archived in [00-roadmap-index.md](file:///Users/brohlfs/git/tichu/plans/00-roadmap-index.md)), which misstated `ST_CONFIRM_TRICK` as state `60` instead of `75` and omitted delayed-bomb ordering).

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| File & Symbol                                                                                                                                                                                                            | Verified Line(s)                      | Current Behavior & Gaps                                                                                                                                                                                                                                                                       |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`modules/Constants.php`](file:///Users/brohlfs/git/tichu/modules/Constants.php#L16-L27)                                                                                                                                 | `16–27`                               | `ST_NEW_TRICK=50`, `ST_PLAY_COMBO=60`, `ST_PLAY_BOMB=61`, `ST_NEXT_PLAYER=70`, **`ST_CONFIRM_TRICK=75`**, `ST_CHOOSE_DRAGON_GIFT=80`, `ST_CHANGE_PLAYER=85`, `ST_END_ROUND=90`.                                                                                                               |
| [`states.inc.php`](file:///Users/brohlfs/git/tichu/states.inc.php#L198-L255)                                                                                                                                             | `198–211`, `213–229`, `245–255`       | `ST_NEXT_PLAYER` (`70`) **already** defines `"chooseDragonGift" => 80`, `"newTrick" => 50`, `"endRound" => 90`, `"confirmTrick" => 75`. `ST_CONFIRM_TRICK` (`75`) currently **lacks** `"endRound" => ST_END_ROUND` (only lists `newTrick`, `chooseDragonGift`, `changePlayer`, `zombiePass`). |
| [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php#L349-L377) `setupNewGame` / `isAllInfoExposed`                                                                                                         | `349`, `372–377`                      | Sets `isAllInfoExposed` (`28`) via `$this->bga->tableOptions->isTurnBased() ? 1 : 0`; `isAllInfoExposed()` falls back to `isTurnBased()`. (`isAsync()` is `@deprecated` in [`_ide_helper.php`](file:///Users/brohlfs/git/tichu/_ide_helper.php#L1930-L1932).)                                 |
| [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php#L485-L547) `completePlayCombo`                                                                                                                         | `516–546`                             | Ends unconditionally with `$this->gamestate->nextState("nextPlayer")` (`545`), which inside `ST_NEXT_PLAYER` (`70`) would jump to `ST_PLAY_COMBO` (`60`) instead of re-evaluating `stNextPlayer()`.                                                                                           |
| [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php#L549-L596) `chooseDragonGift`                                                                                                                          | `564–595`                             | Increments `tricks_win`, moves `"combos"` -> `"captured"`, logs `chooseDragonGift`, emits `captureCards`, checks `$inPlay` / `$doubleVic` -> `"endRound"` or `"newTrick"`.                                                                                                                    |
| [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php#L1129-L1169) `collect`                                                                                                                                 | `1129–1169`                           | Acquires lock, silently returns with `syncStaleReturnState()` if state != `75`, reads `LogManager::getLastAction("confirm")`, branches on `!empty($action["dragon"])` vs duplicating capture + `"newTrick"` (omits `$inPlay`/`$doubleVic` check).                                             |
| [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php#L1302-L1364) `stNewTrick`                                                                                                                              | `1307–1310`, `1334–1363`              | Reads `LogManager::getLastComboPlayer()` _before_ inserting `"newTrick"`, clears `setAutopass(0)`, hands lead to `$lastWinner` (or next player with cards), calls `giveExtraTime($starterId)` after `nextState("firstCombo")`.                                                                |
| [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php#L1375-L1530) `stNextPlayer`                                                                                                                            | `1411–1435`, `1454–1529`              | Handles 1-left (`1412–1432`), scans combined remaining hands in `isAllInfoExposed()` (`1455–1468`), sets `$amount = 4` on Dragon (`1472–1474`), resets `AUTOPASS_ONCE` (`1495–1507`), and at `1511–1521` unconditionally logs `"confirm"` and enters `ST_CONFIRM_TRICK`.                      |
| [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php#L1716-L1835) `stChangePlayer` / `zombieTurn`                                                                                                           | `1716–1725`, `1740–1750`, `1830–1835` | `cancel()` in `ST_PLAY_BOMB` restores `ST_CONFIRM_TRICK` preserving the trick's `"confirm"` row; nested `zombieTurn()` clears `gameLockStale` (`#808761`).                                                                                                                                    |
| [`modules/managers/LogManager.php`](file:///Users/brohlfs/git/tichu/modules/managers/LogManager.php#L40-L65)                                                                                                             | `40–65`                               | `getLastActions($action, true)` returns current `log_round`/`log_trick` rows sorted **`ORDER BY log_id DESC`** (so FIFO requires `array_reverse(...)`).                                                                                                                                       |
| [`modules/Hand.php`](file:///Users/brohlfs/git/tichu/modules/Hand.php#L81-L138) & [`Combo.php`](file:///Users/brohlfs/git/tichu/modules/Combo.php#L225-L258)                                                             | `Hand:81–138`, `Combo:225–258`        | `Combo::checkBomb()` requires `>= 4` cards; `playBomb()` (`tichu.game.php:661`) throws `UserException` when `< 4` cards.                                                                                                                                                                      |
| [`local/integration-tests.php`](file:///Users/brohlfs/git/tichu/local/integration-tests.php#L872-L895) Test 9 Part B                                                                                                     | `872–895`                             | Sets `isAllInfoExposed = 1` on a real-time table with P1/P2/P3 holding **4 cards each** and P0 playing Dragon; asserts stopping in `confirmTrick`!                                                                                                                                            |
| [`local/import-bug-sql.php`](file:///Users/brohlfs/git/tichu/local/import-bug-sql.php#L600-L613)                                                                                                                         | `600–613`, `777`                      | Synthesizes `"confirm"` only when reopening into `ST_CONFIRM_TRICK` (`75`), and remaps `confirm.nextPlayer`.                                                                                                                                                                                  |
| [`src/elements/tichu-animation-layer.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-animation-layer.ts#L676-L745) & [`tichu-replay.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-replay.ts#L485-L529) | `anim:676–745`, `replay:485–529`      | `notif_captureCards` runs `runCaptureCardsSweep` (`150ms` winner highlight linger); `<tichu-replay>` replays `captureCards` + `activeplayer` changes and ignores `confirmTrick` / `game` states.                                                                                              |

---

## 3. Architectural Decisions & Trade-offs

1. **Auto-Skip Predicate `shouldAutoConfirmTrick(int $winnerId, array $handCounts, bool $dragon)`:**
   - **Option A (Recommended — Public `< 4` Card Check Only, Zero Hidden-Info Leak):** Return `true` **iff**:
     1. `$this->bga->tableOptions->isTurnBased()` is `true` (**never** auto-skip real-time games, where `autoCollectTimeout` gives 2s visual pacing and an active bomb window), **AND**
     2. Every other player still in hand (`$pId != $winnerId` in `$handCounts`) has `< 4` cards.
     - _Trick Winner Self-Bombing Nuance_: Tichu rules (`tichu.game.php:656-688`, `tichu-action-bar.ts:216`) technically allow `$winnerId` to bomb their own trick in `ST_CONFIRM_TRICK`. On non-Dragon tricks this has zero tactical value (winner already leads next trick and can play the bomb safely without risking an over-bomb), whereas on a **Dragon** trick (`$dragon === true`) a winner holding a `>= 4`-card bomb could bomb their own Dragon to keep +25 pts instead of gifting an opponent. **Recommended sub-guard**: also return `false` when `$dragon && (int) ($handCounts[$winnerId] ?? 0) >= 4` (100% rules-preserving with zero info leak, since `$winnerId` only sees their own count — or omit that sub-guard only if prioritizing 1-click Dragon gifts over rare self-Dragon-bombs).
     - _Why Delayed Bomb `#217733` Only Applies at `>= 4` Cards_: Every bomb requires `>= 4` cards (`Combo::checkBomb`). Any seat with `0..3` cards cannot bomb or arm `armDelayedBomb`, and `handcount` is public — so auto-skipping at `< 4` leaks **zero** private data. When any opponent holds `>= 4` cards and did not arm a delayed bomb, pausing at `ST_CONFIRM_TRICK` preserves zero deduction leak (`open-issues.json` `#217733` promise) and keeps [`local/integration-tests.php`](file:///Users/brohlfs/git/tichu/local/integration-tests.php#L872-L895) Test 9 Part B green.
   - **Option B (`isAllInfoExposed()` Card-Scan via `Hand::getHighestBomb()`):** Scan hands in `isAllInfoExposed()` mode to skip even when opponents have `>= 4` cards if nobody holds a beating bomb.
     - _Rejected_: Scanning individual hands leaks private card ownership to the winner; even scanning combined remaining cards breaks Test 9 Part B's explicit `confirmTrick` assertion and diverges when 4 matching ranks span multiple seats.

2. **Exact Execution Order at `$lastComboPlayer == $next` & Delayed-Bomb Loop (`#217733`):**
   - **Option A (Recommended — Step A Delayed Bomb -> Re-Run `stNextPlayer()` -> Step B Auto-Confirm -> Step C `ST_CONFIRM_TRICK`):**
     - **Step A**: Invoke `triggerArmedDelayedBombIfAny($lastCombo)` **first**. If Plan 08's earliest valid delayed bomb triggers, play it via `completePlayCombo($bomberId, $bombCombo, false)` (without `nextState("nextPlayer")`), clear `$bomberId`'s `player_pass`, and re-run `$this->stNextPlayer(); return;` so `firstOutPlayer`/`doubleVictory`/`1-left` are checked for the bomber and turn play (plus any second, higher delayed bomb!) continues normally.
     - **Step B**: Otherwise evaluate `shouldAutoConfirmTrick((int) $lastComboPlayer, $handCounts, $dragon)`. If `true`, call `changeActivePlayer($lastComboPlayer)`, `resolveTrickCollection((int) $lastComboPlayer, $dragon)`, `nextState($transition)`, and `giveExtraTime($lastComboPlayer)` if `$transition === "chooseDragonGift"`. Omit the `"confirm"` `actionlog` row when skipping `ST_CONFIRM_TRICK` (only `collect()` reads `"confirm"`).
     - **Step C**: Otherwise log `"confirm"` and enter `ST_CONFIRM_TRICK` (`75`) unchanged.
   - _Ecosystem Precedent ([`docs/BGA_OPEN_SOURCE_ECOSYSTEM.md`](file:///Users/brohlfs/git/tichu/docs/BGA_OPEN_SOURCE_ECOSYSTEM.md#L76-L80))_: Mirrors `The Crew`'s async auto-skip when no legal interrupt exists (relying on `runCaptureCardsSweep` linger) and `@thoun`'s centralized `autopass` reset discipline.

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

1. **`OLD DB -> NEW PHP + NEW JS`**: Zero schema, option, stat, global, or state-ID changes. Running tables already in `ST_CONFIRM_TRICK` (`75`) keep their `"confirm"` row and resolve via `collect()` -> `resolveTrickCollection()`. Legacy tables lacking `isAllInfoExposed` (`global[28]`) evaluate `$this->bga->tableOptions->isTurnBased()` directly.
2. **`OLD open JS tab <-> NEW PHP`**: Auto-skip uses only pre-existing transitions (`newTrick` -> `playComboOpen`, `chooseDragonGift`, `endRound`) and existing notifications (`captureCards`, `autopass`, `log`). Any late `collect` from an old tab returns silently via `$expectedStateId !== ST_CONFIRM_TRICK` + `syncStaleReturnState()`.
3. **`NEW open JS tab <-> OLD PHP` (rollback)**: Zero client JS/TS changes; rolling back to `OLD PHP` simply enters `ST_CONFIRM_TRICK` (`75`) and shows `"Collect"` (`#myConfirmTrick`) normally.
4. **`NEW DB / actionlog -> OLD PHP + OLD JS` (rollback)**: Auto-skip adds no new `actionlog` names, card locations, globals, or states, and keeps `log_trick` globally monotonic. Rollback is 100% lossless.

- **Locking Invariants**: Both `stNextPlayer()` (called inside locked actions/`zombieTurn`) and `collect()` hold `acquireGameLock()` (`GET_LOCK` + `REPEATABLE-READ` + `global WHERE 1 FOR UPDATE`). Concurrent `armDelayedBomb`, autopass `pass`, or duplicate `collect` calls serialize cleanly; `giveExtraTime($lastComboPlayer)` runs strictly _after_ `nextState("chooseDragonGift")`; and nested `zombieTurn()` (`#808761`) handles an auto-skipped Dragon gift when the trick winner is a zombie.
- **`@thoun` `player_pass` Autopass Resets**: `stNewTrick()` calls `PlayerManager::setAutopass(0)` + `NotificationManager::autopass(0)`; `resolveTrickCollection()` also resets `setAutopass(0)` before returning `"endRound"`; `triggerArmedDelayedBombIfAny()` clears the bomber's `player_pass` before re-entering `stNextPlayer()`.
- **`<tichu-replay>`, Bug SQL Loader & Studio Safety**: [`tichu-replay.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-replay.ts#L485-L529) ignores `confirmTrick`/`game` states and advances on `captureCards`. [`local/import-bug-sql.php`](file:///Users/brohlfs/git/tichu/local/import-bug-sql.php#L600-L613) needs zero changes. Zero BGA platform internals (`ABSOLUTE NO-GO`) touched; enforced by `npm run test:contracts`.

---

## 5. Step-by-Step Implementation Blueprint

1. **Add `"endRound"` transition to `ST_CONFIRM_TRICK` in [`states.inc.php`](file:///Users/brohlfs/git/tichu/states.inc.php#L213-L229)**:
   - Preserve all state IDs; add `"endRound" => ST_END_ROUND` to `ST_CONFIRM_TRICK["transitions"]` (required so shared `resolveTrickCollection()` can return `"endRound"` from `collect()` too). Confirm `ST_NEXT_PLAYER` (`70`, lines `198–211`) already declares `"chooseDragonGift"`, `"newTrick"`, and `"endRound"`.

2. **Add `$advanceState` parameter to `Tichu::completePlayCombo()` in [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php#L485-L547)**:
   - Change signature to `function completePlayCombo($playerId, $combo, bool $advanceState = true)` and wrap lines `542–546` in `if ($advanceState) { ... }` so `triggerArmedDelayedBombIfAny()` can record/notify/move a bomb from inside `ST_NEXT_PLAYER` (`70`) without triggering a premature `70 -> 60` jump.

3. **Extract `resolveTrickCollection(int $winnerId, bool $dragon): string` & update `collect()` in [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php#L1129-L1169)**:

   ```php
   private function resolveTrickCollection(int $winnerId, bool $dragon): string
   {
     if ($dragon) {
       return "chooseDragonGift";
     }
     $this->incStat(1, "tricks_win", $winnerId);
     $deck = CardManager::getDeck();
     $trickValue = CardManager::getTrickValue($deck->getCardsInLocation("combos"));
     $deck->moveAllCardsInLocation("combos", "captured", null, $winnerId);
     $players = PlayerManager::getPlayers();
     NotificationManager::captureCards(
       $winnerId,
       $players[$winnerId]["name"] ?? $this->getActivePlayerName(),
       $trickValue
     );
     $inPlay = array_keys($deck->countCardsByLocationArgs("hand"));
     $doubleVic =
       count($inPlay) == 2 && $players[$inPlay[0]]["team"] == $players[$inPlay[1]]["team"];
     if ($doubleVic) {
       $this->setGameStateValue("doubleVictory", 1 - $players[$inPlay[0]]["team"]);
     }
     if (count($inPlay) <= 1 || $doubleVic) {
       PlayerManager::setAutopass(0);
       NotificationManager::autopass(0);
       return "endRound";
     }
     return "newTrick";
   }
   ```
   - In [`collect()`](file:///Users/brohlfs/git/tichu/tichu.game.php#L1152-L1168), replace lines `1154–1168` with `$transition = $this->resolveTrickCollection((int) $pId, !empty($action["dragon"])); $this->gamestate->nextState($transition);`.

4. **Add `shouldAutoConfirmTrick()` & Plan 08 coordination hook in [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php)**:

   ```php
   private function shouldAutoConfirmTrick(int $winnerId, array $handCounts, bool $dragon): bool
   {
     if (!$this->bga->tableOptions->isTurnBased()) {
       return false;
     }
     foreach ($handCounts as $pId => $count) {
       if ((int) $pId !== $winnerId && (int) $count >= 4) {
         return false;
       }
     }
     if ($dragon && (int) ($handCounts[$winnerId] ?? 0) >= 4) {
       return false; // preserve rare self-Dragon-bomb rule
     }
     return true;
   }
   ```
   - Coordinate `triggerArmedDelayedBombIfAny(Combo $lastCombo): bool` with Plan 08: read `array_reverse(LogManager::getLastActions(["armDelayedBomb", "cancelDelayedBomb"]))` to preserve FIFO registration order, take each player's latest action in current `log_round`/`log_trick`, pick the first `"armDelayedBomb"` whose card IDs are all still in that player's `'hand'`, form `BOMB_COMBO`, beat `$lastCombo`, and pass `checkMahjongWishFulfillment()`, call `$this->completePlayCombo($bomberId, $bombCombo, false)`, reset `$bomberId`'s `player_pass` to `0`, and return `true`.

5. **Wire Step A -> Step B -> Step C inside [`Tichu::stNextPlayer()`](file:///Users/brohlfs/git/tichu/tichu.game.php#L1511-L1521)**:
   ```php
   if ($lastComboPlayer == $next) {
     if (method_exists($this, "triggerArmedDelayedBombIfAny") && $this->triggerArmedDelayedBombIfAny($lastCombo)) {
       $this->stNextPlayer();
       return;
     }
     $dragon = $lastCombo->hasDragon();
     $this->gamestate->changeActivePlayer($lastComboPlayer);
     if ($this->shouldAutoConfirmTrick((int) $lastComboPlayer, $handCounts, $dragon)) {
       $transition = $this->resolveTrickCollection((int) $lastComboPlayer, $dragon);
       $this->gamestate->nextState($transition);
       if ($transition === "chooseDragonGift") {
         $this->giveExtraTime($lastComboPlayer);
       }
       return;
     }
     LogManager::insert($lastComboPlayer, "confirm", ["nextPlayer" => $next, "dragon" => $dragon]);
     $this->gamestate->nextState("confirmTrick");
     $this->giveExtraTime($lastComboPlayer);
   }
   ```

---

## 6. Verification Checklist & Regression Tests

- [ ] **Integration Tests ([`local/integration-tests.php`](file:///Users/brohlfs/git/tichu/local/integration-tests.php))** — add `test_turn_based_confirm_trick_autoskip_and_delayed_bomb()`:
  1. Turn-based + opponents `< 4` cards + non-Dragon trick -> skips `ST_CONFIRM_TRICK`, increments `tricks_win` by `1`, clears `AUTOPASS_TRICK`, emits `captureCards`, lands in `playComboOpen` for trick 2 (`Test 9` Part B with 4 cards each stays green in `confirmTrick`).
  2. Turn-based + opponents `< 4` cards + winner `< 4` cards + Dragon won -> skips `ST_CONFIRM_TRICK` directly to `ST_CHOOSE_DRAGON_GIFT` (`80`), keeps `tricks_win` unchanged until `chooseDragonGift()`; verify Dragon with winner `>= 4` cards pauses in `ST_CONFIRM_TRICK` and zombie winner auto-skipped to `chooseDragonGift` resolves cleanly (`#808761`).
  3. Turn-based + opponent `>= 4` cards (no armed delayed bomb) -> stops in `ST_CONFIRM_TRICK` (zero info leak); real-time + `< 4` cards -> stops in `ST_CONFIRM_TRICK`.
  4. Turn-based + Plan 08 armed delayed bomb -> `triggerArmedDelayedBombIfAny()` fires in FIFO order _before_ auto-skip, checks bomber going out, and skips weaker obsolete armed bombs.
- [ ] **Unit Tests ([`tests/`](file:///Users/brohlfs/git/tichu/tests))**: Add pure unit test for `shouldAutoConfirmTrick` covering empty hands, `3` vs `4` cards, Dragon with `< 4` vs `>= 4` winner cards, and real-time vs turn-based.
- [ ] **Concurrency (`npm run test:race`)**: Verify zero `tricks_win` double-increments, zero stuck games, and zero unexpected exceptions across mixed real-time/`turnBased` (`30%`) 8-worker fuzzing + `collect x4 (+autopass)`.
- [ ] **Full Gate**: `npm run build`, `npm run test:contracts`, `npm run phpstan`, and local/Studio `window.tt` turn-based verification (`playCombo` -> `captureCards` sweep -> `playComboOpen`).

---

## 7. BGA Ticket Closure & Kickoff Prompt

- **Ticket Closure Policy (Post-Production Deploy Only — STRICTLY READ-ONLY by Default)**:
  - **NEVER** submit `/bug/bug/report.html`, click `Post comment`, or change ticket status on `boardgamearena.com` without **explicit user approval**.
  - Transition [`#217733`](https://boardgamearena.com/bug?id=217733) (`acknowledged` -> `deploysuggestion` on Studio build -> `implemented` after prod deploy) **only once BOTH Plan 08 (`armDelayedBomb`) AND Plan 09 (`ST_CONFIRM_TRICK` auto-skip + `triggerArmedDelayedBombIfAny()`) are live in production**.
  - **Plain-Text BGA Reply Draft (English only; NO Markdown backticks)**:
    ```text
    Implemented in release <YYMMDD-HHMM> (now live). In turn-based games you can now arm a delayed bomb without leaking information if you pass, and tricks where no opponent holds 4 or more cards are automatically collected (while keeping the interactive Dragon gift choice). Refreshing the page (F5) loads the update — thanks for the suggestion!
    ```

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/.agents/skills/tichu-concurrency-locks/SKILL.md, /Users/brohlfs/git/tichu/states.inc.php, /Users/brohlfs/git/tichu/tichu.game.php (`stNextPlayer`, `collect`, `completePlayCombo`, `chooseDragonGift`, `stNewTrick`), and /Users/brohlfs/git/tichu/plans/09-turn-based-confirm-trick-smart-autoskip.md.
Confirm with the user: (1) Option A (`< 4` cards per other player in turn-based mode, vs Option B) and whether to preserve self-Dragon-bombing when the Dragon winner holds `>= 4` cards, and (2) whether Plan 08 (`triggerArmedDelayedBombIfAny` / `armDelayedBomb`) is already merged or should be guarded via `method_exists`.
Implement Steps 1–5 with shared `resolveTrickCollection()`, add regression tests in `local/integration-tests.php` and `tests/`, and run `npm run build`, `npm run test:contracts`, `npm run phpstan`, and `npm run test:race`.
```
