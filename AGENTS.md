# AGENTS.md — Tichu for Board Game Arena (BGA)

Compact architecture, invariants, and command guide for **Tichu** on [Board Game Arena (BGA)](https://boardgamearena.com). Deep task playbooks live in `.agents/skills/` (load on demand).

---

## 1. Progressive-Disclosure Skills & Reference Docs

| Topic / Trigger                                                                             | Read Before Acting                                                                                         |
| :------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------- |
| **Studio SFTP sync, `browser` subagent, `#studio-test-bar`, `window.tt`, `npm run local`**  | [bga-studio-testing](file:///Users/brohlfs/git/tichu/.agents/skills/bga-studio-testing/SKILL.md)           |
| **Actions, multiactive/out-of-turn locks, MySQL 8.0 `SERIALIZABLE`, `npm run test:race`**   | [tichu-concurrency-locks](file:///Users/brohlfs/git/tichu/.agents/skills/tichu-concurrency-locks/SKILL.md) |
| **Production releases, `upgradeTableDb`, `@thoun` autopass resets, i18n, Tutorial Creator** | [bga-release-and-qa](file:///Users/brohlfs/git/tichu/.agents/skills/bga-release-and-qa/SKILL.md)           |
| **BGA bug reports (`game=1237`), SQL dump import, 7-surface `player_id` remapping**         | [bga-bug-triage](file:///Users/brohlfs/git/tichu/.agents/skills/bga-bug-triage/SKILL.md)                   |

- **Authoritative Stubs (Beat the Wiki)**: [`_ide_helper.php`](file:///Users/brohlfs/git/tichu/_ide_helper.php) (PHP) and [`src/types/bga-framework.d.ts`](file:///Users/brohlfs/git/tichu/src/types/bga-framework.d.ts) (JS/TS). Re-download `/tichu/_ide_helper.php` via SFTP if checking newer Studio APIs.
- **Official BGA Docs**: https://doc.studio.boardgamearena.com/ (2025–2026 PHP 8.4/ES2022) and https://en.doc.boardgamearena.com/Studio (classic `Deck`/`ebg/stock`).
- **Community & Bug Tracker**: https://github.com/rbellec/claude-code-bga (`TECHNICAL_NOTES.md`, `references/*`) and Tichu bugs at https://boardgamearena.com/bugs?game=1237 (`bug?id=<BUG_ID>`).
- **Ecosystem Research & Plans**: [`docs/BGA_OPEN_SOURCE_ECOSYSTEM.md`](file:///Users/brohlfs/git/tichu/docs/BGA_OPEN_SOURCE_ECOSYSTEM.md) and [`plans/`](file:///Users/brohlfs/git/tichu/plans) (`00`–`14`).
- **Classic BGA Architecture**: Tichu uses `tichu.game.php`, `states.inc.php`, `tichu.action.php`, `Deck`, `ebg/stock`, and Dojo `bgagame.tichu` — not the 2025+ `modules/php/States/*.php` / `BgaCards` scaffold.

---

## 2. Architecture & Project Map

### BGA Request & State Lifecycle

- **Database & State Machine**: Isolated MySQL DB (`dbmodel.sql` extends `player` and creates `card`, `actionlog`). `states.inc.php` (`$machinestates`) defines:
  - `manager`: `ST_GAME_SETUP` (`1`) and `ST_GAME_END` (`99`) (`setupNewGame` returns `\ST_NEW_ROUND`).
  - `game`: automatic server transitions executing `st<StateName>` and calling `$this->gamestate->nextState(...)`.
  - `activeplayer`: waits for one active player (`possibleactions`).
  - `multipleactiveplayer`: waits for multiple players simultaneously (`setAllPlayersMultiactive`, `setPlayerNonMultiactive`).
- **Page Load (`getAllDatas`)**: `tichu.view.php` renders `tichu_tichu.tpl` (`<tichu-game>`); `Tichu::getAllDatas(int $currentPlayerId)` hides opponent hands and `player_pass`; Dojo instantiates `bgagame.tichu` and calls `setup(gamedatas)`.
- **Player Actions (`takeAction`)**: Client calls `ajaxcall("/tichu/tichu/<action>.html", ...)` -> `tichu.action.php` (`action_tichu`) -> `tichu.game.php` (`Tichu`). Server validates via `checkAction` (except out-of-turn `tichuBet`, `playBomb`, `pass` autopass, `cancelAutopass`) and throws `Bga\GameFramework\UserException` on invalid moves.
- **Notifications**: `notifyAllPlayers` / `notifyPlayer` drive `dojo.subscribe` and `notifqueue.setSynchronous` on the client.

### Project Map

| Path                                                                                                                 | Role                                                                                                                                                                                                     |
| :------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tichu.game.php`                                                                                                     | Core server-side `Tichu extends Table` game logic and DB upgrades                                                                                                                                        |
| `tichu.action.php`                                                                                                   | Server-side AJAX endpoints (`action_tichu extends APP_GameAction`)                                                                                                                                       |
| `tichu.view.php`, `tichu_tichu.tpl`                                                                                  | View builder (`view_tichu_tichu`) and minimal template mounting `<tichu-game>` + `<audio>`                                                                                                               |
| `dbmodel.sql`                                                                                                        | MySQL schema extensions (`player` custom columns, `card`, `actionlog`)                                                                                                                                   |
| `states.inc.php`, `material.inc.php`                                                                                 | BGA finite state machine (`$machinestates`) and static card/combo material + `modules/` imports                                                                                                          |
| `gameinfos.inc.php`, `gameoptions.inc.php`, `stats.inc.php`, `version.php`                                           | BGA metadata, options (`100`–`102`) & prefs (`100`–`104`), statistics, version file (do not edit `version.php`)                                                                                          |
| `tichu.css`, `tichu.js`                                                                                              | Stylesheet (themes `0`–`10`, square/list layouts, card sprites) and gitignored ES5+ES6 bundle `tichu.js`                                                                                                 |
| `modules/` (`Constants`, `Combo`, `Hand`, `Utils`)                                                                   | Pure PHP constants, combo validation/comparison (`canBeat`), and hand analysis (`findPlayableCombo`)                                                                                                     |
| `modules/managers/` (`CardManager`, `LogManager`, `NotificationManager`, `PlayerManager`)                            | `Deck` wrapper (`card`), `actionlog` queries, notifications, teams/seats/bets/autopass                                                                                                                   |
| `src/tichu.ts`, `src/studio-test.ts`, `src/types/`                                                                   | Lean Dojo adapter, Studio test bar (`window.tt`), `bga-framework.d.ts`, `tichu-contracts.ts`                                                                                                             |
| `src/elements/` (`elements`, `game-model`, `model`, `combo-validator`, `subscription-controller`, `styles`, `utils`) | RxJS `BehaviorSubject` stores (`GameModel` live, `Model` replay), TS `Combo`/`Hand` validator, Lit controller, shared styles & `hasBomb`                                                                 |
| `src/elements/tichu-*.ts` (16 Lit Shadow DOM elements)                                                               | `game`, `animation-layer`, `player-panel`, `value-choice`, `last-played`, `pass-area`, `action-bar`, `hand`, `played-cards`, `trick-modal`, `status`, `replay`, `player`, `stock`, `card`, `score-board` |
| `tests/` (`stubs.php`, `TestUtils.php`, `ComboTest.php`, `HandTest.php`, `combo-validator.test.ts`)                  | PHPUnit unit test suite (~15ms) and TS client combo/hand parity tests (~130ms)                                                                                                                           |
| `local/` (`Bga/GameFramework/`, `mysql-ctl.sh`, `router.php`, `bga-backend.php`, `bot.php`, `scenarios.php`)         | Local BGA PHP 8 + MySQL 8.0 runner (`ebd_tichu_1`), rule bot, and deterministic test scenarios                                                                                                           |
| `local/` (`integration-tests.php`, `check-contracts.php`, `race-tests.php`, `sftp-sync.sh`, `js/bga-shim.js`)        | 14-suite backend integration tests, static contract check, multi-worker race stress test, SFTP sync, frontend shim                                                                                       |
| `docs/`, `plans/`, `img/`                                                                                            | Ecosystem reference, plans (`00`–`14`), sprite sheets (`tichu-cards.png`, `tiki-cards.png`, `tichu-icons*.png`), `tichu_laser.mp3`/`.ogg`                                                                |

---

## 3. Card Encoding, `actionlog` & Core Quirks

### Card Representation

- **Normal Cards (`type_arg` = `2..14`)**:
  - Ranks: `2..10`, `11`=Jack, `12`=Queen, `13`=King, `14`=Ace.
  - Suits (`type`): `1`=Swords (Black), `2`=Stars (Red), `3`=Pagodas (Blue), `4`=Jade (Green).
- **Special Cards (`type_arg` = `1`)**:
  - `type = 1` (`TYPE_DRAGON`): **Dragon** (25 pts, value `15`; trick won with Dragon must be gifted to an opponent).
  - `type = 2` (`TYPE_PHOENIX`): **Phoenix** (-25 pts, wildcard in combos except bombs; single worth `lastCard + 0.5`, or `1.5` when led).
  - `type = 3` (`TYPE_DOG`): **Dog / Hound** (0 pts, lead-only `DOG_COMBO`; passes lead to partner or next player in play).
  - `type = 4` (`TYPE_MAHJONG`): **Mahjong** (0 pts, rank `1`; owner leads trick 1, usable in straights, triggers `ST_MAHJONG_PLAY` wish `2..14` or `15` for no wish).
- **Sprite Indexing (`stockType`)**: `(color - 1) * 14 + (value - 1)` (`0..55` in 14x4 100x150px sprite sheet; specials at `0`, `14`, `28`, `42`).
- **Card Locations (`card_location`)**: `deck`, `hand`, `temporary` (`card_location_arg` = recipient, `card_passed_from` = sender), `combos`, `captured`.

### Action Log & Quirks

- **`actionlog` Events (`LogManager.php`)**: JSON records (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`) for `newRound`, `newTrick`, `combo`, `pass`, `phoenix`, `changePlayer`, `confirm`, and `tichuCall` (`TICHU_CONFIRMATION_TRESHOLD = 60`s).
- **Action Naming Mismatches**:
  - `states.inc.php` `"giveCards"` routes to `giveTheCards` in `tichu.action.php` / `tichu.game.php`.
  - `states.inc.php` `"phoenixPlay"` routes to `choosePhoenix` in `tichu.action.php`.
- **Legacy vs. Current Passing States**: `ST_SHOW_PASSED_CARDS` (`45`) is kept for legacy games; new games go `ST_GIVE_CARDS` (`40`) -> `ST_ACCEPT_PASSED_CARDS` (`46`) -> `ST_NEW_TRICK` (`50`).
- **Turn-Based Mode (`isAllInfoExposed`)**: `isAsync()` sets global `isAllInfoExposed` (ID `28` = `1`), showing `#playedCards` and auto-skipping in `stNextPlayer()` when `$handRemainingCards->findBeatingCombo($lastCombo)` finds nothing.

---

## 4. Non-Negotiable Guardrails (Live Games, Concurrency & Client)

### Backend, Database & Concurrency

- **Live-Game Migrations**: Never delete states or change state/option/stat IDs; handle live schema changes in `upgradeTableDb($from_version)` using `DBPREFIX_<table_name>`.
- **`dbmodel.sql` Comments**: Never put `--` comments in `dbmodel.sql` (BGA strips newlines before executing it as a single string).
- **No Runtime DDL**: Never use `TRUNCATE` or `DROP` in runtime game logic (triggers an implicit MySQL commit and breaks rollback).
- **Randomness & `Deck`**: Prefer `bga_rand` over `shuffle()`. `Deck::createCards()` shuffles `card_id` (`1..56`), `Deck::getCards()` throws `feException` on missing/duplicate IDs, and `Deck::getCardsInLocation()` keys by `card_id` (wrap in `array_values(...)` + cast `(int)`).
- **`getCollectionFromDb` Gotcha**: Keys results by the first selected column and silently overwrites duplicates — select a unique column first or use `getObjectListFromDB($sql, true)` for flat lists.
- **Session & PHP 8.4**: Never call `getCurrentPlayerId()` inside `setupNewGame()`, `zombieTurn()`, or `arg*()`. Avoid PHP 8.4 warnings in AJAX JSON (`{$var}` not `${var}`, `$this->` not `self::`/`static::`).
- **Concurrency Locks**: Always call `$this->acquireGameLockOrFail()` first in mutating entry points (`bSelectGlobalsForUpdate = true`, `initTable()` `GET_LOCK` + `REPEATABLE-READ`, `GLOBAL_LOCK_VERSION = 30`). Never enable `$this->bIndependantMultiactiveTable`.
- **`@thoun` Autopass Invariants**: Audit `player_pass` (`AUTOPASS_NONE`=0, `AUTOPASS_ONCE`=1, `AUTOPASS_TRICK`=2) resets via `PlayerManager::setAutopass` in `stNewTrick`, `stNewRound`, and `stNextPlayer`.

### Client Bundle, Shadow DOM & UI

- **ES5+ES6 Bundle & `import type`**: `npm run bundle` compiles `src/tichu.ts` (`dist/tichu.js`) with `--target=es5` for Dojo `declare`, then appends `src/elements/elements.ts` via `esbuild` as ES6+ (`src/tichu.ts` must only use `import type` from `src/elements/`).
- **Shadow DOM Assets**: Never hardcode relative `url("img/...")` in Shadow DOM `<style>`; use `--icon-url`, `--table-icons-url`, `--mahjong-bg-url`, `--tiki-mahjong-bg-url` (from `g_gamethemeurl`).
- **Modals, Overlays & Pickers**: Mount `<tichu-trick-modal>` and `<tichu-animation-layer>` on `document.body` outside `#game_play_area_wrap` (`rescale()` clears `transform` when `factor >= 1.0`). `#mahjong` uses a 7x2 (`7+7`) grid and `phoenixAllowedValues` sorts ascending.
- **FLIP & WAAPI Flight Animations (`<tichu-animation-layer>` & `<tichu-stock>`)**: Two-phase pre-mutation (`prepare*`) + post-mutation (`run*`) orchestration keeps `gamedatas`, `GameModel`, and `.stockitem` counts synchronous while `<tichu-stock>` hides incoming cards via `?data-pending-reveal` (`tichu-card[data-pending-reveal] { visibility: hidden; }`). Never bind `style=${...}` on `<tichu-card>` from a parent template, as `TichuCard.render()` sets `--width`, `--height`, and `--card-url` on `this.style` and a parent `style=` binding wipes them on update. `shouldAnimate()` skips animations (`0ms`) when `document.hidden`, `instantaneousMode`, `speedMode === "instant"`, `window.__tichuSpeed === "instant"`, `!bgaAnimationsActive()`, or `prefers-reduced-motion: reduce`; `"fast"` scales durations by `0.15x`, and `cancelAll()` cleans up active ghosts and reveals pending cards.
- **`ebg/stock` Moves**: Add to destination stock before removing from source stock (`noupdate = true` in loops, then `updateDisplay()`).
- **Dark Mode & Translations**: Dark mode uses `html[data-theme="dark"]`. Pass literal strings only to `clienttranslate()` (`&dummyTranslations` tests `_()`).
- **Zero-Reload Preferences (`100`–`104`) & Two-Way Sync**: All 5 prefs use `"needReload" => false`, are read safely via `safeGetPref(prefId, fallback)` (guarding spectator/archive missing `#preference_control_<id>`), update `GameModel` via `onGameUserPreferenceChanged` -> `onPreferenceChange` (no duplicate `initPreferencesObserver()`), and persist in-hand clicks via `persistUserPreference` (which skips `setGameUserPreference` when `isReadOnly()` is `true`). Hand sort order persists in `localStorage` (`tichu_hand_sort_order`).

---

## 5. Essential Commands, Git Push Quirk & Context Hygiene

### Build, Test & Git Commands

- **PATH & Build**: Ensure `/opt/homebrew/bin` is on `PATH`. Always run `npm run build` (`npm test && npm run compile && npm run bundle`) after editing `.ts` or `.php` files.
- **Test & Dev Commands**:
  - `npm test` — PHPUnit unit tests (~15ms) + TS `Combo`/`Hand` validator tests (`npm run test:validator`, ~130ms) + 14-suite MySQL 8.0 integration tests (~2.7s)
  - `npm run test:contracts` — static cross-stack contract checks (`php local/check-contracts.php`)
  - `npm run phpstan` — PHP static analysis (`phpstan.neon`)
  - `npm run test:race` — multi-worker MySQL 8.0 concurrency stress test (~70s, opt-in)
  - `npm run local` — local MySQL 8.0 + PHP BGA runner at `http://127.0.0.1:8080` (`window.tt`)
  - `npm run deploy:sftp` / `npm run deploy:sftp:all` — upload `tichu.js` + modified/all deployable files to Studio (~3s)
  - `npm run format` — format TS, JS, CSS, and PHP with Prettier (`npx prettier --write .`)
- **Production Safety**: **NEVER** build a release or deploy to `boardgamearena.com` without **explicit user confirmation first**.
- **GitHub HTTPS Push Quirk** (global `~/.gitconfig` rewrites `https://github.com/` to SSH `git@github.com:` which fails):
  ```bash
  git push https://www.github.com/bro314/tichu.git main && git update-ref refs/remotes/origin/main HEAD
  ```

### Context Hygiene

- Delegate `bga-platform/` (`main.js` 193k lines, `ly_metasite.js`, `ly_studio.js`) and `_ide_helper.php` analysis to `research` (`Model: "flash"`).
- Read [bga-studio-testing](file:///Users/brohlfs/git/tichu/.agents/skills/bga-studio-testing/SKILL.md) before invoking `browser` (`captureScreenshot: false`, no `page.evaluate`/`waitForFunction`).
- Combine related edits in one turn and suggest `/compact` once a conversation exceeds ~150 steps.
