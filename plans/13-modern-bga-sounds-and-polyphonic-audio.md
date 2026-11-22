# 13 — Modern `sounds/` Directory, Polyphonic Audio Pool & Preference 107

- **Priority**: P2
- **Recommended Roadmap Day**: Day 6
- **Scope**: `sounds/{card_play,pass,bomb,trick_collect,mahjong_wish,tichu_laser}.{mp3,ogg}`, `tichu_tichu.tpl` (retained 1-release fallback), `gameoptions.inc.php`, `src/audio-manager.ts`, `src/tichu.ts`, `src/elements/game-model.ts`, `src/elements/tichu-hand.ts`, `src/studio-test.ts`, `local/sftp-sync.sh`, `local/router.php`, `local/js/bga-shim.js`, `tests/combo-validator.test.ts`
- **Open BGA Tickets / Prod Issues Covered**: [#95874](https://boardgamearena.com/bug?id=95874) (1 vote, `acknowledged`, table `406887503` — _"Fast gameplay means audio associated with game actions does not always play"_)
- **Estimated Effort**: Medium (1–2 days: crisp `< 25 KB` audio asset creation, Web Audio `AudioBufferSourceNode` pool + fallbacks, Pref `107` two-way sync, local runner parity, and tests)
- **Dependencies & Shared ID Reservations**: Supersedes Track 3 of legacy `plans/12-logs-accessibility-sounds-and-stats.md` (archived in [00-roadmap-index.md](file:///Users/brohlfs/git/tichu/plans/00-roadmap-index.md)) and the `sounds/` migration of legacy `plans/13-modern-bga-frontend-esm-and-sound-cleanup.md` (archived in [00-roadmap-index.md](file:///Users/brohlfs/git/tichu/plans/00-roadmap-index.md)). Uses **User Preference `107`** (`Sound Effects`, `needReload => false`, `1 => enabled`, `2 => disabled`) — never `105` (`Animations`), `106` (Plan 06), or `108` (Plan 14). Keeps `tichu_tichu.tpl` + `img/tichu_laser.*` across one release cycle before Plan 18 deletes `tichu_tichu.tpl` & `tichu.view.php`.

---

## 1. Why & Goal

Inspecting BGA's runtime in [`bga-platform/js/modules/layer/ly_studio.js`](file:///Users/brohlfs/git/tichu/bga-platform/js/modules/layer/ly_studio.js) reveals the two exact root causes behind [#95874](https://boardgamearena.com/bug?id=95874):

1. **Single-`<audio>` Node Interruption**: BGA's `BgaSoundService.playFile(e)` (`ly_studio.js:20798-20804`) reuses one DOM element (`document.getElementById(this.getSoundTag(e))`), sets `t.currentTime = 0`, and calls `t.play()`. Firing the same cue twice in rapid succession truncates or drops the overlapping clip, and `local/js/bga-shim.js:209-214` mimics the exact same bottleneck.
2. **Platform `move` Chime Batching + Minimal Cue Set**: `GameNotifQueue.dispatchNotifications()` (`ly_studio.js:20222`) passes a per-drain `bMoveSoundPlayed` flag (`i`) into `dispatchNotification(t, i)` (`ly_studio.js:20411-20416`), playing `"move"` at most once per notification batch while dropping chimes for rapid plays/passes. Meanwhile Tichu itself only plays a single `tichu_laser` clip (`src/tichu.ts:335-340`).

**Goal**: Migrate audio discovery to BGA's modern `sounds/` directory with 6 short, tactile `.mp3` + `.ogg` cues (`card_play`, `pass`, `bomb`, `trick_collect`, `mahjong_wish`, `tichu_laser`), build a lightweight polyphonic `TichuAudioManager` (Web Audio `AudioBufferSourceNode` pooling + `Audio` clone fallback + `38ms` per-cue debounce), gate strictly via `!this.instantaneousMode && !document.hidden && (this.bgaAnimationsActive?.() ?? true) && prefSoundEnabled && !isBgaMuted` (decoupled from Animations Preference `105`), and wire zero-reload **Preference `107`** cleanly across BGA Settings, `<tichu-hand>`, and `local/`.

---

## 2. Current Codebase Reality (Line-Accurate Audit)

| Surface / File                                                                                               | Verified Location & Symbols                                                          | Current Behavior / Gap                                                                                                                                       |
| :----------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`tichu_tichu.tpl`](file:///Users/brohlfs/git/tichu/tichu_tichu.tpl#L3-L6)                                   | `#audiosrc_{tichu_laser,o_tichu_laser,tichu_tichu_laser,o_tichu_tichu_laser}`        | Hardcodes 4 `<audio preload="none">` tags pointing to `img/tichu_laser.{mp3,ogg}`; no `sounds/` dir exists yet.                                              |
| [`img/tichu_laser.*`](file:///Users/brohlfs/git/tichu/img)                                                   | `tichu_laser.mp3` (`29,327 B`), `tichu_laser.ogg` (`11,488 B`)                       | Only sound files in repo; must stay in `img/` for 1 release cycle alongside `sounds/tichu_laser.*`.                                                          |
| [`gameoptions.inc.php`](file:///Users/brohlfs/git/tichu/gameoptions.inc.php#L74-L135)                        | `$game_preferences[100..105]`                                                        | Defines `100..105` (`105` = `Animations`); ID `107` is unallocated and reserved for `Sound Effects`.                                                         |
| [`src/tichu.ts`](file:///Users/brohlfs/git/tichu/src/tichu.ts#L280-L448)                                     | `areAnimationsActive`, `playLaserSound`, `readPrefs`, `onPreferenceChange`           | Only `notif_grandTichuBet` (`L1724`) & `notif_tichuBet` (`L1755`) play sound (inside `if (this.areAnimationsActive())`).                                     |
| [`src/elements/game-model.ts`](file:///Users/brohlfs/git/tichu/src/elements/game-model.ts#L69-L568)          | `LiveGamePrefs`, `LiveGameState`, `hydrateFromGamedatas`                             | Tracks `animationsEnabled` (`105`) and `100..104`; lacks `soundEnabled` (`107`) state & `soundEnabled$` selector.                                            |
| [`src/elements/tichu-hand.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-hand.ts#L197-L293)         | `#prefs` bar, `onAnimationsClick` (`L373-L380`)                                      | Exposes `[Enable/Disable animations]` (`105`) and `[Tiki/Standard]` (`103`), but no sound toggle (`107`).                                                    |
| [`src/studio-test.ts`](file:///Users/brohlfs/git/tichu/src/studio-test.ts#L3880-L4437)                       | `#devbar_mute` (`L3880`, `L4090`, `L4248`, `L4432-L4437`)                            | Toggles `localStorage.tichu_local_mute` on localhost only; tooltip (`L3844`) still mentions only laser sound.                                                |
| [`local/sftp-sync.sh`](file:///Users/brohlfs/git/tichu/local/sftp-sync.sh#L31-L61)                           | `is_deployable()` (`L34`), `--all` `FILES` (`L45-L61`)                               | Allows `img/*` only; drops `sounds/*` in explicit uploads, `git status` auto-sync, and `--all`.                                                              |
| [`local/router.php`](file:///Users/brohlfs/git/tichu/local/router.php#L11-L76)                               | `$mimeTypes` (`L23-L24`), static serving (`L37-L76`), `$bootstrapData` (`L565`)      | Has `mp3`/`ogg` MIME entries for `/tichu/*`, but doesn't populate `soundFormats` / `preloadedSounds` in init payload.                                        |
| [`local/js/bga-shim.js`](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L206-L230)                     | `window.playSound` (`L206`), `DEFAULT_PREFS` (`L1736`), `bootGameInstance` (`L4497`) | `playSound` hardcodes `img/<sound>.mp3`; `DEFAULT_PREFS` & `bootGameInstance` only seed `[100..105]`.                                                        |
| [`tests/combo-validator.test.ts`](file:///Users/brohlfs/git/tichu/tests/combo-validator.test.ts#L2229-L2365) | `Animations preference (105)` (`L2229-L2365`)                                        | Asserts `g.playSound` fires even when `105=2` (decoupled from Animations) and stays muted when hidden/`instantaneousMode`; fallback must preserve this test. |

**Verified BGA Platform Internals (`ly_studio.js`)**: `ebg/gameui/Sounds::getSoundUrl(id)` (`L28345-L28350`) reads `globalThis.bgaGameData.soundFormats[id]` -> `${g_gamethemeurl}sounds/${id}.${ogg|mp3}`; `BgaInternalSounds::ensureSoundLoading()` (`L28361-L28382`) preloads `bgaGameData.preloadedSounds` unless `this.sounds.dontPreloadSounds(...)` is called; global mute/volume live on `globalThis.bgaSoundService.{bMuteSound,volume}` (`L20752-L20754`, `L20828-L20831`) and `localStorage.sound_muted` / `sound_volume`.

---

## 3. Architectural Decisions & Trade-offs

1. **Audio Engine Placement & Pooling (`src/audio-manager.ts`)**:
   - **Recommended**: Implement `TichuAudioManager` in `src/audio-manager.ts` imported directly by `src/tichu.ts` (avoiding the ES5/ES6 `import type` restriction on `src/elements/` per `AGENTS.md:103` while working inside both `tichu.js` and `tests/combo-validator.test.ts`). Decode clips once into an in-memory `Map<SoundCue, AudioBuffer>` and spawn ephemeral `AudioBufferSourceNode` -> `GainNode` -> `ctx.destination` instances per play (zero voice starvation up to a soft cap of 12 concurrent nodes). If `AudioContext` is missing/suspended (pre-gesture load), fall back to pooled/cloned `new Audio(url)` (`<= 4` clones per cue, `.play().catch(() => {})`); if neither `AudioContext` nor `Audio` exists (e.g., Node tests), delegate to `globalThis.playSound?.(cue)`.
   - _Alternative rejected_: Using BGA `this.sounds.play()` / `playSound()` directly — single-`<audio>` tag reuse recreates #95874's cutoff bug (`ly_studio.js:20798-20804`).
2. **Per-Cue Debounce & Platform `"move"` Sound Coordination**:
   - **Recommended**: Enforce a **38 ms per-cue debounce** (`now - lastPlayedAt[cue] < 38`) inside `TichuAudioManager.play(cue)` so rapid distinct events (`tichu_laser` + `card_play` + `mahjong_wish`) layer cleanly in parallel (#95874) while bursts of identical notifications don't clip. Whenever `playSoundCue()` actually triggers a sound on a logged notification (`playCombo`, `pass`, `captureCards`, `wishMade`, `grandTichuBet`, `tichuBet`, `passCards`, `acceptCards`), call `this.disableNextMoveSound?.()` (`ly_studio.js:22101-22103`) so BGA's generic `"move"` bloop doesn't collide with Tichu's custom SFX. Leave `"move"` untouched when Pref `107 = 2` (disabled).
3. **Preload Strategy & 1-Release `tichu_tichu.tpl` Overlap**:
   - **Recommended**: Call `this.sounds?.dontPreloadSounds?.(TICHU_SOUND_CUES)` during `setup()` so `BgaInternalSounds` (`ly_studio.js:28361`) never stalls page load for 3s per sound or creates duplicate `#audiosrc_tichu_laser` IDs, while `TichuAudioManager` uses `bgaGameData.soundFormats` for URL/codec selection (preferring `.ogg` when `Audio.canPlayType('audio/ogg; codecs="vorbis"')`, else `.mp3`) and pre-fetches buffers lazily after first interaction / idle. Keep `tichu_tichu.tpl` and `img/tichu_laser.{mp3,ogg}` intact across this release until Plan 18 deletes `tichu_tichu.tpl` & `tichu.view.php`.
4. **Preference `107` Ownership & Mute Precedence**:
   - **Recommended**: Register `$game_preferences[107]` (`Sound Effects`, `needReload => false`, `1 => enabled` default, `2 => disabled`) in `gameoptions.inc.php`, mirror it into `GameModel.soundEnabled$`, expose `[Enable/Disable sound effects]` in `<tichu-hand>` `#prefs`, and honor BGA's global speaker mute (`bgaSoundService?.bMuteSound === true || localStorage.sound_muted === "1" || localStorage.tichu_local_mute === "1"`) and volume (`bgaSoundService?.volume`, default `0.7`).

---

## 4. 4-Way Live-Game Compatibility & Concurrency Audit

1. **`OLD DB -> NEW PHP + NEW JS`**: No `dbmodel.sql`, `upgradeTableDb()`, `states.inc.php`, `global` IDs, or `stats.inc.php` changes. On pre-deploy tables where `#preference_control_107` or `this.prefs[107]` is absent, `safeGetPref(107, 1)` returns `1` (`enabled`) without throwing.
2. **`OLD open JS tab <-> NEW PHP`**: PHP actions, `getAllDatas()`, and notifications are 100% unchanged. Because `tichu_tichu.tpl` (`lines 3-6`) and `img/tichu_laser.{mp3,ogg}` remain deployed across this release cycle, open `OLD` tabs still play `tichu_laser` via `<audio id="audiosrc_tichu_laser">` with zero 404s.
3. **`NEW open JS tab <-> OLD PHP` (Rollback)**: If rolled back to a build lacking `sounds/` and Pref `107`, `safeGetPref(107, 1)` defaults cleanly to `1`, `TichuAudioManager` caches failed `sounds/` URLs in `failedUrls: Set<string>` (no repeated 404 spam per turn), and `tichu_laser` falls back to `img/tichu_laser.{ogg,mp3}` / `playSound("tichu_laser")`. Audio fetch errors are swallowed silently and never alter `notifqueue.setSynchronousDuration(...)`.
4. **`NEW DB / actionlog -> OLD PHP + OLD JS` (Rollback)**: Zero new `actionlog` event names, notification types, or DB rows are written.

- **Concurrency & Locking Invariants**: Client-only feature + `gameoptions.inc.php` pref; zero new mutating PHP actions, so `acquireGameLock()`, `acquireGameLockOrFail()`, `syncStaleReturnState()`, and `GLOBAL_LOCK_VERSION = 30` remain untouched.
- **`@thoun` `player_pass` Invariants**: Untouched; `pass` audio plays reactively on `notif_pass` after `stNextPlayer()` evaluates `player_pass`.
- **`<tichu-replay>` & Fast-Forward Safety**: During `g_replayFrom` catch-up, `this.instantaneousMode === true` mutes all cues automatically; `<tichu-replay>` (`src/elements/tichu-replay.ts`) steps `Model` directly without triggering `notif_*` audio.
- **`local/import-bug-sql.php` 7-Surface Impact**: Surface 1 (`applyPlayerIdSqlPhase`, `L660-L664`) already remaps `bga_user_preferences.pgp_player` for all preference IDs; no importer changes needed.
- **Studio `workspace.blocked-files` Compliance**: Zero filesystem/reflection/`bga_*` PHP calls added; audio cue list is static in TS (`sounds/*.{mp3,ogg}` are allowlisted media assets).

---

## 5. Step-by-Step Implementation Blueprint

1. **Create `sounds/` Audio Assets**:
   - Copy `img/tichu_laser.{mp3,ogg}` -> `sounds/tichu_laser.{mp3,ogg}` (retain `img/tichu_laser.*` and `tichu_tichu.tpl` until Plan 18).
   - Add crisp, open-licensed (CC0) short cues (`80–450 ms`, normalized `-3 dBFS`, each `< 25 KB` in both `.mp3` and `.ogg`): `sounds/card_play.{mp3,ogg}` (crisp snap), `sounds/pass.{mp3,ogg}` (soft brush), `sounds/bomb.{mp3,ogg}` (punchy thud), `sounds/trick_collect.{mp3,ogg}` (warm gather chime), `sounds/mahjong_wish.{mp3,ogg}` (bright ping).
2. **Add Preference `107` (`gameoptions.inc.php`, `game-model.ts`, `tichu-hand.ts`)**:
   - In [`gameoptions.inc.php`](file:///Users/brohlfs/git/tichu/gameoptions.inc.php#L134), append `$game_preferences[107]`: `"name" => totranslate("Sound Effects")`, `"needReload" => false`, `"values" => [1 => ["name" => totranslate("enabled")], 2 => ["name" => totranslate("disabled")]]`, `"default" => 1`.
   - In [`src/elements/game-model.ts`](file:///Users/brohlfs/git/tichu/src/elements/game-model.ts): add `soundEnabled?: boolean` to `LiveGamePrefs` (`L69-L78`), `soundEnabled: boolean` to `LiveGameState` (`L80-L120`, default `true` in `L134-L180`), `public readonly soundEnabled$ = select(this.state$, (s) => s.soundEnabled)` (`~L294`), resolve `prefs?.[107]` in `hydrateFromGamedatas()` (`~L503`), and add `setSoundEnabled(enabled: boolean)` (`~L1288`).
   - In [`src/elements/tichu-hand.ts`](file:///Users/brohlfs/git/tichu/src/elements/tichu-hand.ts): subscribe to `window.gameModel.soundEnabled$`, add `#enable_sounds` / `#disable_sounds` links inside `#prefs` (`~L285`) calling `ui.changeSoundEffects(enabled)`.
3. **Implement Polyphonic Pool (`src/audio-manager.ts`)**:
   - Export `type SoundCue = "card_play" | "pass" | "bomb" | "trick_collect" | "mahjong_wish" | "tichu_laser"` and `class TichuAudioManager`:
     - Select format from `globalThis.bgaGameData?.soundFormats?.[cue]` vs `canPlayType('audio/ogg; codecs="vorbis"')`, building `${g_gamethemeurl}sounds/${cue}.${ext}` (with fallback to `img/tichu_laser.${ext}` if `cue === "tichu_laser"` fails).
     - `unlock()` via one-time passive `pointerdown`/`keydown` listeners (`AudioContext` resume + idle warm-up fetch of the 6 buffers).
     - `play(cue, volume = 0.7)`: enforce `38 ms` per-cue debounce (`lastPlayMs.get(cue)`), bail if `failedUrls.has(url)`, spawn a fresh `AudioBufferSourceNode` connected through a shared `GainNode` when `AudioContext` is `"running"` (capped at `12` active sources), else use cloned `new Audio(url)` (`<= 4` active clones/cue), else call `globalThis.playSound?.(cue)`.
4. **Integrate Gating & Notification Cues (`src/tichu.ts`)**:
   - Instantiate `private audioManager = new TichuAudioManager()`, wire `this.audioManager.bindUnlock()` + `this.sounds?.dontPreloadSounds?.(...)` in `setup()` (`L675-L712`).
   - Update `readPrefs()` (`L382-L416`) to include `107: this.safeGetPref(107, 1)` + `soundEnabled: pref107 !== 2`; add `case 107:` in `onPreferenceChange()` (`L422-L448`) calling `onSoundEffectsChange(val !== 2)` and add `changeSoundEffects(enabled)` (`persistUserPreference(107, enabled ? 1 : 2)`).
   - Add `isBgaSoundMuted()` / `getBgaSoundVolume()` checking `(window as any).bgaSoundService` + `localStorage.{sound_muted,sound_volume,tichu_local_mute}`, and `canPlaySounds()` enforcing:
     `!this.instantaneousMode && !document.hidden && (this.bgaAnimationsActive?.() ?? true) && prefSoundEnabled && !this.isBgaSoundMuted() && !Boolean((this as any).bDisableSoundOnMove)` (never gating sound on Animations Preference `105`).
   - Replace `playLaserSound()` (`L335-L340`) with `playSoundCue(cue: SoundCue, suppressPlatformMoveSound = true)` (calling `playLaserSound()` -> `this.playSoundCue("tichu_laser")`). Fire cues in:
     - `notif_playCombo` (`L1612`): `isBomb ? "bomb" : "card_play"` (`comboType === 7 || this.stateName === "playBomb" || comboName.toLowerCase().includes("bomb")`)
     - `notif_pass` (`L1678`): `"pass"`
     - `notif_captureCards` (`L1687`): `"trick_collect"`
     - `notif_wishMade` (`L1826`): `"mahjong_wish"` when `wish >= 2 && wish <= 14`
     - `notif_grandTichuBet` (`L1721`) & `notif_tichuBet` (`L1752`): move `this.playLaserSound()` outside `if (this.areAnimationsActive())` so gating flows uniformly through `canPlaySounds()` (retaining splash timing under `areAnimationsActive()`).
5. **Update Local Dev & Deploy Tooling**:
   - [`local/sftp-sync.sh`](file:///Users/brohlfs/git/tichu/local/sftp-sync.sh#L34-L61): add `sounds/*` to `is_deployable()` (`L34`) and `sounds/*.mp3 sounds/*.ogg` (guarded by `compgen -G` / `nullglob`) to `--all`.
   - [`local/router.php`](file:///Users/brohlfs/git/tichu/local/router.php#L37-L76): serve `/sounds/*` with explicit `Content-Type` + `Cache-Control` and inject `soundFormats` / `preloadedSounds` into `$bootstrapData`, `/local/state`, `/local/new-game`, and `/local/test-scenario`.
   - [`local/js/bga-shim.js`](file:///Users/brohlfs/git/tichu/local/js/bga-shim.js#L206-L230): add `107: 1` to `DEFAULT_PREFS`, `this.prefs`, and `bootGameInstance`; expose `window.bgaGameData.soundFormats`/`preloadedSounds` + `window.bgaSoundService` synced with `tichu_local_mute`; update `window.playSound()` (`L206-L221`) to resolve `sounds/<id>.{ogg,mp3}` before `img/<id>.mp3`.
   - [`src/studio-test.ts`](file:///Users/brohlfs/git/tichu/src/studio-test.ts#L3844): update `tips.mute` copy and ensure `#devbar_mute` updates `window.bgaSoundService.bMuteSound` if present.
6. **Add Tests (`tests/combo-validator.test.ts`)**:
   - Extend the `Animations preference (105)` suite and add unit tests for `TichuAudioManager` (mock `AudioContext`, 38ms per-cue debounce, distinct cues layering concurrently, 404 negative-cache fallback, `tichu_laser` rollback fallback, and Pref `107` / `instantaneousMode` / `document.hidden` / `bgaSoundService.bMuteSound` gating while staying enabled when Pref `105 = 2`).

---

## 6. Verification Checklist & Regression Tests

- [ ] **Assets**: All 6 cue pairs exist in `sounds/` (`.mp3` + `.ogg`), new cues `< 25 KB` each, and `img/tichu_laser.{mp3,ogg}` + `tichu_tichu.tpl` remain intact for 1-release overlap.
- [ ] **Automated Suites**: `npm run build` (`npm test` + `tsc` + `esbuild`), `npm run test:contracts`, `npm run phpstan`, and `npm run test:validator` (verifying Pref `105`, Pref `107`, debounce, polyphony, and gating) all pass cleanly.
- [ ] **Local Runner (`npm run local`)**: Play rapid combos, passes, bombs, Dragon/trick captures, Mahjong wish `2..14`, and Tichu/Grand Tichu calls; confirm overlapping clips play without cutoff, `#devbar_mute` + `#enable_sounds`/`#disable_sounds` work live without reload, and `tt.runSuite({ speed: "instant" })` plays zero audio (`0` 404s in Network tab).
- [ ] **BGA Studio Verification**: Sync via `npm run deploy:sftp:all`, click `Reload game options configuration` in Control Panel, verify `sounds/*` served with `"Use minified JS"` + `"Use minified CSS"` ON (and `Revert` both afterward), verify BGA speaker mute & Pref `107` dropdown sync live without reload, and verify `&dummyTranslations` wraps `[Enable/Disable sound effects]` cleanly.

---

## 7. BGA Ticket Closure & Kickoff Prompt

- **Ticket Status Transition (ONLY after explicit user confirmation + production deploy!)**:
  - [#95874](https://boardgamearena.com/bug?id=95874): `acknowledged` -> `implemented` (suggestion).
- **Plain-Text Reply Draft for [#95874](https://boardgamearena.com/bug?id=95874)** _(no Markdown backticks; NEVER post on BGA without explicit user approval)_:
  > Implemented in release <YYMMDD-HHMM> (now live). Tichu now uses a polyphonic Web Audio pool backed by BGA's sounds/ folder with dedicated crisp sound effects for card plays, passes, bombs, trick captures, Mahjong wishes, and Tichu / Grand Tichu calls, plus a new Sound Effects user preference (no page reload required). Rapid back-to-back plays now layer cleanly instead of cutting off or dropping — thanks again for the suggestion!

### Kickoff Prompt for a Fresh Agent

```text
Read /Users/brohlfs/git/tichu/AGENTS.md, /Users/brohlfs/git/tichu/plans/13-modern-bga-sounds-and-polyphonic-audio.md, /Users/brohlfs/git/tichu/gameoptions.inc.php, /Users/brohlfs/git/tichu/src/tichu.ts, /Users/brohlfs/git/tichu/src/elements/game-model.ts, /Users/brohlfs/git/tichu/src/elements/tichu-hand.ts, /Users/brohlfs/git/tichu/local/sftp-sync.sh, /Users/brohlfs/git/tichu/local/router.php, and /Users/brohlfs/git/tichu/local/js/bga-shim.js.
Implement Steps 1–6 strictly using User Preference 107 (never 105), keeping tichu_tichu.tpl and img/tichu_laser.{mp3,ogg} across this release for 4-way live-tab & rollback safety.
Run npm run build, npm run test:contracts, npm run phpstan, and test audio polyphony, mute/pref gating, and zero 404s on npm run local and BGA Studio (with minified JS/CSS toggled). Do NOT deploy to production or update BGA bug #95874 without explicit user approval.
```
