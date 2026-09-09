// SPDX-License-Identifier: MPL-2.0
/**
 * Section alignment (plans/103 M0) + the DRIFT GUARD.
 *
 * The unit half pins parseMdSections/alignPage on synthetic input. The drift
 * half reads the committed docs artifacts - the markdown twins under
 * public/info/*.md and the English search-index.json - and asserts that every
 * page's heading records align to a full section, EXCEPT a small pinned list of
 * pages rendered by a non-markdown path. It fails in BOTH directions: a docs
 * change that breaks alignment on a currently-clean page fails loudly, and a
 * pinned page that starts aligning (its exemption gone stale) fails too. That
 * second direction is the point - the snippet fallback must never quietly become
 * the norm.
 *
 * Run directly:  node --test shells/web/src/lib/ask/chunks.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseMdSections, alignPage, type AlignableRecord } from './chunks.ts';

// ── unit ──────────────────────────────────────────────────────────────────────

test('parseMdSections splits at h2-h4, intro first, fence-aware', () => {
  const md = 'Intro line.\n\n## First\nbody one\n\n### Nested\nbody two\n\n```\n## not a heading\n```\n\n## Second\nbody three';
  const secs = parseMdSections(md);
  assert.equal(secs[0]!.heading, null);
  assert.equal(secs[0]!.body, 'Intro line.');
  assert.deepEqual(secs.slice(1).map((s) => s.heading), ['First', 'Nested', 'Second']);
  // The `## not a heading` inside the fence belongs to the section it sits in.
  assert.ok(secs.find((s) => s.heading === 'Nested')!.body.includes('## not a heading'));
});

test('alignPage maps records to full section bodies, snippet-fallback for misses', () => {
  const md = 'Intro.\n\n## Alpha\nAlpha body.\n\n## Beta\nBeta body.';
  const records: AlignableRecord[] = [
    { h: '', a: '' },
    { h: 'Alpha', a: 'alpha' },
    { h: 'Beta', a: 'beta' },
    { h: 'Ghost', a: 'ghost' }, // no such heading → null
  ];
  const aligned = alignPage(md, records);
  assert.equal(aligned[0], 'Intro.');
  assert.equal(aligned[1], 'Alpha body.');
  assert.equal(aligned[2], 'Beta body.');
  assert.equal(aligned[3], null);
});

test('duplicate headings resolve by document order, not slug', () => {
  const md = '## Notes\nfirst notes\n\n## Notes\nsecond notes';
  const aligned = alignPage(md, [{ h: 'Notes', a: 'notes' }, { h: 'Notes', a: 'notes-1' }]);
  assert.equal(aligned[0], 'first notes');
  assert.equal(aligned[1], 'second notes');
});

test('an inline-code heading with underscores aligns to the index text', () => {
  // htmlToText renders <code> as a spaced tag; underscores inside code stay literal.
  const md = '## Shared helper regions (`community/_shared/`)\nbody';
  const aligned = alignPage(md, [{ h: 'Shared helper regions ( community/_shared/ )', a: 'x' }]);
  assert.equal(aligned[0], 'body');
});

// ── drift guard against the committed docs ──────────────────────────────────────

interface Rec { p: string; t: string; h: string; a: string; x: string }
const INFO = fileURLToPath(new URL('../../../public/info/', import.meta.url));

// Pages rendered by a non-markdown path (their sections do not come from a twin),
// so their records legitimately fall back to the snippet. Keep this list minimal
// and justified - a page joining it silently would hide a real regression.
const NON_MARKDOWN_PAGES = new Set<string>([
  'index', // the landing page (docs/build.ts buildLandingContent) - injected HTML, no twin body
]);

test('drift guard: every markdown page fully aligns; the pinned exceptions do not', (t) => {
  // The guard reads the BUILT docs site (docs/build.ts emits search-index.json into
  // public/info/). CI never builds /info, so the file is absent there - skip with a
  // reason, like the SUSE-font and Chromium gates. Local runs and the ship gate
  // (which runs build:info) still enforce the drift.
  if (!existsSync(`${INFO}search-index.json`)) {
    t.skip('no built docs site at public/info/search-index.json (run pnpm run build:info) - drift is enforced where the site is built');
    return;
  }
  const index = JSON.parse(readFileSync(`${INFO}search-index.json`, 'utf-8')) as Rec[];
  const byPage = new Map<string, Rec[]>();
  for (const r of index) {
    const list = byPage.get(r.p) ?? [];
    list.push(r);
    byPage.set(r.p, list);
  }

  const brokeClean: string[] = [];
  const staleException: string[] = [];

  for (const [slug, recs] of byPage) {
    const twinPath = `${INFO}${slug}.md`;
    const headingRecs = recs.map((r, i) => ({ r, i })).filter(({ r }) => r.h !== '');
    if (!headingRecs.length) continue;

    const aligned = existsSync(twinPath) ? alignPage(readFileSync(twinPath, 'utf-8'), recs) : recs.map(() => null);
    const missed = headingRecs.filter(({ i }) => aligned[i] === null).length;
    const fullyAligns = missed === 0;

    if (NON_MARKDOWN_PAGES.has(slug)) {
      // A pinned page that now aligns means the exemption is stale - remove it.
      if (fullyAligns) staleException.push(slug);
    } else if (!fullyAligns) {
      brokeClean.push(`${slug} (${missed}/${headingRecs.length} sections unmatched)`);
    }
  }

  assert.deepEqual(brokeClean, [], 'these markdown pages no longer align - see chunks.ts / docs/build.ts');
  assert.deepEqual(staleException, [], 'these pages now align - drop them from NON_MARKDOWN_PAGES');
});
