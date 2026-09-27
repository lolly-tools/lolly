/**
 * Docs typography keeps the font's natural spacing (plan 277): no negative letter
 * spacing in any stylesheet that reaches a docs page, in either reader.
 *
 * Tightened tracking was used to make headings and the wordmark look dense; it makes
 * them harder to read at small sizes and in scripts the font was not spaced for, and the
 * owner has ruled it out. The check reads the stylesheet sources, so it needs no build.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = [
  'docs/build.ts',
  'shells/web/src/styles/parts/docs.css',
  'shells/web/src/styles/parts/docs-landing.css',
  'shells/web/src/styles/parts/docs-components.css',
  // Both ship in the /info stylesheet too since plan 277 step 3c.
  'shells/web/src/styles/parts/docs-chrome.css',
  'shells/web/src/styles/parts/buttons.css',
  ...readdirSync(join(ROOT, 'docs/figures')).filter((f) => f.endsWith('.html')).map((f) => `docs/figures/${f}`),
];

/** Files that still carry a negative value, each with its reason. Fails both ways: a
 *  listed file with no negative value left must leave the list. */
const KNOWN: Record<string, string> = {
  // A signed banked figure: editing it means re-signing with the art key, which the
  // maintainer holds (scripts/sign-docs-art.ts).
  'docs/figures/positioning-comparison.html': 'signed figure; needs a re-sign to change',
};

const NEGATIVE = /letter-spacing\s*:\s*-\s*[\d.]/;

test('no docs stylesheet uses negative letter spacing', () => {
  const hits = SOURCES.filter((rel) => NEGATIVE.test(readFileSync(join(ROOT, rel), 'utf-8')));
  assert.deepEqual(hits.filter((rel) => !(rel in KNOWN)), [], 'Use the font\'s natural spacing: remove the negative letter-spacing.');
  assert.deepEqual(Object.keys(KNOWN).filter((rel) => !hits.includes(rel)), [], 'Fixed: remove the file from KNOWN.');
});
