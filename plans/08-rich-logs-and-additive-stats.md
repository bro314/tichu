# 08 — Accessible Rich `#logs` Badges & Safe Additive Stats (`13`, `17..22`)

- **Priority**: P3 *(zero open BGA user tickets remain)*
- **Impact**: **Low–Medium** — Pure visual polish (`#logs` special-card pills) and richer post-game analytics (`double_victories`, `first_out_count`, `card_points_captured`, `dogs_played`, `dragons_gifted`, `mahjong_wishes_made`).
- **Complexity**: **Low–Medium** (~0.5–1 dev day: Track 2 additive stats are trivial; Track 1 `#logs` badge post-pass in ES5 `src/tichu.ts` needs care for localized matching, recursive `{ log, args }` `Combo::toLogSpec()` expansion, `.playername` exclusion, and light/dark contrast).
- **Sequencing**: Refreshed from former Plan `12`. Can be implemented anytime with zero dependencies on Plans `01`–`07`.
- **Scope**: `stats.inc.php`, `tichu.game.php`, `modules/managers/CardManager.php`, `src/tichu.ts`, `tichu.css`, `local/integration-tests.php`
- **Already Shipped Items (Removed from Scope)**:
  - `#142475` (`implemented`, release `261124-1242`) & `#161585` (`implemented`, `6a49159`): `Combo::hasPhoenix()`, `, Phoenix as ${phoenix_rank}` log templates (`tichu.game.php:716-736`), `NotificationManager::playCombo` `Combo::toLogSpec()` + conditional `phoenix_rank` `i18n` (`41d06bf`), and Part H integration tests (`local/integration-tests.php:812-957`).
- **Shared ID Reservations**: **Owns `stats.inc.php` append-only IDs**: Table `13` (`double_victories`); Player `17` (`first_out_count`), `18` (`double_victory_count`), `19` (`card_points_captured`), `20` (`dogs_played`), `21` (`dragons_gifted`), `22` (`mahjong_wishes_made`). Never alter Table `11..12` or Player `10..16`.

---

## 1. Why & Goal

1. **Accessible Rich `#logs` Badges (Track 1)**: BGA's `#logs` panel is plain unstyled text where special cards (`Dragon`, `Phoenix`, `Dog`, `Mahjong`) don't pop visually. Add lightweight light/dark `<span class="tichu-log-badge ...">` pills inside `Tichu::format_string_recursive` while preserving full readable `textContent` for screen readers and `shaneam/BGATichu`.
   - **Important Spec Fixes vs. Former Plan 12**:
     1. Drop the dead suited-card token regex (`(10|[2-9JQKA])([♠♥♦♣★])`) — `CardManager::cardToStr()` (`modules/managers/CardManager.php:212-267`) never emits suit glyphs.
     2. Match localized special-card strings (`_("Dragon")`, `_("Phoenix")`, `_("Dog")`, `_("Mahjong")`) instead of English-only `\b(Dragon|Phoenix|Dog|Mahjong)\b` so non-English BGA locales get badges too (escaping regex metacharacters cleanly).
     3. Guard against double-wrapping recursive `{ log, args }` notifications emitted by `Combo::toLogSpec()` (`41d06bf`), and skip `.playername` spans so a player named `"Dragon"` stays untouched.
2. **Safe Additive Post-Game Stats (Track 2)**: Append Table `13` and Player `17..22` in `stats.inc.php` using `totranslate(...)` (matching existing `stats.inc.php:55-101`, **NOT** `clienttranslate(...)`) and increment via a crash-proof `safeIncStat(...)` helper tolerant of pre-deploy live tables lacking the new stat rows.

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| Surface / File | Verified Location | Current State & Notes |
| :--- | :--- | :--- |
| `src/tichu.ts` & `tichu.css:374-391, 475-478` | No `format_string_recursive` override; `.log` & dark `.roundedbox` | `dojo.js#L1725` rejects bare `this.inherited(arguments)` in ES5 strict mode and `local/js/bga-shim.js:2016` lacks `this.inherited`; delegate via `(ebg as any)?.core?.gamegui?.prototype?.format_string_recursive?.call(this, log, args)`. |
| `stats.inc.php:50-106`, `tichu.game.php:385-393` | Table `11..12`, Player `10..16`, `setupNewGame()` | Uses `totranslate(...)`; `_ide_helper.php` omits `getStatTypes()` (incompatible with PHPStan Level 6). |
| `tichu.game.php:670-770, 1004-1050, 1701-1729, 2157-2390+` | `completePlayCombo`, `chooseDragonGift`, `makeAWish`, `stEndRound` | Exact hook sites for `dogs_played`, `dragons_gifted`, `mahjong_wishes_made`, `first_out_count`, `double_victories`, `double_victory_count`, and `card_points_captured`. Note: at `stEndRound` (`L2179-2192`), 4th player's remaining hand cards are scored directly for opponents without moving to a player's `captured` pile (`CardManager::calculateCapturedPoints()` counts `captured` pile only — account for both or move/tally accurately). |
| `src/elements/replay-engine.ts:133-135` | `playCombo` replay handler | Moved out of `tichu-replay.ts`; ignores `log` formatting entirely. |

---

## 3. 4-Way Live-Game Compatibility & Concurrency Audit

- **`OLD DB -> NEW PHP + NEW JS`**: Pre-deploy tables lack `stats` rows `13` / `17..22`; `safeIncStat()` catches `\Throwable` and calls `$this->logProdWarn(...)` so mid-turn stat writes never abort play.
- **Rollback Safety**: Zero new `states`, `global` IDs, `dbmodel.sql` columns, `actionlog` events, or notification schemas; stats rows `13`/`17..22` are ignored after rollback.
- **Locks, `@thoun` Autopass & Studio Safety**: Zero lock/autopass changes; `safeIncStat()` calls only `$this->incStat(...)` and `$this->logProdWarn(...)` (`npm run test:contracts` & `phpstan.neon` Level 6 clean).

---

## 4. Step-by-Step Implementation Blueprint

1. **Track 1 — Localized Rich `#logs` Badges (`src/tichu.ts`, `tichu.css`)**:
   - In `src/tichu.ts` (zero runtime imports from `src/elements/`), implement `format_string_recursive(log, args)` delegating first to `ebg.core.gamegui.prototype.format_string_recursive.call(this, log, args)`.
   - Pass result through an HTML-aware `decorateLogBadges(html)` helper that skips `<...>` tags, `.playername` spans, and `.tichu-log-badge` spans, and wraps localized matches for `_("Dragon")`, `_("Phoenix")`, `_("Dog")`, and `_("Mahjong")` (using word boundaries when ASCII/word-char safe) in `<span class="tichu-log-badge tichu-log-badge--<key>">...</span>`.
   - Style `.tichu-log-badge` in `tichu.css` with subtle pill padding/borders and explicit `html[data-theme="dark"]` / `html.dark` high-contrast colors.
2. **Track 2 — Additive Statistics & `safeIncStat()` (`stats.inc.php`, `tichu.game.php`)**:
   - Append Table `13` (`double_victories`) and Player `17..22` (`first_out_count`, `double_victory_count`, `card_points_captured`, `dogs_played`, `dragons_gifted`, `mahjong_wishes_made`) in `stats.inc.php` using `totranslate(...)`.
   - Initialize all 7 stats to `0` in `Tichu::setupNewGame()` (`tichu.game.php:385-393`) and add `private function safeIncStat(string $name, int $delta, ?int $playerId = null): void`.
   - Increment `dogs_played` (`completePlayCombo` on `DOG_COMBO`), `dragons_gifted` (`chooseDragonGift`), `mahjong_wishes_made` (`makeAWish` when `$wish != 15`), `first_out_count` / `double_victories` / `double_victory_count` / `card_points_captured` (`stEndRound`, accounting accurately for captured + 4th-hand point attribution when `$doubleVic < 0`).
   - Run **`Reload statistics configuration`** on Studio after SFTP deploy before testing/releasing.

---

## 5. Verification Checklist

- [ ] **Contracts, Types & Build**: `npm run build && npm run test:contracts && npm run phpstan` pass at PHPStan Level 6.
- [ ] **MySQL 8.0 Integration (`local/integration-tests.php`)**: Assert `mahjong_wishes_made`, `dogs_played`, `dragons_gifted`, `first_out_count`, `double_victories`, `double_victory_count`, `card_points_captured` (including `-25` Phoenix), and missing-stat-row resilience via `safeIncStat()`.
- [ ] **Browser Verification (`npm run local` + Studio)**: Verify zero `this.inherited` errors, badges in light & dark modes (`html[data-theme="dark"]` & `html.dark`), `&dummyTranslations` localized badge matching, `.playername` exclusion, and `Reload statistics configuration` on Studio.
