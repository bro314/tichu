# 02 — Agent Skills & Docs Restructure (Context Optimization)

- **Priority**: P0 (Immediate token/context efficiency and error prevention for every future coding session)
- **Scope**: `AGENTS.md`, `BGA_STUDIO_TESTING.md`, `.agents/skills/*/SKILL.md` (new), optional `CLAUDE.md`, and optionally installing `modernize-bga-game-project` skill globally
- **Estimated Effort**: Small–Medium (Pure documentation & skill authoring; zero runtime code changes)
- **Dependencies / Sibling Interactions**: Incorporates `@thoun` `autopass` lessons, Shadow DOM Tutorial-Creator notes, and Studio workflows; directly improves execution speed of Plans `03`–`14`.

---

## 1. Why & Goal

Right now, `AGENTS.md` is **463 lines** (~32 KB) and automatically loaded into **every** agent conversation turn — even when an agent is just tweaking a CSS color or editing a TypeScript button. Meanwhile, `BGA_STUDIO_TESTING.md` (147 lines) holds critical Playwright, Studio URL, and `#studio-test-bar` test instructions in an unindexed root file, and Studio release/bug-triage checklists live only loosely in prose or external references.

Based on modern agent engineering best practices and BGA ecosystem tooling (`rbellec/claude-code-bga`, official `doc.studio.boardgamearena.com` `modernize-bga-game-project.zip`, `elaskavaia/bga-mars`):

1. **Trim `AGENTS.md` to ~130–160 lines** of _always-relevant_ architecture, invariants, build/test commands, and live-game guardrails (plus `@thoun`'s `autopass` invariants).
2. **Move deep task-specific playbooks into progressive-disclosure `.agents/skills/*/SKILL.md`** so agents only read them when needed:
   - `.agents/skills/bga-studio-testing/SKILL.md` (absorbs `BGA_STUDIO_TESTING.md`, `window.tt`, Studio SFTP sync, iframe Playwright rules)
   - `.agents/skills/tichu-concurrency-locks/SKILL.md` (MySQL 8.0 `SERIALIZABLE` + `acquireGameLock()` + `GLOBAL_LOCK_VERSION=30` + `debugSaveState(4)` + `race-tests.php` protocol)
   - `.agents/skills/bga-release-and-qa/SKILL.md` (BGA Pre-Release Checklist, `"Use minified JS / CSS"` verification, `upgradeTableDb`, Shadow DOM / BGA Tutorial-Creator `bga_tutorial_...` compatibility notes from `claude-code-bga`)
   - `.agents/skills/bga-bug-triage/SKILL.md` (BGA bug #1237 inspection, `loadBugReportSQL` replay flow once [Plan 07](file:///Users/brohlfs/git/tichu/plans/07-production-bug-sql-loader.md) lands)
3. **Adopt the official `modernize-bga-game-project` skill** (referenced on `doc.studio.boardgamearena.com`) globally or alongside for [Plans 13](file:///Users/brohlfs/git/tichu/plans/13-modern-bga-frontend-esm-and-sound-cleanup.md)–[14](file:///Users/brohlfs/git/tichu/plans/14-modern-bga-backend-autowired-actions-and-namespaces.md).

---

## 2. Open-Source BGA References

- **`rbellec/claude-code-bga` (`skills/board-game-arena/`)**: Uses a lean root pointer + focused topic references (`guidelines.md`, `translations.md`, `debug-helpers.md`, `tutorial-ready.md`, `legacy-migration.md`). Specifically highlights **Tutorial Creator incompatibility risks with Shadow DOM / pointer-event overlays** (critical for Tichu's Lit Shadow DOM + `.disabler`).
- **`doc.studio.boardgamearena.com` (`modernize-bga-game-project.zip`)**: BGA's official downloadable agent skill mapping classic BGA PHP/Dojo files to modern autowired actions, `Game.js` ESM, `BgaAnimations`, and `sounds/` audio.
- **`@thoun`'s BGA design rule (via `bga-cards` / community notes)**: Always document **autopass state-reset invariants** explicitly (resetting stored autopass flags when table state advances — new trick, bomb, new round — so stale autopass never auto-passes on an unexpected lead/bomb).
- **`elaskavaia/bga-mars` (`misc/` & developer docs)**: Structured bug-triage workflow linking BGA bug ID -> `loadBugReportSQL` -> unit/integration regression test.

---

## 3. Current State in Tichu

- `AGENTS.md`: 463 lines containing architecture overview, card format, `actionlog`, quirks, PHP/MySQL/Client pitfalls, Local Dev & Integration Testing (`bga-backend.php`, `mysql-ctl.sh`, `race-tests.php`, SFTP sync), Studio testing references, and git push HTTPS quirk (`git push https://www.github.com/bro314/tichu.git main`).
- `BGA_STUDIO_TESTING.md`: 147 lines in repo root detailing test accounts `dashwood0`..`dashwood3` (`2385074`..`2385077`), Playwright `iframe[name^="game"]`, strict forbidden actions (`curl`, Studio debug buttons vs UI).
- No `.agents/skills/` directory exists in `/Users/brohlfs/git/tichu/` yet.

---

## 4. Decisions & Alternatives for You

1. **Where to place the project skills (`.agents/skills/` vs `.claude/skills/`)**:
   - **Option A (CONFIRMED)**: Store canonical skills in `.agents/skills/<name>/SKILL.md` (Antigravity's native workspace skill discovery root) and optionally add a thin symlink or `CLAUDE.md` `@AGENTS.md` pointer if you also use Claude Code or Codex in the same repo.
   - **Option B**: Put skills inside global `~/.gemini/...`. _Not recommended_ for Tichu-specific skills (`tichu-concurrency-locks`, `bga-studio-testing` with Tichu accounts/buttons) — those belong versioned in the Tichu git repo.
2. **Fate of `BGA_STUDIO_TESTING.md` at repo root**:
   - **Option A (CONFIRMED)**: Move its full content into `.agents/skills/bga-studio-testing/SKILL.md` and either delete `BGA_STUDIO_TESTING.md` (with `README.md` link updated) or keep a 5-line tombstone pointer if any external scripts/bookmarks open `BGA_STUDIO_TESTING.md`.
   - **Option B**: Keep both files. _Rejected_ — creates immediate doc drift.
3. **Install official `modernize-bga-game-project.zip`**:
   - **Option A (CONFIRMED)**: Download during execution only into `~/.gemini/antigravity/skills/modernize-bga-game-project/` (global, not committed into Tichu unless desired) or extract key BGA 2025/2026 checklists into `.agents/skills/bga-release-and-qa/SKILL.md` so no third-party archive clutters the Tichu repo.

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Audit Every Section of `AGENTS.md` (463 lines) and `BGA_STUDIO_TESTING.md` (147 lines)

Read both files end-to-end and build an exact line-retention matrix guaranteeing **zero knowledge loss**:

- **Keep in lean `AGENTS.md` (~135–160 lines)**:
  - Stack & Classic-BGA vs Modern-BGA orientation (incl. `_ide_helper.php` & `bga-framework.d.ts` beat the wiki)
  - Project map (concise file table)
  - Card encoding (`type` 1..4, `type_arg` 1..14, sprite formula) & core `actionlog` events
  - Non-negotiable Live-Game Guardrails (never delete states/option IDs, `DBPREFIX_` in `upgradeTableDb`, no `--` in `dbmodel.sql`, `bga_rand` over `shuffle()`, dual ES5+ES6 `esbuild` rule, `import type` rule, Shadow DOM CSS custom properties, modal outside `#game_play_area_wrap`)
  - Essential Commands (`npm test`, `npm run build`, `npm run local`, `npm run deploy:sftp`, HTTPS `git push https://www.github.com/bro314/tichu.git main` quirk)
  - Skill index pointing agents to the 4 `.agents/skills/*` skills.

### Step 2: Create the 4 Progressive-Disclosure Skills

Each `SKILL.md` requires valid YAML frontmatter (`name`, `description` optimized for trigger matching):

1. `.agents/skills/bga-studio-testing/SKILL.md`: Full Studio workflow (`dashwood0`..`dashwood3`, `2385074`..`2385077`), `npm run deploy:sftp`, Playwright iframe rules, `#studio-test-bar` (`#tt_btn_smoke`, `#tt_btn_round`, `#tt_btn_game`, etc.), console/network checks, forbidden BGA Studio hacks.
2. `.agents/skills/tichu-concurrency-locks/SKILL.md`: MySQL 8.0 `SERIALIZABLE` vs BGA `REPEATABLE-READ`, `initTable()` (`GET_LOCK`), `acquireGameLock()` + `GLOBAL_LOCK_VERSION = 30`, why `$this->bIndependantMultiactiveTable` must NEVER be enabled, `debugSaveState(4)` `mysqldump` snapshot behavior, `local/mysql-ctl.sh`, and `npm run test:race`.
3. `.agents/skills/bga-release-and-qa/SKILL.md`: BGA Pre-Release Checklist, `"Use minified JS / CSS"` toggle check, Shadow DOM / `.disabler` vs **BGA Tutorial Creator** limitations & workarounds, `i18n` extraction rules, `@thoun` **autopass reset invariants** (every transition advancing table state — new trick, bomb interrupt, dragon gift, new round — must audit `player_pass` reset), and Post-Release `upgradeTableDb` rules.
4. `.agents/skills/bga-bug-triage/SKILL.md`: Investigating `https://boardgamearena.com/bugs?game=1237` / `bug?id=<ID>`, exporting SQL (`loadBugReportSQL` / `local/import-bug-sql.php` once Plan 07 is implemented), reproducing locally, writing a PHPUnit or MySQL 8.0 integration regression test before fixing.

### Step 3: Update Root `AGENTS.md`, `README.md`, and Optional `CLAUDE.md`

- Rewrite `AGENTS.md` cleanly to ~145 lines linking to the 4 skills.
- Update `README.md` if it mentions `BGA_STUDIO_TESTING.md`, and add a short `plans/` note if desired.
- Remove (or replace with pointer) `BGA_STUDIO_TESTING.md` per Decision #2.

### Step 4: Verify Skill Discovery & Link Integrity

- Write/run a tiny check verifying every `file://` or relative markdown link in `AGENTS.md`, `README.md`, and `.agents/skills/*/SKILL.md` resolves to an existing path, and zero sections from original `AGENTS.md` were dropped without landing in either trimmed `AGENTS.md` or one of the 4 skills.

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **Zero Knowledge Loss Rule**: Do NOT summarize away concrete details like exact account IDs (`dashwood0`/`2385074`), action name quirks (`giveCards`/`giveTheCards`, `phoenixPlay`/`choosePhoenix`), legacy state `45`, `TICHU_CONFIRMATION_TRESHOLD = 60`, `GLOBAL_LOCK_VERSION = 30`, or the `git push` URL quirk — preserve every concrete number and identifier verbatim in the target skill or trimmed `AGENTS.md`.
- **Upload Safety**: `.agents/` and `plans/` are excluded from `local/sftp-sync.sh`'s allowlist, so adding `.agents/skills/` never leaks files to BGA Studio.
- **Sibling Plans**: Keep `.agents/skills/bga-bug-triage/SKILL.md` updated when [07 — Production Bug SQL Loader](file:///Users/brohlfs/git/tichu/plans/07-production-bug-sql-loader.md) lands, and `.agents/skills/bga-release-and-qa/SKILL.md` aligned with [13](file:///Users/brohlfs/git/tichu/plans/13-modern-bga-frontend-esm-and-sound-cleanup.md)–[14](file:///Users/brohlfs/git/tichu/plans/14-modern-bga-backend-autowired-actions-and-namespaces.md).

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] `wc -l AGENTS.md` is ~130–160 lines (down from 463).
- [ ] 4 `.agents/skills/*/SKILL.md` files exist with valid YAML frontmatter (`name`, `description`).
- [ ] Line-by-line diff/audit confirms every concrete constant, account ID, command, and BGA pitfall from old `AGENTS.md` + `BGA_STUDIO_TESTING.md` is preserved in either `AGENTS.md` or a `SKILL.md`.
- [ ] Every markdown file path reference resolves cleanly on disk.
- [ ] `npx prettier --check AGENTS.md README.md ".agents/skills/**/*.md"` passes.
