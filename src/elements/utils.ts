export function fire(el: Element, eventName: string) {
  el.dispatchEvent(new CustomEvent(eventName, { composed: true, bubbles: true }));
}
