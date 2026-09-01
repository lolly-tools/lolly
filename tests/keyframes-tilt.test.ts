// SPDX-License-Identifier: MPL-2.0
/**
 * plans/104 P2 - THE TILT TIER, pinned.
 *
 * `tests/keyframes.test.ts` owns the wire grammar and the affine projection; this file
 * owns the one thing that is NOT affine. Three claims, in the order they matter:
 *
 *  1. **A camera with no angle is untouched.** Not "close to": the same object, the
 *     same bits, from the same expressions. This is the byte-identity floor for every
 *     document written before P2, and it is why `cameraTilted` is an exact zero test
 *     rather than an epsilon.
 *  2. **The homography is the projection it generalises.** The element-local matrix
 *     collapses to `translate(dx, dy)` in the limit, the surface matrix reproduces
 *     hand-computed screen positions for a pitched camera, and the guard and DOF both
 *     reduce to their affine spellings at κ = 1.
 *  3. **The Surface glide pose is what the preset claims.** Near edge at the bottom,
 *     far edge receding, aim point dead centre, and the whole move home at the end.
 *
 * Every expected number below is derived on paper in the comment beside it (the camera
 * orbits its aim point at radius P - see `surfaceMatrix`), never copied out of a run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cameraTilted, dofBlur, kfMatrix3dCss, parseKf, projectLayer, projectSurfacePoint,
  resolveCamera, DEFAULT_CAMERA, KF_EFF_MAX, KF_GUARD_BAND,
  type KfCameraView, type KfMatrix3,
} from '../engine/src/keyframes.ts';

const W = 1920;
const H = 1080;
const P = 1200;
const view = (over: Partial<KfCameraView> = {}): KfCameraView => ({ ...DEFAULT_CAMERA, w: W, h: H, ...over });

const DEG = Math.PI / 180;
const near = (a: number, b: number, tol: number, what: string): void => {
  assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} is not within ${tol} of ${b}`);
};

// ── 1. the gate ──────────────────────────────────────────────────────────────

test('cameraTilted is an EXACT zero test on both angles', () => {
  assert.equal(cameraTilted(null), false);
  assert.equal(cameraTilted({}), false);
  assert.equal(cameraTilted({ rx: 0, ry: 0 }), false);
  assert.equal(cameraTilted({ rx: 0, ry: -0 }), false, 'negative zero is zero');
  assert.equal(cameraTilted({ rx: Number.NaN }), false, 'junk is not a tilt');
  assert.equal(cameraTilted({ rx: Number.POSITIVE_INFINITY }), false);
  // …and the smallest thing that is not zero IS one. An epsilon here would make a track
  // keyframing rx 0 → 40 change tiers mid-move, at whatever threshold was picked.
  assert.equal(cameraTilted({ rx: Number.MIN_VALUE }), true);
  assert.equal(cameraTilted({ ry: -1e-12 }), true);
});

test('an untilted camera takes the affine path, bit for bit', () => {
  const layer = { bx: 300, by: 200, dxT: 10, dyT: -5, dxK: 4, dyK: 7, z: 160, w: 400, h: 300 };
  const plain = projectLayer(view(), layer);
  // Every spelling of "no angle" the wire can produce.
  for (const cam of [
    view(),
    view({ rx: 0 }),
    view({ ry: 0 }),
    view({ rx: 0, ry: 0 }),
    view({ rx: -0, ry: -0 }),
  ]) {
    const got = projectLayer(cam, layer);
    assert.deepEqual(got, plain, 'the untilted branch must be the expression that shipped');
    assert.equal(got.m, null, 'and it hands back no matrix at all');
  }
  // The same, with the camera actually somewhere - a pan and a dolly must not start
  // taking a different path just because the tilt branch exists.
  const moved = view({ x: -140, y: 60, z: -220 });
  assert.equal(projectLayer(moved, layer).m, null);
  assert.equal(projectLayer({ ...moved, rx: 0, ry: 0 }, layer).scale, projectLayer(moved, layer).scale);
});

// ── 2. the homography ────────────────────────────────────────────────────────

test('the aim point is a fixed point: tilt pivots the artwork, it does not swing it away', () => {
  // The camera ORBITS `Q = (camX + W/2, camY + H/2, camZ)` at radius P, so the point it
  // was already looking at stays exactly where it was - for ANY angle. A camera that
  // swivelled in place instead would send the artwork out of frame on the first degree,
  // which is why the model is the one it is.
  for (const [rx, ry] of [[-40, 0], [0, 55], [-38, 22], [70, -70]] as const) {
    const cam = view({ rx, ry });
    const p = projectSurfacePoint(cam, W / 2, H / 2, 0);
    assert.ok(p, `rx=${rx} ry=${ry}: the aim point is in front of the camera`);
    near(p.x, W / 2, 1e-9, `aim x at rx=${rx} ry=${ry}`);
    near(p.y, H / 2, 1e-9, `aim y at rx=${rx} ry=${ry}`);
    near(p.d, P, 1e-9, `aim depth at rx=${rx} ry=${ry}`);
  }
  // …and with a PANNED camera the fixed point travels with it: the aim point is
  // `camX + W/2`, not the middle of the artboard.
  const panned = view({ x: -140, rx: -40 });
  const q = projectSurfacePoint(panned, W / 2 - 140, H / 2, 0);
  near(q!.x, W / 2, 1e-9, 'panned aim x');
  near(q!.y, H / 2, 1e-9, 'panned aim y');
});

test('a hand-computed pitched projection (rx = −40°, the Surface glide angle)', () => {
  // Rᵀ for rx = −40, ry = 0 is [[1,0,0],[0,cos40,−sin40],[0,sin40,cos40]] with the
  // signs of `camRotationT`: m11 = cos(−40) = 0.766044, m21 = −sin(−40) = +0.642788.
  // For a point b px BELOW the aim point on the z = 0 plane:
  //   g₁ = m11·b,  g₂ = m21·b,  D = P − g₂,  screen_y = H/2 + P·g₁/D
  const cam = view({ rx: -40 });
  const c40 = Math.cos(40 * DEG);
  const s40 = Math.sin(40 * DEG);
  for (const b of [540, 150, -540]) {
    const D = P - s40 * b;
    const wantY = H / 2 + (P * c40 * b) / D;
    const p = projectSurfacePoint(cam, W / 2, H / 2 + b, 0);
    assert.ok(p);
    near(p.x, W / 2, 1e-9, `x is untouched by a pure rx at b=${b}`);
    near(p.y, wantY, 1e-9, `y at b=${b}`);
    near(p.d, D, 1e-9, `view-axis depth at b=${b}`);
  }
  // The picture that means: the BOTTOM of the artwork is nearer (smaller D) and the top
  // recedes - the POV shot over a surface, near edge at the bottom of frame.
  const bottom = projectSurfacePoint(cam, W / 2, H, 0)!;
  const top = projectSurfacePoint(cam, W / 2, 0, 0)!;
  assert.ok(bottom.d < P && top.d > P, 'bottom nearer, top farther');
  near(bottom.y, 1122.014174, 1e-5, 'bottom edge lands at');
  near(top.y, 219.144790, 1e-5, 'top edge lands at');
  // …and the two halves are no longer the same height on screen, which IS the
  // perspective: the far half compresses hard (321 px of the 540 it started with) while
  // the near half, this far out, actually grows (582 px) - a plane receding to a
  // vanishing line, not a picture that has merely been squashed.
  near(H / 2 - top.y, 320.855210, 1e-5, 'the far half');
  near(bottom.y - H / 2, 582.014174, 1e-5, 'the near half');
  assert.ok(H / 2 - top.y < bottom.y - H / 2, 'the far half is the smaller of the two');
});

test('a hand-computed yawed projection (ry) brings the RIGHT edge nearer', () => {
  const cam = view({ ry: 30 });
  const c30 = Math.cos(30 * DEG);
  const s30 = Math.sin(30 * DEG);
  // Rᵀ for ry = 30 is [[cos30,0,−sin30],[0,1,0],[sin30,0,cos30]]:
  //   g₀ = cos30·a, g₂ = sin30·a, D = P − g₂
  for (const a of [480, -480]) {
    const D = P - s30 * a;
    const p = projectSurfacePoint(cam, W / 2 + a, H / 2, 0)!;
    near(p.x, W / 2 + (P * c30 * a) / D, 1e-9, `x at a=${a}`);
    near(p.y, H / 2, 1e-9, 'y is untouched by a pure ry');
    near(p.d, D, 1e-9, `depth at a=${a}`);
  }
  assert.ok(projectSurfacePoint(cam, W / 2 + 480, H / 2, 0)!.d < P, 'ry > 0 ⇒ right edge nearer');
  assert.ok(projectSurfacePoint(cam, W / 2 - 480, H / 2, 0)!.d > P, '…and left edge farther');
});

test('the element-local matrix IS translate(dx, dy) in the limit', () => {
  // The claim `composeTransform` rests on: the matrix takes the leading translate's
  // place because it generalises it. Shrink the angle and the two must converge - and
  // at exactly zero the affine branch takes over and hands back no matrix at all.
  const layer = { bx: 640, by: 400, dxT: 24, dyT: -12, z: 120, w: 300, h: 200 };
  const flat = projectLayer(view(), layer);
  for (const rx of [1e-2, 1e-4, 1e-6]) {
    const t = projectLayer(view({ rx }), layer);
    assert.ok(t.m, `rx=${rx} is tilted`);
    // The matrix, applied to the element's own origin (local 0,0), is the projected
    // offset - and the offset itself converges on the affine one.
    const m = t.m;
    near(m[2] / m[8], t.dx, 1e-9, 'matrix translation agrees with dx');
    near(m[5] / m[8], t.dy, 1e-9, 'matrix translation agrees with dy');
    near(t.dx, flat.dx, Math.max(1e-3, rx * 20), `dx at rx=${rx}`);
    near(t.dy, flat.dy, Math.max(1e-3, rx * 20), `dy at rx=${rx}`);
    near(t.scale, flat.scale, Math.max(1e-6, rx * 1e-2), `scale at rx=${rx}`);
    // The linear part converges on the identity: the leading term of the transform list
    // is a pure translate in the limit, which is exactly what it replaces.
    near(m[0] / m[8], 1, rx * 1e-2, 'a → 1');
    near(m[4] / m[8], 1, rx * 1e-2, 'e → 1');
    near(m[6] / m[8], 0, rx * 1e-4, 'g → 0');
    near(m[7] / m[8], 0, rx * 1e-4, 'h → 0');
  }
});

test('the matrix carries the SCALE back out, so every other consumer is unchanged', () => {
  // `KfProjection.scale` still means `scT · sK · eff` under tilt - the element-local
  // matrix divides the centre magnification out precisely so that the rotate and the
  // scale in the transform list keep composing against it in the order they always did.
  // Check it by pushing a local point through matrix ∘ scale and comparing with the
  // engine's own surface→screen map.
  const cam = view({ rx: -35, ry: 12 });
  const layer = { bx: 700, by: 500, z: 90, w: 400, h: 260 };
  const proj = projectLayer(cam, layer);
  assert.ok(proj.m);
  const m = proj.m;
  for (const [lx, ly] of [[0, 0], [120, -70], [-160, 90]] as const) {
    // The transform list is `matrix3d(m) … scale(proj.scale)`, applied right to left, so
    // the point the matrix sees is the local one already magnified by eff.
    const vx = lx * proj.scale;
    const vy = ly * proj.scale;
    const w = m[6] * vx + m[7] * vy + m[8];
    const px = (m[0] * vx + m[1] * vy + m[2]) / w + layer.bx;
    const py = (m[3] * vx + m[4] * vy + m[5]) / w + layer.by;
    // …and the surface point it should land on is the layer's own centre plus the
    // UNMAGNIFIED local offset, projected.
    const want = projectSurfacePoint(cam, layer.bx + lx, layer.by + ly, layer.z)!;
    near(px, want.x, 1e-6, `local (${lx},${ly}) x`);
    near(py, want.y, 1e-6, `local (${lx},${ly}) y`);
  }
});

test('kfMatrix3dCss spells a homography as the one CSS transform that divides by w', () => {
  const cam = view({ rx: -40 });
  const proj = projectLayer(cam, { bx: W / 2, by: H / 2, z: 0, w: 400, h: 300 });
  const css = kfMatrix3dCss(proj.m!);
  assert.match(css, /^matrix3d\(/);
  const n = css.slice('matrix3d('.length, -1).split(',').map((s) => Number(s.trim()));
  assert.equal(n.length, 16);
  assert.ok(n.every((v) => Number.isFinite(v)), `unparseable number in ${css}`);
  // Column-major: the third column is the identity's z column and the z OUTPUT is 0, so
  // the element stays FLAT - the Cover Flow rule (no perspective/preserve-3d ancestor,
  // and parseCssMatrix refuses a real 3D context).
  assert.deepEqual(n.slice(8, 12), [0, 0, 1, 0], 'the z column is the identity');
  assert.equal(n[2], 0, 'x maps to no z');
  assert.equal(n[6], 0, 'y maps to no z');
  assert.equal(n[14], 0, 'and the translation has no z either');
  // Normalised so the bottom-right entry is 1 - free (a homography is scale-invariant)
  // and what keeps the w row printable beside a translation three orders of magnitude
  // bigger.
  assert.equal(n[15], 1);
  // The perspective entry is real and has the sign the pitch implies: sin(−40)/1200.
  near(n[7] as number, Math.sin(-40 * DEG) / P, 1e-9, 'the w row carries the pitch');
  assert.equal(n[3], 0, 'a pure rx puts nothing in the x column of the w row');
  // Exact spelling, so a change in the serialisation is a change somebody chose.
  assert.equal(css, 'matrix3d(1, 0, 0, 0, 0, 0.766044443, 0, -0.000535656, 0, 0, 1, 0, 0, 0, 0, 1)');
});

// ── 3. the guard, generalised to the nearest corner ──────────────────────────

test('the guard ramps on the layer’s NEAREST CORNER under tilt, and on its plane without', () => {
  // Affine: the ramp is a property of the plane, so the layer's size cannot matter.
  const flatCam = view();
  const a = projectLayer(flatCam, { bx: 960, by: 540, z: 1000, w: 0, h: 0 });
  const b = projectLayer(flatCam, { bx: 960, by: 540, z: 1000, w: 1600, h: 900 });
  assert.equal(a.alphaGuard, b.alphaGuard, 'without tilt the extent is irrelevant');
  // u = 1000/1200 = 0.8333 ⇒ guard = (0.9 − 0.8333)/0.1 = 0.6667
  near(a.alphaGuard, (0.9 - 1000 / P) / 0.1, 1e-12, 'the section 4.5 ramp');

  // Tilted: a big layer's near corner reaches the near plane first, so the same centre
  // depth fades earlier the wider the layer is. This is the whole reason the guard had
  // to generalise - a corner crossing w = 0 is not a soft failure, it is garbage
  // geometry, and the ramp has to have finished before it can happen.
  const tilt = view({ rx: -60 });
  const point = projectLayer(tilt, { bx: 960, by: 540, z: 900 });
  const wide = projectLayer(tilt, { bx: 960, by: 540, z: 900, w: 1600, h: 1400 });
  assert.ok(wide.alphaGuard < point.alphaGuard, 'the extent now matters');
  // Hand-computed: κ-free, the corner's own depth is D = P − (m21·b + m22·ζ) with
  // m21 = −sin(−60) = 0.866025, m22 = cos(−60) = 0.5, b = +700, ζ = 900.
  const D = P - (Math.sin(60 * DEG) * 700 + Math.cos(60 * DEG) * 900);
  near(wide.alphaGuard, Math.max(0, Math.min(1, D / (KF_GUARD_BAND * P) - 1)), 1e-9, 'the corner ramp');
  // A layer the ramp has closed hands back NO matrix: its denominator may already have
  // changed sign somewhere across the box, and there is nothing to look at anyway.
  const gone = projectLayer(view({ rx: -75 }), { bx: 960, by: 540, z: 1000, w: 1800, h: 2600 });
  assert.equal(gone.alphaGuard, 0);
  assert.equal(gone.m, null);
});

test('eff freezes at KF_EFF_MAX on the tilted branch too', () => {
  const cam = view({ rx: -20 });
  const deep = projectLayer(cam, { bx: 960, by: 540, z: 5000 });
  assert.equal(deep.scale, KF_EFF_MAX, 'the pole is unreachable from either branch');
  assert.ok(deep.scale <= KF_EFF_MAX, 'a maximum a function can exceed is not one');
});

// ── 4. depth of field ────────────────────────────────────────────────────────

test('DOF reduces EXACTLY to the affine formula at zero tilt, and reads the view axis under it', () => {
  const base = { z: 0, p: P, f: 600, a: 1 };
  const affine = dofBlur(base, 0);
  assert.equal(dofBlur({ ...base, rx: 0, ry: 0 }, 0), affine, 'the same expression, the same bits');
  assert.equal(dofBlur({ ...base, rx: -0 }, 0), affine);
  // 40·|0−600|·eff(0)·eff(600)/1200 with eff(0)=1, eff(600)=1200/600=2 ⇒ 40.
  near(affine, 40, 1e-12, 'the pinned affine number');
  // Continuity across the branch: a hair of tilt is a hair of difference, not a step.
  near(dofBlur({ ...base, rx: 1e-6 }, 0), affine, 1e-6, 'no discontinuity at the gate');
  // Under a real pitch both plane depths move - D = P − κ·(z − camZ), κ = cos(rx) - and
  // the separation picks up its own κ:
  //   κ = cos40 = 0.766044, D(0) = 1200, D(600) = 1200 − 459.6 = 740.4
  //   blur = 40·600·(1200/1200)·(1200/740.4)·0.766044/1200 = 24.832…
  near(dofBlur({ ...base, rx: -40 }, 0), 24.832157, 1e-5, 'the tilted number');
  // Aperture 0 is still "everything sharp", tilted or not.
  assert.equal(dofBlur({ ...base, a: 0, rx: -40 }, 0), 0);
});

// ── 5. the Surface glide preset's own pose ───────────────────────────────────

test('the Surface glide track poses the camera low over the artwork and brings it home', () => {
  // The literal from KF_CAMERA_PRESETS. Kept here as a string rather than imported so
  // this file stays free of the web shell (and its stylesheet imports); the panel's own
  // suite pins that the two agree by applying the preset and reading the wire back.
  const GLIDE = 't0_el_x-120_y60_rx-40_f160_a0.8*t2600_eo_x-40_y36_rx-24_f90_a0.4*t5200_x0_y0_rx0_f0_a0';
  const track = parseKf(GLIDE);
  assert.equal(track.length, 3);
  const at = (t: number): ReturnType<typeof resolveCamera> =>
    resolveCamera([{ start: 0, end: null, base: null, track }], t);

  // AT THE OPENING: down among the surfaces. The pitch is the signature angle, and the
  // aperture is open with the focus plane out at z 160 - so the flat board is soft and
  // only the lifted layers are sharp (near-field DOF, section 9's "far layers soft in DOF").
  const open = at(0);
  assert.equal(open.rx, -40);
  assert.equal(open.a, 0.8);
  assert.equal(open.f, 160);
  assert.ok(cameraTilted(open), 'the opening frame is on the homography tier');
  // The near field IS sharper than the board: a layer at the focus plane has no defocus,
  // the flat board has plenty.
  assert.equal(dofBlur(open, 160), 0, 'the focal plane is sharp');
  // 3.6 px at stage-native scale - modest by construction, and that is the model
  // speaking rather than a weak preset: `DOF_K` is 40 px for a layer ONE FOCAL LENGTH
  // (1200) out of focus at a = 1, so a 160 px focus offset can only ever be 40·160/1200
  // of it. A near-field pull between real lifted layers is a few px, not a bokeh wash.
  const boardBlur = dofBlur(open, 0);
  assert.ok(boardBlur > 3, `the board should be soft, got ${boardBlur}`);
  assert.ok(dofBlur(open, 300) > 3, 'and so should anything well past the focal plane');

  // AT THE END: THE RESOLUTION RULE. Every channel the track touches is back at rest,
  // and the camera is off the tilt tier entirely - the last frame of a glide is the
  // authored composition, seen straight on.
  const home = at(5200);
  for (const [ch, want] of [['x', 0], ['y', 0], ['rx', 0], ['f', 0], ['a', 0]] as const) {
    assert.equal(home[ch], want, `${ch} does not come home`);
  }
  assert.equal(cameraTilted(home), false, 'and the shot lands flat');
  assert.equal(dofBlur(home, 0), 0, 'with nothing left out of focus');

  // MID-MOVE it is genuinely somewhere else, or "comes home" proves nothing.
  const mid = at(2600);
  assert.equal(mid.rx, -24);
  assert.ok(cameraTilted(mid));

  // …and the pitch is monotone toward rest across the whole move: a glide that
  // overshot back through level would read as a wobble, not a landing.
  let prev = -Infinity;
  for (const t of [0, 650, 1300, 2600, 3900, 5200]) {
    const rx = at(t).rx ?? 0;
    assert.ok(rx >= prev - 1e-9, `rx went back down at ${t}ms (${rx} after ${prev})`);
    prev = rx;
  }
});

test('the Orbit track swings the camera around the aim point and settles square', () => {
  const ORBIT = 't0_el_rx-14_ry34*t2600_es_rx-14_ry-34*t5200_rx0_ry0';
  const track = parseKf(ORBIT);
  const at = (t: number): ReturnType<typeof resolveCamera> =>
    resolveCamera([{ start: 0, end: null, base: null, track }], t);
  assert.equal(at(0).ry, 34);
  assert.equal(at(2600).ry, -34);
  assert.equal(at(5200).ry, 0);
  assert.equal(at(5200).rx, 0);
  assert.equal(cameraTilted(at(5200)), false, 'the resolution rule');
  // It is an ORBIT, not a wipe: the aim point never moves, so the artwork turns about
  // the centre of frame at every instant of it.
  for (const t of [0, 1300, 2600, 3900]) {
    const p = projectSurfacePoint({ ...at(t), w: W, h: H }, W / 2, H / 2, 0);
    if (!p) continue;                       // the last key is flat, and has no matrix
    near(p.x, W / 2, 1e-9, `aim x at ${t}ms`);
    near(p.y, H / 2, 1e-9, `aim y at ${t}ms`);
  }
});

// ── 4. the BOX's own tilt (P2.1) ─────────────────────────────────────────────

// CSS's own elementary rotations, spelled from the transforms spec rather than from
// this file's camera maths, so the comparison below is against an INDEPENDENT source.
// Row-major 3x3 over `[x, y, z]` in CSS's axes: x right, y DOWN, z toward the viewer.
const cssRotateX = (deg: number): number[] => {
  const c = Math.cos(deg * DEG); const s = Math.sin(deg * DEG);
  return [1, 0, 0, 0, c, -s, 0, s, c];
};
const cssRotateY = (deg: number): number[] => {
  const c = Math.cos(deg * DEG); const s = Math.sin(deg * DEG);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
};
const mul3x3 = (a: number[], b: number[]): number[] => {
  const o = new Array<number>(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      o[r * 3 + c] = (a[r * 3] as number) * (b[c] as number)
        + (a[r * 3 + 1] as number) * (b[3 + c] as number)
        + (a[r * 3 + 2] as number) * (b[6 + c] as number);
    }
  }
  return o;
};

/** Where `perspective(p) rotateY(ry) rotateX(rx)` puts an element-local `(u, v)`. */
const cssTiltPoint = (rx: number, ry: number, p: number, u: number, v: number): [number, number] => {
  // A CSS transform list applies RIGHT TO LEFT, so the point meets rotateX first.
  const M = mul3x3(cssRotateY(ry), cssRotateX(rx));
  const X = (M[0] as number) * u + (M[1] as number) * v;
  const Y = (M[3] as number) * u + (M[4] as number) * v;
  const Z = (M[6] as number) * u + (M[7] as number) * v;
  const W = 1 - Z / p; // perspective(p): the 4th row is (0, 0, −1/p, 1)
  return [X / W, Y / W];
};

/** Where the engine's element-local homography puts the same `(u, v)`. */
const enginePoint = (m: KfMatrix3, u: number, v: number): [number, number] => {
  const W = (m[6] as number) * u + (m[7] as number) * v + (m[8] as number);
  return [
    ((m[0] as number) * u + (m[1] as number) * v + (m[2] as number)) / W,
    ((m[3] as number) * u + (m[4] as number) * v + (m[5] as number)) / W,
  ];
};

test('a box tilt IS the CSS chain the static pose bakes: perspective rotateY rotateX', () => {
  // THE pin for P2.1, because the feature has two renderers and only one of them is
  // this file. An UNTIMED board never runs the engine at all: the design tool bakes
  // `perspective(1200px) rotateY(ry) rotateX(rx)` into the box's own inline transform
  // (community/design hooks.js `boxCss`, pinned as a literal string by
  // tests/timeline-model.test.ts) and the browser draws it. The moment a timeline
  // exists the applier writes THIS matrix instead. Same box, same two angles, so it has
  // to be the same picture - and the only honest way to know is to compose the CSS
  // chain from the spec's own matrices and compare where the corners land.
  //
  // Note the box sits OFF the aim point: the tilt pivots on the element's own centre,
  // which is what CSS does and what the design tool's transform-origin: 50% 50% means.
  for (const [rx, ry] of [[-40, 0], [0, 25], [-30, 20], [12.5, -75], [75, 75]] as const) {
    const m = projectLayer(view(), { bx: 300, by: 200, z: 0, w: 400, h: 300, rx, ry }).m as KfMatrix3;
    assert.ok(m, `a tilted box hands out a matrix at ${rx}/${ry}`);
    for (const [u, v] of [[200, 150], [-200, 150], [200, -150], [-200, -150], [0, 0], [37, -91]] as const) {
      const want = cssTiltPoint(rx, ry, P, u, v);
      const got = enginePoint(m, u, v);
      near(got[0], want[0], 1e-9, `rx ${rx} ry ${ry}: x of (${u}, ${v})`);
      near(got[1], want[1], 1e-9, `rx ${rx} ry ${ry}: y of (${u}, ${v})`);
    }
  }
});

test('…so a box `rx` and a CAMERA `rx` tip the picture OPPOSITE ways', () => {
  // Rotating an object one way is rotating the rig the other, and this is the assertion
  // that says so out loud rather than leaving it to be rediscovered from a screenshot.
  // `rx = -40` about the box centre at `P = 1200`: `R = Rx(-40)` is
  // [1,0,0, 0,cos40,sin40, 0,−sin40,cos40], so the box matrix is
  // [1, 0, 0,  0, cos40, 0,  0, sin40/1200, 1].
  const m = projectLayer(view(), { bx: W / 2, by: H / 2, z: 0, w: 400, h: 300, rx: -40 }).m as KfMatrix3;
  near(m[0], 1, 1e-12, 'x is untouched by a pure pitch');
  near(m[4], Math.cos(40 * DEG), 1e-12, 'y foreshortens by cos(rx)');
  near(m[7], Math.sin(40 * DEG) / 1200, 1e-12, 'and the w row is +sin(40°)/P');
  assert.equal(m[8], 1, 'the box matrix is already normalised');
  // A point BELOW the centre (larger y in CSS axes) gets w > 1, so it divides DOWN: the
  // BOTTOM edge recedes and the top edge comes forward, which is what CSS rotateX(−40)
  // does to a card. The CAMERA at rx −40 makes exactly the other picture (its own
  // golden is `surfaceMatrix`'s, and its w-row entry is NEGATIVE) - `camRotationT` is
  // Rᵀ, the box uses R.
  const wBelow = (m[6] as number) * 0 + (m[7] as number) * 100 + 1;
  assert.ok(wBelow > 1, `the near edge is the TOP one (w = ${wBelow})`);
  const cam = projectLayer(view({ rx: -40 }), { bx: W / 2, by: H / 2, z: 0, w: 400, h: 300 }).m as KfMatrix3;
  assert.ok((cam[7] as number) < 0 && (m[7] as number) > 0, 'the two w rows have opposite sign');
});

test('a box tilt moves no scalar - not the centre, not eff, not the guard', () => {
  // Nothing that reads a POSITION (handles, the motion path, the paint-order key) may
  // move because a box tilted: the box centre is a fixed point of its own matrix.
  for (const [rx, ry] of [[-40, 0], [0, 25], [-30, 20]] as const) {
    const at = { bx: W / 2, by: H / 2, z: 0, w: 400, h: 300 };
    const byBox = projectLayer(view(), { ...at, rx, ry });
    assert.equal(byBox.dx, 0);
    assert.equal(byBox.dy, 0);
    assert.equal(byBox.scale, 1, 'a box tilt is not a magnification');
    assert.equal(byBox.alphaGuard, 1, 'nor does it move the layer toward the near plane');
    const m = byBox.m as KfMatrix3;
    assert.deepEqual(enginePoint(m, 0, 0), [0, 0], 'the centre maps to itself');
  }
});

test('nothing tilted means NO matrix - the byte-identity floor for a box, too', () => {
  const layer = { bx: 300, by: 200, dxT: 10, dyT: -5, dxK: 4, dyK: 7, z: 160, w: 400, h: 300 };
  const plain = projectLayer(view(), layer);
  assert.equal(plain.m, null, 'precondition: no camera angle, no box angle, no matrix');
  // Every spelling of "the box authors no angle", on `cameraTilted`'s exact-zero terms.
  for (const over of [
    {}, { rx: 0 }, { ry: 0 }, { rx: 0, ry: -0 },
    { rx: Number.NaN }, { ry: Number.POSITIVE_INFINITY },
  ]) {
    const got = projectLayer(view(), { ...layer, ...over });
    assert.equal(got.m, null, `m must stay null for ${JSON.stringify(over)}`);
    assert.deepEqual(got, plain, 'and every other number is the one that shipped');
  }
  // …and the smallest angle that is not zero DOES produce one.
  assert.ok(projectLayer(view(), { ...layer, rx: Number.MIN_VALUE }).m, 'zero or not zero');
});

test('under an UNTILTED camera the box matrix carries the projected translate', () => {
  // `composeTransform`'s contract is "m3 REPLACES the leading translate and nothing
  // else". With no camera matrix to compose onto, the translate has to move INSIDE the
  // box matrix or a lifted, tilted box would paint at its authored centre.
  const layer = { bx: 300, by: 200, dxT: 40, dyT: -25, z: 240, w: 400, h: 300 };
  const flat = projectLayer(view(), layer);
  const tilted = projectLayer(view(), { ...layer, rx: -20 });
  assert.equal(tilted.dx, flat.dx, 'the reported centre is unmoved by the tilt');
  assert.equal(tilted.dy, flat.dy);
  const m = tilted.m as KfMatrix3;
  // The element's own origin maps to (dx, dy): T(dx,dy) · Hbox applied to (0,0,1).
  near((m[2] as number) / (m[8] as number), flat.dx, 1e-9, 'the matrix moves the centre to the projected one');
  near((m[5] as number) / (m[8] as number), flat.dy, 1e-9);
});

test('a tilted box under a tilted camera is the PRODUCT, and the camera leads', () => {
  // The documented model: the box is posed in its own frame, and the camera then
  // photographs an already-flattened trapezoid. Composed the other way round the
  // picture is a plate rotated in world space, which is a different (and unbuilt) tier.
  const layer = { bx: W / 2 + 220, by: H / 2 - 90, z: 0, w: 400, h: 300 };
  const cam = view({ rx: -30 });
  const both = projectLayer(cam, { ...layer, ry: 25 });
  const camOnly = projectLayer(cam, layer).m as KfMatrix3;
  const boxOnly = projectLayer(view(), { ...layer, ry: 25 }).m as KfMatrix3;
  assert.ok(both.m, 'a tilted camera over a tilted box still hands out a matrix');
  // C · B, computed here by hand from the two matrices the tiers hand out separately.
  // `boxOnly` carries T(dx,dy) as well, so strip it: under an untilted camera at z = 0
  // the projection is the identity, dx = dy = 0, and boxOnly IS the bare box matrix.
  assert.equal(projectLayer(view(), layer).dx, 0, 'precondition: this box needs no translate');
  const want = new Array<number>(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      want[r * 3 + c] = (camOnly[r * 3] as number) * (boxOnly[c] as number)
        + (camOnly[r * 3 + 1] as number) * (boxOnly[3 + c] as number)
        + (camOnly[r * 3 + 2] as number) * (boxOnly[6 + c] as number);
    }
  }
  assert.equal(kfMatrix3dCss(both.m as KfMatrix3), kfMatrix3dCss(want as unknown as KfMatrix3));
  // The centre, the magnification and the guard are the CAMERA's alone - a box tilt
  // changes no depth, so none of the scalars may move.
  const camAlone = projectLayer(cam, layer);
  assert.equal(both.dx, camAlone.dx);
  assert.equal(both.dy, camAlone.dy);
  assert.equal(both.scale, camAlone.scale);
  assert.equal(both.alphaGuard, camAlone.alphaGuard);
});

test("a BOX tilt pivots at the DEFAULT perspective, never the camera's own p dial", () => {
  // The hook's static bake is a fixed 1200; if the engine pivoted at cam.p, turning the
  // FOV slider would re-angle every still against the same board under the timeline.
  const layer = { bx: 320, by: 180, z: 0, rx: -40, ry: 25 };
  const base = projectLayer({ x: 0, y: 0, z: 0, p: 1200, f: 0, a: 0, w: 1280, h: 720 }, layer);
  for (const p of [400, 600, 3000, 12000]) {
    const m = projectLayer({ x: 0, y: 0, z: 0, p, f: 0, a: 0, w: 1280, h: 720 }, layer).m;
    assert.ok(m && base.m, 'both tilted');
    for (let i = 0; i < 9; i++) {
      assert.ok(Math.abs(m![i]! - base.m![i]!) < 1e-12, `entry ${i} moved when only cam.p did (p=${p})`);
    }
  }
});
