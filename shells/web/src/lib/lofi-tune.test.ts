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
import { LOFI_TUNE_FORMAT, lofiTuneBytes, lofiTuneFromBytes, lofiTuneFromMeta, lofiTuneName, renderKey, shareRender } from './lofi-tune.ts';
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
  assert.equal(lofiTuneName({ mood: 'lateNight', seed: 1 }, { key: 'A minor', bpm: 70.4 }), 'Lofi · Late night · A minor · 70 bpm');
  assert.equal(lofiTuneName({ mood: 'sugar', seed: 1 }, { key: 'F major', bpm: 124 }), 'Lolly Sings · Sugar · F major · 124 bpm');
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
  assert.equal(trackCategory(preset), 'lolly', 'a Warm preset is Lolly Sings too');
  assert.deepEqual(savedTuneOf(saved.id), { mood: 'sings', seed: 7 });
  assert.ok(playsOnStation(preset.id), 'a preset plays live on the station');
  const lolly = loops.filter((t) => trackCategory(t) === 'lolly').map((t) => t.id);
  assert.deepEqual(lolly, ['lofi:sings', 'lofi:sugar', 'lofi:sherbert', 'lofi:kpop', 'lofi:straya', 'lofi:persian', 'lofi:guzheng', 'lofi:koto', 'lofi:kora', 'lofi:afrobeat', 'lofi:amapiano', 'lofi:chiptune', 'lofi:citypop', 'lofi:funk', 'lofi:soul', 'lofi:rnb', 'lofi:nudisco', 'lofi:lofiHouse', 'lofi:hiphop', 'lofi:triphop', 'lofi:reggae', 'lofi:ska', 'lofi:spanish', 'lofi:rock', 'lofi:punk', 'lofi:grunge', 'lofi:stoner', 'lofi:metal', 'lofi:country', 'lofi:blues', 'lofi:jazz', 'lofi:swing', 'lofi:fantasy', 'lofi:dream', 'lofi:shoegaze', 'lofi:synthwave', 'lofi:acid', 'lofi:electro', 'lofi:dubstep', 'lofi:brostep', 'lofi:dnb', 'lofi:salsa', 'lofi:surf', 'lofi:yacht', 'lofi:botanica', 'lofi:oompa', 'lofi:breakbeat', 'lofi:funkyHouse', 'lofi:ukGarage', 'lofi:privateSchool', 'lofi:warm', 'lofi:lateNight', 'lofi:rainy', 'lolly/tunes/warm-250249288', 'user/tune/1-sings-7'],
    'the stations lead their group, then the saved tunes');
  invalidateNeurospicyTracks();
});

test('a music generator track saves as a tune that keeps everything it was made with', async () => {
  const generator = 'style=sherbert&seed=4&bars=16&bpm=128&transpose=2&lead=bit&drop.keys=supersaw&mix.fx=1.4';
  const recipe = { mood: 'sherbert' as const, seed: 4, generator };
  const back = lofiTuneFromBytes(lofiTuneBytes(recipe));
  assert.deepEqual(back, recipe, 'the bytes carry the generator\'s settings');
  assert.equal(JSON.parse(new TextDecoder().decode(lofiTuneBytes(recipe))).version, 2);
  assert.deepEqual(lofiTuneFromMeta({ mood: 'sherbert', seed: 4, generator }), recipe, 'and so does the asset\'s meta');
  assert.deepEqual(lofiTuneFromMeta({ mood: 'sherbert', seed: 4, generator: 'x'.repeat(5000) }), { mood: 'sherbert', seed: 4 }, 'an oversized setting string is ignored');
  assert.equal(JSON.parse(new TextDecoder().decode(lofiTuneBytes({ mood: 'warm', seed: 9 }))).version, 1, 'a station tune stays version 1');
  const house = { mood: 'lofiHouse' as const, seed: 7, generator: 'style=lofiHouse&seed=7&bars=32&drop.bass=deep' };
  assert.deepEqual(lofiTuneFromBytes(lofiTuneBytes(house)), house, 'a lofi house track saves with its settings');
  assert.deepEqual(lofiTuneFromMeta(house), house);
  assert.deepEqual(lofiTuneFromBytes(lofiTuneBytes({ mood: 'lofiHouse', seed: 7 })), { mood: 'lofiHouse', seed: 7 }, 'and a lofi house station tune');
  // The settings the player and the renderer read back are the generator's own.
  const { parseMusicState, trackSettings, trackSeconds } = await import('./music-state.ts');
  const state = parseMusicState(generator);
  assert.equal(state.bpm, 128);
  assert.equal(state.transpose, 2);
  const settings = trackSettings(state);
  assert.equal(settings.bars, 16);
  assert.equal(settings.style?.lead, 'bit');
  // About sixteen bars at 128 bpm: the track is fitted to end with its outro (lofiTrack).
  const { composeTrack } = await import('./music-state.ts');
  const fitted = composeTrack(state).length;
  assert.ok(Math.abs(fitted - 16) <= 8, `${fitted} bars, about sixteen`);
  assert.ok(Math.abs(trackSeconds(state) - (fitted * 240) / 128) < 1e-9, 'its bars at 128 bpm');
});

test('opening a tune renders once: the player and the waveform share one render', async () => {
  const recipe = { mood: 'sugar' as const, seed: 2024, generator: 'style=sugar&seed=2024' };
  assert.equal(renderKey(recipe, {}), renderKey({ ...recipe }, { seconds: undefined }), 'the same tune and options are the same render');
  assert.notEqual(renderKey(recipe, {}), renderKey(recipe, { seconds: 40 }), 'a longer bed is another render');
  assert.notEqual(renderKey(recipe, {}), renderKey({ ...recipe, generator: 'style=sugar&seed=2024&bpm=90' }, {}));
  let runs = 0;
  let finish: (v: string) => void = () => {};
  const pending = new Map<string, Promise<string>>();
  const make = (): Promise<string> => { runs++; return new Promise<string>((r) => { finish = r; }); };
  const a = shareRender('k', make, pending);
  const b = shareRender('k', make, pending);
  assert.equal(runs, 1, 'the second caller joins the first render');
  finish('pcm');
  assert.equal(await a, 'pcm');
  assert.equal(await b, 'pcm');
  assert.equal(pending.size, 0, 'nothing is kept once the render is done');
  shareRender('k', make, pending);
  assert.equal(runs, 2, 'a later request renders again');
});
