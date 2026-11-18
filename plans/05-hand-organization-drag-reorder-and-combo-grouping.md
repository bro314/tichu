# 05 — Hand Organization: Drag-to-Reorder, Descending/High-Special Sort & Combo Grouping

- **Priority**: P1 (#1 highest-voted open BGA ticket `#22264` at 37 votes)
- **Recommended Roadmap Day**: Day 3
- **Scope**: `src/elements/tichu-stock.ts`, `src/elements/tichu-hand.ts`, `src/elements/tichu-card.ts`, `src/elements/game-model.ts`, `src/tichu.ts`, `local/js/bga-shim.js`, `tests/combo-validator.test.ts`
- **Open BGA Tickets / Prod Issues Covered**: [#22264](https://boardgamearena.com/bug?id=22264) (37 votes, `acknowledged` — custom hand ordering, drag-and-drop, descending rank, high specials), [#164400](https://boardgamearena.com/bug?id=164400) (1 vote, `acknowledged` — combo grouping / secondary holder)
- **Estimated Effort**: Medium–Large (client-only Lit + RxJS + pointer-drag + `localStorage` state, zero PHP/DB changes)
- **Dependencies & Shared ID Reservations**: Splits out and supersedes Sub-feature A of legacy `08-hand-organization-passed-cards-and-unpass.md` (archived in [00-roadmap-index.md](file:///Users/brohlfs/git/tichu/plans/00-roadmap-index.md)) (Sub-features B & C move to Plan 07 `unpassCards`). Owns sort modes (`rank`, `rank-desc`, `color`, `preserve`) and `localStorage` keys `tichu_hand_sort_order` / `tichu_hand_custom_order`. Leaves BGA prefs `106..108`, stats `13`/`17..22`, global `31`, and `actionlog` untouched. Coordinates responsive layout with [Plan 04](file:///Users/brohlfs/git/tichu/plans/04-mobile-viewport-and-responsive-14-card-hand.md) and keyboard accessibility with [Plan 14](file:///Users/brohlfs/git/tichu/plans/14-hidpi-card-clarity-a11y-and-colorblind-suits.md).

---

## 1. Why & Goal

In physical Tichu and BSW, players sort high-to-low (`D, Ph, A..2`), keep Dragon and Phoenix next to Ace instead of buried below `2`, physically separate planned combos (Straights, Full Houses, Bombs) from singletons so they never shed the wrong card, and start organizing their initial 8 cards while waiting on slower opponents.

Today on BGA Tichu:

1. `<tichu-stock>` defines `sortMode = "preserve"`, yet offers no pointer drag-to-reorder UI, no `customHandOrder` persistence, and no combo grouping markers.
2. `getWeightByRank()` treats `type_arg = 1` numerically (`1 < 2`), placing Dragon, Phoenix, Dog, and Mahjong **below `2`**, with no descending sort (`rank-desc`).
3. `TichuHand::getSelectionMode()` locks selection (`0`) across all of `grandTichuBets`, blocking post-bet hand organization while waiting on tablemates.

Goal: Deliver physical-table-grade hand organization (pointer drag-to-reorder with FLIP settle, smart special-card weights + `Rank ↓`, `Group 1..4` left-pinned combo clusters, and early post-bet selection) with zero server round-trips or schema changes.

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| File & Lines                                                                                                | Current Symbol / Behavior                                                    | Gap / Impact                                                                                                         |
| :---------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| [tichu-stock.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-stock.ts#L11-L22)                       | `getWeightByRank()`, `getWeightByColor()`                                    | `value = 1` sorts all 4 specials below `2`; no `getWeightByRankDesc()`.                                              |
| [tichu-stock.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-stock.ts#L33-L55)                       | `sortMode: "rank" \| "color" \| "preserve"`, `prevRects`, `pendingRevealIds` | Missing `reorderable`, `"rank-desc"`, `customOrder`, `cardGroups`.                                                   |
| [tichu-stock.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-stock.ts#L94-L160)                      | `willUpdate()` / `updated()` WAAPI FLIP                                      | Only checks `sortMode` & `cards`; no drag-release rect handoff.                                                      |
| [tichu-stock.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-stock.ts#L179-L212)                     | `getSortedCards()`, `computeMarginRightPx()`                                 | `preserve` returns raw `cards`; overlap math ignores group gaps.                                                     |
| [tichu-stock.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-stock.ts#L214-L303)                     | `render()` (`repeat` by `card.id`), `onCardClick()`                          | No pointer drag handlers, no drop preview, no click suppression after drag.                                          |
| [tichu-hand.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-hand.ts#L19-L157)                        | `handSortOrder`, `constructor` RxJS subscriptions                            | Missing `"rank-desc"` / `"preserve"` & `isCurrentPlayerActive$` subscription.                                        |
| [tichu-hand.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-hand.ts#L159-L215)                       | `getSelectionMode()`, `#order_by_rank` / `#order_by_color`                   | `grandTichuBets` hardcodes `0`; no `Rank ↓`, `Custom`, or `Group 1..4` controls.                                     |
| [tichu-card.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-card.ts#L35-L171)                        | `TichuCard` props, `.stockitem_selected`, `render()` (`this.style`)          | Sets `--width`/`--card-url` on `this.style`; needs `.group`/`.dragging`/`.dragX`/`.shiftX` props.                    |
| [game-model.ts](file:///Users/brohlfs/git/tichu/src/elements/game-model.ts#L76-L146)                        | `LiveGameState.handSortOrder`, `getStoredHandSortOrder()`                    | Persists only `"rank" \| "color"`; no `tableId`, `customHandOrder`, or `cardGroups`.                                 |
| [game-model.ts](file:///Users/brohlfs/git/tichu/src/elements/game-model.ts#L637-L1073)                      | `enterNewRound()`, `dealCards()`, `finishAcceptCards()`, `applyPlayCombo()`  | Appending 6/3 cards works in raw `hand`, needs `customHandOrder` preservation & pruning.                             |
| [tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts#L359-L484)                                          | `safeGetHandSortOrder()`, `readPrefs()`, `rehydrateModel()`                  | Must pass `table_id` (from `GameGui` / `bgaGameData`) & support `"rank-desc" \| "preserve"`.                         |
| [tichu-animation-layer.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-animation-layer.ts#L310-L431) | `runDealCardsFlight()`, `runAcceptCardsFlight()`                             | Awaits `stock.updateComplete` then calls `getCardRects()` — works seamlessly if `customOrder` updates synchronously. |

---

## 3. Architectural Decisions & Trade-offs

1. **Opt-in Drag & Grouping on Shared `<tichu-stock>`**:
   - **Recommended**: Gate drag-to-reorder and group rendering behind `@property({ type: Boolean }) reorderable = false;` enabled **only** on `<tichu-hand>` (`!isSpectator`). Table combos ([tichu-last-played.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-last-played.ts#L436-L445)), trick modal ([tichu-trick-modal.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-trick-modal.ts#L128-L134)), and replay ([tichu-player.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-player.ts#L253)) keep `reorderable = false`.
2. **Inline Left-Pinned Group Clusters (`Velonimo` / `#164400`) vs. Permanent 2nd Row**:
   - **Recommended**: Implement `Group 1..4` inside `<tichu-stock>`'s single flex row (pinned left in `G1 -> G2 -> G3 -> G4 -> Ungrouped` order with `22px` horizontal gaps, `4px` colored top-edge border, and bottom-left `1..4` pill on `<tichu-card>`). As `#164400`'s reporter clarified (`2025-04-16`), `"1st"`/`"2nd"` means `Group 1`/`Group 2` labels; keeping 1D horizontal layout preserves `pan-y` touch scroll, avoids doubling `#myhand` height on laptops, and stays visible even at max card overlap (`17–42px` exposed left slice) without obscuring top-left rank/suit pips.
   - _Alternative_: Dual-row shelf inside `<tichu-stock>`. Easy to layer onto `cardGroups` later if Plan 06 mobile breakpoints need it.
3. **Smart Special-Card Weights & Round Boundary Behavior**:
   - **Recommended**: Define `getLogicalRankWeight()` (`Dog=0, Mahjong=1, 2..14, Phoenix=15, Dragon=16`) so `"rank"` orders `Dog, MJ, 2..A, Ph, D` (`Sharon36` request) and `"rank-desc"` orders `D, Ph, A..2, MJ, Dog` (`allanmandragor`/`Alexcendre` BSW order). Store `baseSortOrder` alongside `"preserve"` so `enterNewRound()` reverts `"preserve"` -> `baseSortOrder` for a clean 8-card deal while intra-round F5 refreshes restore `"preserve"` + `customHandOrder` + `cardGroups` from `tichu_hand_custom_order`.
4. **Pointer Drag Deadzone & FLIP Coordination**:
   - **Recommended**: Require `|dx| > 6` and `|dx| >= |dy|` before calling `setPointerCapture` so vertical page scroll (`touch-action: pan-y`) and click-to-select remain crisp; preview locally via Lit props (`.dragging`, `.dragX`, `.shiftX` — **never** binding `style=` on `<tichu-card>` from parent template per `AGENTS.md`) and commit `customHandOrder` once on `pointerup` with `dragReleaseRects` handed off to FLIP and CSS `transition` cleared so cards never double-animate.

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

- **1. `OLD DB -> NEW PHP + NEW JS`**: Zero DB migrations, zero new `global`/`option`/`pref`/`stat` IDs. `GameModel.hydrateFromGamedatas()` treats missing `table_id`, missing `localStorage`, or malformed JSON safely and resets stale-round `tichu_hand_custom_order` entries.
- **2. `OLD open JS tab <-> NEW PHP`**: Zero PHP action, state, `arg*`, `getAllDatas`, or `NotificationManager` changes; wire payloads are 100% unchanged.
- **3. `NEW open JS tab <-> OLD PHP` (Rollback)**: `NEW` JS derives everything from `gamedatas.hand`, `gamedatas.round`, and `gamestate.multiactive`; submitting `playCombo`/`giveTheCards` still sends card IDs without relying on PHP knowing display order.
- **4. `NEW DB / actionlog -> OLD PHP + OLD JS` (Rollback)**: Zero DB/log writes; if a user rolls back to `OLD` JS while `tichu_hand_sort_order` is `"rank-desc"` or `"preserve"`, existing [game-model.ts](file:///Users/brohlfs/git/tichu/src/elements/game-model.ts#L126) and [tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts#L363) already fall back to `"rank"` safely.
- **Concurrency, Autopass, Replay & Sandbox Compliance**: Zero new mutating endpoints (`acquireGameLock`/`syncStaleReturnState` and `@thoun` `player_pass` invariants untouched); `<tichu-replay>` (`TichuPlayer`) keeps `reorderable = false` and benefits from Dragon/Phoenix above Ace in `getWeightByRank`; [local/import-bug-sql.php](file:///Users/brohlfs/git/tichu/local/import-bug-sql.php) 7-surface remapper needs zero changes; zero PHP files modified (`workspace.blocked-files` clean).

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Extend Sort Modes, `tableId`, Custom Order & Groups in [game-model.ts](file:///Users/brohlfs/git/tichu/src/elements/game-model.ts) and [tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts)

- Define `export type HandSortOrder = "rank" | "rank-desc" | "color" | "preserve";`, `export type AutoSortOrder = "rank" | "rank-desc" | "color";`, and `export type CardGroupId = 1 | 2 | 3 | 4;`.
- Add `tableId: number`, `baseSortOrder: AutoSortOrder`, `customHandOrder: string[]`, and `cardGroups: Record<string, CardGroupId>` to `LiveGameState` + RxJS selectors `customHandOrder$` and `cardGroups$`.
- Implement `localStorage` persistence for `"tichu_hand_custom_order"` as a JSON map keyed by `${tableId}_${playerId}` holding `{ round, baseSortOrder, order, groups, updatedAt }`, pruning entries whose `round !== currentRound` (when overwriting) or older than 30 days / beyond the 20 most recent entries. Skip storage writes when `isReadOnly` / `isSpectator`.
- Update `hydrateFromGamedatas(..., tableId?)`: pass `Number((this as any).table_id || (gamedatas as any)?.table_id || (window as any).bgaGameData?.tableId || 1)` from `Tichu::rehydrateModel()` ([tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts#L478)); set `this.table_id = Number(initPayload.tableId || initPayload.gamedatas?.table_id || 1)` in [local/js/bga-shim.js](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L1746) for local parity.
- Handle card arrivals & departures cleanly:
  - `dealCards(cards)` (`length === 8`): reset `customHandOrder = []`, `cardGroups = {}`, and if `handSortOrder === "preserve"` revert to `baseSortOrder`.
  - `dealCards(cards)` (`length === 6`, after `grandTichuBets`): retain existing 8 IDs in `customHandOrder` & `cardGroups`, append the 6 new IDs (sorted by `baseSortOrder`) at the end.
  - `finishAcceptCards(cards)` (3 received cards): retain existing 11 IDs in `customHandOrder` & `cardGroups`, append the 3 new IDs (sorted by `baseSortOrder`) at the end.
  - `toggleGiveCardSlot` / `resetPassCards`: keep `customHandOrder`/`cardGroups` for cards temporarily staged in `passSlots` so returning a pass card restores its hand spot; permanently prune IDs in `applyPassCardsNotif()` and `applyPlayCombo()` (when `isCurrent`) and `enterNewRound()` / `enterEndRound()`.
- Add `GameModel` actions: `commitCustomHandOrder(orderedIds: string[], movedCardId?: string, newGroup?: CardGroupId | 0)`, `assignCardGroup(cardIds: string[], groupId: CardGroupId | 0)`, `clearCardGroups()`, and update `setHandSortOrder()` (updating `baseSortOrder` when non-`"preserve"`). Update `Tichu::safeGetHandSortOrder()` and `onOrderChange()` in [tichu.ts](file:///Users/brohlfs/git/tichu/src/tichu.ts#L359-L369).

### Step 2: Logical Weights, Combo Group Rendering & Pointer Drag in [tichu-stock.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-stock.ts) and [tichu-card.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-card.ts)

- Export `getLogicalRankWeight(card)`: Dragon `16`, Phoenix `15`, normal `2..14`, Mahjong `1`, Dog `0`. Update `getWeightByRank(card)` to sort `0..16` ascending and export `getWeightByRankDesc(card)` sorting `(16 - logicalRank)` descending (`D, Ph, A..2, MJ, Dog`).
- Export pure `sortHandCards(cards, sortMode, baseSortOrder, customOrder, cardGroups)`: partitions into groups `1, 2, 3, 4, 0` (ungrouped last), ordering within each partition by `customOrder` index when `sortMode === "preserve"` (appending unknown IDs via `baseSortOrder`) or by the active auto-sort comparator.
- Extend `TichuCard` with `@property` fields `group = 0`, `dragging = false`, `dragX = 0`, `shiftX = 0` applied inside `TichuCard.render()` via `--drag-x` / `--shift-x` / `--group-color` (avoiding Safari `filter: drop-shadow` — use `box-shadow` only; **never** bind `style=` on `<tichu-card>` from `TichuStock`). Render a `4px` colored top-edge inset bar (`data-group="1..4"`) plus a compact bottom-left pill (`1..4`) so badges stay visible even at `17px` card slice width without covering top-left rank/suit pips.
- Update `TichuStock.computeMarginRightPx()` to count `groupBoundaryCount` (`group(c[i]) !== group(c[i+1])`) and subtract `groupBoundaryCount * 22` from `width` before dividing overlap across `cards.length - 1`, adding `.group-boundary` (`margin-right: calc(var(--card-margin-right, -75px) + 22px)`) in CSS.
- Implement pointer drag handlers (`@pointerdown`, `@pointermove`, `@pointerup`, `@pointercancel`) on `#stock` when `reorderable && !pass && !hideAllCards`:
  - `6px` deadzone (`|dx| > 6 && |dx| >= |dy|`) with `touch-action: pan-y` on `#stock`; capture `slotMidpoints` and `zoomFactor` on drag activation; cancel pending drag cleanly if vertical scroll dominates or `cards` mutates in `willUpdate`.
  - During drag, set `[data-dragging-active]` on `#stock`, shift cards between `fromIndex` and `dropIndex` via `.shiftX`, set `.dragging` + `.dragX` on dragged card, render `.drop-indicator` hairline at insertion slot, and set `suppressClickUntil` so `onCardClick` skips the trailing synthetic click.
  - On `pointerup`, snapshot `dragReleaseRects` from live `getBoundingClientRect()` **before** clearing `dragState`, dispatch `hand-reorder` (`{ orderedIds, movedCardId, targetGroup }`), and hand `dragReleaseRects` to `updated()` FLIP (with `[data-dragging-active]` CSS transition already removed) so neighbors stay put and the dragged card settles cleanly without double-animating.

### Step 3: Early Selection, Sort Toggles & Group Toolbar in [tichu-hand.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-hand.ts)

- Subscribe `TichuHand` to `window.gameModel.isCurrentPlayerActive$`, `customHandOrder$`, `cardGroups$`.
- Update `getSelectionMode()` ([tichu-hand.ts](file:///Users/brohlfs/git/tichu/src/elements/tichu-hand.ts#L159-L163)):
  - `grandTichuBets`: `this.isCurrentPlayerActive ? 0 : 2` (unlocks multi-select immediately after placing Grand Tichu bet).
  - `giveCards`: `this.isCurrentPlayerActive ? 1 : 2` (keeps single-select for slot passing while letting already-passed players organize).
  - Read-only / spectator: `0`; otherwise `2`.
- Keep `<tichu-action-bar>` untouched so no buttons shift vertically above cards (`#97310`/`#204088`). Add a fixed-height `#hand-organize-bar` directly below `#myhand` (above `#prefs`) with:
  - Sort pills: `Rank ↑` (`#order_by_rank`), `Rank ↓` (`#order_by_rank_desc`), `Suit` (`#order_by_color`), and active `Custom` pill (`#order_custom`, non-destructive indicator), all wrapped in literal `t("...")` calls with explicit light/dark high-contrast styles (`html[data-theme="dark"]`).
  - Group pills `1`, `2`, `3`, `4` (`#group_btn_1..4`): assign selected cards when `selectedCardIds.length > 0 && selectionMode === 2`, or 1-click select all cards in that group when `selectedCardIds.length === 0 && selectionMode === 2`; plus `Ungroup` and `Clear groups` buttons.

---

## 6. Verification Checklist & Regression Tests

- [ ] **TS Unit & Runtime Tests (`npm run test:validator`)**: Add tests in `tests/combo-validator.test.ts` covering `getWeightByRank` (`Dog < MJ < 2..A < Ph < D`), `getWeightByRankDesc`, `sortHandCards` with `Group 1..4` + intra-group sorting, `computeDropIndex` & drag-into-group transitions, `GameModel` 8->14->11->14->newRound `customHandOrder` + `tichu_hand_custom_order` pruning (20-table cap & round invalidation), and `TichuHand.getSelectionMode()` unlocking `2` on `!isCurrentPlayerActive` in `grandTichuBets`.
- [ ] **Full Suite (`npm run build && npm run test:contracts && npm run phpstan`)**: Zero TypeScript/PHP/contract errors; `npm test` (`test:unit` + `test:validator` + 18-suite `test:integration`) passes.
- [ ] **Local & Studio Browser Verification (`npm run local` / Studio iframe)**:
  - Run `await tt.runSuite({ speed: "instant" })` (verify `tt.assertUI()` `#myhand .stockitem` counts pass).
  - Dispatch pointer drag (`pointerdown` -> `pointermove` `> 6px` -> `pointerup`) and click `Rank ↓` / `Group 1..4`; verify cards reorder without toggling selection, switch to `preserve`, persist across `F5` within same round, clear on new round, and stay isolated per `table_id`.
  - Verify `grand_tichu` scenario unlocks card click/group selection immediately after betting `0`/`200` while bots wait, and `onEnteringStateGiveCards` clears selection cleanly.
  - Check mobile viewport (`375px` / `740px` `pan-y` vertical scroll vs `|dx| > 6` horizontal drag) and `html[data-theme="dark"]` + `&dummyTranslations`.

---

## 7. BGA Ticket Closure & Kickoff Prompt

- **Post-Deploy BGA Status & Reply Policy**: Never post to BGA without explicit user approval. Once deployed live to `boardgamearena.com`, transition both `#22264` and `#164400` from `acknowledged` -> `implemented` with plain-text replies (no Markdown backticks):
  - **#22264**: `Implemented in release <YYMMDD-HHMM> (now live)! You can now drag-and-drop cards directly in your hand to arrange any custom order, switch between Rank (ascending with Dragon/Phoenix next to Ace), Rank descending (high-to-low from Dragon/Phoenix down to 2/Mahjong/Dog), Suit, and Custom, and organize your first 8 cards right after placing your Grand Tichu bet. Custom order and combo groups persist across refreshes for the active round.`
  - **#164400**: `Implemented in release <YYMMDD-HHMM> (now live)! Alongside direct drag-and-drop hand ordering, you can now select cards and assign them to visual Combo Groups (1-4) pinned on the left of your hand with clear spacing and colored top tags, click a group tag to select all cards in that combo at once, and play or pass selected cards from any group as usual.`

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/plans/05-hand-organization-drag-reorder-and-combo-grouping.md, /Users/brohlfs/git/tichu/src/elements/tichu-stock.ts, /Users/brohlfs/git/tichu/src/elements/tichu-hand.ts, /Users/brohlfs/git/tichu/src/elements/tichu-card.ts, /Users/brohlfs/git/tichu/src/elements/game-model.ts, and /Users/brohlfs/git/tichu/src/tichu.ts.
Confirm Section 3 decisions with the user (or apply Recommended options: reorderable prop on TichuHand only, left-pinned Group 1..4 clusters with 22px gaps and top-edge/bottom-left badges, logical special weights with Rank ↓, 6px drag deadzone with FLIP handoff) and implement Steps 1–3.
Add comprehensive Node tests in tests/combo-validator.test.ts, run `npm run build && npm run test:contracts && npm run phpstan`, and verify drag-reorder, Rank ↓, Group 1..4, F5 persistence, and post-bet grandTichuBets selection on `npm run local`.
```
