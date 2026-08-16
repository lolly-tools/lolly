// The docs HTML escaper. Escapes ONLY `& < >`: three characters, NOT five.
//
// This is deliberate and required: the docs renderer must NOT reuse the web
// shell's `escape()` (shells/web/src/utils.ts), which also escapes `"` and `'`.
// Doc prose is full of quotes and apostrophes; a 5-char escaper would re-encode
// every one of them, changing the bytes of nearly every page and re-signing all
// 54 C2PA page seals. Both consumers of this package (docs/build.ts and the
// in-app docs view) share THIS escaper so their output is byte-identical.
export function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
