// SPDX-License-Identifier: MPL-2.0
/**
 * The Catalogue view's selection model (views/catalog-filter.ts).
 *
 * views/catalog.ts was the largest fully-untested view in the shell - 3,563
 * lines, one 3,078-line mountCatalog, zero tests (maintainability-2026-07-29.md
 * item 2). These are the rules that decide what a user can see, search and bulk
 * DELETE, so the consequential cases here are the ones about a selection
 * outliving the thing it selected.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesType, visibleAssets, buildSearchHaystack, matchesQuery,
  favItems, selectableIds, pruneSelection, TYPE_FILTER_TYPES,
  type TypeFilter,
  sortAssets,
  assetAddedAt,
  assetModifiedAt,
  parseCatQuery,
  matchContext,
} from './catalog-filter.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';

/** Minimal asset; only the fields this module reads. */
const A = (id: string, over: Partial<AssetRef> = {}): AssetRef => ({
  source: 'library', id, type: 'raster', format: 'png', url: '',
  ...over,
} as AssetRef);

/** The real base-id rule: everything before a `?modifier`. */
const baseId = (id: string): string => id.split('?')[0] as string;
const cat = (): string => 'Logos';

// ── filetype filter ──────────────────────────────────────────────────────────

test("'all' admits every type, including one no bucket lists", () => {
  for (const t of ['raster', 'vector', 'video', 'lottie', 'audio', 'tokens', 'font']) {
    assert.equal(matchesType(A('x', { type: t as AssetRef['type'] }), 'all'), true, t);
  }
});

test('each bucket admits exactly its own types', () => {
  assert.equal(matchesType(A('a', { type: 'raster' }), 'image'), true);
  assert.equal(matchesType(A('a', { type: 'vector' }), 'image'), false);
  assert.equal(matchesType(A('a', { type: 'vector' }), 'vector'), true);
  // motion is the one bucket with two members - a regression that dropped either
  // would hide half the animated catalogue behind a filter that looks correct.
  assert.equal(matchesType(A('a', { type: 'video' }), 'motion'), true);
  assert.equal(matchesType(A('a', { type: 'lottie' }), 'motion'), true);
  assert.equal(matchesType(A('a', { type: 'audio' }), 'audio'), true);
  assert.equal(matchesType(A('a', { type: 'audio' }), 'motion'), false);
});

test('a type in no bucket is hidden by every filter except all', () => {
  const tokens = A('t', { type: 'tokens' });
  for (const f of ['image', 'vector', 'motion', 'audio'] as TypeFilter[]) {
    assert.equal(matchesType(tokens, f), false, f);
  }
});

test('the buckets are disjoint (no type admitted by two filters)', () => {
  const seen = new Map<string, string>();
  for (const [bucket, types] of Object.entries(TYPE_FILTER_TYPES)) {
    for (const t of types) {
      assert.equal(seen.has(t), false, `${t} is admitted by both ${seen.get(t)} and ${bucket}`);
      seen.set(t, bucket);
    }
  }
});

// ── hiding ───────────────────────────────────────────────────────────────────

test('hiding is keyed by BASE id, so it hides every modified variant too', () => {
  // The trap: hide `logo/primary` but leave `logo/primary?theme=dark` on screen,
  // and the user cannot get rid of a mark they explicitly hid.
  const assets = [A('logo/primary'), A('logo/primary?theme=dark'), A('logo/alt')];
  const out = visibleAssets(assets, new Set(['logo/primary']), baseId);
  assert.deepEqual(out.map((a) => a.id), ['logo/alt']);
});

test('an empty hidden set changes nothing', () => {
  const assets = [A('a'), A('b')];
  assert.deepEqual(visibleAssets(assets, new Set(), baseId).map((a) => a.id), ['a', 'b']);
});

// ── search ───────────────────────────────────────────────────────────────────

test('the haystack indexes name, id, tags, category and format', () => {
  const a = A('brand/mark', { format: 'svg', meta: { name: 'Primary Mark', tags: ['hero', 'dark'] } } as Partial<AssetRef>);
  const hay = buildSearchHaystack([a], cat);
  const s = hay.get('brand/mark') ?? '';
  for (const needle of ['primary mark', 'brand/mark', 'hero', 'dark', 'logos', 'svg']) {
    assert.ok(s.includes(needle), `haystack is missing "${needle}": ${s}`);
  }
});

test('an empty query matches everything - search is a filter, not a mode', () => {
  const a = A('a');
  const hay = buildSearchHaystack([a], cat);
  assert.equal(matchesQuery(a, '', hay), true);
});

test('an asset missing from the index simply does not match, rather than throwing', () => {
  assert.equal(matchesQuery(A('never-indexed'), 'x', new Map()), false);
});

// The lib/search migration (plans/99 M3) - the two semantic changes, pinned:
// multi-word queries AND across tokens (order-free), and both sides fold
// diacritics. Before this the query was one literal substring of the haystack.

test('multi-word queries AND across tokens, in any order', () => {
  const a = A('brand/mark', { meta: { name: 'Primary Mark', tags: ['hero'] } } as Partial<AssetRef>);
  const hay = buildSearchHaystack([a], cat);
  // Both terms present (name + tag) → match, even though "primary hero" is not
  // a contiguous substring of the haystack - and word order does not matter.
  assert.equal(matchesQuery(a, 'primary hero', hay), true);
  assert.equal(matchesQuery(a, 'hero primary', hay), true);
  // One term missing zeroes the whole match - adding a word narrows.
  assert.equal(matchesQuery(a, 'primary missing', hay), false);
});

test('diacritics fold on both sides - "cafe" finds "Café" and the reverse', () => {
  const a = A('photo/cafe', { meta: { name: 'Café Interior' } } as Partial<AssetRef>);
  const hay = buildSearchHaystack([a], cat);
  assert.equal(matchesQuery(a, 'cafe', hay), true);
  assert.equal(matchesQuery(a, 'café', hay), true);
});

test('search falls back to type when an asset has no format', () => {
  const a = A('a', { format: undefined, type: 'audio' } as Partial<AssetRef>);
  const hay = buildSearchHaystack([a], cat);
  assert.ok((hay.get('a') ?? '').includes('audio'));
});

test('an asset with no meta at all still indexes without throwing', () => {
  const a = A('bare', { meta: undefined } as Partial<AssetRef>);
  const hay = buildSearchHaystack([a], cat);
  assert.ok((hay.get('bare') ?? '').includes('bare'));
});

// ── favourites ───────────────────────────────────────────────────────────────

test('favourites dedupe by base id, keeping the FIRST (catalog beats user)', () => {
  // The view passes catalog assets first, so the catalog copy must win - otherwise
  // a user upload sharing a base id shows the mark twice in the favourites strip.
  const visible = [
    A('logo/primary', { source: 'library' }),
    A('logo/primary', { source: 'user' }),
  ];
  const out = favItems(visible, new Set(['logo/primary']), baseId);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.source, 'library');
});

test('a favourited modified variant is matched by its base id', () => {
  const visible = [A('logo/primary?theme=dark')];
  assert.equal(favItems(visible, new Set(['logo/primary']), baseId).length, 1);
});

test('nothing favourited yields nothing', () => {
  assert.deepEqual(favItems([A('a'), A('b')], new Set(), baseId), []);
});

// ── selectable + prune: the consequential pair ───────────────────────────────

const userA = A('u1', { source: 'user' });
const userB = A('u2', { source: 'user', type: 'vector' });
const libA = A('c1', { source: 'library' });

test("the default 'uploads' scope keeps catalog assets out - bulk delete safety", () => {
  const visible = [userA, libA];
  const hay = buildSearchHaystack(visible, cat);
  const ids = selectableIds(visible, { query: '', haystack: hay, typeFilter: 'all' });
  assert.deepEqual([...ids], ['u1']);
});

test("scope 'all' admits catalog assets too - every tile selects; destructive actions gate per-kind instead", () => {
  const visible = [userA, libA];
  const hay = buildSearchHaystack(visible, cat);
  const ids = selectableIds(visible, { query: '', haystack: hay, typeFilter: 'all', scope: 'all' });
  assert.deepEqual([...ids].sort(), ['c1', 'u1']);
  // The search still narrows the widened scope - invisibility safety is scope-independent.
  const narrowed = selectableIds(visible, { query: 'c1', haystack: hay, typeFilter: 'all', scope: 'all' });
  assert.deepEqual([...narrowed], ['c1']);
});

test('a search narrows what is selectable, so a bulk action cannot touch what is hidden', () => {
  const visible = [userA, userB];
  const hay = buildSearchHaystack(visible, cat);
  const ids = selectableIds(visible, { query: 'u2', haystack: hay, typeFilter: 'all' });
  assert.deepEqual([...ids], ['u2']);
});

test('the filetype filter narrows it for the same reason', () => {
  const visible = [userA, userB];   // u1 raster, u2 vector
  const hay = buildSearchHaystack(visible, cat);
  const ids = selectableIds(visible, { query: '', haystack: hay, typeFilter: 'vector' });
  assert.deepEqual([...ids], ['u2']);
});

test('pruneSelection drops a tick the user can no longer see, and reports how many', () => {
  // The bug this prevents: search for "u2", the u1 tick survives invisibly, and
  // "1 selected" then deletes a file the user is not looking at.
  const visible = [userA, userB];
  const hay = buildSearchHaystack(visible, cat);
  const selected = new Set(['u1', 'u2']);
  const dropped = pruneSelection(selected, selectableIds(visible, { query: 'u2', haystack: hay, typeFilter: 'all' }));
  assert.equal(dropped, 1);
  assert.deepEqual([...selected], ['u2']);
});

test('pruneSelection drops an id whose asset was deleted outright', () => {
  const selected = new Set(['gone', 'u1']);
  assert.equal(pruneSelection(selected, new Set(['u1'])), 1);
  assert.deepEqual([...selected], ['u1']);
});

test('pruneSelection is a no-op on an empty selection and on a fully-valid one', () => {
  const empty = new Set<string>();
  assert.equal(pruneSelection(empty, new Set(['u1'])), 0);
  const all = new Set(['u1', 'u2']);
  assert.equal(pruneSelection(all, new Set(['u1', 'u2'])), 0);
  assert.deepEqual([...all], ['u1', 'u2']);
});

test('a hidden asset is not selectable even when it matches the search', () => {
  // visibleAssets runs first in the view; this pins the composition, since a
  // hidden-but-selectable asset would be deletable from a UI that never shows it.
  const assets = [userA, userB];
  const visible = visibleAssets(assets, new Set(['u1']), baseId);
  const hay = buildSearchHaystack(assets, cat);
  const ids = selectableIds(visible, { query: '', haystack: hay, typeFilter: 'all' });
  assert.deepEqual([...ids], ['u2']);
});


// ── sort + dates (plans/132 WP-A) ────────────────────────────────────────────

const mk = (id: string, meta: Record<string, unknown> = {}, format = 'png') =>
  ({ id, type: 'raster', format, url: '', source: id.startsWith('user/') ? 'user' : 'library', meta }) as AssetRef;

test('assetAddedAt reads the upload id timestamp, meta.addedAt wins, catalog is null', () => {
  assert.equal(assetAddedAt({ id: 'user/upload/1787058652322-x.jpg' }), 1787058652322);
  assert.equal(assetAddedAt({ id: 'user/upload/1787058652322-x.jpg', meta: { addedAt: 5 } }), 5);
  assert.equal(assetAddedAt({ id: 'suse/logo/primary' }), null);
});

test('assetModifiedAt prefers meta.modifiedAt and falls back to added', () => {
  assert.equal(assetModifiedAt({ id: 'user/upload/1700000000000-x.png', meta: { modifiedAt: 1800000000000 } }), 1800000000000);
  assert.equal(assetModifiedAt({ id: 'user/upload/1700000000000-x.png' }), 1700000000000);
});

test('sortAssets: default preserves order; name/size/added order correctly', () => {
  const older = mk('user/upload/1700000000000-b.png', { name: 'Beta', bytes: 10 });
  const newer = mk('user/upload/1800000000000-a.png', { name: 'alpha', bytes: 999 });
  const cat = mk('suse/logo/primary', { name: 'Zeta' }, 'svg');
  const list = [older, cat, newer];
  assert.deepEqual(sortAssets(list, 'default').map((a: { id: string }) => a.id), [older, cat, newer].map(a => (a as { id: string }).id));
  assert.deepEqual(sortAssets(list, 'name').map((a) => a.meta?.name), ['alpha', 'Beta', 'Zeta']);
  assert.deepEqual(sortAssets(list, 'size')[0], newer);
  // Newest first; the dateless catalog asset keeps its relative position after dated ones.
  assert.deepEqual(sortAssets(list, 'added').map((a: { id: string }) => a.id), [newer.id, older.id, cat.id].map(String));
});

// ── Structured query prefixes (plans/132 WP-C item 3) ────────────────────────

const tagged = (id: string, extra: Record<string, unknown> = {}): AssetRef => ({
  source: 'user', id, type: 'raster', format: 'png', url: `blob:${id}`, version: '1.0.0',
  meta: { name: id, ...extra },
} as unknown as AssetRef);

test('parseCatQuery carves tag:/type:/is: out and keeps the rest as text tokens', () => {
  const q = parseCatQuery('tag:logo dark type:image is:upload');
  assert.deepEqual(q.tags, ['logo']);
  assert.deepEqual(q.types, ['image']);
  assert.deepEqual(q.flags, ['upload']);
  assert.deepEqual(q.text, ['dark']);
});

test('a bare half-typed prefix stays text, never blanking the grid mid-keystroke', () => {
  const q = parseCatQuery('tag:');
  assert.deepEqual(q.tags, []);
  assert.ok(q.text.length >= 1);
});

test('tag: prefix-matches a folded tag; a miss excludes the asset', () => {
  const a = tagged('user/upload/1-a.png', { tags: ['Logos', 'dark'] });
  const hay = buildSearchHaystack([a], () => 'brand');
  assert.equal(matchesQuery(a, 'tag:logo', hay), true);
  assert.equal(matchesQuery(a, 'tag:print', hay), false);
});

test('type: accepts a bucket name or a raw format; is:upload and is:genai gate structurally', () => {
  const up = tagged('user/upload/2-b.png', { aiGenerated: 'full' });
  const hay = buildSearchHaystack([up], () => 'brand');
  assert.equal(matchesQuery(up, 'type:image', hay), true);
  assert.equal(matchesQuery(up, 'type:png', hay), true);
  assert.equal(matchesQuery(up, 'type:audio', hay), false);
  assert.equal(matchesQuery(up, 'is:upload', hay), true);
  assert.equal(matchesQuery(up, 'is:genai', hay), true);
  assert.equal(matchesQuery(up, 'is:nonsense', hay), false);
});

test('structured terms AND with text tokens', () => {
  const a = tagged('user/upload/3-c.png', { name: 'Hero banner', tags: ['dark'] });
  const hay = buildSearchHaystack([a], () => 'brand');
  assert.equal(matchesQuery(a, 'tag:dark hero', hay), true);
  assert.equal(matchesQuery(a, 'tag:dark nomatch', hay), false);
});

test('matchContext names the matched tag or category, and stays null on a name match', () => {
  const a = tagged('user/upload/4-d.png', { name: 'Hero', tags: ['Print ready'] });
  assert.equal(matchContext(a, 'tag:print', () => 'brand'), 'Print ready');
  assert.equal(matchContext(a, 'print', () => 'brand'), 'Print ready');
  assert.equal(matchContext(a, 'hero', () => 'brand'), null);
  assert.equal(matchContext(a, 'brand', () => 'Brand photos'), 'Brand photos');
  assert.equal(matchContext(a, '', () => 'brand'), null);
});

test('embedded keywords from the ingest snapshot are searchable (plans/144 Wave 5)', () => {
  const a = tagged('user/upload/5-e.webp', {
    name: 'IMG_2041',
    provenance: { metaDigest: { keywords: 'harbour, dusk, boats' } },
  });
  const hay = buildSearchHaystack([a], () => 'photos');
  assert.equal(matchesQuery(a, 'dusk', hay), true);
  assert.equal(matchesQuery(a, 'harbour boats', hay), true);
  assert.equal(matchesQuery(a, 'mountain', hay), false);
});
