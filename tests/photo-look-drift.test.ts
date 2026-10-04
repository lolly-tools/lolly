// SPDX-License-Identifier: MPL-2.0
/**
 * The drift guard between engine/src/photo-look.ts and Filter's colour treatment
 * (community/filter/hooks.js, the duotone effect module) - plan 291 E25.
 *
 * A brand look's gradient map is Filter's OKLab gradient map, ported into the engine
 * so the web and CLI bridges can bake it into an upload's pixels. The tool cannot
 * import the engine, so two copies exist, and the engine's copy is deliberately
 * written differently: only add, subtract, multiply and divide in the colour core, so
 * V8 and JavaScriptCore give the same bytes, where Filter calls Math.cbrt and
 * Math.pow. This file lifts Filter's own functions out of hooks.js the way
 * tests/grade-drift.test.ts lifts Darkroom's (the effect module is the body of
 * `var FX_duotone = (function () {` up to its closing `})();`) and holds the two to
 * within 1/255 per channel over a colour cube and a random frame, for three-stop
 * gradient maps, two-stop duotones and the contrast and lightness grade.
 *
 * A failure here means one copy moved. Fix whichever one is wrong; do not relax the
 * comparison.
 *
 * Run with: node --test tests/photo-look-drift.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyPhotoLook, photoLookToneTable, photoLookStops } from '../engine/src/photo-look.ts';

type Lab = [number, number, number];
interface FilterParams { treatment: string; treatmentAmount: number; contrast: number; hue: number; sat: number; light: number; treat: { on: boolean } }
interface FilterFx {
  applyGradeAndTreat(ctx: unknown, W: number, H: number, p: FilterParams, lab: { sh: Lab; md: Lab | null; hi: Lab }): void;
  buildToneLut(mode: string, sh: Lab, md: Lab | null, hi: Lab): Float32Array;
  rgb01ToOklab(r: number, g: number, b: number): Lab;
  hexToRgb01(hex: string): [number, number, number];
}

/** Filter's duotone effect module, compiled the way the runtime compiles a hook. */
const filter = ((): FilterFx => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'community', 'filter', 'hooks.js'), 'utf8');
  const open = 'var FX_duotone = (function () {';
  const start = src.indexOf(open);
  assert.ok(start >= 0, 'community/filter/hooks.js no longer carries the duotone effect module');
  const end = src.indexOf('\n})();', start);
  const body = src.slice(start + open.length, end);
  // Function declarations hoist, so a return placed first still reaches them.
  return new Function('host', 'document', `return { applyGradeAndTreat, buildToneLut, rgb01ToOklab, hexToRgb01 };\n${body}`)({}, {}) as FilterFx;
})();

const labOf = (hex: string): Lab => { const c = filter.hexToRgb01(hex); return filter.rgb01ToOklab(c[0], c[1], c[2]); };

/** A 2D context stand-in over one RGBA buffer, all applyGradeAndTreat touches. */
const ctxOver = (data: Uint8ClampedArray) => ({ getImageData: () => ({ data }), putImageData: () => {} });

/** Every 17th level of each channel (a 16x16x16 cube) plus a seeded random frame. */
function corpus(): Uint8ClampedArray {
  const out: number[] = [];
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) out.push(r, g, b, 255);
  let s = 0x2f6b3a1d;
  const rand = (): number => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return s & 255; };
  for (let i = 0; i < 128 * 128; i++) out.push(rand(), rand(), rand(), 255);
  return new Uint8ClampedArray(out);
}

const CASES: Array<{ name: string; stops: string[]; amount: number; contrast: number; lightness: number }> = [
  { name: 'light brand grade', stops: ['#0c322c', '#83e1be', '#ffffff'], amount: 100, contrast: 10, lightness: 12 },
  { name: 'dark grade with a near-black shadow', stops: ['#050505', '#0c322c', '#90ebcd'], amount: 95, contrast: 20, lightness: 0 },
  { name: 'pine to mint, untouched grade', stops: ['#0c322c', '#01564a', '#90ebcd'], amount: 95, contrast: 11, lightness: 0 },
  { name: 'two-stop duotone, half strength, darkened', stops: ['#1c2230', '#f4f2ec'], amount: 50, contrast: -30, lightness: -25 },
  { name: 'saturated stops, strong grade', stops: ['#2453ff', '#fe7c3f', '#fff6c2'], amount: 80, contrast: 60, lightness: 35 },
];

test('the tone table matches buildToneLut', () => {
  for (const c of CASES) {
    const mine = photoLookToneTable(photoLookStops({ stops: c.stops }));
    const theirs = c.stops.length === 3
      ? filter.buildToneLut('gradient', labOf(c.stops[0]!), labOf(c.stops[1]!), labOf(c.stops[2]!))
      : filter.buildToneLut('duotone', labOf(c.stops[0]!), null, labOf(c.stops[1]!));
    let max = 0;
    for (let i = 0; i < 768; i++) max = Math.max(max, Math.abs(mine[i]! - theirs[i]!));
    assert.ok(max < 1e-6, `${c.name}: tone tables differ by ${max}`);
  }
});

test('a baked look matches Filter within 1/255 per channel', () => {
  const source = corpus();
  const pixels = source.length / 4;
  for (const c of CASES) {
    const theirs = source.slice();
    const three = c.stops.length === 3;
    filter.applyGradeAndTreat(ctxOver(theirs), pixels, 1, {
      treatment: three ? 'gradient' : 'duotone', treatmentAmount: c.amount / 100, contrast: c.contrast,
      hue: 0, sat: 1, light: c.lightness / 100, treat: { on: false },
    }, { sh: labOf(c.stops[0]!), md: three ? labOf(c.stops[1]!) : null, hi: labOf(c.stops[c.stops.length - 1]!) });
    const mine = source.slice();
    applyPhotoLook(mine, pixels, 1, { id: 'drift', kind: 'gradient-map', stops: c.stops, amount: c.amount, contrast: c.contrast, lightness: c.lightness });
    let max = 0, differing = 0;
    for (let i = 0; i < mine.length; i++) {
      const d = Math.abs(mine[i]! - theirs[i]!);
      if (d) differing++;
      if (d > max) max = d;
    }
    assert.ok(max <= 1, `${c.name}: ${differing} channels differ, by up to ${max}/255`);
  }
});
