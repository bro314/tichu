# Tichu for Board Game Arena

This repository contains the implementation of the partnership climbing card game **Tichu** (designed by Urs Hostettler, published by Fata Morgana Spiele) for [Board Game Arena (BGA)](https://boardgamearena.com/gamepanel?game=tichu).

## Overview

- **Backend**: PHP 8+ running on the BGA Studio framework (`Table`, `APP_GameAction`, `game_view`, and `Deck` modules) backed by MySQL (`dbmodel.sql`).
- **Frontend**: TypeScript (`src/`) compiled and bundled via `esbuild` into ES5-compatible `tichu.js`. Combines BGA's Dojo/GameGui (`ebg.core.gamegui`, `ebg.stock`) with modern **Lit** Web Components and **RxJS** (`src/elements/`) for the status display and interactive archive replay viewer.
- **Styling**: Responsive CSS (`tichu.css`) featuring 11 color themes, List and Square table layouts, clockwise/counterclockwise play order, and optional Tiki Edition card art.

## Prerequisites

- **Node.js & npm** (for compiling TypeScript, bundling `tichu.js`, and formatting code with Prettier)
- **PHP & Composer** (optional locally, for running PHPUnit tests on `Combo` and `Hand` logic)
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
```

> **Note**: `tichu.js` and `dist/` are ignored by Git (`.gitignore`), but `tichu.js` **must** be built (`npm run build`) and synced to the BGA Studio server via SFTP so BGA can load the client code.

### Running Tests & Local BGA Runner

You can run Tichu completely locally (with SQLite and a lightweight BGA frontend shim in `local/`) and execute fast automated tests:

```bash
# Run both PHPUnit unit tests and SQLite backend integration tests (~170ms)
npm test

# Run only PHPUnit unit tests (Combo & Hand logic)
npm run test:unit

# Run only in-memory SQLite backend integration tests (11 end-to-end suites)
npm run test:integration

# Start the local interactive BGA runner at http://127.0.0.1:8080
npm run local
```

When `npm run local` is running at `http://127.0.0.1:8080`, you can play interactively using the top dev toolbar (seat switcher, bots, auto-switch turn mode, Tiki art toggle) or run frontend+backend integration tests directly from the browser DevTools console via `window.tt` (`window.tichuTest`):

```js
await tt.runSuite({ speed: "instant" }); // Run all 7 deterministic UI + backend scenarios
await tt.runRound({ speed: "fast" });    // Watch a full round play out in the UI
await tt.runGame({ speed: "instant" });  // Play a complete game to 1000 points
tt.help();                               // List all console test runner commands
```

## Project Structure

| Path | Description |
| :--- | :--- |
| `tichu.game.php` | Main server-side game logic (`class Tichu extends Table`), state actions, and DB upgrades |
| `tichu.action.php` | Server-side AJAX action endpoints called from the client |
| `tichu.view.php` & `tichu_tichu.tpl` | Server-side view builder and HTML/JS layout template |
| `states.inc.php` | BGA finite state machine configuration |
| `material.inc.php` | Card suits, ranks, special cards, combo labels, and module imports |
| `gameinfos.inc.php` | BGA game metadata |
| `gameoptions.inc.php` | Game variants (score target, team selection) and user preferences (layout, order, art, theme) |
| `stats.inc.php` | Table and player statistics configuration |
| `dbmodel.sql` | Database schema extensions (`player` custom columns, `card` table, `actionlog` table) |
| `modules/` | Backend PHP classes (`Combo`, `Hand`, `Constants`, `Utils`) and managers (`CardManager`, `LogManager`, `NotificationManager`, `PlayerManager`) |
| `src/tichu.ts` | Main TypeScript client controller (`bgagame.tichu`) |
| `src/elements/` | Lit + RxJS web components (`<tichu-status>`, `<tichu-replay>`, `<tichu-player>`, `<tichu-stock>`, `<tichu-card>`, `<tichu-score-board>`) |
| `tichu.css` | Stylesheet including theme variables, card sprite positioning, and responsive layout scaling |
| `tests/` | PHPUnit test suite (`ComboTest.php`, `HandTest.php`) and BGA stubs |
| `local/` | Self-contained local BGA runner (`router.php`, `bga-backend.php`, `bot.php`, `scenarios.php`), backend integration tests (`integration-tests.php`), and frontend shim (`js/bga-shim.js`, `css/bga-shim.css`) |

## Syncing & Deploying to BGA Studio

1. **SFTP Sync**: Configure your SFTP client (such as the VS Code SFTP extension in `.vscode/sftp.json` or `lftp`) to sync the repository root (including the built `tichu.js`, excluding `node_modules/`, `dist/`, `.git/`, and `.vscode/`) to your BGA Studio `/tichu/` directory on `1.studio.boardgamearena.com:2022`.
2. **Testing on Studio**: Test multiplayer flows using BGA Studio's multi-account session switcher at `https://studio.boardgamearena.com`.
   - Restart the test table if you modify `dbmodel.sql`.
   - Reload game configurations in the BGA Studio Control Panel if you modify `gameinfos.inc.php`, `gameoptions.inc.php`, `states.inc.php`, or `stats.inc.php`.
3. **Deploying to Production**: Build a new release from the BGA Studio Control Panel once all changes are synced and verified.
4. **Bug Tracker**: Production bug reports for Tichu on BGA are tracked at [https://boardgamearena.com/bugs?game=1237](https://boardgamearena.com/bugs?game=1237).

For detailed architectural notes and AI agent guidelines, see [AGENTS.md](./AGENTS.md).
