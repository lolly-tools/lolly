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
  SCALE_K_MAX, clampScaleK, scaleFactorOf, handleScaleK, scaleRectAbout, uniformResize,
  canResizeNonUniform, rectsAABB, transformSelection,
  contentScaleSpec, scaleBoxContent, scaleTextWrap, CONTENT_LENGTH_IDS, TEXT_WRAP_OFFSET_MAX,
  boxTransformCss, TILT_MAX_DEG,
  zoneAt, zoneLayout, zoneRects, smallObjectHandles, visibleExtent,
  GRAB_ZONE_MIN, GRAB_ZONE_MAX, ZONE_ROTATE,
  resizeCursorFor, snapAngleHard, rotateSnap, pinchTransform,
} from './free-canvas-transform.ts';
import type { BoxPose, ContentScaleSpec, FieldBounds, ScreenRect, ViewRect, ZoneOpts } from './free-canvas-transform.ts';
import { rotateVec } from './free-canvas-math.ts';
import type { AABB, Box, HandleName, Point, Rect, StartRect } from './free-canvas-math.ts';

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

test('scaleFactorOf reads k from the longer side of a resize result', () => {
  assert.equal(scaleFactorOf({ w: 200, h: 50 }, { w: 300, h: 75 }), 1.5);
  assert.equal(scaleFactorOf({ w: 50, h: 200 }, { w: 75, h: 300 }), 1.5);
  assert.equal(scaleFactorOf({ w: 200, h: 0 }, { w: 100, h: 0 }), 0.5);
  assert.equal(scaleFactorOf({ w: 0, h: 0 }, { w: 10, h: 10 }), 1);
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

test('zoneRects: the hover geometry is the hit geometry, in priority order', () => {
  const zones = zoneRects(R, mouse());
  assert.deepEqual(zones.map((z) => `${z.kind}:${z.handle}`), [
    'corner:nw', 'corner:ne', 'corner:se', 'corner:sw', 'edge:n', 'edge:e', 'edge:s', 'edge:w',
    'rotate:nw', 'rotate:ne', 'rotate:se', 'rotate:sw',
  ]);
  assert.equal(zoneRects(R, mouse({ allowRotate: false })).length, 8);
  assert.deepEqual(zoneRects(R, mouse({ edgesOnly: true })).filter((z) => z.kind !== 'rotate').map((z) => z.handle), ['n', 'e', 's', 'w']);
  const nw = zones[0]!;
  assert.deepEqual(nw.parts, [{ x0: -110, x1: -90, y0: -60, y1: -40 }]);
  assert.deepEqual(nw.quads[0], [{ x: 90, y: 90 }, { x: 110, y: 90 }, { x: 110, y: 110 }, { x: 90, y: 110 }]);
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
  assert.deepEqual(smallObjectHandles(8, 100), { hide: ['n', 's', 'nw', 'ne', 'se', 'sw'], outward: true });
  assert.deepEqual(smallObjectHandles(100, 10), { hide: ['e', 'w', 'nw', 'ne', 'se', 'sw'], outward: true });
});

// ── Cursors and rotation snapping ────────────────────────────────────────────

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

// Type-only: the AABB shape the selection maths returns is the shared one.
const _aabbIsShared: AABB = pairBox;
void _aabbIsShared;
