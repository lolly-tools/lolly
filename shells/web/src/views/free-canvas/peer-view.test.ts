// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canvasSurfaceView, revealCanvasPeer } from './peer-view.ts';
import { JSDOM } from 'jsdom';
import type { PresenceState } from '../../lib/collab-presence.ts';

test('a peer jump resolves the current slide and multi-selection without a model write', () => {
  const boxes = [{ id: 'page', kind: 'frame' }, { id: 'title', kind: 'text', frame: 'page' }, { id: 'body', kind: 'text', frame: 'page' }, { id: 'elsewhere', kind: 'text', frame: 'other' }];
  const original = JSON.stringify(boxes), focused: string[] = [], selections: string[][] = [];
  const fc = { disposed: false, blockId: 'boxes', cfg: { kindField: 'kind' }, frameCfg: { frameKind: 'frame', frameField: 'frame' },
    select: { getBoxes: () => boxes, idOf: (box: Record<string, unknown> | undefined) => String(box?.id), indexOfId: (rows: Record<string, unknown>[], id: string | undefined) => rows.findIndex(row => row.id === id) },
    selectionPort: { set: (ids: readonly string[]) => { selections.push([...ids]); } }, document: { focusArtboard: (id: string) => { focused.push(id); } }, textEdit: { commitTextEdit() {} } };
  const state: PresenceState = { userId: 'peer', name: 'Peer', color: '#123456', surface: { id: 'page', space: 'unit' }, selection: ['title', 'body', 'deleted', 'elsewhere', 'title'] };
  assert.equal(revealCanvasPeer(fc, state), true);
  assert.deepEqual(selections, [['title', 'body']]); assert.deepEqual(focused, ['page']); assert.equal(JSON.stringify(boxes), original);
  assert.equal(revealCanvasPeer(fc, { ...state, selection: [] }), true); assert.deepEqual(selections.at(-1), ['page']);
  assert.equal(revealCanvasPeer(fc, { ...state, surface: { id: 'deleted-page', space: 'unit' } }), false);
  fc.disposed = true; assert.equal(revealCanvasPeer(fc, state), false); assert.equal(selections.length, 2);
});

test('focusSurface frames an artboard and revealPoint centres a document point, neither touching the selection', () => {
  const dom = new JSDOM('<main id="stage"></main>');
  const stageEl = dom.window.document.getElementById('stage')!;
  const boxes = [{ id: 'page', kind: 'frame' }, { id: 'title', kind: 'text', frame: 'page' }];
  const focused: string[] = [], rects: { x: number; y: number; w: number; h: number; viewport?: { x: number; y: number; w: number; h: number } }[] = [];
  stageEl.addEventListener('fc-focus-rect', event => { rects.push((event as CustomEvent<typeof rects[number]>).detail); });
  const metrics = { cr: new dom.window.DOMRect(-50, 20, 2000, 1000), sr: new dom.window.DOMRect(100, 40, 800, 600), scale: 2 };
  const fc = { disposed: false, blockId: 'boxes', stageEl, cfg: { kindField: 'kind' }, frameCfg: { frameKind: 'frame' },
    select: { getBoxes: () => boxes, idOf: (box: Record<string, unknown> | undefined) => String(box?.id) },
    stage: { metrics: () => metrics, nativeToStage: (nx: number, ny: number, m = metrics) => ({ x: m.cr.left - m.sr.left + nx * m.scale, y: m.cr.top - m.sr.top + ny * m.scale }) },
    document: { focusArtboard: (id: string) => { focused.push(id); } } };
  const view = canvasSurfaceView(fc);
  assert.equal(view.focusSurface('page'), true); assert.deepEqual(focused, ['page']);
  assert.equal(view.focusSurface('canvas:boxes'), true, 'the canvas itself is always in view'); assert.deepEqual(focused, ['page']);
  assert.equal(view.focusSurface('title'), false, 'a box is not a surface');
  assert.equal(view.focusSurface('gone'), false);

  assert.equal(view.revealPoint('page', { x: 100, y: 50 }), true);
  // Native (100, 50) at scale 2 sits at client (-50 + 200, 20 + 100) = (150, 120).
  assert.deepEqual(rects[0], { x: 150, y: 120, w: 0, h: 0, viewport: { x: 499.5, y: 339.5, w: 1, h: 1 } }, 'a one-pixel window at the stage centre');
  assert.equal(view.revealPoint('gone', { x: 0, y: 0 }), false);
  assert.equal(view.revealPoint('page', { x: Number.NaN, y: 0 }), false);
  assert.equal(view.revealPoint('page', { x: 2e6, y: 0 }), false, 'outside the document coordinate range');
  fc.disposed = true;
  assert.equal(view.focusSurface('page'), false); assert.equal(view.revealPoint('page', { x: 0, y: 0 }), false);
  assert.equal(rects.length, 1); dom.window.close();
});
