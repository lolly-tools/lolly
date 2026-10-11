// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { MAX_SNAP_INDEX_TARGETS } from '../shells/web/src/views/canvas-snap-index.ts';
import {
  boxAABB,
  createCanvasSnapIndex,
  snapMove,
  snapPoint,
} from '../shells/web/src/views/free-canvas-math.ts';
import type { AABB, CanvasSnapIndex, SnapLines } from '../shells/web/src/views/free-canvas-math.ts';
import {
  applyGestureMove,
  beginGesture,
  endGesture,
  otherAABBs,
  snapThreshNative,
} from '../shells/web/src/views/free-canvas/gestures.ts';
import type { FcCtx } from '../shells/web/src/views/free-canvas/context.ts';
import type { GestureInit } from '../shells/web/src/views/free-canvas/shared.ts';

const cfg = {
  idField: 'id',
  xField: 'x',
  yField: 'y',
  wField: 'w',
  hField: 'h',
  rotationField: 'rot',
};
const canvas = { w: 1024, h: 768 };
const bounds = (x: number, y: number, w = 20, h = 30): AABB => ({
  minX: x,
  minY: y,
  maxX: x + w,
  maxY: y + h,
  w,
  h,
});

function random(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
}

test('indexed move and point queries preserve exact seeded rotated geometry, zoom thresholds and angled guides', () => {
  const next = random(0x305209);
  const others = Array.from({ length: 240 }, (_, i) =>
    boxAABB(
      {
        x: next() * 1800 - 400,
        y: next() * 1200 - 250,
        w: next() * 160 + 1,
        h: next() * 100 + 1,
        rot: i % 4 ? next() * 360 : 0,
      },
      cfg
    )
  );
  const source = structuredClone(others);
  const index = createCanvasSnapIndex(others, canvas);
  assert.ok(index);
  const lines: SnapLines = {
    x: [-100, 24, 512, 999, NaN],
    y: [-50, 17, 320, 768, Infinity],
    angled: [
      { x: 220, y: 115, rotation: 27 },
      { x: 440, y: 90, rotation: -42 },
      { x: NaN, y: 0, rotation: 20 },
    ],
  };
  for (let i = 0; i < 800; i++) {
    const active = bounds(next() * 1500 - 250, next() * 1000 - 200, next() * 130, next() * 110);
    const threshold = [0, 0.25, 1.5, 6, 24, 96][i % 6]!;
    assert.deepEqual(
      snapMove(active, others, canvas, threshold, lines, index),
      snapMove(active, others, canvas, threshold, lines),
      `move ${i}`
    );
    assert.deepEqual(
      snapPoint(active.minX, active.maxY, others, canvas, threshold, lines, index),
      snapPoint(active.minX, active.maxY, others, canvas, threshold, lines),
      `point ${i}`
    );
  }
  assert.deepEqual(others, source, 'preparation and queries preserve source bounds');
});

test('active-edge then artboard/object/guide order decides ties and winning spans remain live', () => {
  const others = [bounds(98, 100, 0, 20), bounds(102, 300, 0, 20), bounds(98, 500, 0, 20)];
  const index = createCanvasSnapIndex(others, canvas);
  const lines = { x: [98], y: [] };
  for (const active of [bounds(99, 80, 2, 10), bounds(99, 900, 2, 10)]) {
    const expected = snapMove(active, others, canvas, 1, lines);
    assert.equal(
      expected.guides[0]!.x1,
      98,
      'first active edge and first object precede later equal distances'
    );
    assert.deepEqual(snapMove(active, others, canvas, 1, lines, index), expected);
  }
  const reversed = [others[1]!, others[0]!, others[2]!];
  assert.equal(
    snapPoint(100, 401, reversed, canvas, 2, {}, createCanvasSnapIndex(reversed, canvas)).guides[0]!
      .x1,
    102
  );
  assert.equal(
    snapPoint(1, 401, others, canvas, 1, { x: [2] }, index).guides[0]!.x1,
    0,
    'artboard wins a guide tie'
  );
});

test('distinct targets on a rounded equal-distance plateau retain original ordinal', () => {
  const largeCanvas = { w: 1e22, h: 1e22 };
  const others = Array.from({ length: 300 }, (_, i) => bounds(i + 1, i + 2, 0, 0));
  const index = createCanvasSnapIndex(others, largeCanvas);
  assert.ok(index);
  assert.equal(Math.abs(300 - 1e20), Math.abs(0 - 1e20));
  const expected = snapPoint(1e20, 1e20, others, largeCanvas, 1e20);
  assert.equal(expected.guides[0]!.x1, 0);
  assert.deepEqual(snapPoint(1e20, 1e20, others, largeCanvas, 1e20, {}, index), expected);
  for (const point of [-0, Number.MIN_VALUE, -Number.MIN_VALUE, -1e20, 1e20]) {
    assert.deepEqual(
      snapPoint(point, point, others, largeCanvas, 1e20, {}, index),
      snapPoint(point, point, others, largeCanvas, 1e20)
    );
  }
});

test('dense duplicate targets, reversed bounds and exact threshold boundaries match the linear path', () => {
  const others = Array.from({ length: 500 }, (_, i) =>
    bounds(i % 3 === 0 ? -0 : 20, i * 2, i % 2 ? -10 : 10, i % 3 ? -5 : 5)
  );
  const index = createCanvasSnapIndex(others, canvas);
  assert.ok(index);
  for (const px of [0, -0, 10, 15, 20, 25, 30, 34.99999999999999, 35, 35.00000000000001]) {
    for (const threshold of [0, -0, -1, 5, 10]) {
      assert.deepEqual(
        snapPoint(px, 73, others, canvas, threshold, {}, index),
        snapPoint(px, 73, others, canvas, threshold)
      );
      const active = bounds(px, 901, -10, -15);
      assert.deepEqual(
        snapMove(active, others, canvas, threshold, {}, index),
        snapMove(active, others, canvas, threshold)
      );
    }
  }
});

test('authored axis and angled guide edits are observed without rebuilding the object index', () => {
  const others = [bounds(140, 200)];
  const index = createCanvasSnapIndex(others, canvas);
  const lines: SnapLines = { x: [98], y: [299], angled: [{ x: 99, y: 299, rotation: 45 }] };
  for (let i = 0; i < 10; i++) {
    lines.x = [99 + i / 10];
    lines.angled = [{ x: 99, y: 299 + i / 10, rotation: i % 2 ? -45 : 45 }];
    assert.deepEqual(
      snapPoint(100, 300, others, canvas, 5, lines, index),
      snapPoint(100, 300, others, canvas, 5, lines)
    );
    assert.deepEqual(
      snapMove(bounds(100, 300), others, canvas, 5, lines, index),
      snapMove(bounds(100, 300), others, canvas, 5, lines)
    );
  }
});

test('oversized and nonfinite snapshots refuse indexing while public adapters preserve the old path', () => {
  const maxObjects = Math.floor((MAX_SNAP_INDEX_TARGETS - 3) / 3);
  const largest = createCanvasSnapIndex(
    Array.from({ length: maxObjects }, () => bounds(20, 30)),
    canvas
  );
  assert.ok(largest);
  assert.ok(largest.x.targets.length <= MAX_SNAP_INDEX_TARGETS);
  assert.ok(
    largest.x.tree.byteLength <= MAX_SNAP_INDEX_TARGETS * 2 * Uint32Array.BYTES_PER_ELEMENT
  );
  assert.ok(
    largest.y.tree.byteLength <= MAX_SNAP_INDEX_TARGETS * 2 * Uint32Array.BYTES_PER_ELEMENT
  );
  assert.equal(
    createCanvasSnapIndex(
      Array.from({ length: maxObjects + 1 }, () => bounds(20, 30)),
      canvas
    ),
    null
  );
  const malformed = [{ ...bounds(20, 30), minX: NaN }];
  assert.equal(createCanvasSnapIndex(malformed, canvas), null);
  assert.equal(
    createCanvasSnapIndex([bounds(Number.MAX_VALUE, 30, 0)], canvas),
    null,
    'overflowed centre uses the old path'
  );
  assert.equal(createCanvasSnapIndex([], { w: Infinity, h: 20 }), null);
  const others = [bounds(20, 30)];
  const index = createCanvasSnapIndex(others, canvas);
  for (const threshold of [NaN, Infinity, -Infinity]) {
    assert.deepEqual(
      snapPoint(19, 29, others, canvas, threshold, {}, index),
      snapPoint(19, 29, others, canvas, threshold)
    );
  }
  for (const active of [bounds(NaN, 30), bounds(Infinity, 20), bounds(Number.MAX_VALUE, 30, 0)])
    assert.deepEqual(
      snapMove(active, others, canvas, 5, {}, index),
      snapMove(active, others, canvas, 5)
    );
  const replacement = [bounds(103, 300)];
  assert.deepEqual(
    snapPoint(102, 299, replacement, canvas, 5, {}, index),
    snapPoint(102, 299, replacement, canvas, 5)
  );
  const resizedCanvas = { w: 205, h: 301 };
  assert.deepEqual(
    snapPoint(102, 299, others, resizedCanvas, 5, {}, index),
    snapPoint(102, 299, others, resizedCanvas, 5)
  );
  others.push(bounds(103, 300));
  assert.deepEqual(
    snapPoint(102, 299, others, canvas, 5, {}, index),
    snapPoint(102, 299, others, canvas, 5)
  );
});

test('gesture target adapter excludes hidden and selected boxes, retains locked boxes and uses zoom-scaled thresholds', () => {
  const fc = {
    cfg,
    frameCfg: { hiddenField: 'hidden' },
    stage: { metrics: () => ({ scale: 2 }) },
  } as unknown as FcCtx;
  const rows = [
    { x: 100, y: 100, w: 10, h: 10, hidden: true },
    { x: 200, y: 200, w: 10, h: 10, locked: true },
    { x: 300, y: 300, w: 10, h: 10 },
  ];
  const others = otherAABBs(fc, rows, new Set([2])) as AABB[];
  assert.deepEqual(others, [boxAABB(rows[1]!, cfg)]);
  const index = createCanvasSnapIndex(others, canvas);
  const threshold = snapThreshNative(fc);
  assert.deepEqual(
    snapPoint(201, 211, others, canvas, threshold, {}, index),
    snapPoint(201, 211, others, canvas, threshold)
  );
  assert.equal(snapPoint(101, 401, others, canvas, threshold, {}, index).x, 101);
});

test('steady indexed queries read no sibling bounds after gesture preparation', () => {
  let reads = 0;
  const others = Array.from({ length: 1000 }, (_, i) => {
    const box = bounds(i * 2, i * 3);
    for (const field of ['minX', 'minY', 'maxX', 'maxY'] as const) {
      const value = box[field];
      Object.defineProperty(box, field, {
        get: () => {
          reads++;
          return value;
        },
      });
    }
    return box;
  });
  const index = createCanvasSnapIndex(others, canvas);
  assert.ok(index);
  reads = 0;
  for (let i = 0; i < 100; i++) {
    snapPoint(i + 0.4, i * 2, others, canvas, 6, {}, index);
    snapMove(bounds(i + 0.4, i * 2), others, canvas, 6, {}, index);
  }
  assert.equal(reads, 0);
});

test('create, move and resize retain gesture snapshots, Alt/grid precedence and layout readiness gates', () => {
  const dom = new JSDOM('<body></body>');
  const previousDocument = globalThis.document;
  const previousRaf = globalThis.requestAnimationFrame;
  globalThis.document = dom.window.document;
  globalThis.requestAnimationFrame = () => 1;
  try {
    function fixture(
      type: 'create' | 'move' | 'resize',
      grid: boolean,
      lines: SnapLines,
      ready = true
    ) {
      const others = [bounds(98, 65), bounds(165, 95)];
      const row = { id: 'active', x: 20, y: 20, w: 40, h: 30 };
      let canvasReads = 0;
      const fc = {
        cfg,
        runtime: {},
        minSize: 1,
        disposed: false,
        gridOn: grid,
        canvasEl: { setPointerCapture: () => {} },
        stageEl: document.createElement('div'),
        rubber: document.createElement('div'),
        guidesEl: document.createElement('div'),
        opts: {},
        layout: { gestureReady: () => ready },
        edges: { setHoverEdge: () => {} },
        textEdit: { setFramesClipped: () => {} },
        helpers: {
          canvasWH: () => {
            canvasReads++;
            return canvas;
          },
        },
        authoringGuides: { snapTargets: () => lines },
        select: { getBoxes: () => [row], idOf: () => 'active' },
        fieldPanels: { isCircle: () => false },
        stage: {
          clientToNative: (x: number, y: number) => ({ x, y }),
          nativeToStage: (x: number, y: number) => ({ x, y }),
          metrics: () => ({ scale: 2 }),
          gridRound: (n: number) => Math.round(n / 10) * 10,
          liveBoxEl: () => null,
          hideCamHud: () => {},
        },
        chromeSync: { renderChromeLive: () => {}, renderChrome: () => {} },
        connectors: { liveConnUpdate: () => {} },
      } as unknown as FcCtx;
      const init = {
        type,
        others,
        origin: { x: 0, y: 0 },
        seed: {},
        index: 0,
        handle: 'se',
        startRect: { x: 20, y: 20, w: 40, h: 30, rot: 0 },
        sel: [0],
        start: new Map([[0, { x: 20, y: 20, w: 40, h: 30 }]]),
        selAABB: bounds(20, 20, 40, 30),
      } as GestureInit;
      beginGesture(fc, { pointerId: 1, clientX: 0, clientY: 0 } as PointerEvent, init);
      return { fc, canvasReads: () => canvasReads };
    }
    for (const type of ['create', 'move', 'resize'] as const) {
      for (const grid of [false, true])
        for (const altKey of [false, true]) {
          const lines = { x: [99], y: [64], angled: [{ x: 98, y: 65, rotation: 37 }] };
          const indexed = fixture(type, grid, lines);
          const legacy = fixture(type, grid, lines);
          let snapshot: CanvasSnapIndex | null | undefined;
          assert.equal(indexed.fc.gesture!.snapIndex, undefined);
          assert.equal(indexed.canvasReads(), 0, 'pressing does not construct an index');
          legacy.fc.gesture!.snapIndex = null;
          for (const [clientX, clientY] of [
            [97.9, 64.8],
            [111.2, 82.4],
          ]) {
            const event = {
              pointerId: 1,
              clientX,
              clientY,
              altKey,
              shiftKey: false,
            } as PointerEvent;
            applyGestureMove(indexed.fc, event);
            applyGestureMove(legacy.fc, event);
            if (type === 'create' || !altKey) {
              assert.ok(indexed.fc.gesture!.snapIndex);
              snapshot ??= indexed.fc.gesture!.snapIndex;
            }
            assert.strictEqual(
              indexed.fc.gesture!.snapIndex,
              snapshot,
              'one prepared index per gesture'
            );
            assert.deepEqual({ ...indexed.fc.gesture, snapIndex: null }, legacy.fc.gesture);
            assert.equal(indexed.fc.guidesEl.innerHTML, legacy.fc.guidesEl.innerHTML);
            assert.equal(indexed.fc.rubber.style.cssText, legacy.fc.rubber.style.cssText);
          }
          endGesture(indexed.fc, true);
          endGesture(legacy.fc, true);
          assert.equal(indexed.fc.gesture, null);
        }
    }
    const blocked = fixture('move', false, {}, false);
    assert.equal(blocked.fc.gesture, undefined);
    assert.equal(blocked.canvasReads(), 0, 'pending layout blocks preparation and preview');
    const click = fixture('move', false, {});
    endGesture(click.fc, true);
    assert.equal(click.canvasReads(), 0, 'a click releases without constructing an index');
    const rotated = fixture('resize', false, {});
    if (rotated.fc.gesture?.type === 'resize') rotated.fc.gesture.startRect.rot = 30;
    applyGestureMove(rotated.fc, {
      pointerId: 1,
      clientX: 111,
      clientY: 82,
      altKey: false,
    } as PointerEvent);
    assert.equal(rotated.fc.gesture!.snapIndex, undefined);
    assert.equal(rotated.canvasReads(), 0, 'rotated resize does not use axis snapping');
    endGesture(rotated.fc, true);
  } finally {
    globalThis.document = previousDocument;
    globalThis.requestAnimationFrame = previousRaf;
    dom.window.close();
  }
});
