# 03 — Mobile Viewport Compliance & Responsive 14-Card Hand

> [!NOTE]
> **Implemented locally (2026-11-28)**: Updated with `"min" => 360`, Square Table default (`Pref 100 = 2`), `< 760px` `.responsive-compact` (`352px` floor), compact `<tichu-last-played>` / `<tichu-pass-area>` / `<tichu-trick-modal>`, fluid `cqi` `<tichu-value-choice>` & `<tichu-played-cards>`, pre-play single-row `<tichu-action-bar>`, `0.75×` full-width `<tichu-hand>` / `<tichu-stock>`, and a `<= 720px` `"2 rows"` toggle (`#toggle_hand_rows`, defaulting to 1 row), plus mobile-only backend `"Tichu"` confirmation (`tichuBet` `confirm: 1`). Pending BGA Studio sync (`Reload game informations` + `Reload game options configuration`) and multi-viewport Studio QA before production deploy.

- **Status**: **Implemented locally** (`2026-11-28`) — pending Studio QA & release
- **Priority**: P1
- **Impact**: **High** — Fixes a live BGA platform spec violation (`min => 920` outside `[320, 740]`), eliminates unusable `0.4x` zoom on phones/tablets, reclaims `250px` dead right margin on every viewport, eliminates horizontal overflow (`375px–1440px`), and closes open ticket `#164400`.
- **Complexity**: **High** — `tichu-stock.ts` (`1,243` LOC) now implements 1D pointer drag-to-reorder (`DRAG_DEADZONE_PX = 16`), `GROUP_GAP_PX = 22`, clickable middle `button.group-stripe-bar` overlays, and `reserveFooter` (`34px`) passed-card avatars; 2-row wrapping must coordinate cleanly with all of them, with `<tichu-action-bar>`'s anti-jump 6-col invariant (`#119164`), and with `<tichu-pass-area>`'s avatars/banner/HUD + `getSlotCardTargetRect()`.
- **Sequencing**: Refreshed from former Plan `04`. Shares `<tichu-trick-modal>` mobile width updates with **Plan 06** (if Plan 06 modernizes `<tichu-trick-modal>` to `<dialog closedby="any">` first, Plan 03 gets mobile width automatically).
- **Scope**: `gameinfos.inc.php`, `src/tichu.ts`, `tichu.css`, `src/elements/tichu-hand.ts`, `src/elements/tichu-action-bar.ts`, `src/elements/tichu-stock.ts`, `src/elements/tichu-last-played.ts`, `src/elements/tichu-pass-area.ts`, `src/elements/tichu-value-choice.ts`, `src/elements/tichu-trick-modal.ts`, `src/elements/tichu-played-cards.ts`, `tests/combo-validator.test.ts`
- **Open BGA Tickets Covered**:
  - [#164400](https://boardgamearena.com/bug?id=164400) (1 vote, `acknowledged` — _"Add 2nd row (cards in hand)"_, narrowed to automatic responsive 2-row hand wrapping on narrow viewports)
- **Already Shipped Chrome/Hand Items (Removed from Scope)**:
  - `#257135` (`implemented`, closed `2026-11-24`): `<h3>My hand</h3>` removal & spectator/`gameEnd` `<tichu-action-bar>` suppression (`ab32fe5`), `<tichu-settings-modal>` replacing `#prefs`/`#themes` (`e7a76b0`), `#settings_button` + `#concede_button` `.hand-corner-controls` (`de62e72`, `5e186ff`), and `#hand-organize-bar` (`3f88c97`, `f3fa2bc`). _(Optional housekeeping: prune dead legacy selectors `#themes`, `a.themelink`, `#prefs`, `#clockwise`, `#counterClockwise`, `#expReplay` from `tichu.css`.)_
- **Shared ID Reservations**: Claims **zero** new `$game_preferences`, `$game_options`, `stats`, `global`, or `actionlog` IDs.

---

## 1. Why & Goal

Four responsive layout defects block mobile/tablet playability:

1. **BGA Viewport Spec Violation & `0.4x` Micro-Shrinking**: `gameinfos.inc.php:79` sets `"min" => 920` outside BGA's `[320, 740]` bounds, forcing `920px` virtual mobile viewports and triggering `mobile_version` below `1160px`, while `Tichu::rescale()` (`src/tichu.ts:1424-1453`) scales `widthMin = 900` down to `0.4x` (`40x60px` cards).
2. **Wasted `250px` Right Margin & Narrow Control Collisions**: `tichu-hand.ts:140-151` & `tichu.css:488-491` still reserve `margin: 15px 250px 6px 15px` on `#myhand` and `margin: 4px 250px 0 15px` on `#hand-organize-bar`; `#myhandwrap` hides only for `isSpectator`, not `stateName === "gameEnd" && hand.length === 0`. Meanwhile `<tichu-action-bar>`'s 6-col CSS Grid (`tichu-action-bar.ts:43-63`) sums to `~724px+`, overflowing `< 760px` once `rescale()` stops zooming out.
3. **Cramped Single-Row 14-Card Hand (`#164400`)**: `TichuStock` (`src/elements/tichu-stock.ts`) locks `#stock` to a single `display: flex; height: var(--stock-height, 150px);` line (`17px` slices on phones).
4. **Hardcoded Desktop Widths**: Fixed pixel widths in `<tichu-pass-area>`, `<tichu-last-played>`, `<tichu-value-choice>`, `<tichu-trick-modal>`, and `<tichu-played-cards>` overflow `375px`, `500px`, and `740px` viewports.

**Goal**: Make Tichu BGA-compliant (`min => 500`), zero-overflow across `375px–1440px`, with true `1x` CSS responsiveness below `760px`, reclaimed hand width, and automatic 2-row 14-card hands that preserve Plan 05's drag-reorder, group stripes, passed-card avatars, and WAAPI/FLIP animations.

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| File & Verified Lines                                                   | Current Behavior / Root Issue                                                                                                                                                                                                                                                                                                      |
| :---------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gameinfos.inc.php:74-80` (`L79`)                                       | `"game_interface_width" => ["min" => 920]` violates `[320, 740]` spec.                                                                                                                                                                                                                                                             |
| `src/tichu.ts:1424-1453` (`rescale`)                                    | `ResizeObserver` scales `widthMin = 900` (`1000` replay) down to `0.4` unconditionally; `tichu.css:403-412` sets `#game_play_area { width: 900px; }`.                                                                                                                                                                              |
| `src/elements/tichu-action-bar.ts:43-112`                               | Fixed 6-col CSS Grid (`repeat(3, minmax(130px, 160px)) minmax(24px, 1fr) repeat(2, minmax(130px, 160px))`, min ~`724px`). `tests/combo-validator.test.ts:3812-3816` forbids `max-width: 760px` 2-row fallback / `.space2` to protect Bomb/Tichu anti-jump (`#119164`).                                                             |
| `src/elements/tichu-hand.ts:140-151, 601-778`                           | `#myhand` & `#hand-organize-bar` reserve `250px` right margin (`min-height: 184px` for `reserveFooter`); `.hand-corner-controls` holds `#concede_button` & `#settings_button`; `#myhandwrap` hides only for `isSpectator`.                                                                                                         |
| `src/elements/tichu-stock.ts` (`1,243` LOC)                             | Single-row flex `#stock` (`L337-341`), `computeMarginRightPx()` (`L641-668`, `12%–60%`), FLIP `updated()` (`L555` `100 * this.scale`), plus `DRAG_DEADZONE_PX = 16`, 1D `computeDropTarget` (`L840-1049`), `GROUP_GAP_PX = 22`, `computeGroupStripes()` (`L194-245`), and `reserveFooter` (`34px`).                                |
| `src/elements/tichu-last-played.ts:80-88, 174-214, 486-494`             | `.squareTable` tracks sum `890px+` (`minmax(200px, ...)`); `.last-played-player` (`140px`) + `.last-played-combo` (`300px`); table `<tichu-stock>` hardcodes `scale = 0.75`.                                                                                                                                                       |
| `src/elements/tichu-pass-area.ts:36-77, 137-202, 545-557`               | `#playertables` hardcodes `width: 560px`; `.playertable` `140x248px` (`PASS_SLOT_CARD_OFFSET_Y = 84`, `40px` avatars, `.reopen-banner`), `scale = 1.0`, `getSlotCardTargetRect()` hardcoded `100/150 * zoom`, and absolute `<tichu-status roundOnly>` (`top: 0; right: 15px`) that will overlap `.playertable_3` on narrow widths. |
| `src/elements/tichu-value-choice.ts:42-58, 172, 210`                    | `#mahjong` uses `repeat(7, 70px)` (`580px+`) with inline `-${col * 70}px -${row * 105}px`.                                                                                                                                                                                                                                         |
| `src/elements/tichu-trick-modal.ts:30-40, 67-73`, `tichu.css:1007-1009` | Legacy `min-width: 540px` / `500px` / `width: 500px` without `wrapRows`.                                                                                                                                                                                                                                                           |
| `src/elements/tichu-played-cards.ts:46-49, 76-86`                       | `"Remaining Cards"` fixes `--w: 40px; --h: 60px; margin: 3px` (`~644px`).                                                                                                                                                                                                                                                          |

---

## 3. Architectural Decisions & Trade-offs

1. **BGA `game_interface_width.min` & `rescale()` Breakpoint**:
   - Set `'min' => 500` in `gameinfos.inc.php:79`. In `Tichu::rescale()`, keep `widthMin = 900` (`factor >= 1.0` clears transform at `>= 900px`, gentle `0.84..1.0` at `760..899px`), and **disable `transform: scale` below `760px`** (`transform = ""`, `gameElement.style.width = "100%"`, toggle `.responsive-compact` on `#game_play_area`) so `375px–759px` uses true `1x` CSS layout with `>= 44px` tap targets. Keep `widthMin = 1000` scaling when `experimentalArchiveModeEnabled` is true.
2. **Action-Bar Anti-Jump Reconciliation `< 760px`**:
   - Current fixed 6-col Grid (`~724px`) cannot fit `375px` unscaled, while `tests/combo-validator.test.ts:3812-3816` forbids reverting to a `max-width: 760px` 2-row fallback / `.space2` because Bomb/Tichu must never jump horizontally.
   - **Recommended**: Keep the 6-column Grid structure everywhere (or scale grid `minmax(0, ...)` tracks proportionally inside `.responsive-compact` below `720px` with compact horizontal padding / icon+short-label sizing, preserving Play/Pass in cols `1–3`, spacer col `4`, Bomb col `5`, Tichu col `6` in one stable row where possible, and tightening `< 480px` cleanly without dropping columns out of fixed slots). Update the unit test assertion only for the new intentional compact-grid rule.
3. **2-Row 14-Card `<tichu-stock>` Coordinating with Drag-Reorder, Groups & Footers (`#164400`)**:
   - Add `@property({ type: Boolean }) wrapRows = false` on `<tichu-stock>` (enabled on `#myhand` and `<tichu-trick-modal>`).
   - When `wrapRows && cards.length >= 8` and single-row slice `< 42 * effectiveScale` (`< ~640px`), split into 2 centered `.stock-row` flex rows (`row1Count = Math.ceil(cards.length / 2)`, `effectiveScale = width < 420 ? Math.min(this.scale, 0.85) : this.scale`, `row-gap` & `padding-top` accounting for `-20px` selection lift + `reserveFooter` `34px` avatars).
   - **Plan 05 compatibility requirements**:
     - `computeGroupStripes()` must split or compute per-row stripe segments independently for Row 1 (`0..row1Count-1`) and Row 2 (`row1Count..N-1`) so a group spanning the row boundary draws cleanly on both rows instead of stretching across empty row space.
     - Pointer drag (`computeDropTarget`) must resolve `(pointerX, pointerY)` to Row 1 vs Row 2 midpoints (supporting cross-row drags cleanly) and keep `DRAG_DEADZONE_PX = 16`.
     - `TichuStock::updated()` FLIP `baseWidth` (`L555`) must use `100 * effectiveScale` (instead of `100 * this.scale`) so `zoomFactor` stays `1.0` when `effectiveScale === 0.85`.
4. **All String Labels**: Pass single static quoted literals directly to global `_("...")` (never `t(...)`, enforced by `npm run test:contracts`).

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

- **4-Way Live-Game Safety**: Pure metadata (`gameinfos.inc.php`) + frontend bundle/CSS release. Zero PHP, DB, `states.inc.php`, `global`, `stats`, `prefs`, or `actionlog` changes.
- **Locks, `@thoun` Autopass, Replay & Studio Safety**: Zero server action changes; `experimentalArchiveModeEnabled` keeps `1000px` scaling in `rescale()`; `html[data-theme="dark"]` via CSS custom properties (no `:host-context()`, no `filter: drop-shadow` on cards for Safari).

---

## 5. Step-by-Step Implementation Blueprint

1. **Viewport Spec & `rescale()` Split (`gameinfos.inc.php:79`, `src/tichu.ts:1424-1453`, `tichu.css:403-412`)**:
   - Set `"min" => 500` in `gameinfos.inc.php:79`.
   - In `Tichu::rescale()`, if `!this.experimentalArchiveModeEnabled && widthAvailable < 760`, clear `areaWrapElement.style.transform` & `transformOrigin`, set `gameElement.style.width = "100%"`, and toggle `.responsive-compact` on `#game_play_area`. Update `#game_play_area` CSS to `width: 100%; max-width: 1200px;` under `.responsive-compact` / `@media (max-width: 760px)`.
2. **Reclaim Hand Margin & Narrow Action Bar (`tichu-hand.ts:140-151, 601-778`, `tichu-action-bar.ts:43-112`, `tichu.css:488-491`)**:
   - Reclaim `#myhand` and `#hand-organize-bar` `250px` right margin (`margin: 12px 16px 6px;`), ensuring `.hand-corner-controls` (`#concede_button`, `#settings_button`) flow cleanly below/beside `#hand-organize-bar` without colliding with cards or controls on `375px–759px`.
   - Hide `#myhandwrap` when `this.isSpectator || (this.stateName === "gameEnd" && this.hand.length === 0)` (keeping settings accessible via `.spectator-settings-bar` or equivalent).
   - Adapt `<tichu-action-bar>` `.responsive-compact` / `@container` / `@media` column tracks below `724px` (`minmax(0, ...)` instead of fixed `130px` minimums) while preserving single-row slot stability (`#bomb_button` col 5, `#tichu_button` col 6).
3. **2-Row `<tichu-stock>` (`src/elements/tichu-stock.ts`)**:
   - Implement `wrapRows` + `computeLayout()` (`twoRows`, `row1Count`, `effectiveScale`, `marginRight`), per-row `.stock-row` rendering, per-row `computeGroupStripes()` segments, 2D `(pointerX, pointerY)` `computeDropTarget()` for `reorderable` drags, `reserveFooter` clearance, and `100 * effectiveScale` FLIP `baseWidth`. Enable `.wrapRows=${true}` in `tichu-hand.ts` and `tichu-trick-modal.ts`.
4. **Fluid Pass Area & Last-Played Table (`tichu-pass-area.ts`, `tichu-last-played.ts`)**:
   - `tichu-pass-area.ts`: Replace `width: 560px` with `width: 100%; max-width: 560px;`, add `ResizeObserver` `slotScale` for `.playertable` + `<tichu-card .scale=${slotScale}>`, handle `<tichu-status roundOnly>` (`L36-43`) placement cleanly without overlapping `.playertable_3` at `< 560px`, preserve `.reopen-banner` (`01abc63`) & `40px` avatars, and measure `.playertablecard` rect directly in `getSlotCardTargetRect()` (`L545-557`).
   - `tichu-last-played.ts`: Add `ResizeObserver` setting `.compact` (`< 640px`) / `.narrow` (`< 440px`), `minmax(0, ...)` `.squareTable` tracks at `640px–899px`, 2-col diamond `< 640px` (respecting `.clockwise`), 1-col `< 440px`, fluid `.last-played-combo` / `.last-played-player`, and `0.62` combo `<tichu-stock>` scale `< 560px`.
5. **Fluid Pickers, Remaining Cards & Trick Modal (`tichu-value-choice.ts`, `tichu-played-cards.ts`, `tichu-trick-modal.ts`)**:
   - `tichu-value-choice.ts`: Use CSS `--choice-w: clamp(42px, 11vw, 70px); --choice-h: calc(var(--choice-w) * 1.5);`, scaling `background-size` and `--col`/`--row` offsets so 7 columns fit `375px` (`318px`).
   - `tichu-played-cards.ts`: Use `--w: clamp(21px, 5.5vw, 40px); --h: calc(var(--w) * 1.5); margin: clamp(1px, 0.5vw, 3px);` (`350px` at `375px`).
   - `tichu-trick-modal.ts`: Set `width: min(560px, 92vw); min-width: 0;` + `wrapRows=${true}` (or defer to Plan 06's `<dialog closedby="any">` rewrite if done together).

---

## 6. Verification Checklist & Regression Tests

- [ ] **TS Runtime Tests (`tests/combo-validator.test.ts` via `npm run test:validator`)**: `<tichu-stock>` 2-row layout (`375px`/`500px`/`740px`/`900px`), multi-row `computeGroupStripes()`, 2D `computeDropTarget()` drag across rows, FLIP `baseWidth === 100 * effectiveScale`, `Tichu::rescale()` `< 760px` vs `>= 760px` vs replay mode, and compact action-bar tests.
- [ ] **Local Multi-Viewport Browser Checks (`npm run local`)**: Verify `375x667`, `500x800`, `740x900`, `1280x900` across `grandTichuBets`, `giveCards`, `playCombo` (14-card 2-row hand + drag-reorder + groups + selection), `mahjongPlay`, `phoenixPlay`, `trickModalOpen`, spectator, `gameEnd`, and `html[data-theme="dark"]` (`scrollWidth <= clientWidth`, `tt.assertUI()`).
- [ ] **Full Gate & Studio**: `npm run build && npm run test:contracts && npm run phpstan`, then Studio `Reload game informations` + `Use minified JS/CSS` check.

---

## 7. BGA Ticket Closure Draft (`#164400`)

> **NEVER** post comments or change BGA ticket status without explicit user approval after production deploy!

- **#164400** (`acknowledged` -> `implemented`):
  - `Implemented in release <YYMMDD-HHMM> (now live). On narrower screens and viewports where 14 cards would feel cramped, your hand now automatically wraps into two balanced, centered rows with clear row spacing so selected cards stay easy to tap. Refreshing the page (F5) loads the update — thanks for the suggestion!`
