// SPDX-License-Identifier: MPL-2.0
/**
 * Playlist ORDER for the Neurospicy player. The picker renders whatever listLoops
 * returns, grouped by trackCategory - so this order IS the order prev/next and the
 * end-of-track advance walk. These tests pin that one-order contract: a regression
 * here is "next plays something other than what the list shows".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listLoops, trackCategory, cycleNeurospicyLoop, getNeurospicy, setNeurospicyLoop,
  NEURO_CATEGORY_ORDER, invalidateNeurospicyTracks,
  type NeurospicyHost, type NeuroTrack,
} from './neurospicy.ts';

type Ref = { id: string; type?: string; format?: string; url?: string; meta?: Record<string, unknown> };

const catalog: Ref[] = [
  // Deliberately out of display order, so a passing test can't be an accident of input order.
  { id: 'lolly/loops/zulu', type: 'audio', format: 'opus', url: '/z.opus', meta: { name: 'Zulu Beat', tags: ['neurospicy'] } },
  { id: 'lolly/songs/amber', type: 'audio', format: 'zzfxm', url: '/amber.json', meta: { name: 'Amber Glow', tags: ['neurospicy', 'generated'] } },
  { id: 'brand/music/bed-a', type: 'audio', format: 'mp3', url: '/bed.mp3', meta: { name: 'Bed A', tags: ['music'] } },
  { id: 'lolly/loops/calm', type: 'audio', format: 'opus', url: '/c.opus', meta: { name: 'Calm Tide', tags: ['neurospicy', 'lofi'] } },
  { id: 'lolly/loops/aero', type: 'audio', format: 'opus', url: '/a.opus', meta: { name: 'Aero Beat', tags: ['neurospicy'] } },
  { id: 'lolly/songs/drift', type: 'audio', format: 'zzfxm', url: '/drift.json', meta: { name: 'Drift', tags: ['neurospicy', 'generated'] } },
];
const uploads: Ref[] = [
  { id: 'user/audio/2', type: 'audio', format: 'wav', url: 'blob:2', meta: { name: 'My Take Two', tags: ['audio', 'neurospicy'] } },
  { id: 'user/audio/1', type: 'audio', format: 'wav', url: 'blob:1', meta: { name: 'A First Upload', tags: [] } },
];

const host: NeurospicyHost = {
  assets: {
    get: async (id: string) => {
      const r = [...catalog, ...uploads].find((a) => a.id === id);
      if (!r) throw new Error(`no asset ${id}`);
      return r as never;
    },
    query: async () => catalog as never,
    _listUserAssets: async () => uploads,
  },
  profile: { get: async () => ({}), set: async () => ({}) },
};

const names = (ts: NeuroTrack[]): string[] => ts.map((t) => t.name);

test('listLoops returns tracks grouped in NEURO_CATEGORY_ORDER, alphabetical within a group', async () => {
  invalidateNeurospicyTracks();
  const loops = await listLoops(host);
  const groups = loops.map(trackCategory);
  // Every group appears as ONE contiguous run, in the declared order.
  const runs = groups.filter((g, i) => g !== groups[i - 1]);
  assert.deepEqual(runs, [...new Set(runs)], 'a category was split into more than one run');
  const declared = NEURO_CATEGORY_ORDER.filter((k) => runs.includes(k));
  assert.deepEqual(runs, declared);
  // The exact list a user reads in the picker (catalog → uploads → lolly → ambient → beats → radio…).
  assert.deepEqual(names(loops).slice(0, 8), [
    'Bed A',                        // catalog
    'A First Upload', 'My Take Two',// uploads, A→Z
    'Amber Glow', 'Drift',          // Lolly Sings (zzfxm), A→Z
    'Calm Tide',                    // ambient (lofi)
    'Aero Beat', 'Zulu Beat',       // beats, A→Z
  ]);
  assert.equal(trackCategory(loops.at(-1)!), 'radio', 'radio trails the local tracks');
});

test('next / previous step through that same order, and wrap', async () => {
  invalidateNeurospicyTracks();
  const loops = await listLoops(host);
  const local = loops.filter((t) => trackCategory(t) !== 'radio');
  await setNeurospicyLoop(host, local[0]!.id);
  const walked: string[] = [];
  for (let i = 1; i < local.length; i++) {
    await cycleNeurospicyLoop(host, 1);
    walked.push(getNeurospicy().loopId);
  }
  assert.deepEqual(walked, local.slice(1).map((t) => t.id));
  // Previous retraces it.
  await cycleNeurospicyLoop(host, -1);
  assert.equal(getNeurospicy().loopId, local.at(-2)!.id);
  // Wrapping forward off the very last track (a radio station) lands on the first.
  await setNeurospicyLoop(host, loops.at(-1)!.id);
  await cycleNeurospicyLoop(host, 1);
  assert.equal(getNeurospicy().loopId, loops[0]!.id);
});

test('the play-through advance skips radio, a pressed Next does not', async () => {
  invalidateNeurospicyTracks();
  const loops = await listLoops(host);
  const lastLocal = loops.filter((t) => trackCategory(t) !== 'radio').at(-1)!;
  // A pressed Next honours the visible order - radio is right there in the list.
  await setNeurospicyLoop(host, lastLocal.id);
  await cycleNeurospicyLoop(host, 1);
  assert.equal(trackCategory(loops.find((t) => t.id === getNeurospicy().loopId)!), 'radio');
  // The automatic end-of-track advance must never silently start a stream: it walks
  // past every station and wraps to the first local track.
  await setNeurospicyLoop(host, lastLocal.id);
  await cycleNeurospicyLoop(host, 1, { skipStreams: true });
  assert.equal(getNeurospicy().loopId, loops[0]!.id);
});
