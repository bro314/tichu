# 09 — Local Bomb Staging & Out-of-Turn Pre-Select UX

- **Priority**: P2 (Eliminates bomb bluff/cancel info leaks AND makes turn-based & fast real-time play snappier)
- **Scope**: `src/elements/tichu-action-bar.ts`, `src/elements/game-model.ts`, `src/elements/tichu-hand.ts`, `src/tichu.ts`, optionally `tichu.game.php` + `tichu.action.php` (`playBomb` atomic payload)
- **Estimated Effort**: Medium (Mostly client state machine + optional small atomic server bomb enhancement)
- **Dependencies / Sibling Interactions**: Strongly benefits from [04 — Client Combo Validator](file:///Users/brohlfs/git/tichu/plans/04-client-combo-validator-and-smart-play-ux.md) (`combo-validator.ts` detects legal beating bombs & beating combos client-side without extra server round-trips); respects `@thoun` autopass reset invariants from [02](file:///Users/brohlfs/git/tichu/plans/02-agent-skills-and-docs-restructure.md).

---

## 1. Why & Goal

Two subtle UX and information-leak issues affect mid-trick decision making in Tichu:

1. **Premature Bomb Broadcast & Cancel Leak (`ST_PLAY_BOMB`)**: Right now, clicking `"Play a Bomb"` (`playBomb` out-of-turn action) immediately enters `ST_PLAY_BOMB` on the **server** and notifies the whole table _"Alice wants to play a bomb!"_ BEFORE Alice even selects which bomb she wants to play — and if she clicks Cancel, the whole table knows she either bluffed or decided not to drop a bomb! Even worse, if two players click Bomb, server state contention rises.
   - Instead, players should **select/stage their bomb locally** (`Odin`-style local staging UI), validate it client-side with `combo-validator.ts`, and only send the bomb to the server when they actually click `"Confirm Bomb!"`!
2. **Out-of-Turn Pre-Select (`The Crew` / `Coinche` pattern) & Autopass Clarity**: When it's not your turn, you already have a pair or bomb selected and ready — as soon as the previous player plays or passes (matching what you expected), having to wait and click again in fast games or multi-window play feels slow, whereas `"Autopass"` currently looks like an opaque state toggle without clear arming/disarming rules.

Goal:

- Stage `"Play a Bomb"` completely locally on the client (zero info leak on cancel, 1-click atomic confirmation).
- Add an optional, strictly safety-guarded `"Pre-select Play"` toggle out of turn that arms your chosen combo against the _exact_ current table state and auto-disarms cleanly if `lastCombo` or `mahjongWish` changes before your turn!
- Show a crisp, unambiguous badge/pill whenever Autopass is armed so nobody forgets why their turn skipped.

---

## 2. Open-Source BGA References

- **`The Crew` & `Coinche`**: Client-side out-of-turn `"Pre-select card / play"` button showing a distinct armed border (`"Pre-selected (Pair of Kings)"`) that submits automatically on your `onEnteringState("playCombo")` IF and ONLY IF the trick context hash (`lastCombo` + `mahjongWish`) matches what you armed against.
- **Tichu's own `ST_PLAY_BOMB` flow (`tichu.game.php`, `states.inc.php`)**: Currently uses a 2-step flow (`playBomb()` empty call -> `ST_PLAY_BOMB` -> `playCombo()` / `cancel()`). Keep the server state backwards-compatible for existing games while letting the client submit the cards cleanly!

---

## 3. Current State in Tichu

- `src/tichu.ts` & `src/elements/tichu-action-bar.ts`:
  - Clicking `#myPlayBomb` while another player is active sends `playBomb` (zero card args), moving the whole table to `ST_PLAY_BOMB` (`55`), disabling `.disabler` for opponents, and prompting the bomber to select cards + click Play or Cancel.
  - Meanwhile `autopass` can be armed out of turn via `#myPass` / `pass` endpoint (`player_pass = 1` in DB) and cancelled via `cancelAutopass`.
- `src/elements/utils.ts`: Has `hasBomb()` to check whether `#myPlayBomb` is shown.

---

## 4. Decisions & Alternatives for You

1. **How Local Bomb Staging Submits to the Server**:
   - **Option A (Recommended — Atomic 1-Request `playBomb` with optional `cards` param)**: Update `tichu.action.php::playBomb()` and `Tichu::playBomb(?string $cardIds = null)` so if `cards` is provided, the server acquires `acquireGameLock()`, validates the bomb directly in one atomic step (entering `ST_PLAY_BOMB` -> immediately invoking `playCombo` logic inside the same transaction/turn, preserving `ST_PLAY_BOMB` ONLY as legacy fallback when `cards` is omitted by old client tabs!). Zero server blip, zero info leak on cancel, zero mid-flight bomb lock window!
   - **Option B (Client-only 2-step chain)**: Keep `playBomb` empty, then auto-send `playCombo` right after `playBomb` returns. _Slower and still emits an awkward intermediate notification if the bomb fails validation._
2. **Pre-Select Mode Behavior (`Auto-submit` vs `Pre-fill + 1-click`)**:
   - **Option A (Recommended — Guarded Opt-in Auto-Play)**: While out of turn during `ST_PLAY_COMBO`, selecting a **valid beating combo** (verified by [Plan 04](file:///Users/brohlfs/git/tichu/plans/04-client-combo-validator-and-smart-play-ux.md)'s `combo-validator.ts`) shows `"Pre-play: <Combo Name>"`. Clicking it locally freezes a snapshot `{ cardIds, trickId, expectedLastComboKey, expectedWish }`. Notice:
     - If **any player plays a new combo** (`lastCombo` changes), **another player goes out**, or **someone drops a bomb**, immediately **disarm** the pre-select with a subtle toast/flash (_"Pre-play cancelled: table changed"_) so you NEVER accidentally burn a combo onto the wrong trick!
     - If opponents simply **pass** around to you and `expectedLastComboKey` + `expectedWish` match identically, automatically submit `playCombo` once `onEnteringState('playCombo')` fires for you!
     - Mutual exclusion: Arming Pre-play disables Autopass (and arming Autopass cancels Pre-play).
   - **Option B**: Skip Pre-play entirely, keep only Local Bomb Staging + Autopass pill. (Cleanly separable if you only want Bomb Staging!)

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Local Bomb Staging UI (`tichu-action-bar.ts` & `game-model.ts`)

- Add `bombStagingMode$: BehaviorSubject<boolean>` in `GameModel` (client-only, reset on round/trick end or Cancel).
- When the player holds a bomb (detected via `combo-validator.ts` / `hasBomb`) and it is NOT their turn (during `ST_PLAY_COMBO` / `ST_CONFIRM_TRICK`), clicking `#myPlayBomb` ("Play a Bomb"):
  - Enters `bombStagingMode = true` **locally only** (ZERO network call!).
  - Highlights the hand border subtly in bomb-red/amber, shows instructions `"Select your 4-of-a-kind or Straight Flush bomb"`, and changes action bar buttons to `"Confirm Bomb (<name>)"` (disabled until selected cards form a valid beating bomb per `combo-validator.ts`!) and `"Cancel"`.
  - Clicking `"Cancel"` simply exits `bombStagingMode = false` with zero server notification or leak.

### Step 2: Atomic `playBomb($cards)` Backend Support (Option A)

- Inspect `tichu.action.php::playBomb` and `tichu.game.php::playBomb`.
- Accept optional `$cards = self::getArg("cards", AT_numberlist, false, "");` in `tichu.action.php::playBomb()`.
- In `Tichu::playBomb(?string $cardIds = null)`:
  - Retain existing `ST_PLAY_BOMB` transition when `$cardIds` is empty (backwards compatibility for running tabs).
  - When `$cardIds` is non-empty: validate under `acquireGameLock()` that state allows bomb interrupts (`ST_PLAY_COMBO` or `ST_CONFIRM_TRICK` — same precondition as existing `playBomb()`!), validate the cards form a true bomb beating `lastCombo` (`Combo::isBomb()` + `canBeat`), transition cleanly through `ST_PLAY_BOMB` (updating stats `bomb_number`, clearing `player_pass` autopass flags per `@thoun`'s invariant!), play the combo, and advance to the next player cleanly. Add integration test in `local/integration-tests.php` AND `local/race-tests.php` (two simultaneous bombs racing!).

### Step 3: Guarded Out-of-Turn Pre-Select & Autopass Pill

- In `GameModel`: track `preselect$: BehaviorSubject<{ cardIds: number[]; trickNumber: number; lastComboSignature: string; wish: number } | null>`.
- Show `"Pre-select (<ComboName>)"` button only when `!isCurrentPlayerActive`, state === `ST_PLAY_COMBO`, and selected cards beat `lastCombo` + fulfill `mahjongWish` (`combo-validator.ts`).
- Subscribe inside `Tichu` / `GameModel`:
  - Clear `preselect$` cleanly whenever `lastCombo`, `trickNumber`, `mahjongWish`, or `handCards` changes!
  - In `onEnteringState('playCombo')`: if `this.isCurrentPlayerActive()` and `!this.isReadOnly()` and `preselect$` matches current `{ trickNumber, lastComboSignature, wish }`, clear `preselect$` and immediately invoke `playCombo` with `preselect.cardIds`.
- Add a visible `"Autopass armed (Click to cancel)"` banner/pill in `<tichu-action-bar>` whenever `autopass` is armed (`Cancel Autopass`), and audit server `pass` resets (`@thoun` invariant: whenever `lastCombo` changes, bomb interrupts, or new trick/round starts, clear `player_pass`).

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **Autopass vs Pre-Play Race**: Never allow clicking `"Pre-select"` while `autopass` is set without first firing `cancelAutopass` (or wait for `cancelAutopass` callback before setting `preselect$`), otherwise the server might auto-pass you before `onEnteringState('playCombo')` runs on the client!
- **Simultaneous Bomb Race**: Two players locally stage bombs and click `"Confirm Bomb!"` within 20ms of each other. Under `acquireGameLock()`, the first bomb executes cleanly (moving active player and changing `lastCombo`); the second request MUST re-read `lastCombo` under the lock and either throw `UserException` ("Too late — another bomb was played") if weaker, or beat the first bomb if strictly stronger! Test this exact race in `local/race-tests.php`!
- **State Machine Invariant**: Do NOT delete `ST_PLAY_BOMB` (`55`) from `states.inc.php` — keep it for backwards compatibility and clean notification/state transitions.
- **Sibling Plans**: Depends smoothly on [04](file:///Users/brohlfs/git/tichu/plans/04-client-combo-validator-and-smart-play-ux.md) for `combo-validator.ts`; updates `TichuActionMap` in [01](file:///Users/brohlfs/git/tichu/plans/01-static-contracts-phpstan-and-ci.md); if [14](file:///Users/brohlfs/git/tichu/plans/14-modern-bga-backend-autowired-actions-and-namespaces.md) runs later, keep `#[CheckAction(false)]` and optional `cards` arg on `actPlayBomb()`.

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] Clicking `"Play a Bomb"` out of turn keeps zero network traffic until `"Confirm Bomb"` is clicked; `"Cancel"` emits zero server notifications.
- [ ] Confirming a valid bomb beats the current trick in 1 round-trip cleanly and updates `bomb_number` stat + trick state; trying an invalid selection stays blocked locally (and rejected cleanly by server).
- [ ] Concurrent 2-bomb race test added to `local/race-tests.php` passes cleanly.
- [ ] Pre-selecting a combo auto-plays ONLY if `lastCombo` + `mahjongWish` + `trickNumber` remain identical when turn arrives; any intervening play/bomb disarms pre-select safely with visible feedback.
- [ ] `npm run build` and `npm test` pass cleanly.

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/tichu.game.php (bomb handling & acquireGameLock), /Users/brohlfs/git/tichu/src/elements/tichu-action-bar.ts, and /Users/brohlfs/git/tichu/plans/09-bomb-staging-and-preselect-ux.md.
Confirm Section 4 decisions with the user (Option A defaults: atomic 1-request `playBomb($cards)` + guarded Pre-select) and implement Steps 1–3.
Add both an integration test and a 2-bomb race test in `local/race-tests.php`, then run `npm run build`, `npm test`, and `npm run test:race`.
```
