// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CanvasClaimTarget, CanvasPreview } from '@lolly-tools/core/canvas-interaction-v1';
import { registerCanvasInteractions, type CanvasInteractionLease } from '../../lib/canvas-interaction.ts';
import { subscribeCanvasRecovery } from '../../lib/canvas-recovery.ts';
import { boxRect, withRect, type Box } from '../free-canvas-math.ts';
import { handleAnchor } from '../free-canvas-transform.ts';
import { applyGestureMove } from './gestures.ts';
import { cascadeFrameChildren, idOf } from './select.ts';
import { selectionTransformOps } from './selection-transform.ts';
import { pinchOps } from './pinch.ts';
import {
  beginCanvasGesture, canvasGestureReady, finishCanvasGesture, flushCanvasPreview, previewCanvasRect,
} from './collaboration.ts';
import type { FcCtx } from './context.ts';
import type { Gesture, Point, Rect } from './shared.ts';

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
    isFrameRow: () => false,
  } as unknown as FcCtx['gestures'];
  fc.selectionTransform = selectionTransformOps(fc);
  const lease: CanvasInteractionLease = { id: 'claim', preview: value => { previews.push(value); },
    finish: committed => { finishes.push(committed); } };
  const unregister = registerCanvasInteractions(fc.runtime, {
    acquire: async (target, onLost) => {
      targets.push(target); lost = onLost;
      if (pending) await new Promise<void>(resolve => { grant = resolve; });
      return lease;
    },
  });
  // Ctrl suspends snapping in every transform, so the frames below read the raw pointer.
  // Alt would not: it resizes from the centre and keeps the guides on.
  const event = (x: number, y: number): PointerEvent => ({ pointerId: 1, clientX: x, clientY: y, ctrlKey: true }) as PointerEvent;
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

/** A group gesture as onGroupHandleDown builds one: the press in native px, the start
 *  bounds of the pair (0,0 to 140,80) and, for a scale, the dragged handle (the se corner,
 *  which holds the nw corner still, or the e edge, which holds the w edge's midpoint). */
function groupGesture(type: 'gscale' | 'grotate', boxes: Box[], press = { x: 140, y: 80 }, handle: 'se' | 'e' = 'se'): Gesture {
  const base = { pointerId: 1, startClient: press, origin: press, sel: [0, 1], startBoxes: boxes };
  if (type === 'gscale') {
    return { ...base, type, handle, aabb: { minX: 0, minY: 0, maxX: 140, maxY: 80 }, others: [], proportional: false };
  }
  const centre = { x: 70, y: 40 };
  return { ...base, type, centre, pointerStartDeg: (Math.atan2(press.y - centre.y, press.x - centre.x) * 180) / Math.PI };
}

test('resize, rotate, group scale and group rotation each publish one final preview', async () => {
  for (const type of ['resize', 'rotate', 'gscale', 'grotate'] as const) {
    const boxes = [shape('one'), shape('two', 100, 50)];
    const f = fixture(boxes, type.startsWith('g') ? [0, 1] : [0]);
    f.fc.gesture = type === 'gscale' || type === 'grotate' ? groupGesture(type, boxes) : {
      pointerId: 1, startClient: { x: 0, y: 0 }, origin: { x: 0, y: 0 },
      type, index: 0, handle: 'se', startRect: boxRect(boxes[0], f.fc.cfg), others: [],
      centerClient: { x: 0, y: 0 }, pointerStartDeg: 0,
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

test('a group rebase rebuilds the anchor and the pivot from the claim-grant rows, keeping the press', async () => {
  for (const [type, handle, press] of [['gscale', 'se', { x: 140, y: 80 }], ['gscale', 'e', { x: 140, y: 40 }], ['grotate', 'se', { x: 140, y: 80 }]] as const) {
    // The press was measured against the pair at (0,0); before the grant a peer moved
    // both rows 100 px right, and the server's drained rows are what the gesture uses.
    const pressed = [shape('one'), shape('two', 100, 50)];
    const f = fixture(pressed, [0, 1], true);
    f.fc.gesture = groupGesture(type, pressed, press, handle);
    await f.ready();
    try {
      const drained = [shape('one', 100), shape('two', 200, 50)];
      f.replace(drained);
      await f.grant();
      assert.equal(canvasGestureReady(f.fc), true, 'the first frame after the grant rebases');
      const g = f.fc.gesture!;
      switch (g.type) {
        case 'gscale':
          assert.deepEqual(g.aabb, { minX: 100, minY: 0, maxX: 240, maxY: 80, w: 140, h: 80 });
          assert.deepEqual(handleAnchor(g.aabb, g.handle), handle === 'se' ? { x: 100, y: 0 } : { x: 100, y: 40 },
            'the point held still is the rebased bounds\' nw corner, or its w edge\'s midpoint');
          assert.deepEqual(g.origin, press, 'and the press kept its place');
          assert.equal(g.proportional, false, 'two upright rows still resize freely');
          break;
        case 'grotate':
          assert.deepEqual(g.centre, { x: 170, y: 40 }, 'the pivot is the rebased bounds\' centre');
          assert.equal(g.pointerStartDeg, (Math.atan2(40, -30) * 180) / Math.PI, 'and the press angle is taken about that pivot');
          break;
        default:
          assert.fail(`unexpected gesture ${g.type}`);
      }
      // At the press point the rebased gesture reads as no change at all.
      applyGestureMove(f.fc, f.event(press.x, press.y));
      const last = f.previews.at(-1)!;
      assert.deepEqual(last.objects.map(o => [o.x, o.y, o.w, o.h, o.rot]), [[100, 0, 40, 30, 0], [200, 50, 40, 30, 0]], `${type} ${handle}`);
      if (type === 'gscale') {
        // And the travel from the press scales the rebased rows about the rebased anchor:
        // 140 px right doubles the pair's 140 px width from its left edge, at x 100.
        applyGestureMove(f.fc, f.event(press.x + 140, press.y));
        const moved = f.previews.at(-1)!.objects.map(o => [o.x, o.w]);
        assert.deepEqual(moved, [[100, 80], [300, 80]], `${handle}: the rows double their width from x 100`);
      }
    } finally { f.destroy(); }
  }
});

test('a group scale rebase decides the uniform fallback again from the claim-grant rows', async () => {
  for (const [rot, want] of [[30, true], [90, false]] as const) {
    // Pressed on two upright rows; before the grant a peer turned one of them.
    const pressed = [shape('one'), shape('two', 100, 50)];
    const f = fixture(pressed, [0, 1], true);
    f.fc.gesture = groupGesture('gscale', pressed, { x: 140, y: 40 }, 'e');
    await f.ready();
    try {
      f.replace([shape('one'), { ...shape('two', 100, 50), rot }]);
      await f.grant();
      assert.equal(canvasGestureReady(f.fc), true);
      const g = f.fc.gesture!;
      assert.equal(g.type === 'gscale' && g.proportional, want,
        `${rot} degrees: ${want ? 'one factor for both axes, as the readout will say' : 'a quarter turn still resizes freely'}`);
      // The e edge's 70 px on a set 70 px past its left edge: the free drag doubles x only,
      // the fallback doubles both axes about the w edge's midpoint.
      applyGestureMove(f.fc, f.event(140 + (g.type === 'gscale' ? g.aabb.maxX - g.aabb.minX : 0), 40));
      const one = f.previews.at(-1)!.objects.find(o => o.id === 'one')!;
      assert.deepEqual([one.w, one.h], want ? [80, 60] : [80, 30]);
    } finally { f.destroy(); }
  }
});

/** A pinch as pinch.ts claims one on the pair: the first finger at (0, 40) and the second
 *  at (140, 40), native px, with only the first row turning. */
function pinchGesture(boxes: Box[]): Gesture {
  return { type: 'pinch', pointerId: 1, pointerA: 2, startClient: { x: 140, y: 40 }, sel: [0, 1], turns: [true, false],
    startBoxes: boxes, startA: { x: 0, y: 40 }, startB: { x: 140, y: 40 }, curA: { x: 0, y: 40 }, curB: { x: 140, y: 40 } };
}

test('a pinch rebases by stable id, keeps its turning rows, takes each preview kind from the frame and commits by id', async () => {
  const pressed = [shape('one'), shape('two', 100, 50)];
  const f = fixture(pressed, [0, 1], true);
  const committed: Box[][] = [];
  Object.assign(f.fc, {
    gesture: pinchGesture(pressed), twoTapStart: 0, touchPts: new Map(), canvasEl: { releasePointerCapture() {} },
  });
  f.fc.pinch = pinchOps(f.fc);
  Object.assign(f.fc.stage, { metrics: () => ({ scale: 1 }) });
  Object.assign(f.fc.chromeSync, { renderChrome: () => {} });
  Object.assign(f.fc.gestures, {
    applyLiveRect: (i: number, r: Rect) => previewCanvasRect(f.fc, i, r),
    endGesture: (done: boolean) => { finishCanvasGesture(f.fc, done); f.fc.gesture = null; },
  });
  Object.assign(f.fc.select, { assignFrames: (rows: Box[]) => rows, commit: (rows: Box[]) => { committed.push(rows); } });
  await f.ready();
  try {
    // Before the grant a peer moved both rows 100 px right and put them in the other order.
    f.replace([shape('two', 200, 50), shape('one', 100)]);
    await f.grant();
    assert.equal(canvasGestureReady(f.fc), true);
    const g = f.fc.gesture!;
    assert.ok(g.type === 'pinch');
    assert.deepEqual(g.sel, [1, 0], 'the rows follow their ids to the new order');
    assert.deepEqual(g.turns, [true, false], 'and the turning flags stay with them, by position');
    assert.deepEqual(g.sel.map(i => [g.startBoxes[i]!.id, g.startBoxes[i]!.x]), [['one', 100], ['two', 200]]);
    const frame = (a: Point, b: Point): Preview => {
      g.curA = a; g.curB = b;
      applyGestureMove(f.fc, f.event(b.x, b.y));
      return f.previews.at(-1)!;
    };
    // Both fingers travel 20 px right and 10 down: past the drag threshold, a move.
    const moved = frame({ x: 20, y: 50 }, { x: 160, y: 50 });
    assert.equal(moved.kind, 'move');
    assert.deepEqual(moved.objects.map(o => [o.id, o.x, o.y]), [['two', 220, 60], ['one', 120, 10]]);
    // The spread doubles about the start midpoint (70, 40): a resize.
    assert.equal(frame({ x: -70, y: 40 }, { x: 210, y: 40 }).kind, 'resize');
    // A 40 degree twist turns 20 past its 20 degree engage point, and only `one` turns.
    const turn = (deg: number): [Point, Point] => {
      const v = { x: Math.cos((deg * Math.PI) / 180) * 70, y: Math.sin((deg * Math.PI) / 180) * 70 };
      return [{ x: 70 - v.x, y: 40 - v.y }, { x: 70 + v.x, y: 40 + v.y }];
    };
    frame(...turn(20));
    const turned = frame(...turn(40));
    assert.equal(turned.kind, 'rotate');
    assert.deepEqual(turned.objects.map(o => [o.id, Math.round(o.rot)]), [['two', 0], ['one', 20]]);
    // A peer reorders again and edits `two` before the lift: the commit is merged by id onto
    // the current rows and keeps the peer's edit.
    f.replace([shape('one', 100), { ...shape('two', 200, 50), fill: '#f00' }]);
    f.fc.pinch.end();
    assert.equal(committed.length, 1);
    const [one, two] = committed[0]!;
    assert.deepEqual([one!.id, Math.round(Number(one!.rot))], ['one', 20]);
    assert.deepEqual([two!.id, two!.x, two!.y, two!.fill], ['two', 200, 50, '#f00']);
  } finally { f.destroy(); }
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
