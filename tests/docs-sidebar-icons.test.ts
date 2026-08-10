// SPDX-License-Identifier: MPL-2.0
/**
 * Sidebar glyphs (SIDEBAR_ICON in docs/build.ts) — and the footer sitemap, which
 * renders the SAME mapping so a destination wears one landmark everywhere.
 *
 * These are an accessibility feature, not decoration: a column of same-length
 * link text is slow to scan, and a stable picture per destination gives a second,
 * non-verbal way to find a page. That only works if the mapping is COMPLETE and
 * STABLE — one missing entry is a blank where a landmark should be, and docIcon()
 * answers an unknown key with a console warning and an empty string, which is
 * invisible in a build log nobody reads.
 *
 * Run directly: node --test tests/docs-sidebar-icons.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sliceDeclaration } from '../scripts/check-docs-nav.ts';

const BUILD_TS = readFileSync(join(new URL('..', import.meta.url).pathname, 'docs/build.ts'), 'utf8');

const sidebarSlugs = [...new Set(
  [...sliceDeclaration(BUILD_TS, 'SIDEBARS').matchAll(/\bslug:\s*'([^']+)'/g)].map((m) => m[1]!),
)];

// Comment lines are dropped BEFORE matching: the map is grouped by section with
// `// Trust — …` headers, and an entry sitting directly under one is not preceded
// by a `{` or `,`. Anchoring on those separators silently skipped the first entry
// of every group — nine real pages read as "no icon" on the first run of this test.
const iconBlock = sliceDeclaration(BUILD_TS, 'SIDEBAR_ICON')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const iconMap = new Map(
  [...iconBlock.matchAll(/'?([a-z][a-z0-9-]*)'?:\s*'([a-z][a-zA-Z0-9-]*)'/g)]
    .map((m) => [m[1]!, m[2]!] as const),
);

/** Keys DOC_ICONS holds — literal entries plus the `DOC_ICONS.x = …` aliases. */
const iconKeys = new Set([
  ...[...sliceDeclaration(BUILD_TS, 'DOC_ICONS').matchAll(/^\s{2}'?([a-zA-Z-]+)'?:/gm)].map((m) => m[1]!),
  ...[...BUILD_TS.matchAll(/^DOC_ICONS\.([a-zA-Z-]+)\s*=/gm)].map((m) => m[1]!),
]);

/**
 * The footer sitemap's destinations: every row slug in FOOTER_SECTIONS plus the
 * pathway hubs the column headings link to (PATHWAY_HUB). footerSitemap() renders
 * SIDEBAR_ICON for each of these, so a slug missing from the mapping is the same
 * failure the sidebar tests guard against — a blank where a landmark goes.
 */
const footerSlugs = [...new Set([
  ...[...sliceDeclaration(BUILD_TS, 'FOOTER_SECTIONS').matchAll(/slugs:\s*\[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1]!.matchAll(/'([a-z-]+)'/g)].map((x) => x[1]!)),
  ...[...sliceDeclaration(BUILD_TS, 'PATHWAY_HUB').matchAll(/:\s*'([a-z-]+)'/g)].map((m) => m[1]!),
])];

test('the scan found real data (the parse did not silently return nothing)', () => {
  assert.ok(sidebarSlugs.length > 30, `expected the full sidebar tree, got ${sidebarSlugs.length} slugs`);
  assert.ok(iconMap.size > 30, `expected an icon per page, got ${iconMap.size} entries`);
  assert.ok(iconKeys.size > 20, `expected the doc icon set, got ${iconKeys.size} keys`);
  assert.ok(footerSlugs.length > 40, `expected the full site map, got ${footerSlugs.length} slugs`);
});

test('every sidebar entry has an icon', () => {
  const missing = sidebarSlugs.filter((s) => !iconMap.has(s));
  assert.deepEqual(missing, [], 'a sidebar link would render with a blank where its landmark goes');
});

test('every icon name resolves to a real glyph', () => {
  // docIcon warns and returns '' for an unknown key, so a typo degrades to a gap
  // rather than an error — this is the check that makes it loud.
  const unknown = [...iconMap].filter(([, icon]) => !iconKeys.has(icon)).map(([slug, icon]) => `${slug} → ${icon}`);
  assert.deepEqual(unknown, [], 'unknown DOC_ICONS key — docIcon would emit nothing');
});

test('every footer sitemap destination has an icon', () => {
  // The build throws on a miss (the guard beside SIDEBAR_ICON); this is the same
  // check without needing a build, and it names the slug.
  const missing = footerSlugs.filter((s) => !iconMap.has(s));
  assert.deepEqual(missing, [], 'a footer link would fail the build-time icon guard');
});

test('the footer renders SIDEBAR_ICON itself, not a second mapping', () => {
  // ONE data source. The footer link's glyph must be a lookup into the sidebar's
  // own table — a copied table drifts the first time one of them is edited — and
  // it must be decorative: the label is the link, the icon is aria-hidden.
  const start = BUILD_TS.indexOf('function footerSitemap(');
  assert.ok(start >= 0, 'docs/build.ts no longer declares footerSitemap()');
  const next = BUILD_TS.slice(start + 1).search(/\n(?:function |const [A-Z])/);
  const fn = BUILD_TS.slice(start, next < 0 ? undefined : start + 1 + next);
  assert.ok(fn.length > 100, 'footerSitemap() source looks empty — the slice is wrong');
  assert.match(fn, /SIDEBAR_ICON\[/, 'footer glyphs must come from the sidebar mapping');
  assert.match(fn, /class="sitemap-ic" aria-hidden="true"/, 'footer glyphs are decorative and CSS-sized');
});

test('SIDEBAR_ICON has no entry for a page that is not in a sidebar or the footer sitemap', () => {
  const stale = [...iconMap.keys()].filter((s) => !sidebarSlugs.includes(s) && !footerSlugs.includes(s));
  assert.deepEqual(stale, [], 'stale mapping for a slug no nav lists');
});

test('only the two deliberate colour landmarks exist', () => {
  // AI and Inclusive Design are coloured because they are the most topical and
  // emotional subjects in the docs; a third hue would flatten the signal back into
  // decoration. If a colour is added, this test should be updated CONSCIOUSLY.
  const hues = [...BUILD_TS.matchAll(/sidebar-ic\.is-([a-z]+)\{/g)].map((m) => m[1]!);
  assert.deepEqual([...new Set(hues)].sort(), ['ai', 'inclusive']);
});
