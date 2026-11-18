---
name: bga-bug-triage
description: >-
  Triage, deduplicate, and reproduce production bug reports and suggestions for Tichu on Board
  Game Arena (boardgamearena.com/bugs?game=1237 and bug?id=<BUG_ID>), export and sync
  bug-reports.json into local/bugs/open-issues.json, recommend BGA statuses and developer replies,
  inspect Studio SQL/request logs, remap player IDs across Tichu's 7 database surfaces, and write
  PHPUnit or MySQL 8.0 integration regression tests. Use whenever the user mentions triaging BGA
  bugs, open-issues JSON sync, a BGA bug ID, a production bug report, or a SQL bug dump.
---

# BGA Bug Triage & Reproduction Playbook

## 1. BGA Bug Tracker URLs, Presets & Safety Rules

- **Open Reports List (9 active bug + suggestion statuses, sorted by last update)**:
  `https://boardgamearena.com/bugs?game=1237&statuses=open%2Cinfoneeded%2Cconfirmed%2Cwaitingfordeploy%2Cclaimed%2Cawaiting%2Cinforequest%2Cacknowledged%2Cdeploysuggestion&preset=open_reports&sort=lastupdate_desc`
- **Untriaged-Only Preset (`open` + `awaiting`, newest first)**:
  `https://boardgamearena.com/bugs?game=1237&statuses=open%2Cawaiting&preset=new_reports&sort=date_desc`
- **Specific Bug / Suggestion**: `https://boardgamearena.com/bug?id=<BUG_ID>`
- **Public Table Summary & Replay**: `https://boardgamearena.com/table?table=<TABLE_ID>`
- **Production Sentry Issues (Frontend & Backend)**: `https://studio.boardgamearena.com/studioissues?game=tichu` (`Display frontend & backend issues` under **Errors in production** on `studiogame?game=tichu`)
- **Studio User Errors for Table**: `https://studio.boardgamearena.com/studioissues?game=tichu&tableId=<TABLE_ID>`
- **Studio Server SQL & Request Logs**: `https://studio.boardgamearena.com/1/tichu/tichu/logaccess.html?table=<TABLE_ID>`
- **Studio Bug Dump Loader**: `https://studio.boardgamearena.com/studiogame/studiogame/loadBugReportDump.html?game=tichu&report_id=<BUG_ID>&players=4`

### Authentication & Human-in-the-Loop Guardrails

- **Browser Access (`dashwood314`)**: Always inspect `boardgamearena.com` via the `browser` subagent (`Model: "flash"`), where `dashwood314` (`player_id = 94570277`) is authenticated with developer/moderator triage permissions (`Developer tools`, status changes, duplicate linking, bulk actions). Never run `curl` or CLI HTTP scripts against `boardgamearena.com`. If the session is ever signed out, stop and ask the user to log in.
- **Strictly READ-ONLY by Default**: **Never** click `Post comment`, change a ticket's status, reclassify `bug`/`suggestion`, or link duplicates unless the user has explicitly approved the exact status and reply text for that ticket.

---

## 2. `"Export as JSON"` & Client-Side Pagination Playbook (`browser` Subagent)

### Verified BGA Svelte Tracker Mechanics

- **Endpoint & Modal**: Clicking `"Export as JSON"` on `/bugs` or `/bug?id=<ID>` calls `POST /bug/bug/exportAsJson.html` and opens a modal showing formatted JSON inside `<pre>`, plus `Copy` and `Download` (`bug-reports.json`).
- **Identical Schema on List & Detail Pages**: Both list and detail exports return a JSON array of objects with the exact same keys:
  - `id` (number), `title` (string), `creationDate` (ISO-8601 UTC), `lastUpdateDate` (ISO-8601 UTC)
  - `type` (`"block"`, `"access"`, `"action"`, `"rules"`, `"display"`, `"suggestion"`)
  - `status` (slug string, e.g. `"open"`, `"awaiting"`)
  - `tableId` (number), `votes` (number), `browser` (User-Agent string)
  - `detailLines` (array of `{ "question": string, "answer": string }`)
  - `comments` (array of `{ "creationDate": string, "authorName": string, "text": string, "status": string }`)
  - List export **already contains** full `detailLines` answers and full `comments` threads.
- **Detail-Page-Only Context**: Visit `/bug?id=<ID>` or `/table?table=<TABLE_ID>` only when needed for:
  1. `Developer tools` dump metadata (`<N> players, dump game state: <state>, move number: <move>` vs `Dump not found`) and `"Load on the Studio"` / `studioissues` links,
  2. Inline table chat log (`See table no <tableId> chat log`),
  3. Table mode, clock settings, end reason (`☯` timeout/abandon vs normal end), and player scores on `/table?table=<TABLE_ID>`,
  4. Posting an approved status/reply update.
- **20-Row Client-Side Pagination Gotcha**: `/bugs` loads `20` items per page (`replaceData: true`). Unchecked `"Export as JSON"` exports **only the 20 items on the active page**. Adding `&page=2` to the URL is ignored by BGA; to advance pages, click `>` (`page.locator('a.bga-button--xsmall').filter({ hasText: /^>$/ })`) and wait for the first row's bug ID (or `<page> / <totalPages>` indicator) to change.
- **Browser Sandbox Extraction & Cleanup Rules**:
  - Read `await page.locator('pre').first().textContent()` directly from the modal (since Blob `download.path()` returns `null` in the browser sandbox).
  - Close the modal via `await page.locator('.bga-popup-modal__header [role="button"]').click()`.
  - Never pass `page.evaluate`, `waitForFunction`, or unsupported `page.on` listeners (`console`, `pageerror`, `framenavigated`); set `captureScreenshot: false`, keep every `waitFor` timeout `<= 24000ms`, and always close the tab when done (`try { await page.close(); } catch (_e) { await page.goto("about:blank"); }`).

### Copy-Paste Playwright Export Snippet (Page 1 or Full Multi-Page Loop)

```javascript
const url =
  "https://boardgamearena.com/bugs?game=1237&statuses=open%2Cinfoneeded%2Cconfirmed%2Cwaitingfordeploy%2Cclaimed%2Cawaiting%2Cinforequest%2Cacknowledged%2Cdeploysuggestion&preset=open_reports&sort=lastupdate_desc";
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.locator("table tbody tr a").first().waitFor({ state: "attached", timeout: 20000 });

const maxPages = 1; // Set e.g. to 10 for a full sweep of all open_reports pages
const allItems = [];

for (let p = 1; p <= maxPages; p++) {
  const firstId = (await page.locator("table tbody tr a").first().innerText()).trim();
  const exportBtn = page.getByRole("link", { name: "Export as JSON", exact: true });
  await exportBtn.scrollIntoViewIfNeeded();
  await exportBtn.click();

  const pre = page.locator("pre").first();
  await pre.waitFor({ state: "visible", timeout: 15000 });
  const batch = JSON.parse(await pre.textContent());
  allItems.push(...batch);

  await page.locator('.bga-popup-modal__header [role="button"]').click();
  await pre.waitFor({ state: "hidden", timeout: 10000 });

  const nextBtn = page.locator("a.bga-button--xsmall").filter({ hasText: /^>$/ });
  if (p >= maxPages || (await nextBtn.count()) === 0) break;
  const disabled = await nextBtn.getAttribute("disabled");
  const cls = (await nextBtn.getAttribute("class")) || "";
  if (disabled !== null || cls.includes("disabled") || cls.includes("opacity-50")) break;

  await nextBtn.click();
  await page
    .locator(`table tbody tr a:not(:text-is("${firstId}"))`)
    .first()
    .waitFor({ state: "attached", timeout: 15000 })
    .catch(() => {});
  const nextFirstId = (await page.locator("table tbody tr a").first().innerText()).trim();
  if (nextFirstId === firstId) break;
}

try {
  await page.close();
} catch (_e) {
  await page.goto("about:blank");
}
return { count: allItems.length, items: allItems };
```

---

## 3. Local Open-Issues Index & Deduplication (`local/bugs/open-issues.json`)

- **Local Store**: Maintain exported open issues in `local/bugs/open-issues.json` (excluded from SFTP uploads because `local/` is never deployed). Upsert records by `id` so raw BGA fields (`bga`) sit alongside local triage state (`triage`: `triageState`, `cluster`, `duplicateOf`, `proposedStatus`, `proposedReply`, `notes`).
- **Incremental Daily Sync**: Because `sort=lastupdate_desc` orders most-recently-updated tickets first, exporting Page 1 (top 20) detects all new reports and new player replies since the previous sync — stop paginating once hitting an issue whose `lastUpdateDate` already matches `local/bugs/open-issues.json`. Run a full multi-page sweep periodically to prune tickets closed externally on BGA.
- **3-Layer Deduplication** (compare new tickets against all stored open and recently closed tickets before replying):
  1. **Exact `tableId` match (`tableId > 0`)**: Same game table almost always shares one incident (e.g. reporter files an `access` ticket and a `block` ticket minutes apart).
  2. **Same `authorName` within 24 hours**: Check for split or follow-up tickets by the same player.
  3. **Root-Cause / Topic Clustering**: Tag tickets by cluster (`zombie-turn`, `mahjong-wish`, `dog-bomb`, `pass-cards`, `trick-points`, `replay`, `sound`, `clock-desync`, `game-length-suggestion`). Keep the oldest or highest-vote ticket as canonical and mark newer duplicates as `Duplicate` (`duplicate_linked_id`).

---

## 4. Triage Decision Workflow, Release Cutoff Check & Status Taxonomy

### Triage vs. Fixing Boundary

- **Triage stays fast (2–5 minutes per issue)**: Classify root cause, check duplicates, check whether it was already fixed in a recent release, and draft the BGA status + developer reply.
- **Do not write deep implementation plans or fixes during triage** unless the user asks — mark verified unfixed bugs `Confirmed` and spin up a dedicated fix session afterward.

### Release Cutoff Check (`2026-11-12`–`2026-11-17` Overhaul)

Always compare a ticket's `creationDate` / `lastUpdateDate` against `git log`:

- **`2026-11-12` (`e2a725d`, `cf8b78b`)**: Full Lit Shadow DOM client rewrite and `zombieTurn()` overhaul fixing session-dependent `getCurrentPlayerId()` calls across all multiactive/active states (including `grandTichuBets`), `playComboOpen` / `playCombo` wish fulfillment, `playBomb` cancel, and `chooseDragonGift`.
- **`2026-11-13`–`2026-11-17` (`4268e09`, `fdc3389`, `335643c`, `b700b33`, `8ff7e71`, `e224c02`)**: Concurrency & `acquireGameLock()` (`GLOBAL_LOCK_VERSION = 30`, full `global` lock), orphaned `"Updating game situation ..."` lock recovery (`releaseOrphanedNotificationLock()`), `confirmTrick` auto-collect deadlock fix, zero-reload preferences, wish-bomb UI callout, and string `phoenixValue` normalization (`#257052`).
- For any ticket filed **before `2026-11-12`** whose symptoms match those fixes, verify against current code before marking `Confirmed` — many can be resolved directly as `Fixed` (for verified bugs like `cf8b78b`) or `Works for me` (for transient legacy UI/disconnect stalls).

### Complete BGA Status Taxonomy

#### Bug Statuses (`10` developer-selectable options, `suggestion: false`)

| Slug (`bga-dropdown-option-<slug>`) | Label                  | Removes from `open_reports`? | When to Use                                                                                              |
| :---------------------------------- | :--------------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------- |
| `open`                              | **Open**               | No                           | Untriaged bug not yet investigated.                                                                      |
| `infoneeded`                        | **Info needed**        | No                           | Missing move number, screenshot, or reproduction steps.                                                  |
| `confirmed`                         | **Confirmed**          | No                           | Verified bug still reproducible in current code; queue for fix session.                                  |
| `waitingfordeploy`                  | **Waiting for deploy** | No                           | Fixed on main/Studio, awaiting production deployment.                                                    |
| `fixed`                             | **Fixed**              | **Yes**                      | Confirmed bug whose fix is already live in production (`git log` / release confirmed).                   |
| `duplicate`                         | **Duplicate**          | **Yes**                      | Same root cause or same table incident as another ticket (set `duplicate_linked_id`).                    |
| `notabug`                           | **Not a bug**          | **Yes**                      | Matches official Tichu rules (e.g. wish fulfilled by bomb/Phoenix) or expected BGA clock/platform rules. |
| `worksforme`                        | **Works for me**       | **Yes**                      | Cannot reproduce; e.g. player-side network drop or un-reproducible legacy stall without dump/repro.      |
| `wontfix`                           | **Won't fix**          | **Yes**                      | Known minor edge case intentionally left unchanged.                                                      |
| `notupdated`                        | **Not updated**        | **Yes**                      | Reserved for BGA's automatic inactivity closure (do **not** use for fixed bugs).                         |

_(Note: `claimed` is admin/bounty-hunter only.)_

#### Suggestion Statuses (`7` options, `suggestion: true` — toggle via `Reclassify as suggestion` / `Reclassify as bug`)

| Slug (`bga-dropdown-option-<slug>`) | Label                  | Removes from `open_reports`? | When to Use                                                                       |
| :---------------------------------- | :--------------------- | :--------------------------- | :-------------------------------------------------------------------------------- |
| `awaiting`                          | **Awaiting**           | No                           | Untriaged suggestion.                                                             |
| `inforequest`                       | **Info request**       | No                           | Need clarification from the author.                                               |
| `acknowledged`                      | **Acknowledged**       | **No**                       | Good idea we intend to build (stays open until shipped).                          |
| `deploysuggestion`                  | **Waiting for deploy** | **No**                       | Implemented, awaiting production deploy.                                          |
| `implemented`                       | **Implemented**        | **Yes**                      | Live in production.                                                               |
| `rejected`                          | **Rejected**           | **Yes**                      | Out of scope / would clutter options or violate standard rules; decline politely. |
| `duplicate`                         | **Duplicate**          | **Yes**                      | Duplicate of an existing suggestion/ticket.                                       |

### `dashwood314` Reply Guidelines

- Keep replies concise (`1–3` sentences), polite, and concrete:
  - When queueing a fix: _"Thanks for the report. Fix is in the works!"_
  - When live in production: _"Fixed in release <YYMMDD-HHMM> (now live). Refreshing the page (F5) will <effect> — thanks again for the report!"_
  - When fixed in the Nov 2026 rewrite or un-reproducible clock expulsion: note that major client/timeout fixes landed in mid-November 2026, and clarify when relevant that game developers cannot remove or refund BGA clock/karma (`☯`) or ELO penalties.

---

## 5. Deep Reproduction, 7-Surface SQL Dump Remapping & Fix Verification (Dedicated Fix Sessions)

When moving from triage into an actual fix session:

1. **Gather Context from the Report**:
   - Record the bug ID, table ID, move number, active state (`states.inc.php`), player perspectives, and relevant `gamelog` notifications or browser console errors.
2. **Choose the Fastest Reproduction Tier**:
   - **Pure card/combo/hand/wish bug**: Write a failing test in [`tests/ComboTest.php`](file:///Users/brohlfs/git/tichu/tests/ComboTest.php) or [`tests/HandTest.php`](file:///Users/brohlfs/git/tichu/tests/HandTest.php) and run `npm run test:unit`.
   - **State machine / scoring / autopass / locking bug**: Add a scenario or regression test in [`local/scenarios.php`](file:///Users/brohlfs/git/tichu/local/scenarios.php) / [`local/integration-tests.php`](file:///Users/brohlfs/git/tichu/local/integration-tests.php) (run `npm test`) or [`local/race-tests.php`](file:///Users/brohlfs/git/tichu/local/race-tests.php) (run `npm run test:race`).
   - **Production dump on BGA Studio or local SQL (`bug_<id>.sql`)**:
     - On BGA Studio, `/bug?id=<ID>` provides a `"Load on the Studio"` button (`loadBugReportDump.html`) when a dump exists.
     - For a local MySQL 8.0 (`ebd_tichu_1`) dump file (`bug_<id>.sql`), import and inspect state/cards/logs using [`LocalBugSqlLoader`](file:///Users/brohlfs/git/tichu/local/import-bug-sql.php):
       ```bash
       npm run bug:import -- path/to/bug_<id>.sql [--state=75] [--inspect]
       npm run bug:inspect
       ```
       Then start `npm run local` and inspect `http://127.0.0.1:8080`.
     > [!CAUTION]
     > **ABSOLUTE NO-GO**: Keep all bug SQL loading, `file_get_contents()`, `$bgaContainer`, `\Bga\GameFramework\Old\Db`, and `bga_*` table queries strictly inside `local/` ([`local/import-bug-sql.php`](file:///Users/brohlfs/git/tichu/local/import-bug-sql.php)) — **NEVER** put them in `modules/` or upload them to BGA Studio or production. BGA's security alerts scan deployed files and will immediately revoke SFTP and project access.
   - **Live browser & production log inspection**:
     - Client console: BGA attaches the tail of the browser JS console to bug reports. [`src/tichu.ts`](file:///Users/brohlfs/git/tichu/src/tichu.ts) logs `[tichu]` state/action/notif breadcrumbs (last 50 in `window.__tichuBreadcrumbs`), warns on hand-count mismatches or deploy version mismatches (`checkVersion`), and exposes `window.tichuDebugSnapshot()` for one-command inspection of state, hand, trick, prefs, and breadcrumbs.
     - Server production logs: [`tichu.game.php`](file:///Users/brohlfs/git/tichu/tichu.game.php) emits structured `$this->logProdWarn(...)` (`game_err_tichu.log`) on lock/stale-state rejections, card-count mismatches, missing logs, and zombie fallbacks, and records `grandTichuBet`, `giveCards`, `acceptCards`, `mahjongWish`, `chooseDragonGift`, and `zombieTurn` in `actionlog` alongside tricks/combos/bets.
3. **Remapping Production SQL Dumps Safely (7 `player_id` Surfaces)**:
   - Production dumps use live BGA `player_id`s and often end in state `99` (`ST_GAME_END`).
   - **Never** do a naive 1-pass `player_id` replacement (breaks if old/target IDs overlap or seats swap). [`LocalBugSqlLoader::loadBugReportSQL()`](file:///Users/brohlfs/git/tichu/local/import-bug-sql.php) performs **two-phase offset remapping** (`oldId -> maxId + 1000 + idx -> targetId`, e.g., local `dashwood0`..`dashwood3` = `2385074`..`2385077`) across **all 7 Tichu `player_id` surfaces**:
     1. `player.player_id` (ordered by `player_no ASC, player_id ASC`) + `playermultiactive`, `replaysavepoint`, `bga_user_preferences`
     2. `global.global_value` (`global_id IN (2, 5, 21, 22, 27, 302, 304)` — active/admin player, `firstOutPlayer`, `secondOutPlayer`, `mahjongOwner`, neutralized/undo player)
     3. `card.card_location_arg` (when `card_location` IN `'hand'`, `'temporary'`, `'captured'`) **and** `card.card_passed_from`
     4. `actionlog.log_player` **and** embedded JSON keys inside `actionlog.log_arg` (`changePlayer.active`, `confirm.nextPlayer`)
     5. `gamelog.gamelog_player`, `gamelog.gamelog_current_player`, and `gamelog.gamelog_notification` JSON (`player_id`, `player_id2`, `player_id3`, `firstout_id`, `active_player`, `passed_from`, `newScores`, `_private`, `multiactive`, `_notified_privately`, `reflexion`, etc. — decoded via JSON rather than blind `str_replace`)
     6. `stats.stats_player_id`
     7. `player.player_is_multiactive`
   - If `global_id = 1` is `99` (`ST_GAME_END`), it is automatically reset to `75` (`ST_CONFIRM_TRICK`) (or pass `--state=<id>` to override, e.g. `--state=60` for `ST_PLAY_COMBO`) so the BGA client UI renders the table instead of the end-of-game podium.
4. **Verify Before Closing**:
   - Confirm the regression test fails before the fix and passes after.
   - Run `npm run build` (`npm test` + TypeScript compile + `esbuild` bundle), `npm run test:contracts`, and `npm run phpstan` (+ `npm run test:race` if actions, state transitions, or locks changed).
   - If verifying on BGA Studio, follow [bga-studio-testing](../bga-studio-testing/SKILL.md).
