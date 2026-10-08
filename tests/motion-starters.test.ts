// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseKf, evaluateKf } from '../engine/src/keyframes.ts';
import { serializeUrlState, parseUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';
import { parseTemplateMotion } from '../shells/web/src/lib/template-motion.ts';
import { applyChoreograph } from '../shells/web/src/views/choreograph.ts';
import type { TimeCfg } from '../shells/web/src/views/timeline-math.ts';
import type { InputValue } from '../engine/src/inputs.ts';

const root = new URL('../community/', import.meta.url);
const design = await loadTool('design', path => readFile(new URL(path, root), 'utf8'));
const cfg = design.manifest.inputs.find(input => input.id === 'boxes')!.canvas as unknown as TimeCfg;
type Row = Record<string, InputValue> & { id: string; dur: number; kf?: string; group?: string };
for (const id of ['motion-editorial-loop', 'motion-feature-loop', 'motion-photo-loop']) test(`${id}: variants close and survive the render and URL paths`, async () => {
  const source = JSON.parse(await readFile(new URL(`design/templates/${id}.json`, root), 'utf8'));
  assert.equal(parseTemplateMotion(source.motion)?.collection, 'Motion');
  const fields = new Set(design.manifest.inputs.find(input => input.id === 'boxes')!.fields!.map(field => field.id));
  for (const values of [source.values, ...source.presets.map((preset: { values: object }) => ({ ...source.values, ...preset.values }))]) {
    const rows = values.boxes as Row[];
    const moving = rows.filter(row => row.kf);
    assert.ok(moving.length >= 4);
    for (const row of rows) for (const key of Object.keys(row)) assert.ok(fields.has(key), key);
    for (const row of moving) {
      const keys = parseKf(row.kf!);
      assert.deepEqual(evaluateKf(keys, 0), evaluateKf(keys, row.dur * 1000));
      for (let sample = 0; sample <= 240; sample++) {
        const pose = evaluateKf(keys, row.dur * 1000 * sample / 240);
        assert.ok(Object.values(pose).every(Number.isFinite));
        if (row.group) for (const peer of moving.filter(peer => peer.group === row.group)) assert.deepEqual(evaluateKf(parseKf(peer.kf!), row.dur * 1000 * sample / 240), pose);
      }
    }
    const host = baseHost();
    const composed: string[] = [];
    host.compose = { async render() { throw new Error('unexpected authored compose'); }, async renderUrl(url: string) { composed.push(url); return { id: url, url: 'data:image/png;base64,AA==', type: 'raster', format: 'png', width: 1080, height: 1080 }; } };
    const runtime = await createRuntime(design, host, values);
    assert.match(runtime.getHydrated(), /data-t-kf=/);
    const state = parseUrlState(serializeUrlState(runtime.getModel()), design.manifest);
    const roundTrip = state.values.boxes as Row[];
    for (const row of moving) assert.equal(roundTrip.find(peer => peer.id === row.id)?.kf, row.kf);
    if (id === 'motion-photo-loop') { assert.equal(composed.length, 1); assert.match(composed[0]!, /darkroom\.png/); assert.match(composed[0]!, /grain=0/); }
    runtime.destroy();
  }
});

test('explicit picker length fits selected clip ends without changing other tracks', () => {
  const rows = [{ id: 'a', kind: 'box', x: 0, y: 0, w: 100, h: 100, lane: 'seq', start: 2, dur: 8 }, { id: 'b', kind: 'text', x: 20, y: 20, w: 100, h: 100, lane: 'seq', start: 3, dur: 7 }, { id: 'other', kind: 'box', lane: 'seq', start: 0, dur: 15 }];
  const original = structuredClone(rows);
  const env = { cfg, stage: { w: 1920, h: 1080 }, rect: () => ({ x: 0, y: 0, w: 100, h: 100 }), mint: () => 'camera' };
  const result = applyChoreograph(rows, ['a', 'b'], { showcase: 'drift-loop', durationMs: 4000, retime: true, camera: false }, env)!;
  assert.equal(result.rows[0]!.dur, 4); assert.equal(result.rows[1]!.dur, 3);
  assert.equal(result.rows[0]!.start, 2); assert.equal(result.rows[1]!.start, 3);
  assert.ok(result.rows[0]!.kf); assert.ok(result.rows[1]!.kf);
  assert.deepEqual(result.rows[2], original[2]); assert.deepEqual(rows, original);
  assert.equal(applyChoreograph(rows, ['a', 'b'], { showcase: 'drift-loop', durationMs: 4000, camera: false }, env)!.rows[0]!.dur, 8);
  assert.throws(() => applyChoreograph(rows, ['a', 'b'], { showcase: 'drift-loop', durationMs: 800, retime: true, camera: false }, env), /before a selected clip starts/);
});

test('matching photo looks publish a reusable colour lattice with moving grain off', async () => {
  const darkroom = await loadTool('darkroom', path => readFile(new URL(path, root), 'utf8'));
  for (const id of ['motion-warm', 'motion-clean', 'motion-mono']) {
    const source = JSON.parse(await readFile(new URL(`darkroom/templates/${id}.json`, root), 'utf8'));
    assert.equal(source.values.grain, 0);
    const runtime = await createRuntime(darkroom, baseHost(), source.values);
    const look = JSON.parse(runtime.getHydratedText('{{videoLook}}'));
    assert.equal(look.v, 1); assert.equal(look.on, 1); assert.match(look.cube, /LUT_3D_SIZE 33/);
    runtime.destroy();
  }
});
