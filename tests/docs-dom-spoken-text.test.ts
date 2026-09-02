// SPDX-License-Identifier: MPL-2.0
/**
 * Parity guard for the device-voice reader (plan 131 B.3).
 *
 * The produced-audio host speaks blocks extracted from a page's markdown SOURCE
 * (scripts/lib/docs-spoken-text.ts); the device-voice host speaks blocks extracted
 * from the rendered DOM (docs/player/dom-spoken-text.ts), because locale + generated
 * pages have no markdown twin. If those two extractors drift, a reader hears a
 * different document depending on which voice a page happens to have.
 *
 * Exact block-for-block equality is not achievable (two parsers; a bare URL in prose
 * is spoken as its host by the markdown side but carries its full visible link text in
 * the DOM), so this pins the SKELETON: the sequence of heading texts must match. A
 * dropped or added section - the failure that actually matters - breaks it.
 *
 * Skips when /info has not been built (gitignored in shells/web) or when jsdom is
 * absent, exactly like the other built-artifact docs tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSpokenText } from '../scripts/lib/docs-spoken-text.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUILT = join(ROOT, 'shells/web/public/info');

// A committed English page that has both a built HTML page and its markdown twin.
// The HTML lives behind its door directory (plans/177 P1: /info/<door>/<slug>.html);
// the twin stays flat.
const SLUG = 'build-guide';
const htmlPath = join(BUILT, 'operate', `${SLUG}.html`);
const mdPath = join(BUILT, `${SLUG}.md`);

let JSDOM: typeof import('jsdom').JSDOM | null = null;
try { ({ JSDOM } = await import('jsdom')); } catch { /* jsdom not installed */ }

const skip = !JSDOM
  ? 'jsdom not available'
  : !existsSync(htmlPath) || !existsSync(mdPath)
    ? 'no built /info on disk - run `npm run build:info`'
    : false;

const headingTexts = (blocks: Array<{ kind: string; text: string }>): string[] =>
  blocks.filter((b) => b.kind === 'heading').map((b) => b.text);

test('device-voice DOM extraction matches the markdown extractor heading sequence', { skip }, async () => {
  const dom = new JSDOM!(readFileSync(htmlPath, 'utf-8'));
  // The DOM extractor reads the live document; hand it jsdom's globals.
  const g = globalThis as unknown as { document: Document; Node: typeof Node; HTMLElement: typeof HTMLElement };
  const saved = { document: g.document, Node: g.Node, HTMLElement: g.HTMLElement };
  g.document = dom.window.document;
  g.Node = dom.window.Node as unknown as typeof Node;
  g.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
  try {
    // Import AFTER globals exist so the module's DOM references resolve. The page's H1
    // (its title) is lifted into the masthead band, OUTSIDE .docs-content, so the DOM
    // extractor never sees it; passing that title to the markdown extractor triggers its
    // matching meta-title skip, so both sequences are the BODY headings only.
    const pageTitle = dom.window.document.querySelector('h1')?.textContent?.trim() ?? '';
    const { extractDomSpokenText } = await import('../docs/player/dom-spoken-text.ts');
    const domHeadings = headingTexts(extractDomSpokenText(pageTitle).map((b) => b.block));
    const mdHeadings = headingTexts(extractSpokenText(readFileSync(mdPath, 'utf-8'), { pageTitle }));
    assert.ok(domHeadings.length > 0, 'the page has no headings - wrong fixture?');
    assert.deepEqual(domHeadings, mdHeadings,
      'DOM and markdown extractors disagree on the heading sequence - the two voices would read different documents.');
  } finally {
    g.document = saved.document;
    g.Node = saved.Node;
    g.HTMLElement = saved.HTMLElement;
  }
});
