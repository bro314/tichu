export type AnimPresetName = "snappy" | "legacy" | "fast" | "relaxed";

export interface AnimTimings {
  easing: string;
  fastScale: number;
  cardSelectMs: number;
  cardGlowMs: number;
  winningHighlightMs: number;
  handFlipMs: number;
  playComboMs: number;
  playComboStaggerMs: number;
  playBombMs: number;
  playBombStaggerMs: number;
  playBombPulseScale: number;
  playComboBufferMs: number;
  opponentStartScale: number;
  passPopMs: number;
  passNotifMs: number;
  captureSweepMs: number;
  captureStaggerMs: number;
  captureWinnerLingerMs: number;
  captureSoloLingerMs: number;
  captureBufferMs: number;
  dealCardMs: number;
  dealStaggerMs: number;
  dealBufferMs: number;
  passSlotMoveMs: number;
  passReturnStaggerMs: number;
  passOutMs: number;
  passOutStaggerMs: number;
  passOutBufferMs: number;
  acceptViewDelayMs: number;
  acceptFlightMs: number;
  acceptStaggerMs: number;
  acceptBufferMs: number;
  betSplashEnterMs: number;
  betSplashHoldMs: number;
  betSplashFadeMs: number;
  betSplashNotifMs: number;
  wishMadeNotifMs: number;
  newScoresNotifMs: number;
}

export const DEFAULT_ANIM_TIMINGS: AnimTimings = {
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  fastScale: 0.15,
  cardSelectMs: 100,
  cardGlowMs: 120,
  winningHighlightMs: 100,
  handFlipMs: 170,
  playComboMs: 180,
  playComboStaggerMs: 12,
  playBombMs: 200,
  playBombStaggerMs: 10,
  playBombPulseScale: 1.15,
  playComboBufferMs: 20,
  opponentStartScale: 0.58,
  passPopMs: 120,
  passNotifMs: 130,
  captureSweepMs: 200,
  captureStaggerMs: 10,
  captureWinnerLingerMs: 100,
  captureSoloLingerMs: 40,
  captureBufferMs: 30,
  dealCardMs: 170,
  dealStaggerMs: 18,
  dealBufferMs: 25,
  passSlotMoveMs: 160,
  passReturnStaggerMs: 18,
  passOutMs: 180,
  passOutStaggerMs: 18,
  passOutBufferMs: 25,
  acceptViewDelayMs: 850,
  acceptFlightMs: 200,
  acceptStaggerMs: 22,
  acceptBufferMs: 25,
  betSplashEnterMs: 140,
  betSplashHoldMs: 600,
  betSplashFadeMs: 350,
  betSplashNotifMs: 600,
  wishMadeNotifMs: 150,
  newScoresNotifMs: 700,
};

export const ANIM_PRESETS: Record<AnimPresetName, AnimTimings> = {
  snappy: { ...DEFAULT_ANIM_TIMINGS },
  legacy: {
    easing: DEFAULT_ANIM_TIMINGS.easing,
    fastScale: DEFAULT_ANIM_TIMINGS.fastScale,
    cardSelectMs: 0,
    cardGlowMs: 280,
    winningHighlightMs: 120,
    handFlipMs: 220,
    playComboMs: 250,
    playComboStaggerMs: 20,
    playBombMs: 320,
    playBombStaggerMs: 20,
    playBombPulseScale: 1.12,
    playComboBufferMs: 40,
    opponentStartScale: 0.36,
    passPopMs: 0,
    passNotifMs: 300,
    captureSweepMs: 260,
    captureStaggerMs: 15,
    captureWinnerLingerMs: 150,
    captureSoloLingerMs: 60,
    captureBufferMs: 50,
    dealCardMs: 220,
    dealStaggerMs: 25,
    dealBufferMs: 40,
    passSlotMoveMs: 220,
    passReturnStaggerMs: 25,
    passOutMs: 240,
    passOutStaggerMs: 25,
    passOutBufferMs: 40,
    acceptViewDelayMs: 1200,
    acceptFlightMs: 260,
    acceptStaggerMs: 35,
    acceptBufferMs: 40,
    betSplashEnterMs: 0,
    betSplashHoldMs: 1000,
    betSplashFadeMs: 1000,
    betSplashNotifMs: 1000,
    wishMadeNotifMs: 200,
    newScoresNotifMs: 1000,
  },
  fast: {
    easing: DEFAULT_ANIM_TIMINGS.easing,
    fastScale: DEFAULT_ANIM_TIMINGS.fastScale,
    cardSelectMs: 70,
    cardGlowMs: 80,
    winningHighlightMs: 70,
    handFlipMs: 110,
    playComboMs: 120,
    playComboStaggerMs: 8,
    playBombMs: 140,
    playBombStaggerMs: 8,
    playBombPulseScale: 1.15,
    playComboBufferMs: 15,
    opponentStartScale: 0.62,
    passPopMs: 80,
    passNotifMs: 85,
    captureSweepMs: 130,
    captureStaggerMs: 6,
    captureWinnerLingerMs: 60,
    captureSoloLingerMs: 25,
    captureBufferMs: 20,
    dealCardMs: 110,
    dealStaggerMs: 10,
    dealBufferMs: 15,
    passSlotMoveMs: 105,
    passReturnStaggerMs: 10,
    passOutMs: 120,
    passOutStaggerMs: 10,
    passOutBufferMs: 15,
    acceptViewDelayMs: 550,
    acceptFlightMs: 130,
    acceptStaggerMs: 14,
    acceptBufferMs: 15,
    betSplashEnterMs: 90,
    betSplashHoldMs: 400,
    betSplashFadeMs: 220,
    betSplashNotifMs: 400,
    wishMadeNotifMs: 100,
    newScoresNotifMs: 450,
  },
  relaxed: {
    easing: DEFAULT_ANIM_TIMINGS.easing,
    fastScale: DEFAULT_ANIM_TIMINGS.fastScale,
    cardSelectMs: 130,
    cardGlowMs: 160,
    winningHighlightMs: 130,
    handFlipMs: 230,
    playComboMs: 240,
    playComboStaggerMs: 16,
    playBombMs: 270,
    playBombStaggerMs: 14,
    playBombPulseScale: 1.15,
    playComboBufferMs: 30,
    opponentStartScale: 0.54,
    passPopMs: 160,
    passNotifMs: 180,
    captureSweepMs: 260,
    captureStaggerMs: 14,
    captureWinnerLingerMs: 140,
    captureSoloLingerMs: 55,
    captureBufferMs: 40,
    dealCardMs: 230,
    dealStaggerMs: 24,
    dealBufferMs: 35,
    passSlotMoveMs: 215,
    passReturnStaggerMs: 24,
    passOutMs: 240,
    passOutStaggerMs: 24,
    passOutBufferMs: 35,
    acceptViewDelayMs: 1100,
    acceptFlightMs: 260,
    acceptStaggerMs: 30,
    acceptBufferMs: 35,
    betSplashEnterMs: 180,
    betSplashHoldMs: 800,
    betSplashFadeMs: 480,
    betSplashNotifMs: 800,
    wishMadeNotifMs: 200,
    newScoresNotifMs: 900,
  },
};

export const ANIM_TIMINGS: AnimTimings = { ...DEFAULT_ANIM_TIMINGS };

export interface WindowAnimControl extends AnimTimings {
  preset(name: AnimPresetName): AnimTimings;
  reset(): AnimTimings;
  sync(): void;
  readonly presets: AnimPresetName[];
  snapshot(): AnimTimings;
}

export function syncAnimCssVars(): void {
  if (typeof document === "undefined" || !document.documentElement?.style?.setProperty) {
    return;
  }
  const disabled =
    typeof window !== "undefined" &&
    (window as any).gameModel?.getState?.()?.animationsEnabled === false;
  const style = document.documentElement.style;
  style.setProperty("--tichu-card-select-ms", `${disabled ? 0 : ANIM_TIMINGS.cardSelectMs}ms`);
  style.setProperty("--tichu-card-glow-ms", `${disabled ? 0 : ANIM_TIMINGS.cardGlowMs}ms`);
  style.setProperty(
    "--tichu-winning-linger-ms",
    `${disabled ? 0 : ANIM_TIMINGS.winningHighlightMs}ms`,
  );
  style.setProperty("--tichu-bet-enter-ms", `${disabled ? 0 : ANIM_TIMINGS.betSplashEnterMs}ms`);
  style.setProperty("--tichu-bet-fade-ms", `${disabled ? 0 : ANIM_TIMINGS.betSplashFadeMs}ms`);
  style.setProperty("--tichu-anim-easing", String(ANIM_TIMINGS.easing));
}

export function applyAnimPreset(name: AnimPresetName): AnimTimings {
  if (!Object.prototype.hasOwnProperty.call(ANIM_PRESETS, name)) {
    throw new Error(`Unknown animation preset: ${String(name)}`);
  }
  Object.assign(ANIM_TIMINGS, ANIM_PRESETS[name]);
  syncAnimCssVars();
  return { ...ANIM_TIMINGS };
}

export function resetAnimTimings(): AnimTimings {
  return applyAnimPreset("snappy");
}

let cachedProxy: WindowAnimControl | null = null;

export function installWindowAnimTimings(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!cachedProxy) {
    cachedProxy = new Proxy(ANIM_TIMINGS as unknown as WindowAnimControl, {
      get(target, prop, receiver) {
        if (prop === "preset") {
          return (name: AnimPresetName) => applyAnimPreset(name);
        }
        if (prop === "reset") {
          return () => resetAnimTimings();
        }
        if (prop === "sync") {
          return () => syncAnimCssVars();
        }
        if (prop === "presets") {
          return Object.keys(ANIM_PRESETS) as AnimPresetName[];
        }
        if (prop === "snapshot") {
          return () => ({ ...ANIM_TIMINGS });
        }
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value, receiver) {
        const ok = Reflect.set(target, prop, value, receiver);
        if (ok) {
          syncAnimCssVars();
        }
        return ok;
      },
    });
  }
  (window as any).__tichuAnim = cachedProxy;
}

installWindowAnimTimings();
syncAnimCssVars();
