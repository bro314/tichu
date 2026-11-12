# BGA_STUDIO_TESTING.md — Fast Playbook for BGA Studio & 4-Player Testing

This document provides exact URLs, DOM/iframe selectors, the built-in `#studio-test-bar` (`window.tt`), and anti-patterns to avoid so that AI agents can Express-start, test, and Express-stop games on **BGA Studio** (`https://studio.boardgamearena.com`) in **~6 seconds**.

---

## 1. Test Accounts & Player IDs

All 10 test accounts on `https://studio.boardgamearena.com` share the password stored in `.vscode/bga-credentials.json` (`.studioWeb.password`):

| Username | BGA Studio Player ID | Role |
| :--- | :--- | :--- |
| **`dashwood0`** | `2385074` | Main developer account (Admin on `tichu`) + Player 1 |
| **`dashwood1`** | `2385075` | Test Player 2 |
| **`dashwood2`** | `2385076` | Test Player 3 |
| **`dashwood3`** | `2385077` | Test Player 4 |
| `dashwood4`..`dashwood9` | — | Additional test accounts |

> **Important**: You only ever need to log in as **`dashwood0`**. BGA Studio allows `dashwood0` to view and act as any test player on the table via `&as=<player_id>`, and the Studio test runner (`window.tt` / `#studio-test-bar` in `src/studio-test.ts`) executes actions across all 4 seats automatically from a single browser tab without switching URLs!

---

## 2. CRITICAL Rules for the `browser` Subagent

1. **NEVER pass `page.evaluate(...)` or `waitForFunction(...)` to the `browser` subagent**:
   - The `browser` subagent's system prompt forbids `page.evaluate` and `waitForFunction`. If you include them in a prompt, the subagent will spend **60–100 seconds of LLM thinking time per step** rewriting your script!
   - Instead, use **pure Playwright locators** (`page.goto`, `page.getByText`, `page.locator`, `page.frameLocator('iframe')`) to click the `#studio-test-bar` buttons (`#tt_btn_smoke`, `#tt_btn_round`, `#tt_btn_game`, `#tt_btn_stop`, `#tt_btn_new`) and read `#tt_test_output`.
2. **`/tableview` and `/tablereplay` Use an `iframe`**:
   - The entire BGA game UI (`#studio-test-bar`, `#tt_btn_smoke`, `#tt_test_output`, `#noBet`, `#passCards_button`, `#myhand`, `#myPlayCombo`, `#myPass`) lives inside the child `iframe` (`/1/tichu/tichu/...`)!
   - Always use `const frame = page.frameLocator('iframe');` for locators inside the game.
3. **Always Do an "Express stop / CANCEL" Check at Both Beginning and End**:
   - At the **beginning** on `https://studio.boardgamearena.com/gamepanel?game=tichu`:
     - If an unstarted lobby table was left open, BGA Studio hides the **Express start** button and shows a **CANCEL** button instead. Click `CANCEL` first so **Express start** appears!
     - If a running table was left open, click **Express stop** first.
   - At the **end** of the test:
     - Navigate to `https://studio.boardgamearena.com/table?table=<TABLE_ID>` and click BGA Studio's built-in **`Express stop`** button (or click `#tt_btn_stop` in `#studio-test-bar`) so no Studio table is ever left dangling!

---

## 3. Copy-Paste 1-Step End-to-End Studio Verification (~6.5 Seconds Total)

Delegate this single `webview_browser` script to the `browser` subagent (`Model: "flash"`). It performs the beginning cleanup check, clicks BGA Studio's built-in **Express start**, runs the full 4-player Smoke Test (`#tt_btn_smoke`: Grand Tichu bets -> Pass 3 cards -> Accept cards -> Play 2 tricks + UI/DOM assertions in ~1.8s), and clicks BGA Studio's built-in **Express stop** at the end:

```javascript
const t0 = Date.now();
await page.goto('https://studio.boardgamearena.com/gamepanel?game=tichu', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

// 1. Beginning check: If an unstarted table is open on gamepanel, click its built-in "CANCEL" button first.
const cancelBtn = page.getByText('CANCEL', { exact: true });
if ((await cancelBtn.count()) > 0 && (await cancelBtn.first().isVisible())) {
  await cancelBtn.first().click();
  await page.waitForTimeout(1000);
}
// Or if a running table shows "Express stop" on gamepanel, click it:
const stopBtn0 = page.getByText('Express stop');
if ((await stopBtn0.count()) > 0 && (await stopBtn0.first().isVisible())) {
  await stopBtn0.first().click();
  await page.waitForTimeout(1000);
}

// 2. Click BGA Studio's built-in "Express start" button
const expressStartBtn = page.getByText('Express start').first();
await expressStartBtn.waitFor({ state: 'visible', timeout: 10000 });
await expressStartBtn.click();

// Wait for redirect to /tableview?table=<ID>
await page.waitForURL(/tableview\?table=/, { timeout: 20000 });
const tableId = new URL(page.url()).searchParams.get('table');

// 3. Run the fast smoke test inside the game iframe (~1.8s)
const frame = page.frameLocator('iframe');
await frame.locator('#tt_btn_smoke').waitFor({ state: 'visible', timeout: 15000 });
await frame.locator('#tt_btn_smoke').click();
await frame.locator('#tt_test_output[data-done="1"][data-status="pass"]').waitFor({ state: 'attached', timeout: 20000 });
const smokeResult = await frame.locator('#tt_test_output').innerText();

// 4. End check: Go to BGA Studio's table page and click the built-in "Express stop" button
await page.goto(`https://studio.boardgamearena.com/table?table=${tableId}`, { waitUntil: 'domcontentloaded' });
const expressStopBtn = page.getByText('Express stop').first();
await expressStopBtn.waitFor({ state: 'visible', timeout: 10000 });
await expressStopBtn.click();
await page.waitForTimeout(1000);

return {
  tableId,
  totalMs: Date.now() - t0,
  smokeResult: JSON.parse(smokeResult),
  expressStoppedAtEnd: true
};
```

---

## 4. Studio Test Bar (`#studio-test-bar`) & `window.tt` Reference (`src/studio-test.ts`)

When loaded on `studio.boardgamearena.com` (never on `boardgamearena.com` production), [`src/studio-test.ts`](file:///Users/brohlfs/git/tichu/src/studio-test.ts) mounts `#studio-test-bar` at the top of `#game_play_area_wrap` and exposes `window.tt` (`window.tichuTest`):

| Button ID | Label | `window.tt` Method | Typical Duration | Description |
| :--- | :--- | :--- | :--- | :--- |
| `#tt_btn_smoke` | `🧪 Smoke Test` | `await tt.runSmokeTest()` | **~1.8s** | Batch-executes Grand Tichu bets (all 4 players), passes 3 cards (all 4 players), accepts cards, plays 2 tricks, and runs `tt.assertUI()` after each phase. |
| `#tt_btn_round` | `🏁 Run Round` | `await tt.runRound({ maxMoves: 250 })` | **~8.3s** | Plays a complete round from deal to scoring using server-side batched bot turns (`debug_bgaPlayMoves`). |
| `#tt_btn_game` | `🏆 Run Game` | `await tt.runGame({ maxRounds: 15 })` | **~60–90s** | Plays a complete multi-round game to 1000 points (`gameEnd`). |
| `#tt_btn_gt_all` | `⚡ GT Bet All 4` | `await tt.grandTichuAll()` | ~0.4s | Submits Grand Tichu `"no bet"` for all 4 seats in one server call (`debug_bgaGrandTichuAll`). |
| `#tt_btn_pass_all` | `🃏 Pass 3 + Bots` | `await tt.giveCardsAll()` | ~0.5s | Passes 3 lowest cards for all 4 seats in one server call (`debug_bgaGiveCardsAll`). |
| `#tt_btn_step1` | `🤖 Step 1` | `await tt.stepBot()` | ~0.3s | Executes 1 rule-compliant bot move on the server (`debug_bgaStepBot`). |
| `#tt_btn_others` | `🤖 Act for Others` | `await tt.actForOthers()` | ~0.5s | Advances bots until it is the viewing player's turn (`debug_bgaActForOthers`). |
| `#tt_btn_assert` | `✔ Assert UI` | `await tt.assertUI()` | ~0.2s | Verifies client `gamedatas`, hand Stock counts, table combo Stock, and Mahjong wish badge against server state (`debug_bgaState`). |
| `#tt_btn_new` | `🔄 New Express Table` | `await tt.expressStartNew()` | ~1.2s | Express-stops the current table, creates a new table, and Express-starts it. |
| `#tt_btn_stop` | `⏹ Express Stop` | `await tt.expressStop()` | ~0.4s | Express-stops the current table (or quits/cancels if unstarted). |

You can also run arbitrary commands via `#tt_cmd_input` + `#tt_cmd_run` (e.g., `status`, `assertUI`, `wish:8`, `dragon:2385075`, `pass`, `play:[12,15]`) and read the JSON result from `#tt_test_output` (`data-done="1"`, `data-status="pass" | "fail"`).
