# 04 — Client Combo Validator & Smart Play UX

- **Priority**: P1 (Massive gameplay UX improvement — eliminates guesswork, wasted round-trips, and accidental rule breaks)
- **Scope**: New `src/elements/combo-validator.ts` (+ Vitest/Node unit tests), `tichu.game.php` + `NotificationManager.php` (`lastCombo` payload), `src/types/tichu-contracts.ts`, `src/elements/game-model.ts`, `src/elements/tichu-action-bar.ts`, `src/elements/tichu-hand.ts`
- **Estimated Effort**: Large (Full faithful port of `Combo.php` + `Hand.php` wish/beat helpers + reactive UI integration)
- **Dependencies / Sibling Interactions**: Uses typed contracts from [01](file:///Users/brohlfs/git/tichu/plans/01-static-contracts-phpstan-and-ci.md); interacts closely with [00](file:///Users/brohlfs/git/tichu/plans/00-live-bugs-and-bga-compliance-fixes.md) (selection retention) and [09 — Bomb Staging & Preselect UX](file:///Users/brohlfs/git/tichu/plans/09-bomb-staging-and-preselect-ux.md).

---

## 1. Why & Goal

Currently, `#myPlayCombo` in `src/elements/tichu-action-bar.ts` is a static `"Play selected cards"` button whenever any `>= 1` card is selected. The client **has no idea** whether the player's selected cards form a legal Tichu combo, whether they beat the current trick's `lastCombo`, or whether they satisfy an active Mahjong wish! Players only discover invalid plays after a full server round-trip exception banner.

Other flagship BGA climbing/card games (`Odin`, `Velonimo`, `Scout`, `The Crew`, `Solo`, `Papayoo`) run **live client-side move validation**:

1. **Dynamic Play Button & Live Combo Preview**: `#myPlayCombo` disables cleanly with a specific reason (e.g. `"Invalid combo"`, `"Must beat King"`, `"Must play wished 7"`) or reads `"Play Full House (Kings over 4s)"` / `"Play Straight of 6"` when legal.
2. **Mahjong Wish Helper & Pass Guard**: Highlights hand cards matching the active wish and warns/blocks passing if `Hand::canFulFillWish` is true on the client.
3. **"Finish Your Hand in One Play!" Safeguard (`Odin` pattern)**: When the player's entire remaining hand (selected or unselected) forms a single legal beating combo (or they selected almost everything and can go out right now), alert them or auto-suggest / confirm before making an obvious suboptimal partial play.

---

## 2. Open-Source BGA References

- **`Odin`** (modern climbing/shedding BGA repo): Live client validation disabling invalid play buttons with localized reason text + _"You can finish your hand in one play!"_ safeguard prompt.
- **`Velonimo` & `Papayoo`**: Dynamic button labeling showing the exact recognized combination name before clicking Play; suit/rank legal-card highlighting.
- **Tichu's own authoritative backend (`modules/Combo.php`, `modules/Hand.php`, `tests/ComboTest.php`, `tests/HandTest.php`)**: Already has exhaustive, unit-tested edge-case logic (Phoenix ambiguous full houses `[7,7,8,8,Ph]` -> Full House 8s or 7s; Phoenix in stairs `[5,5,6,6,7,Ph]`; Phoenix as `1.5` vs `lastCard + 0.5`; Mahjong `1` in straights `[MJ,2,3,4,5]`; 4-of-a-kind & straight-flush bombs beating normal combos AND weaker bombs; Dragon as `15` unmatchable by Phoenix).

---

## 3. Current State in Tichu

- **Server (`modules/Combo.php`, `modules/Hand.php`)**: Full PHP validator + `canBeat()` + `canFulFillWish()`. Note: `lastCombo` sent via `getAllDatas()` / `notif_playCombo` currently prioritizes display strings/cards; we must verify whether structured `{ type, cards, phoenixValue, rank, length }` is always included in `gamedatas`, `argPlayCombo`, and `notif_playCombo` (critical when Phoenix was resolved in `ST_PHOENIX_PLAY`!).
- **Client (`src/elements/utils.ts`)**: Already contains a partial `hasBomb()` helper (`utils.ts`), proving client-side card analysis started incrementally.
- **Client (`src/elements/tichu-action-bar.ts`)**: `#myPlayCombo` uses static label `"Play selected cards"`. Selection count alone enables/disables it (`selectedCards.length > 0`).

---

## 4. Decisions & Alternatives for You

1. **Full Client `Combo.php` + `Hand.php` Port vs. Server-Hint RPC**:
   - **Option A (Recommended)**: Port `Combo.php` + the wish/bomb/beating helpers of `Hand.php` into pure, zero-DOM TypeScript (`src/elements/combo-validator.ts`) and cross-test it against **every single test fixture** in `tests/ComboTest.php` and `tests/HandTest.php`! Instant 0ms feedback as you click every card, works offline/while hovering, and enables [Plan 09](file:///Users/brohlfs/git/tichu/plans/09-bomb-staging-and-preselect-ux.md) pre-select/bomb staging.
   - **Option B**: Call a light read-only AJAX endpoint on selection change. _Rejected_ — 50–300ms network lag per card click spams BGA servers and feels sluggish.
2. **Hard-disable vs. Clickable-with-hint on Invalid Selection**:
   - **Option A (Recommended)**: Disable `#myPlayCombo` (`class="disabled"` + descriptive reason label or tooltip, e.g., `"Play (Select valid combo)"` / `"Doesn't beat Pair of Jacks"`) **except** make sure a quick toggle or never silently block an edge case if validator disagrees — wait: since we cross-test 100% of `ComboTest.php` + `HandTest.php` fixtures in TypeScript, parity is exact; still keep a tiny fallback escape or unit-test parity script (`check-validator-parity`) so client can never falsely block a legal server play!
   - **Option B**: Keep button enabled, show warning badge only. _Alternative_ if you prefer letting players click and receive server `UserException`, though disabling + clear label is much cleaner UX.
3. **Pass Guard when Mahjong Wish Can Be Fulfilled**:
   - **Option A (Recommended)**: If active `mahjongWish` (`2..14`) can be legally played over `lastCombo` (checked via client `canFulFillWish(hand, lastCombo, wish)`), highlight wished-rank cards in hand with a subtle golden outline and disable/warn on Pass (`"Must fulfill wish (${rank})"`) with tooltip explaining why.

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Audit `Combo.php` & `Hand.php` + Expose Structured `lastCombo` on Server

- Read `modules/Combo.php`, `modules/Hand.php`, `tichu.game.php` (`getAllDatas`, `argPlayCombo`), and `NotificationManager.php` (`playCombo`, `playBomb`, `phoenixValue`).
- Ensure the client always receives canonical `LastComboState`: `{ playerId, type, cards, phoenixValue: number | null, length: number, value: number }` in `getAllDatas()`, `argPlayCombo()`, and `notif_playCombo` / `notif_playBomb` (especially after `ST_PHOENIX_PLAY` chooses the Phoenix rank!).
- Update `src/types/tichu-contracts.ts` and `GameModel` (`lastComboState$`) without breaking existing `lastPlayed$` card rendering or live games (additive fields only).

### Step 2: Implement Pure TS `src/elements/combo-validator.ts`

- Mirror `modules/Constants.php` combo constants (`SINGLE_COMBO`, `PAIR_COMBO`, `STAIRS_COMBO`, `TRIO_COMBO`, `FULL_HOUSE_COMBO`, `STRAIGHT_COMBO`, `BOMB_4_COMBO`, `BOMB_STRAIGHT_COMBO`, `DOG_COMBO`) and `modules/Combo.php`:
  - `analyzeCombo(cards, lastCombo, isLead)`: returns `{ valid, type, value, length, ambiguousPhoenixValues?: number[], description, reasonIfInvalid? }`.
  - `canBeatCombo(candidate, currentLastCombo)`: mirrors `Combo::canBeat()` including Phoenix `1.5` / `lastValue + 0.5`, Dragon `15` > Phoenix `14.5`, bombs beating all non-bombs and comparing bomb rank/length (`straight bomb length > straight bomb rank > 4-of-a-kind`).
  - `canFulFillWish(handCards, lastCombo, wishRank)` & `findPlayableWishCombos(...)`: mirrors `Hand::canFulFillWish()`.
  - `canFinishHandInOnePlay(handCards, selectedCards, lastCombo, wishRank)`: detects if _all_ `handCards` form a legal beating combo (respecting wish if any).

### Step 3: Port All PHPUnit Fixtures to Automated TS Parity Tests

- Export JSON test vectors (or mirror all cases from `tests/ComboTest.php` and `tests/HandTest.php`) and run them via Node's built-in `node --test` (available in Node 22 with zero extra test runner deps, or compiled alongside `tsc`) in `package.json` (`test:validator`).
- Guarantee 100% parity on Dragon/Phoenix/Mahjong/Dog, ambiguous Phoenix full house & stairs, straight bombs vs 4-card bombs, and Mahjong wish edge cases.

### Step 4: Wire Dynamic Action Bar & Hand Highlights

- In `src/elements/tichu-action-bar.ts`:
  - Derive live `selectionValidation$` via RxJS `combineLatest([selectedCards$, handCards$, lastComboState$, mahjongWish$, isMyTurn$])`.
  - Update `#myPlayCombo` text & disabled state dynamically (using translatable templates `t(...)`, e.g., `"Play Pair of Queens"`, `"Play Bomb!"`, `"Select valid combo"`, `"Must play wished 9"`).
  - When `canFinishHandInOnePlay` is true and the player selected a strict subset that leaves cards behind (ignoring Dog/pointless edge cases), show an `Odin`-style non-intrusive confirm prompt (`confirmationDialog` or inline 2-click banner): `"Your whole hand is a legal play — finish in one play?"`.
  - Visually disable `#myPass` when `mahjongWish` must be fulfilled (or show `"Must fulfill wish"`), and add a subtle highlight class (`.wish-match`) in `<tichu-hand>` / `<tichu-card>` on cards matching the active wish rank.

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **Ambiguous Phoenix Edge Case**: Do NOT prematurely guess Phoenix value on the client when `[6,6,7,7,Ph]` or `[5,6,7,8,Ph]` has two valid interpretations — recognize it as **valid (ambiguous)** so `#myPlayCombo` enables cleanly (`"Play Full House"` / `"Play Straight of 5"`), then let the server enter `ST_PHOENIX_PLAY` `<tichu-value-choice>` as usual! (Just verify at least _one_ possible `phoenixValue` beats `lastCombo` and fulfills `mahjongWish` if active.)
- **Live-Game Additive Compatibility**: Existing running tables won't fail if `lastComboState` arrives only on new actions — `getAllDatas()` reconstructs it from `LogManager::getLastCombo()` cleanly for active games too.
- **Sibling Plans**: Once `combo-validator.ts` exists, [09 — Bomb Staging & Preselect UX](file:///Users/brohlfs/git/tichu/plans/09-bomb-staging-and-preselect-ux.md) uses `analyzeCombo` / `isBomb` directly for zero-round-trip bomb staging and pre-selection! Also update `src/elements/utils.ts`'s existing `hasBomb()` to share logic rather than duplicate.

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] `npm run test:validator` executes full `ComboTest` + `HandTest` parity suite in TS and passes 100%.
- [ ] `npm run build` and `npm test` (PHPUnit + MySQL 8.0 integration) pass.
- [ ] Locally (`npm run local`), test: single vs higher single, Phoenix over Ace (illegal over Dragon!), Dog only on lead, Mahjong wish preventing illegal Pass and highlighting wished cards in hand, ambiguous Phoenix straight enabling Play, and `"finish in one play"` trigger.
- [ ] Check translations: all new dynamic labels use literal translatable templates (`_("...")` / `format_string` compatible).

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/modules/Combo.php, /Users/brohlfs/git/tichu/modules/Hand.php, and /Users/brohlfs/git/tichu/plans/04-client-combo-validator-and-smart-play-ux.md.
Confirm Section 4 decisions with the user (or use Recommended Option A defaults) and implement Steps 1–4 cleanly with zero duplicated logic.
Verify parity with a TS unit test suite matching `tests/ComboTest.php` and `tests/HandTest.php`, run `npm run build` and `npm test`, and test live edge cases on `npm run local`.
```
