// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioThumbPool, audioThumbInk, audioThumbInkStyle } from './audio-thumb-colour.ts';
import { audioThumbShape } from './audio-thumb.ts';
import { makeColorApi } from '@lolly/engine';

/** The real engine colour API, so the legibility and distinctness guards are tested
 *  against the maths that actually ships rather than a stub that always agrees. */
const host = { color: makeColorApi() };

const SUSE = [
  { hex: '#30ba78' }, { hex: '#0c322c' }, { hex: '#efefef' },
  { hex: '#fe7c3f' }, { hex: '#2453ff' }, { hex: '#90ebcd' },
];

test('the pool keeps brand order and drops non-hex entries', () => {
  const pool = audioThumbPool([{ hex: '#30ba78' }, { hex: '{color.alias}' }, { hex: null }, { hex: '#fe7c3f' }], host);
  assert.deepEqual(pool, ['#30ba78', '#fe7c3f']);
});

test('near-duplicates collapse - two tiles a JND apart are one tile to a viewer', () => {
  const pool = audioThumbPool([{ hex: '#30ba78' }, { hex: '#30ba79' }, { hex: '#fe7c3f' }], host);
  assert.deepEqual(pool, ['#30ba78', '#fe7c3f'], 'the near-identical green was dropped');
});

test('legibility is judged per THEME, so a brand keeps its darks and lights', () => {
  // The bug this pins: requiring legibility on BOTH surfaces rejects exactly the
  // colours a brand is known for. SUSE's dark green is Lc 100 on white and 0 on dark;
  // its off-white is the mirror image. Judged per theme, each survives where it works.
  const light = audioThumbPool(SUSE, host, 'light');
  const dark  = audioThumbPool(SUSE, host, 'dark');
  assert.ok(light.includes('#0c322c'), 'the dark green belongs in the light-theme pool');
  assert.ok(!dark.includes('#0c322c'), 'and must not be offered on a dark tile');
  assert.ok(dark.includes('#efefef'), 'the off-white belongs in the dark-theme pool');
  assert.ok(!light.includes('#efefef'), 'and must not be offered on a light tile');
  // Both pools are usable, which the both-surfaces rule made impossible.
  assert.ok(light.length >= 3 && dark.length >= 3, `pools too small: ${light.length}/${dark.length}`);
});

test('the pool is capped so neighbouring tiles stay tellable apart', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ hex: `#${((i * 0x0f1f3f) & 0xffffff).toString(16).padStart(6, '0')}` }));
  assert.ok(audioThumbPool(many, host).length <= 8);
});

// ─── the decorrelation this module exists for ────────────────────────────────

test('shape and colour do NOT correlate - a shape does not imply a colour', () => {
  const pool = audioThumbPool(SUSE, host, 'light');
  assert.ok(pool.length >= 3, `need a real pool to test against, got ${pool.length}`);

  const ids = Array.from({ length: 400 }, (_, i) => `lolly/loops/track-${i}`);
  const byShape = new Map<string, Set<number>>();
  for (const id of ids) {
    const shape = audioThumbShape(id);
    const ink = audioThumbInk(id, pool)!;
    (byShape.get(shape) ?? byShape.set(shape, new Set()).get(shape)!).add(ink.index);
  }
  // The failure this guards: one shared hash makes every `blob` the same colour, so
  // each shape would map to exactly ONE index and identity collapses to 5, not 5×N.
  for (const [shape, indices] of byShape) {
    assert.ok(indices.size > 1, `shape "${shape}" only ever gets colour ${[...indices]} - the hashes correlate`);
  }
});

test('the pairing is stable - the same id always yields the same ink', () => {
  const pool = audioThumbPool(SUSE, host, 'light');
  const a = audioThumbInk('lolly/loops/3-am-echoes', pool)!;
  const b = audioThumbInk('lolly/loops/3-am-echoes', pool)!;
  assert.deepEqual(a, b, 'a track must not change colour between renders');
});

test('real catalog ids yield many distinct IDENTITIES, which is the actual goal', () => {
  const pool = audioThumbPool(SUSE, host, 'light');
  // The real catalog ids, not synthetic ones - this is the grid a user actually sees.
  const ids = ['lolly/loops/3-am-echoes', 'lolly/loops/after-school-rain', 'lolly/modules/aleja-deszczu',
    'lolly/modules/jazznocn', 'lolly/modules/headspin', 'lolly/songs/drift', 'lolly/modules/take-a-walk',
    'lolly/modules/jazzical-interpolation', 'lolly/loops/fireplace-loop', 'lolly/modules/wild-perspective',
    'lolly/modules/blue-intermission', 'lolly/songs/amber-glow'];

  // Identity is the PAIR, so that is what to measure. Asserting instead that all N
  // colours appear across 12 ids tests the hash's luck, not the design: 3 of 4 across
  // 12 items is unremarkable and says nothing about whether tiles are distinguishable.
  const pairs = new Set(ids.map(id => `${audioThumbShape(id)}/${audioThumbInk(id, pool)!.index}`));
  assert.ok(pairs.size >= 8, `only ${pairs.size} distinct looks across ${ids.length} real tiles`);

  // And more than one colour is genuinely in play - the guard against a pool that
  // silently collapsed to one entry.
  assert.ok(new Set(ids.map(id => audioThumbInk(id, pool)!.index)).size >= 2);
});

// ─── never invent a hue ──────────────────────────────────────────────────────

test('a monochrome brand gets its own greys, never a fabricated hue', () => {
  const mono = [{ hex: '#111111' }, { hex: '#8a8a8a' }, { hex: '#f2f2f2' }];
  const pool = audioThumbPool(mono, host, 'light');
  for (const hex of pool) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r!, g!, b!) - Math.min(r!, g!, b!) <= 4, `${hex} is not neutral - a hue was invented`);
  }
});

test('an empty or colourless palette yields no ink rather than a made-up one', () => {
  assert.equal(audioThumbInk('x', audioThumbPool([], host)), null);
  assert.equal(audioThumbInk('x', audioThumbPool([{ hex: 'not-a-colour' }], host)), null);
  assert.equal(audioThumbInkStyle(null), '', 'no ink means no custom property, so the tile inherits currentColor');
});

test('a single-colour brand is valid - every tile shares it, variety comes from shape', () => {
  const pool = audioThumbPool([{ hex: '#30ba78' }], host);
  assert.deepEqual(pool, ['#30ba78']);
  assert.equal(audioThumbInk('a', pool)!.hex, '#30ba78');
  assert.equal(audioThumbInk('b', pool)!.hex, '#30ba78');
});

test('without host.color the pool still works - a shell degrades, it does not go blank', () => {
  const pool = audioThumbPool(SUSE, undefined);
  assert.ok(pool.length >= 3, 'the legibility guard cannot run, so candidates pass through');
  assert.ok(audioThumbInk('x', pool));
});

test('the style is a custom property, so the SVG keeps painting currentColor', () => {
  const pool = audioThumbPool(SUSE, host, 'light');
  assert.match(audioThumbInkStyle(audioThumbInk('x', pool)), /^--audio-thumb-ink:#[0-9a-f]{6}$/);
});

test('the index is always in range - the signed-xor trap', () => {
  // `^` yields a SIGNED 32-bit int, so an un-normalised finaliser makes `h % n`
  // negative and `pool[-2]` undefined - a tile that paints nothing. Measured over a
  // 4-colour pool this produced indices from -3 to 3.
  const pool = audioThumbPool(SUSE, host, 'light');
  for (let i = 0; i < 500; i++) {
    const ink = audioThumbInk(`lolly/x/${i}`, pool)!;
    assert.ok(ink.index >= 0 && ink.index < pool.length, `index ${ink.index} out of range`);
    assert.match(ink.hex, /^#[0-9a-f]{6}$/);
  }
});

test('the hash avalanches, so a power-of-two pool is not keyed to FNV\'s worst bits', () => {
  // The real defect this caught: FNV-1a mixes its LOW bits poorly, and `% 4` reads
  // exactly those, so shape (% 5) and colour (% 4) correlated through the same weak
  // bits - five of six `ring` tiles drew one colour. A 4-entry pool is the worst case.
  const pool = ['#111111', '#222222', '#333333', '#444444'];
  const counts = new Array(4).fill(0);
  for (let i = 0; i < 2000; i++) counts[audioThumbInk(`lolly/loops/track-${i}`, pool)!.index]++;
  // Even-ish: no bucket may take more than 40% of a uniform 25% share.
  for (const c of counts) assert.ok(c > 2000 * 0.15 && c < 2000 * 0.4, `skewed distribution: ${counts}`);
});
