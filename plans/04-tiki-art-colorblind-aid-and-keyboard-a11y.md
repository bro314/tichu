# 04 — Tiki Mahjong Art Fix (`#258688`), Tiki 2x Sprites, Colorblind Aid (`Pref 108`) & Keyboard/ARIA Accessibility

- **Priority**: P2 (Part A: **P1 Quick Win** — fixes confirmed display bug `#258688`)
- **Impact**: **Medium** — Part A resolves the only `confirmed` open display bug (`#258688`); Parts B–D deliver crisp 2x Tiki sprites, Colorblind Suit Symbols (`Pref 108`), compact table corner legibility, and full roving keyboard/ARIA card access.
- **Complexity**: **Low (Part A)** -> **Medium (Parts B–D)** — Pure frontend + `gameoptions.inc.php` + PNG assets; zero DB schema, PHP action, state machine, or concurrency-lock risk.
- **Sequencing**: Refreshed from former Plan `14`, adding **Part A (`#258688`)**.
- **Scope**: `img/tiki-cards.png`, `img/tiki-icons-pass.png`, `img/tiki-tichu-mahjong.png`, `gameoptions.inc.php`, `tichu.css`, `src/tichu.ts`, `src/elements/game-model.ts`, `src/elements/tichu-settings-modal.ts`, `src/elements/tichu-value-choice.ts`, `src/elements/tichu-card.ts`, `src/elements/tichu-stock.ts`, `src/elements/tichu-hand.ts`, `src/elements/tichu-last-played.ts`, `src/elements/tichu-played-cards.ts`, `src/elements/tichu-pass-area.ts`, `src/elements/tichu-trick-modal.ts`, `src/elements/tichu-animation-layer.ts`, `local/js/bga-shim.js`, `tests/combo-validator.test.ts`
- **Open BGA Tickets Covered**:
  - [#258688](https://boardgamearena.com/bug?id=258688) (1 vote, `confirmed` — *"Mahjong wish selector and indicator use standard art instead of Tiki Edition Art"*) — **Part A**
- **Already Shipped Items (Removed from Scope)**:
  - `#36611` (`implemented`, `5a684d8`, release `261122-1049`): Standard card sheet rebuilt at **2.8x HiDPI** (`img/tichu-cards.png` `3920x1680`, `img/tichu-icons-pass.png` `280x420`, `img/tichu-mahjong.png` `280x420`), plus unified UI sprite sheet `img/tichu-ui-icons.png` (`bb24b04`, `9c257c4`).
  - Legacy `.cardontable` `background-size: 1400px 600px` (`tichu.css:925-935`) and dark-mode `#logs` / right-sidebar contrast (`5b2b3fa`).
  - Basic interactive card ARIA & `Alt+Arrow` reorder (`3f88c97`): `getAccessibleCardLabel()` (`tichu-card.ts:336-373`), `div#card:focus-visible` (`L163-166`), `forced-colors` (`L286-298`), `role="button"`, `tabindex="0"`, `aria-pressed`, `Enter`/`Space`, and `Alt+ArrowLeft/Right` (`tichu-stock.ts:1051-1096`).
- **Shared ID Reservations**: **Owns `$game_preferences[108]`** (*High-Contrast Suit Symbols / Colorblind Aid*, `needReload => false`). Respects `106` (Plan 02) and `107` (Plan 05).

---

## 1. Why & Goal

1. **Tiki Mahjong Wish Selector & Indicator Mismatch (`#258688`, Part A)**: `tichu-value-choice.ts:59, 118` hardcodes `--table-icons-url: url(${themeUrl}img/tichu-icons-table.png)` for `#mahjongpanel` and `#phoenixpanel` even when `Pref 103 = 1` (Tiki Edition Art) is active, and `#mahjongIndicator .mahjong` (`tichu-last-played.ts:234-241`) overlays the same standard `img/tichu-icons-table.png` rank badge on top of `img/tiki-tichu-mahjong.png`.
2. **Tiki 1x Sprites (Part B)**: While Standard art (`img/tichu-cards.png`) is now `3920x1680` (2.8x), `img/tiki-cards.png` (`1400x600`), `img/tiki-icons-pass.png` (`50x75`), and `img/tiki-tichu-mahjong.png` (`100x150`) remain `1x`.
3. **Colorblind Suit Ambiguity & Small Table Card Legibility (Part C)**: Swords, Stars, Pagodas, and Jade rely heavily on color (`0.75x` table plays and `40x60px` Remaining Cards tiles).
4. **Roving Keyboard Focus & Non-Interactive Card ARIA (Part D)**: `<tichu-stock>` currently puts `tabindex="0"` on every card (`14` Tab stops) and lacks plain `ArrowLeft`/`ArrowRight`/`Home`/`End`/`Escape` roving focus, while non-interactive table/pass/trick cards lack `role="img"` + `aria-label`. *(Note: Do **not** re-add hover tooltips on normal cards — `0aad14c` & `edb1cfe` intentionally removed hover noise on normal cards and `<tichu-last-played>`.)*

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| Surface / File | Verified Location & Symbols | Gap |
| :--- | :--- | :--- |
| `src/elements/tichu-value-choice.ts:59, 118` | `--table-icons-url: url(...img/tichu-icons-table.png)` | Ignores `isTiki$` (`Pref 103`). |
| `src/elements/tichu-last-played.ts:220-241, 338-340` | `.tiki #mahjongIndicator`, `.mahjong` | Base card uses `img/tiki-tichu-mahjong.png`, but `.mahjong` overlay uses `var(--table-icons-url)` (`img/tichu-icons-table.png`). |
| `img/tiki-*` | `tiki-cards.png` (`1400x600`), `tiki-icons-pass.png` (`50x75`), `tiki-tichu-mahjong.png` (`100x150`) | Still `1x` (no `img/highres/` Tiki originals exist). |
| `gameoptions.inc.php:74-135`, `tichu-settings-modal.ts:40-48, 853-920` | Prefs `100..105` | Pref `108` absent; UI toggles live in **`<tichu-settings-modal>`** (not old `#prefs`). |
| `src/elements/tichu-card.ts:336-524` | `getAccessibleCardLabel()`, `div#card` | Interactive cards have `role="button"`, `tabindex="0"`, `aria-label`; lacks `delegatesFocus: true`, `cardTabIndex`, non-interactive `role="img"` + `aria-label`, and `.card-corner-badge`. |
| `src/elements/tichu-stock.ts:733, 1051-1096` | `@keydown=${this.onStockKeyDown}` (`Alt+ArrowLeft/Right`) | Lacks `role="group"`, roving `focusedCardId`/`cardTabIndex`, and plain `ArrowLeft`/`ArrowRight`/`Home`/`End`/`Escape`. |
| `src/elements/tichu-played-cards.ts:87-91` | `"Remaining Cards"`, `.arg-label` (`font-size: 0; color: transparent`) | Needs colorblind symbols + accessible `.sr-only` labels. |
| `src/elements/tichu-animation-layer.ts:244-257` | `div.ghost-card` | Renders raw `div.ghost-card` nodes (not `<tichu-card>`). |
| `local/js/bga-shim.js:1749-1778, 4573` | `DEFAULT_PREFS`, `bootGameInstance` | Covers `100..105` only. |

---

## 3. Architectural Decisions & Trade-offs

1. **Tiki Mahjong Selector & Indicator (`#258688`, Part A)**:
   - Subscribe `TichuValueChoice` (`src/elements/tichu-value-choice.ts`) to `window.gameModel.tiki$` (or receive `.tiki` prop from `<tichu-game>`). When `tiki` is true, render Mahjong `2..14` & Phoenix `2..14` tiles using `img/tiki-cards.png` slices (since `tiki-cards.png` already has all 13 ranks `2..14` at row 0 / columns `1..13` — or a crisp Tiki-styled rank overlay for `"No wish"` tile `15` and `#mahjongIndicator` rank badge), so zero standard-deck card art appears in Tiki mode.
2. **Tiki 2x Sprites (Part B)**:
   - Upscale `img/tiki-cards.png` (`2800x1200`), `img/tiki-icons-pass.png` (`100x150`), and `img/tiki-tichu-mahjong.png` (`200x300`) in place (`< 2 MB`). Zero coordinate math changes because `--bg-width: ${14 * width}px` scales dynamically.
3. **Inline `<svg>` Corner Badges & `Pref 108` (`<tichu-settings-modal>`, Part C)**:
   - Register `$game_preferences[108]` (`needReload => false`) in `gameoptions.inc.php`, wire `GameModel.colorblindSuits$` + `src/tichu.ts` + `<tichu-settings-modal>` + `bga-shim.js` (with rollback check before `persistUserPreference(108, ...)`).
   - Render inline `<svg aria-hidden="true">` suit paths (Swords `♠`, Stars `★`, Pagodas `⌂`/`♣`, Jade `◆`) + crisp rank in `.card-corner-badge` inside `TichuCard` when `colorblind || (tableCompact && scale <= 0.75)` (no `filter: drop-shadow` for Safari; no parent `style=` bindings on `<tichu-card>`). Mirror badge class/overlay on `div.ghost-card` in `tichu-animation-layer.ts:244-257` if needed.
4. **Roving Keyboard Focus & ARIA Coexisting with `Alt+Arrow` (Part D)**:
   - Keep `3f88c97`'s `Alt+ArrowLeft`/`Alt+ArrowRight` card reorder and `<tichu-replay>` global listeners working cleanly (`e.stopPropagation()`).
   - Add `delegatesFocus: true` on `TichuCard`, `role="img"` + `aria-label` on non-interactive cards, roving `cardTabIndex` (`0` on `focusedCardId`, `-1` on others), and `ArrowLeft`/`ArrowRight`/`Home`/`End`/`Escape` handling in `<tichu-stock>`. Keep normal cards tooltip-free (accessible names in `aria-label` only, preserving `0aad14c`).

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

- **4-Way Live-Game Safety**: Zero DB, `states.inc.php`, PHP action, notification, `global`, or `actionlog` changes. `safeGetPref(108, 1)` returns `1` on pre-deploy/rollback; `Tichu::changeColorblindSuits()` skips `persistUserPreference(108, ...)` if `#preference_control_108` / `prefs[108]` is absent.
- **Locks, `@thoun` Autopass & Replay**: Zero backend mutations; `<tichu-replay>` keeps working cleanly (`e.stopPropagation()` protects replay keyboard shortcuts).

---

## 5. Step-by-Step Implementation Blueprint

1. **Part A — Fix Confirmed Tiki Mahjong Art Bug (`#258688`)**:
   - Subscribe `TichuValueChoice` (`src/elements/tichu-value-choice.ts`) to `window.gameModel.tiki$` (plus `tichu-game.ts` / `tichu-last-played.ts` `.tiki` indicator styling).
   - In Tiki mode, style `#mahjongpanel` / `#phoenixpanel` tiles `2..14` using `img/tiki-cards.png` (`background-size: calc(var(--choice-w, 70px) * 14) calc(var(--choice-h, 105px) * 4)`, column `val - 1`), and render `#mahjong_item_15` ("No wish") and `#mahjongIndicator`'s active-wish rank pill with Tiki-matched styling instead of standard `img/tichu-icons-table.png`.
2. **Part B — Upscale Tiki 2x Sprites (`img/tiki-*.png`)**:
   - Upscale/sharpen `img/tiki-cards.png` -> `2800x1200`, `img/tiki-icons-pass.png` -> `100x150`, `img/tiki-tichu-mahjong.png` -> `200x300` (`< 2 MB`), verifying `14x4` grid alignment (`local/build-highres-cards.py` / `magick` / `pngquant`).
3. **Part C — Colorblind Aid (`Pref 108`) & Compact Corner Badges**:
   - Register `$game_preferences[108]` in `gameoptions.inc.php`, add `colorblindSuits` / `colorblindSuits$` in `game-model.ts`, `readPrefs`/`onPreferenceChange`/`changeColorblindSuits` in `src/tichu.ts`, switch row in `src/elements/tichu-settings-modal.ts`, and `108: 1` in `local/js/bga-shim.js`.
   - Add `colorblind` & `tableCompact` props + `.card-corner-badge` inline SVG overlays in `tichu-card.ts` (avoiding parent `style=` and Safari `filter: drop-shadow`), propagate via `tichu-stock.ts`, `tichu-hand.ts`, `tichu-last-played.ts` (`tableCompact`), `tichu-pass-area.ts`, `tichu-trick-modal.ts` (`tableCompact`), `tichu-played-cards.ts` (`.sr-only` + suit symbols), and optionally `div.ghost-card` in `tichu-animation-layer.ts`.
4. **Part D — Roving Keyboard Nav & Non-Interactive ARIA**:
   - Update `tichu-card.ts` (`delegatesFocus: true`, `cardTabIndex`, `role=${interactive ? "button" : "img"}`, `aria-label` on all cards, optional localized face ranks in `getAccessibleCardLabel()`) and `tichu-stock.ts` (`role="group"`, `focusedCardId`, plain `ArrowLeft`/`ArrowRight`/`Home`/`End`/`Escape` preserving `Alt+ArrowLeft/Right` reorder).

---

## 6. Verification Checklist & Regression Tests

- [ ] **Part A (`#258688`)**: TS unit test + `npm run local` Playwright screenshot in `mahjongPlay` & `playCombo` (with active wish) under `Pref 103 = 1` (Tiki) verifying zero `tichu-icons-table.png` standard-card tiles appear.
- [ ] **Parts B–D (`tests/combo-validator.test.ts`)**: `TichuCard` interactive vs non-interactive ARIA (`role="img"`), `.card-corner-badge` for `colorblind` and `tableCompact && scale <= 0.75`, roving keyboard nav + `Alt+Arrow` coexistence + `stopPropagation()`, and `Pref 108` round-trip/rollback/spectator guard; visual check at `deviceScaleFactor: 2` across Standard, Tiki, `Pref 108=2`, and `html[data-theme="dark"]`.
- [ ] **Gate & Studio**: `npm run build && npm run test:contracts && npm run phpstan`, then Studio `Reload game options configuration` + `Use minified JS/CSS`.

---

## 7. BGA Ticket Closure Draft (`#258688`)

> **NEVER** change BGA ticket status or post replies without explicit user approval after production deploy!

- **#258688** (`confirmed` -> `fixed` once Part A deploys to production):
  - `Fixed in release <YYMMDD-HHMM> (now live). When Tiki Edition Art is enabled, the Mahjong wish selector, Phoenix value selector, and active Mahjong wish indicator now use Tiki Edition artwork instead of standard deck tiles. Refreshing the page (F5) loads the fix — thanks for reporting this!`
