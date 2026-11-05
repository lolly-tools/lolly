// SPDX-License-Identifier: MPL-2.0
/**
 * The parts of the plate oracle that need no external program: the scene files stay well formed, and the plate TIFF
 * reader, region statistics and expectation maths behave. The Ghostscript run itself is scripts/plate-oracle.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { boundsFor, loadScenes, maxTotalInk, readPlateTiff, regionStats, sceneProblems, type Scene, type Separate } from './helpers/plate-scene.ts';

const dir = fileURLToPath(new URL('./fixtures/plate-scenes', import.meta.url));

/** A little-endian single-strip 8-bit grey TIFF, the shape `gs -sDEVICE=tiffsep -sCompression=none` writes. */
function tiff(width: number, height: number, pixels: number[]): Uint8Array {
  const entries: Array<[number, number, number, number]> = [[256, 3, 1, width], [257, 3, 1, height], [258, 3, 1, 8], [259, 3, 1, 1], [262, 3, 1, 1], [273, 4, 1, 0], [277, 3, 1, 1], [278, 3, 1, height], [279, 4, 1, pixels.length]];
  const ifdSize = 2 + entries.length * 12 + 4, dataAt = 8 + ifdSize;
  const out = new Uint8Array(dataAt + pixels.length), v = new DataView(out.buffer);
  out.set([0x49, 0x49], 0); v.setUint16(2, 42, true); v.setUint32(4, 8, true); v.setUint16(8, entries.length, true);
  entries.forEach(([tag, type, count, value], i) => {
    const at = 10 + i * 12;
    v.setUint16(at, tag, true); v.setUint16(at + 2, type, true); v.setUint32(at + 4, count, true);
    if (type === 3) v.setUint16(at + 8, tag === 273 ? 0 : value, true); else v.setUint32(at + 8, tag === 273 ? dataAt : value, true);
  });
  out.set(pixels, dataAt);
  return out;
}

test('every plate scene file is valid, and the set covers the planned cases', () => {
  const scenes = loadScenes(dir);
  assert.ok(scenes.length >= 8 && scenes.length <= 12, `${scenes.length} scenes`);
  const text = JSON.stringify(scenes);
  for (const needle of ['spot', 'GSfo', 'fogra39', 'tol', 'knockout', 'reverse']) assert.ok(text.toLowerCase().includes(needle.toLowerCase()), `no scene mentions ${needle}`);
  assert.equal(new Set(scenes.map(s => s.id)).size, scenes.length);
});

test('a scene with a bad region, a missing reason or a repeated pass is reported', () => {
  const base = loadScenes(dir)[0]!;
  const broken: Scene = JSON.parse(JSON.stringify(base));
  broken.passes[0]!.regions[0]!.rect = [390, 0, 50, 10];
  broken.knownFailing = { reason: 'short' };
  broken.passes.push(broken.passes[0]!);
  const problems = sceneProblems(broken, `${base.id}.json`).join('\n');
  assert.match(problems, /rect leaves the page/);
  assert.match(problems, /knownFailing needs a reason/);
  assert.match(problems, /repeated/);
});

test('the plate reader returns ink where 255 is paper and 0 is full ink', () => {
  const img = readPlateTiff(tiff(2, 2, [255, 0, 128, 255]));
  assert.deepEqual([img.width, img.height], [2, 2]);
  const stats = regionStats(img, [0, 0, 2, 2], { width: 2, height: 2 });
  assert.equal(stats.max, 100); assert.equal(stats.min, 0);
  assert.ok(Math.abs(stats.mean - (0 + 100 + 49.8 + 0) / 4) < 0.1);
  assert.deepEqual(regionStats(null, [0, 0, 2, 2], { width: 2, height: 2 }), { mean: 0, min: 0, max: 0 });
  assert.equal(maxTotalInk({ K: img, C: img }, [0, 0, 2, 2], { width: 2, height: 2 }), 200);
});

test('compressed or deeper TIFFs are refused rather than misread', () => {
  const bytes = tiff(1, 1, [0]);
  new DataView(bytes.buffer).setUint16(10 + 3 * 12 + 8, 5, true);
  assert.throws(() => readPlateTiff(bytes), /compressed/);
});

test('expectations resolve from stated values, a colour and a blend', () => {
  const sep: Separate = (r, g, b) => [r, g, b, 0];
  const region = { name: 'x', rect: [0, 0, 1, 1] as [number, number, number, number], expectFrom: { lerp: ['#000000', '#ff0000', 0.5] as [string, string, number] }, expect: { K: 10, M: { stat: 'max' as const, from: '#00ff00' }, Y: { min: 5 } } };
  const b = Object.fromEntries(boundsFor(region, 1, sep).map(x => [x.plate, x]));
  assert.ok(Math.abs(b.C!.lo + 1 - 50) < 0.01 && Math.abs(b.C!.hi - 1 - 50) < 0.01);
  assert.equal(b.K!.lo, 9);
  assert.equal(b.M!.stat, 'max'); assert.equal(Math.round(b.M!.lo + 1), 100);
  assert.equal(b.Y!.lo, 4.5);
});
