# 03 — Zero-Reload Preferences & Two-Way UI Sync

- **Priority**: P1 (High UX impact: stops jarring page reloads mid-game and makes in-hand controls sync permanently)
- **Scope**: `gameoptions.inc.php`, `src/tichu.ts`, `src/elements/tichu-hand.ts`, `src/elements/game-model.ts`
- **Estimated Effort**: Small (1–2 hours; clean client + `gameoptions.inc.php` wiring)
- **Dependencies / Sibling Interactions**: Can be implemented anytime; coordinate preference IDs if adding colorblind/sound prefs in [12 — Logs, Accessibility, Sounds & Stats](file:///Users/brohlfs/git/tichu/plans/12-logs-accessibility-sounds-and-stats.md) or hand sort persistence in [08 — Hand Organization](file:///Users/brohlfs/git/tichu/plans/08-hand-organization-passed-cards-and-unpass.md).

---

## 1. Why & Goal

Today, **all five** Tichu user preferences (`100` Table Layout, `101` Order of play, `102` Prevent passing when cards are selected, `103` Tiki Edition Art, `104` Color Theme) have `"needReload" => true` in `gameoptions.inc.php`. Worse:

1. Changing any preference in BGA's user settings menu forces a full browser reload, even though `src/tichu.ts` **already updates CSS classes/DOM live** in `onPreferenceChange()`!
2. `onPreferenceChange()` in `src/tichu.ts:265-280` handles `100`, `101`, `103`, `104` — **but forgot `case 102`** (`confirmPassWithSelection`)!
3. `src/tichu.ts` wires **both** Dojo preference listeners (`onGameUserPreferenceChanged` and `initPreferencesObserver`), causing redundant handling.
4. In-hand preference toggles in `src/elements/tichu-hand.ts` (`#prefs`, `#themes`, Square/List layout) are **one-way only**: clicking a theme swatch changes the local view for this page load while showing an apologetic tooltip saying you must change it _"permanently in the user settings"_, instead of calling BGA's `this.setGameUserPreference(prefId, value)` directly.
5. Player's chosen hand sort mode (`rank` / `color` / `preserve` in `<tichu-stock>`) isn't persisted across reloads.

Goal: Instant, reload-free two-way preference sync between BGA's settings panel and Tichu's in-hand controls, with safe fallbacks for spectators and replays.

---

## 2. Open-Source BGA References

- **BGA Studio JS API (`src/types/bga-framework.d.ts` / `bga-platform/`)**:
  - `this.setGameUserPreference(prefId, value)` sends an AJAX preference update back to BGA and triggers `onGameUserPreferenceChanged(prefId, prefValue)` without reloading when `"needReload" => false`.
  - `this.getGameUserPreference(prefId)` returns the current preference value (note: historically throws or returns `undefined` for spectators/archive replays in older BGA builds — requires defensive guarding!).
- **`Azul` / `Odin` / `7 Wonders` (modern open-source BGA repos)**: Setting `"needReload" => false` for cosmetic/layout/UX prefs, writing two-way UI toggles via `setGameUserPreference`, and guarding preference reads during `isSpectator` / `g_archive_mode`.

---

## 3. Current State in Tichu

- **`gameoptions.inc.php:74-125`**: Prefs `100`, `101`, `102`, `103`, `104` all set `"needReload" => true`.
- **`src/tichu.ts:220-290` & `345-485`**:
  - `readPrefs()` reads `this.prefs[100..104]`.
  - `initPreferencesObserver()` hooks `dojo.query(".preference_control").on("change", ...)` alongside BGA's native `onGameUserPreferenceChanged(pref_id, pref_value)` hook.
  - `onPreferenceChange(prefId, prefValue)` handles `case 100` (layout), `case 101` (order of play), `case 103` (Tiki art), `case 104` (theme `0..10`) — **missing `case 102`**.
- **`src/elements/tichu-hand.ts`**: Renders layout/theme/Tiki quick toggles inside `#prefs` / `#themes` that mutate `GameModel` locally without persisting to BGA user preferences, and carry tooltips telling players it is temporary.

---

## 4. Decisions & Alternatives for You

1. **Where to persist Hand Sort Order (`rank` / `color` / `preserve`)**:
   - **Option A (Recommended) (CONFIRMED)**: Store in `localStorage` (`tichu_hand_sort_order`) for instant per-browser persistence without adding a new BGA user preference slot (keeping `"preserve"` cleanly per-table or resetting gracefully on new deal).
   - **Option B**: Add User Preference ID `105` in `gameoptions.inc.php` (`Sort by Rank` / `Sort by Suit`). _Note_: BGA syncs prefs `105` across devices via server DB, which is nice, OR you can keep `105` for Rank vs Suit (`0`/`1`) and still let `"preserve"` (custom drag order) live cleanly in `localStorage` / table state.
2. **Spectator & Archive Replay Preference Access (`safeGetPref`)**:
   - **Option A (Recommended) (CONFIRMED)**: Write a `safeGetPref(prefId: number, fallback: number): number` helper checking `typeof this.getGameUserPreference === "function"` inside `try/catch`, falling back to `this.prefs?.[prefId]?.value ?? fallback`. Never assume `this.prefs` is populated in archive mode.
3. **Should changing Order of Play (`101`) also re-render without reload?**:
   - **Option A (Recommended) (CONFIRMED)**: Yes — verify `onPreferenceChange(101, val)` updates `GameModel.orderOfPlay$` / player panel ordering cleanly (check `tichu-last-played.ts` & `tichu-pass-area.ts` seat rotation!) so `"needReload" => false` works cleanly for `101` as well as `100, 102, 103, 104`.

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Set `"needReload" => false` in `gameoptions.inc.php`

- Change `"needReload" => true` to `"needReload" => false` on preferences `100`, `101`, `102`, `103`, `104` (after verifying live CSS/DOM re-layout for `101` in Step 3).
- Check `local/bga-backend.php` and `local/js/bga-shim.js` to make sure local dev bar preference dropdowns call `onGameUserPreferenceChanged` without reloading.

### Step 2: Consolidate Preference Reading & Listening in `src/tichu.ts`

- Inspect `src/tichu.ts:220-290`:
  - Add `safeGetPref(prefId: number, fallback: number): number`.
  - Remove the duplicate `initPreferencesObserver()` `dojo.query(".preference_control")` listener if `onGameUserPreferenceChanged(prefId, prefValue)` already fires natively on BGA (verify against `bga-shim.js` and Studio `_ide_helper`/platform JS so local dev controls still fire `onGameUserPreferenceChanged`).
  - Add `case 102:` in `onPreferenceChange()` to update `this.gameModel.confirmPassWithSelection$` (or wherever `pref 102` is stored — read lines `100-350` of `src/tichu.ts` and `game-model.ts` to confirm the exact property name).

### Step 3: Verify Live Re-layout for Preference `101` (Order of Play) & `100` (Table Layout)

- Read `src/tichu.ts`, `src/elements/tichu-last-played.ts`, and `src/elements/tichu-pass-area.ts` where `orderOfPlay` / `playerOrder` affects clockwise vs counter-clockwise seat boxes.
- Ensure toggling `101` live recomputes seat layout / `GameModel` observables immediately with no stale positions or lingering animations.
- Ensure `this.rescale()` runs when toggling `100` (Square vs List layout).

### Step 4: Two-Way Persistence from `<tichu-hand>` & `<tichu-card>` Toggles

- In `src/elements/tichu-hand.ts`:
  - When the user clicks Table Layout, Tiki Art, or a Color Theme swatch, call back into `Tichu` (via custom event on `<tichu-hand>` or `GameModel` callback) to invoke `this.setGameUserPreference(prefId, newValue)` when `!this.isReadOnly()`.
  - Remove the outdated _"temporarily; change permanently in user settings"_ tooltip text from `tichu-hand.ts` so UI reflects instant permanent saving.
- Persist hand sort selection (`rank` / `color` — and optionally `preserve`) in `localStorage` so refreshing or starting the next hand honors the player's last chosen sort mode.

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **Spectator `setGameUserPreference` Error**: Never call `this.setGameUserPreference(...)` when `this.isReadOnly()` is true (spectator or replay mode), as BGA rejects the AJAX call with an error popup. In read-only mode, allow local-only theme/layout preview without calling `setGameUserPreference`.
- **Feedback Loop Guard**: Calling `setGameUserPreference(104, 3)` triggers `onGameUserPreferenceChanged(104, 3)` on BGA; ensure `onPreferenceChange` is idempotent and does not re-call `setGameUserPreference`!
- **Replay Mode Consistency**: Check `tichu-replay.ts` so theme/Tiki toggles in archive replay still work purely locally without touching `setGameUserPreference`.
- **Sibling Plans**: Any new preferences added later (e.g., colorblind pips or SFX toggle in [Plan 12](file:///Users/brohlfs/git/tichu/plans/12-logs-accessibility-sounds-and-stats.md)) should follow this exact `"needReload" => false` + `safeGetPref` + `onGameUserPreferenceChanged` pattern.

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [x] `gameoptions.inc.php` has `"needReload" => false` for prefs `100..104`.
- [x] Toggling prefs `100`, `101`, `102`, `103`, `104` via BGA settings dropdown updates UI immediately **without** page reload.
- [x] Clicking theme/layout/Tiki buttons in `#myhandwrap` calls `setGameUserPreference` and persists across an explicit browser refresh (`F5`).
- [x] No `"temporarily"` apology tooltip text remains in `src/elements/tichu-hand.ts`.
- [x] Spectator / Archive replay mode loads without console errors (`safeGetPref` returns fallback cleanly) and local preview toggles don't fire AJAX errors.
- [x] `npm run build` and `npm test` pass; local Playwright/browser verification confirms live switching + `localStorage` sort persistence.

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md and /Users/brohlfs/git/tichu/plans/03-zero-reload-preferences-and-two-way-sync.md.
Confirm Section 4 decisions (Option A defaults: localStorage for hand sort, safeGetPref guard, live re-layout for 101) and execute Steps 1–4 across `gameoptions.inc.php`, `src/tichu.ts`, `src/elements/game-model.ts`, `src/elements/tichu-hand.ts`, and `local/js/bga-shim.js` if needed.
Build (`npm run build`), run `npm test`, and test live preference switching + F5 persistence + spectator safety on `npm run local`.
```
