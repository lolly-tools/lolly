// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseKf } from '../../../../../engine/src/keyframes.ts';
import { applyCameraPreset, ensureSceneCameraRows, sceneCameraId } from './camera.ts';
import type { TpCtx } from './context.ts';

test('creating a scene camera follows selection, preserves the other camera, and uses the owner interval', () => {
  const rows = [{ id: 'a', kind: 'frame', start: 0, dur: 4 }, { id: 'b', kind: 'frame', start: 4, dur: 5 },
    { id: 'camera-a', kind: 'camera', frame: 'a', kf: 't0_x20' }, { id: 'title-b', kind: 'text', frame: 'b' }];
  const ctx = { cfg: { idField: 'id', frameField: 'frame', startField: 'start', durField: 'dur' },
    selection: { get: () => ['title-b'] }, clock: { t: () => 1000 }, addKinds: [], edit: { mintId: () => 'camera-b' } } as unknown as TpCtx;
  assert.equal(sceneCameraId(ctx, rows), '');
  const result = ensureSceneCameraRows(ctx, rows);
  assert.equal(result.id, 'camera-b');
  assert.deepEqual(result.rows.at(-1), { id: 'camera-b', kind: 'camera', frame: 'b', start: 4, dur: 5 });
  assert.equal(result.rows[2], rows[2]);
  assert.equal(ensureSceneCameraRows(ctx, result.rows).rows, result.rows);
});

test('a camera preset fills its selected scene instead of the whole film', () => {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  const previous = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame };
  Object.assign(globalThis, { document: dom.window.document, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window) });
  try {
    const rows = [{ id: 'a', kind: 'frame', start: 0, dur: 4 }, { id: 'b', kind: 'frame', start: 4, dur: 5 }];
    let written: Array<Record<string, unknown>> = [];
    const ctx = { cfg: { idField: 'id', frameField: 'frame', startField: 'start', durField: 'dur', kfField: 'kf' },
      selection: { get: () => ['b'] }, clock: { t: () => 5000 }, getBoxes: () => rows,
      addKinds: [], edit: { mintId: () => 'camera-b' }, helpers: { write: (rows: Array<Record<string, unknown>>) => { written = rows; } },
      rows: { selectAndReveal() {} } } as unknown as TpCtx;
    applyCameraPreset(ctx, { label: 'Pan', track: 't0_x0*t1000_x100' });
    assert.equal(parseKf(written.at(-1)!.kf as string).at(-1)!.t, 5000);
    assert.equal(written.at(-1)!.frame, 'b');
  } finally { Object.assign(globalThis, previous); dom.window.close(); }
});
