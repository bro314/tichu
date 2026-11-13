import { Observable } from "rxjs";
import { distinctUntilChanged, map, shareReplay } from "rxjs/operators";
import { Hand } from "./combo-validator";
import { Card } from "./model";

export function fire(el: Element, eventName: string) {
  el.dispatchEvent(new CustomEvent(eventName, { composed: true, bubbles: true }));
}

export function select<A, B>(obs$: Observable<A>, mapper: (_: A) => B) {
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
