# Tichu for Board Game Arena

This repository contains the implementation of the partnership climbing card game **Tichu** (designed by Urs Hostettler, published by Fata Morgana Spiele) for [Board Game Arena (BGA)](https://boardgamearena.com/gamepanel?game=tichu).

## Overview

- **Backend**: PHP 8+ running on the BGA Studio framework (`Table`, `APP_GameAction`, `game_view`, and `Deck` modules) backed by MySQL (`dbmodel.sql`).
- **Frontend**: TypeScript (`src/`) compiled and bundled via `esbuild` into `tichu.js`. Uses a thin BGA adapter (`src/tichu.ts` extending `ebg.core.gamegui`) backed by **RxJS** (`GameModel` for live play and `Model` for archive replay), **Lit** Web Components (`src/elements/*`) with full Shadow DOM for the entire game UI, and a Web Animations API FLIP overlay (`<tichu-animation-layer>`) for card deal, pass acceptance, play/bomb, trick sweep, Dragon gift, and hand sort animations.
- **Styling**: Responsive CSS (`tichu.css` + Shadow DOM component styles in `src/elements/`) featuring 11 color themes, List and Square table layouts, clockwise/counterclockwise play order, and optional Tiki Edition card art. All 6 BGA user preferences (`100`–`105`, including Animations) and hand sort order (`tichu_hand_sort_order`) sync live in both directions without reloading the page.

## Prerequisites

- **Node.js & npm** (for compiling TypeScript, bundling `tichu.js`, and formatting code with Prettier)
- **PHP & Composer** (for running the local BGA server, integration tests, and PHPUnit tests)
- **MySQL 8.0 (`mysql@8.0`)** (installed via Homebrew at `/opt/homebrew/opt/mysql@8.0`, managed locally via `local/mysql-ctl.sh` on a project-local socket `local/.mysql/mysql.sock`)
- **BGA Studio Account & SFTP Client** (for syncing and testing live on `studio.boardgamearena.com`)

## Development Commands

### Frontend Build & Formatting

```bash
# Install JS & PHP dependencies
npm install
composer install

# Run all unit + backend integration tests, compile TypeScript (src/ -> dist/), and bundle into tichu.js
npm run build

# Watch TypeScript files for compilation during development
npm run watch

# Format TypeScript, JS, CSS, and PHP files with Prettier
npm run format

# Upload tichu.js + modified deployable files to BGA Studio via SFTP (~3s)
npm run deploy:sftp

# Upload all deployable game files to BGA Studio via SFTP (~5s)
npm run deploy:sftp:all
```

> **Note**: `tichu.js` and `dist/` are ignored by Git (`.gitignore`), but `tichu.js` **must** be built (`npm run build`) and synced to the BGA Studio server via SFTP so BGA can load the client code.

### Running Tests & Local BGA Runner

You can run Tichu completely locally on top of the real BGA PHP framework (`local/Bga/GameFramework/`), an isolated local MySQL 8.0 InnoDB server (`local/mysql-ctl.sh`), and a lightweight BGA frontend shim (`local/js/bga-shim.js`):

```bash
# Manage the isolated project-local MySQL 8.0 server (auto-started by npm test / npm run local)
npm run mysql:start
npm run mysql:status
npm run mysql:stop

# Run PHPUnit unit tests, TypeScript combo/hand validator tests, and MySQL 8.0 backend integration tests (~2.7s)
npm test

# Run only PHPUnit unit tests (Combo & Hand logic, ~15ms)
npm run test:unit

# Run only TypeScript client Combo/Hand parity, Smart Play UX, & Studio adapter runtime regression tests (~130ms)
npm run test:validator

# Run only MySQL 8.0 + BGA Framework backend integration tests (18 end-to-end suites)
npm run test:integration

# Import a BGA production bug SQL dump into local MySQL 8.0 (remaps all 7 player_id surfaces) and inspect state
npm run bug:import -- path/to/bug_12345.sql --inspect

# Inspect the currently loaded local MySQL 8.0 game state, 56-card integrity, and recent actionlog/gamelog
npm run bug:inspect

# Run static contract verification (states, notifications, actions, DB/i18n/PHP 8.4 invariants)
npm run test:contracts

# Run PHPStan static analysis across backend PHP files
npm run phpstan

# Run the standalone multi-worker MySQL 8.0 concurrency & race-condition stress test (~70s)
npm run test:race

# Start the local interactive BGA runner at http://127.0.0.1:8080
npm run local
```

When `npm run local` is running at `http://127.0.0.1:8080`, you can play interactively using the unified top bar (`#studio-test-bar` inside `#local-dev-bar` — new-tab seat links, shared `debug_botStep`/`debug_botOthers`/`debug_botSuggest` bots, per-tab `Auto-Bot`, Tiki art & Real-Time/Exposed Cards toggles, and a collapsible `🧪 Tests` drawer) or run frontend+backend integration tests directly from the browser DevTools console via `window.tt` (`window.tichuTest`):

```js
await tt.runSuite({ speed: "instant" }); // Run all 7 deterministic UI + backend scenarios
await tt.runRound({ speed: "fast" }); // Watch a full round play out in the UI
await tt.runGame({ speed: "instant" }); // Play a complete game to 1000 points
await tt.startAutoPlayMe({ timeoutMs: 1500000, staggerMs: 250, stopOnIssue: true }); // Drive current seat autonomously (local or Studio; open 4 tabs via ?as=2385074..2385077)
tt.help(); // List all console test runner commands
```

> **4-Tab Autonomous Playtesting**: To run 4 independent seats (`2385074`–`2385077`) simultaneously up to 1000 points without zombie turns, open 4 tabs via `?as=<player_id>` (Local) or `expressStartNew:{"gameLength":2}` + `/tableview?table=<id>&as=<player_id>` (Studio) and run `startAutoPlayMe` in each; see [bga-studio-testing](file:///Users/brohlfs/git/tichu/.agents/skills/bga-studio-testing/SKILL.md) for the exact repeatable playbook and pitfall guide.

> **Local Framework Boundary**: Upstream framework classes in [`local/Bga/GameFramework/`](./local/Bga/GameFramework) (including `GamestateMachine.php` and `Table.php` above `//// Local Runner Integration Helpers`) are kept unmodified so local MySQL 8.0 concurrency and state-machine behavior match BGA Studio/Production. Local-only BGA request/notification emulation (`beginPlayerAction()` mirroring `Table::setTable()` ordering and `"synchro"`-interleaved `gamelog` delivery) lives strictly under `//// Local Runner Integration Helpers` in [`local/Bga/GameFramework/Table.php`](./local/Bga/GameFramework/Table.php), plus a bootstrap `?? 0` guard in [`local/Bga/GameFramework/TableOptions.php`](./local/Bga/GameFramework/TableOptions.php).

## Project Structure

| Path                                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tichu.game.php`                     | Main server-side game logic (`class Tichu extends Table`), state actions, and DB upgrades                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `tichu.action.php`                   | Server-side AJAX action endpoints called from the client                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `tichu.view.php` & `tichu_tichu.tpl` | Server-side view builder and HTML/JS layout template                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `states.inc.php`                     | BGA finite state machine configuration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `material.inc.php`                   | Card suits, ranks, special cards, combo labels, and module imports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `gameinfos.inc.php`                  | BGA game metadata                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `gameoptions.inc.php`                | Game variants (score target, team selection) and user preferences (layout, order, pass guard, art, theme, animations)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `stats.inc.php`                      | Table and player statistics configuration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `dbmodel.sql`                        | Database schema extensions (`player` custom columns, `card` table, `actionlog` table)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `modules/`                           | Backend PHP classes (`TichuBot`, `Combo`, `Hand`, `Constants`, `Utils`) and managers (`CardManager`, `LogManager`, `NotificationManager`, `PlayerManager`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/tichu.ts`                       | Lean TypeScript BGA adapter (`bgagame.tichu`) bridging BGA notifications, state hooks, and status-bar buttons to `window.gameModel`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/studio-test.ts`                 | Unified top bar (`#studio-test-bar` with collapsible `🧪 Tests` drawer) and console runner (`window.tt`), active on `studio.boardgamearena.com` and `127.0.0.1`/`localhost`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/types/`                         | TypeScript contracts and ambient declarations (`tichu-contracts.ts`, `bga-framework.d.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/elements/`                      | Lit + RxJS web components (`<tichu-game>`, `<tichu-animation-layer>`, `<tichu-player-panel>`, `<tichu-last-played>`, `<tichu-pass-area>`, `<tichu-action-bar>`, `<tichu-hand>`, `<tichu-value-choice>`, `<tichu-played-cards>`, `<tichu-trick-modal>`, `<tichu-status>`, `<tichu-replay>`, `<tichu-player>`, `<tichu-stock>`, `<tichu-card>`, `<tichu-score-board>`) and zero-DOM client `Combo`/`Hand` validator (`combo-validator.ts`)                                                                                                                                                                                                                                                                                                    |
| `tichu.css`                          | Stylesheet including theme variables, card sprite positioning, and responsive layout scaling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `tests/` & `phpstan.neon`            | PHPUnit test suite (`ComboTest.php`, `HandTest.php`), TypeScript client validator parity suite (`combo-validator.test.ts`), BGA stubs, and PHPStan static analysis config                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `local/`                             | Self-contained local BGA runner executing the real `local/Bga/GameFramework/` PHP classes against an isolated MySQL 8.0 InnoDB instance (`mysql-ctl.sh`, `bga-std-schema.sql`, `router.php`, `bga-backend.php`, `LocalTichuBot` wrapper in `bot.php`, `scenarios.php`), SFTP sync script (`sftp-sync.sh`), Studio production Sentry/PHP error checker (`check-prod-errors.js`), production bug SQL importer/inspector (`import-bug-sql.php`, `fixtures/bug_fixture.sql`), 18-suite backend integration, contract, & race stress tests (`integration-tests.php`, `check-contracts.php`, `race-tests.php`), and frontend shim (`js/bga-shim.js`, `css/bga-shim.css`, plus vendored BGA Studio assets in `css/font/roboto/` and `img/layout/`) |
| `.agents/skills/`, `docs/`, `plans/` | Progressive-disclosure [agent skills](./.agents/skills) (Studio testing, concurrency locks, release QA, bug triage), [open-source BGA ecosystem reference](./docs/BGA_OPEN_SOURCE_ECOSYSTEM.md), and prioritized implementation plans (`00`–`14`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Syncing & Deploying to BGA Studio

1. **SFTP Sync**: Run `npm run deploy:sftp` (or `npm run deploy:sftp:all`) to upload `tichu.js` and modified deployable game files to `/tichu/` on `sftp.studio.boardgamearena.com:22` via `local/sftp-sync.sh` (using password or dedicated SSH `privateKeyPath` credentials in `.vscode/bga-credentials.json` or `.vscode/sftp.json`, isolated from global `ssh-agent` keys, with SSH keepalives and connection-error detection).
2. **Testing on Studio**: Test single- or 4-player multiplayer flows using BGA Studio's multi-account sessions at `https://studio.boardgamearena.com` (`#studio-test-bar` / `window.tt`, including independent 4-tab `startAutoPlayMe` runs to `gameEnd`).
   - Restart the test table if you modify `dbmodel.sql`.
   - Reload game configurations in the BGA Studio Control Panel if you modify `gameinfos.inc.php`, `gameoptions.inc.php`, `states.inc.php`, or `stats.inc.php`.
3. **Deploying to Production**: Build a new release from the BGA Studio Control Panel once all changes are synced and verified.
4. **Bug Tracker**: Production bug reports for Tichu on BGA are tracked at [https://boardgamearena.com/bugs?game=1237](https://boardgamearena.com/bugs?game=1237).
5. **Production Error Monitoring**: Frontend/backend Sentry issues and PHP syntax errors are available at [https://studio.boardgamearena.com/studioissues?game=tichu](https://studio.boardgamearena.com/studioissues?game=tichu) (checked via `local/check-prod-errors.js` with Chrome DevTools MCP).

For detailed architectural notes, task playbooks, and AI agent guidelines, see [AGENTS.md](./AGENTS.md), [`.agents/skills/`](./.agents/skills), and [docs/BGA_OPEN_SOURCE_ECOSYSTEM.md](./docs/BGA_OPEN_SOURCE_ECOSYSTEM.md).
