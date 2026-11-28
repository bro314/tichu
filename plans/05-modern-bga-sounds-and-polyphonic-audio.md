# 05 — Modern `sounds/` Directory, Polyphonic Audio Pool & Preference `107`

- **Priority**: P2
- **Impact**: **Medium** — Closes open suggestion `#95874` (eliminates rapid-play sound cutoff, expands audio from 1 cue to 6 with a live Settings toggle) and unblocks **Plan 07 Track B** (`tichu.view.php` / `tichu_tichu.tpl` removal after 1 release overlap).
- **Complexity**: **Medium** — Pure client/asset/pref/tooling change with zero PHP gameplay, DB schema, `actionlog`, or lock/concurrency risk.
- **Sequencing**: Refreshed from former Plan `13`. **Hard prerequisite for Plan 07 Track B**: `sounds/tichu_laser.{mp3,ogg}` must ship in Release N before Plan 07 Track B removes `tichu.view.php` & `tichu_tichu.tpl` in Release N+1.
- **Scope**: `sounds/{card_play,pass,bomb,trick_collect,mahjong_wish,tichu_laser}.{mp3,ogg}`, `tichu_tichu.tpl` (retained 1-release fallback), `gameoptions.inc.php`, `src/audio-manager.ts` (new), `src/tichu.ts`, `src/elements/game-model.ts`, `src/elements/tichu-settings-modal.ts`, `src/studio-test.ts`, `local/sftp-sync.sh`, `local/router.php`, `local/js/bga-shim.js`, `tests/combo-validator.test.ts`
- **Open BGA Tickets Covered**:
  - [#95874](https://boardgamearena.com/bug?id=95874) (`acknowledged`, 0 votes — *"Fast gameplay means audio associated with game actions does not always play"*)
- **Already Shipped Prerequisite (`7cfde5d`, release `261122-1738`)**:
  - `canPlaySound()` (`src/tichu.ts:382-398`) already decouples `playLaserSound()` from Animations Pref `105` while still muting on `document.hidden`, `instantaneousMode`, `"instant"` speed, and `!bgaAnimationsActive()`, with tests in `tests/combo-validator.test.ts:2318-2465`. Extend `canPlaySound()` (singular) in place rather than renaming to `canPlaySounds()`.
- **Shared ID Reservations**: **Owns `$game_preferences[107]`** (`Sound Effects`, `needReload => false`, `1 => enabled`, `2 => disabled`). Respects `105` (`Animations`), `106` (Plan 02), `108` (Plan 04).

---

## 1. Why & Goal

1. **Single-`<audio>` Node Interruption**: BGA's `BgaSoundService.playFile(e)` (`ly_studio.js:20798-20804`) and `local/js/bga-shim.js:206-230` reuse one DOM `<audio>` node per sound, cutting off rapid consecutive clips.
2. **Platform `move` Chime Batching + Minimal Cue Set**: `GameNotifQueue.dispatchNotifications()` (`ly_studio.js:20222`) plays `"move"` at most once per notification batch, while Tichu itself only has `img/tichu_laser.{mp3,ogg}`.

**Goal**: Move sound discovery to BGA's modern `sounds/` directory with 6 short CC0 `< 25 KB` `.mp3`+`.ogg` cues (`card_play`, `pass`, `bomb`, `trick_collect`, `mahjong_wish`, `tichu_laser`), build a polyphonic `TichuAudioManager` (Web Audio `AudioBufferSourceNode` pooling + `Audio` clone fallback + `38 ms` per-cue debounce), extend `canPlaySound()` with **Preference `107`** + BGA speaker mute/volume (staying decoupled from Animations Pref `105`), and wire live Settings UI inside **`<tichu-settings-modal>`**.

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| Surface / File | Verified Location & Symbols | Current Behavior / Gap |
| :--- | :--- | :--- |
| `tichu_tichu.tpl:3-6`, `img/tichu_laser.*` | `#audiosrc_*tichu_laser` | Hardcodes 4 `<audio>` tags to `img/tichu_laser.{mp3,ogg}`. No `sounds/` dir exists yet (keep `img/tichu_laser.*` + `.tpl` for 1-release overlap). |
| `gameoptions.inc.php:74-135` | `$game_preferences[100..105]` | Defines `100..105`; ID `107` is free. |
| `src/tichu.ts:382-405, 454-520, 802-853` | `canPlaySound()`, `playLaserSound()`, `readPrefs()`, `onPreferenceChange()`, `setup()` | `canPlaySound()` (`L382-398`, `7cfde5d`) already decouples laser sound from Pref `105` in `notif_grandTichuBet` (`L2027-2039`) & `notif_tichuBet` (`L2069-2079`). Missing `TichuAudioManager`, `dontPreloadSounds`, Pref `107`, BGA mute/volume checks, and cues in `notif_playCombo` (`L1885`), `notif_pass` (`L1983`), `notif_captureCards` (`L2004`), `notif_wishMade` (`L2169`). |
| `src/elements/game-model.ts:154-217, 718, 936-957, 2107` | `LiveGamePrefs`, `animationsEnabled$` | Tracks `animationsEnabled` (`105`); lacks `soundEnabled` (`107`) & `soundEnabled$`. |
| `src/elements/tichu-settings-modal.ts:40-48, 881-920` | `#pref-animations-toggle` | Replaced removed `tichu-hand.ts` `#prefs` bar (`e7a76b0`); Pref `107` toggle belongs here (NOT in `tichu-hand.ts`). |
| `src/studio-test.ts:3844, 4432-4437` | `#devbar_mute`, `tips.mute` | Toggles `localStorage.tichu_local_mute` only; tooltip still mentions laser sound only. |
| `local/sftp-sync.sh:31-73, 143, 157` | `is_deployable()`, `--all` | Allows `img/*` only; drops `sounds/*` and lacks remote `mkdir ${REMOTE_PATH}sounds` on first deploy. |
| `local/router.php:23-24, 37-76, 504, 606-618` | `$mimeTypes`, `$bootstrapData` | Has `mp3`/`ogg` MIME types, but doesn't populate `soundFormats` / `preloadedSounds` in bootstrap or `/local/{state,new-game,test-scenario,scenario}`. |
| `local/js/bga-shim.js:206-230, 1749-1778, 4573` | `window.playSound`, `DEFAULT_PREFS`, `bootGameInstance` | Hardcodes `img/<sound>.mp3` and `[100..105]`; lacks `bgaGameData.soundFormats`, `bgaSoundService`, `dontPreloadSounds`, `disableNextMoveSound`. |
| `tests/combo-validator.test.ts:2318-2465` | `Animations preference (105)` | Tests `canPlaySound()` decoupling from Pref `105`. |

---

## 3. Architectural Decisions & Trade-offs

1. **Audio Engine Placement & Pooling (`src/audio-manager.ts`)**:
   - Implement `TichuAudioManager` in `src/audio-manager.ts` imported by `src/tichu.ts` (outside `src/elements/`). Decode clips once into `Map<SoundCue, AudioBuffer>` and spawn ephemeral `AudioBufferSourceNode` -> `GainNode` -> `ctx.destination` instances (soft cap 12 concurrent nodes). Fall back to pooled/cloned `new Audio(url)` (`<= 4` clones/cue) before `AudioContext` unlocks, and `globalThis.playSound?.(cue)` in Node tests.
2. **Per-Cue Debounce & Platform `"move"` Suppression**:
   - Enforce a **38 ms per-cue debounce** (`now - lastPlayedAt[cue] < 38`) so distinct cues (`tichu_laser` + `card_play` + `mahjong_wish`) layer cleanly while duplicate bursts don't clip. When `playSoundCue()` triggers on a logged notification, call `this.disableNextMoveSound?.()` (`ly_studio.js:22101-22103`) so BGA's generic `"move"` bloop doesn't overlap; leave `"move"` untouched when Pref `107 = 2`.
3. **Bomb Detection in `notif_playCombo` (Post-`41d06bf`)**:
   - Commit `41d06bf` switched `combo_name` to structured `Combo::toLogSpec()`. Detect bombs via `comboType === 7 || this.stateName === "playBomb"` (do NOT string-match localized `comboName`).
4. **Preload & 1-Release Overlap**:
   - Call `this.sounds?.dontPreloadSounds?.(TICHU_SOUND_CUES)` in `setup()`, select `.ogg` vs `.mp3` via `bgaGameData.soundFormats`, and keep `tichu_tichu.tpl` + `img/tichu_laser.{mp3,ogg}` for one release before Plan 07 Track B deletes them.

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

- **4-Way Compatibility**: Zero DB, `upgradeTableDb()`, `states.inc.php`, PHP action, `global`, or `actionlog` changes. `safeGetPref(107, 1)` defaults to `1`; `TichuAudioManager` negative-caches 404 URLs in `failedUrls` and falls back `tichu_laser` to `img/tichu_laser.*`. `local/import-bug-sql.php` Surface 1 already remaps `bga_user_preferences`.
- **Locks, `@thoun` Autopass & Replay**: Zero server mutations; `instantaneousMode === true` mutes replay catch-up; `<tichu-replay>` steps `Model` without triggering `notif_*` audio.

---

## 5. Step-by-Step Implementation Blueprint

1. **Create `sounds/` Audio Assets**:
   - Copy `img/tichu_laser.{mp3,ogg}` -> `sounds/tichu_laser.{mp3,ogg}` (retain `img/tichu_laser.*` and `tichu_tichu.tpl` for 1 release).
   - Add crisp CC0 short cues (`80–450 ms`, `-3 dBFS`, `< 25 KB` each in `.mp3` and `.ogg`): `card_play`, `pass`, `bomb`, `trick_collect`, `mahjong_wish`.
2. **Add Preference `107` (`gameoptions.inc.php`, `game-model.ts`, `tichu-settings-modal.ts`)**:
   - Register `$game_preferences[107]` (`"name" => totranslate("Sound Effects")`, `"needReload" => false`, `1 => enabled`, `2 => disabled`, default `1`).
   - Add `soundEnabled` / `soundEnabled$` / `setSoundEnabled()` to `GameModel`.
   - Add a `Sound Effects` toggle switch row in `src/elements/tichu-settings-modal.ts` (beside `#pref-animations-toggle` at `L881-899`) calling `ui.changeSoundEffects(enabled)` (guarded on `!isReadOnly()`).
3. **Implement `TichuAudioManager` (`src/audio-manager.ts`)**:
   - Export `SoundCue` & `TichuAudioManager` with codec resolution (`bgaGameData.soundFormats` + `canPlayType`), passive gesture `unlock()`, `38 ms` per-cue debounce, `AudioBufferSourceNode` pool (cap 12), `Audio` clone fallback (`<= 4`/cue), `failedUrls` negative cache, `tichu_laser` `img/` rollback fallback, and Node `globalThis.playSound` fallback.
4. **Integrate Gating & Notification Cues (`src/tichu.ts`)**:
   - Instantiate `TichuAudioManager`, call `bindUnlock()` & `this.sounds?.dontPreloadSounds?.(...)` in `setup()` (`L802-853`).
   - Wire `107` in `readPrefs()`, `onPreferenceChange()`, and `changeSoundEffects()` (`persistUserPreference(107, ...)`).
   - Extend existing `canPlaySound()` (`L382-398`) with Pref `107`, `isBgaSoundMuted()` (`bgaSoundService?.bMuteSound`, `localStorage.sound_muted`, `localStorage.tichu_local_mute`), and `!bDisableSoundOnMove`, keeping Animations Pref `105` decoupled.
   - Add `playSoundCue(cue, suppressPlatformMoveSound = true)` (`playLaserSound()` delegates to it) and fire in `notif_playCombo` (`comboType === 7 || this.stateName === "playBomb"` -> `"bomb"` else `"card_play"`), `notif_pass` (`"pass"`), `notif_captureCards` (`"trick_collect"`), `notif_wishMade` (`"mahjong_wish"` for `2..14`).
5. **Update Local Dev & SFTP Tooling**:
   - `local/sftp-sync.sh`: allow `sounds/*` in `is_deployable()` and `--all`, plus remote `mkdir ${REMOTE_PATH}sounds` guard on first deploy.
   - `local/router.php`: serve `/sounds/*` with MIME/cache headers and inject `soundFormats`/`preloadedSounds` into `$bootstrapData` and `/local/{state,new-game,test-scenario,scenario}`.
   - `local/js/bga-shim.js`: seed `107: 1` (`DEFAULT_PREFS`, `this.prefs`, `bootGameInstance`), expose `bgaGameData.soundFormats`/`preloadedSounds`, `bgaSoundService`, `dontPreloadSounds`, `disableNextMoveSound`, and `sounds/` resolution in `window.playSound`.
   - `src/studio-test.ts`: update `tips.mute` (`L3844`) and sync `#devbar_mute` with `bgaSoundService.bMuteSound`.
6. **Add Tests (`tests/combo-validator.test.ts`)**:
   - Extend `Animations preference (105)` (`L2318-2465`) and add unit tests for `TichuAudioManager` (`38 ms` debounce, concurrent distinct cues, 404 cache, `tichu_laser` fallback) and Pref `107` / `bgaSoundService` gating while Pref `105 = 2` stays unmuted.

---

## 6. Verification Checklist

- [ ] All 6 `.mp3`+`.ogg` pairs exist in `sounds/` (`< 25 KB` each) and `img/tichu_laser.*` + `tichu_tichu.tpl` remain for 1-release overlap.
- [ ] `npm run build && npm run test:contracts && npm run phpstan` pass cleanly.
- [ ] `npm run local` + Studio (`Reload game options configuration`, `Use minified JS/CSS` ON -> Revert, `&dummyTranslations`): overlapping cues play without cutoff, mute & Pref `107` toggle live with 0 404s.

---

## 7. BGA Ticket Closure Draft (`#95874`)

> **NEVER** post comments or change BGA ticket status without explicit user approval after production deploy!

- **#95874** (`acknowledged` -> `implemented`):
  - `Implemented in release <YYMMDD-HHMM> (now live). Tichu now uses a polyphonic Web Audio pool backed by BGA's sounds/ folder with dedicated sound effects for card plays, passes, bombs, trick captures, Mahjong wishes, and Tichu / Grand Tichu calls, plus a new Sound Effects user preference (no page reload required). Rapid back-to-back plays now layer cleanly instead of cutting off or dropping — thanks again for the suggestion!`
