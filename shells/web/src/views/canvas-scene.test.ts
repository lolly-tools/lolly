// SPDX-License-Identifier: MPL-2.0
/**
 * Canvas Scene (plans/98 Phase A) - the spatial hit index must be a drop-in for the
 * linear scan (hitGrid ≡ hitTest, hitGridMarquee ≡ marqueeHit), and the damage diff
 * must classify each mutation into the right lane. node:test, no framework.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitTest, marqueeHit, type Box, type BoxFieldConfig } from './free-canvas-math.ts';
import {
  diffBoxes, isGeometryOnlyDamage, geometryFastPathPlan, resolveCanvasFastCfg, boundEndpointIds,
  buildHitGrid, hitGrid, hitGridMarquee, pickTopmost, pickMarquee,
  GRID_PICK_MIN, LAYOUT_STUDIO_CFG, type FastPathCfg,
} from './canvas-scene.ts';

const cfg: BoxFieldConfig = LAYOUT_STUDIO_CFG;

// Deterministic PRNG (mulberry32) so failures are reproducible.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBoxes(n: number, seed: number, spread = 4000): Box[] {
  const r = rng(seed);
  const boxes: Box[] = [];
  for (let i = 0; i < n; i++) {
    boxes.push({
      id: `b${i}`,
      kind: r() < 0.1 ? 'frame' : r() < 0.5 ? 'text' : 'box',
      x: Math.round(r() * spread),
      y: Math.round(r() * spread),
      w: 20 + Math.round(r() * 300),
      h: 20 + Math.round(r() * 300),
      rot: r() < 0.4 ? Math.round(r() * 360) : 0,
      bg: r() < 0.5 ? '#ff0000' : '#00ff00',
      text: `t${i}`,
      frame: '',
      order: i,
    });
  }
  return boxes;
}

test('hitGrid ≡ hitTest for random points over rotated boxes', () => {
  for (const [n, seed] of [[200, 1], [1500, 7], [4000, 99]] as const) {
    const boxes = makeBoxes(n, seed);
    const grid = buildHitGrid(boxes, cfg);
    const q = rng(seed ^ 0xabcd);
    let checked = 0;
    for (let k = 0; k < 3000; k++) {
      const px = Math.round(q() * 4300) - 150;
      const py = Math.round(q() * 4300) - 150;
      assert.equal(
        hitGrid(grid, px, py),
        hitTest(boxes, px, py, cfg),
        `n=${n} point (${px},${py}) disagreed`,
      );
      checked++;
    }
    assert.ok(checked === 3000);
  }
});

test('hitGrid honours the skip predicate identically', () => {
  const boxes = makeBoxes(500, 3);
  const grid = buildHitGrid(boxes, cfg);
  const skip = (i: number) => i % 3 === 0;
  const q = rng(555);
  for (let k = 0; k < 1500; k++) {
    const px = Math.round(q() * 4300) - 150;
    const py = Math.round(q() * 4300) - 150;
    assert.equal(hitGrid(grid, px, py, skip), hitTest(boxes, px, py, cfg, skip));
  }
});

test('hitGridMarquee ≡ marqueeHit for random rects', () => {
  const boxes = makeBoxes(1200, 42);
  const grid = buildHitGrid(boxes, cfg);
  const q = rng(42 ^ 0x1234);
  for (let k = 0; k < 800; k++) {
    const rect = {
      x: Math.round(q() * 4000), y: Math.round(q() * 4000),
      w: Math.round(q() * 800), h: Math.round(q() * 800),
    };
    assert.deepEqual(hitGridMarquee(grid, rect), marqueeHit(boxes, rect, cfg));
  }
});

test('pickTopmost/pickMarquee ≡ hitTest/marqueeHit on both sides of the grid threshold', () => {
  // small (< GRID_PICK_MIN → linear path) and large (≥ threshold → grid path)
  for (const n of [GRID_PICK_MIN - 100, GRID_PICK_MIN + 700]) {
    const boxes = makeBoxes(n, n);
    const q = rng(n ^ 0xfeed);
    for (let k = 0; k < 1500; k++) {
      const px = Math.round(q() * 4300) - 150;
      const py = Math.round(q() * 4300) - 150;
      assert.equal(pickTopmost(boxes, px, py, cfg), hitTest(boxes, px, py, cfg), `pick n=${n} (${px},${py})`);
    }
    const rect = { x: 500, y: 500, w: 2000, h: 2000 };
    assert.deepEqual(pickMarquee(boxes, rect, cfg), marqueeHit(boxes, rect, cfg), `marquee n=${n}`);
  }
});

test('diffBoxes: no change is clean', () => {
  const boxes = makeBoxes(50, 1);
  const d = diffBoxes(boxes, boxes.map((b) => ({ ...b })), cfg);
  assert.equal(d.dirty, false);
  for (const lane of [d.moved, d.restyled, d.added, d.removed, d.zChanged, d.frames])
    assert.equal(lane.length, 0);
});

test('diffBoxes: geometry change is a move, content change is a restyle - separate lanes', () => {
  const boxes = makeBoxes(50, 2);
  const geom = boxes.map((b) => ({ ...b }));
  const g10 = geom[10]!;
  geom[10] = { ...g10, x: (g10.x as number) + 5 };
  const dg = diffBoxes(boxes, geom, cfg);
  assert.deepEqual(dg.moved, [10]);
  assert.deepEqual(dg.restyled, []);
  assert.deepEqual(dg.zChanged, []);

  const style = boxes.map((b) => ({ ...b }));
  style[10] = { ...style[10], bg: '#0000ff' };
  const ds = diffBoxes(boxes, style, cfg);
  assert.deepEqual(ds.restyled, [10]);
  assert.deepEqual(ds.moved, []);
});

test('diffBoxes: a frame box that moves lands in both moved and frames', () => {
  const boxes: Box[] = [
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, rot: 0, frame: '', order: 0 },
    { id: 'a', kind: 'box', x: 10, y: 10, w: 100, h: 100, rot: 0, frame: 'f1', order: 1 },
  ];
  const next = boxes.map((b) => ({ ...b }));
  next[0] = { ...next[0], w: 1200 };
  const d = diffBoxes(boxes, next, cfg);
  assert.deepEqual(d.moved, [0]);
  assert.deepEqual(d.frames, [0]);
});

test('diffBoxes: reparent (frame field) is zChanged, not restyled', () => {
  const boxes = makeBoxes(20, 4);
  const next = boxes.map((b) => ({ ...b }));
  next[5] = { ...next[5], frame: 'f1' };
  const d = diffBoxes(boxes, next, cfg);
  assert.deepEqual(d.zChanged, [5]);
  assert.deepEqual(d.restyled, []);
  assert.deepEqual(d.moved, []);
});

test('diffBoxes: add and remove; removing one box does NOT flag survivors as reordered', () => {
  const boxes = makeBoxes(30, 5);
  // remove index 10
  const removed = boxes.filter((_, i) => i !== 10);
  const dr = diffBoxes(boxes, removed, cfg);
  assert.deepEqual(dr.removed, [10]);
  assert.deepEqual(dr.added, []);
  assert.deepEqual(dr.zChanged, [], 'a delete must not flag every trailing box as reordered');

  // add one
  const added = [...boxes, { id: 'zz', kind: 'box', x: 1, y: 1, w: 9, h: 9, rot: 0, frame: '', order: 99 } as Box];
  const da = diffBoxes(boxes, added, cfg);
  assert.deepEqual(da.added, [boxes.length]);
  assert.deepEqual(da.removed, []);
  assert.deepEqual(da.zChanged, []);
});

test('diffBoxes: swapping two boxes array order flags them zChanged', () => {
  const boxes = makeBoxes(10, 6);
  const next = boxes.map((b) => ({ ...b }));
  const tmp = next[2]!; next[2] = next[7]!; next[7] = tmp;
  const d = diffBoxes(boxes, next, cfg);
  // indices in NEXT of the two boxes whose relative rank changed
  assert.ok(d.zChanged.includes(2) && d.zChanged.includes(7), `got ${JSON.stringify(d.zChanged)}`);
  assert.deepEqual(d.moved, []);
  assert.deepEqual(d.restyled, []);
});

const fastCfg: FastPathCfg = { field: cfg, frameField: 'frame', groupField: 'group', kindField: 'kind', clipField: 'clip' };
const pbox = (over: Partial<Box>): Box => ({ kind: 'box', x: 0, y: 0, w: 50, h: 50, rot: 0, frame: '', clip: '', ...over });

test('geometryFastPathPlan: a pure x/y translation of a plain box yields a rounded patch', () => {
  const prev: Box[] = [pbox({ id: 'a', x: 10, y: 10, w: 100, h: 80 })];
  const next: Box[] = [pbox({ id: 'a', x: 40.4, y: 70.6, w: 100, h: 80 })];
  assert.deepEqual(geometryFastPathPlan(prev, next, fastCfg), [{ id: 'a', x: 40, y: 71 }]);
});

test('geometryFastPathPlan refuses resize and rotate (only translation is safe)', () => {
  const prev: Box[] = [pbox({ id: 'a', x: 10, y: 10, w: 100, h: 80 })];
  assert.equal(geometryFastPathPlan(prev, [pbox({ id: 'a', x: 10, y: 10, w: 120, h: 80 })], fastCfg), null);
  assert.equal(geometryFastPathPlan(prev, [pbox({ id: 'a', x: 10, y: 10, w: 100, h: 90 })], fastCfg), null);
  assert.equal(geometryFastPathPlan(prev, [pbox({ id: 'a', x: 10, y: 10, w: 100, h: 80, rot: 15 })], fastCfg), null);
});

test('geometryFastPathPlan refuses frame members / clip sources / clip masks / connector endpoints', () => {
  // frame member
  const fm: Box[] = [pbox({ id: 'a', frame: 'f1' })];
  assert.equal(geometryFastPathPlan(fm, [pbox({ id: 'a', x: 9, frame: 'f1' })], fastCfg), null);
  // clip source (its own clip-path depends on its x/y)
  const cs: Box[] = [pbox({ id: 'a', clip: 'm' })];
  assert.equal(geometryFastPathPlan(cs, [pbox({ id: 'a', x: 9, clip: 'm' })], fastCfg), null);
  // clip mask: box 'm' is what box 'd' clips against; moving 'm' would stale d's baked clip
  const cm: Box[] = [pbox({ id: 'm' }), pbox({ id: 'd', clip: 'm', x: 5 })];
  assert.equal(geometryFastPathPlan(cm, [pbox({ id: 'm', x: 9 }), cm[1]!], fastCfg), null);
  // connector endpoint
  const ce: Box[] = [pbox({ id: 'a' })];
  assert.equal(
    geometryFastPathPlan(ce, [pbox({ id: 'a', x: 9 })], { ...fastCfg, connectorEndpointIds: new Set(['a']) }),
    null,
  );
});

test('geometryFastPathPlan refuses empty-id boxes and any non-geometry change', () => {
  const noId: Box[] = [pbox({ id: '' })];
  assert.equal(geometryFastPathPlan(noId, [pbox({ id: '', x: 9 })], fastCfg), null);
  const styled: Box[] = [pbox({ id: 'a', bg: '#111' })];
  assert.equal(geometryFastPathPlan(styled, [pbox({ id: 'a', x: 9, bg: '#fff' })], fastCfg), null);
});

// ── Artboard (frame) moves - plans/141 WP-A item 6 ───────────────────────────

test('geometryFastPathPlan: a frame translated with its riding members patches the PAGE only', () => {
  // The members' rendered positions are frame-LOCAL, so the page element carries
  // them - the plan proves the ride model-side and emits no member entries.
  const prev: Box[] = [
    pbox({ id: 'f1', kind: 'frame', x: 100, y: 100, w: 400, h: 300 }),
    pbox({ id: 'a', x: 150, y: 150, frame: 'f1' }),
    pbox({ id: 'b', x: 220, y: 180, frame: 'f1' }),
  ];
  const next: Box[] = [
    pbox({ id: 'f1', kind: 'frame', x: 150.4, y: 130.6, w: 400, h: 300 }),
    pbox({ id: 'a', x: 200.4, y: 180.6, frame: 'f1' }),
    pbox({ id: 'b', x: 270.4, y: 210.6, frame: 'f1' }),
  ];
  assert.deepEqual(geometryFastPathPlan(prev, next, fastCfg),
    [{ id: 'f1', x: 150, y: 131, frame: true }]);
});

test('geometryFastPathPlan: a member desynced from its frame delta refuses the whole plan', () => {
  const prev: Box[] = [
    pbox({ id: 'f1', kind: 'frame', x: 100, y: 100, w: 400, h: 300 }),
    pbox({ id: 'a', x: 150, y: 150, frame: 'f1' }),
  ];
  const next: Box[] = [
    pbox({ id: 'f1', kind: 'frame', x: 150, y: 130, w: 400, h: 300 }),
    pbox({ id: 'a', x: 205, y: 180, frame: 'f1' }),   // dx 55 ≠ frame's 50
  ];
  assert.equal(geometryFastPathPlan(prev, next, fastCfg), null);
});

test('geometryFastPathPlan: a frame RESIZE refuses (page bounds + clip change)', () => {
  const prev: Box[] = [pbox({ id: 'f1', kind: 'frame', x: 100, y: 100, w: 400, h: 300 })];
  const next: Box[] = [pbox({ id: 'f1', kind: 'frame', x: 60, y: 60, w: 440, h: 340 })];
  assert.equal(geometryFastPathPlan(prev, next, fastCfg), null);
});

test('geometryFastPathPlan: a frame move composes with an independent scratch-box move', () => {
  const prev: Box[] = [
    pbox({ id: 'f1', kind: 'frame', x: 100, y: 100, w: 400, h: 300 }),
    pbox({ id: 'a', x: 150, y: 150, frame: 'f1' }),
    pbox({ id: 's', x: 900, y: 40 }),                 // pasteboard scratch box
  ];
  const next: Box[] = [
    pbox({ id: 'f1', kind: 'frame', x: 150, y: 100, w: 400, h: 300 }),
    pbox({ id: 'a', x: 200, y: 150, frame: 'f1' }),
    pbox({ id: 's', x: 940, y: 60 }),
  ];
  assert.deepEqual(geometryFastPathPlan(prev, next, fastCfg), [
    { id: 'f1', x: 150, y: 100, frame: true },
    { id: 's', x: 940, y: 60 },
  ]);
});

test('boundEndpointIds = bind targets ∪ path-box ids (connector-endpoint exclusion set)', () => {
  const boxes: Box[] = [
    pbox({ id: 'a' }),
    pbox({ id: 'b' }),
    pbox({ id: 'line', kind: 'path', bindStart: 'a', bindEnd: 'b' }),
    pbox({ id: 'freeline', kind: 'path' }),
  ];
  assert.deepEqual([...boundEndpointIds(boxes, { idField: 'id' })].sort(), ['a', 'b', 'freeline', 'line']);
  // a plain box that is a bind target is correctly excluded by geometryFastPathPlan
  const prev = boxes; const next = [pbox({ id: 'a', x: 40 }), boxes[1]!, boxes[2]!, boxes[3]!];
  const plan = geometryFastPathPlan(prev, next, { ...resolveCanvasFastCfg({ frameField: 'frame', clipField: 'clip' }), connectorEndpointIds: boundEndpointIds(next, { idField: 'id' }) });
  assert.equal(plan, null, 'moving a bound endpoint must refuse the fast path');
});

test('resolveCanvasFastCfg defaults the geometry fields and surfaces frame/clip', () => {
  const c = resolveCanvasFastCfg({ frameField: 'frame', clipField: 'clip', groupField: 'group' });
  assert.equal(c.field.idField, 'id');
  assert.equal(c.field.xField, 'x');
  assert.equal(c.field.rotationField, 'rot');
  assert.equal(c.frameField, 'frame');
  assert.equal(c.clipField, 'clip');
  assert.equal(c.kindField, 'kind');
});

test('isGeometryOnlyDamage gates the paint fast-path: only a pure move qualifies', () => {
  const base = makeBoxes(20, 11);
  const mut = (fn: (n: typeof base) => void) => { const n = base.map((b) => ({ ...b })); fn(n); return diffBoxes(base, n, cfg); };

  // pure move → yes
  assert.equal(isGeometryOnlyDamage(mut((n) => { n[3] = { ...n[3]!, x: (n[3]!.x as number) + 10, rot: 45 }; })), true);
  // restyle → no
  assert.equal(isGeometryOnlyDamage(mut((n) => { n[3] = { ...n[3]!, bg: '#0ff' }; })), false);
  // move + restyle together → no (content lane is dirty)
  assert.equal(isGeometryOnlyDamage(mut((n) => { n[3] = { ...n[3]!, x: 9, bg: '#0ff' }; })), false);
  // reparent (frame field) → no
  assert.equal(isGeometryOnlyDamage(mut((n) => { n[3] = { ...n[3]!, frame: 'f9' }; })), false);
  // a frame-kind box that moves → no (page bounds/membership)
  const withFrame = [{ id: 'f1', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, rot: 0, frame: '', order: 0 } as Box, ...base];
  const movedFrame = withFrame.map((b) => ({ ...b })); movedFrame[0] = { ...movedFrame[0]!, x: 20 };
  assert.equal(isGeometryOnlyDamage(diffBoxes(withFrame, movedFrame, cfg)), false);
  // no change → no (nothing to fast-path)
  assert.equal(isGeometryOnlyDamage(diffBoxes(base, base.map((b) => ({ ...b })), cfg)), false);
});
