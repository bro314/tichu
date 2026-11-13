# 14 — Modern BGA Backend: Autowired Actions & PSR-4 Namespaces

- **Priority**: P3 (Long-term PHP maintainability — deletes `tichu.action.php`, fixes action naming mismatch, modernizes `Tichu` namespace while preserving concurrency safety)
- **Scope**: `tichu.action.php` (delete in Phase A), `tichu.game.php` (or `modules/php/Game.php` in Phase B), `states.inc.php`, `src/tichu.ts`, `composer.json`, `local/bga-backend.php`, `local/sftp-sync.sh`, `local/check-contracts.php`
- **Estimated Effort**: Medium (Phase A) to Large (Phase B) — intentionally split into Phase A (recommended) & Phase B (optional)
- **Dependencies / Sibling Interactions**: **Must keep `acquireGameLock()` + `GLOBAL_LOCK_VERSION = 30` concurrency guards completely intact!** Run [01 — Static Contracts & PHPStan](file:///Users/brohlfs/git/tichu/plans/01-static-contracts-phpstan-and-ci.md) first so PHPStan + `check-contracts.php` catch every broken endpoint/action call immediately.

---

## 1. Why & Goal

Classic BGA backends duplicate every action twice: once in `tichu.action.php` (`getArg(...)` boilerplate) and once in `tichu.game.php`. Because of historical evolution, Tichu even developed awkward naming mismatches (`AGENTS.md`):

- `states.inc.php` says `"giveCards"` -> `tichu.action.php` & `tichu.game.php` say `giveTheCards`
- `states.inc.php` says `"phoenixPlay"` -> `tichu.action.php` says `choosePhoenix`

BGA's modern PHP 8.4 framework (`Bga\GameFramework\Table` & `Bga\GameFramework\Actions\Types\*` in `_ide_helper.php` & `local/Bga/GameFramework/`) supports:

1. **Phase A — Autowired Actions (Delete `tichu.action.php`)**: Public `act<ActionName>(#[IntArrayParam] array $cards, ...)` methods directly on `Tichu` with PHP 8 attributes (`#[CheckAction(false)]`, `#[IntParam(min: ..., max: ...)]`, `#[IntArrayParam]`, `#[JsonParam]`), removing 186 lines of `tichu.action.php` AND ending manual `AT_numberlist` semicolon parsing!
2. **Phase B (Optional) — PSR-4 `modules/php/Game.php` (`namespace Bga\Games\Tichu`) + Notification Decorators**: Modern namespaced PHP layout (`$this->bga->notify->addDecorator(...)`, typed `$this->bga->globals`, etc.), **explicitly keeping** core monolithic `Game` clarity instead of over-fragmenting into 15 tiny `States/*.php` files unless clearly beneficial.

---

## 2. Open-Source BGA References

- **Local BGA Server Reference (`local/Bga/GameFramework/` & `_ide_helper.php`)**: Authoritative PHP 8.4 definitions for `#[CheckAction]`, `IntParam`, `IntArrayParam`, `StringParam`, `BoolParam`, and `Bga\GameFramework\Table` lifecycle (`bga->notify->addDecorator`, `bga->actions`, `bga->tableOptions`).
- **Official `modernize-bga-game-project.zip` & `rbellec/claude-code-bga` (`references/legacy-migration.md`)**:
  - Explains deleting `<game>.action.php` when converting to `act*` methods.
  - **Crucial hot-deploy warning**: If live tabs still call old un-prefixed action URLs (`giveTheCards.html`) right after deploy while new tabs call `actGiveCards`, or vice versa, plan how `possibleactions` / action URLs behave cleanly!
- **`Odin` / `Papayoo` / `rbellec/bga_duelly`**: Clean `modules/php/Game.php` under `Bga\Games\*` using `act*` typed parameters + shared managers without unnecessary over-engineering.

---

## 3. Current State in Tichu

- **`tichu.action.php` (186 lines)**: 15 action methods (`grandTichuBet`, `tichuBet`, `confirmTichu`, `makeAWish`, `choosePhoenix`, `playCombo`, `playBomb`, `pass`, `cancelAutopass`, `giveTheCards`, `acceptCards`, `collect`, `cancelPhoenix`, `cancel`, `chooseDragonGift`), parsing comma/semicolon strings via `AT_numberlist` and delegating to `$this->game->...`.
- **`tichu.game.php`**: Still top-level `class Tichu extends Table`, holding `acquireGameLock()` (`GLOBAL_LOCK_VERSION = 30`), `checkMultiactiveActionFresh()`, `setPlayerNonMultiactiveSafe()`, custom SQL helpers, and importing `modules/*.php` via `material.inc.php` / `require_once`.
- **`local/bga-backend.php`**: Implements Tichu's local router & mock BGA framework — currently dispatches AJAX endpoints through `action_tichu` in `tichu.action.php`!

---

## 4. Decisions & Alternatives for You

1. **Scope: Phase A only (`act*` autowired actions + delete `tichu.action.php`) vs. Phase A + Phase B (`modules/php/Game.php` PSR-4 namespace)**:
   - **Option A (Recommended)**: Do **Phase A** cleanly (`act*` autowired methods in `tichu.game.php`, delete `tichu.action.php`, upgrade `local/bga-backend.php` to support BGA's `act*` attribute reflection + `#[CheckAction(false)]`!) — delivers 90% of the DX payoff with clean, small diff and zero risk to `composer.json` / PHPUnit stubs / Studio autoloading.
   - **Option B**: Also execute **Phase B** (`modules/php/Game.php` in `namespace Bga\Games\Tichu`, `game_version` PSR-4 mode, `$this->bga->notify->addDecorator`). Do **not** split into 15 separate `States/*.php` classes unless only extracting leaf states later — Tichu's tight concurrency lock & trick-flow helpers stay far clearer together!
2. **Action Naming Cleanup (`giveTheCards` -> `actGiveCards`, `choosePhoenix` -> `actPhoenixPlay`)**:
   - **Option A (Recommended)**: On BGA, when `tichu.action.php` is deleted and `states.inc.php` declares `possibleactions => ['giveCards', ...]`, BGA's autowirer maps client action `"giveCards"` -> `actGiveCards(...)`! Update `src/tichu.ts` to call exact `states.inc.php` names (`giveCards`, `phoenixPlay`, etc.) so `states.inc.php`, JS, and PHP finally match 1:1 — **and** deploy simultaneously with `tichu.js` (checking if BGA forces reload on JS bundle mismatch or keeping temporary safe grace period if needed).
3. **Preserving Concurrency Safety (`acquireGameLock()` + `checkMultiactiveActionFresh()`)**:
   - **Non-negotiable**: Modern BGA 2026 (`local/Bga/GameFramework/`) has **no automatic replacement** for Tichu's out-of-turn interrupts (`actTichuBet`, `actPlayBomb`, `actPass` out-of-turn autopass, `actCancelAutopass`, `actUnpassCards` if Plan 08 added) or `GLOBAL_LOCK_VERSION = 30` multiactive lock ordering! Keep `acquireGameLock()` inside every out-of-turn & multiactive `act*` method, and annotate out-of-turn `act*` methods with `#[CheckAction(false)]`!

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Upgrade `local/bga-backend.php` to Support Autowired `act*` Methods & Parameter Attributes

- Inspect `local/Bga/GameFramework/Actions/` and `_ide_helper.php` to match BGA's exact attribute classes (`Bga\GameFramework\Actions\CheckAction`, `IntParam`, `IntArrayParam`, `StringParam`, `BoolParam`) and reflection rules (including converting `"1;2;3"` or `[1,2,3]` / `"1,2,3"` for `#[IntArrayParam]`, enforcing `min`/`max`, and checking `checkAction($action)` unless `#[CheckAction(false)]`!).
- Update `local/bga-backend.php` dispatcher so it checks `act<PascalCase($action)>` on `$game` via `ReflectionMethod` when `tichu.action.php` doesn't exist (and verify `phpunit` `tests/stubs.php` stubs those attribute classes if needed).

### Step 2 (Phase A): Migrate All 15 Endpoints from `tichu.action.php` to `Tichu::act*`

- Carefully inspect every line of `tichu.action.php` (validation rules: `AT_int`, `AT_posint`, `AT_numberlist`, `checkAction` vs unchecked out-of-turn calls!):
  - Standard active/multiactive actions: `actGrandTichuBet`, `actConfirmTichu`, `actMakeAWish`, `actPhoenixPlay` (fixing `choosePhoenix`), `actPlayCombo`, `actGiveCards` (fixing `giveTheCards`), `actAcceptCards`, `actCollect`, `actCancelPhoenix`, `actCancel`, `actChooseDragonGift` (plus `actUnpassCards` if Plan 08 landed).
  - Out-of-turn `#[CheckAction(false)]` actions (VERIFY each one acquires `acquireGameLock()` + validates state manually just like today!): `actTichuBet`, `actPlayBomb`, `actPass`, `actCancelAutopass`.
- Unify `states.inc.php`, `src/tichu.ts`, `src/types/tichu-contracts.ts`, `local/bot.php`, and `local/integration-tests.php` / `local/race-tests.php` to call exact canonical names (note: BGA client `takeAction("playCombo", ...)` -> routes cleanly to `actPlayCombo`, and `bga-backend` + Studio support camelCase -> `actCamelCase`).
- Delete `tichu.action.php`, update `local/sftp-sync.sh` + `local/check-contracts.php`, and `sftp rm tichu.action.php` on BGA Studio!

### Step 3 (Optional Phase B): PSR-4 `modules/php/Game.php` (`Bga\Games\Tichu`)

- Only if Option B is chosen:
  - Move `Tichu` -> `modules/php/Game.php` (`namespace Bga\Games\Tichu; class Game extends \Bga\GameFramework\Table`), deleting root `tichu.game.php` (remembering Studio SFTP `rm tichu.game.php`!).
  - Replace explicit `NotificationManager` `player_name` boilerplate where safe using `$this->bga->notify->addDecorator(...)` (verifying `local/bga-backend.php` + `NotificationManager.php` compatibility!).
  - Run `composer dump-autoload`, `phpstan`, `phpunit`, `integration-tests`, and **`npm run test:race`**!

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **`tichu.action.php` Stale File on BGA Studio**: BGA Studio loads `tichu.action.php` preferentially if it still exists on disk! When deleting `tichu.action.php` in git, **you MUST `rm tichu.action.php` on Studio via SFTP**, or Studio will keep running the deleted code!
- **MySQL 8.0 `SERIALIZABLE` & `debugSaveState(4)`**: Re-run **`npm run test:race`** and **`npm run test:integration`** against **MySQL (`local/mysql-ctl.sh`)** after converting actions to `act*`, verifying zero regression on simultaneous multiactive `giveCards`, simultaneous bomb interrupts, and `tichuBet` locks.
- **`#[IntArrayParam]` Delimiter Difference**: Tichu's client currently joins card IDs with `";"` (`"12;34;51"`). Check BGA's `local/Bga/GameFramework/` implementation of `IntArrayParam` — does BGA split on `","`, `";"`, or JSON array `JSON.stringify([12, 34, 51])`? Inspect `local/Bga/GameFramework/` first so we send the exact format BGA expects!
- **Sibling Plans**: Update `local/check-contracts.php` ([Plan 01](file:///Users/brohlfs/git/tichu/plans/01-static-contracts-phpstan-and-ci.md)) to inspect `act*` methods instead of `tichu.action.php`; coordinate with [Plan 13](file:///Users/brohlfs/git/tichu/plans/13-modern-bga-frontend-esm-and-sound-cleanup.md) if upgrading to `this.bga.actions.performAction(...)` (`bgaPerformAction` calls action names **without** `act` prefix and passes plain JS arrays/booleans cleanly!).

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] `tichu.action.php` deleted (`states.inc.php` action names match `act*` methods & `src/tichu.ts` 1:1).
- [ ] Every out-of-turn `#[CheckAction(false)]` method (`actTichuBet`, `actPlayBomb`, `actPass`, `actCancelAutopass`, plus `actUnpassCards` if present) verified under lock & `npm run test:race`.
- [ ] `php local/check-contracts.php`, `vendor/bin/phpstan analyse`, `composer test`, `npm run test:integration`, `npm run test:race`, and `npm run build` ALL exit 0.
- [ ] Tested on local server (`npm run local`) AND BGA Studio after verifying stale `tichu.action.php` was removed via SFTP.

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/tichu.action.php, /Users/brohlfs/git/tichu/local/bga-backend.php, /Users/brohlfs/git/tichu/local/Bga/GameFramework/, and /Users/brohlfs/git/tichu/plans/14-modern-bga-backend-autowired-actions-and-namespaces.md.
Confirm with the user whether to execute Phase A only (Recommended: autowired `act*` methods, delete `tichu.action.php`) or also Phase B (`modules/php/Game.php` PSR-4 namespace).
Inspect `local/Bga/GameFramework/` parameter attributes first, implement cleanly, update `local/bga-backend.php`, `local/check-contracts.php`, and `local/sftp-sync.sh`, then run PHPUnit, PHPStan, `test:integration`, `test:race`, and `npm run build`.
```
