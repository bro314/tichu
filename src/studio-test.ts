/**
 * BGA Studio Console & DOM Test Harness (`window.tt` / `window.tichuTest` + `#studio-test-bar`)
 *
 * Automatically activates on `studio.boardgamearena.com`:
 * 1. Attaches `window.tt` (`window.tichuTest`) on both the game iframe `window`
 *    and `window.parent` (for interactive DevTools console driving).
 * 2. Renders a compact `#studio-test-bar` with one-click test buttons (`#tt_btn_smoke`,
 *    `#tt_btn_round`, `#tt_btn_game`, `#tt_btn_gt_all`, `#tt_btn_pass_all`, `#tt_btn_step1`,
 *    `#tt_btn_assert`), a command runner (`#tt_cmd_input` + `#tt_cmd_run`), and a
 *    structured JSON readout (`#tt_test_output[data-done="1"]`) so automated browser
 *    agents can execute full multi-player Studio test suites in a single click without
 *    `page.evaluate`, player URL switching, or screenshots.
 */

const SUIT_CODES: Record<number, string> = { 1: "S", 2: "R", 3: "B", 4: "G" };
const SUIT_SYMBOLS: Record<number, string> = { 1: "♠", 2: "★", 3: "💙", 4: "🟢" };
const RANK_LABELS: Record<number, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};
const SPECIAL_CODES: Record<number, string> = { 1: "DR", 2: "PH", 3: "DOG", 4: "MJ" };

interface NormalizedCard {
  id: string;
  type: number;
  type_arg: number;
}

function cardFromStockType(stockTypeVal: number, id?: string): NormalizedCard {
  const st = Number(stockTypeVal);
  const color = Math.floor(st / 14) + 1;
  const value = (st % 14) + 1;
  return {
    id: String(id ?? ""),
    type: color,
    type_arg: value,
  };
}

function normalizeCardObj(cardOrItem: any): NormalizedCard | null {
  if (!cardOrItem || typeof cardOrItem !== "object") return null;
  if (cardOrItem.type_arg !== undefined) {
    return {
      id: String(cardOrItem.id ?? ""),
      type: Number(cardOrItem.type),
      type_arg: Number(cardOrItem.type_arg),
    };
  }
  if (cardOrItem.type !== undefined) {
    return cardFromStockType(Number(cardOrItem.type), cardOrItem.id);
  }
  return null;
}

function formatCardCode(cardOrItem: any): string {
  const c = normalizeCardObj(cardOrItem);
  if (!c) return "?";
  if (c.type_arg === 1) {
    return SPECIAL_CODES[c.type] || "SP";
  }
  return (SUIT_CODES[c.type] || "?") + (RANK_LABELS[c.type_arg] || String(c.type_arg));
}

function formatCardPretty(cardOrItem: any, withId?: boolean): string {
  const c = normalizeCardObj(cardOrItem);
  if (!c) return "?";
  let label = "";
  if (c.type_arg === 1) {
    label = SPECIAL_CODES[c.type] || "SP";
  } else {
    label = (RANK_LABELS[c.type_arg] || String(c.type_arg)) + (SUIT_SYMBOLS[c.type] || "");
  }
  if (withId && c.id) {
    return `${label}(#${c.id})`;
  }
  return label;
}

function parseRankToken(tok: any): number | null {
  if (tok === null || tok === undefined) return null;
  const s = String(tok).trim().toUpperCase();
  if (s === "NONE" || s === "NO" || s === "0" || s === "15") return 15;
  if (s === "J" || s === "JACK") return 11;
  if (s === "Q" || s === "QUEEN") return 12;
  if (s === "K" || s === "KING") return 13;
  if (s === "A" || s === "ACE") return 14;
  if (s === "MJ" || s === "MAHJONG" || s === "1") return 1;
  const n = parseInt(s, 10);
  if (!isNaN(n) && n >= 2 && n <= 15) return n;
  return null;
}

function parseCardSpecToken(rawToken: any): any {
  if (rawToken && typeof rawToken === "object") {
    const c = normalizeCardObj(rawToken);
    if (c && c.id) return { kind: "id", id: String(c.id) };
    if (c) return { kind: "exact", suit: c.type, rank: c.type_arg };
  }
  const raw = String(rawToken ?? "").trim();
  if (!raw) return null;

  if (raw.indexOf("#") === 0) {
    return { kind: "id", id: raw.slice(1).trim() };
  }

  const upper = raw.toUpperCase();
  if (upper === "DR" || upper === "DRAGON") return { kind: "exact", suit: 1, rank: 1 };
  if (upper === "PH" || upper === "PHOENIX") return { kind: "exact", suit: 2, rank: 1 };
  if (upper === "DOG" || upper === "HOUND") return { kind: "exact", suit: 3, rank: 1 };
  if (upper === "MJ" || upper === "MAHJONG") return { kind: "exact", suit: 4, rank: 1 };

  const suitMap: Record<string, number> = {
    S: 1,
    R: 2,
    B: 3,
    G: 4,
  };

  const suitFirst = upper.match(/^([SRBG])\s*(10|[2-9]|[JQKA])$/);
  if (suitFirst) {
    const suit = suitMap[suitFirst[1]!];
    const rank = parseRankToken(suitFirst[2]);
    if (suit && rank) return { kind: "exact", suit, rank };
  }

  const rankFirst = upper.match(/^(10|[2-9]|[JQKA])\s*([SRBG])$/);
  if (rankFirst) {
    const rank = parseRankToken(rankFirst[1]);
    const suit = suitMap[rankFirst[2]!];
    if (suit && rank) return { kind: "exact", suit, rank };
  }

  if (upper === "J" || upper === "Q" || upper === "K" || upper === "A") {
    return { kind: "rank", rank: parseRankToken(upper) };
  }

  const num = Number(upper);
  if (!isNaN(num) && Math.floor(num) === num && num > 0) {
    return { kind: "number", value: num, id: String(num) };
  }

  return null;
}

function resolveCardsFromHand(input: any, handCards: any[]): NormalizedCard[] | null {
  const hand: NormalizedCard[] = [];
  for (let i = 0; i < (handCards || []).length; i++) {
    const norm = normalizeCardObj(handCards[i]);
    if (norm) hand.push(norm);
  }
  if (input === undefined || input === null) return null;

  let tokens: any[] = [];
  let forceIdMode = false;
  if (typeof input === "string") {
    if (input.indexOf(";") !== -1) {
      forceIdMode = true;
      tokens = input
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      tokens = input
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } else if (Array.isArray(input)) {
    tokens = input;
  } else {
    tokens = [input];
  }

  if (tokens.length === 0) return [];

  const parsed = tokens.map(parseCardSpecToken);
  for (let i = 0; i < parsed.length; i++) {
    if (!parsed[i]) {
      throw new Error(`Invalid card specification in: ${JSON.stringify(input)}`);
    }
  }

  const usedIds: Record<string, boolean> = {};
  const resolved: NormalizedCard[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const spec = parsed[i];
    let chosen: NormalizedCard | null = null;

    if (spec.kind === "id") {
      chosen = hand.find((c) => !usedIds[c.id] && String(c.id) === String(spec.id)) || null;
    } else if (spec.kind === "exact") {
      chosen =
        hand.find((c) => !usedIds[c.id] && c.type === spec.suit && c.type_arg === spec.rank) ||
        null;
    } else if (spec.kind === "rank") {
      chosen = hand.find((c) => !usedIds[c.id] && c.type_arg === spec.rank) || null;
    } else if (spec.kind === "number") {
      if (forceIdMode || spec.value > 14) {
        chosen = hand.find((c) => !usedIds[c.id] && String(c.id) === String(spec.value)) || null;
      }
      if (!chosen && spec.value >= 1 && spec.value <= 14) {
        chosen = hand.find((c) => !usedIds[c.id] && c.type_arg === spec.value) || null;
      }
      if (!chosen) {
        chosen = hand.find((c) => !usedIds[c.id] && String(c.id) === String(spec.value)) || null;
      }
    }

    if (!chosen) {
      const availableStr = hand.map((c) => `${formatCardCode(c)}(#${c.id})`).join(", ");
      throw new Error(
        `Could not find card matching ${JSON.stringify(spec)} in hand: [${availableStr}]`,
      );
    }

    usedIds[chosen.id] = true;
    resolved.push(chosen);
  }

  return resolved;
}

function pickThreeDefaultCardsFromHand(handCards: any[]): NormalizedCard[] {
  const hand: NormalizedCard[] = [];
  for (let i = 0; i < (handCards || []).length; i++) {
    const norm = normalizeCardObj(handCards[i]);
    if (norm) hand.push(norm);
  }
  if (hand.length < 3) return hand;

  const rankCounts: Record<number, number> = {};
  for (let i = 0; i < hand.length; i++) {
    const r = hand[i]!.type_arg;
    rankCounts[r] = (rankCounts[r] || 0) + 1;
  }

  const sorted = hand.slice().sort((a, b) => {
    const aSpec = a.type_arg === 1 ? 1 : 0;
    const bSpec = b.type_arg === 1 ? 1 : 0;
    if (aSpec !== bSpec) return aSpec - bSpec;
    if (aSpec === 0) {
      const aFreq = rankCounts[a.type_arg] || 1;
      const bFreq = rankCounts[b.type_arg] || 1;
      if (aFreq !== bFreq) return aFreq - bFreq;
      if (a.type_arg !== b.type_arg) return a.type_arg - b.type_arg;
    }
    return Number(a.id) - Number(b.id);
  });

  return sorted.slice(0, 3);
}

function pickDefaultPlayCardsFromHand(ui: any): NormalizedCard[] {
  const gd = (ui && ui.gamedatas) || {};
  const hand: NormalizedCard[] = [];
  const rawHand = gd.hand || [];
  for (let i = 0; i < rawHand.length; i++) {
    const norm = normalizeCardObj(rawHand[i]);
    if (norm) hand.push(norm);
  }
  if (hand.length === 0) return [];

  if (ui && ui.playerHand) {
    const selected = ui.playerHand.getSelectedItems();
    if (selected && selected.length > 0) {
      const selMap: Record<string, boolean> = {};
      for (let i = 0; i < selected.length; i++) {
        selMap[String(selected[i].id)] = true;
      }
      return hand.filter((c) => Boolean(selMap[String(c.id)]));
    }
  }

  const stName = gd.gamestate && gd.gamestate.name;
  const wish = Number(gd.mahjongWish || 0);
  if (wish >= 2 && wish <= 14) {
    const wished = hand.find((c) => c.type_arg === wish);
    if (wished) return [wished];
  }

  if (stName === "playComboOpen") {
    const mj = hand.find((c) => c.type_arg === 1 && c.type === 4);
    if (mj) return [mj];
    const dog = hand.find((c) => c.type_arg === 1 && c.type === 3);
    if (dog) return [dog];
  }

  const normals = hand.filter((c) => c.type_arg >= 2).sort((a, b) => a.type_arg - b.type_arg);
  if (normals.length > 0) return [normals[0]!];
  return [hand[0]!];
}

export function initStudioTestHelper(gameuiInstance: any): void {
  const win = window as any;
  if (win.tt) return;
  const host = String((window.location && window.location.hostname) || "");
  if (host.indexOf("studio.boardgamearena.com") === -1) return;

  let consoleVerbose = true;
  let speedMode: "normal" | "fast" | "instant" = "normal";

  interface ConsoleIssue {
    ts: string;
    level: "error" | "warn";
    source: string;
    message: string;
  }

  const consoleIssues: ConsoleIssue[] = [];

  function formatConsoleArg(arg: any): string {
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) return arg.stack || arg.message || String(arg);
    if (arg === null || arg === undefined) return String(arg);
    try {
      return JSON.stringify(arg);
    } catch (_e) {
      return String(arg);
    }
  }

  function recordConsoleIssue(level: "error" | "warn", source: string, args: any[]) {
    const message = args.map(formatConsoleArg).join(" ").trim();
    if (!message) return;
    if (consoleIssues.length >= 200) {
      consoleIssues.shift();
    }
    consoleIssues.push({
      ts: new Date().toISOString(),
      level,
      source,
      message,
    });
  }

  function hookWindowConsole(targetWin: any, prefix: string) {
    if (!targetWin || targetWin.__tichuConsoleWatched) return;
    targetWin.__tichuConsoleWatched = true;
    try {
      const origErr = targetWin.console?.error;
      if (typeof origErr === "function") {
        targetWin.console.error = function (...args: any[]) {
          recordConsoleIssue("error", `${prefix}.console.error`, args);
          return origErr.apply(this, args);
        };
      }
      const origWarn = targetWin.console?.warn;
      if (typeof origWarn === "function") {
        targetWin.console.warn = function (...args: any[]) {
          recordConsoleIssue("warn", `${prefix}.console.warn`, args);
          return origWarn.apply(this, args);
        };
      }
      targetWin.addEventListener("error", (ev: any) => {
        const msg = ev?.error ? formatConsoleArg(ev.error) : ev?.message || "Unknown window error";
        recordConsoleIssue("error", `${prefix}.window.error`, [msg]);
      });
      targetWin.addEventListener("unhandledrejection", (ev: any) => {
        recordConsoleIssue("error", `${prefix}.unhandledrejection`, [ev?.reason ?? "Rejection"]);
      });
    } catch (_e) {
      // Ignore cross-origin frame access errors
    }
  }

  hookWindowConsole(win, "iframe");
  try {
    if (window.parent && window.parent !== window) {
      hookWindowConsole(window.parent, "parent");
    }
  } catch (_e) {}

  function logAnnounce(tag: string, msg: string, color = "#58a6ff") {
    if (!consoleVerbose) return;
    try {
      window.console.log(`%c${tag}%c ${msg}`, `font-weight:bold;color:${color}`, "");
    } catch (_e) {
      window.console.log(`${tag} ${msg}`);
    }
  }

  function getUi(): any {
    return (window as any).gameui || gameuiInstance;
  }

  function getSortedPlayers(): any[] {
    const ui = getUi();
    const gd = (ui && ui.gamedatas) || {};
    return Object.values(gd.players || {}).sort((a: any, b: any) => Number(a.no) - Number(b.no));
  }

  function formatPlayerTag(playerId: any): string {
    if (!playerId || Number(playerId) === 0) return "Spectator";
    const players = getSortedPlayers();
    const idx = players.findIndex((p: any) => Number(p.id) === Number(playerId));
    if (idx === -1) return `P?(${playerId})`;
    const p = players[idx];
    return `P${idx}:${p.name}`;
  }

  function resolvePlayerId(seatOrPlayerId?: any): number {
    const ui = getUi();
    const players = getSortedPlayers();
    if (seatOrPlayerId === undefined || seatOrPlayerId === null) {
      return ui ? (ui.isSpectator ? 0 : Number(ui.player_id)) : 0;
    }
    const rawStr = String(seatOrPlayerId).trim().toLowerCase();
    const pMatch = rawStr.match(/^p([0-3])$/);
    if (pMatch) {
      const idx = Number(pMatch[1]);
      return players[idx] ? Number(players[idx].id) : 0;
    }
    const num = Number(rawStr);
    if (!isNaN(num) && Math.floor(num) === num) {
      if (num >= 0 && num <= 3 && players[num]) {
        return Number(players[num].id);
      }
      if (num >= 1 && num <= 4 && players[num - 1] && !players.some((p) => Number(p.id) === num)) {
        return Number(players[num - 1].id);
      }
      const exact = players.find((p) => Number(p.id) === num);
      if (exact) return Number(exact.id);
    }
    const byName = players.find((p) => String(p.name || "").toLowerCase() === rawStr);
    if (byName) return Number(byName.id);
    throw new Error(
      `Unknown seat or player "${seatOrPlayerId}". Expected 0..3, "P0".."P3", player name, or player ID.`,
    );
  }

  function isQueueBusy(): boolean {
    const ui = getUi();
    if (!ui) return false;
    const actionsRunning = Number(
      (ui.bga && ui.bga.actions && ui.bga.actions.ajaxcall_running) || 0,
    );
    const sitecoreRunning = Number(
      ((window as any).g_sitecore && (window as any).g_sitecore.ajaxcall_running) || 0,
    );
    const nq = ui.notifqueue;
    const queueLen = nq && Array.isArray(nq.queue) ? nq.queue.length : 0;
    const waitingSync = Boolean(nq && nq.waiting_from_notifend !== null);
    const resyncing = Boolean(nq && nq.notificationResendInProgress);
    return actionsRunning > 0 || sitecoreRunning > 0 || queueLen > 0 || waitingSync || resyncing;
  }

  function nextMicrotaskTick(): Promise<void> {
    return Promise.resolve().then(() => Promise.resolve());
  }

  async function waitLitUpdates(): Promise<void> {
    await nextMicrotaskTick();
    try {
      const els = queryDeepAll(
        "tichu-hand, tichu-status, tichu-player-panel, tichu-last-played, tichu-pass-area, tichu-action-bar",
      );
      const promises: Promise<any>[] = [];
      for (let i = 0; i < els.length; i++) {
        const uc = (els[i] as any)?.updateComplete;
        if (uc && typeof uc.then === "function") promises.push(uc);
      }
      if (promises.length > 0) await Promise.all(promises);
    } catch (_e) {}
    await nextMicrotaskTick();
  }

  async function waitUntilIdle(timeoutMs = 15000, settleMs = 50): Promise<void> {
    if (speedMode === "instant" && !isQueueBusy()) {
      await nextMicrotaskTick();
      if (!isQueueBusy()) return;
    }
    return new Promise((resolve) => {
      const start = Date.now();
      let idleSince: number | null = null;

      const check = () => {
        if (Date.now() - start >= timeoutMs) {
          resolve();
          return;
        }
        if (isQueueBusy()) {
          idleSince = null;
          setTimeout(check, 12);
          return;
        }
        if (idleSince === null) {
          idleSince = Date.now();
        }
        if (Date.now() - idleSince >= settleMs) {
          resolve();
          return;
        }
        setTimeout(check, 12);
      };
      setTimeout(check, 12);
    });
  }

  function dismissDialogsIfInstant() {
    if (speedMode !== "instant") return;
    try {
      const dojoObj = (window as any).dojo;
      if (dojoObj && typeof dojoObj.query === "function") {
        dojoObj.query(".dijitDialog, .dijitDialogUnderlayWrapper").forEach(dojoObj.destroy);
      }
    } catch (_e) {}
  }

  function querySingleDeepAll<T extends Element = Element>(
    selector: string,
    root: Document | Element | ShadowRoot = document,
  ): T[] {
    const results: T[] = [];
    if ((root as Document).querySelectorAll) {
      results.push(...(Array.from((root as Document).querySelectorAll(selector)) as T[]));
    }
    if ((root as Element).shadowRoot) {
      results.push(...querySingleDeepAll<T>(selector, (root as Element).shadowRoot!));
    }
    const allElements = (root as Document).querySelectorAll
      ? (root as Document).querySelectorAll("*")
      : [];
    for (let i = 0; i < allElements.length; i++) {
      const node = allElements[i] as Element;
      if (node && node.shadowRoot) {
        results.push(...querySingleDeepAll<T>(selector, node.shadowRoot));
      }
    }
    return results;
  }

  function queryDeepAll<T extends Element = Element>(
    selector: string,
    root: Document | Element | ShadowRoot = document,
  ): T[] {
    if (!selector) return [];
    const results: T[] = [];
    const seen = new Set<Element>();
    const addUnique = (items: T[]) => {
      for (let i = 0; i < items.length; i++) {
        const el = items[i]!;
        if (!seen.has(el)) {
          seen.add(el);
          results.push(el);
        }
      }
    };

    const parts = selector
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (let p = 0; p < parts.length; p++) {
      const part = parts[p]!;
      const direct = querySingleDeepAll<T>(part, root);
      if (direct.length > 0) {
        addUnique(direct);
        continue;
      }
      const segments = part
        .replace(/(\\[0-9a-fA-F]{1,6})\s/g, "$1\x00")
        .split(/\s+/)
        .map((s) => s.replace(/\x00/g, " "))
        .filter(Boolean);
      if (segments.length > 1) {
        let currentRoots: (Document | Element | ShadowRoot)[] = [root];
        for (let s = 0; s < segments.length; s++) {
          const seg = segments[s]!;
          const nextRoots: Element[] = [];
          const nextSeen = new Set<Element>();
          for (let r = 0; r < currentRoots.length; r++) {
            const matches = querySingleDeepAll<Element>(seg, currentRoots[r]!);
            for (let m = 0; m < matches.length; m++) {
              const matchEl = matches[m]!;
              if (!nextSeen.has(matchEl)) {
                nextSeen.add(matchEl);
                nextRoots.push(matchEl);
              }
            }
          }
          currentRoots = nextRoots;
          if (currentRoots.length === 0) break;
        }
        addUnique(currentRoots as T[]);
      }
    }
    return results;
  }

  function queryDeep<T extends Element = Element>(
    selector: string,
    root: Document | Element | ShadowRoot = document,
  ): T | null {
    const all = queryDeepAll<T>(selector, root);
    return all[0] || null;
  }

  function getElementByIdDeep(
    id: string,
    root: Document | Element | ShadowRoot = document,
  ): HTMLElement | null {
    if ((root as Document).getElementById) {
      const el = (root as Document).getElementById(id);
      if (el) return el;
    }
    return queryDeep<HTMLElement>(`#${CSS.escape(id)}`, root);
  }

  const tt = {
    help() {
      const rows = [
        { Command: "tt.help()", Description: "Show BGA Studio console command cheat-sheet" },
        {
          Command: "tt.status()",
          Description: "Inspect current table state, players, hand, trick, and buttons",
        },
        { Command: "tt.hand()", Description: "Inspect viewer's cards in hand with codes & IDs" },
        {
          Command: "tt.assertUI()",
          Description: "Verify live BGA Studio DOM matches gamedatas invariants",
        },
        {
          Command: "tt.setSpeed('instant'|'normal')",
          Description: "Toggle instantaneousMode (1ms notification queue)",
        },
        {
          Command: "await tt.betGrandTichu(0|200, seat?)",
          Description: "Place Grand Tichu bet for seat (via testuser)",
        },
        {
          Command: "await tt.betAllGrandTichu([0,0,0,0])",
          Description: "Place Grand Tichu bets for all multiactive players in 1 tab",
        },
        {
          Command: "await tt.giveCards(cards?)",
          Description: "Select & pass 3 cards from viewer's hand",
        },
        {
          Command: "await tt.passAllCards(cards?)",
          Description: "Pass 3 cards for viewer + step bots for the other 3 players",
        },
        { Command: "await tt.play(cards?)", Description: "Select & play combo from viewer's hand" },
        {
          Command: "await tt.pass(onlyOnce=true, seat?)",
          Description: "Pass turn (or set auto-pass) for seat",
        },
        {
          Command: "await tt.collect(seat?)",
          Description: "Immediately collect won trick in confirmTrick state",
        },
        {
          Command: "await tt.wish(rank=15, seat?)",
          Description: "Make a Mahjong wish (2..14 or 15='none')",
        },
        {
          Command: "await tt.choosePhoenix(rank?, seat?)",
          Description: "Choose ambiguous Phoenix rank",
        },
        {
          Command: "await tt.giveDragon(0|1, seat?)",
          Description: "Gift Dragon trick to opponent 0 or 1",
        },
        {
          Command: "await tt.step(moves=1)",
          Description: "Run server zombieTurn for N moves via debug_bgaPlayMoves",
        },
        {
          Command: "await tt.actForOthers()",
          Description: "Have server zombieTurn act for other players until your turn",
        },
        {
          Command: "await tt.runSmokeTest(opts?)",
          Description:
            "Run full zero-click Studio smoke test (Grand Tichu + Pass + Tricks + UI assertions)",
        },
        {
          Command: "await tt.runRound(opts?)",
          Description: "Play a full round to completion on Studio and assert UI",
        },
        {
          Command: "await tt.runGame(opts?)",
          Description: "Fast-forward entire game to gameEnd (state 99) on Studio",
        },
        {
          Command: "await tt.actMyTurn()",
          Description: "Play 1 legal move strictly for this tab's player (zero zombie turns)",
        },
        {
          Command: "await tt.startAutoPlayMe(opts?)",
          Description: "Auto-play this tab's player until gameEnd while watching console",
        },
        {
          Command: "tt.getConsoleIssues()",
          Description: "List all captured console errors/warnings and breadcrumb warnings",
        },
      ];
      window.console.table(rows);
      return rows;
    },

    setVerbose(enabled = true) {
      consoleVerbose = Boolean(enabled);
      return consoleVerbose;
    },

    setSpeed(mode: "normal" | "fast" | "instant" = "instant") {
      const ui = getUi();
      speedMode = mode;
      (window as any).__tichuSpeed = mode;
      if (mode === "instant") {
        (document.querySelector("tichu-animation-layer") as any)?.cancelAll?.();
      }
      if (ui) {
        ui.instantaneousMode = mode === "instant" || mode === "fast";
        const nq = ui.notifqueue;
        if (nq) {
          if (!nq._origSynchronousNotifs && nq.synchronous_notifs) {
            nq._origSynchronousNotifs = { ...nq.synchronous_notifs };
            nq._origSetSynchronousDuration = nq.setSynchronousDuration;
          }
          if (mode === "instant") {
            nq.synchronous_notifs = {};
            nq.setSynchronousDuration = function () {};
          } else if (nq._origSynchronousNotifs) {
            nq.synchronous_notifs = { ...nq._origSynchronousNotifs };
            if (nq._origSetSynchronousDuration) {
              nq.setSynchronousDuration = nq._origSetSynchronousDuration;
            }
          }
        }
      }
      logAnnounce(
        "[TICHU STUDIO SPEED]",
        `Speed mode="${mode}" (instantaneousMode=${Boolean(ui && ui.instantaneousMode)})`,
      );
      return speedMode;
    },

    waitUntilIdle,

    status(logToConsole = true) {
      const ui = getUi();
      if (!ui || !ui.gamedatas) return null;
      const gd = ui.gamedatas;
      const st = gd.gamestate || {};
      const sortedPlayers = getSortedPlayers();

      const players = sortedPlayers.map((p: any, idx: number) => {
        const pId = Number(p.id);
        const hcEl = queryDeep(`.handcount.${CSS.escape(String(pId))}`);
        const ptEl = getElementByIdDeep(`pointcount_${pId}`);
        const scoreEl = getElementByIdDeep(`player_score_${pId}`);
        const activeIds: number[] =
          ui.bga && ui.bga.players && typeof ui.bga.players.getActivePlayerIds === "function"
            ? ui.bga.players.getActivePlayerIds().map(Number)
            : typeof ui.isPlayerActive === "function" && ui.isPlayerActive(pId)
              ? [pId]
              : [];
        return {
          seat: idx,
          no: Number(p.no),
          id: pId,
          name: p.name,
          team: Number(p.team ?? idx % 2),
          handCount: hcEl
            ? parseInt(hcEl.textContent || "0", 10)
            : Number((gd.handcount && gd.handcount[pId]) ?? 0),
          capturedPoints: ptEl
            ? parseInt(ptEl.textContent || "0", 10)
            : Number((gd.capturedpoints && gd.capturedpoints[pId]) ?? 0),
          score: scoreEl ? parseInt(scoreEl.textContent || "0", 10) : Number(p.score ?? 0),
          grandTichu: Number(p.call_grand_tichu),
          tichu: Number(p.call_tichu),
          autopass: Number(p.pass || 0),
          isActive: activeIds.indexOf(pId) !== -1,
        };
      });

      const hand = (gd.hand || []).map((c: any) => ({
        id: String(c.id),
        code: formatCardCode(c),
        pretty: formatCardPretty(c, false),
        type: Number(c.type),
        type_arg: Number(c.type_arg),
      }));

      const buttons: { id: string; label: string }[] = [];
      const btnNodes = queryDeepAll(
        "#generalactions .bgabutton, #buttons .bgabutton, #buttons .action-button",
      );
      for (let i = 0; i < btnNodes.length; i++) {
        const node = btnNodes[i] as HTMLElement;
        if (!node || node.classList.contains("hide") || node.style.display === "none") continue;
        buttons.push({
          id: node.id || "btn",
          label: (node.textContent || "").trim(),
        });
      }

      const summary = {
        tableId: Number(ui.table_id || 0),
        state: {
          id: Number(st.id || 0),
          name: st.name || "",
          type: st.type || "",
          possibleactions: st.possibleactions || [],
        },
        viewer: ui.isSpectator ? "spectator" : formatPlayerTag(ui.player_id),
        viewerId: ui.isSpectator ? 0 : Number(ui.player_id),
        isMyTurn: Boolean(
          typeof ui.isCurrentPlayerActive === "function" && ui.isCurrentPlayerActive(),
        ),
        activePlayer: st.active_player ? formatPlayerTag(st.active_player) : null,
        activePlayerId: st.active_player ? Number(st.active_player) : null,
        multiactive: Array.isArray(st.multiactive)
          ? st.multiactive.map((id: any) => formatPlayerTag(id))
          : [],
        multiactiveIds: Array.isArray(st.multiactive)
          ? st.multiactive.map((id: any) => Number(id))
          : [],
        round: Number(gd.round || 0),
        trick: Number(gd.trick || 0),
        trickPoints: Number(gd.currentTrickValue || 0),
        mahjongWish: Number(gd.mahjongWish || 0),
        firstOutPlayer: Number(gd.firstoutplayer || 0),
        players,
        hand,
        handCodes: hand.map((c: any) => c.code),
        buttons,
        consoleIssueCount: tt.getConsoleIssues().length,
        consoleIssues: tt.getConsoleIssues(),
      };

      if (logToConsole) {
        logAnnounce(
          "[TICHU STUDIO STATE]",
          `Table #${summary.tableId} | State=${summary.state.name}(#${summary.state.id}) | Round=${summary.round} Trick=${summary.trick} (${summary.trickPoints} pts) | Active=${summary.activePlayer || summary.multiactive.join(",") || "-"}`,
        );
      }
      return summary;
    },

    hand() {
      const ui = getUi();
      const cards = ((ui && ui.gamedatas && ui.gamedatas.hand) || []).map((c: any) => ({
        id: String(c.id),
        code: formatCardCode(c),
        pretty: formatCardPretty(c, true),
        suit: Number(c.type),
        rank: Number(c.type_arg),
      }));
      logAnnounce(
        "[TICHU STUDIO HAND]",
        `${formatPlayerTag(ui && ui.player_id)} (${cards.length} cards): [${cards.map((c: any) => `${c.code}(#${c.id})`).join(", ")}]`,
        "#3fb950",
      );
      return cards;
    },

    assertUI() {
      const ui = getUi();
      if (!ui || !ui.gamedatas) {
        throw new Error("[ASSERT_UI FAILED] window.gameui or gamedatas is missing");
      }
      const gd = ui.gamedatas;
      const st = gd.gamestate || {};
      const stateName = st.name || "";

      const overall = document.getElementById("overall-content");
      if (!overall) {
        throw new Error("[ASSERT_UI FAILED] #overall-content element missing from DOM");
      }

      const myHandItems = queryDeepAll("#myhand .stockitem:not(.to_be_destroyed)");
      if (!ui.isSpectator && stateName !== "endRound" && stateName !== "newRound") {
        const stagedPassCount = Array.isArray(ui.cardsToPass)
          ? ui.cardsToPass.filter(Boolean).length
          : 0;
        const expectedHandDom = Math.max(0, (gd.hand || []).length - stagedPassCount);
        if (myHandItems.length !== expectedHandDom) {
          throw new Error(
            `[ASSERT_UI FAILED] #myhand .stockitem count (${myHandItems.length}) !== expected hand size (${expectedHandDom}, gamedatas.hand=${(gd.hand || []).length}, staged=${stagedPassCount})`,
          );
        }
      }

      const statusEl = queryDeep("#game_play_area_wrap tichu-status") || queryDeep("tichu-status");
      if (!statusEl) {
        throw new Error("[ASSERT_UI FAILED] <tichu-status> element missing from DOM");
      }
      const attrRound = Number(statusEl.getAttribute("roundCount") || (statusEl as any).roundCount);
      const attrTrick = Number(statusEl.getAttribute("trickCount") || (statusEl as any).trickCount);
      const attrPts = Number(statusEl.getAttribute("trickPoints") || (statusEl as any).trickPoints);
      if (attrRound !== Number(gd.round)) {
        throw new Error(
          `[ASSERT_UI FAILED] <tichu-status> roundCount (${attrRound}) !== gamedatas.round (${gd.round})`,
        );
      }
      if (attrTrick !== Number(gd.trick)) {
        throw new Error(
          `[ASSERT_UI FAILED] <tichu-status> trickCount (${attrTrick}) !== gamedatas.trick (${gd.trick})`,
        );
      }
      if (attrPts !== Number(gd.currentTrickValue)) {
        throw new Error(
          `[ASSERT_UI FAILED] <tichu-status> trickPoints (${attrPts}) !== gamedatas.currentTrickValue (${gd.currentTrickValue})`,
        );
      }

      const players = getSortedPlayers();
      for (let i = 0; i < players.length; i++) {
        const pId = Number(players[i].id);
        const hcNodes = queryDeepAll(`.handcount.${CSS.escape(String(pId))}`);
        if (hcNodes.length === 0) {
          throw new Error(`[ASSERT_UI FAILED] Missing .handcount.${pId} elements in DOM`);
        }
        const numVal = parseInt((hcNodes[0]!.textContent || "").trim(), 10);
        if (isNaN(numVal) || numVal < 0 || numVal > 14) {
          throw new Error(
            `[ASSERT_UI FAILED] Invalid handcount "${hcNodes[0]!.textContent}" for player ${pId}`,
          );
        }
      }

      return {
        ok: true,
        tableId: Number(ui.table_id || 0),
        state: stateName,
        viewer: ui.player_id,
        handDomCount: myHandItems.length,
        round: Number(gd.round),
        trick: Number(gd.trick),
        trickPoints: Number(gd.currentTrickValue),
      };
    },

    async ajax(actionName: string, args: Record<string, any> = {}, seatOrPlayerId?: any) {
      const ui = getUi();
      if (!ui) throw new Error("window.gameui is not initialized");
      const targetPlayerId =
        seatOrPlayerId !== undefined && seatOrPlayerId !== null
          ? resolvePlayerId(seatOrPlayerId)
          : Number(ui.player_id);

      const prevTestUser = ui.forceTestUser;
      if (targetPlayerId && targetPlayerId !== Number(ui.player_id)) {
        ui.forceTestUser = targetPlayerId;
      }

      logAnnounce(
        "[TICHU STUDIO ACTION]",
        `${formatPlayerTag(targetPlayerId)} -> ${actionName} ${JSON.stringify(args)}`,
        "#f0883e",
      );

      try {
        await new Promise<void>((resolve, reject) => {
          ui.ajaxcall(
            `/tichu/tichu/${actionName}.html`,
            { ...args, lock: true },
            ui,
            () => resolve(),
            (isErr: boolean, msg?: string) => {
              if (isErr) reject(new Error(msg || `${actionName} failed`));
              else resolve();
            },
          );
        });
      } finally {
        ui.forceTestUser = prevTestUser;
      }

      await waitUntilIdle(15000, speedMode === "instant" ? 40 : 200);
      dismissDialogsIfInstant();
      return tt.status(false);
    },

    async betGrandTichu(bet = 0, seat?: any) {
      const numBet = bet === (true as any) || Number(bet) === 200 ? 200 : 0;
      return tt.ajax("grandTichuBet", { bet: numBet }, seat);
    },

    async betAllGrandTichu(bets: number[] = [0, 0, 0, 0]) {
      const ui = getUi();
      const players = getSortedPlayers();
      const multi: number[] =
        ui &&
        ui.gamedatas &&
        ui.gamedatas.gamestate &&
        Array.isArray(ui.gamedatas.gamestate.multiactive)
          ? ui.gamedatas.gamestate.multiactive.map(Number)
          : players.map((p) => Number(p.id));

      for (let idx = 0; idx < players.length; idx++) {
        const pId = Number(players[idx].id);
        if (multi.indexOf(pId) === -1) continue;
        const betVal = Number(bets[idx]) === 200 ? 200 : 0;
        await tt.betGrandTichu(betVal, pId);
      }
      await waitUntilIdle(15000, 200);
      return tt.status(false);
    },

    async betTichu(seat?: any) {
      return tt.ajax("tichuBet", { bet: 100 }, seat);
    },

    async confirmTichu(bet = 100, seat?: any) {
      return tt.ajax("confirmTichu", { bet: Number(bet) }, seat);
    },

    async giveCards(cards?: any) {
      const ui = getUi();
      const gd = ui.gamedatas;

      if (typeof ui.onResetPassCards === "function" && Array.isArray(ui.cardsToPass)) {
        if (ui.cardsToPass.some(Boolean)) {
          ui.onResetPassCards();
        }
      }

      const chosenCards =
        cards === undefined || cards === null
          ? pickThreeDefaultCardsFromHand(gd.hand)
          : resolveCardsFromHand(cards, gd.hand);

      if (!chosenCards || chosenCards.length !== 3) {
        throw new Error(`giveCards requires 3 cards, got ${chosenCards ? chosenCards.length : 0}`);
      }

      if (ui.playerHand && typeof ui.onGiveCard === "function") {
        for (let i = 0; i < 3; i++) {
          ui.playerHand.unselectAll();
          ui.playerHand.selectItem(String(chosenCards[i]!.id));
          ui.onGiveCard(i);
        }
        for (let i = 0; i < 3; i++) {
          const node = document.getElementById(
            "cardontable_" + ui.player_id + "_" + chosenCards[i]!.id,
          );
          if (node && node.parentNode) node.parentNode.removeChild(node);
        }
        ui.cardsToPass = [];
      }

      const toGiveStr = chosenCards.map((c) => c.id).join(";") + ";";
      try {
        return await tt.ajax("giveTheCards", { cards: toGiveStr });
      } catch (err) {
        if (typeof ui.onResetPassCards === "function") {
          ui.onResetPassCards();
        }
        throw err;
      }
    },

    async passAllCards(cards?: any) {
      let cur = tt.status(false)!;
      if (cur.state.name !== "giveCards") {
        return cur;
      }
      if (cur.isMyTurn) {
        cur = (await tt.giveCards(cards))!;
      }
      if (cur.state.name === "giveCards") {
        const remaining = cur.multiactiveIds.length || 3;
        cur = (await tt.step(remaining))!;
      }
      if (!getUi().instantaneousMode) {
        await new Promise((r) => setTimeout(r, 2100));
      }
      await waitUntilIdle(10000, speedMode === "instant" ? 40 : 150);
      return tt.status(false);
    },

    async play(cards?: any) {
      const ui = getUi();
      const gd = ui.gamedatas;

      const chosenCards =
        cards === undefined || cards === null
          ? pickDefaultPlayCardsFromHand(ui)
          : resolveCardsFromHand(cards, gd.hand);

      if (!chosenCards || chosenCards.length === 0) {
        throw new Error("No cards selected or resolved for tt.play()");
      }

      if (ui.playerHand) {
        ui.playerHand.unselectAll();
        for (let i = 0; i < chosenCards.length; i++) {
          ui.playerHand.selectItem(String(chosenCards[i]!.id));
        }
      }

      const cardIdStr = chosenCards.map((c) => c.id).join(";");
      return tt.ajax("playCombo", { cards: cardIdStr });
    },

    async pass(onlyOnce = true, seat?: any) {
      const ui = getUi();
      if (ui && ui.playerHand && (seat === undefined || seat === null)) {
        ui.playerHand.unselectAll();
      }
      return tt.ajax("pass", { onlyOnce: Boolean(onlyOnce) }, seat);
    },

    async collect(seat?: any) {
      const ui = getUi();
      clearTimeout(ui.autoCollectTimeout);
      const st = ui && ui.gamedatas && ui.gamedatas.gamestate;
      const targetSeat =
        seat !== undefined && seat !== null
          ? seat
          : st && st.active_player
            ? Number(st.active_player)
            : undefined;
      const isViewerCollect =
        ui && (!targetSeat || Number(resolvePlayerId(targetSeat)) === Number(ui.player_id));
      if (isViewerCollect) {
        ui.collectSent = true;
      }
      try {
        return await tt.ajax("collect", {}, targetSeat);
      } catch (err) {
        if (
          isViewerCollect &&
          ui.gamedatas?.gamestate?.name === "confirmTrick" &&
          typeof ui.isCurrentPlayerActive === "function" &&
          ui.isCurrentPlayerActive()
        ) {
          ui.collectSent = false;
        }
        throw err;
      }
    },

    async wish(rank: any = 15, seat?: any) {
      const ui = getUi();
      const parsedRank = parseRankToken(rank);
      if (!parsedRank || parsedRank < 2 || parsedRank > 15) {
        throw new Error(`Invalid Mahjong wish rank "${rank}". Expected 2..14 or 15 (none).`);
      }
      const st = ui && ui.gamedatas && ui.gamedatas.gamestate;
      const targetSeat =
        seat !== undefined && seat !== null
          ? seat
          : st && st.active_player
            ? Number(st.active_player)
            : undefined;
      return tt.ajax("makeAWish", { wish: parsedRank }, targetSeat);
    },

    async choosePhoenix(rank?: any, seat?: any) {
      const ui = getUi();
      let parsedRank = rank !== undefined ? parseRankToken(rank) : null;
      if (!parsedRank && Array.isArray(ui.allowedValues) && ui.allowedValues.length > 0) {
        parsedRank = Number(ui.allowedValues[0]);
      }
      if (!parsedRank) {
        throw new Error(`Invalid Phoenix value "${rank}"`);
      }
      const st = ui && ui.gamedatas && ui.gamedatas.gamestate;
      const targetSeat =
        seat !== undefined && seat !== null
          ? seat
          : st && st.active_player
            ? Number(st.active_player)
            : undefined;
      return tt.ajax("choosePhoenix", { phoenixValue: parsedRank }, targetSeat);
    },

    async cancelPhoenix(seat?: any) {
      const ui = getUi();
      const st = ui && ui.gamedatas && ui.gamedatas.gamestate;
      const targetSeat =
        seat !== undefined && seat !== null
          ? seat
          : st && st.active_player
            ? Number(st.active_player)
            : undefined;
      return tt.ajax("cancelPhoenix", {}, targetSeat);
    },

    async giveDragon(enemyIndex = 0, seat?: any) {
      const ui = getUi();
      const st = ui && ui.gamedatas && ui.gamedatas.gamestate;
      const targetSeat =
        seat !== undefined && seat !== null
          ? seat
          : st && st.active_player
            ? Number(st.active_player)
            : undefined;
      return tt.ajax("chooseDragonGift", { player: Number(enemyIndex) }, targetSeat);
    },

    async bomb(cards?: any, seat?: any) {
      const ui = getUi();
      const curState = ui.gamedatas && ui.gamedatas.gamestate && ui.gamedatas.gamestate.name;
      if (curState !== "playBomb") {
        await tt.ajax("playBomb", { cards: "" }, seat);
        if (cards === undefined || cards === null) {
          return tt.status(false);
        }
      }
      return tt.play(cards);
    },

    async cancelBomb(seat?: any) {
      return tt.ajax("cancel", {}, seat);
    },

    async step(moves = 1) {
      const ui = getUi();
      if (!ui || !ui.bga || !ui.bga.actions) {
        throw new Error("BGA Studio actions helper is not available");
      }
      clearTimeout(ui.autoCollectTimeout);
      logAnnounce(
        "[TICHU STUDIO STEP]",
        `Running debug_bgaPlayMoves (moves=${moves})...`,
        "#d2a8ff",
      );
      await ui.bga.actions.performAction(
        "debug_bgaPlayMoves",
        { moves: Number(moves) || 1 },
        { checkAction: false, lock: false },
      );
      await waitUntilIdle(15000, speedMode === "instant" ? 45 : 250);
      dismissDialogsIfInstant();
      return tt.status(false);
    },

    async actForOthers(maxSteps = 12) {
      for (let i = 0; i < maxSteps; i++) {
        const s = tt.status(false);
        if (!s || s.state.name === "gameEnd" || s.state.id === 99) break;
        if (s.isMyTurn && s.state.type === "activeplayer") break;
        if (s.isMyTurn && s.state.type === "multipleactiveplayer") break;
        await tt.step(1);
      }
      return tt.status(false);
    },

    async runSmokeTest({
      tricks = 3,
      speed = "instant",
    }: { tricks?: number; speed?: "normal" | "fast" | "instant" } = {}) {
      const t0 = Date.now();
      tt.setSpeed(speed);
      logAnnounce(
        "[TICHU STUDIO SMOKE]",
        `▶ Starting BGA Studio Smoke Test (tricks=${tricks}, speed=${speed})...`,
        "#ffa657",
      );

      let assertionsPassed = 0;
      const checkUI = () => {
        tt.assertUI();
        assertionsPassed++;
      };

      const startStatus = tt.status(false);
      if (!startStatus) throw new Error("Game UI not ready");
      checkUI();

      // 1. Complete Grand Tichu bets if in grandTichuBets (viewer bet + batch step for others)
      let cur = tt.status(false)!;
      let stepsRun = 0;
      if (cur.state.name === "grandTichuBets") {
        if (cur.isMyTurn) {
          cur = (await tt.betGrandTichu(0))!;
          stepsRun++;
        }
        if (cur.state.name === "grandTichuBets") {
          cur = (await tt.step(cur.multiactiveIds.length || 3))!;
          stepsRun++;
        }
        checkUI();
      }

      // 2. Complete passing 3 cards if in giveCards (viewer pass + batch step for others)
      if (cur.state.name === "giveCards") {
        cur = (await tt.passAllCards())!;
        stepsRun += 2;
        checkUI();
      }

      // 3. Play N tricks (viewer plays if leading, then single batch step for the remaining tricks)
      if (cur.isMyTurn && cur.state.name === "playComboOpen") {
        cur = (await tt.play())!;
        stepsRun++;
        checkUI();
      }
      if (cur.state.name === "mahjongPlay") {
        cur = (await tt.wish(15))!;
        stepsRun++;
        checkUI();
      }
      if (cur.state.name !== "gameEnd" && cur.state.id !== 99) {
        cur = (await tt.step(Math.max(4, tricks * 4)))!;
        stepsRun++;
        if (cur.state.name === "confirmTrick") {
          cur = (await tt.collect())!;
          stepsRun++;
        }
        checkUI();
      }

      const elapsedMs = Date.now() - t0;
      const result = {
        ok: true,
        tableId: cur.tableId,
        startState: startStatus.state.name,
        endState: cur.state.name,
        round: cur.round,
        trick: cur.trick,
        viewerHandCount: cur.hand.length,
        stepsRun,
        assertionsPassed,
        elapsedMs,
      };
      logAnnounce(
        "[TICHU STUDIO SMOKE]",
        `✔ PASS in ${elapsedMs}ms — Table #${result.tableId}, State=${result.endState}, Round=${result.round}, Trick=${result.trick}, Assertions=${assertionsPassed}`,
        "#3fb950",
      );
      return result;
    },

    async runRound({
      speed = "instant",
      maxSteps = 12,
    }: { speed?: "normal" | "fast" | "instant"; maxSteps?: number } = {}) {
      const t0 = Date.now();
      tt.setSpeed(speed);
      let cur = tt.status(false)!;
      const initialRound = cur.round;

      let batches = 0;
      while (
        cur.state.name !== "gameEnd" &&
        cur.state.id !== 99 &&
        cur.round === initialRound &&
        batches < maxSteps
      ) {
        cur = (await tt.step(35))!;
        batches++;
      }
      if (cur.state.name === "confirmTrick") {
        cur = (await tt.collect())!;
      }
      dismissDialogsIfInstant();
      if (cur.state.name !== "gameEnd" && cur.state.id !== 99) {
        tt.assertUI();
      }
      return {
        ok: true,
        tableId: cur.tableId,
        initialRound,
        currentRound: cur.round,
        state: cur.state.name,
        batches,
        players: cur.players.map((p: any) => ({
          name: p.name,
          score: p.score,
          handCount: p.handCount,
        })),
        elapsedMs: Date.now() - t0,
      };
    },

    async runGame({
      speed = "instant",
      maxBatches = 40,
    }: { speed?: "normal" | "fast" | "instant"; maxBatches?: number } = {}) {
      const t0 = Date.now();
      tt.setSpeed(speed);
      let cur = tt.status(false)!;
      let batches = 0;
      while (cur.state.name !== "gameEnd" && cur.state.id !== 99 && batches < maxBatches) {
        cur = (await tt.step(50))!;
        batches++;
      }
      return {
        ok: cur.state.name === "gameEnd" || cur.state.id === 99,
        tableId: cur.tableId,
        state: cur.state.name,
        round: cur.round,
        players: cur.players.map((p: any) => ({ name: p.name, score: p.score })),
        elapsedMs: Date.now() - t0,
      };
    },

    async expressStop(tableId?: number) {
      const ui = getUi();
      const tid = Number(tableId || (ui && ui.table_id) || 0);
      if (!tid) throw new Error("No tableId available for expressStop");
      const token = ((window as any).bgaConfig && (window as any).bgaConfig.requestToken) || "";
      const headers: Record<string, string> = token ? { "X-Request-Token": token } : {};
      const r1 = await fetch(
        `/table/table/expressGameStopTable.html?table=${tid}&noerrortracking=true&dojo.preventCache=${Date.now()}`,
        { headers, credentials: "same-origin" },
      ).then((r) => r.json());
      if (!r1 || Number(r1.status) !== 1) {
        await fetch(
          `/table/table/quitgame.html?table=${tid}&neutralized=true&s=table_QuitGame&noerrortracking=true&dojo.preventCache=${Date.now()}`,
          { headers, credentials: "same-origin" },
        ).then((r) => r.json());
      }
      return { ok: true, stoppedTableId: tid };
    },

    async expressStartNew() {
      const ui = getUi();
      const oldTableId = Number((ui && ui.table_id) || 0);
      const gameId = Number((ui && ui.game_id) || 1386);
      const token = ((window as any).bgaConfig && (window as any).bgaConfig.requestToken) || "";
      const headers: Record<string, string> = token ? { "X-Request-Token": token } : {};
      if (oldTableId) {
        try {
          await tt.expressStop(oldTableId);
        } catch (_e) {}
      }
      const cJson = await fetch(
        `/table/table/createnew.html?game=${gameId}&gamemode=realtime&is_meeting=false&forceManual=true&lobbyType=kintsugi&noerrortracking=true&dojo.preventCache=${Date.now()}`,
        { headers, credentials: "same-origin" },
      ).then((r) => r.json());
      if (!cJson || Number(cJson.status) !== 1 || !cJson.data || !cJson.data.table) {
        throw new Error((cJson && cJson.error) || "createnew failed");
      }
      const newTableId = Number(cJson.data.table);
      const sJson = await fetch(
        `/tablemanager/tablemanager/expressStart.html?table=${newTableId}&noerrortracking=true&dojo.preventCache=${Date.now()}`,
        { headers, credentials: "same-origin" },
      ).then((r) => r.json());
      if (!sJson || Number(sJson.status) !== 1) {
        throw new Error((sJson && sJson.error) || "expressStart failed");
      }
      return {
        ok: true,
        stoppedTableId: oldTableId,
        newTableId,
        tableviewUrl: `https://studio.boardgamearena.com/tableview?table=${newTableId}`,
      };
    },

    getConsoleIssues() {
      const ui = getUi();
      const issues: ConsoleIssue[] = [...consoleIssues];
      const breadcrumbs = ui && Array.isArray(ui.debugBreadcrumbs) ? ui.debugBreadcrumbs : [];
      for (let i = 0; i < breadcrumbs.length; i++) {
        const b = breadcrumbs[i];
        if (b && b.cat === "warn") {
          const msg =
            `[tichu breadcrumb] ${b.name} ${b.detail ? JSON.stringify(b.detail) : ""}`.trim();
          if (!issues.some((existing) => existing.message.indexOf(b.name) !== -1)) {
            issues.push({
              ts: b.ts || new Date().toISOString(),
              level: "warn",
              source: "tichu.breadcrumb",
              message: msg,
            });
          }
        }
      }
      return issues;
    },

    clearConsoleIssues() {
      consoleIssues.length = 0;
      return [];
    },

    async actMyTurn() {
      const ui = getUi();
      if (!ui || !ui.gamedatas) {
        throw new Error("window.gameui or gamedatas is not initialized");
      }
      await waitUntilIdle(5000, 30);
      await waitLitUpdates();

      const cur = tt.status(false);
      if (!cur) return { acted: false, reason: "no_status", assertionsPassed: 0 };
      if (cur.state.name === "gameEnd" || cur.state.id === 99) {
        return { acted: false, reason: "game_end", status: cur, assertionsPassed: 0 };
      }
      if (cur.state.type === "game") {
        return { acted: false, reason: "game_state", status: cur, assertionsPassed: 0 };
      }

      let assertionsPassed = 0;
      tt.assertUI();
      assertionsPassed++;

      if (!cur.isMyTurn) {
        return { acted: false, reason: "not_my_turn", status: cur, assertionsPassed };
      }

      let actionDesc = "";
      switch (cur.state.name) {
        case "grandTichuBets": {
          if ((ui.gamedatas.hand || []).length !== 8) {
            if (ui.notifqueue && !ui.notifqueue.notificationResendInProgress) {
              ui.notifqueue.resynchronizeNotifications?.(false);
            }
            return { acted: false, reason: "waiting_8_cards", status: cur, assertionsPassed };
          }
          await tt.betGrandTichu(0);
          actionDesc = "grandTichuBet(0)";
          break;
        }
        case "giveCards": {
          if ((ui.gamedatas.hand || []).length < 14) {
            if (ui.notifqueue && !ui.notifqueue.notificationResendInProgress) {
              ui.notifqueue.resynchronizeNotifications?.(false);
            }
            return { acted: false, reason: "waiting_14_cards", status: cur, assertionsPassed };
          }
          await tt.giveCards();
          actionDesc = "giveCards(3)";
          break;
        }
        case "showPassedCards": {
          await tt.ajax("acceptCards", {});
          actionDesc = "acceptCards";
          break;
        }
        case "playComboOpen":
        case "playCombo": {
          const handCards = ui.gamedatas.hand || [];
          if (handCards.length === 0) {
            throw new Error(`isMyTurn=true in ${cur.state.name} with 0 cards in hand`);
          }
          const cv = (window as any).__tichuComboValidator;
          if (!cv || !cv.Hand || !cv.Combo) {
            throw new Error("__tichuComboValidator is missing on window");
          }
          const hand = new cv.Hand(handCards);
          const gmState = (window as any).gameModel?.getState?.();
          const rawLast = gmState?.trickLastCombo ?? ui.gamedatas.lastCombo;
          const lastCombo =
            cur.state.name === "playComboOpen"
              ? cv.Combo.noCombo
              : cv.Combo.fromLastComboState(rawLast);
          const wish = Number(ui.gamedatas.mahjongWish || 0);
          const mustWish =
            wish >= 2 && wish <= 14 && hand.canFulFillWish(wish, lastCombo) ? wish : 0;
          const playable = hand.findPlayableCombo(lastCombo, mustWish);
          if (playable !== null) {
            const ids = playable.cards.map((c: any) => `#${c.id}`).join(";");
            await tt.play(ids);
            actionDesc = `play(${playable.cards.map((c: any) => formatCardCode(c)).join(",")})`;
          } else if (cur.state.name === "playCombo") {
            await tt.pass(true);
            actionDesc = "pass(once)";
          } else {
            throw new Error("No playable combo found in playComboOpen");
          }
          break;
        }
        case "mahjongPlay": {
          const handRanks = new Set((ui.gamedatas.hand || []).map((c: any) => Number(c.type_arg)));
          const wishRank = Number(cur.round) === 1 && !handRanks.has(8) ? 8 : 15;
          await tt.wish(wishRank);
          actionDesc = `wish(${wishRank})`;
          break;
        }
        case "phoenixPlay": {
          await tt.choosePhoenix();
          actionDesc = "choosePhoenix";
          break;
        }
        case "confirmTrick": {
          await tt.collect();
          actionDesc = "collect";
          break;
        }
        case "chooseDragonGift": {
          await tt.giveDragon(0);
          actionDesc = "giveDragon(0)";
          break;
        }
        case "playBomb": {
          await tt.cancelBomb();
          actionDesc = "cancelBomb";
          break;
        }
        default:
          throw new Error(`Unhandled active state in actMyTurn: ${cur.state.name}`);
      }

      await waitUntilIdle(5000, 30);
      await waitLitUpdates();
      const after = tt.status(false);
      if (after && after.state.name !== "endRound" && after.state.name !== "newRound") {
        tt.assertUI();
        assertionsPassed++;
      }

      return {
        acted: true,
        stateBefore: cur.state.name,
        action: actionDesc,
        status: after,
        assertionsPassed,
      };
    },

    autoPlayStatus() {
      const cur = tt.status(false);
      const issues = tt.getConsoleIssues();
      return {
        running: autoPlayCtrl.running,
        tableId: cur?.tableId ?? autoPlayCtrl.tableId,
        player: cur?.viewer ?? autoPlayCtrl.player,
        playerId: cur?.viewerId ?? autoPlayCtrl.playerId,
        seat: autoPlayCtrl.seat,
        movesPlayed: autoPlayCtrl.movesPlayed,
        assertionsPassed: autoPlayCtrl.assertionsPassed,
        round: cur?.round ?? autoPlayCtrl.lastRound,
        trick: cur?.trick ?? autoPlayCtrl.lastTrick,
        state: cur?.state ?? { name: autoPlayCtrl.lastState },
        players: cur?.players?.map((p: any) => ({
          seat: p.seat,
          id: p.id,
          name: p.name,
          score: p.score,
          handCount: p.handCount,
        })),
        consoleIssueCount: issues.length,
        consoleIssues: issues,
        actionErrors: autoPlayCtrl.actionErrors,
        elapsedMs: autoPlayCtrl.startedAt ? Date.now() - autoPlayCtrl.startedAt : 0,
      };
    },

    stopAutoPlayMe(reason = "stopped_by_user") {
      if (!autoPlayCtrl.running) {
        return tt.autoPlayStatus();
      }
      autoPlayCtrl.stopRequested = true;
      autoPlayCtrl.stopReason = reason;
      autoPlayCtrl.kick();
      return tt.autoPlayStatus();
    },

    startAutoPlayMe({
      timeoutMs = 600000,
      staggerMs = 350,
    }: { timeoutMs?: number; staggerMs?: number } = {}) {
      if (autoPlayCtrl.running) {
        tt.stopAutoPlayMe("restarted");
      }
      tt.setSpeed("instant");
      const ui = getUi();
      const initStatus = tt.status(false);
      if (!ui || !initStatus) {
        throw new Error("Game UI not ready for startAutoPlayMe");
      }
      const players = getSortedPlayers();
      const myPlayerId = Number(ui.player_id);
      const mySeat = players.findIndex((p: any) => Number(p.id) === myPlayerId);

      autoPlayCtrl.running = true;
      autoPlayCtrl.stopRequested = false;
      autoPlayCtrl.stopReason = "";
      autoPlayCtrl.tableId = initStatus.tableId;
      autoPlayCtrl.player = initStatus.viewer;
      autoPlayCtrl.playerId = myPlayerId;
      autoPlayCtrl.seat = mySeat;
      autoPlayCtrl.movesPlayed = 0;
      autoPlayCtrl.assertionsPassed = 0;
      autoPlayCtrl.actionErrors = [];
      autoPlayCtrl.moveHistory = [];
      autoPlayCtrl.startedAt = Date.now();
      autoPlayCtrl.lastRound = initStatus.round;
      autoPlayCtrl.lastTrick = initStatus.trick;
      autoPlayCtrl.lastState = initStatus.state.name;

      logAnnounce(
        "[TICHU AUTOPLAY]",
        `▶ Starting real-player loop for ${initStatus.viewer} (seat ${mySeat}) on Table #${initStatus.tableId}`,
        "#3fb950",
      );

      return new Promise((resolve) => {
        let ticking = false;
        let finished = false;
        let lastProgressAt = Date.now();
        let lastResyncAt = 0;
        let multiactiveKey = "";
        let multiactiveSeenAt = 0;
        let intervalId: number | null = null;
        const dojoSubs: any[] = [];
        const mc = typeof MessageChannel !== "undefined" ? new MessageChannel() : null;

        const outEl = document.getElementById("tt_test_output");
        const writeLiveOutput = (cur: any) => {
          if (!outEl || finished) return;
          const issues = tt.getConsoleIssues();
          outEl.setAttribute("data-done", "0");
          outEl.setAttribute("data-status", "running");
          outEl.style.color = "#d29922";
          outEl.textContent = JSON.stringify({
            running: true,
            tableId: cur?.tableId ?? autoPlayCtrl.tableId,
            player: autoPlayCtrl.player,
            seat: autoPlayCtrl.seat,
            movesPlayed: autoPlayCtrl.movesPlayed,
            assertionsPassed: autoPlayCtrl.assertionsPassed,
            round: cur?.round ?? autoPlayCtrl.lastRound,
            trick: cur?.trick ?? autoPlayCtrl.lastTrick,
            state: cur?.state?.name ?? autoPlayCtrl.lastState,
            scores: cur?.players?.map((p: any) => p.score) ?? [],
            consoleIssueCount: issues.length,
            actionErrorCount: autoPlayCtrl.actionErrors.length,
            elapsedMs: Date.now() - autoPlayCtrl.startedAt,
          });
        };

        const cleanup = () => {
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          const dojoObj = (window as any).dojo;
          if (dojoObj && typeof dojoObj.unsubscribe === "function") {
            for (let i = 0; i < dojoSubs.length; i++) {
              try {
                dojoObj.unsubscribe(dojoSubs[i]);
              } catch (_e) {}
            }
          }
          dojoSubs.length = 0;
          if (mc) {
            try {
              mc.port1.close();
              mc.port2.close();
            } catch (_e) {}
          }
          autoPlayCtrl.running = false;
          autoPlayCtrl.kick = () => {};
        };

        const finish = (okOverride?: boolean, extraError?: string) => {
          if (finished) return;
          finished = true;
          cleanup();
          const cur = tt.status(false);
          const issues = tt.getConsoleIssues();
          if (extraError) {
            autoPlayCtrl.actionErrors.push({
              ts: new Date().toISOString(),
              state: cur?.state?.name || autoPlayCtrl.lastState,
              error: extraError,
            });
          }
          const ok =
            okOverride !== undefined
              ? okOverride && issues.length === 0 && autoPlayCtrl.actionErrors.length === 0
              : (cur?.state?.name === "gameEnd" || cur?.state?.id === 99) &&
                issues.length === 0 &&
                autoPlayCtrl.actionErrors.length === 0;
          const summary = {
            ok,
            tableId: cur?.tableId ?? autoPlayCtrl.tableId,
            player: autoPlayCtrl.player,
            playerId: autoPlayCtrl.playerId,
            seat: autoPlayCtrl.seat,
            movesPlayed: autoPlayCtrl.movesPlayed,
            assertionsPassed: autoPlayCtrl.assertionsPassed,
            round: cur?.round ?? autoPlayCtrl.lastRound,
            trick: cur?.trick ?? autoPlayCtrl.lastTrick,
            state: cur?.state ?? { name: autoPlayCtrl.lastState },
            players:
              cur?.players?.map((p: any) => ({
                seat: p.seat,
                id: p.id,
                name: p.name,
                score: p.score,
              })) ?? [],
            consoleIssueCount: issues.length,
            consoleIssues: issues,
            actionErrors: autoPlayCtrl.actionErrors,
            stopReason: autoPlayCtrl.stopReason || undefined,
            elapsedMs: Date.now() - autoPlayCtrl.startedAt,
            moveHistory: autoPlayCtrl.moveHistory.slice(-25),
          };
          logAnnounce(
            "[TICHU AUTOPLAY]",
            `${ok ? "✔ DONE" : "✘ FINISHED WITH ISSUES"} — ${summary.player}: moves=${summary.movesPlayed}, assertions=${summary.assertionsPassed}, issues=${summary.consoleIssueCount}, errors=${summary.actionErrors.length}`,
            ok ? "#3fb950" : "#f85149",
          );
          resolve(summary);
        };

        const checkPrevpacketBuffer = () => {
          const nq = ui?.notifqueue;
          if (!nq || !Array.isArray(nq.prevpacketBuffer) || nq.prevpacketBuffer.length === 0) {
            return;
          }
          if (nq.notificationResendInProgress) return;
          const now = Date.now();
          let oldestAge = 0;
          for (let i = 0; i < nq.prevpacketBuffer.length; i++) {
            const age = now - Number(nq.prevpacketBuffer[i]?.bufferedAt || now);
            if (age > oldestAge) oldestAge = age;
          }
          if (oldestAge > 350 && now - lastResyncAt > 500) {
            lastResyncAt = now;
            nq.resynchronizeNotifications?.(false);
          }
        };

        const tick = async () => {
          if (ticking || finished) return;
          if (autoPlayCtrl.stopRequested) {
            finish(false, autoPlayCtrl.stopReason || "stopped");
            return;
          }
          if (Date.now() - autoPlayCtrl.startedAt > timeoutMs) {
            finish(false, `AutoPlay timed out after ${timeoutMs}ms`);
            return;
          }
          ticking = true;
          try {
            checkPrevpacketBuffer();
            if (isQueueBusy()) {
              return;
            }
            await waitLitUpdates();
            const cur = tt.status(false);
            if (!cur) return;

            const stateSig = `${cur.round}:${cur.trick}:${cur.state.name}:${cur.activePlayerId}:${cur.multiactiveIds.join(",")}`;
            if (
              cur.round !== autoPlayCtrl.lastRound ||
              cur.trick !== autoPlayCtrl.lastTrick ||
              cur.state.name !== autoPlayCtrl.lastState
            ) {
              lastProgressAt = Date.now();
            }
            autoPlayCtrl.lastRound = cur.round;
            autoPlayCtrl.lastTrick = cur.trick;
            autoPlayCtrl.lastState = cur.state.name;
            writeLiveOutput(cur);

            if (cur.state.name === "gameEnd" || cur.state.id === 99) {
              finish();
              return;
            }

            if (cur.state.type === "multipleactiveplayer" && cur.isMyTurn) {
              const key = `${cur.round}:${cur.state.name}`;
              if (multiactiveKey !== key) {
                multiactiveKey = key;
                multiactiveSeenAt = Date.now();
              }
              const targetWait = Math.max(0, mySeat) * staggerMs;
              const elapsedWait = Date.now() - multiactiveSeenAt;
              if (elapsedWait < targetWait) {
                setTimeout(scheduleKick, Math.max(20, targetWait - elapsedWait));
                return;
              }
            } else {
              multiactiveKey = "";
            }

            if (!cur.isMyTurn) {
              if (
                Date.now() - lastProgressAt > 15000 &&
                Date.now() - lastResyncAt > 5000 &&
                ui.notifqueue &&
                !ui.notifqueue.notificationResendInProgress
              ) {
                lastResyncAt = Date.now();
                ui.notifqueue.resynchronizeNotifications?.(false);
              }
              return;
            }

            let actedOk = false;
            let lastErr: any = null;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const res = await tt.actMyTurn();
                autoPlayCtrl.assertionsPassed += res.assertionsPassed || 0;
                if (res.acted) {
                  autoPlayCtrl.movesPlayed++;
                  lastProgressAt = Date.now();
                  autoPlayCtrl.moveHistory.push({
                    move: autoPlayCtrl.movesPlayed,
                    round: cur.round,
                    trick: cur.trick,
                    state: res.stateBefore || cur.state.name,
                    action: res.action || "",
                  });
                  if (autoPlayCtrl.moveHistory.length > 50) {
                    autoPlayCtrl.moveHistory.shift();
                  }
                  writeLiveOutput(res.status || tt.status(false));
                  actedOk = true;
                } else if (res.reason === "waiting_8_cards" || res.reason === "waiting_14_cards") {
                  setTimeout(scheduleKick, 120);
                  actedOk = true;
                } else {
                  actedOk = true;
                }
                break;
              } catch (err: any) {
                lastErr = err;
                const msg = (err && err.message) || String(err);
                autoPlayCtrl.actionErrors.push({
                  ts: new Date().toISOString(),
                  state: cur.state.name,
                  error: `attempt ${attempt + 1} (${stateSig}): ${msg}`,
                });
                if (attempt < 2) {
                  await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
                  await waitUntilIdle(5000, 30);
                  const recheck = tt.status(false);
                  if (!recheck || !recheck.isMyTurn || recheck.state.name === "gameEnd") {
                    actedOk = true;
                    break;
                  }
                }
              }
            }
            if (!actedOk && lastErr) {
              finish(false, (lastErr && lastErr.message) || String(lastErr));
              return;
            }
            const afterCur = tt.status(false);
            if (afterCur && (afterCur.state.name === "gameEnd" || afterCur.state.id === 99)) {
              finish();
              return;
            }
          } catch (outerErr: any) {
            finish(false, (outerErr && outerErr.message) || String(outerErr));
          } finally {
            ticking = false;
          }
        };

        let kickQueued = false;
        const scheduleKick = () => {
          if (finished || kickQueued) return;
          kickQueued = true;
          const runKick = () => {
            kickQueued = false;
            void tick();
          };
          if (mc) {
            mc.port2.postMessage(null);
          } else {
            void nextMicrotaskTick().then(runKick);
          }
        };
        if (mc) {
          mc.port1.onmessage = () => {
            kickQueued = false;
            void tick();
          };
        }

        autoPlayCtrl.kick = scheduleKick;

        const dojoObj = (window as any).dojo;
        if (dojoObj && typeof dojoObj.subscribe === "function") {
          for (const topic of [
            "gameStateChange",
            "gameStateMultipleActiveUpdate",
            "dealCards",
            "acceptCards",
            "playCombo",
            "pass",
            "newScores",
          ]) {
            dojoSubs.push(dojoObj.subscribe(topic, null, () => scheduleKick()));
          }
        }

        intervalId = window.setInterval(scheduleKick, 250);
        scheduleKick();
      });
    },
  };

  const autoPlayCtrl = {
    running: false,
    stopRequested: false,
    stopReason: "",
    tableId: 0,
    player: "",
    playerId: 0,
    seat: -1,
    movesPlayed: 0,
    assertionsPassed: 0,
    actionErrors: [] as Array<{ ts: string; state: string; error: string }>,
    moveHistory: [] as Array<{
      move: number;
      round: number;
      trick: number;
      state: string;
      action: string;
    }>,
    startedAt: 0,
    lastRound: 0,
    lastTrick: 0,
    lastState: "",
    kick: () => {},
  };

  function mountStudioTestBar() {
    if ((window as any).g_archive_mode) return;
    if (document.getElementById("studio-test-bar")) return;
    const wrap = document.getElementById("game_play_area_wrap");
    if (!wrap || !wrap.parentNode) return;

    if (!document.getElementById("studio-test-bar-styles")) {
      const styleEl = document.createElement("style");
      styleEl.id = "studio-test-bar-styles";
      styleEl.textContent = `
        #studio-test-bar {
          background: #0d1117;
          color: #e6edf3;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 5px 8px;
          margin: 4px auto 6px auto;
          width: 100%;
          max-width: 700px;
          box-sizing: border-box;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          z-index: 100;
          position: relative;
        }
        #studio-test-bar.is-collapsed {
          width: fit-content;
          padding: 3px 8px;
          gap: 0;
        }
        #studio-test-bar.is-collapsed #tt_bar_body {
          display: none;
        }
        #studio-test-bar.is-dismissed {
          display: none;
        }
        #studio-test-restore {
          display: none;
          align-items: center;
          justify-content: center;
          gap: 4px;
          background: #0d1117;
          color: #58a6ff;
          border: 1px solid #30363d;
          border-radius: 4px;
          padding: 2px 7px;
          margin: 4px auto 6px auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10px;
          font-weight: bold;
          cursor: pointer;
          width: fit-content !important;
          z-index: 100;
          position: relative;
        }
        #studio-test-restore.is-visible {
          display: flex;
        }
        #studio-test-restore:hover {
          background: #161b22;
          border-color: #58a6ff;
        }
        #studio-test-bar button {
          width: auto !important;
          min-width: 0;
          margin: 0;
          background: #21262d;
          color: #e6edf3;
          border: 1px solid #30363d;
          border-radius: 4px;
          padding: 2px 6px;
          height: 22px;
          line-height: 16px;
          cursor: pointer;
          font-family: inherit;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        #studio-test-bar button:hover {
          background: #30363d;
          border-color: #8b949e;
        }
        #studio-test-bar button.tt-btn-primary {
          background: #238636;
          color: #ffffff;
          border-color: #2ea043;
          font-weight: bold;
        }
        #studio-test-bar button.tt-btn-primary:hover {
          background: #2ea043;
          border-color: #3fb950;
        }
        #studio-test-bar button.tt-btn-danger {
          background: #da3633;
          color: #ffffff;
          border-color: #f85149;
        }
        #studio-test-bar button.tt-btn-danger:hover {
          background: #f85149;
          border-color: #ff7b72;
        }
        #studio-test-bar button.tt-btn-icon {
          padding: 1px 5px;
          height: 18px;
          font-size: 10px;
          color: #8b949e;
          background: transparent;
          border-color: transparent;
        }
        #studio-test-bar button.tt-btn-icon:hover {
          color: #e6edf3;
          background: #21262d;
          border-color: #30363d;
        }
        #tt_bar_header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-height: 18px;
        }
        #tt_bar_body {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        #tt_btn_grid,
        #tt_cmd_row,
        #tt_output_row {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 4px;
          align-items: start;
        }
        #tt_btn_grid button,
        #tt_cmd_run,
        #tt_output_toggle {
          width: 100% !important;
        }
        #tt_cmd_input,
        #tt_test_output {
          grid-column: span 4;
          width: 100% !important;
          min-width: 0;
          box-sizing: border-box;
        }
        @media (max-width: 560px) {
          #tt_btn_grid,
          #tt_cmd_row,
          #tt_output_row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          #tt_cmd_input,
          #tt_test_output {
            grid-column: span 1;
          }
        }
        #tt_cmd_input {
          height: 22px;
          background: #161b22;
          color: #e6edf3;
          border: 1px solid #30363d;
          border-radius: 4px;
          padding: 2px 6px;
          font-family: inherit;
          font-size: 11px;
        }
        #tt_cmd_input:focus {
          outline: none;
          border-color: #58a6ff;
        }
        #tt_test_output {
          margin: 0;
          padding: 2px 6px;
          height: 22px;
          line-height: 16px;
          background: #161b22;
          border: 1px solid #21262d;
          border-radius: 4px;
          color: #8b949e;
          font-family: inherit;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
        }
        #tt_test_output.is-expanded {
          height: auto;
          max-height: 200px;
          padding: 4px 6px;
          white-space: pre-wrap;
          word-break: break-word;
          overflow: auto;
        }
        #studio-test-tooltip {
          position: fixed;
          z-index: 100000;
          max-width: 320px;
          background: #161b22;
          color: #e6edf3;
          border: 1px solid #58a6ff;
          border-radius: 5px;
          padding: 5px 8px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          line-height: 1.35;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.1s ease;
        }
        #studio-test-tooltip.is-visible {
          opacity: 1;
          visibility: visible;
        }
      `;
      document.head.appendChild(styleEl);
    }

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const tips = {
      smoke: esc(
        "Run full Studio smoke test: completes Grand Tichu bets, passes 3 cards for all players, plays 3 tricks at instant speed, and verifies DOM/UI state invariants (tt.runSmokeTest).",
      ),
      round: esc(
        "Fast-forward the current round to completion using server bot moves (debug_bgaPlayMoves) at instant speed and verify UI state (tt.runRound).",
      ),
      game: esc(
        "Fast-forward the entire game to Game End (state 99) using server bot moves at instant speed (tt.runGame).",
      ),
      gtAll: esc(
        "Decline Grand Tichu (bet 0) for all 4 players in the current tab without switching player views (tt.betAllGrandTichu).",
      ),
      passAll: esc(
        "Select and pass 3 default low singleton cards for the active viewer and step server bots for the other 3 players (tt.passAllCards).",
      ),
      step1: esc(
        "Execute 1 automated server bot move (zombieTurn via debug_bgaPlayMoves) for whichever player is currently active (tt.step(1)).",
      ),
      others: esc(
        "Step server bot moves for the other players until it is your turn to act again (tt.actForOthers).",
      ),
      assert: esc(
        "Verify that live DOM elements (hand cards, round/trick/points counters, player hand counts) match gamedatas and output table status JSON (tt.assertUI + tt.status).",
      ),
      newTable: esc(
        "Stop the current table, create a new 4-player Tichu table, and express-start it via BGA Studio endpoints (tt.expressStartNew).",
      ),
      stopTable: esc("Immediately abort and close the current BGA Studio table (tt.expressStop)."),
      cmdInput: esc(
        "Type any window.tt method with optional colon argument — e.g. status, hand, assertUI, wish:8, play:S10, pass, step:4, giveDragon:0. Press Enter or click Run.",
      ),
      cmdRun: esc(
        "Execute the window.tt command from the input box and display its JSON result below.",
      ),
      output: esc(
        "Click to toggle between single-line compact JSON and expanded multi-line formatted JSON.",
      ),
      outputToggle: esc(
        "Expand or collapse the JSON output area between 1 line and a larger multi-line box.",
      ),
      collapse: esc("Collapse or expand the Studio Test controls."),
      dismiss: esc(
        "Dismiss the Studio Test widget into a tiny restore pill (or run tt.showBar() in console).",
      ),
      restore: esc("Restore the BGA Studio Test widget (window.tt)."),
    };

    const bar = document.createElement("div");
    bar.id = "studio-test-bar";

    bar.innerHTML =
      `<div id="tt_bar_header">` +
      `<div style="display:flex;align-items:center;gap:6px;cursor:pointer;" id="tt_header_title" data-tooltip="${tips.collapse}">` +
      `<strong style="color:#58a6ff;">⚡ Studio Test (window.tt)</strong>` +
      `</div>` +
      `<div style="display:flex;align-items:center;gap:2px;">` +
      `<button type="button" id="tt_btn_collapse" class="tt-btn-icon" data-tooltip="${tips.collapse}">▾ Collapse</button>` +
      `<button type="button" id="tt_btn_dismiss" class="tt-btn-icon" data-tooltip="${tips.dismiss}">✕</button>` +
      `</div>` +
      `</div>` +
      `<div id="tt_bar_body">` +
      `<div id="tt_btn_grid">` +
      `<button type="button" id="tt_btn_smoke" class="tt-btn-primary" data-tooltip="${tips.smoke}">🧪 Smoke Test</button>` +
      `<button type="button" id="tt_btn_round" data-tooltip="${tips.round}">🏁 Run Round</button>` +
      `<button type="button" id="tt_btn_game" data-tooltip="${tips.game}">🏆 Run Game</button>` +
      `<button type="button" id="tt_btn_gt_all" data-tooltip="${tips.gtAll}">⚡ GT Bet All 4</button>` +
      `<button type="button" id="tt_btn_pass_all" data-tooltip="${tips.passAll}">🃏 Pass 3 + Bots</button>` +
      `<button type="button" id="tt_btn_step1" data-tooltip="${tips.step1}">🤖 Step 1</button>` +
      `<button type="button" id="tt_btn_others" data-tooltip="${tips.others}">🤖 Act for Others</button>` +
      `<button type="button" id="tt_btn_assert" data-tooltip="${tips.assert}">✔ Assert UI</button>` +
      `<button type="button" id="tt_btn_new" data-tooltip="${tips.newTable}">🔄 New Table</button>` +
      `<button type="button" id="tt_btn_stop" class="tt-btn-danger" data-tooltip="${tips.stopTable}">⏹ Express Stop</button>` +
      `</div>` +
      `<div id="tt_cmd_row">` +
      `<input type="text" id="tt_cmd_input" placeholder="Command: e.g. status, hand, wish:8, play:S10, step:4" data-tooltip="${tips.cmdInput}" />` +
      `<button type="button" id="tt_cmd_run" data-tooltip="${tips.cmdRun}">▶ Run</button>` +
      `</div>` +
      `<div id="tt_output_row">` +
      `<pre id="tt_test_output" data-done="1" data-status="ready" data-tooltip="${tips.output}">Ready — click a button or run \`await tt.runSmokeTest()\` in console.</pre>` +
      `<button type="button" id="tt_output_toggle" data-tooltip="${tips.outputToggle}">▾ Expand</button>` +
      `</div>` +
      `</div>`;

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.id = "studio-test-restore";
    restoreBtn.setAttribute("data-tooltip", tips.restore);
    restoreBtn.textContent = "⚡ TT";

    wrap.parentNode.insertBefore(restoreBtn, wrap);
    wrap.parentNode.insertBefore(bar, wrap);

    // Custom instant tooltip handler
    let tipEl = document.getElementById("studio-test-tooltip");
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.id = "studio-test-tooltip";
      tipEl.setAttribute("role", "tooltip");
      document.body.appendChild(tipEl);
    }
    const hideTip = () => {
      if (tipEl) tipEl.classList.remove("is-visible");
    };
    const showTipFor = (target: EventTarget | null) => {
      if (!tipEl || !(target instanceof Element)) {
        hideTip();
        return;
      }
      const host = target.closest("[data-tooltip]");
      if (!host || (!bar.contains(host) && host !== restoreBtn)) {
        hideTip();
        return;
      }
      const text = host.getAttribute("data-tooltip");
      if (!text) {
        hideTip();
        return;
      }
      tipEl.textContent = text;
      tipEl.classList.add("is-visible");
      const rect = host.getBoundingClientRect();
      const tipWidth = tipEl.offsetWidth || 260;
      const tipHeight = tipEl.offsetHeight || 36;
      const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - tipWidth - 8));
      const top =
        rect.bottom + tipHeight + 12 > window.innerHeight
          ? Math.max(8, rect.top - tipHeight - 6)
          : rect.bottom + 6;
      tipEl.style.left = `${Math.round(left)}px`;
      tipEl.style.top = `${Math.round(top)}px`;
    };

    bar.addEventListener("mouseover", (e) => showTipFor(e.target));
    bar.addEventListener("focusin", (e) => showTipFor(e.target));
    bar.addEventListener("mouseout", (e) => {
      const next = e.relatedTarget as Element | null;
      if (!next || !bar.contains(next) || !next.closest("[data-tooltip]")) {
        hideTip();
      }
    });
    bar.addEventListener("focusout", hideTip);
    bar.addEventListener("mousedown", hideTip);
    restoreBtn.addEventListener("mouseover", (e) => showTipFor(e.target));
    restoreBtn.addEventListener("mouseout", hideTip);
    restoreBtn.addEventListener("mousedown", hideTip);

    // Collapse / Expand / Dismiss handlers
    const collapseBtn = document.getElementById("tt_btn_collapse");
    const headerTitle = document.getElementById("tt_header_title");
    const dismissBtn = document.getElementById("tt_btn_dismiss");

    const setCollapsed = (collapsed: boolean) => {
      hideTip();
      bar.classList.toggle("is-collapsed", collapsed);
      if (collapseBtn) {
        collapseBtn.textContent = collapsed ? "▸ Expand" : "▾ Collapse";
      }
    };
    const toggleCollapsed = () => setCollapsed(!bar.classList.contains("is-collapsed"));

    if (collapseBtn) collapseBtn.addEventListener("click", toggleCollapsed);
    if (headerTitle) headerTitle.addEventListener("click", toggleCollapsed);
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        hideTip();
        bar.classList.add("is-dismissed");
        restoreBtn.classList.add("is-visible");
      });
    }
    restoreBtn.addEventListener("click", () => {
      hideTip();
      restoreBtn.classList.remove("is-visible");
      bar.classList.remove("is-dismissed");
      setCollapsed(false);
    });
    (tt as any).showBar = () => {
      restoreBtn.classList.remove("is-visible");
      bar.classList.remove("is-dismissed");
      setCollapsed(false);
    };

    // Output 1-line vs expanded toggle
    const outEl = document.getElementById("tt_test_output")!;
    const outToggleBtn = document.getElementById("tt_output_toggle");
    let lastJsonValue: any = undefined;
    let hasJsonValue = false;

    const renderOutputText = () => {
      if (!hasJsonValue) return;
      const expanded = outEl.classList.contains("is-expanded");
      outEl.textContent = expanded
        ? JSON.stringify(lastJsonValue, null, 2)
        : JSON.stringify(lastJsonValue);
    };

    const toggleOutputExpanded = () => {
      const expanded = outEl.classList.toggle("is-expanded");
      if (outToggleBtn) {
        outToggleBtn.textContent = expanded ? "▴ Collapse" : "▾ Expand";
      }
      renderOutputText();
    };

    outEl.addEventListener("click", toggleOutputExpanded);
    if (outToggleBtn) {
      outToggleBtn.addEventListener("click", toggleOutputExpanded);
    }

    const runTask = async (label: string, fn: () => Promise<any> | any) => {
      hasJsonValue = false;
      outEl.setAttribute("data-done", "0");
      outEl.setAttribute("data-status", "running");
      outEl.style.color = "#d29922";
      outEl.textContent = `Running ${label}...`;
      try {
        const res = await fn();
        lastJsonValue = res;
        hasJsonValue = true;
        const isFail = Boolean(res && typeof res === "object" && res.ok === false);
        outEl.setAttribute("data-status", isFail ? "fail" : "pass");
        outEl.setAttribute("data-done", "1");
        outEl.style.color = isFail ? "#f85149" : "#3fb950";
        renderOutputText();
      } catch (err: any) {
        lastJsonValue = {
          ok: false,
          error: (err && err.message) || String(err),
        };
        hasJsonValue = true;
        outEl.setAttribute("data-status", "fail");
        outEl.setAttribute("data-done", "1");
        outEl.style.color = "#f85149";
        renderOutputText();
      }
    };

    const bind = (id: string, label: string, fn: () => Promise<any> | any) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", () => runTask(label, fn));
      }
    };

    bind("tt_btn_smoke", "runSmokeTest", () => tt.runSmokeTest({ tricks: 3, speed: "instant" }));
    bind("tt_btn_round", "runRound", () => tt.runRound({ speed: "instant" }));
    bind("tt_btn_game", "runGame", () => tt.runGame({ speed: "instant" }));
    bind("tt_btn_gt_all", "betAllGrandTichu", () => tt.betAllGrandTichu([0, 0, 0, 0]));
    bind("tt_btn_pass_all", "passAllCards", () => tt.passAllCards());
    bind("tt_btn_step1", "step(1)", () => tt.step(1));
    bind("tt_btn_others", "actForOthers", () => tt.actForOthers());
    bind("tt_btn_assert", "assertUI + status", () => ({
      ui: tt.assertUI(),
      status: tt.status(false),
    }));
    bind("tt_btn_new", "expressStartNew", () => tt.expressStartNew());
    bind("tt_btn_stop", "expressStop", () => tt.expressStop());

    const cmdBtn = document.getElementById("tt_cmd_run");
    const cmdInput = document.getElementById("tt_cmd_input") as HTMLInputElement | null;
    if (cmdBtn && cmdInput) {
      const executeCmd = () => {
        const raw = (cmdInput.value || "").trim();
        if (!raw) return;
        const colonIdx = raw.indexOf(":");
        const method = (colonIdx === -1 ? raw : raw.slice(0, colonIdx)).trim();
        const argRaw = colonIdx === -1 ? undefined : raw.slice(colonIdx + 1).trim();
        runTask(raw, async () => {
          const fn = (tt as any)[method];
          if (typeof fn !== "function") {
            throw new Error(`Unknown tt method: "${method}"`);
          }
          if (argRaw === undefined || argRaw === "") {
            return await fn.call(tt);
          }
          let parsedArg: any = argRaw;
          try {
            parsedArg = JSON.parse(argRaw);
          } catch (_e) {
            // Keep string if not JSON
          }
          return await fn.call(tt, parsedArg);
        });
      };
      cmdBtn.addEventListener("click", executeCmd);
      cmdInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          executeCmd();
        }
      });
    }
  }

  mountStudioTestBar();

  win.tt = tt;
  win.tichuTest = tt;
  try {
    if (window.parent && window.parent !== window) {
      (window.parent as any).tt = tt;
      (window.parent as any).tichuTest = tt;
      (window.parent as any).gameui = getUi();
    }
  } catch (_e) {
    // Ignore cross-origin frame access errors if any
  }

  logAnnounce(
    "[TICHU STUDIO READY]",
    "Console runner `window.tt` & `#studio-test-bar` attached. Type `tt.help()` or click `🧪 Smoke Test`.",
    "#3fb950",
  );
}
