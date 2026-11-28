<?php
/**
 * Local-only Mobile Viewport Preview Shell (/mobile).
 * Renders localhost:8080 inside a centered, resizable <iframe> so @media queries,
 * vw/vh units, clientHeight, position: fixed, and <dialog> behave like a real phone.
 *
 * Expects from local/router.php:
 *   $viewerPlayerId (int), $isSpectator (bool), $devBarPlayers (array), $scenarios (string[])
 */
$viewerPlayerId = isset($viewerPlayerId) ? (int) $viewerPlayerId : 0;
$isSpectator = isset($isSpectator) ? (bool) $isSpectator : false;
$devBarPlayers = isset($devBarPlayers) && is_array($devBarPlayers) ? $devBarPlayers : [];
$scenarios = isset($scenarios) && is_array($scenarios) ? $scenarios : [];

$scenarioLabels = [
  'grand_tichu' => 'grand_tichu — Grand Tichu Bets',
  'give_cards' => 'give_cards — Pass 3 Cards (Bomb Completed)',
  'mahjong_wish' => 'mahjong_wish — Mahjong Wish & Fulfill',
  'phoenix_ambiguous' => 'phoenix_ambiguous — Phoenix Straight',
  'bomb_interrupt' => 'bomb_interrupt — Out-of-Turn Bomb Interrupt',
  'dragon_gift' => 'dragon_gift — Dragon Trick Gift',
  'double_victory' => 'double_victory — Double Victory Round End',
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tichu — Mobile Viewport Preview</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background: #0d1117;
      color: #e6edf3;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 12px;
    }
    #mp-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #161b22;
      border-bottom: 1px solid #30363d;
      padding: 7px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
    }
    .mp-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .mp-group {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }
    .mp-brand {
      font-weight: 700;
      font-size: 13px;
      color: #58a6ff;
      white-space: nowrap;
      margin-right: 4px;
    }
    .mp-divider {
      width: 1px;
      height: 20px;
      background: #30363d;
      margin: 0 2px;
    }
    .mp-label {
      color: #8b949e;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .mp-btn,
    .mp-seat {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 5px;
      border: 1px solid #30363d;
      background: #21262d;
      color: #c9d1d9;
      font-family: inherit;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      white-space: nowrap;
      user-select: none;
    }
    .mp-btn:hover,
    .mp-seat:hover {
      background: #30363d;
      border-color: #8b949e;
      color: #ffffff;
    }
    .mp-btn.is-active,
    .mp-seat.is-active {
      background: #1f6feb;
      border-color: #58a6ff;
      color: #ffffff;
    }
    .mp-btn.is-toggle-on {
      background: #238636;
      border-color: #2ea043;
      color: #ffffff;
    }
    .mp-btn.bot-btn {
      background: #2d333b;
      border-color: #444c56;
      color: #79c0ff;
    }
    .mp-btn.danger-btn {
      border-color: #da3633;
      color: #ff7b72;
    }
    .mp-btn.danger-btn:hover {
      background: #da3633;
      color: #ffffff;
    }
    .mp-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .mp-color-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.5);
      display: inline-block;
    }
    .mp-input {
      width: 60px;
      height: 25px;
      background: #0d1117;
      color: #e6edf3;
      border: 1px solid #30363d;
      border-radius: 4px;
      padding: 2px 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11.5px;
      text-align: center;
    }
    .mp-select {
      height: 25px;
      background: #0d1117;
      color: #e6edf3;
      border: 1px solid #30363d;
      border-radius: 4px;
      padding: 2px 6px;
      font-family: inherit;
      font-size: 11.5px;
    }
    .mp-checkbox-label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #c9d1d9;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
    }
    #mp_diag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border-radius: 5px;
      border: 1px solid #30363d;
      background: #0d1117;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: #c9d1d9;
      white-space: nowrap;
    }
    .mp-badge {
      padding: 1px 6px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 10.5px;
    }
    .mp-badge.ok {
      background: rgba(46, 160, 67, 0.22);
      color: #3fb950;
      border: 1px solid rgba(63, 185, 80, 0.45);
    }
    .mp-badge.warn {
      background: rgba(248, 81, 73, 0.22);
      color: #ff7b72;
      border: 1px solid rgba(248, 81, 73, 0.45);
    }
    .mp-badge.info {
      background: rgba(88, 166, 255, 0.16);
      color: #79c0ff;
      border: 1px solid rgba(88, 166, 255, 0.35);
    }

    #mp-stage {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 16px 24px 32px;
      min-height: calc(100vh - 76px);
      overflow-x: auto;
    }
    #mp-bezel {
      position: relative;
      padding: 12px;
      border-radius: 24px;
      background: #161b22;
      border: 2px solid #30363d;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65);
      display: inline-flex;
      align-items: stretch;
    }
    #mp-viewport {
      position: relative;
      overflow: hidden;
      border-radius: 14px;
      background: #ffffff;
      border: 1px solid #010409;
    }
    #mp-iframe {
      display: block;
      border: 0;
      background: #ffffff;
      transform-origin: 0 0;
    }
    #mp-resize-handle {
      position: absolute;
      top: 24px;
      bottom: 24px;
      right: -10px;
      width: 14px;
      cursor: ew-resize;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #mp-resize-handle::after {
      content: "";
      width: 4px;
      height: 48px;
      border-radius: 2px;
      background: #484f58;
      transition: background 0.12s ease;
    }
    #mp-resize-handle:hover::after,
    body.is-resizing #mp-resize-handle::after {
      background: #58a6ff;
    }
    body.is-resizing {
      user-select: none;
      cursor: ew-resize;
    }
    body.is-resizing #mp-iframe {
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="mp-toolbar">
    <div class="mp-row">
      <div class="mp-group">
        <span class="mp-brand">📱 Tichu Mobile Preview</span>
        <a id="mp_desktop_link" class="mp-btn" href="/?as=<?php echo $isSpectator ? 0 : $viewerPlayerId; ?>">← Desktop</a>
        <div class="mp-divider"></div>
        <button type="button" class="mp-btn mp-preset" data-w="360" data-h="800">360×800</button>
        <button type="button" class="mp-btn mp-preset" data-w="375" data-h="667">375×667</button>
        <button type="button" class="mp-btn mp-preset" data-w="390" data-h="844">390×844</button>
        <button type="button" class="mp-btn mp-preset" data-w="412" data-h="915">412×915</button>
        <button type="button" class="mp-btn mp-preset" data-w="500" data-h="800">500×800</button>
        <button type="button" class="mp-btn mp-preset" data-w="740" data-h="1024">740×1024</button>
        <div class="mp-divider"></div>
        <label class="mp-label" for="mp_w">W</label>
        <input id="mp_w" class="mp-input" type="number" min="280" max="1600" value="390" />
        <span class="mp-label">×</span>
        <label class="mp-label" for="mp_h">H</label>
        <input id="mp_h" class="mp-input" type="number" min="280" max="1600" value="844" />
        <button type="button" id="mp_rotate" class="mp-btn" title="Swap width and height">↻ Rotate</button>
        <select id="mp_bga_min" class="mp-select" title="Simulate BGA game_interface_width.min viewport floor">
          <option value="0">Viewport: Native 1:1</option>
          <option value="360">BGA min: 360px (current)</option>
          <option value="500">BGA min: 500px</option>
          <option value="740">BGA min: 740px</option>
          <option value="920">BGA min: 920px (legacy)</option>
        </select>
      </div>
      <div class="mp-group">
        <div id="mp_diag">
          <span id="mp_diag_size">390×844</span>
          <span id="mp_diag_rescale" class="mp-badge info">rescale: —</span>
          <span id="mp_diag_overflow" class="mp-badge ok">✓ 0px overflow</span>
        </div>
      </div>
    </div>

    <div class="mp-row">
      <div class="mp-group" id="mp_seats">
        <span class="mp-label">Seat:</span>
        <?php foreach ($devBarPlayers as $p):
          $pId = (int) ($p['id'] ?? 0);
          $pNo = (int) ($p['no'] ?? 0);
          $pName = htmlspecialchars((string) ($p['name'] ?? "P{$pNo}"), ENT_QUOTES, 'UTF-8');
          $pColor = htmlspecialchars(ltrim((string) ($p['color'] ?? '000000'), '#'), ENT_QUOTES, 'UTF-8');
          $isActiveSeat = !$isSpectator && $pId === $viewerPlayerId;
        ?>
          <button
            type="button"
            class="mp-seat<?php echo $isActiveSeat ? ' is-active' : ''; ?>"
            data-as="<?php echo $pId; ?>"
          >
            <span class="mp-color-dot" style="background: #<?php echo $pColor; ?>;"></span>
            P<?php echo $pNo; ?>: <?php echo $pName; ?>
          </button>
        <?php endforeach; ?>
        <button type="button" class="mp-seat<?php echo $isSpectator ? ' is-active' : ''; ?>" data-as="0">👁 Spectator</button>
      </div>

      <div class="mp-group">
        <select id="mp_scenario_select" class="mp-select">
          <?php foreach ($scenarios as $sc):
            $scEsc = htmlspecialchars($sc, ENT_QUOTES, 'UTF-8');
            $scLabel = htmlspecialchars($scenarioLabels[$sc] ?? $sc, ENT_QUOTES, 'UTF-8');
          ?>
            <option value="<?php echo $scEsc; ?>"><?php echo $scLabel; ?></option>
          <?php endforeach; ?>
        </select>
        <button type="button" id="mp_load_scenario" class="mp-btn">🎬 Load</button>
        <div class="mp-divider"></div>
        <button type="button" id="mp_bot_others" class="mp-btn bot-btn">🤖 Act for Others</button>
        <button type="button" id="mp_bot_step" class="mp-btn bot-btn">🤖 Step 1</button>
        <button type="button" id="mp_new_game" class="mp-btn danger-btn">🔄 New Game</button>
        <div class="mp-divider"></div>
        <button type="button" id="mp_dark" class="mp-btn">🌙 Dark</button>
        <button type="button" id="mp_tiki" class="mp-btn">🗿 Tiki</button>
        <label class="mp-checkbox-label">
          <input type="checkbox" id="mp_show_devbar" />
          Show Dev Bar
        </label>
        <button type="button" id="mp_reload" class="mp-btn">↻ Reload</button>
      </div>
    </div>
  </div>

  <div id="mp-stage">
    <div id="mp-bezel">
      <div id="mp-viewport" style="width: 390px; height: 844px;">
        <iframe id="mp-iframe" title="Tichu Mobile Preview" style="width: 390px; height: 844px;"></iframe>
      </div>
      <div id="mp-resize-handle" title="Drag to resize phone width"></div>
    </div>
  </div>

  <script>
    (function () {
      var STORAGE_KEY = "tichu_mobile_preview_v1";
      var params = new URLSearchParams(window.location.search || "");

      function readStored() {
        try {
          var raw = localStorage.getItem(STORAGE_KEY);
          return raw ? JSON.parse(raw) : {};
        } catch (_e) {
          return {};
        }
      }

      function saveStored(s) {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              w: s.w,
              h: s.h,
              bgaMin: s.bgaMin,
              dark: s.dark,
              showDevBar: s.showDevBar,
            }),
          );
        } catch (_e) {}
      }

      var stored = readStored();
      var state = {
        w: clampInt(params.get("w") || stored.w || 390, 280, 1600),
        h: clampInt(params.get("h") || stored.h || 844, 280, 1600),
        as: params.has("as") ? Number(params.get("as")) : <?php echo $isSpectator ? 0 : $viewerPlayerId; ?>,
        bgaMin: Number(params.has("bgaMin") ? params.get("bgaMin") : (stored.bgaMin ?? 0)),
        dark: params.has("dark") ? params.get("dark") === "1" : Boolean(stored.dark),
        showDevBar: params.has("devbar") ? params.get("devbar") === "1" : Boolean(stored.showDevBar),
      };

      function clampInt(val, min, max) {
        var n = parseInt(val, 10);
        if (isNaN(n)) return min;
        return Math.max(min, Math.min(max, n));
      }

      var iframe = document.getElementById("mp-iframe");
      var viewport = document.getElementById("mp-viewport");
      var wInput = document.getElementById("mp_w");
      var hInput = document.getElementById("mp_h");
      var bgaMinSelect = document.getElementById("mp_bga_min");
      var darkBtn = document.getElementById("mp_dark");
      var tikiBtn = document.getElementById("mp_tiki");
      var devBarCheckbox = document.getElementById("mp_show_devbar");
      var desktopLink = document.getElementById("mp_desktop_link");
      var diagSize = document.getElementById("mp_diag_size");
      var diagRescale = document.getElementById("mp_diag_rescale");
      var diagOverflow = document.getElementById("mp_diag_overflow");

      function buildIframeUrl() {
        var q = new URLSearchParams();
        q.set("as", String(state.as));
        if (state.dark) q.set("dark", "1");
        if (!state.showDevBar) q.set("notestbar", "1");
        return "/?" + q.toString();
      }

      function syncAddressBar() {
        var q = new URLSearchParams();
        q.set("as", String(state.as));
        q.set("w", String(state.w));
        q.set("h", String(state.h));
        if (state.bgaMin > 0) q.set("bgaMin", String(state.bgaMin));
        if (state.dark) q.set("dark", "1");
        if (state.showDevBar) q.set("devbar", "1");
        try {
          window.history.replaceState(null, "", "/mobile?" + q.toString());
        } catch (_e) {}
        desktopLink.setAttribute("href", "/?as=" + state.as + (state.dark ? "&dark=1" : ""));
      }

      function applyFrameGeometry() {
        wInput.value = String(state.w);
        hInput.value = String(state.h);
        bgaMinSelect.value = String(state.bgaMin);
        viewport.style.width = state.w + "px";
        viewport.style.height = state.h + "px";

        if (state.bgaMin > state.w) {
          var scale = state.w / state.bgaMin;
          iframe.style.width = state.bgaMin + "px";
          iframe.style.height = Math.round(state.h / scale) + "px";
          iframe.style.transform = "scale(" + scale.toFixed(4) + ")";
        } else {
          iframe.style.width = state.w + "px";
          iframe.style.height = state.h + "px";
          iframe.style.transform = "";
        }

        var presetBtns = document.querySelectorAll(".mp-preset");
        for (var i = 0; i < presetBtns.length; i++) {
          var btn = presetBtns[i];
          var bw = Number(btn.getAttribute("data-w"));
          var bh = Number(btn.getAttribute("data-h"));
          btn.classList.toggle("is-active", bw === state.w && bh === state.h);
        }

        darkBtn.classList.toggle("is-toggle-on", state.dark);
        devBarCheckbox.checked = state.showDevBar;

        var seatBtns = document.querySelectorAll("#mp_seats .mp-seat");
        for (var j = 0; j < seatBtns.length; j++) {
          var sb = seatBtns[j];
          sb.classList.toggle("is-active", Number(sb.getAttribute("data-as")) === state.as);
        }

        saveStored(state);
        syncAddressBar();
        updateDiagnostics();
      }

      function loadIframe() {
        iframe.src = buildIframeUrl();
      }

      function getInnerWindow() {
        try {
          return iframe.contentWindow || null;
        } catch (_e) {
          return null;
        }
      }

      function updateDiagnostics() {
        var label = state.w + "×" + state.h;
        if (state.bgaMin > state.w) {
          var z = (state.w / state.bgaMin).toFixed(2);
          label += " (" + state.bgaMin + "px @ " + z + "×)";
        }
        diagSize.textContent = label;

        var win = getInnerWindow();
        if (!win || !win.document || !win.document.documentElement) {
          diagRescale.textContent = "rescale: —";
          return;
        }

        var docEl = win.document.documentElement;
        var wrap = win.document.getElementById("game_play_area_wrap");
        var transform = wrap ? wrap.style.transform || "" : "";
        var scaleMatch = transform.match(/scale\(([^)]+)\)/);
        if (scaleMatch) {
          var num = Number(scaleMatch[1]);
          diagRescale.textContent = "rescale: " + (isNaN(num) ? scaleMatch[1] : num.toFixed(2) + "×");
        } else {
          diagRescale.textContent = "rescale: 1.00×";
        }

        var overflowPx = Math.round(docEl.scrollWidth - docEl.clientWidth);
        if (overflowPx > 1) {
          diagOverflow.className = "mp-badge warn";
          diagOverflow.textContent = "⚠ Overflow +" + overflowPx + "px";
        } else {
          diagOverflow.className = "mp-badge ok";
          diagOverflow.textContent = "✓ 0px overflow";
        }

        var ui = win.gameui;
        var gm = win.gameModel && win.gameModel.getState ? win.gameModel.getState() : null;
        var isTiki = gm ? Boolean(gm.isTiki) : Number(ui && ui.prefs && ui.prefs[103] ? ui.prefs[103].value : 2) === 1;
        tikiBtn.classList.toggle("is-toggle-on", isTiki);
      }

      // Preset buttons
      document.addEventListener("click", function (e) {
        var target = e.target;
        if (!(target instanceof Element)) return;
        var preset = target.closest(".mp-preset");
        if (preset) {
          state.w = Number(preset.getAttribute("data-w")) || 390;
          state.h = Number(preset.getAttribute("data-h")) || 844;
          applyFrameGeometry();
          return;
        }
        var seatBtn = target.closest("#mp_seats .mp-seat");
        if (seatBtn) {
          state.as = Number(seatBtn.getAttribute("data-as"));
          applyFrameGeometry();
          loadIframe();
        }
      });

      wInput.addEventListener("change", function () {
        state.w = clampInt(wInput.value, 280, 1600);
        applyFrameGeometry();
      });
      hInput.addEventListener("change", function () {
        state.h = clampInt(hInput.value, 280, 1600);
        applyFrameGeometry();
      });

      document.getElementById("mp_rotate").addEventListener("click", function () {
        var tmp = state.w;
        state.w = state.h;
        state.h = tmp;
        applyFrameGeometry();
      });

      bgaMinSelect.addEventListener("change", function () {
        state.bgaMin = Number(bgaMinSelect.value) || 0;
        applyFrameGeometry();
      });

      darkBtn.addEventListener("click", function () {
        state.dark = !state.dark;
        applyFrameGeometry();
        loadIframe();
      });

      devBarCheckbox.addEventListener("change", function () {
        state.showDevBar = devBarCheckbox.checked;
        applyFrameGeometry();
        loadIframe();
      });

      document.getElementById("mp_reload").addEventListener("click", function () {
        loadIframe();
      });

      tikiBtn.addEventListener("click", function () {
        var win = getInnerWindow();
        if (!win) return;
        var ui = win.gameui;
        var gm = win.gameModel && win.gameModel.getState ? win.gameModel.getState() : null;
        var isTiki = gm ? Boolean(gm.isTiki) : Number(ui && ui.prefs && ui.prefs[103] ? ui.prefs[103].value : 2) === 1;
        var nextVal = isTiki ? 2 : 1;
        if (ui && typeof ui.onPreferenceChange === "function") {
          ui.onPreferenceChange(103, nextVal);
        } else if (win.gameModel && typeof win.gameModel.setTiki === "function") {
          win.gameModel.setTiki(!isTiki);
        }
        updateDiagnostics();
      });

      document.getElementById("mp_load_scenario").addEventListener("click", function () {
        var sel = document.getElementById("mp_scenario_select");
        var scenario = sel.value;
        var win = getInnerWindow();
        if (win && win.tt && typeof win.tt.loadScenario === "function") {
          Promise.resolve(win.tt.loadScenario(scenario)).finally(updateDiagnostics);
          return;
        }
        fetch("/local/scenario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: scenario, as: state.as }),
        }).then(function () {
          loadIframe();
        });
      });

      document.getElementById("mp_bot_others").addEventListener("click", function () {
        var win = getInnerWindow();
        if (win && win.tt && typeof win.tt.actForOthers === "function") {
          Promise.resolve(win.tt.actForOthers()).finally(updateDiagnostics);
        }
      });

      document.getElementById("mp_bot_step").addEventListener("click", function () {
        var win = getInnerWindow();
        if (win && win.tt && typeof win.tt.step === "function") {
          Promise.resolve(win.tt.step(1)).finally(updateDiagnostics);
        }
      });

      document.getElementById("mp_new_game").addEventListener("click", function () {
        fetch("/local/new-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }).then(function () {
          loadIframe();
        });
      });

      // Drag handle to resize phone width
      var handle = document.getElementById("mp-resize-handle");
      handle.addEventListener("mousedown", function (downEvt) {
        downEvt.preventDefault();
        var startX = downEvt.clientX;
        var startW = state.w;
        document.body.classList.add("is-resizing");

        function onMove(moveEvt) {
          var dx = (moveEvt.clientX - startX) * 2;
          state.w = clampInt(Math.round(startW + dx), 320, 1200);
          applyFrameGeometry();
        }

        function onUp() {
          document.body.classList.remove("is-resizing");
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        }

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });

      iframe.addEventListener("load", function () {
        updateDiagnostics();
        setTimeout(updateDiagnostics, 300);
      });
      setInterval(updateDiagnostics, 500);

      applyFrameGeometry();
      loadIframe();
    })();
  </script>
</body>
</html>
