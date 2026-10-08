// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNearestPathCache, NEAREST_CACHE_LIMITS } from '../engine/src/geom-nearest-cache.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import type { GeomPath } from '../engine/src/geom/path.ts';

const path = (count = 1): GeomPath => [
  { closed: false, curves: Array.from({ length: count }, () => [0, 0, 0, 0, 0, 0, 100, 0]) },
];

test('nearest cache reuses successful values, evicts by recency and reparses failures', () => {
  const parsed: unknown[] = [];
  const cache = createNearestPathCache((d) => {
    parsed.push(d);
    return d === 'bad' ? { ok: false, code: 'invalid-path', message: 'bad' } : path();
  });
  const first = cache.load('0');
  for (let i = 1; i < 8; i++) cache.load(String(i));
  assert.equal(cache.load('0'), first);
  cache.load('8');
  cache.load('1');
  assert.equal(parsed.filter((value) => value === '0').length, 1);
  assert.equal(parsed.filter((value) => value === '1').length, 2);
  cache.load('bad');
  cache.load('bad');
  assert.equal(parsed.filter((value) => value === 'bad').length, 2);
  assert.equal(cache.stats().entries, 8);
  cache.clear();
  assert.deepEqual(cache.stats(), { entries: 0, characters: 0, curves: 0 });
});

test('nearest cache bounds aggregate string and curve retention', () => {
  const characters = createNearestPathCache(() => path());
  characters.load('a'.repeat(512_000));
  characters.load('b'.repeat(512_000));
  characters.load('c'.repeat(512_000));
  assert.deepEqual(characters.stats(), { entries: 2, characters: 1_024_000, curves: 2 });
  const curves = createNearestPathCache(() => path(16_000));
  curves.load('a');
  curves.load('b');
  curves.load('c');
  assert.equal(curves.stats().curves, NEAREST_CACHE_LIMITS.maxCurves);
  assert.equal(curves.stats().entries, 2);
  const oversized = createNearestPathCache(() => path(32_001));
  oversized.load('large');
  assert.equal(oversized.stats().entries, 0);
});

test('nearest cache keeps public parse results and caller edits separate', () => {
  const api = makeGeomApi(),
    d = 'M0 0C0 0 0 0 100 0';
  const first = api.nearest(d, 50, 10);
  assert.equal(first.ok, true);
  const parsed = api.parse(d);
  assert.equal(parsed.ok, true);
  if (parsed.ok) parsed.value[0]!.curves[0]![6] = 500;
  if (first.ok) first.value.x = 1000;
  const again = api.nearest(d, 50, 10);
  assert.equal(again.ok, true);
  if (again.ok) {
    assert.ok(Math.abs(again.value.x - 50) < 1e-10);
    assert.equal(again.value.distance, 10);
  }
  const changed = api.nearest('M0 0C0 0 0 0 200 0', 150, 10);
  assert.equal(changed.ok, true);
  if (changed.ok) assert.ok(Math.abs(changed.value.x - 150) < 1e-10);
  assert.deepEqual(api.nearest('M0 0C0 0', 0, 0), api.nearest('M0 0C0 0', 0, 0));
});
