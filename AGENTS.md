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
├── tichu_tichu.tpl              # HTML template & inline JS templates (jstpl_*)
├── tichu.css                    # Complete stylesheet (themes 0-10, square/list layouts, card sprites, responsive scaling)
├── tichu.js                     # Compiled/bundled ES5 client script deployed to BGA (generated by `npm run build`)
├── version.php                  # BGA version file (do not modify)
├── _ide_helper.php              # PHP IDE autocomplete stubs for BGA framework classes (not deployed)
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
│   ├── tichu.ts                 # Main BGA client class (`Tichu`), Dojo integration, state & notification handlers
│   ├── util.ts                  # Dojo query helpers (`dojostyle`, `dojohtml`)
│   ├── types/
│   │   └── bga-framework.d.ts   # TypeScript ambient declarations for BGA framework (`ebg`, `dojo`, `GameGui`, `Stock`)
│   └── elements/                # Lit + RxJS Web Components (status widget & experimental archive replay viewer)
│       ├── elements.ts          # Entry point registering `<tichu-replay>` and `<tichu-status>`
│       ├── model.ts             # RxJS `BehaviorSubject`-based reactive state store (`Model`) for replay mode
│       ├── subscription-controller.ts # Lit `ReactiveController` connecting RxJS observables to Lit lifecycle
│       ├── styles.ts            # Shared Lit CSS styles
│       ├── utils.ts             # RxJS `select`, `deepEqual`, `playerIdFromChannel`, client-side `hasBomb`
│       ├── tichu-status.ts      # `<tichu-status>`: displays Round, Trick, Trick Points, and "Show current trick" button
│       ├── tichu-replay.ts      # `<tichu-replay>`: full interactive replay viewer using `window.g_gamelogs`
│       ├── tichu-player.ts      # `<tichu-player>`: player area in replay mode (hand, played combo, passed cards, bomb indicator)
│       ├── tichu-stock.ts       # `<tichu-stock>`: card list container in replay mode
│       ├── tichu-card.ts        # `<tichu-card>`: single card / pass icon renderer in replay mode
│       └── tichu-score-board.ts # `<tichu-score-board>`: round-by-round score table in replay mode
├── tests/                       # PHPUnit unit test suite
│   ├── stubs.php                # BGA framework PHP stubs (`Table`, `APP_GameClass`, `GameState`, `feException`, etc.)
│   ├── TestUtils.php            # Card constants (`DR`, `PH`, `DOG`, `MJ`, `A2`..`DA`) and `card($type, $arg)` helper
│   ├── ComboTest.php            # Unit tests for `Combo` validation and descriptions
│   └── HandTest.php             # Comprehensive unit tests for `Hand` (bombs, highest combos, `canBeat`, `canFulFillWish`)
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
5. **Web Components Bundle Check**:
   - The `<tichu-status>` and `<tichu-replay>` custom elements live in `src/elements/elements.ts`. Make sure `src/tichu.ts` imports `./elements/elements` (or that `elements.ts` is included in the esbuild bundle) if changes to Lit elements need to be reflected in `tichu.js`.

---

## 4. Building, Testing, and Deployment Workflow

### Frontend Build (TypeScript + esbuild)
`tichu.js` is gitignored and generated from `src/` via npm scripts in `package.json`:
- **Install dependencies**: `npm install`
- **Compile TypeScript (`src/` -> `dist/`)**: `npm run compile` (`tsc -p src`)
- **Watch TypeScript**: `npm run watch` (`tsc --watch -p src`)
- **Bundle into `tichu.js` (ES5 target)**: `npm run bundle` (`esbuild ./dist/tichu.js --bundle --outfile=tichu.js --target=es5`)
- **Full Build (Compile + Bundle)**: `npm run build`
- **Format Code (TS + PHP)**: `npm run format` (`npx prettier --write .`)

> **Important**: Always run `npm run build` after modifying any `.ts` file so that `tichu.js` is updated for SFTP synchronization to BGA Studio.

### Local Unit Testing (PHPUnit)
Backend card/combo/hand logic in `modules/Combo.php` and `modules/Hand.php` is unit-tested using PHPUnit 9 (`composer.json`):
- **Run tests**: `./vendor/bin/phpunit tests` (requires `php` CLI installed on the machine; tests use `tests/stubs.php` and `tests/TestUtils.php` so no database or BGA server connection is needed).
- When modifying `Combo.php` or `Hand.php`, add corresponding test cases in `tests/ComboTest.php` or `tests/HandTest.php`.

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

2. **Direct CLI SFTP Synchronization (Agent Workflow)**:
   - Because `sshpass` and `lftp` are not installed on this machine, use `/usr/bin/expect` with `/usr/local/bin/sftp` to upload or download files non-interactively.
   - **Important**: Always run `npm run build` before uploading if any `.ts` file in `src/` was modified, and ensure `tichu.js` is uploaded to `/tichu/tichu.js` (even though `tichu.js` is gitignored locally, BGA Studio serves `/tichu/tichu.js` directly).
   - **Uploading Specific Changed Files to BGA Studio**:
     ```bash
     PW=$(jq -r '.sftp.password' .vscode/bga-credentials.json)
     USER=$(jq -r '.sftp.username' .vscode/bga-credentials.json)
     expect -c "
     set timeout 30
     spawn sftp -P 2022 -o StrictHostKeyChecking=no ${USER}@1.studio.boardgamearena.com
     expect -nocase \"password:\"
     send \"${PW}\r\"
     expect \"sftp>\"
     # Example: upload modified files to their matching remote paths under /tichu/
     send \"put tichu.js /tichu/tichu.js\r\"
     expect \"sftp>\"
     send \"put tichu.css /tichu/tichu.css\r\"
     expect \"sftp>\"
     send \"bye\r\"
     expect eof
     "
     ```
   - **Downloading / Diffing Remote BGA Studio Files Against Local**:
     ```bash
     PW=$(jq -r '.sftp.password' .vscode/bga-credentials.json)
     USER=$(jq -r '.sftp.username' .vscode/bga-credentials.json)
     mkdir -p /tmp/studio_tichu
     expect -c "
     set timeout 60
     spawn sftp -P 2022 -o StrictHostKeyChecking=no ${USER}@1.studio.boardgamearena.com
     expect -nocase \"password:\"
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
     Do not upload `.vscode`, `.git`, `.gitignore`, `.gitattributes`, `.prettierrc`, `.prettierignore`, `AGENTS.md`, `BGA_STUDIO_TESTING.md`, `README.md`, `node_modules`, `dist`, `vendor`, `_ide_helper.php`, `bga-framework.d.ts`, or `version.php`.

3. **Testing on BGA Studio (via `browser` Subagent or User Browser)**:
   - **MANDATORY PLAYBOOK FOR BROWSER SUBAGENT**: Before delegating any live testing on BGA Studio to the `browser` subagent, **read [`BGA_STUDIO_TESTING.md`](file:///Users/brohlfs/git/tichu/BGA_STUDIO_TESTING.md)** and include its key instructions/snippets in the subagent prompt!
   - Key highlights from `BGA_STUDIO_TESTING.md`:
     - **Player IDs**: `dashwood0` = `2385074`, `dashwood1` = `2385075`, `dashwood2` = `2385076`, `dashwood3` = `2385077`.
     - **Express Start**: Always click **`Express start`** directly from `https://studio.boardgamearena.com/gamepanel?game=tichu` (never create a lobby table first and click Express Start inside the lobby table, as that causes `Duplicate entry '1' for key 'player.PRIMARY'`).
     - **Fast Player Switching**: Switch players by navigating directly to `https://studio.boardgamearena.com/tableview?table=<TABLE_ID>&as=<PLAYER_ID>` (or keeping 4 tabs open to those URLs) rather than hunting for the tiny `➔` arrow in the DOM.
     - **Avoid Overlapping Card Clicks**: Use `window.gameui.playerHand.unselectAll()` and `window.gameui.playerHand.selectItem(String(cardId))` (and `window.gameui.onGiveCard(slotIdx)` for passing 3 cards) via `page.evaluate(...)` instead of coordinate-clicking overlapping `.stockitem` divs.
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
     1. Ensure all local changes are compiled (`npm run build`), synced via SFTP to `/tichu/`, and verified on a Studio test table.
     2. Under the **Build a new release version** section on `https://studio.boardgamearena.com/studiogame?game=tichu`:
        - Click **`⇨ Dry run build (to check code warnings)`** first and verify there are no blocking warnings or errors in the modal popup.
        - Fill in the **`Release note: what has changed since the last release?`** input field (max 250 chars).
        - Click **`⇨ Commit & build a new version now`**. This snapshots the SFTP `/tichu/` files into BGA's internal SVN/release system and builds a numbered release package (e.g., `YYMMDD-HHMM`).
     3. Under the **Versions available for production** section:
        - Locate the newly built version row and click its **Deploy** button to push it live to `boardgamearena.com`.

### Git & GitHub Push Quirk (HTTPS vs. SSH)
- The user's global `~/.gitconfig` has a rewrite rule (`url.git@github.com:.insteadof = https://github.com/`), while GitHub authentication on this machine is configured via the GitHub CLI (`gh auth git-credential`) over HTTPS rather than SSH keys.
- As a result, a standard `git push` or `git push origin main` rewrites the remote URL to `git@github.com:bro314/tichu.git` and fails with `Permission denied (publickey)`.
- **Solution**: Push using `https://www.github.com/bro314/tichu.git` (which bypasses the `https://github.com/` `insteadOf` prefix and redirects to HTTPS with `gh` credentials) and update the remote tracking ref:
  ```bash
  git push https://www.github.com/bro314/tichu.git main && git update-ref refs/remotes/origin/main HEAD
  ```

