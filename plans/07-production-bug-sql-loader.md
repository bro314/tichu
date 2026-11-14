# 07 — Production Bug SQL Loader & Debug Helpers

- **Priority**: P1 (High developer leverage — reproduces real `boardgamearena.com/bug?id=...` dumps locally in seconds)
- **Scope**: `modules/DebugTrait.php` (new), `tichu.game.php`, `local/import-bug-sql.php` (new), `package.json`, `.agents/skills/bga-bug-triage/SKILL.md`
- **Estimated Effort**: Medium (Straightforward SQL/JSON player-ID remapping with Tichu-specific `actionlog` edge cases)
- **Dependencies / Sibling Interactions**: Supports [02 — Bug Triage Skill](file:///Users/brohlfs/git/tichu/plans/02-agent-skills-and-docs-restructure.md) and reproduces bugs found on `game=1237` (like those in [00](file:///Users/brohlfs/git/tichu/plans/00-live-bugs-and-bga-compliance-fixes.md) and [11](file:///Users/brohlfs/git/tichu/plans/11-turn-based-confirm-trick-autoskip.md)).

---

## 1. Why & Goal

When a player files a bug on Tichu (`https://boardgamearena.com/bugs?game=1237`), BGA gives maintainers a downloadable SQL dump of that exact production table (`player`, `global`, `card`, `actionlog`, `gamelog`, `stats`, etc.) containing the real production `player_id`s and potentially ending in state `99` (`ST_GAME_END`).

Right now, Tichu has **no `loadBugReportSQL` Studio debug helper** and **no local MySQL bug importer**, meaning debugging a live customer report requires painstakingly hand-constructing a repro scenario from logs.

Top BGA maintainers (`elaskavaia/bga-mars`, `rbellec/claude-code-bga`, `Tisaac`, `thoun`) ship a `DebugTrait` with `loadBugReportSQL(int $reportId, array $studioPlayers)` on BGA Studio AND/OR a local script to load a bug SQL dump straight into local Studio/MySQL (`ebd_tichu_1`).

Goal: Allow dropping `bug_<id>.sql` from BGA into Tichu and booting that exact broken game state locally (with Studio/local player IDs remapped cleanly) in < 5 seconds!

---

## 2. Open-Source BGA References

- **`rbellec/claude-code-bga` (`references/debug-helpers.md`) & `_ide_helper.php`**: Documents `#[Debug(reload: true)]` public Studio debug methods (automatically appear in Studio's Debug menu!) and `loadBugReportSQL(int $reportId, array $studioPlayers)` running against Studio's `bug_<id>.sql` upload via two-phase offset player ID replacement (to avoid `A -> B -> C` collisions!).
- **`elaskavaia/bga-mars` (`modules/php/Debug.php`)**: Battle-tested `loadBugReportSQL` implementation including:
  - Two-phase player ID remapping (offsetting by `+100000` or negative/unique temp IDs first, then mapping to studio seats),
  - Remapping `global` active/turn player IDs (`global_id = 2`, etc.),
  - Re-opening finished tables (`global_id = 1` = `99` -> an interactive state so you can inspect/step!),
  - Re-computing / patching game-specific JSON columns containing embedded `player_id`s!

---

## 3. Current State in Tichu

Tichu stores `player_id` in **7 distinct surfaces** that MUST ALL be remapped consistently:

1. `player`: `player_id`, `player_no` (seat order)
2. `global`: `global_id = 2` (active player), `global_id = 3` (state / next? verify BGA global IDs in `local/bga-std-schema.sql` & `tichu.game.php`!), plus Tichu globals (`firstPlayer`, `mahjongWish` rank? check all custom global IDs in `tichu.game.php`!)
3. `card`: `card_location_arg` (when `card_location` IN `'hand'`, `'temporary'`, `'captured'`), **AND `card_passed_from`** (custom column on `card` table!)
4. `actionlog`: `log_player` **AND inside `log_arg` JSON** (`changePlayer.active`, `confirm.nextPlayer`, and any other `log_arg` keys containing player IDs — audit `LogManager.php` completely!)
5. `gamelog`: `gamelog_player`, `gamelog_current_player`, and `gamelog_notification` JSON (`player_id`, `player_id2`, `player_id3`, etc.)
6. `stats`: `stats_player_id`
7. Multiactive player flags (`player_is_multiactive` in `player`).

And Tichu's `local/mysql-ctl.sh` + `local/bga-backend.php` already run against an isolated socket-only MySQL 8.0 (`ebd_tichu_1`) with real `local/Bga/GameFramework/`, so importing BGA MySQL dumps requires zero SQL dialect translation!

---

## 4. Decisions & Alternatives for You

1. **Where to support loading bug dumps**:
   - **Option A (CONFIRMED)**:
     1. Add `modules/DebugTrait.php` with `loadBugReportSQL(int $reportId, array $studioPlayers)` (and optional `#[Debug(reload: true)]` helpers like `debugEndRound()` / `debugGiveDragon()`) for BGA Studio;
     2. Also add `local/import-bug-sql.php` CLI script so you can import a downloaded BGA bug `.sql` dump directly into `local/mysql-ctl.sh` (`ebd_tichu_1` MySQL 8.0) without needing SFTP/Studio at all!
   - **Option B**: Studio `loadBugReportSQL` only. _Slower_ — requires uploading `.sql` via SFTP to Studio before inspecting.
2. **Handling `global_id = 1` when bug dump ended at state `99` (`ST_GAME_END`)**:
   - **Option A (CONFIRMED)**: Notice if `global_id = 1` is `99` (`ST_GAME_END`), log a clear note and reset it to `ST_CONFIRM_TRICK` (`60`) or the pre-end state (or let a flag `--state=60` override) so BGA Studio's client UI actually renders the table instead of just the End-of-Game podium!
3. **Production safety of `DebugTrait`**:
   - **Option A (CONFIRMED)**: Studio automatically strips or restricts `debug*` methods in production, AND keep every method prefixed cleanly (`debug_*` / `#[Debug(reload: true)]`) with NO risky `TRUNCATE` or side effects unless intentionally invoked in Studio debug UI. Notice also: `loadBugReportSQL` is only ever executed in Studio (`bug_<id>.sql` doesn't exist in prod).

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Audit Every `player_id` Reference in Tichu's Schema & Code

- Read `dbmodel.sql`, `modules/managers/LogManager.php`, `modules/managers/CardManager.php`, `modules/managers/PlayerManager.php`, and the `initGameStateLabels` block of `tichu.game.php`.
- Produce an exhaustive list of every table column, `global_id`, and JSON key (`actionlog.log_arg`, `gamelog.gamelog_notification`) that holds a `player_id`.

### Step 2: Implement `modules/DebugTrait.php` & Mix Into `Tichu`

- Create `modules/DebugTrait.php` (`trait DebugTrait`) and `use DebugTrait;` inside `class Tichu` in `tichu.game.php`.
- Implement `public function loadBugReportSQL(int $reportId, array $studioPlayers)`:
  1. Read `/src/bug_{$reportId}.sql` (or Studio's standard `bug_{$reportId}.sql` relative path — check `_ide_helper.php` / `bga-mars` exact Studio path!).
  2. Read old `player_id` order (`ORDER BY player_no ASC`) and build two-phase remap (`old -> temp -> newStudioId`) across `player`, `global`, `card` (`card_location_arg` where location in `hand`/`temporary`/`captured`, `card_passed_from`), `actionlog` (`log_player` + JSON decode/remap/encode on `log_arg` for `active`, `nextPlayer`, etc.), `stats`, and `gamelog` (regex/JSON replacement on `gamelog_notification` + `gamelog_player`).
  3. Preserve `player_name` / `player_color` synced to `$studioPlayers` or Studio `player` table so UI displays properly.
  4. Unblock `global_id = 1` from `99` (`ST_GAME_END`) if needed.
- Optionally add 2–3 high-value `#[Debug(reload: true)]` Studio helpers (e.g., `debug_goToEndOfRound`, `debug_dealTestHand`) gated cleanly for Studio testing.

### Step 3: Build `local/import-bug-sql.php`

- CLI: `php local/import-bug-sql.php path/to/bug_12345.sql [--state=60]`
- Loads standard + game tables cleanly into MySQL 8.0 `ebd_tichu_1` via `local/mysql-ctl.sh` and runs the **exact same shared two-phase remap logic** as `DebugTrait`, mapping the 4 original players onto local `dashwood0..3` IDs (`2385074..2385077` or `1..4` used by `local/bga-backend.php` — inspect `local/bga-std-schema.sql` & `local/scenarios.php` to match local IDs!).
- Add `"bug:import": "php local/import-bug-sql.php"` to `package.json` and document in `.agents/skills/bga-bug-triage/SKILL.md`.

### Step 4: Write Automated Fixture Test for Bug Importer

- Construct a sanitized synthetic `bug_fixture.sql` (capturing a real mid-trick Tichu state including `card_passed_from`, `actionlog.log_arg` JSON `{ "active": 90001 }`, `confirm` `{ "nextPlayer": 90002 }`, and `global_id = 1` = `99`) inside `tests/` or `local/`.
- Verify remapping produces zero dangling old `player_id`s in SQL strings, JSON blobs, `card_passed_from`, or `global`, and loads cleanly in `local/bga-backend.php` (`getAllDatas()` succeeds!).

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **Collision Bug in Naive 1-Pass Remap**: If old players are `[10, 20, 30, 40]` and target local players overlap (`[1, 2, 3, 4]` or swapped seats `[20, 10, 40, 30]`), 1-pass replacement corrupts IDs! **Always use 2-phase remapping** (e.g., map every old ID to `90000000 + idx` first, then `90000000 + idx -> targetId`).
- **Word-Boundary Caution in `gamelog_notification` JSON**: When replacing `player_id` inside serialized JSON strings, decode JSON (`json_decode` / recursive array walk on known keys + values matching exact integer/string `oldId`) rather than blind substring `str_replace("12", ...)` which would corrupt card IDs or timestamps!
- **`local/sftp-sync.sh`**: Remember `modules/DebugTrait.php` **must** be matched by `local/sftp-sync.sh` (`modules/*` check!), whereas `local/import-bug-sql.php` stays purely local!
- **Sibling Plans**: Update `.agents/skills/bga-bug-triage/SKILL.md` (created in [02](file:///Users/brohlfs/git/tichu/plans/02-agent-skills-and-docs-restructure.md)) with the exact `bug:import` command.

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [x] Sanitized fixture `.sql` test remaps all 4 players cleanly across `player`, `global`, `card.card_location_arg`, `card.card_passed_from`, `actionlog.log_player`, `actionlog.log_arg` JSON, `stats`, and `gamelog`.
- [x] Importing the fixture into local MySQL 8.0 (`ebd_tichu_1`) allows opening `http://127.0.0.1:8080` (`npm run local`) and viewing `getAllDatas()` with zero PHP warnings or missing player errors.
- [x] `composer phpstan` (if Plan 01 installed) + `npm test` + `npm run build` pass cleanly.
- [x] `local/sftp-sync.sh` verified to include `modules/DebugTrait.php`.
- [ ] Test on some actual bug reports.

