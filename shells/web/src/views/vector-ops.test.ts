// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the pure vector operations behind the canvas editor's context menu.
 * Run directly:  node --test shells/web/src/views/vector-ops.test.ts
 *
 * Every assertion is against an INDEPENDENT oracle - a closed-form area, a bounding box
 * worked out by hand, a membership question answered by reasoning about the shapes - never
 * against this module's own output. The one place a tolerance appears is where a cubic
 * approximates a circular arc: the kappa construction encloses about 2.7e-4 more than the
 * true circle, and (per the kernel plan's own warning) checking an exact formula against an
 * idealised value is how correct code gets made to look broken. So those assertions carry
 * a relative tolerance and, where it is the interesting part, assert the sign of the
 * deviation too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type GeomPath,
  contourArea, decodeAuthoredPaths, decodeAuthoredPathsResult, encodeAuthoredPaths,
  makeGeomApi, pathBounds, pointInPath,
} from '@lolly/engine';
import type { Box } from './free-canvas-math.ts';
import {
  type PathPayload,
  DEFAULT_VECTOR_FIELDS,
  booleanBoxes, boxOutlineKind, boxToPath, decodeAuthoredPath, encodeAuthoredPath,
  offsetBoxes, pathToBox, replaceBoxes, simplifyBoxes, strokeBoxesToPath,
} from './vector-ops.ts';

// ── helpers ───────────────────────────────────────────────────────────────────

const area = (p: GeomPath): number => p.reduce((a, c) => a + contourArea(c), 0);

function assertFinite(p: GeomPath | null | undefined, what: string): asserts p is GeomPath {
  assert.ok(p, `${what}: expected a path, got ${String(p)}`);
  for (const c of p!) {
    for (const k of c.curves) {
      for (const v of k) assert.ok(Number.isFinite(v), `${what}: non-finite coordinate ${String(v)}`);
    }
  }
}

function assertClose(actual: number, expected: number, rel: number, what: string): void {
  const err = Math.abs(actual - expected) / Math.max(1e-12, Math.abs(expected));
  assert.ok(err <= rel, `${what}: ${actual} vs ${expected} (rel ${err.toExponential(2)} > ${rel})`);
}

const shapeBox = (o: Record<string, unknown>): Box => ({ kind: 'box', shape: 'rect', ...o }) as Box;

const pathBox = (o: Record<string, unknown>, payload: PathPayload): Box =>
  ({ kind: 'path', shape: 'rect', path: encodeAuthoredPath(payload), ...o }) as Box;

/** A closed authored path from bare (x,y) fractions, straight between them. */
const linePath = (pts: [number, number][]): PathPayload =>
  ({ kind: 'line', closed: true, nodes: pts.map(([x, y]) => ({ x, y })) });

function rotatePath(p: GeomPath, cx: number, cy: number, deg: number): GeomPath {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const map = (x: number, y: number): [number, number] => {
    const dx = x - cx, dy = y - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  };
  return p.map((ct) => ({
    closed: ct.closed,
    curves: ct.curves.map((k) => {
      const a = map(k[0], k[1]), b = map(k[2], k[3]), d = map(k[4], k[5]), e = map(k[6], k[7]);
      return [a[0], a[1], b[0], b[1], d[0], d[1], e[0], e[1]] as typeof k;
    }),
  }));
}

function maxCoordDiff(a: GeomPath, b: GeomPath): number {
  assert.equal(a.length, b.length, 'contour count');
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i]!, cb = b[i]!;
    assert.equal(ca.curves.length, cb.curves.length, 'curve count');
    for (let j = 0; j < ca.curves.length; j++) {
      for (let k = 0; k < 8; k++) worst = Math.max(worst, Math.abs(ca.curves[j]![k]! - cb.curves[j]![k]!));
    }
  }
  return worst;
}

/** Membership agreement over a deterministic grid whose points avoid both boundaries. */
function sameRegion(a: GeomPath, b: GeomPath, box: { x0: number; y0: number; x1: number; y1: number }): number {
  let mismatches = 0;
  for (let i = 0; i < 17; i++) {
    for (let j = 0; j < 17; j++) {
      const x = box.x0 + ((i + 0.37) / 17) * (box.x1 - box.x0);
      const y = box.y0 + ((j + 0.41) / 17) * (box.y1 - box.y0);
      if (pointInPath(a, x, y) !== pointInPath(b, x, y)) mismatches++;
    }
  }
  return mismatches;
}

const okOf = (r: { ok: boolean }): r is { ok: true; boxes: Box[]; skipped: number[]; path: GeomPath } => r.ok;

/**
 * How exact a round trip THROUGH PERSISTENCE can be, and why it is not 1e-9.
 *
 * A stored node is a fraction of the box frame written at six decimals - the codec fixes
 * the precision (see engine/src/geom/authored-url.ts) so that the same shape always
 * encodes to the same bytes and an opened, re-shared link does not churn. A control point
 * therefore returns within about 1e-6 of the frame's side in px (a node's own rounding
 * plus its handle's), which on a 200px box is a five-thousandth of a pixel. In-memory
 * geometry is still exact; only what went out to a field and came back is quantised, so
 * the tolerance is stated here once rather than being loosened case by case.
 */
const wireEps = (side: number): number => 1.5e-6 * side;
/** The same error seen through an area: a boundary displaced by `wireEps` over a
 *  perimeter of the same order moves the area by ~1e-6 of it. */
const WIRE_AREA_REL = 1e-5;

// ── boxToPath: primitive shapes against closed-form areas ─────────────────────

test('boxToPath: a rect is its rectangle, positive-wound, exact bounds', () => {
  const p = boxToPath(shapeBox({ x: 10, y: 20, w: 100, h: 50 }));
  assertFinite(p, 'rect');
  assert.equal(area(p), 5000);
  assert.deepEqual(pathBounds(p), { x0: 10, y0: 20, x1: 110, y1: 70 });
  // One consistent handedness for every primitive: clockwise on screen, which is a
  // POSITIVE area in contourArea's y-up convention.
  assert.ok(area(p) > 0);
});

test('boxToPath: a circle of w=h=100 has area 2500π (and the arc approximation is high)', () => {
  const p = boxToPath(shapeBox({ shape: 'circle', x: 0, y: 0, w: 100, h: 100 }));
  assertFinite(p, 'circle');
  const exact = 2500 * Math.PI;
  assertClose(area(p), exact, 3e-4, 'circle area');
  assert.ok(area(p) > exact, 'the kappa cubic encloses slightly MORE than the true circle');
  assert.deepEqual(pathBounds(p), { x0: 0, y0: 0, x1: 100, y1: 100 });
});

test('boxToPath: an ellipse of 200×100 has area π·100·50', () => {
  const p = boxToPath(shapeBox({ shape: 'ellipse', x: -30, y: 5, w: 200, h: 100 }));
  assertFinite(p, 'ellipse');
  assertClose(area(p), Math.PI * 100 * 50, 3e-4, 'ellipse area');
  assert.deepEqual(pathBounds(p), { x0: -30, y0: 5, x1: 170, y1: 105 });
});

test('boxToPath: a rounded rect of radius r has area w·h − (4−π)r²', () => {
  const r = 20;
  const p = boxToPath(shapeBox({ shape: 'rounded', radius: r, x: 0, y: 0, w: 200, h: 100 }));
  assertFinite(p, 'rounded');
  assertClose(area(p), 200 * 100 - (4 - Math.PI) * r * r, 3e-4, 'rounded area');
  assert.deepEqual(pathBounds(p), { x0: 0, y0: 0, x1: 200, y1: 100 });
});

test('boxToPath: radius 0 on a rounded box is a plain rectangle', () => {
  const p = boxToPath(shapeBox({ shape: 'rounded', radius: 0, w: 200, h: 100 }));
  assertFinite(p, 'rounded r=0');
  assert.equal(area(p), 20000);
  assert.equal(p[0]!.curves.length, 4);
});

// ── the CSS border-radius clamp ───────────────────────────────────────────────

test('boxToPath: radius clamps to half the shorter side, at / above / far above it', () => {
  const at = boxToPath(shapeBox({ shape: 'rounded', radius: 50, w: 200, h: 100 }));
  const above = boxToPath(shapeBox({ shape: 'rounded', radius: 80, w: 200, h: 100 }));
  const absurd = boxToPath(shapeBox({ shape: 'rounded', radius: 1e6, w: 200, h: 100 }));
  assertFinite(at, 'r=50'); assertFinite(above, 'r=80'); assertFinite(absurd, 'r=1e6');
  // A 200×100 box clamps every radius to 50 (min(w,h)/2), so all three are one shape.
  assertClose(area(at), 200 * 100 - (4 - Math.PI) * 2500, 3e-4, 'clamped area');
  assert.equal(maxCoordDiff(at, above), 0);
  assert.equal(maxCoordDiff(at, absurd), 0);
  assert.deepEqual(pathBounds(absurd), { x0: 0, y0: 0, x1: 200, y1: 100 });
});

test('boxToPath: a pill is exactly the clamped radius, not a shape of its own', () => {
  const pill = boxToPath(shapeBox({ shape: 'pill', w: 200, h: 100 }));
  const clamped = boxToPath(shapeBox({ shape: 'rounded', radius: 50, w: 200, h: 100 }));
  assertFinite(pill, 'pill');
  assert.equal(maxCoordDiff(pill, clamped!), 0);
});

test('boxToPath: a pill on a SQUARE box is a circle-radius shape with no straight edges', () => {
  const p = boxToPath(shapeBox({ shape: 'pill', w: 100, h: 100 }));
  assertFinite(p, 'square pill');
  // r = 50 = w/2 = h/2, so all four straight edges are zero-length and are dropped - 
  // never emitted as degenerate cubics the intersector cannot take a tangent from.
  assert.equal(p[0]!.curves.length, 4);
  assertClose(area(p), 2500 * Math.PI, 3e-4, 'square pill area');
});

test('boxToPath: a negative radius is 0, not a reflected corner', () => {
  const p = boxToPath(shapeBox({ shape: 'rounded', radius: -40, w: 200, h: 100 }));
  assertFinite(p, 'negative radius');
  assert.equal(area(p), 20000);
});

// ── rotation ──────────────────────────────────────────────────────────────────

test('boxToPath: a rotated rect keeps its area and lands on the closed-form bbox', () => {
  const p = boxToPath(shapeBox({ x: 0, y: 0, w: 200, h: 100, rot: 30 }));
  assertFinite(p, 'rotated rect');
  assertClose(area(p), 20000, 1e-12, 'rotated area');
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  const halfW = (200 * c + 100 * s) / 2, halfH = (200 * s + 100 * c) / 2;
  const bb = pathBounds(p)!;
  assertClose(bb.x0, 100 - halfW, 1e-12, 'x0');
  assertClose(bb.x1, 100 + halfW, 1e-12, 'x1');
  assertClose(bb.y0, 50 - halfH, 1e-12, 'y0');
  assertClose(bb.y1, 50 + halfH, 1e-12, 'y1');
});

test('boxToPath: lowering commutes with rotation (the bug class the kernel actually had)', () => {
  for (const shape of ['rect', 'rounded', 'pill', 'ellipse'] as const) {
    for (const deg of [30, 37.5, -12.3, 180]) {
      const base = shapeBox({ shape, radius: 24, x: 17, y: -9, w: 200, h: 120 });
      const flat = boxToPath(base);
      const spun = boxToPath({ ...base, rot: deg });
      assertFinite(flat, `${shape} flat`);
      assertFinite(spun, `${shape} @${deg}`);
      const expect = rotatePath(flat, 17 + 100, -9 + 60, deg);
      assert.ok(maxCoordDiff(spun, expect) < 1e-9, `${shape} @${deg}: ${maxCoordDiff(spun, expect)}`);
    }
  }
});

test('boxToPath: rot is rounded to 1dp, matching the transform the hook writes', () => {
  const a = boxToPath(shapeBox({ w: 200, h: 100, rot: 30.04 }));
  const b = boxToPath(shapeBox({ w: 200, h: 100, rot: 30 }));
  assertFinite(a, 'rot 30.04'); assertFinite(b, 'rot 30');
  assert.equal(maxCoordDiff(a, b), 0);
});

// ── data in the wild ──────────────────────────────────────────────────────────

test('boxToPath: w/h of 0, negative or missing lower to the 1px sliver the hook paints', () => {
  for (const o of [{ w: 0, h: 0 }, { w: -5, h: -5 }, {}, { w: 0.2, h: 0.2 }]) {
    const p = boxToPath(shapeBox({ x: 3, y: 4, ...o }));
    assertFinite(p, `degenerate ${JSON.stringify(o)}`);
    const bb = pathBounds(p)!;
    assert.ok(bb.x1 - bb.x0 >= 1 && bb.y1 - bb.y0 >= 1);
  }
});

test('boxToPath: non-finite and stringy geometry never produces NaN', () => {
  const p = boxToPath(shapeBox({ x: 'nope', y: NaN, w: Infinity, h: '80', rot: NaN }));
  assertFinite(p, 'garbage geometry');
  assert.deepEqual(pathBounds(p), { x0: 0, y0: 0, x1: 1, y1: 80 });
});

test('boxToPath: URL-mode strings are read as numbers', () => {
  const p = boxToPath(shapeBox({ x: '10', y: '20', w: '100', h: '50' }));
  assertFinite(p, 'stringy');
  assert.deepEqual(pathBounds(p), { x0: 10, y0: 20, x1: 110, y1: 70 });
});

test('boxToPath: text and image boxes have NO outline (never a silent frame rect)', () => {
  assert.equal(boxToPath({ kind: 'text', shape: 'rect', w: 100, h: 100 } as Box), null);
  assert.equal(boxToPath({ kind: 'image', shape: 'rounded', w: 100, h: 100 } as Box), null);
  assert.equal(boxOutlineKind({ kind: 'text' } as Box), 'none');
  assert.equal(boxOutlineKind({ kind: 'image' } as Box), 'none');
  assert.equal(boxOutlineKind(shapeBox({})), 'shape');
  assert.equal(boxOutlineKind(pathBox({}, linePath([[0, 0], [1, 0], [1, 1]]))), 'path');
});

// ── path boxes ────────────────────────────────────────────────────────────────

test('boxToPath: a path box maps normalised nodes through the box frame', () => {
  const b = pathBox({ x: 100, y: 50, w: 200, h: 80 }, linePath([[0, 0], [1, 0], [1, 1], [0, 1]]));
  const p = boxToPath(b);
  assertFinite(p, 'unit path box');
  assert.deepEqual(pathBounds(p), { x0: 100, y0: 50, x1: 300, y1: 130 });
  assertClose(area(p), 200 * 80, 1e-12, 'unit path area');
});

test('boxToPath: nodes outside [0,1] are legal and overshoot the frame', () => {
  const b = pathBox({ x: 0, y: 0, w: 100, h: 100 }, linePath([[-0.5, -0.5], [1.5, -0.5], [1.5, 1.5], [-0.5, 1.5]]));
  const p = boxToPath(b);
  assertFinite(p, 'overshooting path box');
  assert.deepEqual(pathBounds(p), { x0: -50, y0: -50, x1: 150, y1: 150 });
});

test('boxToPath: a rotated path box rotates about the frame centre like every other box', () => {
  const nodes = linePath([[0, 0], [1, 0], [0.5, 1]]);
  const flat = boxToPath(pathBox({ x: 0, y: 0, w: 200, h: 100 }, nodes));
  const spun = boxToPath(pathBox({ x: 0, y: 0, w: 200, h: 100, rot: 45 }, nodes));
  assertFinite(flat, 'flat path box'); assertFinite(spun, 'spun path box');
  assert.ok(maxCoordDiff(spun, rotatePath(flat, 100, 50, 45)) < 1e-9);
});

test('boxToPath: a multi-contour payload lowers to several contours', () => {
  const outer = linePath([[0, 0], [1, 0], [1, 1], [0, 1]]) as { nodes: unknown[] };
  const inner = linePath([[0.25, 0.25], [0.25, 0.75], [0.75, 0.75], [0.75, 0.25]]);
  const b = pathBox({ w: 100, h: 100 }, [outer, inner] as PathPayload);
  const p = boxToPath(b);
  assertFinite(p, 'two contours');
  assert.equal(p.length, 2);
  // Opposite windings, so the inner loop reads as a hole: 10000 − 2500.
  assertClose(area(p), 7500, 1e-12, 'ring area');
});

test('boxToPath: unusable path fields lower to null, never to a rectangle', () => {
  const frame = { x: 0, y: 0, w: 100, h: 100 };
  const bad = [
    '',                       // absent
    '   ',                    // blank
    'nonsense',
    '2!cubic!1_.5!0',         // a NEWER format version: refused, never guessed at
    '1!!1_.5!0',              // no kind
    '1!CUBIC!1_.5!0',         // kind is shape-validated lower-case
    '1!cubic!1',              // a header with no nodes
    '1!cubic!1_abc!0',        // unparseable coordinate
    '1!cubic!1_1e3!0',        // exponent form is not what this format emits
    '1!cubic!1_ 0.5!0',       // nor is a padded number
    '1!cubic!1_.5!0!!!!!!x',  // unknown continuity
    '1!cubic!1_.5!0!!!!!!c!9', // a field past the record's end
    '1!wat!1_0!0_1!1',        // decodes, but no engine can lower that kind
    '1!cubic!1_0!0',          // one node lowers to no curves
    '%7B%22kind',             // percent-encoded anything: this format needs no escaping
    // The OLD shell-side format (percent-encoded JSON) is refused outright rather than
    // partly read - the seam this module's codec delegation exists to close.
    encodeURIComponent(JSON.stringify(linePath([[0, 0], [1, 0], [1, 1]]))),
    JSON.stringify(linePath([[0, 0], [1, 0], [1, 1]])),
  ];
  for (const path of bad) {
    assert.equal(boxToPath({ kind: 'path', ...frame, path } as Box), null, `should be null: ${path}`);
  }
});

test('boxToPath: an EMPTY handle field reads as "no handle", not as a handle of zero', () => {
  // Written literally, because the encoder trims the trailing empties this exercises:
  // node 0 declares a handle block of four blanks, which must mean "absent" - a handle
  // pinned at the point would collapse the segment instead of leaving it straight.
  const p = boxToPath({ kind: 'path', w: 100, h: 100, path: '1!cubic!1_0!0!!!!_1!0_1!1' } as Box);
  assertFinite(p, 'empty handle fields');
  assertClose(area(p), 5000, 1e-12, 'triangle area');
});

test('boxToPath: a non-finite handle is rejected rather than propagated', () => {
  // `1e999` is Infinity to `Number()`, and the exponent form is not something this
  // format emits - either reason is enough to refuse the whole value.
  assert.equal(boxToPath({ kind: 'path', w: 100, h: 100, path: '1!cubic!1_0!0!1e999!0!0!0_1!1' } as Box), null);
});

test('decodeAuthoredPath: too-complex and malformed stay apart, and agree with the engine', () => {
  // The distinction is the ENGINE's to make - the shell must not guess where the
  // boundary is - so the oracle is the engine's own reason for the same value.
  const nodes = (n: number): { x: number; y: number; hInX: number; hOutY: number }[] =>
    Array.from({ length: n }, (_, i) => ({ x: i / n, y: 0.123456, hInX: -0.027345, hOutY: 0.019876 }));
  // Legal to encode (20k nodes is the ceiling, not past it) but far past the character
  // ceiling once written out: well-formed and too big, which is not the same as junk.
  const huge = encodeAuthoredPath({ kind: 'cubic', closed: true, nodes: nodes(20_000) });
  assert.ok(huge.length > 400_000, `expected an over-ceiling value, got ${huge.length} chars`);
  assert.equal(decodeAuthoredPath(huge), 'too-complex');
  assert.equal(decodeAuthoredPathsResult(huge), 'too-complex');

  for (const bad of ['', '  ', 'nonsense', '2!cubic!1_.5!0', '1!cubic!1_abc!0']) {
    assert.equal(decodeAuthoredPath(bad), 'malformed', `malformed: ${bad}`);
    if (bad.trim()) assert.equal(decodeAuthoredPathsResult(bad), 'malformed', `engine agrees: ${bad}`);
  }
});

test('encodeAuthoredPath / decodeAuthoredPath: round trip, and no bare commas survive', () => {
  const p = { kind: 'cubic' as const, closed: true, nodes: [{ x: 0, y: 0, hOutX: 0.5 }, { x: 1, y: 1 }] };
  const enc = encodeAuthoredPath(p);
  assert.ok(!enc.includes(','), 'a raw comma would corrupt the compact blocks encoding');
  assert.ok(!enc.includes('~'));
  const back = decodeAuthoredPath(enc);
  assert.ok(Array.isArray(back));
  assert.deepEqual(back[0]!.nodes[0], { x: 0, y: 0, hOutX: 0.5 });
});

// ── the delegation itself: ONE codec, two callers ─────────────────────────────
//
// The defect this replaced was two codecs with the same names and incompatible formats,
// each tested only against itself, so nothing anywhere asserted that a value written on
// one side could be read on the other. These tests are that assertion, in both
// directions, and they are the reason the seam cannot silently re-open.

test('delegation: what this module encodes, the ENGINE decodes - single and multi path', () => {
  const one: PathPayload = { kind: 'cubic', closed: true, nodes: [
    { x: 0.25, y: 0.125, hOutX: 0.5, hOutY: -0.0625, continuity: 'smooth' },
    { x: 0.75, y: 0.875, hInX: -0.5, hInY: 0.0625 },
  ] };
  const many: PathPayload = [
    linePath([[0, 0], [1, 0], [1, 1], [0, 1]]) as { kind: 'line'; closed: true; nodes: { x: number; y: number }[] },
    linePath([[0.25, 0.25], [0.25, 0.75], [0.75, 0.75], [0.75, 0.25]]) as never,
  ];
  for (const payload of [one, many]) {
    const enc = encodeAuthoredPath(payload);
    const viaEngine = decodeAuthoredPaths(enc);
    assert.ok(viaEngine, 'the engine could not read what the shell wrote');
    assert.deepEqual(viaEngine, decodeAuthoredPath(enc), 'the two decoders disagree');
    assert.equal(viaEngine!.length, Array.isArray(payload) ? payload.length : 1);
    // And through the BRIDGE, which is what hooks.js sees at render time.
    const viaBridge = makeGeomApi().decodeAuthored(enc);
    assert.ok(viaBridge.ok, 'host.geom could not read what the shell wrote');
    assert.deepEqual((viaBridge as { ok: true; value: unknown }).value, viaEngine);
  }
});

test('delegation: what the ENGINE encodes, this module decodes - byte-for-byte the same value', () => {
  const paths = [
    { kind: 'line' as const, closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
    { kind: 'line' as const, closed: true, nodes: [{ x: 0.25, y: 0.25 }, { x: 0.25, y: 0.75 }, { x: 0.75, y: 0.75 }, { x: 0.75, y: 0.25 }] },
  ];
  for (const payload of [[paths[0]!], paths]) {
    const fromEngine = encodeAuthoredPaths(payload);
    assert.equal(fromEngine, encodeAuthoredPath(payload.length === 1 ? payload[0]! : payload),
      'the two encoders emit different bytes');
    const decoded = decodeAuthoredPath(fromEngine);
    assert.ok(Array.isArray(decoded));
    assert.deepEqual(decoded, payload);
  }
  // A box whose field was written by the engine renders through this module unchanged:
  // outer square minus inner square, 10000 − 2500.
  const b = { kind: 'path', shape: 'rect', w: 100, h: 100, path: encodeAuthoredPaths(paths) } as Box;
  const p = boxToPath(b);
  assertFinite(p, 'engine-written two-contour field');
  assert.equal(p.length, 2);
  assertClose(area(p), 7500, 1e-9, 'ring area');
});

// ── pathToBox and the round trip everything rests on ──────────────────────────

test('pathToBox: frame is the path bbox, and boxToPath(pathToBox(p)) reproduces p', () => {
  const src = boxToPath(shapeBox({ shape: 'ellipse', x: 17, y: -9, w: 213, h: 97 }))!;
  const nb = pathToBox(src, shapeBox({ bg: '#ff0000', opacity: 40 }), { id: 'n1' });
  assert.ok(nb);
  assert.equal(nb!.kind, 'path');
  assert.equal(nb!.rot, 0);
  assert.equal(nb!.bg, '#ff0000');
  assert.equal(nb!.opacity, 40);
  assert.deepEqual([nb!.x, nb!.y, nb!.w, nb!.h], [17, -9, 213, 97]);
  const back = boxToPath(nb!);
  assertFinite(back, 'round trip');
  assertClose(area(back), area(src), WIRE_AREA_REL, 'round-trip area');
  assert.equal(sameRegion(src, back, pathBounds(src)!), 0);
  assert.ok(maxCoordDiff(back, src) < wireEps(213), `coords: ${maxCoordDiff(back, src)}`);
});

test('pathToBox: the round trip survives a ROTATED source', () => {
  const src = boxToPath(shapeBox({ shape: 'rounded', radius: 30, x: 40, y: 40, w: 220, h: 130, rot: 37.5 }))!;
  const nb = pathToBox(src, null, { id: 'n2' })!;
  assert.equal(nb.rot, 0);
  const back = boxToPath(nb)!;
  assertFinite(back, 'rotated round trip');
  assertClose(area(back), area(src), WIRE_AREA_REL, 'area');
  assert.equal(sameRegion(src, back, pathBounds(src)!), 0);
});

test('pathToBox: the round trip survives nodes outside [0,1]', () => {
  const src = boxToPath(pathBox({ x: 0, y: 0, w: 100, h: 100 },
    linePath([[-0.5, -0.25], [1.75, 0], [1.2, 1.4], [-0.3, 0.9]])))!;
  const nb = pathToBox(src, null, { id: 'n3' })!;
  const back = boxToPath(nb)!;
  assertFinite(back, 'overshoot round trip');
  assertClose(area(back), area(src), WIRE_AREA_REL, 'area');
  assert.equal(sameRegion(src, back, pathBounds(src)!), 0);
});

test('pathToBox: an open contour keeps its extra end node (no invented closing edge)', () => {
  const src = boxToPath(pathBox({ w: 100, h: 100 },
    { kind: 'line', closed: false, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }))!;
  const nb = pathToBox(src, null)!;
  const decoded = decodeAuthoredPath(nb.path as string);
  assert.ok(Array.isArray(decoded));
  assert.equal(decoded[0]!.closed, false);
  assert.equal(decoded[0]!.nodes.length, 3);
  const back = boxToPath(nb)!;
  assert.ok(maxCoordDiff(back, src) < wireEps(100));
});

test('pathToBox: a degenerate (zero-height) path normalises without dividing by zero', () => {
  const src = boxToPath(pathBox({ x: 0, y: 0, w: 100, h: 100 },
    { kind: 'line', closed: false, nodes: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }] }))!;
  const nb = pathToBox(src, null);
  assert.ok(nb);
  assert.equal(nb!.h, 1);
  assertFinite(boxToPath(nb!), 'flat path round trip');
});

test('pathToBox: refuses an empty or non-finite path rather than inventing a frame', () => {
  assert.equal(pathToBox([], null), null);
  assert.equal(pathToBox([{ closed: true, curves: [[0, 0, NaN, 0, 1, 1, 1, 1]] }], null), null);
});

// ── booleans ──────────────────────────────────────────────────────────────────

// Two overlapping squares, used by every boolean case below. Array order is z-order, so
// `lower` is at the BOTTOM and `upper` is on top.
const lower = shapeBox({ id: 'lo', x: 0, y: 0, w: 100, h: 100, bg: '#100000' });
const upper = shapeBox({ id: 'up', x: 60, y: 60, w: 60, h: 60, bg: '#002000' });
const OVERLAP = 40 * 40;

test('booleanBoxes: union area is the sum minus the overlap', () => {
  const r = booleanBoxes([lower, upper], 'union');
  assert.ok(okOf(r), JSON.stringify(r));
  assertFinite(r.path, 'union');
  assertClose(area(r.path), 10000 + 3600 - OVERLAP, 1e-9, 'union area');
  assert.ok(pointInPath(r.path, 20, 20));
  assert.ok(pointInPath(r.path, 110, 110));
  assert.ok(!pointInPath(r.path, 110, 20));
  // Union/intersect/xor take the TOPMOST operand's paint.
  assert.equal(r.boxes[0]!.bg, '#002000');
});

test('booleanBoxes: intersection is exactly the overlap', () => {
  const r = booleanBoxes([lower, upper], 'intersect');
  assert.ok(okOf(r));
  assertClose(area(r.path), OVERLAP, 1e-9, 'intersect area');
  assert.ok(pointInPath(r.path, 80, 80));
  assert.ok(!pointInPath(r.path, 20, 20));
  assert.ok(!pointInPath(r.path, 110, 110));
});

test('booleanBoxes: intersection of a circle with a square containing it is the circle', () => {
  const circle = shapeBox({ id: 'c', shape: 'circle', x: 0, y: 0, w: 100, h: 100 });
  const square = shapeBox({ id: 's', x: -50, y: -50, w: 200, h: 200 });
  const r = booleanBoxes([square, circle], 'intersect');
  assert.ok(okOf(r));
  assertClose(area(r.path), 2500 * Math.PI, 1e-3, 'circle ∩ containing square');
  assert.ok(pointInPath(r.path, 50, 50));
  assert.ok(!pointInPath(r.path, 2, 2), 'a square corner is outside the circle');
});

test('booleanBoxes: difference subtracts what is ON TOP from the bottommost shape', () => {
  const r = booleanBoxes([lower, upper], 'difference');
  assert.ok(okOf(r), JSON.stringify(r));
  assertClose(area(r.path), 10000 - OVERLAP, 1e-9, 'bottom minus top');
  assert.ok(pointInPath(r.path, 20, 20), 'the bottom shape survives');
  assert.ok(!pointInPath(r.path, 80, 80), 'the overlap is gone');
  assert.ok(!pointInPath(r.path, 110, 110), 'the top shape is not in the result');
  // …and the surviving material is the bottom shape's, so it keeps the bottom's paint.
  assert.equal(r.boxes[0]!.bg, '#100000');
  // The reverse z-order gives the OTHER answer, which is what makes the convention real.
  const flipped = booleanBoxes([upper, lower], 'difference');
  assert.ok(okOf(flipped));
  assertClose(area(flipped.path), 3600 - OVERLAP, 1e-9, 'flipped');
  assert.ok(pointInPath(flipped.path, 110, 110));
  assert.ok(!pointInPath(flipped.path, 20, 20));
});

test('booleanBoxes: xor is the union minus the overlap', () => {
  const r = booleanBoxes([lower, upper], 'xor');
  assert.ok(okOf(r));
  assertClose(area(r.path), 10000 + 3600 - 2 * OVERLAP, 1e-9, 'xor area');
  assert.ok(pointInPath(r.path, 20, 20));
  assert.ok(pointInPath(r.path, 110, 110));
  assert.ok(!pointInPath(r.path, 80, 80));
});

test('booleanBoxes: xor of two identical shapes is empty, not a phantom sliver', () => {
  const a = shapeBox({ id: 'a', x: 0, y: 0, w: 100, h: 100 });
  const b = shapeBox({ id: 'b', x: 0, y: 0, w: 100, h: 100 });
  const r = booleanBoxes([a, b], 'xor');
  assert.equal(r.ok, false);
  assert.equal((r as { reason: string }).reason, 'empty-result');
});

test('booleanBoxes: intersection of disjoint shapes is empty-result, not a wrong shape', () => {
  const far = shapeBox({ id: 'far', x: 900, y: 900, w: 50, h: 50 });
  const r = booleanBoxes([lower, far], 'intersect');
  assert.equal(r.ok, false);
  assert.equal((r as { reason: string }).reason, 'empty-result');
});

test('booleanBoxes: three operands fold bottom-to-top', () => {
  const c = shapeBox({ id: 'c', x: 200, y: 0, w: 50, h: 50 });
  const r = booleanBoxes([lower, upper, c], 'union');
  assert.ok(okOf(r));
  assertClose(area(r.path), 10000 + 3600 - OVERLAP + 2500, 1e-9, 'three-way union');
});

test('booleanBoxes: mixed fill rules are canonicalised per operand', () => {
  // An even-odd ring: two same-wound loops, where the inner one is a hole ONLY under
  // even-odd. Read as nonzero it would be solid, and the union area would be wrong.
  const ring = pathBox({ id: 'ring', x: 0, y: 0, w: 100, h: 100, fillRule: 'evenodd' },
    [linePath([[0, 0], [1, 0], [1, 1], [0, 1]]), linePath([[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]])] as PathPayload);
  const p = boxToPath(ring)!;
  assertFinite(p, 'even-odd ring');
  const tiny = shapeBox({ id: 't', x: 40, y: 40, w: 20, h: 20 });   // sits inside the hole
  const r = booleanBoxes([ring, tiny], 'union');
  assert.ok(okOf(r), JSON.stringify(r));
  assertClose(area(r.path), 10000 - 2500 + 400, 1e-9, 'ring ∪ plug');
});

// ── boolean failure modes ─────────────────────────────────────────────────────

test('booleanBoxes: one shape is needs-two', () => {
  const r = booleanBoxes([lower], 'union');
  assert.equal(r.ok, false);
  assert.equal((r as { reason: string }).reason, 'needs-two');
});

test('booleanBoxes: two text boxes are no-outline, and the indices say which', () => {
  const r = booleanBoxes([{ kind: 'text', w: 10, h: 10 } as Box, { kind: 'image', w: 10, h: 10 } as Box], 'union');
  assert.equal(r.ok, false);
  assert.equal((r as { reason: string }).reason, 'no-outline');
  assert.deepEqual((r as { indices?: number[] }).indices, [0, 1]);
});

test('booleanBoxes: one shape plus one text box is no-outline (not a silent single-operand union)', () => {
  const r = booleanBoxes([lower, { kind: 'text', w: 10, h: 10 } as Box], 'union');
  assert.equal(r.ok, false);
  assert.equal((r as { reason: string }).reason, 'no-outline');
});

test('booleanBoxes: an unreadable path field is bad-input, distinct from no-outline', () => {
  const broken = { kind: 'path', x: 0, y: 0, w: 100, h: 100, path: '%7B%22kind' } as Box;
  const r = booleanBoxes([lower, broken], 'union');
  assert.equal(r.ok, false);
  assert.equal((r as { reason: string }).reason, 'bad-input');
  assert.deepEqual((r as { indices?: number[] }).indices, [1]);
});

test('booleanBoxes: past the kernel ceiling, difference refuses as too-complex', () => {
  // 8100 line segments in one operand - over boolean.ts's MAX_CURVES, where difference
  // throws GeomLimitError rather than hand back the first operand unchanged.
  const nodes: { x: number; y: number }[] = [];
  for (let i = 0; i < 8100; i++) nodes.push({ x: i / 8100, y: i % 2 });
  const comb = pathBox({ id: 'comb', x: 0, y: 0, w: 100, h: 100 }, { kind: 'line', closed: true, nodes });
  assert.ok(boxToPath(comb), 'the comb itself lowers fine');
  const r = booleanBoxes([comb, shapeBox({ id: 'sq', x: 0, y: 0, w: 100, h: 100 })], 'difference');
  assert.equal(r.ok, false);
  assert.equal((r as { reason: string }).reason, 'too-complex');
  assert.match((r as { message: string }).message, /bounded work/);
});

// ── offset ────────────────────────────────────────────────────────────────────

const square100 = shapeBox({ id: 'sq', x: 0, y: 0, w: 100, h: 100, bg: '#123456' });

test('offsetBoxes: a square grown by d has the area each join style implies', () => {
  const d = 10;
  const cases: [NonNullable<Parameters<typeof offsetBoxes>[2]>['join'], number][] = [
    // miter: the full (w+2d)(h+2d) box - the mitres fill each corner square.
    ['miter', (100 + 2 * d) * (100 + 2 * d)],
    // round: the box plus a quarter disc per corner → w·h + 2d(w+h) + πd².
    ['round', 10000 + 2 * d * 200 + Math.PI * d * d],
    // bevel: the corner square replaced by half of itself → miter − 4d² + 2d².
    ['bevel', (100 + 2 * d) * (100 + 2 * d) - 2 * d * d],
  ];
  for (const [join, expected] of cases) {
    const r = offsetBoxes([square100], d, { join });
    assert.ok(okOf(r), `${join}: ${JSON.stringify(r)}`);
    assertFinite(r.path, `offset ${join}`);
    assertClose(area(r.path), expected, 1e-3, `offset ${join} area`);
    assert.deepEqual([r.boxes[0]!.x, r.boxes[0]!.y], [-10, -10]);
    assert.equal(r.boxes[0]!.bg, '#123456');
  }
});

test('offsetBoxes: an inward offset shrinks by exactly d on each side', () => {
  const r = offsetBoxes([square100], -30, { join: 'miter' });
  assert.ok(okOf(r), JSON.stringify(r));
  assertClose(area(r.path), 40 * 40, 1e-3, 'eroded area');
  assert.deepEqual([r.boxes[0]!.w, r.boxes[0]!.h], [40, 40]);
});

test('offsetBoxes: over-erosion goes EMPTY and never grows (the fold-handedness trap)', () => {
  for (const d of [-50, -51, -60, -150]) {
    const r = offsetBoxes([square100], d, { join: 'round' });
    if (r.ok) {
      const a = area(r.path);
      assertFinite(r.path, `erosion ${d}`);
      assert.ok(a < 10000, `d=${d} must not grow: area ${a}`);
      assert.ok(a >= 0, `d=${d} inverted: area ${a}`);
    } else {
      assert.equal(r.reason, 'empty-result', `d=${d}: ${r.reason}`);
    }
  }
});

test('offsetBoxes: an eroded circle loses exactly d of radius, and dies at the centre', () => {
  const circle = shapeBox({ id: 'c', shape: 'circle', x: 0, y: 0, w: 100, h: 100 });
  const in20 = offsetBoxes([circle], -20, { join: 'round' });
  assert.ok(okOf(in20));
  assertClose(area(in20.path), Math.PI * 30 * 30, 1e-3, 'r=30');
  const gone = offsetBoxes([circle], -60, { join: 'round' });
  if (gone.ok) assert.ok(area(gone.path) < 100, `an over-eroded circle grew: ${area(gone.path)}`);
  else assert.equal(gone.reason, 'empty-result');
});

test('offsetBoxes: a multi-shape selection offsets the merged silhouette', () => {
  const r = offsetBoxes([lower, upper], 0);
  assert.ok(okOf(r), JSON.stringify(r));
  assertClose(area(r.path), 10000 + 3600 - OVERLAP, 1e-6, 'merged region at d=0');
});

test('offsetBoxes: bad distance / no outline are distinct refusals', () => {
  assert.equal((offsetBoxes([square100], NaN) as { reason: string }).reason, 'bad-input');
  assert.equal((offsetBoxes([square100], Infinity) as { reason: string }).reason, 'bad-input');
  assert.equal((offsetBoxes([{ kind: 'text', w: 10, h: 10 } as Box], 5) as { reason: string }).reason, 'no-outline');
});

// ── stroke to path ────────────────────────────────────────────────────────────

test('strokeBoxesToPath: a stroked circle outlines to the Steiner area 2πRt', () => {
  const circle = shapeBox({ id: 'c', shape: 'circle', x: 0, y: 0, w: 100, h: 100, stroke: '#ff0000' });
  const r = strokeBoxesToPath([circle], { width: 10 });
  assert.ok(okOf(r), JSON.stringify(r));
  assertFinite(r.path, 'stroked circle');
  assertClose(area(r.path), 2 * Math.PI * 50 * 10, 2e-3, 'annulus area');
  assert.ok(pointInPath(r.path, 100, 50), 'the outer edge is paint');
  assert.ok(!pointInPath(r.path, 50, 50), 'the middle is a hole');
  // The outline is new material and takes the stroke colour as its fill.
  assert.equal(r.boxes[0]!.bg, '#ff0000');
  assert.equal(r.boxes[0]!.strokeW, 0);
});

test('strokeBoxesToPath: a stroked square outlines to perimeter × width, exactly', () => {
  const r = strokeBoxesToPath([square100], { width: 10, join: 'miter' });
  assert.ok(okOf(r));
  assertClose(area(r.path), 110 * 110 - 90 * 90, 1e-6, 'square band');
  assert.deepEqual([r.boxes[0]!.x, r.boxes[0]!.y, r.boxes[0]!.w, r.boxes[0]!.h], [-5, -5, 110, 110]);
});

test('strokeBoxesToPath: width falls back to the box strokeW, and refuses a useless one', () => {
  const r = strokeBoxesToPath([{ ...square100, strokeW: 8 }]);
  assert.ok(okOf(r));
  assertClose(area(r.path), 108 * 108 - 92 * 92, 1e-6, 'strokeW band');
  assert.equal((strokeBoxesToPath([square100], { width: 0 }) as { reason: string }).reason, 'bad-input');
  assert.equal((strokeBoxesToPath([square100], { width: -3 }) as { reason: string }).reason, 'bad-input');
  assert.equal((strokeBoxesToPath([square100], { width: NaN }) as { reason: string }).reason, 'bad-input');
  assert.equal((strokeBoxesToPath([{ kind: 'text' } as Box], { width: 4 }) as { reason: string }).reason, 'no-outline');
});

test('strokeBoxesToPath: CORNERS default to the box\'s own, and a bad value is ignored', () => {
  // Outline stroke has to reproduce the silhouette the user was looking at, so a bevelled
  // stroke must not outline with mitres. Asserted by AREA, which is the only thing that
  // distinguishes the three joins: on a 100 square stroked 10 wide, miter fills each
  // corner square (4000), bevel chamfers it (−2·5² per corner → 3950), round arcs it.
  const outlined = (box: Box, opts: Record<string, unknown> = {}): number => {
    const r = strokeBoxesToPath([box], { width: 10, ...opts });
    assert.ok(okOf(r), JSON.stringify(r));
    return area(r.path);
  };
  assertClose(outlined({ ...square100, strokeJoin: 'miter' }), 4000, 1e-9, 'miter from the box');
  assertClose(outlined({ ...square100, strokeJoin: 'bevel' }), 3950, 1e-9, 'bevel from the box');
  assertClose(outlined({ ...square100, strokeJoin: 'round' }), 4000 - 4 * 25 + Math.PI * 25, 1e-3, 'round from the box');
  // An explicit option still wins over the box - the caller is the outer authority.
  assertClose(outlined({ ...square100, strokeJoin: 'bevel' }, { join: 'miter' }), 4000, 1e-9, 'opts override');
  // A value that is not a join at all is the KERNEL'S DEFAULT, never a refused operation:
  // the box carries whatever the model holds, and a URL can write anything into it.
  for (const bad of ['sharp', 'miter-clip', '', 'round" ', null, 42]) {
    assertClose(
      outlined({ ...square100, strokeJoin: bad } as Box), outlined(square100), 1e-9,
      `join ${JSON.stringify(bad)} fell back to the default`,
    );
  }

  // ENDS are deliberately NOT inherited, and this is why: `lowerOperands` canonicalises
  // every operand through selfUnion, so an open path arrives here as a closed region and
  // there are no ends left for a cap to describe. `strokeCap` on the box is therefore
  // unobservable, and inheriting it would be code implying a behaviour that cannot happen.
  const line = pathBox(
    { id: 'ln', x: 0, y: 0, w: 100, h: 100 },
    { kind: 'line', closed: false, nodes: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }] },
  );
  const bare = outlined(line);
  for (const cap of ['butt', 'round', 'square']) {
    assertClose(outlined({ ...line, strokeCap: cap } as Box), bare, 1e-9, `strokeCap ${cap} is inert here`);
  }
});

test('strokeBoxesToPath: the outlined result carries no dash', () => {
  // `strokeToPath` outlines the whole centreline - the kernel has no dash stage - so a
  // dashed stroke outlines as one continuous shape and the dash describes nothing about
  // the result. Carrying it through would leave a style waiting to reappear the moment
  // someone gives the filled result a stroke of its own.
  const r = strokeBoxesToPath([{ ...square100, strokeW: 8, strokeDash: 'dashed', stroke: '#ff0000' }]);
  assert.ok(okOf(r), JSON.stringify(r));
  assert.equal(r.boxes[0]!.strokeDash, '');
  assert.equal(r.boxes[0]!.stroke, '');
  assert.equal(r.boxes[0]!.strokeW, 0);
  assert.equal(r.boxes[0]!.bg, '#ff0000', 'the stroke colour became the fill');
});

test('pathToBox: stroke DECORATION is inherited with the rest of the paint', () => {
  // A dashed, flat-ended, bevelled shape that came back from Unite solid and round-ended
  // reads as the operation having silently restyled the artwork. Decoration is paint.
  const donor = pathBox({
    id: 'up', x: 60, y: 60, w: 60, h: 60,
    bg: '#002000', stroke: '#ff0000', strokeW: 6, fillRule: 'evenodd',
    strokeDash: 'dotted', strokeCap: 'butt', strokeJoin: 'bevel', opacity: 40, blend: 'multiply',
  }, linePath([[0, 0], [1, 0], [1, 1], [0, 1]]));
  const r = booleanBoxes([lower, donor], 'union');
  assert.ok(okOf(r), JSON.stringify(r));
  const out = r.boxes[0]!;
  // Union takes the TOPMOST operand's paint, and the whole of it.
  assert.equal(out.strokeDash, 'dotted');
  assert.equal(out.strokeCap, 'butt');
  assert.equal(out.strokeJoin, 'bevel');
  assert.equal(out.stroke, '#ff0000');
  assert.equal(out.strokeW, 6);
  assert.equal(out.fillRule, 'evenodd');
  assert.equal(out.bg, '#002000');
  assert.equal(out.opacity, 40);
  assert.equal(out.blend, 'multiply');

  // A donor that never set them does not gain them - an absent field stays absent rather
  // than being written as a default, which would put three columns into every shared URL.
  const plain = booleanBoxes([donor, lower], 'union');
  assert.ok(okOf(plain));
  for (const k of ['strokeDash', 'strokeCap', 'strokeJoin']) {
    assert.equal(plain.boxes[0]![k], undefined, `${k} was invented`);
  }
});

// ── simplify ──────────────────────────────────────────────────────────────────

test('simplifyBoxes: fewer nodes, same shape', () => {
  // A 16-segment cubic circle in normalised coords: more curves than a circle needs.
  const n = 16, k = (4 / 3) * Math.tan(Math.PI / n);
  const nodes = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    const cx = 0.5 + 0.5 * Math.cos(a), cy = 0.5 + 0.5 * Math.sin(a);
    const tx = -Math.sin(a) * 0.5 * k, ty = Math.cos(a) * 0.5 * k;
    return { x: cx, y: cy, hOutX: tx, hOutY: ty, hInX: -tx, hInY: -ty };
  });
  const b = pathBox({ id: 'circ', x: 0, y: 0, w: 200, h: 200 }, { kind: 'cubic', closed: true, nodes });
  const before = boxToPath(b)!;
  assertFinite(before, 'dense circle');
  // 2px, not 0.05: the kernel's `simplifyCubics` refuses to shorten this loop below a
  // tolerance of about 2, even though the 4-segment kappa circle it eventually returns is
  // accurate to 0.03 on r=100. Conservative, not wrong - but the number is the kernel's.
  const r = simplifyBoxes([b], 3);
  assert.ok(okOf(r), JSON.stringify(r));
  assertFinite(r.path, 'simplified');
  const decoded = decodeAuthoredPath(r.boxes[0]!.path as string);
  assert.ok(Array.isArray(decoded));
  assert.ok(decoded[0]!.nodes.length < n, `expected fewer than ${n} nodes, got ${decoded[0]!.nodes.length}`);
  assertClose(area(r.path), area(before), 1e-3, 'simplified area');
});

test('simplifyBoxes: primitive shapes are skipped, not downgraded to paths', () => {
  const r = simplifyBoxes([square100, shapeBox({ id: 'e', shape: 'ellipse', w: 100, h: 100 })], 0.5);
  assert.equal(r.ok, false);
  assert.equal((r as { reason: string }).reason, 'not-applicable');
  assert.deepEqual((r as { indices?: number[] }).indices, [0, 1], 'and it says which boxes it left alone');
});

test('simplifyBoxes: a shape box alongside a path box is skipped by index', () => {
  const b = pathBox({ id: 'p', w: 100, h: 100 }, linePath([[0, 0], [1, 0], [1, 1], [0, 1]]));
  const r = simplifyBoxes([square100, b], 0.5);
  assert.ok(okOf(r), JSON.stringify(r));
  assert.deepEqual(r.skipped, [0]);
  assert.equal(r.boxes.length, 1);
});

test('simplifyBoxes: rejects a useless tolerance and an unreadable path', () => {
  const b = pathBox({ id: 'p', w: 100, h: 100 }, linePath([[0, 0], [1, 0], [1, 1]]));
  assert.equal((simplifyBoxes([b], 0) as { reason: string }).reason, 'bad-input');
  assert.equal((simplifyBoxes([b], NaN) as { reason: string }).reason, 'bad-input');
  const broken = { kind: 'path', w: 100, h: 100, path: '%7B%22' } as Box;
  assert.equal((simplifyBoxes([broken], 0.5) as { reason: string }).reason, 'bad-input');
});

// ── replaceBoxes ──────────────────────────────────────────────────────────────

const idsOf = (bs: Box[]): string[] => bs.map((b) => String(b.id ?? ''));

test('replaceBoxes: the result takes the topmost consumed position', () => {
  const bs = [shapeBox({ id: 'a' }), shapeBox({ id: 'b' }), shapeBox({ id: 'c' }), shapeBox({ id: 'd' })];
  const out = replaceBoxes(bs, ['a', 'c'], -1, shapeBox({ id: 'n' }));
  assert.deepEqual(idsOf(out), ['b', 'n', 'd']);
});

test('replaceBoxes: an explicit insertAt wins', () => {
  const bs = [shapeBox({ id: 'a' }), shapeBox({ id: 'b' }), shapeBox({ id: 'c' })];
  assert.deepEqual(idsOf(replaceBoxes(bs, ['a', 'c'], 0, shapeBox({ id: 'n' }))), ['n', 'b']);
  assert.deepEqual(idsOf(replaceBoxes(bs, ['b'], 99, shapeBox({ id: 'n' }))), ['a', 'c', 'n']);
});

test('replaceBoxes: an unknown removeId consumes nothing and appends', () => {
  const bs = [shapeBox({ id: 'a' })];
  assert.deepEqual(idsOf(replaceBoxes(bs, ['zzz'], -1, shapeBox({ id: 'n' }))), ['a', 'n']);
});

test('replaceBoxes: several results insert in order', () => {
  const bs = [shapeBox({ id: 'a' }), shapeBox({ id: 'b' })];
  const out = replaceBoxes(bs, ['a'], -1, [shapeBox({ id: 'n1' }), shapeBox({ id: 'n2' })]);
  assert.deepEqual(idsOf(out), ['n1', 'n2', 'b']);
});

test('replaceBoxes: a survivor clipped to a consumed box is RETARGETED to the result', () => {
  const bs = [shapeBox({ id: 'mask' }), shapeBox({ id: 'art', clip: 'mask' }), shapeBox({ id: 'other', clip: 'art' })];
  const out = replaceBoxes(bs, ['mask'], -1, shapeBox({ id: 'n' }));
  assert.equal(out.find((b) => b.id === 'art')!.clip, 'n');
  assert.equal(out.find((b) => b.id === 'other')!.clip, 'art', 'an intact reference is left alone');
});

test('replaceBoxes: clip:"clear" writes an empty string instead', () => {
  const bs = [shapeBox({ id: 'mask' }), shapeBox({ id: 'art', clip: 'mask' })];
  const out = replaceBoxes(bs, ['mask'], -1, shapeBox({ id: 'n' }), { clip: 'clear' });
  assert.equal(out.find((b) => b.id === 'art')!.clip, '');
});

test('replaceBoxes: a result with no id cannot be a clip target, so the clip is cleared', () => {
  const bs = [shapeBox({ id: 'mask' }), shapeBox({ id: 'art', clip: 'mask' })];
  const out = replaceBoxes(bs, ['mask'], 5, shapeBox({}));
  assert.equal(out.find((b) => b.id === 'art')!.clip, '');
});

test('replaceBoxes: group membership resolves rather than vanishing', () => {
  const shared = [shapeBox({ id: 'a', group: 'g1' }), shapeBox({ id: 'b', group: 'g1' }), shapeBox({ id: 'c' })];
  const out1 = replaceBoxes(shared, ['a', 'b'], -1, shapeBox({ id: 'n' }));
  assert.equal(out1.find((b) => b.id === 'n')!.group, 'g1', 'one shared group is inherited');

  const mixed = [shapeBox({ id: 'a', group: 'g1' }), shapeBox({ id: 'b', group: 'g2' })];
  const out2 = replaceBoxes(mixed, ['a', 'b'], -1, shapeBox({ id: 'n' }));
  assert.equal(out2.find((b) => b.id === 'n')!.group, 'g2', 'otherwise the topmost consumed box wins');

  const none = [shapeBox({ id: 'a' }), shapeBox({ id: 'b' })];
  const out3 = replaceBoxes(none, ['a'], -1, shapeBox({ id: 'n' }));
  assert.equal(out3.find((b) => b.id === 'n')!.group, undefined);

  const explicit = [shapeBox({ id: 'a', group: 'g1' })];
  const out4 = replaceBoxes(explicit, ['a'], -1, shapeBox({ id: 'n', group: '' }));
  assert.equal(out4.find((b) => b.id === 'n')!.group, '', 'an explicit group on the new box is not overwritten');
});

test('replaceBoxes: boxes with no id are addressed by array index, like idOf does', () => {
  const bs = [shapeBox({}), shapeBox({}), shapeBox({ id: 'c' })];
  const out = replaceBoxes(bs, ['1'], -1, shapeBox({ id: 'n' }));
  assert.equal(out.length, 3);
  assert.deepEqual(idsOf(out), ['', 'n', 'c']);
});

test('replaceBoxes: never mutates the input array or its rows', () => {
  const a = shapeBox({ id: 'a', clip: 'mask' });
  const bs = [shapeBox({ id: 'mask' }), a];
  const before = JSON.stringify(bs);
  replaceBoxes(bs, ['mask'], -1, shapeBox({ id: 'n' }));
  assert.equal(JSON.stringify(bs), before);
});

// ── whole-pipeline sanity ─────────────────────────────────────────────────────

test('a union commits as one box that lowers back to the same region', () => {
  const boxes = [shapeBox({ id: 'a', x: 0, y: 0, w: 100, h: 100 }), shapeBox({ id: 'b', shape: 'circle', x: 60, y: 60, w: 80, h: 80 })];
  const r = booleanBoxes(boxes, 'union', { id: 'res' });
  assert.ok(okOf(r), JSON.stringify(r));
  const next = replaceBoxes(boxes, ['a', 'b'], -1, r.boxes[0]!);
  assert.deepEqual(idsOf(next), ['res']);
  const back = boxToPath(next[0]!);
  assertFinite(back, 'committed union');
  assertClose(area(back), area(r.path), 1e-6, 'committed area');
  assert.equal(sameRegion(back, r.path, pathBounds(r.path)!), 0);
});

test('DEFAULT_VECTOR_FIELDS matches the design manifest field names', () => {
  assert.equal(DEFAULT_VECTOR_FIELDS.idField, 'id');
  assert.equal(DEFAULT_VECTOR_FIELDS.shapeField, 'shape');
  assert.equal(DEFAULT_VECTOR_FIELDS.radiusField, 'radius');
  assert.equal(DEFAULT_VECTOR_FIELDS.rotationField, 'rot');
  assert.equal(DEFAULT_VECTOR_FIELDS.fillField, 'bg');
  assert.equal(DEFAULT_VECTOR_FIELDS.clipField, 'clip');
  assert.equal(DEFAULT_VECTOR_FIELDS.groupField, 'group');
});

test('a custom field config is honoured end to end', () => {
  const cfg = { xField: 'X', yField: 'Y', wField: 'W', hField: 'H', shapeField: 'S', rotationField: 'R' };
  const p = boxToPath({ kind: 'box', S: 'ellipse', X: 10, Y: 10, W: 100, H: 100, R: 0 } as Box, cfg);
  assertFinite(p, 'custom cfg');
  assertClose(area(p), 2500 * Math.PI, 3e-4, 'custom cfg ellipse');
});
