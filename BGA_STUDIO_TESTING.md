# BGA_STUDIO_TESTING.md — Fast Playbook for BGA Studio & 4-Player Testing

This document provides exact URLs, DOM selectors, JavaScript (`gameui`) shortcuts, and anti-patterns to avoid so that AI agents can start, switch players, and play test games on **BGA Studio** (`https://studio.boardgamearena.com`) in **seconds** rather than minutes.

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

> **Important**: You only ever need to log in as **`dashwood0`**. BGA Studio allows `dashwood0` to view and act as any test player on the table via the `&as=<player_id>` URL parameter. You do **not** need multiple cookie jars or separate logins.

---

## 2. Fast Login (1 Step)

If redirected to `/account?warn&redirect=...`:
1. Dismiss cookie banner if visible (`Allow all cookies` or `Reject all`).
2. Fill username `dashwood0` (`getByPlaceholder('Email or username')`), click `Next`.
3. Wait for password input (`getByPlaceholder('Password')`), fill the password from `.vscode/bga-credentials.json`, click `Login`, and click `Let's play!` if shown.

---

## 3. Starting a 4-Player Test Game Instantly ("Express Start")

### DO NOT:
- **Do NOT** go to `/lobby`, click "Create", and then click "Express start" inside an already-open lobby table — this frequently triggers a BGA Studio bug (`Duplicate entry '1' for key 'player.PRIMARY'`) because `dashwood0` is already seated at the table when Express Start tries to insert all 4 test players.
- **Do NOT** manually invite `dashwood1`..`dashwood3` via the invite box.

### DO THIS INSTEAD (1 Step):
1. Navigate directly to the Tichu game panel:
   ```text
   https://studio.boardgamearena.com/gamepanel?game=tichu
   ```
   *(or `https://studio.boardgamearena.com/gamepanel?id=1386`)*
2. Click the **`Express start`** button (`page.getByText('Express start').click()`).
3. Wait for navigation to `https://studio.boardgamearena.com/table?table=<TABLE_ID>` (or `/tableview?table=<TABLE_ID>&as=2385074`).
   - If you ever hit `Duplicate entry '1' for key 'player.PRIMARY'` on an old table, click **`Quit game`** (`Abandon`) immediately and click **`Express start`** from `/gamepanel?game=tichu`.

---

## 4. Switching Between the 4 Players Instantly

Once you have a running `<TABLE_ID>` (e.g., `1006710`), there are two ways to switch between `dashwood0` (`2385074`), `dashwood1` (`2385075`), `dashwood2` (`2385076`), and `dashwood3` (`2385077`):

### Method A: Direct URL Navigation (Fastest & Most Reliable in a Single Tab)
Instead of hunting for the small red `➔` arrow in the player panels (which opens popups/new tabs and requires tab management), simply navigate the current tab directly:
```javascript
await page.goto(`https://studio.boardgamearena.com/tableview?table=${tableId}&as=${playerId}`, {
  waitUntil: 'domcontentloaded'
});
await page.waitForFunction(() => Boolean(window.gameui && window.gameui.gamedatas && window.gameui.playerHand));
```
- `dashwood0`: `https://studio.boardgamearena.com/tableview?table=${tableId}&as=2385074`
- `dashwood1`: `https://studio.boardgamearena.com/tableview?table=${tableId}&as=2385075`
- `dashwood2`: `https://studio.boardgamearena.com/tableview?table=${tableId}&as=2385076`
- `dashwood3`: `https://studio.boardgamearena.com/tableview?table=${tableId}&as=2385077`

### Method B: Keep 4 Tabs Open (Zero Reload Switching)
If you will be playing many turns back and forth, open 4 pages in the browser context once:
- `pages[0]` -> `/tableview?table=${tableId}&as=2385074` (`dashwood0`)
- `pages[1]` -> `/tableview?table=${tableId}&as=2385075` (`dashwood1`)
- `pages[2]` -> `/tableview?table=${tableId}&as=2385076` (`dashwood2`)
- `pages[3]` -> `/tableview?table=${tableId}&as=2385077` (`dashwood3`)
All 4 tabs receive live WebSocket notifications simultaneously! You can execute actions on whichever tab corresponds to `window.gameui.gamedatas.gamestate.active_player` without any page reloads.

---

## 5. Fast Gameplay Actions & Avoiding UI Traps

### Trap 1: Overlapping Cards in `#myhand` (`ebg/stock`)
Cards in `#myhand` overlap horizontally (`stock.setOverlap(...)`).
- **Problem**: Using Playwright coordinate clicks (`locator('.stockitem').nth(i).click()`) often fails with `ELEMENT_OCCLUDED` or clicks the wrong neighboring card that overlaps on top of it!
- **Problem 2**: User preference `102` ("Safeguard against passing when cards are selected") is ON by default. If you accidentally select a card and then try to click `#myPass`, Tichu shows an error: *"You have to unselect your cards first."*

### Solution: Inspect & Select Cards via `window.gameui` or Exact DOM IDs
Inside the `/tableview` page, `window.gameui` is the live `Tichu` instance (`src/tichu.ts`)!
You can inspect the current state, hand, and select/unselect cards cleanly inside `webview_browser` scripts:

1. **Inspect Game State & Hand in One Call**:
   ```javascript
   const state = await page.evaluate(() => {
     const ui = window.gameui;
     return {
       playerId: ui.player_id,
       stateName: ui.gamedatas.gamestate.name,
       activePlayer: ui.gamedatas.gamestate.active_player,
       multiactive: ui.gamedatas.gamestate.multiactive,
       mahjongOwner: ui.gamedatas.mahjongOwner,
       hand: ui.gamedatas.hand.map(c => ({
         id: c.id,
         color: Number(c.type),       // 1..4 (or for type_arg=1: 1=Dragon, 2=Phoenix, 3=Dog, 4=Mahjong)
         rank: Number(c.type_arg),    // 2..14 (or 1 for specials)
         domId: `myhand_item_${c.id}`
       }))
     };
   });
   ```

2. **Phase 1: Grand Tichu Bets (`stateName === "grandTichuBets"`)**:
   - **No bet**: Click `#noBet` (`await page.locator('#noBet').click()`).
   - **Call Grand Tichu**: Click `#makeGTBet` (`await page.locator('#makeGTBet').click()`).

3. **Phase 2: Passing 3 Cards (`stateName === "giveCards"`)**:
   - **UI Flow**: For `slotIndex` in `0, 1, 2`:
     - Select 1 card in `window.gameui.playerHand`, call `window.gameui.onGiveCard(slotIndex)`, then click `#passCards_button`:
     ```javascript
     await page.evaluate(() => {
       const ui = window.gameui;
       ui.playerHand.unselectAll();
       const items = ui.playerHand.getAllItems().slice(0, 3);
       items.forEach((item, idx) => {
         ui.playerHand.unselectAll();
         ui.playerHand.selectItem(String(item.id));
         ui.onGiveCard(idx);
       });
     });
     await page.locator('#passCards_button').click();
     ```
   - This avoids 3x overlapping card click errors per player (saving 12+ browser steps across 4 players).

4. **Phase 3: Playing a Card/Combo (`stateName === "playComboOpen"` or `"playCombo"`)**:
   - Select specific card IDs cleanly via `playerHand.selectItem(cardId)` and click `#myPlayCombo`:
     ```javascript
     await page.evaluate((cardIds) => {
       const ui = window.gameui;
       ui.playerHand.unselectAll();
       for (const id of cardIds) {
         ui.playerHand.selectItem(String(id));
       }
     }, [targetCardId]);
     await page.locator('#myPlayCombo').click();
     ```
   - If playing the **Mahjong** (`type == 4 && type_arg == 1`), the state transitions to `mahjongPlay`. Select a wish value in `#mahjongpanel` (e.g., `#mahjong_item_15` for "No wish" or `#mahjong_item_2`..`#mahjong_item_14` for `2..Ace`) and click `#chooseWish`.

5. **Phase 3b: Passing on a Trick (`stateName === "playCombo"`)**:
   - Always unselect all cards first so the safeguard (`pref 102`) never blocks the pass button, then click `#myPass`:
     ```javascript
     await page.evaluate(() => window.gameui.playerHand.unselectAll());
     await page.locator('#myPass').click();
     ```

6. **Phase 4: Confirming / Collecting a Trick (`stateName === "confirmTrick"`)**:
   - In real-time mode (`bRealtime = true`), `confirmTrick` auto-collects after a `2000ms` timeout (`this.autoCollectTimeout`), or you can trigger it immediately without waiting 2 seconds:
     ```javascript
     await page.evaluate(() => window.gameui.collect());
     ```

---

## 6. Optimizing Notification & Animation Wait Times

In `src/tichu.ts`, synchronous notification durations are configured in `setupNotifications()`:
- `acceptCards`: `3000ms` (2000ms `setTimeout` + 500ms slide animation) right after all 4 players pass 3 cards.
- `confirmTrick`: `2000ms` auto-collect timer when a trick ends.
- `newScores`: `1000ms`, `captureCards`: `500ms`, `dealCards`: `500ms`, `playCombo`: `300ms`, `pass`: `300ms`.

**How to avoid wasted polling steps in the Browser Agent**:
- Instead of taking multiple screenshots while waiting for `acceptCards` (3s) or `confirmTrick` (2s), wait directly for the state transition in a single script step:
  ```javascript
  await page.waitForFunction(
    (expectedStates) => expectedStates.includes(window.gameui?.gamedatas?.gamestate?.name),
    ['playComboOpen', 'playCombo'],
    { timeout: 10000 }
  );
  ```
- Combine multi-player phases (like all 4 players clicking `#noBet` in `grandTichuBets`, or all 4 players passing 3 cards in `giveCards`) into a single loop inside one `webview_browser` script step rather than doing 15+ separate LLM turns!
