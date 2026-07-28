// SPDX-License-Identifier: MPL-2.0
/**
 * A `zzfxm:<seed>` ref names ONE song, in every shell.
 *
 * The draw lives in the engine (`generatedSongSpec`) precisely so the web bridge,
 * the Node shells and the scripts cannot each grow their own copy and drift. These
 * tests pin the two properties that make a ref a promise: the same inputs give a
 * deeply equal spec, and naming a style shifts nothing else in the stream — a seed
 * and `seed:style` share their scale, progression and pan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatedSongSpec } from '../engine/src/index.ts';

test('the same seed yields a deeply equal spec through the engine export', () => {
  assert.deepEqual(generatedSongSpec(20260728, 30), generatedSongSpec(20260728, 30));
  assert.deepEqual(generatedSongSpec(0, 8), generatedSongSpec(0, 8));
  assert.deepEqual(generatedSongSpec(4294967295, 45), generatedSongSpec(4294967295, 45));
  assert.deepEqual(generatedSongSpec(7, 12, 'lofi'), generatedSongSpec(7, 12, 'lofi'));
});

test('a named style replaces only the archetype and its tempo window', () => {
  const bare = generatedSongSpec(4242, 30);
  const styled = generatedSongSpec(4242, 30, 'jungle');
  assert.equal(styled.archetype, 'jungle');
  // Everything drawn after the archetype comes from the same stream position.
  assert.equal(styled.scale, bare.scale);
  assert.deepEqual(styled.roots, bare.roots);
  assert.equal(styled.pan, bare.pan);
  assert.equal(styled.seed, bare.seed);
  // The tempo is the ONE knock-on: same random draw, different archetype window.
  assert.ok(styled.bpm >= 158 && styled.bpm <= 174, `jungle bpm out of window: ${styled.bpm}`);
});

test('naming the style the seed drew anyway changes nothing at all', () => {
  const bare = generatedSongSpec(31337, 20);
  assert.deepEqual(generatedSongSpec(31337, 20, bare.archetype), bare);
});

test('different seeds diverge, and the seed is coerced to uint32', () => {
  assert.notDeepEqual(generatedSongSpec(1, 30), generatedSongSpec(2, 30));
  // -1 >>> 0 === 4294967295: the same stream, so the same song.
  assert.deepEqual(generatedSongSpec(-1, 30), generatedSongSpec(4294967295, 30));
});

test('only targetSec passes through untouched; it does not perturb the draw', () => {
  const a = generatedSongSpec(5, 30);
  const b = generatedSongSpec(5, 60);
  assert.equal(a.targetSec, 30);
  assert.equal(b.targetSec, 60);
  assert.deepEqual({ ...a, targetSec: 0 }, { ...b, targetSec: 0 });
});
