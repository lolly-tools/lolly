// SPDX-License-Identifier: MPL-2.0
/**
 * The register <-> generated-pages bijection (plan 116 workstream A, priority 4),
 * modelled on the catalog-index freshness pattern: the register is the single
 * source of truth, and the generated pages must be neither more nor less than it.
 *
 * Both directions fail loudly:
 *  - every register format yields exactly one per-format page (a register entry
 *    with no page fails);
 *  - every generated per-format page corresponds to a register format (a page
 *    promising a format the register dropped fails).
 * And the same both-ways check for the curated convert pages against CONVERT_PAIRS.
 *
 * The page list is produced by the generator's own functions (formatPageList /
 * convertPageList) called on the register, so this test exercises the exact logic
 * build.ts uses, not a re-implementation.
 *
 * Run directly: node --test tests/formats-pages-drift.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatPageList,
  convertPageList,
  tokenSlug,
  reads,
  writes,
  CONVERT_PAIRS,
  type FmtCatalog,
} from '../docs/formats-pages.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(resolve(ROOT, 'docs/site/formats-catalog.json'), 'utf8')) as FmtCatalog;

// ── per-format pages ─────────────────────────────────────────────────────────

test('every register format yields exactly one per-format page', () => {
  const pages = formatPageList(catalog);
  assert.equal(pages.length, catalog.formats.length, 'one page per register entry, no more, no fewer');
  const pageTokens = new Set(pages.map((p) => p.token));
  for (const f of catalog.formats) {
    assert.ok(pageTokens.has(f.token), `register format ${f.token} has no generated page`);
  }
});

test('every generated per-format page corresponds to a register format', () => {
  const registerTokens = new Set(catalog.formats.map((f) => f.token));
  for (const p of formatPageList(catalog)) {
    assert.ok(registerTokens.has(p.token), `generated page ${p.slug} promises a format not in the register (${p.token})`);
  }
});

test('per-format slugs are url-safe and unique', () => {
  const seen = new Map<string, string>();
  for (const p of formatPageList(catalog)) {
    assert.match(p.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `slug ${p.slug} is not url-safe`);
    const prior = seen.get(p.slug);
    assert.ok(!prior, `slug collision: ${p.token} and ${prior} both map to "${p.slug}"`);
    seen.set(p.slug, p.token);
  }
});

// ── convert pages ──────────────────────────────────────────────────────────────

test('every convert pair yields exactly one convert page, both directions valid', () => {
  const pairs = convertPageList(catalog);
  assert.equal(pairs.length, CONVERT_PAIRS.length, 'one convert page per curated pair');
  // Both directions: the page list is derived FROM CONVERT_PAIRS, so a pair that
  // referenced a dropped token would have thrown in convertPageList already; this
  // pins that each surviving pair is readable-in / writable-out.
  const byToken = new Map(catalog.formats.map((f) => [f.token, f]));
  for (const p of pairs) {
    const inEntry = byToken.get(p.inToken)!;
    const outEntry = byToken.get(p.outToken)!;
    assert.ok(reads(inEntry), `convert ${p.slug}: Lolly must read the input ${p.inToken}`);
    assert.ok(writes(outEntry), `convert ${p.slug}: Lolly must write the output ${p.outToken}`);
    assert.equal(p.slug, `${tokenSlug(p.inToken)}-to-${tokenSlug(p.outToken)}`, `convert slug shape for ${p.slug}`);
  }
});

test('every curated convert pair maps to a page (no pair silently dropped)', () => {
  const pageSlugs = new Set(convertPageList(catalog).map((p) => p.slug));
  for (const [inTok, outTok] of CONVERT_PAIRS) {
    const slug = `${tokenSlug(inTok)}-to-${tokenSlug(outTok)}`;
    assert.ok(pageSlugs.has(slug), `curated pair ${inTok}->${outTok} produced no page`);
  }
});

test('convert slugs are unique', () => {
  const slugs = convertPageList(catalog).map((p) => p.slug);
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  assert.deepEqual(dupes, [], `duplicate convert slugs: ${dupes.join(', ')}`);
});

test('a register entry that flips direction breaks its convert page (the guard bites)', () => {
  // Simulate the register dropping write support for PNG: convertPageList must
  // refuse rather than ship a page that promises "-> PNG".
  const broken: FmtCatalog = {
    ...catalog,
    formats: catalog.formats.map((f) => (f.token === 'PNG' ? { ...f, dir: 'in' as const } : f)),
  };
  assert.throws(() => convertPageList(broken), /does not write "PNG"/,
    'a convert page must not survive its output format losing write support');
});
