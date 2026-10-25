// SPDX-License-Identifier: MPL-2.0
/**
 * The words a logo spells out, as a name to suggest for its design system
 * (plan 320 S5).
 *
 * Only words the file states are read: the first live text run, else the
 * document's <title>. Lettering that was converted to outlines is shapes, and a
 * name guessed from shapes would be invented, so it gives nothing. A run longer
 * than a name is a tagline or a paragraph, and gives nothing too.
 */

/** Longer than this is not a name. */
const NAME_MAX = 60;

const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

export function logoWords(svgText: string, parser: Pick<DOMParser, 'parseFromString'> = new DOMParser()): string {
  let doc: Document;
  try { doc = parser.parseFromString(svgText, 'image/svg+xml'); } catch { return ''; }
  if (doc.querySelector('parsererror')) return '';
  const run = [...doc.querySelectorAll('text')].map(el => clean(el.textContent)).find(Boolean);
  const words = run || clean(doc.querySelector('title')?.textContent);
  return words.length <= NAME_MAX ? words : '';
}
