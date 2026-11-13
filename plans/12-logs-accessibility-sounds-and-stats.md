# 12 — Logs, Accessibility, Sound Palette & Additive Stats

- **Priority**: P2 (Polish, inclusive accessibility, richer `#logs`, optional audio feedback, and deeper stats)
- **Scope**: `src/tichu.ts` (`format_string_recursive`), `tichu.css`, `src/elements/tichu-card.ts`, `src/elements/tichu-stock.ts`, `tichu_tichu.tpl` / `sounds/`, `gameoptions.inc.php` (optional prefs), `stats.inc.php`, `tichu.game.php` + `modules/managers/PlayerManager.php`
- **Estimated Effort**: Medium (4 cohesive polish tracks; any single track can also be toggled independently)
- **Dependencies / Sibling Interactions**: Uses sound gating `bgaAnimationsActive()` from [00](file:///Users/brohlfs/git/tichu/plans/00-live-bugs-and-bga-compliance-fixes.md), zero-reload pref pattern from [03](file:///Users/brohlfs/git/tichu/plans/03-zero-reload-preferences-and-two-way-sync.md), and `sounds/` convention aligned with [13](file:///Users/brohlfs/git/tichu/plans/13-modern-bga-frontend-esm-and-sound-cleanup.md).

---

## 1. Why & Goal

Compared to flagship open-source BGA card games (`Papayoo`, `The Crew`, `Odin`, `Bohnanza`, `Hearts`), Tichu can level up noticeably in four low-risk polish areas:

1. **Rich `#logs` Badges (`format_string_recursive`)**: Game logs currently render plain text (`"Alice plays Pair of Queens (Q♠ Q♥)"` or `"7 of Swords"`), making scanning `#logs` for special cards (`Dragon`, `Phoenix`, `Mahjong`, `Dog`) or specific suits slow. Rich colored inline suit/special-card pills make the BGA history log dramatically easier to scan at a glance!
2. **Keyboard Accessibility, Screen Readers & Colorblind Support**: Currently in `src/elements/tichu-card.ts`, normal cards `2..9, J, Q, A` have `title=""`, no `aria-label`, no `role="button"` / `aria-pressed`, and no arrow-key / Space keyboard play inside `<tichu-stock>`! Furthermore, standard Tichu relies heavily on 4 suit colors (Black/Red/Blue/Green) with subtle center pips.
3. **Optional Table Sound Effects**: Only `tichu_laser` exists today; subtle card snap, pass whoosh, bomb boom, and trick win chimes make real-time Tichu feel alive (respecting mute & `bgaAnimationsActive()`).
4. **Richer Post-Game Statistics (`stats.inc.php`)**: Today Tichu tracks only 2 table stats (`round_number`, `trick_number`) and 7 player stats (`tricks_win`, `bomb_number`, `tichu_number`, `grandtichu_number`, `tichu_won_number`, `grandtichu_won_number`, `bombs_completed_by_partner`). Players love seeing **Double Victories**, **Went Out First count**, **Card Points Captured**, **Dogs Played**, **Dragons Gifted**, and **Mahjong Wishes Made**!

---

## 2. Open-Source BGA References

- **`claude-code-bga` & BGA `format_string_recursive` (`GameGui`)**: Classic BGA hook `format_string_recursive(log, args)` decorates notification strings rendered in `#logs` and the status bar `#pagemaintitletext` (remembering to **always return clean accessible text / `aria-label` or `title`**, not `<div>` block tags, so screen readers and inline text flow naturally!).
- **`a11y` / `Odin` / `Papayoo`**: `role="checkbox"` or `role="button"`, `aria-pressed`, `aria-label="Queen of Swords, 10 points"`, `roving tabindex` (`ArrowLeft`/`ArrowRight` + `Space`/`Enter` selection) inside card hands, plus optional subtle corner suit letter/pip reinforcement for colorblind accessibility.
- **`claude-code-bga` `stats.inc.php` live-migration rule**: You may **append** new stat IDs (e.g. table ID `13+`, player ID `17..22`) safely in `stats.inc.php`, **never** renumber or delete existing IDs `10..16`!

---

## 3. Current State in Tichu

- **`src/elements/tichu-card.ts:1-160`**: Computes tooltips only for special cards and point cards (`5`, `10`, `K`); regular cards (`2..4, 6..9, J, Q, A`) get `title=""`! No `aria-label`, `aria-pressed`, or keyboard `tabindex` inside `<tichu-stock>`.
- **`stats.inc.php`**:
  - Table stats: `11` (`round_number`), `12` (`trick_number`).
  - Player stats: `10` (`tricks_win`), `11` (`bomb_number`), `12` (`tichu_number`), `13` (`grandtichu_number`), `14` (`tichu_won_number`), `15` (`grandtichu_won_number`), `16` (`bombs_completed_by_partner`).
- **`tichu_tichu.tpl`**: Hardcodes `<audio id="audiosrc_tichu_laser" ...>` (`tichu_laser.mp3`/`.ogg`).
- **`src/tichu.ts`**: No `format_string_recursive` override for rich log icons yet.

---

## 4. Decisions & Alternatives for You

1. **`format_string_recursive` Log Formatting & Extension Compatibility (`BGATichu` / `tichu-ext`)**:
   - **Option A (Recommended)**: Override `format_string_recursive(log, args)` cleanly using inline `<span class="tichu-log-card suit-...">Q♠</span>` spans (preserving readable ASCII/Unicode text like `Q♠`, `Dragon`, `Phoenix` inside the span!). That upgrades `#logs` visually _without_ breaking screen readers or browser extensions that read log text! Keep replay rendering aligned if needed.
   - **Option B**: Pure CSS sprite icons with empty text (`<span></span>`). _Rejected_ — breaks screen readers, copy-paste logs, and text scrapers!
2. **Colorblind Mode & Sound Toggle Delivery**:
   - **Option A (Recommended)**: Add `"needReload" => false` User Preferences `105` (**Sound Effects**: `On` / `Off`, default `On` while respecting `bgaAnimationsActive()` + BGA global mute) and `106` (**Colorblind Suit Symbols**: `Off` / `On`) in `gameoptions.inc.php` — check exact next unused IDs cleanly!
3. **New Additive Stats (`stats.inc.php`)**:
   - **Option A (Recommended)**: Append:
     - Table stat `13`: `double_victories` (`int`)
     - Player stats `17`: `first_out_count` (`int`), `18`: `double_victory_count` (`int`), `19`: `card_points_captured` (`int`), `20`: `dogs_played` (`int`), `21`: `dragons_gifted` (`int`), `22`: `mahjong_wishes_made` (`int`).
       Remember to call `initStat('table', ..., 0)` / `initStat('player', ..., 0)` inside `setupNewGame()` (`tichu.game.php`), AND guard `incStat()` calls cleanly (`try/catch` or `isset` / helper) in case a long-running table started _before_ the deploy hasn't initialized the new stat row!

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Accessibility & Colorblind Mode (`tichu-card.ts` & `tichu-stock.ts`)

- In `src/elements/tichu-card.ts`:
  - Give **every** card an informative `title` AND `aria-label` (e.g., `"Ace of Jade"`, `"5 of Stars (5 pts)"`, `"Dragon (+25 pts)"`, `"Phoenix (-25 pts)"`).
  - When selectable (in hand / staging), set `role="button"`, `aria-pressed="${selected ? 'true' : 'false'}"`, and roving `tabindex` (`0` for active card, `-1` for others) managed by `<tichu-stock>`.
  - When Colorblind Suit Symbols mode (`pref 106`) is enabled, render crisp suit glyphs + high-contrast corner/badge markers (`♠`, `★`, `♣/◆` or Pagoda/Jade glyphs with distinct patterns) via CSS overlay on `<tichu-card>`.
- In `src/elements/tichu-stock.ts`:
  - Handle `keydown`: `ArrowLeft` / `ArrowRight` move focus across cards cleanly inside Shadow DOM; `Space` / `Enter` toggles selection (and `Escape` clears selection).

### Step 2: Rich `#logs` Formatting via `format_string_recursive` (`src/tichu.ts` & `tichu.css`)

- Inspect all `NotificationManager.php` log templates (`${cards_desc}`, `${combo_name}`, `${text_value}`, `${card}`, etc.).
- Override `format_string_recursive(log: string, args: Record<string, any>): string` in `src/tichu.ts` (calling `this.inherited(arguments)` carefully per Dojo `declare` conventions!):
  - Wrap special card names (`Dragon`, `Phoenix`, `Dog`, `Mahjong`) and card tokens (`A♠`, `K♥`, `10♣`, etc. — verify exact strings emitted by `Combo.php` / `NotificationManager.php`!) in styled inline `<span class="tichu-log-badge ...">...</span>` styled cleanly for both light and `html[data-theme="dark"]` `#logs`.

### Step 3: Optional Audio Palette (`sounds/` + `pref 105`)

- Check `tichu_tichu.tpl` and `img/tichu_laser.*`; add subtle open-licensed/synthesized `.mp3` + `.ogg` effects in `sounds/` (card play, bomb boom, trick sweep, pass chime — kept tiny `< 30KB` each; generate cleanly or reuse existing asset tooling).
- Play via `this.playSound(...)` ONLY when `!this.instantaneousMode && this.bgaAnimationsActive() && prefSoundEnabled`.

### Step 4: Additive Post-Game Statistics (`stats.inc.php` & `tichu.game.php`)

- Append table stat `13` and player stats `17..22` in `stats.inc.php` (NEVER touching existing IDs!).
- Call `$this->initStat(...)` for all new stats in `setupNewGame()`.
- Increment safely inside `tichu.game.php` (`stEndRound` for `double_victories`, `first_out_count`, `card_points_captured`; `playCombo` for `dogs_played`, `makeAWish` for `mahjong_wishes_made`, `chooseDragonGift` for `dragons_gifted`), checking with a safe `safeIncStat(...)` helper so pre-existing live tables that lack new stat rows don't crash on update!

---

## 6. Pitfalls, Live-Game Guardrails & Sibling Plan Interactions

- **`incStat` on Already-Running Production Tables**: On BGA, a table started _before_ your deploy only has the old rows in the `stats` table (`setupNewGame()` only runs once at table creation!). Calling `$this->incStat(1, 'dogs_played', $player_id)` on such a table can silently no-op or warn depending on Studio version — test against a fixture missing stat ID `20`, and use `safeIncStat` (or `INSERT IGNORE` / `stats` existence check) safely!
- **Never Change Existing Stat IDs**: Verify IDs `11..12` (table) and `10..16` (player) stay 100% untouched.
- **Upload Allowlist (`local/sftp-sync.sh`)**: If adding `sounds/*.mp3` / `*.ogg`, ensure `sounds/*` is matched in `local/sftp-sync.sh`!
- **Sibling Plans**: Putting new sounds in `sounds/` directly prepares [Plan 13](file:///Users/brohlfs/git/tichu/plans/13-modern-bga-frontend-esm-and-sound-cleanup.md) cleanup! `aria-label` + tooltip enriches `"Passed by ..."` from [Plan 08](file:///Users/brohlfs/git/tichu/plans/08-hand-organization-passed-cards-and-unpass.md).

---

## 7. Verification Checklist & Fresh-Agent Kickoff Prompt

### Verification Checklist

- [ ] Every `<tichu-card>` has non-empty localized `title` + `aria-label`, `aria-pressed`, and full keyboard navigation (`ArrowLeft`/`ArrowRight`/`Space`/`Enter`) inside `<tichu-stock>`.
- [ ] `#logs` shows styled inline suit/special badges in both light and dark themes (`html[data-theme="dark"]`) while still keeping readable plain text inside spans.
- [ ] `stats.inc.php` preserves all original IDs (`11..12`, `10..16`) and passes `local/check-contracts.php` / full-game integration test (`npm run test:integration`) with expected final stats populated.
- [ ] Live-table compatibility test: simulating a pre-upgrade DB missing new stat rows does NOT throw PHP errors during `stEndRound` or `playCombo`.
- [ ] `npm run build` and `npm test` pass cleanly.

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/stats.inc.php, /Users/brohlfs/git/tichu/src/elements/tichu-card.ts, /Users/brohlfs/git/tichu/src/elements/tichu-stock.ts, and /Users/brohlfs/git/tichu/plans/12-logs-accessibility-sounds-and-stats.md.
Confirm Section 4 options (which of the 4 polish tracks to include + pref IDs 105/106) and implement Steps 1–4 cleanly.
Verify full-game stat counts in `local/integration-tests.php`, verify zero errors on legacy stat tables, test keyboard navigation & `#logs` badges locally, and run `npm run build` + `npm test`.
```
