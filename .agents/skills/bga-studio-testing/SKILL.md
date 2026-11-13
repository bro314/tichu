---
name: bga-studio-testing
description: >-
  Sync files to BGA Studio via SFTP and run automated 4-player tests on studio.boardgamearena.com
  or the local BGA runner (http://127.0.0.1:8080) using window.tt, #studio-test-bar, and pure
  Playwright iframe locators. Use whenever deploying to Studio, invoking the browser subagent on
  BGA Studio or localhost, debugging Studio tables, or inspecting SFTP/Studio credentials.
---

# BGA Studio Testing, SFTP Sync & Local Runner Playbook

This skill provides exact credentials locations, test accounts, SFTP sync commands, DOM/iframe locators, `#studio-test-bar` (`window.tt`), the local BGA runner (`npm run local`), and anti-patterns to avoid so agents can Express-start, test, and Express-stop games on **BGA Studio** (`https://studio.boardgamearena.com`) in **~6 seconds**.

---

## 1. Credentials & Test Accounts

All SFTP and BGA Studio web credentials are stored locally in `.vscode/bga-credentials.json` (and `.vscode/sftp.json`), which are gitignored under `.vscode` (**never** commit credentials to git).

- **SFTP Server**:
  - Host: `1.studio.boardgamearena.com`, Port: `2022`, Protocol: `sftp`, Remote Path: `/tichu/`
  - Username and password: Read from `.vscode/bga-credentials.json` (`.sftp.username` / `.sftp.password`)
- **BGA Studio Web Accounts (`https://studio.boardgamearena.com`)**:
  - Password for all `dashwood0`..`dashwood9` accounts: Read from `.vscode/bga-credentials.json` (`.studioWeb.password`).

| Username                 | BGA Studio Player ID | Role                                                 |
| :----------------------- | :------------------- | :--------------------------------------------------- |
| **`dashwood0`**          | `2385074`            | Main developer account (Admin on `tichu`) + Player 1 |
| **`dashwood1`**          | `2385075`            | Test Player 2                                        |
| **`dashwood2`**          | `2385076`            | Test Player 3                                        |
| **`dashwood3`**          | `2385077`            | Test Player 4                                        |
| `dashwood4`..`dashwood9` | —                    | Additional test accounts                             |

> **Important**: You only ever need to log in as **`dashwood0`**. BGA Studio allows `dashwood0` to view and act as any test player on the table via `&as=<player_id>`, and the Studio test runner (`window.tt` / `#studio-test-bar` in [`src/studio-test.ts`](file:///Users/brohlfs/git/tichu/src/studio-test.ts)) executes actions across all 4 seats automatically from a single browser tab without switching URLs!

---

## 2. Direct CLI SFTP Synchronization (`npm run deploy:sftp`)

The user does **not** use the VS Code SFTP extension; all SFTP syncing is handled by the agent using [`local/sftp-sync.sh`](file:///Users/brohlfs/git/tichu/local/sftp-sync.sh) with `WaitMsBeforeAsync: 10000` (completes in ~3 seconds). **Never** improvise inline `expect` regex scripts or Python `paramiko` one-liners that can hang or background-timeout.

- **Important**: Always run `npm run build` before uploading if any `.ts` or `.php` file was modified, so tests pass and `tichu.js` is freshly bundled.
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
  `local/sftp-sync.sh` automatically filters out non-deployable paths. Never upload `.agents`, `.vscode`, `.git`, `.gitignore`, `.gitattributes`, `.prettierrc`, `.prettierignore`, `AGENTS.md`, `README.md`, `bga-platform`, `docs`, `plans`, `local`, `tests`, `node_modules`, `dist`, `src`, `vendor`, `_ide_helper.php`, `bga-framework.d.ts`, `phpstan.neon`, or `version.php`.

---

## 3. CRITICAL Rules for the `browser` Subagent

1. **NEVER pass `page.evaluate(...)` or `waitForFunction(...)` to the `browser` subagent**:
   - The `browser` subagent's system prompt forbids `page.evaluate` and `waitForFunction`. If you include them in a prompt, the subagent will spend **60–100 seconds of LLM thinking time per step** rewriting your script!
   - Instead, use **pure Playwright locators** (`page.goto`, `page.getByText`, `page.locator`, `page.frameLocator('iframe')`) to click the `#studio-test-bar` buttons (`#tt_btn_smoke`, `#tt_btn_round`, `#tt_btn_game`, `#tt_btn_stop`, `#tt_btn_new`) and read `#tt_test_output`.
2. **Self-Contained Prompts Only (Never Ask the Browser Subagent to `read_file` Workspace Files)**:
   - The `browser` subagent runs in an isolated sandbox and cannot read files from `/Users/brohlfs/git/tichu/`. Always paste the exact Playwright snippet directly in your prompt.
3. **Zero Screenshots (`captureScreenshot: false`)**:
   - Never rely on screenshots to inspect BGA Studio pages or game state. Read `#tt_test_output`, `#logs`, `.stockitem`, or DOM attributes directly in milliseconds.
4. **`/tableview` and `/tablereplay` Use an `iframe`**:
   - The entire BGA game UI (`#studio-test-bar`, `#tt_btn_smoke`, `#tt_test_output`, `#noBet`, `#passCards_button`, `#myhand`, `#myPlayCombo`, `#myPass`) lives inside the child `iframe` (`/1/tichu/tichu/...`)!
   - Always use `const frame = page.frameLocator('iframe');` for locators inside the game.
5. **Always Do an "Express stop / CANCEL" Check at Both Beginning and End**:
   - At the **beginning** on `https://studio.boardgamearena.com/gamepanel?game=tichu`:
     - If an unstarted lobby table was left open, BGA Studio hides the **Express start** button and shows a **CANCEL** button instead. Click `CANCEL` first so **Express start** appears!
     - If a running table was left open, click **Express stop** first.
   - At the **end** of the test:
     - Navigate to `https://studio.boardgamearena.com/table?table=<TABLE_ID>` and click BGA Studio's built-in **`Express stop`** button (or click `#tt_btn_stop` in `#studio-test-bar`) so no Studio table is ever left dangling!
6. **Mandatory Post-Invocation Profiling & Continuous BGA DOM Learning**:
   - After every `browser` subagent invocation (or if a run takes >20s), check `manage_subagents` (`Action: "list"`) to ensure no subagent is left running in a background retry loop (kill immediately if stuck), and inspect `<appDataDir>/brain/<subagent-id>/.system_generated/logs/transcript.jsonl` to check step count and per-step latency.
   - If the subagent took more than 1–2 `webview_browser` calls, had to take a screenshot, or hit an unexpected BGA page state (e.g., modal popup, missing button, URL redirect), diagnose the exact DOM structure/selector or BGA client code responsible (via the `research` subagent on `bga-platform/` if needed) and add the deterministic locator/URL shortcut to this skill and [`src/studio-test.ts`](file:///Users/brohlfs/git/tichu/src/studio-test.ts) so future runs execute in a single zero-screenshot step.

---

## 4. Copy-Paste 1-Step End-to-End Studio Verification (~6.5 Seconds Total)

Delegate this single `webview_browser` script to the `browser` subagent (`Model: "flash"`). It performs the beginning cleanup check, clicks BGA Studio's built-in **Express start**, runs the full 4-player Smoke Test (`#tt_btn_smoke`: Grand Tichu bets -> Pass 3 cards -> Accept cards -> Play 2 tricks + UI/DOM assertions in ~1.8s), and clicks BGA Studio's built-in **Express stop** at the end:

```javascript
const t0 = Date.now();
await page.goto("https://studio.boardgamearena.com/gamepanel?game=tichu", {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(1500);

// 1. Beginning check: If an unstarted table is open on gamepanel, click its built-in "CANCEL" button first.
const cancelBtn = page.getByText("CANCEL", { exact: true });
if ((await cancelBtn.count()) > 0 && (await cancelBtn.first().isVisible())) {
  await cancelBtn.first().click();
  await page.waitForTimeout(1000);
}
// If a running table redirected gamepanel to ?game=tichu&table=<ID>, navigate to /table?table=<ID> and Express stop it:
const existingTableId = new URL(page.url()).searchParams.get("table");
if (existingTableId) {
  await page.goto(`https://studio.boardgamearena.com/table?table=${existingTableId}`, {
    waitUntil: "domcontentloaded",
  });
  const stopExisting = page.getByText("Express stop").first();
  if ((await stopExisting.count()) > 0) {
    await stopExisting.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await stopExisting.isVisible()) {
      await stopExisting.click();
      await page.waitForTimeout(1500);
    }
  }
  await page.goto("https://studio.boardgamearena.com/gamepanel?game=tichu", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1000);
}

// 2. Click BGA Studio's built-in "Express start" button
const expressStartBtn = page.getByText("Express start").first();
await expressStartBtn.waitFor({ state: "visible", timeout: 10000 });
await expressStartBtn.click();

// Wait for redirect to /tableview?table=<ID> and allow the game iframe origin to commit
await page.waitForURL(/tableview\?table=/, { timeout: 20000 });
const tableId = new URL(page.url()).searchParams.get("table");
await page.waitForTimeout(2000);

// 3. Run the fast smoke test inside the game iframe (~1.8s)
const frame = page.frameLocator("iframe");
for (let i = 0; i < 5; i++) {
  try {
    await frame.locator("#tt_btn_smoke").waitFor({ state: "visible", timeout: 15000 });
    break;
  } catch (e) {
    if (i === 4) throw e;
    await page.waitForTimeout(1000);
  }
}
await frame.locator("#tt_btn_smoke").click();
await frame
  .locator('#tt_test_output[data-done="1"][data-status="pass"]')
  .waitFor({ state: "attached", timeout: 20000 });
const smokeResult = await frame.locator("#tt_test_output").innerText();

// 4. End check: Go to BGA Studio's table page and click the built-in "Express stop" button
await page.goto(`https://studio.boardgamearena.com/table?table=${tableId}`, {
  waitUntil: "domcontentloaded",
});
const expressStopBtn = page.getByText("Express stop").first();
await expressStopBtn.waitFor({ state: "visible", timeout: 10000 });
await expressStopBtn.click();
await page.waitForTimeout(1000);

return {
  tableId,
  totalMs: Date.now() - t0,
  smokeResult: JSON.parse(smokeResult),
  expressStoppedAtEnd: true,
};
```

---

## 5. Studio Test Bar (`#studio-test-bar`) & `window.tt` (`src/studio-test.ts`)

When loaded on `studio.boardgamearena.com` (never on `boardgamearena.com` production — double-guarded on client hostname and `$this->getBgaEnvironment() === 'studio'` on server), [`src/studio-test.ts`](file:///Users/brohlfs/git/tichu/src/studio-test.ts) mounts `#studio-test-bar` at the top of `#game_play_area_wrap` and exposes `window.tt` (`window.tichuTest`):

| Button ID          | Label                  | `window.tt` Method                     | Typical Duration | Description                                                                                                                                                |
| :----------------- | :--------------------- | :------------------------------------- | :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#tt_btn_smoke`    | `🧪 Smoke Test`        | `await tt.runSmokeTest()`              | **~1.8s**        | Batch-executes Grand Tichu bets (all 4 players), passes 3 cards (all 4 players), accepts cards, plays 2 tricks, and runs `tt.assertUI()` after each phase. |
| `#tt_btn_round`    | `🏁 Run Round`         | `await tt.runRound({ maxMoves: 250 })` | **~8.3s**        | Plays a complete round from deal to scoring using server-side batched bot turns (`debug_bgaPlayMoves`).                                                    |
| `#tt_btn_game`     | `🏆 Run Game`          | `await tt.runGame({ maxRounds: 15 })`  | **~60–90s**      | Plays a complete multi-round game to 1000 points (`gameEnd`).                                                                                              |
| `#tt_btn_gt_all`   | `⚡ GT Bet All 4`      | `await tt.grandTichuAll()`             | ~0.4s            | Submits Grand Tichu `"no bet"` for all 4 seats in one server call (`debug_bgaGrandTichuAll`).                                                              |
| `#tt_btn_pass_all` | `🃏 Pass 3 + Bots`     | `await tt.giveCardsAll()`              | ~0.5s            | Passes 3 lowest cards for all 4 seats in one server call (`debug_bgaGiveCardsAll`).                                                                        |
| `#tt_btn_step1`    | `🤖 Step 1`            | `await tt.stepBot()`                   | ~0.3s            | Executes 1 rule-compliant bot move on the server (`debug_bgaStepBot`).                                                                                     |
| `#tt_btn_others`   | `🤖 Act for Others`    | `await tt.actForOthers()`              | ~0.5s            | Advances bots until it is the viewing player's turn (`debug_bgaActForOthers`).                                                                             |
| `#tt_btn_assert`   | `✔ Assert UI`          | `await tt.assertUI()`                  | ~0.2s            | Verifies client `gamedatas`, hand Stock counts, table combo Stock, and Mahjong wish badge against server state (`debug_bgaState`).                         |
| `#tt_btn_new`      | `🔄 New Express Table` | `await tt.expressStartNew()`           | ~1.2s            | Express-stops the current table, creates a new table, and Express-starts it.                                                                               |
| `#tt_btn_stop`     | `⏹ Express Stop`       | `await tt.expressStop()`               | ~0.4s            | Express-stops the current table (or quits/cancels if unstarted).                                                                                           |

You can also run arbitrary commands via `#tt_cmd_input` + `#tt_cmd_run` (e.g., `status`, `assertUI`, `wish:8`, `dragon:2385075`, `pass`, `play:[12,15]`) and read the JSON result from `#tt_test_output` (`data-done="1"`, `data-status="pass" | "fail"`).

---

## 6. Studio Debugging Helpers, Refresh Rules & Gotchas

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

---

## 7. Local Testing & Local BGA Runner (`tests/` & `local/`)

Tichu has three fast local testing tiers that run without needing a BGA Studio connection (plus the opt-in race stress test documented in [tichu-concurrency-locks](../tichu-concurrency-locks/SKILL.md)):

1. **Unit Tests (`npm run test:unit` / `./vendor/bin/phpunit tests`, ~15ms)**:
   - Tests pure card/combo/hand logic in [`modules/Combo.php`](file:///Users/brohlfs/git/tichu/modules/Combo.php) and [`modules/Hand.php`](file:///Users/brohlfs/git/tichu/modules/Hand.php) using [`tests/stubs.php`](file:///Users/brohlfs/git/tichu/tests/stubs.php) and [`tests/TestUtils.php`](file:///Users/brohlfs/git/tichu/tests/TestUtils.php).
   - Add corresponding test cases in [`tests/ComboTest.php`](file:///Users/brohlfs/git/tichu/tests/ComboTest.php) or [`tests/HandTest.php`](file:///Users/brohlfs/git/tichu/tests/HandTest.php) when editing combo/hand logic.

2. **Backend Integration Tests (`npm run test:integration` / `php local/integration-tests.php`, ~2.7s)**:
   - Runs 14 full-stack PHP + MySQL 8.0 InnoDB (`ebd_tichu_1` via [`local/mysql-ctl.sh`](file:///Users/brohlfs/git/tichu/local/mysql-ctl.sh)) test suites directly against the real `local/Bga/GameFramework/` classes (`Table`, `GamestateMachine`, `Deck`, `Old\Db`, `Stats`, `Notify`, `Logs`) and `Tichu`, `CardManager`, `LogManager`, `PlayerManager`, `LocalTichuBot`, and `LocalTichuScenarios`:
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
