import { Observable } from "rxjs";
import { distinctUntilChanged, map, shareReplay } from "rxjs/operators";
import { Hand } from "./combo-validator";
import { Card } from "./model";

if (typeof (globalThis as any)._ !== "function") {
  (globalThis as any)._ = (s: string) => s;
}

export function fire(el: Element, eventName: string) {
  el.dispatchEvent(new CustomEvent(eventName, { composed: true, bubbles: true }));
}

export function select<A, B>(obs$: Observable<A>, mapper: (value: A) => B) {
  return obs$.pipe(map(mapper), distinctUntilChanged(deepEqual), shareReplay(1));
}

export function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  if (a === null || b === null) return false;

  if (typeof a === "object") {
    if (typeof b !== "object") return false;

    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }
  return false;
}

export function playerIdFromChannel(channel: string): number {
  if (!channel.startsWith("/player/p")) return 0;
  const playerIdString = channel.substring("/player/p".length);
  return Number(playerIdString);
}

export function hasBomb(cards: Card[]): boolean {
  if (!cards || cards.length < 4) return false;
  return new Hand(cards).hasBomb();
}

export interface ScoreBoardPlayer {
  id: string | number;
  name: string;
  team?: number | string;
  no?: number | string;
  color?: string;
  score?: number | string;
}

export interface TeamGroup {
  team0: ScoreBoardPlayer[];
  team1: ScoreBoardPlayer[];
}

/**
 * Group players into Team 0 and Team 1 using `player.team`, falling back to
 * `(no - 1) % 2` only when `team` is absent.
 */
export function groupPlayersByTeam(players: ScoreBoardPlayer[]): TeamGroup {
  const sorted = [...players].sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0));
  const team0: ScoreBoardPlayer[] = [];
  const team1: ScoreBoardPlayer[] = [];

  for (const p of sorted) {
    const rawTeam = p.team;
    const hasTeam =
      rawTeam !== undefined && rawTeam !== null && rawTeam !== "" && !Number.isNaN(Number(rawTeam));
    const team = hasTeam ? Number(rawTeam) : (Math.max(1, Number(p.no || 1)) - 1) % 2;
    if (team === 1) {
      team1.push(p);
    } else {
      team0.push(p);
    }
  }

  return { team0, team1 };
}
