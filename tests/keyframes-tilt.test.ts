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
  type KfCameraView,
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
