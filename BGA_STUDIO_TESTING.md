# BGA_STUDIO_TESTING.md — Fast Playbook for BGA Studio & 4-Player Testing

This document provides exact URLs, DOM/iframe selectors, JavaScript (`gameui`) shortcuts, and anti-patterns to avoid so that AI agents can start, switch players, and play test games on **BGA Studio** (`https://studio.boardgamearena.com`) in **seconds** rather than minutes.

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

> **Important**: You only ever need to log in as **`dashwood0`**. BGA Studio allows `dashwood0` to view and act as any test player on the table via `&as=<player_id>`. You do **not** need multiple cookie jars or separate logins.
>
> **Note on Express Start Clock Timeout**: Express Start creates a **real-time** table with a short clock. If a test table is left idle with no active client connected, BGA will eventually auto-abandon it (*"All players (with a positive clock) choosed to abandon this game"*, ending in a `0–0` Tie). That is a Studio clock timeout, not a game bug — just Express Start a fresh table. For server-side SQL/request logs and PHP stack traces on a table, check `https://studio.boardgamearena.com/1/tichu/tichu/logaccess.html?table=<TABLE_ID>`.

---

## 2. CRITICAL: `/tableview` and `/tablereplay` Use an `iframe`!

When you open `https://studio.boardgamearena.com/tableview?table=<TABLE_ID>&as=<PLAYER_ID>` or `https://studio.boardgamearena.com/tablereplay?...`:
- The outer page (`/tableview` or `/tablereplay`) is just a wrapper shell.
- **The entire BGA game UI (`#noBet`, `#passCards_button`, `#myhand`, `#myPlayCombo`, `#myPass`, `#expReplay`, `tichu-replay#game_play_replay`, and `window.gameui`) lives inside the child `iframe` (`/1/tichu/tichu/...` or `/archive/archive/frame.html...`)!**
- Therefore:
  - **NEVER** use `page.locator('#noBet')` on `/tableview` or `/tablereplay` — it will time out for 30 seconds!
  - **ALWAYS** use `const frame = page.frameLocator('iframe');` for Playwright locators (e.g., `frame.locator('#noBet')` or `frame.locator('#expReplay')`), **OR** `const gameFrame = page.frames().find(f => f.url().includes('/tichu') || f.url().includes('/archive/'));` when calling `gameFrame.evaluate(() => window.gameui...)`!

---

## 3. Stopping an Existing Table & Starting a New 4-Player Game ("Express Start")

### Stopping an Existing Express Start Table:
If an earlier Express Start table (`<OLD_TABLE_ID>`) is still running, BGA Studio will block starting a new one until the old one is stopped:
- **Do NOT** click regular "Quit game" / "Abandon" (that only leaves for 1 player while the other 3 test accounts keep the table alive!).
- **DO THIS**: Navigate to `https://studio.boardgamearena.com/table?table=<OLD_TABLE_ID>` and click **`Express stop`** (`page.getByText('Express stop').click()`). That terminates the table for all 4 test accounts in 1 click.

### Starting a New 4-Player Game ("Express Start"):
1. Navigate directly to:
   ```text
   https://studio.boardgamearena.com/gamepanel?game=tichu
   ```
2. If **`Express start`** is not immediately visible, click the **`Play`** button first to expand the quick-play panel.
3. Click **`Express start`** (`page.getByText('Express start').click()`).
4. Wait for navigation to `/tableview?table=<TABLE_ID>` (or `/table?table=<TABLE_ID>`) and read `tableId = new URL(page.url()).searchParams.get('table')`.

---

## 4. Complete 4-Player Game Loop (Copy-Paste Ready Scripts)

Once you have `tableId`, every phase across all 4 players can be executed in **one single `webview_browser` script per phase** using `page.frameLocator('iframe')`!

### Phase 1: Grand Tichu Bets (All 4 Players in 1 Step, ~6 seconds)
```javascript
const tableId = '<TABLE_ID>';
const pids = ['2385074', '2385075', '2385076', '2385077'];

for (const pid of pids) {
  await page.goto(`https://studio.boardgamearena.com/tableview?table=${tableId}&as=${pid}`, {
    waitUntil: 'domcontentloaded'
  });
  const frame = page.frameLocator('iframe');
  const noBet = frame.locator('#noBet');
  await noBet.waitFor({ state: 'visible', timeout: 15000 });
  await noBet.click({ force: true });
  await page.waitForTimeout(300);
}
return { grandTichuDone: true };
```

### Phase 2: Passing 3 Cards (`giveCards` — All 4 Players in 1 Step, ~10 seconds)
```javascript
const tableId = '<TABLE_ID>';
const pids = ['2385074', '2385075', '2385076', '2385077'];

for (const pid of pids) {
  await page.goto(`https://studio.boardgamearena.com/tableview?table=${tableId}&as=${pid}`, {
    waitUntil: 'domcontentloaded'
  });
  const frame = page.frameLocator('iframe');
  await frame.locator('#passCards_button').waitFor({ state: 'visible', timeout: 15000 });

  // Wait for the game iframe's window.gameui to be ready and assign 3 cards programmatically
  const gameFrame = page.frames().find(f => f.url().includes('/tichu'));
  await gameFrame.waitForFunction(() => Boolean(window.gameui && window.gameui.playerHand && window.gameui.playerHand.getAllItems().length === 14));
  await gameFrame.evaluate(() => {
    const ui = window.gameui;
    ui.playerHand.unselectAll();
    const items = ui.playerHand.getAllItems().slice(0, 3);
    items.forEach((item, idx) => {
      ui.playerHand.unselectAll();
      ui.playerHand.selectItem(String(item.id));
      ui.onGiveCard(idx);
    });
  });

  await frame.locator('#passCards_button').click({ force: true });
  await page.waitForTimeout(300);
}

// Wait ~3.5s for the acceptCards animation to complete and return the Mahjong owner (active_player)
await page.waitForTimeout(3500);
const gameFrame = page.frames().find(f => f.url().includes('/tichu'));
const state = await gameFrame.evaluate(() => ({
  stateName: window.gameui.gamedatas.gamestate.name,
  activePlayer: window.gameui.gamedatas.gamestate.active_player
}));
return state;
```

### Phase 3: Playing & Resolving a Trick (Lead + 3 Passes + Collect in 1 Step, ~10 seconds)
```javascript
const tableId = '<TABLE_ID>';
const leadPid = '<ACTIVE_PLAYER_ID>'; // Returned from Phase 2

// 1. Lead a normal single card (rank >= 2 so it doesn't trigger Mahjong wish or Dog)
await page.goto(`https://studio.boardgamearena.com/tableview?table=${tableId}&as=${leadPid}`, {
  waitUntil: 'domcontentloaded'
});
let frame = page.frameLocator('iframe');
await frame.locator('#myPlayCombo').waitFor({ state: 'visible', timeout: 15000 });
let gameFrame = page.frames().find(f => f.url().includes('/tichu'));

await gameFrame.evaluate(() => {
  const ui = window.gameui;
  ui.playerHand.unselectAll();
  const normalCard = ui.gamedatas.hand.find(c => Number(c.type_arg) >= 2);
  ui.playerHand.selectItem(String(normalCard.id));
});
await frame.locator('#myPlayCombo').click({ force: true });
await page.waitForTimeout(500);

// 2. Pass with the other 3 players in turn order
for (let i = 0; i < 3; i++) {
  gameFrame = page.frames().find(f => f.url().includes('/tichu'));
  const nextPid = await gameFrame.evaluate(() => window.gameui.gamedatas.gamestate.active_player);
  await page.goto(`https://studio.boardgamearena.com/tableview?table=${tableId}&as=${nextPid}`, {
    waitUntil: 'domcontentloaded'
  });
  frame = page.frameLocator('iframe');
  await frame.locator('#myPass').waitFor({ state: 'visible', timeout: 15000 });
  gameFrame = page.frames().find(f => f.url().includes('/tichu'));
  await gameFrame.evaluate(() => window.gameui.playerHand.unselectAll());
  await frame.locator('#myPass').click({ force: true });
  await page.waitForTimeout(500);
}

// 3. Return to leadPid and collect trick immediately (bypassing 2s auto-collect timer)
await page.goto(`https://studio.boardgamearena.com/tableview?table=${tableId}&as=${leadPid}`, {
  waitUntil: 'domcontentloaded'
});
frame = page.frameLocator('iframe');
await frame.locator('#ebd-body').waitFor({ state: 'visible', timeout: 15000 });
gameFrame = page.frames().find(f => f.url().includes('/tichu'));
await gameFrame.waitForFunction(() => Boolean(window.gameui && window.gameui.gamedatas));
await gameFrame.evaluate(() => {
  if (window.gameui.gamedatas.gamestate.name === 'confirmTrick') {
    window.gameui.collect();
  }
});
await page.waitForTimeout(500);
const finalStatus = await frame.locator('#pagemaintitletext').innerText();
return { finalStatus };
```
