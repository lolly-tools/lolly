// SPDX-License-Identifier: MPL-2.0
/** Imported layout and photo looks through Lolly's actual motion render paths. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { readCameraRawPreset } from '../engine/src/camera-raw-preset.ts';
import { readIdmlSpreads } from '../engine/src/idml-read.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseCubeLut, sampleLut } from '../engine/src/grade.ts';
import { parseKf, evaluateKf } from '../engine/src/keyframes.ts';
import { serializeUrlState, parseUrlState } from '../engine/src/url-mode.ts';
import { applyChoreograph } from '../shells/web/src/views/choreograph.ts';
import { LAUNCH_RECIPES } from '../shells/web/src/views/launch-choreograph.ts';
import type { TimeCfg } from '../shells/web/src/views/timeline-math.ts';
import type { Box } from '../shells/web/src/views/free-canvas-math.ts';
import { groupedIdmlParts } from './fixtures/adobe/grouped-layout.ts';
import { baseHost } from './helpers/host.ts';

const dom = new JSDOM('', { url: 'http://localhost/' });
const parse = (s: string) => new dom.window.DOMParser().parseFromString(s, 'application/xml');
const root = new URL('../community/', import.meta.url);
const tool = (id: string) => loadTool(id, path => readFile(new URL(path, root), 'utf8'));

test('imported IDML groups retain their layout through reusable recipes and shared URLs', async () => {
  const design = await tool('design');
  const cfg = design.manifest.inputs.find(i => i.id === 'boxes')!.canvas as unknown as TimeCfg;
  const [layout] = await readIdmlSpreads(groupedIdmlParts(), parse);
  const rows = layout!.boxes as Box[], ids = rows.map(b => String(b.id));
  assert.equal(rows[0]!.group, rows[1]!.group); assert.ok(rows[0]!.group);
  for (const recipe of LAUNCH_RECIPES) {
    const result = applyChoreograph(rows, ids, { showcase: recipe, camera: false, durationMs: 6000 }, {
      cfg, stage: { w: layout!.width, h: layout!.height },
      rect: b => ({ x: Number(b.x), y: Number(b.y), w: Number(b.w), h: Number(b.h) }), mint: () => 'camera',
    })!;
    assert.ok(result); assert.equal(result.cameraId, '');
    for (const [index, before] of rows.entries()) {
      const after = result.rows[index]!;
      for (const field of ['x', 'y', 'w', 'h', 'rot', 'bg', 'fg', 'font', 'weight', 'text', 'opacity', 'group']) assert.deepEqual(after[field], before[field], `${recipe}: ${field}`);
      assert.equal(after.start, 0); assert.equal(after.dur, 6);
    }
    const tracks = result.rows.map(b => parseKf(String(b.kf)));
    for (let ms = 0; ms <= 6000; ms += 25) {
      const a = evaluateKf(tracks[0]!, ms), b = evaluateKf(tracks[1]!, ms);
      assert.deepEqual(a, b, `${recipe}: grouped card remains together at ${ms}`);
      assert.equal(a.s, 1); assert.equal(a.r, 0);
      if (recipe === 'drift-loop') assert.equal(a.o, 1, 'continuous loop remains readable');
    }
    if (recipe.endsWith('loop')) for (const track of tracks) assert.deepEqual(evaluateKf(track, 0), evaluateKf(track, 6000));
    if (recipe === 'drift-loop') {
      const startVelocity = evaluateKf(tracks[0]!, 10).y! / 10;
      const endVelocity = -evaluateKf(tracks[0]!, 5990).y! / 10;
      assert.ok(Math.abs(startVelocity - endVelocity) < .0001, 'loop velocity closes');
    }
    const runtime = await createRuntime(design, baseHost(), { boxes: result.rows });
    try {
      assert.match(runtime.getHydrated(), /data-t-kf=/);
      const decoded = parseUrlState(serializeUrlState(runtime.getModel()), design.manifest).values.boxes as Box[];
      for (const box of result.rows) assert.equal(decoded.find(b => b.id === box.id)!.kf, box.kf);
    } finally { runtime.destroy(); }
  }
  assert.equal(rows[0]!.kf, undefined, 'source remains untouched');
});

test('XMP look reaches the same still LUT and every loop frame without changing timing or alpha', async () => {
  const darkroom = await tool('darkroom');
  const preset = readCameraRawPreset(await readFile(new URL('./fixtures/adobe/preset.xmp', import.meta.url), 'utf8'), parse);
  const delivered: Blob[] = [];
  const runtime = await createRuntime(darkroom, baseHost({ export: { file: async (blob: Blob) => { delivered.push(blob); } } }), preset.values);
  try {
    const look = JSON.parse(runtime.getHydratedText('{{videoLook}}')) as { v: number; on: number; cube: string };
    assert.equal(look.v, 1); assert.equal(look.on, 1);
    await runtime.setInput('bakeLut', true);
    const still = parseCubeLut(await delivered[0]!.text()), video = parseCubeLut(look.cube);
    assert.deepEqual(still.data, video.data, 'still download and video use one colour lattice');
    globalThis.window = dom.window as unknown as Window & typeof globalThis;
    globalThis.document = dom.window.document;
    const { makeGradeOp } = await import('../shells/web/src/lib/video-jobs.ts');
    const grade = makeGradeOp({ cubeText: look.cube, lutIntensity: 1, grain: 0, grainSize: 1, vignette: 0, seed: 1, fps: 0, bitrate: 4000000 });
    const source = new Uint8ClampedArray([64, 96, 128, 123, 210, 100, 70, 255]);
    const expected = source.slice();
    for (let i = 0; i < source.length; i += 4) {
      const rgb = sampleLut(still, source[i]! / 255, source[i + 1]! / 255, source[i + 2]! / 255);
      for (let channel = 0; channel < 3; channel++) expected[i + channel] = 255 * rgb[channel]!;
    }
    assert.notDeepEqual(expected, source, 'the imported look changes colour');
    for (const timestampUs of [0, 33367, 1001000, 5972667, 6006000]) {
      const frame = await grade({ data: source.slice(), width: 2, height: 1, timestampUs, durationUs: 33367 });
      assert.deepEqual(frame.data, expected, 'same pixels at every point on the loop');
      assert.equal(frame.timestampUs, timestampUs); assert.equal(frame.durationUs, 33367);
      assert.equal(frame.width, 2); assert.equal(frame.height, 1);
    }
  } finally { runtime.destroy(); }
});
