# 01 — Static Contracts, PHPStan & GitHub Actions CI

- **Priority**: P0 (Prevents silent client/server payload drift, PHP 8.4 regressions, and broken PRs)
- **Scope**: Shared TS contracts (`src/types/tichu-contracts.ts`), static cross-layer verifier (`local/check-contracts.php`), PHPStan (`phpstan.neon`, `composer.json`)
- **Estimated Effort**: Medium (1 focused session)
- **Dependencies / Sibling Interactions**: Should land right after [00 — Live Bugs](file:///Users/brohlfs/git/tichu/plans/00-live-bugs-and-bga-compliance-fixes.md) (fixes the contract mismatch on `grandTichuBet.bet` and `autopass`) and before major backend/frontend refactors ([04](file:///Users/brohlfs/git/tichu/plans/04-client-combo-validator-and-smart-play-ux.md), [13](file:///Users/brohlfs/git/tichu/plans/13-modern-bga-frontend-esm-and-sound-cleanup.md), [14](file:///Users/brohlfs/git/tichu/plans/14-modern-bga-backend-autowired-actions-and-namespaces.md)).

---

## 1. Why & Goal

Currently, Tichu maintains notification and action payload shapes **by memory across three disconnected places**:

1. `modules/managers/NotificationManager.php` (PHP associative arrays sent via `notifyAllPlayers` / `notifyPlayer`)
2. `src/tichu.ts` (Dojo `notif_*` handlers with `any`/untyped arguments)
3. `src/elements/game-model.ts` & `src/elements/model.ts` (live + replay state stores)

That disconnect already caused live bugs (e.g., `grandTichuBet` `bet` integer vs `"200"` string in `tichu-replay.ts`, `autopass` integer vs boolean expectations, and missing `'i18n'` keys). Meanwhile, `AGENTS.md` manually warns against PHP 8.4 syntax regressions, reserved notification args (`player_name`, `actplayer`), state-machine dead ends, and MySQL 8.0 `SERIALIZABLE` / `dbmodel.sql` mistakes — none of which are automatically checked on every push.

Goal: Build a fast (<1s locally), zero-runtime-overhead verification layer:

1. **Single-source TypeScript contracts** (`src/types/tichu-contracts.ts`) shared between `src/tichu.ts`, `GameModel`, and `Model` (`tichu-replay.ts`).
2. **`local/check-contracts.php`** (~50–100ms PHP CLI script) checking PHP<->TS notification keys, action names, `states.inc.php` graph reachability & action coverage, `dbmodel.sql` compliance, `clienttranslate(...)` hygiene, and `_ide_helper.php` alignment.
3. **PHPStan (`phpstan.neon`)** configured cleanly against `_ide_helper.php` (catching undefined BGA methods, bad types, PHP 8.4 issues).

---

## 2. Open-Source BGA References

- **`rbellec/bga_duelly`** (`phpstan.neon` + `_ide_helper.php`): Cleanest real-world PHPStan config for BGA projects using `_ide_helper.php` as `scanFiles` (without treating stub files as analyzed code).
- **`ironandwhispers` & `hexpionage`**: Static/dry-run contract validators checking every `notifyAllPlayers` type has a matching JS handler and checking `states.inc.php` transition targets exist.
- **`bga-workbench` & `bga-sharedcode` (npm CLI tools)**: Inspire CI lint rules for reserved BGA notification args (`${player_name}` escaping, `'i18n'` array presence), `dbmodel.sql` `--` comment prohibition, and `clienttranslate` literal extraction.
- **`elaskavaia/bga-mars` & `thoun/bga-cards` CI**: Automated PHPUnit + TypeScript build on push.

---

## 3. Current State in Tichu

- `package.json` has `compile` (`tsc`), `bundle` (`esbuild`), `build`, `format`, `test:unit` (PHPUnit), `test:integration` (MySQL 8.0 via `local/mysql-ctl.sh`), `test:race` (parallel worker stress). There is **no** `phpstan.neon`, **no** static contract checker, and **no** `typecheck` / `lint:contracts` script.
- `src/tichu.ts` subscribes to ~17+ notifications (`dojo.subscribe(...)`) and sends 15 actions (`tichu.action.php`) without typed payload interfaces.
- `_ide_helper.php` exists in the repo root for BGA framework stubs.
- `local/mysql-ctl.sh` uses MySQL 8.0 with `--transaction-isolation=SERIALIZABLE`

---

## 4. Decisions & Alternatives for You

1. **Contract checking mechanism (`PHP <-> TS`)**:
   - **Option A (CONFIRMED)**: TypeScript interfaces in `src/types/tichu-contracts.ts` as the typed client contract + lightweight `local/check-contracts.php` parsing `NotificationManager.php` / `tichu.action.php` / `states.inc.php` / `tichu-contracts.ts` via `token_get_all()` + regex to ensure every notification type, payload key, and action endpoint matches across PHP and TS.
   - **Option B**: Code-gen TS from PHP attributes. _Rejected_ — heavy ceremony for classic BGA PHP 8.4 without adding a reflection build step.
2. **PHPStan strictness level**:
   - **Option A (CONFIRMED)**: Start at **level 4 or 5** on `modules/`, `tichu.game.php`, `tichu.action.php`, `tichu.view.php` with a baseline if needed (`phpstan-baseline.neon`), excluding `local/` and `tests/` initially, and fail CI on new errors.
   - **Option B**: Level 8+ immediately. _Avoid initially_ — classic BGA `Deck::getCardsInLocation` mixed array returns create noisy false positives until gradual typing is added.
3. **CI Scope for `race-tests.php`**:
   - **Option A (CONFIRMED)**: Keep `test:race` manual/on-demand (or `workflow_dispatch`) because multi-worker MySQL contention tests take longer and can flake on shared CI runners; run fast MySQL 8.0 `test:integration` (`services: mysql:8.0`) + `dbmodel.sql` schema smoke check on every PR.

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Create `src/types/tichu-contracts.ts`

- Inspect `modules/managers/NotificationManager.php`, `tichu.action.php`, `src/tichu.ts`, `src/elements/game-model.ts`, and `src/elements/model.ts`.
- Define:
  - `TichuNotificationMap`: keyed by every notification name (`dealCards`, `grandTichuBet`, `tichuBet`, `confirmTichu`, `wishMade`, `phoenixValue`, `playCombo`, `playBomb`, `pass`, `autopass`, `giveCards`, `acceptCards`, `confirmTrick`, `dragonGift`, `endRound`, `newRound`, `newTrick`, `gameStateChange`, etc.) with exact field types (`bet: number`, `autopass: number`, `cards: CardData[]`, etc.).
  - `TichuActionMap`: keyed by action name (`grandTichuBet`, `tichuBet`, `makeAWish`, `choosePhoenix`, `playCombo`, `playBomb`, `pass`, `cancelAutopass`, `giveTheCards`, `acceptCards`, `collect`, `cancelPhoenix`, `cancel`, `chooseDragonGift`).
  - `TichuGamedatas` matching `getAllDatas()` return shape.
- Update `src/tichu.ts` (`takeAction<K extends keyof TichuActionMap>`, typed `notif_*` signatures) and `src/elements/game-model.ts` / `model.ts` to consume these types.

### Step 2: Build `local/check-contracts.php`

Write a fast, zero-dependency PHP CLI validator wired to `"test:contracts": "php local/check-contracts.php"` in `package.json`:

1. **DB Schema Check**: Assert `dbmodel.sql` contains zero `--` comments and ends statements cleanly; verify every `upgradeTableDb()` table name uses `DBPREFIX_` (outside documented exceptions).
2. **Translation Hygiene Check**: Scan `*.php` and `src/**/*.ts` for `clienttranslate($` dynamic variables; check `NotificationManager.php` for `${var}` inside double quotes (PHP 8.4 deprecated syntax) and verify `'i18n'` array presence when translated tokens like `combo_name` are interpolated.
3. **State Machine Integrity (`states.inc.php`)**: Verify every transition target state ID exists in `$machinestates`, every `possibleactions` entry either has a matching method on `action_tichu` (`tichu.action.php`) or is in an explicit documented alias map (`giveCards` -> `giveTheCards`, `phoenixPlay` -> `choosePhoenix`), and every `ST_*` constant in `modules/Constants.php` resolves cleanly.
4. **Notification Contract Check (`PHP <-> TS`)**: Parse every `notifyAllPlayers("X", ...)` / `notifyPlayer(..., "X", ...)` and `NotificationManager` method; verify `"X"` exists in `TichuNotificationMap` (`src/types/tichu-contracts.ts`) and in `setupNotifications()` (`src/tichu.ts`) AND replay handler (`src/elements/tichu-replay.ts`), or is explicitly listed as UI-ignored (e.g. `confirmTichu`).
5. **Action Contract Check (`tichu.action.php <-> TS`)**: Verify every public action in `action_tichu` matches `TichuActionMap`.

### Step 3: Add PHPStan (`phpstan.neon`)

- Add `"phpstan/phpstan": "^1.12"` (or `^2.0`) to `composer.json` `require-dev` and add `"phpstan": "vendor/bin/phpstan analyse --memory-limit=512M"` script.
- Create `phpstan.neon`:
  - `level: 5`
  - `paths`: `tichu.game.php`, `tichu.action.php`, `tichu.view.php`, `modules`
  - `scanFiles`: `_ide_helper.php`, `material.inc.php`, `states.inc.php`, `gameinfos.inc.php`, `gameoptions.inc.php`, `stats.inc.php`
- Run `composer phpstan`; either fix trivial type bugs exposed immediately (preferred) or generate a minimal `phpstan-baseline.neon` only for legitimate BGA `Deck` dynamic-array noise.

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **Never run Rector `deadCode` against `_ide_helper.php`**: As noted in `AGENTS.md`, `_ide_helper.php` has stub method bodies that mislead refactoring tools. Keep `_ide_helper.php` strictly in PHPStan's `scanFiles` (not `paths`).
- **Prettier & Generated `tichu.js`**: Remember `tichu.js` is bundled output checked into git for BGA deployment; decide in CI whether to verify `git diff --exit-code tichu.js` after `npm run build` so forgetting to run `npm run build` before committing fails loudly!
- **Sibling Plans**:
  - When [14 — Modern BGA Backend](file:///Users/brohlfs/git/tichu/plans/14-modern-bga-backend-autowired-actions-and-namespaces.md) deletes `tichu.action.php` and moves to `act*` methods, update `local/check-contracts.php` Step 3 & Step 5 to parse `act*` methods on `Tichu`.
  - When [04 — Client Combo Validator](file:///Users/brohlfs/git/tichu/plans/04-client-combo-validator-and-smart-play-ux.md) adds `lastCombo` structured fields to `gamedatas` and notifications, add them to `src/types/tichu-contracts.ts` first.

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] `npm run test:contracts` (new `php local/check-contracts.php`) exits 0 and catches a synthetic injected mismatch when temporarily tested.
- [ ] `vendor/bin/phpstan analyse` exits 0 on `tichu.game.php`, `tichu.action.php`, `tichu.view.php`, `modules/`.
- [ ] `npx tsc --noEmit` exits 0 with zero `any` regressions in `tichu-contracts.ts`.
- [ ] `npm test` (unit + integration) and `npm run build` exit 0.
