// SPDX-License-Identifier: MPL-2.0
/**
 * Saved tunes (lib/lofi-tune.ts) and the preset tunes in the starter catalogs:
 *  - a saved tune's bytes are its recipe, read back exactly, and a stray JSON file is
 *    never mistaken for one;
 *  - the recipe in an asset's meta is checked like a shared link (a known mood, a
 *    32-bit seed);
 *  - every `lofi` asset in a starter catalog holds the recipe its index entry states,
 *    in the same bytes the player writes when someone saves a tune;
 *  - the player lists saved and preset tunes in their genre's group and plays them on
 *    the station.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-tune.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LOFI_TUNE_FORMAT, lofiTuneBytes, lofiTuneFromBytes, lofiTuneFromMeta, lofiTuneName } from './lofi-tune.ts';
import { savedTuneOf, playsOnStation } from './neurospicy-lofi.ts';
import { listLoops, trackCategory, invalidateNeurospicyTracks, type NeurospicyHost } from './neurospicy.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

test('a saved tune is its recipe, and reads back exactly', () => {
  const recipe = { mood: 'sings' as const, seed: 4111860815 };
  const bytes = lofiTuneBytes(recipe);
  assert.equal(new TextDecoder().decode(bytes), '{"kind":"lolly-lofi-tune","version":1,"mood":"sings","seed":4111860815}');
  assert.deepEqual(lofiTuneFromBytes(bytes), recipe);
});

test('only a saved tune reads as one', () => {
  assert.equal(lofiTuneFromBytes(enc('{"mood":"sings","seed":1}')), null, 'a JSON file without the kind is not a tune');
  assert.equal(lofiTuneFromBytes(enc('{"kind":"lolly-lofi-tune","version":1,"mood":"sunny","seed":1}')), null, 'an unknown mood');
  assert.equal(lofiTuneFromBytes(enc('{"kind":"lolly-lofi-tune","version":1,"mood":"warm","seed":4294967296}')), null, 'a seed past 32 bits');
  assert.equal(lofiTuneFromBytes(enc('not json')), null);
  assert.equal(lofiTuneFromMeta({ mood: 'rainy', seed: 1.5 }), null, 'a fractional seed');
  assert.equal(lofiTuneFromMeta(null), null);
  assert.deepEqual(lofiTuneFromMeta({ mood: 'rainy', seed: 0 }), { mood: 'rainy', seed: 0 });
});

test('a saved tune is named by its station, key and tempo', () => {
  assert.equal(lofiTuneName({ mood: 'sings', seed: 1 }, { key: 'F major', bpm: 98 }), 'Lolly Sings · F major · 98 bpm');
  assert.equal(lofiTuneName({ mood: 'lateNight', seed: 1 }, { key: 'A minor', bpm: 70.4 }), 'Late night · A minor · 70 bpm');
});

test('each starter catalog\'s preset tunes hold the recipe their entry states', () => {
  for (const brand of ['lolly-demo', 'lolly-start']) {
    const index = JSON.parse(readFileSync(`${REPO}brands/${brand}/catalog/assets/index.json`, 'utf8')) as { assets: Array<{ id: string; type: string; formats: Array<{ format: string; url: string }>; meta?: { lofi?: unknown } }> };
    const tunes = index.assets.filter((a) => a.formats.some((f) => f.format === LOFI_TUNE_FORMAT));
    assert.ok(tunes.length >= 6, `${brand} ships the preset tunes`);
    for (const a of tunes) {
      assert.equal(a.type, 'audio', `${a.id} is audio`);
      const f = a.formats.find((x) => x.format === LOFI_TUNE_FORMAT)!;
      const bytes = new Uint8Array(readFileSync(`${REPO}brands/${brand}${f.url}`));
      const recipe = lofiTuneFromBytes(bytes);
      assert.ok(recipe, `${a.id}: the file is a saved tune`);
      assert.deepEqual(lofiTuneFromMeta(a.meta?.lofi), recipe, `${a.id}: meta.lofi matches the file`);
      assert.deepEqual(bytes, lofiTuneBytes(recipe), `${a.id}: the same bytes the player writes on save`);
    }
  }
});

test('the player lists saved and preset tunes by genre and plays them on the station', async () => {
  invalidateNeurospicyTracks();
  const host: NeurospicyHost = {
    assets: {
      get: async () => { throw new Error('none'); },
      query: async () => [
        { id: 'lolly/tunes/warm-250249288', type: 'audio', format: 'lofi', url: 'blob:preset', source: 'library', meta: { name: 'Lofi · Warm · E major · 82 bpm', tags: ['neurospicy', 'generated', 'lofi'], lofi: { mood: 'warm', seed: 250249288 } } },
      ] as never,
      _listUserAssets: async () => [
        { id: 'user/tune/1-sings-7', type: 'audio', format: 'lofi', url: 'blob:saved', meta: { name: 'Lolly Sings · C major · 96 bpm', tags: ['neurospicy', 'generated', 'lolly-sings'], lofi: { mood: 'sings', seed: 7 } } },
      ],
    },
    profile: { get: async () => ({}), set: async () => ({}) },
  };
  const loops = await listLoops(host);
  const saved = loops.find((t) => t.id === 'user/tune/1-sings-7')!;
  const preset = loops.find((t) => t.id === 'lolly/tunes/warm-250249288')!;
  assert.equal(trackCategory(saved), 'lolly', 'a saved Lolly Sings tune sits with Lolly Sings');
  assert.equal(trackCategory(preset), 'lofi', 'a Warm preset sits with the Lofi stations');
  assert.deepEqual(savedTuneOf(saved.id), { mood: 'sings', seed: 7 });
  assert.ok(playsOnStation(preset.id), 'a preset plays live on the station');
  const lolly = loops.filter((t) => trackCategory(t) === 'lolly').map((t) => t.id);
  assert.deepEqual(lolly, ['lofi:sings', 'user/tune/1-sings-7'], 'the station leads its group, then the saved tunes');
  invalidateNeurospicyTracks();
});
