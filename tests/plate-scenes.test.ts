// SPDX-License-Identifier: MPL-2.0
/**
 * The parts of the plate oracle that need no external program: the scene files stay well formed, and the plate TIFF
 * reader, region statistics and expectation maths behave. The Ghostscript run itself is scripts/plate-oracle.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { boundsFor, loadScenes, maxTotalInk, plateSetFailures, platesWritten, readPlateTiff, regionStats, sceneProblems, structureFailures, type Scene, type Separate } from './helpers/plate-scene.ts';

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
  assert.ok(scenes.length >= 8 && scenes.length <= 14, `${scenes.length} scenes`);
  const text = JSON.stringify(scenes);
  for (const needle of ['spot', 'GSfo', 'fogra39', 'tol', 'knockout', 'reverse', '--spots=process', 'finish']) assert.ok(text.toLowerCase().includes(needle.toLowerCase()), `no scene mentions ${needle}`);
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

test('spots as process has an on scene, an off scene and a finish scene, each pinning the plate set', () => {
  const byId = new Map(loadScenes(dir).map(s => [s.id, s]));
  const off = byId.get('06-spot-plates')!, on = byId.get('13-spots-as-process')!, finish = byId.get('14-finish-keeps-plate')!;
  assert.equal(off.args, undefined, 'the off scene renders with the default');
  assert.ok((off.structure?.separations ?? []).length >= 2, 'the off scene keeps its spot plates');
  assert.ok(on.args?.includes('--spots=process'));
  assert.deepEqual(on.boxes, off.boxes, 'on and off draw the same page');
  assert.deepEqual([...on.passes[0]!.plates!].sort(), ['C', 'K', 'M', 'Y']);
  assert.equal(on.structure?.noSeparations, true);
  assert.ok(finish.args?.includes('--spots=process'));
  assert.ok(finish.passes[0]!.plates!.includes('Fixture Foil'), 'the finish keeps its plate');
  assert.ok(!finish.passes[0]!.plates!.includes('Fixture Tide'), 'the ink does not');
});

test('scene args are flags, and cannot take over the runner\'s own', () => {
  const base: Scene = JSON.parse(JSON.stringify(loadScenes(dir)[0]!));
  base.args = ['--export=pdf', 'spots=process', '--output=/tmp/x.pdf'];
  const problems = sceneProblems(base, `${base.id}.json`).join('\n');
  assert.match(problems, /args must be a list of --flag/);
  assert.match(problems, /runner's own flags: export, output/);
});

test('the plate set reads tiffsep file names and fails both ways', () => {
  const files = ['p1.tif', 'p1(Cyan).tif', 'p1(Magenta).tif', 'p1(Yellow).tif', 'p1(Black).tif', 'p1(H160_L050_C045).tif', 'notes.txt'];
  const written = platesWritten(files, 'p1');
  assert.deepEqual(written, ['C', 'H160_L050_C045', 'K', 'M', 'Y']);
  const ink = (p: string): number => (p === 'Y' ? 0 : 40);
  assert.deepEqual(plateSetFailures(written, { plates: ['C', 'M', 'Y', 'K', 'H160_L050_C045'] }, ink), []);
  const extra = plateSetFailures(written, { plates: ['C', 'M', 'Y', 'K'] }, ink).join('\n');
  assert.match(extra, /unexpected H160_L050_C045/);
  const missing = plateSetFailures(['C', 'K', 'M', 'Y'], { plates: ['C', 'M', 'Y', 'K', 'Spot'] }, ink).join('\n');
  assert.match(missing, /missing Spot/);
  const blank = plateSetFailures(written, { inked: ['C', 'Y', 'Gone'] }, ink).join('\n');
  assert.match(blank, /plate Y carries no ink anywhere/);
  assert.match(blank, /plate Gone carries no ink: the separation did not write it/);
  assert.doesNotMatch(blank, /plate C/);
});

test('noSeparations fails while the PDF still names a spot colour space', () => {
  const facts = { pageSizePt: [300, 150] as [number, number], deviceRgbOps: 0, separations: ['H160_L050_C045'], overprint: {} };
  assert.match(structureFailures(facts, { noSeparations: true }).join('\n'), /still names spot colour spaces: H160_L050_C045/);
  assert.deepEqual(structureFailures({ ...facts, separations: [] }, { noSeparations: true }), []);
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
