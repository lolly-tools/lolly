// SPDX-License-Identifier: MPL-2.0
/**
 * Pure-logic tests for the web shell's free-canvas (WYSIWYG "editor" layout)
 * geometry helpers (shells/web/src/views/free-canvas-math.ts). These guard the
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
  snapMove, snapPoint, scaleGroup, rotateGroup,
  gradientLine, gradientPosAt, gradientAngleAt,
  resolveFrame, frameLocalXY, cascadeFrameMove, seedFrameOrder, renumberFrameOrder,
  sequenceFramesInOrder, framesAreSequenced,
} from '../shells/web/src/views/free-canvas-math.ts';

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
  // Compare raw (unrounded) corners — withRect's whole-px rounding would shift a
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

// A CIRCLE box (Layout Studio) resizes with keepAspect forced on, starting square, so
// every handle — corner AND edge — must keep w === h. An edge handle drives the other
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

// ── Frame primitive (plan 93 §5/§10) ─────────────────────────────────────────

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
    { id: 'a2', x: 100 }, // tie with 'a' — later in array keeps later order
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

test('sequenceFramesInOrder: idempotent in value — running it twice yields the same timing', () => {
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
