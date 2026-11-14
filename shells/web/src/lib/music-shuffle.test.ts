// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's shuffle (lib/music-shuffle.ts): every value it draws is one the
 * generator's link accepts, the mix and the tone stay inside the gentle ranges, the same
 * random source gives the same track, and Reset's defaults survive the link.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/music-shuffle.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRetiredLead, LOFI_KEYS, LOFI_LEADS, LOFI_BASSES } from '../../../../engine/src/lofi-compose.ts';
import { shuffleMusic, SHUFFLE_RANGES } from './music-shuffle.ts';
import { LOFI_STATION_MOODS } from './neurospicy-lofi.ts';
import { parseMusicState, musicStateParams } from '../views/music-studio.ts';

/** A small seeded random source (mulberry32), so a shuffle can be replayed. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHUFFLES = Array.from({ length: 60 }, (_, i) => shuffleMusic(seeded(1000 + i), { bars: 64 }));
const inside = (v: number, [lo, hi]: readonly [number, number]): boolean => v >= lo - 1e-9 && v <= hi + 1e-9;

test('a shuffle draws only values the generator accepts, and its link reads back the same', () => {
  for (const s of SHUFFLES) {
    assert.ok(LOFI_STATION_MOODS.includes(s.mood), s.mood);
    assert.ok(Number.isInteger(s.seed) && s.seed >= 0 && s.seed < 1_000_000, String(s.seed));
    assert.ok(s.keys === undefined || LOFI_KEYS.includes(s.keys));
    assert.ok(s.lead === undefined || (LOFI_LEADS.includes(s.lead) && s.lead !== 'none'));
    assert.ok(s.bass === undefined || LOFI_BASSES.includes(s.bass));
    assert.equal(s.drums, true);
    for (const [section, voices] of Object.entries(s.sections)) {
      assert.notEqual(section, 'rest');
      assert.equal(Object.keys(voices ?? {}).length, 1, 'one part changes in a section');
    }
    // What the view sets: the shuffle over a fresh state, at the tune's own tempo.
    const state = { ...parseMusicState(''), ...s, bars: 64, bpm: undefined };
    assert.deepEqual(parseMusicState(musicStateParams(state)), state);
  }
});

test('a shuffle never draws a retired lead, for the track or a kind of section', () => {
  for (const s of SHUFFLES) {
    assert.ok(!s.lead || !isRetiredLead(s.lead), `${s.mood} ${s.seed}: ${s.lead}`);
    for (const [section, v] of Object.entries(s.sections)) assert.ok(!v?.lead || !isRetiredLead(v.lead), `${s.mood} ${s.seed} ${section}: ${v?.lead}`);
  }
});

test('the mix, texture, brightness and drive stay inside the gentle ranges', () => {
  const R = SHUFFLE_RANGES;
  for (const s of SHUFFLES) {
    for (const part of ['lead', 'keys', 'bass', 'drums'] as const) assert.ok(inside(s.mix[part], R.part), `${part} ${s.mix[part]}`);
    assert.ok(inside(s.mix.fx, R.fx), `fx ${s.mix.fx}`);
    assert.ok(inside(s.mix.reverb, R.reverb), `reverb ${s.mix.reverb}`);
    assert.equal(s.mix.texture, 1);
    assert.ok(inside(s.texture, R.texture), `texture ${s.texture}`);
    if (s.bright !== undefined) assert.ok(inside(s.bright, R.bright), `bright ${s.bright}`);
    if (s.drive !== undefined) assert.ok(inside(s.drive, R.drive), `drive ${s.drive}`);
    // On the sliders' grid, so a slider shows the value exactly.
    for (const v of [s.mix.lead, s.mix.keys, s.mix.bass, s.mix.drums, s.mix.fx, s.mix.reverb, s.texture, s.bright ?? 1]) assert.equal(Math.round(v * 20) / 20, v);
    if (s.drive !== undefined) assert.equal(Math.round(s.drive * 10) / 10, s.drive);
  }
});

test('the same random source gives the same shuffle, and another source a different one', () => {
  assert.deepEqual(shuffleMusic(seeded(42)), shuffleMusic(seeded(42)));
  assert.notDeepEqual(shuffleMusic(seeded(42)), shuffleMusic(seeded(43)));
});

test('shuffles vary: many styles, parts sometimes left automatic and sometimes picked, a few section changes', () => {
  assert.ok(new Set(SHUFFLES.map(s => s.mood)).size >= 15, 'many styles');
  const picked = SHUFFLES.flatMap(s => [s.keys, s.lead, s.bass]);
  assert.ok(picked.some(v => v === undefined), 'some parts left to the composer');
  assert.ok(picked.some(v => v !== undefined), 'some parts picked');
  const withSections = SHUFFLES.filter(s => Object.keys(s.sections).length > 0).length;
  assert.ok(withSections > 0 && withSections < SHUFFLES.length / 2, `a few section changes (${withSections})`);
  assert.ok(SHUFFLES.some(s => s.bright === undefined) && SHUFFLES.some(s => s.bright !== undefined), 'tone sometimes the style’s own');
});

test('a shuffle never repeats the style it is asked to move on from', () => {
  for (let i = 0; i < 20; i++) assert.notEqual(shuffleMusic(seeded(7 + i), { after: 'sugar' }).mood, 'sugar');
});

test('Reset: the defaults make a short link that reads back as the defaults', () => {
  const defaults = parseMusicState('');
  assert.equal(musicStateParams(defaults), 'style=sugar&seed=2024&bars=64');
  assert.deepEqual(parseMusicState(musicStateParams(defaults)), defaults);
  // A shuffled state reset is the generator as it opens, whatever was drawn before.
  const shuffled = { ...defaults, ...SHUFFLES[0]!, bars: 32 };
  assert.notDeepEqual(shuffled, defaults);
  assert.deepEqual(Object.assign(shuffled, parseMusicState('')), defaults);
});

test('Shift-shuffle keeps the style and the seed, and draws only the sound', () => {
  for (let i = 0; i < 20; i++) {
    const s = shuffleMusic(seeded(5000 + i), { bars: 32, keep: { mood: 'kora', seed: 123456 } });
    assert.equal(s.mood, 'kora');
    assert.equal(s.seed, 123456);
    assert.equal(s.drums, true);
    for (const v of [s.mix.lead, s.mix.keys, s.mix.bass, s.mix.drums]) assert.ok(inside(v, SHUFFLE_RANGES.part), String(v));
  }
  // The sound still changes from one Shift-shuffle to the next.
  const sounds = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(shuffleMusic(seeded(7000 + i), { keep: { mood: 'kora', seed: 1 } }).mix)));
  assert.ok(sounds.size > 1);
});
