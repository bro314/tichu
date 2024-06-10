import { Observable } from "rxjs";
import { distinctUntilChanged, map, shareReplay } from "rxjs/operators";
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

export function hasBomb(cards: Card[]) {
  // straight bombs
  let highest = null;
  for (let color = 1; color <= 4; color++) {
    let values = cards
      .filter((c) => Number(c.type) === color)
      .map((c) => Number(c.type_arg))
      .sort((a, b) => a - b);
    for (let idx = 0; idx < values.length - 4; idx++) {
      const numBegin = values[idx]!;
      for (let idy = idx + 4; idy < values.length; idy++) {
        const numEnd = values[idy];
        let length = idy - idx + 1;
        if (numEnd === numBegin + length - 1) {
          return true;
        }
      }
    }
  }

  // four bombs
  for (let value = 2; value <= 13; value++) {
    let cardsWithValue = cards.filter((c) => Number(c.type_arg) === value);
    if (cardsWithValue.length === 4) {
      return true;
    }
  }

  return false;
}
