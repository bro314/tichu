# 06 — Mobile Viewport & 14-Card Hand Layout

- **Priority**: P1 (Fixes BGA `gameinfos` policy violation + solves Tichu's #1 mobile/tablet playability issue)
- **Scope**: `gameinfos.inc.php`, `src/tichu.ts` (`rescale()`), `tichu.css`, `src/elements/tichu-hand.ts`, `src/elements/tichu-stock.ts`, `src/elements/tichu-last-played.ts`, `src/elements/tichu-card.ts`
- **Estimated Effort**: Medium (Responsive CSS + `<tichu-stock>` layout/overlap logic + manual multi-viewport testing)
- **Dependencies / Sibling Interactions**: Should check against [03](file:///Users/brohlfs/git/tichu/plans/03-zero-reload-preferences-and-two-way-sync.md) (layout pref `100` toggling live) and [05](file:///Users/brohlfs/git/tichu/plans/05-flip-card-flight-animations.md) (`DOMRect` compatibility).

---

## 1. Why & Goal

Two structural layout bugs hold Tichu back on phones, tablets, and split-screen browsers:

1. **BGA `game_interface_width.min` Spec Violation**: `gameinfos.inc.php:79` currently sets `'min' => 920`! Official BGA guidelines (documented in Studio & `claude-code-bga`) require `game_interface_width.min` to be between **`320` and `740`** so mobile users aren't forced to zoom out to tiny unreadable 0.4x thumbnails.
2. **Cramped 14-Card Hand & Hardcoded Margins**: `tichu.css` / `src/elements/tichu-hand.ts:35-38` hardcodes `#myhand { margin: 15px 250px 25px 15px; }` — eating **250px** horizontally for the side preference controls even on small screens! Meanwhile `rescale()` in `src/tichu.ts` scales `#game_play_area_wrap` down as low as `0.4`, shrinking card click targets below ergonomic touch sizes (`< 44px`), whereas `<tichu-stock>` only lays cards out in a single horizontal strip.

Goal: Make Tichu genuinely playable and BGA-compliant down to narrow viewports (`375px` mobile / `740px` tablet) while preserving crisp desktop ergonomics.

---

## 2. Open-Source BGA References

- **Official BGA Mobile Guidelines (`gameinfos.inc.php` / `claude-code-bga/guidelines.md`)**: `game_interface_width.min` must be `320..740`; responsive CSS `@media` / container queries are strongly preferred over full-board `transform: scale(0.4)` zoom-outs.
- **`thoun/bga-cards` (`HandStock` / responsive overlap & fan)**: Exposes `--hand-stock-middle-index` CSS custom properties for optional gentle fan arc and automatically tightens card overlap or splits cleanly when width constrains cards.
- **`Papayoo` / `The Crew` / `Coinche`**: Responsive 2-row hand wrapping on narrow mobile widths + collapsing auxiliary toolbars (`#prefs`, `#themes`) into a toggleable popover/drawer on mobile instead of reserving 250px right margin permanently.

---

## 3. Current State in Tichu

- `gameinfos.inc.php:78-81`:
  ```php
  'game_interface_width' => array(
      'min' => 920,
      'max' => null
  ),
  ```
- `src/tichu.ts`: `rescale()` targets a fixed `900x800` desktop stage (`factor >= 0.4`), scaling the entire `#game_play_area_wrap` CSS transform down on narrow panes (making text/cards tiny on phones).
- `src/elements/tichu-hand.ts:35-38`: `#myhand { margin: 15px 250px 25px 15px; min-height: 150px; }`. Right sidebar (`#prefs`, `#themes`, Sort buttons) sits statically alongside `#myhand`, reserving `250px` unconditionally.
- `src/elements/tichu-stock.ts`: Already has a `ResizeObserver` `dynamicOverlap` setting overlap between `12%` and `60%` of card width, in a single horizontal flex/block strip.

---

## 4. Decisions & Alternatives for You

1. **BGA `game_interface_width.min` target**:
   - **Option A (Recommended)**: Set `'min' => 740` first if keeping `#game_play_area_wrap` table scaling cleanly at `>= 740px`, OR go straight to `'min' => 500` / `360` with full `@media (max-width: 760px)` responsive stacking! Going to **`500`** (with responsive CSS below `760px` so desktop `>= 900px` stays pixel-identical!) gives both full BGA compliance and dramatically better mobile scaling (`~0.75x` vs `0.4x`).
2. **How to fit 14 cards cleanly on small screens**:
   - **Option A (Recommended)**: Keep single-row `dynamicOverlap` when card overlap stays comfortable (`<= 58%` visible face >= `42px`), and automatically switch `<tichu-stock>` into a **clean 2-row wrapped hand** (`flex-wrap: wrap` with slight vertical row overlap like `-45px` or responsive `--card-scale: 0.85`) when container width drops below a 14-card comfort threshold (~`< 640px`), AND collapse `#prefs`/`#themes` below or behind a compact ⚙️ button below `760px` instead of stealing `250px` right margin!
   - **Option B**: Pure single-row tighter overlap down to 70% overlap. _Rejected_ — 14 cards in `360px` leaves only ~18px per card sliver, causing constant mis-taps on touchscreens.
3. **Optional Fanned Hand Arc (`thoun/bga-cards` style)**:
   - **Option A (Recommended)**: Keep flat clean row/2-row as default for maximum rank/suit legibility and drag-reordering ([Plan 08](file:///Users/brohlfs/git/tichu/plans/08-hand-organization-passed-cards-and-unpass.md)), optionally exposing `--hand-fan` subtle desktop tilt as a sleek visual touch (or skip tilt if it adds Shadow DOM complexity).

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Fix `gameinfos.inc.php` & Audit `rescale()`

- Read `src/tichu.ts` around `rescale()` completely so we know every breakpoint and DOM node affected (`#game_play_area`, `#game_play_area_wrap`).
- Update `gameinfos.inc.php:79` from `'min' => 920` to `'min' => 500` (or `740` if preferred).
- Adjust `rescale()` so when responsive mobile layout is active (container width `< 760px`, or `#game_play_area` responsive mode), it scales proportionally from e.g. `500px` / disables aggressive `0.4` shrink in favor of CSS responsive stacking while leaving desktop (`>= 900px`) 100% unchanged!

### Step 2: Reclaim the `250px` Margin in `src/elements/tichu-hand.ts`

- Inspect `tichu-hand.ts` layout rules for `#myhand`, `#prefs`, `#themes`, and sort buttons.
- Replace fixed `margin: 15px 250px 25px 15px;` with:
  - Desktop (`>= 780px`): keep comfortable right rail for preferences (`margin-right: 250px` or flex/grid `1fr auto` so it cleanly adapts without magic pixels!).
  - Compact/Mobile (`< 780px`): stack or toggle `#prefs` / `#themes` into a collapsible bar/drawer (`margin-right: 15px`), giving **all available width** to the 14 cards in `#myhand`!

### Step 3: Responsive 2-Row / Dynamic Sizing in `src/elements/tichu-stock.ts` & `tichu-card.ts`

- Read `src/elements/tichu-stock.ts` `dynamicOverlap` + `ResizeObserver` logic.
- Add CSS variable-driven sizing (`--tichu-card-width`, `--tichu-card-height`) so `<tichu-stock>` can either:
  - slightly shrink cards (`0.85x`) on mid-widths, or
  - wrap cleanly onto 2 centered rows when `(cardCount * minComfortableSlice) > availableWidth` (e.g., `14` cards in `< 580px`), preserving clear selected-card `translateY(-15px)` lift on both rows without overlapping upper-row rank corners!

### Step 4: Responsive Table & Pass Area (`tichu-last-played.ts`, `tichu-pass-area.ts`, `tichu.css`)

- Verify the 4-seat Square vs List table layouts (`pref 100`), `#mahjongIndicator`, `<tichu-status>`, and `<tichu-pass-area>`'s 3 boxes (`Left` / `Partner` / `Right`) fit cleanly at `500px` and `740px` without horizontal scrollbars or clipped buttons in `<tichu-action-bar>`.

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **`#game_play_area_wrap` Transform & Modals**: Keep `AGENTS.md`'s rule intact — when `rescale()` clears `transform` (`factor >= 1.0` or disabled below mobile breakpoint), verify `<tichu-trick-modal>` and `<tichu-value-choice>` (Mahjong/Phoenix grid) still center cleanly at `375px`–`740px` without clipping off-screen!
- **Pass Box Targeting on Touchscreens**: Ensure card click selection still works cleanly on touch (no hover-only controls needed to select/play/pass).
- **Desktop Regression Guard**: At `1280x900` and `1440x900`, the desktop board should remain virtually indistinguishable visually.
- **Sibling Plans**: Coordinates directly with [03](file:///Users/brohlfs/git/tichu/plans/03-zero-reload-preferences-and-two-way-sync.md) (layout toggle) and [05](file:///Users/brohlfs/git/tichu/plans/05-flip-card-flight-animations.md) (animations read live `DOMRect`, so variable card scale/2-row hands work automatically).

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] `gameinfos.inc.php` `'min'` is within BGA's `[320, 740]` range (`500` or `740`).
- [ ] Zero horizontal overflow (`scrollWidth <= clientWidth`) at `375x667`, `500x800`, `740x900`, and `1280x900` in Playwright/DevTools on `npm run local`.
- [ ] All 14 cards in `#myhand` (including selected-card lift on row 1 & row 2) have >= 36–40px clickable width/corner rank legibility at `375px` & `500px`!
- [ ] `#prefs` / `#themes` toggles remain accessible in mobile drawer/row without blocking cards.
- [ ] `npm run build` and `npm test` pass cleanly.

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/gameinfos.inc.php, /Users/brohlfs/git/tichu/src/elements/tichu-hand.ts, /Users/brohlfs/git/tichu/src/elements/tichu-stock.ts, and /Users/brohlfs/git/tichu/plans/06-mobile-viewport-and-14-card-hand-layout.md.
Confirm Section 4 decisions (Option A defaults: min 500, collapsible #prefs, 2-row responsive wrap on narrow screens) and execute Steps 1–4.
Build (`npm run build`), run `npm test`, and inspect rendered viewports (`375px`, `500px`, `740px`, `1280px`) on `npm run local` via browser/Playwright screenshots to confirm zero clipping or horizontal overflow.
```
