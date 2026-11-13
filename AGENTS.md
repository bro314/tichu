# AGENTS.md — Tichu for Board Game Arena (BGA)

This document provides comprehensive architectural, structural, and operational context for AI coding agents working on the **Tichu** implementation for [Board Game Arena (BGA)](https://boardgamearena.com).

---

## 1. BGA Platform Overview & Developer Documentation

### Official BGA Studio Documentation

When working on BGA game logic, client APIs, or platform conventions, consult the official BGA Studio Wiki:

- **Main Studio Hub**: https://en.doc.boardgamearena.com/Studio
- **Game Main PHP Logic (`*.game.php`)**: https://en.doc.boardgamearena.com/Main_game_logic:_yourgamename.game.php
- **State Machine (`states.inc.php`)**: https://en.doc.boardgamearena.com/Your_game_state_machine:_states.inc.php
- **Client-Side JS (`GameGui`)**: https://en.doc.boardgamearena.com/Game_interface_logic:_yourgamename.js
- **Deck Component (`module.common.deck`)**: https://en.doc.boardgamearena.com/Deck
- **Stock UI Component (`ebg/stock`)**: https://en.doc.boardgamearena.com/Stock
- **Game Meta-Information (`gameinfos.inc.php`)**: https://en.doc.boardgamearena.com/Game_meta-information:_gameinfos.inc.php
- **Options & Preferences (`gameoptions.inc.php`)**: https://en.doc.boardgamearena.com/Options_and_preferences:_gameoptions.inc.php
- **Statistics (`stats.inc.php`)**: https://en.doc.boardgamearena.com/Game_statistics:_stats.inc.php
- **Post-Release & DB Migrations (`upgradeTableDb`)**: https://en.doc.boardgamearena.com/Post-release_phase
- **Pre-Release Checklist**: https://en.doc.boardgamearena.com/Pre-release_checklist
- **Tutorials Checklist**: https://en.doc.boardgamearena.com/Tutorials_checklist
- **Tichu Bug Tracker on BGA**: https://boardgamearena.com/bugs?game=1237 (individual bug reports are at `https://boardgamearena.com/bug?id=<BUG_ID>`)

### Authoritative API Stubs & External BGA Skill Reference

- **Generated Stubs Beat the Wiki**: BGA ships generated [`_ide_helper.php`](file:///Users/brohlfs/git/tichu/_ide_helper.php) (PHP) and [`src/types/bga-framework.d.ts`](file:///Users/brohlfs/git/tichu/src/types/bga-framework.d.ts) (JS/TS) on every Studio server and updates them ahead of the hand-written BGA Wiki. When the Wiki and the local stubs disagree, **trust the stubs** (and re-download `/tichu/_ide_helper.php` via SFTP if checking for newer platform APIs).
- **Community BGA Agent Reference (`rbellec/claude-code-bga`)**:
  - Repo: https://github.com/rbellec/claude-code-bga (fetch via `https://www.github.com/rbellec/claude-code-bga.git` if cloning locally).
  - Contains concise reference guides under `skills/board-game-arena/references/` (`deck.md`, `stock.md`, `counter.md`, `notifications.md`, `translations.md`, `guidelines.md`, `debug-helpers.md`, `tutorial-ready.md`, `legacy-migration.md`) and platform root-cause explanations in `TECHNICAL_NOTES.md`.
  - **Architecture Note**: That repo's `SKILL.md` defaults to the 2025+ BGA scaffold (`modules/php/States/*.php`, `modules/js/Game.js` ES6, `ItemManager`, `BgaCards`). **Tichu uses the classic BGA architecture** (`tichu.game.php`, `states.inc.php`, `tichu.action.php`, `Deck`, `ebg/stock`, Dojo `bgagame.tichu`), so only apply its classic-component references, platform pitfalls, or incremental migration patterns (`references/legacy-migration.md`) when relevant.

### How the BGA Architecture Works

BGA games use an event-driven client-server architecture built on a finite state machine:

1. **Database & State Machine (Server - PHP/MySQL)**:
   - Every table has its own isolated MySQL database created from `dbmodel.sql` at game setup (`setupNewGame`).
   - Standard BGA tables (`player`, `global`, `stats`, `gamelog`) are created automatically by the platform; `dbmodel.sql` adds custom columns to `player` and creates game-specific tables (`card`, `actionlog`).
   - `states.inc.php` defines the state machine (`$machinestates`). States have four types:
     - `manager`: Initial (`ST_GAME_SETUP` = 1) and final (`ST_GAME_END` = 99) states managed automatically by the BGA framework (`setupNewGame` returns `\ST_NEW_ROUND`).
     - `game`: Automatic server-side transition states that execute a PHP `action` method (`st<StateName>`) and transition via `$this->gamestate->nextState('<transition>')`.
     - `activeplayer`: Waits for a single active player to take one of the `possibleactions`.
     - `multipleactiveplayer`: Waits for multiple players simultaneously (e.g., Grand Tichu betting, passing 3 cards). Uses `$this->gamestate->setAllPlayersMultiactive()` and `$this->gamestate->setPlayerNonMultiactive($player_id, '<transition>')`.
2. **Page Load & Initial Hydration (`getAllDatas`)**:
   - When a player opens or refreshes (`F5`) the table, `tichu.view.php` renders `tichu_tichu.tpl` and `Tichu::getAllDatas(int $currentPlayerId)` in `tichu.game.php` returns all game state visible to `$currentPlayerId` (hiding secret info like other players' hands and `player_pass` autopass settings).
   - On the client, Dojo instantiates `bgagame.tichu` (extending `ebg.core.gamegui`) and calls `setup(gamedatas)`.
3. **Player Actions (Client -> Server)**:
   - Client calls `this.ajaxcall("/tichu/tichu/<action>.html", args, ...)` via helper `this.takeAction(action, args)`.
   - `tichu.action.php` (`class action_tichu extends APP_GameAction`) validates request parameters (`getArg`) and delegates to `$this->game-><action>(...)` in `tichu.game.php`.
   - `tichu.game.php` verifies legality (`$this->checkAction('<action>')`, except for out-of-turn actions like `tichuBet`, `playBomb`, `pass` autopass, and `cancelAutopass`), throws `Bga\GameFramework\UserException` on invalid player moves, mutates the DB via `Bga\GameFramework\Table::DbQuery(...)`, logs actions, sends notifications, and advances the state machine.
4. **Notifications (Server -> Client)**:
   - Server sends public updates via `$this->notifyAllPlayers($type, $logMsg, $args)` or private updates (e.g., dealt/passed cards, confirm dialogs, autopass status) via `$this->notifyPlayer($playerId, $type, $logMsg, $args)`.
   - Client subscribes to notifications in `setupNotifications()` via `dojo.subscribe(type, this, "notif_" + type)` and controls animation pacing with `this.notifqueue.setSynchronous(type, duration)`.

---

## 2. Project Structure

```text
/Users/brohlfs/git/tichu/
├── dbmodel.sql                  # MySQL schema extensions (custom player columns, `card` & `actionlog` tables)
├── gameinfos.inc.php            # BGA metadata (4 players, colors, interface width, tags)
├── gameoptions.inc.php          # Game options (100: Length, 101: Teams, 102: Variant) & User prefs (100-104)
├── material.inc.php             # Static game material ($colors, $values_label, $specials_label, $play_type) + module requires
├── states.inc.php               # Finite state machine definition ($machinestates)
├── stats.inc.php                # End-of-game table & player statistics ($stats_type)
├── tichu.action.php             # AJAX action endpoints (class action_tichu extends APP_GameAction)
├── tichu.game.php               # Core server-side game class (class Tichu extends Table)
├── tichu.view.php               # Server-side view builder (class view_tichu_tichu extends game_view)
├── tichu_tichu.tpl              # Minimal HTML template mounting `<tichu-game></tichu-game>` and `<audio>` tags
├── tichu.css                    # Complete stylesheet (themes 0-10, square/list layouts, card sprites, responsive scaling)
├── tichu.js                     # Compiled/bundled client script deployed to BGA (generated by `npm run build`)
├── version.php                  # BGA version file (do not modify)
├── _ide_helper.php              # PHP IDE autocomplete stubs for BGA framework classes (not deployed)
├── bga-platform/                # Gitignored local snapshot of BGA platform CSS/JS files (dojo, ly_metasite.js, ly_studio.js, etc.)
├── modules/                     # Modularized PHP backend logic
│   ├── Constants.php            # PHP constants (state IDs ST_*, combo types *_COMBO, special card types, team modes)
│   ├── Combo.php                # Card combination validation, sorting, Phoenix resolution, description, and comparison (`canBeat`)
│   ├── Hand.php                 # Player hand analysis: finding highest combos/bombs, checking if hand can beat a combo or fulfill Mahjong wish
│   ├── Utils.php                # Array/DB utility helpers (`filterColumns`, `parseInt`, `map`, `getDoubles`, `die`)
│   └── managers/
│       ├── CardManager.php      # Wrapper around BGA `Deck` component (`card` table), point calculation, passed cards
│       ├── LogManager.php       # Custom `actionlog` table queries/inserts for round/trick tracking, last combos, Phoenix state
│       ├── NotificationManager.php # Centralized helper for `notifyAllPlayers` and `notifyPlayer`
│       └── PlayerManager.php    # Player setup, team assignment, seat ordering (`getNextPlayers`), Tichu bets, scores, autopass
├── src/                         # TypeScript client source code
│   ├── tsconfig.json            # TypeScript compiler configuration (outputs to `dist/`)
│   ├── tichu.ts                 # Lean BGA client adapter (`Tichu`), Dojo notification subscriptions, state & action handlers
│   ├── studio-test.ts           # Studio-only test runner (`window.tt` & `#studio-test-bar`, only active on `studio.boardgamearena.com`)
│   ├── types/
│   │   └── bga-framework.d.ts   # TypeScript ambient declarations for BGA framework (`ebg`, `dojo`, `GameGui`, `Stock`)
│   └── elements/                # Lit + RxJS Web Components (Full Shadow DOM for both live gameplay & archive replay)
│       ├── elements.ts          # Entry point registering all `<tichu-*>` custom elements and `window.gameModel`
│       ├── game-model.ts        # RxJS `BehaviorSubject`-based reactive state store (`GameModel`) for live gameplay
│       ├── model.ts             # RxJS `BehaviorSubject`-based reactive state store (`Model`) for replay mode
│       ├── subscription-controller.ts # Lit `ReactiveController` connecting RxJS observables to Lit lifecycle
│       ├── styles.ts            # Shared Lit CSS styles (themes, icons, buttons, dark-mode text colors)
│       ├── utils.ts             # RxJS `select`, `deepEqual`, `playerIdFromChannel`, client-side `hasBomb`
│       ├── tichu-game.ts        # `<tichu-game>`: root live game container inside `#game_play_area`
│       ├── tichu-player-panel.ts # `<tichu-player-panel>`: sidebar player board panel inside `#player_board_<id>`
│       ├── tichu-value-choice.ts # `<tichu-value-choice>`: Mahjong wish (`2..A` + No Wish) and Phoenix rank picker
│       ├── tichu-last-played.ts # `<tichu-last-played>`: 4-player table area, `.disabler`, `#mahjongIndicator`, `<tichu-status>`
│       ├── tichu-pass-area.ts   # `<tichu-pass-area>`: 3-card passing boxes (`#playertables`) and accept animations
│       ├── tichu-action-bar.ts  # `<tichu-action-bar>`: `#buttons` bar (play, pass, autopass, bomb, Tichu call, countdowns)
│       ├── tichu-hand.ts        # `<tichu-hand>`: player hand container (`#myhandwrap`), preferences (`#prefs`), `#themes`
│       ├── tichu-played-cards.ts # `<tichu-played-cards>`: 4x14 turn-based card tracker (`#playedCards`)
│       ├── tichu-trick-modal.ts # `<tichu-trick-modal>`: modal dialog showing all cards in the current trick
│       ├── tichu-status.ts      # `<tichu-status>`: displays Round, Trick, Trick Points, and "Show current trick" button
│       ├── tichu-replay.ts      # `<tichu-replay>`: full interactive replay viewer using `window.g_gamelogs`
│       ├── tichu-player.ts      # `<tichu-player>`: player area in replay mode (hand, played combo, passed cards, bomb indicator)
│       ├── tichu-stock.ts       # `<tichu-stock>`: card list container (rank/color/preserve sort, selection, dynamic overlap)
│       ├── tichu-card.ts        # `<tichu-card>`: single card / pass icon renderer (scales `1.0`, `0.75`, `0.5`, Tiki art, tooltips)
│       └── tichu-score-board.ts # `<tichu-score-board>`: round-by-round score table in replay mode
├── tests/                       # PHPUnit unit test suite
│   ├── stubs.php                # BGA framework PHP stubs (`Table`, `APP_GameClass`, `GameState`, `feException`, etc.)
│   ├── TestUtils.php            # Card constants (`DR`, `PH`, `DOG`, `MJ`, `A2`..`DA`) and `card($type, $arg)` helper
│   ├── ComboTest.php            # Unit tests for `Combo` validation and descriptions
│   └── HandTest.php             # Comprehensive unit tests for `Hand` (bombs, highest combos, `canBeat`, `canFulFillWish`)
├── local/                       # Self-contained local BGA runner, SFTP sync & integration test suite (not uploaded to BGA Studio)
│   ├── Bga/GameFramework/       # 41 runtime PHP files of BGA's server-side `Bga\GameFramework` (`Table`, `GamestateMachine`, `Deck`, `Old\Db`, etc.) executed by the local server
│   ├── mysql-ctl.sh             # Project-local MySQL 8.0 InnoDB daemon controller (`local/.mysql/mysql.sock`, `--transaction-isolation=SERIALIZABLE`, db `ebd_tichu_1`)
│   ├── bga-std-schema.sql       # Standard BGA MySQL platform tables (`global`, `player`, `stats`, `gamelog`, `replaysavepoint`, `bga_user_preferences`, `playermultiactive`)
│   ├── sftp-sync.sh             # Fast non-interactive SFTP uploader (`npm run deploy:sftp` / `npm run deploy:sftp:all`)
│   ├── router.php               # Built-in PHP server router (`php -S 127.0.0.1:8080 local/router.php`)
│   ├── bga-backend.php          # Thin local BGA container/bootstrap wiring `local/Bga/GameFramework/` to MySQL 8.0 (`Old\Db`), `$bgaContainer`, `$g_user`, and `$g_config`
│   ├── bot.php                  # Rule-compliant `LocalTichuBot` (`actForOtherPlayers`, `stepSingleBotTurn`, `autoPlayUntilPlayer`)
│   ├── scenarios.php            # Deterministic test scenarios (`grand_tichu`, `give_cards`, `mahjong_wish`, `phoenix_ambiguous`, `bomb_interrupt`, `dragon_gift`, `double_victory`)
│   ├── integration-tests.php    # MySQL 8.0 + real `Bga\GameFramework` backend integration test suite (`npm run test:integration`)
│   ├── race-tests.php           # Parallel-worker MySQL 8.0 InnoDB concurrency/race stress test (`npm run test:race`, NOT part of `npm test`)
│   ├── view/common/game.view.php # View base class included by `tichu.view.php`
│   ├── js/bga-shim.js           # Lean frontend shim (`dojo`, `declare`, `ebg.stock`, `ebg.counter`, `ebg.popindialog`, `GameGui`), dev bar, console announcer, and `window.tt` test runner
│   └── css/bga-shim.css         # BGA base layout, `.stockitem`, `.bgabutton`, `.whiteblock`, and `#local-dev-bar` styles
└── img/                         # Game assets
    ├── tichu-cards.png          # Standard card sprite sheet (14 columns x 4 rows, 100x150px per card)
    ├── tiki-cards.png           # Tiki Edition card sprite sheet (14 columns x 4 rows)
    ├── tichu-icons*.png         # UI icons, pass icons, Mahjong/Phoenix selector sprites
    └── tichu_laser.mp3 / .ogg   # Sound effect played on Tichu / Grand Tichu call
```

---

## 3. Core Game Mechanics & Implementation Details

### Card Representation

Cards are stored in the `card` table (managed by BGA's `Deck` component) with `type` (color/suit, `1..4`) and `type_arg` (rank, `1..14`):

- **Normal Cards (`type_arg` = `2..14`)**:
  - `2..10`: Numeric ranks 2 through 10.
  - `11`: Jack, `12`: Queen, `13`: King, `14`: Ace.
  - Suits (`type`): `1` = Swords (Black), `2` = Stars (Red), `3` = Pagodas (Blue), `4` = Jade (Green).
- **Special Cards (`type_arg` = `1`)**:
  - `type = 1` (`TYPE_DRAGON`): **Dragon** (25 pts, highest single card with value `15`, trick won with Dragon must be gifted to an opponent).
  - `type = 2` (`TYPE_PHOENIX`): **Phoenix** (-25 pts, wildcard in combos except bombs; as a single card worth `lastCard + 0.5`, or `1.5` when led).
  - `type = 3` (`TYPE_DOG`): **Dog / Hound** (0 pts, can only be played as a lead single `DOG_COMBO`; immediately passes lead to partner or next player in play).
  - `type = 4` (`TYPE_MAHJONG`): **Mahjong** (0 pts, rank `1`; owner leads the first trick of the round; can be played as a single or as `1` in a straight; triggers `ST_MAHJONG_PLAY` to make a wish for rank `2..14` or `15` for "no wish").
- **Client Sprite Indexing (`stockType`)**:
  - Formula: `(color - 1) * 14 + (value - 1)` produces a `0..55` index into the 14x4 sprite sheet (`tichu-cards.png` or `tiki-cards.png`).
  - Special cards are at indices `0` (Dragon), `14` (Phoenix), `28` (Dog), and `42` (Mahjong).
- **Card Locations (`card_location`)**:
  - `deck`: Draw pile.
  - `hand`: In player's hand (`card_location_arg` = `player_id`).
  - `temporary`: Cards passed during `ST_GIVE_CARDS` before acceptance (`card_location_arg` = recipient `player_id`, `card_passed_from` = sender `player_id`).
  - `combos`: Cards played into the current trick on the table.
  - `captured`: Tricks won by players (`card_location_arg` = `player_id`).

### Custom Action Log (`actionlog` table)

Instead of relying solely on global variables for complex trick history, `LogManager.php` records structured JSON events in the `actionlog` table (`log_player`, `log_round`, `log_trick`, `log_action`, `log_arg`):

- `newRound`, `newTrick`: Increments round/trick counters.
- `combo`: Stores played `Combo` details (`description`, `type`, `cards`, `phoenixValue`).
- `pass`: Records a player passing.
- `phoenix`: Stores a pending combo when a player plays a Phoenix with ambiguous value (e.g., either end of a straight or a full house with two pairs) before `ST_PHOENIX_PLAY` resolves it.
- `changePlayer`: Records state transition context when a player interrupts with a bomb (`ST_PLAY_BOMB`).
- `confirm`: Records trick winner and whether the Dragon won the trick before entering `ST_CONFIRM_TRICK`.
- `tichuCall`: Timestamp of the last Tichu/Grand Tichu call to trigger a confirmation prompt (`TICHU_CONFIRMATION_TRESHOLD = 60` seconds) if another player calls Tichu right after.

### Important Quirks & Guardrails

1. **Action Naming Mismatch**:
   - In `states.inc.php`, the possible action for passing cards is `"giveCards"`, but the endpoint in `tichu.action.php` and method in `tichu.game.php` is named `giveTheCards`.
   - Similarly, the state possible action for choosing a Phoenix value is `"phoenixPlay"`, while the endpoint in `tichu.action.php` is `choosePhoenix`.
2. **Legacy vs. Current States for Passing Cards**:
   - `ST_SHOW_PASSED_CARDS` (45) is a legacy `multipleactiveplayer` state kept in `states.inc.php` so old in-progress games don't break.
   - New games transition from `ST_GIVE_CARDS` (40) to `ST_ACCEPT_PASSED_CARDS` (46), which automatically accepts passed cards for all players and proceeds to `ST_NEW_TRICK` (50).
3. **Turn-Based vs. Real-Time Mode (`isAllInfoExposed`)**:
   - When a game is started in turn-based (`isAsync()`) mode, global `isAllInfoExposed` (ID 28) is set to `1`.
   - In this mode, the UI displays the "Played Cards" tracker (`#playedCards`) and `stNextPlayer()` automatically skips/passes players if the combined remaining cards across all hands cannot possibly beat the current combo (`$handRemainingCards->findBeatingCombo($lastCombo)`).
4. **Live Game Migration Safety**:
   - **Never** delete states, change state IDs, or change option/statistic IDs if games are running in production.
   - Database schema changes for running games must be handled in `upgradeTableDb($from_version)` in `tichu.game.php` using `DBPREFIX_<table_name>`.
5. **Web Components Bundle & Shadow DOM (`src/elements/elements.ts`)**:
   - `Tichu` in `src/tichu.ts` must be compiled to ES5 (`dist/tichu.js`) so its prototype methods are enumerable when passed to Dojo's `declare("bgagame.tichu", ebg.core.gamegui, new Tichu())`.
   - Conversely, the Lit custom elements (`<tichu-*>` in `src/elements/elements.ts`) must remain native ES6+ classes (`class extends LitElement`) for browser `customElements.define(...)` compatibility.
   - Therefore, `npm run bundle` first bundles `./dist/tichu.js` with `--target=es5` into `tichu.js`, and then bundles `./src/elements/elements.ts` directly via `esbuild` (preserving ES6 classes) and appends it to `tichu.js`.
   - `src/tichu.ts` must only use `import type` when referencing types from `src/elements/` so `tsc` does not downlevel Lit classes into `dist/tichu.js`.
   - Inside Shadow DOM `<style>` blocks, never hardcode relative `url("img/...")` paths (since `document.baseURI` on BGA Studio is `/<table_id>/tichu`, not `/game/tichu/`). Instead, use the CSS custom properties (`--icon-url`, `--table-icons-url`, `--mahjong-bg-url`, `--tiki-mahjong-bg-url`) initialized from `g_gamethemeurl` in `src/elements/game-model.ts` and `src/elements/tichu-card.ts`.
   - `<tichu-trick-modal>` is mounted on `document.body` outside `#game_play_area_wrap` (and `rescale()` clears `transform` when `factor >= 1.0`) so `position: fixed` modals are never trapped inside a CSS `transform` containing block on BGA Studio.
   - In `<tichu-value-choice>`, `#mahjong` uses a 7x2 (`7+7`) grid matching the 7-column `tichu-icons-table.png` sprite sheet, and `phoenixAllowedValues` is sorted ascending (`(a, b) => a - b`).

### BGA Platform Pitfalls & Best Practices (PHP, MySQL & Client)

1. **PHP & Database (`dbmodel.sql`, `Table` DB Helpers, PHP 8.4)**:
   - **Never put `--` comments in `dbmodel.sql`**: BGA Studio strips all newlines from `dbmodel.sql` before passing it as a single string to MySQL, so any `--` comment silently swallows the rest of the schema!
   - **`getCollectionFromDb` vs. `getObjectListFromDB`**: `getCollectionFromDb($sql)` keys the returned associative array by the **first selected column**, silently overwriting duplicate keys. Always select a unique column first, or use `getObjectListFromDB($sql)` (`getObjectListFromDB($sql, true)` for a flat 1D array of values).
   - **Never use `TRUNCATE` or `DROP` in runtime game logic**: They trigger an implicit MySQL commit and break BGA's automatic transaction rollback on exceptions.
   - **PHP 8.4 Warnings Corrupt AJAX JSON**: Action endpoints return raw JSON; any PHP warning or deprecation notice prints ahead of the JSON and triggers `JSON_ERROR_SYNTAX` on the client. Always use `{$var}` (never `${var}`) in strings and `$this->` (never `self::`/`static::`) for non-static framework instance methods.
   - **`getCurrentPlayerId()` Context Restrictions**: `getCurrentPlayerId()` reads the HTTP session and throws `"Not logged"` if called inside `setupNewGame()`, `zombieTurn()`, or `arg*()` state methods. Only call it inside player actions and `getAllDatas()`.
   - **`Deck` Return Values & `getCards()` Exception**: `Deck::getCardsInLocation(...)` returns an associative map keyed by `card_id` (unless `$order_by` is set) with string-typed numeric fields; wrap in `array_values(...)` when sending to JS if array ordering matters, and cast numeric fields (`(int)`). Also note that `Deck::getCards($cards_array)` throws `new \feException("getCards: Some cards have not been found !")` if `count($result) != count($cards_array)` (e.g., non-existent card ID or duplicate card IDs in input), and `Deck::createCards()` calls `shuffle($values)` before `INSERT INTO card`, so `card_id` (`1..56`) is randomized per game.
2. **Client (`ebg/stock`), Dark Mode & Translations**:
   - **`ebg/stock` Movement & Batch Updates**: When moving a card between two `Stock` instances, add to the destination stock **first** (`dest.addToStockWithId(type, id, src.getItemDivId(id))`) and remove from the source stock **second** (`src.removeFromStockById(id)`). For loop removals, pass `noupdate = true` and call `updateDisplay()` once afterward.
   - **BGA Dark Mode (`html[data-theme="dark"]`)**: BGA toggles dark mode via the `html[data-theme="dark"]` attribute (not `@media (prefers-color-scheme: dark)`). Any custom UI container with a fixed light background must specify an explicit dark text `color`.
   - **Translations (`clienttranslate` & `&dummyTranslations`)**:
     - `clienttranslate()` is statically extracted — pass literal strings only (no variables or string concatenation inside `clienttranslate()`), and wrap all player-facing `UserException` messages in `clienttranslate()`.
     - When a notification argument is used both for client logic/CSS and for log display, pass two separate keys (raw value + `clienttranslate()` label listed in `'i18n' => [...]`).
     - Append `&dummyTranslations` to a Studio table URL to wrap all translated client `_()` strings in `«»` (any bare English text indicates a missing `_()` wrapper).

### Concurrency & Locking (Race Conditions, Deadlocks)

BGA runs MySQL 8.0 (InnoDB) with `@@transaction_isolation = 'SERIALIZABLE'`, where every plain `SELECT` inside an open transaction is implicitly converted to `SELECT ... FOR SHARE` (acquiring shared `S` locks). Furthermore, on BGA Studio (`GamePageAction::performServerAction()`), the framework executes `$this->gamePage->debugSaveState(4)` between `initGameTableObjects()` and the game action — which runs `$this->db->commit()`, spawns an external `mysqldump` process on the table database, and calls `$this->db->begin()` to start a second transaction!

Requests on the same table **can run in parallel**: several tabs/devices of one player auto-collecting a trick, a Tichu call / bomb / autopass of another player arriving while the active player plays, or all 4 players betting Grand Tichu / passing cards within milliseconds. Without early serialization and isolation control, concurrent requests caused `mysql_deadlock_restart_transaction` (Error 1213) — both from `SERIALIZABLE` `S`-to-`X` lock upgrades on `global`/`card` and from Studio's `mysqldump` locking `card` while an action transaction held `X` on `global` and tried to `UPDATE card` — as well as `stNewTrick()` running twice when a second request validated against an outdated snapshot.

The protocol implemented in `tichu.game.php` (section "Concurrency control"):

1. **`$this->bSelectGlobalsForUpdate = true` in `Tichu::__construct()`**:
   - In `GamePage::initGameTableObjects()` -> `TableInfos::get()`, BGA's very first query of the request is `SELECT global_id, global_value FROM global WHERE 1 [FOR UPDATE]`. Setting `bSelectGlobalsForUpdate = true` ensures that initial query takes an `X` lock instead of a `SERIALIZABLE` `S` lock, preventing `S`-to-`X` lock upgrade deadlocks before game code even runs.
2. **MySQL Advisory Lock (`GET_LOCK`) + `REPEATABLE-READ` in `initTable()`**:
   - `Table::setTable()` calls `$this->initTable()` at the end of `initGameTableObjects()`, **before** BGA Studio's `debugSaveState(4)` commits the initial transaction and spawns `mysqldump`.
   - `initTable()` calls `acquireAdvisoryLock()`, which runs `SELECT GET_LOCK('tichu_table_<id>', 20)` and `SET SESSION transaction_isolation = 'REPEATABLE-READ'` on real BGA servers (`class_exists(\Bga\GameFramework\Old\Db::class)`).
   - Because MySQL session advisory locks (`GET_LOCK`) persist across `COMMIT`/`BEGIN` boundaries for the lifetime of the request's DB connection, a second concurrent request blocks inside `initTable()` before it can spawn a concurrent `mysqldump` or start an overlapping action transaction, and `REPEATABLE-READ` prevents plain `SELECT`s from taking shared `S` locks.
3. **One table row lock (`acquireGameLock()`), always acquired first in every mutating entry point**:
   - Every mutating entry point (all actions in `tichu.action.php`, `zombieTurn`) calls `acquireGameLock()` / `acquireGameLockOrFail()` **before any other DB statement**. It ensures the advisory lock is held and runs `SELECT global_value FROM global WHERE global_id = 1 FOR UPDATE` (plus `global_id = 2` and `global_id = 30`). `getAllDatas()`/`arg*()` never call `acquireGameLock()`.
4. **Stale-snapshot detection**:
   - InnoDB does not refresh a transaction's read view when it acquires a lock, and the framework has already loaded the game state in `initGameTableObjects()` (which on Studio was in the first transaction before `debugSaveState(4)`), so a request that waited behind another request will have outdated cached state in `$this->gamestate`. `acquireGameLock()` compares the locked (current) state id, active player, and version row `global_id = 30` (`Tichu::GLOBAL_LOCK_VERSION`, label `lockVersion`) with the cached/snapshot values (`isGameLockStale()`).
5. **Stale policy**: stale requests throw `UserException("The game changed while your action was being processed...")` (rolled back, nothing happens), except where the decision only uses data read freshly with the lock held:
   - `collect`: duplicates/late requests (state no longer `confirmTrick`) are **silent no-ops** (clients auto-collect from every tab).
   - `grandTichuBet`, `giveTheCards`, legacy `acceptCards`: validated with a fresh `player_is_multiactive` read (`checkMultiactiveActionFresh`) and accepted even if stale; `setPlayerNonMultiactiveSafe()` replaces the framework's possibly stale "anyone still active?" check. Only the **last** passer of `giveTheCards`/`acceptCards` must retry when stale (the transition accepts everybody's cards); the last Grand Tichu bettor may transition on a stale snapshot because `stDealLastCards` only touches the deck.
   - `tichuBet`: own player row, own card counts and `firstOutPlayer` are read `FOR UPDATE`, so a Tichu call is never lost because others acted concurrently.
   - `pass` out of turn (autopass) and `cancelAutopass`: decided on fresh state/active player/hand count; they don't bump the version because `stNextPlayer()` reads `player_pass` with `FOR UPDATE`. A stale _turn_ pass (e.g. duplicate from a second tab) is rejected instead of silently becoming an autopass.
6. **Version bump**: every request that changes shared game data calls `bumpGameVersion()` (once per request; re-creates row 30 for games started before it existed).

Rules for new code:

- New action endpoints: call `$this->acquireGameLockOrFail()` as the **first** statement (or design a fresh-read exception like above and document it here). Never take any other row lock (`FOR UPDATE`, `UPDATE`, `INSERT`) before the table lock.
- Never rely on plain `SELECT`s after waiting for a lock to see other requests' changes; use `FOR UPDATE` for current reads.
- Don't enable `$this->bIndependantMultiactiveTable`: the code reads/writes `player_is_multiactive` directly.
- Verify with `npm run test:race` (see below) after touching any action, state action or manager.

---

## 4. Building, Testing, and Deployment Workflow

### Frontend Build (TypeScript + esbuild)

`tichu.js` is gitignored and generated from `src/` via npm scripts in `package.json`:

- **Install dependencies**: `npm install` (and `composer install` for PHPUnit)
- **Run all backend tests (Unit + Integration)**: `npm test` (`npm run test:unit && npm run test:integration`)
- **Compile TypeScript (`src/` -> `dist/`)**: `npm run compile` (`tsc -p src`)
- **Watch TypeScript**: `npm run watch` (`tsc --watch -p src`)
- **Bundle into `tichu.js`**: `npm run bundle` (`esbuild ./dist/tichu.js --bundle --outfile=tichu.js --target=es5 && esbuild ./src/elements/elements.ts --bundle >> tichu.js`)
- **Full Build (Tests + Compile + Bundle)**: `npm run build` (`npm test && npm run compile && npm run bundle`)
- **Upload to BGA Studio SFTP**: `npm run deploy:sftp` (uploads `tichu.js` + any git-modified deployable files in ~3s via `local/sftp-sync.sh`), `npm run deploy:sftp -- <file1> <file2>` (specific files), or `npm run deploy:sftp:all` (all deployable files)
- **Format Code (TS + PHP)**: `npm run format` (`npx prettier --write .`)

> **Important**: Always ensure `/opt/homebrew/bin` is on `PATH` (`export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"`), and always run `npm run build` after modifying any `.ts` or `.php` file so that all unit + backend integration tests pass and `tichu.js` is updated for SFTP synchronization to BGA Studio.

### Local Testing & Local BGA Runner (`tests/` & `local/`)

Tichu has three fast local testing tiers that run without needing a BGA Studio connection (plus the opt-in race stress test below):

1. **Unit Tests (`npm run test:unit` / `./vendor/bin/phpunit tests`, ~15ms)**:
   - Tests pure card/combo/hand logic in `modules/Combo.php` and `modules/Hand.php` using `tests/stubs.php` and `tests/TestUtils.php`.
   - When modifying `Combo.php` or `Hand.php`, add corresponding test cases in `tests/ComboTest.php` or `tests/HandTest.php`.

2. **Backend Integration Tests (`npm run test:integration` / `php local/integration-tests.php`, ~2.7s)**:
   - Runs 14 full-stack PHP + MySQL 8.0 InnoDB (`ebd_tichu_1` via `local/mysql-ctl.sh`) test suites directly against the real `local/Bga/GameFramework/` classes (`Table`, `GamestateMachine`, `Deck`, `Old\Db`, `Stats`, `Notify`, `Logs`) and `Tichu` (`tichu.game.php`), `CardManager`, `LogManager`, `PlayerManager`, `LocalTichuBot`, and `LocalTichuScenarios`:
     - Game setup & Grand Tichu (`setupNewGame`, 8-card deal, `TEAM_RANDOM` & team color assignment, `grandTichuBet`, 6-card deal)
     - Out-of-turn Tichu bet (`tichuBet` before playing first card, `tichuCall` confirmation across trick boundaries, rejection after playing a card or duplicate bets)
     - Passing 3 cards (`giveTheCards`, invalid/duplicate card rejection & rollback via real `Deck::getCards`, `stAcceptPassedCards`, `bombs_completed_by_partner` stat, Mahjong leader)
     - Mahjong wish enforcement (`makeAWish`, `UserException` rollback when ignoring a wish that can be fulfilled including via non-wished bombs, straight-flush bomb wish detection)
     - Dog lead transfer & restrictions (`DOG_COMBO` partner/next-player transfer, 3rd-player-out Dog round termination)
     - Single & ambiguous Phoenix resolution (`ST_PHOENIX_PLAY`, `Combo::recheckPhoenix` straight/full-house auto-resolution, pre-`ST_PHOENIX_PLAY` Mahjong wish validation, `choosePhoenix`, `cancelPhoenix` after open/Dog leads)
     - Bomb interruption (`playBomb` out-of-turn during `playCombo` and `confirmTrick`, 4-card hand requirement, `cancel`, `pass`)
     - Dragon trick gift (`confirmTrick` -> `ST_CHOOSE_DRAGON_GIFT` -> `chooseDragonGift` to opponent, `tricks_win` stat tracking without double-counting on 3rd player out)
     - Autopass & turn-based auto-skip (`pass` out of turn in `playCombo` and `confirmTrick`, `AUTOPASS_ONCE` reset when blocked by Mahjong wish, `cancelAutopass`, `isAllInfoExposed` auto-skip)
     - Double victory & normal round scoring (1–2 finish by partners, `playerGoOut` notification, immediate round end, `+200`/`0` team scoring, round-to-round trick counter reset)
     - Full multi-round game end-to-end via `LocalTichuBot` to 1000 points (`ST_GAME_END` = 99)
     - Zombie turns (`zombieTurn` across all 9 `activeplayer` and `multipleactiveplayer` states with session isolation)
     - Action & parameter validation (`cancel`, `makeAWish`, `chooseDragonGift`, `playCombo`, `playBomb`, `CardManager::cardToStr`)
     - Table lock contract (`lockVersion` init/bump, no bump for rejected/no-op/autopass requests, silent duplicate `collect`)
   - Run both unit and backend integration tests together via **`npm test`**.

   **Race / Concurrency Stress Test (`npm run test:race` / `php local/race-tests.php`, ~60s + ~10s, NOT part of `npm test`/`npm run build`)**:

   - Spawns persistent PHP worker processes that execute emulated BGA requests (`action_tichu` -> `Tichu`) truly in parallel against the local MySQL 8.0 InnoDB server (`ebd_tichu_1` over `local/.mysql/mysql.sock`), running with BGA's default `--transaction-isolation=SERIALIZABLE` and `Tichu::initTable()`'s `GET_LOCK('tichu_table_1', 20)` + `SET SESSION transaction_isolation = 'REPEATABLE-READ'` and `SELECT ... FOR UPDATE` row locks.
   - Phase 1: targeted scenarios repeated `--reps` times with exact expectations (4x concurrent `collect` + autopass, 4 players' `grandTichuBet` + duplicate tabs, 4 players' `giveTheCards`, 3 Tichu calls vs. a pass, 2 competing bombs vs. a pass).
   - Phase 2: `--duration` seconds of randomized bursts over whole games (legal moves duplicated from "other tabs", out-of-turn Tichu/autopass/bombs/confirmTichu, `getAllDatas` page loads, zombie turns, garbage requests), checking invariants after every burst: 56 unique cards in valid locations, per-state card distribution and multiactive sets, table cards == logged trick cards, `newRound`/`newTrick` counted exactly once (`trick_number`/`round_number`/`tichu_number` stats match the action log), valid bets/scores, monotonic lock version, no stuck game, and **no exception other than `UserException`** (PHP warnings are fatal).
   - Options: `--duration=60 --workers=8 --seed=N --reps=25 --skip-scenarios --verbose`. `--baseline` sets `TICHU_DB_IGNORE_LOCKS=1` (stripping `GET_LOCK`, `SET SESSION transaction_isolation`, and `FOR UPDATE`) so concurrent workers collide under raw MySQL 8.0 `SERIALIZABLE` to demonstrate the detected races and deadlocks (expected to FAIL). `RACE_DEBUG=1` prints every scenario request result.

3. **Local Browser Server & Frontend + Backend JS Console Integration Tests (`npm run local`)**:
   - **Start the local server**:
     ```bash
     npm run local
     # Starts MySQL 8.0 via local/mysql-ctl.sh and runs php -S 127.0.0.1:8080 local/router.php
     ```
     Then open `http://127.0.0.1:8080` in the browser (`local/.mysql/` is initialized and `ebd_tichu_1` is seeded automatically, and is gitignored).
   - **Interactive Dev Toolbar (`#local-dev-bar`)**:
     - Switch seats in place (`P0`–`P3` or `Spectator`), trigger bot moves (`🤖 Act for Others`, `🤖 Step 1`, `⚡ Auto-Bot`), toggle `🔀 Auto-Switch` (automatically switches the UI to whichever player's turn is next), toggle `⏱ Real-Time` vs. `🃏 Exposed Cards`, toggle `🗿 Tiki` card art, or start a `🔄 New Game`.
   - **Live Console Announcer**:
     - Every state transition (`[TICHU STATE]`), player action (`[TICHU ACTION]`), server notification (`[TICHU NOTIF]`), and UI assertion (`[TICHU UI]`) is logged in real time to the browser DevTools console.
   - **Console Test Runner (`window.tt` / `window.tichuTest`)**:
     - Run fast, visual, zero-click frontend+backend integration tests directly from the browser DevTools console (or via `page.evaluate` in the `browser` subagent) while watching the UI update live:
       ```js
       // Run all 7 deterministic scenarios + UI/DOM invariant checks (~370ms at "instant" speed)
       await tt.runSuite({ speed: "instant" }); // speeds: "instant" (0ms), "fast" (80ms), "normal" (350ms)

       // Play a full round end-to-end through the real client UI & notification queue (~3s)
       await tt.runRound({ speed: "instant" });

       // Play a full game to 1000 points
       await tt.runGame({ speed: "instant", maxRounds: 15 });

       // Load a specific scenario ("grand_tichu", "give_cards", "mahjong_wish", "phoenix_ambiguous", "bomb_interrupt", "dragon_gift", "double_victory")
       await tt.loadScenario("bomb_interrupt");

       // Inspect current state, hands, and legal actions, or assert DOM vs. gamedatas consistency
       tt.status();
       tt.assertUI();
       tt.help();
       ```
     - **URL Autorun Hook**: Open `http://127.0.0.1:8080/?autorun=suite&speed=instant` (or `autorun=round`, `autorun=game`, `autorun=<scenario>`) to execute a test suite automatically on page load and write the result to `window.__tichuAutorunResult`.

### Deployment & Live Testing on BGA Studio

BGA games cannot execute full multiplayer lifecycle locally; they run on the remote **BGA Studio** environment (`https://studio.boardgamearena.com`). The user does **not** use the VS Code SFTP extension; all SFTP syncing and BGA Studio testing/management are handled directly by the AI agent.

1. **Credentials Storage (`.vscode/bga-credentials.json` & `.vscode/sftp.json`)**:
   - All SFTP and BGA Studio web credentials are stored locally in `.vscode/bga-credentials.json` (and `.vscode/sftp.json`), which are gitignored under `.vscode` (**never** commit credentials to git).
   - **SFTP Server**:
     - Host: `1.studio.boardgamearena.com`, Port: `2022`, Protocol: `sftp`, Remote Path: `/tichu/`.
     - Username and password: Read from `.vscode/bga-credentials.json` (`.sftp.username` / `.sftp.password`).
   - **BGA Studio Web Accounts (`https://studio.boardgamearena.com`)**:
     - Main account: `dashwood0` (Administrator on the `tichu` project).
     - Test accounts for multiplayer testing: `dashwood0` through `dashwood9` (10 accounts total).
     - Password for all `dashwood0`..`dashwood9` accounts: Read from `.vscode/bga-credentials.json` (`.studioWeb.password`).

2. **Direct CLI SFTP Synchronization (`npm run deploy:sftp` / `local/sftp-sync.sh`)**:
   - **Canonical SFTP Command**: Always use [`local/sftp-sync.sh`](file:///Users/brohlfs/git/tichu/local/sftp-sync.sh) via npm scripts with `WaitMsBeforeAsync: 10000` (completes in ~3 seconds). **Never** improvise inline `expect` regex scripts or Python `paramiko` one-liners.
   - **Important**: Always run `npm run build` before uploading if any `.ts` file in `src/` was modified, so `tichu.js` is freshly bundled.
   - **Upload `tichu.js` + any git-modified deployable files (Default, ~3s)**:
     ```bash
     npm run deploy:sftp
     ```
   - **Upload specific files only (~2.5s)**:
     ```bash
     npm run deploy:sftp -- tichu.js tichu.css
     ```
   - **Upload all deployable game files (`--all`, ~5s)**:
     ```bash
     npm run deploy:sftp:all
     ```
   - **Downloading / Diffing Remote BGA Studio Files Against Local**:
     ```bash
     PW=$(jq -r '.sftp.password' .vscode/bga-credentials.json)
     USER=$(jq -r '.sftp.username' .vscode/bga-credentials.json)
     mkdir -p /tmp/studio_tichu
     /usr/bin/expect -c "
     set timeout 60
     spawn sftp -P 2022 -o StrictHostKeyChecking=no ${USER}@1.studio.boardgamearena.com
     expect \"Password:\"
     send \"${PW}\r\"
     expect \"sftp>\"
     send \"lcd /tmp/studio_tichu\r\"
     expect \"sftp>\"
     send \"get -r /tichu/* .\r\"
     expect \"sftp>\"
     send \"bye\r\"
     expect eof
     "
     ```
   - **Files Ignored from SFTP Upload**:
     `local/sftp-sync.sh` automatically filters out non-deployable paths. Never upload `.vscode`, `.git`, `.gitignore`, `.gitattributes`, `.prettierrc`, `.prettierignore`, `AGENTS.md`, `BGA_STUDIO_TESTING.md`, `README.md`, `bga-platform`, `local`, `tests`, `node_modules`, `dist`, `src`, `vendor`, `_ide_helper.php`, `bga-framework.d.ts`, or `version.php`.

3. **Testing on BGA Studio (via `browser` Subagent or User Browser)**:
   - **MANDATORY PLAYBOOK FOR BROWSER SUBAGENT**: Before delegating any live testing on BGA Studio to the `browser` subagent, **read [`BGA_STUDIO_TESTING.md`](file:///Users/brohlfs/git/tichu/BGA_STUDIO_TESTING.md)** and inline its pure-locator snippet directly in the subagent prompt (never ask the `browser` subagent to `read_file` from the repo workspace, as its sandbox blocks workspace reads)!
   - Key highlights from `BGA_STUDIO_TESTING.md`:
     - **NEVER pass `page.evaluate(...)` or `waitForFunction(...)` to the `browser` subagent**: Its system prompt forbids them and causes 60–100s of LLM thinking overhead per step as it rewrites your script. Always use pure Playwright locators (`page.getByText`, `page.locator`, `page.frameLocator('iframe')`) to click `#studio-test-bar` buttons (`#tt_btn_smoke`, `#tt_btn_round`, `#tt_btn_game`, `#tt_btn_stop`, `#tt_btn_new`) and read `#tt_test_output`.
     - **Zero Screenshots (`captureScreenshot: false`)**: Never take or parse screenshots during automated Studio or local testing when DOM state (`#tt_test_output`, `#logs`, `.stockitem`) provides exact structured JSON in milliseconds.
     - **Always Express Stop / CANCEL at Beginning & End**:
       - At the beginning on `https://studio.boardgamearena.com/gamepanel?game=tichu`, click `CANCEL` (if an unstarted table is open, which hides `Express start`) or `Express stop` (if a running table is open), then click BGA Studio's built-in **`Express start`** button.
       - At the end of the test, navigate to `https://studio.boardgamearena.com/table?table=<TABLE_ID>` and click BGA Studio's built-in **`Express stop`** button (or `#tt_btn_stop`) so no table is left dangling.
     - **Studio Test Runner (`src/studio-test.ts` + `debug_bga*` in `tichu.game.php`)**:
       - Only active on `studio.boardgamearena.com` (double-guarded on client hostname and `$this->getBgaEnvironment() === 'studio'` on server).
       - Runs full 4-player Smoke Test (`#tt_btn_smoke` / `tt.runSmokeTest()`) in **~1.8s**, full round (`#tt_btn_round` / `tt.runRound()`) in **~8.3s**, and full game (`#tt_btn_game` / `tt.runGame()`) in **~60–90s** from a single tab without switching `&as=<player_id>` URLs.
     - **Player IDs**: `dashwood0` = `2385074`, `dashwood1` = `2385075`, `dashwood2` = `2385076`, `dashwood3` = `2385077`.
   - **Mandatory Post-Invocation Profiling & Continuous BGA DOM Learning**:
     - **Verify Subagent Lifecycle**: After every `browser` subagent turn (or if a run takes >20s), check `manage_subagents` (`Action: "list"`) to ensure the subagent is not stuck in a background retry loop. If a subagent errors out or stalls, kill it immediately.
     - **Profile Every Browser Run**: Inspect the subagent's `<appDataDir>/brain/<subagent-id>/.system_generated/logs/transcript.jsonl` after each run to check how many steps it took and how many seconds each step spent.
     - **Turn Every Slow Step Into a Permanent DOM Shortcut**: If the subagent took more than 1–2 `webview_browser` script calls, had to take a screenshot, or hit an unexpected BGA page state (e.g., modal popup, missing button, URL redirect), diagnose the exact DOM structure/selector or BGA client code responsible and codify the deterministic locator/flow in [`BGA_STUDIO_TESTING.md`](file:///Users/brohlfs/git/tichu/BGA_STUDIO_TESTING.md) (and [`src/studio-test.ts`](file:///Users/brohlfs/git/tichu/src/studio-test.ts)) so the next run executes in a single zero-screenshot step.
   - **Studio Debugging Helpers & Gotchas**:
     - **Server SQL & Request Logs**: Navigate to `https://studio.boardgamearena.com/1/tichu/tichu/logaccess.html?table=<TABLE_ID>` to inspect full server-side request/SQL logs and PHP stack traces.
     - **`debug_<name>()` Methods**: Any `public function debug_<name>()` defined on `Tichu` in `tichu.game.php` automatically gets a clickable button in the Studio debug panel (`#toggleDebugFunctionsPanel`, DOM ID `debug_<name>`) for setting up test states or dumping data. Guard with `if ($this->getBgaEnvironment() !== 'studio') return;` or remove before release.
     - **Express Start Real-Time Clock Auto-Abandon**: Express Start creates a real-time table with a short clock. If all test players navigate away or stay disconnected long enough, BGA auto-abandons the table (_"All players (with a positive clock) choosed to abandon this game"_, resulting in a `0–0` Tie). This is a Studio clock timeout, not a scoring bug — simply start a new table.
   - **When to restart vs. refresh**:
     - Modifying `tichu.js`, `tichu.css`, `tichu.view.php`, or `tichu_tichu.tpl`: Refresh browser (`F5`).
     - Modifying `tichu.game.php`, `tichu.action.php`, or `modules/*.php`: Takes effect on the next AJAX action or page refresh (`F5`).
     - Modifying `dbmodel.sql`: Must **start a new game** (or use Studio's "Restart game" button) for the schema to be recreated.
     - Modifying `states.inc.php`, `gameinfos.inc.php`, `gameoptions.inc.php`, or `stats.inc.php`: Navigate to `https://studio.boardgamearena.com/studiogame?game=tichu` (Control Panel -> Manage games -> `tichu`) and click the corresponding button under **Game configuration**:
       - `Reload game informations`
       - `Reload statistics configuration`
       - `Reload game options configuration`

4. **Pushing a Release to Production (`boardgamearena.com`)**:
   - **CRITICAL SAFETY GUARDRAIL**: **NEVER** build a release or deploy a new version to production without getting **explicit, clear confirmation from the user first**. Safe actions like `Reload game informations` or `Dry run build (to check code warnings)` can be clicked anytime, but committing/building/deploying a release requires user approval.
   - Once confirmed by the user, follow these steps on `https://studio.boardgamearena.com/studiogame?game=tichu`:
     1. Ensure all local changes are tested and compiled (`npm run build`, which runs `npm test` + `compile` + `bundle`, plus `await tt.runSuite({ speed: "instant" })` in the local runner if frontend code changed), synced via SFTP to `/tichu/`, and verified on a Studio test table.
     2. Under the **Build a new release version** section on `https://studio.boardgamearena.com/studiogame?game=tichu`:
        - Click **`⇨ Dry run build (to check code warnings)`** first and verify there are no blocking warnings or errors in the modal popup.
        - Fill in the **`Release note: what has changed since the last release?`** input field (max 250 chars).
        - Click **`⇨ Commit & build a new version now`**. This snapshots the SFTP `/tichu/` files into BGA's internal SVN/release system and builds a numbered release package (e.g., `YYMMDD-HHMM`).
     3. Under the **Versions available for production** section:
        - Locate the newly built version row and click its **Deploy** button to push it live to `boardgamearena.com`.

5. **BGA Bug Reports (`https://boardgamearena.com/bugs?game=1237`)**:
   - All production bug reports and feature suggestions for Tichu on Board Game Arena are tracked at:
     - **Bug List**: `https://boardgamearena.com/bugs?game=1237` (Game ID `1237`)
     - **Specific Bug Report**: `https://boardgamearena.com/bug?id=<BUG_ID>`
   - Whenever the user references a reported bug (by ID, title, or topic) or asks to inspect, reply to, or update the status of a bug, look it up at `https://boardgamearena.com/bugs?game=1237` (or `https://boardgamearena.com/bug?id=<BUG_ID>`).

### Git & GitHub Push Quirk (HTTPS vs. SSH)

- The user's global `~/.gitconfig` has a rewrite rule (`url.git@github.com:.insteadof = https://github.com/`), while GitHub authentication on this machine is configured via the GitHub CLI (`gh auth git-credential`) over HTTPS rather than SSH keys.
- As a result, a standard `git push` or `git push origin main` rewrites the remote URL to `git@github.com:bro314/tichu.git` and fails with `Permission denied (publickey)`.
- **Solution**: Push using `https://www.github.com/bro314/tichu.git` (which bypasses the `https://github.com/` `insteadOf` prefix and redirects to HTTPS with `gh` credentials) and update the remote tracking ref:
  ```bash
  git push https://www.github.com/bro314/tichu.git main && git update-ref refs/remotes/origin/main HEAD
  ```

---

## 5. Agent Performance, Context Hygiene & Subagent Profiling

To keep turn latency at **~3–5 seconds per step** (instead of 20–80s+ caused by context bloat or runaway subagents), strictly follow these rules:

1. **Delegate Analysis of Huge `bga-platform/` & Stub Files to the `research` Subagent**:
   - The local `bga-platform/` snapshot contains massive minified bundles (`bga-platform/js/sveltec/dist/main.js` is 193,181 lines; `ly_metasite.js` is 56,140 lines; `ly_studio.js` is 41,576 lines) and `_ide_helper.php` is 4,677 lines.
   - **Never** read or grep large slices of `bga-platform/` or `_ide_helper.php` across multiple turns in the main conversation — doing so bloats the main transcript past 1 MB, triggers context compactions, and slows every subsequent LLM step to 20–60s.
   - Whenever you need to understand how BGA's frontend/studio layer works (`ly_studio.js`, `ly_metasite.js`, `main.js`, or `_ide_helper.php`), invoke the **`research` subagent** (`Model: "flash"`) with a specific question and have it return only the distilled findings (exact function names, endpoints, DOM selectors, and a <20-line snippet).
2. **Use `npm run deploy:sftp` (Never Improvise SFTP Commands)**:
   - Always upload via `npm run deploy:sftp` (`bash local/sftp-sync.sh`) with `WaitMsBeforeAsync: 10000`. Never write ad-hoc Python `paramiko` scripts or custom `expect` regexes that can hang or background-timeout.
3. **Avoid Unprompted Multi-Step Loops Before Answering the User**:
   - When the user asks a question or reports an issue, answer directly or confirm before launching into a 10+ step edit/build/SFTP/browser cycle.
   - Combine related edits into a single turn rather than interleaving many small `read_file` / `edit_file` steps.
   - Recommend `/compact` (or starting a fresh conversation) once a conversation exceeds ~150 steps.
4. **Profile Every `browser` Subagent Run & Eliminate Screenshots**:
   - **Self-Contained Prompts**: Never ask the `browser` subagent to `read_file` from the repo workspace (its sandbox blocks workspace files, wasting a full turn). Always paste the exact pure-Playwright script from [`BGA_STUDIO_TESTING.md`](file:///Users/brohlfs/git/tichu/BGA_STUDIO_TESTING.md).
   - **No Screenshots (`captureScreenshot: false`)**: Do not use visual screenshot parsing to inspect BGA pages or game state. Read `#tt_test_output`, `#logs`, or specific DOM locators directly.
   - **Post-Invocation Profiling**: Immediately after each `browser` subagent finishes, check its step count and step timings in `<appDataDir>/brain/<subagent-id>/.system_generated/logs/transcript.jsonl` and verify via `manage_subagents` that no subagent is left running. If any step was slow or required >1 `webview_browser` call, inspect the BGA page's DOM/JS to understand why, and record the direct selector/URL shortcut in [`BGA_STUDIO_TESTING.md`](file:///Users/brohlfs/git/tichu/BGA_STUDIO_TESTING.md).
