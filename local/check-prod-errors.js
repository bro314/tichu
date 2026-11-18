async () => {
  // Fast read-only BGA Studio production error & version check for Tichu.
  // Read this file and pass its contents as `function` (format: "function", waitForStableDom: false)
  // to chrome-devtools MCP evaluate_script on https://studio.boardgamearena.com/studiogame?game=tichu.
  const bodyText = document.body?.innerText ?? "";
  if (
    !window.bgaConfig &&
    /undergoing maintenance|currently experiencing high traffic/i.test(bodyText)
  ) {
    return {
      ok: false,
      error: "BGA_MAINTENANCE",
      url: window.location.href,
      message: bodyText.trim().slice(0, 300),
    };
  }

  if (
    window.location.pathname.includes("/account") ||
    (!window.bgaConfig?.requestToken &&
      Boolean(document.querySelector('input[type="password"], #username_input')))
  ) {
    return { ok: false, error: "AUTH_REQUIRED", url: window.location.href };
  }

  const token = window.bgaConfig?.requestToken ?? "";

  async function studioPost(path, params, timeoutMs = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Request-Token": token,
        },
        body: new URLSearchParams(
          Object.entries(params).filter(([, v]) => v !== null && v !== undefined),
        ),
      });
      const text = await res.text();
      if (!text) return { empty: true, status: res.status };
      const json = JSON.parse(text);
      if (json?.status !== 1) return { error: json, status: res.status };
      return { data: json.data };
    } catch (err) {
      return { error: String(err) };
    } finally {
      clearTimeout(timer);
    }
  }

  const [versionsRes, issuesRes, syntaxRes] = await Promise.all([
    studioPost("/studiogame/studiogame/getStudioGameVersions.html", { game: "tichu" }),
    studioPost("/studioissues/studioissues/getIssues.html", {
      game: "tichu",
      project: "gameserver,gameserver-js",
      sort: "date",
      timespan: "7d",
    }),
    studioPost("/studio/project/getSyntaxErrorsFromProduction.html", { game: "tichu" }),
  ]);

  const authFailed = [versionsRes, issuesRes].some((r) =>
    /logged|auth|permission|denied/i.test(JSON.stringify(r?.error ?? "")),
  );
  if (authFailed && !versionsRes?.data && !issuesRes?.data) {
    return {
      ok: false,
      error: "AUTH_REQUIRED",
      url: window.location.href,
      details: versionsRes?.error ?? issuesRes?.error,
    };
  }

  const rawIssues = issuesRes?.data?.payload ?? [];
  const cutoffMs = Date.now() - 48 * 3600 * 1000;
  const recentIssues = rawIssues.filter((it) => {
    const ts = Date.parse(it.lastSeen || it.firstSeen || "");
    return Number.isFinite(ts) && ts >= cutoffMs;
  });

  const detailedRecentIssues = await Promise.all(
    recentIssues.slice(0, 10).map(async (it) => {
      const detailRes = await studioPost("/studioissues/studioissues/getIssueDetails.html", {
        id: it.id,
      });
      const eventId = detailRes?.data?.eventId ?? "recommended";
      const eventRes = await studioPost("/studioissues/studioissues/getEventDetails.html", {
        issue: it.id,
        event: eventId,
        game: "tichu",
      });
      const ev = eventRes?.data ?? {};
      const entries = Array.isArray(ev.entries) ? ev.entries : [];
      const excEntry = entries.find((e) => e.type === "exception");
      const reqEntry = entries.find((e) => e.type === "request");
      const frames =
        excEntry?.data?.values?.[0]?.stacktrace?.frames
          ?.filter((f) => String(f.filename || "").includes("tichu"))
          ?.map((f) => ({
            function: f.function,
            filename: f.filename,
            lineno: f.lineno,
            colno: f.colno,
          })) ?? [];
      return {
        id: String(it.id),
        shortId: it.shortId,
        platform: it.platform,
        level: it.level,
        priority: it.priority,
        type: it.type,
        title: it.title,
        culprit: it.culprit,
        count: Number(it.count ?? 0),
        userCount: Number(it.userCount ?? 0),
        firstSeen: it.firstSeen,
        lastSeen: it.lastSeen,
        release: ev.release?.version ?? detailRes?.data?.release ?? null,
        requestUrl: reqEntry?.data?.url ?? null,
        requestQuery: reqEntry?.data?.query ?? null,
        tags: ev.tags ?? [],
        gameFrames: frames,
      };
    }),
  );

  const syntaxHtml = typeof syntaxRes?.data === "string" ? syntaxRes.data : "";
  const syntaxErrors = [];
  const detailsRegex =
    /<details>\s*<summary>([\s\S]*?)<\/summary>\s*<pre>([\s\S]*?)<\/pre>\s*<\/details>/gi;
  let match;
  while ((match = detailsRegex.exec(syntaxHtml)) !== null) {
    const server = match[1].replace(/<[^>]+>/g, "").trim();
    const log = match[2].replace(/<[^>]+>/g, "").trim();
    if (log && !/No error log yet for this game on this gameserver/i.test(log)) {
      syntaxErrors.push({ server, log: log.slice(0, 2000) });
    }
  }

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    productionVersion: versionsRes?.data?.["production-version"] ?? null,
    availableVersions: (versionsRes?.data?.versions ?? []).slice(0, 5),
    recentIssues48h: detailedRecentIssues,
    weekSummary: rawIssues.slice(0, 15).map((it) => ({
      id: String(it.id),
      platform: it.platform,
      type: it.type,
      title: it.title,
      count: Number(it.count ?? 0),
      lastSeen: it.lastSeen,
    })),
    syntaxServerCheckOk: Boolean(syntaxHtml),
    syntaxErrors,
  };
}