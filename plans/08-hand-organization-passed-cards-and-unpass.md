# 08 — Hand Organization, Passed Cards UX & Unpass

- **Priority**: P1/P2 (Major quality-of-life upgrade during passing and hand management — combines 3 tightly connected `<tichu-hand>` / `<tichu-stock>` / `ST_GIVE_CARDS` improvements)
- **Scope**: `src/elements/tichu-stock.ts`, `src/elements/tichu-hand.ts`, `src/elements/tichu-card.ts`, `src/elements/tichu-pass-area.ts`, `src/tichu.ts`, `tichu.game.php`, `tichu.action.php`, `modules/managers/CardManager.php`, `modules/managers/NotificationManager.php`, `local/race-tests.php`
- **Estimated Effort**: Medium–Large (3 synergistic sub-features inside the hand & passing lifecycle)
- **Dependencies / Sibling Interactions**: Reuses `sortMode="preserve"` already present in `tichu-stock.ts` and FLIP/localStorage prefs from [03](file:///Users/brohlfs/git/tichu/plans/03-zero-reload-preferences-and-two-way-sync.md)/[05](file:///Users/brohlfs/git/tichu/plans/05-flip-card-flight-animations.md); coordinates with [14](file:///Users/brohlfs/git/tichu/plans/14-modern-bga-backend-autowired-actions-and-namespaces.md) if `unpassCards` action is added before autowiring.

---

## 1. Why & Goal

In live physical Tichu, players immediately rearrange their 14 cards into planned combos (e.g., setting aside their Straight or Full House on the left, keeping singles/Dog on the right), track **which 3 cards just arrived from Partner vs Left vs Right** at the start of the trick phase, and often wish they could retract their 3 passed cards while waiting for a slow tablemate.

Currently in Tichu:

1. `<tichu-stock>` already supports `sortMode="preserve"`, **but has no pointer drag-to-reorder or grouping**, AND card selection is locked (`0`) during `ST_GRAND_TICHU_BETS` even after a player has already placed their bet!
2. Once `acceptCards` completes, the 3 received cards vanish seamlessly into the hand with **zero visual marker or sender tooltip** showing which card came from Partner vs Left vs Right.
3. Once a player clicks Pass Cards in `ST_GIVE_CARDS`, they cannot take them back even if other players haven't passed yet.

Goal: Deliver a physical-table-grade hand & passing experience:

- **Sub-feature A — Custom Hand Organization & Early Selection**: Pointer drag-to-reorder in `<tichu-stock>` (switching smoothly into `"preserve"` custom order) + optional `Velonimo`-style `[Group]` colored combo brackets + unlock card selection right after placing your Grand Tichu bet so you can start organizing your 8 cards immediately.
- **Sub-feature B — Newly-Received Passed Card Indicators (`Papayoo` pattern)**: Show a subtle `.receivedCard` badge/pulse for ~5 seconds (and a persistent hover tooltip / subtle corner indicator like `From Partner` / `From Left` / `From Right` for the round or until played!).
- **Sub-feature C — `unpassCards` in `ST_GIVE_CARDS`**: Allow retracting passed cards safely under `acquireGameLock()` while `ST_GIVE_CARDS` is still active (`acceptCardsForAllPlayers` hasn't fired yet).

---

## 2. Open-Source BGA References

- **`Odin` & `Velonimo` (BGA climbing/card games)**:
  - Smooth pointer drag-to-reorder on hand cards with live gap insertion indicator (`pointerdown` + `pointermove` + `pointerup` with movement threshold `> 6px` so clicks still select/deselect cards cleanly!).
  - `Velonimo` additionally lets players group selected cards with subtle colored top/bottom brackets `[Group]` so planned Straights/Full Houses stay visually separated even without dragging.
- **`Papayoo` & `Hearts`**: `.receivedCard` pulsing outline/highlight on cards received from passing, fading after a few seconds plus hover tooltip naming the sender (`"Passed by Partner"`).
- **BGA `multipleactiveplayer` retract pattern (`7 Wonders`, `Sushi Go!`)**: Un-passing sets the player back to multiactive (`setPlayersMultiactive`) ONLY inside the same serialized lock protecting the transition check (`isPlayerActive` / `checkPossibleActions`).

---

## 3. Current State in Tichu

- **`src/elements/tichu-stock.ts`**: Already implements `sortMode: "rank" | "color" | "preserve"`, selection (`selectedIds`), and overlap calculation.
- **`src/elements/tichu-hand.ts:154` (selection mode)**: Currently returns selection mode `0` across all of `ST_GRAND_TICHU_BETS`, preventing players who already bet from organizing their 8 cards while waiting on opponents.
- **`card` table (`dbmodel.sql`)**: Already has **`card_passed_from`** column populated during `ST_GIVE_CARDS`! That means `CardManager` / `getAllDatas()` already knows who passed each card (check whether `card_passed_from` stays set or gets cleared in `acceptCardsForAllPlayers()`!).
- **`tichu.game.php` (`giveTheCards` / `acceptCardsForAllPlayers`)**: Uses `acquireGameLock()` + `checkMultiactiveActionFresh()` + `setPlayerNonMultiactiveSafe($player_id, 'acceptCards')` with `GLOBAL_LOCK_VERSION = 30`.

---

## 4. Decisions & Alternatives for You

1. **Hand Organization UX (`Drag-to-reorder` vs `[Group]` brackets vs Both)**:
   - **Option A (Recommended)**: Implement **pointer drag-to-reorder** in `<tichu-stock>` (switching automatically into `sortMode = "preserve"` with a visual `"Custom"` sort pill alongside `"Rank"` / `"Suit"`) PLUS unlock card selection during `ST_GRAND_TICHU_BETS` once the player has already placed their Grand Tichu bet. Keep `Velonimo`-style `[Group]` colored combo tags optional or follow-up if drag-reorder already satisfies planned combos.
   - **Option B**: Add both drag-to-reorder AND `[Group]` colored underline brackets in one pass.
2. **Duration of Passed-Card Indicator (`receivedCard`)**:
   - **Option A (Recommended)**: Clear glowing badge + border pulse for 5 seconds on `acceptCards`, PLUS a persistent subtle corner dot/initial (`P` / `L` / `R` or tiny colored dot + rich tooltip `"Passed by <PartnerName>"`) throughout the round (hidden only if toggleable or once played) — super helpful mid-round when players ask _"wait, did my partner give me that Ace or did Left?"_.
   - **Option B**: Fade out completely after 5 seconds (`Papayoo` exact behavior).
3. **`unpassCards` Concurrency Safety (`ST_GIVE_CARDS`)**:
   - **Option A (Recommended)**: Only allow `unpassCards` while `ST_GIVE_CARDS` (`40`) is still the active state AND the player is currently inactive (`isPlayerActive($player_id)` is false). Inside `acquireGameLock()`: call `$this->checkPossibleActions('unpassCards')` (Wait: note `checkAction` fails if the player is NOT active! Check BGA `Table::checkPossibleActions` vs custom state check + `isPlayerMultiactive`!). Move the 3 cards in `temporary` (`card_passed_from = $player_id`) back to `$player_id`'s `hand`, clear `card_passed_from`, reactivate player via `$this->gamestate->setPlayersMultiactive([$player_id], '')`, and notify player privately + `updatePlayerStatus` publicly!
   - **Option B**: Skip `unpassCards` if you prefer committed passes without takebacks. (Easy to omit cleanly since Sub-feature C is modular!)

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Pointer Drag-to-Reorder & Post-Bet Selection (`tichu-stock.ts` & `tichu-hand.ts`)

- In `src/elements/tichu-stock.ts`:
  - Add pointer event handlers (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) with a **6px deadzone** so normal taps/clicks toggle card selection cleanly while horizontal drags > 6px lift the dragged `<tichu-card>`, shift neighboring cards smoothly to preview the drop index, and commit a new `customOrder: number[]` switching `sortMode` to `"preserve"`.
  - Add a `"Custom"` indicator/reset button in `tichu-hand.ts` next to Sort by Rank / Suit (and preserve `customOrder` nicely as new cards arrive in the 6-card deal by appending or inserting sorted at the end).
  - In `tichu-hand.ts` (`getSelectionMode()`): when state is `grandTichuBets` (`30`) and the current player is **no longer active** (already placed their bet), return selection mode `2` (multi-select) so they can sort/drag/pre-plan their 8 cards while waiting!

### Step 2: Passed-Card Visual Indicator & Tooltip (`tichu-card.ts` & `CardManager.php`)

- Inspect `CardManager.php` & `tichu.game.php` (`acceptCardsForAllPlayers`, `getAllDatas`) to check if `card_passed_from` stays on the card row until captured/end-of-round (or if cleared during accept, keep `card_passed_from` until `dealCards` / `captured`!).
- Pass `passedFrom?: { playerId: number; role: "partner" | "left" | "right"; playerName: string }` cleanly inside `getAllDatas()` and `notif_acceptCards` -> `GameModel` (NEVER expose to opponents!).
- In `<tichu-card>`: render `.receivedCard` pulse animation (`5s`) on arrival, optional subtle `P`/`L`/`R` micro-pill, and always append `"Passed by Partner (Alice)"` to the card tooltip (`title` + `aria-label`!).

### Step 3: `unpassCards` Action & Concurrency Lock (`tichu.game.php`, `tichu.action.php`, `tichu-pass-area.ts`)

- Inspect `tichu.game.php` `giveTheCards` and `acquireGameLock()` + `local/race-tests.php`.
- Add `ST_GIVE_CARDS` possible action `"unpassCards"` in `states.inc.php` (NO new state ID!) and endpoint `unpassCards()` in `tichu.action.php` calling `$this->game->unpassCards()`.
- Implement `Tichu::unpassCards()`:
  - Check state ID === `ST_GIVE_CARDS` (`40`) using `gamestate->state_id()` and verify `acquireGameLock()` succeeds.
  - Re-verify under lock that state is STILL `ST_GIVE_CARDS` (`40`) and `!$this->gamestate->isPlayerActive($player_id)` and exactly 3 cards exist with `card_location = 'temporary'` AND `card_passed_from = $player_id` (if the 4th player just finished while our request waited on the lock, throw crisp `UserException(self::_("All players have already passed their cards"))`!).
  - Move those 3 cards back to `hand` of `$player_id`, clear `card_passed_from = NULL`, call `$this->gamestate->setPlayersMultiactive([$player_id], '')`, send private `unpassCards` notification (moving cards out of pass boxes back to hand) + public `passReadyChanged` / status update so pass box slots revert from "Passed" to "Waiting".
- Render an `"Undo Pass"` (`#myUnpass`) button in `<tichu-action-bar>` / `<tichu-pass-area>` while `ST_GIVE_CARDS` is active and `!isCurrentPlayerActive`.

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **`acceptCards` vs `unpassCards` Race**: This is the exact race condition Tichu's `acquireGameLock()` (`GLOBAL_LOCK_VERSION = 30`) was built for! Add a new race scenario to **`local/race-tests.php`** spawning concurrent `giveTheCards` (4th player) vs `unpassCards` (1st player) to prove `SERIALIZABLE` + `acquireGameLock()` guarantees either clean `UserException` OR clean reversal — never lost cards or stuck multiactive state!
- **Secret Info Leak Check**: Double-check `getAllDatas()` and `unpassCards` public notifications NEVER reveal card IDs/ranks/suits of passed cards to other players (only `player_id` ready/unready boolean).
- **Drag vs Touch Scroll Conflict**: On touch devices, use `touch-action: pan-y` on `#myhand` or require a brief press/horizontal lock (`|dx| > |dy|`) so vertical page scrolling doesn't trigger accidental card drags.
- **Sibling Plans**: Update `src/types/tichu-contracts.ts` ([Plan 01](file:///Users/brohlfs/git/tichu/plans/01-static-contracts-phpstan-and-ci.md)) for `unpassCards` and `passedFrom`; coordinate tooltip/`aria-label` in [Plan 12](file:///Users/brohlfs/git/tichu/plans/12-logs-accessibility-sounds-and-stats.md); if [Plan 14](file:///Users/brohlfs/git/tichu/plans/14-modern-bga-backend-autowired-actions-and-namespaces.md) runs later, migrate `unpassCards` to `#[CheckAction(false)] public function actUnpassCards()`.

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] Pointer drag reorders cards smoothly in `<tichu-stock>` on mouse & touch without interfering with click-to-select; `sortMode` switches to `"preserve"`.
- [ ] Waiting player in `ST_GRAND_TICHU_BETS` can select & drag-reorder their initial 8 cards immediately after betting.
- [ ] Received passed cards flash cleanly on accept and display `"Passed by ..."` tooltip/indicator cleanly for recipient only.
- [ ] Clicking `"Undo Pass"` in `ST_GIVE_CARDS` returns all 3 cards cleanly back to hand; simultaneous 4th-player pass vs `unpassCards` passes a new test in `npm run test:race` cleanly!
- [ ] `npm run build`, `npm test`, and `npm run test:race` all pass.

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/tichu.game.php, /Users/brohlfs/git/tichu/src/elements/tichu-stock.ts, /Users/brohlfs/git/tichu/src/elements/tichu-hand.ts, and /Users/brohlfs/git/tichu/plans/08-hand-organization-passed-cards-and-unpass.md.
Confirm Section 4 decisions with the user (especially drag vs [Group] brackets and whether to keep persistent P/L/R badge) and implement Steps 1–3.
Add a concurrency test in `local/race-tests.php` for `unpassCards` vs 4th-player `giveTheCards`, then run `npm run build`, `npm test`, and `npm run test:race`.
```
