// SPDX-License-Identifier: MPL-2.0
/**
 * Invisible characters, made visible - the ONE naming + rendering helper for
 * every surface that shows a text extract (the verify panel, the catalog's
 * text preview and read-text extract, the analyse work preview).
 *
 * The byte-level tells the analyser flags (zero-width characters, bidi
 * controls, tag characters, variation selectors, stego spaces) are literally
 * unseeable in a normal render: a zero-width space inside a highlight is a
 * hairline. Every extract therefore replaces each such character with a small
 * NAMED chip (ZWSP, RLO, TAG, VS17...) carrying the codepoint in its tooltip,
 * so what the finding says is right there in the text, glanceable - not an
 * abstract row the reader has to hunt for. Promoted from catalog.ts's local
 * work-preview helper (2026-08-19) so verify and the catalog can never drift.
 *
 * Chips are visual only: copy actions always use the ORIGINAL text, and the
 * chip glyph never enters the string.
 */
import { escape } from '../utils.ts';
import { invisibleCharName } from '@lolly/engine';

// Naming lives in the ENGINE (text-facts.ts) - the census, the extract chips
// and the CLI all read one table. Re-exported for existing importers.
export { invisibleCharName };

const tooltip = (ch: string, name: string): string => {
  const cp = (ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0');
  return `${name} · U+${cp}`;
};

/** DOM path: append `text` to `parent` with each invisible character rendered
 *  as a titled chip. No markup sink - createElement/textContent only. */
export function appendVisibleText(parent: Node, text: string, chipClass: string): void {
  let plain = '';
  const flush = (): void => { if (plain) { parent.appendChild(document.createTextNode(plain)); plain = ''; } };
  for (const ch of text) {
    const name = invisibleCharName(ch);
    if (!name) { plain += ch; continue; }
    flush();
    const chip = document.createElement('span');
    chip.className = chipClass;
    chip.title = tooltip(ch, name);
    chip.textContent = name;
    parent.appendChild(chip);
  }
  flush();
}

/** String path for the template-literal renderers: `text`, fully escape()d,
 *  with each invisible character as a titled chip span. Safe for the existing
 *  reviewed innerHTML sinks - every interpolated value is escaped here. */
export function visibleTextHtml(text: string, chipClass: string): string {
  let out = '';
  let plain = '';
  const flush = (): void => { if (plain) { out += escape(plain); plain = ''; } };
  for (const ch of text) {
    const name = invisibleCharName(ch);
    if (!name) { plain += ch; continue; }
    flush();
    out += `<span class="${chipClass}" title="${escape(tooltip(ch, name))}">${escape(name)}</span>`;
  }
  flush();
  return out;
}
