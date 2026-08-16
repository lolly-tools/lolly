// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for the DOM-free CSS box / border-radius geometry that the
 * export walkers (SVG + PDF) share. The crux is the CSS section 5.5 corner-overlap rule:
 * a huge border-radius must render as a pill (rx==ry==min(w,h)/2), not an ellipse.
 * Run with: node --test tests/css-box.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseCssLength, cornerRadii, uniformRadius, insetCorners, roundedRectPath, parseBoxShadow, parseTextShadow, gaussianShadowBands,
  parseCssMatrix, isNonAffineTransform, multiplyMat, matAboutPivot, isAxisAlignedMat, matToSvg,
} from '../engine/src/css-box.ts';
import type { CornerInputs, CornerRadii, Mat2D } from '../engine/src/css-box.ts';

const close = (a: number, b: number, eps = 1e-3): boolean => Math.abs(a - b) <= eps;
const corners = (v: string): CornerInputs => ({ topLeft: v, topRight: v, bottomRight: v, bottomLeft: v });

test('parseCssLength: px, %, junk, math functions', () => {
  assert.equal(parseCssLength('10px', 200), 10);
  assert.equal(parseCssLength('0'), 0);
  assert.equal(parseCssLength('50%', 300), 150);
  assert.equal(parseCssLength('', 100), 0);
  assert.equal(parseCssLength(null, 100), 0);
  // calc/min/max/clamp can't be resolved here → deterministic 0, never NaN
  assert.equal(parseCssLength('calc(5% + 10px)', 200), 0);
  assert.equal(parseCssLength('max(10px, 5%)', 200), 0);
});

test('cornerRadii: huge uniform radius collapses to a pill (rx==ry==min(w,h)/2)', () => {
  const r = cornerRadii(corners('999px'), 300, 80);
  for (const k of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const) {
    assert.ok(close(r[k][0], 40), `${k} rx`);   // min(w,h)/2 = 40
    assert.ok(close(r[k][1], 40), `${k} ry`);
  }
  assert.deepEqual(uniformRadius(r)!.map(Math.round), [40, 40]);
});

test('cornerRadii: 50% stays an ellipse on a non-square box, a circle on a square one', () => {
  const ell = cornerRadii(corners('50%'), 300, 80);
  assert.ok(close(ell.topLeft[0], 150) && close(ell.topLeft[1], 40)); // rx=w/2, ry=h/2
  assert.deepEqual(uniformRadius(ell)!.map(Math.round), [150, 40]);

  const circ = cornerRadii(corners('50%'), 200, 200);
  assert.deepEqual(uniformRadius(circ)!.map(Math.round), [100, 100]);
});

test('cornerRadii: small radius is unscaled (f = 1)', () => {
  const r = cornerRadii(corners('20px'), 300, 80);
  assert.deepEqual(uniformRadius(r), [20, 20]);
});

test('cornerRadii: radius bigger than half-height but smaller than half-width → pill, not ellipse', () => {
  // The vertical edge constraint pulls BOTH axes down to 40, so it is a stadium.
  const r = cornerRadii(corners('200px'), 300, 80);
  assert.deepEqual(uniformRadius(r)!.map(Math.round), [40, 40]);
});

test('cornerRadii: top-only rounding keeps the bottom corners square (4 distinct corners)', () => {
  const r = cornerRadii(
    { topLeft: '12px', topRight: '12px', bottomRight: '0px', bottomLeft: '0px' },
    200, 60,
  );
  // No overlap (12+12 ≤ 200, ≤ 60) so f = 1: top corners 12, bottom corners 0.
  assert.deepEqual(r.topLeft, [12, 12]);
  assert.deepEqual(r.topRight, [12, 12]);
  assert.deepEqual(r.bottomRight, [0, 0]);
  assert.deepEqual(r.bottomLeft, [0, 0]);
  assert.equal(uniformRadius(r), null, 'asymmetric corners are not uniform');
});

test('cornerRadii: asymmetric overlap scales every corner by one factor f', () => {
  // Top edge: 100 + 60 = 160 > 100 width → f = 100/160 = 0.625, applied to all.
  const r = cornerRadii(
    { topLeft: '100px', topRight: '60px', bottomRight: '0px', bottomLeft: '0px' },
    100, 400,
  );
  assert.ok(close(r.topLeft[0], 62.5) && close(r.topRight[0], 37.5));
  assert.ok(close(r.bottomRight[0], 0) && close(r.bottomLeft[0], 0));
});

test('uniformRadius: zero radius → [0,0]; equal corners → pair', () => {
  assert.deepEqual(uniformRadius(cornerRadii(corners('0'), 100, 100)), [0, 0]);
  assert.deepEqual(uniformRadius(cornerRadii(corners('8px'), 100, 100)), [8, 8]);
});

test('insetCorners: shrinks by inset, clamped to 0', () => {
  const r = { topLeft: [10, 10], topRight: [4, 4], bottomRight: [0, 0], bottomLeft: [10, 10] } as CornerRadii;
  const i = insetCorners(r, 6);
  assert.deepEqual(i.topLeft, [4, 4]);
  assert.deepEqual(i.topRight, [0, 0]);    // clamped, not -2
  assert.deepEqual(i.bottomRight, [0, 0]);
});

test('roundedRectPath: emits a closed 4-corner arc path; uniform pill is symmetric', () => {
  const r = cornerRadii(corners('999px'), 200, 60);
  const d = roundedRectPath(0, 0, 200, 60, r);
  assert.match(d, /^M/);
  assert.match(d, /Z$/);
  assert.equal((d.match(/A/g) || []).length, 4, 'four corner arcs');
  // pill radius = 30 on this box
  assert.ok(d.includes('A30,30'));
});

test('roundedRectPath: square (zero) corners emit no arcs', () => {
  const r = cornerRadii(corners('0'), 100, 50);
  const d = roundedRectPath(0, 0, 100, 50, r);
  assert.equal((d.match(/A/g) || []).length, 0);
});

test('parseBoxShadow: none / empty → []', () => {
  assert.deepEqual(parseBoxShadow('none'), []);
  assert.deepEqual(parseBoxShadow(''), []);
  assert.deepEqual(parseBoxShadow(null), []);
});

test('parseBoxShadow: single shadow (Chrome computed form, color first)', () => {
  const s = parseBoxShadow('rgba(0, 0, 0, 0.55) 0px 32px 80px 0px');
  assert.equal(s.length, 1);
  assert.deepEqual({ x: s[0]!.x, y: s[0]!.y, blur: s[0]!.blur, spread: s[0]!.spread }, { x: 0, y: 32, blur: 80, spread: 0 });
  assert.equal(s[0]!.color, 'rgba(0, 0, 0, 0.55)');
});

test('parseBoxShadow: multiple shadows, commas inside rgba() are not separators', () => {
  const s = parseBoxShadow('rgba(0, 0, 0, 0.55) 0px 32px 80px, rgba(0, 0, 0, 0.35) 0px 8px 24px');
  assert.equal(s.length, 2);
  assert.equal(s[1]!.y, 8);
  assert.equal(s[1]!.blur, 24);
});

test('parseBoxShadow: blur/spread optional; negative spread kept; blur clamped ≥0', () => {
  const s = parseBoxShadow('rgb(0,0,0) 4px 4px');
  assert.deepEqual({ blur: s[0]!.blur, spread: s[0]!.spread }, { blur: 0, spread: 0 });
  const sp = parseBoxShadow('rgb(0,0,0) 0px 2px 6px -2px');
  assert.equal(sp[0]!.spread, -2);
});

test('parseBoxShadow: inset shadows are FLAGGED, not skipped', () => {
  // They used to be dropped here on the grounds that they were not vector-
  // expressible. They are - the region between the border box and an offset,
  // shrunken copy of it - so the parser reports them and the caller decides.
  const one = parseBoxShadow('rgba(0,0,0,0.5) 0px 2px 4px inset');
  assert.equal(one.length, 1);
  assert.equal(one[0]!.inset, true);
  assert.equal(one[0]!.color, 'rgba(0,0,0,0.5)', 'the "inset" keyword must not be mistaken for a named colour');
  assert.deepEqual([one[0]!.x, one[0]!.y, one[0]!.blur], [0, 2, 4]);
  const mixed = parseBoxShadow('rgba(0,0,0,0.5) 0px 2px 4px, rgba(0,0,0,0.3) 0px 1px 2px inset');
  assert.deepEqual(mixed.map((m) => m.inset), [false, true], 'both survive, each flagged');
});

test('parseTextShadow: computed form, colour first', () => {
  const s = parseTextShadow('rgba(0, 0, 0, 0.6) 0px 2px 4px');
  assert.equal(s.length, 1);
  assert.deepEqual([s[0]!.x, s[0]!.y, s[0]!.blur], [0, 2, 4]);
  assert.equal(s[0]!.color, 'rgba(0, 0, 0, 0.6)');
});

test('parseTextShadow: authored form, offsets first', () => {
  // A value read off a stylesheet rather than a computed style puts the colour last.
  const s = parseTextShadow('2px 2px 0 #d33');
  assert.equal(s.length, 1);
  assert.deepEqual([s[0]!.x, s[0]!.y, s[0]!.blur], [2, 2, 0]);
  assert.equal(s[0]!.color, '#d33');
});

test('parseTextShadow: multiple, commas inside rgba() are not separators', () => {
  const s = parseTextShadow('rgba(0, 0, 0, 0.6) 0px 2px 4px, rgb(255, 0, 0) 1px 1px');
  assert.equal(s.length, 2);
  assert.deepEqual([s[1]!.x, s[1]!.y, s[1]!.blur], [1, 1, 0], 'blur defaults to 0');
});

test('parseTextShadow: none / empty / junk', () => {
  assert.deepEqual(parseTextShadow('none'), []);
  assert.deepEqual(parseTextShadow(''), []);
  assert.deepEqual(parseTextShadow(null), []);
  assert.deepEqual(parseTextShadow('rgb(0,0,0)'), [], 'a colour with no offsets is not a shadow');
});

test('parseTextShadow: a negative blur is clamped, negative offsets are kept', () => {
  const s = parseTextShadow('rgb(0,0,0) -3px -4px -5px');
  assert.deepEqual([s[0]!.x, s[0]!.y, s[0]!.blur], [-3, -4, 0]);
});

// ── 2-D transform matrix (rotate/skew/matrix support for the vector walkers) ──
const mclose = (m: Mat2D, e: Partial<Mat2D>): void => {
  for (const k of Object.keys(e) as (keyof Mat2D)[]) assert.ok(close(m[k], e[k]!), `${k}: ${m[k]} != ${e[k]}`);
};

test('parseCssMatrix: none / junk → null', () => {
  assert.equal(parseCssMatrix('none'), null);
  assert.equal(parseCssMatrix(''), null);
  assert.equal(parseCssMatrix(undefined), null);
  assert.equal(parseCssMatrix('matrix(1,2,3)'), null);   // too few
});

test('parseCssMatrix: 2-D matrix() round-trips', () => {
  mclose(parseCssMatrix('matrix(0.866, 0.5, -0.5, 0.866, 12, 34)')!, { a: 0.866, b: 0.5, c: -0.5, d: 0.866, e: 12, f: 34 });
});

test('parseCssMatrix: matrix3d flattens to its 2-D affine', () => {
  // a rotate+translate expressed as matrix3d (column-major, z identity)
  mclose(parseCssMatrix('matrix3d(0.7071,0.7071,0,0, -0.7071,0.7071,0,0, 0,0,1,0, 20,40,0,1)')!,
    { a: 0.7071, b: 0.7071, c: -0.7071, d: 0.7071, e: 20, f: 40 });
});

test('parseCssMatrix: matrix3d with real perspective/z → null (falls back to raster)', () => {
  assert.equal(parseCssMatrix('matrix3d(1,0,0,0.001, 0,1,0,0, 0,0,1,0, 0,0,0,1)'), null); // m14 perspective
  assert.equal(parseCssMatrix('matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,50,1)'), null);    // m43 z-translate
});

test('isNonAffineTransform tells "nothing to do" apart from "cannot be drawn"', () => {
  // ⚑ THE AMBIGUITY THIS RESOLVES, and what it cost: `parseCssMatrix` returns null for
  // `none`, for a 2-D affine it cannot parse, AND for a real perspective matrix. Both
  // export walkers read that single null as "nothing to do" and fell through to the AABB
  // path - which is CORRECT for `none` and a WRONG PICTURE for a perspective pose (a
  // tilted card emitted as an axis-aligned rect stretched to fill its projected bounding
  // box, silently; plans/104 section 12 Q2). This predicate is the gate that separates them.
  //
  // NOT tilted: nothing authored, or an affine (however it is spelled).
  assert.equal(isNonAffineTransform('none'), false);
  assert.equal(isNonAffineTransform(''), false);
  assert.equal(isNonAffineTransform(null), false);
  assert.equal(isNonAffineTransform(undefined), false);
  assert.equal(isNonAffineTransform('matrix(0.866, 0.5, -0.5, 0.866, 12, 34)'), false);
  assert.equal(isNonAffineTransform('matrix3d(0.7071,0.7071,0,0, -0.7071,0.7071,0,0, 0,0,1,0, 20,40,0,1)'), false,
    'a matrix3d that FLATTENS to a 2-D affine is expressible, and stays vector');

  // TILTED: a non-trivial perspective row (m14, m24, m44) - the only thing that makes a
  // FLAT element's painted result something no `matrix(a,b,c,d,e,f)` can reproduce.
  assert.equal(isNonAffineTransform('matrix3d(1,0,0,0.001, 0,1,0,0, 0,0,1,0, 0,0,0,1)'), true, 'm14');
  assert.equal(isNonAffineTransform('matrix3d(1,0,0,0, 0,1,0,0.001, 0,0,1,0, 0,0,0,1)'), true, 'm24');
  assert.equal(isNonAffineTransform('matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,0.5)'), true, 'm44');
  // The applier's own output shape, verbatim from a measured `rx −45` render.
  assert.equal(
    isNonAffineTransform('matrix3d(1, 0, 0, 0, 0, 0.659966, 0, -0.000589256, 0, 0, 1, 0, 0, 25.9781, 0, 1)'),
    true,
  );

  // ⚑ AND NARROWER THAN "parseCssMatrix REFUSED IT", from the algebra: a flat element's
  // points are all at z = 0, so every z-coupling term (m13, m23, m31..m34, m43) drops
  // out of `(x'/w', y'/w')`. A z translation with no perspective paints exactly what its
  // 2-D part paints, and rasterising it would be a fidelity loss in the name of fixing
  // one that was not there - on a `url-shot` of somebody else's page, `translateZ` is a
  // GPU-promotion hack, not a pose.
  assert.equal(isNonAffineTransform('matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,50,1)'), false,
    'a z translation with no perspective row is visually the identity');
  assert.equal(parseCssMatrix('matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,50,1)'), null,
    '…and parseCssMatrix still refuses it, which is exactly the ambiguity this predicate resolves');
  assert.equal(isNonAffineTransform('matrix3d(1,0,0,0, 0,0.7071,-0.7071,0, 0,0.7071,0.7071,0, 0,0,0,1)'), false,
    'an ORTHOGRAPHIC rotateX paints its 2-D affine part — a separate, pre-existing gap in the walkers');

  // "Unparseable" is NOT the same claim as "perspective": a hand-written or authored
  // value this module does not read must not send a caller down the raster hatch.
  assert.equal(isNonAffineTransform('rotate(12deg)'), false, 'an un-computed value is not a verdict');
  assert.equal(isNonAffineTransform('perspective(800px) rotateX(40deg)'), false);
  assert.equal(isNonAffineTransform('matrix3d(1,2,3)'), false, 'a malformed matrix3d is junk, not a pose');

  // And the two agree by construction, which is the property that keeps the walkers'
  // branches mutually exclusive: a value is non-affine iff parseCssMatrix refuses it.
  for (const v of [
    'none', 'matrix(1,0,0,1,0,0)', 'matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1)',
    'matrix3d(1,0,0,0.002, 0,1,0,0, 0,0,1,0, 0,0,0,1)',
    'matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,50,1)',
  ]) {
    if (isNonAffineTransform(v)) assert.equal(parseCssMatrix(v), null, `${v}: gate says perspective, parser must refuse`);
  }
});

test('multiplyMat: applies C then P; identity is neutral', () => {
  const scale2: Mat2D = { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 };
  const tx: Mat2D = { a: 1, b: 0, c: 0, d: 1, e: 10, f: 5 };
  // scale2 ∘ tx: translate first (10,5) then scale ×2 → point (0,0)→(20,10)
  const m = multiplyMat(scale2, tx);
  mclose(m, { a: 2, b: 0, c: 0, d: 2, e: 20, f: 10 });
});

test('matAboutPivot: a 90° rotation about a pivot fixes that pivot', () => {
  const rot90: Mat2D = { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 };
  const m = matAboutPivot(rot90, 100, 50);
  // the pivot maps to itself
  assert.ok(close(m.a * 100 + m.c * 50 + m.e, 100));
  assert.ok(close(m.b * 100 + m.d * 50 + m.f, 50));
});

test('isAxisAlignedMat: pure positive-scale/translate true; rotation/skew/flip false', () => {
  assert.equal(isAxisAlignedMat({ a: 2, b: 0, c: 0, d: 3, e: 9, f: 9 }), true);
  assert.equal(isAxisAlignedMat({ a: 0.9, b: 0.4, c: -0.4, d: 0.9, e: 0, f: 0 }), false);
  assert.equal(isAxisAlignedMat({ a: 1, b: 0, c: 0.5, d: 1, e: 0, f: 0 }), false); // skewX
  assert.equal(isAxisAlignedMat({ a: -1, b: 0, c: 0, d: 1, e: 0, f: 0 }), false);  // scaleX(-1) flip
  assert.equal(isAxisAlignedMat({ a: 1, b: 0, c: 0, d: -1, e: 0, f: 0 }), false);  // scaleY(-1) flip
});

test('matToSvg: compact, negative-zero normalised', () => {
  assert.equal(matToSvg({ a: 1, b: 0, c: -0, d: 1, e: 0, f: 0 }), 'matrix(1,0,0,1,0,0)');
});

// ── gaussianShadowBands ──────────────────────────────────────────────────────
// A blur-less renderer (PDF, EMF, EPS) can still draw a Gaussian: the coverage at
// signed distance t outside an edge is exactly Φ(-t/σ), so painting the shape at a
// series of outsets with the right alpha INCREMENTS composites to that curve. These
// tests check the composite, not the individual alphas - the increments are only
// meaningful once stacked.

/** Composite the bands the way a renderer does: outermost first, normal blending. */
function coverageAt(bands: { outset: number; alpha: number }[], t: number): number {
  let acc = 0;
  for (const b of bands) if (t <= b.outset) acc = acc + b.alpha * (1 - acc);
  return acc;
}
/** Φ(-t/σ) * alpha - what the blur actually produces. */
function trueCoverage(t: number, sigma: number, alpha: number): number {
  const erf = (x: number) => {
    const s = x < 0 ? -1 : 1, ax = Math.abs(x);
    const u = 1 / (1 + 0.3275911 * ax);
    const y = 1 - (((((1.061405429 * u - 1.453152027) * u + 1.421413741) * u - 0.284496736) * u + 0.254829592) * u) * Math.exp(-ax * ax);
    return s * y;
  };
  return alpha * 0.5 * (1 - erf(t / (sigma * Math.SQRT2)));
}

test('gaussianShadowBands: composites to the Gaussian coverage curve', () => {
  for (const [blur, alpha] of [[16, 0.35], [24, 0.5], [40, 0.9]] as const) {
    const sigma = blur / 2;
    const bands = gaussianShadowBands(blur, alpha);
    assert.ok(bands.length >= 8, `blur ${blur} produced only ${bands.length} bands`);
    let worst = 0;
    for (let t = -3 * sigma; t <= 3 * sigma; t += sigma / 20) {
      worst = Math.max(worst, Math.abs(coverageAt(bands, t) - trueCoverage(t, sigma, alpha)));
    }
    // Under 2 steps of an 8-bit channel - below what a shadow can even express.
    assert.ok(worst * 255 < 8, `blur ${blur}: worst alpha error ${(worst * 255).toFixed(1)}/255`);
  }
});

test('gaussianShadowBands: outermost first, monotonically inward', () => {
  const bands = gaussianShadowBands(20, 0.5);
  for (let i = 1; i < bands.length; i++) {
    assert.ok(bands[i]!.outset < bands[i - 1]!.outset, 'bands must march inward');
  }
  assert.ok(bands[0]!.outset > 0, 'the first band sits outside the shape edge');
  assert.ok(bands[bands.length - 1]!.outset < 0, 'the last band sits inside it, where coverage is full');
});

test('gaussianShadowBands: every alpha is a usable fraction', () => {
  for (const [blur, alpha] of [[2, 1], [8, 0.2], [60, 0.75]] as const) {
    for (const b of gaussianShadowBands(blur, alpha)) {
      assert.ok(Number.isFinite(b.outset) && Number.isFinite(b.alpha), 'no NaN may reach a coordinate');
      assert.ok(b.alpha > 0 && b.alpha <= 1, `alpha out of range: ${b.alpha}`);
    }
  }
});

test('gaussianShadowBands: reaches the shadow\'s own alpha at the centre, never past it', () => {
  const bands = gaussianShadowBands(16, 0.4);
  const inside = coverageAt(bands, -3 * 8);
  assert.ok(inside <= 0.4 + 1e-6, `overshoot: ${inside} > 0.4`);
  assert.ok(inside > 0.39, `undershoot: ${inside} — the shadow would be too light in the middle`);
});

test('gaussianShadowBands: no blur, or no alpha, means no bands', () => {
  assert.deepEqual(gaussianShadowBands(0, 0.5), []);
  assert.deepEqual(gaussianShadowBands(-4, 0.5), []);
  assert.deepEqual(gaussianShadowBands(10, 0), []);
});

test('gaussianShadowBands: band count is bounded for a pathological blur', () => {
  // Each band is a separate filled shape in the output, so this is a file-size and
  // render-time bound, not just tidiness.
  assert.ok(gaussianShadowBands(4000, 1).length <= 160);
});
