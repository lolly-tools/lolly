/**
 * Pure-logic tests for the web shell's free-canvas (WYSIWYG "editor" layout)
 * geometry helpers (shells/web/src/views/free-canvas-math.js). These guard the
 * rotation-aware resize/hit-test algebra and the align/distribute/z-order ops
 * that the direct-manipulation overlay commits back to a flat `blocks` array —
 * the parts most likely to silently drift a layout.
 *
 * Run with: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  num, boxRect, withRect, boxAABB, boxCorners, hitTest, marqueeHit,
  moveBoxes, resizeRect, alignBoxes, distributeBoxes, reorderZ,
  seedBox, normDragRect, snapAngle, clampBoxToCanvas, selectionAABB,
  snapMove, snapPoint,
} from '../shells/web/src/views/free-canvas-math.js';

const CFG = {
  idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
};

const box = (o) => ({ x: 0, y: 0, w: 100, h: 100, rot: 0, ...o });
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('num coerces stringy URL-roundtripped fields', () => {
  assert.equal(num('42'), 42);
  assert.equal(num(7), 7);
  assert.equal(num('', 5), 5);
  assert.equal(num('nope', 3), 3);
  assert.equal(num(undefined, 9), 9);
});

test('boxRect reads numbers tolerant of strings and floors w/h at 0', () => {
  const r = boxRect({ x: '10', y: '20', w: '30', h: '-5', rot: '15' }, CFG);
  assert.deepEqual(r, { x: 10, y: 20, w: 30, h: 0, rot: 15 });
});

test('withRect rounds and only writes provided fields', () => {
  const b = withRect(box(), { x: 10.4, w: 55.6 }, CFG);
  assert.equal(b.x, 10);
  assert.equal(b.w, 56);
  assert.equal(b.y, 0); // unchanged original
});

test('boxAABB of an unrotated box is its rect', () => {
  const a = boxAABB(box({ x: 5, y: 7, w: 40, h: 20 }), CFG);
  assert.deepEqual([a.minX, a.minY, a.maxX, a.maxY], [5, 7, 45, 27]);
});

test('boxAABB of a 45°-rotated square grows by √2', () => {
  const a = boxAABB(box({ x: 0, y: 0, w: 100, h: 100, rot: 45 }), CFG);
  near(a.w, 100 * Math.SQRT2, 1e-4);
  near(a.h, 100 * Math.SQRT2, 1e-4);
  near((a.minX + a.maxX) / 2, 50, 1e-4); // centre preserved
});

test('hitTest returns the topmost (last) box under a point', () => {
  const boxes = [box({ x: 0, y: 0, w: 100, h: 100 }), box({ x: 50, y: 50, w: 100, h: 100 })];
  assert.equal(hitTest(boxes, 75, 75, CFG), 1); // overlap → top wins
  assert.equal(hitTest(boxes, 10, 10, CFG), 0);
  assert.equal(hitTest(boxes, 400, 400, CFG), -1);
});

test('hitTest honours rotation (corner of the unrotated rect is outside once spun)', () => {
  const boxes = [box({ x: 0, y: 0, w: 100, h: 100, rot: 45 })];
  // (2,2) is inside the axis-aligned rect but outside the 45°-rotated diamond.
  assert.equal(hitTest(boxes, 2, 2, CFG), -1);
  // centre is always inside.
  assert.equal(hitTest(boxes, 50, 50, CFG), 0);
});

test('resizeRect se-drag keeps the opposite (nw) corner fixed, unrotated', () => {
  const start = { x: 0, y: 0, w: 100, h: 100, rot: 0 };
  const r = resizeRect(start, 'se', 50, 20, { minSize: 8 });
  assert.deepEqual([r.x, r.y, r.w, r.h], [0, 0, 150, 120]);
});

test('resizeRect nw-drag keeps the se corner fixed, unrotated', () => {
  const start = { x: 0, y: 0, w: 100, h: 100, rot: 0 };
  const r = resizeRect(start, 'nw', 10, 10, { minSize: 8 });
  assert.deepEqual([r.x, r.y, r.w, r.h], [10, 10, 90, 90]);
});

test('resizeRect respects minSize', () => {
  const start = { x: 0, y: 0, w: 100, h: 100, rot: 0 };
  const r = resizeRect(start, 'se', -200, -200, { minSize: 8 });
  assert.equal(r.w, 8);
  assert.equal(r.h, 8);
});

test('resizeRect on a ROTATED box preserves the fixed world corner', () => {
  const start = { x: 100, y: 100, w: 120, h: 80, rot: 30 };
  // The corner opposite 'se' is 'nw' == TL == corners[0].
  const before = boxCorners(box(start), CFG)[0];
  const r = resizeRect(start, 'se', 40, -15, { minSize: 8 });
  // Compare raw (unrounded) corners — withRect's whole-px rounding would shift a
  // rotated box's corner by up to ~0.5px, which is expected quantisation, not drift.
  const after = boxCorners({ x: r.x, y: r.y, w: r.w, h: r.h, rot: start.rot }, CFG)[0];
  near(after.x, before.x, 1e-6);
  near(after.y, before.y, 1e-6);
});

test('resizeRect keepAspect on a corner holds the start aspect ratio', () => {
  const start = { x: 0, y: 0, w: 200, h: 100, rot: 0 };
  const r = resizeRect(start, 'se', 100, 5, { minSize: 8, keepAspect: true });
  near(r.w / r.h, 2, 1e-6);
});

test('moveBoxes shifts only the selected indices', () => {
  const boxes = [box({ id: 'a' }), box({ id: 'b', x: 10 })];
  const next = moveBoxes(boxes, [1], 5, -3, CFG);
  assert.equal(next[0].x, 0);
  assert.equal(next[1].x, 15);
  assert.equal(next[1].y, -3);
  assert.notEqual(next, boxes); // new array
});

test('alignBoxes single box aligns to the artboard edges', () => {
  const boxes = [box({ x: 10, y: 10, w: 100, h: 100 })];
  const canvas = { w: 1000, h: 1000 };
  assert.equal(alignBoxes(boxes, [0], 'left', CFG, canvas)[0].x, 0);
  assert.equal(alignBoxes(boxes, [0], 'right', CFG, canvas)[0].x, 900);
  assert.equal(alignBoxes(boxes, [0], 'hcentre', CFG, canvas)[0].x, 450);
});

test('alignBoxes multi aligns to the selection bbox', () => {
  const boxes = [
    box({ id: 'a', x: 0, y: 0, w: 50, h: 50 }),
    box({ id: 'b', x: 200, y: 100, w: 50, h: 50 }),
  ];
  const out = alignBoxes(boxes, [0, 1], 'left', CFG, { w: 999, h: 999 });
  assert.equal(out[0].x, 0);
  assert.equal(out[1].x, 0); // both to the selection's left edge (minX = 0)
});

test('distributeBoxes equalises gaps along the horizontal axis', () => {
  const boxes = [
    box({ id: 'a', x: 0, w: 50, h: 50 }),
    box({ id: 'b', x: 100, w: 50, h: 50 }),
    box({ id: 'c', x: 500, w: 50, h: 50 }),
  ];
  const out = distributeBoxes(boxes, [0, 1, 2], 'h', CFG);
  assert.equal(out[0].x, 0);   // extremes fixed
  assert.equal(out[2].x, 500);
  assert.equal(out[1].x, 250); // (span 550 - sizes 150)/2 = 200 gap → 0+50+200
});

test('distributeBoxes needs at least 3 boxes', () => {
  const boxes = [box({ id: 'a' }), box({ id: 'b', x: 100 })];
  assert.equal(distributeBoxes(boxes, [0, 1], 'h', CFG), boxes);
});

test('reorderZ front/back/forward/backward', () => {
  const ids = (arr) => arr.map((b) => b.id).join('');
  const boxes = ['A', 'B', 'C', 'D'].map((id) => box({ id }));
  assert.equal(ids(reorderZ(boxes, [1], 'front')), 'ACDB');
  assert.equal(ids(reorderZ(boxes, [1], 'back')), 'BACD');
  assert.equal(ids(reorderZ(boxes, [1], 'forward')), 'ACBD');
  assert.equal(ids(reorderZ(boxes, [1], 'backward')), 'BACD');
  // multi-select front keeps relative order
  assert.equal(ids(reorderZ(boxes, [0, 2], 'front')), 'BDAC');
});

test('marqueeHit selects boxes whose AABB intersects', () => {
  const boxes = [
    box({ id: 'a', x: 0, y: 0, w: 40, h: 40 }),
    box({ id: 'b', x: 200, y: 200, w: 40, h: 40 }),
  ];
  assert.deepEqual(marqueeHit(boxes, { x: -10, y: -10, w: 60, h: 60 }, CFG), [0]);
  assert.deepEqual(marqueeHit(boxes, { x: -10, y: -10, w: 300, h: 300 }, CFG), [0, 1]);
  assert.deepEqual(marqueeHit(boxes, { x: 500, y: 500, w: 10, h: 10 }, CFG), []);
});

test('seedBox merges defaults + kind seed + rect + id', () => {
  const b = seedBox(CFG, { bg: '#fff', rot: 0 }, { bg: '#30BA78', text: 'Hi' }, { x: 5.4, y: 6.6, w: 100, h: 50 }, 'z1');
  assert.equal(b.id, 'z1');
  assert.equal(b.bg, '#30BA78'); // kind overrides default
  assert.equal(b.text, 'Hi');
  assert.deepEqual([b.x, b.y, b.w, b.h], [5, 7, 100, 50]);
});

test('normDragRect normalises a bottom-up/right-left drag with a floor', () => {
  assert.deepEqual(normDragRect(100, 100, 40, 30, 8), { x: 40, y: 30, w: 60, h: 70 });
  assert.deepEqual(normDragRect(10, 10, 12, 11, 8), { x: 10, y: 10, w: 8, h: 8 }); // floored
});

test('snapAngle snaps within tolerance only', () => {
  assert.equal(snapAngle(91, 15, 4), 90);
  assert.equal(snapAngle(97, 15, 4), 97); // 7° away from 90/105 → no snap
  assert.equal(snapAngle(0.5, 15, 4), 0);
});

test('clampBoxToCanvas keeps the centre on the artboard', () => {
  const b = clampBoxToCanvas(box({ x: -400, y: 10, w: 100, h: 100 }), CFG, { w: 1000, h: 1000 });
  // centre was (-350,60) → x clamped so centre.x = 0
  assert.equal(b.x, -50);
  assert.equal(b.y, 10); // y already in range
});

test('snapMove snaps a near edge to a sibling edge and emits a guide', () => {
  const active = { minX: 203, minY: 100, maxX: 303, maxY: 200 };   // left edge 3px off 200
  const others = [{ minX: 200, minY: 400, maxX: 300, maxY: 500 }]; // sibling left at 200
  const s = snapMove(active, others, { w: 1000, h: 1000 }, 6);
  assert.equal(s.dx, -3);            // pull left edge to 200
  assert.equal(s.dy, 0);             // nothing within 6px vertically
  assert.ok(s.guides.some(g => g.x1 === 200 && g.x2 === 200));
});

test('snapMove snaps centre to the artboard centre', () => {
  const active = { minX: 402, minY: 402, maxX: 602, maxY: 602 };   // centre (502,502)
  const s = snapMove(active, [], { w: 1000, h: 1000 }, 6);
  assert.equal(s.dx, -2);            // centre 502 → 500
  assert.equal(s.dy, -2);
});

test('snapMove ignores targets beyond the threshold', () => {
  const active = { minX: 220, minY: 220, maxX: 320, maxY: 320 };
  const s = snapMove(active, [{ minX: 200, minY: 200, maxX: 300, maxY: 300 }], { w: 1000, h: 1000 }, 6);
  assert.equal(s.dx, 0);
  assert.equal(s.dy, 0);
  assert.equal(s.guides.length, 0);
});

test('snapPoint snaps a pointer to a sibling right edge', () => {
  const s = snapPoint(298, 55, [{ minX: 100, minY: 40, maxX: 300, maxY: 90 }], { w: 1000, h: 1000 }, 6);
  assert.equal(s.x, 300);            // 298 → sibling maxX 300
  assert.equal(s.y, 55);             // no y target near
  assert.ok(s.guides.some(g => g.x1 === 300));
});

test('selectionAABB unions rotated boxes', () => {
  const boxes = [box({ x: 0, y: 0, w: 100, h: 100 }), box({ x: 300, y: 0, w: 100, h: 100 })];
  const a = selectionAABB(boxes, [0, 1], CFG);
  assert.deepEqual([a.minX, a.maxX], [0, 400]);
});
