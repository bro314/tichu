# 03 — Layout Stability (Anti-Jump Status & Action Bar) and Dedicated Mahjong 'No Wish' Button

- **Priority**: P1
- **Recommended Roadmap Day**: Day 2
- **Scope**: `tichu.css`, `src/elements/tichu-action-bar.ts`, `src/tichu.ts`, `src/elements/tichu-value-choice.ts`, `tests/combo-validator.test.ts` (audited read-only: `src/elements/game-model.ts`, `local/css/bga-shim.css`, `tichu.game.php`, `tichu.action.php`, `states.inc.php`)
- **Open BGA Tickets / Prod Issues Covered**:
  - [`#204088`](https://boardgamearena.com/bug?id=204088) (`2` votes, `acknowledged` — canonical for duplicate tickets [`#204090`](https://boardgamearena.com/bug?id=204090), [`#202049`](https://boardgamearena.com/bug?id=202049), and [`#95606`](https://boardgamearena.com/bug?id=95606))
  - [`#25627`](https://boardgamearena.com/bug?id=25627) (`7` votes, `acknowledged`)
  - [`#119164`](https://boardgamearena.com/bug?id=119164) (`4` votes, `acknowledged` — **button-shift half only**; the optional Tichu/Grand Tichu confirmation preference `106` half belongs to Plan 06)
- **Estimated Effort**: Small–Medium (~0.5 day; pure CSS + Lit/TS UI + unit/browser tests, zero PHP/DB changes)
- **Dependencies & Shared ID Reservations**: Coordinates cleanly with **Plan 06** (owns `$game_preferences[106]` Tichu confirmation and the confirm-pref half of `#119164`, plus mobile viewport responsive breakpoints) and **Plan 08** (owns `#106651` persistent `#myPlayBomb` visibility on own turn and `armDelayedBomb` / `cancelDelayedBomb` `actionlog` events). Plan 03 consumes **zero** new preference, stat, global, or `actionlog` IDs.

---

## 1. Why & Goal

Three high-friction UI hazards trigger misclicks on every Tichu table:

1. **Vertical `#page-title` bounce on every play (`#204088`)**: BGA alternates `#maintitlebar_content` between 1-line `#gameaction_status_wrap` (`"Updating game situation..."`) and 1–2 line `#pagemaintitle_wrap` state prompts/action buttons, bouncing `#game_play_area_wrap` up and down ~22–44px on every turn and pass (especially severe on mobile and touch devices).
2. **Horizontal action-bar button shift (`#119164`, button-shift half)**: Inside `<tichu-action-bar>`, `#buttons` uses `display: flex` with `min-width` + `.space1` / `.space2` (`flex-grow`) and conditionally mounts `#myPlayBomb`, `#myMakeTichuBet`, and `#myPassTrick`. When `#myPlayBomb` disappears (on bomb click or turn start) or `#play_button` / `#pass_trick_button` changes width, `#myMakeTichuBet` slides horizontally under the cursor and catches accidental double-clicks.
3. **Hidden Mahjong `"No wish"` option (`#25627`)**: `ST_MAHJONG_PLAY` only renders `"Make a wish"` (`#chooseWish`), forcing players to hunt for an unlabeled, unintuitive icon tile (`val = 15`) inside the 7x2 grid to decline wishing.

Goal: Lock `#page-title` and `<tichu-action-bar>` geometry across all states/turns on desktop and mobile, and add a 1-click `"No wish"` button next to `"Make a wish"` plus clear `"No wish"` labeling on tile `15`.

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| Surface                                                                                                                                                        | Verified Symbols & Lines                                                                                                                                                                                           | Root Cause / Current Behavior                                                                                                                                                                                                                                                                                                                                                                                 |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`tichu.css`](file:///Users/brohlfs/git/tichu/tichu.css)                                                                                                       | `#page-title` (`L144–154`, `L759–770`), `#buttons` (`L253–305`)                                                                                                                                                    | Sets `box-sizing: border-box; margin: 0 10px 10px 10px; display: block` on `#page-title` with **no** `min-height` on `#maintitlebar_content` or `#gameaction_status_wrap` override; `.experimentalArchiveMode #page-title` hides it (`display: none`).                                                                                                                                                        |
| [`gameserver.css`](file:///Users/brohlfs/git/tichu/bga-platform/css/gameserver.css) / [`bga-shim.css`](file:///Users/brohlfs/git/tichu/local/css/bga-shim.css) | `#page-title` (`gameserver.css:L630–673`, `bga-shim.css:L468–519`), `.roundedbox` (`common.css:L10415–10419`, `bga-shim.css:L362–371`), `#gotonexttable_wrap` / `#undo_button` (`gameserver.css:L484–489,698–718`) | Base BGA styles set `line-height: 32px`, `#gameaction_status_wrap, #maintitlebar_content { min-height: 42px }`, `.roundedbox { padding: 5px }`, and `@media (hover: none)` button margins `8px 0`. `ly_studio.js:L23771–23813` toggles inline `display: none/block` between `#pagemaintitle_wrap` and `#gameaction_status_wrap`, snapping between `52px` (1 line) and `74px–104px` (2 lines / touch buttons). |
| [`tichu-action-bar.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-action-bar.ts)                                                                      | `#buttons` CSS (`L45–93`), `render()` (`L212–267`), `render*Content()` (`L292–429`)                                                                                                                                | Uses `display: flex` with `.space1` (`flex-grow: 1`), `.space2` (`flex-grow: 1.6`), and `min-width` (`150/150/150/100/100px`) on `#play_button`, `#pass_button`, `#pass_trick_button`, `#bomb_button`, `#tichu_button`. Hiding `#myPlayBomb` (`showBomb`), hiding `#myPassTrick`, or changing `#myPlayCombo` label changes flex widths and shifts `#myMakeTichuBet` horizontally.                             |
| [`tichu.ts`](file:///Users/brohlfs/git/tichu/src/tichu.ts)                                                                                                     | `onUpdateActionButtons` (`L1078–1080`), `onMakeAWish` (`L1419–1431`), `rescale` (`L1246–1275`)                                                                                                                     | `case "mahjongPlay"` adds only `addActionButton("chooseWish", _("Make a wish"), "onMakeAWish")`. `onMakeAWish` requires a tile in `selectedMahjongWish$` (`null` shows error toast). `rescale()` sets `#game_play_area` width `900..1200px` (`widthMin = 900`).                                                                                                                                               |
| [`tichu-value-choice.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-value-choice.ts)                                                                  | `MAHJONG_VALUES` (`L9`), `#mahjong` CSS (`L40–63`), `renderMahjong` (`L107–134`)                                                                                                                                   | Renders `14` items (`2..15`) in a `7x2` grid (`70x105px` from `560x210` `img/tichu-icons-table.png`); tile `#mahjong_item_15` (`col=6, row=1`) has **no** `title`, `aria-label`, or `"No wish"` caption.                                                                                                                                                                                                      |
| [`game-model.ts`](file:///Users/brohlfs/git/tichu/src/elements/game-model.ts)                                                                                  | `selectedMahjongWish$` (`L108,168,282`), `enterMahjongPlay` (`L746–751`), `setMahjongWish` (`L1179–1189`)                                                                                                          | Already tracks and clears `selectedMahjongWish` cleanly and normalizes `wish === 15` to `mahjongWish: 0`. No model edits needed.                                                                                                                                                                                                                                                                              |
| [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php) / [`tichu.action.php`](file:///Users/brohlfs/git/tichu/tichu.action.php)                    | `makeAWish` (`tichu.game.php:L1099–1127`, `tichu.action.php:L68–74`)                                                                                                                                               | Backend `makeAWish($wish)` already validates `2..15` under `acquireGameLockOrFail()` and handles `wish === 15` cleanly (`"has no wish"` log + `nextState("nextPlayer")`).                                                                                                                                                                                                                                     |

---

## 3. Architectural Decisions & Trade-offs

1. **How to stabilize `#page-title` without breaking BGA inline visibility toggles, dark mode, or turn-based float icons**:
   - **Recommended (Option A)**: Reserve height on `#maintitlebar_content` (`min-height: 70px` desktop at `line-height: 28px`, rising to `min-height: 92px` under `@media (max-width: 760px)` / `.mobile_version`), reset `#page-title #gameaction_status_wrap { min-height: 0; }`, tighten `@media (hover: none)` `#page-title .bgabutton` vertical margins from `8px` to `3px`, and use `align-content: center` on block `#maintitlebar_content` (keeping `#page-title { display: block }`).
   - **Rejected (Option B)**: Putting `display: flex` on `#page-title`, `#maintitlebar_content`, `#pagemaintitle_wrap`, or `#gameaction_status_wrap`. `ly_studio.js:L23771–23812` toggles `display: none/block` inline on the two inner wraps, and `display: flex` on `#maintitlebar_content` breaks `float: right` on BGA's `#gotonexttable_wrap`, `#undo_button`, and `#redo_button` (`gameserver.css:L484–489,698–718`). Block-level `align-content: center` centers vertically in Chrome/Safari/Firefox while keeping `float: right` and `.experimentalArchiveMode #page-title { display: none }` intact.
   - _BGA UX Alignment_: Matches official Studio UI guidelines (zero layout shift between active/waiting/AJAX states) and keeps `var(--game-palette-bga-gray-244)` untouched for `html[data-theme="dark"]` / `html.dark`.

2. **How to eliminate horizontal shift in `<tichu-action-bar>` (`#119164`) while coordinating with Plan 08 (`#106651`)**:
   - **Recommended (Option A)**: Replace `#buttons`'s `display: flex` + `min-width` + `.space1`/`.space2` grow spacers with a **7-column CSS Grid** on desktop (`grid-template-columns: 180px 160px 170px minmax(12px, 1fr) 130px 105px minmax(12px, 1.6fr); gap: 10px; align-items: center;`) where every button slot (`#play_button`, `#pass_button`, `#pass_trick_button`, `#bomb_button`, `#tichu_button`) always occupies its fixed track even when empty (and `.bgabutton` clips long localized labels cleanly with `text-overflow: ellipsis` via `min-width: 0` on slots). Below `760px` (if Plan 06 enables narrow `#game_play_area`), switch `#buttons` to a 2-row fixed-track Grid keeping `#bomb_button` and `#tichu_button` in dedicated fixed tracks on row 2. Also update `tichu.css:L253–305` light-DOM fallback selectors for parity.
   - **Rejected (Option B)**: Rendering a hidden dummy `visibility: hidden` `<a id="myPlayBomb">` when `showBomb` is false. Pollutes `#myPlayBomb` DOM presence assertions (`bga-shim.js:L4117`) and still lets `#play_button` / `#pass_trick_button` label changes push `#myMakeTichuBet` horizontally. Fixed Grid tracks guarantee 0px shift now AND seamlessly host Plan 08's persistent `#myPlayBomb` (`#106651`).

3. **Dedicated `"No wish"` UX (`#25627`)**:
   - **Recommended (Option A)**: Add `noWish_button` (`_("No wish")`, gray secondary BGA style) right after `chooseWish` (`_("Make a wish")`) in `src/tichu.ts` (`case "mahjongPlay"`), calling `onNoWish()` -> `checkAction("makeAWish")` -> `takeAction("makeAWish", { wish: 15 })` in 1 click. Simultaneously add `title`, `aria-label`, and a visible `"No wish"` caption overlay inside `#mahjong_item_15` in `tichu-value-choice.ts` while preserving tile `15` + `"Make a wish"` compatibility.
   - **Rejected (Option B)**: Removing `15` from `MAHJONG_VALUES` and breaking the `7x2` (`7+7`) sprite grid (`AGENTS.md` invariant) or auto-submitting on every tile click (which removes accidental-click safety on ranked wishes).

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

- **1. `OLD DB -> NEW PHP + NEW JS`**: No DB schema, `states.inc.php`, `gameoptions.inc.php`, `stats.inc.php`, or `global` ID changes. Running tables load the updated CSS/JS cleanly on refresh and reuse existing `ST_MAHJONG_PLAY` (`65`) and `makeAWish(15)`.
- **2. `OLD open JS tab <-> NEW PHP`**: Zero PHP changes (`tichu.game.php`, `tichu.action.php`, `NotificationManager.php` untouched). Old tabs remain 100% compatible.
- **3. `NEW open JS tab <-> OLD PHP` (rollback)**: New `#noWish_button` submits `makeAWish` with `{ wish: 15 }`, which `tichu.game.php:L1105–1112` has supported since initial release. Fixed CSS Grid and `#maintitlebar_content` `min-height` are pure presentation and require zero backend support.
- **4. `NEW DB / actionlog -> OLD PHP + OLD JS` (rollback)**: No new DB columns, globals, or `actionlog` event names (`mahjongWish` `["wish" => 15]` is unchanged).
- **Concurrency & Locking Invariants**: `onNoWish()` routes through `takeAction("makeAWish", { wish: 15 })` (`lock: true`), guarded server-side by `$this->acquireGameLockOrFail()` (`tichu.game.php:L1101`) + `$this->checkAction("makeAWish")`. No out-of-turn action changes.
- **`@thoun` `player_pass` Reset, `<tichu-replay>`, `local/import-bug-sql.php`, & Studio Safety**:
  - `makeAWish(15)` transitions to `ST_NEXT_PLAYER`, where `@thoun` `player_pass` autopass evaluation executes identically to `wish=2..14`.
  - `<tichu-replay>` processes existing `wishMade` notifications (`tichu-replay.ts:L480–482`); `import-bug-sql.php` 7 surfaces require zero changes.
  - All edits live in `tichu.css` and `src/*.ts` -> `tichu.js`; `workspace.blocked-files` and `npm run test:contracts` rules are strictly preserved.

---

## 5. Step-by-Step Implementation Blueprint

1. **Stabilize `#page-title` across desktop, touch, and mobile ([`tichu.css`](file:///Users/brohlfs/git/tichu/tichu.css#L144-L154))**:
   - Keep `#page-title { display: block; box-sizing: border-box; margin: 0px 10px 10px 10px; border-radius: var(--border-radius); box-shadow: none; }` and `.experimentalArchiveMode #page-title { display: none; }` (`L768–770`), without overriding `background-color` or `color` (preserves `var(--game-palette-bga-gray-244)` in `html[data-theme="dark"]` / `html.dark`).
   - Add rules targeting `#maintitlebar_content` and `#gameaction_status_wrap` (loaded after `gameserver.css` and `local/css/bga-shim.css`, overriding `min-height: 42px` cleanly):
     - `#maintitlebar_content`: `min-height: 70px; box-sizing: border-box; padding: 2px 6px; line-height: 28px; align-content: center;`
     - `#page-title #pagemaintitletext, #page-title #gameaction_status`: `line-height: 28px;`
     - `#page-title #gameaction_status_wrap`: `min-height: 0;`
     - `#page-title .action-button, #page-title .bgabutton`: `margin-top: 2px; margin-bottom: 2px; vertical-align: middle;`
     - `@media (hover: none) { #page-title .action-button, #page-title .bgabutton { margin-top: 3px; margin-bottom: 3px; } }`
     - `@media (max-width: 760px), (hover: none)` and `.mobile_version #maintitlebar_content`: `min-height: 92px;` (absorbs 3-line narrow-screen wraps + buttons cleanly).
   - Verify `#page-title.fixed-page-title` (`L150–154`) and `ly_studio.js:L22305–22325` `adaptStatusBar()` keep `#after-page-title` synced with zero scroll jump.

2. **Lock button slot geometry in `<tichu-action-bar>` ([`tichu-action-bar.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-action-bar.ts#L45-L93))**:
   - Replace `#buttons` flex rules (`L45–93`) with deterministic CSS Grid tracks so hiding `#myPlayBomb`, hiding `#myPassTrick`, or changing `#myPlayCombo` text cannot shift `#myMakeTichuBet`:
     - `#buttons`: `padding: 10px 15px 10px 15px; min-height: 32px; box-sizing: content-box; display: grid; grid-template-columns: 180px 160px 170px minmax(8px, 1fr) 130px 105px minmax(8px, 1.6fr); column-gap: 10px; align-items: center; background-color: var(--bg-color-lighter); box-shadow: var(--elevation);`
     - `#buttons > div`: `min-width: 0;` (prevents long i18n labels from stretching grid columns past their reserved px track).
     - Explicit track placement (matching DOM order in `L231–264`): `#play_button` (col 1), `#pass_button` (col 2), `#pass_trick_button` (col 3), `.space1` (col 4), `#bomb_button` (col 5, `min-height: 30px`), `#tichu_button` (col 6, `min-height: 30px`), `.space2` (col 7). Remove obsolete `margin-left: 10px` / `margin-right: 15px` and variable `min-width` overrides from `#bomb_button`, `#play_button`, `#pass_button`, `#pass_trick_button`, `#tichu_button`.
     - Add `@media (max-width: 760px)` responsive 2-row Grid fallback (`grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 8px;` with `#bomb_button { grid-column: 1; grid-row: 2; }` and `#tichu_button { grid-column: 2; grid-row: 2; }`, `.space1, .space2 { display: none; }`) for future Plan 06 narrow viewports.
   - Mirror the updated `#buttons` grid rules in [`tichu.css`](file:///Users/brohlfs/git/tichu/tichu.css#L253-L305) for consistency.

3. **Add one-click `"No wish"` action button ([`src/tichu.ts`](file:///Users/brohlfs/git/tichu/src/tichu.ts#L1078-L1080))**:
   - In `onUpdateActionButtons()` under `case "mahjongPlay":` (`L1078–1080`), register `noWish_button` right after `chooseWish`:
     ```ts
     case "mahjongPlay":
       this.addActionButton("chooseWish", _("Make a wish"), "onMakeAWish");
       this.addActionButton("noWish_button", _("No wish"), "onNoWish", undefined, false, "gray");
       break;
     ```
   - Add `onNoWish(evt?: Event)` alongside `onMakeAWish(evt?: Event)` (`L1419–1431`):
     - `evt?.preventDefault?.(); evt?.stopPropagation?.();`
     - Guard with `if (!this.checkAction("makeAWish")) return;`
     - Clear `window.gameModel?.setSelectedMahjongWish(null);`
     - Call `this.takeAction("makeAWish", { wish: 15 });`
   - In `onMakeAWish()`, also guard with `if (!this.checkAction("makeAWish")) return;` before validating `selectedMahjongWish !== null`. Pass literal `"No wish"` only to `_()` so BGA's translation extractor picks it up (`&dummyTranslations` safe).

4. **Polish tile `15` and accessibility inside `<tichu-value-choice>` ([`src/elements/tichu-value-choice.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-value-choice.ts#L107-L134))**:
   - Keep `MAHJONG_VALUES = [2..15]` and `#mahjong` `grid-template-columns: repeat(7, 70px)` (`L9, L41–42`).
   - Add a static rank-label map using literal `t(...)` entries for `11..14` (`t("Jack")`, `t("Queen")`, `t("King")`, `t("Ace")`) and `15` (`t("No wish")`) — zero dynamic string concatenation inside `t()`.
   - On each `#mahjong_item_${val}` tile (`L119–128`): bind `role="button"`, `tabindex="0"`, `aria-label`, `title`, and keyboard `Enter`/Space trigger calling `onMahjongClick(val)`.
   - Inside `#mahjong_item_15` (`val === 15`), render `<span class="mahjong-no-wish-label">${t("No wish")}</span>` positioned cleanly at the bottom of the `70x105` card (`position: absolute; bottom: 4px; left: 3px; right: 3px; font-size: 11px; line-height: 1.15; font-weight: 700; text-align: center; background: rgba(255, 255, 255, 0.92); color: #1f2328; border-radius: 3px; padding: 2px;`) so high-contrast dark text on light badge stays legible in all themes and dark mode.

---

## 6. Verification Checklist & Regression Tests

- **Node/TS Runtime & Validator Tests (`npm run test:validator`)**: Add tests in [`tests/combo-validator.test.ts`](file:///Users/brohlfs/git/tichu/tests/combo-validator.test.ts) using `withMockLitEnv` + `loadTichuAdapterForNodeTests()`:
  1. Entering `mahjongPlay` calls `addActionButton` for both `"chooseWish"` and `"noWish_button"` (`"gray"`).
  2. Clicking/calling `onNoWish()` invokes `takeAction("makeAWish", { wish: 15 })` and resets `gameModel.getState().selectedMahjongWish` to `null`; calling `onMakeAWish()` after selecting tile `15` still sends `{ wish: 15 }`.
  3. `<tichu-value-choice>` renders `#mahjong_item_15` with `"No wish"` label/accessible attributes, and `<tichu-action-bar>` preserves `#bomb_button` and `#tichu_button` grid wrappers across `showBomb = true/false`.
- **Backend PHP & Contract Verification**:
  - Verify [`local/integration-tests.php`](file:///Users/brohlfs/git/tichu/local/integration-tests.php#L382) (`test_mahjong_lead_wish_creation_enforcement_and_fulfillment`) also asserts `makeAWish(['wish' => 15])` keeps `mahjongWish === 0` and records `actionlog`.
  - Run `npm run build` (`npm test` + `tsc` + `esbuild` bundle), `npm run test:contracts`, and `npm run phpstan` (`npm run test:race` is N/A as PHP locking/state transitions are unchanged).
- **Local & Studio Browser Verification (`window.tt` + Playwright bounding-box checks)**:
  - On `npm run local` (and Studio with `"Use minified JS"` / `"Use minified CSS"` ON, followed by clicking `"Revert"` on both):
    - Measure `document.getElementById("page-title").getBoundingClientRect().height` and `#game_play_area_wrap` `rect.top` across `playComboOpen`, `playCombo`, `chooseDragonGift`, `confirmTrick`, and simulated `"Updating game situation..."` (`#pagemaintitle_wrap` hidden / `#gameaction_status_wrap` shown) at `1280x900` and `375x667` -> `0px` vertical jump on desktop.
    - Measure `#myMakeTichuBet` `rect.left` in `<tichu-action-bar>` before vs. after `showBomb` flips (`playCombo` inactive -> `playBomb` -> `playCombo` active) -> `0px` horizontal drift (`Math.abs(before.left - after.left) === 0`).
    - Load `mahjong_wish` scenario, play Mahjong, verify `#chooseWish` and `#noWish_button` both appear, click `#noWish_button`, confirm `mahjongWish === 0` and transition to `playCombo`.
    - Inspect `&dummyTranslations` (all new UI labels wrapped in `«»`) and `html[data-theme="dark"]` contrast.

---

## 7. BGA Ticket Closure & Kickoff Prompt

> [!CAUTION]
> Never post on `boardgamearena.com`, change ticket statuses, or build/deploy a production release without explicit user confirmation first.

### Proposed Post-Deploy BGA Updates (Plain Text, No Backticks)

- **[`#204088`](https://boardgamearena.com/bug?id=204088)** (`acknowledged` -> `implemented`; `#204090`, `#202049`, `#95606` already linked as `duplicate`):
  > Implemented in release <YYMMDD-HHMM> (now live). Reserved a consistent minimum height on the top status bar across turn prompts, action buttons, and "Updating game situation..." updates on both desktop and mobile so the play area no longer bounces between plays. Refreshing the page (F5) applies the updated layout — thanks again for the detailed reports!
- **[`#25627`](https://boardgamearena.com/bug?id=25627)** (`acknowledged` -> `implemented`):
  > Implemented in release <YYMMDD-HHMM> (now live). Added a dedicated "No wish" button right next to "Make a wish" in the top action bar for one-click declining, and clearly labeled the "No wish" tile in the Mahjong grid. Refreshing the page (F5) enables the new button — thanks for the suggestion!
- **[`#119164`](https://boardgamearena.com/bug?id=119164)** (keep `acknowledged` until Plan 06 ships confirmation preference `106`, posting a progress update to refresh `lastUpdateDate`; transition to `implemented` after Plan 06 deploys):
  > Progress update in release <YYMMDD-HHMM>: the bottom action bar now uses fixed column widths so hiding "Play a Bomb" or changing action labels never shifts the "Tichu" button under your cursor. Keeping this ticket open while we finish the optional Tichu / Grand Tichu confirmation setting.

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/.agents/skills/bga-release-and-qa/SKILL.md, /Users/brohlfs/git/tichu/tichu.css, /Users/brohlfs/git/tichu/src/elements/tichu-action-bar.ts, /Users/brohlfs/git/tichu/src/tichu.ts, /Users/brohlfs/git/tichu/src/elements/tichu-value-choice.ts, and Plan 03 (`03-layout-stability-anti-jump-and-mahjong-no-wish.md`).
Implement Steps 1-4 cleanly (no PHP/DB changes, no new preferences/stats/globals):
1. Stabilize `#maintitlebar_content` / `#gameaction_status_wrap` min-height and touch margins in `tichu.css` without breaking dark mode, `.experimentalArchiveMode`, or floated turn-based/undo controls.
2. Convert `<tichu-action-bar>` `#buttons` to deterministic CSS Grid tracks so `#myMakeTichuBet` never shifts horizontally when `#myPlayBomb` or `#myPassTrick` hides.
3. Add `noWish_button` ("No wish") next to `chooseWish` in `src/tichu.ts` (`mahjongPlay`) calling `makeAWish` with `wish: 15`, and add accessible `"No wish"` labeling on `#mahjong_item_15` in `tichu-value-choice.ts`.
4. Add unit/runtime tests in `tests/combo-validator.test.ts` (and `wish=15` check in `local/integration-tests.php`), then run `npm run build`, `npm run test:contracts`, `npm run phpstan`, and verify desktop/mobile bounding boxes, dark mode, and `&dummyTranslations` on `npm run local` and Studio (`Use minified JS/CSS` + `Revert`). Do not post on BGA or release to prod without explicit approval.
```
