# 13 — Modern BGA Frontend: Sounds Cleanup, Single ESM Bundle & Optional `Game.js`

- **Priority**: P3 (Architectural modernization — eliminates legacy `.tpl`/`.view.php` boilerplate and prepares Tichu for BGA's 2025+ native ESM standard)
- **Scope**: `tichu_tichu.tpl`, `tichu.view.php`, `sounds/`, `package.json` (`esbuild` pipeline), `src/tichu.ts`, `modules/js/Game.js` (Tier 3 option), `gameinfos.inc.php` / `gameoptions.jsonc` (Tier 3 option), `local/sftp-sync.sh`, `local/js/bga-shim.js`
- **Estimated Effort**: Medium (Tier 1–2) to Large (Tier 3 full native ESM) — structured cleanly into **3 progressive, stop-anytime tiers**!
- **Dependencies / Sibling Interactions**: Benefits strongly from [01 — Static Contracts](file:///Users/brohlfs/git/tichu/plans/01-static-contracts-phpstan-and-ci.md) and [12 — Sounds](file:///Users/brohlfs/git/tichu/plans/12-logs-accessibility-sounds-and-stats.md); independent of [14 — Modern BGA Backend](file:///Users/brohlfs/git/tichu/plans/14-modern-bga-backend-autowired-actions-and-namespaces.md).

---

## 1. Why & Goal

Currently Tichu's client build & mounting carry three pieces of classic 2018-era BGA scaffolding:

1. **Legacy `tichu_tichu.tpl` + `tichu.view.php` just to mount `<tichu-game>` and `<audio>` tags**: Modern BGA auto-discovers sound files placed inside `sounds/*.mp3` + `.ogg` (`this.playSound('tichu_laser')` / `this.bga.sounds.play(...)`) and lets `setup(gamedatas)` mount `<tichu-game>` directly into `this.getGameAreaElement()` (`#game_play_area`), deleting `tichu.view.php` and `tichu_tichu.tpl` completely!
2. **Awkward Dual-Pass Build (`tsc` ES5 + `esbuild` ES6 append)**: `package.json` currently compiles `src/tichu.ts` to ES5 (`dist/tichu.js`) solely so Dojo's `declare(...)` enumerates `Tichu.prototype` methods, and then appends a separate ES6 bundle of `src/elements/elements.ts` onto `tichu.js`, requiring the fragile `"import type only"` rule in `AGENTS.md`. Passing a plain descriptor-copied object (`Object.getOwnPropertyDescriptors(Tichu.prototype)`) lets `esbuild` compile EVERYTHING in a single fast modern ES2022 bundle!
3. **(Optional Tier 3) Native `modules/js/Game.js` ES Module (`this.bga.*`)**: BGA's 2025+ gold standard uses pure native ES modules (`export class Game`) importing zero Dojo globals (`define`, `declare`, `dojo.subscribe`, `this.ajaxcall`), moving to `this.bga.actions.performAction(...)`, `this.bga.notifications.setupPromiseNotifications()`, `this.bga.sounds`, and `this.bga.userPreferences` — which works seamlessly WITH BGA's Studio `"Use minified JS / CSS"` toggle!

---

## 2. Open-Source BGA References

- **Official `doc.studio.boardgamearena.com` (`modernize-bga-game-project.zip`) & `rbellec/claude-code-bga` (`references/legacy-migration.md`)**:
  - Deleting `<game>_<game>.tpl` and `<game>.view.php` when mounting via `getGameAreaElement()`.
  - Moving `img/*.mp3/.ogg` `<audio>` tags into `sounds/<name>.mp3` + `.ogg` so `disableNextMoveSound` / `playSound` work natively.
  - Migrating `tichu.js` (`define(["dojo", ...])`) -> `modules/js/Game.js` (`export class Game`), AND documenting Studio `"Use minified JS / CSS"` cache/concatenation gotchas.
- **`_ide_helper.php` & `src/types/bga-framework.d.ts` (`this.bga.*`)**: Verify exact `Bga` client API (`bga.actions.performAction`, `bga.gameArea.getElement()`, `bga.sounds.play`, `bga.notifications`) available in BGA Studio before switching Tier 3!

---

## 3. Current State in Tichu

- `tichu.view.php` (14 lines): Empty `build_page()` class (`view_tichu_tichu extends game_view`).
- `tichu_tichu.tpl` (10 lines): Only contains 4 `<audio id="audiosrc_tichu_laser...">` tags pointing to `img/tichu_laser.mp3`/`.ogg` plus `<tichu-game></tichu-game>`.
- `package.json`: `"compile": "tsc --project src/tsconfig.json"`, `"bundle": "esbuild ./dist/tichu.js --bundle --target=es5 --outfile=tichu.js && esbuild ./src/elements/elements.ts --bundle --format=iife --outfile=tichu.elements.js && cat tichu.elements.js >> tichu.js && rm tichu.elements.js"`.
- `local/sftp-sync.sh`: Hardcoded allowlist (`tichu.js`, `tichu.view.php`, `tichu_tichu.tpl`, `img/*`).
- `local/js/bga-shim.js` & `local/router.php`: Serves `tichu_tichu.tpl` HTML & provides Dojo `define`/`declare`/`ebg.core.gamegui` shim locally.

---

## 4. Decisions & Alternatives for You

Pick which Tier you want to stop at:

- **Tier 1 (Zero-Risk Cleanup — Recommended Minimum)**:
  - Move `img/tichu_laser.*` -> `sounds/tichu_laser.*` (`git mv` / copy during overlap, or check `playSound('tichu_laser')` on Studio + `bga-shim.js`).
  - Mount `<tichu-game>` dynamically in `setup(gamedatas)` inside `document.getElementById('game_play_area')` (removing duplicate if re-mounted!) and delete `tichu.view.php` + `tichu_tichu.tpl` (plus `rm` them on Studio via SFTP!).
- **Tier 2 (Single-Pass `esbuild` Bundle — Recommended!)**:
  - Keep `tichu.js` (`define(["dojo", ...])`) for instant Dojo compat, **replace** the 2-step `tsc ES5 + cat` hack with a helper converting `Tichu.prototype` getters/methods into an enumerable plain object for Dojo `declare(...)`, so **one** `esbuild src/tichu.ts --bundle --format=iife --target=es2020 --outfile=tichu.js` call handles everything cleanly (`tsc --noEmit` stays as typecheck!).
- **Tier 3 (Full Native BGA `modules/js/Game.js` ESM Migration — Optional)**:
  - Drop Dojo `define`/`declare` completely in favor of `modules/js/Game.js` using `this.bga.actions.performAction(...)`, `this.bga.sounds`, `this.bga.notifications`, deleting root `tichu.js` (and updating `local/router.php` + `local/js/bga-shim.js` + `local/sftp-sync.sh`).
  - _Note_: Only choose Tier 3 after checking `bga-platform/` / `src/types/bga-framework.d.ts` confirms `this.bga` ESM loader is 100% compatible with `local/router.php` and BGA Studio `"Use minified JS / CSS"`, AND you also check [Plan 14](file:///Users/brohlfs/git/tichu/plans/14-modern-bga-backend-autowired-actions-and-namespaces.md) (because `this.bga.actions.performAction('playCombo', ...)` seamlessly pairs with autowired PHP `actPlayCombo`!).

---

## 5. Step-by-Step Implementation Blueprint

### Step 1 (Tier 1): Migrate Sound Assets & Delete `tichu.view.php` + `tichu_tichu.tpl`

- Inspect `src/tichu.ts` around `playSound` / `tichu_laser` AND `local/router.php` + `local/js/bga-shim.js`.
- Move `img/tichu_laser.mp3` & `img/tichu_laser.ogg` -> `sounds/tichu_laser.mp3` & `sounds/tichu_laser.ogg`. Update `local/sftp-sync.sh` to upload `sounds/*`.
- In `src/tichu.ts::setup(gamedatas)`: append `<tichu-game></tichu-game>` into `document.getElementById("game_play_area")` (checking it isn't already appended) rather than relying on `tichu_tichu.tpl`.
- Update `local/router.php` so it no longer requires `tichu_tichu.tpl` / `tichu.view.php` (rendering BGA's bare `#game_play_area` wrapper instead!), and delete `tichu.view.php`, `tichu_tichu.tpl`, and `local/view/common/game.view.php` (after confirming BGA Studio auto-discovers no-tpl games cleanly, plus `sftp rm` on Studio!).

### Step 2 (Tier 2): Single-Pass Modern `esbuild` Bundle

- In `src/tichu.ts`, create `toDojoPrototype(cls)` using `Object.getOwnPropertyNames` / `Object.getOwnPropertyDescriptor` up the prototype chain to produce a plain enumerable dictionary for `declare("bgagame.tichu", ebg.core.gamegui, toDojoPrototype(Tichu))`.
- Import `./elements/elements` directly from `src/tichu.ts` (removing the fragile `import type` restriction and eliminating `dist/tichu.js` concatenation!).
- Update `package.json`: `"compile": "tsc --noEmit"`, `"bundle": "esbuild ./src/tichu.ts --bundle --format=iife --target=es2020 --outfile=tichu.js"`. Test `"build"` + `npm run local` + Studio!

### Step 3 (Optional Tier 3): Native `modules/js/Game.js` ESM & `.jsonc`

- Only if Tier 3 selected:
  - Build `src/Game.ts` -> bundled ESM `modules/js/Game.js` (`export class Game`) replacing `dojo.subscribe`, `this.ajaxcall`, `this.bgaAnimationsActive()` with `this.bga.*` APIs (verifying exact `this.bga` signatures against Studio's `_ide_helper` / `bga-platform/`).
  - Upgrade `local/js/bga-shim.js` & `local/router.php` to load `<script type="module">` `modules/js/Game.js` and stub `this.bga.*`.
  - Optionally convert `gameinfos.inc.php` / `gameoptions.inc.php` / `stats.inc.php` -> `.json` / `.jsonc` ONLY if verifying `local/bga-backend.php` + `local/check-contracts.php` read both formats cleanly.
  - Delete `tichu.js` locally AND on BGA Studio via SFTP `rm`, then test on Studio WITH `"Use minified JS / CSS"` enabled!

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **SFTP Stale File Trap on BGA Studio**: Deleting `tichu.view.php`, `tichu_tichu.tpl`, or `tichu.js` in git does NOT delete them on BGA Studio via `sftp-sync.sh`! You MUST explicitly run `rm` over SFTP (add a cleanup note or `deploy:clean` script) so Studio doesn't keep loading old `tichu_tichu.tpl` or stale `tichu.js`!
- **`"Use minified JS / CSS"` Studio Toggle**: BGA production serves minified/bundled files; ALWAYS test Studio with `"Use minified JS / CSS"` ON after changing bundle structure or moving to `modules/js/Game.js`!
- **Hot-Deploy In-Flight Browser Tabs**: If moving from `tichu.js` to `modules/js/Game.js` (Tier 3), BGA caches JS aggressively until a browser reload; Tier 1–2 keeps `tichu.js` URL identical so cache busting works cleanly via BGA's standard version mechanism.

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] `tichu.view.php` and `tichu_tichu.tpl` deleted (with `local/router.php` rendering `#game_play_area` cleanly and `<tichu-game>` mounted by JS).
- [ ] `sounds/tichu_laser.{mp3,ogg}` plays cleanly on Grand Tichu / Tichu call when `bgaAnimationsActive()` is true.
- [ ] `npm run build` runs clean single-pass typecheck (`tsc --noEmit`) + single `esbuild` output with zero Dojo prototype missing-method errors.
- [ ] Full Playwright game flow on `npm run local` + BGA Studio (with `"Use minified JS / CSS"` enabled!) passes with zero console errors.
- [ ] `local/sftp-sync.sh` updated cleanly (and obsolete Studio files `rm`'d over SFTP).

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/package.json, /Users/brohlfs/git/tichu/tichu_tichu.tpl, /Users/brohlfs/git/tichu/tichu.view.php, /Users/brohlfs/git/tichu/local/sftp-sync.sh, and /Users/brohlfs/git/tichu/plans/13-modern-bga-frontend-esm-and-sound-cleanup.md.
Ask the user whether to stop at Tier 2 (Recommended safe cleanup + single ES2020 bundle keeping Dojo wrapper) or proceed to Tier 3 (`modules/js/Game.js` ESM).
Implement the chosen tier cleanly, update `local/router.php` / `local/js/bga-shim.js` / `local/sftp-sync.sh`, run `npm run build` + `npm test`, and test locally & on Studio (with minified JS/CSS checked).
```
