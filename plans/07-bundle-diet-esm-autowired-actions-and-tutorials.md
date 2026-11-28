# 07 — Production Bundle Diet (`-249 KB`), Single-Pass ES2020, Two-Release `act*` Actions & Tutorial Creator

- **Priority**: P3 (**Track A: P2 Quick Win**)
- **Impact**:
  - **Track A (Bundle Diet)**: **High** — Cuts unminified prod `tichu.js` by **`-249.0 KB` (`-27.3%`, `913.3 KB -> 664.3 KB`)** and minified by **`-129.1 KB` (`-23.6%`, `548.1 KB -> 419.0 KB`)**, and stops shipping `4,734` lines of `window.tt` test code to live players.
  - **Tracks B–D**: **Low–Medium** — Removes legacy `.view.php`/`.tpl` boilerplate, eliminates `tichu.action.php` (`212` lines / `18` actions), and enables BGA Tutorial Creator without breaking Shadow DOM.
- **Complexity**: **Low–Medium (Track A)** -> **Low (Track B)** -> **High (Track C, 2 releases)** -> **Medium (Track D)**
- **Sequencing**: Refreshed from former Plan `18`.
  - **Track A** can ship immediately & independently with zero server/DB/skew risk.
  - **Track B** is **blocked by Plan 05** (`sounds/tichu_laser.{mp3,ogg}` must ship for 1 release before removing `tichu.view.php` & `tichu_tichu.tpl`).
  - **Track C** spans 2 production releases (`Release N`: `act*` + dual aliases + optional `.action.php` forwarder -> `Release N+1`: remove aliases & `.action.php`).
  - **Track D** is additive and safe once tutorial authoring is desired.
- **Scope**: `package.json`, `local/dev-server.mjs`, `src/tsconfig.json`, `src/tichu.ts`, `src/studio-test.ts`, `src/types/tichu-contracts.ts`, `src/elements/{styles,tichu-last-played,tichu-action-bar,tichu-hand}.ts`, `.gitignore`, `tichu.view.php`, `tichu_tichu.tpl`, `tichu.action.php`, `tichu.game.php`, `states.inc.php`, `phpstan.neon`, `tests/stubs.php`, `local/{bga-backend,router,integration-tests,race-tests,check-contracts}.php`, `local/sftp-sync.sh`, `local/js/bga-shim.js`
- **Open BGA Tickets Covered**: None (`0` open tickets; pure technical debt & platform modernization)
- **Shared ID Reservations**: Zero new option/pref/stat/global/`actionlog` IDs.

---

## 1. Current Codebase Reality (Verified Metrics & Drift)

| Area | Verified File & Lines | Current Fact / Blocker |
| :--- | :--- | :--- |
| **Bundle & TS** | `src/tichu.ts:13, 845`, `package.json:21-24`, `local/dev-server.mjs:56-81`, `src/tsconfig.json:12` | Current `tichu.js` is **`913,273 B` (`891.9 KB`)** unmin / **`548,054 B` (`535.2 KB`)** min (`dist/tichu.js` ES5 = `324,551 B` incl. `224,968 B` `studio-test.js`, plus ES6 `src/elements/elements.ts` = **`588,722 B`** unmin / `373,180 B` min across **19** `tichu-*.ts` components). Both `package.json:24` and `local/dev-server.mjs:56-81` duplicate the dual build, and `package.json:24` injects `--define:__TICHU_CODE_VERSION__="\"$npm_package_version\""` (enforced by `local/check-contracts.php:1021-1025`). |
| **Projected Track A Savings** | `src/tichu.ts` + `src/elements/elements.ts` (ES2020, no `studio-test`) | **`~664,279 B` (`648.7 KB`)** unmin / **`~418,979 B` (`409.2 KB`)** min; standalone `modules/js/studio-test.js` = `165,659 B` unmin / `87,215 B` min. *(Optional future diet beyond Track A: `rxjs` + `tslib` adds `46.0 KB` unmin / `19.9 KB` min solely for `BehaviorSubject`/`Observable`/`Subscription` in 4 files.)* |
| **Dojo Mixin & Harness** | `src/tichu.ts:2268-2280`, `local/js/bga-shim.js:4614-4642` | `declare("bgagame.tichu", ..., new Tichu())` relies on enumerable ES5 prototype methods; `?autorun` runs before an async `studio-test.js` script load unless it awaits `window.__tichuStudioTestReady`. |
| **View & Sounds** | `tichu.view.php:1-21`, `tichu_tichu.tpl:1-10`, `src/tichu.ts:547-575` | `sounds/` does not exist yet (blocked by Plan 05). `rehydrateModel()` (`L563-568`) already mounts `<tichu-game>` if missing, though `setup()` doesn't clear stale nodes. Also referenced in `local/router.php:83,599-600`, `local/bga-backend.php:908,998`, `local/integration-tests.php:22`, `phpstan.neon:6,19-20`, `local/check-contracts.php:806,1151`, `local/sftp-sync.sh:37,61-62`. |
| **Actions (18 live)** | `tichu.action.php:1-212`, `tichu.game.php`, `states.inc.php:66-246`, `src/types/tichu-contracts.ts:154-173` | **18 endpoints** now live (includes `unpassCards`, `proposeConcede`, `respondConcede`; Plan 01 Phase 2 may add `armDelayedBomb`/`cancelDelayedBomb`). `src/tichu.ts:1477,1584` & `src/studio-test.ts:1875,2032` call `giveTheCards`/`choosePhoenix` while `states.inc.php` lists `giveCards`/`phoenixPlay`. |
| **BGA Autowirer & Local Shim** | `local/Bga/GameFramework/GameAction.php:161-226`, `local/bga-backend.php:551-641`, `local/integration-tests.php:2968-3005` | `APP_Action` lacks `getRawArgValue()` and `\Bga\Config\ServerConfig`; `router.php:291`, `integration-tests.php:21,87,2968-3005`, `race-tests.php:67,121`, `phpstan.neon:5`, `check-contracts.php:805,1062-1096,1150,1721-1781`, `sftp-sync.sh:37,57` all hardcode `tichu.action.php` / `action_tichu`. |
| **Tutorial Blockers** | `src/tichu.ts:831-842, 1218-1223, 1245-1251`, `styles.ts:360`, `tichu-last-played.ts:170, 446` | 2000ms auto-timers (`visibilitychange`, `showPassedCards`, `confirmTrick`) are unguarded; `.disabler` blocks pointer hit-testing; Shadow DOM blocks `document.elementFromPoint` / `document.getElementById`. |

---

## 2. Step-by-Step Implementation Blueprint

### Track A — `-249 KB` Unminified / `-129 KB` Minified Bundle Diet & Single-Pass ES2020 (Ships Independently)

1. Add `toDojoPrototype(cls)` in `src/tichu.ts:2268-2280` copying prototype descriptors with `enumerable: true`, merging instance defaults, applying `installLegacyAccessors`, and passing to `declare("bgagame.tichu", ebg.core.gamegui, mixin)`.
2. Replace `import type` (`src/tichu.ts:10-12`) with runtime `import "./elements/elements";` (preserving type imports) and remove static `import { initStudioTestHelper } from "./studio-test"` (`src/tichu.ts:13`).
3. Replace `initStudioTestHelper(this)` (`src/tichu.ts:845`) with a host-gated loader (`studio.boardgamearena.com`, `127.0.0.1`, `localhost`) injecting `${g_gamethemeurl}modules/js/studio-test.js` and resolving `window.__tichuStudioTestReady`. Auto-invoke `initStudioTestHelper(window.gameui)` at the end of `src/studio-test.ts`.
4. Await `window.__tichuStudioTestReady` inside `local/js/bga-shim.js:4614-4642` before running `?autorun`.
5. Update `src/tsconfig.json:12` (`"target": "es2020"`), **`package.json:21,24`** (`"compile": "tsc --noEmit"`, `"bundle": "esbuild ./src/tichu.ts --bundle --format=iife --target=es2020 --define:__TICHU_CODE_VERSION__=\"\\\"$npm_package_version\\\"\" --outfile=tichu.js && mkdir -p modules/js && esbuild ./src/studio-test.ts --bundle --format=iife --target=es2020 --outfile=modules/js/studio-test.js"`), **`local/dev-server.mjs:56-81`** (matching single-pass `esbuild` + `modules/js/studio-test.js`), `.gitignore` (`modules/js/studio-test.js`), and `local/sftp-sync.sh` (allowlist `modules/js/*.js` + remote `mkdir` if needed).
6. Verify `wc -c tichu.js <= 680 KB` unmin (`<= 435 KB` min) and `npm run test:contracts` passes.

### Track B — Remove `tichu.view.php` & `tichu_tichu.tpl` *(Blocked Until Plan 05 Ships `sounds/`)*

1. Verify `sounds/tichu_laser.{mp3,ogg}` work natively on Studio and update `local/js/bga-shim.js:211` fallback from `img/` to `sounds/`.
2. Ensure `Tichu::setup()` clears stale nodes and mounts `<tichu-game>` into `#game_play_area` (deduplicating with `rehydrateModel()`).
3. Update `local/router.php:83,599-600`, `local/bga-backend.php:908,998`, `local/integration-tests.php:22`, `phpstan.neon:6,19-20`, `local/check-contracts.php:806,1151`, and `local/sftp-sync.sh:37,61-62`; `git rm` and **`sftp rm`** `tichu.view.php` and `tichu_tichu.tpl` on Studio.

### Track C — Safe Two-Release Expand-Then-Contract Autowired `act*` Actions

1. **Local Framework Upgrade**: Add `getRawArgValue(string $name): mixed` on `APP_Action` (`local/bga-backend.php:551-641`), stub `\Bga\Config\ServerConfig::areGameDebugToolsEnabled()`, and dispatch actions via `\Bga\GameFramework\GameAction::performServerAction($actionName)` in `local/router.php:291`, `local/integration-tests.php:84-94,2968-3005`, and `local/race-tests.php:121`.
2. **Release N (Expand)**:
   - Import `\Bga\GameFramework\Actions\CheckAction` and `*Param` attributes (mirror stubs in `tests/stubs.php`), add all 18+ `act*` methods on `Tichu` (preserving `acquireGameLockOrFail()`/`acquireGameLock()` first and `#[CheckAction(false)]` on out-of-turn interrupts: `actTichuBet`, `actPlayBomb`, `actPass`, `actCancelAutopass`, `actUnpassCards`, `actProposeConcede`, `actRespondConcede`, plus Plan 01 `actArmDelayedBomb`/`actCancelDelayedBomb` if landed, plus dual aliases `actGiveTheCards`/`actGiveCards` & `actChoosePhoenix`/`actPhoenixPlay`), update `states.inc.php`, `tichu-contracts.ts`, `src/tichu.ts`, `src/studio-test.ts`, and `local/check-contracts.php` (Reflection on `Tichu::act*`). Optionally keep a ~40-line `tichu.action.php` forwarder for 1 release for zero un-prefixed live-tab skew, then delete (`git rm` + `sftp rm`).
3. **Release N+1 (Contract)**: Point remaining calls to `actGiveCards` / `actPhoenixPlay`, delete legacy aliases & any transitional `.action.php`, and optionally relocate `Tichu` -> `modules/php/Game.php` (`namespace Bga\Games\Tichu`).

### Track D — BGA Interactive Tutorial Creator Support

1. Add `isTutorialMode()` / `isTutorialEditMode()` (`g_tutorialwritten?.mode || g_tutorialview`) and pause 2s auto-timers (`src/tichu.ts:831-842, 1218-1223, 1245-1251`) during tutorial/archive views.
2. Toggle `data-tutorial-mode` on `#game_play_area` and set `.disabler { pointer-events: none; }` (`styles.ts:360`, `tichu-last-played.ts:170, 446`).
3. Mount `<div id="bga_tutorial_proxies">` (`<= 300x300px` light-DOM anchors via `TutorialProxyController`) only when `isTutorialMode()` is true, covering hand cards, `#myPlayCombo`, `#myPass`, `#myPassOnce`, `#myPassTrick`, `#myPlayBomb`, `#myMakeTichuBet`, `#myConfirmTrick`, pass slots, last-played seats, and optional `#hand_sort_select` / `#toggle_card_groups` / `#concede_button` / `#settings_button`.

---

## 3. Verification Checklist

- [ ] **Track A**: `npm run build && npm run test:contracts && npm run phpstan`, `wc -c tichu.js <= 680 KB` unmin, `modules/js/studio-test.js` absent on prod hostnames, `npm run local` + `?autorun=suite` passes, Studio `Use minified JS/CSS` ON -> Revert passes.
- [ ] **Track B**: `npm run local` & Studio clean after `tichu.view.php`/`tichu_tichu.tpl` `git rm` + `sftp rm`.
- [ ] **Track C**: `npm run test:race` passes under `GameAction::performServerAction()`; Studio `sftp rm tichu.action.php` verified.
- [ ] **Track D**: Smoke-test with `g_tutorialwritten = { mode: "edit" }` verifying `#bga_tutorial_*` IDs, paused 2s timers, and non-blocking `.disabler`.
