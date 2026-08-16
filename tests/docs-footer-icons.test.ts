// SPDX-License-Identifier: MPL-2.0
/**
 * Footer + icon completeness for the docs site.
 *
 * docs/build.ts throws at BUILD time (build:info) if a registered page is missing
 * from FOOTER_SECTIONS (the full-sitemap footer) or from SIDEBAR_ICON (every footer
 * link carries a glyph). Those checks do NOT run in `npm test`, so a page added to
 * `pages` without a footer column or an icon passes the gate and only fails the
 * Vercel build. That is exactly how the six /compare pages slipped through once.
 * This runs the same two invariants at test time, by parsing docs/build.ts as text
 * (importing it would execute build()), the same way check-docs-nav.ts does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sliceDeclaration } from '../scripts/check-docs-nav.ts';

const buildTs = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs/build.ts'), 'utf8');

const pagesBlock = sliceDeclaration(buildTs, 'pages');
const footerBlock = sliceDeclaration(buildTs, 'FOOTER_SECTIONS');
const iconBlock = sliceDeclaration(buildTs, 'SIDEBAR_ICON');

const pageSlugs = [...pagesBlock.matchAll(/\bslug:\s*'([^']+)'/g)].map(m => m[1] as string);
// Pathway hubs head a footer column, so they are never a footer row.
const hubSlugs = new Set(
  [...pagesBlock.matchAll(/\{[^{}]*?\bslug:\s*'([^']+)'[^{}]*?\bisHub:\s*true[^{}]*?\}/g)].map(m => m[1] as string),
);
// Footer row slugs, from every `slugs: [ ... ]` array.
const footerSlugs = new Set<string>();
for (const arr of footerBlock.matchAll(/slugs:\s*\[([\s\S]*?)\]/g))
  for (const m of (arr[1] as string).matchAll(/'([^']+)'/g)) footerSlugs.add(m[1] as string);
// SIDEBAR_ICON keys: `key: 'glyph'` or `'key': 'glyph'` (a quoted value, so the type
// annotation on the declaration line is never mistaken for an entry).
const iconKeys = new Set(
  [...iconBlock.matchAll(/(?:'([\w-]+)'|\b([a-z][\w-]*))\s*:\s*'[^']+'/g)].map(m => (m[1] ?? m[2]) as string),
);

test('parse sanity: the three build.ts declarations were found', () => {
  assert.ok(pageSlugs.length > 20, `expected many pages, got ${pageSlugs.length}`);
  assert.ok(footerSlugs.size > 20, `expected many footer slugs, got ${footerSlugs.size}`);
  assert.ok(iconKeys.size > 20, `expected many icon keys, got ${iconKeys.size}`);
  assert.ok(hubSlugs.size >= 4, `expected the pathway hubs, got ${[...hubSlugs].join(', ')}`);
});

test('every docs page is a pathway hub or has a FOOTER_SECTIONS column', () => {
  const missing = pageSlugs.filter(s => !hubSlugs.has(s) && !footerSlugs.has(s));
  assert.deepEqual(missing, [], `pages missing from the footer sitemap (build:info will throw): ${missing.join(', ')}`);
});

test('every footer-listed page has a SIDEBAR_ICON glyph', () => {
  const missing = [...footerSlugs].filter(s => !iconKeys.has(s));
  assert.deepEqual(missing, [], `footer pages missing a SIDEBAR_ICON (build:info will throw): ${missing.join(', ')}`);
});
