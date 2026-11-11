export function dojostyle(selector: string, attribute: string, value: string) {
  (dojo.query(selector) as any).style(attribute, value);
}

export function dojohtml(selector: string, html: string) {
  (dojo.query(selector) as any).innerHTML(html);
}
