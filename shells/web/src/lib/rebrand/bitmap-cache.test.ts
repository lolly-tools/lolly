// SPDX-License-Identifier: MPL-2.0
/**
 * The byte-bounded LRU for decoded slide pictures (plan 274 section 9, "Memory").
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/bitmap-cache.test.ts
 *
 * The thing under test is RELEASE, not storage: a cache that holds bytes under a
 * ceiling but never closes an ImageBitmap or revokes an object URL has moved the
 * leak rather than removed it. So every case here counts close() calls and revoked
 * URLs, through a fake bitmap that records them. No browser, no real bitmap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bitmapCacheFor, createBitmapCache, type BitmapCacheKeyV1, type CloseableBitmapV1 } from './bitmap-cache.ts';
import { DECODE_BUDGETS } from './budget.ts';

interface FakeBitmap extends CloseableBitmapV1 { closes: number; label: string }

function fakeBitmap(label: string): FakeBitmap {
  const b: FakeBitmap = {
    label,
    closes: 0,
    close: () => { b.closes++; },
  };
  return b;
}

function harness(maxBytes: number) {
  const revoked: string[] = [];
  const cache = createBitmapCache({ maxBytes, revokeObjectUrl: (u) => { revoked.push(u); } });
  return { cache, revoked };
}

const key = (assetRef: string, longEdge = 320, planRevision?: number): BitmapCacheKeyV1 =>
  planRevision === undefined ? { assetRef, longEdge } : { assetRef, longEdge, planRevision };

test('a stored entry comes back and is counted in bytes', () => {
  const { cache } = harness(1000);
  const bitmap = fakeBitmap('a');
  assert.equal(cache.set(key('sha256:a'), { bitmap, bytes: 400 }), true);
  assert.equal(cache.bytesUsed(), 400);
  assert.equal(cache.size(), 1);
  assert.equal(cache.has(key('sha256:a')), true);
  assert.equal(cache.get(key('sha256:a'))?.bitmap, bitmap);
  assert.equal(bitmap.closes, 0, 'a held entry is not released');
});

test('the key is the asset ref, the ladder rung and the plan revision together', () => {
  const { cache } = harness(10_000);
  cache.set(key('sha256:a', 320), { bytes: 10 });
  cache.set(key('sha256:a', 1600), { bytes: 20 });
  cache.set(key('sha256:a', 320, 3), { bytes: 30 });
  assert.equal(cache.size(), 3, 'three distinct keys');
  assert.equal(cache.get(key('sha256:a', 320))?.bytes, 10);
  assert.equal(cache.get(key('sha256:a', 1600))?.bytes, 20);
  assert.equal(cache.get(key('sha256:a', 320, 3))?.bytes, 30);
  assert.equal(cache.has(key('sha256:a', 320, 4)), false);
});

test('eviction is oldest first and releases what it drops', () => {
  const { cache, revoked } = harness(1000);
  const a = fakeBitmap('a');
  const b = fakeBitmap('b');
  const c = fakeBitmap('c');
  cache.set(key('sha256:a'), { bitmap: a, objectUrl: 'blob:a', bytes: 400 });
  cache.set(key('sha256:b'), { bitmap: b, objectUrl: 'blob:b', bytes: 400 });
  assert.equal(cache.bytesUsed(), 800);
  cache.set(key('sha256:c'), { bitmap: c, objectUrl: 'blob:c', bytes: 400 });
  assert.equal(cache.bytesUsed(), 800, 'never over the ceiling');
  assert.equal(cache.has(key('sha256:a')), false, 'the oldest went');
  assert.equal(a.closes, 1, 'the evicted bitmap was closed');
  assert.deepEqual(revoked, ['blob:a'], 'the evicted object URL was revoked');
  assert.equal(b.closes, 0);
  assert.equal(c.closes, 0);
});

test('a read makes an entry the newest, so the other one goes first', () => {
  const { cache } = harness(1000);
  const a = fakeBitmap('a');
  const b = fakeBitmap('b');
  cache.set(key('sha256:a'), { bitmap: a, bytes: 400 });
  cache.set(key('sha256:b'), { bitmap: b, bytes: 400 });
  cache.get(key('sha256:a'));
  cache.set(key('sha256:c'), { bytes: 400 });
  assert.equal(cache.has(key('sha256:a')), true, 'the one that was read stayed');
  assert.equal(cache.has(key('sha256:b')), false);
  assert.equal(b.closes, 1);
  assert.equal(a.closes, 0);
});

test('the cache never holds more than the ceiling, over many writes', () => {
  const { cache } = harness(1000);
  for (let i = 0; i < 50; i++) {
    cache.set(key(`sha256:${i}`), { bitmap: fakeBitmap(String(i)), bytes: 137 });
    assert.ok(cache.bytesUsed() <= 1000, `after ${i}: ${cache.bytesUsed()} bytes`);
  }
  assert.equal(cache.size(), 7, '7 * 137 = 959 fits, an eighth would not');
});

test('an entry larger than the whole ceiling is refused, and stays the caller\'s to close', () => {
  const { cache, revoked } = harness(1000);
  const held = fakeBitmap('held');
  cache.set(key('sha256:held'), { bitmap: held, bytes: 400 });
  const huge = fakeBitmap('huge');
  assert.equal(cache.set(key('sha256:huge'), { bitmap: huge, objectUrl: 'blob:huge', bytes: 2000 }), false);
  assert.equal(huge.closes, 0, 'the cache took no ownership, so it closed nothing');
  assert.deepEqual(revoked, [], 'and revoked nothing');
  assert.equal(cache.has(key('sha256:huge')), false);
  assert.equal(cache.bytesUsed(), 400, 'the refusal evicted nothing');
  assert.equal(held.closes, 0);
  assert.equal(cache.stats().refusals, 1);
});

test('a refusal over a key that is already held leaves the held entry alone', () => {
  // The caller may be drawing from the picture it got out of an earlier get(),
  // so a write the cache turns down must not cost it that picture.
  const { cache, revoked } = harness(1000);
  const held = fakeBitmap('held');
  assert.equal(cache.set(key('sha256:a'), { bitmap: held, objectUrl: 'blob:held', bytes: 400 }), true);
  const huge = fakeBitmap('huge');
  assert.equal(cache.set(key('sha256:a'), { bitmap: huge, bytes: 5000 }), false);
  assert.equal(cache.has(key('sha256:a')), true, 'what was there is still there');
  assert.equal(cache.get(key('sha256:a'))?.bitmap, held);
  assert.equal(held.closes, 0, 'the held bitmap was not closed');
  assert.equal(huge.closes, 0, 'nor was the refused one');
  assert.deepEqual(revoked, []);
  assert.equal(cache.bytesUsed(), 400);
});

test('a size that is not a finite number is refused rather than counted', () => {
  const { cache } = harness(1000);
  assert.equal(cache.set(key('sha256:a'), { bytes: 200 }), true);
  assert.equal(cache.set(key('sha256:nan'), { bytes: Number.NaN }), false);
  assert.equal(cache.set(key('sha256:missing'), { bytes: undefined as unknown as number }), false);
  assert.equal(cache.set(key('sha256:huge'), { bytes: Number.POSITIVE_INFINITY }), false);
  assert.equal(Number.isFinite(cache.bytesUsed()), true, 'the running total is still a number');
  assert.equal(cache.bytesUsed(), 200);
  assert.equal(cache.size(), 1);
  assert.equal(cache.stats().refusals, 3);
  // The cache still works afterwards: a NaN once poisoned the total for good.
  assert.equal(cache.set(key('sha256:b'), { bytes: 10 }), true);
  assert.equal(cache.bytesUsed(), 210);
  assert.equal(cache.stats().evictions, 0, 'nothing was evicted by the refusals');
});

test('a ceiling that is not a finite number becomes zero, not a cache that holds nothing and says NaN', () => {
  const cache = createBitmapCache({ maxBytes: Number.NaN });
  assert.equal(cache.maxBytes(), 0);
  assert.equal(cache.set(key('sha256:a'), { bytes: 10 }), false);
  assert.equal(cache.bytesUsed(), 0);
  assert.equal(cache.size(), 0);
  assert.equal(cache.stats().refusals, 1);
  assert.equal(cache.stats().evictions, 0);
  assert.equal(Number.isFinite(cache.stats().maxBytes), true);
});

test('writing the same key again releases what was there', () => {
  const { cache, revoked } = harness(1000);
  const first = fakeBitmap('first');
  const second = fakeBitmap('second');
  cache.set(key('sha256:a'), { bitmap: first, objectUrl: 'blob:first', bytes: 300 });
  cache.set(key('sha256:a'), { bitmap: second, objectUrl: 'blob:second', bytes: 500 });
  assert.equal(first.closes, 1);
  assert.deepEqual(revoked, ['blob:first']);
  assert.equal(cache.bytesUsed(), 500, 'the old size went with the old entry');
  assert.equal(cache.get(key('sha256:a'))?.bitmap, second);
});

test('delete, deleteAsset and clear each release', () => {
  const { cache, revoked } = harness(10_000);
  const a320 = fakeBitmap('a320');
  const a1600 = fakeBitmap('a1600');
  const b320 = fakeBitmap('b320');
  cache.set(key('sha256:a', 320), { bitmap: a320, objectUrl: 'blob:a320', bytes: 100 });
  cache.set(key('sha256:a', 1600), { bitmap: a1600, objectUrl: 'blob:a1600', bytes: 200 });
  cache.set(key('sha256:b', 320), { bitmap: b320, objectUrl: 'blob:b320', bytes: 300 });

  assert.equal(cache.delete(key('sha256:b', 320)), true);
  assert.equal(cache.delete(key('sha256:b', 320)), false, 'a second delete is a no-op');
  assert.equal(b320.closes, 1);
  assert.equal(cache.bytesUsed(), 300);

  assert.equal(cache.deleteAsset('sha256:a'), 2, 'both rungs of one asset');
  assert.equal(a320.closes, 1);
  assert.equal(a1600.closes, 1);
  assert.equal(cache.bytesUsed(), 0);
  assert.deepEqual(revoked, ['blob:b320', 'blob:a320', 'blob:a1600']);

  const c = fakeBitmap('c');
  cache.set(key('sha256:c'), { bitmap: c, bytes: 50 });
  cache.clear();
  assert.equal(c.closes, 1);
  assert.equal(cache.bytesUsed(), 0);
  assert.equal(cache.size(), 0);
});

test('a plan revision change drops the proposals and keeps the originals', () => {
  const { cache } = harness(10_000);
  const source = fakeBitmap('source');
  const oldProposal = fakeBitmap('old');
  const newProposal = fakeBitmap('new');
  cache.set(key('sha256:src', 320), { bitmap: source, bytes: 100 });
  cache.set(key('sha256:src', 320, 4), { bitmap: oldProposal, bytes: 100 });
  cache.set(key('sha256:src', 320, 5), { bitmap: newProposal, bytes: 100 });

  assert.equal(cache.deleteStaleRevisions(5), 1);
  assert.equal(oldProposal.closes, 1, 'the older revision went');
  assert.equal(newProposal.closes, 0);
  assert.equal(source.closes, 0, 'an entry bound to no revision is a source picture and stays');
  assert.equal(cache.bytesUsed(), 200);
});

test('stats record a high-water mark and the hit and miss counts', () => {
  const { cache } = harness(1000);
  cache.set(key('sha256:a'), { bytes: 400 });
  cache.set(key('sha256:b'), { bytes: 400 });
  cache.get(key('sha256:a'));
  cache.get(key('sha256:zz'));
  cache.set(key('sha256:c'), { bytes: 400 });   // evicts one
  const s = cache.stats();
  assert.equal(s.maxBytes, 1000);
  assert.equal(s.bytesUsed, 800);
  assert.equal(s.entries, 2);
  assert.equal(s.highWaterBytes, 800);
  assert.equal(s.highWaterEntries, 2);
  assert.equal(s.evictions, 1);
  assert.equal(s.hits, 1);
  assert.equal(s.misses, 1);
  cache.clear();
  assert.equal(cache.stats().highWaterBytes, 800, 'the high-water mark survives a clear');
});

test('an entry with no bitmap and no URL still costs its bytes', () => {
  const { cache, revoked } = harness(1000);
  cache.set(key('sha256:a'), { bytes: 600 });
  cache.set(key('sha256:b'), { bytes: 600 });
  assert.equal(cache.bytesUsed(), 600);
  assert.equal(cache.has(key('sha256:a')), false);
  assert.deepEqual(revoked, [], 'nothing to revoke');
});

test('a bitmap whose close throws does not break the eviction', () => {
  const { cache } = harness(500);
  const angry: CloseableBitmapV1 = { close: () => { throw new Error('already closed'); } };
  cache.set(key('sha256:a'), { bitmap: angry, bytes: 400 });
  cache.set(key('sha256:b'), { bytes: 400 });
  assert.equal(cache.bytesUsed(), 400);
  assert.equal(cache.has(key('sha256:a')), false);
});

test('negative and fractional sizes are floored at zero', () => {
  const { cache } = harness(1000);
  cache.set(key('sha256:a'), { bytes: -50 });
  assert.equal(cache.bytesUsed(), 0);
  cache.set(key('sha256:b'), { bytes: 10.9 });
  assert.equal(cache.bytesUsed(), 10);
});

test('the cache a budget gets takes that budget as its ceiling', () => {
  const cache = bitmapCacheFor(DECODE_BUDGETS.phone);
  assert.equal(cache.maxBytes(), DECODE_BUDGETS.phone.maxCacheBytes);
  assert.equal(cache.bytesUsed(), 0);
});

test('a budget read back with no cache ceiling gives a cache that refuses rather than one that lies', () => {
  // A budget crosses a structured clone and can be read back from a stored
  // record, so a missing number reaches here without a type error.
  const broken = { ...DECODE_BUDGETS.phone, maxCacheBytes: undefined as unknown as number };
  const cache = bitmapCacheFor(broken);
  assert.equal(cache.maxBytes(), 0);
  assert.equal(cache.set(key('sha256:a'), { bytes: 1 }), false);
  assert.equal(cache.bytesUsed(), 0);
});

test('the default revoker does not throw where there is no object URL support', () => {
  const cache = createBitmapCache({ maxBytes: 100 });
  cache.set(key('sha256:a'), { objectUrl: 'blob:nothing-here', bytes: 50 });
  assert.doesNotThrow(() => { cache.clear(); });
});
