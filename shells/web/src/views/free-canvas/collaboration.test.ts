// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CanvasClaimTarget, CanvasPreview } from '@lolly-tools/core/canvas-interaction-v1';
import { registerCanvasInteractions, type CanvasInteractionLease } from '../../lib/canvas-interaction.ts';
import { subscribeCanvasRecovery } from '../../lib/canvas-recovery.ts';
import { boxRect, withRect, type Box } from '../free-canvas-math.ts';
import { applyGestureMove } from './gestures.ts';
import { cascadeFrameChildren, idOf } from './select.ts';
import {
  beginCanvasGesture, canvasGestureReady, finishCanvasGesture, flushCanvasPreview, previewCanvasRect,
} from './collaboration.ts';
import type { FcCtx } from './context.ts';
import type { Gesture } from './shared.ts';

type Preview = Omit<CanvasPreview, 'claimId' | 'collection'>;

function fixture(rows: Box[], selected: number[], pending = false) {
  let boxes = rows, grant: (() => void) | undefined, lost: (() => void) | undefined;
  let cascades = 0, reads = 0, cancelled = 0;
  const previews: Preview[] = [], finishes: boolean[] = [], targets: CanvasClaimTarget[] = [], restored: number[] = [];
  const gesture = { type: 'move', sel: selected, start: new Map(), origin: { x: 0, y: 0 },
    pointerId: 1, startClient: { x: 0, y: 0 }, selAABB: null, others: [] } as Gesture;
  const fc = {
    runtime: {}, blockId: 'boxes', cfg: { idField: 'id', kindField: 'kind', xField: 'x', yField: 'y',
      wField: 'w', hField: 'h', rotationField: 'rot' },
    frameCfg: { frameKind: 'frame', frameField: 'frame' }, gesture, disposed: false, opts: {},
    minSize: 1, guidesEl: { innerHTML: '' },
    stage: { clientToNative: (x: number, y: number) => ({ x, y }), liveBoxEl: () => null, flash: () => {} },
    chromeSync: { renderChromeLive: () => {} }, connectors: { liveConnUpdate: () => {} },
    fieldPanels: { isCircle: () => false },
  } as unknown as FcCtx;
  fc.select = {
    getBoxes: () => boxes,
    idOf: (box: Box | undefined, index: number) => { reads++; return idOf(fc, box, index); },
    cascadeFrameChildren: (prev: Box[], next: Box[], sel: number[]) => {
      cascades++; return cascadeFrameChildren(fc, prev, next, sel);
    },
  } as FcCtx['select'];
  fc.gestures = {
    applyGestureMove: (event: PointerEvent) => applyGestureMove(fc, event),
    applyLiveRect: (index: number) => { restored.push(index); },
    cancelGesture: () => { cancelled++; finishCanvasGesture(fc, false); fc.gesture = null; },
  } as unknown as FcCtx['gestures'];
  const lease: CanvasInteractionLease = { id: 'claim', preview: value => { previews.push(value); },
    finish: committed => { finishes.push(committed); } };
  const unregister = registerCanvasInteractions(fc.runtime, {
    acquire: async (target, onLost) => {
      targets.push(target); lost = onLost;
      if (pending) await new Promise<void>(resolve => { grant = resolve; });
      return lease;
    },
  });
  const event = (x: number, y: number): PointerEvent => ({ pointerId: 1, clientX: x, clientY: y, altKey: true }) as PointerEvent;
  return { fc, previews, finishes, targets, restored, event,
    ready: async () => { beginCanvasGesture(fc); await Promise.resolve(); await Promise.resolve(); },
    grant: async () => { grant?.(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); },
    replace: (next: Box[]) => { boxes = next; }, lose: () => lost?.(),
    counts: () => ({ cascades, reads, cancelled }),
    destroy: () => { finishCanvasGesture(fc, false); unregister(); },
  };
}

function shape(id: string, x = 0, y = 0, frame = ''): Box {
  return { id, kind: 'shape', x, y, w: 40, h: 30, rot: 0, frame };
}

test('a large selection sends one complete preview per applied gesture frame without changing source rows', async () => {
  const boxes = Array.from({ length: 3000 }, (_, i) => shape(`b${i}`, i, i * 2));
  const selected = Array.from({ length: 100 }, (_, i) => i * 2);
  const f = fixture(boxes, selected);
  await f.ready();
  try {
    const source = structuredClone(boxes);
    applyGestureMove(f.fc, f.event(12, 7));
    assert.equal(f.previews.length, 1);
    assert.equal(f.counts().cascades, 1);
    assert.deepEqual(f.previews[0]!.objects, selected.map(i => ({ id: `b${i}`, x: i + 12, y: i * 2 + 7, w: 40, h: 30, rot: 0 })));
    flushCanvasPreview(f.fc);
    assert.equal(f.previews.length, 1, 'flushing an unchanged frame sends nothing');
    const reads = f.counts().reads;
    assert.equal(canvasGestureReady(f.fc), true);
    assert.equal(f.counts().reads, reads, 'unchanged rows do not rebuild gesture origins');
    applyGestureMove(f.fc, f.event(20, 9));
    assert.equal(f.previews.length, 2);
    assert.deepEqual(boxes, source);
  } finally { f.destroy(); }
});

test('batched frame previews match the committed cascade, including independently selected children', async () => {
  const boxes = [
    { ...shape('board', 100, 200), kind: 'frame' }, shape('child', 110, 220, 'board'),
    shape('selected-child', 150, 250, 'board'), shape('loose', 1, 2),
  ];
  const f = fixture(boxes, [0, 2]);
  await f.ready();
  try {
    canvasGestureReady(f.fc);
    const rects = new Map([[0, { x: 120, y: 210, w: 80, h: 60, rot: 10 }],
      [2, { x: 200, y: 300, w: 20, h: 15, rot: 30 }]]);
    for (const [i, rect] of rects) previewCanvasRect(f.fc, i, rect);
    assert.equal(f.previews.length, 0, 'no partial group is published');
    flushCanvasPreview(f.fc);
    const expected = cascadeFrameChildren(f.fc, boxes, boxes.map((box, i) => rects.has(i) ? withRect(box, rects.get(i)!, f.fc.cfg) : box), [0, 2]);
    assert.deepEqual(f.previews[0]!.objects, expected.slice(0, 3).map(box => ({ id: String(box.id), ...boxRect(box, f.fc.cfg) })));
    assert.deepEqual(f.targets[0]!.ids, ['board', 'selected-child', 'child']);
    assert.equal(f.counts().cascades, 1);
  } finally { f.destroy(); }
});

test('resize, rotate, group scale and group rotation each publish one final preview', async () => {
  for (const type of ['resize', 'rotate', 'gscale', 'grotate'] as const) {
    const boxes = [shape('one'), shape('two', 100, 50)];
    const f = fixture(boxes, type.startsWith('g') ? [0, 1] : [0]);
    f.fc.gesture = { pointerId: 1, startClient: { x: 0, y: 0 }, origin: { x: 0, y: 0 },
      type, index: 0, handle: 'se', startRect: boxRect(boxes[0], f.fc.cfg), others: [],
      centerClient: { x: 0, y: 0 }, pointerStartDeg: 0, sel: [0, 1], startBoxes: boxes,
      anchor: { x: 0, y: 0 }, origDist: 100, centre: { x: 70, y: 40 },
    } as Gesture;
    await f.ready();
    try {
      applyGestureMove(f.fc, f.event(120, 80));
      assert.equal(f.previews.length, 1, type);
      assert.equal(f.previews[0]!.kind, type === 'resize' || type === 'gscale' ? 'resize' : 'rotate');
      assert.equal(f.previews[0]!.objects.length, type.startsWith('g') ? 2 : 1);
    } finally { f.destroy(); }
  }
});

test('remote reorders preserve stable ids and claim origins, and deletion cancels the gesture', async () => {
  const boxes = [shape('one', 10, 20), shape('two', 50, 60)];
  const f = fixture(boxes, [0]);
  await f.ready();
  try {
    canvasGestureReady(f.fc);
    f.replace([boxes[1]!, { ...boxes[0], x: 500, fill: '#f00' }]);
    applyGestureMove(f.fc, f.event(5, 7));
    assert.deepEqual(f.previews[0]!.objects, [{ id: 'one', x: 15, y: 27, w: 40, h: 30, rot: 0 }]);
    assert.deepEqual(f.fc.gesture!.type === 'move' && f.fc.gesture.sel, [1]);
    f.replace([boxes[1]!]);
    assert.equal(canvasGestureReady(f.fc), false);
    assert.equal(f.counts().cancelled, 1);
    assert.deepEqual(f.finishes, [false]);
  } finally { f.destroy(); }
});

test('pending claims replay only the latest pointer using the drained source, and late grants are released', async () => {
  const f = fixture([shape('one', 10, 20)], [0], true);
  await f.ready();
  try {
    assert.equal(canvasGestureReady(f.fc, f.event(3, 4)), false);
    assert.equal(canvasGestureReady(f.fc, f.event(8, 9)), false);
    f.replace([shape('one', 100, 200)]);
    await f.grant();
    assert.deepEqual(f.previews[0]!.objects, [{ id: 'one', x: 108, y: 209, w: 40, h: 30, rot: 0 }]);
  } finally { f.destroy(); }
  const late = fixture([shape('one')], [0], true);
  await late.ready();
  finishCanvasGesture(late.fc, false);
  await late.grant();
  assert.deepEqual(late.finishes, [false]);
  assert.equal(late.previews.length, 0);
  late.destroy();
});

test('release flushes a staged final frame, while cancellation restores without publishing it', async () => {
  for (const committed of [true, false]) {
    const f = fixture([shape('one')], [0]);
    await f.ready();
    previewCanvasRect(f.fc, 0, { x: 15, y: 25, w: 40, h: 30 });
    finishCanvasGesture(f.fc, committed);
    assert.equal(f.previews.length, committed ? 1 : 0);
    assert.deepEqual(f.finishes, [committed]);
    assert.deepEqual(f.restored, committed ? [] : [0]);
    f.destroy();
  }
});

test('claim loss retains the complete interrupted frame cascade as a separate recovery copy', async () => {
  const boxes = [{ ...shape('board', 100, 200), kind: 'frame' }, shape('child', 110, 220, 'board')];
  const f = fixture(boxes, [0]);
  const recovery: unknown[] = [];
  const off = subscribeCanvasRecovery(f.fc.runtime, draft => { recovery.push(draft.values.boxes); });
  await f.ready();
  try {
    previewCanvasRect(f.fc, 0, { x: 120, y: 230, w: 40, h: 30, rot: 0 });
    f.lose();
    assert.equal(f.counts().cancelled, 1);
    assert.equal(f.previews.length, 0);
    assert.deepEqual(recovery, [[{ ...boxes[0], x: 120, y: 230 }, { ...boxes[1], x: 130, y: 250 }]]);
    assert.equal(boxes[0]!.x, 100);
  } finally { off(); f.destroy(); }
});
