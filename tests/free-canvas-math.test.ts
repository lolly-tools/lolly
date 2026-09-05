// SPDX-License-Identifier: MPL-2.0
/**
 * Pure-logic tests for the web shell's free-canvas (WYSIWYG "editor" layout)
 * geometry helpers (shells/web/src/views/free-canvas-math.ts). These guard the
 * rotation-aware resize/hit-test algebra and the align/distribute/z-order ops
 * that the direct-manipulation overlay commits back to a flat `blocks` array - 
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
  snapMove, snapPoint, scaleGroup, rotateGroup,
  gradientLine, gradientPosAt, gradientAngleAt,
  resolveFrame, frameLocalXY, cascadeFrameMove, seedFrameOrder, renumberFrameOrder,
  framesInPageOrder, activeFrameIdFor, nextFrameOrder, seedFrameOrders,
  rehomeChildrenOfDeletedFrames, duplicateFrameWithChildren, filterMarqueeFrames,
  sequenceFramesInOrder, framesAreSequenced,
  parseDashArray, formatDashArray, DASH_ARRAY_MAX,
  routedLineSvg, pathRouteStyle, isConnectorRouteStyle, CONNECTOR_ROUTE_STYLES,
  edgeWaypoints, buildConnectorSvg,
  pathEndTangents, pathEndPoints,
  liftRows, applyLift, liftDepths, liftSlots, liftCanCrop, LIFT_EFF_STEP, LIFT_EFF_CEIL, LIFT_STRENGTH,
  layoutArtboards,
  posedRect,
} from '../shells/web/src/views/free-canvas-math.ts';
import type { SeqPose } from '../shells/web/src/views/free-canvas-math.ts';
import { KF_Z_FIELD_CLAMP, depthForEff } from '../engine/src/keyframes.ts';

const CFG: any = {
  idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
};

const box = (o: any = {}): any => ({ x: 0, y: 0, w: 100, h: 100, rot: 0, ...o });
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

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

// ── posedRect: the selection chrome under a playhead (plans/104 section 9.15) ─────
//
// The bug this pins: a box scaled/moved by the keyframe system rendered at its posed
// geometry while the outline and all eight handles drew at the AUTHORED rect, so the
// user was offered editing controls over empty canvas. The chrome now maps the model
// rect through the pose the applier published, and this is that map.

/** A neutral pose, so each case below changes exactly one thing. */
const pose = (o: Partial<SeqPose> = {}): SeqPose =>
  ({ dx: 0, dy: 0, sc: 1, rot: 0, w: 0, h: 0, sized: false, ...o });

test('posedRect: no pose hands back the SAME object (the byte-identity floor)', () => {
  const r = { x: 10, y: 20, w: 100, h: 50, rot: 12 };
  assert.equal(posedRect(r, null), r, 'an untimed board is placed by the identical expressions');
  assert.equal(posedRect(r, undefined), r);
  assert.equal(posedRect(r, pose()), r, 'and so is a box at rest inside a projecting stage');
});

test('posedRect: a keyframe scale grows the rect ABOUT ITS CENTRE', () => {
  const r = { x: 100, y: 100, w: 200, h: 100, rot: 0 };
  const p = posedRect(r, pose({ sc: 1.5 }));
  assert.deepEqual(p, { x: 50, y: 75, w: 300, h: 150, rot: 0 });
  // The centre is the invariant - it is what CSS `transform-origin: 50% 50%` means,
  // and getting it wrong is exactly the "offset up-left" the report describes.
  assert.deepEqual([p.x + p.w / 2, p.y + p.h / 2], [200, 150]);
});

test('posedRect: the translate is OUTSIDE the scale, and rotation ADDS to the authored one', () => {
  const r = { x: 0, y: 0, w: 100, h: 100, rot: 15 };
  // A CSS list of `translate(dx,dy) rotate(auth) rotate(kf) scale(sc)` multiplies out
  // to scale-then-rotate about the centre, then translate in the PARENT's space - so
  // the offset is never magnified by the scale.
  const p = posedRect(r, pose({ dx: 40, dy: -20, sc: 2, rot: 30 }));
  assert.deepEqual([p.x + p.w / 2, p.y + p.h / 2], [90, 30]);
  assert.deepEqual([p.w, p.h], [200, 200]);
  assert.equal(p.rot, 45, 'authored 15° + keyed 30°');
});

test('posedRect: a KEYED size replaces the box\'s own and moves the centre with it', () => {
  // The applier writes `width`/`height` while `left`/`top` stay authored, so the box
  // grows from its top-left and the pivot moves by half the growth - the same half
  // `foldKfPose` anchors the projection on, which is why `dx`/`dy` are measured from
  // the grown centre rather than the authored one.
  const r = { x: 200, y: 100, w: 640, h: 360, rot: 0 };
  const p = posedRect(r, pose({ w: 1280, h: 360, sized: true }));
  assert.deepEqual(p, { x: 200, y: 100, w: 1280, h: 360, rot: 0 });
  assert.deepEqual([p.x + p.w / 2, p.y + p.h / 2], [840, 280], 'centre moved by half the growth');
  // …and an UNSIZED pose ignores the w/h it carries, which is the authored size anyway.
  assert.deepEqual(posedRect(r, pose({ w: 1280, h: 360, sized: false })), r);
});

test('posedRect: junk in a pose degrades to the authored rect, never to NaN', () => {
  const r = { x: 10, y: 20, w: 100, h: 50, rot: 0 };
  assert.deepEqual(posedRect(r, pose({ sc: Number.NaN, dx: Number.POSITIVE_INFINITY })), r);
  // A collapsed scale is honest (the box really is invisible), but never negative.
  const zero = posedRect(r, pose({ sc: 0 }));
  assert.deepEqual([zero.w, zero.h], [0, 0]);
  assert.deepEqual([zero.x, zero.y], [60, 45], 'still centred where the box is');
});

test('hitTest/marqueeHit skip predicate: excluded boxes fall through', () => {
  const boxes = [
    { id: 'under', x: 0, y: 0, w: 100, h: 100 },
    { id: 'over', x: 0, y: 0, w: 100, h: 100 },
  ] as never[];
  // Without skip the top box wins; skipping it the click falls through.
  assert.equal(hitTest(boxes, 50, 50, CFG), 1);
  assert.equal(hitTest(boxes, 50, 50, CFG, (i) => i === 1), 0);
  assert.equal(hitTest(boxes, 50, 50, CFG, () => true), -1);
  assert.deepEqual(marqueeHit(boxes, { x: 0, y: 0, w: 100, h: 100 }, CFG, (i) => i === 1), [0]);
  // No skip argument stays byte-identical to the historical behaviour.
  assert.deepEqual(marqueeHit(boxes, { x: 0, y: 0, w: 100, h: 100 }, CFG), [0, 1]);
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
  const before: any = boxCorners(box(start), CFG)[0];
  const r = resizeRect(start, 'se', 40, -15, { minSize: 8 });
  // Compare raw (unrounded) corners - withRect's whole-px rounding would shift a
  // rotated box's corner by up to ~0.5px, which is expected quantisation, not drift.
  const after: any = boxCorners({ x: r.x, y: r.y, w: r.w, h: r.h, rot: start.rot }, CFG)[0];
  near(after.x, before.x, 1e-6);
  near(after.y, before.y, 1e-6);
});

test('resizeRect keepAspect on a corner holds the start aspect ratio', () => {
  const start = { x: 0, y: 0, w: 200, h: 100, rot: 0 };
  const r = resizeRect(start, 'se', 100, 5, { minSize: 8, keepAspect: true });
  near(r.w / r.h, 2, 1e-6);
});

// A CIRCLE box (Design) resizes with keepAspect forced on, starting square, so
// every handle - corner AND edge - must keep w === h. An edge handle drives the other
// axis from the dragged one; without that a side-drag would flatten the circle.
test('resizeRect keepAspect keeps a square square on a corner drag (circle invariant)', () => {
  const r = resizeRect({ x: 0, y: 0, w: 300, h: 300, rot: 0 }, 'se', 120, 40, { minSize: 8, keepAspect: true });
  near(r.w, r.h, 1e-6);
});

test('resizeRect keepAspect keeps a square square on an EDGE drag (circle invariant)', () => {
  const east = resizeRect({ x: 0, y: 0, w: 300, h: 300, rot: 0 }, 'e', 90, 0, { minSize: 8, keepAspect: true });
  near(east.w, east.h, 1e-6);
  const south = resizeRect({ x: 0, y: 0, w: 300, h: 300, rot: 0 }, 's', 0, -70, { minSize: 8, keepAspect: true });
  near(south.w, south.h, 1e-6);
});

test('moveBoxes shifts only the selected indices', () => {
  const boxes = [box({ id: 'a' }), box({ id: 'b', x: 10 })];
  const next: any = moveBoxes(boxes, [1], 5, -3, CFG);
  assert.equal(next[0].x, 0);
  assert.equal(next[1].x, 15);
  assert.equal(next[1].y, -3);
  assert.notEqual(next, boxes); // new array
});

test('alignBoxes single box aligns to the artboard edges', () => {
  const boxes = [box({ x: 10, y: 10, w: 100, h: 100 })];
  const canvas = { w: 1000, h: 1000 };
  assert.equal((alignBoxes(boxes, [0], 'left', CFG, canvas) as any)[0].x, 0);
  assert.equal((alignBoxes(boxes, [0], 'right', CFG, canvas) as any)[0].x, 900);
  assert.equal((alignBoxes(boxes, [0], 'hcentre', CFG, canvas) as any)[0].x, 450);
});

test('alignBoxes multi aligns to the selection bbox', () => {
  const boxes = [
    box({ id: 'a', x: 0, y: 0, w: 50, h: 50 }),
    box({ id: 'b', x: 200, y: 100, w: 50, h: 50 }),
  ];
  const out: any = alignBoxes(boxes, [0, 1], 'left', CFG, { w: 999, h: 999 });
  assert.equal(out[0].x, 0);
  assert.equal(out[1].x, 0); // both to the selection's left edge (minX = 0)
});

test('distributeBoxes equalises gaps along the horizontal axis', () => {
  const boxes = [
    box({ id: 'a', x: 0, w: 50, h: 50 }),
    box({ id: 'b', x: 100, w: 50, h: 50 }),
    box({ id: 'c', x: 500, w: 50, h: 50 }),
  ];
  const out: any = distributeBoxes(boxes, [0, 1, 2], 'h', CFG);
  assert.equal(out[0].x, 0);   // extremes fixed
  assert.equal(out[2].x, 500);
  assert.equal(out[1].x, 250); // (span 550 - sizes 150)/2 = 200 gap → 0+50+200
});

test('distributeBoxes needs at least 3 boxes', () => {
  const boxes = [box({ id: 'a' }), box({ id: 'b', x: 100 })];
  assert.equal(distributeBoxes(boxes, [0, 1], 'h', CFG), boxes);
});

test('reorderZ front/back/forward/backward', () => {
  const ids = (arr: any[]) => arr.map((b) => b.id).join('');
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
  const b: any = seedBox(CFG, { bg: '#fff', rot: 0 }, { bg: '#30BA78', text: 'Hi' }, { x: 5.4, y: 6.6, w: 100, h: 50 } as any, 'z1');
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
  const s = snapMove(active as any, others as any, { w: 1000, h: 1000 }, 6);
  assert.equal(s.dx, -3);            // pull left edge to 200
  assert.equal(s.dy, 0);             // nothing within 6px vertically
  assert.ok(s.guides.some((g: any) => g.x1 === 200 && g.x2 === 200));
});

test('snapMove snaps centre to the artboard centre', () => {
  const active = { minX: 402, minY: 402, maxX: 602, maxY: 602 };   // centre (502,502)
  const s = snapMove(active as any, [], { w: 1000, h: 1000 }, 6);
  assert.equal(s.dx, -2);            // centre 502 → 500
  assert.equal(s.dy, -2);
});

test('snapMove ignores targets beyond the threshold', () => {
  const active = { minX: 220, minY: 220, maxX: 320, maxY: 320 };
  const s = snapMove(active as any, [{ minX: 200, minY: 200, maxX: 300, maxY: 300 }] as any, { w: 1000, h: 1000 }, 6);
  assert.equal(s.dx, 0);
  assert.equal(s.dy, 0);
  assert.equal(s.guides.length, 0);
});

test('snapPoint snaps a pointer to a sibling right edge', () => {
  const s = snapPoint(298, 55, [{ minX: 100, minY: 40, maxX: 300, maxY: 90 }] as any, { w: 1000, h: 1000 }, 6);
  assert.equal(s.x, 300);            // 298 → sibling maxX 300
  assert.equal(s.y, 55);             // no y target near
  assert.ok(s.guides.some((g: any) => g.x1 === 300));
});

test('persistent ruler guides join move and point snap targets', () => {
  const active = { minX: 247, minY: 100, maxX: 347, maxY: 200 };
  const moved = snapMove(active as any, [], { w: 1000, h: 1000 }, 6, { x: [250] });
  assert.equal(moved.dx, 3);
  assert.ok(moved.guides.some((g: any) => g.x1 === 250 && g.x2 === 250));

  const point = snapPoint(20, 397, [], { w: 1000, h: 1000 }, 6, { y: [400] });
  assert.equal(point.y, 400);
  assert.ok(point.guides.some((g: any) => g.y1 === 400 && g.y2 === 400));
});

const GCFG: any = { ...CFG, fontSizeField: 'fontSize', radiusField: 'radius' };

test('scaleGroup scales positions + sizes about the anchor, keeping the anchor fixed', () => {
  const boxes = [
    box({ id: 'a', x: 100, y: 100, w: 100, h: 100 }),
    box({ id: 'b', x: 300, y: 100, w: 100, h: 100, fontSize: 40, radius: 20 }),
  ];
  const anchor = { x: 100, y: 100 };            // top-left of box a
  const out: any = scaleGroup(boxes, [0, 1], anchor, 2, GCFG);
  // a's centre (150,150) → anchor + 2*(50,50) = (200,200); size 200 → x=100,y=100
  assert.deepEqual([out[0].x, out[0].y, out[0].w, out[0].h], [100, 100, 200, 200]);
  // b's centre (350,150) → (100,100)+2*(250,50)=(600,200); size 200 → x=500,y=100
  assert.deepEqual([out[1].x, out[1].y, out[1].w, out[1].h], [500, 100, 200, 200]);
  assert.equal(out[1].fontSize, 80);            // text scaled
  assert.equal(out[1].radius, 40);              // radius scaled
});

test('rotateGroup rotates member centres about the pivot and adds to each rotation', () => {
  const boxes = [box({ id: 'a', x: 100, y: -50, w: 100, h: 100, rot: 10 })]; // centre (150,0)
  const out: any = rotateGroup(boxes, [0], { x: 0, y: 0 }, 90, CFG);
  // centre (150,0) rotated +90° (screen, clockwise) → (0,150); box x=-50,y=100
  const c = { x: out[0].x + out[0].w / 2, y: out[0].y + out[0].h / 2 };
  near(c.x, 0, 1e-6); near(c.y, 150, 1e-6);
  assert.equal(out[0].rot, 100);                // 10 + 90
});

test('selectionAABB unions rotated boxes', () => {
  const boxes = [box({ x: 0, y: 0, w: 100, h: 100 }), box({ x: 300, y: 0, w: 100, h: 100 })];
  const a: any = selectionAABB(boxes, [0, 1], CFG);
  assert.deepEqual([a.minX, a.maxX], [0, 400]);
});

// ── on-canvas gradient geometry ──────────────────────────────────────────────

// Trig lands these a float-epsilon off exact integers; compare with a tolerance
// rather than pinning the noise.
const nearPt = (got: { x: number; y: number }, x: number, y: number, msg: string): void => {
  assert.ok(Math.abs(got.x - x) < 1e-6 && Math.abs(got.y - y) < 1e-6,
    `${msg}: expected ~(${x}, ${y}), got (${got.x}, ${got.y})`);
};

test('gradientLine: 0deg runs bottom→top through the centre', () => {
  const { from, to } = gradientLine(200, 100, 0);
  nearPt(from, 100, 100, 'starts at the BOTTOM edge');
  nearPt(to, 100, 0, 'ends at the top');
});

test('gradientLine: 90deg runs left→right', () => {
  const { from, to } = gradientLine(200, 100, 90);
  nearPt(from, 0, 50, 'from');
  nearPt(to, 200, 50, 'to');
});

test('gradientLine: 180deg is `to bottom`, the CSS default', () => {
  const { from, to } = gradientLine(200, 100, 180);
  nearPt(from, 100, 0, 'from');
  nearPt(to, 100, 100, 'to');
});

test('gradientLine: a 45deg line is the CSS projection length, not the diagonal', () => {
  // |w·sin45| + |h·cos45| for a 100×100 box = 141.42; the diagonal is the same
  // here, so use a rectangle where they differ: 200×100 → 212.13 vs a 223.6 diagonal.
  const { from, to } = gradientLine(200, 100, 45);
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  assert.ok(Math.abs(len - 212.13) < 0.05, `projection length, got ${len.toFixed(2)}`);
  assert.ok(Math.abs(len - Math.hypot(200, 100)) > 10, 'and not the diagonal');
  // Still centred.
  assert.ok(Math.abs((from.x + to.x) / 2 - 100) < 1e-9);
  assert.ok(Math.abs((from.y + to.y) / 2 - 50) < 1e-9);
});

test('gradientLine: the angle wraps', () => {
  for (const equivalent of [450, -270]) {
    const a = gradientLine(200, 100, equivalent);
    const b = gradientLine(200, 100, 90);
    nearPt(a.from, b.from.x, b.from.y, `${equivalent}° from`);
    nearPt(a.to, b.to.x, b.to.y, `${equivalent}° to`);
  }
});

test('gradientPosAt: the ends read 0 and 100, the centre 50', () => {
  const { from, to } = gradientLine(200, 100, 90);
  assert.equal(gradientPosAt(200, 100, 90, from.x, from.y), 0);
  assert.equal(gradientPosAt(200, 100, 90, to.x, to.y), 100);
  assert.equal(gradientPosAt(200, 100, 90, 100, 50), 50);
});

test('gradientPosAt: a point off the line projects onto it rather than stalling', () => {
  // 40px above the line at 90deg: the along-line component still reads 25%.
  assert.equal(gradientPosAt(200, 100, 90, 50, 10), 25);
  assert.equal(gradientPosAt(200, 100, 90, 50, 90), 25);
});

test('gradientPosAt: past the ends clamps', () => {
  assert.equal(gradientPosAt(200, 100, 90, -500, 50), 0);
  assert.equal(gradientPosAt(200, 100, 90, 900, 50), 100);
});

test('gradientAngleAt: inverts gradientLine, so a drag to the end reproduces the angle', () => {
  for (const deg of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const { to } = gradientLine(200, 100, deg);
    const back = gradientAngleAt(200, 100, to.x, to.y);
    assert.ok(Math.abs(((back - deg + 540) % 360) - 180) < 1e-6, `${deg}° → ${back}°`);
  }
});

test('gradientAngleAt: snapping reaches the cardinals exactly', () => {
  assert.equal(gradientAngleAt(200, 100, 199, 1, 45), 45);
  assert.equal(gradientAngleAt(200, 100, 201, 51, 45), 90);
  assert.equal(gradientAngleAt(200, 100, 100, -50, 45), 0);
  // Unsnapped it keeps the real angle.
  assert.ok(Math.abs(gradientAngleAt(200, 100, 199, 1) - 45) > 5);
});

test('gradientAngleAt: the centre itself is not an angle', () => {
  assert.equal(gradientAngleAt(200, 100, 100, 50), 0);
});

// ── Frame primitive (plan 93 section 5/section 10) ─────────────────────────────────────────

test('resolveFrame: a box whose centre is inside a frame resolves to that frame', () => {
  const frames: any[] = [{ id: 'f1', kind: 'frame', x: 0, y: 0, w: 100, h: 100 }];
  const b: any = { id: 'b', kind: 'box', x: 40, y: 40, w: 20, h: 20 }; // centre (50,50)
  assert.equal(resolveFrame(b, frames), 'f1');
});

test('resolveFrame: when two frames overlap the centre, the later one (topmost) wins', () => {
  const frames: any[] = [
    { id: 'under', kind: 'frame', x: 0, y: 0, w: 200, h: 200 },
    { id: 'over', kind: 'frame', x: 0, y: 0, w: 200, h: 200 },
  ];
  const b: any = { id: 'b', kind: 'box', x: 90, y: 90, w: 20, h: 20 }; // centre (100,100)
  assert.equal(resolveFrame(b, frames), 'over');
});

test('resolveFrame: a centre outside every frame resolves to ""', () => {
  const frames: any[] = [{ id: 'f1', kind: 'frame', x: 0, y: 0, w: 100, h: 100 }];
  const b: any = { id: 'b', kind: 'box', x: 500, y: 500, w: 20, h: 20 };
  assert.equal(resolveFrame(b, frames), '');
});

test('resolveFrame: a frame-kind box never nests, so it resolves to ""', () => {
  const frames: any[] = [{ id: 'big', kind: 'frame', x: 0, y: 0, w: 1000, h: 1000 }];
  const inner: any = { id: 'f2', kind: 'frame', x: 100, y: 100, w: 100, h: 100 }; // centre inside big
  assert.equal(resolveFrame(inner, frames), '');
});

test('resolveFrame ↔ carousel parity: N frames as a strip bucket boxes exactly like pageOf, and the local x matches the page shift', () => {
  const GAP = 56, pw = 1080, ph = 1350, count = 5;
  const stride = pw + GAP;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  // The carousel's page assignment (scout-verbatim): centre column, rounded, clamped.
  const pageOf = (cx: number) => clamp(Math.round((cx - pw / 2) / stride), 0, count - 1);
  // A uniform strip of frames: frame i at x = i*stride, y=0, w=pw, h=ph.
  const frames: any[] = Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, kind: 'frame', x: i * stride, y: 0, w: pw, h: ph,
  }));
  // Sample boxes whose centres land INSIDE a frame (not in the inter-frame gap),
  // spread across pages and across each frame's width.
  const samples: any[] = [];
  for (let i = 0; i < count; i++) {
    for (const frac of [0.05, 0.5, 0.95]) {
      const cx = i * stride + pw * frac;
      samples.push({ id: `b${i}-${frac}`, kind: 'box', x: cx - 30, y: 200, w: 60, h: 60 });
    }
  }
  for (const b of samples) {
    const cx = b.x + b.w / 2;
    const idx = pageOf(cx);
    const fid = resolveFrame(b, frames);
    assert.equal(fid, `p${idx}`, `box centred at ${cx} → ${fid}, expected p${idx}`);
    // Local x is exactly the per-page shift the carousel hook applies (x − page*stride).
    assert.equal(frameLocalXY(b, frames[idx]).x, b.x - idx * stride);
  }
});

test('cascadeFrameMove: the frame and its members shift; strangers do not; input is not mutated', () => {
  const boxes: any[] = [
    { id: 'F', kind: 'frame', x: 100, y: 100, w: 400, h: 400 },
    { id: 'm1', kind: 'box', frame: 'F', x: 120, y: 120, w: 50, h: 50 },
    { id: 'm2', kind: 'text', frame: 'F', x: 200, y: 200, w: 50, h: 50 },
    { id: 'loose', kind: 'box', frame: '', x: 900, y: 900, w: 50, h: 50 },
    { id: 'other', kind: 'box', frame: 'G', x: 700, y: 700, w: 50, h: 50 },
  ];
  const next: any = cascadeFrameMove(boxes, 'F', 10, -5);
  assert.notEqual(next, boxes);
  assert.equal(next[0].x, 110); assert.equal(next[0].y, 95);   // frame
  assert.equal(next[1].x, 130); assert.equal(next[1].y, 115);  // member m1
  assert.equal(next[2].x, 210); assert.equal(next[2].y, 195);  // member m2
  assert.equal(next[3].x, 900); assert.equal(next[3].y, 900);  // stranger
  assert.equal(next[4].x, 700); assert.equal(next[4].y, 700);  // other frame's member
  // input untouched
  assert.equal(boxes[0].x, 100); assert.equal(boxes[1].x, 120);
});

test('seedFrameOrder: left→right x gives ascending order, stable for ties, input untouched', () => {
  const frames: any[] = [
    { id: 'c', x: 300 },
    { id: 'a', x: 100 },
    { id: 'b', x: 200 },
    { id: 'a2', x: 100 }, // tie with 'a' - later in array keeps later order
  ];
  const seeded: any = seedFrameOrder(frames);
  assert.notEqual(seeded, frames);
  const orderById: Record<string, number> = {};
  for (const f of seeded) orderById[f.id] = f.order;
  assert.equal(orderById.a, 0);   // x=100, first of the tie
  assert.equal(orderById.a2, 1);  // x=100, second of the tie (stable)
  assert.equal(orderById.b, 2);   // x=200
  assert.equal(orderById.c, 3);   // x=300
  // input untouched
  assert.equal((frames[0] as any).order, undefined);
});

test('renumberFrameOrder: writes a dense 0..n-1 order matching the new id sequence', () => {
  const F = { kindField: 'kind', idField: 'id', orderField: 'order', frameKind: 'frame' };
  const boxes: any[] = [
    { id: 'F1', kind: 'frame', x: 0, order: 0 },
    { id: 'm1', kind: 'box', frame: 'F1', x: 10 },
    { id: 'F2', kind: 'frame', x: 500, order: 1 },
    { id: 'F3', kind: 'frame', x: 1000, order: 2 },
  ];
  // New sequence: F3, F1, F2
  const next: any = renumberFrameOrder(boxes, ['F3', 'F1', 'F2'], F);
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  assert.equal(byId.F3.order, 0);
  assert.equal(byId.F1.order, 1);
  assert.equal(byId.F2.order, 2);
  // non-frame box untouched (same identity)
  assert.equal(byId.m1, boxes[1]);
  // input not mutated
  assert.equal(boxes[0].order, 0);
});

test('renumberFrameOrder: unchanged frame keeps identity; ids absent from seq untouched', () => {
  const F = { kindField: 'kind', idField: 'id', orderField: 'order', frameKind: 'frame' };
  const a = { id: 'A', kind: 'frame', x: 0, order: 0 };
  const b = { id: 'B', kind: 'frame', x: 100, order: 1 };
  const c = { id: 'C', kind: 'frame', x: 200, order: 9 };   // not in seq
  const next: any = renumberFrameOrder([a, b, c] as any[], ['A', 'B'], F);
  assert.equal(next[0], a);   // already order 0 → same object
  assert.equal(next[1], b);   // already order 1 → same object
  assert.equal(next[2], c);   // absent from seq → untouched
  assert.equal(next[2].order, 9);
});

test('renumberFrameOrder: an unset order is written even when its rank is 0 (dense)', () => {
  const F = { kindField: 'kind', idField: 'id', orderField: 'order', frameKind: 'frame' };
  const boxes: any[] = [{ id: 'A', kind: 'frame', x: 0 }];   // order unset
  const next: any = renumberFrameOrder(boxes, ['A'], F);
  assert.equal(next[0].order, 0);
  assert.notEqual(next[0], boxes[0]);
});

// ── Artboard housekeeping (plans/179 section 5.2 - A1, A7, A8, A9, A13) ────────
//
// The pure half of the M0 bug wave: which artboard is ACTIVE (the fill swatch and the
// still export both follow it), what happens to the children of a deleted one, the deep
// duplicate, the explicit page `order`, and the marquee's fully-enclosed rule.

const FF = {
  idField: 'id', kindField: 'kind', xField: 'x', yField: 'y', wField: 'w', hField: 'h',
  frameField: 'frame', orderField: 'order', frameKind: 'frame',
};

/** Two 400x300 artboards side by side, each with one child. */
const DECK = (): any[] => ([
  { id: 'F1', kind: 'frame', x: 0, y: 0, w: 400, h: 300, order: 0 },
  { id: 'a1', kind: 'text', x: 20, y: 20, w: 100, h: 40, frame: 'F1' },
  { id: 'F2', kind: 'frame', x: 500, y: 0, w: 400, h: 300, order: 1 },
  { id: 'b1', kind: 'box', x: 520, y: 40, w: 100, h: 40, frame: 'F2' },
]);

test('framesInPageOrder: order leads, x is only the tie-break', () => {
  const boxes: any[] = [
    { id: 'C', kind: 'frame', x: 0, order: 2 },
    { id: 'A', kind: 'frame', x: 900, order: 0 },
    { id: 'B', kind: 'frame', x: 500, order: 1 },
    { id: 'loose', kind: 'box', x: 10 },
  ];
  assert.deepEqual(framesInPageOrder(boxes, FF).map((b: any) => b.id), ['A', 'B', 'C']);
  // ties fall back to x
  const tied: any[] = [
    { id: 'R', kind: 'frame', x: 900, order: 0 },
    { id: 'L', kind: 'frame', x: 100, order: 0 },
  ];
  assert.deepEqual(framesInPageOrder(tied, FF).map((b: any) => b.id), ['L', 'R']);
});

test('activeFrameIdFor: a selected artboard IS the active one', () => {
  assert.equal(activeFrameIdFor(DECK(), ['F2'], FF), 'F2');
});

test('activeFrameIdFor: a selected CHILD resolves to the artboard that holds it (A11)', () => {
  assert.equal(activeFrameIdFor(DECK(), ['b1'], FF), 'F2');
});

test('activeFrameIdFor: the STORED membership wins over the geometry, which is the fallback', () => {
  const boxes = DECK();
  // A child parked over F2 but still recorded on F1: the render reads the stored field,
  // so the swatch and the export must read it too.
  boxes[1] = { ...boxes[1], x: 520, y: 20, frame: 'F1' };
  assert.equal(activeFrameIdFor(boxes, ['a1'], FF), 'F1');
  // With no stored membership the geometry answers instead.
  boxes[1] = { ...boxes[1], frame: '' };
  assert.equal(activeFrameIdFor(boxes, ['a1'], FF), 'F2');
});

test('activeFrameIdFor: no selection (or a pasteboard box) falls back to the PRIMARY artboard', () => {
  const boxes = DECK();
  assert.equal(activeFrameIdFor(boxes, [], FF), 'F1');
  boxes.push({ id: 'loose', kind: 'box', x: 2000, y: 2000, w: 10, h: 10, frame: '' });
  assert.equal(activeFrameIdFor(boxes, ['loose'], FF), 'F1');
  // "primary" is the first in PAGE order, not the first in the array.
  const reordered: any[] = [
    { id: 'F1', kind: 'frame', x: 0, y: 0, w: 10, h: 10, order: 5 },
    { id: 'F2', kind: 'frame', x: 900, y: 0, w: 10, h: 10, order: 1 },
  ];
  assert.equal(activeFrameIdFor(reordered, [], FF), 'F2');
});

test('activeFrameIdFor: a document with no artboards has no active one', () => {
  assert.equal(activeFrameIdFor([{ id: 'b', kind: 'box', x: 0 }] as any[], ['b'], FF), '');
});

test('nextFrameOrder: one past the highest, whatever the x positions say (A9)', () => {
  assert.equal(nextFrameOrder(DECK(), FF), 2);
  assert.equal(nextFrameOrder([], FF), 0);
  // A board drawn to the LEFT of the deck still takes the LAST slot.
  const withLeft: any[] = [...DECK(), { id: 'F0', kind: 'frame', x: -900, y: 0, w: 400, h: 300, order: 2 }];
  assert.equal(nextFrameOrder(withLeft, FF), 3);
  // Frames carrying no order at all do not count as order 0.
  assert.equal(nextFrameOrder([{ id: 'A', kind: 'frame', x: 0 }] as any[], FF), 0);
});

test('seedFrameOrders: a legacy doc is seeded from x; anything already ordered is left alone', () => {
  const legacy: any[] = [
    { id: 'R', kind: 'frame', x: 900, w: 400 },
    { id: 'mid', kind: 'box', x: 10, frame: 'R' },
    { id: 'L', kind: 'frame', x: 100, w: 400 },
  ];
  const seeded: any = seedFrameOrders(legacy, FF);
  assert.notEqual(seeded, legacy);
  assert.equal(seeded[0].order, 1);      // R is the right-hand board
  assert.equal(seeded[2].order, 0);      // L is the left-hand board
  assert.equal(seeded[1], legacy[1]);    // the non-frame row keeps its identity
  assert.equal(legacy[0].order, undefined, 'input not mutated');
  // One authored order anywhere means the document has an answer already.
  const partly: any[] = [{ id: 'A', kind: 'frame', x: 900, order: 0 }, { id: 'B', kind: 'frame', x: 0 }];
  assert.equal(seedFrameOrders(partly, FF), partly);
  // No frames at all: same array back, so the caller can skip the commit.
  const flat: any[] = [{ id: 'b', kind: 'box', x: 0 }];
  assert.equal(seedFrameOrders(flat, FF), flat);
});

test('rehomeChildrenOfDeletedFrames: children move to the PREVIOUS artboard, frame-local (A7)', () => {
  const boxes = DECK();
  const res: any = rehomeChildrenOfDeletedFrames(boxes, ['F2'], FF);
  assert.equal(res.homed, 1);
  assert.equal(res.orphaned, 0);
  assert.equal(res.boxes.length, boxes.length, 'the caller drops the deleted rows by index');
  const moved = res.boxes.find((b: any) => b.id === 'b1');
  assert.equal(moved.frame, 'F1');
  // b1 sat at (520,40) on a frame at (500,0): local (20,40). On F1 at (0,0) that is (20,40).
  assert.equal(moved.x, 20);
  assert.equal(moved.y, 40);
  assert.equal(boxes[3].x, 520, 'input not mutated');
});

test('rehomeChildrenOfDeletedFrames: the FIRST artboard has no previous, so its children land on the pasteboard', () => {
  const res: any = rehomeChildrenOfDeletedFrames(DECK(), ['F1'], FF);
  assert.equal(res.homed, 0);
  assert.equal(res.orphaned, 1);
  const cut = res.boxes.find((b: any) => b.id === 'a1');
  assert.equal(cut.frame, '');
  assert.equal(cut.x, 20, 'a pasteboard box keeps its own coordinates');
});

test('rehomeChildrenOfDeletedFrames: "previous" skips other doomed artboards', () => {
  const boxes: any[] = [
    { id: 'F1', kind: 'frame', x: 0, y: 0, w: 400, h: 300, order: 0 },
    { id: 'F2', kind: 'frame', x: 500, y: 0, w: 400, h: 300, order: 1 },
    { id: 'F3', kind: 'frame', x: 1000, y: 0, w: 400, h: 300, order: 2 },
    { id: 'c3', kind: 'box', x: 1010, y: 10, w: 50, h: 50, frame: 'F3' },
  ];
  const res: any = rehomeChildrenOfDeletedFrames(boxes, ['F2', 'F3'], FF);
  const moved = res.boxes.find((b: any) => b.id === 'c3');
  assert.equal(moved.frame, 'F1', 'F2 is going too, so F1 is the previous survivor');
  assert.equal(moved.x, 10);
  assert.equal(res.homed, 1);
});

test('rehomeChildrenOfDeletedFrames: deleting only plain boxes changes nothing', () => {
  const boxes = DECK();
  const res: any = rehomeChildrenOfDeletedFrames(boxes, ['a1'], FF);
  assert.equal(res.boxes, boxes);
  assert.equal(res.homed + res.orphaned, 0);
});

test('duplicateFrameWithChildren: the children come too, with fresh ids and their local position (A8)', () => {
  const boxes = DECK();
  let n = 0;
  const res: any = duplicateFrameWithChildren(boxes, 'F1', FF, { id: () => `n${++n}` }, { gap: 56 });
  assert.equal(res.frameId, 'n1');
  assert.equal(res.ids.length, 2, 'the frame and its one child');
  const copyF = res.boxes.find((b: any) => b.id === 'n1');
  const copyC = res.boxes.find((b: any) => b.id === 'n2');
  assert.equal(copyF.x, 956, 'placed clear of the WHOLE deck: F2 ends at 900, + 56');
  assert.equal(copyF.y, 0, 'same row');
  assert.equal(copyC.frame, 'n1', 'the child belongs to the copy');
  assert.equal(copyC.x, 976, 'and keeps its frame-local (20,20)');
  assert.equal(copyC.y, 20);
  assert.equal(boxes.length, 4, 'input not mutated');
});

test('duplicateFrameWithChildren: the copy takes the NEXT page slot and the rest renumber (A8/A9)', () => {
  let n = 0;
  const res: any = duplicateFrameWithChildren(DECK(), 'F1', FF, { id: () => `n${++n}` });
  const byId: Record<string, any> = {};
  for (const b of res.boxes) byId[b.id] = b;
  assert.equal(byId.F1.order, 0);
  assert.equal(byId.n1.order, 1, 'the copy is the next slide');
  assert.equal(byId.F2.order, 2, 'and the slide that was 2 becomes 3');
});

test('duplicateFrameWithChildren: a child of the ORIGINAL still resolves to the original (the re-bucket trap)', () => {
  let n = 0;
  const res: any = duplicateFrameWithChildren(DECK(), 'F1', FF, { id: () => `n${++n}` });
  const frames = res.boxes.filter((b: any) => b.kind === 'frame');
  const orig = res.boxes.find((b: any) => b.id === 'a1');
  // resolveFrame answers with the LAST containing frame, so an overlapping copy would
  // steal this box on its next gesture. The copy is placed clear, so it cannot.
  assert.equal(resolveFrame(orig, frames), 'F1');
  assert.equal(resolveFrame(res.boxes.find((b: any) => b.id === 'n2'), frames), 'n1');
});

test('duplicateFrameWithChildren: the copy overlaps NO other artboard, not just the original', () => {
  // The deck's own gutter (100px here, 56 in carousel.json, 80 in slide-deck.json) is the
  // same order as `gap`, so "original + w + gap" used to drop the copy on top of the NEXT
  // slide - and the copies are appended LAST, so `resolveFrame` handed that slide's
  // children to the copy on their first gesture. Duplicating slide 1 of a 3-board deck:
  const deck: any[] = [
    ...DECK(),
    { id: 'F3', kind: 'frame', x: 1000, y: 0, w: 400, h: 300, order: 2 },
    { id: 'c1', kind: 'box', x: 1020, y: 40, w: 100, h: 40, frame: 'F3' },
  ];
  let n = 0;
  const res: any = duplicateFrameWithChildren(deck, 'F1', FF, { id: () => `n${++n}` }, { gap: 56 });
  const frames = res.boxes.filter((b: any) => b.kind === 'frame');
  const copyF = res.boxes.find((b: any) => b.id === 'n1');
  assert.equal(copyF.x, 1456, 'past the right edge of F3 (1400), + 56');
  // No frame rect intersects any other.
  for (const a of frames) for (const b of frames) {
    if (a === b) continue;
    const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
    assert.ok(apart, `${a.id} overlaps ${b.id}`);
  }
  // …so every existing child still resolves to the board that owns it.
  for (const [child, frame] of [['a1', 'F1'], ['b1', 'F2'], ['c1', 'F3']]) {
    assert.equal(resolveFrame(res.boxes.find((b: any) => b.id === child), frames), frame,
      `${child} must stay on ${frame}`);
  }
});

test('duplicateFrameWithChildren: groups are re-keyed, and references INTO the copy repoint', () => {
  const boxes: any[] = [
    { id: 'F1', kind: 'frame', x: 0, y: 0, w: 400, h: 300, order: 0 },
    { id: 'mask', kind: 'box', x: 10, y: 10, w: 80, h: 80, frame: 'F1', group: 'g1' },
    { id: 'art', kind: 'image', x: 10, y: 10, w: 80, h: 80, frame: 'F1', group: 'g1', clip: 'mask' },
    { id: 'tag', kind: 'text', x: 200, y: 10, w: 80, h: 80, frame: 'F1', matchOf: 'hero' },
  ];
  let n = 0, g = 0;
  const res: any = duplicateFrameWithChildren(boxes, 'F1', FF,
    { id: () => `n${++n}`, group: () => `G${++g}` },
    { groupField: 'group', refFields: ['clip', 'matchOf'] });
  const copyMask = res.boxes.find((b: any) => b.id === 'n2');
  const copyArt = res.boxes.find((b: any) => b.id === 'n3');
  const copyTag = res.boxes.find((b: any) => b.id === 'n4');
  assert.equal(copyMask.group, 'G1', 'a fresh group id, or clicking a copy would grab the original');
  assert.equal(copyArt.group, 'G1', 'both members share the ONE new group');
  assert.equal(copyArt.clip, 'n2', 'the clip repoints at the copied mask');
  assert.equal(copyTag.matchOf, 'hero', 'a morph TAG is not an id - left alone, so the copy still morphs');
  assert.equal(boxes[1].group, 'g1', 'input not mutated');
});

test('duplicateFrameWithChildren: an unknown id is a no-op', () => {
  const boxes = DECK();
  const res: any = duplicateFrameWithChildren(boxes, 'nope', FF, { id: () => 'x' });
  assert.equal(res.boxes, boxes);
  assert.equal(res.frameId, '');
  assert.deepEqual(res.ids, []);
});

test('filterMarqueeFrames: an artboard joins only when the band ENCLOSES it (A13)', () => {
  const boxes = DECK();
  const M = { kindField: 'kind', xField: 'x', yField: 'y', wField: 'w', hField: 'h', frameKind: 'frame' };
  // A band across the middle of F1: it touches the frame and its child.
  const crossing = { x: -10, y: 10, w: 200, h: 60 };
  assert.deepEqual(filterMarqueeFrames(boxes, [0, 1], crossing, M), [1],
    'the child stays, the partially-crossed artboard is dropped');
  // A band around the whole of F1.
  const around = { x: -20, y: -20, w: 460, h: 360 };
  assert.deepEqual(filterMarqueeFrames(boxes, [0, 1], around, M), [0, 1]);
  // Exactly on the edges counts as enclosed.
  assert.deepEqual(filterMarqueeFrames(boxes, [0], { x: 0, y: 0, w: 400, h: 300 }, M), [0]);
  // One pixel short does not.
  assert.deepEqual(filterMarqueeFrames(boxes, [0], { x: 0, y: 0, w: 399, h: 300 }, M), []);
  // A band dragged up-and-left is the same band.
  assert.deepEqual(filterMarqueeFrames(boxes, [0], { x: 440, y: 340, w: -460, h: -360 }, M), [0]);
});

// ── Frames AS scenes: sequencing (plan 92) ────────────────────────────────────

const SEQ_OPTS = {
  defaultDurMs: 3000, lane: 'seq', defaultEnter: 'fade', defaultExit: 'fade',
  startField: 'start', durField: 'dur', laneField: 'lane', enterField: 'enter', exitField: 'exit',
  orderField: 'order', kindField: 'kind', frameKind: 'frame',
};
const SEQ_CFG = { kindField: 'kind', frameKind: 'frame', startField: 'start', durField: 'dur' };

test('sequenceFramesInOrder: cumulative starts, default dur in SECONDS, order respected', () => {
  const boxes: any[] = [
    { id: 'F2', kind: 'frame', x: 500, order: 1 },
    { id: 'F1', kind: 'frame', x: 0, order: 0 },
    { id: 'F3', kind: 'frame', x: 1000, order: 2 },
  ];
  const next: any = sequenceFramesInOrder(boxes, SEQ_OPTS);
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  // default 3000ms → 3s in the field; gapless cumulative starts in play order (order asc).
  assert.equal(byId.F1.start, 0); assert.equal(byId.F1.dur, 3);
  assert.equal(byId.F2.start, 3); assert.equal(byId.F2.dur, 3);
  assert.equal(byId.F3.start, 6); assert.equal(byId.F3.dur, 3);
  // every frame lands on the scenes lane, with the default exit.
  for (const id of ['F1', 'F2', 'F3']) {
    assert.equal(byId[id].lane, 'seq');
    assert.equal(byId[id].exit, 'fade');
  }
  // The FIRST frame in play order opens the deck, so it appears instantly (enter 'none');
  // later frames keep the default enter so transitions happen BETWEEN slides.
  assert.equal(byId.F1.enter, 'none');
  assert.equal(byId.F2.enter, 'fade');
  assert.equal(byId.F3.enter, 'fade');
});

test('sequenceFramesInOrder: first frame in play order gets enter "none" (instant), regardless of array position', () => {
  // F1 (order 0) is LAST in the array but FIRST in play order → it is the one that gets 'none'.
  const boxes: any[] = [
    { id: 'F3', kind: 'frame', x: 1000, order: 2 },
    { id: 'F2', kind: 'frame', x: 500, order: 1 },
    { id: 'F1', kind: 'frame', x: 0, order: 0 },
  ];
  const next: any = sequenceFramesInOrder(boxes, SEQ_OPTS);
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  assert.equal(byId.F1.start, 0, 'F1 is first in play order (cumulative start 0)');
  assert.equal(byId.F1.enter, 'none', 'the play-order-first frame appears instantly');
  assert.equal(byId.F2.enter, 'fade', 'later frames keep the default enter');
  assert.equal(byId.F3.enter, 'fade');
  // The first frame still fades OUT into the second (transitions BETWEEN slides).
  assert.equal(byId.F1.exit, 'fade');
});

test('sequenceFramesInOrder: an explicitly-authored enter on the first frame is NOT overridden with "none"', () => {
  const boxes: any[] = [
    { id: 'A', kind: 'frame', x: 0, order: 0, enter: 'slide' },  // authored → survives
    { id: 'B', kind: 'frame', x: 100, order: 1 },
  ];
  const next: any = sequenceFramesInOrder(boxes, SEQ_OPTS);
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  assert.equal(byId.A.enter, 'slide', 'authored enter on the first frame is kept, not forced to none');
  assert.equal(byId.B.enter, 'fade');
});

test('sequenceFramesInOrder: existing dur>0 is kept; order ties break by x asc', () => {
  const boxes: any[] = [
    { id: 'A', kind: 'frame', x: 100, order: 0, dur: 5 },     // keeps its own 5s
    { id: 'B', kind: 'frame', x: 300, order: 0 },             // tie on order → x asc after A
    { id: 'C', kind: 'frame', x: 50, order: 0 },              // tie, smallest x → first
  ];
  const next: any = sequenceFramesInOrder(boxes, SEQ_OPTS);
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  // Play order by (order asc, then x asc): C (x50), A (x100), B (x300).
  assert.equal(byId.C.start, 0); assert.equal(byId.C.dur, 3);
  assert.equal(byId.A.start, 3); assert.equal(byId.A.dur, 5);   // its authored length survives
  assert.equal(byId.B.start, 8); assert.equal(byId.B.dur, 3);
});

test('sequenceFramesInOrder: existing transition is preserved, only unset gets the default', () => {
  const boxes: any[] = [
    { id: 'A', kind: 'frame', x: 0, order: 0, enter: 'slide' },  // keep slide
    { id: 'B', kind: 'frame', x: 100, order: 1, exit: 'none' },  // 'none' counts as unset
  ];
  const next: any = sequenceFramesInOrder(boxes, SEQ_OPTS);
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  assert.equal(byId.A.enter, 'slide');   // authored enter kept
  assert.equal(byId.A.exit, 'fade');     // exit was unset → default
  assert.equal(byId.B.exit, 'fade');     // 'none' → default
});

// ── per-frame slide transitions (plans/179 M4) ────────────────────────────────
//
// With `transitionField` the flat defaultEnter/defaultExit stop being the answer: the
// enter/exit come from the per-frame slide transitions, inheriting the document's where a
// frame has none. That is the whole point - laying a deck out on the timeline now produces
// the transitions the author chose per slide, not one blanket fade.
//
// THE FIELD MEANS "how THIS slide changes into the NEXT one", so the two halves come off
// two different frames: a frame exits the way IT says and enters the way its PREDECESSOR
// said. Taking both off the arriving frame made A ('slide') slide out leftwards while B
// ('fade') cross-faded in - one move, two answers - where the presenter (min(from, to))
// and the .pptx writer (slide k gets slide k-1's transition) both read it the right way.

/** The same options the Design overlay passes, plus the per-frame transition field. */
const SEQ_OPTS_TR = {
  defaultDurMs: 3000, lane: 'seq',
  startField: 'start', durField: 'dur', laneField: 'lane', enterField: 'enter', exitField: 'exit',
  orderField: 'order', kindField: 'kind', frameKind: 'frame',
  transitionField: 'slideTransition',
};

test('sequenceFramesInOrder: a frame EXITS the way it says and ENTERS the way its predecessor said', () => {
  const boxes: any[] = [
    { id: 'A', kind: 'frame', x: 0, order: 0, slideTransition: 'slide' },
    { id: 'B', kind: 'frame', x: 100, order: 1, slideTransition: 'fade' },
    { id: 'C', kind: 'frame', x: 200, order: 2, slideTransition: 'none' },
  ];
  const next: any = sequenceFramesInOrder(boxes, { ...SEQ_OPTS_TR, docTransition: 'fade' });
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  // A is first in play order, so it appears instantly - but it still LEAVES as a slide.
  assert.equal(byId.A.enter, 'none');
  assert.equal(byId.A.exit, 'slide-right', 'a departing slide leaves leftwards');
  // A→B is ONE move, authored on A: B slides in from the right to meet A's exit. The
  // 'fade' stored on B describes the NEXT move, B→C, so it is B's exit and C's entrance.
  assert.equal(byId.B.enter, 'slide-left', 'an entering slide comes in from the right');
  assert.equal(byId.B.exit, 'fade');
  assert.equal(byId.C.enter, 'fade', 'C arrives the way B said it would');
  assert.equal(byId.C.exit, 'none');
});

test('sequenceFramesInOrder: an empty per-frame transition inherits the document one', () => {
  const boxes: any[] = [
    { id: 'A', kind: 'frame', x: 0, order: 0 },                        // no field at all
    { id: 'B', kind: 'frame', x: 100, order: 1, slideTransition: '' }, // explicitly empty
  ];
  const next: any = sequenceFramesInOrder(boxes, { ...SEQ_OPTS_TR, docTransition: 'slide' });
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  assert.equal(byId.A.exit, 'slide-right');
  assert.equal(byId.B.enter, 'slide-left', 'an entering slide comes in from the right');
  assert.equal(byId.B.exit, 'slide-right');
});

test('sequenceFramesInOrder: "custom" leaves enter/exit ALONE - the timeline owns them', () => {
  const boxes: any[] = [
    { id: 'A', kind: 'frame', x: 0, order: 0, slideTransition: 'custom' },
    { id: 'B', kind: 'frame', x: 100, order: 1, slideTransition: 'custom' },
    { id: 'C', kind: 'frame', x: 200, order: 2, slideTransition: 'fade' },
  ];
  const next: any = sequenceFramesInOrder(boxes, { ...SEQ_OPTS_TR, docTransition: 'slide' });
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  // Both halves are refused, and each for its own frame's reason: B's exit because B is
  // custom, B's entrance because the frame that authored the move into it (A) is.
  assert.equal(byId.B.enter, undefined, 'custom on the predecessor derives no enter');
  assert.equal(byId.B.exit, undefined, 'custom derives no exit');
  // …and C, whose own value is ordinary, still takes no entrance: the move into it was
  // authored on B, and B says the timeline owns it.
  assert.equal(byId.C.enter, undefined, 'the predecessor is what decides the entrance');
  assert.equal(byId.C.exit, 'fade', 'while C exits the way C says');
  // The timing is still written - custom is about the transition, not about the layout.
  assert.equal(byId.B.start, 3);
  assert.equal(byId.B.lane, 'seq');
});

test('sequenceFramesInOrder: an authored enter still wins over the derived pair', () => {
  const boxes: any[] = [
    { id: 'A', kind: 'frame', x: 0, order: 0, slideTransition: 'fade', enter: 'pop' },
    { id: 'B', kind: 'frame', x: 100, order: 1, slideTransition: 'fade' },
  ];
  const next: any = sequenceFramesInOrder(boxes, { ...SEQ_OPTS_TR, docTransition: 'fade' });
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  assert.equal(byId.A.enter, 'pop', 'the noTransition guard: an authored kind is never overwritten');
  assert.equal(byId.A.exit, 'fade');
});

test('sequenceFramesInOrder: no derivable transition anywhere leaves enter/exit untouched', () => {
  // No per-frame value and no document value - nothing to derive, so the frames get
  // their timing and keep whatever transitions they had (which is none).
  const boxes: any[] = [
    { id: 'A', kind: 'frame', x: 0, order: 0 },
    { id: 'B', kind: 'frame', x: 100, order: 1 },
  ];
  const next: any = sequenceFramesInOrder(boxes, SEQ_OPTS_TR);
  for (const b of next) {
    assert.equal(b.enter, undefined);
    assert.equal(b.exit, undefined);
    assert.equal(b.lane, 'seq');
  }
});

// ── minDurMs: the narrated-slide dwell floor (plans/180 T1, T7, T8) ───────────

test('sequenceFramesInOrder: minDurMs raises one frame and every later start moves with it', () => {
  const boxes: any[] = [
    { id: 'F1', kind: 'frame', x: 0, order: 0 },
    { id: 'F2', kind: 'frame', x: 500, order: 1 },
    { id: 'F3', kind: 'frame', x: 1000, order: 2 },
  ];
  const next: any = sequenceFramesInOrder(boxes, { ...SEQ_OPTS, minDurMs: { F2: 11400 } });
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  assert.equal(byId.F1.dur, 3, 'a frame with no floor keeps the default');
  assert.equal(byId.F2.dur, 11.4, 'the narrated slide is long enough to hold its clip');
  assert.equal(byId.F2.start, 3);
  assert.equal(byId.F3.start, 14.4, 'the pack re-flows behind it - gapless, no seam');
  assert.equal(byId.F3.dur, 3);
});

test('sequenceFramesInOrder: minDurMs is a FLOOR - a longer authored dwell survives', () => {
  const boxes: any[] = [
    { id: 'A', kind: 'frame', x: 0, order: 0, dur: 30 },   // someone left it up for 30 s
    { id: 'B', kind: 'frame', x: 100, order: 1, dur: 2 },  // shorter than its narration
  ];
  const next: any = sequenceFramesInOrder(boxes, { ...SEQ_OPTS, minDurMs: { A: 11400, B: 8000 } });
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  assert.equal(byId.A.dur, 30, 'the author decided; the floor only raises');
  assert.equal(byId.B.dur, 8, 'a slide shorter than its voice is stretched to fit');
  assert.equal(byId.B.start, 30);
});

test('sequenceFramesInOrder: minDurMs names frames by idField, and junk entries are ignored', () => {
  const boxes: any[] = [
    { name: 'A', kind: 'frame', x: 0, order: 0 },
    { name: 'B', kind: 'frame', x: 100, order: 1 },
  ];
  // A tool whose rows are keyed by something other than `id` says so.
  const next: any = sequenceFramesInOrder(boxes, { ...SEQ_OPTS, idField: 'name', minDurMs: { B: 5000 } });
  assert.equal(next[1].dur, 5);
  // Nothing in the map, an unknown id, and values that are not usable lengths all
  // leave the pack exactly as it was.
  const plain: any = sequenceFramesInOrder(boxes, { ...SEQ_OPTS, idField: 'name' });
  for (const junk of [{}, { C: 5000 }, { B: 0 }, { B: -1 }, { B: Number.NaN }] as any[]) {
    assert.deepEqual(sequenceFramesInOrder(boxes, { ...SEQ_OPTS, idField: 'name', minDurMs: junk }), plain);
  }
});

test('sequenceFramesInOrder: a minDurMs over the hour ceiling clamps, it does not overflow', () => {
  const boxes: any[] = [{ id: 'A', kind: 'frame', x: 0, order: 0 }];
  const next: any = sequenceFramesInOrder(boxes, { ...SEQ_OPTS, minDurMs: { A: 9_000_000 } });
  assert.equal(next[0].dur, 3600, 'the same ceiling every other authored length gets');
});

test('sequenceFramesInOrder: without transitionField the flat defaults are unchanged', () => {
  // Sequence Studio's call site - the pre-M4 behaviour, byte for byte.
  const boxes: any[] = [
    { id: 'A', kind: 'frame', x: 0, order: 0, slideTransition: 'slide' },  // ignored
    { id: 'B', kind: 'frame', x: 100, order: 1 },
  ];
  const next: any = sequenceFramesInOrder(boxes, SEQ_OPTS);
  const byId: Record<string, any> = {};
  for (const b of next) byId[b.id] = b;
  assert.equal(byId.A.enter, 'none');
  assert.equal(byId.A.exit, 'fade');
  assert.equal(byId.B.enter, 'fade');
  assert.equal(byId.B.exit, 'fade');
});

test('sequenceFramesInOrder: non-frame boxes are untouched (same identity), input not mutated', () => {
  const member = { id: 'm', kind: 'box', frame: 'F1', x: 20, y: 20 };
  const boxes: any[] = [
    { id: 'F1', kind: 'frame', x: 0, order: 0 },
    member,
  ];
  const next: any = sequenceFramesInOrder(boxes, SEQ_OPTS);
  assert.equal(next[1], member, 'the member box keeps object identity');
  assert.equal((next[1] as any).lane, undefined, 'a non-frame box gains no timing');
  // input not mutated
  assert.equal((boxes[0] as any).start, undefined);
  assert.equal((boxes[0] as any).lane, undefined);
});

test('sequenceFramesInOrder: geometry (x/y/w/h/order) is never touched', () => {
  const boxes: any[] = [{ id: 'F', kind: 'frame', x: 40, y: 60, w: 800, h: 600, order: 0 }];
  const next: any = sequenceFramesInOrder(boxes, SEQ_OPTS);
  assert.equal(next[0].x, 40); assert.equal(next[0].y, 60);
  assert.equal(next[0].w, 800); assert.equal(next[0].h, 600);
  assert.equal(next[0].order, 0);
});

test('sequenceFramesInOrder: idempotent in value - running it twice yields the same timing', () => {
  const boxes: any[] = [
    { id: 'F1', kind: 'frame', x: 0, order: 0 },
    { id: 'F2', kind: 'frame', x: 500, order: 1 },
  ];
  const once: any = sequenceFramesInOrder(boxes, SEQ_OPTS);
  const twice: any = sequenceFramesInOrder(once, SEQ_OPTS);
  for (let i = 0; i < once.length; i++) {
    assert.equal(twice[i].start, once[i].start);
    assert.equal(twice[i].dur, once[i].dur);
    assert.equal(twice[i].lane, once[i].lane);
    // second run changes nothing → identity preserved (no re-render churn).
    assert.equal(twice[i], once[i]);
  }
});

test('framesAreSequenced: false for spatial frames, true once any frame has dur>0 or a start', () => {
  const spatial: any[] = [
    { id: 'F1', kind: 'frame', x: 0 },
    { id: 'F2', kind: 'frame', x: 500 },
    { id: 'm', kind: 'box', frame: 'F1', x: 10, start: 2 },  // a non-frame start does NOT count
  ];
  assert.equal(framesAreSequenced(spatial, SEQ_CFG), false);
  assert.equal(framesAreSequenced([{ id: 'F', kind: 'frame', x: 0, dur: 3 }] as any[], SEQ_CFG), true);
  assert.equal(framesAreSequenced([{ id: 'F', kind: 'frame', x: 0, start: 0 }] as any[], SEQ_CFG), true);
  // dur:0 is not sequenced; a blank start field is not sequenced.
  assert.equal(framesAreSequenced([{ id: 'F', kind: 'frame', x: 0, dur: 0, start: '' }] as any[], SEQ_CFG), false);
});

test('framesAreSequenced: a doc with no frames at all is never sequenced', () => {
  assert.equal(framesAreSequenced([{ id: 'a', kind: 'box', x: 0 }] as any[], SEQ_CFG), false);
  assert.equal(framesAreSequenced([], SEQ_CFG), false);
});

// ── authored dash arrays (plan 96 P0) ────────────────────────────────────────
// The power-user "Dash array" field's validator. What matters here is that it
// REFUSES rather than repairs - the panel's answer to null is to show the error
// and write nothing - and that what it stores can survive the compact blocks URL.

test('parseDashArray takes a plain space- or comma-separated list', () => {
  assert.deepEqual(parseDashArray('6 4'), [6, 4]);
  assert.deepEqual(parseDashArray('6,4'), [6, 4]);
  assert.deepEqual(parseDashArray('  8   4  2 4 '), [8, 4, 2, 4]);
  assert.deepEqual(parseDashArray('2.5 1.25'), [2.5, 1.25]);
  assert.deepEqual(parseDashArray('0 6'), [0, 6]);       // a round-cap dot pattern
  assert.deepEqual(parseDashArray('10'), [10]);
});

test('parseDashArray: blank is "no array", not an error', () => {
  assert.deepEqual(parseDashArray(''), []);
  assert.deepEqual(parseDashArray('   '), []);
  assert.deepEqual(parseDashArray(null), []);
  assert.deepEqual(parseDashArray(undefined), []);
});

test('parseDashArray rejects anything that is not a list of non-negative numbers', () => {
  for (const bad of [
    '6 x', 'abc', '-4 2', '6 -4', '1e3 2', '0x10 4', 'Infinity 2', 'NaN 3',
    '6..4 2', '.', '6 4;', '<script> 4', '6 4 ~ 2',
  ]) {
    assert.equal(parseDashArray(bad), null, `${bad} is not a dash pattern`);
  }
});

test('parseDashArray rejects an all-zero pattern (an invisible stroke is not a style)', () => {
  assert.equal(parseDashArray('0'), null);
  assert.equal(parseDashArray('0 0 0'), null);
});

test('parseDashArray bounds the entry count', () => {
  const ok = Array.from({ length: DASH_ARRAY_MAX }, () => '2').join(' ');
  assert.equal(parseDashArray(ok)?.length, DASH_ARRAY_MAX);
  assert.equal(parseDashArray(ok + ' 2'), null);
});

test('formatDashArray stores the canonical space-separated form (no comma, no tilde)', () => {
  assert.equal(formatDashArray([6, 4]), '6 4');
  assert.equal(formatDashArray([2.5, 1.256]), '2.5 1.26');
  // The two separators the compact blocks URL cannot escape must never appear.
  const s = formatDashArray(parseDashArray('6, 4, 2')!);
  assert.equal(s, '6 4 2');
  assert.ok(!s.includes(','), 'no comma');
  assert.ok(!s.includes('~'), 'no tilde');
});

test('parse → format → parse is a fixed point', () => {
  for (const src of ['6 4', '6,4', '8 4 2 4', '2.5 1.25', '0 6']) {
    const once = formatDashArray(parseDashArray(src)!);
    assert.equal(formatDashArray(parseDashArray(once)!), once, src);
  }
});

// ── the connector surface this module re-exports (plan 90 R1 + plan 96 P3/P5) ──
//
// free-canvas.ts imports its whole connector/bound-path vocabulary from HERE, not from the
// engine directly, so this module's re-export list is a real contract: drop a name from it
// and the overlay stops compiling, keep a name that the engine has renamed and the overlay
// silently loses a feature. The behaviour is the engine's and is tested in
// tests/connector-geometry.test.ts; what this pins is that the surface arrives intact and
// is the engine's own function rather than a local re-implementation.

test('the engine connector surface is re-exported whole, and is live', () => {
  for (const fn of [routedLineSvg, pathRouteStyle, isConnectorRouteStyle, edgeWaypoints, buildConnectorSvg]) {
    assert.equal(typeof fn, 'function');
  }
  assert.ok(Array.isArray(CONNECTOR_ROUTE_STYLES) && CONNECTOR_ROUTE_STYLES.length === 13);
  // Live, not just present: the kind→route mapping the overlay drives the bind gesture with.
  assert.equal(pathRouteStyle('line', '', 2), 'straight');
  assert.equal(pathRouteStyle('line', 'arc-wide', 2), 'arc-wide', 'an override wins');
  assert.equal(isConnectorRouteStyle('elbow-src'), true);
  assert.equal(isConnectorRouteStyle('nope'), false);
  // …and the committed renderer the live overlay draws bound paths with, which is what
  // makes "nothing jumps on release" a property rather than a hope.
  const out = routedLineSvg({ x: 0, y: 0, w: 100, h: 50 }, { x: 0, y: 300, w: 100, h: 50 }, {
    style: 'straight', headStart: 'none', headEnd: 'triangle', dash: 'solid', color: '#30ba78', width: 3,
  });
  assert.match(out, /<path d="M/);
  assert.doesNotMatch(out, /<marker|<polygon|stroke-dasharray/, 'export-safe');
});

// ── path end tangents (plan 96 P1 - the arrowhead ANGLE on a drawn path) ──────
// pathEndTangents feeds the head angle: the hook/shell lower a path to cubics, take the
// OUTWARD unit tangent at each end (Math.atan2 of it), and hand that to
// host.connectors.pathHeadSvg. If the tangent points the wrong way the arrowhead faces
// into the shaft. A CubicTuple is [x0,y0, c1x,c1y, c2x,c2y, x3,y3].

test('pathEndTangents: an L-path points each head OUT of its own end', () => {
  const L = [
    [0, 0, 33, 0, 66, 0, 100, 0],          // →  the first segment leaves rightward
    [100, 0, 100, 33, 100, 66, 100, 100],  // ↓  the last segment arrives downward
  ];
  const t = pathEndTangents(L)!;
  assert.deepEqual(t.start, { x: -1, y: 0 }, 'start head points back LEFT, out of a rightward start');
  assert.deepEqual(t.end, { x: 0, y: 1 }, 'end head points DOWN, along a downward finish');
});

test('pathEndTangents: a degenerate END segment is stepped over, not trusted', () => {
  // A fully-coincident first cubic has no direction of its own; the walk continues into
  // the neighbour so the head still faces the way the path actually leaves.
  const stepped = [
    [0, 0, 0, 0, 0, 0, 0, 0],       // degenerate: every control point on the start
    [0, 0, 10, 0, 20, 0, 30, 0],    // the real segment, rightward
  ];
  assert.deepEqual(pathEndTangents(stepped)!.start, { x: -1, y: 0 });
});

test('pathEndTangents: a wholly degenerate path has no direction anywhere → null', () => {
  assert.equal(pathEndTangents([[5, 5, 5, 5, 5, 5, 5, 5]]), null);
  assert.equal(pathEndTangents([]), null);
});

test('pathEndPoints: the two points the heads sit on are the first + last lowered points', () => {
  const L = [
    [0, 0, 33, 0, 66, 0, 100, 0],
    [100, 0, 100, 33, 100, 66, 100, 100],
  ];
  assert.deepEqual(pathEndPoints(L), { start: { x: 0, y: 0 }, end: { x: 100, y: 100 } });
  assert.equal(pathEndPoints([]), null);
});

// ── Lift layers: the replacement rows (plans/104 section 7 P3) ─────────────────────
//
// The engine decides WHAT the layers are (`enumerateSvgLayers`, goldens in
// tests/svg-layers.test.ts). These pin what a lift does to the MODEL: geometry
// held, depth staggered, the source's own paint redistributed so the stack
// paints in the order the single box did.

const LIFT_CFG: any = {
  ...CFG,
  imageField: 'image', groupField: 'group', zField: 'z', shadowField: 'shadow',
  kindField: 'kind', textField: 'text', fillField: 'bg', gradField: 'grad',
};

const liftSrc = (o: any = {}): any => ({
  id: 'b1', kind: 'image', x: 40, y: 60, w: 300, h: 200, rot: 12, opacity: 0.9, shadow: 'none',
  image: 'data:image/svg+xml,whole', text: 'Caption', bg: '#101418', grad: 'lin',
  fit: 'contain', blend: 'normal', frame: 'f1', start: 2, dur: 3,
  ...o,
});

const LAYERS = [
  { src: 'data:image/svg+xml,L1', id: 'b2' },
  { src: 'data:image/svg+xml,L2', id: 'b3' },
  { src: 'data:image/svg+xml,L3', id: 'b4' },
];

test('liftRows: one row per layer, each holding its own derived SVG', () => {
  const rows = liftRows(liftSrc(), LAYERS, LIFT_CFG, { group: 'g9', zClamp: KF_Z_FIELD_CLAMP });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r: any) => r.image), LAYERS.map((l) => l.src));
  assert.deepEqual(rows.map((r: any) => r.id), ['b2', 'b3', 'b4']);
});

test('liftRows: geometry is IDENTICAL on every row - a lift moves nothing', () => {
  const src = liftSrc();
  for (const r of liftRows(src, LAYERS, LIFT_CFG, { group: 'g9' }) as any[]) {
    for (const k of ['x', 'y', 'w', 'h', 'rot', 'opacity', 'fit', 'blend', 'frame', 'start', 'dur']) {
      assert.equal(r[k], src[k], `${k} must survive the lift unchanged`);
    }
  }
});

test('liftRows: depth climbs the eff band and every row shares one group', () => {
  const rows = liftRows(liftSrc(), LAYERS, LIFT_CFG, { group: 'g9' }) as any[];
  // Three layers, so three full rungs of LIFT_EFF_STEP: eff 1.00 / 1.02 / 1.04.
  assert.deepEqual(rows.map((r) => r.z), liftDepths([0, 1, 2]));
  assert.deepEqual(rows.map((r) => r.z), [0, 23.53, 46.15]);
  assert.deepEqual(rows.map((r) => r.group), ['g9', 'g9', 'g9']);
});

test('liftRows flat: an UNGROUP keeps the source depth and shadow - only the layering changes', () => {
  const src = liftSrc({ z: 35, shadow: 'box' });
  const rows = liftRows(src, LAYERS, LIFT_CFG, { group: 'g9', zClamp: KF_Z_FIELD_CLAMP, flat: true }) as any[];
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.z), [35, 35, 35], 'no depth ladder - the board has no camera to climb for');
  assert.deepEqual(rows.map((r) => r.shadow), ['box', 'box', 'box'], 'the source’s own shadow, not `depth`');
  assert.deepEqual(rows.map((r) => r.group), ['g9', 'g9', 'g9'], 'still one group, so the parts move as one');
  assert.deepEqual(rows.map((r) => r.image), LAYERS.map((l) => l.src));
  // Paint order is still distributed: background on the bottom row, caption on the top.
  assert.deepEqual(rows.map((r) => r.bg), ['#101418', '', '']);
  assert.deepEqual(rows.map((r) => r.text), ['', '', 'Caption']);
  // An explicit shadow still wins over flat's default of "leave it".
  const shadowed = liftRows(src, LAYERS, LIFT_CFG, { group: 'g9', flat: true, shadow: 'depth' }) as any[];
  assert.deepEqual(shadowed.map((r) => r.shadow), ['depth', 'depth', 'depth']);
});

test('liftDepths: the band is a CEILING - N layers never climb past it', () => {
  for (const n of [2, 3, 5, 14, 25, 35, 54, 64]) {
    const slots = Array.from({ length: n }, (_, i) => i);
    const z = liftDepths(slots, KF_Z_FIELD_CLAMP);
    const top = depthForEff(LIFT_EFF_CEIL);
    assert.ok(z[n - 1]! <= top + 0.01, `${n} layers must stay under the band (${z[n - 1]} > ${top})`);
    assert.ok(z.every((v, i) => i === 0 || v > z[i - 1]!), `${n} layers must stay strictly increasing`);
    assert.ok(z.every((v) => v > KF_Z_FIELD_CLAMP[0] && v < KF_Z_FIELD_CLAMP[1]),
      `${n} layers must not touch the field clamp`);
    assert.equal(z[0], 0, 'the bottom layer rests on the surface');
  }
  // Under ~11 layers there is room for a full rung each; past it the rung shrinks
  // so the TOP still lands on the ceiling.
  // …at the ladder's own 0.01 px quantum (section 4.6), which is what gets stored.
  const q = (v: number): number => Math.round(v * 100) / 100;
  assert.equal(liftDepths([0, 1, 2])[1], q(depthForEff(1 + LIFT_EFF_STEP)));
  assert.equal(liftDepths(Array.from({ length: 40 }, (_, i) => i))[39], q(depthForEff(LIFT_EFF_CEIL)));
});

test('liftDepths: strength scales the parallax, and its default moves nothing (A5#2)', () => {
  const slots = [0, 1, 2, 3, 4];
  const base = liftDepths(slots, KF_Z_FIELD_CLAMP);

  // Opt-in: omitting strength, passing an explicit 1, and passing Medium all reproduce the
  // SHIPPED ladder exactly - the control's default is byte-identical to every prior lift.
  assert.deepEqual(liftDepths(slots, KF_Z_FIELD_CLAMP, 1), base, 'explicit 1 == default');
  assert.deepEqual(liftDepths(slots, KF_Z_FIELD_CLAMP, LIFT_STRENGTH.medium), base, 'Medium == the shipped ceiling');
  // A junk value can never zero or invert the ladder - it falls back to 1.
  for (const junk of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(liftDepths(slots, KF_Z_FIELD_CLAMP, junk), base, `junk strength ${junk} falls back to 1`);
  }

  const dramatic = liftDepths(slots, KF_Z_FIELD_CLAMP, LIFT_STRENGTH.dramatic);
  const subtle = liftDepths(slots, KF_Z_FIELD_CLAMP, LIFT_STRENGTH.subtle);
  const top = (z: number[]): number => z[z.length - 1]!;
  assert.ok(top(dramatic) > top(base), 'Dramatic stands the stack further off the board');
  assert.ok(top(subtle) < top(base), 'Subtle flattens it');

  // Shape is preserved at every strength: bottom on the surface, distinct + increasing.
  for (const z of [subtle, dramatic]) {
    assert.equal(z[0], 0, 'the bottom layer still rests on the surface');
    assert.equal(new Set(z).size, z.length, 'every depth distinct');
    assert.ok(z.every((v, i) => i === 0 || v > z[i - 1]!), 'strictly increasing');
  }
});

test('liftSlots: geometric PEERS share a rung, so a grid stays a grid', () => {
  // A 3x3 block of same-sized cards, painted row by row, plus a header above it.
  const card = (x: number, y: number) => ({ x, y, w: 100, h: 60 });
  const crops = [
    { x: 0, y: 0, w: 300, h: 20 },
    card(0, 40), card(110, 40), card(220, 40),
    card(0, 110), card(110, 110), card(220, 110),
    card(0, 180), card(110, 180), card(220, 180),
  ];
  const slots = liftSlots(crops);
  assert.equal(slots[0], 0, 'the header is its own surface');
  assert.deepEqual(slots.slice(1), Array(9).fill(1), 'all nine cards sit on ONE rung');
  const z = liftDepths(slots);
  // One rung, a whisper apart: distinct depths (so the depth sort has an order of
  // its own) inside a single band step (so the grid still reads as one surface).
  assert.equal(new Set(z).size, z.length, 'every depth is distinct');
  const eff = z.map((v) => 1200 / (1200 - v));
  const spread = Math.max(...eff.slice(1)) - Math.min(...eff.slice(1));
  assert.ok(spread <= LIFT_EFF_STEP + 1e-9, `the nine cards spread ${spread}, more than one band step`);
  assert.ok(z[1]! > z[0]!, 'above the header, which paints before them');
  assert.ok(z[9]! - z[1]! < z[1]! - z[0]!, 'the whole grid is closer together than one rung');
});

test('liftSlots: same size but nowhere near each other is not a grid', () => {
  const slots = liftSlots([
    { x: 0, y: 0, w: 40, h: 40 },
    { x: 500, y: 700, w: 40, h: 40 },
  ]);
  assert.deepEqual(slots, [0, 1], 'two icons in opposite corners are two surfaces');
});

test('liftSlots: coherence gives way where it would repaint overlapping ink', () => {
  // A and C are peers (same size, same column) with B between them - and B
  // overlaps C, so sharing a rung would sort C's ink under B's.
  const slots = liftSlots([
    { x: 0, y: 0, w: 50, h: 50 },
    { x: 0, y: 100, w: 200, h: 200 },
    { x: 0, y: 200, w: 50, h: 50 },
  ]);
  assert.deepEqual(slots, [0, 1, 2], 'the picture wins; the ladder goes back to one rung each');
});

test('liftSlots: a row with no measurable crop is always its own rung', () => {
  assert.deepEqual(liftSlots([null, null, null]), [0, 1, 2]);
  assert.deepEqual(liftSlots([undefined, { x: 0, y: 0, w: 10, h: 10 }]), [0, 1]);
});

test('liftRows: `shadow: depth` is pre-set, and can be opted out of', () => {
  assert.deepEqual((liftRows(liftSrc(), LAYERS, LIFT_CFG) as any[]).map((r) => r.shadow), ['depth', 'depth', 'depth']);
  assert.deepEqual((liftRows(liftSrc(), LAYERS, LIFT_CFG, { shadow: '' }) as any[]).map((r) => r.shadow),
    ['none', 'none', 'none'], 'shadow:"" leaves the source\'s own value alone');
});

test('liftRows: a deep stack never reaches the clamp - the band gets there first', () => {
  // The P3.1 acceptance failure, as a test: a 40-layer lift used to pin 24 rows at
  // the field ceiling with no parallax between them. The band means the clamp is
  // now unreachable by construction, and the clamp is still honoured if a caller
  // hands one that bites.
  const many = Array.from({ length: 40 }, (_, i) => ({ src: `s${i}`, id: `b${i}` }));
  const rows = liftRows(liftSrc(), many, LIFT_CFG, { zClamp: KF_Z_FIELD_CLAMP }) as any[];
  assert.ok(rows.every((r) => r.z > KF_Z_FIELD_CLAMP[0] && r.z < KF_Z_FIELD_CLAMP[1]),
    'no row sits at either end of the field clamp');
  assert.equal(new Set(rows.map((r) => r.z)).size, 40, 'forty distinct depths, none merged by a clamp');
  assert.ok(rows[39]!.z <= depthForEff(LIFT_EFF_CEIL) + 0.01, 'and the top of the stack is the band ceiling');
  const tight = liftRows(liftSrc(), many, LIFT_CFG, { zClamp: [0, 10] }) as any[];
  assert.ok(tight.every((r) => r.z <= 10), 'a clamp that does bite is still applied');
});

test('liftRows: paint order survives - bg on the bottom row, text on the top, artwork on each', () => {
  const rows = liftRows(liftSrc(), LAYERS, LIFT_CFG, { group: 'g9' }) as any[];
  assert.equal(rows[0]!.bg, '#101418', 'the background paints first, so it rides the bottom row');
  assert.equal(rows[0]!.grad, 'lin');
  assert.deepEqual([rows[1]!.bg, rows[2]!.bg], ['', ''], 'and is not composited N times over');
  assert.equal(rows[2]!.text, 'Caption', 'the text paints last, so it rides the top row');
  assert.deepEqual([rows[0]!.text, rows[1]!.text], ['', ''], 'and is not printed N times');
});

test('liftRows: a single-layer lift keeps the whole source row intact', () => {
  const rows = liftRows(liftSrc(), [LAYERS[0]!], LIFT_CFG) as any[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.bg, '#101418');
  assert.equal(rows[0]!.text, 'Caption');
  assert.equal(rows[0]!.z, 0);
});

test('liftRows: no layers is a no-op, not a box that lost its artwork', () => {
  assert.deepEqual(liftRows(liftSrc(), [], LIFT_CFG), []);
});

test('liftRows: the source object is never mutated', () => {
  const src = liftSrc();
  const snapshot = JSON.stringify(src);
  liftRows(src, LAYERS, LIFT_CFG, { group: 'g9' });
  assert.equal(JSON.stringify(src), snapshot);
});

test('applyLift: the rows land WHERE the source was - array order is z-order here', () => {
  const boxes: any[] = [{ id: 'a' }, liftSrc(), { id: 'c' }];
  const rows = liftRows(boxes[1], LAYERS, LIFT_CFG, { group: 'g9' });
  const out = applyLift(boxes, 1, rows) as any[];
  assert.deepEqual(out.map((b) => b.id), ['a', 'b2', 'b3', 'b4', 'c']);
  assert.equal(out.length, 5, 'the source row is replaced, never kept alongside');
  assert.deepEqual(boxes.map((b) => b.id), ['a', 'b1', 'c'], 'and the input array is untouched');
});

test('applyLift: an out-of-range index changes nothing', () => {
  const boxes: any[] = [{ id: 'a' }];
  assert.equal(applyLift(boxes, 5, [{ id: 'x' }]), boxes);
  assert.equal(applyLift(boxes, -1, [{ id: 'x' }]), boxes);
  assert.equal(applyLift(boxes, 0, []), boxes);
});

// ── layoutArtboards: imported pages as frames ──────────────────────────────────

const AB_CFG: any = {
  ...CFG, kindField: 'kind', groupField: 'group', clipField: 'clip', labelField: 'label', fillField: 'bg',
};
const abOpts = (o: any = {}): any => {
  let n = 0;
  return {
    cfg: AB_CFG, frameField: 'frame', frameKind: 'frame', orderField: 'order',
    frameSeed: { kind: 'frame', bg: '' }, mintId: () => `id${++n}`, background: '#ffffff', ...o,
  };
};
const page = (name: string, boxes: any[], w = 960, h = 540, extra: any = {}): any => ({ name, width: w, height: h, boxes, ...extra });

test('layoutArtboards: one frame per page, left to right, with the page’s parts inside it', () => {
  const rows = layoutArtboards([
    page('Slide 1', [{ id: 'p0', kind: 'text', x: 10, y: 20, w: 100, h: 30 }]),
    page('Slide 2', [{ id: 'p0', kind: 'box', x: 5, y: 5, w: 50, h: 50 }, { id: 'p1', kind: 'box', x: 0, y: 0, w: 1, h: 1 }]),
  ], abOpts());
  assert.equal(rows.length, 5, 'two frames + three members');
  const frames = rows.filter((r) => r.kind === 'frame');
  assert.deepEqual(frames.map((f) => [f.x, f.y, f.w, f.h, f.order, f.label]), [[0, 0, 960, 540, 0, 'Slide 1'], [960 + 77, 0, 960, 540, 1, 'Slide 2']],
    'the first at the origin; the gap is 8 % of the widest page');
  assert.deepEqual(frames.map((f) => f.frame), ['', ''], 'a frame never nests');
  assert.deepEqual(frames.map((f) => f.bg), ['#ffffff', '#ffffff'], 'the document ground on a frame with no fill');
  const m1 = rows[1]!, m2 = rows[3]!;
  assert.equal(m1.frame, frames[0]!.id);
  assert.deepEqual([m1.x, m1.y], [10, 20], 'page 1 members keep their place');
  assert.equal(m2.frame, frames[1]!.id);
  assert.deepEqual([m2.x, m2.y], [1037 + 5, 5], 'page 2 members shift by their frame’s x');
  assert.equal(new Set(rows.map((r) => r.id)).size, 5, 'fresh, unique ids - two pages both arrived as p0');
});

test('layoutArtboards: an imported slide’s SPEAKER NOTES land on the frame (P2)', () => {
  const rows = layoutArtboards([
    page('Slide 1', [], 960, 540, { notes: 'Open with the numbers.' }),
    page('Slide 2', []),
  ], abOpts({ notesField: 'notes' }));
  assert.equal(rows[0]!.notes, 'Open with the numbers.');
  assert.equal(rows[1]!.notes, undefined, 'a slide with none gets no empty field');
  // No notesField declared: the value is carried nowhere rather than onto a guessed key.
  const plain = layoutArtboards([page('Slide 1', [], 960, 540, { notes: 'x' })], abOpts());
  assert.equal(plain[0]!.notes, undefined);
});

test('layoutArtboards: references survive the re-id - clips re-point, groups stay per page', () => {
  const rows = layoutArtboards([
    page('A', [{ id: 'p0', kind: 'box', x: 0, y: 0, w: 10, h: 10, group: 'g1' }, { id: 'p1', kind: 'image', x: 0, y: 0, w: 10, h: 10, clip: 'p0', group: 'g1' }]),
    page('B', [{ id: 'p0', kind: 'box', x: 0, y: 0, w: 10, h: 10, group: 'g1' }]),
  ], abOpts());
  const [, a0, a1, , b0] = rows;
  assert.equal(a1!.clip, a0!.id, 'the mask id followed the box it names');
  assert.equal(a0!.group, a1!.group, 'page A’s pair is still one group');
  assert.notEqual(a0!.group, b0!.group, 'page B’s "g1" is not page A’s "g1"');
});

test('layoutArtboards: a page’s own ground beats the document’s; degenerate pages are dropped', () => {
  const rows = layoutArtboards([
    page('dark', [], 960, 540, { background: '#0C322C' }),
    page('empty', [], 0, 0),
    page('light', []),
  ], abOpts());
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.bg), ['#0C322C', '#ffffff']);
  assert.deepEqual(rows.map((r) => r.order), [0, 1]);
  assert.deepEqual(layoutArtboards([], abOpts()), []);
});
