// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/heal.ts against Compositor's own C (plans/289 D4). The goldens in
 * tests/fixtures/heal/goldens.json are what `spot_heal` returned for each case of
 * tests/helpers/heal-inputs.ts (scripts/build-heal-goldens.ts builds them with a C
 * compiler; this test needs none).
 *
 * Run with: node --test tests/heal.test.ts
 *
 * The C keeps its membrane in float32 and the port rounds at the same steps, so
 * the patch search and the solve agree exactly. The grain uses log and cos, which
 * C's maths library and JavaScript's may round one unit apart, so a byte may
 * differ by one where grain is drawn and nowhere else.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unzlibSync } from 'fflate';
import { healFrame, spotHealPremultiplied, type HealMode } from '../engine/src/heal.ts';
import { healCases } from './helpers/heal-inputs.ts';

const MODES: HealMode[] = ['content-aware', 'texture', 'proximity'];
const goldens = (JSON.parse(readFileSync(new URL('./fixtures/heal/goldens.json', import.meta.url), 'utf8')) as {
  cases: Array<{ name: string; rgba: string }>;
}).cases;

for (const c of healCases()) {
  test(`${c.name}: the port matches Compositor's C`, () => {
    const golden = goldens.find(g => g.name === c.name);
    assert.ok(golden, `a golden for ${c.name}; run node scripts/build-heal-goldens.ts`);
    const want = unzlibSync(Uint8Array.from(Buffer.from(golden.rgba, 'base64')));
    const got = new Uint8Array(c.rgba);
    spotHealPremultiplied(got, c.coverage, c.width, c.height, { mode: MODES[c.mode]!, seed: c.seed, opacity: c.opacity });
    let differ = 0, worst = 0;
    for (let i = 0; i < want.length; i++) {
      const d = Math.abs(want[i]! - got[i]!);
      if (d) { differ++; worst = Math.max(worst, d); }
    }
    assert.ok(worst <= 1, `${c.name}: ${differ} bytes differ, by up to ${worst}`);
    if (c.mode !== 1) assert.equal(differ, 0, `${c.name}: no grain is drawn, so every byte matches`);
    // And it healed something: the spot changed.
    assert.ok(got.some((v, i) => v !== c.rgba[i]), `${c.name}: the spot changed`);
  });
}

const frame = (w: number, h: number, paint: (x: number, y: number) => [number, number, number, number]) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(paint(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
};

test('healFrame: unpainted pixels come back byte for byte, half-transparent ones included', () => {
  // A gradient with a red blemish where the mask is painted. (On the bare gradient the
  // patch and the membrane rebuild the gradient exactly, so nothing would change.)
  const f = frame(64, 64, (x, y) => (x >= 20 && x < 30 && y >= 28 && y < 36 ? [255, 0, 0, 255] : [(x * 4) & 255, (y * 4) & 255, 128, x < 32 ? 255 : 77]));
  const mask = new Uint8Array(64 * 64);
  for (let y = 28; y < 36; y++) for (let x = 20; x < 30; x++) mask[y * 64 + x] = 255;
  for (const mode of MODES) {
    const out = healFrame(f, mask, { mode, seed: 3 });
    for (let i = 0; i < 64 * 64; i++) {
      if (mask[i]) continue;
      for (let c = 0; c < 4; c++) assert.equal(out.data[i * 4 + c], f.data[i * 4 + c], `${mode}: pixel ${i} channel ${c}`);
    }
    const centre = (32 * 64 + 25) * 4;
    assert.ok(out.data[centre]! < 200 && out.data[centre + 1]! > 60, `${mode}: the red blemish is gone (${[...out.data.subarray(centre, centre + 4)]})`);
  }
  assert.equal(f.data[(32 * 64 + 25) * 4], 255, 'the input frame is not changed');
});

test('healFrame: two painted areas far apart are two spots, not one box between them', () => {
  // A flat grey picture with two dark dots: healing each dot alone gives grey; one
  // box spanning both would take its ring from the dark dots' surroundings anyway,
  // but would also rewrite the grey between them, which must stay as it was.
  const f = frame(96, 48, (x, y) => ((x - 10) ** 2 + (y - 24) ** 2 <= 9 || (x - 85) ** 2 + (y - 24) ** 2 <= 9 ? [20, 20, 20, 255] : [150, 150, 150, 255]));
  const mask = new Uint8Array(96 * 48);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 96; x++) if ((x - 10) ** 2 + (y - 24) ** 2 <= 16 || (x - 85) ** 2 + (y - 24) ** 2 <= 16) mask[y * 96 + x] = 255;
  const out = healFrame(f, mask, { mode: 'texture', seed: 1 });
  for (const [cx, cy] of [[10, 24], [85, 24]] as const) {
    const i = (cy * 96 + cx) * 4;
    assert.ok(Math.abs(out.data[i]! - 150) <= 6, `the dot at ${cx} healed to the grey around it (${out.data[i]})`);
  }
});

test('the same picture, mask and seed give the same bytes, and a different seed different grain', () => {
  const c = healCases().find(k => k.name === 'grain-m1')!;
  const run = (seed: number) => { const px = new Uint8Array(c.rgba); spotHealPremultiplied(px, c.coverage, c.width, c.height, { mode: 'texture', seed }); return px; };
  assert.deepEqual(run(5), run(5));
  assert.notDeepEqual(run(5), run(6));
});

test('a 512 x 512 photo with a 120 px spot heals within a time budget', () => {
  const f = frame(512, 512, (x, y) => [(x ^ y) & 255, (x * 3) & 255, (y * 5) & 255, 255]);
  const mask = new Uint8Array(512 * 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) if ((x - 256) ** 2 + (y - 256) ** 2 <= 60 * 60) mask[y * 512 + x] = 255;
  const t0 = performance.now();
  healFrame(f, mask, { mode: 'content-aware' });
  const ms = performance.now() - t0;
  assert.ok(ms < 4000, `took ${Math.round(ms)} ms`);
});
