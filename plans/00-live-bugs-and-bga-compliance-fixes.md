# 00 — Live Bugs & BGA Compliance Fixes

- **Priority**: P0 (Critical correctness, replay integrity, i18n, and production safety)
- **Scope**: Client (`src/tichu.ts`, `src/elements/tichu-replay.ts`, `src/elements/tichu-status.ts`, `src/elements/tichu-action-bar.ts`), Server (`tichu.game.php`, `modules/managers/NotificationManager.php`, `dbmodel.sql`)
- **Estimated Effort**: Small–Medium (6 surgical, independent fixes bundled by urgency)
- **Dependencies / Sibling Interactions**: None required first; establishes clean baseline for [01 — Static Contracts](file:///Users/brohlfs/git/tichu/plans/01-static-contracts-phpstan-and-ci.md) and [07 — Production Bug SQL Loader](file:///Users/brohlfs/git/tichu/plans/07-production-bug-sql-loader.md).

---

## 1. Why & Goal

Before adding new features or refactoring architecture, Tichu has six verified live-production or BGA-compliance defects directly observable in the codebase today:

1. **Premature selection wipe on `playCombo`**: Clicking Play clears the player's card selection _before_ the AJAX call even completes or validates; if the server throws a `UserException` (invalid combo, Mahjong wish unfulfilled, network hiccup), the player loses their carefully selected 5–10 card straight/full house.
2. **Broken Grand Tichu badge in Archive Replay**: `tichu-replay.ts` compares `args.bet === "200"` (strict string) whereas `NotificationManager::grandTichuBet` passes an integer `200`, causing Grand Tichu bets to disappear or show `NO_BET_YET` in replays.
3. **BGA Translation (`i18n`) & Notification Payload Gaps**: Hardcoded English strings in `tichu-status.ts`, leading tabs/newlines in `NotificationManager::grandTichuBet`, missing `'i18n'` metadata on translated `combo_name` / `text_value`, and passing dynamic PHP variables directly to `clienttranslate($var)` (invisible to BGA's static string extractor).
4. **Spectator / Replay / Sound Guard Gaps**: Missing `this.isReadOnly()` guards on client-side timer/control logic (`tichu-action-bar.ts` / `tichu.ts`) and unguarded `tichu_laser` audio playback ignoring BGA's user animation/sound mute setting (`bgaAnimationsActive()`).
5. **Zombie AI Bugs (`zombieTurn` / `zombiGiveCards`)**: `zombieTurn` uses PHP `shuffle()` instead of `bga_rand` and unconditionally passes in `playCombo` even when holding the Mahjong wish or a beating combo, potentially trapping or breaking trick rules.
6. **Live-Migration & `dbmodel.sql` Compliance Hazards**: `--` SQL comments in `dbmodel.sql` (BGA Studio strips newlines before executing!) and `upgradeTableDb()` lacking `DBPREFIX_` table prefixes and idempotent `try/catch` guards. (Might be fixed already by the recent mysql migration commit.)

---

## 2. Open-Source BGA References

- **Official BGA Pre-Release Checklist / `rbellec/claude-code-bga` (`guidelines.md`, `translations.md`)**: Documents `--` comment stripping in `dbmodel.sql`, literal-only `clienttranslate("...")` extraction rules, `'i18n' => [...]` array requirements, `isReadOnly()` spectator guards, and `bgaAnimationsActive()`.
- **`Odin` / `Papayoo` / `The Crew` (BGA card games)**: Clear card selection inside the notification/success path (`notif_playCombo` or AJAX `then`), never pre-emptively before `ajaxcall`.
- **Production BGA `upgradeTableDb` idiom (e.g., `bga-mars`, `bga-hearts`, `claude-code-bga`)**: Always use `DBPREFIX_<table_name>` + defensive column-existence checks / `try { self::applyDbUpgradeToAllDB(...); } catch (Exception $e) {}` in case a migration hits an already-migrated table.

---

## 3. Current State in Tichu

| Bug                               | Location                                                                                                      | Exact Defect Observed                                                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Selection wipe                    | `src/tichu.ts:852-862`                                                                                        | `this.playerHand.unselectAll();` executes before `this.takeAction(actionName, { cards: cardIds })`.                                                                                                          |
| Replay Grand Tichu                | `src/elements/tichu-replay.ts:461-466`                                                                        | `args.bet === "200"` vs `args.bet === 100` for `tichuBet`.                                                                                                                                                   |
| Missing i18n keys & var translate | `src/elements/tichu-status.ts:19-29`, `NotificationManager.php:6,16-17,37,81,140`, `tichu.game.php:1479-1481` | Untranslated UI labels (`Round:`, `Trick:`, `Trick Points:`, `Show current trick`); tabs/newlines in `$msg`; `clienttranslate($msg)` / `clienttranslate($title)`; `playCombo` / `wishMade` missing `'i18n'`. |
| Spectator / sound guards          | `src/tichu.ts`, `src/elements/tichu-action-bar.ts`                                                            | Countdown/SFX must check `!this.isReadOnly()` and `this.bgaAnimationsActive()` (or `prefs`).                                                                                                                 |
| Zombie handling                   | `tichu.game.php:1607-1611, 1686`                                                                              | `case "playCombo"` always passes (can violate Mahjong wish if zombie holds wished rank); `zombiGiveCards()` uses `shuffle($cards)`.                                                                          |
| SQL comments & upgrades           | `dbmodel.sql:2-22,26,52-53`, `tichu.game.php:1708-1800`                                                       | `--` SQL comments; `upgradeTableDb()` alters `player` / `card` / `actionlog` without `DBPREFIX_` in every statement or idempotent error tolerance.                                                           |

---

## 4. Decisions & Alternatives for You

1. **When to clear card selection in `playCombo` (`src/tichu.ts:854`)**:
   - **Option A (CONFIRMED)**: Move `unselectAll()` into the AJAX success callback (`this.takeAction(..., () => { ... })` or `notif_playCombo` for `player_id === this.player_id`), so server rejections keep the player's cards selected.
   - **Option B (REJECTED)**: Restore selection in the AJAX error callback. _Rejected_ — briefly flickers selection off and back on, and fails if the user clicks something during RTT.
2. **Zombie `playCombo` behavior (`tichu.game.php:1607`)**:
   - **Option A (CONFIRMED)**: Keep zombie fast & simple — only search `Hand::findBeatingCombo(...)` / `canFulFillWish(...)` when a Mahjong wish is active or when the zombie leads (`lastCombo === null`), otherwise pass. Uses `bga_rand` instead of `shuffle()` for `zombiGiveCards()`.
   - **Option B (REJECTED)**: Full heuristic AI for zombies. _Defer_ — unnecessary complexity since players usually concede or wait for zombie removal, and simple legal play suffices.
3. **`clienttranslate($var)` cleanup in `NotificationManager.php` and `tichu.game.php:1480`**:
   - **Option A (CONFIRMED)**: Replace wrapper methods taking arbitrary `$msg` with literal `clienttranslate("...")` calls at each call site (or pass pre-translated `clienttranslate("...")` literals via PHPDoc-annotated pass-through helpers), so BGA's translation scanner finds every string.

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Fix premature `unselectAll()` in `src/tichu.ts`

- Inspect `playCombo` (`src/tichu.ts:852-862`) and `giveTheCards` / `playBomb` helpers nearby to verify whether any sibling action clears selection early.
- Remove `this.playerHand.unselectAll();` before `this.takeAction(...)` and clear selection only on success (inside `takeAction`'s success callback or inside `notif_playCombo` / `notif_phoenixPlay` when acting player matches `this.player_id`, double-checking `phoenixPlay` ambiguous modal flow so selecting Phoenix value does not lose track of the played cards).

### Step 2: Fix `grandTichuBet` strict string comparison in `src/elements/tichu-replay.ts`

- Update `src/elements/tichu-replay.ts:463` from `args.bet === "200"` to `Number(args.bet) === 200` (and normalize `Number(args.bet) === 100` on line 466 for historical archive safety where older logs might serialize strings vs ints).
- Ensure `NotificationManager::grandTichuBet()` casts `(int) $bet` consistently.

### Step 3: Fix i18n strings & `NotificationManager` formatting

- In `src/elements/tichu-status.ts:19-29`, import `t` from `./utils` (or `game-model` translation helper — inspect how `tichu-hand.ts` / `tichu-action-bar.ts` translate strings via `_()`/`t()`) and wrap `"Round:"`, `"Trick:"`, `"Trick Points:"`, and `"Show current trick"`.
- In `modules/managers/NotificationManager.php`:
  - Line 16–17: remove `\t` and `\n` from `grandTichuBet` `$msg`.
  - Add `'i18n' => ['combo_name']` to `playCombo` / `playBomb` notifications and `'i18n' => ['text_value']` to `wishMade` (verify exact arg names in `NotificationManager.php`).
  - Refactor `sendPublic` / `sendPrivate` helpers (lines 6, 37, 81, 140) and `$createRow` in `tichu.game.php:1479-1481` so `clienttranslate("...")` only ever wraps string literals directly.

### Step 4: Guard Spectator `isReadOnly()` and Sound Playback

- Check `src/tichu.ts` and `src/elements/tichu-action-bar.ts` for any countdown timer intervals, button enablement, or keyboard/action triggers that could fire when `this.isReadOnly()` is true; gate interactive controls and countdown prompts behind `!this.isReadOnly()`.
- Wrap `tichu_laser` playback (`playSound` / `<audio>` trigger) with `this.bgaAnimationsActive()` (checking how `bga-shim.js` exposes it locally) so muted/instant/replay-skip transitions don't blast audio.

### Step 5: Harden `zombieTurn` and `zombiGiveCards` (`tichu.game.php`)

- Replace `shuffle($cards);` on `tichu.game.php:1686` with deterministic/platform-safe sampling via `bga_rand(0, count($cards) - 1)` (preserving deterministic replay seeding).
- In `zombieTurn` (`case "playCombo"` around line 1607): if `$active_player` must lead (`$lastCombo == null`) or has a legal combo satisfying an active Mahjong wish (`Hand::canFulFillWish` / `findBeatingCombo`), play a legal lowest combo (never Dragon gift infinite loop; if zombie triggers `ST_CHOOSE_DRAGON_GIFT`, ensure `zombieTurn` handles `ST_CHOOSE_DRAGON_GIFT` by picking the first opponent). Test with `local/integration-tests.php`.

### Step 6: Harden `dbmodel.sql` & `upgradeTableDb`

- Replace all `-- ...` comments in `dbmodel.sql` with `/* ... */` block comments (and ensure trailing `;` before comments).
- Inspect `tichu.game.php:1708-1800`: ensure every `applyDbUpgradeToAllDB(...)` query uses `DBPREFIX_player`, `DBPREFIX_card`, `DBPREFIX_actionlog`, and wrap idempotent column/index additions with `SHOW COLUMNS FROM DBPREFIX_... LIKE '...'` checks before `ALTER TABLE` (using `getObjectListFromDB` safely).

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **Live Games**: Never change notification _type names_ or rename `tichu.action.php` methods here — active client tabs and replays expect exact names (`grandTichuBet`, `tichuBet`). Only normalize parsing (`Number(args.bet)`) and add `'i18n'` metadata.
- **Translation Extractor**: After fixing `clienttranslate(...)`, run `npm run compile && npm run bundle` and inspect `tichu.js` / PHP files to verify zero dynamic `$var` arguments inside `clienttranslate(...)`.
- **Sibling Plans**: Fixing `grandTichuBet` integer typing and `NotificationManager` shapes here directly aligns with [01 — Static Contracts](file:///Users/brohlfs/git/tichu/plans/01-static-contracts-phpstan-and-ci.md); `bgaAnimationsActive()` is reused in [05 — FLIP Card Flight Animations](file:///Users/brohlfs/git/tichu/plans/05-flip-card-flight-animations.md).

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] `composer test` (or `vendor/bin/phpunit`) passes (including new/updated zombie or combo tests).
- [ ] `npm run test:integration` passes (add a regression test for zombie Mahjong wish play + `playCombo` failure keeping selection if UI-tested).
- [ ] `npm run build` compiles cleanly (`tichu.js` updated).
- [ ] `grep -rn "^--" dbmodel.sql` returns 0 matches; `grep -rn "clienttranslate(\\\$" .` returns 0 matches.
- [ ] Replay test (`tichu-replay.ts` logic or local replay HTML) renders both `200` (number) and `"200"` (string) Grand Tichu bets.
- [ ] On local server (`npm run local`), test playing an illegal combo (e.g., `[2, 3, 4]` single/invalid) and verify cards remain selected in hand after error banner.
