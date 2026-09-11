// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCover, formatCover, loadAudioCovers, saveAudioCover, resolveAudioLook,
} from './audio-covers.ts';
import { audioThumbShape } from './audio-thumb.ts';
import type { Profile } from '@lolly-tools/core/host-v1';

const POOL = ['#30ba78', '#0c322c', '#fe7c3f', '#2453ff'];
const ID = 'lolly/modules/take-a-walk';

/** A host whose profile.set just records - enough to assert what would be persisted. */
function fakeHost() {
  const saved: Profile[] = [];
  return { saved, host: { profile: { set: async (p: Profile) => { saved.push(structuredClone(p)); } } } as never };
}

// ─── the recipe round-trips ──────────────────────────────────────────────────

test('a cover round-trips through its stored form', () => {
  assert.deepEqual(parseCover(formatCover({ shape: 'blob' })), { shape: 'blob' });
  assert.deepEqual(parseCover(formatCover({ shape: 'ring', colour: 2 })), { shape: 'ring', colour: 2 });
  assert.equal(formatCover({ shape: 'blob' }), 'blob');
  assert.equal(formatCover({ shape: 'ring', colour: 2 }), 'ring:2');
});

test('an unreadable stored value degrades to the generated look, never to an error', () => {
  for (const bad of ['', 'not-a-shape', 'blob:-1', 'blob:abc', ':::', null, 42, {}, undefined]) {
    const c = parseCover(bad);
    // A shape must never be invented; either it parses to a REAL shape or it is null.
    if (c) assert.ok(['bars', 'mirror', 'wave', 'ring', 'blob'].includes(c.shape));
    else assert.equal(c, null);
  }
  assert.equal(parseCover('blob:-1')?.colour, undefined, 'a negative index is dropped, the shape survives');
});

// ─── structure frozen, colour re-resolves ────────────────────────────────────

test('a cover FREEZES the shape - a rebrand must not turn a blob into a ring', () => {
  const covers = new Map([[ID, { shape: 'blob' as const, colour: 1 }]]);
  // Two completely different brand pools = a rebrand.
  const a = resolveAudioLook(ID, POOL, covers);
  const b = resolveAudioLook(ID, ['#111111', '#eeeeee'], covers);
  assert.equal(a.shape, 'blob');
  assert.equal(b.shape, 'blob', 'the structure is the user’s and does not move');
});

test('a cover RE-RESOLVES its colour against the active brand', () => {
  const covers = new Map([[ID, { shape: 'ring' as const, colour: 2 }]]);
  assert.equal(resolveAudioLook(ID, POOL, covers).ink!.hex, '#fe7c3f');
  // Same recipe, different brand → different paint, same slot.
  assert.equal(resolveAudioLook(ID, ['#aa0000', '#00aa00', '#0000aa'], covers).ink!.hex, '#0000aa');
});

test('a pinned index the current pool cannot satisfy falls back rather than blanking', () => {
  const covers = new Map([[ID, { shape: 'wave' as const, colour: 7 }]]);
  const got = resolveAudioLook(ID, POOL, covers);
  assert.equal(got.shape, 'wave', 'the shape still holds');
  assert.ok(got.ink, 'and it still paints - a smaller palette is not a reason to blank a cover');
  // The choice is not destroyed: a pool that grows back makes it work again.
  assert.equal(resolveAudioLook(ID, [...POOL, 'a', 'b', 'c', '#123456'], covers).ink!.hex, '#123456');
});

test('a shape-only cover keeps the GENERATED colour', () => {
  const covers = new Map([[ID, { shape: 'blob' as const }]]);
  const got = resolveAudioLook(ID, POOL, covers);
  assert.equal(got.shape, 'blob');
  assert.deepEqual(got.ink, resolveAudioLook(ID, POOL).ink, 'colour still comes from the brand');
});

// ─── the generated default stands alone ──────────────────────────────────────

test('with no cover the look is exactly the generated one', () => {
  const got = resolveAudioLook(ID, POOL);
  assert.equal(got.shape, audioThumbShape(ID));
  assert.equal(got.custom, false);
  assert.deepEqual(resolveAudioLook(ID, POOL, new Map()), got, 'an empty overlay changes nothing');
});

test('covers for OTHER assets never leak onto this one', () => {
  const covers = new Map([['lolly/modules/headspin', { shape: 'blob' as const }]]);
  assert.equal(resolveAudioLook(ID, POOL, covers).shape, audioThumbShape(ID));
  assert.equal(resolveAudioLook(ID, POOL, covers).custom, false);
});

// ─── storage ─────────────────────────────────────────────────────────────────

test('saving and clearing - reverting is as easy as setting', async () => {
  const { saved, host } = fakeHost();
  const profile: Profile = {};
  await saveAudioCover(host, profile, ID, { shape: 'blob', colour: 1 });
  assert.deepEqual(profile.audioCovers, { [ID]: 'blob:1' });

  await saveAudioCover(host, profile, ID, null);
  assert.equal(profile.audioCovers, undefined,
    'the last cover going leaves NO key, so an untouched profile stays clean');
  assert.equal(saved.length, 2);
});

test('one asset’s cover does not disturb another’s', async () => {
  const { host } = fakeHost();
  const profile: Profile = {};
  await saveAudioCover(host, profile, ID, { shape: 'blob' });
  await saveAudioCover(host, profile, 'lolly/songs/drift', { shape: 'ring', colour: 0 });
  await saveAudioCover(host, profile, ID, null);
  assert.deepEqual(profile.audioCovers, { 'lolly/songs/drift': 'ring:0' });
});

test('a failed profile write is non-fatal - the choice just does not survive a reload', async () => {
  const host = { profile: { set: async () => { throw new Error('quota'); } } } as never;
  const profile: Profile = {};
  await assert.doesNotReject(() => saveAudioCover(host, profile, ID, { shape: 'blob' }));
  assert.deepEqual(profile.audioCovers, { [ID]: 'blob' }, 'the in-memory profile still reflects it');
});

test('loading tolerates a junk profile and drops only the bad entries', () => {
  const covers = loadAudioCovers({
    audioCovers: { a: 'blob', b: 'nonsense', c: 'ring:1', d: 42 as never },
  } as Profile);
  assert.deepEqual([...covers.keys()], ['a', 'c']);
  assert.deepEqual(covers.get('c'), { shape: 'ring', colour: 1 });
  assert.equal(loadAudioCovers(null).size, 0);
  assert.equal(loadAudioCovers({} as Profile).size, 0);
});
