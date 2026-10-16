// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the selection-transform maths (`views/free-canvas-transform.ts`,
 * plan 311 M1): uniform Scale and its one clamped factor, the selection-level
 * resize, content scaling, the live box transform (checked against the Design
 * hook's own `boxCss`), grab zones in screen px, rotation-aware cursors, rotation
 * snapping and the two-finger pinch.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-transform.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SCALE_K_MAX, clampScaleK, handleScaleK, scaleSide, scaleRectAbout, uniformResize,
  SCALE_ANCHORS, anchorPoint, scaleRectAt, scaleMembersAt, OPPOSITE_HANDLE, handleAnchor,
  canResizeNonUniform, rectsAABB, transformSelection, handleDragPoint, touchedGuides,
  transformRules,
  contentScaleSpec, scaleBoxContent, scaledLayoutAxes, scaleChildOffset, scaleTextWrap, CONTENT_LENGTH_IDS, TEXT_WRAP_OFFSET_MAX,
  boxTransformCss, TILT_MAX_DEG,
  zoneAt, zoneLayout, zoneRects, smallObjectHandles, visibleExtent, largeZoneSize,
  GRAB_ZONE_MIN, GRAB_ZONE_MAX, ZONE_ROTATE, ROTATE_STEM, ROTATE_STEM_NARROW, ROTATE_STEM_SMALL, rotateStemFor,
  handleOutset, SMALL_HANDLE_OUTSET, zoneDragThreshold, ZONE_DRAG_PX, ZONE_DRAG_PX_COARSE,
  HANDLE_HALF, HANDLE_HALF_COARSE, HANDLE_FAT, drawnHandleReach, handleHitReach, onDrawnHandle,
  resizeCursorFor, rotateCursorAt, rotateCursorFor, snapAngleHard, rotateSnap, pinchTransform,
  PINCH_MAX_COVER, PINCH_SECOND_MS, PINCH_TRAVEL_PX, pinchFits, pinchMembers, pinchReaches, visibleRect, inMoveBand, MIN_MOVE_PX,
  PINCH_SPREAD_PX, pinchCatchUp, easePinch,
} from './free-canvas-transform.ts';
import type { BoxPose, ContentScaleSpec, FieldBounds, ModifierKeys, ScreenRect, TransformKind, ViewRect, ZoneOpts } from './free-canvas-transform.ts';
import { rotateVec } from './free-canvas-math.ts';
import type { AABB, Box, Guide, HandleName, Point, Rect, StartRect } from './free-canvas-math.ts';

const near = (a: number, b: number, eps = 1e-6, msg?: string): void => {
  assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} != ${b}`);
};
const nearRect = (a: Rect, b: Partial<Rect>, eps = 1e-6): void => {
  for (const k of ['x', 'y', 'w', 'h', 'rot'] as const) if (b[k] != null) near(a[k], b[k]!, eps, `${k}: ${a[k]} != ${b[k]}`);
};
const SIGN: Record<HandleName, [number, number]> = {
  n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1],
};
/** The world point at local sign (sx, sy) of a rotated rect: a corner, an edge midpoint or the centre. */
const localPt = (r: StartRect, sx: number, sy: number): Point => {
  const v = rotateVec((sx * r.w) / 2, (sy * r.h) / 2, r.rot || 0);
  return { x: r.x + r.w / 2 + v.x, y: r.y + r.h / 2 + v.y };
};

// ── Uniform scale ────────────────────────────────────────────────────────────

test('clampScaleK: a 120x10 box at 0.5 clamps to 0.8 so the 10 px side keeps the 8 px minimum', () => {
  assert.equal(clampScaleK(0.5, [{ w: 120, h: 10 }], 8), 0.8);
  const r = uniformResize({ x: 0, y: 0, w: 120, h: 10 }, 'se', -60, 0, { minSize: 8 });
  near(r.k, 0.8);
  nearRect(r.rect, { x: 0, y: 0, w: 96, h: 8 });
});

test('clampScaleK: ONE factor for the set, decided by the member closest to minSize', () => {
  const set = [{ w: 120, h: 10 }, { w: 100, h: 100 }];
  assert.equal(clampScaleK(0.5, set, 8), 0.8);
  assert.equal(clampScaleK(0.9, set, 8), 0.9);
  assert.equal(clampScaleK(3, set, 8), 3);
});

test('clampScaleK: a degenerate axis is exempt and the line scales on its length', () => {
  near(clampScaleK(0.01, [{ w: 200, h: 0 }], 8), 0.04);
  near(clampScaleK(0.01, [{ w: 200, h: 0 }, { w: 100, h: 100 }], 8), 0.08);
  // Both sides already under minSize: only the 0.01 floor applies.
  assert.equal(clampScaleK(0.001, [{ w: 4, h: 4 }], 8), 0.01);
});

test('clampScaleK: k stays positive, caps at 100, and NaN reads as no change', () => {
  assert.equal(clampScaleK(-3, [{ w: 100, h: 100 }], 8), 0.08);
  assert.equal(clampScaleK(0, [{ w: 100, h: 100 }], 8), 0.08);
  assert.equal(clampScaleK(500, [{ w: 100, h: 100 }], 8), SCALE_K_MAX);
  assert.equal(clampScaleK(Infinity, [], 8), SCALE_K_MAX);
  assert.equal(clampScaleK(Number.NaN, [{ w: 100, h: 100 }], 8), 1);
  assert.equal(clampScaleK(5, [{ w: 100, h: 100 }], 8, 2), 2);
});

test('handleScaleK: a corner follows the axis that moved further, an edge its own axis', () => {
  const r = { x: 0, y: 0, w: 100, h: 50 };
  near(handleScaleK(r, 'se', 50, 10), 1.5); // sx 1.5 beats sy 1.2
  near(handleScaleK(r, 'se', 10, 50), 2); // sy 2 beats sx 1.1
  near(handleScaleK(r, 'se', 0, 60), 2.2); // a vertical-only drag still scales
  near(handleScaleK(r, 'nw', -50, 0), 1.5);
  near(handleScaleK(r, 'e', 50, 999), 1.5); // the free axis is ignored
  near(handleScaleK(r, 'n', 999, -25), 1.5);
  near(handleScaleK(r, 'e', 10, 0, true), 1.2); // from the centre: twice the delta
});

test('handleScaleK projects the delta onto the box axes at 30, 90 and 180 degrees', () => {
  for (const rot of [30, 90, 180]) {
    const r = { x: 0, y: 0, w: 100, h: 50, rot };
    const along = rotateVec(20, 0, rot); // 20 px along the box's own +x
    near(handleScaleK(r, 'e', along.x, along.y), 1.2, 1e-9, `rot ${rot}`);
    const down = rotateVec(0, 25, rot); // 25 px along the box's own +y
    near(handleScaleK(r, 's', down.x, down.y), 1.5, 1e-9, `rot ${rot}`);
  }
});

test('scaleRectAbout holds the opposite corner, the opposite edge midpoint or the centre, rotated or not', () => {
  for (const rot of [0, 30, 90, 180]) {
    const start = { x: 40, y: 20, w: 100, h: 50, rot };
    for (const handle of Object.keys(SIGN) as HandleName[]) {
      const [hx, hy] = SIGN[handle];
      const out = scaleRectAbout(start, handle, 1.7);
      near(out.w, 170); near(out.h, 85); assert.equal(out.rot, rot);
      const a0 = localPt(start, -hx, -hy), a1 = localPt(out, -hx, -hy);
      near(a1.x, a0.x, 1e-9, `${handle}@${rot} x`); near(a1.y, a0.y, 1e-9, `${handle}@${rot} y`);
      const c = scaleRectAbout(start, handle, 1.7, true);
      near(c.x + c.w / 2, 90); near(c.y + c.h / 2, 45);
    }
  }
});

test('uniformResize on a rotated box keeps the anchor and the aspect', () => {
  const start = { x: 0, y: 0, w: 100, h: 50, rot: 90 };
  // The box's own +x points down the screen at 90 degrees.
  const { rect, k } = uniformResize(start, 'e', 0, 50, { minSize: 8 });
  near(k, 1.5);
  nearRect(rect, { w: 150, h: 75, rot: 90 });
  const a0 = localPt(start, -1, 0), a1 = localPt(rect, -1, 0);
  near(a1.x, a0.x); near(a1.y, a0.y);
});

test('uniformResize from the centre is mirrored, so the dragged edge follows the pointer', () => {
  const start = { x: 0, y: 0, w: 100, h: 50 };
  const mirrored = uniformResize(start, 'e', 20, 0, { fromCentre: true });
  near(mirrored.k, 1.4, 1e-9, 'the dragged edge follows the pointer');
  nearRect(mirrored.rect, { x: -20, w: 140, h: 70 });
  near(mirrored.rect.x + mirrored.rect.w / 2, 50); near(mirrored.rect.y + mirrored.rect.h / 2, 25);
  near(uniformResize(start, 'e', 20, 0).k, 1.2, 1e-9, 'without Alt the width grows by the delta');
});

// ── The per-member floor: a thin side never reaches 0 ────────────────────────

test('scaleSide keeps a side thinner than minSize at its own size, and 0 stays 0', () => {
  assert.equal(scaleSide(200, 0.5, 8), 100, 'a side over minSize follows the factor');
  assert.equal(scaleSide(1, 0.3, 8), 1, 'a 1 px side keeps its 1 px instead of 0.3, which rounds to 0');
  assert.equal(scaleSide(4, 0.1, 8), 4);
  assert.equal(scaleSide(1, 3, 8), 3, 'and still grows');
  assert.equal(scaleSide(0, 0.5, 8), 0, 'a 0-height line stays a line');
  assert.equal(scaleSide(1, 0.3, 0), 0.3, 'minSize 0 is no floor at all');
});

test('uniformResize: a 300 x 1 rule scaled on its e edge keeps its 1 px height and its anchor', () => {
  const start = { x: 100, y: 200, w: 300, h: 1 };
  const { rect, k } = uniformResize(start, 'e', -220, 0, { minSize: 8 });
  near(k, 80 / 300);
  nearRect(rect, { x: 100, y: 200, w: 80, h: 1 });
  assert.ok(Math.round(rect.h) >= 1, 'never committed as 0');
});

test('scaleRectAbout with minSize holds the anchor when a side keeps its size, rotated or not', () => {
  for (const rot of [0, 30, 90]) {
    const start = { x: 40, y: 20, w: 300, h: 2, rot };
    for (const handle of Object.keys(SIGN) as HandleName[]) {
      const [hx, hy] = SIGN[handle];
      const out = scaleRectAbout(start, handle, 0.25, false, 8);
      near(out.w, 75); near(out.h, 2, 1e-9, `${handle}@${rot}: the 2 px side stays`);
      const a0 = localPt(start, -hx, -hy), a1 = localPt(out, -hx, -hy);
      near(a1.x, a0.x, 1e-9, `${handle}@${rot} x`); near(a1.y, a0.y, 1e-9, `${handle}@${rot} y`);
    }
  }
});

test('scaleRectAt and scaleMembersAt floor a thin side as the drag does', () => {
  nearRect(scaleRectAt({ x: 0, y: 0, w: 300, h: 1 }, 'w', 0.3, 8), { x: 0, w: 90, h: 1 });
  const set: StartRect[] = [{ x: 0, y: 0, w: 300, h: 200 }, { x: 20, y: 100, w: 260, h: 1 }];
  const out = scaleMembersAt(set, { x: 0, y: 0 }, 0.3, 8);
  nearRect(out[0]!, { x: 0, y: 0, w: 90, h: 60 });
  nearRect(out[1]!, { w: 78, h: 1 });
  near(out[1]!.x + out[1]!.w / 2, 0.3 * 150, 1e-9, 'its centre still maps about the point');
  near(out[1]!.y + out[1]!.h / 2, 0.3 * 100.5, 1e-9);
});

test('transformSelection never shrinks a 1 px member to 0, free, uniform or from the centre', () => {
  const members: StartRect[] = [{ x: 0, y: 0, w: 300, h: 1 }, { x: 0, y: 10, w: 300, h: 200 }];
  const box = rectsAABB(members)!;
  // sy = 0.3 on the s edge: the divider's 0.3 px would round to 0.
  const opts = [{ minSize: 8 }, { minSize: 8, uniformOnly: true }, { minSize: 8, fromCentre: true }, { minSize: 8, keepAspect: true }];
  for (const o of opts) {
    const t = transformSelection(members, box, 's', 0, -box.h * 0.7, o);
    assert.ok(t.rects[0]!.h >= 1, `${JSON.stringify(o)}: h ${t.rects[0]!.h}`);
    assert.ok(Math.round(t.rects[0]!.h) >= 1);
  }
  // A 4 px box beside a 100 px one, dragged far past the left: the set stops at the
  // larger box's floor, and the 4 px side keeps its 4 px.
  const thin: StartRect[] = [{ x: 0, y: 0, w: 4, h: 100 }, { x: 10, y: 0, w: 100, h: 100 }];
  const free = transformSelection(thin, rectsAABB(thin)!, 'e', -800, 0, { minSize: 8 });
  near(free.sx, 0.08);
  nearRect(free.rects[0]!, { w: 4, h: 100 });
  const turned = thin.map((m, i) => (i === 1 ? { ...m, rot: 30 } : m));
  const uni = transformSelection(turned, rectsAABB(turned)!, 'e', -800, 0, { minSize: 8 });
  assert.equal(uni.uniform, true);
  near(uni.rects[0]!.w, 4); near(uni.rects[0]!.h, 8);
});

test('anchorPoint picks the nine points of a selection, and SCALE_ANCHORS lists them row by row', () => {
  const a = { minX: 10, minY: 20, maxX: 110, maxY: 70 };
  assert.deepEqual(SCALE_ANCHORS, ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se']);
  assert.deepEqual(SCALE_ANCHORS.map((n) => anchorPoint(a, n)), [
    { x: 10, y: 20 }, { x: 60, y: 20 }, { x: 110, y: 20 },
    { x: 10, y: 45 }, { x: 60, y: 45 }, { x: 110, y: 45 },
    { x: 10, y: 70 }, { x: 60, y: 70 }, { x: 110, y: 70 },
  ]);
});

test('scaleRectAt holds the chosen anchor of a box still, rotated or not', () => {
  for (const rot of [0, 30, 90]) {
    const start = { x: 40, y: 20, w: 100, h: 50, rot };
    for (const anchor of SCALE_ANCHORS) {
      const out = scaleRectAt(start, anchor, 2);
      near(out.w, 200); near(out.h, 100); assert.equal(out.rot, rot);
      const [sx, sy] = anchor === 'c' ? [0, 0] : SIGN[anchor];
      const p0 = localPt(start, sx, sy), p1 = localPt(out, sx, sy);
      near(p1.x, p0.x, 1e-9, `${anchor}@${rot} x`); near(p1.y, p0.y, 1e-9, `${anchor}@${rot} y`);
    }
  }
});

// ── Selection resize and scale ───────────────────────────────────────────────

const pair: StartRect[] = [{ x: 0, y: 0, w: 100, h: 50 }, { x: 200, y: 0, w: 100, h: 50 }];
const pairBox = rectsAABB(pair)!;

test('rectsAABB unions rotated rects', () => {
  assert.deepEqual(pairBox, { minX: 0, minY: 0, maxX: 300, maxY: 50, w: 300, h: 50 });
  const turned = rectsAABB([{ x: 0, y: 0, w: 100, h: 50, rot: 90 }])!;
  near(turned.minX, 25); near(turned.maxX, 75); near(turned.minY, -25); near(turned.maxY, 75);
  assert.equal(rectsAABB([]), null);
});

test('transformSelection: a free corner drag on axis-aligned members is non-uniform', () => {
  const t = transformSelection(pair, pairBox, 'se', 300, 0);
  assert.equal(t.uniform, false);
  assert.equal(t.sx, 2); assert.equal(t.sy, 1); assert.equal(t.k, 1);
  nearRect(t.rects[0]!, { x: 0, y: 0, w: 200, h: 50 });
  nearRect(t.rects[1]!, { x: 400, y: 0, w: 200, h: 50 });
  assert.deepEqual(t.aabb, { minX: 0, minY: 0, maxX: 600, maxY: 50, w: 600, h: 50 });
  assert.deepEqual(t.anchor, { x: 0, y: 0 });
});

test('transformSelection: Shift (keepAspect) makes the same drag uniform', () => {
  const t = transformSelection(pair, pairBox, 'se', 300, 0, { keepAspect: true });
  assert.equal(t.uniform, true);
  assert.equal(t.k, 2); assert.equal(t.sy, 2);
  nearRect(t.rects[1]!, { x: 400, y: 0, w: 200, h: 100 });
});

test('transformSelection: an edge is one axis, or that axis for both about the opposite edge midpoint', () => {
  const free = transformSelection(pair, pairBox, 'e', 300, 40);
  assert.equal(free.sx, 2); assert.equal(free.sy, 1);
  const uni = transformSelection(pair, pairBox, 'e', 300, 40, { uniformOnly: true });
  assert.equal(uni.k, 2);
  assert.deepEqual(uni.anchor, { x: 0, y: 25 });
  nearRect(uni.rects[0]!, { x: 0, y: -25, w: 200, h: 100 });
  const n = transformSelection(pair, pairBox, 'n', 0, -50, { uniformOnly: true });
  assert.equal(n.k, 2);
  assert.deepEqual(n.anchor, { x: 150, y: 50 });
});

test('transformSelection: Alt scales about the centre, mirrored so the edge follows the pointer', () => {
  const t = transformSelection(pair, pairBox, 'e', 150, 0, { fromCentre: true });
  assert.equal(t.sx, 2);
  assert.deepEqual(t.anchor, { x: 150, y: 25 });
  near(t.aabb.maxX, 450); // the pointer started at 300 and moved 150
  near(t.aabb.minX, -150);
});

test('transformSelection: a member turned 90 degrees swaps its factors; 180 does not', () => {
  const members: StartRect[] = [{ x: 0, y: 0, w: 100, h: 50, rot: 90 }, { x: 100, y: 0, w: 100, h: 50, rot: 180 }];
  const box = rectsAABB(members)!;
  assert.equal(canResizeNonUniform(members), true);
  const t = transformSelection(members, box, 'e', box.w, 0);
  assert.equal(t.uniform, false);
  assert.equal(t.sx, 2); assert.equal(t.sy, 1);
  nearRect(t.rects[0]!, { w: 100, h: 100, rot: 90 }); // its h runs along world x
  nearRect(t.rects[1]!, { w: 200, h: 50, rot: 180 });
  // Each member's world extent now matches the scaled box.
  const after = rectsAABB(t.rects)!;
  near(after.minX, t.aabb.minX); near(after.maxX, t.aabb.maxX);
  near(after.minY, t.aabb.minY); near(after.maxY, t.aabb.maxY);
});

test('transformSelection: a member at 30 degrees forces a uniform factor', () => {
  const members: StartRect[] = [{ x: 0, y: 0, w: 100, h: 50, rot: 30 }, { x: 200, y: 0, w: 100, h: 50 }];
  assert.equal(canResizeNonUniform(members), false);
  const box = rectsAABB(members)!;
  const t = transformSelection(members, box, 'se', box.w, 0);
  assert.equal(t.uniform, true);
  assert.equal(t.sx, t.sy);
  nearRect(t.rects[0]!, { w: 200, h: 100, rot: 30 });
});

test('transformSelection: minSize clamps one factor per axis, or one for the set', () => {
  const members: StartRect[] = [{ x: 0, y: 0, w: 100, h: 10 }, { x: 0, y: 20, w: 100, h: 100 }];
  const box = rectsAABB(members)!;
  const free = transformSelection(members, box, 's', 0, -60, { minSize: 8 });
  assert.equal(free.sy, 0.8); assert.equal(free.sx, 1);
  nearRect(free.rects[0]!, { h: 8 });
  const uni = transformSelection(members, box, 'se', -60, -60, { minSize: 8, uniformOnly: true });
  assert.equal(uni.k, 0.8);
  nearRect(uni.rects[0]!, { w: 80, h: 8 });
  nearRect(uni.rects[1]!, { w: 80, h: 80 });
});

test('transformSelection: a 0-height line is exempt from the minimum on its thin axis', () => {
  const members: StartRect[] = [{ x: 0, y: 0, w: 200, h: 0 }, { x: 0, y: 10, w: 100, h: 100 }];
  const box = rectsAABB(members)!;
  const t = transformSelection(members, box, 'se', -199, 0, { minSize: 8, uniformOnly: true });
  near(t.k, 0.08);
});

test('canResizeNonUniform tolerates rounding near quarter turns only', () => {
  assert.equal(canResizeNonUniform([{ rot: 0 }, { rot: 90 }, { rot: -90 }, { rot: 270 }, { rot: 180 }, { rot: 89.995 }, {}]), true);
  assert.equal(canResizeNonUniform([{ rot: 30 }]), false);
  assert.equal(canResizeNonUniform([{ rot: 90.5 }]), false);
});

test('handleAnchor is the opposite corner or edge midpoint, and the transform holds the same point', () => {
  const a = { minX: 10, minY: 20, maxX: 110, maxY: 70 };
  const want: Record<HandleName, Point> = {
    nw: { x: 110, y: 70 }, n: { x: 60, y: 70 }, ne: { x: 10, y: 70 }, e: { x: 10, y: 45 },
    se: { x: 10, y: 20 }, s: { x: 60, y: 20 }, sw: { x: 110, y: 20 }, w: { x: 110, y: 45 },
  };
  for (const h of Object.keys(want) as HandleName[]) {
    assert.deepEqual(handleAnchor(a, h), want[h], h);
    assert.equal(OPPOSITE_HANDLE[OPPOSITE_HANDLE[h]], h, `${h} is its opposite's opposite`);
    const t = transformSelection(pair, { ...a }, h, 7, 9);
    assert.deepEqual(t.anchor, want[h], `${h}: transformSelection holds the same point`);
  }
});

test('handleDragPoint is the dragged corner or edge moved by the pointer, on the axes the handle drives', () => {
  const a = { minX: 10, minY: 20, maxX: 110, maxY: 70 };
  assert.deepEqual(handleDragPoint(a, 'se', 5, -3), { x: 115, y: 67 });
  assert.deepEqual(handleDragPoint(a, 'nw', 5, -3), { x: 15, y: 17 });
  assert.deepEqual(handleDragPoint(a, 'e', 5, -3), { x: 115, y: null });
  assert.deepEqual(handleDragPoint(a, 'n', 5, -3), { x: null, y: 17 });
  // The dragged edge follows the pointer from the centre too, so the point and the edge stay together.
  for (const fromCentre of [false, true]) {
    const t = transformSelection(pair, pairBox, 'e', 40, 0, { fromCentre });
    near(t.aabb.maxX, handleDragPoint(pairBox, 'e', 40, 0).x!);
  }
});

test('touchedGuides keeps only the guides a moving edge reaches, on the axes the drag drives', () => {
  const a = { minX: 0, minY: 0, maxX: 200.3, maxY: 100 };
  const v = (x: number): Guide => ({ x1: x, y1: 0, x2: x, y2: 1000 });
  const hz = (y: number): Guide => ({ x1: 0, y1: y, x2: 1000, y2: y });
  const slope: Guide = { x1: 0, y1: 0, x2: 100, y2: 100 };
  assert.deepEqual(touchedGuides([v(200), v(203), hz(100), slope], a, { x: true, y: true }), [v(200), hz(100)]);
  assert.deepEqual(touchedGuides([v(200), hz(100)], a, { x: true, y: false }), [v(200)], 'an e edge drag draws no horizontal guide');
  assert.deepEqual(touchedGuides([v(0.4)], a, { x: true, y: false }), [v(0.4)], 'a mirrored drag reaches a guide with either edge');
  assert.deepEqual(touchedGuides([], a, { x: true, y: true }), []);
});

test('touchedGuides keeps an angled guide only when the dragged corner lies on the slope', () => {
  const a = { minX: 0, minY: 0, maxX: 100, maxY: 100.3 };
  const slope: Guide = { x1: 0, y1: 0, x2: 400, y2: 400 };
  const off: Guide = { x1: 0, y1: 50, x2: 400, y2: 450 };
  assert.deepEqual(touchedGuides([slope, off], a, { x: true, y: true }, { x: 100, y: 100.3 }), [slope]);
  assert.deepEqual(touchedGuides([slope], a, { x: true, y: true }), [], 'no corner, no slope: a uniform or edge drag');
});

// ── The modifier table ───────────────────────────────────────────────────────

test('transformRules is the plan 311 modifier table, one row per key and transform', () => {
  const rules = (kind: TransformKind, keys: ModifierKeys = {}) => transformRules(kind, keys);
  // Resize: Shift aspect, Alt centre with snapping on, Cmd or Ctrl suspends snapping.
  assert.deepEqual(rules('resize'), { keepAspect: false, fromCentre: false, snap: true, rotate: { shift: false, free: false } });
  assert.equal(rules('resize', { shiftKey: true }).keepAspect, true);
  assert.deepEqual([rules('resize', { altKey: true }).fromCentre, rules('resize', { altKey: true }).snap], [true, true]);
  assert.equal(rules('resize', { metaKey: true }).snap, false);
  assert.equal(rules('resize', { ctrlKey: true }).snap, false);
  // Scale: always uniform, Alt centre, Cmd or Ctrl suspends snapping.
  assert.equal(rules('scale').keepAspect, true);
  assert.deepEqual(rules('scale', { shiftKey: true }), rules('scale'), 'Shift changes nothing in Scale');
  assert.deepEqual([rules('scale', { altKey: true }).fromCentre, rules('scale', { altKey: true }).snap], [true, true]);
  assert.equal(rules('scale', { ctrlKey: true }).snap, false);
  // Rotate: magnet, Shift hard steps, Alt, Cmd or Ctrl free; never the guides.
  assert.deepEqual(rules('rotate').rotate, { shift: false, free: false });
  assert.deepEqual(rules('rotate', { shiftKey: true }).rotate, { shift: true, free: false });
  for (const k of ['altKey', 'metaKey', 'ctrlKey'] as const) assert.deepEqual(rules('rotate', { [k]: true }).rotate, { shift: false, free: true }, k);
  assert.equal(rules('rotate').snap, false);
  // Move: Alt and Cmd or Ctrl suspend snapping; a move keeps no aspect and has no centre.
  assert.equal(rules('move').snap, true);
  for (const k of ['altKey', 'metaKey', 'ctrlKey'] as const) assert.equal(rules('move', { [k]: true }).snap, false, k);
  assert.deepEqual([rules('move', { shiftKey: true, altKey: true }).keepAspect, rules('move', { altKey: true }).fromCentre], [false, false]);
  // A rotate rule never leaks into a resize, and Shift wins over a free turn (rotateSnap).
  assert.deepEqual(rules('resize', { shiftKey: true, altKey: true }).rotate, { shift: false, free: false });
  assert.equal(rotateSnap(8, rules('rotate', { shiftKey: true, altKey: true }).rotate), 15);
});

// ── Content scaling ──────────────────────────────────────────────────────────

interface ManifestField { id: string; min?: number; max?: number }
const designTool = JSON.parse(readFileSync(new URL('../../../../community/design/tool.json', import.meta.url), 'utf8')) as {
  inputs: Array<{ id: string; fields?: ManifestField[] }>;
};
const designFields = designTool.inputs.find((i) => i.id === 'boxes')!.fields!;
const designBounds = new Map<string, FieldBounds>(
  designFields.filter((f) => f.min != null || f.max != null).map((f) => [f.id, { min: f.min, max: f.max }]),
);
/** The Design tool's real spec: the canvas block's field names plus its declared fields and bounds. */
const DESIGN: ContentScaleSpec = contentScaleSpec({
  fontSizeField: 'fontSize', radiusField: 'radius', strokeWField: 'strokeW', padField: 'pad', trackingField: 'tracking',
  shadowXField: 'shadowX', shadowYField: 'shadowY', shadowBlurField: 'shadowBlur',
  declared: designFields.map((f) => f.id),
  bounds: designBounds,
});

test('contentScaleSpec resolves the Design subset and never lists a multiplier or an angle', () => {
  for (const f of ['fontSize', 'radius', 'strokeW', 'pad', 'tracking', 'shadowX', 'shadowY', 'shadowBlur', ...CONTENT_LENGTH_IDS]) {
    assert.ok(DESIGN.lengths.includes(f), f);
  }
  for (const f of ['lineHeight', 'opacity', 'rot', 'rx', 'ry', 'z', 'x', 'w']) assert.ok(!DESIGN.lengths.includes(f), f);
  assert.equal(DESIGN.dashArray, 'strokeDashArray');
  assert.equal(DESIGN.textWrap, 'textWrap');
  assert.equal(DESIGN.webView, 'webView');
  // A tool that maps a content name onto a never-scaled field still keeps the field out.
  assert.deepEqual(contentScaleSpec({ fontSizeField: 'lineHeight', padField: 'pad' }).lengths, ['pad']);
  // A tool without the declared layout/effect fields gets only its own subset.
  const org = contentScaleSpec({ fontSizeField: 'fontSize', declared: ['fontSize', 'x', 'y'], bounds: { fontSize: { min: 6 } } });
  assert.deepEqual(org.lengths, ['fontSize']);
  assert.equal(org.dashArray, null);
  assert.deepEqual(org.bounds.get('fontSize'), { min: 6 });
});

test('scaleBoxContent scales every content length by k and leaves the rest alone', () => {
  const box: Box = {
    id: 'a', x: 10, y: 20, w: 100, h: 50, fontSize: 48, radius: 16, strokeW: 2, pad: 8, tracking: 1.5,
    shadowX: -4, shadowY: 6, shadowBlur: 10, blur: 3, bgBlur: 0, strokeDashLen: 5, strokeGapLen: 3,
    layoutGapX: 12, layoutPadTop: 4, layoutMarginLeft: 6, layoutMaxW: 300,
    lineHeight: 1.2, opacity: 80, rot: 30, rx: 10, ry: 5, z: 3,
  };
  const out = scaleBoxContent(box, 2, DESIGN);
  assert.notEqual(out, box);
  assert.deepEqual(out, {
    ...box, fontSize: 96, radius: 32, strokeW: 4, pad: 16, tracking: 3, shadowX: -8, shadowY: 12, shadowBlur: 20,
    blur: 6, strokeDashLen: 10, strokeGapLen: 6, layoutGapX: 24, layoutPadTop: 8, layoutMarginLeft: 12, layoutMaxW: 600,
  });
  assert.equal(box.fontSize, 48, 'the input row is not mutated');
});

test('scaleBoxContent writes only present, non-empty, finite values and never creates a field', () => {
  const box: Box = { fontSize: '48', layoutMarginTop: '', layoutMinW: null, strokeW: 0, pad: 'wide', radius: Number.NaN };
  const out = scaleBoxContent(box, 2, DESIGN);
  assert.equal(out.fontSize, 96, 'a numeric string scales and is written as a number');
  assert.equal(out.layoutMarginTop, '');
  assert.equal(out.layoutMinW, null);
  assert.equal(out.strokeW, 0, 'strokeW 0 stays 0');
  assert.equal(out.pad, 'wide');
  assert.ok(Number.isNaN(out.radius as number));
  for (const f of ['layoutMaxW', 'shadowBlur', 'blur', 'strokeDashArray', 'textWrap', 'webView']) assert.ok(!(f in out), f);
});

test('scaleBoxContent on the current row keeps an edit made after the start', () => {
  // A Scale scales the row it commits onto: a font size another editor changed during
  // the drag grows from its new value, and every field it does not own stays as found.
  const current: Box = { id: 'a', x: 5, fontSize: 22, strokeW: 0, radius: 8, lineHeight: 1.2, fill: '#000' };
  assert.deepEqual(scaleBoxContent(current, 2, DESIGN), { ...current, fontSize: 44, radius: 16 });
});

test('scaledLayoutAxes writes only the fixed axes of a layout row', () => {
  assert.deepEqual(scaledLayoutAxes({}), { w: true, h: true }, 'absent means fixed, the manifest default');
  assert.deepEqual(scaledLayoutAxes({ layoutW: 'hug', layoutH: 'fixed' }), { w: false, h: true });
  assert.deepEqual(scaledLayoutAxes({ layoutW: 'fixed', layoutH: 'fill' }), { w: true, h: false });
});

/** The offset the layout stores for a child: its turned corner from the parent's, in the
 *  parent's axes (free-canvas/shared.ts `relativePlacement`, restated). */
const placement = (child: StartRect, parent: StartRect): Point => {
  const c = localPt(child, -1, -1), p = localPt(parent, -1, -1), d = rotateVec(c.x - p.x, c.y - p.y, -(parent.rot || 0));
  return { x: d.x, y: d.y };
};

test('scaleChildOffset grows an absolute child offset by k in its container axes', () => {
  const parent = { x: 100, y: 50, w: 200, h: 100 };
  const child = { x: 130, y: 70, w: 40, h: 20 };
  const at = scaleChildOffset(parent, child, { w: 80, h: 40 }, 2);
  assert.deepEqual(at, { x: 160, y: 90 }, 'the corner 30, 20 from the container corner moves to 60, 40');
  const out = { ...at, w: 80, h: 40 };
  assert.deepEqual(placement(out, parent), { x: 60, y: 40 });
});

test('scaleChildOffset holds for a turned container and child and any anchor', () => {
  const parent: StartRect = { x: 40, y: 60, w: 300, h: 160, rot: 30 };
  const child: StartRect = { x: 120, y: 130, w: 50, h: 24, rot: 45 };
  const k = 1.75;
  const out = { w: child.w * k, h: child.h * k, rot: child.rot };
  const at = scaleChildOffset(parent, child, out, k);
  const before = placement(child, parent), after = placement({ ...at, ...out }, parent);
  near(after.x, before.x * k); near(after.y, before.y * k);
  // The layout puts the child at its new offset from the container's NEW corner. Scaled
  // about a far anchor, that is exactly where a scale of the child about the same anchor puts the child.
  const anchor = { x: 900, y: -400 };
  const about = (p: Point): Point => ({ x: anchor.x + (p.x - anchor.x) * k, y: anchor.y + (p.y - anchor.y) * k });
  const corner = about(localPt(parent, -1, -1)), offset = rotateVec(after.x, after.y, parent.rot!);
  const placed = { x: corner.x + offset.x, y: corner.y + offset.y }, wanted = about(localPt(child, -1, -1));
  near(placed.x, wanted.x, 1e-9); near(placed.y, wanted.y, 1e-9);
});

test('scaleBoxContent returns the same object when nothing changes', () => {
  const plain: Box = { x: 0, w: 10, lineHeight: 1.2, strokeW: 0, layoutMarginTop: '', strokeDashArray: '' };
  assert.equal(scaleBoxContent(plain, 3, DESIGN), plain);
  const sized: Box = { fontSize: 20 };
  assert.equal(scaleBoxContent(sized, 1, DESIGN), sized);
  assert.equal(scaleBoxContent(sized, 0, DESIGN), sized);
  assert.equal(scaleBoxContent(sized, -2, DESIGN), sized);
  assert.equal(scaleBoxContent(sized, Number.NaN, DESIGN), sized);
  // A factor too small to move a 0.1 px value.
  assert.equal(scaleBoxContent({ pad: 0.1 } as Box, 1.2, DESIGN).pad, 0.1);
});

test('scaleBoxContent rounds to 0.1 px and never rounds a non-zero length to 0', () => {
  const out = scaleBoxContent({ fontSize: 13, tracking: -0.3, pad: 0.4, shadowX: -0.2 }, 1.15, DESIGN);
  assert.equal(out.fontSize, 15);
  assert.equal(out.tracking, -0.3);
  const tiny = scaleBoxContent({ pad: 0.4, shadowX: -0.2 }, 0.1, DESIGN);
  assert.equal(tiny.pad, 0.1);
  assert.equal(tiny.shadowX, -0.1);
});

test('scaleBoxContent clamps to manifest bounds without reversing the change', () => {
  const up = scaleBoxContent({ strokeW: 300, shadowBlur: 200, tracking: 300 }, 2, DESIGN);
  assert.equal(up.strokeW, 400);
  assert.equal(up.shadowBlur, 300);
  assert.equal(up.tracking, 400);
  const down = scaleBoxContent({ fontSize: 6, shadowX: -200 }, 0.5, DESIGN);
  assert.equal(down.fontSize, 4, 'fontSize keeps its manifest minimum');
  assert.equal(down.shadowX, -100);
  // Already outside its bounds (blocks are not clamped on write): never pulled back across the start.
  const over = { strokeW: 500 };
  assert.equal(scaleBoxContent(over, 2, DESIGN), over);
  assert.equal(scaleBoxContent(over, 0.5, DESIGN).strokeW, 250);
  const under = { fontSize: 3 };
  assert.equal(scaleBoxContent(under, 0.5, DESIGN), under);
});

test('scaleBoxContent scales each dash and keeps the stored form; empty or invalid stays', () => {
  assert.equal(scaleBoxContent({ strokeDashArray: '6 4' }, 1.5, DESIGN).strokeDashArray, '9 6');
  assert.equal(scaleBoxContent({ strokeDashArray: '6,4 0' }, 2, DESIGN).strokeDashArray, '12 8 0');
  for (const raw of ['', '   ', 'abc', '0 0', '-1 2']) {
    const box: Box = { strokeDashArray: raw };
    assert.equal(scaleBoxContent(box, 2, DESIGN), box, JSON.stringify(raw));
  }
  // The same numbers in a different spelling are not rewritten.
  const spelled: Box = { strokeDashArray: '0.04, 4' };
  assert.equal(scaleBoxContent(spelled, 1.01, DESIGN).strokeDashArray, '0.1 4');
});

test('scaleTextWrap scales the four offsets and keeps every other key in order', () => {
  const raw = '{"mode":"box","offset":{"top":8,"right":4,"bottom":0,"left":2.5},"x":1}';
  assert.equal(scaleTextWrap(raw, 2), '{"mode":"box","offset":{"top":16,"right":8,"bottom":0,"left":5},"x":1}');
  assert.equal(scaleTextWrap('{"mode":"contour","offset":{"top":800,"right":1,"bottom":1,"left":1}}', 2),
    `{"mode":"contour","offset":{"top":${TEXT_WRAP_OFFSET_MAX},"right":2,"bottom":2,"left":2}}`);
  assert.equal(scaleTextWrap('{"mode":"box","offset":{"top":0,"right":0,"bottom":0,"left":0}}', 2), null);
  for (const bad of ['', '{bad', '[]', '"box"', '{"mode":"box"}', '{"mode":"box","offset":[1,2]}']) {
    assert.equal(scaleTextWrap(bad, 2), null, bad);
  }
  const box: Box = { textWrap: '{not json' };
  assert.equal(scaleBoxContent(box, 2, DESIGN), box, 'invalid wrap JSON is left alone');
  assert.equal(scaleBoxContent({ textWrap: '{"mode":"box","offset":{"top":8,"right":8,"bottom":8,"left":8}}' }, 0.5, DESIGN).textWrap,
    '{"mode":"box","offset":{"top":4,"right":4,"bottom":4,"left":4}}');
});

test('scaleBoxContent: webView 0 takes the start width so the page zooms; a set width is left', () => {
  assert.equal(scaleBoxContent({ webView: 0 }, 2, DESIGN, { startWidth: 640.4 }).webView, 640);
  assert.equal(scaleBoxContent({ webView: '0' }, 2, DESIGN, { startWidth: 390 }).webView, 390);
  assert.equal(scaleBoxContent({ webView: 0 }, 2, DESIGN, { startWidth: 5000 }).webView, 3840, 'manifest max');
  for (const box of [{ webView: 1280 }, { webView: '' }, {}, { webView: 0 }] as Box[]) {
    const opts = 'webView' in box && box.webView === 0 ? {} : { startWidth: 640 };
    assert.equal(scaleBoxContent(box, 2, DESIGN, opts), box, JSON.stringify([box, opts]));
  }
});

// ── Live box transform ───────────────────────────────────────────────────────

// The Design hook's own boxCss, loaded the way the runtime loads hooks.
const hookSource = readFileSync(new URL('../../../../community/design/hooks.js', import.meta.url), 'utf8');
const hookBoxCss = new Function('host', `${hookSource}; return boxCss;`)({}) as (b: Box, grad: string) => string;
const renderedTransform = (pose: BoxPose): string => /(?:^|;)transform:([^;]*);/.exec(hookBoxCss({ x: 0, y: 0, w: 10, h: 10, ...pose }, ''))?.[1] ?? '';

test('boxTransformCss at k = 1 is byte-identical to the transform the Design render writes', () => {
  const rots = [undefined, 0, 30, -45.25, 90, 180, '12.5', 0.01, 'junk'];
  const flips = [[undefined, undefined], [true, false], [false, true], ['1', 'true'], ['false', 'off']];
  const tilts = [[undefined, undefined], [10, 0], [0, -20], [12.345, 80], ['5', '-90'], [0.004, 0]];
  let n = 0;
  for (const rot of rots) for (const [flipH, flipV] of flips) for (const [rx, ry] of tilts) {
    const pose = { rot, flipH, flipV, rx, ry } as BoxPose;
    assert.equal(boxTransformCss(pose), renderedTransform(pose), JSON.stringify(pose));
    assert.equal(boxTransformCss(pose, 1), renderedTransform(pose));
    n++;
  }
  assert.ok(n > 200);
});

test('boxTransformCss inserts scale(k) between the rotate and the flip, after the tilt', () => {
  assert.equal(boxTransformCss({ rot: 30, flipH: true }, 1.5), 'rotate(30deg) scale(1.5) scale(-1,1)');
  assert.equal(boxTransformCss({ rot: 30, flipH: true, rx: 10, ry: 5 }, 2),
    'perspective(1200px) rotateY(5deg) rotateX(10deg) rotate(30deg) scale(2) scale(-1,1)');
  assert.equal(boxTransformCss({}, 0.5), 'scale(0.5)');
  assert.equal(boxTransformCss({}, 1 / 3), 'scale(0.333333)');
  assert.equal(boxTransformCss({}), '');
  assert.equal(boxTransformCss({ ry: 200 }), `perspective(1200px) rotateY(${TILT_MAX_DEG}deg)`);
  // A factor that is not a usable scale draws the box at its own size.
  assert.equal(boxTransformCss({ rot: 10 }, 0), 'rotate(10deg)');
  assert.equal(boxTransformCss({ rot: 10 }, Number.NaN), 'rotate(10deg)');
});

// ── Grab zones ───────────────────────────────────────────────────────────────

const VIEW: ViewRect = { x: 0, y: 0, w: 2000, h: 2000 };
const mouse = (extra: Partial<ZoneOpts> = {}): ZoneOpts => ({ pointerKind: 'mouse', large: false, viewport: VIEW, allowRotate: true, ...extra });
const touch = (extra: Partial<ZoneOpts> = {}): ZoneOpts => ({ pointerKind: 'touch', large: true, viewport: VIEW, allowRotate: true, ...extra });
const R: ScreenRect = { x: 100, y: 100, w: 200, h: 100 };
const at = (x: number, y: number, rect: ScreenRect = R, opts: ZoneOpts = mouse()) => zoneAt({ x, y }, rect, opts);

test('zoneAt: an 8 px strip centred on each edge, and the interior falls through', () => {
  assert.deepEqual(at(200, 100), { kind: 'edge', handle: 'n', outside: false });
  assert.deepEqual(at(200, 96), { kind: 'edge', handle: 'n', outside: true });
  assert.deepEqual(at(200, 104), { kind: 'edge', handle: 'n', outside: false });
  assert.equal(at(200, 95.9), null);
  assert.equal(at(200, 104.1), null);
  assert.deepEqual(at(303, 150), { kind: 'edge', handle: 'e', outside: true });
  assert.deepEqual(at(200, 198), { kind: 'edge', handle: 's', outside: false });
  assert.deepEqual(at(98, 150), { kind: 'edge', handle: 'w', outside: true });
  assert.equal(at(200, 150), null, 'no centre zone');
  assert.equal(at(120, 120), null);
});

test('zoneAt: corners beat edges, and rotate zones sit just outside the corners', () => {
  assert.deepEqual(at(101, 101), { kind: 'corner', handle: 'nw', outside: false });
  assert.deepEqual(at(109, 100), { kind: 'corner', handle: 'nw', outside: false });
  assert.deepEqual(at(111, 100), { kind: 'edge', handle: 'n', outside: false });
  assert.deepEqual(at(306, 206), { kind: 'corner', handle: 'se', outside: true });
  assert.deepEqual(at(85, 85), { kind: 'rotate', handle: 'nw', outside: true });
  assert.deepEqual(at(95, 75), { kind: 'rotate', handle: 'nw', outside: true });
  assert.deepEqual(at(315, 215), { kind: 'rotate', handle: 'se', outside: true });
  assert.equal(at(69, 69), null, 'beyond the rotate band');
  assert.equal(at(85, 85, R, mouse({ allowRotate: false })), null);
  assert.equal(at(85, 85, R, mouse({ rotateZone: 0 })), null);
});

test('zoneAt: a mouse press 10 px outside a corner is in the rotate band', () => {
  assert.deepEqual(at(90, 90), { kind: 'rotate', handle: 'nw', outside: true });
  assert.deepEqual(at(310, 90), { kind: 'rotate', handle: 'ne', outside: true });
  assert.deepEqual(at(310, 100), { kind: 'rotate', handle: 'ne', outside: true }, 'straight out from the corner too');
  assert.deepEqual(at(94, 94), { kind: 'corner', handle: 'nw', outside: true }, '6 px out is still the corner');
  assert.equal(at(73, 73), null, 'the band is 20 px wide, from 6 to 26 px out');
  assert.deepEqual(at(90, 90, R, mouse({ allowRotate: false })), { kind: 'corner', handle: 'nw', outside: true }, 'with no band the corner reaches 10 px');
});

test('zoneAt: touch strips are 12 px, and an explicit strip wins', () => {
  const t = mouse({ pointerKind: 'touch' });
  assert.equal(at(200, 95, R, mouse()), null);
  assert.deepEqual(at(200, 95, R, t), { kind: 'edge', handle: 'n', outside: true });
  assert.equal(at(200, 93.9, R, t), null);
  assert.deepEqual(at(200, 91, R, mouse({ strip: 20 })), { kind: 'edge', handle: 'n', outside: true });
});

test('zoneAt: zones keep their screen size at scale 0.5, 1 and 2', () => {
  const native = { x: 50, y: 50, w: 400, h: 200 };
  for (const scale of [0.5, 1, 2]) {
    const rect = { x: native.x * scale, y: native.y * scale, w: native.w * scale, h: native.h * scale };
    const midX = rect.x + rect.w / 2;
    assert.deepEqual(zoneAt({ x: midX, y: rect.y - 3.9 }, rect, mouse()), { kind: 'edge', handle: 'n', outside: true }, `scale ${scale}`);
    assert.equal(zoneAt({ x: midX, y: rect.y - 4.1 }, rect, mouse()), null, `scale ${scale}`);
    // The same strip in native px is 8 / scale thick.
    const nativeStrip = 8 / scale;
    assert.deepEqual(zoneAt({ x: midX, y: (native.y - nativeStrip / 2 + 0.01) * scale }, rect, mouse())?.handle, 'n');
  }
});

test('zoneAt works in the rect frame at 30, 90 and 180 degrees', () => {
  for (const rot of [30, 90, 180]) {
    const rect = { ...R, rot };
    const c = { x: 200, y: 150 };
    const p = (lx: number, ly: number): Point => { const v = rotateVec(lx, ly, rot); return { x: c.x + v.x, y: c.y + v.y }; };
    assert.equal(zoneAt(p(0, -50)!, rect, mouse())?.handle, 'n', `rot ${rot}`);
    assert.equal(zoneAt(p(102, 0), rect, mouse())?.handle, 'e', `rot ${rot}`);
    assert.deepEqual(zoneAt(p(-100, 50), rect, mouse()), { kind: 'corner', handle: 'sw', outside: false });
    assert.deepEqual(zoneAt(p(115, -65), rect, mouse()), { kind: 'rotate', handle: 'ne', outside: true });
    assert.equal(zoneAt(p(0, 0), rect, mouse()), null);
  }
  // At 90 degrees the box's own e edge is at the bottom of the screen.
  assert.equal(zoneAt({ x: 200, y: 252 }, { ...R, rot: 90 }, mouse())?.handle, 'e');
});

test('zoneAt: a small box gets its zones outside, so its whole inside still moves', () => {
  const thin = { x: 100, y: 100, w: 20, h: 200 };
  assert.equal(zoneLayout(thin, mouse()).mode, 'outside');
  assert.equal(at(110, 200, thin), null);
  assert.equal(at(102, 200, thin), null, 'no strip inside the edge');
  assert.deepEqual(at(97, 200, thin), { kind: 'edge', handle: 'w', outside: true });
  assert.deepEqual(at(97, 97, thin), { kind: 'corner', handle: 'nw', outside: true });
  // 10 px or less drops the corners; the edges and rotate zones stay outside.
  const tiny = { x: 100, y: 100, w: 8, h: 8 };
  const kinds = zoneRects(tiny, mouse()).map((z) => z.kind);
  assert.ok(!kinds.includes('corner'));
  assert.equal(at(104, 104, tiny), null, 'the inside of a tiny box moves');
  assert.equal(at(104, 97, tiny)?.handle, 'n');
  assert.deepEqual(at(97, 97, tiny), { kind: 'rotate', handle: 'nw', outside: true });
});

test('zoneAt: a 0-height line keeps a 10 px band to move by', () => {
  const line = { x: 100, y: 100, w: 200, h: 0 };
  assert.equal(at(200, 100, line), null);
  assert.equal(at(200, 104, line), null);
  assert.equal(at(200, 94, line)?.handle, 'n');
  assert.equal(at(200, 106, line)?.handle, 's');
});

test('zoneAt: a touch corner just over the small threshold still leaves the centre free', () => {
  const box = { x: 100, y: 100, w: 30, h: 30 };
  const t = mouse({ pointerKind: 'touch' });
  assert.equal(zoneLayout(box, t).mode, 'inside');
  assert.equal(at(115, 115, box, t), null);
  assert.equal(at(101, 101, box, t)?.kind, 'corner');
});

test('zoneLayout: large zones are a quarter of the visible rect, clamped to 24-44 px', () => {
  const big = zoneLayout({ x: 100, y: 100, w: 400, h: 200 }, touch());
  assert.equal(big.mode, 'large');
  assert.equal(big.cornerW, GRAB_ZONE_MAX); assert.equal(big.cornerH, GRAB_ZONE_MAX);
  const mid = zoneLayout({ x: 100, y: 100, w: 160, h: 120 }, touch());
  assert.equal(mid.mode, 'large');
  assert.equal(mid.cornerW, 40); assert.equal(mid.cornerH, 30);
  const r = { x: 100, y: 100, w: 160, h: 120 };
  assert.deepEqual(at(135, 125, r, touch()), { kind: 'corner', handle: 'nw', outside: false });
  assert.deepEqual(at(135, 160, r, touch()), { kind: 'edge', handle: 'w', outside: false });
  assert.deepEqual(at(180, 102, r, touch()), { kind: 'edge', handle: 'n', outside: false });
  assert.equal(at(180, 160, r, touch()), null, 'no centre zone');
  assert.equal(at(135, 160, r, mouse()), null, 'the default sizing has no such zone');
});

test('zoneLayout sizes large zones from the VISIBLE part of a rect partly off screen', () => {
  const view = { x: 0, y: 0, w: 1000, h: 800 };
  const rect = { x: -680, y: 100, w: 800, h: 400 }; // 120 px of it on screen
  assert.deepEqual(visibleExtent(rect, view), { w: 120, h: 400 });
  const layout = zoneLayout(rect, touch({ viewport: view }));
  assert.equal(layout.mode, 'large');
  assert.equal(layout.cornerW, 30);
  assert.equal(layout.cornerH, GRAB_ZONE_MAX);
  // The visible stretch of the bottom edge is a side zone; points off screen hit nothing.
  assert.deepEqual(zoneAt({ x: 60, y: 490 }, rect, touch({ viewport: view })), { kind: 'edge', handle: 's', outside: false });
  assert.equal(zoneAt({ x: -10, y: 490 }, rect, touch({ viewport: view })), null);
  // A rotated rect clipped by the viewport measures along its own axes.
  const turned = visibleExtent({ x: -50, y: 100, w: 100, h: 100, rot: 90 }, { x: 0, y: 0, w: 1000, h: 1000 });
  near(turned.w, 100); near(turned.h, 50);
  assert.deepEqual(visibleExtent({ x: 5000, y: 0, w: 10, h: 10 }, view), { w: 0, h: 0 });
});

test('zoneLayout: narrow mode moves large zones outside when the visible side is under 3 corners', () => {
  const thin = { x: 100, y: 100, w: 60, h: 300 };
  assert.equal(zoneLayout(thin, touch()).mode, 'narrow');
  assert.equal(at(103, 250, thin, touch()), null, 'the inside moves');
  assert.equal(at(130, 250, thin, touch()), null);
  assert.deepEqual(at(80, 250, thin, touch()), { kind: 'edge', handle: 'w', outside: true });
  assert.deepEqual(at(85, 85, thin, touch()), { kind: 'corner', handle: 'nw', outside: true });
  assert.equal(at(100 - GRAB_ZONE_MIN - 1, 250, thin, touch()), null);
  assert.equal(at(70, 70, thin, touch()), null, 'touch keeps the lollipop: no rotate band by default');
  assert.deepEqual(at(70, 70, thin, touch({ rotateZone: ZONE_ROTATE })), { kind: 'rotate', handle: 'nw', outside: true });
  // Mostly off screen: 50 visible px of a big rect is narrow too.
  const off = zoneLayout({ x: -950, y: 100, w: 1000, h: 400 }, touch({ viewport: { x: 0, y: 0, w: 1000, h: 1000 } }));
  assert.equal(off.mode, 'narrow');
});

test('largeZoneSize is the sizing zoneLayout uses, from the visible rect, at scale 0.5, 1 and 2', () => {
  const native = { x: 40, y: 40, w: 120, h: 300 };
  const expected = [
    { scale: 0.5, size: { cornerW: 24, cornerH: 37.5, narrow: true } },
    { scale: 1, size: { cornerW: 30, cornerH: GRAB_ZONE_MAX, narrow: false } },
    { scale: 2, size: { cornerW: GRAB_ZONE_MAX, cornerH: GRAB_ZONE_MAX, narrow: false } },
  ];
  for (const { scale, size } of expected) {
    const rect = { x: native.x * scale, y: native.y * scale, w: native.w * scale, h: native.h * scale };
    assert.deepEqual(largeZoneSize(rect, VIEW), size, `scale ${scale}`);
    const layout = zoneLayout(rect, touch());
    assert.equal(layout.mode, size.narrow ? 'narrow' : 'large', `scale ${scale}`);
    assert.deepEqual([layout.cornerW, layout.cornerH], [size.cornerW, size.cornerH]);
  }
  // A big rect with only 60 px on screen is narrow: the visible part decides.
  assert.equal(largeZoneSize({ x: -1000, y: 100, w: 1060, h: 400 }, VIEW).narrow, true);
  assert.equal(largeZoneSize({ x: -1000, y: 100, w: 1060, h: 400 }, { x: -2000, y: 0, w: 4000, h: 2000 }).narrow, false);
});

test('in narrow mode the rotate handle hangs clear of the zones below the selection', () => {
  // The rotate handle is hit up to 18 px from its centre on a coarse pointer (an 18 px
  // dot with a 9 px target round it, editor.css).
  const reach = 18;
  const thin = { x: 100, y: 100, w: 60, h: 300 };
  assert.equal(zoneLayout(thin, touch()).mode, 'narrow');
  const s = { x: 130, y: 400 }; // the s edge midpoint
  assert.equal(zoneAt({ x: s.x, y: s.y + ROTATE_STEM_NARROW - reach }, thin, touch()), null, 'the top of its target is past every zone');
  assert.deepEqual(zoneAt({ x: s.x, y: s.y + GRAB_ZONE_MIN }, thin, touch()), { kind: 'edge', handle: 's', outside: true });
  assert.ok(ROTATE_STEM - reach < GRAB_ZONE_MIN, 'the usual stem would cover the side zone');
  assert.ok(ROTATE_STEM_NARROW - reach > GRAB_ZONE_MIN);
});

test('rotateStemFor hangs the rotate handle past a stood-off s handle, and past narrow zones', () => {
  assert.equal(rotateStemFor(200, 100), ROTATE_STEM);
  assert.equal(rotateStemFor(100, 20), ROTATE_STEM_SMALL, 'a short box stands its s handle off');
  assert.equal(rotateStemFor(20, 100), ROTATE_STEM, 'a narrow width hides s, so nothing stands below');
  assert.equal(rotateStemFor(8, 8), ROTATE_STEM_SMALL, 'a tiny box shows s again, stood off');
  assert.equal(rotateStemFor(60, 300, true), ROTATE_STEM_NARROW);
  assert.equal(rotateStemFor(100, 20, true), ROTATE_STEM_NARROW, 'the longer of the two');
  // On a coarse pointer the stood-off s handle is hit out to 12 + 8 px, and the rotate
  // handle 18 px round its centre.
  const sOuter = SMALL_HANDLE_OUTSET + 8;
  assert.ok(ROTATE_STEM_SMALL - 18 > sOuter, 'clear of the s handle');
  assert.ok(ROTATE_STEM - 18 < sOuter, 'the usual stem would cover its lower half');
});

test('zoneRects: the hover geometry is the hit geometry, in priority order', () => {
  const zones = zoneRects(R, mouse());
  assert.deepEqual(zones.map((z) => `${z.kind}:${z.handle}`), [
    'corner:nw', 'corner:ne', 'corner:se', 'corner:sw', 'edge:n', 'edge:e', 'edge:s', 'edge:w',
    'rotate:nw', 'rotate:ne', 'rotate:se', 'rotate:sw',
  ]);
  assert.equal(zoneRects(R, mouse({ allowRotate: false })).length, 8);
  assert.deepEqual(zoneRects(R, mouse({ edgesOnly: true })).filter((z) => z.kind !== 'rotate').map((z) => z.handle), ['n', 'e', 's', 'w']);
  const nw = zones[0]!;
  // 10 px in, and 6 px out where the rotate band begins.
  assert.deepEqual(nw.parts, [{ x0: -106, x1: -90, y0: -56, y1: -40 }]);
  assert.deepEqual(nw.quads[0], [{ x: 94, y: 94 }, { x: 110, y: 94 }, { x: 110, y: 110 }, { x: 94, y: 110 }]);
  assert.deepEqual(zoneRects(R, mouse({ allowRotate: false }))[0]!.parts, [{ x0: -110, x1: -90, y0: -60, y1: -40 }], 'with no band beside it a corner reaches 10 px out');
  assert.equal(zones.find((z) => z.kind === 'rotate')!.parts.length, 2, 'the rotate zone is an L around the corner');
  // Every quad corner of a turned rect is the local corner rotated about the centre.
  const turned = zoneRects({ ...R, rot: 30 }, mouse());
  const q = turned[4]!.quads[0]![0]!, l = turned[4]!.parts[0]!;
  const v = rotateVec(l.x0, l.y0, 30);
  near(q.x, 200 + v.x); near(q.y, 150 + v.y);
});

test('smallObjectHandles: 25 px hides that axis\'s midpoints and moves corners out; 10 px drops corners', () => {
  assert.deepEqual(smallObjectHandles(30, 30), { hide: [], outward: false });
  assert.deepEqual(smallObjectHandles(25, 100), { hide: ['n', 's'], outward: true });
  assert.deepEqual(smallObjectHandles(100, 20), { hide: ['e', 'w'], outward: true });
  assert.deepEqual(smallObjectHandles(20, 20), { hide: ['n', 's', 'e', 'w'], outward: true });
  // With the corners gone the short edges keep their midpoints, stood off.
  assert.deepEqual(smallObjectHandles(8, 100), { hide: ['nw', 'ne', 'se', 'sw'], outward: true });
  assert.deepEqual(smallObjectHandles(100, 10), { hide: ['nw', 'ne', 'se', 'sw'], outward: true });
  assert.deepEqual(smallObjectHandles(8, 8), { hide: ['nw', 'ne', 'se', 'sw'], outward: true });
});

test('smallObjectHandles: a thin rule or a straight line keeps a handle at each end for its length', () => {
  for (const [w, h, ends] of [[400, 2, ['e', 'w']], [400, 0, ['e', 'w']], [2, 400, ['n', 's']], [20, 1, ['e', 'w']]] as const) {
    const { hide } = smallObjectHandles(w, h);
    for (const end of ends) assert.ok(!hide.includes(end), `${w} x ${h} keeps ${end}`);
  }
});

/** The handle sizes editor.css draws: `.fc-handle`'s width, and its width under
 *  any-pointer: coarse. A stood-off handle is hit on that square alone. */
const editorCss = readFileSync(new URL('../styles/parts/editor.css', import.meta.url), 'utf8');
const handlePx = (css: string): number => Number(/\.fc-handle\s*\{[^}]*?width:\s*(\d+)px/.exec(css)?.[1]);
const HANDLE_SIZES = [handlePx(editorCss), handlePx(editorCss.slice(editorCss.indexOf('@media (any-pointer: coarse)')))];

test('a stood-off handle never reaches into a small box, at either handle size and any turn', () => {
  assert.deepEqual(HANDLE_SIZES, [12, 16], 'the sizes read from editor.css');
  assert.match(editorCss, /\.fc-handle\[data-outward\]::after\s*\{\s*content:\s*none;?\s*\}/, 'a stood-off handle has no wider hit area');
  // Separating axes: the screen axes (the handle square's) and the box's own two.
  const clear = (c: Point, half: number, hw: number, hh: number, rot: number): boolean => {
    const u = rotateVec(1, 0, rot), v = rotateVec(0, 1, rot);
    return [{ x: 1, y: 0 }, { x: 0, y: 1 }, u, v].some((a) =>
      Math.abs(c.x * a.x + c.y * a.y) >= half * (Math.abs(a.x) + Math.abs(a.y)) + hw * Math.abs(u.x * a.x + u.y * a.y) + hh * Math.abs(v.x * a.x + v.y * a.y) - 1e-9);
  };
  const sizes = [1, 2, 8, 10, 11, 12, 14, 18, 20, 25, 60, 300];
  let checked = 0;
  for (const size of HANDLE_SIZES) {
    for (const w of sizes) for (const h of sizes) {
      const small = smallObjectHandles(w, h);
      if (!small.outward) continue;
      for (const rot of [0, 15, 30, 45, 60, 90, 135, -20]) {
        for (const handle of Object.keys(SIGN) as HandleName[]) {
          if (small.hide.includes(handle)) continue;
          const [sx, sy] = SIGN[handle];
          const on = rotateVec((sx * w) / 2, (sy * h) / 2, rot);
          const o = handleOutset(handle, rot);
          assert.ok(clear({ x: on.x + o.x, y: on.y + o.y }, size / 2, w / 2, h / 2, rot),
            `${size} px handle ${handle} on a ${w} x ${h} box turned ${rot} reaches into the box`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 1000);
});

test('handleHitReach is the drawn handle\'s hit area as editor.css sizes the handles, and a finger\'s full reach for a finger', () => {
  const fat = Number(/\.fc-handle::after\s*\{[^}]*inset:\s*-(\d+)px/.exec(editorCss)?.[1]);
  assert.deepEqual([HANDLE_HALF * 2, HANDLE_HALF_COARSE * 2, HANDLE_FAT], [...HANDLE_SIZES, fat], 'the sizes read from editor.css');
  assert.match(editorCss, /@media \(pointer: fine\)\s*\{\s*\.fc-chrome\[data-zones\] \.fc-handle:is\(\.fc-h-nw, \.fc-h-ne, \.fc-h-se, \.fc-h-sw\)::after\s*\{\s*content:\s*none;?\s*\}/,
    'a fine pointer\'s corner has no fat target while the zones are live');
  // Where the zones are off no rotate zone lies past a corner, and the corner keeps the
  // fat target: the one rule that drops the target sits under the data-zones chrome.
  const cornerRules = editorCss.match(/^[^{}\n]*\.fc-h-nw, \.fc-h-ne, \.fc-h-se, \.fc-h-sw\)::after[^{]*\{[^}]*content:\s*none/gm) ?? [];
  assert.equal(cornerRules.length, 1, 'one rule drops the corner fat target');
  assert.match(cornerRules[0]!, /^\s*\.fc-chrome\[data-zones\] \.fc-handle:is\(/, 'and the rule is gated on the live zones');
  assert.deepEqual(handleHitReach('mouse'), { corner: 6, edge: 15, square: 6 }, 'a desktop, by default');
  assert.deepEqual(handleHitReach('pen', { coarse: true, fine: false }), { corner: 17, edge: 17, square: 8 }, 'a tablet');
  assert.deepEqual(handleHitReach('mouse', { coarse: true, fine: true }), { corner: 8, edge: 17, square: 8 }, 'a touch laptop');
  assert.deepEqual(handleHitReach('touch', { coarse: false, fine: true }), { corner: 17, edge: 17, square: 8 }, 'a finger, whatever the media');
});

test('drawnHandleReach is the drawn handle for the media, whichever pointer presses: a finger on a touch laptop meets a corner on its square', () => {
  const laptop = { coarse: true, fine: true }, tablet = { coarse: true, fine: false };
  assert.deepEqual(drawnHandleReach(), { corner: 6, edge: 15, square: 6 }, 'a desktop, by default');
  assert.deepEqual(drawnHandleReach(laptop), { corner: HANDLE_HALF_COARSE, edge: 17, square: 8 }, 'a touch laptop: the corner is its 16 px square');
  assert.deepEqual(drawnHandleReach(tablet), { corner: 17, edge: 17, square: 8 }, 'a tablet: the corner carries its fat target');
  // A mouse or a pen meets the drawn handle where its zones reach.
  for (const media of [laptop, tablet, { coarse: false, fine: true }, { coarse: false, fine: false }]) {
    for (const kind of ['mouse', 'pen'] as const) assert.deepEqual(handleHitReach(kind, media), drawnHandleReach(media), `${kind} ${JSON.stringify(media)}`);
  }
  // A finger 12 px out on the nw diagonal: in the corner's zone on both, on the drawn
  // corner only on the tablet, so on the touch laptop an object there keeps the press.
  const r = { x: 100, y: 100, w: 200, h: 200 };
  const p = { x: 88, y: 88 };
  for (const [media, drawn] of [[laptop, false], [tablet, true]] as const) {
    const zone = zoneAt(p, r, touch({ handleReach: handleHitReach('touch', media) }));
    assert.deepEqual(zone, { kind: 'corner', handle: 'nw', outside: true }, `the zone reaches a finger's 17 px (${JSON.stringify(media)})`);
    assert.equal(onDrawnHandle(p, r, 'nw', drawnHandleReach(media)), drawn, `on the drawn corner (${JSON.stringify(media)})`);
  }
  // The edge handles keep their fat target on both.
  for (const media of [laptop, tablet]) assert.ok(onDrawnHandle({ x: 200, y: 84 }, r, 'n', drawnHandleReach(media)));
  assert.ok(!onDrawnHandle({ x: 200, y: 82.9 }, r, 'n', drawnHandleReach(laptop)));
});

test('onDrawnHandle: the square and its fat target round a corner or midpoint, the square alone when stood off, none when hidden', () => {
  const reach = handleHitReach('mouse');
  const r = { x: 100, y: 100, w: 200, h: 100 };
  assert.ok(onDrawnHandle({ x: 94, y: 94 }, r, 'nw', reach));
  assert.ok(!onDrawnHandle({ x: 93.9, y: 100 }, r, 'nw', reach), 'a fine pointer\'s corner is its square');
  assert.ok(onDrawnHandle({ x: 215, y: 85 }, r, 'n', reach), 'an edge handle carries the fat target');
  assert.ok(!onDrawnHandle({ x: 215.1, y: 100 }, r, 'n', reach));
  assert.ok(!onDrawnHandle({ x: 150, y: 100 }, r, 'n', reach), 'only round the midpoint');
  // Turned, the handle is drawn square to the screen on the turned corner.
  const c = rotateVec(-100, -50, 30);
  assert.ok(onDrawnHandle({ x: 200 + c.x + 5.9, y: 150 + c.y - 5.9 }, { ...r, rot: 30 }, 'nw', reach));
  assert.ok(!onDrawnHandle({ x: 200 + c.x + 6.1, y: 150 + c.y }, { ...r, rot: 30 }, 'nw', reach));
  // A small rect stands its handles off and hits them on the square alone.
  const small = { x: 100, y: 100, w: 20, h: 20 };
  const o = 100 - SMALL_HANDLE_OUTSET;
  assert.ok(onDrawnHandle({ x: o - 6, y: o + 6 }, small, 'nw', reach));
  assert.ok(!onDrawnHandle({ x: 100, y: 100 }, small, 'nw', reach), 'the outline is clear of a stood-off handle');
  assert.ok(!onDrawnHandle({ x: 110, y: o }, small, 'n', reach), 'a hidden handle is not drawn');
});

test('zoneLayout: the large zones reach as far out as the drawn handles, at scale 0.5, 1 and 2', () => {
  const native = { x: 100, y: 100, w: 200, h: 200 };
  const large = mouse({ large: true });
  for (const scale of [0.5, 1, 2]) {
    const r = { x: native.x * scale, y: native.y * scale, w: native.w * scale, h: native.h * scale };
    assert.equal(zoneLayout(r, touch()).mode, 'large', `scale ${scale}`);
    const midX = r.x + r.w / 2, midY = r.y + r.h / 2;
    // A finger: 17 px out at every handle, the coarse square and its fat target.
    assert.deepEqual(zoneAt({ x: r.x - 16.9, y: r.y - 16.9 }, r, touch()), { kind: 'corner', handle: 'nw', outside: true }, `scale ${scale}`);
    assert.equal(zoneAt({ x: r.x - 17.1, y: r.y - 17.1 }, r, touch()), null, `scale ${scale}`);
    assert.deepEqual(zoneAt({ x: r.x - 16.9, y: midY }, r, touch()), { kind: 'edge', handle: 'w', outside: true }, `scale ${scale}`);
    // A mouse with the preference: the corner square's 6 px, then the rotate band; a side 15 px.
    assert.deepEqual(zoneAt({ x: r.x - 5.9, y: r.y - 5.9 }, r, large), { kind: 'corner', handle: 'nw', outside: true }, `scale ${scale}`);
    assert.deepEqual(zoneAt({ x: r.x - 6.1, y: r.y - 6.1 }, r, large), { kind: 'rotate', handle: 'nw', outside: true }, `scale ${scale}`);
    assert.deepEqual(zoneAt({ x: midX, y: r.y - 14.9 }, r, large), { kind: 'edge', handle: 'n', outside: true }, `scale ${scale}`);
    assert.equal(zoneAt({ x: midX, y: r.y - 15.1 }, r, large), null, `scale ${scale}`);
  }
  const sq = { x: 100, y: 100, w: 200, h: 200 };
  // The media the caller measured win: a tablet's corners reach 17 px.
  assert.deepEqual(zoneAt({ x: 84, y: 84 }, sq, mouse({ large: true, handleReach: handleHitReach('pen', { coarse: true, fine: false }) }))?.kind, 'corner');
  // A handle is square to the screen, so on a turned box its square reaches further
  // along the box's own axes.
  near(zoneRects({ ...sq, rot: 45 }, large)[0]!.parts[0]!.x0, -100 - 6 * Math.SQRT2);
  near(zoneRects({ ...sq, rot: 90 }, large)[0]!.parts[0]!.x0, -106);
  // Narrow mode keeps its 24 px outside, which covers every handle.
  assert.equal(zoneRects({ x: 100, y: 100, w: 60, h: 300 }, touch())[0]!.parts[0]!.x0, -30 - GRAB_ZONE_MIN);
});

test('handleOutset moves a corner out along its diagonal and a midpoint straight out, turning with the box', () => {
  assert.deepEqual(handleOutset('se'), { x: SMALL_HANDLE_OUTSET, y: SMALL_HANDLE_OUTSET });
  assert.deepEqual(handleOutset('nw', 0, 6), { x: -6, y: -6 });
  assert.deepEqual(handleOutset('e', 0, 6), { x: 6, y: 0 });
  assert.deepEqual(handleOutset('n', 0, 6), { x: 0, y: -6 });
  // A quarter turn clockwise points the box's e side down the screen.
  const e90 = handleOutset('e', 90, 6);
  near(e90.x, 0); near(e90.y, 6);
  const ne90 = handleOutset('ne', 90, 6);
  near(ne90.x, 6); near(ne90.y, 6);
  assert.deepEqual(handleOutset('e', Number.NaN, 6), { x: 6, y: 0 }, 'a turn that is not a number counts as none');
});

test('zoneDragThreshold: 4 px for a mouse, 10 px for a finger or a pen', () => {
  assert.equal(ZONE_DRAG_PX, 4);
  assert.equal(ZONE_DRAG_PX_COARSE, 10);
  assert.equal(zoneDragThreshold('mouse'), 4);
  assert.equal(zoneDragThreshold('pen'), 10);
  assert.equal(zoneDragThreshold('touch'), 10);
});

// ── Cursors and rotation snapping ────────────────────────────────────────────

test('rotateCursorFor wraps the corner a rotate zone sits at, turning with the box', () => {
  assert.equal(rotateCursorFor('ne'), 'rotate-ne');
  assert.equal(rotateCursorFor('se', 0), 'rotate-se');
  assert.equal(rotateCursorFor('sw', 0), 'rotate-sw');
  assert.equal(rotateCursorFor('nw', 0), 'rotate-nw');
  assert.equal(rotateCursorFor('ne', 90), 'rotate-se', 'a quarter turn moves the ne corner to the bottom right');
  assert.equal(rotateCursorFor('ne', -90), 'rotate-nw');
  assert.equal(rotateCursorFor('nw', 180), 'rotate-se');
  assert.equal(rotateCursorFor('ne', 30), 'rotate-ne', 'the nearest corner direction wins');
  assert.equal(rotateCursorFor('ne', 50), 'rotate-se');
  assert.equal(rotateCursorFor('ne', 720 + 90), 'rotate-se', 'whole turns fold away');
});

test('rotateCursorAt picks the corner nearest a direction, whatever the angle', () => {
  assert.equal(rotateCursorAt(45), 'rotate-se');
  assert.equal(rotateCursorAt(135), 'rotate-sw');
  assert.equal(rotateCursorAt(-135), 'rotate-nw');
  assert.equal(rotateCursorAt(-45), 'rotate-ne');
  assert.equal(rotateCursorAt(10), 'rotate-se');
  assert.equal(rotateCursorAt(-10), 'rotate-ne');
  assert.equal(rotateCursorAt(Number.NaN), rotateCursorAt(0), 'not a number reads as straight right');
});

test('resizeCursorFor follows the box rotation at 0, 45 and 90 degrees', () => {
  const at0: Record<HandleName, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };
  for (const [h, c] of Object.entries(at0)) assert.equal(resizeCursorFor(h as HandleName, 0), c, h);
  assert.equal(resizeCursorFor('e', 45), 'nwse-resize');
  assert.equal(resizeCursorFor('n', 45), 'nesw-resize');
  assert.equal(resizeCursorFor('ne', 45), 'ew-resize');
  assert.equal(resizeCursorFor('se', 45), 'ns-resize');
  assert.equal(resizeCursorFor('e', 90), 'ns-resize');
  assert.equal(resizeCursorFor('n', 90), 'ew-resize');
  assert.equal(resizeCursorFor('ne', 90), 'nwse-resize');
  assert.equal(resizeCursorFor('e', -45), 'nesw-resize');
  assert.equal(resizeCursorFor('e', 170), 'ew-resize');
  assert.equal(resizeCursorFor('e'), 'ew-resize');
});

test('snapAngleHard rounds to the nearest step, never floors', () => {
  assert.equal(snapAngleHard(7), 0);
  assert.equal(snapAngleHard(8), 15);
  assert.ok(Object.is(snapAngleHard(-7), 0), 'no negative zero');
  assert.equal(snapAngleHard(-8), -15);
  assert.equal(snapAngleHard(22.4), 15);
  assert.equal(snapAngleHard(22.6), 30);
  assert.equal(snapAngleHard(100, 45), 90);
});

test('rotateSnap: Shift is hard 15 degree steps, Alt or Cmd/Ctrl is free, otherwise the soft magnet', () => {
  assert.equal(rotateSnap(7, { shift: true }), 0);
  assert.equal(rotateSnap(8, { shift: true }), 15);
  assert.equal(rotateSnap(8, { shift: true, free: true }), 15);
  assert.equal(rotateSnap(7, { free: true }), 7);
  assert.equal(rotateSnap(3), 0);
  assert.equal(rotateSnap(7), 7);
  assert.equal(rotateSnap(43), 45);
});

// ── Pinch ────────────────────────────────────────────────────────────────────

test('pinchTransform: k stays 1 inside the 2% dead zone, then follows the full spread', () => {
  const a = { x: 0, y: 0 }, b = { x: 100, y: 0 };
  const small = pinchTransform(a, b, a, { x: 101.5, y: 0 });
  assert.equal(small.k, 1); assert.equal(small.scaleEngaged, false);
  const big = pinchTransform(a, b, a, { x: 103, y: 0 });
  near(big.k, 1.03); assert.equal(big.scaleEngaged, true);
  // Once engaged it does not drop back to 1 inside the dead zone.
  const back = pinchTransform(a, b, a, { x: 101, y: 0 }, { scaleEngaged: true });
  near(back.k, 1.01);
  const wider = pinchTransform(a, b, a, { x: 101, y: 0 }, { scaleDeadZone: 0.005 });
  near(wider.k, 1.01);
});

test('pinchTransform: the scale floor holds close fingers still until the spread has changed by that much', () => {
  const a = { x: 0, y: 0 }, b = { x: 40, y: 0 };
  assert.equal(PINCH_SPREAD_PX, 14, 'the two-finger tap\'s slop');
  // 1.5 px on fingers 40 px apart is 3.75%, past the 2% but under the floor.
  const roll = pinchTransform(a, b, a, { x: 41.5, y: 0 }, { scaleFloor: PINCH_SPREAD_PX });
  assert.deepEqual([roll.k, roll.scaleEngaged], [1, false]);
  const shrink = pinchTransform(a, b, a, { x: 27, y: 0 }, { scaleFloor: PINCH_SPREAD_PX });
  assert.deepEqual([shrink.k, shrink.scaleEngaged], [1, false], '13 px closer is still inside the floor');
  const spread = pinchTransform(a, b, a, { x: 54, y: 0 }, { scaleFloor: PINCH_SPREAD_PX });
  assert.equal(spread.scaleEngaged, true);
  near(spread.k, 54 / 40, 1e-9, 'past the floor the full ratio, as the fingers say');
  // Far apart the 2% is the larger threshold and still applies.
  const wide = pinchTransform(a, { x: 1000, y: 0 }, a, { x: 1015, y: 0 }, { scaleFloor: PINCH_SPREAD_PX });
  assert.equal(wide.scaleEngaged, false, '15 px on 1000 is under 2%');
});

test('pinchCatchUp and easePinch: a late preview eases in over a span of finger travel, then follows the fingers', () => {
  const from: [Point, Point] = [{ x: 0, y: 0 }, { x: 40, y: 0 }];
  assert.equal(pinchCatchUp(from, from, 14), 0, 'nothing yet where it began');
  near(pinchCatchUp(from, [{ x: 0, y: 0 }, { x: 47, y: 0 }], 14), 0.5, 1e-9, 'the further finger counts');
  assert.equal(pinchCatchUp(from, [{ x: -20, y: 0 }, { x: 40, y: 0 }], 14), 1, 'and caps at the whole frame');
  assert.equal(pinchCatchUp(from, from, 0), 1, 'no span is no easing');
  const res = pinchTransform({ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 0 }, { x: 80, y: 20 });
  const half = easePinch(res, { scale: 0.5, turn: 0.5, travel: 0.5 });
  near(half.k, 1 + (res.k - 1) / 2);
  near(half.dRot, res.dRot / 2);
  near(half.dx, res.dx / 2); near(half.dy, res.dy / 2);
  assert.deepEqual(easePinch(res, { scale: 1, turn: 1, travel: 1 }), res, 'a full weight is the frame itself');
  const none = easePinch(res, { scale: 0, turn: 0, travel: 0 });
  assert.deepEqual([none.k, none.dRot, none.dx, none.dy], [1, 0, 0, 0], 'a zero weight is no change');
});

test('pinchTransform: rotation engages at 10 degrees and counts from there, so nothing jumps', () => {
  const a = { x: 0, y: 0 }, b = { x: 100, y: 0 };
  const turn = (deg: number): Point => rotateVec(100, 0, deg);
  const early = pinchTransform(a, b, a, turn(5));
  assert.equal(early.dRot, 0); assert.equal(early.rotateEngaged, false); assert.equal(early.engagedAt, null);
  const engage = pinchTransform(a, b, a, turn(12));
  assert.equal(engage.rotateEngaged, true); near(engage.engagedAt!, 12); near(engage.dRot, 0);
  const later = pinchTransform(a, b, a, turn(20), { engagedAt: engage.engagedAt });
  near(later.dRot, 8);
  const backAgain = pinchTransform(a, b, a, turn(2), { engagedAt: engage.engagedAt });
  near(backAgain.dRot, -10); assert.equal(backAgain.rotateEngaged, true);
  const ccw = pinchTransform(a, b, a, turn(-15));
  near(ccw.engagedAt!, -15);
  assert.equal(pinchTransform(a, b, a, turn(8), { rotateEngageDeg: 5 }).rotateEngaged, true);
});

test('pinchTransform: the midpoint travel moves, and a zero spread is inert', () => {
  const r = pinchTransform({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 10, y: 5 }, { x: 110, y: 5 });
  assert.equal(r.k, 1); assert.equal(r.dRot, 0);
  assert.equal(r.dx, 10); assert.equal(r.dy, 5);
  assert.deepEqual(r.centre, { x: 50, y: 0 });
  const flat = pinchTransform({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 0, y: 0 }, { x: 50, y: 0 });
  assert.equal(flat.k, 1); assert.equal(flat.dRot, 0); assert.equal(flat.scaleEngaged, false);
});

test('pinchTransform: the midpoint carries nothing inside the travel dead zone until something engages', () => {
  const a = { x: 0, y: 0 }, b = { x: 100, y: 0 };
  assert.equal(PINCH_TRAVEL_PX, ZONE_DRAG_PX_COARSE, 'a finger\'s drag threshold');
  const at = (dx: number, dy: number): [Point, Point] => [{ x: a.x + dx, y: a.y + dy }, { x: b.x + dx, y: b.y + dy }];
  // A resting pair drifting 3 px moves nothing.
  const rest = pinchTransform(a, b, ...at(3, 0), { travelDeadZone: 10 });
  assert.deepEqual([rest.dx, rest.dy, rest.travelEngaged], [0, 0, false]);
  // Past the dead zone the whole travel applies, so the content stays under the fingers.
  const far = pinchTransform(a, b, ...at(8, 8), { travelDeadZone: 10 });
  assert.deepEqual([far.dx, far.dy, far.travelEngaged], [8, 8, true]);
  // Once engaged it keeps carrying, back inside the dead zone too.
  const back = pinchTransform(a, b, ...at(2, 0), { travelDeadZone: 10, travelEngaged: true });
  assert.deepEqual([back.dx, back.dy], [2, 0]);
  // A spread or a twist engaging carries the midpoint from that frame.
  const spread = pinchTransform(a, b, { x: -3, y: 0 }, { x: 106, y: 0 }, { travelDeadZone: 10 });
  assert.equal(spread.scaleEngaged, true); assert.equal(spread.travelEngaged, true); near(spread.dx, 1.5);
  // With no dead zone (the default) any travel carries, as before.
  assert.equal(pinchTransform(a, b, ...at(1, 0)).dx, 1);
});

test('visibleRect clips the stage to the view that holds the stage, and an unsized view clips nothing', () => {
  const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });
  assert.deepEqual(visibleRect(box(-100, 50, 1200, 900), box(0, 0, 1000, 800)), { x: 0, y: 50, w: 1000, h: 750 });
  assert.deepEqual(visibleRect(box(10, 20, 300, 200), box(0, 0, 0, 0)), { x: 10, y: 20, w: 300, h: 200 });
  // A stage scrolled clear of the view is empty, never negative.
  assert.deepEqual(visibleRect(box(2000, 0, 100, 100), box(0, 0, 1000, 800)), { x: 2000, y: 0, w: 0, h: 100 });
});

test('pinchReaches: a finger on the posed selection, or within a finger\'s zone reach of it, turned with the box', () => {
  const view = { x: 0, y: 0, w: 1000, h: 1000 };
  const big = { x: 100, y: 100, w: 200, h: 200, rot: 0 };
  assert.equal(pinchReaches({ x: 200, y: 200 }, big, view), true, 'inside');
  // A finger's reach is the coarse handle's 8 px half plus its 9 px fat target.
  assert.equal(pinchReaches({ x: 317, y: 200 }, big, view), true, '17 px out');
  assert.equal(pinchReaches({ x: 318, y: 200 }, big, view), false, '18 px out');
  // A 40 px box is in narrow mode: its zones reach 24 px out.
  const small = { x: 300, y: 300, w: 40, h: 40, rot: 0 };
  assert.equal(pinchReaches({ x: 364, y: 364 }, small, view), true);
  assert.equal(pinchReaches({ x: 365, y: 320 }, small, view), false);
  assert.equal(pinchReaches({ x: 620, y: 620 }, small, view), false, 'far off on the stage');
  // Turned 45 degrees, the box's own corner reach counts, not its bounds.
  const turnedBox = { ...big, rot: 45 };
  assert.equal(pinchReaches({ x: 200 + 141, y: 200 }, turnedBox, view), true, 'past the right corner, inside the reach');
  assert.equal(pinchReaches({ x: 290, y: 110 }, turnedBox, view), false, 'inside the bounds, far off the turned box');
});

test('inMoveBand: a thin or tiny rect is grown to MIN_MOVE_PX on its thin axes, turned with the rect', () => {
  const rule: ScreenRect = { x: 100, y: 300, w: 200, h: 2, rot: 0 };
  assert.equal(MIN_MOVE_PX, 10);
  assert.equal(inMoveBand({ x: 200, y: 305 }, rule), true, '4 px off the middle of a 2 px rule');
  assert.equal(inMoveBand({ x: 200, y: 307 }, rule), false, 'past the 10 px band');
  assert.equal(inMoveBand({ x: 301, y: 301 }, rule), false, 'past the end: the length is not grown');
  assert.equal(inMoveBand({ x: 307, y: 303 }, { x: 300, y: 300, w: 6, h: 6 }), true, 'a tiny box grows on both axes');
  assert.equal(inMoveBand({ x: 150, y: 150 }, { x: 100, y: 100, w: 100, h: 100 }), false, 'a box past the band has none');
  assert.equal(inMoveBand({ x: 200 - 4, y: 301 }, { ...rule, rot: 90 }), true, 'a turned rule grows across its own thin axis');
});

test('pinchFits: the selection must lie inside the stage and cover under 60% of the stage', () => {
  const stage: ViewRect = { x: 0, y: 0, w: 1000, h: 800 };
  assert.equal(PINCH_MAX_COVER, 0.6);
  assert.equal(PINCH_SECOND_MS, 300);
  assert.equal(pinchFits({ x: 100, y: 100, w: 200, h: 200 }, stage), true);
  // 59.9% takes the selection, 60% leaves the fingers to the view.
  assert.equal(pinchFits({ x: 0, y: 0, w: 599, h: 800 }, stage), true);
  assert.equal(pinchFits({ x: 0, y: 0, w: 600, h: 800 }, stage), false);
  // Off the stage on any side, however small.
  assert.equal(pinchFits({ x: -1, y: 100, w: 50, h: 50 }, stage), false);
  assert.equal(pinchFits({ x: 960, y: 100, w: 50, h: 50 }, stage), false);
  assert.equal(pinchFits({ x: 100, y: 790, w: 50, h: 20 }, stage), false);
  // A stage offset in the page, and a hairline selection.
  assert.equal(pinchFits({ x: 250, y: 150, w: 400, h: 0 }, { x: 200, y: 100, w: 600, h: 400 }), true);
  // A stage with no size takes nothing; a custom share applies.
  assert.equal(pinchFits({ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 0, h: 800 }), false);
  assert.equal(pinchFits({ x: 0, y: 0, w: 500, h: 800 }, stage, 0.4), false);
});

test('pinchMembers: one box scales about the fingers\' midpoint and travels with the midpoint', () => {
  const box: StartRect = { x: 100, y: 100, w: 100, h: 100 };
  const pinch = { k: 2, dRot: 0, dx: 0, dy: 0, centre: { x: 130, y: 120 }, rotateEngaged: false };
  const r = pinchMembers([box], pinch);
  near(r.k, 2); assert.equal(r.deg, 0);
  // The centre (150, 150) is 20, 30 from the pivot, so the centre moves to (170, 180).
  nearRect(r.rects[0]!, { x: 70, y: 80, w: 200, h: 200, rot: 0 });
  const moved = pinchMembers([box], { ...pinch, k: 1, dx: 15, dy: -5 });
  nearRect(moved.rects[0]!, { x: 115, y: 95, w: 100, h: 100 });
});

test('pinchMembers: k is clamped for the whole set, as every selection scale is', () => {
  const set: StartRect[] = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 200, y: 0, w: 40, h: 16 }];
  const tiny = pinchMembers(set, { k: 0.01, dRot: 0, dx: 0, dy: 0, centre: { x: 0, y: 0 }, rotateEngaged: false });
  near(tiny.k, 0.5, 1e-9); // the 16 px side stops the set at minSize 8
  nearRect(tiny.rects[1]!, { w: 20, h: 8 });
  const huge = pinchMembers(set, { k: 500, dRot: 0, dx: 0, dy: 0, centre: { x: 0, y: 0 }, rotateEngaged: false }, { minSize: 8, kMax: 4 });
  near(huge.k, 4);
});

test('pinchMembers: one box turns about its own centre to a snapped angle, only once engaged', () => {
  const box: StartRect = { x: 100, y: 100, w: 100, h: 50, rot: 10 };
  const base = { k: 1, dx: 0, dy: 0, centre: { x: 0, y: 0 } };
  const idle = pinchMembers([box], { ...base, dRot: 30, rotateEngaged: false });
  nearRect(idle.rects[0]!, { x: 100, y: 100, rot: 10 }); assert.equal(idle.deg, 0);
  // 10 + 18 = 28 is within the magnet's 4 degrees of 30, so the magnet pulls the angle to 30.
  const snapped = pinchMembers([box], { ...base, dRot: 18, rotateEngaged: true });
  nearRect(snapped.rects[0]!, { x: 100, y: 100, w: 100, h: 50, rot: 30 }); near(snapped.deg, 20);
  const free = pinchMembers([box], { ...base, dRot: 12, rotateEngaged: true });
  nearRect(free.rects[0]!, { rot: 22 }); near(free.deg, 12);
  // Past half a turn the angle wraps into [-180, 180).
  nearRect(pinchMembers([box], { ...base, dRot: 175, rotateEngaged: true }).rects[0]!, { rot: -175 });
});

test('pinchMembers: a set turns about the centre of its bounds by a snapped turn, and an artboard stays put', () => {
  const set: StartRect[] = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 200, y: 0, w: 100, h: 100 }];
  const r = pinchMembers(set, { k: 1, dRot: 88, dx: 0, dy: 0, centre: { x: 0, y: 0 }, rotateEngaged: true });
  near(r.deg, 90);
  // The bounds' centre is (150, 50): each member's centre swings a quarter turn about that point.
  nearRect(r.rects[0]!, { x: 100, y: -100, w: 100, h: 100, rot: 90 });
  nearRect(r.rects[1]!, { x: 100, y: 100, rot: 90 });
  const kept = pinchMembers(set, { k: 1, dRot: 40, dx: 0, dy: 0, centre: { x: 0, y: 0 }, rotateEngaged: true }, { turns: [false, true] });
  nearRect(kept.rects[0]!, { x: 0, y: 0, rot: 0 });
  // One member left to turn turns about its own centre.
  nearRect(kept.rects[1]!, { x: 200, y: 0, rot: 40 }); near(kept.deg, 40);
  const none = pinchMembers(set, { k: 1, dRot: 40, dx: 0, dy: 0, centre: { x: 0, y: 0 }, rotateEngaged: true }, { turns: [false, false] });
  assert.equal(none.deg, 0);
});

test('pinchMembers: scale, travel and turn compose in one frame, the pivot following the scaled set', () => {
  const set: StartRect[] = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 200, y: 0, w: 100, h: 100 }];
  const r = pinchMembers(set, { k: 2, dRot: 90, dx: 10, dy: 20, centre: { x: 150, y: 50 }, rotateEngaged: true });
  near(r.k, 2); near(r.deg, 90);
  // Scaled twice about (150, 50), the centre of its bounds, the set runs (-150, -50) to
  // (450, 150). The travel moves that centre to (160, 70), and the turn swings each
  // member's centre a quarter turn about the new one.
  nearRect(r.rects[0]!, { x: 60, y: -230, w: 200, h: 200, rot: 90 });
  nearRect(r.rects[1]!, { x: 60, y: 170, w: 200, h: 200, rot: 90 });
});

// Type-only: the AABB shape the selection maths returns is the shared one.
const _aabbIsShared: AABB = pairBox;
void _aabbIsShared;
