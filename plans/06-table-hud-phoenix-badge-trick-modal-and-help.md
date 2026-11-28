# 06 — Table HUD Polish: Realized Phoenix Badge, `<dialog>` Trick Modal & Last Trick, and `?` Player Aid

- **Priority**: P2
- **Impact**: **Medium** — Upgrades `<tichu-trick-modal>` (currently the **last legacy modal** in the app: light-only `#f6f0e6`, fixed `540px` mobile-breaking width, no `Escape` close, stale DOM IDs) to native `<dialog closedby="any">`, adds an on-table Phoenix value pill (`9.5` / `= J`), Last Completed Trick inspection, and a `?` rules quick-reference. *(0 open BGA tickets remain.)*
- **Complexity**: **Medium** — Pure read-only `actionlog` queries + additive `getAllDatas()` fields + 4-way compatible Lit/CSS UI; zero DB schema, `states.inc.php`, or concurrency-lock changes.
- **Sequencing**: Refreshed from former Plan `11`. Coordinates `<tichu-trick-modal>` mobile width with **Plan 03** (and optional Phoenix corner badge layout with **Plan 04**).
- **Scope**: `modules/managers/LogManager.php`, `tichu.game.php`, `src/types/tichu-contracts.ts`, `src/tichu.ts`, `src/elements/combo-validator.ts`, `src/elements/game-model.ts`, `src/elements/elements.ts`, `src/elements/tichu-game.ts`, `src/elements/tichu-last-played.ts`, `src/elements/tichu-status.ts`, `src/elements/tichu-card.ts`, `src/elements/tichu-stock.ts`, `src/elements/tichu-played-cards.ts`, `src/elements/tichu-trick-modal.ts`, `src/elements/tichu-help.ts` (new), `tests/combo-validator.test.ts`, `local/integration-tests.php`
- **Already Shipped Items (Removed from Scope)**:
  - `#52829` (`implemented`, `050e8c1`): `<tichu-status roundOnly>` mounted inside `<tichu-pass-area>` (`tichu-pass-area.ts:287-292`), plus `<tichu-status>` redesigned into a compact vertical icon card backed by `img/tichu-ui-icons.png` (`bb24b04`, `edb1cfe`, `9c257c4`). *(Do **not** revert to Plan 11's old horizontal strip lift into `tichu-game.ts`!)*
  - Plan 10 `"Scores"` HUD slot (`implemented`, `23e7f4f`): `#showScores` button in `tichu-status.ts:196-213`.
  - `#99318` (`implemented`, `466c03d`): `"Remaining Cards"` heading in `tichu-played-cards.ts:157`.
  - `#161585` (`implemented`, `6a49159`): Phoenix rank attribution in non-single game logs (table card pill remains unbuilt).
- **Shared ID Reservations**: Zero new `gameoptions`, `stats`, `global`, or `actionlog` IDs.

---

## 1. Why & Goal

1. **On-Table Realized Phoenix Badge**: While game logs now show `, Phoenix as ${phoenix_rank}` (`6a49159`), `<tichu-last-played>` and `<tichu-trick-modal>` still show the raw Phoenix card without a visual rank pill (`1.5`, `9.5`, `= J`) when scanning the table or refreshing (`F5`).
2. **Last Legacy Modal (`<tichu-trick-modal>`) & Missing Last Completed Trick**: `tichu-trick-modal.ts:1-153` is the only remaining modal using `div.custom_popin_underlay`, stale `#popin_showLastTrickDialog` IDs, fixed desktop `min-width: 540px` (`500px` inner), hardcoded light-only `#f6f0e6` / `#1f2328`, no `Escape` close, and current-trick-only flat display. Players also cannot inspect the immediately preceding completed trick (`winner`, `Dragon gift recipient`, `points`, ordered plays).
3. **In-Table `?` Player Aid & Minor HUD Polish**: No quick-reference modal (`?`) exists for special cards, bomb hierarchy, and scoring. Optionally: add a short legend under `"Remaining Cards"` (`tichu-played-cards.ts:157`) with dark-mode contrast, and surface Round/Scoreboard in `tichu-pass-area.ts:278` if spectators view passing states (`!this.isSpectator` currently hides `<tichu-pass-area>`).

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| File & Verified Lines | Current Symbol / DOM State | Remaining Gap |
| :--- | :--- | :--- |
| `modules/managers/LogManager.php:92-169` | `getCurrentDbRoundAndTrick()`, `getCurrentRoundAndTrick()`, `normalizePhoenixValue()`, `getLastCombos()` | Lacks `getTrickPlaysAndSummary()`, `getCurrentTrickPlays()`, `getLastCompletedTrick()`. |
| `tichu.game.php:422-516, 1004, 1731, 1999` | `getAllDatas()`, `chooseDragonGift()`, `collect()`, `stNextPlayer()` | `getAllDatas()` omits `currentTrickPlays` and `lastCompletedTrick`. |
| `src/elements/game-model.ts:89-103, 768, 1750, 2013` | `hydrateFromGamedatas`, `applyPlayCombo`, `applyCaptureCards` | Lacks `currentTrickPlays$`, `lastCompletedTrick$`, `trickModalMode$`, `helpModalOpen$`, `openTrickModal()`, `setHelpModalOpen()`. |
| `src/elements/tichu-status.ts:1-237` | Compact vertical icon card (`img/tichu-ui-icons.png` 4×3 sheet — all 12/12 slots occupied in `local/build-ui-icons.py:5-7`) | Lacks `"Last trick"` and `"?"` icon buttons (use inline `<svg>` icons or expand sprite sheet to 4×4). |
| `src/elements/tichu-trick-modal.ts:1-153` | Legacy `div.custom_popin_underlay`, `#popin_showLastTrickDialog`, `min-width: 540px`, light-only `#f6f0e6` | Migrate to native `<dialog closedby="any">` + Safari fallback + `--tichu-dialog-*` tokens (matching `tichu-score-modal.ts` & `tichu-settings-modal.ts`), add `current`/`last` switcher & Dragon recipient banner. |
| `src/elements/tichu-last-played.ts:335-400, 478-503, 688` | `.last-played-combo`, `<tichu-stock .scale=${0.75} .disableCardTooltips=${true}>` | Does not pass `combo.phoenixValue` to `<tichu-stock>`; note `disableCardTooltips=${true}` intentionally disables table hover tooltips (`edb1cfe`). |
| `src/elements/tichu-played-cards.ts:157` | `<h3>${_("Remaining Cards")}</h3>` | No legend / explicit dark-mode polish yet. |

---

## 3. Architectural Decisions & Trade-offs

1. **Realized Phoenix Badge (`<tichu-card>` / `<tichu-stock>`)**:
   - Add `@property({ type: Number }) phoenixValue: number | null = null` on `<tichu-stock>` and `<tichu-card>` (passed **only** from `<tichu-last-played>` and `<tichu-trick-modal>`). Render a compact high-contrast top-left `.phoenix-value-badge` inside `div#card` (`top: 4px; left: 4px; pointer-events: none`) so left-to-right card overlap keeps it visible without perturbing `DOMRect`s or binding `style=` on `<tichu-card>`. Include the badge value in `aria-label` (respecting `.disableCardTooltips=${true}` on `<tichu-last-played>`).
2. **Native `<dialog closedby="any">` + `--tichu-dialog-*` Tokens (NOT `custom_popin_underlay` or `:host-context()`)**:
   - Follow `src/elements/tichu-score-modal.ts` and `src/elements/tichu-settings-modal.ts` (`tichu.css:41-101`): use native `<dialog closedby="any">` with Safari backdrop bounding-rect fallback and `--tichu-dialog-*` CSS custom properties (never `:host-context()`, which fails in Firefox/Safari Shadow DOM). Mount `<tichu-help>` on `document.body` outside `#game_play_area_wrap`.
3. **Vertical `<tichu-status>` HUD Buttons**:
   - Add compact `"Last trick"` and `"?"` icon buttons to `<tichu-status>`'s vertical `.status-actions` grid using inline `<svg>` icons (or expanding `local/build-ui-icons.py` / `img/tichu-ui-icons.png`), keeping `"Last trick"` disabled (stable slot) when `!hasLastTrick`.
4. **Static `i18n` & Types**: Use direct literal `_("...")` calls (never `t(...)`), and keep PHP compatible with PHPStan Level 6.

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

- **4-Way Live-Game Safety**: Zero DB, `upgradeTableDb()`, `states.inc.php`, `tichu.action.php`, or `NotificationManager.php` changes. Additive optional `getAllDatas()` keys (`currentTrickPlays`, `lastCompletedTrick`) are ignored by old JS tabs; `GameModel` handles `undefined` gracefully on rollback.
- **Locks, `@thoun` Autopass, Replay & Studio Safety**: Strictly read-only queries (`getObjectListFromDB`/`getUniqueValueFromDB`, **no** `acquireGameLock()` in `getAllDatas()`). `<tichu-replay>` defaults `phoenixValue` to `null` and is unaffected; `local/import-bug-sql.php` Surface 4 already remaps `actionlog.log_player` & `chooseDragonGift.recipient`.

---

## 5. Step-by-Step Implementation Blueprint

1. **Phoenix Formatting Utility (`src/elements/combo-validator.ts`)**:
   - Export pure helpers `formatShortRank(rank: number)` (`2..10, J, Q, K, A`) and `formatPhoenixBadge(phoenixValue: number | number[] | null | undefined): string` (`"1.5"`, `"9.5"`, `"Q.5"`, `"= 7"`, `"= J"`, or `""`).
2. **Phoenix Value Badge (`tichu-card.ts`, `tichu-stock.ts`, `tichu-last-played.ts`)**:
   - Add `phoenixValue` prop + `.phoenix-value-badge` inside `div#card` (`tichu-card.ts`), forward for Phoenix in `tichu-stock.ts`, and pass `.phoenixValue=${typeof combo.phoenixValue === "number" ? combo.phoenixValue : null}` in `tichu-last-played.ts:491-501`.
3. **Server Trick History & `F5` Hydration (`LogManager.php`, `tichu.game.php`, `tichu-contracts.ts`)**:
   - Add `LogManager::getTrickPlaysAndSummary(int $round, int $dbTrick)`, `getCurrentTrickPlays()`, and `getLastCompletedTrick()` (current `log_round`, `0 < log_trick < $currentDbTrick`).
   - Emit optional `"currentTrickPlays"` & `"lastCompletedTrick"` from `Tichu::getAllDatas()`, mirrored in `src/types/tichu-contracts.ts`.
4. **Live `GameModel` & `src/tichu.ts` Wiring**:
   - Add `currentTrickPlays$`, `lastCompletedTrick$`, `trickModalMode$`, `helpModalOpen$`, `openTrickModal()`, `setHelpModalOpen()` in `game-model.ts` (hydrating defensively, appending in `applyPlayCombo()`, snapshotting `lastCompletedTrick` in `applyCaptureCards()`, clearing in `enterNewTrick()` / `enterNewRound()` / `enterEndRound()`).
   - Mount `<tichu-help>` on `document.body` in `tichu-game.ts` & `src/tichu.ts` (`import type` only).
5. **Modernize `<tichu-trick-modal>`, Add `<tichu-help>`, Update `<tichu-status>` & `<tichu-played-cards>`**:
   - Rewrite `src/elements/tichu-trick-modal.ts` to `<dialog closedby="any">` + `--tichu-dialog-*` dark-mode tokens + `width: min(560px, 94vw)`, clean `#tichu-trick-modal-*` IDs, `mode: "current" | "last"` toggle, winner + Dragon gift recipient banner, and per-play `<tichu-stock .phoenixValue=...>`.
   - Create `src/elements/tichu-help.ts` (`<dialog closedby="any">`, `--tichu-dialog-*`, 3 localized sections: Special Cards, Combos & Bombs, Scoring & Bets).
   - Add `"Last trick"` and `"?"` compact icon buttons to `<tichu-status>`, plus optional `"Remaining Cards"` legend in `tichu-played-cards.ts` and spectator pass-state round visibility.

---

## 6. Verification Checklist

- [ ] **TS Unit Tests (`tests/combo-validator.test.ts` via `npm run test:validator`)**: `formatPhoenixBadge()`, `GameModel` trick history + Dragon gift + rollback fallback, `<tichu-trick-modal>` & `<tichu-help>` rendering.
- [ ] **MySQL 8.0 Integration (`local/integration-tests.php`)**: `getAllDatas()` `lastCompletedTrick === null` on Trick 1, populated on Trick 2 (normal & Dragon gift), `currentTrickPlays` preserved after Phoenix player passes, reset on Round 2.
- [ ] **Gate & Browser Checks**: `npm run build && npm run test:contracts && npm run phpstan`; verify desktop + `375px` mobile, `html[data-theme="dark"]`, `&dummyTranslations`, F5 reloads, and `tt.assertUI()` on `npm run local`.
