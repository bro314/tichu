# 05 — FLIP Card-Flight Animations & Polish

- **Priority**: P1 (Brings Tichu's visual game feel up to top modern BGA card games like `Odin` and `The Crew`)
- **Scope**: Light-DOM `<tichu-animation-layer>` on `document.body`, `src/elements/tichu-stock.ts`, `src/elements/tichu-hand.ts`, `src/elements/tichu-last-played.ts`, `src/elements/tichu-pass-area.ts`, `src/elements/tichu-player-panel.ts`, `src/tichu.ts`
- **Estimated Effort**: Medium–Large (Shadow DOM + CSS `rescale()` coordinate-space bridge + WAAPI choreography)
- **Dependencies / Sibling Interactions**: Uses `bgaAnimationsActive()` guard from [00](file:///Users/brohlfs/git/tichu/plans/00-live-bugs-and-bga-compliance-fixes.md); respects [06 — Mobile Layout](file:///Users/brohlfs/git/tichu/plans/06-mobile-viewport-and-14-card-hand-layout.md) card sizing and [13 — ESM Cleanup](file:///Users/brohlfs/git/tichu/plans/13-modern-bga-frontend-esm-and-sound-cleanup.md) if ever moving to `bga-animations`.

---

## 1. Why & Goal

Right now, cards in Tichu largely **teleport** between states: playing a 5-card Straight or Bomb abruptly disappears from `#myhand` (or shrinks a sidebar count) and appears statically in `<tichu-last-played>`, collecting a trick vanishes the table cards immediately, and switching hand sort order (`Rank` ↔ `Suit`) jumps rows without continuity.

Modern BGA trick-taking/climbing hits (`Odin`, `The Crew`, `Solo`, `Papayoo`, `thoun/bga-cards` + `bga-animations`) create tactile, readable flow via lightweight FLIP / WAAPI animations:

1. **Play Combo / Bomb Flight**: Played cards fly smoothly from the acting player's hand (`<tichu-stock>` card rect for you, or `<tichu-player-panel>` badge rect for other seats) to their final slots inside `<tichu-last-played>`.
2. **Trick Capture Sweep (`The Crew` linger rule)**: Before clearing the table to the winner's `<tichu-player-panel>`, briefly highlight/hold the winning combo slightly (~150ms stagger or border flash) so players actually register _who_ won and _with what_, then sweep the stack into the winner's panel (or chosen Dragon gift opponent!).
3. **Deal & Pass Card Flight**: Initial 8-card and 6-card deals + 3-card pass acceptance glide cards smoothly into place.
4. **Hand Sort / Reorder FLIP (`Odin` pattern)**: When toggling `Rank` ↔ `Suit` (or moving cards in [Plan 08](file:///Users/brohlfs/git/tichu/plans/08-hand-organization-passed-cards-and-unpass.md)), existing cards glide smoothly to their new horizontal offsets via FLIP (`First -> Last -> Invert -> Play`).

---

## 2. Open-Source BGA References

- **`bga-animations` (BGA official `BgaAnimations` / `thoun/bga-animations`) & `Odin` / `The Crew`**:
  - Core pattern: capture source `DOMRect`, render destination statically invisible (`visibility: hidden`), capture destination `DOMRect`, animate temporary ghost clone via Web Animations API (`element.animate(...)`) at `document.body` / fixed overlay layer, reveal destination, destroy ghost, and await completion inside synchronous notification handlers (`notifqueue.setSynchronous(...)`).
  - **`The Crew` trick linger detail**: Losing plays sweep first or fade slightly while the winning card lingers +150ms longer before all cards sweep to the winner's avatar.
- **Tichu's specific Shadow DOM architecture (`AGENTS.md`)**: Tichu already mounts `<tichu-trick-modal>` directly on `document.body` specifically because `#game_play_area_wrap` applies CSS `transform: scale(...)` via `rescale()`, which creates a transformed containing block breaking `position: fixed`.

---

## 3. Current State in Tichu

- Every `<tichu-game>`, `<tichu-hand>`, `<tichu-last-played>`, `<tichu-pass-area>`, `<tichu-stock>`, and `<tichu-card>` renders inside **Lit Shadow DOM**. `element.getBoundingClientRect()` works _across_ Shadow DOM boundaries and _already incorporates_ `rescale()` CSS transforms in viewport coordinates!
- `src/tichu.ts` subscribes to `dealCards`, `playCombo`, `playBomb`, `acceptCards`, `confirmTrick`, `dragonGift`, etc. and updates `GameModel` RxJS subjects immediately, with `setSynchronous(...)` durations mostly static or short.
- In replay mode (`tichu-replay.ts`), `skip` / fast-forward steps and `instantaneousMode` must skip animations synchronously (`0ms`).

---

## 4. Decisions & Alternatives for You

1. **Custom Shadow-DOM-aware WAAPI `<tichu-animation-layer>` vs. `bga-animations` library**:
   - **Option A (Recommended)**: Build a lightweight ~200-line Lit `<tichu-animation-layer>` mounted on `document.body` (`position: fixed; inset: 0; pointer-events: none; z-index: 950;`) that renders lightweight ghost `<tichu-card>` elements (reusing Tichu's exact Tiki/standard sprite math & `--card-width` scale!) using viewport `DOMRect`s. Zero third-party Dojo dependencies, clean Shadow DOM boundary crossing, instant cancellation on `instantaneousMode` / speed-up.
   - **Option B**: Pull `bga-animations` (`BgaAnimations.Manager`). _Drawback_ — `bga-animations` clones DOM nodes into an ancestor element inside `#game_play_area`, which hits Shadow DOM encapsulation walls (`attachShadow`) and `rescale()` distortion unless re-wrapped awkwardly.
2. **Respecting BGA Animation Speed & Replay Fast-Forward**:
   - **Option A (Recommended)**: Helper `shouldAnimate(): boolean` returns `false` whenever `!this.bgaAnimationsActive()`, `this.instantaneousMode`, `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, or `window.__tichuSpeed === 'instant'`. Every animation resolves immediately with `0ms` in those cases so Playwright tests (`BGA_STUDIO_TESTING`), slow-connection fast-forwards, and `F5` replay catch-ups stay instant!
3. **Notification Queue Pacing**:
   - **Option A (Recommended)**: Make `notif_playCombo`, `notif_playBomb`, `notif_confirmTrick`, `notif_dragonGift`, and `notif_acceptCards` signal BGA's `notifqueue.setSynchronous(notifName)` dynamically (calling `this.notifqueue.setSynchronousDuration(0)` or `setSynchronous(..., 0)` / resolving a synchronous promise or finishing inside the animation duration) so notifications never visually overlap or mutate the next state mid-flight.

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Build `<tichu-animation-layer>` (`src/elements/tichu-animation-layer.ts`)

- Mount once on `document.body` (matching `<tichu-trick-modal>` pattern, cleaning up properly on destroy if needed).
- Expose `flyCards(flights: Array<{ card: CardData; fromRect: DOMRect; toRect: DOMRect; delayMs?: number; durationMs?: number; fadeOut?: boolean }>): Promise<void>`:
  - Computes effective scale from `fromRect.width` -> `toRect.width` (preserving smooth size interpolation between `0.75` table card size / `0.5` panel mini card / `1.0` hand card!).
  - Uses Web Animations API (`ghost.animate([{ transform: ..., opacity }, { transform: ..., opacity }], { duration, delay, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' })`).
  - Supports `cancelAll()` for instant state resets (`setup`, replay scrub, `instantaneousMode`).

### Step 2: Querying Source & Destination Rects Inside `<tichu-stock>` / Panels

- Add clean query helpers on `<tichu-stock>` (`getCardRects(cardIds: number[]): Map<number, DOMRect>` and `markPendingReveal(cardIds)` using `visibility: hidden` during flight) and `<tichu-hand>`, `<tichu-last-played>`, `<tichu-player-panel>`, `<tichu-pass-area>` (`getSeatAnchorRect(playerId)`).
- Always wait for Lit's `await element.updateComplete` after updating `GameModel` so destination `<tichu-card>` slots have exact post-layout `DOMRect`s _before_ starting the WAAPI flight!

### Step 3: Wire Core Game Flights in `src/tichu.ts` / `GameModel`

1. **Play Combo & Bomb**: Capture `fromRects` from `<tichu-hand>` (if `playerId === currentPlayerId`) or `<tichu-player-panel>` badge before removing cards from hand; update `<tichu-last-played>` with hidden newly-added cards; `await updateComplete`; fly ghosts (`~280ms`, bombs slightly faster/snappier `~220ms` with subtle scale pulse); reveal destination cards.
2. **Confirm Trick / Dragon Gift**: Capture all combo cards on `<tichu-last-played>` (`toRect` = trick winner `<tichu-player-panel>`, or Dragon recipient `<tichu-player-panel>`!). Hold the winning combo `+150ms` (`The Crew` rule) while non-winning cards sweep first, then sweep winning combo + clear table.
3. **Deal Cards (8 & 6) & Accept Passed Cards**: Fan-stagger incoming flights (`delayMs = idx * 25ms`) from center table deck / `<tichu-pass-area>` slot to `<tichu-hand>`.

### Step 4: FLIP Sort Animation inside `<tichu-stock>`

- In `src/elements/tichu-stock.ts`, before changing `sortMode` (`rank` ↔ `color`) or hand order:
  - Record `prevRects: Map<cardId, DOMRect>` of currently rendered `<tichu-card>` items.
  - On `updated()`, when `shouldAnimate()` is true and card set didn't jump dramatically, invert delta `(prev.left - next.left, prev.top - next.top)` via WAAPI (`~220ms ease-out`) on each moved `<tichu-card>`.

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **`updateComplete` & Double-Frame Safety**: Calling `getBoundingClientRect()` right after setting a Lit property without `await this.updateComplete` reads stale pre-render rects. Always await `updateComplete` on the target container!
- **`instantaneousMode` / Page Visibility Tab Throttling**: When a browser tab was backgrounded, `document.hidden` is true or many notifications replay rapidly (`bgaAnimationsActive() === false`). `shouldAnimate()` MUST return `false` when `document.hidden` or `!bgaAnimationsActive()`, avoiding queued phantom ghost cards stacking up!
- **Playwright Determinism**: Do NOT break existing Playwright Studio tests — expose/respect `window.__tichuSpeed === 'instant'` (or fast-path when `instantaneousMode` is active) and never block pointer clicks on the fixed `<tichu-animation-layer>` (`pointer-events: none`).
- **Sibling Plans**: Works seamlessly with [03 — Zero-Reload Preferences](file:///Users/brohlfs/git/tichu/plans/03-zero-reload-preferences-and-two-way-sync.md) (Tiki art toggle affects ghost cards immediately), [06 — Mobile Layout](file:///Users/brohlfs/git/tichu/plans/06-mobile-viewport-and-14-card-hand-layout.md) (reads live `DOMRect.width` rather than hardcoded `100x150`), and [08 — Hand Organization](file:///Users/brohlfs/git/tichu/plans/08-hand-organization-passed-cards-and-unpass.md) (drag reorder + passed card reveal).

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] `npm run build` and `npm test` pass cleanly.
- [ ] On `npm run local`, playing a combo, playing a bomb, collecting a trick (`confirmTrick` + `dragonGift`), dealing cards, accepting passed cards, and toggling Rank/Suit sort all animate smoothly at 60fps with zero visual flicker or clipping under `rescale()`.
- [ ] Toggling BGA animations off (`bgaAnimationsActive() === false`), enabling OS `prefers-reduced-motion`, or running `instantaneousMode` / replay scrub skips flights instantaneously (`0ms`) without orphaned ghost elements in `document.body`.
- [ ] Zero overlapping notifications or lost mouse clicks during flights (`pointer-events: none`).

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/src/tichu.ts, /Users/brohlfs/git/tichu/src/elements/tichu-stock.ts, and /Users/brohlfs/git/tichu/plans/05-flip-card-flight-animations.md.
Confirm Section 4 choices (default: Option A custom Light-DOM <tichu-animation-layer> + WAAPI + `shouldAnimate()` fast-path) and implement Steps 1–4.
Build (`npm run build`), run `npm test`, and visually verify deal, play, trick sweep, dragon gift, and sort FLIP animations (plus instant-mode cleanup) on `npm run local`.
```
