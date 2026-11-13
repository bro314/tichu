# BGA Open-Source Ecosystem & Documentation Reference

This progressive-disclosure reference preserves curated open-source Board Game Arena (BGA) documentation links, inspiration repositories, tools/libraries, ecosystem census data, and architectural guardrails discovered while auditing open-source BGA projects for **Tichu**. Consult this file on demand when researching how other BGA games solve UX/platform problems or planning new improvements.

For concrete, prioritized implementation blueprints derived from this research, see [`plans/`](file:///Users/brohlfs/git/tichu/plans).

---

## 1. Official BGA Studio Documentation Map (2025–2026 MkDocs vs. Legacy MediaWiki)

### Modern Official BGA Studio Documentation (`doc.studio.boardgamearena.com`)

`https://doc.studio.boardgamearena.com/` (`76` pages / `589` sections) supersedes the older MediaWiki (`en.doc.boardgamearena.com`) as BGA's primary specification for PHP 8.4 + ES2022 development:

- **Main Docs Hub**: https://doc.studio.boardgamearena.com/
- **Official AI Tooling & Migration Skill (`25` ordered migration workflows)**:
  - Overview: https://doc.studio.boardgamearena.com/framework-documentation/ai-tooling/
  - Downloadable Skill Archive: https://doc.studio.boardgamearena.com/assets/downloads/modernize-bga-game-project.zip
- **Get Started & Platform Baseline** (PHP 8.4, MySQL 5.7 prod / 8.0 Studio, Font Awesome 4.7 + 6.4 `fa6`):
  - Projects & Framework: https://doc.studio.boardgamearena.com/get-started/projects-and-framework/
  - Fixing an Existing Project: https://doc.studio.boardgamearena.com/get-started/fixing-existing-project/
- **Back-End Reference (`modules/php/Game.php` & `$this->bga->*`)**:
  - Database Schema (`dbmodel.sql`): https://doc.studio.boardgamearena.com/framework-documentation/back-end/game-database-model/
  - JSONC Configuration Files:
    - Meta-information (`gameinfos.jsonc`): https://doc.studio.boardgamearena.com/framework-documentation/back-end/game-meta-information/
    - Table Options (`gameoptions.jsonc`): https://doc.studio.boardgamearena.com/framework-documentation/back-end/table-options/
    - User Preferences (`gamepreferences.jsonc`): https://doc.studio.boardgamearena.com/framework-documentation/back-end/user-preferences/
    - Statistics (`stats.jsonc`): https://doc.studio.boardgamearena.com/framework-documentation/back-end/game-statistics/
  - Autowired Actions (`act*`, `#[IntArrayParam]`, `#[CheckAction(false)]`): https://doc.studio.boardgamearena.com/framework-documentation/back-end/actions/
  - Core Services & Lifecycle:
    - Database: https://doc.studio.boardgamearena.com/framework-documentation/back-end/database/
    - Notifications & Decorators: https://doc.studio.boardgamearena.com/framework-documentation/back-end/notify/
    - Globals: https://doc.studio.boardgamearena.com/framework-documentation/back-end/globals/
    - Zombie Mode: https://doc.studio.boardgamearena.com/framework-documentation/back-end/zombie-mode/
    - Debug (`#[Debug(reload: true)]`): https://doc.studio.boardgamearena.com/framework-documentation/back-end/debug/
    - Legacy Migration: https://doc.studio.boardgamearena.com/framework-documentation/back-end/legacy/
- **Front-End Reference (`modules/js/Game.js` & `this.bga.*`)**:
  - Core Modules:
    - Actions: https://doc.studio.boardgamearena.com/framework-documentation/front-end/actions/
    - States: https://doc.studio.boardgamearena.com/framework-documentation/front-end/states/
    - Notifications: https://doc.studio.boardgamearena.com/framework-documentation/front-end/notifications/
    - Status Bar: https://doc.studio.boardgamearena.com/framework-documentation/front-end/status-bar/
    - User Preferences: https://doc.studio.boardgamearena.com/framework-documentation/front-end/user-preferences/
    - Dialogs: https://doc.studio.boardgamearena.com/framework-documentation/front-end/dialogs/
  - Sounds (`sounds/` auto-loading): https://doc.studio.boardgamearena.com/framework-documentation/front-end/game-sounds/
  - Stylesheets (`[data-theme="dark"]`, `.dj_safari` `drop-shadow` GPU warning): https://doc.studio.boardgamearena.com/framework-documentation/front-end/game-interface-stylesheet/
  - Official Front-End ESM Libraries (`await globalThis.importEsmLib('<lib>', '1.x')`, hosted with `.d.ts` types at `https://x.boardgamearena.net/data/game-libs/<lib>/1.x/`): https://doc.studio.boardgamearena.com/framework-documentation/front-end/libs/ (`bga-animations`, `bga-autofit`, `bga-cards`, `bga-dice`, `bga-jump-to`, `bga-score-sheet`, `bga-zoom`; `ebg/stock` is officially deprecated)
- **Guidelines & Game Metadata Manager**:
  - UX/UI & Code Guidelines: https://doc.studio.boardgamearena.com/framework-documentation/guidelines/
  - Game Metadata Manager Portal (media/metadata/tags): https://doc.studio.boardgamearena.com/framework-documentation/game-metadata/

### Legacy MediaWiki Pages Still Worth Keeping Bookmarked (`en.doc.boardgamearena.com`)

- **Open-Source Code Sharing List** (`73` listed repos + `10` CodePens): https://en.doc.boardgamearena.com/BGA_Code_Sharing
- **Pre-Release Checklist**: https://en.doc.boardgamearena.com/Pre-release_checklist
- **Post-Release Phase & `upgradeTableDb`**: https://en.doc.boardgamearena.com/Post-release_phase
- **Interactive Tutorials Checklist**: https://en.doc.boardgamearena.com/Tutorials_checklist
- **Using AI for BGA Game Development**: https://en.doc.boardgamearena.com/Using_AI_for_BGA_game_development
- **Classic Components** (relevant while Tichu uses classic `Deck` / `Stock` / `GameGui`):
  - `Deck`: https://en.doc.boardgamearena.com/Deck
  - `Stock`: https://en.doc.boardgamearena.com/Stock
  - `GameGui`: https://en.doc.boardgamearena.com/Game_interface_logic:_yourgamename.js

### Community Developer Blog

- **BGA Devs Blog** (architecture deep-dives by Tisaac / `@Syarwin` & Bennygui / `@bennygui`): https://bga-devs.github.io/blog/

---

## 2. Top 10 Open-Source BGA Games for Tichu Inspiration

|   #    | Game / Repo                                                                                                                                     | Core Domain                       | Best Files & Patterns to Study for Tichu                                                                                                                                                                                                                               |
| :----: | :---------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | **[Odin](https://github.com/dorukkicikoglu/bga-odin)**                                                                                          | Climbing / Shedding (2025–2026)   | `odin.css`, `modules/js/ODNHandHandler.js`, `modules/php/ODNHandManager.php` — responsive `--card-width` mobile hand scaling, FLIP hand sort animation, persisted sort order, smart incompatible-selection reset, _"You can finish your hand!"_ safeguard.             |
| **2**  | **[Velonimo](https://github.com/Oliboy50/bga-velonimo)**                                                                                        | Multi-card Climbing / Shedding    | `velonimo.js`, `velonimo.css`, `modules/VelonimoCard.php` — `#group-cards-button` manual combo brackets (`cards-group-1..6` pinned left of hand), live recognized combo name/strength on Play button, inline card icons in `#logs`.                                    |
| **3**  | **[The Crew](https://github.com/Syarwin/bga-thecrew)**                                                                                          | 4p Partnership Trick-Taking       | `modules/php/States/TrickTrait.php`, `modules/js/States/TrickTrait.js` — out-of-turn `.preselected` card staging with automatic invalidation, trick-winner linger pacing before sweep, zombie mandatory-follow compliance, `isReadOnly`/`bgaAnimationsActive` guards.  |
| **4**  | **[Papayoo](https://github.com/Syarwin/bga-papayoo)**                                                                                           | Trick-Taking + 3-Card Pass        | `papayoo.css` — 5-second `.receivedCard` `@keyframes highlight` pulse so newly accepted passed cards remain noticeable after merging into a sorted hand.                                                                                                               |
| **5**  | **[Coinche](https://github.com/drasill/bga-coinche)**                                                                                           | 4p Partnership Trick + Bidding    | `coinche.js`, `gameoptions.json`, `gamepreferences.json` — zero-reload live preference updates, live round-by-round score modal button, out-of-turn pre-selection, partnership call/pass speech bubbles.                                                               |
| **6**  | **[Ticket to Ride](https://github.com/thoun/tickettoride)**                                                                                     | TypeScript + PHP Reference (2026) | `AGENTS.md`, `misc/distribution-test.*` — centralized `autopass`/`autopick` state-reset invariants documented explicitly for AI agents, clean Rollup TypeScript structure, deck distribution verification scripts.                                                     |
| **7**  | **[Conspiracy](https://github.com/thoun/conspiracy)** & **[Sea Salt & Paper](https://github.com/thoun/seasaltpaper)**                           | Modern Native BGA Reference       | `action.php`-free autowired `act*` attributes, `.tpl`/`.view.php`-free native ESM `modules/js/Game.js`, `sounds/` audio, floating `?` player-aid popin (`thoun/bga-help`), ColorADD colorblind suit accessibility.                                                     |
| **8**  | **[Heat: Pedal to the Metal](https://github.com/bga-devs/bga-heat)** & **[Tisaac Boilerplate](https://github.com/bga-devs/tisaac-boilerplate)** | Official `bga-devs` Card Engine   | `modules/php/Core/Notifications.php` decorators, `Core/Preferences.php` bidirectional sync, `Helpers/Log.php` checkpoint/undo gamelog cleanup.                                                                                                                         |
| **9**  | **[Terraforming Mars](https://github.com/elaskavaia/bga-mars)**                                                                                 | Large-Scale Production QA         | PHPUnit harness, `sync_check.php` stub-drift detector vs `_ide_helper.php`, `parser_trans.php` translation linter, `misc/docs/BUG_TRIAGE.md` bug-reproduction workflow.                                                                                                |
| **10** | **[Earth](https://github.com/bennygui/earth-public)** & **[Hardback](https://github.com/quietmint/bga-hardback)**                               | Production Debugging & Migrations | `loadBugReportSQL(int $reportId, array $studioPlayers)` JSON player-ID rewriter, `#[Debug(reload: true)]` Studio helpers, `checkVersion` client/server deploy guard, `upgradeTableDb` `DBPREFIX_` `try/catch` resilience for BGA Bug #64 (`zz_replay*` shadow tables). |

### Honorable Mentions

- **[Calypso](https://github.com/ADBond/bga-calypso)**: 4-player partnership statistics and 2-color vs 4-color deck preference patterns.
- **[Duelly](https://github.com/rbellec/bga_duelly)**: `phpstan.neon` (`level: max`) scanning `_ide_helper.php` with zero custom stubs, plus explicit rule-assumption logs (`doc/AUTHOR_QUESTIONS.md`).
- **[Sky Team](https://github.com/jordijansen/bga-skyteam)**: TypeScript `Preferences.ts` and PHP `CommandManager` command/undo architecture.
- **[Pax Pamir](https://github.com/FransBongers/bga-pax-pamir)**: Clean modular PHP `DB_Manager` paired with TypeScript.

---

## 3. High-Signal BGA Tooling, AI Skills, Type Templates & Libraries

### AI Skills & Static Verifiers

- **[rbellec/claude-code-bga](https://github.com/rbellec/claude-code-bga)**: Progressive-disclosure `SKILL.md` + `TECHNICAL_NOTES.md` + focused guides (`tutorial-ready.md`, `legacy-migration.md`, `translations.md`, `guidelines.md`).
- **[Brandon-Born/bga-mcp](https://github.com/Brandon-Born/bga-mcp)**: Read-only MCP server with 7 cross-file static validators (actions, state machine, notifications, DB usage, pre-release checks).
- **[ShawnMarx/bga-agentic-kit](https://github.com/ShawnMarx/bga-agentic-kit)**: `scripts/check_state_scope.py`, `preflight.sh`, and Playwright Studio automation `field-notes.md`.
- **[diegocepedaw/hexpionage](https://github.com/diegocepedaw/hexpionage)** (`tools/harness/check_contract.php` PHP-to-JS contract parity) and **[scotfree/ironandwhispers](https://github.com/scotfree/ironandwhispers)** (`tests/test_bga_checks.php` local reproduction of Studio Dry-Run checks).
- **[micahstairs/bga-workbench](https://github.com/micahstairs/bga-workbench)**: Active PHP 8.2+ / MySQL 8.0 fork of `danielholmes/bga-workbench` featuring `StateValidator.php` graph reachability checks.
- **[Ender-Wiggin2019/bga-develop-skill](https://github.com/Ender-Wiggin2019/bga-develop-skill)**: Agent skill bundling a complete 2,489-document offline Markdown export of the legacy BGA Studio Wiki.

### TypeScript Templates & IDE Descriptors

- **[NevinAF/bga-ts-template](https://github.com/NevinAF/bga-ts-template)**: Single-source `NotifTypes`, `PlayerActions`, `StateArgs`, and `.jsonc` schema generation (`bga-ts-template-reversi`, `borealisarticexpeditions`).
- **[elaskavaia/bga-dojoless](https://github.com/elaskavaia/bga-dojoless)** & **[thoun/bga-ts-example](https://github.com/thoun/bga-ts-example)**: Reference TypeScript + ES2022 BGA client setups without legacy Dojo boilerplate.
- **[nalka0/bga-descriptors](https://github.com/nalka0/bga-descriptors)** & **[elaskavaia/bga-sharedcode](https://github.com/elaskavaia/bga-sharedcode)**: Community `_ide_helper.php` / `bga-*.d.ts` fixes and `generate_state_diagram.php`.

### Reusable UI Libraries (`thoun/*`)

- **[thoun/bga-animations](https://github.com/thoun/bga-animations)**, **[thoun/bga-cards](https://github.com/thoun/bga-cards)**, **[thoun/bga-score-sheet](https://github.com/thoun/bga-score-sheet)**, **[thoun/bga-jump-to](https://github.com/thoun/bga-jump-to)**
- **[thoun/bga-help](https://github.com/thoun/bga-help)**: Note that `bga-help` is a community UMD package, **not** an official `importEsmLib` library — for Tichu, borrow its UX pattern by building a native `<tichu-help>` Lit element mounted on `document.body`.

---

## 4. Meta-Research Findings Not Covered by `plans/00..14`

### Ecosystem Census (`742` Verified Unique Open-Source BGA Repos)

Across 1,801 candidate URLs audited (filtering out non-BGA/hardware "Ball Grid Array" hits), **742 unique open-source BGA repositories** were cataloged:

- **Official Studio Wiki (`BGA_Code_Sharing`)**: **73** repos (`9.8%`).
- **Other Wiki Pages** (`Using AI...`, `Cookbook`, `Tools and tips`): **+8** repos (`1.1%`).
- **Unlisted Across Code Hosts**: **+661** repos (`89.1%`) across GitHub (`734` total), GitLab (`5`), Bitbucket (`2`), and Codeberg (`1`) — comprising `628` full games (`399` active in 2024–2026), `63` browser extensions/scrapers, `21` CLI/AI-skill repos, `16` reusable UI/PHP libraries, and `14` templates/stubs.
- **Prolific BGA Author Handle Mapping**: **Tisaac** (Timothée Pecatte) publishes under `https://github.com/Syarwin` (26 repos) and `https://github.com/bga-devs` (not `@timothepecatte`); **Victoria_La** = `https://github.com/elaskavaia`; **Thoun** = `https://github.com/thoun` (45 repos); **Bennygui** = `https://github.com/bennygui`.

### Forensic Lineage of Other Tichu Repos & Extensions

- **[AndyKerrison/bga-tichu](https://github.com/AndyKerrison/bga-tichu)** (and its 2 zero-diff forks `bryanmcg/bga-tichu` and `ffallrain/bga-tichu`) is an abandoned 2015–2016 PHP 4 prototype by Bryan McGinnis — **unrelated** to Yannick Priol's production `game=1237` codebase (`bro314/tichu`). It contains no reusable backend code, though its 2016 Dojo `playCardOnTable` confirms early Tichu animated card slides.
- **[shaneam/BGATichu](https://github.com/shaneam/BGATichu)** (`2025`, TypeScript Chrome extension) scrapes `#logs` via `MutationObserver` (`log_extractor.ts`) to track played cards in real-time Tichu — direct evidence of player demand for readable log icons and trick tracking, and a strong reason to keep readable card text inside `#logs` spans rather than empty CSS sprite elements.

### Architectural Guardrails: What NOT to Adopt (`bro314/tichu` Already Leads)

1. **Do NOT replace `local/` with [`wardcanyon/localarena`](https://github.com/wardcanyon/localarena)**: `localarena` relies on heavy 4-container Docker + MySQL 5.7, hardcodes one table, and lacks zombies, replays, options, and multi-worker concurrency tests. Tichu's [`local/`](file:///Users/brohlfs/git/tichu/local) stack (`local/Bga/GameFramework/` + `local/mysql-ctl.sh` MySQL 8.0 `SERIALIZABLE` + `local/integration-tests.php` + `local/race-tests.php` + `src/studio-test.ts`) is faster and strictly higher-fidelity.
2. **Do NOT remove `initTable()` (`GET_LOCK` + `REPEATABLE-READ`) or `acquireGameLock()` (`GLOBAL_LOCK_VERSION = 30`)**: BGA's 2026 `Bga\GameFramework` provides no automatic locking primitive for out-of-turn interrupts (`playBomb`, `tichuBet`, `autopass`) or Studio's `debugSaveState(4)` `mysqldump`.
3. **Do NOT replace `<tichu-stock>` or `<tichu-score-board>` with `thoun/bga-cards` or `bga-score-sheet`**: Tichu's Lit + RxJS Shadow DOM components already serve both live play and `<tichu-replay>` cleanly without light-DOM wrapper friction.
4. **Never run Rector `deadCode` against `_ide_helper.php`**: Empty stub constructors in `_ide_helper.php` mislead Rector into deleting `parent::__construct()` inside `Tichu::__construct()`, breaking table initialization (`rbellec/bga_duelly` post-mortem).
5. **Never enable `$this->bIndependantMultiactiveTable = true`**: Incompatible with Tichu's direct `player_is_multiactive` lock queries.
6. **BGA Interactive Tutorial Creator Caveat**: BGA's Tutorial Creator inspects light-DOM `document.elementFromPoint(x, y)` IDs and breaks on Shadow DOM roots, `.disabler` full-table overlays, and auto-`collect` timers unless light-DOM proxy anchors are provided.
7. **Safari CSS Filter Caveat (`.dj_safari`)**: Never apply `filter: drop-shadow(...)` across many card nodes simultaneously (causes severe Safari GPU lag on BGA; use `box-shadow` instead).

### Accessing the BGA Developer Discord (`753304735615811584 / 1266017849374412812`)

- **Channel URL**: https://discord.com/channels/753304735615811584/1266017849374412812
- Standard `discord-mcp` bot integrations cannot be used because inviting a Bot requires `Manage Server` permission on BGA's official Discord server, and automated user-token CLI scrapers ("self-bots") violate Discord's ToS.
- **Three sanctioned ways to inspect that channel in future sessions**:
  1. **Antigravity Browser Subagent (`browser`)**: Ask the agent to open the Discord channel URL in the Browser pane, log in interactively once (cookies persist), and run targeted `in:#channel` searches.
  2. **`chrome-devtools-plugin` MCP**: Enable the `chrome-devtools` MCP server against a persistent Chrome profile already signed into Discord.
  3. **Local Snapshot in Gitignored `local/discord/`**: Export/save specific threads into a gitignored folder under `local/` (never synced by `local/sftp-sync.sh`) for instant `rg`/`jq` searches.
